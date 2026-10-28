# Katkı rehberi

## Geliştirme döngüsü

1. `npm run dev` ile izleme modunda derle.
2. `dist/index.html`'i tarayıcıda aç, değişikliği dene.
3. `npm test` ile testleri çalıştır.
4. Gerekirse `tests/uygulama.spec.js`'e test ekle.

## Kod kuralları

- **Çerçeve yok.** Düz JavaScript, three.js r128 ve tarayıcı API'leri. Yeni bir kütüphane eklemeden önce gerçekten gerekli olup olmadığını düşün; eklenecekse sabit sürümle CDN'den (cdnjs veya jsdelivr) yüklenmeli.
- **Tek dosya çıktısı.** Derleme sonucu tek HTML olmalı; resim, yazı tipi vb. gömülü veya CDN'den gelmeli.
- **Çekirdek DOM'suz kalır.** `src/core/geometry.js` yalnızca THREE kullanır, `document`/`window` kullanmaz. Böylece Node'da veya bir Web Worker'da çalıştırılabilir.
- **Modül sırası önemlidir.** `src/app/*.js` dosyaları ad sırasıyla tek bir fonksiyon kapsamında birleşir. Üst düzey `function` bildirimleri her yerden çağrılabilir; ancak `const`/`let` değişkenleri tanımlandıkları dosya çalışmadan önce kullanılamaz. Aynı adlı iki üst düzey `function` tanımlama (sonraki öncekini sessizce ezer).
- **Arayüz metinleri Türkçe.** SolidWorks'ün Türkçe terimlerine yakın kal (Ekstrüzyon Katman/Taban, Akıllı Ölçülendirme, Eşleştir…).
- **Birimler mm**, açılar arayüzde derece, kodda radyan.
- Ondalık ayırıcı arayüzde virgül; girişlerde hem virgül hem nokta kabul edilir (`num()`).
- Yorumlar Türkçe ve kısa.

## Dosya biçimi değişiklikleri

Proje dosyasının yapısını değiştirirsen:
- `docs/DOSYA-BICIMI.md`'yi güncelle,
- eski dosyaları açabilmek için `normProject`/`normPart` (01-temel.js) içinde dönüşüm ekle,
- gerekiyorsa `version` alanını artır.

## Commit mesajları

Kısa ve açıklayıcı, Türkçe: `Montaj: açı eşleştirmesine ters çevirme eklendi`.
