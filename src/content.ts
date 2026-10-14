import type { ZoneKey } from './layout';

export interface Upgrade {
  id: string;
  title: string;
  short: string;
  /** Where in the land this sits. */
  area: string;
  pos: { x: number; z: number };
  zone?: ZoneKey;
  problem: string;
  fix: string;
  impact: { metric: string; value: string }[];
  /** Height of the pin above the ground. */
  pinY?: number;
  /** Camera offset from the pin when flying to it. */
  cam: { x: number; y: number; z: number };
}

// Bryan's four upgrades. Anything tagged [verify] is a working assumption.
export const UPGRADES: Upgrade[] = [
  {
    id: 'sugar-rush',
    title: 'Replace the Speedway with Sugar Rush, an indoor dual racing coaster',
    short: 'Sugar Rush',
    area: 'Tomorrowland Speedway footprint, north of Cosmic Ray\'s',
    pos: { x: -24, z: -94 },
    pinY: 30,
    zone: 'rideQueue',
    problem:
      'Tomorrowland Speedway takes up one of the biggest footprints in the land but moves relatively few guests per hour, because each car is loaded and dispatched one at a time [verify]. The result is long waits for a dated experience, the queue spills out toward the walkway on busy days, and the whole attraction sits outdoors in Florida heat, rain and lightning holds [verify].',
    fix:
      'Remove the Speedway and put an indoor dual racing coaster themed to the candy-racing world of Sugar Rush (Wreck-It Ralph) in the same footprint. Two side-by-side tracks launch out of one candy-themed station and race each other through banked turns and an airtime hill, with the lead changing along the way. The show building gets a candy facade, glass upper walls and a vaulted roof, and the entrance and queue sit outside it on the walkway side.',
    impact: [
      { metric: 'Hourly capacity', value: 'Two loading sides roughly double the dispatches, about 2x one track and well above the Speedway [verify]' },
      { metric: 'All-weather ops', value: 'Indoors, so it keeps running through rain and heat and only lightning on the launch is a factor [verify]' },
      { metric: 'Re-ride appeal', value: 'Racing means a different winner each time, so guests come back for the other side [verify]' },
      { metric: 'Posted wait', value: 'Shorter for the same demand, and the queue moves off the walkway [verify]' },
    ],
    cam: { x: 50, y: 80, z: 96 },
  },
  {
    id: 'accessible-pm',
    title: 'A wheelchair-accessible PeopleMover',
    short: 'Accessible PeopleMover',
    area: 'PeopleMover station, Rocket Tower Plaza',
    pos: { x: -4, z: 9 },
    pinY: 20,
    problem:
      'To ride the PeopleMover today, guests have to step from a moving platform into a moving car, so guests who use wheelchairs or ECVs must be able to transfer [verify]. Guests who cannot transfer simply cannot ride, and their whole party is often left out.',
    fix:
      'Redesign the cars with a wheelchair bay and a fold-down ramp, and add an accessible boarding zone on the platform where the moving belt and the train slow to a stop for a few seconds to let a guest roll on and off. The rest of the platform keeps loading as it does today.',
    impact: [
      { metric: 'Accessibility', value: 'Guests who cannot transfer can ride without leaving their chair' },
      { metric: 'Inclusive capacity', value: 'About 4% more guests able to ride in the model [verify]' },
      { metric: 'Throughput cost', value: 'Short, occasional stops; small hourly impact [verify]' },
      { metric: 'Guest satisfaction', value: 'Whole parties ride together; fewer recovery cases [verify]' },
    ],
    cam: { x: -20, y: 20, z: 30 },
  },
  {
    id: 'hyperspace',
    title: 'Space Mountain refurbishment: Hyperspace Mountain',
    short: 'Hyperspace Mountain',
    area: 'Space Mountain exterior, entrance and ride',
    pos: { x: 74, z: -14 },
    pinY: 18,
    zone: 'smEntrance',
    problem:
      'Space Mountain\'s exterior and ride experience are showing their age [verify]. The dome reads as a plain white building after dark, the entrance is easy to walk past, and the in-ride effects have not kept pace with newer coasters like TRON next door [verify].',
    fix:
      'Refurbish the exterior with glowing light lines along the ribs and spires, an animated hyperspace light show across the dome at night, and a new entrance and queue facade. Inside, add an onboard light-speed effects package: hyperspace jump projections, synced audio and lighting [verify].',
    impact: [
      { metric: 'Re-ride demand', value: 'More repeat rides from a fresh experience [verify]' },
      { metric: 'Guest appeal', value: 'A night-time landmark that pulls guests to the east end [verify]' },
      { metric: 'Merch tie-in', value: 'Hyperspace-themed products at the Launch Depot exit shop [verify]' },
      { metric: 'Trade-off', value: 'Higher demand adds some crowding at the entrance (model)' },
    ],
    cam: { x: -46, y: 54, z: 62 },
  },
  {
    id: 'stitch',
    title: "Reopen Stitch's Great Escape, reimagined",
    short: "Stitch's Great Escape",
    area: 'North show building, next to Cosmic Ray\'s, across from Laugh Floor',
    pos: { x: -53, z: -14 },
    pinY: 20,
    zone: 'promenade',
    problem:
      "A large show building sits dark on prime promenade frontage, right across from Monsters, Inc. Laugh Floor [verify]. That is indoor capacity the land is not using, and the shuttered facade makes the west end of Tomorrowland feel empty while the promenade outside stays crowded.",
    fix:
      "Bring it back as \"Stitch's Great Escape, reimagined\": a refreshed family-friendly in-the-round show with a new Stitch animatronic and projection-mapped effects. There are no shoulder restraints and the scare level is lower, so all ages can ride. Outside it gets a lit, refreshed facade, an open entrance and a covered queue facing the promenade.",
    impact: [
      { metric: 'Indoor capacity', value: 'A full theater of seats every show cycle comes back online [verify]' },
      { metric: 'Weather buffer', value: 'Air-conditioned seats that absorb crowds in rain or heat [verify]' },
      { metric: 'Crowd spread', value: 'Pulls guests off the promenade and into a show (model)' },
      { metric: 'Guest appeal', value: 'An all-ages show with a popular character, instead of a dark frontage [verify]' },
    ],
    cam: { x: -6, y: 34, z: 58 },
  },
];

export const AREA_LABELS: { text: string; x: number; y: number; z: number; minor?: boolean; today?: boolean; up?: boolean }[] = [
  { text: 'Space Mountain', x: 102, y: 32, z: -28 },
  { text: 'TRON Lightcycle / Run', x: 72, y: 20, z: -104 },
  { text: 'Astro Orbiter', x: 0, y: 38, z: 0 },
  { text: 'PeopleMover', x: 84, y: 14, z: 30 },
  { text: 'Tomorrowland Speedway', x: -26, y: 6, z: -96, today: true },
  { text: 'Sugar Rush (indoor racing coaster)', x: -62, y: 10, z: -72, up: true },
  { text: 'Carousel of Progress', x: 64, y: 17, z: 50 },
  { text: "Buzz Lightyear's Space Ranger Spin", x: -24, y: 15, z: 44 },
  { text: 'Monsters, Inc. Laugh Floor', x: -50, y: 14, z: 42 },
  { text: "Cosmic Ray's Starlight Café", x: -26, y: 12, z: -30 },
  { text: 'Merchant of Venus', x: -68, y: 12, z: -30, minor: true },
  { text: "Stitch's Great Escape (closed)", x: -53, y: 12, z: -10, minor: true, today: true },
  { text: 'Tomorrowland Terrace', x: -79, y: 9, z: 37, minor: true },
  { text: 'Lunching Pad', x: 9, y: 5, z: -12, minor: true },
  { text: 'Star Traders', x: 26, y: 9, z: -22, minor: true },
  { text: 'Launch Depot', x: 58, y: 9, z: -74, minor: true },
  { text: 'Hub bridge', x: -88, y: 6, z: 6 },
  { text: 'Castle hub', x: -140, y: 4, z: 6 },
  { text: 'To Fantasyland', x: -100, y: 4, z: -66, minor: true },
  { text: 'To Storybook Circus', x: 22, y: 4, z: -136, minor: true },
  { text: 'To Main Street, U.S.A.', x: -80, y: 4, z: 86, minor: true },
  { text: 'WDW Railroad', x: 72, y: 4, z: 40, minor: true },
];
