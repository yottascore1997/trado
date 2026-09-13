import pytest
from datetime import datetime, timezone
import pytz

from app.services.market_data.validator import (
    validate_ohlcv,
    is_indian_market_session,
    check_session_gap,
    IST,
)


def test_valid_ohlcv():
    is_valid, errors = validate_ohlcv(25000.0, 25050.0, 24980.0, 25020.0, 150000.0)
    assert is_valid is True
    assert len(errors) == 0


def test_invalid_ohlcv_high_too_low():
    # High is less than open
    is_valid, errors = validate_ohlcv(25000.0, 24900.0, 24800.0, 24850.0, 1000.0)
    assert is_valid is False
    assert any("High" in e for e in errors)


def test_invalid_ohlcv_low_too_high():
    # Low is greater than close
    is_valid, errors = validate_ohlcv(25000.0, 25100.0, 25050.0, 25020.0, 1000.0)
    assert is_valid is False
    assert any("Low" in e for e in errors)


def test_negative_volume():
    is_valid, errors = validate_ohlcv(25000.0, 25050.0, 24980.0, 25020.0, -50.0)
    assert is_valid is False
    assert any("Volume" in e for e in errors)


def test_indian_market_session_open():
    # 2026-01-05 is a Monday. 09:30 AM IST should be in session
    dt = IST.localize(datetime(2026, 1, 5, 9, 30, 0))
    assert is_indian_market_session(dt) is True

    # 15:25 PM IST should be in session
    dt_end = IST.localize(datetime(2026, 1, 5, 15, 25, 0))
    assert is_indian_market_session(dt_end) is True


def test_indian_market_session_closed():
    # 08:30 AM IST (pre-market before 09:15)
    dt_early = IST.localize(datetime(2026, 1, 5, 8, 30, 0))
    assert is_indian_market_session(dt_early) is False

    # 16:00 PM IST (post-market after 15:30)
    dt_late = IST.localize(datetime(2026, 1, 5, 16, 0, 0))
    assert is_indian_market_session(dt_late) is False

    # Weekend (Sunday 2026-01-04)
    dt_weekend = IST.localize(datetime(2026, 1, 4, 11, 0, 0))
    assert is_indian_market_session(dt_weekend) is False


def test_session_boundary_gap():
    # Gap between Monday 15:29 IST and Tuesday 09:15 IST is expected session closure
    prev_dt = IST.localize(datetime(2026, 1, 5, 15, 29, 0))
    curr_dt = IST.localize(datetime(2026, 1, 6, 9, 15, 0))
    is_expected, reason = check_session_gap(prev_dt, curr_dt)
    assert is_expected is True
    assert "EXPECTED_SESSION_BOUNDARY" in reason
