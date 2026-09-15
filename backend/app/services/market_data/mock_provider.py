import math
import random
from datetime import datetime, timedelta, time, timezone
from typing import List, Dict, Any, Optional
import pytz

from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.validator import IST, SESSION_START, SESSION_END


class MockMarketDataProvider(BaseMarketDataProvider):
    """
    High-fidelity Mock Market Data Provider for NSE Indices (NIFTY 50 and BANK NIFTY).
    Generates realistic intraday candles with:
    - Geometric Brownian motion + intraday mean-reversion
    - Realistic tick size (0.05)
    - Realistic U-shaped intraday volume profile
    - 09:15 to 15:30 IST trading session
    """

    BASE_PRICES = {
        "NIFTY 50": 25150.0,
        "NIFTY": 25150.0,
        "BANK NIFTY": 51800.0,
        "BANKNIFTY": 51800.0,
        "RELIANCE": 2985.50,
        "SBIN": 815.20,
        "ICICIBANK": 1242.80,
        "HDFCBANK": 1652.40,
        "INFY": 1888.60,
        "TATASTEEL": 152.40,
        "TCS": 4255.00,
        "BHARTIARTL": 1564.00,
        "LT": 3680.50,
        "AXISBANK": 1184.00,
    }

    VOLATILITY = {
        "NIFTY 50": 0.0006,  # ~15 points 1m ATR
        "NIFTY": 0.0006,
        "BANK NIFTY": 0.0009,  # ~45 points 1m ATR
        "BANKNIFTY": 0.0009,
        "RELIANCE": 0.0008,
        "SBIN": 0.0009,
        "ICICIBANK": 0.0008,
        "HDFCBANK": 0.0007,
        "INFY": 0.0008,
        "TATASTEEL": 0.0011,
        "TCS": 0.0007,
        "BHARTIARTL": 0.0008,
        "LT": 0.0008,
        "AXISBANK": 0.0009,
    }

    def __init__(self):
        self.subscribed_instruments = set()
        self.current_prices = dict(self.BASE_PRICES)
        self.last_update_time = datetime.now(timezone.utc)

    def _round_tick(self, price: float, tick_size: float = 0.05) -> float:
        return round(round(price / tick_size) * tick_size, 2)

    def _intraday_volume_multiplier(self, candle_time: time) -> float:
        """
        Simulates the classic Indian market U-shaped volume curve:
        High between 09:15-10:15, low midday 11:30-13:30, high again 14:15-15:30.
        """
        hour = candle_time.hour + candle_time.minute / 60.0
        # Peak at 9.25 (~2.5x), trough at 12.5 (~0.6x), surge at 15.0 (~2.2x)
        if hour < 10.5:
            return 2.2 - (hour - 9.25) * 0.8
        elif hour < 13.5:
            return 0.7 + random.uniform(-0.1, 0.1)
        else:
            return 0.8 + (hour - 13.5) * 0.7

    def generate_candle(
        self,
        symbol: str,
        start_price: float,
        dt_ist: datetime,
    ) -> Dict[str, Any]:
        """Generates a statistically realistic 1-minute candle."""
        vol = self.VOLATILITY.get(symbol, 0.0007)
        # Random walk for open, high, low, close
        pct_change = random.gauss(0, vol)
        close_p = self._round_tick(start_price * (1 + pct_change))
        
        wick_high = abs(random.gauss(0, vol * 0.8))
        wick_low = abs(random.gauss(0, vol * 0.8))

        high_p = self._round_tick(max(start_price, close_p) * (1 + wick_high))
        low_p = self._round_tick(min(start_price, close_p) * (1 - wick_low))

        # Enforce high >= max(open, close) and low <= min(open, close)
        high_p = max(high_p, start_price, close_p)
        low_p = min(low_p, start_price, close_p)

        vol_mult = self._intraday_volume_multiplier(dt_ist.time())
        base_vol = 50000.0 if "BANK" in symbol else 120000.0
        volume = round(base_vol * vol_mult * random.uniform(0.8, 1.3))

        utc_dt = dt_ist.astimezone(pytz.utc).replace(tzinfo=None)

        return {
            "timestamp": utc_dt,
            "open": start_price,
            "high": high_p,
            "low": low_p,
            "close": close_p,
            "volume": volume,
            "timeframe": "1m",
        }

    async def get_historical_candles(
        self,
        instrument: str,
        start_time: datetime,
        end_time: datetime,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        """
        Generates continuous synthetic historical data between start_time and end_time,
        respecting regular trading session hours (09:15-15:30 IST) and weekdays.
        """
        symbol = instrument.upper()
        current_p = self.BASE_PRICES.get(symbol, 25000.0)

        candles = []
        curr_dt = start_time.astimezone(IST) if start_time.tzinfo else IST.localize(start_time)
        end_dt = end_time.astimezone(IST) if end_time.tzinfo else IST.localize(end_time)

        while curr_dt <= end_dt:
            # Skip weekends
            if curr_dt.weekday() < 5:
                # Check session hours
                t = curr_dt.time()
                if SESSION_START <= t <= SESSION_END:
                    candle = self.generate_candle(symbol, current_p, curr_dt)
                    candles.append(candle)
                    current_p = candle["close"]

            curr_dt += timedelta(minutes=1)

        return candles

    async def get_live_price(self, instrument: str) -> Dict[str, Any]:
        """Returns realistic real-time price tick."""
        symbol = instrument.upper()
        curr_p = self.current_prices.get(symbol, self.BASE_PRICES.get(symbol, 25000.0))
        vol = self.VOLATILITY.get(symbol, 0.0006)
        tick_change = random.gauss(0, vol * 0.3)
        new_p = self._round_tick(curr_p * (1 + tick_change))
        self.current_prices[symbol] = new_p

        base_p = self.BASE_PRICES.get(symbol, new_p)
        change = round(new_p - base_p, 2)
        change_pct = round((change / base_p) * 100, 2)

        now_ist = datetime.now(IST)
        is_open = now_ist.weekday() < 5 and (SESSION_START <= now_ist.time() <= SESSION_END)

        return {
            "symbol": symbol,
            "price": new_p,
            "change": change,
            "change_pct": change_pct,
            "day_open": base_p,
            "day_high": self._round_tick(base_p * 1.008),
            "day_low": self._round_tick(base_p * 0.992),
            "volume": 1540000.0,
            "timestamp": datetime.now(timezone.utc),
            "market_status": "OPEN" if is_open else "CLOSED",
        }

    async def get_live_candles(
        self,
        instrument: str,
        count: int = 100,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        """Returns recent closed candles."""
        now = datetime.now(IST)
        start = now - timedelta(minutes=count * 2)
        history = await self.get_historical_candles(instrument, start, now, timeframe)
        return history[-count:] if len(history) >= count else history

    async def subscribe_market_data(self, instruments: List[str]) -> None:
        for inst in instruments:
            self.subscribed_instruments.add(inst.upper())

    async def unsubscribe_market_data(self, instruments: List[str]) -> None:
        for inst in instruments:
            self.subscribed_instruments.discard(inst.upper())
