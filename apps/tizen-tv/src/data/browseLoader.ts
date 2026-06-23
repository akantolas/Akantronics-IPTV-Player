import {
  FAVORITES_CATEGORY_ID,
  categoryVisibilityStore,
  filterVisibleCategories,
} from "./categoryVisibility.js";
import { contentService } from "./contentService.js";
import { favoritesStore } from "./favoritesStore.js";
import { watchHistoryStore } from "./watchHistory.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { posterCard } from "../ui/focus.js";
import type { DetailContext, PlayerSession } from "../types/global.js";

export type BrowseScreen = "live" | "movies" | "series";

export interface BrowseActions {
  openPlayer: (session: PlayerSession) => void;
  openDetail: (detail: DetailContext) => void;
}

export async function loadBrowseCategories(screen: BrowseScreen): Promise<
  Array<{ category_id: string; category_name: string }>
> {
  if (screen === "live") {
    return filterVisibleCategories("live", await contentService.getLiveCategories(), categoryVisibilityStore);
  }
  if (screen === "movies") {
    return filterVisibleCategories("movies", await contentService.getVodCategories(), categoryVisibilityStore);
  }
  return filterVisibleCategories("series", await contentService.getSeriesCategories(), categoryVisibilityStore);
}

export async function renderBrowseGrid(
  screen: BrowseScreen,
  categoryId: string | undefined,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  if (categoryId === FAVORITES_CATEGORY_ID) {
    return renderFavoritesGrid(screen, actions);
  }
  if (screen === "live") {
    return renderLiveGrid(categoryId, actions);
  }
  if (screen === "movies") {
    return renderMoviesGrid(categoryId, actions);
  }
  return renderSeriesGrid(categoryId, actions);
}

async function renderFavoritesGrid(
  screen: BrowseScreen,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  if (screen === "live") {
    const favs = favoritesStore.byKind("LIVE");
    const html =
      favs.length === 0
        ? `<div class="state-panel empty-state"><p>Δεν έχεις αγαπημένα κανάλια.</p></div>`
        : favs
            .map((fav) => posterCard(String(fav.streamId ?? ""), fav.title, fav.imageUrl, "Live"))
            .join("");
    return {
      html,
      bind: (grid) => {
        grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
          card.addEventListener("click", () => {
            const id = Number(card.dataset.id);
            const fav = favs.find((item) => item.streamId === id);
            if (!fav?.streamId) return;
            actions.openDetail({
              kind: "live",
              id: fav.streamId,
              title: fav.title,
              imageUrl: fav.imageUrl,
              categoryId: fav.categoryId,
            });
          });
        });
      },
    };
  }

  if (screen === "movies") {
    const favs = favoritesStore.byKind("MOVIE");
    const html =
      favs.length === 0
        ? `<div class="state-panel empty-state"><p>Δεν έχεις αγαπημένες ταινίες.</p></div>`
        : favs
            .map((fav) => posterCard(String(fav.streamId ?? ""), fav.title, fav.imageUrl, "Αγαπημένο"))
            .join("");
    return {
      html,
      bind: (grid) => {
        grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
          card.addEventListener("click", () => {
            const id = Number(card.dataset.id);
            const fav = favs.find((item) => item.streamId === id);
            if (!fav?.streamId) return;
            actions.openDetail({
              kind: "movie",
              id: fav.streamId,
              title: fav.title,
              imageUrl: fav.imageUrl,
              extension: fav.containerExtension,
            });
          });
        });
      },
    };
  }

  const favs = favoritesStore.byKind("SERIES");
  const html =
    favs.length === 0
      ? `<div class="state-panel empty-state"><p>Δεν έχεις αγαπημένες σειρές.</p></div>`
      : favs
          .map((fav) => posterCard(String(fav.seriesId ?? ""), fav.title, fav.imageUrl, "Αγαπημένο"))
          .join("");
  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          void (async () => {
            const id = Number(card.dataset.id);
            const fav = favs.find((item) => item.seriesId === id);
            if (!fav?.seriesId) return;
            const info = await contentService.getSeriesInfo(fav.seriesId);
            actions.openDetail({
              kind: "series",
              id: fav.seriesId,
              title: info.info.name,
              imageUrl: info.info.cover,
              seriesInfo: info,
            });
          })();
        });
      });
    },
  };
}

async function renderLiveGrid(
  categoryId: string | undefined,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const streams = await contentService.getLiveStreams(categoryId);
  if (streams.length === 0) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν κανάλια.</p></div>`,
      bind: () => {},
    };
  }
  const html = streams
    .slice(0, 120)
    .map((stream) => posterCard(String(stream.stream_id), stream.name, stream.stream_icon, "Live"))
    .join("");
  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = Number(card.dataset.id);
          const stream = streams.find((item) => item.stream_id === id);
          if (!stream) return;
          actions.openDetail({
            kind: "live",
            id: stream.stream_id,
            title: stream.name,
            imageUrl: stream.stream_icon,
            categoryId: stream.category_id,
          });
        });
      });
    },
  };
}

async function renderMoviesGrid(
  categoryId: string | undefined,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const movies = await contentService.getVodStreams(categoryId);
  if (movies.length === 0) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν ταινίες.</p></div>`,
      bind: () => {},
    };
  }
  const html = movies
    .slice(0, 120)
    .map((movie) => posterCard(String(movie.stream_id), movie.name, movie.stream_icon, movie.rating ?? undefined))
    .join("");
  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = Number(card.dataset.id);
          const movie = movies.find((item) => item.stream_id === id);
          if (!movie) return;
          actions.openDetail({
            kind: "movie",
            id: movie.stream_id,
            title: movie.name,
            imageUrl: movie.stream_icon,
            extension: movie.container_extension,
          });
        });
      });
    },
  };
}

async function renderSeriesGrid(
  categoryId: string | undefined,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const series = await contentService.getSeries(categoryId);
  if (series.length === 0) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν σειρές.</p></div>`,
      bind: () => {},
    };
  }
  const html = series
    .slice(0, 120)
    .map((item) => posterCard(String(item.series_id), item.name, item.cover, item.rating))
    .join("");
  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          void (async () => {
            const id = Number(card.dataset.id);
            const info = await contentService.getSeriesInfo(id);
            actions.openDetail({
              kind: "series",
              id,
              title: info.info.name,
              imageUrl: info.info.cover,
              seriesInfo: info,
            });
          })();
        });
      });
    },
  };
}
