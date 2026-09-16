import pytest
from app.services.paper_trading_engine import PaperTradingEngine


def test_paper_engine_initialization():
    engine = PaperTradingEngine(initial_budget=10000.0)
    assert engine.wallet_budget == 10000.0
    assert engine.available_balance <= 10000.0
    assert engine.auto_trading_enabled is True


def test_paper_engine_open_and_close_position():
    engine = PaperTradingEngine(initial_budget=10000.0)
    # Clear any seeded open positions
    engine.open_positions = []

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
    engine = PaperTradingEngine(initial_budget=10000.0)
    engine.open_positions = []

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
    engine = PaperTradingEngine(initial_budget=10000.0)
    engine.open_positions = []

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
    engine = PaperTradingEngine(initial_budget=10000.0)
    daywise = engine.get_daywise_pnl()
    assert isinstance(daywise, list)
    assert len(daywise) >= 2  # Seeded historical days + today

    for day in daywise:
        assert "date" in day
        assert "total_trades" in day
        assert "win_rate_pct" in day
        assert "net_pnl" in day
        assert "roi_pct" in day


def test_paper_engine_toggle_auto_trading():
    engine = PaperTradingEngine(initial_budget=10000.0)
    current = engine.auto_trading_enabled
    toggled = engine.toggle_auto_trading()
    assert toggled != current
    engine.toggle_auto_trading(True)
    assert engine.auto_trading_enabled is True
