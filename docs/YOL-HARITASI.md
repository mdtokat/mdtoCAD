# Yol haritası ve bilinen sınırlamalar

## Bilinen sınırlamalar

- **Radyus ve pah** yalnızca düz kenarlarda ve dairesel kenarlarda çalışır; köşelerde üç radyusun birleştiği küresel geçiş üretilmez.
- **Kesit** yalnızca tam kesittir (tek düzlem). Yarım kesit, kademeli kesit yok. Detay görünüşünde tarama ve eksen çizgileri çizilmez.
- **Eşleştirme referansları** parçanın kendi koordinatlarında saklanır; parçada o yüzey taşınırsa eşleştirme kırmızı görünür ve yeniden seçilmelidir.
- **Balon konumları** otomatiktir, elle taşınamaz.
- **STEP/IGES** desteği yok (B-rep çekirdeği gerektirir). STL içe aktarılan parçalar düzenlenemez.
- **Performans:** CSG ana iş parçacığında çalışır. Çok sayıda radyus/delik içeren parçalarda yeniden hesaplama birkaç saniye sürebilir.
- **Tarayıcı belleği:** Otomatik kayıt `localStorage` kullanır (yaklaşık 5 MB). Büyük projeleri `.json` olarak kaydet.
- **Dokunmatik:** Telefonda çalışır, ancak ölçü verme ve eşleştirme fareyle daha rahattır.

## Olası sonraki adımlar

- CSG ve teknik resim hesaplarını bir Web Worker'a taşımak (arayüzün donmasını engeller).
- Yüz/kenar kimliklerini topolojik olarak izlemek (eşleştirme ve radyusların model değişince korunması).
- Kabuk (Shell), Süpürme (Sweep), Loft, Kaburga (Rib), Taslak açısı.
- Çizimde teğet yay, elips, spline, dönüştür (Convert Entities), uzat (Extend).
- Teknik resimde yarım kesit, kırık görünüş, delik tablosu, balonların sürüklenmesi.
- Montajda alt montajlar, dişli/kam eşleştirmeleri, hareket simülasyonu.
- DXF dışa aktarma.
