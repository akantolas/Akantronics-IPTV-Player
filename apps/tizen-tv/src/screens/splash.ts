import { brandLockup } from "../ui/brand.js";

export function renderSplashScreen(): string {
  return `
    <div class="splash-screen" role="status" aria-live="polite">
      <div class="splash-inner">
        ${brandLockup({ compact: false })}
        <div class="spinner splash-spinner"></div>
      </div>
    </div>
  `;
}

export const SPLASH_MIN_MS = 900;
