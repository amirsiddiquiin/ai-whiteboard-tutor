import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateFollowUpAnswer } = vi.hoisted(() => ({ generateFollowUpAnswer: vi.fn() }));

vi.mock("@/lib/ai/follow-up", () => ({
  FollowUpError: class FollowUpError extends Error {
    constructor(readonly code: string, message: string) { super(message); }
  },
  generateFollowUpAnswer,
}));

import { POST } from "./route";

function request(body: string, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
    body,
  });
}

const validChat = {
  lessonId: "lesson-1",
  topic: "Binary search",
  learningObjective: "Explain why binary search halves a sorted search space.",
  messages: [{ role: "user", content: "Why must the array be sorted?" }],
};

describe("POST /api/chat boundary", () => {
  beforeEach(() => generateFollowUpAnswer.mockReset());

  it("returns a contextual Gemini follow-up answer", async () => {
    generateFollowUpAnswer.mockResolvedValue("Sorting lets us discard an entire half safely.");
    const response = await POST(request(JSON.stringify(validChat)));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Sorting lets us discard an entire half safely." });
    expect(generateFollowUpAnswer).toHaveBeenCalledWith(expect.objectContaining({ topic: "Binary search" }), expect.any(AbortSignal));
    expect(response.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects malformed and oversized requests", async () => {
    const malformed = await POST(request("{not-json"));
    expect(malformed.status).toBe(400);

    const oversized = await POST(request(JSON.stringify(validChat), { "content-length": "40000" }));
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
  });
});
