#!/usr/bin/env node
// Serve a clone locally. Usage: node serve.mjs --dir=./senpai-<host>/clone [--port=4173]
import os from 'node:os';
import { parseArgs, serveDir } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const port = +(a.port || 4173);
// shells don't expand ~ after "--dir=", so do it here
serveDir((a.dir || './clone').replace(/^~(?=$|\/)/, os.homedir()), port);
console.log(`http://localhost:${port}`);
