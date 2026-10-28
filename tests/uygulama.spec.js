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
