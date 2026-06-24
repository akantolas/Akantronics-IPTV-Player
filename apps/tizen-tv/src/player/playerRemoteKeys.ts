import { isRemoteBack } from "../ui/focus.js";

const PLAYER_REMOTE_KEYS = [
  "MediaPlayPause",
  "MediaPlay",
  "MediaPause",
  "MediaRewind",
  "MediaFastForward",
  "ChannelUp",
  "ChannelDown",
  "Menu",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "ColorF0Red",
  "ColorF1Green",
  "ColorF2Yellow",
  "ColorF3Blue",
] as const;

const WAKE_DEBOUNCE_MS = 250;

export function registerPlayerRemoteKeys(): void {
  try {
    for (const key of PLAYER_REMOTE_KEYS) {
      window.webapis?.tvinputdevice?.registerKey?.(key);
    }
  } catch {
    // Basic arrows/OK/back still work without explicit media key registration.
  }
}

export interface PlayerKeyContext {
  isLive: boolean;
  isBrowserOpen: () => boolean;
  isSidePanelOpen: () => boolean;
  isUpNextOpen: () => boolean;
  isProgressFocused: () => boolean;
  isChromeVisible: () => boolean;
  wakePlayerChrome: () => void;
  exitPlayer: () => void;
  onBack: () => boolean;
  onExitPlayer: () => void;
  onZapNext: () => void;
  onZapPrev: () => void;
  onToggleBrowser: () => void;
  onNumeric: (digit: number) => void;
  onConfirmNumeric: () => void;
  onSeekForward: () => void;
  onSeekBack: () => void;
  onScrubForward: () => void;
  onScrubBack: () => void;
  onTogglePlayPause: () => void;
  onOpenGuide?: () => void;
}

function keyCode(event: KeyboardEvent): number | undefined {
  return (event as KeyboardEvent & { keyCode?: number }).keyCode;
}

function digitFromEvent(event: KeyboardEvent): number | null {
  if (event.key >= "0" && event.key <= "9") return Number(event.key);
  const code = keyCode(event);
  const colorMap: Record<number, number> = {
    403: 1,
    404: 2,
    405: 3,
    406: 4,
    407: 5,
    408: 6,
    409: 7,
    410: 8,
    411: 9,
    412: 0,
  };
  if (code !== undefined && code in colorMap) return colorMap[code];
  if (code !== undefined && code >= 48 && code <= 57) return code - 48;
  return null;
}

export function createPlayerKeyHandler(ctx: PlayerKeyContext): (event: KeyboardEvent) => void {
  let lastWakeAt = 0;

  const wakeChrome = (): void => {
    const now = Date.now();
    if (ctx.isChromeVisible() && now - lastWakeAt < WAKE_DEBOUNCE_MS) return;
    lastWakeAt = now;
    ctx.wakePlayerChrome();
  };

  return (event: KeyboardEvent): void => {
    const code = keyCode(event);
    const isUp = event.key === "ArrowUp" || code === 38 || event.key === "ChannelUp" || code === 427;
    const isDown = event.key === "ArrowDown" || code === 40 || event.key === "ChannelDown" || code === 428;
    const isLeft = event.key === "ArrowLeft" || code === 37;
    const isRight = event.key === "ArrowRight" || code === 39;
    const isMenu = event.key === "Menu" || code === 18 || code === 457;
    const isOk = event.key === "Enter" || code === 13;
    const isPlayPause = event.key === "MediaPlayPause" || code === 10252;
    const isPlay = event.key === "MediaPlay" || code === 415;
    const isPause = event.key === "MediaPause" || code === 19;
    const isRewind = event.key === "MediaRewind" || code === 412;
    const isFastForward = event.key === "MediaFastForward" || code === 417;
    const isGuide = event.key === "Guide" || code === 458;

    if (isRemoteBack(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (!ctx.onBack()) {
        ctx.onExitPlayer();
      }
      return;
    }

    const digit = digitFromEvent(event);
    if (digit !== null && ctx.isLive) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onNumeric(digit);
      wakeChrome();
      return;
    }

    if (ctx.isLive && isUp) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onZapPrev();
      wakeChrome();
      return;
    }

    if (ctx.isLive && isDown) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onZapNext();
      wakeChrome();
      return;
    }

    if (ctx.isLive && (isLeft || isMenu)) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onToggleBrowser();
      wakeChrome();
      return;
    }

    if (ctx.isLive && isGuide) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onOpenGuide?.();
      wakeChrome();
      return;
    }

    if (ctx.isBrowserOpen() && isOk) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onConfirmNumeric();
      wakeChrome();
      return;
    }

    if (!ctx.isChromeVisible() && !ctx.isLive && (isUp || isDown || isMenu)) {
      event.preventDefault();
      event.stopPropagation();
      wakeChrome();
      return;
    }

    if (isLeft || isRight || isRewind || isFastForward) {
      if (!ctx.isLive) {
        if (ctx.isChromeVisible() && !ctx.isProgressFocused()) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (ctx.isProgressFocused()) {
          if (isRight || isFastForward) ctx.onScrubForward();
          else ctx.onScrubBack();
        } else if (isRight || isFastForward) {
          ctx.onSeekForward();
        } else {
          ctx.onSeekBack();
        }
        wakeChrome();
      }
      return;
    }

    if (isOk) {
      event.preventDefault();
      event.stopPropagation();
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.id === "player-back") {
        ctx.exitPlayer();
        return;
      }
      const chrome = document.querySelector<HTMLElement>("#player-chrome");
      if (
        ctx.isChromeVisible() &&
        chrome &&
        active instanceof HTMLButtonElement &&
        chrome.contains(active)
      ) {
        active.click();
      }
      wakeChrome();
      return;
    }

    if (isPlayPause || isPlay || isPause) {
      event.preventDefault();
      event.stopPropagation();
      ctx.onTogglePlayPause();
      wakeChrome();
    }
  };
}
