// Parça, montaj ve teknik resim arasındaki eşitleme; düzeltme/silme/ekleme sonrası bozulma olmaması.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const sheetReady = page => page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);

test('çizim ölçüsü değişince radyus kenarları bulunur (genişlik ve kalınlık)', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const T = __tz, out = {};
    // genişlik 120 → 150: köşe kenarları x = ±60'tan ±75'e kayar
    T.editSketch('s1'); T.setDimVal(T.sk.feat.cons.find(c => c.val === 120).id, 150); T.exitSketch(true);
    out.w = { err: { ...T.model.errors }, x: T.state.features.find(f => f.id === 'fl1').edges.map(e => e.a[0]).sort((a, b) => a - b) };
    // kalınlık 15 → 6: kenarların eski orta noktası (y = 7,5) artık gövdenin dışında
    T.openPM('extrude', T.state.features.find(f => f.id === 'x1')); T.pm.draft.depth = 6; T.commitPM();
    out.t = { err: { ...T.model.errors }, y: T.state.features.find(f => f.id === 'fl1').edges.map(e => Math.max(e.a[1], e.b[1])) };
    return out;
  });
  expect(r.w.err).toEqual({});
  expect(r.w.x).toEqual([-75, -75, 75, 75]);
  expect(r.t.err).toEqual({});
  for (const y of r.t.y) expect(y).toBeCloseTo(6, 6);
  expect(errors).toEqual([]);
});

test('bağlı öğesi olan özellik silinirken onay sorulur; birlikte silme ağacı hatasız bırakır, geri al hepsini getirir', async ({ page }) => {
  const errors = await openApp(page);
  const n0 = await page.evaluate(() => __tz.state.features.length);
  await page.evaluate(() => document.querySelector('.ti[data-id="x2"] [data-a="del"]').click());
  await expect(page.locator('#askDlg')).toHaveClass(/on/);
  await expect(page.locator('#askMsg')).toContainText('Çizim3');
  // iptal: hiçbir şey değişmez
  await page.click('#askBtns button:has-text("İptal")');
  expect(await page.evaluate(() => __tz.state.features.length)).toBe(n0);
  await page.evaluate(() => document.querySelector('.ti[data-id="x2"] [data-a="del"]').click());
  await page.click('#askBtns button:has-text("Bağlı öğelerle birlikte sil")');
  const r = await page.evaluate(() => ({ ids: __tz.state.features.map(f => f.id), err: __tz.model.errors }));
  expect(r.err).toEqual({});
  for (const id of ['x2', 's3', 'x3']) expect(r.ids).not.toContain(id);
  expect(r.ids).toContain('s2'); // özelliğin kendi çizimi ağaçta kalır
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => ({ n: __tz.state.features.length, err: __tz.model.errors }))).toEqual({ n: n0, err: {} });
  // çoğaltmanın hedeflerinden biri silinince kalan hedefle çalışmaya devam eder
  const p = await page.evaluate(() => {
    const T = __tz; T.state.features.find(f => f.id === 'lp1').targets.push('x3');
    document.querySelector('.ti[data-id="x4"] [data-a="del"]').click();
    return { open: document.querySelector('#askDlg').classList.contains('on'), targets: T.state.features.find(f => f.id === 'lp1').targets, err: T.model.errors };
  });
  expect(p.open).toBe(false);
  expect(p.targets).toEqual(['x3']);
  expect(p.err).toEqual({});
  expect(errors).toEqual([]);
});

test('döndürme ekseni silinip yeniden çizilince: kimlik başka çizgiye geçmez, yeni merkez çizgisi eksen olur', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const T = __tz;
    T.editSketch('s4'); T.selectItems([{ k: 'ent', id: 'e1' }]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    const warned = document.querySelector('#toast').textContent;
    T.setTool('line'); T.toolClick(30, 70); T.toolClick(40, 70); T.setTool(null);
    const line = T.sk.feat.ents[T.sk.feat.ents.length - 1].id;
    T.setTool('centerline'); T.toolClick(0, 0); T.toolClick(0, 65); T.setTool(null);
    const cl = T.sk.feat.ents[T.sk.feat.ents.length - 1].id;
    T.exitSketch(true);
    return { warned, line, cl, axis: T.state.features.find(f => f.id === 'r1').axis, err: T.model.errors };
  });
  expect(r.warned).toContain('döndürme ekseni');
  expect(r.line).not.toBe('e1');
  expect(r.cl).not.toBe('e1');
  expect(r.axis).toBe(r.cl);
  expect(r.err).toEqual({});
  expect(errors).toEqual([]);
});

test('parça değişince montaj eşleştirmesi yeni yüzeye geçer; montaj resmi güncel konumu ve malzemeyi kullanır', async ({ page }) => {
  const errors = await openApp(page);
  // montaj resmi önce bir kez çizilir (önbellek dolar)
  await page.click('[data-tab="asm"]');
  await page.click('[data-tab="drawing"]');
  await sheetReady(page);
  const m0 = await page.evaluate(() => __tz.dwSrc().massG);
  await page.click('[data-tab="model"]');
  const r = await page.evaluate(() => {
    const T = __tz; T.switchPart('P2');
    // mil omzu 100 → 110: omuz yüzeyine bağlı çakışık eşleştirme de 110'a taşınır
    T.editSketch('s1'); T.setDimVal('c10', 110); T.exitSketch(true);
    const a = T.curAsm();
    return { p: a.mates.find(m => m.id === 'm2').b.ref.p[1], y: a.comps.find(c => c.id === 'c2').T[13], unsolved: a._unsolved };
  });
  expect(r.p).toBeCloseTo(110, 6);
  expect(r.y).toBeCloseTo(-72, 4); // omuz gövdenin üstüne (y = 38) oturur
  expect(r.unsolved).toBe(false);
  // malzeme değişimi montaj resmindeki kütleyi günceller
  await page.selectOption('#matSel', 'al');
  // montaj sekmesine geçmeden montaj resmi açılır
  await page.click('[data-tab="drawing"]');
  await page.selectOption('#dDoc', 'a:A1');
  await sheetReady(page);
  const d = await page.evaluate(() => ({ kind: __tz.dwSrc().kind, mass: __tz.dwSrc().massG, bad: [...document.querySelectorAll('#tree .ti.err')].length }));
  expect(d.kind).toBe('asm');
  expect(d.mass).toBeLessThan(m0 - 200); // Ø26 çelik mil (~420 g) alüminyum oldu
  // montaj sekmesinde eşleştirmeler kırmızı değil
  await page.click('[data-tab="asm"]');
  await expect(page.locator('#tree .ti.err')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('teknik resim kendi geri al geçmişini kullanır; parçada geri almak resim ölçülerini silmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await sheetReady(page);
  // not ekle, seç, sil, geri al
  await page.evaluate(() => { __tz.setDwTool('note'); __tz.dwToolClick([60, 40], 'mouse'); });
  await page.waitForFunction(() => (__tz.dwS().notes || []).length === 1 && __tz.getCtx().hits.some(h => h.t === 'note'));
  await page.evaluate(() => { const h = __tz.getCtx().hits.find(h => h.t === 'note'); __tz.dwSelect(h); __tz.dwDeleteSel(); });
  expect(await page.evaluate(() => __tz.dwS().notes.length)).toBe(0);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => __tz.dwS().notes.length)).toBe(1);
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(() => __tz.dwS().notes.length)).toBe(0);
  // gizlenen görünüş geri alınır
  await page.waitForFunction(() => __tz.getCtx().hits.some(h => h.t === 'view' && h.k === 'top'));
  await page.evaluate(() => { __tz.dwSelect(__tz.getCtx().hits.find(h => h.t === 'view' && h.k === 'top')); __tz.dwDeleteSel(); });
  expect(await page.evaluate(() => __tz.dwS().hide)).toContain('V:top');
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => __tz.dwS().hide || [])).not.toContain('V:top');
  // montaj resminde Ctrl+Z parçanın özelliklerine dokunmaz
  const f0 = await page.evaluate(() => JSON.stringify(__tz.project.parts.map(p => p.features)));
  await page.selectOption('#dDoc', 'a:A1');
  await sheetReady(page);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => JSON.stringify(__tz.project.parts.map(p => p.features)))).toBe(f0);
  // parçaya dön: resme ölçü ekle, sonra modelde özelliği değiştir ve geri al → ölçü yerinde kalır
  await page.selectOption('#dDoc', 'p:P1');
  await sheetReady(page);
  await page.evaluate(() => __tz.dwS().dims.push({ view: 'front', kind: 'h', p1: [-60, 0], p2: [60, 0], pos: -10 }));
  await page.click('[data-tab="model"]');
  await page.evaluate(() => { const T = __tz; T.openPM('extrude', T.state.features.find(f => f.id === 'x1')); T.pm.draft.depth = 20; T.commitPM(); });
  await page.keyboard.press('Control+z');
  const u = await page.evaluate(() => ({ depth: __tz.state.features.find(f => f.id === 'x1').depth, dims: __tz.state.drawing.dims.length }));
  expect(u).toEqual({ depth: 15, dims: 1 });
  expect(errors).toEqual([]);
});

test('teknik resim: model değişince artık geometriye oturmayan elle ölçü işaretlenir', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await sheetReady(page);
  // ön görünüşün alt kenarı: -60 … 60 (genişlik 120)
  // akıllı ölçü: iki köşe, sonra ölçü çizgisinin yeri
  await page.evaluate(() => {
    const T = __tz, c = T.getCtx(), v = c.views.front, P = (a, b) => { const s = c.snaps.find(s => s.view === 'front' && Math.abs(s.a - a) < 1e-6 && Math.abs(s.b - b) < 1e-6); return [s.x, s.y]; };
    T.setDimMode(true); T.dimClick(P(-60, 0), 'mouse'); T.dimClick(P(60, 0), 'mouse'); T.dimClick(v.map(0, -12), 'mouse'); T.setDimMode(false);
  });
  await page.waitForFunction(() => __tz.dwS().dims.length === 1 && __tz.getCtx().stale && __tz.getCtx().hits.some(h => h.t === 'dim'));
  expect(await page.evaluate(() => __tz.dwS().dims[0].at)).toEqual([true, true]);
  expect(await page.evaluate(() => __tz.getCtx().stale.size)).toBe(0);
  await page.click('[data-tab="model"]');
  await page.evaluate(() => { const T = __tz; T.editSketch('s1'); T.setDimVal(T.sk.feat.cons.find(c => c.val === 120).id, 150); T.exitSketch(true); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => __tz.getCtx().stale && __tz.getCtx().stale.size === 1);
  await expect(page.locator('#dwPanel')).toContainText('modele uymuyor');
  // çıktıda kırmızı renk kullanılmaz
  const svg = await page.evaluate(() => __tz.buildSheet(true).markup);
  expect(svg).not.toContain('#D0342C');
  expect(errors).toEqual([]);
});

test('bastırma bağlı öğeleri de bastırır, geri getirince hepsi döner; ağaçta hata kalmaz', async ({ page }) => {
  const errors = await openApp(page);
  const sup = () => page.evaluate(() => Object.fromEntries(__tz.state.features.map(f => [f.id, !!f.suppressed])));
  await page.evaluate(() => document.querySelector('.ti[data-id="x2"] [data-a="sup"]').click());
  let s = await sup();
  for (const id of ['x2', 's2', 's3', 'x3']) expect(s[id]).toBe(true);
  expect(s.x1).toBe(false);
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  await page.evaluate(() => document.querySelector('.ti[data-id="x2"] [data-a="sup"]').click());
  s = await sup();
  expect(Object.values(s).some(Boolean)).toBe(false);
  // çoğaltmanın tek hedefi bastırılınca çoğaltma da bastırılır
  await page.evaluate(() => document.querySelector('.ti[data-id="x4"] [data-a="sup"]').click());
  s = await sup();
  expect(s.lp1).toBe(true);
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  expect(errors).toEqual([]);
});
