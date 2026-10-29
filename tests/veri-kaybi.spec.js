// Veri kaybına karşı koruma: açık çizim de otomatik kaydedilir; tarayıcı deposu dolu/bozuk olsa da veritabanı yedeği
// geri getirilir; projeyi değiştiren işlemlerden önce sürüm saklanır ve Dosya → Önceki sürümler ile açılır.
import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const LS = 'tezgah-cad-v3';
const idbProject = page => page.evaluate(() => __tz.idbDo('kv', 'readonly', s => s.get('project')).then(r => r && JSON.parse(r.json)));

test('açık çizim çizimden çıkmadan kaydedilir (sayfa kapanmadan, ör. elektrik kesintisi)', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await page.click('.ti[data-plane="front"]');
  await page.click('[data-cmd="sketch"]');
  await page.waitForFunction(() => !!__tz.sk);
  await page.evaluate(() => { const T = __tz; T.setTool('rect'); T.toolClick(0, 0); T.toolClick(40, 25); });
  // sayfa kapanma olayı olmadan: en geç 300 ms içinde hem tarayıcı deposuna hem veritabanına yazılır
  await page.waitForTimeout(700);
  const r = await page.evaluate(([LS]) => {
    const o = JSON.parse(localStorage.getItem(LS)); const id = __tz.sk.feat.id;
    const f = o.parts.flatMap(p => p.features).find(x => x.id === id);
    return { ents: f ? f.ents.length : 0 };
  }, [LS]);
  expect(r.ents).toBe(4);
  const db = await idbProject(page);
  const id = await page.evaluate(() => __tz.sk.feat.id);
  expect(db.parts.flatMap(p => p.features).find(x => x.id === id).ents.length).toBe(4);
  expect(errors).toEqual([]);
});

test('tarayıcı deposu yazılamazsa (dolu) son çalışma veritabanından geri gelir', async ({ page }) => {
  await page.addInitScript(([LS]) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === LS) throw new DOMException('dolu', 'QuotaExceededError'); return set.call(this, k, v); };
  }, [LS]);
  const errors = await openApp(page, { keep: true });
  await page.evaluate(() => { __tz.state.partName = 'Kurtarılacak'; });
  await page.evaluate(() => __tz.writeState());
  await expect(page.locator('#toast')).toContainText('veritabanına');
  await page.waitForFunction(() => __tz.idbDo('kv', 'readonly', s => s.get('project')).then(r => !!r && r.json.includes('Kurtarılacak')));
  await page.reload();
  await page.waitForFunction(() => window.__tz && __tz.state && __tz.state.partName === 'Kurtarılacak');
  await expect(page.locator('#toast')).toContainText('geri yüklendi');
  expect(errors).toEqual([]);
});

test('bozuk kayıt: kopyası saklanır, son çalışma veritabanından geri gelir', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  await page.evaluate(() => { __tz.state.partName = 'Sağlam'; __tz.writeState(); });
  await page.waitForFunction(() => __tz.idbDo('kv', 'readonly', s => s.get('project')).then(r => !!r && r.json.includes('Sağlam')));
  await page.evaluate(([LS]) => localStorage.setItem(LS, '{"parts":[{"bozuk'), [LS]);
  await page.reload();
  await page.waitForFunction(() => window.__tz && __tz.state && __tz.state.partName === 'Sağlam');
  expect(await page.evaluate(([LS]) => localStorage.getItem(LS + '-bozuk'), [LS])).toContain('bozuk');
  expect(errors).toEqual([]);
});

test('yeni proje açılınca eski proje sürüm olarak saklanır ve Önceki sürümler ile geri açılır', async ({ page }) => {
  const errors = await openApp(page, { keep: true });
  const n0 = await page.evaluate(() => __tz.project.parts.length);
  expect(n0).toBeGreaterThan(1);
  await page.evaluate(() => document.querySelector('[data-m="new"]').click());
  expect(await page.evaluate(() => __tz.project.parts.length)).toBe(1);
  await page.evaluate(() => document.querySelector('[data-m="versions"]').click());
  const row = page.locator('#askMsg .recrow', { hasText: 'Başka proje açılmadan önce' });
  await expect(row).toHaveCount(1);
  await row.locator('[data-rec-open]').click();
  await page.waitForFunction(n => __tz.project.parts.length === n, n0);
  await expect(page.locator('#toast')).toContainText('Sürüm açıldı');
  expect(errors).toEqual([]);
});

test('Ctrl+S projeyi dosya olarak kaydeder', async ({ page }) => {
  const errors = await openApp(page);
  // tarayıcının dosya seçicisi yoksa indirilir
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const dl = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const d = await dl;
  const { readFileSync } = await import('node:fs');
  const o = JSON.parse(readFileSync(await d.path(), 'utf8'));
  expect(o.app).toBe('tocad');
  expect(o.parts.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
