export type Kademe = "ilkokul" | "ortaokul" | "lise";
export type TeacherMode = "sinif" | "brans";

export interface TimetableCell {
  subject: string;
  section?: string;
}

export interface HolidayWeek {
  monday: string;
  label: string;
}

export interface PusulaStateV3 {
  schoolName?: string;
  teacherName?: string;
  version: 3;
  kademe: Kademe;
  mode: TeacherMode;
  gradeLabel?: string;
  slotsPerDay: number;
  maxWeek: number;
  teachingWeeks?: number;
  startMonday: string;
  weekHolidays: HolidayWeek[];
  dayHolidays: Record<string, string>;
  timetable: (TimetableCell | null)[][];
  outcomes: Record<string, string>;
  outcomeUpdatedAt: Record<string, number>;
  teacherNotes: Record<string, string>;
  doneMarks?: Record<string, number>;
  subjectCatalog?: Partial<Record<Kademe, string[]>>;
  updatedAt: number;
}

export interface LessonUnitGroup {
  groupKey: string;
  subject: string;
  section?: string;
  displayTitle: string;
  firstOrder: number;
  lessons: Array<{ dayIndex: number; slotIndex: number }>;
}

const KEY_RE = /^(\d+)\|([0-4])\|([0-9])$/;
const TR_DATE_START_RE = /^\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\b/i;
const NUM_DATE_START_RE = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/;
const HOUR_CELL_RE = /^\d{1,2}(?:\.\s*(?:ders|saat))?$/i;

export function splitDelimitedRow(line: string, sep: string = ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function sanitizeOutcomeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(";")) return trimmed;
      const cols = splitDelimitedRow(trimmed, ";");
      if (cols.length < 2) return trimmed;
      let idx = 0;
      const hasWeekFirst = /^\d{1,2}$/.test(cols[0]) && cols.length >= 3 && (TR_DATE_START_RE.test(cols[1]) || NUM_DATE_START_RE.test(cols[1]));
      const hasDateFirst = TR_DATE_START_RE.test(cols[0]) || NUM_DATE_START_RE.test(cols[0]);
      if (hasWeekFirst) idx = 2;
      else if (hasDateFirst) idx = 1;
      else return trimmed;
      if (idx < cols.length - 1 && cols[idx].length <= 50 && !/\.\d+\.\d+/.test(cols[idx])) idx += 1;
      while (idx < cols.length - 1 && (HOUR_CELL_RE.test(cols[idx]) || !cols[idx])) idx += 1;
      return cols.slice(idx).join("; ").trim() || trimmed;
    })
    .filter(Boolean)
    .join("\n");
}

export const MEB_2026_2027_CALENDAR = {
  teacherPrepStart: "2026-09-01",
  orientationStart: "2026-09-07",
  orientationEnd: "2026-09-11",
  term1Start: "2026-09-14",
  term1End: "2027-01-22",
  term2Start: "2027-02-08",
  term2End: "2027-06-25",
  teachingWeeks: 37,
  weekHolidays: [
    { monday: "2026-11-16", label: "Sonbahar Ara Tatili" },
    { monday: "2027-01-25", label: "Yarıyıl Tatili (1. Hafta)" },
    { monday: "2027-02-01", label: "Yarıyıl Tatili (2. Hafta)" },
    { monday: "2027-03-08", label: "Bahar Ara Tatili" }
  ] as HolidayWeek[]
};

export const MEB_2026_2027_DAY_HOLIDAYS: Record<string, string> = {};

export function getTeachingWeeks(state: Pick<PusulaStateV3, "teachingWeeks">): number {
  return Math.min(45, Math.max(30, Math.round(state.teachingWeeks || MEB_2026_2027_CALENDAR.teachingWeeks)));
}

export function makeCellKey(week: number, dayIndex: number, slotIndex: number): string {
  return `${week}|${dayIndex}|${slotIndex}`;
}

export function subjectPriority(subjectName: string): number {
  const t = subjectName.replace(/i\u0307/g, "i").toLocaleLowerCase("tr-TR").trim();
  if (t === "ingilizce" || t.startsWith("ingilizce ")) return 1;
  if (t.startsWith("din kültürü")) return 2;
  return 0;
}

export function groupTimetableLessons(timetable: (TimetableCell | null)[][], slotsPerDay: number): LessonUnitGroup[] {
  const map = new Map<string, LessonUnitGroup>();
  let orderCounter = 0;
  for (let d = 0; d < 5; d++) {
    const dayRow = timetable[d] || [];
    for (let s = 0; s < slotsPerDay; s++) {
      const cell = dayRow[s];
      if (!cell || !cell.subject.trim()) continue;
      const subject = cell.subject.trim();
      const section = cell.section?.trim() || "";
      const groupKey = `${section.toLocaleLowerCase("tr-TR")}||${subject.toLocaleLowerCase("tr-TR")}`;
      let grp = map.get(groupKey);
      if (!grp) {
        grp = { groupKey, subject, section: section || undefined, displayTitle: section ? `${section} · ${subject}` : subject, firstOrder: orderCounter++, lessons: [] };
        map.set(groupKey, grp);
      }
      grp.lessons.push({ dayIndex: d, slotIndex: s });
    }
  }
  return Array.from(map.values()).sort((a, b) => subjectPriority(a.subject) - subjectPriority(b.subject) || b.lessons.length - a.lessons.length || a.firstOrder - b.firstOrder);
}

function sanitizeOutcomesMap(rawMap: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawMap || typeof rawMap !== "object") return out;
  for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const normKey = k.replace(/_/g, "|");
    if (!KEY_RE.test(normKey)) continue;
    const cleaned = sanitizeOutcomeText(v);
    if (cleaned) out[normKey] = cleaned;
  }
  return out;
}

export function migrateV2ToV3(raw: unknown): PusulaStateV3 | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (!Array.isArray(src.timetable) || src.timetable.length !== 5) return null;

  if (src.version === 3 && typeof src.slotsPerDay === "number") {
    const slots = Math.min(10, Math.max(4, Math.round(src.slotsPerDay)));
    return {
      version: 3,
      kademe: src.kademe === "ortaokul" || src.kademe === "lise" ? src.kademe : "ilkokul",
      mode: src.mode === "brans" ? "brans" : "sinif",
      gradeLabel: typeof src.gradeLabel === "string" ? src.gradeLabel : undefined,
      schoolName: typeof src.schoolName === "string" ? src.schoolName : undefined,
      teacherName: typeof src.teacherName === "string" ? src.teacherName : undefined,
      slotsPerDay: slots,
      maxWeek: typeof src.maxWeek === "number" ? src.maxWeek : 45,
      teachingWeeks: typeof src.teachingWeeks === "number" ? Math.min(45, Math.max(30, Math.round(src.teachingWeeks))) : undefined,
      startMonday: typeof src.startMonday === "string" ? src.startMonday : MEB_2026_2027_CALENDAR.term1Start,
      weekHolidays: Array.isArray(src.weekHolidays) ? (src.weekHolidays as HolidayWeek[]) : [],
      dayHolidays: src.dayHolidays && typeof src.dayHolidays === "object" ? (src.dayHolidays as Record<string, string>) : {},
      timetable: src.timetable.map((day) => Array.from({ length: slots }, (_, i) => (Array.isArray(day) ? (day[i] ?? null) : null))),
      outcomes: sanitizeOutcomesMap(src.outcomes),
      outcomeUpdatedAt: src.outcomeUpdatedAt && typeof src.outcomeUpdatedAt === "object" ? (src.outcomeUpdatedAt as Record<string, number>) : {},
      subjectCatalog: src.subjectCatalog && typeof src.subjectCatalog === "object" ? (src.subjectCatalog as Partial<Record<Kademe, string[]>>) : undefined,
      doneMarks: src.doneMarks && typeof src.doneMarks === "object" ? (src.doneMarks as Record<string, number>) : undefined,
      teacherNotes: src.teacherNotes && typeof src.teacherNotes === "object" ? (src.teacherNotes as Record<string, string>) : {},
      updatedAt: typeof src.updatedAt === "number" ? src.updatedAt : Date.now()
    };
  }

  const timetable: (TimetableCell | null)[][] = src.timetable.map((day) => {
    const row = Array.isArray(day) ? day : [];
    return Array.from({ length: 6 }, (_, s) => {
      const name = typeof row[s] === "string" ? row[s].trim() : "";
      return name ? { subject: name } : null;
    });
  });
  const outcomes = sanitizeOutcomesMap(src.outcomes);
  const outcomeUpdatedAt: Record<string, number> = {};
  if (src.outcomeUpdatedAt && typeof src.outcomeUpdatedAt === "object") {
    for (const [k, v] of Object.entries(src.outcomeUpdatedAt as Record<string, unknown>)) {
      const normKey = k.replace(/_/g, "|");
      if (outcomes[normKey] && typeof v === "number" && Number.isFinite(v)) outcomeUpdatedAt[normKey] = v;
    }
  }
  const weekHolidays: HolidayWeek[] = Array.isArray(src.holidays) ? (src.holidays as HolidayWeek[]).filter((h) => h && typeof h.monday === "string") : MEB_2026_2027_CALENDAR.weekHolidays.map((h) => ({ ...h }));
  return { version: 3, kademe: "ilkokul", mode: "sinif", gradeLabel: "v2'den Aktarılan Program", slotsPerDay: 6, maxWeek: 45, startMonday: typeof src.startMonday === "string" ? src.startMonday : MEB_2026_2027_CALENDAR.term1Start, weekHolidays, dayHolidays: {}, timetable, outcomes, outcomeUpdatedAt, teacherNotes: {}, updatedAt: typeof src.updatedAt === "number" ? src.updatedAt : Date.now() };
}