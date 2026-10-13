// Renders the guest-flow sim as instanced dots, plus standing crowds and
// heat glows over the tracked pinch points.
import * as THREE from 'three';
import { Sim } from './sim';
import { EDGES, L, nodeById } from './layout';

const PALETTE = [0xdfe6ff, 0xb9c6ff, 0x9fe8da, 0xd6c8ff, 0xfff1d6, 0xa9d4ff].map((c) => new THREE.Color(c));
const HOT = new THREE.Color(0xff7a3d);
const JAM = new THREE.Color(0xff3355);

function heatTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface StandGroup {
  today: THREE.Vector2[];
  up: THREE.Vector2[];
}

export class CrowdView {
  private mesh: THREE.InstancedMesh;
  private standMesh: THREE.InstancedMesh;
  private rx: Float32Array;
  private rz: Float32Array;
  private base: THREE.Color[];
  private heat: { mesh: THREE.Mesh; edge: number }[] = [];
  private stand: StandGroup = { today: [], up: [] };
  private m4 = new THREE.Matrix4();
  private col = new THREE.Color();
  private hiddenM = new THREE.Matrix4().makeScale(0, 0, 0);
  private lastStandU = -1;
  private movableStand = 0;

  constructor(scene: THREE.Scene, private sim: Sim) {
    const geo = new THREE.CapsuleGeometry(0.55, 1.0, 2, 8);
    geo.translate(0, 1.1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const n = sim.agents.length;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.rx = new Float32Array(n);
    this.rz = new Float32Array(n);
    this.base = [];
    for (let i = 0; i < n; i++) {
      this.base.push(PALETTE[i % PALETTE.length]);
      this.mesh.setColorAt(i, this.base[i]);
      this.rx[i] = sim.agents[i].x;
      this.rz[i] = sim.agents[i].z;
    }
    scene.add(this.mesh);

    // Standing crowds: mobile-order pickup + dark-ride queue spill (move or
    // disappear in Upgraded), and the speedway queue (always there).
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const add = (t: THREE.Vector2, u: THREE.Vector2) => {
      this.stand.today.push(t);
      this.stand.up.push(u);
    };
    for (let i = 0; i < 26; i++) {
      const t = new THREE.Vector2(L.pickupToday.x - 8 + r() * 14, L.pickupToday.z - 0.5 + r() * 9);
      const u = new THREE.Vector2(L.pickupUp.x - 4 + r() * 8, L.pickupUp.z + 4.5 + r() * 5);
      add(t, u);
    }
    const dra = nodeById('DRa');
    const drin = nodeById('DRin');
    for (let i = 0; i < 12; i++) {
      const t = new THREE.Vector2(dra.x + 1 + r() * 7, dra.z - 4 + r() * 6);
      const u = new THREE.Vector2(drin.x - 3 + (i % 2) * 5.5 + r() * 0.8, drin.z + 2 + (i >> 1) * 0.9);
      add(t, u);
    }
    this.movableStand = this.stand.today.length;
    for (let i = 0; i < 40; i++) {
      const lane = i % 6;
      const v = new THREE.Vector2(L.speedwayQueue.x - 7 + r() * 14, L.speedwayQueue.z - 4 + lane * 2);
      add(v, v);
    }
    this.standMesh = new THREE.InstancedMesh(geo, mat, this.stand.today.length);
    this.standMesh.frustumCulled = false;
    for (let i = 0; i < this.stand.today.length; i++) this.standMesh.setColorAt(i, PALETTE[(i * 7) % PALETTE.length]);
    scene.add(this.standMesh);

    // Heat glows on tracked pinch points.
    const tex = heatTexture();
    EDGES.forEach((e, i) => {
      if (!e.zone) return;
      const a = nodeById(e.a);
      const b = nodeById(e.b);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, color: 0xff6a3d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(b.z - a.z, b.x - a.x) * -1;
      m.scale.set(len * 1.5, 16, 1);
      m.position.set((a.x + b.x) / 2, 0.3, (a.z + b.z) / 2);
      m.renderOrder = 2;
      scene.add(m);
      this.heat.push({ mesh: m, edge: i });
    });
  }

  update(dt: number, u: number) {
    const k = Math.min(1, dt * 12);
    const agents = this.sim.agents;
    for (let i = 0; i < agents.length; i++) {
      const ag = agents[i];
      if (!ag.visible) {
        this.mesh.setMatrixAt(i, this.hiddenM);
        this.rx[i] = ag.x;
        this.rz[i] = ag.z;
        continue;
      }
      const dx = ag.x - this.rx[i];
      const dz = ag.z - this.rz[i];
      if (dx * dx + dz * dz > 400) {
        this.rx[i] = ag.x;
        this.rz[i] = ag.z;
      } else {
        this.rx[i] += dx * k;
        this.rz[i] += dz * k;
      }
      this.m4.makeTranslation(this.rx[i], 0.1, this.rz[i]);
      this.mesh.setMatrixAt(i, this.m4);
      const c = this.sim.agentCrowd(ag);
      if (c < 0.3) this.col.copy(this.base[i]);
      else if (c < 0.65) this.col.copy(this.base[i]).lerp(HOT, (c - 0.3) / 0.35);
      else this.col.copy(HOT).lerp(JAM, (c - 0.65) / 0.35);
      this.mesh.setColorAt(i, this.col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    // Standing crowds: the dark-ride spill fades as it moves inside.
    const n = this.stand.today.length;
    const e = u * u * (3 - 2 * u);
    for (let i = 0; i < n; i++) {
      const a = this.stand.today[i];
      const b = this.stand.up[i];
      this.m4.makeTranslation(a.x + (b.x - a.x) * e, 0.1, a.y + (b.y - a.y) * e);
      this.standMesh.setMatrixAt(i, this.m4);
    }
    this.standMesh.instanceMatrix.needsUpdate = true;
    // Pickup + merge-spill guests read as congestion today, normal once moved.
    if (Math.abs(u - this.lastStandU) > 0.001) {
      this.lastStandU = u;
      for (let i = 0; i < this.movableStand; i++) {
        this.col.copy(HOT).lerp(PALETTE[(i * 7) % PALETTE.length], e);
        this.standMesh.setColorAt(i, this.col);
      }
      if (this.standMesh.instanceColor) this.standMesh.instanceColor.needsUpdate = true;
    }

    for (const h of this.heat) {
      const d = this.sim.edges[h.edge].density;
      const target = Math.min(0.85, Math.max(0, (d - 0.15) / 0.7));
      const mat = h.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 2);
      h.mesh.visible = mat.opacity > 0.01;
    }
  }
}
