"use client";

import { useId, useMemo } from "react";

import { composeWhiteboardLayout } from "@/features/whiteboard/layout";
import type { WhiteboardColor, WhiteboardElement, WhiteboardState } from "@/features/whiteboard/state";

const COLORS: Record<WhiteboardColor, string> = {
  ink: "#191b1a",
  blue: "#315bd8",
  teal: "#39735a",
  amber: "#c59624",
  coral: "#ed5b45",
  violet: "#7053a8",
  muted: "#777a73",
};

const FONT_SIZES = { sm: 20, md: 26, lg: 34, xl: 44 } as const;
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

function fittedLabel(label: string, availableWidth: number, preferredSize = 24) {
  const fontSize = Math.max(15, Math.min(preferredSize, availableWidth / Math.max(label.length * 0.58, 1)));
  const maxCharacters = Math.max(6, Math.floor(availableWidth / (fontSize * 0.56)));
  return {
    fontSize,
    text: label.length > maxCharacters ? `${label.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…` : label,
  };
}

function wrapBoardText(text: string, x: number, fontSize: number) {
  const availableWidth = Math.max(150, 950 - x);
  const maxCharacters = Math.max(8, Math.floor(availableWidth / (fontSize * 0.56)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || line.length === 0) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);

  if (lines.length <= 3) return lines;
  const visible = lines.slice(0, 3);
  visible[2] = `${visible[2].slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
  return visible;
}

function pathFromPoints(
  points: Array<{ x: number; y: number }>,
  closed: boolean,
) {
  const [first, ...rest] = points;
  if (!first) return "";
  if (points.length === 2) {
    const last = points[1];
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}${closed ? " Z" : ""}`;
  }

  let path = `M ${first.x} ${first.y}`;
  for (let index = 0; index < rest.length - 1; index += 1) {
    const point = rest[index];
    const next = rest[index + 1];
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = rest.at(-1);
  if (last) path += ` L ${last.x} ${last.y}`;
  return `${path}${closed ? " Z" : ""}`;
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
      const fontSize = FONT_SIZES[properties.size];
      const lines = wrapBoardText(properties.text, properties.x, fontSize);
      const lineHeight = fontSize * 1.08;
      const startY = Math.min(properties.y, 565 - (lines.length - 1) * lineHeight);
      return (
        <g className="whiteboard-element-enter" data-element-id={element.id} opacity={opacity}>
          <text
            className="whiteboard-drawn-element"
            fill={stroke}
            fontSize={fontSize}
            fontWeight={FONT_WEIGHTS[properties.weight]}
            paintOrder="stroke"
            stroke={highlight ? emphasis : "transparent"}
            strokeLinejoin="round"
            strokeOpacity={highlight ? 0.22 : 0}
            strokeWidth={highlight ? 14 : 0}
            x={properties.x}
            y={startY}
          >
            {lines.map((line, index) => (
              <tspan dy={index === 0 ? 0 : lineHeight} key={`${element.id}-${index}`} x={properties.x}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    case "CREATE_RECTANGLE": {
      const properties = element.properties as ElementOfType<"CREATE_RECTANGLE">["properties"];
      const label = properties.label ? fittedLabel(properties.label, Math.max(properties.width - 28, 40)) : null;
      return (
        <g className="whiteboard-element-enter" data-element-id={element.id} opacity={opacity}>
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
          {label ? (
            <text
              dominantBaseline="middle"
              fill={stroke}
              fontSize={label.fontSize}
              fontWeight="750"
              textAnchor="middle"
              x={properties.x + properties.width / 2}
              y={properties.y + properties.height / 2}
            >
              {label.text}
            </text>
          ) : null}
        </g>
      );
    }
    case "CREATE_CIRCLE": {
      const properties = element.properties as ElementOfType<"CREATE_CIRCLE">["properties"];
      const cx = "x" in properties && properties.x !== undefined ? properties.x : properties.cx;
      const cy = "y" in properties && properties.y !== undefined ? properties.y : properties.cy;
      const label = properties.label ? fittedLabel(properties.label, Math.max(properties.radius * 1.55, 40), 22) : null;
      return (
        <g className="whiteboard-element-enter" data-element-id={element.id} opacity={opacity}>
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
          {label ? (
            <text dominantBaseline="middle" fill={stroke} fontSize={label.fontSize} fontWeight="750" textAnchor="middle" x={cx} y={cy}>
              {label.text}
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
      const isMostlyVertical = Math.abs(y2 - y1) > Math.abs(x2 - x1);
      const labelX = Math.min(Math.max((x1 + x2) / 2 + (isMostlyVertical ? 28 : 0), 90), 910);
      const labelY = Math.min(Math.max((y1 + y2) / 2 + (isMostlyVertical ? 4 : -16), 38), 548);
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <line
            className="whiteboard-drawn-element whiteboard-stroke-enter"
            markerEnd={element.type === "CREATE_ARROW" ? `url(#${markerId})` : undefined}
            stroke={emphasis}
            strokeLinecap="round"
            strokeWidth={highlight ? 8 : 4}
            pathLength="1"
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
              x={labelX}
              y={labelY}
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
      const cellFontSize = Math.max(14, Math.min(25, cellWidth * 0.34));
      return (
        <g className="whiteboard-element-enter" data-element-id={element.id} opacity={opacity}>
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
                  fontSize={cellFontSize}
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
      const availableWidth = Math.max(180, 960 - properties.x + 20);
      const width = Math.min(Math.max(properties.expression.length * 17 + 42, 180), availableWidth);
      const equationFontSize = Math.max(
        17,
        Math.min(29, (width - 40) / Math.max(properties.expression.length * 0.58, 1)),
      );
      return (
        <g className="whiteboard-element-enter" data-element-id={element.id} opacity={opacity}>
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
          <text fill={stroke} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={equationFontSize} fontWeight="750" x={properties.x} y={properties.y}>
            {properties.expression}
          </text>
        </g>
      );
    }
    case "CREATE_PATH": {
      const properties = element.properties as ElementOfType<"CREATE_PATH">["properties"];
      const first = properties.points[0];
      return (
        <g opacity={opacity}>
          <path
            className="whiteboard-drawn-element whiteboard-stroke-enter"
            d={pathFromPoints(properties.points, properties.closed)}
            data-element-id={element.id}
            fill={properties.closed ? stroke : "none"}
            fillOpacity={properties.closed ? 0.08 : 0}
            pathLength="1"
            stroke={emphasis}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={highlight ? 9 : 5}
          />
          {properties.label && first ? (
            <text
              className="whiteboard-element-enter"
              fill={stroke}
              fontSize="20"
              fontWeight="750"
              paintOrder="stroke"
              stroke="#fffefb"
              strokeWidth="9"
              x={Math.min(first.x + 14, 900)}
              y={Math.max(first.y - 14, 28)}
            >
              {properties.label}
            </text>
          ) : null}
        </g>
      );
    }
  }
}

export function WhiteboardRenderer({
  state,
  title,
}: {
  cueLabel?: string;
  state: WhiteboardState;
  title: string;
}) {
  const markerId = `arrow-${useId().replaceAll(":", "")}`;
  const descriptionId = `${markerId}-description`;
  const displayState = useMemo(() => composeWhiteboardLayout(state), [state]);

  return (
    <div className="whiteboard-stage relative h-full w-full overflow-hidden">
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
          <clipPath id={`${markerId}-clip`}>
            <rect height="568" rx="18" width="968" x="16" y="16" />
          </clipPath>
          <pattern height="28" id={`${markerId}-grid`} patternUnits="userSpaceOnUse" width="28">
            <circle cx="1" cy="1" fill="#191b1a" fillOpacity="0.1" r="1" />
          </pattern>
          <marker id={markerId} markerHeight="9" markerWidth="9" orient="auto" refX="7" refY="4.5">
            <path d="M0,0 L0,9 L8,4.5 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect fill="#fbfaf5" height="600" width="1000" />
        <rect fill={`url(#${markerId}-grid)`} height="600" width="1000" />
        <g clipPath={`url(#${markerId}-clip)`}>
          {displayState.order.map((id) => {
            const element = displayState.elements[id];
            return element ? <ElementGroup element={element} key={id} markerId={markerId} state={displayState} /> : null;
          })}
        </g>
        </svg>
        {displayState.order.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <div className="mx-auto mb-4 size-12 rounded-full border border-[var(--ink)] bg-[var(--lemon)]" />
              <p className="font-[var(--serif)] text-xl">The canvas is ready.</p>
              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#777a73]">Press play to begin drawing</p>
            </div>
          </div>
        ) : null}
    </div>
  );
}
