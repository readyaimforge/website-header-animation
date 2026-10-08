# Ready Aim Forge – interactive header background

Three.js background for the site header. Sits behind the header text (`z-index:-2`).

- **Scroll / swipe**: wheel, touch-drag and page scroll push the camera forward through neon beams and dust (with momentum). Idle = slow ambient drift.
- **Pointer**: parallax + particles part around the cursor.
- **Light**: Three.js is ~165 KB gzipped, loaded after first paint (`requestIdleCallback`), fades in over a CSS gradient fallback. No bloom pass (glow is additive blending).
- Pauses when off-screen or tab hidden; `prefers-reduced-motion` renders one still frame; fewer particles and lower DPR on mobile.

```js
import { initHeaderBg } from './src/header-bg.js';
const bg = initHeaderBg(document.querySelector('.hero-bg')); // bg.destroy() to clean up
```

See `index.html` for a demo. Palette/beams/particle counts are at the top of `src/header-bg.js`.
Serve over http (e.g. `python3 -m http.server`) – ES modules don't load from `file://`.
