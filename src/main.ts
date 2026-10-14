import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildWorld } from './world';
import { UPGRADES, AREA_LABELS } from './content';

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

const world = buildWorld(scene, { reducedMotion, renderer });

// ---------- Labels & pins ----------
for (const l of AREA_LABELS) {
  const el = document.createElement('div');
  el.className = 'area-label' + (l.minor ? ' minor' : '');
  el.textContent = l.text;
  const o = new CSS2DObject(el);
  o.position.set(l.x, l.y, l.z);
  scene.add(o);
}

const beamMat = new THREE.MeshBasicMaterial({ color: 0x1f8fb0, transparent: true, opacity: 0.8 });
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
  const py = u.pinY ?? 13.5;
  o.position.set(u.pos.x, py, u.pos.z);
  scene.add(o);
  pinBtns.push(btn);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(u.pos.x, 0, u.pos.z);
  beam.scale.y = py / 13.5;
  scene.add(beam);
  const base = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 24).rotateX(-Math.PI / 2), beamMat);
  base.position.set(u.pos.x, 0.25, u.pos.z);
  scene.add(base);
});

// ---------- Camera helpers ----------
// Phones frame the land a little further east so Space Mountain stays in view.
const target0 = camera.aspect < 0.8 ? new THREE.Vector3(14, 0, -14) : new THREE.Vector3(-6, 0, -22);
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
  $('c-what').innerHTML = fmtVerify(u.what);
  $('c-why').innerHTML = fmtVerify(u.why);
  $('c-adds').innerHTML = u.adds.map((a) => `<li>${fmtVerify(a)}</li>`).join('');
  const story = $('c-story');
  if (u.story) {
    story.hidden = false;
    story.innerHTML = `<h3><span class="tag tag-story">The story</span></h3><p class="story-title">${u.story.title}</p><p>${u.story.text}</p>`;
  } else story.hidden = true;
  $('c-scroll').scrollTop = 0;
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

// ---------- Tools ----------
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
      <div><h3><span class="tag tag-fix">What changed</span></h3><p>${fmtVerify(u.what)}</p></div>
      <div><h3><span class="tag tag-problem">Why</span></h3><p>${fmtVerify(u.why)}</p>
        <h3><span class="tag tag-impact">What it adds</span></h3><ul class="up-adds">${u.adds.map((a) => `<li>${fmtVerify(a)}</li>`).join('')}</ul></div>
      ${u.story ? `<div class="up-full up-story"><h3><span class="tag tag-story">The story</span></h3><p class="story-title">${u.story.title}</p><p>${u.story.text}</p></div>` : ''}
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

// Screenshot / deep-link hooks: ?welcome=0&pin=2, ?cam=x,y,z&look=x,y,z
if (params.get('welcome') === '0' || params.get('intro') === '0') welcome.setAttribute('hidden', '');
if (params.get('pin')) {
  const i = Number(params.get('pin')) - 1;
  if (UPGRADES[i]) {
    welcome.setAttribute('hidden', '');
    openCard(i, false);
    flyToPin(i, 0.001);
  }
}
const camP = params.get('cam')?.split(',').map(Number);
const lookP = params.get('look')?.split(',').map(Number);
if (camP?.length === 3 && lookP?.length === 3) {
  welcome.setAttribute('hidden', '');
  camera.position.set(camP[0], camP[1], camP[2]);
  controls.target.set(lookP[0], lookP[1], lookP[2]);
  controls.update();
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

  world.update(dt, elapsed);

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
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 40);

  renderer.info.autoReset = false;
  renderer.info.reset();
  if (++shadowTick % 3 === 0) renderer.shadowMap.needsUpdate = true;
  if (useBloom) composer.render();
  else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  // One-time adaptive quality check after things settle.
  if (!perfChecked && !params.has('hq')) {
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
