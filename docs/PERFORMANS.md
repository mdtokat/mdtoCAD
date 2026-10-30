# Performans çalışması: donmalar, nedenleri ve çözümler

Bu belge, basit bir kademeli milde bile her işlemde “Sayfa yanıt vermiyor” uyarısına varan donmaların ölçümünü,
nedenlerini, yapılan iyileştirmeleri ve değerlendirilen diğer seçenekleri anlatır.

## 1. Ölçüm

Örnek: 5 kademeli Ø150 / Ø167 / Ø150 / Ø146 / Ø115 mil (5 ekstrüzyon), 3 radyus (4 dairesel kenar), bir referans düzlem
ve kama kanalı (kesme ekstrüzyon). Toplam 16 özellik.

### Özellik başına yeniden hesaplama (Node.js, aynı makine)

| Ağaç şuraya kadar | Önce: süre | Önce: çokgen | Sonra: süre | Sonra: çokgen |
|---|---:|---:|---:|---:|
| Ekstrüzyon5 (5 silindir) | 0,2 s | 1 921 | 0,1 s | 578 |
| Radyus1 | 2,7 s | 18 376 | 0,7 s | 1 901 |
| Radyus2 | 5,3 s | 25 297 | 1,0 s | 2 458 |
| Radyus3 | 10,2 s | 34 110 | 1,6 s | 3 192 |
| Kesme-Ekstrüzyon1 (tamamı) | **11,9 s** | **34 170** | **1,7 s** | **3 217** |

Süreler önbelleksiz, ağacın baştan hesabıdır. Önbellekle sona eklenen ya da düzenlenen özellik yalnızca kendi süresini harcar
(ör. kama kanalını değiştirmek ≈ 0,4 s). Eğri çözünürlüğü 32 seçilince tamamı 0,8 s.

Hacim (27 913 320 mm³) ve yüzey alanı (816 348 mm²) önce ve sonra aynıdır. Tüm `ornekler/` parçalarında hacim, alan ve
kenar uzunlukları birebir aynı çıktı.

### Arayüzde tek işlem süresi (Chromium, aynı makine)

| İşlem | Önce | Sonra |
|---|---:|---:|
| Projeyi açınca ilk hesap | 5,1 s | 0,5 s |
| Kanal çizimini düzenlemeye girmek (ilk kez) | 4,9 s | 1,1 s* |
| Çizimden değiştirmeden çıkmak | 5,4 s | 0,2 s |
| Radyusu düzenlemek (paneli açmak) | 2,3 s | 0,2 s |
| Radyus panelini onaylamak | 4,6 s | 0,2 s |
| Yeni boş çizimden çıkmak | 4,7 s | 0,4 s |
| Teknik resim sekmesine geçmek | 1,8 s | 0,5–0,8 s |

\* Proje açıldıktan sonraki ilk girişte bir defalık gölgelendirici derlemesi (~0,2 s) ve çizimi kullanan özelliğin bastırıldığı
ağacın hesabı (bu ağaç henüz önbellekte değildir; radyus kenarları da ilk hesapta yeni konumlarına yazıldığı için bir kez baştan
hesaplanır) eklenir.

Bu makine, kullanıcının bilgisayarından birkaç kat hızlı olabilir: burada 5 sn süren her işlem, daha yavaş bir dizüstünde
15–30 sn sürüp tarayıcının “Sayfa yanıt vermiyor” uyarısını tetikler. Aynı oran korunduğu için iyileştirilmiş sürelerin
orada da 1 sn civarında kalması beklenir.

## 2. Nedenler

1. **Her işlemde tüm özellik ağacı baştan hesaplanıyordu.** Çizimden değişiklik yapmadan çıkmak, bir paneli açmak,
   sona özellik eklemek — hepsi 16 özelliği, en pahalısı olan üç radyusu da yeniden hesaplatıyordu.
2. **CSG çokgen sayısını katlıyordu.** BSP tabanlı birleştirme/çıkarma, bir gövdenin çokgenlerini diğerinin bütün
   düzlemleriyle böler. Bölünen parçaların hepsi sonuçta kalsa bile yeniden birleştirilmiyordu. Her radyus, çokgen sayısını
   ~6 bin artırıyordu (1 921 → 34 110). BSP kurulumu ve kırpma çokgen sayısıyla neredeyse karesel büyüdüğünden her
   sonraki işlem daha da yavaşlıyordu; kenar çıkarma, gölgeli ağ, teknik resim de bu 34 bin çokgenle çalışıyordu.
3. **Aracın kendi BSP'si de parçalanıyordu.** Radyus halkası (768 çokgen) kendi BSP ağacında 4 778 parçaya bölünüp
   sonra bu parçalar tek tek gövdenin BSP'sinden geçiriliyordu (kırpma süresinin %80'i).
4. **Üçgenler:** Ekstrüzyonun Ø150 daire kapağı 62 ayrı uzun ince üçgen, yan yüzeyin her dikdörtgeni iki üçgendi.
   İnce uzun üçgenler BSP'de çok daha fazla bölünür.
5. **Ekran sürekli yeniden çiziliyordu:** model hareketsizken de saniyede 60 kare; dizüstünde ekran kartı ve işlemci boşuna meşgul.
6. Her yeniden hesaplamada tüm çizimlerin serbestlik derecesi (Jacobian rütbesi) yeniden hesaplanıyordu.

## 3. Yapılanlar

### Geometri çekirdeği (`src/core/geometry.js`)
- **Yeniden birleştirme (rejoin):** BSP bölmesinde her parça bölünen çokgeni hatırlar; bir çokgenin bütün parçaları sonuçta
  kaldıysa parçalar yerine çokgenin kendisi konur (aşağıdan yukarı, yön denetimiyle). Geometri birebir aynıdır.
- **Düzlemsel birleştirme (`mergeCoplanar`):** aynı özellikten gelen, aynı düzlemdeki komşu çokgenler birleşimleri dışbükey
  kaldıkça tek çokgende toplanır (daire kapağı tek 64-gen, yan yüzey dörtgenler). Araç gövdelerine ve her CSG sonucunun
  değişen kısmına uygulanır. Dışbükeylik, köşe dönüşleri ve toplam dönüşün tam tur olmasıyla denetlenir.
- **Araç bölünmeden kırpılır:** aracın çokgenleri kendi BSP'sinde parçalanmış hâlleri yerine bölünmemiş hâlleriyle gövdenin
  BSP'sinden geçirilir (aynı sonuç, 5–6 kat az parça).
- **Sınır küresi ile hızlı sınıflandırma:** çokgenin sınır küresi düzlemin tek tarafındaysa köşelere bakılmaz
  (bölme testlerinin ~%70'i böyle biter).
- **Yeniden oluşturma önbelleği:** her özellikten sonraki ara durum, o özelliğe kadarki ağacın özetiyle (hash zinciri)
  saklanır. Yeniden hesaplamada eşleşen en uzun baştaki kısım atlanır; yalnızca değişen özellik ve sonrası hesaplanır.
  Geri al/yinele, panel açıp iptal etmek, çizime girip çıkmak önbellekten gelir. Bütçe çokgen sayısıyladır (en eski atılır).
  Önbellekli ve önbelleksiz sonuçlar 515 senaryoda (bastırma, kısmi ağaç, ölçü değiştirme, küçük bütçe) aynı çıktı.
- **Eğri çözünürlüğü değişkeni (`CURVE_SEG`):** daire, yay, döndürme, delik ve dairesel radyuslar aynı parça sayısını kullanır.
- **Dairesel kenarın çemberle bulunması:** radyus/pah kenarı konumla bulunamazsa (ör. çözünürlük değişti) aynı çember üzerinde,
  aynı özelliklerin yüzeyleri arasındaki en yakın kenar alınır.

### Arayüz
- **Ayarlar penceresi** (üst çubuktaki ⚙ veya Dosya → Ayarlar). Bkz. bölüm 4.
- **Akıllı ekran yenileme:** görünüm yalnızca kamera, girdi veya sahne değişince tam hızla çizilir; boştayken saniyede 4 kare.
- Aynı gövde yeniden gösterilirken (önbellekten gelen sonuç) gölgeli ağ ve kenarlar yeniden kurulmaz.
- Çizimlerin serbestlik derecesi çizim değişmedikçe yeniden hesaplanmaz.

### Kısıt çözücü (çizim)

Çizimde her fare hareketinde (sürükleme), her ölçü/ilişki eklemede ve çizime girip çıkarken kısıt çözücü çalışır. Önceki çözücü
tüm değişkenler için yoğun (dense) matrislerle çalışıyordu: Jacobian her adımda bütün artıkları her değişken için yeniden
hesaplıyor, normal denklemler tam Gauss eliminasyonuyla çözülüyor, aşırı tanımlama denetimi ve otomatik tam tanımlama her aday
kısıt için bütün matrisin rütbesini baştan buluyordu. 144 noktalı dişli çiziminde (Node.js, ortanca):

| İşlem | Önce | Sonra |
|---|---:|---:|
| Bir noktayı sürüklemek (tek kare) | 930 ms | 38 ms |
| Serbestlik analizi (her değişiklikte) | 121 ms | 11 ms |
| Otomatik tam tanımlama (çizime giriş/çıkış) | 4,1 s | 40 ms |

- **Seyrek Jacobian:** her artığın okuduğu değişkenler bir kez bulunur (`resDeps`); türev yalnızca bu değişkenler için alınır.
- **Alt sistemler:** birbirine bağlı olmayan değişken grupları ayrı çözülür; değişmeyen gruplara dokunulmaz (`sysComps`).
- **Seyrek Cholesky:** normal denklemler az bağlı değişkenler önce gelecek sırayla çarpanlara ayrılır (`cholSolve`).
- **Artımlı rütbe:** satırlar basamak biçimindeki bir tabana tek tek eklenir (`basisAdd`); aday kısıt yalnızca tabana göre indirgenir.
  Aynı taban, eklenen ölçünün hangi mevcut ölçü/ilişkilerin birleşimi olduğunu da verir (çelişkide sarı gösterilenler).
- **Sürükleme kare başına bir kez çözülür:** hızlı fare hareketinde olaylar birikip arayüzü kilitlemez.

Örneklerin 58 çiziminde serbestlik derecesi, tanımlı noktalar, rütbe, otomatik tam tanımlamanın eklediği ölçü/ilişkiler ve
ölçü değişikliği sonrası nokta konumları önceki çözücüyle birebir aynıdır.

## 4. Ayarlar

Ayarlar tarayıcıda saklanır (`localStorage`, anahtar `tocad-ayarlar-v1`), proje dosyasına yazılmaz.

| Ayar | Seçenekler | Etkisi |
|---|---|---|
| Performans profili | Kalite / **Dengeli** / Hızlı | Aşağıdakileri birlikte ayarlar; tek bir ayar değişince “Özel” olur |
| Çözünürlük (piksel oranı) | **Ekran** / 1,5× / 1× / 0,75× | 4K/Retina ekranda 1×, ekran kartının yükünü 2–4 kat azaltır |
| Kenar yumuşatma | **Açık** / Kapalı | Zayıf ekran kartında kare hızı; sayfa yenilenince uygulanır |
| Ekran yenileme | Sürekli / **Akıllı** | Akıllı: boştayken neredeyse hiç kaynak harcanmaz |
| Eğri çözünürlüğü | **Yüksek (64)** / Orta (48) / Düşük (32) | Düşük, model hesabını 2–3 kat hızlandırır; eğriler köşeli, hacim binde birkaç değişir |
| Yeniden hesaplama önbelleği | Kapalı / 64 / **128** / 256 / 512 MB | Yalnızca değişen özellik ve sonrası hesaplanır |
| Canlı önizleme | Anında / **Normal** / Gecikmeli | Ağır parçada değer yazarken takılmayı önler |
| Teknik resim gizli çizgi hassasiyeti | Yüksek / **Normal** / Düşük | Derinlik arabelleği 2048² / 1024² / 512² |

Profiller:

| | Kalite | Dengeli (varsayılan) | Hızlı |
|---|---|---|---|
| Piksel oranı | Ekran | Ekran | 1× |
| Kenar yumuşatma | Açık | Açık | Kapalı |
| Ekran yenileme | Sürekli | Akıllı | Akıllı |
| Eğri çözünürlüğü | 64 | 64 | 32 |
| Önbellek | 256 MB | 128 MB | 128 MB |
| Canlı önizleme | Normal | Normal | Gecikmeli |
| Gizli çizgi | Yüksek | Normal | Normal |

Dengeli profil, eğri çözünürlüğü ve teknik resim hassasiyetinde eski davranışla aynıdır; yani dosyalar aynı geometriyi verir.

Pencerede **Performans bilgisi** bölümü son hesap süresini, çokgen sayısını, önbellek kullanımını ve isabet oranını, ekran
kartının adını gösterir. Tarayıcı ekran kartını kullanmıyorsa (SwiftShader, llvmpipe, “Microsoft Basic Render”) uyarır:
donanım hızlandırması kapalı bir tarayıcıda 3B görünüm ve teknik resim çok yavaştır ve bu, uygulamanın içinden
düzeltilemez (Chrome/Edge: Ayarlar → Sistem → “Kullanılabilir olduğunda grafik hızlandırmayı kullan”).

## 5. Değerlendirilen diğer seçenekler

| Seçenek | Kazanç | Maliyet / risk | Karar |
|---|---|---|---|
| **Hesabı Web Worker'a taşımak** | Arayüz hiç donmaz; ilerleme göstergesi ve iptal mümkün olur | `rebuildModel` arayüzde 10'dan fazla yerde eşzamanlı çağrılıyor (panel açma, çizime girme, montaj, teknik resim); hepsinin eşzamansıza çevrilmesi ve çokgenlerin aktarılabilir dizilere çevrilmesi gerekir. Toplam hesap süresini kısaltmaz | Sonraki adım. Bu çalışmadan sonra tipik işlemler 0,2–0,5 sn olduğu için öncelik düştü; çok sayıda radyus/delikli büyük parçalarda yine gerekli olacak |
| **WebAssembly CSG çekirdeği** (ör. manifold-3d) | Boolean işlemleri 10–100 kat hızlı, sağlam (manifold) sonuç | Yeni ~1 MB bağımlılık, tek dosya HTML yapısı korunmalı; yüz kimlikleri (`shared`), kenar imzaları, kesit ve girişim kodu yeni veri yapısına uyarlanmalı | Uzun vadede en büyük kazanç. Ayrı bir geçiş projesi olarak önerilir |
| **B-rep çekirdeği** (OpenCascade.js) | Gerçek yüzeyler, STEP/IGES, teğet sürekli radyuslar | ~10 MB+ WASM, öğrenme ve geçiş maliyeti çok yüksek | Bu ölçekte uygun değil |
| **Daha iyi BSP bölücü seçimi** | Bazı modellerde ağaç derinliği azalır | Silindir gibi dışbükey gövdelerde her yüzey düzlemi diğerlerini aynı tarafta bırakır; ağaç zincir olur, kazanç az | Yapılmadı |
| **Gövdenin yalnızca araç kutusundaki kısmıyla BSP** | Kırpma çok daha ucuz | Kapalı olmayan yüzey kümesiyle kurulan BSP bazı noktaları yanlış sınıflandırıyor (çekirdekte belgeli); kutuyla kesişimin kapatılması 2B Boolean gerektirir | Yapılmadı |
| **Eğri çözünürlüğünü varsayılan olarak düşürmek** | 2–3 kat hızlı hesap | Görünüm ve hacimde küçük fark, eski dosyalarla aynı geometri garanti edilmez | Ayar olarak sunuldu, varsayılan değişmedi |
| **Önizlemeyi kapatmak** | Panel yazarken hesap yok | Kullanıcı sonucu görmeden onaylar | Gecikmeli önizleme ayarı yeterli |
| **Ekran yenilemeyi tamamen olay güdümlü yapmak** | Boştayken sıfır kare | Sahneyi değiştiren her yerin bildirmesi gerekir; kaçan bir güncelleme eski görüntü bırakır | Akıllı kip: olaylar + boştayken 4 kare güvencesi |
| **Seviye ayrıntısı (LOD), görünüm kırpma** | Çok büyük montajlarda kare hızı | 10–20 parçalı montajlarda çizim maliyeti zaten küçük | Gerek yok |
| **Teknik resim görünüşlerini önbellekte tutmak** | Sekme geçişleri hızlı | Zaten görünüş başına önbellekte | Mevcut |

## 6. Öneriler (kullanım)

- Zayıf veya eski bir bilgisayarda **Ayarlar → Hızlı** profilini seçin.
- Tarayıcıda donanım hızlandırmasının açık olduğundan emin olun (Ayarlar → Performans bilgisi → Ekran kartı).
- Radyusları ağacın sonuna doğru eklemek, sonradan yapılan ölçü değişikliklerinde yeniden hesabı kısaltır
  (önbellek, değişen özellikten önceki kısmı atlar).
- Çok büyük parçalarda kullanmadığınız özellikleri bastırmak hesabı hızlandırır.
