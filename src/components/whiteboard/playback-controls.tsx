import { Pause, Play, Redo2, RotateCcw } from "lucide-react";

import type { PlaybackStatus } from "@/features/whiteboard/playback";

export function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

export interface PlaybackControlsProps {
  currentTime: number;
  disabled?: boolean;
  duration: number;
  status: PlaybackStatus;
  onPause: () => void;
  onPlay: () => void;
  onReplay: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
}

export function PlaybackControls({
  currentTime,
  disabled = false,
  duration,
  status,
  onPause,
  onPlay,
  onReplay,
  onRestart,
  onSeek,
}: PlaybackControlsProps) {
  const isPlaying = status === "playing";
  const isEnded = status === "ended";

  return (
    <div className="rounded-2xl border border-white/80 bg-white/88 p-3 shadow-[0_12px_35px_rgba(54,46,91,0.09)] backdrop-blur-lg sm:p-4">
      <label className="sr-only" htmlFor="lesson-timeline">Seek through lesson</label>
      <input
        aria-valuetext={`${formatPlaybackTime(currentTime)} of ${formatPlaybackTime(duration)}`}
        className="lesson-range w-full"
        disabled={disabled}
        id="lesson-timeline"
        max={duration}
        min="0"
        onChange={(event) => onSeek(Number(event.target.value))}
        step="0.1"
        type="range"
        value={Math.min(currentTime, duration)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          aria-label={isPlaying ? "Pause lesson" : isEnded ? "Replay lesson" : "Play lesson"}
          className="inline-flex h-11 min-w-28 items-center justify-center gap-2 rounded-xl bg-[var(--violet)] px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(115,87,232,0.28)] transition hover:bg-[var(--violet-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled}
          onClick={isPlaying ? onPause : isEnded ? onReplay : onPlay}
          type="button"
        >
          {isPlaying ? <Pause aria-hidden="true" size={17} /> : isEnded ? <Redo2 aria-hidden="true" size={17} /> : <Play aria-hidden="true" size={17} />}
          {isPlaying ? "Pause" : isEnded ? "Replay" : status === "paused" && currentTime > 0 ? "Resume" : "Play"}
        </button>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-bold text-[var(--muted)] transition hover:border-[var(--violet-soft)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={disabled}
          onClick={onRestart}
          type="button"
        >
          <RotateCcw aria-hidden="true" size={16} /> Restart
        </button>

        <output className="ml-auto rounded-lg bg-[var(--paper)] px-3 py-2 font-mono text-xs font-bold text-[var(--muted)]" htmlFor="lesson-timeline">
          {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
        </output>
      </div>
    </div>
  );
}
