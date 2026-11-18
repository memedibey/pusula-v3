# Kazanım Defteri · Pusula
YZSS: 1.2 | Sürüm: v009 | Durum: TASLAK | Taban: v008 | Tarih: 2026-11-18 | Kaynak: Gemini | Onay: yok
Kayıtlar: KESİN=0 | DOĞRULANDI=12 | VARSAYIM=6 | DENENECEK=2 | İPTAL=0 | AÇIK=3 | TAMAM=8 | ARŞİV=0

## 0. Kısa kapsül
Amaç: İlkokul (1–4), Ortaokul (5–8) ve Ortaöğretim/Lise (9–12) öğretmenleri için tek dosyalık çevrimdışı haftalık ders kazanımı takip, çoklu şube plan dağıtım ve çıktı alma uygulaması (v2.0 İlkokul Final + Pusula v3.0). · Aşama: `Pusula v3.0` 1–4. Vites tamamlandı (`13/13` Vitest testi geçti, `dist/index.html` `403.11 kB` derlendi) · Son yapılan: `DURUM.md` (v009) ve `DEVIR_PAKETI.txt` üretildi · Sıradaki ilk iş: `dist\index.html` canlı tarayıcı testi (`AÇ-003`) ve istenirse `memedibey/pusula-v3` GitHub deposuna `git push` · Kritik kararlar: K-001..K-020 · Dikkat: PowerShell'de ExecutionPolicy nedeniyle `npm` yerine `npm.cmd` kullanılmaktadır.

## 1. Proje Özeti
- **Kararlı İlkokul Sürümü (`v2.0 Final`):** `kazanim-defteri-pusula-v2.0-final.html` (tek dosya, 1–4. sınıf, minified React 19.3.1 + Tailwind v4.3.5 + `kd-pusula-v2` eklenti katmanı).
- **Yeni Evrensel Sürüm (`Pusula v3.0`):** `C:\Users\meemc\pusula-v3` altında TypeScript + React 19 + Tailwind CSS v4 + `vite-plugin-singlefile` projesi; derlendiğinde 1–12. sınıf uyumlu tek dosyalık çevrimdışı `dist/index.html` (`403.11 kB`) üretir.

## 2. Kararlar
K-001 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 tek dosyalık çevrimdışı HTML mimarisindedir.
K-002 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 veri kalıcılığı `localStorage` ve IndexedDB gölge yedek ile; eşitleme `KD4:`/`KD4Z:` ile yapılır.
K-003 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0'da MEB 2026–2027 çalışma takvimi yerleşik desteklenir.
K-004 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 `.xlsx`, `.docx`, `.csv`, `.txt`, `.pdf` içe aktarma ve PNG/PDF/Word/Excel/CSV/HTML çıktısı üretir.
K-005 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 `kd-pusula-v2` katmanı 1–4. sınıf şablonları ve otomatik yedekli yıl sonu sıfırlaması ekler.
K-006 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 çekirdek `<script type="module">` bloğu değiştirilmez; yeni 1–12. sınıf mimarisi `pusula-v3` projesinde geliştirilir.
K-007 | [DENENECEK] | (KAYNAK: PowerShell çıktısı + kazanim-defteri-pusula-v2.0-final.html) | v2.0 `#kd-pusula-v2` `readState()` gömülü yedek okuma güncellemesi.
K-008 | [DOĞRULANDI] | (KAYNAK: PowerShell çıktısı) | `C:\Users\meemc\pusula-v3` altında `Pusula v3.0` kuruldu (1–12. sınıf, Sınıf/Branş kipleri, `v2 -> v3` göç, çoklu şube dağıtımı, mobil/tablet katmanı).
K-009 | [DOĞRULANDI] | (KAYNAK: Kullanıcı kuralı + build çıktısı) | Varsayılan MEB 2026–2027 takviminde yalnızca 4 ana tatil haftası bulunur (`dayHolidays: {}`).
K-010 | [DENENECEK] | (KAYNAK: PowerShell build çıktısı) | `dist\index.html` canlı tarayıcı, F12 mobil/tablet ve Verili HTML Gizli Sekme testi.
K-011 | [DOĞRULANDI] | (KAYNAK: PowerShell test + build çıktısı) | Faz 5 çıktı & aktarım paketi (PNG/PDF/Word/Excel, `KD5Z:`/`KD4Z:`, `subjectPriority`, `A−`/`A+`) eklendi.
K-012 | [DOĞRULANDI] | (KAYNAK: PowerShell build çıktısı) | HarmonyOS + macOS + iOS tek-sayfa akıcı arayüz (`SubjectFlowView`, `FloatingMissingDock`, `SearchModal`) eklendi.
K-013 | [DOĞRULANDI] | (KAYNAK: sohbet_ozet.txt + build çıktısı) | Tek gün tatil kutusu kaldırıldı; v2.0 ile birebir 4 tatil haftası + adım adım geçiş bağlandı.
K-014 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | Kazanım hanesinden tarih/gün/saat kaldırıldı, `sanitizeOutcomeText` ve çok sütunlu CSV ayrıştırıcı eklendi.
K-015 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | Tarih öncelikli plan okuyucu, `1-2. Hafta` / `14-25 Eylül` aralık desteği, `rebalanceWeeklyPlan` ve sakin `FloatingMissingDock` eklendi.
K-016 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | İlkokul/Ortaokul/Lise kademe bazlı dinamik ders havuzu (ekle/çıkar + hızlı yerleştirme + şablon filtresi + `datalist`) eklendi.
K-017 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | 1. Vites: `YearRadarModal` kuşbakışı yıllık harita (ders filtreli), kartlarda `✓ İşlendi` (`doneMarks`) ve tek tıkla saf `Kopyala` eklendi.
K-018 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | Eğitim yılı haftası `34–40` arası dinamik (`teachingWeeks`, `getTeachingWeeks`) hâle getirildi.
K-019 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | Akıllı haftasız metin ayıklama + tek dosyadan çoklu ders dağıtma (`docxXlsxParser.ts`, `BulkBranchImporter.tsx`) + 2. Vites şubeler arası hafta aktarma & zümre fark rozeti (`behindBestSlots`) eklendi.
K-020 | [DOĞRULANDI] | (KAYNAK: 13/13 test + 403.11 kB build) | 3. Vites resmî okul/öğretmen başlığı (`schoolName`, `teacherName`, `exportTimetableCardPng` 1920×1080 HD PNG) ve 4. Vites gömülü SVG ikon, `[`/`]`/`Esc` klavye kısayolları ile haritada `İlk eksiğe git` eklendi (`403.11 kB`).

## 3. Vazgeçilen Fikirler
- v2.0 minified HTML bloğuna doğrudan yama yapmak, 4 sekmeli kalabalık ilk prototip arayüzü, tek gün tatil kutusu, kartta tarih/saat satırı ve sabit kademesiz ders listesi terk edildi.

## 4. Mevcut Durum ve Aşama
- Aşama: Pusula v3.0 1–4. Vites tamamlandı; `npm.cmd test` (`13/13`) ve `npm.cmd run build` (`dist/index.html`, `403.11 kB`) 0 hatayla geçti.
- Hazır olan: `C:\Users\meemc\pusula-v3\dist\index.html`, tüm `src/` modülleri ve `DEVIR_PAKETI.txt`.
- Takıldığı nokta: Yok.

## 5. Açık İşler
- [ ] AÇ-001: Bu `DURUM.md` (v009) taslağının kullanıcı tarafından incelenip onaylanması.
- [ ] AÇ-002: `kazanim-defteri-pusula-v2.0-final.html` dosyasının Gizli Sekmede test edilip doğrulanması (isteğe bağlı arşiv doğrulaması).
- [ ] AÇ-003: `dist\index.html` (`403.11 kB`) canlı tarayıcı testi ve istenirse `git push` ile `memedibey/pusula-v3` GitHub deposunun güncellenmesi.

## 6. Tamamlanan İşler
- [x] TAM-001..TAM-005: Kurulum, MEB 2026–2027 takvimi, HarmonyOS/macOS arayüzü, Faz 5 çıktı/aktarım ve 4 tatil haftası entegrasyonu.
- [x] TAM-006: Kazanım temizliği, dengeli dağıtım ve kademe bazlı ekle/çıkar ders havuzu (`K-014..K-016`).
- [x] TAM-007: 1. & 2. Vites — Yıllık Radar, `✓ İşlendi`, dinamik `34–40` hafta, akıllı çoklu-ders ayıklama ve şubeler arası aktarım (`K-017..K-019`).
- [x] TAM-008: 3. & 4. Vites — Okul/Öğretmen resmî başlığı, Renkli Haftalık Ders Programı HD PNG, gömülü SVG simge ve klavye kısayolları (`K-020`).

## 7. Çalışma Kuralları
Dil Türkçe. v2.0 final dosyasının minified `<script type="module">` bloğunu değiştirme. Tüm yeni geliştirmeleri `C:\Users\meemc\pusula-v3` içinde temiz TypeScript modülleri olarak yap; her değişiklikten sonra `npm.cmd test` ve `npm.cmd run build` ile doğrula. PowerShell'de ExecutionPolicy nedeniyle `npm` yerine `npm.cmd` kullan.

## 8. Değişiklik Notu
- v001–v008: Kurulum, MEB takvimi, HarmonyOS arayüzü, Faz 5, 4 tatil haftası, kazanım temizliği, 37 hafta dağıtım ve kademe ders havuzu.
- v009: 1–4. Vites Ferrari paketi (`YearRadarModal`, `doneMarks`, dinamik `34–40` hafta, akıllı çoklu-ders ayıklama, şubeler arası aktarım, resmî başlıklar + Ders Programı HD PNG, SVG favicon ve `[`/`]`/`Esc` kısayolları) — `13/13` test & `403.11 kB` derleme doğrulandı.

=== DURUM SONU v009 ===