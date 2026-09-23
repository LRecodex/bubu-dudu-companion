# BDC sprite preprocessing

Dudu is the brown character; Bubu is the white character. Original artwork lives in `assets/` and is never written by the tool. `assets/reference/` is always excluded and is only a design reference. Single-character animations live in `assets/bubu/` and `assets/dudu/`; two-character interactions live in `assets/bubu-dudu-interact/` and are treated as one more character directory, because each frame is a single scene rather than two sprites.

The tooling is a standalone npm package in `BDC/tools/`. Its scripts, dependencies, TypeScript setup, and `sprite.config.ts` live there, leaving the BDC root available for the companion app. Source assets, generated game assets, and debug images remain relative to the BDC root.

## First-time setup

Requires Node.js 22 or newer. In PowerShell:

```powershell
cd C:\Users\FauzulAzim\Documents\BDC\tools
npm.cmd ci
```

## Each time you have a new animation

1. Save an animation as `assets/bubu/walk-6-frame.png` (or under `assets/dudu/`).
2. From `BDC/tools/`, run `npm.cmd run sprites`.
3. Use `public/assets/characters/bubu/walk.png` and its adjacent `walk.json`.

For example, a new `BDC/assets/dudu/run-8-frame.png` produces `BDC/public/assets/characters/dudu/run.png` and `run.json`. The frame count comes from the filename; no `--frames` argument is needed. Do not save source images under `tools/assets`.

## Choosing a filename: automatic or grid layout

The filename selects how frames are found in the sheet.

| Filename | Layout | Use it when |
| --- | --- | --- |
| `<animation>-<frames>-frame.png` | automatic | one character per frame, frames separated by clear transparent gaps |
| `<animation>-<columns>x<rows>-frame.png` | grid | any sheet laid out on a grid, and every sheet where a frame holds more than one character |

`walk-6-frame.png` is automatic: the tool discovers the frames and reports a mismatch if it does not find six. `share-food-4x2-frame.png` is a grid of four columns and two rows, so eight frames, read left to right and then top to bottom. A single-row interaction still declares its grid: `bubu-hammer-6x1-frame.png`.

Automatic layout finds frames by projecting artwork onto columns, which cannot tell the gap *between* two frames from the gap between two characters drawn apart *inside* one frame, and cannot see rows at all. So every sheet in `assets/bubu-dudu-interact/` uses the grid form, even the single-row ones — a detached prop or a swing effect sitting in the space between frames would otherwise become a frame of its own.

Grid mode does not slice into equal rectangles. Each cut starts at its even position, then slides up to `gridTolerance` of one cell to land on the widest transparent gap it can reach. That keeps hand-spaced frames intact, keeps a detached prop with the frame it belongs to, and keeps a separated character pair together. Where two frames genuinely touch, the cut instead falls where the least artwork runs continuously across it. Both characters in a frame are scaled and ground-aligned together as one scene, so their relative size and footing are preserved.

Run these commands from `BDC/tools/`:

```powershell
npm.cmd run sprites
npm.cmd run sprites -- bubu/walk-6-frame.png
npm.cmd run sprites -- dudu/run-8-frame.png
npm.cmd run sprites -- bubu-dudu-interact/share-food-4x2-frame.png
npm.cmd run sprites -- --debug
npm.cmd run sprites -- bubu/idle-6-frame.png --debug
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify
```

Alternatively, stay in the BDC root and target the tool package:

```powershell
npm.cmd --prefix tools run sprites
npm.cmd --prefix tools run sprites -- --debug
npm.cmd --prefix tools run sprites -- bubu/idle-6-frame.png
```

`npm` also works in shells that forward arguments correctly. These examples use `npm.cmd` because this machine's npm PowerShell shim dropped arguments after `--`. The companion app now has a root package with a `sprites` shortcut; `npm.cmd run sprites` from BDC also delegates to this tool. The explicit `--prefix tools` commands above work independently of that shortcut.

The optional `verify.ts` command checks the two original idle assets after a debug run: output dimensions, exact frame-to-sheet pixels, all twelve baselines, and original source hashes. It is a check of the initial supplied artwork, so its hash assertions intentionally fail if those sources are later replaced.

## Configuration and detection

Edit `tools/sprite.config.ts` for frame dimensions, padding, baseline, alpha threshold, noise threshold, detachment gap, grid tolerance, paths, and allowed character directories. All configured paths resolve from the BDC root regardless of your working directory. Filenames must match `<animation>-<positive frame count>-frame.png` or `<animation>-<columns>x<rows>-frame.png`. Only files directly inside configured character directories are scanned. Add new character directory names to `characters`; `bubu`, `dudu` and `bubu-dudu-interact` are configured.

Detection uses pixels with alpha **greater than** `alphaThreshold` (default 10). Eight-connected components smaller than `noiseThreshold` (default 12 pixels) are excluded from detection. In automatic layout the retained components are grouped into separated horizontal regions, which become frame bounds in left-to-right order; the frame count is discovered, never assumed. In grid layout the sheet is split into rows first, then each row band is split into columns using only that band's artwork, so an overlapping pose in one row cannot fill in another row's gaps. `gridTolerance` (default 0.35) is how far a cut may slide from its even position, as a fraction of one cell.

Within each frame, a component whose top sits more than `detachmentGap` (default 0.15) of the dominant component's height **below** that component's bottom is treated as a source artifact rather than artwork, and is left out of the frame bounds. This is what keeps a faint stray smudge from dragging a frame's ground contact down and floating the drawing above the baseline. Detached artwork *above* the body — motion lines, hearts, sweat drops — is always kept, since it cannot affect ground alignment. Dropped pixels are reported in the run summary and outlined in orange in the debug overlay.

Noise filtering and detachment affect detection only; pixels inside a crop are not repainted or erased.

Each animation gets whatever scale it needs to fill the frame, so the scales differ widely: `dudu/idle` lands at 0.57, its curled-up `sleep` at 0.83, and `share-food`, which has to fit two characters, at 0.46. Drawing every sheet at one fixed game scale would therefore make a sleeping character *larger* than a standing one, and an interaction half-size. The emitted `scale` is what avoids that: divide a chosen on-screen size by it, as `displayScale` in `src/game/config.ts` does, and every sheet renders its *artwork* at the same size on screen.

That is not quite the same as every *character* looking the same size, because the source sheets themselves are not all drawn at one scale - the sleep artwork and the two-character scenes are drawn smaller than the standing poses. `sizeFactors` in `src/game/config.ts` corrects for that, with `idle` as the reference. Those values are set by eye: no automatic measure survives the pose changes, and outline stroke width, the obvious candidate, disagrees with itself across two standing sheets of the same character. If a new sheet turns out to be drawn at a different scale, add an entry there rather than changing the preprocessing.

Every animation uses one common scale, constrained by its widest and tallest frames. Resizing preserves aspect ratio; integer rounding may introduce a one-pixel size difference. Frames are horizontally centered on transparent 256×256 canvases. The lowest meaningful resized pixel lands on row **236**, inclusive; frames are not vertically centered. The top and sides have at least 20 pixels of padding. Six-frame sheets are 1536×256, eight-frame sheets 2048×256, and four-frame sheets 1024×256.

Ground alignment preserves pose changes and relative frame sizes, but intentionally removes absolute vertical translation from source placement. Alpha alone cannot distinguish a jump from inconsistent source padding. Likewise, horizontal centering removes source translation, and cannot correct size changes already drawn into the artwork. Animations needing intentional airborne movement should apply motion in the game or use a future explicit anchor/offset workflow.

Touching frames, opaque backgrounds, large detached effects, or a disconnected feature extending beyond a body's horizontal range can make automatic detection ambiguous. The tool reports a count mismatch instead of guessing, and the error suggests the grid filename. Adjust detection thresholds only after inspecting debug output. A meaningful connected bridge cannot be removed by the small-component filter.

Grid layout always produces the declared number of frames, so a bad cut shows up as clipped artwork rather than a count mismatch: check `detection.png`. Where neighbouring frames overlap horizontally with no empty column between them anywhere — as the last two frames of `dudu-slap` do — no vertical cut is clean, and a couple of source columns of one frame remain in the next. Erase the overlap in the source if it is visible at output scale.

## Debugging and failures

`--debug` writes `sprite-debug/<character>/<animation>/detection.png`, `detection.json`, and normalized `frame-0.png` through `frame-N.png`. Magenta boxes and numbers show source frame order; cyan lines mark each source bottom; dashed yellow lines show the grid cuts actually used; dashed orange boxes mark components dropped as detached artifacts. The header records detection count, ignored pixels, dropped detached pixels and target baseline. JSON records exact source bounds. Frame PNGs are the actual transparent game frames.

Count mismatches always write detection diagnostics, even without `--debug`. They do not generate or replace the final PNG/JSON. Other assets continue processing, a summary is printed, and any failure produces a nonzero exit code. A previous successful output remains on disk after a failed run; it is not evidence that the current source succeeded. Debug directories may retain files from prior runs if frame counts change.

## Phaser

```ts
this.load.spritesheet('bubu-idle', '/assets/characters/bubu/idle.png', {
  frameWidth: 256,
  frameHeight: 256,
});
this.load.spritesheet('dudu-idle', '/assets/characters/dudu/idle.png', {
  frameWidth: 256,
  frameHeight: 256,
});
this.load.spritesheet('share-food', '/assets/characters/bubu-dudu-interact/share-food.png', {
  frameWidth: 256,
  frameHeight: 256,
});
```

An interaction loads exactly like a single character: the grid only describes the source sheet, and the output is always one horizontal strip. A `4x2` source becomes an eight-frame 2048x256 sheet whose frames run in the source's reading order.

A character's sheets are `idle`, `walk-front`, `walk-back`, `walk-side` and `sleep`. Only one side view is drawn, facing right; the game mirrors it to walk left, which is what `sideFacesRight` in `src/game/config.ts` records. Mirroring only works because the view is a true profile - it cannot fake a profile from a head-on sheet.

Frames are numbered left-to-right starting at zero. Each adjacent JSON file contains character, animation, frame dimensions/count, sheet dimensions, the `scale` used, and `baselineY`. Scale is shared within an animation, not across separate animations, which is exactly why it is written out: the game divides its chosen on-screen pixel size by `scale` so every animation renders consistently, and anchors `baselineY` to the floor so feet stay planted.


Command is identical — nothing about the CLI changed:

npm.cmd run sprites -- bubu/walk-6-frame.png
npm.cmd run sprites                              # everything, including the interact folder
npm.cmd run sprites -- bubu-dudu-interact/share-food-4x2-frame.png

But to be precise about "auto detect": the layout mode is not auto-detected — the filename picks it. Everything within that mode is automatic.

┌───────────────────────────────────────────────────┬─────────────────────────────────┐
│                       What                        │           Automatic?            │
├───────────────────────────────────────────────────┼─────────────────────────────────┤
│ Where the frames sit, gap widths, uneven spacing  │ yes                             │
├───────────────────────────────────────────────────┼─────────────────────────────────┤
│ Smudges / stray specks dragging the baseline      │ yes, dropped                    │
├───────────────────────────────────────────────────┼─────────────────────────────────┤
│ Motion lines, hearts, props kept with their frame │ yes                             │
├───────────────────────────────────────────────────┼─────────────────────────────────┤
│ Scale, centering, ground alignment                │ yes                             │
├───────────────────────────────────────────────────┼─────────────────────────────────┤
│ Whether the sheet is a grid or a single row       │ no — you say so in the filename │
└───────────────────────────────────────────────────┴─────────────────────────────────┘

So the only decision you make each time is what to name the file:

- One character per frame, clear gaps → walk-6-frame.png (unchanged, exactly as before)
- Two characters in a frame, or multiple rows → share-food-4x2-frame.png, bubu-hammer-6x1-frame.png

Rule of thumb: anything going into assets/bubu-dudu-interact/ gets the CxR form, even when it's a single row. Anything going into assets/bubu/ or assets/dudu/ keeps the plain -N-frame form.

I left it explicit rather than guessing because the two cases are genuinely ambiguous from pixels alone — a gap between two frames and a gap between two characters inside one frame look identical to the detector. If you get the name wrong, it fails loudly rather than producing bad sprites: the frame-count mismatch error now tells you to try the grid form, and writes sprite-debug/<character>/<animation>/detection.png so you can see what it found.
