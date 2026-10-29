// Çizim ortamı ekleri: 2B (ortografik) çizim görünümü, dış referanslar, nokta, iki yönlü ofset, güç budama;
// teknik resimde elle ölçek ve antetsiz düzen.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function newSketch(page, key = 'front') {
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click(`.ti[data-plane="${key}"]`);
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
}
/** kamera animasyonu bitene kadar bekler (yazılımsal WebGL'de kareler yavaştır) */
async function settle(page) {
  let prev = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const k = await page.evaluate(() => __tz.camBusy ? Math.random() : JSON.stringify([__tz.camera.position.toArray().map(v => v.toFixed(4)), __tz.camera.zoom.toFixed(6)]));
    if (k === prev) return;
    prev = k;
  }
}

test('çizim görünümü ortografik ve döndürülemez; yakınlaştırınca model ile çizim birbirine göre kaymaz', async ({ page }) => {
  const errors = await openApp(page);
  expect(await page.evaluate(() => __tz.camera.isPerspectiveCamera)).toBe(true);
  // üst yüzeydeki çizim (y = 15); arkadaki plaka köşesi y = 0 düzleminde
  await page.evaluate(() => __tz.editSketch('s2'));
  await settle(page);
  const a = await page.evaluate(() => ({ ortho: !!__tz.camera.isOrthographicCamera, rot: __tz.controls.enableRotate, o: __tz.scr(0, 0), m: __tz.scrW([60, 0, 40]) }));
  expect(a.ortho).toBe(true);
  expect(a.rot).toBe(false);
  // imleç orijin ile köşe arasında bir yerde
  const cur = [(a.o[0] * 2 + a.m[0]) / 3, (a.o[1] * 2 + a.m[1]) / 3];
  await page.mouse.move(cur[0], cur[1]);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => ({ o: __tz.scr(0, 0), m: __tz.scrW([60, 0, 40]) }));
  // ortografikte her nokta imleç etrafında aynı oranda uzaklaşır: orijin ile arkadaki köşe arasındaki ekran vektörü de aynı oranda büyür
  const k = Math.hypot(b.o[0] - cur[0], b.o[1] - cur[1]) / Math.hypot(a.o[0] - cur[0], a.o[1] - cur[1]);
  expect(k).toBeGreaterThan(1.3);
  // (imleç tam sayı piksele yuvarlandığından k yaklaşık; perspektifte 15 mm derinlik farkı birkaç kat daha büyük sapma verirdi)
  for (const j of [0, 1]) expect(Math.abs((b.m[j] - b.o[j]) - (a.m[j] - a.o[j]) * k)).toBeLessThan(Math.abs(a.m[j] - a.o[j]) * k * 0.01 + 0.5);
  // orta tuşla sürükleme döndürmez, kaydırır
  const dir0 = await page.evaluate(() => __tz.camera.getWorldDirection(new __tz.camera.position.constructor()).toArray());
  await page.mouse.move(700, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(780, 450, { steps: 5 }); await page.mouse.up({ button: 'middle' });
  const dir1 = await page.evaluate(() => __tz.camera.getWorldDirection(new __tz.camera.position.constructor()).toArray());
  for (const j of [0, 1, 2]) expect(dir1[j]).toBeCloseTo(dir0[j], 6);
  // izometrik düğmesi çizimde 2B görünümü bozmaz
  await page.click('[data-hud="iso"]'); await settle(page);
  const dir2 = await page.evaluate(() => __tz.camera.getWorldDirection(new __tz.camera.position.constructor()).toArray());
  expect(Math.abs(dir2[1])).toBeCloseTo(1, 4);
  await page.evaluate(() => __tz.exitSketch(true));
  expect(await page.evaluate(() => ({ p: __tz.camera.isPerspectiveCamera, rot: __tz.controls.enableRotate }))).toEqual({ p: true, rot: true });
  expect(errors).toEqual([]);
});

test('dış referans: arkadaki model kenarına paralel ve çakışık ilişki; kullanılmayan referans çıkarken silinir', async ({ page }) => {
  const errors = await openApp(page);
  // örnek parçada ön düzlem plakayı keser: plaka üst kenarı ön görünüşte y = 15 doğrusu
  await page.evaluate(() => __tz.startSketch({ kind: 'std', key: 'front' }));
  await settle(page);
  await page.evaluate(() => { const T = __tz; T.setTool('line'); T.toolClick(30, 30); T.toolClick(50, 38); T.setTool(null); });
  // boş yerde model kenarına tıklama: kenar sabit referans olarak eklenir ve seçilir
  let s = await page.evaluate(() => __tz.scr(40, 15));
  await page.mouse.click(s[0], s[1]);
  const r1 = await page.evaluate(() => { const f = __tz.sk.feat; const ref = f.ents.find(e => e.ref); return { n: f.ents.filter(e => e.ref).length, t: ref && ref.t, cons: ref && ref.cons, sel: __tz.sk.sel.map(h => h.id), id: ref && ref.id, dof: __tz.sk.an.dof }; });
  expect(r1.n).toBe(1);
  expect(r1.t).toBe('line');
  expect(r1.cons).toBe(true);
  expect(r1.sel).toEqual([r1.id]);
  expect(r1.dof).toBe(4); // referans sabit: serbestlik yalnızca çizilen çizgiden
  // çizginin de seçilmesi ve paralel ilişki
  const l = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents.find(x => !x.ref); const p = __tz.scr((f.pts[e.a].x + f.pts[e.b].x) / 2, (f.pts[e.a].y + f.pts[e.b].y) / 2); return p; });
  await page.mouse.click(l[0], l[1]);
  const r2 = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat; T.addRelation('par'); const e = f.ents.find(x => !x.ref);
    // uç noktasını referans kenarın üstüne al (çakışık)
    T.selectItems([{ k: 'pt', id: e.a }, { k: 'ent', id: f.ents.find(x => x.ref).id }]); T.addRelation('coin');
    return { dy: f.pts[e.b].y - f.pts[e.a].y, y: f.pts[e.a].y, dof: T.sk.an.dof };
  });
  expect(r2.dy).toBeCloseTo(0, 6);
  expect(r2.y).toBeCloseTo(15, 6);
  expect(r2.dof).toBe(2);
  // ikinci, kullanılmayan referans (plakanın alt kenarı y = 0)
  s = await page.evaluate(() => __tz.scr(45, 0));
  await page.mouse.click(s[0], s[1]);
  expect(await page.evaluate(() => __tz.sk.feat.ents.filter(e => e.ref).length)).toBe(2);
  const r3 = await page.evaluate(() => { const T = __tz; const f = T.sk.feat; T.exitSketch(true); return { refs: f.ents.filter(e => e.ref).length, fix: f.cons.filter(c => c.t === 'fix').length, err: T.model.errors }; });
  expect(r3.refs).toBe(1);
  expect(r3.fix).toBe(2);
  expect(r3.err).toEqual({});
  expect(errors).toEqual([]);
});

test('dış referans: akıllı ölçü modeldeki kenardan verilir; başka bir çizimin dairesi', async ({ page }) => {
  const errors = await openApp(page);
  // akıllı ölçü: önce model kenarına (dış referans) sonra çizginin ucuna
  await page.evaluate(() => { const T = __tz; T.startSketch({ kind: 'std', key: 'front' }); T.setTool('line'); T.toolClick(30, 25); T.toolClick(50, 25); T.setTool('smartdim'); });
  await settle(page);
  const p = await page.evaluate(() => [__tz.scr(40, 15), __tz.scr(30, 25), __tz.scr(20, 35)]);
  for (const q of p) await page.mouse.click(q[0], q[1]);
  await page.waitForTimeout(100);
  const d = await page.evaluate(() => { const f = __tz.sk.feat; const c = f.cons.find(x => x.t === 'dpl'); return c && { val: c.val, ref: f.ents.find(e => e.id === c.e).ref }; });
  expect(d).toEqual({ val: 10, ref: true });
  await page.evaluate(() => __tz.exitSketch(false));
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(20, 10); T.toolClick(30, 10); T.exitSketch(true); });
  await page.evaluate(() => __tz.startSketch({ kind: 'std', key: 'front' }));
  await settle(page);
  const r = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat; const px = T.sk.px;
    const c = T.extPick([30, 10], px * 6);
    T.setTool('circle'); T.toolClick(-20, 0); T.toolClick(-14, 0); T.setTool(null);
    const h = T.refAt([20, 20], px * 6); const ref = f.ents.find(e => e.id === h.id);
    const mine = f.ents.find(e => !e.ref);
    T.selectItems([{ k: 'ent', id: mine.id }, { k: 'ent', id: ref.id }]); T.addRelation('eq');
    return { cand: c && c.t, ref: ref.t, r: mine.r, dof: T.sk.an.dof };
  });
  expect(r.cand).toBe('circle');
  expect(r.ref).toBe('circle');
  expect(r.r).toBeCloseTo(10, 6);
  expect(r.dof).toBe(2);
  expect(errors).toEqual([]);
});

test('nokta aracı: tek başına, öğe üstünde ve kesişimde nokta; ölçülendirilir ve kaydedilir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const r = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat;
    T.setTool('line'); T.toolClick(0, 0); T.toolClick(40, 0); T.setTool(null);
    T.setTool('point'); T.toolClick(12, 17); T.toolClick(10, 0);
    const sp = Object.entries(f.pts).filter(([, p]) => p.sp).map(([id]) => id);
    const onLine = f.cons.filter(c => c.t === 'pol' && sp.includes(c.p)).length;
    const dof0 = T.sk.an.dof;
    T.exitSketch(true);
    const s = T.state.features.find(x => x.id === f.id);
    return { n: sp.length, onLine, dof0, kept: Object.values(s.pts).filter(p => p.sp).length, dof: T.model.dof[f.id], err: T.model.errors };
  });
  expect(r.n).toBe(2);
  expect(r.onLine).toBe(1);
  expect(r.dof0).toBe(1 + 2 + 1); // orijinden yatay çizgi 1, serbest nokta 2, çizgi üstündeki nokta 1
  expect(r.kept).toBe(2);
  expect(r.dof).toBe(0); // çıkarken otomatik tam tanımlandı (noktalar dahil)
  expect(r.err).toEqual({});
  // yalnızca noktadan oluşan yeni çizim silinmez
  await newSketch(page);
  const q = await page.evaluate(() => { const T = __tz; const id = T.sk.feat.id; T.setTool('point'); T.toolClick(5, 5); T.exitSketch(true); return !!T.state.features.find(x => x.id === id); });
  expect(q).toBe(true);
  expect(errors).toEqual([]);
});

test('ofset iki yönde: tek ölçü iki tarafı birlikte sürer', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const o = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(60, 40); T.setTool(null);
    const top = f.ents[0], side = f.ents[1];
    f.cons.push({ id: 'cw', t: 'd', p: top.a, q: top.b, val: 60, lp: [30, -8] }, { id: 'ch', t: 'd', p: side.a, q: side.b, val: 40, lp: [68, 20] });
    T.solveSketch(f);
    const src = f.ents.map(e => e.id);
    T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id }))); T.setSkOp('offset'); Object.assign(T.sk.op, { d: 5, both: true }); T.applySkOp();
    const box = ids => { const ps = f.ents.filter(e => ids.includes(e.id)).flatMap(e => [e.a, e.b]).map(id => f.pts[id]); const xs = ps.map(p => p.x), ys = ps.map(p => p.y); return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] };
    const news = () => f.ents.filter(e => !src.includes(e.id));
    const sizes = () => { const n = news(); const a = box(n.slice(0, 4).map(e => e.id)), b = box(n.slice(4).map(e => e.id)); return [a, b].sort((u, v) => u[0] - v[0]) };
    const s0 = sizes(), dof = T.sk.an.dof, drv = f.cons.filter(c => c.t === 'doff');
    T.setDimVal(drv[0].id, 8);
    return { n: news().length, s0, s1: sizes(), dof, drivers: drv.length, followers: f.cons.filter(c => c.t === 'offd').length };
  });
  expect(o.n).toBe(8);
  expect(o.drivers).toBe(1);
  expect(o.followers).toBe(7);
  expect(o.dof).toBe(0);
  expect(o.s0[0][0]).toBeCloseTo(50, 4); expect(o.s0[0][1]).toBeCloseTo(30, 4);
  expect(o.s0[1][0]).toBeCloseTo(70, 4); expect(o.s0[1][1]).toBeCloseTo(50, 4);
  expect(o.s1[0][0]).toBeCloseTo(44, 4); expect(o.s1[0][1]).toBeCloseTo(24, 4);
  expect(o.s1[1][0]).toBeCloseTo(76, 4); expect(o.s1[1][1]).toBeCloseTo(56, 4);
  expect(errors).toEqual([]);
});

test('güç budama: fare basılı sürüklenince izin kestiği parçalar budanır', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(-30, -10); T.toolClick(30, 10); T.setTool('rect'); T.toolClick(-10, -30); T.toolClick(10, 30); T.setTool('trim'); });
  const h0 = await page.evaluate(() => __tz.sk.hist.length);
  const drag = async (a, b) => {
    const [p, q] = await page.evaluate(([a, b]) => [__tz.scr(...a), __tz.scr(...b)], [a, b]);
    await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(q[0], q[1], { steps: 12 }); await page.mouse.up();
  };
  await drag([-5, 15], [-5, -15]);
  const r1 = await page.evaluate(() => __tz.sk.feat.ents.length);
  await drag([-15, 5], [15, 5]);
  const r = await page.evaluate(() => ({ ents: __tz.sk.feat.ents.length, issues: __tz.sk.issues.n, steps: __tz.sk.hist.length }));
  expect(r).toEqual({ ents: 12, issues: 0, steps: h0 + 2 });
  // bir sürükleme tek adımda geri alınır
  await page.evaluate(() => document.querySelector('#undoBtn').click());
  expect(await page.evaluate(() => ({ n: __tz.sk.feat.ents.length, steps: __tz.sk.hist.length }))).toEqual({ n: r1, steps: h0 + 1 });
  expect(errors).toEqual([]);
});

test('teknik resim: elle ölçek ve antetsiz kağıt; PDF penceresi aynı ayarlarla açılır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('.tabs button[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx());
  await page.selectOption('#dScale', 'custom');
  await page.fill('#dScaleIn', '1:2,5');
  await page.press('#dScaleIn', 'Enter');
  await page.waitForFunction(() => __tz.getCtx() && Math.abs(__tz.getCtx().scale - 0.4) < 1e-9);
  const a = await page.evaluate(() => ({ s: __tz.dwS().scale, opt: document.querySelector('#dScale').selectedOptions[0].textContent, tb: __tz.buildSheet(true).markup.includes('1:2,5') }));
  expect(a).toEqual({ s: '0.4', opt: '1:2,5', tb: true });
  expect(await page.evaluate(() => [__tz.parseScale('3:1'), __tz.parseScale('1/25'), __tz.parseScale('0,4'), __tz.parseScale('abc')])).toEqual([3, 0.04, 0.4, null]);
  // antetsiz, çerçeveli
  await page.selectOption('#dLayout', 'frame');
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => { const m = __tz.buildSheet(true).markup; return { frame: m.includes('class="d-frame"'), tb: m.includes('Resim no'), layout: __tz.dwS().layout }; });
  expect(b).toEqual({ frame: true, tb: false, layout: 'frame' });
  await page.selectOption('#dLayout', 'none');
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => { const m = __tz.buildSheet(true).markup; return { frame: m.includes('class="d-frame"'), tb: m.includes('Resim no') }; });
  expect(c).toEqual({ frame: false, tb: false });
  const d = await page.evaluate(async () => { __tz.openPdfDialog('2d'); const o = { layout: __tz.pdfOpt.layout, scale: __tz.pdfOpt.scale }; const b = await __tz.makePdf(); const blob = b.blob || b; o.head = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5)); return o; });
  expect(d).toEqual({ layout: 'none', scale: '0.4', head: '%PDF-' });
  expect(errors).toEqual([]);
});
