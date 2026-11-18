import { UNIVERSAL_CODE_REGEX } from "./mebCatalog";

export interface SubjectPalette {
  accent: string;
  accentDark: string;
  headerBg: string;
  badgeBg: string;
  border: string;
  hexAccent: string;
  hexHeaderBg: string;
}

const PALETTES: Array<{ keys: string[]; p: SubjectPalette }> = [
  { keys: ["türkçe", "türk dili", "edebiyat"], p: { accent: "#1D4ED8", accentDark: "#1E3A8A", headerBg: "#EFF6FF", badgeBg: "#DBEAFE", border: "#BFDBFE", hexAccent: "1D4ED8", hexHeaderBg: "EFF6FF" } },
  { keys: ["matematik", "geometri"], p: { accent: "#BE123C", accentDark: "#881337", headerBg: "#FFF1F2", badgeBg: "#FFE4E6", border: "#FECDD3", hexAccent: "BE123C", hexHeaderBg: "FFF1F2" } },
  { keys: ["fen ", "biyoloji", "hayat bilgisi"], p: { accent: "#047857", accentDark: "#064E3B", headerBg: "#ECFDF5", badgeBg: "#D1FAE5", border: "#A7F3D0", hexAccent: "047857", hexHeaderBg: "ECFDF5" } },
  { keys: ["fizik", "bilişim", "teknoloji"], p: { accent: "#0284C7", accentDark: "#0C4A6E", headerBg: "#F0F9FF", badgeBg: "#E0F2FE", border: "#BAE6FD", hexAccent: "0284C7", hexHeaderBg: "F0F9FF" } },
  { keys: ["kimya"], p: { accent: "#7C3AED", accentDark: "#4C1D95", headerBg: "#F5F3FF", badgeBg: "#EDE9FE", border: "#DDD6FE", hexAccent: "7C3AED", hexHeaderBg: "F5F3FF" } },
  { keys: ["sosyal", "tarih", "inkılap", "coğrafya"], p: { accent: "#B45309", accentDark: "#78350F", headerBg: "#FFFBEB", badgeBg: "#FEF3C7", border: "#FDE68A", hexAccent: "B45309", hexHeaderBg: "FFFBEB" } },
  { keys: ["felsefe", "insan hakları", "vatandaşlık", "psikoloji", "sosyoloji"], p: { accent: "#6D28D9", accentDark: "#4C1D95", headerBg: "#F5F3FF", badgeBg: "#EDE9FE", border: "#DDD6FE", hexAccent: "6D28D9", hexHeaderBg: "F5F3FF" } },
  { keys: ["ingilizce", "almanca", "fransızca", "arapça", "yabancı dil"], p: { accent: "#3730A3", accentDark: "#312E81", headerBg: "#EEF2FF", badgeBg: "#E0E7FF", border: "#C7D2FE", hexAccent: "3730A3", hexHeaderBg: "EEF2FF" } },
  { keys: ["din kültürü", "kur'an", "siyer", "peygamber"], p: { accent: "#15803D", accentDark: "#14532D", headerBg: "#F0FDF4", badgeBg: "#DCFCE7", border: "#BBF7D0", hexAccent: "15803D", hexHeaderBg: "F0FDF4" } },
  { keys: ["oyun", "beden"], p: { accent: "#0369A1", accentDark: "#0C4A6E", headerBg: "#F0F9FF", badgeBg: "#E0F2FE", border: "#BAE6FD", hexAccent: "0369A1", hexHeaderBg: "F0F9FF" } },
  { keys: ["müzik"], p: { accent: "#A21CAF", accentDark: "#701A75", headerBg: "#FDF4FF", badgeBg: "#FAE8FF", border: "#F5D0FE", hexAccent: "A21CAF", hexHeaderBg: "FDF4FF" } },
  { keys: ["görsel", "resim"], p: { accent: "#C2410C", accentDark: "#7C2D12", headerBg: "#FFF7ED", badgeBg: "#FFEDD5", border: "#FED7AA", hexAccent: "C2410C", hexHeaderBg: "FFF7ED" } },
  { keys: ["trafik"], p: { accent: "#0F766E", accentDark: "#134E4A", headerBg: "#F0FDFA", badgeBg: "#CCFBF1", border: "#99F6E4", hexAccent: "0F766E", hexHeaderBg: "F0FDFA" } }
];

export function getSubjectPalette(subjectName: string): SubjectPalette {
  const norm = subjectName.replace(/i\u0307/g, "i").toLocaleLowerCase("tr-TR").trim();
  for (const entry of PALETTES) {
    if (entry.keys.some((k) => norm.includes(k))) return entry.p;
  }
  return PALETTES[0].p;
}

export function splitOutcomeCode(line: string): { code: string | null; rest: string } {
  const trimmed = line.trim();
  const match = UNIVERSAL_CODE_REGEX.exec(trimmed);
  if (!match) return { code: null, rest: trimmed };
  return { code: match[1], rest: trimmed.slice(match[0].length).trim() };
}