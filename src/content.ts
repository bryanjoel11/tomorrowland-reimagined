import type { ZoneKey } from './layout';

export interface Upgrade {
  id: string;
  title: string;
  short: string;
  area: string;
  /** Real attraction named only as the inspiration, in text. */
  inspiredBy: string;
  pos: { x: number; z: number };
  zone?: ZoneKey;
  problem: string;
  fix: string;
  impact: { metric: string; value: string }[];
  /** Camera offset from the pin when flying to it. */
  cam: { x: number; y: number; z: number };
}

// Copy is written from an operator's point of view. Anything tagged [verify]
// is a working assumption for Bryan to confirm against his own experience.
export const UPGRADES: Upgrade[] = [
  {
    id: 'dome-exit',
    title: 'Widen the dome exit pinch point',
    short: 'Dome exit',
    area: 'Indoor coaster dome, exit walkway',
    inspiredBy: 'Space Mountain exit area',
    pos: { x: 35, z: -13 },
    zone: 'domeExit',
    problem:
      'The coaster unloads in bursts straight into a walkway that is only about 4 to 5 m wide between planter beds [verify]. Guests heading in to the dome and over to the speedway cross that same stretch, so at peak the two flows meet head-on and the path stalls. Operators end up doing crowd control at the exit instead of running the attraction.',
    fix:
      'Pull the planter beds back and move the bench run so the usable path is about 10 m. Add a paving pattern that quietly splits outbound and inbound lanes, and move the exit merch display off the walking line.',
    impact: [
      { metric: 'Zone density (model)', value: 'Drops sharply, see live readout' },
      { metric: 'Land walk time', value: 'Down in the model, see stats panel' },
      { metric: 'Exit stoppages', value: 'Fewer unload holds for a blocked exit [verify]' },
      { metric: 'Cost', value: 'Low: hardscape and landscaping only [verify]' },
    ],
    cam: { x: -22, y: 48, z: 40 },
  },
  {
    id: 'merge',
    title: 'Merged return-time queue entrance',
    short: 'Queue merge',
    area: 'Arcade / blaster dark ride, entrance',
    inspiredBy: "Buzz Lightyear's Space Ranger Spin entrance",
    pos: { x: -8, z: 30 },
    zone: 'merge',
    problem:
      'Standby and return-time guests arrive at the same entrance mouth, and the merge happens right at the walkway. When standby backs up to the door, return-time guests cut across it, the line spills onto the main path, and the merge operator cannot hold a steady ratio [verify].',
    fix:
      'Move the merge about 15 m inside the queue building. Two clearly marked lanes leave the walkway, one tap-point podium handles return-time scans, and the merge gate sits inside where one operator can see both lines. Post the standby wait at the lane split.',
    impact: [
      { metric: 'Queue spill onto walkway', value: 'Removed in the model' },
      { metric: 'Standby wait accuracy', value: 'Within about 5 min of posted [verify]' },
      { metric: 'Effective throughput', value: '+3 to 5% from fewer merge-related load stops [verify]' },
      { metric: 'Guest recovery', value: 'Fewer line disputes at the entrance [verify]' },
    ],
    cam: { x: -36, y: 50, z: -6 },
  },
  {
    id: 'pickup',
    title: 'Relocate mobile-order pickup',
    short: 'Mobile pickup',
    area: 'Quick-service restaurant, front of house',
    inspiredBy: "Cosmic Ray's Starlight Cafe",
    pos: { x: -46, z: 6 },
    zone: 'pickup',
    problem:
      'At lunch and dinner peaks, mobile-order guests wait for "order ready" right outside the main doors, which face the main promenade from the hub. Twenty or thirty people standing still [verify] cut the busiest walkway in the land to about half its width.',
    fix:
      'Move pickup to a dedicated side-patio window with its own ready board, and send each guest a push notification with a pickup slot. Put grab-and-go drinks and desserts at the window.',
    impact: [
      { metric: 'Promenade usable width', value: 'About 5 m back to 12 m (model)' },
      { metric: 'Pickup handoff time', value: 'About -30% [verify]' },
      { metric: 'Per-cap F&B', value: '+$0.40 to $0.80 per mobile order from add-ons at the window [verify]' },
      { metric: 'Seat turns at peak', value: 'Faster, less congestion at the doors [verify]' },
    ],
    cam: { x: 8, y: 46, z: -46 },
  },
  {
    id: 'shade',
    title: 'Shaded, interactive queue',
    short: 'Shaded queue',
    area: 'Speedway, outdoor queue',
    inspiredBy: 'Tomorrowland Speedway queue',
    pos: { x: -40, z: -36 },
    problem:
      'The speedway queue is mostly out on open pavement [verify]. On summer afternoons the posted wait plus the heat drives guests to give up on the line, raises heat complaints and first-aid visits [verify], and leaves the attraction running below capacity while the line still looks long.',
    fix:
      'Put tensile shade sails over the switchbacks, add misting fans, and install interactive pit-crew screens at the turns (reaction-time games and a lap-time leaderboard).',
    impact: [
      { metric: 'Perceived wait', value: '-20 to 30% for occupied vs. idle waiting [verify]' },
      { metric: 'Afternoon balk rate', value: 'Lower, so utilization goes up [verify]' },
      { metric: 'Heat incidents', value: 'Fewer first-aid calls from the queue [verify]' },
      { metric: 'Revenue', value: 'Screens are a sponsor-ready surface [verify]' },
    ],
    cam: { x: 32, y: 46, z: 40 },
  },
  {
    id: 'cart',
    title: 'Merch cart at the people mover exit',
    short: 'Merch cart',
    area: 'People mover track, exit',
    inspiredBy: 'Tomorrowland Transit Authority PeopleMover',
    pos: { x: -25, z: 21 },
    problem:
      'The people mover is a continuous loader that unloads a steady stream of relaxed guests [verify] into a plaza with no retail touchpoint. The nearest shop is across the land, so that spending intent goes nowhere.',
    fix:
      'Park a small cart in the alcove under the elevated station, off the walking line. Stock ride-themed pins, light-up toys for dusk, and cold drinks. Mobile pay, one operator.',
    impact: [
      { metric: 'Conversion', value: '2 to 4% of exiting guests [verify]' },
      { metric: 'Land per-cap merch', value: '+$0.30 to $0.60 [verify]' },
      { metric: 'Walkway impact', value: 'None: the cart sits in an alcove (model)' },
      { metric: 'Payback', value: 'Weeks, not years, for a cart and one position [verify]' },
    ],
    cam: { x: -12, y: 40, z: 40 },
  },
  {
    id: 'wayfinding',
    title: 'Live wayfinding at the hub bridge',
    short: 'Wayfinding',
    area: 'Hub bridge entrance',
    inspiredBy: 'the bridge from the central hub into the land',
    pos: { x: -60, z: -8 },
    problem:
      'Guests come off the hub bridge and default to the busiest route toward the coaster. The back path behind the people mover and the theater side stay quiet, and nothing at the entrance says where the short waits are.',
    fix:
      'Install digital wait-time totems at the bridge and at two junctions inside the land, showing live waits and a suggested route, backed by app nudges. Sign the quiet back path.',
    impact: [
      { metric: 'Routing (model)', value: 'Guests steer around hot spots in real time' },
      { metric: 'Load balance', value: 'More use of the theater and people mover [verify]' },
      { metric: 'Avg walk time', value: 'Down in the model, see stats panel' },
      { metric: 'Per-cap upside', value: 'Totems can push dining and merch offers [verify]' },
    ],
    cam: { x: -34, y: 46, z: 44 },
  },
];

export const AREA_LABELS: { text: string; x: number; y: number; z: number }[] = [
  { text: 'Indoor coaster dome', x: 58, y: 28, z: -52 },
  { text: 'Rocket spinner', x: 0, y: 36, z: 0 },
  { text: 'People mover track', x: 70, y: 14, z: -10 },
  { text: 'Speedway', x: -62, y: 6, z: -58 },
  { text: 'Carousel theater', x: 58, y: 16, z: 38 },
  { text: 'Arcade / blaster dark ride', x: -22, y: 16, z: 56 },
  { text: 'Quick-service restaurant', x: -52, y: 12, z: 26 },
  { text: 'Merch shop', x: 22, y: 10, z: 50 },
  { text: 'Hub bridge', x: -96, y: 6, z: 0 },
];
