import { Pause, RotateCcw, Volume2 } from "lucide-react";

const ARRAY_VALUES = [2, 5, 8, 12, 16, 23, 38];

export function ClassroomPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:mx-0" aria-label="Preview of a visual binary search lesson">
      <div className="absolute -inset-5 -z-10 rounded-[48px] bg-[linear-gradient(140deg,rgba(133,105,255,0.16),rgba(70,196,157,0.1))] blur-2xl" />
      <div className="rotate-[1.2deg] rounded-[34px] border border-white/90 bg-[var(--paper)] p-3 shadow-[0_34px_90px_rgba(42,37,67,0.18)] sm:p-4">
        <div className="overflow-hidden rounded-[25px] border border-[var(--line)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--violet)]">Now teaching</p>
              <p className="mt-0.5 text-sm font-extrabold tracking-[-0.02em] text-[var(--ink)]">Binary search</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[var(--mint-wash)] px-3 py-1.5 text-[10px] font-bold text-[var(--mint-dark)]">
              <span className="size-1.5 animate-pulse rounded-full bg-[var(--mint)]" />
              Step 2 of 5
            </div>
          </div>

          <div className="chalk-grid relative min-h-[330px] overflow-hidden p-5 sm:min-h-[390px] sm:p-7">
            <div className="absolute left-[8%] top-[11%] -rotate-2 rounded-xl bg-[var(--violet-wash)] px-3 py-2 text-xs font-bold text-[var(--violet-dark)] shadow-sm">
              Sorted smallest → largest
            </div>

            <div className="absolute left-1/2 top-[29%] w-[88%] -translate-x-1/2">
              <div className="mb-3 flex justify-center">
                <span className="rounded-full bg-[var(--amber-wash)] px-3 py-1 text-[11px] font-bold text-[var(--amber-dark)]">
                  check the middle
                </span>
              </div>
              <div className="flex justify-center gap-1.5 sm:gap-2">
                {ARRAY_VALUES.map((value, index) => (
                  <div
                    className={`grid aspect-square min-w-0 flex-1 place-items-center rounded-xl border-2 text-xs font-extrabold sm:text-sm ${
                      index === 3
                        ? "-translate-y-1 border-[var(--amber)] bg-[var(--amber-wash)] text-[var(--amber-dark)] shadow-[0_8px_18px_rgba(237,174,73,0.24)]"
                        : "border-[var(--line)] bg-white text-[var(--ink)]"
                    }`}
                    key={value}
                  >
                    {value}
                  </div>
                ))}
              </div>
              <div className="mx-auto mt-6 flex w-[47%] items-center gap-2 text-[10px] font-bold text-[var(--coral-dark)]">
                <span className="h-px flex-1 bg-[var(--coral)]" />
                discard this half
                <span className="h-px flex-1 bg-[var(--coral)]" />
              </div>
            </div>

            <div className="absolute bottom-[10%] left-[7%] max-w-[68%] rounded-2xl rounded-bl-md border border-[var(--line)] bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(42,37,67,0.1)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--muted)]">Tutor</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--ink)] sm:text-sm">
                Twelve is too small, so every value to its left can go.
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--line-soft)] bg-[var(--paper)] px-4 py-4">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
              <div className="h-full w-[42%] rounded-full bg-[var(--violet)]" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--ink)] text-white">
                  <Pause aria-hidden="true" size={14} fill="currentColor" />
                </span>
                <span className="text-[11px] font-bold tabular-nums text-[var(--muted)]">0:51 / 2:02</span>
              </div>
              <div className="flex items-center gap-3 text-[var(--muted)]">
                <RotateCcw aria-hidden="true" size={15} />
                <Volume2 aria-hidden="true" size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -right-1 rotate-[-3deg] rounded-2xl border border-white/80 bg-[var(--ink)] px-4 py-3 text-white shadow-xl sm:right-5">
        <p className="text-[10px] font-semibold text-white/60">Next up</p>
        <p className="mt-0.5 text-xs font-bold">Cut the search space in half</p>
      </div>
    </div>
  );
}
