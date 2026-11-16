import { NextResponse } from "next/server";
import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "INVALID_TOPIC",
  "INVALID_LESSON",
  "RATE_LIMITED",
  "AI_PROVIDER_ERROR",
  "TTS_PROVIDER_ERROR",
  "PROVIDER_TIMEOUT",
  "CONFIGURATION_ERROR",
  "FEATURE_NOT_READY",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  retryable = false,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        retryable,
        requestId: crypto.randomUUID(),
      },
    },
    { status },
  );
}
