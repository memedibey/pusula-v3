import React, { useMemo, useState } from "react";
import { TimelineSlot, formatMonFriRange, toMondayIso } from "../core/calendarShift";
import { LessonUnitGroup, MEB_2026_2027_CALENDAR, PusulaStateV3, makeCellKey } from "../core/schema";

interface Props {
  state: PusulaStateV3;
  timeline: TimelineSlot[];
  activeMonday: string;
  specialPre: "prep" | "orient" | null;
  groups: LessonUnitGroup[];
  activeGroup: LessonUnitGroup | null;
  onJumpWeek: (week: number) => void;
  onJumpMonday: (monday: string) => void;
  onJumpPre: (pre: "prep" | "orient") => void;
  onClose: () => void;
}

export const YearRadarModal: React.FC<Props> = ({
  state,
  timeline,
  activeMonday,
  specialPre,
  groups,
  activeGroup,
  onJumpWeek,
  onJumpMonday,
  onJumpPre,
  onClose
}) => {
  const [scope, setScope] = useState<"all" | "active">("all");
  const isMeb26 = toMondayIso(state.startMonday) === MEB_2026_2027_CALENDAR.term1Start;
  const teachingCount = useMemo(() => timeline.filter((s) => s.kind === "teaching").length, [timeline]);

  const targetLessons = useMemo(() => {
    if (scope === "active" && activeGroup) return activeGroup.lessons;
    return groups.flatMap((g) => g.lessons);
  }, [scope, activeGroup, groups]);

  const stats = useMemo(() => {
    let totalAll = 0;
    let filledAll = 0;
    let doneAll = 0;
    const perSlot = timeline.map((slot) => {
      if (slot.kind === "holiday" || !slot.teachingWeek) {
        return { slot, total: 0, filled: 0, done: 0 };
      }
      const w = slot.teachingWeek;
      let total = 0;
      let filled = 0;
      let done = 0;
      targetLessons.forEach((l) => {
        total += 1;
        const k = makeCellKey(w, l.dayIndex, l.slotIndex);
        if ((state.outcomes[k] || "").trim()) filled += 1;
        if (state.doneMarks?.[k]) done += 1;
      });
      totalAll += total;
      filledAll += filled;
      doneAll += done;
      return { slot, total, filled, done };
    });
    const pct = totalAll > 0 ? Math.round((filledAll / totalAll) * 100) : 0;
    const firstMissingWeek = perSlot.find((x) => x.slot.kind === "teaching" && x.slot.teachingWeek && x.filled < x.total)?.slot.teachingWeek ?? null;
    return { perSlot, totalAll, filledAll, doneAll, pct, firstMissingWeek };
  }, [timeline, targetLessons, state.outcomes, state.doneMarks]);

  return (
    <section className="kd-card flex flex-col gap-3 border-2 border-[var(--accent)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-sm font-bold">{teachingCount} Haftalık Yıllık Radar</h3>
          <p className="m-0 text-xs text-[var(--muted)]">
            Doluluk: <strong className="font-mono-num text-[var(--fg)]">%{stats.pct}</strong> ({stats.filledAll}/{stats.totalAll} ders) ·{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ {stats.doneAll} işlendi</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeGroup && (
            <div className="inline-flex overflow-hidden rounded-xl border border-[var(--line)]">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`min-h-9 border-0 px-2.5 text-xs font-semibold ${scope === "all" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}
              >
                Tüm Dersler
              </button>
              <button
                type="button"
                onClick={() => setScope("active")}
                className={`min-h-9 border-0 border-l border-[var(--line)] px-2.5 text-xs font-semibold ${scope === "active" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}
              >
                {activeGroup.displayTitle}
              </button>
            </div>
          )}
          {stats.firstMissingWeek !== null && (
            <button
              type="button"
              onClick={() => { onJumpWeek(stats.firstMissingWeek!); onClose(); }}
              className="kd-btn min-h-9 border-amber-500/50 text-xs text-amber-700 dark:text-amber-300"
            >
              İlk eksiğe git ({stats.firstMissingWeek}. Hf)
            </button>
          )}
          <button type="button" onClick={onClose} className="kd-btn min-h-9 px-3 text-xs">Kapat</button>
        </div>
      </div>

      {isMeb26 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => { onJumpPre("prep"); onClose(); }}
            className={`min-h-8 rounded-lg border px-2.5 text-xs font-semibold ${specialPre === "prep" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"}`}
          >
            1–4 Eyl · Mesleki Çalışmalar
          </button>
          <button
            type="button"
            onClick={() => { onJumpPre("orient"); onClose(); }}
            className={`min-h-8 rounded-lg border px-2.5 text-xs font-semibold ${specialPre === "orient" ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"}`}
          >
            7–11 Eyl · Uyum / Rehberlik
          </button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-10">
        {stats.perSlot.map(({ slot, total, filled, done }) => {
          const isCurrent = specialPre === null && slot.monday === activeMonday;
          if (slot.kind === "holiday" || !slot.teachingWeek) {
            return (
              <button
                key={slot.monday}
                type="button"
                title={`${formatMonFriRange(slot.monday)} · ${slot.holidayLabel}`}
                onClick={() => { onJumpMonday(slot.monday); onClose(); }}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-1 text-center transition ${
                  isCurrent ? "ring-2 ring-[var(--accent)]" : ""
                } border-sky-400/50 bg-sky-500/12 text-sky-700 dark:text-sky-300`}
              >
                <span className="text-[10px] font-bold uppercase">Tatil</span>
                <span className="line-clamp-1 text-[9px] opacity-80">{slot.holidayLabel?.split(" ")[0]}</span>
              </button>
            );
          }

          const w = slot.teachingWeek;
          const isFull = total > 0 && filled === total;
          const isPartial = filled > 0 && filled < total;
          const allDone = total > 0 && done === total;
          const cls = isFull
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
            : isPartial
            ? "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300"
            : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]";

          return (
            <button
              key={slot.monday}
              type="button"
              title={`${w}. Hafta (${formatMonFriRange(slot.monday)}) · ${filled}/${total} dolu${done > 0 ? ` · ${done} işlendi` : ""}`}
              onClick={() => { onJumpWeek(w); onClose(); }}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-1 text-center transition ${cls} ${
                isCurrent ? "ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              <span className="font-mono-num text-xs font-bold leading-none">
                {w}{allDone ? " ✓" : ""}
              </span>
              <span className="font-mono-num mt-0.5 text-[10px] opacity-80">
                {filled}/{total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500/60" /> Tam dolu</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-500/60" /> Eksik var</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded border border-[var(--line)] bg-[var(--bg)]" /> Boş</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-sky-500/50" /> Resmî tatil</span>
      </div>
    </section>
  );
};
