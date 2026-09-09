# Framer Scroll Sequence

## Files

- `components/ScrollSequenceReveal.tsx` - Framer Code Component
- `assets/landing-sequence/frame-0001.jpg` ... `frame-0120.jpg` - scroll-driven sequence
- `assets/landing-poster.jpg` - first frame/poster
- `assets/landing-scroll-1280.mp4` - lightweight video fallback
- `assets/landing-scroll-1280.webm` - lightweight video fallback

## Framer Setup

1. Upload the contents of `assets/landing-sequence/` to a public folder on a CDN or file host.
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

## Recommended Defaults

- `Frames`: `120`
- `Pad`: `4`
- `Format`: `JPG`
- `Scroll vh`: `450`
- `Preload`: `5`
- `Max DPR`: `1.5`
- `Fit`: `Contain`

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
