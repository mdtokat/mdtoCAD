// Dördüncü kullanıcı turu: yataklı gövde (taban, yay tepeli gövde, delik, delik sihirbazı, aynala, radyus, pah, kesit) ve
// alttan cepli delikli plaka çizilirken SolidWorks'e göre bulunan hatalar.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

/** taban: Üst Düzlem'de 120 × 40 merkez dikdörtgen, 15 mm ekstrüzyon */
async function taban(page) {
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('crect'); T.toolClick(0, 0); T.toolClick(60, 20); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 15; T.commitPM(); });
}
/** çizimde (x, y) noktasına fareyle tıkla */
async function tikla(page, x, y) {
  if (!await page.evaluate(() => __tz.sk.px)) await page.mouse.move(800, 450);
  const p = await page.evaluate(([x, y]) => __tz.scr(x, y), [x, y]);
  await page.mouse.move(p[0] - 3, p[1] + 2); await page.mouse.move(p[0], p[1]); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(80);
}
const arac = (page, t) => page.evaluate(t => __tz.setTool(t), t);

test('çizim araçları arkadaki modelin kenarına, köşesine ve yay merkezine yakalanır; profil ölçü değişince tabandan kopmaz', async ({ page }) => {
  const errors = await openApp(page);
  await taban(page);
  await page.evaluate(() => { __tz.startSketch({ kind: 'std', key: 'front' }); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { __tz.sk.opts.grid = false; });
  // gövde profili: alt köşeler tabanın üst kenarına (y = 15) tıklanır; imleç birkaç piksel kenarın dışında
  await page.mouse.move(800, 450); const px = await page.evaluate(() => __tz.sk.px);
  await arac(page, 'line'); await tikla(page, -30, 15 + 3 * px); await tikla(page, 30, 15 - 3 * px); await tikla(page, 30, 45); await page.keyboard.press('Escape');
  await arac(page, 'tarc'); await tikla(page, 30, 45); await tikla(page, -30, 45); await page.keyboard.press('Escape');
  await arac(page, 'line'); await tikla(page, -30, 45); await tikla(page, -30, 15); await page.keyboard.press('Escape');
  const r1 = await page.evaluate(() => { const f = __tz.sk.feat; const ref = f.ents.find(e => e.ref);
    return { ref: ref && ref.t, pol: f.cons.filter(c => c.t === 'pol' && c.e === ref.id).length,
      y: f.ents.filter(e => !e.ref && e.t === 'line').flatMap(e => [e.a, e.b]).map(id => +f.pts[id].y.toFixed(6)).sort((a, b) => a - b)[0] }; });
  // önceden noktalar serbest kalıyordu (tabanla ilişki yok): kenar referans olarak eklenir, iki köşe onun üstünde
  expect(r1).toEqual({ ref: 'line', pol: 2, y: 15 });
  await page.evaluate(() => { document.querySelector('#cmTabs [data-cm="sketch"]').click(); document.querySelector('#ribbon [data-cmd="fulldef"]').click(); });
  await page.evaluate(() => { __tz.exitSketch(true); __tz.cmd('extrude'); __tz.pm.draft.end = 'mid'; __tz.pm.draft.depth = 30; __tz.commitPM(); });
  const m0 = await page.evaluate(() => ({ max: __tz.model.box.max[1], vol: __tz.model.props.vol, dof: Object.values(__tz.model.dof).at(-1) }));
  expect(m0.max).toBeCloseTo(75, 2);
  expect(m0.dof).toBe(0); // gövde profili tam tanımlı
  // gövdenin yüksekliğini belirleyen ölçü 10 mm artırılır: alt kenar tabanda kalır, duvarlar uzar
  // (önceden alt kenar tabana bağlı değildi; “45” konum ölçüsü değişince gövde tabandan kopup havada kalıyordu)
  await page.evaluate(() => { const T = __tz; const sk = T.state.features.filter(f => f.type === 'sketch')[1]; T.editSketch(sk.id); const f = T.sk.feat;
    const vert = c => c.t === 'd' && Math.abs(f.pts[c.p].x - f.pts[c.q].x) < 1e-6;
    const c = f.cons.find(c => c.t === 'dv') || f.cons.find(vert); T.setDimVal(c.id, c.val + 10); T.exitSketch(true); });
  const m = await page.evaluate(() => ({ max: __tz.model.box.max[1], vol: __tz.model.props.vol, err: __tz.model.errors }));
  expect(m.err).toEqual({});
  expect(m.max).toBeCloseTo(85, 2);
  expect(Math.abs(m.vol - m0.vol - 60 * 10 * 30)).toBeLessThan(60);
  // ön yüzde daire: merkezi yay merkezine yakalanır (sabit referans nokta), delik gövdeyle eşmerkezli
  await page.evaluate(() => { const T = __tz; const ex = T.state.features.filter(f => f.type === 'extrude')[1]; T.startSketch({ kind: 'face', feat: ex.id, which: 'far' }); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { __tz.sk.opts.grid = false; });
  await page.mouse.move(800, 450); const px2 = await page.evaluate(() => __tz.sk.px);
  await arac(page, 'circle'); await tikla(page, 3 * px2, 55 - 2 * px2); await tikla(page, 15, 55);
  const c = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents.find(e => e.t === 'circle'); const p = f.pts[e.c];
    return { x: +p.x.toFixed(6), y: +p.y.toFixed(6), fix: f.cons.some(c => c.t === 'fix' && c.p === e.c) }; });
  expect(c).toEqual({ x: 0, y: 55, fix: true });
  // Seç aracıyla yay kenarına tıklamak yayı referans olarak ekler (önceden çokgenin kirişlerinden biri çizgi olarak ekleniyordu)
  await arac(page, null);
  await tikla(page, 30 * Math.cos(2.3), 55 + 30 * Math.sin(2.3));
  const a = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents.find(e => e.ref && e.t !== 'line'); if (!e) return f.ents.filter(e => e.ref).map(e => e.t);
    const P = id => [f.pts[id].x, f.pts[id].y].map(v => +v.toFixed(4)); return { t: e.t, c: P(e.c), a: P(e.a), b: P(e.b) }; });
  expect(a).toEqual({ t: 'arc', c: [0, 55], a: [30, 55], b: [-30, 55] });
  expect(errors).toEqual([]);
});

test('çizim: ızgara açıkken model kenarına tıklanan nokta kenar boyunca ızgaraya oturur; altıgen yay sayılmaz', async ({ page }) => {
  const errors = await openApp(page);
  await taban(page);
  await page.evaluate(() => { __tz.startSketch({ kind: 'std', key: 'front' }); });
  await page.waitForTimeout(700);
  await page.mouse.move(800, 450); const px = await page.evaluate(() => { __tz.sk.opts.grid = true; return __tz.sk.px; });
  await arac(page, 'point'); await tikla(page, 20.3, 15 + 2 * px);
  const p = await page.evaluate(() => { const f = __tz.sk.feat; const id = Object.keys(f.pts).find(id => !f.pts[id].ref && !f.ents.some(e => [e.a, e.b].includes(id)));
    const ref = f.ents.find(e => e.ref); return [f.pts[id].x, f.pts[id].y, !!ref && f.cons.some(c => c.t === 'pol' && c.p === id && c.e === ref.id)]; });
  expect(p[2]).toBe(true); // nokta kenarın üstünde (referans kenara bağlı)
  expect(p[1]).toBeCloseTo(15, 6);
  expect(Math.abs(p[0] - Math.round(p[0]))).toBeLessThan(1e-6);
  // kenar referans olarak eklendikten sonra aynı kenara tıklanan çizgi uçları da ızgaraya oturur
  await arac(page, 'line'); await tikla(page, -20.3, 15 + 2 * px); await tikla(page, 29.7, 15 - 2 * px); await page.keyboard.press('Escape');
  const xs = await page.evaluate(() => { const f = __tz.sk.feat; const e = f.ents.find(e => e.t === 'line' && !e.ref); return [e.a, e.b].map(id => [f.pts[id].x, f.pts[id].y]); });
  expect(xs).toEqual([[-20, 15], [30, 15]]);
  // Ctrl basılıyken modele yakalanmaz (SolidWorks gibi): nokta kenara bağlanmaz
  await arac(page, 'point'); await page.keyboard.down('Control'); await tikla(page, -45, 15 + 2 * px); await page.keyboard.up('Control');
  expect(await page.evaluate(() => { const f = __tz.sk.feat; const id = Object.keys(f.pts).find(id => Math.abs(f.pts[id].x + 45) < 0.6 && !f.pts[id].ref);
    return [!!id, f.cons.some(c => c.p === id && c.t !== 'fix')]; })).toEqual([true, false]);
  // altıgen prizmanın üst yüzünde: köşeleri aynı çember üstünde olsa da kenarları çizgi olarak alınır
  await page.evaluate(() => { const T = __tz; T.exitSketch(false); document.querySelector('[data-m="new"]').click();
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('polygon'); T.toolClick(0, 0); T.toolClick(20, 0); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 10; T.commitPM();
    T.startSketch({ kind: 'std', key: 'top' }); });
  await page.waitForTimeout(700);
  await tikla(page, 15, 20 * Math.sin(Math.PI / 3) / 2 + 0.2);
  expect(await page.evaluate(() => __tz.sk.feat.ents.filter(e => e.ref).map(e => e.t))).toEqual(['line']);
  expect(errors).toEqual([]);
});

/** delikli plaka: 100 × 60 × 8, alt yüzden Ø20 × 4 cep */
async function cepliPlaka(page) {
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(100, 60); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 8; T.commitPM();
    const ex = T.state.features.find(f => f.type === 'extrude'); T.startSketch({ kind: 'face', feat: ex.id, which: 'near' }); T.sk.opts.grid = false;
    T.setTool('circle'); T.toolClick(50, 30); T.toolClick(60, 30); T.setTool(null); T.exitSketch(true);
    T.cmd('cut'); T.pm.draft.end = 'blind'; T.pm.draft.depth = 4; T.commitPM(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
}
/** gizli çizgi yollarının alt yolları (sayfa mm) */
const gizli = page => page.evaluate(() => [...document.querySelectorAll('#sheet path.d-hid')].flatMap(p => p.getAttribute('d').split('M').filter(Boolean)
  .map(s => s.split('L').map(t => t.trim().split(/\s+/).map(Number)))));

test('teknik resim: gizli daire ve yandan görülen daire kenarı kesikli çizilir (parçalar tek çoklu çizgide); DXF', async ({ page }) => {
  const errors = await openApp(page);
  await cepliPlaka(page);
  const v = await page.evaluate(() => { const c = __tz.getCtx(), t = c.views.top; const q = t.d.circ.find(q => Math.abs(q.r - 10) < 1e-6);
    return { s: t.s, top: t.map(q.a, q.b) }; });
  const subs = await gizli(page);
  // üst görünüşte alttaki cebin dairesi: tek kapalı çoklu çizgi (önceden 64 ayrı kiriş; her biri çizgiyle başlayıp düz görünüyordu)
  const daire = subs.filter(s => s.length > 8 && s.every(p => Math.abs(Math.hypot(p[0] - v.top[0], p[1] - v.top[1]) - 10 * v.s) < 0.05));
  expect(daire.length).toBe(1);
  expect(Math.hypot(daire[0][0][0] - daire[0].at(-1)[0], daire[0][0][1] - daire[0].at(-1)[1])).toBeLessThan(0.02);
  // ön görünüşte cebin tavanı (yandan görülen daire kenarı, üst üste binen kirişler): kesintisiz tek parça
  const tavan = subs.some(s => s.some((p, i) => i > 0 && Math.abs(p[1] - s[i - 1][1]) < 0.02 && Math.abs(Math.abs(p[0] - s[i - 1][0]) - 20 * v.s) < 0.05));
  expect(tavan).toBe(true);
  // DXF: gizli çoklu çizgi deseni köşelerden kesintisiz sürer
  const dxf = await page.evaluate(() => __tz.exportDXFString());
  expect(dxf).toContain('0\r\nPOLYLINE\r\n8\r\nGIZLI\r\n66\r\n1\r\n10\r\n0\r\n20\r\n0\r\n30\r\n0\r\n70\r\n128\r\n0\r\nVERTEX\r\n8\r\nGIZLI');
  expect(dxf).toContain('\r\nSEQEND\r\n');
  expect(errors).toEqual([]);
});

test('teknik resim: kesit çizgisinin ucu ve harfi genel ölçünün yazısını kapatmaz', async ({ page }) => {
  const errors = await openApp(page);
  await taban(page);
  await page.evaluate(() => { const T = __tz; T.startSketch({ kind: 'std', key: 'front' }); T.sk.opts.grid = false;
    T.setTool('crect'); T.toolClick(0, 40); T.toolClick(20, 65); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.end = 'mid'; T.pm.draft.depth = 30; T.commitPM(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.selectOption('#dSec', 'side'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const c = __tz.getCtx(); const x = c.views.front.map(0, 0)[0];
    const t = [...document.querySelectorAll('#sheet text')].find(t => t.textContent === '120'); const b = t.getBBox();
    return { x, x0: b.x, x1: b.x + b.width, nA: [...document.querySelectorAll('#sheet text')].filter(t => t.textContent === 'A').length }; });
  expect(r.nA).toBe(2);
  // kesit çizgisi ön görünüşün ortasından (x) geçer; “120” yazısı önceden tam üstündeydi
  expect(r.x < r.x0 - 1 || r.x > r.x1 + 1).toBe(true);
  expect(errors).toEqual([]);
});
