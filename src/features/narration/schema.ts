import { z } from "zod";

import { generatedLessonSchema } from "@/features/lesson/schema";

export const cueTimingSchema = z.object({
  cueId: z.string().min(1).max(80),
  startSeconds: z.number().nonnegative(),
}).strict();

export const narrationRequestSchema = z.object({
  lesson: generatedLessonSchema,
}).strict();

export const narrationResponseSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.literal("audio/mpeg"),
  cueTimings: z.array(cueTimingSchema).min(1),
}).strict();

export type CueTiming = z.infer<typeof cueTimingSchema>;
export type NarrationResponse = z.infer<typeof narrationResponseSchema>;
