#!/usr/bin/env node
// One shot: install deps if missing -> capture + mirror -> verify -> serve clone. Prints "SERVING <url>" when ready.
// Usage: node clone.mjs <url> [--out=DIR] [--port=4173] [--pages=N] [--ignore-robots=1]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const skill = path.dirname(dir);
const args = process.argv.slice(2);
const url = args.find(x => !x.startsWith('--'));
if (!url) { console.error('usage: node clone.mjs <url>'); process.exit(2); }
const opt = Object.fromEntries(args.filter(x => x.startsWith('--')).map(x => x.slice(2).split('=')));
const home = p => p.replace(/^~(?=$|\/)/, os.homedir());
const out = path.resolve(home(opt.out || `./senpai-${new URL(url).host}`));
const port = opt.port || 4173;
const run = (cmd, a) => { const r = spawnSync(cmd, a, { stdio: 'inherit', cwd: skill }); return r.status; };

if (!fs.existsSync(path.join(skill, 'node_modules', 'playwright'))) run('npm', ['i', '--silent']);
run('npx', ['playwright', 'install', 'chromium']);

const pass = ['pages', 'ignore-robots', 'viewports'].filter(k => opt[k]).map(k => `--${k}=${opt[k]}`);
if (run('node', [path.join(dir, 'capture.mjs'), `--url=${url}`, `--out=${out}`, ...pass]) !== 0) process.exit(1);
if (!fs.existsSync(path.join(out, 'clone', 'index.html'))) { console.error(`no pages cloned, see ${out}/manifest.json "skipped"`); process.exit(1); }
run('node', [path.join(dir, 'verify.mjs'), `--out=${out}`]); // non-zero = some page over threshold; still serve

const { serveDir } = await import('./lib.mjs');
// port busy (e.g. a previous clone still serving) -> try the next one
const listen = p => serveDir(path.join(out, 'clone'), p)
  .on('listening', () => console.log(`SERVING http://localhost:${p}  (clone: ${out}/clone, report: ${out}/verify/report.json)`))
  .on('error', e => e.code === 'EADDRINUSE' && p < +port + 20 ? listen(p + 1) : (console.error(e.message), process.exit(1)));
listen(+port);
