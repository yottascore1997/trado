"""
Fast bulk-importer for 6-month historical 1-minute datasets into SQLite.
"""

import os
import sys
import sqlite3
import pandas as pd
from datetime import datetime, timezone
import pytz

IST = pytz.timezone("Asia/Kolkata")
DB_PATH = "trading.db"

FILES = [
    ("NIFTY 50", "data/nifty_backtest_6m_1m.csv"),
    ("BANK NIFTY", "data/banknifty_backtest_6m_1m.csv"),
    ("RELIANCE", "data/reliance_backtest_6m_1m.csv"),
]

def import_datasets():
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for symbol, csv_path in FILES:
        if not os.path.exists(csv_path):
            print(f"File not found: {csv_path}")
            continue

        print(f"--- Ingesting {symbol} from {csv_path} ---")

        # 1. Fetch instrument ID
        cursor.execute("SELECT id FROM instruments WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        if not row:
            print(f"Instrument '{symbol}' not found in database.")
            continue
        instrument_id = row[0]

        # 2. Read CSV
        df = pd.read_csv(csv_path)
        print(f"Read {len(df)} rows from CSV.")

        # 3. Clean old 1m candles for this instrument
        cursor.execute("DELETE FROM market_candles WHERE instrument_id = ? AND timeframe = '1m'", (instrument_id,))
        conn.commit()
        print(f"Cleaned previous 1m candles for {symbol} (id={instrument_id}).")

        # 4. Prepare bulk insert tuples
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        tuples = []

        for _, r in df.iterrows():
            # Parse timestamp to UTC
            dt = pd.to_datetime(r["timestamp"])
            if dt.tzinfo is None:
                localized = IST.localize(dt.to_pydatetime())
            else:
                localized = dt.to_pydatetime().astimezone(IST)
            utc_dt = localized.astimezone(pytz.utc).replace(tzinfo=None)
            ts_str = utc_dt.strftime("%Y-%m-%d %H:%M:%S")

            tuples.append((
                instrument_id,
                ts_str,
                "1m",
                float(r["open"]),
                float(r["high"]),
                float(r["low"]),
                float(r["close"]),
                float(r["volume"]),
                1,
                now_str,
            ))

        # 5. Insert in batch
        insert_sql = """
            INSERT INTO market_candles (
                instrument_id, timestamp, timeframe, open, high, low, close, volume, is_complete, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor.executemany(insert_sql, tuples)
        conn.commit()
        print(f"Successfully inserted {len(tuples)} candles for {symbol} into SQLite.")

    # Verification
    cursor.execute("""
        SELECT i.symbol, COUNT(c.id), MIN(c.timestamp), MAX(c.timestamp)
        FROM instruments i
        LEFT JOIN market_candles c ON i.id = c.instrument_id
        WHERE i.symbol IN ('NIFTY 50', 'BANK NIFTY', 'RELIANCE')
        GROUP BY i.symbol
    """)
    rows = cursor.fetchall()
    print("\n=== Current Database Status ===")
    for r in rows:
        print(f"Symbol: {r[0]} | Candles: {r[1]} | Min: {r[2]} | Max: {r[3]}")

    conn.close()

if __name__ == "__main__":
    import_datasets()
