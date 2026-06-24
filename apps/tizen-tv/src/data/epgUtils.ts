import type { EpgProgram } from "./contentService.js";

export interface NowNext {
  now: EpgProgram | null;
  next: EpgProgram | null;
}

export function toNowNext(epg: EpgProgram[], nowMs = Date.now()): NowNext {
  const programmes = [...epg].filter((p) => p.title && Number.isFinite(p.start) && Number.isFinite(p.end)).sort((a, b) => a.start - b.start);
  if (programmes.length === 0) return { now: null, next: null };

  const now =
    programmes.findLast((p) => nowMs >= p.start && nowMs < p.end) ??
    programmes.find((p) => p.start <= nowMs && p.end > nowMs) ??
    null;

  const next = now
    ? programmes.find((p) => p.start >= now.end) ?? null
    : programmes.find((p) => p.start > nowMs) ?? null;

  return { now, next };
}

export function epgProgressPercent(start: number, end: number, nowMs = Date.now()): number {
  const span = end - start;
  if (span <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, ((nowMs - start) / span) * 100)));
}

export function formatEpgTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
}

export function formatEpgTimeRange(start: number, end: number): string {
  return `${formatEpgTime(start)} – ${formatEpgTime(end)}`;
}
