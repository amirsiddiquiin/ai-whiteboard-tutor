"use client";

import {
  BookOpen,
  Keyboard,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PlaybackControls } from "@/components/whiteboard/playback-controls";
import { WhiteboardRenderer } from "@/components/whiteboard/whiteboard-renderer";
import type { GeneratedLesson } from "@/features/lesson/schema";
import { useLessonStore } from "@/features/lesson/store";
import { useNarrationAudio } from "@/features/narration/client";
import { createPlaybackState, playbackReducer } from "@/features/whiteboard/playback";
import {
  buildAudioTimeline,
  buildLessonTimeline,
  cueProgress,
  getCueAtTime,
  getWhiteboardStateAtTime,
} from "@/features/whiteboard/timeline";

function LessonPlayerSession({ lesson }: { lesson: GeneratedLesson }) {
  const playerRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const narration = useNarrationAudio(lesson);
  const estimatedTimeline = useMemo(() => buildLessonTimeline(lesson), [lesson]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playback, dispatch] = useReducer(playbackReducer, 0, createPlaybackState);
  const timeline = useMemo(
    () =>
      audioDuration === null
        ? estimatedTimeline
        : buildAudioTimeline(lesson, narration.cueTimings, audioDuration),
    [audioDuration, estimatedTimeline, lesson, narration.cueTimings],
  );
  const controlsReady = narration.status === "ready" && audioDuration !== null;
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
    audioRef.current?.pause();
  }, [narration.audioUrl]);

  useEffect(() => {
    if (playback.status !== "playing") return;
    let frame = 0;

    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      dispatch({ type: "SET_TIME", time: audio.currentTime });
      if (!audio.paused && !audio.ended) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback.status]);

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLAudioElement>) {
    const duration = event.currentTarget.duration;
    try {
      buildAudioTimeline(lesson, narration.cueTimings, duration);
      setAudioDuration(duration);
      setPlaybackError(null);
      dispatch({ type: "LOAD_AUDIO", duration });
    } catch {
      setAudioDuration(null);
      setPlaybackError("The narration timing data was invalid. Please regenerate the voice track.");
    }
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio || !controlsReady) return;
    if (audio.ended || playback.status === "ended") audio.currentTime = 0;
    setPlaybackError(null);
    try {
      await audio.play();
    } catch {
      dispatch({ type: "PAUSE" });
      setPlaybackError("Your browser could not start the narration. Try again or check autoplay permissions.");
    }
  }

  function pause() {
    audioRef.current?.pause();
    dispatch({ type: "PAUSE" });
  }

  async function replay() {
    const audio = audioRef.current;
    if (!audio || !controlsReady) return;
    audio.currentTime = 0;
    dispatch({ type: "REPLAY" });
    try {
      await audio.play();
    } catch {
      dispatch({ type: "PAUSE" });
      setPlaybackError("Your browser could not replay the narration.");
    }
  }

  function restart() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    dispatch({ type: "RESTART" });
  }

  function seek(time: number) {
    const audio = audioRef.current;
    if (!audio || !controlsReady) return;
    const target = Math.min(Math.max(time, 0), audio.duration);
    audio.currentTime = target;
    dispatch({ type: "SEEK", time: target });
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || !controlsReady) return;
    if (event.key === " ") {
      event.preventDefault();
      if (playback.status === "playing") pause();
      else if (playback.status === "ended") void replay();
      else void play();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(playback.currentTime - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(playback.currentTime + 5);
    } else if (event.key === "Home") {
      event.preventDefault();
      restart();
    } else if (event.key === "End") {
      event.preventDefault();
      seek(playback.duration);
    }
  }

  const audioBadge = narration.status === "loading"
    ? "Generating voice…"
    : narration.status === "error"
      ? "Voice needs attention"
      : audioDuration === null
        ? "Loading audio…"
        : "Audio synchronized";

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
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${narration.status === "error" || playbackError ? "bg-[var(--amber-wash)] text-[var(--amber-dark)]" : "bg-[var(--paper)]"}`}>
                {narration.status === "error" || playbackError ? <VolumeX aria-hidden="true" size={13} /> : <Volume2 aria-hidden="true" size={13} />}
                {audioBadge}
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

        {narration.audioUrl ? (
          <audio
            onEnded={() => dispatch({ type: "SET_TIME", time: playback.duration })}
            onError={() => {
              setAudioDuration(null);
              setPlaybackError("The narration audio could not be loaded.");
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onPause={() => dispatch({ type: "PAUSE" })}
            onPlay={() => dispatch({ type: "PLAY" })}
            onTimeUpdate={(event) => dispatch({ type: "SET_TIME", time: event.currentTarget.currentTime })}
            preload="auto"
            ref={audioRef}
            src={narration.audioUrl}
          />
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0">
            <WhiteboardRenderer state={whiteboardState} title={lesson.title} />

            {narration.status === "loading" ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--violet-soft)] bg-[var(--violet-wash)] px-4 py-3 text-sm font-bold text-[var(--violet-dark)]" role="status">
                <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                The voice service is generating narration and measured cue timing…
              </div>
            ) : null}

            {narration.status === "error" ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#f0c5a2] bg-[var(--amber-wash)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <div>
                  <p className="text-sm font-black text-[var(--amber-dark)]">Narration is unavailable</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{narration.error}</p>
                </div>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[var(--amber-dark)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]" onClick={narration.retry} type="button">
                  <RefreshCw aria-hidden="true" size={15} /> Retry voice
                </button>
              </div>
            ) : null}

            {playbackError ? (
              <div className="mt-4 rounded-2xl border border-[#f0c5a2] bg-[var(--amber-wash)] px-4 py-3 text-xs font-bold text-[var(--amber-dark)]" role="alert">
                {playbackError}
              </div>
            ) : null}

            <div className="mt-4">
              <PlaybackControls
                currentTime={playback.currentTime}
                disabled={!controlsReady}
                duration={audioDuration ?? estimatedTimeline.durationSeconds}
                onPause={pause}
                onPlay={() => void play()}
                onReplay={() => void replay()}
                onRestart={restart}
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
                {cue?.narration ?? "The visual lesson will follow the generated narration audio."}
              </p>
            </div>

            <div className="mt-auto pt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line-soft)]">
                <div className="h-full rounded-full bg-[var(--coral)] transition-[width] duration-150" style={{ width: `${cueProgress(cue, playback.currentTime) * 100}%` }} />
              </div>
              <ol className="mt-5 space-y-2" aria-label="Lesson segments">
                {lesson.segments.map((segment, index) => {
                  const active = cue?.segmentId === segment.id;
                  return (
                    <li className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? "bg-white text-[var(--ink)] shadow-sm" : "text-[var(--muted)]"}`} key={segment.id}>
                      <span className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] ${active ? "bg-[var(--violet)] text-white" : "bg-[var(--line-soft)]"}`}>{index + 1}</span>
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
