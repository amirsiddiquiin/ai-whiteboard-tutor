import { beforeEach, describe, expect, it, vi } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import { handleNarrationRequest } from "./handler";

const synthesizeLessonNarrationMock = vi.fn();

function request(body: unknown) {
  return new Request("http://localhost/api/narration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/narration", () => {
  beforeEach(() => synthesizeLessonNarrationMock.mockReset());

  it("rejects invalid lessons", async () => {
    const response = await handleNarrationRequest(
      request({ lesson: { title: "Incomplete" } }),
      synthesizeLessonNarrationMock,
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toMatchObject({ error: { code: "INVALID_LESSON" } });
    expect(response.headers.get("X-Request-ID")).toBe(data.error.requestId);
  });

  it("rejects oversized lesson documents before synthesis", async () => {
    const oversized = request({ lesson: createValidLesson() });
    oversized.headers.set("content-length", "200000");
    const response = await handleNarrationRequest(oversized, synthesizeLessonNarrationMock);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
    expect(synthesizeLessonNarrationMock).not.toHaveBeenCalled();
  });

  it("returns validated narration without caching", async () => {
    synthesizeLessonNarrationMock.mockResolvedValue({
      audioBase64: "AQID",
      mimeType: "audio/mpeg",
      cueTimings: [{ cueId: "cue-overview", startSeconds: 0 }],
    });
    const response = await handleNarrationRequest(
      request({ lesson: createValidLesson() }),
      synthesizeLessonNarrationMock,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toMatchObject({ audioBase64: "AQID" });
  });

  it.each([
    ["configuration", 503, "CONFIGURATION_ERROR"],
    ["invalid-response", 502, "TTS_PROVIDER_ERROR"],
    ["quota", 429, "RATE_LIMITED"],
    ["rate-limit", 429, "RATE_LIMITED"],
    ["timeout", 504, "PROVIDER_TIMEOUT"],
    ["provider", 502, "TTS_PROVIDER_ERROR"],
  ] as const)("maps %s failures", async (code, status, apiCode) => {
    const response = await handleNarrationRequest(
      request({ lesson: createValidLesson() }),
      async () => {
        throw { code };
      },
    );
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code: apiCode } });
  });
});
