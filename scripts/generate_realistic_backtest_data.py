"""
Generates high-fidelity, realistic 1-minute historical backtest datasets for Indian markets (NSE).
Adheres to:
- NSE Session Timings: 09:15 to 15:30 IST (376 candles/day)
- Monday-Friday trading calendar
- Realistic intraday market regimes:
  - Morning Breakouts & Volatility (09:15 - 10:30)
  - Midday VWAP Mean Reversion & Consolidation (10:30 - 13:30)
  - Afternoon Trend Expansion & Closing Moves (13:30 - 15:15)
- Strict OHLC constraints: High >= Max(Open, Close), Low <= Min(Open, Close)
- NSE tick size alignment (0.05 multiples)
"""

import csv
import os
import random
from datetime import datetime, timedelta, time
import pytz

IST = pytz.timezone("Asia/Kolkata")
SESSION_START = time(9, 15)
SESSION_END = time(15, 30)


def generate_realistic_ohlcv(
    file_path: str,
    symbol: str,
    start_date: datetime,
    trading_days: int = 15,
    base_price: float = 25100.0,
    volatility_profile: str = "INDEX",  # "INDEX" or "STOCK"
):
    os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)

    rows = []
    current_price = base_price
    days_generated = 0
    day_offset = 0

    # Base volatility settings
    base_vol = 0.0006 if volatility_profile == "INDEX" else 0.0012
    base_volume = 120000 if volatility_profile == "INDEX" else 45000

    while days_generated < trading_days:
        day = start_date + timedelta(days=day_offset)
        day_offset += 1

        # Skip weekends (Saturday=5, Sunday=6)
        if day.weekday() >= 5:
            continue

        days_generated += 1

        # Determine day's macro character (Trending Bullish, Trending Bearish, Choppy Range)
        day_bias = random.choices(["BULLISH", "BEARISH", "SIDEWAYS"], weights=[0.45, 0.35, 0.20])[0]

        # Gap up / gap down at market open (09:15)
        gap_pct = random.uniform(-0.004, 0.004) if day_bias == "SIDEWAYS" else (
            random.uniform(0.001, 0.006) if day_bias == "BULLISH" else random.uniform(-0.006, -0.001)
        )
        current_price = round(round(current_price * (1 + gap_pct) / 0.05) * 0.05, 2)

        curr_time = datetime.combine(day.date(), SESSION_START, tzinfo=IST)
        end_time = datetime.combine(day.date(), SESSION_END, tzinfo=IST)

        # Intraday cumulative VWAP tracking
        cum_volume = 0
        cum_vp = 0.0

        minute_idx = 0
        while curr_time <= end_time:
            minute_idx += 1
            hour = curr_time.hour
            minute = curr_time.minute

            # Phase-dependent drift and volatility
            if (hour == 9 and minute >= 15) or (hour == 10 and minute <= 0):
                # Phase 1: Market Open Surge (High Volatility, Breakouts)
                vol = base_vol * 1.8
                vol_mult = random.uniform(1.8, 3.2)
                drift = (0.00025 if day_bias == "BULLISH" else -0.00025 if day_bias == "BEARISH" else 0.0)
            elif (hour == 10 and minute > 0) or (hour in (11, 12)) or (hour == 13 and minute <= 30):
                # Phase 2: Midday Consolidation & VWAP Test (Low Volatility)
                vol = base_vol * 0.7
                vol_mult = random.uniform(0.6, 1.2)
                # Pull back slightly towards VWAP
                curr_vwap = (cum_vp / cum_volume) if cum_volume > 0 else current_price
                drift = ((curr_vwap - current_price) / max(current_price, 1.0)) * 0.05
            else:
                # Phase 3: Afternoon Trend Continuation (13:30 - 15:15)
                vol = base_vol * 1.3
                vol_mult = random.uniform(1.3, 2.2)
                drift = (0.0002 if day_bias == "BULLISH" else -0.0002 if day_bias == "BEARISH" else 0.0)

            # Price movement
            change = random.gauss(drift, vol)
            open_p = current_price
            close_p = round(round(open_p * (1 + change) / 0.05) * 0.05, 2)

            # High and Low with realistic wick extensions
            upper_wick = abs(random.gauss(0, vol * 0.8)) * open_p
            lower_wick = abs(random.gauss(0, vol * 0.8)) * open_p

            high_p = round(round(max(open_p, close_p) + max(0.05, upper_wick), 2) / 0.05) * 0.05
            low_p = round(round(min(open_p, close_p) - max(0.05, lower_wick), 2) / 0.05) * 0.05

            high_p = round(max(high_p, open_p, close_p), 2)
            low_p = round(min(low_p, open_p, close_p), 2)

            vol_candle = max(500, int(base_volume * vol_mult * random.uniform(0.7, 1.3)))

            # Update running stats
            typical_p = (high_p + low_p + close_p) / 3.0
            cum_volume += vol_candle
            cum_vp += typical_p * vol_candle

            rows.append({
                "timestamp": curr_time.strftime("%Y-%m-%d %H:%M:%S"),
                "open": f"{open_p:.2f}",
                "high": f"{high_p:.2f}",
                "low": f"{low_p:.2f}",
                "close": f"{close_p:.2f}",
                "volume": vol_candle,
                "instrument": symbol,
            })

            current_price = close_p
            curr_time += timedelta(minutes=1)

    with open(file_path, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["timestamp", "open", "high", "low", "close", "volume", "instrument"],
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} realistic 1-minute candles for {symbol} ({days_generated} trading days) at: {file_path}")
    return len(rows)


if __name__ == "__main__":
    start = datetime(2025, 8, 1, tzinfo=IST)  # Friday, 1 Aug 2025 (6 Months ~ 125 trading days)

    # 1. 6-Month NIFTY 50 Backtest Dataset (125 Trading Days, ~47,000 candles)
    generate_realistic_ohlcv(
        file_path="data/nifty_backtest_6m_1m.csv",
        symbol="NIFTY 50",
        start_date=start,
        trading_days=125,
        base_price=24500.0,
        volatility_profile="INDEX",
    )

    # 2. 6-Month BANK NIFTY Backtest Dataset (125 Trading Days, ~47,000 candles)
    generate_realistic_ohlcv(
        file_path="data/banknifty_backtest_6m_1m.csv",
        symbol="BANK NIFTY",
        start_date=start,
        trading_days=125,
        base_price=51000.0,
        volatility_profile="INDEX",
    )

    # 3. 6-Month RELIANCE Stock Backtest Dataset (125 Trading Days, ~47,000 candles)
    generate_realistic_ohlcv(
        file_path="data/reliance_backtest_6m_1m.csv",
        symbol="RELIANCE",
        start_date=start,
        trading_days=125,
        base_price=2950.0,
        volatility_profile="STOCK",
    )

