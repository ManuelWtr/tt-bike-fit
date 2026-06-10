# TT Bike Fit

A web-based self-fitting tool for time-trial / triathlon bikes. Upload
side-view photos, click body landmarks, and the app computes the standard
bike-fit angles (knee, hip, shoulder, elbow, torso, ankle).

No backend. Everything runs in the browser and is persisted to
`localStorage`. Export JSON / CSV / annotated PNG when you're done.

## Features

- **Multi-image library** — one image per crank position (12, 3, 6 o'clock,
  aero side); each image keeps its own points and measurements.
- **Manual landmark placement** with a guided wizard ("Click hip", "Click
  knee", …) for each preset.
- **Live angle recalculation** — drag any point and every dependent angle
  updates immediately.
- **TT-fit presets** — knee, hip, shoulder, elbow, torso (to horizontal),
  ankle, plus a generic 3-point angle.
- **Zoom & pan** the canvas with the mouse wheel and drag.
- **Optional calibration** — pick two landmarks with a known real-world
  distance (e.g. crank length 172.5 mm) to unlock mm distance estimates in
  the CSV export. Angles work without it.
- **Compare** angles side-by-side across all your uploaded images.
- **Export** the full state as JSON, a flat CSV summary, or a PNG of the
  current image with all overlays baked in.
- **Persistent** between refreshes via `localStorage`.

## Running

You need Node.js 18+ and npm.

```bash
cd tt-bike-fit
npm install
npm run dev
```

Then open the URL Vite prints (usually <http://localhost:5173>).

For a production build:

```bash
npm run build
npm run preview
```

## How to use it

1. **Upload one or more side-view photos** of yourself on the bike. The
   first upload screen accepts drag-and-drop; later uploads go through the
   sidebar's "Add image" tile.
2. **Pick a measurement preset** (e.g. *Knee angle*). The wizard then
   prompts you to click each landmark in order. The angle is computed and
   displayed on the image as soon as the last point is placed.
3. **Drag any point** to refine it. The angle updates live.
4. **Right-click a point** on the canvas (or use the × in the sidebar) to
   delete it. The owning measurement is removed too.
5. **Switch images** in the sidebar — each image keeps its own points.
6. **(Optional) Calibrate** by picking two landmarks with a known
   real-world distance (e.g. pedal spindle ↔ bottom bracket = your crank
   length). Then the CSV export shows mm estimates.
7. **Export** when you're done. JSON contains the full state and can be
   re-imported by a future version of the tool.

## How angles are computed

All math lives in [`src/utils/geometry.ts`](src/utils/geometry.ts) and is
purely numeric — no React, no DOM. The two helpers used everywhere:

- `angleAtVertex(a, b, c)` — angle at `b` formed by `a-b-c`, in
  `[0°, 180°]`. Used for knee, hip, shoulder, elbow, ankle, and the
  generic 3-point angle.
- `angleToHorizontal(a, b)` — acute angle between line `a→b` and the
  horizontal axis, in `[0°, 90°]`. Used for the torso angle.

Coordinates are stored normalized to the image's natural size
(`x, y ∈ [0, 1]`), so the math is independent of zoom level and the
points survive image resize on storage.

## Reference angle ranges

Rough industry guidelines for a TT/triathlon position — these are
**not medical advice**, just orientation. Comfort and aerodynamics vary
by athlete:

| Measurement                | Typical range       |
| -------------------------- | ------------------- |
| Knee angle at 6 o'clock    | ~140° – 150°        |
| Hip angle (aero)           | ~45° – 55°          |
| Elbow angle (aero)         | ~90° – 100°         |
| Torso angle to horizontal  | ~5° – 15° (TT)      |
| Shoulder angle (aero)      | ~85° – 95°          |

## Project structure

```
src/
  components/
    ImageCanvas.tsx       SVG canvas: zoom/pan, draggable points, overlays
    CanvasToolbar.tsx     Title + hint + zoom buttons above the canvas
    UploadZone.tsx        Drag/click upload (hero + compact variants)
    ImageList.tsx         Sidebar list of uploaded images
    MeasurementWizard.tsx Preset picker + step-by-step placement UI
    MeasurementsList.tsx  Angles + point lists for the active image
    CalibrationPanel.tsx  Optional pixel↔mm scaling
    ExportPanel.tsx       JSON / CSV / PNG / reset
    ComparisonTable.tsx   Cross-image angle comparison
  constants/
    presets.ts            TT-fit measurement presets
    colors.ts             Per-measurement color cycle
  hooks/
    useStore.ts           useReducer-based state + localStorage sync
  types/
    index.ts              All domain types (single source of truth)
  utils/
    geometry.ts           Angle math (pure)
    image.ts              File → downscaled data URL
    storage.ts            localStorage load/save with versioned schema
    export.ts             JSON, CSV, annotated PNG renderers
    id.ts                 Short unique ids
  App.tsx                 Top-level layout + wizard orchestration
  index.css               Dark-theme design tokens & component styles
  main.tsx                React entrypoint
```

## Notes & limitations

- Storage: `localStorage` is capped (≈5 MB on most browsers). Uploaded
  images are downscaled to a max dimension of 1920 px and stored as JPEG
  at quality 0.85, which keeps even a few photos well under the limit.
  If you hit the cap, the app shows a warning pill in the header and you
  can free space with **Export → JSON** + delete some images.
- Coordinates: stored as `(x, y) ∈ [0, 1]`. Survives resize, pan, zoom.
- The "torso angle" preset measures the acute angle between
  `hip → shoulder` and the horizontal axis (0° = perfectly flat torso).
  It's symmetric — it doesn't care which direction the rider faces.

## Extending: automatic landmark detection

This is intentionally a manual tool — but the architecture is friendly to
adding ML-based pose detection later. The integration point is in
`src/utils/image.ts`: after `loadAndDownscaleFile` returns the image, you
could run e.g. MediaPipe Pose or MoveNet on the `HTMLImageElement` and
produce a `LandmarkPoint[]` to pre-fill before the user fine-tunes them.
The `LandmarkType` enum is already aligned with common pose-keypoint
names. See the comment block at the bottom of `image.ts`.

## Deploying to GitHub Pages (password-protected)

The app ships with a casual password gate at
[`src/components/PasswordGate.tsx`](src/components/PasswordGate.tsx). This is
**not real auth** — the password is bundled into the JS and a determined
visitor can bypass it with browser DevTools. It's a *"don't show this to
random URL visitors"* gate, not a secret keeper. Good enough for sharing
with friends; not enough for anything sensitive.

### 1. Change the password

Edit one constant in `src/components/PasswordGate.tsx`:

```ts
const PASSWORD = 'ironman2026' // ← put your shared password here
```

### 2. Push the repo to GitHub

```bash
cd ~/tt-bike-fit
git init
git add .
git commit -m "Initial commit"
git branch -M main
# Create an empty repo on github.com first (named e.g. tt-bike-fit), then:
git remote add origin git@github.com:<your-user>/tt-bike-fit.git
git push -u origin main
```

> If you rename the repo to something other than `tt-bike-fit`, update
> `GH_PAGES_BASE` in [`vite.config.ts`](vite.config.ts) to match
> (`'/<your-repo-name>/'`).

### 3. Enable GitHub Pages with the Actions source

In the repo on github.com:

1. **Settings → Pages**
2. **Source:** *GitHub Actions* (not "Deploy from a branch")
3. The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   runs on every push to `main`, builds, and deploys.

Your URL will be:

```
https://<your-user>.github.io/tt-bike-fit/
```

### 4. (Optional) Use a custom subdomain like bikefit.mnlwtr.com

This requires WordPress.com to let you edit DNS records on the
`mnlwtr.com` domain — usually possible on the Personal plan or higher.

1. In your GitHub repo: **Settings → Pages → Custom domain** → enter
   `bikefit.mnlwtr.com` and save.
2. At your DNS provider (WordPress.com domains panel), add a **CNAME**
   record for `bikefit` pointing to `<your-user>.github.io`.
3. Wait a few minutes for DNS to propagate; GitHub will issue a
   Let's Encrypt cert automatically.
4. Edit [`vite.config.ts`](vite.config.ts) and change `GH_PAGES_BASE` to
   `'/'` (since assets now live at the domain root).
5. Push again.

Then link to it from a WordPress blog post and share the password
through whatever channel you trust.

## Tech stack

- React 18 + TypeScript
- Vite 6
- SVG overlay (no canvas drawing for live UI — keeps DOM-based hit
  testing trivial for draggable markers)
- HTML Canvas only for the annotated PNG export
- No backend, no analytics, no third-party requests

## License

MIT — do what you want with it.
