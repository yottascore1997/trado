"use client";

import React from "react";
import { 
  Activity, 
  BarChart2, 
  Layers, 
  Sliders, 
  UploadCloud, 
  ShieldAlert, 
  Cpu, 
  TrendingUp, 
  Settings, 
  FileText 
} from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCsvModal: () => void;
  isMarketOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCsvModal,
  isMarketOpen = true,
}) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Activity },
    { id: "markets", label: "Markets", icon: TrendingUp },
    { id: "signals", label: "Signals", icon: ZapIcon },
    { id: "charts", label: "Charts", icon: BarChart2 },
    { id: "backtest", label: "Backtest", icon: Layers },
    { id: "paper", label: "Paper Trading", icon: ShieldAlert },
    { id: "performance", label: "Performance", icon: FileText },
    { id: "aimodel", label: "AI Model", icon: Cpu },
    { id: "risk", label: "Risk", icon: Sliders },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <header className="border-b border-slate-800 bg-[#090d16]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
            AI
          </div>
          <div>
            <div className="font-semibold text-sm tracking-wide text-slate-100 flex items-center gap-2">
              <span>AI Intraday Signal Engine</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-mono">
                NSE INDEX
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden xl:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right side controls & badges */}
        <div className="flex items-center space-x-3">
          {/* Market Session Status */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isMarketOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="text-slate-300 font-medium">
              NSE: {isMarketOpen ? "OPEN (09:15 - 15:30 IST)" : "CLOSED"}
            </span>
          </div>

          {/* Mode Pill */}
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-medium">
            <span>PAPER DATA</span>
          </div>

          {/* CSV Upload Button */}
          <button
            onClick={onOpenCsvModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-xs hover:bg-cyan-600/30 transition-all cursor-pointer font-medium"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>
    </header>
  );
};

function ZapIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
