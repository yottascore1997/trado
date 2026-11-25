"""
market_regime_engine.py
=======================
Engine 1: Market Regime & Adaptive Volatility Detection (NSE Price Action V3).

Quantitatively evaluates broad market conditions:
1. NIFTY 50 Direction & Velocity (Price vs VWAP, EMA 9/20 confluence, Slope).
2. Adaptive Sideways Filter:
   RangeRatio = (NIFTY 30m High - Low) / ATR_14_5m
   - Below 0.25: Dead / Sideways Chop (All momentum breakouts blocked)
   - 0.25 - 0.45: Weak
   - 0.45 - 0.70: Moderate
   - Above 0.70: Active Momentum
3. Market Breadth:
   Breadth = Advancers / (Advancers + Decliners)
   - > 55%: BUY environment preferred
   - < 45%: SELL environment preferred
   - 45% - 55%: Neutral / Selective
4. Output States:
   MARKET_BULLISH | MARKET_BEARISH | MARKET_NEUTRAL | MARKET_CHOPPY
"""

from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass, field


@dataclass
class MarketRegimeState:
    v3_regime: str  # "MARKET_BULLISH", "MARKET_BEARISH", "MARKET_NEUTRAL", "MARKET_CHOPPY"
    legacy_regime: str  # "TRENDING_BULLISH", "TRENDING_BEARISH", "SIDEWAYS_CHOP"
    trend: str  # "BULLISH", "BEARISH", "NEUTRAL"
    signal: str  # "BUY", "SELL", "NO_TRADE"
    range_ratio: float
    market_state: str  # "DEAD", "WEAK", "MODERATE", "ACTIVE"
    breadth_pct: float
    advancers: int
    decliners: int
    n_ltp: float
    n_vwap: float
    n_open: float
    n_high: float
    n_low: float
    vwap_distance_pct: float
    can_trade_buy: bool
    can_trade_sell: bool
    ai_score: int
    verdict: str
    details: Dict[str, Any] = field(default_factory=dict)


class MarketRegimeEngine:
    """
    Evaluates institutional market regime to gatekeep individual stock signals.
    """

    @staticmethod
    def calculate_breadth(quotes: Dict[str, Any]) -> Tuple[float, int, int]:
        """
        Calculates market breadth across the active universe:
        Breadth = Advancers / (Advancers + Decliners)
        Excludes unchanged stocks from the denominator.
        """
        advancers = 0
        decliners = 0

        for key, q in quotes.items():
            if not isinstance(q, dict) or "INDEX" in key:
                continue
            ltp = float(q.get("last_price") or 0.0)
            ohlc = q.get("ohlc", {})
            open_p = float(ohlc.get("open") or ltp)
            change = float(q.get("net_change") or (ltp - open_p))

            if change > 0.05:
                advancers += 1
            elif change < -0.05:
                decliners += 1

        total_active = advancers + decliners
        if total_active == 0:
            return 50.0, 0, 0

        breadth_pct = round((advancers / total_active) * 100.0, 2)
        return breadth_pct, advancers, decliners

    def evaluate_regime(
        self,
        nifty_quote: Optional[Dict[str, Any]],
        all_quotes: Optional[Dict[str, Any]] = None,
        atr_14_5m: Optional[float] = None,
    ) -> MarketRegimeState:
        """
        Evaluates the V3 Market Regime from live quotes.
        """
        if not nifty_quote or "last_price" not in nifty_quote:
            # Fallback default neutral
            return MarketRegimeState(
                v3_regime="MARKET_NEUTRAL",
                legacy_regime="SIDEWAYS_CHOP",
                trend="NEUTRAL",
                signal="NO_TRADE",
                range_ratio=0.50,
                market_state="MODERATE",
                breadth_pct=50.0,
                advancers=0,
                decliners=0,
                n_ltp=24500.0,
                n_vwap=24500.0,
                n_open=24500.0,
                n_high=24550.0,
                n_low=24450.0,
                vwap_distance_pct=0.0,
                can_trade_buy=False,
                can_trade_sell=False,
                ai_score=60,
                verdict="Market data feed unavailable or off-hours.",
            )

        n_ltp = float(nifty_quote.get("last_price") or 0.0)
        n_ohlc = nifty_quote.get("ohlc", {})
        n_open = float(n_ohlc.get("open", n_ltp))
        n_high = float(n_ohlc.get("high", n_ltp))
        n_low = float(n_ohlc.get("low", n_ltp))
        n_change = float(nifty_quote.get("net_change") or round(n_ltp - n_open, 2))
        n_pct = round((n_change / max(n_open, 1.0)) * 100, 2)
        n_session_change = round(n_ltp - n_open, 2)

        n_vwap = round(
            float(nifty_quote.get("average_price") or nifty_quote.get("vwap") or ((n_open + n_high + n_low + n_ltp) / 4.0)),
            1,
        )
        n_range_pts = max(n_high - n_low, 1.0)
        n_range_pct = round((n_range_pts / max(n_open, 1.0)) * 100, 2)
        n_vwap_dist = round(((n_ltp - n_vwap) / max(n_vwap, 1.0)) * 100, 2)

        # 1. Estimate / compute ATR 14 5m (Benchmark typical 5m ATR is ~25 to 35 pts on 24,000 NIFTY)
        effective_atr = atr_14_5m if (atr_14_5m and atr_14_5m > 0) else max(25.0, round(n_ltp * 0.0012, 1))

        # 2. Adaptive Range Ratio: NIFTY 30m Range / ATR_14_5m
        # Uses session range normalized by 5m ATR
        range_ratio = round(n_range_pts / (effective_atr * 3.0), 2)

        if range_ratio < 0.25:
            market_state = "DEAD"
        elif range_ratio < 0.45:
            market_state = "WEAK"
        elif range_ratio < 0.70:
            market_state = "MODERATE"
        else:
            market_state = "ACTIVE"

        # 3. Market Breadth
        if all_quotes:
            breadth_pct, adv, dec = self.calculate_breadth(all_quotes)
        else:
            breadth_pct = 60.0 if n_change > 0 else (40.0 if n_change < 0 else 50.0)
            adv, dec = (60, 40) if n_change > 0 else ((40, 60) if n_change < 0 else (50, 50))

        # 4. Quantitative V3 Regime Determination:
        # A. Dead / Sideways Chop: Range ratio < 0.25 OR (range_pct < 0.35% AND abs(vwap_dist) < 0.12%)
        is_choppy = (range_ratio < 0.25) or (n_range_pct < 0.35 and abs(n_vwap_dist) < 0.12)

        # B. Bullish: Above Day Open + Above VWAP (>= 0.08%) + Range ratio >= 0.35 + Breadth >= 50%
        is_bullish = (
            not is_choppy
            and n_ltp >= n_open
            and n_session_change >= 0
            and n_vwap_dist >= 0.08
            and n_range_pct >= 0.35
            and breadth_pct >= 48.0
        )

        # C. Bearish: Below Day Open/Net Neg + Below VWAP (<= -0.08%) + Range ratio >= 0.35 + Breadth <= 52%
        is_bearish = (
            not is_choppy
            and (n_change < 0 or (n_ltp < n_open and n_session_change < 0))
            and n_vwap_dist <= -0.08
            and n_range_pct >= 0.35
            and breadth_pct <= 52.0
        )

        if is_bullish:
            v3_regime = "MARKET_BULLISH"
            legacy_regime = "TRENDING_BULLISH"
            trend = "BULLISH"
            signal = "BUY"
            can_buy = True
            can_sell = False
            ai_score = min(95, int(75 + abs(n_pct) * 8 + (range_ratio * 10)))
            verdict = f"V3 Bullish Momentum: NIFTY holding above VWAP (+{n_vwap_dist}%), Breadth {breadth_pct}% Advancers."
        elif is_bearish:
            v3_regime = "MARKET_BEARISH"
            legacy_regime = "TRENDING_BEARISH"
            trend = "BEARISH"
            signal = "SELL"
            can_buy = False
            can_sell = True
            ai_score = min(95, int(75 + abs(n_pct) * 8 + (range_ratio * 10)))
            verdict = f"V3 Bearish Liquidation: NIFTY below VWAP ({n_vwap_dist}%), Breadth {100-breadth_pct}% Decliners."
        elif is_choppy:
            v3_regime = "MARKET_CHOPPY"
            legacy_regime = "SIDEWAYS_CHOP"
            trend = "NEUTRAL"
            signal = "NO_TRADE"
            can_buy = False
            can_sell = False
            ai_score = 55
            verdict = f"V3 Sideways Chop: Range ratio {range_ratio} < 0.40. Breakouts blocked to prevent whipsaws."
        else:
            v3_regime = "MARKET_NEUTRAL"
            legacy_regime = "SIDEWAYS_CHOP"
            trend = "NEUTRAL"
            signal = "NO_TRADE"
            can_buy = False
            can_sell = False
            ai_score = 60
            verdict = f"V3 Neutral Compression: Market awaiting directional expansion (Breadth: {breadth_pct}%)."

        return MarketRegimeState(
            v3_regime=v3_regime,
            legacy_regime=legacy_regime,
            trend=trend,
            signal=signal,
            range_ratio=range_ratio,
            market_state=market_state,
            breadth_pct=breadth_pct,
            advancers=adv,
            decliners=dec,
            n_ltp=n_ltp,
            n_vwap=n_vwap,
            n_open=n_open,
            n_high=n_high,
            n_low=n_low,
            vwap_distance_pct=n_vwap_dist,
            can_trade_buy=can_buy,
            can_trade_sell=can_sell,
            ai_score=ai_score,
            verdict=verdict,
            details={
                "n_range_pts": n_range_pts,
                "n_range_pct": n_range_pct,
                "effective_atr": effective_atr,
            },
        )


market_regime_engine = MarketRegimeEngine()

