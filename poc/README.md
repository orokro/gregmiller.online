# 3D sliding-window proof of concept

A standalone test of the "tiles inside the document" approach for the Glass theme.
No Nuxt, no MongoDB, no build step. Plain Node + native ES modules.

## Run it

```bash
npm run poc
```

It prints a `Local` URL and one or more `Network` URLs. Open the Network URL on your
phone or iPad (same Wi-Fi). Two pages are included:

- `/` is the home page
- `/graffiti-yards` is the very tall page (about 18k px on desktop, about 63k px on a phone)

On Windows, the first run may pop up a firewall prompt for Node. Allow it on private
networks, or the phone can't connect.

To refresh the page snapshot from the live site: `npm run poc:snapshot`

## How it works

- World space = document space (1 unit = 1 CSS px).
- Geometry is built once at document positions, and rebuilt only on reflow.
- One offscreen WebGL renderer draws horizontal tiles, each about one viewport tall.
- Each tile is a plain `<canvas>` placed inside the page with `position: absolute`.
  The browser scrolls it together with the content, so no JS runs during scroll to keep them aligned.
- JS only decides which tiles should exist. That's the visible ones plus a lookahead in the
  scroll direction, which gets longer on fast flicks.
- A low-res whole-page render sits underneath as a safety net if a flick outruns the tiles.
- The camera is orthographic with a small oblique shear, which mimics the old
  `perspectiveX: -100`. Because of that, tiles join seamlessly and never need re-rendering just because you scrolled.

## Debug panel (bottom-left)

Tap its header to expand or collapse it. It starts collapsed on phones.

| Stat / control | Meaning |
| --- | --- |
| `ms/tile` | CPU+GPU time to render one tile (the copy into the canvas waits for the GPU) |
| `outrun` | Frames where a visible tile had no pixels yet, i.e. a flick beat the renderer |
| tile borders | Outline each tile |
| underlay only | Hide the sharp tiles, to see what an outrun would look like |
| glass transmission | The most expensive part of the glass. Toggle it to compare cost |
| rim lights | They follow the tile. Toggle to check for lighting seams |
| mouse light | Desktop cursor light. Re-renders the visible tiles on mouse move |
| DPR cap / tile | Resolution and tile height |

## URL params

| Param | Effect |
| --- | --- |
| `?copy=bitmap` | Hand frames to tiles via `OffscreenCanvas` + `ImageBitmap` (zero-copy) instead of `drawImage` |
| `?dpr=1.5` | Cap the device pixel ratio |
| `?borders=1` | Tile outlines on load |
| `?underlay=0` | No low-res safety net |
| `?mouselight=1` | Cursor light on (desktop) |
| `?hud=0` | Hide the debug panel |

## Not included

- Side decor models (off by default on the live site anyway)
- Theme switching, sidebar/hamburger interactivity, carousel rotation (the page is a static snapshot)
- The fixed `main_frame_ref` container (it has a no-op build in the live theme)
