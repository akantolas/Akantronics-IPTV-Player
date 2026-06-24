const STORAGE_KEY = "tv_recent_search";
const MAX_ITEMS = 8;

export class RecentSearchStore {
  private queries: string[] = load();

  getAll(): string[] {
    return [...this.queries];
  }

  add(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;
    this.queries = [trimmed, ...this.queries.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      MAX_ITEMS,
    );
    persist(this.queries);
  }

  clear(): void {
    this.queries = [];
    localStorage.removeItem(STORAGE_KEY);
  }
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persist(items: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const recentSearchStore = new RecentSearchStore();
