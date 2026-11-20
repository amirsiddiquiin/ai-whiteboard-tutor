import { narrationRequestSchema, narrationResponseSchema } from "@/features/narration/schema";
import { apiError } from "@/lib/api/errors";
import { readJsonBody, RequestBodyError } from "@/lib/api/request";
import {
  NarrationGenerationError,
  type NarrationErrorCode,
} from "@/lib/tts/errors";
import { synthesizeLessonNarration } from "@/lib/tts/narration";

const narrationErrorCodes = new Set<NarrationErrorCode>([
  "configuration",
  "invalid-response",
  "quota",
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
  requestId = crypto.randomUUID(),
) {
  let body: unknown;
  try {
    body = await readJsonBody(request, 131_072);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyError && error.code === "payload-too-large";
    return apiError(
      tooLarge ? 413 : 400,
      tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
      tooLarge ? "Request body is too large." : "Request body must be valid JSON.",
      false,
      { requestId },
    );
  }

  const parsed = narrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "INVALID_LESSON", "A valid generated lesson is required.", false, { requestId });
  }

  try {
    const narration = narrationResponseSchema.parse(
      await synthesize(parsed.data.lesson),
    );
    return Response.json(narration, {
      status: 200,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    const code = narrationErrorCode(error);
    if (!code) {
      return apiError(502, "TTS_PROVIDER_ERROR", "Narration could not be generated.", true, { requestId });
    }
    switch (code) {
      case "configuration":
        return apiError(503, "CONFIGURATION_ERROR", "Narration is not configured.", false, { requestId });
      case "invalid-response":
        return apiError(502, "TTS_PROVIDER_ERROR", "Narration audio was invalid. Please retry.", true, { requestId });
      case "quota":
        return apiError(429, "RATE_LIMITED", "Narration quota is exhausted. Add provider credits and retry.", false, { requestId });
      case "rate-limit":
        return apiError(429, "RATE_LIMITED", "Narration generation is busy. Try again shortly.", true, { requestId });
      case "timeout":
        return apiError(504, "PROVIDER_TIMEOUT", "Narration generation took too long.", true, { requestId });
      case "provider":
        return apiError(502, "TTS_PROVIDER_ERROR", "Narration could not be generated. Please retry.", true, { requestId });
    }
  }
}
