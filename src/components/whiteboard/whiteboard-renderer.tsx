"use client";

import { useId, useMemo } from "react";

import { composeWhiteboardLayout } from "@/features/whiteboard/layout";
import type { ElementMotion } from "@/features/whiteboard/motion";
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

function wrapText(text: string, availableWidth: number, fontSize: number, maxLines: number) {
  const maxCharacters = Math.max(8, Math.floor(availableWidth / (fontSize * 0.56)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const rawWord of words) {
    const word = rawWord.length > maxCharacters
      ? `${rawWord.slice(0, Math.max(1, maxCharacters - 1))}…`
      : rawWord;
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || line.length === 0) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);

  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = maxLines - 1;
  visible[last] = `${visible[last].slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`;
  return visible;
}

function wrapBoardText(text: string, x: number, fontSize: number) {
  return wrapText(text, Math.max(150, Math.min(420, 946 - x)), fontSize, 3);
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

function clampProgress(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function motionPresentation(motion: ElementMotion | undefined) {
  if (!motion) return { opacity: 1, transform: "translate(0px, 0px) scale(1)" };
  const progress = clampProgress(motion.progress);
  if (motion.phase === "exit") {
    return {
      opacity: 1 - progress,
      transform: `translate(0px, ${progress * -8}px) scale(${1 - progress * 0.06})`,
    };
  }
  if (motion.phase === "emphasis") {
    return {
      opacity: 1,
      transform: `translate(0px, 0px) scale(${1 + Math.sin(progress * Math.PI) * 0.045})`,
    };
  }
  if (motion.phase === "update") {
    return { opacity: 1, transform: "translate(0px, 0px) scale(1)" };
  }

  switch (motion.effect) {
    case "slide-left":
      return { opacity: progress, transform: `translate(${(1 - progress) * 44}px, 0px) scale(1)` };
    case "slide-right":
      return { opacity: progress, transform: `translate(${(progress - 1) * 44}px, 0px) scale(1)` };
    case "rise":
      return { opacity: progress, transform: `translate(0px, ${(1 - progress) * 24}px) scale(1)` };
    case "scale":
      return { opacity: progress, transform: `translate(0px, 0px) scale(${0.82 + progress * 0.18})` };
    case "stagger":
    case "draw":
      return { opacity: 1, transform: "translate(0px, 0px) scale(1)" };
    default:
      return { opacity: progress, transform: `translate(0px, ${(1 - progress) * 10}px) scale(1)` };
  }
}

function ElementGroup({ element, motion, state, markerId }: {
  element: WhiteboardElement;
  motion?: ElementMotion;
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
        <g data-element-id={element.id} opacity={opacity}>
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
      const labelWidth = Math.max(properties.width - 32, 40);
      const initialLabel = properties.label ? fittedLabel(properties.label, labelWidth) : null;
      const labelLines = properties.label && initialLabel
        ? wrapText(properties.label, labelWidth, initialLabel.fontSize, 3)
        : [];
      const labelFontSize = initialLabel
        ? Math.max(13, Math.min(initialLabel.fontSize, (properties.height - 24) / Math.max(labelLines.length * 1.15, 1)))
        : 0;
      const labelLineHeight = labelFontSize * 1.15;
      const labelStartY = properties.y + properties.height / 2 - ((labelLines.length - 1) * labelLineHeight) / 2;
      const clipId = `${markerId}-${element.id}-label`;
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <defs>
            <clipPath id={clipId}>
              <rect height={Math.max(properties.height - 16, 1)} rx="12" width={Math.max(properties.width - 16, 1)} x={properties.x + 8} y={properties.y + 8} />
            </clipPath>
          </defs>
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
          {labelLines.length > 0 ? (
            <text
              clipPath={`url(#${clipId})`}
              dominantBaseline="middle"
              fill={stroke}
              fontSize={labelFontSize}
              fontWeight="750"
              textAnchor="middle"
              x={properties.x + properties.width / 2}
              y={labelStartY}
            >
              {labelLines.map((line, index) => (
                <tspan dy={index === 0 ? 0 : labelLineHeight} key={`${element.id}-label-${index}`} x={properties.x + properties.width / 2}>
                  {line}
                </tspan>
              ))}
            </text>
          ) : null}
        </g>
      );
    }
    case "CREATE_CIRCLE": {
      const properties = element.properties as ElementOfType<"CREATE_CIRCLE">["properties"];
      const cx = "x" in properties && properties.x !== undefined ? properties.x : properties.cx;
      const cy = "y" in properties && properties.y !== undefined ? properties.y : properties.cy;
      const labelWidth = Math.max(properties.radius * 1.45, 40);
      const initialLabel = properties.label ? fittedLabel(properties.label, labelWidth, 22) : null;
      const labelLines = properties.label && initialLabel
        ? wrapText(properties.label, labelWidth, initialLabel.fontSize, 2)
        : [];
      const labelLineHeight = (initialLabel?.fontSize ?? 0) * 1.12;
      const labelStartY = cy - ((labelLines.length - 1) * labelLineHeight) / 2;
      const clipId = `${markerId}-${element.id}-label`;
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <defs><clipPath id={clipId}><circle cx={cx} cy={cy} r={Math.max(properties.radius - 10, 1)} /></clipPath></defs>
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
          {labelLines.length > 0 && initialLabel ? (
            <text clipPath={`url(#${clipId})`} dominantBaseline="middle" fill={stroke} fontSize={initialLabel.fontSize} fontWeight="750" textAnchor="middle" x={cx} y={labelStartY}>
              {labelLines.map((line, index) => (
                <tspan dy={index === 0 ? 0 : labelLineHeight} key={`${element.id}-label-${index}`} x={cx}>{line}</tspan>
              ))}
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
      const label = properties.label ? fittedLabel(properties.label, 220, 20) : null;
      const drawProgress = motion?.phase === "enter" && motion.effect === "draw"
        ? clampProgress(motion.progress)
        : 1;
      return (
        <g data-element-id={element.id} opacity={opacity}>
          <line
            className="whiteboard-drawn-element"
            markerEnd={element.type === "CREATE_ARROW" ? `url(#${markerId})` : undefined}
            stroke={emphasis}
            strokeLinecap="round"
            strokeWidth={highlight ? 8 : 4}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - drawProgress}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
          {label ? (
            <text
              fill={stroke}
              fontSize={label.fontSize}
              fontWeight="700"
              paintOrder="stroke"
              stroke="#fffefb"
              strokeWidth="10"
              textAnchor="middle"
              x={labelX}
              y={labelY}
            >
              {label.text}
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
        <g data-element-id={element.id} opacity={opacity}>
          {properties.values.map((value, index) => {
            const targetId = `${element.id}:${index}`;
            const hidden = state.hiddenTargets.includes(targetId);
            const update = state.targetUpdates[targetId];
            const cellHighlight = highlightFor(state, targetId);
            const cellColor = colorValue(update?.color ?? properties.color);
            const cellProgress = motion?.phase === "enter" && motion.effect === "stagger"
              ? clampProgress(motion.progress * properties.values.length - index * 0.72)
              : 1;
            if (hidden) return null;
            return (
              <g
                data-element-id={targetId}
                key={targetId}
                opacity={(update?.opacity ?? 1) * cellProgress}
                style={{ transform: `translateY(${(1 - cellProgress) * 18}px)`, transformBox: "fill-box", transformOrigin: "center" }}
              >
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
      const equation = fittedLabel(properties.expression, width - 40, 29);
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
          <text fill={stroke} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={equation.fontSize} fontWeight="750" x={properties.x} y={properties.y}>
            {equation.text}
          </text>
        </g>
      );
    }
    case "CREATE_PATH": {
      const properties = element.properties as ElementOfType<"CREATE_PATH">["properties"];
      const first = properties.points[0];
      const drawProgress = motion?.phase === "enter" && motion.effect === "draw"
        ? clampProgress(motion.progress)
        : 1;
      return (
        <g opacity={opacity}>
          <path
            className="whiteboard-drawn-element"
            d={pathFromPoints(properties.points, properties.closed)}
            data-element-id={element.id}
            fill={properties.closed ? stroke : "none"}
            fillOpacity={properties.closed ? 0.08 : 0}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - drawProgress}
            stroke={emphasis}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={highlight ? 9 : 5}
          />
          {properties.label && first ? (
            <text
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
  camera = { scale: 1, x: 0, y: 0 },
  cueLabel,
  motions = {},
  state,
  title,
}: {
  camera?: { scale: number; x: number; y: number };
  cueLabel?: string;
  motions?: Record<string, ElementMotion>;
  state: WhiteboardState;
  title: string;
}) {
  const markerId = `arrow-${useId().replaceAll(":", "")}`;
  const descriptionId = `${markerId}-description`;
  const exitingIds = useMemo(
    () => new Set(Object.entries(motions).flatMap(([id, motion]) => motion.phase === "exit" ? [id] : [])),
    [motions],
  );
  const displayState = useMemo(
    () => composeWhiteboardLayout(state, { ignoreCollisionsFor: exitingIds }),
    [exitingIds, state],
  );
  const cameraTransform = `translate(500 326) scale(${camera.scale}) translate(-500 -326) translate(${camera.x} ${camera.y})`;

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
            <rect height="456" rx="14" width="916" x="42" y="100" />
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
        <g aria-hidden="true">
          <rect fill="#191b1a" height="8" rx="4" width="8" x="54" y="50" />
          <text fill="#777a73" fontSize="15" fontWeight="800" letterSpacing="2" x="78" y="58">CURRENT CONCEPT</text>
          <text fill="#191b1a" fontSize="28" fontWeight="800" x="275" y="60">{fittedLabel(cueLabel ?? title, 650, 28).text}</text>
          <line stroke="#191b1a" strokeOpacity="0.18" x1="54" x2="946" y1="88" y2="88" />
        </g>
        <g clipPath={`url(#${markerId}-clip)`}>
          <g transform={cameraTransform}>
            {displayState.order.map((id) => {
              const element = displayState.elements[id];
              const presentation = motionPresentation(motions[id]);
              return element ? (
                <g
                  className="whiteboard-motion-element"
                  data-motion-phase={motions[id]?.phase ?? "steady"}
                  key={id}
                  opacity={presentation.opacity}
                  style={{ transform: presentation.transform, transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <ElementGroup element={element} markerId={markerId} motion={motions[id]} state={displayState} />
                </g>
              ) : null;
            })}
          </g>
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
