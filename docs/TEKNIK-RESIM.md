# Teknik resim: SolidWorks çizim ortamıyla karşılaştırma

Teknik resim sekmesi örnek parçalarla (`ornekler/` ve varsayılan Yatak gövdesi) denenip SolidWorks'ün çizim (Drawing) ortamındaki komutlarla karşılaştırıldı. Testler: `tests/teknik-resim.spec.js`.

## Testte bulunan hatalar (düzeltildi)

| Bulgu | Neden | Düzeltme |
|---|---|---|
| Yataklı stand genel ölçüsü **105,97** (doğrusu 106), dört kanatlı disk **812,21** (doğrusu 813) | Yaylar eşit parçalara bölünüyordu; yayın en dış noktası köşe değildi | Yaylar çeyrek açılarda da bölünür (`arcTs`), sınır kutusu tam çıkar |
| Yataklı standda Ø24 ve Ø14 etiketleri üst üste | Bütün etiketler aynı yöne (45°/135°) çiziliyordu | Etiketler boş yer bulunana kadar döndürülür; ölçü yazılarına ve görünüş çizgilerine çarpmaz |
| Braketin delik yazısı (“2× Ø9, faturalı Ø18 derinlik 2 / delik derinliği 12”) görünüşün üstünden taşıyor | Tek satırlık açıklamalı metin | SolidWorks gibi satır satır simgeli etiket: `2× Ø9 ↧12` / `⌴Ø18 ↧2` |

## Komut karşılaştırması

| SolidWorks | toCAD | Not |
|---|---|---|
| Standart 3 görünüş, model görünüşü (izometrik) | ✅ | Ön, üst, yan + izometrik; ISO E / ISO A |
| Görünüşü sürükleyerek taşıma, izdüşüm hizası | ✅ yeni | Ön görünüş izdüşümleri de taşır; üst yalnızca dikey, yan yalnızca yatay |
| Görünüşü silme | ✅ yeni | Delete ile gizlenir, panelden geri gelir (ön görünüş hariç) |
| Kesit görünüşü | ✅ | Ön, üst (yeni) veya yan görünüş; tam veya **yarım kesit** (yeni); “KESİT A-A” |
| Montaj kesitinde bileşen tarama ve kesitten hariç tutma | ✅ yeni | Bitişik parçalar farklı açı/aralıkla taranır; cıvata, somun, mil gibi parçalar panelden “kesilmeyecek” seçilir |
| Hizalı / kademeli kesit, kısmi kesit (Broken-out) | ❌ | Yol haritasında |
| Detay görünüşü | ✅ | Tarama ve eksen çizgileri de (yeni); “DETAY B ÖLÇEK 2:1” |
| Yardımcı, kırık, kırpılmış görünüş | ❌ | Yol haritasında |
| Model öğeleri (otomatik ölçüler) | ✅ | Genel ölçüler, delik konumları, delik etiketleri; tek tek gizlenebilir (yeni) |
| Delik etiketi (Hole Callout) | ✅ yeni biçim | ↧ derinlik, ⌴ fatura, ⌵ havşa simgeleri, satır satır |
| Akıllı ölçü: iki nokta / yatay / dikey / hizalı | ✅ | |
| Akıllı ölçü: kenar uzunluğu, paralel kenarlar, noktadan kenara | ✅ yeni | |
| Akıllı ölçü: çap / yarıçap | ✅ yeni | Daireye tıklanır; ön ek R ile yarıçap |
| Akıllı ölçü: açı | ✅ yeni | İki kenar; imlecin bulunduğu bölgenin açısı |
| Ölçü toleransı (±, sapma, geçme) | ✅ | |
| Ölçüleri ve açıklamaları sürükleme, silme | ✅ yeni | |
| Yüzey işareti | ✅ | |
| Geometrik tolerans | ✅ yeni | ISO 1101'in 14 sembolü, Ø, üç referans |
| Referans (datum) işareti | ✅ yeni | A, B, C… sırayla |
| Not | ✅ | Sürüklenebilir (yeni) |
| Eksen çizgisi, merkez işareti, kozmetik diş | ✅ | Otomatik; ayrıca elle (aşağıda) |
| Çizim sekmesi: çizgi, merkez çizgisi, dikdörtgen, daire, merkez noktalı yay | ✅ yeni | Şeritte **Çizim** sekmesi. Köşe, merkez, kenar ortası ve kenarlara yakalanır, yatay/dikey hizalanır; çizgi zincir olarak devam eder. Öğeler yalnızca resme aittir |
| Merkez çizgisi (iki kenar arası), merkez işareti (daire) | ✅ yeni | Eksen çizgisi aracıyla iki paralel kenara tıklanınca ortadan geçen eksen; Merkez işareti aracıyla daireye tıklanır |
| Çizgi biçimi (çizgi türü) | ✅ yeni | Kalın sürekli, ince sürekli, kesikli (gizli), eksen (zincir); seçili öğeye de uygulanır |
| Görünüşe bağlı çizim (görünüşle taşınır) | ✅ yeni | Görünüşün içinde çizilen veya görünüş geometrisine yakalanan öğe görünüşle taşınır/ölçeklenir; diğerleri sayfaya bağlıdır |
| Yardımcı çizgiler (extension lines) geometriye değer | ✅ yeni | Ölçülen noktadan başlar, ölçü çizgisini 2 mm geçer; genel ölçüler sınır kutusunun köşesinden değil kenardan çıkar |
| Balon, otomatik balon, parça listesi (BOM) | ✅ | Montaj resminde; balonlar ölçülere binmez, sürüklenir ve gizlenir (yeni) |
| Kaynak sembolü, delik tablosu, revizyon tablosu | ❌ | Yol haritasında |
| Antet, kağıt boyutu, ölçek | ✅ | A4–A0, yatay/dikey; ölçek listeden veya elle (1:2,5, 3:1); antetli, antetsiz (çerçeveli), yalnızca parça adı ve ölçek, yalnızca parça |
| Çok sayfalı resim | ❌ | Yol haritasında |
| PDF / DXF / resim olarak kaydet | ✅ | PDF, **DXF (yeni)**, SVG, PNG |

## Kullanım

- **Taşıma:** araç seçili değilken görünüşü, ölçüyü, etiketi, notu, detayı, toleransı veya referansı tutup sürükle. Boş yerde sürüklemek sayfayı kaydırır.
- **Seçme / silme:** öğeye tıkla (mavi çerçeve), **Delete**. Otomatik ölçüler, delik etiketleri ve görünüşler gizlenir; soldaki panelde “Gizlenenler → Tümünü geri getir”.
- **Akıllı ölçü:** nokta + nokta; kenar + boş yer (uzunluk); kenar + paralel kenar (aralık); kenar + açılı kenar + yay yeri (açı); kenar + nokta (uzaklık); daire + yazı yeri (çap).
- **2B çizim (Çizim sekmesi):** araç seçilir; çizgi türü şeritten veya soldaki panelden. Çizgi: ardışık tıklamalar zincir çizer, aynı noktaya tıklamak veya Esc zinciri bitirir. Eksen çizgisi: iki nokta veya iki paralel kenar. Daire: merkez + yarıçap noktası (delik dairesi için merkeze ve bir deliğin merkezine tıkla); çap panelden yazılır. Yay: merkez, başlangıç, bitiş (fareyi götürdüğün yönde). Öğe seçilip sürüklenir, çizginin ucu veya dairenin çevresi tutulursa boyu/çapı değişir; Delete siler. Görünüşe bağlı öğelerin uçlarına ve merkezlerine akıllı ölçü verilir.
- **Geometrik tolerans / Referans:** şeritten seç, kenara tıkla; tür, değer ve referans harfleri soldaki panelden.
