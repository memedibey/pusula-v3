# Kazanım Defteri · Pusula
YZSS: 1.2 | Sürüm: v010 | Durum: TASLAK | Taban: v009 | Tarih: 2026-11-18 | Kaynak: Gemini | Onay: yok
Kayıtlar: KESİN=0 | DOĞRULANDI=12 | VARSAYIM=6 | DENENECEK=3 | İPTAL=0 | AÇIK=4 | TAMAM=8 | ARŞİV=0

## 0. Kısa kapsül
Amaç: İlkokul (1–4), Ortaokul (5–8) ve Ortaöğretim/Lise (9–12) öğretmenleri için tek dosyalık çevrimdışı haftalık ders kazanımı takip, çoklu şube plan dağıtım ve çıktı alma uygulaması (v2.0 İlkokul Final + Pusula v3.0). · Aşama: `Pusula v3.0` 1–4. Vites tamamlandı (`13/13` test, `403.11 kB`) + Android PWA & GitHub Pages yayın paketi eklendi (`K-021`) · Son yapılan: `public/` (ikonlar, `manifest.webmanifest`, `sw.js`) ve `.github/workflows/deploy.yml` eklenip `DURUM.md` (v010) ve `DEVIR_PAKETI.txt` güncellendi · Sıradaki ilk iş: GitHub repo ayarından `Pages → Source: GitHub Actions` seçip Android Chrome'da `https://memedibey.github.io/pusula-v3/` adresini ana ekrana kurmak (`AÇ-004`) · Kritik kararlar: K-001..K-021 · Dikkat: PowerShell'de `npm` yerine `npm.cmd` kullanılmaktadır.

## 1. Proje Özeti
- **Kararlı İlkokul Sürümü (`v2.0 Final`):** `kazanim-defteri-pusula-v2.0-final.html` (1–4. sınıf, tek dosya).
- **Yeni Evrensel Sürüm (`Pusula v3.0`):** `C:\Users\meemc\pusula-v3` (1–12. sınıf, Vite SingleFile `dist/index.html` + GitHub Pages Android PWA `https://memedibey.github.io/pusula-v3/`).

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
K-021 | [DENENECEK] | (KAYNAK: Android PWA + GitHub Pages kurulum betiği) | `public/` (`icon-192.png`, `icon-512.png`, `manifest.webmanifest`, `sw.js`), `index.html` koşullu Service Worker kaydı ve `.github/workflows/deploy.yml` ile `https://memedibey.github.io/pusula-v3/` üzerinden çevrimdışı Android PWA yayını eklendi.

## 3. Vazgeçilen Fikirler
- v2.0 minified HTML bloğuna doğrudan yama yapmak, 4 sekmeli kalabalık ilk prototip arayüzü, tek gün tatil kutusu, kartta tarih/saat satırı ve sabit kademesiz ders listesi terk edildi.

## 4. Mevcut Durum ve Aşama
- Aşama: Pusula v3.0 1–4. Vites tamamlandı (`13/13` test, `403.11 kB`); Android PWA ve GitHub Actions Pages iş akışı eklendi.
- Hazır olan: `C:\Users\meemc\pusula-v3\dist\index.html`, `public/*`, `.github/workflows/deploy.yml`, `DEVIR_PAKETI.txt` ve GitHub `memedibey/pusula-v3`.
- Takıldığı nokta: Yok (`K-021` GitHub Pages ayarı + Android telefonda canlı kurulum testi bekliyor).

## 5. Açık İşler
- [ ] AÇ-001: Bu `DURUM.md` (v010) taslağının kullanıcı tarafından incelenip onaylanması.
- [ ] AÇ-002: `kazanim-defteri-pusula-v2.0-final.html` dosyasının Gizli Sekmede test edilip doğrulanması (isteğe bağlı arşiv doğrulaması).
- [ ] AÇ-003: `dist\index.html` canlı tarayıcı testi.
- [ ] AÇ-004: GitHub'da `memedibey/pusula-v3 → Settings → Pages → Source: GitHub Actions` seçilip `https://memedibey.github.io/pusula-v3/` adresinin Android Chrome'dan ana ekrana kurulması ve çevrimdışı test edilmesi.

## 6. Tamamlanan İşler
- [x] TAM-001..TAM-008: Kurulum, MEB takvimi, HarmonyOS arayüzü, Faz 5, 4 tatil haftası, kazanım temizliği, kademe ders havuzu ve 1–4. Vites Ferrari paketi.

## 7. Çalışma Kuralları
Dil Türkçe. v2.0 final dosyasının minified `<script type="module">` bloğunu değiştirme. Tüm yeni geliştirmeleri `C:\Users\meemc\pusula-v3` içinde temiz TypeScript modülleri olarak yap; her değişiklikten sonra `npm.cmd test` ve `npm.cmd run build` ile doğrula. PowerShell'de ExecutionPolicy nedeniyle `npm` yerine `npm.cmd` kullan.

## 8. Değişiklik Notu
- v009: 1–4. Vites Ferrari paketi (`13/13` test, `403.11 kB`) ve `memedibey/pusula-v3` ilk `git push` (`edb7e8f`).
- v010: Android çevrimdışı PWA (`manifest.webmanifest`, `sw.js`, 192/512 ikonlar) ve GitHub Actions otomatik GitHub Pages yayını (`K-021`).

=== DURUM SONU v010 ===