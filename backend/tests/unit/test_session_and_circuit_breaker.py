import pytest
from datetime import datetime, timezone, timedelta
from app.services.paper_trading_engine import PaperTradingEngine, IST


def make_ist_time(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """Helper to construct deterministic IST datetime."""
    return datetime(year, month, day, hour, minute, tzinfo=IST)


def test_weekend_blocks_auto_entry():
    """
    Saturday (2026-09-19) or Sunday must strictly block auto-entry.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    saturday_time = make_ist_time(2026, 9, 19, 10, 30)

    allowed, reason = engine.is_entry_window_active(saturday_time)
    assert not allowed
    assert "Weekend" in reason

    mock_setups = [{
        "symbol": "RELIANCE",
        "signal": "BUY",
        "price": 2500.0,
        "entry_price": 2500.0,
        "stop_loss": 2480.0,
        "target_price": 2540.0,
        "suggested_qty": 5,
        "setup_tier": "A+",
        "setup_type": "ORB Breakout",
    }]
    quotes = {"NSE_EQ:RELIANCE": {"last_price": 2500.0}}

    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=saturday_time)
    assert len(engine.open_positions) == 0


def test_pre_market_blocks_auto_entry():
    """
    Pre-market at 08:45 AM on a Wednesday must block fresh entries.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    premarket_time = make_ist_time(2026, 9, 23, 8, 45)

    allowed, reason = engine.is_entry_window_active(premarket_time)
    assert not allowed
    assert "Pre-Market" in reason or "09:15" in reason

    mock_setups = [{
        "symbol": "INFY",
        "signal": "BUY",
        "price": 1500.0,
        "entry_price": 1500.0,
        "stop_loss": 1485.0,
        "target_price": 1530.0,
        "suggested_qty": 10,
        "setup_tier": "A+",
    }]
    quotes = {"NSE_EQ:INFY": {"last_price": 1500.0}}
    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=premarket_time)
    assert len(engine.open_positions) == 0


def test_orb_formation_window_blocks_early_entry():
    """
    09:15 AM to 09:30 AM is reserved for 15-minute Opening Range formation.
    No premature breakout trades may trigger until the 15m candle closes at 09:30 AM.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    orb_forming_time = make_ist_time(2026, 9, 23, 9, 20)

    allowed, reason = engine.is_entry_window_active(orb_forming_time)
    assert not allowed
    assert "09:30 AM" in reason or "Opening Range" in reason

    mock_setups = [{
        "symbol": "TATASTEEL",
        "signal": "BUY",
        "price": 187.0,
        "entry_price": 187.0,
        "stop_loss": 185.0,
        "target_price": 191.0,
        "suggested_qty": 50,
        "setup_tier": "A+",
    }]
    quotes = {"NSE_EQ:TATASTEEL": {"last_price": 187.0}}
    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=orb_forming_time)
    assert len(engine.open_positions) == 0


def test_active_entry_window_permits_auto_entry():
    """
    At 10:15 AM on a Wednesday (inside 09:30 - 14:45 window), valid A+ setups trigger entry.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    valid_trading_time = make_ist_time(2026, 9, 23, 10, 15)

    allowed, reason = engine.is_entry_window_active(valid_trading_time)
    assert allowed
    assert reason == "Entry Window Active"

    mock_setups = [{
        "symbol": "TATASTEEL",
        "signal": "BUY",
        "price": 187.0,
        "entry_price": 187.0,
        "stop_loss": 185.0,
        "target_price": 191.0,
        "suggested_qty": 50,
        "setup_tier": "A+",
    }]
    quotes = {"NSE_EQ:TATASTEEL": {"last_price": 187.0}}
    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=valid_trading_time)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["symbol"] == "TATASTEEL"


def test_post_cutoff_blocks_new_entry():
    """
    After 02:45 PM (14:45 IST), no fresh intraday entries are permitted.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    cutoff_time = make_ist_time(2026, 9, 23, 14, 50)

    allowed, reason = engine.is_entry_window_active(cutoff_time)
    assert not allowed
    assert "02:45 PM" in reason or "Cutoff" in reason

    mock_setups = [{
        "symbol": "HDFCBANK",
        "signal": "BUY",
        "price": 1600.0,
        "entry_price": 1600.0,
        "stop_loss": 1585.0,
        "target_price": 1630.0,
        "suggested_qty": 10,
        "setup_tier": "A+",
    }]
    quotes = {"NSE_EQ:HDFCBANK": {"last_price": 1600.0}}
    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=cutoff_time)
    assert len(engine.open_positions) == 0


def test_daily_loss_circuit_breaker_halts_auto_trading():
    """
    If today's cumulative realized loss reaches/exceeds the 3.0% threshold (e.g. ₹750 on ₹25,000),
    the Daily Circuit Breaker must halt all further auto-entries for the rest of the day.
    """
    engine = PaperTradingEngine(initial_budget=25000.0, persist=False)
    trading_day = make_ist_time(2026, 9, 23, 11, 0)
    today_date_str = trading_day.strftime("%Y-%m-%d")

    # Simulate 2 prior losing trades today totaling -₹800 loss (> 3% of ₹25k = ₹750)
    engine.closed_trades = [
        {
            "trade_id": "T1",
            "symbol": "INFY",
            "side": "BUY",
            "quantity": 20,
            "entry_price": 1500.0,
            "exit_price": 1480.0,
            "date": today_date_str,
            "gross_pnl": -400.0,
            "charges": 20.0,
            "net_pnl": -420.0,
            "exit_reason": "STOP_LOSS_HIT",
        },
        {
            "trade_id": "T2",
            "symbol": "TCS",
            "side": "BUY",
            "quantity": 10,
            "entry_price": 3500.0,
            "exit_price": 3460.0,
            "date": today_date_str,
            "gross_pnl": -400.0,
            "charges": 20.0,
            "net_pnl": -420.0,
            "exit_reason": "STOP_LOSS_HIT",
        },
    ]
    engine.recalculate_margins()

    # Total realized loss today = -₹840. Limit is 3% of 25k = ₹750.
    summary = engine.get_summary(current_time=trading_day)
    assert summary["circuit_breaker_triggered"] is True
    assert "Daily Loss Limit reached" in summary["circuit_breaker_reason"]

    # Now attempt a new high-conviction A+ trade in RELIANCE at 11:00 AM
    mock_setups = [{
        "symbol": "RELIANCE",
        "signal": "BUY",
        "price": 2500.0,
        "entry_price": 2500.0,
        "stop_loss": 2480.0,
        "target_price": 2540.0,
        "suggested_qty": 5,
        "setup_tier": "A+",
        "setup_type": "Trend Breakout",
    }]
    quotes = {"NSE_EQ:RELIANCE": {"last_price": 2500.0}}

    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=trading_day)

    # Must NOT open any new position because Daily Circuit Breaker is active!
    assert len(engine.open_positions) == 0
