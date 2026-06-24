import type { EpgProgram, VodInfo } from "../data/contentService.js";

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

declare global {
  interface Window {
    APP_CONFIG?: Partial<AppConfig>;
    webapis?: {
      avplay?: AvPlayApi;
      tvinputdevice?: {
        registerKey?(keyName: string): void;
      };
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
  getDuration?(): number;
  setDisplayMethod(mode: string): void;
  seekTo?(positionMs: number): void;
  setExternalSubtitlePath?(url: string): void;
  setSilentSubtitle?(silent: boolean): void;
  setSpeed?(speed: string): void;
  getTotalTrackInfo?(): string;
  setSelectTrack?(trackType: string, trackIndex: number): void;
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
  | "settings"
  | "epgGuide";

export interface SubtitleTrack {
  id: string;
  label: string;
  url?: string;
}

export interface AudioTrack {
  id: string;
  label: string;
  index?: number;
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
  audioTracks?: AudioTrack[];
  seriesInfo?: import("@tv/xtream-core").SeriesInfo;
  fallbackUrls?: string[];
  zapChannels?: import("@tv/xtream-core").LiveStream[];
  liveCategoryId?: string;
  nowProgramme?: import("../data/contentService.js").EpgProgram;
  nextProgramme?: import("../data/contentService.js").EpgProgram;
  aspectMode?: "letterbox" | "full" | "zoom";
  playbackSpeed?: number;
  sleepTimerEndsAtMs?: number;
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
  vodInfo?: VodInfo;
  epg?: EpgProgram[];
  epgLoaded?: boolean;
  activeSeason?: string;
  focusEpisodeId?: string;
}

export interface PendingBrowse {
  section: "live" | "movies" | "series";
  categoryId?: string;
}

export {};
