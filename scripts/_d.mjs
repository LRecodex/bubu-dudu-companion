import { _electron as electron } from 'playwright';
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
const page = await app.firstWindow();
const lines = [];
page.on('console', m => { if (m.text().startsWith('[WALKDBG]')) lines.push(m.text()); });
await page.locator('canvas').waitFor();
await new Promise(r => setTimeout(r, 70000));
await app.close();
let bad = 0;
for (const l of lines) {
  const { dx, dy, sheet, flip } = /dx=(?<dx>-?\d+) dy=(?<dy>-?\d+) sheet=(?<sheet>\S+) flip=(?<flip>\w+)/.exec(l).groups;
  const [x, y] = [Number(dx), Number(dy)];
  const want = Math.abs(x) > Math.abs(y) ? 'walk-side' : (y >= 0 ? 'walk-front' : 'walk-back');
  const wantFlip = want === 'walk-side' ? String(x < 0) : 'false';
  const ok = sheet.endsWith(want) && flip === wantFlip;
  if (!ok) { bad++; console.log('MISMATCH', l, 'expected', want, wantFlip); }
}
const counts = {};
for (const l of lines) { const k = /sheet=\S+-(walk-\w+)/.exec(l)[1] + (l.includes('flip=true') ? ' (flipped)' : ''); counts[k] = (counts[k] ?? 0) + 1; }
console.log('walks:', lines.length, 'mismatches:', bad);
console.log(counts);
