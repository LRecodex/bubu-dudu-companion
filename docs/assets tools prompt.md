I am starting a desktop companion project called BDC.

The project root is:

C:\Users\FauzulAzim\Documents\BDC

I already have these character assets:

C:\Users\FauzulAzim\Documents\BDC\assets\bubu\idle-6-frame.png
C:\Users\FauzulAzim\Documents\BDC\assets\dudu\idle-6-frame.png

I also have the canonical character reference image:

C:\Users\FauzulAzim\Documents\BDC\assets\reference\Bubu dudu reference.png

IMPORTANT CHARACTER IDENTITY:

- Dudu = brown character
- Bubu = white character

Do not rename or swap them.

The reference image is for visual/design reference only and must NOT be
processed as a sprite sheet.

I want you to create a reusable automatic sprite-sheet preprocessing
system for this project.

Use:
- Node.js
- TypeScript
- Sharp

Do NOT use Python.

The application will eventually use:
- Electron
- React
- TypeScript
- Phaser

==================================================
CURRENT ASSET STRUCTURE
==================================================

Use the existing assets directory as the SOURCE directory.

Current structure:

assets/
  bubu/
    idle-6-frame.png

  dudu/
    idle-6-frame.png

  reference/
    Bubu dudu reference.png

Future assets will follow the same structure:

assets/
  bubu/
    idle-6-frame.png
    walk-6-frame.png
    run-8-frame.png
    sleep-6-frame.png
    sit-4-frame.png

  dudu/
    idle-6-frame.png
    walk-6-frame.png
    run-8-frame.png
    sleep-6-frame.png
    sit-4-frame.png

Do NOT overwrite the original source assets.

==================================================
OUTPUT
==================================================

Processed game-ready assets should go into:

public/assets/characters/

For example:

assets/bubu/idle-6-frame.png

becomes:

public/assets/characters/bubu/idle.png


assets/dudu/idle-6-frame.png

becomes:

public/assets/characters/dudu/idle.png


Eventually:

assets/bubu/walk-6-frame.png
→ public/assets/characters/bubu/walk.png

assets/dudu/run-8-frame.png
→ public/assets/characters/dudu/run.png

==================================================
FILENAME CONVENTION
==================================================

Source filenames use:

<animation>-<frameCount>-frame.png

Examples:

idle-6-frame.png
walk-6-frame.png
run-8-frame.png
sit-4-frame.png

The parent directory determines the character:

assets/bubu/idle-6-frame.png
character = bubu
animation = idle
frames = 6

assets/dudu/run-8-frame.png
character = dudu
animation = run
frames = 8

Automatically parse this information.

This means I should NOT normally need to provide --frames manually.

The frame count should come from the filename.

==================================================
PROCESSING GOAL
==================================================

The existing AI-generated sprite sheets contain multiple character
frames horizontally.

However:

- spacing may not be perfectly equal
- transparent padding may vary
- characters may not be perfectly centered
- character dimensions may vary slightly
- feet/baselines may not align perfectly

DO NOT simply divide sourceWidth by frameCount.

Instead detect each character using transparency/alpha information.

Processing algorithm:

1. Load PNG using Sharp.
2. Inspect alpha channel.
3. Detect meaningful non-transparent horizontal regions.
4. Ignore tiny stray pixels/noise.
5. Find the bounding box for each detected character.
6. Sort frames left-to-right.
7. Validate detected count against the count from filename.
8. Crop each detected frame.
9. Trim transparent padding.
10. Calculate ONE common scale for the entire animation.
11. Preserve aspect ratio.
12. Never independently stretch frames.
13. Put every character onto an identical transparent frame.
14. Horizontally center each character.
15. Align feet/bottom to a common baseline.
16. Compose all normalized frames horizontally.
17. Save as transparent PNG.

==================================================
STANDARD OUTPUT FRAME
==================================================

Use:

frameWidth = 256
frameHeight = 256
padding = 20
baselineY = 236

Therefore:

6 frames:
1536x256

8 frames:
2048x256

4 frames:
1024x256

Characters must remain proportionally scaled.

Do NOT make every frame independently fill the available space.

Calculate a common scale factor across the entire animation so the
character does not appear to grow/shrink between frames.

==================================================
ALPHA DETECTION
==================================================

Use configurable alpha detection.

Suggested default:

alphaThreshold = 10

Ignore tiny disconnected opaque regions that are likely image noise.

Do not assume pixels are either alpha 0 or alpha 255.

==================================================
IMPORTANT: BASELINE STABILITY
==================================================

Animation must not jitter vertically.

Align the lowest meaningful character pixel in each frame to:

baselineY = 236

Do NOT vertically center each frame independently.

The feet should appear to remain on the same ground position.

Intentional animation movement should still be preserved where possible.

==================================================
CONFIGURATION
==================================================

Create:

sprite.config.ts

with defaults approximately:

{
  frameWidth: 256,
  frameHeight: 256,
  padding: 20,
  baselineY: 236,
  alphaThreshold: 10,
  noiseThreshold: sensibleDefault,

  sourceDirectory: "assets",
  outputDirectory: "public/assets/characters",
  debugDirectory: "sprite-debug"
}

The tool should only scan character directories.

At minimum:

assets/bubu/
assets/dudu/

DO NOT process:

assets/reference/

The reference directory must always be ignored.

Make the list of character directories configurable so more characters
could be added later.

==================================================
COMMAND
==================================================

Add:

npm run sprites

Running this should automatically scan:

assets/bubu/
assets/dudu/

and process every matching:

*-<number>-frame.png

For example:

npm run sprites

should currently discover:

assets/bubu/idle-6-frame.png
assets/dudu/idle-6-frame.png

and generate:

public/assets/characters/bubu/idle.png
public/assets/characters/dudu/idle.png

Also allow:

npm run sprites -- bubu/idle-6-frame.png

and:

npm run sprites -- dudu/idle-6-frame.png

for processing a single asset.

==================================================
DEBUG MODE
==================================================

Support:

npm run sprites -- --debug

Generate useful debug output under:

sprite-debug/

For example:

sprite-debug/
  bubu/
    idle/
      detection.png
      frame-0.png
      frame-1.png
      frame-2.png
      frame-3.png
      frame-4.png
      frame-5.png

  dudu/
    idle/
      detection.png
      frame-0.png
      frame-1.png
      frame-2.png
      frame-3.png
      frame-4.png
      frame-5.png

detection.png should make it easy to inspect:

- detected bounding boxes
- detected frame order
- baseline
- relevant detection information

==================================================
VALIDATION
==================================================

The filename defines expected frame count.

Example:

idle-6-frame.png

means exactly 6 frames must be detected.

If only 5 are detected:

DO NOT silently produce the final asset.

Print:

ERROR: assets/bubu/idle-6-frame.png

Expected frames: 6
Detected frames: 5

Possible causes:
- two frames touching
- transparent separation not detected
- stray pixels connecting frames
- source image does not contain 6 frames

Still generate debug information when possible.

When processing multiple assets, continue with other assets and print a
summary.

Example:

Sprite preprocessing complete

✓ bubu/idle-6-frame.png    6/6
✓ dudu/idle-6-frame.png    6/6

2 succeeded
0 failed

==================================================
METADATA
==================================================

Generate metadata beside each processed PNG.

Example:

public/assets/characters/bubu/idle.json

{
  "character": "bubu",
  "animation": "idle",
  "frameWidth": 256,
  "frameHeight": 256,
  "frameCount": 6,
  "sheetWidth": 1536,
  "sheetHeight": 256
}

And:

public/assets/characters/dudu/idle.json

==================================================
PHASER COMPATIBILITY
==================================================

The resulting sheet must work directly with:

this.load.spritesheet(
  "bubu-idle",
  "/assets/characters/bubu/idle.png",
  {
    frameWidth: 256,
    frameHeight: 256
  }
);

and:

this.load.spritesheet(
  "dudu-idle",
  "/assets/characters/dudu/idle.png",
  {
    frameWidth: 256,
    frameHeight: 256
  }
);

Frames should be numbered left-to-right:

0, 1, 2, 3, 4, 5

==================================================
TESTING
==================================================

Add tests for important pure logic:

- filename parsing
- character extraction from directory
- frame-count parsing
- alpha-region detection
- noise filtering
- bounding boxes
- common scale calculation
- baseline positioning

Use the project's existing test framework if one exists.

Do not introduce another test framework unnecessarily.

==================================================
PROJECT SETUP
==================================================

The root project is:

C:\Users\FauzulAzim\Documents\BDC

Before making changes:

1. Inspect the existing BDC directory.
2. Inspect package.json if it exists.
3. Determine whether TypeScript is already configured.
4. Determine the package manager.
5. Determine whether a test framework exists.
6. Inspect the existing assets directory.
7. Confirm that these exist:

   assets/bubu/idle-6-frame.png
   assets/dudu/idle-6-frame.png
   assets/reference/Bubu dudu reference.png

Do not delete, modify, move, rename, or overwrite those original images.

If BDC does not yet contain an application/package.json, initialize only
what is necessary for the sprite preprocessing tool without prematurely
building the Electron application.

==================================================
CODE ORGANIZATION
==================================================

Prefer something like:

BDC/
  assets/
    bubu/
    dudu/
    reference/

  scripts/
    sprites/
      index.ts
      detectFrames.ts
      normalizeFrame.ts
      buildSheet.ts
      debug.ts
      filename.ts
      types.ts

  sprite.config.ts

  public/
    assets/
      characters/
        bubu/
        dudu/

  sprite-debug/

Adapt this if the existing project has established conventions.

==================================================
DOCUMENTATION
==================================================

Document the workflow in README.md.

The intended future workflow is extremely simple:

1. Generate a new AI animation.

2. Save it with the correct filename:

   assets/bubu/walk-6-frame.png

3. Run:

   npm run sprites

4. Receive:

   public/assets/characters/bubu/walk.png

5. Use the generated sprite directly in Phaser.

The original AI-generated image must always remain untouched.

==================================================
IMPORTANT
==================================================

This preprocessing system will eventually handle all Bubu and Dudu
animations.

Prioritize:

- one-command workflow
- deterministic processing
- original source assets are never modified
- transparent PNG output
- consistent character scale
- stable baseline
- no animation jitter introduced by preprocessing
- automatic frame count from filename
- useful debugging
- clear validation errors
- maintainable TypeScript

Do not modify the artwork itself.

Only:
- detect
- crop
- normalize scale
- align
- compose

After implementation:

1. Run the tool against the CURRENT two real files:

   assets/bubu/idle-6-frame.png
   assets/dudu/idle-6-frame.png

2. Verify both detect exactly 6 frames.

3. Generate their processed sprite sheets.

4. Run with --debug and inspect the generated frame images.

5. Verify output dimensions are exactly:

   1536x256

6. Run tests and TypeScript checks.

7. Fix any issues you find.

Finally give me a concise summary of:
- files added/changed
- commands to use
- output paths
- whether both current idle sprite sheets processed successfully
- any issues detected in the source images