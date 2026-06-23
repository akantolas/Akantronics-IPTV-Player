import type { PlayerSession } from "../types/global.js";
import { escapeHtml } from "../ui/focus.js";

export function renderPlayerScreen(player: PlayerSession): string {
  const isLive = player.watchType === "LIVE";
  const hasSubs = (player.subtitleTracks?.length ?? 0) > 1;
  const subOptions =
    player.subtitleTracks
      ?.map(
        (track) =>
          `<button class="subtitle-option focusable" data-subtitle-id="${escapeHtml(track.id)}" tabindex="0">${escapeHtml(track.label)}</button>`,
      )
      .join("") ?? "";

  return `
    <section class="player-page">
      <div id="player-container" class="player-container"></div>
      <div id="player-chrome" class="player-chrome">
        <div class="player-top">
          ${isLive ? `<span class="live-badge">LIVE</span>` : ""}
          <h1>${escapeHtml(player.title)}</h1>
          ${player.subtitle ? `<p>${escapeHtml(player.subtitle)}</p>` : ""}
        </div>
        <div class="player-center">
          <button id="player-play-pause" class="player-control-btn focusable" tabindex="0" aria-label="Play/Pause">⏸</button>
        </div>
        <div class="player-bottom ${isLive ? "hidden" : ""}" id="player-seek-wrap">
          <input id="player-seek" class="player-seek focusable" type="range" min="0" max="1000" value="0" tabindex="0" />
          <div class="player-time">
            <span id="player-current">0:00</span>
            <span>/</span>
            <span id="player-duration">0:00</span>
          </div>
        </div>
        <div class="player-actions">
          ${hasSubs ? `<button id="player-subtitles" class="btn ghost focusable" tabindex="0">CC</button>` : ""}
        </div>
        <p class="hint player-hint">OK για controls · Back για έξοδο</p>
      </div>
      <div id="player-subtitle-menu" class="modal hidden">
        <div class="modal-card">
          <h2>Υπότιτλοι</h2>
          <div class="subtitle-options">${subOptions}</div>
        </div>
      </div>
      <div id="player-next-dialog" class="modal hidden">
        <div class="modal-card">
          <h2>Επόμενο επεισόδιο;</h2>
          <p id="player-next-label" class="hint"></p>
          <div class="modal-actions">
            <button id="player-next-play" class="btn primary focusable" tabindex="0">Αναπαραγωγή</button>
            <button id="player-next-dismiss" class="btn ghost focusable" tabindex="0">Όχι τώρα</button>
          </div>
        </div>
      </div>
      <div id="player-buffering" class="player-buffering hidden"><div class="spinner"></div></div>
    </section>
  `;
}

export function formatPlayerTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
