import React, { useMemo } from "react";
import { computeProgressReport } from "../core/branchPlanner";
import { shareOrDownloadBlob } from "../core/mobileDownload";
import { generateProgressCsv, generateWeeklyClassbookHtml } from "../core/officialExport";
import { PusulaStateV3 } from "../core/schema";
import { exportEmbeddedHtmlV3 } from "../core/storage";

interface Props {
  state: PusulaStateV3;
  week: number;
  onNotify: (msg: string) => void;
}

export const ReportView: React.FC<Props> = ({ state, week, onNotify }) => {
  const rows = useMemo(() => computeProgressReport(state, 37), [state]);

  const handlePrintClassbook = () => {
    const html = generateWeeklyClassbookHtml(state, week);
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      void shareOrDownloadBlob(
        new Blob([html], { type: "text/html;charset=utf-8" }),
        `sinif-defteri-${week}-hafta.html`,
        onNotify
      );
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex sm:flex-wrap">
        <button type="button" onClick={handlePrintClassbook} className="kd-btn kd-btn-primary">
          {week}. Hafta Resmi Sınıf Defteri (A4)
        </button>
        <button
          type="button"
          onClick={() => {
            void shareOrDownloadBlob(
              generateProgressCsv(state, 37),
              "zumre-gerceklesme-raporu.csv",
              onNotify
            );
          }}
          className="kd-btn"
        >
          Zümre Raporu (.csv)
        </button>
        <button
          type="button"
          onClick={() => {
            const html = exportEmbeddedHtmlV3(state);
            void shareOrDownloadBlob(
              new Blob([html], { type: "text/html;charset=utf-8" }),
              "kazanim-defteri-pusula-v3-verili.html",
              onNotify
            );
          }}
          className="kd-btn"
        >
          Verilerimle Tek-Dosya HTML
        </button>
        <button
          type="button"
          onClick={() => {
            void shareOrDownloadBlob(
              new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" }),
              "kazanim_defteri_v3_yedek.json",
              onNotify
            );
          }}
          className="kd-btn"
        >
          JSON Tam Yedek
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.groupKey} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <strong className="text-base">{r.displayTitle}</strong>
              <span className="font-mono-num text-sm font-bold text-[var(--accent)]">
                %{r.completionPct} ({r.filledSlots}/{r.totalActiveSlots})
              </span>
            </div>
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg)]">
              <div style={{ width: `${r.completionPct}%` }} className="h-full bg-[var(--accent)] transition-all" />
            </div>
            <div className="flex flex-wrap justify-between gap-1 text-xs text-[var(--muted)]">
              <span>Haftalık {r.weeklyHours} saat</span>
              <span>Son giriş: {r.lastFilledWeek ? `${r.lastFilledWeek}. Hafta` : "Henüz yok"}</span>
            </div>
            {r.lastOutcomePreview && (
              <p className="m-0 mt-2 truncate text-xs text-[var(--fg)]">{r.lastOutcomePreview}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};