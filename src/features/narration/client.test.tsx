import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import { base64AudioToObjectUrl, useNarrationAudio } from "./client";

const createObjectURL = vi.fn((blob: Blob) => {
  void blob;
  return "blob:narration";
});
const revokeObjectURL = vi.fn();

describe("narration client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("converts base64 audio into an object URL", () => {
    expect(base64AudioToObjectUrl("AQID", "audio/mpeg")).toBe("blob:narration");
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("audio/mpeg");
    expect(blob.size).toBe(3);
  });

  it("loads validated narration and revokes its object URL on cleanup", async () => {
    const lesson = createValidLesson();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      audioBase64: "AQID",
      mimeType: "audio/mpeg",
      cueTimings: [{ cueId: "cue-overview", startSeconds: 0 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const { result, unmount } = renderHook(() => useNarrationAudio(lesson));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.audioUrl).toBe("blob:narration");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:narration");
  });

  it("deduplicates the development Strict Mode narration request", async () => {
    const lesson = createValidLesson();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      audioBase64: "AQID",
      mimeType: "audio/mpeg",
      cueTimings: [{ cueId: "cue-overview", startSeconds: 0 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(() => useNarrationAudio(lesson), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("shows provider errors and retries", async () => {
    const lesson = createValidLesson();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Narration is not configured." } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audioBase64: "AQID",
        mimeType: "audio/mpeg",
        cueTimings: [{ cueId: "cue-overview", startSeconds: 0 }],
      }), { status: 200 }));

    const { result } = renderHook(() => useNarrationAudio(lesson));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Narration is not configured.");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
