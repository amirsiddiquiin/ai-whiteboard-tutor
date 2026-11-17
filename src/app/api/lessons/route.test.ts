import { beforeEach, describe, expect, it, vi } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

const generateLessonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/generate-lesson", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/generate-lesson")>();
  return { ...original, generateLesson: generateLessonMock };
});

import { LessonGenerationError } from "@/lib/ai/generate-lesson";

import { POST } from "./route";

function lessonRequest(body: unknown) {
  return new Request("http://localhost/api/lessons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/lessons", () => {
  beforeEach(() => {
    generateLessonMock.mockReset();
  });

  it("rejects an empty topic", async () => {
    const response = await POST(lessonRequest({ topic: "" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toMatchObject({ error: { code: "INVALID_TOPIC" } });
    expect(response.headers.get("X-Request-ID")).toBe(data.error.requestId);
  });

  it("rejects oversized requests before calling Gemini", async () => {
    const request = lessonRequest({ topic: "Binary search" });
    request.headers.set("content-length", "5000");
    const response = await POST(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
    expect(generateLessonMock).not.toHaveBeenCalled();
  });

  it("rejects an excessively long topic", async () => {
    const response = await POST(lessonRequest({ topic: "x".repeat(161) }));
    expect(response.status).toBe(400);
    expect(generateLessonMock).not.toHaveBeenCalled();
  });

  it("returns a real provider result through the validated contract", async () => {
    generateLessonMock.mockResolvedValue(createValidLesson("Binary search"));
    const response = await POST(lessonRequest({ topic: "  Binary search  " }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    await expect(response.json()).resolves.toMatchObject({
      lesson: { topic: "Binary search", metadata: { timing: "estimated" } },
    });
    expect(generateLessonMock).toHaveBeenCalledWith("Binary search", expect.any(Object));
  });

  it.each([
    ["provider", 502, "AI_PROVIDER_ERROR"],
    ["timeout", 504, "PROVIDER_TIMEOUT"],
    ["rate-limit", 429, "RATE_LIMITED"],
    ["invalid-response", 422, "INVALID_LESSON"],
    ["configuration", 503, "CONFIGURATION_ERROR"],
  ] as const)("maps %s failures", async (failure, status, code) => {
    generateLessonMock.mockRejectedValue(new LessonGenerationError(failure, "internal detail"));
    const response = await POST(lessonRequest({ topic: "Binary search" }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });
});
