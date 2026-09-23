import { _electron as electron } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
async function verifyOnTop(expected) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()) === expected) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`Native Always on top did not become ${expected}`);
}
let closed = false;
try {
  const page = await app.firstWindow();
  const errors = [];
  const messages = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    messages.push(message.text());
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.locator('canvas').waitFor();
  await page.reload();
  await page.locator('canvas').waitFor();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Always on top' });
  await page.waitForFunction(() => !document.querySelector('[role=switch]').disabled);
  await toggle.evaluate(element => element.click());
  await new Promise(resolve => setTimeout(resolve, 500));
  await verifyOnTop(true);
  await toggle.evaluate(element => element.click());
  await new Promise(resolve => setTimeout(resolve, 500));
  await verifyOnTop(false);
  const state = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const prefs = window.webContents.getLastWebPreferences();
    return { visible: window.isVisible(), size: window.getSize(), contextIsolation: prefs.contextIsolation, nodeIntegration: prefs.nodeIntegration, sandbox: prefs.sandbox };
  });
  assert.deepEqual(state, { visible: true, size: [280, 320], contextIsolation: true, nodeIntegration: false, sandbox: true });
  assert.equal(await page.locator('canvas').count(), 1);
  for (const character of ['bubu', 'dudu']) assert.ok(messages.includes(`[BDC] ${character}-idle loop verified`));
  await mkdir('runtime-debug', { recursive: true });
  await page.screenshot({ path: 'runtime-debug/settings.png' });
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();

  // Every interaction must play through and hand the room back to the pair.
  for (const label of ['Share food', 'Hammer', 'Slap']) {
    await page.getByRole('button', { name: 'Play an interaction', exact: true }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.action-button').disabled, null, { timeout: 15000 });
  }
  for (const key of ['share-food', 'bubu-hammer', 'dudu-slap']) {
    assert.ok(messages.includes(`[BDC] interaction ${key} complete`), `interaction ${key} did not finish`);
  }
  await page.screenshot({ path: 'runtime-debug/interactions.png' });
  assert.deepEqual(errors, []);
  const exit = app.waitForEvent('close');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Close app', exact: true }).click();
  await exit;
  closed = true;
  console.log('PASS: both animations loop; all three interactions play and return; settings toggles native Always on top on/off; Close app exits; security checks pass; no renderer errors.');
} finally {
  if (!closed) await app.close();
}
