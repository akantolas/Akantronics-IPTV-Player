import type { LiveStream, SeriesItem, VodStream } from "@tv/xtream-core";
import { contentService } from "./contentService.js";
import {
  FAVORITES_CATEGORY_ID,
  categoryVisibilityStore,
  filterVisibleCategories,
} from "./categoryVisibility.js";
import { favoritesStore } from "./favoritesStore.js";
import { watchHistoryStore, type WatchEntry } from "./watchHistory.js";
import { computeExpiry, expiryDisplayValue, type ExpiryUrgency } from "../ui/expiry.js";
import { posterCard } from "../ui/focus.js";

export interface CategoryPreview {
  category_id: string;
  category_name: string;
  channels: LiveStream[];
}

export interface DashboardData {
  playlistName: string;
  expiryLabel: string;
  expiryUrgency: ExpiryUrgency;
  liveCategoryCount: number;
  quickPlayChannel: LiveStream | null;
  favoriteChannels: LiveStream[];
  browseCategories: Array<{ category_id: string; category_name: string }>;
  continueWatching: WatchEntry[];
  recentlyFinished: WatchEntry[];
  recentLive: WatchEntry[];
  recentMovies: WatchEntry[];
  recentSeries: WatchEntry[];
  categoryPreviews: CategoryPreview[];
}

const PREVIEW_CATEGORY_LIMIT = 3;
const PREVIEW_CHANNEL_LIMIT = 12;
const RECENT_LIMIT = 12;

export async function loadDashboardData(): Promise<DashboardData> {
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

  const lastLive = watchHistoryStore.getRecentlyViewed(20).find((entry) => entry.type === "LIVE");
  let quickPlayChannel: LiveStream | null = null;

  if (lastLive) {
    quickPlayChannel = {
      num: 0,
      name: lastLive.title,
      stream_type: "live",
      stream_id: Number(lastLive.streamId),
      stream_icon: lastLive.imageUrl ?? "",
      category_id: "",
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
    } else {
      const firstCategory = categories.find((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
      if (firstCategory) {
        const streams = await contentService.getLiveStreams(firstCategory.category_id);
        quickPlayChannel = streams[0] ?? null;
      }
    }
  }

  const favoriteChannels: LiveStream[] = favoritesStore.byKind("LIVE").map((fav) => ({
    num: 0,
    name: fav.title,
    stream_type: "live",
    stream_id: fav.streamId ?? 0,
    stream_icon: fav.imageUrl ?? "",
    category_id: fav.categoryId ?? "",
  }));

  const expiry = computeExpiry(userInfo?.exp_date);
  const previewCategories = categories
    .filter((c) => c.category_id !== FAVORITES_CATEGORY_ID)
    .slice(0, PREVIEW_CATEGORY_LIMIT);

  const categoryPreviews: CategoryPreview[] = [];
  for (const category of previewCategories) {
    const channels = (await contentService.getLiveStreams(category.category_id)).slice(0, PREVIEW_CHANNEL_LIMIT);
    categoryPreviews.push({
      category_id: category.category_id,
      category_name: category.category_name,
      channels,
    });
  }

  const recent = watchHistoryStore.getRecentlyViewed(RECENT_LIMIT);

  return {
    playlistName: credentials?.username ?? "IPTV",
    expiryLabel: expiryDisplayValue(expiry.urgency, expiry.label),
    expiryUrgency: expiry.urgency,
    liveCategoryCount: categories.filter((c) => c.category_id !== FAVORITES_CATEGORY_ID).length,
    quickPlayChannel,
    favoriteChannels,
    browseCategories: categories.slice(0, 12),
    continueWatching: watchHistoryStore.getContinueWatching(),
    recentlyFinished: watchHistoryStore.getRecentlyFinished(),
    recentLive: recent.filter((e) => e.type === "LIVE").slice(0, RECENT_LIMIT),
    recentMovies: recent.filter((e) => e.type === "MOVIE").slice(0, RECENT_LIMIT),
    recentSeries: recent.filter((e) => e.type === "SERIES_EPISODE").slice(0, RECENT_LIMIT),
    categoryPreviews,
  };
}

export interface SearchResults {
  live: LiveStream[];
  movies: VodStream[];
  series: SeriesItem[];
}

const SEARCH_LIMIT = 40;
const SEARCH_CATEGORY_LIMIT = 4;

export async function searchCatalog(query: string): Promise<SearchResults> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return { live: [], movies: [], series: [] };

  const [liveCats, movieCats, seriesCats] = await Promise.all([
    filterVisibleCategories("live", await contentService.getLiveCategories(), categoryVisibilityStore, false),
    filterVisibleCategories("movies", await contentService.getVodCategories(), categoryVisibilityStore, false),
    filterVisibleCategories("series", await contentService.getSeriesCategories(), categoryVisibilityStore, false),
  ]);

  const [live, movies, series] = await Promise.all([
    searchLive(normalized, liveCats.slice(0, SEARCH_CATEGORY_LIMIT)),
    searchMovies(normalized, movieCats.slice(0, SEARCH_CATEGORY_LIMIT)),
    searchSeries(normalized, seriesCats.slice(0, SEARCH_CATEGORY_LIMIT)),
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
