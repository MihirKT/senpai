#!/usr/bin/env node
// Screenshot every captured page on the clone and pixel-diff against the original captures.
// Usage: node verify.mjs --out=./senpai-out [--clone-url=http://localhost:3000] [--threshold=2] [--only=slug,slug]
// Without --clone-url, serves <out>/clone statically. Writes <out>/verify/report.json + diff PNGs. Exit 1 if any page > threshold %.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, settle, shoot, serveDir } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const out = path.resolve(a.out || './senpai-out');
const threshold = +(a.threshold || 2);
const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8'));
const only = a.only ? new Set(a.only.split(',')) : null;

let server, base = a['clone-url'];
if (!base) {
  server = serveDir(path.join(out, 'clone'), 0);
  base = `http://localhost:${server.address().port}`;
}

const vdir = path.join(out, 'verify');
await fs.mkdir(vdir, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const p of manifest.pages) {
  if (only && !only.has(p.slug)) continue;
  for (const vp of manifest.viewports) {
    const page = await browser.newPage({ viewport: vp });
    const f = `${p.slug}@${vp.width}`;
    try {
      await page.goto(base + p.path, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1200);
      await settle(page, { steps: 4, pause: 120 });
      await shoot(page, path.join(vdir, `${f}.clone.png`));
      const A = PNG.sync.read(await fs.readFile(path.join(out, 'pages', p.slug, `${vp.width}.png`)));
      const B = PNG.sync.read(await fs.readFile(path.join(vdir, `${f}.clone.png`)));
      // pad to common size; padding counts as diff so height mismatches surface
      const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
      const pad = img => { const o = new PNG({ width: w, height: h }); o.data.fill(255); for (let i = 0; i < o.data.length; i += 4) o.data[i + 1] = 0; PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
      const diff = new PNG({ width: w, height: h });
      const n = pixelmatch(pad(A).data, pad(B).data, diff.data, w, h, { threshold: 0.1 });
      await fs.writeFile(path.join(vdir, `${f}.diff.png`), PNG.sync.write(diff));
      results.push({ page: p.slug, vp: vp.width, diffPct: +(100 * n / (w * h)).toFixed(2), heightOrig: A.height, heightClone: B.height });
    } catch (e) {
      results.push({ page: p.slug, vp: vp.width, error: e.message.split('\n')[0] });
    }
    await page.close();
  }
}
await browser.close();
server?.close();

results.sort((x, y) => (y.diffPct ?? 101) - (x.diffPct ?? 101));
await fs.writeFile(path.join(vdir, 'report.json'), JSON.stringify({ base, threshold, results }, null, 1));
const bad = results.filter(r => r.error || r.diffPct > threshold);
for (const r of results) console.log(`${r.error ? 'ERR ' : r.diffPct > threshold ? 'FAIL' : 'ok  '} ${r.page}@${r.vp} ${r.error ?? r.diffPct + '%'}${r.heightOrig && r.heightOrig !== r.heightClone ? ` h ${r.heightOrig}->${r.heightClone}` : ''}`);
console.log(`${results.length - bad.length}/${results.length} within ${threshold}% | report ${path.join(vdir, 'report.json')}`);
process.exit(bad.length ? 1 : 0);
