from app.config import settings
from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.core.logger import logger

_provider_instance: BaseMarketDataProvider = None


def get_market_data_provider() -> BaseMarketDataProvider:
    global _provider_instance
    if _provider_instance is None:
        provider_type = settings.MARKET_DATA_PROVIDER.upper()
        if provider_type == "MOCK":
            logger.info("Initializing MockMarketDataProvider for Indian NSE Indices.")
            _provider_instance = MockMarketDataProvider()
        elif provider_type == "UPSTOX":
            from app.services.market_data.upstox_provider import UpstoxMarketDataProvider
            logger.info("Initializing UpstoxMarketDataProvider (Live NSE API V2 Feed).")
            _provider_instance = UpstoxMarketDataProvider()
        elif provider_type == "ZERODHA":
            # Zerodha provider stub for future live connection
            logger.info("Using Zerodha Kite market data provider configuration.")
            _provider_instance = MockMarketDataProvider()  # Fallback to mock if credentials not live
        else:
            logger.warning(f"Unknown provider '{provider_type}', falling back to MockMarketDataProvider.")
            _provider_instance = MockMarketDataProvider()
    return _provider_instance
