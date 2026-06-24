import type { AppState } from "../app/store.js";
import { renderBrowseTopRows } from "../data/browseExtras.js";
import { renderSkeletonChips, renderSkeletonGrid } from "../ui/states.js";
import { renderMovieHeroSkeleton } from "../ui/movieHero.js";
import { renderSeriesHeroSkeleton } from "../ui/seriesHero.js";

const TITLES: Record<"live" | "movies" | "series", string> = {
  live: "Live TV",
  movies: "Ταινίες",
  series: "Σειρές",
};

export function renderBrowseScreen(state: AppState): string {
  const screen = state.screen;
  if (screen !== "live" && screen !== "movies" && screen !== "series") {
    return "";
  }

  return `
    <section class="page browse-page">
      <header class="page-header browse-header">
        <h1>${TITLES[screen]}</h1>
        ${screen === "live" ? `<button id="browse-epg-guide" class="btn ghost focusable" tabindex="0">Πρόγραμμα TV</button>` : ""}
      </header>
      ${screen === "series" ? `<div id="series-hero" class="browse-hero-slot">${renderSeriesHeroSkeleton()}</div>` : ""}
      ${screen === "movies" ? `<div id="movies-hero" class="browse-hero-slot">${renderMovieHeroSkeleton()}</div>` : ""}
      <div id="browse-top">${renderBrowseTopRows(screen)}</div>
      <div id="category-chips" class="chip-row">${renderSkeletonChips(6)}</div>
      <div id="browse-grid">${renderSkeletonGrid(8)}</div>
    </section>
  `;
}
