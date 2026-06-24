import type { PlayerSession } from "../types/global.js";
import { formatEpgTimeRange } from "../data/epgUtils.js";
import { escapeHtml } from "./focus.js";
import type { SeriesEpisode } from "@tv/xtream-core";

export function formatPlayerTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}

const ASPECT_LABELS: Record<NonNullable<PlayerSession["aspectMode"]>, string> = {
  letterbox: "Fit",
  full: "Fill",
  zoom: "Zoom",
};

const PLAYER_ICONS: Record<string, string> = {
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  rewind10: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" font-size="7" font-weight="700">10</text></svg>`,
  forward10: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" font-size="7" font-weight="700">10</text></svg>`,
  subtitles: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  aspect: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>`,
  speed: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.07 19h18a10 10 0 0 0-8.69-10.43zM10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`,
  sleep: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  epg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>`,
  channels: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-1.41 1.41L9.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12z"/></svg>`,
};

export function playerIcon(name: keyof typeof PLAYER_ICONS): string {
  return PLAYER_ICONS[name] ?? "";
}

function toolbarBtn(id: string, icon: string, label: string, extraClass = ""): string {
  return `
    <button
      id="${id}"
      class="player-toolbar-btn focusable${extraClass ? ` ${extraClass}` : ""}"
      type="button"
      aria-label="${escapeHtml(label)}"
      tabindex="0"
    >
      <span class="player-toolbar-btn__icon">${icon}</span>
      <span class="player-toolbar-btn__label">${escapeHtml(label)}</span>
    </button>
  `;
}

export function renderPlayerLiveNowPill(player: PlayerSession): string {
  const now = player.nowProgramme;
  if (!now) {
    return `<p id="player-live-now" class="player-live-now hint">Δεν υπάρχει διαθέσιμο EPG.</p>`;
  }
  return `
    <p id="player-live-now" class="player-live-now">
      <span class="live-badge live-badge--compact">Τώρα</span>
      <span class="player-live-now__title">${escapeHtml(now.title)}</span>
      <span class="player-live-now__time">${escapeHtml(formatEpgTimeRange(now.start, now.end))}</span>
    </p>
  `;
}

export function renderPlayerChrome(player: PlayerSession): string {
  const isLive = player.watchType === "LIVE";
  const hasSubs = (player.subtitleTracks?.length ?? 0) > 1;
  const hasAudio = (player.audioTracks?.length ?? 0) > 1;
  const aspectLabel = ASPECT_LABELS[player.aspectMode ?? "letterbox"];
  const speedLabel = `${player.playbackSpeed ?? 1}×`;
  const sleepActive = Boolean(player.sleepTimerEndsAtMs && player.sleepTimerEndsAtMs > Date.now());

  const toolbar = [
    hasSubs ? toolbarBtn("player-subtitles", playerIcon("subtitles"), "Υπότιτλοι") : "",
    hasAudio ? toolbarBtn("player-audio", playerIcon("audio"), "Ήχος") : "",
    toolbarBtn("player-aspect", playerIcon("aspect"), aspectLabel),
    !isLive ? toolbarBtn("player-speed", playerIcon("speed"), speedLabel) : "",
    toolbarBtn("player-sleep", playerIcon("sleep"), sleepActive ? "ON" : "Ύπνος", sleepActive ? "is-active" : ""),
    isLive ? toolbarBtn("player-guide", playerIcon("epg"), "EPG") : "",
    isLive ? toolbarBtn("player-browser", playerIcon("channels"), "Κανάλια") : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="player-scrim" aria-hidden="true"></div>
    <div class="player-top-bar">
      <button id="player-back" class="player-icon-btn focusable" type="button" aria-label="Έξοδος" tabindex="0">
        ${playerIcon("back")}
      </button>
      <div class="player-title-block">
        <h1 id="player-title">${escapeHtml(player.title)}</h1>
        ${player.subtitle ? `<p id="player-subtitle" class="player-subtitle">${escapeHtml(player.subtitle)}</p>` : ""}
        ${isLive ? `<span class="live-badge player-live-badge">LIVE</span>` : ""}
        ${isLive ? renderPlayerLiveNowPill(player) : ""}
      </div>
    </div>
    ${
      !isLive
        ? `
      <div class="player-transport-center">
        <button id="player-rewind10" class="player-skip-btn focusable" type="button" aria-label="-10 δευτερόλεπτα" tabindex="0">
          ${playerIcon("rewind10")}
        </button>
        <button id="player-play-pause" class="player-play-btn focusable" type="button" aria-label="Play/Pause" tabindex="0">
          ${playerIcon("pause")}
        </button>
        <button id="player-forward10" class="player-skip-btn focusable" type="button" aria-label="+10 δευτερόλεπτα" tabindex="0">
          ${playerIcon("forward10")}
        </button>
      </div>
    `
        : ""
    }
    ${
      !isLive
        ? `
      <div class="player-progress-wrap" id="player-progress-wrap">
        <div class="player-time-row">
          <span id="player-current">0:00</span>
          <span id="player-remaining">-0:00</span>
        </div>
        <button
          id="player-progress-track"
          class="player-progress-track focusable"
          type="button"
          role="slider"
          aria-valuemin="0"
          aria-valuemax="1000"
          aria-valuenow="0"
          tabindex="0"
        >
          <span class="player-progress-buffer"></span>
          <span class="player-progress-fill" id="player-progress-fill" style="width:0%"></span>
          <span class="player-progress-thumb" id="player-progress-thumb" style="left:0%"></span>
        </button>
      </div>
    `
        : ""
    }
    <div class="player-toolbar">${toolbar}</div>
    <div id="player-trick-toast" class="player-trick-toast hidden" aria-live="polite"></div>
    <div id="player-resume-toast" class="player-resume-toast hidden" aria-live="polite"></div>
  `;
}

export function renderPlayerSidePanelShell(): string {
  return `
    <aside id="player-side-panel" class="player-side-panel hidden" aria-hidden="true">
      <header class="player-side-panel__header">
        <h2 id="player-side-panel-title"></h2>
        <button id="player-side-panel-close" class="player-icon-btn focusable" type="button" aria-label="Κλείσιμο" tabindex="0">×</button>
      </header>
      <div id="player-side-panel-body" class="player-side-panel__body"></div>
    </aside>
    <div id="player-side-panel-backdrop" class="player-side-panel-backdrop hidden" aria-hidden="true"></div>
  `;
}

export function renderSubtitlePanelOptions(
  tracks: NonNullable<PlayerSession["subtitleTracks"]>,
): string {
  return tracks
    .map(
      (track) =>
        `<button class="player-side-option focusable" data-subtitle-id="${escapeHtml(track.id)}" tabindex="0">${escapeHtml(track.label)}</button>`,
    )
    .join("");
}

export function renderAudioPanelOptions(tracks: NonNullable<PlayerSession["audioTracks"]>): string {
  return tracks
    .map(
      (track) =>
        `<button class="player-side-option focusable" data-audio-id="${escapeHtml(track.id)}" tabindex="0">${escapeHtml(track.label)}</button>`,
    )
    .join("");
}

export function renderSleepPanelOptions(): string {
  const options = [
    { min: 15, label: "15 λεπτά" },
    { min: 30, label: "30 λεπτά" },
    { min: 60, label: "60 λεπτά" },
    { min: 90, label: "90 λεπτά" },
    { min: 0, label: "Ανενεργός" },
  ];
  return options
    .map(
      (opt) =>
        `<button class="player-side-option focusable sleep-option" data-sleep-min="${opt.min}" tabindex="0">${escapeHtml(opt.label)}</button>`,
    )
    .join("");
}

export function renderUpNextCard(
  next: SeriesEpisode,
  imageUrl: string | undefined,
  countdownSec: number,
): string {
  const thumb = imageUrl
    ? `<img class="player-up-next__thumb" src="${escapeHtml(imageUrl)}" alt="" />`
    : `<div class="player-up-next__thumb player-up-next__thumb--empty">▶</div>`;
  const progress = ((5 - countdownSec) / 5) * 100;
  return `
    <div id="player-up-next" class="player-up-next">
      ${thumb}
      <div class="player-up-next__body">
        <span class="player-up-next__eyebrow">Επόμενο επεισόδιο</span>
        <strong id="player-up-next-label" class="player-up-next__title">S${next.season} E${next.episode_num} · ${escapeHtml(next.title)}</strong>
        <div class="player-up-next__countdown" aria-hidden="true">
          <svg class="player-up-next__ring" viewBox="0 0 36 36">
            <circle class="player-up-next__ring-bg" cx="18" cy="18" r="15.5" />
            <circle class="player-up-next__ring-fill" cx="18" cy="18" r="15.5" style="stroke-dashoffset:${100 - progress}" />
          </svg>
          <span id="player-up-next-count">${countdownSec}</span>
        </div>
        <div class="player-up-next__actions">
          <button id="player-next-play" class="btn primary focusable" tabindex="0">Αναπαραγωγή</button>
          <button id="player-next-dismiss" class="btn ghost focusable" tabindex="0">Όχι τώρα</button>
        </div>
      </div>
    </div>
  `;
}

export function renderPlayerErrorOverlay(message: string): string {
  return `
    <div id="player-error-overlay" class="player-error-overlay">
      <div class="player-error-card">
        <h2>Σφάλμα αναπαραγωγής</h2>
        <p class="hint">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button id="player-error-retry" class="btn primary focusable" tabindex="0">Επανάληψη</button>
          <button id="player-error-exit" class="btn ghost focusable" tabindex="0">Έξοδος</button>
        </div>
      </div>
    </div>
  `;
}

export function renderResumeToast(positionMs: number): string {
  return `Συνέχεια από ${formatPlayerTime(positionMs)}`;
}
