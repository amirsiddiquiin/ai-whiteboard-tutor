export type RequestBodyErrorCode = "invalid-json" | "payload-too-large";

export class RequestBodyError extends Error {
  constructor(readonly code: RequestBodyErrorCode) {
    super(code === "payload-too-large" ? "Request body is too large." : "Request body is invalid.");
    this.name = "RequestBodyError";
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("payload-too-large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new RequestBodyError("payload-too-large");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestBodyError("invalid-json");
  }
}

export function requestClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "anonymous";
  return address.slice(0, 200);
}
