export interface ApiRequestContext {
  requestId: string;
  route: string;
  startedAt: number;
}

export function createApiRequestContext(route: string): ApiRequestContext {
  return { requestId: crypto.randomUUID(), route, startedAt: performance.now() };
}

export function observedResponse(
  context: ApiRequestContext,
  response: Response,
  outcome: string,
) {
  response.headers.set("X-Request-ID", context.requestId);
  if (process.env.NODE_ENV !== "test") {
    console.info(JSON.stringify({
      event: "api_request",
      requestId: context.requestId,
      route: context.route,
      status: response.status,
      outcome,
      durationMs: Math.round(performance.now() - context.startedAt),
    }));
  }
  return response;
}
