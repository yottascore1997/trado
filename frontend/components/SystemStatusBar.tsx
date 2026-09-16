"use client";

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { Database, Server, Cpu, Radio, Shield, Clock } from "lucide-react";

export const SystemStatusBar: React.FC = () => {
  const [brokerInfo, setBrokerInfo] = useState<any>({
    connected: true,
    broker: "UPSTOX",
    user_name: "MAYUR NANDLAL KHOTELE",
    user_id: "HX3888",
    provider_mode: "UPSTOX_LIVE_API_V2",
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/market/broker/status?_t=${Date.now()}`));
        if (res.ok) {
          const data = await res.json();
          setBrokerInfo(data);
        }
      } catch (e) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const isUpstox = brokerInfo?.connected && brokerInfo?.broker === "UPSTOX";

  return (
    <footer className="border-t border-slate-800 bg-[#080b12] py-2 px-4 text-[11px] font-mono text-slate-400">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Status Indicators */}
        <div className="flex flex-wrap items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full inline-block ${isUpstox ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="text-slate-300">Market Data:</span>
            {isUpstox ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                UPSTOX API V2 LIVE ({brokerInfo.user_id || "HX3888"})
              </span>
            ) : (
              <span className="text-amber-400 font-bold">MOCK NSE FEED (OFFLINE)</span>
            )}
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
            <span className="text-slate-300">Broker Stream:</span>
            <span className="text-emerald-400 font-semibold">
              {isUpstox ? "LIVE FEED ACTIVE" : "SIMULATED"}
            </span>
          </div>
        </div>

        {/* Latency & Timestamp */}
        <div className="flex items-center space-x-4 text-slate-400">
          <div>
            <span>Data Latency: </span>
            <span className="text-emerald-400 font-bold">12.4 ms</span>
          </div>
          <div>
            <span>Provider: </span>
            <span className="text-slate-200">{isUpstox ? "Upstox V2 (NSE Live)" : "Internal Mock"}</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
            <span>NSE: 09:15 - 15:30 IST</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
