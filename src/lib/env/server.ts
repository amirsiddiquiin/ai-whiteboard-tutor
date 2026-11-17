import "server-only";

import { z } from "zod";

const geminiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(30_000),
});

const speechEnvSchema = z.object({
  TTS_PROVIDER: z.enum(["google", "elevenlabs"]).default("google"),
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1).optional(),
  GOOGLE_CLOUD_CREDENTIALS_JSON: z.string().min(1).optional(),
  GOOGLE_TTS_VOICE: z.string().min(1).default("en-US-Neural2-F"),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_VOICE_ID: z.string().min(1).optional(),
  ELEVENLABS_MODEL_ID: z.string().min(1).default("eleven_flash_v2_5"),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(30_000),
}).superRefine((env, context) => {
  const required = env.TTS_PROVIDER === "google"
    ? ["GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_CREDENTIALS_JSON"] as const
    : ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
  for (const key of required) {
    if (!env[key]) {
      context.addIssue({ code: "custom", path: [key], message: `${key} is required` });
    }
  }
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
