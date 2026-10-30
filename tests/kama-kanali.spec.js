// Milde kama kanalı (yay kenarı mil yüzeyiyle aynı yarıçapta) ve referans düzlemlerin gizlenmesi.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

// Ø167 mil, mil ekseninden 297,5 mm uzaktaki düzlemde 38 × 13 kama kanalı profili (üstü mil yarıçapında yay), 216 mm kesme
const kamaMil = () => [
  { id: 's1', type: 'sketch', name: 'Ç1', on: { kind: 'std', key: 'front' }, pts: {}, ents: [{ id: 'e1', t: 'circle', c: 'O', r: 83.5 }], cons: [] },
  { id: 'x1', type: 'extrude', name: 'E1', op: 'add', sketch: 's1', end: 'blind', depth: 600 },
  { id: 'pl', type: 'plane', name: 'D1', base: { kind: 'face', feat: 'x1', which: 'near', sgn: -1 }, offset: 297.5, flip: true },
  { id: 's2', type: 'sketch', name: 'Ç2', on: { kind: 'plane', id: 'pl' },
    pts: { p7: { x: -19, y: 70.5 }, p8: { x: 19, y: 70.5 }, p10: { x: -19, y: Math.sqrt(83.5 ** 2 - 19 ** 2) }, p1: { x: 19, y: Math.sqrt(83.5 ** 2 - 19 ** 2) } },
    ents: [{ id: 'e3', t: 'line', a: 'p1', b: 'p8' }, { id: 'e4', t: 'line', a: 'p10', b: 'p7' }, { id: 'e5', t: 'line', a: 'p7', b: 'p8' }, { id: 'e10', t: 'arc', c: 'O', a: 'p1', b: 'p10' }], cons: [] },
  { id: 'x2', type: 'extrude', name: 'K1', op: 'cut', sketch: 's2', end: 'blind', depth: 216 }];

test('kama kanalı: yayı mil yarıçapında olan kesmede üstte şerit kalmaz', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(F => {
    const out = {};
    for (const seg of [64, 48, 32]) {
      __tz.setSetting('curveSeg', seg);
      const m = __tz.rebuildModel(F);
      // kanalın içinde (|x| < 19, taban 70,5'in üstü, kesme boyunca) hiçbir yüzey kalmamalı
      const kalan = m.polys.filter(p => { const v = p.verts, n = v.length; const c = v.reduce((s, q) => [s[0] + q.x / n, s[1] + q.y / n, s[2] + q.z / n], [0, 0, 0]);
        return Math.abs(c[0]) < 18.9 && c[1] > 70.6 && c[2] > 298 && c[2] < 513; });
      out[seg] = { err: m.errors, kalan: kalan.length };
    }
    __tz.setSetting('curveSeg', 64);
    return out;
  }, kamaMil());
  for (const seg of [64, 48, 32]) expect(r[seg]).toEqual({ err: {}, kalan: 0 });
  expect(errors).toEqual([]);
});

test('referans düzlem ağaçtaki göz düğmesiyle gizlenir; modeli yeniden hesaplatmaz, kaydedilir ve geri alınır', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz; T.startSketch({ kind: 'std', key: 'front' }); T.setTool('circle'); T.toolClick(0, 0); T.toolClick(20, 0); T.exitSketch(true); T.cmd('extrude'); T.commitPM(); });
  await page.evaluate(() => { __tz.cmd('plane'); __tz.pm.draft.base = 'front'; __tz.pm.draft.offset = 30; __tz.commitPM(); });
  const id = await page.evaluate(() => __tz.state.features.find(f => f.type === 'plane').id);
  const vis = () => page.evaluate(id => __tz.planeObjs.find(o => o.userData.key === id).visible, id);
  expect(await vis()).toBe(true);
  const btn = `#tree .ti[data-id="${id}"] [data-a="hide"]`;
  const misses = await page.evaluate(() => __tz.RB_CACHE.misses);
  await page.evaluate(b => document.querySelector(b).click(), btn);
  expect(await page.evaluate(id => __tz.state.features.find(f => f.id === id).hidden, id)).toBe(true);
  expect(await vis()).toBe(false);
  expect(await page.locator(`#tree .ti[data-id="${id}"]`).getAttribute('class')).toContain('hid');
  // gizlemek modeli değiştirmez: sonraki yeniden hesap önbellekten gelir
  await page.evaluate(() => __tz.rebuildModel(__tz.state.features));
  expect(await page.evaluate(() => __tz.RB_CACHE.misses)).toBe(misses);
  // ağaçta seçilince görünür, seçim kalkınca yine gizlenir
  const sec = () => page.evaluate(id => document.querySelector(`#tree .ti[data-id="${id}"] .nm`).click(), id);
  await sec();
  expect(await vis()).toBe(true);
  await page.waitForTimeout(500);
  await sec();
  expect(await vis()).toBe(false);
  // kayıt: dosyaya yazılan proje hidden alanını taşır
  await page.evaluate(() => __tz.flushState());
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('tezgah-cad-v3')).parts[0].features.find(f => f.id === id).hidden, id)).toBe(true);
  // göster: göz düğmesine yeniden basılır
  await page.evaluate(b => document.querySelector(b).click(), btn);
  expect(await page.evaluate(id => 'hidden' in __tz.state.features.find(f => f.id === id), id)).toBe(false);
  expect(await vis()).toBe(true);
  // geri al: yeniden gizli
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  expect(await vis()).toBe(false);
  expect(errors).toEqual([]);
});
