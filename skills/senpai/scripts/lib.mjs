// Shared page settling + screenshot logic so capture and verify shoot pages identically.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm' };

// Static server for clone/. Query-string assets were saved as name__<hash>.ext; cache-busters (?rnd=, ?v=)
// change per load, so on a miss serve any saved name__*.ext / name.ext sibling instead of 404.
export function serveDir(root, port) {
  root = path.resolve(root);
  return http.createServer(async (req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split(/[?#]/)[0]));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    const send = async c => { res.writeHead(200, { 'content-type': MIME[path.extname(c)] || 'application/octet-stream' }); res.end(await fs.readFile(c)); };
    for (const c of [p, path.join(p, 'index.html'), p + '.html']) {
      try { if ((await fs.stat(c)).isFile()) return send(c); } catch {}
    }
    const ext = path.extname(p), stem = path.basename(p, ext);
    const hit = (await fs.readdir(path.dirname(p)).catch(() => []))
      .find(f => f.startsWith(stem + '__') && (!ext || f.endsWith(ext)) || (!ext && f.startsWith(stem + '.')));
    if (hit) return send(path.join(path.dirname(p), hit));
    res.writeHead(404).end();
  }).listen(port);
}
export const parseArgs = argv => Object.fromEntries(argv.map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : '1'];
}));

export const viewportsFrom = s => (s || '1440x900,390x844').split(',').map(v => {
  const [width, height] = v.split('x').map(Number);
  return { width, height };
});

export const slugFor = url => {
  const p = new URL(url).pathname.replace(/\/+$/, '');
  return p ? p.slice(1).replace(/[^\w.-]+/g, '_') : 'index';
};

// Scroll whole page so lazy images load and scroll-reveal animations reach their end state.
export async function settle(page, { steps = 12, pause = 250, onStep } = {}) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize().height;
  const n = Math.min(steps * 4, Math.max(steps, Math.ceil(h / vh)));
  for (let i = 1; i <= n; i++) {
    await page.evaluate(y => window.scrollTo(0, y), (h * i) / n);
    await page.waitForTimeout(pause);
    if (onStep) await onStep(i, n);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

export async function shoot(page, file) {
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
}
