// Renders the app icon (ensō + roof + small seal) to every size the PWA and
// Android need. Run: node tools/make-icons.cjs   (uses the preinstalled Playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAPER = '#edebe5';
const INK = '#23211e';
const SEAL = '#b4513b';

// Artwork in a 32-unit box (same geometry as the in-app BrandMark), centered at (16,16).
function art({ seal = true } = {}) {
  return `
    <path d="M26.6 9.6A12.4 12.4 0 1 0 28 16.4" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M25.4 8.3A12.9 12.9 0 0 0 9.2 5.6" fill="none" stroke="${INK}" stroke-opacity="0.18" stroke-width="0.7" stroke-linecap="round"/>
    <path d="M10.4 18.6 16 13.4l5.6 5.2" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.6 17.2v4.6h6.8v-4.6" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    ${seal ? `<g transform="rotate(-8 27.7 12.9)">
      <rect x="26.0" y="11.2" width="3.4" height="3.4" rx="0.6" fill="${SEAL}"/>
      <rect x="26.55" y="11.75" width="2.3" height="2.3" rx="0.35" fill="none" stroke="${PAPER}" stroke-width="0.32"/>
    </g>` : ''}`;
}

// size: output px; scale: how much of the canvas the artwork's 15.6-unit radius covers
function svg(size, { radiusShare, background = PAPER, round = false, seal = true }) {
  const r = 15.6; // artwork radius incl. strokes and seal, in units
  const k = (size * radiusShare) / r;
  const off = size / 2 - 16 * k;
  const bg = background
    ? round
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${background}"/>`
      : `<rect width="${size}" height="${size}" fill="${background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}<g transform="translate(${off} ${off}) scale(${k})">${art({ seal })}</g></svg>`;
}

function splash(w, h) {
  const s = Math.min(w, h) * 0.28;
  const k = s / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${PAPER}"/><g transform="translate(${w / 2 - 16 * k} ${h / 2 - 16 * k}) scale(${k})">${art()}</g></svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  async function render(svgText, out, w, h = w, transparent = false) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svgText}</body></html>`);
    await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  }
  const pub = path.join(ROOT, 'public/icons');
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, 'favicon.svg'), svg(64, { radiusShare: 0.46, background: null }));
  await render(svg(192, { radiusShare: 0.36 }), path.join(pub, 'icon-192.png'), 192);
  await render(svg(512, { radiusShare: 0.36 }), path.join(pub, 'icon-512.png'), 512);
  await render(svg(512, { radiusShare: 0.3 }), path.join(pub, 'icon-maskable-512.png'), 512);
  await render(svg(180, { radiusShare: 0.34 }), path.join(pub, 'apple-touch-icon.png'), 180);

  const res = path.join(ROOT, 'android/app/src/main/res');
  if (fs.existsSync(res)) {
    const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
    for (const [d, f] of Object.entries(dens)) {
      const dir = path.join(res, `mipmap-${d}`);
      fs.mkdirSync(dir, { recursive: true });
      const legacy = Math.round(48 * f);
      await render(svg(legacy, { radiusShare: 0.36 }), path.join(dir, 'ic_launcher.png'), legacy);
      await render(svg(legacy, { radiusShare: 0.33, round: true }), path.join(dir, 'ic_launcher_round.png'), legacy, legacy, true);
      const fg = Math.round(108 * f); // adaptive icon: 108dp canvas, ~66dp safe zone
      await render(svg(fg, { radiusShare: 0.27, background: null }), path.join(dir, 'ic_launcher_foreground.png'), fg, fg, true);
    }
    // splash images (portrait / landscape)
    const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
    for (const [d, [w, h]] of Object.entries(sizes)) {
      for (const [o, ww, hh] of [['port', w, h], ['land', h, w]]) {
        const dir = path.join(res, `drawable-${o}-${d}`);
        if (fs.existsSync(dir)) await render(splash(ww, hh), path.join(dir, 'splash.png'), ww, hh);
      }
    }
    await render(splash(480, 320), path.join(res, 'drawable/splash.png'), 480, 320);
  }
  await browser.close();
  console.log('icons done');
})();
