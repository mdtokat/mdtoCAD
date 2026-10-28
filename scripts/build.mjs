#!/usr/bin/env node
// Tezgâh CAD derleme betiği: src/ altındaki dosyaları tek, bağımsız bir HTML dosyasında birleştirir.
// Kullanım:  node scripts/build.mjs            -> dist/index.html
//            node scripts/build.mjs --watch    -> değişiklikleri izler, her kayıtta yeniden derler
import { readFileSync, writeFileSync, mkdirSync, readdirSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'dist', 'index.html');

function build() {
  const t0 = Date.now();
  const tpl = readFileSync(join(src, 'index.html'), 'utf8');
  const css = readFileSync(join(src, 'styles.css'), 'utf8');
  const core = readFileSync(join(src, 'core', 'geometry.js'), 'utf8');
  const appFiles = readdirSync(join(src, 'app')).filter(f => f.endsWith('.js')).sort();
  const app = appFiles.map(f => `/* ===== ${f} ===== */\n` + readFileSync(join(src, 'app', f), 'utf8')).join('\n');
  const appScript = `'use strict';\n(function(){\n${app}\n})();\n`;

  // Sözdizimi denetimi (çalıştırmadan derler)
  for (const [name, code] of [['core/geometry.js', core], ['app (birleşik)', appScript]]) {
    try { new vm.Script(code, { filename: name }); }
    catch (e) { console.error(`\n✗ Sözdizimi hatası: ${name}\n${e.stack.split('\n').slice(0, 4).join('\n')}`); return false; }
  }
  for (const ph of ['<!-- @styles -->', '<!-- @core -->', '<!-- @app -->'])
    if (!tpl.includes(ph)) { console.error(`✗ src/index.html içinde ${ph} yer tutucusu yok.`); return false; }

  const html = tpl
    .replace('<!-- @styles -->', () => `<style>\n${css}</style>`)
    .replace('<!-- @core -->', () => `<script id="core">\n${core}</script>`)
    .replace('<!-- @app -->', () => `<script id="app-js">\n${appScript}</script>`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`✓ dist/index.html (${(html.length / 1024).toFixed(0)} KB, ${appFiles.length + 1} modül) ${Date.now() - t0} ms`);
  return true;
}

const ok = build();
if (process.argv.includes('--watch')) {
  console.log('İzleniyor: src/ (çıkmak için Ctrl+C)');
  let t = null;
  watch(src, { recursive: true }, () => { clearTimeout(t); t = setTimeout(build, 120); });
} else if (!ok) process.exit(1);
