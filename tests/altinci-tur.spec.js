// Altıncı kullanıcı turu (SolidWorks referans, ISO 129-1 ölçülendirme kuralları): 3B modelden 2B'ye aktarılan teknik resimlerin
// ölçüleri kurallara göre denetlendi. Bulunan hatalar: kapalı zincir, büyük ölçünün küçüğün içinde kalması, aynı ölçünün tekrarı,
// ölçü yazısını kesen çizgiler, gizli çizgiye verilen ölçüler, 180°'den büyük yayın çapla ölçülmemesi, pah kenarına yarıçap,
// eksik ekstrüzyon derinlikleri, elle ölçünün standart uzaklığa yakalanmaması.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3 && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === __tz.state.partName));
  await page.waitForTimeout(300);
}
const metinler = page => page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent.trim()));
const otomatik = page => page.evaluate(() => __tz.getCtx().hits.filter(h => h.t === 'auto' || h.t === 'lbl').map(h => ({ k: h.k, t: h.t, box: h.box, segs: h.segs || [] })));
/** bir metnin sayfadaki (mm) kutusu */
const metinKutusu = (page, t) => page.evaluate(t => {
  const s = document.querySelector('#sheet'), m = s.getScreenCTM().inverse();
  const P = (x, y) => { const p = s.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(m); };
  return [...s.querySelectorAll('text')].filter(e => e.textContent.trim() === t).map(e => { const r = e.getBoundingClientRect(), a = P(r.left, r.top), b = P(r.right, r.bottom); return [a.x, a.y, b.x, b.y]; });
}, t);
/** doğru parçası kutuyu kesiyor mu (sayfa mm) */
function kesiyor(q, B) {
  let t0 = 0, t1 = 1; const dx = q[2] - q[0], dy = q[3] - q[1];
  for (const [p, r] of [[-dx, q[0] - B[0]], [dx, B[2] - q[0]], [-dy, q[1] - B[1]], [dy, B[3] - q[1]]]) {
    if (Math.abs(p) < 1e-12) { if (r < 0) return false; continue; }
    const u = r / p; if (p < 0) { if (u > t1) return false; if (u > t0) t0 = u; } else { if (u < t0) return false; if (u < t1) t1 = u; }
  }
  return t0 <= t1;
}

test('kademeli mil: kapalı zincirde yardımcı ölçü, kısa ölçü içte, yakın kenardan delik, çap tekrarlanmaz, eksen çap yazısını kesmez', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'kademeli-mil');
  await openDrawing(page);
  const t = await metinler(page);
  // 40 + 60 + 90 + 15 + 45 + 13,15 + 1,85 + 40 = 305: zincir genel boyla kapanır, en uzun kademe yardımcı ölçüdür (parantez)
  expect(t).toContain('(90)');
  expect(t.filter(x => /^\(.*\)$/.test(x)).length).toBe(1);
  expect(t).toContain('305');
  // pim deliği milin sağ ucuna yakın: 285 değil sağ uçtan 20
  expect(t).toContain('20');
  expect(t).not.toContain('285');
  // yaka çapı Ø50 bir kez (önceden uç görünüşte yeniden yazılıyordu)
  expect(t.filter(x => x === 'Ø50').length).toBe(1);
  const h = await otomatik(page);
  const hp = h.find(x => x.k === 'hp:front:h:0'), ow = h.find(x => x.k === 'ow:front');
  expect(hp.box[1]).toBeLessThan(ow.box[1]); // 20 içte, 305 dışta (önceden 285, 305'in dışındaydı)
  expect(h.filter(x => x.k.startsWith('kb:')).length).toBe(8);
  // profil içi çap yazılarını eksen çizgisi kesmez (önceden Ø25, Ø35, Ø40… eksenin tam üstündeydi). Testte web yazı tipi
  // yüklenmez, yedek yazı tipi biraz geniştir: eksen yazının ortasından değil en fazla ucundan geçebilir
  const eksen = await page.evaluate(() => __tz.getCtx().views.front.map(0, 0)[1]);
  for (const d of ['Ø25', 'Ø35', 'Ø40', 'Ø30', 'Ø50']) {
    const kutular = await metinKutusu(page, d);
    expect(kutular.length).toBeGreaterThan(0);
    for (const B of kutular) { const f = (eksen - B[1]) / (B[3] - B[1]); expect(f < 0.1 || f > 0.9).toBe(true); }
  }
  expect(errors).toEqual([]);
});

test('daire biçimli parçalar: genel boyut bir kez Ø ile; 180°\'den büyük yay çapla; pah kenarına yarıçap yazılmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'pompa-carki');
  await openDrawing(page);
  let t = await metinler(page);
  // önceden ön ve yan görünüşte “200”, üst görünüşte “Ø200” (üç kez)
  expect(t.filter(x => x.endsWith('200'))).toEqual(['Ø200']);
  await page.click('[data-tab="model"]');
  await openSample(page, 'dort-kanatli-disk');
  await openDrawing(page);
  t = await metinler(page);
  // kanat uçları Ø813 çemberinde: genişlik ve yükseklik aynı çaptır (önceden 813 / 813)
  expect(t.filter(x => x.endsWith('813') && !x.startsWith('Dört'))).toEqual(['Ø813']);
  // kama kanallı Ø143 delik (yay ~330°) önceden hiç ölçülmüyordu
  expect(t).toContain('Ø143');
  // elle akıllı ölçü: 180°'den büyük yaya tıklanınca da çap (ISO 129-1)
  await page.evaluate(() => { __tz.setDimMode(true); const v = __tz.getCtx().views.front; const ar = v.d.arcs.find(a => Math.abs(a.r - 71.5) < 0.01);
    const th = ar.t0 + ar.sw / 2, C = v.map(ar.a, ar.b), R = ar.r * v.s; const p = [C[0] + Math.cos(th) * R, C[1] - Math.sin(th) * R];
    __tz.dimClick(p, 'mouse'); __tz.dimClick([p[0] + 15, p[1] - 15], 'mouse'); });
  const d = await page.evaluate(() => __tz.dwS().dims.at(-1));
  expect([d.kind, !!d.rad, Math.round(d.r * 2)]).toEqual(['dia', false, 143]);
  expect((await metinler(page)).filter(x => x === 'Ø143').length).toBe(2);
  await page.click('[data-tab="model"]');
  await openSample(page, 'duz-disli');
  await openDrawing(page);
  t = await metinler(page);
  // delik ağzındaki 1 × 45° pahın kama kanalıyla kesilen dairesi “R13,5” yazılıyordu
  expect(t).not.toContain('R13,5');
  expect(t).toContain('Ø25');
  // montaj resmi: kaplinin flanşı üst görünüşte daire; genişlik ve derinlik aynı çaptır (önceden ön ve yan görünüşte 120 / 120)
  await page.click('[data-tab="model"]');
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="adraw"]');
  await page.waitForFunction(() => !!__tz.getCtx() && __tz.getCtx().views.front && __tz.dwSrc().kind === 'asm');
  await page.waitForTimeout(300);
  t = await metinler(page);
  expect(t.filter(x => /^Ø?120$/.test(x))).toEqual(['Ø120']);
  expect(errors).toEqual([]);
});

test('yarım yuvarlak uç çap değildir; etiketler ölçü ve uzatma çizgilerini kesmez, birbirine değmez', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'bukulmus-braket');
  await openDrawing(page);
  const t = await metinler(page);
  // braketin R25 yarım yuvarlak ucu: genişlik 50 (Ø50 değil)
  expect(t).toContain('50');
  expect(t).not.toContain('Ø50');
  for (const ornek of ['bukulmus-braket', 'yatakli-stand']) {
    if (ornek !== 'bukulmus-braket') { await page.click('[data-tab="model"]'); await openSample(page, ornek); await openDrawing(page); }
    const h = await otomatik(page);
    // kılavuzlu etiketler (delik, çap, radyus): başka ölçünün çizgisi yazıyı kesmez (önceden R16 uzatma çizgisinin,
    // R22 ve delik etiketi ölçü çizgisinin üstündeydi)
    const etiket = h.filter(x => x.t === 'lbl' || /^(ar|pcd|cd):/.test(x.k) && x.segs.length === 2);
    expect(etiket.length).toBeGreaterThan(3);
    const kesen = [];
    for (const e of etiket) for (const o of h) if (o !== e) for (const q of o.segs) if (kesiyor(q, e.box)) kesen.push(e.k + ' × ' + o.k);
    expect(kesen).toEqual([]);
    // etiket yazıları birbirine değmez (önceden “Ø40Ø18” tek yazı gibi okunuyordu)
    const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    for (let i = 0; i < etiket.length; i++) for (let j = i + 1; j < etiket.length; j++) {
      const a = etiket[i].box, b = etiket[j].box; expect(ov([a[0] - 0.3, a[1] - 0.3, a[2] + 0.3, a[3] + 0.3], b)).toBe(0);
    }
  }
  expect(errors).toEqual([]);
});

test('gizli çizgiye ölçü verilmez: standın kademeli deliği zincir ölçülmez, L destekte Ø27 görünür göbeğe yazılır', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'yatakli-stand');
  await openDrawing(page);
  let h = await otomatik(page);
  // üstten bakınca üst üste düşen ve gizli kalan kademeli delik önceden 21 / 20 / 21 zincir ölçüsü alıyordu
  expect(h.filter(x => x.k.startsWith('kb:'))).toEqual([]);
  let t = await metinler(page);
  for (const e of ['9', '60', 'Ø26']) expect(t).toContain(e); // taban kalınlığı, kolon derinliği, köşe göbekleri (yay > 180°)
  await page.click('[data-tab="model"]');
  await openSample(page, 'l-destek');
  await openDrawing(page);
  t = await metinler(page);
  expect(t).toContain('Ø27');
  // Ø27 göbek yan görünüşte duvarın arkasında (kesikli): ön görünüşte profilin içinden, görünür dış çizgilerine
  const r = await page.evaluate(() => { const c = __tz.getCtx(); const v = c.views.front, b = v.d.bb, A = v.map(b.minA, b.maxB), B = v.map(b.maxA, b.minB);
    const h = c.hits.find(x => x.t === 'auto' && x.k.startsWith('L:'));
    return h ? { ic: h.box[0] > A[0] && h.box[2] < B[0] && h.box[1] > A[1] && h.box[3] < B[1] } : null; });
  expect(r).toEqual({ ic: true });
  // delikler sağ kenara yakın: 22 değil sağ kenardan 8
  expect(t).toContain('8');
  expect(errors).toEqual([]);
});

test('ekstrüzyon derinlikleri ölçülür, kapalı zincir oluşturmaz; elle ölçü standart uzaklığa yakalanır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
  const h = await otomatik(page);
  // yatak gövdesi: taban kalınlığı 15 (önceden yoktu); gövde 35 yazılmaz (15 + 35 = 50 genel yükseklikle kapalı zincir)
  const ex = h.filter(x => x.k.startsWith('ex:'));
  expect(ex.map(x => x.k)).toEqual(['ex:x1']);
  const t = await metinler(page);
  expect(t).toContain('15');
  expect(t).not.toContain('35');
  // kısa ölçü içte: 15 görünüşe 50'den yakın
  const oh = h.find(x => x.k === 'oh:front');
  expect(ex[0].box[0]).toBeGreaterThan(oh.box[0]);
  // elle ölçü: ön görünüşün alt kenarı; görünüşten ~17 mm aşağı tıklanınca 16 mm'lik sıraya oturur (9 + 7)
  const r = await page.evaluate(() => { const T = __tz, c = T.getCtx(), v = c.views.front, b = v.d.bb;
    T.setDimMode(true);
    const p1 = v.map(b.minA, b.minB), p2 = v.map(b.maxA, b.minB);
    T.dimClick(p1, 'mouse'); T.dimClick(p2, 'mouse'); T.dimClick([(p1[0] + p2[0]) / 2, p1[1] + 17.2], 'mouse');
    const d = T.dwS().dims.at(-1); return { kind: d.kind, mm: Math.round((b.minB - d.pos) * v.s * 100) / 100 }; });
  expect(r).toEqual({ kind: 'h', mm: 16 });
  expect(errors).toEqual([]);
});
