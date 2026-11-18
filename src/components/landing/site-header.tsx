import { ArrowLeft, Sparkles } from "lucide-react";

export function SiteHeader({
  lessonMode = false,
  onNewLesson,
}: {
  lessonMode?: boolean;
  onNewLesson?: () => void;
}) {
  return (
    <header className={`relative z-20 mx-auto flex w-full items-center justify-between px-5 sm:px-8 lg:px-10 ${lessonMode ? "max-w-[1380px] py-4" : "max-w-[1240px] py-5"}`}>
      <a
        className="group inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-4"
        href="#top"
        aria-label="Chalk home"
      >
        <span className="grid size-10 place-items-center rounded-[14px] bg-white/10 text-white shadow-[0_6px_18px_rgba(0,0,0,0.2)] ring-1 ring-white/10 transition-transform group-hover:-rotate-3">
          <Sparkles aria-hidden="true" size={19} strokeWidth={2.2} />
        </span>
        <span className="text-lg font-extrabold tracking-[-0.035em] text-white">Chalk</span>
      </a>

      {lessonMode ? (
        <button
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 text-xs font-extrabold text-white shadow-sm transition hover:border-white/20 hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8cff]"
          onClick={onNewLesson}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          New lesson
        </button>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/55 shadow-sm backdrop-blur">
          <span className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_0_3px_rgba(70,196,157,0.14)]" />
          AI whiteboard tutor
        </div>
      )}
    </header>
  );
}
