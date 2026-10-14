import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld } from './world';
import { Sim, SimStats } from './sim';
import { CrowdView } from './crowd';
import { UPGRADES, AREA_LABELS } from './content';
import { ZONE_LABELS } from './layout';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

// ---------- Renderer / scene ----------
const stage = $('stage');
const viewportEl = $('viewport');
const W = () => viewportEl.clientWidth || window.innerWidth;
const H = () => viewportEl.clientHeight || window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio, coarse ? 1.5 : 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Shadows refresh at ~20 Hz instead of every frame: rides move slowly enough.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
let shadowTick = 0;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(W(), H());
labelRenderer.domElement.className = 'label-layer';
viewportEl.insertBefore(labelRenderer.domElement, stage.nextSibling);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x10243a, 0.0017);
const camera = new THREE.PerspectiveCamera(45, W() / H(), 1, 2400);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.screenSpacePanning = false;
controls.minDistance = 22;
controls.maxDistance = 560;
controls.maxPolarAngle = 1.36;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), 0.5, 0.45, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = params.get('bloom') !== '0';

const world = buildWorld(scene, { reducedMotion });

// ---------- Guest flow ----------
const AGENTS = 750;
const startUp = params.get('mode') === 'upgraded';
const sim = new Sim(AGENTS, startUp ? 1 : 0, 7);
const simToday = new Sim(AGENTS, 0, 21);
const simUp = new Sim(AGENTS, 1, 21);
const crowd = new CrowdView(scene, sim);
const SIM_DT = 1 / 20;
// Warm up so the stats and crowding are at steady state on first view.
for (let i = 0; i < 160 / SIM_DT; i++) {
  sim.step(SIM_DT);
  simToday.step(SIM_DT);
  simUp.step(SIM_DT);
}

// ---------- Labels & pins ----------
for (const l of AREA_LABELS) {
  const el = document.createElement('div');
  el.className = l.minor ? 'area-label minor' : 'area-label';
  el.textContent = l.text;
  const o = new CSS2DObject(el);
  o.position.set(l.x, l.y, l.z);
  scene.add(o);
}

const beamMat = new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.8 });
const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 12, 6).translate(0, 6, 0);
const pinBtns: HTMLButtonElement[] = [];
UPGRADES.forEach((u, i) => {
  const btn = document.createElement('button');
  btn.className = 'pin';
  btn.innerHTML = `<span class="n">${i + 1}</span><span class="t">${u.short}</span>`;
  btn.setAttribute('aria-label', `Upgrade ${i + 1}: ${u.title}`);
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    stopTour();
    openCard(i, true);
  });
  btn.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  const o = new CSS2DObject(btn);
  o.position.set(u.pos.x, 13.5, u.pos.z);
  scene.add(o);
  pinBtns.push(btn);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(u.pos.x, 0, u.pos.z);
  scene.add(beam);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 24).rotateX(-Math.PI / 2), beamMat);
  base.position.set(u.pos.x, 0.25, u.pos.z);
  scene.add(base);
});

// ---------- Camera helpers ----------
const target0 = new THREE.Vector3(-6, 0, -22);
const topDown = params.get('view') === 'top';
function overviewPos() {
  const a = camera.aspect;
  const k = a < 0.8 ? 1.75 : a < 1.2 ? 1.35 : 1;
  if (topDown) return topPos();
  return new THREE.Vector3(target0.x - 70 * k, 190 * k, target0.z + 175 * k);
}
function topPos() {
  const a = camera.aspect;
  const k = a < 0.8 ? 1.75 : a < 1.2 ? 1.35 : 1;
  return new THREE.Vector3(target0.x, 330 * k, target0.z + 0.01);
}
camera.position.copy(overviewPos());
controls.target.copy(target0);
controls.update();

let flight: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null = null;
function flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.8) {
  flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, t: 0, dur: reducedMotion ? 0.001 : dur };
}
controls.addEventListener('start', () => {
  flight = null;
});
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function flyToPin(i: number, dur = 1.8) {
  const u = UPGRADES[i];
  const s = camera.aspect < 0.8 ? 2.2 : 1.45;
  const t = new THREE.Vector3(u.pos.x, 3, u.pos.z);
  const p = t.clone().add(new THREE.Vector3(u.cam.x * s, u.cam.y * s, u.cam.z * s));
  flyTo(p, t, dur);
}

// ---------- Mode toggle ----------
let mode: 'today' | 'upgraded' = 'today';
let blendP = 0; // 0..1 progress toward upgraded
function setMode(m: 'today' | 'upgraded') {
  mode = m;
  document.body.dataset.mode = m;
  $('mode-today').classList.toggle('active', m === 'today');
  $('mode-up').classList.toggle('active', m === 'upgraded');
  $('mode-today').setAttribute('aria-pressed', String(m === 'today'));
  $('mode-up').setAttribute('aria-pressed', String(m === 'upgraded'));
  beamMat.color.set(m === 'today' ? 0xff6b4a : 0x1f8fb0);
  renderStats(true);
  if (current >= 0) renderReadout();
}
$('mode-today').addEventListener('click', () => setMode('today'));
$('mode-up').addEventListener('click', () => setMode('upgraded'));

// ---------- Card ----------
let current = -1;
let touring = false;
const card = $('card');
function fmtVerify(s: string) {
  return s.replace(/\[verify\]/g, '<span class="verify">[verify]</span>');
}
function openCard(i: number, fly: boolean) {
  current = i;
  const u = UPGRADES[i];
  $('c-num').textContent = String(i + 1).padStart(2, '0');
  $('c-area').textContent = u.area;
  $('c-title').textContent = u.title;
  $('c-problem').innerHTML = fmtVerify(u.problem);
  $('c-fix').innerHTML = fmtVerify(u.fix);
  $('c-impact').innerHTML = u.impact.map((m) => `<dt>${m.metric}</dt><dd>${fmtVerify(m.value)}</dd>`).join('');
  $('c-count').textContent = `${i + 1} / ${UPGRADES.length}`;
  ($('c-prev') as HTMLButtonElement).disabled = i === 0;
  $('c-next').textContent = i === UPGRADES.length - 1 ? (touring ? 'Finish' : 'Done') : touring ? 'Next stop' : 'Next';
  card.hidden = false;
  // Restart the entrance animation.
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
  document.body.classList.add('card-open');
  pinBtns.forEach((b, k) => b.classList.toggle('active', k === i));
  renderReadout();
  if (fly) flyToPin(i);
}
function closeCard() {
  card.hidden = true;
  current = -1;
  document.body.classList.remove('card-open');
  pinBtns.forEach((b) => b.classList.remove('active'));
}
$('c-close').addEventListener('click', () => {
  stopTour();
  closeCard();
});
$('c-prev').addEventListener('click', () => current > 0 && openCard(current - 1, true));
$('c-next').addEventListener('click', () => {
  if (current < UPGRADES.length - 1) openCard(current + 1, true);
  else {
    stopTour();
    closeCard();
    flyTo(overviewPos(), target0.clone());
  }
});

function startTour() {
  touring = true;
  document.body.classList.add('touring');
  $('btn-tour').textContent = 'End tour';
  openCard(0, true);
}
function stopTour() {
  if (!touring) return;
  touring = false;
  document.body.classList.remove('touring');
  $('btn-tour').textContent = 'Guided tour';
  if (current >= 0) openCard(current, false);
}
$('btn-tour').addEventListener('click', () => {
  if (touring) {
    stopTour();
    closeCard();
    flyTo(overviewPos(), target0.clone());
  } else startTour();
});

// ---------- Stats ----------
let statsT: SimStats = simToday.stats();
let statsU: SimStats = simUp.stats();
const fmtMin = (m: number) => {
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function renderStats(force = false) {
  if (!force) {
    statsT = simToday.stats();
    statsU = simUp.stats();
  }
  $('s-walk-t').textContent = fmtMin(statsT.avgWalkMin);
  $('s-walk-u').textContent = fmtMin(statsU.avgWalkMin);
  $('s-crowd-t').textContent = statsT.crowdIndex.toFixed(0);
  $('s-crowd-u').textContent = statsU.crowdIndex.toFixed(0);
  $('s-hot-t').textContent = ZONE_LABELS[statsT.worstZone];
  $('s-hot-u').textContent = statsU.zoneDensity[statsU.worstZone] < 0.2 ? 'None above comfort' : ZONE_LABELS[statsU.worstZone];
  const dw = (1 - statsU.avgWalkMin / Math.max(0.01, statsT.avgWalkMin)) * 100;
  const dc = (1 - statsU.crowdIndex / Math.max(0.01, statsT.crowdIndex)) * 100;
  $('s-delta').textContent = `Upgraded: ${dw.toFixed(0)}% shorter walks, ${dc.toFixed(0)}% less crowding`;
  $('strip-delta').textContent = `${dc.toFixed(0)}%`;
}
function renderReadout() {
  if (current < 0) return;
  const u = UPGRADES[current];
  const el = $('c-readout');
  if (u.zone) {
    const dt = statsT.zoneDensity[u.zone];
    const du = statsU.zoneDensity[u.zone];
    const pct = (d: number) => Math.min(100, (d / 1.1) * 100).toFixed(0);
    el.innerHTML = `Live model readout: ${ZONE_LABELS[u.zone]}, density as a share of jam density
      <div>Today <b>${pct(dt)}%</b></div>
      <div class="bar"><i style="width:${pct(dt)}%;background:linear-gradient(90deg,#ff9f43,#ff6b4a)"></i></div>
      <div>Upgraded <b>${pct(du)}%</b></div>
      <div class="bar"><i style="width:${pct(du)}%;background:#1f8fb0"></i></div>`;
  } else {
    el.innerHTML = `Live model readout (whole land): crowding index <b>${statsT.crowdIndex.toFixed(0)}</b> today vs <b>${statsU.crowdIndex.toFixed(0)}</b> upgraded, avg walk <b>${fmtMin(statsT.avgWalkMin)}</b> vs <b>${fmtMin(statsU.avgWalkMin)}</b> min.`;
  }
}
renderStats();
$('stats-toggle').addEventListener('click', () => {
  const s = $('stats');
  const c = s.classList.toggle('collapsed');
  $('stats-toggle').setAttribute('aria-expanded', String(!c));
});
if (window.innerWidth < 760) {
  $('stats').classList.add('collapsed');
  $('stats-toggle').setAttribute('aria-expanded', 'false');
}

// ---------- Tools ----------
let paused = false;
$('btn-pause').addEventListener('click', () => {
  paused = !paused;
  document.body.classList.toggle('paused', paused);
  $('btn-pause').setAttribute('aria-pressed', String(paused));
  $('btn-pause').innerHTML = paused ? '&#9654;' : 'II';
  $('btn-pause').setAttribute('aria-label', paused ? 'Resume guest flow' : 'Pause guest flow');
});
$('btn-labels').addEventListener('click', () => {
  const off = document.body.classList.toggle('no-labels');
  $('btn-labels').setAttribute('aria-pressed', String(!off));
});
$('btn-home').addEventListener('click', () => {
  stopTour();
  closeCard();
  flyTo(overviewPos(), target0.clone());
});

// ---------- Welcome panel ----------
const welcome = $('welcome');
$('welcome-close').addEventListener('click', () => welcome.setAttribute('hidden', ''));
$('welcome-tour').addEventListener('click', () => {
  welcome.setAttribute('hidden', '');
  startTour();
});
let topView = false;
$('btn-top').addEventListener('click', () => {
  topView = !topView;
  $('btn-top').setAttribute('aria-pressed', String(topView));
  stopTour();
  closeCard();
  flyTo(topView ? topPos() : overviewPos(), target0.clone());
});
window.addEventListener('keydown', (e) => {
  if (route !== 'explore') return;
  if (e.key === 'Escape' && current >= 0) {
    stopTour();
    closeCard();
  } else if (!(e.target instanceof HTMLButtonElement && e.key === ' ')) {
    if (e.key === 't' || e.key === 'T') setMode(mode === 'today' ? 'upgraded' : 'today');
    if (e.key === 'ArrowRight' && current >= 0 && current < UPGRADES.length - 1) openCard(current + 1, true);
    if (e.key === 'ArrowLeft' && current > 0) openCard(current - 1, true);
  }
});

// ---------- Upgrades page ----------
$('up-list').innerHTML = UPGRADES.map(
  (u, i) => `<li class="up-item">
    <div class="up-num">${String(i + 1).padStart(2, '0')}</div>
    <div><h2>${u.title}</h2><p class="up-area">${u.area}</p></div>
    <div class="up-body">
      <div><h3><span class="tag tag-problem">Problem</span></h3><p>${fmtVerify(u.problem)}</p></div>
      <div><h3><span class="tag tag-fix">Fix</span></h3><p>${fmtVerify(u.fix)}</p></div>
      <div class="up-full"><h3><span class="tag tag-impact">Expected impact</span></h3>
        <dl class="up-impact">${u.impact.map((m) => `<dt>${m.metric}</dt><dd>${fmtVerify(m.value)}</dd>`).join('')}</dl></div>
    </div>
    <div class="up-actions"><a class="btn primary" href="#/explore/${i + 1}">See it in 3D</a></div>
  </li>`,
).join('');

// ---------- Hash router ----------
type Route = 'explore' | 'upgrades' | 'about';
let route: Route = 'explore';
const menuBtn = $('menu-btn');
const nav = $('site-nav');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
function applyRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const r = (['explore', 'upgrades', 'about'].includes(parts[0]) ? parts[0] : 'explore') as Route;
  const prev = route;
  route = r;
  document.body.dataset.route = r;
  for (const id of ['explore', 'upgrades', 'about']) {
    const el = $('page-' + id);
    if (id === r) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }
  nav.querySelectorAll('a').forEach((a) => {
    const on = a.dataset.route === r;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  nav.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  if (r === 'explore') {
    clock.getDelta();
    resize();
    const pin = Number(parts[1]);
    if (pin && UPGRADES[pin - 1]) {
      welcome.setAttribute('hidden', '');
      openCard(pin - 1, true);
    }
  }
  if (prev !== r || r !== 'explore') window.scrollTo(0, 0);
}
window.addEventListener('hashchange', applyRoute);

// Screenshot / deep-link hooks: ?mode=upgraded&intro=0&pin=2
if (params.get('mode') === 'upgraded') {
  setMode('upgraded');
  blendP = 1;
}
if (params.get('welcome') === '0' || params.get('intro') === '0') welcome.setAttribute('hidden', '');
if (params.get('pin')) {
  const i = Number(params.get('pin')) - 1;
  if (UPGRADES[i]) {
    welcome.setAttribute('hidden', '');
    openCard(i, false);
    flyToPin(i, 0.001);
  }
}

// ---------- Resize ----------
function resize() {
  const w = W();
  const h = H();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  labelRenderer.setSize(w, h);
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(viewportEl);

// ---------- Loop ----------
const clock = new THREE.Clock();
let acc = 0;
let statAcc = 0;
let frames = 0;
let fpsT = 0;
let perfChecked = false;
let elapsed = 0;
const viewOff = { x: 0, y: 0 };

function frame() {
  if (route !== 'explore') {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  // Blend toward the selected mode.
  const dur = reducedMotion ? 0.25 : 1.4;
  const goal = mode === 'upgraded' ? 1 : 0;
  if (blendP !== goal) blendP = goal > blendP ? Math.min(1, blendP + dt / dur) : Math.max(0, blendP - dt / dur);
  const u = ease(blendP);
  sim.t = u;

  if (!paused) {
    acc += dt;
    let steps = 0;
    while (acc >= SIM_DT && steps < 4) {
      sim.step(SIM_DT);
      simToday.step(SIM_DT);
      simUp.step(SIM_DT);
      acc -= SIM_DT;
      steps++;
    }
    if (steps === 4) acc = 0;
  }
  crowd.update(dt, u);
  world.update(paused ? 0 : dt, elapsed, u);

  statAcc += dt;
  if (statAcc > 0.5) {
    statAcc = 0;
    renderStats();
    renderReadout();
  }

  if (flight) {
    flight.t += dt / flight.dur;
    const k = ease(Math.min(1, flight.t));
    camera.position.lerpVectors(flight.p0, flight.p1, k);
    controls.target.lerpVectors(flight.t0, flight.t1, k);
    if (flight.t >= 1) flight = null;
  }
  // Shift the projection so the focus sits beside (desktop) or above (phone) the open card.
  const vw = W();
  const vh = H();
  const narrow = window.innerWidth < 760;
  const offX = current >= 0 && !narrow ? Math.min(200, vw * 0.14) : 0;
  const offY = current >= 0 && narrow ? vh * 0.22 : 0;
  const kOff = Math.min(1, dt * (reducedMotion ? 30 : 4));
  viewOff.x += (offX - viewOff.x) * kOff;
  viewOff.y += (offY - viewOff.y) * kOff;
  if (Math.abs(viewOff.x) > 0.5 || Math.abs(viewOff.y) > 0.5) {
    camera.setViewOffset(vw, vh, viewOff.x, viewOff.y, vw, vh);
  } else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  controls.update();
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -160, 140);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -150, 110);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 30);

  renderer.info.autoReset = false;
  renderer.info.reset();
  if (++shadowTick % 3 === 0) renderer.shadowMap.needsUpdate = true;
  if (useBloom) composer.render();
  else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  // One-time adaptive quality check after things settle.
  if (!perfChecked) {
    if (elapsed > 2) {
      frames++;
      fpsT += dt;
    }
    if (fpsT > 2) {
      perfChecked = true;
      const fps = frames / fpsT;
      if (fps < 40) {
        useBloom = false;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      }
    }
  }
  if (params.has('debug')) (window as unknown as { __info: unknown }).__info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, objects: scene.children.length };
  requestAnimationFrame(frame);
}

$('loading').classList.add('hidden');
applyRoute();
resize();
requestAnimationFrame(frame);
