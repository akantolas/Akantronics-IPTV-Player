import type { AudioTrack, AvPlayApi } from "../types/global.js";

type ProgressCallback = (positionMs: number, durationMs: number) => void;

export type AspectMode = "letterbox" | "full" | "zoom";

const ASPECT_AVPLAY: Record<AspectMode, string> = {
  letterbox: "PLAYER_DISPLAY_MODE_LETTER_BOX",
  full: "PLAYER_DISPLAY_MODE_FULL_SCREEN",
  zoom: "PLAYER_DISPLAY_MODE_CROP",
};

const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 2];

export class AvPlayController {
  private avplay: AvPlayApi | null = null;
  private htmlVideo: HTMLVideoElement | null = null;
  private avplayObject: HTMLObjectElement | null = null;
  private usingAvPlay = false;
  private onEnded: (() => void) | null = null;
  private onProgress: ProgressCallback | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private uiProgressTimer: ReturnType<typeof setInterval> | null = null;
  private playing = false;
  private onUiProgress: ProgressCallback | null = null;
  private onBuffering: ((buffering: boolean) => void) | null = null;
  private activeSubtitleUrl: string | null = null;
  private aspectMode: AspectMode = "letterbox";
  private playbackSpeed = 1;
  private audioTracks: AudioTrack[] = [];
  private lastKnownProgress = { positionMs: 0, durationMs: 0 };

  constructor(private readonly container: HTMLElement) {}

  private getAvPlay(): AvPlayApi | null {
    return window.webapis?.avplay ?? null;
  }

  async open(url: string, title: string, startPositionMs = 0, subtitleUrl?: string | null): Promise<void> {
    this.stop();
    this.lastKnownProgress = {
      positionMs: Math.max(0, startPositionMs),
      durationMs: 0,
    };
    this.activeSubtitleUrl = subtitleUrl ?? null;
    const avplay = this.getAvPlay();
    if (avplay) {
      await this.openAvPlay(avplay, url, startPositionMs);
      return;
    }
    await this.openHtmlVideo(url, title, startPositionMs);
  }

  private openAvPlay(avplay: AvPlayApi, url: string, startPositionMs: number): Promise<void> {
    this.usingAvPlay = true;
    this.avplay = avplay;
    this.ensureAvPlayObject();
    return new Promise((resolve, reject) => {
      try {
        avplay.open(url);
        this.applyAspectMode();
        this.applyDisplayRect();
        avplay.setListener({
          onstreamcompleted: () => this.onEnded?.(),
          onbufferingstart: () => this.onBuffering?.(true),
          onbufferingcomplete: () => this.onBuffering?.(false),
          onerror: () => reject(new Error("AVPlay playback error.")),
        });
        avplay.prepareAsync(
          () => {
            let seekMs = Math.max(0, startPositionMs);
            if (seekMs > 0) {
              try {
                const duration = avplay.getDuration?.();
                if (typeof duration === "number" && duration > 0) {
                  if (seekMs >= duration - 3000 || seekMs > duration) {
                    seekMs = 0;
                  }
                }
              } catch {
                // duration unavailable — attempt seek as requested
              }
              if (seekMs > 0 && "seekTo" in avplay && typeof avplay.seekTo === "function") {
                avplay.seekTo(seekMs);
              }
            }
            this.applyAvPlaySubtitle(this.activeSubtitleUrl);
            this.refreshAudioTracks();
            this.applyPlaybackSpeed();
            avplay.play();
            this.applyDisplayRect();
            requestAnimationFrame(() => this.applyDisplayRect());
            this.playing = true;
            this.startProgressTimer();
            resolve();
          },
          () => reject(new Error("AVPlay prepare failed.")),
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error("AVPlay open failed."));
      }
    });
  }

  private openHtmlVideo(url: string, title: string, startPositionMs: number): Promise<void> {
    this.usingAvPlay = false;
    const video = document.createElement("video");
    video.className = "html-player";
    video.src = url;
    video.playsInline = true;
    video.autoplay = true;
    video.controls = false;
    video.setAttribute("aria-label", title);
    video.addEventListener("ended", () => this.onEnded?.());
    video.addEventListener("waiting", () => this.onBuffering?.(true));
    video.addEventListener("playing", () => this.onBuffering?.(false));
    if (this.activeSubtitleUrl) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.src = this.activeSubtitleUrl;
      track.default = true;
      track.label = "External";
      track.srclang = "el";
      video.appendChild(track);
    }
    if (startPositionMs > 0) {
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = startPositionMs / 1000;
        },
        { once: true },
      );
    }
    this.container.appendChild(video);
    this.htmlVideo = video;
    return video
      .play()
      .then(() => {
        this.playing = true;
        this.refreshAudioTracks();
        this.applyPlaybackSpeed();
        this.startProgressTimer();
      })
      .catch(() => {
        throw new Error("HTML5 playback failed.");
      });
  }

  private startProgressTimer(): void {
    this.progressTimer = setInterval(() => {
      const positionMs = this.getCurrentTimeMs();
      const durationMs = this.getDurationMs();
      this.recordKnownProgress(positionMs, durationMs);
      if (positionMs > 0 || durationMs > 0) {
        this.onProgress?.(positionMs, durationMs);
      }
    }, 10_000);
    this.uiProgressTimer = setInterval(() => {
      const positionMs = this.getCurrentTimeMs();
      const durationMs = this.getDurationMs();
      this.recordKnownProgress(positionMs, durationMs);
      this.onUiProgress?.(positionMs, durationMs);
    }, 1000);
  }

  private recordKnownProgress(positionMs: number, durationMs: number): void {
    if (positionMs > this.lastKnownProgress.positionMs) {
      this.lastKnownProgress.positionMs = positionMs;
    }
    if (durationMs > this.lastKnownProgress.durationMs) {
      this.lastKnownProgress.durationMs = durationMs;
    }
  }

  private pauseIfPlaying(): void {
    if (this.usingAvPlay && this.avplay && this.playing) {
      try {
        this.avplay.pause();
        this.playing = false;
      } catch {
        // ignore
      }
    }
    if (this.htmlVideo && !this.htmlVideo.paused) {
      this.htmlVideo.pause();
      this.playing = false;
    }
  }

  togglePlayPause(): boolean {
    if (this.usingAvPlay && this.avplay) {
      try {
        if (this.playing) {
          this.avplay.pause();
          this.playing = false;
        } else {
          this.avplay.play();
          this.playing = true;
        }
        return this.playing;
      } catch {
        return this.playing;
      }
    }
    if (this.htmlVideo) {
      if (this.htmlVideo.paused) {
        void this.htmlVideo.play();
        this.playing = true;
      } else {
        this.htmlVideo.pause();
        this.playing = false;
      }
      return this.playing;
    }
    return false;
  }

  isPlaying(): boolean {
    if (this.htmlVideo) return !this.htmlVideo.paused;
    return this.playing;
  }

  seek(positionMs: number): void {
    if (this.usingAvPlay && this.avplay?.seekTo) {
      try {
        this.avplay.seekTo(positionMs);
      } catch {
        // ignore
      }
      return;
    }
    if (this.htmlVideo && Number.isFinite(this.htmlVideo.duration)) {
      this.htmlVideo.currentTime = positionMs / 1000;
    }
  }

  setOnBuffering(callback: ((buffering: boolean) => void) | null): void {
    this.onBuffering = callback;
  }

  setSubtitleTrack(trackId: string, tracks: Array<{ id: string; url?: string }>): void {
    const selected = tracks.find((t) => t.id === trackId);
    this.activeSubtitleUrl = selected?.url ?? null;
    if (this.usingAvPlay) {
      if (trackId.startsWith("emb-")) {
        const index = Number(trackId.replace("emb-", ""));
        if (Number.isFinite(index)) {
          try {
            this.avplay?.setSelectTrack?.("TEXT", index);
          } catch {
            // ignore
          }
        }
        return;
      }
      this.applyAvPlaySubtitle(this.activeSubtitleUrl);
      return;
    }
    if (!this.htmlVideo) return;
    for (const trackEl of Array.from(this.htmlVideo.querySelectorAll("track"))) {
      trackEl.remove();
    }
    if (!selected?.url) {
      for (const textTrack of Array.from(this.htmlVideo.textTracks)) {
        textTrack.mode = "disabled";
      }
      return;
    }
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.src = selected.url;
    track.default = true;
    track.label = selected.id;
    this.htmlVideo.appendChild(track);
    this.htmlVideo.addEventListener(
      "loadedmetadata",
      () => {
        for (const textTrack of Array.from(this.htmlVideo!.textTracks)) {
          textTrack.mode = textTrack.label === selected.id ? "showing" : "disabled";
        }
      },
      { once: true },
    );
  }

  getAudioTracks(): AudioTrack[] {
    return this.audioTracks;
  }

  setAudioTrack(trackId: string): void {
    const track = this.audioTracks.find((item) => item.id === trackId);
    if (!track) return;
    if (this.usingAvPlay && this.avplay?.setSelectTrack && track.index !== undefined) {
      try {
        this.avplay.setSelectTrack("AUDIO", track.index);
      } catch {
        // ignore
      }
      return;
    }
    if (this.htmlVideo?.audioTracks) {
      for (let i = 0; i < this.htmlVideo.audioTracks.length; i += 1) {
        this.htmlVideo.audioTracks[i].enabled = this.htmlVideo.audioTracks[i].id === trackId;
      }
    }
  }

  private refreshAudioTracks(): void {
    this.audioTracks = [];
    if (this.usingAvPlay && this.avplay?.getTotalTrackInfo) {
      try {
        const raw = this.avplay.getTotalTrackInfo();
        const parsed = JSON.parse(raw) as Array<{ type?: string; index?: number; language?: string; extra_info?: { language?: string } }>;
        this.audioTracks = parsed
          .filter((item) => item.type === "AUDIO")
          .map((item, index) => ({
            id: `audio-${item.index ?? index}`,
            label: item.language || item.extra_info?.language || `Audio ${index + 1}`,
            index: item.index ?? index,
          }));
      } catch {
        this.audioTracks = [];
      }
      return;
    }
    if (this.htmlVideo?.audioTracks) {
      for (let i = 0; i < this.htmlVideo.audioTracks.length; i += 1) {
        const track = this.htmlVideo.audioTracks[i];
        this.audioTracks.push({
          id: track.id || `audio-${i}`,
          label: track.label || track.language || `Audio ${i + 1}`,
          index: i,
        });
      }
    }
  }

  getAspectMode(): AspectMode {
    return this.aspectMode;
  }

  cycleAspectMode(): AspectMode {
    const order: AspectMode[] = ["letterbox", "full", "zoom"];
    const next = order[(order.indexOf(this.aspectMode) + 1) % order.length];
    this.aspectMode = next;
    this.applyAspectMode();
    return this.aspectMode;
  }

  setAspectMode(mode: AspectMode): void {
    this.aspectMode = mode;
    this.applyAspectMode();
  }

  private applyAspectMode(): void {
    if (!this.usingAvPlay || !this.avplay) return;
    try {
      this.avplay.setDisplayMethod(ASPECT_AVPLAY[this.aspectMode]);
      this.applyDisplayRect();
    } catch {
      // ignore
    }
  }

  getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  cyclePlaybackSpeed(): number {
    const currentIndex = SPEED_STEPS.indexOf(this.playbackSpeed);
    const next = SPEED_STEPS[(currentIndex + 1) % SPEED_STEPS.length];
    this.playbackSpeed = next;
    this.applyPlaybackSpeed();
    return this.playbackSpeed;
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    this.applyPlaybackSpeed();
  }

  private applyPlaybackSpeed(): void {
    if (this.usingAvPlay && this.avplay?.setSpeed) {
      try {
        this.avplay.setSpeed(String(this.playbackSpeed));
      } catch {
        // ignore
      }
    }
    if (this.htmlVideo) {
      this.htmlVideo.playbackRate = this.playbackSpeed;
    }
  }

  getEmbeddedSubtitleTracks(): Array<{ id: string; label: string }> {
    if (this.usingAvPlay && this.avplay?.getTotalTrackInfo) {
      try {
        const raw = this.avplay.getTotalTrackInfo();
        const parsed = JSON.parse(raw) as Array<{ type?: string; index?: number; language?: string }>;
        return parsed
          .filter((item) => item.type === "TEXT")
          .map((item, index) => ({
            id: `emb-${item.index ?? index}`,
            label: item.language || `Υπότιτλοι ${index + 1}`,
          }));
      } catch {
        return [];
      }
    }
    if (this.htmlVideo?.textTracks) {
      return Array.from(this.htmlVideo.textTracks)
        .filter((track) => track.kind === "subtitles" || track.kind === "captions")
        .map((track, index) => ({
          id: track.label || `emb-${index}`,
          label: track.label || track.language || `Υπότιτλοι ${index + 1}`,
        }));
    }
    return [];
  }

  private ensureAvPlayObject(): void {
    this.avplayObject?.remove();
    const object = document.createElement("object");
    object.id = "av-player-object";
    object.className = "avplay-object";
    object.type = "application/avplayer";
    this.container.appendChild(object);
    this.avplayObject = object;
  }

  private applyAvPlaySubtitle(url: string | null): void {
    if (!this.avplay) return;
    try {
      if (!url) {
        this.avplay.setSilentSubtitle?.(true);
        return;
      }
      this.avplay.setExternalSubtitlePath?.(url);
      this.avplay.setSilentSubtitle?.(false);
    } catch {
      // Some Tizen firmware builds expose subtitle APIs but reject external tracks for a given stream.
    }
  }

  setOnUiProgress(callback: ProgressCallback | null): void {
    this.onUiProgress = callback;
  }

  getCurrentTimeMs(): number {
    if (this.usingAvPlay && this.avplay) {
      try {
        return this.avplay.getCurrentTime();
      } catch {
        return 0;
      }
    }
    if (this.htmlVideo) {
      return Math.round(this.htmlVideo.currentTime * 1000);
    }
    return 0;
  }

  getDurationMs(): number {
    if (this.usingAvPlay && this.avplay) {
      try {
        const duration = this.avplay.getDuration?.();
        if (typeof duration === "number" && duration > 0) return duration;
      } catch {
        // ignore
      }
    }
    if (this.htmlVideo && Number.isFinite(this.htmlVideo.duration)) {
      return Math.round(this.htmlVideo.duration * 1000);
    }
    return 0;
  }

  resize(): void {
    if (!this.usingAvPlay || !this.avplay) return;
    this.applyDisplayRect();
  }

  private applyDisplayRect(): void {
    if (!this.avplay) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.round(rect.width || document.documentElement.clientWidth || window.innerWidth || 1920);
    const height = Math.round(rect.height || document.documentElement.clientHeight || window.innerHeight || 1080);
    this.avplay.setDisplayRect(0, 0, width, height);
  }

  stop(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.uiProgressTimer) {
      clearInterval(this.uiProgressTimer);
      this.uiProgressTimer = null;
    }
    if (this.usingAvPlay && this.avplay) {
      try {
        this.avplay.stop();
      } catch {
        // ignore
      }
      try {
        this.avplay.close();
      } catch {
        // ignore
      }
      this.avplay = null;
    }
    if (this.htmlVideo) {
      this.htmlVideo.pause();
      this.htmlVideo.removeAttribute("src");
      this.htmlVideo.load();
      this.htmlVideo.remove();
      this.htmlVideo = null;
    }
    this.avplayObject?.remove();
    this.avplayObject = null;
    this.usingAvPlay = false;
    this.playing = false;
    this.audioTracks = [];
    this.lastKnownProgress = { positionMs: 0, durationMs: 0 };
  }

  setOnEnded(callback: (() => void) | null): void {
    this.onEnded = callback;
  }

  setOnProgress(callback: ProgressCallback | null): void {
    this.onProgress = callback;
  }

  flushProgress(): { positionMs: number; durationMs: number } {
    this.pauseIfPlaying();
    const positionMs = Math.max(this.getCurrentTimeMs(), this.lastKnownProgress.positionMs);
    const durationMs = Math.max(this.getDurationMs(), this.lastKnownProgress.durationMs);
    return { positionMs, durationMs };
  }
}
