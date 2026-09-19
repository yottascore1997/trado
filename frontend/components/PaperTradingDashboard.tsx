"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  Activity,
  Calendar,
  RefreshCw,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sliders,
  Award,
} from "lucide-react";

interface OpenPosition {
  position_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  current_price: number;
  initial_stop_loss?: number;
  stop_loss: number;
  target_price: number;
  highest_price?: number;
  lowest_price?: number;
  trailing_stage?: string;
  margin_required: number;
  unrealized_pnl: number;
  pnl_pct: number;
  setup_type: string;
  setup_tier: string;
  product_type: string;
  source: string;
  entry_time: string;
  last_updated: string;
}

interface ClosedTrade {
  trade_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  date: string;
  gross_pnl: number;
  charges: number;
  net_pnl: number;
  exit_reason: string;
  setup_type: string;
  setup_tier: string;
  trailing_stage?: string;
}

interface DayWiseRecord {
  date: string;
  is_today: boolean;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  gross_pnl: number;
  charges: number;
  net_pnl: number;
  roi_pct: number;
  trades: ClosedTrade[];
}

export const PaperTradingDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>({
    wallet_budget: 10000.0,
    available_balance: 10000.0,
    margin_locked: 0.0,
    buying_power: 50000.0,
    unrealized_mtm: 0.0,
    today_realized_pnl: 0.0,
    total_realized_pnl: 0.0,
    net_equity: 10000.0,
    auto_trading_enabled: true,
    open_positions_count: 0,
    open_positions: [],
    recent_closed_trades: [],
  });

  const [daywiseRecords, setDaywiseRecords] = useState<DayWiseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingAuto, setIsTogglingAuto] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumRes, dayRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/market/paper/summary?_t=${Date.now()}`)),
        fetch(apiUrl(`/api/v1/market/paper/daywise-pnl?_t=${Date.now()}`)),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
      if (dayRes.ok) {
        const dayData = await dayRes.json();
        setDaywiseRecords(dayData);
      }
      setLastSynced(new Date().toLocaleTimeString("en-IN", { hour12: false }));
    } catch (e) {
      console.warn("Failed to fetch paper trading data:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleAuto = async () => {
    try {
      setIsTogglingAuto(true);
      const res = await fetch(apiUrl("/api/v1/market/paper/toggle-auto"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary((prev: any) => ({
          ...prev,
          auto_trading_enabled: data.auto_trading_enabled,
        }));
      }
    } catch (e) {
      console.warn("Failed to toggle auto trading:", e);
    } finally {
      setIsTogglingAuto(false);
    }
  };

  const handleSquareOff = async (positionId: string) => {
    try {
      const res = await fetch(apiUrl("/api/v1/market/paper/close-position"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_id: positionId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.warn("Square off error:", e);
    }
  };

  const handleReset = async () => {
    let currentB = 10000.0;
    try {
      const saved = localStorage.getItem("trado_wallet_budget");
      if (saved) currentB = parseFloat(saved) || currentB;
    } catch (e) {}

    if (!window.confirm(`Reset paper wallet back to ₹${currentB.toLocaleString("en-IN")} clean state?`)) return;
    try {
      const res = await fetch(apiUrl("/api/v1/market/paper/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: currentB }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.warn("Reset error:", e);
    }
  };

  const isAutoArmed = summary.auto_trading_enabled;
  const positions: OpenPosition[] = summary.open_positions || [];

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Auto-Trade Controller */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-slate-100">Automated Paper Trading Engine</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                UPSTOX LIVE FEED
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                0 REAL-MONEY RISK
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live market quotes from Upstox API V2 • Strictly ring-fenced to ₹{summary.wallet_budget?.toLocaleString()} Virtual Wallet.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Auto-Trading Arm/Pause Button */}
          <button
            onClick={handleToggleAuto}
            disabled={isTogglingAuto}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
              isAutoArmed
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }`}
            title={isAutoArmed ? "Click to Pause Auto-Trading" : "Click to Arm Auto-Trading"}
          >
            <Power className={`w-4 h-4 ${isAutoArmed ? "animate-pulse" : ""}`} />
            <span>{isAutoArmed ? "AUTO TRADING: ARMED 🟢" : "AUTO TRADING: PAUSED ⏸️"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh Live Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          {/* Reset Wallet Button */}
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-300 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
            title="Reset Virtual Wallet to ₹10,000"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Daily Circuit Breaker Alert Banner */}
      {summary.circuit_breaker_triggered && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-600/70 flex flex-wrap items-center justify-between gap-2 text-rose-200 text-xs font-mono shadow-lg shadow-rose-950/50">
          <div className="flex items-center gap-2">
            <span className="text-base">🛑</span>
            <span className="font-bold tracking-wide">DAILY CIRCUIT BREAKER ACTIVE:</span>
            <span>{summary.circuit_breaker_reason}</span>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-rose-900 text-rose-200 text-[10px] font-bold uppercase border border-rose-700">
            AUTOTRADE HALTED TODAY
          </span>
        </div>
      )}

      {/* Trading Window & Session Indicator */}
      {summary.entry_window_status && !summary.circuit_breaker_triggered && (
        <div className="px-3.5 py-2 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full inline-block ${summary.entry_window_active ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
            />
            <span className="text-slate-400">Execution Window:</span>
            <span className={summary.entry_window_active ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {summary.entry_window_active ? "ACTIVE (09:30 AM - 02:45 PM IST)" : summary.entry_window_status}
            </span>
          </div>
          <span className="text-slate-500 text-[11px]">
            {summary.market_session_open ? "🟢 NSE Market Open" : "⚪ NSE Regular Market Closed"}
          </span>
        </div>
      )}

      {/* 4 Telemetry Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Virtual Capital */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Virtual Wallet</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
              5x MIS Intraday
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-100 mt-1">
            ₹{summary.wallet_budget?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Avail: ₹{summary.available_balance?.toLocaleString("en-IN")}</span>
            <span className="text-slate-500">Locked: ₹{summary.margin_locked?.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Live Unrealized MTM */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Running MTM (Live)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
              {summary.open_positions_count || 0} Open
            </span>
          </div>
          <div
            className={`text-2xl font-black font-mono mt-1 ${
              summary.unrealized_mtm >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {summary.unrealized_mtm >= 0 ? "+" : ""}₹
            {summary.unrealized_mtm?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Trailing Upstox LTP in Real Time</span>
          </div>
        </div>

        {/* Today's Realized PnL */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Today&apos;s Realized P&L</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
              {summary.closed_trades_today_count || 0} Closed
            </span>
          </div>
          <div
            className={`text-2xl font-black font-mono mt-1 ${
              summary.today_realized_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {summary.today_realized_pnl >= 0 ? "+" : ""}₹
            {summary.today_realized_pnl?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Net of Simulated STT & Taxes</span>
          </div>
        </div>

        {/* Total Net Virtual Equity */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/90 to-cyan-950/20 border border-cyan-800/40">
          <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-300 font-mono font-bold">Total Virtual Equity</span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">
              {lastSynced ? `Synced: ${lastSynced}` : "Live"}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
            ₹{summary.net_equity?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400/80 mt-2 pt-2 border-t border-cyan-800/40">
            <span>All-time Net: ₹{summary.total_realized_pnl?.toLocaleString("en-IN")}</span>
            <span>+{(((summary.net_equity - summary.wallet_budget) / summary.wallet_budget) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Intraday Stock Protection & Re-entry Status Tracker */}
      {summary.symbol_protection_status && Object.keys(summary.symbol_protection_status).length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                Intraday Stock Protection & Re-entry Status
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Rules: 🛑 1-Loss Lock • ⏳ 20m Cooldown • 🔒 Max 2 Trades/Stock
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {Object.values(summary.symbol_protection_status as Record<string, any>).map((st: any) => (
              <div
                key={st.symbol}
                title={st.reason}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                  st.status === "LOCKED_FOR_DAY"
                    ? "bg-rose-950/50 border-rose-800/80 text-rose-300"
                    : st.status === "COOLDOWN_ACTIVE"
                    ? "bg-amber-950/50 border-amber-800/80 text-amber-300"
                    : st.status === "MAX_TRADES_REACHED"
                    ? "bg-slate-950 border-slate-700 text-slate-300"
                    : "bg-emerald-950/50 border-emerald-800/80 text-emerald-300"
                }`}
              >
                <span className="font-extrabold text-slate-100">{st.symbol}</span>
                <span className="text-slate-500">•</span>
                <span className="font-semibold">{st.badge}</span>
                <span className="text-[10px] text-slate-400">
                  ({st.trades_today}/2 {st.trades_today === 1 ? "trade" : "trades"})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: LIVE OPEN POSITIONS TABLE                                      */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Live Open Positions</h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              {positions.length} ACTIVE
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Smart Trailing SL 🔒 • Breakeven 🛡️ • Target 🎯
          </span>
        </div>

        {positions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs">
            No active open trades right now. When Upstox market data triggers an A+ setup, it will automatically execute here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/70 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Instrument</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Upstox LTP</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">Target Price</th>
                  <th className="py-2.5 px-3">Locked Margin</th>
                  <th className="py-2.5 px-3">Running PnL</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((pos) => {
                  const isBuy = pos.side === "BUY";
                  const isProfit = pos.unrealized_pnl >= 0;

                  return (
                    <tr key={pos.position_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100">{pos.symbol}</div>
                        <div className="text-[10px] text-slate-400 font-sans">{pos.setup_type}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBuy ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-200 font-bold">{pos.quantity}</td>
                      <td className="py-3 px-3 text-slate-300">₹{pos.entry_price.toFixed(2)}</td>
                      <td className="py-3 px-3 text-cyan-300 font-bold tabular-nums">
                        ₹{pos.current_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-rose-400 font-semibold">₹{pos.stop_loss.toFixed(2)}</div>
                        {pos.trailing_stage === "PROFIT_LOCK" && (
                          <span className="inline-block text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            🔒 Profit Locked
                          </span>
                        )}
                        {pos.trailing_stage === "BREAKEVEN" && (
                          <span className="inline-block text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            🛡️ Breakeven (Cost)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-semibold">₹{pos.target_price.toFixed(2)}</td>
                      <td className="py-3 px-3 text-slate-400">₹{pos.margin_required.toFixed(2)}</td>
                      <td className="py-3 px-3">
                        <div className={`font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                          {isProfit ? "+" : ""}₹{pos.unrealized_pnl.toFixed(2)}
                        </div>
                        <div className={`text-[10px] ${isProfit ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                          ({isProfit ? "+" : ""}{pos.pnl_pct.toFixed(2)}%)
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleSquareOff(pos.position_id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Square Off
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: DAY-WISE P&L PERFORMANCE LEDGER                                */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Day-Wise Profit & Loss (P&L) Ledger</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing Net Realized Returns on ₹{summary.wallet_budget?.toLocaleString()} Wallet
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left font-mono">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/70 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Trades</th>
                <th className="py-2.5 px-3">Wins / Losses</th>
                <th className="py-2.5 px-3">Win Rate</th>
                <th className="py-2.5 px-3">Gross P&L</th>
                <th className="py-2.5 px-3">Taxes & Charges</th>
                <th className="py-2.5 px-3">Net Realized P&L</th>
                <th className="py-2.5 px-3">Daily ROI</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {daywiseRecords.map((day) => {
                const isProfitable = day.net_pnl >= 0;
                const isExpanded = expandedDay === day.date;

                return (
                  <React.Fragment key={day.date}>
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        day.is_today ? "bg-cyan-950/15" : ""
                      }`}
                      onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                    >
                      {/* Date */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{day.date}</span>
                          {day.is_today && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900 text-cyan-300">
                              TODAY
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Trades */}
                      <td className="py-3 px-3 text-slate-300 font-semibold">{day.total_trades}</td>

                      {/* Wins vs Losses */}
                      <td className="py-3 px-3">
                        <span className="text-emerald-400 font-bold">{day.wins}W</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-rose-400 font-bold">{day.losses}L</span>
                      </td>

                      {/* Win Rate */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            day.win_rate_pct >= 60
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                              : day.total_trades === 0
                              ? "bg-slate-900 text-slate-500"
                              : "bg-amber-950 text-amber-400 border border-amber-800/50"
                          }`}
                        >
                          {day.win_rate_pct}%
                        </span>
                      </td>

                      {/* Gross PnL */}
                      <td className="py-3 px-3 text-slate-300">
                        {day.gross_pnl >= 0 ? "+" : ""}₹{day.gross_pnl.toFixed(2)}
                      </td>

                      {/* Charges */}
                      <td className="py-3 px-3 text-slate-500">-₹{day.charges.toFixed(2)}</td>

                      {/* Net Realized PnL */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-black text-xs ${
                            isProfitable ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfitable ? "+" : ""}₹{day.net_pnl.toFixed(2)}
                        </span>
                      </td>

                      {/* Daily ROI on Wallet */}
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold ${
                            isProfitable ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfitable ? "+" : ""}{day.roi_pct.toFixed(2)}%
                        </span>
                      </td>

                      {/* Toggle Details */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDay(isExpanded ? null : day.date);
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                        >
                          {isExpanded ? "Hide" : `View (${day.trades.length})`}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Trade List */}
                    {isExpanded && day.trades.length > 0 && (
                      <tr>
                        <td colSpan={9} className="p-3 bg-slate-950/90 border-b border-slate-800">
                          <div className="text-[11px] font-mono text-slate-400 mb-2 font-bold">
                            Trade Breakdown for {day.date}:
                          </div>
                          <div className="space-y-1.5">
                            {day.trades.map((t) => (
                              <div
                                key={t.trade_id}
                                className="flex flex-wrap items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-200">{t.symbol}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      t.side === "BUY" ? "text-emerald-400 bg-emerald-950" : "text-rose-400 bg-rose-950"
                                    }`}
                                  >
                                    {t.side} {t.quantity} Qty
                                  </span>
                                  <span className="text-slate-400">
                                    Entry: ₹{t.entry_price} → Exit: ₹{t.exit_price}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                                    {t.exit_reason === "TARGET_HIT"
                                      ? "🎯 TARGET HIT"
                                      : t.exit_reason === "TRAILING_SL_HIT"
                                      ? "🔒 TRAILING SL (PROFIT LOCK)"
                                      : t.exit_reason === "BREAKEVEN_EXIT"
                                      ? "🛡️ BREAKEVEN PROTECTED"
                                      : t.exit_reason === "THESIS_INVALIDATED"
                                      ? "⚡ EARLY EXIT (VWAP REVERSAL)"
                                      : t.exit_reason === "INTRADAY_SQUARE_OFF"
                                      ? "⏰ 3:15 PM AUTO EXIT"
                                      : t.exit_reason === "STOP_LOSS_HIT"
                                      ? "🛑 STOP LOSS HIT"
                                      : t.exit_reason === "MANUAL_CLOSE"
                                      ? "👤 MANUAL CLOSE"
                                      : t.exit_reason}
                                  </span>
                                  <span
                                    className={`font-bold ${
                                      t.net_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {t.net_pnl >= 0 ? "+" : ""}₹{t.net_pnl.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
