import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile('dist/main/main.js', 'utf8');
const start = source.slice(source.indexOf('function startAutoUpdater()'), source.indexOf('function senderWindow'));
const handlers = {};
let response = 1, installs = 0, prompts = 0;
const updater = { on: (name, fn) => { handlers[name] = fn; }, quitAndInstall: () => { installs++; } };
const context = { app: { isPackaged: true }, electronUpdater: { autoUpdater: updater }, console,
  roomWindow: {}, dialog: { showMessageBox: async () => { prompts++; return { response }; } },
  setTimeout() {}, setInterval() {}, UPDATE_INTERVAL_MS: 1000 };
vm.runInNewContext(start + ';startAutoUpdater();', context);
assert.equal(updater.autoDownload, true);
assert.equal(updater.autoInstallOnAppQuit, false);
assert.equal(installs, 0);
await handlers['update-downloaded']({ version: '0.1.3' });
assert.equal(prompts, 1); assert.equal(installs, 0);
response = 0;
await handlers['update-downloaded']({ version: '0.1.3' });
assert.equal(installs, 1);
console.log('PASS: updates download in background; Later keeps app open; only Proceed installs; quit does not auto-install.');
