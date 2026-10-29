# Musty Playground — mini web demo (Turkish UI)
Single-page static site: index.html, style.css, app.js (vanilla JS, no build, no npm). Images in ./assets (webp, 1328px wide portrait, cream bg):
- face-wink, face-cute, face-surprised (close-up portraits)
- body-neutral, body-talk, body-lean, body-cross, body-present (full body poses), sheet (turnaround, ignore)
Character "Musty", 3D Pixar-style, for Çarşı (Turkish bazaar/football fan group brand). Light-blue shirt, white trousers, colorful sneakers.

## Features
1. Stage: big centered character image with soft shadow, cream bg, playful modern look. Mobile responsive.
2. Tab "Mimikler": buttons for face-wink/cute/surprised swap the stage to the close-up (crossfade). Plus sliders that tweak the displayed image via CSS/canvas: head tilt (rotate), "şaşkınlık" zoom, eye/brow can't be edited so keep to tilt, zoom, brightness. Emoji-labelled buttons.
3. Tab "Pozlar": body-* poses switch with crossfade.
4. Tab "Kıyafet": recolor shirt and trousers live using a <canvas> hue/saturation shift applied only to pixels matching the original shirt color (light blue, hue ~200-230, sat>0.08) for shirt, and near-white low-sat bright pixels in the lower body region for trousers (y > 45% of image height, exclude skin/shoes). Color swatches (red, yellow, black, green, pink, etc. incl. Çarşı black/white) + custom color picker. Also accessory toggles drawn as inline SVG overlays positioned in percentages for the face-closeups/body: sunglasses, cap, scarf (black-white Çarşı scarf). Keep it simple and adjustable.
5. Mini game "Stil Challenge": random task card ("Kırmızı gömlek + güneş gözlüğü yap!", "Şaşkın mimik yap!") ; player completes with the controls; score + 30s timer + combo; localStorage high score.
6. Reset button, download current look as PNG (canvas.toBlob).
7. Clean code, comments in Turkish minimal. Must work by opening index.html via a local server (python3 -m http.server) — canvas needs same-origin.
Test it by running a static server and checking for JS errors if possible.
