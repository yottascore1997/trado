import pytest
import pandas as pd
from datetime import datetime, timedelta
import pytz

from app.services.market_data.resampler import resample_candles_df, aggregate_streaming_candles
from app.services.market_data.validator import IST


def test_resample_candles_df_5m():
    base_time = IST.localize(datetime(2026, 1, 5, 9, 15, 0))
    records = []

    # Create five 1-minute candles: 09:15 to 09:19
    # 09:15: O=25000, H=25010, L=24990, C=25005, V=1000
    # 09:16: O=25005, H=25020, L=25000, C=25015, V=1200
    # 09:17: O=25015, H=25030, L=25010, C=25025, V=1500
    # 09:18: O=25025, H=25035, L=25020, C=25030, V=800
    # 09:19: O=25030, H=25040, L=25015, C=25035, V=2000

    ohlcv = [
        (25000, 25010, 24990, 25005, 1000),
        (25005, 25020, 25000, 25015, 1200),
        (25015, 25030, 25010, 25025, 1500),
        (25025, 25035, 25020, 25030, 800),
        (25030, 25040, 25015, 25035, 2000),
    ]

    for i, (o, h, l, c, v) in enumerate(ohlcv):
        records.append({
            "timestamp": base_time + timedelta(minutes=i),
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
        })

    df_1m = pd.DataFrame(records)
    resampled_5m = resample_candles_df(df_1m, target_tf="5m")

    assert len(resampled_5m) == 1
    candle_5m = resampled_5m.iloc[0]

    # Expected:
    # Open = first candle open = 25000
    # High = max high = 25040
    # Low = min low = 24990
    # Close = last candle close = 25035
    # Volume = sum = 6500
    assert candle_5m["open"] == 25000.0
    assert candle_5m["high"] == 25040.0
    assert candle_5m["low"] == 24990.0
    assert candle_5m["close"] == 25035.0
    assert candle_5m["volume"] == 6500.0


def test_aggregate_streaming_candles():
    candles = [
        {"timestamp": datetime(2026, 1, 5, 9, 15), "open": 100.0, "high": 105.0, "low": 98.0, "close": 102.0, "volume": 10.0},
        {"timestamp": datetime(2026, 1, 5, 9, 16), "open": 102.0, "high": 108.0, "low": 101.0, "close": 107.0, "volume": 15.0},
        {"timestamp": datetime(2026, 1, 5, 9, 17), "open": 107.0, "high": 110.0, "low": 106.0, "close": 109.0, "volume": 20.0},
    ]

    # Aggregate into 3m candle
    agg = aggregate_streaming_candles(candles, target_tf_minutes=3)
    assert agg is not None
    assert agg["timeframe"] == "3m"
    assert agg["open"] == 100.0
    assert agg["high"] == 110.0
    assert agg["low"] == 98.0
    assert agg["close"] == 109.0
    assert agg["volume"] == 45.0
