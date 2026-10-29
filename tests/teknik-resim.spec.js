// Teknik resim: SolidWorks çizim ortamındaki araçlarla karşılaştırma testleri.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya, ad) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tezgah.json`, import.meta.url).pathname);
  await page.waitForFunction(ad => __tz.state.partName.startsWith(ad), ad);
}
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  // yeni belgenin sayfası çizilene kadar bekle (antetteki parça adı)
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3 && [...document.querySelectorAll('#sheet text')].some(t => t.textContent === __tz.state.partName));
  await page.waitForTimeout(300);
}
const sheetTexts = page => page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent));
/** Bir görünüşteki en uzun uygun kenarı seçer, üzerindeki bir noktanın (uçlardan ve ortadan uzak) sayfa koordinatını döndürür. */
const edgeMid = (page, view, pred) => page.evaluate(([view, pred]) => {
  const v = __tz.getCtx().views[view]; const f = new Function('q', 'return ' + pred);
  const q = v.d.vis.filter(f).sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]))[0];
  return v.map(q[0] + (q[2] - q[0]) * 0.3, q[1] + (q[3] - q[1]) * 0.3);
}, [view, pred]);

test('genel ölçüler yay tessellasyonundan etkilenmez; delik etiketleri SolidWorks gibi satır satır ve çakışmasız', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'yatakli-stand', 'Yataklı');
  await openDrawing(page);
  let txt = await sheetTexts(page);
  expect(txt).toContain('106'); // önceden yay parçaları yüzünden 105,97 yazıyordu
  expect(txt).not.toContain('105,97');
  const boxes = await page.evaluate(() => __tz.getCtx().hits.filter(h => h.t === 'lbl').map(h => h.box));
  expect(boxes.length).toBeGreaterThan(2);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ov = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    expect(ov).toBe(0); // Ø24 ve Ø14 etiketleri önceden üst üste biniyordu
  }
  await page.click('[data-tab="model"]');
  await openSample(page, 'bukulmus-braket', 'Bükülmüş');
  await openDrawing(page);
  txt = await sheetTexts(page);
  expect(txt).toContain('2× Ø9 '); // 2× Ø9 ↧12 / ⌴Ø18 ↧2
  expect(txt).toContain('Ø18 ');
  expect(txt.join('|')).not.toContain('faturalı');
  await page.click('[data-tab="model"]');
  await openSample(page, 'dort-kanatli-disk', 'Dört');
  await openDrawing(page);
  txt = await sheetTexts(page);
  expect(txt).toContain('813');
  expect(errors).toEqual([]);
});

test('akıllı ölçü: çap, kenar uzunluğu, paralel kenarlar, noktadan kenara ve açı', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'bukulmus-braket', 'Bükülmüş');
  await openDrawing(page);
  await page.evaluate(() => __tz.setDimMode(true));
  // çap: üst görünüşteki Ø38 göbeğin çevresine tıkla
  await page.evaluate(() => {
    const v = __tz.getCtx().views.top; const c = v.d.circ.reduce((a, q) => (q.r > a.r ? q : a));
    const C = v.map(c.a, c.b); __tz.dimClick([C[0] + c.r * v.s, C[1]], 'mouse'); __tz.dimClick([C[0] + 30, C[1] - 20], 'mouse');
  });
  // kenar uzunluğu: ön görünüşteki eğik kol, sonra boş yere tıkla
  const slant = await edgeMid(page, 'front', 'Math.abs(q[2]-q[0])>3&&Math.abs(q[3]-q[1])>3');
  await page.evaluate(p => { __tz.dimClick(p, 'mouse'); __tz.dimClick([p[0] - 25, p[1] - 25], 'mouse'); }, slant);
  // açı: eğik kol ve tabandaki dikey kenar
  const vert = await edgeMid(page, 'front', 'Math.abs(q[2]-q[0])<1e-6&&Math.abs(q[3]-q[1])>15');
  const st = await page.evaluate(([a, b]) => { __tz.dimClick(a, 'mouse'); __tz.dimClick(b, 'mouse'); const st = __tz.dimSt.stage; __tz.dimClick([(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2], 'mouse'); return st; }, [slant, vert]);
  expect(st).toBe('ang');
  // paralel kenarlar: yan görünüşün iki dikey dış kenarı
  await page.evaluate(() => {
    const v = __tz.getCtx().views.left, bb = v.d.bb;
    const L = v.map(bb.minA, (bb.minB + bb.maxB) / 2), R = v.map(bb.maxA, (bb.minB + bb.maxB) / 2);
    __tz.dimClick(L, 'mouse'); __tz.dimClick(R, 'mouse'); __tz.dimClick([(L[0] + R[0]) / 2, L[1] + 40], 'mouse');
  });
  const r = await page.evaluate(() => __tz.dwS().dims.map(d => ({ kind: d.kind, val: d.kind === 'ang' ? Math.acos(d.u1[0] * d.u2[0] + d.u1[1] * d.u2[1]) * 180 / Math.PI : d.kind === 'dia' ? d.r * 2 : Math.hypot(d.p2[0] - d.p1[0], d.p2[1] - d.p1[1]) })));
  expect(r.length).toBe(4);
  expect(r[0].kind).toBe('dia');
  expect(r[0].val).toBeCloseTo(38, 1);
  expect(r[1].val).toBeGreaterThan(20);
  expect(r[2].kind).toBe('ang');
  // imlecin bulunduğu bölge açıyı ya da bütünlerini verir
  expect(Math.min(r[2].val, 180 - r[2].val)).toBeGreaterThan(5);
  expect(Math.min(r[2].val, 180 - r[2].val)).toBeLessThan(85);
  expect(r[3].val).toBeCloseTo(50, 1);
  await page.waitForTimeout(300);
  const txt = await sheetTexts(page);
  expect(txt).toContain('Ø38');
  expect(txt.some(t => /°$/.test(t))).toBe(true);
  expect(errors).toEqual([]);
});

test('görünüşler hizalı taşınır, açıklamalar sürüklenir, otomatik ölçü gizlenir', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  const r = await page.evaluate(() => {
    const T = __tz, c0 = T.getCtx(); const at = k => { const v = c0.views[k], bb = v.d.bb; return v.map(bb.minA, bb.minB) };
    const f0 = at('front'), t0 = at('top'), s0 = at('left');
    // ön görünüşü sürükle: üst ve yan görünüş de birlikte kayar
    const pan = { hit: c0.hits.find(h => h.t === 'view' && h.k === 'front') }; T.dwDragMove(pan, 10, 5); T.dwDragEnd(pan);
    // üst görünüş yalnızca dikey kayar
    const pan2 = { hit: T.buildSheet(false).ctx.hits.find(h => h.t === 'view' && h.k === 'top') }; T.dwDragMove(pan2, 30, 8); T.dwDragEnd(pan2);
    const c1 = T.buildSheet(false).ctx; const at1 = k => { const v = c1.views[k], bb = v.d.bb; return v.map(bb.minA, bb.minB) };
    return { f: [at1('front')[0] - f0[0], at1('front')[1] - f0[1]], t: [at1('top')[0] - t0[0], at1('top')[1] - t0[1]], s: [at1('left')[0] - s0[0], at1('left')[1] - s0[1]], vofs: T.dwS().vofs };
  });
  expect(r.f[0]).toBeCloseTo(10, 3); expect(r.f[1]).toBeCloseTo(5, 3);
  expect(r.t[0]).toBeCloseTo(10, 3); expect(r.t[1]).toBeCloseTo(13, 3);
  expect(r.s[0]).toBeCloseTo(10, 3); expect(r.s[1]).toBeCloseTo(5, 3);
  await page.waitForTimeout(300);
  // otomatik genel ölçüyü seç ve Delete ile gizle
  const hidden = await page.evaluate(() => {
    const h = __tz.getCtx().hits.find(x => x.t === 'auto' && x.k === 'ow:front'); __tz.dwSelect(h); return !!h;
  });
  expect(hidden).toBe(true);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  let txt = await sheetTexts(page);
  expect(await page.evaluate(() => __tz.dwS().hide)).toContain('ow:front');
  expect(txt).not.toContain('120');
  // delik etiketini sürükle: konumu kaydedilir
  const moved = await page.evaluate(() => {
    const h = __tz.getCtx().hits.find(x => x.t === 'lbl'); const pan = { hit: h }; __tz.dwDragMove(pan, -20, 15); __tz.dwDragEnd(pan);
    const o = __tz.dwS().lbl[h.k]; return [o[0] - (h.K[0] - h.C[0]), o[1] - (h.K[1] - h.C[1])];
  });
  expect(moved[0]).toBeCloseTo(-20, 3); expect(moved[1]).toBeCloseTo(15, 3);
  // gerçek fare ile: izometrik görünüşü sürükle, sonra tıklayıp seç
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => {
    const h = __tz.getCtx().hits.find(x => x.t === 'view' && x.k === 'iso'); const m = document.querySelector('#sheet').getScreenCTM();
    const x = (h.box[0] + h.box[2]) / 2, y = (h.box[1] + h.box[3]) / 2; return [m.a * x + m.e, m.d * y + m.f, m.a];
  });
  await page.mouse.move(c[0], c[1]); await page.mouse.down();
  await page.mouse.move(c[0] + 20, c[1] + 10, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const iso = await page.evaluate(() => __tz.dwS().vofs.iso);
  expect(iso[0]).toBeCloseTo(20 / c[2], 1); expect(iso[1]).toBeCloseTo(10 / c[2], 1);
  await page.mouse.click(c[0] + 20, c[1] + 10);
  expect(await page.evaluate(() => __tz.dwSel)).toEqual({ t: 'view', i: undefined, k: 'iso' });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => __tz.dwSel)).toBe(null);
  // geri getir
  await page.evaluate(() => { __tz.dwS().hide = []; __tz.renderDrawing(); });
  await page.waitForTimeout(300);
  txt = await sheetTexts(page);
  expect(txt).toContain('120');
  expect(errors).toEqual([]);
});

test('geometrik tolerans, referans işareti; üst görünüşte yarım kesit ve taramalı detay; DXF ve PDF', async ({ page }) => {
  const errors = await openApp(page);
  await openDrawing(page);
  await page.evaluate(() => {
    const T = __tz, v = T.getCtx().views.front, bb = v.d.bb;
    const P = v.map(bb.minA + 3, bb.minB); // tabanın alt kenarı
    T.setDwTool('datum'); T.dwToolClick(P, 'mouse');
    T.setDwTool('gdt'); T.dwToolClick(v.map(bb.maxA - 3, bb.minB), 'mouse');
    const S = T.dwS(); Object.assign(S.gdts[0], { sym: 'perp', tol: '0,02', dat: ['A', '', ''] });
    S.section = 'top'; S.secType = 'half'; T.renderDrawing();
  });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const T = __tz, S = T.dwS(), c = T.getCtx();
    const v = c.views.top, bb = v.d.bb;
    S.details = [{ view: 'top', c: [(bb.minA + bb.maxA) / 2 + 12, (bb.minB + bb.maxB) / 2], r: 10, k: 2, pos: [330, 120], label: 'B' }];
    const m = T.buildSheet(true).markup;
    return { datums: S.datums.map(d => d.label), gdt: S.gdts.length, sec: c.views.top.d.secPolys.length, m };
  });
  expect(r.datums).toEqual(['A']);
  expect(r.gdt).toBe(1);
  expect(r.sec).toBeGreaterThan(0);
  expect(r.m).toContain('KESİT A-A');
  expect(r.m).toContain('DETAY B ÖLÇEK 2:1');
  expect(r.m).toContain('>0,02<');
  // DXF: katmanlar, çizgi türleri ve varlıklar
  const dxf = await page.evaluate(() => __tz.exportDXFString());
  expect(dxf.startsWith('0\r\nSECTION')).toBe(true);
  for (const k of ['AC1009', 'GIZLI', 'EKSEN', 'GORUNUR', '\r\nLINE\r\n', '\r\nCIRCLE\r\n', '\r\nTEXT\r\n', '\r\nSOLID\r\n', '%%c']) expect(dxf).toContain(k);
  expect(dxf.trim().endsWith('EOF')).toBe(true);
  // PDF yeni öğelerle de üretilir
  const pdf = await page.evaluate(async () => { __tz.openPdfDialog('2d'); Object.assign(__tz.pdfOpt, { kind: '2d', paper: 'A3', orient: 'landscape', layout: 'full' }); const b = await __tz.makePdf(); const blob = b.blob || b; return new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 8)); });
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(errors).toEqual([]);
});
