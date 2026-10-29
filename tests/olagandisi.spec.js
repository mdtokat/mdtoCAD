// Olağandışı kullanım: geri al/yinele sıraları, silme, kaydedip yeniden açma ve bozuk veri.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const undo = page => page.evaluate(() => document.querySelector('#undoBtn').click());
const openJson = (page, o) => page.evaluate(async o => {
  const inp = document.querySelector('#fileInput'); document.querySelector('[data-m="open"]').click();
  const dt = new DataTransfer(); dt.items.add(new File([typeof o === 'string' ? o : JSON.stringify(o)], 'p.tocad.json'));
  inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 300));
}, o);
async function reload(page) {
  await page.reload();
  await page.waitForFunction(() => window.__tz && window.__tz.model);
}

test('parça adı ve malzeme kendi geri alma adımıdır; önceki adımı geri almak onları geri çevirmez', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const T = __tz;
    T.openPM('extrude', T.state.features.find(f => f.id === 'x1')); T.pm.draft.depth = 20; T.commitPM();
    const ms = document.querySelector('#matSel'); ms.value = 'al'; ms.dispatchEvent(new Event('change', { bubbles: true }));
    const nm = document.querySelector('#partNameIn'); nm.value = 'Gövde B'; nm.dispatchEvent(new Event('change', { bubbles: true }));
    const out = [];
    for (let i = 0; i < 3; i++) { document.querySelector('#undoBtn').click(); out.push([T.state.partName, T.state.material, T.state.features.find(f => f.id === 'x1').depth]); }
    document.querySelector('#redoBtn').click(); document.querySelector('#redoBtn').click();
    out.push([T.state.partName, T.state.material, T.state.features.find(f => f.id === 'x1').depth]);
    // çizim açıkken malzeme değişir, çizim iptal edilir: malzeme kalır
    T.editSketch('s1'); const ms2 = document.querySelector('#matSel'); ms2.value = 'brass'; ms2.dispatchEvent(new Event('change', { bubbles: true })); T.exitSketch(false);
    out.push(T.state.material);
    return out;
  });
  expect(r).toEqual([['Yatak gövdesi', 'al', 20], ['Yatak gövdesi', 'gg25', 20], ['Yatak gövdesi', 'gg25', 15], ['Yatak gövdesi', 'al', 20], 'brass']);
  expect(errors).toEqual([]);
});

test('çizimde geri al açık ölçü kutularını kapatır; değiştirmeden çıkılan çizim geri alma adımı bırakmaz', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(async () => {
    const T = __tz, o = {};
    T.startSketch({ kind: 'std', key: 'top' });
    T.setTool('rect'); T.toolClick(0, 0); T.sk.cursor = [20, 20]; T.openSkInput('30');
    document.querySelector('#undoBtn').click();
    o.skin = !!document.querySelector('.pop');
    T.setTool('line'); T.toolClick(0, 0); T.toolClick(30, 0); T.setTool('smartdim'); T.toolClick(15, 0); T.toolClick(15, 8);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
    o.dimPop = !!document.querySelector('.pop');
    document.querySelector('#undoBtn').click();
    o.dimPopAfter = !!document.querySelector('.pop');
    T.exitSketch(false);
    // değişiklik yok: geri alma adımı eklenmez, yinele listesi korunur
    T.openPM('extrude', T.state.features.find(f => f.id === 'x1')); T.pm.draft.depth = 20; T.commitPM();
    document.querySelector('#undoBtn').click();
    T.editSketch('s1'); T.exitSketch(true); T.editSketch('s1'); T.exitSketch(false);
    o.undo = !document.querySelector('#undoBtn').disabled; o.redo = !document.querySelector('#redoBtn').disabled;
    document.querySelector('#redoBtn').click(); o.depth = T.state.features.find(f => f.id === 'x1').depth;
    return o;
  });
  expect(r).toEqual({ skin: false, dimPop: true, dimPopAfter: false, undo: false, redo: true, depth: 20 });
  expect(errors).toEqual([]);
});

test('montaj: eşleştir paneli açıkken Ctrl+Z hata vermez; boşta tıklama yinele listesini silmez', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="asm"]');
  await page.click('[data-cmd="amate"]');
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => ({ pm: !!__tz.asmUI.pm, undo: !document.querySelector('#undoBtn').disabled }))).toEqual({ pm: false, undo: false });
  // bileşen sil → geri al → eşleştir paneli aç/kapat → yinele hâlâ çalışır
  await page.evaluate(() => { const a = __tz.curAsm(); document.querySelector(`[data-comp="${a.comps[a.comps.length - 1].id}"] [data-ca="del"]`).click(); });
  await page.keyboard.press('Control+z');
  await page.click('[data-cmd="amate"]'); await page.keyboard.press('Escape');
  await page.keyboard.press('Control+y');
  expect(await page.evaluate(() => __tz.curAsm().comps.length)).toBe(5);
  expect(errors).toEqual([]);
});

test('bozuk proje dosyası: onarılarak açılır; aynı projeyi yeniden açınca eski teknik resim adımları uygulanmaz', async ({ page }) => {
  const errors = await openApp(page);
  for (const o of [
    { parts: [{ partName: 'A', features: [null, { id: 'q', type: 'zzz' }, { id: 's1', type: 'sketch', name: 'Çizim1' }] }] },
    { parts: [{ id: 'P1', partName: 'A', features: [], drawing: { dims: null, notes: 5 } }, { id: 'P1', partName: 'B', features: [] }],
      asms: [{ id: 'A1', comps: [{ id: 'c1', part: 'YOK', T: null }], mates: [{ id: 'm1', type: 'coincident' }] }] },
  ]) {
    await openJson(page, o);
    for (const t of ['asm', 'drawing', 'model']) { await page.evaluate(t => __tz.setTab(t), t); await page.waitForTimeout(150); }
    expect(await page.locator('#toast').textContent()).toContain('Proje açıldı');
  }
  expect(await page.evaluate(() => { const p = __tz.project.parts; return [p.length, new Set(p.map(x => x.id)).size, __tz.project.asms[0].mates.length]; })).toEqual([2, 2, 0]);
  await openJson(page, '{"parts": 5}');
  expect(await page.locator('#toast').textContent()).toContain('okunamadı');
  expect(await page.evaluate(() => __tz.project.parts.map(p => p.partName))).toEqual(['A', 'B']);

  await page.evaluate(() => document.querySelector('[data-m="demo"]').click());
  const saved = await page.evaluate(() => JSON.stringify(__tz.project, (k, v) => k.startsWith('_') ? undefined : v));
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.evaluate(() => { for (const x of [60, 90]) { __tz.setDwTool('note'); __tz.dwToolClick([x, 60], 'mouse'); } });
  await openJson(page, saved);
  expect(await page.evaluate(() => [(__tz.dwS().notes || []).length, document.querySelector('#undoBtn').disabled])).toEqual([0, true]);
  expect(errors).toEqual([]);
});

test('tarayıcıdaki kayıt bozuksa uygulama yine açılır', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await page.evaluate(() => localStorage.setItem('tezgah-cad-v3', JSON.stringify({ parts: [{ partName: 'Bozuk', features: [null, { id: 'q', type: 'zzz' }, { id: 's', type: 'sketch', pts: 3 }] }], asms: 'x' })));
  await page.reload();
  await page.waitForFunction(() => window.__tz && window.__tz.model);
  expect(await page.evaluate(() => [__tz.state.partName, __tz.state.features.map(f => f.type)])).toEqual(['Bozuk', ['sketch']]);
  expect(errors).toEqual([]);
});

test('kapatıp açınca: son değişiklik ve açık çizim kaybolmaz; çizime devam edilir', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await page.evaluate(() => { const T = __tz; T.openPM('extrude', T.state.features.find(f => f.id === 'x1')); T.pm.draft.depth = 22; T.commitPM(); });
  await reload(page);
  expect(await page.evaluate(() => __tz.state.features.find(f => f.id === 'x1').depth)).toBe(22);
  await page.evaluate(() => { const T = __tz; T.startSketch({ kind: 'std', key: 'top' }); T.setTool('circle'); T.toolClick(0, 0); T.toolClick(5, 0); });
  await reload(page);
  const r = await page.evaluate(() => {
    const T = __tz, s = T.state.features[T.state.features.length - 1];
    T.editSketch(s.id); T.setTool('circle'); T.toolClick(20, 0); T.toolClick(24, 0); T.setTool(null); T.exitSketch(true);
    return { type: s.type, ents: s.ents.length, err: T.model.errors };
  });
  expect(r).toEqual({ type: 'sketch', ents: 2, err: {} });
  // yeni ve boş çizim kaydedilmez
  const n = await page.evaluate(() => { __tz.startSketch({ kind: 'std', key: 'front' }); return __tz.state.features.length - 1; });
  await reload(page);
  expect(await page.evaluate(() => __tz.state.features.length)).toBe(n);
  expect(errors).toEqual([]);
});

test('montaj resmi: not, kağıt ayarı ve patlatma adımları kaybolmaz', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await page.click('[data-tab="asm"]');
  await page.evaluate(() => { const a = __tz.curAsm(); a.explode = { steps: [{ id: 'x1', comps: [a.comps[1].id], dir: 'y', dist: 50 }], on: false }; __tz.openAsmDrawing(); });
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 1);
  await page.waitForTimeout(300);
  await page.evaluate(() => { __tz.setDwTool('note'); __tz.dwToolClick([60, 60], 'mouse'); });
  await page.selectOption('#dPaper', 'A2');
  const a = await page.evaluate(() => { const d = __tz.curAsm().drawing; return [d.notes.length, d.paper]; });
  expect(a).toEqual([1, 'A2']);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => __tz.curAsm().drawing.paper)).not.toBe('A2');
  await page.keyboard.press('Control+y');
  await reload(page);
  expect(await page.evaluate(() => { const a = __tz.curAsm(); return [a.drawing.notes.length, a.drawing.paper, a.explode.steps.length]; })).toEqual([1, 'A2', 1]);
  expect(errors).toEqual([]);
});

test('bildirimdeki “Geri al” sekme veya parça değişince başka geçmişi geri almaz', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="drawing"]');
  await page.waitForFunction(() => !!__tz.getCtx() && Object.keys(__tz.getCtx().views).length >= 3);
  await page.evaluate(() => { __tz.setDwTool('note'); __tz.dwToolClick([60, 60], 'mouse'); __tz.setTab('model'); });
  await page.evaluate(() => document.querySelector('.ti[data-id="fl1"] [data-a="del"]').click());
  await page.evaluate(() => __tz.setTab('drawing'));
  await page.evaluate(() => document.querySelector('#toast button').click());
  expect(await page.evaluate(() => [(__tz.dwS().notes || []).length, __tz.state.features.some(f => f.id === 'fl1')])).toEqual([1, false]);
  await page.evaluate(() => __tz.setTab('model'));
  await undo(page);
  expect(await page.evaluate(() => __tz.state.features.some(f => f.id === 'fl1'))).toBe(true);
  expect(errors).toEqual([]);
});
