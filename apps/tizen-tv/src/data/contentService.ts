import {
  XtreamClient,
  buildPlayerApiUrl,
  buildStreamUrl,
  buildXmltvUrl,
  normalizeServerUrl,
  type LiveCategory,
  type LiveStream,
  type SeriesCategory,
  type SeriesInfo,
  type SeriesItem,
  type VodCategory,
  type VodStream,
  type XtreamCredentials,
  type XtreamUserInfo,
} from "@tv/xtream-core";
import { createAppFetch } from "./devFetch.js";
import { cacheRemember, clearAppCache, clearCacheKeysMatching } from "./cacheStore.js";

export interface VodInfo {
  info: {
    name?: string;
    cover_big?: string;
    movie_image?: string;
    plot?: string;
    description?: string;
    director?: string;
    cast?: string;
    genre?: string;
    rating?: string;
    releasedate?: string;
    release_date?: string;
    duration?: string;
    subtitles?: unknown;
  };
  movie_data?: {
    stream_id?: number;
    name?: string;
    container_extension?: string;
  };
}

export interface EpgProgram {
  id?: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  channelId?: string;
}

export interface XmltvProgram extends EpgProgram {
  channelId: string;
}

interface XtreamEpgItem {
  id?: string;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  start_timestamp?: string | number;
  stop_timestamp?: string | number;
}

interface XtreamShortEpgResponse {
  epg_listings?: XtreamEpgItem[];
}

const CACHE_TTL = {
  categories: 12 * 60 * 60 * 1000,
  lists: 20 * 60 * 1000,
  detail: 6 * 60 * 60 * 1000,
  epg: 2 * 60 * 1000,
  xmltv: 45 * 60 * 1000,
};

export class ContentService {
  private client: XtreamClient | null = null;
  private readonly fetchImpl = createAppFetch();
  private userInfo: XtreamUserInfo | null = null;

  setCredentials(credentials: XtreamCredentials | null): void {
    this.client = credentials ? new XtreamClient(credentials, this.fetchImpl) : null;
    if (!credentials) this.userInfo = null;
  }

  private requireClient(): XtreamClient {
    if (!this.client) throw new Error("Δεν υπάρχουν credentials IPTV.");
    return this.client;
  }

  private requireCredentials(): XtreamCredentials {
    return this.requireClient().credentialsSnapshot;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new Error("Cannot reach server. Check URL, port, and network.");
    }
    if (!response.ok) {
      throw new Error(`Server responded with HTTP ${response.status}.`);
    }
    return (await response.json()) as T;
  }

  async authenticate(credentials: XtreamCredentials): Promise<void> {
    const client = new XtreamClient(credentials, this.fetchImpl);
    this.userInfo = await client.authenticate();
    this.client = client;
  }

  getCredentials(): XtreamCredentials | null {
    return this.client?.credentialsSnapshot ?? null;
  }

  getUserInfo(): XtreamUserInfo | null {
    return this.userInfo;
  }

  async getLiveCategories(): Promise<LiveCategory[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "live-categories"), CACHE_TTL.categories, () =>
      this.requireClient().getLiveCategories(),
    );
  }

  async getLiveStreams(categoryId?: string): Promise<LiveStream[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "live-streams", categoryId ?? "all"), CACHE_TTL.lists, () =>
      this.requireClient().getLiveStreams(categoryId),
    );
  }

  async getVodCategories(): Promise<VodCategory[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "vod-categories"), CACHE_TTL.categories, () =>
      this.requireClient().getVodCategories(),
    );
  }

  async getVodStreams(categoryId?: string): Promise<VodStream[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "vod-streams", categoryId ?? "all"), CACHE_TTL.lists, () =>
      this.requireClient().getVodStreams(categoryId),
    );
  }

  async getSeriesCategories(): Promise<SeriesCategory[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "series-categories"), CACHE_TTL.categories, () =>
      this.requireClient().getSeriesCategories(),
    );
  }

  async getSeries(categoryId?: string): Promise<SeriesItem[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "series", categoryId ?? "all"), CACHE_TTL.lists, () =>
      this.requireClient().getSeries(categoryId),
    );
  }

  async getSeriesInfo(seriesId: number): Promise<SeriesInfo> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "series-info", String(seriesId)), CACHE_TTL.detail, () =>
      this.requireClient().getSeriesInfo(seriesId),
    );
  }

  async getVodInfo(vodId: number): Promise<VodInfo> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "vod-info", String(vodId)), CACHE_TTL.detail, () =>
      this.fetchJson<VodInfo>(
        buildPlayerApiUrl(credentials, "get_vod_info", {
          vod_id: String(vodId),
        }),
      ),
    );
  }

  async getShortEpg(streamId: number, limit = 4): Promise<EpgProgram[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "short-epg", String(streamId)), CACHE_TTL.epg, async () => {
      const data = await this.fetchJson<XtreamShortEpgResponse>(
        buildPlayerApiUrl(credentials, "get_short_epg", {
          stream_id: String(streamId),
          limit: String(limit),
        }),
      );
      return (data.epg_listings ?? []).map(normalizeEpg).filter((item): item is EpgProgram => Boolean(item));
    });
  }

  async loadXmltvPrograms(): Promise<XmltvProgram[]> {
    const credentials = this.requireCredentials();
    return cacheRemember(cacheKey(credentials, "xmltv"), CACHE_TTL.xmltv, async () => {
      const url = buildXmltvUrl(credentials);
      let response: Response;
      try {
        response = await this.fetchImpl(url, { method: "GET" });
      } catch {
        throw new Error("Cannot reach XMLTV endpoint.");
      }
      if (!response.ok) {
        throw new Error(`XMLTV responded with HTTP ${response.status}.`);
      }
      const xml = await response.text();
      return parseXmltv(xml);
    });
  }

  async getShortEpgBatch(streamIds: number[], limit = 10): Promise<Map<number, EpgProgram[]>> {
    const results = new Map<number, EpgProgram[]>();
    const batchSize = 6;
    for (let i = 0; i < streamIds.length; i += batchSize) {
      const batch = streamIds.slice(i, i + batchSize);
      const entries = await Promise.all(
        batch.map(async (streamId) => {
          try {
            return [streamId, await this.getShortEpg(streamId, limit)] as const;
          } catch {
            return [streamId, []] as const;
          }
        }),
      );
      for (const [streamId, epg] of entries) {
        results.set(streamId, epg);
      }
    }
    return results;
  }

  async healthCheck(): Promise<void> {
    await this.fetchJson<XtreamUserInfo>(buildPlayerApiUrl(this.requireCredentials()));
  }

  clearCache(): void {
    clearAppCache();
  }

  clearEpgCache(): void {
    clearCacheKeysMatching((key) => key.includes("short-epg") || key.includes("xmltv"));
  }

  buildMovieFallbackUrls(streamId: number, extension: string): string[] {
    const credentials = this.requireCredentials();
    const extensions = unique([extension || "mp4", "mkv", "mp4", "avi", "ts"]);
    return extensions.map((ext) => buildStreamUrl(credentials, "movie", streamId, ext));
  }

  buildEpisodeFallbackUrls(episodeId: string, extension: string): string[] {
    const credentials = this.requireCredentials();
    const extensions = unique([extension || "mp4", "mkv", "mp4", "avi", "ts"]);
    return extensions.map((ext) => buildStreamUrl(credentials, "series", episodeId, ext));
  }

  buildLiveFallbackUrls(streamId: number): string[] {
    const credentials = this.requireCredentials();
    const base = normalizeServerUrl(credentials.serverUrl);
    return unique([
      buildStreamUrl(credentials, "live", streamId, "ts"),
      `${base}/live/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${streamId}.m3u8`,
    ]);
  }

  buildLiveUrl(streamId: number): string {
    const credentials = this.requireClient().credentialsSnapshot;
    return buildStreamUrl(credentials, "live", streamId, "ts");
  }

  buildMovieUrl(streamId: number, extension: string): string {
    const credentials = this.requireClient().credentialsSnapshot;
    return buildStreamUrl(credentials, "movie", streamId, extension || "mp4");
  }

  buildEpisodeUrl(episodeId: string, extension: string): string {
    const credentials = this.requireClient().credentialsSnapshot;
    return buildStreamUrl(credentials, "series", episodeId, extension || "mp4");
  }
}

export const contentService = new ContentService();

function cacheKey(credentials: XtreamCredentials, ...parts: string[]): string {
  return [credentials.serverUrl, credentials.username, ...parts].join("|");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEpg(item: XtreamEpgItem): EpgProgram | null {
  const start = Number(item.start_timestamp ?? 0) * 1000 || Date.parse(item.start ?? "");
  const end = Number(item.stop_timestamp ?? 0) * 1000 || Date.parse(item.end ?? "");
  const title = decodeMaybeBase64(item.title ?? "").trim();
  if (!title || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    id: item.id,
    title,
    description: decodeMaybeBase64(item.description ?? "").trim() || undefined,
    start,
    end,
  };
}

function decodeMaybeBase64(value: string): string {
  try {
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0) {
      return decodeURIComponent(
        Array.from(atob(value))
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      );
    }
  } catch {
    // Plain text EPG fields are common.
  }
  return value;
}

function parseXmltvDate(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s([+-]\d{4}))?$/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  }
  return Date.parse(trimmed);
}

function parseXmltv(xml: string): XmltvProgram[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const programmes = Array.from(doc.querySelectorAll("programme"));
  const results: XmltvProgram[] = [];
  for (const node of programmes) {
    const channelId = node.getAttribute("channel") ?? "";
    const start = parseXmltvDate(node.getAttribute("start") ?? "");
    const stop = parseXmltvDate(node.getAttribute("stop") ?? "");
    const title = decodeMaybeBase64(node.querySelector("title")?.textContent ?? "").trim();
    const description = decodeMaybeBase64(node.querySelector("desc")?.textContent ?? "").trim();
    if (!channelId || !title || !Number.isFinite(start) || !Number.isFinite(stop)) continue;
    results.push({
      channelId,
      title,
      description: description || undefined,
      start,
      end: stop,
    });
  }
  return results;
}
