# Yol haritası ve bilinen sınırlamalar

## Bilinen sınırlamalar

- **Radyus ve pah** kenarları yüz normalleri ve özellik kimlikleriyle izlenir; bir ölçü değişikliği aynı yöne bakan iki benzer kenarın yerini değiştirirse en yakını seçilir. Radyus ve pah yalnızca düz kenarlarda ve dairesel kenarlarda çalışır; köşelerde üç radyusun birleştiği küresel geçiş üretilmez.
- **Kesit** tek düzlemlidir (tam veya yarım); kademeli ve döndürülmüş (hizalı) kesit, kısmi kesit yok. Kesit düzlemi görünüşün ortasından geçer (kaydırılabilir), istenen çizgiye çizilemez.
- **Teknik resimde akıllı ölçü** görünüşteki noktalara, dairelere ve düz kenarlara bağlanır; ölçüler modele bağlı değildir; model değişince geometriye artık oturmayan ölçüler ekranda kırmızı ve panelde ⚠ ile işaretlenir, yeniden eklenmelidir. Yay (kısmi daire) kenarlarında yarıçap ölçüsü yok.
- **Eşleştirme referansları** parçanın kendi koordinatlarında saklanır. Parça değişince referans yüzey/eksen aynı özelliğin oluşturduğu, aynı yöndeki en yakın yüzeye/eksene taşınır; böyle bir yüzey kalmazsa eşleştirme kırmızı görünür ve yeniden seçilmelidir.
- **Balonlar** otomatik yerleşir; sürüklenerek taşınır ve gizlenebilir, ancak balonun gösterdiği nokta (ok ucu) değiştirilemez. Yüzey işaretleri sürüklenemez (silinip yeniden eklenir).
- **Bileşen çoğaltma** kopyaları ayrıca eşleştirilemez ve tek tek silinemez; kaynakla birlikte hareket eder. SolidWorks'teki “özellik güdümlü” (parçadaki delik çoğaltmasını izleyen) çoğaltma yok.
- **Eşleştirme seçimi** yalnızca düz yüzeyler (düzlem) ve silindirler (eksen) içindir; kenar, köşe ve teğet eşleştirmesi yok. Arkada kalan yüzey Alt + tıklama ile seçilir (bir sonraki bileşenin öndeki yüzeyi).
- **Bölge seçimi** tıklanan noktaları çizim koordinatında saklar; çizim ölçüleri bölgeyi o noktadan uzaklaştıracak kadar değişirse bölge yeniden seçilmelidir.
- **İnce özellik** dallanmayan zincirlerle çalışır; köşeler sivri (gönye) birleşir, yay yarıçapı kalınlıktan küçük olamaz.
- **Döndürme parçalarının teknik resmi:** çaplar görünüşün içine yazılır; eksen düşeyse (ör. kasnak) ve kesit açılınca çap yazıları taramanın üstüne biner, delik çapları (Ø20, Ø30) gizli kaldığından yazılmaz. Milde genel yükseklik (12) ile en büyük çap (Ø12) ikisi birden yazılır. Gerekirse ölçü seçilip Delete ile gizlenir, akıllı ölçüyle eklenir.
- **Çok küçük kademeler** (ör. 82 mm milde 1 mm omuz) ekran yakınlığında tıklanarak çizilemez (nokta yakalama yarıçapı ~9 px): kademe abartılı çizilip çap ölçüsüyle düzeltilir veya görünüm yakınlaştırılır.
- **STEP/IGES** desteği yok (B-rep çekirdeği gerektirir). STL içe aktarılan parçalar düzenlenemez.
- **Performans:** CSG ana iş parçacığında çalışır. Yeniden hesaplama önbelleği yalnızca değişen özellik ve sonrasını hesaplar; yine de ağacın başındaki bir ölçü değişince çok sayıda radyus/delik içeren parçalarda hesap bir saniyeyi aşabilir. Zayıf bilgisayarlarda Ayarlar → Hızlı profili önerilir. Ayrıntılar: [PERFORMANS.md](PERFORMANS.md).
- **Tarayıcı belleği:** Otomatik kayıt `localStorage`'a (yaklaşık 5 MB) ve tarayıcı veritabanına (IndexedDB) yazılır; tarayıcı deposu dolsa da veritabanındaki kayıt açılışta geri gelir. İki sekmede aynı proje açıksa son değiştiren diğerinin kaydının üzerine yazar (uyarılır; önceki sürümler saklanır). Tarayıcının site verisini silmesine karşı projeyi Ctrl+S ile dosyaya da kaydet.
- **Dokunmatik:** Telefonda çalışır, ancak ölçü verme ve eşleştirme fareyle daha rahattır.

## Olası sonraki adımlar

- Çizimde SolidWorks'teki SketchXpert gibi çelişkiyi otomatik çözme önerileri (şimdi çelişen ölçüler sarı gösterilir, biri referansa çevrilebilir).
- CSG ve teknik resim hesaplarını bir Web Worker'a taşımak (arayüzün donmasını tamamen engeller, ilerleme ve iptal); uzun vadede WebAssembly CSG çekirdeği (ör. manifold-3d). Değerlendirme: [PERFORMANS.md](PERFORMANS.md#5-değerlendirilen-diğer-seçenekler).
- Yüz/kenar kimliklerini topolojik olarak izlemek (eşleştirme ve radyusların model değişince korunması).
- Kabuk (Shell), Süpürme (Sweep), Loft, Kaburga (Rib), Taslak açısı.
- Çizimde elips, spline, metin, nokta aracı, dönüştür (Convert Entities), uzat (Extend), çizerken açı yazma (uzunluk, genişlik/yükseklik ve çap yazılabiliyor).
- Döndürmede ince özellik; ekstrüzyonda “bir sonrakine kadar” / “yüzeye kadar” bitiş koşulları.
- Teknik resimde (SolidWorks'te olup burada olmayanlar): yardımcı görünüş, kırık görünüş, kısmi kesit, kırpılmış görünüş, kademeli/hizalı kesit, delik tablosu, revizyon tablosu, çok sayfalı resim, kaynak sembolü.
- Montajda alt montajlar, dişli/kam eşleştirmeleri, özellik güdümlü bileşen çoğaltma, hareket simülasyonu.
- DXF dışa aktarma.
