import type { ScanHistoryRecord } from "@/lib/types";

const STORAGE_KEY = "patternview.scan-history.v1";
const MAX_RECORDS = 20;

export function readScanHistory(): ScanHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ScanHistoryRecord =>
      typeof item === "object" && item !== null &&
      typeof item.id === "string" && typeof item.symbol === "string" &&
      typeof item.timeframe === "string" && typeof item.scannedAt === "string" &&
      Array.isArray(item.candleSnapshot)
    );
  } catch {
    return [];
  }
}

export function appendScanHistory(record: ScanHistoryRecord): ScanHistoryRecord[] {
  const current = readScanHistory();
  const next = [record, ...current.filter((item) => item.id !== record.id)].slice(0, MAX_RECORDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be disabled or full; callers should still show the live scan.
    return current;
  }
  return next;
}

export function makeScanId(symbol: string, timeframe: string, scannedAt: string): string {
  return `${symbol}-${timeframe}-${new Date(scannedAt).getTime()}`;
}
