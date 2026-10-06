// Playwright for the e2e checks, wherever it is installed: a local node_modules (`npm i -D playwright`, as
// tests/ht/harness/README.md says) or the global npm root. Browser: the installed Chrome (channel 'chrome').
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
export const { chromium } = pw;
