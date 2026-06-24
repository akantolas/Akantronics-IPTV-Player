import type { WatchEntry } from "../data/watchHistory.js";
import { isInProgress } from "../data/watchHistory.js";

export function formatWatchTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

export function continueLabel(entry: WatchEntry): string {
  if (entry.type === "MOVIE") {
    return `Συνέχισε · ${formatWatchTime(entry.positionMs ?? 0)}`;
  }
  if (entry.type === "SERIES_EPISODE") {
    const base = entry.subtitle?.trim() || "Επεισόδιο";
    return `${base} · ${formatWatchTime(entry.positionMs ?? 0)}`;
  }
  return entry.title;
}

export function heroTaglineForEntry(entry: WatchEntry | null, hasQuickLive: boolean): string {
  if (entry && isInProgress(entry)) {
    return continueLabel(entry);
  }
  if (hasQuickLive) return "Συνέχεια ζωντανά";
  return "Ξεκίνα από Live TV";
}
