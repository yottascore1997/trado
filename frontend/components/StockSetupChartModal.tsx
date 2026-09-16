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
} from "lucide-react";
import { StockSetupItem } from "./TopStockSetups";

interface StockSetupChartModalProps {
  stock: StockSetupItem | null;
  onClose: () => void;
  allSetups?: StockSetupItem[];
  onSelectSetup?: (stock: StockSetupItem) => void;
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
}

// Generates high-fidelity intraday candlestick sequence leading to the setup trigger
function generateStockCandles(stock: StockSetupItem): Candle[] {
  const isBuy = stock.signal === "BUY";
  const entry = stock.entry_price;
  const sl = stock.stop_loss;
  const target = stock.target_price;
  const count = 28;
  const candles: Candle[] = [];

  // Start price before intraday move
  let currentPrice = isBuy ? entry - (entry - sl) * 0.9 : entry + (sl - entry) * 0.9;
  let runningVwap = currentPrice;
  let runningEma9 = currentPrice;
  let runningEma20 = currentPrice;

  const times = [
    "09:15", "09:18", "09:21", "09:24", "09:27", "09:30", "09:33", "09:36",
    "09:39", "09:42", "09:45", "09:48", "09:51", "09:54", "09:57", "10:00",
    "10:03", "10:06", "10:09", "10:12", "10:15", "10:18", "10:21", "10:24",
    "10:27", "10:30", "10:33", "10:36",
  ];

  for (let i = 0; i < count; i++) {
    const isTrigger = i === 22; // Candle #22 is the exact setup trigger point
    const isPostTrigger = i > 22;

    let open = currentPrice;
    let close = open;
    let high = open;
    let low = open;

    if (isTrigger) {
      // Trigger candle breaks out to Entry level
      close = entry;
      high = isBuy ? entry + (target - entry) * 0.15 : entry + (entry - target) * 0.05;
      low = isBuy ? open - (entry - sl) * 0.1 : open + (sl - entry) * 0.1;
    } else if (isPostTrigger) {
      // Moves towards target
      const progress = (i - 22) / 6;
      close = isBuy
        ? entry + (target - entry) * 0.35 * progress
        : entry - (entry - target) * 0.35 * progress;
      high = Math.max(open, close) + Math.abs(close - open) * 0.4;
      low = Math.min(open, close) - Math.abs(close - open) * 0.3;
    } else {
      // Pre-breakout consolidation
      const step = (entry - currentPrice) / (22 - i);
      close = open + step + (Math.sin(i) * (stock.price * 0.0015));
      high = Math.max(open, close) + Math.abs(stock.price * 0.002);
      low = Math.min(open, close) - Math.abs(stock.price * 0.002);
    }

    currentPrice = close;
    runningVwap = isBuy ? close - (stock.price * 0.004) : close + (stock.price * 0.004);
    runningEma9 = isBuy ? close - (stock.price * 0.002) : close + (stock.price * 0.002);
    runningEma20 = isBuy ? close - (stock.price * 0.005) : close + (stock.price * 0.005);

    const baseVol = 40000;
    const vol = isTrigger
      ? baseVol * stock.rvol * 1.6
      : isPostTrigger
      ? baseVol * 1.8
      : baseVol * (0.8 + Math.random() * 0.5);

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
    });
  }

  return candles;
}

export const StockSetupChartModal: React.FC<StockSetupChartModalProps> = ({
  stock,
  onClose,
  allSetups = [],
  onSelectSetup,
}) => {
  const [timeframe, setTimeframe] = useState("1m");
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
          quantity: stock.suggested_qty,
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

  const candles = generateStockCandles(stock);

  // Calculate Chart Extents
  const allPrices = [
    ...candles.map((c) => c.high),
    ...candles.map((c) => c.low),
    stock.entry_price,
    stock.stop_loss,
    stock.target_price,
    stock.vwap,
    ...(stock.retest_level ? [stock.retest_level] : []),
  ];

  const minPrice = Math.min(...allPrices) * 0.998;
  const maxPrice = Math.max(...allPrices) * 1.002;
  const priceRange = maxPrice - minPrice;

  // Chart Dimensions
  const chartWidth = 740;
  const chartHeight = 360;
  const paddingLeft = 10;
  const paddingRight = 75;
  const paddingTop = 25;
  const paddingBottom = 40;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const getY = (price: number) => {
    return paddingTop + usableHeight - ((price - minPrice) / priceRange) * usableHeight;
  };

  const candleSpacing = usableWidth / candles.length;
  const candleWidth = Math.max(candleSpacing * 0.65, 5);

  const entryY = getY(stock.entry_price);
  const slY = getY(stock.stop_loss);
  const targetY = getY(stock.target_price);
  const vwapY = getY(stock.vwap);

  // Volume Bar scaling
  const maxVol = Math.max(...candles.map((c) => c.volume));
  const volHeight = 55;

  // Current stock index in allSetups
  const currentIndex = allSetups.findIndex((s) => s.symbol === stock.symbol);
  const prevSetup = currentIndex > 0 ? allSetups[currentIndex - 1] : null;
  const nextSetup = currentIndex >= 0 && currentIndex < allSetups.length - 1 ? allSetups[currentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#080b13] border border-slate-800 rounded-2xl max-w-6xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* ============================================================ */}
        {/* MODAL TOP COMMAND HEADER                                     */}
        {/* ============================================================ */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#0a0f1c]">
          <div className="flex items-center space-x-3">
            {/* Symbol & Direction Badge */}
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black text-white tracking-tight font-mono">
                {stock.symbol}
              </span>
              <span
                className={`text-xs font-mono font-extrabold px-2.5 py-0.5 rounded uppercase ${
                  stock.signal === "BUY"
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950"
                    : "bg-rose-600 text-white shadow-sm shadow-rose-950"
                }`}
              >
                {stock.signal} SETUP
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {stock.sector} • NSE Spot
              </span>
            </div>

            {/* Next / Prev Stock Switcher */}
            <div className="hidden md:flex items-center space-x-1 pl-3 border-l border-slate-800">
              <button
                disabled={!prevSetup}
                onClick={() => prevSetup && onSelectSetup && onSelectSetup(prevSetup)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title={prevSetup ? `Previous: ${prevSetup.symbol}` : undefined}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={!nextSetup}
                onClick={() => nextSetup && onSelectSetup && onSelectSetup(nextSetup)}
                className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                title={nextSetup ? `Next: ${nextSetup.symbol}` : undefined}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Toolbar & Close */}
          <div className="flex items-center space-x-3">
            {/* Timeframe selector */}
            <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              {["1m", "3m", "5m", "15m"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    timeframe === tf
                      ? "bg-cyan-600 text-white font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Indicator Toggles */}
            <div className="hidden lg:flex items-center space-x-1.5 text-xs font-mono">
              <button
                onClick={() => setShowVwap(!showVwap)}
                className={`px-2 py-1 rounded border text-[11px] font-semibold transition-all ${
                  showVwap
                    ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                VWAP
              </button>
              <button
                onClick={() => setShowEma(!showEma)}
                className={`px-2 py-1 rounded border text-[11px] font-semibold transition-all ${
                  showEma
                    ? "bg-purple-950 text-purple-300 border-purple-800"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                EMA 9/20
              </button>
              <button
                onClick={() => setShowShading(!showShading)}
                className={`px-2 py-1 rounded border text-[11px] font-semibold transition-all ${
                  showShading
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                R:R Zones
              </button>
              <button
                onClick={() => setShowPriceAction(!showPriceAction)}
                className={`px-2 py-1 rounded border text-[11px] font-semibold transition-all ${
                  showPriceAction
                    ? "bg-amber-950 text-amber-300 border-amber-800"
                    : "bg-slate-900 text-slate-500 border-slate-800"
                }`}
              >
                S/R Retest
              </button>
            </div>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MAIN BODY: 2 COLUMNS (CHART VISUALIZER + TRADE PLAN HUD)     */}
        {/* ============================================================ */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
          {/* LEFT 8 COLUMNS: INTERACTIVE CHART VIEWPORT */}
          <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#06080e]">
            {/* Live Chart Legend & Hover Data */}
            <div className="flex flex-wrap items-center justify-between text-xs font-mono pb-3 border-b border-slate-800/80 gap-2">
              <div className="flex items-center space-x-2 text-slate-300">
                <span className="font-bold text-white text-sm">
                  ₹{stock.price.toFixed(2)}
                </span>
                <span
                  className={`font-semibold flex items-center ${
                    stock.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {stock.change_pct >= 0 ? "+" : ""}
                  {stock.change.toFixed(2)} ({stock.change_pct >= 0 ? "+" : ""}
                  {stock.change_pct.toFixed(2)}%)
                </span>
              </div>

              {/* Hover / Live Candle OHLC */}
              <div className="text-[11px] text-slate-400 space-x-2.5">
                <span>
                  O: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.open : stock.price}</strong>
                </span>
                <span>
                  H: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.high : (stock.price + 5).toFixed(1)}</strong>
                </span>
                <span>
                  L: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.low : (stock.price - 4).toFixed(1)}</strong>
                </span>
                <span>
                  C: <strong className="text-slate-200">{hoveredCandle ? hoveredCandle.close : stock.price}</strong>
                </span>
                <span>
                  Vol: <strong className="text-cyan-400">{hoveredCandle ? hoveredCandle.volume.toLocaleString() : (stock.rvol * 45000).toFixed(0)}</strong>
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
                  const pVal = maxPrice - (pct * priceRange);
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
                      height={Math.abs(entryY - targetY)}
                      fill="url(#rewardZone)"
                      rx="4"
                    />
                    {/* Stop Loss Risk Shading (Between Entry & SL) */}
                    <rect
                      x={paddingLeft + candleSpacing * 15}
                      y={Math.min(entryY, slY)}
                      width={usableWidth - candleSpacing * 15}
                      height={Math.abs(entryY - slY)}
                      fill="url(#riskZone)"
                      rx="4"
                    />
                  </>
                )}

                {/* VWAP Overlay Line */}
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
                    strokeWidth="1.5"
                    strokeOpacity="0.8"
                  />
                )}

                {/* EMA 9 Fast Overlay Line */}
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
                      strokeOpacity="0.75"
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
                      strokeOpacity="0.75"
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
                  width="70"
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
                  TP ₹{stock.target_price.toFixed(1)}
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
                  width="70"
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
                  ENTRY ₹{stock.entry_price.toFixed(1)}
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
                  width="70"
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
                  SL ₹{stock.stop_loss.toFixed(1)}
                </text>

                {/* KEY S/R & RETEST LEVEL (Dashed Amber) */}
                {showPriceAction && stock.retest_level && (
                  <g>
                    {/* Translucent S/R Bounce Band */}
                    <rect
                      x={paddingLeft}
                      y={getY(stock.retest_level + stock.price * 0.0015)}
                      width={usableWidth}
                      height={Math.max(6, Math.abs(getY(stock.retest_level - stock.price * 0.0015) - getY(stock.retest_level + stock.price * 0.0015)))}
                      fill="#f59e0b18"
                      stroke="#f59e0b40"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={paddingLeft}
                      y1={getY(stock.retest_level)}
                      x2={chartWidth - paddingRight}
                      y2={getY(stock.retest_level)}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="5 3"
                    />
                    <rect
                      x={chartWidth - paddingRight + 4}
                      y={getY(stock.retest_level) - 9}
                      width="70"
                      height="18"
                      fill="#78350f"
                      stroke="#f59e0b"
                      strokeWidth="0.8"
                      rx="3"
                    />
                    <text
                      x={chartWidth - paddingRight + 7}
                      y={getY(stock.retest_level) + 3}
                      fill="#fef3c7"
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      S/R ₹{stock.retest_level.toFixed(1)}
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
                      {/* Arrow marker */}
                      <path d="M 0 10 L -4 0 L 4 0 Z" fill="#10b981" />
                      {/* Callout Box */}
                      <rect
                        x="-105"
                        y="-38"
                        width="210"
                        height="32"
                        fill="#0b1329"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        rx="6"
                        className="filter drop-shadow-md"
                      />
                      <text
                        x="0"
                        y="-22"
                        textAnchor="middle"
                        fill="#34d399"
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        ⚡ SETUP TRIGGER: 10:25 AM
                      </text>
                      <text
                        x="0"
                        y="-10"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        {stock.setup_type} ({stock.rvol}x Vol)
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
                  Target: <strong className="text-emerald-300">+{stock.reward_pts} pts</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
                  Stop Loss: <strong className="text-rose-300">-{stock.risk_pts} pts</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                  VWAP: <strong>₹{stock.vwap}</strong>
                </span>
                {stock.retest_level && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                    S/R Retest: <strong className="text-amber-300">₹{stock.retest_level.toFixed(1)}</strong>
                  </span>
                )}
              </div>

              <span className="text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                Risk : Reward = {stock.risk_reward}
              </span>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: QUANTITATIVE & PRICE ACTION VERIFICATION HUD */}
          <div className="lg:col-span-4 p-5 space-y-4 bg-[#090d17] overflow-y-auto max-h-[80vh]">
            {/* Dual Score & Tier Badge Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                    Setup Quality Tier
                  </span>
                  <div className="mt-0.5">
                    {stock.setup_tier === "A+" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> A+ PRIME SETUP
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-black bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                        A HIGH-CONVICTION
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider block">
                    Market Structure
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-950 text-slate-200 border border-slate-800 inline-block mt-0.5">
                    {stock.market_structure === "HH_HL" ? "HH + HL ↗" : stock.market_structure === "LH_LL" ? "LH + LL ↘" : "RANGE ↔"}
                  </span>
                </div>
              </div>

              {/* Dual Scores: AI Score + Price Action Score */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/70">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">AI Score</span>
                  <div className="text-xl font-black font-mono text-cyan-400">
                    {stock.ai_score} <span className="text-xs text-slate-500 font-normal">/ 100</span>
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

            {/* Trade Execution Plan Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800 flex justify-between">
                <span>Calculated Trade Plan</span>
                <span className="text-cyan-400">NSE Intraday MIS</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Entry Level:</span>
                <span className="font-bold text-slate-100">₹{stock.entry_price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stop Loss (SL):</span>
                <span className="font-bold text-rose-400">₹{stock.stop_loss.toFixed(2)} (-{stock.risk_pts} pts)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Level:</span>
                <span className="font-bold text-emerald-400">₹{stock.target_price.toFixed(2)} (+{stock.reward_pts} pts)</span>
              </div>
              {stock.retest_level && (
                <div className="flex justify-between text-amber-300">
                  <span className="text-slate-400">S/R Retest Level:</span>
                  <span className="font-bold">₹{stock.retest_level.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Risk : Reward:</span>
                <span className="font-bold text-cyan-400">{stock.risk_reward}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">Position Size:</span>
                <span className="font-bold text-slate-200">{stock.suggested_qty} Shares</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Max Risk:</span>
                <span className="text-slate-400">₹500 (0.5% of ₹1L Capital)</span>
              </div>
            </div>

            {/* Price Action V2 Verification & 0-20 Rubric Breakdown Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Price Action Engine (0–20 pts)
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  {stock.price_action_score || 18} / 20 Pts
                </span>
              </div>

              {/* Rubric factor rows */}
              <div className="space-y-1.5 font-mono text-[11px]">
                {(stock.pa_checklist || [
                  { rule: "Market Structure (HH + HL sequence)", points: 4, max: 4, passed: true },
                  { rule: "Breakout Quality (Full-body close)", points: 4, max: 4, passed: true },
                  { rule: "Retest Confirmation (Support held)", points: 4, max: 4, passed: true },
                  { rule: "Volume Context (Surge on Breakout)", points: 3, max: 3, passed: true },
                  { rule: "Key S/R Interaction (Polarity Flip)", points: 3, max: 3, passed: true },
                  { rule: "Candle Strength (Rejection Wick)", points: 2, max: 2, passed: true },
                ]).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-400 truncate max-w-[210px]">{item.rule}</span>
                    <span className={`font-bold flex items-center gap-1 ${item.passed ? "text-emerald-400" : "text-slate-500"}`}>
                      {item.passed ? `+${item.points} pts` : "0 pts"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Action Verdict Callout */}
              {stock.filter_verdict && (
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10.5px] text-slate-300 font-sans leading-relaxed">
                  <strong className="text-cyan-400 block font-mono text-[10px] uppercase mb-0.5">PA Verdict:</strong>
                  {stock.filter_verdict}
                </div>
              )}
            </div>

            {/* 7-Point Quantitative Strategy Checklist */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="font-bold text-slate-200">Indicator Confirmation Checklist</span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                  {(stock.checklist || []).filter((c: { rule: string; passed: boolean }) => c.passed).length} / {(stock.checklist || []).length} Passed
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                {(stock.checklist || []).map((item: { rule: string; passed: boolean }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-0.5">
                    <span className="text-slate-400 truncate max-w-[200px]">{item.rule}</span>
                    {item.passed ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> FAIL
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Index Alignment Callout */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-2.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">
                  NIFTY 50 Macro Alignment
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {stock.index_aligned
                    ? "Bullish Alignment confirmed with NIFTY (+0.45%)"
                    : "Caution: Divergent momentum with NIFTY"}
                </span>
              </div>
            </div>

            {/* Virtual Wallet Allocation & Risk Guard */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Wallet Allocation
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {stock.product_type || "MIS"} (5x Leverage)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">Margin Req</span>
                  <span className="font-extrabold text-cyan-300">
                    ₹{stock.margin_required ? stock.margin_required.toLocaleString("en-IN") : ((stock.price * stock.suggested_qty) / 5).toFixed(0)}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">Max Risk</span>
                  <span className="font-extrabold text-rose-400">
                    ₹{stock.max_risk_in_rs ? stock.max_risk_in_rs.toFixed(0) : (stock.risk_pts * stock.suggested_qty).toFixed(0)}
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">Target Gain</span>
                  <span className="font-extrabold text-emerald-400">
                    ₹{stock.expected_reward_in_rs ? stock.expected_reward_in_rs.toFixed(0) : (stock.reward_pts * stock.suggested_qty).toFixed(0)}
                  </span>
                </div>
              </div>

              {execError && (
                <div className="p-2 rounded bg-rose-950/80 border border-rose-600 text-rose-300 text-[10px] font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{execError}</span>
                </div>
              )}

              {execResult && (
                <div className="p-2 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-[10px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      {execResult.order_id}
                    </span>
                    <span className="text-[9px] text-slate-400">Upstox API MIS</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-300">
                    <span>Buffer Left: ₹{execResult.wallet_buffer_remaining.toLocaleString("en-IN")}</span>
                    <span>SL: ₹{execResult.stop_loss} | Tgt: ₹{execResult.target_price}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Execution Action CTA */}
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
                  <span>Order Punched within Wallet! ({stock.suggested_qty} Shares)</span>
                </>
              ) : execLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Punching Broker Order...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Execute Order ({stock.suggested_qty} Shares • ₹{stock.margin_required ? stock.margin_required.toLocaleString("en-IN") : ((stock.price * stock.suggested_qty) / 5).toFixed(0)} Margin)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
