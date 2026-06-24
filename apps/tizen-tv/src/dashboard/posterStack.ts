import type { DashboardData, DashboardWatchEntry } from "../data/dashboardService.js";
import { hasResumableProgress, isInProgress, progressFraction } from "../data/watchHistory.js";
import { continueLabel } from "../ui/watchEntryFormat.js";
import { escapeHtml } from "../ui/focus.js";
import { renderEmptyState } from "../ui/states.js";

export interface PosterStackItem {
  id: string;
  entryId?: string;
  title: string;
  tagline: string;
  imageUrl?: string;
  progress?: number;
  cardAttrs: Record<string, string>;
}

export function buildPosterStackItems(data: DashboardData): PosterStackItem[] {
  const items: PosterStackItem[] = [];
  const usedKeys = new Set<string>();
  const seriesInStack = new Set<number>();

  const add = (item: PosterStackItem, dedupeKey: string): void => {
    if (usedKeys.has(dedupeKey) || items.length >= 3) return;
    usedKeys.add(dedupeKey);
    items.push(item);
  };

  for (const entry of data.continueWatching) {
    if (entry.type === "MOVIE" && hasResumableProgress(entry)) {
      add(itemFromResumeEntry(entry), entry.id);
    }
  }

  for (const entry of data.continueWatching) {
    if (entry.type !== "SERIES_EPISODE" || !hasResumableProgress(entry)) continue;
    if (entry.seriesId) seriesInStack.add(entry.seriesId);
    add(itemFromDashboardSeries(entry), entry.id);
  }

  for (const entry of data.recentSeries) {
    const isResume =
      entry.seriesAction === "resume" ||
      (entry.type === "SERIES_EPISODE" && isInProgress(entry));
    if (!isResume) continue;
    if (entry.seriesId && seriesInStack.has(entry.seriesId)) continue;
    const key = entry.seriesId != null ? `resume_${entry.seriesId}` : entry.id;
    add(itemFromDashboardSeries(entry), key);
    if (entry.seriesId) seriesInStack.add(entry.seriesId);
  }

  for (const entry of data.recentSeries) {
    if (entry.seriesAction !== "next") continue;
    if (entry.seriesId && seriesInStack.has(entry.seriesId)) continue;
    const key = entry.seriesId != null ? `next_${entry.seriesId}` : entry.id;
    add(itemFromDashboardSeries(entry), key);
    if (entry.seriesId) seriesInStack.add(entry.seriesId);
  }

  return items;
}

export function getPosterStackEntryIds(items: PosterStackItem[]): string[] {
  return items.map((item) => item.entryId).filter((id): id is string => Boolean(id));
}

function itemFromResumeEntry(entry: DashboardWatchEntry): PosterStackItem {
  const progress = progressFraction(entry);
  const cardAttrs: Record<string, string> = {
    "card-kind": "history",
    "entry-id": entry.id,
    "series-action": entry.type === "SERIES_EPISODE" ? "resume" : "",
  };
  if (entry.seriesId) cardAttrs["series-id"] = String(entry.seriesId);

  return {
    id: entry.id,
    entryId: entry.id,
    title: entry.title,
    tagline: continueLabel(entry),
    imageUrl: entry.imageUrl,
    progress,
    cardAttrs,
  };
}

function itemFromDashboardSeries(entry: DashboardWatchEntry): PosterStackItem {
  const inProgress = isInProgress(entry);
  const progress = inProgress ? progressFraction(entry) : undefined;
  let tagline: string;
  if (entry.seriesAction === "next" && entry.nextEpisodeLabel) {
    tagline = `Επόμενο · ${entry.nextEpisodeLabel}`;
  } else if (inProgress || entry.seriesAction === "resume") {
    tagline = continueLabel(entry);
  } else {
    tagline = entry.subtitle ?? "Σειρά";
  }

  const cardAttrs: Record<string, string> = {
    "card-kind": "history",
    "entry-id": entry.id,
    "series-action": entry.seriesAction ?? (inProgress ? "resume" : ""),
  };

  if (entry.seriesId) cardAttrs["series-id"] = String(entry.seriesId);
  if (entry.nextEpisode) {
    cardAttrs["next-episode-id"] = entry.nextEpisode.id;
    cardAttrs["next-episode-season"] = String(entry.nextEpisode.season);
    cardAttrs["next-episode-num"] = String(entry.nextEpisode.episodeNum);
    cardAttrs["next-episode-title"] = entry.nextEpisode.title;
    cardAttrs["next-episode-extension"] = entry.nextEpisode.extension;
  }

  return {
    id: entry.id,
    entryId: entry.id,
    title: entry.title,
    tagline,
    imageUrl: entry.imageUrl,
    progress,
    cardAttrs,
  };
}

function renderPosterImage(item: PosterStackItem): string {
  if (item.imageUrl) {
    return `<img class="poster-stack-image" src="${escapeHtml(item.imageUrl)}" alt="" />`;
  }
  return `<div class="poster-stack-placeholder">${escapeHtml(item.title.slice(0, 1))}</div>`;
}

function renderStackCard(item: PosterStackItem, index: number, total: number): string {
  const dataAttrs = Object.entries(item.cardAttrs)
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(" ");
  const progressPct = item.progress != null && item.progress > 0 ? Math.round(item.progress * 100) : 0;
  const defaultFocus = index === Math.floor((total - 1) / 2);

  return `
    <button
      class="poster-stack-card focusable${defaultFocus ? " is-default-focus" : ""}"
      type="button"
      data-stack-index="${index}"
      data-meta-title="${escapeHtml(item.title)}"
      data-meta-tagline="${escapeHtml(item.tagline)}"
      data-meta-progress="${progressPct}"
      ${dataAttrs}
      tabindex="${defaultFocus ? 0 : -1}"
    >
      ${renderPosterImage(item)}
    </button>
  `;
}

function renderMetaPanel(item: PosterStackItem): string {
  const progressPct = item.progress != null && item.progress > 0 ? Math.round(item.progress * 100) : 0;
  const progressBar =
    progressPct > 0
      ? `<div class="progress-track poster-stack-progress"><div class="progress-fill" style="width:${progressPct}%"></div></div>`
      : "";

  return `
    <div class="poster-stack-meta" id="poster-stack-meta">
      <p class="poster-stack-tagline">${escapeHtml(item.tagline)}</p>
      <h2 class="poster-stack-title">${escapeHtml(item.title)}</h2>
      ${progressBar}
    </div>
  `;
}

export function renderPosterStackHero(data: DashboardData): string {
  const items = buildPosterStackItems(data);
  if (items.length === 0) {
    return renderEmptyState("Δεν έχεις κάτι σε εξέλιξη", "Άνοιγμα Σειρές", "hero-open-series");
  }

  const cards = items.map((item, index) => renderStackCard(item, index, items.length)).join("");
  const focusIndex = Math.min(1, items.length - 1);
  const metaItem = items[focusIndex] ?? items[0]!;

  return `
    <div class="poster-stack-hero" id="poster-stack-hero" data-stack-count="${items.length}">
      <div class="poster-stack-stage poster-stack-count-${items.length}">
        ${cards}
      </div>
      ${renderMetaPanel(metaItem)}
    </div>
  `;
}

export function updatePosterStackMeta(card: HTMLElement): void {
  const meta = card.closest("#poster-stack-hero")?.querySelector<HTMLElement>("#poster-stack-meta");
  if (!meta) return;

  const tagline = card.dataset.metaTagline ?? "";
  const title = card.dataset.metaTitle ?? "";
  const progressPct = Number(card.dataset.metaProgress ?? 0);

  const taglineEl = meta.querySelector(".poster-stack-tagline");
  const titleEl = meta.querySelector(".poster-stack-title");
  if (taglineEl) taglineEl.textContent = tagline;
  if (titleEl) titleEl.textContent = title;

  let progressEl = meta.querySelector<HTMLElement>(".poster-stack-progress");
  if (progressPct > 0) {
    if (!progressEl) {
      progressEl = document.createElement("div");
      progressEl.className = "progress-track poster-stack-progress";
      progressEl.innerHTML = '<div class="progress-fill"></div>';
      meta.appendChild(progressEl);
    }
    const fill = progressEl.querySelector<HTMLElement>(".progress-fill");
    if (fill) fill.style.width = `${progressPct}%`;
    progressEl.classList.remove("hidden");
  } else if (progressEl) {
    progressEl.remove();
  }
}
