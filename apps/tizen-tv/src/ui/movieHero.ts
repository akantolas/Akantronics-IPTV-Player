import type { VodStream } from "@tv/xtream-core";
import type { VodInfo } from "../data/contentService.js";
import { escapeHtml } from "./focus.js";

export function renderMovieHeroSkeleton(): string {
  return `
    <div class="movie-hero movie-hero--skeleton">
      <div class="movie-hero__backdrop shimmer"></div>
      <div class="movie-hero__content">
        <div class="skeleton-line shimmer" style="width:280px;height:34px"></div>
        <div class="skeleton-line shimmer" style="width:200px;margin-top:14px"></div>
        <div class="skeleton-line shimmer" style="width:520px;margin-top:14px"></div>
      </div>
    </div>
  `;
}

export function renderMovieHero(movie: VodStream, info?: VodInfo["info"]): string {
  const backdrop = info?.cover_big ?? info?.movie_image ?? movie.stream_icon ?? "";
  const backdropEl = backdrop
    ? `<img class="movie-hero__backdrop" src="${escapeHtml(backdrop)}" alt="" />`
    : `<div class="movie-hero__backdrop movie-hero__backdrop--empty"></div>`;

  const title = info?.name ?? movie.name;
  const year = info?.releasedate ?? info?.release_date;
  const chips = [
    info?.genre?.split(/[,/|]/)[0]?.trim(),
    info?.rating ? `★ ${info.rating}` : movie.rating ? `★ ${movie.rating}` : "",
    year ? String(year).slice(0, 4) : "",
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => `<span class="meta-chip">${escapeHtml(value)}</span>`)
    .join("");

  const plotSource = info?.plot ?? info?.description;
  const plot = plotSource?.trim()
    ? `<p class="movie-hero__plot">${escapeHtml(plotSource.trim())}</p>`
    : "";

  return `
    <div class="movie-hero" data-movie-id="${movie.stream_id}">
      ${backdropEl}
      <div class="movie-hero__scrim"></div>
      <div class="movie-hero__content">
        <span class="movie-hero__eyebrow">Προτεινόμενη ταινία</span>
        <h2 class="movie-hero__title">${escapeHtml(title)}</h2>
        ${chips ? `<div class="movie-hero__meta meta-chips">${chips}</div>` : ""}
        ${plot}
        <div class="movie-hero__actions">
          <button class="btn primary focusable" id="movies-hero-open" tabindex="0">Προβολή</button>
          <button class="btn ghost focusable" id="movies-hero-shuffle" tabindex="0">Τυχαία ταινία</button>
        </div>
      </div>
    </div>
  `;
}
