export type FavoriteKind = "LIVE" | "MOVIE" | "SERIES";

export interface FavoriteItem {
  id: string;
  kind: FavoriteKind;
  title: string;
  imageUrl?: string;
  streamId?: number;
  seriesId?: number;
  containerExtension?: string;
  categoryId?: string;
}

const STORAGE_KEY = "tv_favorites";

export class FavoritesStore {
  private items: FavoriteItem[] = load();

  getAll(): FavoriteItem[] {
    return [...this.items];
  }

  isFavorite(id: string): boolean {
    return this.items.some((item) => item.id === id);
  }

  toggle(item: FavoriteItem): boolean {
    const exists = this.isFavorite(item.id);
    this.items = exists
      ? this.items.filter((entry) => entry.id !== item.id)
      : [item, ...this.items];
    persist(this.items);
    return !exists;
  }

  replaceAll(items: FavoriteItem[]): void {
    this.items = items;
    persist(this.items);
  }

  byKind(kind: FavoriteKind): FavoriteItem[] {
    return this.items.filter((item) => item.kind === kind);
  }
}

export function favoriteFromLive(stream: {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
}): FavoriteItem {
  return {
    id: `fav_live_${stream.stream_id}`,
    kind: "LIVE",
    title: stream.name,
    imageUrl: stream.stream_icon,
    streamId: stream.stream_id,
    categoryId: stream.category_id,
  };
}

export function favoriteFromMovie(movie: {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
}): FavoriteItem {
  return {
    id: `fav_movie_${movie.stream_id}`,
    kind: "MOVIE",
    title: movie.name,
    imageUrl: movie.stream_icon,
    streamId: movie.stream_id,
    categoryId: movie.category_id,
    containerExtension: movie.container_extension,
  };
}

export function favoriteFromSeries(series: {
  series_id: number;
  name: string;
  cover?: string;
  category_id?: string;
}): FavoriteItem {
  return {
    id: `fav_series_${series.series_id}`,
    kind: "SERIES",
    title: series.name,
    imageUrl: series.cover,
    seriesId: series.series_id,
    categoryId: series.category_id,
  };
}

function load(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: FavoriteItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const favoritesStore = new FavoritesStore();
