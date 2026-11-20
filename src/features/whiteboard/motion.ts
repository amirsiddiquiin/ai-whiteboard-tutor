import type { WhiteboardAction } from "@/features/lesson/schema";

import { applyWhiteboardAction, EMPTY_WHITEBOARD_STATE, type WhiteboardElement, type WhiteboardState } from "./state";
import type { LessonTimeline, TimelineCue } from "./timeline";

export type MotionPhase = "enter" | "update" | "exit" | "emphasis";
export type MotionEffect = NonNullable<WhiteboardAction["motion"]>["effect"];

export interface ElementMotion {
  effect: MotionEffect;
  phase: MotionPhase;
  progress: number;
}

export interface MotionFrame {
  camera: { scale: number; x: number; y: number };
  motions: Record<string, ElementMotion>;
  state: WhiteboardState;
}

export interface ScheduledAction {
  action: WhiteboardAction;
  cue: TimelineCue;
  duration: number;
  effect: MotionEffect;
  startSeconds: number;
}

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(Math.max(value, minimum), maximum);
}

function defaultEffect(action: WhiteboardAction): MotionEffect {
  switch (action.type) {
    case "CREATE_LINE":
    case "CREATE_ARROW":
    case "CREATE_PATH":
      return "draw";
    case "CREATE_ARRAY":
      return "stagger";
    case "CREATE_TEXT":
      return "rise";
    case "CREATE_RECTANGLE":
    case "CREATE_CIRCLE":
    case "CREATE_EQUATION":
      return "scale";
    case "UPDATE_ELEMENT":
      return "morph";
    case "HIGHLIGHT_ELEMENT":
      return "pulse";
    case "REMOVE_ELEMENT":
      return "fade";
    case "CLEAR_WHITEBOARD":
      return "crossfade";
  }
}

function defaultDuration(action: WhiteboardAction) {
  switch (action.type) {
    case "CLEAR_WHITEBOARD": return 0.85;
    case "REMOVE_ELEMENT": return 0.65;
    case "HIGHLIGHT_ELEMENT": return 0.7;
    case "UPDATE_ELEMENT": return 1.15;
    case "CREATE_LINE":
    case "CREATE_ARROW":
    case "CREATE_PATH": return 1.35;
    default: return 1.05;
  }
}

export function buildMotionSchedule(timeline: LessonTimeline): ScheduledAction[] {
  return timeline.cues.flatMap((cue) => {
    const cueDuration = Math.max(cue.endSeconds - cue.startSeconds, 0.5);
    let previousStart = cue.startSeconds - 0.05;
    return cue.actions.map((action, index) => {
      const startsWithClear = cue.actions[0]?.type === "CLEAR_WHITEBOARD";
      const fallbackAt = startsWithClear && index === 1
        ? 0.04
        : cue.actions.length <= 1
          ? 0.08
          : 0.08 + (index / Math.max(cue.actions.length - 1, 1)) * 0.68;
      const requestedStart = cue.startSeconds + (action.motion?.at ?? fallbackAt) * cueDuration;
      const startSeconds = Math.min(
        cue.endSeconds - 0.1,
        Math.max(requestedStart, previousStart + 0.05),
      );
      previousStart = startSeconds;
      return {
        action,
        cue,
        duration: Math.min(action.motion?.duration ?? defaultDuration(action), Math.max(cue.endSeconds - startSeconds, 0.2)),
        effect: action.motion?.effect ?? defaultEffect(action),
        startSeconds,
      };
    });
  });
}

function easedProgress(action: WhiteboardAction, rawProgress: number) {
  const progress = clamp(rawProgress);
  switch (action.motion?.easing ?? "ease-out") {
    case "ease-in-out":
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case "spring":
      return clamp(1 - Math.cos(progress * Math.PI * 4) * Math.exp(-progress * 6), 0, 1.06);
    case "ease-out":
      return 1 - Math.pow(1 - progress, 3);
  }
}

function numericStart(properties: Record<string, unknown>, key: string) {
  const direct = properties[key];
  if (typeof direct === "number") return direct;
  if (key === "x") {
    const alias = properties.cx ?? properties.x1;
    if (typeof alias === "number") return alias;
  }
  if (key === "y") {
    const alias = properties.cy ?? properties.y1;
    if (typeof alias === "number") return alias;
  }
  if (key === "opacity") return 1;
  return undefined;
}

function interpolateElement(before: WhiteboardElement, after: WhiteboardElement, progress: number) {
  const beforeProperties = before.properties as Record<string, unknown>;
  const afterProperties = after.properties as Record<string, unknown>;
  const properties: Record<string, unknown> = { ...afterProperties };
  for (const [key, value] of Object.entries(afterProperties)) {
    if (typeof value !== "number") continue;
    const start = numericStart(beforeProperties, key);
    if (start !== undefined) properties[key] = start + (value - start) * progress;
  }
  for (const key of ["text", "label", "expression", "color"] as const) {
    if (key in afterProperties && progress < 0.55) properties[key] = beforeProperties[key];
  }
  return { ...after, properties } as WhiteboardElement;
}

function setElementMotion(
  motions: Record<string, ElementMotion>,
  targetId: string,
  motion: ElementMotion,
) {
  const existing = motions[targetId];
  if (!existing || existing.phase !== "exit") motions[targetId] = motion;
}

function cameraForTime(timeline: LessonTimeline, seconds: number) {
  const cueIndex = timeline.cues.findIndex(
    (cue) => seconds >= cue.startSeconds && seconds < cue.endSeconds,
  );
  const cue = cueIndex >= 0 ? timeline.cues[cueIndex] : timeline.cues.at(-1);
  if (!cue) return { scale: 1, x: 0, y: 0 };
  const duration = Math.max(cue.endSeconds - cue.startSeconds, 0.1);
  const progress = clamp((seconds - cue.startSeconds) / duration);
  const arc = Math.sin(progress * Math.PI);
  const direction = cueIndex % 2 === 0 ? 1 : -1;
  return {
    scale: 1 + arc * 0.009,
    x: direction * arc * 4,
    y: -arc * 2.5,
  };
}

export function getMotionFrameAtTime(
  timeline: LessonTimeline,
  seconds: number,
  schedule: readonly ScheduledAction[] = buildMotionSchedule(timeline),
): MotionFrame {
  const time = clamp(seconds, 0, timeline.durationSeconds);
  let state: WhiteboardState = EMPTY_WHITEBOARD_STATE;
  const motions: Record<string, ElementMotion> = {};

  for (const scheduled of schedule) {
    if (time < scheduled.startSeconds) continue;
    const rawProgress = scheduled.duration <= 0
      ? 1
      : (time - scheduled.startSeconds) / scheduled.duration;
    const progress = easedProgress(scheduled.action, rawProgress);
    const action = scheduled.action;

    if ("elementId" in action) {
      state = applyWhiteboardAction(state, action);
      if (rawProgress < 1) {
        setElementMotion(motions, action.elementId, {
          effect: scheduled.effect,
          phase: "enter",
          progress,
        });
      }
      continue;
    }

    if (action.type === "UPDATE_ELEMENT") {
      const before = state.elements[action.targetId];
      const next = applyWhiteboardAction(state, action);
      const after = next.elements[action.targetId];
      state = next;
      if (before && after && rawProgress < 1) {
        state = {
          ...state,
          elements: {
            ...state.elements,
            [action.targetId]: interpolateElement(before, after, progress),
          },
        };
        setElementMotion(motions, action.targetId, {
          effect: scheduled.effect,
          phase: "update",
          progress,
        });
      }
      continue;
    }

    if (action.type === "HIGHLIGHT_ELEMENT") {
      state = applyWhiteboardAction(state, action);
      if (rawProgress < 1) {
        setElementMotion(motions, action.targetId, {
          effect: scheduled.effect,
          phase: "emphasis",
          progress,
        });
      }
      continue;
    }

    if (action.type === "REMOVE_ELEMENT") {
      if (rawProgress < 1) {
        setElementMotion(motions, action.targetId, {
          effect: scheduled.effect,
          phase: "exit",
          progress,
        });
      } else {
        state = applyWhiteboardAction(state, action);
      }
      continue;
    }

    if (action.type === "CLEAR_WHITEBOARD") {
      if (rawProgress < 1) {
        for (const id of state.order) {
          setElementMotion(motions, id, {
            effect: scheduled.effect,
            phase: "exit",
            progress,
          });
        }
      } else {
        state = applyWhiteboardAction(state, action);
      }
    }
  }

  return { camera: cameraForTime(timeline, time), motions, state };
}
