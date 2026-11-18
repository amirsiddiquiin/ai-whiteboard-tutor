import { BookOpenText, Expand, FastForward, Gauge, Maximize2, Minimize2, Pause, Play, Redo2, RefreshCcw, Rewind, Volume2, VolumeX } from "lucide-react";

import type { PlaybackStatus } from "@/features/whiteboard/playback";

export function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
}

export interface PlaybackChapter { id: string; label: string; startSeconds: number }

export interface PlaybackControlsProps {
  bufferedUntil?: number;
  chapters?: PlaybackChapter[];
  currentTime: number;
  disabled?: boolean;
  duration: number;
  isFullscreen: boolean;
  isMuted: boolean;
  isTheater: boolean;
  notesOpen: boolean;
  playbackRate: number;
  status: PlaybackStatus;
  volume: number;
  onPause: () => void;
  onPlay: () => void;
  onReplay: () => void;
  onRestart: () => void;
  onSeek: (time: number) => void;
  onSeekBy: (seconds: number) => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onToggleNotes: () => void;
  onToggleTheater: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (volume: number) => void;
}

function DockButton({ children, disabled, label, onClick, pressed }: { children: React.ReactNode; disabled?: boolean; label: string; onClick: () => void; pressed?: boolean }) {
  return <button aria-label={label} aria-pressed={pressed} className="dock-button" disabled={disabled} onClick={onClick} title={label} type="button">{children}</button>;
}

export function PlaybackControls({ bufferedUntil = 0, chapters = [], currentTime, disabled = false, duration, isFullscreen, isMuted, isTheater, notesOpen, playbackRate, status, volume, onPause, onPlay, onReplay, onRestart, onSeek, onSeekBy, onToggleFullscreen, onToggleMute, onToggleNotes, onToggleTheater, onPlaybackRateChange, onVolumeChange }: PlaybackControlsProps) {
  const isPlaying = status === "playing";
  const isEnded = status === "ended";
  const playedPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min((bufferedUntil / duration) * 100, 100) : 0;

  return (
    <>
      <div className="timeline-orbit">
        <div className="timeline-track"><span className="timeline-buffer" style={{ width: `${bufferedPercent}%` }} /><span className="timeline-played" style={{ width: `${playedPercent}%` }} /></div>
        {chapters.map((chapter) => <button aria-label={`Jump to chapter: ${chapter.label}`} className="timeline-dot" disabled={disabled} key={chapter.id} onClick={() => onSeek(chapter.startSeconds)} style={{ left: `${duration > 0 ? (chapter.startSeconds / duration) * 100 : 0}%` }} title={chapter.label} type="button" />)}
        <label className="sr-only" htmlFor="lesson-timeline">Seek through lesson</label>
        <input aria-valuetext={`${formatPlaybackTime(currentTime)} of ${formatPlaybackTime(duration)}`} disabled={disabled} id="lesson-timeline" max={duration} min="0" onChange={(event) => onSeek(Number(event.target.value))} step="0.1" type="range" value={Math.min(currentTime, duration)} />
      </div>

      <div className="playback-dock" aria-label="Lesson playback controls">
        <div className="dock-cluster">
          <DockButton disabled={disabled} label="Restart" onClick={onRestart}><RefreshCcw aria-hidden="true" size={16} /></DockButton>
          <DockButton disabled={disabled} label="Back 10 seconds" onClick={() => onSeekBy(-10)}><Rewind aria-hidden="true" size={17} /></DockButton>
          <button aria-label={isPlaying ? "Pause lesson" : isEnded ? "Replay lesson" : "Play lesson"} className="dock-button dock-play" disabled={disabled} onClick={isPlaying ? onPause : isEnded ? onReplay : onPlay} type="button">
            {isPlaying ? <Pause aria-hidden="true" fill="currentColor" size={18} /> : isEnded ? <Redo2 aria-hidden="true" size={18} /> : <Play aria-hidden="true" fill="currentColor" size={18} />}
          </button>
          <DockButton disabled={disabled} label="Forward 10 seconds" onClick={() => onSeekBy(10)}><FastForward aria-hidden="true" size={17} /></DockButton>
          <output className="dock-time" htmlFor="lesson-timeline"><span>{formatPlaybackTime(currentTime)}</span> / {formatPlaybackTime(duration)}</output>
        </div>

        <div className="dock-cluster">
          <DockButton disabled={disabled} label={isMuted ? "Unmute narration" : "Mute narration"} onClick={onToggleMute} pressed={isMuted}>{isMuted || volume === 0 ? <VolumeX aria-hidden="true" size={17} /> : <Volume2 aria-hidden="true" size={17} />}</DockButton>
          <label className="sr-only" htmlFor="lesson-volume">Narration volume</label>
          <input className="w-16 accent-[var(--cobalt)]" disabled={disabled} id="lesson-volume" max="1" min="0" onChange={(event) => onVolumeChange(Number(event.target.value))} step="0.05" type="range" value={isMuted ? 0 : volume} />
          <label className="relative flex items-center">
            <span className="sr-only">Playback speed</span><Gauge aria-hidden="true" size={14} />
            <select aria-label="Playback speed" className="border-0 bg-transparent text-[10px] font-extrabold outline-none" disabled={disabled} onChange={(event) => onPlaybackRateChange(Number(event.target.value))} value={playbackRate}>{[0.75,1,1.25,1.5].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select>
          </label>
        </div>

        <div className="dock-cluster">
          <DockButton label={notesOpen ? "Hide lesson notes" : "Show lesson notes"} onClick={onToggleNotes} pressed={notesOpen}><BookOpenText aria-hidden="true" size={17} /></DockButton>
          <DockButton label={isTheater ? "Exit theater mode" : "Enter theater mode"} onClick={onToggleTheater} pressed={isTheater}>{isTheater ? <Minimize2 aria-hidden="true" size={17} /> : <Expand aria-hidden="true" size={17} />}</DockButton>
          <DockButton label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={onToggleFullscreen} pressed={isFullscreen}>{isFullscreen ? <Minimize2 aria-hidden="true" size={17} /> : <Maximize2 aria-hidden="true" size={17} />}</DockButton>
        </div>
      </div>
    </>
  );
}
