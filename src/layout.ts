// Shared layout of the land (units are roughly metres, x = east, z = south).
// This is a stylized fan-concept layout, not a survey of the real park.

export interface NodeDef {
  id: string;
  x: number;
  z: number;
}

export interface EdgeDef {
  a: string;
  b: string;
  /** Usable walkway width today (m). */
  w: number;
  /** Usable width once the upgrades land (defaults to w). */
  wUp?: number;
  /** Zone key for the pinch points we track. */
  zone?: ZoneKey;
  /** Path exists but has no signage today, so guests rarely pick it. */
  unsigned?: boolean;
  /** Only exists in the upgraded plan. */
  upOnly?: boolean;
  /** Paint this edge as a walkway mesh (plaza edges sit on the plaza disc). */
  paint?: boolean;
}

export type ZoneKey = 'domeExit' | 'merge' | 'pickup';

export const ZONE_LABELS: Record<ZoneKey, string> = {
  domeExit: 'Dome exit walkway',
  merge: 'Dark ride merge',
  pickup: 'Promenade by restaurant',
};

export const NODES: NodeDef[] = [
  { id: 'HUB', x: -112, z: 0 },
  { id: 'BR', x: -74, z: 0 },
  { id: 'E', x: -58, z: 0 },
  { id: 'P1', x: -36, z: 0 },
  { id: 'CW', x: -20, z: 0 },
  { id: 'CN', x: 0, z: -20 },
  { id: 'CE', x: 20, z: 0 },
  { id: 'CS', x: 0, z: 20 },
  { id: 'SPq', x: -34, z: -26 },
  { id: 'J0', x: 30, z: -6 },
  { id: 'J1', x: 40, z: -20 },
  { id: 'DMin', x: 30, z: -38 },
  { id: 'DMex', x: 54, z: -22 },
  { id: 'N1', x: 12, z: -36 },
  { id: 'TH', x: 40, z: 24 },
  { id: 'DRa', x: -12, z: 30 },
  { id: 'DRin', x: -16, z: 40 },
  { id: 'DRex', x: -2, z: 44 },
  { id: 'SH', x: 10, z: 38 },
  { id: 'QSR', x: -42, z: 12 },
  { id: 'PMx', x: -14, z: 14 },
  { id: 'CART', x: -25, z: 21 },
];

export const EDGES: EdgeDef[] = [
  { a: 'HUB', b: 'BR', w: 14, paint: true },
  { a: 'BR', b: 'E', w: 14, paint: true },
  { a: 'E', b: 'P1', w: 5, wUp: 12, zone: 'pickup', paint: true },
  { a: 'P1', b: 'CW', w: 12, paint: true },
  { a: 'CW', b: 'CN', w: 10 },
  { a: 'CN', b: 'CE', w: 10 },
  { a: 'CE', b: 'CS', w: 10 },
  { a: 'CS', b: 'CW', w: 10 },
  { a: 'P1', b: 'SPq', w: 8, paint: true },
  { a: 'CN', b: 'SPq', w: 8, paint: true },
  { a: 'CE', b: 'J0', w: 9, paint: true },
  { a: 'J0', b: 'J1', w: 4.5, wUp: 10, zone: 'domeExit', paint: true },
  { a: 'J1', b: 'DMin', w: 8, paint: true },
  { a: 'J1', b: 'DMex', w: 8, paint: true },
  { a: 'CN', b: 'N1', w: 6, unsigned: true, paint: true },
  { a: 'N1', b: 'DMin', w: 6, unsigned: true, paint: true },
  { a: 'CE', b: 'TH', w: 8, paint: true },
  { a: 'TH', b: 'SH', w: 7, unsigned: true, paint: true },
  { a: 'CS', b: 'DRa', w: 4, wUp: 9, zone: 'merge', paint: true },
  { a: 'DRa', b: 'DRin', w: 6, paint: true },
  { a: 'DRa', b: 'QSR', w: 7, paint: true },
  { a: 'P1', b: 'QSR', w: 8, paint: true },
  { a: 'DRex', b: 'SH', w: 7, paint: true },
  { a: 'SH', b: 'CS', w: 8, paint: true },
  { a: 'CW', b: 'PMx', w: 8 },
  { a: 'PMx', b: 'CS', w: 8 },
  { a: 'PMx', b: 'CART', w: 0, wUp: 5, upOnly: true, paint: true },
];

export interface DestDef {
  key: string;
  entry: string;
  exit: string;
  dwell: [number, number];
  weight: number;
  /** Stays visible while dwelling (a cart, not a ride). */
  visibleDwell?: boolean;
  upOnly?: boolean;
}

export const DESTS: DestDef[] = [
  { key: 'dome', entry: 'DMin', exit: 'DMex', dwell: [30, 45], weight: 0.26 },
  { key: 'darkride', entry: 'DRin', exit: 'DRex', dwell: [25, 35], weight: 0.16 },
  { key: 'speedway', entry: 'SPq', exit: 'SPq', dwell: [30, 45], weight: 0.1 },
  { key: 'theater', entry: 'TH', exit: 'TH', dwell: [35, 50], weight: 0.07 },
  { key: 'qsr', entry: 'QSR', exit: 'QSR', dwell: [20, 35], weight: 0.12 },
  { key: 'shop', entry: 'SH', exit: 'SH', dwell: [8, 15], weight: 0.07 },
  { key: 'peoplemover', entry: 'CN', exit: 'PMx', dwell: [20, 30], weight: 0.1 },
  { key: 'hub', entry: 'HUB', exit: 'HUB', dwell: [4, 16], weight: 0.12 },
  { key: 'cart', entry: 'CART', exit: 'CART', dwell: [3, 6], weight: 0.05, visibleDwell: true, upOnly: true },
];

export const nodeById = (id: string): NodeDef => {
  const n = NODES.find((n) => n.id === id);
  if (!n) throw new Error('node ' + id);
  return n;
};

// Landmark positions used by both the scene and the pins.
export const L = {
  spinner: { x: 0, z: 0 },
  dome: { x: 58, z: -52, r: 26 },
  speedway: { x: -62, z: -58, rx: 32, rz: 15 },
  theater: { x: 58, z: 38, r: 15 },
  darkRide: { x: -22, z: 54, w: 32, d: 22 },
  qsr: { x: -50, z: 25, w: 26, d: 16 },
  shop: { x: 22, z: 50 },
  bridge: { x0: -100, x1: -74, w: 14 },
  moat: { x: -88, w: 16 },
  speedwayQueue: { x: -40, z: -36 },
  pickupToday: { x: -46, z: 4 },
  pickupUp: { x: -70, z: 22 },
};
