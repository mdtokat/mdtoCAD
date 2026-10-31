# Mimari

toCAD iki katmandan oluşur: DOM'a bağımlı olmayan bir **geometri çekirdeği** (`src/core/geometry.js`) ve onun üzerinde çalışan **arayüz** (`src/app/*.js`). `scripts/build.mjs` bunları tek bir HTML dosyasında birleştirir.

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
| Vektör yardımcıları | `va, vs, vk, vd, vc, vl, vn` (dizi tabanlı 3B vektör), `num()` (virgül/nokta, dört işlem ve parantez: `800/2`, `5+(20+2)*3`) |
| CSG | csg.js yaklaşımıyla BSP ağacı: `Vec`, `Plane`, `Poly`, `BSP`, `csgUnion`, `csgSubtract`. Gövdeler dışbükey `Poly` dizileridir; `poly.shared` onu oluşturan özelliğin kimliğidir (seçim ve kesit için). Gövdenin araç kutusuna değmeyen çokgenleri (`splitByBox`) kırpılmaz ve sonuca bölünmeden geçer; aracın çokgenleri (kendi BSP'sinde bölünmeden) tüm gövdenin BSP'siyle sınıflandırılır. Bölünen çokgenin bütün parçaları kalırsa `rejoin` çokgenin kendisini geri koyar; `mergeCoplanar` aynı düzlemdeki komşu çokgenleri dışbükey kaldıkça birleştirir. `Plane.split` önce çokgenin sınır küresine (`bsphere`) bakar |
| Çerçeveler | Standart düzlemler `STD.front/top/right` (u, v, n eksenleri, u×v=n), `faceFrame`, `frameMatrix` |
| Çizim geometrisi | `sketchProfiles(sk, regions)`: profil şekilleri (dış kontur + delikler). `skArrangement` öğeleri kesişim ve dokunma noktalarında böler (`entIntersect`), düzlemsel grafın yüzlerini (bölgeler) bulur; `skContours` kapalı konturları çıkarır, birbirini kesen konturlar bir grup olur ve bir bölgeyi çevreleyen grup sayısı tekse bölge malzemedir. `sketchRegionShapes` malzeme bölgelerinin sınırlarını izler, `sketchFaces` arayüzde seçim için bölgeleri verir. `thinProfiles` İnce özellik için zincirleri gönye birleşimli şeritlere çevirir |
| Kısıt çözücü | `sysBuild` (değişkenler: nokta x,y ve daire yarıçapları; artıklar: ilişkiler ve ölçüler, `own[k]` artığı üreten kısıt; `driven` referans ölçüler atlanır). Seyrek çözüm: `resDeps` her artığın okuduğu değişkenleri bir kez vekil diziyle bulur, `sysComps` birbirine bağlı olmayan alt sistemleri ayırır, `lmSys` (Levenberg–Marquardt, seyrek Jacobian, `cholSolve` seyrek Cholesky) yalnızca değişen alt sistemleri çözer. `solveSketch` (sürükleme hedefleriyle iki aşamalı; başarısızsa `SOLVE_INFO.bad` sağlanamayan kısıtlar), `analyzeSketch` (artımlı satır tabanı `basisAdd`/`basisDet` ile Jacobian rütbesi → serbestlik derecesi ve tanımlı öğeler), `sketchRank`, `sketchConflict` (eklenecek kısıt aşırı tanımlıyorsa onu belirleyen mevcut kısıtlar: tabandaki katsayılardan), `sketchUnsat` (kayıtlı konumda sağlanmayan kısıtlar), `dimMeasure`/`updateDriven`. `lm`/`rrefInfo` (yoğun) montaj çözücüsünde kullanılır. `autoDefine` (otomatik tam tanımlama: aday ilişki/ölçüleri öncelik sırasıyla dener, rankı artıranları ekler; `placeDimLabels` etiketleri çakışmayacak yere koyar). Ofset (`doff`/`offd`) ve çizim çoğaltma (`tr`/`rot`) da kısıt olarak çözülür |
| Özellik gövdeleri | `extrudeTool`, `revolveTool`/`revolveLoop` (kısmi açı ve kapaklar), `holeTool`/`holeSpec` (ISO tabloları `HOLE_STD`), `edgeOpBodies` + `curvedEdgeBody` (radyus/pah), `patternMatrices` |
| Kenarlar | `computeEdges(polys, D, detail)`: aynı doğru üzerindeki kenarları gruplar, T-birleşimlerini aralıklara bölerek çözer; özellik kenarı (açı > 20°) ve görünüşe bağlı siluet kenarlarını döndürür |
| Yeniden oluşturma | `rebuildModel(features, upto)`: özellik listesini hesaplar; `{polys, ann, errors, frames, caps, tools}` döndürür. `RB_CACHE` her özellikten sonraki ara durumu, o özelliğe kadarki ağacın hash zinciriyle saklar; eşleşen en uzun baştaki kısım atlanır (bütçe çokgen sayısıyla, en eskisi atılır; `rbCacheSet`, `rbCacheClear`). `CURVE_SEG` tam dairenin parça sayısıdır (daire, yay, döndürme, delik, dairesel radyus) ve önbellek anahtarına girer; çizimdeki yayların ara noktaları da bu bölmelere oturur (`arcTs`), böylece aynı merkez ve yarıçaplı daire ile yay aynı kirişleri verir. Özelliğin `hidden` alanı (referans düzlemin görünürlüğü) anahtara girmez |

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
| `00-ayarlar.js` | Performans ve grafik ayarları (`SETTINGS`, `localStorage` anahtarı `tocad-ayarlar-v1`), profiller, Ayarlar penceresi, akıllı ekran yenileme (`requestRender`, `shouldRender`). Diğer modüllerden önce yüklenir: görüntüleyici ve çekirdek ayarları ilk hesaptan önce uygulanır |
| `01-temel.js` | Yardımcılar, ikonlar, sabitler (malzemeler, kağıtlar), örnek özellikler, proje durumu ve otomatik kayıt (`localStorage`, anahtar `tezgah-cad-v3` ve zaman damgası `tezgah-cad-v3-t`; en geç 300 ms sonra, açık çizim dahil; yedeği `15-kayit.js`), geçmiş, three.js sahnesi, kamera, `rebuild()`, 3B seçim |
| `02-ozellikler.js` | FeatureManager ağacı, CommandManager şeridi, görünüm araç çubuğu, PropertyManager formları, özellik önizlemesi |
| `03-cizim.js` | Çizim oturumu (`sk`), araçlar ve yakalama, akıllı ölçülendirme, ölçü düzenleme kutusu, ilişkiler, çizim görüntüsü (3B çizgiler + HTML etiketler) |
| `04-teknik-resim.js` | Görünüş verisi (`viewData`: derinlik arabelleğiyle gizli çizgi), sayfa düzeni (`buildSheet`), antet, ölçüler, sayfa yakınlaştırma, SVG/PNG, `saveFile` |
| `05-pdf.js` | Bağımlılıksız PDF yazıcı (`buildPdf`), SVG→PDF dönüştürücü (`svgToPdfOps`), ölçekli 3B görüntü (`build3DPage`), PDF penceresi |
| `06-montaj.js` | Proje parçaları, örnek proje, montaj görünümü, eşleştirme çözücü (`mateRes`, `asmSystem`, `solveMates`), montaj ağacı/şerit/panel, STL/ZIP |
| `07-montaj-araclari.js` | Çizim belgesi soyutlaması (`dwDoc`, `dwS`, `dwSrc`: parça veya montaj), patlatılmış görünüm, bileşen çoğaltma (`applyPats`, `openPatPM`), girişim algılama (`cylContact`: aynı çaplı silindir teması), parça listesi ve balonlar |
| `08-araclar.js` | Delik Sihirbazı paneli, dairesel kenar seçimi, Ölç aracı, çizim işlemleri (budama, ofset, aynalama, çoğaltma) |
| `09-teknik-resim-ekleri.js` | Kesit (CSG ile yarım uzay çıkarma + tarama), detay görünüşü, tolerans editörü, yüzey işareti, notlar, diş gösterimi |
| `10-bolgeler.js` | Ekstrüzyon/Döndürme panelinde bölgelerin gösterimi ve tıklanarak seçilmesi |
| `11-olcu-girisi.js` | Çizerken ölçü yazma (uzunluk, genişlik × yükseklik, çap) |
| `12-teknik-resim-duzen.js` | Teknik resimde akıllı ölçünün daire/kenar/açı seçimi, görünüş ve açıklamaları seçme, sürükleme, silme/gizleme; DXF yazıcı |
| `13-cizim-referanslari.js` | Çizimde dış referanslar: model kenarlarının ve diğer çizimlerin izdüşümü (`extCandidates`; açıklaması olmayan eğri kenarların kısa parçaları `edgeArcs` ile yay/daireye birleşir), tıklanan kenarın sabit referans öğesi olarak eklenmesi (`refAt`, `refEnt`), çizim araçlarının dış geometriye yakalanması (`extSnapPt`: köşe ve merkezler, `extSnapOn`: kenarlar; `skSnap` sonuçta `ext` döndürür, `resolvePt` referansı tıklanınca ekler), kullanılmayanların silinmesi (`pruneRefs`) |
| `14-olcu-celiskisi.js` | Ölçü çelişkileri: aşırı tanımlayan ölçüde çelişki penceresi (`openConflict`), sarı işaretleme (`setConf`, `isConf`), referans ölçü (`addRefDim`, `setDriven`, `swapDriven`) |
| `15-kayit.js` | Veri kaybına karşı: IndexedDB yedeği (`backupState`, `durability: 'strict'`), sürümler (`verSnap`, `verSnapNow`, `openRecovery`), açılışta kurtarma (`recoverCheck`), çoklu sekme uyarısı, Ctrl+S (`saveProjectFile`, File System Access API) |
| `16-teknik-resim-cizim.js` | Teknik resimde 2B çizim (şeritte Çizim sekmesi): çizgi, eksen çizgisi (iki paralel kenarın ortası), dikdörtgen, daire, yay, merkez işareti, çizgi türleri (`sk2d`). Yakalama (`dskSnap`: köşe, merkez, kenar ortası, kenar, yatay/dikey), görünüşe bağlama (`dskFrame`, `dskOwner`), çizim (`sk2dMarkup`: görünüşe bağlı öğelerin noktaları `ctx.snaps`'e, kenarları `v.sk`'ye eklenir; akıllı ölçü bunlara da oturur), seçme/sürükleme (`dskHitGrip`, `dskDrag`) |
| `18-montaj-hareket.js` | Montajda seçim (`asmPick`: düz yüzey, silindir; `fitCyl`: açıklaması olmayan eğri yüzeyden eksen; `pickAsmEdge`/`edgeRef`: dairesel ve doğrusal kenar), eşleştirme panelinde üzerine gelince vurgu (`asmHover`, `refObjs`), sürükleyerek taşıma/döndürme (`asmGrab` yakalama evresinde OrbitControls'tan önce çalışır; `dragSolve`, `poseSoft`, `moveCompTo`), Bileşeni Taşı paneli (`openMovePM`: serbest, montaj XYZ boyunca, ΔXYZ, XYZ konumuna; döndürme: serbest, eksen etrafında, ΔXYZ) |
| `19-montaj-eslestirme.js` | Eşleştirme türleri: standart, gelişmiş ve mekanik gruplar (`MATE_STD`, `MATE_ADV`, `MATE_MEC`), seçim yuvaları (`mateSlots`: a, b ve genişlik/simetrik/menteşede c, d), uygun türler (`mateTypesFor`), varsayılanlar (`initMateParams`), dönme bağlantıları (`coupAngles`, `mateTrack`), Eşleştir paneli (`matePMBody`, `mateSelect`) |
| `20-teknik-resim-olcu.js` | Teknik resim ölçüleri: görünüşteki yaylar (`viewArcs`: uç uca, aynı çemberdeki kirişler tek yay; tam daireler, teğet uçlar), `nearestArc` (yarıçap ölçüsü), kenar imzası (`edgeSig`: kenarın iki yanındaki yüzeylerin özelliği ve normali), elle ölçülerin model değişince yeniden bağlanması (`reattachDim`, `lineBySig`, `pointByRef`; `dims[].ref`), izdüşüm yöntemi değişince yan görünüş öğelerinin aynalanması (`mirrorSideItems`), eksen kimliği (`axisKey`: aynı eksendeki aynı çap bir kez ölçülür, zincir ölçü yalnızca aynı eksene), 180°'den büyük yay (`arcIsBig`: çapla ölçülür) |
| `99-baslat.js` | Sekmeler, Dosya menüsü, içe/dışa aktarma, klavye, başlatma, `window.__tz` |

### Durum

- `project` — tüm proje (parçalar, montajlar). `state` — etkin parça (`project.parts` içindeki nesneye başvuru).
- `model` — etkin parçanın son hesaplanmış sonucu (`polys`, `ann`, `errors`, `frames`, `caps`, `tools`, `box`, `props`, `version`).
- `sk` — açık çizim oturumu; `pm` — açık PropertyManager; `sel` — 3B seçim; `asmUI` — montaj arayüz durumu; `meas` — ölçüm.
- `activeTab` — `'model' | 'asm' | 'drawing'`. Parça ve montaj aynı 3B görünümü paylaşır (`partRoot` / `asmRoot` grupları).
- `camera` — etkin kamera: normalde `perspCam`, çizim düzenlenirken `orthoCam` (`setOrtho`; görünür yarı yükseklik `1/zoom`). Kamerayı yerleştiren her şey `camTo` üzerinden iki kamera türünde de çalışır; çizimde döndürme kapalıdır (`setControlsForSketch(true, true)`).

### Montaj eşleştirme çözücüsü

Her sabit olmayan bileşen için 6 değişken (öteleme + dönme vektörü, bileşen merkezi etrafında). Eşleştirme artıkları dünya koordinatlarında hesaplanır (`mateRes`), çekirdekteki `lm` ile çözülür. Serbestlik analizi çizimdekiyle aynı yöntemi (Jacobian rütbesi) kullanır; sınır eşleştirmeleri aralığın içindeyken artık ve türevleri sıfır olduğundan serbestlik kaldırmaz.

**Sürükleme (`dragSolve`):** yalnızca sürüklenen bileşenin eşleştirmelerle (sabit olmayan bileşenler üzerinden) bağlı olduğu grup serbesttir (`mateGroup`, `asmSystem(a, null, only)`). Önce eşleştirmeler ile küçük ağırlıklı yumuşak hedef birlikte çözülür — taşımada yakalanan nokta imleci izler (yalnızca dönebilen bileşen, ör. menteşeli kol, imleçle döner), döndürmede ve panelden Δ ile taşımada bileşenin merkezi ve iki yönü hedeflenir (`poseSoft`; yönler ayrı artık olduğundan eşleştirmenin izin vermediği eğilme bileşeni serbest yönlerde kaydırmaz) — grubun diğer bileşenleri çok küçük ağırlıkla yerinde tutulur. Sonra yalnızca eşleştirmelerle düzeltilir; sağlanamazsa bileşen son geçerli konumunda kalır. Eşleştirmesi olmayan bileşen doğrudan taşınır.

**Dönme bağlantıları:** dişli, kremayer–pinyon ve vida eşleştirmeleri eklendikleri anda her bileşende eksene dik bir referans yön saklar (`ua`, `ub` yerel; `wa`, `wb` dünya). Dönme açısı bu yönün başlangıç yönüne göre eksen etrafındaki açısıdır (`axAng`); her çözümden sonra `mateTrack` açıyı (`ta`, `tb`) saklar ve sonraki çözümde açı ±180°'den geçerken tam turlar sayılır (`unwrapA`).

Çözüm bulunamazsa (`solveMates`) sağlanamayan eşleştirmelerdeki bileşenler yarım tur çevrilmiş başlangıçlardan yeniden denenir (`flipStarts`): yüz yüze çakışıkta yüzler başlangıçta aynı yöne bakıyorsa artık tam ters konumdadır, eğim sıfırdır ve çözücü kendiliğinden dönemez. Bileşen çoğaltmasının kopyaları (`c.pat`) çözücüde serbest değildir; `solveAsm` her çözümden sonra `applyPats` ile kopyaları kaynaklarının yeni konumundan yerleştirir.

### Teknik resim hattı

1. `dwSrc()` — çizilecek kaynak: parçanın veya montajın (dönüştürülmüş, istenirse patlatılmış) çokgenleri.
2. `viewData(key, src)` — görünüş yönünde kenarlar (`computeEdges`), derinlik arabelleği (1024², `MeshDepthMaterial` RGBA paketleme) ile her kenar örneklenip görünür/gizli parçalara ayrılır. Sonuç önbelleğe alınır (anahtar: kaynak + görünüş).
3. `buildSheet()` — ölçek seçimi, görünüş yerleşimi (2×2 veya izometrik ayrı satırda), çizgiler, ölçüler, kesit, detay, etiketler, antet → SVG işaretlemesi (mm birimiyle).
4. Aynı işaretleme ekranda SVG olarak gösterilir, PDF için `svgToPdfOps` ile PDF komutlarına, DXF için `buildDXF` ile çizgi/daire/dolu üçgen/yazı varlıklarına çevrilir. Bu yüzden sayfadaki her şey yalnızca `M`/`L`/`Z` yolları, daire, dikdörtgen ve yazıdan oluşur; delik etiketi simgeleri (↧ ⌴ ⌵) ve geometrik tolerans sembolleri de çizgiyle çizilir. Gizli çizgiler `chainPath` ile yazılır: aynı doğru üzerindeki parçalar birleşir, uç uca gelenler tek çoklu çizgi olur (kesik deseni alt yolun başında yeniden başladığından kısa kirişlerden oluşan gizli daireler düz görünüyordu); DXF'te kesikli katmandaki çok noktalı alt yol `POLYLINE` (70 = 128, desen köşelerden kesintisiz) olur.
5. Elle eklenen 2B çizim öğeleri (`sk2d`) görünüşlerden sonra, elle ölçülerden önce çizilir; görünüşe bağlı olanlar görünüşün `map` eşlemesiyle sayfaya taşınır.
6. `buildSheet` her ölçü/etiket kutusunu `occ` listesine yazar; otomatik etiketler kılavuz çizgisini döndürerek bu kutulara ve görünüş çizgilerine en az değen yere konur; ölçü yazısı ortası dolu olduğunda (ör. kesit çizgisinin ucu ve harfi) ya da harflerini bir çizgi kestiğinde (`occLn`: görünür, gizli ve eksen çizgileri; `dimSegs`: ölçü, uzatma ve kılavuz çizgileri — ISO 129-1) ölçü çizgisi boyunca boş yere kayar, yer yoksa oklar dışarıdan gösterir (`dimMarkup`). Otomatik ölçülerin sırası ISO 129-1'e göredir: delik konum ve ekstrüzyon derinliği ölçüleri içte, genel boyut dışta; ekstrüzyon derinlikleri model ekseni başına seviye kümeleriyle kapalı zincir oluşturmadan eklenir; zincir genel boyla kapanırsa bir kademe parantez içinde yardımcı ölçü olur. Seçilebilir her öğe `ctx.hits` içinde (tür, sıra/anahtar, kutu; çizim öğelerinde ve ölçülerde ayrıca `dist` uzaklık fonksiyonu — ölçüler `grabHit` ile yazısından veya ölçü/kılavuz çizgisinden tutulur, tutma kutusu `gb`) yer alır; sürükleme ve **Delete** bu listeyle çalışır. Elle ölçülerde `pos` ölçü çizgisinin yeri, `tx` yazının ölçü çizgisi boyunca kayması (açıda `ta`); otomatik ölçülerin elle kayması `aofs[anahtar]` (sayfa mm).

PDF'te yazılar standart Helvetica ile, Türkçe karakterler (ğ, ş, ı, İ, Ğ, Ş) özel `Differences` kodlamasıyla yazılır; ek yazı tipi gömülmez.

## Test arayüzü

`window.__tz` testler ve konsoldan hata ayıklama içindir. Sık kullanılanlar:

| Ad | Açıklama |
|---|---|
| `state`, `project`, `model` | Etkin parça, proje, hesaplanmış model |
| `previewGroup` | Özellik önizlemesinin 3B grubu |
| `rebuildModel(features)` | Saf hesaplama (arayüzü değiştirmez) |
| `cmd(ad)` | Şerit komutu çalıştırır (`'sketch'`, `'extrude'`, `'hole'`…) |
| `startSketch(on)`, `exitSketch(kabul)`, `setTool(ad)`, `toolClick(x, y)` | Çizim oturumu (çizim koordinatlarında) |
| `setDimVal(id, değer)`, `addRelation(tür)`, `selectItems([...])` | Çizim ölçü/ilişki |
| `applySkInput({L} \| {W,H} \| {D})`, `openSkInput(ilk)` | Çizerken ölçü yazma (imleç `sk.cursor`) |
| `sketchProfiles(çizim, bölgeler)`, `sketchFaces(çizim)`, `regionClick(olay)` | Bölgeler ve bölge seçimi |
| `openPM(tür, özellik)`, `commitPM()` | Özellik düzenleme |
| `curAsm()`, `solveAsm(a)`, `asmDof(a)`, `addComp(parçaId)` | Montaj |
| `asmPick(olay, {edges})`, `mateSelect(seçim)`, `setMateType(tür)`, `edgeRef(d, i)`, `fitCyl(d, i)` | Montaj seçimi ve eşleştirme paneli |
| `openMovePM(döndür)`, `moveCompTo(a, bileşen, matris)`, `dragSolve(a, bileşen, hedef)` | Bileşeni taşıma/döndürme |
| `getCtx()`, `buildSheet(...)`, `openPdfDialog(tür)`, `pdfOpt`, `makePdf()` | Teknik resim ve PDF |
| `stlBinary`, `makeZip`, `parseSTL` | Dosya biçimleri |
| `scr(x, y)`, `scrW([x, y, z])` | Çizim / dünya koordinatından ekran koordinatına |

Bu arayüz kararlı bir API değildir; testlerle birlikte güncellenir.
