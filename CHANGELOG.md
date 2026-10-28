# Değişiklik günlüğü

## Yayımlanmamış
- Çizim: eksen (merkez) çizgileri ve yapı (kesikli) çizgileri yalnızca çizim düzenlenirken görünür; çizimden çıkınca 3B görünümde gösterilmez.
- Ağaç: Ekstrüzyon/Döndürme silinince altındaki çizim silinmez, ağaçta ayrı satır olarak kalır; çizim ayrıca silinir. (Bir özelliğin kullandığı çizim silinirse özellik çizimsiz kalmasın diye onunla birlikte silinir.)
- 3B görünüm: fare tekerleği ekran merkezine değil imlecin altındaki noktaya doğru yakınlaştırır/uzaklaştırır (parça, çizim ve montaj).
- Arayüz: sol sütunda üstte tasarım ağacı, bir araç açıkken altında özellik paneli (PropertyManager); teknik resim paneli de solda.
- Çizim: **Budama** kesişen öğeyi kesim noktasında böler ve noktaları paylaştırır; budanan şekiller (örneğin iki dairenin veya iki dikdörtgenin birleşimi) kapalı kontur olarak kalır.
- Çizim: ızgara artık görünür; yakalama yalnızca ızgara çizgilerine yakınken olur, küçük daireler sessizce yok sayılmaz.
- Çizim: **Varlıkları Ofsetle** tüm öğeleri tek bir ofset ölçüsüne bağlar (yeni `doff`/`offd`); ölçü değişince tüm kenarlar birlikte kayar.
- Çizim: doğrusal ve dairesel çizim çoğaltma parametrik (yeni `tr`/`rot` ilişkileri; aralık veya açı ölçüsü değişince kopyalar güncellenir).
- Çizim: **Simetrik** ilişkisi panelden eklenebilir (iki nokta veya iki daire + eksen çizgisi).
- Çizim: çizim radyusu çizgi–yay ve yay–yay köşelerinde de çalışır.
- Çizim: **3 Nokta Yay** ve **Teğet Yay** araçları; öğe kesişimlerine yakalama; çizerken önceki çizgiye dik ve yaya teğet çıkarımı.
- Çizim: boşta uçlar, kesişmeler ve ikiden fazla öğenin birleştiği noktalar kırmızıyla işaretlenir; T-birleşimi için anlaşılır hata mesajı.
- Tam Tanımla: ölçü etiketleri birbirinin, ilişki simgelerinin ve geometrinin üstüne binmeyecek yerlere konur.
- Ölçüler listesi: aynı adlı ölçüler ölçülen öğeyle ayırt edilir; satırın üzerine gelince ölçü çizimde vurgulanır.
- Çizim: **Tam Tanımla** komutu; eksik ölçü ve ilişkiler mevcut geometriden otomatik eklenir.
- Ölçüsüz çizimler çizime girerken ve çıkarken otomatik tam tanımlanır (panelden kapatılabilir).
- Çizim panelinde düzenlenebilir **Ölçüler** listesi.
- Serbestlik derecesi hesabı merkezi farklı Jacobian kullanır (daha kararlı).
- Örnek: Ø813 dört kanatlı disk, teknik resim ölçüleriyle tam tanımlı.

## 0.3.0 — Aşama 3
- Delik Sihirbazı (ISO metrik M3–M20; basit, geçiş, diş, faturalı, havşa; kör/tümünden geç).
- Dairesel kenarlarda radyus ve pah.
- Ölç aracı (parça ve montaj).
- Çizim: budama, varlıkları ofsetle, aynala (simetri ilişkisi), doğrusal/dairesel çizim çoğaltma.
- Teknik resim: kesit A-A (taramalı), detay görünüşü, tolerans (±, sapma, geçme), yüzey işareti, notlar, diş gösterimi, delik etiketleri.
- Claude dışında standart tarayıcı indirmesi (GitHub Pages desteği).

## 0.2.0 — Aşama 2
- Girişim algılama, patlatılmış görünüm.
- Montaj resmi: balonlar ve parça listesi; montaj PDF'i.

## 0.1.0 — Aşama 1
- Çok parçalı proje yapısı; montaj, eşleştirmeler, montaj ağacı.
- STL dışa/içe aktarma.

## 0.0.x — Temel
- SolidWorks tarzı çizim → özellik iş akışı, kısıt çözücü.
- Teknik resim, PDF (A4–A0, üç sayfa düzeni).
