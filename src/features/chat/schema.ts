import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1_500),
});

export const chatRequestSchema = z.object({
  lessonId: z.string().min(1).max(100),
  topic: z.string().min(2).max(160),
  learningObjective: z.string().min(10).max(240),
  currentCueId: z.string().max(80).optional(),
  currentCueText: z.string().max(1_500).optional(),
  messages: z.array(chatMessageSchema).min(1).max(12),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
