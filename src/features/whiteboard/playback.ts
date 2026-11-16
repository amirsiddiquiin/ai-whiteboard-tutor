export type PlaybackStatus = "idle" | "playing" | "paused" | "ended";

export interface PlaybackState {
  currentTime: number;
  duration: number;
  status: PlaybackStatus;
}

export type PlaybackEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; time: number }
  | { type: "SET_TIME"; time: number }
  | { type: "RESTART" }
  | { type: "REPLAY" };

export function createPlaybackState(duration: number): PlaybackState {
  return { currentTime: 0, duration: Math.max(0, duration), status: "idle" };
}

function clampTime(state: PlaybackState, time: number) {
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), state.duration);
}

export function playbackReducer(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  switch (event.type) {
    case "PLAY":
      if (state.duration === 0) return state;
      return {
        ...state,
        currentTime: state.status === "ended" ? 0 : state.currentTime,
        status: "playing",
      };
    case "PAUSE":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "SEEK": {
      const currentTime = clampTime(state, event.time);
      return {
        ...state,
        currentTime,
        status:
          currentTime >= state.duration
            ? "ended"
            : state.status === "idle" || state.status === "ended"
              ? "paused"
              : state.status,
      };
    }
    case "SET_TIME": {
      const currentTime = clampTime(state, event.time);
      return {
        ...state,
        currentTime,
        status: currentTime >= state.duration ? "ended" : state.status,
      };
    }
    case "RESTART":
      return { ...state, currentTime: 0, status: "paused" };
    case "REPLAY":
      return state.duration === 0
        ? state
        : { ...state, currentTime: 0, status: "playing" };
  }
}
