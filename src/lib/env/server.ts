import "server-only";

import { z } from "zod";

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(30_000),
});

const speechEnvSchema = z.object({
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1),
  GOOGLE_CLOUD_CREDENTIALS_JSON: z.string().min(1),
  GOOGLE_TTS_VOICE: z.string().min(1).default("en-US-Neural2-F"),
});

export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
export type SpeechEnv = z.infer<typeof speechEnvSchema>;

function parseEnvironment<T>(schema: z.ZodType<T>, name: string): T {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`${name} environment is not configured: ${missing}`);
  }

  return result.data;
}

export function getGeminiEnv(): GeminiEnv {
  return parseEnvironment(geminiEnvSchema, "Gemini");
}

export function getSpeechEnv(): SpeechEnv {
  return parseEnvironment(speechEnvSchema, "Speech");
}
