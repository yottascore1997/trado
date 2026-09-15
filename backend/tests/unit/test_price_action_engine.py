import pytest
from app.services.price_action_engine import price_action_engine, PriceActionEngine


def test_price_action_market_structure():
    engine = PriceActionEngine()
    assert engine.evaluate_market_structure(base_trend="BULLISH") == "HH_HL"
    assert engine.evaluate_market_structure(base_trend="BEARISH") == "LH_LL"
    assert engine.evaluate_market_structure(base_trend="SIDEWAYS") == "SIDEWAYS_CHOP"


def test_reliance_breakout_retest_evaluation():
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="RELIANCE",
        current_price=3027.85,
        strategy_signal="BUY",
        base_price=2985.50,
        vwap=3013.35,
        rvol=2.15,
        index_aligned=True,
        setup_type="VWAP Breakout + Volume Spike",
    )
    assert eval_res.setup_tier == "A+"
    assert eval_res.market_structure == "HH_HL"
    assert eval_res.score >= 18
    assert eval_res.retest_level == 3012.50
    assert "Breakout + Retest" in eval_res.pa_setup
    assert len(eval_res.checklist) == 6


def test_hdfc_bank_choppy_filtering():
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="HDFCBANK",
        current_price=1655.0,
        strategy_signal="NO_TRADE",
        base_price=1652.40,
        vwap=1654.0,
        rvol=1.1,
        index_aligned=True,
        setup_type="Range Bound Near VWAP",
    )
    assert eval_res.setup_tier == "C"
    assert eval_res.market_structure == "SIDEWAYS_CHOP"
    assert eval_res.score <= 5
    assert "FILTERED" in eval_res.filter_verdict
