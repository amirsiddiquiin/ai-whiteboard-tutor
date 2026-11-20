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
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
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
    expect(container.querySelector('[data-motion-phase="enter"]')).toBeInTheDocument();

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

  it("controls the real media element and progressive lesson workspace", async () => {
    const { container } = render(<LessonPlayer />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { configurable: true, value: 101 });
    Object.defineProperty(audio, "volume", { configurable: true, writable: true, value: 1 });
    Object.defineProperty(audio, "muted", { configurable: true, writable: true, value: false });
    Object.defineProperty(audio, "playbackRate", { configurable: true, writable: true, value: 1 });
    fireEvent.loadedMetadata(audio);
    await waitFor(() => expect(screen.getByRole("button", { name: "Mute narration" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Mute narration" }));
    expect(audio.muted).toBe(true);
    fireEvent.change(screen.getByRole("slider", { name: "Narration volume" }), { target: { value: "0.45" } });
    expect(audio.volume).toBe(0.45);
    fireEvent.change(screen.getByRole("combobox", { name: "Playback speed" }), { target: { value: "1.25" } });
    expect(audio.playbackRate).toBe(1.25);

    fireEvent.click(screen.getByRole("button", { name: "Show lesson notes" }));
    expect(screen.getByRole("complementary", { name: "Lesson notes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter theater mode" }));
    expect(screen.getByRole("button", { name: "Exit theater mode" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(Element.prototype.requestFullscreen).toHaveBeenCalledOnce();
  });
});
