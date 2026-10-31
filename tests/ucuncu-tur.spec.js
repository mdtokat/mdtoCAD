// Üçüncü kullanıcı turu: rulman kapağı (döndürme, delik sihirbazı, dairesel çoğaltma, pah, radyus, kesit), M12 somun
// (çokgen, döndürme kesme pahı), kanallı plaka, sac L braket ve kapak + pul montajı çizilirken SolidWorks'e göre bulunan hatalar.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

/** rulman kapağı: Ön Düzlem'de profil (Ø120 × 12 flanş, Ø80 × 10 çıkıntı, Ø40 delik), y ekseni etrafında döndürme */
async function kapak(page) {
  return page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'front' }); T.sk.opts.grid = false;
    T.setTool('centerline'); T.toolClick(0, -10); T.toolClick(0, 40);
    T.setTool('line'); for (const p of [[20, 0], [60, 0], [60, 12], [40, 12], [40, 22], [20, 22], [20, 0]]) T.toolClick(...p); T.setTool(null);
    document.querySelector('#cmTabs [data-cm="sketch"]').click(); document.querySelector('#ribbon [data-cmd="fulldef"]').click();
    T.exitSketch(true); T.cmd('revolve'); T.commitPM(); });
}

/** görünümde bir dünya noktasına tıkla */
async function tikla(page, p) { const [x, y] = await page.evaluate(p => __tz.scrW(p), p); await page.mouse.click(x, y); await page.waitForTimeout(150); }

async function kapakDelikli(page) {
  await kapak(page);
  await page.click('#hud [data-hud="top"]'); await page.waitForTimeout(700);
  await page.click('#cmTabs [data-cm="features"]');
  await page.click('#ribbon [data-cmd="hole"]');
  await tikla(page, [50, 12, 0]);
  await page.evaluate(() => { const d = __tz.pm.draft; d.htype = 'clear'; d.size = 'M8'; d.end = 'through'; __tz.commitPM(); });
  await page.evaluate(() => { __tz.cmd('cpattern'); __tz.pm.draft.n = 4; __tz.commitPM(); });
}
const egit = (page, eski, yeni) => page.evaluate(([eski, yeni]) => { const T = __tz; const sk = T.state.features.find(f => f.type === 'sketch'); T.editSketch(sk.id);
  const c = T.sk.feat.cons.find(c => c.t === 'd' && Math.abs(c.val - eski) < 1e-6); T.setDimVal(c.id, yeni); T.exitSketch(true); return T.model.props.vol; }, [eski, yeni]);
async function openDrawing(page) {
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && !!__tz.getCtx().views.front);
  await page.waitForTimeout(300);
}
const metinler = page => page.evaluate(() => [...document.querySelectorAll('#sheet text')].map(t => t.textContent.trim()));

test('döndürmenin omuz yüzeyindeki delik, profil ölçüsü değişince yüzeyle taşınır (tümünden geçmeye devam eder)', async ({ page }) => {
  const errors = await openApp(page);
  await kapakDelikli(page);
  const on = await page.evaluate(() => __tz.state.features.find(f => f.type === 'hole').on);
  expect(on.which).toBe('rev');
  const v15 = await egit(page, 12, 15);
  // flanş 15 mm: Ø9 delikler 15 mm boyunca açılır (önceden y = 12'deki eski yüzeyde kalıp üstte 3 mm dolu bırakıyordu)
  const k = Math.cos(Math.PI / 64) * Math.sin(Math.PI / 64) * 64 / Math.PI; // 64 parçalı daire alan oranı
  const beklenen = k * Math.PI * ((60 * 60 - 20 * 20) * 15 + (40 * 40 - 20 * 20) * 10 - 4 * 4.5 * 4.5 * 15);
  expect(Math.abs(v15 - beklenen) / beklenen).toBeLessThan(0.002);
  // yüzeye açılan çizim de taşınır: çıkıntının üst yüzündeki pim çıkıntı 10 → 14 mm olunca da üstte kalır
  await page.click('#hud [data-hud="iso"]'); await page.waitForTimeout(600);
  await tikla(page, [30, 22, 0]);
  await page.click('#ribbon [data-cmd="sketch"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(30, 0); T.toolClick(34, 0); T.setTool(null); T.cmd('extrude'); T.pm.draft.depth = 6; T.commitPM(); });
  expect(await page.evaluate(() => __tz.model.box.max[1])).toBeCloseTo(31, 4);
  await egit(page, 10, 14);
  expect(await page.evaluate(() => __tz.model.box.max[1])).toBeCloseTo(35, 4);
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  expect(errors).toEqual([]);
});

test('teknik resim: genel ölçü çapsa Ø yazılır; gizli delik çapı üst görünüşte; kademe boyları radyus/pah geçişlerinden etkilenmez', async ({ page }) => {
  const errors = await openApp(page);
  await kapakDelikli(page);
  await page.click('#hud [data-hud="iso"]'); await page.waitForTimeout(600);
  // delik ağzına ve çıkıntının üst kenarına 1,5 pah, çıkıntının köküne R2
  await page.click('#ribbon [data-cmd="chamfer"]');
  await tikla(page, [20 * Math.cos(2.4), 22, 20 * Math.sin(2.4)]);
  await tikla(page, [40 * Math.cos(0.6), 22, 40 * Math.sin(0.6)]);
  await page.evaluate(() => { __tz.pm.draft.d = 1.5; __tz.commitPM(); });
  await page.click('#ribbon [data-cmd="fillet"]');
  await tikla(page, [40 * Math.cos(0.9), 12, 40 * Math.sin(0.9)]);
  await page.evaluate(() => { __tz.pm.draft.r = 2; __tz.commitPM(); });
  expect(await page.evaluate(() => __tz.state.features.map(f => f.type))).toEqual(['sketch', 'revolve', 'hole', 'cpattern', 'chamfer', 'fillet']);
  await openDrawing(page);
  const t = await metinler(page);
  // önceden: “120” ve ayrıca profilin içinde “Ø120”; delik Ø40 hiç yazılmıyordu; zincir 12 / 1,48 / 7,02 / 1,5 (yazılar üst üste)
  expect(t).toContain('Ø120');
  expect(t).not.toContain('120');
  expect(t.filter(x => x === 'Ø120').length).toBe(1); // bir kez (ISO 129-1): önceden ön ve yan görünüşte iki kez yazılıyordu
  for (const e of ['Ø80', 'Ø40', 'Ø100', '4× Ø9']) expect(t).toContain(e);
  const kb = await page.evaluate(() => { const v = __tz.getCtx(); return v.hits.filter(h => h.k && h.k.startsWith('kb:')).length; });
  expect(kb).toBe(2);
  // 12 + 10 = 22 genel yükseklik: kapalı zincirde göbek boyu yardımcı ölçüdür (ISO 129-1, altıncı tur)
  for (const e of ['12', '(10)', '22']) expect(t).toContain(e);
  expect(t).not.toContain('1,48');
  // Ø40 delik ön görünüşte gizli: üst görünüşteki dairesine kılavuzla yazılır
  const yer = await page.evaluate(() => { const c = __tz.getCtx(); const t = [...document.querySelectorAll('#sheet text')].find(t => t.textContent === 'Ø40'); const r = t.getBBox();
    const top = c.views.top, [x0, y0] = top.map(top.d.bb.minA, top.d.bb.maxB), [x1, y1] = top.map(top.d.bb.maxA, top.d.bb.minB);
    return { inTop: r.x > x0 - 25 && r.x + r.width < x1 + 25 && r.y > y0 - 25 && r.y + r.height < y1 + 25 }; });
  expect(yer).toEqual({ inTop: true });
  // kesitte delik görünür: Ø40 ön görünüşe (kesite) yazılır; kesit okunun A harfi delik etiketiyle çakışmaz
  await page.selectOption('#dSec', 'front'); await page.waitForTimeout(500);
  const ck = await page.evaluate(() => { const c = __tz.getCtx(); const lbl = c.hits.find(h => h.t === 'lbl');
    const A = [...document.querySelectorAll('#sheet text')].filter(t => t.textContent === 'A').map(t => { const r = t.getBBox(); return [r.x, r.y, r.x + r.width, r.y + r.height]; });
    const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    return { n: A.length, cakisma: A.some(a => ov(a, lbl.box) > 0) }; });
  expect(ck).toEqual({ n: 2, cakisma: false });
  expect(errors).toEqual([]);
});

test('teknik resim: dar kademelerin yazıları üst üste binmez; aynı çaplı iki kademe ayrı ölçülür', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL('../ornekler/kademeli-mil.tocad.json', import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
  await openDrawing(page);
  const r = await page.evaluate(() => { const hs = __tz.getCtx().hits.filter(h => h.t === 'auto');
    const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    let n = 0; for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) if (ov(hs[i].box, hs[j].box) > 0.05) n++;
    return { kb: hs.filter(h => h.k.startsWith('kb:')).length, cakisan: n }; });
  expect(r).toEqual({ kb: 8, cakisan: 0 });
  const t = await metinler(page);
  expect(t.filter(x => x === 'Ø40').length).toBe(2);
  expect(t).toContain('Ø50'); // genel yükseklik = yaka çapı
  // segman kanalı aracının gövdeye değmeyen dış kenarı (Ø42) silindir sayılmaz
  expect(t).not.toContain('Ø42');
  expect(errors).toEqual([]);
});

test('somun: döndürme kesmenin gövdeye değmeyen dış kenarı teknik resimde çap ve kademe üretmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('polygon'); T.toolClick(0, 0); T.toolClick(19 / Math.sqrt(3), 0); T.setTool(null); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 10; T.commitPM();
    T.startSketch({ kind: 'std', key: 'front' }); });
  // küçük pah üçgenleri: yakalama toleransı ekrandaki ölçeğe bağlı, önce çizime yakınlaşılır
  await page.waitForTimeout(600); await page.keyboard.press('f'); await page.waitForTimeout(700);
  await page.evaluate(() => { const T = __tz; T.sk.opts.grid = false; T.setTool('centerline'); T.toolClick(0, -2); T.toolClick(0, 12);
    const h = 2.5 * Math.tan(Math.PI / 6);
    T.setTool('line'); for (const p of [[9.5, 10], [12, 10], [12, 10 - h], [9.5, 10]]) T.toolClick(...p); T.setTool(null);
    T.setTool('line'); for (const p of [[9.5, 0], [12, 0], [12, h], [9.5, 0]]) T.toolClick(...p); T.setTool(null);
    T.exitSketch(true); T.cmd('revcut'); T.commitPM(); });
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  await openDrawing(page);
  const t = await metinler(page);
  expect(t).not.toContain('Ø24');
  expect(await page.evaluate(() => __tz.getCtx().hits.filter(h => h.k && h.k.startsWith('kb:')).length)).toBe(0);
  for (const e of ['10', '19']) expect(t).toContain(e);
  expect(errors).toEqual([]);
});

test('açık zincir Ekstrüzyonla ince özellik olur: “kapalı bölge yok” uyarısı çıkmaz', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { document.querySelector('[data-m="new"]').click(); const T = __tz;
    T.startSketch({ kind: 'std', key: 'front' }); T.sk.opts.grid = false; T.setTool('line'); T.toolClick(0, 0); T.toolClick(60, 0); T.toolClick(60, 40); T.setTool(null); });
  await page.click('#cmTabs [data-cm="features"]');
  await page.click('#ribbon [data-cmd="extrude"]');
  expect(await page.evaluate(() => __tz.pm.draft.thin)).toBe(true);
  expect(await page.evaluate(() => (document.querySelector('#toast.on') || {}).textContent || '')).not.toContain('Kapalı bölge yok');
  await page.evaluate(() => { __tz.pm.draft.thick = 3; __tz.pm.draft.depth = 50; __tz.commitPM(); });
  expect(await page.evaluate(() => Math.round(__tz.model.props.vol))).toBe((60 + 40 - 3) * 3 * 50);
  // aynı açık zincir Çizimden Çık ile bırakılırsa uyarı yine verilir
  await page.evaluate(() => { const T = __tz; T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('line'); T.toolClick(0, 0); T.toolClick(30, 0); T.toolClick(30, 20); T.setTool(null); T.exitSketch(true); });
  expect(await page.evaluate(() => (document.querySelector('#toast.on') || {}).textContent || '')).toContain('Kapalı bölge yok');
  expect(errors).toEqual([]);
});
