# Trilocale · Milano

Scroll-driven 3D tour of an apartment, built with Vite and Three.js. Scroll to move through the
rooms; click a pin (or the furniture itself) to fly to it and orbit around it. `Esc` returns to the tour.

## Running it

```bash
npm install
npm run dev
```

## Structure

- `src/main.js` – renderer, lighting, model loading
- `src/tour.js` – scroll → camera path, room cards, furniture pins
- `src/focus.js` – fly-to and orbit around a piece of furniture
- `src/world.js` – raw model coordinates (cm, Z-up) → scene coordinates (m, Y-up)
- `src/data/scene-config.js` – rooms and furniture (camera points and bounding boxes)
- `scripts/inspect-model.mjs` – dumps per-mesh material + bounding box to `src/data/meshes.json`.
  The GLB merges geometry per material, so furniture is defined by bounding boxes in `scene-config.js`.

## Credits

This work is based on ["Trilocale Via Boncompagni Milano"](https://sketchfab.com/3d-models/trilocale-via-boncompagni-milano-dd261cf6c2e647cab915f015230bb15e)
by [Fabio Siccardi](https://sketchfab.com/FabioSiccardi), licensed under
[CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
