"use client";

import { ExplorationCanvas } from "@/components/canvas/exploration-canvas";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { useLessonStore } from "@/features/lesson/store";

export function LearningExperience() {
  const lesson = useLessonStore((state) => state.lesson);
  const status = useLessonStore((state) => state.status);
  return status === "success" && lesson ? <LessonPlayer /> : <ExplorationCanvas />;
}
