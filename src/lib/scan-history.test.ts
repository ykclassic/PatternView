import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { appendScanHistory, makeScanId, readScanHistory } from "./scan-history";
import type { ScanHistoryRecord } from "./types";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
function setStorage(initial = "[]") {
  const values = new Map<string, string>([["patternview.scan-history.v1", initial]]);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } },
  });
  return values;
}
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete (globalThis as { window?: unknown }).window;
});

function record(index: number): ScanHistoryRecord {
  const scannedAt = new Date(1_800_000_000_000 + index).toISOString();
  return {
    id: makeScanId("BTCUSDT", "1h", scannedAt),
    symbol: "BTCUSDT",
    timeframe: "1h",
    scannedAt,
    provider: "kraken",
    candleCount: 40,
    firstCandleTime: 1_700_000_000,
    lastCandleTime: 1_700_140_400,
    ruleVersion: "phase1-patterns-v1",
    result: null,
    candleSnapshot: [],
  };
}

test("persists and reads scan records with provenance", () => {
  setStorage();
  const saved = appendScanHistory(record(1));
  assert.equal(saved.length, 1);
  assert.equal(readScanHistory()[0].provider, "kraken");
  assert.equal(readScanHistory()[0].ruleVersion, "phase1-patterns-v1");
});

test("caps history at 20 records", () => {
  setStorage();
  let saved = [] as ScanHistoryRecord[];
  for (let i = 0; i < 25; i += 1) saved = appendScanHistory(record(i));
  assert.equal(saved.length, 20);
  assert.equal(saved[0].id, record(24).id);
});

test("recovers safely from corrupt local storage", () => {
  setStorage("{not-json");
  assert.deepEqual(readScanHistory(), []);
});
