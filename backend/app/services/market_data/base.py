from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Any, Optional


class BaseMarketDataProvider(ABC):
    """
    Abstract interface for Indian Market Data Providers (NSE: NIFTY 50, BANK NIFTY).
    Ensures that broker implementations (Upstox, Zerodha) or Mock data sources
    are fully decoupled from the core analytics and signal engine.
    """

    @abstractmethod
    async def get_historical_candles(
        self,
        instrument: str,
        start_time: datetime,
        end_time: datetime,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        """Fetch historical candles in standardized format."""
        pass

    @abstractmethod
    async def get_live_price(self, instrument: str) -> Dict[str, Any]:
        """Fetch latest quote / tick for the instrument."""
        pass

    @abstractmethod
    async def get_live_candles(
        self,
        instrument: str,
        count: int = 100,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        """Fetch the most recent closed candles."""
        pass

    @abstractmethod
    async def subscribe_market_data(self, instruments: List[str]) -> None:
        """Subscribe to real-time tick/candle streaming."""
        pass

    @abstractmethod
    async def unsubscribe_market_data(self, instruments: List[str]) -> None:
        """Unsubscribe from streaming."""
        pass
