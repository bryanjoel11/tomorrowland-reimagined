// Agent-based guest flow model. Deliberately simple: guests walk a graph of
// walkways, slow down as local density rises, and pick their next stop from a
// weighted list. `t` blends between Today (0) and Upgraded (1).
import { NODES, EDGES, DESTS, ZoneKey, DestDef } from './layout';

/** Density (guests per m²) at which walking speed bottoms out. */
const D_JAM = 1.1;
const MIN_SPEED = 0.18;
/** Guests standing still in the walkway (queue spill). */
const STANDING: Partial<Record<ZoneKey, [number, number]>> = {
  // Today the Speedway's slow-loading queue spills onto the walkway [verify];
  // the coaster's covered station queue keeps most of the line off it.
  rideQueue: [22, 4],
};
/** Share of guests who use a wheelchair or ECV and cannot transfer [verify]. */
export const WHEELCHAIR_SHARE = 0.04;
/** Sim runs fast-forwarded: ~5 m/s on screen vs ~1.25 m/s real walking. */
export const REAL_TIME_FACTOR = 4;

interface Edge {
  a: number;
  b: number;
  len: number;
  dx: number;
  dz: number;
  px: number;
  pz: number;
  wToday: number;
  wUp: number;
  unsigned: boolean;
  upOnly: boolean;
  zone?: ZoneKey;
  count: number;
  density: number;
}

interface Agent {
  edge: number;
  dir: 1 | -1;
  s: number;
  lat: number;
  v0: number;
  path: number[]; // remaining node indices after current edge's target
  node: number; // last node reached
  dest: DestDef;
  dwell: number; // >0 while inside an attraction
  legTime: number;
  x: number;
  z: number;
  visible: boolean;
  wheelchair: boolean;
}

export interface SimStats {
  /** Ride trips per real hour, per attraction key, and in total. */
  ridesPerHour: Record<string, number>;
  totalRidesPerHour: number;
  /** Share of guests who can ride the PeopleMover. */
  pmAccess: number;
  avgWalkMin: number;
  crowdIndex: number;
  zoneDensity: Record<ZoneKey, number>;
  worstZone: ZoneKey;
  walking: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sim {
  t: number;
  agents: Agent[] = [];
  edges: Edge[] = [];
  adj: number[][] = [];
  nodeIdx = new Map<string, number>();
  private rand: () => number;
  private legs: number[] = [];
  private legPtr = 0;
  private crowdEma = 0;
  private rideCount: Record<string, number> = {};
  private rideRate: Record<string, number> = {};
  private zoneEma: Record<ZoneKey, number> = { rideQueue: 0, smEntrance: 0, promenade: 0 };

  constructor(count: number, t: number, seed = 7) {
    this.t = t;
    this.rand = rng(seed);
    NODES.forEach((n, i) => this.nodeIdx.set(n.id, i));
    this.adj = NODES.map(() => []);
    EDGES.forEach((e, i) => {
      const a = this.nodeIdx.get(e.a)!;
      const b = this.nodeIdx.get(e.b)!;
      const dx = NODES[b].x - NODES[a].x;
      const dz = NODES[b].z - NODES[a].z;
      const len = Math.hypot(dx, dz);
      this.edges.push({
        a,
        b,
        len,
        dx: dx / len,
        dz: dz / len,
        px: -dz / len,
        pz: dx / len,
        wToday: e.w,
        wUp: e.wUp ?? e.w,
        unsigned: !!e.unsigned,
        upOnly: !!e.upOnly,
        zone: e.zone,
        count: 0,
        density: 0,
      });
      this.adj[a].push(i);
      this.adj[b].push(i);
    });
    for (let i = 0; i < count; i++) this.spawn();
  }

  width(e: Edge) {
    return e.wToday + (e.wUp - e.wToday) * this.t;
  }

  private weight(d: DestDef) {
    return d.weight + ((d.weightUp ?? d.weight) - d.weight) * this.t;
  }

  private pickDest(ag: Agent): DestDef {
    const up = this.t > 0.5;
    const list = DESTS.filter(
      (d) =>
        d !== ag.dest &&
        (!d.upOnly || up) &&
        (!d.todayOnly || !up) &&
        // Today's PeopleMover needs guests to transfer from a wheelchair.
        !(ag.wheelchair && d.key === 'peoplemover' && !up),
    );
    let total = 0;
    for (const d of list) total += this.weight(d);
    let r = this.rand() * total;
    for (const d of list) {
      r -= this.weight(d);
      if (r <= 0) return d;
    }
    return list[list.length - 1];
  }

  private spawn() {
    const hub = this.nodeIdx.get('HUB')!;
    const up = this.t > 0.5;
    const rides = DESTS.filter((d) => d.ride && (!d.upOnly || up) && (!d.todayOnly || !up));
    const dest = rides[Math.floor(this.rand() * rides.length)];
    const a: Agent = {
      edge: -1,
      dir: 1,
      s: 0,
      lat: (this.rand() - 0.5) * 0.9,
      v0: 4.2 + this.rand() * 1.6,
      path: [],
      node: hub,
      dest,
      dwell: this.rand() * 40,
      legTime: 0,
      x: 0,
      z: 0,
      visible: false,
      wheelchair: this.rand() < WHEELCHAIR_SHARE,
    };
    // Start everyone "inside" a random attraction so the land fills evenly.
    a.node = this.nodeIdx.get(dest.exit)!;
    a.x = NODES[a.node].x;
    a.z = NODES[a.node].z;
    this.agents.push(a);
  }

  /** Dijkstra shortest path; unsigned paths cost extra. */
  private route(from: number, to: number): number[] {
    const n = NODES.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === to) break;
      done[u] = 1;
      for (const ei of this.adj[u]) {
        const e = this.edges[ei];
        if (this.width(e) < 1) continue;
        const v = e.a === u ? e.b : e.a;
        let cost = e.len;
        if (e.unsigned) cost *= 2.2; // a back path few guests know about
        if (dist[u] + cost < dist[v]) { dist[v] = dist[u] + cost; prev[v] = u; }
      }
    }
    const path: number[] = [];
    for (let v = to; v !== -1 && v !== from; v = prev[v]) path.unshift(v);
    return path;
  }

  private edgeBetween(a: number, b: number): number {
    for (const ei of this.adj[a]) {
      const e = this.edges[ei];
      if ((e.a === a && e.b === b) || (e.b === a && e.a === b)) return ei;
    }
    return -1;
  }

  private startNextEdge(ag: Agent): boolean {
    const next = ag.path.shift();
    if (next === undefined) return false;
    const ei = this.edgeBetween(ag.node, next);
    const e = this.edges[ei];
    ag.edge = ei;
    ag.dir = e.a === ag.node ? 1 : -1;
    ag.s = 0;
    return true;
  }

  private beginLeg(ag: Agent) {
    ag.dest = this.pickDest(ag);
    const target = this.nodeIdx.get(ag.dest.entry)!;
    ag.path = this.route(ag.node, target);
    ag.legTime = 0;
    if (!this.startNextEdge(ag)) this.arrive(ag);
  }

  private arrive(ag: Agent) {
    if (ag.legTime > 0.5) {
      if (this.legs.length < 400) this.legs.push(ag.legTime);
      else { this.legs[this.legPtr] = ag.legTime; this.legPtr = (this.legPtr + 1) % 400; }
    }
    ag.edge = -1;
    const [lo, hi] = ag.dest.dwell;
    ag.dwell = lo + this.rand() * (hi - lo);
  }

  step(dt: number) {
    const edges = this.edges;
    for (const e of edges) e.count = 0;
    for (const ag of this.agents) if (ag.edge >= 0) edges[ag.edge].count++;
    for (const e of edges) {
      const w = this.width(e);
      const st = e.zone ? STANDING[e.zone] : undefined;
      const standing = st ? st[0] + (st[1] - st[0]) * this.t : 0;
      e.density = w > 0.5 ? (e.count + standing) / (e.len * w) : 0;
    }

    let crowdSum = 0;
    let walking = 0;
    for (const ag of this.agents) {
      if (ag.edge < 0) {
        ag.dwell -= dt;
        const visibleDwell = !!ag.dest.visibleDwell;
        ag.visible = visibleDwell;
        if (ag.dwell <= 0) {
          ag.node = this.nodeIdx.get(ag.dest.exit)!;
          if (ag.dest.ride) this.rideCount[ag.dest.key] = (this.rideCount[ag.dest.key] ?? 0) + 1;
          ag.x = NODES[ag.node].x;
          ag.z = NODES[ag.node].z;
          this.beginLeg(ag);
        } else if (visibleDwell) {
          const n = NODES[ag.node];
          const ang = ag.lat * 13;
          ag.x = n.x + Math.cos(ang) * 2.6;
          ag.z = n.z + Math.sin(ang) * 2.6;
        }
        continue;
      }
      const e = edges[ag.edge];
      const f = Math.max(MIN_SPEED, 1 - e.density / D_JAM);
      crowdSum += Math.min(1, e.density / D_JAM);
      walking++;
      ag.s += ag.v0 * f * dt;
      ag.legTime += dt;
      if (ag.s >= e.len) {
        ag.node = ag.dir === 1 ? e.b : e.a;
        if (!this.startNextEdge(ag)) {
          ag.x = NODES[ag.node].x;
          ag.z = NODES[ag.node].z;
          this.arrive(ag);
          ag.visible = !!ag.dest.visibleDwell;
          continue;
        }
      }
      const ce = edges[ag.edge];
      const start = ag.dir === 1 ? ce.a : ce.b;
      const sx = NODES[start].x;
      const sz = NODES[start].z;
      const off = ag.lat * this.width(ce) * 0.9;
      ag.x = sx + ce.dx * ag.dir * ag.s + ce.px * off;
      ag.z = sz + ce.dz * ag.dir * ag.s + ce.pz * off;
      ag.visible = true;
    }

    // Ride rates: one-minute (sim) moving average of completions.
    const kr = Math.min(1, dt / 60);
    for (const d of DESTS) {
      if (!d.ride) continue;
      const n = this.rideCount[d.key] ?? 0;
      this.rideCount[d.key] = 0;
      const r = this.rideRate[d.key] ?? 0;
      this.rideRate[d.key] = r + (n / dt - r) * kr;
    }
    const k = Math.min(1, dt * 0.5);
    this.crowdEma += ((walking ? (crowdSum / walking) * 100 : 0) - this.crowdEma) * k;
    for (const e of edges) {
      if (e.zone) this.zoneEma[e.zone] += (e.density - this.zoneEma[e.zone]) * k;
    }
  }

  stats(): SimStats {
    const avg = this.legs.length ? this.legs.reduce((a, b) => a + b, 0) / this.legs.length : 0;
    let worst: ZoneKey = 'promenade';
    (Object.keys(this.zoneEma) as ZoneKey[]).forEach((z) => {
      if (this.zoneEma[z] > this.zoneEma[worst]) worst = z;
    });
    // Sim seconds are fast-forwarded by REAL_TIME_FACTOR.
    const perHour: Record<string, number> = {};
    let total = 0;
    for (const [key, r] of Object.entries(this.rideRate)) {
      perHour[key] = (r * 3600) / REAL_TIME_FACTOR;
      total += perHour[key];
    }
    const up = this.t > 0.5;
    return {
      ridesPerHour: perHour,
      totalRidesPerHour: total,
      pmAccess: up ? 1 : 1 - this.agents.filter((a) => a.wheelchair).length / this.agents.length,
      avgWalkMin: (avg * REAL_TIME_FACTOR) / 60,
      crowdIndex: this.crowdEma,
      zoneDensity: { ...this.zoneEma },
      worstZone: worst,
      walking: this.agents.filter((a) => a.edge >= 0).length,
    };
  }

  /** Per-agent density 0..1 (for colouring dots). */
  agentCrowd(ag: Agent): number {
    if (ag.edge < 0) return 0;
    return Math.min(1, this.edges[ag.edge].density / D_JAM);
  }
}
