// Teknik resimde ölçüleri fareyle taşıma: sol tuşla ölçü (yazısından veya ölçü çizgisinden) tutulup sağa-sola ve aşağı-yukarı
// sürüklenir, sağ tuş her zaman sayfayı kaydırır, sol tuşla boşlukta sürüklemek de sayfayı kaydırır. Önceden ölçüyü tutmaya
// çalışınca sayfa oynuyordu (otomatik ölçüler hiç taşınmıyor, ölçü aracı açıkken elle ölçüler de tutulamıyordu).
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3 && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === __tz.state.partName));
  await page.waitForTimeout(300);
}
/** sayfa mm → ekran pikseli */
const scr = (page, p) => page.evaluate(p => { const m = document.querySelector('#sheet').getScreenCTM(); return [m.a * p[0] + m.e, m.d * p[1] + m.f, m.a] }, p);
const vbox = page => page.evaluate(() => document.querySelector('#sheet').getAttribute('viewBox'));
async function drag(page, from, dx, dy, button = 'left') {
  await page.mouse.move(from[0], from[1]); await page.mouse.down({ button });
  await page.mouse.move(from[0] + dx, from[1] + dy, { steps: 6 }); await page.mouse.up({ button });
  await page.waitForTimeout(250);
}
/** genel genişlik ölçüsünün (ow:front) ölçü çizgisi üstünde, yazıdan uzak bir nokta ve yazının merkezi (sayfa mm) */
const owFront = page => page.evaluate(() => {
  const h = __tz.getCtx().hits.find(x => x.t === 'auto' && x.k === 'ow:front'); const b = h.box;
  return { line: [h.gb[0] + 4, h.gb[3]], text: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], tb: b };
});

test('otomatik ölçü sol tuşla çizgisinden tutulup her yöne taşınır; sağ tuş ve boşlukta sol tuş sayfayı kaydırır', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  const a = await owFront(page);
  // ölçü çizgisi yatay: tutulan nokta çizginin üstünde (oklar arasında, yazıdan uzakta)
  const lineY = await page.evaluate(() => { const h = __tz.getCtx().hits.find(x => x.t === 'auto' && x.k === 'ow:front'); return h.segs.reduce((y, q) => Math.abs(q[1] - q[3]) < 1e-6 ? q[1] : y, null) });
  const P = await scr(page, [a.line[0] + 6, lineY]);
  const vb0 = await vbox(page);
  // sol tuş: 40 px sağa, 30 px aşağı → ölçü çizgisi aşağı iner, yazı sağa kayar; sayfa kaymaz
  await drag(page, P, 40, 30);
  expect(await vbox(page)).toBe(vb0);
  const ao = await page.evaluate(() => __tz.dwS().aofs['ow:front']);
  expect(ao[0]).toBeCloseTo(40 / P[2], 0); expect(ao[1]).toBeCloseTo(30 / P[2], 0);
  const b = await owFront(page);
  expect((b.tb[1] + b.tb[3]) / 2 - (a.tb[1] + a.tb[3]) / 2).toBeCloseTo(30 / P[2], 0);
  expect((b.tb[0] + b.tb[2]) / 2 - (a.tb[0] + a.tb[2]) / 2).toBeCloseTo(40 / P[2], 0);
  // yazısından tutup sola ve yukarı taşı
  const T = await scr(page, b.text);
  await drag(page, T, -25, -10);
  expect(await vbox(page)).toBe(vb0);
  const ao2 = await page.evaluate(() => __tz.dwS().aofs['ow:front']);
  expect(ao2[0]).toBeCloseTo((40 - 25) / P[2], 0); expect(ao2[1]).toBeCloseTo((30 - 10) / P[2], 0);
  // sağ tuş ölçünün üstünde bile sayfayı kaydırır, ölçü yerinde kalır; sağ tık menüsü açılmaz
  const c = await owFront(page);
  await drag(page, await scr(page, c.text), 50, 20, 'right');
  expect(await vbox(page)).not.toBe(vb0);
  expect(await page.evaluate(() => __tz.dwS().aofs['ow:front'])).toEqual(ao2);
  // sol tuşla boşlukta sürüklemek sayfayı kaydırır
  const vb1 = await vbox(page);
  const E = await page.evaluate(() => { const r = document.querySelector('#sheet').getBoundingClientRect(); return [r.left + 12, r.top + 12] });
  await drag(page, E, 30, 30);
  expect(await vbox(page)).not.toBe(vb1);
  expect(await page.evaluate(() => __tz.dwS().aofs['ow:front'])).toEqual(ao2);
  // geri al: ölçü eski yerine döner
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (__tz.dwS().aofs || {})['ow:front'])).toEqual(ao);
  expect(errors).toEqual([]);
});

test('elle ölçü, ölçü aracı açıkken de sol tuşla tutulup sağa-sola (yazı) ve aşağı-yukarı (ölçü çizgisi) taşınır', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  // otomatik ölçüleri kapat, ön görünüşün alt kenarına yatay elle ölçü ekle
  await page.click('[data-dcmd="autodims"]');
  await page.waitForFunction(() => __tz.dwS().autodims === false && !__tz.getCtx().hits.some(h => h.t === 'auto'));
  await page.evaluate(() => { const bb = __tz.getCtx().views.front.d.bb; __tz.dwS().dims.push({ view: 'front', kind: 'h', p1: [bb.minA, bb.minB], p2: [bb.maxA, bb.minB], pos: bb.minB - 15 }); __tz.renderDrawing() });
  await page.waitForFunction(() => __tz.getCtx().hits.some(h => h.t === 'dim'));
  await page.waitForTimeout(200);
  await page.click('[data-dcmd="dim"]');
  const d0 = await page.evaluate(() => ({ ...__tz.dwS().dims[0] }));
  const h = await page.evaluate(() => { const h = __tz.getCtx().hits.find(x => x.t === 'dim'); return { tb: h.box, gb: h.gb } });
  const vb0 = await vbox(page);
  const T = await scr(page, [(h.tb[0] + h.tb[2]) / 2, (h.tb[1] + h.tb[3]) / 2]);
  await drag(page, T, 60, 25);
  expect(await vbox(page)).toBe(vb0);
  const d1 = await page.evaluate(() => ({ ...__tz.dwS().dims[0], n: __tz.dwS().dims.length }));
  expect(d1.n).toBe(1); // ölçü aracı yeni ölçü başlatmadı
  const s = await page.evaluate(() => __tz.getCtx().views.front.s);
  expect(d1.pos - d0.pos).toBeCloseTo(-25 / T[2] / s, 0);
  expect(d1.tx * s).toBeCloseTo(60 / T[2], 0);
  // yazı gerçekten sağa kaydı, ölçü çizgisi yazının altına kadar uzar
  const h2 = await page.evaluate(() => __tz.getCtx().hits.find(x => x.t === 'dim').box);
  expect((h2[0] + h2[2]) / 2 - (h.tb[0] + h.tb[2]) / 2).toBeCloseTo(60 / T[2], 0);
  // ölçü aracında tıklamak (sürüklemeden) hâlâ ölçü seçer: elle ölçü listesi değişmez, araç açık kalır
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe(0);
  expect(errors).toEqual([]);
});
