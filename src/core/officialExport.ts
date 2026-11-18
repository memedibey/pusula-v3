import { computeProgressReport } from "./branchPlanner";
import { getLessonDateIso } from "./calendarShift";
import { LessonUnitGroup, PusulaStateV3, makeCellKey, migrateV2ToV3 } from "./schema";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(val: string): string {
  const s = String(val ?? "");
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function formatIsoTr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function formatShortDateTr(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

export function formatFullDateTr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatLessonForClassbook(
  state: PusulaStateV3,
  week: number,
  dayIndex: number,
  slotIndex: number
): string {
  const cell = state.timetable[dayIndex]?.[slotIndex];
  if (!cell) return "";
  const dateIso = getLessonDateIso(state, week, dayIndex);
  const title = cell.section ? `${cell.section} · ${cell.subject}` : cell.subject;
  const text = (state.outcomes[makeCellKey(week, dayIndex, slotIndex)] || "").trim() || "—";
  return `${formatIsoTr(dateIso)} (${DAY_NAMES[dayIndex]}) · ${slotIndex + 1}. Ders | ${title}: ${text.replace(/\s*\n+\s*/g, " | ")}`;
}

export function formatSubjectForCopy(
  state: PusulaStateV3,
  week: number,
  group: LessonUnitGroup
): string {
  const lines = [`${group.displayTitle} · ${week}. Hafta`];
  group.lessons.forEach((l, idx) => {
    const dIso = getLessonDateIso(state, week, l.dayIndex);
    const val = (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim();
    const prefix = `${idx + 1}. ders · ${DAY_NAMES[l.dayIndex]} ${formatShortDateTr(dIso)} (${l.slotIndex + 1}. ders saati):`;
    if (!val) lines.push(prefix);
    else if (!val.includes("\n")) lines.push(`${prefix} ${val}`);
    else lines.push(`${prefix}\n${val}`);
  });
  return lines.join("\n");
}

export function formatWeekForCopy(state: PusulaStateV3, week: number): string {
  const out = [`${week}. Hafta`];
  for (let d = 0; d < 5; d++) {
    const dIso = getLessonDateIso(state, week, d);
    const hol = state.dayHolidays[dIso];
    const dayLines = [`${formatFullDateTr(dIso)} ${DAY_NAMES[d]}${hol ? ` (${hol})` : ""}`];
    for (let s = 0; s < state.slotsPerDay; s++) {
      const cell = state.timetable[d]?.[s];
      if (!cell) continue;
      const title = cell.section ? `${cell.section} · ${cell.subject}` : cell.subject;
      const val = (state.outcomes[makeCellKey(week, d, s)] || "").trim();
      const prefix = `${s + 1}. Ders (${title}):`;
      if (!val) dayLines.push(prefix);
      else if (!val.includes("\n")) dayLines.push(`${prefix} ${val}`);
      else dayLines.push(`${prefix}\n${val}`);
    }
    if (dayLines.length > 1) {
      out.push("");
      out.push(dayLines.join("\n"));
    }
  }
  return out.join("\n");
}

export function generateWeeklyClassbookHtml(state: PusulaStateV3, week: number): string {
  const rows: string[] = [];
  for (let d = 0; d < 5; d++) {
    const dateIso = getLessonDateIso(state, week, d);
    const holidayLabel = state.dayHolidays[dateIso];
    for (let s = 0; s < state.slotsPerDay; s++) {
      const cell = state.timetable[d]?.[s];
      if (!cell) continue;
      const title = cell.section ? `${cell.section} · ${cell.subject}` : cell.subject;
      const outcome = holidayLabel
        ? `TATİL: ${holidayLabel}`
        : (state.outcomes[makeCellKey(week, d, s)] || "").trim() || "—";
      rows.push(
        `<tr${holidayLabel ? ' class="hol"' : ""}>` +
          `<td>${escapeHtml(formatIsoTr(dateIso))}<br><small>${DAY_NAMES[d]}</small></td>` +
          `<td class="num">${s + 1}. Ders</td>` +
          `<td><strong>${escapeHtml(title)}</strong></td>` +
          `<td>${escapeHtml(outcome).replace(/\n/g, "<br>")}</td>` +
          `</tr>`
      );
    }
  }

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>${week}. Hafta Sınıf Defteri</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;margin:24px}
  h1{font-size:18px;margin:0 0 4px}
  p{margin:0 0 14px;color:#475569;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{border:1px solid #cbd5e1;padding:7px 9px;vertical-align:top;text-align:left}
  th{background:#f1f5f9;font-weight:700}
  td.num{text-align:center;white-space:nowrap;font-weight:600}
  tr.hol{background:#fff7ed;color:#9a3412}
  @media print{body{margin:10mm}}
</style></head><body>
<h1>Kazanım Defteri · ${week}. Hafta Resmi Sınıf Defteri Çizelgesi</h1>
<p>${escapeHtml(state.gradeLabel || "")} · Günde ${state.slotsPerDay} ders saati (Öğretmen özel notları hariç tutulmuştur)</p>
<table><thead><tr><th>Tarih</th><th>Saat</th><th>Şube / Ders</th><th>Kazanım / Öğrenme Çıktısı</th></tr></thead>
<tbody>${rows.join("")}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`;
}

export function generateProgressCsv(state: PusulaStateV3, upToWeek: number = 37): Blob {
  const rows = computeProgressReport(state, upToWeek);
  const lines = [
    ["Şube / Ders", "Haftalık Saat", "Aktif Ders Saati", "Dolu Saat", "Tamamlanma (%)", "Son İşlenen Hafta", "Son Kazanım Özeti"]
      .map(csvCell)
      .join(";")
  ];
  for (const r of rows) {
    lines.push(
      [
        r.displayTitle,
        String(r.weeklyHours),
        String(r.totalActiveSlots),
        String(r.filledSlots),
        `%${r.completionPct}`,
        r.lastFilledWeek ? `${r.lastFilledWeek}. Hafta` : "—",
        r.lastOutcomePreview || "—"
      ]
        .map(csvCell)
        .join(";")
    );
  }
  return new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
}

export function parseBackupJson(jsonText: string): PusulaStateV3 {
  const raw = JSON.parse(jsonText);
  const migrated = migrateV2ToV3(raw);
  if (!migrated) throw new Error("Geçersiz v2 veya v3 yedek dosyası.");
  return migrated;
}