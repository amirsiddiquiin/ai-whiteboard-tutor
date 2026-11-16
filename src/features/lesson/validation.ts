import {
  generatedLessonContentSchema,
  generatedLessonSchema,
  type GeneratedLesson,
  type GeneratedLessonContent,
  type WhiteboardAction,
} from "./schema";

export class InvalidGeneratedLessonError extends Error {
  constructor(message: string, readonly issues: string[]) {
    super(message);
    this.name = "InvalidGeneratedLessonError";
  }
}

function isCreateAction(
  action: WhiteboardAction,
): action is Extract<WhiteboardAction, { elementId: string }> {
  return "elementId" in action;
}

function isReferenceAction(
  action: WhiteboardAction,
): action is Extract<WhiteboardAction, { targetId: string }> {
  return "targetId" in action;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function targetExists(
  targetId: string,
  activeElements: Set<string>,
  arrayLengths: Map<string, number>,
) {
  if (activeElements.has(targetId)) return true;
  const match = targetId.match(/^([a-z][a-z0-9-]*):(\d+)$/);
  if (!match) return false;

  const [, parentId, rawIndex] = match;
  const length = arrayLengths.get(parentId);
  return activeElements.has(parentId) && length !== undefined && Number(rawIndex) < length;
}

function validateCreateBounds(action: Extract<WhiteboardAction, { elementId: string }>) {
  switch (action.type) {
    case "CREATE_RECTANGLE":
      return action.properties.x + action.properties.width <= 1000 &&
        action.properties.y + action.properties.height <= 600;
    case "CREATE_ARRAY":
      return action.properties.x + action.properties.width <= 1000;
    case "CREATE_CIRCLE":
      return action.properties.cx - action.properties.radius >= 0 &&
        action.properties.cx + action.properties.radius <= 1000 &&
        action.properties.cy - action.properties.radius >= 0 &&
        action.properties.cy + action.properties.radius <= 600;
    default:
      return true;
  }
}

export function validateLessonSemantics(content: GeneratedLessonContent) {
  const issues: string[] = [];
  const stableIds = new Set<string>();
  const actionIds = new Set<string>();
  const definedElements = new Set<string>();
  const activeElements = new Set<string>();
  const arrayLengths = new Map<string, number>();

  for (const segment of content.segments) {
    if (stableIds.has(segment.id)) issues.push(`Duplicate segment ID: ${segment.id}`);
    stableIds.add(segment.id);

    for (const cue of segment.cues) {
      if (stableIds.has(cue.id)) issues.push(`Duplicate cue ID: ${cue.id}`);
      stableIds.add(cue.id);

      const orders = new Set<number>();
      const orderedActions = [...cue.actions].sort((left, right) => left.order - right.order);
      for (const action of orderedActions) {
        if (actionIds.has(action.actionId)) issues.push(`Duplicate action ID: ${action.actionId}`);
        actionIds.add(action.actionId);
        if (orders.has(action.order)) issues.push(`Duplicate action order ${action.order} in cue ${cue.id}`);
        orders.add(action.order);

        if (action.type === "CLEAR_WHITEBOARD") {
          activeElements.clear();
          arrayLengths.clear();
          continue;
        }

        if (isReferenceAction(action)) {
          if (!targetExists(action.targetId, activeElements, arrayLengths)) {
            issues.push(`${action.type} references missing element: ${action.targetId}`);
          }
          if (action.type === "REMOVE_ELEMENT") activeElements.delete(action.targetId);
          continue;
        }

        if (isCreateAction(action)) {
          if (definedElements.has(action.elementId)) issues.push(`Element ID is reused: ${action.elementId}`);
          if (!validateCreateBounds(action)) issues.push(`${action.elementId} extends outside the whiteboard.`);
          definedElements.add(action.elementId);
          activeElements.add(action.elementId);
          if (action.type === "CREATE_ARRAY") {
            arrayLengths.set(action.elementId, action.properties.values.length);
          }
        }
      }
    }
  }

  const narration = content.segments.flatMap((segment) => segment.cues).map((cue) => cue.narration).join(" ");
  const wordCount = countWords(narration);
  const estimatedDurationSeconds = content.segments
    .flatMap((segment) => segment.cues)
    .reduce((duration, cue) => duration + cue.estimatedDurationSeconds, 0);
  if (wordCount < 180 || wordCount > 360) {
    issues.push(`Narration must contain 180–360 words; received ${wordCount}.`);
  }
  if (estimatedDurationSeconds < 60 || estimatedDurationSeconds > 180) {
    issues.push(
      `Estimated duration must be 60–180 seconds; received ${estimatedDurationSeconds}.`,
    );
  }

  if (issues.length > 0) {
    throw new InvalidGeneratedLessonError("Generated lesson failed semantic validation.", issues);
  }

  return { wordCount };
}

export function parseAndHydrateLesson(raw: string, topic: string): GeneratedLesson {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidGeneratedLessonError("Gemini returned invalid JSON.", ["Response was not valid JSON."]);
  }

  const parsed = generatedLessonContentSchema.safeParse(json);
  if (!parsed.success) {
    throw new InvalidGeneratedLessonError(
      "Gemini returned a lesson that does not match the required schema.",
      parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  const { wordCount } = validateLessonSemantics(parsed.data);
  const segments = parsed.data.segments.map((segment) => ({
    ...segment,
    cues: segment.cues.map((cue) => ({
      ...cue,
      actions: [...cue.actions].sort((left, right) => left.order - right.order),
    })),
    narration: segment.cues.map((cue) => cue.narration).join(" "),
    estimatedDurationSeconds: segment.cues.reduce(
      (duration, cue) => duration + cue.estimatedDurationSeconds,
      0,
    ),
  }));
  const estimatedDurationSeconds = segments.reduce(
    (duration, segment) => duration + segment.estimatedDurationSeconds,
    0,
  );

  return generatedLessonSchema.parse({
    id: crypto.randomUUID(),
    topic,
    title: parsed.data.title,
    learningObjective: parsed.data.learningObjective,
    estimatedDurationSeconds,
    segments,
    metadata: { ...parsed.data.metadata, wordCount, timing: "estimated" },
  });
}
