import { PusulaStateV3, migrateV2ToV3 } from "./schema";

function toUrlBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromUrlBase64(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodeSyncCode(state: PusulaStateV3): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const plain = "KD5:" + toUrlBase64(bytes);

  if (typeof CompressionStream !== "undefined") {
    try {
      const cs = new CompressionStream("deflate-raw");
      const w = cs.writable.getWriter();
      await w.write(new Uint8Array(bytes));
      await w.close();
      const comp = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      const zipped = "KD5Z:" + toUrlBase64(comp);
      if (zipped.length < plain.length) return zipped;
    } catch {
      // Duz kodla devam et
    }
  }
  return plain;
}

export async function decodeSyncCode(raw: string): Promise<PusulaStateV3> {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Eşitleme kodu boş.");

  const match = trimmed.match(/(?:KD5Z|KD5|KD4Z|KD4):[A-Za-z0-9\-_]+/);
  let parsed: unknown;

  if (match) {
    const token = match[0];
    if (token.startsWith("KD5Z:") || token.startsWith("KD4Z:")) {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("Bu tarayıcı sıkıştırılmış eşitleme kodunu açmayı desteklemiyor.");
      }
      const b64 = token.slice(5);
      const comp = fromUrlBase64(b64);
      const ds = new DecompressionStream("deflate-raw");
      const w = ds.writable.getWriter();
      await w.write(new Uint8Array(comp));
      await w.close();
      const text = await new Response(ds.readable).text();
      parsed = JSON.parse(text);
    } else {
      const b64 = token.slice(4);
      const text = new TextDecoder("utf-8").decode(fromUrlBase64(b64));
      parsed = JSON.parse(text);
    }
  } else {
    parsed = JSON.parse(trimmed);
  }

  const state = migrateV2ToV3(parsed);
  if (!state) throw new Error("Geçersiz eşitleme kodu veya JSON verisi.");
  return state;
}

export interface SyncMergeAnalysis {
  addedCount: number;
  keptLocalCount: number;
  conflictCount: number;
}

export function analyzeSyncMerge(local: PusulaStateV3, incoming: PusulaStateV3): SyncMergeAnalysis {
  const allKeys = new Set([...Object.keys(local.outcomes), ...Object.keys(incoming.outcomes)]);
  let addedCount = 0;
  let keptLocalCount = 0;
  let conflictCount = 0;

  allKeys.forEach((k) => {
    const a = (local.outcomes[k] || "").trim();
    const b = (incoming.outcomes[k] || "").trim();
    if (!a && b) addedCount++;
    else if (a && !b) keptLocalCount++;
    else if (a && b && a !== b) conflictCount++;
  });

  return { addedCount, keptLocalCount, conflictCount };
}

export function applySyncMerge(
  local: PusulaStateV3,
  incoming: PusulaStateV3,
  strategy: "smart" | "incoming" | "local" | "replace"
): PusulaStateV3 {
  if (strategy === "replace") return { ...incoming, updatedAt: Date.now() };

  const outcomes: Record<string, string> = {};
  const outcomeUpdatedAt: Record<string, number> = {};
  const now = Date.now();
  const allKeys = new Set([...Object.keys(local.outcomes), ...Object.keys(incoming.outcomes)]);

  allKeys.forEach((k) => {
    const a = (local.outcomes[k] || "").trim();
    const b = (incoming.outcomes[k] || "").trim();
    const ta = local.outcomeUpdatedAt[k] || 0;
    const tb = incoming.outcomeUpdatedAt[k] || 0;

    if (a && !b) {
      outcomes[k] = local.outcomes[k];
      if (ta > 0) outcomeUpdatedAt[k] = ta;
    } else if (!a && b) {
      outcomes[k] = incoming.outcomes[k];
      outcomeUpdatedAt[k] = tb > 0 ? tb : now;
    } else if (a && b) {
      const pickIncoming = a !== b && (strategy === "incoming" || (strategy === "smart" && tb > ta));
      outcomes[k] = pickIncoming ? incoming.outcomes[k] : local.outcomes[k];
      outcomeUpdatedAt[k] = Math.max(ta, tb) || now;
    }
  });

  const useIncomingMeta = strategy === "incoming" || (strategy === "smart" && incoming.updatedAt > local.updatedAt);
  return {
    ...(useIncomingMeta ? incoming : local),
    outcomes,
    outcomeUpdatedAt,
    teacherNotes: { ...incoming.teacherNotes, ...local.teacherNotes },
    doneMarks: { ...(incoming.doneMarks || {}), ...(local.doneMarks || {}) },
    updatedAt: Math.max(now, local.updatedAt, incoming.updatedAt)
  };
}