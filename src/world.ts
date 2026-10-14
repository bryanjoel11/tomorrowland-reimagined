// Procedural scene: every mesh here is built in code from three.js primitives.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EDGES, L, nodeById, EdgeDef } from './layout';

const C = {
  white: 0xe9edf8,
  silver: 0xaab3cf,
  ground: 0x14263a,
  walk: 0x5f7896,
  plaza: 0x6f88a6,
  blue: 0x4fa8ff,
  ember: 0xff6b4a,
  emberGlow: 0xffa64d,
  nebula: 0x34c3d6,
  aurora: 0x2ec4b6,
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
  dark: new THREE.MeshStandardMaterial({ color: 0x13222f, roughness: 0.7 }),
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
          vec3 top = vec3(0.025,0.06,0.11);
          vec3 mid = vec3(0.07,0.17,0.30);
          vec3 hor = vec3(0.80,0.42,0.28);
          vec3 fogc = vec3(0.063,0.141,0.227);
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
  scene.add(new THREE.HemisphereLight(0x9cc0ff, 0x1a2230, 1.0));
  const moon = new THREE.DirectionalLight(0xd2dcff, 2.0);
  moon.position.set(-100, 190, 60);
  moon.target.position.set(0, 0, -25);
  scene.add(moon.target);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -200; sc.right = 200; sc.top = 180; sc.bottom = -180; sc.near = 10; sc.far = 520;
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
  domeLight.position.set(60, 12, -30);
  scene.add(domeLight);

  // ---------- Ground, moat, castle hub ----------
  const ground = mesh(new THREE.CircleGeometry(1400, 72), mats.ground, false, true);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // The hub moat is a ring around the central plaza; the bridge crosses it.
  const moat = mesh(new THREE.RingGeometry(L.moat.r0, L.moat.r1, 96, 1, -1.25, 2.5), mats.water, false, true);
  moat.rotation.x = -Math.PI / 2;
  moat.rotation.z = 0;
  moat.position.set(L.moat.x, 0.04, L.moat.z);
  scene.add(moat);

  const hub = mesh(new THREE.CylinderGeometry(L.hub.r, L.hub.r, 0.14, 64), mats.plaza, false, true);
  hub.position.set(L.hub.x, 0.07, L.hub.z);
  scene.add(hub);
  const hubRing = mesh(new THREE.TorusGeometry(L.hub.r - 1, 0.18, 6, 96), mats.blueSoft, false, false);
  hubRing.rotation.x = Math.PI / 2;
  hubRing.position.set(L.hub.x, 0.2, L.hub.z);
  scene.add(hubRing);

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
  const bz = L.bridge.z;
  scene.add(box(bridgeLen, 0.8, L.bridge.w, mats.white, bx, 0.3, bz));
  for (const side of [-1, 1]) {
    scene.add(box(bridgeLen, 1.1, 0.4, mats.silver, bx, 1.2, bz + side * (L.bridge.w / 2 - 0.2)));
    scene.add(box(bridgeLen, 0.12, 0.5, mats.blueGlow, bx, 1.8, bz + side * (L.bridge.w / 2 - 0.2)));
    for (let i = 0; i <= 2; i++) {
      const x = L.bridge.x0 + (bridgeLen * i) / 2;
      const z = bz + side * (L.bridge.w / 2 + 0.3);
      scene.add(cyl(0.2, 0.25, 6, 8, mats.silver, x, 3.6, z));
      const globe = mesh(new THREE.IcosahedronGeometry(0.7, 1), mats.warmGlow, false, false);
      globe.position.set(x, 6.9, z);
      scene.add(globe);
      const halo = mesh(new THREE.TorusGeometry(1.1, 0.08, 6, 24), mats.silver, false, false);
      halo.position.copy(globe.position);
      halo.rotation.x = Math.PI / 2;
      scene.add(halo);
    }
  }
  // Entrance gateway: two leaning pylons at the land side of the bridge.
  for (const side of [-1, 1]) {
    const p = mesh(new THREE.CylinderGeometry(0.4, 1.4, 22, 6), mats.white);
    p.position.set(L.bridge.x1 + 2, 10, bz + side * 11);
    p.rotation.x = side * 0.18;
    scene.add(p);
    const tip = mesh(new THREE.IcosahedronGeometry(0.9, 1), mats.emberGlow, false, false);
    tip.position.set(L.bridge.x1 + 2, 21, bz + side * 13);
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
  // Route (see LAYOUT-NOTES.md): station -> over the Space Mountain entrance
  // plaza -> across the railroad into Space Mountain -> past the Carousel of
  // Progress -> over the former Galaxy Palace site -> south show building
  // (Buzz / Laugh Floor) -> across the promenade -> north show building -> station.
  const trackPts = [
    [-16, 5], [0, 6.5], [16, 5], [32, -4], [52, -14], [72, -22], [90, -44], [108, -30], [96, -2],
    [80, 18], [84, 46], [70, 72], [42, 82], [12, 70], [-16, 48], [-44, 44], [-66, 28], [-68, 0],
    [-60, -30], [-40, -40], [-24, -24], [-22, -4],
  ].map(([x, z]) => new THREE.Vector3(x, 9.6, z));
  const track = new THREE.CatmullRomCurve3(trackPts, true, 'centripetal');
  const SEG = 440;
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
    (p.x > L.southBldg.x0 && p.x < L.southBldg.x1 && p.z > L.southBldg.z0 && p.z < L.southBldg.z1) ||
    (p.x > L.northBldg.x0 && p.x < L.northBldg.x1 && p.z > L.northBldg.z0 && p.z < L.northBldg.z1);
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

  const TRAINS = 15;
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

  // ---------- Space Mountain (outside the railroad berm) ----------
  const dome = new THREE.Group();
  dome.position.set(L.dome.x, 0, L.dome.z);
  const prof = [
    [24, 0], [23.4, 3.5], [21, 10], [17, 16.5], [12, 22], [6.5, 26], [2.2, 27.8], [0, 28.1],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  dome.add(mesh(new THREE.LatheGeometry(prof, 28), mats.white));
  const ribCurve = new THREE.CatmullRomCurve3(prof.map((p) => new THREE.Vector3(p.x + 0.35, p.y + 0.1, 0)));
  const ribGeo = new THREE.TubeGeometry(ribCurve, 24, 0.38, 5);
  for (let i = 0; i < 14; i++) {
    const r = mesh(ribGeo, mats.silver);
    r.rotation.y = (i / 14) * Math.PI * 2;
    dome.add(r);
  }
  const base = mesh(new THREE.TorusGeometry(24.3, 0.45, 6, 96), mats.blueGlow, false, false);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.8;
  dome.add(base);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const sp = mesh(new THREE.ConeGeometry(0.9, 36, 6), mats.white);
    sp.position.set(Math.cos(a) * 27, 18, Math.sin(a) * 27);
    dome.add(sp);
    const tip = mesh(new THREE.IcosahedronGeometry(0.8, 1), mats.emberGlow, false, false);
    tip.position.set(Math.cos(a) * 27, 36.5, Math.sin(a) * 27);
    dome.add(tip);
  }
  scene.add(dome);
  // Entrance: covered walkway from the entrance plaza, under the railroad.
  const smIn = nodeById('SMin');
  const entr = new THREE.Group();
  entr.position.set(smIn.x, 0, smIn.z);
  entr.rotation.y = -Math.atan2(L.dome.z - smIn.z, L.dome.x - smIn.x);
  entr.add(box(10, 5, 8, mats.white, 4, 2.5, 0));
  entr.add(box(10.4, 0.4, 8.4, mats.blueGlow, 4, 5.2, 0));
  entr.add(box(0.3, 4, 5, mats.dark, -1.05, 2, 0));
  scene.add(entr);
  // Exit through the Launch Depot shop, between Space Mountain and TRON.
  const ld = L.launchDepot;
  const depot = new THREE.Group();
  depot.position.set(ld.x, 0, ld.z);
  depot.add(box(14, 6, 10, mats.white, 0, 3, 0));
  depot.add(box(14.4, 0.4, 10.4, mats.emberGlow, 0, 6.2, 0));
  depot.add(box(0.3, 3.4, 6, mats.blueGlow, -7.1, 2.4, 0));
  scene.add(depot);
  // Exit tunnel from the dome to the depot.
  const exitTube = box(1, 3.6, 5, mats.silver, 0, 1.8, 0);
  const ex0 = new THREE.Vector2(ld.x + 7, ld.z);
  const ex1 = new THREE.Vector2(L.dome.x - 16, L.dome.z - 18);
  exitTube.scale.x = ex0.distanceTo(ex1);
  exitTube.position.set((ex0.x + ex1.x) / 2, 1.8, (ex0.y + ex1.y) / 2);
  exitTube.rotation.y = -Math.atan2(ex1.y - ex0.y, ex1.x - ex0.x);
  scene.add(exitTube);

  // ---------- Walt Disney World Railroad (berm line) ----------
  const rail = new THREE.CatmullRomCurve3(L.railroad.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const railLen = rail.getLength();
  const TIES = Math.floor(railLen / 2.2);
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.25, 4.2), mats.dark, TIES);
  const railPts: THREE.Vector3[] = [];
  for (let i = 0; i < TIES; i++) {
    const u = i / TIES;
    const p = rail.getPointAt(u);
    const tan = rail.getTangentAt(u);
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
    m4.compose(new THREE.Vector3(p.x, 0.3, p.z), q, new THREE.Vector3(1, 1, 1));
    ties.setMatrixAt(i, m4);
    railPts.push(p);
  }
  scene.add(ties);
  for (const side of [-1.3, 1.3]) {
    const pts2 = railPts.map((p, i) => {
      const tan = rail.getTangentAt(i / TIES);
      return new THREE.Vector3(p.x - tan.z * side, 0.5, p.z + tan.x * side);
    });
    scene.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 300, 0.12, 4), mats.silver, false, false));
  }
  // Raised berm along the line
  const bermPts = L.railroad.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const berm = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bermPts), 200, 5, 6), mats.ground, false, true);
  berm.scale.y = 0.12;
  scene.add(berm);

  // ---------- TRON Lightcycle / Run canopy ----------
  const tr = L.tron;
  const canopyGeo = new THREE.PlaneGeometry(tr.w, tr.d, 48, 10);
  canopyGeo.rotateX(-Math.PI / 2);
  const cp = canopyGeo.attributes.position as THREE.BufferAttribute;
  const wave = (x: number, z: number) => 13 + Math.sin(x * 0.09) * 2.4 + Math.cos(x * 0.05 + z * 0.12) * 1.4 - (z / tr.d) * 3;
  for (let i = 0; i < cp.count; i++) cp.setY(i, wave(cp.getX(i), cp.getZ(i)));
  canopyGeo.computeVertexNormals();
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f5878, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide, flatShading: true, transparent: true, opacity: 0.88 });
  const canopy = new THREE.Group();
  canopy.position.set(tr.x, 0, tr.z);
  canopy.rotation.y = 0.12;
  canopy.add(mesh(canopyGeo, canopyMat));
  // Glowing ribs running along the canopy (they cycle colour at night).
  const ribMats: THREE.MeshStandardMaterial[] = [];
  for (let k = 0; k <= 6; k++) {
    const z = -tr.d / 2 + (k / 6) * tr.d;
    const pts3: THREE.Vector3[] = [];
    for (let x = -tr.w / 2; x <= tr.w / 2 + 0.01; x += 2) pts3.push(new THREE.Vector3(x, wave(x, z) + 0.15, z));
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d7bff, emissive: 0x3d7bff, emissiveIntensity: 2.2 });
    ribMats.push(mat);
    canopy.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 60, 0.22, 4), mat, false, false));
  }
  for (let x = -tr.w / 2 + 4; x < tr.w / 2; x += 11) {
    for (const z of [-tr.d / 2 + 2, tr.d / 2 - 2]) {
      const h = wave(x, z);
      const col = cyl(0.35, 0.5, h, 6, mats.silver, x, h / 2, z);
      col.rotation.z = 0.12;
      canopy.add(col);
    }
  }
  // Launch track under the canopy, then out past the berm.
  const tronCurve = new THREE.CatmullRomCurve3(
    [[-30, 0], [0, 4], [30, -2], [44, -24], [20, -46], [-20, -42], [-40, -20]].map(([x, z]) => new THREE.Vector3(x, 3.2, z)),
    true,
  );
  canopy.add(mesh(new THREE.TubeGeometry(tronCurve, 160, 0.5, 6, true), mats.blueGlow, false, false));
  const tronLen = tronCurve.getLength();
  const cycles = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.7, 2.2, 2, 6).rotateZ(Math.PI / 2), mats.emberGlow, 7);
  canopy.add(cycles);
  // Show building outside the berm.
  canopy.add(box(44, 14, 22, mats.dark, 2, 7, -40));
  scene.add(canopy);
  let tronPhase = 0;
  animators.push((dt, time) => {
    tronPhase = (tronPhase + dt * 22 * motion) % tronLen;
    for (let i = 0; i < 7; i++) {
      const u = ((tronPhase - i * 3) / tronLen + 1) % 1;
      const p = tronCurve.getPointAt(u);
      q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tronCurve.getTangentAt(u));
      m4.compose(p.setY(4.2), q, new THREE.Vector3(1, 1, 1));
      cycles.setMatrixAt(i, m4);
    }
    cycles.instanceMatrix.needsUpdate = true;
    const hue = (time * 0.04 * motion) % 1;
    ribMats.forEach((m, k) => {
      const c = new THREE.Color().setHSL((0.58 + hue + k * 0.02) % 1, 0.9, 0.55);
      m.color.copy(c);
      m.emissive.copy(c);
    });
  });
  // Elevated TRON walkway from the entrance under the canopy.
  const trN = nodeById('TR');
  scene.add(box(8, 0.6, 14, mats.white, trN.x, 2.2, trN.z - 9));

  // ---------- Tomorrowland Speedway ----------
  const sw = L.speedway;
  const ellipse = (rx: number, rz: number, cw: boolean) => {
    const s = new THREE.Path();
    s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, cw, 0);
    return s;
  };
  const trackShape = new THREE.Shape(ellipse(sw.rx + 3.4, sw.rz + 3.4, false).getPoints(90));
  trackShape.holes.push(ellipse(sw.rx - 3.4, sw.rz - 3.4, true));
  const swTrack = mesh(new THREE.ShapeGeometry(trackShape, 90), mats.asphalt, false, true);
  swTrack.rotation.x = -Math.PI / 2;
  swTrack.position.set(sw.x, 0.07, sw.z);
  scene.add(swTrack);
  for (const [rx, rz] of [[sw.rx + 3.6, sw.rz + 3.6], [sw.rx - 3.6, sw.rz - 3.6]]) {
    const curve = new THREE.EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
    const p3 = curve.getPoints(140).map((p) => new THREE.Vector3(p.x, 0.5, p.y));
    const railM = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p3, true), 140, 0.22, 4, true), mats.silver, false, false);
    railM.position.set(sw.x, 0, sw.z);
    scene.add(railM);
  }
  const infield = mesh(new THREE.CircleGeometry(1, 48), mats.foliage, false, true);
  infield.scale.set(sw.rx - 3.4, sw.rz - 3.4, 1);
  infield.rotation.x = -Math.PI / 2;
  infield.position.set(sw.x, 0.05, sw.z);
  scene.add(infield);
  const swCarColors = [0xff6b4a, 0x4fa8ff, 0xffd166, 0x2ec4b6, 0xf2f5f8, 0xff9f43, 0x5bb8e8, 0xff6b4a];
  const swCars: THREE.Group[] = [];
  const swCarGeo = mergeGeometries([
    new THREE.BoxGeometry(2.8, 0.7, 1.5).translate(0, 0.6, 0),
    new THREE.BoxGeometry(1.0, 0.6, 1.1).translate(-0.3, 1.15, 0),
    new THREE.ConeGeometry(0.75, 1.1, 4).rotateZ(-Math.PI / 2).translate(1.9, 0.6, 0),
  ])!;
  swCarColors.forEach((col) => {
    const g = new THREE.Group();
    g.add(mesh(swCarGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, flatShading: true })));
    scene.add(g);
    swCars.push(g);
  });
  animators.push((_dt, time) => {
    swCars.forEach((g, i) => {
      const a = time * (0.1 + i * 0.008) * motion + i * 0.8;
      const lane = i % 2 ? 1.4 : -1.4;
      g.position.set(sw.x + Math.cos(a) * (sw.rx + lane), 0.05, sw.z + Math.sin(a) * (sw.rz + lane));
      g.rotation.y = -Math.atan2(Math.cos(a) * (sw.rz + lane), -Math.sin(a) * (sw.rx + lane));
    });
  });
  // Loading station at the Tomorrowland (east) end + queue switchbacks.
  const sq = L.speedwayQueue;
  scene.add(box(16, 5, 7, mats.white, sq.x - 4, 2.5, sq.z - 11));
  scene.add(box(16.4, 0.4, 7.4, mats.blueGlow, sq.x - 4, 5.2, sq.z - 11));
  for (let i = 0; i < 6; i++) scene.add(box(15, 0.9, 0.18, mats.silver, sq.x, 0.5, sq.z - 5 + i * 2));
  // Shade sails (upgrade) - rise from the ground.
  const shade = new THREE.Group();
  shade.position.set(sq.x, 0, sq.z);
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([-9, 6.5, -7, 9, 5.2, -7, 0, 8.4, 7, 9, 5.2, -7, 9, 7.6, 7, 0, 8.4, 7, -9, 6.5, -7, 0, 8.4, 7, -9, 5.0, 7], 3));
  sailGeo.computeVertexNormals();
  shade.add(mesh(sailGeo, mats.sail));
  for (const [x, z, h] of [[-9, -7, 6.5], [9, -7, 5.2], [0, 7, 8.4], [9, 7, 7.6], [-9, 7, 5]]) shade.add(cyl(0.18, 0.22, h, 6, mats.silver, x, h / 2, z));
  for (const x of [-5, 1, 7]) shade.add(box(1.8, 1.1, 0.12, mats.auroraGlow, x, 2.1, -1.8));
  scene.add(shade);
  blends.push((u) => {
    shade.visible = u > 0.01;
    shade.scale.set(1, Math.max(0.001, u), 1);
  });

  // ---------- Walt Disney's Carousel of Progress ----------
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
  const copN = nodeById('COP');
  const thA = Math.atan2(copN.z - th.z, copN.x - th.x);
  const thEnt = new THREE.Group();
  thEnt.rotation.y = -thA;
  thEnt.add(box(5, 0.5, 12, mats.white, th.r + 2.5, 6, 0));
  thEnt.add(box(0.4, 0.3, 12, mats.warmGlow, th.r + 5, 5.8, 0));
  for (const z of [-5.5, 5.5]) thEnt.add(cyl(0.25, 0.25, 6, 6, mats.silver, th.r + 4.5, 3, z));
  theater.add(thEnt);
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
  scene.add(theater);
  animators.push((dt) => {
    turntable.rotation.y += dt * 0.2 * motion;
  });
  // Former Galaxy Palace Theater site south of the Carousel: open plaza.
  const gp = mesh(new THREE.CylinderGeometry(14, 14, 0.12, 40), mats.plaza, false, true);
  gp.position.set(40, 0.06, 82);
  scene.add(gp);

  // ---------- South show building: Laugh Floor + Buzz Lightyear ----------
  const sb = L.southBldg;
  const sbW = sb.x1 - sb.x0;
  const sbD = sb.z1 - sb.z0;
  scene.add(box(sbW, 11, sbD, mats.white, (sb.x0 + sb.x1) / 2, 5.5, (sb.z0 + sb.z1) / 2));
  scene.add(box(sbW + 0.6, 0.5, sbD + 0.6, mats.silver, (sb.x0 + sb.x1) / 2, 11.2, (sb.z0 + sb.z1) / 2));
  // Laugh Floor facade (west)
  scene.add(box(L.laughFloorSplit - sb.x0 - 2, 2, 0.6, mats.warmGlow, (sb.x0 + L.laughFloorSplit) / 2, 8.5, sb.z0 - 0.3));
  for (let i = 0; i < 4; i++) scene.add(cyl(1.2, 1.2, 0.4, 16, mats.blueGlow, sb.x0 + 4 + i * 5, 5, sb.z0 - 0.3).rotateX(Math.PI / 2));
  // Buzz facade (east): angled fins + planet sign
  for (let i = 0; i < 7; i++) {
    const x = L.laughFloorSplit + 3 + i * 4;
    const f = box(0.6, 12.5, 3.2, mats.silver, x, 6.2, sb.z0 - 1.2);
    f.rotation.y = 0.5;
    scene.add(f);
    scene.add(box(0.25, 9.5, 0.25, i % 2 ? mats.nebulaGlow : mats.blueGlow, x + 0.9, 6.2, sb.z0 - 2.4));
  }
  const drSign = new THREE.Group();
  drSign.position.set(sb.x1 - 10, 15, sb.z0 + 4);
  drSign.add(mesh(new THREE.IcosahedronGeometry(2.6, 1), mats.nebulaGlow));
  const signRing = mesh(new THREE.TorusGeometry(4.2, 0.25, 6, 40), mats.emberGlow, false, false);
  signRing.rotation.x = 1.2;
  drSign.add(signRing);
  scene.add(drSign);
  animators.push((dt) => {
    signRing.rotation.z += dt * 0.6 * motion;
  });
  // Upgraded: recessed two-lane return-time merge portal at the Buzz entrance.
  const bzIn = nodeById('BZin');
  const mergePortal = new THREE.Group();
  mergePortal.position.set(bzIn.x, 0, bzIn.z + 2);
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

  // ---------- North show building: former Stitch theater, Merchant of Venus, Cosmic Ray's ----------
  const nb = L.northBldg;
  const nbW = nb.x1 - nb.x0;
  const nbD = nb.z1 - nb.z0;
  scene.add(box(nbW, 10, nbD, mats.white, (nb.x0 + nb.x1) / 2, 5, (nb.z0 + nb.z1) / 2));
  scene.add(box(nbW + 0.6, 0.5, nbD + 0.6, mats.silver, (nb.x0 + nb.x1) / 2, 10.2, (nb.z0 + nb.z1) / 2));
  for (let i = 0; i < 10; i++) scene.add(box(0.5, 10, 1.4, mats.silver, nb.x0 + 3 + i * 5.6, 5, nb.z1 + 0.6));
  // Cosmic Ray's: vaulted roof over the east end + glowing band
  const vault = mesh(new THREE.CylinderGeometry(9, 9, 24, 20, 1, false, 0, Math.PI), mats.silver);
  vault.rotation.set(0, 0, Math.PI / 2);
  vault.scale.set(0.5, 1, 1);
  vault.position.set(nb.x1 - 13, 10, (nb.z0 + nb.z1) / 2 + 2);
  scene.add(vault);
  scene.add(box(26, 0.35, 0.4, mats.warmGlow, nb.x1 - 13, 9.4, nb.z1 + 1.4));
  // Today's mobile-order pickup counter, facing the promenade.
  const counter = box(8, 2.4, 1.6, mats.emberGlow, L.pickupToday.x, 1.2, nb.z1 + 1);
  scene.add(counter);
  blends.push((u) => {
    counter.scale.y = Math.max(0.01, 1 - u);
    counter.visible = u < 0.99;
  });
  // Upgraded pickup pavilion on the quieter north side (facing the Speedway).
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

  // ---------- Tomorrowland Terrace (south of the bridge, by the moat) ----------
  const tt = L.terrace;
  const terr = new THREE.Group();
  terr.position.set(tt.x, 0, tt.z);
  terr.add(box(12, 4, 20, mats.white, 0, 2, 0));
  const terrRoof = mesh(new THREE.CylinderGeometry(9, 9, 24, 3, 1), mats.silver);
  terrRoof.rotation.set(Math.PI / 2, 0, 0);
  terrRoof.scale.set(1, 1, 0.22);
  terrRoof.position.y = 6.5;
  terr.add(terrRoof);
  for (const z of [-10, -3.3, 3.3, 10]) terr.add(cyl(0.3, 0.3, 6, 6, mats.silver, -7, 3, z));
  scene.add(terr);
  const umbGeo = new THREE.ConeGeometry(2.2, 0.9, 8);
  for (const [x, z] of [[-30, 6 - 14], [-24, -13], [tt.x - 9, tt.z - 6], [tt.x - 9, tt.z + 4]]) {
    scene.add(cyl(0.9, 0.9, 1.1, 10, mats.silver, x, 0.55, z));
    scene.add(cyl(0.08, 0.08, 3, 5, mats.silver, x, 1.6, z));
    const um = mesh(umbGeo, mats.white);
    um.position.set(x, 3.3, z);
    scene.add(um);
  }

  // ---------- Shops and kiosks ----------
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
  const st = L.starTraders;
  scene.add(box(14, 6, 10, mats.white, st.x, 3, st.z));
  scene.add(box(14.4, 0.4, 10.4, mats.blueGlow, st.x, 6.2, st.z));
  scene.add(box(9, 2.6, 0.2, mats.warmGlow, st.x, 2.2, st.z - 5.1));
  const lp = L.lunchingPad;
  scene.add(cyl(3, 3.4, 3.2, 12, mats.white, lp.x, 1.6, lp.z));
  scene.add(cyl(4, 4, 0.4, 12, mats.emberGlow, lp.x, 3.4, lp.z));

  // ---------- Merch cart (upgrade) at the PeopleMover exit ----------
  const cartN = nodeById('CART');
  const cart = new THREE.Group();
  cart.position.set(cartN.x + 3, 0, cartN.z + 3);
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
  const totemSpots = [[-64, -4, 0], [-64, 16, Math.PI], [-26, -6, 0.4], [10, -32, 0.8], [36, 2, -1]];
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
  // Signage arch on the back path behind the Speedway queue (unsigned today).
  const n0 = nodeById('N0');
  const t1n = nodeById('T1');
  const arch = new THREE.Group();
  arch.position.set(n0.x + (t1n.x - n0.x) * 0.25, 0, n0.z + (t1n.z - n0.z) * 0.25);
  arch.rotation.y = -Math.atan2(t1n.z - n0.z, t1n.x - n0.x) + Math.PI / 2;
  arch.add(cyl(0.25, 0.25, 5, 6, mats.silver, -3.4, 2.5, 0));
  arch.add(cyl(0.25, 0.25, 5, 6, mats.silver, 3.4, 2.5, 0));
  arch.add(box(7.4, 0.9, 0.3, mats.blueGlow, 0, 5, 0));
  scene.add(arch);
  blends.push((u) => {
    arch.visible = u > 0.01;
    arch.scale.set(1, Math.max(0.001, u), 1);
  });

  // ---------- Planters at the Space Mountain exit / TRON pinch ----------
  const j0 = nodeById('T0');
  const j1 = nodeById('T1');
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
  const inRect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number, pad: number) =>
    x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
  const blocked = (x: number, z: number) => {
    if (Math.hypot(x, z) < 30) return true;
    if (Math.hypot(x - L.dome.x, z - L.dome.z) < 32) return true;
    if (Math.hypot(x - th.x, z - th.z) < 21) return true;
    if (Math.hypot(x - L.hub.x, z - L.hub.z) < L.moat.r1 + 3) return true;
    if (Math.abs(x - sw.x) < sw.rx + 7 && Math.abs(z - sw.z) < sw.rz + 7) return true;
    if (inRect(x, z, sb.x0, sb.x1, sb.z0, sb.z1, 5)) return true;
    if (inRect(x, z, nb.x0, nb.x1, nb.z0, nb.z1, 5)) return true;
    if (inRect(x, z, tr.x - tr.w / 2, tr.x + tr.w / 2, tr.z - tr.d / 2 - 52, tr.z + tr.d / 2, 4)) return true;
    if (Math.abs(x - tt.x) < 12 && Math.abs(z - tt.z) < 14) return true;
    if (Math.abs(x - L.shop.x) < 11 && Math.abs(z - L.shop.z) < 9) return true;
    if (Math.abs(x - st.x) < 11 && Math.abs(z - st.z) < 9) return true;
    if (Math.abs(x - ld.x) < 11 && Math.abs(z - ld.z) < 9) return true;
    if (Math.abs(x - pk.x) < 7 && Math.abs(z - pk.z) < 7) return true;
    if (Math.abs(x - sq.x) < 14 && Math.abs(z - sq.z) < 18) return true;
    if (Math.hypot(x - 40, z - 82) < 16) return true;
    for (let i = 0; i <= 60; i++) {
      const p = rail.getPointAt(i / 60);
      if (Math.hypot(x - p.x, z - p.z) < 7) return true;
    }
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
  for (let i = 0; i < 3000 && treeSpots.length < 340; i++) {
    const x = -130 + rnd() * 290;
    const z = -160 + rnd() * 270;
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
