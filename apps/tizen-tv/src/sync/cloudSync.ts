import { getAppConfig, isSupabaseConfigured } from "../config.js";
import type { CategoryVisibilityPrefs } from "../data/categoryVisibility.js";
import type { FavoriteItem } from "../data/favoritesStore.js";
import type { WatchEntry } from "../data/watchHistory.js";
import {
  CloudSyncError,
  SupabaseAuthError,
  type AccountSession,
  type PlaylistsState,
  type SupabaseAuthResponse,
  type SupabaseErrorBody,
  type UserSyncPayload,
  parsePlaylists,
} from "./types.js";

function authHeaders(token?: string): HeadersInit {
  const config = getAppConfig();
  const headers: Record<string, string> = {
    apikey: config.supabaseAnonKey,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new SupabaseAuthError(
      "Το Supabase δεν είναι ρυθμισμένο. Αντέγραψε local.config.js από local.config.example.js.",
    );
  }
}

function parseAuthError(payload: string, code: number): string {
  try {
    const parsed = JSON.parse(payload) as SupabaseErrorBody;
    return parsed.msg ?? parsed.message ?? parsed.error_description ?? `Auth failed (${code}).`;
  } catch {
    return `Auth failed (${code}).`;
  }
}

function toSession(payload: string, fallbackEmail: string): AccountSession {
  const auth = JSON.parse(payload) as SupabaseAuthResponse;
  if (!auth.access_token || !auth.refresh_token || !auth.user?.id) {
    throw new SupabaseAuthError("Auth response missing session tokens.");
  }
  return {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    user_id: auth.user.id,
    email: auth.user.email?.trim() || fallbackEmail,
    expires_at: Date.now() + (auth.expires_in ?? 3600) * 1000,
  };
}

async function postAuth(path: string, body: unknown): Promise<string> {
  ensureConfigured();
  const config = getAppConfig();
  const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/auth/v1${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.text();
  if (!response.ok) {
    throw new SupabaseAuthError(parseAuthError(payload, response.status));
  }
  return payload;
}

export async function signIn(email: string, password: string): Promise<AccountSession> {
  const payload = await postAuth("/token?grant_type=password", { email, password });
  return toSession(payload, email);
}

export async function signUp(email: string, password: string): Promise<AccountSession> {
  try {
    const payload = await postAuth("/signup", { email, password });
    return toSession(payload, email);
  } catch {
    return signIn(email, password);
  }
}

export async function refreshSession(session: AccountSession): Promise<AccountSession> {
  const payload = await postAuth("/token?grant_type=refresh_token", {
    refresh_token: session.refresh_token,
  });
  return toSession(payload, session.email);
}

interface UserSyncRow {
  credentials?: unknown;
  watch_history?: WatchEntry[];
  favorites?: FavoriteItem[];
  category_visibility?: CategoryVisibilityPrefs;
}

export async function pullSync(session: AccountSession): Promise<UserSyncPayload | null> {
  ensureConfigured();
  const config = getAppConfig();
  const url =
    `${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/user_sync` +
    `?user_id=eq.${encodeURIComponent(session.user_id)}&select=*`;
  const response = await fetch(url, {
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) {
    throw new CloudSyncError(`Sync pull failed (${response.status}).`);
  }
  const rows = (await response.json()) as UserSyncRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    playlists: parsePlaylists(row.credentials),
    watchHistory: Array.isArray(row.watch_history) ? row.watch_history : [],
    favorites: Array.isArray(row.favorites) ? row.favorites : [],
    categoryVisibility: row.category_visibility ?? {
      hiddenLive: [],
      hiddenMovies: [],
      hiddenSeries: [],
    },
  };
}

export async function pushSync(session: AccountSession, payload: UserSyncPayload): Promise<void> {
  ensureConfigured();
  const config = getAppConfig();
  const response = await fetch(`${config.supabaseUrl.replace(/\/+$/, "")}/rest/v1/user_sync`, {
    method: "POST",
    headers: {
      ...authHeaders(session.access_token),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: session.user_id,
      credentials: payload.playlists,
      watch_history: payload.watchHistory,
      favorites: payload.favorites,
      category_visibility: payload.categoryVisibility,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new CloudSyncError(`Sync push failed (${response.status}).`);
  }
}
