# Bubu Dudu Companion

A tiny animated desktop companion starring Bubu (white) and Dudu (brown). They wander, nap, and play together in a transparent room near the corner of your Windows desktop.

## Install

Download `Bubu-Dudu-Companion-Setup-*.exe` from the [latest release](https://github.com/LRecodex/bubu-dudu-companion/releases/latest), run it, and follow the prompts. The app checks for updates after launch and every four hours; downloaded updates install after the app exits.

> Windows may show a SmartScreen warning because the installer is not currently code-signed. Verify that it came from this repository's Releases page before continuing.

## Development

Requires Node.js 22.12+ and npm. From `C:\Users\FauzulAzim\Documents\BDC`:

```powershell
npm.cmd ci
npm.cmd run dev
```

`npm run dev` also works; `npm.cmd` avoids PowerShell npm shim argument issues. electron-vite starts Vite and a transparent, frameless 280x320 companion window near the bottom-right of the screen. Only the room, characters, shadow and small move handle are visible. Drag the handle below the room to move it. Right-click the room and choose **Quit BDC**, or use Alt+F4 while focused. React mounts the game and Phaser owns the room and animations. Bubu is on the left, Dudu on the right. Each wanders on its own across the whole floor: idling, walking anywhere on the boards, or curling up asleep, picked at random. They keep clear of each other and stay inside the diamond, which narrows towards its front and back corners, and shrink slightly towards the back of the room for perspective. Walking picks one of three sheets from the direction actually travelled: `walk-side` for mostly horizontal travel, mirrored to walk left, and `walk-front` or `walk-back` along the room's depth. The toolbar under the room holds the move handle, settings, and a play button that opens the three two-character interactions (share food, hammer, slap); one plays over the pair and then hands the room back to them.

The reference-inspired room is temporary Phaser geometry in `src/game/scenes/temporaryRoom.ts`: a raised diamond floor, two walls, a window and a glass panel. Replace that drawing with your room artwork later. Character size and ground position are set in `src/game/config.ts`. Window size is in `electron/main.ts`; the tightly cropped Phaser viewport is 440x500. Native resizing is disabled for transparent-window compatibility. The window is not always-on-top, and its transparent margins are not click-through. Restart `npm run dev` after changing Electron window options.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd start
```

`smoke` runs after `build`, opens the actual Electron app, checks both animation loops, plays all three interactions through to completion, checks renderer errors, compact window size and security settings, toggles Always on top on/off, and exits using Close app. Screenshots go to ignored `runtime-debug/`. `start` opens the built app.

Create an NSIS installer with `npm.cmd run dist:win`. Artifacts are written to `release/`; the installer, blockmap, and `latest.yml` must remain attached to a public GitHub Release for automatic updates.

The existing sprite tools remain their own package. On a fresh checkout, run `npm.cmd --prefix tools ci` before tests/type checks or preprocessing. Runtime code reads generated JSON metadata and only loads processed sprites from `public/assets/characters/`.

Main files: `electron/main.ts` (window/security), `electron.vite.config.ts` (build/dev), `src/App.tsx` (React UI), `src/game/PhaserGame.tsx` (lifecycle), `src/game/scenes/RoomScene.ts` (temporary room, the random wander loop and interaction playback), `src/game/config.ts` (animation lists, room geometry and display scaling), and `src/game/events.ts` (the one React-to-Phaser channel). A restricted preload bridge exposes only reading/changing Always on top and closing the app; renderer Node access remains disabled.

Click the gear beside the move handle to open Settings. **Always on top** applies immediately and lasts until you quit; it defaults to off on a fresh launch. **Close app** quits BDC. Close the panel using its × button or Escape. Restart the development app after updates to the main process or preload.

The standalone sprite preprocessing package lives in [tools/](tools/). See the [sprite preprocessing guide](docs/sprite-preprocessing.md) for setup, adding new animations, debugging, configuration, and Phaser usage.

From this directory:

```powershell
npm.cmd --prefix tools run sprites
npm.cmd --prefix tools run sprites -- --debug
```

Original artwork stays in `assets/`. Game-ready PNGs and metadata are generated in `public/assets/characters/`; diagnostics go to `sprite-debug/`. The reference image is never processed as a sprite sheet.

## Release process

Update the version in `package.json` and `package-lock.json`, add notes to `CHANGELOG.md`, then commit and tag `v<version>`. Run `npm.cmd run dist:win` and attach the generated artifacts to the public release. `npm.cmd run release:win` can publish directly when a suitable `GH_TOKEN` is available.

## License

[MIT](LICENSE)
