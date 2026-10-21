"use client";

import { useCallback, useEffect, useState } from "react";
import CandleChart from "@/components/candle-chart";
import { fetchCandles } from "@/lib/market-data";
import { detectLatestPattern } from "@/lib/patterns";
import type { Candle, DetectedPattern, SymbolPair, Timeframe } from "@/lib/types";

const PAIRS: { value: SymbolPair; label: string }[] = [
  { value: "BTCUSDT", label: "BTC / USDT" },
  { value: "ETHUSDT", label: "ETH / USDT" },
  { value: "SOLUSDT", label: "SOL / USDT" },
];
const FRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];

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

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCandles(symbol, timeframe, signal);
      if (result.length < 40) throw new Error("Not enough closed candles for a meaningful pattern scan.");
      setCandles(result);
      setPattern(detectLatestPattern(result));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to load market data.");
      setCandles([]);
      setPattern(null);
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
            <span className="timeframe-label">{timeframe} <span>·</span> Binance public data</span>
          </div>
          <div className="price-strip">
            <div><span className="metric-label">LAST CLOSED</span><strong>{candles.length ? money(candles[candles.length - 1].close) : "—"}</strong><span className="metric-unit">USDT</span></div>
            <div><span className="metric-label">24H HIGH</span><strong>{candles.length ? money(Math.max(...candles.slice(-24).map((c) => c.high))) : "—"}</strong></div>
            <div><span className="metric-label">24H LOW</span><strong>{candles.length ? money(Math.min(...candles.slice(-24).map((c) => c.low))) : "—"}</strong></div>
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
                <div className="pattern-title-row"><div className="pattern-icon">{pattern.kind === "DOUBLE_TOP" ? "⌃⌃" : "⌄⌄"}</div><div><h3>{pattern.kind === "DOUBLE_TOP" ? "Double top" : "Double bottom"}</h3><p>{pattern.kind === "DOUBLE_TOP" ? "Potential bearish reversal" : "Potential bullish reversal"}</p></div></div>
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
            ) : <div className="empty-state"><div className="empty-icon">⌁</div><h3>No qualifying formation</h3><p>No double top or double bottom met the current deterministic criteria in the available closed candles.</p><span className="neutral-pill">NO TRADE</span></div>}
          </div>
          <div className="panel rules-panel"><div className="panel-heading"><div><p className="eyebrow">DETECTION RULES</p><h2>Method at a glance</h2></div></div><ul className="rules-list"><li><span>01</span><div><strong>Confirmed pivots</strong><p>Three closed candles on each side of a pivot.</p></div></li><li><span>02</span><div><strong>Similarity tolerance</strong><p>Peak or trough levels within 1.2%.</p></div></li><li><span>03</span><div><strong>Breakout confirmation</strong><p>Requires a closed candle beyond the neckline.</p></div></li></ul></div>
        </aside>
      </section>

      <footer className="disclaimer"><span className="disclaimer-icon">i</span><p><strong>Analysis only — no order execution.</strong> Pattern recognition is heuristic and can produce false positives. Entry, stop-loss, and target levels are conditional estimates, not financial advice. No profitability or predictive accuracy is claimed.</p><span className="footer-version">PATTERNVIEW · PHASE 1</span></footer>
    </main>
  );
}
