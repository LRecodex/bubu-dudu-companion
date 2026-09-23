import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { gameConfig } from './config';
import { RoomScene } from './scenes/RoomScene';

export function PhaserGame() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // A private mount node prevents deferred Phaser destruction from touching a
    // newer instance's canvas during StrictMode or React Fast Refresh cleanup.
    const mount = document.createElement('div');
    mount.className = 'game-host';
    host.current!.appendChild(mount);
    let game: Phaser.Game | undefined;
    let active = true;
    const startup = requestAnimationFrame(() => {
      if (!active) return;
      setError(undefined);
      game = new Phaser.Game(gameConfig(mount, new RoomScene(message => { if (active) setError(message); })));
    });
    return () => {
      active = false;
      cancelAnimationFrame(startup);
      game?.destroy(true);
      mount.remove();
    };
  }, []);

  return <section className="game-container" ref={host} aria-label="Bubu and Dudu's room">
    {error && <div className="game-error" role="alert">{error}</div>}
  </section>;
}
