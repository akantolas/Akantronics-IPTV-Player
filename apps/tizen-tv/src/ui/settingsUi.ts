import { escapeHtml } from "./focus.js";

const SETTINGS_ICONS: Record<string, string> = {
  sync: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`,
  playlist: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
  cache: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 20h20v-4H2v4zm2-3h1v1H4v-1zM2 4v4h20V4H2zm4 3H5V5h1v2zm-4 7h20v-4H2v4zm2-3h1v1H4v-1z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>`,
  tune: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
  epg: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>`,
  cloudUp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`,
  cloudDown: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
};

export type SettingsIconName = keyof typeof SETTINGS_ICONS;

export function settingsIcon(name: SettingsIconName): string {
  return SETTINGS_ICONS[name] ?? "";
}

export function renderSettingsSectionHeader(title: string): string {
  return `<h2 class="settings-section__title">${escapeHtml(title)}</h2>`;
}

export function renderSettingsNavRow(
  id: string,
  icon: SettingsIconName,
  title: string,
  subtitle: string,
): string {
  return `
    <button id="${escapeHtml(id)}" class="settings-row focusable" type="button" tabindex="0">
      <span class="settings-row__icon">${settingsIcon(icon)}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">${escapeHtml(title)}</span>
        <span class="settings-row__subtitle">${escapeHtml(subtitle)}</span>
      </span>
      <span class="settings-row__chevron">${settingsIcon("chevron")}</span>
    </button>
  `;
}

export function renderSettingsActionRow(
  id: string,
  icon: SettingsIconName,
  title: string,
  subtitle: string,
  primary = false,
): string {
  const cls = primary ? "settings-action-row settings-action-row--primary" : "settings-action-row";
  return `
    <button id="${escapeHtml(id)}" class="${cls} focusable" type="button" tabindex="0">
      <span class="settings-row__icon">${settingsIcon(icon)}</span>
      <span class="settings-row__body">
        <span class="settings-row__title">${escapeHtml(title)}</span>
        <span class="settings-row__subtitle">${escapeHtml(subtitle)}</span>
      </span>
      <span class="settings-action-row__spinner" aria-hidden="true"></span>
    </button>
  `;
}
