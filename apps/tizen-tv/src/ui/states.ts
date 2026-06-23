import { escapeHtml } from "./focus.js";

export function renderEmptyState(message: string, actionLabel?: string, actionId?: string): string {
  return `
    <div class="state-panel empty-state">
      <p>${escapeHtml(message)}</p>
      ${
        actionLabel && actionId
          ? `<button class="btn primary focusable" id="${escapeHtml(actionId)}" tabindex="0">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>
  `;
}

export function renderErrorState(message: string, actionId = "error-retry"): string {
  return renderEmptyState(message, "Επανάληψη", actionId);
}

export function renderSkeletonGrid(count = 8): string {
  return `
    <div class="skeleton-grid">
      ${Array.from({ length: count }, () => `<div class="skeleton-poster shimmer"></div>`).join("")}
    </div>
  `;
}

export function renderSkeletonHero(): string {
  return `<div class="skeleton-hero shimmer"></div>`;
}

export function renderSkeletonChips(count = 6): string {
  return `
    <div class="skeleton-chips">
      ${Array.from({ length: count }, () => `<div class="skeleton-chip shimmer"></div>`).join("")}
    </div>
  `;
}
