// toCAD duman (smoke) testleri. Her test örnek projeyle temiz başlar.
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
  await fc.setFiles(new URL('../ornekler/dort-kanatli-disk.tocad.json', import.meta.url).pathname);
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

test('otomatik tam tanımlama kullanıcı isteğine bağlı; tanımsız öğeler mavi, tanımlılar siyah', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  const tri = () => { const T = __tz; T.setTool('line'); T.toolClick(10, 10); T.toolClick(60, 10); T.toolClick(40, 45); T.toolClick(10, 10); T.setTool(null); };
  const dims = f => f.cons.filter(c => /^d/.test(c.t)).length;
  // varsayılan: çıkarken ve tekrar girerken ölçü eklenmez, öğeler mavi
  const a = await page.evaluate(([tri, dims]) => {
    const T = __tz; eval(tri)(); const id = T.sk.feat.id; T.exitSketch(true);
    const f = T.state.features.find(x => x.id === id); const out = { dof: T.model.dof[id], dims: eval(dims)(f) };
    T.editSketch(id); const C = T.skColors();
    out.dimsIn = eval(dims)(T.sk.feat); out.dofIn = T.sk.an.dof;
    out.blue = T.sk.feat.ents.every(e => T.skEntColor(e) === C.und);
    // Sabitle: yalnızca sabitlenen çizgi siyah olur, serbest ucu olan komşular mavi kalır
    const l = T.sk.feat.ents[0]; T.selectItems([{ k: 'ent', id: l.id }]); T.addRelation('fix'); T.selectItems([]);
    out.fixed = T.skEntColor(l) === C.def; out.othersBlue = T.sk.feat.ents.slice(1).every(e => T.skEntColor(e) === C.und);
    // Tam Tanımla düğmesi: istenince eksik ölçüler eklenir, hepsi siyah
    T.cmd('fulldef'); out.dofDef = T.sk.an.dof; out.black = T.sk.feat.ents.every(e => T.skEntColor(e) === C.def);
    return out;
  }, [tri.toString(), dims.toString()]);
  expect(a.dof).toBeGreaterThan(0);
  expect(a.dims).toBe(0);
  expect(a.dimsIn).toBe(0);
  expect(a.dofIn).toBe(a.dof);
  expect(a.blue).toBe(true);
  expect(a.fixed).toBe(true);
  expect(a.othersBlue).toBe(true);
  expect(a.dofDef).toBe(0);
  expect(a.black).toBe(true);
  // panelden seçenek açılınca çizimden çıkarken eksik ölçüler eklenir
  await page.evaluate(() => __tz.exitSketch(true));
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.check('[data-opt="autodef"]');
  // ikinci üçgen ilkinden uzağa çizilir: ilk çizimin köşelerine tıklansaydı onlara yakalanıp sabitlenirdi
  const b0 = await page.evaluate(([tri, dims]) => {
    const T = __tz; T.setTool('line'); for (const p of [[110, 10], [160, 10], [140, 45], [110, 10]]) T.toolClick(...p); T.setTool(null); const id = T.sk.feat.id; T.exitSketch(true);
    const f = T.state.features.find(x => x.id === id); return { dof: T.model.dof[id], dims: eval(dims)(f) };
  }, [tri.toString(), dims.toString()]);
  expect(b0.dof).toBe(0);
  expect(b0.dims).toBeGreaterThan(0);
  // seçenek açıkken dışarıdan gelen, hiç ölçüsü olmayan çizim girişte tam tanımlanır
  const sx = { id: 's1', type: 'sketch', name: 'Çizim1', on: { kind: 'std', key: 'front' },
    pts: { a: { x: 100, y: 0 }, b: { x: 140, y: 0 }, c: { x: 140, y: 20 }, d: { x: 100, y: 20 }, m: { x: 120, y: 20 } },
    ents: [{ id: 'e1', t: 'line', a: 'a', b: 'b' }, { id: 'e2', t: 'line', a: 'b', b: 'c' }, { id: 'e3', t: 'arc', c: 'm', a: 'c', b: 'd' }, { id: 'e4', t: 'line', a: 'd', b: 'a' }], cons: [] };
  const proj = { app: 'tocad', version: 3, parts: [{ id: 'P1', partName: 'Dış parça', features: [sx,
    { id: 'x1', type: 'extrude', name: 'Ekstrüzyon1', op: 'add', sketch: 's1', end: 'blind', depth: 10 }] }], asms: [], cur: { part: 'P1' } };
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles({ name: 'dis.tocad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proj)) });
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
  // dikdörtgeni ikiye bölen çizgi profili bozmaz: bölgeler birleşir
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(60, 40); T.setTool('line'); T.toolClick(30, 0); T.toolClick(30, 40); });
  const e = await page.evaluate(extrudeJS);
  expect(e.err).toEqual({});
  expect(e.vol).toBeCloseTo(60 * 40 * 20, 0);
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
  // bağlı öğeler (yüzeyine çizilen çizimler…) olduğu için onay sorulur
  await expect(page.locator('#askDlg')).toHaveClass(/on/);
  await page.click('#askBtns button:has-text("Yalnızca bunu sil")');
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
  await page.click('#askBtns button:has-text("Yalnızca bunu sil")');
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

test('çizim düzenlenirken onu kullanan özellik gizlenir, koyu temada gövde koyulaşır', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.evaluate(() => { const T = __tz; T.setTool('crect'); T.toolClick(0, 0); T.toolClick(31, 19); T.exitSketch(true); T.cmd('extrude'); });
  await page.waitForFunction(() => !!__tz.pm);
  const r = await page.evaluate(() => {
    const T = __tz; T.commitPM();
    const id = T.state.features.find(f => f.type === 'sketch').id;
    const out = { before: T.shown.polys.length, color0: T.solidMesh.material.color.getHex() };
    T.editSketch(id);
    Object.assign(out, { during: T.shown.polys.length, color1: T.solidMesh.material.color.getHex() });
    T.exitSketch(true);
    Object.assign(out, { after: T.shown.polys.length, color2: T.solidMesh.material.color.getHex(), err: T.model.errors });
    return out;
  });
  expect(r.before).toBeGreaterThan(0);
  expect(r.during).toBe(0);          // ekstrüzyon düzenleme boyunca görünmez
  expect(r.after).toBe(r.before);    // çıkınca geri gelir
  expect(r.color1).not.toBe(r.color0);
  expect(r.color2).toBe(r.color0);
  expect(r.err).toEqual({});
  expect(errors).toEqual([]);
});

test('yeni çizimde ilk ölçü girilince görünüm çizime sığar', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const T = __tz;
    T.setTool('line'); T.toolClick(5, 5); T.toolClick(35, 5); T.setTool(null);
    T.setTool('smartdim'); T.toolClick(20, 5); T.toolClick(20, 11);
    T.setDimVal(T.sk.feat.cons.find(c => c.t === 'd' || c.t === 'dh').id, 800);
  });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const f = __tz.sk.feat, l = f.ents.find(e => e.t === 'line');
    const a = __tz.scr(f.pts[l.a].x, f.pts[l.a].y), b = __tz.scr(f.pts[l.b].x, f.pts[l.b].y);
    const v = document.querySelector('canvas').getBoundingClientRect();
    return { len: Math.hypot(f.pts[l.a].x - f.pts[l.b].x, f.pts[l.a].y - f.pts[l.b].y), a, b, v: [v.left, v.top, v.right, v.bottom] };
  });
  expect(r.len).toBeCloseTo(800, 3);
  for (const p of [r.a, r.b]) { expect(p[0]).toBeGreaterThan(r.v[0]); expect(p[0]).toBeLessThan(r.v[2]); expect(p[1]).toBeGreaterThan(r.v[1]); expect(p[1]).toBeLessThan(r.v[3]); }
  expect(Math.abs(r.a[0] - r.b[0])).toBeGreaterThan((r.v[2] - r.v[0]) * 0.3); // çizgi ekranda küçük kalmaz
  expect(errors).toEqual([]);
});

test('ölçü girişinde dört işlem: 800/2 ve 5+(20+2)*3', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.evaluate(() => {
    const T = __tz;
    T.setTool('line'); T.toolClick(5, 5); T.toolClick(35, 5); T.setTool(null);
    T.setTool('smartdim'); T.toolClick(20, 5); T.toolClick(20, 11);
  });
  const pop = page.locator('.pop input');
  await pop.fill('800/2');
  await pop.press('Enter');
  const len = () => page.evaluate(() => { const f = __tz.sk.feat, l = f.ents.find(e => e.t === 'line'); return Math.hypot(f.pts[l.a].x - f.pts[l.b].x, f.pts[l.a].y - f.pts[l.b].y); });
  expect(await len()).toBeCloseTo(400, 4);
  const row = page.locator('.dimrow input').first();
  await row.fill('5+(20+2)*3');
  await row.press('Enter');
  expect(await len()).toBeCloseTo(71, 4);
  await row.fill('5+(2');
  await row.press('Enter');
  await expect(row).toHaveClass(/bad/);
  expect(await len()).toBeCloseTo(71, 4);
  expect(errors).toEqual([]);
});

test('öğe üstüne tıklanınca çakışıklık: daire çevresi, yay bitişi, çokgen köşesi', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  const r = await page.evaluate(() => {
    const T = __tz, f = T.sk.feat;
    T.setTool('line'); T.toolClick(-50, 0); T.toolClick(50, 0); T.setTool(null);
    const line = f.ents.find(e => e.t === 'line').id;
    const onLine = id => f.cons.some(c => c.t === 'pol' && c.p === id && c.e === line);
    // daire: merkez yukarıda, çevre çizginin üstüne
    T.setTool('circle'); T.toolClick(-20, 10); T.toolClick(-20, 0);
    const circ = f.ents.find(e => e.t === 'circle');
    const tie = f.cons.find(c => c.t === 'poc' && c.e === circ.id);
    // merkez nokta yay: bitiş çizginin üstüne
    T.setTool('arc'); T.toolClick(20, 5); T.toolClick(30, 5); T.toolClick(28.5, 0);
    const arc = f.ents.find(e => e.t === 'arc');
    // çokgen: ilk köşe çizginin ucuna (mevcut noktaya)
    const end = f.ents.find(e => e.id === line).b;
    T.setTool('polygon'); T.toolClick(50, 20); T.toolClick(50, 0);
    const poly = f.ents.filter(e => e.t === 'line' && !e.cons && e.id !== line);
    const out = { circTie: !!tie && onLine(tie.p), arcTie: onLine(arc.a) || onLine(arc.b), polyShares: poly.some(e => e.a === end || e.b === end) };
    T.setTool(null); T.exitSketch(true);
    const g = T.state.features.find(x => x.type === 'sketch');
    out.kept = !!g.pts[tie.p];
    const P = g.pts[tie.p], C = g.pts[circ.c];
    out.onCircle = Math.abs(Math.hypot(P.x - C.x, P.y - C.y) - g.ents.find(e => e.id === circ.id).r) < 1e-6;
    const L = g.ents.find(e => e.id === line), A = g.pts[L.a], B = g.pts[L.b];
    out.onLine = Math.abs((P.x - A.x) * (B.y - A.y) - (P.y - A.y) * (B.x - A.x)) / Math.hypot(B.x - A.x, B.y - A.y) < 1e-6;
    out.lineY = [A.y, B.y];
    return out;
  });
  expect(r).toEqual({ circTie: true, arcTie: true, polyShares: true, kept: true, onCircle: true, onLine: true, lineY: [0, 0] });
  expect(errors).toEqual([]);
});

test('bölgeler: kesişen şekiller birleşir, kolların çevrelediği boşluk dolmaz, bölge tıklanarak seçilir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  // dikdörtgen + taşan daire → birleşim
  const a = await page.evaluate(() => {
    const T = __tz; T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(40, 20); T.setTool('circle'); T.toolClick(35, 30); T.toolClick(45, 30);
    return { warn: !!document.querySelector('.warnnote') };
  });
  expect(a.warn).toBe(false); // kesişme artık sorun değil
  const e = await page.evaluate(extrudeJS);
  expect(e.err).toEqual({});
  expect(e.vol).toBeGreaterThan(40 * 20 * 20 + 100 * 20);
  expect(e.vol).toBeLessThan((40 * 20 + Math.PI * 100) * 20);
  // dört kol + dört köşe dairesi: iç kare boş kalır, iç içe daireler delik olur
  const v = await page.evaluate(() => {
    const sk = { pts: {}, ents: [], cons: [] };let i = 0;
    const P = (x, y) => { const id = 'p' + (++i); sk.pts[id] = { x, y }; return id; };
    const c = [[-40, -40], [40, -40], [40, 40], [-40, 40]];
    for (const r of [13, 8]) for (const [x, y] of c) sk.ents.push({ id: 'e' + (++i), t: 'circle', c: P(x, y), r });
    for (const [x0, y0, x1, y1] of [[-30, -44.5, 30, -35.5], [-30, 35.5, 30, 44.5], [-44.5, -30, -35.5, 30], [35.5, -30, 44.5, 30]]) {
      const q = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
      q.forEach((id, k) => sk.ents.push({ id: 'e' + (++i), t: 'line', a: id, b: q[(k + 1) % 4] }));
    }
    const sh = __tz.sketchProfiles(sk);
    return { n: sh.length, holes: sh.reduce((s, x) => s + x.holes.length, 0) };
  });
  expect(v).toEqual({ n: 1, holes: 5 }); // dış kontur + iç boşluk + dört delik
  // bölge seçimi: yalnızca dairenin dikdörtgen dışında kalan parçası
  await newSketch(page);
  // yarıçap noktası hiçbir öğeye yakın değil: (43, 10) sağ kenarın orta noktasına 3 mm'dir ve yakın görünümde ona yakalanıp daireyi küçültebiliyordu
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(40, 20); T.setTool('circle'); T.toolClick(35, 10); T.toolClick(27, 10); T.setTool(null); T.exitSketch(true); T.cmd('extrude'); });
  // ekran konumu ve tıklama aynı anda: kamera animasyonu arada konumu kaydıramaz
  await page.evaluate(() => { const [x, y] = __tz.scrW([42, 10, 0]); __tz.click3D({ clientX: x, clientY: y, button: 0 }); });
  const r = await page.evaluate(() => { const T = __tz; const reg = T.pm.draft.regions; const s = T.state.features[0]; const c = s.ents.find(e => e.t === 'circle');
    T.commitPM(); return { reg, err: T.model.errors, vol: T.model.props.vol, cx: s.pts[c.c].x, R: c.r }; });
  expect(r.reg.length).toBe(1);
  expect(r.err).toEqual({});
  const d = 40 - r.cx, seg = r.R * r.R * Math.acos(d / r.R) - d * Math.sqrt(r.R * r.R - d * d); // dikdörtgen dışındaki daire parçası
  expect(r.vol / 20 / seg).toBeCloseTo(1, 2);
  expect(errors).toEqual([]);
});

test('ince özellik: açık zincir kalınlıkla ekstrüde edilir; başlangıç ofseti', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('line'); T.toolClick(0, 0); T.toolClick(0, 40); T.toolClick(30, 40); T.toolClick(30, 0); T.setTool(null); T.exitSketch(true); T.cmd('extrude'); });
  await expect(page.locator('#pm')).toContainText('İnce özellik');
  const r = await page.evaluate(() => { const T = __tz; const d = T.pm.draft; const thin = d.thin; Object.assign(d, { thick: 5, thinSide: 'mid', depth: 10, fromOff: 15 }); T.commitPM();
    const b = T.model.box; return { thin, err: T.model.errors, vol: T.model.props.vol, z: [b.min[2], b.max[2]] }; });
  expect(r.thin).toBe(true);
  expect(r.err).toEqual({});
  expect(r.vol).toBeCloseTo(110 * 5 * 10, 0);
  expect(r.z[0]).toBeCloseTo(15, 6);
  expect(r.z[1]).toBeCloseTo(25, 6);
  expect(errors).toEqual([]);
});

test('delik sihirbazı: özel faturalı ölçüler', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const feats = JSON.parse(JSON.stringify(__tz.state.features));
    feats.push({ id: 'h1', type: 'hole', name: 'Delik1', htype: 'cbore', size: 'custom', dia: 9, cbd: 20, cbh: 6.5, end: 'through', depth: 12,
      on: { kind: 'face', feat: 'x1', which: 'far', sgn: 1 }, pts: [[30, -20]] });
    const r = __tz.rebuildModel(feats);
    return { err: r.errors, txt: r.ann.filter(a => a.txt).map(a => a.txt) };
  });
  expect(r.err).toEqual({});
  expect(r.txt).toContain('Ø9, faturalı Ø20 derinlik 6,5');
});

test('çizerken ölçü yazma: çizgi uzunluğu, dikdörtgen ve çap ölçü olarak eklenir', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('line'); T.toolClick(0, 0); T.sk.cursor = [10, 0.2]; });
  await page.keyboard.type('5*10');
  await expect(page.locator('.pop.skin')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(100, 0); T.sk.cursor = [110, 10]; });
  await page.keyboard.type('60');
  await page.keyboard.press('Enter');
  await page.keyboard.type('40');
  await page.keyboard.press('Enter');
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(-50, 0); T.sk.cursor = [-45, 0]; });
  await page.keyboard.type('25');
  await page.keyboard.press('Enter');
  const r = await page.evaluate(() => { const f = __tz.sk.feat; return { dims: f.cons.filter(c => c.val != null).map(c => [c.t, c.val]), p1: f.pts.p1 }; });
  expect(r.dims).toEqual([['d', 50], ['d', 60], ['d', 40], ['ddia', 25]]);
  expect(r.p1.x).toBeCloseTo(50, 6);
  expect(r.p1.y).toBeCloseTo(0, 6);
  expect(errors).toEqual([]);
});

test('çizerken ölçü yazma: çizgide açı (Sekme ile), kanalda boy ve genişlik', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  // 50 mm, 30°: Enter uzunluk alanından açıya geçmeden uygular; açıya Sekme ile geçilir
  await page.evaluate(() => { const T = __tz; T.setTool('line'); T.toolClick(0, 0); T.sk.cursor = [10, 1]; });
  await page.keyboard.type('50'); await page.keyboard.press('Tab'); await page.keyboard.type('30'); await page.keyboard.press('Enter');
  let p = await page.evaluate(() => { const f = __tz.sk.feat; return f.pts[f.ents[0].b]; });
  expect(p.x).toBeCloseTo(50 * Math.cos(Math.PI / 6), 2); expect(p.y).toBeCloseTo(25, 2);
  await page.evaluate(() => { __tz.sk.cursor = [43.3, 40]; });
  await page.keyboard.type('20'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => ({ n: __tz.sk.feat.ents.length, pop: !!document.querySelector('.pop.skin') }))).toEqual({ n: 2, pop: false });
  // kanal: boy Enter → genişlik → Enter; merkezler arası ve genişlik sürücü ölçü olur
  await page.evaluate(() => { const T = __tz; T.setTool('slot'); T.toolClick(100, 0); T.sk.cursor = [120, 0.1]; });
  await page.keyboard.type('40'); await page.keyboard.press('Enter'); await page.keyboard.type('12'); await page.keyboard.press('Enter');
  const r = await page.evaluate(() => { const f = __tz.sk.feat; return { dims: f.cons.filter(c => c.val != null).map(c => [c.t, c.val]), arcs: f.ents.filter(e => e.t === 'arc').length,
    w: (() => { const l = f.ents.filter(e => e.t === 'line' && !e.cons).slice(-2); return Math.abs(f.pts[l[0].a].y - f.pts[l[1].a].y); })() }; });
  expect(r.dims).toEqual([['d', 50], ['d', 20], ['d', 40], ['dll', 12]]);
  expect(r.arcs).toBe(2);
  expect(r.w).toBeCloseTo(12, 6);
  expect(errors).toEqual([]);
});

for (const [dosya, ad, kutu] of [['bukulmus-braket', 'Bükülmüş', [124, 171.5, 50]], ['yatakli-stand', 'Yataklı', [106, 155, 106]], ['l-destek', 'L destek', [30, 65, 35]]]) {
  test(`örnek: ${dosya} hatasız, tam tanımlı ve teknik resmi çizilir`, async ({ page }) => {
    const errors = await openApp(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
    await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
    await page.waitForFunction(ad => __tz.state.partName.startsWith(ad), ad);
    const r = await page.evaluate(() => { const m = __tz.model, b = m.box; return { err: m.errors, dof: Object.values(m.dof), box: b.min.map((v, i) => b.max[i] - v) }; });
    expect(r.err).toEqual({});
    for (const d of r.dof) expect(d).toBe(0);
    r.box.forEach((v, i) => expect(v).toBeCloseTo(kutu[i], 0));
    await page.click('[data-tab="drawing"]');
    await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
    expect(errors).toEqual([]);
  });
}

test('çözücü en az hareketle çözer; üst üste düşen özdeş kopyalar deliği doldurmaz', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // tam tanımlanmamış yamuk: paralel aralık ölçüsü üst kenarı yalnızca yukarı taşımalı, uçları yer değiştirmemeli
    const sk = { pts: { p1: { x: 60, y: 0 }, p2: { x: 25, y: 15 }, p3: { x: 5, y: 15 } }, ents: [{ id: 'e1', t: 'line', a: 'O', b: 'p1' }, { id: 'e2', t: 'line', a: 'p1', b: 'p2' }, { id: 'e3', t: 'line', a: 'p2', b: 'p3' }, { id: 'e4', t: 'line', a: 'p3', b: 'O' }],
      cons: [{ id: 'c1', t: 'h', e: 'e1' }, { id: 'c2', t: 'h', e: 'e3' }, { id: 'c3', t: 'd', p: 'O', q: 'p1', val: 60 }, { id: 'c4', t: 'dll', e1: 'e3', e2: 'e1', val: 20 }] };
    const ok = __tz.solveSketch(sk);
    // Ø100 içinde iki özdeş Ø10 daire (aynalanmış kopyanın üstüne düşen çoğaltma kopyası) + bir Ø10
    const d = { pts: { c0: { x: 0, y: 0 }, c1: { x: -30, y: 0 }, c2: { x: 30, y: 0 } }, ents: [{ id: 'a', t: 'circle', c: 'c0', r: 50 }, { id: 'b', t: 'circle', c: 'c1', r: 5 }, { id: 'c', t: 'circle', c: 'c1', r: 5 }, { id: 'd', t: 'circle', c: 'c2', r: 5 }], cons: [] };
    return { ok, p2: sk.pts.p2, p3: sk.pts.p3, holes: __tz.sketchProfiles(d)[0].holes.length };
  });
  expect(r.ok).toBe(true);
  expect(r.p2.y).toBeCloseTo(20, 5);
  expect(r.p3.y).toBeCloseTo(20, 5);
  expect(r.p2.x).toBeGreaterThan(r.p3.x + 15); // kenarlar çaprazlanmaz
  expect(r.holes).toBe(2);
});

test('çizim kolaylıkları: F çizime sığdırır, eşit radyuslar, çift tıklamayla zincir, panelden sonra görünüme yazma', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(400, 250); T.setTool(null); });
  await page.keyboard.press('f');
  await page.waitForTimeout(700);
  const fit = await page.evaluate(() => { const r = document.querySelector('#viewport canvas').getBoundingClientRect(); return [[0, 0], [400, 250]].every(([x, y]) => { const [X, Y] = __tz.scr(x, y); return X > r.left && X < r.right && Y > r.top && Y < r.bottom; }); });
  expect(fit).toBe(true);
  // bir kenara çift tıklama dört kenarı da seçer
  const [X, Y] = await page.evaluate(() => __tz.scr(200, 0));
  await page.mouse.dblclick(X, Y);
  expect(await page.evaluate(() => __tz.sk.sel.filter(h => h.k === 'ent').length)).toBe(4);
  // aynı yarıçapla iki köşeye radyus: biri ölçülü, diğeri ona eşit
  const f = await page.evaluate(() => { const T = __tz; T.setTool('sfillet'); T.sk.opts.filletR = 20; T.toolClick(0, 0); T.toolClick(400, 250); return T.sk.feat.cons.filter(c => c.t === 'drad' || c.t === 'eq').map(c => c.t); });
  expect(f).toEqual(['drad', 'eq']);
  // çokgen kenar sayısını panelden yazıp görünüme tıklayınca rakamlar çizerken ölçü kutusuna gider
  await page.evaluate(() => __tz.setTool('polygon'));
  await page.fill('#pm input[data-k="polyN"]', '5');
  const [cx, cy] = await page.evaluate(() => __tz.scr(200, 125));
  await page.mouse.click(cx, cy);
  await page.mouse.move(cx + 40, cy);
  await page.keyboard.type('60');
  await expect(page.locator('.pop.skin')).toBeVisible();
  await page.keyboard.press('Enter');
  const p = await page.evaluate(() => { const f = __tz.sk.feat; return { n: f.ents.filter(e => e.t === 'line' && !e.cons).length, d: f.cons.filter(c => c.t === 'ddia').map(c => c.val) }; });
  expect(p).toEqual({ n: 4 + 5, d: [60] });
  expect(errors).toEqual([]);
});

test('özellik akışı: önizleme izometrik, ağaçta çift tıklama, panel alanında Enter, yeni düzlemde çizim', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page);
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(40, 30); T.setTool(null); });
  await page.click('[data-cm="features"]');
  await page.click('[data-cmd="extrude"]');
  await page.waitForTimeout(800);
  // çizime dik bakış bırakıldı: normal yönündeki iki nokta ekranda farklı yerlere düşer
  const tilt = await page.evaluate(() => { const a = __tz.scrW([0, 0, 0]), b = __tz.scrW([0, 0, 30]); return Math.hypot(a[0] - b[0], a[1] - b[1]); });
  expect(tilt).toBeGreaterThan(10);
  await page.fill('#pm input[data-k="depth"]', '25');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => ({ pm: !!__tz.pm, d: __tz.state.features[1].depth }))).toEqual({ pm: false, d: 25 });
  const row = page.locator('.ti[data-id]').first();
  const bb = await row.boundingBox();
  await page.mouse.dblclick(bb.x + 70, bb.y + bb.height / 2);
  expect(await page.evaluate(() => __tz.pm && [__tz.pm.type, __tz.pm.isNew])).toEqual(['extrude', false]);
  await page.keyboard.press('Escape');
  // referans düzlem onaylanınca seçili kalır; Çizim doğrudan onun üstünde başlar
  await page.click('.ti[data-plane="top"]');
  await page.click('[data-cmd="plane"]');
  await page.fill('#pm input[data-k="offset"]', '40');
  await page.keyboard.press('Enter');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  expect(await page.evaluate(() => __tz.sk.feat.on.kind)).toBe('plane');
  expect(errors).toEqual([]);
});

test('teknik resim: delik konum ölçüleri; montaj resminde çakışan mil ve delik yüzeyleri çizgi üretmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent));
  expect(txt).toContain('96'); // 4× Ø9 delik merkezleri arası (simetrik)
  expect(txt).toContain('56');
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="adraw"]');
  await page.waitForFunction(() => !!__tz.getCtx() && __tz.getCtx().views.front && __tz.dwSrc().kind === 'asm');
  const n = await page.evaluate(() => { const d = __tz.getCtx().views.front.d; return d.hid.filter(q => Math.abs(q[0]) < 12.9 && Math.abs(q[2]) < 12.9 && Math.abs(q[0] - q[2]) < 0.01).length; });
  expect(n).toBeLessThan(12); // önceden mil yüzeyinin her üçgen kenarı gizli çizgi olarak çiziliyordu (~100)
  expect(errors).toEqual([]);
});

test('şerit dar ekranda sığar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await page.evaluate(() => __tz.startSketch({ kind: 'std', key: 'front' }));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => { const el = document.querySelector('#ribbon'); return el.scrollWidth - el.clientWidth; });
  expect(r).toBeLessThanOrEqual(1);
});

test('ekstrüzyon: gövdeye kadar', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const F = [
      { id: 's1', type: 'sketch', name: 'Ç1', on: { kind: 'std', key: 'front' }, pts: { p1: { x: -40, y: 0 }, p2: { x: 40, y: 0 }, p3: { x: 40, y: 20 }, p4: { x: -40, y: 20 } },
        ents: [{ id: 'e1', t: 'line', a: 'p1', b: 'p2' }, { id: 'e2', t: 'line', a: 'p2', b: 'p3' }, { id: 'e3', t: 'line', a: 'p3', b: 'p4' }, { id: 'e4', t: 'line', a: 'p4', b: 'p1' }], cons: [] },
      { id: 'x1', type: 'extrude', name: 'E1', op: 'add', sketch: 's1', end: 'mid', depth: 40 },
      { id: 'pl', type: 'plane', name: 'D1', base: 'top', offset: 50, flip: false },
      { id: 's2', type: 'sketch', name: 'Ç2', on: { kind: 'plane', id: 'pl' }, pts: { c: { x: 10, y: 5 } }, ents: [{ id: 'k', t: 'circle', c: 'c', r: 6 }], cons: [] },
      { id: 'x2', type: 'extrude', name: 'E2', op: 'add', sketch: 's2', end: 'body', flip: true, depth: 10 }];
    const a = __tz.rebuildModel(F);
    const b = JSON.parse(JSON.stringify(F)); b[4].flip = false;
    // gövdeye kadar: kör ile 30 mm yapılan çıkıntıyla aynı hacim
    const c = JSON.parse(JSON.stringify(F)); Object.assign(c[4], { end: 'blind', depth: 30 });
    const vol = m => __tz.rebuildModel(m).polys.reduce((s, p) => { const v = p.verts; for (let i = 1; i < v.length - 1; i++) s += v[0].dot(v[i].cross(v[i + 1])) / 6; return s; }, 0);
    return { err: a.errors, err2: __tz.rebuildModel(b).errors.x2, v: vol(F), v30: vol(c) };
  });
  expect(r.err).toEqual({});
  expect(r.err2).toContain('gövde yok');
  expect(r.v).toBeCloseTo(r.v30, 0);
});

test('eğri yüzey: silindir yüzeyi çizim düzlemi olarak kabul edilmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  await page.evaluate(() => { const T = __tz; T.startSketch({ kind: 'std', key: 'top' }); T.setTool('circle'); T.toolClick(0, 0); T.toolClick(20, 0); T.exitSketch(true); T.cmd('extrude'); T.commitPM(); });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const [x, y] = __tz.scrW([14.142, 10, 14.142]); __tz.click3D({ clientX: x, clientY: y, button: 0 });
    __tz.cmd('sketch');
    return { sk: !!__tz.sk, toast: document.querySelector('#toast').textContent };
  });
  expect(r.sk).toBe(false);
  expect(r.toast).toContain('düz değil');
  expect(errors).toEqual([]);
});
