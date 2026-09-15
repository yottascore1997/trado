"use client";

import React from "react";
import {
  Activity,
  TrendingUp,
  Zap,
  BarChart2,
  Layers,
  ShieldAlert,
  Cpu,
  FileText,
  Sliders,
  Settings,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Database,
  Radio,
  Sparkles,
  Flame,
  X,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCsvModal: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMarketOpen?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    group: "ANALYTICS & SIGNALS",
    items: [
      { id: "dashboard", label: "Dashboard", icon: Activity },
      { id: "screener", label: "AI Stock Screener", icon: Flame, badge: "🔥 TOP 5", badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
      { id: "signals", label: "Live Signals", icon: Zap, badge: "LIVE", badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      { id: "markets", label: "Markets & Indices", icon: TrendingUp },
      { id: "charts", label: "Technical Charts", icon: BarChart2 },
    ],
  },
  {
    group: "EXECUTION & LAB",
    items: [
      { id: "paper", label: "Paper Trading", icon: ShieldAlert, badge: "₹100k", badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
      { id: "backtest", label: "Historical Backtest", icon: Layers },
      { id: "aimodel", label: "AI Model Engine", icon: Cpu, badge: "XGB", badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      { id: "performance", label: "Performance", icon: FileText },
    ],
  },
  {
    group: "CONTROL & RISK",
    items: [
      { id: "risk", label: "Circuit Breakers", icon: Sliders },
      { id: "settings", label: "Terminal Settings", icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCsvModal,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  isMarketOpen = true,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-[#080b13] border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? "w-18" : "w-64"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-100" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-slate-100 truncate">
                    ALPHA INTRA
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                    NSE
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider truncate">
                  AI SIGNAL ENGINE v1.0
                </span>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 py-1 text-[10px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                  {group.group}
                </div>
              ) : (
                <div className="my-1 border-t border-slate-800/60" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg transition-all text-xs font-medium group relative ${
                      collapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-2.5"
                    } ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-950/70 to-slate-900 text-cyan-300 font-semibold shadow-inner border border-cyan-800/50"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                  >
                    {/* Active Accent Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-cyan-400 rounded-r-full shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    )}

                    <div className="flex items-center space-x-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                          item.badgeColor || "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Actions & System Health */}
        <div className="p-3 border-t border-slate-800/80 space-y-2.5 shrink-0 bg-[#06080e]">
          {/* CSV Ingestion Button */}
          <button
            onClick={onOpenCsvModal}
            className={`w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium shadow-md shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              collapsed ? "p-2.5" : "px-3 py-2 text-xs"
            }`}
            title="Import 1-minute historical CSV data"
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Import 1m CSV</span>}
          </button>

          {/* Market Status Widget */}
          {!collapsed && (
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  NSE Session
                </span>
                <span
                  className={`font-bold ${
                    isMarketOpen ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isMarketOpen ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/70">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  Feed Latency
                </span>
                <span className="text-emerald-400 font-bold">8.4 ms</span>
              </div>
            </div>
          )}

          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="w-full hidden lg:flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-slate-200">
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
