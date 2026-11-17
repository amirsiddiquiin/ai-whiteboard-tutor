import { describe, expect, it } from "vitest";

import { InMemoryRateLimiter } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  it("allows the configured budget and returns a bounded retry delay", () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });

    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume("client")).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 10,
    });

    now += 10_000;
    expect(limiter.consume("client")).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("isolates independent client budgets", () => {
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.consume("client-a").allowed).toBe(true);
    expect(limiter.consume("client-a").allowed).toBe(false);
    expect(limiter.consume("client-b").allowed).toBe(true);
  });
});
