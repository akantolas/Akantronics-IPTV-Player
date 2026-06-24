import type { SeriesItem } from "@tv/xtream-core";
import { escapeHtml } from "./focus.js";

export function renderSeriesHeroSkeleton(): string {
  return `
    <div class="series-hero series-hero--skeleton">
      <div class="series-hero__backdrop shimmer"></div>
      <div class="series-hero__content">
        <div class="skeleton-line shimmer" style="width:280px;height:34px"></div>
        <div class="skeleton-line shimmer" style="width:200px;margin-top:14px"></div>
        <div class="skeleton-line shimmer" style="width:520px;margin-top:14px"></div>
      </div>
    </div>
  `;
}

export function renderSeriesHero(series: SeriesItem): string {
  const backdrop = series.backdrop_path?.[0] || series.cover || "";
  const backdropEl = backdrop
    ? `<img class="series-hero__backdrop" src="${escapeHtml(backdrop)}" alt="" />`
    : `<div class="series-hero__backdrop series-hero__backdrop--empty"></div>`;

  const chips = [
    series.genre?.split(/[,/|]/)[0]?.trim(),
    series.rating ? `★ ${series.rating}` : "",
    series.releaseDate?.slice(0, 4),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => `<span class="meta-chip">${escapeHtml(value)}</span>`)
    .join("");

  const plot = series.plot?.trim()
    ? `<p class="series-hero__plot">${escapeHtml(series.plot.trim())}</p>`
    : "";

  return `
    <div class="series-hero" data-series-id="${series.series_id}">
      ${backdropEl}
      <div class="series-hero__scrim"></div>
      <div class="series-hero__content">
        <span class="series-hero__eyebrow">Προτεινόμενη σειρά</span>
        <h2 class="series-hero__title">${escapeHtml(series.name)}</h2>
        ${chips ? `<div class="series-hero__meta meta-chips">${chips}</div>` : ""}
        ${plot}
        <div class="series-hero__actions">
          <button class="btn primary focusable" id="series-hero-open" tabindex="0">Προβολή</button>
          <button class="btn ghost focusable" id="series-hero-shuffle" tabindex="0">Τυχαία σειρά</button>
        </div>
      </div>
    </div>
  `;
}
