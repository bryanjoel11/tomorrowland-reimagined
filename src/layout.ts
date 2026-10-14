// Layout of Magic Kingdom's Tomorrowland as modelled here.
// Units are roughly 2 m; x = east, z = south (north is -z). The castle hub is
// to the west, Fantasyland to the north-west, Main Street U.S.A. to the
// south-west and Space Mountain at the north-east edge, outside the railroad.
// See LAYOUT-NOTES.md for sources and open questions.

export interface NodeDef {
  id: string;
  x: number;
  z: number;
}

export interface EdgeDef {
  a: string;
  b: string;
  /** Walkway width. */
  w: number;
  /** Paint this edge as a walkway mesh (plaza edges sit on the plaza disc). */
  paint?: boolean;
}

export const NODES: NodeDef[] = [
  // Edges of the land (guests arrive and leave here)
  { id: 'HUB', x: -118, z: 6 },
  { id: 'MS', x: -80, z: 84 },
  { id: 'FL', x: -104, z: -64 },
  { id: 'SC', x: 22, z: -134 },
  // Hub bridge and promenade
  { id: 'BR', x: -78, z: 6 },
  { id: 'E', x: -62, z: 6 },
  { id: 'P0', x: -44, z: 4 },
  { id: 'TT', x: -64, z: 24 },
  // Rocket Tower Plaza ring around the Astro Orbiter / PeopleMover station
  { id: 'CW', x: -20, z: 0 },
  { id: 'CN', x: 0, z: -20 },
  { id: 'CE', x: 20, z: 0 },
  { id: 'CS', x: 0, z: 20 },
  // North: Cosmic Ray's, Speedway, Fantasyland walkway
  { id: 'CR', x: -12, z: -13 },
  // Former Stitch's Great Escape doors on the promenade, across from Laugh Floor
  { id: 'SG', x: -52, z: -6 },
  { id: 'N0', x: 6, z: -42 },
  { id: 'N1', x: -30, z: -63 },
  { id: 'SPq', x: 18, z: -62 },
  // East: Space Mountain, Launch Depot, TRON
  { id: 'S1', x: 42, z: -10 },
  { id: 'SMin', x: 72, z: -16 },
  { id: 'T0', x: 42, z: -36 },
  { id: 'T1', x: 48, z: -62 },
  { id: 'SMx', x: 62, z: -64 },
  { id: 'TR', x: 48, z: -84 },
  // South: Laugh Floor, Buzz Lightyear, Carousel of Progress
  { id: 'LF', x: -48, z: 20 },
  { id: 'BZin', x: -20, z: 22 },
  { id: 'BZex', x: -4, z: 46 },
  { id: 'SH', x: 10, z: 44 },
  { id: 'C1', x: 30, z: 24 },
  { id: 'COP', x: 46, z: 38 },
  // PeopleMover exit
  { id: 'PMx', x: 13, z: 14 },
];

export const EDGES: EdgeDef[] = [
  { a: 'HUB', b: 'BR', w: 14, paint: true },
  { a: 'BR', b: 'E', w: 14, paint: true },
  { a: 'E', b: 'P0', w: 14, paint: true },
  { a: 'P0', b: 'CW', w: 9, paint: true },
  { a: 'E', b: 'TT', w: 8, paint: true },
  { a: 'TT', b: 'MS', w: 9, paint: true },
  { a: 'P0', b: 'LF', w: 7, paint: true },
  // Entrance walk to the reopened Stitch show.
  { a: 'P0', b: 'SG', w: 6, paint: true },
  { a: 'CW', b: 'CN', w: 10 },
  { a: 'CN', b: 'CE', w: 10 },
  { a: 'CE', b: 'CS', w: 10 },
  { a: 'CS', b: 'CW', w: 10 },
  { a: 'CW', b: 'CR', w: 8, paint: true },
  { a: 'CR', b: 'CN', w: 8 },
  { a: 'CN', b: 'N0', w: 10, paint: true },
  { a: 'N0', b: 'N1', w: 8, paint: true },
  { a: 'N1', b: 'FL', w: 9, paint: true },
  { a: 'N0', b: 'SPq', w: 6, paint: true },
  { a: 'N0', b: 'T0', w: 8, paint: true },
  { a: 'CE', b: 'S1', w: 12, paint: true },
  { a: 'S1', b: 'SMin', w: 7, paint: true },
  { a: 'S1', b: 'T0', w: 9, paint: true },
  { a: 'T0', b: 'T1', w: 7, paint: true },
  { a: 'T1', b: 'SMx', w: 7, paint: true },
  { a: 'T1', b: 'TR', w: 8, paint: true },
  { a: 'TR', b: 'SC', w: 7, paint: true },
  { a: 'N0', b: 'T1', w: 5, paint: true },
  { a: 'CS', b: 'BZin', w: 7, paint: true },
  { a: 'BZex', b: 'SH', w: 7, paint: true },
  { a: 'SH', b: 'CS', w: 8, paint: true },
  { a: 'SH', b: 'C1', w: 7, paint: true },
  { a: 'CE', b: 'C1', w: 9, paint: true },
  { a: 'C1', b: 'COP', w: 8, paint: true },
  { a: 'CE', b: 'PMx', w: 8 },
  { a: 'PMx', b: 'CS', w: 8 },
];

export const nodeById = (id: string): NodeDef => {
  const n = NODES.find((n) => n.id === id);
  if (!n) throw new Error('node ' + id);
  return n;
};

// Landmark positions used by both the scene and the pins.
export const L = {
  hub: { x: -140, z: 6, r: 44 },
  moat: { x: -140, z: 6, r0: 48, r1: 57 },
  bridge: { x0: -98, x1: -78, z: 6, w: 14 },
  spinner: { x: 0, z: 0 },
  dome: { x: 102, z: -28, r: 24 },
  launchDepot: { x: 58, z: -74 },
  tron: { x: 72, z: -102, w: 70, d: 24 },
  speedway: { x: -26, z: -94, rx: 54, rz: 17 },
  speedwayQueue: { x: 28, z: -66 },
  theater: { x: 64, z: 50, r: 15 },
  northBldg: { x0: -72, x1: -16, z0: -50, z1: -10 },
  southBldg: { x0: -60, x1: -10, z0: 26, z1: 60 },
  laughFloorSplit: -38,
  /** Former Stitch theater bay of the north building (rotunda centre and frontage). */
  stitch: { x0: -64, x1: -42, rx: -53, rz: -30 },
  terrace: { x: -79, z: 37 },
  starTraders: { x: 26, z: -22 },
  lunchingPad: { x: 9, z: -12 },
  shop: { x: 14, z: 54 },
  railroad: [
    [-40, -160], [30, -150], [64, -118], [70, -70], [68, -10], [72, 50], [58, 102], [10, 130], [-60, 140],
  ] as [number, number][],
};
