from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.database import get_db
from app.models.market import Instrument, MarketCandle
from app.schemas.market import (
    InstrumentCreate,
    InstrumentOut,
    CandleOut,
    QuoteOut,
    CSVIngestionSummary,
)
from app.services.market_data.factory import get_market_data_provider
from app.services.market_data.csv_importer import CSVMarketDataImporter
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/instruments", response_model=List[InstrumentOut])
async def list_instruments(db: AsyncSession = Depends(get_db)):
    """List all supported instruments."""
    stmt = select(Instrument).where(Instrument.is_active == True).order_by(Instrument.symbol)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/instruments", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    inst_in: InstrumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new tradable instrument."""
    stmt = select(Instrument).where(Instrument.symbol == inst_in.symbol.upper())
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instrument '{inst_in.symbol}' already exists.",
        )

    instrument = Instrument(
        symbol=inst_in.symbol.upper(),
        name=inst_in.name,
        exchange=inst_in.exchange.upper(),
        lot_size=inst_in.lot_size,
        tick_size=inst_in.tick_size,
        instrument_type=inst_in.instrument_type.upper(),
    )
    db.add(instrument)
    await db.commit()
    await db.refresh(instrument)
    return instrument


@router.get("/quote", response_model=QuoteOut)
async def get_quote(
    symbol: str = Query("NIFTY 50", description="Instrument symbol (e.g. NIFTY 50, BANK NIFTY)"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the latest quote for an instrument."""
    provider = get_market_data_provider()
    quote = await provider.get_live_price(symbol)
    return QuoteOut(**quote)


@router.get("/candles", response_model=List[CandleOut])
async def get_candles(
    symbol: str = Query("NIFTY 50", description="Instrument symbol"),
    timeframe: str = Query("1m", description="Timeframe (1m, 3m, 5m, 15m)"),
    limit: int = Query(500, ge=1, le=5000, description="Max candle count"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch historical candles for charting and analysis.
    If database contains no candles for this instrument, notifies that historical market data is required.
    """
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    res = await db.execute(stmt)
    instrument = res.scalar_one_or_none()

    if not instrument:
        raise HTTPException(status_code=404, detail=f"Instrument '{symbol}' not found.")

    query = select(MarketCandle).where(
        MarketCandle.instrument_id == instrument.id,
        MarketCandle.timeframe == timeframe,
    )

    if start_date:
        query = query.where(MarketCandle.timestamp >= start_date)
    if end_date:
        query = query.where(MarketCandle.timestamp <= end_date)

    query = query.order_by(desc(MarketCandle.timestamp)).limit(limit)
    result = await db.execute(query)
    candles = result.scalars().all()

    # Return chronological order for charts
    return list(reversed(candles))


@router.post("/upload-csv", response_model=CSVIngestionSummary)
async def upload_historical_csv(
    file: UploadFile = File(...),
    symbol: Optional[str] = Query(None, description="Target instrument symbol (optional if defined in CSV)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload and validate historical 1-minute CSV market data.
    Enforces strict OHLC bounds, Indian session hours (09:15-15:30 IST), deduplication, and logging.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    content = await file.read()
    content_str = content.decode("utf-8", errors="replace")

    importer = CSVMarketDataImporter(db)
    summary = await importer.import_csv_content(
        file_content=content_str,
        file_name=file.filename,
        target_symbol=symbol,
    )

    return summary


@router.get("/status")
async def get_market_data_status(
    symbol: str = Query("NIFTY 50"),
    db: AsyncSession = Depends(get_db),
):
    """
    Checks if historical data exists or if market data is required.
    """
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    res = await db.execute(stmt)
    instrument = res.scalar_one_or_none()

    if not instrument:
        return {
            "symbol": symbol,
            "has_data": False,
            "candle_count": 0,
            "status_message": f"Instrument {symbol} not found.",
        }

    count_stmt = select(func.count(MarketCandle.id)).where(MarketCandle.instrument_id == instrument.id)
    count_res = await db.execute(count_stmt)
    candle_count = count_res.scalar_one()

    if candle_count == 0:
        return {
            "symbol": symbol,
            "has_data": False,
            "candle_count": 0,
            "status_message": "Historical market data required.",
        }

    # Fetch min and max timestamps
    min_max_stmt = select(
        func.min(MarketCandle.timestamp),
        func.max(MarketCandle.timestamp),
    ).where(MarketCandle.instrument_id == instrument.id)
    min_max_res = await db.execute(min_max_stmt)
    min_ts, max_ts = min_max_res.one()

    return {
        "symbol": symbol,
        "has_data": True,
        "candle_count": candle_count,
        "start_timestamp": min_ts,
        "end_timestamp": max_ts,
        "status_message": "Historical data ready.",
    }
