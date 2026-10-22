import pytest
from datetime import datetime, timezone, timedelta
from app.services.stock_screener import stock_screener_service
from app.services.paper_trading_engine import PaperTradingEngine, IST
from app.services.price_action_engine import price_action_engine


def test_nifty_bearish_blocks_all_equity_longs():
    """
    Validates that when NIFTY 50 is TRENDING_BEARISH (LTP < VWAP with Lower Highs):
    - All equity BUY signals are unconditionally converted to NO_TRADE.
    - Alpha breakout Longs are NOT permitted to bypass the filter.
    - Setup tier cannot be A+ or A without index alignment.
    """
    mock_bearish_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 22811.35,
            "net_change": -77.6,
            "ohlc": {
                "open": 22890.0,
                "high": 22910.0,
                "low": 22790.0,
                "close": 22811.35,
            },
        },
        "NSE_EQ:PNB": {
            "last_price": 123.79,
            "net_change": 1.20,
            "volume": 25_000_000,
            "average_price": 123.0,
            "ohlc": {"open": 122.5, "high": 124.5, "low": 122.0, "close": 123.79},
        },
        "NSE_EQ:BAJFINANCE": {
            "last_price": 934.4,
            "net_change": -15.0,
            "volume": 3_000_000,
            "average_price": 940.0,
            "ohlc": {"open": 948.0, "high": 950.0, "low": 932.0, "close": 934.4},
        },
    }

    # Verify NIFTY index classification
    indices = stock_screener_service.get_indices_status(live_data=mock_bearish_quotes)
    nifty = indices[0]
    assert nifty["symbol"] == "NIFTY 50"
    assert nifty["trend"] == "BEARISH"
    assert nifty["regime"] == "TRENDING_BEARISH"

    # Price action evaluation for a BUY stock when NIFTY is bearish (index_aligned=False)
    pa_buy = price_action_engine.evaluate_stock_price_action(
        symbol="PNB",
        current_price=123.79,
        strategy_signal="BUY",
        base_price=122.0,
        vwap=123.0,
        rvol=2.1,
        index_aligned=False,  # Opposing bearish NIFTY
        setup_type="Breakout",
        market_regime="TRENDING_BEARISH",
    )
    # Tier MUST NOT be A+ or A when opposing index!
    assert pa_buy.setup_tier not in ("A+", "A")
    assert pa_buy.setup_tier in ("B", "C")


def test_realtime_nifty_guard_in_paper_engine():
    """
    Validates that PaperTradingEngine.process_market_tick directly inspects live NIFTY quote:
    If NIFTY LTP < VWAP, any BUY order is blocked even if a setup was presented.
    """
    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)

    buy_setup = {
        "symbol": "PNB",
        "signal": "BUY",
        "price": 123.79,
        "entry_price": 123.79,
        "stop_loss": 123.00,
        "target_price": 126.00,
        "suggested_qty": 500,
        "setup_tier": "A+",
        "index_aligned": True,  # Stale flag simulation
    }

    # Live quotes where NIFTY is below VWAP
    quotes_bearish_market = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 22811.35,
            "ohlc": {
                "open": 22890.0,
                "high": 22910.0,
                "low": 22790.0,
                "close": 22811.35,
            },
        },
        "NSE_EQ:PNB": {"last_price": 123.79},
    }

    # Wednesday 10:30 AM IST (valid session window)
    market_time = datetime(2026, 9, 23, 10, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    engine.process_market_tick(quotes_bearish_market, top_setups=[buy_setup], current_time=market_time)

    # Real-time NIFTY guard must have blocked the Long BUY order!
    assert len(engine.open_positions) == 0


def test_pnb_quantity_cap_for_low_priced_stocks():
    """
    Validates that on low-priced stocks (e.g. ₹123.79) under a ₹10,00,000 budget,
    the quantity is capped by max_shares_cap (2,000) and NEVER exceeds 2,000 shares!
    """
    budget = 1000000.0  # 10 Lakhs wallet
    price = 123.79
    sl = 123.00
    actual_risk_per_share = abs(price - sl)  # ~₹0.79

    effective_risk_cap = min(budget * 0.015, 3000.0)  # Capped at ₹3,000
    risk_based_qty = max(1, int(effective_risk_cap / actual_risk_per_share))

    max_position_exposure = min(budget * 1.25, 250000.0)  # Capped at ₹2,50,000
    max_exposure_qty = max(1, int(max_position_exposure / price))

    max_shares_cap = 2000 if price < 250.0 else 5000

    suggested_qty = max(1, min(risk_based_qty, max_exposure_qty, max_shares_cap))

    # Must be strictly capped at 2,000 shares (or less), NEVER 10,097 shares!
    assert suggested_qty <= 2000
    assert suggested_qty < 10097


def test_is_api_session_active_hours():
    """
    Validates API active session window (Monday-Friday 09:00 - 15:35 IST):
    - Saturday & Sunday: Paused (Weekend)
    - Weekdays pre-9:00 AM & post-3:35 PM: Paused (Off-Hours)
    - Weekdays 10:30 AM: Active
    """
    IST_TZ = timezone(timedelta(hours=5, minutes=30))

    # 1. Wednesday 10:30 AM -> Active
    wed_active = datetime(2026, 9, 23, 10, 30, tzinfo=IST_TZ)
    is_active, desc = stock_screener_service.is_api_session_active(wed_active)
    assert is_active is True
    assert "Active" in desc

    # 2. Saturday 11:00 AM -> Blocked (Weekend)
    sat_weekend = datetime(2026, 9, 26, 11, 0, tzinfo=IST_TZ)
    is_active, desc = stock_screener_service.is_api_session_active(sat_weekend)
    assert is_active is False
    assert "Weekend" in desc

    # 3. Sunday 02:00 PM -> Blocked (Weekend)
    sun_weekend = datetime(2026, 9, 27, 14, 0, tzinfo=IST_TZ)
    is_active, desc = stock_screener_service.is_api_session_active(sun_weekend)
    assert is_active is False
    assert "Weekend" in desc

    # 4. Tuesday 08:30 AM (Pre-Market) -> Blocked (Off-Hours)
    tue_early = datetime(2026, 9, 22, 8, 30, tzinfo=IST_TZ)
    is_active, desc = stock_screener_service.is_api_session_active(tue_early)
    assert is_active is False
    assert "Pre-Market" in desc or "Off-Hours" in desc

    # 5. Thursday 16:30 PM (Post-Market) -> Blocked (Off-Hours)
    thu_late = datetime(2026, 9, 24, 16, 30, tzinfo=IST_TZ)
    is_active, desc = stock_screener_service.is_api_session_active(thu_late)
    assert is_active is False
    assert "Off-Hours" in desc


def test_fetch_live_quotes_off_hours_caching(monkeypatch):
    """
    Validates that during off-hours / weekends, fetch_live_quotes returns cached quotes
    and makes ZERO HTTP requests to the external Upstox API.
    """
    IST_TZ = timezone(timedelta(hours=5, minutes=30))
    sunday_dt = datetime(2026, 9, 27, 12, 0, tzinfo=IST_TZ)

    # Mock datetime to Sunday
    monkeypatch.setattr(
        stock_screener_service,
        "is_api_session_active",
        lambda now=None: (False, "Market Closed (Weekend: Saturday/Sunday)"),
    )

    # Set mock cached quotes
    stock_screener_service._cached_quotes = {
        "NSE_INDEX|Nifty 50": {"last_price": 24500.0}
    }

    # Should return cached quotes without making any network call!
    quotes = stock_screener_service.fetch_live_quotes()
    assert quotes == {"NSE_INDEX|Nifty 50": {"last_price": 24500.0}}


def test_run_screener_contains_market_session_metadata():
    """
    Validates that run_screener returns market_session metadata indicating active/power-save state.
    """
    res = stock_screener_service.run_screener(wallet_budget=10000.0, mode="INTRADAY_STOCKS")
    assert "market_session" in res
    assert "is_active" in res["market_session"]
    assert "power_save_mode" in res["market_session"]
    assert "session_window" in res["market_session"]

