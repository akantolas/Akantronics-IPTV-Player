import type { ContentSection } from "../data/categoryVisibility.js";
import { categoryVisibilityStore } from "../data/categoryVisibility.js";
import { escapeHtml } from "../ui/focus.js";

const SECTION_LABELS: Record<ContentSection, string> = {
  live: "Live",
  movies: "Ταινίες",
  series: "Σειρές",
};

export interface CategoryVisibilityItem {
  id: string;
  name: string;
}

export function renderCategoryVisibilityScreen(
  section: ContentSection,
  items: CategoryVisibilityItem[],
  searchQuery: string,
): string {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = normalizedQuery
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
    : items;
  const visibleCount = items.filter((item) => categoryVisibilityStore.isVisible(section, item.id)).length;

  const tabs = (["live", "movies", "series"] as ContentSection[])
    .map(
      (tab) =>
        `<button class="chip focusable ${tab === section ? "active" : ""}" data-cat-tab="${tab}" tabindex="${tab === section ? 0 : -1}">${SECTION_LABELS[tab]}</button>`,
    )
    .join("");

  const rows =
    filtered.length === 0
      ? `<div class="state-panel empty-state"><p>Δεν βρέθηκαν κατηγορίες.</p></div>`
      : filtered
          .map((item) => {
            const visible = categoryVisibilityStore.isVisible(section, item.id);
            return `
              <label class="visibility-row focusable" data-category-id="${escapeHtml(item.id)}" tabindex="0">
                <span>${escapeHtml(item.name)}</span>
                <input type="checkbox" class="visibility-toggle" data-category-id="${escapeHtml(item.id)}" ${visible ? "checked" : ""} />
              </label>
            `;
          })
          .join("");

  return `
    <section class="page settings-page settings-page-v2">
      <header class="page-header">
        <button class="btn ghost focusable" id="settings-back" tabindex="0">← Ρυθμίσεις</button>
        <h1>Ορατότητα κατηγοριών</h1>
      </header>
      <div class="chip-row">${tabs}</div>
      <form id="category-search-form" class="search-form">
        <input
          id="category-search-input"
          class="focusable search-input"
          type="text"
          placeholder="Αναζήτηση κατηγορίας…"
          value="${escapeHtml(searchQuery)}"
        />
      </form>
      <div class="visibility-toolbar">
        <span class="hint">${visibleCount}/${items.length} εμφανίζονται</span>
        <div class="visibility-actions">
          <button class="btn ghost focusable" id="cat-show-all" tabindex="0">Όλα</button>
          <button class="btn ghost focusable" id="cat-hide-all" tabindex="0">Κανένα</button>
        </div>
      </div>
      <div class="visibility-list">${rows}</div>
    </section>
  `;
}
