#!/usr/bin/env node
// Serve a clone locally. Usage: node serve.mjs --dir=./senpai-<host>/clone [--port=4173]
import { parseArgs, serveDir } from './lib.mjs';

const a = parseArgs(process.argv.slice(2));
const port = +(a.port || 4173);
serveDir(a.dir || './clone', port);
console.log(`http://localhost:${port}`);
