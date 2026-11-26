/* ---------- rendu ---------- */
// Appareil modeste (tactile ou peu de cœurs) : on allège le rendu.
const LOW = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.hardwareConcurrency || 8) <= 4;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  loaderMsg.textContent = "WebGL n'est pas disponible sur cet appareil.";
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2));
{ // perte du contexte WebGL (mémoire GPU saturée sur mobile) : on le signale, on laisse three.js le récupérer, sinon on recharge une fois
  const cv = renderer.domElement; let lostT = 0;
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); try { showToast('Affichage interrompu, je le relance…'); } catch (_) {}
    clearTimeout(lostT); lostT = setTimeout(() => { let n = 0; try { n = Number(sessionStorage.getItem('aiko.ctxreload') || 0); } catch (_) {} if (n < 2) { try { sessionStorage.setItem('aiko.ctxreload', String(n + 1)); } catch (_) {} location.reload(); } }, 5000); }, false);
  cv.addEventListener('webglcontextrestored', () => { clearTimeout(lostT); try { showToast('Affichage rétabli'); } catch (_) {} }, false);
  window.__ctxLose = () => { const x = renderer.getContext().getExtension('WEBGL_lose_context'); if (x) { x.loseContext(); setTimeout(() => x.restoreContext(), 1500); } };
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
const hemi = new THREE.HemisphereLight(0xfff2e6, 0x6a5e56, 1.15);   // sol gris chaud : ombres naturelles, plus de rouge-brun dans les creux
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(1.6, 3.2, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 9;
sun.shadow.camera.left = -1.3; sun.shadow.camera.right = 1.3;
sun.shadow.camera.top = 1.6; sun.shadow.camera.bottom = -1.3;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;   // évite l'« acné d'ombre » (fines rayures sur la peau)
scene.add(sun);
// Lumières de contour douces (repris de la version « All-in-One ») : détachent la silhouette du fond
const rimA = new THREE.DirectionalLight(0x7fd8ff, 0), rimB = new THREE.DirectionalLight(0xff6f9a, 0);
rimA.position.set(-2.2, 1.6, -2.4); rimB.position.set(2.2, 1.4, -2.2);
scene.add(rimA, rimB);

const camFill = new THREE.DirectionalLight(0xfff1e8, 0.75); scene.add(camFill, camFill.target);
const rim = new THREE.DirectionalLight(0xffe2d0, 0.55);   // contour pêche doux (l'orange-rouge donnait des fesses rouges vues de dos)
rim.position.set(-2.5, 1.4, -2.2);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), new THREE.ShadowMaterial({ opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Le modèle vit dans un « rig » : c'est lui qu'on tourne ou qu'on couche pour les poses.
const rig = new THREE.Group();
rig.rotation.order = 'YXZ';
scene.add(rig);
const propMat = new THREE.MeshStandardMaterial({ color: 0x2c221a, roughness: 0.92 });
const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 28), propMat);
const bedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), propMat);
[stool, bedMesh].forEach((m) => { m.visible = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); });
const BED_H = 0.3;

// Cible du regard : attachée à la caméra, donc elle te regarde quel que soit l'angle.
const lookAtTarget = new THREE.Object3D();
camera.add(lookAtTarget);
scene.add(camera);

/* ---------- orbite / pointeur ---------- */
const target = new THREE.Vector3(0, 1.18, 0);
const camFollow = { x: 0, z: 0 };   // suivi doux du corps quand elle se déplace
const CAM = { yaw: 0, pitch: 0.05, dist: 2.4, pitchMin: -1.25, pitchMax: 1.45, min: 0.3, max: 12, px: 0, py: 0, frame: 0 };   // px/py : décalage (pan) ; frame : cadrage choisi au double-tap
const mouse = new THREE.Vector2(0, 0);
let stageRect = { left: 0, top: 0, width: 1, height: 1 };

const CAMS = { yaw: null, pitch: 0, dist: 0, px: 0, py: 0, t: performance.now(), ty: null };   // caméra affichée (lissée)
function updateCamera() {
  const now = performance.now(), dt = Math.min(0.1, (now - CAMS.t) / 1000); CAMS.t = now;
  if (CAMS.yaw === null) Object.assign(CAMS, { yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist, px: CAM.px, py: CAM.py });
  const k = 1 - Math.exp(-dt * (CAM.slow ? 2.4 : 9));                // rejoint la cible en ~0,3 s (plus lentement quand la caméra auto cadre)
  for (const n of ['yaw', 'pitch', 'dist', 'px', 'py']) CAMS[n] += (CAM[n] - CAMS[n]) * k;
  CAMS.ty = CAMS.ty === null ? target.y : CAMS.ty + (target.y - CAMS.ty) * (1 - Math.exp(-dt * 3));   // le suivi vertical est encore plus doux
  const C = CAMS;
  const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
  const rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw);      // vecteur « droite » de l'écran
  const tx = target.x + C.px * rx, ty = C.ty + C.py, tz = target.z + C.px * rz;
  camera.position.set(tx + C.dist * cp * Math.sin(C.yaw), ty + C.dist * sp, tz + C.dist * cp * Math.cos(C.yaw));
  camera.lookAt(tx, ty, tz);
  // Lumière d'appoint qui suit la caméra (comme le flash doux d'un photographe) : sous tous les angles, plus de zones
  // plongées dans l'ombre ni de taches rougeâtres dans la pénombre de la peau.
  camFill.position.set(camera.position.x + (camera.position.y - ty) * 0, camera.position.y + 0.9, camera.position.z);
  camFill.target.position.set(tx, ty, tz); camFill.target.updateMatrixWorld();
}

const pointers = new Map();
let pinchD0 = 0, pinchDist0 = 0;

stage.addEventListener('pointerdown', (e) => {
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.classList.add('dragging');
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchD0 = Math.hypot(a.x - b.x, a.y - b.y);
    pinchDist0 = CAM.dist; pinchC0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const now = performance.now();                          // double-tap : corps entier → buste → visage
  if (pointers.size === 1) { if (now - lastTap < 320) cycleFrame(); lastTap = now; }
});
let pinchC0 = null, lastTap = 0;
const FRAMES = [{ py: -0.38, dist: 3.9 }, { py: 0, dist: 2.2 }, { py: 0.27, dist: 0.95 }];   // corps entier, buste, visage
function cycleFrame() { CAM.frame = (CAM.frame + 1) % FRAMES.length; const f = FRAMES[CAM.frame]; CAM.py = f.py * (body.k || 1); CAM.px = 0; CAM.dist = f.dist * (body.k || 1); }
function camPan(dx, dy) { const k = CAM.dist * 0.0012; CAM.px = clamp(CAM.px - dx * k, -2, 2); CAM.py = clamp(CAM.py + dy * k, -1.4, 1.0); }

stage.addEventListener('pointermove', (e) => {
  mouse.x = clamp(((e.clientX - stageRect.left) / stageRect.width) * 2 - 1, -1, 1);
  mouse.y = clamp(-(((e.clientY - stageRect.top) / stageRect.height) * 2 - 1), -1, 1);
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1 && (e.shiftKey || (e.buttons & 2))) camPan(dx, dy);   // ordinateur : clic droit ou Maj + glisser = déplacer
  else if (pointers.size === 1) {
    CAM.yaw -= dx * 0.005;
    CAM.pitch = clamp(CAM.pitch + dy * 0.004, CAM.pitchMin, CAM.pitchMax);
  } else if (pointers.size === 2 && pinchD0 > 0) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    CAM.dist = clamp(pinchDist0 * pinchD0 / Math.max(40, d), CAM.min, CAM.max);
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };          // deux doigts qui glissent ensemble : déplacer l'image
    if (pinchC0) { camPan(c.x - pinchC0.x, c.y - pinchC0.y); } pinchC0 = c;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  pinchD0 = 0; pinchC0 = null;
  if (!pointers.size) stage.classList.remove('dragging');
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  CAM.dist = clamp(CAM.dist * (1 + e.deltaY * 0.0012), CAM.min, CAM.max);
}, { passive: false });

function resize() {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  stageRect = stage.getBoundingClientRect();
}
{ let rq = 0; new ResizeObserver(() => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; resize(); }); }).observe(stage); }
resize();
/* Le texte d'Aiko ne couvre jamais son corps : la scène se resserre au-dessus du texte et des boutons (paliers de 40 px : pas de saccade). */
{
  const ctl = document.querySelector('.controls'), main = document.querySelector('main');
  const fit = () => {
    const panel = document.getElementById('panel');
    const parts = [...ctl.children].filter((c) => c !== panel && !c.hidden && c.offsetHeight);   // le panneau tenues s'ouvre par-dessus
    const h = parts.reduce((a, c) => a + c.offsetHeight + 8, 0) + 20;
    main.style.setProperty('--ctl', Math.ceil(h / 40) * 40 + 'px');
  };
  let fq = 0; const fitL = () => { if (!fq) fq = requestAnimationFrame(() => { fq = 0; fit(); }); };   // hors de la boucle d'observation : pas d'erreur ResizeObserver
  new ResizeObserver(fitL).observe(ctl);
  new MutationObserver(fitL).observe(ctl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  fit();
}
