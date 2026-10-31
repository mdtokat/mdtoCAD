# Teknik resim: SolidWorks çizim ortamıyla karşılaştırma

Teknik resim sekmesi örnek parçalarla (`ornekler/` ve varsayılan Yatak gövdesi) denenip SolidWorks'ün çizim (Drawing) ortamındaki komutlarla karşılaştırıldı. Testler: `tests/teknik-resim.spec.js`.

## Testte bulunan hatalar (düzeltildi)

| Bulgu | Neden | Düzeltme |
|---|---|---|
| Yataklı stand genel ölçüsü **105,97** (doğrusu 106), dört kanatlı disk **812,21** (doğrusu 813) | Yaylar eşit parçalara bölünüyordu; yayın en dış noktası köşe değildi | Yaylar çeyrek açılarda da bölünür (`arcTs`), sınır kutusu tam çıkar |
| Yataklı standda Ø24 ve Ø14 etiketleri üst üste | Bütün etiketler aynı yöne (45°/135°) çiziliyordu | Etiketler boş yer bulunana kadar döndürülür; ölçü yazılarına ve görünüş çizgilerine çarpmaz |
| Braketin delik yazısı (“2× Ø9, faturalı Ø18 derinlik 2 / delik derinliği 12”) görünüşün üstünden taşıyor | Tek satırlık açıklamalı metin | SolidWorks gibi satır satır simgeli etiket: `2× Ø9 ↧12` / `⌴Ø18 ↧2` |
| L blokta R10 radyusun ortasına akıllı ölçüyle tıklamak bir köşe noktası seçiyordu; yarıçap ölçülemiyordu | Yaylar kısa kirişlerden oluşuyordu, her kiriş köşesi nokta sayılıyordu | Uç uca, aynı çemberde kalan kirişler tek yay sayılır: tıklanınca **R10**; yayın merkezi nokta olarak seçilir, ara köşeleri nokta değildir |
| Taban kalınlığı 15 → 20, delik Ø12 → Ø14 yapılınca elle verilen ölçüler kırmızı kalıyor, eski değeri yazıyordu | Ölçüler yalnızca görünüş koordinatı saklıyordu | Ölçü, kenarın iki yanındaki yüzeylerin özelliği ve normaliyle (köşe, daire, yay kimliğiyle) aynı öğeyi yeniden bulur: **20**, **Ø14**, **R15** |
| Delik merkezine tıkladıktan sonra kenara tıklamak hiçbir şey yapmıyordu | İkinci adımda yalnızca nokta aranıyordu | SolidWorks gibi seçim sırası önemsiz: nokta → kenar uzaklık, nokta → daire merkezler arası, kenar → daire merkezin kenara uzaklığı |
| ISO E → ISO A geçince yan görünüşteki ölçüler, detaylar ve notlar sessizce siliniyordu | Soldan görünüş sağdan görünüşe dönüşüyor, ona bağlı öğeler atılıyordu | Öğeler yatay eksende aynalanarak yeni yan görünüşe taşınır |
| Menteşe ve kaplin montaj resminde balonlar yan görünüşün genel ölçü çizgisinin üstündeydi | Balonlar yalnızca ölçü yazılarından kaçıyordu | Ölçü, uzatma ve kılavuz çizgilerinden de kaçar |
| Montaj resminde “Patlatılmış” düğmesi hiçbir şey yapmıyordu (montajda patlatma adımı yoksa); varsa ön/üst/yan görünüşler de patlıyordu, genel ölçüler anlamsızlaşıyordu | Patlatma yalnızca montajda tanımlı adımlarla, bütün görünüşlere uygulanıyordu | Adım yoksa otomatik patlatma adımları oluşturulur; SolidWorks gibi yalnızca izometrik görünüş patlatılır |
| Yataklı standın üst görünüşünde kademe zincir ölçüsü delik konum ölçüsüyle aynı sıraya düşüyor, iki “20” üst üste biniyordu | İkisi de görünüşün 9 mm sağına konuyordu | Zincir ölçüsü delik ölçülerinin dışındaki sıraya konur |

## Ölçülendirme kuralları (ISO 129-1) denetimi — altıncı tur

Örnek parçaların resimleri ISO 129-1 / TS 88 ölçülendirme kurallarına ve SolidWorks'ün model öğeleri davranışına göre incelendi. Testler: `tests/altinci-tur.spec.js`.

| Kural | Bulgu | Düzeltme |
|---|---|---|
| Kapalı zincir olmaz; biri yardımcı ölçüdür | Mil: 40 + 60 + 90 + … = 305 ve 305 | Ortadaki en uzun kademe **(90)**; ortada kademe yoksa sondaki (kapakta 12 + (10) = 22) |
| Kısa ölçü içte, uzun dışta | Milde 285 delik ölçüsü 305'in dışında | Genel boyutlar delik ve derinlik ölçülerinin dışında |
| Her ölçü bir kez | Ø50 iki kez; çarkta 200 / 200 / Ø200; diskte 813 / 813; kapakta iki Ø120; kaplin montaj resminde 120 / 120 | Daire biçimli görünüşte tek çap; aynı eksenin aynı çapı yan görünüşte yazılmaz; üst/yan görünüşü daire olan parçada Ø bir kez |
| Ölçü yazısını çizgi kesmez | Profil içi çapları eksen, etiketleri ölçü/uzatma/gizli çizgiler kesiyordu; “Ø40Ø18” bitişik | Yazı boş yere kayar, gerekirse oklar dışarıdan; etiket yeri çizgiler ve yakınlık hesaba katılarak seçilir |
| Gizli çizgiye ölçü verilmez | Standda gizli deliğe 21 / 20 / 21; L destekte Ø27 kesikli daireye | Zincir yalnızca görünür sınırlara ve aynı eksene; Ø27 göbeğin görünen kısmına |
| 180°'den büyük yay çapla | Diskte kama kanallı Ø143 ölçülmüyordu | Ø143, Ø26, Ø38; akıllı ölçüde de |
| Yarıçap yalnızca yaya | Dişlide pah kenarına R13,5; braketin yarım yuvarlak ucuna Ø50 | Pah kenarı ölçülmez; yarım yuvarlak uçta genişlik 50 |
| Eksiksiz ölçülendirme | Taban kalınlığı, kademe yüksekliği yoktu | Ekstrüzyon derinlikleri (15, 9, 60, 6,5, 20); kapalı zincir oluşturanlar eklenmez |
| Uzatma çizgileri kısa ve kesişmesiz | Milin Ø50'si görünüşün yanında, uzatma çizgileri bütün milin üstünde | Döner parçanın genel çapı silindirin üstüne, profilin içinden |
| Ölçü çizgileri eşit aralıklı | Elle ölçü tıklanan yerde kalıyordu | Görünüşten 9 mm, sonra 7 mm sıralara yakalanır (SolidWorks gibi) |

Bilinen sınır: SolidWorks model öğeleri çizim (sketch) ölçülerini de aktarır; toCAD özelliklerden türetir. Kanal genişliği gibi yalnızca çizimde bulunan ölçüler akıllı ölçüyle eklenir. Düz dişli örneğinde diş uçları modelde düz kiriş olduğundan genel boyut 51,98'dir (Ø52 değil).

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
| Model öğeleri (otomatik ölçüler) | ✅ | Genel ölçüler, delik konumları, delik etiketleri, radyuslar (R), **ekstrüzyon derinlikleri (yeni)**; kapalı zincir oluşturmaz, tek tek gizlenebilir |
| Delik etiketi (Hole Callout) | ✅ yeni biçim | ↧ derinlik, ⌴ fatura, ⌵ havşa simgeleri, satır satır |
| Akıllı ölçü: iki nokta / yatay / dikey / hizalı | ✅ | Ölçü çizgisi standart uzaklıklara yakalanır (yeni) |
| Akıllı ölçü: kenar uzunluğu, paralel kenarlar, noktadan kenara | ✅ yeni | |
| Akıllı ölçü: çap / yarıçap | ✅ | Daireye tıklanınca çap, **yaya (radyus, kanal ucu) tıklanınca yarıçap** (yeni); yazı yayın dışındaysa yay uzantısı; ön ek R yarıçapı, Ø çapı yazar |
| Ölçüler modele bağlı (ilişkisel) | ✅ yeni | Model değişince elle ölçüler aynı kenarı/köşeyi/daireyi/yayı bulur, değeri güncellenir; bulunamazsa kırmızı |
| Seçim sırası (nokta–kenar, nokta–daire, kenar–daire) | ✅ yeni | Hangi sırayla seçilirse seçilsin aynı ölçü |
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
| Balon, otomatik balon, parça listesi (BOM) | ✅ | Montaj resminde; balonlar ölçü yazılarına ve çizgilerine binmez, sürüklenir ve gizlenir |
| Görünüşü patlatılmış durumda göster | ✅ yeni | Montaj resminde yalnızca izometrik görünüş; montajda adım yoksa otomatik oluşturulur |
| Kaynak sembolü, delik tablosu, revizyon tablosu | ❌ | Yol haritasında |
| Antet, kağıt boyutu, ölçek | ✅ | A4–A0, yatay/dikey; ölçek listeden veya elle (1:2,5, 3:1); antetli, antetsiz (çerçeveli), yalnızca parça adı ve ölçek, yalnızca parça |
| Çok sayfalı resim | ❌ | Yol haritasında |
| PDF / DXF / resim olarak kaydet | ✅ | PDF, **DXF (yeni)**, SVG, PNG |

## Kullanım

- **Taşıma:** araç seçili değilken görünüşü, ölçüyü, etiketi, notu, detayı, toleransı veya referansı tutup sürükle. Boş yerde sürüklemek sayfayı kaydırır.
- **Seçme / silme:** öğeye tıkla (mavi çerçeve), **Delete**. Otomatik ölçüler, delik etiketleri ve görünüşler gizlenir; soldaki panelde “Gizlenenler → Tümünü geri getir”.
- **Akıllı ölçü:** nokta + nokta; kenar + boş yer (uzunluk); kenar + paralel kenar (aralık); kenar + açılı kenar + yay yeri (açı); kenar + nokta veya nokta + kenar (uzaklık); nokta + daire, kenar + daire (merkeze); daire + yazı yeri (çap); yay + yazı yeri (yarıçap). Ölçüler model değişince güncellenir.
- **2B çizim (Çizim sekmesi):** araç seçilir; çizgi türü şeritten veya soldaki panelden. Çizgi: ardışık tıklamalar zincir çizer, aynı noktaya tıklamak veya Esc zinciri bitirir. Eksen çizgisi: iki nokta veya iki paralel kenar. Daire: merkez + yarıçap noktası (delik dairesi için merkeze ve bir deliğin merkezine tıkla); çap panelden yazılır. Yay: merkez, başlangıç, bitiş (fareyi götürdüğün yönde). Öğe seçilip sürüklenir, çizginin ucu veya dairenin çevresi tutulursa boyu/çapı değişir; Delete siler. Görünüşe bağlı öğelerin uçlarına ve merkezlerine akıllı ölçü verilir.
- **Geometrik tolerans / Referans:** şeritten seç, kenara tıkla; tür, değer ve referans harfleri soldaki panelden.
