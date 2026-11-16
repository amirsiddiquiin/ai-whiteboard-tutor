import { chatRequestSchema } from "@/features/chat/schema";
import { apiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  if (!chatRequestSchema.safeParse(body).success) {
    return apiError(400, "INVALID_REQUEST", "The chat request is incomplete or too long.");
  }

  return apiError(503, "FEATURE_NOT_READY", "Follow-up tutoring will be connected in Phase 5.");
}
