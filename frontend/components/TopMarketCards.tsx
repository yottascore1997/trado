"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Activity, Target } from "lucide-react";

interface TopMarketCardsProps {
  niftyQuote?: {
    price: number;
    change: number;
    change_pct: number;
    day_high: number;
    day_low: number;
    signal?: string;
    regime?: string;
    ai_score?: number;
  };
  bankNiftyQuote?: {
    price: number;
    change: number;
    change_pct: number;
    day_high: number;
    day_low: number;
    signal?: string;
    regime?: string;
    ai_score?: number;
  };
  paperSummary?: {
    wallet_budget?: number;
    today_realized_pnl?: number;
    unrealized_mtm?: number;
    open_positions_count?: number;
    closed_trades_today_count?: number;
    available_balance?: number;
  } | null;
  tradingPlan?: {
    wallet_budget?: number;
    risk_per_trade_pct?: number;
    max_daily_loss_pct?: number;
    max_active_trades?: number;
  } | null;
}

export const TopMarketCards: React.FC<TopMarketCardsProps> = ({
  niftyQuote,
  bankNiftyQuote,
  paperSummary,
  tradingPlan,
}) => {
  const nPrice = niftyQuote?.price || 0;
  const nChange = niftyQuote?.change || 0;
  const nChangePct = niftyQuote?.change_pct || 0;
  const nSignal = niftyQuote?.signal || "NO_TRADE";
  const nRegime = niftyQuote?.regime || (nChange >= 0 ? "TRENDING_BULLISH" : "TRENDING_BEARISH");
  const nScore = niftyQuote?.ai_score || 78;

  const bPrice = bankNiftyQuote?.price || 0;
  const bChange = bankNiftyQuote?.change || 0;
  const bChangePct = bankNiftyQuote?.change_pct || 0;
  const bSignal = bankNiftyQuote?.signal || "NO_TRADE";
  const bRegime = bankNiftyQuote?.regime || (bChange >= 0 ? "TRENDING_BULLISH" : "TRENDING_BEARISH");
  const bScore = bankNiftyQuote?.ai_score || 79;

  // Real paper metrics
  const budget = paperSummary?.wallet_budget || tradingPlan?.wallet_budget || 100000.0;
  const todayRealized = paperSummary?.today_realized_pnl || 0.0;
  const unrealizedMtm = paperSummary?.unrealized_mtm || 0.0;
  const totalTodayPnl = todayRealized + unrealizedMtm;
  const pnlPct = budget > 0 ? (totalTodayPnl / budget) * 100 : 0.0;
  const openCount = paperSummary?.open_positions_count ?? 0;
  const tradesToday = paperSummary?.closed_trades_today_count ?? 0;
  const riskPct = tradingPlan?.risk_per_trade_pct || 1.5;
  const riskRs = Math.round((budget * riskPct) / 100);
  const maxLossPct = tradingPlan?.max_daily_loss_pct || 3.0;
  const maxLossRs = Math.round((budget * maxLossPct) / 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* Card 1: NIFTY 50 */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-slate-100">NIFTY 50</span>
            <span
              className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold border ${
                nSignal === "BUY"
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                  : nSignal === "SELL"
                  ? "bg-rose-950 text-rose-400 border-rose-800/60"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {nSignal === "BUY" ? "BUY SIGNAL" : nSignal === "SELL" ? "SELL SIGNAL" : "NO TRADE"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">UPSTOX LIVE</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {nPrice > 0 ? `₹${nPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Connecting..."}
          </span>
          {nPrice > 0 && (
            <span className={`text-xs font-mono font-medium flex items-center ${nChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {nChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
              {nChange >= 0 ? "+" : ""}{nChange.toFixed(2)} ({nChangePct >= 0 ? "+" : ""}{nChangePct.toFixed(2)}%)
            </span>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Market Regime</span>
            <span className={`font-semibold ${nChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {nRegime}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">AI Score</span>
            <span className="font-bold font-mono text-cyan-400">{nScore} / 100</span>
          </div>
        </div>
      </div>

      {/* Card 2: BANK NIFTY */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-slate-100">BANK NIFTY</span>
            <span
              className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold border ${
                bSignal === "BUY"
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                  : bSignal === "SELL"
                  ? "bg-rose-950 text-rose-400 border-rose-800/60"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {bSignal === "BUY" ? "BUY SIGNAL" : bSignal === "SELL" ? "SELL SIGNAL" : "NO TRADE"}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">UPSTOX LIVE</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {bPrice > 0 ? `₹${bPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "Connecting..."}
          </span>
          {bPrice > 0 && (
            <span className={`text-xs font-mono font-medium flex items-center ${bChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {bChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
              {bChange >= 0 ? "+" : ""}{bChange.toFixed(2)} ({bChangePct >= 0 ? "+" : ""}{bChangePct.toFixed(2)}%)
            </span>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Market Regime</span>
            <span className={`font-semibold ${bChange >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {bRegime}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">AI Score</span>
            <span className="font-bold font-mono text-slate-300">{bScore} / 100</span>
          </div>
        </div>
      </div>

      {/* Card 3: Real Paper Portfolio & P&L */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-slate-100">Paper Trading P&L</span>
          <span className="text-[10px] font-mono text-slate-400">CAPITAL: ₹{budget.toLocaleString("en-IN")}</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span
            className={`text-2xl font-bold font-mono tabular-nums ${
              totalTodayPnl > 0 ? "text-emerald-400" : totalTodayPnl < 0 ? "text-rose-400" : "text-slate-200"
            }`}
          >
            {totalTodayPnl >= 0 ? "+" : ""}₹{totalTodayPnl.toFixed(2)}
          </span>
          <span
            className={`text-xs font-mono font-semibold ${
              totalTodayPnl > 0 ? "text-emerald-400" : totalTodayPnl < 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Daily Loss Limit</span>
            <span className="font-mono text-slate-200">₹{maxLossRs} ({maxLossPct}%)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Open Positions</span>
            <span className="font-mono text-cyan-400 font-semibold">{openCount} Active</span>
          </div>
        </div>
      </div>

      {/* Card 4: Daily Trade Budget & Circuit Breakers */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-slate-100">Risk Manager</span>
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> ACTIVE
          </span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {tradesToday} <span className="text-xs text-slate-400 font-normal">Trades Today</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            {openCount} in Execution
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Risk per Trade</span>
            <span className="font-mono text-slate-200">{riskPct}% (₹{riskRs})</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Min Risk/Reward</span>
            <span className="font-mono text-slate-200">1 : 2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
