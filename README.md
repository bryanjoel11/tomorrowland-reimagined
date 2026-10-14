# Tomorrowland Reimagined

**An interactive 3D model of Magic Kingdom's Tomorrowland, re-run by someone who used to run its attractions.**

I worked attractions in Tomorrowland at Magic Kingdom. This site turns what I saw on the floor into a visual proposal you can explore in the browser. The land is shown with four upgrades in place. Open a pin or take the guided tour to see what changed and why.

Personal concept project. Not affiliated with Disney. Every building, ride and path is generated in code: no logos, official artwork or downloaded models.

## Why it matters to a hiring manager

- **Operations insight turned into a product proposal.** Each upgrade says what changes in the land, why it is worth doing, and what it adds for guests and for the operation.
- **Commercial thinking.** The proposals add capacity (a dual racing coaster and a reopened theater), weather-proof indoor attractions, inclusive capacity on the PeopleMover, and a story-driven refresh of the land's icon with a merchandise tie-in.
- **Show, don't tell.** Every change is built in 3D, in place, on a layout that matches the real land.
- **Scoped like a PM would.** Factual claims that still need checking are tagged `[verify]`, and open layout questions are listed in `LAYOUT-NOTES.md`.

## The four upgrades

1. **Sugar Rush, an indoor dual racing coaster in the old Speedway footprint.** A candy-themed show building has glass upper walls and a vaulted glass roof, so you can see the two side-by-side tracks inside. Two trains launch out of one station with two loading sides, bank through the turns and swap the lead. The entrance facade and queue sit outside, by the walkway. The PeopleMover passes through the building too, so its riders get a preview of the race.
2. **A wheelchair-accessible PeopleMover.** Every train runs redesigned cars with a wheelchair bay, a coral bay door and a teal band. The station has a step-free boarding zone with a level strip, gates, a sign and an elevator. Every third train glides to a stop there, a ramp folds down, then the line moves on.
3. **Hyperspace Mountain, the Meridian Starport.** The mountain blends two ideas: the Victorian launch-cannon engineering of the Paris Space Mountain and the sleek white sculptural look of Tokyo's new one. The model includes:
   - a riveted bronze plinth with porthole windows
   - a smooth white cone wrapped in sweeping fins with lit edges, plus a swooping ribbon
   - burnished brass bands with rivets
   - a crown of spires with a turning orrery ring
   - four tall spires tied back to the shell with brass struts
   - a Columbiad-style launch cannon on a girder cradle, with gear-wheel trunnions and charge hoops that light in sequence

   An animated light-speed streak shader races up the shell. A brass portal entrance and lit queue posts lead guests in. The card tells an original backstory for the attraction.
4. **Stitch's Great Escape, reimagined.** The former Stitch theater in the north show building sits next to Cosmic Ray's and across from Laugh Floor. It reopens as an all-ages in-the-round show with a lit facade, an open entrance, a covered queue and a projection-mapped drum.

## The site

- **Explore** (`#/explore`): the 3D land fills the main view. It has:
  - pins
  - a guided tour
  - labels
  - a top-down map view
  - a strip linking to each upgrade
- **Upgrades** (`#/upgrades`): every upgrade as a readable card (what changed, why, what it adds, and the Space Mountain story), with a "See it in 3D" link (`#/explore/N`).
- **About the project** (`#/about`): my intro and how the site is built.
- Hash routing keeps it a fully static site. On phones the nav collapses into a menu and the pin card becomes a bottom sheet.

## Features

- **Real layout.** The model follows the real Tomorrowland, with the castle hub to the west:
  - **Entrance and south side:** the hub bridge leads onto the Rocket Tower Plaza promenade. Monsters, Inc. Laugh Floor and Buzz Lightyear's Space Ranger Spin sit in the south show building, with Tomorrowland Terrace by the bridge.
  - **North side:** the north show building holds Merchant of Venus, the former Stitch theater and Cosmic Ray's.
  - **Centre:** the Astro Orbiter sits on top of the PeopleMover station.
  - **East:** Space Mountain sits outside the railroad berm, with the Launch Depot exit between it and the TRON Lightcycle / Run canopy.
  - **South-east:** the Carousel of Progress.

  Sources and open questions are in [`LAYOUT-NOTES.md`](LAYOUT-NOTES.md).
- **Sign text always fits.** Signs are drawn on a canvas that shrinks each line until it fits the panel, then redraws once the web fonts load.
- **Retro-futurist identity:** a 1960s space-age look with crisp white, brushed silver, sky and teal blues, and a coral/orange accent. The fonts are Michroma, Outfit and IBM Plex Mono, and the wordmark is drawn in SVG.
- **Performance:**
  - instanced track, rivets, girders, trees and lamps
  - environment reflections only on the Space Mountain metals
  - shadows refresh at about 20 Hz
  - half-resolution bloom
  - automatic quality fallback on slow devices
  - rendering pauses while you are on the text pages
  - `prefers-reduced-motion` is respected

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/
```

Handy URL options:

- `?welcome=0` hides the welcome panel.
- `?pin=3` opens a pin instantly.
- `?view=top` starts in the top-down map view.
- `?bloom=0` turns bloom off.
- `?hq` skips the automatic quality fallback.
- `?cam=x,y,z&look=x,y,z` sets the camera.
- Hash routes: `#/explore`, `#/explore/3`, `#/upgrades`, `#/about`.

## Deploy to Netlify

`netlify.toml` is included. Build command `npm run build`, publish directory `dist`. The build uses `base: './'`, so `dist/` also works from any sub-path.

## Project structure

```
src/
  main.ts          renderer, camera, router, UI, tour
  world.ts         procedural scene (all geometry built in code)
  spaceMountain.ts Hyperspace Mountain: shell, fins, cannon, portal, light effects
  layout.ts        walkway graph and landmark positions
  content.ts       upgrade cards, Space Mountain story and area labels
  style.css        site + overlay styles
LAYOUT-NOTES.md    layout research, sources, open questions
```
