import { buildPlayerApiUrl } from "./urls.js";
import type {
  LiveCategory,
  LiveStream,
  SeriesCategory,
  SeriesInfo,
  SeriesItem,
  VodCategory,
  VodStream,
  XtreamCredentials,
  XtreamUserInfo,
} from "./types.js";

export class XtreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "XtreamError";
  }
}

type FetchLike = typeof fetch;

export class XtreamClient {
  constructor(
    private readonly credentials: XtreamCredentials,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  get credentialsSnapshot(): XtreamCredentials {
    return { ...this.credentials };
  }

  async authenticate(): Promise<XtreamUserInfo> {
    const url = buildPlayerApiUrl(this.credentials);
    const response = await this.request(url);
    const data = (await response.json()) as XtreamUserInfo;
    if (data.auth === 0) {
      throw new XtreamError("Invalid username or password.");
    }
    return data;
  }

  async getLiveCategories(): Promise<LiveCategory[]> {
    return this.fetchAction("get_live_categories");
  }

  async getLiveStreams(categoryId?: string): Promise<LiveStream[]> {
    return this.fetchAction(
      "get_live_streams",
      categoryId ? { category_id: categoryId } : {},
    );
  }

  async getVodCategories(): Promise<VodCategory[]> {
    return this.fetchAction("get_vod_categories");
  }

  async getVodStreams(categoryId?: string): Promise<VodStream[]> {
    return this.fetchAction(
      "get_vod_streams",
      categoryId ? { category_id: categoryId } : {},
    );
  }

  async getSeriesCategories(): Promise<SeriesCategory[]> {
    return this.fetchAction("get_series_categories");
  }

  async getSeries(categoryId?: string): Promise<SeriesItem[]> {
    return this.fetchAction(
      "get_series",
      categoryId ? { category_id: categoryId } : {},
    );
  }

  async getSeriesInfo(seriesId: number | string): Promise<SeriesInfo> {
    return this.fetchAction("get_series_info", {
      series_id: String(seriesId),
    });
  }

  private async fetchAction<T>(
    action: string,
    extraParams: Record<string, string> = {},
  ): Promise<T> {
    const url = buildPlayerApiUrl(this.credentials, action, extraParams);
    const response = await this.request(url);
    return (await response.json()) as T;
  }

  private async request(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new XtreamError(
        "Cannot reach server. Check URL, port, and network.",
      );
    }

    if (!response.ok) {
      throw new XtreamError(
        `Server responded with HTTP ${response.status}.`,
        response.status,
      );
    }
    return response;
  }
}
