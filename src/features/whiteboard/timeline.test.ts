import { describe, expect, it } from "vitest";

import type { GeneratedLesson } from "@/features/lesson/schema";
import { createValidLesson } from "@/tests/fixtures/lesson";

import { buildLessonTimeline, getCueAtTime, getWhiteboardStateAtTime } from "./timeline";

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

  it("clamps boundaries and supports empty lessons", () => {
    const timeline = buildLessonTimeline(createValidLesson());
    expect(getWhiteboardStateAtTime(timeline, -10).order).toEqual(["topic-title"]);
    expect(getWhiteboardStateAtTime(timeline, 999).order).toContain("summary-label");

    const empty = buildLessonTimeline({ segments: [] } as unknown as Pick<GeneratedLesson, "segments">);
    expect(empty).toEqual({ cues: [], durationSeconds: 0 });
    expect(getCueAtTime(empty, 0)).toBeNull();
    expect(getWhiteboardStateAtTime(empty, 0).order).toEqual([]);
  });
});
