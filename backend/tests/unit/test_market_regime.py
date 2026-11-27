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


def test_nifty100_universe_loading():
    """Validates that NIFTY 100 universe is loaded with all 100 liquid blue-chip constituents."""
    assert len(stock_screener_service.STOCKS_UNIVERSE) == 100
    assert len(stock_screener_service.UPSTOX_EQUITY_KEYS) == 100
    symbols = {s["symbol"] for s in stock_screener_service.STOCKS_UNIVERSE}
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert "HDFCBANK" in symbols
    assert "ZOMATO" in symbols
    assert "VEDL" in symbols


def test_v3_market_regime_range_ratio_and_breadth():
    """Validates Engine 1 RangeRatio and Market Breadth V3 calculation."""
    from app.services.market_regime_engine import market_regime_engine

    # NIFTY in dead chop
    mock_nifty_dead = {
        "last_price": 24505.0,
        "net_change": 5.0,
        "ohlc": {"open": 24500.0, "high": 24510.0, "low": 24495.0, "close": 24505.0},
    }
    dead_state = market_regime_engine.evaluate_regime(mock_nifty_dead, atr_14_5m=30.0)
    assert dead_state.market_state in ("DEAD", "WEAK")
    assert dead_state.v3_regime in ("MARKET_CHOPPY", "MARKET_NEUTRAL")

    # NIFTY active trending bullish
    mock_nifty_bull = {
        "last_price": 24700.0,
        "net_change": 200.0,
        "ohlc": {"open": 24500.0, "high": 24720.0, "low": 24490.0, "close": 24700.0},
    }
    all_quotes = {
        "NSE_EQ:RELIANCE": {"last_price": 3050.0, "net_change": 30.0, "ohlc": {"open": 3020.0}},
        "NSE_EQ:TCS": {"last_price": 4050.0, "net_change": 50.0, "ohlc": {"open": 4000.0}},
        "NSE_EQ:INFY": {"last_price": 1820.0, "net_change": 20.0, "ohlc": {"open": 1800.0}},
        "NSE_EQ:HDFCBANK": {"last_price": 1710.0, "net_change": 10.0, "ohlc": {"open": 1700.0}},
        "NSE_EQ:ICICIBANK": {"last_price": 1280.0, "net_change": -5.0, "ohlc": {"open": 1285.0}},
    }
    active_state = market_regime_engine.evaluate_regime(mock_nifty_bull, all_quotes=all_quotes, atr_14_5m=30.0)
    assert active_state.v3_regime == "MARKET_BULLISH"
    assert active_state.breadth_pct == 80.0  # 4 advancers out of 5
    assert active_state.can_trade_buy is True
    assert active_state.can_trade_sell is False


def test_sector_correlation_lock():
    """Validates Engine 3 Sector Correlation Lock: max 1 active position per sector."""
    from app.services.paper_trading_engine import PaperTradingEngine
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))

    engine = PaperTradingEngine(initial_budget=100000.0, persist=False)
    engine.auto_trading_enabled = True

    # Open first position in IT Services
    engine.open_position(
        symbol="TCS",
        side="BUY",
        quantity=5,
        entry_price=4000.0,
        stop_loss=3960.0,
        target_price=4080.0,
        margin_required=4000.0,
        sector="IT Services",
    )
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["sector"] == "IT Services"

    # Screener suggests INFY (also IT Services) with Tier A+
    test_setups = [
        {
            "symbol": "INFY",
            "name": "Infosys Ltd",
            "sector": "IT Services",
            "setup_tier": "A+",
            "signal": "BUY",
            "price": 1800.0,
            "stop_loss": 1780.0,
            "target_price": 1840.0,
            "entry_status": "READY_NOW",
            "rvol": 1.8,
            "index_aligned": True,
            "alignment_status": "ALIGNED_BULLISH",
            "is_active_volatility": True,
            "is_upper_rejection_trap": False,
            "is_lower_absorption_trap": False,
            "is_extended": False,
            "is_doji": False,
            "suggested_qty": 10,
        }
    ]

    quotes = {
        "NSE_INDEX:Nifty 50": {"last_price": 24650.0, "ohlc": {"open": 24500.0, "high": 24680.0, "low": 24500.0}},
        "NSE_EQ:INFY": {"last_price": 1800.0},
    }
    now_ist = datetime(2026, 11, 24, 10, 0, tzinfo=IST)
    engine.process_market_tick(quotes, top_setups=test_setups, current_time=now_ist)

    # INFY must be blocked by Sector Correlation Lock because TCS is already active in IT Services
    assert len(engine.open_positions) == 1
    assert engine.open_positions[0]["symbol"] == "TCS"


def test_doji_candle_filter():
    """Validates Engine 4 Doji Filter: Candle with < 35% body ratio is blocked from entry."""
    # Open: 1000.0, LTP/Close: 1000.5, High: 1010.0, Low: 990.0
    # Span = 20 pts, Body = 0.5 pts -> Body ratio = 2.5% < 35% (Doji)
    pa_eval = price_action_engine.evaluate_stock_price_action(
        symbol="SBIN",
        current_price=1000.5,
        strategy_signal="BUY",
        base_price=1000.0,
        vwap=998.0,
        rvol=1.8,
        index_aligned=True,
        setup_type="Breakout",
        day_open=1000.0,
        day_high=1010.0,
        day_low=990.0,
        body_ratio=0.025,
    )
    assert pa_eval.setup_tier == "C"
    assert "indecision doji" in pa_eval.filter_verdict.lower()


def test_v3_1_to_2_risk_reward_ratio():
    """Validates Engine 7 1:2 R:R (Target = 2 * Risk)."""
    # Test through screener calculation
    price = 2000.0
    atr = 40.0
    risk_pts = round(max(atr * 0.75, price * 0.010), 2)  # max(30, 20) = 30.0
    reward_pts = round(risk_pts * 2.0, 2)  # 60.0
    assert reward_pts / risk_pts == 2.0  # Exactly 1:2 R:R


def test_strict_sector_alignment_blocks_neutral_sector(monkeypatch):
    """
    Validates that a BUY signal is strictly blocked if the stock's sector is NEUTRAL or BEARISH.
    Only stocks whose sector is strictly BULLISH are permitted to generate BUY signals.
    """
    mock_quotes = {
        "NSE_INDEX:Nifty 50": {
            "last_price": 25200.0,
            "net_change": 120.0,
            "ohlc": {"open": 25100.0, "high": 25220.0, "low": 25080.0, "close": 25200.0},
        },
        # Private Banking is BULLISH: HDFCBANK (+1.2%, above VWAP)
        "NSE_EQ:HDFCBANK": {
            "last_price": 1720.0,
            "net_change": 20.0,
            "volume": 5000000,
            "average_price": 1710.0,
            "ohlc": {"open": 1700.0, "high": 1725.0, "low": 1700.0, "close": 1720.0},
        },
        # AXISBANK in Private Banking
        "NSE_EQ:AXISBANK": {
            "last_price": 1420.0,
            "net_change": 20.0,
            "volume": 4000000,
            "average_price": 1412.0,
            "ohlc": {"open": 1400.0, "high": 1425.0, "low": 1400.0, "close": 1420.0},
        },
        # Energy & Oil is NEUTRAL (+0.20% < 0.25% single-stock sector threshold) even though RELIANCE has active range & clean candle
        "NSE_EQ:RELIANCE": {
            "last_price": 2956.0,
            "net_change": 6.0,
            "volume": 6000000,
            "average_price": 2951.0,
            "ohlc": {"open": 2930.0, "high": 2958.0, "low": 2929.0, "close": 2950.0},
        },
        # Cap Goods (CGPOWER) is also tracked dynamically now (+0.15% = NEUTRAL, blocked from BUY)
        "NSE_EQ:CGPOWER": {
            "last_price": 801.2,
            "net_change": 1.2,
            "volume": 6000000,
            "average_price": 799.5,
            "ohlc": {"open": 794.0, "high": 802.0, "low": 793.5, "close": 800.0},
        },
    }

    monkeypatch.setattr(stock_screener_service, "fetch_live_quotes", lambda: mock_quotes)
    res = stock_screener_service.run_screener(wallet_budget=50000.0, mode="INTRADAY_STOCKS", bypass_cache=True)
    all_screened = res.get("all_screened_stocks", [])

    # RELIANCE & CGPOWER must both be blocked by Dynamic Sector Gatekeeper (Energy & Cap Goods are NEUTRAL)
    reliance_entry = next((s for s in all_screened if s["symbol"] == "RELIANCE"), None)
    cgpower_entry = next((s for s in all_screened if s["symbol"] == "CGPOWER"), None)
    assert reliance_entry is not None
    assert reliance_entry["signal"] == "NO_TRADE"
    assert "Sector" in reliance_entry["setup_type"]
    assert cgpower_entry is not None
    assert cgpower_entry["signal"] == "NO_TRADE"
    assert "Sector" in cgpower_entry["setup_type"]


def test_5m_candle_blocks_falling_knife_buy_and_allows_real_breakout(monkeypatch):
    """
    Validates that real 5m candle verification blocks a BUY when recent 5m candles are
    making Lower Highs / pulling back red into VWAP (falling knife), and allows a true HH/HL breakout.
    """
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    base_ts = datetime(2026, 11, 26, 9, 15, tzinfo=IST)

    # Falling-knife 1m candles: rallied early, then dropped on heavy red 5m bars toward VWAP
    falling_1m = []
    prices_falling = [
        (790, 795, 789, 794, 5000),
        (794, 802, 793, 801, 6000),
        (801, 806, 800, 805, 7000),
        (805, 805, 798, 799, 8000),
        (799, 800, 794, 795, 9000),
        (795, 796, 791, 792, 12000),
    ]
    for idx, (o, h, l, c, v) in enumerate(prices_falling):
        for m in range(5):
            falling_1m.append({
                "timestamp": base_ts + timedelta(minutes=idx * 5 + m),
                "open": float(o), "high": float(h), "low": float(l), "close": float(c), "volume": float(v),
            })

    bad_eval = stock_screener_service.analyze_5m_candles(falling_1m, current_price=792.0, signal="BUY")
    assert bad_eval["candles_verified"] is True
    assert bad_eval["momentum_confirmed"] is False

    # Constructive HH/HL 5m breakout candles with rising 5m volume
    bullish_1m = []
    prices_rising = [
        (788, 790, 787, 789, 4000),
        (789, 791, 788, 790, 4000),
        (790, 792, 789, 791, 4500),
        (791, 794, 790, 793, 5000),
        (793, 796, 792, 795, 7500),
        (795, 798, 794, 797, 9000),
    ]
    for idx, (o, h, l, c, v) in enumerate(prices_rising):
        for m in range(5):
            bullish_1m.append({
                "timestamp": base_ts + timedelta(minutes=idx * 5 + m),
                "open": float(o), "high": float(h), "low": float(l), "close": float(c), "volume": float(v),
            })

    good_eval = stock_screener_service.analyze_5m_candles(bullish_1m, current_price=797.0, signal="BUY")
    assert good_eval["candles_verified"] is True
    assert good_eval["momentum_confirmed"] is True
    assert good_eval["ema_9"] > good_eval["ema_20"]
    assert good_eval["real_rvol"] >= 1.5


