import React, { useRef, useState } from "react";
import { getLessonDateIso, shiftGroupOutcomes } from "../core/calendarShift";
import { getSubjectPalette, splitOutcomeCode } from "../core/mebPalette";
import { formatIsoTr, formatLessonForClassbook } from "../core/officialExport";
import { PusulaStateV3, TimetableCell, makeCellKey } from "../core/schema";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

interface Props {
  state: PusulaStateV3;
  week: number;
  dayIndex: number;
  onChangeDay: (dayIndex: number) => void;
  onUpdateState: (next: PusulaStateV3, undoLabel: string) => void;
  onNotify: (msg: string) => void;
}

export const CockpitView: React.FC<Props> = ({
  state,
  week,
  dayIndex,
  onChangeDay,
  onUpdateState,
  onNotify
}) => {
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [showNoteSlot, setShowNoteSlot] = useState<number | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const dateIso = getLessonDateIso(state, week, dayIndex);
  const dayHoliday = state.dayHolidays[dateIso];
  const dayRow = state.timetable[dayIndex] || [];

  const updateOutcome = (slotIndex: number, text: string) => {
    const key = makeCellKey(week, dayIndex, slotIndex);
    const nextOutcomes = { ...state.outcomes };
    const nextTs = { ...state.outcomeUpdatedAt };
    if (text.trim()) {
      nextOutcomes[key] = text;
      nextTs[key] = Date.now();
    } else {
      delete nextOutcomes[key];
      delete nextTs[key];
    }
    onUpdateState(
      { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTs, updatedAt: Date.now() },
      `${week}. Hafta ${DAY_NAMES[dayIndex]} ${slotIndex + 1}. ders düzenleme`
    );
  };

  const updateTeacherNote = (slotIndex: number, note: string) => {
    const key = makeCellKey(week, dayIndex, slotIndex);
    const nextNotes = { ...state.teacherNotes };
    if (note.trim()) nextNotes[key] = note;
    else delete nextNotes[key];
    onUpdateState({ ...state, teacherNotes: nextNotes, updatedAt: Date.now() }, "Öğretmen özel notu");
  };

  const toggleDone = (slotIndex: number) => {
    const key = makeCellKey(week, dayIndex, slotIndex);
    const nextMarks = { ...(state.doneMarks || {}) };
    if (nextMarks[key]) delete nextMarks[key];
    else nextMarks[key] = Date.now();
    onUpdateState({ ...state, doneMarks: nextMarks, updatedAt: Date.now() }, "İşlendi işareti");
  };

  const handleShift = (cell: TimetableCell, slotIndex: number, dir: 1 | -1) => {
    const next = shiftGroupOutcomes(state, cell, week, dayIndex, slotIndex, dir);
    const label = cell.section ? `${cell.section} · ${cell.subject}` : cell.subject;
    onUpdateState(
      next,
      dir === 1 ? `${label} konuları 1 ders ileri ötelendi` : `${label} konuları 1 ders geri çekildi`
    );
    onNotify(
      dir === 1
        ? `${label}: Bu dersten sonraki konular 1 ders ileri kaydırıldı.`
        : `${label}: Konular 1 ders geri çekildi.`
    );
  };

  const copyClassbook = async (slotIndex: number) => {
    const text = formatLessonForClassbook(state, week, dayIndex, slotIndex);
    try {
      await navigator.clipboard.writeText(text);
      onNotify("Sınıf defteri formatında kopyalandı.");
    } catch {
      onNotify("Panoya kopyalanamadı.");
    }
  };

  return (
    <section
      className="flex flex-col gap-3"
      onTouchStart={(e) => {
        const t = e.target as HTMLElement | null;
        if (t && t.closest("textarea, input, button, select")) {
          touchRef.current = null;
          return;
        }
        touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchRef.current) return;
        const dx = e.changedTouches[0].clientX - touchRef.current.x;
        const dy = e.changedTouches[0].clientY - touchRef.current.y;
        touchRef.current = null;
        if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          const nextDay = dayIndex + (dx < 0 ? 1 : -1);
          if (nextDay >= 0 && nextDay <= 4) {
            setEditingSlot(null);
            onChangeDay(nextDay);
          }
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="tabs-scroll flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Gün seçimi">
          {DAY_NAMES.map((name, idx) => {
            const dIso = getLessonDateIso(state, week, idx);
            const isHol = Boolean(state.dayHolidays[dIso]);
            const active = idx === dayIndex;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setEditingSlot(null);
                  onChangeDay(idx);
                }}
                className={`min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--fg)]"
                }`}
              >
                {name}
                {isHol ? " · Tatil" : ""}
              </button>
            );
          })}
        </div>
        <span className="font-mono-num text-xs sm:text-sm text-[var(--muted)]">
          {week}. Hafta · {formatIsoTr(dateIso)}
        </span>
      </div>

      {dayHoliday && (
        <div className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>Tatil / Ders Dışı Gün:</strong> {dayHoliday}. Bu güne yeni kazanım dağıtılmaz; dilerseniz derslerden konuları ileri öteleyebilirsiniz.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {Array.from({ length: state.slotsPerDay }, (_, slotIndex) => {
          const cell = dayRow[slotIndex] || null;
          if (!cell) {
            return (
              <div
                key={slotIndex}
                className="flex min-h-11 items-center justify-between rounded-xl border border-dashed border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)]"
              >
                <span className="font-mono-num font-semibold">{slotIndex + 1}. Ders</span>
                <span>Boş saat (ders yok)</span>
              </div>
            );
          }

          const pal = getSubjectPalette(cell.subject);
          const key = makeCellKey(week, dayIndex, slotIndex);
          const currentText = (state.outcomes[key] || "").trim();
          const prevWeekText =
            week > 1 ? (state.outcomes[makeCellKey(week - 1, dayIndex, slotIndex)] || "").trim() : "";
          const noteText = state.teacherNotes[key] || "";
          const isDone = Boolean(state.doneMarks?.[key]);
          const isEditing = editingSlot === slotIndex;
          const isNoteOpen = showNoteSlot === slotIndex;

          return (
            <article
              key={slotIndex}
              style={{ borderLeft: `4px solid ${pal.accent}` }}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    style={{ background: pal.badgeBg, color: pal.accentDark }}
                    className="font-mono-num rounded-lg px-2 py-0.5 text-xs font-bold"
                  >
                    {slotIndex + 1}. Ders
                  </span>
                  {cell.section && (
                    <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent)]">
                      {cell.section}
                    </span>
                  )}
                  <h3 className="m-0 text-base font-bold">{cell.subject}</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingSlot(isEditing ? null : slotIndex)}
                  className="min-h-11 rounded-xl bg-[var(--accent-soft)] px-3.5 text-xs font-bold text-[var(--accent)]"
                >
                  {isEditing ? "Bitti" : currentText ? "Düzenle" : "Kazanım Ekle"}
                </button>
              </div>

              {prevWeekText && !isEditing && (
                <div className="mb-2 rounded-lg bg-[var(--bg)] px-2.5 py-1.5 text-xs text-[var(--muted)]">
                  <strong>Geçen hafta ({week - 1}. H):</strong> {prevWeekText.split("\n")[0]}
                </div>
              )}

              {isEditing ? (
                <textarea
                  autoFocus
                  rows={3}
                  value={state.outcomes[key] || ""}
                  onChange={(e) => updateOutcome(slotIndex, e.target.value)}
                  placeholder="Her satıra bir kazanım / öğrenme çıktısı yazın..."
                  className="w-full rounded-xl border border-[var(--accent)] bg-[var(--bg)] p-2.5 text-base sm:text-sm"
                />
              ) : currentText ? (
                <div className="flex flex-col gap-1">
                  {currentText.split("\n").map((line, i) => {
                    const { code, rest } = splitOutcomeCode(line);
                    return (
                      <p key={i} className="m-0 text-[15px] leading-snug">
                        {code && (
                          <span className="font-mono-num mr-1.5 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-bold text-[var(--accent)]">
                            {code}
                          </span>
                        )}
                        {rest}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className="m-0 text-sm text-[var(--muted)]">Kazanım girilmedi.</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-2">
                {currentText && (
                  <button
                    type="button"
                    onClick={() => toggleDone(slotIndex)}
                    className={`min-h-11 sm:min-h-9 rounded-lg border px-2.5 text-xs font-bold ${isDone ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"}`}
                  >
                    {isDone ? "✓ İşlendi" : "○ İşlendi"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShift(cell, slotIndex, 1)}
                  className="min-h-11 sm:min-h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-xs font-semibold"
                >
                  Ötele +1 ↷
                </button>
                <button
                  type="button"
                  onClick={() => handleShift(cell, slotIndex, -1)}
                  className="min-h-11 sm:min-h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-xs font-semibold"
                >
                  ↶ -1
                </button>
                <button
                  type="button"
                  onClick={() => copyClassbook(slotIndex)}
                  className="min-h-11 sm:min-h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-xs font-semibold"
                >
                  Deftere Kopyala
                </button>
                <button
                  type="button"
                  onClick={() => setShowNoteSlot(isNoteOpen ? null : slotIndex)}
                  className="min-h-11 sm:min-h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-xs font-semibold"
                >
                  {noteText ? "Not ★" : "Not"}
                </button>
              </div>

              {isNoteOpen && (
                <div className="mt-2.5 border-t border-[var(--line)] pt-2">
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
                    Kişisel Öğretmen Notu (Resmi çıktılara girmez)
                  </label>
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => updateTeacherNote(slotIndex, e.target.value)}
                    placeholder="Örn: Sayfa 42 ödev kontrolü..."
                    className="h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-base sm:text-sm"
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};