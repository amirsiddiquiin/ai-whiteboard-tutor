import "server-only";

import { protos, v1beta1 } from "@google-cloud/text-to-speech";
import { z } from "zod";

import type { GeneratedLesson } from "@/features/lesson/schema";
import type { CueTiming, NarrationResponse } from "@/features/narration/schema";
import { getSpeechEnv, type SpeechEnv } from "@/lib/env/server";

type SynthesisRequest = protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechRequest;
type SynthesisResponse = protos.google.cloud.texttospeech.v1beta1.ISynthesizeSpeechResponse;

const credentialsSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
}).passthrough();

export type NarrationErrorCode =
  | "configuration"
  | "invalid-response"
  | "rate-limit"
  | "timeout"
  | "provider";

export class NarrationGenerationError extends Error {
  constructor(
    readonly code: NarrationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "NarrationGenerationError";
  }
}

interface SynthesizeNarrationOptions {
  env?: SpeechEnv;
  synthesize?: (request: SynthesisRequest) => Promise<SynthesisResponse>;
}

export function escapeSsml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildLessonSsml(lesson: GeneratedLesson) {
  const cues = lesson.segments.flatMap((segment) => segment.cues);
  const body = cues
    .map(
      (cue) =>
        `<mark name="${escapeSsml(cue.id)}"/>${escapeSsml(cue.narration)}<break time="250ms"/>`,
    )
    .join("");
  return `<speak>${body}</speak>`;
}

function parseCredentials(raw: string) {
  try {
    return credentialsSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new NarrationGenerationError(
      "configuration",
      "Google Cloud credentials are invalid.",
      { cause: error },
    );
  }
}

function providerStatus(error: unknown) {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error) {
    const code = Number((error as { code?: unknown }).code);
    if (Number.isFinite(code)) return code;
  }
  if ("status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isFinite(status)) return status;
  }
  return undefined;
}

function mapProviderError(error: unknown) {
  if (error instanceof NarrationGenerationError) return error;
  const status = providerStatus(error);
  const message = error instanceof Error ? `${error.name} ${error.message}` : "";
  if (status === 4 || status === 408 || status === 504 || /timeout|deadline/i.test(message)) {
    return new NarrationGenerationError("timeout", "Google TTS timed out.", { cause: error });
  }
  if (status === 8 || status === 429) {
    return new NarrationGenerationError("rate-limit", "Google TTS quota was reached.", {
      cause: error,
    });
  }
  return new NarrationGenerationError("provider", "Google TTS synthesis failed.", {
    cause: error,
  });
}

function audioToBase64(audioContent: SynthesisResponse["audioContent"]) {
  if (typeof audioContent === "string") return audioContent;
  if (audioContent instanceof Uint8Array) return Buffer.from(audioContent).toString("base64");
  throw new NarrationGenerationError("invalid-response", "Google TTS returned no audio data.");
}

function validateCueTimings(lesson: GeneratedLesson, response: SynthesisResponse): CueTiming[] {
  const expectedCueIds = lesson.segments.flatMap((segment) => segment.cues.map((cue) => cue.id));
  const returned = new Map(
    (response.timepoints ?? []).flatMap((timepoint) =>
      timepoint.markName && typeof timepoint.timeSeconds === "number"
        ? [[timepoint.markName, timepoint.timeSeconds] as const]
        : [],
    ),
  );
  const timings = expectedCueIds.map((cueId) => ({ cueId, startSeconds: returned.get(cueId) }));

  if (timings.some((timing) => timing.startSeconds === undefined)) {
    throw new NarrationGenerationError(
      "invalid-response",
      "Google TTS returned incomplete cue timings.",
    );
  }

  const normalized = timings as CueTiming[];
  if (
    normalized.some(
      (timing, index) =>
        index > 0 && timing.startSeconds <= normalized[index - 1].startSeconds,
    )
  ) {
    throw new NarrationGenerationError(
      "invalid-response",
      "Google TTS returned unordered cue timings.",
    );
  }
  return normalized;
}

function voiceLanguageCode(voiceName: string) {
  return voiceName.match(/^([a-z]{2,3}-[A-Z]{2})-/)?.[1] ?? "en-US";
}

export async function synthesizeLessonNarration(
  lesson: GeneratedLesson,
  options: SynthesizeNarrationOptions = {},
): Promise<NarrationResponse> {
  let env: SpeechEnv;
  try {
    env = options.env ?? getSpeechEnv();
  } catch (error) {
    throw new NarrationGenerationError("configuration", "Google TTS is not configured.", {
      cause: error,
    });
  }

  if (!env.GOOGLE_CLOUD_PROJECT_ID || !env.GOOGLE_CLOUD_CREDENTIALS_JSON) {
    throw new NarrationGenerationError("configuration", "Google TTS is not configured.");
  }

  const credentials = parseCredentials(env.GOOGLE_CLOUD_CREDENTIALS_JSON);
  const request: SynthesisRequest = {
    input: { ssml: buildLessonSsml(lesson) },
    voice: {
      languageCode: voiceLanguageCode(env.GOOGLE_TTS_VOICE),
      name: env.GOOGLE_TTS_VOICE,
    },
    audioConfig: {
      audioEncoding: protos.google.cloud.texttospeech.v1beta1.AudioEncoding.MP3,
      speakingRate: 1,
    },
    enableTimePointing: [
      protos.google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest.TimepointType.SSML_MARK,
    ],
  };

  let response: SynthesisResponse;
  let client: v1beta1.TextToSpeechClient | undefined;
  try {
    if (options.synthesize) {
      response = await options.synthesize(request);
    } else {
      client = new v1beta1.TextToSpeechClient({
        projectId: env.GOOGLE_CLOUD_PROJECT_ID,
        credentials,
      });
      const [providerResponse] = await client.synthesizeSpeech(request);
      response = providerResponse;
    }
  } catch (error) {
    throw mapProviderError(error);
  } finally {
    await client?.close();
  }

  return {
    audioBase64: audioToBase64(response.audioContent),
    mimeType: "audio/mpeg",
    cueTimings: validateCueTimings(lesson, response),
  };
}
