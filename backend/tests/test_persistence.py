from app.market_data import MarketSnapshot
from app.persistence import Base, PatternDetection, ScanRequest, persist_scan
from app.schemas import Candle
from sqlalchemy import create_engine, inspect


def test_persistence_models_define_scan_and_detection_provenance() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    tables = set(inspect(engine).get_table_names())

    assert {"scan_requests", "pattern_detections"} <= tables
    assert ScanRequest.__tablename__ == "scan_requests"
    assert PatternDetection.__tablename__ == "pattern_detections"


def test_scan_snapshot_contains_closed_candle_provenance() -> None:
    snapshot = MarketSnapshot(
        symbol="BTCUSDT",
        timeframe="1h",
        provider="binance",
        candles=[Candle(time=1, open=10, high=12, low=9, close=11, volume=2)],
        fetched_at=2,
    )

    assert snapshot.provider == "binance"
    assert snapshot.candles[0].time == 1
