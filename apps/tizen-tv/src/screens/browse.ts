import type { AppState } from "../app/store.js";
import { renderBrowseTopRows } from "../data/browseExtras.js";
import { renderSkeletonChips, renderSkeletonGrid } from "../ui/states.js";

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
      <header class="page-header">
        <h1>${TITLES[screen]}</h1>
      </header>
      <div id="browse-top">${renderBrowseTopRows(screen)}</div>
      <div id="category-chips">${renderSkeletonChips(6)}</div>
      <div id="browse-grid">${renderSkeletonGrid(8)}</div>
    </section>
  `;
}
