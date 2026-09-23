import { useEffect, useRef, useState } from 'react';
import { interactions, type Interaction } from './game/config';
import { gameEvents, onInteractionState, playInteraction } from './game/events';

export function Actions() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  // The scene owns whether a scene is running, so the menu cannot start a
  // second one on top of the first.
  useEffect(() => onInteractionState(setBusy), []);

  function play(key: Interaction) {
    dialog.current?.close();
    playInteraction(key);
  }

  return <>
    <button className="action-button" aria-label="Play an interaction" title="Play an interaction"
      disabled={busy} onClick={() => dialog.current?.showModal()}>▶</button>
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="actions-title">
      <div className="settings-heading">
        <h2 id="actions-title">Interactions</h2>
        <button aria-label="Close interactions" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="action-list">
        {interactions.map(({ key, label }) =>
          <button key={key} className="action-item" onClick={() => play(key)}>{label}</button>)}
        {([['tv', 'TV time / stop TV'], ['nap', 'Nap together'], ['wake', 'Wake up'], ['surprise', 'Surprise me!']] as const).map(([key, label]) =>
          <button key={key} className="action-item" onClick={() => { dialog.current?.close(); gameEvents.emit('room-activity', key); }}>{label}</button>)}
        <p>Click Bubu or Dudu in the room to give them a heart.</p>
      </div>
    </dialog>
  </>;
}
