import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WhiteboardAction } from "@/features/lesson/schema";
import { reduceWhiteboardActions } from "@/features/whiteboard/state";

import { WhiteboardRenderer } from "./whiteboard-renderer";

describe("WhiteboardRenderer", () => {
  it("renders a responsive normalized SVG with educational elements", () => {
    const actions: WhiteboardAction[] = [
      { actionId: "text-action", order: 0, type: "CREATE_TEXT", elementId: "title", properties: { x: 40, y: 50, text: "Binary search", color: "ink", size: "lg", weight: "bold" } },
      { actionId: "array-action", order: 1, type: "CREATE_ARRAY", elementId: "values", properties: { x: 100, y: 180, width: 600, values: ["2", "5", "8"], color: "blue" } },
      { actionId: "arrow-action", order: 2, type: "CREATE_ARROW", elementId: "arrow", properties: { x1: 200, y1: 320, x2: 500, y2: 320, label: "discard", color: "violet" } },
      { actionId: "equation-action", order: 3, type: "CREATE_EQUATION", elementId: "equation", properties: { x: 620, y: 430, expression: "mid = (L + R) / 2", color: "coral" } },
    ];
    const { container } = render(<WhiteboardRenderer state={reduceWhiteboardActions(actions)} title="Binary Search" />);

    const svg = screen.getByRole("img", { name: "Binary Search interactive whiteboard" });
    expect(svg).toHaveAttribute("viewBox", "0 0 1000 600");
    expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    expect(svg).toHaveClass("h-full", "w-full");
    expect(screen.getByText("Binary search")).toBeInTheDocument();
    expect(screen.getByText("discard")).toBeInTheDocument();
    expect(screen.getByText("mid = (L + R) / 2")).toBeInTheDocument();
    expect(container.querySelector('[data-element-id="values:1"]')).toBeInTheDocument();
    expect(container.querySelector("line[marker-end]")).toBeInTheDocument();
  });
});
