import {
  XtreamClient,
  buildStreamUrl,
  type LiveCategory,
  type LiveStream,
  type SeriesCategory,
  type SeriesInfo,
  type SeriesItem,
  type VodCategory,
  type VodInfo,
  type VodStream,
  type XtreamCredentials,
  type XtreamUserInfo,
} from "@tv/xtream-core";
import { createAppFetch } from "./devFetch.js";

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
    return this.requireClient().getLiveCategories();
  }

  async getLiveStreams(categoryId?: string): Promise<LiveStream[]> {
    return this.requireClient().getLiveStreams(categoryId);
  }

  async getVodCategories(): Promise<VodCategory[]> {
    return this.requireClient().getVodCategories();
  }

  async getVodStreams(categoryId?: string): Promise<VodStream[]> {
    return this.requireClient().getVodStreams(categoryId);
  }

  async getSeriesCategories(): Promise<SeriesCategory[]> {
    return this.requireClient().getSeriesCategories();
  }

  async getSeries(categoryId?: string): Promise<SeriesItem[]> {
    return this.requireClient().getSeries(categoryId);
  }

  async getSeriesInfo(seriesId: number): Promise<SeriesInfo> {
    return this.requireClient().getSeriesInfo(seriesId);
  }

  async getVodInfo(vodId: number): Promise<VodInfo> {
    return this.requireClient().getVodInfo(vodId);
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
