// Interactive 3D massing viewer — opens a fullscreen brutalist overlay and
// renders a project's massing model with orbit controls. Wires every element
// that carries [data-model] (the "Massing Study · Interactive 3D" chips).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ---------- injected styles (uses page CSS vars: --ink, --cream, --font-mono, etc.) ---------- */
const css = `
.v-overlay{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(20,18,14,0.9);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .18s ease;}
.v-overlay.open{display:flex;opacity:1;}
.v-frame{position:relative;display:flex;flex-direction:column;width:min(1120px,96vw);height:min(740px,90vh);border:3px solid var(--ink,#1f1d18);background:var(--concrete-base,#bcb6ac);box-shadow:10px 12px 0 rgba(0,0,0,.45);transform:translateY(10px);transition:transform .2s cubic-bezier(.22,1,.36,1);}
.v-overlay.open .v-frame{transform:none;}
.v-bar{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:3px solid var(--ink,#1f1d18);background:var(--concrete-light,#cbc6bb);}
.v-bar .vb-eyebrow{font-family:var(--font-mono,monospace);font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--orange,#f47321);}
.v-bar .vb-title{font-family:var(--font-display,'Arial Black',sans-serif);font-size:clamp(15px,2vw,21px);text-transform:uppercase;line-height:1;margin-top:4px;color:var(--ink,#1f1d18);}
.v-bar .vb-tag{margin-left:auto;font-family:var(--font-mono,monospace);font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#1f1d18);opacity:.55;}
.v-close{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono,monospace);font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:9px 12px;cursor:pointer;background:var(--cream,#e5e0d2);color:var(--ink,#1f1d18);border:2px solid var(--ink,#1f1d18);transition:background .1s linear;}
.v-close:hover{background:var(--orange,#f47321);}
.v-stage{position:relative;flex:1;overflow:hidden;background:radial-gradient(120% 100% at 50% 18%, #d3cec3 0%, #b3ada1 55%, #9d978b 100%);cursor:grab;}
.v-stage:active{cursor:grabbing;}
.v-stage canvas{display:block;width:100%;height:100%;}
.v-tick{position:absolute;width:15px;height:15px;z-index:3;pointer-events:none;}
.v-tick::before,.v-tick::after{content:'';position:absolute;background:var(--ink,#1f1d18);opacity:.5;}
.v-tick::before{left:0;top:0;width:15px;height:2px;}.v-tick::after{left:0;top:0;width:2px;height:15px;}
.v-tick.tl{top:12px;left:12px;}.v-tick.tr{top:12px;right:12px;transform:scaleX(-1);}.v-tick.bl{bottom:12px;left:12px;transform:scaleY(-1);}.v-tick.br{bottom:12px;right:12px;transform:scale(-1,-1);}
.v-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:3;font-family:var(--font-mono,monospace);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#1f1d18);opacity:.6;pointer-events:none;white-space:nowrap;}
.v-load{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:var(--font-mono,monospace);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink,#1f1d18);background:var(--concrete-base,#bcb6ac);}
.v-load.hide{display:none;}
.v-load.err{color:#7a2a12;}
.v-spin{width:26px;height:26px;border:3px solid rgba(31,29,24,.25);border-top-color:var(--orange,#f47321);animation:vspin .8s linear infinite;}
@keyframes vspin{to{transform:rotate(360deg);}}
[data-model]{cursor:pointer;}
[data-model]:focus-visible{outline:2px solid var(--orange,#f47321);outline-offset:2px;}
@media (prefers-reduced-motion: reduce){.v-overlay,.v-frame{transition:none;}.v-spin{animation:none;}}
`;

const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

/* ---------- overlay DOM ---------- */
const overlay = document.createElement('div');
overlay.className = 'v-overlay';
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.innerHTML = `
  <div class="v-frame">
    <div class="v-bar">
      <div>
        <div class="vb-eyebrow" id="vbEyebrow">Massing Study</div>
        <div class="vb-title" id="vbTitle">Project</div>
      </div>
      <span class="vb-tag">Interactive 3D · Massing</span>
      <button class="v-close" id="vClose" type="button" aria-label="Close viewer">&times; Close</button>
    </div>
    <div class="v-stage" id="vStage">
      <span class="v-tick tl"></span><span class="v-tick tr"></span><span class="v-tick bl"></span><span class="v-tick br"></span>
      <div class="v-hint">Drag to orbit · Scroll to zoom</div>
      <div class="v-load" id="vLoad"><div class="v-spin"></div><span id="vLoadTxt">Loading massing…</span></div>
    </div>
  </div>`;
document.body.appendChild(overlay);

const stage = overlay.querySelector('#vStage');
const loadEl = overlay.querySelector('#vLoad');
const loadTxt = overlay.querySelector('#vLoadTxt');
const titleEl = overlay.querySelector('#vbTitle');
const eyebrowEl = overlay.querySelector('#vbEyebrow');

/* ---------- three.js setup (lazy) ---------- */
let renderer, scene, camera, controls, keyLight, ground, raf = null, ready = false;
let current = null;            // current model group in scene
const cache = {};              // url -> THREE.Group

function initThree() {
  if (ready) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  camera.position.set(40, 30, 46);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 600;
  controls.maxPolarAngle = Math.PI * 0.495;   // stay above ground
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // lighting — soft architectural studio
  const hemi = new THREE.HemisphereLight(0xf3efe3, 0x8a8478, 1.05);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);
  keyLight = new THREE.DirectionalLight(0xfff4e2, 1.7);
  keyLight.position.set(60, 90, 40);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.00012;
  keyLight.shadow.normalBias = 0.6;
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0xdfe6ef, 0.5);
  fill.position.set(-50, 40, -30);
  scene.add(fill);

  // ground shadow-catcher
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  ready = true;
}

const loader = new GLTFLoader();
const whiteMat = () => new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 0.9, metalness: 0.0, flatShading: true });

function frameModel(group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;             // sit on ground (y=0)

  const maxDim = Math.max(size.x, size.z);
  const h = size.y;
  const diag = Math.max(maxDim, h);
  ground.position.y = 0;

  // place the key light relative to the model's true size
  const lx = maxDim * 0.85, ly = (h + maxDim) * 1.3 + 12, lz = maxDim * 0.6;
  keyLight.position.set(lx, ly, lz);

  // shadow camera: frustum sized to the model, depth range hugged tight
  // (a tight near/far is what kills the acne striping + floating shadow)
  const r = maxDim * 1.4 + h * 0.5 + 6;
  const lightDist = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const sc = keyLight.shadow.camera;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
  sc.near = Math.max(0.5, lightDist - diag * 1.6);
  sc.far = lightDist + diag * 1.6 + r;
  sc.updateProjectionMatrix();
  keyLight.shadow.normalBias = Math.max(0.4, maxDim * 0.015);

  const dist = maxDim * 1.12 + h * 0.5 + 6;
  camera.position.set(dist * 0.82, dist * 0.55 + h * 0.32, dist * 0.92);
  camera.near = Math.max(0.1, dist / 400); camera.far = dist * 14; camera.updateProjectionMatrix();
  controls.target.set(0, h * 0.5, 0);
  controls.update();
}

function showModel(url) {
  if (current) { scene.remove(current); current = null; }
  if (cache[url]) {
    current = cache[url];
    scene.add(current);
    frameModel(current);
    loadEl.classList.add('hide');
    renderer.render(scene, camera);
    return;
  }
  loadEl.classList.remove('hide', 'err');
  loadTxt.textContent = 'Loading massing…';
  loader.load(url, (gltf) => {
    const g = gltf.scene;
    g.updateMatrixWorld(true);
    // measure model extents so we can spot flat ground/site plates
    const mbox = new THREE.Box3().setFromObject(g);
    const msz = new THREE.Vector3(); mbox.getSize(msz);
    const groundY = mbox.min.y;
    const hY = Math.max(0.001, msz.y);
    const _b = new THREE.Box3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
    g.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        o.material = whiteMat();
        // a thin slab resting at the base is a site/podium plate: let it
        // RECEIVE shadow but not CAST (coplanar casters self-shadow → acne + detached blobs)
        _b.setFromObject(o); _b.getSize(_s); _b.getCenter(_c);
        var thin = _s.y < 0.035 * hY;
        var atGround = (_c.y - groundY) < 0.06 * hY;
        o.castShadow = !(thin && atGround);
        o.receiveShadow = true;
      }
    });
    cache[url] = g;
    current = g;
    scene.add(g);
    frameModel(g);
    loadEl.classList.add('hide');
    renderer.render(scene, camera);
  }, undefined, (err) => {
    console.error('viewer load error', err);
    loadEl.classList.remove('hide');
    loadEl.classList.add('err');
    loadTxt.textContent = 'Could not load model';
  });
}

function resize() {
  if (!ready) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop() {
  raf = requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}

/* ---------- open / close ---------- */
let lastFocus = null;
function open(url, title, eyebrow) {
  lastFocus = document.activeElement;
  initThree();
  titleEl.textContent = title || 'Massing Study';
  eyebrowEl.textContent = eyebrow || 'Massing Study';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  controls.autoRotate = true;
  resize();
  showModel(url);
  if (!raf) loop();
  overlay.querySelector('#vClose').focus();
}
function close() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

overlay.querySelector('#vClose').addEventListener('click', close);
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
window.addEventListener('resize', resize);

/* ---------- wire the chips ---------- */
function wire(el) {
  const url = el.getAttribute('data-model');
  const title = el.getAttribute('data-title') || '';
  const eyebrow = el.getAttribute('data-eyebrow') || '';
  el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(url, title, eyebrow); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(url, title, eyebrow); } });
}
document.querySelectorAll('[data-model]').forEach(wire);
