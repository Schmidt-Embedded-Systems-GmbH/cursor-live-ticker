type CacheEntry<T> = {
  value?: T;
  fetchedAt?: number;
  expiresAt?: number;
  inFlight?: Promise<T>;
};

export class AsyncCache {
  private readonly map = new Map<string, CacheEntry<any>>();
  private readonly maxEntries: number;

  constructor(opts?: { maxEntries?: number }) {
    this.maxEntries = opts?.maxEntries ?? 100;
  }

  /** Remove oldest expired entries if we exceed maxEntries */
  private evictStale(): void {
    if (this.map.size <= this.maxEntries) return;

    const now = Date.now();
    const entries = Array.from(this.map.entries());

    // Sort by expiration (oldest first) and remove expired ones
    entries
      .filter(([, e]) => e.expiresAt && e.expiresAt < now)
      .forEach(([k]) => this.map.delete(k));

    // If still over limit, remove oldest by fetchedAt
    if (this.map.size > this.maxEntries) {
      const sorted = Array.from(this.map.entries())
        .filter(([, e]) => !e.inFlight)
        .sort((a, b) => (a[1].fetchedAt ?? 0) - (b[1].fetchedAt ?? 0));

      const toRemove = sorted.slice(0, this.map.size - this.maxEntries);
      toRemove.forEach(([k]) => this.map.delete(k));
    }
  }

  async get<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<{ value: T; fetchedAt: number }> {
    this.evictStale();
    const now = Date.now();
    const entry = this.map.get(key) ?? {};

    // Fresh cached value
    if (entry.value !== undefined && entry.expiresAt !== undefined && entry.expiresAt > now) {
      return { value: entry.value as T, fetchedAt: entry.fetchedAt ?? now };
    }

    // In-flight request
    if (entry.inFlight) {
      const v = await entry.inFlight;
      return { value: v, fetchedAt: this.map.get(key)?.fetchedAt ?? now };
    }

    const inFlight = (async () => {
      const v = await fetcher();
      const fetchedAt = Date.now();
      this.map.set(key, { value: v, fetchedAt, expiresAt: fetchedAt + ttlMs });
      return v;
    })();

    this.map.set(key, { ...entry, inFlight });

    try {
      const v = await inFlight;
      // ensure inFlight cleared
      const cur = this.map.get(key);
      if (cur) this.map.set(key, { value: cur.value, fetchedAt: cur.fetchedAt, expiresAt: cur.expiresAt });
      return { value: v, fetchedAt: this.map.get(key)?.fetchedAt ?? now };
    } catch (e) {
      // clear on error so we can retry next time
      this.map.delete(key);
      throw e;
    }
  }
}
