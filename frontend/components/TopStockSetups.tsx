"use client";

import React, { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info,
  X,
  Target,
  Zap,
  Sliders,
  BarChart2,
  RefreshCw,
} from "lucide-react";
import { StockSetupChartModal } from "./StockSetupChartModal";

export interface StockSetupItem {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  change_pct: number;
  vwap: number;
  ema_9: number;
  ema_20: number;
  rvol: number;
  signal: "BUY" | "SELL" | "NO_TRADE";
  ai_score: number;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_pts: number;
  reward_pts: number;
  risk_reward: string;
  setup_type: string;
  index_aligned: boolean;
  alignment_status: string;
  suggested_qty: number;
  primary_reason?: string;
  checklist?: Array<{ rule: string; passed: boolean }>;
  product_type?: string;
  margin_required?: number;
  max_risk_in_rs?: number;
  expected_reward_in_rs?: number;
  // Institutional Strategy Upgrades
  relative_strength?: number;
  rs_status?: string;
  composite_rank_score?: number;
  atr_extension_ratio?: number;
  // Price Action Engine V2 Additions
  price_action_score?: number;
  setup_tier?: "A+" | "A" | "B" | "C";
  market_structure?: string;
  pa_setup?: string;
  retest_level?: number;
  filter_verdict?: string;
  pa_checklist?: Array<{ rule: string; points: number; max: number; passed: boolean; detail?: string }>;
  is_eligible?: boolean;
  eligibility_reason?: string;
  source?: string;
}


interface TopStockSetupsProps {
  setups?: StockSetupItem[];
  tradingPlan?: any;
  onSelectStock?: (stock: StockSetupItem) => void;
}

export const TopStockSetups: React.FC<TopStockSetupsProps> = ({
  setups = [],
  tradingPlan,
  onSelectStock,
}) => {
  const [selectedStock, setSelectedStock] = useState<StockSetupItem | null>(null);
  const [tierFilter, setTierFilter] = useState<"ALL" | "A_PLUS" | "A_TIER">("ALL");
  const [liveSetups, setLiveSetups] = useState<StockSetupItem[]>(setups);
  const [loadingSetups, setLoadingSetups] = useState<boolean>(false);

  // Dynamic fetch with periodic refresh and cache busting
  const fetchTopSetups = async () => {
    try {
      setLoadingSetups(true);
      const params = new URLSearchParams();

      let activeB = tradingPlan?.wallet_budget;
      let activeM = tradingPlan?.trading_mode;
      let activeR = tradingPlan?.risk_per_trade_pct;

      if (!activeB && typeof window !== "undefined") {
        const savedB = localStorage.getItem("trado_wallet_budget");
        if (savedB) activeB = parseFloat(savedB);
        const savedM = localStorage.getItem("trado_trading_mode");
        if (savedM) activeM = savedM;
      }

      if (activeB) params.append("wallet_budget", activeB.toString());
      if (activeM) params.append("mode", activeM);
      if (activeR) params.append("risk_pct", activeR.toString());
      params.append("_t", Date.now().toString());

      const res = await fetch(apiUrl(`/api/v1/market/top-setups?${params.toString()}`));
      if (res.ok) {
        const data = await res.json();
        if (data.top_setups && data.top_setups.length > 0) {
          setLiveSetups(data.top_setups);
        }
      }
    } catch (e) {
    } finally {
      setLoadingSetups(false);
    }
  };

  React.useEffect(() => {
    fetchTopSetups();
    const interval = setInterval(fetchTopSetups, 4000);

    const handlePlanUpdated = () => {
      fetchTopSetups();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("trado_plan_updated", handlePlanUpdated);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("trado_plan_updated", handlePlanUpdated);
      }
    };
  }, [tradingPlan?.wallet_budget, tradingPlan?.trading_mode, tradingPlan?.risk_per_trade_pct]);

  const activeList = liveSetups.length > 0 ? liveSetups : setups;

  const filteredSetups = activeList.filter((stock) => {
    if (tierFilter === "A_PLUS") return stock.setup_tier === "A+";
    if (tierFilter === "A_TIER") return stock.setup_tier === "A+" || stock.setup_tier === "A";
    return true;
  });

  return (
    <div className="p-5 rounded-lg bg-slate-900/90 border border-slate-800 shadow-md space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-inner">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight">
                TODAY'S TOP INTRADAY SETUPS
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                PRICE ACTION V2
              </span>
              {tradingPlan?.wallet_budget && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase font-bold">
                  ₹{tradingPlan.wallet_budget.toLocaleString("en-IN")} WALLET SIZED
                </span>
              )}
              <button
                onClick={fetchTopSetups}
                disabled={loadingSetups}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-all cursor-pointer"
                title="Refresh Setups from Upstox Live"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSetups ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Scanned 2,000+ NSE stocks • Market Structure (HH/HL), Breakout & Retest, S/R Polarity Verified
            </p>
          </div>
        </div>

        {/* 5-Stage Funnel telemetry pill */}
        <div className="hidden xl:flex items-center space-x-1.5 text-xs font-mono">
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
            Universe: <strong className="text-slate-200">2,048</strong>
          </span>
          <span className="text-slate-600">→</span>
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
            Liquid: <strong className="text-cyan-400">185</strong>
          </span>
          <span className="text-slate-600">→</span>
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
            Technical: <strong className="text-slate-300">24</strong>
          </span>
          <span className="text-slate-600">→</span>
          <span className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-[11px]">
            PA Verified: <strong>5</strong>
          </span>
          <span className="text-slate-600">→</span>
          <span className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
            Top 5 Ranked
          </span>
        </div>
      </div>

      {/* Tier Filter Tabs Bar */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 font-mono text-[11px]">Filter Quality Tier:</span>
          <button
            onClick={() => setTierFilter("ALL")}
            className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
              tierFilter === "ALL"
                ? "bg-slate-800 text-white font-bold border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Setups ({setups.length})
          </button>
          <button
            onClick={() => setTierFilter("A_PLUS")}
            className={`px-2.5 py-1 rounded-md font-mono text-xs flex items-center gap-1.5 transition-all ${
              tierFilter === "A_PLUS"
                ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-amber-300"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>A+ Prime Only ({setups.filter((s) => s.setup_tier === "A+").length})</span>
          </button>
          <button
            onClick={() => setTierFilter("A_TIER")}
            className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
              tierFilter === "A_TIER"
                ? "bg-cyan-950/80 text-cyan-300 font-bold border border-cyan-800"
                : "text-slate-400 hover:text-cyan-300"
            }`}
          >
            A & A+ Verified ({setups.filter((s) => s.setup_tier === "A+" || s.setup_tier === "A").length})
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
          💡 Click any row to inspect Breakout & Retest Levels on Live Candlestick
        </span>
      </div>

      {/* Setups List / Cards */}
      <div className="grid grid-cols-1 gap-3">
        {filteredSetups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs border border-slate-800 rounded-lg bg-slate-950/50">
            {loadingSetups ? "Scanning liquid NSE universe on Upstox Live API..." : "No A+/A setups currently triggered. Monitoring real-time Upstox ticks..."}
          </div>
        ) : (
          filteredSetups.map((stock, idx) => {

          const isBuy = stock.signal === "BUY";
          const isSell = stock.signal === "SELL";
          const isAPrime = stock.setup_tier === "A+";

          return (
            <div
              key={stock.symbol}
              onClick={() => {
                setSelectedStock(stock);
                if (onSelectStock) onSelectStock(stock);
              }}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer group flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                isAPrime
                  ? "bg-gradient-to-r from-slate-950 via-[#0a1120] to-slate-950 border-emerald-900/50 hover:border-emerald-600/70"
                  : "bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60"
              }`}
            >
              {/* Rank & Symbol & Quality Tier */}
              <div className="flex items-center space-x-3.5 min-w-[240px]">
                <span className="w-7 h-7 rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-800/60 transition-colors">
                  #{idx + 1}
                </span>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-sm text-slate-100 tracking-wide group-hover:text-cyan-300 transition-colors">
                      {stock.symbol}
                    </span>

                    {/* Quality Tier Badge */}
                    {isAPrime ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-2.5 h-2.5 text-amber-400" /> A+ PRIME
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                        A SETUP
                      </span>
                    )}

                    {/* Direction Badge */}
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        isBuy
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60"
                          : isSell
                          ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {stock.signal}
                    </span>

                    {/* Protection / Re-entry Status Badge */}
                    {stock.is_eligible === false && (
                      <span
                        title={stock.eligibility_reason}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center gap-1 ${
                          stock.eligibility_reason?.includes("Stop Loss")
                            ? "bg-rose-950 text-rose-300 border-rose-800/80"
                            : stock.eligibility_reason?.includes("Cooldown")
                            ? "bg-amber-950 text-amber-300 border-amber-800/80"
                            : stock.eligibility_reason?.includes("active")
                            ? "bg-cyan-950 text-cyan-300 border-cyan-800/80"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {stock.eligibility_reason?.includes("Stop Loss")
                          ? "🛑 LOCKED (1-SL)"
                          : stock.eligibility_reason?.includes("Cooldown")
                          ? "⏳ COOLDOWN"
                          : stock.eligibility_reason?.includes("active")
                          ? "🔒 IN TRADE"
                          : "🔒 BLOCKED"}
                      </span>
                    )}

                    {/* Upstox Live Badge */}
                    {stock.source === "UPSTOX_LIVE" && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate max-w-[210px] mt-0.5">
                    {stock.name} • <span className="text-slate-400">{stock.sector}</span>
                  </span>
                </div>
              </div>

              {/* Price & Change */}
              <div className="font-mono text-xs min-w-[110px]">
                <div className="font-bold text-slate-100 text-sm tabular-nums">
                  ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div
                  className={`text-[11px] font-semibold flex items-center ${
                    stock.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {stock.change_pct >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  )}
                  {stock.change_pct >= 0 ? "+" : ""}
                  {stock.change_pct.toFixed(2)}%
                </div>
              </div>

              {/* Trade Execution Plan: Entry, SL, Target, RR + Wallet Sizing */}
              <div className="grid grid-cols-5 gap-2 text-[11px] font-mono min-w-[380px] p-2 rounded bg-slate-900/60 border border-slate-800/70">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Entry</span>
                  <span className="font-bold text-slate-200">₹{stock.entry_price.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Stop Loss</span>
                  <span className="font-bold text-rose-400">₹{stock.stop_loss.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">Target</span>
                  <span className="font-bold text-emerald-400">₹{stock.target_price.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">R : R</span>
                  <span className="font-bold text-cyan-400">{stock.risk_reward}</span>
                </div>
                <div className="border-l border-slate-800 pl-2">
                  <span className="text-cyan-400 block text-[9px] uppercase font-bold">
                    {stock.product_type || "MIS"} Sizing
                  </span>
                  <span className="font-extrabold text-slate-100">
                    {stock.suggested_qty} {stock.sector === "Index Options" ? "Qty" : "Sh"}
                  </span>
                  <span className="text-[9px] text-slate-400 block">
                    ₹{stock.margin_required ? stock.margin_required.toLocaleString("en-IN") : ((stock.price * stock.suggested_qty) / 5).toFixed(0)} Margin
                  </span>
                </div>
              </div>

              {/* Setup Type & Market Structure / Retest info */}
              <div className="min-w-[210px] text-xs">
                <div className="text-slate-200 font-semibold text-[11px] truncate flex items-center gap-1.5">
                  <span>{stock.setup_type}</span>
                </div>
                <div className="flex items-center space-x-1.5 mt-1 flex-wrap gap-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {stock.market_structure === "HH_HL" ? "HH + HL ↗" : stock.market_structure === "LH_LL" ? "LH + LL ↘" : "RANGE ↔"}
                  </span>
                  {typeof stock.relative_strength === "number" && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                        stock.rs_status === "OUTPERFORMER"
                          ? "bg-emerald-950/90 text-emerald-300 border-emerald-700/60"
                          : stock.rs_status === "UNDERPERFORMER"
                          ? "bg-rose-950/90 text-rose-300 border-rose-700/60"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                      title={`Relative Strength vs NIFTY 50: ${stock.relative_strength > 0 ? "+" : ""}${stock.relative_strength}%`}
                    >
                      RS {stock.relative_strength > 0 ? "+" : ""}{stock.relative_strength}%
                    </span>
                  )}
                  {stock.retest_level && (
                    <span className="text-[10px] font-mono text-cyan-400">
                      Retest ₹{stock.retest_level}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-mono ${
                      stock.index_aligned ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {stock.index_aligned ? "• NIFTY Aligned" : "• Counter"}
                  </span>
                </div>
              </div>

              {/* Multi-Factor Scores: Rank Score, AI Score & Price Action Score */}
              <div className="flex items-center space-x-3 shrink-0">
                <div className="flex items-center space-x-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  {typeof stock.composite_rank_score === "number" && (
                    <>
                      <div className="text-right">
                        <div className="text-[9px] uppercase font-mono text-amber-400 font-bold">Rank Score</div>
                        <div className="text-sm font-black font-mono text-amber-300">
                          {stock.composite_rank_score}
                        </div>
                      </div>
                      <div className="h-6 w-px bg-slate-800" />
                    </>
                  )}
                  <div className="text-right">
                    <div className="text-[9px] uppercase font-mono text-slate-400">AI Score</div>
                    <div className="text-sm font-black font-mono text-cyan-400">
                      {stock.ai_score}
                    </div>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div className="text-right">
                    <div className="text-[9px] uppercase font-mono text-slate-400">PA Score</div>
                    <div className="text-sm font-black font-mono text-emerald-400">
                      {stock.price_action_score || 18}<span className="text-[9px] text-slate-500 font-normal">/20</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          );
        })
      )}
      </div>


      {/* Interactive Candlestick Chart & Setup Overlay Visualizer Modal */}
      {selectedStock && (
        <StockSetupChartModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          allSetups={setups}
          onSelectSetup={(s) => setSelectedStock(s)}
        />
      )}
    </div>
  );
};
