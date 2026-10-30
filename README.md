<p align="center"><img src="docs/logo/tocad-logo.svg" alt="toCAD" width="300"></p>

# toCAD

Tarayıcıda çalışan, **SolidWorks iş akışını** izleyen basit bir parametrik CAD programı. Basit parçalar ve en fazla 10–20 parçalı montajlar için tasarlandı.

Kurulum gerektirmez: derlenmiş uygulama **tek bir HTML dosyasıdır** ve herhangi bir modern tarayıcıda açılır.

## Özellikler

**Parça (3B modelleme)**
- Düzlem veya düz yüzey seç → **Çizim** → çiz → **Akıllı Ölçülendirme** ve ilişkilerle tam tanımla → özellik oluştur.
- Çizim araçları: çizgi, merkez çizgisi, köşe/merkez dikdörtgen, daire, merkez nokta yay, 3 nokta yay, teğet yay, düz kanal, çokgen, **nokta**, çizim radyusu (çizgi ve yay köşelerinde), budama (tıklayarak veya fare basılı sürüklenerek **güç budama**; kesişen öğeleri böler, kontur kapalı kalır), ofset (tek ölçüyle; istenirse **iki yönde**), aynalama, doğrusal/dairesel çizim çoğaltma (aralık/açı ölçüsüyle parametrik), yapı geometrisi.
- Çizim düzlemine dik, **perspektifsiz (2B) görünüm**: çizim düzenlenirken görünüm döndürülmez, yakınlaştırınca çizim ve arkadaki model birbirine göre kaymaz.
- **Dış referanslar:** arkadaki modelin kenarlarına ve diğer çizimlerin öğelerine tıklanınca sabit referans olarak çizime alınır; çizilen öğelerle aralarında çakışık, paralel, dik, teğet, eşit, eşmerkezli ilişkiler ve ölçüler verilebilir. Kullanılmayan referanslar çizimden çıkınca silinir.
- Yakalama: noktalar, orta noktalar, öğe kesişimleri, görünür ızgara; çizerken yatay/dikey, önceki çizgiye dik ve yaya teğet yönler. **Hiza çizgileri:** imlecin üzerinden geçtiği noktaların yatay/dikey hizası, çizgi uzantıları ve yay teğetleri kesikli yardımcı çizgiyle gösterilip yakalanır; çizgi başlangıcından daireye teğet nokta yakalanır. Boşta uçlar, kesişmeler ve T-birleşimleri çizimde kırmızıyla işaretlenir.
- İlişkiler: yatay, dikey, paralel, dik, eşit, doğrusal, teğet, çakışık, orta nokta, eşmerkezli, simetrik (iki nokta veya iki daire + eksen), sabitle. Kısıt çözücü serbestlik derecesini hesaplar; tanımsız öğeler mavi, tam tanımlılar siyah görünür.
- **Bölgeler:** birbirini kesen veya üst üste binen şekiller (daire + dikdörtgen, köşe göbekleri + kollar) budamaya gerek kalmadan birleşir; iç içe ve birbirine değmeyen konturlar delik olur, bir bölgeyi bölen çizgiler ve boşta uçlar profili bozmaz. Ekstrüzyon/Döndürme panelinde ekranda bölgeye tıklayarak yalnızca istenen bölgeler kullanılabilir.
- **Çizerken ölçü yazma:** çizgi, dikdörtgen, daire, çokgen ve düz kanalda ilk noktadan sonra rakam yazınca giriş kutusu açılır (uzunluk ve isteğe bağlı açı — Sekme ile; genişlik × yükseklik; çap; kanalda boy × genişlik). Değer hem şekli çizer hem sürücü ölçü olarak eklenir.
- Seçim: bir öğeye çift tıklamak bağlı zincirin tamamını seçer. Kısayollar: **L** çizgi, **R** dikdörtgen, **C** daire, **A** yay, **P** nokta, **D** akıllı ölçü, **T** budama, **F** ekrana sığdır, **Esc** aracı/seçimi bırakır, **Ctrl+Z / Ctrl+Y** geri al/yinele, **Ctrl+S** kaydet, **Enter** paneldeki özelliği onaylar.
- **Boyut kutusu:** Seç aracıyla tıklanan daire, yay, çizgi veya dikdörtgenin boyutu (çap, yarıçap, uzunluk, genişlik × yükseklik) yazılır; yalnızca geometri değişir, oklu ölçü eklenmez.
- Ofset, aynalama ve çizim çoğaltma uygulanmadan önce **önizlenir**.
- Ölçüye dayalı çizim: çizimi düzenlemeye girince tüm ölçüler görünür; ölçüye çift tıklayarak veya paneldeki **Ölçüler** listesinden değer girilir, geometri yeni ölçüye göre güncellenir.
- **Ölçü çelişkileri:** çizimi aşırı tanımlayan ölçü veya ilişki eklenmez; onu zaten belirleyen ölçü/ilişkiler **sarı** gösterilir. Ölçü **referans (güdümlü) ölçü** olarak eklenebilir (parantez içinde, değeri çizimden gelir) ya da sarı ölçülerden biri referansa çevrilip yenisi sürücü yapılabilir. Geometriyle çelişen değer uygulanmaz, çelişenler sarı işaretlenir.
- **Tam Tanımla:** yalnızca istenince — şeritteki düğmeyle eksik ölçü ve ilişkiler geometriyi oynatmadan otomatik eklenir. Ölçü veya Sabitle ile bağlanmayan öğeler kendiliğinden sabitlenmez, mavi kalır. Çizim panelindeki “Çizime girerken ve çıkarken eksik ölçüleri otomatik ekle” seçeneği açılırsa ölçüsüz çizimler girişte ve çıkışta tam tanımlanır (varsayılan kapalı).
- Özellikler: Ekstrüzyon Katman/Taban, Ekstrüzyon Kesme (kör, tümünden geç, orta düzlem, gövdeye kadar, ters yön, yön 2, çizim düzleminden başlangıç ofseti, **İnce özellik**: açık çizgi/yay zinciri kalınlık verilerek bükülmüş sac veya U profil olarak ekstrüde edilir), Döndürme Katman/Taban ve Kesme, Delik Sihirbazı (ISO metrik M3–M20: basit, geçiş, diş, faturalı, havşa; standart dışı faturalı/havşa için özel ölçü), Radyus ve Pah (düz ve dairesel kenarlar), Doğrusal/Dairesel Çoğaltma (yön modeldeki düz kenardan, eksen delik/göbek gibi bir silindire veya kenara tıklanarak; seçilen silindir taşınınca eksen de taşınır), Aynala, Referans Düzlem (düzlemden veya modelin düz yüzeyinden ofset).
- FeatureManager ağacı, özellik düzenlerken geri sarma, bastırma, parça başına geri al/yinele. Bağlı öğesi olan özellik silinirken onay sorulur (bağlı öğelerle birlikte veya yalnızca kendisi); bastırma bağlı öğeleri de bastırır. Radyus/pah kenarları ölçü değişince yeni konumlarında bulunur.
- Malzeme, hacim, yüzey alanı, kütle; Ölç aracı (uzunluk, mesafe, açı, çap, alan).

**Montaj**
- Çok parçalı proje; bileşen ekleme, sabitleme, gizleme.
- Eşleştirmeler: çakışık, eşmerkezli (**dönmeyi kilitle**), paralel, dik, mesafe (iki düzlem; **eksenler arası**, ör. dişli çiftinin eksen aralığı; **eksen–düzlem**), açı. Çakışık ve mesafede hizalama ters çevrilir (yüz yüze duran parçada bileşen yarım tur döner). SolidWorks gibi **Eşleştir paneli açık kalır**: Enter eşleştirmeyi ekler ve sonrakinin seçimlerini bekler; ✓ veya Esc kapatır. Arkada kalan bileşenin yüzeyi **Alt + tıklama** ile seçilir. Bileşen taşıma/döndürme eşleştirmelere uyar. Parça değişince eşleştirmeler aynı özelliğin yeni yüzeyine/eksenine taşınır ve montaj yeniden çözülür.
- **Dairesel / Doğrusal Bileşen Çoğaltma:** eşleştirilmiş bir cıvata ve somun, göbeğin eksenine (veya bir yüzeyin normaline) göre çoğaltılır; kopyalar kaynakla birlikte hareket eder, parça listesinde adet olarak sayılır.
- Girişim algılama (aynı çaplı mil–delik gibi çakışan yüzeyler temas sayılır), patlatılmış görünüm (otomatik — eşleştiği parça da kayıyorsa onun kadar daha uzağa — ve adım adım), montaj kütlesi.
- STL dışa aktarma (.zip içinde), STL içe aktarma.

**Teknik resim** (SolidWorks çizim ortamıyla karşılaştırma: [docs/TEKNIK-RESIM.md](docs/TEKNIK-RESIM.md))
- Ön, üst, yan ve izometrik görünüşler; gizli çizgiler, eksen çizgileri; ISO E/ISO A izdüşüm.
- Görünüşler sürüklenerek taşınır; ön görünüş izdüşüm görünüşlerini de taşır, üst/yan görünüş hizasını korur. Görünüş, ölçü ve açıklamalar tıklanarak seçilir, **Delete** ile silinir/gizlenir.
- Otomatik genel ölçüler, delik konumları, döndürmeyle oluşan kademelerin çapları (mil) ve SolidWorks gibi satır satır delik etiketleri (↧ derinlik, ⌴ fatura, ⌵ havşa); etiketler birbirinin üstüne binmeyecek yere konur, sürüklenebilir.
- Akıllı ölçü: iki nokta, kenar uzunluğu, paralel kenar aralığı, noktadan kenara, çap/yarıçap ve açı (tolerans: ±, sapma, geçme).
- Kesit A-A ön, üst veya yan görünüşte; tam veya yarım kesit (taramalı). Montaj kesitinde bitişik parçalar farklı taranır; cıvata, somun, mil gibi parçalar kesilmeden bırakılabilir. Detay görünüşü (tarama ve eksen çizgileriyle), yüzey işareti, **geometrik tolerans** (ISO 1101, 14 sembol) ve **referans (datum) işareti**, notlar, diş gösterimi.
- **2B çizim** (şeritte Çizim sekmesi): çizgi, eksen çizgisi (iki paralel kenarın ortasından da), dikdörtgen, daire, yay, merkez işareti; kalın/ince sürekli, kesikli ve eksen çizgi türleri. Köşe, merkez ve kenarlara yakalanır; görünüşe bağlı öğeler görünüşle taşınır. Çizimler yalnızca teknik resme aittir.
- Montaj resmi: balonlar (ölçü yazılarına binmeyecek yere konur; sürüklenir, Delete ile gizlenir) ve parça listesi; liste görünüşlere değmiyorsa ölçek küçültülmez.
- Teknik resmin kendi geri al/yinele geçmişi vardır; model değişince geometriye artık oturmayan elle ölçüler kırmızı işaretlenir.
- A4–A0, yatay/dikey; ölçek listeden veya elle (ör. 1:2,5, 3:1); antetli, **antetsiz (çerçeveli)**, “parça adı ve ölçek” veya “yalnızca parça” düzenleri (Teknik Resim şeridinde ve PDF penceresinde).
- PDF (vektörel 2B, ölçekli 3B görüntü), **DXF** (katmanlı, AutoCAD R12), SVG ve PNG çıktısı.

**Kayıt ve kurtarma**
- Otomatik kayıt (açık çizim dahil) tarayıcı deposuna ve tarayıcı veritabanına yazılır; sayfa kapanması, tarayıcı çökmesi veya elektrik kesintisinden sonra çalışma kaldığı yerden açılır. **Dosya → Önceki sürümler** ile saklanan son 40 sürüm geri açılır. **Ctrl+S** projeyi dosyaya kaydeder.

**Ayarlar ve performans**
- Üst çubuktaki ⚙ ile **Ayarlar**: Kalite / Dengeli / Hızlı profilleri, piksel oranı, kenar yumuşatma, ekran yenileme, eğri çözünürlüğü, yeniden hesaplama önbelleği, önizleme gecikmesi, teknik resim gizli çizgi hassasiyeti; hesap süresi, önbellek ve ekran kartı bilgisi. Ayrıntılar: [docs/PERFORMANS.md](docs/PERFORMANS.md).

## Hızlı başlangıç

Gereken tek şey [Node.js](https://nodejs.org) 18 veya üstü.

```bash
git clone <depo-adresi> tocad
cd tocad
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
   git remote add origin https://github.com/<kullanıcı>/tocad.git
   git push -u origin main
   ```
3. GitHub Pages için: *Settings → Pages → Source: GitHub Actions*. Birkaç dakika sonra uygulama `https://<kullanıcı>.github.io/tocad/` adresinde açılır.
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

`ornekler/` klasöründeki `*.tocad.json` dosyaları **Dosya → Aç** ile açılır.

- `dort-kanatli-disk.tocad.json` — Ø813 dört kanatlı disk (Ø200 göbek, Ø143 delik, 38 mm kama kanalı). Çizimler teknik resimdeki ölçülerle (Ø813, Ø772, 147,5, R41,2, 20°, 318,5) ve dört katlı simetriyle tam tanımlıdır; bir ölçüyü değiştirmek dört kanadı birlikte günceller. Teknik resimde verilmeyen levha kalınlığı (25 mm) ve göbek çıkıntısı (90 mm) varsayımdır; özellik ağacından değiştirilebilir ya da `node ornekler/dort-kanatli-disk.mjs` ile yeniden üretilebilir.

Aşağıdaki üç örnek, eklerdeki teknik resimlerden programın kendi araçlarıyla çizildi. `npm run ornekler` (önce `npm install`) aynı adımları uygulamada yeniden oynatıp dosyaları üretir; adımlar `ornekler/ornekleri-ciz.mjs` içinde bir kullanıcının izleyeceği sırayla yazılıdır.

- `bukulmus-braket.tocad.json` — 10 mm kalınlıkta bükülmüş braket (124 × 165, genişlik 50). Dış kenar açık bir çizgi zinciri olarak çizilip R16 / R16,5 / R22 çizim radyuslarıyla yuvarlatılır ve **İnce özellik** ile kalınlaştırılır. Ø38 üst göbek, Ø9/Ø20 faturalı delik (**özel ölçülü Delik Sihirbazı**), Ø38 yan kulaklar (R10 geçişli; **başlangıç ofsetli** ekstrüzyon + Aynala), Ø16 kulak deliği, ayak uçlarında R25 (dikdörtgen + daire çizilip **kesilecek bölge seçilir**), Ø9/Ø18 ayak delikleri.
- `yatakli-stand.tocad.json` — izometrik resimden yorumlanan yataklı stand: 80 × 80 aralıklı dört göbek ve kollardan oluşan taban (tek çizimde üst üste çizilir, **bölge çözümü** birleştirir), üstü R30 kolon, 20'şer mm kademeli R20 / R15 / R9 üst yatak (Döndürme Kesme), R12 / R7 alt yatak, Ø8 yağ deliği, 9 mm et kalınlıklı U kutu (**İnce özellik**). İzometrik resim bazı ayrıntılarda belirsiz olduğundan ölçüler resimdekilerle (80, 60, 36, 9, 42, R30, R20, R15, R9, R12) uyumlu bir yorumdur.
- `l-destek.tocad.json` — L destek (30 × 35 taban, 65 yükseklik): yan profil tek çizimde, üst kenarlar R5, Ø27 göbek ile 6 mm kaburga üst üste çizilip tek seferde çıkarılır, Ø16 ve iki Ø10 delik, 10 mm kanal.

Aşağıdaki dört makine parçası `ornekler/makine-parcalari-ciz.mjs` ile aynı şekilde, uygulamanın araçlarıyla çizilir (`npm run ornekler` hepsini yeniden üretir):

- `duz-disli.tocad.json` — düz dişli m = 2, z = 24 (Ø52 baş, Ø43 taban dairesi, genişlik 20). Diş yanakları taban, bölüm ve baş dairesinden geçen 3 noktalı yaylar; taban dairesiyle üst üste çizilen tek diş çizimde dairesel çoğaltılır. Ø40 göbek, Ø25 mil deliği ve 8 × 3,3 kama kanalı (DIN 6885), delik ağızlarında 1 × 45° pah.
- `flansli-boru.tocad.json` — DN50 boru (Ø60,3 × 3,9 × 300), iki ucunda Ø165 × 18 flanş ve PCD 125 üzerinde 4 × Ø18 delik (EN 1092-1 PN16; flanş orta düzlemde aynalanır), birleşimlerde R3. Aynı projede ikinci parça: R76 yarıçaplı 90° dirsek (halka profil 90° döndürülür).
- `pompa-carki.tocad.json` — kapalı pompa çarkı: Ø200 arka disk, Ø60 göbek, 6 geriye eğik kanat (tek yay çizimde çoğaltılır, 5 mm İnce özellik), Ø200 / Ø90 göz ön örtü, Ø25 mil deliği ve 8 mm kama kanalı.
- `kademeli-mil.tocad.json` — Ø25 / Ø35 / Ø40 / Ø50 / Ø40 / Ø30 kademeli mil (305 mm, döndürme): 10 × 5 kama kanalı, DIN 471 segman kanalı, uçlarda 1 × 45° pah, omuzlarda R1, Ø6 pim deliği, uçta M10 diş deliği. Teknik resimde kademe çapları otomatik ölçülür.

Aşağıdaki üç montaj `ornekler/montajlar-ciz.mjs` ile aynı şekilde, uygulamanın araçlarıyla kurulur (`npm run ornekler` hepsini yeniden üretir):

- `flansli-kaplin.tocad.json` — iki dökme demir göbek (Ø120 flanş, PCD 90 üzerinde 4 × Ø11, Ø25 delik ve kama kanalı), 4 × M10 × 50 cıvata ve somun, iki Ø25 mil. B göbeği aynı parçadan çoğaltılıp yüz yüze (yarım tur döndürülerek) eşleştirilir; bir cıvata ile somun eşleştirilip göbek ekseni etrafında **dairesel bileşen çoğaltmayla** 4'e çıkarılır (23 yerine 11 eşleştirme). Tüm bileşenler tam konumlu, girişim yok.
- `mentese.tocad.json` — aynı parçadan iki paslanmaz kanat (B kanadı yarım tur döner, gözler uç uca), dönmesi kilitli Ø4 pim, kanatlar arası **açı** eşleştirmesi (90°).
- `disli-cifti.tocad.json` — 140 × 80 taban, iki Ø25 mil, `duz-disli`den içe aktarılan iki dişli: delikler **eksenler arası 48 mm** (m · z), ikinci dişli dişleri kavrasın diye kama kanalları arasında 7,5° (yarım diş) açıyla. Girişim yok.

## Proje yapısı

```
src/
  index.html               Sayfa iskeleti ve arayüz işaretlemesi (yer tutucularla)
  styles.css               Tüm stiller (açık/koyu tema)
  core/geometry.js         DOM'suz geometri çekirdeği: CSG, profiller, kısıt çözücü, özellikler, kenarlar
  app/01-temel.js …        Arayüz modülleri; ad sırasına göre tek bir kapsam içinde birleştirilir
  app/99-baslat.js         Başlatma ve test arayüzü
ornekler/                Örnek projeler ve onları üreten betikler
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
