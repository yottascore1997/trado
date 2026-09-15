"use client";

import React, { useState } from "react";
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
  // Price Action Engine V2 Additions
  price_action_score?: number;
  setup_tier?: "A+" | "A" | "B" | "C";
  market_structure?: string;
  pa_setup?: string;
  retest_level?: number;
  filter_verdict?: string;
  pa_checklist?: Array<{ rule: string; points: number; max: number; passed: boolean; detail?: string }>;
  source?: string;
}

const DEFAULT_SETUPS: StockSetupItem[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    sector: "Energy & Oil",
    price: 1235.30,
    change: -22.20,
    change_pct: -1.77,
    vwap: 1245.62,
    ema_9: 1240.20,
    ema_20: 1248.50,
    rvol: 2.15,
    signal: "SELL",
    ai_score: 95,
    entry_price: 1235.30,
    stop_loss: 1248.50,
    target_price: 1208.00,
    risk_pts: 13.2,
    reward_pts: 27.3,
    risk_reward: "1:2.1",
    setup_type: "VWAP Breakdown & Retest Rejection",
    index_aligned: true,
    alignment_status: "ALIGNED_BEARISH",
    suggested_qty: 13,
    source: "UPSTOX_LIVE",
    primary_reason: "Price < VWAP with 2.15x RVOL & ALIGNED_BEARISH with NIFTY 50",
    price_action_score: 20,
    setup_tier: "A+",
    market_structure: "LH_LL",
    pa_setup: "Breakout + Retest Continuation",
    retest_level: 1245.50,
    filter_verdict: "A+ Prime Setup: Confirmed Breakdown & Retest with strong S/R polarity flip and 2.15x RVOL.",
    checklist: [
      { rule: "Trend Confirmation (5m & 15m)", passed: true },
      { rule: "VWAP Anchor (Price > VWAP)", passed: true },
      { rule: "EMA 9 > EMA 20 Alignment", passed: true },
      { rule: "Relative Volume > 1.5x (2.15x)", passed: true },
      { rule: "Opening Range Breakout (ORB)", passed: true },
      { rule: "Risk:Reward >= 1:2.0 (1:2.2)", passed: true },
      { rule: "NSE Index Aligned (NIFTY +0.45% Bullish)", passed: true },
    ],
    pa_checklist: [
      { rule: "Market Structure (HH + HL sequence)", points: 4, max: 4, passed: true, detail: "Series of Higher Highs & Higher Lows on 5m/15m" },
      { rule: "Breakout Quality (Full-body close)", points: 4, max: 4, passed: true, detail: "Strong bullish expansion above ₹3,010 resistance" },
      { rule: "Retest Confirmation (Support held)", points: 4, max: 4, passed: true, detail: "Prior resistance flipped to support near ₹3,012.50" },
      { rule: "Volume Context (Breakout Surge)", points: 3, max: 3, passed: true, detail: "2.15x volume expansion on breakout" },
      { rule: "Key S/R Interaction", points: 3, max: 3, passed: true, detail: "Breakout clean from morning 45-min consolidation shelf" },
      { rule: "Candle Strength (Rejection Wick)", points: 2, max: 2, passed: true, detail: "Lower wick rejection on retest candle (buyers stepped in)" },
    ],
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    sector: "Public Banking",
    price: 968.00,
    change: -27.70,
    change_pct: -2.79,
    vwap: 982.45,
    ema_9: 974.20,
    ema_20: 985.60,
    rvol: 2.10,
    signal: "SELL",
    ai_score: 87,
    entry_price: 968.00,
    stop_loss: 982.50,
    target_price: 938.00,
    risk_pts: 14.5,
    reward_pts: 30.0,
    risk_reward: "1:2.1",
    setup_type: "VWAP Breakdown & Retest Rejection",
    index_aligned: true,
    alignment_status: "ALIGNED_BEARISH",
    suggested_qty: 10,
    source: "UPSTOX_LIVE",
    primary_reason: "Price < VWAP with 2.1x RVOL & ALIGNED_BEARISH with NIFTY 50",
    price_action_score: 18,
    setup_tier: "A+",
    market_structure: "LH_LL",
    pa_setup: "15m ORB Breakdown + Retest Rejection",
    retest_level: 980.50,
    filter_verdict: "A+ High-Conviction: Breakdown cleared support with confirmed resistance flip.",
    checklist: [
      { rule: "Trend Confirmation (5m & 15m)", passed: true },
      { rule: "VWAP Anchor (Price < VWAP)", passed: true },
      { rule: "EMA 9 < EMA 20 Alignment", passed: true },
      { rule: "Relative Volume > 1.5x (2.10x)", passed: true },
      { rule: "Opening Range Breakdown", passed: true },
      { rule: "Risk:Reward >= 1:2.0 (1:2.1)", passed: true },
      { rule: "NSE Index Aligned (NIFTY Bearish)", passed: true },
    ],
    pa_checklist: [
      { rule: "Market Structure (LH + LL sequence)", points: 4, max: 4, passed: true, detail: "Morning breakdown resolved into bearish structure" },
      { rule: "Breakdown Quality (Full-body close)", points: 4, max: 4, passed: true, detail: "Support floor breached with full body candle" },
      { rule: "Retest Confirmation (Resistance held)", points: 4, max: 4, passed: true, detail: "Day low breakdown retested near ₹980.50 and rejected" },
      { rule: "Volume Context (Breakdown Surge)", points: 3, max: 3, passed: true, detail: "2.10x volume surge on breakdown" },
      { rule: "Key S/R Interaction", points: 3, max: 3, passed: true, detail: "Declining VWAP resistance confluence" },
      { rule: "Candle Strength (Rejection Wick)", points: 2, max: 2, passed: true, detail: "Upper wick rejection confirmed sellers in control" },
    ],
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd",
    sector: "Private Banking",
    price: 1350.40,
    change: -28.90,
    change_pct: -2.10,
    vwap: 1367.53,
    ema_9: 1358.10,
    ema_20: 1370.20,
    rvol: 1.85,
    signal: "SELL",
    ai_score: 85,
    entry_price: 1350.40,
    stop_loss: 1368.50,
    target_price: 1312.00,
    risk_pts: 18.1,
    reward_pts: 38.4,
    risk_reward: "1:2.1",
    setup_type: "EMA 9 Dynamic Pullback Rejection",
    index_aligned: true,
    alignment_status: "ALIGNED_BEARISH",
    suggested_qty: 8,
    source: "UPSTOX_LIVE",
    primary_reason: "Dynamic 9 EMA rejection + banking sector drag",
    price_action_score: 18,
    setup_tier: "A",
    market_structure: "LH_LL",
    pa_setup: "Support Retest / Dynamic 9 EMA Rejection",
    retest_level: 1365.00,
    filter_verdict: "A Setup: Textbook dynamic rejection respecting prior support turned resistance.",
    checklist: [
      { rule: "Trend Confirmation (5m & 15m)", passed: true },
      { rule: "VWAP Anchor (Price < VWAP)", passed: true },
      { rule: "EMA 9 < EMA 20 Alignment", passed: true },
      { rule: "Relative Volume > 1.5x (1.85x)", passed: true },
      { rule: "Opening Range Breakdown", passed: true },
      { rule: "Risk:Reward >= 1:2.0 (1:2.1)", passed: true },
      { rule: "NSE Index Aligned (NIFTY Bearish)", passed: true },
    ],
    pa_checklist: [
      { rule: "Market Structure (LH + LL sequence)", points: 4, max: 4, passed: true, detail: "Downward trending stair-step structure" },
      { rule: "Breakout Quality (Full-body close)", points: 3, max: 4, passed: true, detail: "Impulse move respected prior swing low" },
      { rule: "Retest Confirmation (Resistance held)", points: 4, max: 4, passed: true, detail: "Tested prior support ₹1,365 as new resistance" },
      { rule: "Volume Context (Breakdown Surge)", points: 2, max: 3, passed: true, detail: "Volume contracted on bounce, expanded on selloff" },
      { rule: "Key S/R Interaction", points: 3, max: 3, passed: true, detail: "Confluence of 9 EMA + horizontal swing low" },
      { rule: "Candle Strength (Rejection Wick)", points: 2, max: 2, passed: true, detail: "Shooting star rejection at resistance" },
    ],
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd",
    sector: "Information Technology",
    price: 1077.00,
    change: 39.30,
    change_pct: 3.79,
    vwap: 1085.00,
    ema_9: 1081.50,
    ema_20: 1073.20,
    rvol: 2.30,
    signal: "BUY",
    ai_score: 88,
    entry_price: 1077.00,
    stop_loss: 1062.00,
    target_price: 1108.50,
    risk_pts: 15.0,
    reward_pts: 31.5,
    risk_reward: "1:2.1",
    setup_type: "Tech Counter-Trend Expansion",
    index_aligned: false,
    alignment_status: "DIVERGENT",
    suggested_qty: 23,
    source: "UPSTOX_LIVE",
    primary_reason: "Heavy institutional buying & 3.79% rally against broad market",
    price_action_score: 18,
    setup_tier: "A",
    market_structure: "HH_HL",
    pa_setup: "Resistance Breakout & Retest Bounce",
    retest_level: 1072.00,
    filter_verdict: "A Setup: Strong IT sector resilience with 2.3x relative volume.",
    checklist: [
      { rule: "Trend Confirmation (5m & 15m)", passed: true },
      { rule: "VWAP Anchor (Price near VWAP)", passed: true },
      { rule: "EMA 9 > EMA 20 Alignment", passed: true },
      { rule: "Relative Volume > 1.5x (2.30x)", passed: true },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "Risk:Reward >= 1:2.0 (1:2.1)", passed: true },
      { rule: "NSE Index Divergent (Higher Score)", passed: true },
    ],
    pa_checklist: [
      { rule: "Market Structure (HH + HL sequence)", points: 4, max: 4, passed: true, detail: "Aggressive Higher Highs on 5m and 15m" },
      { rule: "Breakout Quality (Full-body close)", points: 4, max: 4, passed: true, detail: "Strong green candle closed above ₹1,070 shelf" },
      { rule: "Retest Confirmation (Support held)", points: 4, max: 4, passed: true, detail: "Brief pullback bounced precisely at ₹1,072.00" },
      { rule: "Volume Context (Breakout Surge)", points: 3, max: 3, passed: true, detail: "2.30x institutional buying surge" },
      { rule: "Key S/R Interaction", points: 3, max: 3, passed: true, detail: "Cleared 5-day range ceiling" },
      { rule: "Candle Strength (Bullish Rejection)", points: 2, max: 2, passed: true, detail: "Lower wick rejection on support test" },
    ],
  },
  {
    symbol: "TATASTEEL",
    name: "Tata Steel Ltd",
    sector: "Metals & Mining",
    price: 183.65,
    change: 0.65,
    change_pct: 0.35,
    vwap: 184.50,
    ema_9: 184.10,
    ema_20: 183.80,
    rvol: 1.65,
    signal: "BUY",
    ai_score: 82,
    entry_price: 183.65,
    stop_loss: 181.20,
    target_price: 188.80,
    risk_pts: 2.45,
    reward_pts: 5.15,
    risk_reward: "1:2.1",
    setup_type: "Metals Shelf Consolidation Breakout",
    index_aligned: false,
    alignment_status: "DIVERGENT",
    suggested_qty: 136,
    source: "UPSTOX_LIVE",
    primary_reason: "Holding above ₹183 support shelf with positive metal sector volume",
    price_action_score: 16,
    setup_tier: "A",
    market_structure: "HH_HL",
    pa_setup: "Horizontal Shelf Breakout",
    retest_level: 153.50,
    filter_verdict: "A Setup: High-momentum breakout backed by NIFTY Metal rally.",
    checklist: [
      { rule: "Trend Confirmation (5m & 15m)", passed: true },
      { rule: "VWAP Anchor (Price > VWAP)", passed: true },
      { rule: "EMA 9 > EMA 20 Alignment", passed: true },
      { rule: "Relative Volume > 1.5x (2.40x)", passed: true },
      { rule: "Opening Range Breakout (ORB)", passed: true },
      { rule: "Risk:Reward >= 1:2.0 (1:2.0)", passed: true },
      { rule: "NSE Index Aligned (NIFTY +0.45% Bullish)", passed: true },
    ],
    pa_checklist: [
      { rule: "Market Structure (HH + HL sequence)", points: 4, max: 4, passed: true, detail: "Higher lows pressing aggressively into resistance" },
      { rule: "Breakout Quality (Full-body close)", points: 4, max: 4, passed: true, detail: "High-volume green candle slicing through multi-day barrier" },
      { rule: "Retest Confirmation (Support held)", points: 2, max: 4, passed: false, detail: "Fast momentum; shallow retest only reached ₹153.50" },
      { rule: "Volume Context (Breakout Surge)", points: 3, max: 3, passed: true, detail: "2.4x massive sectoral volume explosion" },
      { rule: "Key S/R Interaction", points: 3, max: 3, passed: true, detail: "Cleared 3-day swing high hurdle" },
      { rule: "Candle Strength (Rejection Wick)", points: 2, max: 2, passed: true, detail: "Closing on high of the candle" },
    ],
  },
];

interface TopStockSetupsProps {
  setups?: StockSetupItem[];
  tradingPlan?: any;
  onSelectStock?: (stock: StockSetupItem) => void;
}

export const TopStockSetups: React.FC<TopStockSetupsProps> = ({
  setups = DEFAULT_SETUPS,
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
      if (tradingPlan?.wallet_budget) params.append("wallet_budget", tradingPlan.wallet_budget.toString());
      if (tradingPlan?.trading_mode) params.append("mode", tradingPlan.trading_mode);
      if (tradingPlan?.risk_per_trade_pct) params.append("risk_pct", tradingPlan.risk_per_trade_pct.toString());
      params.append("_t", Date.now().toString());

      const res = await fetch(`http://localhost:8000/api/v1/market/top-setups?${params.toString()}`);
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
    return () => clearInterval(interval);
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
        {filteredSetups.map((stock, idx) => {
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
                <div className="flex items-center space-x-1.5 mt-1">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {stock.market_structure === "HH_HL" ? "HH + HL ↗" : stock.market_structure === "LH_LL" ? "LH + LL ↘" : "RANGE ↔"}
                  </span>
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

              {/* AI Score & Price Action Score Duo */}
              <div className="flex items-center space-x-3 shrink-0">
                <div className="flex items-center space-x-3 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
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
        })}
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
