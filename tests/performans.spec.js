// Performans: CSG parçalanmasının giderilmesi, yeniden hesaplama önbelleği ve Ayarlar penceresi.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './helpers.js';

const MIL = readFileSync(new URL('../ornekler/kademeli-mil.tocad.json', import.meta.url), 'utf8');
const openJson = (page, o) => page.evaluate(async o => {
  const inp = document.querySelector('#fileInput'); document.querySelector('[data-m="open"]').click();
  const dt = new DataTransfer(); dt.items.add(new File([o], 'p.tocad.json'));
  inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 300));
}, o);

test('radyuslu kademeli mil: çokgenler parçalanmaz, hepsi dışbükey; önbellekli ve önbelleksiz sonuç aynı', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(feats => {
    const T = __tz, C = T.RB_CACHE;
    const conv = p => { const v = p.verts, n = p.plane.n, m = v.length; let tot = 0;
      for (let i = 0; i < m; i++) { const a = v[(i + m - 1) % m], b = v[i], c = v[(i + 1) % m]; const e = b.minus(a), f = c.minus(b);
        const t = Math.atan2(e.cross(f).dot(n), e.dot(f)); if (t < -1e-6) return false; tot += t } return Math.abs(tot - 2 * Math.PI) < 1e-4 };
    const sig = m => { let v = 0, A = 0; for (const p of m.polys) { const q = p.verts; for (let i = 1; i < q.length - 1; i++) { v += q[0].dot(q[i].cross(q[i + 1])); A += q[i].minus(q[0]).cross(q[i + 1].minus(q[0])).len() } } return [Math.round(v / 6), Math.round(A / 2)] };
    const on = C.on; C.on = false; const a = T.rebuildModel(feats); C.on = on;
    const b = T.rebuildModel(feats); const h0 = C.hits; const c = T.rebuildModel(feats);
    return { n: a.polys.length, convex: a.polys.every(conv), errs: Object.keys(a.errors).length, sa: sig(a), sb: sig(b), sc: sig(c), hit: C.hits > h0, same: c.polys === b.polys };
  }, JSON.parse(MIL).parts[0].features);
  // önceden ~23 000 çokgen (her radyus/delik gövdeyi BSP düzlemleriyle parçalıyordu)
  expect(r.n).toBeLessThan(6000);
  expect(r.convex).toBe(true);
  expect(r.errs).toBe(0);
  expect(r.sb).toEqual(r.sa); expect(r.sc).toEqual(r.sa);
  expect(r.hit).toBe(true); expect(r.same).toBe(true);
  expect(errors).toEqual([]);
});

test('önbellek: son özellik değişince yalnızca o yeniden hesaplanır; çizimden değiştirmeden çıkmak hesap yaptırmaz', async ({ page }) => {
  const errors = await openApp(page);
  await openJson(page, MIL);
  const r = await page.evaluate(() => {
    const T = __tz, C = T.RB_CACHE, F = T.state.features;
    const v0 = T.model.version;
    // çizime girerken onu kullanan özellik bastırılarak hesaplanır (bu ağaç önbellekte yoktur); çıkışta asıl ağaç önbellekten gelir
    const s = F.filter(f => f.type === 'sketch').pop(); T.editSketch(s.id); const m0 = C.misses; T.exitSketch(true);
    const m1 = C.misses;
    // ara bir özelliği değiştir, sonra geri al: geri alınan durum önbellekten gelir
    const ex = F.find(f => f.type === 'revolve' || f.type === 'extrude'); T.openPM(ex.type, ex); T.commitPM();
    document.querySelector('#undoBtn').click(); const m2 = C.misses;
    return { v: T.model.version > v0, exitMiss: m1 - m0, undoMiss: m2 - m1, err: Object.keys(T.model.errors).length };
  });
  expect(r.v).toBe(true);
  expect(r.exitMiss).toBe(0);
  expect(r.undoMiss).toBe(0);
  expect(r.err).toBe(0);
  expect(errors).toEqual([]);
});

test('Ayarlar: profil seçimi uygulanır, eğri çözünürlüğü değişince radyus kenarları bulunur, ayarlar yenilemede korunur', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await openJson(page, MIL);
  const before = await page.evaluate(() => ({ n: __tz.model.polys.length, vol: __tz.model.props.vol, seg: __tz.SETTINGS.curveSeg, prof: __tz.SETTINGS.profile }));
  expect(before.seg).toBe(64); expect(before.prof).toBe('balanced');
  await page.click('#setBtn');
  await expect(page.locator('#setDlg')).toHaveClass(/on/);
  await expect(page.locator('#setBody')).toContainText('Performans bilgisi');
  await page.click('#setBody [data-prof="fast"]');
  const fast = await page.evaluate(() => ({ n: __tz.model.polys.length, seg: __tz.SETTINGS.curveSeg, err: Object.keys(__tz.model.errors), pr: __tz.SETTINGS.pixelRatio }));
  expect(fast.seg).toBe(32); expect(fast.pr).toBe(1);
  expect(fast.err).toEqual([]);
  expect(fast.n).toBeLessThan(before.n);
  await expect(page.locator('#setBody [data-prof="fast"]')).toHaveClass(/on/);
  // tek bir ayar değişince profil "özel" olur
  await page.click('#setBody [data-set="dwRes"][data-v="2048"]');
  expect(await page.evaluate(() => __tz.SETTINGS.profile)).toBe('custom');
  await page.keyboard.press('Escape');
  await expect(page.locator('#setDlg')).not.toHaveClass(/on/);
  await page.reload();
  await page.waitForFunction(() => window.__tz && window.__tz.model && window.__tz.model.polys.length > 0);
  const after = await page.evaluate(() => ({ seg: __tz.SETTINGS.curveSeg, dw: __tz.SETTINGS.dwRes, prof: __tz.SETTINGS.profile, err: Object.keys(__tz.model.errors) }));
  expect(after).toEqual({ seg: 32, dw: 2048, prof: 'custom', err: [] });
  // dengeliye dönünce eski ayrıntı geri gelir
  await page.evaluate(() => __tz.setProfile('balanced'));
  const back = await page.evaluate(() => [__tz.SETTINGS.curveSeg, __tz.model.polys.length, Object.keys(__tz.model.errors).length, __tz.model.props.vol]);
  expect(back[0]).toBe(64); expect(back[2]).toBe(0);
  expect(Math.abs(back[1] - before.n)).toBeLessThan(before.n * 0.01);
  expect(Math.abs(back[3] - before.vol)).toBeLessThan(before.vol * 1e-4);
  expect(errors).toEqual([]);
});
