// Tezgâh CAD duman (smoke) testleri. Her test örnek projeyle temiz başlar.
import { test, expect } from '@playwright/test';
import { openApp, blobHead } from './helpers.js';

test('örnek parça hatasız oluşur ve tüm çizimler tam tanımlıdır', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => ({ err: __tz.model.errors, dof: __tz.model.dof, n: __tz.model.polys.length, parts: __tz.project.parts.length,
    auto: __tz.project.parts.flatMap(p => p.features.filter(f => f.type === 'sketch').map(f => __tz.autoDefine(JSON.parse(JSON.stringify(f))).length)) }));
  expect(r.err).toEqual({});
  for (const n of r.auto) expect(n).toBe(0); // tam tanımlı çizimlere otomatik ölçü eklenmez
  expect(r.n).toBeGreaterThan(1000);
  expect(r.parts).toBe(3);
  for (const v of Object.values(r.dof)) expect(v).toBe(0);
  expect(errors).toEqual([]);
});

test('SolidWorks iş akışı: düzlem → çizim → ölçü → ekstrüzyon', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  const r = await page.evaluate(() => {
    const T = __tz;
    T.setTool('crect'); T.toolClick(0, 0); T.toolClick(31, 19);
    const f = T.sk.feat;
    const dofBefore = T.sk.an.dof;
    // üst kenara uzunluk ölçüsü
    T.setTool('smartdim');
    const top = f.ents.find(e => e.t === 'line' && !e.cons && Math.abs(f.pts[e.a].y - f.pts[e.b].y) < 1e-6);
    const a = f.pts[top.a], b = f.pts[top.b];
    T.toolClick((a.x + b.x) / 2, (a.y + b.y) / 2); T.toolClick((a.x + b.x) / 2, (a.y + b.y) / 2 + 8);
    const dim = f.cons.find(c => c.t === 'd');
    T.setDimVal(dim.id, 80);
    return { dofBefore, dofAfter: T.sk.an.dof, w: Math.abs(f.pts[top.a].x - f.pts[top.b].x) };
  });
  expect(r.dofBefore).toBe(2);
  expect(r.dofAfter).toBe(1);
  expect(r.w).toBeCloseTo(80, 4);
  await page.evaluate(() => __tz.cmd('extrude'));
  await page.waitForFunction(() => !!__tz.pm);
  await page.evaluate(() => __tz.commitPM());
  const m = await page.evaluate(() => ({ err: __tz.model.errors, feats: __tz.state.features.map(f => f.type) }));
  expect(m.err).toEqual({});
  expect(m.feats).toEqual(['sketch', 'extrude']);
  expect(errors).toEqual([]);
});

test('çekirdek: delik sihirbazı ve dairesel kenarda radyus', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const feats = JSON.parse(JSON.stringify(__tz.state.features));
    feats.push({ id: 'h1', type: 'hole', name: 'Delik1', htype: 'tapped', size: 'M8', fit: 'normal', end: 'blind', depth: 12, tdepth: 10,
      on: { kind: 'face', feat: 'x1', which: 'far', sgn: 1 }, pts: [[30, -20], [-30, -20]] });
    feats.push({ id: 'f9', type: 'fillet', name: 'Radyus9', r: 2, edges: [{ a: [23, 50, 0], b: [22.80, 50, 3.0] }] });
    const r = __tz.rebuildModel(feats);
    return { err: r.errors, txt: r.ann.filter(a => a.txt).map(a => a.txt) };
  });
  expect(r.err).toEqual({});
  expect(r.txt).toContain('M8×1,25 derinlik 10');
});

test('montaj: örnek montaj çözülür, eşleştirmeler sağlanır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="asm"]');
  const r = await page.evaluate(() => {
    const a = __tz.curAsm();
    return { ok: __tz.solveAsm(a), n: a.comps.length, mates: a.mates.length, dof: __tz.asmDof(a) };
  });
  expect(r.ok).toBe(true);
  expect(r.n).toBe(6);
  expect(r.mates).toBe(10);
  expect(r.dof.c1).toBe('f');
  expect(errors).toEqual([]);
});

test('teknik resim ve PDF çıktısı (2B ve 3B)', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.evaluate(() => __tz.openPdfDialog('2d'));
  const pdf2 = await blobHead(page, "(Object.assign(__tz.pdfOpt,{kind:'2d',paper:'A4',orient:'portrait',layout:'min'}), __tz.makePdf())");
  expect(pdf2.head.startsWith('%PDF-1.4')).toBe(true);
  const pdf3 = await blobHead(page, "(Object.assign(__tz.pdfOpt,{kind:'3d',paper:'A3',orient:'landscape',layout:'full'}), __tz.makePdf())");
  expect(pdf3.head.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf3.size).toBeGreaterThan(20000);
  expect(errors).toEqual([]);
});

test('STL ve ZIP üretimi', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    const bytes = __tz.stlBinary([{ polys: __tz.model.polys }], 'test');
    const zip = __tz.makeZip([{ name: 'a.stl', bytes }]);
    const head = new Uint8Array(await zip.arrayBuffer()).slice(0, 4);
    const n = new DataView(bytes.buffer).getUint32(80, true);
    return { ok: bytes.length === 84 + n * 50, zipSig: Array.from(head) };
  });
  expect(r.ok).toBe(true);
  expect(r.zipSig).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

test('ölçüye dayalı çizim: disk dosyası tam tanımlı, ölçü listeden değişir', async ({ page }) => {
  const errors = await openApp(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL('../ornekler/dort-kanatli-disk.tezgah.json', import.meta.url).pathname);
  await page.waitForFunction(() => __tz.state.partName.startsWith('Dört'));
  const r0 = await page.evaluate(() => ({ err: __tz.model.errors, dof: __tz.model.dof, vol: __tz.model.props.vol }));
  expect(r0.err).toEqual({});
  for (const v of Object.values(r0.dof)) expect(v).toBe(0);
  const n0 = await page.evaluate(() => { __tz.editSketch('s1'); return { cons: __tz.sk.feat.cons.length, dof: __tz.sk.an.dof }; });
  expect(n0.dof).toBe(0);
  const rows = page.locator('.dimrow');
  await expect(rows).toHaveCount(6);
  await expect(page.locator('#labels .dlab')).toHaveCount(6);
  const inp = page.locator('.dimrow input[value="318,5"]');
  await inp.fill('325');
  await inp.press('Enter');
  const r1 = await page.evaluate(() => {
    const c = __tz.sk.feat.cons.find(c => c.t === 'dpl');
    __tz.exitSketch(true);
    return { val: c.val, cons: __tz.state.features[0].cons.length, err: __tz.model.errors, vol: __tz.model.props.vol };
  });
  expect(r1.val).toBe(325);
  expect(r1.cons).toBe(n0.cons);
  expect(r1.err).toEqual({});
  expect(r1.vol).toBeGreaterThan(r0.vol);
  expect(errors).toEqual([]);
});

test('ölçüsüz çizimler girişte ve çıkışta otomatik tam tanımlanır', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  const a = await page.evaluate(() => {
    const T = __tz; T.setTool('line');
    T.toolClick(10, 10); T.toolClick(60, 10); T.toolClick(40, 45); T.toolClick(10, 10);
    const id = T.sk.feat.id; T.exitSketch(true);
    const f = T.state.features.find(x => x.id === id);
    return { dof: T.model.dof[id], dims: f.cons.filter(c => /^d/.test(c.t)).length };
  });
  expect(a.dof).toBe(0);
  expect(a.dims).toBeGreaterThan(0);
  // dışarıdan gelen, hiç ölçüsü olmayan çizim
  const sx = { id: 's1', type: 'sketch', name: 'Çizim1', on: { kind: 'std', key: 'front' },
    pts: { a: { x: 100, y: 0 }, b: { x: 140, y: 0 }, c: { x: 140, y: 20 }, d: { x: 100, y: 20 }, m: { x: 120, y: 20 } },
    ents: [{ id: 'e1', t: 'line', a: 'a', b: 'b' }, { id: 'e2', t: 'line', a: 'b', b: 'c' }, { id: 'e3', t: 'arc', c: 'm', a: 'c', b: 'd' }, { id: 'e4', t: 'line', a: 'd', b: 'a' }], cons: [] };
  const proj = { app: 'tezgah-cad', version: 3, parts: [{ id: 'P1', partName: 'Dış parça', features: [sx,
    { id: 'x1', type: 'extrude', name: 'Ekstrüzyon1', op: 'add', sketch: 's1', end: 'blind', depth: 10 }] }], asms: [], cur: { part: 'P1' } };
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles({ name: 'dis.tezgah.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proj)) });
  await page.waitForFunction(() => __tz.state.partName === 'Dış parça');
  const b = await page.evaluate(() => { const before = __tz.model.dof.s1; __tz.editSketch('s1'); return { before, dof: __tz.sk.an.dof }; });
  expect(b.before).toBeGreaterThan(0);
  expect(b.dof).toBe(0);
  await expect(page.locator('#labels .dlab').first()).toBeVisible();
  const nl = await page.locator('#labels .dlab').count();
  await expect(page.locator('.dimrow')).toHaveCount(nl);
  // yarıçapı listeden değiştir
  const rad = page.locator('.dimrow', { hasText: 'Yarıçap' }).locator('input');
  await rad.fill('25');
  await rad.press('Enter');
  const r = await page.evaluate(() => { const f = __tz.sk.feat; const m = f.pts.m, c = f.pts.c; __tz.exitSketch(true); return { r: Math.hypot(c.x - m.x, c.y - m.y), err: __tz.model.errors }; });
  expect(r.r).toBeCloseTo(25, 4);
  expect(r.err).toEqual({});
  expect(errors).toEqual([]);
});

/** Ön düzlemde boş bir çizim açar. */
async function newSketch(page) {
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
}
/** Çizimden çıkar, ekstrüzyon (20 mm) yapar; hata ve hacmi döndürür. */
const extrudeJS = `(() => { const T = __tz; T.exitSketch(true); T.cmd('extrude'); if (T.pm) T.commitPM(); return { err: T.model.errors, vol: T.model.props && T.model.props.vol }; })()`;

test('budama: kesişen öğeler bölünür, birleşim konturu kapalı kalır', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const a = await page.evaluate(() => {
    const T = __tz; T.setTool('rect'); T.toolClick(-30, -10); T.toolClick(30, 10); T.setTool('rect'); T.toolClick(-10, -30); T.toolClick(10, 30);
    T.setTool('trim'); for (const q of [[0, 10], [0, -10], [10, 0], [-10, 0]]) T.toolClick(...q);
    return { ents: T.sk.feat.ents.length, pts: Object.keys(T.sk.feat.pts).length, issues: T.sk.issues.n };
  });
  expect(a).toEqual({ ents: 12, pts: 12, issues: 0 });
  const r = await page.evaluate(extrudeJS);
  expect(r.err).toEqual({});
  expect(r.vol).toBeCloseTo(2000 * 20, 0);
  // iki daire: kesişim içindeki yaylar budanır
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(0, 0); T.toolClick(20, 0); T.setTool('circle'); T.toolClick(30, 0); T.toolClick(50, 0); T.setTool('trim'); T.toolClick(10, 0); T.toolClick(20, 0); });
  const c = await page.evaluate(extrudeJS);
  expect(c.err).toEqual({});
  const lens = 2 * 400 * Math.acos(0.75) - 15 * Math.sqrt(700);
  expect(c.vol / 20).toBeGreaterThan((2 * Math.PI * 400 - lens) * 0.99);
  expect(errors).toEqual([]);
});

test('ofset tek ölçüyle tüm kenarları sürer; çoğaltmalar parametriktir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const o = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(60, 40); T.setTool(null);
    // dikdörtgeni ölçülendir: 60 × 40
    const top = f.ents[0], side = f.ents[1];
    f.cons.push({ id: 'cw', t: 'd', p: top.a, q: top.b, val: 60, lp: [30, -8] }, { id: 'ch', t: 'd', p: side.a, q: side.b, val: 40, lp: [68, 20] });
    T.solveSketch(f);
    T.selectItems(f.ents.map(e => ({ k: 'ent', id: e.id }))); T.setSkOp('offset'); T.sk.op.d = 5; T.applySkOp();
    const dof = T.sk.an.dof; const off = f.cons.find(c => c.t === 'doff'); T.setDimVal(off.id, 8);
    const xs = Object.values(f.pts).map(p => p.x), ys = Object.values(f.pts).map(p => p.y);
    return { dof, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), followers: f.cons.filter(c => c.t === 'offd').length };
  });
  expect(o.dof).toBe(0);
  expect(o.followers).toBe(3);
  expect(o.w).toBeCloseTo(76, 4);
  expect(o.h).toBeCloseTo(56, 4);
  await page.evaluate(() => __tz.exitSketch(false));
  await newSketch(page);
  const p = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('circle'); T.toolClick(10, 10); T.toolClick(14, 10);
    const c = f.ents[0]; T.setTool(null); T.selectItems([{ k: 'ent', id: c.id }]); T.setSkOp('lpat'); Object.assign(T.sk.op, { n: 4, sp: 20, ang: 0 }); T.applySkOp();
    const dof = T.sk.an.dof; const sp = f.cons.find(x => x.t === 'd'); T.setDimVal(sp.id, 25);
    const xs = f.ents.filter(e => e.t === 'circle').map(e => f.pts[e.c].x).sort((a, b) => a - b);
    return { dof, gaps: xs.slice(1).map((x, i) => x - xs[i]) };
  });
  expect(p.dof).toBe(3); // yalnızca kaynak daire: merkez + yarıçap
  for (const g of p.gaps) expect(g).toBeCloseTo(25, 4);
  await page.evaluate(() => __tz.exitSketch(false));
  await newSketch(page);
  const q = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('circle'); T.toolClick(30, 0); T.toolClick(34, 0);
    T.setTool(null); T.selectItems([{ k: 'ent', id: f.ents[0].id }]); T.setSkOp('cpat'); Object.assign(T.sk.op, { n: 6, tot: 360 }); T.applySkOp();
    const dof = T.sk.an.dof; const a = f.cons.find(x => x.t === 'dang'); T.setDimVal(a.id, 45);
    const an = f.ents.filter(e => e.t === 'circle').map(e => Math.atan2(f.pts[e.c].y, f.pts[e.c].x) * 180 / Math.PI).map(v => (v + 360) % 360).sort((a, b) => a - b);
    return { dof, steps: an.slice(1).map((v, i) => v - an[i]) };
  });
  expect(q.dof).toBe(3);
  for (const s of q.steps) expect(s).toBeCloseTo(45, 3);
  expect(errors).toEqual([]);
});

test('simetrik ilişki, çizgi–yay radyusu, 3 nokta ve teğet yay', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const s = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('centerline'); T.toolClick(0, -20); T.toolClick(0, 20);
    T.setTool('circle'); T.toolClick(-20, 0); T.toolClick(-15, 0); T.setTool('circle'); T.toolClick(22, 4); T.toolClick(28, 4);
    const [cl, c1, c2] = f.ents; T.setTool(null); T.selectItems([{ k: 'pt', id: c1.c }, { k: 'pt', id: c2.c }, { k: 'ent', id: cl.id }]);
    const offered = [...document.querySelectorAll('[data-rel]')].map(b => b.dataset.rel);
    T.addRelation('sym');
    const a = f.pts[cl.a], b = f.pts[cl.b], p = f.pts[c1.c], q = f.pts[c2.c];
    const m = [(p.x + q.x) / 2, (p.y + q.y) / 2], d = [b.x - a.x, b.y - a.y];
    return { offered, onAxis: Math.abs((m[0] - a.x) * d[1] - (m[1] - a.y) * d[0]) / Math.hypot(...d), perp: (q.x - p.x) * d[0] + (q.y - p.y) * d[1] };
  });
  expect(s.offered).toContain('sym');
  expect(s.onAxis).toBeLessThan(1e-5);
  expect(Math.abs(s.perp)).toBeLessThan(1e-5);
  await page.evaluate(() => __tz.exitSketch(false));
  // D şekli: çizgi ile yarım daire köşesine radyus
  await newSketch(page);
  const d = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat; T.setTool('line'); T.toolClick(0, -20); T.toolClick(0, 20);
    T.setTool('arc'); T.toolClick(0, 0); T.toolClick(0, 20); T.toolClick(0, -20);
    T.sk.opts.filletR = 4; T.setTool('sfillet'); T.toolClick(0, 20);
    return { arcs: f.ents.filter(e => e.t === 'arc').length, tan: f.cons.filter(c => c.t === 'tan').length };
  });
  expect(d).toEqual({ arcs: 2, tan: 2 });
  expect((await page.evaluate(extrudeJS)).err).toEqual({});
  // 3 nokta yay: yarım daire
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('line'); T.toolClick(-20, 0); T.toolClick(20, 0); T.setTool('arc3'); T.toolClick(-20, 0); T.toolClick(20, 0); T.toolClick(0, 20); });
  const a3 = await page.evaluate(extrudeJS);
  expect(a3.err).toEqual({});
  expect(a3.vol).toBeCloseTo(Math.PI * 200 * 20, -2);
  // teğet yaylarla kanal
  await newSketch(page);
  const t = await page.evaluate(() => {
    const T = __tz; T.setTool('line'); T.toolClick(0, 0); T.toolClick(40, 0); T.setTool('tarc'); T.toolClick(40, 0); T.toolClick(40, 20);
    T.setTool('line'); T.toolClick(40, 20); T.toolClick(0, 20); T.setTool('tarc'); T.toolClick(0, 20); T.toolClick(0, 0);
    return T.sk.feat.cons.filter(c => c.t === 'tan').length;
  });
  expect(t).toBe(2);
  const tv = await page.evaluate(extrudeJS);
  expect(tv.err).toEqual({});
  expect(tv.vol).toBeCloseTo((800 + Math.PI * 100) * 20, -2);
  expect(errors).toEqual([]);
});

test('yakalama: kesişim, dik çıkarım, ızgara; profil sorunları işaretlenir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  const r = await page.evaluate(() => {
    const T = __tz; const f = T.sk.feat;
    T.setTool('line'); T.toolClick(-30, 10); T.toolClick(30, 10); T.setTool('line'); T.toolClick(5, -30); T.toolClick(5, 30);
    T.setTool('circle'); T.toolClick(5.3, 10.2); T.toolClick(12, 10);
    const c = f.ents.find(e => e.t === 'circle'); const cp = f.pts[c.c];
    T.setTool('line'); T.toolClick(40, 0); T.toolClick(70, 17); T.toolClick(61.7, 31.6);
    const l2 = f.ents[f.ents.length - 1]; T.setTool(null);
    return { c: [cp.x, cp.y], ccons: f.cons.filter(x => x.p === c.c).map(x => x.t), perp: f.cons.some(x => x.t === 'perp' && x.e2 === l2.id) };
  });
  expect(r.c[0]).toBeCloseTo(5, 6);
  expect(r.c[1]).toBeCloseTo(10, 6);
  expect(r.ccons).toEqual(['pol', 'pol']);
  expect(r.perp).toBe(true);
  await expect(page.locator('.warnnote')).toContainText('boşta uç');
  // ızgara görünür
  expect(await page.evaluate(() => __tz.sk.opts.grid)).toBe(true);
  await page.evaluate(() => __tz.exitSketch(false));
  // T-birleşimi: anlaşılır hata
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(60, 40); T.setTool('line'); T.toolClick(30, 0); T.toolClick(30, 40); });
  const e = await page.evaluate(extrudeJS);
  expect(Object.values(e.err)[0]).toContain('T-birleşimi');
  expect(errors).toEqual([]);
});

test('fare tekerleği imlecin altındaki noktaya doğru yakınlaştırır', async ({ page }) => {
  const errors = await openApp(page);
  await page.waitForTimeout(300);
  const pt = await page.evaluate(() => {
    const b = __tz.model.box;
    const cs = [];
    for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) cs.push([x, y, z]);
    cs.sort((p, q) => __tz.scrW(q)[0] - __tz.scrW(p)[0]);
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    return { p: cs[0], s: __tz.scrW(cs[0]), c, sc: __tz.scrW(c) };
  });
  // imleç ağacın değil tuvalin üzerinde olmalı
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, pt.s)).toBe('CANVAS');
  await page.mouse.move(pt.s[0], pt.s[1]);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  await page.waitForTimeout(400);
  const r = await page.evaluate(([p, c]) => ({ s: __tz.scrW(p), sc: __tz.scrW(c) }), [pt.p, pt.c]);
  expect(Math.hypot(r.s[0] - pt.s[0], r.s[1] - pt.s[1])).toBeLessThan(2);   // imleç noktası yerinde
  expect(Math.hypot(r.sc[0] - pt.sc[0], r.sc[1] - pt.sc[1])).toBeGreaterThan(30); // merkez kaydı: gerçekten yakınlaştı
  expect(errors).toEqual([]);
});

test('özellik silinince çizimi ağaçta kalır; çizim silinince bağlı özellik de gider', async ({ page }) => {
  const errors = await openApp(page);
  const ex = await page.evaluate(() => __tz.state.features.find(f => f.type === 'extrude' && f.sketch).id);
  const skId = await page.evaluate(id => __tz.state.features.find(f => f.id === id).sketch, ex);
  await page.click(`.ti[data-id="${ex}"]`);
  await page.click(`.ti[data-id="${ex}"] [data-a="del"]`);
  const r = await page.evaluate(([ex, s]) => ({ ids: __tz.state.features.map(f => f.id), err: __tz.model.errors }), [ex, skId]);
  expect(r.ids).not.toContain(ex);
  expect(r.ids).toContain(skId);
  // çizim artık ağaçta kendi satırında görünür ve ayrıca silinebilir
  await expect(page.locator(`.ti[data-id="${skId}"]:not(.child)`)).toHaveCount(1);
  await page.click(`.ti[data-id="${skId}"]`);
  await page.click(`.ti[data-id="${skId}"] [data-a="del"]`);
  expect(await page.evaluate(s => __tz.state.features.some(f => f.id === s), skId)).toBe(false);
  // tüketilmiş bir çizimi silmek bağlı özelliği de siler (özellik çizimsiz kalmasın)
  const ids2 = await page.evaluate(() => { const f = __tz.state.features.find(f => f.type === 'extrude' && f.sketch); return [f.id, f.sketch]; });
  await page.click(`.ti[data-id="${ids2[1]}"]`);
  await page.click(`.ti[data-id="${ids2[1]}"] [data-a="del"]`);
  const left = await page.evaluate(() => __tz.state.features.map(f => f.id));
  expect(left).not.toContain(ids2[0]);
  expect(left).not.toContain(ids2[1]);
  expect(errors).toEqual([]);
});

test('çizimden çıkınca eksen ve yapı çizgileri görünmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.evaluate(() => {
    const T = __tz;
    T.setTool('crect'); T.toolClick(0, 0); T.toolClick(31, 19);
    T.setTool('centerline'); T.toolClick(-20, -10); T.toolClick(-20, 30);
    T.exitSketch(true);
  });
  const r = await page.evaluate(() => {
    const xs = [];
    for (const o of __tz.sketchesGroup.children) { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) xs.push(a[i]); }
    const f = __tz.state.features.find(f => f.type === 'sketch');
    return { n: xs.length, onAxis: xs.filter(x => Math.abs(x + 20) < 1e-3).length, hasCons: f.ents.some(e => e.cons) };
  });
  expect(r.hasCons).toBe(true);   // eksen çizgisi çizimde duruyor
  expect(r.n).toBeGreaterThan(0); // dikdörtgen görünüyor
  expect(r.onAxis).toBe(0);       // eksen çizgisi çizim dışında çizilmiyor
  expect(errors).toEqual([]);
});

test('budama: teğet ve yay ucundaki kesişimler bulunur, ölçüler kalan parçaya geçer; çoğaltma konturu kapatır', async ({ page }) => {
  // Ø813 dört kanatlı yıldızın yarım kanadı sıfırdan çizilir (tasarımcının yapacağı sırayla)
  const errors = await openApp(page);
  await newSketch(page);
  const r = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat; T.sk.px = 1;
    Object.assign(f.pts, { p1: { x: 0, y: 450 }, p2: { x: 0, y: -450 }, p3: { x: -700, y: 0 }, p4: { x: 450, y: 0 }, p5: { x: -641, y: 0 }, p6: { x: -330, y: 113 },
      p7: { x: -356.7, y: 147.5 }, p8: { x: -380, y: 380 }, p9: { x: -340, y: 110 }, p10: { x: -110, y: 340 } });
    f.ents.push({ id: 'e1', t: 'line', a: 'p1', b: 'p2', cons: true }, { id: 'e2', t: 'line', a: 'p3', b: 'p4', cons: true },
      { id: 'e3', t: 'circle', c: 'O', r: 410 }, { id: 'e4', t: 'circle', c: 'O', r: 381, cons: true }, { id: 'e5', t: 'line', a: 'p5', b: 'p6' },
      { id: 'e6', t: 'circle', c: 'p7', r: 40 }, { id: 'e7', t: 'line', a: 'O', b: 'p8', cons: true }, { id: 'e8', t: 'line', a: 'p9', b: 'p10' });
    f.cons.push({ id: 'c1', t: 'v', p: 'O', q: 'p1' }, { id: 'c2', t: 'v', e: 'e1' }, { id: 'c3', t: 'h', p: 'O', q: 'p3' }, { id: 'c4', t: 'h', e: 'e2' },
      { id: 'c5', t: 'ddia', e: 'e3', val: 813, lp: [500, 500] }, { id: 'c6', t: 'ddia', e: 'e4', val: 772, lp: [-500, -480] }, { id: 'c7', t: 'pol', p: 'p5', e: 'e2' },
      { id: 'c8', t: 'poc', p: 'p7', e: 'e4' }, { id: 'c9', t: 'tan', e1: 'e5', e2: 'e6' }, { id: 'c10', t: 'ddia', e: 'e6', val: 82.4, lp: [-470, 200] },
      { id: 'c11', t: 'dang', e1: 'e5', e2: 'e2', r1: false, r2: false, val: 20, lp: [-450, 30] }, { id: 'c12', t: 'dpl', p: 'p7', e: 'e2', val: 147.5, lp: [-420, 80] },
      { id: 'c13', t: 'dang', e1: 'e7', e2: 'e1', r1: false, r2: true, val: 45, lp: [-60, 150] }, { id: 'c14', t: 'perp', e1: 'e8', e2: 'e7' },
      { id: 'c15', t: 'dpl', p: 'O', e: 'e8', val: 318.5, lp: [-100, 100] });
    T.solveSketch(f);
    // istenen yarım kanat: Ø813 yayı (eksen–yan kenar), yan kenar (Ø813–teğet nokta), R41,2 (teğet nokta–çapraz kenar), çapraz kenar (R41,2–45° ekseni)
    const P = id => id === 'O' ? [0, 0] : [f.pts[id].x, f.pts[id].y];
    const deg = (p, c) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180 / Math.PI + 360) % 360;
    const at = (e, k) => { if (e.t === 'line') { const a = P(e.a), b = P(e.b); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] }
      const c = P(e.c), rr = e.t === 'circle' ? e.r : Math.hypot(P(e.a)[0] - c[0], P(e.a)[1] - c[1]);
      let a0 = 0.3, sw = 2 * Math.PI; if (e.t === 'arc') { a0 = Math.atan2(P(e.a)[1] - c[1], P(e.a)[0] - c[0]); sw = Math.atan2(P(e.b)[1] - c[1], P(e.b)[0] - c[0]) - a0; while (sw <= 0) sw += 2 * Math.PI }
      return [c[0] + rr * Math.cos(a0 + sw * k), c[1] + rr * Math.sin(a0 + sw * k)] };
    const keep = (e, m) => { if (e.t !== 'line') { const c = P(e.c); const a = deg(m, c); return e.c === 'O' ? a > 167.3 && a < 180 : a > 290 && a < 337.6 }
      const a = P(e.a), b = P(e.b); const d = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 180;
      return Math.abs(d - 20) < 2 || Math.abs(d - 160) < 2 ? m[0] > -396.6 && m[0] < -342.6 : m[0] > -318.6 && m[0] < -225.2 };
    const ks = [0.1, 0.3, 0.5, 0.7, 0.9];
    T.setTool('trim');
    for (let i = 0; i < 40; i++) {
      let hit = null; for (const e of f.ents) if (!e.cons) { const k = ks.find(k => !keep(e, at(e, k))); if (k !== undefined) { hit = at(e, k); break } }
      if (!hit) break; T.toolClick(hit[0], hit[1]);
    }
    T.setTool(null);
    const profile = f.ents.filter(e => !e.cons);
    const half = { n: profile.length, open: T.sk.issues.open.length, kept: ['c5', 'c9', 'c10', 'c15'].filter(id => f.cons.some(c => c.id === id)).length };
    // yatay eksene aynala, orijin etrafında 4'lü dairesel çoğalt
    T.selectItems([...profile.map(e => ({ k: 'ent', id: e.id })), { k: 'ent', id: 'e2' }]); T.setSkOp('mirror'); T.applySkOp();
    T.selectItems(f.ents.filter(e => !e.cons).map(e => ({ k: 'ent', id: e.id }))); T.setSkOp('cpat'); T.sk.op.n = 4; T.applySkOp();
    return { half, n: f.ents.filter(e => !e.cons).length, issues: T.sk.issues.n, dof: T.sk.an.dof };
  });
  expect(r.half).toEqual({ n: 4, open: 2, kept: 4 }); // iki uç eksenlerde açık, ölçüler kaybolmadı
  expect(r.n).toBe(32);
  expect(r.issues).toBe(0); // komşu kanatların uçları birleşti
  const x = await page.evaluate(extrudeJS);
  expect(x.err).toEqual({});
  // ölçü değişince sekiz yarım kanat birlikte güncellenir
  const u = await page.evaluate(() => {
    const T = __tz; T.editSketch(T.state.features[0].id); const f = T.sk.feat; T.setDimVal('c5', 830);
    const P = id => id === 'O' ? { x: 0, y: 0 } : f.pts[id];
    return [...new Set(f.ents.filter(e => e.t === 'arc' && e.c === 'O' && !e.cons).map(e => Math.hypot(P(e.a).x, P(e.a).y).toFixed(3)))];
  });
  expect(u).toEqual(['415.000']);
  expect(errors).toEqual([]);
});
