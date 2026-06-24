import type { AppState } from "../app/store.js";
import { watchHistoryStore } from "../data/watchHistory.js";
import { brandLockup } from "../ui/brand.js";
import { navIcon } from "../ui/icons.js";
import { escapeHtml } from "../ui/focus.js";
import { resolveActiveNavId, type NavItemId } from "../ui/navActive.js";

const NAV_ITEMS = [
  { id: "home" as const, label: "Αρχική", icon: "home" },
  { id: "live" as const, label: "Live TV", icon: "live" },
  { id: "movies" as const, label: "Ταινίες", icon: "movies" },
  { id: "series" as const, label: "Σειρές", icon: "series" },
];

function navTabIndex(activeId: NavItemId, itemId: NavItemId): string {
  return activeId === itemId ? "0" : "-1";
}

export function renderShell(state: AppState, content: string): string {
  const activeId = resolveActiveNavId(state);
  const continueCount = watchHistoryStore.getContinueWatching().length;
  const isDetail = state.screen === "detail";
  const shellClass = isDetail ? "shell shell--detail" : "shell";

  const nav = NAV_ITEMS.map((item) => {
    const isActive = activeId === item.id;
    const badge =
      item.id === "home" && continueCount > 0
        ? `<span class="nav-badge" aria-hidden="true"></span>`
        : "";
    return `
      <button
        class="nav-item focusable ${isActive ? "active" : ""}"
        data-nav="${item.id}"
        tabindex="${navTabIndex(activeId, item.id)}"
      >
        <span class="nav-icon">${navIcon(item.icon)}${badge}</span>
        <span class="nav-label">${item.label}</span>
      </button>
    `;
  }).join("");

  const error = state.error
    ? `<div class="banner banner-error">${escapeHtml(state.error)}</div>`
    : "";

  return `
    <div class="${shellClass}">
      <aside class="nav-rail">
        <button class="nav-brand focusable" data-nav="home" type="button" tabindex="${activeId === "home" && state.screen === "home" ? "0" : "-1"}">
          ${brandLockup({ compact: true })}
        </button>
        <div class="nav-items">${nav}</div>
        <div class="nav-footer">
          <button class="nav-item focusable ${activeId === "search" ? "active" : ""}" data-action="search" tabindex="${navTabIndex(activeId, "search")}">
            <span class="nav-icon">${navIcon("search")}</span>
            <span class="nav-label">Αναζήτηση</span>
          </button>
          <button class="nav-item focusable ${activeId === "settings" ? "active" : ""}" data-nav="settings" tabindex="${navTabIndex(activeId, "settings")}">
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
    <div id="pin-unlock-modal" class="modal hidden" role="dialog" aria-modal="true">
      <div class="modal-card">
        <h2>PIN απαιτείται</h2>
        <p class="hint">Αυτή η κατηγορία είναι κλειδωμένη.</p>
        <form id="pin-unlock-form" class="stack-form">
          <input id="pin-unlock-input" class="focusable" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="PIN" tabindex="0" />
          <div class="modal-actions">
            <button class="btn primary focusable" type="submit" tabindex="0">Ξεκλείδωμα</button>
            <button id="pin-unlock-cancel" class="btn ghost focusable" type="button" tabindex="0">Ακύρωση</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
