import type { AppState } from "../app/store.js";
import { categoryVisibilityStore } from "../data/categoryVisibility.js";
import { contentService } from "../data/contentService.js";
import { createAppFetch } from "../data/devFetch.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { playlistToCredentials } from "../sync/types.js";
import { brandLogo } from "../ui/brand.js";
import { escapeHtml } from "../ui/focus.js";
import { pinLock } from "../data/pinLock.js";
import {
  renderSettingsActionRow,
  renderSettingsNavRow,
  renderSettingsSectionHeader,
} from "../ui/settingsUi.js";
import { resolveAccountAvatarUrl } from "../ui/accountAvatar.js";
import { computeExpiry, expiryClass } from "../ui/expiry.js";
import { isSupabaseConfigured } from "../config.js";
import { XtreamClient } from "@tv/xtream-core";
import pkg from "../../package.json" with { type: "json" };

function truncateServer(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export function renderSettingsScreen(state: AppState): string {
  const status = userSyncManager.getStatus();
  const synced = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString("el-GR")
    : "—";
  const syncLabel = status.isSyncing ? "Συγχρονισμός…" : synced;

  const liveHidden = categoryVisibilityStore.hiddenLive.length;
  const movieHidden = categoryVisibilityStore.hiddenMovies.length;
  const seriesHidden = categoryVisibilityStore.hiddenSeries.length;
  const hasPin = pinLock.hasPin();

  const playlists = userSyncManager.loadPlaylists();
  const activePlaylist =
    playlists.playlists.find((p) => p.id === playlists.activePlaylistId) ?? playlists.playlists[0];

  const displayName = state.accountEmail ?? state.credentials?.username ?? activePlaylist?.username ?? "—";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();
  const avatarUrl = resolveAccountAvatarUrl(state.accountEmail);
  const avatarImg = avatarUrl
    ? `<img class="settings-hero__avatar-img" src="${escapeHtml(avatarUrl)}" alt="" onerror="this.remove()" />`
    : "";

  const cloudSection = isSupabaseConfigured()
    ? `
      <section class="settings-section">
        ${renderSettingsSectionHeader("Cloud")}
        <div class="settings-section__card">
          ${renderSettingsNavRow("settings-sync", "cloudUp", "Push στο cloud", "Ανέβασε playlists, ιστορικό και αγαπημένα")}
          ${renderSettingsNavRow("settings-pull", "cloudDown", "Pull από cloud", "Φόρτωσε τα δεδομένα από τον λογαριασμό")}
        </div>
      </section>
    `
    : "";

  return `
    <section class="page settings-page settings-page-v2">
      <header class="page-header settings-page__header">
        <h1>Ρυθμίσεις</h1>
      </header>
      <div id="settings-status" class="settings-status hidden" role="status" aria-live="polite"></div>
      <div class="settings-v2-body">
        <section class="settings-section">
          ${renderSettingsSectionHeader("Λογαριασμός")}
          <article class="settings-hero">
            <div class="settings-hero__avatar">
              <span class="settings-hero__avatar-letter">${escapeHtml(avatarLetter)}</span>
              ${avatarImg}
            </div>
            <div class="settings-hero__body">
              <p class="settings-hero__label">Συνδεδεμένος</p>
              <strong class="settings-hero__name">${escapeHtml(displayName)}</strong>
              <p class="settings-hero__meta">Τελευταίο sync: ${escapeHtml(syncLabel)}</p>
              ${status.lastError ? `<p class="settings-hero__error">${escapeHtml(status.lastError)}</p>` : ""}
            </div>
          </article>
        </section>

        <section class="settings-section">
          ${renderSettingsSectionHeader("IPTV")}
          <article class="settings-playlist-card">
            <div class="settings-playlist-card__header">
              <strong id="settings-playlist-name">${escapeHtml(activePlaylist?.name ?? "—")}</strong>
              <span id="settings-playlist-expiry" class="settings-expiry-chip">—</span>
            </div>
            <p class="hint settings-playlist-card__meta">
              ${escapeHtml(activePlaylist?.username ?? state.credentials?.username ?? "—")}
              ${activePlaylist?.serverUrl ? ` · ${escapeHtml(truncateServer(activePlaylist.serverUrl))}` : ""}
            </p>
          </article>
          <div class="settings-section__card settings-section__card--actions">
            ${renderSettingsActionRow(
              "settings-reload-playlist",
              "refresh",
              "Ανανέωση playlist",
              "Επαλήθευση σύνδεσης και επαναφόρτωση καταλόγου",
              true,
            )}
            ${renderSettingsNavRow(
              "settings-playlists",
              "playlist",
              "Διαχείριση playlists",
              `${playlists.playlists.length} playlist${playlists.playlists.length === 1 ? "" : "s"}`,
            )}
          </div>
        </section>

        <section class="settings-section">
          ${renderSettingsSectionHeader("Περιεχόμενο")}
          <div class="settings-section__card">
            ${renderSettingsNavRow(
              "settings-categories",
              "tune",
              "Ορατότητα κατηγοριών",
              `Κρυμμένες: Live ${liveHidden} · Ταινίες ${movieHidden} · Σειρές ${seriesHidden}`,
            )}
            ${renderSettingsNavRow(
              "settings-epg-guide",
              "epg",
              "Πλήρες EPG",
              "Οδηγός προγράμματος ζωντανών καναλιών",
            )}
          </div>
        </section>

        <section class="settings-section">
          ${renderSettingsSectionHeader("Δεδομένα")}
          <div class="settings-section__card">
            ${renderSettingsNavRow(
              "settings-refresh-epg",
              "epg",
              "Ανανέωση προγράμματος",
              "Επαναφόρτωση EPG (Τώρα / Επόμενο) για live",
            )}
            ${renderSettingsNavRow(
              "settings-clear-cache",
              "cache",
              "Καθαρισμός cache",
              "Διαγραφή τοπικών λιστών — χωρίς επανσύνδεση",
            )}
          </div>
        </section>

        ${cloudSection}

        <section class="settings-section">
          ${renderSettingsSectionHeader("Ασφάλεια")}
          <article class="settings-pin-card">
            <p class="hint settings-pin-card__hint">
              ${hasPin ? "Τα ευαίσθητα settings προστατεύονται με PIN." : "Προστάτευσε playlists και credentials με PIN."}
            </p>
            <form id="settings-pin-form" class="settings-pin-form">
              <input
                id="settings-pin-input"
                class="settings-pin-input focusable"
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="PIN 4-8 ψηφία"
                tabindex="0"
              />
              <button class="btn focusable" type="submit" tabindex="0">${hasPin ? "Αλλαγή PIN" : "Ορισμός PIN"}</button>
              ${hasPin ? `<button id="settings-pin-clear" class="btn ghost focusable" type="button" tabindex="0">Κατάργηση</button>` : ""}
            </form>
          </article>
        </section>

        <section class="settings-section settings-section--danger">
          ${renderSettingsSectionHeader("Ζώνη κινδύνου")}
          <article class="settings-danger-card">
            <p class="hint">Θα αποσυνδεθείς και θα διαγραφούν τα τοπικά δεδομένα συνεδρίας.</p>
            <button id="settings-logout" class="settings-row settings-row--danger focusable" type="button" tabindex="0">
              <span class="settings-row__icon">${settingsIconInline("logout")}</span>
              <span class="settings-row__body">
                <span class="settings-row__title">Αποσύνδεση</span>
                <span class="settings-row__subtitle">Έξοδος από τον λογαριασμό</span>
              </span>
            </button>
          </article>
        </section>

        <footer class="settings-footer">
          ${brandLogo("footer")}
          <p class="hint">${escapeHtml(pkg.version)} · Tizen Premium</p>
        </footer>
      </div>
    </section>
  `;
}

function settingsIconInline(name: "logout"): string {
  const icons: Record<string, string> = {
    logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>`,
  };
  return icons[name] ?? "";
}

export async function loadSettingsPlaylistMeta(): Promise<void> {
  const state = userSyncManager.loadPlaylists();
  const playlist =
    state.playlists.find((p) => p.id === state.activePlaylistId) ?? state.playlists[0];
  const expiryEl = document.querySelector<HTMLElement>("#settings-playlist-expiry");
  if (!playlist || !expiryEl) return;
  try {
    const info = await new XtreamClient(playlistToCredentials(playlist), createAppFetch()).authenticate();
    const expiry = computeExpiry(info.exp_date);
    expiryEl.textContent = expiry.label;
    expiryEl.className = `settings-expiry-chip ${expiryClass(expiry.urgency)}`;
  } catch {
    expiryEl.textContent = "Σφάλμα";
    expiryEl.className = "settings-expiry-chip expiry-expired";
  }
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
