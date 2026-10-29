// Normal kullanım: uygulama fareyle, bir kullanıcının izleyeceği sırayla kullanılarak bulunan hatalar.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const PLAKA = new URL('./veri/plaka-pim.tezgah.json', import.meta.url).pathname;
async function openFile(page, path) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(path);
  await page.waitForFunction(() => __tz.state.partName === 'Plaka');
}
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.waitForTimeout(300);
}
async function newSketch(page, key) {
  await page.evaluate(key => { document.querySelector('[data-m="new"]').click(); __tz.startSketch({ kind: 'std', key }); }, key);
  await page.waitForTimeout(900); // çizime dik bakış animasyonu
}
async function drag(page, from, to) {
  const [a, b] = await page.evaluate(([p, q]) => [__tz.scr(...p), __tz.scr(...q)], [from, to]);
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  await page.mouse.move(a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3); await page.mouse.move(b[0], b[1]); await page.mouse.up();
}

test('tümünden geçen kılavuz deliğinin diş çizgileri gövdenin içinde kalır', async ({ page }) => {
  const errors = await openApp(page);
  await openFile(page, PLAKA);
  // diş, araç boyu kadar değil plaka kalınlığı (15) kadar
  const th = await page.evaluate(() => __tz.model.ann.filter(a => a.thread).map(a => +(a.thread.t1 - a.thread.t0).toFixed(3)));
  expect(th).toEqual([15, 15, 15, 15]);
  await openDrawing(page);
  // ön ve yan görünüşte diş çizgileri görünüşün dışına (alttaki görünüşlere) taşmaz
  const out = await page.evaluate(() => { const c = __tz.getCtx(); let n = 0;
    for (const k of ['front', 'left', 'right']) { const v = c.views[k]; if (!v) continue; const bb = v.d.bb;
      for (const t of v.d.threads) if (t.t === 'line' && [t.s[1], t.s[3]].some(b => b < bb.minB - 1e-3 || b > bb.maxB + 1e-3)) n++; }
    return n; });
  expect(out).toBe(0);
  expect(errors).toEqual([]);
});

test('çizim: sürüklenen nokta orijine bırakılınca birleşir, çizginin üstüne bırakılınca üzerinde kalır', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'top');
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false;
    T.setTool('circle'); T.toolClick(20, 10); T.toolClick(28, 10);
    T.setTool('line'); T.toolClick(-30, -20); T.toolClick(60, -20); T.setTool(null); T.setTool('line'); T.toolClick(40, 10); T.toolClick(40, -10); T.setTool(null); });
  await drag(page, [20, 10], [0.3, -0.2]);
  await drag(page, [40, -10], [40.2, -20.3]);
  const r = await page.evaluate(() => { const f = __tz.sk.feat; const [c, l1, l2] = f.ents; const p = f.pts[l2.b], a = f.pts[l1.a], b = f.pts[l1.b];
    const off = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
    return { c: c.c, pol: f.cons.some(k => k.t === 'pol' && k.p === l2.b && k.e === l1.id), on: off < 1e-6 }; });
  expect(r).toEqual({ c: 'O', pol: true, on: true });
  // birleşen nokta ayrı bir geri alma adımı değildir: tek geri alma sürüklemeyi de geri alır
  await page.evaluate(() => document.querySelector('#undoBtn').click());
  expect(await page.evaluate(() => __tz.sk.feat.cons.some(k => k.t === 'pol'))).toBe(false);
  expect(errors).toEqual([]);
});

test('çizim: döndürme profili eksene dik inerek kapanır (eksen üstündeki son nokta dikey kalır)', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'front');
  const r = await page.evaluate(() => { const T = __tz, f = T.sk.feat;
    T.setTool('centerline'); T.toolClick(-10, 0); T.toolClick(70, 0); T.setTool(null);
    T.setTool('line'); T.toolClick(0, 0); T.toolClick(0, 17.5); T.toolClick(60, 17.5); T.toolClick(60.6, 0.3); T.toolClick(0, 0); T.setTool(null);
    const e = f.ents[3], p = f.pts[e.b];
    return { x: p.x, y: +p.y.toFixed(9), v: f.cons.some(c => c.t === 'v' && c.e === e.id), pol: f.cons.some(c => c.t === 'pol' && c.p === e.b && c.e === f.ents[0].id) };
  });
  expect(r).toEqual({ x: 60, y: 0, v: true, pol: true });
  expect(errors).toEqual([]);
});

test('çizim radyusu köşeye bağlı ölçüleri silmez (sanal köşe)', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'front');
  const r = await page.evaluate(() => { const T = __tz, f = T.sk.feat;
    T.setTool('rect'); T.toolClick(0, 0); T.sk.cursor = [60, 30]; T.applySkInput({ W: 80, H: 40 }); T.setTool(null);
    const before = f.cons.filter(c => 'val' in c).map(c => c.val).sort();
    T.sk.opts.filletR = 5; T.setTool('sfillet'); T.toolClick(80, 40); T.toolClick(0, 0); T.setTool(null);
    return { before, after: f.cons.filter(c => c.t === 'd').map(c => c.val).sort(), dof: T.sk.an.dof, toast: document.querySelector('#toast').textContent };
  });
  expect(r.before).toEqual([40, 80]);
  expect(r.after).toEqual([40, 80]);
  expect(r.dof).toBe(0);
  expect(r.toast).not.toContain('kaldırıldı');
  // ölçü değişince radyuslu kontur yeni ölçüyü izler
  const v = await page.evaluate(() => { const T = __tz, f = T.sk.feat; T.setDimVal(f.cons.find(c => c.t === 'd' && c.val === 40).id, 50); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 10; T.commitPM(); return { err: T.model.errors, vol: T.model.props.vol }; });
  expect(v.err).toEqual({});
  expect(v.vol).toBeCloseTo((80 * 50 - 2 * (25 - Math.PI * 25 / 4)) * 10, -1);
  expect(errors).toEqual([]);
});

test('pah/radyus panelinde dairesel kenar çapıyla gösterilir', async ({ page }) => {
  const errors = await openApp(page);
  await openFile(page, PLAKA);
  await page.evaluate(() => __tz.switchPart(__tz.project.parts.find(p => p.partName === 'Pim').id));
  await page.click('#ribbon >> text=Pah');
  const [x, y] = await page.evaluate(() => __tz.scrW([14.9 * Math.SQRT1_2, 40, 14.9 * Math.SQRT1_2]));
  await page.mouse.click(x, y);
  await expect(page.locator('#pm')).toContainText('Kenar 1: dairesel Ø29,8');
  expect(errors).toEqual([]);
});

test('teknik resim: delik konum ölçüleri izometrik görünüşe değmez', async ({ page }) => {
  const errors = await openApp(page);
  await openFile(page, PLAKA);
  await openDrawing(page);
  const r = await page.evaluate(() => { const c = __tz.getCtx(); const iso = c.hits.find(h => h.t === 'view' && h.k === 'iso').box;
    const ov = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    return { n: c.hits.filter(h => h.t === 'auto' && h.k.startsWith('hp:')).length, hit: c.hits.filter(h => h.t === 'auto' && ov(h.box, iso)).map(h => h.k), scale: c.scale }; });
  expect(r.n).toBeGreaterThanOrEqual(4);
  expect(r.hit).toEqual([]);
  expect(r.scale).toBe(2); // yer açmak için ölçek küçülmez
  expect(errors).toEqual([]);
});

test('montaj resmi: balon, deliğe oturan pimin kenarını değil parçanın kendi kenarını gösterir', async ({ page }) => {
  const errors = await openApp(page);
  await openFile(page, PLAKA);
  await page.click('[data-tab="asm"]');
  await page.evaluate(() => __tz.openAsmDrawing());
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.iso);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const v = __tz.getCtx().views.iso;
    const segs = v.d.vis.map(q => ({ A: v.map(q[0], q[1]), B: v.map(q[2], q[3]), c: q[4] }));
    const dist = (P, s) => { const dx = s.B[0] - s.A[0], dy = s.B[1] - s.A[1], L = dx * dx + dy * dy; let t = L ? ((P[0] - s.A[0]) * dx + (P[1] - s.A[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(s.A[0] + dx * t - P[0], s.A[1] + dy * t - P[1]); };
    // balon ucu: küçük dolu eşkenar dörtgen
    const tips = [...document.querySelectorAll('#sheet path.d-ar')].map(p => p.getAttribute('d').match(/-?[\d.]+/g).map(Number)).filter(n => n.length === 8 && Math.abs(n[2] - n[0] - 0.7) < 1e-3).map(n => [n[2], n[1]]);
    return tips.map(P => { const own = segs.reduce((a, s) => { const d = dist(P, s); return d < a.d ? { d, c: s.c } : a; }, { d: Infinity }); return Math.min(...segs.filter(s => s.c !== own.c).map(s => dist(P, s))); });
  });
  expect(r.length).toBe(2);
  for (const d of r) expect(d).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('otomatik patlatma: bileşen eşleştiği parçadan tamamen ayrılır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="asm"]');
  await page.click('#ribbon >> text=Patlatılmış Görünüm');
  await page.click('#pm >> text=Otomatik patlat');
  const r = await page.evaluate(() => { const a = __tz.curAsm(), v = __tz.asmView;
    const ry = c => { const b = v.groups.get(c.id).d.box; return [b.min[1] + c.T[13], b.max[1] + c.T[13]]; };
    const base = a.comps.find(c => c.fixed);
    return a.explode.steps.map(s => { const c = a.comps.find(x => x.id === s.comps[0]); return s.dir === 'y' ? ry(c)[0] + s.dist - ry(base)[1] : null; });
  });
  expect(r.length).toBe(5);
  for (const gap of r) expect(gap).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('teknik resim: dairesel çoğaltılmış delikler delik dairesi çapıyla ölçülür', async ({ page }) => {
  const errors = await openApp(page);
  await newSketch(page, 'top');
  await page.evaluate(() => { const T = __tz; T.setTool('circle'); T.toolClick(0, 0); T.sk.cursor = [30, 0]; T.applySkInput({ D: 100 }); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 10; T.commitPM(); });
  // fareyle: üst yüzeye delik, sonra dairesel çoğaltma (6 adet)
  await page.waitForTimeout(500);
  await page.click('#ribbon >> text=Delik Sihirbazı');
  await page.click('#pm >> text=Basit');
  const [x, y] = await page.evaluate(() => __tz.scrW([40, 10, 0]));
  await page.mouse.click(x, y);
  await page.evaluate(() => { const T = __tz; T.pm.draft.pts = [[40, 0]]; T.commitPM(); T.cmd('cpattern'); T.commitPM(); });
  expect(await page.evaluate(() => [__tz.model.errors, __tz.state.features.at(-1).type])).toEqual([{}, 'cpattern']);
  await openDrawing(page);
  const r = await page.evaluate(() => { const c = __tz.getCtx(); return { pcd: c.hits.filter(h => h.k && h.k.startsWith('pcd:')).length, hp: c.hits.filter(h => h.k && h.k.startsWith('hp:')).length,
    txt: [...document.querySelectorAll('#sheet text')].map(t => t.textContent), circ: document.querySelectorAll('#sheet circle.d-cen').length }; });
  expect(r.pcd).toBe(1);
  expect(r.hp).toBe(0); // kenardan Kartezyen konum ölçüleri yok
  expect(r.txt).toContain('Ø80');
  expect(r.txt).toContain('6× Ø10');
  expect(r.circ).toBe(1);
  // dikdörtgen yerleşimli dört delik (örnek parça) Kartezyen ölçülür
  await page.evaluate(() => document.querySelector('[data-m="demo"]').click());
  await page.waitForFunction(() => __tz.state.partName === 'Yatak gövdesi' && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === 'Yatak gövdesi'));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => __tz.getCtx().hits.filter(h => h.k && h.k.startsWith('pcd:')).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('PDF indirilince pencere kapanır', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  await page.click('[data-dcmd="pdf"]');
  await expect(page.locator('#pdfDlg')).toHaveClass(/on/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdfGo')]);
  expect((await dl.createReadStream()) !== null).toBe(true);
  await expect(page.locator('#pdfDlg')).not.toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test('montaj: eşleştirme düzenlenirken mesafe yazıp hemen Enter hata vermez, yeni değer uygulanır', async ({ page }) => {
  const errors = await openApp(page);
  await openFile(page, PLAKA);
  await page.click('[data-tab="asm"]');
  await page.click('.ti:has-text("Çakışık1")');
  await page.click('.ti.sel [data-ma="edit"]');
  await page.click('#pm >> text=Mesafe');
  const inp = page.locator('#pm input[data-num]');
  await inp.fill('');
  await inp.type('12');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const a = __tz.curAsm(); return { pm: !!__tz.asmUI.pm, m: a.mates.map(m => m.name), y: +a.comps[1].T[13].toFixed(3) }; });
  expect(r).toEqual({ pm: false, m: ['Eşmerkezli1', 'Mesafe1'], y: -13 }); // pim üstü plaka üstünden 12 mm yukarıda
  expect(errors).toEqual([]);
});

test('görünümdeki yönerge şeridi altındaki modele yapılan tıklamayı engellemez', async ({ page }) => {
  const errors = await openApp(page);
  await page.selectOption('#partSel', { label: 'Mil' });
  await page.click('#ribbon >> text=Delik Sihirbazı');
  await expect(page.locator('#vpPrompt')).toBeVisible();
  // dik duran milin üst yüzeyi şeridin altında kalıyor
  const b = await page.locator('#vpPrompt').boundingBox();
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, [b.x + b.width / 2, b.y + b.height / 2]);
  expect(hit).toBe('CANVAS');
  const [x, y] = await page.evaluate(() => __tz.scrW([1.5, 110, 1]));
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.pm.draft.pts.length)).toBe(1);
  expect(errors).toEqual([]);
});
