import type { AvPlayApi } from "../types/global.js";

type ProgressCallback = (positionMs: number, durationMs: number) => void;

export class AvPlayController {
  private avplay: AvPlayApi | null = null;
  private htmlVideo: HTMLVideoElement | null = null;
  private usingAvPlay = false;
  private onEnded: (() => void) | null = null;
  private onProgress: ProgressCallback | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private uiProgressTimer: ReturnType<typeof setInterval> | null = null;
  private playing = false;
  private onUiProgress: ProgressCallback | null = null;
  private onBuffering: ((buffering: boolean) => void) | null = null;
  private activeSubtitleUrl: string | null = null;

  constructor(private readonly container: HTMLElement) {}

  private getAvPlay(): AvPlayApi | null {
    return window.webapis?.avplay ?? null;
  }

  async open(url: string, title: string, startPositionMs = 0, subtitleUrl?: string | null): Promise<void> {
    this.stop();
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
    const rect = this.container.getBoundingClientRect();
    return new Promise((resolve, reject) => {
      try {
        avplay.open(url);
        avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
        avplay.setDisplayRect(0, 0, Math.round(rect.width), Math.round(rect.height));
        avplay.setListener({
          onstreamcompleted: () => this.onEnded?.(),
          onbufferingstart: () => this.onBuffering?.(true),
          onbufferingcomplete: () => this.onBuffering?.(false),
          onerror: () => reject(new Error("AVPlay playback error.")),
        });
        avplay.prepareAsync(
          () => {
            if (startPositionMs > 0 && "seekTo" in avplay && typeof avplay.seekTo === "function") {
              avplay.seekTo(startPositionMs);
            }
            avplay.play();
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
      if (positionMs > 0 || durationMs > 0) {
        this.onProgress?.(positionMs, durationMs);
      }
    }, 10_000);
    this.uiProgressTimer = setInterval(() => {
      const positionMs = this.getCurrentTimeMs();
      const durationMs = this.getDurationMs();
      this.onUiProgress?.(positionMs, durationMs);
    }, 1000);
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
    if (!this.htmlVideo) return;
    for (const trackEl of Array.from(this.htmlVideo.querySelectorAll("track"))) {
      trackEl.remove();
    }
    this.htmlVideo.querySelectorAll("track").forEach((t) => t.remove());
    const selected = tracks.find((t) => t.id === trackId);
    if (!selected?.url) {
      for (const textTrack of Array.from(this.htmlVideo.textTracks)) {
        textTrack.mode = "disabled";
      }
      this.activeSubtitleUrl = null;
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
    this.activeSubtitleUrl = selected.url;
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
        const duration = (this.avplay as AvPlayApi & { getDuration?: () => number }).getDuration?.();
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
    const rect = this.container.getBoundingClientRect();
    this.avplay.setDisplayRect(0, 0, Math.round(rect.width), Math.round(rect.height));
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
    this.usingAvPlay = false;
    this.playing = false;
  }

  setOnEnded(callback: (() => void) | null): void {
    this.onEnded = callback;
  }

  setOnProgress(callback: ProgressCallback | null): void {
    this.onProgress = callback;
  }

  flushProgress(): { positionMs: number; durationMs: number } {
    return {
      positionMs: this.getCurrentTimeMs(),
      durationMs: this.getDurationMs(),
    };
  }
}
