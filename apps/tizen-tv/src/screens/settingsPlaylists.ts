import type { IptvPlaylist } from "../sync/types.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { computeExpiry, expiryClass } from "../ui/expiry.js";
import { XtreamClient } from "@tv/xtream-core";
import { createAppFetch } from "../data/devFetch.js";
import { playlistToCredentials } from "../sync/types.js";
import { escapeHtml } from "../ui/focus.js";

export function renderPlaylistsScreen(): string {
  const state = userSyncManager.loadPlaylists();
  const rows = state.playlists
    .map((playlist) => renderPlaylistRow(playlist, playlist.id === state.activePlaylistId))
    .join("");

  return `
    <section class="page settings-page">
      <header class="page-header">
        <button class="btn ghost focusable" id="settings-back" tabindex="0">← Ρυθμίσεις</button>
        <h1>Playlists</h1>
      </header>
      <div class="settings-list">
        ${rows || `<div class="state-panel empty-state"><p>Δεν υπάρχουν playlists.</p></div>`}
        <button id="playlist-add" class="btn primary focusable" tabindex="0">Προσθήκη playlist</button>
      </div>
      <div id="playlist-form-modal" class="modal hidden">
        <div class="modal-card">
          <h2 id="playlist-form-title">Νέα playlist</h2>
          <form id="playlist-form" class="stack-form">
            <input type="hidden" id="playlist-edit-id" value="" />
            <label>Όνομα<input id="playlist-name" class="focusable" type="text" /></label>
            <label>Server URL<input id="playlist-server" class="focusable" type="text" placeholder="http://example.com:8080" /></label>
            <label>Username<input id="playlist-user" class="focusable" type="text" /></label>
            <label>Password<input id="playlist-pass" class="focusable" type="password" /></label>
            <div class="modal-actions">
              <button type="submit" class="btn primary focusable">Αποθήκευση</button>
              <button type="button" id="playlist-form-cancel" class="btn ghost focusable">Ακύρωση</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderPlaylistRow(playlist: IptvPlaylist, active: boolean): string {
  return `
    <article class="info-card playlist-row">
      <div class="playlist-row-header">
        <strong>${escapeHtml(playlist.name)}</strong>
        ${active ? `<span class="meta-chip active-chip">Ενεργή</span>` : ""}
        <span id="playlist-expiry-${escapeHtml(playlist.id)}" class="hint">—</span>
      </div>
      <p class="hint">${escapeHtml(playlist.username)} · ${escapeHtml(playlist.serverUrl)}</p>
      <div class="settings-actions">
        ${active ? "" : `<button class="btn ghost focusable playlist-activate" data-id="${escapeHtml(playlist.id)}" tabindex="0">Ενεργοποίηση</button>`}
        <button class="btn ghost focusable playlist-test" data-id="${escapeHtml(playlist.id)}" tabindex="0">Test</button>
        <button class="btn ghost focusable playlist-edit" data-id="${escapeHtml(playlist.id)}" tabindex="0">Επεξεργασία</button>
        <button class="btn danger focusable playlist-delete" data-id="${escapeHtml(playlist.id)}" tabindex="0">Διαγραφή</button>
      </div>
    </article>
  `;
}

export async function loadPlaylistExpiryLabels(): Promise<void> {
  const state = userSyncManager.loadPlaylists();
  const fetchImpl = createAppFetch();
  for (const playlist of state.playlists) {
    const el = document.querySelector(`#playlist-expiry-${CSS.escape(playlist.id)}`);
    if (!el) continue;
    try {
      const info = await new XtreamClient(playlistToCredentials(playlist), fetchImpl).authenticate();
      const expiry = computeExpiry(info.exp_date);
      el.textContent = expiry.label;
      el.className = `hint ${expiryClass(expiry.urgency)}`;
    } catch {
      el.textContent = "Σφάλμα";
    }
  }
}
