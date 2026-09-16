import pytest
from app.services.trading_plan_manager import TradingPlanManager
from app.services.stock_screener import stock_screener_service
from app.schemas.trading_plan import TradingPlanUpdate, ExecuteOrderIn


def test_trading_plan_default_metrics():
    mgr = TradingPlanManager(persist=False)
    plan = mgr.get_plan()
    assert plan["wallet_budget"] == 10000.0
    assert plan["trading_mode"] == "INTRADAY_STOCKS"

    metrics = mgr.calculate_metrics()
    assert metrics.wallet_budget == 10000.0
    assert metrics.effective_buying_power == 50000.0  # 5x leverage
    assert metrics.risk_per_trade_in_rs == 150.0  # 1.5% of ₹10,000
    assert metrics.daily_loss_limit_in_rs == 300.0  # 3.0% of ₹10,000
    assert metrics.max_active_trades == 2
    assert metrics.product_type == "MIS"
    assert metrics.square_off_mandatory is True


def test_trading_plan_scale_to_100k():
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(TradingPlanUpdate(wallet_budget=100000.0, risk_per_trade_pct=1.0))
    metrics = mgr.calculate_metrics()

    assert metrics.wallet_budget == 100000.0
    assert metrics.effective_buying_power == 500000.0
    assert metrics.risk_per_trade_in_rs == 1000.0
    assert metrics.daily_loss_limit_in_rs == 3000.0
    assert metrics.max_active_trades == 4
    assert metrics.allocation_per_stock_max == 25000.0


def test_trading_plan_modes():
    mgr = TradingPlanManager(persist=False)

    # Bank Nifty Options Mode
    mgr.update_plan(TradingPlanUpdate(trading_mode="BANKNIFTY_OPTIONS"))
    bn_metrics = mgr.calculate_metrics()
    assert bn_metrics.product_type == "MIS"
    assert bn_metrics.max_active_trades == 1

    # Swing Trading Mode
    mgr.update_plan(TradingPlanUpdate(trading_mode="SWING_TRADING"))
    swing_metrics = mgr.calculate_metrics()
    assert swing_metrics.product_type == "CNC"
    assert swing_metrics.square_off_mandatory is False


def test_stock_screener_dynamic_sizing_10k_vs_100k():
    # 10k sizing test
    res_10k = stock_screener_service.run_screener(wallet_budget=10000.0, mode="INTRADAY_STOCKS", risk_pct=1.5)
    assert "wallet_metrics" in res_10k
    assert res_10k["wallet_metrics"]["wallet_budget"] == 10000.0
    assert res_10k["wallet_metrics"]["risk_per_trade_in_rs"] == 150.0

    # Ensure all setups in 10k do not exceed allocated margin per stock
    alloc_max = res_10k["wallet_metrics"]["allocation_per_stock_max"]
    for setup in res_10k["top_setups"]:
        assert setup["margin_required"] <= alloc_max * 1.05  # allow small rounding

    # 100k sizing test
    res_100k = stock_screener_service.run_screener(wallet_budget=100000.0, mode="INTRADAY_STOCKS", risk_pct=1.0)
    assert res_100k["wallet_metrics"]["wallet_budget"] == 100000.0
    assert res_100k["wallet_metrics"]["risk_per_trade_in_rs"] == 1000.0


def test_order_execution_within_wallet():
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(TradingPlanUpdate(wallet_budget=10000.0, trading_mode="INTRADAY_STOCKS"))

    order = ExecuteOrderIn(
        symbol="TATASTEEL",
        side="BUY",
        quantity=50,
        entry_price=152.40,
        stop_loss=149.00,
        target_price=160.00,
        product_type="MIS",
    )
    result = mgr.execute_order(order)
    assert result.success is True
    assert result.margin_required <= 10000.0
    assert result.wallet_margin_used > 0
    assert result.wallet_buffer_remaining > 0
    assert "broker_payload_preview" in result.model_dump()


def test_order_execution_rejection_when_exceeding_wallet():
    mgr = TradingPlanManager(persist=False)
    mgr.update_plan(TradingPlanUpdate(wallet_budget=10000.0, trading_mode="INTRADAY_STOCKS"))

    # Attempt order requiring huge margin (e.g. 5000 shares of Reliance at 3000 = ₹30 Lakh margin)
    huge_order = ExecuteOrderIn(
        symbol="RELIANCE",
        side="BUY",
        quantity=5000,
        entry_price=3000.00,
        stop_loss=2950.00,
        target_price=3100.00,
        product_type="MIS",
    )
    with pytest.raises(ValueError, match="WALLET LIMIT EXCEEDED"):
        mgr.execute_order(huge_order)


def test_circuit_breaker_kill_switch():
    mgr = TradingPlanManager(persist=False)
    mgr.toggle_kill_switch(True)

    order = ExecuteOrderIn(
        symbol="SBIN",
        side="BUY",
        quantity=10,
        entry_price=800.00,
        stop_loss=790.00,
        target_price=820.00,
        product_type="MIS",
    )
    with pytest.raises(ValueError, match="CIRCUIT BREAKER ACTIVE"):
        mgr.execute_order(order)

    mgr.toggle_kill_switch(False)
