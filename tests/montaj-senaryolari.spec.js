// Farklı montajlar kurularak bulunan hatalar ve SolidWorks'e göre eklenen kolaylıklar
// (örnekler: ornekler/montajlar-ciz.mjs — flanşlı kaplin, menteşe, dişli çifti).
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

async function openSample(page, dosya) {
  await page.evaluate(() => { window.__eski = __tz.project; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => document.querySelector('[data-m="open"]').click())]);
  await fc.setFiles(new URL(`../ornekler/${dosya}.tocad.json`, import.meta.url).pathname);
  await page.waitForFunction(() => __tz.project !== window.__eski && __tz.model.polys.length);
}
const asmState = page => page.evaluate(() => { const a = __tz.curAsm(); return { comps: a.comps.length, mates: a.mates.length, unsolved: !!a._unsolved,
  under: Object.values(__tz.asmView.dof).filter(v => v === '-').length, bad: document.querySelectorAll('#tree .ti.err').length }; });
/** bileşenin yerel noktasının ekran konumu; bakış yönü bileşenin kendi koordinatlarında */
const compScreen = (page, cid, p, dir) => page.evaluate(([cid, p, dir]) => {
  const c = __tz.curAsm().comps.find(x => x.id === cid), M = c.T;
  if (dir) __tz.fitCamera([0, 1, 2].map(i => M[i] * dir[0] + M[4 + i] * dir[1] + M[8 + i] * dir[2]), false);
  return __tz.scrW([0, 1, 2].map(i => M[i] * p[0] + M[4 + i] * p[1] + M[8 + i] * p[2] + M[12 + i]));
}, [cid, p, dir]);
/** yeni montaj ve parça adına göre bileşenler */
async function newAsmWith(page, names) {
  await page.click('[data-tab="asm"]');
  await page.click('[data-aa="new"]');
  await page.keyboard.press('Escape');
  return page.evaluate(names => names.map(n => { __tz.addComp(__tz.project.parts.find(p => p.partName === n).id); const a = __tz.curAsm(); __tz.asmUI.sel = null; return a.comps[a.comps.length - 1].id; }), names);
}
/** eşleştirme panelinde bileşenin yerel noktasındaki silindir ('a') veya düz yüzey (normal) seçimi */
const pickRef = (page, slot, cid, p, k) => page.evaluate(([slot, cid, p, k]) => {
  const v = __tz.asmView.groups.get(cid);
  let s = null;
  if (k === 'a') { for (const an of v.d.ann) { const w = { x: p[0] - an.C.x, y: p[1] - an.C.y, z: p[2] - an.C.z }; const t = w.x * an.A.x + w.y * an.A.y + w.z * an.A.z;
    if (Math.abs(Math.hypot(w.x - an.A.x * t, w.y - an.A.y * t, w.z - an.A.z * t) - an.r) < 0.05 && t >= an.t0 - 0.2 && t <= an.t1 + 0.2) { s = { comp: cid, ref: { t: 'axis', p: [an.C.x, an.C.y, an.C.z], d: [an.A.x, an.A.y, an.A.z], r: an.r, t0: an.t0, t1: an.t1 } }; break; } } }
  else { const w = k[0] * p[0] + k[1] * p[1] + k[2] * p[2]; s = { comp: cid, ref: { t: 'plane', n: k, p: k.map(x => x * w) } }; }
  __tz.asmUI.pm.draft[slot] = s;
}, [slot, cid, p, k]);

for (const [dosya, adet] of [['flansli-kaplin', { 'Cıvata M10x50': 4, 'Somun M10': 4, 'Mil Ø25': 2 }], ['mentese', { 'Menteşe kanadı': 2 }], ['disli-cifti', { 'Düz dişli m2 z24': 2, 'Dişli mili Ø25': 2 }]]) {
  test(`örnek: ${dosya} çözülür, tam tanımlı, girişimsiz; montaj resminde parça listesi adetleri`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors = await openApp(page);
    await openSample(page, dosya);
    await page.click('[data-tab="asm"]');
    const s = await asmState(page);
    expect(s.unsolved).toBe(false);
    expect(s.under).toBe(0);
    expect(s.bad).toBe(0);
    await page.click('[data-cmd="ainterf"]');
    await page.waitForFunction(() => __tz.asmUI.pm && __tz.asmUI.pm.done, null, { timeout: 200_000 });
    expect(await page.evaluate(() => __tz.asmUI.pm.results.filter(r => !r.contact).length)).toBe(0);
    await page.keyboard.press('Escape');
    await page.click('[data-cmd="adraw"]');
    await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
    const bom = await page.evaluate(() => { const t = [...document.querySelectorAll('#sheet text')].map(x => x.textContent); const o = {};
      t.forEach((x, i) => { if (/^\d+$/.test(t[i + 1] || '') && /^(Çelik|Dökme|Alüminyum|Paslanmaz)/.test(t[i + 2] || '')) o[x] = +t[i + 1]; }); return o; });
    for (const [k, n] of Object.entries(adet)) expect(bom[k]).toBe(n);
    expect(errors).toEqual([]);
  });
}

test('yüz yüze çakışık: aynı yönde duran iki göbekte “Hizalamayı ters çevir” bileşeni yarım tur döndürür; panel sonraki eşleştirme için açık kalır', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  const [g1, g2] = await newAsmWith(page, ['Kaplin göbeği A', 'Kaplin göbeği A']);
  await page.click('[data-cmd="amate"]');
  await page.waitForTimeout(200);
  // fareyle: iki göbeğin flanş ön yüzü (alttan bakarak)
  for (const g of [g1, g2]) { const [x, y] = await compScreen(page, g, [55, 0, 0], [1, -1, 1]); await page.waitForTimeout(50); await page.mouse.click(x, y); }
  expect(await page.evaluate(() => { const d = __tz.asmUI.pm.draft; return [d.a && d.a.ref.t, d.b && d.b.ref.t, d.type]; })).toEqual(['plane', 'plane', 'coincident']);
  // yüzler aynı yöne bakıyor: önce aynı hizada; ters çevirince yarım tur döner (önceden “sağlanamıyor” hatası veriyordu)
  await page.click('[data-mflip]');
  const r = await page.evaluate(id => ({ err: __tz.asmUI.pm.err, yy: +__tz.curAsm().comps.find(c => c.id === id).T[5].toFixed(6) }), g2);
  expect(r).toEqual({ err: '', yy: -1 });
  await page.keyboard.press('Enter');
  // SolidWorks gibi: panel açık kalır, seçimler boşalır, eklenen eşleştirme yazılır
  expect(await page.evaluate(() => ({ pm: __tz.asmUI.pm && __tz.asmUI.pm.type, a: __tz.asmUI.pm.draft.a, n: __tz.curAsm().mates.length }))).toEqual({ pm: 'mate', a: null, n: 1 });
  await expect(page.locator('#pm .pm-ok')).toContainText('Çakışık1');
  // ikinci eşleştirme aynı panelde: eksenler eşmerkezli
  await pickRef(page, 'a', g1, [0, 40, 30], 'a'); await pickRef(page, 'b', g2, [0, 40, 30], 'a');
  await page.evaluate(() => __tz.setMateType('concentric'));
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => __tz.curAsm().mates.map(m => m.name))).toEqual(['Çakışık1', 'Eşmerkezli1']);
  // seçimsiz panelde Esc kapatır; her eşleştirme ayrı geri alma adımıdır
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => __tz.asmUI.pm)).toBe(null);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => __tz.curAsm().mates.map(m => m.name))).toEqual(['Çakışık1']);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(id => ({ n: __tz.curAsm().mates.length, yy: __tz.curAsm().comps.find(c => c.id === id).T[5] }), g2)).toEqual({ n: 0, yy: 1 });
  expect(errors).toEqual([]);
});

test('eşmerkezli “Dönmeyi kilitle” bileşeni tam tanımlar; eksenler arası ve eksen–düzlem mesafesi; mesafede hizalama', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  const [g, b] = await newAsmWith(page, ['Kaplin göbeği A', 'Cıvata M10x50']);
  await page.click('[data-cmd="amate"]');
  await pickRef(page, 'a', b, [5, -20, 0], 'a'); await pickRef(page, 'b', g, [50.5, 7, 0], 'a');
  await page.evaluate(() => __tz.setMateType('concentric'));
  await page.keyboard.press('Enter');
  await pickRef(page, 'a', b, [7, 0, 0], [0, -1, 0]); await pickRef(page, 'b', g, [35, 15, 35], [0, 1, 0]);
  await page.evaluate(() => __tz.setMateType('coincident'));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(id => __tz.asmView.dof[id], b)).toBe('-'); // eksen etrafında dönebilir
  // eşmerkezliyi düzenle: dönmeyi kilitle
  await page.click('.ti:has-text("Eşmerkezli1")');
  await page.check('#pm [data-mlock]');
  await page.click('#pm [data-apm="ok"]');
  expect(await page.evaluate(id => ({ dof: __tz.asmView.dof[id], lock: __tz.curAsm().mates[0].lock }), b)).toEqual({ dof: 'ok', lock: true });

  // eksenler arası mesafe: iki dişli, ön yüzler çakışık, delik eksenleri 48 mm
  await openSample(page, 'disli-cifti');
  const [d1, d2] = await newAsmWith(page, ['Düz dişli m2 z24', 'Düz dişli m2 z24']);
  await page.click('[data-cmd="amate"]');
  await pickRef(page, 'a', d1, [0, 30, 0], [0, 0, -1]); await pickRef(page, 'b', d2, [0, 30, 0], [0, 0, -1]);
  await page.evaluate(() => __tz.setMateType('coincident')); await page.keyboard.press('Enter');
  await pickRef(page, 'a', d1, [12.5, 0, 10], 'a'); await pickRef(page, 'b', d2, [12.5, 0, 10], 'a');
  expect(await page.evaluate(() => { __tz.setMateType('distance'); return [...document.querySelectorAll('#pm [data-mtype]')].map(b => b.dataset.mtype); })).toContain('distance');
  await page.fill('#pm input[data-k="val"]', '48'); await page.waitForTimeout(350);
  await page.keyboard.press('Enter');
  const dist = await page.evaluate(([a, b]) => { const A = __tz.curAsm().comps.find(c => c.id === a).T, B = __tz.curAsm().comps.find(c => c.id === b).T; return Math.hypot(A[12] - B[12], A[13] - B[13], A[14] - B[14]); }, [d1, d2]);
  expect(dist).toBeCloseTo(48, 3);
  // eksen–düzlem: ikinci dişlinin ekseni tabanın sağ yan yüzünden 30 mm
  const [tb, d3] = await page.evaluate(() => { const a = __tz.curAsm(); __tz.addComp(__tz.project.parts.find(p => p.partName === 'Dişli tabanı').id); const t = a.comps[a.comps.length - 1].id; return [t, a.comps[1].id]; });
  await page.evaluate(() => { if (!__tz.asmUI.pm) __tz.openMatePM(null); });
  await pickRef(page, 'a', tb, [94, 0, -5], [1, 0, 0]); await pickRef(page, 'b', d3, [12.5, 0, 10], 'a');
  await page.evaluate(() => { __tz.setMateType('distance'); __tz.asmUI.pm.draft.val = 30; __tz.previewMate(); });
  expect(await page.evaluate(() => __tz.asmUI.pm.err)).toBe('');
  await page.keyboard.press('Enter');
  // tabanın yan yüzü (dünya): normal R·(1,0,0), nokta T·(94,0,0); dişli ekseni yerel orijinden geçer
  const off = await page.evaluate(([tb, d]) => { const a = __tz.curAsm(); const T = a.comps.find(c => c.id === tb).T, D = a.comps.find(c => c.id === d).T;
    const n = [T[0], T[1], T[2]], p = [T[12] + 94 * T[0], T[13] + 94 * T[1], T[14] + 94 * T[2]]; return (D[12] - p[0]) * n[0] + (D[13] - p[1]) * n[1] + (D[14] - p[2]) * n[2]; }, [tb, d3]);
  expect(Math.abs(off)).toBeCloseTo(30, 3);

  // mesafede hizalama: mil ucu göbek yüzüne 1 mm; hizalamayı ters çevirmek mili döndürür (önceden yalnızca paralellik isteniyordu)
  await openSample(page, 'flansli-kaplin');
  const [h, m] = await newAsmWith(page, ['Kaplin göbeği A', 'Mil Ø25']);
  await page.click('[data-cmd="amate"]');
  await pickRef(page, 'a', m, [0, 0, 5], [0, -1, 0]); await pickRef(page, 'b', h, [55, 0, 0], [0, -1, 0]);
  await page.evaluate(() => __tz.setMateType('distance'));
  await expect(page.locator('#pm [data-malign]')).toContainText('aynı yön');
  const y0 = await page.evaluate(id => __tz.curAsm().comps.find(c => c.id === id).T[5], m);
  await page.click('#pm [data-malign]');
  await expect(page.locator('#pm [data-malign]')).toContainText('karşılıklı');
  const y1 = await page.evaluate(id => __tz.curAsm().comps.find(c => c.id === id).T[5], m);
  expect([+y0.toFixed(6), +y1.toFixed(6)]).toEqual([1, -1]);
  expect(errors).toEqual([]);
});

test('girişim: aynı çaplı mil–delik temas sayılır; üst üste binen miller girişimdir', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  // göbek ve iki mil: mil biraz döndürülmüş eklenir (çokgen yüzleri göbeğin deliğiyle çakışmaz; kesişim ince ve yönü tutarsız bir kabuk olur)
  const [g, m1, m2] = await newAsmWith(page, ['Kaplin göbeği A', 'Mil Ø25', 'Mil Ø25']);
  await page.evaluate(([m1, m2]) => { const a = __tz.curAsm(), c = Math.cos(0.05), s = Math.sin(0.05);
    for (const id of [m1, m2]) a.comps.find(x => x.id === id).T = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 150, 5, 0, 1]; }, [m1, m2]);
  await page.click('[data-cmd="amate"]');
  for (const m of [m1, m2]) {
    await pickRef(page, 'a', m, [0, 50, 12.5], 'a'); await pickRef(page, 'b', g, [0, 40, 30], 'a');
    await page.evaluate(() => __tz.setMateType('concentric')); await page.keyboard.press('Enter');
    await pickRef(page, 'a', m, [0, 0, 5], [0, -1, 0]); await pickRef(page, 'b', g, [55, 0, 0], [0, -1, 0]);
    await page.evaluate(() => __tz.setMateType('coincident')); await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.click('[data-cmd="ainterf"]');
  await page.waitForFunction(() => __tz.asmUI.pm && __tz.asmUI.pm.done, null, { timeout: 200_000 });
  const r = await page.evaluate(() => { const a = __tz.curAsm(), P = __tz.asmUI.pm; const nm = id => __tz.project.parts.find(p => p.id === a.comps.find(c => c.id === id).part).partName;
    return { hit: P.results.filter(x => !x.contact).map(x => [nm(x.a), nm(x.b)].sort().join(' + ')), contact: P.results.filter(x => x.contact).map(x => [nm(x.a), nm(x.b)].sort().join(' + ')) }; });
  // iki mil aynı yerde: gerçek girişim. Göbek ile mil (aynı Ø25) önceden 1800 mm³ dolayında “girişim” sayılıyordu
  expect(r.hit).toEqual(['Mil Ø25 + Mil Ø25']);
  expect(r.contact).toEqual(['Kaplin göbeği A + Mil Ø25', 'Kaplin göbeği A + Mil Ø25']);
  expect(errors).toEqual([]);
});

test('otomatik patlatma zincirli: somun kaydığı flanştan, mil göbeğinden ayrılır; çoğaltılmış kopyalar kaynakla birlikte', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="atoggle"]');
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const a = __tz.curAsm(); const nm = c => __tz.project.parts.find(p => p.id === c.part).partName;
    const y = c => __tz.asmView.groups.get(c.id).g.matrix.elements[13];
    const by = n => a.comps.filter(c => nm(c) === n);
    return { gB: y(by('Kaplin göbeği B')[0]), nuts: by('Somun M10').map(y), shafts: by('Mil Ø25').map(y), bolts: by('Cıvata M10x50').map(y) };
  });
  // B göbeği aşağı kayar; somunlar ondan da aşağı (önceden B ile aynı mesafede kalıp flanşın altında görünmüyordu)
  for (const n of r.nuts) expect(n).toBeLessThan(r.gB - 30);
  expect(Math.min(...r.shafts)).toBeLessThan(r.gB - 30);
  // dört cıvata (bir kaynak, üç kopya) aynı yükseklikte yukarı
  expect(new Set(r.bolts.map(v => v.toFixed(3))).size).toBe(1);
  expect(r.bolts[0]).toBeGreaterThan(15 + 30);
  expect(errors).toEqual([]);
});

test('bileşen çoğaltma: göbek eksenine tıkla, cıvata ve somunu seç, 4 adet; sil, geri al, kaydet-aç', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  // örnekteki çoğaltmayı sil: kopyalar da gider
  await page.evaluate(() => document.querySelector('.ti[data-apat] [data-pa2="del"]').click());
  expect(await asmState(page)).toMatchObject({ comps: 6, unsolved: false, under: 0 });
  const ids = await page.evaluate(() => { const a = __tz.curAsm(); const id = n => a.comps.find(c => __tz.project.parts.find(p => p.id === c.part).partName === n).id; return { g: id('Kaplin göbeği A'), b: id('Cıvata M10x50'), s: id('Somun M10') }; });
  // yeniden, fareyle
  await page.click('[data-cmd="acpat"]');
  await page.waitForTimeout(200);
  await expect(page.locator('#vpPrompt')).toContainText('silindirik');
  let [x, y] = await compScreen(page, ids.g, [0, 40, 30], [1, 0.5, 1]); await page.waitForTimeout(50); await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.asmUI.pm.draft.ref && __tz.asmUI.pm.draft.ref.ref.r)).toBe(30);
  [x, y] = await compScreen(page, ids.b, [0, 3, 8], [0.3, 1, 1]); await page.waitForTimeout(50); await page.mouse.click(x, y);
  [x, y] = await compScreen(page, ids.s, [0, 4, 8], [0.3, -0.5, 1]); await page.waitForTimeout(50); await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.asmUI.pm.draft.seeds.length)).toBe(2);
  await page.fill('#pm input[data-k="n"]', '4');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  expect(await asmState(page)).toMatchObject({ comps: 12, unsolved: false, under: 0, bad: 0 });
  // kopyalar delik eksenlerinde (PCD 90)
  const pos = await page.evaluate(() => __tz.curAsm().comps.filter(c => c.pat).map(c => +Math.hypot(c.T[12], c.T[14]).toFixed(3)));
  expect(pos).toEqual([45, 45, 45, 45, 45, 45]);
  // kopya ayrıca silinemez ve eşleştirilemez
  expect(await page.evaluate(() => { const id = __tz.curAsm().comps.find(c => c.pat).id; return !!document.querySelector(`[data-comp="${id}"] [data-ca="del"]`); })).toBe(false);
  // geri al / yinele
  await page.keyboard.press('Control+z');
  expect((await asmState(page)).comps).toBe(6);
  await page.keyboard.press('Control+y');
  expect((await asmState(page)).comps).toBe(12);
  // sayfa yenilenince çoğaltma ve kopyalar korunur
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.__tz && window.__tz.model);
  await page.click('[data-tab="asm"]');
  expect(await asmState(page)).toMatchObject({ comps: 12, unsolved: false, under: 0 });
  expect(await page.evaluate(() => __tz.curAsm().pats.length)).toBe(1);
  expect(errors).toEqual([]);
});

test('Alt + tıklama öndeki bileşenin arkasındakini seçer; panel açıkken gizleme ve iptal geçmişi bozmaz; mesafe yazarken odak kaybolmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  const ids = await page.evaluate(() => { const a = __tz.curAsm(); const id = n => a.comps.find(c => !c.pat && __tz.project.parts.find(p => p.id === c.part).partName === n).id; return { g: id('Kaplin göbeği A'), b: id('Cıvata M10x50') }; });
  await page.click('[data-cmd="amate"]');
  await page.waitForTimeout(200);
  // flanşın dış yüzü cıvatanın önünde: yandan bakınca önce göbek, Alt ile cıvata seçilir
  const [x, y] = await compScreen(page, ids.b, [5, -8, 0], [1, 0, 0]);
  const plain = await page.evaluate(([x, y]) => __tz.asmPick({ clientX: x, clientY: y }).comp, [x, y]);
  expect(plain).toBe(ids.g);
  await page.keyboard.down('Alt'); await page.mouse.click(x, y); await page.keyboard.up('Alt');
  expect(await page.evaluate(() => __tz.asmUI.pm.draft.a.comp)).toBe(ids.b);
  // panel açıkken bir bileşeni gizle, sonra paneli iptal et: gizleme kendi adımı olarak geri alınır, eşleştirmeler değişmez
  const n0 = await page.evaluate(() => __tz.curAsm().mates.length);
  await page.evaluate(id => document.querySelector(`[data-comp="${id}"] [data-ca="hide"]`).click(), ids.g);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => __tz.asmUI.pm)).toBe(null);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(([id, n0]) => ({ hidden: !!__tz.curAsm().comps.find(c => c.id === id).hidden, n: __tz.curAsm().mates.length === n0 }), [ids.g, n0])).toEqual({ hidden: false, n: true });
  // mesafe alanına yavaş yazmak: önizleme paneli yeniden çizse de ikinci rakam kaybolmaz
  await page.click('.ti:has-text("Mesafe1")');
  const inp = page.locator('#pm input[data-k="val"]');
  await inp.fill('');
  await inp.type('1'); await page.waitForTimeout(450); await inp.type('2'); await page.waitForTimeout(450);
  expect(await inp.inputValue()).toBe('12');
  expect(await page.evaluate(() => __tz.asmUI.pm.draft.val)).toBe(12);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('parça: dairesel çoğaltma ekseni göbeğe tıklanarak, doğrusal çoğaltma yönü kenara tıklanarak, referans düzlem yüzeyden', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  // 160 × 100 × 12 plaka, (40, 0) merkezli Ø60 × 20 göbek
  const ids = await page.evaluate(async () => {
    const T = __tz;
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('crect'); T.toolClick(0, 0); T.toolClick(80, 50); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 12; const plate = T.pm.draft.id; T.commitPM();
    T.startSketch({ kind: 'face', feat: plate, which: 'far', sgn: 1 }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(40, 0); T.toolClick(70, 0); T.exitSketch(true);
    T.cmd('extrude'); T.pm.draft.depth = 20; const boss = T.pm.draft.id; T.commitPM();
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(62.5, 0); T.toolClick(64, 0); T.exitSketch(true);
    T.cmd('cut'); T.pm.draft.end = 'through'; T.pm.draft.dir2 = true; T.pm.draft.end2 = 'through'; const hole = T.pm.draft.id; T.commitPM();
    T.startSketch({ kind: 'std', key: 'top' }); T.sk.opts.grid = false; T.setTool('circle'); T.toolClick(-70, 40); T.toolClick(-65.5, 40); T.exitSketch(true);
    T.cmd('cut'); T.pm.draft.end = 'through'; T.pm.draft.dir2 = true; T.pm.draft.end2 = 'through'; const corner = T.pm.draft.id; T.commitPM();
    return { boss, hole, corner };
  });
  // dairesel çoğaltma: göbeğin silindirik yüzüne tıkla
  await page.evaluate(id => __tz.openPM('cpattern', null, { type: 'cpattern', id: 'cp1', name: 'DaireselÇoğaltma1', targets: [id], axis: 'y', n: 6, angle: 360 }), ids.hole);
  await page.evaluate(() => __tz.fitCamera([1, 0.4, 1], false)); await page.waitForTimeout(150);
  let [x, y] = await page.evaluate(() => __tz.scrW([40 + 30 * Math.SQRT1_2, 25, 30 * Math.SQRT1_2]));
  await page.mouse.click(x, y);
  expect(await page.evaluate(() => { const a = __tz.pm.draft.axis; return [a.p, a.d, a.r]; })).toEqual([[40, 12, 0], [0, 1, 0], 30]);
  await expect(page.locator('#pm select[data-k="axis"]')).toHaveValue('__sel');
  await page.evaluate(() => __tz.commitPM());
  const holes = () => page.evaluate(() => __tz.model.ann.filter(a => Math.abs(a.r - 1.5) < 1e-6).map(a => [Math.round(a.C.x * 100) / 100, Math.round(a.C.z * 100) / 100]).sort((p, q) => p[0] - q[0] || p[1] - q[1]));
  const h = await holes();
  expect(h.length).toBe(6);
  for (const [px, pz] of h) expect(Math.hypot(px - 40, pz)).toBeCloseTo(22.5, 2);
  // doğrusal çoğaltma: Yön 1 plakanın uzun kenarı, Yön 2 (Kenar seç) kısa kenar, ters
  await page.evaluate(id => __tz.openPM('lpattern', null, { type: 'lpattern', id: 'lp1', name: 'DoğrusalÇoğaltma1', targets: [id], dir1: 'x', sp1: 140, n1: 2, dir2: 'none', sp2: 80, n2: 2 }), ids.corner);
  await page.evaluate(() => __tz.fitCamera([0.3, 1, 0.6], false)); await page.waitForTimeout(150);
  [x, y] = await page.evaluate(() => __tz.scrW([0, 12, 50])); await page.mouse.click(x, y);
  await page.click('[data-dslot="2"]');
  [x, y] = await page.evaluate(() => __tz.scrW([80, 12, 0])); await page.mouse.click(x, y);
  expect(await page.evaluate(() => [__tz.pm.draft.dir1, __tz.pm.draft.dir2])).toEqual([{ d: [1, 0, 0] }, { d: [0, 0, 1] }]);
  // ⇄ Ters kenar yönünü çevirir
  await page.click('[data-drev="dir2"]');
  expect(await page.evaluate(() => __tz.pm.draft.dir2.d[2])).toBe(-1);
  await page.click('[data-drev="dir2"]');
  await page.evaluate(() => { __tz.pm.draft.sp2 = 80; __tz.commitPM(); });
  expect(await page.evaluate(() => __tz.model.ann.filter(a => Math.abs(a.r - 4.5) < 1e-6).length)).toBe(4);
  // referans düzlem: göbeğin üst yüzüne tıkla, 10 mm ofset
  await page.evaluate(() => __tz.cmd('plane'));
  await page.evaluate(() => __tz.fitCamera([1, 1, 1], false)); await page.waitForTimeout(150);
  [x, y] = await page.evaluate(() => __tz.scrW([62, 32, -5])); await page.mouse.click(x, y);
  expect(await page.evaluate(() => __tz.pm.draft.base.kind)).toBe('face');
  const plId = await page.evaluate(() => { __tz.pm.draft.offset = 10; const id = __tz.pm.draft.id; __tz.commitPM(); return id; });
  expect(await page.evaluate(id => __tz.model.frames[id].o[1], plId)).toBeCloseTo(42, 6);
  // göbek 20 → 30 yüksekliğe: düzlem de taşınır
  await page.evaluate(id => { const f = __tz.state.features.find(f => f.id === id); __tz.openPM('extrude', f); __tz.pm.draft.depth = 30; __tz.commitPM(); }, ids.boss);
  expect(await page.evaluate(id => __tz.model.frames[id].o[1], plId)).toBeCloseTo(52, 6);
  expect(await page.evaluate(() => __tz.model.errors)).toEqual({});
  expect(errors).toEqual([]);
});

test('montaj resmi: parça listesi görünüşleri gereksiz küçültmez; balonlar ölçülere binmez, sürüklenir, Delete ile gizlenir', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="adraw"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const c = __tz.getCtx(); const bal = c.hits.filter(h => h.t === 'bal'), dims = c.hits.filter(h => h.t === 'auto');
    const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    return { scale: c.scale, n: bal.length, over: bal.filter(b => dims.some(d => ov(b.box, d.box))).length };
  });
  expect(r.scale).toBe(0.5); // önceden 1:5 (liste tüm sayfa genişliğinden düşülüyordu)
  expect(r.n).toBe(5);
  expect(r.over).toBe(0);
  // balonu fareyle sürükle
  const c = await page.evaluate(() => { const h = __tz.getCtx().hits.find(x => x.t === 'bal' && x.k === '3'); const m = document.querySelector('#sheet').getScreenCTM();
    const x = (h.box[0] + h.box[2]) / 2, y = (h.box[1] + h.box[3]) / 2; return [m.a * x + m.e, m.d * y + m.f, m.a]; });
  await page.mouse.move(c[0], c[1]); await page.mouse.down();
  await page.mouse.move(c[0] + 30, c[1] - 20, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => __tz.dwS().bal['3']);
  expect(b[0]).toBeCloseTo(30 / c[2], 1); expect(b[1]).toBeCloseTo(-20 / c[2], 1);
  // seç ve Delete: balon gizlenir, geri al getirir
  await page.mouse.click(c[0] + 30, c[1] - 20);
  expect(await page.evaluate(() => __tz.dwSel && __tz.dwSel.t)).toBe('bal');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => __tz.getCtx().hits.filter(h => h.t === 'bal').length === 4);
  expect(await page.evaluate(() => __tz.dwS().hide)).toContain('B:3');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => __tz.getCtx().hits.filter(h => h.t === 'bal').length === 5);
  expect(errors).toEqual([]);
});

test('montaj kesiti: bitişik parçalar farklı taranır; cıvata, somun ve mil kesilmeden bütün çizilir', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="adraw"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.selectOption('#dSec', 'front');
  await page.waitForFunction(() => __tz.getCtx().views.front && __tz.getCtx().views.front.d.secPolys.length > 0);
  const groups = () => page.evaluate(() => { const sp = __tz.getCtx().views.front.d.secPolys, a = __tz.curAsm(); const st = __tz.hatchStyles(sp);
    const nm = g => { const c = a.comps.find(c => 'SEC:' + c.id === g); return __tz.project.parts.find(p => p.id === c.part).partName; };
    const o = {}; for (const [g, s] of st) (o[nm(g)] = o[nm(g)] || []).push(s); return o; });
  let g = await groups();
  // iki göbek yüz yüze değer: farklı tarama (önceden kimlik sırasına göre aynı açıyı alabiliyordu)
  expect(g['Kaplin göbeği A'][0]).not.toBe(g['Kaplin göbeği B'][0]);
  expect(Object.keys(g).sort()).toEqual(['Cıvata M10x50', 'Kaplin göbeği A', 'Kaplin göbeği B', 'Mil Ø25', 'Somun M10']);
  for (const ad of ['Cıvata M10x50', 'Somun M10', 'Mil Ø25']) {
    const id = await page.evaluate(ad => __tz.project.parts.find(p => p.partName === ad).id, ad);
    await page.check(`[data-secskip="${id}"]`);
  }
  await page.waitForFunction(() => (__tz.dwS().secSkip || []).length === 3 && new Set(__tz.getCtx().views.front.d.secPolys.map(q => q.g)).size === 2);
  g = await groups();
  expect(Object.keys(g).sort()).toEqual(['Kaplin göbeği A', 'Kaplin göbeği B']);
  // geri al: kesilmeyecek parça seçimi resim geçmişindedir
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => (__tz.dwS().secSkip || []).length === 2);
  expect(errors).toEqual([]);
});

test('panel açıkken başka montaja geçmek: çoğaltma önizlemesi ve geçmiş kendi montajında kalır', async ({ page }) => {
  const errors = await openApp(page);
  await openSample(page, 'flansli-kaplin');
  // ikinci montaj: tek göbek
  const second = await newAsmWith(page, ['Kaplin göbeği A']);
  const ids = await page.evaluate(() => __tz.project.asms.map(a => a.id));
  // birinci montaja dön, çoğaltmayı düzenle (adet 6: önizleme kopya ekler), panel açıkken ikinciye geç
  await page.selectOption('#asmSel', ids[0]);
  await page.evaluate(() => document.querySelector('.ti[data-apat]').click());
  await page.fill('#pm input[data-k="n"]', '6'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => __tz.curAsm().comps.length)).toBe(16);
  await page.selectOption('#asmSel', ids[1]);
  const r = await page.evaluate(ids => ({ first: __tz.project.asms.find(a => a.id === ids[0]).comps.length, second: __tz.project.asms.find(a => a.id === ids[1]).comps.map(c => c.id), pm: __tz.asmUI.pm }), ids);
  expect(r).toEqual({ first: 12, second, pm: null });
  // ikinci montajın geri alma geçmişi bozulmadı: geri al bileşen eklemeyi geri alır
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => __tz.curAsm().comps.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('düğmesiz bildirim altındaki modele yapılan tıklamayı engellemez; “Geri al” düğmeli bildirim tıklanır', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="asm"]');
  await page.evaluate(() => __tz.addComp(__tz.project.parts[2].id)); // “… eklendi.”
  await expect(page.locator('#toast')).toHaveClass(/on/);
  const hit = async () => { const b = await page.locator('#toast').boundingBox(); return page.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, [b.x + b.width / 2, b.y + b.height / 2]); };
  expect(await hit()).toBe('CANVAS');
  // bileşen sil: “Geri al” düğmeli bildirim
  await page.evaluate(() => { const a = __tz.curAsm(); document.querySelector(`[data-comp="${a.comps[a.comps.length - 1].id}"] [data-ca="del"]`).click(); });
  await expect(page.locator('#toast button')).toBeVisible();
  expect(await hit()).not.toBe('CANVAS');
  await page.click('#toast button');
  expect(await page.evaluate(() => __tz.curAsm().comps.length)).toBe(7);
  expect(errors).toEqual([]);
});
