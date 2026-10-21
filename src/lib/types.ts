export type SymbolPair = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
export type Timeframe = "15m" | "1h" | "4h" | "1d";
export type PatternKind = "DOUBLE_TOP" | "DOUBLE_BOTTOM";
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
  neckline: number;
  invalidation: number;
  breakoutLevel: number;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  explanation: string[];
}
