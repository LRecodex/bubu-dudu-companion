import { useEffect, useRef, useState } from 'react';
import { gameEvents } from './game/events';
import { accrue, buy, furniture, loadRoom, saveRoom, validPosition, type RoomSave, type Placement } from './game/furniture';

export function RoomControls() {
  const [save, setSave] = useState(() => accrue(loadRoom()));
  const current = useRef(save);
  const [placing, setPlacing] = useState<string>();
  const [message, setMessage] = useState('');
  function commit(next: RoomSave) {
    current.current = next; setSave(next);
    try { saveRoom(next); } catch { setMessage('Could not save room changes.'); }
    gameEvents.emit('furniture-layout', next.placed);
    window.companion.publishRoom(next);
  }
  useEffect(() => {
    const timer = setInterval(() => { const next = accrue(current.current); if (next !== current.current) commit(next); }, 1000);
    const ready = () => gameEvents.emit('furniture-layout', current.current.placed);
    const placed = (p: Placement) => {
      const item = furniture.find(f => f.id === p.id);
      if (!item || !current.current.owned.includes(p.id) || !validPosition(item, p.x, p.y)) return;
      commit({ ...current.current, placed: [...current.current.placed.filter(f => f.id !== p.id), p] });
      setPlacing(undefined);
    };
    const cancelled = () => setPlacing(undefined);
    const unsubscribe = window.companion.onRoomCommand(({ type, id }) => {
      if (type === 'sync') window.companion.publishRoom(current.current);
      if (type === 'buy' && id) commit(buy(accrue(current.current), id));
      if (type === 'place' && id && current.current.owned.includes(id)) { setPlacing(id); gameEvents.emit('place-furniture', id); }
      if (type === 'store' && id) { gameEvents.emit('place-furniture', undefined); setPlacing(undefined); commit({ ...current.current, placed: current.current.placed.filter(p => p.id !== id) }); }
      if (type === 'cancel') { gameEvents.emit('place-furniture', undefined); setPlacing(undefined); }
    });
    gameEvents.on('placement-cancelled', cancelled); gameEvents.on('room-ready', ready); gameEvents.on('furniture-placed', placed);
    ready();
    return () => { clearInterval(timer); unsubscribe(); gameEvents.off('placement-cancelled', cancelled); gameEvents.off('room-ready', ready); gameEvents.off('furniture-placed', placed); };
  }, []);
  return <>
    <button className="room-button" onClick={() => window.companion.openShop()} aria-label="Shop and inventory">Shop · {save.coins} coins</button>
    {(placing || message) && <div className="placement-hint">{placing ? 'Click a green spot in the room to place.' : message} <button onClick={() => { gameEvents.emit('place-furniture', undefined); setPlacing(undefined); setMessage(''); }}>Cancel</button></div>}
  </>;
}

export function ShopWindow() {
  const [save, setSave] = useState<RoomSave>();
  const [tab, setTab] = useState('Shop');
  useEffect(() => {
    const off = window.companion.onRoomState(setSave);
    window.companion.roomCommand({ type: 'sync' });
    return off;
  }, []);
  const command = (type: string, id?: string) => window.companion.roomCommand({ type, id });
  return <main className="shop-window">
    <header className="shop-heading"><h2>Your room</h2><button aria-label="Close shop" onClick={() => window.companion.closeShop()}>×</button></header>
    <nav>{['Shop', 'Inventory'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</nav>
    <p className="coin-balance">{save?.coins ?? '…'} coins · +5 per minute</p>
    <p className="shop-help">{tab === 'Shop' ? 'Pick something cozy for your room.' : 'Choose Place, then click a green spot in the room.'}</p>
    <div className="catalog">{save && furniture.filter(f => tab === 'Shop' || save.owned.includes(f.id)).map(f => {
      const owned = save.owned.includes(f.id), placed = save.placed.some(p => p.id === f.id);
      return <article key={f.id}><img src={`${import.meta.env.BASE_URL}assets/furniture/${f.id}.png`} alt="" /><div><strong>{f.name}</strong>
        {tab === 'Shop' ? <button disabled={owned || save.coins < f.price} onClick={() => command('buy', f.id)}>{owned ? 'Owned' : `${f.price} coins`}</button> : <><button onClick={() => command('place', f.id)}>{placed ? 'Move' : 'Place'}</button>{placed && <button onClick={() => command('store', f.id)}>Store</button>}</>}
      </div></article>;
    })}{save && tab === 'Inventory' && !save.owned.length && <p>Your inventory is empty. Visit the shop to get started.</p>}</div>
  </main>;
}
