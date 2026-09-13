import csv
import io
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
import pandas as pd
import pytz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.market import Instrument, MarketCandle
from app.models.system import DataIngestionLog
from app.services.market_data.validator import validate_ohlcv, is_indian_market_session, IST
from app.schemas.market import CSVIngestionSummary
from app.core.logger import logger


class CSVMarketDataImporter:
    """
    Rigorously validates and imports historical 1-minute CSV market data
    for Indian stock market indices (NIFTY 50, BANK NIFTY).
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def import_csv_content(
        self,
        file_content: str,
        file_name: str,
        target_symbol: Optional[str] = None,
    ) -> CSVIngestionSummary:
        """
        Parses CSV string, validates each candle, checks timestamps and IST hours,
        deduplicates, and saves into market_candles table.
        """
        summary = CSVIngestionSummary(
            file_name=file_name,
            symbol=target_symbol or "UNKNOWN",
            total_rows=0,
            valid_rows=0,
            invalid_rows=0,
            duplicate_rows=0,
            status="PENDING",
            errors=[],
        )

        try:
            # Read CSV using pandas for high performance parsing
            df = pd.read_csv(io.StringIO(file_content))
        except Exception as e:
            summary.status = "FAILED"
            summary.errors.append(f"Failed to parse CSV file: {str(e)}")
            return summary

        # Normalize column headers
        df.columns = [c.strip().lower() for c in df.columns]

        # Map common column aliases
        col_map = {
            "datetime": "timestamp",
            "date": "timestamp",
            "time": "timestamp",
            "vol": "volume",
            "symbol": "instrument",
            "ticker": "instrument",
        }
        df = df.rename(columns=col_map)

        required_cols = {"timestamp", "open", "high", "low", "close"}
        if not required_cols.issubset(set(df.columns)):
            summary.status = "FAILED"
            summary.errors.append(
                f"Missing required columns. Required: {required_cols}. Found: {list(df.columns)}"
            )
            return summary

        if "volume" not in df.columns:
            df["volume"] = 0.0

        summary.total_rows = len(df)
        if summary.total_rows == 0:
            summary.status = "FAILED"
            summary.errors.append("CSV file is empty.")
            return summary

        # Determine instrument
        symbol_in_data = target_symbol
        if "instrument" in df.columns and df["instrument"].notna().any():
            raw_sym = str(df["instrument"].dropna().iloc[0]).strip().upper()
            if not symbol_in_data:
                symbol_in_data = raw_sym

        if not symbol_in_data:
            summary.status = "FAILED"
            summary.errors.append("No instrument symbol provided in CSV or request.")
            return summary

        summary.symbol = symbol_in_data

        # Verify or fetch instrument from DB
        stmt = select(Instrument).where(Instrument.symbol == symbol_in_data)
        result = await self.db.execute(stmt)
        instrument = result.scalar_one_or_none()

        if not instrument:
            # Try fuzzy match (e.g. NIFTY -> NIFTY 50)
            if "NIFTY" in symbol_in_data and "BANK" not in symbol_in_data:
                stmt = select(Instrument).where(Instrument.symbol == "NIFTY 50")
                result = await self.db.execute(stmt)
                instrument = result.scalar_one_or_none()
            elif "BANK" in symbol_in_data:
                stmt = select(Instrument).where(Instrument.symbol == "BANK NIFTY")
                result = await self.db.execute(stmt)
                instrument = result.scalar_one_or_none()

        if not instrument:
            summary.status = "FAILED"
            summary.errors.append(f"Instrument '{symbol_in_data}' is not registered in system.")
            return summary

        valid_candles: List[MarketCandle] = []
        seen_timestamps = set()
        min_ts: Optional[datetime] = None
        max_ts: Optional[datetime] = None

        for idx, row in df.iterrows():
            # 1. Parse timestamp
            raw_ts = str(row["timestamp"]).strip()
            try:
                # Try parsing as ISO or standard format
                parsed_dt = pd.to_datetime(raw_ts)
                if parsed_dt.tzinfo is None:
                    # Assume Asia/Kolkata if timezone not provided in Indian market CSV
                    localized_dt = IST.localize(parsed_dt.to_pydatetime())
                else:
                    localized_dt = parsed_dt.to_pydatetime().astimezone(IST)
                
                # Convert to UTC for database storage
                utc_dt = localized_dt.astimezone(pytz.utc).replace(tzinfo=None)
            except Exception as e:
                summary.invalid_rows += 1
                if len(summary.errors) < 20:
                    summary.errors.append(f"Row {idx+1}: Invalid timestamp '{raw_ts}': {str(e)}")
                continue

            # 2. Check market session
            if not is_indian_market_session(localized_dt):
                # Outside regular session hours (09:15 to 15:30 IST)
                summary.invalid_rows += 1
                if len(summary.errors) < 20:
                    summary.errors.append(
                        f"Row {idx+1}: Timestamp {localized_dt.strftime('%Y-%m-%d %H:%M')} outside NSE session (09:15-15:30 IST)."
                    )
                continue

            # 3. Deduplication check
            if utc_dt in seen_timestamps:
                summary.duplicate_rows += 1
                continue
            seen_timestamps.add(utc_dt)

            # 4. OHLC validation
            try:
                op = float(row["open"])
                hp = float(row["high"])
                lp = float(row["low"])
                cp = float(row["close"])
                vol = float(row["volume"])
            except (ValueError, TypeError) as e:
                summary.invalid_rows += 1
                if len(summary.errors) < 20:
                    summary.errors.append(f"Row {idx+1}: Non-numeric OHLCV value: {str(e)}")
                continue

            is_valid, validation_errors = validate_ohlcv(op, hp, lp, cp, vol)
            if not is_valid:
                summary.invalid_rows += 1
                if len(summary.errors) < 20:
                    summary.errors.append(f"Row {idx+1}: {', '.join(validation_errors)}")
                continue

            candle = MarketCandle(
                instrument_id=instrument.id,
                timestamp=utc_dt,
                timeframe="1m",
                open=op,
                high=hp,
                low=lp,
                close=cp,
                volume=vol,
                is_complete=True,
            )
            valid_candles.append(candle)

            if min_ts is None or utc_dt < min_ts:
                min_ts = utc_dt
            if max_ts is None or utc_dt > max_ts:
                max_ts = utc_dt

        summary.valid_rows = len(valid_candles)
        summary.start_timestamp = min_ts
        summary.end_timestamp = max_ts

        # 5. Persist to DB in batches to prevent high memory / lock contention
        if valid_candles:
            # Check existing candles in DB to prevent DB unique constraint violation
            existing_stmt = select(MarketCandle.timestamp).where(
                and_(
                    MarketCandle.instrument_id == instrument.id,
                    MarketCandle.timeframe == "1m",
                    MarketCandle.timestamp >= min_ts,
                    MarketCandle.timestamp <= max_ts,
                )
            )
            existing_res = await self.db.execute(existing_stmt)
            existing_db_timestamps = set(existing_res.scalars().all())

            filtered_candles = []
            for c in valid_candles:
                if c.timestamp in existing_db_timestamps:
                    summary.duplicate_rows += 1
                else:
                    filtered_candles.append(c)

            summary.valid_rows = len(filtered_candles)

            batch_size = 5000
            for i in range(0, len(filtered_candles), batch_size):
                batch = filtered_candles[i:i + batch_size]
                self.db.add_all(batch)
                await self.db.flush()

        summary.status = "SUCCESS" if summary.valid_rows > 0 else ("PARTIAL" if summary.duplicate_rows > 0 else "FAILED")

        # 6. Record ingestion log
        log_entry = DataIngestionLog(
            instrument_id=instrument.id,
            source_type="CSV",
            file_name=file_name,
            total_rows=summary.total_rows,
            valid_rows=summary.valid_rows,
            invalid_rows=summary.invalid_rows,
            duplicate_rows=summary.duplicate_rows,
            start_timestamp=summary.start_timestamp,
            end_timestamp=summary.end_timestamp,
            status=summary.status,
            error_details={"errors": summary.errors[:50]},
        )
        self.db.add(log_entry)
        await self.db.commit()

        logger.info(
            f"CSV Ingestion complete for {instrument.symbol}: {summary.valid_rows} imported, "
            f"{summary.duplicate_rows} duplicates, {summary.invalid_rows} invalid."
        )
        return summary
