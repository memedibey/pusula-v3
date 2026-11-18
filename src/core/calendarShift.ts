import { HolidayWeek, MEB_2026_2027_CALENDAR, PusulaStateV3, TimetableCell, makeCellKey } from "./schema";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatUtcDate(date: Date): string {
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
}

export function toMondayIso(iso: string): string {
  const dt = parseUtcDate(iso);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return formatUtcDate(dt);
}

export function addDaysIso(iso: string, days: number): string {
  const dt = parseUtcDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatUtcDate(dt);
}

function fmtShort(iso: string): string {
  const dt = parseUtcDate(iso);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

function fmtFull(iso: string): string {
  const dt = parseUtcDate(iso);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

export function formatMonFriRange(mondayIso: string): string {
  const mon = toMondayIso(mondayIso);
  const fri = addDaysIso(mon, 4);
  return mon.slice(0, 4) === fri.slice(0, 4) ? `${fmtShort(mon)} – ${fmtFull(fri)}` : `${fmtFull(mon)} – ${fmtFull(fri)}`;
}

export function getTeachingWeekMonday(
  startMonday: string,
  teachingWeek: number,
  weekHolidays: HolidayWeek[]
): string {
  const holSet = new Set(weekHolidays.map((h) => toMondayIso(h.monday)));
  let cursor = toMondayIso(startMonday);
  let count = 0;
  for (let i = 0; i < 120; i++) {
    if (!holSet.has(cursor)) {
      count += 1;
      if (count === teachingWeek) return cursor;
    }
    cursor = addDaysIso(cursor, 7);
  }
  return addDaysIso(toMondayIso(startMonday), (teachingWeek - 1) * 7);
}

export function getLessonDateIso(state: PusulaStateV3, week: number, dayIndex: number): string {
  const monday = getTeachingWeekMonday(state.startMonday, week, state.weekHolidays);
  return addDaysIso(monday, dayIndex);
}

export interface TimelineSlot {
  kind: "teaching" | "holiday";
  monday: string;
  teachingWeek: number | null;
  holidayLabel: string | null;
  termLabel: string | null;
  prevTeachingWeek: number | null;
  nextTeachingWeek: number | null;
}

export function buildCalendarTimeline(
  startMonday: string,
  weekHolidays: HolidayWeek[],
  teachingCount: number = 37
): TimelineSlot[] {
  const startMon = toMondayIso(startMonday);
  const isMeb26 = startMon === MEB_2026_2027_CALENDAR.term1Start;
  const holMap = new Map<string, string>();
  weekHolidays.forEach((h) => holMap.set(toMondayIso(h.monday), h.label));

  const out: TimelineSlot[] = [];
  let cursor = startMon;
  let tWeek = 0;

  for (let i = 0; i < 120 && tWeek < teachingCount; i++) {
    const label = holMap.get(cursor);
    const fri = addDaysIso(cursor, 4);
    let termLabel: string | null = null;
    if (isMeb26) {
      if (fri <= MEB_2026_2027_CALENDAR.term1End) termLabel = fri === MEB_2026_2027_CALENDAR.term1End ? "1. Dönem Sonu" : "1. Dönem";
      else if (cursor > MEB_2026_2027_CALENDAR.term1End && fri < MEB_2026_2027_CALENDAR.term2Start) termLabel = "Yarıyıl Tatili";
      else if (cursor >= MEB_2026_2027_CALENDAR.term2Start && fri <= MEB_2026_2027_CALENDAR.term2End) termLabel = fri === MEB_2026_2027_CALENDAR.term2End ? "2. Dönem / Yıl Sonu" : "2. Dönem";
      else if (cursor > MEB_2026_2027_CALENDAR.term2End) termLabel = "25 Haziran 2027 sonrası";
    }

    if (label === undefined) {
      tWeek += 1;
      out.push({
        kind: "teaching",
        monday: cursor,
        teachingWeek: tWeek,
        holidayLabel: null,
        termLabel,
        prevTeachingWeek: tWeek > 1 ? tWeek - 1 : null,
        nextTeachingWeek: tWeek < teachingCount ? tWeek + 1 : null
      });
    } else {
      out.push({
        kind: "holiday",
        monday: cursor,
        teachingWeek: null,
        holidayLabel: label,
        termLabel,
        prevTeachingWeek: tWeek > 0 ? tWeek : null,
        nextTeachingWeek: tWeek + 1 <= teachingCount ? tWeek + 1 : null
      });
    }
    cursor = addDaysIso(cursor, 7);
  }
  return out;
}

export function getAdjacentHolidayNote(startMonday: string, teachingWeek: number, weekHolidays: HolidayWeek[]): string | null {
  const mon = getTeachingWeekMonday(startMonday, teachingWeek, weekHolidays);
  const holMap = new Map<string, string>();
  weekHolidays.forEach((h) => holMap.set(toMondayIso(h.monday), h.label));

  const nextMon = addDaysIso(mon, 7);
  const prevMon = addDaysIso(mon, -7);

  if (holMap.has(nextMon)) {
    let endFri = addDaysIso(nextMon, 4);
    let scan = addDaysIso(nextMon, 7);
    while (holMap.has(scan)) {
      endFri = addDaysIso(scan, 4);
      scan = addDaysIso(scan, 7);
    }
    const base = (holMap.get(nextMon) || "").replace(/\s*\(1\.\s*Hafta\)\s*/i, "");
    return `Sonraki tatil: ${fmtShort(nextMon)} – ${fmtFull(endFri)} (${base})`;
  }
  if (holMap.has(prevMon)) {
    let firstMon = prevMon;
    let scan = addDaysIso(prevMon, -7);
    while (holMap.has(scan)) {
      firstMon = scan;
      scan = addDaysIso(scan, -7);
    }
    const base = (holMap.get(prevMon) || "").replace(/\s*\(2\.\s*Hafta\)\s*/i, "");
    return `Önceki tatil: ${fmtShort(firstMon)} – ${fmtFull(addDaysIso(prevMon, 4))} (${base})`;
  }
  return null;
}

function sameGroup(a: TimetableCell | null, target: TimetableCell): boolean {
  if (!a) return false;
  return (
    a.subject.trim().toLocaleLowerCase("tr-TR") === target.subject.trim().toLocaleLowerCase("tr-TR") &&
    (a.section || "").trim().toLocaleLowerCase("tr-TR") ===
      (target.section || "").trim().toLocaleLowerCase("tr-TR")
  );
}

export function shiftGroupOutcomes(
  state: PusulaStateV3,
  target: TimetableCell,
  fromWeek: number,
  fromDayIndex: number,
  fromSlotIndex: number,
  direction: 1 | -1
): PusulaStateV3 {
  const slots: Array<{ key: string }> = [];
  for (let w = fromWeek; w <= state.maxWeek; w++) {
    for (let d = 0; d < 5; d++) {
      if (w === fromWeek && d < fromDayIndex) continue;
      for (let s = 0; s < state.slotsPerDay; s++) {
        if (w === fromWeek && d === fromDayIndex && s < fromSlotIndex) continue;
        const cell = state.timetable[d]?.[s] ?? null;
        if (sameGroup(cell, target)) slots.push({ key: makeCellKey(w, d, s) });
      }
    }
  }
  if (slots.length < 2) return state;

  const nextOutcomes = { ...state.outcomes };
  const nextTimestamps = { ...state.outcomeUpdatedAt };
  const now = Date.now();

  if (direction === 1) {
    for (let i = slots.length - 1; i >= 1; i--) {
      const prevVal = nextOutcomes[slots[i - 1].key];
      if (prevVal && prevVal.trim()) {
        nextOutcomes[slots[i].key] = prevVal;
        nextTimestamps[slots[i].key] = now;
      } else {
        delete nextOutcomes[slots[i].key];
        delete nextTimestamps[slots[i].key];
      }
    }
    delete nextOutcomes[slots[0].key];
    delete nextTimestamps[slots[0].key];
  } else {
    for (let i = 0; i < slots.length - 1; i++) {
      const nextVal = nextOutcomes[slots[i + 1].key];
      if (nextVal && nextVal.trim()) {
        nextOutcomes[slots[i].key] = nextVal;
        nextTimestamps[slots[i].key] = now;
      } else {
        delete nextOutcomes[slots[i].key];
        delete nextTimestamps[slots[i].key];
      }
    }
    delete nextOutcomes[slots[slots.length - 1].key];
    delete nextTimestamps[slots[slots.length - 1].key];
  }

  return { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTimestamps, updatedAt: now };
}