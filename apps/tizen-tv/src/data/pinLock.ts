const PIN_HASH_KEY = "tv_settings_pin_hash";
const LOCKED_CATEGORIES_KEY = "tv_locked_categories";
const ADULT_PATTERN = /(xxx|adult|18\+|porn|ερωτ|σέξ)/i;

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function loadLockedCategories(): string[] {
  try {
    const raw = localStorage.getItem(LOCKED_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLockedCategories(ids: string[]): void {
  localStorage.setItem(LOCKED_CATEGORIES_KEY, JSON.stringify([...new Set(ids)].sort()));
}

export const pinLock = {
  hasPin(): boolean {
    return Boolean(localStorage.getItem(PIN_HASH_KEY));
  },

  async verify(pin: string): Promise<boolean> {
    const saved = localStorage.getItem(PIN_HASH_KEY);
    if (!saved) return false;
    const hash = await hashPin(pin);
    return saved === hash;
  },

  verifySync(pin: string): boolean {
    // Legacy plaintext PIN support for migration path.
    const legacy = localStorage.getItem("tv_settings_pin");
    return Boolean(legacy) && legacy === pin.trim();
  },

  async set(pin: string): Promise<void> {
    const normalized = pin.trim();
    if (!/^\d{4,8}$/.test(normalized)) {
      throw new Error("Το PIN πρέπει να έχει 4 έως 8 ψηφία.");
    }
    const hash = await hashPin(normalized);
    localStorage.setItem(PIN_HASH_KEY, hash);
    localStorage.removeItem("tv_settings_pin");
  },

  clear(): void {
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem("tv_settings_pin");
  },

  getLockedCategories(): string[] {
    return loadLockedCategories();
  },

  setLockedCategories(ids: string[]): void {
    saveLockedCategories(ids);
  },

  isAdultCategoryName(name: string): boolean {
    return ADULT_PATTERN.test(name);
  },

  isCategoryLocked(categoryId: string | undefined, categoryName?: string): boolean {
    if (!categoryId) return false;
    if (loadLockedCategories().includes(categoryId)) return true;
    return Boolean(categoryName && this.isAdultCategoryName(categoryName) && this.hasPin());
  },
};
