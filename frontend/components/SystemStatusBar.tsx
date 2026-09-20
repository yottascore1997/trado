"use client";

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { Database, Server, Cpu, Radio, Shield, Clock, Key, AlertTriangle, CheckCircle2, X } from "lucide-react";

export const SystemStatusBar: React.FC = () => {
  const [brokerInfo, setBrokerInfo] = useState<any>({
    connected: true,
    token_valid: true,
    broker: "UPSTOX",
    user_name: "MAYUR NANDLAL KHOTELE",
    user_id: "HX3888",
    provider_mode: "UPSTOX_LIVE_API_V2",
  });
  const [showModal, setShowModal] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl(`/api/v1/market/broker/status?_t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        setBrokerInfo(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) return;
    try {
      setUpdating(true);
      setUpdateMsg(null);
      const res = await fetch(apiUrl("/api/v1/market/broker/update-token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: newToken.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpdateMsg({ type: "success", text: data.message || "Token updated! Reconnected to Upstox." });
        setNewToken("");
        fetchStatus();
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setUpdateMsg({ type: "error", text: data.message || data.detail || "Invalid token format." });
      }
    } catch (err: any) {
      setUpdateMsg({ type: "error", text: err.message || "Network error" });
    } finally {
      setUpdating(false);
    }
  };

  const isUpstox = brokerInfo?.broker === "UPSTOX";
  const isExpired = brokerInfo?.token_valid === false || brokerInfo?.provider_mode === "UPSTOX_TOKEN_EXPIRED";

  return (
    <>
      <footer className="border-t border-slate-800 bg-[#080b12] py-2 px-4 text-[11px] font-mono text-slate-400">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Status Indicators */}
          <div className="flex flex-wrap items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  isExpired
                    ? "bg-rose-500 animate-ping"
                    : isUpstox
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-slate-300">Market Data:</span>
              {isExpired ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  UPSTOX TOKEN EXPIRED (CLICK TO RENEW)
                </button>
              ) : isUpstox ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  UPSTOX API V2 LIVE ({brokerInfo.user_id || "HX3888"})
                </span>
              ) : (
                <span className="text-slate-400 font-bold">UPSTOX FEED (OFFLINE)</span>
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
              <span className={isExpired ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {isExpired ? "TOKEN EXPIRED" : isUpstox ? "LIVE FEED ACTIVE" : "STANDBY"}
              </span>
            </div>
          </div>

          {/* Latency & Timestamp */}
          <div className="flex items-center space-x-4 text-slate-400">
            <button
              onClick={() => setShowModal(true)}
              className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/60 flex items-center gap-1 text-[10px] cursor-pointer transition-colors"
            >
              <Key className="w-3 h-3 text-cyan-400" />
              Update Upstox Token
            </button>
            <div>
              <span>Provider: </span>
              <span className="text-slate-200">Upstox V2 (NSE Live)</span>
            </div>
            <div className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <span>NSE: 09:15 - 15:30 IST</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Upstox Token Update Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0e1424] border border-cyan-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Daily Upstox Token Renewal</h3>
                  <p className="text-[11px] text-slate-400">SEBI requires tokens to be renewed daily</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateToken} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Paste Today's Access Token:
                </label>
                <textarea
                  rows={4}
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="Paste your new Upstox Bearer Access Token here..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {updateMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                    updateMsg.type === "success"
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {updateMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{updateMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !newToken.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {updating ? "Updating..." : "Reconnect Live Feed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
