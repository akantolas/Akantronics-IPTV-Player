import type { LiveStream, SeriesItem, VodStream } from "@tv/xtream-core";
import { contentService } from "./contentService.js";
import {
  categoryVisibilityStore,
  filterVisibleCategories,
} from "./categoryVisibility.js";
import type { SearchResults } from "./dashboardService.js";

interface IndexedLive {
  stream: LiveStream;
  normalized: string;
  categoryId: string;
}

interface IndexedMovie {
  movie: VodStream;
  normalized: string;
  categoryId: string;
}

interface IndexedSeries {
  series: SeriesItem;
  normalized: string;
  categoryId: string;
}

class CatalogIndex {
  private live: IndexedLive[] = [];
  private movies: IndexedMovie[] = [];
  private series: IndexedSeries[] = [];
  private building = false;
  private ready = false;

  isReady(): boolean {
    return this.ready;
  }

  async rebuild(): Promise<void> {
    if (this.building) return;
    this.building = true;
    try {
      const [liveCats, movieCats, seriesCats] = await Promise.all([
        filterVisibleCategories("live", await contentService.getLiveCategories(), categoryVisibilityStore, false),
        filterVisibleCategories("movies", await contentService.getVodCategories(), categoryVisibilityStore, false),
        filterVisibleCategories("series", await contentService.getSeriesCategories(), categoryVisibilityStore, false),
      ]);

      const liveEntries: IndexedLive[] = [];
      for (const category of liveCats) {
        const streams = await contentService.getLiveStreams(category.category_id);
        for (const stream of streams) {
          liveEntries.push({ stream, normalized: normalizeTitle(stream.name), categoryId: category.category_id });
        }
      }

      const movieEntries: IndexedMovie[] = [];
      for (const category of movieCats) {
        const streams = await contentService.getVodStreams(category.category_id);
        for (const movie of streams) {
          movieEntries.push({ movie, normalized: normalizeTitle(movie.name), categoryId: category.category_id });
        }
      }

      const seriesEntries: IndexedSeries[] = [];
      for (const category of seriesCats) {
        const items = await contentService.getSeries(category.category_id);
        for (const item of items) {
          seriesEntries.push({ series: item, normalized: normalizeTitle(item.name), categoryId: category.category_id });
        }
      }

      this.live = liveEntries;
      this.movies = movieEntries;
      this.series = seriesEntries;
      this.ready = true;
    } finally {
      this.building = false;
    }
  }

  search(query: string, limit = 40): SearchResults {
    const normalized = normalizeTitle(query);
    if (!normalized) return { live: [], movies: [], series: [] };
    return {
      live: this.live.filter((item) => item.normalized.includes(normalized)).slice(0, limit).map((item) => item.stream),
      movies: this.movies.filter((item) => item.normalized.includes(normalized)).slice(0, limit).map((item) => item.movie),
      series: this.series.filter((item) => item.normalized.includes(normalized)).slice(0, limit).map((item) => item.series),
    };
  }

  searchInSection(
    section: "live" | "movies" | "series",
    query: string,
    categoryId?: string,
    limit = 120,
  ): LiveStream[] | VodStream[] | SeriesItem[] {
    const normalized = normalizeTitle(query);
    if (!normalized) return [];
    const matchesCategory = (id: string): boolean => !categoryId || id === categoryId;
    if (section === "live") {
      return this.live
        .filter((item) => item.normalized.includes(normalized) && matchesCategory(item.categoryId))
        .slice(0, limit)
        .map((item) => item.stream);
    }
    if (section === "movies") {
      return this.movies
        .filter((item) => item.normalized.includes(normalized) && matchesCategory(item.categoryId))
        .slice(0, limit)
        .map((item) => item.movie);
    }
    return this.series
      .filter((item) => item.normalized.includes(normalized) && matchesCategory(item.categoryId))
      .slice(0, limit)
      .map((item) => item.series);
  }

  invalidate(): void {
    this.ready = false;
    this.live = [];
    this.movies = [];
    this.series = [];
  }
}

function normalizeTitle(value: string): string {
  return value
    .toLocaleLowerCase("el-GR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export const catalogIndex = new CatalogIndex();
