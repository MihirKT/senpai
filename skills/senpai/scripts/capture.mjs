#!/usr/bin/env node
// Crawl same-origin pages: rendered HTML, assets, screenshots per viewport, scroll video + frames,
// motion inventory, element inventory, design tokens. With --mirror=1 also writes a runnable static clone.
// Usage: node capture.mjs --url=https://site --out=./senpai-out [--pages=N (default: whole site)] [--viewports=1440x900,390x844]
//        [--frames=6] [--video=1] [--mirror=1] [--ignore-robots=0] [--delay=500]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, viewportsFrom, slugFor, settle, shoot } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
if (!a.url) { console.error('need --url='); process.exit(2); }
// follow redirects first (apex -> www) so same-origin checks use the real origin
const start = new URL((await fetch(a.url).catch(() => null))?.url || a.url);
const origin = start.origin;
const out = path.resolve(a.out || './senpai-out');
const maxPages = +(a.pages || 0) || Infinity; // 0 or unset = whole site
const viewports = viewportsFrom(a.viewports);
const frames = +(a.frames ?? 6);
const mirror = a.mirror !== '0';
const delay = +(a.delay || 500);

const EXT = { 'text/css': '.css', 'javascript': '.js', 'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf',
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg': '.svg',
  'image/gif': '.gif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'json': '.json', 'icon': '.ico' };
const extFor = ct => Object.entries(EXT).find(([k]) => ct.includes(k))?.[1] || '';
const TEXT = /\.(css|js|mjs|json|svg|html)$/;
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

// ---- robots.txt (crude: Disallow lines in "User-agent: *" groups)
async function robotsDisallow() {
  if (a['ignore-robots'] === '1') return [];
  try {
    const txt = await (await fetch(origin + '/robots.txt')).text();
    const rules = []; let star = false;
    for (const line of txt.split('\n')) {
      const [k, ...v] = line.split(':'); const key = k.trim().toLowerCase(); const val = v.join(':').trim();
      if (key === 'user-agent') star = val === '*';
      else if (star && key === 'disallow' && val) rules.push(val);
    }
    return rules;
  } catch { return []; }
}

const assets = new Map(); // url -> local path (site-root relative)
function localPath(u, ct) {
  const base = u.origin === origin ? '' : `/_ext/${u.host}`;
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index';
  let ext = path.extname(p);
  if (!ext) { ext = extFor(ct); p += ext; }
  if (u.search) p = p.slice(0, p.length - ext.length) + '__' + hash(u.search) + ext;
  return base + p;
}

async function saveAsset(res) {
  const req = res.request();
  const type = req.resourceType();
  // 206 = partial range (video/audio streaming); body is a chunk, so refetch the whole file below
  if (req.method() !== 'GET' || ![200, 206].includes(res.status())) return;
  if (!['stylesheet', 'script', 'image', 'font', 'media', 'fetch', 'xhr'].includes(type)) return;
  const u = new URL(res.url());
  if (!/^https?:$/.test(u.protocol) || assets.has(u.href)) return;
  if ((type === 'fetch' || type === 'xhr') && u.origin !== origin) return;
  try {
    assets.set(u.href, null); // claim now: range requests for one video arrive in parallel
    const body = res.status() === 206 ? Buffer.from(await (await fetch(u.href)).arrayBuffer()) : await res.body();
    const lp = localPath(u, res.headers()['content-type'] || '');
    const file = path.join(out, 'assets', lp);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    assets.set(u.href, lp);
  } catch { assets.delete(u.href); /* redirect/empty bodies have nothing to save */ }
}

// ---- in-page probes
const MOTION = () => {
  const sel = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
  const w = window, q = s => !!document.querySelector(s);
  const libs = Object.entries({
    gsap: !!w.gsap, ScrollTrigger: !!w.ScrollTrigger, lenis: !!w.Lenis || q('html.lenis'), locomotive: q('[data-scroll-container]'),
    aos: q('[data-aos]'), swiper: q('.swiper'), splide: q('.splide'), framer: q('[data-framer-name]'), lottie: !!w.lottie || q('lottie-player,dotlottie-player'),
    three: !!w.THREE, canvas: q('canvas'), video: q('video'), barba: !!w.barba, anime: !!w.anime, motionOne: !!w.Motion,
  }).filter(([, v]) => v).map(([k]) => k);
  const keyframes = [];
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; }
    for (const r of rules) if (r.type === 7) keyframes.push(r.cssText.slice(0, 600));
  }
  const anims = document.getAnimations().slice(0, 120).map(an => {
    const t = an.effect?.target, tm = an.effect?.getTiming?.() || {};
    return { el: t ? sel(t) : null, name: an.animationName || an.transitionProperty || an.constructor.name, dur: tm.duration, delay: tm.delay, ease: tm.easing, iter: tm.iterations };
  });
  const transitions = {}; let sticky = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position === 'sticky' || cs.position === 'fixed') sticky++;
    if (cs.transitionDuration !== '0s') { const k = `${cs.transitionProperty} ${cs.transitionDuration} ${cs.transitionTimingFunction}`; transitions[k] = (transitions[k] || 0) + 1; }
  }
  return { libs, keyframes: keyframes.slice(0, 80), anims, transitions, stickyOrFixed: sticky };
};

const ELEMENTS = () => {
  const sel = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  const els = [], colors = {}, fonts = {}, sizes = {}, radii = {}, shadows = {};
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (bg) bump(colors, bg);
    if (own) { bump(colors, cs.color); bump(fonts, cs.fontFamily); bump(sizes, `${cs.fontSize}/${cs.lineHeight}/${cs.fontWeight}`); }
    if (cs.borderRadius !== '0px') bump(radii, cs.borderRadius);
    if (cs.boxShadow !== 'none') bump(shadows, cs.boxShadow);
    if (els.length < 1500) els.push({
      s: sel(el), r: [r.x, r.y + scrollY, r.width, r.height].map(Math.round),
      t: own ? el.textContent.trim().slice(0, 60) : undefined,
      f: own ? `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily.split(',')[0]}` : undefined,
      c: own ? cs.color : undefined, bg, rad: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
      img: el.currentSrc || (cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 200) : undefined) || undefined,
    });
  }
  return { els, tokens: { colors, fonts, sizes, radii, shadows } };
};

const top = (o, n = 15) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n);

// ---- crawl
await fs.mkdir(out, { recursive: true });
const disallow = await robotsDisallow();
const blocked = p => disallow.some(r => p.startsWith(r.replace(/\*.*$/, '')));
const browser = await chromium.launch();
const queue = [start.href.split('#')[0]], seen = new Set(queue), pages = [], skipped = [];
const tokens = { colors: {}, fonts: {}, sizes: {}, radii: {}, shadows: {} };

while (queue.length && pages.length < maxPages) {
  const url = queue.shift();
  if (blocked(new URL(url).pathname)) { skipped.push({ url, why: 'robots.txt' }); continue; }
  const slug = slugFor(url), dir = path.join(out, 'pages', slug);
  await fs.mkdir(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: viewports[0], ...(a.video !== '0' && { recordVideo: { dir, size: viewports[0] } }) });
  const page = await ctx.newPage();
  page.on('response', saveAsset);
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()}`);
    await page.waitForTimeout(1200);
    const every = Math.max(1, Math.floor(12 / Math.max(frames, 1)));
    await settle(page, { onStep: async i => { if (frames && i % every === 0 && i / every <= frames) await page.screenshot({ path: path.join(dir, `frame-${String(i / every).padStart(2, '0')}.png`) }); } });
    const motion = await page.evaluate(MOTION);
    const { els, tokens: t } = await page.evaluate(ELEMENTS);
    for (const k in t) for (const [v, n] of Object.entries(t[k])) tokens[k][v] = (tokens[k][v] || 0) + n;
    const shots = [];
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await settle(page, { steps: 4, pause: 120 });
      const f = `${vp.width}.png`; await shoot(page, path.join(dir, f)); shots.push(f);
    }
    const html = await page.content();
    const title = await page.title();
    const links = await page.$$eval('a[href]', as => as.map(x => x.href));
    for (const l of links) {
      const u = new URL(l); u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/\/{2,}/g, '/');
      if (u.origin === origin && !seen.has(u.href) && !/\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|docx?|xlsx?)$/i.test(u.pathname)) { seen.add(u.href); queue.push(u.href); }
    }
    await fs.writeFile(path.join(dir, 'source.html'), html);
    await fs.writeFile(path.join(dir, 'motion.json'), JSON.stringify(motion, null, 1));
    await fs.writeFile(path.join(dir, 'elements.json'), JSON.stringify(els));
    pages.push({ url, slug, path: new URL(url).pathname, title, shots, elements: els.length, libs: motion.libs, anims: motion.anims.length, keyframes: motion.keyframes.length });
    process.stdout.write(`ok ${slug}\n`);
  } catch (e) {
    skipped.push({ url, why: e.message.split('\n')[0] });
    process.stdout.write(`fail ${slug}: ${e.message.split('\n')[0]}\n`);
  }
  const video = page.video();
  await ctx.close();
  if (video) await fs.rename(await video.path(), path.join(dir, 'scroll.webm')).catch(() => {});
  await new Promise(r => setTimeout(r, delay));
}
await browser.close();

// ---- static mirror: same-origin assets keep their root paths; cross-origin go under /_ext/<host>/
if (mirror) {
  const clone = path.join(out, 'clone');
  await fs.rm(clone, { recursive: true, force: true });
  await fs.cp(path.join(out, 'assets'), clone, { recursive: true }).catch(() => {});
  const rewrites = [];
  for (const [href, lp] of assets) {
    const u = new URL(href);
    if (u.origin !== origin || u.search || lp !== decodeURIComponent(u.pathname)) {
      rewrites.push([href, lp]);
      if (u.origin === origin) rewrites.push([u.pathname + u.search, lp]);
    }
  }
  for (const r of [...rewrites]) if (r[0].includes('&')) rewrites.push([r[0].replaceAll('&', '&amp;'), r[1]]);
  rewrites.sort((x, y) => y[0].length - x[0].length);
  const hosts = [...new Set([...assets.keys()].map(h => new URL(h).host))].filter(h => h !== start.host);
  const fix = s => {
    for (const [k, v] of rewrites) s = s.replaceAll(k, v);
    s = s.replaceAll(origin, '').replaceAll('//' + start.host, '');
    for (const h of hosts) s = s.replaceAll(`https://${h}/`, `/_ext/${h}/`).replaceAll(`//${h}/`, `/_ext/${h}/`);
    return s;
  };
  const files = (await fs.readdir(clone, { recursive: true }).catch(() => [])).map(f => path.join(clone, f));
  for (const f of files.filter(f => TEXT.test(f))) await fs.writeFile(f, fix(await fs.readFile(f, 'utf8')));
  for (const p of pages) {
    let html = fix(await fs.readFile(path.join(out, 'pages', p.slug, 'source.html'), 'utf8'));
    // integrity hashes break after rewriting; CSP may block local paths
    html = html.replace(/\sintegrity="[^"]*"/g, '').replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, '');
    const f = path.join(clone, p.path.replace(/\/+$/, ''), 'index.html');
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, html);
  }
}

const manifest = {
  url: start.href, captured: new Date().toISOString(), viewports, mirror, pages, skipped,
  queuedNotVisited: queue.length, assets: assets.size,
  tokens: Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, top(v)])),
};
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`pages ${pages.length} | skipped ${skipped.length} | queued ${queue.length} | assets ${assets.size} | out ${out}`);
