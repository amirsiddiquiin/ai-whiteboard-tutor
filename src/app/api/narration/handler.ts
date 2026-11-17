import { narrationRequestSchema, narrationResponseSchema } from "@/features/narration/schema";
import { apiError } from "@/lib/api/errors";
import {
  NarrationGenerationError,
  type NarrationErrorCode,
} from "@/lib/tts/google-tts";
import { synthesizeLessonNarration } from "@/lib/tts/narration";

const narrationErrorCodes = new Set<NarrationErrorCode>([
  "configuration",
  "invalid-response",
  "rate-limit",
  "timeout",
  "provider",
]);

function narrationErrorCode(error: unknown): NarrationErrorCode | null {
  if (error instanceof NarrationGenerationError) return error.code;
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && narrationErrorCodes.has(code as NarrationErrorCode)
    ? (code as NarrationErrorCode)
    : null;
}

export async function handleNarrationRequest(
  request: Request,
  synthesize: typeof synthesizeLessonNarration = synthesizeLessonNarration,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  const parsed = narrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_LESSON", "A valid generated lesson is required.");
  }

  try {
    const narration = narrationResponseSchema.parse(
      await synthesize(parsed.data.lesson),
    );
    return Response.json(narration, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = narrationErrorCode(error);
    if (!code) {
      return apiError(502, "TTS_PROVIDER_ERROR", "Narration could not be generated.", true);
    }
    switch (code) {
      case "configuration":
        return apiError(503, "CONFIGURATION_ERROR", "Narration is not configured.");
      case "invalid-response":
        return apiError(502, "TTS_PROVIDER_ERROR", "Narration audio was invalid. Please retry.", true);
      case "rate-limit":
        return apiError(429, "RATE_LIMITED", "Narration generation is busy. Try again shortly.", true);
      case "timeout":
        return apiError(504, "PROVIDER_TIMEOUT", "Narration generation took too long.", true);
      case "provider":
        return apiError(502, "TTS_PROVIDER_ERROR", "Narration could not be generated. Please retry.", true);
    }
  }
}
