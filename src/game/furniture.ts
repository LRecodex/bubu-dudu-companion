export const furniture = ['Rug', 'Plant', 'Window', 'Door', 'Fireplace'].flatMap((category, row) =>
  Array.from({ length: 5 }, (_, variant) => ({
    id: `row-${row + 1}-variant-${variant + 1}`, name: `${category} ${variant + 1}`,
    category, price: [30, 40, 60, 70, 100][row] + variant * 10,
    width: [100, 48, 90, 64, 88][row], wall: row === 2 || row === 3,
  })));
export type Furniture = typeof furniture[number];
export interface Placement { id: string; x: number; y: number }
// A compact seating corner aligned along the room's NE/SW axis.
// Shared footprints keep roaming and decoration placement in sync with artwork.
export const lounge = {
  tv: { x: 705, y: 402, scale: .48, halfWidth: 51, halfDepth: 24 },
  sofa: { x: 623, y: 450, scale: .48, halfWidth: 52, halfDepth: 22 },
};
export function inLounge(x: number, y: number, padding = 0) {
  return Object.values(lounge).some(f => Math.abs(x - f.x) < f.halfWidth + padding && Math.abs(y - (f.y - 8)) < f.halfDepth + padding);
}
export interface RoomSave { coins: number; earnedAt: number; owned: string[]; placed: Placement[] }
const key = 'bdc-room-v1';
export const coinInterval = 60_000;
export function loadRoom(): RoomSave {
  const fresh = { coins: 150, earnedAt: Date.now(), owned: [], placed: [] };
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || !Number.isSafeInteger(value.coins) || value.coins < 0 || !Number.isFinite(value.earnedAt) || !Array.isArray(value.owned) || !Array.isArray(value.placed)) return fresh;
    const owned = [...new Set<string>(value.owned.filter((id: unknown) => furniture.some(f => f.id === id)))];
    const placed = value.placed.filter((p: Placement, index: number, all: Placement[]) => p && owned.includes(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y) && all.findIndex(q => q?.id === p.id) === index);
    return { coins: value.coins, earnedAt: Math.min(Date.now(), value.earnedAt), owned, placed };
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
export function validPosition(item: Furniture, x: number, y: number) {
  if (item.wall) return x >= 485 && x <= 606 && y >= 300 && y <= 385 && Math.abs(y - (655 - x * .577)) < 38;
  if (Math.abs(x - 640) / 190 + Math.abs(y - 450) / 110 > .72) return false;
  if (item.category === 'Rug') return true;
  return !inLounge(x, y, 8);
}
