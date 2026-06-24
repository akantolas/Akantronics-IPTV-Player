import { recentSearchStore } from "../data/recentSearchStore.js";
import { escapeHtml } from "../ui/focus.js";

export function renderSearchScreen(): string {
  const recent = recentSearchStore.getAll();
  const recentChips =
    recent.length > 0
      ? `<div class="recent-search-row">${recent
          .map(
            (query) =>
              `<button class="chip focusable recent-search-chip" data-query="${escapeHtml(query)}" tabindex="0">${escapeHtml(query)}</button>`,
          )
          .join("")}</div>`
      : "";

  return `
    <section class="page search-page">
      <header class="page-header">
        <h1>Αναζήτηση</h1>
        <p class="hint">Live, ταινίες, σειρές</p>
      </header>
      <form id="search-form" class="search-form">
        <input
          id="search-input"
          class="focusable search-input"
          type="text"
          placeholder="Αναζήτηση…"
          autocomplete="off"
        />
        <button type="submit" class="btn primary focusable">Αναζήτηση</button>
      </form>
      ${recentChips ? `<section class="recent-search"><p class="hint">Πρόσφατες αναζητήσεις</p>${recentChips}</section>` : ""}
      <div id="search-results" class="search-results">
        <p class="hint">Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p>
      </div>
    </section>
  `;
}

export function renderSearchResults(sections: Array<{ title: string; html: string }>): string {
  if (sections.length === 0) {
    return `<div class="state-panel empty-state"><p>Δεν βρέθηκαν αποτελέσματα.</p></div>`;
  }
  return sections
    .map(
      (section) => `
        <section class="search-section">
          <h2 class="section-title">${escapeHtml(section.title)}</h2>
          <div class="poster-grid">${section.html}</div>
        </section>
      `,
    )
    .join("");
}

function resultCard(kind: string, id: string, title: string, image?: string, subtitle?: string): string {
  return `<button class="poster-card focusable" data-kind="${kind}" data-id="${escapeHtml(id)}" tabindex="0">
    <div class="poster-image">${image ? `<img src="${escapeHtml(image)}" alt="" />` : `<div class="card-placeholder">${escapeHtml(title.slice(0, 1))}</div>`}</div>
    <p class="card-title">${escapeHtml(title)}</p>
    ${subtitle ? `<p class="card-subtitle">${escapeHtml(subtitle)}</p>` : ""}
  </button>`;
}

export function liveResultCard(id: number, title: string, image?: string): string {
  return resultCard("live", String(id), title, image, "Live");
}

export function movieResultCard(id: number, title: string, image?: string, rating?: string): string {
  return resultCard("movie", String(id), title, image, rating);
}

export function seriesResultCard(id: number, title: string, image?: string, rating?: string): string {
  return resultCard("series", String(id), title, image, rating);
}
