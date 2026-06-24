import type { PlayerSession } from "../types/global.js";
import {
  formatPlayerTime,
  renderPlayerChrome,
  renderPlayerLiveNowPill,
  renderPlayerSidePanelShell,
} from "../ui/playerChrome.js";

export { formatPlayerTime };

export function renderPlayerScreen(player: PlayerSession): string {
  return `
    <section class="player-page player-v2">
      <div id="player-container" class="player-container"></div>
      <div id="player-live-overlays"></div>
      <div id="player-immersive-hud" class="player-immersive-hud hidden" aria-hidden="true">
        <span id="player-immersive-wall" class="player-immersive-hud__wall"></span>
        <span id="player-immersive-playback" class="player-immersive-hud__playback hidden"></span>
      </div>
      <div id="player-immersive-focus" class="player-immersive-focus" tabindex="-1" aria-hidden="true"></div>
      <div id="player-chrome" class="player-chrome">
        ${renderPlayerChrome(player)}
      </div>
      ${renderPlayerSidePanelShell()}
      <div id="player-up-next-host"></div>
      <div id="player-error-host"></div>
      <div id="player-buffering" class="player-buffering hidden"><div class="spinner"></div></div>
    </section>
  `;
}

export function renderPlayerLiveNow(player: PlayerSession): string {
  return renderPlayerLiveNowPill(player);
}
