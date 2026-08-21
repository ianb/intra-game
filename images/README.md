# Generating room and character images

Offline authoring, like recording checkpoints. A CLI generates images with
Gemini 2.5 Flash Image ("Nano Banana") and commits them as WebP under
`app/assets/images/`. The runtime never calls the image API; it loads the
committed files. See [app/images.ts](../app/images.ts) for the view-side lookup.

```bash
pnpm images                 # generate images that are missing or out of date
pnpm images --force         # regenerate everything
pnpm images Intake Marta    # only these entity ids
pnpm images --kind room     # only rooms (or --kind character)
pnpm images --refs          # (re)generate the two neutral reference images
```

Needs `OPENROUTER_API_KEY`. About $0.04 per image. Optional overrides:
`IMAGE_MODEL`, `IMAGE_QUALITY`.

## How it stays consistent

Two things keep the images looking like one game:

- **One style prompt.** `STYLE` in [style.ts](./style.ts) is the whole look.
  Change it and every image is marked for regeneration (the prompt hash in the
  manifest changes), so `pnpm images` re-makes them.
- **A reference image per kind.** `--refs` generates a neutral room and a
  neutral face avatar; each later generation passes the matching one back in as
  conditioning, which anchors palette and register. Regenerate the references
  after a `STYLE` change, then regenerate the rest.

## What lands where

- `app/assets/images/rooms/<id>.webp` — 320x180 landscape scene per room.
- `app/assets/images/characters/<id>.webp` — 128x128 square face avatar.
- `app/assets/images/_ref/{room,character}.webp` — the conditioning references.
- `app/assets/images/manifest.json` — id -> file, plus the prompt hash that
  drives regeneration. Bundled into the app for a synchronous lookup.

The files are small and stored at their pixel-grid resolution; the UI upscales
them with `image-rendering: pixelated`, so the chunky pixels stay crisp at any
display size. `app/assets/` is copied to `dist/assets/` by the normal build, so
no build step is specific to images.

## The social-preview image

`pnpm og` renders the link-preview card (Open Graph / Twitter) to
`app/assets/og.png` at 1200x630, served at `/assets/og.png` and referenced by
the `og:image` tags in [app/index.html](../app/index.html). It is drawn with a
headless browser, not the image model, so the title uses the game's own bundled
pixel font over a real room (`Hollow_Atrium`); see [og.ts](./og.ts). Re-run it
if the title art or the background room changes. No API key needed.

## Regeneration is a prompt-hash diff

An image is regenerated when its file is missing or when
`hash(model + prompt)` no longer matches the manifest. Editing a room or
character `description`, or the `STYLE`, changes the prompt and re-makes only
what changed. `--force` ignores the hash.
