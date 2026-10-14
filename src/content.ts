export interface Upgrade {
  id: string;
  title: string;
  short: string;
  /** Where in the land this sits. */
  area: string;
  pos: { x: number; z: number };
  /** What changed in the land. */
  what: string;
  /** Why it is worth doing. */
  why: string;
  /** What it adds, in plain words (no figures). */
  adds: string[];
  /** Optional attraction backstory. */
  story?: { title: string; text: string };
  /** Height of the pin above the ground. */
  pinY?: number;
  /** Camera offset from the pin when flying to it. */
  cam: { x: number; y: number; z: number };
}

// Bryan's four upgrades. Anything tagged [verify] is a factual claim still to confirm.
export const UPGRADES: Upgrade[] = [
  {
    id: 'sugar-rush',
    title: 'Sugar Rush, an indoor dual racing coaster',
    short: 'Sugar Rush',
    area: 'Former Tomorrowland Speedway footprint, north of Cosmic Ray\'s',
    pos: { x: -24, z: -94 },
    pinY: 30,
    what:
      'The Speedway is gone. In its footprint stands a candy-themed show building with glass upper walls and a vaulted glass roof, and inside it an indoor dual racing coaster themed to the candy-racing world of Sugar Rush (Wreck-It Ralph). Two trains launch side by side out of one station, race through banked turns and an airtime hill, and trade the lead along the way. The candy facade, entrance and queue sit outside on the walkway side. The PeopleMover now passes through the building too, giving riders a preview of the race.',
    why:
      'The Speedway fills one of the largest plots in the land with a dated experience, and it runs outdoors through Florida heat, rain and lightning holds. A racing coaster puts the same land to work with two loading sides, an indoor ride that keeps running in any weather, and a race guests want to repeat.',
    adds: [
      'Two loading sides, so far more guests per hour than one track',
      'Indoors, so it keeps running through rain and heat',
      'Racing re-ride appeal: a different winner every time',
      'A family coaster and a fresh story for the north side of the land',
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
    what:
      'Every train runs redesigned cars with a wheelchair bay, a wide side door and a fold-down ramp. On the station deck a step-free boarding zone, reached by a new elevator, is where the moving belt and the train slow to a stop for a few seconds so a guest can roll on and off. The rest of the platform keeps loading as it always has.',
    why:
      'At the moment guests step from a moving platform into a moving car, so guests who use wheelchairs or ECVs have to transfer to ride. Guests who cannot transfer cannot ride at all, and their whole party is often left out.',
    adds: [
      'Guests ride without leaving their chair',
      'Whole parties ride together',
      'Short, occasional stops instead of a different experience for some guests',
    ],
    cam: { x: -20, y: 20, z: 30 },
  },
  {
    id: 'hyperspace',
    title: 'Space Mountain refurbished: Hyperspace Mountain',
    short: 'Hyperspace Mountain',
    area: 'Space Mountain exterior, entrance and ride',
    pos: { x: 74, z: -14 },
    pinY: 20,
    what:
      'A new skin for the mountain. Old-world engineering meets a sleek future: a bright white sculptural cone wrapped in sweeping fins, a riveted bronze plinth with porthole windows, burnished brass bands and a crown of spires. A Columbiad-style launch cannon leans into the building on a girder cradle. At night hyperspace light lines trace every fin and spire and light-speed streaks race up the shell. Guests enter through a new portal facade, and onboard a light-speed effects package adds jump projections with synced audio and lighting.',
    why:
      'Space Mountain is the land\'s icon, but its exterior and ride effects are showing their age next to newer coasters like TRON. A refresh with a story of its own gives guests a reason to ride again and makes the east end a night-time landmark.',
    adds: [
      'A landmark that reads from across the park, day and night',
      'A story and onboard effects that bring guests back for another jump',
      'A natural merchandise tie-in at the Launch Depot exit shop',
    ],
    story: {
      title: 'The Meridian Starport',
      text:
        'In 1889 an engineering society cast a great brass cannon to fire a capsule beyond the sky. It never fired. A century later the starport was built around it: white ceramic fins, brass hoops and a crown of spires grown over the old cannon like coral. Tonight the cannon is the hyperspace injector. Guests strap into a launch sled, the hoops charge one by one, and the starport throws them through the light barrier, a light-speed jump through the dark and home again before the stars stop streaking.',
    },
    cam: { x: -46, y: 40, z: 66 },
  },
  {
    id: 'stitch',
    title: "Stitch's Great Escape, reimagined",
    short: "Stitch's Great Escape",
    area: 'North show building, next to Cosmic Ray\'s, across from Laugh Floor',
    pos: { x: -53, z: -14 },
    pinY: 20,
    what:
      'The former Stitch theater reopens as a refreshed, family-friendly in-the-round show with a new Stitch animatronic and projection-mapped effects. There are no shoulder restraints and the scare level is lower, so all ages can ride. Outside it gets a lit facade, an open entrance and a covered queue facing the promenade.',
    why:
      'A large show building sits dark on prime promenade frontage, right across from Monsters, Inc. Laugh Floor [verify]. That is indoor capacity the land is not using, and the shuttered frontage makes the west end of Tomorrowland feel empty.',
    adds: [
      'Indoor, air-conditioned seats that absorb crowds in rain or heat',
      'Guests drawn off the promenade and into a show',
      'An all-ages show with a popular character instead of a dark frontage',
    ],
    cam: { x: -6, y: 34, z: 58 },
  },
];

export const AREA_LABELS: { text: string; x: number; y: number; z: number; minor?: boolean }[] = [
  { text: 'Space Mountain', x: 102, y: 44, z: -28 },
  { text: 'TRON Lightcycle / Run', x: 72, y: 20, z: -104 },
  { text: 'Astro Orbiter', x: 0, y: 38, z: 0 },
  { text: 'PeopleMover', x: 84, y: 14, z: 30 },
  { text: 'Sugar Rush (indoor racing coaster)', x: -62, y: 10, z: -72 },
  { text: 'Carousel of Progress', x: 64, y: 17, z: 50 },
  { text: "Buzz Lightyear's Space Ranger Spin", x: -24, y: 15, z: 44 },
  { text: 'Monsters, Inc. Laugh Floor', x: -50, y: 14, z: 42 },
  { text: "Cosmic Ray's Starlight Café", x: -26, y: 12, z: -30 },
  { text: 'Merchant of Venus', x: -68, y: 12, z: -30, minor: true },
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
