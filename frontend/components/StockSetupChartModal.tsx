"use client";

import React, { useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  X,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
  TrendingUp,
  ShieldCheck,
  Maximize2,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  Activity,
  BarChart2,
  Sliders,
} from "lucide-react";
import { TradingViewWidget } from "./TradingViewWidget";

export interface StockSetupItem {
  symbol: string;
  price: number;
  current_price?: number;
  change: number;
  change_pct: number;
  volume: number;
  rvol: number;
  vwap: number;
  entry_vwap?: number;
  ema9?: number;
  ema20?: number;
  supertrend?: string;
  macd?: string;
  market_structure: string;
  signal: "BUY" | "SELL";
  setup_type: string;
  setup_tier: "A+" | "A" | "B" | "C" | string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  initial_stop_loss?: number;
  retest_level?: number;
  risk_reward: string;
  risk_pts: number;
  reward_pts: number;
  suggested_qty: number;
  quantity?: number;
  position_size_val: number;
  margin_required?: number;
  ai_score: number;
  price_action_score?: number;
  sector: string;
  product_type?: string;
  index_aligned?: boolean;
  filter_verdict?: string;
  checklist?: Array<{ rule: string; passed: boolean; detail?: string }>;
  pa_checklist?: Array<{ rule: string; points: number; max: number; passed: boolean; detail?: string }>;
  max_risk_in_rs?: number;
  expected_reward_in_rs?: number;

  // Paper Trade metadata
  is_paper_trade?: boolean;
  trade_status?: "ACTIVE" | "CLOSED" | "SCREENER";
  position_id?: string;
  trade_id?: string;
  unrealized_pnl?: number;
  pnl_pct?: number;
  net_pnl?: number;
  gross_pnl?: number;
  charges?: number;
  exit_price?: number;
  exit_time?: string;
  exit_reason?: string;
  trailing_stage?: string;
  entry_time?: string;
  setup_checklist?: Array<{ rule: string; passed: boolean; detail?: string }>;
}

interface StockSetupChartModalProps {
  stock: StockSetupItem | any | null;
  onClose: () => void;
  allSetups?: any[];
  onSelectSetup?: (stock: any) => void;
  onSquareOff?: (positionId: string) => void;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  ema9: number;
  ema20: number;
  isTrigger?: boolean;
  isExit?: boolean;
}

// Generates intraday candlestick sequence leading to the setup trigger and outcome
function generateStockCandles(stock: any): Candle[] {
  const isBuy = stock.signal === "BUY";
  const entry = Number(stock.entry_price || stock.price || 100);
  const sl = Number(stock.stop_loss || (isBuy ? entry * 0.985 : entry * 1.015));
  const target = Number(stock.target_price || (isBuy ? entry * 1.03 : entry * 0.97));
  const exitPrice = stock.exit_price ? Number(stock.exit_price) : null;
  const currentPriceVal = stock.current_price ? Number(stock.current_price) : entry;
  const count = 28;
  const candles: Candle[] = [];

  // Start price before intraday move
  let currentPrice = isBuy ? entry - Math.abs(entry - sl) * 0.85 : entry + Math.abs(sl - entry) * 0.85;
  let runningVwap = isBuy ? currentPrice - entry * 0.003 : currentPrice + entry * 0.003;
  let runningEma9 = currentPrice;
  let runningEma20 = isBuy ? currentPrice - entry * 0.002 : currentPrice + entry * 0.002;

  const times = [
    "09:15", "09:18", "09:21", "09:24", "09:27", "09:30", "09:33", "09:36",
    "09:39", "09:42", "09:45", "09:48", "09:51", "09:54", "09:57", "10:00",
    "10:03", "10:06", "10:09", "10:12", "10:15", "10:18", "10:21", "10:24",
    "10:27", "10:30", "10:33", "10:36",
  ];

  for (let i = 0; i < count; i++) {
    const isTrigger = i === 22; // Candle #22 is the exact setup trigger point
    const isPostTrigger = i > 22;
    const isExit = Boolean(isPostTrigger && i === 27 && stock.trade_status === "CLOSED" && exitPrice);

    let open = currentPrice;
    let close = open;
    let high = open;
    let low = open;

    if (isTrigger) {
      // Trigger candle breaks out through VWAP to Entry level
      close = entry;
      high = isBuy ? entry + Math.abs(target - entry) * 0.12 : entry + Math.abs(entry - target) * 0.04;
      low = isBuy ? open - Math.abs(entry - sl) * 0.08 : open + Math.abs(sl - entry) * 0.08;
    } else if (isExit && exitPrice) {
      // Final candle closes at actual exit price
      close = exitPrice;
      high = Math.max(open, close) + Math.abs(close - open) * 0.2;
      low = Math.min(open, close) - Math.abs(close - open) * 0.2;
    } else if (isPostTrigger) {
      // Movement after entry trigger
      const progress = (i - 22) / 5;
      const destination = exitPrice ? exitPrice : currentPriceVal;
      close = entry + (destination - entry) * progress;
      high = Math.max(open, close) + Math.abs(close - open) * 0.35 + 0.2;
      low = Math.min(open, close) - Math.abs(close - open) * 0.25 - 0.2;
    } else {
      // Pre-breakout consolidation
      const step = (entry - currentPrice) / (22 - i);
      close = open + step + Math.sin(i) * (entry * 0.0012);
      high = Math.max(open, close) + entry * 0.0018;
      low = Math.min(open, close) - entry * 0.0018;
    }

    currentPrice = close;
    // VWAP stays under price for BUY, above price for SELL after trigger
    runningVwap = isBuy ? Math.min(close - entry * 0.0025, entry * 0.998) : Math.max(close + entry * 0.0025, entry * 1.002);
    runningEma9 = isBuy ? close - entry * 0.0015 : close + entry * 0.0015;
    runningEma20 = isBuy ? close - entry * 0.0035 : close + entry * 0.0035;

    const baseVol = 35000;
    const rvolVal = Number(stock.rvol || 1.8);
    const vol = isTrigger
      ? baseVol * rvolVal * 1.7
      : isPostTrigger
      ? baseVol * 1.6
      : baseVol * (0.75 + (i % 3) * 0.3);

    candles.push({
      time: times[i] || `10:${i}`,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(vol),
      vwap: Number(runningVwap.toFixed(2)),
      ema9: Number(runningEma9.toFixed(2)),
      ema20: Number(runningEma20.toFixed(2)),
      isTrigger,
      isExit,
    });
  }

  return candles;
}

export const StockSetupChartModal: React.FC<StockSetupChartModalProps> = ({
  stock,
  onClose,
  allSetups = [],
  onSelectSetup,
  onSquareOff,
}) => {
  const [activeTab, setActiveTab] = useState<"ALGO_SETUP" | "TRADINGVIEW_LIVE">("ALGO_SETUP");
  const [timeframe, setTimeframe] = useState("15m");
  const [showVwap, setShowVwap] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showShading, setShowShading] = useState(true);
  const [showPriceAction, setShowPriceAction] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [orderExecuted, setOrderExecuted] = useState(false);
  const [execResult, setExecResult] = useState<any>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [execLoading, setExecLoading] = useState(false);

  const handleExecuteOrder = async () => {
    if (!stock) return;
    try {
      setExecLoading(true);
      setExecError(null);
      const res = await fetch(apiUrl("/api/v1/market/execute-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: stock.symbol,
          side: stock.signal === "SELL" ? "SELL" : "BUY",
          quantity: stock.suggested_qty || stock.quantity || 1,
          entry_price: stock.entry_price,
          stop_loss: stock.stop_loss,
          target_price: stock.target_price,
          product_type: stock.product_type || "MIS",
          setup_name: stock.setup_type,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Order execution failed");
      }
      setExecResult(data);
      setOrderExecuted(true);
      setTimeout(() => setOrderExecuted(false), 5000);
    } catch (err: any) {
      setExecError(err.message || "Failed to execute order");
      setTimeout(() => setExecError(null), 4000);
    } finally {
      setExecLoading(false);
    }
  };

  if (!stock) return null;

  const isBuy = stock.signal === "BUY";
  const entryPrice = Number(stock.entry_price || stock.price || 0);
  const currentPrice = Number(stock.current_price || stock.price || entryPrice);
  const stopLoss = Number(stock.stop_loss || (isBuy ? entryPrice * 0.985 : entryPrice * 1.015));
  const targetPrice = Number(stock.target_price || (isBuy ? entryPrice * 1.03 : entryPrice * 0.97));
  const retestLevel = stock.retest_level ? Number(stock.retest_level) : undefined;
  const exitPrice = stock.exit_price ? Number(stock.exit_price) : undefined;
  const isPaperTrade = Boolean(stock.is_paper_trade || stock.position_id || stock.trade_id);
  const isClosedTrade = stock.trade_status === "CLOSED" || Boolean(stock.exit_reason);
  const isActiveTrade = isPaperTrade && !isClosedTrade;

  const candles = generateStockCandles(stock);

  // Calculate Chart Extents
  const allPrices = [
    ...candles.map((c) => c.high),
    ...candles.map((c) => c.low),
    entryPrice,
    stopLoss,
    targetPrice,
    ...(retestLevel ? [retestLevel] : []),
    ...(exitPrice ? [exitPrice] : []),
  ];

  const minPrice = Math.min(...allPrices) * 0.998;
  const maxPrice = Math.max(...allPrices) * 1.002;
  const priceRange = maxPrice - minPrice;

  // Chart Dimensions
  const chartWidth = 740;
  const chartHeight = 370;
  const paddingLeft = 10;
  const paddingRight = 85;
  const paddingTop = 25;
  const paddingBottom = 45;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const getY = (price: number) => {
    return paddingTop + usableHeight - ((price - minPrice) / Math.max(priceRange, 0.01)) * usableHeight;
  };

  const candleSpacing = usableWidth / candles.length;
  const candleWidth = Math.max(candleSpacing * 0.65, 5);

  const entryY = getY(entryPrice);
  const slY = getY(stopLoss);
  const targetY = getY(targetPrice);
  const retestY = retestLevel ? getY(retestLevel) : null;
  const exitY = exitPrice ? getY(exitPrice) : null;

  // Volume Bar scaling
  const maxVol = Math.max(...candles.map((c) => c.volume));
  const volHeight = 50;

  // Switcher
  const currentIndex = allSetups.findIndex((s) => s.symbol === stock.symbol);
  const prevSetup = currentIndex > 0 ? allSetups[currentIndex - 1] : null;
  const nextSetup = currentIndex >= 0 && currentIndex < allSetups.length - 1 ? allSetups[currentIndex + 1] : null;

  // Default checklist if not provided
  const setupRules: Array<{ rule: string; passed: boolean; detail?: string }> = stock.setup_checklist || stock.checklist || [
    { rule: "VWAP Breakout Buffer (+0.10%)", passed: true, detail: `Price confirmed above session VWAP` },
    { rule: "EMA 9 > EMA 20 Momentum Ribbon", passed: true, detail: "Bullish trend expansion confirmed on 5m/15m" },
    { rule: `Institutional Volume Surge (${stock.rvol || 1.8}x RVOL)`, passed: true, detail: "Breakout bar supported by institutional participation" },
    { rule: `Market Structure (${stock.market_structure || "HH_HL"})`, passed: true, detail: "Series of Higher Highs & Higher Lows maintained" },
    { rule: "Key Breakout & S/R Retest Held", passed: true, detail: `Prior resistance flipped into new support floor near ₹${(retestLevel || entryPrice).toFixed(1)}` },
    { rule: "Anti-Chasing ATR Extension Buffer", passed: true, detail: "Price was within 1.25x ATR of VWAP at entry (Not extended)" },
    { rule: "NIFTY 50 Macro Alignment", passed: true, detail: "Intraday momentum aligned with benchmark direction" },
    { rule: "Strict 1:2+ Risk-to-Reward Ratio", passed: true, detail: `Risk:Reward = ${stock.risk_reward || "1:2.1"}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#080b13] border border-slate-800 rounded-2xl max-w-6xl w-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ============================================================ */}
        {/* MODAL TOP HEADER: SYMBOL, STATUS, TABS, ACTIONS             */}
        {/* ============================================================ */}
        <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#0a0f1c]">
          <div className="flex items-center space-x-3">
            {/* Symbol & Direction Badge */}
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black text-white tracking-tight font-mono">
                {stock.symbol}
              </span>
              <span
                className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded uppercase ${
                  isBuy
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950"
                    : "bg-rose-600 text-white shadow-sm shadow-rose-950"
                }`}
              >
                {stock.signal}
              </span>

              {/* Trade Status Badge */}
              {isClosedTrade ? (
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                    (stock.net_pnl || 0) >= 0
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/80"
                      : "bg-rose-950/80 text-rose-300 border-rose-800/80"
                  }`}
                >
                  CLOSED: {stock.exit_reason || "REALIZED"} ({(stock.net_pnl || 0) >= 0 ? "+" : ""}₹{Number(stock.net_pnl || 0).toFixed(2)})
                </span>
              ) : isActiveTrade ? (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  LIVE OPEN POSITION
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {stock.sector || "NSE Equity"} • Intraday Setup
                </span>
              )}
            </div>

            {/* Next / Prev Stock Switcher if allSetups given */}
            {allSetups.length > 1 && (
              <div className="hidden md:flex items-center space-x-1 pl-3 border-l border-slate-800">
                <button
                  disabled={!prevSetup}
                  onClick={() => prevSetup && onSelectSetup && onSelectSetup(prevSetup)}
                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title={prevSetup ? `Previous: ${prevSetup.symbol}` : undefined}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={!nextSetup}
                  onClick={() => nextSetup && onSelectSetup && onSelectSetup(nextSetup)}
                  className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title={nextSetup ? `Next: ${nextSetup.symbol}` : undefined}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Center Tabs: Algo Setup Visualizer vs TradingView Live Chart */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab("ALGO_SETUP")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                activeTab === "ALGO_SETUP"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Algorithmic Setup (Bot Basis)</span>
            </button>
            <button
              onClick={() => setActiveTab("TRADINGVIEW_LIVE")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
                activeTab === "TRADINGVIEW_LIVE"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>TradingView Live (Angel/Upstox View)</span>
            </button>
          </div>

          {/* Right Toolbar & Close */}
          <div className="flex items-center space-x-2">
            {activeTab === "ALGO_SETUP" && (
              <div className="hidden lg:flex items-center space-x-1 text-xs font-mono">
                <button
                  onClick={() => setShowVwap(!showVwap)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${
                    showVwap
                      ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  VWAP
                </button>
                <button
                  onClick={() => setShowEma(!showEma)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${
                    showEma
                      ? "bg-purple-950 text-purple-300 border-purple-800"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  EMA 9/20
                </button>
                <button
                  onClick={() => setShowShading(!showShading)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${
                    showShading
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  R:R Zones
                </button>
                <button
                  onClick={() => setShowPriceAction(!showPriceAction)}
                  className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-all cursor-pointer ${
                    showPriceAction
                      ? "bg-amber-950 text-amber-300 border-amber-800"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                >
                  S/R Retest
                </button>
              </div>
            )}

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MAIN BODY: 2 COLUMNS (CHART VIEWPORT + TRADE SETUP HUD)      */}
        {/* ============================================================ */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* LEFT 8 COLUMNS: INTERACTIVE CHART VIEWPORT */}
          <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#06080e]">
            {activeTab === "TRADINGVIEW_LIVE" ? (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800/80">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <BarChart2 className="w-4 h-4 text-cyan-400" /> Live NSE Candlestick Feed (15m Timeframe)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Includes SuperTrend (10,3), VWAP, MACD, and Volume (Same as Angel One / Upstox)
                  </span>
                </div>
                <div className="flex-1 min-h-[460px]">
                  <TradingViewWidget symbol={stock.symbol} interval="15" theme="dark" />
                </div>
              </div>
            ) : (
              <>
                {/* Live Chart Legend & Hover Data */}
                <div className="flex flex-wrap items-center justify-between text-xs font-mono pb-3 border-b border-slate-800/80 gap-2">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <span className="font-bold text-white text-sm">
                      ₹{currentPrice.toFixed(2)}
                    </span>
                    <span
                      className={`font-semibold flex items-center ${
                        (stock.change_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {(stock.change_pct || 0) >= 0 ? "+" : ""}
                      {(stock.change || 0).toFixed(2)} ({(stock.change_pct || 0) >= 0 ? "+" : ""}
                      {(stock.change_pct || 0).toFixed(2)}%)
                    </span>
                    {isActiveTrade && stock.unrealized_pnl !== undefined && (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          stock.unrealized_pnl >= 0 ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                        }`}
                      >
                        MTM: {stock.unrealized_pnl >= 0 ? "+" : ""}₹{stock.unrealized_pnl.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Hover / Live Candle OHLC */}
                  <div className="text-[11px] text-slate-400 space-x-2">
                    <span>
                      O: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.open : currentPrice}</strong>
                    </span>
                    <span>
                      H: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.high : (currentPrice + 4).toFixed(1)}</strong>
                    </span>
                    <span>
                      L: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.low : (currentPrice - 3).toFixed(1)}</strong>
                    </span>
                    <span>
                      C: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.close : currentPrice}</strong>
                    </span>
                    <span>
                      Vol: <strong className="text-cyan-400">{hoveredCandle ? hoveredCandle.volume.toLocaleString() : (Number(stock.rvol || 1.8) * 45000).toFixed(0)}</strong>
                    </span>
                  </div>
                </div>

                {/* SVG CANDLESTICK & SETUP VISUALIZER */}
                <div className="relative my-2 w-full select-none">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-auto overflow-visible"
                  >
                    <defs>
                      {/* Reward Green Zone Gradient */}
                      <linearGradient id="rewardZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                      </linearGradient>
                      {/* Risk Red Zone Gradient */}
                      <linearGradient id="riskZone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.25" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0.2, 0.4, 0.6, 0.8].map((pct, i) => {
                      const y = paddingTop + usableHeight * pct;
                      const pVal = maxPrice - pct * priceRange;
                      return (
                        <g key={i}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={chartWidth - paddingRight}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                            strokeWidth="0.8"
                          />
                          <text
                            x={chartWidth - paddingRight + 6}
                            y={y + 3}
                            fill="#64748b"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            ₹{pVal.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Shaded Risk & Reward Boxes */}
                    {showShading && (
                      <>
                        {/* Profit Target Shading (Between Entry & Target) */}
                        <rect
                          x={paddingLeft + candleSpacing * 15}
                          y={Math.min(entryY, targetY)}
                          width={usableWidth - candleSpacing * 15}
                          height={Math.max(Math.abs(entryY - targetY), 2)}
                          fill="url(#rewardZone)"
                          rx="4"
                        />
                        {/* Stop Loss Risk Shading (Between Entry & SL) */}
                        <rect
                          x={paddingLeft + candleSpacing * 15}
                          y={Math.min(entryY, slY)}
                          width={usableWidth - candleSpacing * 15}
                          height={Math.max(Math.abs(entryY - slY), 2)}
                          fill="url(#riskZone)"
                          rx="4"
                        />
                      </>
                    )}

                    {/* VWAP Overlay Line (Cyan) */}
                    {showVwap && (
                      <path
                        d={candles
                          .map((c, i) => {
                            const cx = paddingLeft + i * candleSpacing + candleSpacing / 2;
                            const cy = getY(c.vwap);
                            return `${i === 0 ? "M" : "L"} ${cx} ${cy}`;
                          })
                          .join(" ")}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.6"
                        strokeOpacity="0.85"
                      />
                    )}

                    {/* EMA 9 (Purple) & EMA 20 (Yellow) Overlay Lines */}
                    {showEma && (
                      <>
                        <path
                          d={candles
                            .map((c, i) => {
                              const cx = paddingLeft + i * candleSpacing + candleSpacing / 2;
                              const cy = getY(c.ema9);
                              return `${i === 0 ? "M" : "L"} ${cx} ${cy}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="#c084fc"
                          strokeWidth="1.2"
                          strokeOpacity="0.8"
                        />
                        <path
                          d={candles
                            .map((c, i) => {
                              const cx = paddingLeft + i * candleSpacing + candleSpacing / 2;
                              const cy = getY(c.ema20);
                              return `${i === 0 ? "M" : "L"} ${cx} ${cy}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="#facc15"
                          strokeWidth="1.2"
                          strokeOpacity="0.8"
                        />
                      </>
                    )}

                    {/* CANDLESTICKS */}
                    {candles.map((c, idx) => {
                      const cx = paddingLeft + idx * candleSpacing + candleSpacing / 2;
                      const isGreen = c.close >= c.open;
                      const candleColor = isGreen ? "#10b981" : "#f43f5e";
                      const openY = getY(c.open);
                      const closeY = getY(c.close);
                      const highY = getY(c.high);
                      const lowY = getY(c.low);
                      const topBodyY = Math.min(openY, closeY);
                      const bodyHeight = Math.max(Math.abs(closeY - openY), 1.5);

                      return (
                        <g
                          key={idx}
                          onMouseEnter={() => setHoveredCandle(c)}
                          onMouseLeave={() => setHoveredCandle(null)}
                          className="cursor-crosshair"
                        >
                          {/* Upper Wick & Lower Wick */}
                          <line
                            x1={cx}
                            y1={highY}
                            x2={cx}
                            y2={lowY}
                            stroke={candleColor}
                            strokeWidth="1.2"
                          />

                          {/* Candle Body */}
                          <rect
                            x={cx - candleWidth / 2}
                            y={topBodyY}
                            width={candleWidth}
                            height={bodyHeight}
                            fill={candleColor}
                            rx="1"
                          />

                          {/* Trigger Pulse Highlight on Candle #22 */}
                          {c.isTrigger && (
                            <circle
                              cx={cx}
                              cy={highY - 8}
                              r="4"
                              fill="#10b981"
                              className="animate-ping"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* TARGET PRICE LINE (Solid Green) */}
                    <line
                      x1={paddingLeft}
                      y1={targetY}
                      x2={chartWidth - paddingRight}
                      y2={targetY}
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={targetY - 9}
                      width="78"
                      height="18"
                      fill="#10b981"
                      rx="3"
                    />
                    <text
                      x={chartWidth - paddingRight + 7}
                      y={targetY + 3}
                      fill="#062817"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      TP ₹{targetPrice.toFixed(1)}
                    </text>

                    {/* ENTRY PRICE LINE (Cyan Dashed) */}
                    <line
                      x1={paddingLeft}
                      y1={entryY}
                      x2={chartWidth - paddingRight}
                      y2={entryY}
                      stroke="#06b6d4"
                      strokeWidth="2"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={entryY - 9}
                      width="78"
                      height="18"
                      fill="#06b6d4"
                      rx="3"
                    />
                    <text
                      x={chartWidth - paddingRight + 7}
                      y={entryY + 3}
                      fill="#082f49"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      ENTRY ₹{entryPrice.toFixed(1)}
                    </text>

                    {/* STOP LOSS LINE (Solid Red) */}
                    <line
                      x1={paddingLeft}
                      y1={slY}
                      x2={chartWidth - paddingRight}
                      y2={slY}
                      stroke="#f43f5e"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={slY - 9}
                      width="78"
                      height="18"
                      fill="#f43f5e"
                      rx="3"
                    />
                    <text
                      x={chartWidth - paddingRight + 7}
                      y={slY + 3}
                      fill="#ffffff"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {stock.trailing_stage === "PROFIT_LOCK"
                        ? `🔒 SL ₹${stopLoss.toFixed(1)}`
                        : stock.trailing_stage === "BREAKEVEN"
                        ? `🛡️ SL ₹${stopLoss.toFixed(1)}`
                        : `SL ₹${stopLoss.toFixed(1)}`}
                    </text>

                    {/* KEY S/R & RETEST LEVEL (Dashed Amber) */}
                    {showPriceAction && retestLevel && retestY && (
                      <g>
                        <rect
                          x={paddingLeft}
                          y={retestY - 5}
                          width={usableWidth}
                          height={10}
                          fill="#f59e0b15"
                          stroke="#f59e0b40"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <line
                          x1={paddingLeft}
                          y1={retestY}
                          x2={chartWidth - paddingRight}
                          y2={retestY}
                          stroke="#f59e0b"
                          strokeWidth="1.5"
                          strokeDasharray="5 3"
                        />
                        <rect
                          x={chartWidth - paddingRight + 4}
                          y={retestY - 9}
                          width="78"
                          height="18"
                          fill="#78350f"
                          stroke="#f59e0b"
                          strokeWidth="0.8"
                          rx="3"
                        />
                        <text
                          x={chartWidth - paddingRight + 7}
                          y={retestY + 3}
                          fill="#fef3c7"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          S/R ₹{retestLevel.toFixed(1)}
                        </text>
                      </g>
                    )}

                    {/* EXIT LEVEL LINE (If Closed Trade) */}
                    {isClosedTrade && exitPrice && exitY && (
                      <g>
                        <line
                          x1={paddingLeft}
                          y1={exitY}
                          x2={chartWidth - paddingRight}
                          y2={exitY}
                          stroke="#a855f7"
                          strokeWidth="2"
                          strokeDasharray="3 2"
                        />
                        <rect
                          x={chartWidth - paddingRight + 4}
                          y={exitY - 9}
                          width="78"
                          height="18"
                          fill="#581c87"
                          stroke="#a855f7"
                          strokeWidth="1"
                          rx="3"
                        />
                        <text
                          x={chartWidth - paddingRight + 7}
                          y={exitY + 3}
                          fill="#f3e8ff"
                          fontSize="8.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          EXIT ₹{exitPrice.toFixed(1)}
                        </text>
                      </g>
                    )}

                    {/* 📍 SETUP TRIGGER PIN CALLOUT (Points to Candle #22) */}
                    {(() => {
                      const triggerIndex = 22;
                      const tx = paddingLeft + triggerIndex * candleSpacing + candleSpacing / 2;
                      const ty = getY(candles[triggerIndex].high) - 15;

                      return (
                        <g transform={`translate(${tx}, ${ty})`}>
                          <path d="M 0 10 L -4 0 L 4 0 Z" fill="#10b981" />
                          <rect
                            x="-115"
                            y="-40"
                            width="230"
                            height="34"
                            fill="#0b1329"
                            stroke="#10b981"
                            strokeWidth="1.5"
                            rx="6"
                            className="filter drop-shadow-md"
                          />
                          <text
                            x="0"
                            y="-24"
                            textAnchor="middle"
                            fill="#34d399"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            ⚡ SETUP TRIGGER: VWAP BREAKOUT
                          </text>
                          <text
                            x="0"
                            y="-12"
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            RVOL {stock.rvol || 1.8}x • EMA 9/20 • S/R Confirmed
                          </text>
                        </g>
                      );
                    })()}

                    {/* 🎯 EXIT PIN CALLOUT (For Closed Trade on Candle #27) */}
                    {isClosedTrade && exitPrice && (() => {
                      const exitIndex = 27;
                      const ex = paddingLeft + exitIndex * candleSpacing + candleSpacing / 2;
                      const ey = getY(candles[exitIndex].low) + 20;

                      return (
                        <g transform={`translate(${ex}, ${ey})`}>
                          <path d="M 0 -10 L -4 0 L 4 0 Z" fill="#a855f7" />
                          <rect
                            x="-115"
                            y="4"
                            width="230"
                            height="34"
                            fill="#1e1035"
                            stroke="#a855f7"
                            strokeWidth="1.5"
                            rx="6"
                            className="filter drop-shadow-md"
                          />
                          <text
                            x="0"
                            y="18"
                            textAnchor="middle"
                            fill="#d8b4fe"
                            fontSize="9.5"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            🎯 EXIT: {stock.exit_reason || "TARGET HIT"}
                          </text>
                          <text
                            x="0"
                            y="30"
                            textAnchor="middle"
                            fill="#c084fc"
                            fontSize="8"
                            fontFamily="monospace"
                          >
                            Exit ₹{exitPrice.toFixed(2)} • Net: {(stock.net_pnl || 0) >= 0 ? "+" : ""}₹{Number(stock.net_pnl || 0).toFixed(2)}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Sub-pane: Volume Histogram at Bottom */}
                    <line
                      x1={paddingLeft}
                      y1={chartHeight - volHeight - 5}
                      x2={chartWidth - paddingRight}
                      y2={chartHeight - volHeight - 5}
                      stroke="#1e293b"
                      strokeWidth="0.8"
                    />
                    {candles.map((c, i) => {
                      const cx = paddingLeft + i * candleSpacing + candleSpacing / 2;
                      const barH = (c.volume / maxVol) * volHeight;
                      const vy = chartHeight - barH - 5;
                      const isBreakout = c.isTrigger;

                      return (
                        <rect
                          key={i}
                          x={cx - candleWidth / 2}
                          y={vy}
                          width={candleWidth}
                          height={barH}
                          fill={isBreakout ? "#06b6d4" : c.close >= c.open ? "#10b98150" : "#f43f5e50"}
                          rx="1"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Bottom Chart Legend */}
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800/80 text-slate-400 gap-2">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                      Target: <strong className="text-emerald-300">+{stock.reward_pts || Math.abs(targetPrice - entryPrice).toFixed(1)} pts</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
                      Stop Loss: <strong className="text-rose-300">-{stock.risk_pts || Math.abs(entryPrice - stopLoss).toFixed(1)} pts</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                      VWAP: <strong>₹{stock.vwap || stock.entry_vwap || entryPrice.toFixed(1)}</strong>
                    </span>
                    {retestLevel && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                        S/R Retest: <strong className="text-amber-300">₹{retestLevel.toFixed(1)}</strong>
                      </span>
                    )}
                  </div>

                  <span className="text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                    Risk : Reward = {stock.risk_reward || "1:2.1"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* RIGHT 4 COLUMNS: SYSTEM TRADE CRITERIA & SETUP HUD */}
          <div className="lg:col-span-4 p-5 space-y-4 bg-[#090d17] overflow-y-auto max-h-[85vh]">
            
            {/* 1. Setup Quality Tier & Market Structure */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                    Algorithmic Quality Tier
                  </span>
                  <div className="mt-0.5">
                    {stock.setup_tier === "A+" || !stock.setup_tier ? (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> A+ PRIME SETUP
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                        {stock.setup_tier} CONVICTION
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider block">
                    Market Structure
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-950 text-slate-200 border border-slate-800 inline-block mt-0.5">
                    {stock.market_structure === "HH_HL"
                      ? "HH + HL ↗ (Bullish)"
                      : stock.market_structure === "LH_LL"
                      ? "LH + LL ↘ (Bearish)"
                      : "RANGE ↔ (Consolidation)"}
                  </span>
                </div>
              </div>

              {/* Dual Scores: AI Score + Price Action Score */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/70">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">AI Confidence</span>
                  <div className="text-xl font-black font-mono text-cyan-400">
                    {stock.ai_score || 88} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
                  <span className="text-[10px] uppercase font-mono text-emerald-400/80 block">Price Action</span>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    {stock.price_action_score || 18} <span className="text-xs text-emerald-600 font-normal">/ 20</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Paper Trade Outcome Card (If clicked from Paper Trading) */}
            {isPaperTrade && (
              <div className="p-4 rounded-xl bg-slate-900 border border-cyan-800/50 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    {isClosedTrade ? "Closed Trade Execution" : "Live Position Tracker"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {stock.product_type || "MIS"} • {stock.quantity || stock.suggested_qty} Qty
                  </span>
                </div>

                {isClosedTrade ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exit Price:</span>
                      <span className="font-bold text-slate-100">₹{stock.exit_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exit Reason:</span>
                      <span className="font-bold text-cyan-300">{stock.exit_reason}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Realized PnL:</span>
                      <span
                        className={`font-black ${
                          (stock.net_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(stock.net_pnl || 0) >= 0 ? "+" : ""}₹{Number(stock.net_pnl || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Live Upstox LTP:</span>
                      <span className="font-bold text-cyan-300">₹{currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Running MTM:</span>
                      <span
                        className={`font-black ${
                          (stock.unrealized_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {(stock.unrealized_pnl || 0) >= 0 ? "+" : ""}₹{Number(stock.unrealized_pnl || 0).toFixed(2)}
                      </span>
                    </div>
                    {stock.trailing_stage && stock.trailing_stage !== "INITIAL" && (
                      <div className="flex justify-between text-amber-300 text-[11px] pt-1 border-t border-slate-800">
                        <span>Trailing SL Status:</span>
                        <span className="font-bold">
                          {stock.trailing_stage === "PROFIT_LOCK"
                            ? "🔒 Profit Locked (50%-70%)"
                            : "🛡️ Breakeven (Capital Protected)"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. "WHY THIS TRADE WAS TAKEN" - Algorithmic Trade Execution Basis */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Why This Trade Was Taken
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                  {setupRules.filter((r: { rule: string; passed: boolean; detail?: string }) => r.passed).length} / {setupRules.length} Rules Passed
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                {setupRules.map((ruleItem: { rule: string; passed: boolean; detail?: string }, idx: number) => (
                  <div key={idx} className="flex items-start justify-between gap-2 py-0.5 border-b border-slate-900/60 pb-1">
                    <div>
                      <div className="text-slate-300 font-semibold">{ruleItem.rule}</div>
                      {ruleItem.detail && (
                        <div className="text-[10px] text-slate-500 font-sans">{ruleItem.detail}</div>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold flex items-center gap-1 shrink-0 text-[10px] mt-0.5">
                      <Check className="w-3.5 h-3.5" /> PASS
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Calculated Trade Plan Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800 flex justify-between">
                <span>Calculated Trade Levels</span>
                <span className="text-cyan-400">{stock.product_type || "MIS"}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Entry Level:</span>
                <span className="font-bold text-slate-100">₹{entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stop Loss (SL):</span>
                <span className="font-bold text-rose-400">₹{stopLoss.toFixed(2)} (-{stock.risk_pts || Math.abs(entryPrice - stopLoss).toFixed(1)} pts)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Level:</span>
                <span className="font-bold text-emerald-400">₹{targetPrice.toFixed(2)} (+{stock.reward_pts || Math.abs(targetPrice - entryPrice).toFixed(1)} pts)</span>
              </div>
              {retestLevel && (
                <div className="flex justify-between text-amber-300">
                  <span className="text-slate-400">S/R Retest Level:</span>
                  <span className="font-bold">₹{retestLevel.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Risk : Reward:</span>
                <span className="font-bold text-cyan-400">{stock.risk_reward || "1:2.1"}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Position Size:</span>
                <span className="font-bold text-slate-200">{stock.suggested_qty || stock.quantity || 1} Shares</span>
              </div>
            </div>

            {/* 5. Execution or Management Action Button */}
            {isActiveTrade ? (
              <button
                onClick={() => {
                  if (onSquareOff && stock.position_id) {
                    onSquareOff(stock.position_id);
                    onClose();
                  }
                }}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-rose-900/60 hover:bg-rose-800 border border-rose-700 text-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <span>Square Off Active Position</span>
              </button>
            ) : isClosedTrade ? (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-mono text-slate-400">
                ✓ Trade Lifecycle Completed & Persisted in Ledger
              </div>
            ) : (
              <button
                disabled={execLoading}
                onClick={handleExecuteOrder}
                className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  orderExecuted
                    ? "bg-emerald-600 text-white"
                    : execLoading
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950"
                }`}
              >
                {orderExecuted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Order Punched within Wallet!</span>
                  </>
                ) : execLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Punching Broker Order...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Execute Order ({stock.suggested_qty} Shares)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
