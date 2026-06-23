import type { DashboardData } from "../data/dashboardService.js";
import {
  renderCategoryPreview,
  renderHistorySection,
  renderLibraryShortcuts,
  renderPosterRow,
} from "../ui/historyRows.js";
import { expiryClass } from "../ui/expiry.js";
import { navIcon } from "../ui/icons.js";
import { renderSkeletonChips, renderSkeletonGrid, renderSkeletonHero } from "../ui/states.js";
import { escapeHtml, posterCard } from "../ui/focus.js";

export function renderDashboardShell(): string {
  return `
    <section class="page dashboard-page">
      <div id="dashboard-content">
        ${renderSkeletonHero()}
        ${renderSkeletonChips(4)}
        ${renderSkeletonGrid(6)}
      </div>
    </section>
  `;
}

export function renderDashboardContent(data: DashboardData): string {
  const heroChannel = data.quickPlayChannel?.name ?? "Live TV";
  const heroImage = data.quickPlayChannel?.stream_icon;

  const favoriteRow =
    data.favoriteChannels.length > 0
      ? renderPosterRow(
          "Αγαπημένα κανάλια",
          data.favoriteChannels
            .map((channel) =>
              posterCard(String(channel.stream_id), channel.name, channel.stream_icon, "Live"),
            )
            .join(""),
        )
      : "";

  const categoryChips = data.browseCategories
    .map(
      (cat, index) =>
        `<button class="chip focusable" data-live-category="${escapeHtml(cat.category_id)}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(cat.category_name)}</button>`,
    )
    .join("");

  const previewRows = data.categoryPreviews
    .map((preview) =>
      renderCategoryPreview(
        preview.category_name,
        preview.category_id,
        preview.channels
          .map((ch) => posterCard(String(ch.stream_id), ch.name, ch.stream_icon, "Live"))
          .join(""),
      ),
    )
    .join("");

  const recentLiveRow =
    data.recentLive.length > 0
      ? renderHistorySection("Πρόσφατα Live", data.recentLive, false, {
          actionLabel: "Όλα",
          actionTarget: "live",
        })
      : "";

  const recentMoviesRow =
    data.recentMovies.length > 0
      ? renderHistorySection("Πρόσφατες ταινίες", data.recentMovies, false, {
          actionLabel: "Όλα",
          actionTarget: "movies",
          removable: true,
        })
      : "";

  const recentSeriesRow =
    data.recentSeries.length > 0
      ? renderHistorySection("Πρόσφατες σειρές", data.recentSeries, false, {
          actionLabel: "Όλα",
          actionTarget: "series",
          removable: true,
        })
      : "";

  return `
    <div class="quick-play-hero focusable" id="quick-play-hero" tabindex="0" data-stream-id="${data.quickPlayChannel?.stream_id ?? ""}">
      <div class="quick-play-bg">
        ${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="" />` : ""}
      </div>
      <div class="quick-play-content">
        <p class="quick-play-label">Γρήγορη αναπαραγωγή</p>
        <h2>${escapeHtml(heroChannel)}</h2>
        <p class="hint">${escapeHtml(data.playlistName)}</p>
        <span class="quick-play-btn">${navIcon("play")} Play</span>
      </div>
    </div>

    <div class="stats-strip">
      <article class="stat-card">
        <span class="stat-label">Live κατηγορίες</span>
        <strong>${data.liveCategoryCount}</strong>
      </article>
      <article class="stat-card">
        <span class="stat-label">Λήξη συνδρομής</span>
        <strong class="${expiryClass(data.expiryUrgency)}">${escapeHtml(data.expiryLabel)}</strong>
      </article>
    </div>

    ${renderHistorySection("Συνέχεια", data.continueWatching, true, { removable: true })}
    ${recentLiveRow}
    ${recentMoviesRow}
    ${recentSeriesRow}
    ${renderHistorySection("Πρόσφατα", data.recentlyFinished, true, { removable: true })}
    ${favoriteRow}
    ${previewRows}
    ${renderLibraryShortcuts()}

    <section class="history-section">
      <div class="section-header">
        <h2 class="section-title">Live κατηγορίες</h2>
      </div>
      <div class="chip-row">${categoryChips}</div>
    </section>
  `;
}
