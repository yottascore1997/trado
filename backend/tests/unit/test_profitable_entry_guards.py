import pytest
from datetime import datetime, timezone, timedelta
from app.services.stock_screener import stock_screener_service
from app.services.paper_trading_engine import PaperTradingEngine, IST
from app.services.price_action_engine import price_action_engine


def test_mid_range_chop_filtered_by_price_action():
    """
    Validates that a stock trading in the middle of its day's range (range_pos ~ 0.50)
    fails the institutional breakout/breakdown filter and cannot receive Tier A or A+ ranking.
    """
    # Day high = 260.0, day low = 248.0. Price 254.0 is at (254 - 248) / 12 = 0.50 (50% midpoint).
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="ITC",
        current_price=254.0,
        strategy_signal="SELL",
        base_price=255.0,
        vwap=254.5,
        rvol=1.35,
        index_aligned=True,
        setup_type="Mid-Range Oscillating",
        day_high=260.0,
        day_low=248.0,
        day_open=255.0,
        ema_9=254.3,
        ema_20=254.6,
    )

    # In mid-range chop, tier MUST NOT be A+ or A (must be B or C)
    assert eval_res.setup_tier not in ("A+", "A")
    assert eval_res.setup_tier in ("B", "C")
    # Breakdown quality checklist rule must indicate mid-range / lack of decisive breakdown
    breakdown_rule = next((c for c in eval_res.checklist if "Breakdown Quality" in c["rule"]), None)
    assert breakdown_rule is not None
    assert breakdown_rule["passed"] is False


def test_consecutive_same_direction_loss_circuit_breaker():
    """
    Validates that if 2 consecutive Short SELL trades closed underwater today,
    further fresh Short SELL entries are blocked by the Directional Circuit Breaker.
    """
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    # Match the simulated market time
    market_time = datetime(2026, 9, 23, 11, 0, tzinfo=IST)
    today_str = market_time.strftime("%Y-%m-%d")

    # Simulate 2 failed SELL trades today
    engine.closed_trades = [
        {"symbol": "ITC", "side": "SELL", "net_pnl": -1061.50, "date": today_str},
        {"symbol": "BHARTIARTL", "side": "SELL", "net_pnl": -874.16, "date": today_str},
    ]

    sell_setup = {
        "symbol": "INFY",
        "signal": "SELL",
        "price": 1110.1,
        "entry_price": 1110.1,
        "stop_loss": 1120.0,
        "target_price": 1090.0,
        "suggested_qty": 100,
        "setup_tier": "A+",
        "index_aligned": True,
        "rvol": 1.8,
    }

    quotes = {"NSE_EQ:INFY": {"last_price": 1110.1}}
    engine.process_market_tick(quotes, top_setups=[sell_setup], current_time=market_time)

    # Directional Circuit Breaker must block the 3rd SELL entry!
    assert len(engine.open_positions) == 0


def test_low_rvol_setup_blocked_from_auto_entry():
    """
    Validates that a setup with low volume (RVOL < 1.20) is strictly blocked from auto-entry.
    """
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    low_vol_setup = {
        "symbol": "ONGC",
        "signal": "SELL",
        "price": 223.7,
        "entry_price": 223.7,
        "stop_loss": 226.0,
        "target_price": 218.0,
        "suggested_qty": 500,
        "setup_tier": "A+",
        "index_aligned": True,
        "rvol": 0.95,  # Low dry volume!
    }

    quotes = {"NSE_EQ:ONGC": {"last_price": 223.7}}
    market_time = datetime(2026, 9, 23, 11, 0, tzinfo=IST)
    engine.process_market_tick(quotes, top_setups=[low_vol_setup], current_time=market_time)

    # Must be blocked due to low RVOL
    assert len(engine.open_positions) == 0
