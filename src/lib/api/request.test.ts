import { describe, expect, it } from "vitest";

import { readJsonBody, requestClientKey } from "./request";

describe("API request boundaries", () => {
  it("parses JSON within the configured byte limit", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ topic: "binary search" }),
    });
    await expect(readJsonBody(request, 100)).resolves.toEqual({ topic: "binary search" });
  });

  it("fails fast on declared and measured oversized bodies", async () => {
    const declared = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-length": "500" },
      body: "{}",
    });
    await expect(readJsonBody(declared, 100)).rejects.toMatchObject({ code: "payload-too-large" });

    const measured = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(200) }),
    });
    await expect(readJsonBody(measured, 100)).rejects.toMatchObject({ code: "payload-too-large" });
  });

  it("rejects malformed JSON and normalizes the proxy client key", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
      body: "{not-json",
    });
    expect(requestClientKey(request)).toBe("203.0.113.5");
    await expect(readJsonBody(request, 100)).rejects.toMatchObject({ code: "invalid-json" });
  });
});
