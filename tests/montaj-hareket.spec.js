// SolidWorks montaj iş akışı: bileşeni sürükleyerek taşıma/döndürme, Bileşeni Taşı paneli, kenar ve yay yüzeyi seçimi,
// teğet, kilitle, simetrik, genişlik, sınır, menteşe, dişli, kremayer–pinyon ve vida eşleştirmeleri.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
async function newAsmWith(page, names) {
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  await page.keyboard.press('Escape');
  return page.evaluate(names => names.map(n => { __tz.addComp(__tz.project.parts.find(p => p.partName === n).id); const a = __tz.curAsm(); __tz.asmUI.sel = null; return a.comps[a.comps.length - 1].id; }), names);
}
const T_ = (page, id) => page.evaluate(id => __tz.curAsm().comps.find(c => c.id === id).T.slice(), id);
/** bileşenin yerel noktasının ekran konumu */
const scrOf = (page, id, p) => page.evaluate(([id, p]) => { const M = __tz.curAsm().comps.find(c => c.id === id).T;
  return __tz.scrW([0, 1, 2].map(i => M[i] * p[0] + M[4 + i] * p[1] + M[8 + i] * p[2] + M[12 + i])); }, [id, p]);
/** panelde yuvaya seçim: 'a' silindir (yerel nokta), normal: düz yüzey */
const pickRef = (page, slot, cid, p, k) => page.evaluate(([slot, cid, p, k]) => {
  const v = __tz.asmView.groups.get(cid); let s = null;
  if (k === 'a') { for (const an of v.d.ann) { const w = { x: p[0] - an.C.x, y: p[1] - an.C.y, z: p[2] - an.C.z }; const t = w.x * an.A.x + w.y * an.A.y + w.z * an.A.z;
    if (Math.abs(Math.hypot(w.x - an.A.x * t, w.y - an.A.y * t, w.z - an.A.z * t) - an.r) < 0.05 && t >= an.t0 - 0.2 && t <= an.t1 + 0.2) { s = { comp: cid, ref: { t: 'axis', p: [an.C.x, an.C.y, an.C.z], d: [an.A.x, an.A.y, an.A.z], r: an.r, t0: an.t0, t1: an.t1 } }; break; } } }
  else { const w = k[0] * p[0] + k[1] * p[1] + k[2] * p[2]; s = { comp: cid, ref: { t: 'plane', n: k, p: k.map(x => x * w) } }; }
  __tz.asmUI.pm.draft[slot] = s;
}, [slot, cid, p, k]);
const setType = (page, t) => page.evaluate(t => __tz.setMateType(t), t);
/** bileşenin dünya Y ekseni etrafındaki açısı (derece; yerel X'in izdüşümü) */
const yaw = T => Math.atan2(-T[2], T[0]) * 180 / Math.PI;
const zrot = T => Math.atan2(T[1], T[0]) * 180 / Math.PI;

test('bileşen araçsız sürüklenir; sabit bileşende görünüm döner; eşmerkezli mil eksen boyunca kayar, sağ tuşla eksen etrafında döner; geri alınır', async ({ page }) => {
  const errors = await openApp(page);
  const [g, m] = await newAsmWith(page, ['Yatak gövdesi', 'Mil']);
  await page.evaluate(() => __tz.fitCamera(null, false)); await page.waitForTimeout(250);
  // serbest mil: sol tuşla sürüklenir (önceden görünüm dönüyordu, bileşen yerinde kalıyordu)
  const t0 = await T_(page, m);
  let [x, y] = await scrOf(page, m, [13, 50, 0]);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y + 20, { steps: 5 }); await page.mouse.up();
  const t1 = await T_(page, m);
  expect(Math.hypot(t1[12] - t0[12], t1[13] - t0[13], t1[14] - t0[14])).toBeGreaterThan(10);
  // sabit gövde: sürükleme görünümü döndürür, gövde yerinde
  const cam0 = await page.evaluate(() => __tz.camera.position.toArray());
  [x, y] = await scrOf(page, g, [40, 15, 0]);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y, { steps: 5 }); await page.mouse.up();
  expect((await T_(page, g)).slice(12, 15)).toEqual([0, 0, 0]);
  expect(await page.evaluate(() => __tz.camera.position.toArray())).not.toEqual(cam0);
  // eşmerkezli: fareyle mil yüzeyi ve gövde deliği (görünüm üstten, delik görünür)
  await page.evaluate(() => __tz.fitCamera([0.3, 1, 0.5], false)); await page.waitForTimeout(250);
  await page.click('[data-cmd="amate"]');
  await page.evaluate(([m, g]) => { const pk = (id, p) => { const M = __tz.curAsm().comps.find(c => c.id === id).T; const s = __tz.scrW([0, 1, 2].map(i => M[i] * p[0] + M[4 + i] * p[1] + M[8 + i] * p[2] + M[12 + i])); return __tz.asmPick({ clientX: s[0], clientY: s[1] }); };
    __tz.mateSelect(pk(m, [0, 60, 13])); __tz.mateSelect(pk(g, [0, 28, -13])); }, [m, g]);
  expect(await page.evaluate(() => { const d = __tz.asmUI.pm.draft; return [d.a.ref.r, d.b.ref.r, d.type, __tz.asmUI.pm.err]; })).toEqual([13, 13, 'concentric', '']);
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  await page.evaluate(() => __tz.fitCamera(null, false)); await page.waitForTimeout(250);
  const c0 = await T_(page, m);
  [x, y] = await scrOf(page, m, [0, 105, 17]);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 50, { steps: 6 }); await page.mouse.up();
  const c1 = await T_(page, m);
  // eksende kalır, yukarı kayar
  expect(Math.abs(c1[12]) + Math.abs(c1[14])).toBeLessThan(1e-3);
  expect(c1[13] - c0[13]).toBeGreaterThan(5);
  // sağ tuş: eksen etrafında döner, eksende ve aynı yükseklikte kalır
  [x, y] = await scrOf(page, m, [0, 105, 17]);
  await page.mouse.move(x, y); await page.mouse.down({ button: 'right' }); await page.mouse.move(x + 70, y, { steps: 6 }); await page.mouse.up({ button: 'right' });
  const c2 = await T_(page, m);
  expect(Math.abs(yaw(c2) - yaw(c1))).toBeGreaterThan(10);
  expect(Math.abs(c2[12]) + Math.abs(c2[14])).toBeLessThan(1e-3);
  expect(Math.abs(c2[13] - c1[13])).toBeLessThan(2);
  expect(Math.abs(c2[5] - 1)).toBeLessThan(1e-6);
  // her sürükleme ayrı geri alma adımı
  await page.keyboard.press('Control+z');
  expect((await T_(page, m)).map(v => +v.toFixed(5))).toEqual(c1.map(v => +v.toFixed(5)));
  expect(await page.evaluate(() => __tz.controls.enabled)).toBe(true);
  expect(errors).toEqual([]);
});

test('Bileşeni Taşı paneli: ΔXYZ, XYZ konumuna, ΔXYZ döndürme; montaj X ekseni boyunca sürükleme; eşleştirmeler sınırlar', async ({ page }) => {
  const errors = await openApp(page);
  const [, m] = await newAsmWith(page, ['Yatak gövdesi', 'Mil']);
  await page.click('[data-cmd="amove"]');
  expect(await page.evaluate(() => __tz.asmUI.pm.type)).toBe('move');
  // bileşene tıklayınca seçilir
  let [x, y] = await scrOf(page, m, [13, 50, 0]);
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.asmUI.pm.comp)).toBe(m);
  const t0 = await T_(page, m);
  await page.click('[data-mvseg="mode"][data-v="delta"]');
  await page.fill('#pm input[data-k="dx"]', '10'); await page.fill('#pm input[data-k="dz"]', '-5');
  await page.click('[data-mvapply="delta"]');
  let t = await T_(page, m);
  expect([t[12] - t0[12], t[13] - t0[13], t[14] - t0[14]].map(v => +v.toFixed(6))).toEqual([10, 0, -5]);
  await page.click('[data-mvseg="mode"][data-v="to"]');
  await page.fill('#pm input[data-k="x"]', '0'); await page.fill('#pm input[data-k="y"]', '200'); await page.fill('#pm input[data-k="z"]', '0');
  await page.click('[data-mvapply="to"]');
  t = await T_(page, m);
  expect(t.slice(12, 15).map(v => +v.toFixed(6))).toEqual([0, 200, 0]);
  // döndürme: X etrafında 90°
  await page.click('[data-mvseg="rmode"][data-v="delta"]');
  await page.fill('#pm input[data-k="rx"]', '90');
  await page.click('[data-mvapply="rot"]');
  t = await T_(page, m);
  expect(Math.abs(t[6])).toBeCloseTo(1, 6); // yerel Y → dünya ±Z
  // montaj X ekseni boyunca sürükleme: yalnızca X değişir
  await page.click('[data-mvseg="mode"][data-v="axis"]');
  await page.click('[data-mvseg="ax"][data-v="x"]');
  await page.evaluate(() => __tz.fitCamera(null, false)); await page.waitForTimeout(250);
  const ta = await T_(page, m);
  const ctr = await page.evaluate(id => { const c = __tz.curAsm().comps.find(c => c.id === id); return [c.T[12], c.T[13], c.T[14]]; }, m);
  [x, y] = await page.evaluate(p => __tz.scrW([p[0] + 13 * 0, p[1], p[2] + 50]), ctr);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y - 30, { steps: 5 }); await page.mouse.up();
  const tb = await T_(page, m);
  expect(Math.abs(tb[12] - ta[12])).toBeGreaterThan(5);
  expect([tb[13] - ta[13], tb[14] - ta[14]].map(v => Math.abs(v) < 1e-6)).toEqual([true, true]);
  // eşmerkezli mil: ΔX ile yana taşınamaz (eşleştirmeler izin vermez), ΔY ile eksen boyunca taşınır
  await page.evaluate(([m]) => { const a = __tz.curAsm(); const g = a.comps[0].id; a.comps.find(c => c.id === m).T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 80, 0, 1];
    a.mates.push({ id: 'mx', name: 'Eşmerkezli1', type: 'concentric', a: { comp: m, ref: { t: 'axis', p: [0, 0, 0], d: [0, 1, 0], r: 13, t0: 0, t1: 100 } }, b: { comp: g, ref: { t: 'axis', p: [0, 50, 0], d: [0, 1, 0], r: 13, t0: -50, t1: -12 } } });
    __tz.solveAsm(a); }, [m]);
  const ok = await page.evaluate(id => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === id), M = new __tz.camera.matrix.constructor().fromArray(c.T);
    const side = __tz.moveCompTo(a, c, M.clone().premultiply(new __tz.camera.matrix.constructor().makeTranslation(20, 0, 0)));
    const up = __tz.moveCompTo(a, c, M.clone().premultiply(new __tz.camera.matrix.constructor().makeTranslation(0, 15, 0)));
    return { side, up, T: c.T.slice(12, 15).map(v => +v.toFixed(4)) }; }, m);
  expect(ok.up).toBe(true);
  expect(ok.T[0]).toBeCloseTo(0, 3); expect(ok.T[2]).toBeCloseTo(0, 3);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => __tz.asmUI.pm)).toBe(null);
  expect(errors).toEqual([]);
});

test('yay ve radyus yüzeyleri (açıklamasız silindir) eksen verir; dairesel kenar ekseni, doğrusal kenar doğru seçer; üzerine gelince vurgu', async ({ page }) => {
  const errors = await openApp(page);
  const [g, b] = await newAsmWith(page, ['Yatak gövdesi', 'Cıvata M8x30']);
  await page.evaluate(() => __tz.fitCamera([1, 0.6, 1], false)); await page.waitForTimeout(250);
  // gövdenin köşe radyusu (R10, x=50, z=30 merkezli): parça açıklamalarında yok, yüzeyden bulunur
  const r = await page.evaluate(g => { const M = __tz.curAsm().comps.find(c => c.id === g).T; const a = Math.PI / 4, p = [50 + 10 * Math.cos(a), 7, 30 + 10 * Math.sin(a)];
    const s = __tz.scrW([p[0] + M[12], p[1] + M[13], p[2] + M[14]]); const h = __tz.asmPick({ clientX: s[0], clientY: s[1] }); return h && h.ref; }, g);
  expect(r.t).toBe('axis');
  expect(r.r).toBeCloseTo(10, 2);
  expect([r.p[0], r.p[2]].map(v => +v.toFixed(2))).toEqual([50, 30]);
  expect(Math.abs(r.d[1])).toBeCloseTo(1, 5);
  // eşleştirme paneli: cıvata gövde eksenini radyus eksenine eşmerkezli yap
  await page.click('[data-cmd="amate"]');
  await page.evaluate(([g, b]) => { const P = __tz.asmUI.pm; const a = __tz.curAsm(), M = a.comps.find(c => c.id === g).T;
    const s = __tz.scrW([50 + 10 * Math.SQRT1_2 + M[12], 7 + M[13], 30 + 10 * Math.SQRT1_2 + M[14]]); __tz.mateSelect(__tz.asmPick({ clientX: s[0], clientY: s[1] }));
    P.draft.b = { comp: b, ref: { t: 'axis', p: [0, 0, 0], d: [0, 1, 0], r: 4, t0: 0, t1: 30 } }; __tz.setMateType('concentric'); }, [g, b]);
  expect(await page.evaluate(() => __tz.asmUI.pm.err)).toBe('');
  await page.keyboard.press('Enter');
  const tb = await T_(page, b);
  expect([tb[12], tb[14]].map(v => +v.toFixed(3))).toEqual([50, 30]);
  // ağaçta hatasız (referans yüzeyden doğrulanır)
  expect(await page.locator('#tree .ti.err').count()).toBe(0);
  // dairesel kenar: gövdenin cıvata deliğinin üst kenarı (Ø9) — fareyle kenara gelince vurgulanır, tıklayınca seçilir
  await page.evaluate(() => __tz.fitCamera([0.2, 1, 0.3], false)); await page.waitForTimeout(250);
  const [ex, ey] = await scrOf(page, g, [-48 + 4.5, 15, -28]);
  await page.mouse.move(ex, ey); await page.waitForTimeout(150);
  expect(await page.evaluate(() => __tz.asmUI.hovKey)).toContain('"e":"circ"');
  await page.mouse.click(ex, ey);
  const ce = await page.evaluate(() => __tz.asmUI.pm.draft.a.ref);
  expect(ce.e).toBe('circ'); expect(ce.r).toBeCloseTo(4.5, 6);
  expect([ce.p[0], ce.p[1], ce.p[2]].map(v => +v.toFixed(4))).toEqual([-48, 15, -28]);
  // doğrusal kenar: gövdenin üst ön kenarı
  const lk = await page.evaluate(g => { const v = __tz.asmView.groups.get(g); const i = v.d.segs.findIndex(s => Math.abs(s.a[1] - 15) < 1e-6 && Math.abs(s.b[1] - 15) < 1e-6 && Math.abs(s.a[2] - 40) < 1e-6 && Math.abs(s.b[2] - 40) < 1e-6); return __tz.edgeRef(v.d, i); }, g);
  expect(lk.e).toBe('line'); expect(Math.abs(lk.d[0])).toBeCloseTo(1, 6); expect(lk.t1).toBeCloseTo(100, 3);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('menteşe tek dönme serbestliği bırakır; kanat sürüklenince eksen etrafında döner; açı sınırı dönmeyi durdurur', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'mentese');
  const [k1, k2] = await newAsmWith(page, ['Menteşe kanadı', 'Menteşe kanadı']);
  await page.click('[data-cmd="amate"]');
  await setType(page, 'hinge');
  // menteşe dört seçim ister: iki silindir, iki düz yüzey
  expect(await page.locator('#pm .lst > div').count()).toBe(4);
  await pickRef(page, 'a', k1, [0, 10, 5], 'a'); await pickRef(page, 'b', k2, [0, 10, 5], 'a');
  await pickRef(page, 'c', k1, [0, 20, 0], [0, 1, 0]); await pickRef(page, 'd', k2, [0, 0, 0], [0, -1, 0]);
  await setType(page, 'hinge');
  expect(await page.evaluate(() => __tz.asmUI.pm.err)).toBe('');
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  const st = await page.evaluate(id => ({ dof: __tz.asmView.dof[id], name: __tz.curAsm().mates[0].name }), k2);
  expect(st).toEqual({ dof: '-', name: 'Menteşe1' });
  // kanadın ucundan tutup sürükle: menteşe ekseni etrafında döner (eksen yerinde, yükseklik sabit)
  await page.evaluate(() => __tz.fitCamera([0, 1, 0.001], false)); await page.waitForTimeout(250);
  const a0 = await T_(page, k2);
  const tip = [55, 20, 1.5]; // kanat plakası: x 0…60, y 0…20, z 0…3
  let [x, y] = await scrOf(page, k2, tip);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 120, y + 160, { steps: 8 }); await page.mouse.up();
  const a1 = await T_(page, k2);
  expect(Math.abs(yaw(a1) - yaw(a0))).toBeGreaterThan(15);
  expect(a1[13]).toBeCloseTo(a0[13], 4);
  // eksen (yerel orijin) yerinde kalır
  expect(Math.hypot(a1[12] - a0[12], a1[14] - a0[14])).toBeLessThan(1e-3);
  // açı sınırı: iki kanadın düz yüzleri arasındaki açı 0–60° dışına çıkamaz
  await page.evaluate(([k1, k2]) => { const a = __tz.curAsm(); a.mates.push({ id: 'ml', name: 'Açı sınırı1', type: 'anglimit', min: 0, max: 60,
    a: { comp: k1, ref: { t: 'plane', n: [0, 0, 1], p: [0, 0, 3] } }, b: { comp: k2, ref: { t: 'plane', n: [0, 0, 1], p: [0, 0, 3] } } });
    a.comps.find(c => c.id === k2).T = a.comps.find(c => c.id === k1).T.slice(); __tz.solveAsm(a); }, [k1, k2]);
  const lim = await page.evaluate(([k1, k2]) => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === k2), M0 = new __tz.camera.matrix.constructor().fromArray(c.T);
    const R = new __tz.camera.matrix.constructor().makeRotationY(Math.PI / 2); __tz.moveCompTo(a, c, R.multiply(M0));
    const T = c.T, K = a.comps.find(x => x.id === k1).T; return Math.acos(Math.max(-1, Math.min(1, T[8] * K[8] + T[9] * K[9] + T[10] * K[10]))) * 180 / Math.PI; }, [k1, k2]);
  expect(lim).toBeLessThan(60.5); expect(lim).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});

test('dişli eşleştirmesi: biri dönünce öbürü oranla ters döner; kremayer–pinyon; vida bir turda hatve kadar ilerler; kayıt-açma', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await openSample(page, 'disli-cifti');
  await page.click('[data-tab="asm"]');
  // dişlilerin dönmesini tutan paralel ve açı eşleştirmeleri bastırılır, yerine dişli eşleştirmesi (z24 : z24)
  const ids = await page.evaluate(() => { const a = __tz.curAsm(); for (const m of a.mates) if (m.type === 'parallel' || m.type === 'angle') m.suppressed = true;
    const gears = a.comps.filter(c => __tz.project.parts.find(p => p.id === c.part).partName.startsWith('Düz dişli')).map(c => c.id); __tz.solveAsm(a); return gears; });
  await page.click('[data-cmd="amate"]');
  await pickRef(page, 'a', ids[0], [12.5, 0, 10], 'a'); await pickRef(page, 'b', ids[1], [12.5, 0, 10], 'a');
  await setType(page, 'gear');
  expect(await page.evaluate(() => { const d = __tz.asmUI.pm.draft; return [d.ra, d.rb, __tz.asmUI.pm.err]; })).toEqual([25, 25, '']);
  await page.fill('#pm input[data-k="ra"]', '24'); await page.fill('#pm input[data-k="rb"]', '48'); await page.waitForTimeout(350);
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  const g0 = await page.evaluate(ids => ids.map(id => __tz.curAsm().comps.find(c => c.id === id).T.slice()), ids);
  // birinci dişli 3 × 40° döndürülür (±180°'den geçerken açı sürekli kalmalı): ikinci dişli 120 × 24/48 = 60° ters döner
  await page.evaluate(id => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === id), Mx = __tz.camera.matrix.constructor;
    for (let i = 0; i < 3; i++) { const p = new __tz.camera.position.constructor(c.T[12], c.T[13], c.T[14]); const R = new Mx().makeTranslation(p.x, p.y, p.z).multiply(new Mx().makeRotationZ(40 * Math.PI / 180)).multiply(new Mx().makeTranslation(-p.x, -p.y, -p.z));
      __tz.moveCompTo(a, c, R.multiply(new Mx().fromArray(c.T))); } }, ids[0]);
  const g1 = await page.evaluate(ids => ids.map(id => __tz.curAsm().comps.find(c => c.id === id).T.slice()), ids);
  const dA = ((zrot(g1[0]) - zrot(g0[0]) + 540) % 360) - 180, dB = ((zrot(g1[1]) - zrot(g0[1]) + 540) % 360) - 180;
  expect(dA).toBeCloseTo(120, 1);
  expect(dB).toBeCloseTo(-60, 1);
  // kayıt-açma: dişli eşleştirmesi ve açı takibi saklanır
  await page.evaluate(() => __tz.flushState());
  await page.reload(); await page.waitForFunction(() => window.__tz && __tz.project.asms.length);
  await page.click('[data-tab="asm"]');
  const after = await page.evaluate(() => { const m = __tz.curAsm().mates.find(m => m.type === 'gear'); return { ra: m.ra, rb: m.rb, unsolved: !!__tz.curAsm()._unsolved, ta: Math.abs(Math.round(m.ta * 180 / Math.PI)) }; });
  expect(after).toEqual({ ra: 24, rb: 48, unsolved: false, ta: 120 });

  // kremayer–pinyon: ikinci taban yalnızca X boyunca kayar (alt yüzü tabanın altına çakışık, yan yüzleri paralel, Y mesafesi sabit);
  // kenarı birinci dişliye (hatve çapı 48) bağlanır: kremayer π·48/4 ilerleyince dişli 90° döner
  const rk = await page.evaluate(() => {
    const a = __tz.curAsm(), base = a.comps.find(c => c.fixed), pid = base.part;
    __tz.addComp(pid); const rack = a.comps[a.comps.length - 1]; rack.fixed = false;
    const v = __tz.asmView.groups.get(rack.id), P = v.d.polys;
    const face = (n) => { const q = P.find(q => q.plane.n.x * n[0] + q.plane.n.y * n[1] + q.plane.n.z * n[2] > 1 - 1e-6); return { t: 'plane', n, p: n.map(x => x * q.plane.w) }; };
    const gear = a.comps.find(c => __tz.project.parts.find(p => p.id === c.part).partName.startsWith('Düz dişli'));
    const i = v.d.segs.findIndex(s => Math.abs(s.a[0] - s.b[0]) > 20 && Math.abs(s.a[1] - s.b[1]) < 1e-6 && Math.abs(s.a[2] - s.b[2]) < 1e-6);
    const line = __tz.edgeRef(v.d, i);
    rack.T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -30, 1];
    a.mates.push({ id: 'r1', name: 'Çakışık9', type: 'coincident', flip: true, a: { comp: rack.id, ref: face([0, 0, 1]) }, b: { comp: base.id, ref: face([0, 0, -1]) } },
      { id: 'r2', name: 'Paralel9', type: 'parallel', a: { comp: rack.id, ref: face([1, 0, 0]) }, b: { comp: base.id, ref: face([1, 0, 0]) } },
      { id: 'r3', name: 'Mesafe9', type: 'distance', val: 0, flip: false, align: true, a: { comp: rack.id, ref: face([0, 1, 0]) }, b: { comp: base.id, ref: face([0, 1, 0]) } });
    const ok1 = __tz.solveAsm(a);
    __tz.openMatePM(null); const d = __tz.asmUI.pm.draft;
    d.a = { comp: rack.id, ref: line }; d.b = { comp: gear.id, ref: { t: 'axis', p: [0, 0, 0], d: [0, 0, 1], r: 12.5, t0: 0.96, t1: 29.04 } };
    __tz.setMateType('rack'); d.val = 48; __tz.previewMate(); const err = __tz.asmUI.pm.err; __tz.commitMate(true);
    const g0 = gear.T.slice(), Mx = __tz.camera.matrix.constructor, r0 = rack.T[12];
    const moved = __tz.moveCompTo(a, rack, new Mx().makeTranslation(Math.PI * 48 / 4, 0, 0).multiply(new Mx().fromArray(rack.T)));
    const dz = Math.atan2(gear.T[1], gear.T[0]) - Math.atan2(g0[1], g0[0]);
    return { ok1, err, moved, line: line.e, dz: Math.abs(((dz * 180 / Math.PI + 540) % 360) - 180), dx: Math.abs(rack.T[12] - r0) };
  });
  expect(rk).toEqual({ ok1: true, err: '', moved: true, line: 'line', dz: expect.any(Number), dx: expect.any(Number) });
  expect(rk.dx).toBeCloseTo(Math.PI * 48 / 4, 0);
  // dönme açısı = ilerleme / hatve yarıçapı
  expect(rk.dz).toBeCloseTo(rk.dx / 24 * 180 / Math.PI, 4);

  // vida: somun cıvata üzerinde; 1 tur (4 × 90°) dönünce hatve (1,5 mm) kadar ilerler
  await openSample(page, 'flansli-kaplin');
  const [cv, sm] = await newAsmWith(page, ['Cıvata M10x50', 'Somun M10']);
  await page.evaluate(([cv, sm]) => { const a = __tz.curAsm(); a.comps.find(c => c.id === sm).T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -30, 0, 1]; __tz.solveAsm(a); }, [cv, sm]);
  await page.click('[data-cmd="amate"]');
  await pickRef(page, 'a', cv, [5, -20, 0], 'a'); await pickRef(page, 'b', sm, [5, 4, 0], 'a');
  await setType(page, 'screw');
  await page.fill('#pm input[data-k="val"]', '1,5'); await page.waitForTimeout(350);
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  const y0 = (await T_(page, sm))[13];
  await page.evaluate(id => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === id), Mx = __tz.camera.matrix.constructor;
    for (let i = 0; i < 4; i++) { const R = new Mx().makeTranslation(c.T[12], 0, c.T[14]).multiply(new Mx().makeRotationY(Math.PI / 2)).multiply(new Mx().makeTranslation(-c.T[12], 0, -c.T[14])); __tz.moveCompTo(a, c, R.multiply(new Mx().fromArray(c.T))); } }, sm);
  const s1 = await T_(page, sm);
  // dönülen açı (eşleştirmenin izlediği, tur sayısıyla) yaklaşık bir tur; ilerleme tam olarak hatve × tur
  const turn = await page.evaluate(() => Math.abs(__tz.curAsm().mates.find(m => m.type === 'screw').ta) / (2 * Math.PI));
  expect(turn).toBeGreaterThan(0.97); expect(turn).toBeLessThan(1.03);
  expect(Math.abs(s1[13] - y0)).toBeCloseTo(1.5 * turn, 5);

  expect(errors).toEqual([]);
});

test('teğet, kilitle, simetrik, genişlik ve mesafe sınırı', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  const [g, m, m2, h] = await newAsmWith(page, ['Kaplin göbeği A', 'Mil Ø25', 'Mil Ø25', 'Kaplin göbeği A']);
  await page.click('[data-cmd="amate"]');
  // teğet: milin silindiri göbeğin flanş ön yüzüne (y=0 düzlemi) teğet — eksen düzleme paralel ve 12,5 mm uzakta
  await pickRef(page, 'a', m, [0, 50, 12.5], 'a'); await pickRef(page, 'b', g, [55, 0, 0], [0, -1, 0]);
  expect(await page.evaluate(() => [...document.querySelectorAll('#pm [data-mtype]:not([disabled])')].map(b => b.dataset.mtype))).toContain('tangent');
  await setType(page, 'tangent');
  expect(await page.evaluate(() => __tz.asmUI.pm.err)).toBe('');
  await page.keyboard.press('Enter');
  let t = await T_(page, m);
  const gT = await T_(page, g);
  expect(Math.abs(t[5])).toBeLessThan(1e-4); // mil ekseni yatay
  expect(Math.abs(Math.abs(t[13] - gT[13]) - 12.5)).toBeLessThan(1e-3);
  // kilitle: ikinci mil ilk mile kilitlenir; birlikte hareket eder ve tam tanımlıdır (göbekle eşleşmeden önce serbest)
  await pickRef(page, 'a', m, [0, 50, 12.5], 'a'); await pickRef(page, 'b', m2, [0, 50, 12.5], 'a');
  await setType(page, 'lock');
  await page.keyboard.press('Enter');
  const relOf = () => page.evaluate(([a, b]) => { const Mx = __tz.camera.matrix.constructor, A = new Mx().fromArray(__tz.curAsm().comps.find(c => c.id === a).T), B = new Mx().fromArray(__tz.curAsm().comps.find(c => c.id === b).T);
    return A.invert().multiply(B).toArray().map(v => +v.toFixed(3)); }, [m, m2]);
  const rel0 = await relOf();
  await page.evaluate(id => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === id), Mx = __tz.camera.matrix.constructor; __tz.moveCompTo(a, c, new Mx().makeTranslation(0, 0, 30).multiply(new Mx().fromArray(c.T))); }, m);
  const tm = await T_(page, m);
  expect(await relOf()).toEqual(rel0);
  expect(tm[14] - t[14]).toBeGreaterThan(20); // mil (ve kilitli ikinci mil) taşındı
  // genişlik: ikinci göbeğin flanşı (y 0…15) ilk göbeğin flanşının ortasında: iki göbek flanşı aynı orta düzlemde
  await setType(page, 'width');
  await pickRef(page, 'a', g, [55, 0, 0], [0, -1, 0]); await pickRef(page, 'b', g, [45, 15, 0], [0, 1, 0]);
  await pickRef(page, 'c', h, [55, 0, 0], [0, -1, 0]); await pickRef(page, 'd', h, [45, 15, 0], [0, 1, 0]);
  await setType(page, 'width');
  expect(await page.evaluate(() => __tz.asmUI.pm.err)).toBe('');
  await page.keyboard.press('Enter');
  t = await T_(page, h);
  expect(Math.abs(Math.abs(t[13] + 7.5 * t[5]) - Math.abs(gT[13] + 7.5))).toBeLessThan(1e-3);
  // simetrik ve mesafe sınırı (iki düzlem): çözülür ve sınır aşılmaz
  await page.evaluate(([g, h]) => { const a = __tz.curAsm(); a.mates = a.mates.filter(x => x.type !== 'width');
    a.mates.push({ id: 'dl', name: 'Mesafe sınırı1', type: 'distlimit', min: 0, max: 40, flip: false, a: { comp: g, ref: { t: 'plane', n: [0, 1, 0], p: [0, 15, 0] } }, b: { comp: h, ref: { t: 'plane', n: [0, -1, 0], p: [0, 0, 0] } } });
    a.comps.find(c => c.id === h).T = [1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, 30, 0, 1]; __tz.solveAsm(a); }, [g, h]);
  const dl = await page.evaluate(([g, h]) => { const a = __tz.curAsm(), c = a.comps.find(x => x.id === h), Mx = __tz.camera.matrix.constructor;
    __tz.moveCompTo(a, c, new Mx().makeTranslation(0, 100, 0).multiply(new Mx().fromArray(c.T))); return c.T[13] - a.comps.find(x => x.id === g).T[13]; }, [g, h]);
  expect(dl).toBeLessThan(15 + 40 + 0.01);
  expect(dl).toBeGreaterThan(15 + 39);
  const sym = await page.evaluate(([g, m, m2]) => { const a = __tz.curAsm(); a.mates = a.mates.filter(x => x.type === 'distlimit');
    a.comps.find(c => c.id === g).fixed = true;
    a.mates.push({ id: 'sy', name: 'Simetrik1', type: 'symmetric', a: { comp: m, ref: { t: 'axis', p: [0, 0, 0], d: [0, 1, 0], r: 12.5, t0: 0, t1: 100 } }, b: { comp: m2, ref: { t: 'axis', p: [0, 0, 0], d: [0, 1, 0], r: 12.5, t0: 0, t1: 100 } },
      c: { comp: g, ref: { t: 'plane', n: [1, 0, 0], p: [0, 0, 0] } } });
    a.comps.find(c => c.id === m).T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, 0, 10, 1]; const ok = __tz.solveAsm(a);
    // A'nın eksen doğrusunun G'nin X düzlemine (yerel x=0) göre yansıması B'nin eksen doğrusudur
    const A = a.comps.find(c => c.id === m).T, B = a.comps.find(c => c.id === m2).T, G = a.comps.find(c => c.id === g).T;
    const n = [G[0], G[1], G[2]], o = [G[12], G[13], G[14]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const rf = v => v.map((x, i) => x - 2 * dot(v, n) * n[i]), Ap = [A[12], A[13], A[14]], rp = Ap.map((x, i) => x - 2 * dot(Ap.map((y, k) => y - o[k]), n) * n[i]);
    const Bd = [B[4], B[5], B[6]], w = [B[12] - rp[0], B[13] - rp[1], B[14] - rp[2]], cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return { ok, dir: Math.hypot(...cr(rf([A[4], A[5], A[6]]), Bd)), off: Math.hypot(...cr(w, Bd)) }; }, [g, m, m2]);
  expect(sym.ok).toBe(true);
  expect(sym.dir).toBeLessThan(1e-4); expect(sym.off).toBeLessThan(1e-3);
  expect(errors).toEqual([]);
});
