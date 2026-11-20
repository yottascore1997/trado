import pytest
from app.services.stock_screener import stock_screener_service
from app.services.price_action_engine import price_action_engine


def test_nifty_gap_fade_selloff_classified_bearish():
    """
    Test Case: NIFTY gaps up (+50 pts vs yesterday close), but then falls below today's open and VWAP.
    - Yesterday Close: 24,000
    - Today Open: 24,100 (+100 gap up)
    - High: 24,120
    - Low: 24,010
    - Current LTP: 24,030 (net_change is +30 vs yesterday, but down -70 from open!)
    - VWAP: ~24,065
    Expected: NIFTY must be classified as TRENDING_BEARISH / BEARISH, NOT BULLISH!
    """
    quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24030.0,
            "net_change": 30.0,  # Still +30 vs yesterday close 24,000
            "ohlc": {
                "open": 24100.0,
                "high": 24120.0,
                "low": 24010.0,
                "close": 24000.0,
            },
        }
    }

    indices = stock_screener_service.get_indices_status(live_data=quotes)
    nifty = indices[0]

    assert nifty["symbol"] == "NIFTY 50"
    assert nifty["trend"] == "BEARISH"
    assert nifty["regime"] == "TRENDING_BEARISH"
    assert nifty["signal"] == "SELL"


def test_stock_below_day_open_cannot_be_buy(monkeypatch):
    """
    Test Case: Stock gapped up vs yesterday close, but is trading below today's open (Intraday Red Candle).
    - Yesterday Close: 130.0
    - Today Open: 134.0 (+3% gap up)
    - Current Price: 132.50 (net_change is +2.50 vs yesterday, but down -1.50 from open)
    - Low: 132.0, High: 134.5
    Expected: Cannot generate BUY signal! Must be NO_TRADE or SELL.
    """
    quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24000.0,
            "net_change": 0.0,
            "ohlc": {"open": 24000.0, "high": 24050.0, "low": 23980.0, "close": 24000.0},
        },
        "NSE_EQ:CANBK": {
            "last_price": 132.50,
            "net_change": 2.50,  # Green vs yesterday!
            "average_price": 133.0,
            "volume": 10_000_000,
            "ohlc": {
                "open": 134.0,  # Gapped up to 134
                "high": 134.5,
                "low": 132.0,
                "close": 130.0,
            },
        },
    }

    monkeypatch.setattr(stock_screener_service, "fetch_live_quotes", lambda *args, **kwargs: quotes)
    monkeypatch.setattr(stock_screener_service, "is_api_session_active", lambda *args, **kwargs: (True, "Live Active"))

    results = stock_screener_service.run_screener(wallet_budget=50000.0, mode="INTRADAY_STOCKS", bypass_cache=True)
    all_stocks = results.get("all_screened_stocks", [])
    canbk = next((s for s in all_stocks if s["symbol"] == "CANBK"), None)

    assert canbk is not None
    # Must NOT be BUY!
    assert canbk["signal"] != "BUY"
    assert canbk["signal"] in ("NO_TRADE", "SELL")


def test_price_action_engine_demotes_red_candles_for_buy():
    """
    Test Case: Price Action Engine receives a BUY candidate, but current_price < day_open.
    Expected: Engine must demote tier to 'C' and block execution.
    """
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="KOTAKBANK",
        current_price=495.50,
        strategy_signal="BUY",
        base_price=490.0,
        vwap=495.0,
        rvol=1.8,
        index_aligned=True,
        setup_type="Breakout",
        day_high=498.0,
        day_low=494.0,
        day_open=497.0,  # Opened at 497, currently 495.5 (trading below open)
    )

    assert eval_res.setup_tier == "C"
    assert "below Day Open" in eval_res.filter_verdict


def test_upper_rejection_wick_blocks_buy_and_demotes_tier():
    """
    Test Case: IndusInd-like trap on Nov 19.
    Price pushed up to 925, but sellers dumped it to 920.20 (Upper rejection wick > 35%).
    Expected: Price Action Engine must demote tier to 'C' and flag upper rejection wick.
    """
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="INDUSINDBK",
        current_price=920.20,
        strategy_signal="BUY",
        base_price=915.0,
        vwap=918.0,
        rvol=1.8,
        index_aligned=True,
        setup_type="Breakout",
        day_high=925.0,
        day_low=917.0,
        day_open=918.0,
        upper_wick_ratio=0.60,  # 60% upper wick (shooting star / selling into highs)
        lower_wick_ratio=0.10,
    )

    assert eval_res.setup_tier == "C"
    assert "upper rejection wick" in eval_res.filter_verdict
    assert not eval_res.details["is_prime_setup"]


def test_lower_absorption_wick_blocks_sell_and_demotes_tier():
    """
    Test Case: VEDL-like trap on Nov 19.
    Price dropped to 239.50, but buyers absorbed selling up to 241.15 (Lower absorption wick > 35%).
    Expected: Price Action Engine must demote tier to 'C' and flag lower absorption wick.
    """
    eval_res = price_action_engine.evaluate_stock_price_action(
        symbol="VEDL",
        current_price=241.15,
        strategy_signal="SELL",
        base_price=245.0,
        vwap=242.0,
        rvol=1.8,
        index_aligned=True,
        setup_type="Breakdown",
        day_high=242.20,
        day_low=239.50,
        day_open=242.0,
        upper_wick_ratio=0.10,
        lower_wick_ratio=0.61,  # 61% lower wick (hammer / demand absorption)
    )

    assert eval_res.setup_tier == "C"
    assert "lower absorption wick" in eval_res.filter_verdict
    assert not eval_res.details["is_prime_setup"]


def test_retest_sweet_spot_guard_in_setup_tracker():
    """
    Test Case: Setup has Tier A+, but is currently in 'WAIT_FOR_DIP' status.
    Expected: SetupTrackerEngine MUST NOT enter trade until status is 'READY_NOW'.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo
    from app.services.setup_tracker_engine import SetupTrackerEngine

    IST = ZoneInfo("Asia/Kolkata")
    engine = SetupTrackerEngine(persist=False)
    engine.active_setups = []
    engine.closed_setups = []

    setups = [
        {
            "symbol": "TRENT",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 5000.0,
            "stop_loss": 4950.0,
            "target_price": 5100.0,
            "entry_status": "WAIT_FOR_DIP",  # Awaiting retest/dip!
            "setup_type": "VWAP Expansion",
        },
        {
            "symbol": "BAJAJ-AUTO",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 8000.0,
            "stop_loss": 7920.0,
            "target_price": 8160.0,
            "entry_status": "READY_NOW",  # Sweet-spot consolidation!
            "setup_type": "Retest Bounce",
        },
    ]

    live_quotes = {
        "NSE_EQ:TRENT": {"last_price": 5000.0},
        "NSE_EQ:BAJAJ-AUTO": {"last_price": 8000.0},
    }

    test_time = datetime(2026, 11, 3, 10, 0, tzinfo=IST)
    engine.process_market_tick(live_quotes, setups, current_time=test_time)

    # Only BAJAJ-AUTO (READY_NOW) should have entered. TRENT (WAIT_FOR_DIP) must be held back!
    assert len(engine.active_setups) == 1
    assert engine.active_setups[0]["symbol"] == "BAJAJ-AUTO"


def test_dormant_stock_range_filter_blocks_lici(monkeypatch):
    """
    Test Case: LICI-like dormant stock on Nov 20.
    Open: 406.0, High: 407.0, Low: 405.5, LTP: 406.7 (Range = 0.37% < 0.70%).
    Even though price > VWAP and price > open, the stock has NO intraday expansion.
    Expected: Screened stock must be marked NO_TRADE with 'Low Intraday Volatility'.
    """
    quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24200.0,
            "net_change": 150.0,
            "ohlc": {"open": 24050.0, "high": 24250.0, "low": 24050.0, "close": 24050.0},
        },
        "NSE_EQ:LICI": {
            "last_price": 406.70,
            "net_change": 0.70,
            "average_price": 406.20,
            "volume": 2_500_000,
            "ohlc": {
                "open": 406.0,
                "high": 407.0,  # Range = 1.50 / 406.0 = 0.37% (Sleepy stock!)
                "low": 405.5,
                "close": 406.0,
            },
        },
    }

    monkeypatch.setattr(stock_screener_service, "fetch_live_quotes", lambda *args, **kwargs: quotes)
    monkeypatch.setattr(stock_screener_service, "is_api_session_active", lambda *args, **kwargs: (True, "Live Active"))

    results = stock_screener_service.run_screener(wallet_budget=50000.0, mode="INTRADAY_STOCKS", bypass_cache=True)
    all_stocks = results.get("all_screened_stocks", [])
    lici = next((s for s in all_stocks if s["symbol"] == "LICI"), None)

    assert lici is not None
    assert lici["signal"] == "NO_TRADE"
    assert lici["entry_status"] == "NO_TRADE"
    assert lici["is_active_volatility"] is False
    assert "Low Intraday Volatility" in lici["setup_type"]


