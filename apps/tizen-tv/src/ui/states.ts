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
  return `
    <div class="poster-stack-hero poster-stack-skeleton">
      <div class="poster-stack-stage poster-stack-count-1">
        <div class="poster-stack-card skeleton-poster shimmer"></div>
      </div>
      <div class="poster-stack-meta">
        <div class="skeleton-line shimmer" style="width:40%;margin:0 auto"></div>
        <div class="skeleton-line shimmer" style="width:70%;margin:10px auto 0"></div>
      </div>
    </div>
  `;
}

export function renderSkeletonChips(count = 6): string {
  return `
    <div class="skeleton-chips">
      ${Array.from({ length: count }, () => `<div class="skeleton-chip shimmer"></div>`).join("")}
    </div>
  `;
}
