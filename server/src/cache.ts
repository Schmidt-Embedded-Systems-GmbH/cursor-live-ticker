type CacheEntry<T> = {
  value?: T;
  fetchedAt?: number;
  expiresAt?: number;
  inFlight?: Promise<T>;
};

export class AsyncCache {
  private readonly map = new Map<string, CacheEntry<any>>();

  async get<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<{ value: T; fetchedAt: number }> {
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
