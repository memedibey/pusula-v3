import { addDaysIso, getTeachingWeekMonday } from "./calendarShift";
import { SubjectPalette, getSubjectPalette, splitOutcomeCode } from "./mebPalette";
import { formatFullDateTr, formatShortDateTr } from "./officialExport";
import { LessonUnitGroup, PusulaStateV3, groupTimetableLessons, makeCellKey, subjectPriority } from "./schema";

const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBlob(entries: Array<{ name: string; content: string }>, mimeType: string): Blob {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const dataBytes = enc.encode(entry.content);
    const crc = crc32(dataBytes);

    const loc = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 2048, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    loc.set(nameBytes, 30);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);

    locals.push(loc, dataBytes);
    centrals.push(cen);
    offset += loc.length + dataBytes.length;
  }

  const cdSize = centrals.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...locals.map((b) => new Uint8Array(b)), ...centrals.map((b) => new Uint8Array(b)), eocd], {
    type: mimeType
  });
}

function xmlEscape(s: string): string {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getWeekRangeStr(state: PusulaStateV3, week: number): string {
  const mon = getTeachingWeekMonday(state.startMonday, week, state.weekHolidays);
  const fri = addDaysIso(mon, 4);
  return mon.slice(0, 4) === fri.slice(0, 4)
    ? `${formatShortDateTr(mon)} – ${formatFullDateTr(fri)}`
    : `${formatFullDateTr(mon)} – ${formatFullDateTr(fri)}`;
}

export function buildWeeklyDocxBlob(state: PusulaStateV3, week: number): Blob {
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  const rangeStr = getWeekRangeStr(state, week);
  const mainGroups = groups.filter((g) => subjectPriority(g.subject) === 0);
  const tailGroups = groups.filter((g) => subjectPriority(g.subject) > 0);
  const hasTail = tailGroups.length > 0;
  const colCount = Math.min(5, Math.max(1, mainGroups.length + (hasTail ? 1 : 0)));
  const mainCols = hasTail && colCount > 1 ? colCount - 1 : colCount;

  const cols: LessonUnitGroup[][] = Array.from({ length: colCount }, () => []);
  const colWeights: number[] = Array.from({ length: colCount }, () => 0);

  mainGroups.slice(0, mainCols).forEach((g, idx) => {
    cols[idx].push(g);
    colWeights[idx] += g.lessons.length + 1.5;
  });
  mainGroups.slice(mainCols).forEach((g) => {
    let best = mainCols > 1 ? 1 : 0;
    for (let i = mainCols > 1 ? 1 : 0; i < mainCols; i++) {
      if (colWeights[i] < colWeights[best]) best = i;
    }
    if (colWeights[0] + 1.5 < colWeights[best]) best = 0;
    cols[best].push(g);
    colWeights[best] += g.lessons.length + 1.5;
  });
  if (hasTail) cols[colCount - 1].push(...tailGroups);

  const totalW = 15758;
  const ratios =
    colCount === 5 ? [1.46, 0.98, 0.98, 0.98, 0.86] :
    colCount === 4 ? [1.38, 0.98, 0.98, 0.9] :
    colCount === 3 ? [1.3, 1, 0.92] :
    colCount === 2 ? [1.22, 0.95] : [1];
  const rSum = ratios.reduce((a, b) => a + b, 0);
  const widths = ratios.map((r) => Math.floor((totalW * r) / rSum));
  widths[0] += totalW - widths.reduce((a, b) => a + b, 0);

  const cellsXml = cols
    .map((colGroups, colIdx) => {
      const pList: string[] = [];
      colGroups.forEach((grp, gIdx) => {
        const pal = getSubjectPalette(grp.subject);
        pList.push(
          `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="${pal.hexHeaderBg}"/><w:spacing w:before="${gIdx === 0 ? 15 : 100}" w:after="40"/></w:pPr>` +
            `<w:r><w:rPr><w:b/><w:color w:val="${pal.hexAccent}"/><w:sz w:val="20"/></w:rPr><w:t>${xmlEscape(grp.displayTitle)}</w:t></w:r>` +
            `<w:r><w:rPr><w:color w:val="475569"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> (${grp.lessons.length} ders)</w:t></w:r></w:p>`
        );

        grp.lessons.forEach((l, lIdx) => {
          const lines = (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "")
            .trim()
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean);
          if (lines.length === 0) {
            pList.push(
              `<w:p><w:pPr><w:spacing w:before="15" w:after="25"/></w:pPr>` +
                `<w:r><w:rPr><w:b/><w:color w:val="94A3B8"/><w:sz w:val="17"/></w:rPr><w:t>${lIdx + 1}. </w:t></w:r>` +
                `<w:r><w:rPr><w:color w:val="94A3B8"/><w:sz w:val="17"/></w:rPr><w:t>—</w:t></w:r></w:p>`
            );
          } else {
            lines.forEach((line, i) => {
              const { code, rest } = splitOutcomeCode(line);
              const numRun =
                i === 0
                  ? `<w:r><w:rPr><w:b/><w:color w:val="${pal.hexAccent}"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${lIdx + 1}. </w:t></w:r>`
                  : "";
              const bodyRun = code
                ? `<w:r><w:rPr><w:b/><w:color w:val="${pal.hexAccent}"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${xmlEscape(code)} </w:t></w:r>` +
                  `<w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${xmlEscape(rest)}</w:t></w:r>`
                : `<w:r><w:rPr><w:color w:val="1E293B"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`;
              pList.push(`<w:p><w:pPr><w:spacing w:before="15" w:after="25"/></w:pPr>${numRun}${bodyRun}</w:p>`);
            });
          }
        });
      });
      if (pList.length === 0) pList.push(`<w:p/>`);
      return `<w:tc><w:tcPr><w:tcW w:w="${widths[colIdx]}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${pList.join("")}</w:tc>`;
    })
    .join("");

  const tableXml =
    `<w:tbl><w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/>` +
    `<w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tblBorders>` +
    `<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="95" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="95" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid><w:tr>${cellsXml}</w:tr></w:tbl>`;

  return buildZipBlob(
    [
      {
        name: "[Content_Types].xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
      },
      {
        name: "_rels/.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
      },
      {
        name: "word/document.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/><w:spacing w:before="40" w:after="70"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">  Kazanım Defteri · ${week}. Hafta</w:t></w:r><w:r><w:rPr><w:color w:val="CBD5E1"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">   |   ${xmlEscape(rangeStr)}</w:t></w:r></w:p>${tableXml}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="540" w:right="540" w:bottom="540" w:left="540"/></w:sectPr></w:body></w:document>`
      }
    ],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function colLetter(idx: number): string {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xlsxCell(colIdx: number, rowNum: number, val: string, style: number): string {
  return `<c r="${colLetter(colIdx) + rowNum}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
}

export function buildWeeklyXlsxBlob(state: PusulaStateV3, week: number): Blob {
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  const rangeStr = getWeekRangeStr(state, week);
  const totalCols = Math.max(2, groups.length + 1);
  const maxLessons = groups.reduce((m, g) => Math.max(m, g.lessons.length), 0);
  const lastCol = colLetter(totalCols - 1);

  const colsXml =
    `<col min="1" max="1" width="11" customWidth="1"/>` +
    groups
      .map((g, i) => `<col min="${i + 2}" max="${i + 2}" width="${g.lessons.length >= 4 ? 36 : 28}" customWidth="1"/>`)
      .join("");

  const s1Rows: string[] = [];
  s1Rows.push(`<row r="1" ht="28" customHeight="1">${xlsxCell(0, 1, `Kazanım Defteri · ${week}. Hafta   |   ${rangeStr}`, 1)}</row>`);
  s1Rows.push(
    `<row r="2" ht="24" customHeight="1">${xlsxCell(0, 2, "Ders", 2)}${groups
      .map((g, i) => xlsxCell(i + 1, 2, `${g.displayTitle} (${g.lessons.length} ders)`, 2))
      .join("")}</row>`
  );

  for (let r = 0; r < maxLessons; r++) {
    const rNum = r + 3;
    const cells = [xlsxCell(0, rNum, `${r + 1}. Ders`, 4)];
    let maxLines = 1;
    groups.forEach((g, i) => {
      const l = g.lessons[r];
      if (!l) {
        cells.push(xlsxCell(i + 1, rNum, "", 5));
        return;
      }
      const txt = (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim();
      if (!txt) {
        cells.push(xlsxCell(i + 1, rNum, "—", 5));
        return;
      }
      const lc = txt.split("\n").reduce((a, line) => a + Math.max(1, Math.ceil(line.length / 36)), 0);
      if (lc > maxLines) maxLines = lc;
      cells.push(xlsxCell(i + 1, rNum, txt, 3));
    });
    const ht = Math.min(180, Math.max(24, maxLines * 16 + 8));
    s1Rows.push(`<row r="${rNum}" ht="${ht}" customHeight="1">${cells.join("")}</row>`);
  }

  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${colsXml}</cols><sheetData>${s1Rows.join("")}</sheetData><mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>`;

  const s2Rows: string[] = [
    `<row r="1" ht="24" customHeight="1">${xlsxCell(0, 1, "Hafta", 2)}${xlsxCell(1, 1, "Tarih Aralığı", 2)}${xlsxCell(2, 1, "Gün", 2)}${xlsxCell(3, 1, "Saat", 2)}${xlsxCell(4, 1, "Şube / Ders", 2)}${xlsxCell(5, 1, "Sıra", 2)}${xlsxCell(6, 1, "Kazanım", 2)}</row>`
  ];
  let r2 = 2;
  for (let w = 1; w <= state.maxWeek; w++) {
    let any = false;
    groups.forEach((g) =>
      g.lessons.forEach((l) => {
        if ((state.outcomes[makeCellKey(w, l.dayIndex, l.slotIndex)] || "").trim()) any = true;
      })
    );
    if (!any) continue;
    const rng = getWeekRangeStr(state, w);
    groups.forEach((g) => {
      g.lessons.forEach((l, lIdx) => {
        const txt = (state.outcomes[makeCellKey(w, l.dayIndex, l.slotIndex)] || "").trim();
        if (!txt) return;
        const lc = txt.split("\n").reduce((a, line) => a + Math.max(1, Math.ceil(line.length / 60)), 0);
        const ht = Math.min(180, Math.max(20, lc * 15 + 6));
        s2Rows.push(
          `<row r="${r2}" ht="${ht}" customHeight="1">` +
            xlsxCell(0, r2, `${w}. Hafta`, 4) +
            xlsxCell(1, r2, rng, 3) +
            xlsxCell(2, r2, DAY_NAMES[l.dayIndex] || "", 3) +
            xlsxCell(3, r2, `${l.slotIndex + 1}. Saat`, 4) +
            xlsxCell(4, r2, g.displayTitle, 3) +
            xlsxCell(5, r2, `${lIdx + 1}. Ders`, 4) +
            xlsxCell(6, r2, txt, 3) +
            `</row>`
        );
        r2++;
      });
    });
  }

  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="9" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="11" customWidth="1"/><col min="5" max="5" width="24" customWidth="1"/><col min="6" max="6" width="10" customWidth="1"/><col min="7" max="7" width="64" customWidth="1"/></cols><sheetData>${s2Rows.join("")}</sheetData><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;

  return buildZipBlob(
    [
      {
        name: "[Content_Types].xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
      },
      {
        name: "_rels/.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      },
      {
        name: "xl/workbook.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(`${week}. Hafta`)}" sheetId="1" r:id="rId1"/><sheet name="Tüm Haftalar" sheetId="2" r:id="rId2"/></sheets></workbook>`
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      },
      {
        name: "xl/styles.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10.5"/><color rgb="FF1E293B"/><name val="Calibri"/></font><font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font><font><sz val="10.5"/><color rgb="FF94A3B8"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf></cellXfs></styleSheet>`
      },
      { name: "xl/worksheets/sheet1.xml", content: sheet1 },
      { name: "xl/worksheets/sheet2.xml", content: sheet2 }
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

interface CardRowLayout {
  num: number;
  hasContent: boolean;
  height: number;
  outcomeRows: Array<Array<{ code: string | null; codeW: number; text: string }>>;
}

interface CardLayout {
  group: LessonUnitGroup;
  pal: SubjectPalette;
  colW: number;
  headH: number;
  totalH: number;
  rows: CardRowLayout[];
}

function layoutColumns(
  ctx: CanvasRenderingContext2D,
  state: PusulaStateV3,
  week: number,
  groups: LessonUnitGroup[],
  scale: number
) {
  const margin = 22;
  const gap = 12;
  const cardGap = Math.max(8, Math.round(11 * scale));
  const numColW = Math.round(33 * scale);
  const padX = Math.round(9 * scale);
  const rowPadY = Math.max(5, Math.round(7 * scale));
  const lineH = Math.round(14 * scale * 1.32);
  const outGap = Math.max(3, Math.round(4 * scale));
  const codePadX = Math.round(4.5 * scale);
  const codeGap = Math.round(5.5 * scale);
  const subjFont = `700 ${Math.round(16 * scale)}px Georgia, serif`;
  const bodyFont = `400 ${Math.round(14 * scale)}px system-ui, sans-serif`;
  const codeFont = `700 ${Math.round(12 * scale)}px monospace`;
  const numFont = `700 ${Math.round(12.5 * scale)}px monospace`;

  const mainG = groups.filter((g) => subjectPriority(g.subject) === 0);
  const tailG = groups.filter((g) => subjectPriority(g.subject) > 0);
  const hasTail = tailG.length > 0;
  const totalCols = Math.min(5, Math.max(1, mainG.length + (hasTail ? 1 : 0)));
  const mainCols = hasTail && totalCols > 1 ? totalCols - 1 : totalCols;

  const ratios =
    totalCols === 5 ? [1.46, 0.98, 0.98, 0.98, 0.86] :
    totalCols === 4 ? [1.38, 0.98, 0.98, 0.9] :
    totalCols === 3 ? [1.3, 1, 0.92] :
    totalCols === 2 ? [1.22, 0.95] : [1];
  const rSum = ratios.reduce((a, b) => a + b, 0);
  const availW = 1920 - margin * 2 - gap * (totalCols - 1);
  const colWidths = ratios.map((r) => Math.floor((availW * r) / rSum));
  colWidths[0] += availW - colWidths.reduce((a, b) => a + b, 0);

  const colXs: number[] = [];
  let cx = margin;
  for (let i = 0; i < totalCols; i++) {
    colXs.push(cx);
    cx += colWidths[i] + gap;
  }

  const measureCard = (grp: LessonUnitGroup, colW: number): CardLayout => {
    const pal = getSubjectPalette(grp.subject);
    const innerW = colW - numColW - padX * 2;
    ctx.font = subjFont;
    const titleLines = wrapText(ctx, grp.displayTitle, colW - 88 * scale);
    const headH = Math.max(Math.round(35 * scale), titleLines.length * Math.round(19 * scale) + Math.round(16 * scale));

    const rows: CardRowLayout[] = grp.lessons.map((l, idx) => {
      const rawLines = (state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "")
        .trim()
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const outcomeRows: CardRowLayout["outcomeRows"] = [];
      let h = 0;

      if (rawLines.length === 0) {
        h = lineH;
      } else {
        rawLines.forEach((raw) => {
          const { code, rest } = splitOutcomeCode(raw);
          ctx.font = codeFont;
          const codeW = code ? ctx.measureText(code).width : 0;
          const codeBoxW = code ? codeW + codePadX * 2 + codeGap : 0;
          ctx.font = bodyFont;
          if (code && rest) {
            const words = rest.split(/\s+/).filter(Boolean);
            const firstLineWords: string[] = [];
            let built = "";
            const firstAvail = Math.max(60, innerW - codeBoxW);
            while (words.length > 0) {
              const test = built ? `${built} ${words[0]}` : words[0];
              if (ctx.measureText(test).width <= firstAvail) {
                built = test;
                firstLineWords.push(words.shift()!);
              } else break;
            }
            const segs: Array<{ code: string | null; codeW: number; text: string }> = [{ code, codeW, text: firstLineWords.join(" ") }];
            if (words.length > 0) {
              wrapText(ctx, words.join(" "), innerW).forEach((wLine) =>
                segs.push({ code: null, codeW: 0, text: wLine })
              );
            }
            outcomeRows.push(segs);
            h += segs.length * lineH + outGap;
          } else if (code) {
            outcomeRows.push([{ code, codeW, text: "" }]);
            h += lineH + outGap;
          } else {
            const wrapped = wrapText(ctx, raw, innerW);
            outcomeRows.push(wrapped.map((t) => ({ code: null, codeW: 0, text: t })));
            h += Math.max(1, wrapped.length) * lineH + outGap;
          }
        });
        h -= outGap;
      }
      return {
        num: idx + 1,
        hasContent: rawLines.length > 0,
        height: Math.max(Math.round(30 * scale), h + rowPadY * 2),
        outcomeRows
      };
    });

    const totalH = headH + rows.reduce((a, b) => a + b.height, 0);
    return { group: grp, pal, colW, headH, totalH, rows };
  };

  const columns: CardLayout[][] = Array.from({ length: totalCols }, () => []);
  const colHeights: number[] = Array.from({ length: totalCols }, () => 0);

  mainG.slice(0, mainCols).forEach((g, i) => {
    const card = measureCard(g, colWidths[i]);
    columns[i].push(card);
    colHeights[i] += card.totalH;
  });
  mainG.slice(mainCols).forEach((g) => {
    let best = mainCols > 1 ? 1 : 0;
    for (let i = mainCols > 1 ? 1 : 0; i < mainCols; i++) {
      if (colHeights[i] < colHeights[best]) best = i;
    }
    if (colHeights[0] + 80 < colHeights[best]) best = 0;
    const card = measureCard(g, colWidths[best]);
    columns[best].push(card);
    colHeights[best] += (columns[best].length > 1 ? cardGap : 0) + card.totalH;
  });
  if (hasTail) {
    const last = totalCols - 1;
    tailG.forEach((g) => {
      const card = measureCard(g, colWidths[last]);
      columns[last].push(card);
      colHeights[last] += (columns[last].length > 1 ? cardGap : 0) + card.totalH;
    });
  }

  return {
    totalCols,
    colWidths,
    colXs,
    columns,
    colHeights,
    maxColH: Math.max(...colHeights, 240),
    cardGap,
    numColW,
    padX,
    rowPadY,
    lineH,
    outGap,
    codePadX,
    codeGap,
    subjFont,
    bodyFont,
    codeFont,
    numFont
  };
}

export async function renderWeeklyCanvas(state: PusulaStateV3, week: number): Promise<HTMLCanvasElement> {
  const groups = groupTimetableLessons(state.timetable, state.slotsPerDay);
  const totalLessons = groups.reduce((a, g) => a + g.lessons.length, 0);
  let filledLessons = 0;
  groups.forEach((g) =>
    g.lessons.forEach((l) => {
      if ((state.outcomes[makeCellKey(week, l.dayIndex, l.slotIndex)] || "").trim()) filledLessons++;
    })
  );

  const probe = document.createElement("canvas");
  probe.width = 10;
  probe.height = 10;
  const pCtx = probe.getContext("2d")!;

  let layout = layoutColumns(pCtx, state, week, groups, 0.85);
  for (let s = 1.5; s >= 0.8; s -= 0.04) {
    const test = layoutColumns(pCtx, state, week, groups, Number(s.toFixed(2)));
    if (test.maxColH <= 960) {
      layout = test;
      break;
    }
  }

  const width = 1920;
  const height = Math.max(1080, 92 + layout.maxColH + 22);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#F1F5F9";
  ctx.fillRect(0, 0, width, height);

  roundRect(ctx, 22, 16, 1876, 64, 12);
  const grad = ctx.createLinearGradient(22, 16, 1898, 80);
  grad.addColorStop(0, "#0F172A");
  grad.addColorStop(0.55, "#1E293B");
  grad.addColorStop(1, "#1E3A8A");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.font = "700 13px monospace";
  const badgeTxt = "KAZANIM DEFTERİ";
  const badgeW = ctx.measureText(badgeTxt).width + 22;
  roundRect(ctx, 40, 33, badgeW, 30, 8);
  ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
  ctx.fill();
  ctx.fillStyle = "#7DD3FC";
  ctx.fillText(badgeTxt, 51, 48.5);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText(`${week}. Hafta`, 40 + badgeW + 16, 49);

  const rangeStr = getWeekRangeStr(state, week);
  ctx.font = "600 17px system-ui, sans-serif";
  const rW = ctx.measureText(rangeStr).width + 28;
  roundRect(ctx, 1882 - rW, 29, rW, 38, 9);
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fill();
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(rangeStr, 1882 - rW + 14, 48.5);

  ctx.font = "500 15px monospace";
  ctx.fillStyle = "#CBD5E1";
  const infoStr = `${groups.length} ders · ${totalLessons} saat`;
  ctx.fillText(infoStr, 1882 - rW - 18 - ctx.measureText(infoStr).width, 48.5);

  layout.columns.forEach((colCards, colIdx) => {
    const x = layout.colXs[colIdx];
    let y = 92;
    colCards.forEach((card) => {
      ctx.save();
      roundRect(ctx, x, y, card.colW, card.totalH, 10);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.clip();

      ctx.fillStyle = card.pal.headerBg;
      ctx.fillRect(x, y, card.colW, card.headH);
      ctx.fillStyle = card.pal.accent;
      ctx.fillRect(x, y, card.colW, 4);

      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0F172A";
      ctx.font = layout.subjFont;
      ctx.fillText(card.group.displayTitle, x + 11, y + card.headH / 2 + 1);

      let ry = y + card.headH;
      card.rows.forEach((row, rIdx) => {
        if (rIdx % 2 === 1) {
          ctx.fillStyle = "#F8FAFC";
          ctx.fillRect(x, ry, card.colW, row.height);
        }
        ctx.strokeStyle = "#E2E8F0";
        ctx.beginPath();
        ctx.moveTo(x, ry);
        ctx.lineTo(x + card.colW, ry);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + layout.numColW / 2, ry + layout.rowPadY + layout.lineH / 2, 10, 0, Math.PI * 2);
        ctx.fillStyle = row.hasContent ? card.pal.badgeBg : "#F1F5F9";
        ctx.fill();

        ctx.fillStyle = row.hasContent ? card.pal.accentDark : "#94A3B8";
        ctx.font = layout.numFont;
        const nStr = String(row.num);
        ctx.fillText(nStr, x + layout.numColW / 2 - ctx.measureText(nStr).width / 2, ry + layout.rowPadY + layout.lineH / 2);

        ctx.textBaseline = "top";
        let ty = ry + layout.rowPadY;
        const tx = x + layout.numColW + layout.padX;
        if (row.outcomeRows.length === 0) {
          ctx.fillStyle = "#94A3B8";
          ctx.font = layout.bodyFont;
          ctx.fillText("Kazanım girilmedi", tx, ty);
        } else {
          row.outcomeRows.forEach((segs) => {
            segs.forEach((seg) => {
              let sx = tx;
              if (seg.code) {
                const bw = seg.codeW + layout.codePadX * 2;
                roundRect(ctx, sx, ty, bw, Math.round(layout.lineH * 0.88), 4);
                ctx.fillStyle = card.pal.badgeBg;
                ctx.fill();
                ctx.fillStyle = card.pal.accentDark;
                ctx.font = layout.codeFont;
                ctx.fillText(seg.code, sx + layout.codePadX, ty + 2);
                sx += bw + layout.codeGap;
              }
              if (seg.text) {
                ctx.fillStyle = "#1E293B";
                ctx.font = layout.bodyFont;
                ctx.fillText(seg.text, sx, ty);
              }
              ty += layout.lineH;
            });
            ty += layout.outGap;
          });
        }
        ctx.textBaseline = "middle";
        ry += row.height;
      });
      ctx.restore();

      roundRect(ctx, x, y, card.colW, card.totalH, 10);
      ctx.strokeStyle = "#CBD5E1";
      ctx.lineWidth = 1.25;
      ctx.stroke();
      y += card.totalH + layout.cardGap;
    });
  });

  const lastCol = layout.totalCols - 1;
  const sumY = 92 + layout.colHeights[lastCol] + layout.cardGap;
  const availH = height - 20 - sumY;
  if (groups.length > 0 && availH >= 100) {
    const sx = layout.colXs[lastCol];
    const sw = layout.colWidths[lastCol];
    const sh = Math.min(availH, 160);
    roundRect(ctx, sx, sumY, sw, sh, 10);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#CBD5E1";
    ctx.stroke();

    ctx.textBaseline = "top";
    ctx.fillStyle = "#0F172A";
    ctx.font = "700 14px Georgia, serif";
    ctx.fillText("Haftalık Özet", sx + 14, sumY + 14);
    const pct = totalLessons > 0 ? Math.round((filledLessons / totalLessons) * 100) : 0;
    const pTxt = `${filledLessons}/${totalLessons} ders (%${pct})`;
    ctx.fillStyle = pct === 100 ? "#047857" : "#1D4ED8";
    ctx.font = "600 12px monospace";
    ctx.fillText(pTxt, sx + sw - 14 - ctx.measureText(pTxt).width, sumY + 16);

    let gx = sx + 14;
    const barW = sw - 28;
    groups.forEach((g) => {
      const segW = (g.lessons.length / Math.max(1, totalLessons)) * barW;
      ctx.fillStyle = getSubjectPalette(g.subject).accent;
      ctx.fillRect(gx, sumY + 46, segW + 0.5, 10);
      gx += segW;
    });
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Görsel oluşturulamadı."))), type, quality);
  });
}

export async function buildWeeklyPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfW = 841.89;
  const pdfH = Number(((canvas.height / canvas.width) * pdfW).toFixed(2));
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let len = 0;

  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    len += b.length;
  };
  const pushStr = (s: string) => pushBytes(enc.encode(s));

  pushBytes(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  const offsets: number[] = [];
  offsets.push(len);
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets.push(len);
  pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets.push(len);
  pushStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  offsets.push(len);
  pushStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  pushBytes(jpegBytes);
  pushStr("\nendstream\nendobj\n");
  const streamCmd = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(len);
  pushStr(`5 0 obj\n<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream\nendobj\n`);

  const xrefPos = len;
  pushStr("xref\n0 6\n0000000000 65535 f \n");
  offsets.forEach((o) => pushStr(String(o).padStart(10, "0") + " 00000 n \n"));
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(parts.map((p) => new Uint8Array(p)), { type: "application/pdf" });
}