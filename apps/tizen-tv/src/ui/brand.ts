import { escapeHtml } from "./focus.js";

export const BRAND_LOGO_URL = "./brand-logo.png";

export type BrandLogoSize = "nav" | "login" | "footer";

export function brandLogo(size: BrandLogoSize = "nav", alt = "AKantronics"): string {
  return `<img class="brand-logo brand-logo-${size}" src="${BRAND_LOGO_URL}" alt="${escapeHtml(alt)}" />`;
}

export function brandLockup(options: { tagline?: boolean; compact?: boolean } = {}): string {
  const tagline = options.tagline !== false;
  const compact = options.compact ?? false;
  const size: BrandLogoSize = compact ? "nav" : "login";

  return `
    <div class="brand-lockup ${compact ? "brand-lockup-compact" : ""}">
      ${brandLogo(size)}
      ${
        tagline && !compact
          ? `<span class="brand-tagline">IPTV Player</span>`
          : ""
      }
    </div>
  `;
}
