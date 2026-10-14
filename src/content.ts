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
  /** Camera offset from the pin when flying to it. */
  cam: { x: number; y: number; z: number };
}

// Placeholder upgrades, positioned to fit the real layout. Bryan will replace
// them with his own list. Anything tagged [verify] is a working assumption.
export const UPGRADES: Upgrade[] = [
  {
    id: 'sm-exit',
    title: 'Untangle the Space Mountain exit / TRON path',
    short: 'SM exit / TRON',
    area: 'Walkway between the Launch Depot and the Speedway',
    pos: { x: 45, z: -49 },
    zone: 'domeExit',
    problem:
      'Space Mountain riders leave through the Launch Depot onto the same walkway guests use to reach the TRON Lightcycle / Run entrance [verify]. Exiting riders head south toward the plaza while TRON guests head north, so at peak the two flows meet head-on in a narrow stretch and the path stalls.',
    fix:
      'Widen the stretch to about 20 m by pulling the planter beds back, split it into marked northbound and southbound lanes, and sign the quieter back path behind the Speedway queue as a second way out to the plaza.',
    impact: [
      { metric: 'Zone density (model)', value: 'Drops sharply in the model' },
      { metric: 'Land walk time', value: 'Down in the model' },
      { metric: 'Exit stoppages', value: 'Fewer unload holds for a blocked exit [verify]' },
      { metric: 'Cost', value: 'Low: hardscape, landscaping and signs [verify]' },
    ],
    cam: { x: -40, y: 58, z: 44 },
  },
  {
    id: 'merge',
    title: 'Merged return-time queue entrance',
    short: 'Buzz merge',
    area: "Buzz Lightyear's Space Ranger Spin, entrance",
    pos: { x: -12, z: 21 },
    zone: 'merge',
    problem:
      'Standby and Lightning Lane return-time guests arrive at the same entrance mouth, and the merge happens right at the plaza walkway [verify]. When standby backs up to the door, return-time guests cut across it, the line spills onto the main path, and the merge operator cannot hold a steady ratio [verify].',
    fix:
      'Move the merge inside the queue building. Two clearly marked lanes leave the walkway, one tap-point podium handles return-time scans, and the merge gate sits inside where one operator can see both lines. Post the standby wait at the lane split.',
    impact: [
      { metric: 'Queue spill onto walkway', value: 'Removed in the model' },
      { metric: 'Standby wait accuracy', value: 'Within about 5 min of posted [verify]' },
      { metric: 'Effective throughput', value: '+3 to 5% from fewer merge-related load stops [verify]' },
      { metric: 'Guest recovery', value: 'Fewer line disputes at the entrance [verify]' },
    ],
    cam: { x: -20, y: 60, z: -34 },
  },
  {
    id: 'pickup',
    title: "Relocate Cosmic Ray's mobile-order pickup",
    short: 'Mobile pickup',
    area: "Cosmic Ray's Starlight Café, promenade side",
    pos: { x: -34, z: -3 },
    zone: 'pickup',
    problem:
      'At lunch and dinner peaks, mobile-order guests wait for "order ready" outside the doors on the main promenade side [verify]. Twenty or thirty people standing still [verify] narrow the busiest walkway between the hub bridge and the plaza.',
    fix:
      'Move pickup to a dedicated window on the quieter north side, facing the Speedway and the Fantasyland walkway, with its own ready board. Send each guest a push notification with a pickup slot. Put grab-and-go drinks and desserts at the window.',
    impact: [
      { metric: 'Promenade usable width', value: 'Restored in the model' },
      { metric: 'Pickup handoff time', value: 'About -30% [verify]' },
      { metric: 'Per-cap F&B', value: '+$0.40 to $0.80 per mobile order from add-ons at the window [verify]' },
      { metric: 'Seat turns at peak', value: 'Faster, less congestion at the doors [verify]' },
    ],
    cam: { x: 16, y: 52, z: 48 },
  },
  {
    id: 'shade',
    title: 'Shaded, interactive Speedway queue',
    short: 'Speedway queue',
    area: 'Tomorrowland Speedway, queue at the Tomorrowland end',
    pos: { x: 28, z: -66 },
    problem:
      'Much of the Speedway queue is out on open pavement [verify]. On summer afternoons the posted wait plus the heat drives guests to give up on the line, raises heat complaints and first-aid visits [verify], and leaves the attraction running below capacity while the line still looks long.',
    fix:
      'Put tensile shade sails over the switchbacks, add misting fans, and install interactive pit-crew screens at the turns (reaction-time games and a lap-time leaderboard).',
    impact: [
      { metric: 'Perceived wait', value: '-20 to 30% for occupied vs. idle waiting [verify]' },
      { metric: 'Afternoon balk rate', value: 'Lower, so utilization goes up [verify]' },
      { metric: 'Heat incidents', value: 'Fewer first-aid calls from the queue [verify]' },
      { metric: 'Revenue', value: 'Screens are a sponsor-ready surface [verify]' },
    ],
    cam: { x: -30, y: 48, z: 46 },
  },
  {
    id: 'cart',
    title: 'Merch cart at the PeopleMover exit',
    short: 'Merch cart',
    area: 'Rocket Tower Plaza, PeopleMover exit',
    pos: { x: 25, z: 15 },
    problem:
      'The PeopleMover is a continuous loader that unloads a steady stream of relaxed guests into Rocket Tower Plaza [verify]. There is no retail touchpoint right at the exit, so that spending intent drifts away.',
    fix:
      'Park a small cart in the alcove by the exit, off the walking line. Stock ride-themed pins, light-up toys for dusk, and cold drinks. Mobile pay, one operator.',
    impact: [
      { metric: 'Conversion', value: '2 to 4% of exiting guests [verify]' },
      { metric: 'Land per-cap merch', value: '+$0.30 to $0.60 [verify]' },
      { metric: 'Walkway impact', value: 'None: the cart sits in an alcove (model)' },
      { metric: 'Payback', value: 'Weeks, not years, for a cart and one position [verify]' },
    ],
    cam: { x: -24, y: 40, z: 40 },
  },
  {
    id: 'wayfinding',
    title: 'Live wayfinding at the hub bridge',
    short: 'Wayfinding',
    area: 'Tomorrowland entrance from the castle hub',
    pos: { x: -64, z: -6 },
    problem:
      'Guests come off the hub bridge and default to the busiest route toward Space Mountain and TRON. The back path behind the Speedway queue and the Carousel of Progress side stay quiet, and nothing at the entrance says where the short waits are.',
    fix:
      'Install digital wait-time totems at the bridge and at junctions inside the land, showing live waits and a suggested route, backed by app nudges. Sign the quiet back path.',
    impact: [
      { metric: 'Routing (model)', value: 'Guests steer around hot spots in real time' },
      { metric: 'Load balance', value: 'More use of Carousel of Progress and the PeopleMover [verify]' },
      { metric: 'Avg walk time', value: 'Down in the model' },
      { metric: 'Per-cap upside', value: 'Totems can push dining and merch offers [verify]' },
    ],
    cam: { x: -40, y: 48, z: 50 },
  },
];

export const AREA_LABELS: { text: string; x: number; y: number; z: number; minor?: boolean }[] = [
  { text: 'Space Mountain', x: 102, y: 32, z: -28 },
  { text: 'TRON Lightcycle / Run', x: 72, y: 20, z: -104 },
  { text: 'Astro Orbiter', x: 0, y: 38, z: 0 },
  { text: 'PeopleMover', x: 84, y: 14, z: 30 },
  { text: 'Tomorrowland Speedway', x: -26, y: 6, z: -96 },
  { text: 'Carousel of Progress', x: 64, y: 17, z: 50 },
  { text: "Buzz Lightyear's Space Ranger Spin", x: -24, y: 15, z: 44 },
  { text: 'Monsters, Inc. Laugh Floor', x: -50, y: 14, z: 42 },
  { text: "Cosmic Ray's Starlight Café", x: -28, y: 14, z: -30 },
  { text: 'Merchant of Venus', x: -46, y: 12, z: -30, minor: true },
  { text: "Stitch's Great Escape (closed)", x: -62, y: 12, z: -30, minor: true },
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
