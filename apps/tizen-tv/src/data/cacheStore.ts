interface CacheEnvelope<T> {
  expiresAt: number;
  value: T;
}

const PREFIX = "tv_cache:";

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || envelope.expiresAt <= Date.now()) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  try {
    const envelope: CacheEnvelope<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Cache is opportunistic on TV storage.
  }
  return value;
}

export async function cacheRemember<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached) return cached;
  return cacheSet(key, await loader(), ttlMs);
}

export function clearAppCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

export function clearCacheKeysMatching(matcher: (key: string) => boolean): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX) && matcher(key.slice(PREFIX.length))) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}
