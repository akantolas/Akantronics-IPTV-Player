import type { SeriesEpisode } from "@tv/xtream-core";

export interface EpisodeDisplay {
  numLabel: string;
  numPadded: string;
  title: string;
  headline: string;
}

const SEASON_EPISODE_RE = /\bS\d+\s*E\d+\b/gi;
const SEASON_EPISODE_COMPACT_RE = /\bS\d+E\d+\b/gi;
const LANGUAGE_PREFIX_RE = /^[A-Z]{2,3}\s*[-–—]\s*/i;
const EPISODE_FALLBACK_RE = /^(?:επεισόδιο|episode)\s*\d+$/i;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripSeriesPrefix(title: string, seriesName: string): string {
  if (!seriesName) return title;
  const lowerTitle = title.toLowerCase();
  const lowerSeries = seriesName.toLowerCase();
  if (lowerTitle.startsWith(lowerSeries)) {
    return normalizeWhitespace(title.slice(seriesName.length).replace(/^[\s\-–—:|]+/, ""));
  }
  return title;
}

function stripEpisodeCodes(title: string, episodeNum: number): string {
  let cleaned = title
    .replace(SEASON_EPISODE_COMPACT_RE, "")
    .replace(SEASON_EPISODE_RE, "")
    .replace(LANGUAGE_PREFIX_RE, "");

  cleaned = normalizeWhitespace(cleaned.replace(/^[\-–—:|·]+\s*/, ""));

  if (!cleaned) {
    return `Επεισόδιο ${episodeNum}`;
  }

  if (EPISODE_FALLBACK_RE.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

export function formatEpisodeDisplay(
  ep: Pick<SeriesEpisode, "episode_num" | "title">,
  _season: number | string,
  seriesName: string,
): EpisodeDisplay {
  const num = ep.episode_num;
  let title = normalizeWhitespace(ep.title || "");
  title = stripSeriesPrefix(title, seriesName);
  title = stripEpisodeCodes(title, num);

  if (!title) {
    title = `Επεισόδιο ${num}`;
  }

  const numLabel = `E${num}`;

  return {
    numLabel,
    numPadded: String(num).padStart(2, "0"),
    title,
    headline: `${numLabel} · ${title}`,
  };
}
