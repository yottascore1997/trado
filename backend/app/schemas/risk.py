from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class RiskSettingsBase(BaseModel):
    total_capital: float = Field(100000.0, ge=1000.0)
    risk_per_trade_pct: float = Field(0.5, ge=0.05, le=5.0)
    max_daily_loss_pct: float = Field(1.0, ge=0.1, le=10.0)
    max_trades_per_day: int = Field(5, ge=1, le=50)
    max_consecutive_losses: int = Field(2, ge=1, le=10)
    max_open_trades: int = Field(1, ge=1, le=5)
    min_risk_reward: float = Field(2.0, ge=1.0, le=10.0)
    trading_start_time: str = "09:20:00"
    trading_end_time: str = "15:10:00"
    is_paper_mode: bool = True


class RiskSettingsUpdate(BaseModel):
    total_capital: Optional[float] = None
    risk_per_trade_pct: Optional[float] = None
    max_daily_loss_pct: Optional[float] = None
    max_trades_per_day: Optional[int] = None
    max_consecutive_losses: Optional[int] = None
    max_open_trades: Optional[int] = None
    min_risk_reward: Optional[float] = None
    trading_start_time: Optional[str] = None
    trading_end_time: Optional[str] = None
    is_paper_mode: Optional[bool] = None


class RiskSettingsOut(RiskSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
