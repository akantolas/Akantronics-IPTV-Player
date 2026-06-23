import type { AppState } from "../app/store.js";
import { brandLockup } from "../ui/brand.js";
import { navIcon } from "../ui/icons.js";
import { escapeHtml } from "../ui/focus.js";

const NAV_ITEMS = [
  { id: "home", label: "Αρχική", icon: "home" },
  { id: "live", label: "Live TV", icon: "live" },
  { id: "movies", label: "Ταινίες", icon: "movies" },
  { id: "series", label: "Σειρές", icon: "series" },
] as const;

export function renderShell(state: AppState, content: string): string {
  const nav = NAV_ITEMS.map(
    (item) => `
      <button
        class="nav-item focusable ${state.navSection === item.id ? "active" : ""}"
        data-nav="${item.id}"
        tabindex="0"
      >
        <span class="nav-icon">${navIcon(item.icon)}</span>
        <span class="nav-label">${item.label}</span>
      </button>
    `,
  ).join("");

  const error = state.error
    ? `<div class="banner banner-error">${escapeHtml(state.error)}</div>`
    : "";

  return `
    <div class="shell">
      <aside class="nav-rail">
        <div class="nav-brand">${brandLockup({ compact: true })}</div>
        <div class="nav-items">${nav}</div>
        <div class="nav-footer">
          <button class="nav-item focusable ${state.screen === "search" ? "active" : ""}" data-action="search" tabindex="0">
            <span class="nav-icon">${navIcon("search")}</span>
            <span class="nav-label">Αναζήτηση</span>
          </button>
          <button class="nav-item focusable ${state.navSection === "settings" ? "active" : ""}" data-nav="settings" tabindex="0">
            <span class="nav-icon">${navIcon("settings")}</span>
            <span class="nav-label">Ρυθμίσεις</span>
          </button>
        </div>
      </aside>
      <main class="shell-content cinema-bg">
        ${error}
        ${content}
      </main>
    </div>
  `;
}
