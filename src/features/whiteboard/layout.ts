import type { WhiteboardElement, WhiteboardState } from "./state";

const SAFE = { bottom: 552, left: 54, right: 946, top: 108 } as const;
const FONT_SIZE = { sm: 20, md: 26, lg: 34, xl: 44 } as const;
const GAP = 18;

interface Box { bottom: number; left: number; right: number; top: number }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function overlaps(left: Box, right: Box, padding = GAP) {
  return !(
    left.right + padding <= right.left ||
    left.left >= right.right + padding ||
    left.bottom + padding <= right.top ||
    left.top >= right.bottom + padding
  );
}

function overlapArea(left: Box, right: Box, padding = GAP) {
  if (!overlaps(left, right, padding)) return 0;
  const horizontal = Math.max(
    1,
    Math.min(left.right, right.right + padding) - Math.max(left.left, right.left - padding),
  );
  const vertical = Math.max(
    1,
    Math.min(left.bottom, right.bottom + padding) - Math.max(left.top, right.top - padding),
  );
  return horizontal * vertical;
}

function boxAt(left: number, top: number, width: number, height: number): Box {
  return { bottom: top + height, left, right: left + width, top };
}

function placeBox(preferredLeft: number, preferredTop: number, width: number, height: number, occupied: Box[]) {
  const safeWidth = Math.min(width, SAFE.right - SAFE.left);
  const safeHeight = Math.min(height, SAFE.bottom - SAFE.top);
  const initialLeft = clamp(preferredLeft, SAFE.left, SAFE.right - safeWidth);
  const initialTop = clamp(preferredTop, SAFE.top, SAFE.bottom - safeHeight);
  const initial = boxAt(initialLeft, initialTop, safeWidth, safeHeight);
  if (!occupied.some((candidate) => overlaps(initial, candidate))) {
    occupied.push(initial);
    return initial;
  }

  let best = initial;
  let bestScore = Number.POSITIVE_INFINITY;
  const xStep = 28;
  const yStep = 24;
  for (let top = SAFE.top; top <= SAFE.bottom - safeHeight; top += yStep) {
    for (let left = SAFE.left; left <= SAFE.right - safeWidth; left += xStep) {
      const candidate = boxAt(left, top, safeWidth, safeHeight);
      const collision = occupied.reduce((total, item) => total + overlapArea(candidate, item), 0);
      const distance = Math.abs(left - initialLeft) + Math.abs(top - initialTop);
      const score = collision * 100 + distance;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
      if (collision === 0 && distance <= yStep) break;
    }
  }

  occupied.push(best);
  return best;
}

function estimateTextBox(text: string, fontSize: number) {
  const width = clamp(text.length * fontSize * 0.52, 150, 420);
  const charactersPerLine = Math.max(8, Math.floor(width / (fontSize * 0.56)));
  const lines = Math.min(3, Math.max(1, Math.ceil(text.length / charactersPerLine)));
  return { height: lines * fontSize * 1.12, width };
}

function composeElement(element: WhiteboardElement, occupied: Box[]): WhiteboardElement {
  switch (element.type) {
    case "CREATE_TEXT": {
      const fontSize = FONT_SIZE[element.properties.size];
      const size = estimateTextBox(element.properties.text, fontSize);
      const box = placeBox(
        element.properties.x,
        element.properties.y - fontSize,
        size.width,
        size.height,
        occupied,
      );
      return {
        ...element,
        properties: { ...element.properties, x: box.left, y: box.top + fontSize },
      };
    }
    case "CREATE_EQUATION": {
      const width = clamp(element.properties.expression.length * 15 + 42, 180, 540);
      const box = placeBox(
        element.properties.x - 20,
        element.properties.y - 48,
        width,
        70,
        occupied,
      );
      return {
        ...element,
        properties: { ...element.properties, x: box.left + 20, y: box.top + 48 },
      };
    }
    case "CREATE_RECTANGLE": {
      const width = clamp(element.properties.width, 100, SAFE.right - SAFE.left);
      const height = clamp(element.properties.height, 64, SAFE.bottom - SAFE.top);
      const box = placeBox(element.properties.x, element.properties.y, width, height, occupied);
      return {
        ...element,
        properties: {
          ...element.properties,
          height: box.bottom - box.top,
          width: box.right - box.left,
          x: box.left,
          y: box.top,
        },
      };
    }
    case "CREATE_CIRCLE": {
      const radius = Math.min(element.properties.radius, 190);
      const sourceX = "x" in element.properties && element.properties.x !== undefined
        ? element.properties.x
        : element.properties.cx;
      const sourceY = "y" in element.properties && element.properties.y !== undefined
        ? element.properties.y
        : element.properties.cy;
      const box = placeBox(sourceX - radius, sourceY - radius, radius * 2, radius * 2, occupied);
      const cx = box.left + radius;
      const cy = box.top + radius;
      return {
        ...element,
        properties: {
          ...element.properties,
          cx,
          cy,
          radius,
          ...("x" in element.properties ? { x: cx, y: cy } : {}),
        },
      };
    }
    case "CREATE_ARRAY": {
      const width = clamp(element.properties.width, 180, SAFE.right - SAFE.left);
      const box = placeBox(element.properties.x, element.properties.y, width, 76, occupied);
      return {
        ...element,
        properties: { ...element.properties, width, x: box.left, y: box.top },
      };
    }
    case "CREATE_LINE":
    case "CREATE_ARROW": {
      const sourceX1 = "x" in element.properties && element.properties.x !== undefined
        ? element.properties.x
        : element.properties.x1;
      const sourceY1 = "y" in element.properties && element.properties.y !== undefined
        ? element.properties.y
        : element.properties.y1;
      const shiftedX2 = element.properties.x2 + (sourceX1 - element.properties.x1);
      const shiftedY2 = element.properties.y2 + (sourceY1 - element.properties.y1);
      const x1 = clamp(sourceX1, SAFE.left, SAFE.right);
      const x2 = clamp(shiftedX2, SAFE.left, SAFE.right);
      const y1 = clamp(sourceY1, SAFE.top, SAFE.bottom);
      const y2 = clamp(shiftedY2, SAFE.top, SAFE.bottom);
      return {
        ...element,
        properties: {
          ...element.properties,
          x1,
          x2,
          y1,
          y2,
          ...("x" in element.properties ? { x: x1, y: y1 } : {}),
        },
      };
    }
    case "CREATE_PATH": {
      const points = element.properties.points.map((point) => ({
        x: clamp(point.x, SAFE.left, SAFE.right),
        y: clamp(point.y, SAFE.top, SAFE.bottom),
      }));
      return { ...element, properties: { ...element.properties, points } };
    }
  }
}

export function composeWhiteboardLayout(
  state: WhiteboardState,
  options: { ignoreCollisionsFor?: ReadonlySet<string> } = {},
): WhiteboardState {
  const occupied: Box[] = [];
  const elements = Object.fromEntries(state.order.flatMap((id) => {
    const element = state.elements[id];
    if (!element) return [];
    if (options.ignoreCollisionsFor?.has(id)) {
      return [[id, composeElement(element, [...occupied])]];
    }
    return [[id, composeElement(element, occupied)]];
  })) as Record<string, WhiteboardElement>;
  return { ...state, elements };
}
