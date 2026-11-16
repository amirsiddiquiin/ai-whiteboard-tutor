import { create } from "zustand";

import type { GeneratedLesson } from "./schema";

export type LessonGenerationStatus =
  | "idle"
  | "validating"
  | "generating"
  | "success"
  | "error";

interface LessonState {
  activeRequestId: string | null;
  error: string | null;
  lesson: GeneratedLesson | null;
  status: LessonGenerationStatus;
  beginValidation: (requestId: string) => void;
  beginGeneration: (requestId: string) => void;
  completeGeneration: (requestId: string, lesson: GeneratedLesson) => void;
  failGeneration: (requestId: string, message: string) => void;
  setValidationError: (message: string) => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  activeRequestId: null,
  error: null,
  lesson: null,
  status: "idle",
  beginValidation: (requestId) =>
    set({ activeRequestId: requestId, error: null, status: "validating" }),
  beginGeneration: (requestId) =>
    set((state) =>
      state.activeRequestId === requestId ? { error: null, status: "generating" } : state,
    ),
  completeGeneration: (requestId, lesson) =>
    set((state) =>
      state.activeRequestId === requestId
        ? { activeRequestId: null, error: null, lesson, status: "success" }
        : state,
    ),
  failGeneration: (requestId, message) =>
    set((state) =>
      state.activeRequestId === requestId
        ? { activeRequestId: null, error: message, status: "error" }
        : state,
    ),
  setValidationError: (message) =>
    set({ activeRequestId: null, error: message, status: "error" }),
}));
