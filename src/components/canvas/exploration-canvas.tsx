"use client";

import { ArrowUpRight, Binary, Droplets, Leaf, LoaderCircle, Orbit, Sigma } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { lessonApiSuccessSchema } from "@/features/lesson/schema";
import { useLessonStore } from "@/features/lesson/store";

const CONCEPTS = [
  { eyebrow: "algorithm", icon: Binary, id: "binary", note: "halve · compare · repeat", position: "concept-binary", topic: "How binary search works" },
  { eyebrow: "calculus", icon: Sigma, id: "derivatives", note: "change at an instant", position: "concept-derivatives", topic: "Visualizing derivatives" },
  { eyebrow: "earth science", icon: Droplets, id: "water", note: "a continuous loop", position: "concept-water", topic: "The water cycle" },
  { eyebrow: "biology", icon: Leaf, id: "photo", note: "light becomes energy", position: "concept-photo", topic: "Photosynthesis" },
] as const;

export function ExplorationCanvas() {
  const topicId = useId();
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const status = useLessonStore((state) => state.status);
  const error = useLessonStore((state) => state.error);
  const beginValidation = useLessonStore((state) => state.beginValidation);
  const beginGeneration = useLessonStore((state) => state.beginGeneration);
  const completeGeneration = useLessonStore((state) => state.completeGeneration);
  const failGeneration = useLessonStore((state) => state.failGeneration);
  const setValidationError = useLessonStore((state) => state.setValidationError);
  const isLoading = status === "validating" || status === "generating";

  useEffect(() => () => activeRequest.current?.abort(), []);

  function chooseConcept(id: string, nextTopic: string) {
    setSelected(id);
    setTopic(nextTopic);
    window.setTimeout(() => document.getElementById(topicId)?.focus(), 180);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const normalizedTopic = topic.trim();
    if (normalizedTopic.length < 2) {
      setValidationError("Give Chalk a topic with at least two characters.");
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
        const message = typeof data === "object" && data !== null && "error" in data
          ? (data as { error?: { message?: string } }).error?.message
          : undefined;
        throw new Error(message ?? "The lesson could not be created.");
      }
      const parsed = lessonApiSuccessSchema.safeParse(data);
      if (!parsed.success) throw new Error("The server returned an invalid lesson. Please retry.");
      completeGeneration(requestId, parsed.data.lesson);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      failGeneration(requestId, requestError instanceof Error ? requestError.message : "The lesson could not be created.");
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  return (
    <main className={`exploration-shell ${isLoading ? "is-mapping" : ""}`}>
      <aside className="studio-rail" aria-label="Chalk studio identity">
        <a className="studio-mark" href="#canvas" aria-label="Chalk home"><Orbit aria-hidden="true" size={22} /></a>
        <div className="studio-wordmark">CHALK / VISUAL STUDIO</div>
        <span className="studio-index">01—EXPLORE</span>
      </aside>

      <section className="idea-canvas" id="canvas" aria-labelledby="canvas-title">
        <header className="canvas-intro">
          <p>AI learning canvas · voice + diagrams</p>
          <h1 id="canvas-title">Pick up an idea.<br />Move through it.</h1>
        </header>

        <svg className="concept-wires" aria-hidden="true" viewBox="0 0 1200 760" preserveAspectRatio="none">
          <path d="M185 515 C330 410 400 170 625 155" />
          <path d="M185 515 C390 520 600 430 850 330" />
          <path d="M185 515 C390 650 720 650 1010 565" />
          <path d="M625 155 C780 160 870 240 850 330" />
          <path d="M850 330 C930 390 970 470 1010 565" />
        </svg>

        <div className="concept-field" aria-label="Example ideas to explore">
          {CONCEPTS.map(({ eyebrow, icon: Icon, id, note, position, topic: conceptTopic }, index) => (
            <button
              aria-pressed={selected === id}
              className={`concept-object ${position} ${selected === id ? "is-selected" : ""}`}
              key={id}
              onClick={() => chooseConcept(id, conceptTopic)}
              style={{ "--concept-delay": `${index * 110}ms` } as React.CSSProperties}
              type="button"
            >
              <span className="concept-icon"><Icon aria-hidden="true" size={20} /></span>
              <span className="concept-copy"><small>{eyebrow}</small><strong>{conceptTopic}</strong><em>{note}</em></span>
              <span className="concept-plus" aria-hidden="true">+</span>
            </button>
          ))}
        </div>

        <form className="canvas-prompt" onSubmit={handleSubmit}>
          <span className="prompt-number">01</span>
          <div className="prompt-body">
            <label htmlFor={topicId}>What should we make visible?</label>
            <textarea
              autoComplete="off"
              id={topicId}
              maxLength={160}
              onChange={(event) => { setTopic(event.target.value); setSelected(null); }}
              placeholder="Type a topic, question, or difficult idea…"
              rows={2}
              value={topic}
            />
            <p aria-live="polite" className={status === "error" ? "prompt-error" : "prompt-status"} role={status === "error" ? "alert" : "status"}>
              {status === "error" ? error : isLoading ? "Building a visual path through your idea…" : "Choose a concept above, or begin with your own."}
            </p>
          </div>
          <button aria-label="Build visual lesson" className="prompt-launch" disabled={isLoading} type="submit">
            {isLoading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={24} /> : <ArrowUpRight aria-hidden="true" size={25} />}
            <span>{isLoading ? "Mapping" : "Build lesson"}</span>
          </button>
        </form>

        <div className="canvas-legend" aria-hidden="true"><span /> click an idea <span /> follow the connection <span /> learn by seeing</div>

        {isLoading ? (
          <div className="mapping-overlay" role="status">
            <div className="mapping-orbit"><span /><span /><span /></div>
            <p>Composing your lesson</p>
            <ol><li>mapping the concept</li><li>writing the voice</li><li>staging the canvas</li></ol>
          </div>
        ) : null}
      </section>
    </main>
  );
}
