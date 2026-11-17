import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from app.services.setup_tracker_engine import SetupTrackerEngine

IST = ZoneInfo("Asia/Kolkata")


@pytest.fixture
def tracker():
    # Non-persistent tracker instance for testing
    engine = SetupTrackerEngine(persist=False)
    engine.active_setups = []
    engine.closed_setups = []
    return engine


def test_position_sizing_2x_leverage(tracker):
    # Stock price = ₹500
    # Exposure = ₹100,000 -> qty = 200 shares
    # Margin = (200 * 500) / 2 = ₹50,000
    qty, margin, exposure = tracker.calculate_position_sizing(500.0)
    assert qty == 200
    assert exposure == 100000.0
    assert margin == 50000.0

    # Stock price = ₹1,250
    # Exposure = ₹100,000 -> qty = 80 shares
    # Margin = ₹50,000
    qty, margin, exposure = tracker.calculate_position_sizing(1250.0)
    assert qty == 80
    assert exposure == 100000.0
    assert margin == 50000.0


def test_setup_tier_filtering_and_labeling(tracker):
    setups = [
        {
            "symbol": "RELIANCE",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 2500.0,
            "stop_loss": 2470.0,
            "target_price": 2560.0,
            "setup_type": "VWAP Institutional Retest",
        },
        {
            "symbol": "TCS",
            "setup_tier": "A",
            "signal": "BUY",
            "price": 3500.0,
            "stop_loss": 3465.0,
            "target_price": 3570.0,
            "setup_type": "Morning Breakout",
        },
        {
            "symbol": "INFY",
            "setup_tier": "B",  # Should be rejected
            "signal": "BUY",
            "price": 1800.0,
            "stop_loss": 1780.0,
            "target_price": 1840.0,
            "setup_type": "Minor Pullback",
        },
    ]

    live_quotes = {
        "NSE_EQ:RELIANCE": {"last_price": 2500.0},
        "NSE_EQ:TCS": {"last_price": 3500.0},
        "NSE_EQ:INFY": {"last_price": 1800.0},
    }

    test_time = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(live_quotes, setups, current_time=test_time)

    # Only A+ and A should be entered
    assert len(tracker.active_setups) == 2
    symbols = [p["symbol"] for p in tracker.active_setups]
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert "INFY" not in symbols

    rel_pos = next(p for p in tracker.active_setups if p["symbol"] == "RELIANCE")
    assert rel_pos["setup_tier"] == "A+"
    assert "⭐ A+ Institutional" in rel_pos["tier_label"]
    assert rel_pos["margin_required"] == 50000.0

    tcs_pos = next(p for p in tracker.active_setups if p["symbol"] == "TCS")
    assert tcs_pos["setup_tier"] == "A"
    assert "✨ A High Conviction" in tcs_pos["tier_label"]


def test_trailing_stop_loss_progression(tracker):
    # Setup: Entry 1000, SL 980, Target 1040 (Target dist = 40 pts)
    # 35% target move = 14 pts -> price 1014 -> Breakeven moved
    # 50% target move = 20 pts -> price 1020 -> Profit lock 25% (10 pts) -> SL 1010
    # 75% target move = 30 pts -> price 1030 -> Profit lock 50% (20 pts) -> SL 1020
    # 90% target move = 36 pts -> price 1036 -> Super lock 70% (28 pts) -> SL 1028
    setups = [
        {
            "symbol": "SBIN",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1000.0,
            "stop_loss": 980.0,
            "target_price": 1040.0,
            "setup_type": "Institutional Expansion",
        }
    ]

    t1 = datetime(2026, 11, 3, 9, 30, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:SBIN": {"last_price": 1000.0}}, setups, current_time=t1)
    pos = tracker.active_setups[0]
    assert pos["trailing_stage"] == "INITIAL"
    assert pos["stop_loss"] == 980.0

    # Move 1: Price goes to 1015 (37.5% move, crosses 35% threshold)
    t2 = datetime(2026, 11, 3, 9, 45, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:SBIN": {"last_price": 1015.0}}, current_time=t2)
    assert pos["trailing_stage"] == "BREAKEVEN"
    assert pos["stop_loss"] >= 1000.0  # SL protected at cost + friction

    # Move 2: Price goes to 1022 (55% move, crosses 50% threshold)
    t3 = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:SBIN": {"last_price": 1022.0}}, current_time=t3)
    assert pos["trailing_stage"] == "PROFIT_LOCK_25"
    assert pos["stop_loss"] == 1010.0  # 1000 + 40*0.25

    # Move 3: Price goes to 1032 (80% move, crosses 75% threshold)
    t4 = datetime(2026, 11, 3, 10, 15, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:SBIN": {"last_price": 1032.0}}, current_time=t4)
    assert pos["trailing_stage"] == "PROFIT_LOCK_50"
    assert pos["stop_loss"] == 1020.0  # 1000 + 40*0.50

    # Move 4: Target hit at 1040
    t5 = datetime(2026, 11, 3, 10, 30, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:SBIN": {"last_price": 1040.0}}, current_time=t5)
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 1
    assert tracker.closed_setups[0]["exit_reason"] == "TARGET_HIT"
    assert tracker.closed_setups[0]["net_pnl"] > 0


def test_tracker_summary_metrics(tracker):
    # Setup trade that hits target
    setups = [
        {
            "symbol": "TATAMOTORS",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1000.0,
            "stop_loss": 980.0,
            "target_price": 1030.0,
            "setup_type": "VWAP Retest",
        }
    ]
    t1 = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:TATAMOTORS": {"last_price": 1000.0}}, setups, current_time=t1)

    # Check summary when active
    summary = tracker.get_summary(current_time=t1)
    assert summary["base_capital_per_trade"] == 50000.0
    assert summary["leverage"] == 2.0
    assert summary["total_setups_today"] == 1
    assert summary["a_plus_count"] == 1
    assert summary["a_count"] == 0
    assert summary["active_count"] == 1
    assert summary["closed_count"] == 0

    # Target hit
    t2 = datetime(2026, 11, 3, 10, 15, tzinfo=IST)
    tracker.process_market_tick({"NSE_EQ:TATAMOTORS": {"last_price": 1030.0}}, current_time=t2)

    summary2 = tracker.get_summary(current_time=t2)
    assert summary2["active_count"] == 0
    assert summary2["closed_count"] == 1
    assert summary2["wins"] == 1
    assert summary2["win_rate_pct"] == 100.0
    assert summary2["realized_net"] > 0


def test_thesis_invalidation_early_cut(tracker):
    setups = [
        {
            "symbol": "ICICIBANK",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1000.0,
            "stop_loss": 970.0,
            "target_price": 1040.0,
            "setup_type": "VWAP Breakout",
        }
    ]
    t1 = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:ICICIBANK": {"last_price": 1000.0, "average_price": 998.0}},
        setups,
        current_time=t1,
    )
    assert len(tracker.active_setups) == 1

    # Price drops below VWAP: 990 (VWAP is 998)
    for i in range(3):
        tracker.process_market_tick(
            {"NSE_EQ:ICICIBANK": {"last_price": 990.0, "average_price": 998.0}},
            current_time=t1,
        )

    # After 3 ticks, should execute early thesis invalidation instead of waiting for SL 970
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 1
    assert tracker.closed_setups[0]["exit_reason"] == "THESIS_INVALIDATED"


def test_stagnation_exit_early_cut(tracker):
    setups = [
        {
            "symbol": "AXISBANK",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1000.0,
            "stop_loss": 970.0,
            "target_price": 1040.0,
            "setup_type": "VWAP Breakout",
        }
    ]
    t1 = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:AXISBANK": {"last_price": 1000.0, "average_price": 998.0}},
        setups,
        current_time=t1,
    )
    assert len(tracker.active_setups) == 1

    # 40 minutes later, stock is stagnant and underwater at 995 (-0.5%)
    t2 = datetime(2026, 11, 3, 10, 42, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:AXISBANK": {"last_price": 995.0, "average_price": 998.0}},
        current_time=t2,
    )

    # Should trigger STAGNATION_EXIT
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 1
    assert tracker.closed_setups[0]["exit_reason"] == "STAGNATION_EXIT"


def test_symbol_lock_prevents_same_day_reentry(tracker):
    # Setup for ICICIBANK
    setups = [
        {
            "symbol": "ICICIBANK",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1000.0,
            "stop_loss": 980.0,
            "target_price": 1030.0,
            "setup_type": "VWAP Breakout",
        }
    ]
    t1 = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:ICICIBANK": {"last_price": 1000.0, "average_price": 998.0}},
        setups,
        current_time=t1,
    )
    assert len(tracker.active_setups) == 1

    # Manually close it
    setup_id = tracker.active_setups[0]["setup_id"]
    tracker.manual_close(setup_id)
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 1
    assert tracker.closed_setups[0]["symbol"] == "ICICIBANK"

    # Screener triggers ICICIBANK again on the same day at 11:00 AM
    t2 = datetime(2026, 11, 3, 11, 0, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:ICICIBANK": {"last_price": 1005.0, "average_price": 1000.0}},
        setups,
        current_time=t2,
    )

    # Symbol lock must prevent re-entry of ICICIBANK today
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 1


def test_opening_settlement_guard_blocks_pre_930(tracker):
    setups = [
        {
            "symbol": "HDFCBANK",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1600.0,
            "stop_loss": 1580.0,
            "target_price": 1640.0,
            "setup_type": "VWAP Breakout",
        }
    ]
    # 09:20 AM (Within opening settlement window 09:15-09:30)
    t_early = datetime(2026, 11, 3, 9, 20, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:HDFCBANK": {"last_price": 1600.0, "average_price": 1595.0}},
        setups,
        current_time=t_early,
    )
    # Must be blocked by opening settlement guard
    assert len(tracker.active_setups) == 0

    # 09:35 AM (Settlement period complete)
    t_valid = datetime(2026, 11, 3, 9, 35, tzinfo=IST)
    tracker.process_market_tick(
        {"NSE_EQ:HDFCBANK": {"last_price": 1600.0, "average_price": 1595.0}},
        setups,
        current_time=t_valid,
    )
    # Now entry is allowed
    assert len(tracker.active_setups) == 1
    assert tracker.active_setups[0]["symbol"] == "HDFCBANK"


def test_daily_trade_cap_max_8(tracker):
    tracker.max_daily_trades = 3  # Set cap to 3 for test
    setups = [
        {"symbol": f"SYM{i}", "setup_tier": "A+", "signal": "BUY", "price": 100.0, "stop_loss": 98.0, "target_price": 104.0}
        for i in range(1, 6)
    ]
    quotes = {f"NSE_EQ:SYM{i}": {"last_price": 100.0, "average_price": 99.0} for i in range(1, 6)}

    t = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(quotes, setups, current_time=t)

    # Only 3 should enter due to daily cap
    assert len(tracker.active_setups) == 3


def test_close_all_active_positions(tracker):
    setups = [
        {"symbol": "SBIN", "setup_tier": "A+", "signal": "BUY", "price": 800.0, "stop_loss": 790.0, "target_price": 820.0},
        {"symbol": "TATASTEEL", "setup_tier": "A", "signal": "BUY", "price": 150.0, "stop_loss": 147.0, "target_price": 155.0},
    ]
    quotes = {
        "NSE_EQ:SBIN": {"last_price": 800.0, "average_price": 798.0},
        "NSE_EQ:TATASTEEL": {"last_price": 150.0, "average_price": 149.0},
    }
    t = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    tracker.process_market_tick(quotes, setups, current_time=t)
    assert len(tracker.active_setups) == 2

    closed = tracker.close_all()
    assert len(closed) == 2
    assert len(tracker.active_setups) == 0
    assert len(tracker.closed_setups) == 2



