// Sekizinci kullanıcı turu (SolidWorks referans): 2B'ye aktarılan teknik resim otomatik ölçüler kapatılıp elle, tüm ayrıntılarıyla
// ölçülendirildi (kenar, paralel kenarlar, merkezler arası, daire–kenar, yay–yay, açı; kesit ve detay görünüşü; sürükleme, silme,
// geri alma; model ve izdüşüm değişimi). Bulunan hatalar: daireden sonra başka öğeye tıklamak uzaklık yerine çap yazısını oraya
// koyuyordu; yay merkezine bağlanan ölçü eklenir eklenmez kırmızıydı; detay görünüşüne ölçü verilemiyordu; dar ölçüde oklar
// birbirine değiyordu; delik dairesinin parçalarının birleşim yerleri nokta olarak seçiliyordu.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
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
/** sayfa koordinatına (mm) tıklar */
async function sheetClick(page, x, y) {
  const q = await page.evaluate(([x, y]) => { const s = document.querySelector('#sheet'), p = s.createSVGPoint(); p.x = x; p.y = y; const r = p.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
  await page.mouse.move(q[0] - 2, q[1] - 2); await page.mouse.move(q[0], q[1]); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(80);
}
const panel = page => page.evaluate(() => [...document.querySelectorAll('#dwPanel [data-dimrow] > span')].map(s => s.textContent.trim()));
const stale = page => page.evaluate(() => [...__tz.getCtx().stale]);
const R2 = Math.SQRT1_2;

test('daireden sonra ikinci öğe: merkezler arası, merkezden kenara, yay merkezleri arası (kırmızı değil)', async ({ page }) => {
  const errors = await openApp(page);
  await openManual(page);
  await page.click('[data-dcmd="dim"]');
  // iki delik dairesi (çevrelerinden): merkezler arası 96 (önceden ikinci tıklama Ø9 yazısının yeri sayılıyordu)
  await click(page, 'top', -48 + 4.5, 28);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe('dia');
  await click(page, 'top', 48 - 4.5, 28);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe(2);
  await click(page, 'top', 0, 40, 0, -15);
  // delik dairesi → tabanın sol kenarı: merkezin kenara uzaklığı 12, kenara dik (yatay)
  await click(page, 'top', -48, 28 - 4.5); await click(page, 'top', -60, -10); await click(page, 'top', -55, -40, 0, 15);
  // iki köşe radyusu (yay): merkezler arası 100; yay merkezine bağlı ölçü önceden eklenir eklenmez kırmızıydı
  await click(page, 'top', -50 - 10 * R2, 30 + 10 * R2); await click(page, 'top', 50 + 10 * R2, 30 + 10 * R2); await click(page, 'top', 0, 40, 0, -25);
  // daire → boş yer: çap yine yazılır. Dairenin tam üstüne tıklanınca 3 mm ötedeki radyus merkezi değil daire seçilir (önceden merkez seçiliyordu)
  await click(page, 'top', 48 + 4.5, -28); await click(page, 'top', 48, -28, 14, 12);
  expect(await panel(page)).toEqual(['Üst: 96 mm', 'Üst: 12 mm', 'Üst: 100 mm', 'Üst: Ø9 mm']);
  const d = await page.evaluate(() => __tz.dwS().dims.map(d => d.kind));
  expect(d).toEqual(['h', 'h', 'h', 'dia']);
  expect(await stale(page)).toEqual([]);
  // model değişince yay merkezleri arası güncellenir (radyus 10 → 8: merkezler 4 mm açılır)
  await page.click('[data-tab="model"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const T = __tz; const f = T.state.features.find(f => f.type === 'fillet'); T.openPM('fillet', f); T.pm.draft.r = 8; T.commitPM(); });
  await page.evaluate(() => { window.__o = __tz.getCtx(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && __tz.getCtx() !== window.__o && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
  expect(await panel(page)).toEqual(['Üst: 96 mm', 'Üst: 12 mm', 'Üst: 104 mm', 'Üst: Ø9 mm']);
  expect(await stale(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('detay görünüşünde akıllı ölçü: yarıçap, çap, merkezden kenara; ölçek, model ve izdüşüm değişimi, detay silinince ölçüleri de', async ({ page }) => {
  const errors = await openApp(page);
  await openManual(page);
  // üst görünüşün sağ üst köşesinden detay B (×2), yan görünüşün tabanından detay C
  await page.click('[data-dcmd="detail"]');
  await click(page, 'top', 50, 30); await click(page, 'top', 62, 30); await sheetClick(page, 75, 250);
  await page.click('[data-dcmd="detail"]');
  await click(page, 'left', 40, 7); await click(page, 'left', 50, 7); await sheetClick(page, 330, 250);
  expect(await page.evaluate(() => Object.keys(__tz.getCtx().views))).toEqual(expect.arrayContaining(['det:B', 'det:C']));
  await page.click('[data-dcmd="dim"]');
  await click(page, 'det:B', 50 + 10 * R2, 30 + 10 * R2); await click(page, 'det:B', 50, 30, 20, -14);   // R10
  await click(page, 'det:B', 48 - 4.5, 28); await click(page, 'det:B', 48, 28, -22, 10);                 // Ø9
  await click(page, 'det:B', 48, 28); await click(page, 'det:B', 60, 24); await click(page, 'det:B', 54, 22, 0, 14); // 12
  // detay dairesinin dışında kalan kenar parçası seçilmez
  await click(page, 'det:B', 60, 5);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe(0);
  await click(page, 'det:C', 40, 7); await click(page, 'det:C', 40, 7, 14, 0);                           // 15 (taban kalınlığı)
  await page.keyboard.press('Escape');
  expect(await panel(page)).toEqual(['Detay B: R10 mm', 'Detay B: Ø9 mm', 'Detay B: 12 mm', 'Detay C: 15 mm']);
  // ölçü detayın ölçeğiyle çizilir: çap kılavuzu 2 kat büyük daireye değer
  const g = await page.evaluate(() => { const c = __tz.getCtx(); return [c.views['det:B'].s / c.views.top.s, c.views['det:B'].clip.R]; });
  expect(g[0]).toBeCloseTo(2, 6);
  // detay sürüklenince ölçüler de taşınır (model koordinatı)
  await page.selectOption('[data-dk2="0"]', '4'); await page.waitForTimeout(300);
  expect(await panel(page)).toEqual(['Detay B: R10 mm', 'Detay B: Ø9 mm', 'Detay B: 12 mm', 'Detay C: 15 mm']);
  // izdüşüm yöntemi değişince yan görünüşten alınan detaydaki ölçü de aynalanır, kırmızı olmaz
  await page.selectOption('#dMethod', 'A'); await page.waitForTimeout(400);
  expect(await stale(page)).toEqual([]);
  await page.selectOption('#dMethod', 'E'); await page.waitForTimeout(400);
  // model değişince detaydaki ölçüler güncellenir
  await page.click('[data-tab="model"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const T = __tz; const F = t => T.state.features.filter(f => f.type === t);
    T.openPM('fillet', F('fillet')[0]); T.pm.draft.r = 8; T.commitPM();
    T.openPM('extrude', F('extrude')[0]); T.pm.draft.depth = 20; T.commitPM(); });
  await page.evaluate(() => { window.__o = __tz.getCtx(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && __tz.getCtx() !== window.__o && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
  expect(await panel(page)).toEqual(['Detay B: R8 mm', 'Detay B: Ø9 mm', 'Detay B: 12 mm', 'Detay C: 20 mm']);
  expect(await stale(page)).toEqual([]);
  // detay silinince ona bağlı ölçüler de silinir; geri alınca geri gelir
  await page.click('[data-xdel="details:0"]'); await page.waitForTimeout(300);
  expect(await panel(page)).toEqual(['Detay C: 20 mm']);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  expect(await panel(page)).toEqual(['Detay B: R8 mm', 'Detay B: Ø9 mm', 'Detay B: 12 mm', 'Detay C: 20 mm']);
  expect(errors).toEqual([]);
});

test('dar ölçüde oklar dışarıda; seçilen ölçü panelde vurgulanır; izometrikte uyarı; delik dairesinin birleşim yerleri nokta değil', async ({ page }) => {
  const errors = await openApp(page);
  await openManual(page);
  await page.click('[data-dcmd="dim"]');
  // ön görünüşte 6 mm'lik kanal: oklar uzatma çizgilerinin dışından gösterir, yazı ortada
  await click(page, 'front', -3, 47); await click(page, 'front', 3, 47); await click(page, 'front', 0, 60);
  const ok = await page.evaluate(() => { const g = document.querySelector('#sheet [data-dim="0"]');
    const xs = [...g.querySelectorAll('.d-ar')].map(p => p.getAttribute('d').match(/M([\d.]+)/)[1] * 1);
    const v = __tz.getCtx().views.front, L = v.map(-3, 0)[0], R = v.map(3, 0)[0];
    const tips = [...g.querySelectorAll('.d-ar')].map(p => { const n = p.getAttribute('d').match(/[\d.]+/g).map(Number); return [n[0], n[2]]; });
    const t = g.querySelector('text'), tx = +t.getAttribute('x');
    return { out: tips.every(([tip, base]) => (Math.abs(tip - L) < 0.01 && base < tip) || (Math.abs(tip - R) < 0.01 && base > tip)), mid: Math.abs(tx - (L + R) / 2) < 0.01, n: xs.length }; });
  expect(ok).toEqual({ out: true, mid: true, n: 2 });
  // izometrik görünüşe tıklanınca açıklama
  const iso = await page.evaluate(() => { const b = __tz.getCtx().hits.find(h => h.t === 'view' && h.k === 'iso').box; return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; });
  await sheetClick(page, iso[0] + 2, iso[1] + 2);
  await expect(page.locator('#toast')).toContainText('İzometrik');
  // ölçüyü resimde seçince panelde satırı vurgulanır
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await click(page, 'front', 60, 7); // önce boşa: seçim yok
  const b = await page.evaluate(() => __tz.getCtx().hits.find(h => h.t === 'dim' && h.i === 0).box);
  await sheetClick(page, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  expect(await page.evaluate(() => [...document.querySelectorAll('#dwPanel [data-dimrow].on')].map(r => r.dataset.dimrow))).toEqual(['0']);
  await page.keyboard.press('Escape');
  // kademeli milin pim deliği (ön görünüşte r 3 daire, kama kanalıyla bölünmüş): üstünde köşe noktası yok
  await openSample(page, 'kademeli-mil');
  await page.waitForFunction(() => __tz.getCtx() && __tz.getCtx().views.front && __tz.getCtx().views.front.d.bb.maxA > 300);
  const bad = await page.evaluate(() => __tz.getCtx().snaps.filter(s => s.view === 'front' && !s.c && Math.abs(Math.hypot(s.a - 285, s.b) - 3) < 0.01).length);
  expect(bad).toBe(0);
  expect(errors).toEqual([]);
});
