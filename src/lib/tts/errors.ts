export type NarrationErrorCode =
  | "configuration"
  | "invalid-response"
  | "rate-limit"
  | "timeout"
  | "provider";

export class NarrationGenerationError extends Error {
  constructor(
    readonly code: NarrationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NarrationGenerationError";
  }
}
