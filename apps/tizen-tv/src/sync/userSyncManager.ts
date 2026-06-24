import type { XtreamCredentials } from "@tv/xtream-core";
import { getAppConfig, isSupabaseConfigured } from "../config.js";
import { categoryVisibilityStore } from "../data/categoryVisibility.js";
import { favoritesStore } from "../data/favoritesStore.js";
import { watchHistoryStore, type WatchEntry } from "../data/watchHistory.js";
import { pullSync, pushSync, refreshSession, signIn, signUp } from "./cloudSync.js";
import {
  activeCredentials,
  createPlaylist,
  isSessionExpired,
  type AccountSession,
  type PlaylistsState,
  type UserSyncPayload,
} from "./types.js";
import { clearSession, loadSession, saveSession } from "./sessionStore.js";

const PLAYLISTS_KEY = "tv_playlists";
const PUSH_DEBOUNCE_MS = 800;

export interface SyncStatus {
  lastSyncedAt: number | null;
  lastError: string | null;
  isSyncing: boolean;
}

export class UserSyncManager {
  private syncStatus: SyncStatus = {
    lastSyncedAt: null,
    lastError: null,
    isSyncing: false,
  };

  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressPush = false;

  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  loadPlaylists(): PlaylistsState {
    try {
      const raw = localStorage.getItem(PLAYLISTS_KEY);
      if (!raw) return { playlists: [], activePlaylistId: null };
      return JSON.parse(raw) as PlaylistsState;
    } catch {
      return { playlists: [], activePlaylistId: null };
    }
  }

  savePlaylists(state: PlaylistsState): void {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(state));
  }

  getCredentials(): XtreamCredentials | null {
    return activeCredentials(this.loadPlaylists());
  }

  saveCredentials(credentials: XtreamCredentials, name = "Κύρια playlist"): void {
    const current = this.loadPlaylists();
    const existing = current.playlists[0];
    const playlist = existing
      ? { ...existing, ...credentials, name: name.trim() || existing.name }
      : createPlaylist(name, credentials);
    this.savePlaylists({
      playlists: [playlist],
      activePlaylistId: playlist.id,
    });
  }

  collectPayload(): UserSyncPayload {
    return {
      playlists: this.loadPlaylists(),
      watchHistory: watchHistoryStore.getAll(),
      favorites: favoritesStore.getAll(),
      categoryVisibility: {
        hiddenLive: categoryVisibilityStore.hiddenLive,
        hiddenMovies: categoryVisibilityStore.hiddenMovies,
        hiddenSeries: categoryVisibilityStore.hiddenSeries,
      },
    };
  }

  applyPayload(payload: UserSyncPayload): void {
    this.suppressPush = true;
    try {
      this.savePlaylists(payload.playlists);
      watchHistoryStore.replaceAll(payload.watchHistory);
      favoritesStore.replaceAll(payload.favorites);
      categoryVisibilityStore.replaceAll(payload.categoryVisibility);
    } finally {
      this.suppressPush = false;
    }
  }

  schedulePush(): void {
    if (this.suppressPush) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      void this.pushNow().catch(() => {
        // ignore background sync errors
      });
    }, PUSH_DEBOUNCE_MS);
  }

  onWatchHistoryChanged(): void {
    this.onDataChanged();
  }

  onDataChanged(): void {
    if (loadSession()) this.schedulePush();
  }

  async resolveSession(): Promise<AccountSession | null> {
    if (!isSupabaseConfigured(getAppConfig())) return null;
    const current = loadSession();
    if (!current) return null;
    if (!isSessionExpired(current)) return current;
    try {
      const refreshed = await refreshSession(current);
      saveSession(refreshed);
      return refreshed;
    } catch {
      clearSession();
      return null;
    }
  }

  async syncAfterAccountLogin(session: AccountSession): Promise<XtreamCredentials | null> {
    saveSession(session);
    this.syncStatus.isSyncing = true;
    try {
      const activeSession = (await this.resolveSession()) ?? session;
      const remote = await pullSync(activeSession);
      if (remote) {
        this.applyPayload(remote);
        this.syncStatus.lastSyncedAt = Date.now();
        this.syncStatus.lastError = null;
        return activeCredentials(remote.playlists);
      }
      const local = this.collectPayload();
      await pushSync(activeSession, local);
      this.syncStatus.lastSyncedAt = Date.now();
      this.syncStatus.lastError = null;
      return activeCredentials(local.playlists);
    } catch (error) {
      this.syncStatus.lastError =
        error instanceof Error ? error.message : "Sync failed.";
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  async signInAccount(email: string, password: string, register = false): Promise<XtreamCredentials | null> {
    const session = register ? await signUp(email, password) : await signIn(email, password);
    return this.syncAfterAccountLogin(session);
  }

  async pullNow(): Promise<void> {
    const session = await this.resolveSession();
    if (!session) throw new Error("Δεν είσαι συνδεδεμένος.");
    this.syncStatus.isSyncing = true;
    try {
      const remote = await pullSync(session);
      if (remote) {
        this.applyPayload(remote);
      }
      this.syncStatus.lastSyncedAt = Date.now();
      this.syncStatus.lastError = null;
    } catch (error) {
      this.syncStatus.lastError = error instanceof Error ? error.message : "Sync failed.";
      throw error;
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  async pushNow(): Promise<void> {
    const session = await this.resolveSession();
    if (!session) throw new Error("Δεν είσαι συνδεδεμένος.");
    await pushSync(session, this.collectPayload());
    this.syncStatus.lastSyncedAt = Date.now();
  }

  async logout(): Promise<void> {
    try {
      await this.pushNow();
    } catch {
      // ignore push errors on logout
    }
    clearSession();
    localStorage.removeItem(PLAYLISTS_KEY);
    watchHistoryStore.replaceAll([]);
    favoritesStore.replaceAll([]);
    categoryVisibilityStore.replaceAll({ hiddenLive: [], hiddenMovies: [], hiddenSeries: [] });
  }
}

export const userSyncManager = new UserSyncManager();

export type { WatchEntry };
