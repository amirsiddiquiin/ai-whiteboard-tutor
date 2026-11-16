"use client";

import { useId } from "react";

import type { WhiteboardColor, WhiteboardElement, WhiteboardState } from "@/features/whiteboard/state";

const COLORS: Record<WhiteboardColor, string> = {
  ink: "#2f2b3f",
  blue: "#4f7fe7",
  teal: "#2cae88",
  amber: "#e7a83b",
  coral: "#ea6d65",
  violet: "#7357e8",
  muted: "#817b8c",
};

const FONT_SIZES = { sm: 22, md: 30, lg: 40, xl: 52 } as const;
const FONT_WEIGHTS = { normal: 500, medium: 650, bold: 800 } as const;

type ElementOfType<T extends WhiteboardElement["type"]> = Extract<WhiteboardElement, { type: T }>;

function colorValue(color: WhiteboardColor | undefined) {
  return COLORS[color ?? "ink"];
}

function highlightFor(state: WhiteboardState, targetId: string) {
  const highlight = state.highlights[targetId];
  return highlight?.active ? highlight : null;
}

function elementOpacity(element: WhiteboardElement) {
  return "opacity" in element.properties ? element.properties.opacity ?? 1 : 1;
}

function ElementGroup({ element, state, markerId }: {
  element: WhiteboardElement;
  state: WhiteboardState;
  markerId: string;
}) {
  const highlight = highlightFor(state, element.id);
  const stroke = colorValue(element.properties.color);
  const emphasis = highlight ? colorValue(highlight.color) : stroke;
  const strokeWidth = highlight ? 7 : 3;
  const opacity = elementOpacity(element);

  switch (element.type) {
    case "CREATE_TEXT": {
      const properties = element.properties as ElementOfType<"CREATE_TEXT">["properties"];
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <text
            className="whiteboard-drawn-element"
            fill={stroke}
            fontSize={FONT_SIZES[properties.size]}
            fontWeight={FONT_WEIGHTS[properties.weight]}
            paintOrder="stroke"
            stroke={highlight ? emphasis : "transparent"}
            strokeLinejoin="round"
            strokeOpacity={highlight ? 0.22 : 0}
            strokeWidth={highlight ? 14 : 0}
            x={properties.x}
            y={properties.y}
          >
            {properties.text}
          </text>
        </g>
      );
    }
    case "CREATE_RECTANGLE": {
      const properties = element.properties as ElementOfType<"CREATE_RECTANGLE">["properties"];
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <rect
            className="whiteboard-drawn-element"
            fill={stroke}
            fillOpacity={highlight ? 0.18 : 0.08}
            height={properties.height}
            rx={18}
            stroke={emphasis}
            strokeWidth={strokeWidth}
            width={properties.width}
            x={properties.x}
            y={properties.y}
          />
          {properties.label ? (
            <text
              dominantBaseline="middle"
              fill={stroke}
              fontSize="24"
              fontWeight="750"
              textAnchor="middle"
              x={properties.x + properties.width / 2}
              y={properties.y + properties.height / 2}
            >
              {properties.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "CREATE_CIRCLE": {
      const properties = element.properties as ElementOfType<"CREATE_CIRCLE">["properties"];
      const cx = "x" in properties && properties.x !== undefined ? properties.x : properties.cx;
      const cy = "y" in properties && properties.y !== undefined ? properties.y : properties.cy;
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <circle
            className="whiteboard-drawn-element"
            cx={cx}
            cy={cy}
            fill={stroke}
            fillOpacity={highlight ? 0.18 : 0.08}
            r={properties.radius}
            stroke={emphasis}
            strokeWidth={strokeWidth}
          />
          {properties.label ? (
            <text dominantBaseline="middle" fill={stroke} fontSize="24" fontWeight="750" textAnchor="middle" x={cx} y={cy}>
              {properties.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "CREATE_LINE":
    case "CREATE_ARROW": {
      const properties = element.properties as ElementOfType<"CREATE_LINE" | "CREATE_ARROW">["properties"];
      const x1 = "x" in properties && properties.x !== undefined ? properties.x : properties.x1;
      const y1 = "y" in properties && properties.y !== undefined ? properties.y : properties.y1;
      const x2 = properties.x2 + (x1 - properties.x1);
      const y2 = properties.y2 + (y1 - properties.y1);
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <line
            className="whiteboard-drawn-element"
            markerEnd={element.type === "CREATE_ARROW" ? `url(#${markerId})` : undefined}
            stroke={emphasis}
            strokeLinecap="round"
            strokeWidth={highlight ? 8 : 4}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
          {properties.label ? (
            <text
              fill={stroke}
              fontSize="20"
              fontWeight="700"
              paintOrder="stroke"
              stroke="#fffefb"
              strokeWidth="10"
              textAnchor="middle"
              x={(x1 + x2) / 2}
              y={(y1 + y2) / 2 - 12}
            >
              {properties.label}
            </text>
          ) : null}
        </g>
      );
    }
    case "CREATE_ARRAY": {
      const properties = element.properties as ElementOfType<"CREATE_ARRAY">["properties"];
      const cellWidth = properties.width / properties.values.length;
      return (
        <g data-element-id={element.id} opacity={opacity}>
          {properties.values.map((value, index) => {
            const targetId = `${element.id}:${index}`;
            const hidden = state.hiddenTargets.includes(targetId);
            const update = state.targetUpdates[targetId];
            const cellHighlight = highlightFor(state, targetId);
            const cellColor = colorValue(update?.color ?? properties.color);
            if (hidden) return null;
            return (
              <g data-element-id={targetId} key={targetId} opacity={update?.opacity ?? 1}>
                <rect
                  className="whiteboard-drawn-element"
                  fill={cellHighlight ? colorValue(cellHighlight.color) : cellColor}
                  fillOpacity={cellHighlight ? 0.22 : 0.07}
                  height="76"
                  rx="8"
                  stroke={cellHighlight ? colorValue(cellHighlight.color) : cellColor}
                  strokeWidth={cellHighlight ? 7 : 3}
                  width={Math.max(cellWidth - 4, 4)}
                  x={properties.x + index * cellWidth + 2}
                  y={properties.y}
                />
                <text
                  dominantBaseline="middle"
                  fill={cellColor}
                  fontSize="25"
                  fontWeight="750"
                  textAnchor="middle"
                  x={properties.x + index * cellWidth + cellWidth / 2}
                  y={properties.y + 38}
                >
                  {update?.text ?? value}
                </text>
              </g>
            );
          })}
        </g>
      );
    }
    case "CREATE_EQUATION": {
      const properties = element.properties as ElementOfType<"CREATE_EQUATION">["properties"];
      const width = Math.min(Math.max(properties.expression.length * 19 + 42, 180), 760);
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <rect
            fill={stroke}
            fillOpacity={highlight ? 0.2 : 0.08}
            height="70"
            rx="16"
            stroke={emphasis}
            strokeWidth={strokeWidth}
            width={width}
            x={properties.x - 20}
            y={properties.y - 48}
          />
          <text fill={stroke} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="29" fontWeight="750" x={properties.x} y={properties.y}>
            {properties.expression}
          </text>
        </g>
      );
    }
  }
}

export function WhiteboardRenderer({ state, title }: { state: WhiteboardState; title: string }) {
  const markerId = `arrow-${useId().replaceAll(":", "")}`;
  const descriptionId = `${markerId}-description`;

  return (
    <div className="whiteboard-stage relative aspect-[5/3] w-full overflow-hidden rounded-[24px] border border-white/70 bg-[#fffefb] shadow-inner">
      <svg
        aria-describedby={descriptionId}
        aria-label={`${title} interactive whiteboard`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox="0 0 1000 600"
      >
        <desc id={descriptionId}>Educational diagram reconstructed from the current lesson timestamp.</desc>
        <defs>
          <pattern height="32" id={`${markerId}-grid`} patternUnits="userSpaceOnUse" width="32">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#8f89a0" strokeOpacity="0.075" strokeWidth="1" />
          </pattern>
          <marker id={markerId} markerHeight="9" markerWidth="9" orient="auto" refX="7" refY="4.5">
            <path d="M0,0 L0,9 L8,4.5 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect fill="#fffefb" height="600" width="1000" />
        <rect fill={`url(#${markerId}-grid)`} height="600" width="1000" />
        {state.order.map((id) => {
          const element = state.elements[id];
          return element ? <ElementGroup element={element} key={id} markerId={markerId} state={state} /> : null;
        })}
      </svg>
      {state.order.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[var(--violet-wash)] text-xl text-[var(--violet)]">✦</div>
            <p className="text-sm font-bold text-[var(--ink)]">Your visual lesson starts here</p>
            <p className="mt-1 text-xs font-medium text-[var(--muted)]">Press play or scrub the timeline to draw the explanation.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
