import { buildCalendarTimeline, toMondayIso } from "./calendarShift";
import { UNIVERSAL_CODE_REGEX } from "./mebCatalog";
import { MEB_2026_2027_CALENDAR, sanitizeOutcomeText, splitDelimitedRow } from "./schema";

export interface ParsedPlanResult {
  weeklyOutcomes: Record<number, string[]>;
  outcomesBySubject?: Record<string, Record<number, string[]>>;
  weeksDetected: number;
  totalItems: number;
  detectedSubject?: string;
  sourceKind: "docx" | "xlsx" | "pdf" | "text";
}

const MONTHS_TR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const MEB_TL = buildCalendarTimeline(MEB_2026_2027_CALENDAR.term1Start, MEB_2026_2027_CALENDAR.weekHolidays, 37);

const CODE_RULES: Array<[RegExp, string]> = [
  [/\bT\.\d+\.\d+/i, "türkçe"], [/\bTDE\.\d+/i, "türk dili"], [/\bM\.\d+\.\d+/i, "matematik"], [/\bMAT\.\d+/i, "matematik"],
  [/\bF\.\d+\.\d+/i, "fen bilimleri"], [/\bFB\.\d+/i, "fen bilimleri"], [/\bHB\.\d+/i, "hayat bilgisi"],
  [/\bFİZ\.\d+/i, "fizik"], [/\bKİM\.\d+/i, "kimya"], [/\bBİY\.\d+/i, "biyoloji"],
  [/\bSB\.\d+\.\d+/i, "sosyal bilgiler"], [/\bTAR\.\d+/i, "tarih"], [/\bCOĞ\.\d+/i, "coğrafya"], [/\bFEL\.\d+/i, "felsefe"],
  [/\bE\d+\.\d+\.[A-Z]\d/i, "ingilizce"], [/\bDK(?:AB)?\.\d+/i, "din kültürü"], [/\bMü\.\d+/i, "müzik"],
  [/\bG\.\d+\.\d+/i, "görsel sanatlar"], [/\bY\.\d+\.\d+/i, "insan hakları"], [/\bBO\.\d+\.\d+/i, "oyun ve fiziki"], [/\bTG\.\d+\.\d+/i, "trafik güvenliği"]
];

const OUTCOME_VERB_RE = /(?:okur|yazar|açıklar|hesaplar|kavrar|analiz\s+eder|yorumlar|karşılaştırır|uygular|çözer|tanır|belirler|fark\s+eder|sorgular|oluşturur|değerlendirir|gösterir|bilir|anlar|ifade\s+eder|tahmin\s+eder|sıralar|sınıflandırır|inceler|tartışır|üretir)\.?$/i;
const NOISE_LINE_RE = /^(?:ana\s*sayfa|içindekiler|ünite|tema|\d+\.\s*(?:ünite|tema|bölüm)|ders\s*saati|haftalık\s*ders|kazanım|öğrenme\s*çıktı|ölçme\s*ve\s*değerlendirme|atatürkçülük|belirli\s*gün|yöntem|teknik|araç|gereç|https?:\/\/)/i;

export function detectSubjectFromText(subjects: string[], fullText: string): string | undefined {
  for (const [re, kw] of CODE_RULES) {
    if (re.test(fullText)) {
      const hit = subjects.find((s) => s.toLocaleLowerCase("tr-TR").includes(kw));
      if (hit) return hit;
    }
  }
  const head = fullText.slice(0, 1500).toLocaleLowerCase("tr-TR");
  return subjects.find((s) => head.includes(s.toLocaleLowerCase("tr-TR")));
}

function detectSubjectForLine(subjects: string[], line: string): string | null {
  for (const [re, kw] of CODE_RULES) {
    if (re.test(line)) {
      const hit = subjects.find((s) => s.toLocaleLowerCase("tr-TR").includes(kw));
      if (hit) return hit;
    }
  }
  return null;
}

function isLikelyOutcomeLine(line: string): boolean {
  const s = line.trim();
  if (!s || s.length < 10 || s.length > 500 || NOISE_LINE_RE.test(s)) return false;
  if (UNIVERSAL_CODE_REGEX.test(s)) return true;
  if (s.length >= 22 && (OUTCOME_VERB_RE.test(s) || /[.!?]$/.test(s))) return true;
  return false;
}

async function readZipEntries(buffer: ArrayBuffer, filterFn: (name: string) => boolean): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let eocdOffset = -1;
  for (let i = Math.max(0, bytes.length - 65560); i <= bytes.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) eocdOffset = i;
  }
  if (eocdOffset === -1) throw new Error("Geçersiz Office (.docx / .xlsx) arşivi.");
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const dec = new TextDecoder("utf-8"), files: Record<string, string> = {};
  for (let i = 0; i < entryCount && cdOffset + 46 <= bytes.length; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(cdOffset + 10, true), compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true), extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true), localOffset = view.getUint32(cdOffset + 42, true);
    const name = dec.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;
    if (!filterFn(name) || view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const lNameLen = view.getUint16(localOffset + 26, true), lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen, compBytes = bytes.subarray(dataStart, dataStart + compSize);
    if (method === 0) files[name] = dec.decode(compBytes);
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("Bu tarayıcı sıkıştırılmış Office dosyalarını açmayı desteklemiyor.");
      const stream = new Blob([new Uint8Array(compBytes)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files[name] = await new Response(stream).text();
    }
  }
  return files;
}

function splitOutcomeItems(rawText: string): string[] {
  const lines = sanitizeOutcomeText(rawText).replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/^[•\-*▪➢►]\s*/, "").trim()).filter(Boolean);
  const merged: string[] = [];
  for (const line of lines) {
    if (merged.length === 0 || UNIVERSAL_CODE_REGEX.test(line) || /^\d+[.)]\s+/.test(line)) merged.push(line);
    else merged[merged.length - 1] += " " + line;
  }
  return merged;
}

function toIsoDate(day: number, monthIdx: number, yearOpt?: number): string | null {
  if (day < 1 || day > 31 || monthIdx < 1 || monthIdx > 12) return null;
  const year = yearOpt ?? (monthIdx >= 8 ? 2026 : 2027);
  if (year < 2026 || year > 2027) return null;
  return `${year}-${String(monthIdx).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateWeeks(text: string): { weeks: number[]; isHoliday: boolean } {
  const low = text.toLocaleLowerCase("tr-TR");
  const isHolWord = /(ara\s*tatil|yarıyıl|yariyil|sömestr|somestr|resm[iî]\s*tatil)/i.test(low);
  const isos: string[] = [];

  const sameMonthRe = /(\d{1,2})\s*[-–/]\s*(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s+(\d{4}))?/g;
  let m: RegExpExecArray | null;
  while ((m = sameMonthRe.exec(low)) !== null) {
    const mIdx = MONTHS_TR.indexOf(m[3]) + 1, yr = m[4] ? Number(m[4]) : undefined;
    const a = toIsoDate(Number(m[1]), mIdx, yr), b = toIsoDate(Number(m[2]), mIdx, yr);
    if (a) isos.push(a);
    if (b) isos.push(b);
  }
  const trDateRe = /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s+(\d{4}))?/g;
  while ((m = trDateRe.exec(low)) !== null) {
    const mIdx = MONTHS_TR.indexOf(m[2]) + 1, yr = m[3] ? Number(m[3]) : undefined;
    const dIso = toIsoDate(Number(m[1]), mIdx, yr);
    if (dIso) isos.push(dIso);
  }
  const numRe = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g;
  while ((m = numRe.exec(text)) !== null) {
    const dIso = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (dIso) isos.push(dIso);
  }

  if (isos.length === 0) return { weeks: [], isHoliday: isHolWord };
  isos.sort();
  const startMon = toMondayIso(isos[0]), endMon = toMondayIso(isos[isos.length - 1]);
  const matched = MEB_TL.filter((s) => s.monday >= startMon && s.monday <= endMon);
  if (matched.length === 0) return { weeks: [], isHoliday: isHolWord };
  const weeks = matched.filter((s) => s.kind === "teaching" && s.teachingWeek !== null).map((s) => s.teachingWeek!);
  return { weeks, isHoliday: weeks.length === 0 || isHolWord };
}

function extractWeekNumbers(text: string, allowBare: boolean): number[] {
  const rangeM = text.match(/\b(\d{1,2})\s*(?:[-–/]|ve)\s*(\d{1,2})\s*\.\s*Hafta\b/i);
  if (rangeM) {
    const a = Number(rangeM[1]), b = Number(rangeM[2]);
    if (a >= 1 && b >= a && b <= 45 && b - a <= 6) return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  const singleM = text.match(/\b(\d{1,2})\s*\.\s*Hafta\b/i);
  if (singleM) {
    const w = Number(singleM[1]);
    if (w >= 1 && w <= 45) return [w];
  }
  if (allowBare) {
    const bareRange = text.trim().match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
    if (bareRange) {
      const a = Number(bareRange[1]), b = Number(bareRange[2]);
      if (a >= 1 && b >= a && b <= 45 && b - a <= 6) return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    }
    const bare = text.trim().match(/^(\d{1,2})$/);
    if (bare) {
      const w = Number(bare[1]);
      if (w >= 1 && w <= 45) return [w];
    }
  }
  return [];
}

function isDateCell(val: string): boolean {
  const s = val.trim();
  if (!s || s.length > 48 || /\.\d+\.\d+/.test(s) || /[.!?]$/.test(s)) return false;
  return (
    /^\d{1,2}(?:\s*[-–/]\s*\d{1,2})?\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\b/i.test(s) ||
    /^\d{1,2}[./]\d{1,2}[./]\d{2,4}(?:\s*[-–]\s*\d{1,2}[./]\d{1,2}[./]\d{2,4})?$/.test(s)
  );
}

function isHourOrOrderCell(val: string): boolean {
  return /^\d{1,2}(?:\.\s*(?:ders|saat))?$/i.test(val.trim());
}

function matchSubjectCell(val: string, subjects: string[]): string | null {
  const norm = val.replace(/i\u0307/g, "i").toLocaleLowerCase("tr-TR").trim();
  if (!norm || norm.length > 55) return null;
  return subjects.find((s) => { const sn = s.replace(/i\u0307/g, "i").toLocaleLowerCase("tr-TR").trim(); return norm === sn || (norm.includes("·") && norm.endsWith(sn)); }) || null;
}

function addOutcomeForSubj(
  bySubj: Record<string, Record<number, string[]>>,
  subj: string | null,
  w: number,
  items: string[]
) {
  if (!subj) return;
  bySubj[subj] = bySubj[subj] || {};
  bySubj[subj][w] = [...(bySubj[subj][w] || []), ...items];
}

function extractFromTables(
  tables: string[][][],
  subjects: string[],
  targetWeeks: number
): { weekly: Record<number, string[]>; bySubj: Record<string, Record<number, string[]>> } {
  const weekly: Record<number, string[]> = {};
  const bySubj: Record<string, Record<number, string[]>> = {};

  for (const table of tables) {
    let headerIdx = -1, weekCol = -1, dateCol = -1, hourCol = -1, subjCol = -1, outcomeCol = -1;
    for (let r = 0; r < Math.min(5, table.length); r++) {
      let wCol = -1, dCol = -1, hCol = -1, sCol = -1, oCol = -1;
      table[r].forEach((cell, idx) => {
        const low = cell.toLocaleLowerCase("tr-TR");
        if (wCol === -1 && /\bhafta\b/.test(low)) wCol = idx;
        if (dCol === -1 && /\btarih\b/.test(low)) dCol = idx;
        if (hCol === -1 && /(ders\s*saat|\bsaat\b|\bsüre\b)/.test(low)) hCol = idx;
        if (sCol === -1 && /\bders\b/.test(low)) sCol = idx;
        if (oCol === -1 && /(kazanım|kazanim|öğrenme\s*çıkt|ogrenme\s*cikt|süreç\s*bileşen|alan\s*beceri|hedef|konu)/.test(low)) oCol = idx;
      });
      if (oCol !== -1 || wCol !== -1 || dCol !== -1) { headerIdx = r; weekCol = wCol; dateCol = dCol; hourCol = hCol; subjCol = sCol; outcomeCol = oCol; break; }
    }

    let lastWeeks: number[] = [];
    for (let r = headerIdx + 1; r < table.length; r++) {
      const row = table[r];
      if (!row || row.length === 0) continue;

      let rowWeeks: number[] = [], isHolRow = false;
      if (dateCol !== -1 && row[dateCol]) {
        const dRes = extractDateWeeks(row[dateCol]);
        if (dRes.isHoliday) isHolRow = true;
        else if (dRes.weeks.length > 0) rowWeeks = dRes.weeks;
      }
      if (!isHolRow && rowWeeks.length === 0) {
        for (let c = 0; c < row.length; c++) {
          if (c === outcomeCol || c === hourCol || c === subjCol) continue;
          const dRes = extractDateWeeks(row[c] || "");
          if (dRes.isHoliday && dRes.weeks.length === 0) { isHolRow = true; break; }
          if (dRes.weeks.length > 0) { rowWeeks = dRes.weeks; break; }
        }
      }
      if (isHolRow) { lastWeeks = []; continue; }

      if (rowWeeks.length === 0 && weekCol !== -1 && row[weekCol]) rowWeeks = extractWeekNumbers(row[weekCol], true);
      if (rowWeeks.length === 0) {
        for (let c = 0; c < Math.min(3, row.length); c++) {
          if (c === hourCol || c === outcomeCol || c === subjCol) continue;
          rowWeeks = extractWeekNumbers(row[c] || "", c === 0 && weekCol === -1);
          if (rowWeeks.length > 0) break;
        }
      }

      const rowSubjFromCol = subjCol !== -1 && row[subjCol] ? matchSubjectCell(row[subjCol], subjects) : null;
      let rawOutcome = outcomeCol !== -1 ? row[outcomeCol] || "" : "";
      if (!rawOutcome.trim()) {
        rawOutcome = row.filter((cell, idx) => idx !== weekCol && idx !== dateCol && idx !== hourCol && idx !== subjCol && !isDateCell(cell) && !isHourOrOrderCell(cell))
          .sort((a, b) => (UNIVERSAL_CODE_REGEX.test(b.trim()) ? 1 : 0) - (UNIVERSAL_CODE_REGEX.test(a.trim()) ? 1 : 0) || b.length - a.length)[0] || "";
      }

      const items = splitOutcomeItems(rawOutcome);
      if (rowWeeks.length === 0) {
        if (lastWeeks.length > 0 && items.length > 0 && (UNIVERSAL_CODE_REGEX.test(items[0]) || items[0].length >= 16)) rowWeeks = lastWeeks;
        else continue;
      } else {
        lastWeeks = rowWeeks;
      }
      if (items.length === 0) continue;
      rowWeeks.forEach((w) => {
        if (w >= 1 && w <= 45) {
          weekly[w] = [...(weekly[w] || []), ...items];
          items.forEach((it) => addOutcomeForSubj(bySubj, rowSubjFromCol ?? detectSubjectForLine(subjects, it), w, [it]));
        }
      });
    }
  }

  if (Object.keys(weekly).length === 0) {
    const flatText = tables.flatMap((t) => t.flatMap((r) => r)).join("\n");
    const smart = parsePlainTextPlan(flatText, subjects, targetWeeks);
    return { weekly: smart.weeklyOutcomes, bySubj: smart.outcomesBySubject || {} };
  }
  return { weekly, bySubj };
}

export async function parseDocxPlan(buffer: ArrayBuffer, subjects: string[] = [], targetWeeks: number = 37): Promise<ParsedPlanResult> {
  const files = await readZipEntries(buffer, (n) => n === "word/document.xml");
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Word belgesi okunamadı.");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const tables: string[][][] = [], allTextParts: string[] = [];
  Array.from(doc.getElementsByTagName("w:tbl")).forEach((tbl) => {
    const rows: string[][] = [];
    Array.from(tbl.children).filter((el) => el.tagName === "w:tr").forEach((tr) => {
      const cells = Array.from(tr.children).filter((el) => el.tagName === "w:tc").map((tc) => Array.from(tc.getElementsByTagName("w:p")).map((p) => Array.from(p.getElementsByTagName("w:t")).map((t) => t.textContent || "").join("")).filter((x) => x.trim()).join("\n"));
      if (cells.some((c) => c.trim())) { rows.push(cells); allTextParts.push(cells.join(" ")); }
    });
    if (rows.length) tables.push(rows);
  });
  if (tables.length === 0) {
    const paras = Array.from(doc.getElementsByTagName("w:p")).map((p) => Array.from(p.getElementsByTagName("w:t")).map((t) => t.textContent || "").join("")).filter((x) => x.trim());
    return { ...parsePlainTextPlan(paras.join("\n"), subjects, targetWeeks), sourceKind: "docx" };
  }
  const { weekly, bySubj } = extractFromTables(tables, subjects, targetWeeks);
  const weeks = Object.keys(weekly), subjKeys = Object.keys(bySubj);
  return {
    weeklyOutcomes: weekly,
    outcomesBySubject: subjKeys.length > 0 ? bySubj : undefined,
    weeksDetected: weeks.length,
    totalItems: weeks.reduce((acc, w) => acc + weekly[Number(w)].length, 0),
    detectedSubject: subjKeys.length === 1 ? subjKeys[0] : detectSubjectFromText(subjects, allTextParts.join("\n")),
    sourceKind: "docx"
  };
}

function colRefToIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] || "A").toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64);
  return col - 1;
}

export async function parseXlsxPlan(buffer: ArrayBuffer, subjects: string[] = [], targetWeeks: number = 37): Promise<ParsedPlanResult> {
  const files = await readZipEntries(buffer, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(n));
  const parser = new DOMParser(), shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    Array.from(parser.parseFromString(files["xl/sharedStrings.xml"], "application/xml").getElementsByTagName("si")).forEach((si) => shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent || "").join("")));
  }
  const sheetKeys = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k)).sort();
  if (sheetKeys.length === 0) throw new Error("Excel çalışma sayfası bulunamadı.");
  const tables: string[][][] = [], allTextParts: string[] = [];
  for (const key of sheetKeys) {
    const doc = parser.parseFromString(files[key], "application/xml"), rows: string[][] = [];
    Array.from(doc.getElementsByTagName("row")).forEach((rowEl) => {
      const rowArr: string[] = [];
      Array.from(rowEl.getElementsByTagName("c")).forEach((cellEl, idx) => {
        const ref = cellEl.getAttribute("r"), colIdx = ref ? colRefToIndex(ref) : idx, type = cellEl.getAttribute("t") || "";
        let val = "";
        if (type === "s") { const v = Number(cellEl.getElementsByTagName("v")[0]?.textContent || -1); val = v >= 0 && shared[v] !== undefined ? shared[v] : ""; }
        else if (type === "inlineStr") val = Array.from(cellEl.getElementsByTagName("t")).map((t) => t.textContent || "").join("");
        else val = cellEl.getElementsByTagName("v")[0]?.textContent || "";
        rowArr[colIdx] = val.trim();
      });
      if (rowArr.some(Boolean)) { rows.push(rowArr); allTextParts.push(rowArr.join(" ")); }
    });
    if (rows.length) tables.push(rows);
  }
  const { weekly, bySubj } = extractFromTables(tables, subjects, targetWeeks);
  const weeks = Object.keys(weekly), subjKeys = Object.keys(bySubj);
  return {
    weeklyOutcomes: weekly,
    outcomesBySubject: subjKeys.length > 0 ? bySubj : undefined,
    weeksDetected: weeks.length,
    totalItems: weeks.reduce((acc, w) => acc + weekly[Number(w)].length, 0),
    detectedSubject: subjKeys.length === 1 ? subjKeys[0] : detectSubjectFromText(subjects, allTextParts.join("\n")),
    sourceKind: "xlsx"
  };
}

export async function parsePdfPlan(buffer: ArrayBuffer, subjects: string[] = [], targetWeeks: number = 37): Promise<ParsedPlanResult> {
  let pdfjs: { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }> } };
  try {
    const url = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs";
    pdfjs = await import(/* @vite-ignore */ url);
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
  } catch {
    throw new Error("PDF okumak için internet bağlantısı gerekiyor (.docx ve .xlsx çevrimdışı da açılır).");
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise, lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    lines.push(...content.items.map((it) => it.str || "").join(" ").split(/(?=\b\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*\.\s*Hafta\b)/i));
  }
  return { ...parsePlainTextPlan(lines.join("\n"), subjects, targetWeeks), sourceKind: "pdf" };
}

export function parsePlainTextPlan(text: string, subjects: string[] = [], targetWeeks: number = 37): ParsedPlanResult {
  const weeklyOutcomes: Record<number, string[]> = {};
  const outcomesBySubject: Record<string, Record<number, string[]>> = {};
  let currentWeeks: number[] = [];
  const cleanedText = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (const rawLine of cleanedText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const firstPipe = line.split("|")[0]?.trim() || "";
    const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : (line.includes("|") && (extractWeekNumbers(firstPipe, true).length > 0 || extractDateWeeks(firstPipe).weeks.length > 0)) ? "|" : null;
    if (sep) {
      const cols = splitDelimitedRow(line, sep);
      if (cols.length >= 2) {
        const headerLow = cols.slice(0, 4).join(" ").toLocaleLowerCase("tr-TR");
        if (/\bhafta\b/.test(headerLow) && /(kazanım|kazanim|ders|tarih)/.test(headerLow)) continue;
        let rowWeeks: number[] = [], isHol = false, rowSubj: string | null = null;
        const metaCols = new Set<number>();

        for (let cIdx = 0; cIdx < cols.length; cIdx++) {
          const col = cols[cIdx];
          const dRes = extractDateWeeks(col);
          if (dRes.isHoliday && dRes.weeks.length === 0) { isHol = true; break; }
          if (dRes.weeks.length > 0) { rowWeeks = dRes.weeks; metaCols.add(cIdx); continue; }
          if (isDateCell(col) || isHourOrOrderCell(col)) {
            if (rowWeeks.length === 0 && cIdx === 0) {
              const wn = extractWeekNumbers(col, true);
              if (wn.length > 0) rowWeeks = wn;
            }
            metaCols.add(cIdx);
            continue;
          }
          if (rowWeeks.length === 0) {
            const wn = extractWeekNumbers(col, cIdx === 0);
            if (wn.length > 0) { rowWeeks = wn; metaCols.add(cIdx); continue; }
          }
          if (!rowSubj && cIdx < cols.length - 1) {
            const matched = matchSubjectCell(col, subjects);
            if (matched) { rowSubj = matched; metaCols.add(cIdx); }
            else if (sep !== "|" && cols.length >= 3 && col.length <= 45 && !/\.\d+\.\d+/.test(col) && !/[.!?]$/.test(col)) metaCols.add(cIdx);
          }
        }
        if (isHol) { currentWeeks = []; continue; }
        const activeWeeks = rowWeeks.length > 0 ? rowWeeks : currentWeeks;
        const remaining = cols.filter((c, idx) => c && !metaCols.has(idx));
        const items = (sep === "|" ? remaining : remaining.join("; ").split(/\s*\|\s*/)).map((x) => sanitizeOutcomeText(x)).filter(Boolean);
        if (activeWeeks.length > 0 && items.length > 0) {
          currentWeeks = activeWeeks;
          activeWeeks.forEach((w) => {
            weeklyOutcomes[w] = [...(weeklyOutcomes[w] || []), ...items];
            items.forEach((it) => addOutcomeForSubj(outcomesBySubject, rowSubj ?? detectSubjectForLine(subjects, it), w, [it]));
          });
        }
        continue;
      }
    }
    const dLead = extractDateWeeks(line);
    if (dLead.isHoliday && dLead.weeks.length === 0) { currentWeeks = []; continue; }
    const wnLead = extractWeekNumbers(line, false);
    if (dLead.weeks.length > 0 || wnLead.length > 0) {
      currentWeeks = dLead.weeks.length > 0 ? dLead.weeks : wnLead;
      const rest = sanitizeOutcomeText(line.replace(/^\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*\.\s*Hafta\s*[:\-–|]?\s*/i, "").trim());
      if (rest && !isDateCell(rest)) currentWeeks.forEach((w) => {
        weeklyOutcomes[w] = [...(weeklyOutcomes[w] || []), rest];
        addOutcomeForSubj(outcomesBySubject, detectSubjectForLine(subjects, rest), w, [rest]);
      });
      continue;
    }
    if (currentWeeks.length > 0) {
      const cleanedLine = sanitizeOutcomeText(line);
      if (cleanedLine) currentWeeks.forEach((w) => {
        weeklyOutcomes[w] = [...(weeklyOutcomes[w] || []), cleanedLine];
        addOutcomeForSubj(outcomesBySubject, detectSubjectForLine(subjects, cleanedLine), w, [cleanedLine]);
      });
    }
  }

  // Akilli Haftasiz Ayiklama (kopyala-yapistir web/PDF listesi -> otomatik hafta dagitimi)
  if (Object.keys(weeklyOutcomes).length === 0) {
    const preFiltered = cleanedText.split("\n").map((l) => l.trim()).filter((l) => l && !NOISE_LINE_RE.test(l)).join("\n");
    const rawItems = splitOutcomeItems(preFiltered).filter(isLikelyOutcomeLine);
    if (rawItems.length > 0) {
      const grouped = new Map<string, string[]>();
      rawItems.forEach((it) => {
        const subj = detectSubjectForLine(subjects, it) || "_default";
        grouped.set(subj, [...(grouped.get(subj) || []), it]);
      });

      const distributeList = (list: string[], subj: string | null) => {
        const span = list.length >= 15 ? Math.max(1, targetWeeks) : list.length;
        if (list.length <= span) {
          for (let w = 1; w <= span; w++) {
            const idx = Math.min(list.length - 1, Math.floor(((w - 1) * list.length) / span));
            const item = list[idx];
            weeklyOutcomes[w] = [...(weeklyOutcomes[w] || []), item];
            addOutcomeForSubj(outcomesBySubject, subj, w, [item]);
          }
        } else {
          list.forEach((item, i) => {
            const w = 1 + Math.min(span - 1, Math.floor((i * span) / list.length));
            weeklyOutcomes[w] = [...(weeklyOutcomes[w] || []), item];
            addOutcomeForSubj(outcomesBySubject, subj, w, [item]);
          });
        }
      };

      grouped.forEach((list, key) => distributeList(list, key === "_default" ? null : key));
    }
  }

  const weeks = Object.keys(weeklyOutcomes), subjKeys = Object.keys(outcomesBySubject);
  return {
    weeklyOutcomes,
    outcomesBySubject: subjKeys.length > 0 ? outcomesBySubject : undefined,
    weeksDetected: weeks.length,
    totalItems: weeks.reduce((acc, w) => acc + weeklyOutcomes[Number(w)].length, 0),
    detectedSubject: subjKeys.length === 1 ? subjKeys[0] : detectSubjectFromText(subjects, cleanedText),
    sourceKind: "text"
  };
}