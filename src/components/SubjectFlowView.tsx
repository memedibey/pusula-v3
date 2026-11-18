import React, { useEffect, useRef, useState } from "react";
import { getLessonDateIso, shiftGroupOutcomes } from "../core/calendarShift";
import { getSubjectPalette, splitOutcomeCode } from "../core/mebPalette";
import { LessonUnitGroup, PusulaStateV3, makeCellKey } from "../core/schema";

interface Props {
  state: PusulaStateV3;
  week: number;
  todayIso: string;
  groups: LessonUnitGroup[];
  activeGroup: LessonUnitGroup | null;
  onSelectGroup: (groupKey: string) => void;
  onUpdateState: (next: PusulaStateV3, undoLabel: string) => void;
  onNotify: (msg: string) => void;
}

export const SubjectFlowView: React.FC<Props> = ({
  state,
  week,
  todayIso,
  groups,
  activeGroup,
  onSelectGroup,
  onUpdateState,
  onNotify
}) => {
  const [editingCell, setEditingCell] = useState<{ dayIndex: number; slotIndex: number } | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [pasteBox, setPasteBox] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setConfirmOverwrite(false);
  }, [week, activeGroup?.groupKey]);

  useEffect(() => {
    if (!editingCell || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    el.style.height = Math.max(96, el.scrollHeight + 2) + "px";
  }, [editingCell]);

  useEffect(() => {
    if (!activeGroup) return;
    const idx = groups.findIndex((g) => g.groupKey === activeGroup.groupKey);
    if (idx >= 0) {
      tabRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeGroup, groups]);

  if (groups.length === 0 || !activeGroup) {
    return (
      <div className="kd-card p-5 text-center text-sm text-[var(--muted)]">
        Ders programı boş. Aşağıdaki <strong>Ayarlar</strong> bölümünden sınıf şablonu seçebilir veya ders ekleyebilirsiniz.
      </div>
    );
  }

  const pal = getSubjectPalette(activeGroup.subject);
  const filledCount = activeGroup.lessons.filter(
    (l) => (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim().length > 0
  ).length;

  const updateCellOutcome = (dayIndex: number, slotIndex: number, text: string) => {
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
      `${activeGroup.displayTitle} düzenleme`
    );
  };

  const updateTeacherNote = (dayIndex: number, slotIndex: number, note: string) => {
    const key = makeCellKey(week, dayIndex, slotIndex);
    const nextNotes = { ...state.teacherNotes };
    if (note.trim()) nextNotes[key] = note;
    else delete nextNotes[key];
    onUpdateState({ ...state, teacherNotes: nextNotes, updatedAt: Date.now() }, "Öğretmen notu");
  };

  const toggleDone = (dayIndex: number, slotIndex: number) => {
    const key = makeCellKey(week, dayIndex, slotIndex);
    const nextMarks = { ...(state.doneMarks || {}) };
    if (nextMarks[key]) delete nextMarks[key];
    else nextMarks[key] = Date.now();
    onUpdateState({ ...state, doneMarks: nextMarks, updatedAt: Date.now() }, "İşlendi işareti");
  };

  const copySingleCell = async (dayIndex: number, slotIndex: number) => {
    const txt = (state.outcomes[makeCellKey(week, dayIndex, slotIndex)] || "").trim();
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); onNotify("Kazanım panoya kopyalandı."); }
    catch { onNotify("Panoya kopyalanamadı."); }
  };

  const spreadToEmptySlots = (sourceDay: number, sourceSlot: number) => {
    const val = (state.outcomes[makeCellKey(week, sourceDay, sourceSlot)] || "").trim();
    if (!val) return;
    const empties = activeGroup.lessons.filter(
      (l) =>
        (l.dayIndex !== sourceDay || l.slotIndex !== sourceSlot) &&
        !(state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim()
    );
    if (empties.length === 0) return;
    const nextOutcomes = { ...state.outcomes };
    const nextTs = { ...state.outcomeUpdatedAt };
    const now = Date.now();
    empties.forEach((l) => {
      const k = makeCellKey(week, l.dayIndex, l.slotIndex);
      nextOutcomes[k] = val;
      nextTs[k] = now;
    });
    onUpdateState(
      { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTs, updatedAt: now },
      `${activeGroup.displayTitle} boş saatlere yayma`
    );
    onNotify(`${empties.length} boş ders saatine yayıldı.`);
  };

  const siblingGroups = groups.filter(
    (g) => g.groupKey !== activeGroup.groupKey && g.subject.toLocaleLowerCase("tr-TR") === activeGroup.subject.toLocaleLowerCase("tr-TR")
  );

  const copyToSiblingSections = () => {
    if (siblingGroups.length === 0) return;
    const sourceItems = activeGroup.lessons
      .map((l) => (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim())
      .filter(Boolean);
    if (sourceItems.length === 0) {
      onNotify("Önce bu şubeye en az bir kazanım girin.");
      return;
    }
    const nextOutcomes = { ...state.outcomes };
    const nextTs = { ...state.outcomeUpdatedAt };
    const now = Date.now();
    let count = 0;
    siblingGroups.forEach((grp) => {
      const total = grp.lessons.length;
      if (total === 0) return;
      if (sourceItems.length <= total) {
        for (let i = 0; i < total; i++) {
          const idx = Math.min(sourceItems.length - 1, Math.floor((i * sourceItems.length) / total));
          const k = makeCellKey(week, grp.lessons[i].dayIndex, grp.lessons[i].slotIndex);
          nextOutcomes[k] = sourceItems[idx];
          nextTs[k] = now;
          count++;
        }
      } else {
        const buckets: string[][] = Array.from({ length: total }, () => []);
        sourceItems.forEach((item, idx) => buckets[Math.min(total - 1, Math.floor((idx * total) / sourceItems.length))].push(item));
        buckets.forEach((b, i) => {
          if (b.length === 0) return;
          const k = makeCellKey(week, grp.lessons[i].dayIndex, grp.lessons[i].slotIndex);
          nextOutcomes[k] = b.join("\n");
          nextTs[k] = now;
          count++;
        });
      }
    });
    onUpdateState({ ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTs, updatedAt: now }, `${activeGroup.subject} şubelere aktarıldı`);
    onNotify(`${week}. hafta -> ${siblingGroups.length} diğer şubeye (${count} saat) kopyalandı.`);
  };

  const copyFromPrevWeek = () => {
    if (week <= 1) return;
    const prevWeek = week - 1;
    const items = activeGroup.lessons
      .map((l) => ({
        l,
        val: (state.outcomes[makeCellKey(prevWeek, l.dayIndex, l.slotIndex)] || "").trim()
      }))
      .filter((x) => x.val.length > 0);
    if (items.length === 0) {
      onNotify(`${prevWeek}. haftada ${activeGroup.displayTitle} kazanımı yok.`);
      return;
    }
    const hasCurrent = activeGroup.lessons.some(
      (l) => (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim().length > 0
    );
    if (hasCurrent && !confirmOverwrite) {
      setConfirmOverwrite(true);
      window.setTimeout(() => setConfirmOverwrite(false), 4000);
      return;
    }
    setConfirmOverwrite(false);
    const nextOutcomes = { ...state.outcomes };
    const nextTs = { ...state.outcomeUpdatedAt };
    const now = Date.now();
    items.forEach(({ l, val }) => {
      const k = makeCellKey(week, l.dayIndex, l.slotIndex);
      nextOutcomes[k] = val;
      nextTs[k] = now;
    });
    onUpdateState(
      { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTs, updatedAt: now },
      `${prevWeek}. haftadan kopyalama`
    );
    onNotify(`${prevWeek}. haftadan ${items.length} ders kazanımı kopyalandı.`);
  };

  const applySequentialPaste = () => {
    const rows = pasteBox
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (rows.length === 0) {
      onNotify("Yapıştırılacak satır yok.");
      return;
    }
    const count = Math.min(rows.length, activeGroup.lessons.length);
    const nextOutcomes = { ...state.outcomes };
    const nextTs = { ...state.outcomeUpdatedAt };
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const l = activeGroup.lessons[i];
      const text = rows[i]
        .split(/\s*\|\s*/)
        .map((x) => x.trim())
        .filter(Boolean)
        .join("\n");
      if (text) {
        const k = makeCellKey(week, l.dayIndex, l.slotIndex);
        nextOutcomes[k] = text;
        nextTs[k] = now;
      }
    }
    onUpdateState(
      { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTs, updatedAt: now },
      "Sırayla yerleştirme"
    );
    setEditingCell(null);
    onNotify(`${count} derse sırayla yerleştirildi.`);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Yapışkan Yatay Ders/Şube Sekmeleri */}
      <nav
        role="tablist"
        aria-label="Dersler"
        onWheel={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            el.scrollLeft += e.deltaY;
          }
        }}
        className="tabs-scroll sticky top-[env(safe-area-inset-top,0px)] z-10 flex gap-2 overflow-x-auto bg-[var(--bg)] py-1.5"
      >
        {groups.map((grp, idx) => {
          const isSel = grp.groupKey === activeGroup.groupKey;
          const cnt = grp.lessons.filter(
            (l) => (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim().length > 0
          ).length;
          return (
            <button
              key={grp.groupKey}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isSel}
              onClick={() => {
                onSelectGroup(grp.groupKey);
                setEditingCell(null);
              }}
              className={`flex min-h-[50px] shrink-0 flex-col items-start justify-center rounded-xl border px-3.5 py-1.5 text-left transition ${
                isSel
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--fg)]"
              }`}
            >
              <span className="whitespace-nowrap text-[15px] font-semibold">{grp.displayTitle}</span>
              <span className={`font-mono-num text-[12px] ${isSel ? "opacity-85" : "text-[var(--muted)]"}`}>
                {cnt}/{grp.lessons.length} ders
              </span>
            </button>
          );
        })}
      </nav>

      {/* Aktif Ders Başlığı + Önceki Haftadan Kopyala */}
      <div
        onTouchStart={(e) => {
          const t = e.target as HTMLElement | null;
          if (t && t.closest("textarea, button, input, summary, select")) {
            swipeRef.current = null;
            return;
          }
          swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!swipeRef.current) return;
          const dx = e.changedTouches[0].clientX - swipeRef.current.x;
          const dy = e.changedTouches[0].clientY - swipeRef.current.y;
          swipeRef.current = null;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
            const cur = groups.findIndex((g) => g.groupKey === activeGroup.groupKey);
            const nextIdx = cur + (dx < 0 ? 1 : -1);
            if (nextIdx >= 0 && nextIdx < groups.length) {
              onSelectGroup(groups[nextIdx].groupKey);
              setEditingCell(null);
            }
          }
        }}
      >
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h2 className="m-0 text-2xl sm:text-[28px] font-bold tracking-tight">{activeGroup.displayTitle}</h2>
            <span className="font-mono-num text-sm text-[var(--muted)]">
              {activeGroup.lessons.length} ders · {filledCount} kazanım girildi
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {siblingGroups.length > 0 && (
              <button type="button" onClick={copyToSiblingSections} className="kd-btn min-h-10 text-[13px]">
                Diğer şubelere aktar ({siblingGroups.length})
              </button>
            )}
            {week > 1 && (
            <button type="button" onClick={copyFromPrevWeek} className="kd-btn min-h-10 text-[13px]">
              {confirmOverwrite ? "Üzerine yazılsın mı? Tekrar tıkla" : "Önceki haftadan kopyala"}
            </button>
            )}
          </div>
        </div>

        {/* V2 İkonik Dikey Omurgalı Kart Listesi (Kazanım hanesinde tarih/gün/saat yok) */}
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {activeGroup.lessons.map((l, idx) => {
            const dateIso = getLessonDateIso(state, week, l.dayIndex);
            const isToday = dateIso === todayIso;
            const holiday = state.dayHolidays[dateIso];
            const key = makeCellKey(week, l.dayIndex, l.slotIndex);
            const isDone = Boolean(state.doneMarks?.[key]);
            const rawVal = state.outcomes[key] || "";
            const lines = rawVal
              .split("\n")
              .map((s) => s.replace(/\s+$/, ""))
              .filter((s) => s.trim() !== "");
            const isEditing =
              editingCell !== null &&
              editingCell.dayIndex === l.dayIndex &&
              editingCell.slotIndex === l.slotIndex;
            const emptyOthers = activeGroup.lessons.filter(
              (o) =>
                (o.dayIndex !== l.dayIndex || o.slotIndex !== l.slotIndex) &&
                !(state.outcomes[makeCellKey(week, o.dayIndex, o.slotIndex)] || "").trim()
            ).length;

            return (
              <li
                key={`${l.dayIndex}-${l.slotIndex}`}
                className="kd-card grid min-h-[82px] grid-cols-[46px_minmax(0,1fr)] overflow-hidden"
              >
                <div
                  style={{ background: pal.accent, color: "#fff" }}
                  className="flex select-none items-center justify-center py-2"
                  aria-label={`${idx + 1}. ders`}
                >
                  <span className="kd-lesson-spine">{idx + 1}. Ders</span>
                </div>

                <div className="min-w-0 px-3.5 py-2.5">
                  {!isEditing && (
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {isToday && (
                          <span className="rounded bg-[var(--today)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--fg)]">
                            Bugün
                          </span>
                        )}
                        {holiday && (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {holiday}
                          </span>
                        )}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {lines.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleDone(l.dayIndex, l.slotIndex)}
                              className={`min-h-[32px] rounded-lg border px-2 text-xs font-bold ${isDone ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"}`}
                            >
                              {isDone ? "✓ İşlendi" : "○ İşlendi"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copySingleCell(l.dayIndex, l.slotIndex)}
                              className="min-h-[32px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 text-xs font-medium"
                            >
                              Kopyala
                            </button>
                          </>
                        )}
                        {lines.length > 0 && emptyOthers > 0 && (
                          <button
                            type="button"
                            onClick={() => spreadToEmptySlots(l.dayIndex, l.slotIndex)}
                            className="min-h-[32px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-xs font-medium"
                          >
                            Boş saatlere yay ({emptyOthers})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingCell({ dayIndex: l.dayIndex, slotIndex: l.slotIndex })}
                          className="-mr-1 min-h-9 border-0 bg-transparent px-2 text-sm font-semibold text-[var(--accent)]"
                        >
                          {lines.length > 0 ? "Düzenle" : "Ekle"}
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        ref={textareaRef}
                        autoFocus
                        value={rawVal}
                        placeholder="Her satıra bir kazanım yazın..."
                        onChange={(e) => {
                          e.target.style.height = "auto";
                          e.target.style.height = Math.max(96, e.target.scrollHeight + 2) + "px";
                          updateCellOutcome(l.dayIndex, l.slotIndex, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingCell(null);
                          } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            const nextL = activeGroup.lessons[idx + 1];
                            setEditingCell(nextL ? { dayIndex: nextL.dayIndex, slotIndex: nextL.slotIndex } : null);
                          }
                        }}
                        className="w-full resize-y rounded-xl border border-[var(--accent)] bg-[var(--bg)] px-3 py-2 text-[16px] leading-relaxed"
                      />

                      <input
                        type="text"
                        value={state.teacherNotes[key] || ""}
                        onChange={(e) => updateTeacherNote(l.dayIndex, l.slotIndex, e.target.value)}
                        placeholder="Özel öğretmen notu (isteğe bağlı, resmi çıktıya girmez)"
                        className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-xs"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next = shiftGroupOutcomes(
                                state,
                                { subject: activeGroup.subject, section: activeGroup.section },
                                week,
                                l.dayIndex,
                                l.slotIndex,
                                1
                              );
                              onUpdateState(next, `${activeGroup.displayTitle} +1 öteleme`);
                              onNotify("Bu dersten sonraki konular 1 ders ileri ötelendi.");
                            }}
                            className="kd-btn min-h-9 px-2.5 text-xs"
                          >
                            Ötele +1 ↷
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = shiftGroupOutcomes(
                                state,
                                { subject: activeGroup.subject, section: activeGroup.section },
                                week,
                                l.dayIndex,
                                l.slotIndex,
                                -1
                              );
                              onUpdateState(next, `${activeGroup.displayTitle} -1 geri çekme`);
                              onNotify("Konular 1 ders geri çekildi.");
                            }}
                            className="kd-btn min-h-9 px-2.5 text-xs"
                          >
                            ↶ -1
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {activeGroup.lessons.length > 1 && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  const prev = activeGroup.lessons[idx - 1];
                                  if (prev) setEditingCell({ dayIndex: prev.dayIndex, slotIndex: prev.slotIndex });
                                }}
                                className="kd-btn min-h-10 px-3 text-xs"
                              >
                                ‹ Önceki
                              </button>
                              <button
                                type="button"
                                disabled={idx >= activeGroup.lessons.length - 1}
                                onClick={() => {
                                  const nxt = activeGroup.lessons[idx + 1];
                                  if (nxt) setEditingCell({ dayIndex: nxt.dayIndex, slotIndex: nxt.slotIndex });
                                }}
                                className="kd-btn min-h-10 px-3 text-xs"
                              >
                                Sonraki ›
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingCell(null)}
                            className="kd-btn kd-btn-primary min-h-10 px-4 text-xs"
                          >
                            Bitti
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : lines.length > 0 ? (
                    <div className="flex flex-col gap-1.5 pb-0.5">
                      {lines.map((line, i) => {
                        const { code, rest } = splitOutcomeCode(line);
                        return (
                          <p key={i} className="kd-outcome-text m-0">
                            {code && <span className="kd-code-pill">{code}</span>}
                            {rest}
                          </p>
                        );
                      })}
                      {state.teacherNotes[key] && (
                        <span className="text-xs text-[var(--muted)]">★ Not: {state.teacherNotes[key]}</span>
                      )}
                    </div>
                  ) : (
                    <p className="m-0 pb-1 text-[15px] text-[var(--muted)]">Kazanım girilmedi</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Sırayla Yapıştır Akordeonu */}
        <details className="kd-card mt-3 overflow-hidden">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 text-[16px] font-bold">
            Sırayla yapıştır
          </summary>
          <div className="flex flex-col gap-3 border-t border-[var(--line)] p-4">
            <p className="m-0 text-xs text-[var(--muted)]">
              Her satır yukarıdaki derslere sırayla yazılır. Aynı derste birden fazla kazanım varsa aralarına{" "}
              <code className="kd-code-pill">|</code> koyun.
            </p>
            <textarea
              rows={4}
              value={pasteBox}
              onChange={(e) => setPasteBox(e.target.value)}
              placeholder="M.7.1.1. Tam sayıların mutlak değerini belirler. | M.7.1.2. Sıralar."
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2.5 text-sm"
            />
            <div>
              <button type="button" onClick={applySequentialPaste} className="kd-btn kd-btn-primary">
                Derslere yerleştir
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};