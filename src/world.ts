// Procedural scene: every mesh here is built in code from three.js primitives.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EDGES, L, nodeById, EdgeDef } from './layout';

const C = {
  white: 0xe9edf8,
  silver: 0xaab3cf,
  ground: 0x141a36,
  walk: 0x5d6690,
  plaza: 0x6a73a0,
  blue: 0x3d7bff,
  ember: 0xff7a3d,
  emberGlow: 0xffb15c,
  nebula: 0x7c5cff,
  aurora: 0x3ddcc0,
  foliage: 0x2a8a7e,
  asphalt: 0x262b44,
};

export const mats = {
  white: new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.45, metalness: 0.1, flatShading: true }),
  silver: new THREE.MeshStandardMaterial({ color: C.silver, roughness: 0.3, metalness: 0.6, flatShading: true }),
  ground: new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 }),
  walk: new THREE.MeshStandardMaterial({ color: C.walk, roughness: 0.85 }),
  plaza: new THREE.MeshStandardMaterial({ color: C.plaza, roughness: 0.8 }),
  asphalt: new THREE.MeshStandardMaterial({ color: C.asphalt, roughness: 0.9 }),
  blueGlow: new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blue, emissiveIntensity: 2.2 }),
  blueSoft: new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blue, emissiveIntensity: 0.7 }),
  emberGlow: new THREE.MeshStandardMaterial({ color: C.ember, emissive: C.ember, emissiveIntensity: 2.6 }),
  warmGlow: new THREE.MeshStandardMaterial({ color: C.emberGlow, emissive: C.emberGlow, emissiveIntensity: 2.2 }),
  nebulaGlow: new THREE.MeshStandardMaterial({ color: C.nebula, emissive: C.nebula, emissiveIntensity: 1.2 }),
  auroraGlow: new THREE.MeshStandardMaterial({ color: C.aurora, emissive: C.aurora, emissiveIntensity: 1.8 }),
  foliage: new THREE.MeshStandardMaterial({ color: C.foliage, roughness: 0.8, flatShading: true }),
  water: new THREE.MeshStandardMaterial({ color: 0x0c1f52, emissive: 0x081640, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.4 }),
  sail: new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0e1430, roughness: 0.7 }),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  return m;
}

/** Animated element driven by the Today/Upgraded blend (0..1). */
type Blend = (u: number) => void;

export interface World {
  update(dt: number, time: number, u: number): void;
  edgeWidth: (e: EdgeDef, u: number) => number;
}

export function buildWorld(scene: THREE.Scene, opts: { reducedMotion: boolean }): World {
  const blends: Blend[] = [];
  const animators: ((dt: number, time: number) => void)[] = [];
  const motion = opts.reducedMotion ? 0.35 : 1;

  // ---------- Sky + stars ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = clamp(vP.y, -0.1, 1.0);
          vec3 top = vec3(0.027,0.043,0.10);
          vec3 mid = vec3(0.10,0.08,0.26);
          vec3 hor = vec3(0.55,0.24,0.20);
          vec3 fogc = vec3(0.055,0.078,0.19);
          vec3 c = mix(hor, mid, smoothstep(0.02, 0.2, h));
          c = mix(c, top, smoothstep(0.14, 0.6, h));
          c = mix(fogc, c, smoothstep(-0.02, 0.03, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const y = 0.08 + Math.pow(Math.random(), 0.7) * 0.92;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(th) * r * 820, y * 820, Math.sin(th) * r * 820], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false })));

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight(0x8090ff, 0x1a1030, 1.0));
  const moon = new THREE.DirectionalLight(0xd2dcff, 2.0);
  moon.position.set(-90, 160, 70);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -150; sc.right = 150; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 420;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.6;
  moon.shadow.radius = 4;
  scene.add(moon);
  const dusk = new THREE.DirectionalLight(0xff9a6a, 0.7);
  dusk.position.set(160, 30, -40);
  scene.add(dusk);
  const plazaLight = new THREE.PointLight(0xffb15c, 150, 60, 1.6);
  plazaLight.position.set(0, 18, 0);
  scene.add(plazaLight);
  const domeLight = new THREE.PointLight(0x5d8bff, 300, 80, 1.6);
  domeLight.position.set(40, 10, -16);
  scene.add(domeLight);

  // ---------- Ground, moat, hub ----------
  const ground = mesh(new THREE.CircleGeometry(1400, 72), mats.ground, false, true);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const moat = mesh(new THREE.PlaneGeometry(L.moat.w, 360), mats.water, false, true);
  moat.rotation.x = -Math.PI / 2;
  moat.position.set(L.moat.x, 0.04, 0);
  scene.add(moat);

  const hub = mesh(new THREE.CylinderGeometry(22, 22, 0.14, 48), mats.plaza, false, true);
  hub.position.set(-124, 0.07, 0);
  scene.add(hub);

  // ---------- Walkways ----------
  const edgeWidth = (e: EdgeDef, u: number) => e.w + ((e.wUp ?? e.w) - e.w) * u;
  const stripGeo = new THREE.BoxGeometry(1, 0.12, 0.35);
  const walkGeo = new THREE.BoxGeometry(1, 0.12, 1);
  const nodeR = new Map<string, number>();
  for (const e of EDGES) {
    if (!e.paint) continue;
    const a = nodeById(e.a);
    const b = nodeById(e.b);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const ang = -Math.atan2(dz, dx);
    const g = new THREE.Group();
    g.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    g.rotation.y = ang;
    const w = mesh(walkGeo, mats.walk, false, true);
    w.position.y = 0.06;
    g.add(w);
    const s1 = mesh(stripGeo, mats.blueSoft, false, false);
    const s2 = mesh(stripGeo, mats.blueSoft, false, false);
    s1.position.y = s2.position.y = 0.1;
    g.add(s1, s2);
    const apply = (width: number) => {
      const vis = width > 0.3;
      g.visible = vis;
      w.scale.set(len, 1, Math.max(0.01, width));
      s1.scale.x = s2.scale.x = Math.max(0, len - width * 0.6);
      s1.position.z = width / 2;
      s2.position.z = -width / 2;
    };
    apply(e.w);
    if (e.wUp !== undefined) blends.push((u) => apply(edgeWidth(e, u)));
    scene.add(g);
    const r = Math.max(e.w, e.wUp ?? 0) / 2;
    if (!e.upOnly) {
      nodeR.set(e.a, Math.max(nodeR.get(e.a) ?? 0, e.zone ? 3 : r));
      nodeR.set(e.b, Math.max(nodeR.get(e.b) ?? 0, e.zone ? 3 : r));
    }
  }
  const discGeo = new THREE.CylinderGeometry(1, 1, 0.12, 28);
  nodeR.forEach((r, id) => {
    const n = nodeById(id);
    if (Math.hypot(n.x, n.z) < 24) return;
    const d = mesh(discGeo, mats.walk, false, true);
    d.scale.set(r, 1, r);
    d.position.set(n.x, 0.061, n.z);
    scene.add(d);
  });

  // Central plaza disc + glowing ring
  const plaza = mesh(new THREE.CylinderGeometry(26, 26, 0.16, 64), mats.plaza, false, true);
  plaza.position.y = 0.08;
  scene.add(plaza);
  const ring = mesh(new THREE.TorusGeometry(25.6, 0.22, 6, 96), mats.blueGlow, false, false);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  scene.add(ring);

  // ---------- Hub bridge ----------
  const bridgeLen = L.bridge.x1 - L.bridge.x0;
  const bx = (L.bridge.x0 + L.bridge.x1) / 2;
  scene.add(box(bridgeLen, 0.8, L.bridge.w, mats.white, bx, 0.3, 0));
  for (const side of [-1, 1]) {
    scene.add(box(bridgeLen, 1.1, 0.4, mats.silver, bx, 1.2, side * (L.bridge.w / 2 - 0.2)));
    scene.add(box(bridgeLen, 0.12, 0.5, mats.blueGlow, bx, 1.8, side * (L.bridge.w / 2 - 0.2)));
    for (let i = 0; i <= 3; i++) {
      const x = L.bridge.x0 + (bridgeLen * i) / 3;
      scene.add(cyl(0.2, 0.25, 6, 8, mats.silver, x, 3.6, side * (L.bridge.w / 2 + 0.3)));
      const globe = mesh(new THREE.IcosahedronGeometry(0.7, 1), mats.warmGlow, false, false);
      globe.position.set(x, 6.9, side * (L.bridge.w / 2 + 0.3));
      scene.add(globe);
      const halo = mesh(new THREE.TorusGeometry(1.1, 0.08, 6, 24), mats.silver, false, false);
      halo.position.copy(globe.position);
      halo.rotation.x = Math.PI / 2;
      scene.add(halo);
    }
  }
  // Entrance gateway: two leaning pylons
  for (const side of [-1, 1]) {
    const p = mesh(new THREE.CylinderGeometry(0.4, 1.4, 22, 6), mats.white);
    p.position.set(-70, 10, side * 11);
    p.rotation.x = side * 0.18;
    scene.add(p);
    const tip = mesh(new THREE.IcosahedronGeometry(0.9, 1), mats.emberGlow, false, false);
    tip.position.set(-70, 21, side * 13);
    scene.add(tip);
  }

  // ---------- Rocket spinner on top of the people mover station ----------
  const station = new THREE.Group();
  station.add(cyl(9.5, 10.5, 8, 24, mats.white, 0, 4, 0));
  station.add(cyl(10.6, 10.6, 0.6, 24, mats.blueGlow, 0, 6.2, 0));
  station.add(cyl(12.5, 12.5, 1, 32, mats.silver, 0, 8.6, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    station.add(cyl(0.5, 0.5, 5, 8, mats.silver, Math.cos(a) * 6, 11.5, Math.sin(a) * 6));
  }
  station.add(cyl(8, 7, 1.4, 24, mats.white, 0, 14.6, 0));
  station.add(cyl(1.4, 1.8, 18, 10, mats.silver, 0, 23, 0));
  const planet = mesh(new THREE.IcosahedronGeometry(3.2, 1), mats.nebulaGlow);
  planet.position.y = 33.5;
  station.add(planet);
  const ringsG = new THREE.Group();
  ringsG.position.y = 33.5;
  for (const [r, tilt] of [[5.2, 0.4], [6.6, -0.5]] as const) {
    const t = mesh(new THREE.TorusGeometry(r, 0.18, 6, 48), mats.warmGlow, false, false);
    t.rotation.x = Math.PI / 2 + tilt;
    ringsG.add(t);
  }
  const moons: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = mesh(new THREE.IcosahedronGeometry(0.7, 0), mats.white);
    moons.push(m);
    ringsG.add(m);
  }
  station.add(ringsG);

  const rocketGeo = (() => {
    const body = new THREE.CylinderGeometry(0.85, 0.85, 3.4, 10);
    const nose = new THREE.ConeGeometry(0.85, 1.8, 10);
    nose.translate(0, 2.6, 0);
    const fins: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.BoxGeometry(0.12, 1.4, 1.2);
      f.translate(0, -1.2, 0.95);
      f.rotateY((i / 3) * Math.PI * 2);
      fins.push(f);
    }
    const g = mergeGeometries([body, nose, ...fins])!;
    g.rotateZ(-Math.PI / 2); // point along +x
    return g;
  })();
  const nozzleGeo = new THREE.ConeGeometry(0.6, 0.9, 8).rotateZ(Math.PI / 2);
  const arms = new THREE.Group();
  arms.position.y = 19;
  const rockets: THREE.Group[] = [];
  const ROCKETS = 10;
  for (let i = 0; i < ROCKETS; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / ROCKETS) * Math.PI * 2;
    const arm = box(9, 0.35, 0.35, mats.silver, 4.5, 0, 0);
    pivot.add(arm);
    const rk = new THREE.Group();
    rk.position.set(9.6, 0, 0);
    const body = mesh(rocketGeo, mats.white);
    body.rotation.y = Math.PI / 2; // tangent to the circle
    rk.add(body);
    const nz = mesh(nozzleGeo, mats.emberGlow, false, false);
    nz.rotation.y = Math.PI / 2;
    nz.position.z = 2.3;
    rk.add(nz);
    pivot.add(rk);
    arms.add(pivot);
    rockets.push(pivot);
  }
  station.add(arms);
  scene.add(station);
  animators.push((dt, time) => {
    arms.rotation.y -= dt * 0.55 * motion;
    rockets.forEach((p, i) => {
      p.rotation.z = Math.sin(time * 0.8 * motion + i * 1.7) * 0.18;
    });
    ringsG.rotation.y += dt * 0.25 * motion;
    moons.forEach((m, i) => {
      const a = time * (0.6 + i * 0.25) * motion + i * 2;
      m.position.set(Math.cos(a) * (5.9 + i * 0.4), Math.sin(a * 0.7) * 1.2, Math.sin(a) * (5.9 + i * 0.4));
    });
  });

  // ---------- People mover elevated track ----------
  const trackPts = [
    [-16, 5], [0, 6.5], [16, 5], [25, -9], [35, -30], [52, -44], [70, -52], [82, -36], [72, -14],
    [58, 4], [42, 40], [26, 60], [4, 66], [-18, 62], [-40, 54], [-58, 40], [-46, 16], [-30, 6],
  ].map(([x, z]) => new THREE.Vector3(x, 9.6, z));
  const track = new THREE.CatmullRomCurve3(trackPts, true, 'centripetal');
  const SEG = 260;
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  const beams = new THREE.InstancedMesh(beamGeo, mats.white, SEG);
  const glows = new THREE.InstancedMesh(beamGeo, mats.blueGlow, SEG);
  beams.castShadow = true;
  beams.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const pts = track.getSpacedPoints(SEG);
  for (let i = 0; i < SEG; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    tmp.subVectors(b, a).normalize();
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tmp);
    m4.compose(mid, q, new THREE.Vector3(len * 1.04, 0.9, 3.4));
    beams.setMatrixAt(i, m4);
    m4.compose(mid.clone().setY(mid.y - 0.6), q, new THREE.Vector3(len * 1.04, 0.22, 3.6));
    glows.setMatrixAt(i, m4);
  }
  scene.add(beams, glows);
  const colPos: THREE.Vector3[] = [];
  const totalLen = track.getLength();
  const inside = (p: THREE.Vector3) =>
    Math.hypot(p.x - L.dome.x, p.z - L.dome.z) < L.dome.r - 1 ||
    Math.hypot(p.x, p.z) < 13 ||
    (Math.abs(p.x - L.darkRide.x) < L.darkRide.w / 2 && Math.abs(p.z - L.darkRide.z) < L.darkRide.d / 2);
  for (let d = 0; d < totalLen; d += 13) {
    const p = track.getPointAt(d / totalLen);
    if (!inside(p)) colPos.push(p);
  }
  const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.8, 9.2, 8), mats.silver, colPos.length);
  cols.castShadow = true;
  colPos.forEach((p, i) => {
    m4.compose(new THREE.Vector3(p.x, 4.6, p.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    cols.setMatrixAt(i, m4);
  });
  scene.add(cols);

  const TRAINS = 9;
  const CARS = 4;
  const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(3.3, 1.7, 2.6), mats.white, TRAINS * CARS);
  const carWin = new THREE.InstancedMesh(new THREE.BoxGeometry(3.36, 0.45, 2.66), mats.blueGlow, TRAINS * CARS);
  carBody.castShadow = true;
  scene.add(carBody, carWin);
  let trackPhase = 0;
  const fwd = new THREE.Vector3(1, 0, 0);
  animators.push((dt) => {
    trackPhase = (trackPhase + dt * 4.5 * motion) % totalLen;
    let k = 0;
    for (let t = 0; t < TRAINS; t++) {
      for (let c = 0; c < CARS; c++) {
        const d = (trackPhase + (t * totalLen) / TRAINS - c * 3.6 + totalLen) % totalLen;
        const u = d / totalLen;
        const p = track.getPointAt(u);
        const tan = track.getTangentAt(u);
        q.setFromUnitVectors(fwd, tan);
        m4.compose(p.setY(11), q, new THREE.Vector3(1, 1, 1));
        carBody.setMatrixAt(k, m4);
        m4.compose(p.setY(11.3), q, new THREE.Vector3(1, 1, 1));
        carWin.setMatrixAt(k, m4);
        k++;
      }
    }
    carBody.instanceMatrix.needsUpdate = true;
    carWin.instanceMatrix.needsUpdate = true;
  });

  // ---------- Indoor coaster dome ----------
  const dome = new THREE.Group();
  dome.position.set(L.dome.x, 0, L.dome.z);
  const prof = [
    [26, 0], [25.4, 3], [23, 8.5], [19, 14], [13.5, 19], [7.5, 22.4], [2.6, 24], [0, 24.3],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  dome.add(mesh(new THREE.LatheGeometry(prof, 28), mats.white));
  const ribCurve = new THREE.CatmullRomCurve3(prof.map((p) => new THREE.Vector3(p.x + 0.35, p.y + 0.1, 0)));
  const ribGeo = new THREE.TubeGeometry(ribCurve, 24, 0.38, 5);
  for (let i = 0; i < 14; i++) {
    const r = mesh(ribGeo, mats.silver);
    r.rotation.y = (i / 14) * Math.PI * 2;
    dome.add(r);
  }
  const base = mesh(new THREE.TorusGeometry(26.3, 0.45, 6, 96), mats.blueGlow, false, false);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.8;
  dome.add(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const sp = mesh(new THREE.ConeGeometry(0.9, 34, 6), mats.white);
    sp.position.set(Math.cos(a) * 29, 17, Math.sin(a) * 29);
    dome.add(sp);
    const tip = mesh(new THREE.IcosahedronGeometry(0.8, 1), mats.emberGlow, false, false);
    tip.position.set(Math.cos(a) * 29, 34.5, Math.sin(a) * 29);
    dome.add(tip);
  }
  scene.add(dome);
  // Entrance + exit portals (facing the nodes)
  const portal = (nx: number, nz: number, glow: THREE.Material) => {
    const dx = nx - L.dome.x;
    const dz = nz - L.dome.z;
    const a = Math.atan2(dz, dx);
    const g = new THREE.Group();
    g.position.set(L.dome.x + Math.cos(a) * 25, 0, L.dome.z + Math.sin(a) * 25);
    g.rotation.y = -a;
    g.add(box(7, 6, 8, mats.white, 1.5, 3, 0));
    g.add(box(0.3, 4.6, 5.4, mats.dark, 5.05, 2.5, 0));
    g.add(box(0.4, 0.4, 8.4, glow, 5.1, 6.1, 0));
    scene.add(g);
  };
  const dmIn = nodeById('DMin');
  const dmEx = nodeById('DMex');
  portal(dmIn.x, dmIn.z, mats.blueGlow);
  portal(dmEx.x, dmEx.z, mats.emberGlow);

  // ---------- Speedway ----------
  const sw = L.speedway;
  const ellipse = (rx: number, rz: number, cw: boolean) => {
    const s = new THREE.Path();
    s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, cw, 0);
    return s;
  };
  const trackShape = new THREE.Shape(ellipse(sw.rx + 3.4, sw.rz + 3.4, false).getPoints(80));
  trackShape.holes.push(ellipse(sw.rx - 3.4, sw.rz - 3.4, true));
  const swTrack = mesh(new THREE.ShapeGeometry(trackShape, 80), mats.asphalt, false, true);
  swTrack.rotation.x = -Math.PI / 2;
  swTrack.position.set(sw.x, 0.07, sw.z);
  scene.add(swTrack);
  for (const [rx, rz] of [[sw.rx + 3.6, sw.rz + 3.6], [sw.rx - 3.6, sw.rz - 3.6]]) {
    const curve = new THREE.EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
    const p3 = curve.getPoints(120).map((p) => new THREE.Vector3(p.x, 0.5, p.y));
    const rail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p3, true), 120, 0.22, 4, true), mats.silver, false, false);
    rail.position.set(sw.x, 0, sw.z);
    scene.add(rail);
  }
  const infield = mesh(new THREE.CircleGeometry(1, 48), mats.foliage, false, true);
  infield.scale.set(sw.rx - 3.4, sw.rz - 3.4, 1);
  infield.rotation.x = -Math.PI / 2;
  infield.position.set(sw.x, 0.05, sw.z);
  scene.add(infield);
  const swCarColors = [0xff7a3d, 0x3d7bff, 0xffd166, 0x3ddcc0, 0xe8ecff, 0x7c5cff];
  const swCars: THREE.Group[] = [];
  const swCarGeo = mergeGeometries([
    new THREE.BoxGeometry(2.8, 0.7, 1.5).translate(0, 0.6, 0),
    new THREE.BoxGeometry(1.0, 0.6, 1.1).translate(-0.3, 1.15, 0),
    new THREE.ConeGeometry(0.75, 1.1, 4).rotateZ(-Math.PI / 2).translate(1.9, 0.6, 0),
  ])!;
  swCarColors.forEach((col) => {
    const g = new THREE.Group();
    const m = mesh(swCarGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, flatShading: true }));
    g.add(m);
    scene.add(g);
    swCars.push(g);
  });
  animators.push((_dt, time) => {
    swCars.forEach((g, i) => {
      const a = time * (0.16 + i * 0.012) * motion + i * 1.05;
      const lane = i % 2 ? 1.4 : -1.4;
      const x = Math.cos(a) * (sw.rx + lane);
      const z = Math.sin(a) * (sw.rz + lane);
      g.position.set(sw.x + x, 0.05, sw.z + z);
      const tx = -Math.sin(a) * (sw.rx + lane);
      const tz = Math.cos(a) * (sw.rz + lane);
      g.rotation.y = -Math.atan2(tz, tx);
    });
  });
  // Speedway loading station + queue switchbacks
  const sq = L.speedwayQueue;
  scene.add(box(14, 5, 7, mats.white, sq.x - 14, 2.5, sq.z - 6));
  scene.add(box(14.4, 0.4, 7.4, mats.blueGlow, sq.x - 14, 5.2, sq.z - 6));
  for (let i = 0; i < 6; i++) {
    scene.add(box(15, 0.9, 0.18, mats.silver, sq.x, 0.5, sq.z - 5 + i * 2));
  }
  // Shade sails (upgrade) - rise from the ground.
  const shade = new THREE.Group();
  shade.position.set(sq.x, 0, sq.z);
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-9, 6.5, -7, 9, 5.2, -7, 0, 8.4, 7, 9, 5.2, -7, 9, 7.6, 7, 0, 8.4, 7, -9, 6.5, -7, 0, 8.4, 7, -9, 5.0, 7], 3));
  sailGeo.computeVertexNormals();
  shade.add(mesh(sailGeo, mats.sail));
  for (const [x, z, h] of [[-9, -7, 6.5], [9, -7, 5.2], [0, 7, 8.4], [9, 7, 7.6], [-9, 7, 5]]) {
    shade.add(cyl(0.18, 0.22, h, 6, mats.silver, x, h / 2, z));
  }
  for (const x of [-5, 1, 7]) shade.add(box(1.8, 1.1, 0.12, mats.auroraGlow, x, 2.1, -1.8));
  scene.add(shade);
  blends.push((u) => {
    shade.visible = u > 0.01;
    shade.scale.set(1, Math.max(0.001, u), 1);
  });

  // ---------- Carousel theater ----------
  const th = L.theater;
  const theater = new THREE.Group();
  theater.position.set(th.x, 0, th.z);
  theater.add(cyl(th.r, th.r + 0.6, 9, 36, mats.white, 0, 4.5, 0));
  theater.add(cyl(th.r + 0.25, th.r + 0.25, 0.6, 36, mats.blueGlow, 0, 7.6, 0));
  const roof = mesh(new THREE.CylinderGeometry(4, th.r + 1.2, 3.4, 36), mats.silver);
  roof.position.y = 10.7;
  theater.add(roof);
  theater.add(cyl(4, 4, 1.6, 24, mats.white, 0, 13.1, 0));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const f = box(0.5, 9, 1.2, mats.silver, Math.cos(a) * (th.r + 0.6), 4.5, Math.sin(a) * (th.r + 0.6));
    f.rotation.y = -a;
    theater.add(f);
  }
  const thNode = nodeById('TH');
  const thA = Math.atan2(thNode.z - th.z, thNode.x - th.x);
  const thEnt = new THREE.Group();
  thEnt.rotation.y = -thA;
  thEnt.add(box(5, 0.5, 12, mats.white, th.r + 2.5, 6, 0));
  thEnt.add(box(0.4, 0.3, 12, mats.warmGlow, th.r + 5, 5.8, 0));
  for (const z of [-5.5, 5.5]) thEnt.add(cyl(0.25, 0.25, 6, 6, mats.silver, th.r + 4.5, 3, z));
  theater.add(thEnt);
  scene.add(theater);
  const turntable = new THREE.Group();
  turntable.position.y = 13.95;
  for (let i = 0; i < 6; i++) {
    const s = mesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), mats.warmGlow, false, false);
    const a = (i / 6) * Math.PI * 2;
    s.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2);
    s.rotation.y = -a;
    turntable.add(s);
  }
  theater.add(turntable);
  animators.push((dt) => {
    turntable.rotation.y += dt * 0.2 * motion;
  });

  // ---------- Arcade / blaster dark ride ----------
  const dr = L.darkRide;
  const darkRide = new THREE.Group();
  darkRide.position.set(dr.x, 0, dr.z);
  darkRide.add(box(dr.w, 12, dr.d, mats.white, 0, 6, 0));
  darkRide.add(box(dr.w + 0.6, 0.5, dr.d + 0.6, mats.silver, 0, 12.2, 0));
  for (let i = 0; i < 9; i++) {
    const f = box(0.6, 13, 3.4, mats.silver, -dr.w / 2 + 2 + i * 3.5, 6.5, -dr.d / 2 - 1.3);
    f.rotation.y = 0.5;
    darkRide.add(f);
    const g = box(0.25, 10, 0.25, i % 2 ? mats.nebulaGlow : mats.blueGlow, -dr.w / 2 + 2.9 + i * 3.5, 6.5, -dr.d / 2 - 2.6);
    darkRide.add(g);
  }
  const drSign = new THREE.Group();
  drSign.position.set(6, 16, -dr.d / 2 + 2);
  const signPlanet = mesh(new THREE.IcosahedronGeometry(2.6, 1), mats.nebulaGlow);
  drSign.add(signPlanet);
  const signRing = mesh(new THREE.TorusGeometry(4.2, 0.25, 6, 40), mats.emberGlow, false, false);
  signRing.rotation.x = 1.2;
  drSign.add(signRing);
  darkRide.add(drSign);
  scene.add(darkRide);
  animators.push((dt) => {
    signRing.rotation.z += dt * 0.6 * motion;
  });
  // Today: entrance mouth right on the walkway. Upgraded: recessed two-lane merge portal.
  const drIn = nodeById('DRin');
  const mergePortal = new THREE.Group();
  mergePortal.position.set(drIn.x, 0, drIn.z + 1.5);
  mergePortal.add(box(10, 0.5, 6, mats.white, 0, 5.5, -1));
  for (const x of [-4.6, 0, 4.6]) mergePortal.add(cyl(0.22, 0.22, 5.5, 6, mats.silver, x, 2.75, -3.6));
  mergePortal.add(box(4, 0.5, 0.2, mats.blueGlow, -2.3, 4.6, -3.9));
  mergePortal.add(box(4, 0.5, 0.2, mats.auroraGlow, 2.3, 4.6, -3.9));
  for (let i = 0; i < 4; i++) mergePortal.add(box(0.15, 0.9, 6, mats.silver, -4.6 + i * 3.06, 0.5, -1));
  scene.add(mergePortal);
  blends.push((u) => {
    mergePortal.visible = u > 0.01;
    mergePortal.scale.setScalar(Math.max(0.001, u));
  });

  // ---------- Quick-service restaurant ----------
  const qs = L.qsr;
  const qsr = new THREE.Group();
  qsr.position.set(qs.x, 0, qs.z);
  qsr.add(box(qs.w, 7, qs.d, mats.white, 0, 3.5, 0));
  const vault = mesh(new THREE.CylinderGeometry(9.5, 9.5, qs.w + 3, 20, 1, false, 0, Math.PI), mats.silver);
  vault.rotation.set(0, 0, Math.PI / 2);
  vault.scale.set(0.45, 1, 1);
  vault.position.y = 7;
  qsr.add(vault);
  qsr.add(box(qs.w + 3.2, 0.35, 0.4, mats.warmGlow, 0, 7.1, -qs.d / 2 - 1.5));
  // Today's pickup counter on the promenade side.
  const counter = box(8, 2.4, 1.6, mats.emberGlow, 4, 1.2, -qs.d / 2 - 0.9);
  qsr.add(counter);
  scene.add(qsr);
  blends.push((u) => {
    counter.scale.y = Math.max(0.01, 1 - u);
    counter.visible = u < 0.99;
  });
  // Patio tables
  const umbGeo = new THREE.ConeGeometry(2.2, 0.9, 8);
  for (const [x, z] of [[-30, 30], [-28, 37], [-35, 38], [-66, 30], [-68, 36]]) {
    scene.add(cyl(0.9, 0.9, 1.1, 10, mats.silver, x, 0.55, z));
    scene.add(cyl(0.08, 0.08, 3, 5, mats.silver, x, 1.6, z));
    const u = mesh(umbGeo, mats.white);
    u.position.set(x, 3.3, z);
    scene.add(u);
  }
  // Upgraded pickup pavilion on the side patio.
  const pk = L.pickupUp;
  const pavilion = new THREE.Group();
  pavilion.position.set(pk.x, 0, pk.z);
  pavilion.add(box(8, 0.4, 7, mats.white, 0, 4.4, 0));
  for (const [x, z] of [[-3.6, -3.1], [3.6, -3.1], [-3.6, 3.1], [3.6, 3.1]]) pavilion.add(cyl(0.18, 0.18, 4.4, 6, mats.silver, x, 2.2, z));
  pavilion.add(box(6, 1.2, 1.2, mats.white, 0, 0.6, 2.4));
  pavilion.add(box(5, 1.4, 0.15, mats.auroraGlow, 0, 3.3, 3.2));
  scene.add(pavilion);
  blends.push((u) => {
    pavilion.visible = u > 0.01;
    pavilion.scale.setScalar(Math.max(0.001, u));
  });

  // ---------- Merch shop ----------
  const shopG = new THREE.Group();
  shopG.position.set(L.shop.x, 0, L.shop.z);
  shopG.add(box(14, 6, 10, mats.white, 0, 3, 0));
  const shopRoof = mesh(new THREE.CylinderGeometry(7.5, 7.5, 11, 16, 1, false, 0, Math.PI), mats.silver);
  shopRoof.rotation.set(0, 0, Math.PI / 2);
  shopRoof.scale.set(0.35, 1, 1);
  shopRoof.position.y = 6;
  shopG.add(shopRoof);
  shopG.add(box(10, 3.2, 0.2, mats.warmGlow, 0, 2.2, -5.1));
  scene.add(shopG);

  // ---------- Merch cart (upgrade) ----------
  const cartN = nodeById('CART');
  const cart = new THREE.Group();
  cart.position.set(cartN.x - 3.5, 0, cartN.z + 2.5);
  cart.add(box(3.2, 1.6, 1.8, mats.white, 0, 1.3, 0));
  for (const [x, z] of [[-1.2, -0.95], [1.2, -0.95], [-1.2, 0.95], [1.2, 0.95]]) {
    const wh = cyl(0.45, 0.45, 0.25, 10, mats.dark, x, 0.45, z);
    wh.rotation.x = Math.PI / 2;
    cart.add(wh);
  }
  for (let i = 0; i < 4; i++) cart.add(box(0.85, 0.15, 2.4, i % 2 ? mats.white : mats.emberGlow, -1.35 + i * 0.9, 3.6, 0));
  for (const x of [-1.5, 1.5]) cart.add(cyl(0.07, 0.07, 1.8, 5, mats.silver, x, 2.7, 0));
  cart.add(box(0.8, 0.8, 0.8, mats.auroraGlow, 0.6, 2.5, 0));
  scene.add(cart);
  blends.push((u) => {
    cart.visible = u > 0.01;
    cart.scale.setScalar(Math.max(0.001, u));
  });

  // ---------- Wayfinding totems (upgrade) ----------
  const totems = new THREE.Group();
  const totemSpots = [[-60, -9, 0], [-60, 9, Math.PI], [-38, -7, 0.4], [-4, -26, 0.8], [26, 4, -1]];
  for (const [x, z, r] of totemSpots) {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.rotation.y = r;
    t.add(box(1.4, 5.2, 0.5, mats.white, 0, 2.6, 0));
    t.add(box(1.1, 3.4, 0.08, mats.blueGlow, 0, 3, 0.29));
    t.add(box(1.1, 0.3, 0.08, mats.emberGlow, 0, 4.9, 0.29));
    totems.add(t);
  }
  scene.add(totems);
  blends.push((u) => {
    totems.visible = u > 0.01;
    totems.scale.set(1, Math.max(0.001, u), 1);
  });
  // Back-path signage arch (unsigned today).
  const n1 = nodeById('N1');
  const arch = new THREE.Group();
  arch.position.set(n1.x, 0, n1.z);
  arch.rotation.y = 0.6;
  arch.add(cyl(0.25, 0.25, 5, 6, mats.silver, -3.4, 2.5, 0));
  arch.add(cyl(0.25, 0.25, 5, 6, mats.silver, 3.4, 2.5, 0));
  arch.add(box(7.4, 0.9, 0.3, mats.blueGlow, 0, 5, 0));
  scene.add(arch);
  blends.push((u) => {
    arch.visible = u > 0.01;
    arch.scale.set(1, Math.max(0.001, u), 1);
  });

  // ---------- Planters at the dome exit pinch (slide back when widened) ----------
  const j0 = nodeById('J0');
  const j1 = nodeById('J1');
  const pdx = j1.x - j0.x;
  const pdz = j1.z - j0.z;
  const plen = Math.hypot(pdx, pdz);
  const perp = new THREE.Vector2(-pdz / plen, pdx / plen);
  const planterGeo = new THREE.CylinderGeometry(2, 2.2, 1.2, 10);
  const treeGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const planters: { g: THREE.Group; side: number; t: number }[] = [];
  for (const side of [-1, 1]) {
    for (const t of [0.3, 0.7]) {
      const g = new THREE.Group();
      g.add(mesh(planterGeo, mats.white).translateY(0.6));
      g.add(mesh(treeGeo, mats.foliage).translateY(3.4));
      scene.add(g);
      planters.push({ g, side, t });
    }
  }
  const pinchEdge = EDGES.find((e) => e.zone === 'domeExit')!;
  blends.push((u) => {
    const w = edgeWidth(pinchEdge, u);
    for (const p of planters) {
      const off = (w / 2 + 2.4) * p.side;
      p.g.position.set(j0.x + pdx * p.t + perp.x * off, 0, j0.z + pdz * p.t + perp.y * off);
    }
  });

  // ---------- Lamp posts along walkways ----------
  const lampSpots: THREE.Vector3[] = [];
  for (const e of EDGES) {
    if (!e.paint || e.zone || e.upOnly || e.a === 'HUB' || e.b === 'BR') continue;
    const a = nodeById(e.a);
    const b = nodeById(e.b);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const px = -(b.z - a.z) / len;
    const pz = (b.x - a.x) / len;
    const off = e.w / 2 + 1;
    for (let d = 7; d < len - 5; d += 12) {
      const t = d / len;
      const side = Math.floor(d / 12) % 2 ? 1 : -1;
      lampSpots.push(new THREE.Vector3(a.x + (b.x - a.x) * t + px * off * side, 0, a.z + (b.z - a.z) * t + pz * off * side));
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    lampSpots.push(new THREE.Vector3(Math.cos(a) * 24.5, 0, Math.sin(a) * 24.5));
  }
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 5, 6), mats.silver, lampSpots.length);
  const globes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), mats.warmGlow, lampSpots.length);
  const halos = new THREE.InstancedMesh(new THREE.TorusGeometry(0.85, 0.06, 4, 20).rotateX(Math.PI / 2), mats.silver, lampSpots.length);
  lampSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, 2.5, p.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(p.x, 5.3, p.z);
    globes.setMatrixAt(i, m4);
    halos.setMatrixAt(i, m4);
  });
  scene.add(poles, globes, halos);

  // ---------- Trees around the edge of the land ----------
  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) < 30) return true;
    if (Math.hypot(x - L.dome.x, z - L.dome.z) < 34) return true;
    if (Math.hypot(x - th.x, z - th.z) < 21) return true;
    if (Math.abs(x - sw.x) < sw.rx + 8 && Math.abs(z - sw.z) < sw.rz + 8) return true;
    if (Math.abs(x - dr.x) < dr.w / 2 + 5 && Math.abs(z - dr.z) < dr.d / 2 + 6) return true;
    if (Math.abs(x - qs.x) < qs.w / 2 + 6 && Math.abs(z - qs.z) < qs.d / 2 + 6) return true;
    if (Math.abs(x - L.moat.x) < 14) return true;
    if (Math.abs(x - L.shop.x) < 11 && Math.abs(z - L.shop.z) < 9) return true;
    if (Math.abs(x - pk.x) < 7 && Math.abs(z - pk.z) < 7) return true;
    if (Math.abs(x - sq.x) < 24 && Math.abs(z - sq.z) < 12) return true;
    for (const e of EDGES) {
      const a = nodeById(e.a);
      const b = nodeById(e.b);
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const l2 = vx * vx + vz * vz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
      const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
      if (d < Math.max(e.w, e.wUp ?? 0) / 2 + 4) return true;
    }
    return false;
  };
  const treeSpots: [number, number, number][] = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400 && treeSpots.length < 240; i++) {
    const x = -140 + rnd() * 250;
    const z = -110 + rnd() * 200;
    if (Math.hypot(x + 10, z) > 140) continue;
    if (blocked(x, z)) continue;
    treeSpots.push([x, z, 0.5 + rnd() * 0.6]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5), mats.silver, treeSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 6, 6), mats.foliage, treeSpots.length);
  crowns.castShadow = true;
  treeSpots.forEach(([x, z, s], i) => {
    m4.compose(new THREE.Vector3(x, 1.2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 5 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(i, m4);
  });
  scene.add(trunks, crowns);

  return {
    edgeWidth,
    update(dt, time, u) {
      for (const a of animators) a(dt, time);
      for (const b of blends) b(u);
    },
  };
}
