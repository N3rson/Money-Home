// Turn the Vite build into one self-contained HTML file (for the clickable prototype).
// Usage: node tools/inline-build.mjs dist/index.html dist/prototype.html
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [src, out] = process.argv.slice(2);
const dir = dirname(src);
let html = readFileSync(src, 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+)"[^>]*>/g, (_, href) => `<style>${readFileSync(join(dir, href), 'utf8')}</style>`);
html = html.replace(/<script type="module" crossorigin src="\.?\/?([^"]+)"><\/script>/g, (_, s) => {
  const js = readFileSync(join(dir, s), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});

// The artifact host supplies <html>/<head>/<body>; keep only what goes inside.
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keepHead = head
  .split('\n')
  .filter((l) => !/<meta charset|<meta name="viewport"|rel="manifest"|rel="icon"|rel="apple-touch-icon"|apple-mobile-web-app|mobile-web-app-capable/.test(l))
  .join('\n');
// title first: only the first 8KB are scanned for it
const title = keepHead.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = keepHead.replace(title, '');
// scripts must run after #app exists
const scripts = [];
const restNoScripts = rest.replace(/<script type="module">[\s\S]*?<\/script>/g, (m) => {
  scripts.push(m);
  return '';
});
const result = `${title}\n${restNoScripts.trim()}\n${body.trim()}\n${scripts.join('\n')}\n`;
writeFileSync(out, result);
console.log(`${out}: ${(result.length / 1024).toFixed(0)} KB`);
