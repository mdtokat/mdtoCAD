// Ölçü çelişkileri: aşırı tanımlayan ölçü eklenmez, çelişen ölçüler sarı işaretlenir; referans (güdümlü) ölçü;
// çözülemeyen değer eski hâlinde kalır; çelişen ilişki uyarısı; seyrek çözücünün hızı.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function newSketch(page) {
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
}
/* 60 × 40 merkez dikdörtgen: genişlik ve yükseklik ölçülü */
async function rect(page) {
  const ids = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat;
    T.setTool('crect'); T.toolClick(0, 0); T.toolClick(30, 20);
    const P = id => f.pts[id];
    const top = f.ents.find(e => e.t === 'line' && Math.abs(P(e.a).y - P(e.b).y) < 1e-6 && P(e.a).y > 0);
    const left = f.ents.find(e => e.t === 'line' && Math.abs(P(e.a).x - P(e.b).x) < 1e-6 && P(e.a).x < 0);
    T.setTool('smartdim');
    T.toolClick(0, 20); T.toolClick(0, 28);
    const w = f.cons.find(c => c.t === 'd'); T.setDimVal(w.id, 60);
    T.toolClick(-30, 0); T.toolClick(-38, 0);
    const h = f.cons.find(c => c.t === 'd' && c !== w); T.setDimVal(h.id, 40);
    const corner = (sx, sy) => Object.keys(f.pts).find(id => Math.sign(P(id).x) === sx && Math.sign(P(id).y) === sy);
    return { w: w.id, h: h.id, top: top.id, left: left.id, a: corner(1, 1), b: corner(-1, -1) };
  });
  // ölçü eklenince bir sonraki karede açılan değer kutusu kapatılır
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => document.querySelectorAll('#viewport .pop:not(.confpop) button:last-child').forEach(b => b.click()));
  return ids;
}

test('aşırı tanımlayan ölçü: uyarı, sarı işaret, referans ölçü ve değiştirme', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const ids = await rect(page);
  // köşegen: genişlik ve yükseklikle zaten belirli → eklenmez, pencere açılır, iki ölçü sarı
  const r1 = await page.evaluate(({ a, b, w, h }) => {
    const T = __tz, f = T.sk.feat, n = f.cons.length;
    const pa = f.pts[a], pb = f.pts[b];
    T.toolClick(pa.x, pa.y); T.toolClick(pb.x, pb.y); T.toolClick(4, 3);
    return { n0: n, n1: f.cons.length, pop: !!T.confEl, text: T.confEl && T.confEl.textContent, wConf: !!T.sk.conf && T.sk.conf.has(w), hConf: !!T.sk.conf && T.sk.conf.has(h) };
  }, ids);
  expect(r1.n1).toBe(r1.n0);
  expect(r1.pop).toBe(true);
  expect(r1.wConf && r1.hConf).toBe(true);
  expect(r1.text).toContain('72,111');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/olcu-celiskisi.png' });
  // sarı etiketler ekranda
  expect(await page.locator('#labels .dlab.conf').count()).toBeGreaterThanOrEqual(3);
  // referans ölçü olarak ekle: geometriyi sürmez, değeri güncellenir
  await page.click('.confpop [data-cf="ref"]');
  const r2 = await page.evaluate(({ w }) => {
    const T = __tz, f = T.sk.feat; const d = f.cons.find(c => c.driven);
    const dof = T.sk.an.dof; T.setDimVal(w, 90);
    return { d: !!d, id: d && d.id, dof, dofAfter: T.sk.an.dof, val: d.val, pop: !!T.confEl };
  }, ids);
  expect(r2.d).toBe(true);
  expect(r2.dof).toBe(r2.dofAfter);
  expect(r2.val).toBeCloseTo(Math.hypot(90, 40), 3);
  await page.waitForFunction(id => { const l = document.querySelector(`#labels [data-cid="${id}"]`); return l && l.textContent.startsWith('(') && l.classList.contains('drv'); }, r2.id);
  expect(r2.pop).toBe(false);
  // referans ölçüyü sürücü yapmak çelişir → pencere; genişliği referansa çevirip köşegeni sürücü yap
  await page.evaluate(id => __tz.setDriven(id, false), r2.id);
  await expect(page.locator('.confpop')).toBeVisible();
  await page.click(`.confpop [data-cfx="${ids.w}"]`);
  const r3 = await page.evaluate(({ w, h, id }) => {
    const T = __tz, f = T.sk.feat;
    const ok = T.setDimVal(id, 100);
    const P = k => f.pts[k];
    const top = f.ents.find(e => e.id === T.sk.feat.ents.find(x => x.id === e.id).id && e.t === 'line' && Math.abs(P(e.a).y - P(e.b).y) < 1e-6 && P(e.a).y > 0);
    return { ok, wDrv: !!f.cons.find(c => c.id === w).driven, dDrv: !!f.cons.find(c => c.id === id).driven, width: Math.abs(P(top.a).x - P(top.b).x), wVal: f.cons.find(c => c.id === w).val };
  }, { ...ids, id: r2.id });
  expect(r3.ok).toBe(true);
  expect(r3.wDrv).toBe(true);
  expect(r3.dDrv).toBe(false);
  expect(r3.width).toBeCloseTo(Math.sqrt(100 * 100 - 40 * 40), 3);
  expect(r3.wVal).toBeCloseTo(r3.width, 3);
  // geometriyle çelişen değer: yükseklik köşegenden büyük olamaz → uygulanmaz, çelişenler sarı
  const r4 = await page.evaluate(({ h, id }) => {
    const T = __tz, f = T.sk.feat; const before = JSON.stringify(f.pts);
    const ok = T.setDimVal(h, 120);
    return { ok, same: JSON.stringify(f.pts) === before, hv: f.cons.find(c => c.id === h).val, conf: T.sk.conf ? [...T.sk.conf] : [] };
  }, { ...ids, id: r2.id });
  expect(r4.ok).toBe(false);
  expect(r4.same).toBe(true);
  expect(r4.hv).toBe(40);
  expect(r4.conf).toContain(ids.h);
  expect(r4.conf).toContain(r2.id);
  await expect(page.locator('#toast')).toContainText('sarı');
  expect(errors).toEqual([]);
});

test('çelişen ilişki: dik ilişkisi yatay + dikey ile zaten belirli', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const ids = await rect(page);
  const r = await page.evaluate(({ top, left }) => {
    const T = __tz, f = T.sk.feat; T.setTool(null); const n = f.cons.length;
    T.selectItems([{ k: 'ent', id: top }, { k: 'ent', id: left }]);
    T.addRelation('perp');
    const rel = id => f.cons.find(c => c.id === id);
    return { n0: n, n1: f.cons.length, conf: T.sk.conf ? [...T.sk.conf].map(id => rel(id).t) : [], ents: T.sk.confEnts ? [...T.sk.confEnts] : [] };
  }, ids);
  expect(r.n1).toBe(r.n0);
  expect(r.conf.sort()).toEqual(['h', 'v']);
  expect(r.ents).toContain(ids.top);
  await expect(page.locator('#toast')).toContainText('aşırı tanımlar');
  // Esc sarı işareti kaldırır
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => !!__tz.sk.conf)).toBe(false);
  expect(errors).toEqual([]);
});

test('yüklenen çelişkili çizim: sağlanamayan ölçüler sarı, durum aşırı tanımlı', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const ids = await rect(page);
  // çizim dışarıdan bozulmuş gibi: genişlik ölçüsü geometriyle uyuşmuyor
  const r = await page.evaluate(({ w }) => {
    const T = __tz; const f = T.sk.feat; T.exitSketch(true);
    f.cons.find(c => c.id === w).val = 75;
    T.editSketch(f.id);
    return { sk: !!T.sk, unsat: T.sk.unsat, ok: T.sk.ok, note: !!document.querySelector('#pm .confnote'), lab: !!document.querySelector(`#labels [data-cid="${w}"]`) };
  }, ids);
  expect(r.sk).toBe(true);
  expect(r.unsat).toContain(ids.w);
  expect(r.ok).toBe(false);
  expect(r.note).toBe(true);
  await page.waitForFunction(w => { const l = document.querySelector(`#labels [data-cid="${w}"]`); return l && l.classList.contains('conf'); }, ids.w);
  // değeri düzeltince çelişki kalkar
  const r2 = await page.evaluate(({ w }) => { const T = __tz; T.setDimVal(w, 60); return { unsat: T.sk.unsat, ok: T.sk.ok }; }, ids);
  expect(r2.unsat).toEqual([]);
  expect(r2.ok).toBe(true);
  expect(errors).toEqual([]);
});

test('seyrek çözücü: 144 noktalı dişli çiziminde ölçü değiştirmek ve tam tanımlamak hızlı', async ({ page }) => {
  const errors = await openApp(page);
  await page.setInputFiles('#fileInput', 'ornekler/duz-disli.tocad.json');
  await page.waitForFunction(() => __tz.state.features.some(f => f.type === 'sketch' && Object.keys(f.pts).length > 100));
  const r = await page.evaluate(() => {
    const T = __tz; const f = T.state.features.find(f => f.type === 'sketch' && Object.keys(f.pts).length > 100);
    T.editSketch(f.id);
    const d = T.sk.feat.cons.find(c => c.t === 'ddia');
    let t = performance.now(); const ok = T.setDimVal(d.id, d.val * 1.02); const solve = performance.now() - t;
    const copy = JSON.parse(JSON.stringify(T.sk.feat)); copy.cons = copy.cons.filter(c => !/^d/.test(c.t));
    t = performance.now(); const n = T.autoDefine(copy, {}).length; const ad = performance.now() - t;
    t = performance.now(); const a = T.analyzeSketch(T.sk.feat); const an = performance.now() - t;
    return { ok, solve, n, ad, an, dof: a.dof };
  });
  console.log('dişli çizimi (ms):', JSON.stringify({ solve: Math.round(r.solve), autoDefine: Math.round(r.ad), analyze: Math.round(r.an) }));
  expect(r.ok).toBe(true);
  expect(r.dof).toBe(0);
  expect(r.n).toBeGreaterThan(0);
  // önceki tam yoğun çözücüde ~0,25 sn / ~0,9 sn / ~60 ms
  expect(r.solve).toBeLessThan(400);
  expect(r.ad).toBeLessThan(400);
  expect(errors).toEqual([]);
});
