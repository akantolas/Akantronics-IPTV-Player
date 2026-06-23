import type { DetailContext, PendingBrowse, PlayerSession, ScreenId } from "../types/global.js";
import type { XtreamCredentials } from "@tv/xtream-core";
import { contentService } from "../data/contentService.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { loadSession } from "../sync/sessionStore.js";

export interface AppState {
  screen: ScreenId;
  accountEmail: string | null;
  credentials: XtreamCredentials | null;
  detail: DetailContext | null;
  player: PlayerSession | null;
  loading: boolean;
  error: string | null;
  navSection: "home" | "live" | "movies" | "series" | "settings";
  settingsSubpanel: "categories" | "playlists" | null;
  categoryTab: "live" | "movies" | "series";
  categorySearch: string;
  pendingBrowse: PendingBrowse | null;
  detailLoading: boolean;
}

type Listener = (state: AppState) => void;

export class AppStore {
  private state: AppState = {
    screen: "login",
    accountEmail: loadSession()?.email ?? null,
    credentials: userSyncManager.getCredentials(),
    detail: null,
    player: null,
    loading: true,
    error: null,
    navSection: "home",
    settingsSubpanel: null,
    categoryTab: "live",
    categorySearch: "",
    pendingBrowse: null,
    detailLoading: false,
  };

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): AppState {
    return this.state;
  }

  private patch(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  async bootstrap(): Promise<void> {
    this.patch({ loading: true, error: null });
    try {
      const session = await userSyncManager.resolveSession();
      if (session) {
        this.patch({ accountEmail: session.email });
        try {
          const credentials = await userSyncManager.syncAfterAccountLogin(session);
          if (credentials) {
            await contentService.authenticate(credentials);
            this.patch({
              credentials,
              screen: "home",
              loading: false,
              navSection: "home",
            });
            return;
          }
        } catch {
          // fall through to local credentials
        }
      }

      const local = userSyncManager.getCredentials();
      if (local) {
        await contentService.authenticate(local);
        this.patch({
          credentials: local,
          screen: "home",
          loading: false,
          navSection: "home",
        });
        return;
      }

      this.patch({ screen: "login", loading: false });
    } catch (error) {
      this.patch({
        screen: "login",
        loading: false,
        error: error instanceof Error ? error.message : "Startup failed.",
      });
    }
  }

  setError(message: string | null): void {
    this.patch({ error: message });
  }

  setLoading(loading: boolean): void {
    this.patch({ loading });
  }

  navigate(section: AppState["navSection"], pendingBrowse: PendingBrowse | null = null): void {
    const screenMap: Record<AppState["navSection"], ScreenId> = {
      home: "home",
      live: "live",
      movies: "movies",
      series: "series",
      settings: "settings",
    };
    this.patch({
      navSection: section,
      screen: screenMap[section],
      detail: null,
      error: null,
      settingsSubpanel: null,
      pendingBrowse: section === "home" ? null : pendingBrowse,
    });
  }

  navigateToBrowse(pending: PendingBrowse): void {
    this.navigate(pending.section, pending);
  }

  consumePendingBrowse(): PendingBrowse | null {
    const pending = this.state.pendingBrowse;
    if (pending) this.patch({ pendingBrowse: null });
    return pending;
  }

  openSettingsCategories(): void {
    this.patch({
      navSection: "settings",
      screen: "settings",
      settingsSubpanel: "categories",
      categoryTab: "live",
      categorySearch: "",
      detail: null,
      error: null,
    });
  }

  openSettingsPlaylists(): void {
    this.patch({
      navSection: "settings",
      screen: "settings",
      settingsSubpanel: "playlists",
      detail: null,
      error: null,
    });
  }

  setCategoryTab(tab: AppState["categoryTab"]): void {
    this.patch({ categoryTab: tab, categorySearch: "" });
  }

  setCategorySearch(query: string): void {
    this.patch({ categorySearch: query });
  }

  closeSettingsSubpanel(): void {
    this.patch({ settingsSubpanel: null, categorySearch: "" });
  }

  openSearch(): void {
    this.patch({ screen: "search", error: null });
  }

  openDetail(detail: DetailContext): void {
    this.patch({ detail, screen: "detail", error: null, detailLoading: detail.kind === "movie" && !detail.vodInfo });
  }

  patchDetail(detail: DetailContext): void {
    this.patch({ detail, detailLoading: false });
  }

  openPlayer(session: PlayerSession): void {
    this.patch({ player: session, screen: "player", error: null });
  }

  closePlayer(): void {
    this.patch({ player: null, screen: this.state.detail ? "detail" : this.navToScreen(this.state.navSection) });
  }

  back(): void {
    if (this.state.screen === "player") {
      this.closePlayer();
      return;
    }
    if (this.state.settingsSubpanel) {
      this.closeSettingsSubpanel();
      return;
    }
    if (this.state.screen === "detail") {
      this.patch({ detail: null, screen: this.navToScreen(this.state.navSection), detailLoading: false });
      return;
    }
    if (this.state.screen === "search") {
      this.patch({ screen: "home", navSection: "home" });
      return;
    }
    if (this.state.screen !== "home" && this.state.screen !== "login") {
      this.navigate("home");
    }
  }

  private navToScreen(section: AppState["navSection"]): ScreenId {
    if (section === "home") return "home";
    if (section === "live") return "live";
    if (section === "movies") return "movies";
    if (section === "series") return "series";
    return "settings";
  }

  async completeLogin(credentials: XtreamCredentials, accountEmail?: string | null): Promise<void> {
    await contentService.authenticate(credentials);
    userSyncManager.saveCredentials(credentials);
    this.patch({
      credentials,
      accountEmail: accountEmail ?? this.state.accountEmail,
      screen: "home",
      navSection: "home",
      loading: false,
      error: null,
    });
  }

  async logout(): Promise<void> {
    await userSyncManager.logout();
    contentService.setCredentials(null);
    this.patch({
      screen: "login",
      credentials: null,
      accountEmail: null,
      detail: null,
      player: null,
      navSection: "home",
      error: null,
      pendingBrowse: null,
      detailLoading: false,
    });
  }
}

export const appStore = new AppStore();
