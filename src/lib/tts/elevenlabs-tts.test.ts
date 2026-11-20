import { describe, expect, it, vi } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import {
  buildNarrationText,
  synthesizeElevenLabsNarration,
} from "./elevenlabs-tts";

const env = {
  TTS_PROVIDER: "elevenlabs" as const,
  GOOGLE_TTS_VOICE: "en-US-Neural2-F",
  ELEVENLABS_API_KEY: "test-api-key",
  ELEVENLABS_VOICE_ID: "test-voice-id",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  PROVIDER_TIMEOUT_MS: 30_000,
};

function alignedResponse(text: string) {
  const characters = [...text];
  const starts = characters.map((_, index) => index * 0.05);
  return {
    audio_base64: "AQID",
    alignment: {
      characters,
      character_start_times_seconds: starts,
      character_end_times_seconds: starts.map((start) => start + 0.05),
    },
  };
}

describe("ElevenLabs TTS narration", () => {
  it("builds one ordered narration passage and records each cue offset", () => {
    const lesson = createValidLesson();
    const cues = lesson.segments.flatMap((segment) => segment.cues);
    const narration = buildNarrationText(lesson);

    expect(narration.text).toBe(cues.map((cue) => cue.narration).join("\n\n"));
    expect(narration.cueOffsets[0]).toEqual({ cueId: cues[0].id, characterOffset: 0 });
    for (let index = 1; index < narration.cueOffsets.length; index += 1) {
      expect(narration.cueOffsets[index].characterOffset).toBeGreaterThan(
        narration.cueOffsets[index - 1].characterOffset,
      );
    }
  });

  it("returns MP3 audio and maps character alignment to exact cue timings", async () => {
    const lesson = createValidLesson();
    const narration = buildNarrationText(lesson);
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return Response.json(alignedResponse(narration.text));
      },
    );

    const result = await synthesizeElevenLabsNarration(lesson, { env, fetcher });

    expect(result.audioBase64).toBe("AQID");
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.cueTimings).toEqual(
      narration.cueOffsets.map(({ cueId, characterOffset }) => ({
        cueId,
        startSeconds: characterOffset * 0.05,
      })),
    );
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toContain("/test-voice-id/with-timestamps");
    expect(request?.headers).toMatchObject({ "xi-api-key": "test-api-key" });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      text: narration.text,
      model_id: "eleven_flash_v2_5",
    });
  });

  it("rejects missing configuration and incomplete alignment", async () => {
    const lesson = createValidLesson();
    await expect(
      synthesizeElevenLabsNarration(lesson, {
        env: { ...env, ELEVENLABS_API_KEY: undefined },
        fetcher: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "configuration" });

    await expect(
      synthesizeElevenLabsNarration(lesson, {
        env,
        fetcher: vi.fn(async () => Response.json({
          audio_base64: "AQID",
          alignment: {
            characters: ["x"],
            character_start_times_seconds: [0],
            character_end_times_seconds: [0.1],
          },
        })),
      }),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it.each([
    [401, "configuration"],
    [429, "rate-limit"],
    [504, "timeout"],
    [500, "provider"],
  ] as const)("maps provider status %s to %s", async (status, code) => {
    await expect(
      synthesizeElevenLabsNarration(createValidLesson(), {
        env,
        fetcher: vi.fn(async () => new Response(null, { status })),
      }),
    ).rejects.toMatchObject({ code });
  });

  it("preserves ElevenLabs quota exhaustion as a distinct error", async () => {
    await expect(
      synthesizeElevenLabsNarration(createValidLesson(), {
        env,
        fetcher: vi.fn(async () => Response.json({
          detail: {
            type: "invalid_request",
            code: "quota_exceeded",
            message: "This request exceeds your quota.",
          },
        }, { status: 401 })),
      }),
    ).rejects.toMatchObject({ code: "quota" });
  });
});
