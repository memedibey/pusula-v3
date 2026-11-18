import { getLessonDateIso } from "./calendarShift";
import { PusulaStateV3, groupTimetableLessons, makeCellKey } from "./schema";

export interface DistributeOptions {
  subject: string;
  sections: string[];
  weeklyOutcomes: Record<number, string[]>;
  mode: "spread" | "sequential";
  skipDayHolidays?: boolean;
}

export interface DistributeResult {
  nextState: PusulaStateV3;
  writtenCells: number;
  skippedHolidaySlots: number;
}

export function rebalanceWeeklyPlan(
  weeklyOutcomes: Record<number, string[]>,
  targetWeeks: number = 37
): Record<number, string[]> {
  const entries = Object.entries(weeklyOutcomes)
    .map(([w, items]) => ({ w: Number(w), items: items.map((x) => x.trim()).filter(Boolean) }))
    .filter((x) => Number.isInteger(x.w) && x.w >= 1 && x.items.length > 0)
    .sort((a, b) => a.w - b.w);

  if (entries.length === 0) return {};
  if (entries.length === targetWeeks && entries.every((e, i) => e.w === i + 1)) {
    const exact: Record<number, string[]> = {};
    entries.forEach((e) => { exact[e.w] = e.items; });
    return exact;
  }

  const out: Record<number, string[]> = {};
  if (entries.length <= targetWeeks) {
    for (let w = 1; w <= targetWeeks; w++) {
      const idx = Math.min(entries.length - 1, Math.floor(((w - 1) * entries.length) / targetWeeks));
      out[w] = entries[idx].items;
    }
  } else {
    for (let i = 0; i < entries.length; i++) {
      const w = 1 + Math.min(targetWeeks - 1, Math.floor((i * targetWeeks) / entries.length));
      out[w] = [...(out[w] || []), ...entries[i].items];
    }
  }
  return out;
}

export function distributePlanToSections(state: PusulaStateV3, opts: DistributeOptions): DistributeResult {
  const skipHol = opts.skipDayHolidays !== false;
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  const targetSubj = opts.subject.trim().toLocaleLowerCase("tr-TR");
  const targetSections = new Set(opts.sections.map((s) => s.trim().toLocaleLowerCase("tr-TR")));

  const matchedGroups = groups.filter(
    (g) =>
      g.subject.toLocaleLowerCase("tr-TR") === targetSubj &&
      (targetSections.size === 0 || targetSections.has((g.section || "").toLocaleLowerCase("tr-TR")))
  );

  const nextOutcomes = { ...state.outcomes };
  const nextTimestamps = { ...state.outcomeUpdatedAt };
  const now = Date.now();
  let writtenCells = 0;
  let skippedHolidaySlots = 0;

  for (const [weekStr, items] of Object.entries(opts.weeklyOutcomes)) {
    const week = Number(weekStr);
    if (!Number.isInteger(week) || week < 1 || week > state.maxWeek) continue;
    const cleanItems = items.map((x) => x.trim()).filter(Boolean);
    if (cleanItems.length === 0) continue;

    for (const grp of matchedGroups) {
      const usableSlots: Array<{ dayIndex: number; slotIndex: number }> = [];
      for (const lesson of grp.lessons) {
        const dateIso = getLessonDateIso(state, week, lesson.dayIndex);
        if (skipHol && state.dayHolidays[dateIso]) { skippedHolidaySlots += 1; continue; }
        usableSlots.push(lesson);
      }
      if (usableSlots.length === 0) continue;

      const total = usableSlots.length;
      if (cleanItems.length <= total) {
        if (opts.mode === "spread") {
          for (let i = 0; i < total; i++) {
            const idx = Math.min(cleanItems.length - 1, Math.floor((i * cleanItems.length) / total));
            const key = makeCellKey(week, usableSlots[i].dayIndex, usableSlots[i].slotIndex);
            nextOutcomes[key] = cleanItems[idx];
            nextTimestamps[key] = now;
            writtenCells += 1;
          }
        } else {
          for (let i = 0; i < cleanItems.length; i++) {
            const key = makeCellKey(week, usableSlots[i].dayIndex, usableSlots[i].slotIndex);
            nextOutcomes[key] = cleanItems[i];
            nextTimestamps[key] = now;
            writtenCells += 1;
          }
        }
      } else {
        const buckets: string[][] = Array.from({ length: total }, () => []);
        cleanItems.forEach((item, idx) => {
          const bIdx = Math.min(total - 1, Math.floor((idx * total) / cleanItems.length));
          buckets[bIdx].push(item);
        });
        buckets.forEach((b, i) => {
          if (b.length === 0) return;
          const key = makeCellKey(week, usableSlots[i].dayIndex, usableSlots[i].slotIndex);
          nextOutcomes[key] = b.join("\n");
          nextTimestamps[key] = now;
          writtenCells += 1;
        });
      }
    }
  }

  return { nextState: { ...state, outcomes: nextOutcomes, outcomeUpdatedAt: nextTimestamps, updatedAt: now }, writtenCells, skippedHolidaySlots };
}

export interface GroupProgressRow {
  groupKey: string;
  displayTitle: string;
  weeklyHours: number;
  totalActiveSlots: number;
  filledSlots: number;
  completionPct: number;
  lastFilledWeek: number | null;
  lastOutcomePreview: string;
}

export function computeProgressReport(state: PusulaStateV3, upToWeek: number = 37): GroupProgressRow[] {
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  return groups.map((grp) => {
    let totalActiveSlots = 0, filledSlots = 0, lastFilledWeek: number | null = null, lastOutcomePreview = "";
    for (let w = 1; w <= upToWeek; w++) {
      for (const lesson of grp.lessons) {
        const dateIso = getLessonDateIso(state, w, lesson.dayIndex);
        if (state.dayHolidays[dateIso]) continue;
        totalActiveSlots += 1;
        const val = (state.outcomes[makeCellKey(w, lesson.dayIndex, lesson.slotIndex)] || "").trim();
        if (val) { filledSlots += 1; lastFilledWeek = w; lastOutcomePreview = val.split("\n")[0].slice(0, 80); }
      }
    }
    return {
      groupKey: grp.groupKey,
      displayTitle: grp.displayTitle,
      weeklyHours: grp.lessons.length,
      totalActiveSlots,
      filledSlots,
      completionPct: totalActiveSlots > 0 ? Math.round((filledSlots / totalActiveSlots) * 100) : 0,
      lastFilledWeek,
      lastOutcomePreview
    };
  });
}