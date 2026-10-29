// Ortak test yardımcıları: dist/index.html'i açar, CDN kütüphanelerini node_modules'tan sunar.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_JS = readFileSync(require.resolve('three/build/three.min.js'), 'utf8');
const ORBIT_JS = readFileSync(join(dirname(require.resolve('three/package.json')), 'examples/js/controls/OrbitControls.js'), 'utf8');
export const APP_URL = pathToFileURL(join(root, 'dist', 'index.html')).href;

/** Uygulamayı temiz bir durumda (örnek proje) açar ve sayfa hatalarını toplar.
 *  keep: boş depoyla açılır; sayfa yenilenince kayıt korunur. */
export async function openApp(page, { keep = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('three.min.js')) return route.fulfill({ body: THREE_JS, contentType: 'application/javascript' });
    if (u.includes('OrbitControls')) return route.fulfill({ body: ORBIT_JS, contentType: 'application/javascript' });
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) return route.abort();
    return route.continue();
  });
  // keep: her test kendi kökeninde (file:// deposu tarayıcı bağlamları arasında paylaşılır; kapanan sayfanın kaydı karışmasın)
  const url = keep ? `http://tz-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.test/index.html` : APP_URL;
  if (keep) await page.route(url, route => route.fulfill({ body: readFileSync(fileURLToPath(APP_URL), 'utf8'), contentType: 'text/html' }));
  else await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(url);
  await page.waitForFunction(() => window.__tz && window.__tz.model && window.__tz.model.polys.length > 0);
  return errors;
}

/** Bir ham Blob'u (sayfadaki) ilk baytlarıyla birlikte döndürür. */
export async function blobHead(page, expr, n = 8) {
  return page.evaluate(async ([expr, n]) => {
    const r = await eval(expr);
    const blob = r.blob || r;
    const buf = new Uint8Array(await blob.arrayBuffer());
    return { size: buf.length, head: String.fromCharCode(...buf.slice(0, n)) };
  }, [expr, n]);
}
