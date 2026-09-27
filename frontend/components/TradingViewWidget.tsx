"use client";

import React, { useEffect, useRef } from "react";

interface TradingViewWidgetProps {
  symbol: string;
  interval?: string;
  theme?: "dark" | "light";
}

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({
  symbol,
  interval = "15",
  theme = "dark",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean symbol (e.g. WHIRLPOOL, RELIANCE, NIFTY 50)
    let cleanSym = symbol.replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
    if (cleanSym === "NIFTY50" || cleanSym === "NIFTY") {
      cleanSym = "NIFTY";
    } else if (cleanSym === "BANKNIFTY") {
      cleanSym = "BANKNIFTY";
    }
    const formattedSym = `NSE:${cleanSym}`;
    const widgetId = `tv_chart_${cleanSym}_${Math.random().toString(36).substring(2, 8)}`;
    containerRef.current.innerHTML = `<div id="${widgetId}" style="height: 100%; width: 100%;"></div>`;

    const initWidget = () => {
      if (typeof (window as any).TradingView !== "undefined" && document.getElementById(widgetId)) {
        try {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: formattedSym,
            interval: interval,
            timezone: "Asia/Kolkata",
            theme: theme,
            style: "1", // 1 = Candlestick
            locale: "en",
            toolbar_bg: "#080b13",
            enable_publishing: false,
            allow_symbol_change: true,
            hide_side_toolbar: false,
            studies: [
              "STD;Supertrend",
              "STD;VWAP",
              "STD;MACD"
            ],
            container_id: widgetId,
          });
        } catch (e) {
          console.warn("TradingView initialization error:", e);
        }
      }
    };

    if (typeof (window as any).TradingView !== "undefined") {
      initWidget();
    } else {
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript) {
        existingScript.addEventListener("load", initWidget);
      } else {
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = initWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval, theme]);

  return (
    <div className="w-full h-full min-h-[460px] bg-[#06080e] rounded-xl overflow-hidden relative border border-slate-800 shadow-inner">
      <div ref={containerRef} className="w-full h-full min-h-[460px]" />
    </div>
  );
};
