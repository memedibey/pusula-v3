import React, { useMemo, useState } from "react";
import { getLessonDateIso } from "../core/calendarShift";
import { LessonUnitGroup, PusulaStateV3, makeCellKey } from "../core/schema";

interface Props {
  state: PusulaStateV3;
  week: number;
  groups: LessonUnitGroup[];
  onJumpToGroup: (groupKey: string) => void;
}

export const FloatingMissingDock: React.FC<Props> = ({ state, week, groups, onJumpToGroup }) => {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    let total = 0, filled = 0;
    const missing: Array<{ groupKey: string; title: string; count: number }> = [];
    groups.forEach((grp) => {
      let grpMiss = 0;
      grp.lessons.forEach((l) => {
        const dIso = getLessonDateIso(state, week, l.dayIndex);
        if (state.dayHolidays[dIso]) return;
        total += 1;
        if ((state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim()) filled += 1;
        else grpMiss += 1;
      });
      if (grpMiss > 0) missing.push({ groupKey: grp.groupKey, title: grp.displayTitle, count: grpMiss });
    });
    return { total, filled, missingCount: total - filled, missing };
  }, [groups, state, week]);

  if (groups.length === 0) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
      className="kd-glass-dock fixed inset-x-3 bottom-[calc(70px+env(safe-area-inset-bottom,0px))] z-19 mx-auto flex max-w-[736px] cursor-pointer flex-col gap-2 rounded-[20px] px-4 py-3 select-none md:max-w-[900px] lg:max-w-[1040px]"
    >
      {open && summary.missing.length > 0 && (
        <div className="flex max-h-[38vh] flex-wrap gap-1.5 overflow-y-auto pb-1">
          {summary.missing.map((m) => (
            <button
              key={m.groupKey}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onJumpToGroup(m.groupKey); }}
              className="min-h-8 rounded-full border-0 bg-[var(--accent-soft)] px-3 text-xs font-bold text-[var(--accent)]"
            >
              {m.title} ({m.count} boş)
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-sm">
        {summary.missingCount === 0 ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            ✓ {week}. hafta: <span className="font-mono-num">{summary.total}/{summary.total}</span> dersin tamamı dolu
          </span>
        ) : (
          <span>
            <strong>{week}. hafta:</strong>{" "}
            <span className="font-mono-num">{summary.filled}/{summary.total}</span> ders girildi ·{" "}
            <span className="text-xs font-semibold text-[var(--muted)]">{summary.missing.length} derste boşluk var</span>
          </span>
        )}
        {summary.missing.length > 0 && (
          <span className="text-xs font-semibold text-[var(--accent)]">{open ? "Kapat ▾" : "Göster ▴"}</span>
        )}
      </div>
    </div>
  );
};