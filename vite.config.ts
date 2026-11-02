import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync, existsSync } from 'node:fs';

/**
 * `virtual:seed` — optional private starting data.
 * The repository is public, so real budget data never lives in it. A local
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

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [preact(), seedPlugin()],
  define: {
    __PROTOTYPE__: JSON.stringify(mode === 'prototype'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: mode === 'prototype' ? 100_000_000 : 4096,
  },
  test: { environment: 'node' },
}));
