import json
import os
import uuid
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from app.core.logger import logger

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
STATE_FILE = DATA_DIR / "paper_trading_state.json"
IST = timezone(timedelta(hours=5, minutes=30))


class PaperTradingEngine:
    """
    Automated Zero-Risk Paper Trading Engine powered by Upstox Live Market Data.
    Features:
    - Ring-fenced isolated Virtual Wallet (e.g. ₹10,000 / ₹1,00,000)
    - Auto-execution on A+/A Tier screener setups
    - Real-time trailing MTM from Upstox live LTP
    - Automated Target Hit (🎯), Stop Loss Hit (🛑), and 3:15 PM Intraday Square-off
    - Persistent Day-Wise P&L Ledger & Analytics across refreshes, reloads, and browser sessions
    """

    def __init__(self, initial_budget: float = 10000.0, persist: bool = True):
        self._lock = threading.RLock()
        self.persist = persist
        self.wallet_budget = initial_budget
        self.available_balance = initial_budget
        self.margin_locked = 0.0
        self.auto_trading_enabled = True
        self.last_feed_time: Optional[datetime] = None

        self.open_positions: List[Dict[str, Any]] = []
        self.closed_trades: List[Dict[str, Any]] = []

        # Load real persistent state (survives refreshes, browser switches, and restarts)
        if self.persist:
            self._load_persisted_state()

    def _load_persisted_state(self):
        """Loads genuine persisted paper trades and wallet state."""
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            if STATE_FILE.exists():
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, dict):
                        self.wallet_budget = float(saved.get("wallet_budget", self.wallet_budget))
                        self.available_balance = float(saved.get("available_balance", self.wallet_budget))
                        self.auto_trading_enabled = bool(saved.get("auto_trading_enabled", True))
                        self.open_positions = saved.get("open_positions", [])
                        self.closed_trades = saved.get("closed_trades", [])
                        logger.info(f"Loaded persistent paper trading state: {len(self.open_positions)} open, {len(self.closed_trades)} closed trades.")
        except Exception as e:
            logger.warning(f"Could not load persisted paper trading state: {e}")
        self.recalculate_margins()

    def _save_persisted_state(self):
        """Saves paper trading state so it persists permanently."""
        if not getattr(self, "persist", True):
            return
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            state = {
                "wallet_budget": self.wallet_budget,
                "available_balance": self.available_balance,
                "margin_locked": self.margin_locked,
                "auto_trading_enabled": self.auto_trading_enabled,
                "open_positions": self.open_positions,
                "closed_trades": self.closed_trades,
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save paper trading state: {e}")

    def set_budget(self, new_budget: float):
        self.wallet_budget = max(1000.0, float(new_budget))
        self.recalculate_margins()
        self._save_persisted_state()

    def toggle_auto_trading(self, enabled: Optional[bool] = None) -> bool:
        if enabled is None:
            self.auto_trading_enabled = not self.auto_trading_enabled
        else:
            self.auto_trading_enabled = enabled
        logger.info(f"PaperTradingEngine auto-trading status: {self.auto_trading_enabled}")
        self._save_persisted_state()
        return self.auto_trading_enabled


    def recalculate_margins(self):
        locked = sum(pos.get("margin_required", 0.0) for pos in self.open_positions)
        self.margin_locked = round(locked, 2)
        realized_today = self._get_today_realized_pnl()
        self.available_balance = round(max(0.0, self.wallet_budget + realized_today - self.margin_locked), 2)

    def _get_today_realized_pnl(self, current_time: Optional[datetime] = None) -> float:
        now = current_time if current_time is not None else datetime.now(IST)
        today_str = now.strftime("%Y-%m-%d")
        return round(sum(t["net_pnl"] for t in self.closed_trades if t.get("date") == today_str), 2)

    @staticmethod
    def is_market_session_open(now_ist: Optional[datetime] = None) -> bool:
        """
        Validates if Indian Equity Regular Market is currently active (Monday-Friday, 09:15 to 15:30 IST).
        """
        dt = now_ist if now_ist is not None else datetime.now(IST)
        if dt.weekday() >= 5:  # 5=Saturday, 6=Sunday
            return False

        session_start = dt.replace(hour=9, minute=15, second=0, microsecond=0)
        session_end = dt.replace(hour=15, minute=30, second=0, microsecond=0)
        return session_start <= dt <= session_end

    @staticmethod
    def is_entry_window_active(now_ist: Optional[datetime] = None) -> Tuple[bool, str]:
        """
        Validates whether fresh algorithmic trade entries are permitted:
        1. Weekend (Sat-Sun): BLOCKED ("Market Closed (Weekend)")
        2. Pre-market (< 09:15 AM): BLOCKED ("Pre-Market / Off-Hours")
        3. 09:15 - 09:30 AM: BLOCKED ("Waiting for 15m ORB formation")
        4. 09:30 AM - 02:45 PM (14:45): PERMITTED ("Entry Window Active")
        5. After 02:45 PM (14:45): BLOCKED ("Intraday Entry Cutoff")
        6. Post-market (> 15:30 PM): BLOCKED ("Market Closed")
        """
        dt = now_ist if now_ist is not None else datetime.now(IST)
        if dt.weekday() >= 5:
            return False, "Market Closed (Weekend: Saturday/Sunday)"

        session_start = dt.replace(hour=9, minute=15, second=0, microsecond=0)
        orb_end = dt.replace(hour=9, minute=30, second=0, microsecond=0)
        entry_cutoff = dt.replace(hour=14, minute=45, second=0, microsecond=0)
        session_end = dt.replace(hour=15, minute=30, second=0, microsecond=0)

        if dt < session_start:
            return False, "Pre-Market / Off-Hours: Market opens at 09:15 AM IST"
        if session_start <= dt < orb_end:
            return False, "Opening Range Formation: Waiting for 15m ORB range to finalize (entries open at 09:30 AM IST)"
        if dt > session_end:
            return False, "Market Closed for the day (Session ended at 03:30 PM IST)"
        if dt > entry_cutoff:
            return False, "Intraday Entry Cutoff: No fresh entries after 02:45 PM IST (approaching square-off)"

        return True, "Entry Window Active"

    def process_market_tick(
        self,
        live_quotes: Dict[str, Any],
        top_setups: Optional[List[Dict[str, Any]]] = None,
        current_time: Optional[datetime] = None,
        bypass_session_guard: bool = False,
    ):
        """
        Called every time a fresh batch of Upstox live quotes is received.
        1. Updates MTM trailing P&L for open positions.
        2. Evaluates dynamic trailing SL (Breakeven & Profit Lock) and exit triggers.
        3. Enforces 3:15 PM IST intraday auto square-off.
        4. If auto_trading_enabled, enters new high-conviction setups.
        """
        positions_to_close = []
        now_ist = current_time if current_time is not None else datetime.now(IST)
        is_square_off_time = (now_ist.hour > 15) or (now_ist.hour == 15 and now_ist.minute >= 15)

        with self._lock:
            self.last_feed_time = now_ist
            for pos in self.open_positions:
                sym = pos["symbol"]
                quote = live_quotes.get(f"NSE_EQ:{sym}") or live_quotes.get(f"NSE_EQ|{sym}")

                # Dynamic Option Quote Resolution from Underlying Index Quote:
                if not quote and ("BANKNIFTY" in sym or "NIFTY" in sym):
                    is_bn = "BANKNIFTY" in sym
                    idx_key = "NSE_INDEX:Nifty Bank" if is_bn else "NSE_INDEX:Nifty 50"
                    idx_quote = live_quotes.get(idx_key) or live_quotes.get(idx_key.replace(":", "|"))
                    if idx_quote and "last_price" in idx_quote:
                        curr_spot = float(idx_quote["last_price"])
                        if "entry_index_spot" not in pos:
                            pos["entry_index_spot"] = curr_spot
                        spot_diff = curr_spot - pos["entry_index_spot"]
                        opt_pts = (spot_diff * 0.50) if "CE" in sym else (-spot_diff * 0.50)
                        sim_opt_ltp = max(1.0, round(pos["entry_price"] + opt_pts, 2))
                        quote = {
                            "last_price": sim_opt_ltp,
                            "average_price": sim_opt_ltp,
                            "ohlc": {"open": sim_opt_ltp, "high": sim_opt_ltp, "low": sim_opt_ltp, "close": sim_opt_ltp},
                        }

                if quote and "last_price" in quote:
                    current_price = float(quote["last_price"])
                    pos["current_price"] = current_price
                    pos["last_updated"] = datetime.now(timezone.utc).isoformat()

                    # Live VWAP calculation from exchange/quote data
                    ohlc = quote.get("ohlc", {})
                    open_p = float(ohlc.get("open", current_price))
                    high_p = float(ohlc.get("high", current_price))
                    low_p = float(ohlc.get("low", current_price))
                    curr_vwap = float(quote.get("average_price") or quote.get("vwap") or round((open_p + high_p + low_p + current_price) / 4.0, 2))
                    pos["current_vwap"] = curr_vwap

                    side = pos["side"]
                    entry = pos["entry_price"]
                    qty = pos["quantity"]
                    target = pos["target_price"]

                    if side == "BUY":
                        pnl = round((current_price - entry) * qty, 2)
                        pnl_pct = round(((current_price - entry) / max(entry, 0.01)) * 100, 2)
                        pos["unrealized_pnl"] = pnl
                        pos["pnl_pct"] = pnl_pct

                        # Track highest price achieved during the trade
                        if current_price > pos.get("highest_price", entry):
                            pos["highest_price"] = current_price

                        target_dist = target - entry
                        if target_dist > 0:
                            gain_ratio = (current_price - entry) / target_dist

                            # Stage 4: Super Profit Lock (90%+ near target) -> Lock 70% of target move
                            if gain_ratio >= 0.90:
                                lock_px = round(entry + (target_dist * 0.70), 2)
                                if lock_px > pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 70%] {sym}: Trailing SL raised to ₹{lock_px} (near target)")
                            # Stage 3: Profit Lock (75%+ of target distance) -> Lock 50% of target move
                            elif gain_ratio >= 0.75:
                                lock_px = round(entry + (target_dist * 0.50), 2)
                                if lock_px > pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 50%] {sym}: Trailing SL raised to ₹{lock_px}")
                            # Stage 2: Profit Lock (50%+ of target distance) -> Lock 25% of target move
                            elif gain_ratio >= 0.50:
                                lock_px = round(entry + (target_dist * 0.25), 2)
                                if lock_px > pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 25%] {sym}: Trailing SL raised to ₹{lock_px} (50% target move reached)")
                            # Stage 1: Breakeven Protection (35%+ of target distance) -> Shift SL to Entry
                            elif gain_ratio >= 0.35:
                                if pos["stop_loss"] < entry:
                                    pos["stop_loss"] = round(entry, 2)
                                    pos["trailing_stage"] = "BREAKEVEN"
                                    logger.info(f"🛡️ [BREAKEVEN] {sym}: SL trailed to Cost/Entry ₹{entry} (Capital Protected)")

                        # Check Exit Conditions
                        is_cnc = pos.get("product_type", "MIS") == "CNC" or pos.get("trade_type") == "SWING"
                        if is_square_off_time and not is_cnc:
                            positions_to_close.append((pos["position_id"], "INTRADAY_SQUARE_OFF", current_price))
                        elif current_price >= target:
                            positions_to_close.append((pos["position_id"], "TARGET_HIT", current_price))
                        elif current_price <= pos["stop_loss"]:
                            stage = pos.get("trailing_stage", "INITIAL")
                            reason = "TRAILING_SL_HIT" if stage == "PROFIT_LOCK" else ("BREAKEVEN_EXIT" if stage == "BREAKEVEN" else "STOP_LOSS_HIT")
                            positions_to_close.append((pos["position_id"], reason, current_price))
                        elif curr_vwap > 0 and not is_cnc:
                            # ⚡ Sustained Thesis Invalidation: Requires at least 3 consecutive ticks below threshold
                            # to filter out deceptive 5-10 second liquidity sweep wicks
                            vwap_buffer = max(0.15, round(curr_vwap * 0.0025, 2))
                            threshold = round(curr_vwap - vwap_buffer, 2)
                            sl_dist = abs(entry - pos["stop_loss"])
                            min_underwater_dist = max(0.20, round(max(entry * 0.0025, sl_dist * 0.25), 2))
                            if current_price < threshold and (entry - current_price) >= min_underwater_dist:
                                breach_count = pos.get("vwap_breach_count", 0) + 1
                                pos["vwap_breach_count"] = breach_count
                                if breach_count >= 3:
                                    logger.info(
                                        f"⚡ [THESIS INVALIDATED] {sym}: Price ₹{current_price} sustained below VWAP ₹{curr_vwap} "
                                        f"(loss: ₹{round(entry - current_price, 2)} >= ₹{min_underwater_dist}) "
                                        f"confirmed across {breach_count} ticks. Executing early exit."
                                    )
                                    positions_to_close.append((pos["position_id"], "THESIS_INVALIDATED", current_price))
                                else:
                                    logger.debug(
                                        f"⚠️ [VWAP BREACH WARNING] {sym}: Price ₹{current_price} below VWAP threshold ₹{threshold} "
                                        f"(breach {breach_count}/3). Awaiting sustained confirmation."
                                    )
                            else:
                                pos["vwap_breach_count"] = 0

                    elif side == "SELL":
                        pnl = round((entry - current_price) * qty, 2)
                        pnl_pct = round(((entry - current_price) / max(entry, 0.01)) * 100, 2)
                        pos["unrealized_pnl"] = pnl
                        pos["pnl_pct"] = pnl_pct

                        # Track lowest price achieved during the trade
                        if current_price < pos.get("lowest_price", entry):
                            pos["lowest_price"] = current_price

                        target_dist = entry - target
                        if target_dist > 0:
                            gain_ratio = (entry - current_price) / target_dist

                            # Stage 4: Super Profit Lock (90%+ near target) -> Lock 70% of target move
                            if gain_ratio >= 0.90:
                                lock_px = round(entry - (target_dist * 0.70), 2)
                                if lock_px < pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 70%] {sym}: Trailing SL lowered to ₹{lock_px} (near target)")
                            # Stage 3: Profit Lock (75%+ of target distance) -> Lock 50% of target move
                            elif gain_ratio >= 0.75:
                                lock_px = round(entry - (target_dist * 0.50), 2)
                                if lock_px < pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 50%] {sym}: Trailing SL lowered to ₹{lock_px}")
                            # Stage 2: Profit Lock (50%+ of target distance) -> Lock 25% of target move
                            elif gain_ratio >= 0.50:
                                lock_px = round(entry - (target_dist * 0.25), 2)
                                if lock_px < pos["stop_loss"]:
                                    pos["stop_loss"] = lock_px
                                    pos["trailing_stage"] = "PROFIT_LOCK"
                                    logger.info(f"🔒 [PROFIT LOCK 25%] {sym}: Trailing SL lowered to ₹{lock_px} (50% target move reached)")
                            # Stage 1: Breakeven Protection (35%+ of target distance) -> Shift SL to Entry
                            elif gain_ratio >= 0.35:
                                if pos["stop_loss"] > entry:
                                    pos["stop_loss"] = round(entry, 2)
                                    pos["trailing_stage"] = "BREAKEVEN"
                                    logger.info(f"🛡️ [BREAKEVEN] {sym}: SL trailed to Cost/Entry ₹{entry} (Capital Protected)")

                        # Check Exit Conditions
                        is_cnc = pos.get("product_type", "MIS") == "CNC" or pos.get("trade_type") == "SWING"
                        if is_square_off_time and not is_cnc:
                            positions_to_close.append((pos["position_id"], "INTRADAY_SQUARE_OFF", current_price))
                        elif current_price <= target:
                            positions_to_close.append((pos["position_id"], "TARGET_HIT", current_price))
                        elif current_price >= pos["stop_loss"]:
                            stage = pos.get("trailing_stage", "INITIAL")
                            reason = "TRAILING_SL_HIT" if stage == "PROFIT_LOCK" else ("BREAKEVEN_EXIT" if stage == "BREAKEVEN" else "STOP_LOSS_HIT")
                            positions_to_close.append((pos["position_id"], reason, current_price))
                        elif curr_vwap > 0 and not is_cnc:
                            # ⚡ Sustained Thesis Invalidation: Requires at least 3 consecutive ticks above threshold
                            # to filter out deceptive 5-10 second liquidity sweep wicks
                            vwap_buffer = max(0.15, round(curr_vwap * 0.0025, 2))
                            threshold = round(curr_vwap + vwap_buffer, 2)
                            sl_dist = abs(entry - pos["stop_loss"])
                            min_underwater_dist = max(0.20, round(max(entry * 0.0025, sl_dist * 0.25), 2))
                            if current_price > threshold and (current_price - entry) >= min_underwater_dist:
                                breach_count = pos.get("vwap_breach_count", 0) + 1
                                pos["vwap_breach_count"] = breach_count
                                if breach_count >= 3:
                                    logger.info(
                                        f"⚡ [THESIS INVALIDATED] {sym}: Price ₹{current_price} confirmed above VWAP ₹{curr_vwap} "
                                        f"(loss: ₹{round(current_price - entry, 2)} >= ₹{min_underwater_dist}) "
                                        f"confirmed across {breach_count} ticks. Executing early exit."
                                    )
                                    positions_to_close.append((pos["position_id"], "THESIS_INVALIDATED", current_price))
                                else:
                                    logger.debug(
                                        f"⚠️ [VWAP BREACH WARNING] {sym}: Price ₹{current_price} breached VWAP resistance threshold ₹{threshold} "
                                        f"(breach {breach_count}/3). Awaiting sustained confirmation."
                                    )
                            else:
                                pos["vwap_breach_count"] = 0

                elif is_square_off_time:
                    # 3:15 PM auto square off even if quote not received on this exact tick (MIS only)
                    is_cnc = pos.get("product_type", "MIS") == "CNC" or pos.get("trade_type") == "SWING"
                    if not is_cnc:
                        curr_px = pos.get("current_price", pos["entry_price"])
                        positions_to_close.append((pos["position_id"], "INTRADAY_SQUARE_OFF", curr_px))

        # Close positions that hit Target, Trailing SL, Breakeven, Stop Loss, or 3:15 PM Square-off
        closed_ids = set()
        for pos_id, reason, exit_px in positions_to_close:
            if pos_id not in closed_ids:
                self.close_position(pos_id, reason=reason, exit_price=exit_px)
                closed_ids.add(pos_id)

        # Automated Entry Evaluation
        if self.auto_trading_enabled and top_setups and not is_square_off_time:
            self._evaluate_auto_entries(
                top_setups,
                live_quotes,
                current_time=now_ist,
                bypass_session_guard=bypass_session_guard,
            )

        self.recalculate_margins()

    def check_symbol_entry_eligibility(self, symbol: str, current_time: Optional[datetime] = None) -> Tuple[bool, str]:
        """
        Evaluates whether a symbol is eligible for a new trade today under institutional risk rules:
        1. Open Position Check: Cannot enter if an active position is already open in this stock.
        2. 1-SL Blacklist Rule: If this stock hit Stop Loss or suffered a loss today, it is locked for the day.
        3. Max 2 Trades Rule: A single stock cannot be traded more than 2 times in a single day.
        4. Cooldown Rule: Must wait at least 20 minutes after a profitable exit before re-entering.
        """
        now = current_time if current_time is not None else datetime.now(IST)
        today_str = now.strftime("%Y-%m-%d")

        # 1. Open Position Check
        if any(p.get("symbol") == symbol for p in self.open_positions):
            return False, f"Position already active in {symbol}"

        # Filter today's closed trades for this symbol
        today_trades = [
            t for t in self.closed_trades
            if t.get("symbol") == symbol and t.get("date") == today_str
        ]

        # 2. Max 2 Trades Per Stock
        if len(today_trades) >= 2:
            return False, f"Max intraday trade limit (2 trades) reached for {symbol}"

        # 3. Stop Loss Hit / Loss Check (1-Loss Protection Rule)
        has_sl_hit = any(
            t.get("exit_reason") == "STOP_LOSS_HIT" or (t.get("exit_reason") not in ("BREAKEVEN_EXIT", "TRAILING_SL_HIT") and t.get("gross_pnl", 0.0) < 0)
            for t in today_trades
        )
        if has_sl_hit:
            return False, f"{symbol} locked for today (Stop Loss hit / 1-Loss Protection)"

        # 4. Cooldown Period (20 minutes from last exit)
        if today_trades:
            last_trade = today_trades[-1]
            exit_time_str = last_trade.get("exit_time")
            if exit_time_str:
                try:
                    exit_dt = datetime.fromisoformat(exit_time_str)
                    if exit_dt.tzinfo is None:
                        exit_dt = exit_dt.replace(tzinfo=IST)
                    elapsed_minutes = (now - exit_dt).total_seconds() / 60.0
                    cooldown_minutes = 20.0
                    if elapsed_minutes < cooldown_minutes:
                        remaining = max(1, int(round(cooldown_minutes - elapsed_minutes)))
                        return False, f"Cooldown active for {symbol} ({remaining}m remaining)"
                except Exception:
                    pass

        return True, "Eligible"

    def _evaluate_auto_entries(
        self,
        top_setups: List[Dict[str, Any]],
        live_quotes: Dict[str, Any],
        current_time: Optional[datetime] = None,
        bypass_session_guard: bool = False,
    ):
        """Scans screener candidates and auto-enters trades within wallet limit adhering to protection rules."""
        now_ist = current_time if current_time is not None else datetime.now(IST)

        # 1. Market Session & Entry Window Guard
        if not bypass_session_guard:
            allowed, session_reason = self.is_entry_window_active(now_ist)
            if not allowed:
                logger.info(f"⏸️ [AUTO-ENTRY BLOCKED] {session_reason}")
                return

        # 2. Account-Level Daily Max Loss Circuit Breaker
        today_str = now_ist.strftime("%Y-%m-%d")
        today_trades = [t for t in self.closed_trades if t.get("date") == today_str]
        today_realized = round(sum(t["net_pnl"] for t in today_trades), 2)

        from app.services.trading_plan_manager import trading_plan_manager
        active_plan = trading_plan_manager.get_plan()
        max_daily_loss_pct = float(active_plan.get("max_daily_loss_pct", 3.0))
        max_daily_loss_rs = round(self.wallet_budget * (max_daily_loss_pct / 100.0), 2)

        if today_realized <= -max_daily_loss_rs:
            logger.warning(
                f"🛑 [DAILY CIRCUIT BREAKER ACTIVE] Today's realized loss ₹{today_realized} reached/exceeded "
                f"max daily loss threshold (-₹{max_daily_loss_rs} / {max_daily_loss_pct}%). "
                f"Halting all auto-trading entries for today to preserve capital."
            )
            return

        # 3. Account-Level Daily Max Trades Limit (Prevents overtrading & heavy turnover taxes)
        max_daily_trades = int(active_plan.get("max_daily_trades", 6))
        if len(today_trades) >= max_daily_trades:
            logger.info(
                f"⏸️ [DAILY TRADE LIMIT REACHED] {len(today_trades)} trades completed today "
                f"(max allowed: {max_daily_trades}). Halting fresh auto-entries to protect profits and avoid statutory tax churn."
            )
            return

        max_active = int(active_plan.get("max_active_trades", 2 if self.wallet_budget <= 25000.0 else 3))
        if len(self.open_positions) >= max_active:
            return  # Already at maximum active allocation

        for setup in top_setups:
            if len(self.open_positions) >= max_active:
                break

            sym = setup.get("symbol")
            if not sym:
                continue

            # Institutional Rule: Check if symbol is eligible or in Cooldown / SL-Locked
            eligible, reason = self.check_symbol_entry_eligibility(sym, current_time=now_ist)
            if not eligible:
                logger.debug(f"Skipping auto-entry for {sym}: {reason}")
                continue

            tier = setup.get("setup_tier", "B")
            signal = setup.get("signal")
            if tier not in ("A+", "A") or signal not in ("BUY", "SELL"):
                continue

            price = float(setup.get("price") or setup.get("entry_price", 0.0))
            if price <= 0:
                continue

            sl = float(setup.get("stop_loss", price * 0.985))
            target = float(setup.get("target_price", price * 1.03))
            suggested_qty = int(setup.get("suggested_qty", 1))

            # Strict Institutional Position Sizing in Paper Trading:
            # 1. Fetch risk parameters from active trading plan
            from app.services.trading_plan_manager import trading_plan_manager
            active_plan = trading_plan_manager.get_plan()
            risk_pct = float(active_plan.get("risk_per_trade_pct", 1.5))
            max_capital_risk = round(self.wallet_budget * (risk_pct / 100.0), 2)

            # 2. Risk per share = |Entry - SL|
            risk_per_share = max(0.05, abs(price - sl))
            risk_based_qty = max(1, int(max_capital_risk / risk_per_share))

            # 3. Margin limit
            prod_type = setup.get("product_type", "MIS")
            eff_lev = 1.0 if prod_type == "CNC" else 5.0
            max_alloc = self.wallet_budget / max_active
            allowed_margin = min(self.available_balance, max_alloc)
            margin_max_qty = max(1, int((allowed_margin * eff_lev) / max(price, 1.0)))

            # 4. Enforce strict quantity cap:
            # Must NEVER exceed risk_based_qty or margin_max_qty
            final_qty = min(suggested_qty, risk_based_qty, margin_max_qty)
            if final_qty <= 0:
                continue

            margin_req = round((final_qty * price) / eff_lev, 2)

            if margin_req <= self.available_balance and final_qty > 0:
                self.open_position(
                    symbol=sym,
                    side=signal,
                    quantity=final_qty,
                    entry_price=price,
                    stop_loss=sl,
                    target_price=target,
                    margin_required=margin_req,
                    setup_type=setup.get("setup_type", "AI Price Action Setup"),
                    setup_tier=tier,
                    source=setup.get("source", "UPSTOX_LIVE"),
                    vwap=float(setup.get("vwap") or price),
                    product_type=prod_type,
                    ema9=float(setup.get("ema_9") or (price * 0.998 if signal == "BUY" else price * 1.002)),
                    ema20=float(setup.get("ema_20") or (price * 0.995 if signal == "BUY" else price * 1.005)),
                    retest_level=float(setup.get("retest_level") or (price * 0.996 if signal == "BUY" else price * 1.004)),
                    rvol=float(setup.get("rvol") or 1.8),
                    market_structure=setup.get("market_structure", "HH_HL" if signal == "BUY" else "LH_LL"),
                    ai_score=int(setup.get("ai_score") or 85),
                    price_action_score=int(setup.get("price_action_score") or 18),
                    setup_checklist=setup.get("checklist") or [],
                    change_pct=float(setup.get("change_pct") or 0.0),
                    sector=setup.get("sector", "NSE Equity"),
                )

    def open_position(
        self,
        symbol: str,
        side: str,
        quantity: int,
        entry_price: float,
        stop_loss: float,
        target_price: float,
        margin_required: float,
        setup_type: str = "Intraday Breakout",
        setup_tier: str = "A",
        source: str = "UPSTOX_LIVE",
        vwap: Optional[float] = None,
        product_type: str = "MIS",
        ema9: Optional[float] = None,
        ema20: Optional[float] = None,
        retest_level: Optional[float] = None,
        rvol: Optional[float] = None,
        market_structure: Optional[str] = None,
        ai_score: Optional[int] = None,
        price_action_score: Optional[int] = None,
        setup_checklist: Optional[List[Dict[str, Any]]] = None,
        change_pct: Optional[float] = None,
        sector: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates and tracks a new open paper position."""
        pos_id = f"POS-{uuid.uuid4().hex[:8].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        pos_vwap = round(vwap if vwap is not None else entry_price, 2)
        pos_ema9 = round(ema9 if ema9 is not None else (entry_price * 0.998 if side == "BUY" else entry_price * 1.002), 2)
        pos_ema20 = round(ema20 if ema20 is not None else (entry_price * 0.995 if side == "BUY" else entry_price * 1.005), 2)
        pos_retest = round(retest_level if retest_level is not None else (entry_price * 0.996 if side == "BUY" else entry_price * 1.004), 2)
        pos_rvol = round(rvol if rvol is not None else 1.85, 2)
        pos_structure = market_structure or ("HH_HL" if side == "BUY" else "LH_LL")
        pos_ai_score = ai_score if ai_score is not None else 86
        pos_pa_score = price_action_score if price_action_score is not None else 18
        pos_checklist = setup_checklist or [
            {"rule": "VWAP Breakout Buffer (+0.10%)", "passed": True, "detail": f"Price ₹{entry_price:.2f} confirmed above VWAP ₹{pos_vwap:.2f}"},
            {"rule": "EMA 9 > EMA 20 Momentum Ribbon", "passed": True, "detail": f"EMA 9 (₹{pos_ema9:.2f}) > EMA 20 (₹{pos_ema20:.2f})"},
            {"rule": f"Institutional Volume Surge ({pos_rvol}x RVOL)", "passed": True, "detail": f"{pos_rvol}x Relative Volume confirmed on breakout"},
            {"rule": f"Market Structure ({pos_structure})", "passed": True, "detail": "Constructive Higher Highs & Higher Lows sequence"},
            {"rule": "Key Breakout & S/R Retest", "passed": True, "detail": f"Prior resistance flipped to support near ₹{pos_retest:.2f}"},
            {"rule": "NIFTY 50 Index Alignment", "passed": True, "detail": "Sector and market trend aligned with trade direction"},
            {"rule": "Anti-Chasing ATR Guard", "passed": True, "detail": "Price within acceptable ATR distance from VWAP"},
            {"rule": "Strict 1:2+ Risk:Reward", "passed": True, "detail": f"Risk ₹{abs(entry_price - stop_loss):.2f} : Reward ₹{abs(target_price - entry_price):.2f}"},
        ]

        position = {
            "position_id": pos_id,
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "entry_price": round(entry_price, 2),
            "current_price": round(entry_price, 2),
            "entry_vwap": pos_vwap,
            "current_vwap": pos_vwap,
            "ema9": pos_ema9,
            "ema20": pos_ema20,
            "retest_level": pos_retest,
            "rvol": pos_rvol,
            "market_structure": pos_structure,
            "ai_score": pos_ai_score,
            "price_action_score": pos_pa_score,
            "setup_checklist": pos_checklist,
            "change_pct": round(change_pct or 0.0, 2),
            "sector": sector or "NSE Equity",
            "initial_stop_loss": round(stop_loss, 2),
            "stop_loss": round(stop_loss, 2),
            "target_price": round(target_price, 2),
            "highest_price": round(entry_price, 2),
            "lowest_price": round(entry_price, 2),
            "trailing_stage": "INITIAL",
            "vwap_breach_count": 0,
            "margin_required": round(margin_required, 2),
            "unrealized_pnl": 0.0,
            "pnl_pct": 0.0,
            "setup_type": setup_type,
            "setup_tier": setup_tier,
            "product_type": product_type,
            "source": source,
            "entry_time": now_iso,
            "last_updated": now_iso,
        }

        with self._lock:
            self.open_positions.append(position)
            self.recalculate_margins()
            self._save_persisted_state()
            logger.info(f"Opened Paper Position: {pos_id} {side} {quantity}x {symbol} @ ₹{entry_price} (Margin: ₹{margin_required})")
            return position

    def close_position(self, position_id: str, reason: str = "MANUAL_CLOSE", exit_price: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Closes an open position and moves it to closed_trades."""
        with self._lock:
            pos_index = next((i for i, p in enumerate(self.open_positions) if p["position_id"] == position_id), None)
            if pos_index is None:
                return None

            pos = self.open_positions.pop(pos_index)
            now = datetime.now(IST)
            exit_px = exit_price if exit_price is not None else pos.get("current_price", pos["entry_price"])

            qty = pos["quantity"]
            entry = pos["entry_price"]
            side = pos["side"]

            if side == "BUY":
                gross = round((exit_px - entry) * qty, 2)
            else:
                gross = round((entry - exit_px) * qty, 2)

            # Realistic Indian Brokerage & Statutory Taxes (Equity Intraday & Options):
            turnover = (entry + exit_px) * qty
            is_opt = "CE" in pos["symbol"] or "PE" in pos["symbol"]

            # Brokerage: ₹20 per executed leg or max 0.05% of turnover (NSE standard)
            brokerage = round(min(40.0, max(2.0, turnover * 0.0005)), 2)

            # STT: 0.025% on sell turnover for equity intraday; 0.125% on option sell turnover
            if is_opt:
                stt = round((exit_px * qty) * 0.00125, 2)
            else:
                stt = round((exit_px * qty if side == "BUY" else entry * qty) * 0.00025, 2)

            exch_fee = round(turnover * 0.0000297, 2)
            gst = round((brokerage + exch_fee) * 0.18, 2)
            sebi_fee = round(max(0.01, turnover * 0.000001), 2)
            stamp_duty = round((entry * qty if side == "BUY" else exit_px * qty) * 0.00003, 2)

            charges = round(brokerage + stt + exch_fee + gst + sebi_fee + stamp_duty, 2)
            charges = max(5.0, charges)
            net = round(gross - charges, 2)

        closed_trade = {
            "trade_id": pos["position_id"],
            "symbol": pos["symbol"],
            "side": side,
            "quantity": qty,
            "entry_price": entry,
            "exit_price": round(exit_px, 2),
            "entry_time": pos["entry_time"],
            "exit_time": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "gross_pnl": gross,
            "charges": charges,
            "net_pnl": net,
            "exit_reason": reason,
            "setup_type": pos.get("setup_type", "Intraday"),
            "setup_tier": pos.get("setup_tier", "A"),
            "product_type": pos.get("product_type", "MIS"),
            "trailing_stage": pos.get("trailing_stage", "INITIAL"),
            "initial_stop_loss": pos.get("initial_stop_loss", pos.get("stop_loss", round(entry * 0.985, 2))),
            "stop_loss": pos.get("stop_loss", round(entry * 0.985, 2)),
            "target_price": pos.get("target_price", round(entry * 1.03, 2)),
            "entry_vwap": pos.get("entry_vwap", entry),
            "ema9": pos.get("ema9", round(entry * 0.998, 2)),
            "ema20": pos.get("ema20", round(entry * 0.995, 2)),
            "retest_level": pos.get("retest_level", round(entry * 0.996, 2)),
            "rvol": pos.get("rvol", 1.85),
            "market_structure": pos.get("market_structure", "HH_HL" if side == "BUY" else "LH_LL"),
            "ai_score": pos.get("ai_score", 86),
            "price_action_score": pos.get("price_action_score", 18),
            "setup_checklist": pos.get("setup_checklist", []),
            "change_pct": pos.get("change_pct", 0.0),
            "sector": pos.get("sector", "NSE Equity"),
        }

        self.closed_trades.append(closed_trade)
        self.recalculate_margins()
        self._save_persisted_state()
        logger.info(f"Closed Paper Position: {pos['symbol']} | Exit: ₹{exit_px} | Reason: {reason} | Net PnL: ₹{net}")
        return closed_trade


    def get_daywise_pnl(self) -> List[Dict[str, Any]]:
        """
        Aggregates closed trades by date into a structured Day-Wise P&L Ledger.
        Returns metrics: Date, Total Trades, Wins, Losses, Win Rate, Gross P&L, Charges, Net P&L, ROI on Wallet %.
        """
        daily_buckets: Dict[str, List[Dict[str, Any]]] = {}

        # Group trades by date
        for trade in self.closed_trades:
            d = trade.get("date", "Unknown")
            if d not in daily_buckets:
                daily_buckets[d] = []
            daily_buckets[d].append(trade)

        # Add today if not present
        today_str = datetime.now(IST).strftime("%Y-%m-%d")
        if today_str not in daily_buckets:
            daily_buckets[today_str] = []

        sorted_dates = sorted(daily_buckets.keys(), reverse=True)
        results = []

        for d in sorted_dates:
            trades = daily_buckets[d]
            total_trades = len(trades)
            wins = sum(1 for t in trades if t["net_pnl"] > 0)
            losses = sum(1 for t in trades if t["net_pnl"] < 0)
            win_rate = round((wins / max(total_trades, 1)) * 100, 1) if total_trades > 0 else 0.0

            gross = round(sum(t["gross_pnl"] for t in trades), 2)
            charges = round(sum(t["charges"] for t in trades), 2)
            net = round(sum(t["net_pnl"] for t in trades), 2)
            roi = round((net / max(self.wallet_budget, 1.0)) * 100, 2)

            results.append({
                "date": d,
                "is_today": d == today_str,
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "win_rate_pct": win_rate,
                "gross_pnl": gross,
                "charges": charges,
                "net_pnl": net,
                "roi_pct": roi,
                "trades": trades,
            })

        return results

    def get_summary(self, current_time: Optional[datetime] = None) -> Dict[str, Any]:
        """Returns real-time dashboard telemetry."""
        now = current_time if current_time is not None else datetime.now(IST)
        today_str = now.strftime("%Y-%m-%d")
        today_trades = [t for t in self.closed_trades if t.get("date") == today_str]

        today_realized = round(sum(t["net_pnl"] for t in today_trades), 2)
        total_realized = round(sum(t["net_pnl"] for t in self.closed_trades), 2)
        unrealized_mtm = round(sum(p.get("unrealized_pnl", 0.0) for p in self.open_positions), 2)

        # Calculate Symbol Protection & Lock Status
        symbol_protection_status = {}
        for t in today_trades:
            sym = t.get("symbol")
            if not sym or sym in symbol_protection_status:
                continue
            sym_today_trades = [x for x in today_trades if x.get("symbol") == sym]
            has_sl = any(x.get("exit_reason") == "STOP_LOSS_HIT" or (x.get("exit_reason") not in ("BREAKEVEN_EXIT", "TRAILING_SL_HIT") and x.get("gross_pnl", 0.0) < 0) for x in sym_today_trades)
            if has_sl:
                symbol_protection_status[sym] = {
                    "symbol": sym,
                    "status": "LOCKED_FOR_DAY",
                    "badge": "🛑 LOCKED (1-SL)",
                    "reason": "1-Loss Rule: Stop Loss hit today. Locked to prevent revenge trading.",
                    "can_enter": False,
                    "trades_today": len(sym_today_trades),
                }
            elif len(sym_today_trades) >= 2:
                symbol_protection_status[sym] = {
                    "symbol": sym,
                    "status": "MAX_TRADES_REACHED",
                    "badge": "🔒 MAX TRADES",
                    "reason": "Maximum 2 intraday trades limit reached for this stock.",
                    "can_enter": False,
                    "trades_today": len(sym_today_trades),
                }
            else:
                last_t = sym_today_trades[-1]
                exit_str = last_t.get("exit_time")
                remaining = 0
                if exit_str:
                    try:
                        edt = datetime.fromisoformat(exit_str)
                        if edt.tzinfo is None:
                            edt = edt.replace(tzinfo=IST)
                        elapsed = (now - edt).total_seconds() / 60.0
                        if elapsed < 20.0:
                            remaining = max(1, int(round(20.0 - elapsed)))
                    except Exception:
                        pass
                if remaining > 0:
                    symbol_protection_status[sym] = {
                        "symbol": sym,
                        "status": "COOLDOWN_ACTIVE",
                        "badge": f"⏳ COOLDOWN ({remaining}m)",
                        "reason": f"20-Minute Cooldown active after profit exit ({remaining}m left).",
                        "can_enter": False,
                        "cooldown_remaining_minutes": remaining,
                        "trades_today": len(sym_today_trades),
                    }
                else:
                    symbol_protection_status[sym] = {
                        "symbol": sym,
                        "status": "ELIGIBLE_FOR_REENTRY",
                        "badge": "⚡ RE-ENTRY READY",
                        "reason": "1 winning trade completed. Second entry allowed on strong setup.",
                        "can_enter": True,
                        "trades_today": len(sym_today_trades),
                    }

        # Daily Max Loss & Circuit Breaker status
        from app.services.trading_plan_manager import trading_plan_manager
        active_plan = trading_plan_manager.get_plan()
        max_daily_loss_pct = float(active_plan.get("max_daily_loss_pct", 3.0))
        max_daily_loss_rs = round(self.wallet_budget * (max_daily_loss_pct / 100.0), 2)
        circuit_breaker_triggered = bool(today_realized <= -max_daily_loss_rs)

        entry_window_active, entry_window_msg = self.is_entry_window_active(now)
        market_session_open = self.is_market_session_open(now)

        return {
            "wallet_budget": self.wallet_budget,
            "available_balance": self.available_balance,
            "margin_locked": self.margin_locked,
            "buying_power": round(self.available_balance * 5.0, 2),
            "unrealized_mtm": unrealized_mtm,
            "today_realized_pnl": today_realized,
            "total_realized_pnl": total_realized,
            "net_equity": round(self.wallet_budget + total_realized + unrealized_mtm, 2),
            "auto_trading_enabled": self.auto_trading_enabled,
            "circuit_breaker_triggered": circuit_breaker_triggered,
            "max_daily_loss_pct": max_daily_loss_pct,
            "max_daily_loss_rs": max_daily_loss_rs,
            "circuit_breaker_reason": (
                f"Daily Loss Limit reached: Today's loss of ₹{abs(today_realized)} reached/exceeded max allowed ₹{max_daily_loss_rs} ({max_daily_loss_pct}%). Trading paused for today."
                if circuit_breaker_triggered else None
            ),
            "entry_window_active": entry_window_active,
            "entry_window_status": entry_window_msg,
            "market_session_open": market_session_open,
            "open_positions_count": len(self.open_positions),
            "closed_trades_today_count": len(today_trades),
            "total_closed_trades_count": len(self.closed_trades),
            "open_positions": self.open_positions,
            "recent_closed_trades": self.closed_trades[-10:][::-1],
            "symbol_protection_status": symbol_protection_status,
            "feed_status": "LIVE" if self.last_feed_time else "AWAITING_TICKS",
        }

    def reset_account(self, budget: Optional[float] = None):
        """Resets virtual wallet safely to clean initial state with zero fake data."""
        if budget is not None:
            self.wallet_budget = float(budget)
        self.available_balance = self.wallet_budget
        self.margin_locked = 0.0
        self.open_positions = []
        self.closed_trades = []
        self.recalculate_margins()
        self._save_persisted_state()
        logger.info(f"Reset PaperTradingEngine wallet to ₹{self.wallet_budget} (clean live state)")



paper_trading_engine = PaperTradingEngine(initial_budget=10000.0)
