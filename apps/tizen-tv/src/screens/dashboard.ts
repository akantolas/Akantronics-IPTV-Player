import type { DashboardData, DashboardWatchEntry } from "../data/dashboardService.js";

import type { LiveStream } from "@tv/xtream-core";

import type { WatchEntry } from "../data/watchHistory.js";

import { progressFraction } from "../data/watchHistory.js";

import { renderPosterStackHero } from "../dashboard/posterStack.js";

import { escapeHtml, dashboardCard } from "../ui/focus.js";

import { navIcon } from "../ui/icons.js";

import { expiryClass } from "../ui/expiry.js";

import { renderSkeletonHero } from "../ui/states.js";



const FAVORITE_LIVE_LIMIT = 10;



const QUICK_ACCESS_ITEMS = [

  { target: "live", label: "Live TV", icon: "live" },

  { target: "movies", label: "Ταινίες", icon: "movies" },

  { target: "series", label: "Σειρές", icon: "series" },

  { target: "search", label: "Αναζήτηση", icon: "search" },

] as const;



export function renderDashboardShell(prefill?: DashboardData): string {

  if (prefill) {

    return `

      <section class="page dashboard-page">

        <div id="dashboard-content" class="dashboard-content">

          ${renderDashboardPrefillContent(prefill)}

        </div>

      </section>

    `;

  }

  return `

    <section class="page dashboard-page">

      <div id="dashboard-content" class="dashboard-content">

        ${renderTopbarSkeleton()}

        ${renderSkeletonHero()}

        ${renderQuickAccessSkeleton()}

      </div>

    </section>

  `;

}



export function renderDashboardContent(data: DashboardData): string {

  return `

    <div id="dashboard-local-root">

      ${renderDashboardLocalSections(data)}

    </div>

  `;

}



export function renderDashboardPrefillContent(data: DashboardData): string {

  return `

    <div id="dashboard-local-root">

      <div id="dashboard-topbar-slot" class="dashboard-section-gap">${renderDashboardTopbar(data)}</div>

      <div id="dashboard-hero-slot" class="dashboard-section-gap">${renderSkeletonHero()}</div>

      <div id="dashboard-quick-slot" class="dashboard-section-gap">${renderQuickAccessSkeleton()}</div>

    </div>

  `;

}



export function renderDashboardLocalSections(data: DashboardData): string {

  return `

    <div id="dashboard-topbar-slot" class="dashboard-section-gap">${renderDashboardTopbar(data)}</div>

    <div id="dashboard-hero-slot" class="dashboard-section-gap">${renderPosterStackHero(data)}</div>

    <div id="dashboard-quick-slot" class="dashboard-section-gap">${renderQuickAccess()}</div>

    <div id="dashboard-continue-slot" class="dashboard-section-gap">${renderContinueSection(data)}</div>

    <div id="dashboard-favorites-slot">${renderFavoriteRow(data.favoriteChannels)}</div>

  `;

}



export function renderDashboardTopbar(data: DashboardData): string {

  return `

    <header class="dashboard-topbar">

      <span class="dashboard-playlist-name">${escapeHtml(data.playlistName)}</span>

      <span class="dashboard-expiry-pill ${expiryClass(data.expiryUrgency)}">${escapeHtml(data.expiryLabel)}</span>

    </header>

  `;

}



export function renderQuickAccess(): string {

  const tiles = QUICK_ACCESS_ITEMS.map(

    (item, index) => `

      <button

        class="dashboard-quick-tile focusable"

        type="button"

        data-nav-target="${item.target}"

        tabindex="${index === 0 ? 0 : -1}"

      >

        <span class="dashboard-quick-tile__icon">${navIcon(item.icon)}</span>

        <span class="dashboard-quick-tile__label">${escapeHtml(item.label)}</span>

      </button>

    `,

  ).join("");



  return `<nav class="dashboard-quick-access" aria-label="Γρήγορη πρόσβαση">${tiles}</nav>`;

}



function renderTopbarSkeleton(): string {

  return `

    <header class="dashboard-topbar dashboard-topbar--skeleton">

      <div class="skeleton-line shimmer" style="width:180px;height:18px"></div>

      <div class="skeleton-line shimmer" style="width:96px;height:28px;border-radius:999px"></div>

    </header>

  `;

}



function renderQuickAccessSkeleton(): string {

  const tiles = QUICK_ACCESS_ITEMS.map(

    () => `<div class="dashboard-quick-tile dashboard-quick-tile--skeleton shimmer" aria-hidden="true"></div>`,

  ).join("");

  return `<div class="dashboard-quick-access">${tiles}</div>`;

}



function renderContinueSection(data: DashboardData): string {
  return renderHistorySection("Συνέχεια", data.continueWatching, true, {
    removable: true,
    showSeriesBadges: true,
  });
}



function renderFavoriteRow(channels: LiveStream[]): string {

  const limited = channels.slice(0, FAVORITE_LIVE_LIMIT);

  if (limited.length === 0) return "";

  const cards = limited

    .map((channel) =>

      dashboardCard("live", String(channel.stream_id), channel.name, channel.stream_icon, "Live", {

        "category-id": channel.category_id,

      }),

    )

    .join("");

  return renderPosterRow("Αγαπημένα κανάλια", cards, { actionLabel: "Όλα", actionTarget: "live" });

}



interface HistorySectionOptions {

  actionLabel?: string;

  actionTarget?: string;

  removable?: boolean;

  showSeriesBadges?: boolean;

}



function renderHistorySection(

  title: string,

  entries: DashboardWatchEntry[],

  emptyHidden = true,

  options: HistorySectionOptions = {},

): string {

  if (entries.length === 0 && emptyHidden) return "";

  return renderWatchSectionInner(title, entries, options, options.showSeriesBadges ?? false);

}



function renderWatchSectionInner(

  title: string,

  entries: Array<DashboardWatchEntry>,

  options: HistorySectionOptions,

  showSeriesBadges: boolean,

): string {

  const headerAction =

    options.actionLabel && options.actionTarget

      ? `<button class="section-action focusable" data-action-target="${escapeHtml(options.actionTarget)}" tabindex="0">${escapeHtml(options.actionLabel)}</button>`

      : "";



  const cards = entries

    .map((entry) => {

      const progress = progressFraction(entry);

      const isSeries = entry.type === "SERIES_EPISODE" && showSeriesBadges;

      const showProgress = isSeries

        ? entry.seriesAction === "resume" && progress > 0

        : progress > 0 && !entry.isFinished;

      const progressBar = showProgress

        ? `<div class="progress-track"><div class="progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>`

        : "";

      const subtitle =

        isSeries && entry.seriesAction === "next" && entry.nextEpisodeLabel

          ? entry.nextEpisodeLabel

          : entry.subtitle?.trim() || (entry.type === "LIVE" ? "Live" : "");

      let statusBadge = "";

      if (isSeries) {

        if (entry.seriesAction === "next") {

          statusBadge = `<span class="next-episode-badge">Επόμενο επεισόδιο</span>`;

        } else if (entry.seriesAction === "done") {

          statusBadge = `<span class="finished-badge">Ολοκληρώθηκε</span>`;

        }

      } else if (showSeriesBadges && entry.isFinished) {

        statusBadge = `<span class="finished-badge">Ολοκληρώθηκε</span>`;

      }

      const seriesExtras =

        isSeries && entry.seriesId

          ? {

              "series-action": entry.seriesAction ?? "",

              "next-episode-id": entry.nextEpisode?.id ?? "",

              "next-episode-season": String(entry.nextEpisode?.season ?? ""),

              "next-episode-num": String(entry.nextEpisode?.episodeNum ?? ""),

              "next-episode-title": entry.nextEpisode?.title ?? "",

              "next-episode-extension": entry.nextEpisode?.extension ?? "mp4",

              "series-id": String(entry.seriesId),

            }

          : {};

      const removeBtn = options.removable

        ? `<button class="history-remove focusable" data-remove-id="${escapeHtml(entry.id)}" tabindex="0" aria-label="Αφαίρεση">×</button>`

        : "";

      return `

        <div class="history-card-wrap">

          ${removeBtn}

          ${dashboardCard("history", entry.id, entry.title, entry.imageUrl, subtitle, seriesExtras)}

          ${statusBadge}

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



function renderPosterRow(title: string, cardsHtml: string, options: HistorySectionOptions = {}): string {

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


