// Shared helper for the mobile viewport tests. Serves the BUILT site (dist/) on localhost and drives it in
// headless Chrome at phone widths. Nothing here touches the network beyond localhost: every other request is aborted.
//
// Needs, in addition to a build (`npm run build`):
//   - puppeteer-core, resolvable from here or from the folder named by PUPPETEER_CORE_DIR (a dir containing node_modules)
//   - Chrome/Chromium: CHROME_PATH, or the default macOS Google Chrome location
// If any of those is missing, the viewport tests are SKIPPED (with the reason) instead of failing; the static CSS
// guards in the same test file always run.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const WIDTHS = [320, 360, 375, 390, 400, 430];
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

export async function setup() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) return { skip: 'no dist/ build found (run `npm run build` first)' };
  let puppeteer;
  try { puppeteer = createRequire(process.env.PUPPETEER_CORE_DIR ? path.join(process.env.PUPPETEER_CORE_DIR, '/') : import.meta.url)('puppeteer-core'); } catch { return { skip: 'puppeteer-core is not installed (set PUPPETEER_CORE_DIR to a folder that has it)' }; }
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!fs.existsSync(chrome)) return { skip: `Chrome not found at ${chrome} (set CHROME_PATH)` };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-first-run'] });
  return {
    origin, browser,
    async close() { await browser.close(); server.close(); },
    // Opens `pagePath` at `width` (phone emulation) and runs `fn` in the page. Returns fn's result.
    async at(pagePath, width, fn) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await page.setRequestInterception(true);
        page.on('request', (r) => (r.url().startsWith(origin) ? r.continue() : r.abort('blockedbyclient')));
        const resp = await page.goto(origin + pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (!resp || resp.status() !== 200) throw new Error(`${pagePath} returned ${resp && resp.status()}`);
        await new Promise((r) => setTimeout(r, 700));
        return await page.evaluate(fn);
      } finally { await page.close(); }
    },
  };
}

// Page wider than the device? NOTE: compare with the REQUESTED width, not window.innerWidth - in phone emulation
// innerWidth grows to fit overflowing content, which would hide exactly the problem we are looking for.
export const docWidth = () => document.documentElement.scrollWidth;
