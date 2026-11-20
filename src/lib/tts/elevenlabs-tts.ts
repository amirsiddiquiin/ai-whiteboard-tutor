import "server-only";

import { z } from "zod";

import type { GeneratedLesson } from "@/features/lesson/schema";
import type { CueTiming, NarrationResponse } from "@/features/narration/schema";
import { getSpeechEnv, type SpeechEnv } from "@/lib/env/server";
import { CircuitBreaker } from "@/lib/resilience/circuit-breaker";
import { NarrationGenerationError } from "@/lib/tts/errors";

const elevenLabsCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, resetAfterMs: 30_000 });

const alignmentSchema = z.object({
  characters: z.array(z.string()),
  character_start_times_seconds: z.array(z.number().nonnegative()),
  character_end_times_seconds: z.array(z.number().nonnegative()),
}).strict();

const elevenLabsResponseSchema = z.object({
  audio_base64: z.string().min(1),
  alignment: alignmentSchema.nullable().optional(),
  normalized_alignment: alignmentSchema.nullable().optional(),
}).passthrough();

class ElevenLabsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly providerCode?: string,
  ) {
    super("ElevenLabs request failed.");
    this.name = "ElevenLabsHttpError";
  }
}

interface ElevenLabsRequestOptions {
  env?: SpeechEnv;
  fetcher?: typeof fetch;
}

interface NarrationText {
  text: string;
  cueOffsets: Array<{ cueId: string; characterOffset: number }>;
}

export function buildNarrationText(lesson: GeneratedLesson): NarrationText {
  const cueOffsets: NarrationText["cueOffsets"] = [];
  let text = "";

  for (const cue of lesson.segments.flatMap((segment) => segment.cues)) {
    if (text) text += "\n\n";
    cueOffsets.push({ cueId: cue.id, characterOffset: text.length });
    text += cue.narration;
  }

  return { text, cueOffsets };
}

function validateAlignment(
  narration: NarrationText,
  response: z.infer<typeof elevenLabsResponseSchema>,
): CueTiming[] {
  const alignment = response.alignment;
  if (
    !alignment ||
    alignment.characters.length !== narration.text.length ||
    alignment.character_start_times_seconds.length !== narration.text.length ||
    alignment.character_end_times_seconds.length !== narration.text.length ||
    alignment.characters.join("") !== narration.text
  ) {
    throw new NarrationGenerationError(
      "invalid-response",
      "ElevenLabs returned invalid cue alignment.",
    );
  }

  const timings = narration.cueOffsets.map(({ cueId, characterOffset }) => ({
    cueId,
    startSeconds: alignment.character_start_times_seconds[characterOffset],
  }));

  if (
    timings.some((timing) => timing.startSeconds === undefined) ||
    timings.some(
      (timing, index) => index > 0 && timing.startSeconds <= timings[index - 1].startSeconds,
    )
  ) {
    throw new NarrationGenerationError(
      "invalid-response",
      "ElevenLabs returned incomplete or unordered cue timings.",
    );
  }

  return timings as CueTiming[];
}

function mapProviderError(error: unknown) {
  if (error instanceof NarrationGenerationError) return error;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new NarrationGenerationError("timeout", "ElevenLabs TTS timed out.", { cause: error });
  }
  return new NarrationGenerationError("provider", "ElevenLabs TTS synthesis failed.", {
    cause: error,
  });
}

function responseError(status: number, providerCode?: string) {
  if (providerCode === "quota_exceeded") {
    return new NarrationGenerationError("quota", "ElevenLabs TTS quota was reached.");
  }
  if (status === 401 || status === 403) {
    return new NarrationGenerationError("configuration", "ElevenLabs TTS is not configured.");
  }
  if (status === 408 || status === 504) {
    return new NarrationGenerationError("timeout", "ElevenLabs TTS timed out.");
  }
  if (status === 429) {
    return new NarrationGenerationError("rate-limit", "ElevenLabs TTS quota was reached.");
  }
  return new NarrationGenerationError("provider", "ElevenLabs TTS synthesis failed.");
}

function transientFetchFailure(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  return error instanceof ElevenLabsHttpError && (error.status === 429 || error.status >= 500);
}

export async function synthesizeElevenLabsNarration(
  lesson: GeneratedLesson,
  options: ElevenLabsRequestOptions = {},
): Promise<NarrationResponse> {
  let env: SpeechEnv;
  try {
    env = options.env ?? getSpeechEnv();
  } catch (error) {
    throw new NarrationGenerationError("configuration", "ElevenLabs TTS is not configured.", {
      cause: error,
    });
  }

  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new NarrationGenerationError("configuration", "ElevenLabs TTS is not configured.");
  }

  const narration = buildNarrationText(lesson);
  let response: Response;
  try {
    const request = async () => {
      const providerResponse = await (options.fetcher ?? fetch)(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: narration.text,
          model_id: env.ELEVENLABS_MODEL_ID,
        }),
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      },
      );
      if (!providerResponse.ok) {
        let providerCode: string | undefined;
        try {
          const body: unknown = await providerResponse.json();
          if (typeof body === "object" && body !== null && "detail" in body) {
            const detail = (body as { detail?: unknown }).detail;
            if (typeof detail === "object" && detail !== null && "code" in detail) {
              const code = (detail as { code?: unknown }).code;
              if (typeof code === "string") providerCode = code;
            }
          }
        } catch {
          // Status-based mapping remains the fallback for non-JSON provider errors.
        }
        throw new ElevenLabsHttpError(providerResponse.status, providerCode);
      }
      return providerResponse;
    };
    response = options.fetcher
      ? await request()
      : await elevenLabsCircuitBreaker.execute(request, transientFetchFailure);
  } catch (error) {
    if (error instanceof ElevenLabsHttpError) {
      throw responseError(error.status, error.providerCode);
    }
    throw mapProviderError(error);
  }

  let providerResponse: z.infer<typeof elevenLabsResponseSchema>;
  try {
    providerResponse = elevenLabsResponseSchema.parse(await response.json());
  } catch (error) {
    throw new NarrationGenerationError(
      "invalid-response",
      "ElevenLabs returned invalid narration data.",
      { cause: error },
    );
  }

  return {
    audioBase64: providerResponse.audio_base64,
    mimeType: "audio/mpeg",
    cueTimings: validateAlignment(narration, providerResponse),
  };
}
