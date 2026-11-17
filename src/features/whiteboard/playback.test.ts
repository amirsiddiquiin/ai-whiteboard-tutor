import { describe, expect, it } from "vitest";

import { createPlaybackState, playbackReducer } from "./playback";

describe("playback reducer", () => {
  it("loads measured audio duration and resets playback", () => {
    const state = playbackReducer(
      { currentTime: 30, duration: 90, status: "playing" },
      { type: "LOAD_AUDIO", duration: 103.4 },
    );
    expect(state).toEqual({ currentTime: 0, duration: 103.4, status: "idle" });
  });

  it("plays, pauses, resumes, and clamps seeks", () => {
    let state = createPlaybackState(120);
    state = playbackReducer(state, { type: "PLAY" });
    expect(state.status).toBe("playing");
    state = playbackReducer(state, { type: "SET_TIME", time: 37.5 });
    state = playbackReducer(state, { type: "PAUSE" });
    expect(state).toMatchObject({ currentTime: 37.5, status: "paused" });
    state = playbackReducer(state, { type: "PLAY" });
    expect(state).toMatchObject({ currentTime: 37.5, status: "playing" });
    expect(playbackReducer(state, { type: "SEEK", time: -4 }).currentTime).toBe(0);
    const ended = playbackReducer(state, { type: "SEEK", time: 500 });
    expect(ended).toMatchObject({ currentTime: 120, status: "ended" });
    expect(playbackReducer(ended, { type: "SEEK", time: 50 })).toMatchObject({ currentTime: 50, status: "paused" });
  });

  it("restarts and replays from the beginning", () => {
    const ended = playbackReducer(createPlaybackState(90), { type: "SET_TIME", time: 90 });
    expect(ended.status).toBe("ended");
    expect(playbackReducer(ended, { type: "RESTART" })).toMatchObject({ currentTime: 0, status: "paused" });
    expect(playbackReducer(ended, { type: "REPLAY" })).toMatchObject({ currentTime: 0, status: "playing" });
    expect(playbackReducer(ended, { type: "PLAY" })).toMatchObject({ currentTime: 0, status: "playing" });
  });

  it("does not play an empty timeline", () => {
    expect(playbackReducer(createPlaybackState(0), { type: "PLAY" })).toEqual(createPlaybackState(0));
  });
});
