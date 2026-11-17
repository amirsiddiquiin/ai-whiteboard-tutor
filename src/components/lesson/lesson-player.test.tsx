import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLessonStore } from "@/features/lesson/store";
import { createValidLesson } from "@/tests/fixtures/lesson";

const lesson = createValidLesson();
const cues = lesson.segments.flatMap((segment) => segment.cues);

vi.mock("@/features/narration/client", () => ({
  useNarrationAudio: () => ({
    status: "ready",
    audioUrl: "blob:narration",
    cueTimings: cues.map((cue, index) => ({ cueId: cue.id, startSeconds: index * 16 })),
    error: null,
    retry: vi.fn(),
  }),
}));

import { LessonPlayer } from "./lesson-player";

describe("LessonPlayer audio synchronization", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    useLessonStore.setState({
      activeRequestId: null,
      error: null,
      lesson,
      status: "success",
    });
  });

  it("uses media time for play, seek, pause, restart, and replay", async () => {
    const { container } = render(<LessonPlayer />);
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    Object.defineProperty(audio, "duration", { configurable: true, value: 101 });
    fireEvent.loadedMetadata(audio as HTMLAudioElement);

    const slider = screen.getByRole("slider", { name: "Seek through lesson" });
    await waitFor(() => expect(slider).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Play lesson" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.play(audio as HTMLAudioElement);
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 34 });
    fireEvent.timeUpdate(audio as HTMLAudioElement);
    expect(slider).toHaveValue("34");
    expect(screen.getByText("Cue 3 of 6")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "70" } });
    expect((audio as HTMLAudioElement).currentTime).toBe(70);
    fireEvent.click(screen.getByRole("button", { name: "Pause lesson" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect((audio as HTMLAudioElement).currentTime).toBe(0);
    fireEvent.ended(audio as HTMLAudioElement);
    fireEvent.click(screen.getByRole("button", { name: "Replay lesson" }));
    expect((audio as HTMLAudioElement).currentTime).toBe(0);
  });
});
