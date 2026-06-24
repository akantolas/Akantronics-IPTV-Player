import { FAVORITES_CATEGORY_ID } from "./categoryVisibility.js";
import { renderHistorySection } from "../ui/historyRows.js";
import type { BrowseScreen } from "./browseLoader.js";
import { watchHistoryStore } from "./watchHistory.js";

const SEARCH_COPY: Record<BrowseScreen, { label: string; placeholder: string }> = {
  live: { label: "Αναζήτηση καναλιού", placeholder: "Γράψε όνομα καναλιού..." },
  movies: { label: "Αναζήτηση ταινίας", placeholder: "Γράψε τίτλο ταινίας..." },
  series: { label: "Αναζήτηση σειράς", placeholder: "Γράψε τίτλο σειράς..." },
};

export function renderBrowseTopRows(screen: BrowseScreen): string {
  const copy = SEARCH_COPY[screen];
  const searchPanel = renderBrowseSearchPanel(copy.label, copy.placeholder);
  if (screen === "series" || screen === "movies") {
    const type = screen === "series" ? "SERIES_EPISODE" : "MOVIE";
    const cont = watchHistoryStore.getContinueWatching().filter((e) => e.type === type);
    const history = renderHistorySection("Συνέχεια", cont, true, { removable: true });
    return `${searchPanel}${history}`;
  }
  return searchPanel;
}

function renderBrowseSearchPanel(label: string, placeholder: string): string {
  return `
    <section class="browse-search-panel">
      <form class="browse-search-form" id="browse-search-form">
        <label class="browse-search-label" for="browse-search-input">${label}</label>
        <div class="browse-search-box">
          <input
            class="browse-search-input focusable"
            id="browse-search-input"
            type="search"
            placeholder="${placeholder}"
            autocomplete="off"
            tabindex="0"
          />
          <button class="btn ghost focusable browse-search-clear" id="browse-search-clear" type="button" tabindex="0">Καθαρισμός</button>
        </div>
        <p class="hint browse-search-hint" id="browse-search-hint">Ψάχνει εκεί όπου είσαι — όλες οι κατηγορίες ή την επιλεγμένη.</p>
      </form>
    </section>
  `;
}

export function browseSearchScopeHint(screen: BrowseScreen, categoryId?: string, categoryName?: string): string {
  const sectionLabel = screen === "live" ? "Live TV" : screen === "movies" ? "Ταινίες" : "Σειρές";
  if (categoryId === FAVORITES_CATEGORY_ID) {
    return `Ψάχνει στα αγαπημένα (${sectionLabel}).`;
  }
  if (categoryId && categoryName) {
    return `Ψάχνει στην κατηγορία «${categoryName}».`;
  }
  return `Ψάχνει σε όλες τις ορατές κατηγορίες (${sectionLabel}).`;
}
