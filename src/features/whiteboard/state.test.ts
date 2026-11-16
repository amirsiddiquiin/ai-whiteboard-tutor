import { describe, expect, it } from "vitest";

import type { WhiteboardAction } from "@/features/lesson/schema";

import { applyWhiteboardAction, EMPTY_WHITEBOARD_STATE, reduceWhiteboardActions } from "./state";

const createActions: WhiteboardAction[] = [
  { actionId: "a-text", order: 0, type: "CREATE_TEXT", elementId: "text", properties: { x: 40, y: 50, text: "Hello", color: "ink", size: "md", weight: "bold" } },
  { actionId: "a-rect", order: 1, type: "CREATE_RECTANGLE", elementId: "rect", properties: { x: 80, y: 90, width: 220, height: 120, label: "Box", color: "blue" } },
  { actionId: "a-circle", order: 2, type: "CREATE_CIRCLE", elementId: "circle", properties: { cx: 400, cy: 170, radius: 60, label: "Node", color: "teal" } },
  { actionId: "a-line", order: 3, type: "CREATE_LINE", elementId: "line", properties: { x1: 460, y1: 170, x2: 560, y2: 170, label: "link", color: "muted" } },
  { actionId: "a-arrow", order: 4, type: "CREATE_ARROW", elementId: "arrow", properties: { x1: 560, y1: 170, x2: 680, y2: 170, label: "next", color: "violet" } },
  { actionId: "a-array", order: 5, type: "CREATE_ARRAY", elementId: "array", properties: { x: 100, y: 300, width: 500, values: ["2", "4", "8"], color: "amber" } },
  { actionId: "a-equation", order: 6, type: "CREATE_EQUATION", elementId: "equation", properties: { x: 650, y: 360, expression: "2 + 2 = 4", color: "coral" } },
];

describe("whiteboard state reducer", () => {
  it("creates every supported drawable element in stable order", () => {
    const state = reduceWhiteboardActions(createActions);
    expect(state.order).toEqual(["text", "rect", "circle", "line", "arrow", "array", "equation"]);
    expect(Object.values(state.elements).map((element) => element.type)).toEqual([
      "CREATE_TEXT",
      "CREATE_RECTANGLE",
      "CREATE_CIRCLE",
      "CREATE_LINE",
      "CREATE_ARROW",
      "CREATE_ARRAY",
      "CREATE_EQUATION",
    ]);
  });

  it("updates, highlights, and removes elements and array cells", () => {
    let state = reduceWhiteboardActions(createActions);
    state = applyWhiteboardAction(state, {
      actionId: "a-update",
      order: 0,
      type: "UPDATE_ELEMENT",
      targetId: "text",
      properties: { text: "Updated", color: "violet", opacity: 0.6 },
    });
    state = applyWhiteboardAction(state, {
      actionId: "a-highlight",
      order: 1,
      type: "HIGHLIGHT_ELEMENT",
      targetId: "rect",
      properties: { active: true, color: "amber" },
    });
    state = applyWhiteboardAction(state, {
      actionId: "a-cell-update",
      order: 2,
      type: "UPDATE_ELEMENT",
      targetId: "array:1",
      properties: { text: "5", color: "coral" },
    });
    state = applyWhiteboardAction(state, {
      actionId: "a-cell-remove",
      order: 3,
      type: "REMOVE_ELEMENT",
      targetId: "array:0",
      properties: {},
    });
    state = applyWhiteboardAction(state, {
      actionId: "a-remove",
      order: 4,
      type: "REMOVE_ELEMENT",
      targetId: "line",
      properties: {},
    });

    expect(state.elements.text.properties).toMatchObject({ text: "Updated", color: "violet", opacity: 0.6 });
    expect(state.highlights.rect).toEqual({ active: true, color: "amber" });
    expect(state.targetUpdates["array:1"]).toMatchObject({ text: "5", color: "coral" });
    expect(state.hiddenTargets).toContain("array:0");
    expect(state.elements.line).toBeUndefined();
  });

  it("clears the board and treats missing or duplicate references as safe no-ops", () => {
    const created = reduceWhiteboardActions(createActions);
    const missing = applyWhiteboardAction(created, {
      actionId: "missing",
      order: 0,
      type: "UPDATE_ELEMENT",
      targetId: "not-there",
      properties: { color: "coral" },
    });
    const duplicate = applyWhiteboardAction(created, createActions[0]);
    expect(missing).toBe(created);
    expect(duplicate).toBe(created);

    const cleared = applyWhiteboardAction(created, {
      actionId: "clear",
      order: 0,
      type: "CLEAR_WHITEBOARD",
      properties: {},
    });
    expect(cleared).toEqual(EMPTY_WHITEBOARD_STATE);
  });
});
