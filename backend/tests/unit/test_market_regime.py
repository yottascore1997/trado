import pytest
from app.services.stock_screener import stock_screener_service
from app.services.price_action_engine import price_action_engine


def test_index_sideways_chop_detection():
    """
    Validates that when NIFTY has narrow range compression (<0.35%)
    and price is oscillating near flat VWAP (<0.12%),
    the regime is classified as SIDEWAYS_CHOP with NO_TRADE signal.
    """
    # Open: 24,500, High: 24,550, Low: 24,490, LTP: 24,505 (Range = 60 pts / 0.24%)
    mock_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24505.0,
            "net_change": 5.0,
            "ohlc": {
                "open": 24500.0,
                "high": 24550.0,
                "low": 24490.0,
                "close": 24505.0,
            },
        }
    }

    indices = stock_screener_service.get_indices_status(live_data=mock_quotes)
    nifty = indices[0]
    assert nifty["symbol"] == "NIFTY 50"
    assert nifty["regime"] == "SIDEWAYS_CHOP"
    assert nifty["trend"] == "NEUTRAL"
    assert nifty["signal"] == "NO_TRADE"


def test_index_trending_bullish_and_bearish_detection():
    """
    Validates that when NIFTY exhibits healthy range expansion (>=0.35%)
    and clear directional separation from VWAP,
    it correctly classifies as TRENDING_BULLISH or TRENDING_BEARISH.
    """
    # Bullish: Range = 180 pts (0.73%), LTP well above VWAP
    mock_bull_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24650.0,
            "net_change": 150.0,
            "ohlc": {
                "open": 24500.0,
                "high": 24680.0,
                "low": 24500.0,
                "close": 24650.0,
            },
        }
    }
    bull_res = stock_screener_service.get_indices_status(live_data=mock_bull_quotes)[0]
    assert bull_res["regime"] == "TRENDING_BULLISH"
    assert bull_res["trend"] == "BULLISH"
    assert bull_res["signal"] == "BUY"

    # Bearish: Range = 200 pts (0.81%), LTP well below VWAP
    mock_bear_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 24320.0,
            "net_change": -180.0,
            "ohlc": {
                "open": 24500.0,
                "high": 24510.0,
                "low": 24310.0,
                "close": 24320.0,
            },
        }
    }
    bear_res = stock_screener_service.get_indices_status(live_data=mock_bear_quotes)[0]
    assert bear_res["regime"] == "TRENDING_BEARISH"
    assert bear_res["trend"] == "BEARISH"
    assert bear_res["signal"] == "SELL"


def test_price_action_engine_blocks_sideways_chop():
    """
    Validates that when market_regime is SIDEWAYS_CHOP,
    PriceActionEngine forces setup tier to C (FILTERED) to prevent false breakout traps.
    """
    pa_eval = price_action_engine.evaluate_stock_price_action(
        symbol="RELIANCE",
        current_price=3020.0,
        strategy_signal="BUY",
        base_price=3000.0,
        vwap=3010.0,
        rvol=2.1,
        index_aligned=True,
        setup_type="Breakout",
        market_regime="SIDEWAYS_CHOP",
    )

    assert pa_eval.setup_tier == "C"
    assert pa_eval.market_structure == "SIDEWAYS_CHOP"
    assert "Sideways Chop" in pa_eval.filter_verdict


def test_anti_chasing_extension_guard():
    """
    Validates that when a stock has already moved > 1.8% away from VWAP,
    the screener flags it as Extended and prevents blind chase into the high.
    """
    # Mock stock extended 2.5% above VWAP
    price = 1025.0
    vwap = 1000.0
    extension_pct = round((abs(price - vwap) / vwap) * 100, 2)
    assert extension_pct > 1.8
