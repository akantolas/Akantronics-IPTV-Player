import {
  FAVORITES_CATEGORY_ID,
  categoryVisibilityStore,
  filterVisibleCategories,
} from "./categoryVisibility.js";
import { contentService, type VodInfo } from "./contentService.js";
import { catalogIndex } from "./catalogIndex.js";
import { favoritesStore } from "./favoritesStore.js";
import { watchHistoryStore } from "./watchHistory.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { escapeHtml, initFocusRing, posterCard, setFocus } from "../ui/focus.js";
import type { DetailContext, PlayerSession } from "../types/global.js";
import type { LiveStream, SeriesItem, VodStream } from "@tv/xtream-core";

export type BrowseScreen = "live" | "movies" | "series";

export interface BrowseActions {
  openPlayer: (session: PlayerSession) => void;
  openDetail: (detail: DetailContext) => void;
}

interface BrowsePreviewRow {
  category: { category_id: string; category_name: string };
  html: string;
  items: LiveStream[] | VodStream[] | SeriesItem[];
}

const ROW_PREVIEW_CATEGORY_LIMIT = 6;
const ROW_PREVIEW_ITEM_LIMIT = 18;
const SEARCH_RESULT_LIMIT = 120;

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

export async function renderBrowseSearchGrid(
  screen: BrowseScreen,
  query: string,
  actions: BrowseActions,
  categoryId?: string,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  if (categoryId === FAVORITES_CATEGORY_ID) {
    return renderFavoritesSearchGrid(screen, query, actions);
  }
  if (screen === "movies") {
    return renderMovieSearchGrid(query, actions, categoryId);
  }
  if (screen === "series") {
    return renderSeriesSearchGrid(query, actions, categoryId);
  }
  return renderLiveSearchGrid(query, actions, categoryId);
}

async function renderLiveSearchGrid(
  query: string,
  actions: BrowseActions,
  categoryId?: string,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    return {
      html: `<div class="state-panel empty-state"><p>Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p></div>`,
      bind: () => {},
    };
  }

  const categories = (await loadBrowseCategories("live")).filter((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
  const categoryNames = new Map(categories.map((category) => [category.category_id, category.category_name]));
  const scopedCategories = categoryId ? categories.filter((cat) => cat.category_id === categoryId) : categories;

  let matches: Array<{ stream: LiveStream; categoryName: string }> = [];

  if (categoryId && catalogIndex.isReady()) {
    const streams = catalogIndex.searchInSection("live", query, categoryId, SEARCH_RESULT_LIMIT) as LiveStream[];
    const categoryName = categoryNames.get(categoryId) ?? "Live";
    matches = streams.map((stream) => ({ stream, categoryName }));
  } else if (!categoryId && catalogIndex.isReady()) {
    const streams = catalogIndex.searchInSection("live", query, undefined, SEARCH_RESULT_LIMIT) as LiveStream[];
    matches = streams.map((stream) => ({
      stream,
      categoryName: categoryNames.get(stream.category_id) ?? "Live",
    }));
  } else {
    for (const category of scopedCategories) {
      const streams = await contentService.getLiveStreams(category.category_id);
      matches.push(
        ...streams
          .filter((stream) => normalizeSearch(stream.name).includes(normalizedQuery))
          .map((stream) => ({ stream, categoryName: category.category_name })),
      );
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
    matches.length = Math.min(matches.length, SEARCH_RESULT_LIMIT);
  }

  if (!matches.length) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν κανάλια για “${escapeHtml(query)}”.</p></div>`,
      bind: () => {},
    };
  }

  const html = matches
    .map(({ stream, categoryName }) =>
      posterCard(String(stream.stream_id), stream.name, stream.stream_icon, categoryName || categoryNames.get(stream.category_id) || "Live"),
    )
    .join("");

  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = Number(card.dataset.id);
          const match = matches.find((item) => item.stream.stream_id === id);
          if (!match) return;
          actions.openDetail({
            kind: "live",
            id: match.stream.stream_id,
            title: match.stream.name,
            imageUrl: match.stream.stream_icon,
            categoryId: match.stream.category_id,
            categoryLabel: match.categoryName,
          });
        });
      });
    },
  };
}

async function renderMovieSearchGrid(
  query: string,
  actions: BrowseActions,
  categoryId?: string,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    return {
      html: `<div class="state-panel empty-state"><p>Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p></div>`,
      bind: () => {},
    };
  }

  const categories = (await loadBrowseCategories("movies")).filter((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
  const categoryNames = new Map(categories.map((category) => [category.category_id, category.category_name]));
  let matches: Array<{ movie: VodStream; categoryName: string }> = [];

  if (catalogIndex.isReady()) {
    const movies = catalogIndex.searchInSection("movies", query, categoryId, SEARCH_RESULT_LIMIT) as VodStream[];
    matches = movies.map((movie) => ({
      movie,
      categoryName: categoryNames.get(movie.category_id) ?? movie.rating ?? "Ταινία",
    }));
  } else if (categoryId) {
    const categoryName = categoryNames.get(categoryId) ?? "Ταινία";
    const movies = await getMovieStreamsForCategory(categoryId);
    matches = movies
      .filter((movie) => normalizeSearch(movie.name).includes(normalizedQuery))
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((movie) => ({ movie, categoryName }));
  } else {
    for (const category of categories) {
      const movies = await getMovieStreamsForCategory(category.category_id);
      matches.push(
        ...movies
          .filter((movie) => normalizeSearch(movie.name).includes(normalizedQuery))
          .map((movie) => ({ movie, categoryName: category.category_name })),
      );
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
    matches.length = Math.min(matches.length, SEARCH_RESULT_LIMIT);
  }

  if (!matches.length) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν ταινίες για “${escapeHtml(query)}”.</p></div>`,
      bind: () => {},
    };
  }

  const html = matches
    .map(({ movie, categoryName }) =>
      posterCard(String(movie.stream_id), movie.name, movie.stream_icon, movie.rating ?? categoryName),
    )
    .join("");

  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = Number(card.dataset.id);
          const match = matches.find((item) => item.movie.stream_id === id);
          if (!match) return;
          actions.openDetail({
            kind: "movie",
            id: match.movie.stream_id,
            title: match.movie.name,
            imageUrl: match.movie.stream_icon,
            extension: match.movie.container_extension,
          });
        });
      });
    },
  };
}

async function renderSeriesSearchGrid(
  query: string,
  actions: BrowseActions,
  categoryId?: string,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    return {
      html: `<div class="state-panel empty-state"><p>Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p></div>`,
      bind: () => {},
    };
  }

  const categories = (await loadBrowseCategories("series")).filter((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
  const categoryNames = new Map(categories.map((category) => [category.category_id, category.category_name]));
  let matches: Array<{ series: SeriesItem; categoryName: string }> = [];

  if (catalogIndex.isReady()) {
    const items = catalogIndex.searchInSection("series", query, categoryId, SEARCH_RESULT_LIMIT) as SeriesItem[];
    matches = items.map((series) => ({
      series,
      categoryName: categoryNames.get(series.category_id) ?? series.rating ?? "Σειρά",
    }));
  } else if (categoryId) {
    const categoryName = categoryNames.get(categoryId) ?? "Σειρά";
    const items = await contentService.getSeries(categoryId);
    matches = items
      .filter((item) => normalizeSearch(item.name).includes(normalizedQuery))
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((series) => ({ series, categoryName }));
  } else {
    for (const category of categories) {
      const items = await contentService.getSeries(category.category_id);
      matches.push(
        ...items
          .filter((item) => normalizeSearch(item.name).includes(normalizedQuery))
          .map((series) => ({ series, categoryName: category.category_name })),
      );
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
    matches.length = Math.min(matches.length, SEARCH_RESULT_LIMIT);
  }

  if (!matches.length) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν σειρές για “${escapeHtml(query)}”.</p></div>`,
      bind: () => {},
    };
  }

  const html = matches
    .map(({ series, categoryName }) =>
      posterCard(String(series.series_id), series.name, series.cover, series.rating ?? categoryName),
    )
    .join("");

  return {
    html,
    bind: (grid) => {
      grid.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
        card.addEventListener("click", () => {
          void (async () => {
            const id = Number(card.dataset.id);
            const match = matches.find((item) => item.series.series_id === id);
            if (!match) return;
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

async function renderFavoritesSearchGrid(
  screen: BrowseScreen,
  query: string,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) {
    return {
      html: `<div class="state-panel empty-state"><p>Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.</p></div>`,
      bind: () => {},
    };
  }

  if (screen === "live") {
    const favs = favoritesStore.byKind("LIVE").filter((fav) => normalizeSearch(fav.title).includes(normalizedQuery));
    if (!favs.length) {
      return {
        html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν αγαπημένα κανάλια για “${escapeHtml(query)}”.</p></div>`,
        bind: () => {},
      };
    }
    const html = favs.map((fav) => posterCard(String(fav.streamId ?? ""), fav.title, fav.imageUrl, "Αγαπημένο")).join("");
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
    const favs = favoritesStore.byKind("MOVIE").filter((fav) => normalizeSearch(fav.title).includes(normalizedQuery));
    if (!favs.length) {
      return {
        html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν αγαπημένες ταινίες για “${escapeHtml(query)}”.</p></div>`,
        bind: () => {},
      };
    }
    const html = favs.map((fav) => posterCard(String(fav.streamId ?? ""), fav.title, fav.imageUrl, "Αγαπημένο")).join("");
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

  const favs = favoritesStore.byKind("SERIES").filter((fav) => normalizeSearch(fav.title).includes(normalizedQuery));
  if (!favs.length) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν αγαπημένες σειρές για “${escapeHtml(query)}”.</p></div>`,
      bind: () => {},
    };
  }
  const html = favs.map((fav) => posterCard(String(fav.seriesId ?? ""), fav.title, fav.imageUrl, "Αγαπημένο")).join("");
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

export async function renderBrowseRows(
  screen: BrowseScreen,
  actions: BrowseActions,
): Promise<{ html: string; bind: (grid: HTMLElement) => void }> {
  const categories = (await loadBrowseCategories(screen)).filter((cat) => cat.category_id !== FAVORITES_CATEGORY_ID);
  const visibleRows: BrowsePreviewRow[] = [];
  for (const category of categories) {
    const row = await loadPreviewRow(screen, category);
    if (row.html.trim()) visibleRows.push(row);
    if (visibleRows.length >= ROW_PREVIEW_CATEGORY_LIMIT) break;
  }

  if (!visibleRows.length) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκε περιεχόμενο.</p></div>`,
      bind: () => {},
    };
  }

  const moreHint =
    categories.length > ROW_PREVIEW_CATEGORY_LIMIT
      ? `<div class="browse-load-hint">Χρησιμοποίησε τις κατηγορίες επάνω για πλήρη πρόσβαση σε όλη την playlist.</div>`
      : "";
  const html =
    visibleRows
      .map(
        (row) => `
        <section class="netflix-row" data-category-id="${row.category.category_id}">
          <div class="section-header">
            <h2 class="section-title">${escapeHtml(row.category.category_name)}</h2>
            <button class="section-action focusable" data-row-category="${escapeHtml(row.category.category_id)}" tabindex="0">Όλα</button>
          </div>
          <div class="history-row netflix-strip">${row.html}</div>
        </section>
      `,
      )
      .join("") + moreHint;

  return {
    html,
    bind: (grid) => {
      visibleRows.forEach((row) => {
        const section = grid.querySelector<HTMLElement>(`[data-category-id="${cssEscape(row.category.category_id)}"]`);
        section?.querySelector<HTMLElement>("[data-row-category]")?.addEventListener("click", () => {
          void (async () => {
            const result = await renderBrowseGrid(screen, row.category.category_id, actions);
            grid.innerHTML = result.html;
            grid.classList.add("browse-grid-compact");
            result.bind(grid);
            initFocusRing(grid);
            setFocus(grid.querySelector<HTMLElement>(".focusable"));
          })();
        });

        section?.querySelectorAll<HTMLElement>(".poster-card").forEach((card) => {
          card.addEventListener("click", () => {
            const id = Number(card.dataset.id);
            if (screen === "live") {
              const stream = (row.items as LiveStream[]).find((item) => item.stream_id === id);
              if (!stream) return;
              actions.openDetail({
                kind: "live",
                id: stream.stream_id,
                title: stream.name,
                imageUrl: stream.stream_icon,
                categoryId: stream.category_id,
                categoryLabel: row.category.category_name,
              });
              return;
            }
            if (screen === "movies") {
              const movie = (row.items as VodStream[]).find((item) => item.stream_id === id);
              if (!movie) return;
              actions.openDetail({
                kind: "movie",
                id: movie.stream_id,
                title: movie.name,
                imageUrl: movie.stream_icon,
                extension: movie.container_extension,
              });
              return;
            }
            void (async () => {
              const series = (row.items as SeriesItem[]).find((item) => item.series_id === id);
              if (!series) return;
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
      });
    },
  };
}

const FEATURED_POOL_LIMIT = 60;

export async function loadFeaturedSeries(): Promise<SeriesItem | null> {
  const categories = (await loadBrowseCategories("series")).filter(
    (cat) => cat.category_id !== FAVORITES_CATEGORY_ID,
  );
  const pool: SeriesItem[] = [];
  for (const category of categories) {
    const items = await contentService.getSeries(category.category_id);
    pool.push(...items);
    if (pool.length >= FEATURED_POOL_LIMIT) break;
  }

  if (!pool.length) return null;

  const withBackdrop = pool.filter((item) => item.backdrop_path?.[0]);
  const candidates = withBackdrop.length ? withBackdrop : pool.filter((item) => item.cover);
  const source = candidates.length ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

export interface FeaturedMovie {
  stream: VodStream;
  info?: VodInfo["info"];
  vodInfo?: VodInfo;
}

export async function loadFeaturedMovie(): Promise<FeaturedMovie | null> {
  const categories = (await loadBrowseCategories("movies")).filter(
    (cat) => cat.category_id !== FAVORITES_CATEGORY_ID,
  );
  const pool: VodStream[] = [];
  for (const category of categories) {
    const items = await getMovieStreamsForCategory(category.category_id);
    pool.push(...items);
    if (pool.length >= FEATURED_POOL_LIMIT) break;
  }

  if (!pool.length) return null;

  const withArt = pool.filter((item) => item.stream_icon);
  const source = withArt.length ? withArt : pool;
  const stream = source[Math.floor(Math.random() * source.length)] ?? null;
  if (!stream) return null;

  try {
    const vodInfo = await contentService.getVodInfo(stream.stream_id);
    return { stream, info: vodInfo.info, vodInfo };
  } catch {
    return { stream };
  }
}

async function loadPreviewRow(
  screen: BrowseScreen,
  category: { category_id: string; category_name: string },
): Promise<BrowsePreviewRow> {
  if (screen === "live") {
    const items = (await contentService.getLiveStreams(category.category_id)).slice(0, ROW_PREVIEW_ITEM_LIMIT);
    return {
      category,
      html: items.map((stream) => posterCard(String(stream.stream_id), stream.name, stream.stream_icon, "Live")).join(""),
      items,
    };
  }
  if (screen === "movies") {
    const items = (await getMovieStreamsForCategory(category.category_id)).slice(0, ROW_PREVIEW_ITEM_LIMIT);
    return {
      category,
      html: items.map((movie) => posterCard(String(movie.stream_id), movie.name, movie.stream_icon, movie.rating)).join(""),
      items,
    };
  }
  const items = (await contentService.getSeries(category.category_id)).slice(0, ROW_PREVIEW_ITEM_LIMIT);
  return {
    category,
    html: items.map((item) => posterCard(String(item.series_id), item.name, item.cover, item.rating)).join(""),
    items,
  };
}

function cssEscape(value: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replaceAll('"', '\\"');
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
  const movies = await getMovieStreamsForCategory(categoryId);
  if (movies.length === 0) {
    return {
      html: `<div class="state-panel empty-state"><p>Δεν βρέθηκαν ταινίες.</p></div>`,
      bind: () => {},
    };
  }
  const html = movies
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

async function getMovieStreamsForCategory(categoryId?: string): Promise<VodStream[]> {
  const direct = await contentService.getVodStreams(categoryId);
  if (!categoryId || direct.length > 0) return direct;

  const allMovies = await contentService.getVodStreams();
  return allMovies.filter((movie) => String(movie.category_id) === String(categoryId));
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
