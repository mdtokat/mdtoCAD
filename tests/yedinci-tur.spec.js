// Yedinci kullanıcı turu (SolidWorks referans): 2B'ye aktarılan parça otomatik ölçüler (model öğeleri) kapatılıp akıllı ölçüyle
// elle ölçülendirildi. Bulunan hatalar: radyuslu tabanın alt kenarı 119,9 ölçülüyordu; eğik paralel kenarlar arası ve noktadan eğik
// kenara uzaklık imlecin yerine göre yatay/dikey bileşenle yazılıyor, uç kenarın uzantısına düşünce ölçü hemen kırmızı oluyordu;
// gizli çizgiler kapalıyken görünmeyen gizli kenarlar seçiliyordu; silindirin iki dış çizgisi arası Ø'siz yazılıyordu.
// Yenilikler: delik etiketi aracı (Hole Callout), yardımcı ölçü (parantez).
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
/** teknik resmi açar ve otomatik ölçüleri (model öğeleri) kapatır: ölçülendirme elle yapılacak */
async function openManual(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
  await page.click('[data-dcmd="autodims"]');
  await page.waitForFunction(() => __tz.dwS().autodims === false && !__tz.getCtx().hits.some(h => h.t === 'auto'));
}
/** görünüşteki model noktasına (a, b) gerçek fareyle tıklar; dx, dy sayfa mm kaydırma */
async function click(page, view, a, b, dx = 0, dy = 0) {
  const [x, y] = await page.evaluate(([view, a, b, dx, dy]) => {
    const v = __tz.getCtx().views[view], P = v.map(a, b), s = document.querySelector('#sheet'), p = s.createSVGPoint();
    p.x = P[0] + dx; p.y = P[1] + dy; const q = p.matrixTransform(s.getScreenCTM()); return [q.x, q.y];
  }, [view, a, b, dx, dy]);
  await page.mouse.move(x - 3, y - 2); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(50);
}
const panel = page => page.evaluate(() => [...document.querySelectorAll('#dwPanel .dimrow > span')].map(s => s.textContent.trim()));
const sonOlcu = page => page.evaluate(() => { const S = __tz.dwS(), c = __tz.getCtx(), i = S.dims.length - 1; return { ...S.dims[i], stale: c.stale.has(i) }; });
const metinler = page => page.evaluate(() => [...document.querySelectorAll('#sheet [data-dim] text')].map(t => t.textContent.trim()));

test('yatak gövdesi elle: radyuslu kenar tam boy, silüet kenarları arası Ø, kenar bittiyse uzatma çizgisi kenarın ucundan', async ({ page }) => {
  const errors = await openApp(page);
  await openManual(page);
  await page.click('[data-dcmd="dim"]');
  // ön görünüşün alt kenarı: köşeleri R10 yuvarlatılmış 120 × 80 taban (önceden radyusun son kirişi atlanıyor, 119,9 çıkıyordu)
  await click(page, 'front', 20, 0); await click(page, 'front', 20, 0, 0, 12);
  let d = await sonOlcu(page);
  expect([d.kind, d.p1[0], d.p2[0]].map(x => typeof x === 'number' ? Math.round(x * 1000) / 1000 : x)).toEqual(['h', -60, 60]);
  // gövdenin (Ø46 silindir) iki dış çizgisi: SolidWorks/ISO 129-1 gibi Ø46 (önceden “46”); imleç yukarıda da olsa yatay ölçü
  await click(page, 'front', -23, 30); await click(page, 'front', 23, 30); await click(page, 'front', 0, 70);
  d = await sonOlcu(page);
  expect([d.kind, d.pre]).toEqual(['h', 'Ø']);
  // iki paralel kenar arası (taban üstü – gövde üstü): uzatma çizgileri iki kenara da değer; imleç yana gitse de dikey ölçü
  await click(page, 'front', 50, 15); await click(page, 'front', 18, 50); await click(page, 'front', 80, 30);
  d = await sonOlcu(page);
  expect(d.kind).toBe('v');
  expect(Math.abs(d.p2[0])).toBeLessThanOrEqual(23 + 1e-6); // gövdenin üst kenarının üstünde (önceden x = 50, havada)
  expect(d.stale).toBe(false);
  // gövdenin üst köşesinden tabanın sol kenarına (y 0…15): ayak kenarın uzantısına (y = 50) düşüyor, uzatma çizgisi havada
  // başlıyor ve ölçü eklenir eklenmez kırmızı oluyordu; uç kenarın ucuna kırpılır
  await click(page, 'front', 23, 50); await click(page, 'front', -60, 7); await click(page, 'front', -20, 50, 0, -12);
  d = await sonOlcu(page);
  expect(d.stale).toBe(false);
  expect([d.kind, ...d.p2.map(x => Math.round(x * 1000) / 1000)]).toEqual(['h', -60, 15]);
  const p = await panel(page);
  expect(p).toEqual(['Ön: 120 mm', 'Ön: Ø46 mm', 'Ön: 35 mm', 'Ön: 83 mm']);
  // gizli çizgiler kapalıyken görünmeyen gizli kenar seçilmez (gövdenin deliği ön görünüşte kesikli: x = ±13)
  await page.keyboard.press('Escape');
  await page.click('[data-dcmd="hidden"]');
  await page.waitForFunction(() => __tz.dwS().hidden === false && __tz.getCtx().views.front.hidOn === false);
  await page.click('[data-dcmd="dim"]');
  await click(page, 'front', -13, 32);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe(0);
  await page.keyboard.press('Escape');
  await page.click('[data-dcmd="hidden"]');
  await page.click('[data-dcmd="dim"]');
  await click(page, 'front', -13, 32);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe('edge');
  expect(errors).toEqual([]);
});

test('bükülmüş braket elle: eğik kol kalınlığı ve noktadan eğik kenara uzaklık dik ölçülür, ölçü sürüklenince değer değişmez', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'bukulmus-braket');
  await openManual(page);
  await page.click('[data-dcmd="dim"]');
  // eğik kolun iki paralel kenarı (10 mm sac); imleç sola götürülünce önceden yatay bileşen 6,14 yazılıyordu
  await click(page, 'front', -44.4, -108.6); await click(page, 'front', -42.4, -90.2); await click(page, 'front', -60, -100, -10, 0);
  let d = await sonOlcu(page);
  expect(d.kind).toBe('a');
  expect(d.stale).toBe(false);
  expect(await panel(page)).toEqual(['Ön: 10 mm']);
  // ayağın alt köşesinden (−62, −165) kolun iç kenarına: dik uzaklık; ayak kenarın uzantısına düşer, uç kenarın ucuna kırpılır
  const beklenen = await page.evaluate(() => { const A = [-49.36159896850587, -115.03900146484376], B = [-29.47160530090332, -89.46597290039062];
    const l = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / l, (B[1] - A[1]) / l], P = [-62, -165];
    return Math.abs((P[0] - A[0]) * -u[1] + (P[1] - A[1]) * u[0]); });
  await click(page, 'front', -62, -165); await click(page, 'front', -39.4, -102.3); await click(page, 'front', -80, -150);
  d = await sonOlcu(page);
  expect(d.stale).toBe(false); // önceden ölçü eklenir eklenmez kırmızıydı
  const t = (await panel(page))[1];
  expect(t).toBe('Ön: ' + (Math.round(beklenen * 100) / 100).toLocaleString('tr-TR') + ' mm');
  // sürüklenen hizalı ölçünün değeri ve yönü korunur
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const box = await page.evaluate(() => __tz.getCtx().hits.find(h => h.t === 'dim' && h.i === 0).box);
  const s = await page.evaluate(b => { const s = document.querySelector('#sheet'), p = s.createSVGPoint(); p.x = (b[0] + b[2]) / 2; p.y = (b[1] + b[3]) / 2; const q = p.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, box);
  const pos0 = await page.evaluate(() => __tz.dwS().dims[0].pos);
  await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(s[0] - 30, s[1] - 10, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => __tz.dwS().dims[0].pos)).not.toBe(pos0);
  expect((await panel(page))[0]).toBe('Ön: 10 mm');
  expect(errors).toEqual([]);
});

test('delik etiketi aracı ve yardımcı ölçü (parantez)', async ({ page }) => {
  const errors = await openApp(page);
  await openManual(page);
  // SolidWorks Hole Callout: deliğe tıkla, etiketin yerine tıkla; aynı delikler “4×”
  await page.click('[data-dcmd="hcall"]');
  await click(page, 'top', 48 + 4.5 * Math.SQRT1_2, 28 + 4.5 * Math.SQRT1_2);
  // delik olmayan bir kenar seçilmez
  await click(page, 'top', 48, 28, 14, -10);
  let d = await sonOlcu(page);
  expect([d.kind, d.hc]).toEqual(['dia', true]);
  let t = await metinler(page);
  expect(t.some(x => /^4× Ø9/.test(x))).toBe(true);
  // akıllı ölçü düğmesine geçince delik etiketi kapanır
  await page.click('[data-dcmd="dim"]');
  expect(await page.evaluate(() => [document.querySelector('[data-dcmd="dim"]').classList.contains('on'), document.querySelector('[data-dcmd="hcall"]').classList.contains('on')])).toEqual([true, false]);
  await click(page, 'front', 20, 0); await click(page, 'front', 20, 0, 0, 12);
  // panelden yardımcı ölçü: parantez içinde, toleransı yazılmaz
  await page.selectOption('[data-dtt="1"]', 'sym');
  t = await metinler(page);
  await expect.poll(() => metinler(page)).toContain('120 ±0,1');
  await page.check('[data-dpar="1"]');
  await expect.poll(() => metinler(page)).toContain('(120)');
  expect(await page.evaluate(() => __tz.dwS().dims[1].par)).toBe(true);
  // delik etiketi satırında parantez seçeneği yok
  expect(await page.locator('[data-dpar="0"]').count()).toBe(0);
  expect(errors).toEqual([]);
});
