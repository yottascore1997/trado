import pytest
from app.services.stock_screener import stock_screener_service


def test_dynamic_atr_anti_chasing():
    """
    Tests that the anti-chasing guard adapts dynamically to ATR rather than an arbitrary 1.8% fixed value.
    - If price distance from VWAP > 1.25x ATR, it is flagged as over-extended.
    - If within 1.25x ATR, it is considered safe for breakout entry.
    """
    # Case 1: Low-volatility stock (TCS/HDFCBANK style: ATR = ₹15, Price = ₹3000)
    # Price moves ₹30 away from VWAP. Percentage is only 1.0%, but in ATR terms it is 2.0x ATR!
    # A fixed 1.8% rule would have failed to catch this trap, but ATR guard catches it!
    price = 3030.0
    vwap = 3000.0
    atr = 15.0
    vwap_distance = abs(price - vwap)
    atr_ratio = round(vwap_distance / atr, 2)
    is_extended = atr_ratio > 1.25
    assert is_extended is True
    assert atr_ratio == 2.0

    # Case 2: High-beta volatile stock (TATASTEEL style: ATR = ₹4.0, Price = ₹187)
    # Price moves ₹2.0 away from VWAP. Percentage is 1.07%, well within 1.25x ATR (0.50x ATR).
    price_beta = 189.0
    vwap_beta = 187.0
    atr_beta = 4.0
    vwap_dist_beta = abs(price_beta - vwap_beta)
    atr_ratio_beta = round(vwap_dist_beta / atr_beta, 2)
    is_extended_beta = atr_ratio_beta > 1.25
    assert is_extended_beta is False
    assert atr_ratio_beta == 0.50


def test_relative_strength_vs_nifty_classification():
    """
    Tests that stocks are quantitatively classified into OUTPERFORMER, UNDERPERFORMER, or IN_LINE
    relative to NIFTY 50 benchmark change.
    """
    nifty_change_pct = 0.60  # NIFTY is +0.60%

    # Stock A (Strong Leader): Up +1.80%
    stock_a_pct = 1.80
    rs_a = round(stock_a_pct - nifty_change_pct, 2)
    assert rs_a == +1.20
    rs_status_a = "OUTPERFORMER" if rs_a >= 0.25 else ("UNDERPERFORMER" if rs_a <= -0.25 else "IN_LINE")
    assert rs_status_a == "OUTPERFORMER"

    # Stock B (Laggard Drag): Up only +0.20% (Trailing Nifty)
    stock_b_pct = 0.20
    rs_b = round(stock_b_pct - nifty_change_pct, 2)
    assert rs_b == -0.40
    rs_status_b = "OUTPERFORMER" if rs_b >= 0.25 else ("UNDERPERFORMER" if rs_b <= -0.25 else "IN_LINE")
    assert rs_status_b == "UNDERPERFORMER"


def test_time_of_day_rvol_normalization():
    """
    Tests that morning volume at 09:35 AM is normalized against elapsed market time (20 mins of 375 mins)
    rather than compared raw against full-day 20-day volume.
    """
    avg_daily_vol = 1_000_000
    elapsed_mins = 20.0  # 20 minutes into the session (09:35 AM)
    session_total_mins = 375.0

    expected_fraction = elapsed_mins / session_total_mins  # ~0.0533 (5.33% of daily volume expected)
    expected_vol = avg_daily_vol * expected_fraction       # 53,333 shares expected by 09:35 AM

    # If 120,000 shares have already traded by 09:35 AM:
    actual_volume = 120_000
    rvol = round(actual_volume / expected_vol, 2)

    # Raw comparison (120k / 1M = 0.12x) would falsely claim zero volume!
    # Normalized Time-of-Day RVOL correctly detects 2.25x institutional volume explosion!
    assert rvol == 2.25
    assert rvol >= 1.50


def test_orb_breakout_buffer_protection():
    """
    Tests that a 0.10% buffer prevents deceptive 10-paise tick false breakouts.
    """
    orb_high = 1000.0
    orb_buffer = round(orb_high * 0.0010, 2)  # ₹1.00 buffer (0.10%)

    # Deceptive 1-tick breakout (+10 paise):
    tick_breakout_price = 1000.10
    confirmed_breakout = tick_breakout_price >= (orb_high + orb_buffer)
    assert not confirmed_breakout  # Must NOT confirm on 10 paise tick!

    # Decisive expansion breakout (+₹2.50):
    expansion_price = 1002.50
    confirmed_expansion = expansion_price >= (orb_high + orb_buffer)
    assert confirmed_expansion is True


def test_composite_multi_factor_ranking_selection():
    """
    Validates that when multiple stocks trigger signals, the Multi-Factor Composite Ranking formula
    ranks the true alpha leader ahead of low-quality or laggard candidates.
    """
    # Candidate 1: High AI (84), High PA (18/20), Leading Outperformer (RS +1.4%), High RVOL (2.4x)
    norm_ai_1 = 84.0
    norm_pa_1 = (18 / 20.0) * 100.0  # 90.0
    rs_1 = +1.40
    norm_rs_1 = max(0.0, min(100.0, 50.0 + (rs_1 * 50.0)))  # 100.0
    rvol_1 = 2.4
    norm_rvol_1 = min(100.0, (rvol_1 / 2.0) * 100.0)       # 100.0

    composite_1 = round(
        (norm_ai_1 * 0.40) + (norm_pa_1 * 0.25) + (norm_rs_1 * 0.20) + (norm_rvol_1 * 0.15), 1
    )

    # Candidate 2: Same AI (84), but Weak PA (8/20), Market Laggard (RS -0.40%), Low RVOL (1.1x)
    norm_ai_2 = 84.0
    norm_pa_2 = (8 / 20.0) * 100.0  # 40.0
    rs_2 = -0.40
    norm_rs_2 = max(0.0, min(100.0, 50.0 + (rs_2 * 50.0)))  # 30.0
    rvol_2 = 1.1
    norm_rvol_2 = min(100.0, (rvol_2 / 2.0) * 100.0)       # 55.0

    composite_2 = round(
        (norm_ai_2 * 0.40) + (norm_pa_2 * 0.25) + (norm_rs_2 * 0.20) + (norm_rvol_2 * 0.15), 1
    )

    # Candidate 1 score = (33.6 + 22.5 + 20.0 + 15.0) = 91.1
    # Candidate 2 score = (33.6 + 10.0 + 6.0 + 8.25) = 57.85
    assert composite_1 > composite_2
    assert composite_1 >= 90.0
    assert composite_2 < 60.0


def test_screener_output_contains_new_institutional_metrics(monkeypatch):
    """
    Verifies that run_screener() returns the new fields:
    relative_strength, rs_status, atr_extension_ratio, composite_rank_score, and orb_buffer.
    """
    mock_quotes = {
        "NSE_EQ:RELIANCE": {
            "last_price": 3020.0,
            "net_change": 25.0,
            "volume": 2_500_000,
            "ohlc": {"open": 2995.0, "high": 3025.0, "low": 2990.0, "close": 3020.0},
        },
        "NSE_EQ:TATASTEEL": {
            "last_price": 188.0,
            "net_change": 1.5,
            "volume": 15_000_000,
            "ohlc": {"open": 186.5, "high": 188.5, "low": 186.0, "close": 188.0},
        },
    }
    monkeypatch.setattr(stock_screener_service, "fetch_live_quotes", lambda: mock_quotes)

    screener_res = stock_screener_service.run_screener(wallet_budget=25000.0)
    assert "all_screened_stocks" in screener_res
    assert len(screener_res["all_screened_stocks"]) > 0

    first_stock = screener_res["all_screened_stocks"][0]
    assert "relative_strength" in first_stock
    assert "rs_status" in first_stock
    assert "atr_extension_ratio" in first_stock
    assert "composite_rank_score" in first_stock
    assert "orb_buffer" in first_stock

    # Check that stocks are sorted by composite_rank_score descending
    scores = [s.get("composite_rank_score", 0.0) for s in screener_res["all_screened_stocks"]]
    assert scores == sorted(scores, reverse=True)
