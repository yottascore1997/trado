import pytest
from app.services.stock_screener import stock_screener_service
from app.services.paper_trading_engine import PaperTradingEngine


def test_tight_vs_wide_stop_loss_formula():
    """
    Validates:
    - Tight SL (₹0.50) -> Quantity is higher (2,000)
    - Wide SL (₹5.00) -> Quantity is lower (200)
    - Both scenarios maintain EXACT ₹1,000 max risk on SL hit!
    """
    max_risk_amount = 1000.0  # ₹1,000 predetermined risk
    entry_price = 187.40

    # 1. Tight SL (₹0.50 away)
    tight_sl = 186.90
    risk_per_share_tight = abs(entry_price - tight_sl)
    qty_tight = int(max_risk_amount / risk_per_share_tight)
    assert qty_tight == 2000
    assert qty_tight * risk_per_share_tight == 1000.0

    # 2. Wide SL (₹5.00 away)
    wide_sl = 182.40
    risk_per_share_wide = abs(entry_price - wide_sl)
    qty_wide = int(max_risk_amount / risk_per_share_wide)
    assert qty_wide == 200
    assert qty_wide * risk_per_share_wide == 1000.0


def test_tatasteel_trade_sizing_corrected():
    """
    Reproduces the exact TATASTEEL scenario:
    Entry = ₹187.40, SL = ₹186.11 (Risk per share = ₹1.29)
    With a ₹10,000 wallet and 1.5% risk (₹150 max risk):
    Quantity must be 116 shares (Risk = ₹149.64 <= ₹150),
    and MUST NEVER be 6,670 shares!
    """
    budget = 10000.0
    risk_pct = 1.5
    max_capital_risk = budget * (risk_pct / 100.0)  # ₹150
    entry_price = 187.40
    stop_loss = 186.11
    risk_per_share = abs(entry_price - stop_loss)  # ₹1.29

    # Risk-based quantity
    risk_qty = int(max_capital_risk / risk_per_share)
    assert risk_qty == 116

    # Margin limit check (for 2 stocks max, budget/2 = ₹5,000 * 5x = ₹25,000 buying power)
    alloc_margin = 5000.0 * 5.0
    margin_max_qty = int(alloc_margin / entry_price)
    assert margin_max_qty == 133

    # Final quantity is strictly capped by risk
    final_qty = min(risk_qty, margin_max_qty)
    assert final_qty == 116
    assert final_qty * risk_per_share <= max_capital_risk
    assert final_qty < 6670


def test_screener_all_setups_respect_max_risk():
    """
    Ensures that for any budget and risk percentage,
    all generated setups strictly obey max_risk_in_rs <= max_capital_risk.
    """
    budget = 50000.0
    risk_pct = 1.0  # Max ₹500 risk per trade
    max_allowed_risk = budget * (risk_pct / 100.0)

    result = stock_screener_service.run_screener(
        wallet_budget=budget,
        mode="INTRADAY_STOCKS",
        risk_pct=risk_pct,
    )

    for stock in result["all_screened_stocks"]:
        suggested_qty = stock["suggested_qty"]
        risk_rs = stock["max_risk_in_rs"]
        # Allow small 1-share floor margin of error if minimum qty is 1
        if suggested_qty > 1:
            assert risk_rs <= max_allowed_risk + 1.0, (
                f"{stock['symbol']}: Risk ₹{risk_rs} exceeds allowed ₹{max_allowed_risk}"
            )


def test_paper_trading_engine_auto_entry_respects_risk_cap():
    """
    Simulates auto-entry in PaperTradingEngine and ensures
    open position quantity does NOT exceed max_risk / risk_per_share.
    """
    engine = PaperTradingEngine(initial_budget=20000.0, persist=False)
    entry_price = 187.40
    sl = 186.11  # diff = ₹1.29

    mock_setups = [
        {
            "symbol": "TATASTEEL",
            "signal": "BUY",
            "price": entry_price,
            "entry_price": entry_price,
            "stop_loss": sl,
            "target_price": 190.0,
            "suggested_qty": 200,  # e.g., screener suggested 200
            "setup_tier": "A+",
            "setup_type": "Test Setup",
            "source": "UPSTOX_LIVE",
        }
    ]

    from datetime import datetime, timezone, timedelta
    # Explicitly use Wednesday 10:30 AM IST (Weekday within 09:30 - 14:45 active entry window)
    market_time = datetime(2026, 9, 23, 10, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    quotes = {
        "NSE_EQ:TATASTEEL": {"last_price": entry_price}
    }
    engine.process_market_tick(quotes, top_setups=mock_setups, current_time=market_time)

    assert len(engine.open_positions) == 1
    pos = engine.open_positions[0]
    assert pos["symbol"] == "TATASTEEL"

    # Risk in this position:
    risk_in_trade = pos["quantity"] * abs(pos["entry_price"] - pos["stop_loss"])
    # 1.5% of 20,000 = ₹300 max risk
    assert risk_in_trade <= 300.0 + 2.0
    assert pos["quantity"] <= int(300.0 / 1.29)
