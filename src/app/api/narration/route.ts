import { handleNarrationRequest } from "./handler";
import { apiError } from "@/lib/api/errors";
import { createApiRequestContext, observedResponse } from "@/lib/api/observability";
import { InMemoryRateLimiter } from "@/lib/api/rate-limit";
import { requestClientKey } from "@/lib/api/request";

export const maxDuration = 60;
const narrationRateLimiter = new InMemoryRateLimiter({ limit: 12, windowMs: 60_000 });

export async function POST(request: Request) {
  const context = createApiRequestContext("/api/narration");
  const rateLimit = narrationRateLimiter.consume(requestClientKey(request));
  if (!rateLimit.allowed) {
    return observedResponse(context, apiError(429, "RATE_LIMITED", "Too many narration requests. Try again shortly.", true, {
      requestId: context.requestId,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    }), "rate_limited");
  }

  const response = await handleNarrationRequest(request, undefined, context.requestId);
  const outcome = response.ok ? "success" : response.status === 413 ? "payload_too_large" : "request_failed";
  return observedResponse(context, response, outcome);
}
