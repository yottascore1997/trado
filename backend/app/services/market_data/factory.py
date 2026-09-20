from app.config import settings
from app.services.market_data.base import BaseMarketDataProvider
from app.services.market_data.mock_provider import MockMarketDataProvider
from app.core.logger import logger
from typing import Optional

_provider_instance: Optional[BaseMarketDataProvider] = None


def get_market_data_provider() -> BaseMarketDataProvider:
    global _provider_instance
    if _provider_instance is None:
        provider_type = (settings.MARKET_DATA_PROVIDER or "UPSTOX").upper()
        if provider_type == "UPSTOX":
            from app.services.market_data.upstox_provider import UpstoxMarketDataProvider
            logger.info("Initializing UpstoxMarketDataProvider (Live NSE API V2 Feed).")
            _provider_instance = UpstoxMarketDataProvider()
        elif provider_type == "ZERODHA":
            logger.info("Using Zerodha Kite market data provider configuration.")
            _provider_instance = MockMarketDataProvider()
        else:
            logger.info("Initializing MockMarketDataProvider for Indian NSE Indices.")
            _provider_instance = MockMarketDataProvider()
    return _provider_instance


def set_market_data_provider(provider_type: str = "UPSTOX", access_token: Optional[str] = None) -> BaseMarketDataProvider:
    global _provider_instance
    provider_type = provider_type.upper()
    settings.MARKET_DATA_PROVIDER = provider_type

    if provider_type == "UPSTOX":
        from app.services.market_data.upstox_provider import UpstoxMarketDataProvider
        token = access_token or settings.UPSTOX_ACCESS_TOKEN
        _provider_instance = UpstoxMarketDataProvider()
        if token:
            _provider_instance.access_token = token
            settings.UPSTOX_ACCESS_TOKEN = token
        logger.info("Switched to UpstoxMarketDataProvider with new token.")
    else:
        _provider_instance = MockMarketDataProvider()
        logger.info("Switched to MockMarketDataProvider.")

    return _provider_instance
