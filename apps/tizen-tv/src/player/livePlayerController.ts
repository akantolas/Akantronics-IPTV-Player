import type { LiveStream } from "@tv/xtream-core";
import { contentService } from "../data/contentService.js";
import { favoritesStore } from "../data/favoritesStore.js";
import { watchHistoryStore } from "../data/watchHistory.js";
import type { PlayerSession } from "../types/global.js";

export interface ZapOverlayState {
  channelName: string;
  channelIndex: number;
  totalChannels: number;
  channelIcon?: string;
  epgNowTitle?: string;
  visible: boolean;
}

export interface LivePlayerState {
  zapChannels: LiveStream[];
  activeIndex: number;
  showChannelBrowser: boolean;
  numericInputBuffer: string;
  zapOverlay: ZapOverlayState | null;
  liveCategoryId?: string;
}

export class LivePlayerController {
  state: LivePlayerState = {
    zapChannels: [],
    activeIndex: 0,
    showChannelBrowser: false,
    numericInputBuffer: "",
    zapOverlay: null,
  };

  private overlayTimer: ReturnType<typeof setTimeout> | null = null;
  private numericTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: (() => void) | null = null;
  private onSwitchChannel: ((session: PlayerSession) => void) | null = null;

  setCallbacks(onStateChange: () => void, onSwitchChannel: (session: PlayerSession) => void): void {
    this.onStateChange = onStateChange;
    this.onSwitchChannel = onSwitchChannel;
  }

  init(session: PlayerSession): void {
    const channels = session.zapChannels ?? [];
    const streamId = Number(session.streamId ?? 0);
    const index = channels.findIndex((channel) => channel.stream_id === streamId);
    this.state = {
      zapChannels: channels,
      activeIndex: index >= 0 ? index : 0,
      showChannelBrowser: false,
      numericInputBuffer: "",
      zapOverlay: null,
      liveCategoryId: session.liveCategoryId,
    };
  }

  get canZap(): boolean {
    return this.state.zapChannels.length > 1;
  }

  private notify(): void {
    this.onStateChange?.();
  }

  zapNext(): boolean {
    if (!this.canZap) return false;
    const next = (this.state.activeIndex + 1) % this.state.zapChannels.length;
    return this.selectIndex(next);
  }

  zapPrevious(): boolean {
    if (!this.canZap) return false;
    const prev = (this.state.activeIndex - 1 + this.state.zapChannels.length) % this.state.zapChannels.length;
    return this.selectIndex(prev);
  }

  toggleBrowser(): void {
    if (this.state.zapChannels.length === 0) return;
    this.state.showChannelBrowser = !this.state.showChannelBrowser;
    if (!this.state.showChannelBrowser) {
      this.state.numericInputBuffer = "";
    }
    this.notify();
  }

  dismissBrowser(): boolean {
    if (!this.state.showChannelBrowser) return false;
    this.state.showChannelBrowser = false;
    this.state.numericInputBuffer = "";
    this.notify();
    return true;
  }

  onNumericDigit(digit: number): void {
    if (this.state.zapChannels.length === 0) return;
    if (!this.state.showChannelBrowser) {
      this.state.showChannelBrowser = true;
    }
    if (this.state.numericInputBuffer.length >= 4) return;
    this.state.numericInputBuffer += String(digit);
    if (this.numericTimer) clearTimeout(this.numericTimer);
    this.numericTimer = setTimeout(() => this.confirmNumeric(), 2000);
    this.notify();
  }

  confirmNumeric(): boolean {
    const buffer = this.state.numericInputBuffer.trim();
    this.state.numericInputBuffer = "";
    if (this.numericTimer) {
      clearTimeout(this.numericTimer);
      this.numericTimer = null;
    }
    if (!buffer) return false;
    const channelNumber = Number(buffer);
    if (!Number.isFinite(channelNumber) || channelNumber < 1) return false;
    return this.selectIndex(channelNumber - 1);
  }

  selectIndex(index: number): boolean {
    if (index < 0 || index >= this.state.zapChannels.length) return false;
    const stream = this.state.zapChannels[index];
    if (!stream) return false;
    this.state.activeIndex = index;
    this.showZapOverlay(stream.name, index, stream.stream_icon);
    this.onSwitchChannel?.(this.buildSessionForChannel(stream));
    return true;
  }

  buildSessionForChannel(stream: LiveStream): PlayerSession {
    return {
      url: contentService.buildLiveUrl(stream.stream_id),
      title: stream.name,
      watchType: "LIVE",
      watchId: `live_${stream.stream_id}`,
      streamId: String(stream.stream_id),
      imageUrl: stream.stream_icon,
      fallbackUrls: contentService.buildLiveFallbackUrls(stream.stream_id),
      zapChannels: this.state.zapChannels,
      liveCategoryId: this.state.liveCategoryId ?? stream.category_id,
      startPositionMs: 0,
    };
  }

  private showZapOverlay(channelName: string, index: number, channelIcon?: string): void {
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    this.state.zapOverlay = {
      channelName,
      channelIndex: index + 1,
      totalChannels: this.state.zapChannels.length,
      channelIcon,
      visible: true,
    };
    this.notify();
    this.overlayTimer = setTimeout(() => {
      if (this.state.zapOverlay) {
        this.state.zapOverlay = { ...this.state.zapOverlay, visible: false };
        this.notify();
      }
    }, 2500);
  }

  reset(): void {
    if (this.overlayTimer) clearTimeout(this.overlayTimer);
    if (this.numericTimer) clearTimeout(this.numericTimer);
    this.overlayTimer = null;
    this.numericTimer = null;
    this.state = {
      zapChannels: [],
      activeIndex: 0,
      showChannelBrowser: false,
      numericInputBuffer: "",
      zapOverlay: null,
    };
  }
}

export async function resolveZapChannels(
  categoryId: string | undefined,
  currentStreamId: number,
  currentTitle = "",
  currentIcon = "",
): Promise<LiveStream[]> {
  if (categoryId) {
    const channels = await contentService.getLiveStreams(categoryId);
    if (channels.length > 0) return channels;
  }

  const seen = new Set<number>();
  const result: LiveStream[] = [];

  for (const fav of favoritesStore.byKind("LIVE")) {
    if (!fav.streamId || seen.has(fav.streamId)) continue;
    seen.add(fav.streamId);
    result.push({
      num: 0,
      name: fav.title,
      stream_type: "live",
      stream_id: fav.streamId,
      stream_icon: fav.imageUrl ?? "",
      category_id: fav.categoryId ?? "",
    });
  }

  for (const entry of watchHistoryStore.getRecentlyViewed(50)) {
    if (entry.type !== "LIVE") continue;
    const id = Number(entry.streamId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      num: 0,
      name: entry.title,
      stream_type: "live",
      stream_id: id,
      stream_icon: entry.imageUrl ?? "",
      category_id: "",
    });
  }

  if (currentStreamId && !seen.has(currentStreamId)) {
    result.unshift({
      num: 0,
      name: currentTitle,
      stream_type: "live",
      stream_id: currentStreamId,
      stream_icon: currentIcon,
      category_id: categoryId ?? "",
    });
  }

  return result;
}
