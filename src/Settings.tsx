import { useEffect, useRef, useState } from 'react';

export function Settings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [onTop, setOnTop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  async function open() {
    dialog.current?.showModal();
    setError('');
    setBusy(true);
    try { setOnTop(await window.companion.getAlwaysOnTop()); }
    catch { setError('Settings unavailable. Please restart BDC.'); }
    finally { if (active.current) setBusy(false); }
  }
  async function toggle(value: boolean) {
    setBusy(true);
    setError('');
    try { setOnTop(await window.companion.setAlwaysOnTop(value)); }
    catch { setError('Could not change Always on top.'); }
    finally { if (active.current) setBusy(false); }
  }

  return <>
    <button className="settings-button" aria-label="Settings" title="Settings" onClick={() => void open()}>⚙</button>
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title">
      <div className="settings-heading">
        <h2 id="settings-title">Settings</h2>
        <button aria-label="Close settings" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className="setting-toggle">
        <span>Always on top</span>
        <button className="top-switch" role="switch" aria-label="Always on top" aria-checked={onTop} disabled={busy} onClick={() => void toggle(!onTop)}>{onTop ? 'On' : 'Off'}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="quit-button" onClick={() => {
        void window.companion.close().catch(() => setError('Could not close BDC. Try Alt+F4.'));
      }}>Close app</button>
    </dialog>
  </>;
}
