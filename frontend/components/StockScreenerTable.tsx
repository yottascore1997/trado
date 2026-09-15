"use client";

import React, { useState } from "react";
import {
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import { StockSetupItem } from "./TopStockSetups";
import { StockSetupChartModal } from "./StockSetupChartModal";

interface StockScreenerTableProps {
  onSelectStock?: (stock: StockSetupItem) => void;
}

const ALL_SCREENED_STOCKS: StockSetupItem[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    sector: "Energy & Oil",
    price: 3027.85,
    change: 42.35,
    change_pct: 1.42,
    vwap: 3013.35,
    ema_9: 3022.65,
    ema_20: 3015.05,
    rvol: 2.15,
    signal: "BUY",
    ai_score: 91,
    entry_price: 3027.85,
    stop_loss: 3001.45,
    target_price: 3085.95,
    risk_pts: 26.4,
    reward_pts: 58.1,
    risk_reward: "1:2.2",
    setup_type: "VWAP Breakout + Volume Spike",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 19,
    primary_reason: "Price > VWAP with 2.15x RVOL & ALIGNED_BULLISH with NIFTY 50",
    price_action_score: 20,
    setup_tier: "A+",
    market_structure: "HH_HL",
    pa_setup: "Breakout + Retest Continuation",
    retest_level: 3012.50,
    filter_verdict: "A+ Prime Setup: Confirmed Breakout & Retest with strong S/R polarity flip and 2.15x RVOL.",
    checklist: [
      { rule: "Trend Bullish (5m/15m)", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x (2.15x)", passed: true },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "RR >= 1:2.0", passed: true },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    sector: "Banking",
    price: 830.25,
    change: 15.05,
    change_pct: 1.85,
    vwap: 826.05,
    ema_9: 828.45,
    ema_20: 826.35,
    rvol: 1.95,
    signal: "BUY",
    ai_score: 88,
    entry_price: 830.25,
    stop_loss: 822.0,
    target_price: 847.55,
    risk_pts: 8.25,
    reward_pts: 17.3,
    risk_reward: "1:2.1",
    setup_type: "15m ORB Breakout",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 60,
    primary_reason: "15m Range Breakout with 1.95x RVOL + Banking strength",
    price_action_score: 18,
    setup_tier: "A+",
    market_structure: "HH_HL",
    pa_setup: "15m ORB + Retest Bounce",
    retest_level: 826.50,
    filter_verdict: "A+ High-Conviction: 15m ORB cleared resistance with confirmed pullback hold.",
    checklist: [
      { rule: "Trend Bullish (5m/15m)", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x (1.95x)", passed: true },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "RR >= 1:2.0", passed: true },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd",
    sector: "Banking",
    price: 1254.60,
    change: 11.80,
    change_pct: 0.95,
    vwap: 1249.10,
    ema_9: 1252.50,
    ema_20: 1249.80,
    rvol: 1.70,
    signal: "BUY",
    ai_score: 85,
    entry_price: 1254.60,
    stop_loss: 1242.50,
    target_price: 1278.80,
    risk_pts: 12.1,
    reward_pts: 24.2,
    risk_reward: "1:2.0",
    setup_type: "EMA 9 Dynamic Pullback",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 41,
    primary_reason: "Tested 9 EMA support during bull continuation",
    price_action_score: 18,
    setup_tier: "A",
    market_structure: "HH_HL",
    pa_setup: "Support Retest / Dynamic 9 EMA",
    retest_level: 1248.00,
    filter_verdict: "A Setup: Textbook dynamic pullback respecting prior resistance turned support.",
    checklist: [
      { rule: "Trend Bullish (5m/15m)", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x (1.70x)", passed: true },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "RR >= 1:2.0", passed: true },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd",
    sector: "IT",
    price: 1865.0,
    change: -23.6,
    change_pct: -1.25,
    vwap: 1876.2,
    ema_9: 1869.5,
    ema_20: 1874.8,
    rvol: 1.85,
    signal: "SELL",
    ai_score: 83,
    entry_price: 1865.0,
    stop_loss: 1882.6,
    target_price: 1824.5,
    risk_pts: 17.6,
    reward_pts: 40.5,
    risk_reward: "1:2.3",
    setup_type: "VWAP Breakdown + Tech Drag",
    index_aligned: false,
    alignment_status: "COUNTER_TREND",
    suggested_qty: 28,
    primary_reason: "Heavy institutional selling below VWAP; Sector divergence",
    price_action_score: 18,
    setup_tier: "A",
    market_structure: "LH_LL",
    pa_setup: "Support Breakdown & Retest Rejection",
    retest_level: 1874.00,
    filter_verdict: "A Short Setup: Clean support-turned-resistance breakdown (Note: Macro Divergence with NIFTY).",
    checklist: [
      { rule: "Trend Bearish (5m/15m)", passed: true },
      { rule: "Price < VWAP", passed: true },
      { rule: "EMA 9 < EMA 20", passed: true },
      { rule: "RVOL > 1.5x (1.85x)", passed: true },
      { rule: "Opening Range Breakdown", passed: true },
      { rule: "RR >= 1:2.0", passed: true },
      { rule: "Counter-Trend Caution", passed: true },
    ],
  },
  {
    symbol: "TATASTEEL",
    name: "Tata Steel Ltd",
    sector: "Metals",
    price: 154.85,
    change: 2.45,
    change_pct: 1.60,
    vwap: 153.65,
    ema_9: 154.35,
    ema_20: 153.75,
    rvol: 2.40,
    signal: "BUY",
    ai_score: 81,
    entry_price: 154.85,
    stop_loss: 152.65,
    target_price: 159.25,
    risk_pts: 2.2,
    reward_pts: 4.4,
    risk_reward: "1:2.0",
    setup_type: "High RVOL Sector Momentum",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 227,
    primary_reason: "2.4x volume surge + NIFTY Metal rally support",
    price_action_score: 16,
    setup_tier: "A",
    market_structure: "HH_HL",
    pa_setup: "Horizontal Shelf Breakout",
    retest_level: 153.50,
    filter_verdict: "A Setup: High-momentum breakout backed by NIFTY Metal rally.",
    checklist: [
      { rule: "Trend Bullish (5m/15m)", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x (2.40x)", passed: true },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "RR >= 1:2.0", passed: true },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    sector: "Banking",
    price: 1655.70,
    change: 3.30,
    change_pct: 0.20,
    vwap: 1654.70,
    ema_9: 1655.30,
    ema_20: 1654.90,
    rvol: 1.10,
    signal: "NO_TRADE",
    ai_score: 64,
    entry_price: 1655.70,
    stop_loss: 1643.70,
    target_price: 1670.70,
    risk_pts: 12.0,
    reward_pts: 15.0,
    risk_reward: "1:1.2",
    setup_type: "Range Bound Near VWAP",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 41,
    primary_reason: "Insufficient RVOL (1.1x < 1.5x) + Low RR 1:1.2",
    price_action_score: 3,
    setup_tier: "C",
    market_structure: "SIDEWAYS_CHOP",
    pa_setup: "Range Bound Congestion",
    retest_level: 1650.00,
    filter_verdict: "C Setup (FILTERED): Price Action blocks trade. Choppy range-bound action with no breakout or structure.",
    checklist: [
      { rule: "Trend Bullish", passed: false },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x", passed: false },
      { rule: "Opening Range Breakout", passed: false },
      { rule: "RR >= 1:2.0", passed: false },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services Ltd",
    sector: "IT",
    price: 4268.0,
    change: 13.0,
    change_pct: 0.31,
    vwap: 4262.0,
    ema_9: 4265.0,
    ema_20: 4260.0,
    rvol: 1.25,
    signal: "NO_TRADE",
    ai_score: 66,
    entry_price: 4268.0,
    stop_loss: 4238.0,
    target_price: 4310.0,
    risk_pts: 30.0,
    reward_pts: 42.0,
    risk_reward: "1:1.4",
    setup_type: "Midday Sideways Range",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 16,
    primary_reason: "Sub-threshold RVOL (1.25x); Low volatility expansion",
    price_action_score: 6,
    setup_tier: "B",
    market_structure: "SIDEWAYS_CHOP",
    pa_setup: "Midday Sideways Range",
    filter_verdict: "B Setup (Watchlist): Low volatility expansion with sub-threshold volume.",
    checklist: [
      { rule: "Trend Bullish", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x", passed: false },
      { rule: "Opening Range Breakout", passed: false },
      { rule: "RR >= 1:2.0", passed: false },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel Ltd",
    sector: "Telecom",
    price: 1572.50,
    change: 8.50,
    change_pct: 0.54,
    vwap: 1568.0,
    ema_9: 1570.0,
    ema_20: 1566.0,
    rvol: 1.35,
    signal: "NO_TRADE",
    ai_score: 68,
    entry_price: 1572.50,
    stop_loss: 1558.0,
    target_price: 1598.0,
    risk_pts: 14.5,
    reward_pts: 25.5,
    risk_reward: "1:1.7",
    setup_type: "Consolidation After Gap Up",
    index_aligned: true,
    alignment_status: "ALIGNED_BULLISH",
    suggested_qty: 34,
    primary_reason: "Moderate volume (1.35x); Risk reward 1:1.7 below 1:2.0 rule",
    price_action_score: 8,
    setup_tier: "B",
    market_structure: "HH_HL",
    pa_setup: "Consolidation After Gap Up",
    filter_verdict: "B Setup (Watchlist): Consolidating after gap up, pending clean range exit.",
    checklist: [
      { rule: "Trend Bullish", passed: true },
      { rule: "Price > VWAP", passed: true },
      { rule: "EMA 9 > EMA 20", passed: true },
      { rule: "RVOL > 1.5x", passed: false },
      { rule: "Opening Range Breakout", passed: true },
      { rule: "RR >= 1:2.0", passed: false },
      { rule: "NIFTY Direction Aligned", passed: true },
    ],
  },
];

export const StockScreenerTable: React.FC<StockScreenerTableProps> = ({
  onSelectStock,
}) => {
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [alignedOnly, setAlignedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalStock, setModalStock] = useState<StockSetupItem | null>(null);

  const sectors = ["ALL", "Banking", "Energy & Oil", "IT", "Metals", "Telecom"];

  const filtered = ALL_SCREENED_STOCKS.filter((stock) => {
    if (selectedSector !== "ALL" && stock.sector !== selectedSector) return false;
    if (signalFilter === "BUY" && stock.signal !== "BUY") return false;
    if (signalFilter === "SELL" && stock.signal !== "SELL") return false;
    if (signalFilter === "HIGH_SCORE" && stock.ai_score < 80) return false;
    if (tierFilter !== "ALL" && stock.setup_tier !== tierFilter) return false;
    if (alignedOnly && !stock.index_aligned) return false;
    if (
      searchQuery &&
      !stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 5-Stage Funnel Architecture Telemetry */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">
            Stage 1: Universe
          </span>
          <span className="text-2xl font-black font-mono text-slate-100">2,048</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            NSE Master Equities
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">
            Stage 2: Liquidity & Vol
          </span>
          <span className="text-2xl font-black font-mono text-cyan-400">185</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Vol &gt; 500k • RVOL &ge; 1.2x
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">
            Stage 3: Strategy Setups
          </span>
          <span className="text-2xl font-black font-mono text-slate-300">24</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            VWAP • EMA 9/20 • ORB
          </span>
        </div>

        <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
          <span className="text-[11px] font-mono text-emerald-400 block uppercase font-bold">
            Stage 4: PA Verified
          </span>
          <span className="text-2xl font-black font-mono text-emerald-400">5 High Grade</span>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">
            Structure • Retest • S/R
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-amber-500/30 bg-amber-950/10">
          <span className="text-[11px] font-mono text-amber-300 block uppercase font-bold">
            Stage 5: Top Ranked
          </span>
          <span className="text-2xl font-black font-mono text-amber-400">5 Primed</span>
          <span className="text-[10px] text-amber-300/80 block mt-0.5">
            Index Aligned • RR &ge; 1:2.0
          </span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stock symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 outline-none"
            />
          </div>

          {/* Sector Filters */}
          <div className="flex items-center space-x-1 overflow-x-auto text-xs">
            {sectors.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSector(sec)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedSector === sec
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          {/* Signal, Tier & Score Filters */}
          <div className="flex items-center space-x-2 text-xs">
            {/* Setup Quality Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 outline-none font-mono text-xs"
            >
              <option value="ALL">All Tiers (A+, A, B, C)</option>
              <option value="A+">Tier A+ (Prime Setups)</option>
              <option value="A">Tier A (High Conviction)</option>
              <option value="B">Tier B (Watchlist / Weak PA)</option>
              <option value="C">Tier C (Filtered / Choppy)</option>
            </select>

            <select
              value={signalFilter}
              onChange={(e) => setSignalFilter(e.target.value)}
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 outline-none font-mono text-xs"
            >
              <option value="ALL">All Signals</option>
              <option value="BUY">BUY Only</option>
              <option value="SELL">SELL Only</option>
              <option value="HIGH_SCORE">AI Score &gt; 80</option>
            </select>

            {/* Index Alignment Checkbox */}
            <label className="flex items-center space-x-1.5 p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 cursor-pointer font-mono text-[11px]">
              <input
                type="checkbox"
                checked={alignedOnly}
                onChange={(e) => setAlignedOnly(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>NIFTY Aligned Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Screened Stocks Table */}
      <div className="rounded-lg bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left font-mono">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Instrument</th>
                <th className="py-3 px-3">LTP / Change</th>
                <th className="py-3 px-3">PA Tier & Structure</th>
                <th className="py-3 px-3">RVOL</th>
                <th className="py-3 px-3">VWAP Position</th>
                <th className="py-3 px-3">Index Alignment</th>
                <th className="py-3 px-3">AI Score</th>
                <th className="py-3 px-3">PA Score</th>
                <th className="py-3 px-3">Signal</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((stock) => {
                const isBuy = stock.signal === "BUY";
                const isSell = stock.signal === "SELL";
                const priceVsVwap = stock.price - stock.vwap;
                const isAPrime = stock.setup_tier === "A+";

                return (
                  <tr
                    key={stock.symbol}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => {
                      setModalStock(stock);
                      if (onSelectStock) onSelectStock(stock);
                    }}
                  >
                    {/* Symbol & Sector */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                        {stock.symbol}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {stock.sector}
                      </div>
                    </td>

                    {/* Price & Change */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-100 tabular-nums">
                        ₹{stock.price.toFixed(2)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold flex items-center ${
                          stock.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {stock.change_pct >= 0 ? "+" : ""}
                        {stock.change_pct.toFixed(2)}%
                      </div>
                    </td>

                    {/* Quality Tier & Market Structure */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isAPrime
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : stock.setup_tier === "A"
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                              : stock.setup_tier === "B"
                              ? "bg-slate-800 text-slate-300 border border-slate-700"
                              : "bg-rose-950/40 text-rose-400 border border-rose-900/50"
                          }`}
                        >
                          {stock.setup_tier || "B"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {stock.market_structure === "HH_HL" ? "HH+HL ↗" : stock.market_structure === "LH_LL" ? "LH+LL ↘" : "CHOP ↔"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px] font-sans mt-0.5">
                        {stock.setup_type}
                      </div>
                    </td>

                    {/* RVOL */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded border text-[11px] ${
                          stock.rvol >= 2.0
                            ? "bg-purple-950/80 text-purple-300 border-purple-800/60"
                            : stock.rvol >= 1.5
                            ? "bg-cyan-950/80 text-cyan-300 border-cyan-800/60"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        {stock.rvol}x
                      </span>
                    </td>

                    {/* VWAP Position */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-300 font-bold tabular-nums">
                        ₹{stock.vwap.toFixed(2)}
                      </div>
                      <span
                        className={`text-[10px] ${
                          priceVsVwap >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {priceVsVwap >= 0 ? "+" : ""}
                        {priceVsVwap.toFixed(1)} pts
                      </span>
                    </td>

                    {/* Index Alignment Badge */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            stock.index_aligned ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span
                          className={`text-[11px] ${
                            stock.index_aligned ? "text-emerald-300" : "text-amber-300"
                          }`}
                        >
                          {stock.index_aligned ? "Aligned ✅" : "Divergent ⚠️"}
                        </span>
                      </div>
                    </td>

                    {/* AI Score */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-black text-sm ${
                          stock.ai_score >= 85
                            ? "text-cyan-400"
                            : stock.ai_score >= 75
                            ? "text-cyan-300"
                            : "text-slate-400"
                        }`}
                      >
                        {stock.ai_score}
                      </span>
                    </td>

                    {/* Price Action Score */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-bold font-mono text-xs px-1.5 py-0.5 rounded border ${
                          (stock.price_action_score || 18) >= 16
                            ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/50"
                            : (stock.price_action_score || 18) >= 12
                            ? "text-cyan-300 bg-cyan-950/50 border-cyan-800/50"
                            : "text-amber-400 bg-amber-950/30 border-amber-900/40"
                        }`}
                      >
                        {stock.price_action_score || 18}/20
                      </span>
                    </td>

                    {/* Signal */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isBuy
                            ? "bg-emerald-600 text-white"
                            : isSell
                            ? "bg-rose-600 text-white"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {stock.signal}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalStock(stock);
                          if (onSelectStock) onSelectStock(stock);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-semibold cursor-pointer"
                      >
                        Inspect S/R
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Candlestick Chart & Setup Overlay Modal */}
      {modalStock && (
        <StockSetupChartModal
          stock={modalStock}
          onClose={() => setModalStock(null)}
          allSetups={ALL_SCREENED_STOCKS}
          onSelectSetup={(s) => setModalStock(s)}
        />
      )}
    </div>
  );
};
