import { describe, expect, it, vi } from "vitest";

import { createValidLessonContent } from "@/tests/fixtures/lesson";

import { generateLesson, type LessonGenerationError } from "./generate-lesson";

const env = {
  GEMINI_API_KEY: "test-key",
  GEMINI_MODEL: "gemini-test",
  PROVIDER_TIMEOUT_MS: 5_000,
};

describe("generateLesson", () => {
  it("returns a validated lesson from the provider", async () => {
    const requester = vi.fn().mockResolvedValue(JSON.stringify(createValidLessonContent()));
    const lesson = await generateLesson("Binary search", { env, requester });
    expect(lesson.title).toBe("A Visual Guide to the Topic");
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("repairs one malformed response", async () => {
    const requester = vi.fn()
      .mockResolvedValueOnce("not json")
      .mockResolvedValueOnce(JSON.stringify(createValidLessonContent()));
    await expect(generateLesson("Binary search", { env, requester })).resolves.toMatchObject({ topic: "Binary search" });
    expect(requester.mock.calls[1][0].repairIssues).toContain("Response was not valid JSON.");
  });

  it("fails after the repair response is also invalid", async () => {
    const requester = vi.fn().mockResolvedValue("not json");
    await expect(generateLesson("Binary search", { env, requester })).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("maps Gemini failures without leaking provider details", async () => {
    const requester = vi.fn().mockRejectedValue(new Error("secret upstream failure"));
    await expect(generateLesson("Binary search", { env, requester })).rejects.toEqual(
      expect.objectContaining<Partial<LessonGenerationError>>({ code: "provider", message: "Gemini lesson generation failed." }),
    );
  });

  it("maps aborted or timed-out requests", async () => {
    const requester = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(generateLesson("Binary search", { env, requester })).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps provider rate limits", async () => {
    const requester = vi.fn().mockRejectedValue({ status: 429 });
    await expect(generateLesson("Binary search", { env, requester })).rejects.toMatchObject({ code: "rate-limit" });
  });
});
