export type WatchType = "LIVE" | "MOVIE" | "SERIES_EPISODE";

export interface WatchEntry {
  id: string;
  type: WatchType;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  positionMs?: number;
  durationMs?: number;
  streamId: string;
  containerExtension?: string;
  seriesId?: number | null;
  season?: number | null;
  episodeId?: string | null;
  lastWatchedAt?: number;
}

const STORAGE_KEY = "tv_watch_history";
const MAX_ENTRIES = 200;

export function movieId(streamId: number | string): string {
  return `movie_${streamId}`;
}

export function liveId(streamId: number | string): string {
  return `live_${streamId}`;
}

export function seriesEpisodeId(seriesId: number, episodeId: string): string {
  return `series_${seriesId}_ep_${episodeId}`;
}

export function isInProgress(entry: WatchEntry): boolean {
  const positionMs = entry.positionMs ?? 0;
  const durationMs = entry.durationMs ?? 0;
  return positionMs >= 10_000 && (durationMs <= 0 || positionMs < durationMs * 0.95);
}

export function progressFraction(entry: WatchEntry): number {
  const durationMs = entry.durationMs ?? 0;
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, (entry.positionMs ?? 0) / durationMs));
}

export class WatchHistoryStore {
  private entries: WatchEntry[] = loadEntries();

  getAll(): WatchEntry[] {
    return [...this.entries];
  }

  getEntry(id: string): WatchEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  getRecentlyViewed(limit = 15): WatchEntry[] {
    return [...this.entries]
      .sort((a, b) => (b.lastWatchedAt ?? 0) - (a.lastWatchedAt ?? 0))
      .slice(0, limit);
  }

  getContinueWatching(limit = 15): WatchEntry[] {
    return this.getRecentlyViewed(limit * 2)
      .filter((entry) => entry.type !== "LIVE" && isInProgress(entry))
      .slice(0, limit);
  }

  getRecentlyFinished(limit = 15): WatchEntry[] {
    return this.getRecentlyViewed(limit * 2)
      .filter((entry) => !isInProgress(entry))
      .slice(0, limit);
  }

  replaceAll(entries: WatchEntry[]): void {
    this.entries = entries.slice(0, MAX_ENTRIES);
    persist(this.entries);
  }

  removeEntry(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    persist(this.entries);
  }

  recordLiveChannel(streamId: number, name: string, imageUrl = ""): void {
    const id = liveId(streamId);
    const entry: WatchEntry = {
      id,
      type: "LIVE",
      title: name,
      imageUrl,
      streamId: String(streamId),
      lastWatchedAt: Date.now(),
    };
    this.entries = [entry, ...this.entries.filter((item) => item.id !== id)].slice(0, MAX_ENTRIES);
    persist(this.entries);
  }

  saveProgress(
    id: string,
    positionMs: number,
    durationMs: number,
    builder: () => WatchEntry,
  ): WatchEntry | null {
    if (durationMs <= 0 && positionMs <= 0) return null;

    const normalizedPosition =
      durationMs > 0 && positionMs >= durationMs * 0.95 ? durationMs : Math.max(0, positionMs);

    const existing = this.getEntry(id);
    const entry: WatchEntry = {
      ...(existing ?? builder()),
      positionMs: normalizedPosition,
      durationMs: Math.max(durationMs, existing?.durationMs ?? 0),
      lastWatchedAt: Date.now(),
    };

    this.entries = [entry, ...this.entries.filter((item) => item.id !== id)].slice(0, MAX_ENTRIES);
    persist(this.entries);
    return entry;
  }
}

function loadEntries(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: WatchEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const watchHistoryStore = new WatchHistoryStore();
