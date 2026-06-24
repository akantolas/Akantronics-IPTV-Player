const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), .focusable:not([aria-disabled="true"])';

const NAV_ITEM_SELECTOR = ".nav-rail .nav-item, .nav-rail .nav-brand[data-nav]";

function inNavRail(el: HTMLElement): boolean {
  return !!el.closest(".nav-rail");
}

function inShellContent(el: HTMLElement): boolean {
  return !!el.closest(".shell-content");
}

function queryNavRailItems(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(NAV_ITEM_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

function getActiveNavButton(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(".nav-rail .nav-item.active, .nav-rail .nav-brand[data-nav]");
}

function getFirstShellContentFocusable(root: ParentNode): HTMLElement | null {
  const content = root.querySelector(".shell-content");
  if (!content) return null;
  const detailBack = content.querySelector<HTMLElement>("#detail-back");
  if (detailBack) return detailBack;
  const focusables = queryFocusables(content);
  return focusables[0] ?? null;
}

function isLeftContentColumn(current: HTMLElement, root: HTMLElement): boolean {
  const content = root.querySelector(".shell-content");
  if (!content) return false;
  const contentRect = content.getBoundingClientRect();
  const currentRect = current.getBoundingClientRect();
  return currentRect.left - contentRect.left < 48;
}

function findRailWrapFocus(root: HTMLElement, current: HTMLElement, direction: "up" | "down"): HTMLElement | null {
  const items = queryNavRailItems(root);
  const index = items.indexOf(current);
  if (index < 0) return null;
  const nextIndex = direction === "down" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
  return items[nextIndex] ?? null;
}

export function initNavRovingTabindex(root: ParentNode = document): void {
  const rail = root.querySelector(".nav-rail");
  if (!rail) return;

  const syncTabIndex = (focused: HTMLElement | null): void => {
    queryNavRailItems(rail).forEach((item) => {
      item.tabIndex = item === focused ? 0 : -1;
    });
  };

  const active = rail.querySelector<HTMLElement>(".nav-item.active");
  syncTabIndex(active);

  rail.querySelectorAll<HTMLElement>(NAV_ITEM_SELECTOR).forEach((item) => {
    item.addEventListener("focus", () => syncTabIndex(item));
  });
}

export function queryFocusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.id === "player-immersive-focus" && el.tabIndex < 0) return false;
    return el.offsetParent !== null || el === document.activeElement;
  });
}

export function setFocus(el: HTMLElement | null): void {
  if (!el) return;
  el.focus({ preventScroll: true });
  const isTextInput =
    el instanceof HTMLInputElement &&
    (el.type === "text" || el.type === "search" || el.type === "password" || el.type === "number");
  if (!isTextInput) {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  el.classList.add("is-focused");
  document.querySelectorAll(".is-focused").forEach((node) => {
    if (node !== el) node.classList.remove("is-focused");
  });
}

export function initFocusRing(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR).forEach((el) => {
    el.addEventListener("focus", () => {
      document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
      el.classList.add("is-focused");
    });
    el.addEventListener("blur", () => el.classList.remove("is-focused"));
  });
}

export function isRemoteBack(event: KeyboardEvent): boolean {
  const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode;
  return (
    event.key === "Back" ||
    event.key === "XF86Back" ||
    event.key === "Backspace" ||
    event.key === "Escape" ||
    keyCode === 10009 ||
    keyCode === 461 ||
    keyCode === 27
  );
}

export function bindRemoteNavigation(root: HTMLElement, onBack?: () => void): () => void {
  const handler = (event: KeyboardEvent) => {
    if (isRemoteBack(event)) {
      event.preventDefault();
      onBack?.();
      return;
    }

    const playerChrome = root.querySelector("#player-chrome");
    if (playerChrome?.classList.contains("hidden")) return;

    const immersiveFocus = root.querySelector<HTMLElement>("#player-immersive-focus");
    if (immersiveFocus && document.activeElement === immersiveFocus) return;

    const current = document.activeElement as HTMLElement | null;
    if (!current || !root.contains(current)) return;

    const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode;
    const isActivate = event.key === "Enter" || keyCode === 13 || keyCode === 415;
    if (isActivate && current instanceof HTMLButtonElement) {
      event.preventDefault();
      current.click();
      return;
    }

    const isLeft = event.key === "ArrowLeft" || keyCode === 37;
    const isRight = event.key === "ArrowRight" || keyCode === 39;
    const isUp = event.key === "ArrowUp" || keyCode === 38;
    const isDown = event.key === "ArrowDown" || keyCode === 40;

    if (
      isDown &&
      (current.id === "search-input" || current.closest("#search-form"))
    ) {
      const firstResult = root.querySelector<HTMLElement>("#search-results .poster-card");
      if (firstResult) {
        event.preventDefault();
        setFocus(firstResult);
        return;
      }
    }

    let next: HTMLElement | null = null;

    if (isRight && inNavRail(current)) {
      const contentTarget = getFirstShellContentFocusable(root);
      if (contentTarget) {
        event.preventDefault();
        setFocus(contentTarget);
        return;
      }
    }

    if (isLeft && inShellContent(current)) {
      const spatialLeft = findSpatialFocus(root, current, "left");
      if (!spatialLeft || isLeftContentColumn(current, root)) {
        const navTarget = getActiveNavButton(root) ?? queryNavRailItems(root)[0] ?? null;
        if (navTarget) {
          event.preventDefault();
          setFocus(navTarget);
          return;
        }
      }
    }

    if ((isUp || isDown) && inNavRail(current)) {
      const spatial = findSpatialFocus(root, current, isDown ? "down" : "up");
      if (!spatial) {
        const wrapped = findRailWrapFocus(root, current, isDown ? "down" : "up");
        if (wrapped && wrapped !== current) {
          event.preventDefault();
          setFocus(wrapped);
          return;
        }
      }
    }

    if (isRight) next = findSpatialFocus(root, current, "right");
    if (isLeft) next = findSpatialFocus(root, current, "left");
    if (isDown) next = findSpatialFocus(root, current, "down");
    if (isUp) next = findSpatialFocus(root, current, "up");

    if (next && next !== current) {
      event.preventDefault();
      setFocus(next);
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

type Direction = "left" | "right" | "up" | "down";

function findSpatialFocus(root: HTMLElement, current: HTMLElement, direction: Direction): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const currentCenter = rectCenter(currentRect);
  const candidates = queryFocusables(root).filter((el) => el !== current);

  let best: { el: HTMLElement; score: number } | null = null;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const center = rectCenter(rect);
    const dx = center.x - currentCenter.x;
    const dy = center.y - currentCenter.y;
    const primary =
      direction === "right" ? dx : direction === "left" ? -dx : direction === "down" ? dy : -dy;
    if (primary <= 4) continue;
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const overlap = direction === "left" || direction === "right"
      ? axisOverlap(currentRect.top, currentRect.bottom, rect.top, rect.bottom)
      : axisOverlap(currentRect.left, currentRect.right, rect.left, rect.right);
    const overlapBonus = overlap > 0 ? -10_000 : 0;
    const score = overlapBonus + primary * primary + secondary * secondary * 2.5;
    if (!best || score < best.score) {
      best = { el: candidate, score };
    }
  }
  return best?.el ?? null;
}

function rectCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function axisOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function posterCard(
  id: string,
  title: string,
  imageUrl: string | undefined,
  subtitle?: string,
): string {
  return dashboardCard("history", id, title, imageUrl, subtitle);
}

export type DashboardCardKind = "history" | "live" | "movie" | "series";

export function dashboardCard(
  kind: DashboardCardKind,
  id: string,
  title: string,
  imageUrl: string | undefined,
  subtitle?: string,
  extra: Record<string, string> = {},
): string {
  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? `<p class="card-subtitle">${escapeHtml(subtitle)}</p>` : "";
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />`
    : `<div class="card-placeholder">${safeTitle.slice(0, 1)}</div>`;
  const kindAttr = `data-card-kind="${kind}"`;
  const idAttr =
    kind === "history"
      ? `data-entry-id="${escapeHtml(id)}"`
      : kind === "live"
        ? `data-live-id="${escapeHtml(id)}"`
        : kind === "movie"
          ? `data-movie-id="${escapeHtml(id)}"`
          : `data-series-id="${escapeHtml(id)}"`;
  const extraAttrs = Object.entries(extra)
    .map(([key, value]) => `data-${key}="${escapeHtml(value)}"`)
    .join(" ");
  return `
    <button class="poster-card focusable" data-id="${escapeHtml(id)}" ${kindAttr} ${idAttr} ${extraAttrs} tabindex="0">
      <div class="poster-image">${image}</div>
      <p class="card-title">${safeTitle}</p>
      ${safeSubtitle}
    </button>
  `;
}
