import { describe, expect, it, vi } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import {
  buildLessonSsml,
  escapeSsml,
  synthesizeLessonNarration,
} from "./google-tts";
import { NarrationGenerationError } from "./errors";

interface TestSynthesisRequest {
  input?: { ssml?: string | null } | null;
  voice?: { languageCode?: string | null; name?: string | null } | null;
  enableTimePointing?: unknown[] | null;
}

const env = {
  TTS_PROVIDER: "google" as const,
  GOOGLE_CLOUD_PROJECT_ID: "test-project",
  GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({
    client_email: "tts@test-project.iam.gserviceaccount.com",
    private_key: "test-private-key",
  }),
  GOOGLE_TTS_VOICE: "en-US-Neural2-F",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  PROVIDER_TIMEOUT_MS: 30_000,
};

describe("Google TTS narration", () => {
  it("escapes SSML and inserts ordered marks before every cue", () => {
    expect(escapeSsml(`A & B < C > D "quoted" 'single'`)).toBe(
      "A &amp; B &lt; C &gt; D &quot;quoted&quot; &apos;single&apos;",
    );
    const lesson = createValidLesson();
    lesson.segments[0].cues[0].narration = "Use A & B < C safely.";
    const ssml = buildLessonSsml(lesson);
    const cueIds = lesson.segments.flatMap((segment) => segment.cues.map((cue) => cue.id));
    expect(ssml).toContain("Use A &amp; B &lt; C safely.");
    for (const cueId of cueIds) expect(ssml).toContain(`<mark name="${cueId}"/>`);
    for (let index = 1; index < cueIds.length; index += 1) {
      expect(ssml.indexOf(cueIds[index])).toBeGreaterThan(ssml.indexOf(cueIds[index - 1]));
    }
  });

  it("requests MP3 audio with SSML marks and returns measured cue timings", async () => {
    const lesson = createValidLesson();
    const cues = lesson.segments.flatMap((segment) => segment.cues);
    const synthesize = vi.fn(async (request: TestSynthesisRequest) => {
      void request;
      return {
        audioContent: Uint8Array.from([1, 2, 3]),
        timepoints: cues.map((cue, index) => ({ markName: cue.id, timeSeconds: index * 14.5 })),
      };
    });

    const result = await synthesizeLessonNarration(lesson, { env, synthesize });
    expect(result).toEqual({
      audioBase64: "AQID",
      mimeType: "audio/mpeg",
      cueTimings: cues.map((cue, index) => ({ cueId: cue.id, startSeconds: index * 14.5 })),
    });
    const request = synthesize.mock.calls[0][0];
    expect(request.input?.ssml).toContain(`<mark name="${cues[0].id}"/>`);
    expect(request.voice).toMatchObject({ languageCode: "en-US", name: "en-US-Neural2-F" });
    expect(request.enableTimePointing).toHaveLength(1);
  });

  it("rejects invalid credentials and incomplete provider timepoints", async () => {
    const lesson = createValidLesson();
    await expect(synthesizeLessonNarration(lesson, {
      env: { ...env, GOOGLE_CLOUD_CREDENTIALS_JSON: "{}" },
      synthesize: vi.fn(),
    })).rejects.toMatchObject({ code: "configuration" });

    await expect(synthesizeLessonNarration(lesson, {
      env,
      synthesize: vi.fn(async () => ({ audioContent: Uint8Array.from([1]), timepoints: [] })),
    })).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("maps provider quota failures without exposing provider details", async () => {
    await expect(synthesizeLessonNarration(createValidLesson(), {
      env,
      synthesize: vi.fn(async () => {
        throw Object.assign(new Error("sensitive provider detail"), { code: 8 });
      }),
    })).rejects.toMatchObject({
      code: "rate-limit",
      message: "Google TTS quota was reached.",
    } satisfies Partial<NarrationGenerationError>);
  });
});
