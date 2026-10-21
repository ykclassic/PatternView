"use client";

import { useCallback, useEffect, useState } from "react";
import CandleChart from "@/components/candle-chart";
import { fetchMarketSnapshot } from "@/lib/market-data";
import { appendScanHistory, makeScanId, readScanHistory } from "@/lib/scan-history";
import { detectLatestPattern } from "@/lib/patterns";
import type { Candle, DetectedPattern, PatternKind, ScanHistoryRecord, SymbolPair, Timeframe } from "@/lib/types";

const PAIRS: { value: SymbolPair; label: string }[] = [
  { value: "BTCUSDT", label: "BTC / USDT" },
  { value: "ETHUSDT", label: "ETH / USDT" },
  { value: "SOLUSDT", label: "SOL / USDT" },
];
const FRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];
const PATTERN_NAMES: Record<PatternKind, string> = {
  DOUBLE_TOP: "Double top",
  DOUBLE_BOTTOM: "Double bottom",
  TRIPLE_TOP: "Triple top",
  TRIPLE_BOTTOM: "Triple bottom",
  HEAD_AND_SHOULDERS: "Head and shoulders",
  INVERSE_HEAD_AND_SHOULDERS: "Inverse head and shoulders",
  DOJI: "Doji",
  HAMMER: "Hammer",
  SHOOTING_STAR: "Shooting star",
  BULLISH_ENGULFING: "Bullish engulfing",
  BEARISH_ENGULFING: "Bearish engulfing",
  MORNING_STAR: "Morning star",
  EVENING_STAR: "Evening star",
  THREE_WHITE_SOLDIERS: "Three white soldiers",
  THREE_BLACK_CROWS: "Three black crows",
};
const BEARISH_PATTERNS: PatternKind[] = ["DOUBLE_TOP", "TRIPLE_TOP", "HEAD_AND_SHOULDERS", "SHOOTING_STAR", "BEARISH_ENGULFING", "EVENING_STAR", "THREE_BLACK_CROWS"];

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value > 100 ? 2 : 5 }).format(value);
}

export default function Home() {
  const [symbol, setSymbol] = useState<SymbolPair>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [pattern, setPattern] = useState<DetectedPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryRecord[]>([]);

  useEffect(() => { setHistory(readScanHistory()); }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchMarketSnapshot(symbol, timeframe, signal);
      const result = snapshot.candles;
      if (result.length < 40) throw new Error("Not enough closed candles for a meaningful pattern scan.");
      const detected = detectLatestPattern(result);
      const scannedAt = new Date().toISOString();
      const record: ScanHistoryRecord = {
        id: makeScanId(symbol, timeframe, scannedAt),
        symbol,
        timeframe,
        scannedAt,
        provider: snapshot.provider,
        candleCount: result.length,
        firstCandleTime: result[0].time,
        lastCandleTime: result[result.length - 1].time,
        ruleVersion: "phase1-patterns-v1",
        result: detected,
        candleSnapshot: result,
      };
      setHistory(appendScanHistory(record));
      setCandles(result);
      setPattern(detected);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const message = cause instanceof Error ? cause.message : "Unable to load market data.";
      setError(message);
      setCandles([]);
      setPattern(null);
      const scannedAt = new Date().toISOString();
      const record: ScanHistoryRecord = {
        id: makeScanId(symbol, timeframe, scannedAt),
        symbol,
        timeframe,
        scannedAt,
        provider: "unavailable",
        candleCount: 0,
        firstCandleTime: 0,
        lastCandleTime: 0,
        ruleVersion: "phase1-patterns-v1",
        result: null,
        candleSnapshot: [],
        error: message,
      };
      setHistory(appendScanHistory(record));
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="PatternView home"><span className="brand-mark">P</span><span>Pattern<span className="brand-muted">View</span></span></a>
        <div className="topbar-right"><span className="live-dot" /> READ-ONLY MARKET DATA <span className="topbar-divider" /> PHASE 1</div>
      </header>

      <section className="page-heading">
        <div><p className="eyebrow">MARKET STRUCTURE / CRYPTO SPOT</p><h1>Pattern analysis workspace</h1><p className="subheading">Find the structure. Understand the evidence. Decide for yourself.</p></div>
        <div className="refresh-meta"><span className={loading ? "pulse-dot" : "live-dot"} />{loading ? "Updating candles…" : lastUpdated ? `Updated ${lastUpdated}` : "Awaiting data"}</div>
      </section>

      <section className="toolbar" aria-label="Chart controls">
        <div className="pair-select" role="group" aria-label="Trading pair">
          {PAIRS.map((pair) => <button key={pair.value} className={symbol === pair.value ? "pair-button selected" : "pair-button"} onClick={() => setSymbol(pair.value)}>{pair.label}</button>)}
        </div>
        <div className="timeframes" role="group" aria-label="Timeframe">
          {FRAMES.map((frame) => <button key={frame} className={timeframe === frame ? "time-button selected" : "time-button"} onClick={() => setTimeframe(frame)}>{frame}</button>)}
        </div>
        <button className="refresh-button" onClick={() => void load()} disabled={loading}>↻ <span>Refresh</span></button>
      </section>

      {error && <div className="error-banner" role="alert"><strong>Market data unavailable</strong><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}

      <section className="workspace">
        <div className="chart-column panel">
          <div className="panel-heading chart-heading">
            <div><span className="instrument-symbol">{symbol.replace("USDT", "")}</span><span className="instrument-name">{symbol.replace("USDT", "")} / Tether</span><span className="market-chip">SPOT</span></div>
            <span className="timeframe-label">{timeframe} <span>·</span> Multi-provider public data</span>
          </div>
          <div className="price-strip">
            <div><span className="metric-label">LAST CLOSED</span><strong>{candles.length ? money(candles[candles.length - 1].close) : "—"}</strong><span className="metric-unit">USDT</span></div>
            <div><span className="metric-label">24H HIGH</span><strong>{candles.length ? money(Math.max(...candles.filter((c) => c.time >= candles[candles.length - 1].time - 24 * 3600).map((c) => c.high))) : "—"}</strong></div>
            <div><span className="metric-label">24H LOW</span><strong>{candles.length ? money(Math.min(...candles.filter((c) => c.time >= candles[candles.length - 1].time - 24 * 3600).map((c) => c.low))) : "—"}</strong></div>
            <div><span className="metric-label">CLOSED BARS</span><strong>{candles.length || "—"}</strong></div>
          </div>
          {loading && candles.length === 0 ? <div className="chart-placeholder"><span className="loader" />Loading closed candles…</div> : <CandleChart candles={candles} pattern={pattern} />}
          <div className="chart-legend"><span><i className="legend-gold" /> Confirmed pivots</span><span><i className="legend-yellow" /> Neckline</span><span><i className="legend-red" /> Invalidation</span><span className="legend-note">Only closed candles are analysed</span></div>
        </div>

        <aside className="analysis-column">
          <div className="panel pattern-panel">
            <div className="panel-heading"><div><p className="eyebrow">DETECTION RESULT</p><h2>Pattern interpretation</h2></div><span className="count-chip">{pattern ? "01" : "00"} FOUND</span></div>
            {loading && candles.length === 0 ? <div className="empty-state"><span className="loader" /><p>Scanning confirmed pivots…</p></div> : pattern ? (
              <div className="pattern-content">
                <div className="pattern-title-row"><div className="pattern-icon">{BEARISH_PATTERNS.includes(pattern.kind) ? "⌃⌃" : "⌄⌄"}</div><div><h3>{PATTERN_NAMES[pattern.kind]}</h3><p>{BEARISH_PATTERNS.includes(pattern.kind) ? "Potential bearish reversal" : "Potential bullish reversal"}</p></div></div>
                <div className={`status-pill status-${pattern.status.toLowerCase().replaceAll(" ", "-")}`}><span />{pattern.status}</div>
                <div className="level-list">
                  <div><span>Neckline / breakout</span><strong>{money(pattern.neckline)} <small>USDT</small></strong></div>
                  <div><span>Invalidation level</span><strong>{money(pattern.invalidation)} <small>USDT</small></strong></div>
                  <div><span>Conditional entry</span><strong>{money(pattern.entry)} <small>USDT</small></strong></div>
                  <div><span>Stop-loss proposal</span><strong>{money(pattern.stopLoss)} <small>USDT</small></strong></div>
                  <div><span>Measured-move target</span><strong>{money(pattern.takeProfit)} <small>USDT</small></strong></div>
                </div>
                <div className="explanation"><h4>Why it was detected</h4><ul>{pattern.explanation.map((line, i) => <li key={i}>{line}</li>)}</ul></div>
                {pattern.status !== "QUALIFIED" && <p className="conditional-note">No qualified entry yet. Levels are conditional analysis, not instructions to trade.</p>}
              </div>
            ) : <div className="empty-state"><div className="empty-icon">⌁</div><h3>No qualifying formation</h3><p>No in-scope classical formation met the deterministic criteria in the available closed candles.</p><span className="neutral-pill">NO TRADE</span></div>}
          </div>
          <div className="panel rules-panel"><div className="panel-heading"><div><p className="eyebrow">DETECTION RULES</p><h2>Method at a glance</h2></div></div><ul className="rules-list"><li><span>01</span><div><strong>Confirmed pivots</strong><p>Three closed candles on each side of a pivot.</p></div></li><li><span>02</span><div><strong>Similarity tolerance</strong><p>Peak or trough levels within 1.2%.</p></div></li><li><span>03</span><div><strong>Breakout confirmation</strong><p>Requires a closed candle beyond the neckline.</p></div></li></ul></div>
        </aside>
      </section>

      <section className="panel history-panel" aria-label="Scan history">
        <div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent scan history</h2></div><span className="count-chip">{history.length} / 20 RECORDS</span></div>
        {history.length === 0 ? <div className="empty-state"><h3>No scans recorded yet</h3><p>Completed scans and provider failures will appear here. History is stored in this browser only.</p></div> : (
          <div className="history-list">
            {history.map((record) => <details className="history-record" key={record.id}>
              <summary><span>{record.symbol.replace("USDT", "/USDT")} · {record.timeframe}</span><span>{record.result ? PATTERN_NAMES[record.result.kind] : record.error ? "Provider error" : "No pattern"}</span><span>{new Date(record.scannedAt).toLocaleString()}</span></summary>
              <div className="history-detail">
                <p><strong>Provider:</strong> {record.provider} · <strong>Status:</strong> {record.result?.status ?? (record.error ? "ERROR" : "NO PATTERN")}</p>
                <p><strong>Rule version:</strong> {record.ruleVersion} · <strong>Closed candles:</strong> {record.candleCount}</p>
                <p><strong>Data range:</strong> {record.firstCandleTime ? new Date(record.firstCandleTime * 1000).toISOString() : "—"} to {record.lastCandleTime ? new Date(record.lastCandleTime * 1000).toISOString() : "—"}</p>
                {record.result && <p><strong>Neckline:</strong> {money(record.result.neckline)} · <strong>Invalidation:</strong> {money(record.result.invalidation)} · <strong>Entry / SL / TP:</strong> {money(record.result.entry)} / {money(record.result.stopLoss)} / {money(record.result.takeProfit)}</p>}
                {record.error && <p><strong>Error:</strong> {record.error}</p>}
                <details><summary>Reproducibility record ({record.candleSnapshot.length} candles)</summary><pre className="history-json">{JSON.stringify(record, null, 2)}</pre></details>
              </div>
            </details>)}
          </div>
        )}
      </section>

      <footer className="disclaimer"><span className="disclaimer-icon">i</span><p><strong>Analysis only — no order execution.</strong> Pattern recognition is heuristic and can produce false positives. Entry, stop-loss, and target levels are conditional estimates, not financial advice. No profitability or predictive accuracy is claimed.</p><span className="footer-version">PATTERNVIEW · PHASE 1</span></footer>
    </main>
  );
}
