import "server-only";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import { generatedLessonContentSchema } from "@/features/lesson/schema";
import type { GeminiEnv } from "@/lib/env/server";

import { toGeminiCompatibleSchema } from "./gemini-schema";
import { createLessonPrompt, LESSON_SYSTEM_PROMPT } from "./lesson-prompt";

const responseJsonSchema = toGeminiCompatibleSchema(z.toJSONSchema(generatedLessonContentSchema));

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

export const requestGeminiLesson: LessonModelRequester = async ({
  topic,
  env,
  signal,
  repairIssues,
}) => {
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, apiVersion: "v1beta" });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.models.generateContent({
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
      });

      if (!response.text) throw new Error("Gemini returned an empty response.");
      return response.text;
    } catch (error) {
      if (attempt === 0 && providerStatus(error) === 503) {
        await delay(750, undefined, { signal });
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gemini lesson generation exhausted its retry policy.");
};
