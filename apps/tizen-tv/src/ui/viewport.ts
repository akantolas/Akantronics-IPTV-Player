let lastWidth = 0;
let lastHeight = 0;

/** Pin layout to the real Tizen window size (cold start often reports wrong height). */
export function syncAppViewport(): boolean {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width < 320 || height < 320) return false;

  const changed = width !== lastWidth || height !== lastHeight;
  lastWidth = width;
  lastHeight = height;

  const root = document.documentElement;
  root.style.setProperty("--app-width", `${width}px`);
  root.style.setProperty("--app-height", `${height}px`);
  root.style.width = `${width}px`;
  root.style.height = `${height}px`;

  document.body.style.width = `${width}px`;
  document.body.style.height = `${height}px`;

  const app = document.getElementById("app");
  if (app) {
    app.style.width = `${width}px`;
    app.style.height = `${height}px`;
  }

  return changed;
}

export function initAppViewport(onChange?: (changed: boolean) => void): () => void {
  const run = () => {
    const changed = syncAppViewport();
    if (changed) onChange?.(true);
  };

  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });

  window.addEventListener("resize", run);
  window.addEventListener("orientationchange", run);

  const onVisible = () => {
    if (document.hidden) return;
    run();
    setTimeout(run, 100);
    setTimeout(run, 300);
  };
  document.addEventListener("visibilitychange", onVisible);

  // Tizen TV: innerHeight stabilizes a few frames after launch.
  for (const delay of [50, 150, 300, 600, 1000]) {
    setTimeout(run, delay);
  }

  return () => {
    window.removeEventListener("resize", run);
    window.removeEventListener("orientationchange", run);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
