"use client";

import { ArrowLeft, ArrowUp, LoaderCircle, MessageCircle, Orbit, PanelRightClose, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { PlaybackControls, type PlaybackChapter } from "@/components/whiteboard/playback-controls";
import { WhiteboardRenderer } from "@/components/whiteboard/whiteboard-renderer";
import type { GeneratedLesson } from "@/features/lesson/schema";
import { useLessonStore } from "@/features/lesson/store";
import { useNarrationAudio } from "@/features/narration/client";
import { createPlaybackState, playbackReducer } from "@/features/whiteboard/playback";
import { buildAudioTimeline, buildLessonTimeline, getCueAtTime, getWhiteboardStateAtTime } from "@/features/whiteboard/timeline";

interface ChatMessage { content: string; role: "user" | "assistant" }

function ContextSheet({ chapters, cue, cueIndex, lesson, onClose, onSeek }: {
  chapters: PlaybackChapter[];
  cue: ReturnType<typeof getCueAtTime>;
  cueIndex: number;
  lesson: GeneratedLesson;
  onClose: () => void;
  onSeek: (time: number) => void;
}) {
  const [tab, setTab] = useState<"notes" | "ask">("notes");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function askChalk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setQuestion("");
    setSending(true);
    setChatError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          topic: lesson.topic,
          learningObjective: lesson.learningObjective,
          currentCueId: cue?.cueId,
          currentCueText: cue?.narration,
          messages: nextMessages,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(typeof data === "object" && data !== null && "error" in data ? (data as { error?: { message?: string } }).error?.message : "Chalk could not answer right now.");
      if (typeof data !== "object" || data === null || !("message" in data) || typeof (data as { message?: unknown }).message !== "string") throw new Error("Chalk returned an invalid response.");
      setMessages((current) => [...current, { role: "assistant", content: (data as { message: string }).message }]);
    } catch (requestError) {
      setChatError(requestError instanceof Error ? requestError.message : "Chalk could not answer right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside aria-label="Lesson notes" className="context-sheet">
      <div className="context-head"><strong>Alongside the lesson</strong><button aria-label="Close lesson context" onClick={onClose} type="button"><PanelRightClose aria-hidden="true" size={18} /></button></div>
      <div className="context-tabs" role="tablist"><button aria-selected={tab === "notes"} className={tab === "notes" ? "is-active" : ""} onClick={() => setTab("notes")} role="tab" type="button">Teaching notes</button><button aria-selected={tab === "ask"} className={tab === "ask" ? "is-active" : ""} onClick={() => setTab("ask")} role="tab" type="button">Ask Chalk</button></div>
      <div className="context-body">
        {tab === "notes" ? (
          <><small className="font-black uppercase tracking-[.13em] text-[var(--tomato)]">Cue {cueIndex + 1} of {chapters.length * 2}</small><h3>{cue?.segmentTitle ?? "Lesson overview"}</h3><p>{cue?.narration ?? lesson.learningObjective}</p><ol className="outline-list">{chapters.map((chapter, index) => <li key={chapter.id}><button onClick={() => onSeek(chapter.startSeconds)} type="button"><small>0{index + 1}</small><strong>{chapter.label}</strong></button></li>)}</ol></>
        ) : (
          <div className="ask-empty">
            <div>
              {messages.length === 0 ? <blockquote>“Pause anywhere and ask about the idea on screen.”</blockquote> : messages.map((message, index) => <div className={`mb-3 border-l-2 p-3 text-sm leading-6 ${message.role === "assistant" ? "border-[var(--cobalt)] bg-[#edf1fb]" : "border-[var(--tomato)] bg-[#f7e8e3]"}`} key={`${message.role}-${index}`}>{message.content}</div>)}
              {chatError ? <p role="alert" className="text-xs font-bold text-[#a13c2e]">{chatError}</p> : null}
            </div>
            <form className="ask-form" onSubmit={askChalk}><label className="sr-only" htmlFor="follow-up-question">Ask a follow-up question</label><textarea id="follow-up-question" maxLength={1500} onChange={(event) => setQuestion(event.target.value)} placeholder="What is still unclear?" rows={3} value={question} /><button disabled={sending || !question.trim()} type="submit">{sending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={14} /> : <ArrowUp aria-hidden="true" size={14} />} Ask in context</button></form>
          </div>
        )}
      </div>
    </aside>
  );
}

function LessonPlayerSession({ lesson }: { lesson: GeneratedLesson }) {
  const playerRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const narration = useNarrationAudio(lesson);
  const resetLesson = useLessonStore((state) => state.resetLesson);
  const estimatedTimeline = useMemo(() => buildLessonTimeline(lesson), [lesson]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [bufferedUntil, setBufferedUntil] = useState(0);
  const [contextOpen, setContextOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [playback, dispatch] = useReducer(playbackReducer, 0, createPlaybackState);
  const timeline = useMemo(() => audioDuration === null ? estimatedTimeline : buildAudioTimeline(lesson, narration.cueTimings, audioDuration), [audioDuration, estimatedTimeline, lesson, narration.cueTimings]);
  const controlsReady = narration.status === "ready" && audioDuration !== null;
  const cue = getCueAtTime(timeline, playback.currentTime);
  const whiteboardState = useMemo(() => getWhiteboardStateAtTime(timeline, playback.currentTime), [playback.currentTime, timeline]);
  const cueIndex = cue ? timeline.cues.findIndex((item) => item.cueId === cue.cueId) : 0;
  const chapters = useMemo<PlaybackChapter[]>(() => lesson.segments.flatMap((segment) => {
    const firstCue = timeline.cues.find((candidate) => candidate.segmentId === segment.id);
    return firstCue ? [{ id: segment.id, label: segment.title, startSeconds: firstCue.startSeconds }] : [];
  }), [lesson.segments, timeline.cues]);

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

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    try {
      buildAudioTimeline(lesson, narration.cueTimings, audio.duration);
      audio.muted = isMuted; audio.playbackRate = playbackRate; audio.volume = volume;
      setAudioDuration(audio.duration); setPlaybackError(null); dispatch({ type: "LOAD_AUDIO", duration: audio.duration });
    } catch { setAudioDuration(null); setPlaybackError("Narration timing could not be reconstructed."); }
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio || !controlsReady) return;
    if (audio.ended || playback.status === "ended") audio.currentTime = 0;
    try { await audio.play(); setPlaybackError(null); } catch { dispatch({ type: "PAUSE" }); setPlaybackError("Your browser could not start narration."); }
  }
  function pause() { audioRef.current?.pause(); dispatch({ type: "PAUSE" }); }
  async function replay() { const audio = audioRef.current; if (!audio || !controlsReady) return; audio.currentTime = 0; dispatch({ type: "REPLAY" }); try { await audio.play(); } catch { dispatch({ type: "PAUSE" }); setPlaybackError("Your browser could not replay narration."); } }
  function restart() { const audio = audioRef.current; if (audio) { audio.pause(); audio.currentTime = 0; } dispatch({ type: "RESTART" }); }
  function seek(time: number) { const audio = audioRef.current; if (!audio || !controlsReady) return; const target = Math.min(Math.max(time, 0), audio.duration); audio.currentTime = target; dispatch({ type: "SEEK", time: target }); }
  function changeVolume(next: number) { const normalized = Math.min(Math.max(next, 0), 1); setVolume(normalized); setIsMuted(normalized === 0); if (audioRef.current) { audioRef.current.volume = normalized; audioRef.current.muted = normalized === 0; } }
  function toggleMute() { const next = !isMuted; setIsMuted(next); if (audioRef.current) audioRef.current.muted = next; }
  function changeRate(rate: number) { setPlaybackRate(rate); if (audioRef.current) audioRef.current.playbackRate = rate; }
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await playerRef.current?.requestFullscreen(); } catch { setPlaybackError("Fullscreen is unavailable in this browser window."); } }
  function handleKeyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (!controlsReady || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    if (event.key === " ") { event.preventDefault(); if (playback.status === "playing") pause(); else if (playback.status === "ended") void replay(); else void play(); }
    else if (event.key === "ArrowLeft" || key === "j") { event.preventDefault(); seek(playback.currentTime - (key === "j" ? 10 : 5)); }
    else if (event.key === "ArrowRight" || key === "l") { event.preventDefault(); seek(playback.currentTime + (key === "l" ? 10 : 5)); }
    else if (event.key === "Home") { event.preventDefault(); restart(); }
    else if (event.key === "End") { event.preventDefault(); seek(playback.duration); }
    else if (key === "m") { event.preventDefault(); toggleMute(); }
    else if (key === "f") { event.preventDefault(); void toggleFullscreen(); }
    else if (key === "t") { event.preventDefault(); setIsTheater((current) => !current); }
  }

  const playerDuration = audioDuration ?? estimatedTimeline.durationSeconds;
  const activeChapter = cue?.segmentId;

  return (
    <section className={`lesson-stage ${isTheater || isFullscreen ? "stage-expanded" : ""}`} onKeyDown={handleKeyboard} ref={playerRef} tabIndex={0}>
      <header className="lesson-topbar">
        <div className="lesson-brand"><span><Orbit aria-hidden="true" size={17} /></span>CHALK / STUDIO</div>
        <div className="lesson-title-block"><h1>{lesson.title}</h1><p>{narration.status === "ready" && audioDuration !== null ? "voice synchronized" : narration.status === "error" ? "voice unavailable" : "preparing voice"}</p></div>
        <button className="back-canvas" onClick={resetLesson} type="button"><ArrowLeft aria-hidden="true" size={15} /> New idea</button>
      </header>

      {narration.audioUrl ? <audio onEnded={() => dispatch({ type: "SET_TIME", time: playback.duration })} onError={() => { setAudioDuration(null); setPlaybackError("Narration audio could not be loaded."); }} onLoadedMetadata={handleLoadedMetadata} onPause={() => dispatch({ type: "PAUSE" })} onPlay={() => dispatch({ type: "PLAY" })} onProgress={(event) => { const audio = event.currentTarget; if (audio.buffered.length) setBufferedUntil(audio.buffered.end(audio.buffered.length - 1)); }} onTimeUpdate={(event) => dispatch({ type: "SET_TIME", time: event.currentTarget.currentTime })} preload="auto" ref={audioRef} src={narration.audioUrl} /> : null}

      <div className="teaching-workspace">
        <div className="board-surface">
          <nav className="chapter-rail" aria-label="Lesson chapters">{chapters.map((chapter, index) => <button className={`chapter-stop ${activeChapter === chapter.id ? "is-active" : ""}`} key={chapter.id} onClick={() => seek(chapter.startSeconds)} type="button"><small>Chapter 0{index + 1}</small><strong>{chapter.label}</strong></button>)}</nav>
          <div className="board-viewport"><WhiteboardRenderer cueLabel={cue?.segmentTitle} state={whiteboardState} title={lesson.title} /></div>
          <div aria-live="polite" className="cue-caption"><small><span className="sr-only">Cue {cueIndex + 1} of {timeline.cues.length}</span><span aria-hidden="true">Now teaching · {cue?.segmentTitle ?? "Lesson overview"}</span></small><p>{cue?.narration ?? lesson.learningObjective}</p></div>

          {narration.status === "loading" ? <div className="narration-notice" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={16} /><span><strong>Preparing voice</strong><small>The visual lesson is ready to explore.</small></span></div> : null}
          {narration.status === "error" ? <div className="narration-notice is-error" role="alert"><span><strong>Voice is unavailable</strong><small>{narration.error} You can still review the visual lesson.</small></span><button onClick={narration.retry} type="button"><RefreshCw aria-hidden="true" size={14} /> Retry voice</button></div> : null}
          {playbackError ? <div className="absolute right-6 top-20 z-30 max-w-sm border-l-4 border-[var(--tomato)] bg-[var(--paper)] p-3 text-xs font-bold shadow-md" role="alert">{playbackError}</div> : null}

          <PlaybackControls bufferedUntil={bufferedUntil} chapters={chapters} currentTime={playback.currentTime} disabled={!controlsReady} duration={playerDuration} isFullscreen={isFullscreen} isMuted={isMuted} isTheater={isTheater} notesOpen={contextOpen} onPause={pause} onPlay={() => void play()} onPlaybackRateChange={changeRate} onReplay={() => void replay()} onRestart={restart} onSeek={seek} onSeekBy={(seconds) => seek(playback.currentTime + seconds)} onToggleFullscreen={() => void toggleFullscreen()} onToggleMute={toggleMute} onToggleNotes={() => setContextOpen((current) => !current)} onToggleTheater={() => setIsTheater((current) => !current)} onVolumeChange={changeVolume} playbackRate={playbackRate} status={playback.status} volume={volume} />
        </div>

        {contextOpen ? <ContextSheet chapters={chapters} cue={cue} cueIndex={cueIndex} lesson={lesson} onClose={() => setContextOpen(false)} onSeek={seek} /> : null}
        {!contextOpen ? <button aria-label="Ask Chalk a follow-up question" className="absolute right-7 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-[var(--ink)] bg-[var(--lemon)] shadow-[4px_4px_0_var(--ink)]" onClick={() => setContextOpen(true)} type="button"><MessageCircle aria-hidden="true" size={18} /></button> : null}
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
