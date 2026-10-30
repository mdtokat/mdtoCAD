// Dört makine parçasını toCAD'nin kendi araçlarıyla, bir kullanıcının izleyeceği adımlarla çizer ve proje dosyalarını yazar:
// duz-disli, flansli-boru (+ 90° dirsek), pompa-carki, kademeli-mil (*.tocad.json).
// Kullanım:  npm run build && node ornekler/makine-parcalari-ciz.mjs
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
// örnekler çizimden çıkarken eksik ölçüleri otomatik ekleyerek tam tanımlanır (uygulamada varsayılan kapalı)
await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('tezgah-cad-otomatik-tam-tanimla', '1'); } catch (e) {} });
await page.goto(pathToFileURL(join(here, '..', 'dist', 'index.html')).href);
await page.waitForFunction(() => window.__tz && window.__tz.model);

/* ---------- küçük makro dili: arayüzdeki komutların aynısı ---------- */
const ev = (fn, arg) => page.evaluate(fn, arg);
/** yeni proje ve parça */
async function yeniParca(ad, malzeme) {
  await ev(([ad, malzeme]) => { document.querySelector('[data-m="new"]').click(); const s = __tz.state; s.partName = ad; s.material = malzeme; }, [ad, malzeme]);
}
/** aynı projede yeni parça (ağaçtaki “+ Yeni”) */
async function ekParca(ad, malzeme) {
  await ev(([ad, malzeme]) => { document.querySelector('[data-pa="new"]').click(); const s = __tz.state; s.partName = ad; s.material = malzeme; }, [ad, malzeme]);
}
/** çizim: düzlem seç → Çizim → adımlar → Çizimden çık (eksik ölçüler otomatik eklenir). Çizim kimliğini döndürür. */
async function cizim(on, adimlar) {
  // koordinatlar doğrudan verildiği için ızgaraya yakalama kapatılır (elle çizerken açıktır)
  await ev(on => { __tz.startSketch(on); __tz.sk.opts.grid = false; }, on);
  await page.waitForTimeout(550); // Normal Görünüm animasyonu bitsin (yakalama toleransı ekrandaki ölçeğe bağlı)
  for (const a of adimlar) {
    // küçük ayrıntı (diş) çizmeden önce ekrana sığdır ve fare tekerleğiyle yakınlaş: yakalama toleransı ekranda 9 piksel
    if (a[0] === 'yakinlas') {
      await page.keyboard.press('f'); await page.waitForTimeout(700);
      const [x, y] = await ev(p => __tz.scr(p[0], p[1]), a[1]); await page.mouse.move(x, y);
      for (let i = 0; i < a[2]; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
      await page.waitForTimeout(400); continue;
    }
    await ev(adim, a);
  }
  return ev(() => { const id = __tz.sk.feat.id; __tz.exitSketch(true); return id; });
}
/** tek çizim adımı (sayfada çalışır) */
function adim(a) {
  const T = __tz, sk = T.sk;
  const [k, ...p] = a;
  if (k === 'cizgi') { T.setTool('line'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'merkez') { T.setTool('centerline'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'dikdortgen') { T.setTool('rect'); T.toolClick(...p[0]); T.toolClick(...p[1]); }
  else if (k === 'daire') { T.setTool('circle'); T.toolClick(...p[0]); T.toolClick(p[0][0] + p[1], p[0][1]); }
  else if (k === 'yay3') { T.setTool('arc3'); T.toolClick(...p[0]); T.toolClick(...p[1]); T.toolClick(...p[2]); }
  else if (k === 'kanal') { T.setTool('slot'); T.toolClick(...p[0]); T.toolClick(...p[1]); T.toolClick(p[1][0], p[1][1] + p[2]); }
  // ölçü yazarak çizim: ilk noktaya tıkla, imleci yöne getir, değeri yaz (klavyeden rakam yazmakla aynı)
  else if (k === 'yaz') { const [arac, ilk, yon, deger] = p; T.setTool(arac); T.toolClick(...ilk); sk.cursor = yon; T.applySkInput(deger); }
  // dairesel çizim çoğaltma: daire dışındaki öğeleri (çift tıklamayla zincir seçimi gibi) ya da daireleri seç, adet, Uygula
  else if (k === 'dcogalt') { const ids = sk.feat.ents.filter(e => (p[1] === 'daire') === (e.t === 'circle') && !e.cons).map(e => ({ k: 'ent', id: e.id })); T.selectItems(ids); T.setSkOp('cpat'); sk.op.n = p[0]; T.applySkOp(); }
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
/** Radyus/Pah için kenar: modeldeki kenarlardan koşula uyan ilki (görünümde kenara tıklamakla aynı) */
async function kenar(kosul) {
  return ev(k => { const f = new Function('a', 'b', 'return ' + k); const e = computeEdges(__tz.model.polys, null, true).find(e => e.k === 1 && e.pa && e.pb && f(e.a, e.b));
    if (!e) throw new Error('Kenar bulunamadı: ' + k); return { a: e.a, b: e.b }; }, kosul);
}
async function kontrol(ad) {
  const r = await ev(() => { const m = __tz.model, b = m.box; return { err: m.errors, dof: m.dof,
    box: b && b.min.map((v, i) => +(b.max[i] - v).toFixed(2)), vol: m.props && +m.props.vol.toFixed(0) }; });
  console.log(ad, JSON.stringify(r));
  if (Object.keys(r.err).length) { console.error('  hata:', r.err); process.exitCode = 1; }
  return r;
}
async function kaydet(dosya) {
  const json = await ev(() => JSON.stringify({ app: 'tocad', ...__tz.project, version: 3 }, (k, v) => k.startsWith('_') ? undefined : v, 1));
  writeFileSync(join(here, dosya), json + '\n');
  console.log('Yazıldı:', dosya);
}
const pol = (r, a) => [+(r * Math.cos(a)).toFixed(4), +(r * Math.sin(a)).toFixed(4)];
const R = x => `Math.hypot(${x}[0],${x}[1])`; // kenar koşulları için: z eksenine uzaklık

/* =================== 1) Düz dişli: m = 2, z = 24, α = 20° =================== */
// d = 48, da = 52, df = 43, b = 20. Diş yanakları evolvente yakın 3 noktalı yaylar (taban, bölüm ve baş dairesinden geçer),
// diş başı düz. Taban dairesi ile diş üst üste çizilir (bölge çözümü birleştirir), sonra dişler çizimde dairesel çoğaltılır.
// Göbek Ø40 × 10; Ø25 mil deliği ve 8 × 3,3 kama kanalı (DIN 6885), delik ağızlarında 1 × 45° pah.
await yeniParca('Düz dişli m2 z24', 'steel');
{
  const c = Math.PI / 2, yan = [[21, 0.0804], [24, 0.0654], [26, 0.0275]]; // [yarıçap, diş ekseninden açı]
  const S = yan.map(([r, d]) => pol(r, c - d)), L = yan.map(([r, d]) => pol(r, c + d));
  await cizim({ kind: 'std', key: 'front' }, [
    ['daire', [0, 0], 21.5],
    ['yakinlas', [0, 24], 6],
    ['yay3', L[0], L[2], L[1]], ['cizgi', L[2], S[2]], ['yay3', S[2], S[0], S[1]], ['cizgi', S[0], L[0]],
    ['dcogalt', 24],
  ]);
}
const disli = await ozellik('extrude', { depth: 20, name: 'Dişli gövdesi' });
await cizim({ kind: 'face', feat: disli, which: 'far', sgn: 1 }, [['yaz', 'circle', [0, 0], [10, 0], { D: 40 }]]);
await ozellik('extrude', { depth: 10, name: 'Göbek Ø40' });
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 0], 12.5], ['yakinlas', [0, 10], 3], ['dikdortgen', [-4, 0], [4, 15.8]]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Mil deliği Ø25 ve kama kanalı 8' });
await ozellikPM('chamfer', { name: 'Delik pahları 1×45°', d: 1, edges: [
  await kenar(`Math.abs(a[2]-30)<1e-3&&Math.abs(${R('a')}-12.5)<1e-3&&a[1]<0`),
  await kenar(`Math.abs(a[2])<1e-3&&Math.abs(${R('a')}-12.5)<1e-3&&a[1]<0`)] });
await ozellikPM('chamfer', { name: 'Göbek pahı 1×45°', d: 1, edges: [await kenar(`Math.abs(a[2]-30)<1e-3&&Math.abs(${R('a')}-20)<1e-3`)] });
await kontrol('dişli');
await kaydet('duz-disli.tocad.json');

/* =================== 2) Flanşlı boru DN50 ve 90° dirsek =================== */
// Boru Ø60,3 × 3,9, boy 300; flanş Ø165 × 18, PCD 125 üzerinde 4 × Ø18 (EN 1092-1 PN16). Flanş ve delikleri orta
// düzlemde aynalanır; boru-flanş birleşimlerinde R3.
await yeniParca('Flanşlı boru DN50', 'steel');
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 0], 30.15], ['daire', [0, 0], 26.25]]);
await ozellik('extrude', { depth: 300, name: 'Boru Ø60,3 × 3,9' });
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 0], 82.5], ['daire', [0, 0], 26.25]]);
const flans = await ozellik('extrude', { depth: 18, name: 'Flanş Ø165' });
await cizim({ kind: 'face', feat: flans, which: 'far', sgn: 1 }, [['daire', [62.5, 0], 9], ['dcogalt', 4, 'daire']]);
const delik = await ozellik('cut', { end: 'through', name: 'Flanş delikleri 4 × Ø18' });
const orta = await ozellikPM('plane', { name: 'Orta düzlem', base: 'front', offset: 150, flip: false });
await ozellikPM('mirror', { name: 'Flanşı aynala', targets: [flans, delik], plane: orta });
await ozellikPM('fillet', { name: 'Birleşim radyusları R3', r: 3, edges: [
  await kenar(`Math.abs(a[2]-18)<1e-3&&Math.abs(${R('a')}-30.15)<1e-3`),
  await kenar(`Math.abs(a[2]-282)<1e-3&&Math.abs(${R('a')}-30.15)<1e-3`)] });
await kontrol('boru');
// dirsek: Ø60,3 × 3,9 halka, R = 76 eksen etrafında 90° döndürülür
await ekParca('Dirsek 90° DN50', 'steel');
await cizim({ kind: 'std', key: 'front' }, [['merkez', [0, -50], [0, 50]], ['daire', [76, 0], 30.15], ['daire', [76, 0], 26.25]]);
await ozellik('revolve', { angle: 90, name: 'Dirsek R76' });
await kontrol('dirsek');
await kaydet('flansli-boru.tocad.json');

/* =================== 3) Kapalı pompa çarkı =================== */
// Arka disk Ø200 × 6, göbek Ø60 (diskten 40 mm), 6 geriye eğik kanat (5 mm, yükseklik 30; tek yay çizilip çizimde
// dairesel çoğaltılır, İnce özellikle kalınlaştırılır), ön örtü Ø200 / Ø90 göz × 5, Ø25 mil deliği ve 8 mm kama kanalı.
await yeniParca('Pompa çarkı', 'gg25');
await cizim({ kind: 'std', key: 'top' }, [['yaz', 'circle', [0, 0], [10, 0], { D: 200 }]]);
const disk = await ozellik('extrude', { depth: 6, name: 'Arka disk Ø200' });
await cizim({ kind: 'face', feat: disk, which: 'far', sgn: 1 }, [['yaz', 'circle', [0, 0], [10, 0], { D: 60 }]]);
await ozellik('extrude', { depth: 40, name: 'Göbek Ø60' });
{
  const d = Math.PI / 180;
  await cizim({ kind: 'face', feat: disk, which: 'far', sgn: 1 }, [['yay3', pol(28, 0), pol(96, 70 * d), pol(64, 20 * d)], ['dcogalt', 6]]);
}
await ozellik('extrude', { thin: true, thick: 5, thinSide: 'mid', depth: 30, name: 'Kanatlar' });
const ortuD = await ozellikPM('plane', { name: 'Örtü düzlemi', base: 'top', offset: 36, flip: false });
await cizim({ kind: 'plane', id: ortuD }, [['yaz', 'circle', [0, 0], [10, 0], { D: 200 }], ['yaz', 'circle', [0, 0], [5, 0], { D: 90 }]]);
await ozellik('extrude', { depth: 5, name: 'Ön örtü' });
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 12.5], ['yakinlas', [0, 10], 3], ['dikdortgen', [-4, 0], [4, 15.8]]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Mil deliği Ø25 ve kama kanalı 8' });
await kontrol('çark');
await kaydet('pompa-carki.tocad.json');

/* =================== 4) Kademeli mil =================== */
// Ø25 × 40, Ø35 × 60 (10 × 5 kama kanalı, DIN 6885), Ø40 × 90, Ø50 × 15 omuz, Ø40 × 60 (DIN 471 segman kanalı Ø37,5 × 1,85),
// Ø30 × 40 (Ø6 pim deliği, uçta M10 diş deliği). Uçlarda 1 × 45° pah, omuzlarda R1.
await yeniParca('Kademeli mil', 'c45');
await cizim({ kind: 'std', key: 'front' }, [['merkez', [-10, 0], [315, 0]],
  ['cizgi', [0, 0], [0, 12.5], [40, 12.5], [40, 17.5], [100, 17.5], [100, 20], [190, 20], [190, 25], [205, 25], [205, 20], [265, 20], [265, 15], [305, 15], [305, 0], [0, 0]]]);
await ozellik('revolve', { name: 'Mil gövdesi' });
const kd = await ozellikPM('plane', { name: 'Kama düzlemi', base: 'top', offset: 17.5, flip: false });
await cizim({ kind: 'plane', id: kd }, [['kanal', [50, 0], [90, 0], 5]]);
await ozellik('cut', { end: 'blind', depth: 5, name: 'Kama kanalı 10 × 5' });
await cizim({ kind: 'std', key: 'front' }, [['merkez', [200, 0], [270, 0]], ['yakinlas', [250, 20], 4], ['dikdortgen', [250, 18.75], [251.85, 21]]]);
await ozellik('revcut', { name: 'Segman kanalı' });
await ozellikPM('chamfer', { name: 'Uç pahları 1×45°', d: 1, edges: [
  await kenar(`Math.abs(a[0])<1e-3&&Math.abs(b[0])<1e-3&&Math.abs(Math.hypot(a[1],a[2])-12.5)<1e-3`),
  await kenar(`Math.abs(a[0]-305)<1e-3&&Math.abs(b[0]-305)<1e-3&&Math.abs(Math.hypot(a[1],a[2])-15)<1e-3`)] });
await ozellikPM('fillet', { name: 'Omuz radyusları R1', r: 1, edges: [
  await kenar(`Math.abs(a[0]-40)<1e-3&&Math.abs(b[0]-40)<1e-3&&Math.abs(Math.hypot(a[1],a[2])-12.5)<1e-3`),
  await kenar(`Math.abs(a[0]-100)<1e-3&&Math.abs(b[0]-100)<1e-3&&Math.abs(Math.hypot(a[1],a[2])-17.5)<1e-3`),
  await kenar(`Math.abs(a[0]-265)<1e-3&&Math.abs(b[0]-265)<1e-3&&Math.abs(Math.hypot(a[1],a[2])-15)<1e-3`)] });
await ozellikPM('hole', { name: 'M10 diş deliği', htype: 'tapped', size: 'M10', fit: 'normal', end: 'blind', depth: 25, tdepth: 20,
  on: { kind: 'face', feat: null, which: null, frame: await ev(() => faceFrame([1, 0, 0], [305, 0, 0])) }, pts: [[0, 0]] });
await cizim({ kind: 'std', key: 'front' }, [['daire', [285, 0], 3]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Pim deliği Ø6' });
await kontrol('mil');
await kaydet('kademeli-mil.tocad.json');

await browser.close();
