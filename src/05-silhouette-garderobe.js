/* ---------- silhouette : proportions réglables (hanches, taille, buste) par mise à l'échelle du squelette ---------- */
let shapeV = clamp(Number(store.get('aiko.shape', '50')) || 0, 0, 100);
$('#shape').value = String(shapeV);
function applyShape() {
  if (!vrm || !vrm.humanoid) return;
  const raw = (n) => { try { return vrm.humanoid.getRawBoneNode(n); } catch (_) { return null; } };
  const t = shapeV / 100 * (1 - 0.6 * poseCur.sit);      // assise : effet réduit, sinon les cuisses à l'horizontale se déforment
  const h = 1 + 0.24 * t, w = 1 - 0.1 * t, c = 1 + 0.12 * t;      // hanches et cuisses, taille, buste
  const set = (b, k) => { if (b) b.scale.set(k, 1, k); };
  const hips = raw('hips'), spine = raw('spine'), chest = raw('upperChest') || raw('chest'), neck = raw('neck') || raw('head');
  if (!hips || !spine || !chest || chest === spine) return;
  set(hips, h); set(spine, w / h); set(chest, c / w); set(neck, 1 / c);
  set(raw('leftLowerLeg'), 1 / h); set(raw('rightLowerLeg'), 1 / h);   // mollets et pieds gardent leur taille
  for (const n of ['leftShoulder', 'rightShoulder']) { const b = raw(n); if (b) b.scale.setScalar(1); }
}
$('#shape').addEventListener('input', (e) => {
  shapeV = clamp(Number(e.target.value) || 0, 0, 100);
  store.set('aiko.shape', String(shapeV));
  applyShape();
});

/* ---------- panneau des réglages : fermé par défaut, l'avatar reste dégagé ---------- */
function setPanel(open) {
  $('#panel').hidden = !open;
  $('#btn-panel').classList.toggle('on', open);
  $('#btn-panel').setAttribute('aria-expanded', String(open));
}
$('#btn-panel').addEventListener('click', () => setPanel($('#panel').hidden));
$('#btn-mind').addEventListener('click', () => openMind(true));
$('#mind-close').addEventListener('click', () => openMind(false));
renderer.domElement.addEventListener('pointerdown', () => { if (!$('#panel').hidden) setPanel(false); });

/* ---------- garde-robe : pièces séparées (wear_<emplacement>_<pièce>) ---------- */
const WR_SLOTS = [['soutien', 'Soutien'], ['dessous', 'Dessous'], ['maillot', 'Maillot'], ['robe', 'Robe'], ['haut', 'Haut'], ['bas', 'Bas'], ['jambes', 'Jambes'], ['pieds', 'Pieds']];
const WR_LABEL = { soutien_balconnet_noir: 'Balconnet noir', maillot_body_dentelle: 'Body noir', maillot_body_rouge: 'Body rouge', soutien_brassiere: 'Brassière', soutien_balconnet: 'Balconnet dentelle', soutien_bresilien: 'Brésilien chameau', robe_moulante: 'Moulante noire', robe_moulante_rouge: 'Moulante rouge', robe_nuisette: 'Nuisette satin', robe_voile: 'Voile noir', robe_nuisette_voile: 'Nuisette voile', haut_chemisier_voile: 'Chemisier voile', bas_microjupe: 'Micro-jupe vinyle', pieds_talons: 'Talons noirs', pieds_talons_rouges: 'Talons rouges', dessous_culotte: 'Culotte', dessous_tanga: 'Tanga', dessous_string: 'String', maillot_bikini_rouge: 'Bikini rouge', maillot_bikini_noir: 'Bikini noir', maillot_bikini_turquoise: 'Bikini turquoise', robe_courte: 'Robe rouge', robe_noire: 'Robe noire', haut_crop: 'Crop top', haut_debardeur: 'Débardeur', haut_tshirt: 'T-shirt', haut_pull: 'Pull',
  bas_minijupe: 'Mini-jupe', bas_jupe: 'Jupe', bas_jupelongue: 'Jupe longue', bas_short: 'Short', bas_jean: 'Jean', bas_legging: 'Legging',
  jambes_bas: 'Bas', jambes_resille: 'Bas résille', bas_collant_resille: 'Collant résille', jambes_chaussettes: 'Chaussettes', pieds_ballerines: 'Ballerines', pieds_bottines: 'Bottines' };
const wr = { items: {}, on: null };          // items : nom -> [maillages]
function wrDefault() { return { soutien: '', dessous: '', maillot: '', robe: '', haut: '', bas: '', jambes: '', pieds: '' }; }   // par défaut : aucune tenue
function wrApply(save) {
  const on = wr.on, has = (n) => !!wr.items[n];
  if (on.maillot) { on.robe = ''; on.haut = ''; on.bas = ''; }
  if (on.robe) { on.haut = ''; on.bas = ''; }
  const tight = ['bas_jean', 'bas_legging', 'bas_short'].includes(on.bas);   // la résille laisse voir les dessous
  if (on.dessous === undefined || (on.dessous && !has(on.dessous))) on.dessous = 'dessous_culotte';            // '' = sans dessous (choix libre)
  if (on.soutien === undefined || (on.soutien && !has(on.soutien))) on.soutien = has('soutien_balconnet_noir') ? 'soutien_balconnet_noir' : 'soutien_brassiere';
  const vis = new Set(Object.values(on).filter(Boolean)); vis.delete(on.dessous); vis.delete(on.soutien);
  // dessous toujours portés ; masqués seulement quand un vêtement opaque les couvre (visibles sous le voile)
  const sheerTop = /voile/.test(on.robe + on.haut), sheerBot = /voile/.test(on.robe);
  if (on.soutien && !on.maillot && (sheerTop || (!on.robe && !on.haut))) vis.add(on.soutien);
  if (on.dessous && !on.maillot && (sheerBot || !tight)) vis.add(on.dessous);       // le maillot remplace les dessous
  for (const j of ['jambes_bas', 'jambes_resille']) if (vis.has(j) && ['bas_jean', 'bas_legging', 'bas_collant_resille'].includes(on.bas)) vis.delete(j);
  if (vis.has('jambes_chaussettes') && on.pieds === 'pieds_bottines') vis.delete('jambes_chaussettes');
  for (const n in wr.items) for (const m of wr.items[n]) m.visible = vis.has(n);
  document.querySelectorAll('#wardrobe .chip').forEach((b) => b.classList.toggle('on', (on[b.dataset.slot] || '') === b.dataset.item));
  if (save) store.set('aiko.wardrobe', JSON.stringify(on));
}
function wrWear(list) {                      // ex. ['robe_noire', 'pieds_bottines'] ou ['haut_crop', 'bas_minijupe']
  if (!wr.on) return false;
  let changed = false;
  for (let n of list) {
    n = String(n).trim().toLowerCase().replace(/\s+/g, '_');
    const slot = n.split('_')[0];
    if (n.endsWith('_aucun') || n.endsWith('_rien')) { if (wr.on[slot] !== undefined) { wr.on[slot] = ''; changed = true; } continue; }
    if (!wr.items[n]) continue;
    if (slot === 'haut' || slot === 'bas') { wr.on.robe = ''; wr.on.maillot = ''; }
    if (slot === 'robe') wr.on.maillot = '';
    wr.on[slot] = n; changed = true;
  }
  if (changed) wrApply(true);
  return changed;
}
/* ---------- palette de couleurs des vêtements ---------- */
const WR_PALETTE = ['#111111', '#f5f0e8', '#c19a6b', '#7a4a21', '#b71c1c', '#e91e63', '#ff7043', '#f9a825', '#2e7d32', '#00838f', '#1565c0', '#6a1b9a'];
wr.colors = {}; wr.target = 'soutien';
function wrColorItem(item, hex) {          // hex = '' pour revenir à la couleur d'origine
  for (const o of (wr.items[item] || [])) {
    if (!o.material) continue;
    if (!o.material.userData.__own) { o.material = o.material.clone(); o.material.userData.__own = true; o.material.userData.__c0 = o.material.color.clone(); }
    if (hex) o.material.color.set(hex); else o.material.color.copy(o.material.userData.__c0);
  }
}
function wrColorsApply() { for (const n in wr.colors) wrColorItem(n, wr.colors[n]); }
function wrColorSet(slot, hex) {
  const item = wr.on && wr.on[slot]; if (!item) return false;
  if (hex) wr.colors[item] = hex; else delete wr.colors[item];
  wrColorItem(item, hex);
  try { store.set('aiko.wardrobe.colors', JSON.stringify(wr.colors)); } catch (_) {}
  wrSwatchSync(); return true;
}
function wrSwatchSync() {
  const cur = wr.on && wr.on[wr.target] ? (wr.colors[wr.on[wr.target]] || '') : '';
  document.querySelectorAll('#wardrobe .sw[data-color]').forEach((b) => b.classList.toggle('on', !!cur && b.dataset.color.toLowerCase() === cur.toLowerCase()));
  document.querySelectorAll('#wardrobe .chip[data-ctarget]').forEach((b) => b.classList.toggle('on', b.dataset.ctarget === wr.target));
  const pick = document.querySelector('#wardrobe input[type=color]'); if (pick && cur) pick.value = cur;
}
function wrColorUI(box) {
  const WORN = [['soutien', 'Soutien'], ['dessous', 'Dessous'], ['maillot', 'Maillot'], ['robe', 'Robe'], ['haut', 'Haut'], ['bas', 'Bas'], ['jambes', 'Jambes'], ['pieds', 'Pieds']];
  const r1 = document.createElement('div'); r1.className = 'wr';
  const l1 = document.createElement('span'); l1.className = 'wl'; l1.textContent = 'Couleur de'; r1.appendChild(l1);
  for (const [slot, label] of WORN) {
    if (!Object.keys(wr.items).some((n) => n.startsWith(slot + '_'))) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.ctarget = slot; b.textContent = label;
    b.addEventListener('click', () => { wr.target = slot; wrSwatchSync(); });
    r1.appendChild(b);
  }
  const r2 = document.createElement('div'); r2.className = 'wr';
  const l2 = document.createElement('span'); l2.className = 'wl'; l2.textContent = 'Palette'; r2.appendChild(l2);
  for (const hex of WR_PALETTE) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.dataset.color = hex; b.style.background = hex; b.title = hex; b.setAttribute('aria-label', 'Couleur ' + hex);
    b.addEventListener('click', () => wrColorSet(wr.target, hex));
    r2.appendChild(b);
  }
  const pick = document.createElement('input'); pick.type = 'color'; pick.value = '#c19a6b'; pick.title = 'Autre couleur';
  pick.addEventListener('input', () => wrColorSet(wr.target, pick.value));
  r2.appendChild(pick);
  const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'sw reset'; rs.textContent = '↺'; rs.title = 'Couleur d\'origine'; rs.setAttribute('aria-label', 'Couleur d\'origine');
  rs.addEventListener('click', () => wrColorSet(wr.target, ''));
  r2.appendChild(rs);
  box.appendChild(r1); box.appendChild(r2);
}
function fishnetMat(qs, qo) {      // qs, qo : décompression du maillage (positions quantifiées → mètres)                // filet en losanges calculé sur la forme de la jambe (les vêtements n'ont pas d'UV) : fils noirs fins, peau visible au travers
  const m = new THREE.MeshStandardMaterial({ name: 'Résille', color: 0x0b0b0c, roughness: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uQs = { value: qs || new THREE.Vector3(1, 1, 1) }; sh.uniforms.uQo = { value: qo || new THREE.Vector3() };
    sh.vertexShader = 'varying vec3 vRest;\nuniform vec3 uQs; uniform vec3 uQo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRest = position * uQs + uQo;');
    sh.fragmentShader = 'varying vec3 vRest;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float cx = vRest.x > 0.0 ? 0.095 : -0.095;                  // axe approximatif de chaque jambe
      float ang = atan(vRest.z, vRest.x - cx) * 0.07;             // tour de jambe en mètres
      float k = 1.0 / 0.013;                                      // une maille ≈ 1,3 cm
      float a = abs(fract((ang + vRest.y) * k) - 0.5), b = abs(fract((ang - vRest.y) * k) - 0.5);
      if (min(a, b) > 0.085) discard;`);
  };
  m.customProgramCacheKey = () => 'aiko-fishnet';   // même programme, uniformes propres à chaque maillage
  return m;
}
function wrSetup(root) {
  wr.items = {};
  root.traverse((o) => { if (o.isMesh && /^wear_/.test(o.name)) (wr.items[o.name.slice(5)] = wr.items[o.name.slice(5)] || []).push(o); });
  // résille : copies ajourées des bas et du legging (même squelette, même forme ; un filet en losanges généré ici)
  for (const [src, dst] of [['jambes_bas', 'jambes_resille'], ['bas_legging', 'bas_collant_resille']]) {
    if (!wr.items[src] || wr.items[dst]) continue;
    wr.items[dst] = wr.items[src].map((m) => {
      const P = m.geometry.attributes.position, V = new THREE.Vector3(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], wl = [1e9, 1e9, 1e9], wh = [-1e9, -1e9, -1e9];
      m.updateWorldMatrix(true, false);
      for (let i = 0; i < P.count; i += 3) { const r = [P.getX(i), P.getY(i), P.getZ(i)]; (m.isSkinnedMesh ? m.getVertexPosition(i, V) : V.fromBufferAttribute(P, i)); V.applyMatrix4(m.matrixWorld); const w = V.toArray();
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], r[k]); hi[k] = Math.max(hi[k], r[k]); wl[k] = Math.min(wl[k], w[k]); wh[k] = Math.max(wh[k], w[k]); } }
      const qs = new THREE.Vector3(...[0, 1, 2].map((k) => (wh[k] - wl[k]) / Math.max(1e-6, hi[k] - lo[k]))), qo = new THREE.Vector3(...[0, 1, 2].map((k) => wl[k] - lo[k] * qs.getComponent(k)));
      const c = m.isSkinnedMesh ? new THREE.SkinnedMesh(m.geometry, fishnetMat(qs, qo)) : new THREE.Mesh(m.geometry, fishnetMat(qs, qo));
      if (m.isSkinnedMesh) c.bind(m.skeleton, m.bindMatrix);
      c.name = 'wear_' + dst; c.visible = false; c.frustumCulled = false; m.parent.add(c); return c;
    });
  }
  const box = $('#wardrobe');
  const any = Object.keys(wr.items).some((n) => !/^dessous_/.test(n));
  
  box.hidden = !any; $('#row-outfit').hidden = any || $('#row-outfit').hidden;
  if (!any) { wr.on = null; return false; }
  box.textContent = '';
  for (const [slot, label] of WR_SLOTS) {
    const names = Object.keys(wr.items).filter((n) => n.startsWith(slot + '_'));
    if (!names.length) continue;
    const row = document.createElement('div'); row.className = 'wr';
    const l = document.createElement('span'); l.className = 'wl'; l.textContent = label; row.appendChild(l);
    for (const n of ['', ...names]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
      b.dataset.slot = slot; b.dataset.item = n; b.textContent = n ? (WR_LABEL[n] || n.slice(slot.length + 1)) : '—';
      b.addEventListener('click', () => { if (n) wrWear([n]); else { wr.on[slot] = ''; wrApply(true); } });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
  wrColorUI(box);
  let saved = null;
  if (store.get('aiko.wardrobe.v2', '') !== '1') { store.set('aiko.wardrobe', 'null'); store.set('aiko.wardrobe.v2', '1'); }   // ancienne tenue mémorisée remise à zéro une fois
  try { saved = JSON.parse(store.get('aiko.wardrobe', 'null')); } catch (_) {}
  wr.on = Object.assign(wrDefault(), saved || {});
  for (const k in wr.on) if (wr.on[k] && !wr.items[wr.on[k]]) wr.on[k] = '';
  try { wr.colors = JSON.parse(store.get('aiko.wardrobe.colors', '{}')) || {}; } catch (_) { wr.colors = {}; }
  wrColorsApply(); wrApply(false); wrSwatchSync();
  return true;
}
function wrDescribe() {
  if (!wr.on) return '';
  const worn = Object.values(wr.on).filter(Boolean).map((n) => WR_LABEL[n] || n);
  return 'Tu portes : ' + (worn.length ? worn.join(', ') : 'tes sous-vêtements') + '.\nTa garde-robe : ' + Object.keys(wr.items).join(', ') + '.';
}

/* ---------- tenues & options ---------- */
// Le modèle de démo est un simple gabarit technique au physique juvénile : il reste toujours habillé.
// Les tenues ne se débloquent qu'avec ton propre modèle (aiko.vrm ou « ＋ VRM perso »).
let demoLock = false;
function applyOutfit(o, silent) {
  if (!OUTFIT_SHOW[o]) return;
  if (demoLock && o !== 'habillee') {
    if (!silent) showToast('Avatar d\'exemple : une seule tenue.');
    return;
  }
  currentOutfit = o;
  store.set('aiko.outfit', o);
  const show = OUTFIT_SHOW[o];
  for (const k in show) groups[k].forEach((m) => { m.visible = !!show[k]; });
  document.querySelectorAll('#row-outfit .chip').forEach((b) => b.classList.toggle('on', b.dataset.outfit === o));
  if (!silent) showToast(OUTFIT_LABEL[o]);
}
document.querySelectorAll('#row-outfit .chip').forEach((b) => b.addEventListener('click', () => applyOutfit(b.dataset.outfit)));
applyOutfit(currentOutfit, true);

// Distance de caméra pour voir tout le corps allongé, selon la forme de l'écran (portrait = plus loin)
function bedDist() {
  const width = body.height + 0.35;
  const d = width / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(0.3, camera.aspect));
  return clamp(d, 2.8, CAM.max);
}
function setPose(p, silent) {
  if (!POSES[p]) return;
  const was = currentPose;
  currentPose = p;
  store.set('aiko.pose', p);
  // Allongée, elle occupe toute la largeur : on recule la caméra ; on la ramène en se relevant.
  if (p === 'bed' && was !== 'bed') { CAM.yaw = 0; CAM.pitch = 0.3; CAM.dist = bedDist(); }
  else if (p !== 'bed' && was === 'bed') { CAM.yaw = 0; CAM.pitch = 0.05; CAM.dist = (body.cam || 2.4) * body.k; }
  document.querySelectorAll('#row-pose .chip').forEach((b) => b.classList.toggle('on', b.dataset.pose === p));
  if (!silent) showToast('Pose : ' + POSES[p].label.toLowerCase());
}
document.querySelectorAll('#row-pose .chip').forEach((b) => b.addEventListener('click', () => setPose(b.dataset.pose)));
{ const p0 = currentPose; currentPose = 'front'; setPose(p0, true); }

function applyHair() {
  groups.hair.forEach((m) => { m.visible = hairOn; });
  $('#btn-cheveux').classList.toggle('on', hairOn);
}
function applyGlasses() {
  groups.glasses.forEach((m) => { m.visible = glassesOn; });
  $('#btn-lunettes').classList.toggle('on', glassesOn);
}
$('#btn-cheveux').addEventListener('click', () => {
  if (!groups.hair.length) { showToast('Pas de cheveux détectés sur ce modèle'); return; }
  hairOn = !hairOn;
  applyHair();
  showToast(hairOn ? 'Cheveux : visibles' : 'Cheveux : retirés');
});
$('#btn-lunettes').addEventListener('click', () => {
  if (!groups.glasses.length) { showToast('Aucune lunettes détectées sur ce modèle'); return; }
  glassesOn = !glassesOn;
  applyGlasses();
  showToast(glassesOn ? 'Lunettes : on' : 'Lunettes : off');
});
$('#btn-reset').addEventListener('click', () => {
  if (currentPose === 'bed') { CAM.yaw = 0; CAM.pitch = 0.3; CAM.dist = bedDist(); }
  else { CAM.yaw = 0; CAM.pitch = 0.05; CAM.dist = (body.cam || 2.4) * body.k; }
  mouse.set(0, 0);
  emotion = null;
  PRESETS.forEach((n) => setExpr(n, 0));
  showToast('Réinitialisé');
});

let toastTimer = 0;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
