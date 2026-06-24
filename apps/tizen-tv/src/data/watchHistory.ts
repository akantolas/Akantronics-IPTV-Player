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
  categoryId?: string;
  lastWatchedAt?: number;
}

const STORAGE_KEY = "tv_watch_history";
const MAX_ENTRIES = 200;
const MIN_TRUSTED_DURATION_MS = 60_000;

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
  if (positionMs < 10_000) return false;
  if (durationMs <= 0) return true;
  return positionMs < durationMs * 0.95;
}

export function progressFraction(entry: WatchEntry): number {
  const durationMs = entry.durationMs ?? 0;
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, (entry.positionMs ?? 0) / durationMs));
}

export function resolveResumeMs(entry: WatchEntry): number {
  const positionMs = entry.positionMs ?? 0;
  const durationMs = entry.durationMs ?? 0;
  if (positionMs <= 0) return 0;
  if (durationMs > 0 && positionMs >= durationMs * 0.95) return 0;
  if (durationMs > 0 && positionMs >= durationMs - 3000) return 0;
  if (!isInProgress(entry) && positionMs < 10_000) return 0;
  return positionMs;
}

export function hasResumableProgress(entry: WatchEntry): boolean {
  return isInProgress(entry) || resolveResumeMs(entry) > 0;
}

export function repairCorruptWatchEntry(entry: WatchEntry): WatchEntry {
  const positionMs = entry.positionMs ?? 0;
  const durationMs = entry.durationMs ?? 0;
  if (positionMs > 0 && durationMs > 0 && positionMs === durationMs) {
    return { ...entry, durationMs: 0 };
  }
  return entry;
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
      .filter((entry) => entry.type !== "LIVE" && hasResumableProgress(entry))
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
    this.notify();
  }

  removeEntry(id: string): void {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    persist(this.entries);
    this.notify();
  }

  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  recordLiveChannel(streamId: number, name: string, imageUrl = "", categoryId = ""): void {
    const id = liveId(streamId);
    const existing = this.getEntry(id);
    const entry: WatchEntry = {
      id,
      type: "LIVE",
      title: name,
      imageUrl,
      streamId: String(streamId),
      categoryId: categoryId || existing?.categoryId,
      lastWatchedAt: Date.now(),
    };
    this.entries = [entry, ...this.entries.filter((item) => item.id !== id)].slice(0, MAX_ENTRIES);
    persist(this.entries);
    this.notify();
  }

  saveProgress(
    id: string,
    positionMs: number,
    durationMs: number,
    builder: () => WatchEntry,
  ): WatchEntry | null {
    if (durationMs <= 0 && positionMs <= 0) return null;

    const existing = this.getEntry(id);
    const trustedDuration = Math.max(durationMs, existing?.durationMs ?? 0);

    let normalizedPosition = Math.max(0, positionMs);
    if (
      trustedDuration >= MIN_TRUSTED_DURATION_MS &&
      positionMs >= trustedDuration * 0.95
    ) {
      normalizedPosition = trustedDuration;
    }

    const entry: WatchEntry = {
      ...(existing ?? builder()),
      positionMs: normalizedPosition,
      durationMs: trustedDuration,
      lastWatchedAt: Date.now(),
    };

    this.entries = [entry, ...this.entries.filter((item) => item.id !== id)].slice(0, MAX_ENTRIES);
    persist(this.entries);
    this.notify();
    return entry;
  }
}

function loadEntries(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchEntry[];
    if (!Array.isArray(parsed)) return [];
    const repaired = parsed.map(repairCorruptWatchEntry);
    const changed = repaired.some((entry, index) => {
      const prev = parsed[index];
      return entry.durationMs !== prev?.durationMs;
    });
    if (changed) persist(repaired);
    return repaired;
  } catch {
    return [];
  }
}

function persist(entries: WatchEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const watchHistoryStore = new WatchHistoryStore();
