import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    signal_id = Column(String(36), ForeignKey("signals.id"), nullable=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)

    side = Column(String(10), nullable=False)  # BUY, SELL
    quantity = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=False)
    entry_time = Column(DateTime, nullable=False)
    stop_loss = Column(Float, nullable=False)
    target_price = Column(Float, nullable=False)

    exit_price = Column(Float, nullable=True)
    exit_time = Column(DateTime, nullable=True)
    exit_reason = Column(String(50), nullable=True)  # TARGET_HIT, STOP_LOSS_HIT, TIMEOUT, MANUAL_CLOSE

    gross_pnl = Column(Float, default=0.0)
    brokerage_and_charges = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    mfe = Column(Float, nullable=True)  # Maximum Favorable Excursion
    mae = Column(Float, nullable=True)  # Maximum Adverse Excursion

    status = Column(String(20), default="OPEN", index=True)  # OPEN, CLOSED, CANCELLED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="paper_trades")
    signal = relationship("Signal", back_populates="paper_trades")
