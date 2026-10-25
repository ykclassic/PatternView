"""Optional PostgreSQL persistence for scan requests and pattern detections."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.engine import PatternResult, RULE_VERSION
from app.market_data import MarketSnapshot


class Base(DeclarativeBase):
    pass


class ScanRequest(Base):
    __tablename__ = "scan_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    candle_count: Mapped[int] = mapped_column(Integer, nullable=False)
    first_candle_time: Mapped[int] = mapped_column(Integer, nullable=False)
    last_candle_time: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_version: Mapped[str] = mapped_column(String(64), nullable=False)
    result_count: Mapped[int] = mapped_column(Integer, nullable=False)
    persisted: Mapped[bool] = mapped_column(default=True, nullable=False)


class PatternDetection(Base):
    __tablename__ = "pattern_detections"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scan_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    first_pivot_time: Mapped[int] = mapped_column(Integer, nullable=False)
    last_pivot_time: Mapped[int] = mapped_column(Integer, nullable=False)
    detection_time: Mapped[int] = mapped_column(Integer, nullable=False)
    neckline: Mapped[float] = mapped_column(Float, nullable=False)
    breakout_level: Mapped[float] = mapped_column(Float, nullable=False)
    invalidation: Mapped[float] = mapped_column(Float, nullable=False)
    entry: Mapped[float | None] = mapped_column(Float, nullable=True)
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    take_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[list[str]] = mapped_column(JSON, nullable=False)


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine | None:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return None
    return create_engine(normalize_database_url(url), pool_pre_ping=True, pool_size=3, max_overflow=2)


def database_is_configured() -> bool:
    return bool(os.getenv("DATABASE_URL", "").strip())


def check_database() -> bool:
    engine = get_engine()
    if engine is None:
        return not os.getenv("DATABASE_REQUIRED", "false").lower() == "true"
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True


def persist_scan(snapshot: MarketSnapshot, patterns: list[PatternResult]) -> tuple[str, bool]:
    engine = get_engine()
    scan_id = uuid4().hex
    if engine is None:
        return scan_id, False
    scanned_at = datetime.now(timezone.utc)
    factory = sessionmaker(bind=engine)
    with factory.begin() as session:
        session.add(ScanRequest(
            id=scan_id,
            symbol=snapshot.symbol,
            timeframe=snapshot.timeframe,
            provider=snapshot.provider,
            scanned_at=scanned_at,
            candle_count=len(snapshot.candles),
            first_candle_time=snapshot.candles[0].time,
            last_candle_time=snapshot.candles[-1].time,
            rule_version=RULE_VERSION,
            result_count=len(patterns),
            persisted=True,
        ))
        for pattern in patterns:
            session.add(PatternDetection(
                id=uuid4().hex,
                scan_id=scan_id,
                kind=pattern.kind,
                status=pattern.status,
                quality_score=pattern.quality_score,
                first_pivot_time=pattern.first_pivot_time,
                last_pivot_time=pattern.last_pivot_time,
                detection_time=pattern.detection_time,
                neckline=pattern.neckline,
                breakout_level=pattern.breakout_level,
                invalidation=pattern.invalidation,
                entry=pattern.entry,
                stop_loss=pattern.stop_loss,
                take_profit=pattern.take_profit,
                explanation=pattern.explanation,
            ))
    return scan_id, True


def database_status_for_response() -> dict[str, Any]:
    return {"configured": database_is_configured(), "writes_enabled": database_is_configured()}
