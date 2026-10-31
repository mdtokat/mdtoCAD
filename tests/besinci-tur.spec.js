// Beşinci kullanıcı turu (SolidWorks referans): L blok (taban, duvar, delikler, R10 radyus) ve örnek montajlar teknik resme
// aktarılıp ölçülendirilirken bulunan hatalar: yay (radyus) ölçüsü, seçim sırası, model değişince ölçülerin güncellenmesi,
// izdüşüm yöntemi değişince yan görünüş ölçüleri, balon yerleşimi, montaj resminde patlatılmış görünüm.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

/** görünümde bir dünya noktasına tıkla */
async function tikla(page, p) { const [x, y] = await page.evaluate(p => __tz.scrW(p), p); await page.mouse.click(x, y); await page.waitForTimeout(150); }

/** L blok: 100 × 60 × 15 taban, arkada 100 × 60 × 15 duvar, duvarda Ø12 delik (y = 50), tabanda iki M8 geçiş deliği (±35, z = 15), ön köşelerde R10 */
async function lblok(page) {
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('crect'); T.toolClick(0, 0); T.toolClick(50, 30); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 15; T.commitPM();
    T.startSketch({ kind: 'std', key: 'front' }); T.sk.opts.grid = false; T.setTool('rect'); T.toolClick(-50, 15); T.toolClick(50, 75); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 15; T.pm.draft.fromOff = -30; T.commitPM(); });
  await page.click('#hud [data-hud="iso"]'); await page.waitForTimeout(700);
  await page.click('#cmTabs [data-cm="features"]');
  await page.click('#ribbon [data-cmd="hole"]'); await tikla(page, [0, 50, -15]);
  await page.evaluate(() => { const d = __tz.pm.draft; d.htype = 'simple'; d.dia = 12; d.end = 'through'; __tz.commitPM(); });
  for (const x of [35, -35]) {
    await page.click('#ribbon [data-cmd="hole"]'); await tikla(page, [x, 15, 15]);
    await page.evaluate(() => { const d = __tz.pm.draft; d.htype = 'clear'; d.size = 'M8'; d.end = 'through'; __tz.commitPM(); });
  }
  await page.click('#ribbon [data-cmd="fillet"]'); await tikla(page, [50, 7, 30]); await tikla(page, [-50, 7, 30]);
  await page.evaluate(() => { __tz.pm.draft.r = 10; __tz.commitPM(); });
  expect(await page.evaluate(() => __tz.state.features.map(f => f.type))).toEqual(['sketch', 'extrude', 'sketch', 'extrude', 'hole', 'hole', 'hole', 'fillet']);
}
async function openDrawing(page) {
  // önceki resmin bağlamı kalmış olabilir (model değişti): sekme değişince yeni resim çizilene kadar beklenir. Resim bir sonraki
  // karede çizilir; yük altındaki CI makinesinde kare gecikince test eski bağlamdaki eski ölçüleri okuyordu
  await page.evaluate(() => { window.__oncekiResim = __tz.getCtx(); });
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && __tz.getCtx() !== window.__oncekiResim && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
}
/** teknik resimde görünüş koordinatındaki (a, b) noktasına fareyle tıkla (dx, dy: sayfa mm kaydırma) */
async function cv(page, k, a, b, dx = 0, dy = 0) {
  const [X, Y] = await page.evaluate(([k, a, b, dx, dy]) => { const p = __tz.getCtx().views[k].map(a, b), s = document.querySelector('#sheet'), pt = s.createSVGPoint();
    pt.x = p[0] + dx; pt.y = p[1] + dy; const q = pt.matrixTransform(s.getScreenCTM()); return [q.x, q.y]; }, [k, a, b, dx, dy]);
  await page.mouse.move(X - 2, Y - 2); await page.mouse.move(X, Y); await page.mouse.click(X, Y); await page.waitForTimeout(120);
}
const olcuYazilari = page => page.evaluate(() => [...document.querySelectorAll('#sheet g[data-dim] text')].map(t => t.textContent));

test('teknik resim: yaya tıklanınca yarıçap ölçüsü; yayın ara köşeleri nokta değil, merkezi nokta; radyus otomatik R ile yazılır', async ({ page }) => {
  const errors = await openApp(page);
  await lblok(page);
  await openDrawing(page);
  // üst görünüşte (b = −z) iki R10 yayı; delik daireleri tam daire
  const yay = await page.evaluate(() => __tz.getCtx().views.top.d.arcs.map(a => [Math.round(a.r * 1000) / 1000, a.full, Math.round(Math.abs(a.sw) * 180 / Math.PI)]));
  expect(yay).toEqual(expect.arrayContaining([[10, false, 90], [10, false, 90], [4.5, true, 360]]));
  // yayın kiriş köşeleri nokta değil (önceden yayın ortasına tıklamak bir çokgen köşesini seçiyordu); yay merkezi nokta
  const n = await page.evaluate(() => { const s = __tz.getCtx().snaps.filter(s => s.view === 'top'); const on = s.filter(s => Math.abs(Math.hypot(s.a - 40, s.b + 20) - 10) < 1e-3);
    return { kenar: on.length, merkez: s.some(s => s.c && Math.hypot(s.a - 40, s.b + 20) < 1e-6) }; });
  expect(n).toEqual({ kenar: 2, merkez: true });
  // otomatik ölçüler: R10 bir kez (SolidWorks model öğeleri gibi)
  const t = await page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent));
  expect(t.filter(x => x === 'R10').length).toBe(1);
  // akıllı ölçü: yayın ortası → yarıçap; yazı yayın dışına konunca yay uzantısı çizilir
  await page.click('[data-dcmd="dim"]');
  const ang = -Math.PI / 4;
  await cv(page, 'top', 40 + 10 * Math.cos(ang), -20 + 10 * Math.sin(ang));
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe('dia');
  await cv(page, 'top', 60, -10);
  const d = await page.evaluate(() => { const d = __tz.dwS().dims[0]; return { kind: d.kind, rad: d.rad, r: Math.round(d.r * 1000) / 1000, uzanti: document.querySelectorAll('#sheet g[data-dim="0"] path.d-thin').length }; });
  expect(d).toEqual({ kind: 'dia', rad: true, r: 10, uzanti: 2 });
  expect(await olcuYazilari(page)).toEqual(['R10']);
  // çap ölçüsüne “R” ön eki yarıçapı yazar (önceden Ø12 dairesine R yazınca “R12” çıkıyordu); yaya “Ø” çap yazar
  await cv(page, 'front', 6 * Math.cos(1), 50 + 6 * Math.sin(1)); await cv(page, 'front', 20, 70);
  await page.evaluate(() => { const S = __tz.dwS(); S.dims[1].pre = 'R'; S.dims[0].pre = 'Ø'; __tz.renderDrawing(); });
  await page.waitForTimeout(200);
  expect(await olcuYazilari(page)).toEqual(['Ø20', 'R6']);
  expect(errors).toEqual([]);
});

test('akıllı ölçü: seçim sırası önemsiz — önce nokta sonra kenar (uzaklık), nokta sonra daire (merkezler arası), kenar sonra daire', async ({ page }) => {
  const errors = await openApp(page);
  await lblok(page);
  await openDrawing(page);
  await page.click('[data-dcmd="dim"]');
  // delik merkezi → sağ kenar (önceden ikinci tıklama kenarı kabul etmiyordu, araç noktada takılı kalıyordu)
  await cv(page, 'top', 35, -15); await cv(page, 'top', 50, 5);
  expect(await page.evaluate(() => __tz.dimSt.stage)).toBe(2);
  await cv(page, 'top', 42, 12);
  // delik merkezi → öbür deliğin dairesine (çevresine) tıklama: merkezler arası
  await cv(page, 'top', 35, -15); await cv(page, 'top', -35 + 4.5, -15); await cv(page, 'top', 0, -45);
  // ön kenar → delik dairesi: merkezin kenara uzaklığı
  await cv(page, 'top', 0, -30); await cv(page, 'top', -35, -15 + 4.5); await cv(page, 'top', -60, -22);
  expect(await olcuYazilari(page)).toEqual(['15', '70', '15']);
  expect(errors).toEqual([]);
});

test('model değişince elle ölçüler aynı kenarı/daireyi bulur ve güncellenir (SolidWorks gibi; önceden kırmızı ve eski değerde kalıyordu)', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await lblok(page);
  await openDrawing(page);
  await page.click('[data-dcmd="dim"]');
  await cv(page, 'front', -20, 15); await cv(page, 'front', -20, 0); await cv(page, 'front', -70, 7);           // taban kalınlığı 15
  await cv(page, 'front', 6 * Math.cos(1), 50 + 6 * Math.sin(1)); await cv(page, 'front', 20, 70);           // Ø12
  await cv(page, 'top', 40 + 10 * Math.cos(-0.8), -20 + 10 * Math.sin(-0.8)); await cv(page, 'top', 62, -45); // R10
  await cv(page, 'top', 35, -15); await cv(page, 'top', 50, 5); await cv(page, 'top', 42, 12);                // delik → kenar 15
  await cv(page, 'front', 50, 40); await cv(page, 'front', 66, 40);                                           // sağ kenar boyu 75
  await page.keyboard.press('Escape');
  expect(await olcuYazilari(page)).toEqual(['15', 'Ø12', 'R10', '15', '75']);
  await page.click('[data-tab="model"]'); await page.waitForTimeout(200);
  await page.evaluate(() => { const T = __tz; const F = t => T.state.features.filter(f => f.type === t);
    T.openPM('extrude', F('extrude')[0]); T.pm.draft.depth = 20; T.commitPM();
    T.openPM('hole', F('hole')[0]); T.pm.draft.dia = 14; T.commitPM();
    T.openPM('fillet', F('fillet')[0]); T.pm.draft.r = 15; T.commitPM();
    T.openPM('hole', F('hole')[1]); T.pm.draft.pts = [[30, -15]]; T.commitPM(); });
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  await openDrawing(page);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [...__tz.getCtx().stale])).toEqual([]);
  expect(await olcuYazilari(page)).toEqual(['20', 'Ø14', 'R15', '20', '75']);
  // taşınan ölçüler kaydedilir: sayfa yenilenince de yeni değerler
  await page.evaluate(() => __tz.flushState());
  await page.reload();
  await page.waitForFunction(() => window.__tz && window.__tz.model && window.__tz.model.polys.length > 0);
  await openDrawing(page);
  expect(await olcuYazilari(page)).toEqual(['20', 'Ø14', 'R15', '20', '75']);
  expect(errors).toEqual([]);
});

test('izdüşüm yöntemi değişince yan görünüşteki ölçüler silinmez, aynalanarak yeni yan görünüşe taşınır', async ({ page }) => {
  const errors = await openApp(page);
  await lblok(page);
  await openDrawing(page);
  await page.click('[data-dcmd="dim"]');
  // soldan görünüşte (a = z) duvar kalınlığı: duvarın iki dikey kenarı (z = −30, −15)
  await cv(page, 'left', -30, 50); await cv(page, 'left', -15, 50); await cv(page, 'left', -22, 85);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const S = __tz.dwS(); S.notes = []; });
  expect(await olcuYazilari(page)).toEqual(['15']);
  await page.selectOption('#dMethod', 'A'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const S = __tz.dwS(), c = __tz.getCtx(); return { n: S.dims.length, view: S.dims[0].view, a: S.dims[0].p1.concat(S.dims[0].p2).filter((_, i) => i % 2 === 0).map(x => Math.round(x)).sort((x, y) => x - y), stale: [...c.stale] }; });
  // sağdan görünüşte a = −z: kenarlar a = 15 ve 30'da; ölçü geometriye oturur (bayat değil)
  expect(r).toEqual({ n: 1, view: 'right', a: [15, 30], stale: [] });
  expect(await olcuYazilari(page)).toEqual(['15']);
  await page.selectOption('#dMethod', 'E'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => [__tz.dwS().dims[0].view, [...__tz.getCtx().stale].length])).toEqual(['left', 0]);
  expect(errors).toEqual([]);
});

test('kesit görünüşünde kesilip atılan taraftaki deliğin eksen çizgisi çizilmez', async ({ page }) => {
  const errors = await openApp(page);
  await lblok(page);
  await openDrawing(page);
  // duvardaki Ø12 deliğin ekseni (z yönünde, x = 0) üst görünüşte b = 15…30 arasında bir çizgi
  const eksen = () => page.evaluate(() => __tz.getCtx().views.top.d.axes.filter(q => Math.abs(q[0]) < 1e-6 && Math.abs(q[2]) < 1e-6).length);
  expect(await eksen()).toBe(1);
  // üst görünüşte kesit A-A: kesici y = 37,5'ten yukarısını atar; duvar deliği atılan tarafta kalır
  await page.selectOption('#dSec', 'top'); await page.waitForTimeout(500);
  expect(await eksen()).toBe(0);
  // tabandaki delikler (kalan taraf) daire olarak ve merkez işaretleriyle kalır
  expect(await page.evaluate(() => __tz.getCtx().views.top.d.marks.filter(m => Math.abs(m.r - 4.5) < 1e-6).length)).toBe(2);
  expect(errors).toEqual([]);
});

async function ornekAc(page, dosya) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { document.querySelector('#fileBtn').click(); document.querySelector('[data-m="open"]').click(); })]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForTimeout(400);
  await page.click('[data-tab="asm"]'); await page.waitForTimeout(400);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.waitForTimeout(300);
}
/** balonun kutusuna giren ölçü/kılavuz çizgileri (balonun kendi kılavuzu hariç) */
const balonCakisma = page => page.evaluate(() => {
  const c = __tz.getCtx(), out = [];
  const segs = [...document.querySelectorAll('#sheet path.d-thin')].flatMap(p => p.getAttribute('d').split('M').filter(Boolean).map(s => s.split('L').map(t => t.trim().split(/\s+/).map(Number))))
    .filter(q => q.length === 2).map(q => [...q[0], ...q[1]]);
  const hit = (q, B) => { if (Math.max(q[0], q[2]) < B[0] || Math.min(q[0], q[2]) > B[2] || Math.max(q[1], q[3]) < B[1] || Math.min(q[1], q[3]) > B[3]) return false;
    for (let i = 0; i <= 40; i++) { const x = q[0] + (q[2] - q[0]) * i / 40, y = q[1] + (q[3] - q[1]) * i / 40; if (x > B[0] && x < B[2] && y > B[1] && y < B[3]) return true; } return false; };
  for (const h of c.hits.filter(h => h.t === 'bal')) { const B = h.box, cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
    for (const q of segs) { const own = [[q[0], q[1]], [q[2], q[3]]].some(P => Math.abs(Math.hypot(P[0] - cx, P[1] - cy) - 4.2) < 0.05); if (!own && hit(q, B)) out.push(h.k); } }
  return [...new Set(out)];
});

test('montaj resmi: balonlar ölçü ve uzatma çizgilerinin üstüne konmaz', async ({ page }) => {
  const errors = await openApp(page);
  for (const dosya of ['mentese', 'flansli-kaplin']) {
    await ornekAc(page, dosya);
    // önceden menteşede “2”, kaplinde “5” ve “1” yan görünüşün genel ölçüsünün çizgisi üstündeydi
    expect(await balonCakisma(page)).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('montaj resmi: patlatma adımı yoksa düğme adımları oluşturur; yalnızca izometrik görünüş patlatılır, antet ölçeği görünüşünkü', async ({ page }) => {
  const errors = await openApp(page);
  await ornekAc(page, 'kasnak-duzeni');
  const once = await page.evaluate(() => { const c = __tz.getCtx(), b = v => v.d.bb; return { on: b(c.views.front), iso: b(c.views.iso) }; });
  expect(await page.evaluate(() => (__tz.curAsm().explode || { steps: [] }).steps.length)).toBe(0);
  await page.click('[data-dcmd="explode"]'); await page.waitForTimeout(600);
  const sonra = await page.evaluate(() => { const c = __tz.getCtx(), b = v => v.d.bb; return { on: b(c.views.front), iso: b(c.views.iso), adim: __tz.curAsm().explode.steps.length, olcu: [...document.querySelectorAll('#sheet text')].map(t => t.textContent) }; });
  // önceden düğme açık görünüyor ama hiçbir şey değişmiyordu
  expect(sonra.adim).toBeGreaterThan(0);
  // ön görünüş toplanmış montaj (genel ölçüler 128 × 83 kalır), izometrik patlatılmış (daha geniş)
  expect(sonra.on).toEqual(once.on);
  expect(sonra.olcu).toContain('128');
  expect(sonra.olcu).toContain('83');
  const gen = q => q.maxA - q.minA + q.maxB - q.minB;
  expect(gen(sonra.iso)).toBeGreaterThan(gen(once.iso) * 1.3);
  // yalnızca izometrik düzen: tek görünüş patlatılmış; antetteki ölçek görünüşün ölçeği (ayrı “Ölçek” yazısı yok)
  await page.selectOption('#dAsmView', 'iso'); await page.waitForTimeout(600);
  const iso = await page.evaluate(() => { const c = __tz.getCtx(); return { s: c.views.iso.s, olcek: c.scale, yazi: [...document.querySelectorAll('#sheet text')].some(t => t.textContent.startsWith('Ölçek 1:')) }; });
  expect(iso.s).toBe(iso.olcek);
  expect(iso.yazi).toBe(false);
  expect(errors).toEqual([]);
});

test('teknik resim: döndürme kademelerinin zincir ölçüsü delik konum ölçüleriyle aynı sıraya düşmez (yataklı stand)', async ({ page }) => {
  const errors = await openApp(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => { document.querySelector('#fileBtn').click(); document.querySelector('[data-m="open"]').click(); })]);
  await fc.setFiles(new URL('../ornekler/yatakli-stand.tocad.json', import.meta.url).pathname);
  await page.waitForTimeout(400);
  await openDrawing(page);
  const kutular = await page.evaluate(() => __tz.getCtx().hits.filter(h => h.t === 'auto' || h.t === 'lbl').map(h => ({ k: h.k, b: h.box })));
  const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const cak = [];
  for (let i = 0; i < kutular.length; i++) for (let j = i + 1; j < kutular.length; j++) if (ov(kutular[i].b, kutular[j].b) > 0.5) cak.push(kutular[i].k + ' / ' + kutular[j].k);
  // önceden “hp:top:v:0 / kb:top:0”: iki “20” yazısı üst üste
  expect(cak).toEqual([]);
  expect(kutular.some(h => h.k === 'ar:front:30')).toBe(true); // kolonun üstü R30
  expect(errors).toEqual([]);
});
