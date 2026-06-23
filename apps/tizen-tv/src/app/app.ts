import { appStore } from "./store.js";
import { bindRemoteNavigation, initFocusRing, setFocus, escapeHtml } from "../ui/focus.js";
import { renderLoginScreen } from "../screens/login.js";
import { renderShell } from "../screens/shell.js";
import { renderDashboardShell } from "../screens/dashboard.js";
import { renderBrowseScreen } from "../screens/browse.js";
import { renderSearchScreen } from "../screens/search.js";
import { renderDetailScreen, playerSessionFromButton, subtitleTracksFromVod } from "../screens/detail.js";
import { renderPlayerScreen } from "../screens/player.js";
import { renderSettingsScreen, loadCategoryItems } from "../screens/settings.js";
import { renderCategoryVisibilityScreen } from "../screens/settingsCategories.js";
import { formatPlayerTime } from "../screens/player.js";
import { favoriteFromLive, favoriteFromMovie, favoriteFromSeries, favoritesStore } from "../data/favoritesStore.js";
import { categoryVisibilityStore } from "../data/categoryVisibility.js";
import { loadBrowseCategories, renderBrowseGrid } from "../data/browseLoader.js";
import { contentService } from "../data/contentService.js";
import { recentSearchStore } from "../data/recentSearchStore.js";
import { AvPlayController } from "../player/avPlayController.js";
import { playerSessionFromEntry } from "../data/resumePlayback.js";
import { watchHistoryStore, seriesEpisodeId } from "../data/watchHistory.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { findNextEpisode } from "../data/nextEpisode.js";
import { renderPlaylistsScreen, loadPlaylistExpiryLabels } from "../screens/settingsPlaylists.js";
import { renderErrorState } from "../ui/states.js";
import { syncAppViewport } from "../ui/viewport.js";
import { createPlaylist, playlistToCredentials, type IptvPlaylist } from "../sync/types.js";
import type { DetailContext, PlayerSession } from "../types/global.js";
import type { SeriesEpisode } from "@tv/xtream-core";

export class App {
  private root: HTMLElement;
  private unbindRemote: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private playerController: AvPlayController | null = null;
  private activePlayerSession: PlayerSession | null = null;
  private pendingPlayButton: HTMLElement | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private chromeHideTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingNextEpisode: SeriesEpisode | null = null;
  private pendingNextBaseSession: PlayerSession | null = null;
  private activeSubtitleId = "off";

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    this.unsubscribe = appStore.subscribe((state) => this.render(state));
    void appStore.bootstrap();
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

    if (state.loading && state.screen === "login") {
      this.root.innerHTML = `<div class="boot-screen"><div class="spinner"></div><p>Φόρτωση…</p></div>`;
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
      void this.startPlayer(state.player);
      this.unbindRemote = bindRemoteNavigation(this.root, () => {
        this.stopPlayerAndSave();
        appStore.closePlayer();
      });
      return;
    }

    const browseActions = {
      openPlayer: (session: PlayerSession) => appStore.openPlayer(session),
      openDetail: (detail: import("../types/global.js").DetailContext) => appStore.openDetail(detail),
    };

    const content =
      state.screen === "home"
        ? renderDashboardShell()
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
    }

    const navItem = this.root.querySelector<HTMLElement>(
      state.screen === "search" ? `[data-action="search"]` : `[data-nav="${state.navSection}"]`,
    );
    setFocus(navItem ?? this.root.querySelector<HTMLElement>(".focusable"));
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
      appStore.setError(error instanceof Error ? error.message : "Login failed.");
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
      appStore.setError(error instanceof Error ? error.message : "IPTV login failed.");
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
      void userSyncManager.pushNow().catch((error) => {
        appStore.setError(error instanceof Error ? error.message : "Sync failed.");
      });
    });

    const pullNow = this.root.querySelector<HTMLButtonElement>("#settings-pull");
    pullNow?.addEventListener("click", () => {
      void userSyncManager.pullNow().catch((error) => {
        appStore.setError(error instanceof Error ? error.message : "Pull failed.");
      });
    });

    this.root.querySelector<HTMLButtonElement>("#settings-categories")?.addEventListener("click", () => {
      appStore.openSettingsCategories();
    });

    this.root.querySelector<HTMLButtonElement>("#settings-playlists")?.addEventListener("click", () => {
      appStore.openSettingsPlaylists();
    });

    this.root.querySelector<HTMLButtonElement>("#settings-clear-cache")?.addEventListener("click", () => {
      localStorage.removeItem("tv_recent_search");
      recentSearchStore.clear();
      appStore.setError(null);
    });

    this.mountDetailHandlers();
    this.mountGlobalActionHandlers();
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
        const target = button.dataset.navTarget as "movies" | "series";
        appStore.navigate(target);
      });
    });

    this.root.querySelectorAll<HTMLElement>("[data-live-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        appStore.navigateToBrowse({ section: "live", categoryId: chip.dataset.liveCategory });
      });
    });

    this.root.querySelectorAll<HTMLElement>(".history-remove").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = (button as HTMLElement).dataset.removeId;
        if (!id) return;
        watchHistoryStore.removeEntry(id);
        userSyncManager.onWatchHistoryChanged();
        this.render(appStore.getState());
      });
    });
  }

  private mountDetailHandlers(): void {
    this.root.querySelector<HTMLButtonElement>("#detail-back")?.addEventListener("click", () => appStore.back());

    const detailPlay = this.root.querySelector<HTMLButtonElement>("#detail-play");
    detailPlay?.addEventListener("click", () => this.handlePlayClick(detailPlay));

    this.root.querySelectorAll<HTMLElement>(".episode-btn").forEach((button) => {
      button.addEventListener("click", () => this.handlePlayClick(button));
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
    const detail = appStore.getState().detail;
    if (detail?.vodInfo && session.watchType === "MOVIE") {
      session.subtitleTracks = subtitleTracksFromVod(detail);
    }
    if (detail?.seriesInfo && session.watchType === "SERIES_EPISODE") {
      session.seriesInfo = detail.seriesInfo;
    }
    if (session.watchType === "LIVE" && session.streamId) {
      watchHistoryStore.recordLiveChannel(Number(session.streamId), session.title, session.imageUrl);
      userSyncManager.onWatchHistoryChanged();
    }
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
      appStore.setError(error instanceof Error ? error.message : "Detail load failed.");
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
    if (this.playerController && this.activePlayerSession) {
      const { positionMs, durationMs } = this.playerController.flushProgress();
      this.persistWatchProgress(this.activePlayerSession, positionMs, durationMs);
    }
    this.playerController?.stop();
    this.activePlayerSession = null;
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

  private async loadDashboard(): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#dashboard-content");
    if (!container) return;
    try {
      const { loadDashboardData } = await import("../data/dashboardService.js");
      const { renderDashboardContent } = await import("../screens/dashboard.js");
      const { renderErrorState } = await import("../ui/states.js");
      const data = await loadDashboardData();
      container.innerHTML = renderDashboardContent(data);
      syncAppViewport();
      this.mountDashboardHandlers(data);
      initFocusRing(container);
      setFocus(container.querySelector<HTMLElement>(".focusable"));
    } catch (error) {
      const { renderErrorState } = await import("../ui/states.js");
      container.innerHTML = renderErrorState(
        error instanceof Error ? error.message : "Dashboard load failed.",
      );
      container.querySelector("#error-retry")?.addEventListener("click", () => void this.loadDashboard());
    }
  }

  private mountDashboardHandlers(data: import("../data/dashboardService.js").DashboardData): void {
    const hero = this.root.querySelector<HTMLElement>("#quick-play-hero");
    hero?.addEventListener("click", () => {
      if (!data.quickPlayChannel) {
        appStore.navigate("live");
        return;
      }
      const stream = data.quickPlayChannel;
      watchHistoryStore.recordLiveChannel(stream.stream_id, stream.name, stream.stream_icon);
      userSyncManager.onWatchHistoryChanged();
      void (async () => {
        const { contentService } = await import("../data/contentService.js");
        appStore.openPlayer({
          url: contentService.buildLiveUrl(stream.stream_id),
          title: stream.name,
          watchType: "LIVE",
          watchId: `live_${stream.stream_id}`,
          streamId: String(stream.stream_id),
          imageUrl: stream.stream_icon,
        });
      })();
    });

    this.root.querySelectorAll<HTMLElement>("[data-live-category]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const categoryId = chip.dataset.liveCategory;
        if (!categoryId) return;
        appStore.navigateToBrowse({ section: "live", categoryId });
      });
    });

    this.mountHistoryCards();
  }

  private mountHistoryCards(): void {
    this.root.querySelectorAll<HTMLElement>(".history-section .poster-card, .history-row .poster-card").forEach((card) => {
      card.addEventListener("click", () => {
        const entry = watchHistoryStore.getEntry(card.dataset.id ?? "");
        if (!entry) {
          void this.playFavoriteChannel(Number(card.dataset.id));
          return;
        }
        const session = playerSessionFromEntry(entry);
        if (session) appStore.openPlayer(session);
      });
    });
  }

  private async playFavoriteChannel(streamId: number): Promise<void> {
    if (!Number.isFinite(streamId) || streamId <= 0) return;
    const fav = favoritesStore.byKind("LIVE").find((item) => item.streamId === streamId);
    if (!fav?.streamId) return;
    const { contentService } = await import("../data/contentService.js");
    watchHistoryStore.recordLiveChannel(fav.streamId, fav.title, fav.imageUrl);
    userSyncManager.onWatchHistoryChanged();
    appStore.openPlayer({
      url: contentService.buildLiveUrl(fav.streamId),
      title: fav.title,
      watchType: "LIVE",
      watchId: `live_${fav.streamId}`,
      streamId: String(fav.streamId),
      imageUrl: fav.imageUrl,
    });
  }

  private mountSearchHandlers(): void {
    const form = this.root.querySelector<HTMLFormElement>("#search-form");
    const input = this.root.querySelector<HTMLInputElement>("#search-input");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.runSearch(input?.value ?? "");
    });
    input?.addEventListener("input", () => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        void this.runSearch(input.value ?? "");
      }, 400);
    });

    this.root.querySelectorAll<HTMLElement>(".recent-search-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const query = chip.dataset.query ?? "";
        if (input) input.value = query;
        void this.runSearch(query);
      });
    });
  }

  private async runSearch(query: string): Promise<void> {
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
    } catch (error) {
      results.innerHTML = `<div class="error-inline">${error instanceof Error ? error.message : "Search failed."}</div>`;
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
    try {
      const { initFocusRing, setFocus } = await import("../ui/focus.js");
      const categories = await loadBrowseCategories(screen);
      chips.innerHTML = categories
        .slice(0, 24)
        .map(
          (cat, index) =>
            `<button class="chip focusable" data-category="${escapeHtml(cat.category_id)}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(cat.category_name)}</button>`,
        )
        .join("");

      const pending = appStore.consumePendingBrowse();
      const initialCategoryId =
        pending?.section === screen ? pending.categoryId : categories[0]?.category_id;

      const loadCategory = async (categoryId?: string) => {
        grid.innerHTML = `<div class="loading-inline">Φόρτωση…</div>`;
        try {
          const result = await renderBrowseGrid(screen, categoryId, actions);
          grid.innerHTML = result.html;
          result.bind(grid);
          initFocusRing(grid);
          setFocus(grid.querySelector<HTMLElement>(".focusable"));
        } catch (error) {
          grid.innerHTML = renderErrorState(
            error instanceof Error ? error.message : "Load failed.",
            "browse-retry",
          );
          grid.querySelector("#browse-retry")?.addEventListener("click", () => void loadCategory(categoryId));
        }
      };

      chips.querySelectorAll<HTMLElement>(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          chips.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
          chip.classList.add("active");
          void loadCategory(chip.dataset.category);
        });
      });

      let targetChip: HTMLElement | null = null;
      if (initialCategoryId) {
        targetChip = chips.querySelector<HTMLElement>(`[data-category="${initialCategoryId}"]`);
      }
      const activeChip = targetChip ?? chips.querySelector<HTMLElement>(".chip");
      activeChip?.classList.add("active");
      await loadCategory(activeChip?.dataset.category ?? initialCategoryId);
      this.mountHistoryCards();
    } catch (error) {
      grid.innerHTML = `<div class="error-inline">${error instanceof Error ? error.message : "Load failed."}</div>`;
    }
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

  private mountPlayerHandlers(session: PlayerSession): void {
    const chrome = this.root.querySelector<HTMLElement>("#player-chrome");
    const playPause = this.root.querySelector<HTMLButtonElement>("#player-play-pause");
    const seek = this.root.querySelector<HTMLInputElement>("#player-seek");
    const currentEl = this.root.querySelector<HTMLElement>("#player-current");
    const durationEl = this.root.querySelector<HTMLElement>("#player-duration");
    const bufferingEl = this.root.querySelector<HTMLElement>("#player-buffering");
    const isLive = session.watchType === "LIVE";

    this.playerController?.setOnBuffering((buffering) => {
      bufferingEl?.classList.toggle("hidden", !buffering);
    });

    const showChrome = (): void => {
      chrome?.classList.remove("hidden");
      if (this.chromeHideTimer) clearTimeout(this.chromeHideTimer);
      this.chromeHideTimer = setTimeout(() => {
        if (this.playerController?.isPlaying()) {
          chrome?.classList.add("hidden");
        }
      }, 3500);
    };

    showChrome();
    this.root.addEventListener("click", showChrome);

    playPause?.addEventListener("click", () => {
      const playing = this.playerController?.togglePlayPause() ?? false;
      if (playPause) playPause.textContent = playing ? "⏸" : "▶";
      showChrome();
    });

    seek?.addEventListener("change", () => {
      if (isLive || !seek || !this.playerController) return;
      const durationMs = this.playerController.getDurationMs();
      if (durationMs <= 0) return;
      const positionMs = Math.round((Number(seek.value) / 1000) * durationMs);
      this.playerController.seek(positionMs);
      showChrome();
    });

    this.playerController?.setOnUiProgress((positionMs, durationMs) => {
      if (currentEl) currentEl.textContent = formatPlayerTime(positionMs);
      if (durationEl) durationEl.textContent = formatPlayerTime(durationMs);
      if (seek && durationMs > 0) {
        seek.value = String(Math.round((positionMs / durationMs) * 1000));
      }
      if (playPause && this.playerController) {
        playPause.textContent = this.playerController.isPlaying() ? "⏸" : "▶";
      }
    });

    this.root.querySelector<HTMLButtonElement>("#player-subtitles")?.addEventListener("click", () => {
      this.root.querySelector("#player-subtitle-menu")?.classList.remove("hidden");
    });

    this.root.querySelectorAll<HTMLElement>(".subtitle-option").forEach((option) => {
      option.addEventListener("click", () => {
        const trackId = option.dataset.subtitleId ?? "off";
        this.activeSubtitleId = trackId;
        this.playerController?.setSubtitleTrack(trackId, session.subtitleTracks ?? []);
        this.root.querySelector("#player-subtitle-menu")?.classList.add("hidden");
      });
    });

    this.root.querySelector<HTMLButtonElement>("#player-next-play")?.addEventListener("click", () => {
      void this.playNextEpisode();
    });

    this.root.querySelector<HTMLButtonElement>("#player-next-dismiss")?.addEventListener("click", () => {
      this.root.querySelector("#player-next-dialog")?.classList.add("hidden");
      this.stopPlayerAndSave();
      appStore.closePlayer();
    });
  }

  private async playNextEpisode(): Promise<void> {
    const next = this.pendingNextEpisode;
    const base = this.pendingNextBaseSession;
    if (!next || !base?.seriesId) return;
    this.root.querySelector("#player-next-dialog")?.classList.add("hidden");
    const url = contentService.buildEpisodeUrl(next.id, next.container_extension);
    const watchId = seriesEpisodeId(base.seriesId, next.id);
    this.stopPlayerAndSave();
    appStore.openPlayer({
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
    });
  }

  private showNextEpisodeDialog(next: SeriesEpisode, session: PlayerSession): void {
    this.pendingNextEpisode = next;
    this.pendingNextBaseSession = session;
    const label = this.root.querySelector<HTMLElement>("#player-next-label");
    if (label) label.textContent = `S${next.season} E${next.episode_num} — ${next.title}`;
    this.root.querySelector("#player-next-dialog")?.classList.remove("hidden");
  }

  private async startPlayer(session: PlayerSession): Promise<void> {
    const container = this.root.querySelector<HTMLElement>("#player-container");
    if (!container) return;
    this.stopPlayerAndSave();
    this.activePlayerSession = session;
    this.playerController = new AvPlayController(container);
    this.playerController.setOnEnded(() => {
      if (session.watchType === "SERIES_EPISODE" && session.seriesInfo && session.episodeId) {
        const episodes = Object.values(session.seriesInfo.episodes).flat();
        const current = episodes.find((ep) => ep.id === session.episodeId);
        if (current) {
          const next = findNextEpisode(current, session.seriesInfo);
          if (next) {
            this.showNextEpisodeDialog(next, session);
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
      await this.playerController.open(
        session.url,
        session.title,
        session.startPositionMs ?? 0,
        initialSubtitle,
      );
      this.mountPlayerHandlers(session);
    } catch (error) {
      appStore.setError(error instanceof Error ? error.message : "Playback failed.");
      this.stopPlayerAndSave();
      appStore.closePlayer();
    }
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
            appStore.setError(error instanceof Error ? error.message : "Test failed.");
          }
        })();
      });
    });
  }
}
