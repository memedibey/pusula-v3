import { useEffect, useMemo, useRef, useState } from "react";
import { BulkBranchImporter } from "./components/BulkBranchImporter";
import { CockpitView } from "./components/CockpitView";
import { FloatingMissingDock } from "./components/FloatingMissingDock";
import { ReportView } from "./components/ReportView";
import { SearchModal } from "./components/SearchModal";
import { SubjectFlowView } from "./components/SubjectFlowView";
import { TimetableBuilder } from "./components/TimetableBuilder";
import { YearRadarModal } from "./components/YearRadarModal";
import {
  addDaysIso,
  buildCalendarTimeline,
  formatMonFriRange,
  getAdjacentHolidayNote,
  toMondayIso
} from "./core/calendarShift";
import { shareOrDownloadBlob } from "./core/mobileDownload";
import {
  formatFullDateTr,
  formatSubjectForCopy,
  formatWeekForCopy,
  generateProgressCsv,
  generateWeeklyClassbookHtml
} from "./core/officialExport";
import {
  buildWeeklyDocxBlob,
  buildWeeklyPdfBlob,
  buildWeeklyXlsxBlob,
  canvasToBlob,
  renderWeeklyCanvas
} from "./core/richExports";
import { MEB_2026_2027_CALENDAR, PusulaStateV3, getTeachingWeeks, groupTimetableLessons } from "./core/schema";
import { createDefaultStateV3, exportEmbeddedHtmlV3, loadStateV3, saveLocalV3, saveShadowDbV3 } from "./core/storage";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const FONT_SCALES = ["sm", "md", "lg", "xl"] as const;
type FontScale = (typeof FONT_SCALES)[number];

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function App() {
  const [init] = useState(() => loadStateV3());
  const [state, setState] = useState<PusulaStateV3>(init.state);
  const [history, setHistory] = useState<Array<{ label: string; snap: PusulaStateV3 }>>([]);
  const [todayIso] = useState(() => getTodayIso());

  const isMeb26 = toMondayIso(state.startMonday) === MEB_2026_2027_CALENDAR.term1Start;
  const teachingCount = useMemo(() => getTeachingWeeks(state), [state]);

  const timeline = useMemo(
    () => buildCalendarTimeline(state.startMonday, state.weekHolidays, teachingCount),
    [state.startMonday, state.weekHolidays, teachingCount]
  );

  const [specialPre, setSpecialPre] = useState<"prep" | "orient" | null>(() => {
    if (toMondayIso(init.state.startMonday) !== MEB_2026_2027_CALENDAR.term1Start) return null;
    const t = getTodayIso();
    if (t >= MEB_2026_2027_CALENDAR.teacherPrepStart && t < MEB_2026_2027_CALENDAR.orientationStart) return "prep";
    if (t >= MEB_2026_2027_CALENDAR.orientationStart && t < MEB_2026_2027_CALENDAR.term1Start) return "orient";
    return null;
  });

  const [activeMonday, setActiveMonday] = useState<string>(() => {
    const mon = toMondayIso(getTodayIso());
    const initTl = buildCalendarTimeline(init.state.startMonday, init.state.weekHolidays, getTeachingWeeks(init.state));
    const hit = initTl.find((s) => s.monday === mon);
    if (hit) return hit.monday;
    return mon < initTl[0].monday ? initTl[0].monday : initTl[initTl.length - 1].monday;
  });

  const [dayIndex, setDayIndex] = useState<number>(() => {
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? d - 1 : 0;
  });
  const [viewMode, setViewMode] = useState<"ders" | "kokpit">("ders");
  const [searchOpen, setSearchOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const navRef = useRef({ prev: () => {}, next: () => {}, canPrev: false, canNext: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [importSubTab, setImportSubTab] = useState<"file" | "text" | "backup">("file");
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    const s = localStorage.getItem("pusula_v3_font");
    return s === "sm" || s === "md" || s === "lg" || s === "xl" ? s : "md";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("pusula_v3_theme") === "dark" ? "dark" : "light"
  );
  const [banner, setBanner] = useState<string | null>(
    init.migratedFromLegacy ? "Eski v2 verileriniz kayıpsız olarak Pusula v3.0'a aktarıldı!" : null
  );

  const menuRef = useRef<HTMLDivElement | null>(null);
  const importDetailsRef = useRef<HTMLDetailsElement | null>(null);

  const slotIdx = useMemo(() => {
    const idx = timeline.findIndex((s) => s.monday === activeMonday);
    return idx >= 0 ? idx : 0;
  }, [timeline, activeMonday]);

  const activeSlot = timeline[slotIdx] || timeline[0];
  const isHolidayOrPre = specialPre !== null || activeSlot.kind === "holiday";
  const week = activeSlot.teachingWeek ?? 1;
  const [weekInput, setWeekInput] = useState<string>(() => (isHolidayOrPre ? "" : String(week)));

  useEffect(() => {
    setWeekInput(isHolidayOrPre ? "" : String(week));
  }, [isHolidayOrPre, week]);

  const groups = useMemo(
    () => groupTimetableLessons(state.timetable, state.slotsPerDay),
    [state.timetable, state.slotsPerDay]
  );

  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(() => groups[0]?.groupKey || "");
  const activeGroup = useMemo(
    () => groups.find((g) => g.groupKey === selectedGroupKey) || groups[0] || null,
    [groups, selectedGroupKey]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pusula_v3_theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute("data-font-scale", fontScale);
    localStorage.setItem("pusula_v3_font", fontScale);
  }, [fontScale]);
  useEffect(() => {
    saveLocalV3(state);
    void saveShadowDbV3(state);
  }, [state]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRadarOpen(false);
        setSearchOpen(false);
        setMenuOpen(false);
      }
      const tag = ((e.target as HTMLElement | null)?.tagName || "").toUpperCase();
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if ((e.key === "[" || e.key === "PageUp") && navRef.current.canPrev) { e.preventDefault(); navRef.current.prev(); }
        if ((e.key === "]" || e.key === "PageDown") && navRef.current.canNext) { e.preventDefault(); navRef.current.next(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const baseH = window.innerHeight;
    const updateKeyboard = () => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toUpperCase() || "";
      const isInput = tag === "TEXTAREA" || (tag === "INPUT" && (el as HTMLInputElement).type !== "file");
      const vv = window.visualViewport;
      const shrunk = vv ? baseH - vv.height > 140 : false;
      document.body.classList.toggle("keyboard-open", Boolean(isInput && shrunk));
    };
    window.visualViewport?.addEventListener("resize", updateKeyboard);
    document.addEventListener("focusin", updateKeyboard);
    document.addEventListener("focusout", () => setTimeout(updateKeyboard, 80));
    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboard);
      document.removeEventListener("focusin", updateKeyboard);
    };
  }, []);

  const notify = (msg: string) => {
    setBanner(msg);
    window.setTimeout(() => setBanner((cur) => (cur === msg ? null : cur)), 4200);
  };

  const applyUpdate = (next: PusulaStateV3, undoLabel: string) => {
    setHistory((h) => [{ label: undoLabel, snap: state }, ...h.slice(0, 14)]);
    setState(next);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const [top, ...rest] = history;
    setHistory(rest);
    setState(top.snap);
    notify(`Geri alındı: ${top.label}`);
  };

  const jumpToWeek = (w: number) => {
    const clamped = Math.min(teachingCount, Math.max(1, Math.round(w)));
    const found = timeline.find((s) => s.kind === "teaching" && s.teachingWeek === clamped);
    if (found) {
      setSpecialPre(null);
      setActiveMonday(found.monday);
    }
  };

  const handleDatePick = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (isMeb26 && iso >= MEB_2026_2027_CALENDAR.teacherPrepStart && iso < MEB_2026_2027_CALENDAR.orientationStart) {
      setSpecialPre("prep");
      notify("1–4 Eylül 2026: Öğretmenlerin Mesleki Çalışmaları (kazanım girilmez)");
      return;
    }
    if (isMeb26 && iso >= MEB_2026_2027_CALENDAR.orientationStart && iso < MEB_2026_2027_CALENDAR.term1Start) {
      setSpecialPre("orient");
      notify("7–11 Eylül 2026: Uyum Eğitimleri ve Rehberlik Çalışmaları (kazanım girilmez)");
      return;
    }
    setSpecialPre(null);
    const dt = new Date(`${iso}T00:00:00Z`);
    const rawDay = dt.getUTCDay();
    if (rawDay >= 1 && rawDay <= 5) setDayIndex(rawDay - 1);

    const mon = toMondayIso(iso);
    const hit = timeline.find((s) => s.monday === mon);
    if (hit) {
      setActiveMonday(hit.monday);
      if (hit.kind === "holiday") notify(`${formatMonFriRange(hit.monday)}: ${hit.holidayLabel} (kazanım girilmez)`);
    } else if (mon < timeline[0].monday) {
      setActiveMonday(timeline[0].monday);
      notify("Bu tarih 1. haftadan önce.");
    } else {
      setActiveMonday(timeline[timeline.length - 1].monday);
      notify(`Bu tarih ${teachingCount}. haftadan sonra.`);
    }
  };

  const canPrev = specialPre === "orient" || (specialPre === null && (slotIdx > 0 || isMeb26));
  const canNext = specialPre !== null || slotIdx < timeline.length - 1;

  const stepPrev = () => {
    if (specialPre === "orient") { setSpecialPre("prep"); return; }
    if (specialPre === "prep") return;
    if (slotIdx > 0) setActiveMonday(timeline[slotIdx - 1].monday);
    else if (isMeb26) setSpecialPre("orient");
  };

  const stepNext = () => {
    if (specialPre === "prep") { setSpecialPre("orient"); return; }
    if (specialPre === "orient") { setSpecialPre(null); setActiveMonday(timeline[0].monday); return; }
    if (slotIdx < timeline.length - 1) setActiveMonday(timeline[slotIdx + 1].monday);
  };

  const openSyncDrawer = () => {
    setImportSubTab("backup");
    if (importDetailsRef.current) {
      importDetailsRef.current.open = true;
      importDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const runRichExport = async (kind: "png" | "pdf" | "docx" | "xlsx") => {
    if (isHolidayOrPre) return;
    setMenuOpen(false);
    setExportBusy(kind);
    try {
      if (kind === "png") {
        const canvas = await renderWeeklyCanvas(state, week);
        const blob = await canvasToBlob(canvas, "image/png");
        canvas.width = 0; canvas.height = 0;
        await shareOrDownloadBlob(blob, `kazanim-${week}-hafta.png`, notify);
        notify(`${week}. hafta PNG indirildi.`);
      } else if (kind === "pdf") {
        const canvas = await renderWeeklyCanvas(state, week);
        const blob = await buildWeeklyPdfBlob(canvas);
        canvas.width = 0; canvas.height = 0;
        await shareOrDownloadBlob(blob, `kazanim-${week}-hafta.pdf`, notify);
        notify(`${week}. hafta PDF indirildi.`);
      } else if (kind === "docx") {
        await shareOrDownloadBlob(buildWeeklyDocxBlob(state, week), `kazanim-${week}-hafta.docx`, notify);
        notify(`${week}. hafta Word indirildi.`);
      } else {
        await shareOrDownloadBlob(buildWeeklyXlsxBlob(state, week), `kazanim-${week}-hafta.xlsx`, notify);
        notify(`${week}. hafta Excel indirildi.`);
      }
    } catch {
      notify("Çıktı oluşturulamadı.");
    } finally {
      setExportBusy(null);
    }
  };

  const copyActiveSubject = async () => {
    if (isHolidayOrPre || !activeGroup) return;
    try {
      await navigator.clipboard.writeText(formatSubjectForCopy(state, week, activeGroup));
      notify(`${activeGroup.displayTitle} kopyalandı.`);
    } catch { notify("Panoya kopyalanamadı."); }
  };

  const copyWholeWeek = async () => {
    if (isHolidayOrPre) return;
    try {
      await navigator.clipboard.writeText(formatWeekForCopy(state, week));
      notify(`${week}. hafta kopyalandı.`);
    } catch { notify("Panoya kopyalanamadı."); }
  };

  const adjacentNote = isHolidayOrPre ? null : getAdjacentHolidayNote(state.startMonday, week, state.weekHolidays);
  const preMeta =
    specialPre === "prep"
      ? {
          monday: "2026-08-31",
          range: "1 Eylül – 4 Eylül 2026",
          title: "Öğretmenlerin Mesleki Çalışmaları",
          desc: "Öğretmenlerin yeni eğitim ve öğretim yılına hazırlık amacıyla gerçekleştireceği mesleki çalışmalar 1 Eylül 2026 Salı günü başlar. Bu hafta ders işlenmediği için kazanım girilmez.",
          tag: "Mesleki çalışma"
        }
      : specialPre === "orient"
      ? {
          monday: "2026-09-07",
          range: "7 Eylül – 11 Eylül 2026",
          title: "Uyum Eğitimleri ve Rehberlik Çalışmaları",
          desc: "Okul öncesi, 1. sınıf, 5. sınıf, hazırlık ve 9. sınıf uyum eğitimleri ile rehberlik çalışmaları haftasıdır. Ders kazanımı girilmez.",
          tag: "Uyum / rehberlik"
        }
      : null;

  navRef.current = { prev: stepPrev, next: stepNext, canPrev, canNext };
  return (
    <>
      <div className="mx-auto flex max-w-[760px] flex-col gap-3.5 md:max-w-[920px] lg:max-w-[1060px]">
        {banner && (
          <div role="status" data-kd-runtime="1" className="fixed top-3 right-3 left-3 z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xl">
            <span>✓ {banner}</span>
            <button type="button" onClick={() => setBanner(null)} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs">Tamam</button>
          </div>
        )}

        <header className="grid gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-[22px] font-bold tracking-tight">Kazanım Defteri</h1>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)]">Pusula v3.0 · 1–12</span>
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">✓ Kaydedildi</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div ref={menuRef} className="relative">
                <button type="button" onClick={() => setMenuOpen((o) => !o)} className="kd-btn">
                  {exportBusy ? `Çıktı (${exportBusy.toUpperCase()})...` : "Çıktı al ▾"}
                </button>
                {menuOpen && (
                  <div className="kd-card absolute right-0 z-30 mt-1.5 w-64 overflow-hidden py-1 shadow-xl">
                    <div className="px-3.5 py-1 text-[11px] font-bold uppercase text-[var(--muted)]">
                      {isHolidayOrPre ? "Haftalık çıktı (tatilde kapalı)" : `${week}. Hafta Çıktısı`}
                    </div>
                    <button type="button" disabled={isHolidayOrPre} onClick={() => void runRichExport("png")} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)] disabled:opacity-40"><span>PNG indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.png</span></button>
                    <button type="button" disabled={isHolidayOrPre} onClick={() => void runRichExport("pdf")} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)] disabled:opacity-40"><span>PDF indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.pdf</span></button>
                    <button type="button" disabled={isHolidayOrPre} onClick={() => void runRichExport("docx")} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)] disabled:opacity-40"><span>Word indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.docx</span></button>
                    <button type="button" disabled={isHolidayOrPre} onClick={() => void runRichExport("xlsx")} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)] disabled:opacity-40"><span>Excel indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.xlsx</span></button>
                    <button type="button" disabled={isHolidayOrPre} onClick={() => {
                      setMenuOpen(false);
                      const html = generateWeeklyClassbookHtml(state, week);
                      const w = window.open("", "_blank");
                      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
                      else void shareOrDownloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `sinif-defteri-${week}-hafta.html`, notify);
                    }} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)] disabled:opacity-40"><span>Resmi Sınıf Defteri (A4)</span><span className="font-mono-num text-xs text-[var(--muted)]">yazdır</span></button>
                    <button type="button" onClick={() => { setMenuOpen(false); void shareOrDownloadBlob(generateProgressCsv(state, teachingCount), "zumre-raporu.csv", notify); }} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)]"><span>Zümre Raporu</span><span className="font-mono-num text-xs text-[var(--muted)]">.csv</span></button>
                    <div className="my-1 border-t border-[var(--line)]" />
                    <div className="px-3.5 py-1 text-[11px] font-bold uppercase text-[var(--muted)]">Çevrimdışı HTML Sürüm</div>
                    <button type="button" onClick={() => { setMenuOpen(false); void shareOrDownloadBlob(new Blob([exportEmbeddedHtmlV3(state)], { type: "text/html;charset=utf-8" }), `kazanim-defteri-pusula-v3-${todayIso}.html`, notify); }} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"><span>Verilerimle HTML indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.html</span></button>
                    <button type="button" onClick={async () => { setMenuOpen(false); try { await navigator.clipboard.writeText(exportEmbeddedHtmlV3()); notify("HTML kodu panoya kopyalandı."); } catch { notify("Panoya kopyalanamadı."); } }} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)]"><span>HTML kopyala</span><span className="text-xs text-[var(--muted)]">pano</span></button>
                    <button type="button" onClick={() => { setMenuOpen(false); void shareOrDownloadBlob(new Blob([exportEmbeddedHtmlV3(createDefaultStateV3())], { type: "text/html;charset=utf-8" }), "kazanim-defteri-bos-sablon.html", notify); }} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-3.5 text-left text-sm hover:bg-[var(--accent-soft)]"><span>HTML indir (boş şablon)</span><span className="font-mono-num text-xs text-[var(--muted)]">.html</span></button>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => { setSearchOpen((s) => !s); setRadarOpen(false); }} className="kd-btn">Ara</button>
              <button type="button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="kd-btn">{theme === "dark" ? "Açık tema" : "Koyu tema"}</button>
              <button type="button" onClick={() => { setImportSubTab("file"); if (importDetailsRef.current) { importDetailsRef.current.open = true; importDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); } }} className="kd-btn kd-btn-primary">Toplu ekle</button>
            </div>
          </div>

          {radarOpen && (
            <YearRadarModal
              state={state}
              timeline={timeline}
              activeMonday={activeSlot.monday}
              specialPre={specialPre}
              groups={groups}
              activeGroup={activeGroup}
              onJumpWeek={jumpToWeek}
              onJumpMonday={(mon) => { setSpecialPre(null); setActiveMonday(mon); }}
              onJumpPre={(pre) => setSpecialPre(pre)}
              onClose={() => setRadarOpen(false)}
            />
          )}

          {searchOpen && (
            <SearchModal state={state} onJump={(w, gk) => { jumpToWeek(w); if (gk) setSelectedGroupKey(gk); setViewMode("ders"); }} onClose={() => setSearchOpen(false)} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{isHolidayOrPre ? "Dönem" : "Hafta"}</span>
              <button type="button" disabled={!canPrev} onClick={stepPrev} className="kd-btn h-11 w-11 p-0 text-xl" aria-label="Önceki hafta">‹</button>
              <input
                type="number"
                min={1}
                max={teachingCount}
                value={weekInput}
                placeholder={isHolidayOrPre ? "Tatil" : undefined}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeekInput(val);
                  const n = Number(val);
                  if (Number.isInteger(n) && n >= 1 && n <= teachingCount) jumpToWeek(n);
                }}
                onBlur={() => setWeekInput(isHolidayOrPre ? "" : String(week))}
                className="font-mono-num h-11 w-[72px] rounded-xl border border-[var(--line)] bg-[var(--surface)] text-center text-lg font-bold"
              />
              <button type="button" disabled={!canNext} onClick={stepNext} className="kd-btn h-11 w-11 p-0 text-xl" aria-label="Sonraki hafta">›</button>
            </div>

            <div className="flex items-center gap-1.5">
              {!isHolidayOrPre && (
                <button type="button" onClick={() => setViewMode((m) => (m === "ders" ? "kokpit" : "ders"))} className="kd-btn text-xs">
                  {viewMode === "ders" ? "Günlük Kokpit" : "Ders Görünümü"}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setRadarOpen((r) => !r); setSearchOpen(false); }}
                className={`kd-btn text-xs ${radarOpen ? "kd-btn-primary" : ""}`}
              >
                {teachingCount} Hafta Harita
              </button>
              <button type="button" onClick={() => handleDatePick(todayIso)} className="kd-btn">Bugün</button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-center gap-2 min-[460px]:grid-cols-[minmax(0,1fr)_175px]">
            <div className="flex flex-col gap-0.5">
              {preMeta ? (
                <>
                  <span className="text-sm font-semibold">{preMeta.range} · {preMeta.title}</span>
                  <span className="text-xs text-[var(--muted)]">Ders dışı hafta · Kazanım girilmez</span>
                </>
              ) : activeSlot.kind === "holiday" ? (
                <>
                  <span className="text-sm font-semibold">{formatMonFriRange(activeSlot.monday)} · {activeSlot.holidayLabel}</span>
                  <span className="text-xs text-[var(--muted)]">Resmî tatil haftası · Kazanım girilmez</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-[var(--muted)]">
                    {formatMonFriRange(activeSlot.monday)}{activeSlot.termLabel ? ` · ${activeSlot.termLabel}` : ""} · {state.gradeLabel || state.kademe.toUpperCase()}
                  </span>
                  {adjacentNote && <span className="text-xs text-[var(--muted)]">{adjacentNote}</span>}
                </>
              )}
            </div>
            <input
              type="date"
              value={preMeta ? (specialPre === "prep" ? MEB_2026_2027_CALENDAR.teacherPrepStart : MEB_2026_2027_CALENDAR.orientationStart) : activeSlot.monday}
              onChange={(e) => handleDatePick(e.target.value)}
              aria-label="Tarih seçici"
              className="font-mono-num h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-sm"
            />
          </div>

          {!isHolidayOrPre && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={openSyncDrawer} className="min-h-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold hover:border-[var(--accent)]">⇄ Cihaz eşitle</button>
              <div className="flex items-center gap-1.5">
                {history.length > 0 && <button type="button" onClick={handleUndo} className="min-h-10 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-xs font-bold text-[var(--accent)]">↶ Geri al</button>}
                <button type="button" disabled={fontScale === FONT_SCALES[0]} onClick={() => { const i = FONT_SCALES.indexOf(fontScale); if (i > 0) setFontScale(FONT_SCALES[i - 1]); }} className="min-h-10 min-w-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-bold disabled:opacity-40">A−</button>
                <button type="button" disabled={fontScale === FONT_SCALES[FONT_SCALES.length - 1]} onClick={() => { const i = FONT_SCALES.indexOf(fontScale); if (i < FONT_SCALES.length - 1) setFontScale(FONT_SCALES[i + 1]); }} className="min-h-10 min-w-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-bold disabled:opacity-40">A+</button>
              </div>
            </div>
          )}
        </header>

        <main className="flex flex-col gap-3">
          {isHolidayOrPre ? (
            <section className="kd-card overflow-hidden">
              <div className="border-b border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3.5">
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  {preMeta ? "Dönem Öncesi Takvim" : "Resmî Tatil Haftası"}
                </p>
                <h2 className="m-0 mt-1 text-2xl font-bold">{preMeta ? preMeta.title : activeSlot.holidayLabel}</h2>
                <p className="font-mono-num m-0 mt-1 text-sm text-[var(--muted)]">
                  {preMeta ? preMeta.range : formatMonFriRange(activeSlot.monday)}
                </p>
              </div>

              <div className="flex flex-col gap-3 p-4">
                <p className="m-0 text-sm">
                  {preMeta ? preMeta.desc : "Bu hafta MEB çalışma takvimine göre tatildir. Ders işlenmez, kazanım yazılmaz ve hafta numaralandırmasına dahil edilmez."}
                </p>

                {!preMeta && (activeSlot.prevTeachingWeek !== null || activeSlot.nextTeachingWeek !== null) && (
                  <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-xs">
                    <strong className="text-[var(--accent)]">Hafta geçişi:</strong>{" "}
                    {activeSlot.prevTeachingWeek !== null ? `${activeSlot.prevTeachingWeek}. Hafta → ` : ""}
                    <strong>Tatil</strong>
                    {activeSlot.nextTeachingWeek !== null ? ` → ${activeSlot.nextTeachingWeek}. Hafta` : ""}
                  </div>
                )}

                <ol className="m-0 list-none overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)] p-0">
                  {DAY_NAMES.map((dayName, idx) => {
                    const baseMon = preMeta ? preMeta.monday : activeSlot.monday;
                    const dIso = addDaysIso(baseMon, idx);
                    const isBeforePrep = preMeta?.monday === "2026-08-31" && idx === 0;
                    return (
                      <li key={dayName} className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2 text-xs last:border-b-0">
                        <span><strong>{dayName}</strong> · <span className="font-mono-num text-[var(--muted)]">{formatFullDateTr(dIso)}</span></span>
                        <span className="text-[var(--muted)]">{isBeforePrep ? "Dönem öncesi" : preMeta ? preMeta.tag : "Tatil (kazanım girilmez)"}</span>
                      </li>
                    );
                  })}
                </ol>

                <div className="flex flex-wrap gap-2 pt-1">
                  {!preMeta && activeSlot.prevTeachingWeek !== null && (
                    <button type="button" onClick={() => jumpToWeek(activeSlot.prevTeachingWeek!)} className="kd-btn text-xs">
                      ‹ {activeSlot.prevTeachingWeek}. Ders Haftası
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => jumpToWeek(preMeta ? 1 : (activeSlot.nextTeachingWeek ?? 1))}
                    className="kd-btn kd-btn-primary text-xs"
                  >
                    {preMeta ? "1. Ders Haftasına Git (14 Eylül 2026) ›" : `${activeSlot.nextTeachingWeek ?? 1}. Ders Haftası ›`}
                  </button>
                </div>
              </div>
            </section>
          ) : viewMode === "ders" ? (
            <SubjectFlowView state={state} week={week} todayIso={todayIso} groups={groups} activeGroup={activeGroup} onSelectGroup={setSelectedGroupKey} onUpdateState={applyUpdate} onNotify={notify} />
          ) : (
            <CockpitView state={state} week={week} dayIndex={dayIndex} onChangeDay={setDayIndex} onUpdateState={applyUpdate} onNotify={notify} />
          )}

          <details className="kd-card overflow-hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 py-3 text-[16px] font-bold">
              <span>Ayarlar: 1–12. sınıf programı, şubeler ve MEB takvimi</span>
              <span className="text-xs font-semibold text-[var(--muted)]">{state.slotsPerDay} saat/gün ▾</span>
            </summary>
            <div className="border-t border-[var(--line)] p-3.5">
              <TimetableBuilder state={state} onUpdateState={applyUpdate} onOpenDate={handleDatePick} onNotify={notify} />
            </div>
          </details>

          <details ref={importDetailsRef} className="kd-card overflow-hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 py-3 text-[16px] font-bold">
              <span>Toplu ekleme ve yedek</span>
              <span className="font-mono-num text-xs text-[var(--muted)]">.xlsx · .docx · .pdf · .json ▾</span>
            </summary>
            <div className="border-t border-[var(--line)] p-3.5">
              <BulkBranchImporter state={state} subTab={importSubTab} onChangeSubTab={setImportSubTab} onUpdateState={applyUpdate} onNotify={notify} />
            </div>
          </details>

          <details className="kd-card overflow-hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 py-3 text-[16px] font-bold">
              <span>Zümre şube ilerleme raporu</span>
              <span className="text-xs font-semibold text-[var(--muted)]">% gerçekleşme ▾</span>
            </summary>
            <div className="border-t border-[var(--line)] p-3.5"><ReportView state={state} week={week} onNotify={notify} /></div>
          </details>
        </main>
      </div>

      {!isHolidayOrPre && (
        <FloatingMissingDock state={state} week={week} groups={groups} onJumpToGroup={(gk) => { setSelectedGroupKey(gk); setViewMode("ders"); }} />
      )}

      <div className="bottom-bar fixed inset-x-0 bottom-0 z-20 px-[max(14px,env(safe-area-inset-right,0px))] pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pl-[max(14px,env(safe-area-inset-left,0px))]">
        <div className="mx-auto grid max-w-[760px] grid-cols-[1.25fr_1fr] gap-2.5 md:max-w-[920px] lg:max-w-[1060px]">
          <button type="button" disabled={isHolidayOrPre} onClick={copyActiveSubject} className="kd-btn kd-btn-primary min-h-11">Dersi kopyala</button>
          <button type="button" disabled={isHolidayOrPre} onClick={copyWholeWeek} className="kd-btn min-h-11">Haftayı kopyala</button>
        </div>
      </div>
    </>
  );
}

export default App;