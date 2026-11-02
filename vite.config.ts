import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * `virtual:seed` — optional private starting data.
 * Real budget data never lives in the code repository. A local
 * JSON file (converted from the spreadsheet with tools/xlsx_to_json.py) can be
 * injected at build time with SEED_FILE=/path/to/budget.json.
 */
function seedPlugin(): Plugin {
  const id = 'virtual:seed';
  return {
    name: 'money-home-seed',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null;
      const file = process.env.SEED_FILE;
      const json = file && existsSync(file) ? readFileSync(file, 'utf8') : 'null';
      return `export default ${json};`;
    },
  };
}

/**
 * Offline support for the iPhone (PWA) build: emits sw.js that precaches every
 * built file. Pages are network-first (updates arrive when online), assets are
 * cache-first (their names change with every build). GitHub API calls are
 * never cached.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'money-home-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg'];
      const version = Date.now().toString(36);
      const source = `const CACHE = 'money-home-${version}';
const PRECACHE = ${JSON.stringify(['./', ...files.filter((f) => f !== 'index.html').concat(extra).map((f) => './' + f)])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [preact(), seedPlugin(), ...(mode === 'prototype' ? [] : [serviceWorkerPlugin()])],
  define: {
    __PROTOTYPE__: JSON.stringify(mode === 'prototype'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: mode === 'prototype' ? 100_000_000 : 4096,
  },
  test: { environment: 'node' },
}));
