import "server-only";

import { ApiError } from "@google/genai";

import type { GeneratedLesson } from "@/features/lesson/schema";
import {
  InvalidGeneratedLessonError,
  parseAndHydrateLesson,
} from "@/features/lesson/validation";
import { getGeminiEnv, type GeminiEnv } from "@/lib/env/server";

import {
  requestGeminiLesson,
  type LessonModelRequester,
} from "./gemini-lesson-client";

export type LessonGenerationErrorCode =
  | "configuration"
  | "invalid-response"
  | "rate-limit"
  | "timeout"
  | "provider";

export class LessonGenerationError extends Error {
  constructor(
    readonly code: LessonGenerationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LessonGenerationError";
  }
}

interface GenerateLessonOptions {
  env?: GeminiEnv;
  requester?: LessonModelRequester;
  signal?: AbortSignal;
}

function mapProviderError(error: unknown): LessonGenerationError {
  if (error instanceof LessonGenerationError) return error;

  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    status === 408 ||
    status === 504 ||
    (error instanceof Error && /timeout|timed out/i.test(`${error.name} ${error.message}`))
  ) {
    return new LessonGenerationError("timeout", "Gemini did not respond before the timeout.", {
      cause: error,
    });
  }

  if ((error instanceof ApiError && error.status === 429) || status === 429) {
    return new LessonGenerationError("rate-limit", "Gemini rate limit reached.", { cause: error });
  }

  return new LessonGenerationError("provider", "Gemini lesson generation failed.", { cause: error });
}

export async function generateLesson(
  topic: string,
  options: GenerateLessonOptions = {},
): Promise<GeneratedLesson> {
  let env: GeminiEnv;
  try {
    env = options.env ?? getGeminiEnv();
  } catch (error) {
    throw new LessonGenerationError("configuration", "Gemini is not configured.", { cause: error });
  }

  const requester = options.requester ?? requestGeminiLesson;
  let raw: string;
  try {
    raw = await requester({ topic, env, signal: options.signal });
  } catch (error) {
    throw mapProviderError(error);
  }

  try {
    return parseAndHydrateLesson(raw, topic);
  } catch (error) {
    if (!(error instanceof InvalidGeneratedLessonError)) throw error;

    try {
      const repaired = await requester({
        topic,
        env,
        signal: options.signal,
        repairIssues: error.issues.slice(0, 8),
      });
      return parseAndHydrateLesson(repaired, topic);
    } catch (repairError) {
      if (!(repairError instanceof InvalidGeneratedLessonError)) throw mapProviderError(repairError);
      throw new LessonGenerationError(
        "invalid-response",
        "Gemini returned an invalid lesson after one repair attempt.",
        { cause: repairError },
      );
    }
  }
}
