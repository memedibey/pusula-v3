import { describe, expect, it } from "vitest";
import { computeProgressReport, distributePlanToSections, rebalanceWeeklyPlan } from "../branchPlanner";
import { buildCalendarTimeline, getAdjacentHolidayNote, getLessonDateIso, shiftGroupOutcomes } from "../calendarShift";
import { parsePlainTextPlan } from "../docxXlsxParser";
import { getKademeSubjects } from "../mebCatalog";
import { splitOutcomeCode } from "../mebPalette";
import { buildWeeklyDocxBlob, buildWeeklyXlsxBlob } from "../richExports";
import { groupTimetableLessons, makeCellKey, migrateV2ToV3, sanitizeOutcomeText } from "../schema";
import { createDefaultStateV3 } from "../storage";
import { decodeSyncCode, encodeSyncCode } from "../syncEngine";

describe("Pusula v3.0 Çekirdek Motoru", () => {
  it("v2 verisini tek hücre kaybetmeden v3'e geçirir ve bozuk tarih/ders öneklerini temizler", () => {
    const v2 = {
      startMonday: "2026-09-14",
      holidays: [{ monday: "2026-11-16", label: "Sonbahar Ara Tatili" }],
      timetable: [
        ["Türkçe", "Matematik", "", "", "", ""],
        ["Türkçe", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""],
        ["", "", "", "", "", ""]
      ],
      outcomes: {
        "1|0|0": "T.4.1.1. Okur.",
        "1_0_1": "14 Eylül – 18 Eylül 2026;Matematik;3;M.4.1.1.1. 4, 5 ve 6 basamaklı doğal sayıları okur ve yazar."
      },
      updatedAt: 1700000000000
    };
    const v3 = migrateV2ToV3(v2);
    expect(v3).not.toBeNull();
    expect(v3!.version).toBe(3);
    expect(v3!.dayHolidays).toEqual({});
    expect(v3!.outcomes["1|0|0"]).toBe("T.4.1.1. Okur.");
    expect(v3!.outcomes["1|0|1"]).toBe("M.4.1.1.1. 4, 5 ve 6 basamaklı doğal sayıları okur ve yazar.");
    expect(sanitizeOutcomeText("Sayıları okur; karşılaştırır.")).toBe("Sayıları okur; karşılaştırır.");
  });

  it("CSV ve noktalı virgüllü plan satırlarından tarih/ders/saat öneklerini ayıklayıp yalnız kazanımı alır", () => {
    const csv = [
      "Hafta;Tarih;Ders;Saat;Kazanım",
      "1;14 Eylül – 18 Eylül 2026;Matematik;3;M.4.1.1.1. Doğal sayıları okur.",
      "14 Eylül – 18 Eylül 2026;Matematik;4;M.4.1.1.2. Yüzer ve biner sayar.",
      '2;"Türkçe";"T.4.1.2. Metni anlar."'
    ].join("\n");
    const res = parsePlainTextPlan(csv, ["Türkçe", "Matematik"]);
    expect(res.weeklyOutcomes[1]).toEqual([
      "M.4.1.1.1. Doğal sayıları okur.",
      "M.4.1.1.2. Yüzer ve biner sayar."
    ]);
    expect(res.weeklyOutcomes[2]).toEqual(["T.4.1.2. Metni anlar."]);
  });

  it("Ana dersleri öne, İngilizce ve Din Kültürü derslerini sona sıralar", () => {
    const st = createDefaultStateV3();
    const groups = groupTimetableLessons(st.timetable, st.slotsPerDay);
    expect(groups[0].subject).toBe("Türkçe");
    expect(groups[1].subject).toBe("Matematik");
    const ingIdx = groups.findIndex((g) => g.subject.startsWith("İngilizce"));
    const dinIdx = groups.findIndex((g) => g.subject.startsWith("Din Kültürü"));
    expect(ingIdx).toBeGreaterThan(groups.length - 4);
    expect(dinIdx).toBe(groups.length - 1);
  });

  it("MEB 2026-2027 takvimini v2 ile birebir (37 ders + 4 tatil haftası) hesaplar", () => {
    const st = createDefaultStateV3();
    expect(Object.keys(st.dayHolidays).length).toBe(0);
    expect(st.weekHolidays.map((h) => h.label)).toEqual([
      "Sonbahar Ara Tatili",
      "Yarıyıl Tatili (1. Hafta)",
      "Yarıyıl Tatili (2. Hafta)",
      "Bahar Ara Tatili"
    ]);
    const tl = buildCalendarTimeline(st.startMonday, st.weekHolidays, 37);
    expect(tl.length).toBe(41);
    expect(getLessonDateIso(st, 1, 0)).toBe("2026-09-14");
    expect(getLessonDateIso(st, 18, 4)).toBe("2027-01-22");
    expect(getLessonDateIso(st, 19, 0)).toBe("2027-02-08");
    expect(getLessonDateIso(st, 37, 4)).toBe("2027-06-25");
    expect(getAdjacentHolidayNote(st.startMonday, 9, st.weekHolidays)).toContain("Sonbahar Ara Tatili");
  });

  it("Lise ve Maarif Modeli çıktı kodlarını doğru ayırır", () => {
    expect(splitOutcomeCode("FİZ.10.2.1.a Hareket yasalarını açıklar.")).toEqual({
      code: "FİZ.10.2.1.a",
      rest: "Hareket yasalarını açıklar."
    });
  });

  it("Word (.docx), Excel (.xlsx) ve KD5Z eşitleme kodu üretip geri çözer", async () => {
    const st = createDefaultStateV3();
    st.outcomes["1|0|0"] = "F.4.1.1. Yer kabuğunu inceler.";
    expect(buildWeeklyDocxBlob(st, 1).size).toBeGreaterThan(500);
    expect(buildWeeklyXlsxBlob(st, 1).size).toBeGreaterThan(500);
    const code = await encodeSyncCode(st);
    const decoded = await decodeSyncCode(code);
    expect(decoded.outcomes["1|0|0"]).toBe("F.4.1.1. Yer kabuğunu inceler.");
  });

  it("Çoklu şubeye dağıtır ve konuyu ileri öteler", () => {
    const base = createDefaultStateV3();
    base.kademe = "ortaokul";
    base.mode = "brans";
    base.slotsPerDay = 7;
    base.timetable = [
      [{ subject: "Matematik", section: "7/A" }, null, null, null, null, null, null],
      [{ subject: "Matematik", section: "7/B" }, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [{ subject: "Matematik", section: "7/A" }, null, null, null, null, null, null],
      [null, null, null, null, null, null, null]
    ];

    const dist = distributePlanToSections(base, {
      subject: "Matematik",
      sections: ["7/A", "7/B"],
      weeklyOutcomes: { 7: ["M.7.1.1. Tam sayılar"], 8: ["M.7.1.2. İşlemler"] },
      mode: "spread"
    });
    expect(dist.skippedHolidaySlots).toBe(0);

    const shifted = shiftGroupOutcomes(dist.nextState, { subject: "Matematik", section: "7/A" }, 7, 0, 0, 1);
    expect(shifted.outcomes[makeCellKey(7, 0, 0)]).toBeUndefined();
    expect(shifted.outcomes[makeCellKey(7, 3, 0)]).toContain("M.7.1.1.");
    expect(computeProgressReport(shifted, 8).find((r) => r.displayTitle === "7/A · Matematik")?.filledSlots).toBeGreaterThan(0);
  });

  it("tatil kaymalı planı tarihe göre doğru haftaya oturtur, 2 haftalık aralıkları ve 37 haftayı boşluksuz dengeler", () => {
    const plan = [
      "10. Hafta | 16-20 Kasım | 1. Dönem Ara Tatili",
      "11. Hafta | 23-27 Kasım | M.4.2.1.1. Doğal sayılarla toplama yapar.",
      "1-2. Hafta | T.4.1.1. Okur."
    ].join("\n");
    const parsed = parsePlainTextPlan(plan, ["Matematik", "Türkçe"]);
    expect(parsed.weeklyOutcomes[10]).toContain("M.4.2.1.1. Doğal sayılarla toplama yapar.");
    expect(parsed.weeklyOutcomes[1]).toContain("T.4.1.1. Okur.");
    expect(parsed.weeklyOutcomes[2]).toContain("T.4.1.1. Okur.");

    const partial: Record<number, string[]> = {};
    for (let w = 1; w <= 34; w++) partial[w] = [`Kazanım ${w}`];
    const balanced = rebalanceWeeklyPlan(partial, 37);
    expect(Object.keys(balanced).length).toBe(37);
    expect(balanced[37]).toEqual(["Kazanım 34"]);
  });

  it("kademelere göre ayrı ders havuzu sunar ve özel ekleme/çıkarmayı korur", () => {
    expect(getKademeSubjects("ilkokul")).toContain("Hayat Bilgisi");
    expect(getKademeSubjects("lise")).toContain("Fizik");
    expect(getKademeSubjects("lise")).not.toContain("Hayat Bilgisi");
    expect(getKademeSubjects("ortaokul", { ortaokul: ["Matematik", "Robotik Kodlama"] })).toEqual([
      "Matematik",
      "Robotik Kodlama"
    ]);
  });
});