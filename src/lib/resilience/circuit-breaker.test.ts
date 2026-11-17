import { describe, expect, it, vi } from "vitest";

import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after repeated dependency failures and permits one recovery probe", async () => {
    let now = 1_000;
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetAfterMs: 5_000,
      now: () => now,
    });
    const failing = vi.fn(async () => { throw new Error("downstream unavailable"); });

    await expect(breaker.execute(failing, () => true)).rejects.toThrow("downstream unavailable");
    await expect(breaker.execute(failing, () => true)).rejects.toThrow("downstream unavailable");
    await expect(breaker.execute(failing, () => true)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(failing).toHaveBeenCalledTimes(2);

    now += 5_000;
    await expect(breaker.execute(async () => "recovered", () => true)).resolves.toBe("recovered");
    await expect(breaker.execute(async () => "healthy", () => true)).resolves.toBe("healthy");
  });

  it("does not count caller or configuration errors as dependency failures", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetAfterMs: 1_000 });
    await expect(
      breaker.execute(async () => { throw new Error("bad request"); }, () => false),
    ).rejects.toThrow("bad request");
    await expect(breaker.execute(async () => "ok", () => true)).resolves.toBe("ok");
  });
});
