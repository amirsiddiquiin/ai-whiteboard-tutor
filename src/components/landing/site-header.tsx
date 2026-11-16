import { Sparkles } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
      <a
        className="group inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-4"
        href="#top"
        aria-label="Chalk home"
      >
        <span className="grid size-10 place-items-center rounded-2xl bg-[var(--ink)] text-white shadow-[0_6px_18px_rgba(28,26,44,0.16)] transition-transform group-hover:-rotate-3">
          <Sparkles aria-hidden="true" size={19} strokeWidth={2.2} />
        </span>
        <span className="text-lg font-extrabold tracking-[-0.035em] text-[var(--ink)]">Chalk</span>
      </a>

      <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/55 px-3 py-2 text-xs font-semibold text-[var(--muted)] shadow-sm backdrop-blur">
        <span className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_0_3px_rgba(70,196,157,0.14)]" />
        AI whiteboard tutor
      </div>
    </header>
  );
}
