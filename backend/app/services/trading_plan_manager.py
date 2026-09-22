import os
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.core.logger import logger
from app.schemas.trading_plan import (
    TradingPlanBase,
    TradingPlanUpdate,
    TradingPlanOut,
    WalletMetrics,
    ExecuteOrderIn,
    ExecuteOrderOut,
)

PLAN_STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / "trading_plan.json"


class TradingPlanManager:
    """
    Manages user-controlled isolated Virtual Wallet, Trading Mode,
    Risk Ring-Fencing, and Order Sizing constraints.
    Persists configuration to disk so settings survive reloads and restarts.
    """

    def __init__(self, persist: bool = True):
        self._persist = persist
        # Default starting state: ₹10,000 isolated wallet, Intraday Stocks, 1.5% risk
        self._plan = {
            "wallet_budget": 10000.0,
            "trading_mode": "INTRADAY_STOCKS",
            "trading_modes": ["INTRADAY_STOCKS"],
            "risk_per_trade_pct": 1.5,
            "max_daily_loss_pct": 3.0,
            "max_active_trades": 2,
            "auto_square_off_time": "15:15:00",
            "is_paper_mode": True,
            "kill_switch_active": False,
        }
        self._margin_currently_locked = 0.0
        self._executed_orders = []
        if self._persist:
            self._load_persisted_plan()

    def _load_persisted_plan(self):
        try:
            if PLAN_STORAGE_PATH.exists():
                with open(PLAN_STORAGE_PATH, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, dict):
                        self._plan.update(saved)
                        if "trading_modes" not in self._plan:
                            raw_mode = self._plan.get("trading_mode", "INTRADAY_STOCKS")
                            self._plan["trading_modes"] = [m.strip() for m in raw_mode.split(",") if m.strip()]
                        logger.info(f"Loaded persistent trading plan: budget=Rs.{self._plan.get('wallet_budget')}")
        except Exception as e:
            logger.warning(f"Could not load persisted trading plan: {e}")

    def _save_persisted_plan(self):
        if not self._persist:
            return
        try:
            with open(PLAN_STORAGE_PATH, "w", encoding="utf-8") as f:
                json.dump(self._plan, f, indent=2)
            logger.info(f"Saved persistent trading plan: budget=Rs.{self._plan.get('wallet_budget')}")
        except Exception as e:
            logger.warning(f"Could not save trading plan: {e}")

    def get_plan(self) -> Dict[str, Any]:
        return dict(self._plan)

    def calculate_metrics(self) -> WalletMetrics:
        budget = float(self._plan["wallet_budget"])
        raw_mode = self._plan.get("trading_mode", "INTRADAY_STOCKS")
        modes_list = self._plan.get("trading_modes")

        if not modes_list:
            if "," in raw_mode:
                modes_list = [m.strip() for m in raw_mode.split(",") if m.strip()]
            else:
                modes_list = [raw_mode]

        VALID_MODES = ["INTRADAY_STOCKS", "BANKNIFTY_OPTIONS", "NIFTY_OPTIONS", "SWING_TRADING"]
        active_modes = [m for m in modes_list if m in VALID_MODES]
        if not active_modes:
            active_modes = ["INTRADAY_STOCKS"]

        risk_pct = float(self._plan.get("risk_per_trade_pct", 1.5))
        daily_loss_pct = float(self._plan.get("max_daily_loss_pct", 3.0))

        mode_allocations = {}
        total_buying_power = 0.0
        total_max_active = 0
        has_mis = False
        has_cnc = False
        any_square_off = False

        for mode in active_modes:
            if mode == "INTRADAY_STOCKS":
                m_leverage = 5.0
                m_product = "MIS"
                m_square_off = True
                m_name = "Intraday Stocks"
                m_desc = "Intraday Cash Equities (5x Leverage, Auto 3:15 PM Square-off)"
                m_max_active = 2 if budget <= 25000.0 else (3 if budget <= 50000.0 else 4)
                m_alloc_per_stock = budget / m_max_active
            elif mode == "BANKNIFTY_OPTIONS":
                m_leverage = 1.0
                m_product = "MIS"
                m_square_off = True
                m_name = "Bank Nifty Options"
                m_desc = "Bank Nifty Index Options (1 Lot ATM, Strict 20pt Stop-Loss)"
                m_max_active = 1
                m_alloc_per_stock = budget
            elif mode == "NIFTY_OPTIONS":
                m_leverage = 1.0
                m_product = "MIS"
                m_square_off = True
                m_name = "NIFTY 50 Options"
                m_desc = "NIFTY 50 Index Options (1 Lot ATM, Tight 10pt Stop-Loss)"
                m_max_active = 1
                m_alloc_per_stock = budget
            elif mode == "SWING_TRADING":
                m_leverage = 1.0
                m_product = "CNC"
                m_square_off = False
                m_name = "Swing Delivery"
                m_desc = "Cash Delivery Swing Portfolio (Multi-Day Hold, Zero Square-Off Penalty)"
                m_max_active = 2 if budget <= 25000.0 else 3
                m_alloc_per_stock = budget / m_max_active
            else:
                m_leverage = 1.0
                m_product = "MIS"
                m_square_off = True
                m_name = mode
                m_desc = "Standard Trading Mode"
                m_max_active = 1
                m_alloc_per_stock = budget

            m_buying_power = budget * m_leverage
            total_buying_power += m_buying_power
            total_max_active += m_max_active
            if m_product == "MIS":
                has_mis = True
            if m_product == "CNC":
                has_cnc = True
            if m_square_off:
                any_square_off = True

            mode_allocations[mode] = {
                "mode": mode,
                "name": m_name,
                "budget": budget,
                "leverage": m_leverage,
                "effective_buying_power": m_buying_power,
                "product_type": m_product,
                "square_off_mandatory": m_square_off,
                "max_active_trades": m_max_active,
                "allocation_per_stock_max": round(m_alloc_per_stock, 2),
                "risk_per_trade_in_rs": round(budget * (risk_pct / 100.0), 2),
                "daily_loss_limit_in_rs": round(budget * (daily_loss_pct / 100.0), 2),
                "description": m_desc,
            }

        total_allocated_capital = budget * len(active_modes)
        eff_leverage = round(total_buying_power / total_allocated_capital, 2) if total_allocated_capital > 0 else 1.0
        risk_rs = round(budget * (risk_pct / 100.0), 2)
        daily_loss_rs = round(total_allocated_capital * (daily_loss_pct / 100.0), 2)

        if has_mis and has_cnc:
            overall_product = "MIS & CNC"
        elif has_cnc:
            overall_product = "CNC"
        else:
            overall_product = "MIS"

        if len(active_modes) == 1:
            m_info = mode_allocations[active_modes[0]]
            mode_desc = m_info["description"]
            alloc_per_stock = m_info["allocation_per_stock_max"]
        else:
            names = [mode_allocations[m]["name"] for m in active_modes]
            mode_desc = f"Multi-Segment Active: {', '.join(names)} (₹{budget:,.0f} per segment)"
            alloc_per_stock = budget / max(1, total_max_active)

        return WalletMetrics(
            wallet_budget=budget,
            effective_buying_power=round(total_buying_power, 2),
            leverage_multiplier=eff_leverage,
            risk_per_trade_in_rs=risk_rs,
            daily_loss_limit_in_rs=daily_loss_rs,
            max_active_trades=total_max_active,
            allocation_per_stock_max=round(alloc_per_stock, 2),
            mode_description=mode_desc,
            product_type=overall_product,
            square_off_mandatory=any_square_off,
            kill_switch_active=self._plan["kill_switch_active"],
            active_modes=active_modes,
            mode_allocations=mode_allocations,
            total_allocated_capital=round(total_allocated_capital, 2),
        )

    def update_plan(self, update_data: TradingPlanUpdate) -> TradingPlanOut:
        dump = update_data.model_dump(exclude_unset=True)
        if "trading_modes" in dump and dump["trading_modes"]:
            self._plan["trading_modes"] = dump["trading_modes"]
            self._plan["trading_mode"] = ",".join(dump["trading_modes"])
        elif "trading_mode" in dump and dump["trading_mode"]:
            raw = dump["trading_mode"]
            self._plan["trading_mode"] = raw
            if "," in raw:
                self._plan["trading_modes"] = [m.strip() for m in raw.split(",") if m.strip()]
            else:
                self._plan["trading_modes"] = [raw]

        for k, v in dump.items():
            if k not in ("trading_mode", "trading_modes") and v is not None:
                self._plan[k] = v

        self._save_persisted_plan()

        # Immediately sync new budget with paper trading engine
        try:
            from app.services.paper_trading_engine import paper_trading_engine
            paper_trading_engine.set_budget(self._plan["wallet_budget"])
        except Exception as e:
            logger.debug(f"Sync paper engine budget: {e}")

        metrics = self.calculate_metrics()
        active_modes = metrics.active_modes
        return TradingPlanOut(
            wallet_budget=self._plan["wallet_budget"],
            trading_mode=self._plan["trading_mode"],
            trading_modes=active_modes,
            risk_per_trade_pct=self._plan["risk_per_trade_pct"],
            max_daily_loss_pct=self._plan["max_daily_loss_pct"],
            max_active_trades=metrics.max_active_trades,
            auto_square_off_time=self._plan["auto_square_off_time"],
            is_paper_mode=self._plan["is_paper_mode"],
            kill_switch_active=self._plan["kill_switch_active"],
            metrics=metrics,
        )

    def toggle_kill_switch(self, active: Optional[bool] = None) -> bool:
        if active is None:
            self._plan["kill_switch_active"] = not self._plan["kill_switch_active"]
        else:
            self._plan["kill_switch_active"] = active
        self._save_persisted_plan()
        logger.warning(f"CIRCUIT BREAKER: Kill switch set to {self._plan['kill_switch_active']}")
        return self._plan["kill_switch_active"]

    def execute_order(self, order: ExecuteOrderIn) -> ExecuteOrderOut:
        if self._plan["kill_switch_active"]:
            raise ValueError("CIRCUIT BREAKER ACTIVE: System is locked. No orders allowed.")

        budget = self._plan["wallet_budget"]
        metrics = self.calculate_metrics()

        # Calculate Margin Required based on product type
        if order.product_type == "MIS" and self._plan["trading_mode"] == "INTRADAY_STOCKS":
            margin_required = round((order.quantity * order.entry_price) / 5.0, 2)
        else:
            margin_required = round(order.quantity * order.entry_price, 2)

        # STRICT WALLET RING-FENCING CHECK:
        if margin_required > budget:
            raise ValueError(
                f"WALLET LIMIT EXCEEDED: Required margin ₹{margin_required:,.2f} exceeds "
                f"allocated wallet budget of ₹{budget:,.2f}. Order rejected by Risk Engine."
            )

        risk_pts = abs(order.entry_price - order.stop_loss)
        reward_pts = abs(order.target_price - order.entry_price)
        max_risk_in_rs = round(order.quantity * risk_pts, 2)
        expected_profit_in_rs = round(order.quantity * reward_pts, 2)

        # Rupee risk check against planned risk
        allowed_risk_rs = metrics.risk_per_trade_in_rs
        if allowed_risk_rs > 0 and max_risk_in_rs > round(allowed_risk_rs * 1.15, 2):
            logger.warning(
                f"ORDER RISK ADVISORY: Order risk ₹{max_risk_in_rs:,.2f} exceeds recommended "
                f"per-trade risk of ₹{allowed_risk_rs:,.2f} for {order.symbol}."
            )

        order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        buffer_remaining = round(max(0.0, budget - margin_required), 2)

        # Formatted Upstox API Payload Preview
        upstox_payload = {
            "transaction_type": order.side,
            "instrument_token": f"NSE_EQ|{order.symbol}",
            "quantity": order.quantity,
            "product": order.product_type,
            "order_type": "MARKET",
            "price": 0.0,
            "trigger_price": 0.0,
            "disclosed_quantity": 0,
            "is_amo": False,
            "bracket_orders": {
                "stop_loss_trigger": order.stop_loss,
                "target_limit": order.target_price,
            },
            "system_risk_tag": f"WALLET_ISOLATION_{int(budget)}",
        }

        record = {
            "order_id": order_id,
            "symbol": order.symbol,
            "side": order.side,
            "quantity": order.quantity,
            "entry_price": order.entry_price,
            "stop_loss": order.stop_loss,
            "target_price": order.target_price,
            "margin_required": margin_required,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._executed_orders.append(record)

        return ExecuteOrderOut(
            success=True,
            order_id=order_id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            entry_price=order.entry_price,
            stop_loss=order.stop_loss,
            target_price=order.target_price,
            product_type=order.product_type or metrics.product_type,
            margin_required=margin_required,
            max_risk_in_rs=max_risk_in_rs,
            expected_profit_in_rs=expected_profit_in_rs,
            wallet_budget_before=budget,
            wallet_margin_used=margin_required,
            wallet_buffer_remaining=buffer_remaining,
            message=f"Order {order_id} punched safely within ₹{budget:,.0f} wallet limit.",
            broker_payload_preview=upstox_payload,
        )


trading_plan_manager = TradingPlanManager()
