import type { GeneratedLesson, WhiteboardAction } from "@/features/lesson/schema";
import type { CueTiming } from "@/features/narration/schema";

import {
  EMPTY_WHITEBOARD_STATE,
  reduceWhiteboardActions,
  type WhiteboardState,
} from "./state";

export interface TimelineCue {
  cueId: string;
  segmentId: string;
  segmentTitle: string;
  narration: string;
  startSeconds: number;
  endSeconds: number;
  actions: WhiteboardAction[];
}

export interface LessonTimeline {
  cues: TimelineCue[];
  durationSeconds: number;
}

export function buildLessonTimeline(lesson: Pick<GeneratedLesson, "segments">): LessonTimeline {
  let cursor = 0;
  const cues: TimelineCue[] = [];

  for (const segment of lesson.segments) {
    for (const cue of segment.cues) {
      const startSeconds = cursor;
      cursor += cue.estimatedDurationSeconds;
      cues.push({
        cueId: cue.id,
        segmentId: segment.id,
        segmentTitle: segment.title,
        narration: cue.narration,
        startSeconds,
        endSeconds: cursor,
        actions: [...cue.actions].sort((left, right) => left.order - right.order),
      });
    }
  }

  return { cues, durationSeconds: cursor };
}

export function buildAudioTimeline(
  lesson: Pick<GeneratedLesson, "segments">,
  cueTimings: readonly CueTiming[],
  audioDurationSeconds: number,
): LessonTimeline {
  const estimated = buildLessonTimeline(lesson);
  if (estimated.cues.length === 0) return estimated;
  if (!Number.isFinite(audioDurationSeconds) || audioDurationSeconds <= 0) {
    throw new RangeError("Audio duration must be a positive finite number.");
  }

  const timingByCue = new Map(cueTimings.map((timing) => [timing.cueId, timing.startSeconds]));
  const starts = estimated.cues.map((cue) => timingByCue.get(cue.cueId));
  if (starts.some((start) => start === undefined)) {
    throw new RangeError("Audio timings must include every lesson cue.");
  }

  const measuredStarts = starts as number[];
  if (
    measuredStarts.some(
      (start, index) =>
        start < 0 ||
        start >= audioDurationSeconds ||
        (index > 0 && start <= measuredStarts[index - 1]),
    )
  ) {
    throw new RangeError("Audio cue timings must be ordered within the audio duration.");
  }

  return {
    durationSeconds: audioDurationSeconds,
    cues: estimated.cues.map((cue, index) => ({
      ...cue,
      startSeconds: measuredStarts[index],
      endSeconds: measuredStarts[index + 1] ?? audioDurationSeconds,
    })),
  };
}

export function clampTimelineTime(timeline: LessonTimeline, seconds: number) {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), timeline.durationSeconds);
}

export function getCueAtTime(timeline: LessonTimeline, seconds: number): TimelineCue | null {
  if (timeline.cues.length === 0) return null;
  const time = clampTimelineTime(timeline, seconds);
  if (time >= timeline.durationSeconds) return timeline.cues.at(-1) ?? null;
  return timeline.cues.find((cue) => time >= cue.startSeconds && time < cue.endSeconds) ?? null;
}

export function getWhiteboardStateAtTime(
  timeline: LessonTimeline,
  seconds: number,
): WhiteboardState {
  const time = clampTimelineTime(timeline, seconds);
  const actions = timeline.cues.flatMap((cue) =>
    cue.startSeconds <= time ? cue.actions : [],
  );
  return reduceWhiteboardActions(actions, EMPTY_WHITEBOARD_STATE);
}

export function cueProgress(cue: TimelineCue | null, seconds: number) {
  if (!cue) return 0;
  const duration = cue.endSeconds - cue.startSeconds;
  if (duration <= 0) return 1;
  return Math.min(Math.max((seconds - cue.startSeconds) / duration, 0), 1);
}
