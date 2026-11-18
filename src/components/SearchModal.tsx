import React, { useMemo, useState } from "react";
import { getLessonDateIso } from "../core/calendarShift";
import { formatShortDateTr } from "../core/officialExport";
import { PusulaStateV3, groupTimetableLessons } from "../core/schema";

const DAY_SHORTS = ["Pzt", "Sal", "Çar", "Per", "Cum"];

interface Props {
  state: PusulaStateV3;
  onJump: (week: number, groupKey?: string) => void;
  onClose: () => void;
}

export const SearchModal: React.FC<Props> = ({ state, onJump, onClose }) => {
  const [q, setQ] = useState("");
  const groups = useMemo(
    () => groupTimetableLessons(state.timetable, state.slotsPerDay),
    [state.timetable, state.slotsPerDay]
  );

  const hits = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr-TR").replace(/i\u0307/g, "i");
    if (term.length < 2) return [];
    const results: Array<{
      key: string;
      week: number;
      dayIndex: number;
      slotIndex: number;
      dateIso: string;
      title: string;
      groupKey?: string;
      text: string;
    }> = [];

    for (const [k, raw] of Object.entries(state.outcomes)) {
      const text = raw.trim();
      if (!text) continue;
      const m = k.match(/^(\d+)\|([0-4])\|([0-9])$/);
      if (!m) continue;
      const week = Number(m[1]);
      const dayIndex = Number(m[2]);
      const slotIndex = Number(m[3]);
      const cell = state.timetable[dayIndex]?.[slotIndex];
      const title = cell ? (cell.section ? `${cell.section} · ${cell.subject}` : cell.subject) : `${slotIndex + 1}. Ders`;
      const normText = text.toLocaleLowerCase("tr-TR").replace(/i\u0307/g, "i");
      const normTitle = title.toLocaleLowerCase("tr-TR").replace(/i\u0307/g, "i");
      if (normText.includes(term) || normTitle.includes(term) || `${week}. hafta`.includes(term)) {
        const grp = cell
          ? groups.find(
              (g) =>
                g.subject.toLocaleLowerCase("tr-TR") === cell.subject.trim().toLocaleLowerCase("tr-TR") &&
                (g.section || "").toLocaleLowerCase("tr-TR") === (cell.section || "").trim().toLocaleLowerCase("tr-TR")
            )
          : undefined;
        results.push({
          key: k,
          week,
          dayIndex,
          slotIndex,
          dateIso: getLessonDateIso(state, week, dayIndex),
          title,
          groupKey: grp?.groupKey,
          text
        });
      }
    }

    return results.sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex).slice(0, 50);
  }, [groups, q, state]);

  return (
    <section className="kd-card flex flex-col gap-2.5 border-2 border-[var(--accent)] p-3.5">
      <div className="flex items-center gap-2">
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kazanım kodu, kelime, şube (7/A) veya ders ara..."
          className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-sm"
        />
        <button type="button" onClick={onClose} className="kd-btn">
          Kapat
        </button>
      </div>
      {q.trim().length >= 2 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--muted)]">
            {hits.length === 0 ? "Eşleşen kazanım bulunamadı." : `${hits.length} sonuç`}
          </span>
          {hits.length > 0 && (
            <ul className="m-0 max-h-60 list-none divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--bg)] p-0">
              {hits.map((h) => (
                <li key={h.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(h.week, h.groupKey);
                      onClose();
                    }}
                    className="flex w-full flex-col gap-0.5 border-0 bg-transparent px-3 py-2 text-left hover:bg-[var(--accent-soft)]"
                  >
                    <span className="font-mono-num text-xs font-bold text-[var(--accent)]">
                      {h.week}. Hafta · {formatShortDateTr(h.dateIso)} ({DAY_SHORTS[h.dayIndex]} {h.slotIndex + 1}. ders) · {h.title}
                    </span>
                    <span className="line-clamp-2 text-sm text-[var(--fg)]">{h.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};