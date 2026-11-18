import { BookOpenText, Pause, Rewind, Volume2 } from "lucide-react";

const ARRAY_VALUES = [2, 5, 8, 12, 16, 23, 38];

export function ClassroomPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[1100px]" aria-label="Product preview of a visual binary search lesson">
      <div className="absolute -inset-10 -z-10 rounded-[48px] bg-[radial-gradient(circle,rgba(113,91,229,0.18),transparent_62%)] blur-3xl" />
      <div className="overflow-hidden rounded-[24px] border border-white/12 bg-[#0d1118] p-2 shadow-[0_34px_100px_rgba(0,0,0,0.48)] sm:p-3">
        <div className="flex items-center justify-between border-b border-white/8 px-3 py-2.5 text-white sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-[#8ee3bd] shadow-[0_0_0_4px_rgba(142,227,189,0.1)]" />
            <span className="truncate text-xs font-extrabold">Binary Search · Find 23</span>
          </div>
          <span className="rounded-full bg-white/6 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/45">Product preview</span>
        </div>

        <div className="grid bg-[#090d13] lg:grid-cols-[minmax(0,1fr)_270px]">
          <div className="min-w-0 p-2 sm:p-3">
            <div className="chalk-grid relative aspect-video overflow-hidden rounded-xl border border-white/8 bg-[#fffefb]">
              <div className="absolute left-[7%] top-[9%] rounded-lg bg-[#eeeaff] px-3 py-2 text-[clamp(0.55rem,1.4vw,0.8rem)] font-extrabold text-[#5742c5] shadow-sm">Sorted data → halve the search space</div>
              <div className="absolute left-1/2 top-[36%] w-[86%] -translate-x-1/2">
                <div className="mb-[3%] flex items-center justify-center gap-2 text-[clamp(0.5rem,1.2vw,0.72rem)] font-extrabold text-[#9a691f]"><span className="h-px w-[12%] bg-[#edae49]" />Check the middle<span className="h-px w-[12%] bg-[#edae49]" /></div>
                <div className="flex justify-center gap-[1.2%]">
                  {ARRAY_VALUES.map((value, index) => (
                    <div
                      className={`grid aspect-square min-w-0 flex-1 place-items-center rounded-[clamp(0.35rem,1vw,0.75rem)] border-[clamp(1px,0.22vw,3px)] text-[clamp(0.58rem,1.5vw,1rem)] font-black transition ${index === 3 ? "-translate-y-[8%] border-[#edae49] bg-[#fff4d9] text-[#875a18] shadow-[0_8px_22px_rgba(237,174,73,0.28)]" : index < 4 ? "border-[#efb1ab] bg-[#fff3f1] text-[#ba5b54] opacity-50" : "border-[#d8d7df] bg-white text-[#292638]"}`}
                      key={value}
                    >
                      {value}
                    </div>
                  ))}
                </div>
                <div className="mt-[4%] grid grid-cols-2 gap-[5%] text-center text-[clamp(0.48rem,1.15vw,0.68rem)] font-extrabold">
                  <span className="rounded-full bg-[#fff0ed] px-2 py-1.5 text-[#ad4b44]">discard ≤ 12</span>
                  <span className="rounded-full bg-[#e8f8f2] px-2 py-1.5 text-[#217b62]">continue right →</span>
                </div>
              </div>
              <div className="absolute bottom-[7%] left-[7%] flex items-center gap-2 text-[clamp(0.48rem,1.1vw,0.68rem)] font-bold text-[#777181]"><span className="size-1.5 rounded-full bg-[#6850dc]" /> Each comparison removes half the candidates.</div>
            </div>

            <div className="mt-2 rounded-xl border border-white/8 bg-[#111620] p-2.5 sm:p-3">
              <div className="relative h-4">
                <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-white/10" />
                <div className="absolute left-0 top-1.5 h-1 w-[44%] rounded-full bg-[#8f79ff]" />
                {[0, 38, 72].map((position) => <span className="absolute top-1 size-2 -translate-x-1/2 rounded-full border border-[#111620] bg-white/70" key={position} style={{ left: `${position}%` }} />)}
              </div>
              <div className="mt-1 flex items-center gap-2 text-white/60">
                <span className="grid size-8 place-items-center rounded-full bg-white text-[#111620]"><Pause aria-hidden="true" fill="currentColor" size={13} /></span>
                <Rewind aria-hidden="true" size={14} />
                <span className="font-mono text-[10px] font-bold"><span className="text-white">0:51</span> / 2:02</span>
                <Volume2 aria-hidden="true" className="ml-auto" size={15} />
                <span className="rounded-md bg-white/6 px-2 py-1 text-[9px] font-black">1×</span>
              </div>
            </div>
          </div>

          <aside className="hidden border-l border-white/8 bg-[#111620] p-4 text-white lg:block">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/38"><BookOpenText aria-hidden="true" size={13} /> Lesson notes</div>
            <p className="mt-3 text-xs font-extrabold text-white/88">Compare with the middle</p>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-white/55">Twelve is smaller than our target, so the entire left half can be ignored.</p>
            <p className="mt-6 text-[9px] font-black uppercase tracking-[0.13em] text-white/30">Chapters</p>
            {['The search space', 'Compare & discard', 'Find the target'].map((label, index) => (
              <div className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${index === 1 ? "bg-white/8 text-white" : "text-white/38"}`} key={label}><span className={`grid size-5 place-items-center rounded-md ${index === 1 ? "bg-[#7561e8]" : "bg-white/6"}`}>{index + 1}</span>{label}</div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
