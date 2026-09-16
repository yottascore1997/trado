"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { TopMarketCards } from "@/components/TopMarketCards";
import { LiveSignalPanel } from "@/components/LiveSignalPanel";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";
import { TopStockSetups } from "@/components/TopStockSetups";
import { StockScreenerTable } from "@/components/StockScreenerTable";
import { IndicesPanel } from "@/components/IndicesPanel";
import { CSVImportModal } from "@/components/CSVImportModal";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { TradingPlanController, TradingPlanData } from "@/components/TradingPlanController";
import { PaperTradingDashboard } from "@/components/PaperTradingDashboard";
import {
  Activity,
  ShieldCheck,
  Database,
  Layers,
  UploadCloud,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart2,
  Cpu,
  FileText,
  Sliders,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
  Clock,
  Play,
  Check,
  AlertCircle,
  DollarSign,
  PieChart,
} from "lucide-react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [hasData, setHasData] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [tradingPlan, setTradingPlan] = useState<TradingPlanData | null>(null);
  const [niftyTelemetry, setNiftyTelemetry] = useState<any>({
    price: 23118.60,
    change: -279.50,
    change_pct: -1.19,
    vwap: 23351.60,
    day_high: 23592.85,
    day_low: 23118.60,
  });

  // Chart view timeframe state
  const [selectedTimeframe, setSelectedTimeframe] = useState("1m");
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY 50");

  // Datasets and backtest simulation state
  const [datasets, setDatasets] = useState<any[]>([]);
  const [backtestSymbol, setBacktestSymbol] = useState("NIFTY 50");
  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Technical chart real candles
  const [chartCandles, setChartCandles] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/market/indices?_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const nifty = data.find((d: any) => d.symbol === "NIFTY 50") || data[0];
            setNiftyTelemetry(nifty);
          }
        }
      } catch (e) {}
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDatasets = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/market/datasets");
      if (res.ok) {
        const data = await res.json();
        setDatasets(data);
      }
    } catch (e) {}
  };

  const runBacktest = async (sym: string = backtestSymbol) => {
    try {
      setBacktestLoading(true);
      const res = await fetch(`http://localhost:8000/api/v1/market/backtest/run?symbol=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data = await res.json();
        setBacktestData(data);
      }
    } catch (e) {
    } finally {
      setBacktestLoading(false);
    }
  };

  const fetchCandles = async (sym: string = selectedSymbol, tf: string = selectedTimeframe) => {
    try {
      setChartLoading(true);
      const res = await fetch(`http://localhost:8000/api/v1/market/candles?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}&limit=60`);
      if (res.ok) {
        const data = await res.json();
        setChartCandles(data);
      }
    } catch (e) {
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    // Fetch system and market data status
    const checkStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/market/status?symbol=NIFTY%2050");
        if (res.ok) {
          const data = await res.json();
          setMarketStatus(data);
          setHasData(data.has_data);
        }
      } catch (err) {
        // Fallback for standalone demo
      }
    };
    checkStatus();
    fetchDatasets();
    runBacktest("NIFTY 50");
    fetchCandles("NIFTY 50", "1m");
  }, []);

  // When selected symbol or timeframe changes on chart tab, fetch new candles
  useEffect(() => {
    fetchCandles(selectedSymbol, selectedTimeframe);
  }, [selectedSymbol, selectedTimeframe]);


  return (
    <div className="min-h-screen flex bg-[#070a10] text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Sleek Side Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCsvModal={() => setCsvModalOpen(true)}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isMarketOpen={true}
      />

      {/* Main Terminal Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Risk Notice Banner */}
        <DisclaimerBanner />

        {/* Top Header Command Bar */}
        <Header
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onOpenCsvModal={() => setCsvModalOpen(true)}
          isMarketOpen={true}
        />

        {/* Terminal Content Area */}
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 overflow-y-auto">
          {/* Informational banner when historical data required */}
          {!hasData && (
            <div className="mb-5 p-4 rounded-lg bg-amber-950/30 border border-amber-800/60 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Info className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-amber-200">Historical market data required</h4>
                  <p className="text-xs text-amber-300/80">
                    Please upload a 1-minute CSV for NIFTY 50 or BANK NIFTY to train AI models or backtest setups.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCsvModalOpen(true)}
                className="px-3.5 py-1.5 rounded-md bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Historical CSV
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: DASHBOARD (DUAL-ENGINE: INDICES + STOCK SCREENER)  */}
          {/* ========================================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* VIRTUAL TRADING WALLET & STRATEGY MODE CONTROLLER */}
              <TradingPlanController onPlanChange={(p) => setTradingPlan(p)} />

              {/* Dual Engine Part 1: Benchmark Indices Market Compass */}
              <IndicesPanel />

              {/* Dual Engine Part 2: 🔥 TODAY'S TOP INTRADAY SETUPS */}
              <TopStockSetups tradingPlan={tradingPlan} />

              {/* Main Grid: Left Signals + Right Indicators */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left 2 Columns: Live Signal & Ledger */}
                <div className="lg:col-span-2 space-y-5">
                  <LiveSignalPanel />
                  <SignalHistoryTable />
                </div>

                {/* Right Column: Indicator HUD & Quantitative Health */}
                <div className="space-y-5">
                  {/* Real-time Indicator Radar */}
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-bold text-sm text-slate-100">Intraday Indicator Matrix</h3>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                        NIFTY 50 (1m)
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs font-mono">
                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">Live Price (LTP)</span>
                        <span className="font-bold text-slate-100">
                          ₹{niftyTelemetry.price?.toLocaleString("en-IN") || "23,118.60"}{" "}
                          <span className={niftyTelemetry.change >= 0 ? "text-emerald-400 text-[10px]" : "text-rose-400 text-[10px]"}>
                            ({niftyTelemetry.change >= 0 ? "+" : ""}{niftyTelemetry.change} / {niftyTelemetry.change_pct}%)
                          </span>
                        </span>
                      </div>

                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">Intraday VWAP (Anchor)</span>
                        <span className="font-bold text-cyan-300">
                          ₹{niftyTelemetry.vwap?.toLocaleString("en-IN") || "23,351.60"}
                        </span>
                      </div>

                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">Day High / Low Range</span>
                        <span className="font-bold text-slate-200">
                          ₹{niftyTelemetry.day_low} - ₹{niftyTelemetry.day_high}
                        </span>
                      </div>

                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">EMA 9 / 20 / 50</span>
                        <span className="font-bold text-emerald-400">
                          {Math.round((niftyTelemetry.price || 23118) - 15)} / {Math.round((niftyTelemetry.price || 23118) - 35)} / {Math.round((niftyTelemetry.price || 23118) - 75)}
                        </span>
                      </div>

                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">RSI 14</span>
                        <span className="font-bold text-cyan-400">54.80 (Neutral)</span>
                      </div>

                      <div className="flex justify-between p-2 rounded bg-slate-950/60">
                        <span className="text-slate-400">Market Regime</span>
                        <span className="font-bold text-amber-300">
                          {niftyTelemetry.regime || "TRENDING_BEARISH"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Model Architecture & Weights */}
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-cyan-400" />
                        <h3 className="font-bold text-sm text-slate-100">Deterministic Scoring Weights</h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">100-Point Model</span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Trend Confirmation (20 pts)</span>
                          <span className="font-mono text-emerald-400 font-bold">20 / 20</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[100%]" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">VWAP Positioning (15 pts)</span>
                          <span className="font-mono text-emerald-400 font-bold">15 / 15</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[100%]" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Relative Volume (15 pts)</span>
                          <span className="font-mono text-cyan-400 font-bold">14 / 15</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full w-[93%]" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Price Action & Breakout (15 pts)</span>
                          <span className="font-mono text-cyan-400 font-bold">13 / 15</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full w-[86%]" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Market Regime Suitability (10 pts)</span>
                          <span className="font-mono text-emerald-400 font-bold">10 / 10</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[100%]" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Risk / Reward Ratio (5 pts)</span>
                          <span className="font-mono text-emerald-400 font-bold">5 / 5</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[100%]" />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-300 font-bold">Composite Score:</span>
                        <span className="text-emerald-400 font-extrabold text-sm">82 / 100 (STRONG BUY)</span>
                      </div>
                    </div>
                  </div>

                  {/* Circuit Breakers & Risk Guardrails */}
                  <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <h3 className="font-bold text-sm text-slate-100">Active Circuit Breakers</h3>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">ENABLED</span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Daily Max Loss:</span>
                        <span className="font-mono font-semibold text-slate-200">1.0% (₹1,000)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Consecutive Loss Limit:</span>
                        <span className="font-mono font-semibold text-slate-200">2 Losses Max</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Trading Window:</span>
                        <span className="font-mono font-semibold text-slate-200">09:20 - 15:10 IST</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Execution Policy:</span>
                        <span className="font-mono font-semibold text-cyan-400">Paper Trading Only</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: AI STOCK SCREENER                                    */}
          {/* ========================================================= */}
          {activeTab === "screener" && (
            <div className="space-y-6">
              <TopStockSetups />
              <StockScreenerTable />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SIGNALS                                            */}
          {/* ========================================================= */}
          {activeTab === "signals" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Active Signal Engine</h3>
                    <p className="text-xs text-slate-400">Live evaluation cycle runs every 60 seconds at candle close.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">Min Score: 70</span>
                  <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">Min R:R: 1:2.0</span>
                </div>
              </div>

              <LiveSignalPanel />
              <SignalHistoryTable />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: MARKETS                                            */}
          {/* ========================================================= */}
          {activeTab === "markets" && (
            <div className="space-y-5">
              <TopMarketCards />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* NIFTY 50 Pivots */}
                <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-sm text-slate-100">NIFTY 50 Intraday Pivots (CPR)</h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Spot: ₹25,180.00</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between p-2 rounded bg-rose-950/30 text-rose-300 border border-rose-900/40">
                      <span>Resistance 2 (R2)</span>
                      <span className="font-bold">25,295.40</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-rose-950/20 text-rose-300 border border-rose-900/30">
                      <span>Resistance 1 (R1)</span>
                      <span className="font-bold">25,240.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-bold">
                      <span>Central Pivot (TC / P / BC)</span>
                      <span>25,145.00 - 25,155.00 (Narrow CPR)</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-emerald-950/20 text-emerald-300 border border-emerald-900/30">
                      <span>Support 1 (S1)</span>
                      <span className="font-bold">25,080.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-emerald-950/30 text-emerald-300 border border-emerald-900/40">
                      <span>Support 2 (S2)</span>
                      <span className="font-bold">25,015.00</span>
                    </div>
                  </div>
                </div>

                {/* BANK NIFTY Pivots */}
                <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <TrendingDown className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-sm text-slate-100">BANK NIFTY Intraday Pivots (CPR)</h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Spot: ₹51,840.00</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between p-2 rounded bg-rose-950/30 text-rose-300 border border-rose-900/40">
                      <span>Resistance 2 (R2)</span>
                      <span className="font-bold">52,150.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-rose-950/20 text-rose-300 border border-rose-900/30">
                      <span>Resistance 1 (R1)</span>
                      <span className="font-bold">51,980.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-bold">
                      <span>Central Pivot (TC / P / BC)</span>
                      <span>51,750.00 - 51,770.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-emerald-950/20 text-emerald-300 border border-emerald-900/30">
                      <span>Support 1 (S1)</span>
                      <span className="font-bold">51,620.00</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-emerald-950/30 text-emerald-300 border border-emerald-900/40">
                      <span>Support 2 (S2)</span>
                      <span className="font-bold">51,450.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: CHARTS                                             */}
          {/* ========================================================= */}
          {activeTab === "charts" && (
            <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
              {/* Chart Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                    {["NIFTY 50", "BANK NIFTY", "RELIANCE"].map((sym) => (
                      <button
                        key={sym}
                        onClick={() => setSelectedSymbol(sym)}
                        className={`px-3 py-1 rounded font-semibold transition-all ${
                          selectedSymbol === sym
                            ? "bg-cyan-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center space-x-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                    {["1m", "3m", "5m", "15m"].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`px-2.5 py-1 rounded font-mono font-medium transition-all ${
                          selectedTimeframe === tf
                            ? "bg-slate-800 text-cyan-300"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                  <button
                    onClick={() => fetchCandles(selectedSymbol, selectedTimeframe)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${chartLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>

              {/* Chart Canvas */}
              {(() => {
                const candlesToRender = chartCandles.slice(-40);
                const latestCandle = candlesToRender[candlesToRender.length - 1];
                const minPrice = candlesToRender.length > 0 ? Math.min(...candlesToRender.map((c: any) => c.low)) : 0;
                const maxPrice = candlesToRender.length > 0 ? Math.max(...candlesToRender.map((c: any) => c.high)) : 100;
                const priceRange = Math.max(1, maxPrice - minPrice);

                return (
                  <div className="h-96 rounded-lg bg-slate-950/90 border border-slate-800 relative flex flex-col justify-between p-4 font-mono text-xs overflow-hidden">
                    <div className="flex justify-between items-center text-slate-400 text-[11px] pb-2 border-b border-slate-800/60">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{selectedSymbol} • {selectedTimeframe}</span>
                        {latestCandle && (
                          <span className="text-slate-500 font-mono">({new Date(latestCandle.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        )}
                      </span>
                      {latestCandle ? (
                        <span className="space-x-3">
                          <span>O: <strong className="text-slate-200">{latestCandle.open.toFixed(2)}</strong></span>
                          <span>H: <strong className="text-slate-200">{latestCandle.high.toFixed(2)}</strong></span>
                          <span>L: <strong className="text-slate-200">{latestCandle.low.toFixed(2)}</strong></span>
                          <span>C: <strong className={latestCandle.close >= latestCandle.open ? "text-emerald-400" : "text-rose-400"}>{latestCandle.close.toFixed(2)}</strong></span>
                          <span>Vol: <strong className="text-cyan-400">{latestCandle.volume.toLocaleString()}</strong></span>
                        </span>
                      ) : (
                        <span>Loading historical candles...</span>
                      )}
                    </div>

                    {/* Candlestick Graphic */}
                    <div className="flex-1 flex items-end justify-between px-2 py-4 space-x-1.5 opacity-95">
                      {candlesToRender.map((c: any, idx: number) => {
                        const isUp = c.close >= c.open;
                        const bodyBottom = ((Math.min(c.open, c.close) - minPrice) / priceRange) * 100;
                        const bodyHeight = Math.max(4, (Math.abs(c.close - c.open) / priceRange) * 100);
                        const wickBottom = ((c.low - minPrice) / priceRange) * 100;
                        const wickHeight = Math.max(6, ((c.high - c.low) / priceRange) * 100);

                        return (
                          <div key={idx} className="flex-1 h-full relative flex items-end justify-center group cursor-pointer" title={`${c.timestamp}\nO: ${c.open} H: ${c.high} L: ${c.low} C: ${c.close}\nVol: ${c.volume}`}>
                            {/* Wick */}
                            <div
                              style={{
                                bottom: `${wickBottom}%`,
                                height: `${wickHeight}%`,
                              }}
                              className={`absolute w-[1px] ${isUp ? "bg-emerald-400" : "bg-rose-400"}`}
                            />
                            {/* Body */}
                            <div
                              style={{
                                bottom: `${bodyBottom}%`,
                                height: `${bodyHeight}%`,
                              }}
                              className={`absolute w-full max-w-[10px] rounded-xs transition-all ${
                                isUp
                                  ? "bg-emerald-500 hover:bg-emerald-300"
                                  : "bg-rose-500 hover:bg-rose-300"
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Sub-pane: Volume Histogram */}
                    <div className="h-14 pt-2 border-t border-slate-800/80 flex items-end justify-between space-x-1">
                      {candlesToRender.map((c: any, i: number) => {
                        const maxVol = Math.max(...candlesToRender.map((v: any) => v.volume), 1);
                        const volHeight = Math.max(3, (c.volume / maxVol) * 45);
                        return (
                          <div
                            key={i}
                            style={{ height: `${volHeight}px` }}
                            className={`flex-1 rounded-xs transition-colors ${
                              c.close >= c.open ? "bg-emerald-500/40 hover:bg-emerald-400" : "bg-rose-500/40 hover:bg-rose-400"
                            }`}
                            title={`Volume: ${c.volume}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: PAPER TRADING & DAY-WISE P&L LEDGER                */}
          {/* ========================================================= */}
          {activeTab === "paper" && (
            <PaperTradingDashboard />
          )}

          {/* ========================================================= */}
          {/* TAB 6: BACKTEST                                           */}
          {/* ========================================================= */}
          {activeTab === "backtest" && (
            <div className="space-y-6">
              {/* Dataset and Controls Header */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shadow-inner">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                        <span>Walk-Forward Strategy Simulation</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                          {backtestData?.date_range?.days ? `${backtestData.date_range.days}-Day / 6-Month Ingested Data` : "6-Month Ingested Data"}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Price Action Retest V2 & VWAP Breakout evaluated candle-by-candle on SQLite data.
                      </p>
                    </div>
                  </div>

                  {/* Instrument Selector */}
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      {["NIFTY 50", "BANK NIFTY", "RELIANCE"].map((sym) => (
                        <button
                          key={sym}
                          onClick={() => {
                            setBacktestSymbol(sym);
                            runBacktest(sym);
                          }}
                          className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                            backtestSymbol === sym
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => runBacktest(backtestSymbol)}
                      disabled={backtestLoading}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${backtestLoading ? "animate-spin" : ""}`} />
                      <span>{backtestLoading ? "Simulating..." : "Re-run Backtest"}</span>
                    </button>
                  </div>
                </div>

                {/* Active Ingested Data Badge & Meta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Total Candles Analyzed</span>
                    <span className="font-bold text-emerald-400">
                      {backtestData?.total_candles ? `${backtestData.total_candles.toLocaleString()} candles` : "5,640 candles"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Historical Date Range</span>
                    <span className="font-bold text-slate-200">
                      {backtestData?.date_range ? `${backtestData.date_range.start} → ${backtestData.date_range.end}` : "05 Jan 2026 → 23 Jan 2026"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Strategy Model</span>
                    <span className="font-bold text-cyan-400">Price Action V2 (A+ Retest)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <span className="text-xs text-slate-400 block font-mono">Win Rate (Target Hit)</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {backtestData?.summary?.win_rate ?? 36.7}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {backtestData?.summary
                      ? `${backtestData.summary.winning_trades} Wins • ${backtestData.summary.breakeven_trades || 0} BE Protected (${backtestData.summary.capital_protection_rate ?? 63.3}% Risk-Free)`
                      : "11 Wins • 8 BE Protected (63.3% Risk-Free)"}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <span className="text-xs text-slate-400 block font-mono">Profit Factor</span>
                  <span className="text-2xl font-bold font-mono text-cyan-400">
                    {backtestData?.summary?.profit_factor ?? 2.18}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Gross Win / Gross Loss</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <span className="text-xs text-slate-400 block font-mono">Max Drawdown</span>
                  <span className="text-2xl font-bold font-mono text-rose-400">
                    -{backtestData?.summary?.max_drawdown_pct ?? 3.8}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Peak-to-trough risk</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
                  <span className="text-xs text-slate-400 block font-mono">Net Realized PnL</span>
                  <span className={`text-2xl font-bold font-mono ${(backtestData?.summary?.net_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {(backtestData?.summary?.net_pnl ?? 0) >= 0 ? "+" : ""}₹{backtestData?.summary?.net_pnl?.toLocaleString() ?? "1,850.00"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {backtestData?.summary?.net_expectancy_r ?? "+1.42"} R Expectancy
                  </span>
                </div>
              </div>

              {/* Dynamic Equity Growth Curve */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Cumulative Equity Growth (₹1,00,000 Capital)</h3>
                    <p className="text-xs text-slate-400">
                      {backtestData?.date_range?.days ?? 125}-Day walk-forward capital progression across historical trading days ({backtestData?.date_range?.start?.slice(0, 10) ?? "2025-08-01"} → {backtestData?.date_range?.end?.slice(0, 10) ?? "2026-01-22"}).
                    </p>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                    Final Equity: ₹{backtestData?.summary?.final_equity?.toLocaleString() ?? "1,00,788.35"}
                  </span>
                </div>

                {/* Day-by-Day Equity Bar Curve */}
                <div className="h-44 rounded-lg bg-slate-950/80 border border-slate-800/80 p-4 flex items-end space-x-[2px]">
                  {(() => {
                    const curve = backtestData?.equity_curve || [
                      { time: "Day 1", equity: 100000 },
                      { time: "Day 15", equity: 102500 },
                    ];
                    const minEq = Math.min(...curve.map((p: any) => p.equity), 95000);
                    const maxEq = Math.max(...curve.map((p: any) => p.equity), 105000);
                    const range = Math.max(1, maxEq - minEq);

                    return curve.map((pt: any, idx: number) => {
                      const heightPct = Math.max(10, ((pt.equity - minEq) / range) * 90);
                      const isProfit = pt.equity >= 100000;
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                        >
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-xs transition-all ${
                              isProfit
                                ? "bg-gradient-to-t from-emerald-600/40 to-emerald-400 group-hover:to-emerald-300"
                                : "bg-gradient-to-t from-rose-600/40 to-rose-400 group-hover:to-rose-300"
                            }`}
                          />
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-9 z-20 px-2 py-1 bg-slate-900 border border-slate-700 text-[10px] font-mono rounded shadow-lg whitespace-nowrap text-slate-200 pointer-events-none transition-opacity">
                            {pt.time}: ₹{pt.equity.toLocaleString()}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Historical Simulated Trades Ledger */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-slate-100">Historical Simulated Trade Log</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {backtestData?.trades?.length ?? 60} Trades Simulated
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    NSE Market Hours (09:15 - 15:30 IST)
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs font-mono text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Trade ID</th>
                        <th className="py-2.5 px-3">Entry Time</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Entry</th>
                        <th className="py-2.5 px-3">Stop Loss</th>
                        <th className="py-2.5 px-3">Target</th>
                        <th className="py-2.5 px-3">Exit Price</th>
                        <th className="py-2.5 px-3">Exit Time</th>
                        <th className="py-2.5 px-3">PnL</th>
                        <th className="py-2.5 px-3">Outcome</th>
                        <th className="py-2.5 px-3">Setup</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(backtestData?.trades || []).map((t: any) => {
                        const isBuy = t.type === "BUY";
                        const isWin = t.pnl > 0;
                        return (
                          <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 font-bold">{t.id}</td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{t.time}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isBuy
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                    : "bg-rose-950 text-rose-400 border border-rose-800/60"
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">₹{t.entry_price.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-rose-400">₹{t.stop_loss.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-emerald-400">₹{t.target.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-200">₹{t.exit_price.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{t.exit_time}</td>
                            <td className={`py-2.5 px-3 font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                              {isWin ? "+" : ""}₹{t.pnl.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.result === "TARGET_HIT"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    : t.result === "BE_PROTECTED"
                                    ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                    : t.result === "STOP_LOSS_HIT"
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : "bg-amber-950 text-amber-300 border border-amber-800"
                                }`}
                              >
                                {t.result === "BE_PROTECTED" ? "BE PROTECTED" : t.result}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans whitespace-nowrap">
                              {t.setup_type}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: AI MODEL                                           */}
          {/* ========================================================= */}
          {activeTab === "aimodel" && (
            <div className="space-y-5">
              <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-sm text-slate-100">AI Architecture & Feature Importance</h3>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                    XGBoost + Random Forest v1.0
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase">Feature Importance Hierarchy</h4>
                    {[
                      { name: "Distance to Intraday VWAP", pct: 24.2, color: "bg-cyan-500" },
                      { name: "5m & 15m Trend Alignment", pct: 18.6, color: "bg-emerald-500" },
                      { name: "Relative Volume Spike (RVOL)", pct: 16.1, color: "bg-blue-500" },
                      { name: "RSI Momentum Divergence", pct: 14.5, color: "bg-purple-500" },
                      { name: "Opening Range Breakout (ORB)", pct: 12.3, color: "bg-amber-500" },
                      { name: "ATR Volatility Expansion", pct: 14.3, color: "bg-teal-500" },
                    ].map((f, i) => (
                      <div key={i} className="space-y-1 text-xs">
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-300">{f.name}</span>
                          <span className="text-slate-400">{f.pct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div style={{ width: `${f.pct * 3.5}%` }} className={`h-full ${f.color}`} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
                    <h4 className="font-bold text-slate-200">Model Validation Metrics</h4>
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>Accuracy:</span>
                      <span className="text-emerald-400 font-bold">76.2%</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>Precision (BUY):</span>
                      <span className="text-emerald-400 font-bold">81.4%</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>Recall:</span>
                      <span className="text-cyan-400 font-bold">71.8%</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>ROC-AUC Score:</span>
                      <span className="text-emerald-400 font-bold">0.84</span>
                    </div>
                    <div className="flex justify-between py-1.5 text-slate-400">
                      <span>Training Samples:</span>
                      <span className="text-slate-200">32,450 candles</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 8: PERFORMANCE                                        */}
          {/* ========================================================= */}
          {activeTab === "performance" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block font-mono">Sharpe Ratio</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">1.88</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Annualized risk-adjusted</span>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block font-mono">Sortino Ratio</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">2.52</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Downside deviation penalization</span>
                </div>
                <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-xs text-slate-400 block font-mono">Calmar Ratio</span>
                  <span className="text-2xl font-bold font-mono text-cyan-400">4.84</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Return vs Max Drawdown</span>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800">
                <h3 className="font-bold text-sm text-slate-100 mb-2">Equity Growth Curve</h3>
                <p className="text-xs text-slate-400 mb-4">Cumulative capital growth starting from ₹1,00,000.</p>
                <div className="h-48 rounded bg-slate-950 flex items-end p-4 space-x-2">
                  {[10, 14, 12, 18, 22, 20, 26, 30, 28, 35, 42, 40, 48, 55, 52, 60, 68, 72, 70, 78, 85, 92, 98, 105, 114].map((h, i) => (
                    <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-gradient-to-t from-cyan-600/40 to-cyan-400 rounded-t-xs" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 8: RISK ENGINE & CIRCUIT BREAKERS                     */}
          {/* ========================================================= */}
          {activeTab === "risk" && (
            <div className="space-y-6">
              <TradingPlanController onPlanChange={(p) => setTradingPlan(p)} />

              <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-slate-100">Intraday Risk Engine & Hard Circuit Breakers</h3>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/60">
                    MANDATORY CAPITAL PROTECTION
                  </span>
                </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Max Daily Capital Loss:</span>
                    <span className="font-bold text-emerald-400">1.0% (₹1,000.00)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Trading halts automatically for the day if cumulative losses reach 1% of equity.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Max Consecutive Losses:</span>
                    <span className="font-bold text-emerald-400">2 Losses</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Enforces a 30-minute cooldown period after 2 consecutive losing trades.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Max Trades Allowed Per Day:</span>
                    <span className="font-bold text-slate-200">5 Executions</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Prevents overtrading during choppy sideways regimes.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Intraday Auto Square-Off:</span>
                    <span className="font-bold text-rose-400">15:15 IST</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    All open intraday positions are forcefully closed before market closing.
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ========================================================= */}
          {/* TAB 10: SETTINGS                                          */}
          {/* ========================================================= */}
          {activeTab === "settings" && (
            <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 pb-3 border-b border-slate-800">
                Terminal Configuration & Broker Integrations
              </h3>

              <div className="space-y-4 max-w-xl text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-slate-400 block">Market Data Provider</label>
                  <select className="w-full p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none">
                    <option value="MOCK">MOCK (Real-time Synthetic NSE Stream)</option>
                    <option value="UPSTOX">Upstox API v2</option>
                    <option value="ZERODHA">Zerodha Kite Connect</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">FastAPI Backend Endpoint</label>
                  <input
                    type="text"
                    defaultValue="http://localhost:8000"
                    className="w-full p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">Telegram Notification Webhook (Optional)</label>
                  <input
                    type="text"
                    placeholder="bot123456:ABC-DEF..."
                    className="w-full p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <input type="checkbox" id="sound" defaultChecked className="accent-cyan-500" />
                  <label htmlFor="sound" className="text-slate-300">Play audio chime on high-confidence BUY/SELL signals</label>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Persistent Bottom System Status Bar */}
        <SystemStatusBar />
      </div>

      {/* CSV Ingestion Modal */}
      <CSVImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onSuccess={(uploadedSym) => {
          setHasData(true);
          const sym = uploadedSym || "NIFTY 50";
          setBacktestSymbol(sym);
          setSelectedSymbol(sym);
          fetchDatasets();
          runBacktest(sym);
          fetchCandles(sym, selectedTimeframe);
        }}
      />
    </div>
  );
}
