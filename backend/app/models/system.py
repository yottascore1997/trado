from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from app.core.database import Base


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(10), default="INFO", nullable=False)  # INFO, WARNING, ERROR, RISK_BLOCK
    component = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class DataIngestionLog(Base):
    __tablename__ = "data_ingestion_logs"

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    source_type = Column(String(30), nullable=False)  # CSV, WEBSOCKET, REST
    file_name = Column(String(255), nullable=True)
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    duplicate_rows = Column(Integer, default=0)
    start_timestamp = Column(DateTime, nullable=True)
    end_timestamp = Column(DateTime, nullable=True)
    status = Column(String(20), default="SUCCESS")  # SUCCESS, FAILED, PARTIAL
    error_details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    channel = Column(String(20), default="IN_APP")  # TELEGRAM, IN_APP
    signal_id = Column(String(36), ForeignKey("signals.id"), nullable=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(20), default="SENT")  # SENT, FAILED
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
