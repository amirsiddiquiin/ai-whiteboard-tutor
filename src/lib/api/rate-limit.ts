export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  maxEntries?: number;
  now?: () => number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(private readonly options: RateLimitOptions) {
    if (options.limit < 1 || options.windowMs < 1) {
      throw new RangeError("Rate limit and window must be positive.");
    }
    this.maxEntries = options.maxEntries ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  consume(key: string): RateLimitDecision {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.options.windowMs };
      this.entries.set(key, entry);
    }

    entry.count += 1;
    this.prune(now);
    const allowed = entry.count <= this.options.limit;
    return {
      allowed,
      remaining: Math.max(this.options.limit - entry.count, 0),
      retryAfterSeconds: allowed ? 0 : Math.max(Math.ceil((entry.resetAt - now) / 1_000), 1),
    };
  }

  private prune(now: number) {
    if (this.entries.size <= this.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}
