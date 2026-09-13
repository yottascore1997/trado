import React from "react";
import { ShieldAlert } from "lucide-react";

export const DisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-amber-950/20 border-b border-amber-800/40 px-4 py-1.5 text-xs text-amber-300/90 flex items-center justify-center space-x-2">
      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
      <span>
        <strong>IMPORTANT RISK NOTICE:</strong> AI signals are probabilistic analysis, not guaranteed returns. Past backtest performance does not guarantee future results. Use paper trading before risking real capital.
      </span>
    </div>
  );
};
