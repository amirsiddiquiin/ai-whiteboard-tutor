export class CircuitOpenError extends Error {
  constructor() {
    super("Dependency circuit is open.");
    this.name = "CircuitOpenError";
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetAfterMs: number;
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private probeInFlight = false;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    if (options.failureThreshold < 1 || options.resetAfterMs < 1) {
      throw new RangeError("Circuit breaker thresholds must be positive.");
    }
    this.now = options.now ?? Date.now;
  }

  async execute<T>(operation: () => Promise<T>, countsAsFailure: (error: unknown) => boolean) {
    const probe = this.beginExecution();
    try {
      const result = await operation();
      this.failures = 0;
      this.openedAt = null;
      return result;
    } catch (error) {
      if (countsAsFailure(error)) {
        this.failures = probe ? this.options.failureThreshold : this.failures + 1;
        if (this.failures >= this.options.failureThreshold) this.openedAt = this.now();
      }
      throw error;
    } finally {
      if (probe) this.probeInFlight = false;
    }
  }

  private beginExecution() {
    if (this.openedAt === null) return false;
    if (this.now() - this.openedAt < this.options.resetAfterMs || this.probeInFlight) {
      throw new CircuitOpenError();
    }
    this.probeInFlight = true;
    return true;
  }
}
