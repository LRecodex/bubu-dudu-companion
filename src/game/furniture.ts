export const furniture = ['Rug', 'Plant', 'Window', 'Door', 'Fireplace'].flatMap((category, row) =>
  Array.from({ length: 5 }, (_, variant) => ({
    id: `row-${row + 1}-variant-${variant + 1}`, name: `${category} ${variant + 1}`,
    category, price: [30, 40, 60, 70, 100][row] + variant * 10,
    width: [100, 48, 90, 64, 88][row], wall: row === 2 || row === 3,
  })));
export type Furniture = typeof furniture[number];
export interface Placement { id: string; x: number; y: number; rotation?: number; flipped?: boolean }
// A compact seating corner aligned along the room's NE/SW axis.
// Shared footprints keep roaming and decoration placement in sync with artwork.
export const lounge = {
  tv: { x: 705, y: 402, scale: .48, halfWidth: 51, halfDepth: 24 },
  sofa: { x: 623, y: 450, scale: .48, halfWidth: 52, halfDepth: 22 },
};
export function inLounge(x: number, y: number, padding = 0) {
  return Object.values(lounge).some(f => Math.abs(x - f.x) < f.halfWidth + padding && Math.abs(y - (f.y - 8)) < f.halfDepth + padding);
}
export interface RoomSave { coins: number; earnedAt: number; owned: string[]; placed: Placement[]; appearance?: Appearance }
const key = 'bdc-room-v1';
export const coinInterval = 60_000;
export function loadRoom(): RoomSave {
  const fresh = { coins: 150, earnedAt: Date.now(), owned: [], placed: [] };
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || !Number.isSafeInteger(value.coins) || value.coins < 0 || !Number.isFinite(value.earnedAt) || !Array.isArray(value.owned) || !Array.isArray(value.placed)) return fresh;
    const owned = [...new Set<string>(value.owned.filter((id: unknown) => furniture.some(f => f.id === id)))];
    const placed = value.placed.filter((p: Placement, index: number, all: Placement[]) => p && owned.includes(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y) && all.findIndex(q => q?.id === p.id) === index);
    return { coins: value.coins, earnedAt: Math.min(Date.now(), value.earnedAt), owned, placed: placed.map((p: Placement) => ({ ...p, rotation: Number.isFinite(p.rotation) ? p.rotation : 0 })), appearance: normalizeAppearance(value.appearance) };
  } catch { return fresh; }
}
export function accrue(save: RoomSave, now = Date.now()): RoomSave {
  const elapsed = Math.max(0, now - save.earnedAt);
  const minutes = Math.floor(elapsed / coinInterval);
  return minutes ? { ...save, coins: Math.min(999999, save.coins + Math.min(minutes, 480) * 5), earnedAt: now - elapsed % coinInterval } : save;
}
export function saveRoom(save: RoomSave) { localStorage.setItem(key, JSON.stringify(save)); }
export function buy(save: RoomSave, id: string): RoomSave {
  const item = furniture.find(f => f.id === id);
  if (!item || save.owned.includes(id) || save.coins < item.price) return save;
  return { ...save, coins: save.coins - item.price, owned: [...save.owned, id] };
}
export function rightWall(x: number) { return x > 640; }
export function furnitureFlipped(item: Furniture, p: Placement) {
  return p.flipped ?? ((item.wall || item.category === 'Fireplace') && rightWall(p.x));
}
export function validPosition(item: Furniture, x: number, y: number, rotation = 0) {
  if (![x, y, rotation].every(Number.isFinite)) return false;
  if (item.wall) {
    const half = item.width / 2;
    const left = x <= 640;
    if (x < (left ? 450 : 640) + half || x > (left ? 640 : 830) - half) return false;
    const base = 340 + Math.abs(x - 640) * 110 / 190;
    return y <= base + half * 110 / 190 - 4 && y >= base - 190 + item.width - half * 110 / 190 + 4;
  }
  // Test the actual floor footprint, not a shrunken diamond of anchor points.
  const rug = item.category === 'Rug';
  const w = item.width * (rug ? .5 : .32), h = item.width * (rug ? .30 : .13);
  const angle = rotation * Math.PI / 180;
  return [[-w, 0], [w, 0], [0, -h], [0, h]].every(([dx, dy]) => {
    const px = x + dx * Math.cos(angle) - dy * Math.sin(angle);
    const py = y + dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(px - 640) / 190 + Math.abs(py - 450) / 110 <= .99;
  }) && (rug || !inLounge(x, y, 8));
}

export const colors = { Cream: '#fff0df', Sage: '#b9cbb0', Sky: '#b8d5e5', Rose: '#e8bcc0', Sand: '#f0ddbd', Walnut: '#ad805e' };
export const designs = ['Plain', 'Wood', 'Tiles', 'Stripes'] as const;
export interface Appearance { wallColor: string; floorColor: string; wallDesign: typeof designs[number]; floorDesign: typeof designs[number] }
export const defaultAppearance: Appearance = { wallColor: colors.Cream, floorColor: colors.Sand, wallDesign: 'Plain', floorDesign: 'Wood' };
export function normalizeAppearance(value?: Partial<Appearance>): Appearance {
  return Object.fromEntries(Object.entries(defaultAppearance).map(([key, fallback]) => [key,
    (key.endsWith('Color') ? Object.values(colors) : designs).includes(value?.[key as keyof Appearance] as never) ? value![key as keyof Appearance] : fallback])) as unknown as Appearance;
}
