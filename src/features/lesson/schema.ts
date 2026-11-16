import { z } from "zod";

const stableId = z.string().min(1).max(80).regex(/^[a-z][a-z0-9-]*$/);
const coordinate = z.number().min(0).max(1000);
const verticalCoordinate = z.number().min(0).max(600);
const color = z.enum(["ink", "blue", "teal", "amber", "coral", "violet", "muted"]);

const actionBase = z.object({
  actionId: stableId,
  order: z.number().int().min(0).max(7),
});

const createTextAction = actionBase.extend({
  type: z.literal("CREATE_TEXT"),
  elementId: stableId,
  properties: z.object({
    x: coordinate,
    y: verticalCoordinate,
    text: z.string().min(1).max(160),
    color,
    size: z.enum(["sm", "md", "lg", "xl"]),
    weight: z.enum(["normal", "medium", "bold"]),
  }).strict(),
});

const createRectangleAction = actionBase.extend({
  type: z.literal("CREATE_RECTANGLE"),
  elementId: stableId,
  properties: z.object({
    x: coordinate,
    y: verticalCoordinate,
    width: z.number().positive().max(1000),
    height: z.number().positive().max(600),
    label: z.string().max(80).optional(),
    color,
  }).strict(),
});

const createCircleAction = actionBase.extend({
  type: z.literal("CREATE_CIRCLE"),
  elementId: stableId,
  properties: z.object({
    cx: coordinate,
    cy: verticalCoordinate,
    radius: z.number().positive().max(300),
    label: z.string().max(80).optional(),
    color,
  }).strict(),
});

function createConnectorAction<T extends "CREATE_LINE" | "CREATE_ARROW">(type: T) {
  return actionBase.extend({
    type: z.literal(type),
    elementId: stableId,
    properties: z.object({
      x1: coordinate,
      y1: verticalCoordinate,
      x2: coordinate,
      y2: verticalCoordinate,
      color,
      label: z.string().max(80).optional(),
    }).strict(),
  });
}

const createArrayAction = actionBase.extend({
  type: z.literal("CREATE_ARRAY"),
  elementId: stableId,
  properties: z.object({
    x: coordinate,
    y: verticalCoordinate,
    width: z.number().positive().max(1000),
    values: z.array(z.string().min(1).max(20)).min(2).max(12),
    color,
  }).strict(),
});

const createEquationAction = actionBase.extend({
  type: z.literal("CREATE_EQUATION"),
  elementId: stableId,
  properties: z.object({
    x: coordinate,
    y: verticalCoordinate,
    expression: z.string().min(1).max(120),
    color,
  }).strict(),
});

const updateElementProperties = z.object({
  x: coordinate.optional(),
  y: verticalCoordinate.optional(),
  text: z.string().min(1).max(160).optional(),
  label: z.string().max(80).optional(),
  expression: z.string().min(1).max(120).optional(),
  color: color.optional(),
  opacity: z.number().min(0).max(1).optional(),
}).strict().refine((properties) => Object.keys(properties).length > 0);

const updateElementAction = actionBase.extend({
  type: z.literal("UPDATE_ELEMENT"),
  targetId: z.string().min(1).max(84),
  properties: updateElementProperties,
});

const highlightElementAction = actionBase.extend({
  type: z.literal("HIGHLIGHT_ELEMENT"),
  targetId: z.string().min(1).max(84),
  properties: z.object({ active: z.boolean(), color }).strict(),
});

const removeElementAction = actionBase.extend({
  type: z.literal("REMOVE_ELEMENT"),
  targetId: z.string().min(1).max(84),
  properties: z.object({}).strict(),
});

const clearWhiteboardAction = actionBase.extend({
  type: z.literal("CLEAR_WHITEBOARD"),
  properties: z.object({}).strict(),
});

export const whiteboardActionSchema = z.discriminatedUnion("type", [
  createTextAction,
  createRectangleAction,
  createCircleAction,
  createConnectorAction("CREATE_LINE"),
  createConnectorAction("CREATE_ARROW"),
  createArrayAction,
  createEquationAction,
  updateElementAction,
  highlightElementAction,
  removeElementAction,
  clearWhiteboardAction,
]);

export const lessonCueSchema = z.object({
  id: stableId,
  narration: z.string().min(10).max(500),
  estimatedDurationSeconds: z.number().int().min(3).max(30),
  actions: z.array(whiteboardActionSchema).min(1).max(8),
}).strict();

export const generatedLessonContentSchema = z.object({
  title: z.string().min(3).max(120),
  learningObjective: z.string().min(10).max(240),
  segments: z.array(z.object({
    id: stableId,
    title: z.string().min(1).max(100),
    cues: z.array(lessonCueSchema).min(1).max(6),
  }).strict()).min(3).max(7),
  metadata: z.object({
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    audience: z.string().min(2).max(80),
    keyTerms: z.array(z.string().min(1).max(40)).max(10),
  }).strict().optional(),
}).strict();

export const lessonSegmentSchema = z.object({
  id: stableId,
  title: z.string().min(1).max(100),
  narration: z.string().min(10).max(2_400),
  estimatedDurationSeconds: z.number().int().min(3).max(180),
  cues: z.array(lessonCueSchema).min(1).max(6),
}).strict();

export const generatedLessonSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(2).max(160),
  title: z.string().min(3).max(120),
  learningObjective: z.string().min(10).max(240),
  estimatedDurationSeconds: z.number().int().min(30).max(240),
  segments: z.array(lessonSegmentSchema).min(3).max(7),
  metadata: z.object({
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    audience: z.string().min(2).max(80).optional(),
    keyTerms: z.array(z.string().min(1).max(40)).max(10).optional(),
    wordCount: z.number().int().positive(),
    timing: z.literal("estimated"),
  }).strict(),
}).strict();

export const lessonApiSuccessSchema = z.object({ lesson: generatedLessonSchema }).strict();

export const createLessonRequestSchema = z.object({
  topic: z.string().trim().min(2).max(160),
}).strict();

export type WhiteboardAction = z.infer<typeof whiteboardActionSchema>;
export type LessonCue = z.infer<typeof lessonCueSchema>;
export type GeneratedLessonContent = z.infer<typeof generatedLessonContentSchema>;
export type GeneratedLesson = z.infer<typeof generatedLessonSchema>;
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;
