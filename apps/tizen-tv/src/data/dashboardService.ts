import type { LiveStream, SeriesItem, VodStream } from "@tv/xtream-core";
import { contentService } from "./contentService.js";
import {
  FAVORITES_CATEGORY_ID,
  categoryVisibilityStore,
  filterVisibleCategories,
} from "./categoryVisibility.js";
import { favoritesStore } from "./favoritesStore.js";
import {
  hasResumableProgress,
  isInProgress,
  watchHistoryStore,
  type WatchEntry,
} from "./watchHistory.js";
import { computeExpiry, type ExpiryUrgency } from "../ui/expiry.js";
import { catalogIndex } from "./catalogIndex.js";
import { heroTaglineForEntry } from "../ui/watchEntryFormat.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import {
  appendSeriesWithNewEpisodes,
  enrichRecentSeries,
  resolveSeriesDashboardEntry,
} from "./seriesProgress.js";
import { buildPosterStackItems, getPosterStackEntryIds } from "../dashboard/posterStack.js";

export interface CategoryPreview {
  category_id: string;
  category_name: string;
  channels: LiveStream[];
}

export interface SeriesNextEpisode {
  id: string;
  season: number;
  episodeNum: number;
  title: string;
  extension: string;
}

export interface DashboardWatchEntry extends WatchEntry {
  isFinished?: boolean;
  seriesAction?: "resume" | "next" | "done";
  nextEpisodeLabel?: string;
  nextEpisode?: SeriesNextEpisode;
}

export interface DashboardData {
  playlistName: string;
  expiryLabel: string;
  expiryUrgency: ExpiryUrgency;
  liveCategoryCount: number;
  quickPlayChannel: LiveStream | null;
  heroEntry: WatchEntry | null;
  heroTagline: string;
  favoriteChannels: LiveStream[];
  browseCategories: Array<{ category_id: string; category_name: string }>;
  continueWatching: DashboardWatchEntry[];
  recentLive: WatchEntry[];
  recentMovies: DashboardWatchEntry[];
  recentSeries: DashboardWatchEntry[];
  categoryPreviews: CategoryPreview[];
}

const PREVIEW_CATEGORY_LIMIT = 3;
const PREVIEW_CHANNEL_LIMIT = 12;
const RECENT_LIMIT = 12;

export function buildDashboardLocalState(): Pick<
  DashboardData,
  | "playlistName"
  | "quickPlayChannel"
  | "heroEntry"
  | "heroTagline"
  | "favoriteChannels"
  | "continueWatching"
  | "recentLive"
  | "recentMovies"
  | "recentSeries"
> {
  const playlistState = userSyncManager.loadPlaylists();
  const activePlaylist =
    playlistState.playlists.find((p) => p.id === playlistState.activePlaylistId) ??
    playlistState.playlists[0];
  const playlistName = activePlaylist?.name ?? contentService.getCredentials()?.username ?? "IPTV";

  const lastLive = watchHistoryStore.getRecentlyViewed(20).find((entry) => entry.type === "LIVE");
  let quickPlayChannel: LiveStream | null = null;

  if (lastLive) {
    quickPlayChannel = {
      num: 0,
      name: lastLive.title,
      stream_type: "live",
      stream_id: Number(lastLive.streamId),
      stream_icon: lastLive.imageUrl ?? "",
      category_id: lastLive.categoryId ?? "",
    };
  } else {
    const favLive = favoritesStore.byKind("LIVE")[0];
    if (favLive?.streamId) {
      quickPlayChannel = {
        num: 0,
        name: favLive.title,
        stream_type: "live",
        stream_id: favLive.streamId,
        stream_icon: favLive.imageUrl ?? "",
        category_id: favLive.categoryId ?? "",
      };
    }
  }

  const continueWatching = watchHistoryStore
    .getContinueWatching()
    .map((entry) => toContinueDashboardEntry(entry));
  const heroEntry = continueWatching[0] ?? null;
  const heroTagline = heroTaglineForEntry(heroEntry, Boolean(quickPlayChannel));

  const favoriteChannels: LiveStream[] = favoritesStore.byKind("LIVE").map((fav) => ({
    num: 0,
    name: fav.title,
    stream_type: "live",
    stream_id: fav.streamId ?? 0,
    stream_icon: fav.imageUrl ?? "",
    category_id: fav.categoryId ?? "",
  }));

  const recent = watchHistoryStore.getRecentlyViewed(RECENT_LIMIT * 2);
  const recentLive = recent.filter((e) => e.type === "LIVE").slice(0, RECENT_LIMIT);
  const recentMovies = buildRecentMovies(recent);
  const recentSeries = buildRecentSeries(recent);

  return {
    playlistName,
    quickPlayChannel,
    heroEntry,
    heroTagline,
    favoriteChannels,
    continueWatching,
    recentLive,
    recentMovies,
    recentSeries,
  };
}

function toContinueDashboardEntry(entry: WatchEntry): DashboardWatchEntry {
  if (entry.type === "SERIES_EPISODE" && hasResumableProgress(entry)) {
    return { ...entry, isFinished: false, seriesAction: "resume" };
  }
  if (entry.type === "MOVIE") {
    return { ...entry, isFinished: !hasResumableProgress(entry) };
  }
  return { ...entry };
}

export function filterContinueForPosterStack(
  entries: DashboardWatchEntry[],
  stackEntryIds: string[],
): DashboardWatchEntry[] {
  const excludeIds = new Set(stackEntryIds);
  return entries.filter((entry) => !excludeIds.has(entry.id));
}

function buildRecentMovies(recent: WatchEntry[]): DashboardWatchEntry[] {
  return recent
    .filter((e) => e.type === "MOVIE")
    .slice(0, RECENT_LIMIT)
    .map((entry) => ({ ...entry, isFinished: !isInProgress(entry) }));
}

function buildRecentSeries(recent: WatchEntry[]): DashboardWatchEntry[] {
  const seen = new Set<string>();
  const result: DashboardWatchEntry[] = [];
  for (const entry of recent) {
    if (entry.type !== "SERIES_EPISODE") continue;
    const key = entry.seriesId != null ? `series_${entry.seriesId}` : entry.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...entry,
      isFinished: false,
      seriesAction: hasResumableProgress(entry) ? "resume" : undefined,
    });
    if (result.length >= RECENT_LIMIT) break;
  }
  return result;
}

export async function loadDashboardExpiry(): Promise<Pick<DashboardData, "expiryLabel" | "expiryUrgency">> {
  const credentials = contentService.getCredentials();
  if (credentials) {
    try {
      await contentService.authenticate(credentials);
    } catch {
      // keep cached session if refresh fails
    }
  }
  const userInfo = contentService.getUserInfo();
  const expiry = computeExpiry(userInfo?.exp_date);
  return {
    expiryLabel: expiry.label,
    expiryUrgency: expiry.urgency,
  };
}

export async function loadDashboardCatalog(): Promise<
  Pick<
    DashboardData,
    "expiryLabel" | "expiryUrgency" | "liveCategoryCount" | "browseCategories" | "categoryPreviews"
  > & { quickPlayFallback: LiveStream | null }
> {
  const credentials = contentService.getCredentials();
  if (credentials) {
    try {
      await contentService.authenticate(credentials);
    } catch {
      // keep cached session if refresh fails
    }
  }
  const userInfo = contentService.getUserInfo();
  const categories = filterVisibleCategories(
    "live",
    await contentService.getLiveCategories(),
    categoryVisibilityStore,
  );

  let quickPlayFallback: LiveStream | null = null;
  const firstCategory = categories.find((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
  if (firstCategory) {
    const streams = await contentService.getLiveStreams(firstCategory.category_id);
    quickPlayFallback = streams[0] ?? null;
  }

  const expiry = computeExpiry(userInfo?.exp_date);
  const previewCategories = categories
    .filter((c) => c.category_id !== FAVORITES_CATEGORY_ID)
    .slice(0, PREVIEW_CATEGORY_LIMIT);

  const categoryPreviews = await Promise.all(
    previewCategories.map(async (category) => ({
      category_id: category.category_id,
      category_name: category.category_name,
      channels: (await contentService.getLiveStreams(category.category_id)).slice(0, PREVIEW_CHANNEL_LIMIT),
    })),
  );

  return {
    expiryLabel: expiry.label,
    expiryUrgency: expiry.urgency,
    liveCategoryCount: categories.filter((c) => c.category_id !== FAVORITES_CATEGORY_ID).length,
    browseCategories: categories,
    categoryPreviews,
    quickPlayFallback,
  };
}

export async function enrichDashboardSeries(data: DashboardData): Promise<DashboardData> {
  const continueWatching = await Promise.all(
    data.continueWatching.map((entry) => resolveSeriesDashboardEntry(entry)),
  );
  const withNewContent = await appendSeriesWithNewEpisodes(data.recentSeries, RECENT_LIMIT);
  const recentSeries = await enrichRecentSeries(withNewContent);
  const enriched = { ...data, continueWatching, recentSeries };
  const stackIds = getPosterStackEntryIds(buildPosterStackItems(enriched));
  return {
    ...enriched,
    continueWatching: filterContinueForPosterStack(enriched.continueWatching, stackIds),
  };
}

export async function loadDashboardData(): Promise<DashboardData> {
  const local = buildDashboardLocalState();
  const expiry = await loadDashboardExpiry();
  return enrichDashboardSeries({
    ...local,
    ...expiry,
    liveCategoryCount: 0,
    browseCategories: [],
    categoryPreviews: [],
  });
}

export function refreshDashboardLocal(snapshot: DashboardData): DashboardData {
  const local = buildDashboardLocalState();
  return {
    ...snapshot,
    playlistName: local.playlistName,
    quickPlayChannel: local.quickPlayChannel ?? snapshot.quickPlayChannel,
    heroEntry: local.heroEntry,
    heroTagline: local.heroTagline,
    favoriteChannels: local.favoriteChannels,
    continueWatching: local.continueWatching,
    recentLive: local.recentLive,
    recentMovies: local.recentMovies,
    recentSeries: local.recentSeries,
  };
}

export function mergeDashboardData(
  catalog: Awaited<ReturnType<typeof loadDashboardCatalog>>,
  local = buildDashboardLocalState(),
): DashboardData {
  if (!local.quickPlayChannel && catalog.quickPlayFallback) {
    local.quickPlayChannel = catalog.quickPlayFallback;
    local.heroTagline = heroTaglineForEntry(local.heroEntry, true);
  }
  return {
    ...local,
    expiryLabel: catalog.expiryLabel,
    expiryUrgency: catalog.expiryUrgency,
    liveCategoryCount: catalog.liveCategoryCount,
    browseCategories: catalog.browseCategories,
    categoryPreviews: catalog.categoryPreviews,
  };
}

export interface SearchResults {
  live: LiveStream[];
  movies: VodStream[];
  series: SeriesItem[];
}

const SEARCH_LIMIT = 40;

export async function searchCatalog(query: string): Promise<SearchResults> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return { live: [], movies: [], series: [] };

  if (!catalogIndex.isReady()) {
    void catalogIndex.rebuild();
  }
  if (catalogIndex.isReady()) {
    return catalogIndex.search(normalized, SEARCH_LIMIT);
  }

  const [liveCats, movieCats, seriesCats] = await Promise.all([
    filterVisibleCategories("live", await contentService.getLiveCategories(), categoryVisibilityStore, false),
    filterVisibleCategories("movies", await contentService.getVodCategories(), categoryVisibilityStore, false),
    filterVisibleCategories("series", await contentService.getSeriesCategories(), categoryVisibilityStore, false),
  ]);

  const [live, movies, series] = await Promise.all([
    searchLive(normalized, liveCats),
    searchMovies(normalized, movieCats),
    searchSeries(normalized, seriesCats),
  ]);

  return { live, movies, series };
}

async function searchLive(query: string, categories: Array<{ category_id: string }>): Promise<LiveStream[]> {
  const results: LiveStream[] = [];
  for (const category of categories) {
    const streams = await contentService.getLiveStreams(category.category_id);
    results.push(...streams.filter((item) => item.name.toLowerCase().includes(query)));
    if (results.length >= SEARCH_LIMIT) break;
  }
  return results.slice(0, SEARCH_LIMIT);
}

async function searchMovies(query: string, categories: Array<{ category_id: string }>): Promise<VodStream[]> {
  const results: VodStream[] = [];
  for (const category of categories) {
    const streams = await contentService.getVodStreams(category.category_id);
    results.push(...streams.filter((item) => item.name.toLowerCase().includes(query)));
    if (results.length >= SEARCH_LIMIT) break;
  }
  return results.slice(0, SEARCH_LIMIT);
}

async function searchSeries(query: string, categories: Array<{ category_id: string }>): Promise<SeriesItem[]> {
  const results: SeriesItem[] = [];
  for (const category of categories) {
    const streams = await contentService.getSeries(category.category_id);
    results.push(...streams.filter((item) => item.name.toLowerCase().includes(query)));
    if (results.length >= SEARCH_LIMIT) break;
  }
  return results.slice(0, SEARCH_LIMIT);
}
