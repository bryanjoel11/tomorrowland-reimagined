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
  { id: 'HUB', x: -94, z: 0 },
  { id: 'MS', x: -86, z: 84 },
  { id: 'FL', x: -84, z: -92 },
  { id: 'SC', x: 50, z: -156 },
  // Hub bridge and promenade
  { id: 'BR', x: -72, z: 0 },
  { id: 'E', x: -64, z: 0 },
  { id: 'P0', x: -40, z: 0 },
  { id: 'TT', x: -66, z: 20 },
  // Rocket Tower Plaza ring around the Astro Orbiter / PeopleMover station
  { id: 'CW', x: -20, z: 0 },
  { id: 'CN', x: 0, z: -20 },
  { id: 'CE', x: 20, z: 0 },
  { id: 'CS', x: 0, z: 20 },
  // North: Cosmic Ray's, the walkway between it and Sugar Rush, Fantasyland
  { id: 'CR', x: -32, z: -5 },
  // Former Stitch's Great Escape doors on the promenade, across from Laugh Floor
  { id: 'SG', x: -53, z: -5 },
  { id: 'N0', x: -10, z: -30 },
  { id: 'N1', x: -12, z: -72 },
  { id: 'SPq', x: -3, z: -46 },
  // East: Space Mountain, Launch Depot, TRON
  { id: 'S1', x: 40, z: -16 },
  { id: 'SMin', x: 80, z: -36 },
  { id: 'SMx', x: 62, z: -2 },
  { id: 'T0', x: 50, z: -40 },
  { id: 'T1', x: 56, z: -62 },
  { id: 'TR', x: 58, z: -86 },
  // South: Laugh Floor, Buzz Lightyear, Carousel of Progress
  { id: 'LF', x: -54, z: 6 },
  { id: 'BZin', x: -28, z: 6 },
  { id: 'BZex', x: -16, z: 42 },
  { id: 'SH', x: -8, z: 32 },
  { id: 'C1', x: 32, z: 22 },
  { id: 'COP', x: 32, z: 38 },
  // PeopleMover exit
  { id: 'PMx', x: 13, z: 14 },
];

export const EDGES: EdgeDef[] = [
  { a: 'HUB', b: 'BR', w: 14, paint: true },
  { a: 'BR', b: 'E', w: 14, paint: true },
  { a: 'E', b: 'P0', w: 14, paint: true },
  { a: 'P0', b: 'CW', w: 10, paint: true },
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
  { a: 'CN', b: 'N0', w: 10, paint: true },
  { a: 'N0', b: 'N1', w: 9, paint: true },
  { a: 'N1', b: 'FL', w: 9, paint: true },
  { a: 'N0', b: 'SPq', w: 6, paint: true },
  { a: 'CE', b: 'S1', w: 12, paint: true },
  { a: 'S1', b: 'SMin', w: 7, paint: true },
  { a: 'S1', b: 'SMx', w: 7, paint: true },
  { a: 'S1', b: 'T0', w: 9, paint: true },
  { a: 'T0', b: 'T1', w: 7, paint: true },
  { a: 'T1', b: 'TR', w: 8, paint: true },
  { a: 'TR', b: 'SC', w: 7, paint: true },
  { a: 'CS', b: 'BZin', w: 7, paint: true },
  { a: 'BZex', b: 'SH', w: 7, paint: true },
  { a: 'SH', b: 'CS', w: 8, paint: true },
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
  hub: { x: -128, z: -4, r: 40 },
  moat: { x: -128, z: -4, r0: 44, r1: 52 },
  bridge: { x0: -88, x1: -70, z: 0, w: 14 },
  spinner: { x: 0, z: 0 },
  dome: { x: 106, z: -42, r: 24 },
  launchDepot: { x: 66, z: -6 },
  /** Canopy centre, size and turn (it runs south-west to north-east). */
  tron: { x: 84, z: -112, w: 76, d: 26, rot: 0.45 },
  /**
   * Sugar Rush fills the former Speedway plot, which runs north-south between
   * Cosmic Ray's and Space Mountain. rx/rz are the footprint half-sizes before
   * the turn and scale; the station end faces the plaza.
   */
  speedway: { x: 14, z: -70, rx: 54, rz: 17, rot: -Math.PI / 2, s: 0.8 },
  speedwayQueue: { x: -8, z: -50 },
  theater: { x: 15, z: 54, r: 15, s: 1.3 },
  northBldg: { x0: -66, x1: -22, z0: -51, z1: -9 },
  southBldg: { x0: -64, x1: -20, z0: 9, z1: 47 },
  laughFloorSplit: -42,
  /** Former Stitch theater bay of the north building (rotunda centre and frontage). */
  stitch: { x0: -62, x1: -44, rx: -53, rz: -30 },
  terrace: { x: -82, z: 40 },
  starTraders: { x: 32, z: 10 },
  lunchingPad: { x: 9, z: -12 },
  shop: { x: -6, z: 52 },
  railroad: [
    [-40, -176], [30, -166], [70, -136], [80, -90], [78, -40], [74, -10], [58, 30], [40, 80], [0, 110], [-60, 128],
  ] as [number, number][],
};

/** Is (x, z) inside the Sugar Rush footprint (plus pad)? Handles its turn. */
export function inSugarRush(x: number, z: number, pad = 0): boolean {
  const sw = L.speedway;
  const c = Math.cos(sw.rot);
  const s = Math.sin(sw.rot);
  const dx = x - sw.x;
  const dz = z - sw.z;
  // World -> local for a turn of rot around the up axis.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < (sw.rx + 6) * sw.s + pad && Math.abs(lz) < (sw.rz + 4) * sw.s + pad;
}
