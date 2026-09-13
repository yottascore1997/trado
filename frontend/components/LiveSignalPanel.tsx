import React from "react";
import { CheckCircle, AlertTriangle, ArrowUpRight, Clock, ShieldAlert, Zap, BarChart } from "lucide-react";

export const LiveSignalPanel: React.FC = () => {
  return (
    <div className="p-5 rounded-lg bg-slate-900/90 border border-slate-800 shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 font-bold">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-100">NIFTY 50</h2>
              <span className="px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase bg-emerald-600 text-white shadow-sm">
                BUY SIGNAL
              </span>
              <span className="text-xs text-slate-400 font-mono">1-Minute Base</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Setup: <strong className="text-slate-200">VWAP Breakout + Volume Confirmation</strong></span>
              <span>•</span>
              <span className="flex items-center text-slate-400"><Clock className="w-3 h-3 mr-1" /> Generated: 10:25:00 AM IST</span>
            </p>
          </div>
        </div>

        {/* AI Score Badge */}
        <div className="flex items-center space-x-4 bg-slate-950/70 px-4 py-2 rounded-lg border border-slate-800">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">AI Score</div>
            <div className="text-xl font-black font-mono text-cyan-400">86 <span className="text-xs text-slate-500 font-normal">/ 100</span></div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Technical Score</div>
            <div className="text-xl font-black font-mono text-emerald-400">82 <span className="text-xs text-slate-500 font-normal">/ 100</span></div>
          </div>
        </div>
      </div>

      {/* Trade Execution Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block font-mono">Entry Price</span>
          <span className="text-lg font-bold font-mono text-slate-100 tabular-nums">₹25,180.00</span>
        </div>

        <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block font-mono">Stop Loss (SL)</span>
          <span className="text-lg font-bold font-mono text-rose-400 tabular-nums">₹25,150.00</span>
          <span className="text-[10px] text-slate-500 font-mono block">Risk: 30 pts</span>
        </div>

        <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block font-mono">Target (TP)</span>
          <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">₹25,240.00</span>
          <span className="text-[10px] text-slate-500 font-mono block">Reward: 60 pts</span>
        </div>

        <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block font-mono">Risk / Reward</span>
          <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">1 : 2.0</span>
          <span className="text-[10px] text-emerald-400 font-mono block">✓ Meets $\ge$ 1:2</span>
        </div>
      </div>

      {/* Market Attributes */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded bg-slate-950/40 border border-slate-800/60 text-xs mb-4">
        <div>
          <span className="text-slate-400 text-[11px]">Market: </span>
          <span className="font-semibold text-emerald-400">TRENDING_BULLISH</span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px]">Volume: </span>
          <span className="font-semibold text-emerald-400">Strong (1.8x Rel Vol)</span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px]">5m & 15m Trend: </span>
          <span className="font-semibold text-emerald-400">Bullish Alignment</span>
        </div>
      </div>

      {/* Confirmations & Explainability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            Setup Confirmations
          </h4>
          <ul className="space-y-1 text-xs text-slate-300">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Price strictly above VWAP (25,155.00)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>EMA Alignment: EMA 9 &gt; EMA 20 &gt; EMA 50</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>RSI 14 at 63.2 (Healthy bullish momentum)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Clean breakout above morning resistance (25,175.00)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>XGBoost model version <strong>XGB-v1.0</strong> confirms high target-reach probability</span>
            </li>
          </ul>
        </div>

        {/* Position Sizing & Risk Box */}
        <div className="bg-slate-950/80 p-3 rounded-md border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-300 font-mono uppercase">Position Sizing Calculator</span>
              <span className="text-[10px] text-slate-400 font-mono">Lot Size: 25</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs py-1 text-slate-400 border-t border-slate-800/80">
              <div>Account Capital: <strong className="text-slate-200">₹100,000</strong></div>
              <div>Risk Allocation: <strong className="text-slate-200">0.5% (₹500)</strong></div>
              <div>Risk per Unit: <strong className="text-slate-200">₹30.00</strong></div>
              <div>Max Loss: <strong className="text-rose-400">₹480.00</strong></div>
            </div>
            <div className="mt-2 p-2 rounded bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-300 font-semibold">Recommended Quantity:</span>
              <span className="text-cyan-200 font-bold text-sm">16 Units (1 Standard Lot)</span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center space-x-2 text-[11px] text-amber-400/90">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Risk Note: Intra-day ATR elevated. Adhere strictly to Stop Loss ₹25,150.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
