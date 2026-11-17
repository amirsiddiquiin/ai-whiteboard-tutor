import { chatRequestSchema } from "@/features/chat/schema";
import { apiError } from "@/lib/api/errors";
import { createApiRequestContext, observedResponse } from "@/lib/api/observability";
import { InMemoryRateLimiter } from "@/lib/api/rate-limit";
import { readJsonBody, RequestBodyError, requestClientKey } from "@/lib/api/request";

const chatRateLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(request: Request) {
  const context = createApiRequestContext("/api/chat");
  const rateLimit = chatRateLimiter.consume(requestClientKey(request));
  if (!rateLimit.allowed) {
    return observedResponse(context, apiError(429, "RATE_LIMITED", "Too many chat requests. Try again shortly.", true, {
      requestId: context.requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    }), "rate_limited");
  }

  let body: unknown;

  try {
    body = await readJsonBody(request, 32_768);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyError && error.code === "payload-too-large";
    return observedResponse(context, apiError(
      tooLarge ? 413 : 400,
      tooLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
      tooLarge ? "Request body is too large." : "Request body must be valid JSON.",
      false,
      { requestId: context.requestId },
    ), tooLarge ? "payload_too_large" : "invalid_json");
  }

  if (!chatRequestSchema.safeParse(body).success) {
    return observedResponse(context, apiError(400, "INVALID_REQUEST", "The chat request is incomplete or too long.", false, {
      requestId: context.requestId,
    }), "invalid_request");
  }

  return observedResponse(context, apiError(503, "FEATURE_NOT_READY", "Follow-up tutoring will be connected in Phase 5.", false, {
    requestId: context.requestId,
  }), "feature_not_ready");
}
