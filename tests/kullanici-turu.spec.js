// Tüm özellikler bir kullanıcı gibi (fare ve klavyeyle) denenirken SolidWorks'e göre bulunan hatalar.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

/** yeni proje: Üst Düzlem'de merkez dikdörtgen ve ekstrüzyon */
async function plate(page, w, d, h) {
  await page.evaluate(([w, d, h]) => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(-w / 2, -d / 2); T.toolClick(w / 2, d / 2); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = h; T.commitPM(); }, [w, d, h]);
}

test('ağaç: yeni özellik seçili kalırken ona tıklamak seçimi kaldırmaz; Aynala onu hedef alır', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 100, 60, 10);
  const id = await page.evaluate(() => { const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(-30, 0); T.toolClick(-25, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('cut'); T.commitPM(); return T.state.features[T.state.features.length - 1].id; });
  await page.locator(`#tree .ti[data-id="${id}"] .nm`).click();
  await page.locator(`#tree .ti[data-id="${id}"] .nm`).click({ delay: 600 });
  await page.locator('#ribbon [data-cmd="mirror"]').click();
  expect(await page.evaluate(() => __tz.pm.draft.targets)).toEqual([id]);
  expect(errors).toEqual([]);
});

test('çizim: Ctrl+A tüm öğeleri seçer; küçük dairenin çevresine tıklamak merkezi değil daireyi seçer', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); __tz.startSketch({ kind: 'std', key: 'top' }); });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false;
    T.setTool('circle'); T.toolClick(0, 0); T.toolClick(40, 0); T.toolClick(30, 0); T.toolClick(30 + 9 * T.sk.px, 0); T.setTool(null);
    return T.sk.feat.ents.map(e => e.id); });
  await page.mouse.move(700, 500);
  await page.keyboard.press('Control+a');
  expect(await page.evaluate(() => __tz.sk.sel.map(h => h.k + ':' + h.id))).toEqual(r.map(id => 'ent:' + id));
  expect(await page.evaluate(() => (getSelection() + '').length)).toBe(0);
  await page.keyboard.press('Escape');
  // yarıçapı 9 piksel olan daire: çevreye tıklanınca merkez nokta (toleransın içinde) değil daire seçilir
  const [x, y] = await page.evaluate(() => __tz.scr(30, 9 * __tz.sk.px));
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.sk.sel.map(h => h.k + ':' + h.id))).toEqual(['ent:' + r[1]]);
  expect(errors).toEqual([]);
});

test('gövdeye kadar: gövde çizimin öbür tarafındaysa yön kendiliğinden çevrilir', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 100, 60, 10);
  const r = await page.evaluate(() => { const T = __tz;
    T.cmd('plane'); T.pm.draft.base = 'top'; T.pm.draft.offset = 40; T.commitPM(); const pid = T.state.features[T.state.features.length - 1].id;
    T.startSketch({ kind: 'plane', id: pid }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(15, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); const sel = document.querySelector('#pm select[data-k="end"]'); sel.value = 'body'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const flip = T.pm.draft.flip; T.commitPM(); const b = T.model.box; return { flip, err: Object.keys(T.model.errors).length, h: +(b.max[1] - b.min[1]).toFixed(3) }; });
  expect(r).toEqual({ flip: true, err: 0, h: 40 });
  expect(errors).toEqual([]);
});

test('görüntü ağı su geçirmez: kesmelerin bıraktığı T-birleşimleri kapatılır (yüzeyde piksel parıltısı yok)', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 100, 60, 10);
  const open = await page.evaluate(() => { const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('slot'); T.toolClick(-35, -15); T.toolClick(-35, 15); T.toolClick(-31, 15); T.setTool('circle'); T.toolClick(20, 5); T.toolClick(24, 5); T.setTool(null); T.exitSketch(true);
    T.cmd('cut'); T.commitPM();
    // her üçgen kenarının (sıfır uzunluklu olmayan) tam tersi başka bir üçgende de bulunmalı
    const pos = T.solidMesh.geometry.attributes.position.array, k = i => pos[i * 3] + ',' + pos[i * 3 + 1] + ',' + pos[i * 3 + 2], E = new Map();
    const tri = pos.length / 9;
    for (let t = 0; t < tri; t++) for (let j = 0; j < 3; j++) { const a = k(t * 3 + j), b = k(t * 3 + (j + 1) % 3); if (a !== b) E.set(a + '|' + b, (E.get(a + '|' + b) || 0) + 1); }
    // sıfır alanlı üçgenlerin kenarları sayılmaz: yalnızca bir kenarı eşsiz kalan kenarları say
    let n = 0; for (const key of E.keys()) { const [a, b] = key.split('|'); if (!E.has(b + '|' + a)) n++; } return n; });
  expect(open).toBe(0);
  expect(errors).toEqual([]);
});

test('teknik resim: yandan görülen dairenin köşeleri nokta sayılmaz; kenarın ortasına tıklayınca kenar uzunluğu ölçülür', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 100, 60, 10);
  await page.evaluate(() => { const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(15, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 40; T.commitPM(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.waitForTimeout(400);
  // göbeğin üst kenarı (ön görünüş, y = 40): yalnızca iki uç
  expect(await page.evaluate(() => __tz.getCtx().snaps.filter(s => s.view === 'front' && Math.abs(s.b - 40) < 1e-3).map(s => Math.round(s.a)).sort((a, b) => a - b))).toEqual([-15, 15]);
  const scr = (a, b) => page.evaluate(([a, b]) => { const p = __tz.getCtx().views.front.map(a, b), s = document.querySelector('#sheet'), pt = s.createSVGPoint(); pt.x = p[0]; pt.y = p[1]; const q = pt.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, [a, b]);
  await page.click('#drawRibbon [data-dcmd="dim"]');
  for (const [a, b] of [[-11, 40], [-11, 52]]) { const [x, y] = await scr(a, b); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(150); }
  const d = await page.evaluate(() => __tz.dwS().dims.map(d => ({ kind: d.kind, a: [d.p1[0], d.p2[0]].map(Math.round).sort((x, y) => x - y) })));
  expect(d).toEqual([{ kind: 'h', a: [-15, 15] }]);
  expect(errors).toEqual([]);
});

test('montaj: düz yüzey + dairesel kenar çakışığında daire yüzeyin üzerinde yatar (parça devrilmez)', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 60, 60, 10);
  await page.evaluate(() => { const T = __tz; document.querySelector('[data-pa="new"]').click(); T.state.partName = 'Pul';
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(10, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 4; T.commitPM(); });
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  await page.keyboard.press('Escape');
  const [g, p] = await page.evaluate(() => __tz.project.parts.map(q => { __tz.addComp(q.id); const a = __tz.curAsm(); return a.comps[a.comps.length - 1].id; }));
  await page.click('[data-cmd="amate"]');
  const T = await page.evaluate(([g, p]) => { const d = __tz.asmUI.pm.draft;
    d.a = { comp: g, ref: { t: 'plane', n: [0, 1, 0], p: [0, 10, 0] } };
    d.b = { comp: p, ref: { t: 'axis', e: 'circ', p: [0, 0, 0], d: [0, 1, 0], r: 10, t0: 0, t1: 0 } };
    __tz.setMateType('coincident'); __tz.commitMate(); return __tz.curAsm().comps.find(c => c.id === p).T; }, [g, p]);
  // pulun ekseni dik kalır, alt dairesi plakanın üst yüzünde
  expect(Math.abs(T[5])).toBeCloseTo(1, 6);
  expect(T[13]).toBeCloseTo(10, 4);
  expect(await page.evaluate(() => __tz.curAsm().mates.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('teknik resim 2B çizim: konturu iki yandan aşan eksen çizgisi görünüşe bağlanır (görünüşle taşınır)', async ({ page }) => {
  const errors = await openApp(page);
  await plate(page, 40, 40, 30);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.click('#dwTabs [data-dwcm="sketch"]');
  const scr = (a, b) => page.evaluate(([a, b]) => { const p = __tz.getCtx().views.front.map(a, b), s = document.querySelector('#sheet'), pt = s.createSVGPoint(); pt.x = p[0]; pt.y = p[1]; const q = pt.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, [a, b]);
  await page.click('#drawRibbon [data-dcmd="scen"]');
  for (const [a, b] of [[0, -6], [0, 36]]) { const [x, y] = await scr(a, b); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(150); }
  expect(await page.evaluate(() => __tz.dwS().sk2d.map(e => e.view))).toEqual(['front']);
  expect(errors).toEqual([]);
});

/* ---------- ikinci kullanıcı turu: fare ve klavyeyle bulunanlar ---------- */

test('akıllı ölçü: kutu açılmadan (sonraki kareden önce) yazılan değer kaybolmaz', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(-20, -10); T.toolClick(20, 10); T.setTool('smartdim'); });
  // yavaş bir makinede kare gecikir: kare çağrıları bekletilir, ölçü yerleştirilir, değer hemen yazılır
  await page.evaluate(() => { const T = __tz; window.__q = []; window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = cb => { __q.push(cb); return 0; };
    T.toolClick(0, 10); T.toolClick(0, 18); });
  expect(await page.evaluate(() => !!document.querySelector('#viewport .pop'))).toBe(false);
  await page.keyboard.type('75');
  await page.keyboard.press('Enter');
  await page.evaluate(() => { window.requestAnimationFrame = window.__raf; for (const cb of __q) cb(performance.now()); });
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => { const T = __tz, f = T.sk.feat, c = f.cons.find(c => c.t === 'd'); const xs = Object.values(f.pts).map(p => p.x);
    return { val: c && c.val, w: +(Math.max(...xs) - Math.min(...xs)).toFixed(4), pop: !!document.querySelector('#viewport .pop') }; });
  expect(r).toEqual({ val: 75, w: 75, pop: false });
  expect(errors).toEqual([]);
});

test('teknik resim: genel not dikey A4 sayfada çerçevenin içinde, antetin üstünde kalır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  for (const [paper, orient] of [['A4', 'portrait'], ['A3', 'landscape']]) {
    await page.evaluate(([p, o]) => { const S = __tz.dwS(); S.paper = p; S.orient = o; __tz.renderDrawing(); }, [paper, orient]);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const t = [...document.querySelectorAll('#sheet text')].find(t => /ISO 2768/.test(t.textContent)); const b = t.getBBox();
      const vb = document.querySelector('#sheet').viewBox.baseVal; return { x0: b.x, x1: b.x + b.width, y1: b.y + b.height, W: vb.width, H: vb.height }; });
    expect(r.x0).toBeGreaterThan(20);
    expect(r.x1).toBeLessThan(r.W - 10);
    expect(r.y1).toBeLessThan(r.H - 46);
  }
  expect(errors).toEqual([]);
});

test('çizim radyusu: köşeye yakın (çizginin üstüne) tıklamak köşeyi yuvarlatır; ilişki simgeleri üst üste binmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); __tz.startSketch({ kind: 'std', key: 'front' }); });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('line');
    for (const [x, y] of [[0, 0], [60, 0], [60, 20], [30, 20], [30, 50], [0, 50], [0, 0]]) T.toolClick(x, y);
    T.setTool('sfillet'); T.toolClick(30, 20 + 4 * T.sk.px); T.setTool(null);
    return T.sk.feat.ents.filter(e => e.t === 'arc').length; });
  expect(r).toBe(1);
  await page.waitForTimeout(200);
  const pos = await page.evaluate(() => [...document.querySelectorAll('#labels .rlab')].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; }));
  expect(pos.length).toBeGreaterThan(6);
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) expect(Math.abs(pos[i][0] - pos[j][0]) + Math.abs(pos[i][1] - pos[j][1])).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test('çizim ofseti uygulanamıyorsa önizleme yerine neden panelde yazılır', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz; T.startSketch({ kind: 'std', key: 'front' }); T.sk.opts.grid = false; T.setTool('line');
    for (const [x, y] of [[0, 0], [60, 0], [60, 20], [30, 20], [30, 50], [0, 50], [0, 0]]) T.toolClick(x, y);
    T.sk.opts.filletR = 5; T.setTool('sfillet'); T.toolClick(30, 20); T.setTool(null);
    T.setSkOp('offset'); Object.assign(T.sk.op, { d: 5 }); T.selectItems(T.sk.feat.ents.map(e => ({ k: 'ent', id: e.id }))); });
  const note = () => page.evaluate(() => { const e = document.querySelector('#pm [data-operr]'); return e && !e.hidden ? e.textContent : ''; });
  await expect.poll(note).toContain('yarıçapından büyük');
  await page.evaluate(() => { __tz.sk.op.d = 3; __tz.sk.dirty = true; });
  await expect.poll(note).toBe('');
  expect(errors).toEqual([]);
});

test('arayüz: eşleştirme seçim listesi panele sığar; dar ekranda şerit etiketleri yan düğmeye taşmaz', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="asm"]');
  await page.click('#ribbon [data-cmd="amate"]');
  const over = await page.evaluate(() => [...document.querySelectorAll('#pm .lst > div')].map(d => d.getBoundingClientRect().right - d.parentElement.getBoundingClientRect().right));
  expect(over.length).toBeGreaterThan(1);
  for (const o of over) expect(o).toBeLessThan(1);
  await page.keyboard.press('Escape');
  await page.click('[data-tab="model"]');
  await page.setViewportSize({ width: 800, height: 700 });
  await page.waitForTimeout(400);
  const spill = await page.evaluate(() => [...document.querySelectorAll('#ribbon .rb')].map(b => { const s = b.querySelector('span'); return s ? s.scrollWidth - b.clientWidth : 0; }));
  for (const s of spill) expect(s).toBeLessThan(1);
  expect(errors).toEqual([]);
});
