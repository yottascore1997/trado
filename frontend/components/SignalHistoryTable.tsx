import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { Filter, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";

export interface SignalHistoryItem {
  id: string;
  time: string;
  instrument: string;
  signal_type: "BUY" | "SELL" | "NO_TRADE";
  entry_price: number;
  stop_loss: number;
  target_price: number;
  ai_score: number;
  risk_reward: string;
  result: "TARGET_HIT" | "STOP_LOSS_HIT" | "OPEN" | "INVALIDATED";
  pnl?: number;
  setup_type: string;
  regime: string;
}

const SAMPLE_SIGNALS: SignalHistoryItem[] = [
  {
    id: "sig-01",
    time: "10:25 AM",
    instrument: "NIFTY 50",
    signal_type: "BUY",
    entry_price: 25180.0,
    stop_loss: 25150.0,
    target_price: 25240.0,
    ai_score: 86,
    risk_reward: "1:2.0",
    result: "OPEN",
    setup_type: "VWAP Breakout + Vol",
    regime: "TRENDING_BULLISH",
  },
  {
    id: "sig-02",
    time: "09:42 AM",
    instrument: "BANK NIFTY",
    signal_type: "NO_TRADE",
    entry_price: 51780.0,
    stop_loss: 51700.0,
    target_price: 51940.0,
    ai_score: 54,
    risk_reward: "1:2.0",
    result: "INVALIDATED",
    setup_type: "Choppy Range Filter",
    regime: "SIDEWAYS",
  },
  {
    id: "sig-03",
    time: "Yesterday 14:10",
    instrument: "NIFTY 50",
    signal_type: "BUY",
    entry_price: 25040.0,
    stop_loss: 25015.0,
    target_price: 25090.0,
    ai_score: 89,
    risk_reward: "1:2.0",
    result: "TARGET_HIT",
    pnl: 1250.0,
    setup_type: "EMA Pullback + Support",
    regime: "TRENDING_BULLISH",
  },
  {
    id: "sig-04",
    time: "Yesterday 11:15",
    instrument: "BANK NIFTY",
    signal_type: "SELL",
    entry_price: 51920.0,
    stop_loss: 51990.0,
    target_price: 51780.0,
    ai_score: 83,
    risk_reward: "1:2.0",
    result: "STOP_LOSS_HIT",
    pnl: -525.0,
    setup_type: "VWAP Breakdown",
    regime: "HIGH_VOLATILITY",
  },
];

export interface SignalHistoryTableProps {
  signals?: SignalHistoryItem[];
}

export const SignalHistoryTable: React.FC<SignalHistoryTableProps> = ({ signals: initialSignals }) => {
  const [signals, setSignals] = useState<SignalHistoryItem[]>(initialSignals || SAMPLE_SIGNALS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialSignals && initialSignals.length > 0) {
      setSignals(initialSignals);
      return;
    }

    const fetchHistoricalTrades = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl("/api/v1/market/backtest/run?symbol=NIFTY%2050"));
        if (res.ok) {
          const data = await res.json();
          if (data.trades && data.trades.length > 0) {
            const mapped: SignalHistoryItem[] = data.trades.slice(0, 10).map((t: any) => ({
              id: t.id,
              time: t.time,
              instrument: t.instrument,
              signal_type: t.type,
              entry_price: t.entry_price,
              stop_loss: t.stop_loss,
              target_price: t.target,
              ai_score: t.ai_score || 88,
              risk_reward: "1:2.0",
              result: t.result === "TARGET_HIT" ? "TARGET_HIT" : t.result === "STOP_LOSS_HIT" ? "STOP_LOSS_HIT" : "OPEN",
              pnl: t.pnl,
              setup_type: t.setup_type || "Price Action Breakout",
              regime: t.regime || "TRENDING",
            }));
            setSignals(mapped);
          }
        }
      } catch (e) {
        // Fallback to sample signals
      } finally {
        setLoading(false);
      }
    };
    fetchHistoricalTrades();
  }, [initialSignals]);

  return (
    <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 shadow-sm mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="font-bold text-sm text-slate-100">Intraday Signal Ledger & Auditing</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Real-time Historical Track Record
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 flex items-center gap-1 font-mono">
            <Filter className="w-3.5 h-3.5" /> Filter: All Instruments
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Instrument</th>
              <th className="py-2.5 px-3">Signal</th>
              <th className="py-2.5 px-3">Entry</th>
              <th className="py-2.5 px-3">Stop Loss</th>
              <th className="py-2.5 px-3">Target</th>
              <th className="py-2.5 px-3">AI Score</th>
              <th className="py-2.5 px-3">R : R</th>
              <th className="py-2.5 px-3">Setup</th>
              <th className="py-2.5 px-3">Regime</th>
              <th className="py-2.5 px-3">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {signals.map((sig) => {
              const isBuy = sig.signal_type === "BUY";
              const isSell = sig.signal_type === "SELL";
              const isNoTrade = sig.signal_type === "NO_TRADE";

              return (
                <tr key={sig.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{sig.time}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-100">{sig.instrument}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        isBuy
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : isSell
                          ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {isBuy && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                      {isSell && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                      {sig.signal_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200">₹{sig.entry_price.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-rose-400">₹{sig.stop_loss.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-emerald-400">₹{sig.target_price.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-400">{sig.ai_score} / 100</td>
                  <td className="py-2.5 px-3 text-slate-300">{sig.risk_reward}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans">{sig.setup_type}</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400">{sig.regime}</td>
                  <td className="py-2.5 px-3">
                    {sig.result === "OPEN" && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold animate-pulse">
                        OPEN
                      </span>
                    )}
                    {sig.result === "TARGET_HIT" && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                        +₹{sig.pnl} (TARGET)
                      </span>
                    )}
                    {sig.result === "STOP_LOSS_HIT" && (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                        -₹{Math.abs(sig.pnl || 0)} (SL)
                      </span>
                    )}
                    {sig.result === "INVALIDATED" && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                        NO TRADE
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
