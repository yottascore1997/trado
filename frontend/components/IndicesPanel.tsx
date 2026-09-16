"use client";

import React from "react";
import { apiUrl } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, ShieldCheck, Compass, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";

export interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  regime: string;
  trend: string;
  signal: "BUY" | "SELL" | "NO_TRADE";
  ai_score: number;
  vwap: number;
  day_high: number;
  day_low: number;
  source?: string;
}

const DEFAULT_INDICES: IndexData[] = [
  {
    symbol: "NIFTY 50",
    name: "NIFTY 50 Benchmark Index",
    price: 23118.60,
    change: -279.50,
    change_pct: -1.19,
    regime: "TRENDING_BEARISH",
    trend: "BEARISH",
    signal: "SELL",
    ai_score: 84,
    vwap: 23351.60,
    day_high: 23592.85,
    day_low: 23118.60,
  },
  {
    symbol: "BANK NIFTY",
    name: "NIFTY Bank Sectoral Index",
    price: 55794.75,
    change: -811.80,
    change_pct: -1.43,
    regime: "TRENDING_BEARISH",
    trend: "BEARISH",
    signal: "SELL",
    ai_score: 83,
    vwap: 56367.50,
    day_high: 56996.35,
    day_low: 55794.75,
  },
];

interface IndicesPanelProps {
  indices?: IndexData[];
}

export const IndicesPanel: React.FC<IndicesPanelProps> = ({
  indices = DEFAULT_INDICES,
}) => {
  const [liveIndices, setLiveIndices] = React.useState<IndexData[]>(indices);
  const [isLive, setIsLive] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [lastSync, setLastSync] = React.useState<string>("");

  const fetchIndices = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(apiUrl(`/api/v1/market/indices?_t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setLiveIndices(data);
          setIsLive(data.some((idx: any) => idx.source === "UPSTOX_LIVE"));
          setLastSync(new Date().toLocaleTimeString("en-IN", { hour12: false }));
        }
      }
    } catch (e) {
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchIndices();
    const interval = setInterval(fetchIndices, 4000);
    return () => clearInterval(interval);
  }, []);

  const displayIndices = liveIndices.length > 0 ? liveIndices : indices;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono">
            NSE Benchmark Indices (Market Compass)
          </h3>
          {isLive && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              UPSTOX REAL-TIME
            </span>
          )}
          <button
            onClick={fetchIndices}
            disabled={isRefreshing}
            className="p-1 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Refresh Quotes"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          {lastSync && (
            <span className="text-[10px] font-mono text-slate-500">
              Synced: {lastSync}
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-cyan-400">
          Macro Momentum Guides Stock Confirmation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayIndices.map((idx) => {
          const isBull = idx.trend === "BULLISH";
          const isBear = idx.trend === "BEARISH";
          const isSignalBuy = idx.signal === "BUY";
          const isSignalSell = idx.signal === "SELL";

          return (
            <div
              key={idx.symbol}
              className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-700 transition-all"
            >
              {/* Top Row: Symbol & Signal */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm sm:text-base text-slate-100">
                    {idx.symbol}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      isSignalBuy
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                        : isSignalSell
                        ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {idx.signal === "BUY" ? "BUY SIGNAL" : idx.signal === "SELL" ? "SELL SIGNAL" : "NO TRADE (WAIT)"}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-xs font-mono">
                  <span className="text-slate-400">AI Score:</span>
                  <span className={`font-black ${idx.ai_score >= 75 ? "text-emerald-400" : "text-amber-400"}`}>
                    {idx.ai_score} / 100
                  </span>
                </div>
              </div>

              {/* Price & Change */}
              <div className="flex items-baseline space-x-3 my-1">
                <span className="text-2xl font-black font-mono text-slate-100 tabular-nums">
                  ₹{idx.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`text-xs font-mono font-bold flex items-center ${
                    idx.change >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {idx.change >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 inline" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 inline" />
                  )}
                  {idx.change >= 0 ? "+" : ""}
                  {idx.change.toFixed(2)} ({idx.change_pct >= 0 ? "+" : ""}
                  {idx.change_pct.toFixed(2)}%)
                </span>
              </div>

              {/* Metadata Sub-grid */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Market Regime</span>
                  <span
                    className={`font-semibold ${
                      isBull ? "text-emerald-400" : isBear ? "text-rose-400" : "text-amber-400"
                    }`}
                  >
                    {idx.regime}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">VWAP Anchor</span>
                  <span className="font-bold text-slate-200">
                    ₹{idx.vwap.toLocaleString("en-IN", { minimumFractionDigits: 1 })}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Day Range (L - H)</span>
                  <span className="text-slate-300">
                    {idx.day_low.toFixed(0)} - {idx.day_high.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
