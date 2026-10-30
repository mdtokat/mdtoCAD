// Teknik resimde 2B çizim: çizgi, eksen çizgisi, dikdörtgen, daire, yay, merkez işareti; yakalama, görünüşe bağlama, sürükleme, silme.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.waitForTimeout(300);
}
const redraw = page => page.waitForTimeout(120);

test('2B çizim: çizgi zinciri, eksen çizgisi, daire, yay ve merkez işareti görünüşe bağlanır', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  await page.click('[data-dwcm="sketch"]');
  await expect(page.locator('#drawRibbon [data-dcmd="sline"]')).toBeVisible();
  // çizgi: ön görünüşün iki köşesi arasında (yakalanır), zincir devam eder; aynı noktaya tıklayınca biter
  await page.click('#drawRibbon [data-dcmd="sline"]');
  // ön görünüşün sol üst ve sağ alt köşeleri (görünüşteki kenar uçları)
  const r = await page.evaluate(() => {
    const c = __tz.getCtx(), sn = c.snaps.filter(s => s.view === 'front' && !s.c);
    const a = sn.reduce((p, s) => (s.x + s.y < p.x + p.y ? s : p)), b = sn.reduce((p, s) => (s.x + s.y > p.x + p.y ? s : p));
    __tz.dwToolClick([a.x, a.y], 'mouse'); __tz.dwToolClick([b.x, b.y], 'mouse');
    return { a, b, B: [b.x, b.y] };
  });
  await redraw(page);
  let S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S.length).toBe(1);
  expect(S[0].view).toBe('front');
  expect(S[0].p[0][0]).toBeCloseTo(r.a.a, 6); // köşeye yakalandı (görünüş koordinatı, model mm)
  expect(S[0].p[0][1]).toBeCloseTo(r.a.b, 6);
  expect(S[0].p[1][0]).toBeCloseTo(r.b.a, 6);
  // zincir: üçüncü tıklama ikinci çizgiyi ekler (yataya hizalanır), aynı noktaya tıklama zinciri bitirir
  await page.evaluate(([B]) => { __tz.dwToolClick([B[0] - 40, B[1] + 0.8], 'mouse'); }, [r.B]);
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S.length).toBe(2);
  expect(S[1].p[1][1]).toBeCloseTo(S[1].p[0][1], 6);
  // yeni sayfa noktasında çizgi: görünüş dışında → sayfaya bağlı
  await page.keyboard.press('Escape');
  await page.evaluate(() => { __tz.dwToolClick([30, 30], 'mouse'); __tz.dwToolClick([60, 30.5], 'mouse'); });
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S.length).toBe(3);
  expect(S[2].view).toBe(null);
  expect(S[2].p[1]).toEqual([60, 30]);
  // eksen çizgisi: üst görünüşün iki paralel dış kenarının ortasına
  await page.keyboard.press('Escape');
  await page.click('#drawRibbon [data-dcmd="scen"]');
  const top = await page.evaluate(() => {
    const v = __tz.getCtx().views.top, bb = v.d.bb, ym = bb.minB + (bb.maxB - bb.minB) * 0.37;
    const L = v.map(bb.minA, ym), R = v.map(bb.maxA, ym);
    __tz.dwToolClick(L, 'mouse'); __tz.dwToolClick(R, 'mouse');
    return { mid: (bb.minA + bb.maxA) / 2 };
  });
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  const cl = S[3];
  expect(cl.st).toBe('cen');
  expect(cl.view).toBe('top');
  expect(cl.p[0][0]).toBeCloseTo(top.mid, 3);
  expect(cl.p[1][0]).toBeCloseTo(top.mid, 3);
  // kesik çizgili daire: delik merkezinden geçen (merkez ve yarıçap noktası yakalanır), çapı panelden 80 yapılır
  await page.click('#drawRibbon [data-dcmd="scirc"]');
  await page.selectOption('#dLtype', 'hid');
  await page.evaluate(() => {
    const v = __tz.getCtx().views.top, c = v.d.circ[0], C = v.map(c.a, c.b);
    __tz.dwToolClick([C[0] + 0.2, C[1]], 'mouse'); __tz.dwToolClick([C[0] + 20, C[1] + 0.3], 'mouse');
  });
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S[4].t).toBe('circ');
  expect(S[4].st).toBe('hid');
  expect(S[4].view).toBe('top');
  const n = await page.locator('[data-sksz="4"]').count();
  expect(n).toBe(1);
  await page.fill('[data-sksz="4"]', '80');
  await page.waitForTimeout(400);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S[4].r).toBeCloseTo(40, 6);
  let mk = await page.evaluate(() => __tz.buildSheet(true).markup);
  expect(mk).toMatch(/<circle class="d-hid"/);
  expect(mk).toMatch(/class="d-cen" d="M/);
  // yay: merkez, başlangıç, bitiş
  await page.click('#drawRibbon [data-dcmd="sarc"]');
  await page.evaluate(() => { __tz.dwToolClick([100, 100], 'mouse'); __tz.dwToolClick([110, 100], 'mouse'); __tz.dwToolClick([100, 90], 'mouse'); });
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S[5].t).toBe('arc');
  expect(S[5].r).toBeCloseTo(10, 6);
  expect(Math.abs(S[5].sw)).toBeCloseTo(Math.PI / 2, 4);
  // merkez işareti: dairenin çevresine tıkla
  await page.click('#drawRibbon [data-dcmd="scmark"]');
  await page.evaluate(() => { const v = __tz.getCtx().views.front; const q = v.d.circ[0] || null; if (q) { const C = v.map(q.a, q.b); __tz.dwToolClick([C[0] + q.r * v.s, C[1]], 'mouse'); } else { const t = __tz.getCtx().views.top, c = t.d.circ[0], C = t.map(c.a, c.b); __tz.dwToolClick([C[0] + c.r * t.s, C[1]], 'mouse'); } });
  await redraw(page);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S[6].t).toBe('cmark');
  // görünüş sürüklenince bağlı öğeler de taşınır
  await page.keyboard.press('Escape');
  const before = await page.evaluate(() => { const c = __tz.getCtx(); const h = c.hits.find(x => x.t === 'sk' && x.i === 0); return h.box; });
  await page.evaluate(() => { const c = __tz.getCtx(); const h = c.hits.find(x => x.t === 'view' && x.k === 'front'); const pan = { hit: h }; __tz.dwDragMove(pan, 10, 5); __tz.dwDragEnd(pan); });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => __tz.getCtx().hits.find(x => x.t === 'sk' && x.i === 0).box);
  expect(after[0] - before[0]).toBeCloseTo(10, 3);
  expect(after[1] - before[1]).toBeCloseTo(5, 3);
  // seçme (çizgiye yakın tıklama), ucundan sürükleme, silme
  const hit = await page.evaluate(() => { const g = __tz.getCtx().hits.find(x => x.t === 'sk' && x.i === 2); return __tz.dwHitAt([60, 30.1], 'mouse'); });
  expect(hit.t).toBe('sk');
  expect(hit.grip).toBe('p1');
  await page.evaluate(() => { const h = __tz.dwHitAt([60, 30.1], 'mouse'); const pan = { hit: h }; __tz.dwDragMove(pan, 5, 10); __tz.dwDragEnd(pan); });
  await page.waitForTimeout(200);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S[2].p[1][0]).toBeCloseTo(65, 1);
  expect(S[2].p[1][1]).toBeCloseTo(40.1, 3); // tutulan nokta (30,1) + 10
  expect(S[2].p[0]).toEqual([30, 30]);
  // boş yere tıklama çizimi seçmez (kutusu değil kendisi)
  const none = await page.evaluate(() => __tz.dwHitAt([30, 39], 'mouse'));
  expect(none && none.t === 'sk' && none.i === 2).toBeFalsy();
  await page.evaluate(() => { __tz.dwSelect(__tz.dwHitAt([45, 30 + 5], 'mouse')); __tz.dwDeleteSel(); });
  await page.waitForTimeout(200);
  S = await page.evaluate(() => __tz.dwS().sk2d);
  expect(S.length).toBe(6);
  // PDF ve DXF çıktılarında
  const dxf = await page.evaluate(() => __tz.exportDXFString());
  expect(dxf).toContain('GIZLI');
  // geri al
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => __tz.dwS().sk2d.length)).toBe(7);
  expect(errors).toEqual([]);
});

test('akıllı ölçü çizim öğesine oturur; ölçünün yardımcı çizgileri ölçülen kenara değer', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  // ön görünüşün genel genişlik ölçüsü: yardımcı çizgiler görünüşün alt köşelerinden başlar
  const g = await page.evaluate(() => {
    const c = __tz.getCtx(), v = c.views.front, bb = v.d.bb, BL = v.map(bb.minA, bb.minB);
    const paths = [...document.querySelectorAll('#sheet path.d-thin')].map(p => p.getAttribute('d'));
    return { BL, paths };
  });
  const hasExt = g.paths.some(d => d.includes(`M${Math.round(g.BL[0] * 100) / 100} ${Math.round(g.BL[1] * 100) / 100}L`));
  expect(hasExt).toBe(true);
  // ön görünüşün içine çizilen eksen çizgisinin uçları arasına akıllı ölçü
  await page.click('[data-dwcm="sketch"]');
  await page.click('#drawRibbon [data-dcmd="scen"]');
  const L = await page.evaluate(() => { const v = __tz.getCtx().views.front, bb = v.d.bb; const A = v.map(bb.minA - 3, bb.maxB + 2), B = v.map(bb.maxA + 3, bb.maxB + 2); __tz.dwToolClick(A, 'mouse'); __tz.dwToolClick(B, 'mouse'); return [A, B]; });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await redraw(page);
  await page.evaluate(([A, B]) => { __tz.setDimMode(true); __tz.dimClick(A, 'mouse'); __tz.dimClick(B, 'mouse'); __tz.dimClick([(A[0] + B[0]) / 2, A[1] - 8], 'mouse'); }, L);
  await page.waitForTimeout(200);
  const d = await page.evaluate(() => ({ dims: __tz.dwS().dims, stale: [...__tz.getCtx().stale] }));
  expect(d.dims.length).toBe(1);
  expect(d.dims[0].view).toBe('front');
  expect(d.stale).toEqual([]);
  expect(errors).toEqual([]);
});
