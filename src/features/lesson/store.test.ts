import { beforeEach, describe, expect, it } from "vitest";

import { createValidLesson } from "@/tests/fixtures/lesson";

import { useLessonStore } from "./store";

describe("lesson generation store", () => {
  beforeEach(() => {
    useLessonStore.setState({
      activeRequestId: null,
      error: null,
      lesson: null,
      status: "idle",
    });
  });

  it("ignores a stale response from an older request", () => {
    const firstLesson = createValidLesson("First topic");
    const secondLesson = createValidLesson("Second topic");

    useLessonStore.getState().beginValidation("first");
    useLessonStore.getState().beginValidation("second");
    useLessonStore.getState().beginGeneration("second");
    useLessonStore.getState().completeGeneration("first", firstLesson);

    expect(useLessonStore.getState()).toMatchObject({
      activeRequestId: "second",
      lesson: null,
      status: "generating",
    });

    useLessonStore.getState().completeGeneration("second", secondLesson);
    expect(useLessonStore.getState().lesson?.topic).toBe("Second topic");
  });
});
