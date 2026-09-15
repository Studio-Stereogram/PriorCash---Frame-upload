# Framer Scroll Sequence

## Files

- `components/ScrollSequenceReveal.tsx` - Framer Code Component
- hosted WebP/JPG/PNG sequence - scroll-driven sequence
- `assets/landing-poster.jpg` - first frame/poster
- `assets/landing-scroll-1280.mp4` - lightweight video fallback
- `assets/landing-scroll-1280.webm` - lightweight video fallback

## Framer Setup

1. Upload the sequence folder to a public folder on a CDN or file host.
2. Keep the filenames unchanged.
3. Add `components/ScrollSequenceReveal.tsx` as a Framer Code Component.
4. Set `Mode` to `Sequence`.
5. Set `Frames URL` to the hosted base path ending before the frame number.

Example:

```text
https://cdn.example.com/landing-sequence/frame-
```

With that value, the component loads:

```text
https://cdn.example.com/landing-sequence/frame-0001.jpg
https://cdn.example.com/landing-sequence/frame-0002.jpg
...
https://cdn.example.com/landing-sequence/frame-0120.jpg
```

Current landing WebP example:

```text
Frames URL: https://prior-cash-frame-upload.vercel.app/landing_webm_235/landing-webp-q60LANDING_v006%20(1)_
Frames: 235
Start: 1
Pad: 6
Format: WebP
```

## Recommended Defaults

- `Frames`: `235`
- `Pad`: `6`
- `Format`: `WebP`
- `Scroll vh`: `850` to `1200`
- `Preload`: `12` to `24`
- `Max DPR`: `1.5`
- `Fit`: `Contain`
- `Media Scale`: `1.035` to `1.06` if the image edge is visible

## Scene Mapping

Set `Mapping` to `Scenes` to control timing by scenes instead of one linear animation.

Each scene has:

- `Scroll From` / `Scroll To`: where the scene lives in the whole scroll, in percent.
- `Range`: choose `Frames` for exact frame numbers, or `Percent` for a relative frame range.
- `Frame From` / `Frame To`: exact source frames, used when `Range` is `Frames`.
- `Frame From %` / `Frame To %`: source range in percent, used when `Range` is `Percent`.

You can add as many scenes as needed from the Framer panel. If there is a gap between two scene scroll ranges, the component holds the previous scene's last frame, which is useful for pause moments.

Example with holds:

```text
Scene 1: Scroll 0-22, Frames 1-45
Scene 2: Scroll 22-34, Frames 45-45
Scene 3: Scroll 34-68, Frames 46-150
Scene 4: Scroll 68-78, Frames 150-150
Scene 5: Scroll 78-100, Frames 151-235
```

## Smooth Snap

With `Mapping` set to `Scenes`, enable `Snap` to gently settle near scene starts and ends.

- `Snap Range %`: how close the scroll must stop to a scene point.
- `Snap Delay`: how long the scroll must be quiet before snapping.
- `Snap Speed`: if the user scrolls faster than this, the snap is skipped.

Suggested first pass:

```text
Snap: On
Snap Range %: 3
Snap Delay: 120
Snap Speed: 38
```

## Product Anchor Scroll

Use `components/SmoothAnchorController.tsx` as a separate Framer Code Component if product navigation buttons should scroll through the sequence instead of jumping too fast.

Drop one instance anywhere on the page. It is invisible on the published site and only listens for matching anchor clicks.

Use these section anchor names:

```text
scroll-1 = t6
scroll-2 = t11
scroll-3 = moon
scroll-4 = pair
```

Suggested settings:

```text
Targets: scroll-1, scroll-2, scroll-3, scroll-4
Speed: 120
Min: 900
Max: 5200
Offset: 0
```

`Speed` is milliseconds per 100vh of distance. Higher is slower. The controller only intercepts links to the names listed in `Targets`; other page links stay native.

## Product Button

Use `components/ProductAnchorButton.tsx` if the navigation buttons should be separate Framer Code Components.

Set `Target` per product:

```text
T6 = scroll-1
T11 = scroll-2
Moon = scroll-3
Pair = scroll-4
```

The `Icon` control is a component slot, so a Flowbite icon can be dropped into it from Framer. Keep `Scroll` set to `Native` for the safest production behavior. Use `Smooth` only if the published page can handle animated page scrolling without lag.

## Hosting

Best options:

- Framer assets, if your project/file upload flow gives public direct URLs
- Cloudflare R2 + public bucket
- Cloudinary
- S3 + CloudFront
- any CDN/static host that preserves filenames and serves images with caching

Avoid Dropbox/Google Drive share links for production because they often redirect, throttle, or change headers.

## Performance Notes

The component renders to one canvas and only preloads a small window of frames around the current scroll position. It also limits canvas DPR by default, clears old cached frames, and falls back to video when the user has reduced motion enabled.
