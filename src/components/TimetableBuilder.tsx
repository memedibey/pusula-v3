import React, { useMemo, useState } from "react";
import { formatMonFriRange, toMondayIso } from "../core/calendarShift";
import { PROGRAM_TEMPLATES, ProgramTemplate, SUBJECT_CATALOG_BY_KADEME, getKademeSubjects } from "../core/mebCatalog";
import { Kademe, MEB_2026_2027_CALENDAR, PusulaStateV3, TeacherMode, TimetableCell } from "../core/schema";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const KADEME_NAMES: Record<Kademe, string> = {
  ilkokul: "İlkokul (1–4)",
  ortaokul: "Ortaokul (5–8)",
  lise: "Lise (9–12)"
};

interface Props {
  state: PusulaStateV3;
  onUpdateState: (next: PusulaStateV3, undoLabel: string) => void;
  onOpenDate?: (iso: string) => void;
  onNotify: (msg: string) => void;
}

export const TimetableBuilder: React.FC<Props> = ({ state, onUpdateState, onOpenDate, onNotify }) => {
  const [holWeekDate, setHolWeekDate] = useState("");
  const [holWeekLabel, setHolWeekLabel] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [brushSubject, setBrushSubject] = useState<string | null>(null);
  const [brushSection, setBrushSection] = useState("");
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const kademeSubjects = useMemo(
    () => getKademeSubjects(state.kademe, state.subjectCatalog),
    [state.kademe, state.subjectCatalog]
  );

  const visibleTemplates = useMemo(
    () => (showAllTemplates ? PROGRAM_TEMPLATES : PROGRAM_TEMPLATES.filter((t) => t.kademe === state.kademe)),
    [showAllTemplates, state.kademe]
  );

  const changeKademe = (nextKademe: Kademe) => {
    setBrushSubject(null);
    onUpdateState({ ...state, kademe: nextKademe, updatedAt: Date.now() }, `Kademe: ${KADEME_NAMES[nextKademe]}`);
  };

  const updateKademeCatalog = (nextList: string[], label: string) => {
    const nextCatalog = { ...(state.subjectCatalog || {}), [state.kademe]: nextList };
    onUpdateState({ ...state, subjectCatalog: nextCatalog, updatedAt: Date.now() }, label);
  };

  const addSubjectToKademe = () => {
    const clean = newSubject.trim();
    if (!clean) return;
    if (kademeSubjects.some((s) => s.toLocaleLowerCase("tr-TR") === clean.toLocaleLowerCase("tr-TR"))) {
      setBrushSubject(clean);
      setNewSubject("");
      onNotify(`${clean} zaten bu kademede mevcut.`);
      return;
    }
    updateKademeCatalog([...kademeSubjects, clean], `${clean} dersi eklendi`);
    setBrushSubject(clean);
    setNewSubject("");
    onNotify(`${clean}, ${KADEME_NAMES[state.kademe]} ders havuzuna eklendi.`);
  };

  const removeSubjectFromKademe = (subj: string) => {
    const nextList = kademeSubjects.filter((s) => s !== subj);
    if (brushSubject === subj) setBrushSubject(null);
    updateKademeCatalog(nextList, `${subj} dersi havuzdan çıkarıldı`);
    onNotify(`${subj} bu kademe listesinden çıkarıldı.`);
  };

  const resetKademeCatalog = () => {
    const nextCatalog = { ...(state.subjectCatalog || {}) };
    delete nextCatalog[state.kademe];
    onUpdateState({ ...state, subjectCatalog: nextCatalog, updatedAt: Date.now() }, "Kademe dersleri varsayılana döndü");
    onNotify(`${KADEME_NAMES[state.kademe]} dersleri MEB varsayılanına sıfırlandı.`);
  };

  const changeSlotsPerDay = (nextSlots: number) => {
    const clamped = Math.min(10, Math.max(4, nextSlots));
    const nextTt = state.timetable.map((day) => Array.from({ length: clamped }, (_, i) => day[i] ?? null));
    onUpdateState(
      { ...state, slotsPerDay: clamped, timetable: nextTt, updatedAt: Date.now() },
      `Günlük ders saati ${clamped} olarak güncellendi`
    );
  };

  const applyTemplate = (tpl: ProgramTemplate) => {
    const nextTt = tpl.timetable.map((day) => day.map((c) => (c ? { ...c } : null)));
    setBrushSubject(null);
    onUpdateState(
      {
        ...state,
        kademe: tpl.kademe,
        mode: tpl.mode,
        gradeLabel: tpl.title,
        slotsPerDay: tpl.slotsPerDay,
        timetable: nextTt,
        updatedAt: Date.now()
      },
      `${tpl.title} şablonu uygulandı`
    );
    onNotify(`${tpl.title} uygulandı (mevcut kazanımlar korundu).`);
  };

  const applyMebCalendar = () => {
    onUpdateState(
      {
        ...state,
        startMonday: MEB_2026_2027_CALENDAR.term1Start,
        weekHolidays: MEB_2026_2027_CALENDAR.weekHolidays.map((h) => ({ ...h })),
        dayHolidays: {},
        updatedAt: Date.now()
      },
      "2026–2027 MEB çalışma takvimi uygulandı"
    );
    onNotify("2026–2027 MEB çalışma takvimi uygulandı.");
  };

  const addWeekHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holWeekDate)) { onNotify("Geçerli bir tatil tarihi seçin."); return; }
    const mon = toMondayIso(holWeekDate);
    const label = holWeekLabel.trim() || "Tatil Haftası";
    const next = [...state.weekHolidays.filter((h) => toMondayIso(h.monday) !== mon), { monday: mon, label }].sort((a, b) => a.monday < b.monday ? -1 : a.monday > b.monday ? 1 : 0);
    onUpdateState({ ...state, weekHolidays: next, updatedAt: Date.now() }, "Tatil haftası eklendi");
    setHolWeekDate("");
    setHolWeekLabel("");
    onNotify("Tatil haftası eklendi.");
  };

  const removeWeekHoliday = (mon: string) => {
    onUpdateState({ ...state, weekHolidays: state.weekHolidays.filter((h) => h.monday !== mon), updatedAt: Date.now() }, "Tatil haftası kaldırıldı");
    onNotify("Tatil haftası kaldırıldı.");
  };

  const updateCell = (dayIdx: number, slotIdx: number, patch: Partial<TimetableCell> | null) => {
    let finalCell: TimetableCell | null = null;
    if (patch !== null) {
      const cur = state.timetable[dayIdx]?.[slotIdx] || { subject: "", section: "" };
      const nextCell: TimetableCell = {
        subject: patch.subject !== undefined ? patch.subject : cur.subject,
        section: patch.section !== undefined ? patch.section : cur.section
      };
      finalCell = !nextCell.subject.trim() && !(nextCell.section || "").trim() ? null : nextCell;
    }
    const nextTt = state.timetable.map((row, d) => (d === dayIdx ? row.map((cell, s) => (s === slotIdx ? finalCell : cell)) : row));
    onUpdateState({ ...state, timetable: nextTt, updatedAt: Date.now() }, "Ders programı düzenleme");
  };

  const datalistId = `kd-subjects-${state.kademe}`;

  return (
    <section className="flex flex-col gap-4">
      <datalist id={datalistId}>
        {kademeSubjects.map((s) => <option key={s} value={s} />)}
      </datalist>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-[var(--muted)]">Öğretim Kademesi</label>
          <select value={state.kademe} onChange={(e) => changeKademe(e.target.value as Kademe)} className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm font-semibold">
            <option value="ilkokul">İlkokul (1–4. Sınıf)</option>
            <option value="ortaokul">Ortaokul (5–8. Sınıf)</option>
            <option value="lise">Ortaöğretim / Lise (9–12. Sınıf)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-[var(--muted)]">Çalışma Kipi</label>
          <select value={state.mode} onChange={(e) => onUpdateState({ ...state, mode: e.target.value as TeacherMode, updatedAt: Date.now() }, "Kip değişti")} className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm font-semibold">
            <option value="sinif">Sınıf Öğretmeni (Tek Şube, Çok Ders)</option>
            <option value="brans">Branş Öğretmeni (Çoklu Şube: 7/A, 10/B…)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-[var(--muted)]">Günde Kaç Ders Saati?</label>
          <select value={state.slotsPerDay} onChange={(e) => changeSlotsPerDay(Number(e.target.value))} className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm font-semibold">
            {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>Günde {n} Saat ({n * 5} saat/hafta)</option>)}
          </select>
        </div>
      </div>

      {/* Kademeye Göre Ders Havuzu (Ekle / Çıkar / Hızlı Yerleştir) */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="m-0 text-sm font-bold">{KADEME_NAMES[state.kademe]} · Ders Havuzu (Ekle / Çıkar)</h3>
            <p className="m-0 text-xs text-[var(--muted)]">
              İstediğin dersi ekle veya × ile çıkar; bir derse tıklayıp aşağıdaki saatlerde <strong>+</strong> ile tek tıkla yerleştir.
            </p>
          </div>
          {kademeSubjects.join("|") !== SUBJECT_CATALOG_BY_KADEME[state.kademe].join("|") && (
            <button type="button" onClick={resetKademeCatalog} className="kd-btn min-h-9 px-2.5 text-xs">MEB varsayılanına dön</button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {kademeSubjects.map((subj) => {
            const active = brushSubject === subj;
            return (
              <span
                key={subj}
                className={`inline-flex items-center overflow-hidden rounded-full border text-xs font-semibold transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border-[var(--line)] bg-[var(--surface)] text-[var(--fg)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setBrushSubject(active ? null : subj)}
                  className="min-h-8 border-0 bg-transparent px-3 py-1 text-left font-semibold text-inherit"
                >
                  {active ? "✓ " : ""}{subj}
                </button>
                <button
                  type="button"
                  onClick={() => removeSubjectFromKademe(subj)}
                  aria-label={`${subj} dersini çıkar`}
                  className="min-h-8 border-0 border-l border-current/15 bg-transparent px-2 py-1 text-xs opacity-70 hover:opacity-100 text-inherit"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubjectToKademe(); } }}
            placeholder={`${KADEME_NAMES[state.kademe]} için yeni ders adı ekle...`}
            className="h-10 min-w-[200px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
          />
          {state.mode === "brans" && brushSubject && (
            <input
              type="text"
              value={brushSection}
              onChange={(e) => setBrushSection(e.target.value)}
              placeholder="Şube (ör. 10/A)"
              className="h-10 w-28 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm"
            />
          )}
          <button type="button" onClick={addSubjectToKademe} className="kd-btn kd-btn-primary min-h-10 text-xs">+ Ders ekle</button>
        </div>
      </div>

      {/* Hazır MEB Şablonları */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-bold">Hazır MEB Şablonları · {showAllTemplates ? "Tüm Kademeler" : KADEME_NAMES[state.kademe]}</h3>
          <button type="button" onClick={() => setShowAllTemplates((v) => !v)} className="border-0 bg-transparent p-0 text-xs font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
            {showAllTemplates ? `Yalnız ${KADEME_NAMES[state.kademe]} göster` : "Tüm kademeleri göster"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {visibleTemplates.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)} className="flex flex-col items-start gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-left hover:border-[var(--accent)]">
              <span className="text-sm font-bold text-[var(--accent)]">{tpl.title}</span>
              <span className="text-xs text-[var(--muted)]">{tpl.summary}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Haftalık Ders Programı Izgarası */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {DAY_NAMES.map((dayName, dIdx) => (
          <div key={dayName} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
            <h4 className="m-0 mb-2 text-sm font-bold">{dayName}</h4>
            <div className="flex flex-col gap-2">
              {Array.from({ length: state.slotsPerDay }, (_, sIdx) => {
                const cell = state.timetable[dIdx]?.[sIdx];
                return (
                  <div key={sIdx} className="flex items-center gap-1.5">
                    <span className="font-mono-num w-5 text-center text-xs font-bold text-[var(--muted)]">{sIdx + 1}</span>
                    {state.mode === "brans" && (
                      <input type="text" value={cell?.section || ""} onChange={(e) => updateCell(dIdx, sIdx, { section: e.target.value })} placeholder="Şube" className="h-10 w-20 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm" />
                    )}
                    <input
                      type="text"
                      list={datalistId}
                      value={cell?.subject || ""}
                      onChange={(e) => updateCell(dIdx, sIdx, { subject: e.target.value })}
                      placeholder="Ders seç veya yaz"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm"
                    />
                    {brushSubject && (
                      <button
                        type="button"
                        onClick={() => updateCell(dIdx, sIdx, { subject: brushSubject, section: state.mode === "brans" ? brushSection.trim() : undefined })}
                        title={`${brushSubject} yerleştir`}
                        className="h-10 min-w-8 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2 text-xs font-bold text-[var(--accent)]"
                      >
                        +
                      </button>
                    )}
                    {cell && (
                      <button
                        type="button"
                        onClick={() => updateCell(dIdx, sIdx, null)}
                        title="Dersi bu saatten çıkar"
                        className="h-10 min-w-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 2026-2027 MEB Çalışma Takvimi ve Tatil Haftaları */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="startMonV3" className="text-xs font-bold uppercase text-[var(--muted)]">1. hafta Pazartesi tarihi</label>
            <input
              id="startMonV3"
              type="date"
              value={state.startMonday}
              onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onUpdateState({ ...state, startMonday: toMondayIso(e.target.value), updatedAt: Date.now() }, "Başlangıç tarihi değişti"); }}
              className="font-mono-num h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm"
            />
          </div>
          <button type="button" onClick={applyMebCalendar} className="kd-btn text-xs">MEB 2026–2027 takvimini uygula</button>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
          <h3 className="m-0 text-sm font-bold">2026–2027 MEB Çalışma Takvimi ve Tatil Haftaları</h3>
          <span className="font-mono-num text-xs text-[var(--muted)]">Toplam 37 ders haftası</span>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-[var(--muted)] sm:grid-cols-2">
          <button type="button" onClick={() => onOpenDate?.("2026-09-01")} className="border-0 bg-transparent p-0 text-left text-xs text-[var(--muted)] underline-offset-2 hover:underline">Mesleki çalışmalar: 1 Eylül 2026 Salı (kazanım yok)</button>
          <button type="button" onClick={() => onOpenDate?.("2026-09-07")} className="border-0 bg-transparent p-0 text-left text-xs text-[var(--muted)] underline-offset-2 hover:underline">Uyum eğitimleri (1, 5, Hazırlık, 9): 7–11 Eylül 2026 (kazanım yok)</button>
          <span>1. Dönem: 14 Eylül 2026 – 22 Ocak 2027 (18 hafta)</span>
          <span>Sonbahar Ara Tatili: 16–20 Kasım 2026 (tatil, hafta sayılmaz)</span>
          <span>Yarıyıl Tatili: 25 Ocak – 5 Şubat 2027 (2 hafta, hafta sayılmaz)</span>
          <span>2. Dönem: 8 Şubat – 25 Haziran 2027 (19 hafta)</span>
          <span>Bahar Ara Tatili: 8–12 Mart 2027 (tatil, hafta sayılmaz)</span>
          <span>Kapanış: 25 Haziran 2027 Cuma</span>
        </div>

        <div className="border-t border-[var(--line)] pt-2">
          <span className="mb-1.5 block text-xs font-bold uppercase text-[var(--muted)]">Tatil haftaları — kazanım yazılmaz ({state.weekHolidays.length})</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {state.weekHolidays.map((h) => (
              <li key={h.monday} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs">
                <span><strong className="font-mono-num">{formatMonFriRange(h.monday)}</strong> · {h.label}</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onOpenDate?.(h.monday)} className="min-h-9 border-0 bg-transparent px-2 text-xs font-semibold underline-offset-2 hover:underline">Göster</button>
                  <button type="button" onClick={() => removeWeekHoliday(h.monday)} className="min-h-9 border-0 bg-transparent px-2 text-xs font-semibold text-[var(--accent)]">Kaldır</button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[155px_1fr_auto]">
            <input type="date" value={holWeekDate} onChange={(e) => setHolWeekDate(e.target.value)} className="font-mono-num h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm" />
            <input type="text" value={holWeekLabel} onChange={(e) => setHolWeekLabel(e.target.value)} placeholder="Tatil açıklaması (ör. Ara Tatil)" className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm" />
            <button type="button" onClick={addWeekHoliday} className="kd-btn text-xs">Tatil haftası ekle</button>
          </div>
        </div>
      </div>
    </section>
  );
};