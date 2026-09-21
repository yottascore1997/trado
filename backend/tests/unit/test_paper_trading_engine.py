import pytest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
from app.services.paper_trading_engine import PaperTradingEngine, IST


@pytest.fixture(autouse=True)
def mock_market_hours(request):
    if "test_auto_square_off" in request.node.name or "test_symbol_reentry" in request.node.name:
        yield
        return

    market_hour = datetime(2026, 9, 18, 10, 30, 0, tzinfo=IST)
    with patch("app.services.paper_trading_engine.datetime") as mock_dt:
        mock_dt.now.side_effect = lambda tz=None: market_hour
        mock_dt.fromisoformat = datetime.fromisoformat
        yield


def test_paper_engine_initialization():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    assert engine.wallet_budget == 10000.0
    assert engine.available_balance == 10000.0
    assert engine.auto_trading_enabled is True


def test_paper_engine_open_and_close_position():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)

    pos = engine.open_position(
        symbol="RELIANCE",
        side="BUY",
        quantity=10,
        entry_price=1200.0,
        stop_loss=1180.0,
        target_price=1250.0,
        margin_required=2400.0,
    )
    assert pos["symbol"] == "RELIANCE"
    assert pos["side"] == "BUY"
    assert pos["quantity"] == 10
    assert engine.margin_locked == 2400.0
    assert len(engine.open_positions) == 1

    # Manual Close at 1220 (Profit)
    closed = engine.close_position(pos["position_id"], reason="MANUAL_CLOSE", exit_price=1220.0)
    assert closed is not None
    assert closed["gross_pnl"] == 200.0  # (1220 - 1200) * 10
    assert closed["net_pnl"] > 0
    assert len(engine.open_positions) == 0
    assert engine.margin_locked == 0.0


def test_paper_engine_target_hit_auto_close():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)

    pos = engine.open_position(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        entry_price=950.0,
        stop_loss=930.0,
        target_price=980.0,
        margin_required=1900.0,
    )

    # Simulate price moving to 982 (Target Hit)
    quotes = {
        "NSE_EQ:SBIN": {"last_price": 982.0}
    }
    engine.process_market_tick(quotes)

    # Position should be closed automatically with TARGET_HIT
    assert len(engine.open_positions) == 0
    latest_trade = engine.closed_trades[-1]
    assert latest_trade["symbol"] == "SBIN"
    assert latest_trade["exit_reason"] == "TARGET_HIT"
    assert latest_trade["gross_pnl"] == 320.0  # (982 - 950) * 10


def test_paper_engine_stop_loss_hit_auto_close():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)

    pos = engine.open_position(
        symbol="ICICIBANK",
        side="BUY",
        quantity=10,
        entry_price=1300.0,
        stop_loss=1280.0,
        target_price=1350.0,
        margin_required=2600.0,
    )

    # Simulate price dropping to 1275 (SL Hit)
    quotes = {
        "NSE_EQ:ICICIBANK": {"last_price": 1275.0}
    }
    engine.process_market_tick(quotes)

    # Position should be closed automatically with STOP_LOSS_HIT
    assert len(engine.open_positions) == 0
    latest_trade = engine.closed_trades[-1]
    assert latest_trade["symbol"] == "ICICIBANK"
    assert latest_trade["exit_reason"] == "STOP_LOSS_HIT"
    assert latest_trade["gross_pnl"] == -250.0  # (1275 - 1300) * 10


def test_paper_engine_daywise_pnl_aggregation():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="TCS",
        side="BUY",
        quantity=5,
        entry_price=3500.0,
        stop_loss=3450.0,
        target_price=3600.0,
        margin_required=3500.0,
    )
    engine.close_position(pos["position_id"], reason="MANUAL_CLOSE", exit_price=3550.0)

    daywise = engine.get_daywise_pnl()
    assert isinstance(daywise, list)
    assert len(daywise) >= 1

    for day in daywise:
        assert "date" in day
        assert "total_trades" in day
        assert "win_rate_pct" in day
        assert "net_pnl" in day
        assert "roi_pct" in day


def test_paper_engine_toggle_auto_trading():
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    current = engine.auto_trading_enabled
    toggled = engine.toggle_auto_trading()
    assert toggled != current
    engine.toggle_auto_trading(True)
    assert engine.auto_trading_enabled is True


def test_symbol_reentry_and_protection_rules():
    from datetime import datetime, timezone, timedelta
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)

    # 1. Clean state -> Eligible
    eligible, reason = engine.check_symbol_entry_eligibility("RELIANCE")
    assert eligible is True

    # 2. Position currently open -> Ineligible
    pos = engine.open_position(
        symbol="RELIANCE",
        side="BUY",
        quantity=10,
        entry_price=1200.0,
        stop_loss=1180.0,
        target_price=1250.0,
        margin_required=2400.0,
    )
    eligible, reason = engine.check_symbol_entry_eligibility("RELIANCE")
    assert eligible is False
    assert "Position already active" in reason

    # 3. Position exits with Stop Loss -> 1-SL Blacklist locks stock for today
    engine.close_position(pos["position_id"], reason="STOP_LOSS_HIT", exit_price=1180.0)
    eligible, reason = engine.check_symbol_entry_eligibility("RELIANCE")
    assert eligible is False
    assert "Stop Loss hit" in reason

    # 4. Another stock exits with Target Hit (Profit) -> Enforces 20m Cooldown
    pos_tcs = engine.open_position(
        symbol="TCS",
        side="BUY",
        quantity=5,
        entry_price=3000.0,
        stop_loss=2950.0,
        target_price=3100.0,
        margin_required=3000.0,
    )
    engine.close_position(pos_tcs["position_id"], reason="TARGET_HIT", exit_price=3100.0)
    eligible, reason = engine.check_symbol_entry_eligibility("TCS")
    assert eligible is False
    assert "Cooldown active" in reason

    # 5. After 20 minutes pass -> Eligible for second entry
    # Simulate trade was closed 25 minutes ago
    engine.closed_trades[-1]["exit_time"] = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
    eligible, reason = engine.check_symbol_entry_eligibility("TCS")
    assert eligible is True

    # 6. Second trade taken and closed -> Max 2 trades reached, cannot enter 3rd time
    pos_tcs2 = engine.open_position(
        symbol="TCS",
        side="BUY",
        quantity=5,
        entry_price=3120.0,
        stop_loss=3080.0,
        target_price=3200.0,
        margin_required=3000.0,
    )
    engine.close_position(pos_tcs2["position_id"], reason="TARGET_HIT", exit_price=3200.0)
    eligible, reason = engine.check_symbol_entry_eligibility("TCS")
    assert eligible is False
    assert "Max intraday trade limit" in reason


def test_breakeven_protection_on_fifty_percent_target_move():
    """When a trade advances 50% toward target, SL must trail to Entry (Cost-to-Cost)."""
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="INFY",
        side="BUY",
        quantity=10,
        entry_price=1500.0,
        stop_loss=1470.0,  # 30 pts risk
        target_price=1560.0, # 60 pts target
        margin_required=3000.0,
    )

    # 1. Price moves to 1530 (+30 pts = 50% of target move)
    engine.process_market_tick({"NSE_EQ:INFY": {"last_price": 1530.0}})
    assert len(engine.open_positions) == 1
    current_pos = engine.open_positions[0]
    assert current_pos["stop_loss"] == 1500.0  # Trailed to cost
    assert current_pos["trailing_stage"] == "BREAKEVEN"

    # 2. Market reverses and drops back to 1500 (Cost)
    engine.process_market_tick({"NSE_EQ:INFY": {"last_price": 1499.0}})
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "BREAKEVEN_EXIT"
    assert trade["gross_pnl"] <= 0.0  # Zero loss or negligible slippage
    # Crucial: Symbol should NOT be blacklisted by 1-Loss rule because it was a protected breakeven exit
    eligible, _ = engine.check_symbol_entry_eligibility("INFY")
    assert eligible is False
    # Instead of locked for day, it is in cooldown
    assert "Cooldown active" in engine.check_symbol_entry_eligibility("INFY")[1]


def test_profit_lock_trailing_sl_near_target_reversal():
    """When a trade reaches 80% of target and reverses, it must exit with 50% profit locked!"""
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="TATAMOTORS",
        side="BUY",
        quantity=10,
        entry_price=1000.0,
        stop_loss=980.0,   # 20 pts risk
        target_price=1060.0, # 60 pts target
        margin_required=2000.0,
    )

    # 1. Price surges to 1050 (83% of 60 pts target distance)
    # Target distance = 60 pts. 75%+ target move achieved -> Locks 50% = 30 pts profit -> SL = 1030
    engine.process_market_tick({"NSE_EQ:TATAMOTORS": {"last_price": 1050.0}})
    assert len(engine.open_positions) == 1
    current_pos = engine.open_positions[0]
    assert current_pos["stop_loss"] == 1030.0
    assert current_pos["trailing_stage"] == "PROFIT_LOCK"

    # 2. Market suddenly reverses and falls to 1028 (crossing trailed SL of 1030)
    engine.process_market_tick({"NSE_EQ:TATAMOTORS": {"last_price": 1028.0}})
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "TRAILING_SL_HIT"
    # Even though target was missed, trade locked in ~₹280 profit (instead of losing ₹200 on initial SL)!
    assert trade["gross_pnl"] >= 280.0
    assert trade["net_pnl"] > 0.0


def test_short_sell_trailing_sl_and_profit_lock():
    """SELL position trails downward as price falls toward target."""
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="HDFCBANK",
        side="SELL",
        quantity=10,
        entry_price=1600.0,
        stop_loss=1620.0,   # 20 pts risk
        target_price=1540.0, # 60 pts target
        margin_required=3200.0,
    )

    # Price drops to 1550 (50 pts drop = 83% of target move)
    # 75%+ target move achieved -> locks 50% target = 30 pts -> SL moved down to 1570
    engine.process_market_tick({"NSE_EQ:HDFCBANK": {"last_price": 1550.0}})
    assert len(engine.open_positions) == 1
    current_pos = engine.open_positions[0]
    assert current_pos["stop_loss"] == 1570.0
    assert current_pos["trailing_stage"] == "PROFIT_LOCK"

    # Price reverses up to 1572 (triggering trailed SL)
    engine.process_market_tick({"NSE_EQ:HDFCBANK": {"last_price": 1572.0}})
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "TRAILING_SL_HIT"
    assert trade["gross_pnl"] >= 280.0  # (1600 - 1572) * 10


def test_auto_square_off_at_three_fifteen_pm():
    """At 3:15 PM IST or later, all remaining open positions are automatically squared off."""
    from unittest.mock import patch
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    mock_afternoon = datetime(2026, 9, 18, 15, 16, 0, tzinfo=IST)

    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        entry_price=800.0,
        stop_loss=785.0,
        target_price=830.0,
        margin_required=1600.0,
    )
    assert len(engine.open_positions) == 1

    with patch("app.services.paper_trading_engine.datetime") as mock_dt:
        mock_dt.now.return_value = mock_afternoon
        mock_dt.fromisoformat = datetime.fromisoformat
        engine.process_market_tick({"NSE_EQ:SBIN": {"last_price": 810.0}})

    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "INTRADAY_SQUARE_OFF"
    assert trade["exit_price"] == 810.0


def test_thesis_invalidation_buy_early_exit():
    """
    Validates that if a BUY position loses VWAP support beyond 0.20% buffer while underwater,
    it requires 2 consecutive ticks to confirm thesis invalidation and execute an early exit.
    """
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="TATASTEEL",
        side="BUY",
        quantity=100,
        entry_price=187.40,
        stop_loss=186.11,   # 1.29 pts full SL
        target_price=190.11,
        margin_required=3748.0,
        vwap=187.10,
    )
    assert len(engine.open_positions) == 1

    # Price drops to 186.50: Below VWAP 187.10 (beyond 0.20% buffer: 187.10 - 0.37 = 186.73)
    # and below Entry 187.40, but above SL 186.11
    quotes = {
        "NSE_EQ:TATASTEEL": {
            "last_price": 186.50,
            "average_price": 187.10,
            "ohlc": {"open": 187.0, "high": 187.5, "low": 186.4, "close": 186.5},
        }
    }

    # Tick 1: First breach logged as warning, position remains open (noise protection)
    engine.process_market_tick(quotes)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 1

    # Tick 2: Second consecutive breach confirms thesis invalidation and triggers early exit
    engine.process_market_tick(quotes)
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["symbol"] == "TATASTEEL"
    assert trade["exit_reason"] == "THESIS_INVALIDATED"
    assert trade["exit_price"] == 186.50
    # Early exit loss is -₹90, saving the trader from -₹129 full SL loss!
    assert trade["gross_pnl"] == round((186.50 - 187.40) * 100, 2)
    assert abs(trade["gross_pnl"]) < abs((186.11 - 187.40) * 100)


def test_thesis_invalidation_sell_early_exit():
    """
    Validates that if a SELL position's price climbs back above VWAP resistance beyond 0.20% buffer
    while underwater, it requires 2 consecutive ticks to confirm thesis invalidation and execute an early exit.
    """
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="INFY",
        side="SELL",
        quantity=10,
        entry_price=1500.0,
        stop_loss=1520.0,   # 20 pts full SL
        target_price=1460.0,
        margin_required=3000.0,
        vwap=1495.0,
    )
    assert len(engine.open_positions) == 1

    # Price rises to 1505.0: Above VWAP 1495.0 (beyond 0.20% buffer: 1495 + 2.99 = 1497.99)
    # and above Entry 1500.0, but well below SL 1520.0
    quotes = {
        "NSE_EQ:INFY": {
            "last_price": 1505.0,
            "average_price": 1495.0,
            "ohlc": {"open": 1495.0, "high": 1510.0, "low": 1490.0, "close": 1505.0},
        }
    }

    # Tick 1: First breach logged as warning, position remains open
    engine.process_market_tick(quotes)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 1

    # Tick 2: Second consecutive breach confirms thesis invalidation and triggers early exit
    engine.process_market_tick(quotes)
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["symbol"] == "INFY"
    assert trade["exit_reason"] == "THESIS_INVALIDATED"
    assert trade["exit_price"] == 1505.0
    # Early exit loss is -₹50, saving the trader from -₹200 full SL loss!
    assert trade["gross_pnl"] == round((1500.0 - 1505.0) * 10, 2)
    assert abs(trade["gross_pnl"]) < abs((1500.0 - 1520.0) * 10)



