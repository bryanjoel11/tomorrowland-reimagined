# Tomorrowland Reimagined

**An interactive 3D fan concept of a retro-futurist theme park land, redesigned by someone who used to run its attractions.**

I worked attractions in Tomorrowland at Magic Kingdom. This project turns what I saw on the floor into a visual proposal you can explore in the browser. Switch between **Today** and **Upgraded**, open six upgrade pins (Problem / Fix / Expected impact), and watch a small guest-flow model show crowding ease once the pinch points open up.

> Unofficial fan concept and personal case study. Not affiliated with or endorsed by Disney. Every mesh is built procedurally in code: no logos, official artwork, ripped models or ride trademarks in the visuals. Real attraction names appear only in explanatory text, to say where an idea came from. Numbers are illustrative, and anything tagged `[verify]` is a working assumption.

## Why it matters to a hiring manager

- **Operations insight turned into a product proposal.** Each upgrade states the guest or operator pain, the intervention, and the metric it should move: throughput, wait-time accuracy, walk time, crowding, per-cap spend.
- **Commercial thinking, not just ops.** Two of the six upgrades are revenue plays (an add-on window at mobile-order pickup, a merch cart at a high-volume exit). Others protect capacity, which is revenue too: a stalled exit or a balking queue is lost ride throughput.
- **Show, don't tell.** The Today vs Upgraded toggle and the live model make the before/after argument visually, the way you'd pitch it to an ops or revenue leadership team.
- **Scoped like a PM would.** It is a v1 with clear assumptions, an explicit `[verify]` list, and room to plug in real counts later.

## Features

- **3D land built in code** (three.js): hub bridge entrance, indoor coaster dome, rocket spinner on top of the people mover station, an elevated people mover track with moving trains, a speedway with cars, a carousel theater, an arcade/blaster dark ride, a quick-service restaurant, a merch shop, lamps, planters and trees. White/silver structures, blue and ember accents, dusk sky with stars, soft shadows, bloom on lights.
- **Today / Upgraded toggle** that animates the scene: the dome exit walkway widens and planters slide back, the mobile-order crowd moves to a side-patio pickup pavilion, a recessed two-lane merge portal appears at the dark ride, shade sails rise over the speedway queue, a merch cart rolls into the people mover exit alcove, and wayfinding totems pop up.
- **Six upgrade pins**, each with a Problem / Fix / Expected impact card and a live model readout for its zone.
- **Guided tour** that flies the camera between pins (Prev / Next, or the arrow keys).
- **Guest flow simulation**: 650 instanced guest dots walk a walkway graph, slow down as local density rises, and turn ember/red when crowded. Pinch points jam in Today and clear in Upgraded. In Upgraded, guests also route around congestion and use the newly signed back path (the wayfinding upgrade).
- **Live stats overlay** comparing Today vs Upgraded: average walk time, crowding index and hottest spot. Two background copies of the model run continuously so the comparison stays at steady state.
- **Orbit / zoom / pan camera** with smooth damping. Touch works: one finger orbits, pinch zooms, two fingers pan.
- **Intro overlay** in my own voice, and a clear fan-concept disclaimer.
- **Responsive UI**: on phones the stats collapse to a chip, the card becomes a bottom sheet, and the camera shifts so the pin stays visible above it.
- **Performance**: instanced meshes for guests, track segments, columns, lamps and trees; shadows refresh at ~20 Hz; half-resolution bloom; automatic fallback (no bloom, 1x pixel ratio) on slow devices. Respects `prefers-reduced-motion`.

### The six upgrades

| # | Area (generic label) | Upgrade | Main metric |
|---|---|---|---|
| 1 | Indoor coaster dome exit | Widen the exit walkway pinch point | Zone density, walk time |
| 2 | Arcade / blaster dark ride | Merged return-time queue entrance moved inside | Queue spill, throughput |
| 3 | Quick-service restaurant | Relocate mobile-order pickup to a side patio | Walkway width, per-cap F&B |
| 4 | Speedway | Shaded, interactive queue | Balk rate, perceived wait |
| 5 | People mover exit | Merch cart in the station alcove | Per-cap merch, conversion |
| 6 | Hub bridge | Live wayfinding totems and a signed back path | Load balancing, walk time |

### How the model works

`src/sim.ts` is a small agent model. The land is a graph of walkways with a usable width for Today and for Upgraded. Each guest picks a weighted next destination, walks the shortest path (Upgraded adds live congestion to the cost, standing in for wayfinding), and moves at a speed that falls linearly with density on its current walkway. Mobile-order and queue-spill crowds count as standing guests on their walkway in Today. Walk times are converted from fast-forwarded sim time to real minutes. It is illustrative and not calibrated to park data.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/
```

Handy URL params for demos and screenshots: `?intro=0` skips the intro, `?mode=upgraded` starts in Upgraded, `?pin=3` opens a pin, `?bloom=0` turns bloom off.

## Deploy to Netlify

`netlify.toml` is included:

- Build command: `npm run build`
- Publish directory: `dist`

Connect the repo in Netlify (or drag the `dist/` folder into Netlify Drop). The build uses `base: './'`, so `dist/` also works from any sub-path.

## Stack

Vite + TypeScript + three.js (WebGL). Fonts: Space Grotesk, Inter and JetBrains Mono from Google Fonts. Palette: "Stellar Forge" (space navy, ember, nebula, aurora).

## Project structure

```
src/
  main.ts     renderer, camera, UI, tour, stats, mode blending
  world.ts    procedural scene (all geometry built in code)
  crowd.ts    instanced guest dots, standing crowds, heat glows
  sim.ts      guest flow agent model
  layout.ts   walkway graph, destinations, landmark positions
  content.ts  upgrade cards and area labels
  style.css   UI styles
```
