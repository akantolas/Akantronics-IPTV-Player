import { appStore } from "./store.js";
import { bindRemoteNavigation, initFocusRing, initNavRovingTabindex, setFocus, escapeHtml } from "../ui/focus.js";
import { navItemSelector, resolveActiveNavId } from "../ui/navActive.js";
import { renderLoginScreen } from "../screens/login.js";
import { renderShell } from "../screens/shell.js";
import { renderDashboardShell } from "../screens/dashboard.js";
import { renderBrowseScreen } from "../screens/browse.js";
import { renderSearchScreen } from "../screens/search.js";
import { renderDetailScreen, playerSessionFromButton, subtitleTracksFromVod } from "../screens/detail.js";
import { formatPlayerTime, renderPlayerLiveNow, renderPlayerScreen } from "../screens/player.js";
import {
  playerIcon,
  renderAudioPanelOptions,
  renderPlayerErrorOverlay,
  renderResumeToast,
  renderSleepPanelOptions,
  renderSubtitlePanelOptions,
  renderUpNextCard,
} from "../ui/playerChrome.js";
import { renderSettingsScreen, loadCategoryItems, loadSettingsPlaylistMeta } from "../screens/settings.js";
import { renderCategoryVisibilityScreen } from "../screens/settingsCategories.js";
import { favoriteFromLive, favoriteFromMovie, favoriteFromSeries, favoritesStore } from "../data/favoritesStore.js";
import { categoryVisibilityStore, FAVORITES_CATEGORY_ID } from "../data/categoryVisibility.js";
import { loadBrowseCategories, loadFeaturedMovie, loadFeaturedSeries, renderBrowseGrid, renderBrowseRows, renderBrowseSearchGrid } from "../data/browseLoader.js";
import { renderMovieHero } from "../ui/movieHero.js";
import { renderSeriesHero } from "../ui/seriesHero.js";
import { browseSearchScopeHint } from "../data/browseExtras.js";
import { contentService } from "../data/contentService.js";
import { recentSearchStore } from "../data/recentSearchStore.js";
import { userMessage } from "../data/errors.js";
import { pinLock } from "../data/pinLock.js";
import { AvPlayController } from "../player/avPlayController.js";
import { LivePlayerController, resolveZapChannels } from "../player/livePlayerController.js";
import { createPlayerKeyHandler, registerPlayerRemoteKeys } from "../player/playerRemoteKeys.js";
import { renderChannelBrowserOverlay, renderZapBanner } from "../screens/channelBrowser.js";
import { buildGuideModel, renderEpgGuideScreen } from "../screens/epgGuide.js";
import { renderSplashScreen, SPLASH_MIN_MS } from "../screens/splash.js";
import { toNowNext } from "../data/epgUtils.js";
import { catalogIndex } from "../data/catalogIndex.js";
import { playerSessionFromEntry } from "../data/resumePlayback.js";
import { watchHistoryStore, seriesEpisodeId, type WatchEntry } from "../data/watchHistory.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { findNextEpisode } from "../data/nextEpisode.js";
import { renderPlaylistsScreen, loadPlaylistExpiryLabels } from "../screens/settingsPlaylists.js";
import { renderErrorState } from "../ui/states.js";
import { syncAppViewport } from "../ui/viewport.js";
import { createPlaylist, playlistToCredentials, type IptvPlaylist } from "../sync/types.js";
import type { DetailContext, PlayerSession } from "../types/global.js";
import type { SeriesEpisode } from "@tv/xtream-core";
import { bindDashboardCards, handleDashboardCardClick } from "../dashboard/dashboardActions.js";
import { updatePosterStackMeta } from "../dashboard/posterStack.js";
import { getDashboardSnapshot } from "../dashboard/dashboardCache.js";
import { refreshDashboardLocal } from "../data/dashboardService.js";

export class App {
  private root: HTMLElement;
  private unbindRemote: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private playerController: AvPlayController | null = null;
  private activePlayerSession: PlayerSession | null = null;
  private pendingPlayButton: HTMLElement | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private browseSearchDebounce: ReturnType<typeof setTimeout> | null = null;
  private chromeHideTimer: ReturnType<typeof setTimeout> | null = null;
  private playerChromeClickHandler: (() => void) | null = null;
  private playerPageWakeHandler: ((event: Event) => void) | null = null;
  private playerChromeIsLive = false;
  private lastChromeWakeAt = 0;
  private playerKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private pendingNextEpisode: SeriesEpisode | null = null;
  private pendingNextBaseSession: PlayerSession | null = null;
  private activeSubtitleId = "off";
  private settingsUnlocked = false;
  private pendingProtectedSettingsAction: (() => void) | null = null;
  private pendingProtectedPlayAction: (() => void) | null = null;
  private livePlayerController = new LivePlayerController();
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private immersiveWallTimer: ReturnType<typeof setInterval> | null = null;
  private immersivePlaybackTimer: ReturnType<typeof setInterval> | null = null;
  private upNextTimer: ReturnType<typeof setInterval> | null = null;
  private upNextCountdown = 0;
  private trickToastTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeToastTimer: ReturnType<typeof setTimeout> | null = null;
  private splashMinWait: Promise<void> | null = null;
  private settingsStatusTimer: ReturnType<typeof setTimeout> | null = null;
  private dashboardData: import("../data/dashboardService.js").DashboardData | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.splashMinWait = new Promise((resolve) => setTimeout(resolve, SPLASH_MIN_MS));
    this.unsubscribe = appStore.subscribe((state) => this.render(state));
    void appStore.bootstrap().then(() => {
      void catalogIndex.rebuild();
    });
    watchHistoryStore.subscribe(() => this.onDashboardLocalDataChanged());
    favoritesStore.subscribe(() => this.onDashboardLocalDataChanged());
    categoryVisibilityStore.subscribe(() => {
      void import("../dashboard/dashboardCache.js").then(({ invalidateDashboardCache }) => {
        invalidateDashboardCache();
        if (appStore.getState().screen === "home") {
          void this.loadDashboard(true);
        }
      });
    });
    window.addEventListener("resize", () => {
      syncAppViewport();
      this.onViewportChange();
    });
  }

  onViewportChange(): void {
    this.playerController?.resize();
  }

  private render(state: ReturnType<typeof appStore.getState>): void {
    this.unbindRemote?.();
    this.unbindRemote = null;
    document.documentElement.classList.toggle("is-player-active", state.screen === "player");
    document.body.classList.toggle("is-player-active", state.screen === "player");

    if (state.loading && state.screen === "login") {
      this.root.innerHTML = renderSplashScreen();
      return;
    }

    if (state.screen === "epgGuide") {
      this.root.innerHTML = renderEpgGuideScreen({ channels: [], slotStartMs: Date.now(), slotCount: 8, slotMinutes: 30 }, true);
      void this.loadEpgGuide(state.epgGuideCategoryId);
      this.unbindRemote = bindRemoteNavigation(this.root, () => appStore.back());
      return;
    }

    if (state.screen === "login") {
      this.root.innerHTML = renderLoginScreen(state);
      this.mountLoginHandlers();
      initFocusRing(this.root);
      this.unbindRemote = bindRemoteNavigation(this.root);
      const first = this.root.querySelector<HTMLElement>(".focusable");
      setFocus(first);
      return;
    }

    if (state.screen === "player" && state.player) {
      this.root.innerHTML = renderPlayerScreen(state.player);
      initFocusRing(this.root);
      void this.startPlayer(state.player);
      this.unbindRemote = bindRemoteNavigation(this.root, () => this.exitPlayer());
      return;
    }

    const browseActions = {
      openPlayer: (session: PlayerSession) => appStore.openPlayer(session),
      openDetail: (detail: DetailContext) => {
        if (detail.kind === "live" && pinLock.isCategoryLocked(detail.categoryId, detail.categoryLabel)) {
          this.runProtectedPlayAction(() => appStore.openDetail(detail));
          return;
        }
        appStore.openDetail(detail);
      },
    };

    const homePrefill =
      state.screen === "home" && getDashboardSnapshot()
        ? refreshDashboardLocal(getDashboardSnapshot()!)
        : undefined;

    const content =
      state.screen === "home"
        ? renderDashboardShell(homePrefill)
        : state.screen === "search"
          ? renderSearchScreen()
          : state.screen === "live" || state.screen === "movies" || state.screen === "series"
            ? renderBrowseScreen(state)
            : state.screen === "detail" && state.detail
              ? renderDetailScreen(state.detail, state.detailLoading)
              : state.screen === "settings" && state.settingsSubpanel === "categories"
                ? `<section class="page settings-page"><div id="category-settings-content" class="loading-inline">Φόρτωση…</div></section>`
                : state.screen === "settings" && state.settingsSubpanel === "playlists"
                  ? renderPlaylistsScreen()
                  : state.screen === "settings"
                  ? renderSettingsScreen(state)
                  : renderDashboardShell();

    this.root.innerHTML = renderShell(state, content);
    this.mountShellHandlers();
    initFocusRing(this.root);
    initNavRovingTabindex(this.root);
    this.unbindRemote = bindRemoteNavigation(this.root, () => appStore.back());

    if (state.screen === "home") {
      void this.loadDashboard();
    } else if (state.screen === "search") {
      this.mountSearchHandlers();
    } else if (state.screen === "live" || state.screen === "movies" || state.screen === "series") {
      void this.loadBrowse(state.screen, browseActions);
    } else if (state.screen === "settings" && state.settingsSubpanel === "categories") {
      void this.loadCategorySettings(state);
    } else if (state.screen === "settings" && state.settingsSubpanel === "playlists") {
      this.mountPlaylistHandlers();
      void loadPlaylistExpiryLabels();
    } else if (state.screen === "detail" && state.detail?.kind === "movie" && state.detailLoading) {
      void this.loadMovieDetail(state.detail);
    } else if (state.screen === "detail" && state.detail?.kind === "live" && !state.detail.epgLoaded) {
      void this.loadLiveDetail(state.detail);
    }

    if (state.screen === "detail") {
      const focusEpisode = state.detail?.focusEpisodeId
        ? this.root.querySelector<HTMLElement>(
            `.episode-btn[data-episode-id="${state.detail.focusEpisodeId}"]`,
          )
        : null;
      setFocus(
        focusEpisode
          ?? this.root.querySelector<HTMLElement>("#detail-back")
          ?? this.root.querySelector<HTMLElement>(".shell-content .focusable"),
      );
    } else if (state.screen === "search") {
      setFocus(this.root.querySelector<HTMLElement>("#search-input"));
    } else {
      setFocus(this.resolveInitialShellFocus(state));
    }
  }

  private resolveInitialShellFocus(state: ReturnType<typeof appStore.getState>): HTMLElement | null {
    if (state.screen === "home") {
      return (
        this.root.querySelector<HTMLElement>(".poster-stack-card.is-default-focus")
        ?? this.root.querySelector<HTMLElement>(".poster-stack-card")
        ?? this.root.querySelector<HTMLElement>(".shell-content .focusable")
      );
    }
    if (state.screen === "live" || state.screen === "movies" || state.screen === "series") {
      return (
        this.root.querySelector<HTMLElement>("#category-chips .focusable")
        ?? this.root.querySelector<HTMLElement>(".browse-grid .focusable")
        ?? this.root.querySelector<HTMLElement>(".shell-content .focusable")
      );
    }
    if (state.screen === "settings") {
      return (
        this.root.querySelector<HTMLElement>(".settings-page .focusable")
        ?? this.root.querySelector<HTMLElement>(navItemSelector(resolveActiveNavId(state)))
      );
    }
    return (
      this.root.querySelector<HTMLElement>(navItemSelector(resolveActiveNavId(state)))
      ?? this.root.querySelector<HTMLElement>(".shell-content .focusable")
    );
  }

  private mountLoginHandlers(): void {
    const form = this.root.querySelector<HTMLFormElement>("#login-form");
    const xtreamForm = this.root.querySelector<HTMLFormElement>("#xtream-form");
    const toggle = this.root.querySelector<HTMLButtonElement>("#toggle-register");
    const useXtream = this.root.querySelector<HTMLButtonElement>("#use-xtream");

    toggle?.addEventListener("click", () => {
      toggle.dataset.register = toggle.dataset.register === "true" ? "false" : "true";
      toggle.textContent =
        toggle.dataset.register === "true" ? "Έχω ήδη λογαριασμό" : "Δημιουργία λογαριασμού";
    });

    useXtream?.addEventListener("click", () => {
      this.root.querySelector(".login-panel-account")?.classList.add("hidden");
      this.root.querySelector(".login-panel-xtream")?.classList.remove("hidden");
      setFocus(this.root.querySelector<HTMLElement>("#xtream-server"));
    });

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitAccount(form, toggle?.dataset.register === "true");
    });

    xtreamForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitXtream(xtreamForm);
    });
  }

  private async submitAccount(form: HTMLFormElement, register: boolean): Promise<void> {
    const email = (form.querySelector<HTMLInputElement>("#account-email")?.value ?? "").trim();
    const password = form.querySelector<HTMLInputElement>("#account-password")?.value ?? "";
    appStore.setLoading(true);
    try {
      const { userSyncManager } = await import("../sync/userSyncManager.js");
      const credentials = await userSyncManager.signInAccount(email, password, register);
      if (credentials) {
        await appStore.completeLogin(credentials, email);
      } else {
        appStore.setLoading(false);
        appStore.setError("Δεν βρέθηκαν credentials IPTV. Σύνδεσε Xtream.");
        this.root.querySelector(".login-panel-account")?.classList.add("hidden");
        this.root.querySelector(".login-panel-xtream")?.classList.remove("hidden");
      }
    } catch (error) {
      appStore.setLoading(false);
      appStore.setError(userMessage(error, "Login failed."));
    }
  }

  private async submitXtream(form: HTMLFormElement): Promise<void> {
    const credentials = {
      serverUrl: (form.querySelector<HTMLInputElement>("#xtream-server")?.value ?? "").trim(),
      username: (form.querySelector<HTMLInputElement>("#xtream-user")?.value ?? "").trim(),
      password: form.querySelector<HTMLInputElement>("#xtream-pass")?.value ?? "",
    };
    appStore.setLoading(true);
    try {
      const { contentService } = await import("../data/contentService.js");
      const { userSyncManager } = await import("../sync/userSyncManager.js");
      await contentService.authenticate(credentials);
      userSyncManager.saveCredentials(credentials);
      try {
        await userSyncManager.pushNow();
      } catch {
        // optional cloud push
      }
      await appStore.completeLogin(credentials);
    } catch (error) {
      appStore.setLoading(false);
      appStore.setError(userMessage(error, "IPTV login failed."));
    }
  }

  private mountShellHandlers(): void {
    this.root.querySelectorAll<HTMLElement>("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.nav as "home" | "live" | "movies" | "series" | "settings";
        appStore.navigate(section);
      });
    });

    this.root.querySelector<HTMLElement>('[data-action="search"]')?.addEventListener("click", () => {
      appStore.openSearch();
    });

    const logout = this.root.querySelector<HTMLButtonElement>("#settings-logout");
    logout?.addEventListener("click", () => void appStore.logout());

    const syncNow = this.root.querySelector<HTMLButtonElement>("#settings-sync");
    syncNow?.addEventListener("click", () => {
      void userSyncManager.pushNow().catch((error) => appStore.setError(userMessage(error, "Sync failed.")));
    });

    const pullNow = this.root.querySelector<HTMLButtonElement>("#settings-pull");
    pullNow?.addEventListener("click", () => {
      void userSyncManager.pullNow().catch((error) => appStore.setError(userMessage(error, "Pull failed.")));
    });

    this.root.querySelector<HTMLButtonElement>("#settings-categories")?.addEventListener("click", () => {
      this.runProtectedSettingsAction(() => appStore.openSettingsCategories());
    });

    this.root.querySelector<HTMLButtonElement>("#settings-playlists")?.addEventListener("click", () => {
      this.runProtectedSettingsAction(() => appStore.openSettingsPlaylists());
    });

    this.root.querySelector<HTMLButtonElement>("#settings-clear-cache")?.addEventListener("click", () => {
      localStorage.removeItem("tv_recent_search");
      recentSearchStore.clear();
      contentService.clearCache();
      catalogIndex.invalidate();
      void import("../dashboard/dashboardCache.js").then(({ invalidateDashboardCache }) => invalidateDashboardCache());
      void import("../data/seriesProgress.js").then(({ invalidateSeriesInfoCache }) => invalidateSeriesInfoCache());
      appStore.setError(null);
      this.showSettingsStatus("Η cache καθαρίστηκε.");
    });

    this.root.querySelector<HTMLButtonElement>("#settings-refresh-epg")?.addEventListener("click", () => {
      contentService.clearEpgCache();
      appStore.setError(null);
      this.showSettingsStatus("Το πρόγραμμα ανανεώθηκε.");
    });

    this.root.querySelector<HTMLButtonElement>("#settings-reload-playlist")?.addEventListener("click", () => {
      void this.handleReloadPlaylist();
    });

    this.root.querySelector<HTMLButtonElement>("#settings-epg-guide")?.addEventListener("click", () => {
      appStore.openEpgGuide();
    });

    this.mountPinHandlers();

    this.mountDetailHandlers();
    this.mountGlobalActionHandlers();

    if (this.root.querySelector("#settings-reload-playlist")) {
      void loadSettingsPlaylistMeta();
    }
  }

  private showSettingsStatus(message: string, isError = false): void {
    const el = this.root.querySelector<HTMLElement>("#settings-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("settings-status--error", isError);
    el.classList.remove("hidden");
    if (this.settingsStatusTimer) clearTimeout(this.settingsStatusTimer);
    this.settingsStatusTimer = setTimeout(() => el.classList.add("hidden"), 4000);
  }

  private async handleReloadPlaylist(): Promise<void> {
    const btn = this.root.querySelector<HTMLButtonElement>("#settings-reload-playlist");
    if (!btn || btn.classList.contains("is-loading")) return;
    btn.classList.add("is-loading");
    btn.disabled = true;
    try {
      const { reloadActivePlaylist } = await import("../data/settingsActions.js");
      await reloadActivePlaylist();
      await loadSettingsPlaylistMeta();
      if (appStore.getState().navSection === "home") {
        void this.loadDashboard(true);
      }
      this.showSettingsStatus("Η playlist ανανεώθηκε.");
    } catch (error) {
      this.showSettingsStatus(userMessage(error, "Αποτυχία ανανέωσης playlist."), true);
    } finally {
      btn.classList.remove("is-loading");
      btn.disabled = false;
    }
  }

  private mountGlobalActionHandlers(): void {
    this.root.querySelectorAll<HTMLElement>("[data-action-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.actionTarget as "live" | "movies" | "series";
        appStore.navigate(target);
      });
    });

    this.root.querySelectorAll<HTMLElement>("[data-nav-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.navTarget as "live" | "movies" | "series" | "settings" | "search";
        if (target === "search") {
          appStore.openSearch();
          return;
        }
        appStore.navigate(target);
      });
    });

    this.root.querySelectorAll<HTMLElement>("[data-live-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        appStore.navigateToBrowse({ section: "live", categoryId: chip.dataset.liveCategory });
      });
    });
  }

  private mountDetailHandlers(): void {
    const detailBack = this.root.querySelector<HTMLButtonElement>("#detail-back");
    detailBack?.addEventListener("click", () => appStore.back());
    detailBack?.addEventListener("keydown", (event) => {
      const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode;
      if (event.key === "Enter" || keyCode === 13 || keyCode === 415) {
        event.preventDefault();
        appStore.back();
      }
    });

    const detailPlay = this.root.querySelector<HTMLButtonElement>("#detail-play");
    detailPlay?.addEventListener("click", () => this.handlePlayClick(detailPlay));

    this.root.querySelectorAll<HTMLElement>(".episode-btn").forEach((button) => {
      button.addEventListener("click", () => this.handlePlayClick(button));
    });

    this.root.querySelectorAll<HTMLElement>(".season-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const season = tab.dataset.seasonTab;
        if (!season) return;
        this.root.querySelectorAll<HTMLElement>(".season-tab").forEach((node) => {
          node.classList.toggle("is-active", node.dataset.seasonTab === season);
        });
        this.root.querySelectorAll<HTMLElement>(".season-panel").forEach((panel) => {
          panel.classList.toggle("hidden", panel.dataset.seasonPanel !== season);
        });
        setFocus(this.root.querySelector<HTMLElement>(`.season-panel[data-season-panel="${season}"] .focusable`));
      });
    });

    this.root.querySelector<HTMLButtonElement>("#detail-favorite")?.addEventListener("click", (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      this.toggleFavorite(button);
    });

    this.root.querySelector<HTMLButtonElement>("#resume-continue")?.addEventListener("click", () => {
      if (!this.pendingPlayButton) return;
      const session = playerSessionFromButton(this.pendingPlayButton, false);
      this.hideResumeDialog();
      if (session) this.enrichAndPlay(session, this.pendingPlayButton);
    });

    this.root.querySelector<HTMLButtonElement>("#resume-start-over")?.addEventListener("click", () => {
      if (!this.pendingPlayButton) return;
      const session = playerSessionFromButton(this.pendingPlayButton, true);
      this.hideResumeDialog();
      if (session) this.enrichAndPlay(session, this.pendingPlayButton);
    });

    this.root.querySelector<HTMLButtonElement>("#resume-cancel")?.addEventListener("click", () => {
      this.hideResumeDialog();
    });
  }

  private handlePlayClick(button: HTMLElement): void {
    const resumeMs = Number(button.dataset.resumeMs ?? 0);
    if (resumeMs > 0) {
      this.pendingPlayButton = button;
      this.root.querySelector("#resume-dialog")?.classList.remove("hidden");
      setFocus(this.root.querySelector<HTMLElement>("#resume-continue"));
      return;
    }
    const session = playerSessionFromButton(button, resumeMs > 0 ? false : true);
    if (!session) return;
    this.enrichAndPlay(session, button);
  }

  private enrichAndPlay(session: PlayerSession, button: HTMLElement): void {
    void this.enrichAndPlayAsync(session, button);
  }

  private async enrichAndPlayAsync(session: PlayerSession, button: HTMLElement): Promise<void> {
    const detail = appStore.getState().detail;
    if (detail?.vodInfo && session.watchType === "MOVIE") {
      session.subtitleTracks = subtitleTracksFromVod(detail);
    }
    if (detail?.seriesInfo && session.watchType === "SERIES_EPISODE") {
      session.seriesInfo = detail.seriesInfo;
    }
    if (session.watchType === "LIVE" && session.streamId) {
      const categoryId = button.dataset.categoryId || detail?.categoryId || session.liveCategoryId;
      if (categoryId && pinLock.isCategoryLocked(categoryId, detail?.categoryLabel)) {
        this.runProtectedPlayAction(() => void this.enrichAndPlayAsync(session, button));
        return;
      }
      if (categoryId) session.liveCategoryId = categoryId;
      session.zapChannels = await resolveZapChannels(
        categoryId,
        Number(session.streamId),
        session.title,
        session.imageUrl ?? "",
      );
      try {
        const epg = await contentService.getShortEpg(Number(session.streamId));
        const { now, next } = toNowNext(epg);
        session.nowProgramme = now ?? undefined;
        session.nextProgramme = next ?? undefined;
      } catch {
        session.nowProgramme = undefined;
        session.nextProgramme = undefined;
      }
      watchHistoryStore.recordLiveChannel(
        Number(session.streamId),
        session.title,
        session.imageUrl,
        session.liveCategoryId ?? categoryId ?? "",
      );
      userSyncManager.onWatchHistoryChanged();
    }
    session.aspectMode = session.aspectMode ?? "letterbox";
    session.playbackSpeed = session.playbackSpeed ?? 1;
    appStore.openPlayer(session);
  }

  private async loadMovieDetail(detail: DetailContext): Promise<void> {
    try {
      const vodInfo = await contentService.getVodInfo(detail.id);
      appStore.patchDetail({
        ...detail,
        vodInfo,
        title: vodInfo.info.name ?? detail.title,
        imageUrl: vodInfo.info.cover_big ?? vodInfo.info.movie_image ?? detail.imageUrl,
        extension: vodInfo.movie_data?.container_extension ?? detail.extension,
      });
    } catch (error) {
      appStore.patchDetail({ ...detail, vodInfo: undefined });
      appStore.setError(userMessage(error, "Detail load failed."));
    }
  }

  private async loadLiveDetail(detail: DetailContext): Promise<void> {
    try {
      const epg = await contentService.getShortEpg(detail.id);
      appStore.patchDetail({ ...detail, epg, epgLoaded: true });
    } catch {
      appStore.patchDetail({ ...detail, epg: [], epgLoaded: true });
    }
  }

  private hideResumeDialog(): void {
    this.root.querySelector("#resume-dialog")?.classList.add("hidden");
    this.pendingPlayButton = null;
  }

  private toggleFavorite(button: HTMLButtonElement): void {
    const kind = button.dataset.favKind as "MOVIE" | "SERIES" | "LIVE" | undefined;
    if (!kind) return;
    const item =
      kind === "LIVE"
        ? favoriteFromLive({
            stream_id: Number(button.dataset.streamId),
            name: button.dataset.title ?? "",
            stream_icon: button.dataset.imageUrl,
            category_id: button.dataset.categoryId,
          })
        : kind === "MOVIE"
          ? favoriteFromMovie({
              stream_id: Number(button.dataset.streamId),
              name: button.dataset.title ?? "",
              stream_icon: button.dataset.imageUrl,
              container_extension: button.dataset.extension,
            })
          : favoriteFromSeries({
              series_id: Number(button.dataset.seriesId),
              name: button.dataset.title ?? "",
              cover: button.dataset.imageUrl,
            });
    const active = favoritesStore.toggle(item);
    button.classList.toggle("is-active", active);
    button.textContent = active ? "★" : "☆";
    userSyncManager.onDataChanged();
  }

  private stopPlayerAndSave(): void {
    this.clearPlayerChromeHandler();
    this.clearPlayerKeyHandler();
    this.clearSleepTimer();
    this.clearImmersiveHud();
    this.livePlayerController.reset();
    if (this.playerController && this.activePlayerSession) {
      const { positionMs, durationMs } = this.playerController.flushProgress();
      this.persistWatchProgress(this.activePlayerSession, positionMs, durationMs);
    }
    this.playerController?.stop();
    this.activePlayerSession = null;
    this.pendingNextEpisode = null;
    this.pendingNextBaseSession = null;
    this.clearUpNextTimer();
    document.documentElement.classList.remove("is-player-active");
    document.body.classList.remove("is-player-active");
  }

  private exitPlayer(): void {
    const session = this.activePlayerSession;
    this.stopPlayerAndSave();
    if (session?.watchType === "SERIES_EPISODE" && session.seriesId) {
      const detail = appStore.getState().detail;
      if (detail?.kind === "series" && detail.id === session.seriesId) {
        appStore.patchDetail({
          ...detail,
          activeSeason: session.season != null ? String(session.season) : detail.activeSeason,
          focusEpisodeId: session.episodeId ?? undefined,
        });
      }
    }
    appStore.closePlayer();
  }

  private clearPlayerChromeHandler(): void {
    const playerPage = this.root.querySelector<HTMLElement>(".player-page");
    if (this.playerPageWakeHandler && playerPage) {
      playerPage.removeEventListener("click", this.playerPageWakeHandler);
      playerPage.removeEventListener("pointerdown", this.playerPageWakeHandler);
      this.playerPageWakeHandler = null;
    }
    if (this.playerChromeClickHandler) {
      this.root.removeEventListener("click", this.playerChromeClickHandler);
      this.playerChromeClickHandler = null;
    }
    if (this.chromeHideTimer) {
      clearTimeout(this.chromeHideTimer);
      this.chromeHideTimer = null;
    }
  }

  private clearPlayerKeyHandler(): void {
    if (this.playerKeyHandler) {
      document.removeEventListener("keydown", this.playerKeyHandler, true);
      this.playerKeyHandler = null;
    }
  }

  private persistWatchProgress(
    session: PlayerSession,
    positionMs: number,
    durationMs: number,
  ): void {
    if (!session.watchId || !session.watchType || session.watchType === "LIVE") return;
    const saved = watchHistoryStore.saveProgress(session.watchId, positionMs, durationMs, () => ({
      id: session.watchId!,
      type: session.watchType!,
      title: session.title,
      subtitle: session.subtitle,
      imageUrl: session.imageUrl,
      streamId: session.streamId ?? "",
      containerExtension: session.containerExtension,
      seriesId: session.seriesId,
      season: session.season,
      episodeId: session.episodeId,
    }));
    if (saved) userSyncManager.onWatchHistoryChanged();
  }

  private async loadDashboard(forceRefresh = false): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#dashboard-content");
    if (!container) return;

    const cacheMod = await import("../dashboard/dashboardCache.js");
    const svcMod = await import("../data/dashboardService.js");
    const dashMod = await import("../screens/dashboard.js");

    const cached = !forceRefresh ? cacheMod.getDashboardSnapshot() : null;
    if (cached) {
      let data = svcMod.refreshDashboardLocal(cached);
      data = await svcMod.enrichDashboardSeries(data);
      const expiry = await svcMod.loadDashboardExpiry();
      data = { ...data, ...expiry };
      cacheMod.setDashboardSnapshot(data);
      this.dashboardData = data;
      const localRoot = container.querySelector<HTMLElement>("#dashboard-local-root");
      const alreadyRendered = container.classList.contains("is-ready") && localRoot;
      if (!alreadyRendered) {
        container.innerHTML = dashMod.renderDashboardContent(data);
        container.classList.add("is-ready");
        syncAppViewport();
        this.mountDashboardInteractions(data, container);
        initFocusRing(container);
        const firstStackCard = container.querySelector<HTMLElement>(".poster-stack-card");
        if (firstStackCard) updatePosterStackMeta(firstStackCard);
        setFocus(container.querySelector<HTMLElement>(".focusable"));
      } else if (localRoot) {
        localRoot.innerHTML = dashMod.renderDashboardLocalSections(data);
        this.mountDashboardInteractions(data, localRoot);
        initFocusRing(localRoot);
        const firstStackCard = localRoot.querySelector<HTMLElement>(".poster-stack-card");
        if (firstStackCard) updatePosterStackMeta(firstStackCard);
      }
      return;
    }

    try {
      const data = await svcMod.loadDashboardData();
      cacheMod.setDashboardSnapshot(data);
      this.dashboardData = data;
      container.innerHTML = dashMod.renderDashboardContent(data);
      container.classList.add("is-ready");
      syncAppViewport();
      this.mountDashboardInteractions(data, container);
      initFocusRing(container);
      const firstStackCard = container.querySelector<HTMLElement>(".poster-stack-card");
      if (firstStackCard) updatePosterStackMeta(firstStackCard);
      setFocus(container.querySelector<HTMLElement>(".focusable"));
    } catch (error) {
      container.classList.remove("is-ready");
      container.innerHTML = renderErrorState(userMessage(error, "Dashboard load failed."));
      container.querySelector("#error-retry")?.addEventListener("click", () => void this.loadDashboard(true));
    }
  }

  private onDashboardLocalDataChanged(): void {
    if (appStore.getState().screen === "home") {
      void this.patchDashboardLocalRows();
    }
  }

  private async patchDashboardLocalRows(): Promise<void> {
    if (appStore.getState().screen !== "home") return;
    const container = this.root.querySelector<HTMLElement>("#dashboard-content");
    if (!container?.classList.contains("is-ready")) return;

    const cacheMod = await import("../dashboard/dashboardCache.js");
    const svcMod = await import("../data/dashboardService.js");
    const dashMod = await import("../screens/dashboard.js");
    const cached = cacheMod.getDashboardSnapshot();
    if (!cached) return;

    const data = svcMod.refreshDashboardLocal(cached);
    const enriched = await svcMod.enrichDashboardSeries(data);
    cacheMod.setDashboardSnapshot(enriched);
    this.dashboardData = enriched;

    const localRoot = container.querySelector("#dashboard-local-root");
    if (localRoot) {
      localRoot.innerHTML = dashMod.renderDashboardLocalSections(enriched);
      this.mountDashboardInteractions(enriched, localRoot);
      const firstStackCard = localRoot.querySelector<HTMLElement>(".poster-stack-card");
      if (firstStackCard) updatePosterStackMeta(firstStackCard);
    } else {
      container.innerHTML = dashMod.renderDashboardContent(enriched);
      container.classList.add("is-ready");
      this.mountDashboardInteractions(enriched, container);
    }
    initFocusRing(container);
  }

  private getDashboardActionHost(): import("../dashboard/dashboardActions.js").DashboardActionHost {
    return {
      openLiveSession: (id, title, image, cat) => this.openLiveSession(id, title, image, cat),
      openDetail: (detail) => appStore.openDetail(detail),
      openPlayer: (session) => appStore.openPlayer(session),
      playEntryWithSeriesInfo: (entry) => this.playEntryWithSeriesInfo(entry),
      navigateLive: () => appStore.navigate("live"),
    };
  }

  private async playEntryWithSeriesInfo(entry: WatchEntry): Promise<void> {
    const session = playerSessionFromEntry(entry);
    if (!session) return;
    if (session.watchType === "SERIES_EPISODE" && session.seriesId) {
      try {
        session.seriesInfo = await contentService.getSeriesInfo(session.seriesId);
      } catch {
        // resume without full series metadata
      }
    }
    if (session.watchType === "LIVE" && session.streamId) {
      await this.openLiveSession(Number(session.streamId), session.title, session.imageUrl, entry.categoryId);
      return;
    }
    appStore.openPlayer(session);
  }

  private mountDashboardInteractions(
    data: import("../data/dashboardService.js").DashboardData,
    scope: ParentNode = this.root,
  ): void {
    const host = this.getDashboardActionHost();
    bindDashboardCards(scope, host);

    scope.querySelectorAll<HTMLElement>(".poster-stack-card").forEach((card) => {
      card.addEventListener("click", () => {
        void handleDashboardCardClick(card, host);
      });
      card.addEventListener("focus", () => {
        updatePosterStackMeta(card);
      });
    });

    scope.querySelector<HTMLElement>("#hero-open-live")?.addEventListener("click", () => {
      appStore.navigate("live");
    });

    scope.querySelector<HTMLElement>("#hero-open-series")?.addEventListener("click", () => {
      appStore.navigate("series");
    });

    this.mountHistoryRemoveHandlers(scope);

    scope.querySelectorAll<HTMLElement>("[data-live-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const categoryId = chip.dataset.liveCategory;
        if (!categoryId) return;
        appStore.navigateToBrowse({ section: "live", categoryId });
      });
    });

    scope.querySelectorAll<HTMLElement>("[data-action-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.actionTarget as "live" | "movies" | "series";
        appStore.navigate(target);
      });
    });

    scope.querySelectorAll<HTMLElement>("[data-nav-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.navTarget as "live" | "movies" | "series" | "settings" | "search";
        if (target === "search") {
          appStore.openSearch();
          return;
        }
        appStore.navigate(target);
      });
    });
  }

  private mountHistoryRemoveHandlers(scope: ParentNode): void {
    scope.querySelectorAll<HTMLElement>(".history-remove").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.dataset.removeId;
        if (!id) return;
        watchHistoryStore.removeEntry(id);
        userSyncManager.onWatchHistoryChanged();
        if (appStore.getState().screen === "home") {
          void this.patchDashboardLocalRows();
        } else {
          button.closest(".history-card-wrap")?.remove();
        }
      });
    });
  }

  private mountHistoryCards(): void {
    bindDashboardCards(this.root, this.getDashboardActionHost());
    this.mountHistoryRemoveHandlers(this.root);
  }

  private mountSearchHandlers(): void {
    const form = this.root.querySelector<HTMLFormElement>("#search-form");
    const input = this.root.querySelector<HTMLInputElement>("#search-input");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runSearch(input?.value ?? "", true);
    });
    input?.addEventListener("input", () => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        void this.runSearch(input.value ?? "", false);
      }, 400);
    });

    this.root.querySelectorAll<HTMLElement>(".recent-search-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const query = chip.dataset.query ?? "";
        if (input) input.value = query;
        void this.runSearch(query, true);
      });
    });
  }

  private async runSearch(query: string, focusResults = false): Promise<void> {
    const results = this.root.querySelector<HTMLElement>("#search-results");
    if (!results) return;
    if (query.trim().length < 2) {
      results.innerHTML = `<p class="hint">Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p>`;
      return;
    }
    results.innerHTML = `<div class="loading-inline">Αναζήτηση…</div>`;
    try {
      recentSearchStore.add(query.trim());
      const { searchCatalog } = await import("../data/dashboardService.js");
      const {
        renderSearchResults,
        liveResultCard,
        movieResultCard,
        seriesResultCard,
      } = await import("../screens/search.js");
      const data = await searchCatalog(query);
      const sections = [];
      if (data.live.length) {
        sections.push({
          title: "Live",
          html: data.live.map((item) => liveResultCard(item.stream_id, item.name, item.stream_icon)).join(""),
        });
      }
      if (data.movies.length) {
        sections.push({
          title: "Ταινίες",
          html: data.movies
            .map((item) => movieResultCard(item.stream_id, item.name, item.stream_icon, item.rating))
            .join(""),
        });
      }
      if (data.series.length) {
        sections.push({
          title: "Σειρές",
          html: data.series
            .map((item) => seriesResultCard(item.series_id, item.name, item.cover, item.rating))
            .join(""),
        });
      }
      results.innerHTML = renderSearchResults(sections);
      results.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = card.dataset.id ?? "";
          const kind = card.dataset.kind ?? "movie";
          if (kind === "movie") {
            const movie = data.movies.find((item) => String(item.stream_id) === id);
            appStore.openDetail({
              kind: "movie",
              id: Number(id),
              title: movie?.name ?? "Ταινία",
              imageUrl: movie?.stream_icon,
              extension: movie?.container_extension ?? "mp4",
            });
            return;
          }
          if (kind === "live") {
            const channel = data.live.find((item) => String(item.stream_id) === id);
            appStore.openDetail({
              kind: "live",
              id: Number(id),
              title: channel?.name ?? "Live",
              imageUrl: channel?.stream_icon,
              categoryId: channel?.category_id,
            });
            return;
          }
          void this.openSearchResult(id, kind);
        });
      });
      initFocusRing(results);
      if (focusResults && sections.length > 0) {
        setFocus(results.querySelector<HTMLElement>(".poster-card"));
      }
    } catch (error) {
      results.innerHTML = `<div class="error-inline">${userMessage(error, "Search failed.")}</div>`;
    }
  }

  private async openSearchResult(id: string, kind: string): Promise<void> {
    const { contentService } = await import("../data/contentService.js");
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;

    if (kind === "live") {
      appStore.openDetail({
        kind: "live",
        id: numericId,
        title: "Live",
      });
      return;
    }

    if (kind === "series") {
      const info = await contentService.getSeriesInfo(numericId);
      appStore.openDetail({
        kind: "series",
        id: numericId,
        title: info.info.name,
        imageUrl: info.info.cover,
        seriesInfo: info,
      });
      return;
    }

    appStore.openDetail({
      kind: "movie",
      id: numericId,
      title: "Ταινία",
      extension: "mp4",
    });
  }

  private async loadBrowse(
    screen: "live" | "movies" | "series",
    actions: import("../data/browseLoader.js").BrowseActions,
  ): Promise<void> {
    const grid = this.root.querySelector<HTMLElement>("#browse-grid");
    const chips = this.root.querySelector<HTMLElement>("#category-chips");
    if (!grid || !chips) return;

    grid.innerHTML = `<div class="loading-inline">Φόρτωση περιεχομένου…</div>`;
    chips.innerHTML = "";
    try {
      const { initFocusRing, setFocus } = await import("../ui/focus.js");
      const pending = appStore.consumePendingBrowse();
      const categories = await loadBrowseCategories(screen);
      chips.innerHTML = this.renderBrowseCategoryChips(categories, pending?.categoryId);
      const result =
        pending?.section === screen && pending.categoryId
          ? await renderBrowseGrid(screen, pending.categoryId, actions)
          : await renderBrowseRows(screen, actions);
      grid.classList.toggle("browse-grid-compact", Boolean(pending?.categoryId));
      grid.innerHTML = result.html;
      result.bind(grid);
      this.mountBrowseCategoryChips(screen, grid, chips, actions);
      this.updateBrowseSearchHint(screen, chips);
      initFocusRing(grid);
      initFocusRing(chips);
      setFocus(chips.querySelector<HTMLElement>(".chip.active") ?? grid.querySelector<HTMLElement>(".focusable"));
      this.mountBrowseSearchHandlers(screen, grid, actions);
      this.mountHistoryCards();
      if (screen === "series") {
        void this.mountSeriesHero(actions);
      }
      if (screen === "movies") {
        void this.mountMovieHero(actions);
      }
      this.root.querySelector<HTMLButtonElement>("#browse-epg-guide")?.addEventListener("click", () => {
        const activeChip = chips.querySelector<HTMLElement>(".chip.active");
        appStore.openEpgGuide(activeChip?.dataset.browseCategory);
      });
    } catch (error) {
      grid.innerHTML = `<div class="error-inline">${error instanceof Error ? error.message : "Load failed."}</div>`;
    }
  }

  private async mountSeriesHero(
    actions: import("../data/browseLoader.js").BrowseActions,
  ): Promise<void> {
    const hero = this.root.querySelector<HTMLElement>("#series-hero");
    if (!hero) return;

    let featured: import("@tv/xtream-core").SeriesItem | null = null;
    try {
      featured = await loadFeaturedSeries();
    } catch {
      featured = null;
    }

    if (!featured) {
      hero.innerHTML = "";
      hero.classList.add("hidden");
      return;
    }

    const series = featured;
    hero.classList.remove("hidden");
    hero.innerHTML = renderSeriesHero(series);
    initFocusRing(hero);

    hero.querySelector<HTMLButtonElement>("#series-hero-open")?.addEventListener("click", () => {
      void (async () => {
        try {
          const info = await contentService.getSeriesInfo(series.series_id);
          actions.openDetail({
            kind: "series",
            id: series.series_id,
            title: info.info.name,
            imageUrl: info.info.cover,
            seriesInfo: info,
          });
        } catch {
          actions.openDetail({
            kind: "series",
            id: series.series_id,
            title: series.name,
            imageUrl: series.cover,
          });
        }
      })();
    });

    hero.querySelector<HTMLButtonElement>("#series-hero-shuffle")?.addEventListener("click", () => {
      void this.mountSeriesHero(actions).then(() => {
        setFocus(this.root.querySelector<HTMLElement>("#series-hero-open"));
      });
    });
  }

  private async mountMovieHero(
    actions: import("../data/browseLoader.js").BrowseActions,
  ): Promise<void> {
    const hero = this.root.querySelector<HTMLElement>("#movies-hero");
    if (!hero) return;

    let featured: import("../data/browseLoader.js").FeaturedMovie | null = null;
    try {
      featured = await loadFeaturedMovie();
    } catch {
      featured = null;
    }

    if (!featured) {
      hero.innerHTML = "";
      hero.classList.add("hidden");
      return;
    }

    const { stream, info, vodInfo } = featured;
    hero.classList.remove("hidden");
    hero.innerHTML = renderMovieHero(stream, info);
    initFocusRing(hero);

    hero.querySelector<HTMLButtonElement>("#movies-hero-open")?.addEventListener("click", () => {
      const extension = vodInfo?.movie_data?.container_extension ?? stream.container_extension ?? "mp4";
      const title = info?.name ?? stream.name;
      const imageUrl = info?.cover_big ?? info?.movie_image ?? stream.stream_icon;
      actions.openDetail({
        kind: "movie",
        id: stream.stream_id,
        title,
        imageUrl,
        extension,
        vodInfo,
      });
    });

    hero.querySelector<HTMLButtonElement>("#movies-hero-shuffle")?.addEventListener("click", () => {
      void this.mountMovieHero(actions).then(() => {
        setFocus(this.root.querySelector<HTMLElement>("#movies-hero-open"));
      });
    });
  }

  private renderBrowseCategoryChips(
    categories: Array<{ category_id: string; category_name: string }>,
    activeCategoryId?: string,
  ): string {
    return categories
      .map(
        (category, index) => `
          <button
            class="chip focusable ${activeCategoryId === category.category_id ? "active" : ""}"
            data-browse-category="${escapeHtml(category.category_id)}"
            tabindex="${index === 0 ? 0 : -1}"
          >${escapeHtml(category.category_name)}</button>
        `,
      )
      .join("");
  }

  private mountBrowseCategoryChips(
    screen: "live" | "movies" | "series",
    grid: HTMLElement,
    chips: HTMLElement,
    actions: import("../data/browseLoader.js").BrowseActions,
  ): void {
    chips.querySelectorAll<HTMLElement>("[data-browse-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const categoryId = chip.dataset.browseCategory;
        if (!categoryId) return;
        void (async () => {
          chips.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
          chip.classList.add("active");
          this.updateBrowseSearchHint(screen, chips);
          const input = this.root.querySelector<HTMLInputElement>("#browse-search-input");
          const query = input?.value.trim() ?? "";
          if (query.length >= 2) {
            grid.classList.add("browse-grid-compact");
            grid.innerHTML = `<div class="loading-inline">Αναζήτηση…</div>`;
            const result = await renderBrowseSearchGrid(screen, query, actions, categoryId);
            grid.innerHTML = result.html;
            result.bind(grid);
            initFocusRing(grid);
            setFocus(grid.querySelector<HTMLElement>(".focusable") ?? chip);
            return;
          }
          grid.classList.add("browse-grid-compact");
          grid.innerHTML = `<div class="loading-inline">Φόρτωση κατηγορίας…</div>`;
          const result = await renderBrowseGrid(screen, categoryId, actions);
          grid.innerHTML = result.html;
          result.bind(grid);
          initFocusRing(grid);
          setFocus(grid.querySelector<HTMLElement>(".focusable") ?? chip);
        })();
      });
    });
  }

  private getActiveBrowseCategory(chips: HTMLElement): { id?: string; name?: string } {
    const active = chips.querySelector<HTMLElement>(".chip.active");
    const id = active?.dataset.browseCategory;
    if (!id) return {};
    const name = active?.textContent?.trim() ?? undefined;
    return { id, name };
  }

  private updateBrowseSearchHint(screen: "live" | "movies" | "series", chips: HTMLElement): void {
    const hint = this.root.querySelector<HTMLElement>("#browse-search-hint");
    if (!hint) return;
    const { id, name } = this.getActiveBrowseCategory(chips);
    hint.textContent = browseSearchScopeHint(screen, id, name);
  }

  private mountBrowseSearchHandlers(
    screen: "live" | "movies" | "series",
    grid: HTMLElement,
    actions: import("../data/browseLoader.js").BrowseActions,
  ): void {
    const chips = this.root.querySelector<HTMLElement>("#category-chips");
    if (!chips) return;
    const form = this.root.querySelector<HTMLFormElement>("#browse-search-form");
    const input = this.root.querySelector<HTMLInputElement>("#browse-search-input");
    const clear = this.root.querySelector<HTMLButtonElement>("#browse-search-clear");
    if (!form || !input) return;

    const renderDefault = async () => {
      const { id: categoryId } = this.getActiveBrowseCategory(chips);
      if (categoryId) {
        grid.classList.add("browse-grid-compact");
        const result = await renderBrowseGrid(screen, categoryId, actions);
        grid.innerHTML = result.html;
        result.bind(grid);
      } else {
        const result = await renderBrowseRows(screen, actions);
        grid.classList.remove("browse-grid-compact");
        grid.innerHTML = result.html;
        result.bind(grid);
      }
      initFocusRing(grid);
      this.mountHistoryCards();
    };

    const runSearch = async (focusResults: boolean) => {
      const query = input.value.trim();
      if (query.length < 2) {
        await renderDefault();
        return;
      }
      const { id: categoryId } = this.getActiveBrowseCategory(chips);
      grid.classList.add("browse-grid-compact");
      grid.innerHTML = `<div class="loading-inline">Αναζήτηση…</div>`;
      const result = await renderBrowseSearchGrid(screen, query, actions, categoryId);
      grid.innerHTML = result.html;
      result.bind(grid);
      initFocusRing(grid);
      if (focusResults) {
        setFocus(grid.querySelector<HTMLElement>(".focusable") ?? input);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void runSearch(true);
    });

    input.addEventListener("input", () => {
      if (this.browseSearchDebounce) clearTimeout(this.browseSearchDebounce);
      this.browseSearchDebounce = setTimeout(() => {
        void runSearch(false);
      }, 350);
    });

    clear?.addEventListener("click", () => {
      input.value = "";
      void renderDefault().then(() => setFocus(input));
    });
  }

  private async loadCategorySettings(state: ReturnType<typeof appStore.getState>): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#category-settings-content");
    if (!container) return;
    try {
      const items = await loadCategoryItems(state.categoryTab);
      container.innerHTML = renderCategoryVisibilityScreen(state.categoryTab, items, state.categorySearch);
      this.mountCategoryVisibilityHandlers(items.map((item) => item.id));
      initFocusRing(container);
      setFocus(container.querySelector<HTMLElement>(".focusable"));
    } catch (error) {
      container.innerHTML = `<div class="error-inline">${error instanceof Error ? error.message : "Load failed."}</div>`;
    }
  }

  private mountCategoryVisibilityHandlers(allCategoryIds: string[]): void {
    this.root.querySelector<HTMLButtonElement>("#settings-back")?.addEventListener("click", () => {
      appStore.closeSettingsSubpanel();
    });

    this.root.querySelectorAll<HTMLElement>("[data-cat-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        appStore.setCategoryTab(tab.dataset.catTab as "live" | "movies" | "series");
      });
    });

    const searchInput = this.root.querySelector<HTMLInputElement>("#category-search-input");
    searchInput?.addEventListener("input", () => {
      appStore.setCategorySearch(searchInput.value);
    });

    this.root.querySelector<HTMLButtonElement>("#cat-show-all")?.addEventListener("click", () => {
      categoryVisibilityStore.setAllVisible(appStore.getState().categoryTab);
      userSyncManager.onDataChanged();
      void this.loadCategorySettings(appStore.getState());
    });

    this.root.querySelector<HTMLButtonElement>("#cat-hide-all")?.addEventListener("click", () => {
      categoryVisibilityStore.setAllHidden(appStore.getState().categoryTab, allCategoryIds);
      userSyncManager.onDataChanged();
      void this.loadCategorySettings(appStore.getState());
    });

    this.root.querySelectorAll<HTMLInputElement>(".visibility-toggle").forEach((toggle) => {
      toggle.addEventListener("change", () => {
        const section = appStore.getState().categoryTab;
        categoryVisibilityStore.setVisible(section, toggle.dataset.categoryId ?? "", toggle.checked);
        userSyncManager.onDataChanged();
      });
    });
  }

  private clearUpNextTimer(): void {
    if (this.upNextTimer) {
      clearInterval(this.upNextTimer);
      this.upNextTimer = null;
    }
  }

  private isSidePanelOpen(): boolean {
    return !this.root.querySelector("#player-side-panel")?.classList.contains("hidden");
  }

  private isUpNextOpen(): boolean {
    return Boolean(this.root.querySelector("#player-up-next"));
  }

  private isProgressTrackFocused(): boolean {
    return document.activeElement?.id === "player-progress-track";
  }

  private closeSidePanel(): boolean {
    const panel = this.root.querySelector("#player-side-panel");
    if (!panel || panel.classList.contains("hidden")) return false;
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    this.root.querySelector("#player-side-panel-backdrop")?.classList.add("hidden");
    return true;
  }

  private openSidePanel(kind: "subtitles" | "audio" | "sleep"): void {
    const session = this.activePlayerSession;
    const panel = this.root.querySelector<HTMLElement>("#player-side-panel");
    const backdrop = this.root.querySelector<HTMLElement>("#player-side-panel-backdrop");
    const titleEl = this.root.querySelector<HTMLElement>("#player-side-panel-title");
    const body = this.root.querySelector<HTMLElement>("#player-side-panel-body");
    if (!session || !panel || !titleEl || !body) return;

    if (kind === "subtitles") {
      titleEl.textContent = "Υπότιτλοι";
      body.innerHTML = renderSubtitlePanelOptions(session.subtitleTracks ?? []);
      body.querySelectorAll<HTMLElement>(".player-side-option").forEach((option) => {
        option.addEventListener("click", () => {
          const trackId = option.dataset.subtitleId ?? "off";
          this.activeSubtitleId = trackId;
          this.playerController?.setSubtitleTrack(trackId, session.subtitleTracks ?? []);
          this.closeSidePanel();
        });
      });
    } else if (kind === "audio") {
      titleEl.textContent = "Ήχος";
      body.innerHTML = renderAudioPanelOptions(session.audioTracks ?? []);
      body.querySelectorAll<HTMLElement>(".player-side-option").forEach((option) => {
        option.addEventListener("click", () => {
          this.playerController?.setAudioTrack(option.dataset.audioId ?? "");
          this.closeSidePanel();
        });
      });
    } else {
      titleEl.textContent = "Χρονοδιακόπτης ύπνου";
      body.innerHTML = renderSleepPanelOptions();
      body.querySelectorAll<HTMLElement>(".sleep-option").forEach((option) => {
        option.addEventListener("click", () => {
          const minutes = Number(option.dataset.sleepMin ?? 0);
          this.setSleepTimer(minutes);
          this.updateSleepToolbarLabel(minutes > 0);
          this.closeSidePanel();
        });
      });
    }

    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    backdrop?.classList.remove("hidden");
    setFocus(body.querySelector<HTMLElement>(".focusable"));
  }

  private updateSleepToolbarLabel(active: boolean): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#player-sleep");
    if (!btn) return;
    const label = btn.querySelector<HTMLElement>(".player-toolbar-btn__label");
    if (label) label.textContent = active ? "ON" : "Ύπνος";
    btn.classList.toggle("is-active", active);
  }

  private updateToolbarAspectLabel(mode: NonNullable<PlayerSession["aspectMode"]>): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#player-aspect");
    const label = btn?.querySelector<HTMLElement>(".player-toolbar-btn__label");
    if (label) label.textContent = mode === "letterbox" ? "Fit" : mode === "full" ? "Fill" : "Zoom";
  }

  private updateToolbarSpeedLabel(speed: number): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#player-speed");
    const label = btn?.querySelector<HTMLElement>(".player-toolbar-btn__label");
    if (label) label.textContent = `${speed}×`;
  }

  private updatePlayPauseIcon(playing: boolean): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#player-play-pause");
    if (!btn) return;
    btn.innerHTML = playing ? playerIcon("pause") : playerIcon("play");
  }

  private showTrickToast(label: string): void {
    const toast = this.root.querySelector<HTMLElement>("#player-trick-toast");
    if (!toast) return;
    toast.textContent = label;
    toast.classList.remove("hidden");
    if (this.trickToastTimer) clearTimeout(this.trickToastTimer);
    this.trickToastTimer = setTimeout(() => toast.classList.add("hidden"), 800);
  }

  private showResumeToast(positionMs: number): void {
    const toast = this.root.querySelector<HTMLElement>("#player-resume-toast");
    if (!toast) return;
    toast.textContent = renderResumeToast(positionMs);
    toast.classList.remove("hidden");
    if (this.resumeToastTimer) clearTimeout(this.resumeToastTimer);
    this.resumeToastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
  }

  private updateProgressUi(positionMs: number, durationMs: number): void {
    const currentEl = this.root.querySelector<HTMLElement>("#player-current");
    const remainingEl = this.root.querySelector<HTMLElement>("#player-remaining");
    const fill = this.root.querySelector<HTMLElement>("#player-progress-fill");
    const thumb = this.root.querySelector<HTMLElement>("#player-progress-thumb");
    const track = this.root.querySelector<HTMLElement>("#player-progress-track");
    if (currentEl) currentEl.textContent = formatPlayerTime(positionMs);
    if (remainingEl) {
      remainingEl.textContent =
        durationMs > 0 ? `-${formatPlayerTime(Math.max(0, durationMs - positionMs))}` : "-0:00";
    }
    const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(pct * 10)));
  }

  private seekBy(seconds: number): void {
    if (!this.playerController) return;
    const next = Math.max(0, this.playerController.getCurrentTimeMs() + seconds * 1000);
    this.playerController.seek(next);
    this.showTrickToast(seconds > 0 ? `+${Math.abs(seconds)}s` : `-${Math.abs(seconds)}s`);
  }

  private dismissUpNext(leavePlayer = false): void {
    this.clearUpNextTimer();
    const host = this.root.querySelector<HTMLElement>("#player-up-next-host");
    if (host) host.innerHTML = "";
    this.pendingNextEpisode = null;
    this.pendingNextBaseSession = null;
    if (leavePlayer) {
      this.stopPlayerAndSave();
      appStore.closePlayer();
    }
  }

  private updateUpNextCountdown(): void {
    const countEl = this.root.querySelector<HTMLElement>("#player-up-next-count");
    const ring = this.root.querySelector<HTMLElement>(".player-up-next__ring-fill");
    if (countEl) countEl.textContent = String(this.upNextCountdown);
    if (ring) {
      const progress = ((5 - this.upNextCountdown) / 5) * 100;
      ring.style.strokeDashoffset = String(100 - progress);
    }
    if (this.upNextCountdown <= 0) {
      void this.playNextEpisode();
    }
  }

  private mountUpNextHandlers(): void {
    this.root.querySelector<HTMLButtonElement>("#player-next-play")?.addEventListener("click", () => {
      void this.playNextEpisode();
    });
    this.root.querySelector<HTMLButtonElement>("#player-next-dismiss")?.addEventListener("click", () => {
      this.dismissUpNext(true);
    });
    setFocus(this.root.querySelector<HTMLElement>("#player-next-play"));
  }

  private showPlayerError(message: string, session: PlayerSession): void {
    const host = this.root.querySelector<HTMLElement>("#player-error-host");
    if (!host) return;
    host.innerHTML = renderPlayerErrorOverlay(message);
    host.querySelector<HTMLButtonElement>("#player-error-retry")?.addEventListener("click", () => {
      host.innerHTML = "";
      void this.retryPlayer(session);
    });
    host.querySelector<HTMLButtonElement>("#player-error-exit")?.addEventListener("click", () => {
      host.innerHTML = "";
      this.stopPlayerAndSave();
      appStore.closePlayer();
    });
    setFocus(host.querySelector<HTMLElement>(".focusable"));
  }

  private async retryPlayer(session: PlayerSession): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#player-container");
    if (!container) return;
    this.playerController?.stop();
    this.playerController = new AvPlayController(container);
    this.activePlayerSession = session;
    try {
      const initialSubtitle =
        session.subtitleTracks?.find((track) => track.id !== "off" && track.url)?.url ?? null;
      await this.openPlayerWithFallbacks(session, initialSubtitle);
      this.mountPlayerHandlers(session);
    } catch (error) {
      this.showPlayerError(userMessage(error, "Playback failed."), session);
    }
  }

  private mountPlayerHandlers(session: PlayerSession): void {
    const playPause = this.root.querySelector<HTMLButtonElement>("#player-play-pause");
    const progressTrack = this.root.querySelector<HTMLButtonElement>("#player-progress-track");
    const bufferingEl = this.root.querySelector<HTMLElement>("#player-buffering");
    const isLive = session.watchType === "LIVE";
    this.playerChromeIsLive = isLive;

    if (isLive) {
      this.livePlayerController.setCallbacks(
        () => this.updatePlayerLiveOverlays(),
        (nextSession) => void this.switchLiveChannel(nextSession),
      );
      this.livePlayerController.init(session);
      this.updatePlayerLiveOverlays();
    }

    this.playerController?.setOnBuffering((buffering) => {
      bufferingEl?.classList.toggle("hidden", !buffering);
    });

    this.revealPlayerChrome();
    this.schedulePlayerChromeHide();
    if (session.startPositionMs && session.startPositionMs > 0 && !isLive) {
      this.showResumeToast(session.startPositionMs);
    }

    this.clearPlayerChromeHandler();
    const playerPage = this.root.querySelector<HTMLElement>(".player-page");
    this.playerPageWakeHandler = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("#player-back")) {
        event.stopPropagation();
        this.exitPlayer();
        return;
      }
      if (target.closest("#player-side-panel, #player-side-panel-backdrop, .channel-browser")) return;
      this.wakePlayerChrome();
    };
    if (playerPage && this.playerPageWakeHandler) {
      playerPage.addEventListener("click", this.playerPageWakeHandler);
      playerPage.addEventListener("pointerdown", this.playerPageWakeHandler);
    }

    this.clearPlayerKeyHandler();
    registerPlayerRemoteKeys();
    this.playerKeyHandler = createPlayerKeyHandler({
      isLive,
      isBrowserOpen: () => this.livePlayerController.state.showChannelBrowser,
      isSidePanelOpen: () => this.isSidePanelOpen(),
      isUpNextOpen: () => this.isUpNextOpen(),
      isProgressFocused: () => this.isProgressTrackFocused(),
      isChromeVisible: () => this.isPlayerChromeVisible(),
      wakePlayerChrome: () => this.wakePlayerChrome(),
      exitPlayer: () => this.exitPlayer(),
      onBack: () => {
        if (this.isUpNextOpen()) {
          this.dismissUpNext(true);
          return true;
        }
        if (this.closeSidePanel()) return true;
        if (this.livePlayerController.dismissBrowser()) return true;
        return false;
      },
      onExitPlayer: () => {
        this.exitPlayer();
      },
      onZapNext: () => this.livePlayerController.zapNext(),
      onZapPrev: () => this.livePlayerController.zapPrevious(),
      onToggleBrowser: () => this.livePlayerController.toggleBrowser(),
      onNumeric: (digit) => this.livePlayerController.onNumericDigit(digit),
      onConfirmNumeric: () => this.livePlayerController.confirmNumeric(),
      onSeekForward: () => this.seekBy(10),
      onSeekBack: () => this.seekBy(-10),
      onScrubForward: () => this.seekBy(30),
      onScrubBack: () => this.seekBy(-30),
      onTogglePlayPause: () => {
        const playing = this.playerController?.togglePlayPause() ?? false;
        this.updatePlayPauseIcon(playing);
      },
      onOpenGuide: () => {
        this.stopPlayerAndSave();
        appStore.openEpgGuide(session.liveCategoryId);
      },
    });
    document.addEventListener("keydown", this.playerKeyHandler, true);

    this.root.querySelector<HTMLButtonElement>("#player-back")?.addEventListener("click", () => {
      this.exitPlayer();
    });

    playPause?.addEventListener("click", () => {
      const playing = this.playerController?.togglePlayPause() ?? false;
      this.updatePlayPauseIcon(playing);
      this.wakePlayerChrome();
    });

    this.root.querySelector<HTMLButtonElement>("#player-rewind10")?.addEventListener("click", () => {
      this.seekBy(-10);
      this.wakePlayerChrome();
    });

    this.root.querySelector<HTMLButtonElement>("#player-forward10")?.addEventListener("click", () => {
      this.seekBy(10);
      this.wakePlayerChrome();
    });

    const seekToRatio = (ratio: number): void => {
      if (isLive || !this.playerController) return;
      const durationMs = this.playerController.getDurationMs();
      if (durationMs <= 0) return;
      const positionMs = Math.round(Math.max(0, Math.min(1, ratio)) * durationMs);
      this.playerController.seek(positionMs);
      this.updateProgressUi(positionMs, durationMs);
    };

    progressTrack?.addEventListener("click", (event) => {
      if (isLive) return;
      const rect = progressTrack.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      seekToRatio(ratio);
      this.wakePlayerChrome();
    });

    progressTrack?.addEventListener("keydown", (event) => {
      if (isLive) return;
      const code = (event as KeyboardEvent & { keyCode?: number }).keyCode;
      const isLeft = event.key === "ArrowLeft" || code === 37;
      const isRight = event.key === "ArrowRight" || code === 39;
      if (!isLeft && !isRight) return;
      event.preventDefault();
      event.stopPropagation();
      this.seekBy(isRight ? 30 : -30);
      this.wakePlayerChrome();
    });

    this.playerController?.setOnUiProgress((positionMs, durationMs) => {
      if (!isLive) this.updateProgressUi(positionMs, durationMs);
      if (!isLive && this.isImmersiveHudVisible()) {
        this.updateImmersivePlaybackLine(positionMs, durationMs);
      }
      if (playPause && this.playerController) {
        this.updatePlayPauseIcon(this.playerController.isPlaying());
      }
    });

    this.root.querySelector<HTMLButtonElement>("#player-subtitles")?.addEventListener("click", () => {
      this.openSidePanel("subtitles");
    });

    this.root.querySelector<HTMLButtonElement>("#player-audio")?.addEventListener("click", () => {
      this.openSidePanel("audio");
    });

    this.root.querySelector<HTMLButtonElement>("#player-aspect")?.addEventListener("click", () => {
      const mode = this.playerController?.cycleAspectMode();
      if (mode && this.activePlayerSession) {
        this.activePlayerSession.aspectMode = mode;
        this.updateToolbarAspectLabel(mode);
      }
      this.wakePlayerChrome();
    });

    this.root.querySelector<HTMLButtonElement>("#player-speed")?.addEventListener("click", () => {
      const speed = this.playerController?.cyclePlaybackSpeed();
      if (speed && this.activePlayerSession) {
        this.activePlayerSession.playbackSpeed = speed;
        this.updateToolbarSpeedLabel(speed);
      }
      this.wakePlayerChrome();
    });

    this.root.querySelector<HTMLButtonElement>("#player-sleep")?.addEventListener("click", () => {
      this.openSidePanel("sleep");
    });

    this.root.querySelector<HTMLButtonElement>("#player-side-panel-close")?.addEventListener("click", () => {
      this.closeSidePanel();
    });

    this.root.querySelector<HTMLButtonElement>("#player-side-panel-backdrop")?.addEventListener("click", () => {
      this.closeSidePanel();
    });

    this.root.querySelector<HTMLButtonElement>("#player-guide")?.addEventListener("click", () => {
      this.stopPlayerAndSave();
      appStore.openEpgGuide(session.liveCategoryId);
    });

    this.root.querySelector<HTMLButtonElement>("#player-browser")?.addEventListener("click", () => {
      this.livePlayerController.toggleBrowser();
      this.wakePlayerChrome();
    });

    if (session.sleepTimerEndsAtMs && session.sleepTimerEndsAtMs > Date.now()) {
      this.setSleepTimer(Math.ceil((session.sleepTimerEndsAtMs - Date.now()) / 60_000));
      this.updateSleepToolbarLabel(true);
    }
  }

  private updatePlayerLiveOverlays(): void {
    const overlayRoot = this.root.querySelector<HTMLElement>("#player-live-overlays");
    if (!overlayRoot) return;
    const { zapChannels, activeIndex, showChannelBrowser, numericInputBuffer, zapOverlay } =
      this.livePlayerController.state;
    const parts: string[] = [];
    if (zapOverlay?.visible) {
      const epgTitle = this.activePlayerSession?.nowProgramme?.title;
      parts.push(
        renderZapBanner(
          zapOverlay.channelName,
          zapOverlay.channelIndex,
          zapOverlay.totalChannels,
          zapOverlay.channelIcon,
          epgTitle,
        ),
      );
    }
    if (showChannelBrowser) {
      parts.push(renderChannelBrowserOverlay(zapChannels, activeIndex, numericInputBuffer));
    }
    overlayRoot.innerHTML = parts.join("");
    if (showChannelBrowser) {
      overlayRoot.querySelectorAll<HTMLElement>(".channel-browser-row").forEach((row) => {
        row.addEventListener("click", () => {
          const index = Number(row.dataset.channelIndex);
          if (Number.isFinite(index)) {
            this.livePlayerController.selectIndex(index);
            this.livePlayerController.dismissBrowser();
          }
        });
      });
      const active = overlayRoot.querySelector<HTMLElement>(".channel-browser-row.is-active");
      setFocus(active ?? overlayRoot.querySelector<HTMLElement>(".channel-browser-row"));
    }
  }

  private async switchLiveChannel(session: PlayerSession): Promise<void> {
    if (!this.playerController) return;
    try {
      const epg = await contentService.getShortEpg(Number(session.streamId));
      const { now, next } = toNowNext(epg);
      session.nowProgramme = now ?? undefined;
      session.nextProgramme = next ?? undefined;
    } catch {
      session.nowProgramme = undefined;
      session.nextProgramme = undefined;
    }
    this.activePlayerSession = session;
    watchHistoryStore.recordLiveChannel(Number(session.streamId), session.title, session.imageUrl);
    userSyncManager.onWatchHistoryChanged();
    const titleEl = this.root.querySelector<HTMLElement>("#player-title");
    if (titleEl) titleEl.textContent = session.title;
    const liveNow = this.root.querySelector<HTMLElement>("#player-live-now");
    if (liveNow) {
      liveNow.outerHTML = renderPlayerLiveNow(session);
    }
    if (this.livePlayerController.state.zapOverlay?.visible) {
      this.livePlayerController.state.zapOverlay = {
        ...this.livePlayerController.state.zapOverlay,
        channelIcon: session.imageUrl,
        epgNowTitle: session.nowProgramme?.title,
      };
    }
    await this.openPlayerWithFallbacks(session, null);
    this.updatePlayerLiveOverlays();
  }

  private async openLiveSession(
    streamId: number,
    title: string,
    imageUrl?: string,
    categoryId?: string,
  ): Promise<void> {
    const session: PlayerSession = {
      url: contentService.buildLiveUrl(streamId),
      title,
      watchType: "LIVE",
      watchId: `live_${streamId}`,
      streamId: String(streamId),
      imageUrl,
      fallbackUrls: contentService.buildLiveFallbackUrls(streamId),
      liveCategoryId: categoryId,
    };
    const fakeButton = document.createElement("button");
    if (categoryId) fakeButton.dataset.categoryId = categoryId;
    await this.enrichAndPlayAsync(session, fakeButton);
  }

  private setSleepTimer(minutes: number): void {
    this.clearSleepTimer();
    if (!minutes) {
      if (this.activePlayerSession) this.activePlayerSession.sleepTimerEndsAtMs = undefined;
      return;
    }
    const endsAt = Date.now() + minutes * 60_000;
    if (this.activePlayerSession) this.activePlayerSession.sleepTimerEndsAtMs = endsAt;
    this.sleepTimer = setTimeout(() => {
      this.updateSleepToolbarLabel(false);
      this.stopPlayerAndSave();
      appStore.closePlayer();
    }, minutes * 60_000);
  }

  private clearSleepTimer(): void {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  private isImmersiveHudVisible(): boolean {
    const hud = this.root.querySelector<HTMLElement>("#player-immersive-hud");
    return Boolean(hud && !hud.classList.contains("hidden"));
  }

  private isPlayerChromeVisible(): boolean {
    return !this.root.querySelector("#player-chrome")?.classList.contains("hidden");
  }

  private canAutoHidePlayerChrome(): boolean {
    return (
      !this.isSidePanelOpen() &&
      !this.isUpNextOpen() &&
      !this.livePlayerController.state.showChannelBrowser
    );
  }

  private focusPlayerChromeTarget(): void {
    const target = this.playerChromeIsLive
      ? this.root.querySelector<HTMLElement>("#player-back")
      : this.root.querySelector<HTMLElement>("#player-play-pause");
    if (target) setFocus(target);
  }

  private setImmersiveFocusSinkActive(active: boolean): void {
    const sink = this.root.querySelector<HTMLElement>("#player-immersive-focus");
    if (!sink) return;
    sink.tabIndex = active ? 0 : -1;
  }

  private revealPlayerChrome(): void {
    const chrome = this.root.querySelector<HTMLElement>("#player-chrome");
    chrome?.classList.remove("hidden");
    this.updateImmersiveHud(false);
    this.setImmersiveFocusSinkActive(false);
    this.focusPlayerChromeTarget();
  }

  private schedulePlayerChromeHide(): void {
    if (this.chromeHideTimer) clearTimeout(this.chromeHideTimer);
    this.chromeHideTimer = setTimeout(() => {
      if (this.canAutoHidePlayerChrome()) {
        this.hidePlayerChrome();
      }
    }, 4000);
  }

  private wakePlayerChrome(): void {
    if (!this.isPlayerChromeVisible()) {
      this.revealPlayerChrome();
      this.schedulePlayerChromeHide();
      return;
    }
    const now = Date.now();
    if (now - this.lastChromeWakeAt < 250) return;
    this.lastChromeWakeAt = now;
    this.schedulePlayerChromeHide();
  }

  private hidePlayerChrome(): void {
    const chrome = this.root.querySelector<HTMLElement>("#player-chrome");
    if (!chrome) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && chrome.contains(active)) {
      active.blur();
    }

    chrome.classList.add("hidden");
    this.updateImmersiveHud(true);
    this.setImmersiveFocusSinkActive(true);

    const sink = this.root.querySelector<HTMLElement>("#player-immersive-focus");
    if (sink) setFocus(sink);
  }

  private updateImmersivePlaybackLine(positionMs?: number, durationMs?: number): void {
    const playbackEl = this.root.querySelector<HTMLElement>("#player-immersive-playback");
    if (!playbackEl) return;
    if (this.activePlayerSession?.watchType === "LIVE") {
      playbackEl.classList.add("hidden");
      return;
    }
    const position = positionMs ?? this.playerController?.getCurrentTimeMs() ?? 0;
    const duration = durationMs ?? this.playerController?.getDurationMs() ?? 0;
    if (duration <= 0) {
      playbackEl.classList.add("hidden");
      return;
    }
    const remaining = Math.max(0, duration - position);
    playbackEl.textContent = `${formatPlayerTime(position)} · -${formatPlayerTime(remaining)}`;
    playbackEl.classList.remove("hidden");
  }

  private updateImmersiveHud(show: boolean): void {
    const hud = this.root.querySelector<HTMLElement>("#player-immersive-hud");
    const wallEl = this.root.querySelector<HTMLElement>("#player-immersive-wall");
    if (!hud || !wallEl) return;
    if (!show) {
      hud.classList.add("hidden");
      hud.setAttribute("aria-hidden", "true");
      this.clearImmersiveHud();
      return;
    }
    const renderWall = (): void => {
      wallEl.textContent = new Date().toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
    };
    renderWall();
    this.updateImmersivePlaybackLine();
    hud.classList.remove("hidden");
    hud.setAttribute("aria-hidden", "false");
    this.clearImmersiveHud();
    this.immersiveWallTimer = setInterval(renderWall, 30_000);
    if (this.activePlayerSession?.watchType !== "LIVE") {
      this.immersivePlaybackTimer = setInterval(() => this.updateImmersivePlaybackLine(), 1000);
    }
  }

  private clearImmersiveHud(): void {
    if (this.immersiveWallTimer) {
      clearInterval(this.immersiveWallTimer);
      this.immersiveWallTimer = null;
    }
    if (this.immersivePlaybackTimer) {
      clearInterval(this.immersivePlaybackTimer);
      this.immersivePlaybackTimer = null;
    }
  }

  private async loadEpgGuide(categoryId: string | null): Promise<void> {
    try {
      const categories = await contentService.getLiveCategories();
      const targetCategory =
        categoryId ?? categories.find((cat) => cat.category_id !== FAVORITES_CATEGORY_ID)?.category_id;
      const channels = targetCategory ? await contentService.getLiveStreams(targetCategory) : [];
      let programmes: import("../data/contentService.js").XmltvProgram[] = [];
      try {
        programmes = await contentService.loadXmltvPrograms();
      } catch {
        const batch = await contentService.getShortEpgBatch(
          channels.slice(0, 30).map((channel) => channel.stream_id),
          12,
        );
        programmes = channels.flatMap((channel) =>
          (batch.get(channel.stream_id) ?? []).map((item) => ({
            ...item,
            channelId: String(channel.stream_id),
          })),
        );
      }
      const model = buildGuideModel(channels, programmes);
      this.root.innerHTML = renderEpgGuideScreen(model);
      this.mountEpgGuideHandlers();
      initFocusRing(this.root);
      setFocus(this.root.querySelector<HTMLElement>(".focusable"));
    } catch (error) {
      this.root.innerHTML = renderErrorState(userMessage(error, "EPG guide load failed."));
      this.root.querySelector("#error-retry")?.addEventListener("click", () => void this.loadEpgGuide(categoryId));
    }
  }

  private mountEpgGuideHandlers(): void {
    this.root.querySelector<HTMLButtonElement>("#epg-guide-back")?.addEventListener("click", () => appStore.back());
    this.root.querySelectorAll<HTMLElement>(".epg-guide-program").forEach((button) => {
      button.addEventListener("click", () => {
        const streamId = Number(button.dataset.streamId);
        const start = Number(button.dataset.start);
        const end = Number(button.dataset.end);
        const now = Date.now();
        if (now >= start && now < end) {
          void this.openLiveSession(streamId, button.textContent?.trim() ?? "Live", undefined, appStore.getState().epgGuideCategoryId ?? undefined);
          return;
        }
        appStore.setError("Μόνο ζωντανή αναπαραγωγή.");
      });
    });
  }

  private async playNextEpisode(): Promise<void> {
    const next = this.pendingNextEpisode;
    const base = this.pendingNextBaseSession;
    if (!next || !base?.seriesId || !this.playerController) return;

    this.clearUpNextTimer();
    const host = this.root.querySelector<HTMLElement>("#player-up-next-host");
    if (host) host.innerHTML = "";

    if (this.activePlayerSession) {
      const { positionMs, durationMs } = this.playerController.flushProgress();
      this.persistWatchProgress(this.activePlayerSession, positionMs, durationMs);
    }

    const url = contentService.buildEpisodeUrl(next.id, next.container_extension);
    const watchId = seriesEpisodeId(base.seriesId, next.id);
    const newSession: PlayerSession = {
      url,
      title: next.title,
      subtitle: `S${next.season} E${next.episode_num}`,
      watchType: "SERIES_EPISODE",
      watchId,
      streamId: next.id,
      containerExtension: next.container_extension,
      seriesId: base.seriesId,
      season: next.season,
      episodeId: next.id,
      imageUrl: base.imageUrl,
      seriesInfo: base.seriesInfo,
      subtitleTracks: base.subtitleTracks,
      aspectMode: base.aspectMode,
      playbackSpeed: base.playbackSpeed,
      startPositionMs: 0,
    };

    this.pendingNextEpisode = null;
    this.pendingNextBaseSession = null;
    this.activePlayerSession = newSession;

    const titleEl = this.root.querySelector<HTMLElement>("#player-title");
    if (titleEl) titleEl.textContent = newSession.title;
    const subtitleEl = this.root.querySelector<HTMLElement>("#player-subtitle");
    if (subtitleEl) subtitleEl.textContent = newSession.subtitle ?? "";

    try {
      const initialSubtitle =
        newSession.subtitleTracks?.find((track) => track.id !== "off" && track.url)?.url ?? null;
      await this.openPlayerWithFallbacks(newSession, initialSubtitle);
      this.updateProgressUi(0, this.playerController.getDurationMs());
      this.updatePlayPauseIcon(this.playerController.isPlaying());
    } catch (error) {
      this.showPlayerError(userMessage(error, "Playback failed."), newSession);
    }
  }

  private showNextEpisodeDialog(next: SeriesEpisode, session: PlayerSession): void {
    this.pendingNextEpisode = next;
    this.pendingNextBaseSession = session;
    this.upNextCountdown = 5;
    const host = this.root.querySelector<HTMLElement>("#player-up-next-host");
    if (!host) return;
    host.innerHTML = renderUpNextCard(next, session.imageUrl, this.upNextCountdown);
    this.mountUpNextHandlers();
    this.clearUpNextTimer();
    this.upNextTimer = setInterval(() => {
      this.upNextCountdown -= 1;
      this.updateUpNextCountdown();
    }, 1000);
  }

  private async startPlayer(session: PlayerSession): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#player-container");
    if (!container) return;
    this.stopPlayerAndSave();
    this.activePlayerSession = session;
    this.playerController = new AvPlayController(container);
    this.playerController.setOnEnded(() => {
      const active = this.activePlayerSession;
      if (active?.watchType === "SERIES_EPISODE" && active.seriesInfo && active.episodeId) {
        const episodes = Object.values(active.seriesInfo.episodes).flat();
        const current = episodes.find((ep) => ep.id === active.episodeId);
        if (current) {
          const next = findNextEpisode(current, active.seriesInfo);
          if (next) {
            this.showNextEpisodeDialog(next, active);
            return;
          }
        }
      }
      this.stopPlayerAndSave();
      appStore.closePlayer();
    });
    this.playerController.setOnProgress((positionMs, durationMs) => {
      if (this.activePlayerSession) {
        this.persistWatchProgress(this.activePlayerSession, positionMs, durationMs);
      }
    });
    try {
      const initialSubtitle =
        session.subtitleTracks?.find((track) => track.id !== "off" && track.url)?.url ?? null;
      await this.openPlayerWithFallbacks(session, initialSubtitle);
      if (this.playerController) {
        session.audioTracks = this.playerController.getAudioTracks();
        const embedded = this.playerController.getEmbeddedSubtitleTracks();
        if (embedded.length > 0) {
          session.subtitleTracks = [
            { id: "off", label: "Ανενεργοί" },
            ...embedded,
            ...(session.subtitleTracks?.filter((track) => track.id !== "off") ?? []),
          ];
        }
        if (session.aspectMode) {
          this.playerController.setAspectMode(session.aspectMode);
        }
        if (session.playbackSpeed && session.playbackSpeed !== 1) {
          this.playerController.setPlaybackSpeed(session.playbackSpeed);
        }
      }
      this.mountPlayerHandlers(session);
    } catch (error) {
      this.showPlayerError(userMessage(error, "Playback failed."), session);
    }
  }

  private async openPlayerWithFallbacks(session: PlayerSession, subtitleUrl: string | null): Promise<void> {
    if (!this.playerController) return;
    const urls = [session.url, ...(session.fallbackUrls ?? [])].filter(
      (url, index, all) => Boolean(url) && all.indexOf(url) === index,
    );
    let lastError: unknown = null;
    for (const url of urls) {
      try {
        await this.playerController.open(url, session.title, session.startPositionMs ?? 0, subtitleUrl);
        session.url = url;
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Playback failed.");
  }

  private mountPlaylistHandlers(): void {
    this.root.querySelector<HTMLButtonElement>("#settings-back")?.addEventListener("click", () => {
      appStore.closeSettingsSubpanel();
    });

    this.root.querySelector<HTMLButtonElement>("#playlist-add")?.addEventListener("click", () => {
      this.root.querySelector("#playlist-form-modal")?.classList.remove("hidden");
      const title = this.root.querySelector<HTMLElement>("#playlist-form-title");
      if (title) title.textContent = "Νέα playlist";
      const editId = this.root.querySelector<HTMLInputElement>("#playlist-edit-id");
      if (editId) editId.value = "";
    });

    this.root.querySelector<HTMLButtonElement>("#playlist-form-cancel")?.addEventListener("click", () => {
      this.root.querySelector("#playlist-form-modal")?.classList.add("hidden");
    });

    this.root.querySelector<HTMLFormElement>("#playlist-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const editId = this.root.querySelector<HTMLInputElement>("#playlist-edit-id")?.value ?? "";
      const name = this.root.querySelector<HTMLInputElement>("#playlist-name")?.value ?? "";
      const serverUrl = this.root.querySelector<HTMLInputElement>("#playlist-server")?.value ?? "";
      const username = this.root.querySelector<HTMLInputElement>("#playlist-user")?.value ?? "";
      const password = this.root.querySelector<HTMLInputElement>("#playlist-pass")?.value ?? "";
      const credentials = { serverUrl: serverUrl.trim(), username: username.trim(), password };
      const state = userSyncManager.loadPlaylists();
      let playlist: IptvPlaylist;
      if (editId) {
        const existing = state.playlists.find((item) => item.id === editId);
        playlist = existing
          ? { ...existing, name: name.trim() || existing.name, ...credentials }
          : createPlaylist(name, credentials, editId);
      } else {
        playlist = createPlaylist(name, credentials);
      }
      const playlists = editId
        ? state.playlists.map((item) => (item.id === playlist.id ? playlist : item))
        : [...state.playlists, playlist];
      userSyncManager.savePlaylists({
        playlists,
        activePlaylistId: state.activePlaylistId ?? playlist.id,
      });
      userSyncManager.onDataChanged();
      appStore.openSettingsPlaylists();
    });

    this.root.querySelectorAll<HTMLElement>(".playlist-activate").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        if (!id) return;
        const state = userSyncManager.loadPlaylists();
        userSyncManager.savePlaylists({ ...state, activePlaylistId: id });
        const creds = playlistToCredentials(state.playlists.find((p) => p.id === id)!);
        void import("../dashboard/dashboardCache.js").then(({ invalidateDashboardCache }) => invalidateDashboardCache());
        void contentService.authenticate(creds).then(() => appStore.openSettingsPlaylists());
      });
    });

    this.root.querySelectorAll<HTMLElement>(".playlist-delete").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        if (!id) return;
        const state = userSyncManager.loadPlaylists();
        const playlists = state.playlists.filter((item) => item.id !== id);
        userSyncManager.savePlaylists({
          playlists,
          activePlaylistId: state.activePlaylistId === id ? playlists[0]?.id ?? null : state.activePlaylistId,
        });
        userSyncManager.onDataChanged();
        appStore.openSettingsPlaylists();
      });
    });

    this.root.querySelectorAll<HTMLElement>(".playlist-edit").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;
        const playlist = userSyncManager.loadPlaylists().playlists.find((item) => item.id === id);
        if (!playlist) return;
        this.root.querySelector("#playlist-form-modal")?.classList.remove("hidden");
        const title = this.root.querySelector<HTMLElement>("#playlist-form-title");
        if (title) title.textContent = "Επεξεργασία playlist";
        const editIdEl = this.root.querySelector<HTMLInputElement>("#playlist-edit-id");
        const nameEl = this.root.querySelector<HTMLInputElement>("#playlist-name");
        const serverEl = this.root.querySelector<HTMLInputElement>("#playlist-server");
        const userEl = this.root.querySelector<HTMLInputElement>("#playlist-user");
        const passEl = this.root.querySelector<HTMLInputElement>("#playlist-pass");
        if (editIdEl) editIdEl.value = playlist.id;
        if (nameEl) nameEl.value = playlist.name;
        if (serverEl) serverEl.value = playlist.serverUrl;
        if (userEl) userEl.value = playlist.username;
        if (passEl) passEl.value = playlist.password;
      });
    });

    this.root.querySelectorAll<HTMLElement>(".playlist-test").forEach((button) => {
      button.addEventListener("click", () => {
        void (async () => {
          const id = button.dataset.id;
          const playlist = userSyncManager.loadPlaylists().playlists.find((item) => item.id === id);
          if (!playlist) return;
          try {
            const { XtreamClient } = await import("@tv/xtream-core");
            const { createAppFetch } = await import("../data/devFetch.js");
            await new XtreamClient(playlistToCredentials(playlist), createAppFetch()).authenticate();
            appStore.setError(null);
          } catch (error) {
          appStore.setError(userMessage(error, "Test failed."));
        }
      })();
    });
  });
}

  private mountPinHandlers(): void {
    this.root.querySelector<HTMLFormElement>("#settings-pin-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = this.root.querySelector<HTMLInputElement>("#settings-pin-input");
      void (async () => {
        try {
          await pinLock.set(input?.value ?? "");
          this.settingsUnlocked = true;
          appStore.setError(null);
          this.render(appStore.getState());
        } catch (error) {
          appStore.setError(userMessage(error, "PIN failed."));
        }
      })();
    });

    this.root.querySelector<HTMLButtonElement>("#settings-pin-clear")?.addEventListener("click", () => {
      pinLock.clear();
      this.settingsUnlocked = false;
      this.render(appStore.getState());
    });

    this.root.querySelector<HTMLFormElement>("#pin-unlock-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = this.root.querySelector<HTMLInputElement>("#pin-unlock-input");
      void (async () => {
        const pin = input?.value ?? "";
        const valid = (await pinLock.verify(pin)) || pinLock.verifySync(pin);
        if (!valid) {
          appStore.setError("Λάθος PIN.");
          return;
        }
        this.settingsUnlocked = true;
        this.root.querySelector("#pin-unlock-modal")?.classList.add("hidden");
        const settingsAction = this.pendingProtectedSettingsAction;
        const playAction = this.pendingProtectedPlayAction;
        this.pendingProtectedSettingsAction = null;
        this.pendingProtectedPlayAction = null;
        settingsAction?.();
        playAction?.();
      })();
    });

    this.root.querySelector<HTMLButtonElement>("#pin-unlock-cancel")?.addEventListener("click", () => {
      this.root.querySelector("#pin-unlock-modal")?.classList.add("hidden");
      this.pendingProtectedSettingsAction = null;
      this.pendingProtectedPlayAction = null;
    });
  }

  private runProtectedSettingsAction(action: () => void): void {
    if (!pinLock.hasPin() || this.settingsUnlocked) {
      action();
      return;
    }
    this.pendingProtectedSettingsAction = action;
    this.root.querySelector("#pin-unlock-modal")?.classList.remove("hidden");
    setFocus(this.root.querySelector<HTMLElement>("#pin-unlock-input"));
  }

  private runProtectedPlayAction(action: () => void): void {
    if (!pinLock.hasPin()) {
      action();
      return;
    }
    this.pendingProtectedPlayAction = action;
    this.root.querySelector("#pin-unlock-modal")?.classList.remove("hidden");
    setFocus(this.root.querySelector<HTMLElement>("#pin-unlock-input"));
  }
}
