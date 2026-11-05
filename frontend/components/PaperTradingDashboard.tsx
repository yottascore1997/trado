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
  BarChart2,
  Sparkles,
  Target,
  Layers,
} from "lucide-react";
import { StockSetupChartModal } from "./StockSetupChartModal";

export interface SetupTrackerItem {
  setup_id: string;
  symbol: string;
  setup_tier: "A+" | "A" | string;
  tier_label: string;
  setup_type: string;
  side: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  current_price: number;
  initial_stop_loss?: number;
  stop_loss: number;
  target_price: number;
  highest_price?: number;
  lowest_price?: number;
  trailing_stage: string;
  trailing_description?: string;
  base_capital: number;
  leverage: number;
  margin_required: number;
  total_exposure: number;
  unrealized_pnl: number;
  pnl_pct: number;
  product_type: string;
  entry_time: string;
  last_updated: string;
  exit_price?: number;
  exit_time?: string;
  date?: string;
  gross_pnl?: number;
  charges?: number;
  net_pnl?: number;
  roi_pct?: number;
  exit_reason?: string;
  rvol?: number;
  score?: number;
}

export interface SetupTrackerSummary {
  base_capital_per_trade: number;
  leverage: number;
  exposure_per_trade: number;
  total_setups_today: number;
  a_plus_count: number;
  a_count: number;
  active_count: number;
  closed_count: number;
  wins: number;
  losses: number;
  breakevens: number;
  win_rate_pct: number;
  unrealized_mtm: number;
  realized_gross: number;
  realized_charges: number;
  realized_net: number;
  total_combined_pnl: number;
  total_margin_deployed: number;
  active_setups: SetupTrackerItem[];
  closed_setups: SetupTrackerItem[];
  all_closed_history_count?: number;
  top_sniper_picks?: any[];
  sector_performance?: Record<string, any>;
}

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
  entry_vwap?: number;
  ema9?: number;
  ema20?: number;
  retest_level?: number;
  rvol?: number;
  market_structure?: string;
  ai_score?: number;
  price_action_score?: number;
  setup_checklist?: Array<{ rule: string; passed: boolean; detail?: string }>;
  sector?: string;
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
  stop_loss?: number;
  target_price?: number;
  initial_stop_loss?: number;
  entry_vwap?: number;
  ema9?: number;
  ema20?: number;
  retest_level?: number;
  rvol?: number;
  market_structure?: string;
  ai_score?: number;
  price_action_score?: number;
  setup_checklist?: Array<{ rule: string; passed: boolean; detail?: string }>;
  sector?: string;
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
  const [setupTracker, setSetupTracker] = useState<SetupTrackerSummary | null>(null);
  const [activeTabTracker, setActiveTabTracker] = useState<"ACTIVE" | "CLOSED">("ACTIVE");
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingAuto, setIsTogglingAuto] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [selectedTradeForChart, setSelectedTradeForChart] = useState<any | null>(null);

  const handleOpenTradeChart = (pos: OpenPosition) => {
    const isBuy = pos.side === "BUY";
    const entry = pos.entry_price;
    const current = pos.current_price;
    const sl = pos.stop_loss;
    const target = pos.target_price;
    const vwap = (pos as any).entry_vwap || (pos as any).vwap || (isBuy ? entry * 0.996 : entry * 1.004);
    const ema9 = (pos as any).ema9 || (isBuy ? entry * 0.998 : entry * 1.002);
    const ema20 = (pos as any).ema20 || (isBuy ? entry * 0.995 : entry * 1.005);
    const retest = (pos as any).retest_level || (isBuy ? entry * 0.996 : entry * 1.004);
    const rvol = (pos as any).rvol || 1.85;

    const risk_pts = Math.abs(entry - sl);
    const reward_pts = Math.abs(target - entry);
    const rr = (reward_pts / Math.max(risk_pts, 0.05)).toFixed(1);

    setSelectedTradeForChart({
      symbol: pos.symbol,
      price: current,
      current_price: current,
      change: current - entry,
      change_pct: pos.pnl_pct || ((current - entry) / Math.max(entry, 1.0)) * 100,
      volume: 125000,
      rvol: rvol,
      vwap: vwap,
      entry_vwap: vwap,
      ema9: ema9,
      ema20: ema20,
      market_structure: (pos as any).market_structure || (isBuy ? "HH_HL" : "LH_LL"),
      signal: pos.side,
      setup_type: pos.setup_type || "VWAP Breakout & Retest",
      setup_tier: pos.setup_tier || "A+",
      entry_price: entry,
      stop_loss: sl,
      initial_stop_loss: pos.initial_stop_loss || sl,
      target_price: target,
      retest_level: retest,
      risk_reward: `1:${rr}`,
      risk_pts: Number(risk_pts.toFixed(2)),
      reward_pts: Number(reward_pts.toFixed(2)),
      suggested_qty: pos.quantity,
      quantity: pos.quantity,
      position_size_val: pos.margin_required * 5,
      margin_required: pos.margin_required,
      ai_score: (pos as any).ai_score || 88,
      price_action_score: (pos as any).price_action_score || 18,
      sector: (pos as any).sector || "NSE Equity",
      product_type: pos.product_type || "MIS",

      is_paper_trade: true,
      trade_status: "ACTIVE",
      position_id: pos.position_id,
      unrealized_pnl: pos.unrealized_pnl,
      pnl_pct: pos.pnl_pct,
      trailing_stage: pos.trailing_stage,
      entry_time: pos.entry_time,
      setup_checklist: (pos as any).setup_checklist,
    });
  };

  const handleOpenClosedTradeChart = (t: ClosedTrade) => {
    const isBuy = t.side === "BUY";
    const entry = t.entry_price;
    const exit = t.exit_price;
    const sl = (t as any).stop_loss || (isBuy ? entry * 0.985 : entry * 1.015);
    const target = (t as any).target_price || (isBuy ? entry * 1.03 : entry * 0.97);
    const vwap = (t as any).entry_vwap || (isBuy ? entry * 0.996 : entry * 1.004);
    const ema9 = (t as any).ema9 || (isBuy ? entry * 0.998 : entry * 1.002);
    const ema20 = (t as any).ema20 || (isBuy ? entry * 0.995 : entry * 1.005);
    const retest = (t as any).retest_level || (isBuy ? entry * 0.996 : entry * 1.004);
    const rvol = (t as any).rvol || 1.85;

    const risk_pts = Math.abs(entry - sl);
    const reward_pts = Math.abs(target - entry);
    const rr = (reward_pts / Math.max(risk_pts, 0.05)).toFixed(1);

    setSelectedTradeForChart({
      symbol: t.symbol,
      price: exit,
      current_price: exit,
      change: exit - entry,
      change_pct: ((exit - entry) / Math.max(entry, 1.0)) * 100,
      volume: 145000,
      rvol: rvol,
      vwap: vwap,
      entry_vwap: vwap,
      ema9: ema9,
      ema20: ema20,
      market_structure: (t as any).market_structure || (isBuy ? "HH_HL" : "LH_LL"),
      signal: t.side,
      setup_type: t.setup_type || "Intraday Breakout",
      setup_tier: t.setup_tier || "A",
      entry_price: entry,
      stop_loss: sl,
      target_price: target,
      retest_level: retest,
      risk_reward: `1:${rr}`,
      risk_pts: Number(risk_pts.toFixed(2)),
      reward_pts: Number(reward_pts.toFixed(2)),
      suggested_qty: t.quantity,
      quantity: t.quantity,
      position_size_val: entry * t.quantity,
      margin_required: (entry * t.quantity) / 5,
      ai_score: (t as any).ai_score || 86,
      price_action_score: (t as any).price_action_score || 18,
      sector: (t as any).sector || "NSE Equity",
      product_type: (t as any).product_type || "MIS",

      is_paper_trade: true,
      trade_status: "CLOSED",
      trade_id: t.trade_id,
      net_pnl: t.net_pnl,
      gross_pnl: t.gross_pnl,
      charges: t.charges,
      exit_price: exit,
      exit_time: t.exit_time,
      exit_reason: t.exit_reason,
      trailing_stage: t.trailing_stage,
      entry_time: t.entry_time,
      setup_checklist: (t as any).setup_checklist,
    });
  };

  const handleOpenSetupChart = (pos: SetupTrackerItem) => {
    const isBuy = pos.side === "BUY";
    const entry = pos.entry_price;
    const current = pos.current_price;
    const sl = pos.stop_loss;
    const target = pos.target_price;
    const vwap = isBuy ? entry * 0.996 : entry * 1.004;
    const ema9 = isBuy ? entry * 0.998 : entry * 1.002;
    const ema20 = isBuy ? entry * 0.995 : entry * 1.005;
    const retest = isBuy ? entry * 0.996 : entry * 1.004;
    const rvol = pos.rvol || 1.85;

    const risk_pts = Math.abs(entry - sl);
    const reward_pts = Math.abs(target - entry);
    const rr = (reward_pts / Math.max(risk_pts, 0.05)).toFixed(1);

    setSelectedTradeForChart({
      symbol: pos.symbol,
      price: current,
      current_price: current,
      change: current - entry,
      change_pct: pos.pnl_pct || ((current - entry) / Math.max(entry, 1.0)) * 100,
      volume: 125000,
      rvol: rvol,
      vwap: vwap,
      entry_vwap: vwap,
      ema9: ema9,
      ema20: ema20,
      market_structure: isBuy ? "HH_HL" : "LH_LL",
      signal: pos.side,
      setup_type: pos.setup_type || "Algorithmic Setup",
      setup_tier: pos.setup_tier,
      entry_price: entry,
      stop_loss: sl,
      initial_stop_loss: pos.initial_stop_loss || sl,
      target_price: target,
      risk_reward: `1:${rr}`,
      risk_pts: Number(risk_pts.toFixed(2)),
      reward_pts: Number(reward_pts.toFixed(2)),
      suggested_qty: pos.quantity,
      quantity: pos.quantity,
      position_size_val: pos.total_exposure,
      margin_required: pos.margin_required,
      ai_score: pos.score || 88,
      price_action_score: 18,
      sector: "NSE Equity",
      product_type: pos.product_type,
      is_paper_trade: true,
      trade_status: pos.exit_time ? "CLOSED" : "OPEN",
      trade_id: pos.setup_id,
      net_pnl: pos.net_pnl !== undefined ? pos.net_pnl : pos.unrealized_pnl,
      gross_pnl: pos.gross_pnl !== undefined ? pos.gross_pnl : pos.unrealized_pnl,
      charges: pos.charges || 0,
      exit_price: pos.exit_price,
      exit_time: pos.exit_time,
      exit_reason: pos.exit_reason,
      trailing_stage: pos.trailing_stage,
      entry_time: pos.entry_time,
    });
  };

  const handleCloseSetupTrade = async (setupId: string) => {
    try {
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker/close"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_id: setupId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.warn("Failed to close setup trade:", e);
    }
  };

  const handleResetSetupTracker = async () => {
    if (!confirm("Are you sure you want to reset the setup tracker history for today?")) return;
    try {
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.warn("Failed to reset setup tracker:", e);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumRes, dayRes, trackerRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/market/paper/summary?_t=${Date.now()}`)),
        fetch(apiUrl(`/api/v1/market/paper/daywise-pnl?_t=${Date.now()}`)),
        fetch(apiUrl(`/api/v1/market/setups/live-tracker?_t=${Date.now()}`)),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
      if (dayRes.ok) {
        const dayData = await dayRes.json();
        setDaywiseRecords(dayData);
      }
      if (trackerRes.ok) {
        const trackerData = await trackerRes.json();
        setSetupTracker(trackerData);
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
      {/* TOP 4 SNIPER FOCUS PICKS STRIP (High-Conviction • Anti-Chasing Filtered)  */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-slate-800 space-y-3.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-100 tracking-wide">
                  🎯 TODAY'S TOP 4 SNIPER PICKS
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 font-bold">
                  FOCUS CONFLUENCE • ZERO EXTENDED TOPS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Pre-filtered for maximum win-rate: Leading sectors only, tight Stop Loss, and non-extended sweet-spot entries
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px] bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Dynamic Selection
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(setupTracker?.top_sniper_picks && setupTracker.top_sniper_picks.length > 0
            ? setupTracker.top_sniper_picks
            : []
          ).slice(0, 4).map((pick: any, idx: number) => {
            const isBuy = pick.signal === "BUY";
            const isReady = pick.entry_status === "READY_NOW";
            const isWait = pick.entry_status === "WAIT_FOR_DIP";
            const isExtended = pick.is_extended || pick.entry_status === "EXTENDED_MISSED";

            // Sizing on ₹50k with 2x leverage = ₹100,000 exposure
            const pPrice = Number(pick.price || pick.entry_price || 100);
            const pQty = Math.max(1, Math.floor(100000 / Math.max(pPrice, 0.05)));
            const pMargin = Math.round((pQty * pPrice) / 2);

            const rankBorderColors = [
              "border-amber-500/60 hover:border-amber-400 bg-gradient-to-b from-amber-950/20 to-slate-900/90",
              "border-emerald-500/50 hover:border-emerald-400 bg-gradient-to-b from-emerald-950/20 to-slate-900/90",
              "border-cyan-500/50 hover:border-cyan-400 bg-gradient-to-b from-cyan-950/20 to-slate-900/90",
              "border-indigo-500/50 hover:border-indigo-400 bg-gradient-to-b from-indigo-950/20 to-slate-900/90",
            ];

            const rankBadgeColors = [
              "bg-amber-500 text-slate-950 font-black",
              "bg-emerald-500 text-slate-950 font-black",
              "bg-cyan-500 text-slate-950 font-black",
              "bg-indigo-500 text-slate-950 font-black",
            ];

            return (
              <div
                key={pick.symbol || idx}
                onClick={() => handleOpenTradeChart({
                  position_id: `SNIPER-${pick.symbol}`,
                  symbol: pick.symbol,
                  side: pick.signal,
                  quantity: pQty,
                  entry_price: pPrice,
                  current_price: pPrice,
                  stop_loss: Number(pick.stop_loss || pPrice * 0.985),
                  target_price: Number(pick.target_price || pPrice * 1.025),
                  margin_required: pMargin,
                  unrealized_pnl: 0,
                  pnl_pct: 0,
                  setup_type: pick.setup_type || "Sniper Confluence Setup",
                  setup_tier: pick.setup_tier || "A+",
                  product_type: "MIS (2x)",
                  source: "UPSTOX_LIVE",
                  entry_time: new Date().toISOString(),
                  last_updated: new Date().toISOString(),
                  sector: pick.sector,
                  rvol: pick.rvol,
                })}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between space-y-3 shadow-md ${
                  rankBorderColors[idx] || "border-slate-800 bg-slate-900/80"
                }`}
              >
                {/* Header: Rank + Symbol + Action Badge */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${rankBadgeColors[idx] || "bg-slate-700 text-white"}`}>
                        #{idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-slate-100 group-hover:text-amber-300 transition-colors">
                        {pick.symbol}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 font-mono">
                        {pick.setup_tier || "A+"}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                        isBuy ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {pick.signal}
                    </span>
                  </div>

                  {/* Traffic Light Action Status Badge */}
                  <div className="mt-2.5">
                    {isReady && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-[10px] font-bold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>🟢 FRESH ENTRY READY</span>
                      </div>
                    )}
                    {isWait && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-950/80 border border-amber-600 text-amber-300 text-[10px] font-bold">
                        <span>🟡 WAIT FOR RETEST / DIP</span>
                      </div>
                    )}
                    {isExtended && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-950/80 border border-rose-700 text-rose-300 text-[10px] font-bold">
                        <span>🔴 OVER-EXTENDED (DO NOT CHASE)</span>
                      </div>
                    )}
                    {!isReady && !isWait && !isExtended && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
                        <span>🎯 HIGH CONVICTION SETUP</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sizing & Price Action Matrix */}
                <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Upstox LTP:</span>
                    <span className="font-bold text-cyan-300 text-[12px]">₹{pPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Stop Loss:</span>
                    <span className="text-rose-400 font-semibold text-[11px]">₹{Number(pick.stop_loss || pPrice * 0.985).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Target:</span>
                    <span className="text-emerald-400 font-semibold text-[11px]">₹{Number(pick.target_price || pPrice * 1.025).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/70 text-[10px]">
                    <span className="text-slate-400">Sizing (₹50k • 2x):</span>
                    <span className="text-slate-200 font-bold">{pQty} shares (₹{pMargin.toLocaleString()})</span>
                  </div>
                </div>

                {/* Bottom Tags: Sector + Pattern */}
                <div className="flex flex-wrap items-center gap-1 text-[9px] font-sans">
                  <span className="px-1.5 py-0.5 rounded bg-slate-850 text-slate-300 border border-slate-700">
                    {pick.sector || "Equity Leader"}
                  </span>
                  {pick.rvol && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      RVOL {pick.rvol}x
                    </span>
                  )}
                  {pick.risk_reward && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      R:R {pick.risk_reward}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(!setupTracker?.top_sniper_picks || setupTracker.top_sniper_picks.length === 0) && (
          <div className="py-6 text-center text-slate-500 font-mono text-xs">
            Scanning for Top 4 Sniper setups with leading sector momentum and fresh sweet-spot entries...
          </div>
        )}
      </div>

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
                    <tr
                      key={pos.position_id}
                      onClick={() => handleOpenTradeChart(pos)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      title="Click to view algorithmic trade setup chart"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                            {pos.symbol}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 group-hover:bg-cyan-900 transition-all font-mono flex items-center gap-0.5">
                            <BarChart2 className="w-2.5 h-2.5" /> Setup ↗
                          </span>
                        </div>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSquareOff(pos.position_id);
                          }}
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
      {/* SECTION 2: ALL-OPPORTUNITY SETUP TRACKER (₹50k Margin • 2x Leverage)      */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        {/* Header & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-100">All-Opportunity Setup Tracker</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" /> ₹50,000 Margin • 2x Leverage (₹1,00,000 Exp)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Simulated execution across all screener A+ & A setups with live multi-stage Trailing Stop Loss
              </p>
            </div>
          </div>

          {/* Tab Switcher & Reset */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTabTracker("ACTIVE")}
                className={`px-3 py-1 rounded-md font-mono transition-all flex items-center gap-1.5 ${
                  activeTabTracker === "ACTIVE"
                    ? "bg-slate-800 text-cyan-300 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-3 h-3 text-cyan-400" />
                Active Setups ({setupTracker?.active_count || 0})
              </button>
              <button
                onClick={() => setActiveTabTracker("CLOSED")}
                className={`px-3 py-1 rounded-md font-mono transition-all flex items-center gap-1.5 ${
                  activeTabTracker === "CLOSED"
                    ? "bg-slate-800 text-amber-300 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                Closed Today ({setupTracker?.closed_count || 0})
              </button>
            </div>

            <button
              onClick={handleResetSetupTracker}
              title="Reset today's setup tracker records"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Today's Setups</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-base font-bold text-slate-100 font-mono">
                {setupTracker?.total_setups_today || 0}
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                ({setupTracker?.a_plus_count || 0} A+ • {setupTracker?.a_count || 0} A)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Win Rate</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-base font-bold text-emerald-400 font-mono">
                {setupTracker?.win_rate_pct || 0}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({setupTracker?.wins || 0}W - {setupTracker?.losses || 0}L)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Running MTM</div>
            <div
              className={`text-base font-bold font-mono mt-0.5 ${
                (setupTracker?.unrealized_mtm || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(setupTracker?.unrealized_mtm || 0) >= 0 ? "+" : ""}₹
              {(setupTracker?.unrealized_mtm || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Realized Net</div>
            <div
              className={`text-base font-bold font-mono mt-0.5 ${
                (setupTracker?.realized_net || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(setupTracker?.realized_net || 0) >= 0 ? "+" : ""}₹
              {(setupTracker?.realized_net || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Total Combined P&L</div>
            <div
              className={`text-base font-bold font-mono mt-0.5 ${
                (setupTracker?.total_combined_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(setupTracker?.total_combined_pnl || 0) >= 0 ? "+" : ""}₹
              {(setupTracker?.total_combined_pnl || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Margin In Use</div>
            <div className="text-base font-bold text-slate-200 font-mono mt-0.5">
              ₹{(setupTracker?.total_margin_deployed || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* TAB 1: ACTIVE SETUPS TABLE */}
        {activeTabTracker === "ACTIVE" && (
          <div>
            {(!setupTracker?.active_setups || setupTracker.active_setups.length === 0) ? (
              <div className="py-8 text-center text-slate-500 font-mono text-xs">
                No active setups currently running. When screener identifies A+ or A tier triggers, they will automatically appear here with ₹50k (2x) allocation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/70 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Instrument & Tier</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Qty & Sizing</th>
                      <th className="py-2.5 px-3">Entry Price</th>
                      <th className="py-2.5 px-3">Upstox LTP</th>
                      <th className="py-2.5 px-3">Trailing Stop Loss</th>
                      <th className="py-2.5 px-3">Target Price</th>
                      <th className="py-2.5 px-3">Running P&L (₹50k)</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {setupTracker.active_setups.map((pos) => {
                      const isBuy = pos.side === "BUY";
                      const isProfit = pos.unrealized_pnl >= 0;

                      return (
                        <tr
                          key={pos.setup_id}
                          onClick={() => handleOpenSetupChart(pos)}
                          className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          title="Click to view algorithmic trade setup chart"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                                {pos.symbol}
                              </span>
                              {pos.setup_tier === "A+" ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-600/80 font-bold flex items-center gap-0.5 shadow-sm">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" /> A+ Institutional
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-600/80 font-semibold flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 text-cyan-400" /> A Conviction
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                              {pos.setup_type}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isBuy
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}
                            >
                              {pos.side}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-200">{pos.quantity} sh</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              ₹{pos.margin_required.toLocaleString()} margin (2x)
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="text-slate-300">₹{pos.entry_price.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {pos.entry_time?.split("T")[1]?.slice(0, 5) || "09:30"} IST
                            </div>
                          </td>

                          <td className="py-3 px-3 text-cyan-300 font-bold tabular-nums">
                            ₹{pos.current_price.toFixed(2)}
                          </td>

                          <td className="py-3 px-3">
                            <div className="text-rose-400 font-semibold">₹{pos.stop_loss.toFixed(2)}</div>
                            {pos.trailing_stage === "PROFIT_LOCK_70" && (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold mt-0.5">
                                🔒 Super Lock (70% Tgt)
                              </span>
                            )}
                            {pos.trailing_stage === "PROFIT_LOCK_50" && (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-semibold mt-0.5">
                                🔒 Lock 50% Target
                              </span>
                            )}
                            {pos.trailing_stage === "PROFIT_LOCK_25" && (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700 font-semibold mt-0.5">
                                🔒 Lock 25% Target
                              </span>
                            )}
                            {pos.trailing_stage === "BREAKEVEN" && (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-semibold mt-0.5">
                                🛡️ Trailed to Cost
                              </span>
                            )}
                            {(!pos.trailing_stage || pos.trailing_stage === "INITIAL") && (
                              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono mt-0.5">
                                🛑 Initial SL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-emerald-400 font-semibold">
                            ₹{pos.target_price.toFixed(2)}
                          </td>

                          <td className="py-3 px-3">
                            <div className={`font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}₹{pos.unrealized_pnl.toFixed(2)}
                            </div>
                            <div className={`text-[10px] font-semibold ${isProfit ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                              ({isProfit ? "+" : ""}{pos.pnl_pct.toFixed(2)}% on ₹50k)
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloseSetupTrade(pos.setup_id);
                              }}
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
        )}

        {/* TAB 2: CLOSED SETUPS TODAY TABLE */}
        {activeTabTracker === "CLOSED" && (
          <div>
            {(!setupTracker?.closed_setups || setupTracker.closed_setups.length === 0) ? (
              <div className="py-8 text-center text-slate-500 font-mono text-xs">
                No setups closed yet today. As positions hit Target, Trailing SL, or 3:15 PM Square-Off, they will be archived here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left font-mono">
                  <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/70 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Instrument & Tier</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3">Qty & Sizing</th>
                      <th className="py-2.5 px-3">Entry → Exit Price</th>
                      <th className="py-2.5 px-3">Exit Reason</th>
                      <th className="py-2.5 px-3">Gross P&L</th>
                      <th className="py-2.5 px-3">Charges</th>
                      <th className="py-2.5 px-3">Net P&L (ROI %)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {setupTracker.closed_setups.map((c) => {
                      const isProfit = (c.net_pnl || 0) >= 0;
                      const isBuy = c.side === "BUY";

                      return (
                        <tr
                          key={c.setup_id}
                          onClick={() => handleOpenSetupChart(c)}
                          className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                          title="Click to view trade chart"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                                {c.symbol}
                              </span>
                              {c.setup_tier === "A+" ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-600/80 font-bold flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" /> A+
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-600/80 font-semibold flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 text-cyan-400" /> A
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                              {c.setup_type}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isBuy
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}
                            >
                              {c.side}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-200">{c.quantity} sh</div>
                            <div className="text-[10px] text-slate-400">
                              ₹{(c.margin_required || 50000).toLocaleString()} margin
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="text-slate-300">
                              ₹{c.entry_price.toFixed(2)} → ₹{(c.exit_price || c.entry_price).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {c.exit_time?.split("T")[1]?.slice(0, 5) || "15:15"} IST
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {c.exit_reason === "TARGET_HIT" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                                🎯 Target Hit
                              </span>
                            )}
                            {c.exit_reason === "TRAILING_SL_HIT" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 font-semibold">
                                🔒 Trailing SL Hit
                              </span>
                            )}
                            {c.exit_reason === "BREAKEVEN_EXIT" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-semibold">
                                🛡️ Breakeven Exit
                              </span>
                            )}
                            {c.exit_reason === "THESIS_INVALIDATED" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 font-semibold">
                                ⚡ Thesis Invalidated (Early Cut)
                              </span>
                            )}
                            {c.exit_reason === "STAGNATION_EXIT" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700 font-semibold">
                                ⏱️ Stagnation Cut (35m Time-Stop)
                              </span>
                            )}
                            {c.exit_reason === "MARKET_REVERSAL_CRACK" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-semibold">
                                📉 Nifty Reversal Cut
                              </span>
                            )}
                            {c.exit_reason === "STOP_LOSS_HIT" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-semibold">
                                🛑 Stop Loss Hit
                              </span>
                            )}
                            {c.exit_reason === "INTRADAY_SQUARE_OFF" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                ⏱️ 3:15 PM Square-Off
                              </span>
                            )}
                            {c.exit_reason === "MANUAL_CLOSE" && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700">
                                ✋ Manual Close
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <span className={c.gross_pnl && c.gross_pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {c.gross_pnl && c.gross_pnl >= 0 ? "+" : ""}₹{(c.gross_pnl || 0).toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-400">
                            -₹{(c.charges || 0).toFixed(2)}
                          </td>

                          <td className="py-3 px-3">
                            <div className={`font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}₹{(c.net_pnl || 0).toFixed(2)}
                            </div>
                            <div className={`text-[10px] font-semibold ${isProfit ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                              ({isProfit ? "+" : ""}{(c.roi_pct || 0).toFixed(2)}% on ₹50k)
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: DAY-WISE P&L PERFORMANCE LEDGER                                */}
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
                                onClick={() => handleOpenClosedTradeChart(t)}
                                className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-800/70 text-xs transition-all cursor-pointer group shadow-sm"
                                title="Click to inspect setup chart & exit point"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                                    {t.symbol}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono flex items-center gap-0.5">
                                    <BarChart2 className="w-2.5 h-2.5" /> Chart ↗
                                  </span>
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
                                      : t.exit_reason === "STAGNATION_EXIT"
                                      ? "⏱️ TIME-STOP (STAGNATION)"
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

      {/* Algorithmic Trade Setup Chart & Visualizer Modal */}
      {selectedTradeForChart && (
        <StockSetupChartModal
          stock={selectedTradeForChart}
          onClose={() => setSelectedTradeForChart(null)}
          onSquareOff={(posId) => handleSquareOff(posId)}
        />
      )}
    </div>
  );
};
