import { describe, expect, it } from "vitest";

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
  it("keeps Phase 5 disabled behind a validated request", async () => {
    const response = await POST(request(JSON.stringify(validChat)));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FEATURE_NOT_READY" } });
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
