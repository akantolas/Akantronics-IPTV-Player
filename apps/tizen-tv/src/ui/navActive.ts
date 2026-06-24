import type { AppState } from "../app/store.js";

export type NavItemId = "home" | "live" | "movies" | "series" | "search" | "settings";

export function resolveActiveNavId(state: AppState): NavItemId {
  if (state.screen === "search") return "search";
  if (state.screen === "detail" && state.detail) {
    if (state.detail.kind === "movie") return "movies";
    if (state.detail.kind === "series") return "series";
    return "live";
  }
  return state.navSection;
}

export function navItemSelector(activeId: NavItemId): string {
  if (activeId === "search") return '[data-action="search"]';
  return `[data-nav="${activeId}"]`;
}

export function getActiveNavButton(root: ParentNode, activeId: NavItemId): HTMLElement | null {
  return root.querySelector<HTMLElement>(navItemSelector(activeId));
}
