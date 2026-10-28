# Tezgâh CAD

Tarayıcıda çalışan, **SolidWorks iş akışını** izleyen basit bir parametrik CAD programı. Basit parçalar ve en fazla 10–20 parçalı montajlar için tasarlandı.

Kurulum gerektirmez: derlenmiş uygulama **tek bir HTML dosyasıdır** ve herhangi bir modern tarayıcıda açılır.

## Özellikler

**Parça (3B modelleme)**
- Düzlem veya düz yüzey seç → **Çizim** → çiz → **Akıllı Ölçülendirme** ve ilişkilerle tam tanımla → özellik oluştur.
- Çizim araçları: çizgi, merkez çizgisi, köşe/merkez dikdörtgen, daire, merkez nokta yay, düz kanal, çokgen, çizim radyusu, budama, ofset, aynalama, doğrusal/dairesel çizim çoğaltma, yapı geometrisi.
- İlişkiler: yatay, dikey, paralel, dik, eşit, doğrusal, teğet, çakışık, orta nokta, eşmerkezli, simetrik, sabitle. Kısıt çözücü serbestlik derecesini hesaplar; tanımsız öğeler mavi, tam tanımlılar siyah görünür.
- Özellikler: Ekstrüzyon Katman/Taban, Ekstrüzyon Kesme (kör, tümünden geç, orta düzlem, ters yön, yön 2), Döndürme Katman/Taban ve Kesme, Delik Sihirbazı (ISO metrik M3–M20: basit, geçiş, diş, faturalı, havşa), Radyus ve Pah (düz ve dairesel kenarlar), Doğrusal/Dairesel Çoğaltma, Aynala, Referans Düzlem.
- FeatureManager ağacı, özellik düzenlerken geri sarma, bastırma, parça başına geri al/yinele.
- Malzeme, hacim, yüzey alanı, kütle; Ölç aracı (uzunluk, mesafe, açı, çap, alan).

**Montaj**
- Çok parçalı proje; bileşen ekleme, sabitleme, gizleme.
- Eşleştirmeler: çakışık, eşmerkezli, paralel, dik, mesafe, açı. Bileşen taşıma/döndürme eşleştirmelere uyar.
- Girişim algılama, patlatılmış görünüm (otomatik ve adım adım), montaj kütlesi.
- STL dışa aktarma (.zip içinde), STL içe aktarma.

**Teknik resim**
- Ön, üst, yan ve izometrik görünüşler; gizli çizgiler, eksen çizgileri; ISO E/ISO A izdüşüm.
- Otomatik genel ölçüler ve delik etiketleri, elle ölçü (tolerans: ±, sapma, geçme), kesit A-A (taramalı), detay görünüşü, yüzey işareti, notlar, diş gösterimi.
- Montaj resmi: balonlar ve parça listesi.
- A4–A0, yatay/dikey; antetli, “parça adı ve ölçek” veya “yalnızca parça” düzenleri.
- PDF (vektörel 2B, ölçekli 3B görüntü), SVG ve PNG çıktısı.

## Hızlı başlangıç

Gereken tek şey [Node.js](https://nodejs.org) 18 veya üstü.

```bash
git clone <depo-adresi> tezgah-cad
cd tezgah-cad
npm run build          # dist/index.html oluşur
```

`dist/index.html` dosyasını tarayıcıda açman yeterli. Derleme için hiçbir npm paketi gerekmez; `npm install` yalnızca testler için gerekir.

Geliştirirken değişiklikleri otomatik derlemek için:

```bash
npm run dev            # src/ izlenir, her kayıtta dist/index.html yeniden oluşur
```

Sonra tarayıcıda sayfayı yenile.

## GitHub'a yükleme

Bu klasör ilk commit'i yapılmış bir git deposudur (`main` dalı).

1. GitHub'da **boş** bir depo oluştur (README, .gitignore veya lisans ekleme).
2. Klasörde:
   ```bash
   git remote add origin https://github.com/<kullanıcı>/tezgah-cad.git
   git push -u origin main
   ```
3. GitHub Pages için: *Settings → Pages → Source: GitHub Actions*. Birkaç dakika sonra uygulama `https://<kullanıcı>.github.io/tezgah-cad/` adresinde açılır.
4. Her gönderimde *Actions* sekmesinde testler çalışır.

## Testler

```bash
npm install
npx playwright install chromium   # ilk seferde
npm test
```

Testler `tests/` klasöründedir ve uygulamayı başsız Chromium'da (yazılımsal WebGL ile) açar. CDN kütüphaneleri testte `node_modules`'tan sunulur, yani testler internet gerektirmez.

Uygulama testler ve hata ayıklama için `window.__tz` nesnesini dışa açar (ör. `__tz.model`, `__tz.rebuildModel(features)`, `__tz.makePdf()`). Ayrıntılar: [docs/MIMARI.md](docs/MIMARI.md#test-arayüzü).

## Yayınlama

- **GitHub Pages:** `.github/workflows/pages.yml` hazır. Depo ayarlarında *Settings → Pages → Source* olarak **GitHub Actions** seç; `main` dalına her gönderimde uygulama yayınlanır.
- **Herhangi bir yer:** `dist/index.html` tek dosyadır; her statik sunucuya veya doğrudan bilgisayara konabilir.

Dosya indirme (PDF, STL, proje), Claude ortamında Claude'un indirme yeteneğiyle, diğer her yerde standart tarayıcı indirmesiyle çalışır.

## Örnek parçalar

`ornekler/` klasöründeki `*.tezgah.json` dosyaları **Dosya → Aç** ile açılır.

- `dort-kanatli-disk.tezgah.json` — Ø813 dört kanatlı disk (Ø200 göbek, Ø143 delik, 38 mm kama kanalı). Teknik resimde verilmeyen levha kalınlığı (25 mm) ve göbek çıkıntısı (90 mm) varsayımdır; özellik ağacından değiştirilebilir ya da `node ornekler/dort-kanatli-disk.mjs` ile yeniden üretilebilir.

## Proje yapısı

```
src/
  index.html               Sayfa iskeleti ve arayüz işaretlemesi (yer tutucularla)
  styles.css               Tüm stiller (açık/koyu tema)
  core/geometry.js         DOM'suz geometri çekirdeği: CSG, profiller, kısıt çözücü, özellikler, kenarlar
  app/01-temel.js …        Arayüz modülleri; ad sırasına göre tek bir kapsam içinde birleştirilir
  app/99-baslat.js         Başlatma ve test arayüzü
scripts/build.mjs          Derleyici (bağımlılıksız): sözdizimi denetimi + tek HTML
tests/                     Playwright testleri
docs/                      Mimari, dosya biçimi, yol haritası
```

Ayrıntılı açıklama: [docs/MIMARI.md](docs/MIMARI.md). Proje dosyası biçimi: [docs/DOSYA-BICIMI.md](docs/DOSYA-BICIMI.md).

## Dış bağımlılıklar

Çalışma anında yalnızca şunlar CDN'den yüklenir (sürümler sabitlenmiştir):

- three.js r128 — `cdnjs.cloudflare.com`
- OrbitControls (three 0.128.0) — `cdn.jsdelivr.net`
- Barlow / Barlow Condensed yazı tipleri — Google Fonts

PDF yazıcı, ZIP, STL, CSG ve kısıt çözücü bağımlılıksız olarak kodun içindedir.

## Bilinen sınırlamalar

Bkz. [docs/YOL-HARITASI.md](docs/YOL-HARITASI.md).

## Lisans

[MIT](LICENSE). Farklı bir lisans istersen `LICENSE` dosyasını ve `package.json` içindeki `license` alanını değiştir.
