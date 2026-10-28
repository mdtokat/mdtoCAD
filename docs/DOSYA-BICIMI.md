# Proje dosyası biçimi (sürüm 3)

Proje dosyası (`*.tezgah.json`) ve tarayıcıdaki otomatik kayıt (`localStorage['tezgah-cad-v3']`) aynı JSON yapısını kullanır. Birimler **mm**, açılar **derece**dir. Alt çizgiyle başlayan alanlar (`_err`, `_mp`…) çalışma anına aittir ve kaydedilmez.

```jsonc
{
  "app": "tezgah-cad",
  "version": 3,
  "parts": [ /* Parça */ ],
  "asms":  [ /* Montaj */ ],
  "cur":   { "part": "P1", "asm": "A1", "dw": { "kind": "part" | "asm", "id": "…" } }
}
```

Eski biçimler de açılır: sürüm 2 (tek parça: `{features, partName, material, drawing}`) ve parça dosyası (`{kind: "part", part: {...}}`).

## Parça

```jsonc
{
  "id": "P1",
  "partName": "Yatak gövdesi",
  "material": "steel" | "c45" | "inox" | "al" | "brass" | "gg25" | "abs" | "pom",
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
  "pts":  { "p1": {"x": 0, "y": 0}, ... },          // "O" = orijin (sabit, burada yazılmaz)
  "ents": [ {"id":"e1","t":"line","a":"p1","b":"p2","cons":false},
            {"id":"e2","t":"circle","c":"p3","r":5},
            {"id":"e3","t":"arc","c":"p4","a":"p5","b":"p6"} ],   // yay: a'dan b'ye saat yönünün tersine
  "cons": [ /* İlişki ve ölçüler */ ]
}
```
`cons: true` öğe yapı geometrisidir (profile katılmaz; merkez çizgisi dahil).

**İlişkiler:** `h`, `v` (`e` çizgi veya `p`,`q` nokta) · `pol` nokta-çizgi · `poc` nokta-eğri · `mid` (`p`,`e`) · `par`, `perp`, `coll`, `eq`, `tan` (`e1`,`e2`; `tan` için eğri-eğri `int`) · `sym` (`p`,`q`, eksen `e`) · `fix` (`p`) · `offd` ofset izleyicisi (`e1` kaynak, `e2` ofset, `sg` yön ±1, `dim` sürücü `doff` ölçüsünün id'si) · `tr` doğrusal çoğaltma (`q = p + k·(s − r)`) · `rot` dairesel çoğaltma (`q`, `p`'nin `o` merkezi etrafında `r`→`s` açısının `k` katı döndürülmüşü).

**Ölçüler** (`val` sürücü değer, `lp` etiket konumu `[x,y]`): `d` iki nokta, `dh`/`dv` yatay/dikey, `dpl` nokta-çizgi, `dll` paralel çizgiler, `ddia` çap, `drad` yarıçap, `dang` açı (`r1`,`r2` yön çevirme), `doff` ofset mesafesi (`e1` kaynak, `e2` ofset öğe, `sg` yön ±1).

### `extrude`
```jsonc
{ "type":"extrude", "op":"add"|"cut", "sketch":"s1",
  "end":"blind"|"through"|"mid", "depth":20, "flip":false,
  "dir2":false, "end2":"blind"|"through", "depth2":10 }
```
Malzeme ekleme varsayılan olarak çizim normali yönünde, kesme ters yönde ilerler.

### `revolve`
```jsonc
{ "type":"revolve", "op":"add"|"cut", "sketch":"s1", "axis":"<çizgi id>", "angle":360, "mode":"one"|"mid", "flip":false }
```

### `hole` — Delik Sihirbazı
```jsonc
{ "type":"hole", "htype":"simple"|"clear"|"tapped"|"cbore"|"csink",
  "size":"M3"…"M20", "fit":"fine"|"normal"|"coarse", "dia":10,
  "end":"through"|"blind", "depth":20, "tdepth":16,
  "on": { /* çizimdeki gibi */ }, "pts": [[u, v], ...] }
```

### `fillet` / `chamfer`
```jsonc
{ "type":"fillet", "r":5, "edges":[ {"a":[x,y,z], "b":[x,y,z]} ] }
{ "type":"chamfer", "d":2, "edges":[ ... ] }
```
Kenarlar dünya koordinatında saklanır ve her hesaplamada modeldeki kenarla eşleştirilir. Dairesel kenarlarda dairenin tek bir parçası saklanır.

### Çoğaltma ve aynalama
```jsonc
{ "type":"lpattern", "targets":["x4"], "dir1":"x"|"-x"|"y"|…, "sp1":20, "n1":3, "dir2":"none"|…, "sp2":20, "n2":2 }
{ "type":"cpattern", "targets":[...], "axis":"x"|"y"|"z", "n":6, "angle":360 }
{ "type":"mirror",   "targets":[...], "plane":"front"|"top"|"right"|"<düzlem id>" }
```

### `plane` — referans düzlem
```jsonc
{ "type":"plane", "base":"front"|"top"|"right"|"<düzlem id>", "offset":20, "flip":false }
```

## Montaj

```jsonc
{
  "id":"A1", "name":"Yatak montajı",
  "comps": [ { "id":"c1", "part":"P1", "T":[16 sayı, sütun öncelikli 4×4 matris], "fixed":true, "hidden":false } ],
  "mates": [ { "id":"m1", "name":"Eşmerkezli1",
               "type":"coincident"|"concentric"|"parallel"|"perpendicular"|"distance"|"angle",
               "a": { "comp":"c1", "ref": {"t":"plane","n":[...],"p":[...]} | {"t":"axis","p":[...],"d":[...],"r":13} },
               "b": { ... }, "flip":false, "val":10, "suppressed":false } ],
  "explode": { "on":false, "steps":[ {"id":"x1","comps":["c2"],"dir":"y","dist":80} ] },
  "drawing": { /* teknik resim ayarları + asmView, explode, balloons, bom */ }
}
```
Eşleştirme referansları parçanın kendi koordinatlarındadır.

## Teknik resim ayarları

```jsonc
{
  "paper":"A4"|"A3"|"A2"|"A1"|"A0", "orient":"landscape"|"portrait",
  "method":"E"|"A", "scale":"auto"|"1"|"0.5"|…,
  "hidden":true, "centers":true, "autodims":true, "iso":true,
  "dno":"TZ-0001", "drawn":"", "checked":"", "company":"",
  "section":"none"|"front"|"side", "secOff":0,
  "dims":   [ {"view":"front","p1":[a,b],"p2":[a,b],"kind":"h"|"v"|"a","pos":12,
               "pre":"Ø", "tt":"none"|"sym"|"dev"|"fit", "tu":0.1, "tl":-0.05, "tf":"H7"} ],
  "details":[ {"view":"front","c":[a,b],"r":8,"k":2,"pos":[x,y],"label":"B"} ],
  "surfs":  [ {"view":"top","p":[a,b],"ra":"3,2"} ],
  "notes":  [ {"x":30,"y":200,"text":"…"} ],
  "raDef":"3,2", "noteDef":"…"
}
```
`dims`, `details`, `surfs` içindeki `[a,b]` görünüş koordinatlarıdır (model mm); `details.pos` ve `notes` sayfa koordinatlarıdır (mm, sol üst köşe orijin).
