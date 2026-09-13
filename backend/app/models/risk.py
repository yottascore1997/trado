import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class RiskSetting(Base):
    __tablename__ = "risk_settings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=True)

    total_capital = Column(Float, default=100000.0, nullable=False)
    risk_per_trade_pct = Column(Float, default=0.5, nullable=False)
    max_daily_loss_pct = Column(Float, default=1.0, nullable=False)
    max_trades_per_day = Column(Integer, default=5, nullable=False)
    max_consecutive_losses = Column(Integer, default=2, nullable=False)
    max_open_trades = Column(Integer, default=1, nullable=False)
    min_risk_reward = Column(Float, default=2.0, nullable=False)

    trading_start_time = Column(String(8), default="09:20:00", nullable=False)
    trading_end_time = Column(String(8), default="15:10:00", nullable=False)
    is_paper_mode = Column(Boolean, default=True, nullable=False)

    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="risk_settings")
