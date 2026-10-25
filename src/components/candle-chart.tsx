"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import type { Candle, DetectedPattern } from "@/lib/types";

interface Props {
  candles: Candle[];
  pattern: DetectedPattern | null;
}

const BEARISH_STRUCTURES = new Set([
  "DOUBLE_TOP", "TRIPLE_TOP", "HEAD_AND_SHOULDERS",
  "DESCENDING_TRIANGLE", "BEAR_FLAG", "RISING_WEDGE",
]);

export default function CandleChart({ candles, pattern }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#0b1220" }, textColor: "#a8b4c7", fontFamily: "Inter, sans-serif" },
      grid: { vertLines: { color: "#182337" }, horzLines: { color: "#182337" } },
      rightPriceScale: { borderColor: "#253249" },
      timeScale: { borderColor: "#253249", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#53647e" }, horzLine: { color: "#53647e" } },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#21c997",
      downColor: "#f16b7a",
      borderVisible: false,
      wickUpColor: "#21c997",
      wickDownColor: "#f16b7a",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = createSeriesMarkers(series, []);
    const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    const markers = markersRef.current;
    if (!series || !chart || !markers) return;

    series.setData(candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })));

    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];

    if (pattern && candles.length > 0) {
      priceLinesRef.current = [
        series.createPriceLine({
          price: pattern.neckline,
          color: "#f5c451",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Neckline / breakout",
        }),
        series.createPriceLine({
          price: pattern.invalidation,
          color: "#f16b7a",
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: "Invalidation",
        }),
      ];
      const bearish = BEARISH_STRUCTURES.has(pattern.kind);
      const pivotTimes = [pattern.firstPivotTime, pattern.secondPivotTime, pattern.thirdPivotTime]
        .filter((time): time is number => typeof time === "number" && time > 0);
      markers.setMarkers(pivotTimes.map((time, index) => ({
        time: time as Time,
        position: bearish ? "aboveBar" : "belowBar",
        color: "#f5c451",
        shape: bearish ? "arrowDown" : "arrowUp",
        text: String(index + 1),
      })));
    } else {
      markers.setMarkers([]);
    }
    chart.timeScale().fitContent();
  }, [candles, pattern]);

  return <div className="chart-frame"><div ref={containerRef} className="chart-canvas" aria-label="Candlestick chart" /></div>;
}
