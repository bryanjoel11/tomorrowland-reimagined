# Tomorrowland Reimagined

**An interactive 3D model of Magic Kingdom's Tomorrowland, re-run by someone who used to run its attractions.**

I worked attractions in Tomorrowland at Magic Kingdom. This site turns what I saw on the floor into a visual proposal you can explore in the browser. Switch between **Today** and **Upgraded**, open the four upgrade pins (Problem / Fix / Expected impact), and watch a guest-flow model compare ride throughput and crowding.

Personal concept project. Not affiliated with Disney. Every building, ride and path is generated in code: no logos, official artwork or downloaded models.

## Why it matters to a hiring manager

- **Operations insight turned into a product proposal.** Each upgrade states the guest or operator pain, the intervention, and the metric it should move: capacity, waits, accessibility, re-ride demand, crowding.
- **Commercial thinking.** New capacity (a dual racing coaster, a reopened theater), an all-weather indoor attraction, inclusive capacity on the PeopleMover, and a merch tie-in for Hyperspace Mountain.

## The four upgrades

1. **Sugar Rush, an indoor dual racing coaster in the Speedway footprint.** The Speedway goes away. A candy-themed show building takes its place, with glass upper walls and a vaulted glass roof so you can see the two side-by-side tracks inside. Two trains launch out of one station with two loading sides, bank through the turns and swap the lead. The entrance facade and queue sit outside, by the walkway.
2. **A wheelchair-accessible PeopleMover.** Upgraded swaps every train for a redesigned car with a wheelchair bay, a coral bay door and a teal band. At the station there is a step-free boarding zone with a level strip, gates, a sign and an elevator. Every third train glides to a stop there, a ramp folds down, then the line moves on.
3. **Hyperspace Mountain.** Glowing light lines run along every rib and spire. An animated light-speed streak shader plays across the dome, and a new portal entrance and lit queue facade replace the old one.
4. **Stitch's Great Escape, reimagined.** The dark former Stitch theater in the north show building, next to Cosmic Ray's and across from Laugh Floor, reopens. It gets a lit facade, an open entrance, a covered queue and a projection-mapped drum. Guests walk in from the promenade.

Every card tags its working assumptions `[verify]`.
- **Show, don't tell.** The Today vs Upgraded toggle and the live model make the before/after case the way you would pitch it to an ops or revenue leadership team.
- **Scoped like a PM would.** It is a v1 with explicit assumptions (`[verify]` tags) and a documented list of open layout questions (see `LAYOUT-NOTES.md`).

## The site

- **Explore** (`#/explore`): the 3D land fills the main view. Inside it you get:
  - the Today / Upgraded toggle
  - a guided tour
  - the stats panel
  - labels
  - a top-down map view
- **Upgrades** (`#/upgrades`): every upgrade as a readable card, with a "See it in 3D" link (`#/explore/N`).
- **About the project** (`#/about`): my intro, how the guest model works, and how the site is built.
- Hash routing keeps it a fully static site. On phones the nav collapses into a menu, the stats become a chip, and the pin card becomes a bottom sheet.

## Features

- **Real layout.** The model follows the real Tomorrowland, with the castle hub to the west:
  - **Entrance and south side:** the hub bridge leads onto the Rocket Tower Plaza promenade. Monsters, Inc. Laugh Floor and Buzz Lightyear's Space Ranger Spin sit in the south show building, and Tomorrowland Terrace by the bridge.
  - **North side:** Cosmic Ray's, Merchant of Venus and the former Stitch theater are in the north show building. The Tomorrowland Speedway runs toward Fantasyland.
  - **Centre:** the Astro Orbiter sits on top of the PeopleMover station.
  - **East and north-east:** Space Mountain sits outside the railroad berm, with the Launch Depot exit between it and the TRON Lightcycle / Run canopy.
  - **South-east:** the Carousel of Progress.
  - **Transport:** the PeopleMover loop runs through the show buildings and Space Mountain. Walkways lead to Fantasyland, Storybook Circus and Main Street. Sources and open questions are in [`LAYOUT-NOTES.md`](LAYOUT-NOTES.md).
- **Today / Upgraded toggle** that animates the scene. The Speedway sinks away as the Sugar Rush building rises, and the PeopleMover cars swap to the accessible design. Hyperspace Mountain lights up, and the Stitch frontage unshutters.
- **Guest-flow simulation:** 750 instanced guests walk the walkway graph. They slow down as local density rises and turn orange/red when crowded. The Speedway queue spill moves into the coaster switchbacks, and promenade guests head into the reopened Stitch show.
- **Live stats:** average walk time, crowding index, ride trips per hour and hottest spot, Today vs Upgraded. Each pin card also has its own live readout: Speedway vs Sugar Rush trips, PeopleMover access share, Space Mountain demand, and Stitch seats per hour. Two background copies of the model run so the comparison stays at steady state.
- **Retro-futurist identity:** a 1960s space-age look with crisp white, brushed silver, sky and teal blues, and a coral/orange accent. Fonts are Michroma, Outfit and IBM Plex Mono. The wordmark is drawn in SVG.
- **Performance:**
  - instanced guests, track, trees and lamps
  - shadows refresh at about 20 Hz
  - half-resolution bloom
  - automatic quality fallback on slow devices
  - rendering pauses while you are on the text pages
  - `prefers-reduced-motion` is respected

## How the model works

`src/sim.ts` is a small agent model. The land is a graph of walkways with a usable width for Today and for Upgraded. Each guest picks a weighted next destination and walks the shortest path. Walking speed falls linearly with density. In Today the Speedway's queue spill counts as standing guests on its walkway. In Upgraded the Speedway is replaced by a faster-loading Sugar Rush, the Stitch theater becomes a destination, and Space Mountain gets a little more demand. Also, 4% of guests use wheelchairs, and they can only pick the PeopleMover once it is accessible. It is illustrative and not calibrated to park data.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/
```

Handy URL options:

- `?welcome=0` hides the welcome panel.
- `?mode=upgraded` starts in Upgraded.
- `?pin=3` opens a pin instantly.
- `?view=top` starts in the top-down map view.
- `?bloom=0` turns bloom off.
- Hash routes: `#/explore`, `#/explore/3`, `#/upgrades`, `#/about`.

## Deploy to Netlify

`netlify.toml` is included. Build command `npm run build`, publish directory `dist`. The build uses `base: './'`, so `dist/` also works from any sub-path.

## Project structure

```
src/
  main.ts     renderer, camera, router, UI, tour, stats, mode blending
  world.ts    procedural scene (all geometry built in code)
  crowd.ts    instanced guest dots, standing crowds, heat glows
  sim.ts      guest flow agent model
  layout.ts   walkway graph, destinations, landmark positions
  content.ts  upgrade cards and area labels
  style.css   site + overlay styles
LAYOUT-NOTES.md  layout research, sources, open questions
```
