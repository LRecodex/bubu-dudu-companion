import assert from 'node:assert/strict';
import { furniture, validPosition, furnitureFlipped } from '../src/game/furniture.ts';
const item = category => furniture.find(f => f.category === category);
assert.ok(validPosition(item('Rug'), 640, 525), 'Front floor must accept rugs');
assert.ok(!validPosition(item('Rug'), 640, 555), 'Rug footprint must stay on floor');
for (const category of ['Window', 'Door']) {
  assert.ok(validPosition(item(category), 540, 340));
  assert.ok(validPosition(item(category), 740, 340));
  assert.ok(!validPosition(item(category), 640, 340), 'Do not straddle corner');
  assert.ok(furnitureFlipped(item(category), { x: 740 }));
  assert.ok(!furnitureFlipped(item(category), { x: 540 }));
}
assert.ok(furnitureFlipped(item('Fireplace'), { x: 775 }));
assert.ok(!validPosition(item('Plant'), 705, 402), 'Keep lounge clear');
assert.ok(!validPosition(item('Rug'), NaN, 450));
console.log('PASS: front floor footprints, both walls, automatic facing, lounge clearance.');
