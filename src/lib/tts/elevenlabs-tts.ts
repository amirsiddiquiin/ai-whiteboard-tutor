import "server-only";

import { z } from "zod";

import type { GeneratedLesson } from "@/features/lesson/schema";
import type { CueTiming, NarrationResponse } from "@/features/narration/schema";
import { getSpeechEnv, type SpeechEnv } from "@/lib/env/server";
import { NarrationGenerationError } from "@/lib/tts/google-tts";

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

function responseError(status: number) {
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

  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
    throw new NarrationGenerationError("configuration", "ElevenLabs TTS is not configured.");
  }

  const narration = buildNarrationText(lesson);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: narration.text,
          model_id: env.ELEVENLABS_MODEL_ID,
        }),
        signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
      },
    );
  } catch (error) {
    throw mapProviderError(error);
  }

  if (!response.ok) throw responseError(response.status);

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
