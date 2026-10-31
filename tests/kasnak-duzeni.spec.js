// Kasnak düzeni (tabla, iki yatak, mil, iki burç, kasnak) tarayıcıda bir kullanıcı gibi çizilip kurulurken bulunan hatalar
// (örnek: ornekler/kasnak-duzeni-ciz.mjs).
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function newSketch(page, key) {
  // şeritteki “Tam Tanımla” düğmesi
  await page.evaluate(() => { window.tamTanimla = () => [...document.querySelectorAll('#ribbon button')].find(b => b.textContent.includes('Tam Tanımla')).click(); });
  await page.evaluate(key => { document.querySelector('[data-m="new"]').click(); __tz.startSketch({ kind: 'std', key }); }, key);
  await page.waitForTimeout(900);
}
async function openSample(page) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL('../ornekler/kasnak-duzeni.tocad.json', import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3 && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === (__tz.dwSrc().kind === 'asm' ? __tz.curAsm().name : __tz.state.partName)));
  await page.waitForTimeout(300);
}

test('örnek: kasnak düzeni parçaları tam tanımlı, montaj tam kurulu ve girişimsiz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page);
  const parts = await page.evaluate(() => __tz.project.parts.map(p => { __tz.switchPart(p.id); const m = __tz.model, b = m.box;
    return { ad: p.partName, mat: p.material, err: Object.keys(m.errors).length, dof: Object.values(m.dof).filter(d => d !== 0).length, box: b.min.map((v, i) => +(b.max[i] - v).toFixed(2)) }; }));
  expect(parts).toEqual([
    { ad: 'Tabla', mat: 'c22', err: 0, dof: 0, box: [128, 14, 56] },
    { ad: 'Yatak', mat: 'gg20', err: 0, dof: 0, box: [56, 57, 38] },
    { ad: 'Burç', mat: 'bronze', err: 0, dof: 0, box: [30, 20, 30] },
    { ad: 'Mil', mat: 'c40', err: 0, dof: 0, box: [82, 12, 12] },
    { ad: 'Kasnak', mat: 'gg25', err: 0, dof: 0, box: [60, 30, 60] }]);
  await page.click('[data-tab="asm"]');
  await page.waitForTimeout(500);
  const asm = await page.evaluate(() => { const a = __tz.curAsm(); const ok = __tz.solveAsm(a); const T = id => a.comps.find(c => c.id === id).T;
    // mil ekseni iki yatağın deliğinden geçer; kasnak iki kulağın tam ortasında
    const k = a.comps[6].T;
    return { ok, n: a.comps.length, m: a.mates.length, kasnakX: +k[12].toFixed(3), milY: +a.comps[3].T[13].toFixed(3) }; });
  expect(asm).toEqual({ ok: true, n: 7, m: 14, kasnakX: 15, milY: 53 });
  await page.click('[data-cmd="ainterf"]');
  await page.waitForFunction(() => __tz.asmUI.pm && __tz.asmUI.pm.done, null, { timeout: 120000 });
  expect(await page.evaluate(() => __tz.asmUI.pm.results.filter(x => !x.contact).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('çizim: ölçü yazılınca “Izgaraya yakala” işaretli kalır; dört köşesi radyuslu merkez dikdörtgen tam tanımlıdır', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'top');
  const r = await page.evaluate(() => { const T = __tz;
    T.setTool('crect'); T.toolClick(0, 0); T.sk.cursor = [30, 15]; T.applySkInput({ W: 128, H: 56 }); T.setTool(null);
    const grid = [T.sk.opts.grid, document.querySelector('[data-opt="grid"]').checked];
    T.sk.opts.filletR = 10; T.setTool('sfillet'); for (const [x, y] of [[64, 28], [-64, 28], [-64, -28], [64, -28]]) T.toolClick(x, y); T.setTool(null);
    // köşegenin ucu (sanal köşe) dördüncü radyustan sonra da iki kenarın uzantısında kalır
    const n = T.sk.feat.cons.length; tamTanimla(); return { grid, dof: T.sk.an.dof, added: T.sk.feat.cons.length - n }; });
  expect(r).toEqual({ grid: [true, true], dof: 0, added: 0 });
  expect(errors).toEqual([]);
});

test('kesme: gövde çizim düzleminin öbür tarafındaysa yön gövdeye doğru çevrilir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'top');
  const r = await page.evaluate(() => { const T = __tz;
    T.setTool('rect'); T.toolClick(-20, -20); T.toolClick(20, 20); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 10; T.commitPM(); const v0 = T.model.props.vol;
    // Üst Düzlem gövdenin alt yüzü: kesme varsayılan olarak aşağı (boşluğa) giderdi
    T.startSketch({ kind: 'std', key: 'top' }); T.setTool('circle'); T.toolClick(0, 0); T.toolClick(5, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('cut'); const flip = T.pm.draft.flip; T.commitPM();
    return { flip, removed: +(v0 - T.model.props.vol).toFixed(0) }; });
  expect(r.flip).toBe(true);
  expect(r.removed).toBeGreaterThan(780); // π · 5² · 10 ≈ 785
  expect(errors).toEqual([]);
});

test('radyus: iç kenara verilen radyus kenarın bittiği yüzeyden dışarı taşmaz', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'front');
  const r = await page.evaluate(() => { const T = __tz;
    T.setTool('line'); for (const q of [[0, 0], [40, 0], [40, 8], [8, 8], [8, 30], [0, 30], [0, 0]]) T.toolClick(...q); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 20; T.commitPM();
    // L profilin içbükey kenarı (8, 8) boyunca, z = 0…20
    T.openPM('fillet', null, { type: 'fillet', id: 'r1', name: 'R1', r: 4, edges: [{ a: [8, 8, 0], b: [8, 8, 20] }] }); T.commitPM();
    const b = T.model.box; return { err: Object.keys(T.model.errors).length, z: [+b.min[2].toFixed(4), +b.max[2].toFixed(4)] }; });
  expect(r).toEqual({ err: 0, z: [0, 20] });
  expect(errors).toEqual([]);
});

test('çizim: döndürme profilinde merkez çizgisine göre çap ölçüsü; aynı doğrudaki kademeler tek ölçüyle sürülür', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'front');
  const r = await page.evaluate(() => { const T = __tz, f = T.sk.feat; T.sk.opts.grid = false;
    T.setTool('centerline'); T.toolClick(0, -5); T.toolClick(0, 35); T.setTool(null);
    T.setTool('line'); for (const q of [[10, 0], [20, 0], [20, 10], [26, 10], [26, 0], [30, 0], [30, 30], [26, 30], [26, 20], [20, 20], [20, 30], [10, 30], [10, 0]]) T.toolClick(...q); T.setTool(null);
    tamTanimla();
    const dia = f.cons.filter(c => c.dia).map(c => c.val).sort((a, b) => a - b);
    // Ø52 değiştirilince iki kademe birlikte (yarıçap 27) değişir
    const c52 = f.cons.find(c => c.dia && c.val === 52); T.setDimVal(c52.id, 54);
    const xs = f.ents.filter(e => e.t === 'line' && !e.cons).map(e => [f.pts[e.a].x, f.pts[e.b].x]).filter(([a, b]) => Math.abs(a - b) < 1e-9).map(([a]) => +a.toFixed(6));
    return { dof: T.sk.an.dof, dia, x27: xs.filter(x => x === 27).length }; });
  expect(r).toEqual({ dof: 0, dia: [20, 40, 52, 60], x27: 2 });
  // etiket çap işaretiyle yazılır
  await page.waitForFunction(() => [...document.querySelectorAll('#labels .dlab')].some(l => l.textContent === 'Ø54'));
  expect(errors).toEqual([]);
});

test('çizim: akıllı ölçü merkez çizgisinin öbür tarafına konunca çap ölçüsü olur', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'front');
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false;
    T.setTool('centerline'); T.toolClick(0, -10); T.toolClick(0, 40); T.setTool(null);
    T.setTool('line'); T.toolClick(12, 0); T.toolClick(12, 30); T.setTool(null); T.setTool('smartdim'); });
  const clickAt = async (x, y) => { const p = await page.evaluate(([x, y]) => __tz.scr(x, y), [x, y]); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(120); };
  await clickAt(12, 15); await clickAt(0, 20); await clickAt(-8, 15); // çizgi, eksen, ölçünün yeri eksenin solunda
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => __tz.sk.feat.cons.filter(c => c.t === 'dll').map(c => ({ dia: !!c.dia, val: c.val })));
  expect(r).toEqual([{ dia: true, val: 24 }]);
  expect(errors).toEqual([]);
});

test('montaj: eşmerkezlide eksenleri dik duran bileşen eksen boyunca uzağa kaçmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page);
  await page.click('[data-tab="asm"]');
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const T = __tz, a = T.curAsm();
    const kasnak = a.comps[6], mil = a.mates.find(m => m.type === 'concentric' && m.b.comp === kasnak.id);
    // kasnağın eşleştirmelerini kaldırıp başlangıç konumuna (dik, uzakta) al ve yalnızca mil ile eşmerkezli yap
    a.mates = a.mates.filter(m => m.a.comp !== kasnak.id && m.b.comp !== kasnak.id); kasnak.T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 468, -8, 0, 1];
    const ok = T.solveAsm(a, { extra: [mil] }); return { ok, x: kasnak.T[12] }; });
  expect(r.ok).toBe(true);
  expect(Math.abs(r.x - 468)).toBeLessThan(40); // önceden −933 mm'ye gidiyordu
  expect(errors).toEqual([]);
});

test('görünüm: aynı yön düğmesine yeniden basmak karşı taraftan bakar; izometrik 90° döner', async ({ page }) => {
  const errors = await openApp(page);
  const dir = () => page.evaluate(() => { const d = __tz.camera.position.clone().sub(__tz.controls.target).normalize(); return [d.x, d.y, d.z].map(v => Math.round(v * 100) / 100); });
  const hud = async k => { await page.click(`#hud [data-hud="${k}"]`); await page.waitForFunction(() => !__tz.camBusy); };
  await hud('front'); expect(await dir()).toEqual([0, 0, 1]);
  await hud('front'); expect(await dir()).toEqual([0, 0, -1]);
  await hud('right'); expect(await dir()).toEqual([1, 0, 0]);
  await hud('right'); expect(await dir()).toEqual([-1, 0, 0]);
  await hud('iso'); expect(await dir()).toEqual([0.58, 0.58, 0.58]);
  await hud('iso'); expect(await dir()).toEqual([-0.58, 0.58, 0.58]);
  expect(errors).toEqual([]);
});

test('arayüz: Tam Tanımla bildirimi çizimden çıkınca kapanır; eşleştirme seçimi yüzeyin yönünü yazar; yeni malzemeler', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'top');
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(10, 0); T.setTool(null); });
  await page.locator('#ribbon button', { hasText: 'Tam Tanımla' }).click();
  await expect(page.locator('#toast')).toHaveClass(/on/);
  await page.click('#confirm [data-cf="ok"]');
  await expect(page.locator('#toast')).not.toHaveClass(/on/);
  const mats = await page.evaluate(() => [...document.querySelectorAll('#matSel option')].map(o => o.value));
  for (const m of ['c22', 'c40', 'bronze', 'gg20']) expect(mats).toContain(m);
  await openSample(page);
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="amate"]');
  const txt = await page.evaluate(() => { const a = __tz.curAsm(), P = __tz.asmUI.pm; const t = a.comps[0];
    P.draft.a = { comp: t.id, ref: { t: 'plane', n: [0, 1, 0], p: [0, 10, 0] } }; __tz.previewMate(); return document.querySelector('#pm .lst').textContent; });
  expect(txt).toContain('Tabla<1>: düz yüzey (+Y yönüne bakar)');
  expect(errors).toEqual([]);
});

test('teknik resim: mil, burç ve kasnakta kademe boyları zincir ölçüyle yazılır', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page);
  const out = {};
  for (const ad of ['Mil', 'Burç', 'Kasnak']) {
    await page.click('[data-tab="model"]');
    await page.evaluate(ad => __tz.switchPart(__tz.project.parts.find(p => p.partName === ad).id), ad);
    await openDrawing(page);
    out[ad] = await page.evaluate(() => __tz.getCtx().hits.filter(h => h.t === 'auto' && h.k.startsWith('kb:')).length);
  }
  expect(out).toEqual({ Mil: 3, Burç: 2, Kasnak: 3 });
  const txt = await page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent.trim()));
  // genel boy kasnağın dış çapıdır: “60” değil “Ø60” yazılır; gizli kalan iç çaplar (göbek deliği dahil) üst görünüşte kılavuzla
  for (const e of ['Ø60', 'Ø52', 'Ø40', 'Ø20']) expect(txt).toContain(e);
  expect(txt).not.toContain('60');
  expect(errors).toEqual([]);
});
