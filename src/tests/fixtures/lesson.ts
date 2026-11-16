import type { GeneratedLessonContent } from "@/features/lesson/schema";
import { parseAndHydrateLesson } from "@/features/lesson/validation";

const NARRATION = [
  "Start with a clear mental picture of the whole problem. We will place the important pieces on the board, name them carefully, and connect each visual step to the question we want to answer.",
  "Now focus on the first useful relationship. Notice how changing one part affects the nearby elements, while the labels keep our attention on the information that matters for this explanation.",
  "The next step builds on that relationship instead of starting over. We reuse the existing diagram, add one small change, and compare the new state with what we already understood before.",
  "Here is the central idea in action. The highlighted part shows where the decision happens, and the surrounding structure explains why that decision follows logically from the earlier visual evidence.",
  "We can test the idea with another quick pass through the diagram. Each move preserves the same rule, which is why the method remains reliable even when the specific values or labels change.",
  "To finish, connect the final result back to the original question. The visual sequence gives us both the answer and a repeatable way to reason through similar examples on our own.",
];

export function createValidLessonContent(): GeneratedLessonContent {
  return {
    title: "A Visual Guide to the Topic",
    learningObjective: "Build a clear mental model and apply the central reasoning step.",
    metadata: {
      difficulty: "beginner",
      audience: "curious general learner",
      keyTerms: ["structure", "relationship", "decision"],
    },
    segments: [
      {
        id: "segment-foundation",
        title: "Build the foundation",
        cues: [
          {
            id: "cue-overview",
            narration: NARRATION[0],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-title",
              order: 0,
              type: "CREATE_TEXT",
              elementId: "topic-title",
              properties: { x: 80, y: 80, text: "The core idea", color: "ink", size: "lg", weight: "bold" },
            }],
          },
          {
            id: "cue-relationship",
            narration: NARRATION[1],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-box",
              order: 0,
              type: "CREATE_RECTANGLE",
              elementId: "concept-box",
              properties: { x: 160, y: 180, width: 280, height: 150, label: "Starting state", color: "blue" },
            }],
          },
        ],
      },
      {
        id: "segment-reasoning",
        title: "Follow the reasoning",
        cues: [
          {
            id: "cue-build",
            narration: NARRATION[2],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-arrow",
              order: 0,
              type: "CREATE_ARROW",
              elementId: "reasoning-arrow",
              properties: { x1: 440, y1: 255, x2: 620, y2: 255, color: "violet", label: "leads to" },
            }],
          },
          {
            id: "cue-decision",
            narration: NARRATION[3],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-highlight",
              order: 0,
              type: "HIGHLIGHT_ELEMENT",
              targetId: "concept-box",
              properties: { active: true, color: "amber" },
            }],
          },
        ],
      },
      {
        id: "segment-apply",
        title: "Apply and remember",
        cues: [
          {
            id: "cue-test",
            narration: NARRATION[4],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-result",
              order: 0,
              type: "CREATE_CIRCLE",
              elementId: "result-node",
              properties: { cx: 760, cy: 255, radius: 90, label: "Result", color: "teal" },
            }],
          },
          {
            id: "cue-summary",
            narration: NARRATION[5],
            estimatedDurationSeconds: 15,
            actions: [{
              actionId: "action-summary",
              order: 0,
              type: "CREATE_TEXT",
              elementId: "summary-label",
              properties: {
                x: 290,
                y: 480,
                text: "See the structure → make the decision",
                color: "violet",
                size: "md",
                weight: "bold",
              },
            }],
          },
        ],
      },
    ],
  };
}

export function createValidLesson(topic = "Binary search") {
  return parseAndHydrateLesson(JSON.stringify(createValidLessonContent()), topic);
}
