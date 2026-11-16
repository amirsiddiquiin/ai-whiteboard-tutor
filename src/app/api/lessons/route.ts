import { createLessonRequestSchema } from "@/features/lesson/schema";
import { generateLesson, LessonGenerationError } from "@/lib/ai/generate-lesson";
import { apiError } from "@/lib/api/errors";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  const parsed = createLessonRequestSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, "INVALID_TOPIC", "Enter a topic between 2 and 160 characters.");
  }

  try {
    const lesson = await generateLesson(parsed.data.topic, { signal: request.signal });
    return Response.json(
      { lesson },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof LessonGenerationError)) {
      return apiError(502, "AI_PROVIDER_ERROR", "The lesson could not be generated. Please retry.", true);
    }

    switch (error.code) {
      case "configuration":
        return apiError(503, "CONFIGURATION_ERROR", "Lesson generation is not configured.");
      case "invalid-response":
        return apiError(422, "INVALID_LESSON", "The generated lesson was invalid. Please retry.", true);
      case "rate-limit":
        return apiError(429, "RATE_LIMITED", "Lesson generation is busy. Try again shortly.", true);
      case "timeout":
        return apiError(504, "PROVIDER_TIMEOUT", "Lesson generation took too long. Please retry.", true);
      case "provider":
        return apiError(502, "AI_PROVIDER_ERROR", "The lesson could not be generated. Please retry.", true);
    }
  }
}
