# PriorCash Mooncake Frames

This repository is a static GitHub Pages host for the ordered Mooncake WebP frame sequence used by the Framer `ImageSequence` component.

## Files

- `frames/` contains 146 WebP frames.
- `manifest.json` lists every frame in filename order.
- `index.html` shows the final hosted URLs after GitHub Pages is enabled.
- `.nojekyll` keeps GitHub Pages from applying Jekyll processing.

## GitHub Upload

1. Create a new public GitHub repository, for example `priorcash-mooncake-frames`.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open `Settings` -> `Pages`.
4. Set `Source` to `Deploy from a branch`.
5. Select branch `main` and folder `/root`, then save.
6. Wait until GitHub Pages gives you the live URL.

The hosted manifest will be available at:

```text
https://YOUR-USERNAME.github.io/priorcash-mooncake-frames/manifest.json
```

The first frame will be available at:

```text
https://YOUR-USERNAME.github.io/priorcash-mooncake-frames/frames/fiscat_mooncake_motion_C_overscan_00000.webp
```

After this is live, paste the GitHub Pages URL back into Codex so the Framer `ImageSequence` can be updated from the manifest.
