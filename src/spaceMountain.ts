// Hyperspace Mountain: a procedural Space Mountain that blends Victorian
// launch-cannon engineering (riveted bronze, brass hoops, a Columbiad-style
// cannon on a girder cradle) with a sleek white sculptural shell wrapped in
// sweeping fins. Everything is generated in code; no official art is used.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SpaceMountainOpts {
  renderer: THREE.WebGLRenderer;
  center: { x: number; z: number };
  /** Entrance node on the walkway (guest side). */
  entrance: { x: number; z: number };
  /** Start of the queue walkway leading to the entrance. */
  queueFrom: { x: number; z: number };
  motion: number;
}

const TAU = Math.PI * 2;

// ---------- Procedural textures ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Riveted metal plates: colour map and matching bump map. */
function rivetTextures(base: string, seam: string) {
  const S = 256;
  const plates = (g: CanvasRenderingContext2D, bump: boolean) => {
    g.fillStyle = bump ? '#808080' : base;
    g.fillRect(0, 0, S, S);
    if (!bump) {
      // Subtle patina variation per plate.
      for (let py = 0; py < 2; py++)
        for (let px = 0; px < 2; px++) {
          const a = 0.05 + ((px * 7 + py * 13) % 5) * 0.025;
          g.fillStyle = `rgba(${px ? 255 : 40},${py ? 200 : 60},${px ? 120 : 30},${a})`;
          g.fillRect(px * 128, py * 128, 128, 128);
        }
    }
    g.fillStyle = bump ? '#303030' : seam;
    for (const k of [0, 128]) {
      g.fillRect(k, 0, 3, S);
      g.fillRect(0, k, S, 3);
    }
    for (const k of [0, 128]) {
      for (let i = 10; i < S; i += 16) {
        for (const [x, y] of [[k + 9, i], [i, k + 9]]) {
          g.beginPath();
          g.arc(x, y, 3.2, 0, TAU);
          g.fillStyle = bump ? '#ffffff' : 'rgba(255,230,190,0.55)';
          g.fill();
          if (!bump) {
            g.beginPath();
            g.arc(x + 0.8, y + 0.8, 3.2, 0, TAU);
            g.fillStyle = 'rgba(30,15,5,0.35)';
            g.fill();
          }
        }
      }
    }
  };
  return {
    map: canvasTex(S, S, (g) => plates(g, false)),
    bump: canvasTex(S, S, (g) => plates(g, true), false),
  };
}

/** Faint ceramic panel seams for the white shell. */
function panelTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#f4f7fb';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#d5dde7';
    g.fillRect(0, 0, 128, 2);
    g.fillRect(0, 0, 2, 128);
    g.fillStyle = '#e8edf3';
    g.fillRect(64, 0, 1, 128);
  });
}

// ---------- Geometry helpers ----------
/** Indexed strip between two equal-length polylines. */
function ribbon(a: THREE.Vector3[], b: THREE.Vector3[], closed = false) {
  const n = a.length;
  const pos: number[] = [];
  for (let i = 0; i < n; i++) pos.push(a[i].x, a[i].y, a[i].z, b[i].x, b[i].y, b[i].z);
  const idx: number[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n;
    idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const noUv = (g: THREE.BufferGeometry) => {
  g.deleteAttribute('uv');
  return g;
};
function mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = true, receive = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
}

export function buildSpaceMountain(scene: THREE.Scene, o: SpaceMountainOpts) {
  const { motion } = o;
  const group = new THREE.Group();
  group.position.set(o.center.x, 0, o.center.z);

  // Environment reflections for the metals only (the rest of the night scene stays as is).
  const pmrem = new THREE.PMREMGenerator(o.renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ---------- Materials ----------
  const bronzeTex = rivetTextures('#9a5a32', '#4a2410');
  bronzeTex.map.repeat.set(24, 2);
  bronzeTex.bump.repeat.set(24, 2);
  const bronze = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: bronzeTex.map, bumpMap: bronzeTex.bump, bumpScale: 1.4,
    metalness: 0.75, roughness: 0.42, envMap: env, envMapIntensity: 0.9,
  });
  const barrelTex = rivetTextures('#8f5530', '#3e1e0c');
  barrelTex.map.repeat.set(6, 8);
  barrelTex.bump.repeat.set(6, 8);
  const barrelMat = bronze.clone();
  barrelMat.map = barrelTex.map;
  barrelMat.bumpMap = barrelTex.bump;
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b25a, metalness: 1, roughness: 0.26, envMap: env, envMapIntensity: 1.1 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a3a33, metalness: 0.8, roughness: 0.5, envMap: env, envMapIntensity: 0.6 });
  const panel = panelTexture();
  panel.repeat.set(64, 14);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xc4ceda, map: panel, metalness: 0.1, roughness: 0.42, envMap: env, envMapIntensity: 0.22 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xeef2f7, metalness: 0.15, roughness: 0.24, envMap: env, envMapIntensity: 0.4, side: THREE.DoubleSide });
  const glowCyan = new THREE.MeshBasicMaterial({ color: 0x8ff0ff, toneMapped: false, transparent: true });
  const glowViolet = new THREE.MeshBasicMaterial({ color: 0xc7a4ff, toneMapped: false, transparent: true });
  const glowWarm = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });
  const portholeGlass = new THREE.MeshStandardMaterial({ color: 0x0c2a44, emissive: 0x58d6ff, emissiveIntensity: 1.3, roughness: 0.15 });

  // ---------- Plinth: riveted bronze drum with porthole windows ----------
  const PLINTH_R = 24.6;
  const PLINTH_H = 4.4;
  group.add(mesh(new THREE.CylinderGeometry(PLINTH_R, PLINTH_R + 0.5, PLINTH_H, 128, 1), bronze).translateY(PLINTH_H / 2));
  const bandGeo = (r: number, tube: number) => new THREE.TorusGeometry(r, tube, 10, 160).rotateX(Math.PI / 2);
  group.add(mesh(bandGeo(PLINTH_R + 0.08, 0.34), brass, false).translateY(PLINTH_H));
  group.add(mesh(bandGeo(PLINTH_R + 0.55, 0.3), brass, false).translateY(0.35));
  const PORTS = 36;
  const portRing = new THREE.InstancedMesh(new THREE.TorusGeometry(0.78, 0.16, 8, 24), brass, PORTS);
  const portGlass = new THREE.InstancedMesh(new THREE.CircleGeometry(0.72, 24), portholeGlass, PORTS);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < PORTS; i++) {
    const a = (i / PORTS) * TAU;
    q.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
    m4.compose(new THREE.Vector3(Math.cos(a) * (PLINTH_R + 0.28), 2.3, Math.sin(a) * (PLINTH_R + 0.28)), q, one);
    portRing.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(Math.cos(a) * (PLINTH_R + 0.22), 2.3, Math.sin(a) * (PLINTH_R + 0.22)), q, one);
    portGlass.setMatrixAt(i, m4);
  }
  group.add(portRing, portGlass);

  // ---------- Shell: smooth concave white cone ----------
  const profCtrl = [
    [23.8, PLINTH_H], [22.9, 8], [20.9, 12], [18.2, 16], [15, 20], [11.5, 24], [7.9, 27.4], [4.6, 30], [3.2, 31],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const profCurve = new THREE.SplineCurve(profCtrl);
  const prof = profCurve.getSpacedPoints(64);
  const shellGeo = new THREE.LatheGeometry(prof, 160);
  group.add(mesh(shellGeo, shellMat));
  /** Shell radius and outward normal at profile parameter t (0 = base, 1 = top). */
  const at = (t: number) => {
    const p = profCurve.getPointAt(Math.min(1, Math.max(0, t)));
    const d = profCurve.getTangentAt(Math.min(1, Math.max(0, t)));
    return { r: p.x, y: p.y, nr: d.y, ny: -d.x };
  };
  const onShell = (t: number, th: number, lift = 0) => {
    const s = at(t);
    return new THREE.Vector3(
      Math.cos(th) * (s.r + s.nr * lift),
      s.y + s.ny * lift,
      Math.sin(th) * (s.r + s.nr * lift),
    );
  };
  const normalAt = (t: number, th: number) => {
    const s = at(t);
    return new THREE.Vector3(Math.cos(th) * s.nr, s.ny, Math.sin(th) * s.nr).normalize();
  };

  // ---------- Sweeping sculptural fins with lit edges ----------
  const FINS = 14;
  const N = 90;
  const TWIST = 1.05;
  const TH = 0.42;
  const finParts: THREE.BufferGeometry[] = [];
  const glowParts: THREE.BufferGeometry[] = [];
  const glowParts2: THREE.BufferGeometry[] = [];
  for (let f = 0; f < FINS; f++) {
    const th0 = (f / FINS) * TAU;
    const L1: THREE.Vector3[] = [], L2: THREE.Vector3[] = [], O1: THREE.Vector3[] = [], O2: THREE.Vector3[] = [], E: THREE.Vector3[] = [], G: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = 0.015 + (i / N) * 0.9;
      const th = th0 + TWIST * Math.pow(t, 1.25);
      const S = onShell(t, th, -0.1);
      const S2 = onShell(t + 0.004, th0 + TWIST * Math.pow(t + 0.004, 1.25), -0.1);
      const n = normalAt(t, th);
      const dir = S2.clone().sub(S).normalize();
      const side = new THREE.Vector3().crossVectors(dir, n).normalize();
      const k = i / N;
      const depth = 0.35 + 2.7 * Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.08)), 0.75) * (1 - 0.45 * k);
      const w = TH * (1 - 0.4 * k);
      L1.push(S.clone().addScaledVector(side, -w));
      L2.push(S.clone().addScaledVector(side, w));
      O1.push(S.clone().addScaledVector(side, -w).addScaledVector(n, depth));
      O2.push(S.clone().addScaledVector(side, w).addScaledVector(n, depth));
      E.push(S.clone().addScaledVector(n, depth + 0.02));
      G.push(S.clone().addScaledVector(n, depth + 0.42));
    }
    finParts.push(ribbon(L1, O1), ribbon(O2, L2));
    const edge = new THREE.CatmullRomCurve3(E);
    finParts.push(noUv(new THREE.TubeGeometry(edge, N, TH * 0.95, 8)));
    (f % 2 ? glowParts2 : glowParts).push(noUv(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(G), N, 0.17, 5)));
  }
  group.add(mesh(mergeGeometries(finParts)!, finMat));
  group.add(mesh(mergeGeometries(glowParts)!, glowCyan, false, false));
  group.add(mesh(mergeGeometries(glowParts2)!, glowViolet, false, false));

  // ---------- Swoop: one broad white ribbon riding the fins ----------
  {
    const M = 200;
    const top: THREE.Vector3[] = [], bot: THREE.Vector3[] = [], topO: THREE.Vector3[] = [], botO: THREE.Vector3[] = [];
    for (let i = 0; i < M; i++) {
      const th = (i / M) * TAU;
      const tMid = 0.36 + 0.13 * Math.sin(th + 0.6);
      const lift = 1.5 + 0.3 * Math.sin(th * 2);
      top.push(onShell(tMid + 0.032, th, lift));
      bot.push(onShell(tMid - 0.032, th, lift));
      topO.push(onShell(tMid + 0.032, th, lift + 0.45));
      botO.push(onShell(tMid - 0.032, th, lift + 0.45));
    }
    const sw = mergeGeometries([ribbon(top, bot, true), ribbon(botO, topO, true), ribbon(topO, top, true), ribbon(bot, botO, true)])!;
    group.add(mesh(sw, finMat));
    const lip = new THREE.CatmullRomCurve3(topO, true);
    group.add(mesh(new THREE.TubeGeometry(lip, M, 0.12, 5, true), glowWarm, false, false));
  }

  // ---------- Brass bands with rivets ----------
  const rivetGeo = new THREE.SphereGeometry(0.13, 6, 4);
  const rivetSpots: THREE.Vector3[] = [];
  for (const t of [0.14, 0.62]) {
    const s = at(t);
    const band = mesh(new THREE.TorusGeometry(s.r + 0.12, 0.3, 10, 180).rotateX(Math.PI / 2), brass, false);
    band.position.y = s.y;
    group.add(band);
    const cnt = Math.round(s.r * 5);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU;
      for (const dy of [-0.2, 0.2]) rivetSpots.push(new THREE.Vector3(Math.cos(a) * (s.r + 0.4), s.y + dy, Math.sin(a) * (s.r + 0.4)));
    }
  }
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * TAU;
    rivetSpots.push(new THREE.Vector3(Math.cos(a) * (PLINTH_R + 0.4), PLINTH_H, Math.sin(a) * (PLINTH_R + 0.4)));
  }
  const rivets = new THREE.InstancedMesh(rivetGeo, brass, rivetSpots.length);
  rivetSpots.forEach((p, i) => rivets.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  group.add(rivets);

  // ---------- Crown: brass oculus ring, mini spires and a turning orrery ring ----------
  const topY = 31;
  group.add(mesh(new THREE.TorusGeometry(3.6, 0.42, 12, 64).rotateX(Math.PI / 2), brass, false).translateY(topY));
  const oculus = mesh(new THREE.SphereGeometry(3.1, 32, 12, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b2236, emissive: 0x52d8ff, emissiveIntensity: 1.6, roughness: 0.1 }), false, false);
  oculus.position.y = topY - 0.3;
  oculus.scale.y = 0.6;
  group.add(oculus);
  const miniSpire = new THREE.LatheGeometry(
    [[0, 0], [0.42, 0], [0.36, 1.2], [0.18, 5.5], [0.04, 8.5], [0, 8.6]].map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  const MINI = 12;
  const minis = new THREE.InstancedMesh(miniSpire, finMat, MINI);
  const miniTips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), glowCyan, MINI);
  for (let i = 0; i < MINI; i++) {
    const a = (i / MINI) * TAU;
    const r = 4.5;
    q.setFromEuler(new THREE.Euler(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12));
    m4.compose(new THREE.Vector3(Math.cos(a) * r, topY - 1.6, Math.sin(a) * r), q, one);
    minis.setMatrixAt(i, m4);
    const tip = new THREE.Vector3(0, 8.6, 0).applyQuaternion(q).add(new THREE.Vector3(Math.cos(a) * r, topY - 1.6, Math.sin(a) * r));
    miniTips.setMatrixAt(i, m4.makeTranslation(tip.x, tip.y, tip.z));
  }
  group.add(minis, miniTips);
  const orrery = new THREE.Group();
  orrery.position.y = topY + 3.2;
  const orr1 = mesh(new THREE.TorusGeometry(6.2, 0.12, 6, 96), brass, false, false);
  orr1.rotation.x = Math.PI / 2 + 0.35;
  const orr2 = mesh(new THREE.TorusGeometry(7.4, 0.08, 6, 96), glowCyan, false, false);
  orr2.rotation.x = Math.PI / 2 - 0.25;
  const planetBead = mesh(new THREE.SphereGeometry(0.45, 12, 8), glowWarm, false, false);
  planetBead.position.set(6.2, 0, 0);
  orr1.add(planetBead);
  orrery.add(orr1, orr2);
  group.add(orrery);

  // ---------- Four tall spires with brass collars, tied to the shell ----------
  const spireGeo = new THREE.LatheGeometry(
    [[0, 0], [1.6, 0], [1.4, 2], [1.05, 10], [0.7, 22], [0.35, 34], [0.12, 42], [0, 42.4]].map(([r, y]) => new THREE.Vector2(r, y)),
    20,
  );
  const SPIRE_R = 28.5;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.12;
    const x = Math.cos(a) * SPIRE_R;
    const z = Math.sin(a) * SPIRE_R;
    group.add(mesh(spireGeo, finMat).translateX(x).translateZ(z));
    for (const [y, r] of [[4.4, 1.5], [14, 1.0], [25, 0.72]]) {
      group.add(mesh(new THREE.TorusGeometry(r + 0.1, 0.2, 8, 32).rotateX(Math.PI / 2), brass, false).translateX(x).translateY(y).translateZ(z));
    }
    const tip = mesh(new THREE.SphereGeometry(0.55, 16, 10), glowCyan, false, false);
    tip.position.set(x, 42.6, z);
    group.add(tip);
    // Light line up the spire face.
    const line = mesh(new THREE.CylinderGeometry(0.06, 0.14, 36, 5), glowCyan, false, false);
    line.position.set(Math.cos(a) * (SPIRE_R - 0.75), 22, Math.sin(a) * (SPIRE_R - 0.75));
    line.rotation.set(Math.sin(a) * -0.02, 0, Math.cos(a) * 0.02);
    group.add(line);
    // Brass tie-strut from spire to shell.
    const s = at(0.62);
    const strut = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x * 0.98, s.y, z * 0.98),
      new THREE.Vector3(Math.cos(a) * (s.r + (SPIRE_R - s.r) * 0.5), s.y + 1.4, Math.sin(a) * (s.r + (SPIRE_R - s.r) * 0.5)),
      new THREE.Vector3(Math.cos(a) * (s.r + 0.3), s.y, Math.sin(a) * (s.r + 0.3)),
    ]);
    group.add(mesh(new THREE.TubeGeometry(strut, 20, 0.22, 6), brass, false));
  }

  // ---------- Columbiad launch cannon on a girder cradle ----------
  const CA = Math.PI * 0.25 + 0.15; // azimuth: towards the south-east
  const cannon = new THREE.Group();
  cannon.rotation.y = -CA;
  // Local frame: +x points away from the mountain. Barrel runs from the breech
  // on the cradle (outside) up into the shell at about 32 degrees.
  const breech = new THREE.Vector3(41, 3.6, 0);
  const sIn = at(0.52);
  const muzzle = new THREE.Vector3(sIn.r - 1.5, sIn.y, 0);
  const axis = muzzle.clone().sub(breech);
  const BL = axis.length();
  const barrelProf = [
    [0, -1.3], [1.1, -1.3], [1.5, -0.6], [3.05, 0], [3.2, 0.8], [3.0, 4.2], [2.55, 5.0], [2.45, 16], [2.3, BL - 4], [2.75, BL - 2.4], [2.9, BL - 1.2], [2.6, BL],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const barrel = new THREE.Group();
  barrel.position.copy(breech);
  barrel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  barrel.add(mesh(new THREE.LatheGeometry(barrelProf, 64), barrelMat));
  for (const y of [1.6, 3.6, 8, 12, 16, 20, BL - 3.4]) {
    const r = y < 4.5 ? 3.25 : 2.62;
    barrel.add(mesh(new THREE.TorusGeometry(r, 0.26, 10, 64).rotateX(Math.PI / 2), brass, false).translateY(Math.min(y, BL - 0.5)));
  }
  // Glowing launch rail along the top of the barrel and a charge ring at the muzzle.
  barrel.add(mesh(new THREE.BoxGeometry(0.18, BL - 4, 0.18), glowCyan, false, false).translateY(BL / 2 + 1).translateX(2.55));
  const chargeRings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = mesh(new THREE.TorusGeometry(2.7, 0.1, 6, 48).rotateX(Math.PI / 2), glowCyan.clone(), false, false);
    ring.position.y = 6 + i * ((BL - 9) / 4);
    barrel.add(ring);
    chargeRings.push(ring);
  }
  cannon.add(barrel);
  // Trunnion with a spoked gear wheel either side.
  const trunnionAt = breech.clone().addScaledVector(axis.clone().normalize(), 6);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Group();
    wheel.position.set(trunnionAt.x, trunnionAt.y, side * 3.4);
    wheel.add(mesh(new THREE.TorusGeometry(2.6, 0.3, 8, 40), brass));
    for (let k = 0; k < 8; k++) {
      const sp = mesh(new THREE.BoxGeometry(0.18, 5.0, 0.18), iron);
      sp.rotation.z = (k / 8) * Math.PI;
      wheel.add(sp);
    }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      const tooth = mesh(new THREE.BoxGeometry(0.4, 0.5, 0.35), brass, false);
      tooth.position.set(Math.cos(a) * 2.95, Math.sin(a) * 2.95, 0);
      tooth.rotation.z = a;
      wheel.add(tooth);
    }
    wheel.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 16).rotateX(Math.PI / 2), brass));
    cannon.add(wheel);
  }
  // Girder cradle: lattice towers under the barrel.
  const girder = new THREE.BoxGeometry(1, 1, 1);
  const girders: THREE.Matrix4[] = [];
  const beam = (a: THREE.Vector3, b: THREE.Vector3, t = 0.32) => {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const d = b.clone().sub(a);
    const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    girders.push(new THREE.Matrix4().compose(mid, qq, new THREE.Vector3(t, d.length(), t)));
  };
  const under = (u: number) => breech.clone().addScaledVector(axis, u).add(new THREE.Vector3(0, -2.4, 0));
  for (const u of [0.12, 0.34, 0.58]) {
    const top = under(u);
    for (const side of [-1, 1]) {
      const footOut = new THREE.Vector3(top.x + 1.6, 0, side * 3.4);
      const footIn = new THREE.Vector3(top.x - 1.6, 0, side * 3.4);
      const t1 = new THREE.Vector3(top.x + 0.6, top.y, side * 1.6);
      const t2 = new THREE.Vector3(top.x - 0.6, top.y, side * 1.6);
      beam(footOut, t1, 0.42);
      beam(footIn, t2, 0.42);
      // X bracing between the legs
      const levels = Math.max(1, Math.floor(top.y / 3.2));
      for (let k = 0; k < levels; k++) {
        const f0 = k / levels;
        const f1 = (k + 1) / levels;
        const pa = footOut.clone().lerp(t1, f0);
        const pb = footIn.clone().lerp(t2, f1);
        const pc = footIn.clone().lerp(t2, f0);
        const pd = footOut.clone().lerp(t1, f1);
        beam(pa, pb, 0.16);
        beam(pc, pd, 0.16);
        beam(pa, pc, 0.18);
      }
    }
    beam(new THREE.Vector3(top.x, top.y, -1.8), new THREE.Vector3(top.x, top.y, 1.8), 0.4);
  }
  // Ground plinth for the cradle.
  cannon.add(mesh(new THREE.BoxGeometry(BL * 0.62, 0.6, 9), bronze).translateX(breech.x - BL * 0.26).translateY(0.3));
  const gm = new THREE.InstancedMesh(girder, iron, girders.length);
  gm.castShadow = true;
  girders.forEach((g, i) => gm.setMatrixAt(i, g));
  cannon.add(gm);
  // Brass collar where the barrel enters the shell.
  const collar = mesh(new THREE.TorusGeometry(3.3, 0.45, 12, 48), brass, false);
  collar.position.copy(muzzle.clone().addScaledVector(axis.clone().normalize(), -0.6));
  collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  cannon.add(collar);
  group.add(cannon);

  // ---------- Hyperspace streak shell (animated light-speed effect) ----------
  const uniforms = { uTime: { value: 0 } };
  const streakMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(float n){ return fract(sin(n*12.9898)*43758.5453); }
      void main(){
        float cols = 120.0;
        float c = floor(vUv.x * cols);
        float r = h(c);
        float fx = abs(fract(vUv.x * cols) - 0.5);
        float line = smoothstep(0.3, 0.0, fx);
        float s = fract(vUv.y * (1.0 + r) - uTime * (0.3 + r * 0.8) + r * 7.0);
        float head = smoothstep(0.0, 0.025, s) * smoothstep(0.28, 0.0, s);
        float a = line * head * (0.45 + 0.55 * step(0.42, r)) * smoothstep(0.02, 0.12, vUv.y);
        vec3 col = mix(vec3(0.4,0.85,1.0), vec3(0.85,0.72,1.0), r);
        col = mix(col, vec3(1.0), smoothstep(0.07, 0.0, s));
        gl_FragColor = vec4(col * a * 1.7, a);
      }`,
  });
  const streakProf = prof.map((p, i) => {
    const s = at(i / (prof.length - 1));
    return new THREE.Vector2(p.x + s.nr * 0.08, p.y + s.ny * 0.08);
  });
  group.add(mesh(new THREE.LatheGeometry(streakProf, 160), streakMat, false, false));

  // Ground glow ring
  group.add(mesh(new THREE.TorusGeometry(PLINTH_R + 1.4, 0.22, 6, 160).rotateX(Math.PI / 2), glowCyan, false, false).translateY(0.15));
  scene.add(group);

  // ---------- Entrance portal and queue light bars ----------
  const portal = new THREE.Group();
  portal.position.set(o.entrance.x, 0, o.entrance.z);
  portal.rotation.y = -Math.atan2(o.center.z - o.entrance.z, o.center.x - o.entrance.x);
  // local +x points toward the mountain; guests approach from -x.
  portal.add(mesh(new THREE.BoxGeometry(1.4, 12, 17), bronze).translateX(-1.4).translateY(6));
  for (const z of [-8.6, 8.6]) {
    const fin = new THREE.Group();
    fin.position.set(-2.6, 0, z);
    fin.rotation.y = z > 0 ? 0.28 : -0.28;
    fin.add(mesh(new THREE.BoxGeometry(7, 16, 0.9), finMat).translateY(8));
    fin.add(mesh(new THREE.BoxGeometry(6.6, 0.2, 0.2), glowCyan, false, false).translateY(15.9).translateZ(z > 0 ? 0.5 : -0.5));
    fin.add(mesh(new THREE.BoxGeometry(7.2, 0.4, 1.1), brass, false).translateY(0.2));
    portal.add(fin);
  }
  const ringG = new THREE.Group();
  ringG.position.set(-2.4, 6.6, 0);
  ringG.rotation.y = Math.PI / 2;
  ringG.add(mesh(new THREE.TorusGeometry(4.8, 0.55, 14, 64), brass, false));
  ringG.add(mesh(new THREE.TorusGeometry(4.1, 0.16, 8, 64), glowCyan, false, false));
  const tunnel = mesh(new THREE.CylinderGeometry(4.0, 1.2, 6, 48, 1, true).rotateX(Math.PI / 2).translate(0, 0, 3), streakMat, false, false);
  ringG.add(tunnel);
  const ringSegs = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const seg = mesh(new THREE.BoxGeometry(0.7, 0.26, 0.26), i % 2 ? glowViolet : glowCyan, false, false);
    seg.position.set(Math.cos(a) * 5.7, Math.sin(a) * 5.7, 0);
    seg.rotation.z = a + Math.PI / 2;
    ringSegs.add(seg);
  }
  ringG.add(ringSegs);
  portal.add(ringG);
  scene.add(portal);
  const qBars: THREE.Vector3[] = [];
  const qx = o.entrance.x - o.queueFrom.x;
  const qz = o.entrance.z - o.queueFrom.z;
  const qLen = Math.hypot(qx, qz);
  for (let d = 4; d < qLen - 3; d += 3.2) {
    const t = d / qLen;
    for (const sd of [-1, 1]) qBars.push(new THREE.Vector3(o.queueFrom.x + qx * t - (qz / qLen) * 4.4 * sd, 0, o.queueFrom.z + qz * t + (qx / qLen) * 4.4 * sd));
  }
  const qBarMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 8), glowCyan, qBars.length);
  qBars.forEach((p, i) => qBarMesh.setMatrixAt(i, m4.makeTranslation(p.x, 1.3, p.z)));
  scene.add(qBarMesh);

  // ---------- Animation ----------
  return (dt: number, time: number) => {
    const t = time * motion;
    uniforms.uTime.value = t;
    const pulse = 0.78 + 0.22 * Math.sin(t * 2.2);
    glowCyan.opacity = pulse;
    glowViolet.opacity = 1.15 - pulse * 0.5;
    orrery.rotation.y += dt * 0.25 * motion;
    ringSegs.rotation.z -= dt * 1.4 * motion;
    // Charge sequence: hoops light breech to muzzle, then reset.
    const cycle = (t * 0.5) % 1;
    chargeRings.forEach((r, i) => {
      const on = cycle * 6 > i ? 1 : 0.12;
      (r.material as THREE.MeshBasicMaterial).opacity = on;
      (r.material as THREE.MeshBasicMaterial).transparent = true;
    });
  };
}
