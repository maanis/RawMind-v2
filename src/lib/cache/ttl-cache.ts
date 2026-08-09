export class TTLCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  set(key: string, value: T) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: string) {
    this.store.delete(key);
  }
}
