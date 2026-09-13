import pandas as pd
from typing import List, Dict, Any, Optional


def resample_candles_df(df_1m: pd.DataFrame, target_tf: str = "5m") -> pd.DataFrame:
    """
    Resamples a 1-minute OHLCV DataFrame into 3m, 5m, or 15m candles.
    Ensures zero future leakage and strict temporal alignment.
    DataFrame must contain 'timestamp', 'open', 'high', 'low', 'close', 'volume'.
    """
    if df_1m.empty:
        return pd.DataFrame()

    df = df_1m.copy()
    if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
        df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)

    # Standardize target frequency rule
    rule_map = {
        "3m": "3min",
        "5m": "5min",
        "15m": "15min",
        "30m": "30min",
        "1h": "1h",
        "1d": "1D",
    }
    rule = rule_map.get(target_tf, target_tf)

    resampled = df.resample(rule, closed="left", label="left").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }).dropna()

    resampled = resampled.reset_index()
    return resampled


def aggregate_streaming_candles(candles_1m: List[Dict[str, Any]], target_tf_minutes: int) -> Optional[Dict[str, Any]]:
    """
    Aggregates a window of closed 1m candles into a single higher timeframe candle.
    Returns None if candle count is less than target_tf_minutes.
    """
    if len(candles_1m) < target_tf_minutes:
        return None

    subset = candles_1m[-target_tf_minutes:]
    open_p = subset[0]["open"]
    high_p = max(c["high"] for c in subset)
    low_p = min(c["low"] for c in subset)
    close_p = subset[-1]["close"]
    volume = sum(c["volume"] for c in subset)
    timestamp = subset[0]["timestamp"]

    return {
        "timestamp": timestamp,
        "timeframe": f"{target_tf_minutes}m",
        "open": open_p,
        "high": high_p,
        "low": low_p,
        "close": close_p,
        "volume": volume,
    }
