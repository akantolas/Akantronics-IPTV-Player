import type { WatchEntry } from "../data/watchHistory.js";
import { progressFraction } from "../data/watchHistory.js";
import { escapeHtml, posterCard } from "./focus.js";
import { navIcon } from "./icons.js";

export interface HistorySectionOptions {
  actionLabel?: string;
  actionTarget?: string;
  removable?: boolean;
}

export function renderHistorySection(
  title: string,
  entries: WatchEntry[],
  emptyHidden = true,
  options: HistorySectionOptions = {},
): string {
  if (entries.length === 0 && emptyHidden) return "";

  const headerAction =
    options.actionLabel && options.actionTarget
      ? `<button class="section-action focusable" data-action-target="${escapeHtml(options.actionTarget)}" tabindex="0">${escapeHtml(options.actionLabel)}</button>`
      : "";

  const cards = entries
    .map((entry) => {
      const progress = progressFraction(entry);
      const progressBar =
        progress > 0
          ? `<div class="progress-track"><div class="progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>`
          : "";
      const subtitle = entry.subtitle?.trim() || (entry.type === "LIVE" ? "Live" : "");
      const removeBtn = options.removable
        ? `<button class="history-remove focusable" data-remove-id="${escapeHtml(entry.id)}" tabindex="0" aria-label="Αφαίρεση">×</button>`
        : "";
      return `
        <div class="history-card-wrap">
          ${removeBtn}
          ${posterCard(entry.id, entry.title, entry.imageUrl, subtitle)}
          ${progressBar}
        </div>
      `;
    })
    .join("");

  return `
    <section class="history-section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        ${headerAction}
      </div>
      <div class="history-row">${cards}</div>
    </section>
  `;
}

export function renderPosterRow(
  title: string,
  cardsHtml: string,
  options: HistorySectionOptions = {},
): string {
  if (!cardsHtml.trim()) return "";
  const headerAction =
    options.actionLabel && options.actionTarget
      ? `<button class="section-action focusable" data-action-target="${escapeHtml(options.actionTarget)}" tabindex="0">${escapeHtml(options.actionLabel)}</button>`
      : "";
  return `
    <section class="history-section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        ${headerAction}
      </div>
      <div class="history-row">${cardsHtml}</div>
    </section>
  `;
}

export function renderLibraryShortcuts(): string {
  return `
    <section class="library-shortcuts">
      <button class="library-card focusable" data-nav-target="live" tabindex="0">
        <span class="library-icon">${navIcon("live")}</span>
        <strong>Live TV</strong>
        <span class="hint">Κανάλια & κατηγορίες</span>
      </button>
      <button class="library-card focusable" data-nav-target="movies" tabindex="0">
        <span class="library-icon">${navIcon("movies")}</span>
        <strong>Ταινίες</strong>
        <span class="hint">Βιβλιοθήκη VOD</span>
      </button>
      <button class="library-card focusable" data-nav-target="series" tabindex="0">
        <span class="library-icon">${navIcon("series")}</span>
        <strong>Σειρές</strong>
        <span class="hint">Επεισόδια & seasons</span>
      </button>
      <button class="library-card focusable" data-nav-target="search" tabindex="0">
        <span class="library-icon">${navIcon("search")}</span>
        <strong>Αναζήτηση</strong>
        <span class="hint">Βρες γρήγορα τίτλο ή κανάλι</span>
      </button>
    </section>
  `;
}

export function renderCategoryPreview(title: string, categoryId: string, cardsHtml: string): string {
  if (!cardsHtml.trim()) return "";
  return `
    <section class="history-section">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <button class="section-action focusable" data-live-category="${escapeHtml(categoryId)}" tabindex="0">Όλα</button>
      </div>
      <div class="history-row">${cardsHtml}</div>
    </section>
  `;
}
