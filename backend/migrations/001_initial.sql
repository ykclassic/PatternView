-- PatternView scan provenance and interpreted pattern persistence.
-- Apply with the configured PostgreSQL DATABASE_URL before enabling DATABASE_REQUIRED=true.

CREATE TABLE IF NOT EXISTS scan_requests (
    id VARCHAR(32) PRIMARY KEY,
    symbol VARCHAR(16) NOT NULL,
    timeframe VARCHAR(8) NOT NULL,
    provider VARCHAR(16) NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL,
    candle_count INTEGER NOT NULL CHECK (candle_count >= 0),
    first_candle_time BIGINT NOT NULL,
    last_candle_time BIGINT NOT NULL,
    rule_version VARCHAR(64) NOT NULL,
    result_count INTEGER NOT NULL CHECK (result_count >= 0),
    persisted BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_scan_requests_symbol_time
    ON scan_requests (symbol, timeframe, scanned_at DESC);

CREATE TABLE IF NOT EXISTS pattern_detections (
    id VARCHAR(32) PRIMARY KEY,
    scan_id VARCHAR(32) NOT NULL REFERENCES scan_requests(id) ON DELETE CASCADE,
    kind VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    quality_score INTEGER NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
    first_pivot_time BIGINT NOT NULL,
    last_pivot_time BIGINT NOT NULL,
    detection_time BIGINT NOT NULL,
    neckline DOUBLE PRECISION NOT NULL,
    breakout_level DOUBLE PRECISION NOT NULL,
    invalidation DOUBLE PRECISION NOT NULL,
    entry DOUBLE PRECISION NULL,
    stop_loss DOUBLE PRECISION NULL,
    take_profit DOUBLE PRECISION NULL,
    explanation JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pattern_detections_scan_id
    ON pattern_detections (scan_id);
CREATE INDEX IF NOT EXISTS idx_pattern_detections_kind_status
    ON pattern_detections (kind, status);
