import type { AppState } from "../app/store.js";
import { categoryVisibilityStore } from "../data/categoryVisibility.js";
import { contentService } from "../data/contentService.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { brandLogo } from "../ui/brand.js";
import { escapeHtml } from "../ui/focus.js";
import pkg from "../../package.json" with { type: "json" };
export function renderSettingsScreen(state: AppState): string {
  const status = userSyncManager.getStatus();
  const synced = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString("el-GR")
    : "—";

  const liveCats = categoryVisibilityStore.hiddenLive.length;
  const movieCats = categoryVisibilityStore.hiddenMovies.length;
  const seriesCats = categoryVisibilityStore.hiddenSeries.length;

  return `
    <section class="page settings-page">
      <header class="page-header">
        <h1>Ρυθμίσεις</h1>
      </header>
      <div class="settings-list">
        <article class="info-card account-card">
          <div class="account-header">
            <div class="account-avatar">${escapeHtml((state.accountEmail ?? state.credentials?.username ?? "?").slice(0, 1).toUpperCase())}</div>
            <div>
              <p class="hint">Signed in</p>
              <strong>${state.accountEmail ? escapeHtml(state.accountEmail) : escapeHtml(state.credentials?.username ?? "—")}</strong>
            </div>
          </div>
        </article>
        <article class="info-card">
          <h2>Συγχρονισμός</h2>
          <p>Τελευταίο sync: ${escapeHtml(synced)}</p>
          ${status.lastError ? `<p class="error-inline">${escapeHtml(status.lastError)}</p>` : ""}
          <div class="settings-actions">
            <button id="settings-sync" class="btn focusable" tabindex="0">Push στο cloud</button>
            <button id="settings-pull" class="btn ghost focusable" tabindex="0">Pull από cloud</button>
          </div>
        </article>
        <article class="info-card">
          <h2>Περιεχόμενο</h2>
          <p class="hint">Κρυμμένες κατηγορίες: Live ${liveCats} · Movies ${movieCats} · Series ${seriesCats}</p>
          <div class="settings-actions">
            <button id="settings-categories" class="btn focusable" tabindex="0">Ορατότητα κατηγοριών</button>
            <button id="settings-playlists" class="btn ghost focusable" tabindex="0">Playlists</button>
            <button id="settings-clear-cache" class="btn ghost focusable" tabindex="0">Καθαρισμός cache</button>
          </div>
        </article>
        <article class="info-card">
          <h2>IPTV</h2>
          <p>${state.credentials?.username ? escapeHtml(state.credentials.username) : "—"}</p>
          <p class="hint">${state.credentials?.serverUrl ? escapeHtml(state.credentials.serverUrl) : ""}</p>
        </article>
        <button id="settings-logout" class="btn danger focusable" tabindex="0">Αποσύνδεση</button>
        <footer class="settings-footer">
          ${brandLogo("footer")}
          <p class="hint">${escapeHtml(pkg.version)}-tizen premium</p>
        </footer>
      </div>
    </section>
  `;
}

export async function loadCategoryItems(
  section: "live" | "movies" | "series",
): Promise<Array<{ id: string; name: string }>> {
  if (section === "live") {
    return (await contentService.getLiveCategories()).map((cat) => ({
      id: cat.category_id,
      name: cat.category_name,
    }));
  }
  if (section === "movies") {
    return (await contentService.getVodCategories()).map((cat) => ({
      id: cat.category_id,
      name: cat.category_name,
    }));
  }
  return (await contentService.getSeriesCategories()).map((cat) => ({
    id: cat.category_id,
    name: cat.category_name,
  }));
}
