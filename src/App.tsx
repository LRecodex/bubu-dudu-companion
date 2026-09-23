import { PhaserGame } from './game/PhaserGame';
import { Settings } from './Settings';
import { Actions } from './Actions';

export default function App() {
  return <main>
    <PhaserGame />
    <div className="toolbar">
      <div className="move-handle" title="Drag to move the room. Right-click the room to quit." aria-label="Drag to move the room">✥</div>
      <Settings />
      <Actions />
    </div>
  </main>;
}
