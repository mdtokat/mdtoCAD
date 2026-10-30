# Proje dosyası biçimi (sürüm 3)

Proje dosyası (`*.tocad.json`) ve tarayıcıdaki otomatik kayıt (`localStorage['tezgah-cad-v3']`) aynı JSON yapısını kullanır. Birimler **mm**, açılar **derece**dir. Alt çizgiyle başlayan alanlar (`_err`, `_mp`…) çalışma anına aittir ve kaydedilmez. Uygulamanın eski adıyla (Tezgâh CAD) kaydedilmiş `*.tezgah.json` dosyaları (`"app": "tezgah-cad"`) aynı biçimdedir ve olduğu gibi açılır.

```jsonc
{
  "app": "tocad",
  "version": 3,
  "parts": [ /* Parça */ ],
  "asms":  [ /* Montaj */ ],
  "cur":   { "part": "P1", "asm": "A1", "dw": { "kind": "part" | "asm", "id": "…" } }
}
```

Eski biçimler de açılır: sürüm 2 (tek parça: `{features, partName, material, drawing}`) ve parça dosyası (`{kind: "part", part: {...}}`).

Açılırken veri onarılır (`normProject`, 01-temel.js): bilinmeyen türdeki veya nesne olmayan özellikler atılır, çizimin eksik `on`/`pts`/`ents`/`cons` alanları tamamlanır, yinelenen parça ve özellik kimlikleri yenilenir, liste olması gereken resim alanları (`dims`, `notes`…) boş listeye çevrilir.

## Parça

```jsonc
{
  "id": "P1",
  "partName": "Yatak gövdesi",
  "material": "steel" | "c22" | "c40" | "c45" | "inox" | "al" | "brass" | "bronze" | "gg20" | "gg25" | "abs" | "pom",
  "features": [ /* Özellik, hesaplanma sırasıyla */ ],
  "drawing": { /* Teknik resim ayarları */ },
  "mesh": "…"   // yalnızca STL'den alınan parçalarda: Float32Array (üçgen başına 9 değer) base64
}
```

## Özellikler

Her özellikte `id`, `type`, `name` ve isteğe bağlı `suppressed: true` bulunur.

### `sketch` — çizim
```jsonc
{
  "type": "sketch",
  "on": { "kind": "std", "key": "front" | "top" | "right" }
      | { "kind": "plane", "id": "<referans düzlem id>" }
      | { "kind": "face", "feat": "<ekstrüzyon id>", "which": "far" | "near", "sgn": 1 | -1, "frame": {o,u,v,n} },
  "pts":  { "p1": {"x": 0, "y": 0}, "p7": {"x": 5, "y": 8, "sp": true}, ... },  // "O" = orijin (sabit, burada yazılmaz)
  "ents": [ {"id":"e1","t":"line","a":"p1","b":"p2","cons":false},
            {"id":"e2","t":"circle","c":"p3","r":5},
            {"id":"e3","t":"arc","c":"p4","a":"p5","b":"p6"} ],   // yay: a'dan b'ye saat yönünün tersine
  "cons": [ /* İlişki ve ölçüler */ ]
}
```
`cons: true` öğe yapı geometrisidir (profile katılmaz; merkez çizgisi dahil).
`sp: true` nokta, Nokta aracıyla konmuş tek başına çizim noktasıdır (hiçbir öğeye ait olmasa da silinmez, profile katılmaz).
`ref: true` öğe (her zaman `cons: true`) arkadaki modelin bir kenarından veya başka bir çizimin öğesinden izdüşürülmüş **dış referanstır**: noktaları `fix` ile sabitlenir, referans dairenin yarıçapı çözücüde sabittir. Referans noktalar da `ref: true` (ve `sp: true`) taşıyabilir. Hiçbir ilişki, ölçü veya öğe kullanmayan referanslar çizimden çıkarken silinir.

**İlişkiler:** `h`, `v` (`e` çizgi veya `p`,`q` nokta) · `pol` nokta-çizgi · `poc` nokta-eğri · `mid` (`p`,`e`) · `par`, `perp`, `coll`, `eq`, `tan` (`e1`,`e2`; `tan` için eğri-eğri `int`) · `sym` (`p`,`q`, eksen `e`) · `fix` (`p`) · `offd` ofset izleyicisi (`e1` kaynak, `e2` ofset, `sg` yön ±1, `dim` sürücü `doff` ölçüsünün id'si) · `tr` doğrusal çoğaltma (`q = p + k·(s − r)`) · `rot` dairesel çoğaltma (`q`, `p`'nin `o` merkezi etrafında `r`→`s` açısının `k` katı döndürülmüşü).

**Ölçüler** (`val` sürücü değer, `lp` etiket konumu `[x,y]`): `d` iki nokta, `dh`/`dv` yatay/dikey, `dpl` nokta-çizgi, `dll` paralel çizgiler (`e1` ölçünün alındığı çizgi; `dpl`/`dll`'de `dia: true`: `e`/`e1` merkez çizgisi, değer eksene uzaklığın iki katı — döndürme profilinde çap ölçüsü), `ddia` çap, `drad` yarıçap, `dang` açı (`r1`,`r2` yön çevirme), `doff` ofset mesafesi (`e1` kaynak, `e2` ofset öğe, `sg` yön ±1). `driven: true` ölçü **referans (güdümlü) ölçüdür**: çözücüye girmez, geometriyi sürmez; `val` çizimdeki ölçülen değerdir ve her değişiklikte güncellenir (ekranda parantez içinde). `doff` referans olamaz.

### `extrude`
```jsonc
{ "type":"extrude", "op":"add"|"cut", "sketch":"s1",
  "end":"blind"|"through"|"mid"|"body", "depth":20, "flip":false, // body: Gövdeye kadar (yalnızca add)
  "dir2":false, "end2":"blind"|"through", "depth2":10,
  "fromOff":0,                                   // isteğe bağlı: başlangıç düzleminin çizim normali boyunca ofseti (mm)
  "thin":false, "thick":5, "thinSide":"a"|"b"|"mid", // isteğe bağlı: İnce özellik (zincir bu kalınlıkta şerit olur)
  "regions":[[x,y], ...] }                       // isteğe bağlı: yalnızca bu çizim noktalarını içeren bölgeler
```
Malzeme ekleme varsayılan olarak çizim normali yönünde, kesme ters yönde ilerler. `body` bitişinde uzunluk, profilin noktalarından ilerleme yönünde atılan ışınların gövdeye ilk çarptığı uzaklıkların en büyüğüdür (profil gövdeye tamamen değer). `regions` yoksa çizimin tüm malzeme bölgeleri kullanılır: kapalı konturlar (uç uca bağlı zincirler ve daireler) birbirini kesiyorsa birleşir; bir bölgeyi çevreleyen kontur grubu sayısı tekse bölge malzeme, çiftse boşluktur. İnce özellikte `thinSide` `a` zincirin yürüme yönüne göre sol tarafıdır.

### `revolve`
```jsonc
{ "type":"revolve", "op":"add"|"cut", "sketch":"s1", "axis":"<çizgi id>", "angle":360, "mode":"one"|"mid", "flip":false, "regions":[[x,y]] }
```

### `hole` — Delik Sihirbazı
```jsonc
{ "type":"hole", "htype":"simple"|"clear"|"tapped"|"cbore"|"csink",
  "size":"M3"…"M20"|"custom", "fit":"fine"|"normal"|"coarse", "dia":10,
  "cbd":18, "cbh":2, "csd":18,          // size "custom": fatura çapı/derinliği, havşa çapı (delik çapı "dia")
  "end":"through"|"blind", "depth":20, "tdepth":16,
  "on": { /* çizimdeki gibi */ }, "pts": [[u, v], ...] }
```

### `fillet` / `chamfer`
```jsonc
{ "type":"fillet", "r":5, "edges":[ {"a":[x,y,z], "b":[x,y,z], "sig":{"n":[[nx,ny,nz],[nx,ny,nz]], "f":["x1","x1"]}} ] }
{ "type":"chamfer", "d":2, "edges":[ ... ] }
```
Kenarlar dünya koordinatında saklanır ve her hesaplamada modeldeki kenarla eşleştirilir. Dairesel kenarlarda dairenin tek bir parçası saklanır. `sig` (isteğe bağlı, program yazar) kenarın iki yanındaki yüzeylerin normalleri ve onları oluşturan özelliklerdir: ölçü değişince kenar konumu kayarsa aynı imzalı en yakın kenar kullanılır ve `a`/`b` yeni konuma güncellenir. `sig` olmayan eski dosyalarda ilk hesaplamada eklenir.

### Çoğaltma ve aynalama
```jsonc
{ "type":"lpattern", "targets":["x4"], "dir1":"x"|"-x"|"y"|…|{"d":[x,y,z]}, "sp1":20, "n1":3, "dir2":"none"|…, "sp2":20, "n2":2 }
{ "type":"cpattern", "targets":[...], "axis":"x"|"y"|"z"|{"p":[x,y,z],"d":[x,y,z],"r":30,"feat":"<özellik id>"}, "n":6, "angle":360 }
{ "type":"mirror",   "targets":[...], "plane":"front"|"top"|"right"|"<düzlem id>"|{ "kind":"face", … } }   // yüzey: çizimin "on" alanıyla aynı biçim
```

Doğrusal çoğaltmada `{"d": …}` modelde seçilen düz kenarın yönüdür (dünya koordinatı). Dairesel çoğaltmada nesne biçimindeki eksen modelde seçilen silindir (delik, göbek; `r` yarıçapı ve `feat` onu oluşturan özellik) veya düz kenardır (`r`/`feat` yok); `feat` varsa model her hesaplandığında eksen aynı özelliğin aynı yöndeki ve yarıçaptaki en yakın silindirine kaydırılır (ör. göbeğin konum ölçüsü değişince).

### `plane` — referans düzlem
```jsonc
{ "type":"plane", "base":"front"|"top"|"right"|"<düzlem id>"|{ "kind":"face", … }, "offset":20, "flip":false, "hidden":true }
```
`hidden` (isteğe bağlı): düzlem 3B görünümde gizlidir (ağaçtaki göz düğmesi); yalnızca seçilince, bir işlemde kullanılırken veya çizim için düzlem seçilirken görünür. Modeli etkilemez.
Yüzey tabanı çizimin `on` alanıyla aynı biçimdedir; ekstrüzyonun uç yüzü seçildiyse düzlem o yüzle birlikte taşınır, ofset yüzeyin dışına doğrudur.

## Montaj

```jsonc
{
  "id":"A1", "name":"Yatak montajı",
  "comps": [ { "id":"c1", "part":"P1", "T":[16 sayı, sütun öncelikli 4×4 matris], "fixed":true, "hidden":false },
             { "id":"c9", "part":"P3", "T":[…], "pat":"k1", "seed":"c3", "k":1 } ],   // bileşen çoğaltmasının kopyası
  "mates": [ { "id":"m1", "name":"Eşmerkezli1",
               "type":"coincident"|"concentric"|"parallel"|"perpendicular"|"distance"|"angle",
               "a": { "comp":"c1", "ref": {"t":"plane","n":[...],"p":[...]} | {"t":"axis","p":[...],"d":[...],"r":13} },
               "b": { ... }, "flip":false, "val":10, "suppressed":false,
               "lock":true, "lk":{"a":[x,y,z],"b":[x,y,z]},     // eşmerkezli: dönmeyi kilitle
               "align":true } ],                               // iki düzlem arası mesafe: yüzeyler aynı yöne bakar
  "pats": [ { "id":"k1", "name":"DaireselÇoğaltma1", "type":"circ"|"lin", "seeds":["c3","c4"],
              "ref": { "comp":"c1", "ref": {"t":"axis",…} | {"t":"plane",…} }, "n":4, "angle":360, "sp":50, "rev":false } ],
  "explode": { "on":false, "steps":[ {"id":"x1","comps":["c2"],"dir":"y","dist":80} ] },
  "drawing": { /* teknik resim ayarları + asmView, explode, balloons, bom */ }
}
```
Eşleştirme referansları parçanın kendi koordinatlarındadır. `distance` eşleştirmesinde iki eksen seçildiyse `val` eksenler arası mesafedir, eksen ve düzlemde eksenin düzleme uzaklığıdır (`flip` taraf). İki düzlemde `align` yoksa (eski dosyalar) yalnızca paralellik istenir. `lock` kilitli eşmerkezlide `lk` iki bileşende eksene dik birer yöndür (parça koordinatı); bu yönler paralel kalır.

**Bileşen çoğaltma** (`pats`): dairesel (`circ`) çoğaltmanın ekseni, yönü doğrusal (`lin`) çoğaltmanın bir bileşenin silindir ekseni veya düz yüzeyinin normalidir (`ref`, eşleştirme referansı biçiminde); `n` kaynak dahil adettir, `angle` toplam açı (360: eşit aralık), `sp` doğrusal aralık, `rev` yönü ters çevirir. Kopyalar `comps` içinde `pat`/`seed`/`k` alanlarıyla durur; eşleştirme çözücüsünde serbest değildir, her çözümden sonra kaynaklarının konumundan yeniden hesaplanır. Çoğaltması olmayan kopyalar açılırken atılır.

## Teknik resim ayarları

```jsonc
{
  "paper":"A4"|"A3"|"A2"|"A1"|"A0", "orient":"landscape"|"portrait",
  "method":"E"|"A", "scale":"auto"|"1"|"0.5"|"0.4"|…,   // elle girilen ölçek çarpan olarak (1:2,5 → "0.4")
  "layout":"full"|"frame"|"min"|"none",   // antetli · antetsiz çerçeveli · parça adı ve ölçek · yalnızca parça (yoksa "full")
  "hidden":true, "centers":true, "autodims":true, "iso":true,
  "dno":"TZ-0001", "drawn":"", "checked":"", "company":"",
  "section":"none"|"front"|"top"|"side", "secOff":0, "secType":"full"|"half",
  "dims":   [ {"view":"front","p1":[a,b],"p2":[a,b],"kind":"h"|"v"|"a","pos":12,"at":[true,false],
               "pre":"Ø", "tt":"none"|"sym"|"dev"|"fit", "tu":0.1, "tl":-0.05, "tf":"H7"},
              {"view":"top","kind":"dia","c":[a,b],"r":19,"rad":false,"off":[dx,dy]},          // çap (rad: yarıçap)
              {"view":"front","kind":"ang","v":[a,b],"u1":[x,y],"u2":[x,y],"rr":20,"e1":30,"e2":15} ], // açı
  "gdts":   [ {"view":"front","p":[a,b],"off":[dx,dy],"sym":"flat"|"perp"|…,"tol":"0,05","dia":false,"dat":["A","",""]} ],
  "datums": [ {"view":"front","p":[a,b],"off":[dx,dy],"label":"A"} ],
  "vofs":   { "front":[dx,dy], "top":dy, "side":dx, "iso":[dx,dy] },   // sürüklenen görünüşler (sayfa mm)
  "lbl":    { "<delik gid>":[dx,dy] },                                // elle taşınan otomatik etiketler (daire merkezine göre)
  "bal":    { "<poz no>":[dx,dy] },                                   // montaj resmi: elle taşınan balonlar (otomatik yerine göre)
  "secSkip":[ "<parça id>", … ],                                      // montaj kesitinde kesilmeyen parçalar (cıvata, mil…)
  "hide":   [ "ow:front", "L:<gid>", "V:top", "B:3", … ],             // gizlenen otomatik ölçüler, etiketler, görünüşler, balonlar
  "details":[ {"view":"front","c":[a,b],"r":8,"k":2,"pos":[x,y],"label":"B"} ],
  "surfs":  [ {"view":"top","p":[a,b],"ra":"3,2"} ],
  "notes":  [ {"x":30,"y":200,"text":"…"} ],
  "sk2d":   [ {"t":"line","view":"front"|null,"p":[[a,b],[a,b]],"st":"vis"|"thin"|"hid"|"cen"},   // 2B çizim (teknik resme ait)
              {"t":"circ","view":"top","c":[a,b],"r":40,"st":"cen"},
              {"t":"arc","view":null,"c":[x,y],"r":10,"a0":0,"sw":1.57,"st":"thin"},           // a0 başlangıç açısı, sw süpürme (radyan)
              {"t":"cmark","view":"top","c":[a,b],"r":4.5} ],                                 // merkez işareti
  "skLt":"thin",                                                       // yeni 2B çizim öğelerinin çizgi türü
  "raDef":"3,2", "noteDef":"…"
}
```
`dims`, `details`, `surfs`, `gdts`, `datums` içindeki `[a,b]` görünüş koordinatlarıdır (model mm); `dims.at` ucun bir köşeye/merkeze (true) mi yoksa kenar üstüne mi bağlandığını söyler ve model değişince ölçünün geometriye oturup oturmadığını denetlemekte kullanılır (yoksa yalnızca kenar üstünde olması aranır); `details.pos`, `notes` ve tüm `off`/`vofs` değerleri sayfa koordinatlarıdır (mm, sol üst köşe orijin). `sk2d` öğeleri yalnızca resme aittir (modeli değiştirmez): `view` bir görünüşün adıysa koordinatlar o görünüşün koordinatıdır (model mm; öğe görünüşle taşınır ve ölçeklenir), `null` ise sayfa koordinatıdır (mm); `st` çizgi türü: kalın sürekli, ince sürekli, kesikli (gizli), eksen (zincir). Bozuk öğeler açılırken atılır. `gdts.sym`: `straight`, `flat`, `circ`, `cyl`, `lprof`, `sprof`, `par`, `perp`, `ang`, `pos`, `conc`, `sym`, `run`, `trun`. Yeni alanların hepsi isteğe bağlıdır; eski dosyalar olduğu gibi açılır.
