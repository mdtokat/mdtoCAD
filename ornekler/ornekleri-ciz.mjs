// Eklerdeki üç teknik resmi Tezgâh CAD'in kendi araçlarıyla, bir kullanıcının izleyeceği adımlarla çizer
// ve proje dosyalarını yazar: bukulmus-braket, yatakli-stand, l-destek (*.tezgah.json).
// Kullanım:  npm run build && node ornekler/ornekleri-ciz.mjs
// (Playwright gerekir: npm install. Yerel Chromium için PW_CHROMIUM=/yol/chrome)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const THREE_JS = readFileSync(require.resolve('three/build/three.min.js'), 'utf8');
const ORBIT_JS = readFileSync(join(dirname(require.resolve('three/package.json')), 'examples/js/controls/OrbitControls.js'), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
page.on('pageerror', e => { console.error('Sayfa hatası:', e); process.exitCode = 1; });
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('three.min.js')) return r.fulfill({ body: THREE_JS, contentType: 'application/javascript' });
  if (u.includes('OrbitControls')) return r.fulfill({ body: ORBIT_JS, contentType: 'application/javascript' });
  if (u.includes('fonts.g')) return r.abort();
  return r.continue();
});
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(pathToFileURL(join(here, '..', 'dist', 'index.html')).href);
await page.waitForFunction(() => window.__tz && window.__tz.model);

/* ---------- küçük makro dili: arayüzdeki komutların aynısı ---------- */
const ev = (fn, arg) => page.evaluate(fn, arg);
/** yeni proje ve parça */
async function yeniParca(ad, malzeme) {
  await ev(([ad, malzeme]) => { document.querySelector('[data-m="new"]').click(); const s = __tz.state; s.partName = ad; s.material = malzeme; }, [ad, malzeme]);
}
/** çizim: düzlem seç → Çizim → adımlar → Çizimden çık (eksik ölçüler otomatik eklenir). Çizim kimliğini döndürür. */
async function cizim(on, adimlar) {
  // koordinatlar doğrudan verildiği için ızgaraya yakalama kapatılır (elle çizerken açıktır)
  await ev(on => { __tz.startSketch(on); __tz.sk.opts.grid = false; }, on);
  await page.waitForTimeout(550); // Normal Görünüm animasyonu bitsin (yakalama toleransı ekrandaki ölçeğe bağlı)
  for (const a of adimlar) await ev(adim, a);
  return ev(() => { const id = __tz.sk.feat.id; __tz.exitSketch(true); return id; });
}
/** tek çizim adımı (sayfada çalışır) */
function adim(a) {
  const T = __tz, sk = T.sk;
  const [k, ...p] = a;
  if (k === 'cizgi') { T.setTool('line'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'merkez') { T.setTool('centerline'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'dikdortgen') { T.setTool('rect'); T.toolClick(...p[0]); T.toolClick(...p[1]); }
  else if (k === 'mdikdortgen') { T.setTool('crect'); T.toolClick(...p[0]); T.toolClick(...p[1]); }
  else if (k === 'daire') { T.setTool('circle'); T.toolClick(...p[0]); T.toolClick(p[0][0] + p[1], p[0][1]); }
  else if (k === 'kanal') { T.setTool('slot'); T.toolClick(...p[0]); T.toolClick(...p[1]); T.toolClick(p[1][0], p[1][1] + p[2]); }
  else if (k === 'radyus') { T.setTool('sfillet'); sk.opts.filletR = p[0]; for (const q of p.slice(1)) T.toolClick(q[0], q[1]); }
  else if (k === 'buda') { T.setTool('trim'); for (const q of p) T.toolClick(q[0], q[1]); }
  else if (k === 'olcu') { T.setTool('smartdim'); for (const q of p) T.toolClick(q[0], q[1]); }
  // ölçü yazarak çizim: ilk noktaya tıkla, imleci yöne getir, değeri yaz (klavyeden rakam yazmakla aynı)
  else if (k === 'yaz') { const [arac, ilk, yon, deger] = p; T.setTool(arac); T.toolClick(...ilk); sk.cursor = yon; T.applySkInput(deger); }
  T.setTool(null);
}
/** profil özelliği (Ekstrüzyon / Kesme / Döndürme): çizim seçiliyken komut, PropertyManager alanları, Tamam */
async function ozellik(komut, ayar) {
  return ev(([komut, ayar]) => { const T = __tz; T.cmd(komut); Object.assign(T.pm.draft, ayar); const id = T.pm.draft.id; T.commitPM(); return id; }, [komut, ayar]);
}
/** diğer özellikler (Delik Sihirbazı, Aynala, Radyus…): taslakla PropertyManager açılır, Tamam */
async function ozellikPM(tip, taslak) {
  return ev(([tip, taslak]) => { const T = __tz; const id = tip[0] + Math.random().toString(36).slice(2, 7);
    T.openPM(tip, null, { type: tip, id, ...taslak }); T.commitPM(); return id; }, [tip, taslak]);
}
async function kontrol(ad) {
  const r = await ev(() => { const m = __tz.model, b = m.box; return { err: m.errors, dof: m.dof,
    box: b && b.min.map((v, i) => +(b.max[i] - v).toFixed(2)), vol: m.props && +m.props.vol.toFixed(0) }; });
  console.log(ad, JSON.stringify(r));
  if (Object.keys(r.err).length) { console.error('  hata:', r.err); process.exitCode = 1; }
  return r;
}
async function kaydet(dosya) {
  const json = await ev(() => JSON.stringify({ app: 'tezgah-cad', ...__tz.project, version: 3 }, (k, v) => k.startsWith('_') ? undefined : v, 1));
  writeFileSync(join(here, dosya), json + '\n');
  console.log('Yazıldı:', dosya);
}

/* =================== 1) Bükülmüş braket (resim 1) =================== */
// Ön görünüşteki bükülmüş şerit: 10 mm kalınlık, 50 mm genişlik, 124 genel genişlik, 165 yükseklik.
// Dış kenar çizgisi açık bir zincir olarak çizilir ve İnce özellikle kalınlaştırılır.
await yeniParca('Bükülmüş braket', 'steel');
const s1 = await cizim({ kind: 'std', key: 'front' }, [
  ['cizgi', [-62, -165], [-62, -115], [-34, -79], [-34, 0], [34, 0], [34, -79], [62, -115], [62, -165]],
  ['radyus', 16, [-34, 0], [34, 0]],          // üst köşeler (dış R16, iç R6)
  ['radyus', 16.5, [-34, -79], [34, -79]],     // gövde → eğik bölüm
  ['radyus', 22, [-62, -115], [62, -115]],     // eğik bölüm → ayak
  ['olcu', [-62, -165], [62, -165], [0, -185]],  // 124
  ['olcu', [-34, -40], [34, -40], [0, -30]],     // 68 (gövde dış yüzeyleri)
  ['olcu', [0, 0], [62, -165], [85, -80]],       // 165
]);
await ozellik('extrude', { thin: true, thick: 10, thinSide: 'b', end: 'mid', depth: 50, name: 'Bükülmüş şerit' });
await kontrol('şerit');
// üst göbek Ø38 × 6,5
const s2 = await cizim({ kind: 'std', key: 'top' }, [['yaz', 'circle', [0, 0], [10, 0], { D: 38 }]]);
const gobek = await ozellik('extrude', { depth: 6.5, name: 'Üst göbek Ø38' });
// göbekte Ø9 delik, Ø20 havşa yerine faturalı (özel ölçü)
await ozellikPM('hole', { name: 'Üst delik Ø9 / Ø20', htype: 'cbore', size: 'custom', dia: 9, cbd: 20, cbh: 6.5, fit: 'normal', end: 'through', depth: 20, tdepth: 16,
  on: { kind: 'face', feat: gobek, which: 'far', sgn: 1 }, pts: [[0, 0]] });
// yan kulaklar: Ø38 göbek + 12 mm boyun, R10 geçişler; sağ düzlemden 30 mm ötede başlar (gövde duvarına gömülür)
const s3 = await cizim({ kind: 'std', key: 'right' }, [
  ['daire', [0, -40], 19],
  ['cizgi', [-6, -58.0278], [-6, -70], [6, -70], [6, -58.0278]],
  ['buda', [0, -59]],                       // dairenin boyun içinde kalan yayını buda
  ['radyus', 10, [-6, -58.0278], [6, -58.0278]],
]);
const kulak = await ozellik('extrude', { fromOff: 30, depth: 32, name: 'Yan kulak' });
await ozellikPM('mirror', { name: 'Kulağı aynala', targets: [kulak], plane: 'right' });
// kulak deliği Ø16 (iki yana tümünden geç)
const s4 = await cizim({ kind: 'std', key: 'right' }, [['yaz', 'circle', [0, -40], [5, -40], { D: 16 }]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Kulak deliği Ø16' });
// ayak uçları R25: dikdörtgen + daire, kesilecek bölge tıklanarak seçilir
const s5 = await cizim({ kind: 'std', key: 'right' }, [
  ['dikdortgen', [-30, -170], [30, -140]],
  ['daire', [0, -140], 25],
]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', regions: [[28, -160]], name: 'Ayak ucu R25' });
// ayak delikleri Ø9, dış yüzde Ø18 × 2 faturalı; sol ayağa aynalanır
const ayak = await ev(() => faceFrame([1, 0, 0], [62, -140, 0]));
const delik = await ozellikPM('hole', { name: 'Ayak deliği Ø9 / Ø18', htype: 'cbore', size: 'custom', dia: 9, cbd: 18, cbh: 2, fit: 'normal', end: 'blind', depth: 12, tdepth: 8,
  on: { kind: 'face', feat: null, which: null, frame: ayak }, pts: [[0, -140]] });
await ozellikPM('mirror', { name: 'Ayak deliğini aynala', targets: [delik], plane: 'right' });
await kontrol('braket');
await kaydet('bukulmus-braket.tezgah.json');

/* =================== 2) Yataklı stand (resim 2, izometrik) =================== */
// Taban: 80 × 80 aralıklı dört Ø26 × 9 göbek (Ø16 delikli) ve 9 × 9 kollar. Göbekler ve kollar tek çizimde
// üst üste çizilir; bölge çözümü birleşimi alır, birbirine değmeyen iç daireler delik olur.
// Kolon: 60 × 60, üstü R30; üst yatak ön yüzden 20'şer mm kademeli R20 / R15 / R9 (Döndürme Kesme),
// alt yatak R12 × 20 + R7 (başlangıç ofsetli kesme). Yatak eksenleri tabandan 36 ve 36+80 yükseklikte.
// Ön kutu: 42 genişlikte, 9 et kalınlıklı U profil (İnce özellik).
await yeniParca('Yataklı stand', 'gg25');
const kose = [[-40, -40], [40, -40], [40, 40], [-40, 40]];
await cizim({ kind: 'std', key: 'top' }, [
  ...kose.map(c => ['daire', c, 13]),
  ['dikdortgen', [-30, -44.5], [30, -35.5]], ['dikdortgen', [-30, 35.5], [30, 44.5]],
  ['dikdortgen', [-44.5, -30], [-35.5, 30]], ['dikdortgen', [35.5, -30], [44.5, 30]],
  ...kose.map(c => ['daire', c, 8]),
]);
await ozellik('extrude', { depth: 9, name: 'Taban' });
await kontrol('taban');
// kolon: dikdörtgen + R30 daire birleşimi; ön düzlemin 50 mm gerisinden başlayıp 60 mm
await cizim({ kind: 'std', key: 'front' }, [
  ['dikdortgen', [-30, 0], [30, 125]],
  ['daire', [0, 125], 30],
]);
await ozellik('extrude', { fromOff: -50, depth: 60, name: 'Kolon' });
// üst yatak: sağ düzlemde (u = −z) kademeli yarım profil ve eksen; ön yüz z = 10
await cizim({ kind: 'std', key: 'right' }, [
  ['merkez', [-15, 125], [55, 125]],
  ['cizgi', [-11, 125], [-11, 145], [10, 145], [10, 140], [30, 140], [30, 134], [51, 134], [51, 125], [-11, 125]],
]);
await ozellik('revcut', { name: 'Üst yatak R20 / R15 / R9' });
// alt yatak: R7 tümünden geç, ön yüzden 20 mm R12
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 45], 7]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Alt yatak R7' });
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 45], 12]]);
await ozellik('cut', { fromOff: 10, end: 'blind', depth: 20, name: 'Alt yatak R12' });
// yağ deliği Ø8: üst düzlemden 125 mm yukarıda (yatak ekseninde) başlar, yukarı doğru
await cizim({ kind: 'std', key: 'top' }, [['yaz', 'circle', [0, 0], [5, 0], { D: 8 }]]);
await ozellik('cut', { fromOff: 125, flip: true, end: 'blind', depth: 40, name: 'Yağ deliği Ø8' });
// ön kutu: açık U zinciri (üst düzlemde v = −z), 9 mm et, tabanın üstünden 36 mm
await cizim({ kind: 'std', key: 'top' }, [['cizgi', [-21, -10], [-21, -40], [21, -40], [21, -10]]]);
await ozellik('extrude', { thin: true, thick: 9, thinSide: 'a', fromOff: 9, depth: 36, name: 'Ön kutu (U profil)' });
await kontrol('stand');
await kaydet('yatakli-stand.tezgah.json');

/* =================== 3) L destek (resim 3, izometrik) =================== */
// Yan profil (L): 30 × 10 taban, 7 mm dikme, üstte 13 × 20 başlık; üst kenarlar R5. Genişlik 35.
await yeniParca('L destek', 'al');
await cizim({ kind: 'std', key: 'front' }, [
  ['cizgi', [0, 0], [30, 0], [30, 10], [7, 10], [7, 45], [13, 45], [13, 65], [0, 65], [0, 0]],
  ['radyus', 5, [0, 65], [13, 65]],
]);
await ozellik('extrude', { depth: 35, name: 'L gövde' });
// Ø27 göbek + 6 mm destek kaburgası: üst üste çizilir, tek bölge olarak 8 mm çıkar (dikmenin önünden başlar)
await cizim({ kind: 'std', key: 'right' }, [
  ['daire', [-17.5, 30], 13.5],
  ['dikdortgen', [-20.5, 10], [-14.5, 30]],
]);
const gobek3 = await ozellik('extrude', { fromOff: 7, depth: 8, name: 'Göbek Ø27 ve kaburga' });
await ozellikPM('hole', { name: 'Göbek deliği Ø16', htype: 'simple', size: 'M8', fit: 'normal', dia: 16, end: 'through', depth: 20, tdepth: 16,
  on: { kind: 'face', feat: gobek3, which: 'far', sgn: 1 }, pts: [[-17.5, 30]] });
// taban delikleri Ø10: uçtan 8, kenarlardan 7 (aralarında 21)
const taban = await ev(() => faceFrame([0, 1, 0], [0, 10, 0]));
await ozellikPM('hole', { name: 'Taban delikleri Ø10', htype: 'simple', size: 'M8', fit: 'normal', dia: 10, end: 'through', depth: 20, tdepth: 16,
  on: { kind: 'face', feat: null, which: null, frame: taban }, pts: [[22, -7], [22, -28]] });
// başlıkta 10 genişlikte kanal (merkezler arası 13, uçtan 11)
await cizim({ kind: 'std', key: 'right' }, [['kanal', [-11, 55], [-24, 55], 5]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Kanal 10' });
await kontrol('L destek');
await kaydet('l-destek.tezgah.json');

await browser.close();
