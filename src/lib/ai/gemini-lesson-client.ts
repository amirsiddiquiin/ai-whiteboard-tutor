import "server-only";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import { generatedLessonContentSchema } from "@/features/lesson/schema";
import type { GeminiEnv } from "@/lib/env/server";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";

import { toGeminiCompatibleSchema } from "./gemini-schema";
import { createLessonPrompt, LESSON_SYSTEM_PROMPT } from "./lesson-prompt";

const responseJsonSchema = toGeminiCompatibleSchema(z.toJSONSchema(generatedLessonContentSchema));
const geminiCircuitBreaker = new CircuitBreaker({ failureThreshold: 4, resetAfterMs: 30_000 });

export interface LessonModelRequest {
  topic: string;
  env: GeminiEnv;
  signal?: AbortSignal;
  repairIssues?: string[];
}

export type LessonModelRequester = (request: LessonModelRequest) => Promise<string>;

function providerStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

function transientProviderFailure(error: unknown) {
  const status = providerStatus(error);
  return status === 429 || (status !== undefined && status >= 500);
}

export const requestGeminiLesson: LessonModelRequester = async ({
  topic,
  env,
  signal,
  repairIssues,
}) => {
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, apiVersion: "v1beta" });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await geminiCircuitBreaker.execute(
        () => client.models.generateContent({
          model: env.GEMINI_MODEL,
          contents: createLessonPrompt(topic, repairIssues),
          config: {
            systemInstruction: LESSON_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseJsonSchema,
            maxOutputTokens: 4_096,
            temperature: repairIssues ? 0.15 : 0.35,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: signal,
            httpOptions: { timeout: env.PROVIDER_TIMEOUT_MS },
          },
        }),
        transientProviderFailure,
      );

      if (!response.text) throw new Error("Gemini returned an empty response.");
      return response.text;
    } catch (error) {
      console.error(JSON.stringify({
        event: "gemini_provider_failure",
        name: error instanceof Error ? error.name : "UnknownError",
        status: providerStatus(error) ?? "unknown",
      }));
      if (attempt < 2 && providerStatus(error) === 503) {
        await delay(750 * (attempt + 1), undefined, { signal });
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gemini lesson generation exhausted its retry policy.");
};
