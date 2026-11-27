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

    # 4. Another stock exits with Target Hit (Profit) -> Locks symbol for today (momentum exhausted)
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
    assert "Target Hit / Profit Locked" in reason

    # Even after 25 minutes pass, TCS remains locked because target was reached
    engine.closed_trades[-1]["exit_time"] = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
    eligible, reason = engine.check_symbol_entry_eligibility("TCS")
    assert eligible is False
    assert "Target Hit / Profit Locked" in reason

    # 5. Breakeven exit on another stock -> Enforces 20m Cooldown, then allows 2nd attempt
    pos_wipro = engine.open_position(
        symbol="WIPRO",
        side="BUY",
        quantity=20,
        entry_price=500.0,
        stop_loss=495.0,
        target_price=510.0,
        margin_required=2000.0,
    )
    engine.close_position(pos_wipro["position_id"], reason="BREAKEVEN_EXIT", exit_price=500.0)
    eligible, reason = engine.check_symbol_entry_eligibility("WIPRO")
    assert eligible is False
    assert "Cooldown active" in reason

    # After 25 minutes pass -> Eligible for second entry
    engine.closed_trades[-1]["exit_time"] = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
    eligible, reason = engine.check_symbol_entry_eligibility("WIPRO")
    assert eligible is True

    # 6. Second trade taken and closed -> Max 2 trades reached, cannot enter 3rd time
    pos_wipro2 = engine.open_position(
        symbol="WIPRO",
        side="BUY",
        quantity=20,
        entry_price=502.0,
        stop_loss=497.0,
        target_price=512.0,
        margin_required=2000.0,
    )
    engine.close_position(pos_wipro2["position_id"], reason="BREAKEVEN_EXIT", exit_price=502.0)
    eligible, reason = engine.check_symbol_entry_eligibility("WIPRO")
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

    # 1. Price moves to 1522 (+22 pts = 36% of target move) -> Trailed to Breakeven
    engine.process_market_tick({"NSE_EQ:INFY": {"last_price": 1522.0}})
    assert len(engine.open_positions) == 1
    current_pos = engine.open_positions[0]
    assert current_pos["stop_loss"] >= 1500.0  # Trailed to true breakeven (entry + friction)
    assert current_pos["trailing_stage"] == "BREAKEVEN"

    # 2. Market reverses and drops back to 1499 (Cost)
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


def test_profit_lock_at_fifty_percent_target():
    """Validates that reaching 50% of target distance locks 25% of the target move in profit."""
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    pos = engine.open_position(
        symbol="TCS",
        side="BUY",
        quantity=10,
        entry_price=4000.0,
        stop_loss=3960.0,   # 40 pts risk
        target_price=4080.0, # 80 pts target
        margin_required=8000.0,
    )
    # Price reaches 4040 (+40 pts = 50% of 80 pts target distance)
    # 50% target achieved -> Locks 25% of target (20 pts) -> SL = 4020
    engine.process_market_tick({"NSE_EQ:TCS": {"last_price": 4040.0}})
    assert len(engine.open_positions) == 1
    current_pos = engine.open_positions[0]
    assert current_pos["stop_loss"] == 4020.0
    assert current_pos["trailing_stage"] == "PROFIT_LOCK"

    # Market reverses to 4018, triggering the 25% profit lock SL
    engine.process_market_tick({"NSE_EQ:TCS": {"last_price": 4018.0}})
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "TRAILING_SL_HIT"
    assert trade["gross_pnl"] >= 180.0  # (4020 - 4000) * 10 or exit px near 4018


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

    # Crucial: Symbol must be locked for the rest of today to prevent re-entering exhausted reversal
    eligible, reason = engine.check_symbol_entry_eligibility("TATAMOTORS")
    assert eligible is False
    assert "Target Hit / Profit Locked" in reason


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
    Validates sustained VWAP thesis invalidation for BUY:
    - Noise within first 5 minutes or < 15 ticks does NOT prematurely close the position.
    - Once held >= 5m and price stays >= 0.40% below VWAP & >= 50% of SL distance underwater
      for 15 consecutive ticks (~60s), THESIS_INVALIDATED triggers cleanly.
    """
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    t_entry = datetime(2026, 9, 23, 10, 0, tzinfo=IST)
    pos = engine.open_position(
        symbol="TATASTEEL",
        side="BUY",
        quantity=100,
        entry_price=187.40,
        stop_loss=185.40,   # 2.00 pts full SL
        target_price=191.40,
        margin_required=3748.0,
        vwap=187.10,
        entry_time=t_entry.astimezone(timezone.utc),
    )
    assert len(engine.open_positions) == 1

    # Price drops to 186.20: Below VWAP 187.10 by 0.90 (>0.40% buffer 0.75) and 1.20 underwater (>= 50% of 2.00 SL)
    quotes = {
        "NSE_EQ:TATASTEEL": {
            "last_price": 186.20,
            "average_price": 187.10,
            "ohlc": {"open": 187.0, "high": 187.5, "low": 186.1, "close": 186.2},
        }
    }

    # Within first 5 minutes -> protected from noise shakeout
    t_early = t_entry + timedelta(minutes=2)
    for _ in range(5):
        engine.process_market_tick(quotes, current_time=t_early)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 0

    # After 6 minutes: requires 15 consecutive ticks (~60s)
    t_later = t_entry + timedelta(minutes=6)
    engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 1

    for _ in range(13):
        engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 14

    # Tick 15 confirms sustained invalidation and triggers early exit
    engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["symbol"] == "TATASTEEL"
    assert trade["exit_reason"] == "THESIS_INVALIDATED"
    assert trade["exit_price"] == 186.20
    assert trade["gross_pnl"] == round((186.20 - 187.40) * 100, 2)
    assert abs(trade["gross_pnl"]) < abs((185.40 - 187.40) * 100)


def test_thesis_invalidation_sell_early_exit():
    """
    Validates sustained VWAP thesis invalidation for SELL:
    - Noise within first 5 minutes does NOT trigger exit.
    - After >= 5m, 15 consecutive ticks >= 0.40% above VWAP and >= 50% SL underwater triggers THESIS_INVALIDATED.
    """
    engine = PaperTradingEngine(initial_budget=10000.0, persist=False)
    t_entry = datetime(2026, 9, 23, 10, 0, tzinfo=IST)
    pos = engine.open_position(
        symbol="INFY",
        side="SELL",
        quantity=10,
        entry_price=1500.0,
        stop_loss=1520.0,   # 20 pts full SL
        target_price=1460.0,
        margin_required=3000.0,
        vwap=1495.0,
        entry_time=t_entry.astimezone(timezone.utc),
    )
    assert len(engine.open_positions) == 1

    # Price rises to 1511.0: Above VWAP 1495.0 by 16.0 (>0.40% buffer 5.98) and 11.0 underwater (>= 50% of 20 SL)
    quotes = {
        "NSE_EQ:INFY": {
            "last_price": 1511.0,
            "average_price": 1495.0,
            "ohlc": {"open": 1495.0, "high": 1512.0, "low": 1490.0, "close": 1511.0},
        }
    }

    t_later = t_entry + timedelta(minutes=6)
    engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["vwap_breach_count"] == 1

    for _ in range(13):
        engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 1

    engine.process_market_tick(quotes, current_time=t_later)
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["symbol"] == "INFY"
    assert trade["exit_reason"] == "THESIS_INVALIDATED"
    assert trade["exit_price"] == 1511.0
    assert trade["gross_pnl"] == round((1500.0 - 1511.0) * 10, 2)
    assert abs(trade["gross_pnl"]) < abs((1500.0 - 1520.0) * 10)


def test_bhel_breakeven_covers_flat_brokerage_and_taxes():
    """Reproduces BHEL (124 qty @ ₹419.65): True Breakeven SL must cover ₹40+GST & STT so net_pnl >= 0."""
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    pos = engine.open_position(
        symbol="BHEL",
        side="BUY",
        quantity=124,
        entry_price=419.65,
        stop_loss=415.45,
        target_price=428.05,  # 8.40 target dist -> 35% = +2.94 -> 422.59
        margin_required=10407.32,
    )
    # Price moves to 422.70 (36% of target) -> trails SL to true breakeven covering all charges
    engine.process_market_tick({"NSE_EQ:BHEL": {"last_price": 422.70}})
    assert engine.open_positions[0]["trailing_stage"] == "BREAKEVEN"
    be_sl = engine.open_positions[0]["stop_loss"]
    assert be_sl >= 420.20

    # Price reverses and hits exact BE SL
    engine.process_market_tick({"NSE_EQ:BHEL": {"last_price": be_sl}})
    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["exit_reason"] == "BREAKEVEN_EXIT"
    assert trade["net_pnl"] > 0.0  # Never -₹28.33!


def test_staggered_entry_and_whipsaw_circuit_breaker():
    """
    Validates:
    1. Max 1 position is opened per tick (prevents opening 3 simultaneous SELL trades at once).
    2. If losses occur on both BUY and SELL sides (two-sided whipsaw), auto-trading halts for the day.
    """
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    t_now = datetime(2026, 11, 26, 10, 30, tzinfo=IST)
    setups = [
        {
            "symbol": "BANKBARODA",
            "signal": "SELL",
            "price": 276.09,
            "stop_loss": 279.0,
            "target_price": 270.0,
            "suggested_qty": 226,
            "setup_tier": "A+",
            "index_aligned": True,
            "alignment_status": "ALIGNED_BEARISH",
            "rvol": 1.8,
            "sector": "Public Banking",
        },
        {
            "symbol": "AMBUJACEM",
            "signal": "SELL",
            "price": 388.50,
            "stop_loss": 392.5,
            "target_price": 380.5,
            "suggested_qty": 160,
            "setup_tier": "A+",
            "index_aligned": True,
            "alignment_status": "ALIGNED_BEARISH",
            "rvol": 1.8,
            "sector": "Cement",
        },
    ]
    quotes = {
        "NSE_INDEX:Nifty 50": {"last_price": 24400.0, "ohlc": {"open": 24500.0, "high": 24510.0, "low": 24390.0}},
        "NSE_EQ:BANKBARODA": {"last_price": 276.09},
        "NSE_EQ:AMBUJACEM": {"last_price": 388.50},
    }
    engine.process_market_tick(quotes, top_setups=setups, current_time=t_now)
    # Only 1 trade opened on this tick!
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["symbol"] == "BANKBARODA"

    # Simulate 1 SELL loss + 1 BUY loss today (two-sided whipsaw)
    engine.open_positions = []
    today_str = t_now.strftime("%Y-%m-%d")
    engine.closed_trades = [
        {"symbol": "BANKBARODA", "side": "SELL", "net_pnl": -356.21, "date": today_str},
        {"symbol": "CGPOWER", "side": "BUY", "net_pnl": -344.81, "date": today_str},
    ]
    engine.process_market_tick(quotes, top_setups=setups, current_time=t_now + timedelta(minutes=25))
    assert len(engine.open_positions) == 0  # Halted by two-sided whipsaw circuit breaker!


def test_true_breakeven_covers_brokerage_and_charges():
    """Validates that True Breakeven trails SL above entry for BUY and below entry for SELL."""
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    entry = 500.0
    pos = engine.open_position(
        symbol="SBIN",
        side="BUY",
        quantity=50,
        entry_price=entry,
        stop_loss=495.0,
        target_price=510.0,
        margin_required=5000.0,
    )
    # Price moves to 504 (+4 pts = 40% of target move) -> triggers True Breakeven
    engine.process_market_tick({"NSE_EQ:SBIN": {"last_price": 504.0}})
    assert len(engine.open_positions) == 1
    # For BUY: stop_loss must be > entry (cost + friction)
    assert engine.open_positions[0]["stop_loss"] > entry
    assert engine.open_positions[0]["trailing_stage"] == "BREAKEVEN"


def test_stagnation_time_stop_prevents_eod_drift():
    """Validates that a position underwater for >45 minutes triggers STAGNATION_EXIT rather than drifting to EOD."""
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    pos = engine.open_position(
        symbol="HCLTECH",
        side="BUY",
        quantity=20,
        entry_price=1373.0,
        stop_loss=1355.0,
        target_price=1400.0,
        margin_required=5492.0,
    )

    # Simulate position entered 50 minutes prior during normal market session
    from datetime import datetime, timezone, timedelta
    market_time = datetime(2026, 9, 23, 11, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    t_entry = market_time.astimezone(timezone.utc) - timedelta(minutes=50)
    engine.open_positions[0]["entry_time"] = t_entry.isoformat()

    # Price dropped by 0.5% (underwater, stagnant)
    underwater_price = 1365.0
    engine.process_market_tick(
        {"NSE_EQ:HCLTECH": {"last_price": underwater_price}},
        current_time=market_time,
    )

    assert len(engine.open_positions) == 0
    trade = engine.closed_trades[-1]
    assert trade["symbol"] == "HCLTECH"
    assert trade["exit_reason"] == "STAGNATION_EXIT"


def test_counter_trend_blocked_from_auto_entry():
    """Validates that COUNTER_TREND or DIVERGENT setups are strictly blocked from auto-entry."""
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    mock_setups = [
        {
            "symbol": "BEL",
            "signal": "SELL",
            "price": 377.8,
            "entry_price": 377.8,
            "stop_loss": 381.0,
            "target_price": 370.0,
            "suggested_qty": 100,
            "setup_tier": "A+",
            "alignment_status": "COUNTER_TREND",  # Opposes NIFTY
        }
    ]
    market_time = datetime(2026, 9, 23, 10, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    engine.process_market_tick(
        {"NSE_EQ:BEL": {"last_price": 377.8}},
        top_setups=mock_setups,
        current_time=market_time,
    )
    # Should NOT have entered BEL because it is COUNTER_TREND
    assert len(engine.open_positions) == 0


def test_retest_dip_and_wick_trap_blocked_from_auto_entry():
    """Validates that WAIT_FOR_DIP setups and rejection wick traps are strictly blocked from auto-entry."""
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    mock_setups = [
        {
            "symbol": "INDUSINDBK",
            "signal": "BUY",
            "price": 920.20,
            "entry_price": 920.20,
            "stop_loss": 910.0,
            "target_price": 940.0,
            "setup_tier": "A",
            "alignment_status": "ALIGNED_BULLISH",
            "index_aligned": True,
            "entry_status": "WAIT_FOR_DIP",  # Awaiting retest
            "is_upper_rejection_trap": True,  # Heavy upper selling wick
        },
        {
            "symbol": "VEDL",
            "signal": "SELL",
            "price": 241.15,
            "entry_price": 241.15,
            "stop_loss": 244.0,
            "target_price": 236.0,
            "setup_tier": "A",
            "alignment_status": "ALIGNED_BEARISH",
            "index_aligned": True,
            "entry_status": "READY_NOW",
            "is_lower_absorption_trap": True,  # Lower wick absorption trap
        },
        {
            "symbol": "TCS",
            "signal": "BUY",
            "price": 3500.0,
            "entry_price": 3500.0,
            "stop_loss": 3465.0,
            "target_price": 3570.0,
            "setup_tier": "A+",
            "alignment_status": "ALIGNED_BULLISH",
            "index_aligned": True,
            "entry_status": "READY_NOW",  # Sweet-spot consolidation
            "is_upper_rejection_trap": False,
        },
    ]
    market_time = datetime(2026, 9, 23, 10, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    live_quotes = {
        "NSE_INDEX:Nifty 50": {"last_price": 24100.0, "ohlc": {"open": 24050.0, "high": 24120.0, "low": 24040.0, "close": 24000.0}},
        "NSE_EQ:INDUSINDBK": {"last_price": 920.20},
        "NSE_EQ:VEDL": {"last_price": 241.15},
        "NSE_EQ:TCS": {"last_price": 3500.0},
    }
    engine.process_market_tick(
        live_quotes,
        top_setups=mock_setups,
        current_time=market_time,
    )
    # Only TCS should enter! INDUSINDBK (WAIT_FOR_DIP/upper wick) and VEDL (lower absorption) must be blocked!
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["symbol"] == "TCS"


def test_stagnation_circuit_breaker_halts_auto_entries():
    """
    Validates that when 2 trades have exited via STAGNATION_EXIT (time-stop),
    the system halts fresh auto-entries for the rest of today (Zero-Momentum Protection).
    """
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    today_str = datetime.now(IST).strftime("%Y-%m-%d")
    engine.closed_trades = [
        {"symbol": "M&M", "side": "BUY", "net_pnl": -514.19, "exit_reason": "STAGNATION_EXIT", "date": today_str},
        {"symbol": "BHARTIARTL", "side": "BUY", "net_pnl": -517.88, "exit_reason": "STAGNATION_EXIT", "date": today_str},
    ]

    mock_setups = [
        {
            "symbol": "RELIANCE",
            "signal": "BUY",
            "price": 3000.0,
            "entry_price": 3000.0,
            "stop_loss": 2960.0,
            "target_price": 3060.0,
            "setup_tier": "A+",
            "alignment_status": "ALIGNED_BULLISH",
            "index_aligned": True,
            "entry_status": "READY_NOW",
        }
    ]

    engine.process_market_tick(
        {"NSE_EQ:RELIANCE": {"last_price": 3000.0}},
        top_setups=mock_setups,
        current_time=datetime.now(IST),
    )

    # Must be BLOCKED by Stagnation Circuit Breaker!
    assert len(engine.open_positions) == 0


def test_position_staggering_underwater_guard():
    """
    Validates that when an open position is currently underwater and was entered < 15 minutes ago,
    the engine holds off entering a second/third simultaneous trade.
    """
    engine = PaperTradingEngine(initial_budget=50000.0, persist=False)
    now = datetime(2026, 9, 23, 10, 5, tzinfo=IST)
    entry_time = datetime(2026, 9, 23, 10, 0, tzinfo=IST)  # Entered 5 mins ago!

    # Active position currently underwater
    engine.open_positions = [
        {
            "position_id": "POS-1",
            "symbol": "M&M",
            "side": "BUY",
            "quantity": 34,
            "entry_price": 3517.5,
            "current_price": 3510.0,
            "stop_loss": 3480.0,
            "target_price": 3570.0,
            "margin_required": 24000.0,
            "unrealized_pnl": -255.0,  # Underwater!
            "pnl_pct": -1.06,
            "entry_time": entry_time.isoformat(),
        }
    ]

    mock_setups = [
        {
            "symbol": "BHARTIARTL",
            "signal": "BUY",
            "price": 2157.4,
            "entry_price": 2157.4,
            "stop_loss": 2130.0,
            "target_price": 2200.0,
            "setup_tier": "A+",
            "alignment_status": "ALIGNED_BULLISH",
            "index_aligned": True,
            "entry_status": "READY_NOW",
        }
    ]

    engine.process_market_tick(
        {
            "NSE_EQ:M&M": {"last_price": 3510.0},
            "NSE_EQ:BHARTIARTL": {"last_price": 2157.4},
        },
        top_setups=mock_setups,
        current_time=now,
    )

    # Must NOT have entered BHARTIARTL! Only M&M remains open!
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["symbol"] == "M&M"





