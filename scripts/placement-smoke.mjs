import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
let page, original;
try {
  page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.locator('canvas').waitFor();
  original = await page.evaluate(() => localStorage.getItem('bdc-room-v1'));
  await page.evaluate(() => localStorage.setItem('bdc-room-v1', JSON.stringify({ coins: 500, earnedAt: Date.now(), owned: ['row-1-variant-1', 'row-3-variant-1', 'row-4-variant-1', 'row-5-variant-1'], placed: [] })));
  await Promise.all([page.waitForEvent('console', { predicate: m => m.text() === '[BDC] RoomScene ready' }), page.reload()]);
  const opened = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Shop and inventory' }).click();
  const shop = await opened;
  await shop.getByRole('button', { name: 'Inventory', exact: true }).click();
  const canvas = await page.locator('canvas').boundingBox();
  async function place(name, x, y, flip = false) {
    const article = shop.locator('article').filter({ hasText: name });
    await article.getByRole('button', { name: /^(Place|Move)$/ }).click();
    const px = canvas.x + (x - 420) / 440 * canvas.width, py = canvas.y + (y - 130) / 500 * canvas.height;
    await page.mouse.move(px, py);
    if (flip) await page.keyboard.press('f');
    await page.mouse.click(px, py);
    await article.getByRole('button', { name: 'Move', exact: true }).waitFor();
  }
  await place('Rug 1', 640, 525);
  await place('Window 1', 740, 330);
  await place('Door 1', 535, 413);
  await place('Fireplace 1', 780, 440);
  let placed = await page.evaluate(() => JSON.parse(localStorage.getItem('bdc-room-v1')).placed);
  assert.equal(placed.length, 4);
  assert.ok(Math.abs(placed[0].y - 525) < 2);
  await place('Window 1', 540, 325);
  await place('Window 1', 740, 330);
  await shop.getByRole('button', { name: 'Close shop' }).click();
  await Promise.all([page.waitForEvent('console', { predicate: m => m.text() === '[BDC] RoomScene ready' }), page.reload()]);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('bdc-room-v1')).placed.length), 4);
  await mkdir('runtime-debug', { recursive: true });
  await page.screenshot({ path: 'runtime-debug/both-walls-front-rug.png' });
  for (const name of ['TV time / stop TV', 'TV time / stop TV', 'Nap together', 'Wake up', 'Surprise me!']) {
    await page.getByRole('button', { name: 'Play an interaction', exact: true }).click();
    const tv = name === 'TV time / stop TV' ? page.waitForEvent('console', { predicate: m => m.text().startsWith('[BDC] TV ') }) : undefined;
    await page.getByRole('button', { name, exact: true }).click();
    if (tv) await tv;
    await page.waitForFunction(() => !document.querySelector('.action-button').disabled);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: front rug, doors, moving window between walls, fireplace, persistence, all new activity controls.');
} finally {
  if (page && original !== undefined) await page.evaluate(value => { if (value === null) localStorage.removeItem('bdc-room-v1'); else localStorage.setItem('bdc-room-v1', value); }, original);
  await app.close();
}
