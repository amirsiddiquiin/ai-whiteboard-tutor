import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlaybackControls } from "./playback-controls";

function renderControls(status: "idle" | "playing" | "paused" | "ended" = "idle") {
  const handlers = {
    onPause: vi.fn(),
    onPlay: vi.fn(),
    onReplay: vi.fn(),
    onRestart: vi.fn(),
    onSeek: vi.fn(),
  };
  render(<PlaybackControls currentTime={status === "ended" ? 90 : 25} duration={90} status={status} {...handlers} />);
  return handlers;
}

describe("PlaybackControls", () => {
  it("wires play, pause, restart, replay, and seek controls", () => {
    let handlers = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Play lesson" }));
    expect(handlers.onPlay).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(handlers.onRestart).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByRole("slider", { name: "Seek through lesson" }), { target: { value: "42" } });
    expect(handlers.onSeek).toHaveBeenCalledWith(42);

    document.body.innerHTML = "";
    handlers = renderControls("playing");
    fireEvent.click(screen.getByRole("button", { name: "Pause lesson" }));
    expect(handlers.onPause).toHaveBeenCalledOnce();

    document.body.innerHTML = "";
    handlers = renderControls("ended");
    fireEvent.click(screen.getByRole("button", { name: "Replay lesson" }));
    expect(handlers.onReplay).toHaveBeenCalledOnce();
  });
});
