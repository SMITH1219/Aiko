/* ── auto-réparation : la boucle ne s'arrête jamais ; os corrompus, geste bloqué ou erreur → retour à un état sain, incident noté ── */
/* ── formes correctives du bassin (pose space deformation) : selon l'ouverture et la flexion de chaque cuisse,
   la peau de l'aine, des fesses et de l'entrejambe est corrigée (générées dans Blender par « Corrective Smooth ») ── */
const CORR = { meshes: [], ready: false, d0: {}, lat: null, fwd: null, down: null, v: new THREE.Vector3(), q: new THREE.Quaternion(), a: new THREE.Vector3(), b: new THREE.Vector3() };
window.__corr = null;
const CORR_T = { abd: THREE.MathUtils.degToRad(74), flex: THREE.MathUtils.degToRad(89) };
function correctivesSetup() {
  CORR.meshes = []; if (!vrm) return;
  vrm.scene.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && ('corr_L_abd' in o.morphTargetDictionary)) CORR.meshes.push(o); });
  CORR.ready = false;
  // Sur la ligne médiane (pubis, sillon), les corrections gauche et droite s'additionnent et déchirent la peau quand les deux
  // cuisses bougent : on les éteint au centre, en fondu, et aucune correction ne dépasse 2,5 cm.
  try {
    const hx = bones.hips ? bones.hips.getWorldPosition(new THREE.Vector3()).x : 0, V = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const m of CORR.meshes) {
      if (m.userData.corrTamed) continue; m.userData.corrTamed = 1;
      m.updateWorldMatrix(true, false); m.matrixWorld.decompose(V, new THREE.Quaternion(), sc); const k = Math.abs(sc.x) || 1;
      const P = m.geometry.attributes.position, MA = m.geometry.morphAttributes.position || [];
      const f = new Float32Array(P.count);
      for (let i = 0; i < P.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); const d = Math.abs(V.x - hx); const t = Math.min(1, Math.max(0, (d - 0.012) / 0.04)); f[i] = t * t * (3 - 2 * t); }
      for (const A of MA) for (let i = 0; i < A.count; i++) {
        let x = A.getX(i) * f[i], y = A.getY(i) * f[i], z = A.getZ(i) * f[i]; const l = Math.hypot(x, y, z) * k;
        if (l > 0.025) { const r = 0.025 / l; x *= r; y *= r; z *= r; }
        A.setXYZ(i, x, y, z);
      }
      for (const A of MA) A.needsUpdate = true;
    }
  } catch (e) { console.warn('correctifs', e); }
}
function thighLocal(side, out) {   // direction de la cuisse dans le repère du bassin
  const b = bones; const up = b[side + 'UpLeg'], lo = b[side + 'LowLeg']; if (!up || !lo || !b.hips) return null;
  up.getWorldPosition(CORR.a); lo.getWorldPosition(CORR.b); b.hips.getWorldQuaternion(CORR.q);
  return out.copy(CORR.b).sub(CORR.a).normalize().applyQuaternion(CORR.q.invert());
}
function correctivesUpdate() {
  if (!CORR.meshes.length) return;
  if (window.__nocorr) { for (const m of CORR.meshes) m.morphTargetInfluences.fill(0); return; }
  rig.updateMatrixWorld(true);
  if (!CORR.ready) {               // repère de repos (au premier passage, debout)
    const l = thighLocal('l', new THREE.Vector3()), r = thighLocal('r', new THREE.Vector3()); if (!l || !r) return;
    bones.lUpLeg.getWorldPosition(CORR.a); bones.rUpLeg.getWorldPosition(CORR.b); bones.hips.getWorldQuaternion(CORR.q);
    CORR.lat = CORR.a.clone().sub(CORR.b).normalize().applyQuaternion(CORR.q.clone().invert());          // vers la gauche
    CORR.down = l.clone().add(r).normalize(); CORR.fwd = new THREE.Vector3().crossVectors(CORR.lat, CORR.down).normalize();
    const probe = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(CORR.q.clone().invert());
    if (CORR.fwd.dot(probe) < 0) CORR.fwd.negate();                                                     // « devant » = sens du regard
    CORR.ready = true; window.__corr = CORR;
  }
  for (const [side, S, out] of [['l', 'L', 1], ['r', 'R', -1]]) {
    const v = thighLocal(side, CORR.v); if (!v) continue;
    const dn = Math.max(1e-3, v.dot(CORR.down));
    const abd = Math.atan2(Math.abs(v.dot(CORR.lat)), Math.max(0.05, Math.hypot(dn, v.dot(CORR.fwd))));   // ouverture = écart à l'axe du corps (indépendant du sens de l'axe)
    const flex = Math.atan2(Math.max(0, v.dot(CORR.fwd)), Math.max(0.05, Math.hypot(dn, v.dot(CORR.lat))));
    const wa = Math.min(1.15, abd / CORR_T.abd), wf = Math.min(1.15, flex / CORR_T.flex);
    (CORR.w || (CORR.w = {}))[S] = { a: Math.min(1, wa), f: Math.min(1, wf) };   // ouverture et flexion de la cuisse : servent aussi aux muscles fessiers
    for (const m of CORR.meshes) { const d = m.morphTargetDictionary, inf = m.morphTargetInfluences;
      if (d['corr_' + S + '_abd'] !== undefined) inf[d['corr_' + S + '_abd']] = wa * wa * (3 - 2 * Math.min(1, wa)) ;
      if (d['corr_' + S + '_flex'] !== undefined) inf[d['corr_' + S + '_flex']] = wf * wf * (3 - 2 * Math.min(1, wf)); }
  }
}
const HEAL = { n: 0, t0: 0, last: 0, check: 0 };
let _srDone = false;                                                          // une main a-t-elle été posée cette image ? (pour recopier le rig vers le squelette affiché)
function selfRepair(kind, err) {
  const now = Date.now();
  try { gst = null; } catch (_) {}
  try { if (vrm) { vrm.scene.traverse((o) => { if (o.isBone) { const q = o.quaternion; if (!isFinite(q.x + q.y + q.z + q.w)) o.quaternion.set(0, 0, 0, 1); if (!isFinite(o.position.x + o.position.y + o.position.z)) o.position.set(0, 0, 0); } });
    if (!isFinite(rig.position.x + rig.position.y + rig.position.z)) rig.position.set(0, 0, 0); } } catch (_) {}
  if (now - HEAL.last > 4000) {        // une entrée par incident, pas une par image
    HEAL.last = now; life.incidents.push({ at: now, kind, msg: String((err && (err.message || err)) || '').slice(0, 160) }); life.incidents = life.incidents.slice(-40);
    try { saveLife(); } catch (_) {}
  }
}
function healthCheck() {             // une fois par seconde : chaque os doit être un nombre fini, le geste en cours ne doit pas être figé
  if (!vrm) return;
  let bad = 0; vrm.scene.traverse((o) => { if (o.isBone) { const q = o.quaternion; if (!isFinite(q.x + q.y + q.z + q.w)) bad++; } });
  if (bad) selfRepair('os corrompus', bad + ' os');
  if (gst && gst.t > (gst.dur || 10) + 20) selfRepair('geste bloqué', gst.name || '');
}
const AQ = { max: Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2), cur: 0, acc: 0, n: 0, last: performance.now(), cool: 0 };   // résolution adaptative : baisse si ça rame, remonte si ça va bien
AQ.cur = AQ.max;
function adaptRes() {
  const now = performance.now(), d = now - AQ.last; AQ.last = now;
  if (document.hidden || d > 2000) { AQ.acc = 0; AQ.n = 0; return; }
  AQ.acc += d; AQ.n++;
  if (AQ.n < 40 && AQ.acc < 2500) return;
  const avg = AQ.acc / AQ.n; AQ.acc = 0; AQ.n = 0; if (AQ.cool > 0) AQ.cool--;
  let nx = AQ.cur;
  if (avg > 28 && AQ.cur > 0.75) { nx = Math.max(0.75, AQ.cur - 0.25); AQ.cool = 4; }
  else if (avg < 15 && AQ.cur < AQ.max && AQ.cool === 0) nx = Math.min(AQ.max, AQ.cur + 0.25);
  if (nx !== AQ.cur) { AQ.cur = nx; renderer.setPixelRatio(nx); resize(); }
}
window.__aq = AQ;
function animate() {
  requestAnimationFrame(animate);
  if (window.__freeze) return;                                               // épreuves : la boucle vit au pas manuel SEULEMENT (sinon le temps file entre une mesure et sa photo — vu : toutes les photos montraient ~1 s plus tard que leurs chiffres)
  try { adaptRes(); } catch (_) {}
  try { animateFrame(); } catch (e) { selfRepair('animation', e); }
  if (tNow - HEAL.check > 1) { HEAL.check = tNow; try { healthCheck(); } catch (_) {} }
}
/* ══ MESURE DES PERFORMANCES : images/s et temps par module, à afficher sur TON appareil (Réglages → « Mesurer la fluidité », ou #fps dans l'adresse) ══ */
const PERF = { on: /[#&]fps\b/.test(location.hash), cur: { tot: 0, surf: 0, nsurf: 0, mains: 0, toucher: 0, chair: 0, rendu: 0, n: 0 }, t0: performance.now(), el: null, last: null };
function perfTick() {
  const now = performance.now(), el = now - PERF.t0; if (el < 1000) return;
  const c = PERF.cur, n = Math.max(1, c.n), r = (x) => (x / n).toFixed(1);
  PERF.last = { fps: +(c.n * 1000 / el).toFixed(1), image_ms: +(c.tot / n).toFixed(2), surface_ms: +(c.surf / n).toFixed(2), surface_par_image: +(c.nsurf / n).toFixed(1), mains_ms: +(c.mains / n).toFixed(2), toucher_ms: +(c.toucher / n).toFixed(2), chair_ms: +(c.chair / n).toFixed(2), rendu_ms: +(c.rendu / n).toFixed(2) };
  if (PERF.on) { if (!PERF.el) { PERF.el = document.createElement('div'); PERF.el.id = 'perf'; PERF.el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.35 ui-monospace,monospace;padding:5px 7px;border-radius:6px;pointer-events:none;white-space:pre'; document.body.appendChild(PERF.el); }
    const L = PERF.last; PERF.el.textContent = L.fps + ' i/s   image ' + L.image_ms + ' ms\nsurface ' + L.surface_ms + ' (' + L.surface_par_image + '×)  mains ' + L.mains_ms + '\ntoucher ' + L.toucher_ms + '  chair ' + L.chair_ms + '  rendu ' + L.rendu_ms; }
  else if (PERF.el) { PERF.el.remove(); PERF.el = null; }
  for (const k in c) c[k] = 0; PERF.t0 = now;
}
function animateFrame() {
  const _pf0 = performance.now();
  const dt = window.__dt || Math.min(clock.getDelta(), 0.05); _simDt = dt; SURF.dirty = true; TOUCHW.l = TOUCHW.r = 0; SUPPORT.l = SUPPORT.r = 0;   // __dt : pas fixe pour les tests (simule 60 i/s sur une machine lente)
  tNow += dt;
  if (vrm) {
    const b = bones;
    // respiration : rythme calme au repos, plus vif si surprise/joie, plus lent et profond si tristesse ; soupirs occasionnels
    const ewr = emotion ? Math.min(1, emotionW * 1.8) : 0;
    const brTarget = 0.25 + (emotion === 'surprised' ? 0.14 : 0) * ewr + (emotion === 'happy' ? 0.05 : 0) * ewr - (emotion === 'sad' ? 0.07 : 0) * ewr;
    brRateCur += (brTarget - brRateCur) * Math.min(1, dt * 0.6);
    brPh += dt * brRateCur;
    sighT -= dt;
    if (sighT <= 0 && sighW < 0.01) { sighT = (emotion === 'sad' ? 9 : 16) + Math.random() * 12; sighW = 0.001; }
    if (sighW > 0) { sighW = Math.min(1.2, sighW + dt * 1.6); if (sighW >= 1.2) sighW = 0; }   // courte bouffée plus profonde puis retour
    const sighD = Math.sin(Math.min(1, sighW) * Math.PI) * (emotion === 'sad' ? 0.8 : 0.5);
    const lung = breathLvl(brPh) + sighD * 0.5;                         // niveau des poumons, soupir compris
    const breath = (lung - 0.5) * 2;                                    // -1..1, compatible avec l'existant
    const breathCh = (breathLvl(brPh - 0.05) - 0.5) * 2 + sighD;        // la poitrine suit le ventre (léger retard), amplifiée au soupir
    const breathSh = (breathLvl(brPh - 0.11) - 0.5) * 2;               // les épaules montent un peu plus tard encore
    // dérive posturale : le corps n'est jamais parfaitement immobile (bruit lent < 0.5 Hz, quelques mm au buste)
    swyX += (fbm(tNow * 0.11, 3.2) - swyX) * Math.min(1, dt * 1.2);
    swyZ += (fbm(tNow * 0.13, 7.8) - swyZ) * Math.min(1, dt * 1.2);
    // changement d'appui spontané de temps en temps (elle se recale sur l'autre jambe)
    settleT -= dt;
    if (settleT <= 0) { settleT = 7 + Math.random() * 9; if (!gst && !mouthOn && !thinking && poseCur.sit < 0.3 && poseCur.lie < 0.3 && Math.random() < 0.5) shiftDir = -shiftDir; }
    // geste en cours (enveloppe douce d'entrée et de sortie) et posture liée à l'émotion
    let ge = 0, gn = '', gt = 0;
    if (gst) {
      gst.t += dt * (gst.tscale == null ? 1 : gst.tscale) * (gst.win ? (window.__lessonFast || 1) : 1); gst.age = (gst.age || 0) + dt;
      if (gst.win && gst.t >= gst.win[1]) { if (--gst.winRep > 0) gst.t = gst.win[0]; else { gst.t = gst.win[1] - 1e-3; gst.done = true; } }   // leçon : partie rejouée
      if (gst.t >= gst.dur) gst = null;
      else { const e = Math.min(1, (gst.win ? gst.age : gst.t) / (gst.lib ? 0.55 : gst.clip ? 0.5 : 0.35), (gst.dur - gst.t) / (gst.lib ? 0.6 : gst.clip ? 0.6 : 0.45)); ge = e * e * (3 - 2 * e); gn = gst.lib ? (gst.lib.body || '') : gst.name; gt = gst.t; }
    }
    const lib = gst && gst.lib ? gst.lib : null, lw = lib ? ge : 0;
    const lH = lib && lib.head ? lib.head : null, lS = lib && lib.spine ? lib.spine : null;
    if (lib && lib.face) { if (libFace !== lib.face[0] && libFace) setExpr(libFace, 0); libFace = lib.face[0]; setExpr(libFace, lib.face[1] * lw); }
    else if (libFace) { setExpr(libFace, 0); libFace = null; }
    if (lib && lib.faceSeq) {                          // visage IMAGE PAR IMAGE (langue, croquer, mâcher…) : [[temps, {expression: poids}], …], fondu entre deux étapes
      const sq = lib.faceSeq; let i = 0; while (i + 1 < sq.length && sq[i + 1][0] <= gt) i++;
      const A = sq[i], B = sq[i + 1], T = {};
      let f = B ? (gt - A[0]) / Math.max(1e-3, B[0] - A[0]) : 0; f = Math.max(0, Math.min(1, f)); f = f * f * (3 - 2 * f);
      for (const k in A[1]) T[k] = A[1][k] * (1 - f);
      if (B) for (const k in B[1]) T[k] = (T[k] || 0) + B[1][k] * f;
      for (const k in libFaceSet) if (!(k in T)) { setExpr(k, 0); delete libFaceSet[k]; }
      for (const k in T) { libFaceSet[k] = 1; setExpr(k, T[k] * lw); }
    } else { for (const k in libFaceSet) { setExpr(k, 0); delete libFaceSet[k]; } }
    const up = 1 - poseCur.lie;                       // allongée : pas de gestes du buste ni des bras
    const ew = emotion ? Math.min(1, emotionW * 1.8) : 0;
    const eSad = emotion === 'sad' ? ew : 0, eSur = emotion === 'surprised' ? ew : 0, eHap = emotion === 'happy' ? ew : 0, eAng = emotion === 'angry' ? ew : 0;
    // gestes enchaînés demandés par le cerveau
    if (!gst && gQueue.length && !window.__nogest) playGesture(gQueue.shift());
    // ses mains parlent avec elle : un geste d'accompagnement toutes les 2 à 4 s tant qu'elle parle
    talkNext -= dt;
    if (mouthOn && !gst && !thinking && !document.hidden && poseCur.lie < 0.5 && !window.__nogest) {
      if (talkNext <= 0) {
        talkNext = 1.6 + Math.random() * 2.4 - (emotion === 'happy' ? 0.5 : 0) + (emotion === 'sad' ? 1.2 : 0);
        let g; do { g = TALKG[Math.floor(Math.random() * TALKG.length)]; } while (g === lastTalkG && TALKG.length > 1);
        lastTalkG = g; playGesture(g);
      }
    } else if (!mouthOn && talkNext > 0.8) talkNext = 0.8;
    // elle bouge d'elle-même quand rien ne se passe (petits gestes réguliers, comme quelqu'un qui attend)
    if (LESSON.on) idleNext = Math.max(idleNext, 3);
    idleNext -= dt;
    if (idleNext <= 0) { idleNext = 3 + Math.random() * 5; if (!gst && !mouthOn && !thinking && !document.hidden && !window.__nogest) { playGesture(idlePick()); } }
    const shy = up * (gn === 'shy' ? ge : 0), flt = up * (gn === 'flirt' ? ge : 0), hr = up * (1 - poseCur.sit * 0.3) * (gn === 'hair' ? ge : 0);
    const gSpX = up * ((gn === 'lean' ? 0.15 * ge : 0) + 0.05 * shy - 0.03 * flt + (lS ? lS[0] * lw : 0) + (gn === 'laugh' ? ge * (-0.05 + 0.03 * Math.sin(gt * 15)) : 0) + 0.05 * eSad - 0.045 * eSur + 0.02 * eAng);
    const swayT = gn === 'sway' ? Math.sin(gt * 2.3) : 0;              // « sway » : elle balance les hanches, en rythme
    sideCur += ((gn === 'sway' ? shiftDir * (1 - ge) + swayT * ge : shiftDir) - sideCur) * Math.min(1, dt * (gn === 'sway' ? 5 : 1.6));   // déhanché : le poids passe doucement d'une jambe à l'autre
    if (lib && lib.wear && gst) for (const [tw2, list] of lib.wear) if (gt >= tw2 && !gst['_w' + tw2]) { gst['_w' + tw2] = 1; wrWear(list); }   // effeuillage : chaque pièce tombe à son moment
    if (lib && lib.legs === undefined) lib.legs = !!(lib.ground || lib.root || (lib.fk && /UpLeg|LowLeg|Foot|hips/.test(JSON.stringify(lib.fk))));   // geste qui pilote jambes ou bassin
    const legG = lib && lib.legs ? lw : 0;                                 // pendant ce geste, la posture debout (déhanché, poids, ondulation) s'efface
    const nat = vrm.isGlb ? up * (1 - poseCur.sit) * (1 - legG) : 0;
    const gSpZ = -0.10 * nat * sideCur;
    if (b.neck) b.neck.rotation.set(0, 0, 0);
    if (b.uChest) b.uChest.rotation.set(0, 0, 0);   // haut du dos : quatrième segment de la colonne, utilisé par les danses pour une vraie ondulation   // le cou repart de zéro à chaque image (sinon les gestes s'accumulent)
    if (b.spine) { b.spine.rotation.x = 0.024 * breath + gSpX; b.spine.rotation.z = 0.016 * swyX + gSpZ + (lS ? lS[1] * lw : 0); }
    for (const x of [b.lArm, b.rArm, b.lLowArm, b.rLowArm, b.lHand, b.rHand]) if (x) x.rotation.set(0, 0, 0);   // repart de zéro (la cinématique inverse a pu tout changer)
    // avant-bras : légèrement pliés au repos, ils se lèvent et bougent quand elle parle
    gest += ((mouthOn ? 1 : 0) - gest) * Math.min(1, dt * 3);
    const fd = -body.legDir;
    beat = Math.max(0, beat - dt * 2.8);
    if (mouthOn && lip.on && lip.seq) {                 // accent sur la dernière voyelle avant une pause : petit mouvement de main
      const pos = (performance.now() - lip.t0) / 1000 * lip.rate;
      let k = beatIdx; while (k < lip.seq.length && lip.starts[k] <= pos) k++;
      for (let i = beatIdx; i < k; i++) { const nx = lip.seq[i + 1]; if (LIP_VOWEL.has(lip.seq[i][0]) && (!nx || nx[0] === 'sil' || (lip.seq[i + 2] && lip.seq[i + 2][0] === 'sil'))) { beat = 1; beatHand = -beatHand; } }
      beatIdx = k;
    } else beatIdx = 0;
    const bt = Math.sin(Math.min(1, 1 - beat) * Math.PI) * 0.22;
    if (!lib || !lib.face || lib.face[0] !== 'browUp') setExpr('browUp', bt * 1.1);       // sourcils qui se lèvent sur les mots appuyés
    const talk = gest * (0.34 + 0.12 * Math.sin(tNow * 2.3)) + bt * (beatHand > 0 ? 1 : 0.35);
    const rest = vrm.isGlb ? 0.3 : 0.12;
    if (b.lLowArm) b.lLowArm.rotation.y = -fd * (rest + talk);
    if (b.rLowArm) b.rLowArm.rotation.y = fd * (rest * 0.8 + talk * 0.6 + gest * 0.08 * Math.sin(tNow * 3.1 + 1) + bt * (beatHand < 0 ? 0.9 : 0.2));
    if (b.fingers) for (let i = 0; i < b.fingers.length; i++) { const n = b.fingers[i][0]; n.rotation.z = b.fingers[i][1] * (1 - 0.45 * gest); n.rotation.x = 0; n.rotation.y = 0; }   // main détendue : rien ne reste d'un geste précédent
    if (b.hand) for (const k of ['r', 'l']) for (const n of b.hand[k].Thumb || []) n.rotation.set(0, 0, 0);
    const handAt = (h) => (Array.isArray(h) ? (h.filter((k) => k[0] <= gt).pop() || h[0])[1] : h);
    if (lib && b.hand) { if (lib.rHand) applyHand(b.hand.r, handAt(lib.rHand), lw, 1); if (lib.lHand) applyHand(b.hand.l, handAt(lib.lHand), lw, -1); }
    if (b.chest) { b.chest.rotation.x = 0.028 * breathCh; b.chest.rotation.y = 0.01 * swyZ; }   // poitrine : respiration visible + léger jeu
    if (b.hips) { b.hips.rotation.y = 0.016 * swyZ; b.hips.rotation.x = -(0.07 + 0.05 * heelCur) * nat * body.legDir + 0.006 * breath; b.hips.rotation.z = 0.115 * nat * sideCur; b.hips.position.x = 0.036 * nat * sideCur + 0.006 * swyX; if (body.hipsZ0 === undefined) body.hipsZ0 = b.hips.position.z; b.hips.position.z = body.hipsZ0; }   // z remis à sa place chaque image (le déplacement du mocap s'y ajoute ensuite)   // contrapposto féminin : bassin bien basculé sur la jambe d'appui
    const wv1 = Math.sin(tNow * 0.55), wv2 = Math.sin(tNow * 0.37 + 1.3), wv3 = Math.sin(tNow * 0.81 + 0.4);
    if (b.hips) { b.hips.rotation.y += 0.05 * nat * wv1; b.hips.rotation.z += 0.03 * nat * wv2; b.hips.rotation.x += 0.025 * nat * wv3; b.hips.position.x += 0.012 * nat * wv2; }   // ondulation lente du bassin (en 8), libre et sensuelle
    if (b.chest) { b.chest.rotation.z = -0.07 * nat * sideCur - 0.022 * nat * wv2; b.chest.rotation.y -= 0.03 * nat * wv1; }   // le buste répond en douceur               // le buste compense en sens inverse : épaules légèrement opposées au bassin (ligne en S)
    const shr = up * ((gn === 'shrug' ? 0.24 * ge : 0) - 0.06 * eSad + 0.05 * eSur) + 0.13 * shy + 0.05 * flt * Math.max(0, Math.sin(gt * 1.8));
    const shRel = -0.035 * nat;                                            // épaules relâchées, basses (pas carrées)
    const shBk = (window.__shBack !== undefined ? window.__shBack : 0.16) * (1 - 0.7 * poseCur.lie);   // épaules légèrement tirées en arrière (posture féminine ouverte)
    if (b.lSh) b.lSh.rotation.z = shr - 0.01 * breathSh - shRel;   // les épaules se soulèvent un peu à l'inspiration
    if (b.rSh) b.rSh.rotation.z = -shr + 0.01 * breathSh + shRel;
    if (b.lSh) b.lSh.rotation.y = shBk; if (b.rSh) b.rSh.rotation.y = -shBk;
    // posture porteuse (accroupie, squat…) : apparition/disparition douce ; seulement debout, jamais assise/allongée
    if (postureT > 0) { postureT -= dt; if (postureT <= 0) freePose = null; }   // tenue limitée dans le temps puis retour debout
    freeW += (((freePose && poseCur.sit < 0.2 && poseCur.lie < 0.2) ? 1 : 0) - freeW) * Math.min(1, dt * 3.2);
    // pose : transition douce vers la pose demandée
    const P = POSES[currentPose], pk = Math.min(1, dt * 3.5);
    poseCur.turn += (P.turn - poseCur.turn) * pk;
    poseCur.sit += (P.sit - poseCur.sit) * pk;
    poseCur.lie += (P.lie - poseCur.lie) * pk;
    rig.rotation.set(-Math.PI / 2 * poseCur.lie, poseCur.turn + Math.PI / 2 * poseCur.lie, 0);
    const heel = (wr.on && /^pieds_talons/.test(wr.on.pieds || '') ? 1 : 0) * (1 - poseCur.lie);
    heelCur += (heel - heelCur) * Math.min(1, dt * 6);
    rig.position.set(body.height / 2 * poseCur.lie + WORLD.x, (BED_H + 0.1) * poseCur.lie + HEEL_LIFT * heelCur * (1 - poseCur.sit), WORLD.z);
    for (const f of [b.lFoot, b.rFoot]) if (f) f.rotation.set(HEEL_FOOT * heelCur, 0, 0);   // TOUS les axes repartent de zéro à chaque image (avant : seul x l'était — une rotation y/z de geste s'ACCUMULAIT sans fin, vu : cuisse à 37 rad, bassin qui saute de 0,2 à 0,76 m)
    for (const f of [b.lToes, b.rToes]) if (f) f.rotation.set(-HEEL_FOOT * 0.9 * heelCur, 0, 0);
    for (const l of [b.lUpLeg, b.rUpLeg, b.lLowLeg, b.rLowLeg]) if (l) l.rotation.y = 0;
    for (const l of [b.lLowLeg, b.rLowLeg]) if (l) l.rotation.z = 0;
    const legQ = poseCur.sit * Math.PI / 2 * body.legDir;
    const swK = 1 - freeW;    // posture porteuse : on neutralise le balancement du poids pour que les deux jambes soient symétriques
    const kL = 0.19 * nat * Math.max(0, sideCur) * body.legDir * swK, kR = 0.19 * nat * Math.max(0, -sideCur) * body.legDir * swK;   // genou libre plié, détendu
    const legZ = -0.115 * nat * sideCur * swK;                             // annule la bascule du bassin : jambes d'aplomb
    if (b.lUpLeg) { b.lUpLeg.rotation.x = legQ + kL; b.lUpLeg.rotation.z = legZ + 0.03 * nat * Math.max(0, sideCur) * swK; }
    if (b.rUpLeg) { b.rUpLeg.rotation.x = legQ + kR; b.rUpLeg.rotation.z = legZ - 0.03 * nat * Math.max(0, -sideCur) * swK; }   // genou libre légèrement rentré
    if (b.lLowLeg) b.lLowLeg.rotation.x = -legQ - kL * 1.9;
    if (b.rLowLeg) b.rLowLeg.rotation.x = -legQ - kR * 1.9;
    const fpd = freePose && freeW > 0.002 ? freePose : null;    // posture porteuse active (accroupie, squat, à genoux…)
    if (b.hips) b.hips.position.y = body.hipsY - body.upper * poseCur.sit;
    if (fpd) {
      // le corps descend et les jambes plient par angles calibrés — les pieds (ou les genoux) restent au sol
      for (const [ul, ll, ft] of [[b.lUpLeg, b.lLowLeg, b.lFoot], [b.rUpLeg, b.rLowLeg, b.rFoot]]) {
        if (ul) ul.rotation.x += fpd.upLeg * freeW;
        if (ll) ll.rotation.x += fpd.lowLeg * freeW;
        if (ft) ft.rotation.x += (fpd.foot || 0) * freeW;
      }
      if (b.spine) b.spine.rotation.x += (fpd.spine || 0) * freeW;
    }
    stool.visible = poseCur.sit > 0.6;
    bedMesh.visible = poseCur.lie > 0.5;
    camDrop += (Math.min(0, lastRigY) * 0.95 - camDrop) * Math.min(1, dt * 3);   // suit Aiko quand elle descend (sol, grand écart, à genoux)
    target.y = 1.18 * (body.k || 1) - body.upper * 0.55 * poseCur.sit - 0.62 * poseCur.lie + camDrop;
    if (poseCur.sit > 0.001 && poseCur.sit < 0.999) applyShape();
    const arm = vrm.isGlb ? 1.30 : ARM;      // corps réaliste : bras légèrement écartés, on voit le creux de la taille
    if (b.lArm) { b.lArm.rotation.z = -arm + 0.012 * breath - shr; b.lArm.rotation.x = vrm.isGlb ? 0.07 * fd : 0; }      // les épaules montent, les bras restent le long du corps
    if (b.rArm) b.rArm.rotation.z = arm - 0.012 * breath + shr;
    const hp = up * (1 - poseCur.sit) * (gn === 'hip' ? ge : 0);     // main gauche posée sur la hanche
    if (b.lArm) { b.lArm.rotation.z += 0.42 * hp; b.lArm.rotation.x += 0.25 * hp * fd; }
    if (b.lLowArm) b.lLowArm.rotation.y -= fd * 1.55 * hp;
    const wv = up * (gn === 'wave' ? ge : 0), th = up * (gn === 'think' ? ge : 0), sg = up * (gn === 'shrug' ? ge : 0);
    if (b.rArm) { b.rArm.rotation.z += -(arm + 0.55) * wv - 0.12 * th; b.rArm.rotation.x = -0.5 * th * fd; b.rArm.rotation.y = 0.9 * th * fd; }
    if (b.rLowArm) { b.rLowArm.rotation.y = b.rLowArm.rotation.y * (1 - wv) + fd * (2.05 * th + 0.45 * sg); b.rLowArm.rotation.z = wv * (-1.2 + 0.38 * Math.sin(gt * 9)); }
    if (b.lLowArm) b.lLowArm.rotation.y -= fd * 0.45 * sg;
    if (hr) {
      const sw = 0.12 * Math.sin(gt * 5) * Math.min(1, Math.max(0, gt - 0.6));      // petit glissement de la main dans les cheveux
      if (b.rArm) { b.rArm.rotation.z -= (window.__hz ?? 1.05) * hr; b.rArm.rotation.y += fd * (window.__hy ?? 0.55) * hr; b.rArm.rotation.x += fd * (window.__hx ?? -0.2) * hr; }
      if (b.rLowArm) { b.rLowArm.rotation.y += fd * ((window.__ly ?? 0.4) + sw) * hr; b.rLowArm.rotation.z += (window.__lz ?? -2.0) * hr; }
    }
    // timide : mains jointes devant elle ; charmeuse : une main glisse sur la hanche
    if (shy) {
      if (b.lArm) { b.lArm.rotation.x += 0.28 * shy * fd; b.lArm.rotation.z += 0.1 * shy; }
      if (b.rArm) { b.rArm.rotation.x = (b.rArm.rotation.x || 0) + 0.28 * shy * fd; b.rArm.rotation.z -= 0.1 * shy; }
      if (b.lLowArm) b.lLowArm.rotation.y -= fd * 0.75 * shy;
      if (b.rLowArm) b.rLowArm.rotation.y += fd * 0.75 * shy;
    }
    // tête : suit le pointeur + signe de tête quand elle répond
    nod = Math.max(0, nod - dt * 0.9);
    if (b.head) {
      // de côté ou allongée, la tête se tourne vers toi
      const yaw = (mouse.x * 0.35) * (1 - poseCur.lie) - poseCur.turn * 0.6 - 0.95 * poseCur.lie + Math.sin(tNow * 0.6) * 0.035;
      const gYaw = gn === 'shake' ? 0.3 * ge * Math.sin(gt * 9.5) : (gn === 'think' ? -0.14 * ge : (gn === 'shy' ? 0.22 * ge * shiftDir : (gn === 'hair' ? -0.12 * ge : 0))) + (lH ? lH[1] * lw * shiftDir : 0);
      const gPit = (gn === 'nod' ? 0.2 * ge * Math.sin(gt * 10) : 0) + (gn === 'laugh' ? -0.12 * ge : 0) + (gn === 'think' ? -0.07 * ge : 0)
        + (gn === 'lean' ? -0.08 * ge : 0) + (lH ? lH[0] * lw : 0) + 0.16 * shy + 0.07 * flt + (gn === 'hair' ? -0.05 * ge : 0) + 0.13 * eSad - 0.06 * eSur - 0.03 * eHap + 0.05 * eAng;
      const pitch = -mouse.y * 0.16 + Math.sin(tNow * 1.2) * 0.012 + Math.sin(nod * Math.PI) * 0.28 + gPit;
      const k = Math.min(1, dt * 6);
      b.head.rotation.y += (yaw + gYaw - b.head.rotation.y) * k;
      b.head.rotation.x += (pitch - b.head.rotation.x) * k;
      const roll = 0.045 * fbm(tNow * 0.14, 1.3)             // légère inclinaison vivante, organique
        + 0.03 * nat * sideCur + (gn === 'tilt' ? 0.17 * ge * shiftDir : 0) + (gn === 'think' ? 0.1 * ge : 0) + (gn === 'shrug' ? 0.07 * ge : 0) + 0.05 * eHap + 0.16 * flt * shiftDir + 0.1 * shy * shiftDir + (gn === 'hair' ? -0.12 * ge : 0) + (lH ? lH[2] * lw : 0);
      b.head.rotation.z += (roll - b.head.rotation.z) * k;
    }
    // clignement
    // vie du visage : brèves bouffées de muscles faciaux au repos + micro-dérive continue des sourcils (jamais figés)
    if (!mouthOn) microT -= dt;
    if (microT <= 0 && !microName) { const m = MICRO[Math.floor(Math.random() * MICRO.length)]; microName = m[0]; microPk = m[1]; microDur = m[2]; microAge = 0; microT = 2.5 + Math.random() * 5.5; }
    if (microName) {
      microAge += dt;
      const p = microAge / microDur, sup = Math.max(ew, mouthOn ? 0.6 : 0);     // s'efface si une vraie émotion ou la parole prend le dessus
      microW = p < 1 ? microPk * Math.pow(Math.sin(p * Math.PI), 0.8) : 0;
      setExpr(microName, microW * (1 - sup));
      if (p >= 1) { setExpr(microName, 0); microName = ''; microW = 0; }
    }
    setExpr('browIdle', 0.06 * Math.max(0, fbm(tNow * 0.26, 9.1)) * (1 - ew));   // sourcils jamais parfaitement immobiles
    // clignement : fermeture rapide (~90 ms), réouverture plus lente (~170 ms) ; parfois double ; plus fréquent en parlant, plus rare en se concentrant
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) {
      blinkT = 0;
      nextBlink = (1.8 + Math.random() * 2.8) * (mouthOn ? 0.6 : 1) * (thinking ? 1.6 : 1);
      dblink = Math.random() < 0.12; window.__blinks = (window.__blinks || 0) + 1;
    }
    if (blinkT >= 0) {
      blinkT += dt;
      const CL = 0.09, OP = 0.17;
      let bv = blinkT < CL ? blinkT / CL : (blinkT < CL + OP ? 1 - (blinkT - CL) / OP : 0);
      setExpr('blink', Math.max(0, bv));
      if (blinkT >= CL + OP) { if (dblink) { dblink = false; blinkT = 0.0001; } else blinkT = -1; }
    }
    // bouche : active uniquement pendant la parole
    if (mouthOn || mouthWas) {
      // bouche : chaque son a sa forme (visèmes), lissée d'un son à l'autre ; le volume réel module l'ouverture si on l'a
      let gate = 1;
      if (mouthOn && lipEnv && lipEnv.url === playerURL && !player.paused) {
        const lv = lipEnv.data[Math.floor(player.currentTime / lipEnv.step)] || 0;
        mouthV += (lv - mouthV) * Math.min(1, dt * 22);
        gate = Math.min(1, 0.35 + mouthV * 1.6);
      }
      const T = mouthOn ? lipTargets(tNow) : {};
      const k = Math.min(1, dt * 24);
      let any = 0;
      // p, b, m : les lèvres doivent se FERMER vraiment (la fermeture peut ne durer que quelques millisecondes ; un lissage ordinaire l'empêche
      // d'aboutir — vu : la forme « PP » plafonnait à 0,6-0,8 pendant que « aa » restait à 0,3). Donc : la fermeture domine les autres formes,
      // elle s'établit en une image, et le volume ne l'atténue pas (pendant l'occlusion d'un p ou d'un b la voix est justement silencieuse).
      const clo = T.PP || 0;
      for (const v of LIP_V) {
        const lab = v === 'PP';
        const tg = (T[v] || 0) * (lab ? 1 : gate) * (clo > 0.3 && !lab ? Math.max(0, 1 - clo * 1.6) : 1);
        const kk = (lab && tg > lip.cur[v]) || (clo > 0.3 && !lab && tg < lip.cur[v]) ? Math.min(1, dt * 60) : k;
        lip.cur[v] += (tg - lip.cur[v]) * kk; any += lip.cur[v]; }
      setVisemes();
      { const c = lip.cur, vow = c.aa + 0.6 * c.E + 0.5 * c.O + 0.3 * c.I + 0.3 * c.U;          // JALI : la mâchoire suit le VOLUME réel sur les voyelles (voix forte = bouche plus ouverte), les lèvres gardent leurs formes
        setExpr('jali', mouthOn && lipEnv && lipEnv.url === playerURL ? Math.min(0.3, vow * mouthV * 0.3) : 0); }
      mouthWas = mouthOn || any > 0.01;
      if (!mouthWas) { for (const v of LIP_V) lip.cur[v] = 0; setVisemes(); setExpr('jali', 0); mouthV = 0; }
    }
    // émotion qui s'estompe
    if (emotion) {
      emotionW -= dt * (emotionW > 0.3 ? 0.22 : 0.006);     // pic, puis humeur de fond qui s'efface en ~45 s
      emoT += dt;
      if (emotionW <= 0) { setExpr(emotion, 0); emotion = null; }
      else setExpr(emotion, emoShown() * (1 + 0.045 * Math.sin(tNow * 2.7) + 0.025 * Math.sin(tNow * 6.1 + 1)));   // le sommet n'est jamais figé (irrégularité des expressions sincères)
    }
    if (emoPrev) { emoPrevW -= dt / 0.55; if (emoPrevW <= 0 || emoPrev === emotion) { if (emoPrev !== emotion) setExpr(emoPrev, 0); emoPrev = null; } else setExpr(emoPrev, emoPrevW * emoPrevW); }   // fin d'expression en ~0,5 s
    // regard : vers la caméra, décalé par le pointeur (repère local de la caméra)
    gazeNext -= dt;
    if (gazeNext <= 0 && !mouthOn) {
      gazeT = 0.8 + Math.random() * 0.9;
      gazeX = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
      gazeY = -0.15 + Math.random() * 0.3;
      gazeNext = 6 + Math.random() * 9;
      if (blinkT < 0 && Math.random() < 0.35) blinkT = 0;   // un clignement accompagne souvent un grand changement de regard
    }
    if (gazeT > 0) gazeT -= dt;
    const gk = Math.min(1, dt * 8);
    const thinkGaze = thinking && !mouthOn;                       // elle réfléchit : le regard part en haut, sur le côté
    gazeCX += ((thinkGaze ? 0.42 * shiftDir : gazeT > 0 ? gazeX : 0) - gazeCX) * gk;
    gazeCY += ((thinkGaze ? 0.22 : gazeT > 0 ? gazeY : 0) - gazeCY) * gk;
    // saccades : le regard saute d'un point à l'autre, il ne glisse pas
    sacT -= dt;
    if (sacT <= 0) { sacT = 0.6 + Math.random() * 2.2; sacX = (Math.random() - 0.5) * 0.09; sacY = (Math.random() - 0.5) * 0.05; }
    lookAtTarget.position.set(mouse.x * 0.5 + gazeCX + sacX, mouse.y * 0.35 + gazeCY + sacY, 0);
    { const _p = performance.now(); try { touchLiveUpdate(dt, b); } catch (e) { if (window.__tlErr) console.warn('toucher', e); } PERF.cur.toucher += performance.now() - _p; }   // réactions du corps AVANT les gestes : les mains se posent ensuite sur ce corps-là (sinon le bras bougeait sous la main posée)
    if (lib && lw > 0) { applyFk(lib, gt, lw * (1 - poseCur.lie), b); if (lib.ground || (lib.legs && !AIRBORNE.test(gst.name))) groundBody(b, lw * (1 - poseCur.lie), false, !!lib.touch, !!lib.legPlace); applyLib(lib, gt, lw * (1 - poseCur.lie), b); }
    if (gst && gst.clip) { const cw = ge * (1 - poseCur.lie) * (1 - poseCur.sit); applyClip(gst, cw, b);
      if (clipAir(gst) === null) { if (!AIRBORNE.test(gst.name + ' ' + (gst.en || ''))) groundBody(b, cw); }   // ancien mouvement : posé au sol à chaque image (sauf vrais sauts)
      else if (cw < 0.999) groundBody(b, 1);                               // début et fin (raccord avec la pose de repos) : posée au sol d'après la pose réellement affichée
      else { rig.position.y += clipGy(gst); clipPelvis(gst, 1, b); rig.updateMatrixWorld(true); } }   // mouvement préparé : hauteur calculée d'avance (appuis au sol, vrais temps de vol), garde-fou, bassin ajusté
    { // au repos aussi, le pied d'appui touche le sol : le déhanché de repos enfonçait la jambe d'appui de près de 3 cm dans le sol
      const st = (1 - poseCur.sit) * (1 - poseCur.lie) * (1 - freeW), handled = (gst && gst.clip) || (lib && lw > 0 && (lib.ground || lib.legs));
      if (st > 0.02 && !handled && !window.__noIdleGround) groundBody(b, st); }
    if (gst !== XF.last) { if (XF.last && gst && poseCur.lie < 0.3) xfadeStart(); XF.last = gst; if (!gst || !gst.clip) footLockReset(); }   // changement de geste : fondu depuis la pose réelle
    xfadeApply(b, dt);
    if (gst && gst.clip && gst.clip.fo) { if (poseCur.lie < 0.3 && poseCur.sit < 0.3) clipFeet(gst, ge, b); footLockReset(); }   // mouvement préparé : appuis connus d'avance
    else if (gst && gst.clip && !AIRBORNE.test(gst.name + ' ' + (gst.en || '')) && poseCur.lie < 0.3 && poseCur.sit < 0.3) footLock(b, dt, ge); else footLockReset();
    // la caméra suit doucement le corps quand il se déplace (mouvement de la bibliothèque), puis revient au centre
    { // mouvement terminé, elle est au repos : la pièce se recentre sur elle d'un seul coup (invisible : caméra, sol et lumière la suivent déjà)
      if (!gst && (WORLD.x || WORLD.z)) { camFollow.x -= WORLD.x; camFollow.z -= WORLD.z; rig.position.x -= WORLD.x; rig.position.z -= WORLD.z; WORLD.x = WORLD.z = 0; footLockReset(); for (const j of jig) j.prev = null; rig.updateMatrixWorld(true); }
      let fx = WORLD.x, fz = WORLD.z;
      if (gst && gst.clip && gst.clip.dx && b.hips) { b.hips.getWorldPosition(_fv); fx = _fv.x; fz = _fv.z; }
      const k = Math.min(1, dt * 2.5); camFollow.x += (fx - camFollow.x) * k; camFollow.z += (fz - camFollow.z) * k;
      target.x = camFollow.x; target.z = camFollow.z;
      ground.position.x = WORLD.x; ground.position.z = WORLD.z;                      // le sol (ombre) et le soleil accompagnent son déplacement
      sun.position.set(1.6 + WORLD.x, 3.2, 2.6 + WORLD.z); sun.target.position.set(WORLD.x, 0, WORLD.z); sun.target.updateMatrixWorld(); }
    try { propUpdate(lib && lw > 0 ? lib : null, gt, b); } catch (e) { console.warn('objet', e); }
    if (!window.__noKeepOut && poseCur.lie < 0.5) { try { armKeepOut(b); } catch (e) {} }
    if (SKIN.ok && !window.__noContact) {                // mains et avant-bras : posés sur la peau, jamais dedans
      rig.updateMatrixWorld(true); skinUpdate();
      if (TOUCHW.l < 0.5) handContact(b.lArm, b.lLowArm, b.lHand); if (TOUCHW.r < 0.5) handContact(b.rArm, b.rLowArm, b.rHand);
    }
    // plantage au sol : après la flexion, on abaisse tout le corps pour que le point le plus bas (pied ou genou) touche le sol
    if (fpd && body.anchL) {
      rig.updateMatrixWorld(true);
      let minY = Infinity;
      const contact = fpd.knees ? [b.lLowLeg, b.rLowLeg, b.lToes, b.rToes] : [b.lFoot, b.rFoot, b.lToes, b.rToes];   // à genoux : les tibias touchent le sol ; sinon les pieds
      for (const f of contact) if (f) minY = Math.min(minY, f.getWorldPosition(_fv).y);
      if (isFinite(minY)) rig.position.y += (body.anchL.y - minY) * freeW;
    }
    lastRigY = rig.position.y - (body.height / 2 * 0) - (BED_H + 0.1) * poseCur.lie;
    try { romApply(dt); } catch (_) {}
    try { xfadeCapture(b); } catch (_) {}
    if (bones.hips) { bones.hips.getWorldPosition(_jw); SQ.uHip.value.set(_jw.x, _jw.z); SQ.uSquash.value = window.__nosquash ? 0 : 1; }
    try { correctivesUpdate(); } catch (_) {}
    { const _p = performance.now(); vrm.update(dt); jigUpdate(dt); buttBounce(); PERF.cur.chair += performance.now() - _p; }
    const _pm = performance.now();
    for (const hk of ['l', 'r']) { const q = SURFREQ[hk];                     // mains posées sur le corps : APRÈS la physique des chairs, sur la peau telle qu'elle est vraiment à cette image
      (window.__srw = window.__srw || {})[hk] = q ? q.w : 0;
      if (q && q.w > 0.02) { SURF.dirty = true; (window.__lastTg = window.__lastTg || {})[hk] = q.tg; handOnSurface(b, hk, q.up, q.lo, q.hand, q.w, q.pole, q.tip, q.tg, q.key, q.pref, q.ref, q.glide, q.fdir); if (!q.tip && q.w > 0.25) fingersToSurface(b, hk, q.w, dt); _srDone = true; }
      else if (SLOCK[hk] || HGOAL[hk]) { SLOCK[hk] = null; HGOAL[hk] = null; }
      SURFREQ[hk] = null; }
    try { if (propGrasp(b, dt)) _srDone = true; } catch (e) { if (window.__tlErr) console.warn('prise', e); }   // objet tenu : doigts refermés sur sa vraie surface
    try { eatTrack(b, dt, lib, gt, lw); } catch (e) { if (window.__tlErr) console.warn('manger', e); }   // aliment : amené au contact exact des lèvres ou de la langue
    if (lib && lw > 0.3 && lib.legFollow && gt > lib.legFollow.a + 0.3 && !window.__noGrasp) { const hk2 = lib.legFollow.hk; try { fingersToSurface(b, hk2, 1, dt, (p) => surfClosest(p, hk2 === 'l' ? 1 : 2, null, 0.12)); _srDone = true; } catch (_) {} }   // jambe portée : les doigts S'ENROULENT autour de la cheville (prise fermée, pouce en face)
    PERF.cur.mains += performance.now() - _pm;
    if (_srDone) { _srDone = false; try { vrm.humanoid.update(); if (vrm.nodeConstraintManager) vrm.nodeConstraintManager.update(); } catch (_) {} }   // CRUCIAL : vrm.update() a déjà copié le rig normalisé vers le vrai squelette AVANT nos corrections de main ; sans cette recopie, tout ce que la passe différée fait (paume, doigts) est calculé… et jamais affiché (bug vu : doigts raides à l'écran, mesures « parfaites » dans le vide)
  }
  try { autoCamUpdate(0); } catch (e) {}
  updateCamera();
  { const _p = performance.now(); if (!window.__norender) renderer.render(scene, camera); PERF.cur.rendu += performance.now() - _p; }   // __norender : épreuves de mouvement sans affichage (calcul seul, très rapide)
  PERF.cur.tot += performance.now() - _pf0; PERF.cur.n++; perfTick();
}

loadClips();
loadLibIndex();
setStatus();
loadDefault();
animate();

{ const bf = document.getElementById('btn-fps'); if (bf) { bf.classList.toggle('on', PERF.on); bf.addEventListener('click', () => { PERF.on = !PERF.on; bf.classList.toggle('on', PERF.on); }); } }
