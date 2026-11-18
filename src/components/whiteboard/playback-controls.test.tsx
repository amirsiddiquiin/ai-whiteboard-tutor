import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlaybackControls } from "./playback-controls";

afterEach(cleanup);

function renderControls(status: "idle" | "playing" | "paused" | "ended" = "idle") {
  const handlers = {
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onPlaybackRateChange: vi.fn(),
    onReplay: vi.fn(),
    onRestart: vi.fn(),
    onSeek: vi.fn(),
    onSeekBy: vi.fn(),
    onToggleFullscreen: vi.fn(),
    onToggleMute: vi.fn(),
    onToggleNotes: vi.fn(),
    onToggleTheater: vi.fn(),
    onVolumeChange: vi.fn(),
  };
  render(
    <PlaybackControls
      bufferedUntil={70}
      chapters={[{ id: "intro", label: "Introduction", startSeconds: 0 }, { id: "result", label: "Result", startSeconds: 60 }]}
      currentTime={status === "ended" ? 90 : 25}
      duration={90}
      isFullscreen={false}
      isMuted={false}
      isTheater={false}
      notesOpen={false}
      playbackRate={1}
      status={status}
      volume={0.8}
      {...handlers}
    />,
  );
  return handlers;
}

describe("PlaybackControls", () => {
  it("wires play, pause, restart, replay, and seeking", () => {
    let handlers = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Play lesson" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    fireEvent.click(screen.getByRole("button", { name: "Back 10 seconds" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward 10 seconds" }));
    fireEvent.change(screen.getByRole("slider", { name: "Seek through lesson" }), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Jump to chapter: Result" }));

    expect(handlers.onPlay).toHaveBeenCalledOnce();
    expect(handlers.onRestart).toHaveBeenCalledOnce();
    expect(handlers.onSeekBy).toHaveBeenNthCalledWith(1, -10);
    expect(handlers.onSeekBy).toHaveBeenNthCalledWith(2, 10);
    expect(handlers.onSeek).toHaveBeenCalledWith(42);
    expect(handlers.onSeek).toHaveBeenCalledWith(60);

    cleanup();
    handlers = renderControls("playing");
    fireEvent.click(screen.getByRole("button", { name: "Pause lesson" }));
    expect(handlers.onPause).toHaveBeenCalledOnce();

    cleanup();
    handlers = renderControls("ended");
    fireEvent.click(screen.getByRole("button", { name: "Replay lesson" }));
    expect(handlers.onReplay).toHaveBeenCalledOnce();
  });

  it("wires media, workspace, and viewing controls", () => {
    const handlers = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Mute narration" }));
    fireEvent.change(screen.getByRole("slider", { name: "Narration volume" }), { target: { value: "0.4" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Playback speed" }), { target: { value: "1.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Show lesson notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter theater mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));

    expect(handlers.onToggleMute).toHaveBeenCalledOnce();
    expect(handlers.onVolumeChange).toHaveBeenCalledWith(0.4);
    expect(handlers.onPlaybackRateChange).toHaveBeenCalledWith(1.25);
    expect(handlers.onToggleNotes).toHaveBeenCalledOnce();
    expect(handlers.onToggleTheater).toHaveBeenCalledOnce();
    expect(handlers.onToggleFullscreen).toHaveBeenCalledOnce();
  });
});
