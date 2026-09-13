from datetime import datetime, time, timezone
from typing import Tuple, List, Dict, Any, Optional
import pytz

IST = pytz.timezone("Asia/Kolkata")
SESSION_START = time(9, 15, 0)
SESSION_END = time(15, 30, 0)


def to_ist(dt: datetime) -> datetime:
    """Ensure datetime is localized or converted to Asia/Kolkata."""
    if dt.tzinfo is None:
        # If naive, assume UTC or localize directly
        dt = pytz.utc.localize(dt)
    return dt.astimezone(IST)


def is_indian_market_session(dt: datetime) -> bool:
    """
    Validates if a given timestamp falls within regular NSE market trading hours:
    Monday to Friday, 09:15:00 to 15:30:00 IST.
    """
    dt_ist = to_ist(dt)

    # Weekend check: Monday is 0, Sunday is 6
    if dt_ist.weekday() >= 5:
        return False

    candle_time = dt_ist.time()
    return SESSION_START <= candle_time <= SESSION_END


def validate_ohlcv(
    open_p: float,
    high_p: float,
    low_p: float,
    close_p: float,
    volume: float,
    tolerance: float = 1e-4,
) -> Tuple[bool, List[str]]:
    """
    Validates the mathematical consistency of an OHLCV candle.
    Returns (is_valid, list_of_error_reasons).
    """
    errors = []

    if open_p <= 0 or high_p <= 0 or low_p <= 0 or close_p <= 0:
        errors.append(f"Prices must be strictly positive: O={open_p}, H={high_p}, L={low_p}, C={close_p}")

    # Allow tiny floating point tolerance
    max_oc = max(open_p, close_p) - tolerance
    min_oc = min(open_p, close_p) + tolerance

    if high_p < max_oc:
        errors.append(f"High ({high_p}) is lower than max(Open, Close) ({max(open_p, close_p)})")

    if low_p > min_oc:
        errors.append(f"Low ({low_p}) is higher than min(Open, Close) ({min(open_p, close_p)})")

    if high_p < low_p:
        errors.append(f"High ({high_p}) cannot be less than Low ({low_p})")

    if volume < 0:
        errors.append(f"Volume cannot be negative: {volume}")

    return len(errors) == 0, errors


def check_session_gap(prev_dt: datetime, curr_dt: datetime) -> Tuple[bool, str]:
    """
    Determines if a gap between two consecutive candles is an expected market closure
    (overnight gap or weekend gap) or an unexpected intraday missing data error.
    """
    prev_ist = to_ist(prev_dt)
    curr_ist = to_ist(curr_dt)

    diff_seconds = (curr_ist - prev_ist).total_seconds()
    if diff_seconds <= 60:
        return True, "NORMAL_CONSECUTIVE"

    # Check if this spans across end of session to start of next session
    is_overnight = (
        prev_ist.time() >= time(15, 29, 0)
        and curr_ist.time() <= time(9, 16, 0)
        and curr_ist.date() > prev_ist.date()
    )

    if is_overnight:
        return True, "EXPECTED_SESSION_BOUNDARY"

    return False, f"INTRADAY_MISSING_CANDLE_GAP: {diff_seconds}s gap between {prev_ist.strftime('%H:%M')} and {curr_ist.strftime('%H:%M')}"
