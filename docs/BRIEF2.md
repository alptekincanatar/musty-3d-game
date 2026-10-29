# Musty Playground v2 — fix & extend (existing project in this dir: index.html, style.css, app.js, assets/)
Read BRIEF.md for the original spec. Keep the UI/look and Turkish text. Do NOT rewrite from scratch; edit existing files.

## Problem 1 — recoloring is broken
Runtime pixel heuristics in app.js leak: shirt color bleeds into the background/skin with jagged edges, black blob appears on wall near trousers, white speckles remain in trousers.
FIX with OFFLINE precomputed masks:
- Write a one-off Python script tools/make_masks.py (pip install pillow numpy opencv-python-headless scipy is allowed; use a venv in .venv if needed).
- For every full-body image (assets/body-*.webp and every rotation frame, see Problem 2) produce grayscale soft-edge mask PNGs: assets/masks/<name>-shirt.png and <name>-pants.png (same size as source). Segment with flood-fill/GrabCut/connected components seeded from known colors (shirt = light blue, trousers = off-white), restrict by body silhouette (separate from the cream background using GrabCut or color distance + largest component), exclude skin, hair, shoes, necklace, bracelets, buttons. Fill holes (morphological close), feather edge 1-2px.
- VERIFY visually: render each mask overlaid on image to a PNG, look at it, iterate until clean (no leaks into background, no holes).
- In app.js replace the heuristic recolor with: draw original image on canvas, then for pixels where mask alpha>0 shift color toward the chosen target color while preserving luminance/shading (e.g. multiply luminance-normalized shading by target color, blend by mask alpha). White trousers must turn properly to black/red etc. keeping folds/shadows. Cache masks per image.
- Keep the swatches, custom color pickers, accessories, PNG download.

## Problem 2 — fake 3D rotation
User wants to rotate the character. We only have 2D renders: assets/sheet.webp is a 3x3 contact sheet of the same character (row1: front, 3/4, side-facing-left; row2: back-3/4, back, side-facing-right; row3: other poses). Crop cells of the sheet with the script into assets/rot/rot-0.webp ... in correct yaw order (front -> 3/4 -> side -> back 3/4 -> back -> opposite side -> 3/4 -> front) — LOOK at the images to determine the order; add a mirrored frame where it makes the loop smoother (e.g. mirror the 3/4 for the other side). Make frames aligned (same scale/feet baseline, centered) and the same size.
- New "Döndür" mode/tab: drag horizontally (mouse + touch, pointer events) on the stage to scrub through frames smoothly with inertia, plus a small auto-rotate toggle and a "Ön" reset button. Show a small angle indicator.
- Recoloring and accessories must also work on rotation frames (use masks; accessories can be hidden on back views).
- Be honest in UI: small hint "8 açılı 360° önizleme".

## Problem 3 — test it
Run `python3 -m http.server 8780` is ALREADY running here on port 8780. Use node/playwright or headless checks if available; at least run `node --check app.js` and view mask overlays. Make sure no console errors.

Write progress notes to NOTES.md (what is done) as you go.
