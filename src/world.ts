// Procedural scene: every mesh here is built in code from three.js primitives.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EDGES, L, nodeById } from './layout';
import { buildSpaceMountain } from './spaceMountain';

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

/**
 * Sign face drawn on a canvas. Each line is shrunk until it fits inside the
 * panel with padding, so names never clip; the texture is redrawn once the
 * web fonts have loaded (the measurement then uses the real font).
 */
function signTexture(lines: string[], o: { w: number; h: number; bg: string; fg: string; edge: string }) {
  const c = document.createElement('canvas');
  c.width = o.w;
  c.height = o.h;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => {
    g.clearRect(0, 0, o.w, o.h);
    const pad = o.h * 0.08;
    const r = Math.min(o.h * 0.3, 90);
    g.fillStyle = o.bg;
    g.beginPath();
    g.roundRect(pad / 2, pad / 2, o.w - pad, o.h - pad, r);
    g.fill();
    g.strokeStyle = o.edge;
    g.lineWidth = o.h * 0.03;
    g.stroke();
    const maxW = o.w - pad * 2 - r * 0.9;
    const lineH = (o.h - pad * 3) / lines.length;
    g.fillStyle = o.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((text, i) => {
      let size = Math.floor(lineH * (lines.length > 1 ? 0.6 : 0.68));
      g.font = `bold ${size}px Michroma, Outfit, sans-serif`;
      while (g.measureText(text).width > maxW && size > 10) {
        size -= 2;
        g.font = `bold ${size}px Michroma, Outfit, sans-serif`;
      }
      g.fillText(text, o.w / 2, pad * 1.5 + lineH * (i + 0.5));
    });
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts) {
    document.fonts.load('bold 40px Michroma').then(draw, () => undefined);
    document.fonts.ready.then(draw, () => undefined);
  }
  return tex;
}

export interface World {
  update(dt: number, time: number): void;
}

export function buildWorld(scene: THREE.Scene, opts: { reducedMotion: boolean; renderer: THREE.WebGLRenderer }): World {
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
    scene.add(g);
    const r = e.w / 2;
    nodeR.set(e.a, Math.max(nodeR.get(e.a) ?? 0, r));
    nodeR.set(e.b, Math.max(nodeR.get(e.b) ?? 0, r));
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
  // Upgrade 2: redesigned accessible cars. Longer, lower floor, wide side bay
  // door and a teal accessibility band; a fold-down ramp deploys at the stop.
  const tealGlow = new THREE.MeshStandardMaterial({ color: 0x1fb5c9, emissive: 0x1fb5c9, emissiveIntensity: 1.6 });
  const coralMat = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.4, flatShading: true });
  const nBody = new THREE.InstancedMesh(
    mergeGeometries([
      new THREE.BoxGeometry(3.5, 1.5, 2.7).translate(0, -0.1, 0),
      new THREE.CylinderGeometry(1.35, 1.35, 3.5, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.45, 1).translate(0, 0.65, 0),
    ])!,
    mats.white,
    TRAINS * CARS,
  );
  const nBand = new THREE.InstancedMesh(new THREE.BoxGeometry(3.56, 0.32, 2.76), tealGlow, TRAINS * CARS);
  const nWin = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, 0.5, 2.78), mats.blueGlow, TRAINS * CARS);
  const nDoor = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 1.2, 0.08), coralMat, TRAINS * CARS);
  nBody.castShadow = true;
  for (const im of [nBody, nBand, nWin, nDoor]) im.frustumCulled = false;
  scene.add(nBody, nBand, nWin, nDoor);

  // Accessible boarding zone on the station deck: the moving belt here slows
  // to a stop, with a teal level-boarding strip, gates and an elevator tower.
  const pmZoneU = (() => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < 1000; i++) {
      const p = track.getPointAt(i / 1000);
      const d = Math.hypot(p.x - 0, p.z - 6.5);
      if (d < bd) { bd = d; best = i / 1000; }
    }
    return best;
  })();
  const pmZoneD = pmZoneU * totalLen;
  const zp = track.getPointAt(pmZoneU);
  const zt = track.getTangentAt(pmZoneU);
  const zone = new THREE.Group();
  zone.position.set(zp.x, 0, zp.z);
  zone.rotation.y = -Math.atan2(zt.z, zt.x);
  // In local space +x is along the track; -z is the boarding side (toward the deck centre).
  zone.add(box(13, 0.14, 2.6, tealGlow, 0, 9.22, -2.7));
  zone.add(box(13, 0.1, 0.25, mats.warmGlow, 0, 9.3, -1.45));
  for (const x of [-6.5, -2.2, 2.2, 6.5]) {
    zone.add(cyl(0.12, 0.12, 1.6, 6, mats.silver, x, 10, -4.1));
  }
  zone.add(box(13, 0.12, 0.12, tealGlow, 0, 10.8, -4.1));
  const accessTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#146c86';
    g.beginPath();
    g.roundRect(0, 0, 128, 128, 18);
    g.fill();
    g.strokeStyle = g.fillStyle = '#ffffff';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath(); g.arc(60, 24, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(58, 40); g.lineTo(56, 72); g.lineTo(84, 72); g.lineTo(96, 98); g.stroke();
    g.beginPath(); g.moveTo(56, 52); g.lineTo(80, 52); g.stroke();
    g.beginPath(); g.arc(56, 86, 24, 0.4, Math.PI * 1.75); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const accessSign = mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: accessTex, side: THREE.DoubleSide, toneMapped: false }), false, false);
  accessSign.position.set(-7.6, 12.2, -4.1);
  zone.add(accessSign, cyl(0.1, 0.1, 3, 6, mats.silver, -7.6, 10.6, -4.1));
  // Fold-down ramp hinged at the bay door of the stopped car.
  const rampPivot = new THREE.Group();
  rampPivot.position.set(0, 10.15, -1.4);
  const rampPlate = box(1.7, 0.1, 1.5, coralMat, 0, 0, -0.75);
  rampPivot.add(rampPlate);
  zone.add(rampPivot);
  scene.add(zone);
  // Elevator tower from the plaza to the deck.
  const elev = new THREE.Group();
  elev.position.set(-9.4, 0, 9.6);
  elev.add(cyl(1.8, 1.8, 9.4, 16, new THREE.MeshStandardMaterial({ color: 0x9fdcef, transparent: true, opacity: 0.35, roughness: 0.1 }), 0, 4.7, 0));
  elev.add(cyl(1.95, 1.95, 0.4, 16, mats.silver, 0, 9.6, 0));
  elev.add(box(2.6, 0.3, 3.2, mats.silver, 1.3, 9.2, -1.6));
  const cab = cyl(1.4, 1.4, 2.2, 12, tealGlow, 0, 1.2, 0);
  elev.add(cab);
  scene.add(elev);

  let trackPhase = 0;
  let pmV = 1;
  let pmStop = 0; // seconds left at the accessible stop
  let pmServed = -1;
  let ramp = 0;
  const fwd = new THREE.Vector3(1, 0, 0);
  const pmLead = (t: number) => (trackPhase + (t * totalLen) / TRAINS) % totalLen;
  const sc1 = new THREE.Vector3(1, 1, 1);
  const tmpQ = new THREE.Quaternion();
  const off = new THREE.Vector3();
  animators.push((dt, time) => {
    // Accessible stop: every third train glides to a halt with its bay car at
    // the boarding zone, the ramp folds down, then the line moves on.
    let target = 1;
    {
      if (pmStop > 0) {
        pmStop -= dt;
        target = 0;
      } else {
        for (let t = 0; t < TRAINS; t += 3) {
          const rem = (pmZoneD + 3.6 - pmLead(t) + totalLen) % totalLen;
          if (pmServed === t) {
            if (rem > 12 && rem < totalLen - 12) pmServed = -1;
            continue;
          }
          if (rem < 9) {
            target = Math.max(0, (rem - 0.1) / 9);
            if (rem < 0.35) {
              pmStop = 4.5;
              pmServed = t;
              target = 0;
            }
          }
        }
      }
    }
    pmV += (target - pmV) * Math.min(1, dt * (target < pmV ? 6 : 1.4));
    trackPhase = (trackPhase + dt * 4.5 * motion * pmV) % totalLen;
    ramp += ((pmStop > 0.8 ? 1 : 0) - ramp) * Math.min(1, dt * 3);
    rampPivot.rotation.x = Math.PI / 2 - ramp * (Math.PI / 2 + 0.38);
    rampPlate.visible = ramp > 0.02;
    cab.position.y = 1.2 + (0.5 - 0.5 * Math.cos(time * 0.5 * motion)) * 7;
    let k = 0;
    for (let t = 0; t < TRAINS; t++) {
      for (let c = 0; c < CARS; c++) {
        const d = (trackPhase + (t * totalLen) / TRAINS - c * 3.8 + totalLen) % totalLen;
        const uu = d / totalLen;
        const p = track.getPointAt(uu);
        const tan = track.getTangentAt(uu);
        q.setFromUnitVectors(fwd, tan);
        m4.compose(p.setY(10.95), q, sc1);
        nBody.setMatrixAt(k, m4);
        m4.compose(p.setY(10.35), q, sc1);
        nBand.setMatrixAt(k, m4);
        m4.compose(p.setY(11.35), q, sc1);
        nWin.setMatrixAt(k, m4);
        off.set(0, 0, -1.37).applyQuaternion(q);
        tmpQ.copy(q);
        m4.compose(p.setY(10.85).add(off), tmpQ, sc1);
        nDoor.setMatrixAt(k, m4);
        k++;
      }
    }
    for (const im of [nBody, nBand, nWin, nDoor]) im.instanceMatrix.needsUpdate = true;
  });

  // ---------- Space Mountain, refurbished as Hyperspace Mountain (see spaceMountain.ts) ----------
  const smIn = nodeById('SMin');
  animators.push(
    buildSpaceMountain(scene, {
      renderer: opts.renderer,
      center: L.dome,
      entrance: smIn,
      queueFrom: nodeById('S1'),
      motion,
    }),
  );
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

  // ---------- Sugar Rush queue switchbacks (by the walkway) ----------
  const sw = L.speedway; // the coaster sits in the former Speedway footprint
  const sq = L.speedwayQueue;
  for (let i = 0; i < 6; i++) scene.add(box(15, 0.9, 0.18, mats.silver, sq.x, 0.5, sq.z - 5 + i * 2));

  // ---------- Upgrade 1: Sugar Rush, an indoor dual racing coaster ----------
  // A candy-themed show building fills the Speedway footprint. Inside, two
  // side-by-side tracks share one layout: station, launch straight, banked west
  // turn, airtime hill, banked east turn. The glass upper walls and vaulted
  // glass roof keep both racing trains visible from the park.
  const candy = { pink: 0xff7eb6, mint: 0x6ee7c8, lemon: 0xffd166, cherry: 0xff4d6d, cream: 0xfff4f8, grape: 0xb28dff };
  const candyMat = (c: number, e = 0) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05, emissive: c, emissiveIntensity: e, flatShading: true });
  const coaster = new THREE.Group();
  coaster.position.set(sw.x, 0, sw.z);
  // Centre line [x, y, z, bank] relative to the Speedway centre.
  const crPts: [number, number, number, number][] = [
    [44, 3, 12, 0], [30, 3, 12, 0], [18, 3.2, 12, 0], [2, 3.6, 12, 0], [-14, 4.5, 12, 0],
    [-30, 8, 10, 0.25], [-43, 13, 5, 0.8], [-50, 15, -3, 1], [-43, 14, -10, 0.8], [-30, 10, -12, 0.25],
    [-14, 6, -12, 0], [0, 18, -12, 0], [14, 8, -12, 0], [28, 9, -11, 0.25], [42, 12, -6, 0.8],
    [50, 9, 2, 1], [48, 4.5, 9, 0.4],
  ];
  const centre = new THREE.CatmullRomCurve3(crPts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
  const bankCurve = new THREE.CatmullRomCurve3(crPts.map(([, , , b]) => new THREE.Vector3(b, 0, 0)), true, 'catmullrom');
  const Y = new THREE.Vector3(0, 1, 0);
  const LANE = 2.6;
  type Frame = { p: THREE.Vector3; tan: THREE.Vector3; up: THREE.Vector3; side: THREE.Vector3 };
  /** Builds one racing lane offset sideways from the centre line. */
  const makeLane = (offset: number) => {
    const N = 320;
    const pts: THREE.Vector3[] = [];
    const banks: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = centre.getUtoTmapping(i / N, 0);
      const p = centre.getPoint(t);
      const tan = centre.getTangent(t);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      pts.push(p.addScaledVector(side, offset));
      banks.push(bankCurve.getPoint(t).x);
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const len = curve.getLength();
    const frameAt = (s: number): Frame => {
      s = ((s % 1) + 1) % 1;
      const t = curve.getUtoTmapping(s, 0);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t).normalize();
      const t0 = curve.getTangent((t + 0.995) % 1);
      const t1 = curve.getTangent((t + 0.005) % 1);
      const inward = new THREE.Vector3(t1.x - t0.x, 0, t1.z - t0.z);
      if (inward.lengthSq() > 1e-8) inward.normalize();
      const bank = banks[Math.floor(t * N) % N];
      const up = Y.clone().addScaledVector(inward, bank * 1.2).normalize();
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();
      up.crossVectors(side, tan).normalize();
      return { p, tan, up, side };
    };
    return { curve, len, frameAt };
  };
  const lanes = [makeLane(LANE), makeLane(-LANE)];
  const basis = new THREE.Matrix4();
  const stripeA = [candy.pink, candy.mint];
  const railCols = [candy.mint, candy.lemon];
  lanes.forEach((lane, li) => {
    const CR_N = 380;
    const frames = Array.from({ length: CR_N }, (_, i) => lane.frameAt(i / CR_N));
    const offsetCurve = (side: number, up: number) =>
      new THREE.CatmullRomCurve3(frames.map((f) => f.p.clone().addScaledVector(f.side, side).addScaledVector(f.up, up)), true);
    // Candy-stripe spine (vertex colours alternate with cream).
    const spineGeo = new THREE.TubeGeometry(offsetCurve(0, -0.5), CR_N, 0.36, 6, true);
    const cols: number[] = [];
    const a = new THREE.Color(stripeA[li]);
    const b = new THREE.Color(candy.cream);
    for (let r = 0; r <= CR_N; r++) {
      const c = Math.floor(r / 5) % 2 ? b : a;
      for (let k = 0; k <= 6; k++) cols.push(c.r, c.g, c.b);
    }
    spineGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    coaster.add(mesh(spineGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, flatShading: true }), true, false));
    const railMat = candyMat(railCols[li], 0.5);
    for (const sd of [-0.75, 0.75]) coaster.add(mesh(new THREE.TubeGeometry(offsetCurve(sd, 0.05), CR_N, 0.14, 5, true), railMat, false, false));
    const tieCount = Math.floor(lane.len / 1.8);
    const ties2 = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.2, 1.7), candyMat(candy.cream), tieCount);
    for (let i = 0; i < tieCount; i++) {
      const f = lane.frameAt(i / tieCount);
      basis.makeBasis(f.tan, f.up, f.side);
      basis.setPosition(f.p.clone().addScaledVector(f.up, -0.15));
      ties2.setMatrixAt(i, basis);
    }
    coaster.add(ties2);
    const supSpots: THREE.Vector3[] = [];
    for (let i = 0; i < 46; i++) {
      const f = lane.frameAt(i / 46);
      const lp = f.p.clone().addScaledVector(f.up, -0.8);
      if (lp.y > 2.6) supSpots.push(lp);
    }
    const sups = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.4, 1, 6), candyMat(candy.lemon), supSpots.length);
    supSpots.forEach((p, i) => {
      m4.compose(new THREE.Vector3(p.x, p.y / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, p.y, 1));
      sups.setMatrixAt(i, m4);
    });
    coaster.add(sups);
  });
  // Launch section: glowing fins along both lanes that flash as the trains launch.
  const launchMat = candyMat(candy.cherry, 2.4);
  const finSpots: [number, number][] = [];
  for (let x = 16; x >= -10; x -= 2) for (const z of [12 + LANE, 12 - LANE]) finSpots.push([x, z]);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.45, 0.12), launchMat, finSpots.length);
  finSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.05 + Math.max(0, 18 - x) * 0.04, z);
    fins.setMatrixAt(i, m4);
  });
  coaster.add(fins);
  // Station: shared island platform between the lanes = two loading sides.
  const stripeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff4f8';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#ff4d6d';
    for (let i = -64; i < 128; i += 16) {
      g.beginPath();
      g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 + 64, 64); g.lineTo(i + 64, 64);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 3);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pepperMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.3 });
  const frost = candyMat(candy.cream);
  coaster.add(box(16, 2.3, 2.6, frost, 37, 1.15, 12));
  for (const z of [12 + 1.25, 12 - 1.25]) coaster.add(box(16, 0.1, 0.18, candyMat(candy.mint, 1.4), 37, 2.35, z));
  for (const x of [31, 37, 43]) coaster.add(cyl(0.3, 0.3, 6, 10, pepperMat, x, 5.3, 12));

  // Show building shell.
  const BX0 = -60;
  const BX1 = 58;
  const BZ = 21;
  const bW = BX1 - BX0;
  const bCx = (BX0 + BX1) / 2;
  const WALL = 7;
  const shell = new THREE.Group();
  const wallMat = candyMat(candy.pink);
  shell.add(box(bW, WALL, 0.8, wallMat, bCx, WALL / 2, -BZ));
  shell.add(box(0.8, WALL, BZ * 2, wallMat, BX0, WALL / 2, 0));
  shell.add(box(0.8, WALL, BZ * 2, wallMat, BX1, WALL / 2, 0));
  shell.add(box(bW, WALL, 0.8, wallMat, bCx, WALL / 2, BZ));
  for (const [w, d, x, z] of [[bW + 1, 0.9, bCx, -BZ], [bW + 1, 0.9, bCx, BZ], [0.9, BZ * 2, BX0, 0], [0.9, BZ * 2, BX1, 0]] as const) {
    shell.add(box(w, 0.5, d, candyMat(candy.mint, 0.9), x, WALL + 0.25, z));
  }
  // Scalloped frosting along the top of the solid wall.
  const scallopGeo = new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI);
  const scallops: THREE.Vector3[] = [];
  for (let x = BX0 + 1; x < BX1; x += 2) for (const z of [-BZ - 0.5, BZ + 0.5]) scallops.push(new THREE.Vector3(x, WALL - 0.1, z));
  for (let z = -BZ + 1; z < BZ; z += 2) for (const x of [BX0 - 0.5, BX1 + 0.5]) scallops.push(new THREE.Vector3(x, WALL - 0.1, z));
  const scal = new THREE.InstancedMesh(scallopGeo, frost, scallops.length);
  scallops.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); scal.setMatrixAt(i, m4); });
  shell.add(scal);
  // Glass upper walls + vaulted glass roof with candy-cane arches.
  const glass = new THREE.MeshStandardMaterial({ color: 0xffd6ea, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const GH = 10;
  shell.add(box(bW, GH, 0.2, glass, bCx, WALL + 0.5 + GH / 2, -BZ));
  shell.add(box(bW, GH, 0.2, glass, bCx, WALL + 0.5 + GH / 2, BZ));
  const vaultY = WALL + 0.5 + GH;
  const vaultGeo = new THREE.CylinderGeometry(BZ, BZ, bW, 32, 1, true, -Math.PI / 2, Math.PI);
  vaultGeo.rotateZ(Math.PI / 2);
  const vault2 = mesh(vaultGeo, glass, false, false);
  vault2.scale.set(1, 0.42, 1);
  vault2.position.set(bCx, vaultY, 0);
  shell.add(vault2);
  for (const x of [BX0, BX1]) {
    const endCap = mesh(new THREE.CircleGeometry(BZ, 32, 0, Math.PI), glass, false, false);
    endCap.rotation.y = Math.PI / 2;
    endCap.scale.set(1, 0.42, 1);
    endCap.position.set(x, vaultY, 0);
    shell.add(endCap);
    shell.add(box(0.2, GH, BZ * 2, glass, x, WALL + 0.5 + GH / 2, 0));
  }
  const archGeo = new THREE.TorusGeometry(BZ, 0.32, 5, 28, Math.PI);
  archGeo.rotateY(Math.PI / 2);
  archGeo.scale(1, 0.42, 1);
  const archMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.3, emissive: 0xff7eb6, emissiveIntensity: 0.25 });
  for (let x = BX0; x <= BX1 + 0.1; x += bW / 8) {
    const ar = mesh(archGeo, archMat, false, false);
    ar.position.set(x, vaultY, 0);
    shell.add(ar);
    for (const z of [-BZ, BZ]) shell.add(cyl(0.3, 0.3, GH, 6, archMat, x, WALL + 0.5 + GH / 2, z));
  }
  shell.add(box(bW, 0.1, BZ * 2, new THREE.MeshStandardMaterial({ color: 0x3a2350, roughness: 0.9 }), bCx, 0.08, 0));
  coaster.add(shell);

  // Entrance facade outside the building on the queue side (south-east corner).
  const facade = new THREE.Group();
  facade.position.set(40, 0, BZ + 0.6);
  facade.add(box(22, 14, 1.2, candyMat(candy.cream), 0, 7, 0));
  facade.add(box(22.6, 1, 1.6, candyMat(candy.pink, 0.4), 0, 14.3, 0));
  for (let x = -10.5; x <= 10.6; x += 1.5) facade.add(mesh(scallopGeo, candyMat(candy.pink), false, false).translateX(x).translateY(13.8).translateZ(0.8));
  // Arched entry
  facade.add(box(6, 6, 0.4, mats.dark, 0, 3, 0.5));
  const entryArch = mesh(new THREE.TorusGeometry(3.1, 0.45, 8, 24, Math.PI), pepperMat, false, false);
  entryArch.position.set(0, 6, 0.8);
  facade.add(entryArch);
  for (const x of [-3.1, 3.1]) facade.add(cyl(0.45, 0.45, 6, 12, pepperMat, x, 3, 0.8));
  const gumColors = [candy.cherry, candy.lemon, candy.mint, candy.grape];
  const gumGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const gd = mesh(gumGeo, candyMat(gumColors[i % 4], 0.6), true, false);
    gd.position.set(-9.5 + i * 3.8, 14.8, 0);
    gd.scale.set(1.2, 1.6, 1.2);
    facade.add(gd);
  }
  const signTex = signTexture(['SUGAR RUSH'], { w: 1024, h: 256, bg: '#ff7eb6', fg: '#fff4f8', edge: '#ffffff' });
  const sign = mesh(new THREE.PlaneGeometry(14.5, 3.62), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }), false, false);
  sign.position.set(0, 11.5, 0.75);
  facade.add(sign);
  coaster.add(facade);
  // Giant lollipops flanking the entrance.
  const swirlTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const sc2 = ['#ff4d6d', '#fff4f8', '#6ee7c8', '#fff4f8'];
    for (let i = 0; i < 24; i++) {
      g.fillStyle = sc2[i % 4];
      g.beginPath();
      g.moveTo(64, 64);
      g.arc(64, 64, 64, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2 + 0.02);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const lolliMat = new THREE.MeshStandardMaterial({ map: swirlTex, roughness: 0.3, emissive: 0xffffff, emissiveMap: swirlTex, emissiveIntensity: 0.3 });
  const lolliHead = new THREE.CylinderGeometry(2.4, 2.4, 0.5, 28).rotateX(Math.PI / 2);
  for (const [x, h] of [[26, 11], [54, 9]]) {
    const lp = new THREE.Group();
    lp.position.set(x, 0, BZ + 3);
    lp.add(cyl(0.2, 0.2, h, 6, frost, 0, h / 2, 0));
    lp.add(mesh(lolliHead, lolliMat).translateY(h + 2));
    coaster.add(lp);
  }

  // Two racing trains, five cars each.
  const CR_CARS = 5;
  const crCarGeo = mergeGeometries([
    new THREE.BoxGeometry(2.4, 0.85, 1.6).translate(0, 0.6, 0),
    new THREE.BoxGeometry(0.28, 0.75, 1.5).translate(-0.85, 1.3, 0),
    new THREE.SphereGeometry(0.85, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.8, 0.6, 1).translate(1.1, 1.0, 0),
  ])!.scale(1.2, 1.2, 1.2);
  const trainCols = [
    [candy.cherry, candy.pink, candy.cherry, candy.pink, candy.cherry],
    [candy.mint, candy.grape, candy.mint, candy.grape, candy.mint],
  ];
  const trains = lanes.map((lane, li) => {
    const im = new THREE.InstancedMesh(crCarGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.15, flatShading: true }), CR_CARS);
    for (let i = 0; i < CR_CARS; i++) im.setColorAt(i, new THREE.Color(trainCols[li][i]));
    im.frustumCulled = false;
    im.castShadow = true;
    coaster.add(im);
    let launchFrom = 0;
    let launchTo = 0;
    for (let i = 0; i < 400; i++) {
      const x = lane.curve.getPointAt(i / 400).x;
      if (!launchFrom && x < 18) launchFrom = (i / 400) * lane.len;
      if (!launchTo && x < -14) launchTo = (i / 400) * lane.len;
    }
    return { lane, im, pos: (0.42 + li * 0.012) * lane.len, v: 12, launchFrom, launchTo };
  });
  scene.add(coaster);
  animators.push((dt, time) => {
    // Lead swaps: each train's pace drifts on a slow sine in opposite phase,
    // with a soft pull that keeps the race close.
    const fa = trains[0].pos / trains[0].lane.len;
    const fb = trains[1].pos / trains[1].lane.len;
    let gap = fa - fb;
    gap -= Math.round(gap);
    let launching = false;
    trains.forEach((tr, ti) => {
      const L2 = tr.lane.len;
      const s = tr.pos;
      const head = tr.lane.frameAt(s / L2);
      let target: number;
      if (s < tr.launchFrom) target = 4;
      else if (s < tr.launchTo) target = 30;
      else target = 8 + Math.sqrt(2 * 9.8 * Math.max(0, 20 - head.p.y));
      const pace = 1 + (ti ? -1 : 1) * 0.07 * Math.sin(time * 0.33) + (ti ? 1 : -1) * gap * 2.2;
      const inLaunch = s > tr.launchFrom && s < tr.launchTo;
      if (s > tr.launchFrom - 4 && s < tr.launchTo + 2) launching = true;
      tr.v += (target * pace - tr.v) * Math.min(1, dt * (inLaunch ? 2.5 : 1.2));
      tr.pos = (tr.pos + tr.v * dt * motion) % L2;
      for (let c = 0; c < CR_CARS; c++) {
        const f = tr.lane.frameAt((tr.pos - c * 3.2) / L2);
        basis.makeBasis(f.tan, f.up, f.side);
        basis.setPosition(f.p.clone().addScaledVector(f.up, 0.12));
        tr.im.setMatrixAt(c, basis);
      }
      tr.im.instanceMatrix.needsUpdate = true;
    });
    launchMat.emissiveIntensity = launching ? 2.6 + Math.sin(time * 30) * 1.2 : 0.6;
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

  // ---------- North show building ----------
  // West to east: Merchant of Venus (the old Stitch exit shop), the former
  // Stitch's Great Escape theater directly across the promenade from Laugh
  // Floor, then Cosmic Ray's Starlight Café.
  const nb = L.northBldg;
  const nbW = nb.x1 - nb.x0;
  const nbD = nb.z1 - nb.z0;
  scene.add(box(nbW, 10, nbD, mats.white, (nb.x0 + nb.x1) / 2, 5, (nb.z0 + nb.z1) / 2));
  scene.add(box(nbW + 0.6, 0.5, nbD + 0.6, mats.silver, (nb.x0 + nb.x1) / 2, 10.2, (nb.z0 + nb.z1) / 2));
  for (let i = 0; i < 10; i++) {
    const x = nb.x0 + 3 + i * 5.6;
    if (x > L.stitch.x0 && x < L.stitch.x1) continue;
    scene.add(box(0.5, 10, 1.4, mats.silver, x, 5, nb.z1 + 0.6));
  }
  // Cosmic Ray's: vaulted roof over the east end + glowing band
  const vault = mesh(new THREE.CylinderGeometry(9, 9, 24, 20, 1, false, 0, Math.PI), mats.silver);
  vault.rotation.set(0, 0, Math.PI / 2);
  vault.scale.set(0.5, 1, 1);
  vault.position.set(nb.x1 - 13, 10, (nb.z0 + nb.z1) / 2 + 2);
  scene.add(vault);
  scene.add(box(26, 0.35, 0.4, mats.warmGlow, nb.x1 - 13, 9.4, nb.z1 + 1.4));
  // Merchant of Venus band at the west end.
  scene.add(box(6, 0.35, 0.4, mats.blueSoft, nb.x0 + 4, 8.6, nb.z1 + 0.5));

  // Former Stitch's Great Escape: in-the-round theater drum on the roof.
  const sg = L.stitch;
  const sgCx = (sg.x0 + sg.x1) / 2;
  const drumMat = new THREE.MeshStandardMaterial({ color: 0xdfe6f0, roughness: 0.6, flatShading: true });
  const drum = cyl(10, 10.5, 5, 28, drumMat, sg.rx, 12.5, sg.rz);
  scene.add(drum);
  scene.add(cyl(6, 10.2, 2.4, 28, mats.silver, sg.rx, 16.2, sg.rz));
  // Reopened: refreshed, lit facade with an open entrance and a queue.
  const sgUp = new THREE.Group();
  const alienBlue = new THREE.MeshStandardMaterial({ color: 0x3aa6ff, emissive: 0x3aa6ff, emissiveIntensity: 2 });
  const alienPink = new THREE.MeshStandardMaterial({ color: 0xff6fae, emissive: 0xff6fae, emissiveIntensity: 1.8 });
  sgUp.add(box(sg.x1 - sg.x0, 0.5, 0.6, alienBlue, sgCx, 9.4, nb.z1 + 0.6));
  sgUp.add(box(sg.x1 - sg.x0, 0.3, 0.6, alienPink, sgCx, 1.2, nb.z1 + 0.6));
  // Open doorway (dark portal with a lit frame) facing the promenade.
  sgUp.add(box(8, 6, 0.3, new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: 0x16306a, emissiveIntensity: 0.8 }), sg.rx, 3, nb.z1 + 0.45));
  for (const dx of [-4.2, 4.2]) sgUp.add(box(0.4, 6.4, 0.5, alienBlue, sg.rx + dx, 3.2, nb.z1 + 0.6));
  sgUp.add(box(8.8, 0.4, 0.5, alienBlue, sg.rx, 6.4, nb.z1 + 0.6));
  // Canopy over the queue.
  sgUp.add(box(16, 0.4, 6, mats.white, sg.rx, 5.6, nb.z1 + 3.6));
  sgUp.add(box(16.2, 0.18, 0.18, alienPink, sg.rx, 5.4, nb.z1 + 6.6));
  for (const dx of [-7.6, 7.6]) sgUp.add(cyl(0.18, 0.18, 5.6, 6, mats.silver, sg.rx + dx, 2.8, nb.z1 + 6.3));
  for (let i = 0; i < 3; i++) sgUp.add(box(13, 0.9, 0.16, mats.silver, sg.rx, 0.5, nb.z1 + 2 + i * 1.6));
  // Projection-mapped drum: animated light bands around the rotunda.
  const drumBand = mesh(new THREE.CylinderGeometry(10.6, 10.6, 1, 28, 1, true), alienBlue, false, false);
  drumBand.position.set(sg.rx, 12.5, sg.rz);
  sgUp.add(drumBand);
  const orbit = new THREE.Group();
  orbit.position.set(sg.rx, 12.5, sg.rz);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    orbit.add(box(2.6, 0.5, 0.3, alienPink, Math.cos(a) * 10.7, 1.6, Math.sin(a) * 10.7).rotateY(-a + Math.PI / 2));
  }
  sgUp.add(orbit);
  // Sign over the door.
  const sgTex = signTexture(["STITCH'S", 'GREAT ESCAPE'], { w: 1024, h: 400, bg: '#0d2a52', fg: '#e8f6ff', edge: '#6fd0ff' });
  const sgSign = mesh(new THREE.PlaneGeometry(13, 5.08), new THREE.MeshBasicMaterial({ map: sgTex, transparent: true, toneMapped: false }), false, false);
  sgSign.position.set(sg.rx, 13.4, nb.z1 + 0.9);
  sgUp.add(sgSign);
  scene.add(sgUp);
  animators.push((dt, time) => {
    orbit.rotation.y += dt * 0.5 * motion;
    alienBlue.emissiveIntensity = 1.6 + Math.sin(time * 1.7 * motion) * 0.5;
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

  // ---------- Planters along the Space Mountain exit walk ----------
  const j0 = nodeById('T0');
  const j1 = nodeById('T1');
  const pdx = j1.x - j0.x;
  const pdz = j1.z - j0.z;
  const plen = Math.hypot(pdx, pdz);
  const perp = new THREE.Vector2(-pdz / plen, pdx / plen);
  const planterGeo = new THREE.CylinderGeometry(2, 2.2, 1.2, 10);
  const treeGeo = new THREE.IcosahedronGeometry(2.2, 0);
  for (const side of [-1, 1]) {
    for (const t of [0.3, 0.7]) {
      const g = new THREE.Group();
      g.add(mesh(planterGeo, mats.white).translateY(0.6));
      g.add(mesh(treeGeo, mats.foliage).translateY(3.4));
      const off = (7 / 2 + 2.4) * side;
      g.position.set(j0.x + pdx * t + perp.x * off, 0, j0.z + pdz * t + perp.y * off);
      scene.add(g);
    }
  }

  // ---------- Lamp posts along walkways ----------
  const lampSpots: THREE.Vector3[] = [];
  for (const e of EDGES) {
    if (!e.paint || e.a === 'HUB' || e.b === 'BR' || e.b === 'SPq' || e.b === 'SG') continue;
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
    const ddx = x - L.dome.x;
    const ddz = z - L.dome.z;
    if (Math.hypot(ddx, ddz) < 34) return true;
    // Keep the launch cannon's cradle clear (it points south-east).
    if (Math.hypot(ddx, ddz) < 50 && Math.abs(Math.atan2(ddz, ddx) - (Math.PI * 0.25 + 0.15)) < 0.32) return true;
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
      if (d < e.w / 2 + 4) return true;
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
    update(dt, time) {
      for (const a of animators) a(dt, time);
    },
  };
}
