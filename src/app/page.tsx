import { Clock3, PenTool, TextQuote } from "lucide-react";

import { ClassroomPreview } from "@/components/landing/classroom-preview";
import { SiteHeader } from "@/components/landing/site-header";
import { TopicComposer } from "@/components/landing/topic-composer";
import { LessonPlayer } from "@/components/lesson/lesson-player";

const BENEFITS = [
  { icon: PenTool, label: "Drawn step by step" },
  { icon: TextQuote, label: "Guided narration cues" },
  { icon: Clock3, label: "About two minutes" },
];

export default function HomePage() {
  return (
    <main id="top" className="page-shell min-h-screen overflow-hidden">
      <SiteHeader />

      <section className="mx-auto grid w-full max-w-[1180px] items-center gap-16 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[0.96fr_1.04fr] lg:gap-12 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--violet-soft)] bg-[var(--violet-wash)] px-3.5 py-2 text-xs font-bold text-[var(--violet-dark)]">
            <span className="grid size-5 place-items-center rounded-full bg-white">✦</span>
            Your idea, explained visually
          </div>

          <h1 className="max-w-[680px] text-balance text-[clamp(3.15rem,7vw,5.7rem)] font-black leading-[0.94] tracking-[-0.07em] text-[var(--ink)]">
            See the idea.
            <span className="mt-1 block text-[var(--violet)]">Hear it click.</span>
          </h1>

          <p className="mt-7 max-w-[570px] text-pretty text-base font-medium leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
            Ask about anything. Chalk turns it into a short lesson that draws, explains, and
            highlights each important idea right when you need it.
          </p>

          <div className="mt-9">
            <TopicComposer />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[var(--muted)]">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li className="flex items-center gap-2" key={label}>
                <span className="grid size-7 place-items-center rounded-lg bg-white/70 text-[var(--violet)] shadow-sm">
                  <Icon aria-hidden="true" size={14} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative pb-8 pt-3 lg:pb-0">
          <ClassroomPreview />
        </div>
      </section>

      <LessonPlayer />
    </main>
  );
}
