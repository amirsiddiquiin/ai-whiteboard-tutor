"use client";

import { ArrowUpRight, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { lessonApiSuccessSchema } from "@/features/lesson/schema";
import { useLessonStore } from "@/features/lesson/store";

const EXAMPLE_TOPICS = [
  "How binary search works",
  "Why do eclipses happen?",
  "Explain derivatives visually",
];

export function TopicComposer() {
  const topicId = useId();
  const [topic, setTopic] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const status = useLessonStore((state) => state.status);
  const error = useLessonStore((state) => state.error);
  const beginValidation = useLessonStore((state) => state.beginValidation);
  const beginGeneration = useLessonStore((state) => state.beginGeneration);
  const completeGeneration = useLessonStore((state) => state.completeGeneration);
  const failGeneration = useLessonStore((state) => state.failGeneration);
  const setValidationError = useLessonStore((state) => state.setValidationError);
  const isLoading = status === "validating" || status === "generating";

  useEffect(() => {
    return () => activeRequest.current?.abort();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const normalizedTopic = topic.trim();
    if (normalizedTopic.length < 2) {
      setValidationError("Enter a topic with at least two characters.");
      return;
    }

    const requestId = crypto.randomUUID();
    beginValidation(requestId);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    beginGeneration(requestId);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: normalizedTopic }),
        signal: controller.signal,
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? (data as { error?: { message?: string } }).error?.message
            : undefined;
        throw new Error(message ?? "The lesson could not be created.");
      }

      const parsed = lessonApiSuccessSchema.safeParse(data);
      if (!parsed.success) throw new Error("The server returned an invalid lesson. Please retry.");
      completeGeneration(requestId, parsed.data.lesson);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      failGeneration(
        requestId,
        error instanceof Error ? error.message : "The lesson could not be created.",
      );
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  return (
    <div className="w-full max-w-[650px]">
      <form
        className="rounded-[24px] border border-white/10 bg-[#11151d] p-2.5 shadow-[0_22px_65px_rgba(0,0,0,0.32)]"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor={topicId}>
          What would you like to learn?
        </label>
        <textarea
          id={topicId}
          className="min-h-24 w-full resize-none rounded-[18px] bg-transparent px-3.5 py-3.5 text-base font-medium leading-7 text-white outline-none placeholder:text-white/30"
          maxLength={160}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="What would you like to understand today?"
          value={topic}
        />

        <div className="flex items-center justify-between gap-3 border-t border-white/8 px-1 pt-2.5">
          <div className="hidden items-center gap-2 px-2 text-[11px] font-bold text-white/45 sm:flex">
            <Sparkles aria-hidden="true" className="text-[#a995ff]" size={15} />
            AI lesson · voice · live visuals
          </div>
          <Button className="ml-auto min-w-40 bg-[var(--violet)] shadow-[0_8px_20px_rgba(104,80,220,0.24)] hover:bg-[var(--violet-dark)]" disabled={isLoading} type="submit">
            {isLoading ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
            ) : (
              <ArrowUpRight aria-hidden="true" size={17} />
            )}
            {status === "validating" ? "Checking…" : status === "generating" ? "Generating…" : "Create my lesson"}
          </Button>
        </div>
      </form>

      <p
        aria-live="polite"
        className={`mt-3 min-h-5 px-1 text-xs font-semibold ${status === "error" ? "text-[#ff9b91]" : "text-white/42"}`}
        role={status === "error" ? "alert" : "status"}
      >
        {status === "error"
          ? error
          : status === "generating"
            ? "Gemini is planning the narration and visual teaching steps…"
            : status === "success"
              ? "Lesson generated and validated successfully."
              : "Lessons are designed to take about two minutes."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Example lesson topics">
        {EXAMPLE_TOPICS.map((example) => (
          <button
            className="rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/52 transition-colors hover:border-[#8f79ff]/50 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a995ff]"
            key={example}
            onClick={() => {
              setTopic(example);
            }}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
