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
- Everything that's drawn lives inside the page (`position: absolute`), so the browser
  scrolls, flings and pinch-zooms it together with the content. No JS has to catch up to keep them aligned.
- A low-res whole-page render sits underneath as a safety net if a flick outruns the sharp render.

**Parallax mode (default):** the WebGL canvas itself is a strip in the page, a bit taller than
the viewport with extra margin in the scroll direction. Each frame (fps-capped), JS moves the strip to the
view and renders straight into it. The camera is an off-axis perspective with its eye over the viewport (+100px right, same as the
old `perspectiveX`). The camera's window is always a rectangle on the z=0 page plane, so anything
at z=0 lands on the same pixels whatever the eye does. The frames stay locked to the DOM, and only bevels,
letters and shadows move. A late frame only delays the depth effect. There are no per-frame pixel
copies, because copying WebGL output into 2D canvases is what made the first version choppy on iPhone.

**Flat mode (`?parallax=0`):** orthographic camera with a slight shear. The page is rendered once
into viewport-sized tiles with lookahead, and nothing renders while scrolling.

The key light's shadow map is only re-rendered when the view moves into a new 600px cell, not
every frame. The paper is counter-scaled per frame like `CoverBG` does live, so it stays locked to the page.
Tick "paper depth" to give it real parallax instead.

Mobile defaults are lighter: DPR 1.5, half-res glass refraction, and a 60 fps cap on parallax renders.

## Debug panel (bottom-left)

Tap its header to expand or collapse it. It starts collapsed on phones. The header shows live
render fps, CPU ms per render, and the outrun count.

| Control | Meaning |
| --- | --- |
| parallax / paper depth / eye | Live perspective on/off, real depth for the paper, eye distance (1000 = live site) |
| fps cap | Max parallax renders per second. The page itself still scrolls at full rate |
| glass refraction / half-res | The glass transmission pass is the most expensive part of the look |
| rim lights / mouse light | Extra lights |
| borders / underlay / underlay only | Debug views |
| DPR | Render resolution |

"cpu ms" doesn't include GPU time on Safari, so judge mobile by feel and by the fps readout.

## URL params

| Param | Effect |
| --- | --- |
| `?parallax=0` | Flat mode |
| `?eye=1600` | Eye distance (parallax strength) |
| `?fps=30` | Parallax render cap (`0` = every frame) |
| `?dpr=2` | Render resolution cap |
| `?refraction=full` | Full or half-res glass refraction (`full` / `half`) |
| `?borders=1` | Outlines on load |
| `?underlay=0` | No low-res safety net |
| `?mouselight=1` | Cursor light on (desktop) |
| `?hud=0` | Hide the debug panel |

## Not included

- Side decor models (off by default on the live site anyway)
- Theme switching, sidebar/hamburger interactivity, carousel rotation (the page is a static snapshot)
- The fixed `main_frame_ref` container (it has a no-op build in the live theme)
