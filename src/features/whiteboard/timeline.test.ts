import { describe, expect, it } from "vitest";

import type { GeneratedLesson } from "@/features/lesson/schema";
import { createValidLesson } from "@/tests/fixtures/lesson";

import {
  buildAudioTimeline,
  buildLessonTimeline,
  getCueAtTime,
  getWhiteboardStateAtTime,
} from "./timeline";

describe("lesson timeline", () => {
  it("flattens segments and cues into exact ordered boundaries", () => {
    const timeline = buildLessonTimeline(createValidLesson());
    expect(timeline.durationSeconds).toBe(90);
    expect(timeline.cues).toHaveLength(6);
    expect(timeline.cues.map((cue) => [cue.startSeconds, cue.endSeconds])).toEqual([
      [0, 15], [15, 30], [30, 45], [45, 60], [60, 75], [75, 90],
    ]);
    expect(getCueAtTime(timeline, 15)?.cueId).toBe("cue-relationship");
    expect(getCueAtTime(timeline, 90)?.cueId).toBe("cue-summary");
  });

  it("reconstructs exact state while seeking forward and backward", () => {
    const timeline = buildLessonTimeline(createValidLesson());
    const beginning = getWhiteboardStateAtTime(timeline, 0);
    const forward = getWhiteboardStateAtTime(timeline, 80);
    const backward = getWhiteboardStateAtTime(timeline, 16);

    expect(beginning.order).toEqual(["topic-title"]);
    expect(forward.order).toEqual([
      "topic-title",
      "concept-box",
      "reasoning-arrow",
      "result-node",
      "summary-label",
    ]);
    expect(forward.highlights["concept-box"]).toEqual({ active: true, color: "amber" });
    expect(backward.order).toEqual(["topic-title", "concept-box"]);
    expect(backward.highlights).toEqual({});
  });

  it("reveals multi-action cues progressively instead of dumping the scene at once", () => {
    const lesson = createValidLesson();
    lesson.segments[0].cues[0].actions = [
      { actionId: "clear-scene", order: 0, type: "CLEAR_WHITEBOARD", properties: {} },
      { actionId: "add-title", order: 1, type: "CREATE_TEXT", elementId: "scene-title", properties: { x: 80, y: 140, text: "Search space", color: "ink", size: "lg", weight: "bold" } },
      { actionId: "add-values", order: 2, type: "CREATE_ARRAY", elementId: "scene-values", properties: { x: 120, y: 240, width: 700, values: ["2", "5", "8"], color: "blue" } },
      { actionId: "mark-middle", order: 3, type: "HIGHLIGHT_ELEMENT", targetId: "scene-values:1", properties: { active: true, color: "amber" } },
    ];
    const timeline = buildLessonTimeline(lesson);

    expect(getWhiteboardStateAtTime(timeline, 0).order).toEqual(["scene-title"]);
    expect(getWhiteboardStateAtTime(timeline, 4).order).toEqual(["scene-title", "scene-values"]);
    expect(getWhiteboardStateAtTime(timeline, 8).highlights["scene-values:1"]).toEqual({ active: true, color: "amber" });
  });

  it("clamps boundaries and supports empty lessons", () => {
    const timeline = buildLessonTimeline(createValidLesson());
    expect(getWhiteboardStateAtTime(timeline, -10).order).toEqual(["topic-title"]);
    expect(getWhiteboardStateAtTime(timeline, 999).order).toContain("summary-label");

    const empty = buildLessonTimeline({ segments: [] } as unknown as Pick<GeneratedLesson, "segments">);
    expect(empty).toEqual({ cues: [], durationSeconds: 0 });
    expect(getCueAtTime(empty, 0)).toBeNull();
    expect(getWhiteboardStateAtTime(empty, 0).order).toEqual([]);
  });

  it("uses measured audio marks as cue boundaries", () => {
    const lesson = createValidLesson();
    const estimated = buildLessonTimeline(lesson);
    const timings = estimated.cues.map((cue, index) => ({ cueId: cue.cueId, startSeconds: index * 17.25 }));
    const timeline = buildAudioTimeline(lesson, timings, 104.5);

    expect(timeline.durationSeconds).toBe(104.5);
    expect(timeline.cues[1]).toMatchObject({ startSeconds: 17.25, endSeconds: 34.5 });
    expect(timeline.cues.at(-1)?.endSeconds).toBe(104.5);
    expect(getCueAtTime(timeline, 17.25)?.cueId).toBe(estimated.cues[1].cueId);
  });

  it("rejects incomplete, unordered, and out-of-range audio marks", () => {
    const lesson = createValidLesson();
    const ids = buildLessonTimeline(lesson).cues.map((cue) => cue.cueId);
    expect(() => buildAudioTimeline(lesson, [], 90)).toThrow(/every lesson cue/);
    expect(() => buildAudioTimeline(
      lesson,
      ids.map((cueId, index) => ({ cueId, startSeconds: index === 2 ? 1 : index * 10 })),
      90,
    )).toThrow(/ordered/);
    expect(() => buildAudioTimeline(
      lesson,
      ids.map((cueId, index) => ({ cueId, startSeconds: index * 30 })),
      90,
    )).toThrow(/ordered/);
    expect(() => buildAudioTimeline(
      lesson,
      ids.map((cueId, index) => ({ cueId, startSeconds: index < 2 ? 0 : index * 10 })),
      90,
    )).toThrow(/ordered/);
  });
});
