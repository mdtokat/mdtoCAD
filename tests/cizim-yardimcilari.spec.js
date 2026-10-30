// Çizim yardımcıları: ölçü etiketini sürükleme, seçilen öğenin boyut kutusu (ölçü eklemeden),
// hiza çizgileri ve teğet yakalama, ofset/çoğaltma önizlemesi.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function newSketch(page, key = 'front') {
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click(`.ti[data-plane="${key}"]`);
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await settle(page);
}
async function settle(page) {
  let prev = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const k = await page.evaluate(() => __tz.camBusy ? Math.random() : JSON.stringify([__tz.camera.position.toArray().map(v => v.toFixed(4)), __tz.camera.zoom.toFixed(6)]));
    if (k === prev) return;
    prev = k;
  }
}
const scr = (page, x, y) => page.evaluate(([x, y]) => __tz.scr(x, y), [x, y]);
const DIMS = ['d', 'dh', 'dv', 'dpl', 'dll', 'ddia', 'drad', 'dang', 'doff'];

test('ölçü etiketi fareyle sürüklenir; bırakınca tıklamadan üzerine gelmek onu taşımaz', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => {
    const T = __tz, f = T.sk.feat; T.setTool('line'); T.toolClick(0, 0); T.toolClick(40, 0); T.setTool(null);
    const e = f.ents[0]; f.cons.push({ id: 'cL', t: 'd', p: e.a, q: e.b, val: 40, lp: [20, 8] }); T.solveSketch(f); T.selectItems([]);
  });
  await page.waitForTimeout(200);
  const box = await page.locator('#labels .dlab[data-cid="cL"]').boundingBox();
  const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x0 + 60, y0 - 40, { steps: 15 });
  // sürüklerken etiket imleci izler (etiketler her karede yeniden oluşturulsa da)
  const mid = await page.locator('#labels .dlab[data-cid="cL"]').boundingBox();
  expect(Math.abs(mid.x + mid.width / 2 - (x0 + 60))).toBeLessThan(4);
  expect(Math.abs(mid.y + mid.height / 2 - (y0 - 40))).toBeLessThan(4);
  await page.mouse.up();
  const lp1 = await page.evaluate(() => __tz.sk.feat.cons.find(c => c.id === 'cL').lp.slice());
  expect(await page.evaluate(() => __tz.sk.ldrag)).toBeFalsy();
  // tuşa basmadan etiketin üzerinden geçmek onu taşımaz
  await page.mouse.move(x0 + 60, y0 - 40, { steps: 3 });
  await page.mouse.move(x0 + 140, y0 + 50, { steps: 10 });
  const lp2 = await page.evaluate(() => __tz.sk.feat.cons.find(c => c.id === 'cL').lp.slice());
  expect(lp2).toEqual(lp1);
  // bırakma olayı kaçsa da (düğme basılı değilken gelen hareket) sürükleme biter
  await page.mouse.move(x0 + 60, y0 - 40); await page.mouse.down(); await page.mouse.move(x0 + 70, y0 - 30, { steps: 4 });
  expect(await page.evaluate(() => !!__tz.sk.ldrag)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 900, clientY: 300, buttons: 0, pointerId: __tz.sk.ldrag.pid, pointerType: 'mouse' })));
  expect(await page.evaluate(() => __tz.sk.ldrag)).toBeFalsy();
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('seçilen daire ve dikdörtgene boyut yazılır; ölçü eklenmez, varsa mevcut ölçü değişir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(10, 0); T.setTool('rect'); T.toolClick(30, -10); T.toolClick(70, 10); T.setTool(null); });
  // daireye tıkla: kutu açılır, çap yazılır
  let p = await scr(page, 0, 10);
  await page.mouse.click(p[0], p[1]);
  expect(await page.evaluate(() => !!__tz.sizeEl)).toBe(true);
  expect(await page.locator('.sizepop input').first().inputValue()).toBe('20');
  await page.keyboard.type('36');
  await page.keyboard.press('Enter');
  let r = await page.evaluate(([D]) => { const f = __tz.sk.feat; return { r: f.ents.find(e => e.t === 'circle').r, dims: f.cons.filter(c => D.includes(c.t)).length, pop: !!__tz.sizeEl }; }, [DIMS]);
  expect(r.r).toBeCloseTo(18, 6);
  expect(r.dims).toBe(0);
  expect(r.pop).toBe(false);
  // dikdörtgenin üst kenarına tıkla: genişlik ve yükseklik
  p = await scr(page, 50, 10);
  await page.mouse.click(p[0], p[1]);
  const ins = page.locator('.sizepop input');
  await expect(ins).toHaveCount(2);
  expect(await ins.nth(0).inputValue()).toBe('40');
  expect(await ins.nth(1).inputValue()).toBe('20');
  await ins.nth(0).fill('55'); await ins.nth(1).fill('25'); await page.keyboard.press('Enter');
  r = await page.evaluate(([D]) => {
    const f = __tz.sk.feat; const ps = f.ents.filter(e => e.t === 'line').flatMap(e => [e.a, e.b]).map(id => f.pts[id]);
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), dims: f.cons.filter(c => D.includes(c.t)).length, ok: __tz.sk.ok };
  }, [DIMS]);
  expect(r.w).toBeCloseTo(55, 6); expect(r.h).toBeCloseTo(25, 6);
  expect(r.dims).toBe(0); expect(r.ok).toBe(true);
  // tek geri alma adımı
  await page.evaluate(() => document.querySelector('#undoBtn').click());
  const w0 = await page.evaluate(() => { const f = __tz.sk.feat; const xs = f.ents.filter(e => e.t === 'line').flatMap(e => [e.a, e.b]).map(id => f.pts[id].x); return Math.max(...xs) - Math.min(...xs); });
  expect(w0).toBeCloseTo(40, 6);
  // çapı zaten ölçülmüş daire: ölçünün değeri değişir, yeni ölçü eklenmez
  await page.evaluate(() => { const T = __tz, f = T.sk.feat; const c = f.ents.find(e => e.t === 'circle'); f.cons.push({ id: 'cD', t: 'ddia', e: c.id, val: 36, lp: [20, 20] }); T.solveSketch(f); T.selectItems([{ k: 'ent', id: c.id }]); T.openSizePop(c.id, [0, 0]); });
  await page.locator('.sizepop input').first().fill('30'); await page.keyboard.press('Enter');
  r = await page.evaluate(([D]) => { const f = __tz.sk.feat; return { r: f.ents.find(e => e.t === 'circle').r, val: f.cons.find(c => c.id === 'cD').val, dims: f.cons.filter(c => D.includes(c.t)).length }; }, [DIMS]);
  expect(r).toEqual({ r: expect.closeTo(15, 6), val: 30, dims: 1 });
  // Esc kutuyu kapatır; başka araca geçince de kapanır
  p = await scr(page, 0, 15);
  await page.mouse.click(p[0], p[1]);
  expect(await page.evaluate(() => !!__tz.sizeEl)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => !!__tz.sizeEl)).toBe(false);
  expect(errors).toEqual([]);
});

test('hiza çizgileri: üstünden geçilen noktanın dikey hizasına ve çizgi uzantısına yakalanır; daireye teğet çizgi', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('line'); T.toolClick(0, 0); T.toolClick(30, 20); T.setTool(null); T.setTool('line'); T.toolClick(-20, -30); });
  // (30,20) noktasının üstünden geç, sonra hizasının biraz yanına git
  let p = await scr(page, 30, 20); await page.mouse.move(p[0], p[1], { steps: 3 });
  const near = await page.evaluate(() => { const px = __tz.sk.px; return [30 + px * 3, -30 - px * 2]; });
  p = await scr(page, ...near); await page.mouse.move(p[0], p[1], { steps: 6 });
  const s = await page.evaluate(() => ({ wake: __tz.sk.wake.slice() }));
  expect(s.wake.length).toBeGreaterThan(0);
  await page.mouse.click(p[0], p[1]);
  let r = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents[f.ents.length - 1]; return { x: f.pts[e.b].x, y: f.pts[e.b].y, hv: f.cons.filter(c => c.e === e.id && (c.t === 'h' || c.t === 'v')).map(c => c.t) }; });
  // dikey hiza x = 30; başlangıçtan yatay hizayla kesişim y = -30
  expect(r.x).toBeCloseTo(30, 9); expect(r.y).toBeCloseTo(-30, 9); expect(r.hv).toEqual(['h']);
  // çizgi uzantısı: (30,20) ucundan geçerek eğik çizginin uzantısında bir noktaya
  await page.evaluate(() => { __tz.setTool(null); __tz.setTool('line'); __tz.toolClick(60, 0); });
  p = await scr(page, 30, 20); await page.mouse.move(p[0], p[1], { steps: 3 });
  const ext = await page.evaluate(() => { const px = __tz.sk.px; return [45 + px * 2, 30 - px * 2]; });
  p = await scr(page, ...ext); await page.mouse.move(p[0], p[1], { steps: 6 });
  const g = await page.evaluate(() => { const s = __tz.sk; const q = s.cursor; const gs = __tz.skGuides([60, 0], null); return __tz.guideSnap(gs, q, q, s.px * 9); });
  expect(g.guides.length).toBe(1);
  expect(g.x * 20 - g.y * 30).toBeCloseTo(0, 6); // (0,0)–(30,20) doğrusu üzerinde
  // daireye teğet: (40,-40)'tan r=10 daireye
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(80, -40); T.toolClick(90, -40); T.setTool('line'); T.toolClick(40, -40); });
  const tp = await page.evaluate(() => { const D = 40, r = 10, a = Math.acos(r / D); return [80 + r * Math.cos(Math.PI - a), -40 + r * Math.sin(Math.PI - a)]; });
  const px = await page.evaluate(() => __tz.sk.px);
  p = await scr(page, tp[0] + px * 3, tp[1] + px * 2); await page.mouse.move(p[0], p[1], { steps: 4 }); await page.mouse.click(p[0], p[1]);
  r = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents[f.ents.length - 1]; const c = f.ents.find(x => x.t === 'circle'); return { tan: f.cons.some(k => k.t === 'tan' && k.e1 === e.id && k.e2 === c.id), b: [f.pts[e.b].x, f.pts[e.b].y], ok: __tz.sk.ok }; });
  expect(r.tan).toBe(true);
  expect(r.b[0]).toBeCloseTo(tp[0], 5); expect(r.b[1]).toBeCloseTo(tp[1], 5);
  expect(r.ok).toBe(true);
  expect(errors).toEqual([]);
});

test('ofset, aynala ve çoğaltma uygulanmadan önizlenir; çizim değişmez', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const r = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(20, 10); T.setTool(null);
    const n0 = f.ents.length, c0 = f.cons.length;
    T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id })));
    const out = {};
    T.setSkOp('lpat'); Object.assign(T.sk.op, { n: 3, sp: 30, ang: 0 }); T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id })));
    const a = T.skOpPreview(); out.lpat = a && a.length; out.lpatMaxX = Math.max(...a.flatMap(s => [s[0][0], s[1][0]]));
    T.sk.op.n = 4; const b = T.skOpPreview(); out.lpat4MaxX = Math.max(...b.flatMap(s => [s[0][0], s[1][0]]));
    T.setSkOp('offset'); Object.assign(T.sk.op, { d: 2 }); T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id })));
    const o = T.skOpPreview(); out.off = o && o.length; out.offMaxX = Math.max(...o.flatMap(s => [s[0][0], s[1][0]]));
    T.setSkOp('cpat'); Object.assign(T.sk.op, { n: 4, tot: 360 }); T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id })));
    out.cpat = (T.skOpPreview() || []).length;
    out.same = f.ents.length === n0 && f.cons.length === c0 && T.sk.feat === f;
    return out;
  });
  expect(r.lpat).toBeGreaterThan(0);
  expect(r.lpatMaxX).toBeCloseTo(80, 6);
  expect(r.lpat4MaxX).toBeCloseTo(110, 6);
  expect(r.offMaxX).toBeCloseTo(22, 6);
  expect(r.cpat).toBeGreaterThan(0);
  expect(r.same).toBe(true);
  expect(errors).toEqual([]);
});
