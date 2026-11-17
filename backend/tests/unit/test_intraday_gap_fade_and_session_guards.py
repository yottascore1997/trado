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
