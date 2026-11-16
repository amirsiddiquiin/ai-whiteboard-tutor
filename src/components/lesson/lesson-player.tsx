"use client";

import { BookOpen, Clock3, Keyboard, Sparkles } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef } from "react";

import { PlaybackControls } from "@/components/whiteboard/playback-controls";
import { WhiteboardRenderer } from "@/components/whiteboard/whiteboard-renderer";
import type { GeneratedLesson } from "@/features/lesson/schema";
import { useLessonStore } from "@/features/lesson/store";
import { createPlaybackState, playbackReducer } from "@/features/whiteboard/playback";
import {
  buildLessonTimeline,
  cueProgress,
  getCueAtTime,
  getWhiteboardStateAtTime,
} from "@/features/whiteboard/timeline";

function LessonPlayerSession({ lesson }: { lesson: GeneratedLesson }) {
  const playerRef = useRef<HTMLElement>(null);
  const anchorTimeRef = useRef(0);
  const timeline = useMemo(() => buildLessonTimeline(lesson), [lesson]);
  const [playback, dispatch] = useReducer(
    playbackReducer,
    timeline.durationSeconds,
    createPlaybackState,
  );
  const cue = getCueAtTime(timeline, playback.currentTime);
  const whiteboardState = useMemo(
    () => getWhiteboardStateAtTime(timeline, playback.currentTime),
    [playback.currentTime, timeline],
  );
  const cueIndex = cue ? timeline.cues.findIndex((item) => item.cueId === cue.cueId) : -1;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playerRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (playback.status !== "playing") return;
    let frame = 0;

    const tick = (timestamp: number) => {
      const time = (timestamp - anchorTimeRef.current) / 1000;
      dispatch({ type: "SET_TIME", time });
      if (time < timeline.durationSeconds) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback.status, timeline.durationSeconds]);

  function play() {
    const startTime = playback.status === "ended" ? 0 : playback.currentTime;
    anchorTimeRef.current = performance.now() - startTime * 1000;
    dispatch({ type: "PLAY" });
  }

  function replay() {
    anchorTimeRef.current = performance.now();
    dispatch({ type: "REPLAY" });
  }

  function seek(time: number) {
    anchorTimeRef.current = performance.now() - time * 1000;
    dispatch({ type: "SEEK", time });
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === " ") {
      event.preventDefault();
      if (playback.status === "playing") dispatch({ type: "PAUSE" });
      else if (playback.status === "ended") replay();
      else play();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(playback.currentTime - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(playback.currentTime + 5);
    } else if (event.key === "Home") {
      event.preventDefault();
      dispatch({ type: "RESTART" });
    } else if (event.key === "End") {
      event.preventDefault();
      seek(timeline.durationSeconds);
    }
  }

  return (
    <section
      aria-labelledby="lesson-player-title"
      className="scroll-mt-5 px-5 pb-24 sm:px-8 lg:px-10"
      onKeyDown={handleKeyboard}
      ref={playerRef}
      tabIndex={0}
    >
      <div className="mx-auto max-w-[1180px] rounded-[34px] border border-white/90 bg-white/72 p-4 shadow-[0_28px_80px_rgba(62,52,103,0.14)] backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mint-wash)] px-3 py-1.5 text-[var(--mint-dark)]">
                <Sparkles aria-hidden="true" size={13} /> Interactive lesson
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1.5">
                <Clock3 aria-hidden="true" size={13} /> Visual clock · no audio yet
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1.5">
                <BookOpen aria-hidden="true" size={13} /> {lesson.segments.length} segments
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-[var(--ink)] sm:text-4xl" id="lesson-player-title">
              {lesson.title}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)] sm:text-base">
              {lesson.learningObjective}
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-[var(--paper)] px-3 py-2 text-[11px] font-bold text-[var(--muted)] md:flex">
            <Keyboard aria-hidden="true" size={15} /> Space · ← → · Home · End
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0">
            <WhiteboardRenderer state={whiteboardState} title={lesson.title} />
            <div className="mt-4">
              <PlaybackControls
                currentTime={playback.currentTime}
                duration={timeline.durationSeconds}
                onPause={() => dispatch({ type: "PAUSE" })}
                onPlay={play}
                onReplay={replay}
                onRestart={() => dispatch({ type: "RESTART" })}
                onSeek={seek}
                status={playback.status}
              />
            </div>
          </div>

          <aside className="flex min-h-0 flex-col rounded-[24px] border border-[var(--line-soft)] bg-[#fbfaf7] p-4 sm:p-5" aria-label="Current lesson narration">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[var(--violet-wash)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--violet-dark)]">
                {cue ? cue.segmentTitle : "Ready"}
              </span>
              <span className="text-[11px] font-bold text-[var(--muted)]">
                {cueIndex >= 0 ? `Cue ${cueIndex + 1} of ${timeline.cues.length}` : `${timeline.cues.length} cues`}
              </span>
            </div>

            <div aria-live="polite" className="mt-5 min-h-36">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coral-dark)]">Tutor cue</p>
              <p className="mt-2 text-base font-semibold leading-7 text-[var(--ink)]">
                {cue?.narration ?? "Press play to begin the visual explanation, or drag the timeline to explore."}
              </p>
            </div>

            <div className="mt-auto pt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--coral)] transition-[width] duration-150"
                  style={{ width: `${cueProgress(cue, playback.currentTime) * 100}%` }}
                />
              </div>
              <ol className="mt-5 space-y-2" aria-label="Lesson segments">
                {lesson.segments.map((segment, index) => {
                  const active = cue?.segmentId === segment.id;
                  return (
                    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)]"}`} key={segment.id}>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] ${active ? "bg-[var(--violet)] text-white" : "bg-[var(--line-soft)]"}`}>
                        {index + 1}
                      </span>
                      <span className="line-clamp-2">{segment.title}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function LessonPlayer() {
  const lesson = useLessonStore((state) => state.lesson);
  const status = useLessonStore((state) => state.status);
  if (!lesson || status !== "success") return null;
  return <LessonPlayerSession key={lesson.id} lesson={lesson} />;
}
