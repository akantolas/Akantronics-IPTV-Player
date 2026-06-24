import type { SeriesEpisode, SeriesInfo } from "@tv/xtream-core";
import { contentService } from "./contentService.js";
import { findNextEpisode, findNextUnwatchedAfterProgress, getAllEpisodesSorted } from "./nextEpisode.js";
import { isInProgress, progressFraction, seriesEpisodeId, watchHistoryStore, type WatchEntry } from "./watchHistory.js";
import type { DashboardWatchEntry } from "./dashboardService.js";

const SERIES_INFO_TTL_MS = 5 * 60 * 1000;

const seriesInfoCache = new Map<number, { info: SeriesInfo; at: number }>();

export type EpisodeWatchState = "unwatched" | "in_progress" | "completed";

export function isEpisodeCompleted(entry: WatchEntry): boolean {
  const positionMs = entry.positionMs ?? 0;
  const durationMs = entry.durationMs ?? 0;
  return durationMs > 0 && positionMs >= durationMs * 0.95;
}

export function getEpisodeWatchState(entry?: WatchEntry): {
  state: EpisodeWatchState;
  progress: number;
  resumeMs: number;
} {
  if (!entry) {
    return { state: "unwatched", progress: 0, resumeMs: 0 };
  }
  if (isInProgress(entry)) {
    return {
      state: "in_progress",
      progress: progressFraction(entry),
      resumeMs: entry.positionMs ?? 0,
    };
  }
  if (isEpisodeCompleted(entry)) {
    return { state: "completed", progress: 1, resumeMs: 0 };
  }
  return { state: "unwatched", progress: 0, resumeMs: 0 };
}

export function getMovieWatchState(entry?: WatchEntry): {
  state: EpisodeWatchState;
  progress: number;
  resumeMs: number;
} {
  return getEpisodeWatchState(entry);
}

export function countSeasonCompleted(
  seriesId: number,
  episodes: SeriesEpisode[],
  getEntry: (watchId: string) => WatchEntry | undefined,
  seriesEpisodeIdFn: (seriesId: number, episodeId: string) => string,
): number {
  return episodes.filter((ep) => {
    const entry = getEntry(seriesEpisodeIdFn(seriesId, ep.id));
    return entry ? isEpisodeCompleted(entry) : false;
  }).length;
}

export function findEpisodeInInfo(info: SeriesInfo, entry: WatchEntry): SeriesEpisode | null {
  const targetId = entry.episodeId ?? entry.streamId;
  for (const season of Object.keys(info.episodes)) {
    for (const episode of info.episodes[season] ?? []) {
      if (episode.id === targetId) return episode;
    }
  }

  if (entry.season != null) {
    const seasonEps = info.episodes[String(entry.season)] ?? [];
    const subtitleMatch = entry.subtitle?.match(/S\d+\s*E(\d+)/i);
    const episodeNum = subtitleMatch ? Number(subtitleMatch[1]) : null;
    if (episodeNum != null && Number.isFinite(episodeNum)) {
      return seasonEps.find((ep) => ep.episode_num === episodeNum) ?? null;
    }
  }

  return null;
}

function findFurthestWatchedEpisode(seriesId: number, info: SeriesInfo): SeriesEpisode | null {
  const all = getAllEpisodesSorted(info);
  let furthest: SeriesEpisode | null = null;
  for (const ep of all) {
    const saved = watchHistoryStore.getEntry(seriesEpisodeId(seriesId, ep.id));
    if (saved && (isEpisodeCompleted(saved) || (saved.positionMs ?? 0) > 0)) {
      furthest = ep;
    }
  }
  return furthest;
}

function entryWithNextEpisode(entry: WatchEntry, next: SeriesEpisode): DashboardWatchEntry {
  return {
    ...entry,
    isFinished: false,
    seriesAction: "next",
    nextEpisodeLabel: `S${next.season} E${next.episode_num}`,
    nextEpisode: {
      id: next.id,
      season: next.season,
      episodeNum: next.episode_num,
      title: next.title,
      extension: next.container_extension,
    },
  };
}

function resolveNextEpisode(
  seriesId: number,
  info: SeriesInfo,
  entry: WatchEntry,
): SeriesEpisode | null {
  const current = findEpisodeInInfo(info, entry) ?? findFurthestWatchedEpisode(seriesId, info);
  const fromCurrent = current ? findNextEpisode(current, info) : null;
  if (fromCurrent) return fromCurrent;
  return findNextUnwatchedAfterProgress(seriesId, info, (id) => watchHistoryStore.getEntry(id));
}

export async function getCachedSeriesInfo(seriesId: number, forceRefresh = false): Promise<SeriesInfo> {
  const cached = seriesInfoCache.get(seriesId);
  if (!forceRefresh && cached && Date.now() - cached.at <= SERIES_INFO_TTL_MS) {
    return cached.info;
  }
  const info = await contentService.getSeriesInfo(seriesId);
  seriesInfoCache.set(seriesId, { info, at: Date.now() });
  return info;
}

export function invalidateSeriesInfoCache(): void {
  seriesInfoCache.clear();
}

export async function resolveSeriesDashboardEntry(entry: WatchEntry): Promise<DashboardWatchEntry> {
  if (entry.type !== "SERIES_EPISODE") {
    return { ...entry, isFinished: !isInProgress(entry) };
  }

  if (isInProgress(entry)) {
    return {
      ...entry,
      isFinished: false,
      seriesAction: "resume",
    };
  }

  if ((entry.positionMs ?? 0) > 0 && !isEpisodeCompleted(entry)) {
    return {
      ...entry,
      isFinished: false,
      seriesAction: "resume",
    };
  }

  if (!entry.seriesId) {
    return { ...entry, isFinished: true, seriesAction: "done" };
  }

  try {
    const info = await getCachedSeriesInfo(entry.seriesId, true);
    const next = resolveNextEpisode(entry.seriesId, info, entry);

    if (next) {
      return entryWithNextEpisode(entry, next);
    }
  } catch {
    // fall through to done if series info unavailable
  }

  return {
    ...entry,
    isFinished: true,
    seriesAction: "done",
  };
}

export async function enrichRecentSeries(entries: DashboardWatchEntry[]): Promise<DashboardWatchEntry[]> {
  return Promise.all(entries.map((entry) => resolveSeriesDashboardEntry(entry)));
}

/** Re-surface completed series that have new unwatched episodes in the catalog. */
export async function appendSeriesWithNewEpisodes(
  entries: DashboardWatchEntry[],
  limit = 12,
): Promise<DashboardWatchEntry[]> {
  const seen = new Set(entries.map((e) => e.seriesId).filter((id): id is number => id != null));
  const bySeries = new Map<number, WatchEntry>();

  for (const entry of watchHistoryStore.getAll()) {
    if (entry.type !== "SERIES_EPISODE" || entry.seriesId == null) continue;
    if (isInProgress(entry)) continue;
    const existing = bySeries.get(entry.seriesId);
    if (!existing || (entry.lastWatchedAt ?? 0) > (existing.lastWatchedAt ?? 0)) {
      bySeries.set(entry.seriesId, entry);
    }
  }

  const candidates = [...bySeries.entries()]
    .filter(([seriesId]) => !seen.has(seriesId))
    .sort((a, b) => (b[1].lastWatchedAt ?? 0) - (a[1].lastWatchedAt ?? 0));

  const result = [...entries];
  for (const [, entry] of candidates) {
    if (result.length >= limit) break;
    const resolved = await resolveSeriesDashboardEntry(entry);
    if (resolved.seriesAction === "next" && resolved.seriesId != null) {
      result.push(resolved);
      seen.add(resolved.seriesId);
    }
  }
  return result;
}
