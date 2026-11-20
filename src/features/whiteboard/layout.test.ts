import { describe, expect, it } from "vitest";

import type { WhiteboardAction } from "@/features/lesson/schema";

import { composeWhiteboardLayout } from "./layout";
import { reduceWhiteboardActions } from "./state";

describe("composeWhiteboardLayout", () => {
  it("keeps generated content inside safe margins and separates text", () => {
    const actions: WhiteboardAction[] = [
      { actionId: "one", order: 0, type: "CREATE_TEXT", elementId: "title", properties: { x: 990, y: 20, text: "Concept title", color: "ink", size: "xl", weight: "bold" } },
      { actionId: "two", order: 1, type: "CREATE_TEXT", elementId: "label", properties: { x: 990, y: 20, text: "Supporting label", color: "blue", size: "lg", weight: "bold" } },
      { actionId: "three", order: 2, type: "CREATE_PATH", elementId: "curve", properties: { points: [{ x: 0, y: 0 }, { x: 1000, y: 600 }], color: "blue", closed: false } },
    ];
    const state = composeWhiteboardLayout(reduceWhiteboardActions(actions));
    const title = state.elements.title;
    const label = state.elements.label;
    const curve = state.elements.curve;
    if (title.type !== "CREATE_TEXT" || label.type !== "CREATE_TEXT" || curve.type !== "CREATE_PATH") return;
    expect(title.properties.x).toBeLessThanOrEqual(818);
    expect(label.properties.y).not.toBe(title.properties.y);
    expect(curve.properties.points).toEqual([{ x: 54, y: 108 }, { x: 946, y: 552 }]);
  });

  it("moves overlapping containers into distinct presentation slots", () => {
    const actions: WhiteboardAction[] = [
      { actionId: "first", order: 0, type: "CREATE_RECTANGLE", elementId: "input", properties: { x: 120, y: 180, width: 280, height: 140, label: "Input", color: "blue" } },
      { actionId: "second", order: 1, type: "CREATE_RECTANGLE", elementId: "transform", properties: { x: 140, y: 190, width: 280, height: 140, label: "Transform", color: "violet" } },
    ];
    const state = composeWhiteboardLayout(reduceWhiteboardActions(actions));
    const input = state.elements.input;
    const transform = state.elements.transform;
    if (input.type !== "CREATE_RECTANGLE" || transform.type !== "CREATE_RECTANGLE") return;

    const separated =
      input.properties.x + input.properties.width + 18 <= transform.properties.x ||
      transform.properties.x + transform.properties.width + 18 <= input.properties.x ||
      input.properties.y + input.properties.height + 18 <= transform.properties.y ||
      transform.properties.y + transform.properties.height + 18 <= input.properties.y;
    expect(separated, JSON.stringify({ input: input.properties, transform: transform.properties })).toBe(true);
    expect(transform.properties.x + transform.properties.width).toBeLessThanOrEqual(946);
    expect(transform.properties.y + transform.properties.height).toBeLessThanOrEqual(552);
  });

  it("clamps moved line and circle aliases instead of letting updates escape", () => {
    const actions: WhiteboardAction[] = [
      { actionId: "circle", order: 0, type: "CREATE_CIRCLE", elementId: "sun", properties: { cx: 500, cy: 300, radius: 80, color: "amber" } },
      { actionId: "move-circle", order: 1, type: "UPDATE_ELEMENT", targetId: "sun", properties: { x: 1200, y: -100 } },
      { actionId: "arrow", order: 2, type: "CREATE_ARROW", elementId: "ray", properties: { x1: 100, y1: 100, x2: 300, y2: 300, color: "blue" } },
      { actionId: "move-arrow", order: 3, type: "UPDATE_ELEMENT", targetId: "ray", properties: { x: 1100, y: 700 } },
    ];
    const state = composeWhiteboardLayout(reduceWhiteboardActions(actions));
    const circle = state.elements.sun;
    const arrow = state.elements.ray;
    if (circle.type !== "CREATE_CIRCLE" || arrow.type !== "CREATE_ARROW") return;
    expect(circle.properties.x).toBeLessThanOrEqual(878);
    expect(circle.properties.y).toBeGreaterThanOrEqual(108);
    expect(arrow.properties.x).toBeLessThanOrEqual(958);
    expect(arrow.properties.x2).toBeLessThanOrEqual(958);
    expect(arrow.properties.y).toBeLessThanOrEqual(560);
    expect(arrow.properties.y2).toBeLessThanOrEqual(560);
  });
});
