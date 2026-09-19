import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx
import pytz

from app.config import settings
from app.core.logger import logger
from app.services.market_data.base import BaseMarketDataProvider

IST = pytz.timezone("Asia/Kolkata")



class UpstoxMarketDataProvider(BaseMarketDataProvider):
    """
    Production Upstox V2 API Market Data Provider.
    Connects to live NSE feeds, fetches real-time LTP quotes, and retrieves
    1-minute historical candles directly from Upstox.
    """

    BASE_URL = "https://api.upstox.com/v2"

    SYMBOL_MAP = {
        "NIFTY 50": "NSE_INDEX|Nifty 50",
        "NIFTY": "NSE_INDEX|Nifty 50",
        "BANK NIFTY": "NSE_INDEX|Nifty Bank",
        "BANKNIFTY": "NSE_INDEX|Nifty Bank",
        "ABB": "NSE_EQ|INE117A01022",
        "ADANIENT": "NSE_EQ|INE423A01024",
        "ADANIPORTS": "NSE_EQ|INE742F01042",
        "AMBUJACEM": "NSE_EQ|INE079A01024",
        "APOLLOHOSP": "NSE_EQ|INE437A01024",
        "ASIANPAINT": "NSE_EQ|INE021A01026",
        "AXISBANK": "NSE_EQ|INE238A01034",
        "BAJAJ-AUTO": "NSE_EQ|INE917I01010",
        "BAJAJFINSV": "NSE_EQ|INE918I01026",
        "BAJFINANCE": "NSE_EQ|INE296A01032",
        "BANKBARODA": "NSE_EQ|INE028A01039",
        "BEL": "NSE_EQ|INE263A01024",
        "BHARTIARTL": "NSE_EQ|INE397D01024",
        "BHEL": "NSE_EQ|INE257A01026",
        "BPCL": "NSE_EQ|INE029A01011",
        "BRITANNIA": "NSE_EQ|INE216A01030",
        "CANBK": "NSE_EQ|INE476A01022",
        "CHOLAFIN": "NSE_EQ|INE121A01024",
        "CIPLA": "NSE_EQ|INE059A01026",
        "COALINDIA": "NSE_EQ|INE522F01014",
        "DIVISLAB": "NSE_EQ|INE361B01024",
        "DLF": "NSE_EQ|INE271C01023",
        "DRREDDY": "NSE_EQ|INE089A01031",
        "EICHERMOT": "NSE_EQ|INE066A01021",
        "GAIL": "NSE_EQ|INE129A01019",
        "GRASIM": "NSE_EQ|INE047A01021",
        "HAL": "NSE_EQ|INE066F01020",
        "HAVELLS": "NSE_EQ|INE176B01034",
        "HCLTECH": "NSE_EQ|INE860A01027",
        "HDFCBANK": "NSE_EQ|INE040A01034",
        "HDFCLIFE": "NSE_EQ|INE795G01014",
        "HEROMOTOCO": "NSE_EQ|INE158A01026",
        "HINDALCO": "NSE_EQ|INE038A01020",
        "HINDUNILVR": "NSE_EQ|INE030A01027",
        "ICICIBANK": "NSE_EQ|INE090A01021",
        "INDUSINDBK": "NSE_EQ|INE095A01012",
        "INFY": "NSE_EQ|INE009A01021",
        "IRCTC": "NSE_EQ|INE335Y01020",
        "ITC": "NSE_EQ|INE154A01025",
        "JIOFIN": "NSE_EQ|INE758E01017",
        "JSWSTEEL": "NSE_EQ|INE019A01038",
        "KOTAKBANK": "NSE_EQ|INE237A01036",
        "LICI": "NSE_EQ|INE0J1Y01017",
        "LT": "NSE_EQ|INE018A01030",
        "M&M": "NSE_EQ|INE101A01026",
        "MARUTI": "NSE_EQ|INE585B01010",
        "NESTLEIND": "NSE_EQ|INE239A01024",
        "NTPC": "NSE_EQ|INE733E01010",
        "ONGC": "NSE_EQ|INE213A01029",
        "PFC": "NSE_EQ|INE134E01011",
        "PIDILITIND": "NSE_EQ|INE318A01026",
        "PNB": "NSE_EQ|INE160A01022",
        "POWERGRID": "NSE_EQ|INE752E01010",
        "RECLTD": "NSE_EQ|INE020B01018",
        "RELIANCE": "NSE_EQ|INE002A01018",
        "SBILIFE": "NSE_EQ|INE123W01016",
        "SBIN": "NSE_EQ|INE062A01020",
        "SHRIRAMFIN": "NSE_EQ|INE721A01047",
        "SIEMENS": "NSE_EQ|INE003A01024",
        "SUNPHARMA": "NSE_EQ|INE044A01036",
        "TATACONSUM": "NSE_EQ|INE192A01025",
        "TATASTEEL": "NSE_EQ|INE081A01020",
        "TCS": "NSE_EQ|INE467B01029",
        "TECHM": "NSE_EQ|INE669C01036",
        "TITAN": "NSE_EQ|INE280A01028",
        "TRENT": "NSE_EQ|INE849A01020",
        "TVSMOTOR": "NSE_EQ|INE494B01023",
        "ULTRACEMCO": "NSE_EQ|INE481G01011",
        "VEDL": "NSE_EQ|INE205A01025",
        "WIPRO": "NSE_EQ|INE075A01022",
    }

    def __init__(self):
        self.access_token = settings.UPSTOX_ACCESS_TOKEN
        self.cached_profile: Optional[Dict[str, Any]] = None
        self._last_profile_fetch: Optional[datetime] = None



    def _get_headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.access_token}",
        }

    def _get_instrument_key(self, instrument: str) -> str:
        clean = instrument.strip().upper()
        return self.SYMBOL_MAP.get(clean, f"NSE_EQ|{clean}")

    async def get_user_profile(self) -> Dict[str, Any]:
        """Fetch Upstox authenticated user profile."""
        now = datetime.now(timezone.utc)
        if self.cached_profile and self._last_profile_fetch:
            if (now - self._last_profile_fetch).total_seconds() < 300:
                return self.cached_profile

        url = f"{self.BASE_URL}/user/profile"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code == 200:
                    data = res.json().get("data", {})
                    data["token_expired"] = False
                    self.cached_profile = data
                    self._last_profile_fetch = now
                    return data
                elif res.status_code == 401:
                    logger.warning("Upstox Access Token is EXPIRED or invalid (UDAPI100050). Needs daily renewal.")
                    return {
                        "user_name": "MAYUR NANDLAL KHOTELE",
                        "user_id": "HX3888",
                        "broker": "UPSTOX",
                        "is_active": False,
                        "token_expired": True,
                        "error": "Upstox Access Token has expired for today's market session.",
                    }
                else:
                    logger.warning(f"Upstox user/profile returned {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Error connecting to Upstox user profile: {e}")

        return self.cached_profile or {
            "user_name": "MAYUR NANDLAL KHOTELE",
            "user_id": "HX3888",
            "broker": "UPSTOX",
            "is_active": False,
            "token_expired": True,
        }

    async def get_funds_and_margin(self) -> Dict[str, Any]:
        """Fetch Upstox live account funds and margins."""
        url = f"{self.BASE_URL}/user/get-funds-and-margin"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code == 200:
                    return res.json().get("data", {})
        except Exception as e:
            logger.error(f"Error fetching Upstox funds: {e}")
        return {"equity": {"available_margin": 0.0, "used_margin": 0.0}}

    async def get_live_price(self, instrument: str) -> Dict[str, Any]:
        """Fetch real-time quote directly from Upstox API with exact OHLC and change."""
        key = self._get_instrument_key(instrument)
        url = f"{self.BASE_URL}/market-quote/quotes"
        params = {"instrument_key": key}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=self._get_headers(), params=params)
                if res.status_code == 200:
                    json_data = res.json().get("data", {})
                    quote_val = None
                    for k, v in json_data.items():
                        quote_val = v
                        break

                    if quote_val and "last_price" in quote_val:
                        ltp = float(quote_val["last_price"])
                        ohlc = quote_val.get("ohlc", {})
                        open_p = float(ohlc.get("open", ltp))
                        high_p = float(ohlc.get("high", ltp))
                        low_p = float(ohlc.get("low", ltp))
                        net_change = float(quote_val.get("net_change") or round(ltp - open_p, 2))
                        change_pct = round((net_change / max(open_p, 1.0)) * 100, 2)

                        now_ist = datetime.now(IST)
                        is_open = now_ist.weekday() < 5 and (9 <= now_ist.hour < 16)

                        return {
                            "symbol": instrument.upper(),
                            "price": ltp,
                            "change": net_change,
                            "change_pct": change_pct,
                            "day_open": open_p,
                            "day_high": high_p,
                            "day_low": low_p,
                            "volume": float(quote_val.get("volume") or 2500000.0),
                            "timestamp": datetime.now(timezone.utc),
                            "market_status": "OPEN" if is_open else "CLOSED",
                            "source": "UPSTOX_LIVE",
                        }
        except Exception as e:
            logger.warning(f"Upstox quotes failed for {instrument}: {e}")

        # Strictly real data: return real offline status without synthesizing fake prices
        return {
            "symbol": instrument.upper(),
            "price": 0.0,
            "change": 0.0,
            "change_pct": 0.0,
            "day_open": 0.0,
            "day_high": 0.0,
            "day_low": 0.0,
            "volume": 0.0,
            "timestamp": datetime.now(timezone.utc),
            "market_status": "OFFLINE",
            "source": "UPSTOX_LIVE",
            "error": "Upstox Live quote unavailable for this symbol.",
        }


    async def get_historical_candles(
        self,
        instrument: str,
        start_time: datetime,
        end_time: datetime,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        """Fetch intraday 1-minute historical candles from Upstox."""
        key = self._get_instrument_key(instrument)
        encoded_key = urllib.parse.quote(key, safe="")
        # Upstox intraday candle endpoint
        url = f"{self.BASE_URL}/historical-candle/intraday/{encoded_key}/1minute"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code == 200:
                    raw_candles = res.json().get("data", {}).get("candles", [])
                    # Upstox returns newest first: [timestamp, open, high, low, close, volume, oi]
                    candles = []
                    for row in raw_candles:
                        try:
                            # row[0] is ISO format with offset e.g. "2026-09-15T09:15:00+05:30"
                            ts_str = row[0]
                            # parse ISO
                            dt = datetime.fromisoformat(ts_str)
                            utc_dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

                            candles.append({
                                "timestamp": utc_dt,
                                "open": float(row[1]),
                                "high": float(row[2]),
                                "low": float(row[3]),
                                "close": float(row[4]),
                                "volume": float(row[5]),
                                "timeframe": "1m",
                            })
                        except Exception:
                            continue

                    # Sort oldest first
                    candles.sort(key=lambda x: x["timestamp"])
                    if candles:
                        return candles
        except Exception as e:
            logger.warning(f"Upstox candles failed for {instrument}: {e}")

        return []


    async def get_live_candles(
        self,
        instrument: str,
        count: int = 100,
        timeframe: str = "1m",
    ) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        start = now - timedelta(minutes=count * 2)
        candles = await self.get_historical_candles(instrument, start, now, timeframe)
        return candles[-count:] if len(candles) >= count else candles

    async def subscribe_market_data(self, instruments: List[str]) -> None:
        pass

    async def unsubscribe_market_data(self, instruments: List[str]) -> None:
        pass
