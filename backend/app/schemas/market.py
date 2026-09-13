from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class InstrumentBase(BaseModel):
    symbol: str
    name: str
    exchange: str = "NSE"
    lot_size: int = 1
    tick_size: float = 0.05
    instrument_type: str = "INDEX"


class InstrumentCreate(InstrumentBase):
    pass


class InstrumentOut(InstrumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime


class CandleBase(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    timeframe: str = "1m"


class CandleCreate(CandleBase):
    instrument_id: int


class CandleOut(CandleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_id: int
    is_complete: bool
    created_at: datetime


class QuoteOut(BaseModel):
    symbol: str
    price: float
    change: float
    change_pct: float
    day_high: float
    day_low: float
    day_open: float
    volume: float
    timestamp: datetime
    market_status: str  # OPEN, CLOSED


class CSVIngestionSummary(BaseModel):
    file_name: str
    symbol: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    start_timestamp: Optional[datetime] = None
    end_timestamp: Optional[datetime] = None
    status: str
    errors: List[str] = []
