import type { WhiteboardAction } from "@/features/lesson/schema";

export type CreateWhiteboardAction = Extract<WhiteboardAction, { elementId: string }>;
export type WhiteboardColor = CreateWhiteboardAction["properties"]["color"];
export type ElementUpdate = Extract<WhiteboardAction, { type: "UPDATE_ELEMENT" }>["properties"];

export interface HighlightState {
  active: boolean;
  color: WhiteboardColor;
}

type ActionElement<Action extends CreateWhiteboardAction> = Action extends CreateWhiteboardAction
  ? {
      id: string;
      type: Action["type"];
      properties: Action["properties"] & ElementUpdate;
    }
  : never;

export type WhiteboardElement = ActionElement<CreateWhiteboardAction>;

export interface WhiteboardState {
  elements: Record<string, WhiteboardElement>;
  order: string[];
  highlights: Record<string, HighlightState>;
  hiddenTargets: string[];
  targetUpdates: Record<string, ElementUpdate>;
}

export const EMPTY_WHITEBOARD_STATE: WhiteboardState = {
  elements: {},
  order: [],
  highlights: {},
  hiddenTargets: [],
  targetUpdates: {},
};

function arrayTarget(targetId: string) {
  const match = targetId.match(/^([a-z][a-z0-9-]*):(\d+)$/);
  if (!match) return null;
  return { parentId: match[1], index: Number(match[2]) };
}

export function targetExists(state: WhiteboardState, targetId: string) {
  if (state.elements[targetId]) return true;
  const target = arrayTarget(targetId);
  if (!target) return false;
  const parent = state.elements[target.parentId];
  return parent?.type === "CREATE_ARRAY" && target.index < parent.properties.values.length;
}

function removeTargetRecords<T>(records: Record<string, T>, targetId: string) {
  return Object.fromEntries(
    Object.entries(records).filter(([key]) => key !== targetId && !key.startsWith(`${targetId}:`)),
  );
}

export function applyWhiteboardAction(
  state: WhiteboardState,
  action: WhiteboardAction,
): WhiteboardState {
  if (action.type === "CLEAR_WHITEBOARD") return EMPTY_WHITEBOARD_STATE;

  if ("elementId" in action) {
    if (state.elements[action.elementId]) return state;
    return {
      ...state,
      elements: {
        ...state.elements,
        [action.elementId]: {
          id: action.elementId,
          type: action.type,
          properties: action.properties,
        } as WhiteboardElement,
      },
      order: [...state.order, action.elementId],
    };
  }

  if (!("targetId" in action) || !targetExists(state, action.targetId)) return state;

  if (action.type === "HIGHLIGHT_ELEMENT") {
    return {
      ...state,
      highlights: { ...state.highlights, [action.targetId]: action.properties },
    };
  }

  if (action.type === "UPDATE_ELEMENT") {
    const element = state.elements[action.targetId];
    if (element) {
      return {
        ...state,
        elements: {
          ...state.elements,
          [action.targetId]: {
            ...element,
            properties: { ...element.properties, ...action.properties },
          } as WhiteboardElement,
        },
      };
    }
    return {
      ...state,
      targetUpdates: {
        ...state.targetUpdates,
        [action.targetId]: { ...state.targetUpdates[action.targetId], ...action.properties },
      },
    };
  }

  const target = arrayTarget(action.targetId);
  if (target) {
    return {
      ...state,
      hiddenTargets: state.hiddenTargets.includes(action.targetId)
        ? state.hiddenTargets
        : [...state.hiddenTargets, action.targetId],
      highlights: removeTargetRecords(state.highlights, action.targetId),
      targetUpdates: removeTargetRecords(state.targetUpdates, action.targetId),
    };
  }

  const elements = { ...state.elements };
  delete elements[action.targetId];
  return {
    elements,
    order: state.order.filter((id) => id !== action.targetId),
    highlights: removeTargetRecords(state.highlights, action.targetId),
    hiddenTargets: state.hiddenTargets.filter(
      (id) => id !== action.targetId && !id.startsWith(`${action.targetId}:`),
    ),
    targetUpdates: removeTargetRecords(state.targetUpdates, action.targetId),
  };
}

export function reduceWhiteboardActions(
  actions: readonly WhiteboardAction[],
  initialState: WhiteboardState = EMPTY_WHITEBOARD_STATE,
) {
  return actions.reduce(applyWhiteboardAction, initialState);
}
