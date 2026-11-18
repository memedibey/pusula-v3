import React, { useMemo, useRef, useState } from "react";
import { distributePlanToSections, rebalanceWeeklyPlan } from "../core/branchPlanner";
import { ParsedPlanResult, parseDocxPlan, parsePdfPlan, parsePlainTextPlan, parseXlsxPlan } from "../core/docxXlsxParser";
import { shareOrDownloadBlob } from "../core/mobileDownload";
import { parseBackupJson } from "../core/officialExport";
import { buildWeeklyXlsxBlob } from "../core/richExports";
import { PusulaStateV3, groupTimetableLessons, getTeachingWeeks, makeCellKey } from "../core/schema";
import { SyncMergeAnalysis, analyzeSyncMerge, applySyncMerge, decodeSyncCode, encodeSyncCode } from "../core/syncEngine";

interface Props {
  state: PusulaStateV3;
  subTab?: "file" | "text" | "backup";
  onChangeSubTab?: (t: "file" | "text" | "backup") => void;
  onUpdateState: (next: PusulaStateV3, undoLabel: string) => void;
  onNotify: (msg: string) => void;
}

function buildTemplateCsv(state: PusulaStateV3): Blob {
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  const lines = ["Hafta;Ders;Kazanım (Aynı haftada birden çok kazanım için | kullanın)"];
  const totalW = getTeachingWeeks(state);
  for (let w = 1; w <= totalW; w++) {
    groups.forEach((g) => {
      const first = g.lessons[0];
      const existing = first ? (state.outcomes[makeCellKey(w, first.dayIndex, first.slotIndex)] || "").replace(/\r?\n+/g, " | ") : "";
      lines.push(`${w};"${g.displayTitle}";"${existing.replace(/"/g, '""')}"`);
    });
  }
  return new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

export const BulkBranchImporter: React.FC<Props> = ({
  state,
  subTab,
  onChangeSubTab,
  onUpdateState,
  onNotify
}) => {
  const [innerTab, setInnerTab] = useState<"file" | "text" | "backup">("file");
  const activeTab = subTab ?? innerTab;
  const setActiveTab = onChangeSubTab ?? setInnerTab;

  const groups = useMemo(() => groupTimetableLessons(state.timetable, state.slotsPerDay), [state.timetable, state.slotsPerDay]);
  const uniqueSubjects = useMemo(() => Array.from(new Set(groups.map((g) => g.subject))), [groups]);

  const [selectedSubject, setSelectedSubject] = useState<string>("auto");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [distMode, setDistMode] = useState<"spread" | "sequential">("spread");
  const [balance37, setBalance37] = useState(true);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<{ res: ParsedPlanResult; resolvedSubject: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [syncInput, setSyncInput] = useState("");
  const [syncModal, setSyncModal] = useState<{ incoming: PusulaStateV3; analysis: SyncMergeAnalysis; source: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const totalWeeks = getTeachingWeeks(state);
  const effectiveSubject =
    selectedSubject === "auto"
      ? parsed?.resolvedSubject || uniqueSubjects[0] || ""
      : uniqueSubjects.includes(selectedSubject)
      ? selectedSubject
      : uniqueSubjects[0] || "";

  const availableSections = useMemo(
    () =>
      groups
        .filter((g) => g.subject === effectiveSubject)
        .map((g) => g.section || "")
        .filter((v, i, arr) => arr.indexOf(v) === i),
    [groups, effectiveSubject]
  );

  const processFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    const f = fileList[0];
    setBusy(true);
    try {
      const lower = f.name.toLocaleLowerCase("tr-TR");
      if (lower.endsWith(".json")) {
        const next = parseBackupJson(await f.text());
        setSyncModal({ incoming: next, analysis: analyzeSyncMerge(state, next), source: f.name });
        setActiveTab("backup");
        onNotify(`${f.name} okundu, birleştirme onayı bekleniyor.`);
        return;
      }
      const buf = await f.arrayBuffer();
      let res: ParsedPlanResult;
      if (lower.endsWith(".docx")) res = await parseDocxPlan(buf, uniqueSubjects, totalWeeks);
      else if (lower.endsWith(".xlsx")) res = await parseXlsxPlan(buf, uniqueSubjects, totalWeeks);
      else if (lower.endsWith(".pdf")) res = await parsePdfPlan(buf, uniqueSubjects, totalWeeks);
      else res = parsePlainTextPlan(new TextDecoder("utf-8").decode(buf), uniqueSubjects, totalWeeks);

      if (res.totalItems === 0) {
        onNotify("Dosyada hafta ve kazanım eşleşmesi bulunamadı.");
        setParsed(null);
      } else {
        const resolved = selectedSubject !== "auto" ? selectedSubject : res.detectedSubject || uniqueSubjects[0] || "";
        setParsed({ res, resolvedSubject: resolved });
        setSelectedSections(
          groups.filter((g) => g.subject === resolved).map((g) => g.section || "").filter((v, i, arr) => arr.indexOf(v) === i)
        );
        onNotify(`${resolved ? resolved + " · " : ""}${res.weeksDetected} haftadan ${res.totalItems} kazanım tanındı.`);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Dosya okunamadı.");
    } finally {
      setBusy(false);
    }
  };

  const activeWeeklyMap = useMemo(() => {
    if (!parsed) return {};
    const bySubj = parsed.res.outcomesBySubject;
    const matchedKey = bySubj
      ? Object.keys(bySubj).find((k) => k.toLocaleLowerCase("tr-TR") === effectiveSubject.toLocaleLowerCase("tr-TR"))
      : undefined;
    return matchedKey && bySubj ? bySubj[matchedKey] : parsed.res.weeklyOutcomes;
  }, [parsed, effectiveSubject]);

  const missingWeeks37 = useMemo(() => {
    const out: number[] = [];
    for (let w = 1; w <= totalWeeks; w++) if (!activeWeeklyMap[w] || activeWeeklyMap[w].length === 0) out.push(w);
    return out;
  }, [activeWeeklyMap, totalWeeks]);

  const matchedMultiSubjects = useMemo(() => {
    const bySubj = parsed?.res.outcomesBySubject;
    if (!bySubj) return [];
    return Object.keys(bySubj).filter((k) =>
      uniqueSubjects.some((u) => u.toLocaleLowerCase("tr-TR") === k.toLocaleLowerCase("tr-TR"))
    );
  }, [parsed, uniqueSubjects]);

  const handleApplyAllSubjects = () => {
    if (!parsed || !parsed.res.outcomesBySubject || matchedMultiSubjects.length < 2) return;
    let cur = state;
    let totalCells = 0;
    matchedMultiSubjects.forEach((subjKey) => {
      const targetSubj = uniqueSubjects.find((u) => u.toLocaleLowerCase("tr-TR") === subjKey.toLocaleLowerCase("tr-TR")) || subjKey;
      const rawMap = parsed.res.outcomesBySubject![subjKey] || {};
      const filledW = Object.keys(rawMap).length;
      const weeklyOutcomes = balance37 && filledW >= 15 && filledW !== totalWeeks ? rebalanceWeeklyPlan(rawMap, totalWeeks) : rawMap;
      const secs = groups.filter((g) => g.subject === targetSubj).map((g) => g.section || "").filter((v, i, arr) => arr.indexOf(v) === i);
      const res = distributePlanToSections(cur, { subject: targetSubj, sections: secs, weeklyOutcomes, mode: distMode, skipDayHolidays: true });
      cur = res.nextState;
      totalCells += res.writtenCells;
    });
    onUpdateState(cur, `${matchedMultiSubjects.length} ders toplu dağıtıldı (${totalCells} hücre)`);
    onNotify(`${matchedMultiSubjects.length} ders (${matchedMultiSubjects.join(", ")}) -> ${totalCells} hücreye yazıldı.`);
    setParsed(null);
  };

  const handleApplyPlan = () => {
    if (!parsed || !effectiveSubject) return;
    const filledW = totalWeeks - missingWeeks37.length;
    const shouldBalance = balance37 && filledW >= 15 && (missingWeeks37.length > 0 || Object.keys(activeWeeklyMap).length > totalWeeks);
    const weeklyOutcomes = shouldBalance ? rebalanceWeeklyPlan(activeWeeklyMap, totalWeeks) : activeWeeklyMap;

    const targets = selectedSections.length > 0 ? selectedSections : availableSections;
    const res = distributePlanToSections(state, {
      subject: effectiveSubject,
      sections: targets,
      weeklyOutcomes,
      mode: distMode,
      skipDayHolidays: true
    });
    onUpdateState(res.nextState, `${effectiveSubject} planı dağıtıldı (${res.writtenCells} hücre)`);
    onNotify(`${effectiveSubject}: ${Object.keys(weeklyOutcomes).length} haftada ${res.writtenCells} ders hücresine dengeli yazıldı.`);
    setParsed(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 border-b border-[var(--line)]" role="tablist">
        {([["file", "Dosyadan yükle"], ["text", "Metin yapıştır"], ["backup", "Eşitle ve yedek"]] as const).map(([id, lbl]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`min-h-11 border-0 border-b-2 bg-transparent px-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)]"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <input ref={fileInputRef} type="file" accept=".docx,.xlsx,.pdf,.csv,.txt,.json" onChange={(e) => { void processFiles(e.target.files ? Array.from(e.target.files) : []); e.target.value = ""; }} className="hidden" />
      <input ref={jsonInputRef} type="file" accept=".json" onChange={async (e) => { if (e.target.files?.[0]) await processFiles([e.target.files[0]]); e.target.value = ""; }} className="hidden" />

      {activeTab === "file" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.45fr_1fr]">
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !busy && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const fl = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : []; if (fl.length > 0 && !busy) void processFiles(fl); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${dragOver ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] hover:border-[var(--accent)]"}`}
            >
              <span className="text-sm font-bold">{busy ? "Dosya okunuyor..." : "Yıllık planı buraya sürükleyip bırakın veya seçin"}</span>
              <span className="font-mono-num text-xs text-[var(--muted)]">.xlsx · .docx · .pdf · .csv · .txt</span>
              <span className="kd-btn kd-btn-primary mt-1 min-h-10 text-xs">{busy ? "Çözümleniyor..." : "Dosya seç"}</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--muted)]">Hedef Ders (Otomatik Tanır)</label>
                <select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedSections([]); }} className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 text-sm font-semibold">
                  <option value="auto">Otomatik (dosyadan tanı)</option>
                  {uniqueSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--muted)]">Haftalık Saatlere Dağıtım</label>
                <div className="grid h-11 grid-cols-2 overflow-hidden rounded-xl border border-[var(--line)]">
                  <button type="button" onClick={() => setDistMode("spread")} className={`border-0 text-xs font-semibold ${distMode === "spread" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}>Tüm saatlere yay</button>
                  <button type="button" onClick={() => setDistMode("sequential")} className={`border-0 border-l border-[var(--line)] text-xs font-semibold ${distMode === "sequential" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--bg)] text-[var(--muted)]"}`}>Sadece sıra kadar</button>
                </div>
              </div>
            </div>

            {availableSections.some(Boolean) && (
              <div className="flex flex-wrap gap-1.5">
                {availableSections.map((sec) => {
                  const checked = selectedSections.includes(sec);
                  return (
                    <button key={sec || "genel"} type="button" onClick={() => setSelectedSections((p) => p.includes(sec) ? p.filter((x) => x !== sec) : [...p, sec])} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${checked ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]"}`}>
                      {checked ? "✓ " : ""}{sec}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3">
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase text-[var(--muted)]">Kişisel Şablon İndir</div>
              <button type="button" onClick={() => void shareOrDownloadBlob(buildWeeklyXlsxBlob(state, 1), "kazanim-excel-yedek.xlsx", onNotify)} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-2 text-left text-sm font-medium hover:text-[var(--accent)]">
                <span>Excel çalışma kitabı indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.xlsx</span>
              </button>
              <button type="button" onClick={() => void shareOrDownloadBlob(buildTemplateCsv(state), "kazanim-kisisel-sablon.csv", onNotify)} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-2 text-left text-sm font-medium hover:text-[var(--accent)]">
                <span>Kişisel CSV şablonu indir</span><span className="font-mono-num text-xs text-[var(--muted)]">.csv</span>
              </button>
            </div>
            <p className="m-0 border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">Word (.docx) ve Excel (.xlsx) internetsiz açılır; PDF için internet gerekir.</p>
          </div>
        </div>
      )}

      {activeTab === "text" && (
        <div className="flex flex-col gap-3">
          <textarea rows={5} value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder={"1;M.7.1.1. Tam sayılarla toplama yapar.\n2;M.7.1.2. Çıkarma yapar."} className="font-mono-num w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-xs" />
          <div>
            <button type="button" onClick={() => {
              const res = parsePlainTextPlan(rawText, uniqueSubjects, totalWeeks);
              if (res.totalItems === 0) { onNotify("Metinde hafta ve kazanım bulunamadı."); return; }
              const resolved = selectedSubject !== "auto" ? selectedSubject : res.detectedSubject || uniqueSubjects[0] || "";
              setParsed({ res, resolvedSubject: resolved });
              setSelectedSections(availableSections);
              onNotify(`${res.weeksDetected} haftadan ${res.totalItems} kazanım önizlemeye hazır.`);
            }} className="kd-btn kd-btn-primary">Önizle ve Dağıt</button>
          </div>
        </div>
      )}

      {activeTab === "backup" && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(await encodeSyncCode(state)); onNotify(`Eşitleme kodu kopyalandı (${Object.keys(state.outcomes).length} kazanım).`); }
            catch { onNotify("Panoya kopyalanamadı."); }
          }} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-left text-sm font-semibold text-[var(--accent)]">
            <span>Eşitleme kodu kopyala (KD5Z)</span>
            <span className="font-mono-num text-xs text-[var(--muted)]">{Object.keys(state.outcomes).length} kazanım</span>
          </button>

          <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
            <textarea rows={2} value={syncInput} onChange={(e) => setSyncInput(e.target.value)} placeholder="Diğer cihazdaki KD5Z:... veya v2 KD4Z:... kodunu yapıştırın" className="font-mono-num w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-xs" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={async () => {
                try { const inc = await decodeSyncCode(syncInput); setSyncModal({ incoming: inc, analysis: analyzeSyncMerge(state, inc), source: "Eşitleme kodu" }); onNotify("Eşitleme analizi hazır."); }
                catch (e) { onNotify(e instanceof Error ? e.message : "Geçersiz eşitleme kodu."); }
              }} className="kd-btn kd-btn-primary text-xs">Kodu Çöz ve Birleştir</button>
              <button type="button" onClick={() => jsonInputRef.current?.click()} className="kd-btn text-xs">v2 / v3 JSON Yedek Seç</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => {
              const rows: string[] = [];
              Object.entries(state.outcomes).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => {
                const m = k.match(/^(\d+)\|([0-4])\|([0-9])$/);
                if (m && v.trim()) rows.push(`${m[1]};${v.trim().replace(/\r?\n+/g, " | ")}`);
              });
              setRawText(rows.join("\n")); setActiveTab("text"); onNotify(`${rows.length} kazanım metne getirildi.`);
            }} className="kd-btn text-xs">Tüm kazanımları metne dök</button>
            <button type="button" onClick={() => {
              if (!confirmClear) { setConfirmClear(true); window.setTimeout(() => setConfirmClear(false), 4000); return; }
              setConfirmClear(false);
              void shareOrDownloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" }), "kazanim_defteri_silme_oncesi_yedek.json");
              onUpdateState({ ...state, outcomes: {}, outcomeUpdatedAt: {}, updatedAt: Date.now() }, "Tüm kazanımlar temizlendi");
              onNotify("Tüm kazanımlar temizlendi (önce JSON yedek indirildi).");
            }} className="kd-btn text-xs" style={{ color: "var(--margin)" }}>
              {confirmClear ? "Emin misin? Önce yedek alınıp silinecek — Tekrar tıkla" : "Tüm kazanımları güvenle sil"}
            </button>
          </div>
        </div>
      )}

      {parsed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3.5">
          <div className="flex flex-col gap-1 text-sm">
            <div><strong>{effectiveSubject}</strong> · <strong>{totalWeeks - missingWeeks37.length}/{totalWeeks} hafta</strong> ({parsed.res.totalItems} kazanım) dağıtıma hazır.</div>
            {missingWeeks37.length > 0 && (totalWeeks - missingWeeks37.length) >= 15 && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={balance37} onChange={(e) => setBalance37(e.target.checked)} />
                <span>Boş kalan {missingWeeks37.length} haftayı 1–{totalWeeks} arasına dengeli yay (hiçbir hafta boş kalmasın)</span>
              </label>
            )}
          </div>
          <div className="flex gap-2">
            {matchedMultiSubjects.length >= 2 && (
              <button type="button" onClick={handleApplyAllSubjects} className="kd-btn kd-btn-primary">
                Tümünü Dağıt ({matchedMultiSubjects.length} Ders)
              </button>
            )}
            <button type="button" onClick={handleApplyPlan} className={`kd-btn ${matchedMultiSubjects.length >= 2 ? "" : "kd-btn-primary"}`}>
              {matchedMultiSubjects.length >= 2 ? `Yalnız ${effectiveSubject}` : "Onayla ve Aktar"}
            </button>
            <button type="button" onClick={() => setParsed(null)} className="kd-btn">İptal</button>
          </div>
        </div>
      )}

      {syncModal && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-3.5">
          <div className="text-sm">
            <strong>Kayıpsız Eşitleme · {syncModal.source}</strong>
            <p className="m-0 mt-1 text-xs text-[var(--muted)]">+{syncModal.analysis.addedCount} yeni · {syncModal.analysis.keptLocalCount} yerel korunur · {syncModal.analysis.conflictCount} farklı</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { onUpdateState(applySyncMerge(state, syncModal.incoming, "smart"), "Kayıpsız eşitleme"); setSyncModal(null); setSyncInput(""); onNotify("Cihazlar kayıpsız eşitlendi."); }} className="kd-btn kd-btn-primary text-xs">Kayıpsız birleştir (Önerilen)</button>
            <button type="button" onClick={() => { onUpdateState(applySyncMerge(state, syncModal.incoming, "replace"), "Tam yedek yükleme"); setSyncModal(null); onNotify("Yedek tam yüklendi."); }} className="kd-btn text-xs">Üzerine yaz</button>
            <button type="button" onClick={() => setSyncModal(null)} className="kd-btn text-xs">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
};