// Üç montajı toCAD'nin kendi araçlarıyla, bir kullanıcının izleyeceği adımlarla kurar ve proje dosyalarını yazar:
// flansli-kaplin (göbekler, cıvata + somun ve dairesel bileşen çoğaltma, miller), mentese (aynı parçadan iki kanat, pim,
// açı eşleştirmesi), disli-cifti (taban, iki mil, ornekler/duz-disli'den içe aktarılan iki dişli, eksen aralığı 48 mm).
// Kullanım:  npm run build && node ornekler/montajlar-ciz.mjs
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

/* ---------- küçük makro dili: arayüzdeki komutların aynısı (ornekler/makine-parcalari-ciz.mjs ile aynı) ---------- */
const ev = (fn, arg) => page.evaluate(fn, arg);
async function yeniParca(ad, malzeme) {
  await ev(([ad, malzeme]) => { document.querySelector('[data-m="new"]').click(); const s = __tz.state; s.partName = ad; s.material = malzeme; }, [ad, malzeme]);
}
async function ekParca(ad, malzeme) {
  await ev(([ad, malzeme]) => { document.querySelector('[data-pa="new"]').click(); const s = __tz.state; s.partName = ad; s.material = malzeme; }, [ad, malzeme]);
}
async function cizim(on, adimlar) {
  await ev(on => { __tz.startSketch(on); __tz.sk.opts.grid = false; }, on);
  await page.waitForTimeout(550);
  for (const a of adimlar) await ev(adim, a);
  return ev(() => { const id = __tz.sk.feat.id; __tz.exitSketch(true); return id; });
}
function adim(a) {
  const T = __tz, sk = T.sk;
  const [k, ...p] = a;
  if (k === 'cizgi') { T.setTool('line'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'merkez') { T.setTool('centerline'); for (const q of p) T.toolClick(q[0], q[1]); T.setTool(null); }
  else if (k === 'dikdortgen') { T.setTool('rect'); T.toolClick(...p[0]); T.toolClick(...p[1]); }
  else if (k === 'mdikdortgen') { T.setTool('crect'); T.toolClick(...p[0]); T.toolClick(...p[1]); }
  else if (k === 'daire') { T.setTool('circle'); T.toolClick(...p[0]); T.toolClick(p[0][0] + p[1], p[0][1]); }
  // çokgen: paneldeki kenar sayısı, merkez ve bir köşe
  else if (k === 'cokgen') { T.setTool('polygon'); sk.opts.polyN = p[2]; T.toolClick(...p[0]); T.toolClick(p[0][0] + p[1], p[0][1]); }
  else if (k === 'dcogalt') { const ids = sk.feat.ents.filter(e => (p[1] === 'daire') === (e.t === 'circle') && !e.cons).map(e => ({ k: 'ent', id: e.id })); T.selectItems(ids); T.setSkOp('cpat'); sk.op.n = p[0]; T.applySkOp(); }
  T.setTool(null);
}
async function ozellik(komut, ayar) {
  return ev(([komut, ayar]) => { const T = __tz; T.cmd(komut); Object.assign(T.pm.draft, ayar); const id = T.pm.draft.id; T.commitPM(); return id; }, [komut, ayar]);
}
async function ozellikPM(tip, taslak) {
  return ev(([tip, taslak]) => { const T = __tz; const id = tip[0] + Math.random().toString(36).slice(2, 7);
    T.openPM(tip, null, { type: tip, id, ...taslak }); T.commitPM(); return id; }, [tip, taslak]);
}
async function kenar(kosul) {
  return ev(k => { const f = new Function('a', 'b', 'return ' + k); const e = computeEdges(__tz.model.polys, null, true).find(e => e.k === 1 && e.pa && e.pb && f(e.a, e.b));
    if (!e) throw new Error('Kenar bulunamadı: ' + k); return { a: e.a, b: e.b }; }, kosul);
}
async function kontrol(ad) {
  const r = await ev(() => { const m = __tz.model, b = m.box; return { err: m.errors, box: b && b.min.map((v, i) => +(b.max[i] - v).toFixed(2)), vol: m.props && +m.props.vol.toFixed(0) }; });
  console.log(ad, JSON.stringify(r));
  if (Object.keys(r.err).length) { console.error('  hata:', r.err); process.exitCode = 1; }
}
/* ---------- montaj ---------- */
async function yeniMontaj(ad) {
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  await page.keyboard.press('Escape');
  await ev(ad => { __tz.curAsm().name = ad; }, ad);
}
async function bilesen(parcaAd) {
  return ev(ad => { const p = __tz.project.parts.find(p => p.partName === ad); __tz.addComp(p.id); const a = __tz.curAsm(); __tz.asmUI.sel = null; return a.comps[a.comps.length - 1].id; }, parcaAd);
}
/* eşleştirme: Eşleştir panelinde iki seçim (ekranda yüzeye tıklamakla aynı: bileşenin yerel noktasındaki silindir 'a' veya
   n normalli düz yüzey), tür, seçenekler (hizalamayı/ölçüyü ters çevir, dönmeyi kilitle, değer), Enter. Panel açık kalır */
async function eslestir(s1, s2, tur, ayar = {}) {
  if (!(await ev(() => !!__tz.asmUI.pm && __tz.asmUI.pm.type === 'mate'))) await page.click('[data-cmd="amate"]');
  const r = await ev(([s1, s2, tur, ayar]) => {
    const T = __tz, a = T.curAsm();
    const sec = ([cid, p, k]) => { const v = T.asmView.groups.get(cid);
      if (k === 'a') { for (const an of v.d.ann) { const w = { x: p[0] - an.C.x, y: p[1] - an.C.y, z: p[2] - an.C.z }; const t = w.x * an.A.x + w.y * an.A.y + w.z * an.A.z;
        if (Math.abs(Math.hypot(w.x - an.A.x * t, w.y - an.A.y * t, w.z - an.A.z * t) - an.r) < 0.05 && t >= an.t0 - 0.2 && t <= an.t1 + 0.2) return { comp: cid, ref: { t: 'axis', p: [an.C.x, an.C.y, an.C.z], d: [an.A.x, an.A.y, an.A.z], r: an.r, t0: an.t0, t1: an.t1 } }; } return null; }
      const w = k[0] * p[0] + k[1] * p[1] + k[2] * p[2]; return { comp: cid, ref: { t: 'plane', n: k, p: k.map(x => x * w) } }; };
    const P = T.asmUI.pm; P.draft.a = sec(s1); P.draft.b = sec(s2); if (!P.draft.a || !P.draft.b) return 'seçim bulunamadı';
    T.setMateType(tur); if (ayar.ters) P.draft.flip = !P.draft.flip; if (ayar.hiza) P.draft.align = !P.draft.align; if (ayar.deger != null) P.draft.val = ayar.deger;
    T.previewMate(); return '';
  }, [s1, s2, tur, ayar]);
  if (r) throw new Error(r);
  if (ayar.kilit) await page.check('#pm [data-mlock]');
  const err = await ev(() => __tz.asmUI.pm.err);
  if (err) { console.error('  eşleştirme:', err); process.exitCode = 1; }
  await page.keyboard.press('Enter');
}
async function montajDurum(ad) {
  if (await ev(() => !!__tz.asmUI.pm)) await page.keyboard.press('Escape');
  const r = await ev(() => { const a = __tz.curAsm(); return { bilesen: a.comps.length, eslestirme: a.mates.length, cozuldu: !a._unsolved, tanimsiz: Object.values(__tz.asmView.dof).filter(v => v === '-').length,
    hatali: [...document.querySelectorAll('#tree .ti.err')].map(e => e.textContent.trim()) }; });
  console.log(ad, JSON.stringify(r));
  if (!r.cozuldu || r.tanimsiz || r.hatali.length) { console.error('  montaj tam tanımlı değil veya hatalı eşleştirme var'); process.exitCode = 1; }
}
/* girişim algılama: yalnızca yüzey temasları olmalı */
async function girisim(ad) {
  await page.click('[data-cmd="ainterf"]');
  await page.waitForFunction(() => __tz.asmUI.pm && __tz.asmUI.pm.done, null, { timeout: 300000 });
  const r = await ev(() => { const a = __tz.curAsm(), P = __tz.asmUI.pm; const nm = id => { const c = a.comps.find(c => c.id === id); return __tz.project.parts.find(p => p.id === c.part).partName; };
    return { temas: P.contacts, girisim: P.results.filter(x => !x.contact).map(x => `${nm(x.a)} ↔ ${nm(x.b)}: ${x.vol.toFixed(1)} mm³`) }; });
  await page.keyboard.press('Escape');
  console.log(ad, 'girişim', JSON.stringify(r));
  if (r.girisim.length) process.exitCode = 1;
}
async function kaydet(dosya, parcaAd) {
  await page.click('[data-tab="model"]');
  if (parcaAd) await ev(ad => __tz.switchPart(__tz.project.parts.find(p => p.partName === ad).id), parcaAd);
  const json = await ev(() => JSON.stringify({ app: 'tocad', ...__tz.project, version: 3 }, (k, v) => k.startsWith('_') ? undefined : v, 1));
  writeFileSync(join(here, dosya), json + '\n');
  console.log('Yazıldı:', dosya);
}

/* =================== 1) Flanşlı kaplin =================== */
// Göbek: Ø60 × 55 boyun, Ø120 × 15 flanş, Ø25 delik, 8 × 3,3 kama kanalı, PCD 90 üzerinde 4 × Ø11 cıvata deliği (döndürme).
// İkinci göbek “Çoğalt” ile. Cıvata M10 × 50 (altıgen baş SW16 × 6,4), somun M10 × 8, Ø25 × 100 mil.
// Montaj: B göbeği yüz yüze (yarım tur döner), delikler hizalı; bir cıvata ve somun eşleştirilip göbek ekseni etrafında
// dairesel bileşen çoğaltmayla 4'e çıkarılır; miller göbeklere 1 mm içeriden girer.
await yeniParca('Kaplin göbeği A', 'gg25');
await cizim({ kind: 'std', key: 'front' }, [['merkez', [0, -10], [0, 70]],
  ['cizgi', [12.5, 0], [60, 0], [60, 15], [30, 15], [30, 55], [12.5, 55], [12.5, 0]]]);
await ozellik('revolve', { name: 'Göbek ve flanş' });
await cizim({ kind: 'std', key: 'top' }, [['daire', [45, 0], 5.5], ['dcogalt', 4, 'daire']]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Cıvata delikleri 4 × Ø11' });
await cizim({ kind: 'std', key: 'top' }, [['dikdortgen', [-4, 0], [4, 15.8]]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Kama kanalı 8' });
await ozellikPM('chamfer', { name: 'Boyun pahı 1×45°', d: 1, edges: [await kenar(`Math.abs(a[1]-55)<1e-3&&Math.abs(Math.hypot(a[0],a[2])-30)<1e-3`)] });
await kontrol('göbek');
await ev(() => document.querySelector('[data-pa="dup"]').click());
await ev(() => { __tz.state.partName = 'Kaplin göbeği B'; });
await ekParca('Cıvata M10x50', 'steel');
await cizim({ kind: 'std', key: 'top' }, [['cokgen', [0, 0], 9.2376, 6]]);
await ozellik('extrude', { depth: 6.4, name: 'Altıgen baş SW16' });
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 5]]);
await ozellik('extrude', { depth: 50, flip: true, name: 'Gövde Ø10' });
await kontrol('cıvata');
await ekParca('Somun M10', 'steel');
await cizim({ kind: 'std', key: 'top' }, [['cokgen', [0, 0], 9.2376, 6], ['daire', [0, 0], 5]]);
await ozellik('extrude', { depth: 8, name: 'Somun SW16' });
await kontrol('somun');
await ekParca('Mil Ø25', 'c45');
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 12.5]]);
await ozellik('extrude', { depth: 100, name: 'Mil Ø25 × 100' });
await kontrol('mil');

await yeniMontaj('Flanşlı kaplin');
const gA = await bilesen('Kaplin göbeği A'), gB = await bilesen('Kaplin göbeği B');
await eslestir([gA, [55, 0, 0], [0, -1, 0]], [gB, [55, 0, 0], [0, -1, 0]], 'coincident', { ters: true }); // flanş yüzleri yüz yüze
await eslestir([gA, [0, 40, 30], 'a'], [gB, [0, 40, 30], 'a'], 'concentric');
await eslestir([gA, [39.5, 10, 0], 'a'], [gB, [39.5, 10, 0], 'a'], 'concentric'); // cıvata delikleri hizalı
const cv = await bilesen('Cıvata M10x50');
await eslestir([cv, [5, -20, 0], 'a'], [gA, [50.5, 7, 0], 'a'], 'concentric', { kilit: true });
await eslestir([cv, [7, 0, 0], [0, -1, 0]], [gA, [35, 15, 35], [0, 1, 0]], 'coincident'); // baş altı flanşın arkasına
const sm = await bilesen('Somun M10');
await eslestir([sm, [5, 4, 0], 'a'], [cv, [5, -40, 0], 'a'], 'concentric', { kilit: true });
await eslestir([sm, [0, 8, 7], [0, 1, 0]], [gB, [35, 15, 35], [0, 1, 0]], 'coincident');
// dairesel bileşen çoğaltma: eksen göbek A'nın silindiri, çoğaltılan cıvata ve somun, 4 adet
await page.keyboard.press('Escape');
await page.click('[data-cmd="acpat"]');
await ev(([gA, cv, sm]) => { const P = __tz.asmUI.pm; const v = __tz.asmView.groups.get(gA); const an = v.d.ann.find(a => Math.abs(a.r - 30) < 1e-6 && a.cyl);
  P.draft.ref = { comp: gA, ref: { t: 'axis', p: [an.C.x, an.C.y, an.C.z], d: [an.A.x, an.A.y, an.A.z], r: an.r, t0: an.t0, t1: an.t1 } }; P.slot = 'seeds'; P.draft.seeds = [cv, sm]; P.draft.n = 4; __tz.previewMate && 0; }, [gA, cv, sm]);
await page.fill('#pm input[data-k="n"]', '4');
await page.waitForTimeout(400);
await page.keyboard.press('Enter');
const m1 = await bilesen('Mil Ø25');
await eslestir([m1, [0, 50, 12.5], 'a'], [gA, [0, 40, 30], 'a'], 'concentric', { kilit: true });
await eslestir([m1, [0, 0, 5], [0, -1, 0]], [gA, [55, 0, 0], [0, -1, 0]], 'distance', { deger: 1, ters: true });
const m2 = await bilesen('Mil Ø25');
await eslestir([m2, [0, 50, 12.5], 'a'], [gB, [0, 40, 30], 'a'], 'concentric', { kilit: true });
await eslestir([m2, [0, 0, 5], [0, -1, 0]], [gB, [55, 0, 0], [0, -1, 0]], 'distance', { deger: 1, ters: true, hiza: true });
await montajDurum('kaplin');
await girisim('kaplin');
await kaydet('flansli-kaplin.tocad.json', 'Kaplin göbeği A');

/* =================== 2) Menteşe =================== */
// Kanat 60 × 20 × 3, göz Ø10 × 20 (Ø4 pim deliği), Ø4,5 vida deliği; iki kanat aynı parçadan: B kanadı yarım tur döner,
// gözler uç uca, kanatlar arası açı 90°. Pim Ø4 × 42, üstten 1 mm taşar.
await yeniParca('Menteşe kanadı', 'inox');
await cizim({ kind: 'std', key: 'front' }, [['dikdortgen', [0, 0], [60, 20]]]);
const kanat = await ozellik('extrude', { depth: 3, name: 'Kanat' });
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 5]]);
await ozellik('extrude', { depth: 20, name: 'Göz Ø10' });
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 2]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Pim deliği Ø4' });
await cizim({ kind: 'face', feat: kanat, which: 'far', sgn: 1 }, [['daire', [40, 10], 2.25]]);
await ozellik('cut', { end: 'through', name: 'Vida deliği Ø4,5' });
await kontrol('kanat');
await ekParca('Pim Ø4', 'steel');
await cizim({ kind: 'std', key: 'top' }, [['daire', [0, 0], 2]]);
await ozellik('extrude', { depth: 42, end: 'mid', name: 'Pim Ø4 × 42' });
await kontrol('pim');
await yeniMontaj('Menteşe');
const kA = await bilesen('Menteşe kanadı'), kB = await bilesen('Menteşe kanadı'), pim = await bilesen('Pim Ø4');
await eslestir([kA, [5, 10, 0], 'a'], [kB, [5, 10, 0], 'a'], 'concentric');
await eslestir([kA, [3, 0, -2], [0, -1, 0]], [kB, [3, 0, -2], [0, -1, 0]], 'coincident', { ters: true });
await eslestir([kA, [30, 10, 3], [0, 0, 1]], [kB, [30, 10, 3], [0, 0, 1]], 'angle', { deger: 90 });
await eslestir([pim, [2, 5, 0], 'a'], [kA, [2, 10, 0], 'a'], 'concentric', { kilit: true });
await eslestir([pim, [0, 21, 1], [0, 1, 0]], [kA, [3, 20, -2], [0, 1, 0]], 'distance', { deger: 1 });
await montajDurum('menteşe');
await girisim('menteşe');
await kaydet('mentese.tocad.json', 'Menteşe kanadı');

/* =================== 3) Dişli çifti =================== */
// Taban 140 × 80 × 10, eksen aralığı 48 mm (m · z = 2 · 24) iki Ø25 delik; Ø25 × 60 miller; dişliler ornekler/duz-disli'den
// içe aktarılır, göbekleri tabana bakar ve 2 mm boşlukla oturur. İkinci dişli, dişleri birinci dişlinin boşluklarına girsin
// diye yarım diş (7,5°) çevrilir: kama kanallarının yan yüzleri arası açı.
await yeniParca('Dişli tabanı', 'al');
await cizim({ kind: 'std', key: 'front' }, [['mdikdortgen', [24, 0], [94, 40]]]);
await ozellik('extrude', { depth: 10, flip: true, name: 'Taban 140 × 80 × 10' });
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 0], 12.5], ['daire', [48, 0], 12.5]]);
await ozellik('cut', { end: 'through', dir2: true, end2: 'through', name: 'Mil delikleri Ø25' });
await kontrol('taban');
await ekParca('Dişli mili Ø25', 'c45');
await cizim({ kind: 'std', key: 'front' }, [['daire', [0, 0], 12.5]]);
await ozellik('extrude', { depth: 60, name: 'Mil Ø25 × 60' });
await kontrol('dişli mili');
{
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), ev(() => document.querySelector('[data-m="importpart"]').click())]);
  await fc.setFiles(join(here, 'duz-disli.tocad.json'));
  await page.waitForFunction(() => __tz.state.partName.startsWith('Düz dişli'));
}
const disli = await ev(() => __tz.state.partName);
await yeniMontaj('Dişli çifti');
const tb = await bilesen('Dişli tabanı'), s1 = await bilesen('Dişli mili Ø25'), s2 = await bilesen('Dişli mili Ø25');
await eslestir([s1, [12.5, 0, 30], 'a'], [tb, [12.5, 0, -5], 'a'], 'concentric', { kilit: true });
await eslestir([s1, [5, 0, 0], [0, 0, -1]], [tb, [0, 30, -10], [0, 0, -1]], 'distance', { deger: 5 }); // mil alttan 5 mm taşar
await eslestir([s2, [12.5, 0, 30], 'a'], [tb, [60.5, 0, -5], 'a'], 'concentric', { kilit: true });
await eslestir([s2, [5, 0, 0], [0, 0, -1]], [tb, [0, 30, -10], [0, 0, -1]], 'distance', { deger: 5 });
const d1 = await bilesen(disli), d2 = await bilesen(disli);
for (const [d, s] of [[d1, s1], [d2, s2]]) {
  await eslestir([d, [12.5, 0, 10], 'a'], [s, [12.5, 0, 30], 'a'], 'concentric');
  await eslestir([d, [14, 5, 30], [0, 0, 1]], [tb, [0, 30, 0], [0, 0, 1]], 'distance', { deger: 2, hiza: true, ters: true }); // göbek yüzü tabana bakar, 2 mm boşluk
}
await eslestir([d1, [4, 14, 10], [-1, 0, 0]], [tb, [94, 0, -5], [1, 0, 0]], 'parallel'); // birinci dişli: kama kanalı tabanın kenarına paralel
await eslestir([d2, [4, 14, 10], [-1, 0, 0]], [d1, [4, 14, 10], [-1, 0, 0]], 'angle', { deger: 7.5 });
await montajDurum('dişli çifti');
await girisim('dişli çifti');
await kaydet('disli-cifti.tocad.json', 'Dişli tabanı');

await browser.close();
