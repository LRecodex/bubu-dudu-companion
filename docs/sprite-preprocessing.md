# Sprite preprocessing

Sprite preprocessing has been extracted from BDC into a general desktop app:

`C:\Users\FauzulAzim\Documents\Tools\preprocessor-sprite`

Launch it with:

```powershell
cd C:\Users\FauzulAzim\Documents\Tools\preprocessor-sprite
npm.cmd run dev
```

The app accepts one or multiple arbitrary PNG files, lets each source use automatic or explicit grid detection, and lets you choose the output directory. It emits one horizontal sprite-sheet PNG and one JSON metadata file per source. Filenames and Bubu/Dudu character folders are no longer required.

For BDC assets, choose an appropriate folder under `public/assets/characters/` as the destination. Existing runtime behavior is unchanged: the companion loads the generated PNG and JSON pairs from that directory.

See the standalone tool's `README.md` for settings, detection-mode guidance, tests, and installer creation.
