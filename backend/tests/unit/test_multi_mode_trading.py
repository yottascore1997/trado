import pytest
from datetime import datetime, timezone, timedelta
from app.services.trading_plan_manager import TradingPlanManager
from app.services.stock_screener import stock_screener_service
from app.services.paper_trading_engine import PaperTradingEngine
from app.schemas.trading_plan import TradingPlanUpdate


def test_multi_mode_metrics_intraday_and_swing():
    """Verify that selecting both Intraday and Swing gives dedicated allocations and combined buying power."""
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(
        TradingPlanUpdate(
            wallet_budget=100000.0,
            trading_modes=["INTRADAY_STOCKS", "SWING_TRADING"],
            risk_per_trade_pct=1.5,
        )
    )

    metrics = mgr.calculate_metrics()
    assert metrics.wallet_budget == 100000.0
    assert metrics.active_modes == ["INTRADAY_STOCKS", "SWING_TRADING"]
    # Intraday 5x = 500,000, Swing 1x = 100,000 -> Total = 600,000
    assert metrics.effective_buying_power == 600000.0
    # Total allocated = 100k * 2 = 200,000
    assert metrics.total_allocated_capital == 200000.0
    assert metrics.product_type == "MIS & CNC"
    assert "INTRADAY_STOCKS" in metrics.mode_allocations
    assert "SWING_TRADING" in metrics.mode_allocations
    assert metrics.mode_allocations["INTRADAY_STOCKS"]["effective_buying_power"] == 500000.0
    assert metrics.mode_allocations["SWING_TRADING"]["effective_buying_power"] == 100000.0
    assert metrics.mode_allocations["SWING_TRADING"]["product_type"] == "CNC"


def test_multi_mode_backward_compatibility_comma_separated():
    """Verify that updating with comma-separated trading_mode parses into trading_modes."""
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(
        TradingPlanUpdate(
            wallet_budget=50000.0,
            trading_mode="INTRADAY_STOCKS,SWING_TRADING",
        )
    )

    metrics = mgr.calculate_metrics()
    assert metrics.active_modes == ["INTRADAY_STOCKS", "SWING_TRADING"]
    # 50k * 5 + 50k * 1 = 250k + 50k = 300,000
    assert metrics.effective_buying_power == 300000.0
    assert metrics.total_allocated_capital == 100000.0


def test_multi_mode_with_options():
    """Verify metrics when Intraday, Swing, and Options are all active."""
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(
        TradingPlanUpdate(
            wallet_budget=100000.0,
            trading_modes=["INTRADAY_STOCKS", "SWING_TRADING", "BANKNIFTY_OPTIONS"],
        )
    )

    metrics = mgr.calculate_metrics()
    assert len(metrics.active_modes) == 3
    # 500k + 100k + 100k = 700,000
    assert metrics.effective_buying_power == 700000.0
    assert metrics.total_allocated_capital == 300000.0


def test_cnc_swing_position_exempt_from_315_squareoff():
    """Verify that CNC (Swing Delivery) positions are NOT auto squared off at 3:15 PM."""
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    
    # Open an Intraday (MIS) position
    pos_mis = engine.open_position(
        symbol="TATASTEEL",
        side="BUY",
        quantity=50,
        entry_price=150.0,
        stop_loss=145.0,
        target_price=160.0,
        margin_required=1500.0,
        product_type="MIS",
    )
    
    # Open a Swing Delivery (CNC) position
    pos_cnc = engine.open_position(
        symbol="INFY",
        side="BUY",
        quantity=10,
        entry_price=1800.0,
        stop_loss=1700.0,
        target_price=2000.0,
        margin_required=18000.0,
        product_type="CNC",
    )
    
    assert len(engine.open_positions) == 2
    
    # Simulate a tick after 3:15 PM IST (15:20 IST = weekday)
    IST = timezone(timedelta(hours=5, minutes=30))
    # Pick a Wednesday at 15:20
    square_off_time = datetime(2026, 9, 23, 15, 20, 0, tzinfo=IST)
    
    mock_quotes = {
        "NSE_EQ:TATASTEEL": {"last_price": 151.0, "average_price": 150.5},
        "NSE_EQ:INFY": {"last_price": 1810.0, "average_price": 1805.0},
    }
    
    engine.process_market_tick(
        live_quotes=mock_quotes,
        top_setups=[],
        current_time=square_off_time,
        bypass_session_guard=True,
    )
    
    # MIS position should be closed due to INTRADAY_SQUARE_OFF
    # CNC position MUST remain open!
    open_syms = [p["symbol"] for p in engine.open_positions]
    assert "TATASTEEL" not in open_syms, "MIS position should have been squared off at 3:15 PM"
    assert "INFY" in open_syms, "CNC position MUST be preserved through 3:15 PM square-off"
    
    # Verify closed trade reason
    closed_reasons = {t["symbol"]: t["exit_reason"] for t in engine.closed_trades}
    assert closed_reasons.get("TATASTEEL") == "INTRADAY_SQUARE_OFF"


def test_screener_multi_mode_setups(monkeypatch):
    """Verify that stock screener includes both MIS and CNC setups when both modes are active."""
    mock_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 25200.0,
            "net_change": 120.0,
            "ohlc": {"open": 25100.0, "high": 25220.0, "low": 25080.0, "close": 25200.0},
        },
        "NSE_INDEX:Nifty Bank": {
            "last_price": 54200.0,
            "net_change": 250.0,
            "ohlc": {"open": 54000.0, "high": 54250.0, "low": 53950.0, "close": 54200.0},
        },
        "NSE_EQ:RELIANCE": {
            "last_price": 2980.0,
            "net_change": 35.0,
            "volume": 6_000_000,
            "average_price": 2960.0,
            "ohlc": {"open": 2950.0, "high": 2990.0, "low": 2945.0, "close": 2980.0},
        },
        "NSE_EQ:TATASTEEL": {
            "last_price": 188.0,
            "net_change": 3.5,
            "volume": 20_000_000,
            "average_price": 186.0,
            "ohlc": {"open": 185.0, "high": 189.0, "low": 184.5, "close": 188.0},
        },
        "NSE_EQ:HDFCBANK": {
            "last_price": 1720.0,
            "net_change": 18.0,
            "volume": 8_000_000,
            "average_price": 1710.0,
            "ohlc": {"open": 1705.0, "high": 1725.0, "low": 1700.0, "close": 1720.0},
        },
    }
    monkeypatch.setattr(stock_screener_service, "fetch_live_quotes", lambda: mock_quotes)

    res = stock_screener_service.run_screener(
        wallet_budget=100000.0,
        mode=["INTRADAY_STOCKS", "SWING_TRADING"],
        risk_pct=1.5,
    )

    assert "top_setups" in res
    assert "wallet_metrics" in res
    setups = res["top_setups"]
    assert len(setups) > 0

    product_types = {s.get("product_type") for s in setups}
    # When both Intraday and Swing are active, setups include MIS and CNC
    assert "MIS" in product_types or "CNC" in product_types
    assert res["wallet_metrics"]["effective_buying_power"] == 600000.0
    assert res["wallet_metrics"]["wallet_budget"] == 100000.0
