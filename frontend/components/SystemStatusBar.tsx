import React from "react";
import { Database, Server, Cpu, Radio, Shield, Clock } from "lucide-react";

export const SystemStatusBar: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 bg-[#080b12] py-2 px-4 text-[11px] font-mono text-slate-400">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Status Indicators */}
        <div className="flex flex-wrap items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300">Market Data:</span>
            <span className="text-emerald-400 font-bold">MOCK NSE FEED (CONNECTED)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-300">Database:</span>
            <span className="text-emerald-400 font-semibold">CONNECTED</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">AI Model:</span>
            <span className="text-cyan-400 font-semibold">READY (XGB-v1.0)</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">WebSocket:</span>
            <span className="text-emerald-400 font-semibold">ACTIVE</span>
          </div>
        </div>

        {/* Latency & Timestamp */}
        <div className="flex items-center space-x-4 text-slate-400">
          <div>
            <span>Data Latency: </span>
            <span className="text-emerald-400 font-bold">8.4 ms</span>
          </div>
          <div>
            <span>Last 1m Candle: </span>
            <span className="text-slate-200">10:25:00 IST</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
            <span>NSE: 09:15 - 15:30 IST</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
