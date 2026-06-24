import type { AccountSession } from "./types.js";

const STORAGE_KEY = "tv_account_session";

export function loadSession(): AccountSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AccountSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AccountSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
