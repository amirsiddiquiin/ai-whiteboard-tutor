import { describe, expect, it } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import { buildMotionSchedule, getMotionFrameAtTime } from "./motion";
import { buildLessonTimeline } from "./timeline";

describe("continuous whiteboard motion", () => {
  it("samples an entrance continuously from the audio-relative action timing", () => {
    const lesson = createValidLesson();
    lesson.segments[0].cues[0].actions[0].motion = {
      at: 0,
      duration: 2,
      easing: "ease-out",
      effect: "rise",
    };
    const timeline = buildLessonTimeline(lesson);

    const start = getMotionFrameAtTime(timeline, 0);
    const middle = getMotionFrameAtTime(timeline, 1);
    const settled = getMotionFrameAtTime(timeline, 3);

    expect(start.motions["topic-title"]).toMatchObject({ phase: "enter", progress: 0 });
    expect(middle.motions["topic-title"].progress).toBeGreaterThan(0);
    expect(middle.motions["topic-title"].progress).toBeLessThan(1);
    expect(settled.motions["topic-title"]).toBeUndefined();
  });

  it("interpolates updates instead of snapping element properties", () => {
    const lesson = createValidLesson();
    lesson.segments[0].cues[0].actions = [
      {
        actionId: "create-node",
        order: 0,
        type: "CREATE_CIRCLE",
        elementId: "moving-node",
        properties: { cx: 180, cy: 260, radius: 60, label: "Input", color: "blue" },
        motion: { at: 0, duration: 0.5, easing: "ease-out", effect: "scale" },
      },
      {
        actionId: "move-node",
        order: 1,
        type: "UPDATE_ELEMENT",
        targetId: "moving-node",
        properties: { x: 720, y: 260, label: "Output", color: "teal" },
        motion: { at: 0.4, duration: 2, easing: "ease-in-out", effect: "morph" },
      },
    ];
    const timeline = buildLessonTimeline(lesson);
    const frame = getMotionFrameAtTime(timeline, 7);
    const node = frame.state.elements["moving-node"];
    if (node.type !== "CREATE_CIRCLE") return;

    expect(node.properties.x).toBeGreaterThan(180);
    expect(node.properties.x).toBeLessThan(720);
    expect(frame.motions["moving-node"]).toMatchObject({ phase: "update", effect: "morph" });
  });

  it("keeps generated motion timings ordered and inside their narration cue", () => {
    const timeline = buildLessonTimeline(createValidLesson());
    const schedule = buildMotionSchedule(timeline);
    for (const cue of timeline.cues) {
      const cueActions = schedule.filter((item) => item.cue.cueId === cue.cueId);
      expect(cueActions.map((item) => item.startSeconds)).toEqual(
        [...cueActions.map((item) => item.startSeconds)].sort((left, right) => left - right),
      );
      expect(cueActions.every((item) => item.startSeconds >= cue.startSeconds && item.startSeconds < cue.endSeconds)).toBe(true);
    }
  });
});
