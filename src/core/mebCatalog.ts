import { Kademe, TeacherMode, TimetableCell } from "./schema";

export interface ProgramTemplate {
  id: string;
  kademe: Kademe;
  mode: TeacherMode;
  slotsPerDay: number;
  title: string;
  summary: string;
  timetable: (TimetableCell | null)[][];
}

export const SUBJECT_CATALOG_BY_KADEME: Record<Kademe, string[]> = {
  ilkokul: [
    "Türkçe",
    "Matematik",
    "Hayat Bilgisi",
    "Fen Bilimleri",
    "Sosyal Bilgiler",
    "İngilizce",
    "Din Kültürü ve Ahlak Bilgisi",
    "İnsan Hakları, Yurttaşlık ve Demokrasi",
    "Trafik Güvenliği",
    "Oyun ve Fiziki Etkinlikler",
    "Görsel Sanatlar",
    "Müzik",
    "Serbest Etkinlikler"
  ],
  ortaokul: [
    "Türkçe",
    "Matematik",
    "Fen Bilimleri",
    "Sosyal Bilgiler",
    "T.C. İnkılap Tarihi ve Atatürkçülük",
    "İngilizce",
    "Din Kültürü ve Ahlak Bilgisi",
    "Bilişim Teknolojileri ve Yazılım",
    "Teknoloji ve Tasarım",
    "Görsel Sanatlar",
    "Müzik",
    "Beden Eğitimi ve Spor",
    "Peygamberimizin Hayatı",
    "Kur'an-ı Kerim",
    "Rehberlik ve Kariyer Planlama",
    "Seçmeli Ders"
  ],
  lise: [
    "Türk Dili ve Edebiyatı",
    "Matematik",
    "Fizik",
    "Kimya",
    "Biyoloji",
    "Tarih",
    "T.C. İnkılap Tarihi ve Atatürkçülük",
    "Coğrafya",
    "Felsefe",
    "İngilizce",
    "Almanca",
    "Din Kültürü ve Ahlak Bilgisi",
    "Beden Eğitimi ve Spor",
    "Görsel Sanatlar / Müzik",
    "Bilişim Teknolojileri",
    "Sağlık Bilgisi ve Trafik Kültürü",
    "Rehberlik ve Yönlendirme",
    "Seçmeli Ders"
  ]
};

export function getKademeSubjects(
  kademe: Kademe,
  customCatalog?: Partial<Record<Kademe, string[]>>
): string[] {
  const custom = customCatalog?.[kademe];
  if (Array.isArray(custom)) return custom;
  return SUBJECT_CATALOG_BY_KADEME[kademe] || SUBJECT_CATALOG_BY_KADEME.ilkokul;
}

const c = (subject: string, section?: string): TimetableCell =>
  section ? { subject, section } : { subject };

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: "ilkokul-1",
    kademe: "ilkokul",
    mode: "sinif",
    slotsPerDay: 6,
    title: "İlkokul 1. Sınıf (30 Saat)",
    summary: "Türkçe 10 · Mat 5 · Hayat Bilgisi 4 · Oyun 5 · Görsel 1 · Müzik 1 · Serbest 4",
    timetable: [
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Görsel Sanatlar"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Müzik"), c("Serbest Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Oyun ve Fiziki Etkinlikler"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")]
    ]
  },
  {
    id: "ilkokul-2",
    kademe: "ilkokul",
    mode: "sinif",
    slotsPerDay: 6,
    title: "İlkokul 2. Sınıf (30 Saat)",
    summary: "Türkçe 10 · Mat 5 · Hayat Bilgisi 4 · İngilizce 2 · Oyun 5 · Görsel 1 · Müzik 1 · Serbest 2",
    timetable: [
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("İngilizce"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Görsel Sanatlar"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("İngilizce"), c("Müzik")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Oyun ve Fiziki Etkinlikler"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")]
    ]
  },
  {
    id: "ilkokul-3",
    kademe: "ilkokul",
    mode: "sinif",
    slotsPerDay: 6,
    title: "İlkokul 3. Sınıf (30 Saat)",
    summary: "Türkçe 8 · Mat 5 · Hayat Bilgisi 3 · Fen 3 · İngilizce 2 · Oyun 5 · Görsel 1 · Müzik 1 · Serbest 2",
    timetable: [
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("İngilizce"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Matematik"), c("Fen Bilimleri"), c("Hayat Bilgisi"), c("Görsel Sanatlar"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Fen Bilimleri"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")],
      [c("Türkçe"), c("Matematik"), c("Hayat Bilgisi"), c("İngilizce"), c("Müzik"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Fen Bilimleri"), c("Oyun ve Fiziki Etkinlikler"), c("Serbest Etkinlikler")]
    ]
  },
  {
    id: "ilkokul-4",
    kademe: "ilkokul",
    mode: "sinif",
    slotsPerDay: 6,
    title: "İlkokul 4. Sınıf (30 Saat)",
    summary: "Türkçe 8 · Mat 5 · Fen 3 · Sosyal 3 · İng 2 · Din 2 · İHD 2 · Oyun 2 · Müzik 1 · Görsel 1 · Trafik 1",
    timetable: [
      [c("Fen Bilimleri"), c("Türkçe"), c("İngilizce"), c("İngilizce"), c("Matematik"), c("Müzik")],
      [c("Sosyal Bilgiler"), c("Türkçe"), c("Türkçe"), c("Matematik"), c("İnsan Hakları, Yurttaşlık ve Demokrasi"), c("Görsel Sanatlar")],
      [c("Sosyal Bilgiler"), c("Fen Bilimleri"), c("Türkçe"), c("Matematik"), c("Türkçe"), c("Oyun ve Fiziki Etkinlikler")],
      [c("Fen Bilimleri"), c("Türkçe"), c("Din Kültürü ve Ahlak Bilgisi"), c("Din Kültürü ve Ahlak Bilgisi"), c("Matematik"), c("İnsan Hakları, Yurttaşlık ve Demokrasi")],
      [c("Sosyal Bilgiler"), c("Türkçe"), c("Türkçe"), c("Matematik"), c("Trafik Güvenliği"), c("Oyun ve Fiziki Etkinlikler")]
    ]
  },
  {
    id: "ortaokul-brans-ornek",
    kademe: "ortaokul",
    mode: "brans",
    slotsPerDay: 7,
    title: "Ortaokul Branş (7 Saat/Gün · 5–8. Sınıf)",
    summary: "5–8. sınıflarda farklı şubelere giren branş öğretmenleri için başlangıç programı",
    timetable: [
      [c("Matematik", "5/A"), c("Matematik", "5/A"), null, c("Matematik", "6/B"), c("Matematik", "6/B"), c("Matematik", "7/A"), null],
      [c("Matematik", "7/A"), c("Matematik", "7/A"), c("Matematik", "8/A"), c("Matematik", "8/A"), null, c("Matematik", "5/B"), c("Matematik", "5/B")],
      [c("Matematik", "6/B"), c("Matematik", "6/B"), c("Matematik", "5/A"), c("Matematik", "5/A"), null, c("Matematik", "8/A"), null],
      [c("Matematik", "5/B"), c("Matematik", "5/B"), c("Matematik", "7/A"), c("Matematik", "7/A"), c("Matematik", "6/B"), null, null],
      [c("Matematik", "8/A"), c("Matematik", "8/A"), c("Matematik", "5/A"), c("Matematik", "5/B"), null, null, null]
    ]
  },
  {
    id: "ortaokul-sinif-5",
    kademe: "ortaokul",
    mode: "sinif",
    slotsPerDay: 7,
    title: "Ortaokul 5–6. Sınıf Örnek Program (35 Saat)",
    summary: "Türkçe · Matematik · Fen · Sosyal · İngilizce · Din Kültürü · Bilişim · Görsel · Müzik · Beden",
    timetable: [
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Matematik"), c("Sosyal Bilgiler"), c("Beden Eğitimi ve Spor"), c("Beden Eğitimi ve Spor")],
      [c("Fen Bilimleri"), c("Fen Bilimleri"), c("Türkçe"), c("İngilizce"), c("İngilizce"), c("Bilişim Teknolojileri ve Yazılım"), c("Bilişim Teknolojileri ve Yazılım")],
      [c("Matematik"), c("Matematik"), c("Sosyal Bilgiler"), c("Sosyal Bilgiler"), c("Din Kültürü ve Ahlak Bilgisi"), c("Din Kültürü ve Ahlak Bilgisi"), c("Görsel Sanatlar")],
      [c("Türkçe"), c("Türkçe"), c("Fen Bilimleri"), c("Fen Bilimleri"), c("İngilizce"), c("Müzik"), c("Rehberlik ve Kariyer Planlama")],
      [c("Türkçe"), c("Türkçe"), c("Matematik"), c("Seçmeli Ders"), c("Seçmeli Ders"), c("Seçmeli Ders"), c("Seçmeli Ders")]
    ]
  },
  {
    id: "lise-brans-ornek",
    kademe: "lise",
    mode: "brans",
    slotsPerDay: 8,
    title: "Lise Branş (8 Saat/Gün · 9–12. Sınıf)",
    summary: "Anadolu / Fen / Meslek lisesinde birden çok sınıf düzeyine giren öğretmenler için şablon",
    timetable: [
      [c("Türk Dili ve Edebiyatı", "9/A"), c("Türk Dili ve Edebiyatı", "9/A"), c("Türk Dili ve Edebiyatı", "10/B"), c("Türk Dili ve Edebiyatı", "10/B"), null, c("Türk Dili ve Edebiyatı", "11/A"), c("Türk Dili ve Edebiyatı", "11/A"), null],
      [c("Türk Dili ve Edebiyatı", "12/A"), c("Türk Dili ve Edebiyatı", "12/A"), null, c("Türk Dili ve Edebiyatı", "9/B"), c("Türk Dili ve Edebiyatı", "9/B"), c("Türk Dili ve Edebiyatı", "10/B"), c("Türk Dili ve Edebiyatı", "10/B"), null],
      [c("Türk Dili ve Edebiyatı", "9/A"), c("Türk Dili ve Edebiyatı", "9/A"), c("Türk Dili ve Edebiyatı", "11/A"), c("Türk Dili ve Edebiyatı", "11/A"), c("Türk Dili ve Edebiyatı", "12/A"), c("Türk Dili ve Edebiyatı", "12/A"), null, null],
      [c("Türk Dili ve Edebiyatı", "9/B"), c("Türk Dili ve Edebiyatı", "9/B"), c("Türk Dili ve Edebiyatı", "9/A"), null, c("Türk Dili ve Edebiyatı", "10/B"), c("Türk Dili ve Edebiyatı", "11/A"), null, null],
      [c("Türk Dili ve Edebiyatı", "12/A"), null, c("Türk Dili ve Edebiyatı", "9/B"), c("Türk Dili ve Edebiyatı", "9/B"), null, null, null, null]
    ]
  },
  {
    id: "lise-sayisal-9",
    kademe: "lise",
    mode: "sinif",
    slotsPerDay: 8,
    title: "Lise 9–10. Sınıf Örnek Program (40 Saat)",
    summary: "Türk Dili ve Edebiyatı · Matematik · Fizik · Kimya · Biyoloji · Tarih · Coğrafya · İngilizce · Din",
    timetable: [
      [c("Türk Dili ve Edebiyatı"), c("Türk Dili ve Edebiyatı"), c("Matematik"), c("Matematik"), c("Fizik"), c("Fizik"), c("İngilizce"), c("İngilizce")],
      [c("Kimya"), c("Kimya"), c("Matematik"), c("Matematik"), c("Tarih"), c("Tarih"), c("Beden Eğitimi ve Spor"), c("Beden Eğitimi ve Spor")],
      [c("Türk Dili ve Edebiyatı"), c("Türk Dili ve Edebiyatı"), c("Biyoloji"), c("Biyoloji"), c("Coğrafya"), c("Coğrafya"), c("Almanca"), c("Almanca")],
      [c("Matematik"), c("Matematik"), c("Türk Dili ve Edebiyatı"), c("Din Kültürü ve Ahlak Bilgisi"), c("Din Kültürü ve Ahlak Bilgisi"), c("İngilizce"), c("İngilizce"), c("Görsel Sanatlar / Müzik")],
      [c("Bilişim Teknolojileri"), c("Bilişim Teknolojileri"), c("Sağlık Bilgisi ve Trafik Kültürü"), c("Rehberlik ve Yönlendirme"), c("Seçmeli Ders"), c("Seçmeli Ders"), c("Seçmeli Ders"), c("Seçmeli Ders")]
    ]
  }
];

export const UNIVERSAL_CODE_REGEX =
  /^((?:(?:[A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞIİÖŞÜ]{0,4}\.){1,3}\d+(?:\.[A-Za-z0-9ÇĞIİÖŞÜçğıöşü]+)+\.?|[A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞIİÖŞÜ]{0,4}\d+(?:\.[A-Za-z0-9ÇĞIİÖŞÜçğıöşü]+)+\.?|[1-9]\d?(?:\.\d{1,2}){2,}\.?))(?:\s+|$)/;