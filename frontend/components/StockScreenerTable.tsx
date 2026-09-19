"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
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
  RefreshCw,
  Activity,
  Radio,
} from "lucide-react";
import { StockSetupItem } from "./TopStockSetups";
import { StockSetupChartModal } from "./StockSetupChartModal";

interface StockScreenerTableProps {
  onSelectStock?: (stock: StockSetupItem) => void;
}

export const StockScreenerTable: React.FC<StockScreenerTableProps> = ({
  onSelectStock,
}) => {
  const [stocks, setStocks] = useState<StockSetupItem[]>([]);
  const [funnel, setFunnel] = useState<any>({
    universe_scanned: 2048,
    liquidity_passed: 185,
    technical_setups: 24,
    price_action_verified: 5,
    top_ranked: 5,
  });
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [alignedOnly, setAlignedOnly] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalStock, setModalStock] = useState<StockSetupItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLiveFeed, setIsLiveFeed] = useState(true);

  const fetchScreenerData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(apiUrl(`/api/v1/market/screener?_t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        const incoming = data.all_screened_stocks || data.top_setups;
        if (incoming && incoming.length > 0) {
          setStocks(incoming);
          setIsLiveFeed(incoming.some((s: any) => s.source === "UPSTOX_LIVE"));
        }
        if (data.funnel) {
          setFunnel(data.funnel);
        }
        setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour12: false }));
      }
    } catch (err) {
      console.warn("Error fetching screener live quotes:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreenerData();
    const interval = setInterval(fetchScreenerData, 4000);
    const handlePlan = () => fetchScreenerData();
    if (typeof window !== "undefined") {
      window.addEventListener("trado_plan_updated", handlePlan);
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("trado_plan_updated", handlePlan);
      }
    };
  }, [fetchScreenerData]);

  const sectors = ["ALL", "Banking", "Energy & Oil", "IT", "Metals", "Telecom"];

  const filtered = stocks.filter((stock) => {
    if (selectedSector !== "ALL" && stock.sector !== selectedSector && !stock.sector.toLowerCase().includes(selectedSector.toLowerCase())) {
      return false;
    }
    if (signalFilter === "BUY" && stock.signal !== "BUY") return false;
    if (signalFilter === "SELL" && stock.signal !== "SELL") return false;
    if (signalFilter === "HIGH_SCORE" && stock.ai_score < 80) return false;
    if (tierFilter !== "ALL" && stock.setup_tier !== tierFilter) return false;
    if (alignedOnly && !stock.index_aligned) return false;
    if (eligibleOnly && stock.is_eligible === false) return false;
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
          <span className="text-2xl font-black font-mono text-slate-100">
            {funnel.universe_scanned?.toLocaleString() || "2,048"}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            NSE Master Equities
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">
            Stage 2: Liquidity & Vol
          </span>
          <span className="text-2xl font-black font-mono text-cyan-400">
            {funnel.liquidity_passed || 185}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Vol &gt; 500k • RVOL &ge; 1.2x
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-mono text-slate-400 block uppercase">
            Stage 3: Strategy Setups
          </span>
          <span className="text-2xl font-black font-mono text-slate-300">
            {funnel.technical_setups || 24}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            VWAP • EMA 9/20 • ORB
          </span>
        </div>

        <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
          <span className="text-[11px] font-mono text-emerald-400 block uppercase font-bold">
            Stage 4: PA Verified
          </span>
          <span className="text-2xl font-black font-mono text-emerald-400">
            {funnel.price_action_verified || 5} High Grade
          </span>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">
            Structure • Retest • S/R
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/80 border border-amber-500/30 bg-amber-950/10">
          <span className="text-[11px] font-mono text-amber-300 block uppercase font-bold">
            Stage 5: Top Ranked
          </span>
          <span className="text-2xl font-black font-mono text-amber-400">
            {funnel.top_ranked || 5} Primed
          </span>
          <span className="text-[10px] text-amber-300/80 block mt-0.5">
            Index Aligned • RR &ge; 1:2.0
          </span>
        </div>
      </div>

      {/* Filter Controls & Live Status Bar */}
      <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Live Feed Status Badge & Refresh Button */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full inline-block ${isLiveFeed ? "bg-emerald-400 animate-pulse" : "bg-cyan-400"}`} />
              <span className={isLiveFeed ? "text-emerald-400 font-bold" : "text-cyan-400 font-bold"}>
                {isLiveFeed ? "UPSTOX API V2 LIVE" : "LIVE FEED ACTIVE"}
              </span>
              {lastUpdated && (
                <span className="text-[10px] text-slate-500 ml-1">
                  • {lastUpdated}
                </span>
              )}
            </div>

            <button
              onClick={() => fetchScreenerData()}
              disabled={isLoading}
              className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
              title="Refresh Screener Data from Upstox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 max-w-xs">
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

            {/* Entry Eligible Only Checkbox */}
            <label
              className="flex items-center space-x-1.5 p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 cursor-pointer font-mono text-[11px]"
              title="Hide locked (1-SL) and cooldown stocks"
            >
              <input
                type="checkbox"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
                className="accent-cyan-500 rounded"
              />
              <span>Entry Ready Only</span>
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
                const isUpstox = stock.source === "UPSTOX_LIVE";

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
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <span className="font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                          {stock.symbol}
                        </span>
                        {isUpstox && (
                          <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                            LIVE
                          </span>
                        )}
                        {stock.is_eligible === false && (
                          <span
                            title={stock.eligibility_reason}
                            className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border ${
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
                              ? "🛑 LOCKED"
                              : stock.eligibility_reason?.includes("Cooldown")
                              ? "⏳ COOLDOWN"
                              : stock.eligibility_reason?.includes("active")
                              ? "🔒 IN TRADE"
                              : "🔒 BLOCKED"}
                          </span>
                        )}
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
                      <div className="flex flex-col items-start gap-1">
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
                        {stock.is_eligible === false && (
                          <span
                            title={stock.eligibility_reason}
                            className="text-[9px] font-mono text-rose-400/90 truncate max-w-[85px]"
                          >
                            {stock.eligibility_reason?.includes("Stop Loss")
                              ? "1-SL Lock"
                              : stock.eligibility_reason?.includes("Cooldown")
                              ? "Cooldown"
                              : "Active Pos"}
                          </span>
                        )}
                      </div>
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
          allSetups={stocks}
          onSelectSetup={(s) => setModalStock(s)}
        />
      )}
    </div>
  );
};
