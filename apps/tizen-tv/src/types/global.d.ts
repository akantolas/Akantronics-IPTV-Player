export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

declare global {
  interface Window {
    APP_CONFIG?: Partial<AppConfig>;
    webapis?: {
      avplay?: AvPlayApi;
    };
  }
}

export interface AvPlayApi {
  open(url: string): void;
  close(): void;
  prepareAsync(
    success?: () => void,
    error?: (err: AvPlayError) => void,
  ): void;
  setDisplayRect(x: number, y: number, width: number, height: number): void;
  play(): void;
  stop(): void;
  pause(): void;
  getState(): string;
  getCurrentTime(): number;
  setDisplayMethod(mode: string): void;
  seekTo?(positionMs: number): void;
  setListener(callback: AvPlayListener): void;
}

export interface AvPlayError {
  name?: string;
  message?: string;
}

export interface AvPlayListener {
  oncurrentplaytime?(currentTime: number): void;
  onbufferingstart?(): void;
  onbufferingcomplete?(): void;
  onstreamcompleted?(): void;
  onevent?(eventType: string, eventData: string): void;
  onerror?(eventType: string): void;
}

export type ScreenId =
  | "login"
  | "home"
  | "live"
  | "movies"
  | "series"
  | "search"
  | "detail"
  | "player"
  | "settings";

export interface SubtitleTrack {
  id: string;
  label: string;
  url?: string;
}

export interface PlayerSession {
  url: string;
  title: string;
  subtitle?: string;
  watchId?: string;
  watchType?: "LIVE" | "MOVIE" | "SERIES_EPISODE";
  startPositionMs?: number;
  streamId?: string;
  containerExtension?: string;
  seriesId?: number;
  season?: number;
  episodeId?: string;
  imageUrl?: string;
  subtitleTracks?: SubtitleTrack[];
  seriesInfo?: import("@tv/xtream-core").SeriesInfo;
}

export interface DetailContext {
  kind: "movie" | "series" | "live";
  id: number;
  title: string;
  imageUrl?: string;
  subtitle?: string;
  extension?: string;
  categoryId?: string;
  categoryLabel?: string;
  seriesInfo?: import("@tv/xtream-core").SeriesInfo;
  vodInfo?: import("@tv/xtream-core").VodInfo;
}

export interface PendingBrowse {
  section: "live" | "movies" | "series";
  categoryId?: string;
}

export {};
