"""Versioned API schemas and normalized OHLCV contracts."""
from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Symbol = Literal["BTCUSDT", "ETHUSDT", "SOLUSDT"]
Timeframe = Literal["15m", "1h", "4h", "1d"]


class Candle(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    time: int = Field(gt=0, description="Unix timestamp in seconds for candle open")
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    volume: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_ohlcv(self) -> "Candle":
        values = (self.open, self.high, self.low, self.close, self.volume)
        if not all(math.isfinite(value) for value in values):
            raise ValueError("OHLCV values must be finite")
        if self.high < max(self.open, self.close, self.low):
            raise ValueError("high must be at least open, close and low")
        if self.low > min(self.open, self.close, self.high):
            raise ValueError("low must be at most open, close and high")
        return self


class MarketCatalog(BaseModel):
    symbols: list[Symbol]
    timeframes: list[Timeframe]
    market_type: Literal["crypto_spot"] = "crypto_spot"


class CandleResponse(BaseModel):
    symbol: Symbol
    timeframe: Timeframe
    provider: Literal["binance", "kraken"]
    candles: list[Candle]
    fetched_at: int
    stale: bool = False
