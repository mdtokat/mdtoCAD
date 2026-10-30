// Makine parçaları: dişli, flanşlı boru ve dirsek, pompa çarkı, kademeli mil çizilerek bulunan hatalar
// (örnekler: ornekler/makine-parcalari-ciz.mjs).
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya, ad) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
  if (ad) await page.evaluate(ad => __tz.switchPart(__tz.project.parts.find(p => p.partName.startsWith(ad)).id), ad);
}
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3 && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === (__tz.dwSrc().kind === 'asm' ? __tz.curAsm().name : __tz.state.partName)));
  await page.waitForTimeout(300);
}
const sheetTexts = page => page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent.trim()));

for (const [dosya, ad, kutu, etiketler] of [
  ['duz-disli', 'Düz dişli', [51.98, 51.98, 30], ['Ø25', 'Ø40']],
  ['flansli-boru', 'Flanşlı boru', [165, 165, 300], ['Ø52,5', '2× Ø165', '8× Ø18', 'Ø125']],
  ['pompa-carki', 'Pompa çarkı', [200, 46, 200], ['Ø200', 'Ø25', 'Ø60', 'Ø90']],
  ['kademeli-mil', 'Kademeli mil', [305, 50, 50], ['Ø25', 'Ø35', 'Ø40', 'Ø50', 'Ø30', 'Ø6', 'M10×1,5']],
  ['kuyruk-yildizi', 'Kuyruk', [813, 813, 215], ['813', '215', 'Ø230']]]) {
  test(`örnek: ${dosya} hatasız, tam tanımlı ve teknik resmi ölçülü çizilir`, async ({ page }) => {
    const errors = await openApp(page);
    await openSample(page, dosya, ad);
    const r = await page.evaluate(() => { const m = __tz.model, b = m.box; return { err: m.errors, dof: Object.values(m.dof), box: b.min.map((v, i) => b.max[i] - v) }; });
    expect(r.err).toEqual({});
    for (const d of r.dof) expect(d).toBe(0);
    r.box.forEach((v, i) => expect(v).toBeCloseTo(kutu[i], 1));
    await openDrawing(page);
    const txt = await sheetTexts(page);
    for (const e of etiketler) expect(txt).toContain(e);
    expect(errors).toEqual([]);
  });
}

test('teknik resim: farklı özelliklerin çakışan daireleri tek etiket; kama kanallı delik çapıyla etiketlenir', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-boru', 'Flanşlı boru');
  await openDrawing(page);
  let txt = await sheetTexts(page);
  // borunun Ø52,5 deliği ve iki flanşın aynı deliği önceden üç ayrı etiketti (Ø52,5 ve 2× Ø52,5)
  expect(txt.filter(t => t.endsWith('Ø52,5'))).toEqual(['Ø52,5']);
  await page.click('[data-tab="model"]');
  await openSample(page, 'pompa-carki');
  await openDrawing(page);
  txt = await sheetTexts(page);
  expect(txt.filter(t => t.endsWith('Ø200'))).toEqual(['Ø200']); // arka disk ve ön örtü
  expect(txt).toContain('Ø25'); // Ø25 + kama kanalı: önceden hiç etiketlenmiyordu
  expect(errors).toEqual([]);
});

test('teknik resim: mil kademelerinin çapları ölçülür; montaj resminde çap ölçüsü ve delik etiketi yazılmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'kademeli-mil');
  await openDrawing(page);
  const r = await page.evaluate(() => { const c = __tz.getCtx(); return c.hits.filter(h => h.t === 'auto' && h.k.startsWith('cd:')).length; });
  expect(r).toBe(6);
  // aynı mil bir montajda: montaj resminde Ø ölçüleri yok
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  await page.evaluate(() => __tz.addComp(__tz.state.id));
  await page.click('[data-tab="drawing"]');
  await page.selectOption('#dDoc', await page.evaluate(() => 'a:' + __tz.curAsm().id));
  await openDrawing(page);
  const n = await page.evaluate(() => __tz.getCtx().hits.filter(h => (h.t === 'auto' && h.k.startsWith('cd:')) || h.t === 'lbl').length);
  expect(n).toBe(0);
  expect(errors).toEqual([]);
});

test('teknik resim: kısmi döndürmenin (dirsek) merkez işaretleri çerçeveden taşmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-boru', 'Dirsek');
  await openDrawing(page);
  const r = await page.evaluate(() => {
    const W = __tz.getCtx().W, H = __tz.getCtx().H; const out = [];
    for (const p of document.querySelectorAll('#sheet path.d-cen')) { const n = (p.getAttribute('d').match(/-?[\d.]+/g) || []).map(Number);
      for (let i = 0; i < n.length; i += 2) if (n[i] < 20 || n[i] > W - 10 || n[i + 1] < 10 || n[i + 1] > H - 10) out.push([n[i], n[i + 1]]); }
    return out;
  });
  expect(r).toEqual([]);
  expect(errors).toEqual([]);
});

test('döndürme: delikli profil (boru halkası) CSG olmadan döndürülür; hacim doğru, çokgen sayısı küçük', async ({ page }) => {
  await openApp(page);
  await openSample(page, 'flansli-boru', 'Dirsek');
  const r = await page.evaluate(() => ({ n: __tz.model.polys.length, vol: __tz.model.props.vol }));
  // halka alanı × ağırlık merkezinin yolu (R76, çeyrek daire); önceden 50 bin çokgen ve 12 sn
  const beklenen = Math.PI * (30.15 ** 2 - 26.25 ** 2) * (Math.PI * 76 / 2);
  expect(Math.abs(r.vol - beklenen) / beklenen).toBeLessThan(0.01);
  expect(r.n).toBeLessThan(6000);
});

test('CSG: radyus ve delik uzak yüzeyleri bölmez; iç köşe radyusu hacmi artırır', async ({ page }) => {
  await openApp(page);
  await openSample(page, 'kademeli-mil');
  const n = await page.evaluate(() => __tz.model.polys.length);
  expect(n).toBeLessThan(25000); // önceden ~55 bin
  await page.click('[data-tab="model"]');
  await openSample(page, 'flansli-boru', 'Flanşlı boru');
  const r = await page.evaluate(() => { const fs = __tz.state.features; const k = fs.findIndex(f => f.type === 'fillet');
    return { once: massProps(rebuildModel(fs, k).polys).vol, sonra: massProps(rebuildModel(fs).polys).vol }; });
  // R3 dolgu halkası: (1 − π/4)·R²·2π·(r + ~R/4,5), iki birleşim
  const beklenen = 2 * (1 - Math.PI / 4) * 9 * 2 * Math.PI * (30.15 + 0.67);
  expect(r.sonra - r.once).toBeGreaterThan(beklenen * 0.9);
  expect(r.sonra - r.once).toBeLessThan(beklenen * 1.1);
});

test('pah/radyus: kama kanallı delikte ve diş dibindeki kısa yayda çalışır', async ({ page }) => {
  await openApp(page);
  await openSample(page, 'duz-disli');
  const r = await page.evaluate(() => {
    const fs = __tz.state.features.filter(f => f.type !== 'chamfer'); const m = rebuildModel(fs); const v0 = massProps(m.polys).vol;
    const all = computeEdges(m.polys, null, true).filter(e => e.k === 1 && e.pa && e.pb); const rr = p => Math.hypot(p[0], p[1]);
    const kenar = (r, z) => all.find(e => Math.abs(rr(e.a) - r) < 0.01 && Math.abs(rr(e.b) - r) < 0.01 && Math.abs(e.a[2] - z) < 1e-3 && Math.abs(e.b[2] - z) < 1e-3);
    const dene = (t, e, v) => { const f = { id: 'x', type: t, [t === 'fillet' ? 'r' : 'd']: v, edges: [{ a: e.a, b: e.b }] }; const m2 = rebuildModel(fs.concat([f])); return { err: m2.errors, dv: massProps(m2.polys).vol - v0 }; };
    return { delik: dene('chamfer', kenar(12.5, 30), 1), dib: dene('chamfer', kenar(21.5, 20), 0.5), dibR: dene('fillet', kenar(21.5, 20), 0.5) };
  });
  expect(r.delik.err).toEqual({});
  // tam daire pahı ≈ d²/2 · 2π(r + d/3); kama kanalı payı düşer
  expect(r.delik.dv).toBeLessThan(-0.85 * 0.5 * 2 * Math.PI * (12.5 + 1 / 3));
  expect(r.delik.dv).toBeGreaterThan(-1.01 * 0.5 * 2 * Math.PI * (12.5 + 1 / 3));
  // diş dibi yayı: yalnızca iki diş arasındaki kısa yay işlenir (önceden “eğrisel kenar tanınamadı”)
  expect(r.dib.err).toEqual({});
  expect(r.dib.dv).toBeLessThan(0);
  expect(r.dib.dv).toBeGreaterThan(-1);
  expect(r.dibR.err).toEqual({});
  expect(r.dibR.dv).toBeGreaterThan(-1);
});

test('bölgeler: dairenin üstünde birleşen iki öğe bölme noktasını yinelemez (fazladan tam daire oluşmaz)', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // Ø20 daire ve köşeleri dairenin üstünde olan üçgen: her köşe iki çizgiden gelir
    const p = (a, r = 10) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
    const sk = { pts: { p1: p(Math.PI / 2), p2: p(Math.PI * 7 / 6), p3: p(-Math.PI / 6) }, cons: [],
      ents: [{ id: 'e1', t: 'circle', c: 'O', r: 10 }, { id: 'e2', t: 'line', a: 'p1', b: 'p2' }, { id: 'e3', t: 'line', a: 'p2', b: 'p3' }, { id: 'e4', t: 'line', a: 'p3', b: 'p1' }] };
    const t = performance.now(); const A = skArrangement(sk); const sh = sketchRegionShapes(sk);
    return { V: A.V.length, ms: performance.now() - t, n: sh.length, holes: sh[0].holes.length, area: area2d(sh[0].outer) };
  });
  expect(r.V).toBeLessThan(120); // önceden her köşede fazladan bir 64 kenarlı daire
  expect(r.n).toBe(1);
  expect(r.holes).toBe(0);
  expect(r.area).toBeCloseTo(Math.PI * 100, -1);
});

test('montaj: kama kanallı delik mile eşmerkezli eşleştirilir', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'duz-disli');
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  const r = await page.evaluate(() => {
    const T = __tz; const p = T.state; T.addComp(p.id); T.addComp(p.id);
    const a = T.curAsm(); const [c1, c2] = a.comps;
    const an = rebuildModel(p.features).ann.find(x => Math.abs(x.r - 12.5) < 1e-3);
    if (!an) return 'açıklama yok';
    const ref = { t: 'axis', p: [an.C.x, an.C.y, an.C.z], d: [an.A.x, an.A.y, an.A.z], r: an.r, t0: an.t0, t1: an.t1 };
    T.openMatePM(); const P = T.asmUI.pm; P.draft.a = { comp: c1.id, ref }; P.draft.b = { comp: c2.id, ref };
    T.setMateType('concentric'); T.commitMate();
    const b = T.curAsm(); const M = b.comps[1].T;
    return { mates: b.mates.length, unsolved: b._unsolved, x: M[12], y: M[13] };
  });
  expect(r.mates).toBe(1);
  expect(r.unsolved).toBe(false);
  expect(Math.hypot(r.x, r.y)).toBeLessThan(1e-3); // ikinci dişli birincinin eksenine taşındı
  expect(errors).toEqual([]);
});
