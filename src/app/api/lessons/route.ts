import { createLessonRequestSchema } from "@/features/lesson/schema";
import { generateLesson, LessonGenerationError } from "@/lib/ai/generate-lesson";
import { apiError } from "@/lib/api/errors";
import { createApiRequestContext, observedResponse } from "@/lib/api/observability";
import { InMemoryRateLimiter } from "@/lib/api/rate-limit";
import { readJsonBody, RequestBodyError, requestClientKey } from "@/lib/api/request";

export const maxDuration = 60;
const lessonRateLimiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 });

export async function POST(request: Request) {
  const context = createApiRequestContext("/api/lessons");
  const rateLimit = lessonRateLimiter.consume(requestClientKey(request));
  if (!rateLimit.allowed) {
    return observedResponse(
      context,
      apiError(429, "RATE_LIMITED", "Too many lesson requests. Try again shortly.", true, {
        requestId: context.requestId,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }),
      "rate_limited",
    );
  }

  let body: unknown;

  try {
    body = await readJsonBody(request, 4_096);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyError && error.code === "payload-too-large";
    return observedResponse(
      context,
      apiError(
        tooLarge ? 413 : 400,
        tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
        tooLarge ? "Request body is too large." : "Request body must be valid JSON.",
        false,
        { requestId: context.requestId },
      ),
      tooLarge ? "payload_too_large" : "invalid_json",
    );
  }

  const parsed = createLessonRequestSchema.safeParse(body);

  if (!parsed.success) {
    return observedResponse(
      context,
      apiError(400, "INVALID_TOPIC", "Enter a topic between 2 and 160 characters.", false, {
        requestId: context.requestId,
      }),
      "invalid_topic",
    );
  }

  try {
    const lesson = await generateLesson(parsed.data.topic, { signal: request.signal });
    return observedResponse(
      context,
      Response.json(
        { lesson },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      ),
      "success",
    );
  } catch (error) {
    if (!(error instanceof LessonGenerationError)) {
      return observedResponse(context, apiError(
        502,
        "AI_PROVIDER_ERROR",
        "The lesson could not be generated. Please retry.",
        true,
        { requestId: context.requestId },
      ), "provider_error");
    }

    switch (error.code) {
      case "configuration":
        return observedResponse(context, apiError(503, "CONFIGURATION_ERROR", "Lesson generation is not configured.", false, { requestId: context.requestId }), "configuration_error");
      case "invalid-response":
        return observedResponse(context, apiError(422, "INVALID_LESSON", "The generated lesson was invalid. Please retry.", true, { requestId: context.requestId }), "invalid_provider_response");
      case "rate-limit":
        return observedResponse(context, apiError(429, "RATE_LIMITED", "Lesson generation is busy. Try again shortly.", true, { requestId: context.requestId }), "provider_rate_limited");
      case "timeout":
        return observedResponse(context, apiError(504, "PROVIDER_TIMEOUT", "Lesson generation took too long. Please retry.", true, { requestId: context.requestId }), "provider_timeout");
      case "provider":
        return observedResponse(context, apiError(502, "AI_PROVIDER_ERROR", "The lesson could not be generated. Please retry.", true, { requestId: context.requestId }), "provider_error");
    }
  }
}
