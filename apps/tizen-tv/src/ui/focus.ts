const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), .focusable:not([aria-disabled="true"])';

export function queryFocusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function setFocus(el: HTMLElement | null): void {
  if (!el) return;
  el.focus({ preventScroll: true });
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

export function bindRemoteNavigation(root: HTMLElement, onBack?: () => void): () => void {
  const handler = (event: KeyboardEvent) => {
    const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode;
    if (event.key === "Backspace" || event.key === "Escape" || keyCode === 10009 || keyCode === 461) {
      event.preventDefault();
      onBack?.();
      return;
    }

    const current = document.activeElement as HTMLElement | null;
    if (!current || !root.contains(current)) return;

    const focusables = queryFocusables(root);
    const index = focusables.indexOf(current);
    if (index < 0) return;

    let next: HTMLElement | null = null;
    if (event.key === "ArrowRight" || keyCode === 39) next = focusables[index + 1] ?? current;
    if (event.key === "ArrowLeft" || keyCode === 37) next = focusables[index - 1] ?? current;
    if (event.key === "ArrowDown" || keyCode === 40) next = focusables[index + 1] ?? current;
    if (event.key === "ArrowUp" || keyCode === 38) next = focusables[Math.max(0, index - 1)] ?? current;

    if (next && next !== current) {
      event.preventDefault();
      setFocus(next);
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
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
  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? `<p class="card-subtitle">${escapeHtml(subtitle)}</p>` : "";
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />`
    : `<div class="card-placeholder">${safeTitle.slice(0, 1)}</div>`;
  return `
    <button class="poster-card focusable" data-id="${escapeHtml(id)}" tabindex="0">
      <div class="poster-image">${image}</div>
      <p class="card-title">${safeTitle}</p>
      ${safeSubtitle}
    </button>
  `;
}
