import React from "react";
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Activity, Target } from "lucide-react";

interface TopMarketCardsProps {
  niftyQuote?: {
    price: number;
    change: number;
    change_pct: number;
    day_high: number;
    day_low: number;
  };
  bankNiftyQuote?: {
    price: number;
    change: number;
    change_pct: number;
    day_high: number;
    day_low: number;
  };
}

export const TopMarketCards: React.FC<TopMarketCardsProps> = ({
  niftyQuote = { price: 25180.0, change: 112.5, change_pct: 0.45, day_high: 25210.0, day_low: 25045.0 },
  bankNiftyQuote = { price: 51840.0, change: -45.0, change_pct: -0.09, day_high: 52020.0, day_low: 51710.0 },
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {/* Card 1: NIFTY 50 */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-slate-100">NIFTY 50</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
              BUY SIGNAL
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">NSE SPOT</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            ₹{niftyQuote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <span className={`text-xs font-mono font-medium flex items-center ${niftyQuote.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {niftyQuote.change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
            {niftyQuote.change >= 0 ? "+" : ""}{niftyQuote.change.toFixed(2)} ({niftyQuote.change_pct >= 0 ? "+" : ""}{niftyQuote.change_pct.toFixed(2)}%)
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Market Regime</span>
            <span className="font-semibold text-emerald-400">TRENDING_BULLISH</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">AI Score</span>
            <span className="font-bold font-mono text-cyan-400">86 / 100</span>
          </div>
        </div>
      </div>

      {/* Card 2: BANK NIFTY */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-slate-100">BANK NIFTY</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
              NO TRADE
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">NSE SPOT</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            ₹{bankNiftyQuote.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
          <span className={`text-xs font-mono font-medium flex items-center ${bankNiftyQuote.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {bankNiftyQuote.change >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
            {bankNiftyQuote.change >= 0 ? "+" : ""}{bankNiftyQuote.change.toFixed(2)} ({bankNiftyQuote.change_pct >= 0 ? "+" : ""}{bankNiftyQuote.change_pct.toFixed(2)}%)
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Market Regime</span>
            <span className="font-semibold text-amber-400">SIDEWAYS / LOW VOL</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">AI Score</span>
            <span className="font-bold font-mono text-slate-400">52 / 100</span>
          </div>
        </div>
      </div>

      {/* Card 3: Paper Portfolio & P&L */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-sm text-slate-100">Paper Trading P&L</span>
          <span className="text-[10px] font-mono text-slate-400">CAPITAL: ₹100,000</span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            +₹1,450.00
          </span>
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            (+1.45%)
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Daily Loss Limit</span>
            <span className="font-mono text-slate-200">₹0 / ₹1,000 (1%)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Open Positions</span>
            <span className="font-mono text-slate-200">1 (NIFTY 50)</span>
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
            1 <span className="text-xs text-slate-400 font-normal">/ 5 Trades</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            0 Consecutive Losses
          </span>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Risk per Trade</span>
            <span className="font-mono text-slate-200">0.5% (₹500)</span>
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
