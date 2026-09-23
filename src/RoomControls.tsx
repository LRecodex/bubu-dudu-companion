import { useEffect, useRef, useState } from 'react';
import { gameEvents } from './game/events';
import { accrue, buy, furniture, loadRoom, saveRoom, validPosition, type RoomSave, type Placement, colors, designs, normalizeAppearance } from './game/furniture';

export function RoomControls() {
  const [save, setSave] = useState(() => accrue(loadRoom()));
  const current = useRef(save);
  const [message, setMessage] = useState('');
  function commit(next: RoomSave) {
    current.current = next; setSave(next);
    try { saveRoom(next); } catch { setMessage('Could not save room changes.'); }
    gameEvents.emit('furniture-layout', next.placed);
    gameEvents.emit('room-appearance', normalizeAppearance(next.appearance));
    window.companion.publishRoom(next);
  }
  useEffect(() => {
    const timer = setInterval(() => { const next = accrue(current.current); if (next !== current.current) commit(next); }, 1000);
    const ready = () => { gameEvents.emit('furniture-layout', current.current.placed); gameEvents.emit('room-appearance', normalizeAppearance(current.current.appearance)); };
    const placed = (p: Placement) => {
      const item = furniture.find(f => f.id === p.id);
      if (!item || !current.current.owned.includes(p.id) || !validPosition(item, p.x, p.y)) return;
      commit({ ...current.current, placed: [...current.current.placed.filter(f => f.id !== p.id), p] });

    };
    const unsubscribe = window.companion.onRoomCommand(({ type, id }) => {
      if (type === 'appearance' && id) { const [key, value] = id.split(':'); commit({ ...current.current, appearance: normalizeAppearance({ ...normalizeAppearance(current.current.appearance), [key]: value }) }); }
      if (type === 'sync') window.companion.publishRoom(current.current);
      if (type === 'buy' && id) commit(buy(accrue(current.current), id));
      if (type === 'place' && id && current.current.owned.includes(id)) {  gameEvents.emit('place-furniture', id); }
      if (type === 'store' && id) { gameEvents.emit('place-furniture', undefined);  commit({ ...current.current, placed: current.current.placed.filter(p => p.id !== id) }); }
      if (type === 'cancel') { gameEvents.emit('place-furniture', undefined);  }
    });
    gameEvents.on('room-ready', ready); gameEvents.on('furniture-placed', placed);
    ready();
    return () => { clearInterval(timer); unsubscribe(); gameEvents.off('room-ready', ready); gameEvents.off('furniture-placed', placed); };
  }, []);
  return <>
    <button className="room-button" onClick={() => window.companion.openShop()} aria-label="Shop and inventory">Shop · {save.coins} coins</button>
    {message && <div className="placement-hint" role="alert">{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
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
    <nav>{['Shop', 'Inventory', 'Colors'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</nav>
    <p className="coin-balance">{save?.coins ?? '…'} coins · +5 per minute</p>
    <p className="shop-help">{tab === 'Shop' ? 'Pick something cozy for your room.' : tab === 'Inventory' ? 'Click to place ? Scroll to rotate ? Right-click to cancel.' : 'Choose wall and floor finishes. All colors and designs are free.'}</p>
    {tab === 'Colors' && save && <div className="catalog finishes">{(['wall', 'floor'] as const).map(surface => <section key={surface}><h3>{surface === 'wall' ? 'Wall' : 'Floor'} color</h3><div className="swatches">{Object.entries(colors).map(([name, color]) => <button key={name} title={name} aria-label={`${surface} ${name}`} aria-pressed={normalizeAppearance(save.appearance)[`${surface}Color`] === color} style={{ background: color }} onClick={() => command('appearance', `${surface}Color:${color}`)} />)}</div><h3>{surface === 'wall' ? 'Wall' : 'Floor'} design</h3><div className="designs">{designs.map(design => <button key={design} aria-pressed={normalizeAppearance(save.appearance)[`${surface}Design`] === design} onClick={() => command('appearance', `${surface}Design:${design}`)}>{design}</button>)}</div></section>)}</div>}
    <div className="catalog" hidden={tab === 'Colors'}>{save && furniture.filter(f => tab === 'Shop' || save.owned.includes(f.id)).map(f => {
      const owned = save.owned.includes(f.id), placed = save.placed.some(p => p.id === f.id);
      return <article key={f.id}><img src={`${import.meta.env.BASE_URL}assets/furniture/${f.id}.png`} alt="" /><div><strong>{f.name}</strong>
        {tab === 'Shop' ? <button disabled={owned || save.coins < f.price} onClick={() => command('buy', f.id)}>{owned ? 'Owned' : `${f.price} coins`}</button> : <><button onClick={() => command('place', f.id)}>{placed ? 'Move' : 'Place'}</button>{placed && <button onClick={() => command('store', f.id)}>Store</button>}</>}
      </div></article>;
    })}{save && tab === 'Inventory' && !save.owned.length && <p>Your inventory is empty. Visit the shop to get started.</p>}</div>
  </main>;
}
