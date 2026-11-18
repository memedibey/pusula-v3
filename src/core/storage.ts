import { PROGRAM_TEMPLATES } from "./mebCatalog";
import { MEB_2026_2027_CALENDAR, PusulaStateV3, migrateV2ToV3 } from "./schema";

export const V3_STORAGE_KEY = "kazanim_defteri_v3";
export const V2_STORAGE_KEY = "kazanim_defteri_v2";
export const V1_STORAGE_KEY = "kazanim_defteri_v1";

const IDB_NAME = "kazanim_defteri_v3_db";
const IDB_STORE = "snapshots";
const IDB_KEY = "latest";

declare global {
  interface Window {
    __KD_EMBEDDED_STATE__?: unknown;
  }
}

export function createDefaultStateV3(): PusulaStateV3 {
  const tpl = PROGRAM_TEMPLATES.find((t) => t.id === "ilkokul-4") || PROGRAM_TEMPLATES[0];
  return {
    version: 3,
    kademe: tpl.kademe,
    mode: tpl.mode,
    gradeLabel: tpl.title,
    slotsPerDay: tpl.slotsPerDay,
    maxWeek: 45,
    startMonday: MEB_2026_2027_CALENDAR.term1Start,
    weekHolidays: MEB_2026_2027_CALENDAR.weekHolidays.map((h) => ({ ...h })),
    dayHolidays: {},
    timetable: tpl.timetable.map((row) => row.map((c) => (c ? { ...c } : null))),
    outcomes: {},
    outcomeUpdatedAt: {},
    teacherNotes: {},
    updatedAt: Date.now()
  };
}

export function loadStateV3(): { state: PusulaStateV3; migratedFromLegacy: boolean } {
  try {
    const v3Raw = localStorage.getItem(V3_STORAGE_KEY);
    if (v3Raw) {
      const parsed = migrateV2ToV3(JSON.parse(v3Raw));
      if (parsed) return { state: parsed, migratedFromLegacy: false };
    }

    const legacyRaw =
      localStorage.getItem(V2_STORAGE_KEY) || localStorage.getItem(V1_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateV2ToV3(JSON.parse(legacyRaw));
      if (migrated) return { state: migrated, migratedFromLegacy: true };
    }

    if (typeof window !== "undefined" && window.__KD_EMBEDDED_STATE__) {
      const embedded = migrateV2ToV3(window.__KD_EMBEDDED_STATE__);
      if (embedded) return { state: embedded, migratedFromLegacy: false };
    }
  } catch {
    // Bozuk veri durumunda varsayılanla devam et
  }
  return { state: createDefaultStateV3(), migratedFromLegacy: false };
}

export function saveLocalV3(state: PusulaStateV3): boolean {
  try {
    localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export async function saveShadowDbV3(state: PusulaStateV3): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ state, savedAt: Date.now() }, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export function exportEmbeddedHtmlV3(state?: PusulaStateV3): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-kd-runtime]").forEach((el) => el.remove());
  const root = clone.querySelector("#root");
  if (root) root.innerHTML = "";

  const prev = clone.querySelector("#kd-embedded-state");
  if (prev) prev.remove();

  if (state) {
    const body = clone.querySelector("body");
    if (body) {
      const script = document.createElement("script");
      script.id = "kd-embedded-state";
      const safeJson = JSON.stringify(state).replace(/<\/script/gi, "<\\/script");
      script.textContent = `window.__KD_EMBEDDED_STATE__ = ${safeJson};`;
      body.insertBefore(script, body.firstChild);
    }
  }
  return "<!doctype html>\n" + clone.outerHTML;
}