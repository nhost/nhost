// Icon pipeline for the extension. Renders icons/icon.svg to a high-res master
// with headless Chrome, then downscales to the manifest sizes with ImageMagick
// (Lanczos gives crisper line art than rendering tiny SVGs directly).
//
//   pnpm icons          bake icon-{16,32,48,128}.png + a preview.png contact sheet
//   pnpm icons:watch    bake on every icon.svg save and live-reload a preview page
//                       that shows the *real* PNGs at true size on light/dark + a
//                       mock toolbar (http://localhost:5510)
//
// Requires Google Chrome / Chromium (set CHROME=… to override) and ImageMagick.

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const here = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(here, '..', 'icons');
const svgPath = path.join(iconsDir, 'icon.svg');
const masterPath = path.join(iconsDir, '.icon-master.png');
const previewPath = path.join(iconsDir, 'preview.png');
const SIZES = [16, 32, 48, 128];
const PORT = Number(process.env.SS_ICONS_PORT) || 5510;

function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((c) => c && existsSync(c));
  if (candidates.length === 0) {
    throw new Error('Chrome/Chromium not found — set CHROME=/path/to/chrome');
  }
  return candidates[0];
}

async function renderPngs() {
  const chrome = findChrome();
  await run(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=4',
    '--default-background-color=00000000',
    `--screenshot=${masterPath}`,
    '--window-size=128,128',
    `file://${svgPath}`,
  ]);
  for (const size of SIZES) {
    await run('magick', [
      masterPath,
      '-filter',
      'Lanczos',
      '-resize',
      `${size}x${size}`,
      '-strip',
      path.join(iconsDir, `icon-${size}.png`),
    ]);
  }
  await rm(masterPath, { force: true });
}

// One 160px tile per icon: pad to a square of the row's background colour and
// flatten so the rounded-tile corners blend into it. Plain `magick` (no
// `montage`) avoids ImageMagick's fragile font lookup.
function tileArgs(file, bg) {
  return [
    '(',
    file,
    '-background',
    bg,
    '-gravity',
    'center',
    '-extent',
    '160x160',
    '-background',
    bg,
    '-flatten',
    ')',
  ];
}

async function makeContactSheet() {
  const order = [...SIZES].sort((a, b) => b - a);
  const lightRow = path.join(iconsDir, '.row-light.png');
  const darkRow = path.join(iconsDir, '.row-dark.png');
  const buildRow = (bg, out) =>
    run('magick', [
      ...order.flatMap((s) =>
        tileArgs(path.join(iconsDir, `icon-${s}.png`), bg),
      ),
      '+append',
      out,
    ]);
  await buildRow('#e9edf3', lightRow);
  await buildRow('#0d0f14', darkRow);
  await run('magick', [lightRow, darkRow, '-append', previewPath]);
  await rm(lightRow, { force: true });
  await rm(darkRow, { force: true });
}

async function generateIcons({ sheet }) {
  await mkdir(iconsDir, { recursive: true });
  await renderPngs();
  if (sheet) {
    await makeContactSheet();
  }
  console.log(
    `icons: baked ${SIZES.map((s) => `${s}px`).join(', ')}` +
      (sheet ? ' + preview.png' : ''),
  );
}

// --- live-preview server (watch mode) ---

const clients = new Set();

function reloadClients() {
  for (const res of clients) {
    res.write('event: change\ndata: {}\n\n');
  }
}

function contentType(ext) {
  if (ext === '.svg') {
    return 'image/svg+xml';
  }
  if (ext === '.png') {
    return 'image/png';
  }
  if (ext === '.html') {
    return 'text/html; charset=utf-8';
  }
  return 'application/octet-stream';
}

function servePreview() {
  const server = createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (url === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('retry: 500\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    const file =
      url === '/' || url === '/icons.html'
        ? path.join(here, 'icons.html')
        : path.join(iconsDir, path.basename(url));
    void readFile(file)
      .then((buf) => {
        res.writeHead(200, {
          'content-type': contentType(path.extname(file)),
          'cache-control': 'no-store',
        });
        res.end(buf);
      })
      .catch(() => {
        res.writeHead(404);
        res.end('not found');
      });
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\nicons preview → http://localhost:${PORT}/`);
    console.log('edit icons/icon.svg to rebake + live-reload\n');
  });
}

function watchSvg() {
  let timer;
  watch(svgPath, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void generateIcons({ sheet: false })
        .then(reloadClients)
        .catch((error) => console.error(`icons: ${error.message}`));
    }, 150);
  });
}

const isWatch = process.argv.includes('--watch');
await generateIcons({ sheet: !isWatch });
if (isWatch) {
  servePreview();
  watchSvg();
}
