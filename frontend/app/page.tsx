"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { TopMarketCards } from "@/components/TopMarketCards";
import { LiveSignalPanel } from "@/components/LiveSignalPanel";
import { SignalHistoryTable } from "@/components/SignalHistoryTable";
import { CSVImportModal } from "@/components/CSVImportModal";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { Activity, ShieldCheck, Database, Layers, UploadCloud, CheckCircle, Info } from "lucide-react";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [hasData, setHasData] = useState(true);
  const [marketStatus, setMarketStatus] = useState<any>(null);

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
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#070a10] text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Risk Notice Banner */}
      <DisclaimerBanner />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCsvModal={() => setCsvModalOpen(true)}
      />

      {/* Main Terminal View */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6">
        {/* Top Quick Market Cards */}
        <TopMarketCards />

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
              className="px-3.5 py-1.5 rounded-md bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Historical CSV
            </button>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left / Center 2 Columns: Live Signal & Ledger */}
          <div className="lg:col-span-2 space-y-5">
            {/* Live Signal Panel (Section 29) */}
            <LiveSignalPanel />

            {/* Signal History Table (Section 31) */}
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
                  <span className="text-slate-400">Intraday VWAP (09:15 Anchor)</span>
                  <span className="font-bold text-slate-200">25,155.00 <span className="text-emerald-400 text-[10px]">(+25 pts)</span></span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">EMA 9 / 20 / 50</span>
                  <span className="font-bold text-emerald-400">25,170 / 25,150 / 25,120</span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">RSI 14</span>
                  <span className="font-bold text-cyan-400">63.20 (Bullish)</span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">MACD (12, 26, 9)</span>
                  <span className="font-bold text-emerald-400">+14.2 (Histogram +3.8)</span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">ADX 14</span>
                  <span className="font-bold text-slate-200">28.40 (Trending)</span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">14-period ATR</span>
                  <span className="font-bold text-slate-200">18.50 pts</span>
                </div>

                <div className="flex justify-between p-2 rounded bg-slate-950/60">
                  <span className="text-slate-400">Opening Range (5m / 15m)</span>
                  <span className="font-bold text-slate-200">25,120 - 25,175</span>
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
      </main>

      {/* CSV Ingestion Modal */}
      <CSVImportModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onSuccess={() => setHasData(true)}
      />

      {/* Persistent System Status Bar */}
      <SystemStatusBar />
    </div>
  );
}
