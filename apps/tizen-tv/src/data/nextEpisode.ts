import type { SeriesEpisode, SeriesInfo } from "@tv/xtream-core";
import type { WatchEntry } from "./watchHistory.js";
import { seriesEpisodeId } from "./watchHistory.js";

function isCompleted(entry: WatchEntry): boolean {
  const positionMs = entry.positionMs ?? 0;
  const durationMs = entry.durationMs ?? 0;
  return durationMs > 0 && positionMs >= durationMs * 0.95;
}

export function getOrderedSeasonNumbers(info: SeriesInfo): number[] {
  const fromSeasons = info.seasons.map((s) => s.season_number);
  const fromEpisodes = Object.keys(info.episodes)
    .map(Number)
    .filter(Number.isFinite);
  return [...new Set([...fromSeasons, ...fromEpisodes])].sort((a, b) => a - b);
}

export function getAllEpisodesSorted(info: SeriesInfo): SeriesEpisode[] {
  const seasons = getOrderedSeasonNumbers(info);
  const result: SeriesEpisode[] = [];
  for (const season of seasons) {
    const episodes = [...(info.episodes[String(season)] ?? [])].sort(
      (a, b) => a.episode_num - b.episode_num,
    );
    result.push(...episodes);
  }
  return result;
}

export function findNextEpisode(current: SeriesEpisode, info: SeriesInfo): SeriesEpisode | null {
  const seasons = getOrderedSeasonNumbers(info);

  const currentSeasonKey = String(current.season);
  const currentSeasonEpisodes = [...(info.episodes[currentSeasonKey] ?? [])].sort(
    (a, b) => a.episode_num - b.episode_num,
  );
  const currentIndex = currentSeasonEpisodes.findIndex((ep) => ep.id === current.id);
  if (currentIndex >= 0 && currentIndex < currentSeasonEpisodes.length - 1) {
    return currentSeasonEpisodes[currentIndex + 1] ?? null;
  }

  const seasonIndex = seasons.indexOf(current.season);
  if (seasonIndex >= 0 && seasonIndex < seasons.length - 1) {
    const nextSeason = seasons[seasonIndex + 1];
    const nextEpisodes = [...(info.episodes[String(nextSeason)] ?? [])].sort(
      (a, b) => a.episode_num - b.episode_num,
    );
    return nextEpisodes[0] ?? null;
  }
  return null;
}

/** First unwatched episode after the user's latest completed episode (catches new seasons/episodes). */
export function findNextUnwatchedAfterProgress(
  seriesId: number,
  info: SeriesInfo,
  getEntry: (watchId: string) => WatchEntry | undefined,
): SeriesEpisode | null {
  const all = getAllEpisodesSorted(info);
  if (!all.length) return null;

  let highestCompletedIndex = -1;
  for (let i = 0; i < all.length; i++) {
    const ep = all[i]!;
    const saved = getEntry(seriesEpisodeId(seriesId, ep.id));
    if (saved && isCompleted(saved)) {
      highestCompletedIndex = i;
    }
  }

  for (let i = highestCompletedIndex + 1; i < all.length; i++) {
    const ep = all[i]!;
    const saved = getEntry(seriesEpisodeId(seriesId, ep.id));
    if (!saved || !isCompleted(saved)) {
      return ep;
    }
  }
  return null;
}
