"use client";

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { StockSetupChartModal } from "./StockSetupChartModal";
import {
  Activity,
  Zap,
  Target,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  XCircle,
} from "lucide-react";

export const TodayTradesDashboard: React.FC = () => {
  const [setupTracker, setSetupTracker] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTabTracker, setActiveTabTracker] = useState<"ACTIVE" | "CLOSED">("ACTIVE");
  const [selectedTradeForChart, setSelectedTradeForChart] = useState<any | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Fetch Live Setup Tracker telemetry
  const fetchSetupTracker = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker"));
      if (res.ok) {
        const data = await res.json();
        setSetupTracker(data);
      }
    } catch (err) {
      console.error("Failed to fetch setup tracker data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetupTracker();
    if (!autoRefresh) return;
    const interval = setInterval(fetchSetupTracker, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle Manual Single Position Square Off
  const handleCloseSetupTrade = async (setupId: string) => {
    if (!confirm("Are you sure you want to square off this setup trade at current LTP?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker/close"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_id: setupId }),
      });
      if (res.ok) {
        await fetchSetupTracker();
      }
    } catch (err) {
      console.error("Error closing setup trade:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Square Off All Active Positions
  const handleCloseAllTrades = async () => {
    if (!setupTracker?.active_count || setupTracker.active_count === 0) return;
    if (!confirm(`Are you sure you want to square off all ${setupTracker.active_count} active trades at market LTP?`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker/close-all"), {
        method: "POST",
      });
      if (res.ok) {
        await fetchSetupTracker();
      }
    } catch (err) {
      console.error("Error squaring off all trades:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reset Tracker
  const handleResetSetupTracker = async () => {
    if (!confirm("Reset Today's Setup Tracker? This will clear all active and closed setup records for today.")) return;
    try {
      setActionLoading(true);
      const res = await fetch(apiUrl("/api/v1/market/setups/live-tracker/reset"), {
        method: "POST",
      });
      if (res.ok) {
        await fetchSetupTracker();
      }
    } catch (err) {
      console.error("Error resetting setup tracker:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to open setup chart modal
  const handleOpenSetupChart = (trade: any) => {
    setSelectedTradeForChart({
      position_id: trade.setup_id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      entry_price: trade.entry_price,
      current_price: trade.current_price || trade.exit_price || trade.entry_price,
      stop_loss: trade.stop_loss || trade.initial_stop_loss,
      target_price: trade.target_price,
      margin_required: trade.margin_required,
      unrealized_pnl: trade.unrealized_pnl ?? trade.net_pnl,
      pnl_pct: trade.pnl_pct ?? trade.roi_pct,
      trailing_stage: trade.trailing_stage,
      trailing_description: trade.trailing_description,
      setup_type: trade.setup_type,
      setup_tier: trade.setup_tier,
    });
  };

  const safeguards = setupTracker?.safeguards || {
    symbol_lock_enabled: true,
    opening_guard_enabled: true,
    is_opening_settlement_active: false,
    max_daily_trades: 8,
    today_trades_count: setupTracker?.total_setups_today || 0,
    remaining_setups_quota: Math.max(0, 8 - (setupTracker?.total_setups_today || 0)),
  };

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* 1. INSTITUTIONAL HEADER & TELEMETRY CONTROLS                              */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-amber-500/20 border border-emerald-500/30 text-emerald-400 shadow-md">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-sans">
                  Today's Trades & Live Setup Tracker
                </h2>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Upstox Live Tick Feed
                </span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-400" /> ₹50k Margin • 2x Leverage (₹1,00,000 Exp)
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Automated paper execution of Screener A+ & A setups with dynamic multi-stage Trailing SL & strict risk safeguards
              </p>
            </div>
          </div>

          {/* Action Buttons & Telemetry Controls */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-colors ${
                autoRefresh
                  ? "bg-slate-800/90 text-cyan-300 border-cyan-800/80 shadow-sm"
                  : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
              }`}
              title="Toggle 3-second live auto-refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin text-cyan-400" : ""}`} />
              {autoRefresh ? "Live Auto-Sync" : "Paused"}
            </button>

            {setupTracker?.active_count > 0 && (
              <button
                onClick={handleCloseAllTrades}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                title="Square off all currently active setups"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Square Off All ({setupTracker.active_count})
              </button>
            )}

            <button
              onClick={handleResetSetupTracker}
              disabled={actionLoading}
              title="Reset today's setup tracker records"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SAFEGUARD STATUS PILL STRIP (3 Institutional Protections)                 */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Safeguard 1: Symbol Lock */}
          <div className="flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Symbol Lock Rule</div>
              <div className="text-xs font-semibold text-emerald-400 font-mono flex items-center gap-1">
                Active <span className="text-[10px] text-slate-400">(Max 1 Trade/Stock)</span>
              </div>
            </div>
          </div>

          {/* Safeguard 2: 09:15-09:30 AM Opening Settlement Guard */}
          <div className="flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <div className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Opening Guard</div>
              <div className="text-xs font-semibold font-mono flex items-center gap-1">
                {safeguards.is_opening_settlement_active ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    Holding (09:15-09:30)
                  </span>
                ) : (
                  <span className="text-cyan-400">Passed (Trade Window Open)</span>
                )}
              </div>
            </div>
          </div>

          {/* Safeguard 3: Daily Cap */}
          <div className="flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Daily Setup Cap</div>
              <div className="text-xs font-semibold text-slate-200 font-mono">
                {safeguards.today_trades_count} / {safeguards.max_daily_trades} Used{" "}
                <span className="text-[10px] text-slate-400">({safeguards.remaining_setups_quota} Left)</span>
              </div>
            </div>
          </div>

          {/* Safeguard 4: Dynamic Trailing SL */}
          <div className="flex items-center space-x-2.5 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <div className="p-1.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Dynamic Trailing SL</div>
              <div className="text-xs font-semibold text-purple-300 font-mono">
                Cost (+0.35%) ➔ 25% ➔ 50% ➔ 70%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP 4 HIGH-CONVICTION SNIPER FOCUS PICKS                               */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 font-mono">
                  Top 4 High-Conviction Sniper Focus Picks
                </h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold">
                  Composite Prop Score
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
                onClick={() => handleOpenSetupChart({
                  setup_id: `SNIPER-${pick.symbol}`,
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
                  setup_type: pick.setup_type || pick.pattern,
                  setup_tier: pick.setup_tier || "A+",
                })}
                className={`relative p-3.5 rounded-xl border transition-all cursor-pointer shadow-md group ${rankBorderColors[idx % 4]}`}
                title="Click to view full algorithmic setup chart"
              >
                {/* Header: Rank + Symbol + Action Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] shadow-sm font-mono ${rankBadgeColors[idx % 4]}`}>
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors font-mono">
                          {pick.symbol}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          isBuy ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}>
                          {pick.signal}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {pick.sector || "Large Cap"}
                      </div>
                    </div>
                  </div>

                  {/* Traffic Light Action Status */}
                  <div>
                    {isReady && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        READY NOW
                      </span>
                    )}
                    {isWait && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-semibold flex items-center gap-1">
                        WAIT FOR DIP
                      </span>
                    )}
                    {isExtended && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700 font-semibold flex items-center gap-1">
                        EXTENDED
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & RVOL */}
                <div className="grid grid-cols-2 gap-2 my-2 py-1.5 px-2 rounded-lg bg-slate-950/70 border border-slate-800/60 font-mono text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Current LTP</span>
                    <span className="font-bold text-slate-200">₹{pPrice.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-sans">Volume (RVOL)</span>
                    <span className={`font-bold ${Number(pick.rvol || 1) >= 1.5 ? "text-amber-300" : "text-slate-300"}`}>
                      {Number(pick.rvol || 1.2).toFixed(2)}x
                    </span>
                  </div>
                </div>

                {/* SL & Target */}
                <div className="space-y-1 text-[11px] font-mono pt-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1 text-[10px] text-rose-400">
                      <TrendingDown className="w-3 h-3" /> Stop Loss
                    </span>
                    <span className="text-rose-400 font-semibold">₹{Number(pick.stop_loss || pPrice * 0.985).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <TrendingUp className="w-3 h-3" /> Target
                    </span>
                    <span className="text-emerald-400 font-semibold">₹{Number(pick.target_price || pPrice * 1.025).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer: Sizing */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>₹50k Sizing: <strong className="text-slate-200">{pQty} sh</strong></span>
                  <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                    View Chart <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {(!setupTracker?.top_sniper_picks || setupTracker.top_sniper_picks.length === 0) && (
          <div className="py-6 text-center text-slate-500 font-mono text-xs">
            Scanning screener setups... Once A+/A setups pass sector & ATR guards, the Top 4 focus cards will render here.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. TODAY'S METRICS SUMMARY STRIP (KPIs)                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Today's Setups</div>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-lg font-bold text-slate-100 font-mono">
              {setupTracker?.total_setups_today || 0}
            </span>
            <span className="text-[10px] text-amber-400 font-mono">
              ({setupTracker?.a_plus_count || 0} A+ • {setupTracker?.a_count || 0} A)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Win Rate</div>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-lg font-bold text-emerald-400 font-mono">
              {setupTracker?.win_rate_pct || 0}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({setupTracker?.wins || 0}W - {setupTracker?.losses || 0}L)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Running MTM</div>
          <div
            className={`text-lg font-bold font-mono mt-1 ${
              (setupTracker?.unrealized_mtm || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(setupTracker?.unrealized_mtm || 0) >= 0 ? "+" : ""}₹
            {(setupTracker?.unrealized_mtm || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Realized Net</div>
          <div
            className={`text-lg font-bold font-mono mt-1 ${
              (setupTracker?.realized_net || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(setupTracker?.realized_net || 0) >= 0 ? "+" : ""}₹
            {(setupTracker?.realized_net || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Total Combined P&L</div>
          <div
            className={`text-lg font-bold font-mono mt-1 ${
              (setupTracker?.total_combined_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(setupTracker?.total_combined_pnl || 0) >= 0 ? "+" : ""}₹
            {(setupTracker?.total_combined_pnl || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Margin In Use</div>
          <div className="text-lg font-bold text-slate-200 font-mono mt-1">
            ₹{(setupTracker?.total_margin_deployed || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TRADES TABLE SECTION (ACTIVE & CLOSED TODAY)                           */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-lg">
        {/* Table Tab Switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTabTracker("ACTIVE")}
              className={`px-3.5 py-1.5 rounded-md font-mono transition-all flex items-center gap-1.5 ${
                activeTabTracker === "ACTIVE"
                  ? "bg-slate-800 text-cyan-300 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Active Setups ({setupTracker?.active_count || 0})
            </button>
            <button
              onClick={() => setActiveTabTracker("CLOSED")}
              className={`px-3.5 py-1.5 rounded-md font-mono transition-all flex items-center gap-1.5 ${
                activeTabTracker === "CLOSED"
                  ? "bg-slate-800 text-amber-300 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
              Closed Today ({setupTracker?.closed_count || 0})
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {activeTabTracker === "ACTIVE" ? (
              <span>Live trailing execution with real Upstox LTP</span>
            ) : (
              <span>Full audit ledger with net brokerage and exit reasons</span>
            )}
          </div>
        </div>

        {/* TAB 1: ACTIVE SETUPS TABLE */}
        {activeTabTracker === "ACTIVE" && (
          <div>
            {(!setupTracker?.active_setups || setupTracker.active_setups.length === 0) ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
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
                    {setupTracker.active_setups.map((pos: any) => {
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
              <div className="py-12 text-center text-slate-500 font-mono text-xs">
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
                    {setupTracker.closed_setups.map((c: any) => {
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
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-bold">
                                  A+
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                                  A
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5 truncate max-w-[200px]">
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
                            <div className="text-slate-200 font-bold">{c.quantity} sh</div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              ₹{c.margin_required.toLocaleString()} margin
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="text-slate-200">
                              ₹{c.entry_price.toFixed(2)} → ₹{c.exit_price.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {c.exit_time?.split("T")[1]?.slice(0, 5) || "15:15"} IST
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {c.exit_reason === "TRAILING_SL_HIT" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
                                🔒 Trailing SL Hit
                              </span>
                            )}
                            {c.exit_reason === "BREAKEVEN_EXIT" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-semibold">
                                🛡️ Breakeven Exit
                              </span>
                            )}
                            {c.exit_reason === "TARGET_HIT" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-600 font-bold">
                                🎯 Target Reached
                              </span>
                            )}
                            {c.exit_reason === "THESIS_INVALIDATED" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 font-semibold">
                                ⚡ Thesis Invalidated (Early Cut)
                              </span>
                            )}
                            {c.exit_reason === "STAGNATION_EXIT" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold">
                                ⏱️ Stagnation Cut (35m Time-Stop)
                              </span>
                            )}
                            {c.exit_reason === "MARKET_REVERSAL_CRACK" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-semibold">
                                📉 Nifty Reversal Cut
                              </span>
                            )}
                            {c.exit_reason === "INTRADAY_SQUARE_OFF" && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                ⏱️ 3:15 PM Square-Off
                              </span>
                            )}
                            {(c.exit_reason === "MANUAL_CLOSE" || c.exit_reason === "MANUAL_CLOSE_ALL") && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                👤 Manual Close
                              </span>
                            )}
                            {(!c.exit_reason || c.exit_reason === "STOP_LOSS_HIT") && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
                                🛑 Stop Loss Hit
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <span className={c.gross_pnl >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                              {c.gross_pnl >= 0 ? "+" : ""}₹{c.gross_pnl.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            -₹{c.charges.toFixed(2)}
                          </td>

                          <td className="py-3 px-3">
                            <div className={`font-bold tabular-nums ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                              {isProfit ? "+" : ""}₹{c.net_pnl.toFixed(2)}
                            </div>
                            <div className={`text-[10px] ${isProfit ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                              ({isProfit ? "+" : ""}{c.roi_pct.toFixed(2)}% on ₹50k)
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

      {/* Algorithmic Trade Setup Chart & Visualizer Modal */}
      {selectedTradeForChart && (
        <StockSetupChartModal
          stock={selectedTradeForChart}
          onClose={() => setSelectedTradeForChart(null)}
          onSquareOff={(posId) => handleCloseSetupTrade(posId)}
        />
      )}
    </div>
  );
};

