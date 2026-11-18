import type { WhiteboardElement, WhiteboardState } from "./state";

const SAFE = { bottom: 560, left: 42, right: 958, top: 28 } as const;
const FONT_SIZE = { sm: 20, md: 26, lg: 34, xl: 44 } as const;

interface Box { bottom: number; left: number; right: number; top: number }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function overlaps(left: Box, right: Box, padding = 16) {
  return !(left.right + padding <= right.left || left.left >= right.right + padding || left.bottom + padding <= right.top || left.top >= right.bottom + padding);
}

function fitTextBox(x: number, y: number, text: string, fontSize: number, occupied: Box[]) {
  const safeX = clamp(x, SAFE.left, SAFE.right - 140);
  const availableWidth = SAFE.right - safeX;
  const estimatedWidth = Math.min(Math.max(text.length * fontSize * 0.5, 110), availableWidth);
  const lineCount = Math.max(1, Math.ceil((text.length * fontSize * 0.5) / availableWidth));
  const estimatedHeight = Math.min(lineCount, 3) * fontSize * 1.12;
  let safeY = clamp(y, SAFE.top + fontSize, SAFE.bottom - estimatedHeight + fontSize);
  let box = { bottom: safeY - fontSize + estimatedHeight, left: safeX, right: safeX + estimatedWidth, top: safeY - fontSize };

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const collision = occupied.find((candidate) => overlaps(box, candidate));
    if (!collision) break;
    const below = collision.bottom + fontSize + 18;
    safeY = below - fontSize + estimatedHeight <= SAFE.bottom
      ? below
      : clamp(collision.top - estimatedHeight - 18 + fontSize, SAFE.top + fontSize, SAFE.bottom);
    box = { bottom: safeY - fontSize + estimatedHeight, left: safeX, right: safeX + estimatedWidth, top: safeY - fontSize };
  }

  occupied.push(box);
  return { x: safeX, y: safeY };
}

function reserveBox(box: Box, occupied: Box[]) {
  occupied.push({
    bottom: clamp(box.bottom, SAFE.top, SAFE.bottom),
    left: clamp(box.left, SAFE.left, SAFE.right),
    right: clamp(box.right, SAFE.left, SAFE.right),
    top: clamp(box.top, SAFE.top, SAFE.bottom),
  });
}

function composeElement(element: WhiteboardElement, occupied: Box[]): WhiteboardElement {
  switch (element.type) {
    case "CREATE_TEXT": {
      const position = fitTextBox(element.properties.x, element.properties.y, element.properties.text, FONT_SIZE[element.properties.size], occupied);
      return { ...element, properties: { ...element.properties, ...position } };
    }
    case "CREATE_EQUATION": {
      const position = fitTextBox(element.properties.x, element.properties.y, element.properties.expression, 27, occupied);
      return { ...element, properties: { ...element.properties, ...position } };
    }
    case "CREATE_RECTANGLE": {
      const width = Math.min(element.properties.width, SAFE.right - SAFE.left);
      const height = Math.min(element.properties.height, SAFE.bottom - SAFE.top);
      const x = clamp(element.properties.x, SAFE.left, SAFE.right - width);
      const y = clamp(element.properties.y, SAFE.top, SAFE.bottom - height);
      reserveBox({ bottom: y + height, left: x, right: x + width, top: y }, occupied);
      return { ...element, properties: { ...element.properties, height, width, x, y } };
    }
    case "CREATE_CIRCLE": {
      const radius = Math.min(element.properties.radius, 250);
      const sourceX = "x" in element.properties && element.properties.x !== undefined ? element.properties.x : element.properties.cx;
      const sourceY = "y" in element.properties && element.properties.y !== undefined ? element.properties.y : element.properties.cy;
      const cx = clamp(sourceX, SAFE.left + radius, SAFE.right - radius);
      const cy = clamp(sourceY, SAFE.top + radius, SAFE.bottom - radius);
      reserveBox({ bottom: cy + radius, left: cx - radius, right: cx + radius, top: cy - radius }, occupied);
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
      const width = Math.min(element.properties.width, SAFE.right - SAFE.left);
      const x = clamp(element.properties.x, SAFE.left, SAFE.right - width);
      const y = clamp(element.properties.y, SAFE.top, SAFE.bottom - 76);
      reserveBox({ bottom: y + 76, left: x, right: x + width, top: y }, occupied);
      return { ...element, properties: { ...element.properties, width, x, y } };
    }
    case "CREATE_LINE":
    case "CREATE_ARROW": {
      const sourceX1 = "x" in element.properties && element.properties.x !== undefined ? element.properties.x : element.properties.x1;
      const sourceY1 = "y" in element.properties && element.properties.y !== undefined ? element.properties.y : element.properties.y1;
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
      const points = element.properties.points.map((point) => ({ x: clamp(point.x, SAFE.left, SAFE.right), y: clamp(point.y, SAFE.top, SAFE.bottom) }));
      if (points.length > 0) {
        reserveBox({
          bottom: Math.max(...points.map((point) => point.y)),
          left: Math.min(...points.map((point) => point.x)),
          right: Math.max(...points.map((point) => point.x)),
          top: Math.min(...points.map((point) => point.y)),
        }, occupied);
      }
      return { ...element, properties: { ...element.properties, points } };
    }
  }
}

export function composeWhiteboardLayout(state: WhiteboardState): WhiteboardState {
  const occupied: Box[] = [];
  const elements = Object.fromEntries(state.order.flatMap((id) => {
    const element = state.elements[id];
    return element ? [[id, composeElement(element, occupied)]] : [];
  })) as Record<string, WhiteboardElement>;
  return { ...state, elements };
}
