# Room furniture

The room opens at 280×320. Click **Shop** on its toolbar to open the shop and inventory in a separate 300×460 window beside the room. It follows the room and chooses the left side when there is insufficient space on the right. Current coins appear in both windows and update together.

TV watching is automatic, alongside idle, walking, and sleeping. Each character independently chooses to watch and stays for 14–24 seconds; joining is more likely when the other is watching. The default is an empty sofa and a switched-off TV. Bubu is the white character (sofa frame 1), Dudu is brown (frame 2), and frame 3 seats both. Leaving the last seat switches the TV off. Other pair interactions end TV watching before playing.

New rooms start with 150 coins. Earn 5 coins per minute, including up to 8 hours away. Coins, purchases, and placements are saved locally on this device. Each variant can be purchased once, moved, and stored without losing ownership. TV watching is temporary and resets on launch.

In Inventory, choose Place or Move, then click a green location in the room. Red indicates an invalid or occupied position. Windows and doors go on the left wall; other objects go on the floor. Rugs can sit beneath furniture. Cancel or Escape exits placement. The TV and sofa remain a fixed facing pair.

## Importing the 5×5 sheet

No separate desktop app is needed. Grid extraction is the same preprocessing concept, but a catalog treats each cell as an independent object, not as animation frames. This project includes a reusable command-line importer:

```powershell
npm.cmd run import:furniture
# Generic form: source, destination, columns, rows, optional row boundaries
node scripts/import-furniture.mjs source.png public/assets/new-furniture 5 5
```

The supplied sheet uses adjusted row boundaries because its objects are hand-spaced. The importer produces transparent PNGs and a catalog manifest, preserving the source. It respects existing transparency and keeps the largest connected object per cell to exclude neighboring-row fragments. For opaque inputs it can remove the outside background using closed dark outlines. This importer targets single connected illustrations; detached pieces need a different extraction strategy. Inspect outputs before adding a different sheet.

Rows map to rugs, plants, windows, doors, and fireplaces; columns are five purchasable variants. Names, prices, displayed sizes, and placement rules live in `src/game/furniture.ts`. New sheets require adding their entries there. The existing standalone sprite preprocessor remains suitable for animated TV/sofa sheets and transparent grids.

Validation: `npm.cmd run build`, `npm.cmd run smoke`, and `npm.cmd run smoke:room`. The room smoke test restores the previous room save after testing.
