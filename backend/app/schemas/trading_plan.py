from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TradingPlanBase(BaseModel):
    wallet_budget: float = Field(default=10000.0, ge=1000.0, description="Isolated Virtual Wallet Budget in INR")
    trading_mode: str = Field(
        default="INTRADAY_STOCKS",
        description="Active Mode: INTRADAY_STOCKS | BANKNIFTY_OPTIONS | NIFTY_OPTIONS | SWING_TRADING"
    )
    risk_per_trade_pct: float = Field(default=1.5, ge=0.1, le=5.0, description="Risk per trade as % of wallet")
    max_daily_loss_pct: float = Field(default=3.0, ge=0.5, le=10.0, description="Daily stop-loss limit as % of wallet")
    max_active_trades: int = Field(default=2, ge=1, le=10, description="Max simultaneous active trades")
    auto_square_off_time: str = Field(default="15:15:00", description="Intraday auto-exit time")
    is_paper_mode: bool = Field(default=True, description="Whether executing in zero-risk paper mode")
    kill_switch_active: bool = Field(default=False, description="Emergency lock state")


class TradingPlanUpdate(BaseModel):
    wallet_budget: Optional[float] = Field(None, ge=1000.0)
    trading_mode: Optional[str] = None
    risk_per_trade_pct: Optional[float] = Field(None, ge=0.1, le=5.0)
    max_daily_loss_pct: Optional[float] = Field(None, ge=0.5, le=10.0)
    max_active_trades: Optional[int] = Field(None, ge=1, le=10)
    auto_square_off_time: Optional[str] = None
    is_paper_mode: Optional[bool] = None
    kill_switch_active: Optional[bool] = None


class WalletMetrics(BaseModel):
    wallet_budget: float
    effective_buying_power: float
    leverage_multiplier: float
    risk_per_trade_in_rs: float
    daily_loss_limit_in_rs: float
    max_active_trades: int
    allocation_per_stock_max: float
    mode_description: str
    product_type: str  # MIS or CNC
    square_off_mandatory: bool
    kill_switch_active: bool


class TradingPlanOut(TradingPlanBase):
    metrics: WalletMetrics


class ExecuteOrderIn(BaseModel):
    symbol: str
    side: str = Field(..., pattern="^(BUY|SELL)$")
    quantity: int = Field(..., gt=0)
    entry_price: float = Field(..., gt=0)
    stop_loss: float = Field(..., gt=0)
    target_price: float = Field(..., gt=0)
    product_type: Optional[str] = "MIS"  # MIS or CNC
    setup_name: Optional[str] = "VWAP Breakout"


class ExecuteOrderOut(BaseModel):
    success: bool
    order_id: str
    symbol: str
    side: str
    quantity: int
    entry_price: float
    stop_loss: float
    target_price: float
    product_type: str
    margin_required: float
    max_risk_in_rs: float
    expected_profit_in_rs: float
    wallet_budget_before: float
    wallet_margin_used: float
    wallet_buffer_remaining: float
    message: str
    broker_payload_preview: Dict[str, Any]
