export type SymbolPair = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
export type Timeframe = "15m" | "1h" | "4h" | "1d";
export type PatternKind =
  | "DOUBLE_TOP"
  | "DOUBLE_BOTTOM"
  | "TRIPLE_TOP"
  | "TRIPLE_BOTTOM"
  | "HEAD_AND_SHOULDERS"
  | "INVERSE_HEAD_AND_SHOULDERS"
  | "ASCENDING_TRIANGLE"
  | "DESCENDING_TRIANGLE"
  | "SYMMETRICAL_TRIANGLE"
  | "BULL_FLAG"
  | "BEAR_FLAG"
  | "RISING_WEDGE"
  | "FALLING_WEDGE"
  | "DOJI"
  | "HAMMER"
  | "SHOOTING_STAR"
  | "BULLISH_ENGULFING"
  | "BEARISH_ENGULFING"
  | "MORNING_STAR"
  | "EVENING_STAR"
  | "THREE_WHITE_SOLDIERS"
  | "THREE_BLACK_CROWS";
export type PatternStatus =
  | "FORMING"
  | "CONFIRMED"
  | "WAITING FOR BREAKOUT"
  | "QUALIFIED"
  | "INVALIDATED"
  | "NO TRADE";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DetectedPattern {
  kind: PatternKind;
  status: PatternStatus;
  firstPivotTime: number;
  secondPivotTime: number;
  thirdPivotTime?: number;
  neckline: number;
  invalidation: number;
  breakoutLevel: number;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  explanation: string[];
  qualityScore?: number;
  ruleVersion?: string;
  detectionTime?: number;
}

export interface ScanHistoryRecord {
  id: string;
  symbol: SymbolPair;
  timeframe: Timeframe;
  scannedAt: string;
  provider: string;
  candleCount: number;
  firstCandleTime: number;
  lastCandleTime: number;
  ruleVersion: string;
  result: DetectedPattern | null;
  candleSnapshot: Candle[];
  error?: string;
}
