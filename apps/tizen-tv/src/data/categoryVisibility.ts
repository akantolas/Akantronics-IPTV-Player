export interface CategoryVisibilityPrefs {
  hiddenLive: string[];
  hiddenMovies: string[];
  hiddenSeries: string[];
}

const STORAGE_KEY = "tv_category_visibility";
const FAVORITES_CATEGORY_ID = "__favorites__";

export type ContentSection = "live" | "movies" | "series";

export class CategoryVisibilityStore {
  private prefs: CategoryVisibilityPrefs = load();
  private listeners = new Set<(section: ContentSection) => void>();

  get hiddenLive(): string[] {
    return this.prefs.hiddenLive;
  }

  get hiddenMovies(): string[] {
    return this.prefs.hiddenMovies;
  }

  get hiddenSeries(): string[] {
    return this.prefs.hiddenSeries;
  }

  subscribe(listener: (section: ContentSection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isVisible(section: ContentSection, categoryId: string): boolean {
    const normalized = categoryId.trim();
    const hidden =
      section === "live"
        ? this.prefs.hiddenLive
        : section === "movies"
          ? this.prefs.hiddenMovies
          : this.prefs.hiddenSeries;
    return !hidden.includes(normalized);
  }

  setVisible(section: ContentSection, categoryId: string, visible: boolean): void {
    const normalized = categoryId.trim();
    const hidden = new Set(this.hiddenSet(section));
    if (visible) {
      hidden.delete(normalized);
    } else {
      hidden.add(normalized);
    }
    this.update(section, [...hidden].sort());
  }

  setAllVisible(section: ContentSection): void {
    this.update(section, []);
  }

  setAllHidden(section: ContentSection, categoryIds: string[]): void {
    this.update(
      section,
      categoryIds.map((id) => id.trim()).filter(Boolean).sort(),
    );
  }

  replaceAll(prefs: CategoryVisibilityPrefs): void {
    this.prefs = {
      hiddenLive: prefs.hiddenLive ?? [],
      hiddenMovies: prefs.hiddenMovies ?? [],
      hiddenSeries: prefs.hiddenSeries ?? [],
    };
    persist(this.prefs);
    this.listeners.forEach((listener) => {
      listener("live");
      listener("movies");
      listener("series");
    });
  }

  private hiddenSet(section: ContentSection): string[] {
    if (section === "live") return this.prefs.hiddenLive;
    if (section === "movies") return this.prefs.hiddenMovies;
    return this.prefs.hiddenSeries;
  }

  private update(section: ContentSection, hidden: string[]): void {
    this.prefs =
      section === "live"
        ? { ...this.prefs, hiddenLive: hidden }
        : section === "movies"
          ? { ...this.prefs, hiddenMovies: hidden }
          : { ...this.prefs, hiddenSeries: hidden };
    persist(this.prefs);
    this.listeners.forEach((listener) => listener(section));
  }
}

export function filterVisibleCategories<T extends { category_id: string; category_name: string }>(
  section: "live" | "movies" | "series",
  categories: T[],
  store: CategoryVisibilityStore,
  includeFavorites = true,
): T[] {
  const visible = categories.filter((cat) => store.isVisible(section, cat.category_id));
  if (!includeFavorites) return visible;
  const favChip = {
    category_id: FAVORITES_CATEGORY_ID,
    category_name: "Αγαπημένα",
  } as T;
  return [favChip, ...visible];
}

export const categoryVisibilityStore = new CategoryVisibilityStore();
export { FAVORITES_CATEGORY_ID };

function load(): CategoryVisibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hiddenLive: [], hiddenMovies: [], hiddenSeries: [] };
    return JSON.parse(raw) as CategoryVisibilityPrefs;
  } catch {
    return { hiddenLive: [], hiddenMovies: [], hiddenSeries: [] };
  }
}

function persist(prefs: CategoryVisibilityPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
