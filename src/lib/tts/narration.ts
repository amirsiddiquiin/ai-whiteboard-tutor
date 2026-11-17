import "server-only";

import type { GeneratedLesson } from "@/features/lesson/schema";
import type { NarrationResponse } from "@/features/narration/schema";
import { getSpeechEnv } from "@/lib/env/server";
import { synthesizeElevenLabsNarration } from "@/lib/tts/elevenlabs-tts";
import { NarrationGenerationError } from "@/lib/tts/errors";
import { synthesizeLessonNarration as synthesizeGoogleNarration } from "@/lib/tts/google-tts";

export async function synthesizeLessonNarration(
  lesson: GeneratedLesson,
): Promise<NarrationResponse> {
  let env;
  try {
    env = getSpeechEnv();
  } catch (error) {
    throw new NarrationGenerationError("configuration", "Narration is not configured.", {
      cause: error,
    });
  }

  return env.TTS_PROVIDER === "elevenlabs"
    ? synthesizeElevenLabsNarration(lesson, { env })
    : synthesizeGoogleNarration(lesson, { env });
}
