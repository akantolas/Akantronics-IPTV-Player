import type { XtreamCredentials } from "@tv/xtream-core";

export interface IptvPlaylist {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
}

export interface PlaylistsState {
  playlists: IptvPlaylist[];
  activePlaylistId: string | null;
}

export interface AccountSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  expires_at: number;
}

export interface UserSyncPayload {
  playlists: PlaylistsState;
  watchHistory: import("../data/watchHistory.js").WatchEntry[];
  favorites: import("../data/favoritesStore.js").FavoriteItem[];
  categoryVisibility: import("../data/categoryVisibility.js").CategoryVisibilityPrefs;
}

export interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string | null };
}

export interface SupabaseErrorBody {
  msg?: string;
  message?: string;
  error_description?: string;
}

export function playlistToCredentials(playlist: IptvPlaylist): XtreamCredentials {
  return {
    serverUrl: playlist.serverUrl,
    username: playlist.username,
    password: playlist.password,
  };
}

export function activeCredentials(state: PlaylistsState): XtreamCredentials | null {
  const playlist =
    state.playlists.find((item) => item.id === state.activePlaylistId) ??
    state.playlists[0];
  return playlist ? playlistToCredentials(playlist) : null;
}

export function createPlaylist(
  name: string,
  credentials: XtreamCredentials,
  id: string = crypto.randomUUID(),
): IptvPlaylist {
  return {
    id,
    name: name.trim() || credentials.username,
    serverUrl: credentials.serverUrl,
    username: credentials.username,
    password: credentials.password,
  };
}

export function parsePlaylists(raw: unknown): PlaylistsState {
  if (!raw || typeof raw !== "object") return { playlists: [], activePlaylistId: null };
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.playlists)) {
    const playlists = obj.playlists as IptvPlaylist[];
    if (playlists.length > 0) {
      return {
        playlists,
        activePlaylistId: (obj.activePlaylistId as string | null) ?? playlists[0]?.id ?? null,
      };
    }
  }
  if (
    typeof obj.serverUrl === "string" &&
    typeof obj.username === "string" &&
    typeof obj.password === "string"
  ) {
    const playlist = createPlaylist("Κύρια playlist", {
      serverUrl: obj.serverUrl,
      username: obj.username,
      password: obj.password,
    });
    return { playlists: [playlist], activePlaylistId: playlist.id };
  }
  return { playlists: [], activePlaylistId: null };
}

export function isSessionExpired(session: AccountSession, now = Date.now()): boolean {
  return now >= session.expires_at - 60_000;
}

export class CloudSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudSyncError";
  }
}

export class SupabaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAuthError";
  }
}
