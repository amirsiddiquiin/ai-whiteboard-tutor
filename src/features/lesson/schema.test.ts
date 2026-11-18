import { describe, expect, it } from "vitest";

import { createValidLessonContent } from "@/tests/fixtures/lesson";

import { createLessonRequestSchema, whiteboardActionSchema } from "./schema";
import { InvalidGeneratedLessonError, parseAndHydrateLesson } from "./validation";

describe("createLessonRequestSchema", () => {
  it("normalizes a valid topic", () => {
    expect(createLessonRequestSchema.parse({ topic: "  Binary search  " })).toEqual({ topic: "Binary search" });
  });

  it("rejects empty and oversized topics", () => {
    expect(createLessonRequestSchema.safeParse({ topic: " " }).success).toBe(false);
    expect(createLessonRequestSchema.safeParse({ topic: "x".repeat(161) }).success).toBe(false);
  });
});

describe("whiteboardActionSchema", () => {
  it("accepts an allowlisted action", () => {
    expect(whiteboardActionSchema.safeParse({
      actionId: "show-values",
      order: 0,
      type: "CREATE_ARRAY",
      elementId: "values",
      properties: { x: 100, y: 220, width: 700, values: ["2", "5", "8"], color: "blue" },
    }).success).toBe(true);
  });

  it("accepts a validated educational path", () => {
    expect(whiteboardActionSchema.safeParse({
      actionId: "draw-curve",
      order: 0,
      type: "CREATE_PATH",
      elementId: "curve",
      properties: {
        points: [{ x: 80, y: 500 }, { x: 300, y: 360 }, { x: 520, y: 180 }],
        color: "violet",
        closed: false,
        label: "f(x)",
      },
    }).success).toBe(true);
  });

  it("rejects executable and unsupported commands", () => {
    expect(whiteboardActionSchema.safeParse({
      actionId: "unsafe",
      order: 0,
      type: "EXECUTE_JAVASCRIPT",
      properties: { code: "alert(1)" },
    }).success).toBe(false);
  });
});

describe("parseAndHydrateLesson", () => {
  it("hydrates valid model output with server-owned metadata", () => {
    const lesson = parseAndHydrateLesson(JSON.stringify(createValidLessonContent()), "Binary search");
    expect(lesson.id).toMatch(/[0-9a-f-]{36}/);
    expect(lesson.topic).toBe("Binary search");
    expect(lesson.estimatedDurationSeconds).toBe(90);
    expect(lesson.metadata).toMatchObject({ timing: "estimated" });
    expect(lesson.segments[0].narration).toContain("mental picture");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseAndHydrateLesson("{not-json", "Binary search")).toThrow(InvalidGeneratedLessonError);
  });

  it("rejects unsupported whiteboard commands", () => {
    const content = createValidLessonContent() as unknown as {
      segments: Array<{ cues: Array<{ actions: Array<Record<string, unknown>> }> }>;
    };
    content.segments[0].cues[0].actions[0].type = "DRAW_IMAGE";
    expect(() => parseAndHydrateLesson(JSON.stringify(content), "Binary search")).toThrow(InvalidGeneratedLessonError);
  });

  it("rejects references to missing elements", () => {
    const content = createValidLessonContent();
    content.segments[1].cues[1].actions[0] = {
      actionId: "missing-highlight",
      order: 0,
      type: "HIGHLIGHT_ELEMENT",
      targetId: "not-created",
      properties: { active: true, color: "amber" },
    };
    try {
      parseAndHydrateLesson(JSON.stringify(content), "Binary search");
      expect.fail("Expected semantic validation to reject the missing reference.");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGeneratedLessonError);
      expect((error as InvalidGeneratedLessonError).issues.join(" ")).toMatch(/missing element/);
    }
  });
});
