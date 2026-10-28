# Mimari

Tezgâh CAD iki katmandan oluşur: DOM'a bağımlı olmayan bir **geometri çekirdeği** (`src/core/geometry.js`) ve onun üzerinde çalışan **arayüz** (`src/app/*.js`). `scripts/build.mjs` bunları tek bir HTML dosyasında birleştirir.

## Derleme

```
src/index.html  ──┐  <!-- @styles -->  ← src/styles.css
                  ├─ <!-- @core -->    ← src/core/geometry.js          (<script id="core">)
                  └─ <!-- @app -->     ← src/app/*.js (ad sırasıyla)    (<script id="app-js">)
```

Uygulama modülleri tek bir `(function(){ ... })()` kapsamında birleşir. Çekirdek ise küresel kapsamda tanımlanır; uygulama çekirdeğin fonksiyonlarını doğrudan çağırır (`rebuildModel`, `solveSketch`, `computeEdges`…).

## Çekirdek (`src/core/geometry.js`)

| Bölüm | İçerik |
|---|---|
| Vektör yardımcıları | `va, vs, vk, vd, vc, vl, vn` (dizi tabanlı 3B vektör), `num()` (virgül/nokta) |
| CSG | csg.js yaklaşımıyla BSP ağacı: `Vec`, `Plane`, `Poly`, `BSP`, `csgUnion`, `csgSubtract`. Gövdeler `Poly` dizileridir; `poly.shared` onu oluşturan özelliğin kimliğidir (seçim ve kesit için) |
| Çerçeveler | Standart düzlemler `STD.front/top/right` (u, v, n eksenleri, u×v=n), `faceFrame`, `frameMatrix` |
| Çizim geometrisi | `sketchProfiles(sk)`: kapalı konturları bulur, iç içe geçmeyi çözer (dış kontur + delikler), kesişimleri reddeder |
| Kısıt çözücü | `sysBuild` (değişkenler: nokta x,y ve daire yarıçapları; artıklar: ilişkiler ve ölçüler), Levenberg–Marquardt `lm`, `solveSketch` (sürükleme hedefleriyle iki aşamalı), `analyzeSketch` (Jacobian rütbesi → serbestlik derecesi ve tanımlı öğeler), `sketchRank` (aşırı tanımlama denetimi) |
| Özellik gövdeleri | `extrudeTool`, `revolveTool`/`revolveLoop` (kısmi açı ve kapaklar), `holeTool`/`holeSpec` (ISO tabloları `HOLE_STD`), `edgeOpBodies` + `curvedEdgeBody` (radyus/pah), `patternMatrices` |
| Kenarlar | `computeEdges(polys, D, detail)`: aynı doğru üzerindeki kenarları gruplar, T-birleşimlerini aralıklara bölerek çözer; özellik kenarı (açı > 20°) ve görünüşe bağlı siluet kenarlarını döndürür |
| Yeniden oluşturma | `rebuildModel(features, upto)`: özellik listesini baştan hesaplar; `{polys, ann, errors, frames, caps, tools}` döndürür |

### Özellik ağacının hesaplanması

`rebuildModel` özellikleri sırayla işler:
- `plane` → `ctx.frames[id]`
- `sketch` → çerçevesi çözülür (standart düzlem, referans düzlem veya yüz). Yüze bağlı çizimler, o yüzü oluşturan ekstrüzyonun uç düzlemine (`ctx.caps`) bağlanır; böylece model değişince çizim de taşınır.
- `extrude`/`revolve`/`hole` → araç gövdesi üretilir, CSG ile birleştirilir/çıkarılır; `ctx.tools[id]` çoğaltma için saklanır.
- `lpattern`/`cpattern`/`mirror` → hedeflerin araç gövdeleri dönüştürülüp uygulanır.
- `fillet`/`chamfer` → mevcut gövde üzerinde kenar eşleştirilir; kesici (dışbükey kenar) veya dolgu (içbükey kenar) gövdesi üretilir.

Her özelliğin hatası `errors[id]` içine yazılır; hata, sonraki özelliklerin hesaplanmasını durdurmaz.

**Açıklamalar (`ann`)** silindirik yüzeyleri tanımlar: merkez `C`, eksen `A`, yarıçap `r`, eksen boyunca `t0..t1`. Teknik resimde merkez işaretleri/eksen çizgileri, delik etiketleri (`txt`), diş gösterimi (`thread`); montajda eşmerkezli eşleştirme ve ölçüm için kullanılır.

## Arayüz modülleri (`src/app`)

| Dosya | Sorumluluk |
|---|---|
| `01-temel.js` | Yardımcılar, ikonlar, sabitler (malzemeler, kağıtlar), örnek özellikler, proje durumu ve kaydetme (`localStorage`, anahtar `tezgah-cad-v3`), geçmiş, three.js sahnesi, kamera, `rebuild()`, 3B seçim |
| `02-ozellikler.js` | FeatureManager ağacı, CommandManager şeridi, görünüm araç çubuğu, PropertyManager formları, özellik önizlemesi |
| `03-cizim.js` | Çizim oturumu (`sk`), araçlar ve yakalama, akıllı ölçülendirme, ölçü düzenleme kutusu, ilişkiler, çizim görüntüsü (3B çizgiler + HTML etiketler) |
| `04-teknik-resim.js` | Görünüş verisi (`viewData`: derinlik arabelleğiyle gizli çizgi), sayfa düzeni (`buildSheet`), antet, ölçüler, sayfa yakınlaştırma, SVG/PNG, `saveFile` |
| `05-pdf.js` | Bağımlılıksız PDF yazıcı (`buildPdf`), SVG→PDF dönüştürücü (`svgToPdfOps`), ölçekli 3B görüntü (`build3DPage`), PDF penceresi |
| `06-montaj.js` | Proje parçaları, örnek proje, montaj görünümü, eşleştirme çözücü, montaj ağacı/şerit/panel, taşıma/döndürme, STL/ZIP |
| `07-montaj-araclari.js` | Çizim belgesi soyutlaması (`dwDoc`, `dwS`, `dwSrc`: parça veya montaj), patlatılmış görünüm, girişim algılama, parça listesi ve balonlar |
| `08-araclar.js` | Delik Sihirbazı paneli, dairesel kenar seçimi, Ölç aracı, çizim işlemleri (budama, ofset, aynalama, çoğaltma) |
| `09-teknik-resim-ekleri.js` | Kesit (CSG ile yarım uzay çıkarma + tarama), detay görünüşü, tolerans editörü, yüzey işareti, notlar, diş gösterimi |
| `99-baslat.js` | Sekmeler, Dosya menüsü, içe/dışa aktarma, klavye, başlatma, `window.__tz` |

### Durum

- `project` — tüm proje (parçalar, montajlar). `state` — etkin parça (`project.parts` içindeki nesneye başvuru).
- `model` — etkin parçanın son hesaplanmış sonucu (`polys`, `ann`, `errors`, `frames`, `caps`, `tools`, `box`, `props`, `version`).
- `sk` — açık çizim oturumu; `pm` — açık PropertyManager; `sel` — 3B seçim; `asmUI` — montaj arayüz durumu; `meas` — ölçüm.
- `activeTab` — `'model' | 'asm' | 'drawing'`. Parça ve montaj aynı 3B görünümü paylaşır (`partRoot` / `asmRoot` grupları).

### Montaj eşleştirme çözücüsü

Her sabit olmayan bileşen için 6 değişken (öteleme + dönme vektörü, bileşen merkezi etrafında). Eşleştirme artıkları dünya koordinatlarında hesaplanır (`mateRes`), çekirdekteki `lm` ile çözülür. Taşıma sırasında istenen konum başlangıç alınıp eşleştirmelere en yakın çözüme izdüşürülür. Serbestlik analizi çizimdekiyle aynı yöntemi (Jacobian rütbesi) kullanır.

### Teknik resim hattı

1. `dwSrc()` — çizilecek kaynak: parçanın veya montajın (dönüştürülmüş, istenirse patlatılmış) çokgenleri.
2. `viewData(key, src)` — görünüş yönünde kenarlar (`computeEdges`), derinlik arabelleği (1024², `MeshDepthMaterial` RGBA paketleme) ile her kenar örneklenip görünür/gizli parçalara ayrılır. Sonuç önbelleğe alınır (anahtar: kaynak + görünüş).
3. `buildSheet()` — ölçek seçimi, görünüş yerleşimi (2×2 veya izometrik ayrı satırda), çizgiler, ölçüler, kesit, detay, etiketler, antet → SVG işaretlemesi (mm birimiyle).
4. Aynı işaretleme ekranda SVG olarak gösterilir, PDF için `svgToPdfOps` ile PDF komutlarına çevrilir.

PDF'te yazılar standart Helvetica ile, Türkçe karakterler (ğ, ş, ı, İ, Ğ, Ş) özel `Differences` kodlamasıyla yazılır; ek yazı tipi gömülmez.

## Test arayüzü

`window.__tz` testler ve konsoldan hata ayıklama içindir. Sık kullanılanlar:

| Ad | Açıklama |
|---|---|
| `state`, `project`, `model` | Etkin parça, proje, hesaplanmış model |
| `rebuildModel(features)` | Saf hesaplama (arayüzü değiştirmez) |
| `cmd(ad)` | Şerit komutu çalıştırır (`'sketch'`, `'extrude'`, `'hole'`…) |
| `startSketch(on)`, `exitSketch(kabul)`, `setTool(ad)`, `toolClick(x, y)` | Çizim oturumu (çizim koordinatlarında) |
| `setDimVal(id, değer)`, `addRelation(tür)`, `selectItems([...])` | Çizim ölçü/ilişki |
| `openPM(tür, özellik)`, `commitPM()` | Özellik düzenleme |
| `curAsm()`, `solveAsm(a)`, `asmDof(a)`, `addComp(parçaId)` | Montaj |
| `getCtx()`, `buildSheet(...)`, `openPdfDialog(tür)`, `pdfOpt`, `makePdf()` | Teknik resim ve PDF |
| `stlBinary`, `makeZip`, `parseSTL` | Dosya biçimleri |
| `scr(x, y)`, `scrW([x, y, z])` | Çizim / dünya koordinatından ekran koordinatına |

Bu arayüz kararlı bir API değildir; testlerle birlikte güncellenir.
