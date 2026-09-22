"use client";

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import {
  Wallet,
  ShieldCheck,
  Zap,
  TrendingUp,
  Layers,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Sliders,
  DollarSign,
  Clock,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
  Flame,
} from "lucide-react";

export interface TradingPlanData {
  wallet_budget: number;
  trading_mode: string;
  trading_modes?: string[];
  risk_per_trade_pct: number;
  max_daily_loss_pct: number;
  max_active_trades: number;
  auto_square_off_time: string;
  is_paper_mode: boolean;
  kill_switch_active: boolean;
  metrics?: {
    wallet_budget: number;
    effective_buying_power: number;
    leverage_multiplier: number;
    risk_per_trade_in_rs: number;
    daily_loss_limit_in_rs: number;
    max_active_trades: number;
    allocation_per_stock_max: number;
    mode_description: string;
    product_type: string;
    square_off_mandatory: boolean;
    kill_switch_active: boolean;
    active_modes?: string[];
    mode_allocations?: Record<string, any>;
    total_allocated_capital?: number;
  };
}

interface Props {
  onPlanChange?: (plan: TradingPlanData) => void;
}

const PRESET_BUDGETS = [10000, 25000, 50000, 100000];

const MODES = [
  {
    id: "INTRADAY_STOCKS",
    label: "Intraday Stocks",
    subtitle: "5x Margin • 1-2 Liquid Stocks • Auto 3:15 PM Exit",
    badge: "5x LEVERAGE",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    icon: Flame,
    product: "MIS",
  },
  {
    id: "SWING_TRADING",
    label: "Swing Delivery",
    subtitle: "Cash Delivery • Multi-Day Holding • Zero Square-Off",
    badge: "CNC 100% CASH",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: Layers,
    product: "CNC",
  },
  {
    id: "BANKNIFTY_OPTIONS",
    label: "Bank Nifty Options",
    subtitle: "1 Lot ATM • 20pt SL Protection • High Volatility",
    badge: "1 LOT (15 QTY)",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    icon: Zap,
    product: "MIS",
  },
  {
    id: "NIFTY_OPTIONS",
    label: "NIFTY 50 Options",
    subtitle: "1 Lot ATM • Tight 10pt SL • Index Momentum",
    badge: "1 LOT (25 QTY)",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    icon: TrendingUp,
    product: "MIS",
  },
];

export const TradingPlanController: React.FC<Props> = ({ onPlanChange }) => {
  const [budget, setBudget] = useState<number>(10000);
  const [customInput, setCustomInput] = useState<string>("10000");
  const [selectedModes, setSelectedModes] = useState<string[]>(["INTRADAY_STOCKS"]);
  const [riskPct, setRiskPct] = useState<number>(1.5);
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [planData, setPlanData] = useState<TradingPlanData | null>(null);
  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [brokerStatus, setBrokerStatus] = useState<any>(null);

  const round2 = (num: number) => Math.round(num * 100) / 100;

  // Helper to build fallback metrics for multi-mode budget
  const createPlanData = (b: number, modes: string[], r: number, kill: boolean = false): TradingPlanData => {
    const validModes = modes.length > 0 ? modes : ["INTRADAY_STOCKS"];
    let totalBuyingPower = 0;
    let totalMaxActive = 0;
    const modeAllocations: Record<string, any> = {};

    validModes.forEach((m) => {
      const lev = m === "INTRADAY_STOCKS" ? 5.0 : 1.0;
      const bp = b * lev;
      totalBuyingPower += bp;
      const maxAct = m === "INTRADAY_STOCKS" ? (b <= 25000 ? 2 : (b <= 50000 ? 3 : 4)) : (m === "SWING_TRADING" ? (b <= 25000 ? 2 : 3) : 1);
      totalMaxActive += maxAct;
      modeAllocations[m] = {
        mode: m,
        budget: b,
        leverage: lev,
        effective_buying_power: bp,
        product_type: m === "SWING_TRADING" ? "CNC" : "MIS",
        max_active_trades: maxAct,
      };
    });

    const totalAllocated = b * validModes.length;
    const effLev = totalAllocated > 0 ? round2(totalBuyingPower / totalAllocated) : 1.0;
    const hasMis = validModes.some((m) => m !== "SWING_TRADING");
    const hasCnc = validModes.includes("SWING_TRADING");
    const prodType = hasMis && hasCnc ? "MIS & CNC" : hasCnc ? "CNC" : "MIS";

    return {
      wallet_budget: b,
      trading_mode: validModes.join(","),
      trading_modes: validModes,
      risk_per_trade_pct: r,
      max_daily_loss_pct: 3.0,
      max_active_trades: totalMaxActive,
      auto_square_off_time: "15:15:00",
      is_paper_mode: true,
      kill_switch_active: kill,
      metrics: {
        wallet_budget: b,
        effective_buying_power: totalBuyingPower,
        leverage_multiplier: effLev,
        risk_per_trade_in_rs: round2((b * r) / 100),
        daily_loss_limit_in_rs: round2(totalAllocated * 0.03),
        max_active_trades: totalMaxActive,
        allocation_per_stock_max: round2(b / Math.max(1, totalMaxActive)),
        mode_description:
          validModes.length === 1
            ? validModes[0] === "INTRADAY_STOCKS"
              ? "Intraday Cash Equities (5x Leverage, Auto 3:15 PM Square-off)"
              : validModes[0] === "SWING_TRADING"
              ? "Cash Delivery Swing Portfolio (Multi-Day Hold, Zero Square-Off)"
              : "Index Options (1 Lot ATM, Defined Risk)"
            : `Multi-Segment Active: ${validModes.join(", ")} (₹${b.toLocaleString("en-IN")} per segment)`,
        product_type: prodType,
        square_off_mandatory: hasMis,
        kill_switch_active: kill,
        active_modes: validModes,
        mode_allocations: modeAllocations,
        total_allocated_capital: totalAllocated,
      },
    };
  };

  // Load from localStorage immediately on mount
  useEffect(() => {
    try {
      const savedBudget = localStorage.getItem("trado_wallet_budget");
      const savedModes = localStorage.getItem("trado_trading_modes");
      const savedMode = localStorage.getItem("trado_trading_mode");
      const savedRisk = localStorage.getItem("trado_risk_pct");
      if (savedBudget) {
        const p = parseFloat(savedBudget);
        if (!isNaN(p) && p >= 1000) {
          setBudget(p);
          setCustomInput(p.toString());
        }
      }
      if (savedModes) {
        try {
          const parsed = JSON.parse(savedModes);
          if (Array.isArray(parsed) && parsed.length > 0) setSelectedModes(parsed);
        } catch (e) {
          if (savedModes.includes(",")) setSelectedModes(savedModes.split(",").map((s) => s.trim()));
          else setSelectedModes([savedModes]);
        }
      } else if (savedMode) {
        if (savedMode.includes(",")) setSelectedModes(savedMode.split(",").map((s) => s.trim()));
        else setSelectedModes([savedMode]);
      }
      if (savedRisk) {
        const r = parseFloat(savedRisk);
        if (!isNaN(r)) setRiskPct(r);
      }
    } catch (e) {}
    fetchPlan();
  }, []);

  const fetchBrokerStatus = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/market/broker/status"));
      if (res.ok) {
        const data = await res.json();
        setBrokerStatus(data);
      }
    } catch (e) {}
  };

  // Fetch initial plan from backend
  const fetchPlan = async () => {
    try {
      setLoading(true);
      fetchBrokerStatus();
      const res = await fetch(apiUrl(`/api/v1/market/trading-plan?_t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        setPlanData(data);
        setBudget(data.wallet_budget);
        setCustomInput(data.wallet_budget.toString());
        const modes =
          data.trading_modes && data.trading_modes.length > 0
            ? data.trading_modes
            : data.trading_mode
            ? data.trading_mode.split(",").map((s: string) => s.trim())
            : ["INTRADAY_STOCKS"];
        setSelectedModes(modes);
        setRiskPct(data.risk_per_trade_pct);
        setKillSwitch(data.kill_switch_active);
        try {
          localStorage.setItem("trado_wallet_budget", data.wallet_budget.toString());
          localStorage.setItem("trado_trading_modes", JSON.stringify(modes));
          localStorage.setItem("trado_trading_mode", modes.join(","));
          localStorage.setItem("trado_risk_pct", data.risk_per_trade_pct.toString());
        } catch (e) {}
        if (onPlanChange) onPlanChange(data);
      } else {
        throw new Error("Bad response");
      }
    } catch (e) {
      let currentB = budget;
      let currentModes = selectedModes;
      try {
        const savedB = localStorage.getItem("trado_wallet_budget");
        if (savedB) currentB = parseFloat(savedB) || currentB;
        const savedM = localStorage.getItem("trado_trading_modes");
        if (savedM) currentModes = JSON.parse(savedM);
      } catch (err) {}
      const fallback = createPlanData(currentB, currentModes, riskPct, killSwitch);
      setPlanData(fallback);
      if (onPlanChange) onPlanChange(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Update plan on backend & localStorage
  const updatePlan = async (newBudget: number, newModes: string[], newRisk: number) => {
    try {
      setLoading(true);
      const safeModes = newModes.length > 0 ? newModes : ["INTRADAY_STOCKS"];
      const modesStr = safeModes.join(",");
      try {
        localStorage.setItem("trado_wallet_budget", newBudget.toString());
        localStorage.setItem("trado_trading_modes", JSON.stringify(safeModes));
        localStorage.setItem("trado_trading_mode", modesStr);
        localStorage.setItem("trado_risk_pct", newRisk.toString());
      } catch (e) {}

      // Update immediate local UI state so user sees no lag
      const optimistic = createPlanData(newBudget, safeModes, newRisk, killSwitch);
      setPlanData(optimistic);
      if (onPlanChange) onPlanChange(optimistic);

      // Notify other components via window event
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trado_plan_updated", {
            detail: {
              wallet_budget: newBudget,
              trading_modes: safeModes,
              trading_mode: modesStr,
              risk_pct: newRisk,
            },
          })
        );
      }

      const res = await fetch(apiUrl("/api/v1/market/trading-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_budget: newBudget,
          trading_modes: safeModes,
          trading_mode: modesStr,
          risk_per_trade_pct: newRisk,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlanData(data);
        if (onPlanChange) onPlanChange(data);
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 2500);
      }
    } catch (e) {
      console.error("Failed to update trading plan on backend:", e);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetSelect = (val: number) => {
    setBudget(val);
    setCustomInput(val.toString());
    updatePlan(val, selectedModes, riskPct);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customInput);
    if (!isNaN(val) && val >= 1000) {
      setBudget(val);
      updatePlan(val, selectedModes, riskPct);
    }
  };

  const handleModeToggle = (modeId: string) => {
    let nextModes: string[];
    if (selectedModes.includes(modeId)) {
      if (selectedModes.length === 1) {
        // Must keep at least one mode active
        return;
      }
      nextModes = selectedModes.filter((m) => m !== modeId);
    } else {
      nextModes = [...selectedModes, modeId];
    }
    setSelectedModes(nextModes);
    updatePlan(budget, nextModes, riskPct);
  };

  const handleToggleKillSwitch = async () => {
    try {
      const nextKill = !killSwitch;
      setKillSwitch(nextKill);
      const res = await fetch(apiUrl("/api/v1/market/trading-plan/kill-switch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextKill }),
      });
      if (res.ok) {
        const data = await res.json();
        setKillSwitch(data.kill_switch_active);
        if (planData) {
          const updated = { ...planData, kill_switch_active: data.kill_switch_active };
          setPlanData(updated);
          if (onPlanChange) onPlanChange(updated);
        }
      }
    } catch (e) {}
  };

  // Metrics derived from active segments
  const activeModesCount = selectedModes.length;
  const totalAllocatedCapital = budget * activeModesCount;
  const hasIntraday = selectedModes.includes("INTRADAY_STOCKS");
  const hasSwing = selectedModes.includes("SWING_TRADING");
  const hasBankNifty = selectedModes.includes("BANKNIFTY_OPTIONS");
  const hasNifty = selectedModes.includes("NIFTY_OPTIONS");

  // Sum effective buying power across all selected modes
  const totalBuyingPower = selectedModes.reduce((sum, m) => {
    const lev = m === "INTRADAY_STOCKS" ? 5 : 1;
    return sum + budget * lev;
  }, 0);

  const effLeverage = totalAllocatedCapital > 0 ? (totalBuyingPower / totalAllocatedCapital).toFixed(1) : "1.0";
  const riskAmount = (budget * riskPct) / 100;
  const dailyLossLimit = totalAllocatedCapital * 0.03;
  const activeStocks = selectedModes.reduce((sum, m) => {
    if (m === "INTRADAY_STOCKS") return sum + (budget <= 25000 ? 2 : 4);
    if (m === "SWING_TRADING") return sum + (budget <= 25000 ? 2 : 3);
    return sum + 1;
  }, 0);
  const allocPerStock = budget / Math.max(1, activeStocks);

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#0e1424] to-[#0a0d18] border border-cyan-500/20 shadow-2xl shadow-cyan-950/20 overflow-hidden">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black tracking-wide text-slate-100 uppercase">
                Trading Plan & Virtual Wallet Controller
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Multi-Segment Isolated
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ₹{budget.toLocaleString("en-IN")} dedicated per active segment. Upstox balance is 100% isolated & safe.
            </p>
          </div>
        </div>

        {/* Emergency Kill Switch & Broker Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Upstox Account Status */}
          {brokerStatus?.connected ? (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-emerald-400">UPSTOX LIVE:</span>
              <span className="text-slate-100 font-extrabold">{brokerStatus.user_name}</span>
              <span className="text-emerald-400 font-bold">({brokerStatus.user_id})</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Paper Simulation</span>
            </div>
          )}

          {saveToast && (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" /> Plan Synced
            </span>
          )}

          <button
            onClick={handleToggleKillSwitch}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
              killSwitch
                ? "bg-rose-950/80 text-rose-300 border-rose-600 hover:bg-rose-900"
                : "bg-emerald-950/60 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/80"
            }`}
          >
            {killSwitch ? (
              <>
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>KILL SWITCH TRIPPED (LOCKED)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>SYSTEM ARMED & ACTIVE</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Row 1: Wallet Allocation & Mode Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Virtual Wallet Input & Presets (5 Cols) */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 tracking-wide">
                  Allocated Trading Wallet (Per Segment)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Upstox Margin Safe
              </span>
            </div>

            {/* Custom Amount Form */}
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-cyan-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="Enter custom budget..."
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Apply
              </button>
            </form>

            {/* Quick Preset Pills */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {PRESET_BUDGETS.map((amt) => {
                const isSelected = budget === amt;
                return (
                  <button
                    key={amt}
                    onClick={() => handleBudgetSelect(amt)}
                    className={`py-1.5 px-1 text-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    ₹{amt >= 100000 ? `${amt / 100000}L` : `${amt / 1000}k`}
                  </button>
                );
              })}
            </div>

            {/* Micro Summary Banner */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Active Trade Isolation:</span>
              <span className="font-extrabold text-cyan-300">
                ₹{budget.toLocaleString("en-IN")} / Segment ({activeModesCount} Active)
              </span>
            </div>
          </div>

          {/* Right: Multi-Select Mode Cards (7 Cols) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Active Market Segments ({activeModesCount} Selected)
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                Click cards to toggle multi-mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MODES.map((m) => {
                const isSelected = selectedModes.includes(m.id);
                const IconComponent = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleModeToggle(m.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative select-none ${
                      isSelected
                        ? "bg-gradient-to-br from-cyan-950/40 via-slate-900 to-blue-950/30 border-cyan-500/70 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30"
                        : "bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-90 hover:bg-slate-900/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/50"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100">
                            {m.label}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${m.badgeColor}`}
                      >
                        {m.badge}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[10px] text-slate-400 leading-tight">
                      {m.subtitle}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Product:</span>
                        <span className="font-bold text-slate-300">{m.product}</span>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50 shadow-sm">
                          ₹{budget.toLocaleString("en-IN")} Dedicated
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 font-mono">
                          + Tap to Activate
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Live Capital Allocation & Dynamic Risk Metrics HUD */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Total Effective Buying Power */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Effective Buying Power
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold text-slate-100 font-mono">
                ₹{totalBuyingPower.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] font-bold text-amber-400 font-mono">
                ({effLeverage}x)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate" title={`Active: ${selectedModes.join(", ")}`}>
              {hasIntraday ? `₹${(budget * 5).toLocaleString("en-IN")} Intraday (5x)` : ""}
              {hasIntraday && hasSwing ? " + " : ""}
              {hasSwing ? `₹${budget.toLocaleString("en-IN")} Swing (1x)` : ""}
              {(hasIntraday || hasSwing) && (hasBankNifty || hasNifty) ? " + " : ""}
              {(hasBankNifty || hasNifty) ? `₹${budget.toLocaleString("en-IN")} Options` : ""}
            </p>
          </div>

          {/* Card 2: Max Risk Per Trade */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Max Risk Per Trade
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold text-cyan-300 font-mono">
                ₹{riskAmount.toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({riskPct}% of Segment)
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Automatic share quantity sizing
            </p>
          </div>

          {/* Card 3: Daily Loss Limit (Kill Switch) */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Daily Stop-Loss Lock
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold text-rose-400 font-mono">
                ₹{dailyLossLimit.toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                (3.0% Across {activeModesCount} {activeModesCount === 1 ? "Segment" : "Segments"})
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Trading freezes if loss reaches limit
            </p>
          </div>

          {/* Card 4: Active Parallel Stocks */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" />
              Simultaneous Focus
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {activeStocks} {activeStocks === 1 ? "Trade" : "Trades Max"}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              ₹{allocPerStock.toLocaleString("en-IN")} margin / position
            </p>
          </div>
        </div>

        {/* Visual Capital Allocation Progress Bar & Active Segments List */}
        <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-400" /> Dedicated Segment Allocations
            </span>
            <span className="text-cyan-300 font-bold">
              Total Capital: ₹{totalAllocatedCapital.toLocaleString("en-IN")} ({activeModesCount} Active × ₹{budget.toLocaleString("en-IN")})
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {selectedModes.map((m) => {
              const def = MODES.find((item) => item.id === m);
              const lev = m === "INTRADAY_STOCKS" ? "5x MIS" : m === "SWING_TRADING" ? "100% Cash CNC" : "MIS 1 Lot";
              return (
                <div
                  key={m}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/40 text-slate-200 text-xs font-mono flex items-center gap-2"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-bold">{def?.label || m}:</span>
                  <span className="text-cyan-300 font-extrabold">₹{budget.toLocaleString("en-IN")}</span>
                  <span className="text-slate-400 text-[10px]">({lev})</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
