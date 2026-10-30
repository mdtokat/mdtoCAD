// Kasnak düzenini (tabla, iki yatak, mil, iki bronz burç, kasnak) bir kullanıcının tarayıcıda yapacağı gibi gerçek fare
// tıklamaları ve klavyeyle çizer, montajı ekranda yüzeylere tıklayarak kurar ve ornekler/kasnak-duzeni.tocad.json dosyasını yazar.
// Ölçüler ve yorum: README “Örnek parçalar”. Kullanım:  npm run build && node ornekler/kasnak-duzeni-ciz.mjs
// (Playwright gerekir: npm install. Yerel Chromium için PW_CHROMIUM=/yol/chrome)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const THREE_JS = readFileSync(require.resolve('three/build/three.min.js'), 'utf8');
const ORBIT_JS = readFileSync(join(dirname(require.resolve('three/package.json')), 'examples/js/controls/OrbitControls.js'), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
page.on('pageerror', e => { console.error('Sayfa hatası:', e); process.exitCode = 1; });
await page.route('**/*', r => {
  const u = r.request().url();
  if (u.includes('three.min.js')) return r.fulfill({ body: THREE_JS, contentType: 'application/javascript' });
  if (u.includes('OrbitControls')) return r.fulfill({ body: ORBIT_JS, contentType: 'application/javascript' });
  if (u.includes('fonts.g')) return r.abort();
  return r.continue();
});
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(pathToFileURL(join(here, '..', 'dist', 'index.html')).href);
await page.waitForFunction(() => window.__tz && window.__tz.model);

/* ---------- kullanıcı eylemleri: şerit, ağaç, fare ve klavye (__tz yalnızca ekran konumunu bulmak ve durumu okumak için) ---------- */
const ev = (fn, arg) => page.evaluate(fn, arg);
const bekle = ms => page.waitForTimeout(ms);
const serit = async ad => { await page.locator('#ribbon button', { hasText: ad }).first().click(); await bekle(250); };
const agac = async ad => { await page.locator('#tree .ti', { hasText: ad }).first().click(); await bekle(150); };
const tus = async k => { await page.keyboard.press(k); await bekle(150); };
const yaz = s => page.keyboard.type(s, { delay: 20 });
async function tikla(x, y) { // çizimde (x, y) noktası
  const p = await ev(([x, y]) => __tz.scr(x, y), [x, y]);
  await page.mouse.move(p[0] - 3, p[1] + 2); await page.mouse.move(p[0], p[1]); await bekle(40); await page.mouse.click(p[0], p[1]); await bekle(120);
}
async function imlec(x, y) { const p = await ev(([x, y]) => __tz.scr(x, y), [x, y]); await page.mouse.move(p[0], p[1], { steps: 3 }); await bekle(60); }
async function tekerlek(x, y, n) { const p = await ev(([x, y]) => __tz.scr(x, y), [x, y]); await page.mouse.move(p[0], p[1]); for (let i = 0; i < Math.abs(n); i++) { await page.mouse.wheel(0, Math.sign(n) * 100); await bekle(60); } await bekle(300); }
const hud = async k => { await page.click(`#hud [data-hud="${k}"]`); await bekle(700); };
// İzometrik düğmesine her basış görünümü 90° çevirir: istenen taraftan bakana dek bas
async function izometrik(d) {
  for (let i = 0; i < 5; i++) { if (await ev(d => { const c = __tz.camera.position.clone().sub(__tz.controls.target).normalize(); return c.x * d[0] + c.y * d[1] + c.z * d[2] > Math.sqrt(3) * 0.999; }, d)) return; await hud('iso'); }
}
async function cizimeGir(duzlem) { await agac(duzlem); await serit('Çizim'); await bekle(900); }
async function cizimdenCik() { await page.click('#confirm [data-cf="ok"]'); await bekle(500); await page.click('#cmTabs [data-cm="features"]'); await bekle(150); }
async function tamTanimla() { await serit('Tam Tanımla'); await tus('Escape'); }
async function olcuDegistir(eski, yeni) {
  await page.locator('#labels .dlab', { hasText: new RegExp('^' + eski + '$') }).first().dblclick(); await bekle(200);
  await page.keyboard.press('Control+A'); await yaz(yeni); await tus('Enter');
}
async function ozellik(serAd, ayar = {}) {
  await serit(serAd); await bekle(400);
  if (ayar.bitis) { await page.selectOption('#pm select[data-k="end"]', ayar.bitis); await bekle(200); }
  if (ayar.derinlik != null) await page.fill('#pm input[data-k="depth"]', String(ayar.derinlik));
  await bekle(300); await page.click('#pm [data-pm="ok"]'); await bekle(700);
}
async function yeniParca(ad, malzeme, ilk) {
  if (ilk) { await page.click('#fileBtn'); await page.click('[data-m="new"]'); } else await page.click('[data-pa="new"]');
  await bekle(400); await page.fill('#partNameIn', ad); await page.press('#partNameIn', 'Enter'); await page.selectOption('#matSel', malzeme); await bekle(200);
}
async function kontrol(ad) {
  const r = await ev(() => { const m = __tz.model, b = m.box; return { err: m.errors, dof: Object.values(m.dof), box: b && b.min.map((v, i) => +(b.max[i] - v).toFixed(2)), vol: m.props && +m.props.vol.toFixed(0) }; });
  console.log(ad, JSON.stringify(r));
  if (Object.keys(r.err).length || r.dof.some(d => d !== 0)) { console.error('  hata veya tam tanımsız çizim'); process.exitCode = 1; }
}
/* Döndürme parçası: Ön Düzlem'de merkez çizgisi ve çizgi zinciri, Tam Tanımla (eksene göre çap ölçüleri), Döndürme */
async function dondurmeParcasi(ad, malzeme, eksen, noktalar, yakin, sonra) {
  await yeniParca(ad, malzeme); await cizimeGir('Ön Düzlem');
  if (yakin) await tekerlek(...yakin);
  await serit('Merkez Çizgisi'); await tikla(...eksen[0]); await tikla(...eksen[1]); await tus('Escape');
  await serit('Çizgi'); for (const p of noktalar) await tikla(...p); await tikla(...noktalar[0]); await tus('Escape');
  await tamTanimla(); if (sonra) await sonra();
  await cizimdenCik(); await ozellik('Döndürme Katman/Taban'); await kontrol(ad);
}

/* =================== Tabla (Ç1020): 128 × 56 × 10, R10 köşeler, 4 × Ø10 (108 × 34), 50 mm çıkıntı (4), altta 38 mm kanal (4) =================== */
await yeniParca('Tabla', 'c22', true);
await cizimeGir('Üst Düzlem');
await serit('Merkez Dikdörtgen'); await tikla(0, 0); await imlec(30, 15); await yaz('128'); await tus('Enter'); await yaz('56'); await tus('Enter');
await serit('Daire');
for (const [x, y] of [[54, 17], [-54, 17], [-54, -17], [54, -17]]) { await tikla(x, y); await imlec(x + 4, y); await yaz('10'); await tus('Enter'); }
await serit('Çizim Radyusu'); await page.fill('#pm input[data-k="filletR"]', '10'); await page.press('#pm input[data-k="filletR"]', 'Enter');
for (const [x, y] of [[64, 28], [-64, 28], [-64, -28], [64, -28]]) await tikla(x, y);
await tamTanimla();
for (let i = 0; i < 4; i++) await olcuDegistir('55', '54'); // ızgaraya yakalanan 55'ler resimdeki 54'e
await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { derinlik: 10 });
{ const s = await ev(() => __tz.scrW([0, 10, 0])); await page.mouse.click(s[0], s[1]); await bekle(200); } // üst yüze tıkla
await serit('Çizim'); await bekle(900);
await serit('Merkez Dikdörtgen'); await tikla(0, 0); await imlec(20, 15); await yaz('50'); await tus('Enter'); await yaz('56'); await tus('Enter');
await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { derinlik: 4 });
await cizimeGir('Üst Düzlem');
await serit('Merkez Dikdörtgen'); await tikla(0, 0); await imlec(20, 15); await yaz('38'); await tus('Enter'); await yaz('70'); await tus('Enter');
await cizimdenCik(); await ozellik('Ekstrüzyon Kesme', { bitis: 'blind', derinlik: 4 }); // gövde düzlemin üstünde: yön kendiliğinden yukarı
await kontrol('tabla');

/* =================== Yatak (DDL 22): 56 × 38 × 8 taban, R10, 2 × Ø5; 28 × 8 kulak, Ø28 × 16 göbek, Ø10 delik (eksen 43), 6 mm kaburga, R4 =================== */
await yeniParca('Yatak', 'gg20');
await cizimeGir('Üst Düzlem');
await serit('Köşe Dikdörtgen'); await tikla(-28, 0); await imlec(10, -20); await yaz('56'); await tus('Enter'); await yaz('38'); await tus('Enter');
await serit('Çizim Radyusu'); await page.fill('#pm input[data-k="filletR"]', '10'); await page.press('#pm input[data-k="filletR"]', 'Enter');
for (const [x, y] of [[28, 0], [-28, 0], [-28, -38], [28, -38]]) await tikla(x, y);
await serit('Daire'); for (const [x, y] of [[-18, -28], [18, -28]]) { await tikla(x, y); await imlec(x + 2, y); await yaz('5'); await tus('Enter'); } // R10 merkezine yakalanır
await tamTanimla(); await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { derinlik: 8 });
await cizimeGir('Ön Düzlem'); await tekerlek(0, 0, 3);
await serit('Daire'); await tikla(0, 43); await imlec(5, 43); await yaz('28'); await tus('Enter');
await serit('Köşe Dikdörtgen'); await tikla(-14, 8); await imlec(0, 30); await yaz('28'); await tus('Enter'); await yaz('35'); await tus('Enter');
await tamTanimla(); await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { derinlik: 8 });
await cizimeGir('Ön Düzlem'); await tekerlek(0, 0, 3);
await serit('Daire'); await tikla(0, 43); await imlec(5, 43); await yaz('28'); await tus('Enter');
await tamTanimla(); await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { derinlik: 16 });
await cizimeGir('Ön Düzlem'); await tekerlek(0, 0, 3);
await serit('Daire'); await tikla(0, 43); await imlec(5, 43); await yaz('10'); await tus('Enter');
await tamTanimla(); await cizimdenCik(); await ozellik('Ekstrüzyon Kesme'); // Ön Düzlem gövdenin arka yüzü: kesme gövdeye doğru çevrilir
await cizimeGir('Sağ Düzlem');
await serit('Çizgi'); for (const [x, y] of [[-8, 8], [-32, 8], [-16, 33], [-8, 33], [-8, 8]]) await tikla(x, y); await tus('Escape');
await tamTanimla(); await cizimdenCik(); await ozellik('Ekstrüzyon Katman/Taban', { bitis: 'mid', derinlik: 6 });
// kulak ile taban arasındaki iki iç kenara R4: soldaki kaburganın arkasında kalır, İzometrik'e yeniden basılıp soldan bakılır
await serit('Radyus'); await bekle(300);
for (const [p, gor] of [[[14, 8, 4], [1, 1, 1]], [[-14, 8, 4], [-1, 1, 1]]]) {
  await izometrik(gor);
  const s = await ev(p => __tz.scrW(p), p); await page.mouse.move(s[0] - 4, s[1] + 3); await page.mouse.move(s[0], s[1]); await page.mouse.click(s[0], s[1]); await bekle(250);
}
await page.fill('#pm input[data-k="r"]', '4'); await bekle(500);
if (await ev(() => __tz.pm.draft.edges.filter(e => Math.abs(e.a[1] - 8) < 1e-6 && Math.abs(e.b[1] - 8) < 1e-6).length) !== 2) { console.error('  radyus kenarları yanlış seçildi'); process.exitCode = 1; }
await page.click('#pm [data-pm="ok"]'); await bekle(700);
await kontrol('yatak');

/* =================== Burç (bronz), mil (Ç1040), kasnak (DDL 26): döndürme =================== */
await dondurmeParcasi('Burç', 'bronze', [[0, -5], [0, 25]], [[6, 0], [15, 0], [15, 6], [10, 6], [10, 20], [6, 20]]);
// 1 mm'lik omuzlar ekranda seçilemeyecek kadar küçük: abartılı çizilip çap ölçüsüyle düzeltilir
await dondurmeParcasi('Mil', 'c40', [[-5, 0], [87, 0]], [[0, 0], [0, 5], [16, 5], [16, 9], [66, 9], [66, 5], [82, 5], [82, 0]], [41, 0, -3],
  () => olcuDegistir('Ø18', '12'));
await dondurmeParcasi('Kasnak', 'gg25', [[0, -5], [0, 35]],
  [[10, 0], [20, 0], [20, 10], [26, 10], [26, 0], [30, 0], [30, 30], [26, 30], [26, 20], [20, 20], [20, 30], [10, 30], [10, 20], [15, 20], [15, 10], [10, 10]], [15, 15, -3]);

/* =================== Montaj =================== */
await page.click('[data-tab="asm"]'); await bekle(800);
await page.click('[data-aa="new"]'); await bekle(600);
for (const p of ['Tabla', 'Yatak', 'Yatak', 'Mil', 'Burç', 'Burç', 'Kasnak'])
  await page.locator('#pm .lst > div', { hasText: new RegExp('^' + p + '\\s*Ekle$') }).locator('[data-addp]').click(), await bekle(400);
await tus('Escape');
await page.fill('#asmNameIn', 'Kasnak düzeni'); await page.press('#asmNameIn', 'Enter'); await bekle(300);
const TABLA = 0, Y1 = 1, Y2 = 2, MIL = 3, B1 = 4, B2 = 5, KASNAK = 6;
/* bileşenin kendi koordinatındaki noktasını ekranda bulup tıklar (Alt: öndeki bileşenin arkasındakini seçer) */
async function yuzey(i, p, alt) {
  const s = await ev(([i, p]) => { const T = __tz.curAsm().comps[i].T;
    return __tz.scrW([0, 1, 2].map(k => T[k] * p[0] + T[4 + k] * p[1] + T[8 + k] * p[2] + T[12 + k])); }, [i, p]);
  await page.mouse.move(s[0] - 3, s[1] + 2); await page.mouse.move(s[0], s[1]); await bekle(80);
  if (alt) await page.keyboard.down('Alt'); await page.mouse.click(s[0], s[1]); if (alt) await page.keyboard.up('Alt'); await bekle(250);
}
const yon = (i, d) => ev(([i, d]) => { const T = __tz.curAsm().comps[i].T; return [0, 1, 2].map(k => T[k] * d[0] + T[4 + k] * d[1] + T[8 + k] * d[2]); }, [i, d]);
async function ekle(ad) {
  const r = await ev(() => { const P = __tz.asmUI.pm; return { err: P.err, a: !!P.draft.a, b: !!P.draft.b }; });
  if (r.err || !r.a || !r.b) { console.error(' ', ad, 'eşleştirilemedi:', r.err); process.exitCode = 1; }
  await tus('Enter'); await bekle(350);
}
await page.click('[data-cmd="amate"]'); await bekle(400);
// yatak<1>: taban tablanın üstüne (alttan bakılarak), kulak iç yüzü çıkıntının +X yan yüzüne, taban yanı tablanın yanıyla aynı hizada
await yuzey(TABLA, [45, 10, 0]); await hud('top'); await hud('top'); await yuzey(Y1, [0, 0, 19]); await ekle('yatak<1> taban');
await izometrik([1, 1, 1]); await yuzey(TABLA, [25, 12, 0]); await izometrik([-1, 1, -1]); await yuzey(Y1, [0, 25, 0]); await ekle('yatak<1> kulak');
await izometrik([1, 1, -1]); await yuzey(TABLA, [0, 5, -28]); await yuzey(Y1, [28, 4, 19]); await ekle('yatak<1> yan');
// yatak<2>: aynı adımlar karşı tarafta
await izometrik([1, 1, 1]); await yuzey(TABLA, [-45, 10, 0]); await hud('top'); await hud('top'); await yuzey(Y2, [0, 0, 19]); await ekle('yatak<2> taban');
await izometrik([-1, 1, 1]); await yuzey(TABLA, [-25, 12, 0]); await izometrik([1, 1, -1]); await yuzey(Y2, [0, 25, 0]); await ekle('yatak<2> kulak');
await yuzey(TABLA, [0, 5, -28]); await yuzey(Y2, [-28, 4, 19]); await ekle('yatak<2> yan');
// mil: yatak<1> deliğinde (dönmesi kilitli), ucu göbeğin dış yüzüyle aynı hizada
await izometrik([1, 1, 1]); await tus('f'); await bekle(500);
await yuzey(MIL, [8, 0, 5]); await yuzey(Y1, [0, 38.3, 14]); await page.check('#pm [data-mlock]'); await bekle(300); await ekle('mil eşmerkezli');
await yuzey(Y1, [10, 43, 16]); await yuzey(MIL, [82, 0, 2]); await ekle('mil ucu');
// kasnak: deliği milde, alın yüzü yatak<1> kulağının iç yüzünden 10 mm (iki yanda 10 mm: 10 + 30 + 10 = 50)
await yuzey(MIL, [41, 0, 6]); await yuzey(KASNAK, [-7.07, 25, -7.07]); await ekle('kasnak eşmerkezli');
await izometrik([-1, 1, 1]); await yuzey(Y1, [-10, 20, 0]);
await izometrik([1, 1, 1]); await yuzey(KASNAK, [28, (await yon(KASNAK, [0, 1, 0]))[0] > 0 ? 30 : 0, 0]);
await page.locator('#pm [data-mtype="distance"]').click(); await bekle(300); await page.fill('#pm input[data-k="val"]', '10'); await bekle(600); await ekle('kasnak mesafe');
// burçlar: deliği milde (mil kasnağın ve yatağın arkasında: Alt + tıklama), flanşı kasnak göbeğinin alnına dayalı
for (const [B, milX, kasnakX] of [[B1, 60, 1], [B2, 22, -1]]) {
  await izometrik([1, 1, 1]); await tus('f'); await bekle(500);
  await yuzey(MIL, [milX, 0, 6], true); await yuzey(B, [-4.2, 18, -4.2]); await ekle('burç eşmerkezli');
  await izometrik([(await yon(B, [0, 1, 0]))[0] > 0 ? 1 : -1, 1, 1]); await yuzey(B, [0, 6, 12.5]);
  const kx = await yon(KASNAK, [0, 1, 0]); const ky = (kx[0] > 0) === (kasnakX > 0) ? 30 : 0;
  await izometrik([kasnakX, 1, 1]); await yuzey(KASNAK, [0, ky, 15]);
  // önizlemede burç gövdesi kasnağın dışına bakıyorsa hizalama ters çevrilir (SolidWorks'teki gibi)
  if (await ev(() => __tz.asmUI.pm.draft.flip)) { await page.locator('#pm button', { hasText: 'Hizalamayı ters çevir' }).click(); await bekle(500); }
  await ekle('burç flanşı');
}
await tus('Escape');
{
  const r = await ev(() => { const a = __tz.curAsm(); return { bilesen: a.comps.length, eslestirme: a.mates.length, cozuldu: !a._unsolved,
    hatali: [...document.querySelectorAll('#tree .ti.err')].map(e => e.textContent.trim()) }; });
  console.log('montaj', JSON.stringify(r));
  if (!r.cozuldu || r.hatali.length || r.eslestirme !== 14) process.exitCode = 1;
}
await page.click('[data-cmd="ainterf"]');
await page.waitForFunction(() => __tz.asmUI.pm && __tz.asmUI.pm.done, null, { timeout: 300000 });
{
  const g = await ev(() => __tz.asmUI.pm.results.filter(x => !x.contact).length);
  console.log('girişim', g); if (g) process.exitCode = 1;
}
await tus('Escape');
await page.click('[data-tab="model"]'); await page.selectOption('#partSel', { label: 'Tabla' }); await bekle(400);
const json = await ev(() => JSON.stringify({ app: 'tocad', ...__tz.project, version: 3 }, (k, v) => k.startsWith('_') ? undefined : v, 1));
writeFileSync(join(here, 'kasnak-duzeni.tocad.json'), json + '\n');
console.log('Yazıldı: kasnak-duzeni.tocad.json');
await browser.close();
