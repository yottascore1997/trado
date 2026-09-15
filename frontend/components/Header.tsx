"use client";

import React, { useState, useEffect } from "react";
import {
  Menu,
  Clock,
  Radio,
  ShieldCheck,
  UploadCloud,
  RefreshCw,
  Search,
  Bell,
} from "lucide-react";

interface HeaderProps {
  activeTab: string;
  onOpenMobileMenu: () => void;
  onOpenCsvModal: () => void;
  isMarketOpen?: boolean;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Terminal Dashboard",
    subtitle: "Real-time NSE Intraday Intelligence & Dual-Engine Architecture",
  },
  screener: {
    title: "AI Stock Screener & Top Setups",
    subtitle: "2,000+ NSE Universe Funnel • Volume, VWAP & Index Alignment Engine",
  },
  signals: {
    title: "Live Signals & Order Book",
    subtitle: "Deterministic 100-pt Algorithmic Signal Engine (BUY / SELL / NO TRADE)",
  },
  markets: {
    title: "Markets & Benchmark Indices",
    subtitle: "NIFTY 50 & BANK NIFTY 1-Minute Candle Feeds & Volume Profiles",
  },
  charts: {
    title: "Technical Charting Suite",
    subtitle: "Multi-timeframe Candlesticks, VWAP Anchor, EMA 9/20/50 & RSI Radar",
  },
  paper: {
    title: "Paper Trading Simulator",
    subtitle: "Zero-Risk Execution Environment with Dynamic Slippage & Brokerage",
  },
  backtest: {
    title: "Historical Strategy Backtest",
    subtitle: "Walk-forward validation over 1-minute historical datasets",
  },
  aimodel: {
    title: "AI & Machine Learning Matrix",
    subtitle: "Deterministic Scoring Model + XGBoost / Random Forest Classifier",
  },
  performance: {
    title: "Performance & Equity Curve",
    subtitle: "PnL distribution, Win/Loss analytics, and Sharpe ratio diagnostics",
  },
  risk: {
    title: "Risk Engine & Circuit Breakers",
    subtitle: "Mandatory Capital Protection: Max 1% Daily Drawdown & Consecutive Loss Limits",
  },
  settings: {
    title: "Terminal Settings & Broker API",
    subtitle: "Mock Mode, Upstox, Zerodha Kite API & Telegram Bot Webhook",
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenCsvModal,
  isMarketOpen = true,
}) => {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const meta = tabTitles[activeTab] || {
    title: "Trading Terminal",
    subtitle: "NSE Real-time Intraday Platform",
  };

  return (
    <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 h-16 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              {meta.title}
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase">
              {activeTab}
            </span>
          </div>
          <p className="hidden md:block text-xs text-slate-400 truncate max-w-xl">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Market Telemetry, Clock & Quick CTAs */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        {/* Market Session Badge */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="text-slate-300 font-medium">
            NSE: {isMarketOpen ? "LIVE (09:15 - 15:30 IST)" : "CLOSED"}
          </span>
        </div>

        {/* Live IST Clock */}
        <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-xs font-mono text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="tabular-nums font-semibold">{timeStr || "09:15:00 IST"}</span>
        </div>

        {/* Paper Trading Mode Pill */}
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>PAPER MODE</span>
        </div>

        {/* Import CSV Trigger */}
        <button
          onClick={onOpenCsvModal}
          className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
};
