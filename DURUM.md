# Kazanım Defteri · Pusula
YZSS: 1.2 | Sürüm: v009 | Durum: TASLAK | Taban: v008 | Tarih: 2026-11-18 | Kaynak: Claude | Onay: yok
Kayıtlar: KESİN=0 | DOĞRULANDI=8 | VARSAYIM=6 | DENENECEK=2 | İPTAL=0 | AÇIK=3 | TAMAM=5 | ARŞİV=0

## 0. Kısa kapsül
Amaç: İlkokul (1–4), Ortaokul (5–8) ve Ortaöğretim/Lise (9–12) öğretmenleri için tek dosyalık çevrimdışı haftalık ders kazanımı takip, çoklu şube plan dağıtım ve çıktı alma uygulaması (v2.0 İlkokul Final + Pusula v3.0). · Aşama: `Pusula v3.0` Faz 5 + v2.0 4 tatil haftası (`366.97 kB`) + kazanım hanesi/CSV temizliği (`K-014`) + dengeli 37 hafta dağıtımı (`K-015`) + kademeye özel ders havuzu (`K-016`) · Son yapılan: `SUBJECT_CATALOG_BY_KADEME` & `getKademeSubjects` (`mebCatalog.ts`), `subjectCatalog` kalıcılığı (`schema.ts`), `TimetableBuilder.tsx` ders ekle/çıkar + hızlı yerleştirme (`+`/`×`) + kademe şablon filtresi + `datalist` ve birim testi eklendi · Sıradaki ilk iş: `npm.cmd test && npm.cmd run build` çıktısının görülmesi ve `dist\index.html` canlı testi (`AÇ-003`) · Kritik kararlar: K-001..K-016 · Dikkat: PowerShell'de ExecutionPolicy nedeniyle `npm` yerine `npm.cmd` kullanılmaktadır.

## 1. Proje Özeti
- **Kararlı İlkokul Sürümü (`v2.0 Final`):** `kazanim-defteri-pusula-v2.0-final.html` (tek dosya, 1–4. sınıf, minified React 19.3.1 + Tailwind v4.3.5 + `kd-pusula-v2` eklenti katmanı).
- **Yeni Evrensel Sürüm (`Pusula v3.0`):** `C:\Users\meemc\pusula-v3` altında temiz TypeScript + React 19 + Tailwind CSS v4 + `vite-plugin-singlefile` projesi; derlendiğinde 1–12. sınıf uyumlu tek dosyalık çevrimdışı `dist/index.html` üretir.

## 2. Kararlar
K-001 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 tek dosyalık çevrimdışı HTML mimarisindedir; derlenmiş React 19.3.1 + Tailwind CSS v4.3.5 çekirdeği ve bağımsız katmanlardan (`ios-skin`, `kd-drawer`, `kd-dock`, `kd-cover`, `kd-dl`, `kd-pusula-v2`) oluşur.
K-002 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 veri kalıcılığı `localStorage` (`kazanim_defteri_v2`) ve IndexedDB gölge yedek (`kazanim_defteri_backup_db`) ile; eşitleme `KD4:` / `KD4Z:` ve JSON birleştirme ile yapılır.
K-003 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0'da MEB 2026–2027 çalışma takvimi yerleşik desteklenir.
K-004 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 `.xlsx`, `.docx`, `.csv`, `.txt` ve `.pdf` içe aktarma ile PNG, PDF, Word, Excel, CSV ve verili HTML çıktısı üretir.
K-005 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 `kd-pusula-v2` katmanı 1–4. sınıf şablonları, yeşil bildirimler ve otomatik yedekli yıl sonu sıfırlaması ekler.
K-006 | [VARSAYIM] | (KAYNAK: kazanim-defteri-pusula-v2.0-final.html) | v2.0 çekirdek `<script type="module">` bloğu minified olduğu için doğrudan değiştirilmez; yeni 1–12. sınıf mimarisi temiz `pusula-v3` projesinde geliştirilir.
K-007 | [DENENECEK] | (KAYNAK: PowerShell çıktısı + kazanim-defteri-pusula-v2.0-final.html) | v2.0 `#kd-pusula-v2` `readState()` fonksiyonu `localStorage` sonrasında `window.__KD_EMBEDDED_STATE__` yedeğini okuyacak şekilde güncellendi; `.yedek` korundu.
K-008 | [DOĞRULANDI] | (KAYNAK: PowerShell çıktısı) | `C:\Users\meemc\pusula-v3` altında Node.js `v26.13.1`, React 19, TypeScript `5.7.2`, Tailwind v4, Vite `6.4.6` + `vite-plugin-singlefile` ve Vitest `3.2.7` ile `Pusula v3.0` kuruldu; 1–12. sınıf (`slotsPerDay: 4..10`), Sınıf/Branş kipleri, `v2 -> v3` kayıpsız göç (`migrateV2ToV3`), `.docx`/`.xlsx`/metin çoklu şube dağıtımı (`distributePlanToSections`), konu öteleme (`shiftGroupOutcomes`) ve mobil/tablet katmanı eklendi.
K-009 | [DOĞRULANDI] | (KAYNAK: Kullanıcı kuralı + PowerShell build çıktısı) | `Pusula v3.0` varsayılan takviminde yalnızca MEB 2026–2027 genelgesindeki ana tatiller (1. Dönem Ara Tatili 16–20 Kas, Yarıyıl 25 Oca–5 Şub, 2. Dönem Ara Tatili 8–12 Mar; toplam 37 ders haftası, 1 Eyl mesleki çalışma, 7–11 Eyl uyum/rehberlik) bulunur; bayram/kar/resmî tatiller (`dayHolidays`) varsayılan boş (`{}`) tutulur.
K-010 | [DENENECEK] | (KAYNAK: PowerShell build çıktısı) | `dist\index.html` dosyasının tarayıcı, mobil/tablet görünümü (F12) ve çıktı/aktarım akışlarında canlı test edilip doğrulanması.
K-011 | [DOĞRULANDI] | (KAYNAK: PowerShell test + build çıktısı) | Faz 5 tamamlandı: `subjectPriority` ders sıralaması (İngilizce ve Din Kültürü en sonda), `richExports.ts` (1920px HD PNG, vektör PDF, renkli sütunlu Word `.docx`, çift sayfalı Excel `.xlsx`), `syncEngine.ts` (`KD5Z:`/`KD4Z:` eşitleme), `docxXlsxParser.ts` (otomatik ders tanıma + `.pdf`), 3 sekmeli sürükle-bırak `BulkBranchImporter`, `A−`/`A+` yazı boyutu ve tatil/uyum haftası kartları eklendi; 6/6 Vitest testi geçti, 47 modül `dist/index.html` (365.29 kB) olarak derlendi.
K-012 | [DOĞRULANDI] | (KAYNAK: PowerShell build çıktısı) | `Pusula v3.0` arayüzü v2.0'daki HarmonyOS + macOS + iOS akışına uyarlandı: tek-sayfa akış, yapışkan yatay ders sekmeleri, dikey omurgalı ders kartları (`SubjectFlowView`), yüzen buzlu cam eksik dersler çekmecesi (`FloatingMissingDock`), `Ctrl+K` arama (`SearchModal`), tek dokunuşla `Ders Görünümü ↔ Günlük Kokpit` geçişi ve cam efektli alt çubuk.
K-013 | [DOĞRULANDI] | (KAYNAK: sohbet_ozet.txt + App.tsx + TimetableBuilder.tsx) | Tek gün tatil/bayram/kar kutusu tamamen kaldırıldı; tatil sistemi v2.0 ile birebir 4 tatil haftası (`Sonbahar Ara Tatili`, `Yarıyıl Tatili (1. Hafta)`, `Yarıyıl Tatili (2. Hafta)`, `Bahar Ara Tatili`), Ayarlar'da `Göster / Kaldır / Tatil haftası ekle` listesi ve `App.tsx` üzerinden `‹ / ›` ile dönem öncesi + tatil haftalarına adım adım geçiş bağlandı (`366.97 kB` derlendi).
K-014 | [DOĞRULANDI] | (KAYNAK: Vitest 7/8 çıktısı + Adım 1/2 & 2/2 yaması) | Kazanım hanesinden tarih/gün/saat satırı (`Çarşamba 16 Eylül · 4. saat`) kaldırıldı (`SubjectFlowView.tsx`), kayıtlı/aktarılan `Tarih;Ders;Saat;Kazanım` kalıntılarını temizleyen `sanitizeOutcomeText` (`schema.ts`) ve çok sütunlu CSV ayrıştırıcı + ders bazlı eşleme (`BulkBranchImporter.tsx`) eklendi; ilk 7 test geçti.
K-015 | [DOĞRULANDI] | (KAYNAK: Vitest çıktısı + docxXlsxParser.ts düzeltmesi) | Tatil kaymalı / birleşik yıllık planlarda haftaların ve kutuların boş kalmaması için tarih öncelikli hafta eşleme, `1-2. Hafta` / `14-25 Eylül` aralık desteği, birleşik satır mirası (`docxXlsxParser.ts`), `rebalanceWeeklyPlan` (`branchPlanner.ts`), 1–37 dengeli yayma onayı (`BulkBranchImporter.tsx`) ve sakin `FloatingMissingDock` eklendi.
K-016 | [DOĞRULANDI] | (KAYNAK: Kademe ders havuzu yaması) | İlkokul/Ortaokul/Lise için kademeye özel ders havuzu (`SUBJECT_CATALOG_BY_KADEME`, `getKademeSubjects`), `subjectCatalog` kalıcılığı (`schema.ts`), `TimetableBuilder.tsx` içinde ders ekle/çıkar, hızlı yerleştirme fırçası (`+`/`×`), kademe şablon filtresi ve `<datalist>` otomatik tamamlama ile ortaokul/lise örnek şablonları eklendi; `npm.cmd test && npm.cmd run build` doğrulaması bekleniyor.

## 3. Vazgeçilen Fikirler
- v2.0 minified HTML bloğuna doğrudan yama yaparak 7–10 ders saatli ortaokul/lise eklemekten vazgeçildi (`0..5` slot kilidi nedeniyle veri kaybı riski).
- v3.0 ilk prototipteki 4 ayrı sekmeye bölünmüş ve kart başına 5 butonlu kalabalık arayüzden vazgeçilip v2.0'ın tek-sayfa HarmonyOS/macOS akıcı arayüzüne dönüldü (`K-012`).
- Tek gün tatil / bayram / kar kutusundan vazgeçilip v2.0'daki 4 ana tatil haftası sistemine dönüldü (`K-013`).
- Kazanım kartı üstündeki gün/tarih/saat etiketinden vazgeçildi (`K-014`).
- Tüm kademelerde sabit tek ders listesi gösterilmesinden vazgeçilip kademeye göre eklenip çıkarılabilen dinamik ders havuzuna geçildi (`K-016`).

## 4. Mevcut Durum ve Aşama
- Aşama: Pusula v3.0 Faz 5 + v2.0 tatil sistemi + kazanım hanesi temizliği + 37 hafta dengeli dağıtım + kademe ders havuzu yamaları uygulandı; son test/derleme/canlı onay bekleniyor.
- Hazır olan: `kazanim-defteri-pusula-v2.0-final.html`, `kazanim-defteri-pusula-v2.0-final.html.yedek`, `C:\Users\meemc\pusula-v3\` (`src/core/*`, `src/components/*`, `dist/index.html`).
- Takıldığı nokta: Son `docxXlsxParser.ts` ve `TimetableBuilder.tsx` güncellemeleri için `npm.cmd test && npm.cmd run build` çıktısının paylaşılması bekleniyor (PowerShell'de `npm` yerine `npm.cmd` kullanılmalıdır).

## 5. Açık İşler
- [ ] AÇ-001: Bu `DURUM.md` (v008) taslağının kullanıcı tarafından incelenip onaylanması.
- [ ] AÇ-002: `kazanim-defteri-pusula-v2.0-final.html` dosyasının Gizli Sekmede test edilip doğrulanması (isteğe bağlı, v2 arşiv doğrulaması).
- [ ] AÇ-003: `npm.cmd test && npm.cmd run build` sonrası `dist\index.html` dosyasının tarayıcıda canlı test edilmesi (kademe ders ekle/çıkar, temiz Matematik kazanım kartları, 1–37 dengeli plan dağıtımı, PNG/PDF/Word/Excel çıktıları, F12 mobil/tablet görünümü ve Verili HTML -> Gizli Sekme testi).

## 6. Tamamlanan İşler
- [x] TAM-001: Node.js LTS (`v26.13.1`) kurulumu ve `C:\Users\meemc\pusula-v3` temiz React+TS+SingleFile iskeletinin oluşturulması.
- [x] TAM-002: MEB 2026–2027 ana tatil takvimi (`dayHolidays: {}`) ve mobil/tablet katmanının eklenmesi.
- [x] TAM-003: HarmonyOS/macOS/iOS tek-sayfa akıcı arayüz (`SubjectFlowView`, `FloatingMissingDock`, `SearchModal`) eklenmesi.
- [x] TAM-004: Faz 5 tam çıktı & aktarım paketi (PNG/PDF/Word/Excel, `KD5Z:`/`KD4Z:` eşitleme, 3 sekmeli sürükle-bırak, `subjectPriority`, `A−`/`A+`, tatil/uyum kartları) eklenip 6/6 Vitest testi ve `dist/index.html` (365.29 kB) derlemesinin tamamlanması.
- [x] TAM-005: v2.0 ile birebir 4 tatil haftası + `App.tsx` adım adım tatil/dönem öncesi geçiş bağlantısının (`366.97 kB`) tamamlanması.

## 7. Çalışma Kuralları
Dil Türkçe. v2.0 final dosyasının minified `<script type="module">` bloğunu değiştirme. Tüm yeni geliştirmeleri `C:\Users\meemc\pusula-v3` içinde temiz TypeScript modülleri olarak yap; her değişiklikten sonra `npm.cmd test` ve `npm.cmd run build` ile doğrula. PowerShell'de ExecutionPolicy nedeniyle `npm` yerine `npm.cmd` kullan.

Çok yapay zekâ çalışma düzeni:
- Tek yazar kuralı: kodu aynı anda yalnızca bir yapay zekâ değiştirir; eleştirmen ve editör rolündekiler kod yazmaz, yalnızca bulgu ve öneri verir.
- Her yamadan önce git commit atılır. npm.cmd test, npm.cmd run build ve elle kontrol yeşil olmadan kayıt DOĞRULANDI yapılmaz ve sonraki yamaya geçilmez.
- Eleştiri ve önerilerin her biri gerekçesiyle kabul veya ret edilir, körü körüne uygulanmaz.
- Kapsam genişletilmez: yalnızca istenen değişiklik yapılır, çalışan kod bozulmaz.
- Oturum sonunda: git commit, git push, DURUM.md sürümü artırılır, Kaynak satırına ve commit mesajına hangi yapay zekâ olduğu yazılır.
- Son doğrulanmış hâl git etiketiyle işaretlenir (örn. v008-dogrulandi); geri dönüş bu etikete yapılır.

## 8. Değişiklik Notu
- v001–v005: Kurulum, MEB 2026–2027 ana takvimi, mobil/tablet katmanı, HarmonyOS/macOS arayüzü ve Faz 5 çıktı/aktarım paketi.
- v006: v2.0 birebir 4 tatil haftası (`TAM-005`, `366.97 kB`), kazanım kartlarından tarih/gün/saat kaldırılması ve `sanitizeOutcomeText` (`K-014`).
- v007: Tarih öncelikli plan okuyucu, `1-2. Hafta` / `14-25 Eylül` aralık desteği, `rebalanceWeeklyPlan` (1–37 dengeli dağıtım) ve sakin `FloatingMissingDock` (`K-015`).
- v008: İlkokul/Ortaokul/Lise kademe bazlı dinamik ders havuzu (ekle/çıkar + hızlı yerleştirme + şablon filtresi + `datalist`) (`K-016`).

- v009: K-014, K-015, K-016 DOĞRULANDI (test 9/9 + elle kontrol); git + private GitHub kuruldu (v008-dogrulandi); çok yapay zekâ çalışma kuralları eklendi.

=== DURUM SONU v009 ===