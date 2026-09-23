# Changelog

All notable changes to Bubu Dudu Companion are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [0.1.4] - 2026-09-23

### Fixed

- Rugs can reach the front of the room, with footprint checks keeping them on the floor.
- Windows and doors fit both walls and automatically mirror to match the wall perspective.
- Fireplaces automatically face inward on the right side; wall decorations stay upright.
- Placement previews validate the current rotation immediately.

### Added

- Press F while placing floor furniture to flip its facing; orientation is saved.
- TV time, nap together, wake up, and surprise activity controls.
- Click Bubu or Dudu to pet them and see a floating heart.
- Scrollable activity menu for the compact companion window.
- Geometry and Electron regression checks for front-floor and both-wall placement.

## [0.1.3] - 2026-09-23

### Changed

- Removed the placement guide and built-in window and glass door.
- Right-click cancels placement; mouse scrolling rotates furniture in 15-degree steps with saved orientation.
- Added the shop Colors tab with six wall/floor colors and Plain, Wood, Tiles, and Stripes designs.
- Downloaded updates now ask before closing and installing, with Proceed to update and Later buttons.

## [0.1.2] - 2026-09-23

### Added

- Separate furniture shop and inventory, saved placements, and passive coin earnings.
- Automatic TV watching with shared sofa seating.

## [0.1.1] - 2026-09-23

### Changed

- Added the Bubu and Dudu artwork as the app, window, browser, executable, and installer icon.
- Updates are checked shortly after startup, downloaded automatically, and installed immediately when ready.

## [0.1.0] - 2026-09-23

### Added

- Animated Bubu and Dudu desktop companions with idle, walk, and sleep states.
- Shared food, hammer, and slap interactions.
- Transparent draggable desktop room with always-on-top and close controls.
- NSIS Windows installer with desktop and Start menu shortcuts.
- Background update checks backed by public GitHub Releases.
- Sprite preprocessing, validation, and runtime smoke-test tooling.

[0.1.1]: https://github.com/LRecodex/bubu-dudu-companion/releases/tag/v0.1.1
[0.1.0]: https://github.com/LRecodex/bubu-dudu-companion/releases/tag/v0.1.0

[0.1.3]: https://github.com/LRecodex/bubu-dudu-companion/releases/tag/v0.1.3
[0.1.2]: https://github.com/LRecodex/bubu-dudu-companion/releases/tag/v0.1.2

[0.1.4]: https://github.com/LRecodex/bubu-dudu-companion/releases/tag/v0.1.4
