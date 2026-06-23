import type { SeriesEpisode, SeriesInfo } from "@tv/xtream-core";

export function findNextEpisode(current: SeriesEpisode, info: SeriesInfo): SeriesEpisode | null {
  const seasons = info.seasons.length
    ? info.seasons.map((s) => s.season_number).sort((a, b) => a - b)
    : Object.keys(info.episodes)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

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
