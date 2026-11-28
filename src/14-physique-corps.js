/* ---------- Contact peau : les mains et avant-bras se posent SUR le corps, sans jamais y entrer ---------- */
const SKIN = { mesh: null, idx: null, n0: null, bi: null, P: [], N: [], ok: false };
const _sk = { v: new THREE.Vector3(), m: new THREE.Matrix4(), a: new THREE.Vector3(), p: new THREE.Vector3(), d: new THREE.Vector3(), push: new THREE.Vector3(), pole: new THREE.Vector3(), t: new THREE.Vector3(), e: new THREE.Vector3(), s: new THREE.Vector3() };
function skinSetup(root) {
  let mesh = null; root.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body_corps') mesh = o; });
  if (!mesh) return;
  mesh.updateMatrixWorld(true); mesh.skeleton.update();
  const g = mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const bones = mesh.skeleton.bones, bad = /Arm|Hand|Head|Neck|Jaw|Eye|Foot|Toe/;
  let ymin = Infinity, ymax = -Infinity; const W = [];
  for (let i = 0; i < pos.count; i++) { mesh.getVertexPosition(i, _sk.v).applyMatrix4(mesh.matrixWorld); W.push(_sk.v.y); ymin = Math.min(ymin, _sk.v.y); ymax = Math.max(ymax, _sk.v.y); }
  const H = ymax - ymin, lo = ymin + 0.38 * H, hi = ymin + 0.82 * H, vox = new Set(), idx = [], bi = [];
  for (let i = 0; i < pos.count; i++) {
    if (W[i] < lo || W[i] > hi) continue;
    let bw = 0, bb = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bb = si.getComponent(i, k); } }
    if (bad.test(bones[bb].name)) continue;
    mesh.getVertexPosition(i, _sk.v).applyMatrix4(mesh.matrixWorld);
    const key = Math.round(_sk.v.x / 0.03) + ',' + Math.round(_sk.v.y / 0.03) + ',' + Math.round(_sk.v.z / 0.03);
    if (vox.has(key)) continue; vox.add(key); idx.push(i); bi.push(bb);
  }
  SKIN.mesh = mesh; SKIN.idx = idx; SKIN.bi = bi; SKIN.n0 = idx.map((i) => new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)));
  SKIN.P = idx.map(() => new THREE.Vector3()); SKIN.N = idx.map(() => new THREE.Vector3()); SKIN.ok = true;
}
function skinUpdate() {
  const M = SKIN.mesh, bm = M.skeleton.boneMatrices;
  for (let k = 0; k < SKIN.idx.length; k++) {
    M.getVertexPosition(SKIN.idx[k], SKIN.P[k]).applyMatrix4(M.matrixWorld);
    _sk.m.fromArray(bm, SKIN.bi[k] * 16).premultiply(M.matrixWorld);
    SKIN.N[k].copy(SKIN.n0[k]).transformDirection(_sk.m);
  }
}
function skinPush(p, margin, out) {                   // vecteur qui ramène le point p juste au-dessus de la peau (0 si dehors)
  let best = -1, bd = 0.0144;                          // on ne regarde que la peau à moins de 12 cm
  for (let k = 0; k < SKIN.P.length; k++) { const d = SKIN.P[k].distanceToSquared(p); if (d < bd) { bd = d; best = k; } }
  out.set(0, 0, 0); if (best < 0) return 0;
  const n = SKIN.N[best], depth = margin - _sk.d.copy(p).sub(SKIN.P[best]).dot(n);
  if (depth > 0) out.copy(n).multiplyScalar(depth);
  return depth;
}
const _hc = { S: new THREE.Vector3(), H: new THREE.Vector3(), E: new THREE.Vector3(), D: new THREE.Vector3(), P: new THREE.Vector3(), Q: new THREE.Vector3(), o: new THREE.Vector3(), pole: new THREE.Vector3(), T: new THREE.Vector3() };
function handInside(P, D) {                            // la main (poignet, paume, doigts) est-elle sous la peau ?
  if (skinPush(P, 0.012, _hc.o) > 0.0005) return true;
  if (skinPush(_hc.Q.copy(P).addScaledVector(D, 0.07), 0.016, _hc.o) > 0.0005) return true;
  return skinPush(_hc.Q.copy(P).addScaledVector(D, 0.12), 0.008, _hc.o) > 0.0005;
}
/* La main ne s'enfonce pas dans la peau : elle est repoussée juste ce qu'il faut, perpendiculairement à la surface, et en douceur dans le temps.
   (Avant : la main « reculait » d'un coup le long de l'avant-bras dès qu'elle frôlait le corps — jusqu'à 90 cm de saut en une image pendant une
   simple marche, chaque fois que la main passait près de la hanche.) */
const _hcSt = new WeakMap();
function handContact(up, lo, hand) {
  if (!SKIN.ok || !up || !lo || !hand) return;
  let st = _hcSt.get(hand); if (!st) { st = new THREE.Vector3(); _hcSt.set(hand, st); }
  up.getWorldPosition(_hc.S); lo.getWorldPosition(_hc.E); hand.getWorldPosition(_hc.H);
  _hc.D.copy(_hc.H).sub(_hc.E).normalize();
  let dmax = 0; _hc.P.set(0, 0, 0);                        // poignet, paume, doigts : on garde l'enfoncement le plus profond
  for (const [off, mg] of [[0, 0.012], [0.07, 0.016], [0.12, 0.008]]) { const d = skinPush(_hc.Q.copy(_hc.H).addScaledVector(_hc.D, off), mg, _hc.o); if (d > dmax) { dmax = d; _hc.P.copy(_hc.o); } }
  if (dmax > 0.12) _hc.P.multiplyScalar(0.12 / dmax);      // jamais plus de 12 cm
  const dtk = Math.min(0.1, Math.max(0.004, _simDt)), step = 1.4 * dtk;          // la correction arrive et repart progressivement (1,4 m/s au plus)
  _hc.T.copy(_hc.P).sub(st); const l = _hc.T.length(); if (l > step) _hc.T.multiplyScalar(step / l); st.add(_hc.T);
  if (st.lengthSq() < 1e-7) return;
  _hc.T.copy(_hc.H).add(st);
  _hc.pole.copy(_hc.E).sub(_hc.S);                         // coude dans le même sens qu'avant
  armIK(up, lo, hand, _hc.T, _hc.pole, 1);
}
/* Repère du corps (côté droit, haut, avant) et points d'ancrage, recalculés à chaque image */
const _bf = { X: new THREE.Vector3(), Y: new THREE.Vector3(), Z: new THREE.Vector3(), l: new THREE.Vector3(), r: new THREE.Vector3(), anc: {}, tg2: new THREE.Vector3(), tg: new THREE.Vector3(), pl: new THREE.Vector3(), tmp: new THREE.Vector3() };
['head', 'sh', 'hips', 'avbL', 'poigL', 'mainL', 'chvD', 'plD', 'dosD', 'cuD', 'cdL', 'mlD'].forEach((k) => { _bf.anc[k] = new THREE.Vector3(); }); _bf.soleN = new THREE.Vector3(0, -1, 0); _bf.cuN = new THREE.Vector3(-1, 0, 0); _bf.mlN = new THREE.Vector3(0, 0, -1);
_bf.zo = {}; _bf.hx = new THREE.Vector3(); _bf.hz = new THREE.Vector3(); _bf.up = new THREE.Vector3(); _bf.sc = new THREE.Vector3();
const _bl1 = new THREE.Vector3(), _bl2 = new THREE.Vector3();
function libKey(keys, t, side, osc, gt, blend) {
  let k = 0; while (k + 1 < keys.length && keys[k + 1][0] <= t) k++;
  const A = keys[k], B = keys[k + 1] || A;
  let f = B === A ? 0 : (t - A[0]) / (B[0] - A[0]); f = Math.max(0, Math.min(1, f)); f = f * f * (3 - 2 * f);
  if (blend && B !== A && A[1] !== B[1] && A[1] !== 'fl' && B[1] !== 'fl') {          // changement d'ancre (table → bouche) : on fond les deux points, sans saut
    const pt = (K, v) => v.copy(_bf.anc[K[1]] || _bf.anc.sh).addScaledVector(_bf.X, K[2][0] * side).addScaledVector(_bf.Y, K[2][1]).addScaledVector(_bf.Z, K[2][2]);
    pt(A, _bl1); pt(B, _bl2); _bf.tg.lerpVectors(_bl1, _bl2, f);
    if (osc) _bf.tg.addScaledVector([_bf.X, _bf.Y, _bf.Z][osc[0]], osc[1] * Math.sin(gt * osc[2]));
    return _bf.tg;
  }
  const o = [0, 1, 2].map((i) => A[2][i] + (B[2][i] - A[2][i]) * f);
  if (osc) o[osc[0]] += osc[1] * Math.sin(gt * osc[2]);
  if (A[1] === 'fl') {                 // ancre « sol » : sous les épaules, au niveau du sol, repère horizontal (mains à plat même corps incliné ou allongé)
    _bf.hx.copy(_bf.X).setY(0).normalize(); _bf.hz.set(-_bf.hx.z, 0, _bf.hx.x);
    if (_bf.hz.x * Math.sin(rig.rotation.y) + _bf.hz.z * Math.cos(rig.rotation.y) < 0) _bf.hz.negate();   // « devant » = sens où elle regarde, même corps retourné
    return _bf.tg.copy(_bf.anc.sh).setY(0.065).addScaledVector(_bf.hx, o[0] * side).addScaledVector(_bf.hz, o[2]).add(_bf.up.set(0, o[1], 0));
  }
  const P = _bf.anc[A[1]] || _bf.anc.sh;
  if (A[1] === 'head' && _bf.hX) return _bf.tg.copy(P).addScaledVector(_bf.hX, o[0] * side).addScaledVector(_bf.hY, o[1]).addScaledVector(_bf.hZ, o[2]);
  return _bf.tg.copy(P).addScaledVector(_bf.X, o[0] * side).addScaledVector(_bf.Y, o[1]).addScaledVector(_bf.Z, o[2]);
}
function keyLerp(keys, t) {          // valeur interpolée (douce) entre images-clés [t, valeur]
  let k = 0; while (k + 1 < keys.length && keys[k + 1][0] <= t) k++;
  const A = keys[k], B = keys[k + 1] || A;
  let f = B === A ? 0 : Math.max(0, Math.min(1, (t - A[0]) / (B[0] - A[0]))); f = f * f * (3 - 2 * f);
  return [A[1], B[1], f];
}

/* ---------- Pieds verrouillés : un pied en appui reste planté au sol (fini les glissades), la jambe s'adapte par IK ---------- */
const FL = { L: { on: false, w: 0, p: new THREE.Vector3() }, R: { on: false, w: 0, p: new THREE.Vector3() }, prev: { L: new THREE.Vector3(), R: new THREE.Vector3() }, ok: false };
const _fl = { f: new THREE.Vector3(), h: new THREE.Vector3(), k: new THREE.Vector3(), t: new THREE.Vector3(), pole: new THREE.Vector3(), ax: new THREE.Vector3(), q: new THREE.Quaternion(), pq: new THREE.Quaternion() };
function footLock(b, dt, w) {
  if (window.__noFootLock || !b.lFoot || !b.rFoot || !b.lUpLeg || !b.rUpLeg) return;
  rig.updateMatrixWorld(true);
  b.lFoot.getWorldPosition(_fl.f); const yl = _fl.f.y; b.rFoot.getWorldPosition(_fl.f); const fy = Math.min(yl, _fl.f.y);   // hauteur du pied le plus bas = le sol
  for (const S of ['L', 'R']) {
    const up = S === 'L' ? b.lUpLeg : b.rUpLeg, lo = S === 'L' ? b.lLowLeg : b.rLowLeg, ft = S === 'L' ? b.lFoot : b.rFoot, st = FL[S];
    ft.getWorldPosition(_fl.f);
    const v = FL.ok ? Math.hypot(_fl.f.x - FL.prev[S].x, _fl.f.z - FL.prev[S].z) / Math.max(dt, 1e-3) : 9;
    FL.prev[S].copy(_fl.f);
    const low = _fl.f.y < fy + (st.on ? 0.045 : 0.02);                                            // hystérésis : pas de clignotement poser/lever
    if (!st.on && low && v < 0.45) { st.on = true; st.p.copy(_fl.f); }                           // le pied se pose : on le plante ici
    if (st.on && (!low || Math.hypot(_fl.f.x - st.p.x, _fl.f.z - st.p.z) > 0.16)) st.on = false;  // il se lève (ou l'appui change vraiment) : on le libère
    st.w += ((st.on ? 1 : 0) - st.w) * Math.min(1, dt * (st.on ? 14 : 8));
    const k = st.w * w; if (k < 0.01) continue;
    ft.getWorldQuaternion(_fl.q);                                                                  // l'orientation du pied est gardée
    up.getWorldPosition(_fl.h); lo.getWorldPosition(_fl.k);
    _fl.ax.copy(_fl.f).sub(_fl.h).normalize();
    _fl.pole.copy(_fl.k).sub(_fl.h); _fl.pole.addScaledVector(_fl.ax, -_fl.pole.dot(_fl.ax));    // le genou garde sa direction
    if (_fl.pole.lengthSq() < 1e-6) _fl.pole.set(0, 0, 1).applyQuaternion(rig.quaternion);
    _fl.t.set(st.p.x, _fl.f.y, st.p.z);
    armIK(up, lo, ft, _fl.t, _fl.pole.normalize(), k);
    ft.parent.getWorldQuaternion(_fl.pq); ft.quaternion.slerp(_fl.pq.invert().multiply(_fl.q), k);
  }
  FL.ok = true;
}
function footLockReset() { FL.L.on = FL.R.on = false; FL.L.w = FL.R.w = 0; FL.ok = false; }
/* ---------- Transitions : un nouveau geste part de la pose réelle du corps, jamais d'à-coup ---------- */
const XF = { snap: null, rigY: 0, hp: new THREE.Vector3(), t: 1, dur: 0.45, last: null, list: null };
const _xq = new THREE.Quaternion();
function xfadeCapture(b) {
  if (!XF.list) XF.list = [...new Set(Object.values(b).filter((o) => o && o.isObject3D))];
  if (!XF.snap) { XF.snap = XF.list.map(() => new THREE.Quaternion()); XF.lq = XF.list.map(() => new THREE.Quaternion()); XF.lhp = new THREE.Vector3(); }
  XF.list.forEach((o, i) => XF.lq[i].copy(o.quaternion)); XF.lrY = rig.position.y; if (b.hips) XF.lhp.copy(b.hips.position);   // dernière pose affichée
  XF.cap = true;
}
function xfadeStart() { if (!XF.cap) return; XF.lq.forEach((q, i) => XF.snap[i].copy(q)); XF.rigY = XF.lrY; XF.hp.copy(XF.lhp); XF.t = 0; }
function xfadeApply(b, dt) {
  if (XF.t >= 1 || !XF.snap || window.__noXfade) return;
  XF.t = Math.min(1, XF.t + dt / XF.dur);
  const f = XF.t * XF.t * (3 - 2 * XF.t);
  XF.list.forEach((o, i) => { _xq.copy(XF.snap[i]).slerp(o.quaternion, f); o.quaternion.copy(_xq); });
  rig.position.y = XF.rigY + (rig.position.y - XF.rigY) * f;
  if (b.hips) b.hips.position.lerpVectors(XF.hp, b.hips.position, f);
}
const _gv = new THREE.Vector3();
const AIRBORNE = /saut|jump|leap|\bhop\b|flip|roue|cartwheel|tournant|salto|acrobat/i;   // mouvements où les pieds quittent vraiment le sol
function groundBody(b, w, upOnly, noHands, noRLeg) {
  const m = groundMin(b, noHands, noRLeg);
  if (isFinite(m) && (!upOnly || m < -0.003)) { rig.position.y -= m * w; rig.updateMatrixWorld(true); }   // upOnly : simple garde-fou (rien ne passe sous le sol), sans recoller au sol
}
function groundMin(b, noHands, noRLeg) {   // noHands : gestes de TOUCHER — la main qui va vers le corps n'est pas un appui (vu : elle soulevait tout le corps, bassin 0,20↔0,76 m, boucle)          // le point le plus bas du corps (pieds, genoux, bassin, buste, tête) se pose exactement sur le sol
  rig.updateMatrixWorld(true);
  const fy = body.anchL ? body.anchL.y : 0.07;
  const C = [[b.lFoot, fy], [b.rFoot, fy], [b.lToes, 0.009], [b.rToes, 0.009], [b.lLowLeg, 0.075], [b.rLowLeg, 0.075], [b.lUpLeg, 0.13], [b.rUpLeg, 0.13], [b.hips, 0.16], [b.chest, 0.135], [b.head, 0.105], [b.spine, 0.1]]   // rayons : volume réel du corps (fesses, poitrine) autour de l'os;
  if (groundBody.v !== vrm) { groundBody.v = vrm; groundBody.te = null; }
  if (!groundBody.te) groundBody.te = [vrm.scene.getObjectByName('LeftToe_End'), vrm.scene.getObjectByName('RightToe_End')];
  for (const e of groundBody.te) if (e) C.push([e, 0.012]);
  if (!noHands) for (const h of [b.lHand, b.rHand]) if (h) C.push([h, 0.035]);
  if (noRLeg) for (let i = C.length - 1; i >= 0; i--) if (/^(Normalized_)?Right(Foot|Toe|ToeBase|Toe_End|Leg|LowerLeg)/.test(C[i][0] && C[i][0].name || '') || C[i][0] === b.rFoot || C[i][0] === b.rToes || C[i][0] === b.rLowLeg) C.splice(i, 1);   // jambe droite POSÉE ensuite par IK (demi-tailleur) : elle n'est pas un appui   // mains : en appui (roue, équilibre, pompes), elles se posent sur le sol au lieu de passer dessous   // bout des orteils : sur la pointe des pieds, il ne s'enfonce plus dans le sol
  const FP = body.footPts && !window.__oldFeet ? body.footPts : null;
  if (FP) for (let i = C.length - 1; i >= 0; i--) { const o = C[i][0]; if (o && (o === b.lFoot || o === b.rFoot || o === b.lToes || o === b.rToes || /Toe_End/.test(o.name || ''))) C.splice(i, 1); }   // pieds : la vraie peau remplace les points estimes
  let m = Infinity, mo = null; for (const [o, r] of C) if (o) { const v = o.getWorldPosition(_gv).y - r; if (v < m) { m = v; mo = o.name; } }
  if (FP) {                                                   // vraie peau des pieds : os bruts mis a jour d'abord (la peau les suit, pas le rig normalise)
    try { vrm.humanoid.update(); } catch (_) {}
    rig.updateMatrixWorld(true);
    const M = FP.mesh;
    for (const k of noRLeg ? ['L'] : ['L', 'R']) for (const i of FP[k]) { const v = M.getVertexPosition(i, _gv).applyMatrix4(M.matrixWorld).y; if (v < m) { m = v; mo = 'peau ' + k; } }
  }
  if (window.__gbLog) window.__gbLog.push([mo, +m.toFixed(3), +rig.position.y.toFixed(3), b.rUpLeg.rotation.toArray().slice(0,3).map((x) => +x.toFixed(2)), +b.rLowLeg.rotation.x.toFixed(2), +b.hips.rotation.x.toFixed(2), +b.hips.position.y.toFixed(3)]);
  return m;
}
/* Phases de vol des anciens clips (sans donnees d'appui) : la course se definit par une alternance d'appuis et de vols,
   au plus un pied au sol (rapport contact/foulee sous 50 %). L'ancrage recollait le corps au sol a chaque image :
   apres le passage sur la vraie peau des pieds, la course ne quittait plus jamais le sol (mesure le 28/11).
   On parcourt le clip une fois : pour chaque image, hauteur du point le plus bas au-dessus du sol de la capture.
   Une image est en vol si les deux pieds sont nettement plus hauts que le sol. En vol, h = hauteur au-dessus de la
   ligne qui va du decollage a l'atterrissage (comme la preparation des mouvements de la bibliotheque). */
const FLIGHT_THR = 0.012;
function clipFlight(c, b) {
  if (c._flv === vrm && c._fl) return c._fl;
  c._flv = vrm; c._fl = null;
  try {
    const list = [...new Set(Object.values(b).filter((o) => o && o.isObject3D))];
    const sq = list.map((o) => o.quaternion.clone()), sp = list.map((o) => o.position.clone()), ry = rig.position.clone();
    const n = c.n, L = new Float32Array(n), g = { clip: c, t: 0, speed: 1 };
    const FP = body.footPts, M = FP && FP.mesh, V = new THREE.Vector3(), inv = new THREE.Matrix4();
    const Hk = { L: new Float32Array(n), R: new Float32Array(n) }, Zk = { L: new Float32Array(n), R: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      list.forEach((o, k) => { o.quaternion.copy(sq[k]); o.position.copy(sp[k]); });
      if (b.hips) b.hips.position.set(body.hipsX || 0, body.hipsY, body.hipsZ || 0);
      rig.position.set(ry.x, 0, ry.z);
      g.t = i / c.fps; applyClip(g, 1, b); rig.updateMatrixWorld(true);
      L[i] = groundMin(b);                                               // (met aussi a jour les os bruts : la peau est a jour)
      if (FP) {
        inv.copy(rig.matrixWorld).invert();
        const hz = b.hips.getWorldPosition(V).applyMatrix4(inv).z;
        for (const k of ['L', 'R']) { let lo = 1e9, z = 0;
          for (const j of FP[k]) { M.getVertexPosition(j, V).applyMatrix4(M.matrixWorld); if (V.y < lo) { lo = V.y; z = V.applyMatrix4(inv).z - hz; } }
          Hk[k][i] = lo; Zk[k][i] = z; }
      }
    }
    list.forEach((o, k) => { o.quaternion.copy(sq[k]); o.position.copy(sp[k]); }); rig.position.copy(ry); rig.updateMatrixWorld(true);
    // appui d'un pied : il RECULE par rapport au bassin (sur place, c'est le sol qui defile) ET il est pres de son point le plus bas.
    // Ni l'un ni l'autre ne suffit seul : le pied recule encore juste apres le decollage, et le sol de la capture derive de plusieurs cm.
    const appui = {};
    for (const k of ['L', 'R']) {
      const H = Hk[k], Z = Zk[k], mn = Math.min(...H), dZ = new Float32Array(n);
      for (let i = 0; i < n; i++) dZ[i] = (Z[(i + 1) % n] - Z[(i - 1 + n) % n]) / 2;
      let sm_ = 0; for (let i = 0; i < n; i++) if (H[i] - mn < 0.03) sm_ += dZ[i];
      const sg = sm_ < 0 ? -1 : 1;                                       // sens du recul en appui
      let vmax = 0; for (let i = 0; i < n; i++) vmax = Math.max(vmax, dZ[i] * sg);
      appui[k] = Array.from(H, (h, i) => (dZ[i] * sg > 0.3 * vmax && h - mn < 0.05) || h - mn < FLIGHT_THR);   // pied a son plus bas = pose (danse sur place : il ne recule pas)
    }
    let air = Array.from({ length: n }, (_, i) => FP ? !appui.L[i] && !appui.R[i] : false);
    air = air.map((a, i) => a && (air[(i - 1 + n) % n] || air[(i + 1) % n]));   // une image isolee est du bruit, pas un vol
    const h = new Float32Array(n);
    for (let i = 0; i < n; i++) if (air[i]) {
      let a = i, e = i; let guard = 0;
      while (air[(a - 1 + n) % n] && guard++ < n) a = (a - 1 + n) % n;
      guard = 0; while (air[(e + 1) % n] && guard++ < n) e = (e + 1) % n;
      if (air.every((x) => x)) break;
      const ia = (a - 1 + n) % n, ie = (e + 1) % n, len = ((ie - ia + n) % n) || n, k = ((i - ia + n) % n) / len;
      h[i] = Math.max(0, L[i] - (L[ia] + (L[ie] - L[ia]) * k));         // au-dessus de la ligne decollage -> atterrissage
    }
    if (Math.max(...h) < 0.005) { air.fill(false); h.fill(0); }          // « vol » de moins de 5 mm : pas un vol
    c._fl = { h, air, part: air.filter(Boolean).length / n };
  } catch (e) { console.warn('vol', e); c._fl = null; }
  return c._fl;
}
function groundClip(g, b, w) {                                          // ancrage qui respecte les phases de vol du clip
  const F = clipFlight(g.clip, b), n = g.clip.n;
  let hv = 0;
  if (F && g._fr !== undefined) { const f = g._fr, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, t = f - Math.floor(f); hv = F.h[i0] + (F.h[i1] - F.h[i0]) * t; }
  const m = groundMin(b);
  if (!isFinite(m)) return;
  rig.position.y -= (m - hv) * w;                                       // en appui hv = 0 : exactement l'ancrage habituel
  rig.updateMatrixWorld(true);
}
function applyFk(def, gt, w, b) {      // corps entier : jambes, bassin, buste, et le corps qui tourne ou se baisse
  if (def.fk) {
    const [A, B, f] = keyLerp(def.fk, gt);
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const bone = b[k]; if (!bone) continue;
      const a = A[k] || [0, 0, 0], c = B[k] || [0, 0, 0];
      bone.rotation.x += (a[0] + (c[0] - a[0]) * f) * w; bone.rotation.y += (a[1] + (c[1] - a[1]) * f) * w; bone.rotation.z += (a[2] + (c[2] - a[2]) * f) * w;
    }
  }
  if (def.oscFk && b[def.oscFk[0]]) b[def.oscFk[0]].rotation[['x', 'y', 'z'][def.oscFk[1]]] += def.oscFk[2] * Math.sin(gt * def.oscFk[3]) * w;
  if (def.flinch && gt > def.flinch.t) {                                     // SURSAUT : secousse amortie au moment où ça fait mal (recul du buste, tête, épaule qui remonte)
    const u = gt - def.flinch.t, e = Math.exp(-u * 7) * Math.sin(u * 24) * def.flinch.amp * w;
    if (b.chest) b.chest.rotation.x += -0.5 * e;
    if (b.neck) b.neck.rotation.x += -0.35 * e;
    if (b.head) b.head.rotation.x += 0.3 * e;
    if (b.hips) b.hips.rotation.x += -0.12 * e;
  }
  if (def.iso) for (const [k, ax, amp, fr, ph] of def.iso) if (b[k]) b[k].rotation[['x', 'y', 'z'][ax]] += amp * Math.sin(gt * fr + (ph || 0)) * w;   // isolations (cercles de hanches, shimmy, rebonds…)
  if (def.oscRoot) rig.position.y += def.oscRoot[0] * Math.sin(gt * def.oscRoot[1]) * w;
  if (def.root) {
    const [A, B, f] = keyLerp(def.root, gt);
    const yaw = A[0] + (B[0] - A[0]) * f, dy = A[1] + (B[1] - A[1]) * f;
    const env = def.root[def.root.length - 1][1][0] > 3 ? 1 : w;       // un tour complet : pas d'atténuation, il finit face à toi
    rig.rotation.y += yaw * env; rig.position.y += dy * w;
    if (def.step) {                    // petits pas pendant qu'elle tourne (step 2 : marche sur place)
      const big = def.step === 2, ph = Math.sin(gt * (big ? 6 : 9)), up = Math.max(0, ph), dn = Math.max(0, -ph), a = big ? 2.0 : 1;
      if (b.lUpLeg) b.lUpLeg.rotation.x += -0.22 * a * up * w + (big ? 0.12 * dn * w : 0); if (b.lLowLeg) b.lLowLeg.rotation.x += 0.45 * a * up * w;
      if (b.rUpLeg) b.rUpLeg.rotation.x += -0.22 * a * dn * w + (big ? 0.12 * up * w : 0); if (b.rLowLeg) b.rLowLeg.rotation.x += 0.45 * a * dn * w;
      if (big && b.chest) b.chest.rotation.y += 0.09 * ph * w;
    }
  }
}
/* Volume du corps (tronc + tête, sans les bras) mesuré une fois sur le maillage : par tranches de 2 cm et 24 directions,
   la distance de la peau à l'axe du corps. Une main qui viserait l'intérieur est repoussée juste sur la peau. */
let bodyMap = null;
function buildBodyMap(b) {
  bodyMap = null;
  if (!vrm || !vrm.isGlb || !b.rArm || !b.lArm || !b.hips) return;
  rig.updateMatrixWorld(true);
  const r = b.rArm.getWorldPosition(new THREE.Vector3()), l = b.lArm.getWorldPosition(new THREE.Vector3()), O = b.hips.getWorldPosition(new THREE.Vector3());
  const X = r.clone().sub(l).normalize(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3().crossVectors(Y, X).normalize();
  const H0 = -0.22, DH = 0.02, NS = 100, NB = 24, pts = [];
  vrm.scene.traverse((o) => {
    if (!o.isSkinnedMesh || !/^Body/.test(o.name)) return;
    const P = o.geometry.attributes.position, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight, bones = o.skeleton.bones;
    const armB = bones.map((bb) => /Arm|Hand/.test(bb.name));
    const v = new THREE.Vector3();
    for (let i = 0; i < P.count; i += 2) {
      let aw = 0; for (let k = 0; k < 4; k++) if (armB[SI.getComponent(i, k)]) aw += SW.getComponent(i, k);
      if (aw > 0.25) continue;
      v.fromBufferAttribute(P, i); if (o.applyBoneTransform) o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld).sub(O);   // position réelle, squelette compris
      const hy = v.dot(Y), s = Math.floor((hy - H0) / DH); if (s < 0 || s >= NS) continue;
      pts.push([s, v.dot(X), v.dot(Z)]);
    }
  });
  if (pts.length < 500) return;
  const cx = new Float32Array(NS), cz = new Float32Array(NS), cn = new Float32Array(NS);
  for (const [s, x, z] of pts) { cx[s] += x; cz[s] += z; cn[s]++; }
  for (let s = 0; s < NS; s++) if (cn[s]) { cx[s] /= cn[s]; cz[s] /= cn[s]; }
  const R = new Float32Array(NS * NB);
  for (const [s, x, z] of pts) {
    const dx = x - cx[s], dz = z - cz[s], a = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * NB) % NB;
    R[s * NB + a] = Math.max(R[s * NB + a], Math.hypot(dx, dz));
  }
  for (let s = 0; s < NS; s++) for (let a = 0; a < NB; a++) if (!R[s * NB + a] && cn[s]) R[s * NB + a] = Math.max(R[s * NB + (a + 1) % NB], R[s * NB + (a + NB - 1) % NB]);
  bodyMap = { H0, DH, NS, NB, cx, cz, cn, R };
}
const _po = new THREE.Vector3();
function pushOut(tg, rad) {               // repousse une cible de main hors du corps (repère : bassin + axes du corps)
  const M = bodyMap; if (!M || rad < 0) return tg;
  _po.copy(tg).sub(_bf.anc.hips);
  const hy = _po.dot(_bf.Y), sf = (hy - M.H0) / M.DH, s = Math.floor(sf);
  if (s < 0 || s >= M.NS - 1 || !M.cn[s]) return tg;
  const x = _po.dot(_bf.X) - M.cx[s], z = _po.dot(_bf.Z) - M.cz[s], d = Math.hypot(x, z);
  const af = ((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * M.NB, a0 = Math.floor(af) % M.NB, a1 = (a0 + 1) % M.NB, fa = af - Math.floor(af);
  const rAt = (ss) => M.R[ss * M.NB + a0] * (1 - fa) + M.R[ss * M.NB + a1] * fa;
  const rb = rAt(s) * (1 - (sf - s)) + rAt(Math.min(M.NS - 1, s + 1)) * (sf - s);
  if (!rb || d >= rb + rad) return tg;
  const k = d > 1e-4 ? (rb + rad) / d : 0;
  const nx = d > 1e-4 ? x * k : rb + rad, nz = d > 1e-4 ? z * k : 0;
  return tg.copy(_bf.anc.hips).addScaledVector(_bf.Y, hy).addScaledVector(_bf.X, nx + M.cx[s]).addScaledVector(_bf.Z, nz + M.cz[s]);
}


/* ================= OBJETS : elle les prend sur une petite table, les tient dans la main, les utilise, les repose ================= */
const PROPS = {
  verre:     { lift: 0.0,  fwd: 0.0 },  tasse: { lift: 0.0, fwd: 0.0 },  bouteille: { lift: 0.03, fwd: 0.0 },
  telephone: { face: 1, lift: 0.03, fwd: 0.0 },  livre: { face: 1, lift: 0.04, fwd: 0.0 },
  fleur:     { lift: 0.0, fwd: 0.0 },  stylo: { lift: 0.03, fwd: 0.0 },  miroir: { face: 1, lift: 0.07, fwd: 0.0 },
  glace:     { lift: 0.0, fwd: 0.0 },  pomme: { lift: 0.0, fwd: 0.0 },          // aliments : voir « BOUCHE » (lécher, croquer, mâcher)
};
function buildProp(name) {
  const g = new THREE.Group(), M = (c, r = 0.5, m = 0, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, o));
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (name === 'verre') { add(new THREE.CylinderGeometry(0.036, 0.029, 0.12, 24, 1, true), M(0xcfe6f2, 0.05, 0, { transparent: true, opacity: 0.35, side: THREE.DoubleSide })); add(new THREE.CylinderGeometry(0.033, 0.027, 0.07, 24), M(0xb5303a, 0.2, 0, { transparent: true, opacity: 0.85 }), 0, -0.02, 0); add(new THREE.CylinderGeometry(0.029, 0.029, 0.006, 24), M(0xcfe6f2, 0.05, 0, { transparent: true, opacity: 0.5 }), 0, -0.06, 0); }
  else if (name === 'tasse') { add(new THREE.CylinderGeometry(0.04, 0.034, 0.08, 24), M(0xf4efe8, 0.35)); add(new THREE.CylinderGeometry(0.034, 0.034, 0.004, 24), M(0x4a2a18, 0.3), 0, 0.037, 0); const h = add(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), M(0xf4efe8, 0.35), 0.043, 0, 0); h.rotation.z = -Math.PI / 2; }
  else if (name === 'bouteille') { add(new THREE.CylinderGeometry(0.034, 0.034, 0.17, 24), M(0xcfe9f5, 0.08, 0, { transparent: true, opacity: 0.6 })); add(new THREE.CylinderGeometry(0.013, 0.034, 0.05, 24), M(0xcfe9f5, 0.08, 0, { transparent: true, opacity: 0.6 }), 0, 0.105, 0); add(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 16), M(0x2a6fb0, 0.4), 0, 0.14, 0); }
  else if (name === 'telephone') { add(new THREE.BoxGeometry(0.072, 0.15, 0.009), M(0x1b1b20, 0.25, 0.4)); add(new THREE.PlaneGeometry(0.064, 0.138), M(0x6fa8ff, 0.3, 0, { emissive: 0x3b6cc0, emissiveIntensity: 0.9 }), 0, 0, 0.0051); }
  else if (name === 'livre') { add(new THREE.BoxGeometry(0.15, 0.21, 0.026), M(0x7a1f2b, 0.6)); add(new THREE.BoxGeometry(0.142, 0.2, 0.022), M(0xf1e8d2, 0.9), 0.003, 0, 0); }
  else if (name === 'fleur') { add(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 8), M(0x3b7a3a, 0.7), 0, 0.02, 0); const hd = add(new THREE.IcosahedronGeometry(0.03, 1), M(0xe0457b, 0.5), 0, 0.17, 0); hd.scale.set(1, 0.7, 1); add(new THREE.SphereGeometry(0.011, 10, 10), M(0xf2c14e, 0.6), 0, 0.185, 0); }
  else if (name === 'stylo') { add(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 10), M(0x1b3a6b, 0.3, 0.3)); add(new THREE.ConeGeometry(0.006, 0.02, 10), M(0xc9c9c9, 0.3, 0.8), 0, -0.08, 0); }
  else if (name === 'miroir') { add(new THREE.CylinderGeometry(0.055, 0.055, 0.008, 28), M(0xd9b46a, 0.3, 0.8), 0, 0.09, 0).rotation.x = Math.PI / 2; add(new THREE.CircleGeometry(0.05, 28), M(0xcfe0ea, 0.05, 1), 0, 0.09, 0.0045); add(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 10), M(0xd9b46a, 0.3, 0.8), 0, 0.0, 0); }
  else if (name === 'glace') {          // cornet (pointe en bas, tenu par le milieu) + boule : la boule rapetisse à chaque coup de langue
    const c = add(new THREE.ConeGeometry(0.024, 0.11, 24, 1, true), M(0xd9a35b, 0.85, 0, { side: THREE.DoubleSide })); c.rotation.x = Math.PI;
    add(new THREE.SphereGeometry(0.0235, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xf3a6bb, 0.55), 0, 0.053, 0);
    const b = add(new THREE.SphereGeometry(0.03, 28, 20), M(0xf3a6bb, 0.5), 0, 0.075, 0); b.name = 'boule';
  }
  else if (name === 'pomme') {          // pomme : chaque bouchée CREUSE vraiment sa surface (chair claire), voir propBite
    const geo = new THREE.SphereGeometry(0.034, 72, 50), n = geo.attributes.position.count, col = new Float32Array(n * 3), red = new THREE.Color(0xb5202a);
    for (let i = 0; i < n; i++) { const y = geo.attributes.position.getY(i) / 0.034, k = 0.85 + 0.15 * Math.sin(i * 12.9898) * (1 - Math.abs(y)); col[i * 3] = red.r * k + 0.1 * Math.max(0, y); col[i * 3 + 1] = red.g * k + 0.18 * Math.max(0, y - 0.6); col[i * 3 + 2] = red.b * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const a = add(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32 })); a.name = 'chair'; a.scale.set(1, 0.93, 1);
    add(new THREE.CylinderGeometry(0.0012, 0.0016, 0.016, 6), M(0x4a3020, 0.8), 0.002, 0.036, 0).rotation.z = -0.25;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
const PROPS_ST = { mesh: null, name: '', table: null, held: false, vis: 0, hand: 'r' };
const _pv = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), X: new THREE.Vector3(), Z: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
function propTable() {
  if (PROPS_ST.table) return PROPS_ST.table;
  const t = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 32), wood); top.name = 'top';
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1, 12), wood); leg.name = 'leg';
  const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.06, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xcfe6f2, roughness: 0.08, transparent: true, opacity: 0.4, side: THREE.DoubleSide })); sup.name = 'support'; sup.position.y = 0.0425; sup.visible = false;   // porte-cornet (pour la glace) : reste sur la table
  t.add(top, leg, sup); t.visible = false; scene.add(t); PROPS_ST.table = t; return t;
}
function handFrame(b, hk) {                          // repère de la main dans son propre repère : f = vers les doigts, t = vers le pouce, n = paume
  const set = b.hand && b.hand[hk]; if (!set || !set.Middle || !set.Index || !set.Little || !set.Middle[0]) return null;
  const f = set.Middle[0].position.clone().normalize(), t = set.Index[0].position.clone().sub(set.Little[0].position); t.addScaledVector(f, -t.dot(f)).normalize();
  const n = new THREE.Vector3().crossVectors(f, t).normalize(); if (hk === 'l') n.negate();
  return { f, t, n };
}
function propUpdate(lib, gt, b) {
  const S = PROPS_ST, spec = lib && lib.prop;
  if (!spec) { if (S.vis > 0 && S.mesh) { S.vis = Math.max(0, S.vis - 0.08); if (S.vis === 0) { if (S.mesh.parent) S.mesh.parent.remove(S.mesh); S.held = false; S.table.visible = false; } else S.table.scale.setScalar(S.vis); } return; }
  const T = propTable(), hk = spec.h || 'r', side = hk === 'r' ? 1 : -1, def = PROPS[spec.n]; if (!def) return;
  if (S.name !== spec.n || !S.mesh) { if (S.mesh && S.mesh.parent) S.mesh.parent.remove(S.mesh); S.mesh = buildProp(spec.n); S.name = spec.n; S.held = false; }
  S.vis = Math.min(1, S.vis + 0.1); T.visible = true; T.scale.setScalar(S.vis); S.hand = hk;
  { const sup = T.getObjectByName('support'); if (sup) sup.visible = spec.n === 'glace'; }
  // la table : devant elle, du côté de la main qui prend, à hauteur de hanche
  b.hips.getWorldPosition(_pv.a); _pv.Z.copy(_bf.Z).setY(0).normalize(); _pv.X.copy(_bf.X).setY(0).normalize();
  const k = body.k || 1, tx = _pv.a.x + _pv.Z.x * 0.36 * k + _pv.X.x * 0.2 * k * side, tz = _pv.a.z + _pv.Z.z * 0.36 * k + _pv.X.z * 0.2 * k * side, ty = _pv.a.y - 0.07 * k;
  T.position.set(tx, ty, tz); T.getObjectByName('leg').scale.y = Math.max(0.1, ty); T.getObjectByName('leg').position.y = -ty / 2 - 0.0125;
  const held = gt >= spec.on && gt < spec.off, hand = hk === 'r' ? b.rHand : b.lHand;
  if (held) {                                                      // dans la main : suit la paume, orienté par rapport à son corps (verre droit puis incliné vers la bouche, téléphone face à elle…)
    if (S.mesh.parent !== scene) { if (S.mesh.parent) S.mesh.parent.remove(S.mesh); scene.add(S.mesh); S.mesh.scale.setScalar(1); }
    const set = b.hand && b.hand[hk], mid = set && set.Middle && set.Middle[0];
    _pv.a.set(0, 0, 0); if (mid) _pv.a.copy(mid.position).multiplyScalar(0.5); hand.localToWorld(_pv.a);                // milieu de la paume
    const tl = spec.tilt || [[0, 0]]; let ti = 0; { let i = 0; while (i + 1 < tl.length && tl[i + 1][0] <= gt) i++; const A = tl[i], B2 = tl[i + 1] || A; let f = B2 === A ? 0 : Math.max(0, Math.min(1, (gt - A[0]) / (B2[0] - A[0]))); f = f * f * (3 - 2 * f); ti = A[1] + (B2[1] - A[1]) * f; }
    _pv.X.copy(_bf.X).setY(0).normalize(); _pv.Z.copy(_bf.Z).setY(0).normalize();
    const yaw = Math.atan2(_pv.Z.x, _pv.Z.z);
    _pv.q.setFromEuler(new THREE.Euler(-ti, yaw + (def.face ? Math.PI : 0), 0, 'YXZ'));        // inclinaison autour de l'axe des épaules, cap = celui du corps
    _pv.q.setFromEuler(new THREE.Euler(0, 0, 0)); { const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + (def.face ? Math.PI : 0)), qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ti * (def.face ? -1 : 1)); _pv.q.copy(qy).multiply(qx); }
    S.mesh.quaternion.copy(_pv.q);
    _pv.b.set(0, 1, 0).applyQuaternion(_pv.q); S.mesh.position.copy(_pv.a).addScaledVector(_pv.b, def.lift || 0.0).addScaledVector(_pv.Z, def.fwd || 0).addScaledVector(_pv.X, (def.side || 0) * side);
    S.held = true;
  } else if (S.mesh.parent !== scene || S.held) {                      // posé sur la table
    if (S.mesh.parent) S.mesh.parent.remove(S.mesh); S.mesh.scale.setScalar(1); S.mesh.quaternion.identity(); scene.add(S.mesh); S.held = false;
  }
  if (!held) { S.mesh.quaternion.identity(); S.mesh.position.set(tx, ty + 0.0125 + (PROPS_H[spec.n] || 0.06), tz); }
}
/* PRISE RÉELLE : la forme principale de chaque objet (distance signée exacte, repère local) et son demi-épaisseur dans la direction de la paume.
   L'objet est posé CONTRE la paume affichée, puis chaque doigt et le pouce se referment jusqu'au contact de sa vraie surface (même solveur que sur la peau). */
const _sdfBox = (p, hx, hy, hz) => { const qx = Math.abs(p.x) - hx, qy = Math.abs(p.y) - hy, qz = Math.abs(p.z) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
const PROP_SDF = {
  verre: (p) => Math.max(Math.hypot(p.x, p.z) - (0.0325 + (p.y / 0.12) * 0.007), Math.abs(p.y) - 0.06),
  tasse: (p) => Math.max(Math.hypot(p.x, p.z) - (0.037 + (p.y / 0.08) * 0.006), Math.abs(p.y) - 0.04),
  bouteille: (p) => Math.max(Math.hypot(p.x, p.z) - 0.034, Math.abs(p.y) - 0.085),
  telephone: (p) => _sdfBox(p, 0.036, 0.075, 0.0045), livre: (p) => _sdfBox(p, 0.075, 0.105, 0.013),
  glace: (p) => Math.max(Math.hypot(p.x, p.z) - (0.003 + (p.y + 0.055) / 0.11 * 0.021), Math.abs(p.y) - 0.055),   // le cornet (c'est lui qu'elle tient)
  pomme: (p) => Math.hypot(p.x, p.y / 0.93, p.z) - 0.034 };
const PROP_SHIFT = { telephone: 0.05, livre: 0.04 }, PROP_LONG = { telephone: 1 };
const PROP_R = { verre: 0.032, tasse: 0.036, bouteille: 0.034, telephone: 0.0045, livre: 0.013, glace: 0.0135, pomme: 0.034 };
function propGrasp(b, dt) {                         // passe différée (après la physique) : sur la main AFFICHÉE
  const S = PROPS_ST; if (!S.held || !S.mesh || !PROP_SDF[S.name] || window.__noGrasp) return false;
  const hk = S.hand, hand = hk === 'l' ? b.lHand : b.rHand; surfPropagate(b);
  const P = new THREE.Vector3(), N = new THREE.Vector3(); if (!palmPoint(b, hk, hand, P, N)) return false;
  const def = PROPS[S.name] || {};
  if (def.face) {                                   // objet PLAT (téléphone, livre) : orienté PAR LA MAIN — dos contre la paume, longueur en travers de la paume (les doigts enveloppent un bord, le pouce l'autre), écran tourné vers elle
    const fd = new THREE.Vector3(), nn = new THREE.Vector3(); rawPalmFrame(b, hk, fd, nn);
    const tt = new THREE.Vector3().crossVectors(nn, fd).normalize(); if (tt.y < 0) tt.negate();   // en travers de la paume, vers le haut
    const ax = (PROP_LONG[S.name] ? fd.clone() : tt.clone());   // téléphone : dans la LONGUEUR de la main (doigts à plat derrière, pouce sur le côté — la prise pour regarder l'écran) ; livre : en travers (dos dans la paume)
    const zz = nn.clone(), yy = ax.addScaledVector(zz, -ax.dot(zz)).normalize(), xx = new THREE.Vector3().crossVectors(yy, zz);
    S.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, zz));
    S.mesh.position.copy(P).addScaledVector(nn, PROP_R[S.name] + 0.004).addScaledVector(fd, window.__propSh ?? PROP_SHIFT[S.name] ?? 0);   // décalé vers les doigts : le bord passe sous la 2e phalange, les doigts s'enroulent autour (centré : les doigts se refermaient dans le vide au-delà du bord, vu)
    S.mesh.updateMatrixWorld(true); const inv0 = S.mesh.matrixWorld.clone().invert(), f0 = PROP_SDF[S.name], tmp0 = new THREE.Vector3();
    fingersToSurface(b, hk, 1, dt, (p) => f0(tmp0.copy(p).applyMatrix4(inv0)));
    return true; }
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(S.mesh.quaternion);
  const n2 = N.clone().addScaledVector(up, -N.dot(up)); if (n2.lengthSq() < 1e-4) return false; n2.normalize();   // la paume regarde l'axe de l'objet
  S.mesh.position.copy(P).addScaledVector(n2, PROP_R[S.name] + 0.006).addScaledVector(up, (def.lift || 0) * 0.5);
  S.mesh.updateMatrixWorld(true); const inv = S.mesh.matrixWorld.clone().invert(), f = PROP_SDF[S.name], tmp = new THREE.Vector3();
  fingersToSurface(b, hk, 1, dt, (p) => f(tmp.copy(p).applyMatrix4(inv)));
  return true;
}
const PROPS_H = { verre: 0.06, tasse: 0.04, bouteille: 0.085, telephone: 0.005, livre: 0.013, fleur: 0.004, stylo: 0.006, miroir: 0.05, glace: 0.085, pomme: 0.0316 };
/* Gestes avec objet : même format que les autres gestes (images-clés), plus `prop` : {n, h, on, off} = quand l'objet est dans la main. */
(function () {
  const T = (x, y, z) => ['hips', [x, y, z]], rest = ['sh', [0.2, -0.4, 0.05]];
  const lean = (a) => ({ spine: [a, 0, 0], chest: [a * 0.4, 0, 0] });
  const take = (n, hand, shape, use, dur) => {                      // prendre sur la table → utiliser → reposer → revenir
    const table = [0.2, 0.0, 0.34], above = [0.2, 0.11, 0.33], r = [[0, ...rest], [0.9, 'hips', above], [1.3, 'hips', table], [1.6, 'hips', table]];
    for (const u of use) r.push([...u.slice(0, 1), ...u.slice(1)]);
    const e = use[use.length - 1][0]; r.push([e + 0.8, 'hips', above], [e + 1.15, 'hips', table], [e + 1.5, 'hips', above], [e + 2.2, ...rest]);
    return { n, hand, shape, r, e };
  };
  const mk = (name, n, hand, shape, use, extra) => {
    const t = take(n, hand, shape, use), hk = hand, side = hand === 'r' ? 'r' : 'l', e = t.e;
    const def = Object.assign({ dur: e + 2.6, blend: true, prop: { n, h: hk, on: 1.45, off: e + 1.3, tilt: (extra && extra.tilt) || [[0, 0]] }, [side]: t.r, [side + 'Pole']: [1, -0.8, 0.1] }, extra || {});
    def[side + 'Hand'] = [[0, 'open'], [1.0, 'open'], [1.5, shape], [e + 1.2, shape], [e + 1.5, 'open']];
    def.fk = [[0, {}], [0.9, lean(0.22)], [1.7, lean(0.05)], [e + 0.6, lean(0.04)], [e + 1.2, lean(0.22)], [e + 2.4, {}]];
    GLIB[name] = def;
  };
  mk('boire',     'verre',     'r', 'asl-c',      [[2.4, 'head', [0.03, 0.0, 0.14]], [3.6, 'head', [0.03, 0.02, 0.15]], [4.2, 'head', [0.03, 0.0, 0.14]]], { head: [-0.1, 0, 0.0], face: ['relaxed', 0.5], tilt: [[0, 0], [2.2, 0], [3.0, 0.9], [3.8, 0.9], [4.3, 0]] });
  mk('cafe',      'tasse',     'r', 'asl-c',      [[2.4, 'head', [0.03, 0.0, 0.14]], [3.8, 'head', [0.03, 0.02, 0.15]], [4.4, 'head', [0.03, 0.0, 0.14]]], { head: [-0.06, 0, 0], face: ['relaxed', 0.6], tilt: [[0, 0], [2.2, 0], [3.0, 0.5], [4.0, 0.5], [4.5, 0]] });
  mk('eau',       'bouteille', 'r', 'asl-c',      [[2.4, 'head', [0.03, 0.0, 0.15]], [3.8, 'head', [0.03, 0.03, 0.16]], [4.4, 'head', [0.03, 0.0, 0.15]]], { head: [-0.2, 0, 0], tilt: [[0, 0], [2.2, 0], [3.0, 1.2], [4.0, 1.2], [4.5, 0]] });
  mk('telephone', 'telephone', 'r', 'asl-flat-o', [[2.4, 'head', [0.0, -0.1, 0.3]], [5.4, 'head', [0.0, -0.1, 0.3]]], { head: [0.2, 0, 0.0], tilt: [[0, 0], [2.0, 0.3]] });
  mk('lire',      'livre',     'l', 'asl-bent-b', [[2.5, 'head', [0.0, -0.2, 0.28]], [6.0, 'head', [0.0, -0.2, 0.28]]], { head: [0.22, 0, 0], face: ['relaxed', 0.4], tilt: [[0, 0], [2.0, 0.35]] });
  mk('fleur',     'fleur',     'r', 'pince',      [[2.4, 'head', [0.02, -0.15, 0.2]], [3.9, 'head', [0.02, -0.15, 0.2]]], { head: [0.12, 0, 0.1], face: ['happy', 0.6], tilt: [[0, 0], [2.0, 0.5]] });
  mk('ecrire',    'stylo',     'r', 'pince',      [[2.4, 'hips', [0.12, 0.08, 0.32]], [3.0, 'hips', [0.16, 0.08, 0.31]], [3.6, 'hips', [0.12, 0.08, 0.33]], [4.2, 'hips', [0.17, 0.08, 0.31]], [5.0, 'hips', [0.13, 0.08, 0.33]]], { head: [0.3, 0, 0], tilt: [[0, 0.5]] });
  mk('maquillage','miroir',    'l', 'asl-c',      [[2.4, 'head', [-0.02, -0.12, 0.24]], [5.5, 'head', [-0.02, -0.12, 0.24]]], { head: [0.0, 0.0, 0.0], tilt: [[0, 0], [2.0, 0.15]] });
  Object.assign(GLIB_FR, { 'boit': 'boire', 'bois': 'boire', 'verre': 'boire', 'cafe': 'cafe', 'café': 'cafe', 'the': 'cafe', 'thé': 'cafe', 'bouteille': 'eau', 'telephone': 'telephone', 'téléphone': 'telephone', 'portable': 'telephone', 'lis': 'lire', 'lit': 'lire', 'livre': 'lire', 'lecture': 'lire', 'sent-une-fleur': 'fleur', 'fleur': 'fleur', 'ecris': 'ecrire', 'écris': 'ecrire', 'ecrit': 'ecrire', 'carnet': 'ecrire', 'miroir': 'maquillage', 'maquille': 'maquillage' });
})();

/* ================= TOUCHER : ses mains se posent sur son propre corps (n'importe quelle zone), caresse, tapote, tient ================= */
const SOLE_K = { hips: [-0.15, 0, 0], spine: [0.6, 0, 0], chest: [0.4, 0, 0], neck: [-0.3, 0, 0], lUpLeg: [-1.55, 0, 0], lLowLeg: [0.05, 0, 0], rUpLeg: [-1.3, 0, 0.5], rLowLeg: [2.0, 0, 0] };   // assise au sol, jambe gauche devant ; la jambe droite est ensuite POSÉE par IK (def.legPlace) : cheville sur la cuisse gauche, genou vers l'extérieur
const FOOTLOC = { r: null };
const SEAT_KNEE = { hips: [-0.15, 0, 0], spine: [0.55, 0, 0.1], chest: [0.35, 0, 0.12], neck: [-0.25, 0, 0], lUpLeg: [-1.55, 0, -0.2], lLowLeg: [0.05, 0, 0], rUpLeg: [-2.05, 0, 0.3], rLowLeg: [2.2, 0, 0] };   // assise, genou droit relevé, pied à plat
const SEAT_K = { hips: [-0.15, 0, 0], spine: [0.45, 0, 0.08], chest: [0.3, 0, 0.12], neck: [-0.25, 0, 0], lUpLeg: [-1.55, 0, -0.28], lLowLeg: [0.05, 0, 0], rUpLeg: [-1.55, 0, 0.28], rLowLeg: [0.05, 0, 0] };   // assise au sol, jambes devant un peu ouvertes   // axes locaux du pied (orteils, plante), mesurés une fois debout
const ZONES = {   // [ancre, [x droite, y haut, z avant] pour la main droite, plan de la caresse [axeA, axeB], pôle du coude]
  joue: ['head', [0.05, 0.0, 0.055], [1, 2], [0.6, -1, 0]], menton: ['head', [0.0, -0.05, 0.10], [0, 2], [0.6, -1, 0.2]], levres: ['head', [0.0, -0.028, 0.115], [0, 1], [0.5, -1, 0.1]],
  cou: ['head', [0.04, -0.10, 0.02], [1, 2], [0.8, -1, -0.2]], nuque: ['head', [0.02, -0.07, -0.12], [0, 1], [0.8, -1, -0.5]], cheveux: ['head', [0.055, 0.10, -0.01], [1, 2], [1, 0.1, -0.2]],
  epaule: ['sh', [0.12, 0.03, 0.05], [0, 2], [0.6, -1, 0.4]], soussein: ['sh', [-0.10, -0.245, 0.175], [0, 2], [1, -1, 0.2], { fdir: [0.15, 0.25, 1] }],
  poitrine: ['sh', [-0.11, -0.178, 0.275], [0, 1], [1, -0.8, 0]], ventre: ['hips', [0.03, 0.15, 0.13], [0, 1], [1, -0.6, 0]],
  taille: ['hips', [0.15, 0.10, 0.0], [1, 2], [1, -0.2, -0.6]], hanche: ['hips', [0.175, 0.0, 0.02], [1, 2], [1, -0.2, -0.6]], fesse: ['hips', [0.10, -0.06, -0.15], [0, 1], [1, -0.3, -1], { lean: 0.4 }],
  cuisse: ['hips', [0.22, -0.20, 0.09], [1, 2], [1, -0.5, 0], { lean: 0.9 }], cheville: ['chvD', [0.03, 0.03, -0.01], [0, 1], [1, -0.6, -0.6], { hand: 'r', grip: 1 }],
  // pied (dessus) : Meissner + Pacini très denses, top-3 des zones chatouilleuses (gargalesis) — accroupie comme pour la cheville
  pied: ['chvD', [0.04, -0.08, 0.03], [0, 2], [1, -0.6, -0.6], { hand: 'r', crouch: 1, tip: 1, out: [1, 0.3, 0.3] }],   // cou-de-pied externe, accroupie, BOUT DES DOIGTS : en squat profond le mollet frôle le cou-de-pied — pas la place d'une paume (vérifié : elle remontait sur le mollet) ; un humain y passe les doigts ; out = direction d'extérieur d'auteur (la règle « loin des hanches » pointerait vers le bas)
  // plante du pied : assise au sol, pied droit ramené sur la cuisse gauche, plante tournée vers le haut — la pose que prend un humain pour masser ou chatouiller sa plante
  plante: ['plD', [0, 0, 0], [0, 2], [1, -0.6, -0.3], { hand: 'l', sole: 1 }],
  cuisseint: ['cuD', [0, 0, 0], [1, 2], [1, -0.6, -0.2], { hand: 'r', seat: 1 }],
  mollet: ['mlD', [0, 0, 0], [1, 2], [1, -0.6, -0.2], { hand: 'r', seat: 'genou' }],   // assise, genou droit relevé, la main sur le mollet
  coude: ['cdL', [0, 0.02, -0.01], [0, 1], [1, -0.8, 0.3], { hand: 'r' }],             // coude gauche, bras présenté comme pour l'avant-bras
  dos: ['hips', [0.08, 0.24, -0.135], [0, 1], [1, -0.4, -1]],                          // milieu du dos : la main passe derrière, plus haut que les reins
  aine: ['hips', [0.105, -0.07, 0.1], [0, 1], [1, -0.3, 0.2], { out: [0.35, -0.45, 1] }],   // pli de l'aine (entre la cuisse et le ventre, sur le côté)   // intérieur de la cuisse : assise au sol, jambes un peu ouvertes, main droite à mi-cuisse   // la plante regarde vers la GAUCHE : c'est la main gauche qui la touche, la droite tient le pied
  // aisselle : nerf intercostobrachial, peau fine, zone chatouilleuse n°1 — la main droite croise vers l'aisselle GAUCHE, le bras gauche se lève (main derrière la tête) pour l'exposer
  aisselle: ['sh', [-0.13, -0.045, 0.02], [1, 2], [0.6, -1, 0.3], { hand: 'r', raise: 1 }],
  genou: ['hips', [0.11, -0.40, 0.13], [0, 1], [1, -0.5, 0], { lean: 1.8 }],
  bras: ['sh', [-0.2, -0.2, 0.13], [1, 2], [1, -0.8, 0.2]],
  // zones fines du visage : contact du BOUT DE L'INDEX (tip), pas de la paume
  oeil: ['head', [0.028, 0.025, 0.105], [0, 1], [0.6, -1, 0.1], { tip: 1 }], nez: ['head', [0.0, -0.002, 0.125], [0, 1], [0.5, -1, 0.1], { tip: 1 }],
  oreille: ['head', [0.085, 0.038, -0.001], [0, 1], [0.8, -1, -0.2], { tip: 1 }], machoire: ['head', [0.045, -0.045, 0.06], [1, 2], [0.6, -1, 0], { tip: 1 }],
  front: ['head', [0.01, 0.075, 0.105], [0, 1], [0.6, -1, 0]], tempe: ['head', [0.055, 0.045, 0.05], [0, 1], [0.8, -1, -0.1]],
  crane: ['head', [0.01, 0.12, 0.01], [0, 2], [1, -0.6, -0.3]],
  reins: ['hips', [0.06, 0.13, -0.145], [0, 1], [1, -0.4, -1]],                       // bas du dos : la main passe derrière
  // l'autre bras (ancres mobiles : la cible bouge avec le bras gauche) — toujours touché par la main droite
  avantbras: ['avbL', [0, 0.025, 0], [0, 2], [1, -0.8, 0.3], { hand: 'r' }], poignet: ['poigL', [0, 0.025, 0], [0, 1], [1, -0.8, 0.2], { hand: 'r' }],
  main: ['mainL', [0, 0.02, 0], [0, 2], [1, -0.8, 0.2], { hand: 'r' }],
};
const TOUCH_STYLES = { caresse: { shape: 'main-detendue', r: 0.025, fr: 1.5, force: 0.08 }, tapote: { shape: 'main-detendue', r: 0.012, fr: 11, force: 0.25 }, pose: { shape: 'main-detendue', r: 0, fr: 0, force: 0.15 }, masse: { shape: 'asl-bent-5', r: 0.018, fr: 5, force: 0.55 },
  gratte: { shape: 'asl-bent-5', r: 0.015, fr: 13, force: 0.35 }, frotte: { shape: 'main-detendue', r: 0.02, fr: 6.5, force: 0.45 }, chatouille: { shape: 'asl-bent-5', r: 0.013, fr: 16, force: 0.12 },
  pince: { shape: 'pinch', r: 0, fr: 0, force: 0.7 }, porter: { shape: 'main-detendue', r: 0, fr: 0, force: 0.3 }, lever: { shape: 'tasse', r: 0, fr: 0, force: 0.25 }, fessee: { shape: 'main-detendue', r: 0, fr: 0, force: 0.85, impact: 1 }, claque: { shape: 'main-detendue', r: 0, fr: 0, force: 0.8, impact: 1 }, tape: { shape: 'main-detendue', r: 0, fr: 0, force: 0.45, impact: 1 } };    // force : 0,08 = effleurement, 0,55 = massage appuyé, 1 = coup. claque/fessée/gifle/coup : actions d'impact, à part (vitesse + choc)
/* Sensibilité du corps, zone par zone, d'après les mesures publiées : acuité tactile (discrimination de deux points : lèvres 2-4 mm,
   doigts 2-8 mm, paume 8-12 mm, front ~15 mm, avant-bras ~35 mm, dos ~39 mm, mollet ~45 mm — le visage et les mains sentent tout,
   le dos presque rien) ; plaisir (cartes des zones érogènes, ~800 à 700 personnes interrogées : poitrine en tête hors organes, puis lèvres,
   nuque/cou, oreilles, intérieur des cuisses, fesses, bas du dos ; pareil chez hommes et femmes) ; chatouilles (plante des pieds, flancs/côtes,
   aisselles, ventre, creux du genou, paumes) ; douleur (yeux et lèvres très innervés, oreille et cheveux sensibles à la traction, dos peu).
   Chaque canal va de 0 à 1. Utilisé pour choisir la réaction (visage, voix, sursaut) et bientôt l'événement envoyé au cerveau. */
const SENSI = {
  levres: { tact: 1.0, pla: 0.85, cha: 0.1, dou: 0.9 }, oeil: { tact: 0.9, pla: 0.05, cha: 0.1, dou: 1.0 }, nez: { tact: 0.7, pla: 0.1, cha: 0.2, dou: 0.6 },
  oreille: { tact: 0.6, pla: 0.75, cha: 0.35, dou: 0.8 }, joue: { tact: 0.7, pla: 0.5, cha: 0.15, dou: 0.4 }, menton: { tact: 0.6, pla: 0.3, cha: 0.1, dou: 0.3 },
  front: { tact: 0.55, pla: 0.2, cha: 0.1, dou: 0.4 }, tempe: { tact: 0.55, pla: 0.35, cha: 0.1, dou: 0.5 }, crane: { tact: 0.35, pla: 0.55, cha: 0.05, dou: 0.5 },
  cheveux: { tact: 0.3, pla: 0.6, cha: 0.05, dou: 0.9 }, cou: { tact: 0.6, pla: 0.85, cha: 0.55, dou: 0.6 }, nuque: { tact: 0.55, pla: 0.8, cha: 0.5, dou: 0.5 },
  epaule: { tact: 0.35, pla: 0.45, cha: 0.15, dou: 0.3 }, poitrine: { tact: 0.45, pla: 0.95, cha: 0.2, dou: 0.75 }, soussein: { tact: 0.45, pla: 0.95, cha: 0.2, dou: 0.75 }, ventre: { tact: 0.4, pla: 0.5, cha: 0.7, dou: 0.5 },
  taille: { tact: 0.35, pla: 0.55, cha: 0.95, dou: 0.4 }, hanche: { tact: 0.35, pla: 0.6, cha: 0.5, dou: 0.35 }, fesse: { tact: 0.3, pla: 0.8, cha: 0.2, dou: 0.5 },
  reins: { tact: 0.25, pla: 0.65, cha: 0.3, dou: 0.3 }, cuisse: { tact: 0.3, pla: 0.8, cha: 0.5, dou: 0.4 }, genou: { tact: 0.3, pla: 0.2, cha: 0.6, dou: 0.5 },
  bras: { tact: 0.35, pla: 0.45, cha: 0.3, dou: 0.3 }, avantbras: { tact: 0.35, pla: 0.45, cha: 0.35, dou: 0.3 }, poignet: { tact: 0.6, pla: 0.4, cha: 0.4, dou: 0.4 },
  main: { tact: 0.9, pla: 0.4, cha: 0.5, dou: 0.5 }, pied: { tact: 0.7, pla: 0.5, cha: 1.0, dou: 0.6 }, plante: { tact: 0.75, pla: 0.5, cha: 1.0, dou: 0.6 }, coude: { tact: 0.2, pla: 0.2, cha: 0.3, dou: 0.45 }, dos: { tact: 0.25, pla: 0.55, cha: 0.3, dou: 0.3 }, mollet: { tact: 0.3, pla: 0.35, cha: 0.35, dou: 0.35 },
  cuisseint: { tact: 0.45, pla: 0.85, cha: 0.55, dou: 0.45 }, aine: { tact: 0.45, pla: 0.8, cha: 0.6, dou: 0.45 }, aisselle: { tact: 0.4, pla: 0.4, cha: 0.95, dou: 0.4 },   /* intérieur des cuisses, aine : parmi les zones les plus citées dans les cartes de plaisir (Turnbull 2014, Nummenmaa 2016) ; peau fine, chatouilleuse */
};
/* Ce que ça lui fait, comme chez un humain : chaque canal dépend de la zone, de la manière, de la FORCE et de la VITESSE.
   - plaisir : maximal pour un effleurement LENT (1-10 cm/s, pic ~3 cm/s — fibres CT de la peau), sur une zone qui s'y prête ; trop fort ou trop vite = plus rien
   - douleur : au-delà du seuil de la zone, elle monte en puissance de la force (loi de Stevens) : pincer un peu = rien, pincer fort = mal, très fort = très mal
   - chatouille : contact léger, rapide, irrégulier, sur une zone chatouilleuse
   - frisson : caresse lente sur nuque/cou/oreille/bras → chair de poule, petit tremblement d'épaules */
function touchSense(zone, style, force, vReal) {   // vReal : vitesse RÉELLE du doigt sur la peau (cm/s), quand on la mesure (ton toucher) — sinon celle du style
  const S = SENSI[zone] || { tact: 0.3, pla: 0.3, cha: 0.2, dou: 0.4 }, St = TOUCH_STYLES[style] || {}, F = force ?? St.force ?? 0.2;
  const v = vReal != null ? vReal : (St.r || 0) * (St.fr || 0) * 100;                                       // vitesse de la main sur la peau, en cm/s
  const lent = Math.exp(-Math.pow(Math.log((v + 0.5) / 3.5), 2) / 1.6);             // cloche centrée sur ~3,5 cm/s (0 à l'arrêt complet comme à grande vitesse)
  const plaisir = S.pla * Math.max(style === 'pose' ? 0.25 : 0, lent) * Math.max(0, 1 - Math.pow(F / 0.6, 2));
  const seuil = 0.45 - 0.25 * S.dou;                                                // zone fragile = seuil bas
  const douleur = F > seuil ? S.dou * Math.min(1, Math.pow((F - seuil) / (1 - seuil), 1.6)) : 0;
  const chatouille = S.cha * (v > 8 ? 1 : v / 8) * Math.max(0, 1 - F / 0.4);        // PAS de facteur d'acuité : la recherche a écarté la finesse de peau comme explication du chatouillement (les zones les plus chatouilleuses — aisselle, plante — ne sont pas les plus fines) ; c'est la carte S.cha qui porte tout
  const frisson = plaisir > 0.45 && /nuque|cou|oreille|bras|avantbras|crane|cheveux|reins/.test(zone) ? Math.min(1, plaisir + 0.2) : 0;
  return { plaisir: +plaisir.toFixed(2), douleur: +douleur.toFixed(2), chatouille: +chatouille.toFixed(2), frisson: +frisson.toFixed(2), force: F, vitesse_cm_s: +v.toFixed(1), S };
}
let lastTouch = null;                                   // dernier ressenti (pour le cerveau, la voix, les tests)
function touchFeel(zone, style) {                 // réaction au toucher : la zone et la manière décident du visage (le corps et la voix suivront)
  const S = SENSI[zone] || { tact: 0.3, pla: 0.3, cha: 0.2, dou: 0.4 };
  if (zone === 'oeil') return { face: ['relaxed', 1.0], feel: 'delicat', S };                                            // paupière : œil qui se ferme
  if (style === 'chatouille' || ((style === 'tapote' || style === 'gratte') && S.cha > 0.65)) return { face: ['happy', 0.95], feel: 'chatouille', S };
  if ((style === 'caresse' || style === 'masse' || style === 'frotte') && S.pla > 0.7) return { face: ['relaxed', 0.9], feel: 'plaisir', S };
  if (style === 'gratte') return { face: ['neutral', 0.4], feel: 'soulagement', S };
  return { face: ['relaxed', 0.6], feel: 'neutre', S };
}
const ZONE_FR = { oeil: 'oeil', yeux: 'oeil', paupiere: 'oeil', 'paupière': 'oeil', nez: 'nez', narine: 'nez', oreille: 'oreille', oreilles: 'oreille', front: 'front', tempe: 'tempe', tempes: 'tempe', crane: 'crane', 'crâne': 'crane', 'tête': 'crane', tete: 'crane', machoire: 'machoire', 'mâchoire': 'machoire', reins: 'reins', dos: 'reins', 'avant-bras': 'avantbras', avantbras: 'avantbras', 'sous-sein': 'soussein', soussein: 'soussein', poignet: 'poignet', main: 'main', joue: 'joue', joues: 'joue', menton: 'menton', levres: 'levres', 'lèvres': 'levres', bouche: 'levres', cou: 'cou', nuque: 'nuque', cheveux: 'cheveux', epaule: 'epaule', 'épaule': 'epaule', epaules: 'epaule', poitrine: 'poitrine', seins: 'poitrine', ventre: 'ventre', taille: 'taille', hanche: 'hanche', hanches: 'hanche', fesse: 'fesse', fesses: 'fesse', croupe: 'fesse', cuisse: 'cuisse', cuisses: 'cuisse', genou: 'genou', cheville: 'cheville', chevilles: 'cheville', pied: 'cheville', bras: 'bras' };
const TOUCH_VERB = { fesse: 'fessee', fessee: 'fessee', 'fessée': 'fessee', claque: 'claque', gifle: 'claque', tape: 'tape', caresse: 'caresse', caresses: 'caresse', touche: 'pose', pose: 'pose', tapote: 'tapote', frotte: 'frotte', frottetoi: 'frotte', masse: 'masse', effleure: 'caresse', serre: 'pose', gratte: 'gratte', grattes: 'gratte', chatouille: 'chatouille', chatouilles: 'chatouille' };
function legPlaceApply(def, gt, w, b) {   // appelé AVANT le calcul des ancres : sinon la plante était lue sur la pose d'avant l'IK (normale à l'envers, vu)
  if (def.legPlace && b.rUpLeg && b.rLowLeg && b.rFoot && b.lUpLeg && b.lLowLeg) {   // DEMI-TAILLEUR : la cheville droite se POSE sur la cuisse gauche (IK, recette « poser un pied » des jeux), genou ouvert vers l'extérieur
    const lw = Math.max(0, Math.min(1, (gt - 0.4) / 0.9, (def.dur - 0.5 - gt) / 0.9)) * w;
    if (lw > 0.005) {
      const A = b.lUpLeg.getWorldPosition(new THREE.Vector3()), K = b.lLowLeg.getWorldPosition(new THREE.Vector3());
      const T = A.lerp(K, 0.55).addScaledVector(_bf.Y, window.__lpY ?? 0.11).addScaledVector(_bf.X, window.__lpX ?? 0.0);   // sur le dessus de la cuisse gauche
      const pole = new THREE.Vector3().addScaledVector(_bf.X, 1).addScaledVector(_bf.Y, -0.3).addScaledVector(_bf.Z, 0.35).normalize();   // genou vers SA droite, un peu bas et devant
      b.rFoot.getWorldQuaternion(_ik.w); const keepF = _ik.w.clone();
      armIK(b.rUpLeg, b.rLowLeg, b.rFoot, T, pole, lw);
      b.rFoot.parent.getWorldQuaternion(_ik.w); b.rFoot.quaternion.copy(_ik.w.invert().multiply(keepF)); b.rFoot.updateWorldMatrix(false, false);
      if (FOOTLOC.r) {                                                         // orientation : orteils vers l'avant, plante vers le haut et vers SA gauche (là où arrive la main gauche)
        const fq = b.rFoot.getWorldQuaternion(new THREE.Quaternion()), t1 = FOOTLOC.r.t.clone().applyQuaternion(fq), s1 = FOOTLOC.r.s.clone().applyQuaternion(fq);
        const su = window.__lpS ?? 0.65, s2 = new THREE.Vector3().addScaledVector(_bf.X, -Math.sqrt(1 - su * su)).addScaledVector(_bf.Y, su).normalize();
        const t2 = _bf.Z.clone().addScaledVector(s2, -_bf.Z.dot(s2)).normalize();
        s1.addScaledVector(t1, -s1.dot(t1)).normalize();
        const m = new THREE.Matrix4(), q1 = new THREE.Quaternion().setFromRotationMatrix(m.makeBasis(t1, s1, t1.clone().cross(s1))), q2 = new THREE.Quaternion().setFromRotationMatrix(m.makeBasis(t2, s2, t2.clone().cross(s2)));
        const R = new THREE.Quaternion().slerp(q2.multiply(q1.invert()), lw);
        const nq = R.multiply(fq); b.rFoot.parent.getWorldQuaternion(_ik.w); b.rFoot.quaternion.copy(_ik.w.invert().multiply(nq)); b.rFoot.updateWorldMatrix(false, false);
      }
    }
  }
}
function touchDef(zone, style, hand, force) {
  const Z = ZONES[zone], St = TOUCH_STYLES[style] || TOUCH_STYLES.caresse; if (!Z) return null;
  const opt = Z[4] || {}, feel = touchFeel(zone, style), sense = touchSense(zone, style, force != null ? +force : undefined);
  if ((TOUCH_STYLES[style] || {}).impact && sense.douleur > 0.3) feel.face = ['angry', Math.min(1, 0.3 + sense.douleur)];   // impact : visage au moment du choc ; sinon, le visage suit le ressenti CONTINU (tlSelfFeel)
  else feel.face = null;
  const deux = hand === 'lr';                                                          // les DEUX mains, chacune sur son côté (porter sa poitrine…)
  const hk = deux ? 'r' : (opt.hand || hand || (Z[1][0] < 0 ? 'l' : 'r')), side = hk === 'r' ? 1 : -1, o = Z[1].slice(); if (Z[1][0] < 0 && (hk === 'l' || deux)) o[0] = -o[0];
  const shape = opt.tip ? 'point' : St.shape;                                          // zone fine : index tendu, contact du bout du doigt
  const dur = 5.5, def = { dur, blend: true, touch: true, touchTip: !!opt.tip, touchZone: zone, touchStyle: style, touchOut: o.slice(0, 3), touchAnchor: Z[0], touchGlide: !!St.r, touchHand: deux ? 'lr' : hk, touchFdir: opt.fdir || null, touchExt: opt.out || null, feel: feel.feel, sensi: feel.S,
    head: [0.03, 0, (zone === 'joue' ? 0.12 : 0.02) * side], face: feel.face, sense };
  for (const h2 of (deux ? ['l', 'r'] : [hk])) {
    def[h2] = [[0, 'sh', [0.2, -0.4, 0.05]], [0.9, Z[0], o], [dur - 1.3, Z[0], o], [dur, 'sh', [0.2, -0.4, 0.05]]];
    def[h2 + 'Pole'] = Z[3]; def[h2 + 'Hand'] = [[0, 'open'], [0.7, shape], [dur - 1.2, 'open']];
  }
  if (/^(avbL|poigL|mainL|cdL)$/.test(Z[0])) def.l = [[0, 'sh', [0.2, -0.4, 0.05]], [0.8, 'hips', [-0.14, 0.26, 0.30]], [dur - 1.2, 'hips', [-0.14, 0.26, 0.30]], [dur, 'sh', [0.2, -0.4, 0.05]]];   // le bras gauche se présente devant le buste, décollé du ventre
  lastTouch = { zone, style, t: Date.now(), ...sense };
  if (sense.douleur > 0.15) def.flinch = { t: 0.95, amp: Math.min(1, 0.25 + sense.douleur) };   // plus ça fait mal, plus le sursaut est fort
  if (St.impact) {                                                           // IMPACT (fessée, claque) : la main part en arrière, frappe VITE, repart — et la chair encaisse le choc
    def.dur = 3.4;
    for (const h2 of (deux ? ['l', 'r'] : [hk])) {
      const lift = o.slice(); lift[1] += 0.16; lift[0] += 0.10;              // armé : main levée en retrait au-dessus de la zone
      def[h2] = [[0, 'sh', [0.2, -0.4, 0.05]], [0.55, Z[0], lift], [0.82, Z[0], o], [1.15, Z[0], lift], [def.dur, 'sh', [0.2, -0.4, 0.05]]];
      def[h2 + 'Hand'] = [[0, 'open'], [0.4, 'main-detendue'], [def.dur - 1.0, 'open']];
    }
    def.touchWin = [0.72, 1.05];                                             // le contact de surface n'agit qu'à la frappe
    def.impactAt = 0.82; def.impactForce = St.force * (force != null ? +force / St.force : 1);
    def.flinch = { t: 0.86, amp: Math.min(1.3, 0.45 + sense.douleur + St.force * 0.4) };
  }
  if (St.r) def.circ = [Z[2][0], Z[2][1], St.r * (opt.tip ? 0.7 : 1), St.fr];
  if (opt.raise && !deux) {                                                  // AISSELLE : le bras du côté touché se LÈVE (main derrière la tête) pour exposer le creux, comme un humain
    const oh = hk === 'r' ? 'l' : 'r';
    def[oh] = [[0, 'sh', [0.2, -0.4, 0.05]], [0.9, 'head', [0.17, 0.16, -0.03]], [dur - 1.2, 'head', [0.17, 0.16, -0.03]], [dur, 'sh', [0.2, -0.4, 0.05]]];
    def[oh + 'Pole'] = [1, 0.6, -0.4]; def[oh + 'Hand'] = [[0, 'open'], [0.8, 'main-detendue']];
  }
  if (sense.chatouille > 0.55 && !St.impact) { def.flinch = def.flinch || { t: 1.15, amp: Math.min(0.8, 0.25 + sense.chatouille * 0.4) }; }   // gargalesis (aisselle, pied) : torsion-rire + retrait réflexe — réflexe protecteur (Harvard/Darwin)
  if (opt.seat) {                                                            // ASSISE AU SOL, jambes devant un peu ouvertes, buste penché : la main va naturellement sur l'intérieur de la cuisse
    const k = window.__seatK || (opt.seat === 'genou' ? SEAT_KNEE : SEAT_K);
    def.dur = 6.5; def.fk = [[0, {}], [1.3, k], [def.dur - 1.3, k], [def.dur, {}]]; def.ground = 1;
    def[hk] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.5, Z[0], o], [def.dur - 1.3, Z[0], o], [def.dur, 'sh', [0.2, -0.4, 0.05]]];
    const oh = hk === 'l' ? 'r' : 'l'; def[oh] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.3, 'hips', [0.2, -0.08, -0.12]], [def.dur - 1.3, 'hips', [0.2, -0.08, -0.12]], [def.dur, 'sh', [0.2, -0.4, 0.05]]];   // l'autre main en appui derrière, au sol
    def.touchWin = [1.3, def.dur - 0.85];
  }
  if (opt.sole) {                                                            // ASSISE AU SOL, pied ramené (pose réglable par window.__soleK pendant les essais)
    const k = window.__soleK || SOLE_K;
    def.dur = 7.0; def.fk = [[0, {}], [1.3, k], [def.dur - 1.3, k], [def.dur, {}]]; def.ground = 1;
    def[hk] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.5, Z[0], o], [def.dur - 1.3, Z[0], o], [def.dur, 'sh', [0.2, -0.4, 0.05]]];
    def.legPlace = 1;
    const oh = hk === 'l' ? 'r' : 'l'; def[oh] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.3, 'dosD', [0, 0.05, 0]], [def.dur - 1.3, 'dosD', [0, 0.05, 0]], [def.dur, 'sh', [0.2, -0.4, 0.05]]]; def.touchXB = 1;   // l'autre main tient la cheville (comme un humain qui se masse la plante)
    def.touchWin = [1.2, def.dur - 0.85];
  }
  if ((opt.grip || opt.crouch) && Z[0] === 'chvD') {                                         // ATTRAPER SA CHEVILLE : penchée profonde (vérifié : la jambe levée reste hors de portée du bras — 0,77 m au mieux pour 0,47 m de bras ; l'humain se penche aussi)
    const k = { spine: [opt.crouch ? 1.05 : 0.9, 0, 0.1], chest: [opt.crouch ? 0.8 : 0.55, 0, opt.crouch ? 0.18 : 0.05], hips: [0.6, 0, 0],   // pied : buste plus enroulé et penché vers la droite (mesuré : bras tendu à 99,7 % de sa longueur, la pulpe dérivait de 10 mm)
    lUpLeg: [-1.95, 0, 0], rUpLeg: [-1.95, 0, 0], lLowLeg: [2.25, 0, 0], rLowLeg: [2.25, 0, 0], neck: [-0.55, 0, 0] };   // ACCROUPIE penchée : c'est comme ça qu'on attrape sa cheville (le bassin descend aux talons, l'épaule arrive à portée)
    def.dur = 7.0; def.fk = [[0, {}], [1.1, k], [def.dur - 1.3, k], [def.dur, {}]]; def.ground = 1;
    def[hk] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.3, Z[0], o], [def.dur - 1.3, Z[0], o], [def.dur, 'sh', [0.2, -0.4, 0.05]]];
    def[hk + 'Hand'] = [[0, 'open'], [1.2, opt.grip ? 'tasse' : shape], [def.dur - 1.2, 'open']];   // saisir = tasse ; toucher/caresser le pied = la forme du style
    def.l = [[0, 'sh', [0.2, -0.4, 0.05]], [1.1, 'hips', [0.16, -0.28, 0.28]], [def.dur - 1.3, 'hips', [0.16, -0.28, 0.28]], [def.dur, 'sh', [0.2, -0.4, 0.05]]];   // la main libre s'appuie sur le genou (équilibre naturel)
    def.touchWin = [1.0, def.dur - 0.85];
    if (style === 'lever') {                                                 // « attraper sa jambe et la LEVER d'une main » : elle saisit accroupie, se redresse, la MAIN porte la cheville devant — la JAMBE SUIT la main (chaîne fermée, jambe esclave)
      def.dur = 10.0;
      const kup = { spine: [-0.12, 0, 0.06], chest: [-0.06, 0, 0], hips: [-0.05, 0, 0], lUpLeg: [-0.05, 0, 0], neck: [0.08, 0, 0] };   // debout, buste léger en arrière (contre-poids)
      def.fk = [[0, {}], [1.1, k], [3.0, k], [4.6, kup], [def.dur - 1.5, kup], [def.dur, {}]];
      def[hk] = [[0, 'sh', [0.2, -0.4, 0.05]], [1.3, Z[0], o], [3.0, Z[0], o], [4.6, 'hips', [0.14, -0.18, 0.42]], [def.dur - 1.5, 'hips', [0.14, -0.18, 0.42]], [def.dur, 'sh', [0.2, -0.4, 0.05]]];
      def[hk + 'Hand'] = [[0, 'open'], [1.2, 'tasse'], [def.dur - 1.2, 'open']];
      def.touchWin = [1.0, 3.2];                                             // le toucher actif ne sert qu'à FERMER la prise ; ensuite l'offset conservé garantit le contact (sinon le différé tirait la main vers la jambe-esclave : personne ne menait, vu)
      def.legFollow = { a: 3.0, hk };                                        // dès la saisie faite, la jambe droite est ESCLAVE de la main
    }
  } else if (opt.lean) {                                                     // zone basse (genou…) : elle se penche pour l'atteindre, comme un humain
    const L = opt.lean, k = { spine: [L * 0.5, 0, 0], chest: [L * 0.35, 0, 0], hips: [L * 0.35, 0, 0], lUpLeg: [-L * 0.55, 0, 0], rUpLeg: [-L * 0.55, 0, 0], lLowLeg: [L * 0.35, 0, 0], rLowLeg: [L * 0.35, 0, 0], neck: [-L * 0.3, 0, 0] };
    if (opt.spread) { k.rUpLeg[2] += opt.spread; k.lUpLeg[2] -= opt.spread; }   // jambes écartées : les cuisses pleines se touchent, la main n'entre pas sinon (vu : paume bloquée à 12 cm, doigts dans la cuisse)
    def.fk = [[0, {}], [0.9, k], [dur - 1.3, k], [dur, {}]]; def.ground = 1;
  }
  return def;
}
function touchPlay(zone, style, hand, force) {
  const d = touchDef(zone, style, hand, force); if (!d) return false;
  const name = 'touch:' + zone + ':' + style + (hand ? ':' + hand : ''); GLIB[name] = d; return playGesture(name);
}
function touchParse(t) {                                   // « caresse-toi le ventre », « touche ta joue », « tapote tes cuisses »
  const n = ' ' + _nrm(t).replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ') + ' '; let verb = null, zone = null;
  for (const k in TOUCH_VERB) if (n.includes(' ' + k + ' ') || n.includes(' ' + k + 'toi ') || n.includes(' ' + k + '-toi ')) { verb = TOUCH_VERB[k]; break; }
  if (!verb) return null;
  for (const k in ZONE_FR) if (n.includes(' ' + _nrm(k) + ' ')) { zone = ZONE_FR[k]; break; }
  return zone ? ['touch:' + zone + ':' + verb] : null;
}

/* ================= CAMÉRA INTELLIGENTE : cadre selon ce qu'elle fait (danse = plan large qui tourne, objets/mains = buste, parole = buste) ================= */
const AUTOCAM = { lastMode: 0, on: store.get('aiko.autocam', '1') !== '0', saved: null, lastUser: 0, mode: '' };
function autoCamUpdate(dt) {
  if (window.__noautocam) return;                                            // épreuves : la caméra reste où le test l'a mise
  const A = AUTOCAM, now = performance.now();
  if (!A.on || LESSON.on || currentPose === 'bed' || document.hidden || !vrm) { CAM.slow = false; return; }
  if (now - A.lastUser < 9000) { CAM.slow = false; return; }
  const g = gst, k = body.k || 1, tt = now / 1000;
  let mode = '';
  if (g && g.clip && !/saut|jump/i.test(g.name)) mode = 'danse';
  else if (g && g.lib && (g.lib.eat || (g.lib.faceSeq && !g.lib.prop))) mode = 'bouche';   // elle mange, lèche, tire la langue : gros plan sur le visage
  else if (g && g.lib && g.lib.prop) mode = 'objet';
  else if (g && g.lib && (g.lib.l || g.lib.r) && !g.lib.legs) mode = 'mains';
  else if (g && g.lib && (g.lib.legs || g.lib.ground)) mode = 'danse';
  else if (mouthOn) mode = 'parole';
  if (mode && !A.saved) A.saved = { yaw: CAM.yaw, dist: CAM.dist, py: CAM.py, px: CAM.px, pitch: CAM.pitch };
  if (!mode) { if (A.saved && now - A.lastMode > 2500) { Object.assign(CAM, A.saved); A.saved = null; A.mode = ''; CAM.slow = true; } return; }
  A.lastMode = now; A.mode = mode; CAM.slow = true;
  const sw = A.saved ? A.saved.yaw : 0;
  if (mode === 'danse') { CAM.dist = 3.6 * k; CAM.py = -0.3 * k; CAM.px = 0; CAM.pitch = 0.06; CAM.yaw = sw + 0.5 * Math.sin(tt * 0.22); }
  else if (mode === 'objet') { CAM.dist = 1.9 * k; CAM.py = -0.02 * k; CAM.px = 0.08 * k; CAM.pitch = 0.04; CAM.yaw = sw + 0.35; }
  else if (mode === 'bouche') { let hy = 0.6 * k; try { hy = vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(_po).y - target.y; } catch (_) {} CAM.dist = 1.05 * k; CAM.py = hy - 0.07 * k; CAM.px = 0; CAM.pitch = 0.03; CAM.yaw = sw + 0.5; }
  else if (mode === 'mains') { CAM.dist = 2.0 * k; CAM.py = 0.02 * k; CAM.px = 0; CAM.pitch = 0.04; CAM.yaw = sw + 0.12 * Math.sin(tt * 0.3); }
  else { CAM.dist = 2.2 * k; CAM.py = 0.1 * k; CAM.px = 0; CAM.pitch = 0.04; CAM.yaw = sw + 0.1 * Math.sin(tt * 0.25); }
}
['pointerdown', 'wheel'].forEach((ev) => stage.addEventListener(ev, () => { AUTOCAM.lastUser = performance.now(); CAM.slow = false; }, { passive: true }));
(function () { const row = document.querySelector('[data-tab="reglages"]'); if (!row) return; const bt = document.createElement('button'); bt.className = 'chip' + (AUTOCAM.on ? ' on' : ''); bt.type = 'button'; bt.id = 'btn-autocam'; bt.textContent = 'Caméra auto';
  bt.onclick = () => { AUTOCAM.on = !AUTOCAM.on; bt.classList.toggle('on', AUTOCAM.on); store.set('aiko.autocam', AUTOCAM.on ? '1' : '0'); if (!AUTOCAM.on && AUTOCAM.saved) { Object.assign(CAM, AUTOCAM.saved); AUTOCAM.saved = null; } }; row.insertBefore(bt, row.firstChild); })();

/* Avant-bras et mains ne traversent jamais le tronc (poitrine comprise) : quelle que soit la source du mouvement (mocap, gestes, IK),
   on teste le long de l'avant-bras, et si un point est dans le volume du corps, le poignet est ramené de la profondeur correspondante. */
const _ak = { S: new THREE.Vector3(), E: new THREE.Vector3(), H: new THREE.Vector3(), P: new THREE.Vector3(), d: new THREE.Vector3(), best: new THREE.Vector3(), T: new THREE.Vector3(), pole: new THREE.Vector3() };
const _kd = { r: new THREE.Vector3(), l: new THREE.Vector3(), t: 0, h0: new THREE.Vector3(), d: new THREE.Vector3(), qu: new THREE.Quaternion(), ql: new THREE.Quaternion() };
let _simDt = 0.016;
function armKeepOut(b) {
  if (!bodyMap || !b.rArm || !b.lArm || !b.hips) return;
  rig.updateMatrixWorld(true);
  const dtk = Math.min(0.1, Math.max(0.004, _simDt));
  const kk = 1 - Math.exp(-dtk * 14);                           // la correction est lissée dans le temps : plus d'à-coups quand la surface du corps change de côté
  b.rArm.getWorldPosition(_bf.r); b.lArm.getWorldPosition(_bf.l);
  _bf.X.copy(_bf.r).sub(_bf.l).normalize();
  b.hips.getWorldQuaternion(_ik.w); _bf.Y.set(0, 1, 0).applyQuaternion(_ik.w);
  _bf.Y.addScaledVector(_bf.X, -_bf.Y.dot(_bf.X)).normalize();
  _bf.Z.crossVectors(_bf.Y, _bf.X).normalize();
  b.hips.getWorldPosition(_bf.anc.hips);
  for (const [up, lo, hand, ds, hk] of [[b.rArm, b.rLowArm, b.rHand, _kd.r, 'r'], [b.lArm, b.lLowArm, b.lHand, _kd.l, 'l']]) {
    if (!up || !lo || !hand || TOUCHW[hk] > 0.5) continue;                 // main posée volontairement sur la peau : on ne la repousse pas
    _kd.qu.copy(up.quaternion); _kd.ql.copy(lo.quaternion);
    hand.getWorldPosition(_kd.h0);
    up.getWorldPosition(_ak.S); lo.getWorldPosition(_ak.E); _ak.pole.copy(_ak.E).sub(_ak.S);
    const pole0 = _ak.pole.clone();
    for (let it = 0; it < 3; it++) {
      up.getWorldPosition(_ak.S); lo.getWorldPosition(_ak.E); hand.getWorldPosition(_ak.H);
      let mx = 0, mt = 1;
      for (const t of [0.4, 0.7, 1.0, 1.25]) {                   // milieu de l'avant-bras, poignet, paume
        _ak.P.copy(_ak.E).lerp(_ak.H, t); _ak.d.copy(_ak.P);
        pushOut(_ak.d, 0.022); _ak.d.sub(_ak.P);
        const l = _ak.d.length(); if (l > mx) { mx = l; mt = t; _ak.best.copy(_ak.d); }
      }
      if (mx < 0.003) break;
      _ak.T.copy(_ak.H).addScaledVector(_ak.best, 1 / Math.min(1, mt));
      _ak.pole.copy(_ak.E).sub(_ak.S);
      armIK(up, lo, hand, _ak.T, _ak.pole, 1);
    }
    hand.getWorldPosition(_ak.H); _kd.d.copy(_ak.H).sub(_kd.h0);      // correction brute de cette image
    const loc = new THREE.Vector3(_kd.d.dot(_bf.X), _kd.d.dot(_bf.Y), _kd.d.dot(_bf.Z));   // dans le repère du corps
    if (loc.length() > 0.2) loc.setLength(0.2);
    { const st = loc.sub(ds), l = st.length(), mx = 1.2 * dtk; if (l > mx) st.multiplyScalar(mx / l); ds.addScaledVector(st, Math.max(kk, l > mx ? 1 : kk)); }   // lissée ET bornée en vitesse (1,2 m/s) : la surface du corps peut changer de côté d'une image à l'autre, pas la main
    if (ds.length() < 0.0012) { up.quaternion.copy(_kd.qu); lo.quaternion.copy(_kd.ql); up.updateWorldMatrix(false, true); continue; }
    up.quaternion.copy(_kd.qu); lo.quaternion.copy(_kd.ql); up.updateWorldMatrix(false, true);
    _ak.T.copy(_kd.h0).addScaledVector(_bf.X, ds.x).addScaledVector(_bf.Y, ds.y).addScaledVector(_bf.Z, ds.z);
    armIK(up, lo, hand, _ak.T, pole0, 1);
  }
}
/* Repère du corps (X : vers SA droite, Y : haut, Z : avant) et ancres des zones — utilisables HORS des gestes (toucher par la personne) */
function bfFrame(b) {
  b.rArm.getWorldPosition(_bf.r); b.lArm.getWorldPosition(_bf.l);
  _bf.X.copy(_bf.r).sub(_bf.l).normalize();                              // vers SA droite
  b.hips.getWorldQuaternion(_ik.w); _bf.Y.set(0, 1, 0).applyQuaternion(_ik.w);
  _bf.Y.addScaledVector(_bf.X, -_bf.Y.dot(_bf.X)).normalize();
  _bf.Z.crossVectors(_bf.Y, _bf.X).normalize();                          // vers l'avant (son regard)
}
function bfAnchors(b) {
  b.head.getWorldPosition(_bf.anc.head); _bf.anc.sh.copy(_bf.r).add(_bf.l).multiplyScalar(0.5); b.hips.getWorldPosition(_bf.anc.hips);
  { b.head.getWorldQuaternion(_ik.w);                                     // repère de la TÊTE : les zones du visage (joue, nez, oreille…) suivent la tête quand elle tourne ou penche
    (_bf.hX || (_bf.hX = new THREE.Vector3())).set(-1, 0, 0).applyQuaternion(_ik.w);
    (_bf.hY || (_bf.hY = new THREE.Vector3())).set(0, 1, 0).applyQuaternion(_ik.w);
    (_bf.hZ || (_bf.hZ = new THREE.Vector3())).set(0, 0, 1).applyQuaternion(_ik.w); }
  if (b.rFoot) rawOf(b.rFoot).getWorldPosition(_bf.anc.chvD);                 // cheville droite (pour l'attraper)
  if (b.rFoot && b.rToes && b.rLowLeg) {                                      // PLANTE du pied droit : point et normale tirés de l'ORIENTATION RÉELLE de l'os du pied (vecteurs locaux mesurés une fois debout — sans supposer ses axes)
    const kn = rawOf(b.rLowLeg).getWorldPosition(_bf.tmp), to = rawOf(b.rToes).getWorldPosition(_bf.anc.plD);
    const fq = b.rFoot.getWorldQuaternion(_bf.fq || (_bf.fq = new THREE.Quaternion()));
    if (!FOOTLOC.r && kn.y - _bf.anc.chvD.y > 0.97 * kn.distanceTo(_bf.anc.chvD)) {   // debout, tibia vertical : la plante regarde le sol (-Y)
      const td = new THREE.Vector3().copy(to).sub(_bf.anc.chvD).normalize(), sd = new THREE.Vector3(0, -1, 0).addScaledVector(td, td.y).normalize(), iq = fq.clone().invert();
      FOOTLOC.r = { t: td.applyQuaternion(iq), s: sd.applyQuaternion(iq) }; }
    if (FOOTLOC.r) _bf.soleN.copy(FOOTLOC.r.s).applyQuaternion(fq);
    else { const fd = _bf.sc.copy(to).sub(_bf.anc.chvD).normalize(), sh = kn.sub(_bf.anc.chvD).negate().normalize(); _bf.soleN.copy(sh).addScaledVector(fd, -sh.dot(fd)).normalize(); }
    _bf.anc.plD.lerp(_bf.anc.chvD, 0.5); _bf.anc.dosD.copy(_bf.anc.plD).addScaledVector(_bf.soleN, -0.03); _bf.anc.plD.addScaledVector(_bf.soleN, 0.045); }   // plD : milieu de la voûte, sous le pied ; dosD : le dessus du pied (où l'autre main le tient)
  if (b.rUpLeg && b.rLowLeg && b.lUpLeg && b.lLowLeg) {                       // INTÉRIEUR DE LA CUISSE droite, à mi-hauteur : point et direction tirés des deux os de cuisse (la face interne regarde l'autre cuisse)
    const rh = rawOf(b.rUpLeg).getWorldPosition(new THREE.Vector3()), rk = rawOf(b.rLowLeg).getWorldPosition(new THREE.Vector3());
    const lm = rawOf(b.lUpLeg).getWorldPosition(new THREE.Vector3()).lerp(rawOf(b.lLowLeg).getWorldPosition(new THREE.Vector3()), 0.55);
    _bf.anc.cuD.copy(rh).lerp(rk, 0.55); const ax = rk.sub(rh).normalize();
    _bf.cuN.copy(lm).sub(_bf.anc.cuD); _bf.cuN.addScaledVector(ax, -_bf.cuN.dot(ax)).normalize();
    _bf.anc.cuD.addScaledVector(_bf.cuN, 0.075); }
  if (b.rLowLeg && b.rFoot && b.rUpLeg) {                                     // MOLLET droit : mi-mollet, face arrière-externe (direction tirée des os : vers la cuisse quand le genou est plié, + vers l'extérieur)
    const kn = rawOf(b.rLowLeg).getWorldPosition(new THREE.Vector3()), an = rawOf(b.rFoot).getWorldPosition(new THREE.Vector3()), hp = rawOf(b.rUpLeg).getWorldPosition(new THREE.Vector3());
    _bf.anc.mlD.copy(kn).lerp(an, 0.35); const ax = an.sub(kn).normalize();
    _bf.mlN.copy(hp).sub(_bf.anc.mlD); _bf.mlN.addScaledVector(ax, -_bf.mlN.dot(ax)).normalize();
    const lat = _bf.X.clone().addScaledVector(ax, -_bf.X.dot(ax)).normalize(); _bf.mlN.addScaledVector(lat, 0.8).normalize();
    _bf.anc.mlD.addScaledVector(_bf.mlN, 0.055); }
  if (b.lLowArm && b.lHand) { rawOf(b.lLowArm).getWorldPosition(_bf.anc.poigL); _bf.anc.cdL.copy(_bf.anc.poigL); rawOf(b.lHand).getWorldPosition(_bf.anc.mainL);   // cdL : le coude gauche (articulation)      // ancres sur le bras gauche lui-même, dans l'espace AFFICHÉ (le rig diverge de 1-3 cm : paume enfoncée, vu)
    _bf.anc.avbL.copy(_bf.anc.poigL).lerp(_bf.anc.mainL, 0.55); _bf.anc.poigL.copy(_bf.anc.mainL);
    const M0 = b.hand && b.hand.l && b.hand.l.Middle && b.hand.l.Middle[0]; if (M0) rawOf(M0).getWorldPosition(_bf.anc.mainL); }
}
function applyLib(def, gt, w, b) {
  if (!b.rArm || !b.lArm || !b.head || !b.hips) return;
  rig.updateMatrixWorld(true);
  bfFrame(b);
  legPlaceApply(def, gt, w, b);
  bfAnchors(b);
  for (const [hk, side, up, lo, hand, pk] of [['r', 1, b.rArm, b.rLowArm, b.rHand, 'rPole'], ['l', -1, b.lArm, b.lLowArm, b.lHand, 'lPole']]) {
    const keys = def[hk]; if (!keys) continue;
    const tg0 = libKey(keys, gt, side, def.osc || null, gt, def.blend).clone();
    if (def.eat && def.prop && def.prop.h === hk) eatAdjust(def, gt, tg0);   // aliment : correction mesurée à l'image précédente (l'aliment arrive AU CONTACT de la bouche, au millimètre)
    if (def.circ) {                                             // circumduction : circ [axe A, axe B, rayon (m), fréquence]
      const ax = [_bf.X, _bf.Y, _bf.Z], cc = def.circ, sd = (cc[0] === 0 ? side : 1), sd2 = (cc[1] === 0 ? side : 1);
      tg0.addScaledVector(ax[cc[0]], cc[2] * Math.sin(gt * cc[3]) * sd).addScaledVector(ax[cc[1]], cc[2] * Math.cos(gt * cc[3]) * sd2);
    }
    const W0 = def.touchWin ? def.touchWin[0] : 0.45, W1 = def.touchWin ? def.touchWin[1] : def.dur - 0.85, Wr = def.touchWin ? 0.1 : 0.45;
    const tsw = def.touch && (!def.touchHand || def.touchHand === hk || def.touchHand === 'lr') && SURF.ok && !window.__noSurfHand ? Math.max(0, Math.min(1, (gt - W0) / Wr)) * Math.max(0, Math.min(1, (W1 - gt) / Wr)) : 0;   // seul la main TOUCHEUSE a le pipeline de contact (le bras qui se présente n'essaie pas de se toucher lui-même)   // toucher : la paume se pose sur la peau à l'arrivée, la quitte au départ
    let tgREF = null, zref = null;
    if (tsw > 0.01) {                                                          // UNE SEULE cible pour le bras : le vrai point de peau de la zone (pas une approximation que la paume devrait rattraper ensuite)
      surfUpdate(); const zo = _bf.zo[hk] || (_bf.zo[hk] = { point: new THREE.Vector3(), normal: new THREE.Vector3() });
      const zkey = def.touchZone || def.name || 'touch', ZL = SLOCK[hk];
      // zref : le point de zone PUR (ancre d'auteur + décalage), indépendant du temps du geste — PAS la clé de bras en cours de fondu
      // (vu : pendant l'approche, la clé passait devant le sein, le verrou s'y posait, et la « joue » restait sur le sein)
      const to = def.touchOut, hz = def.touchAnchor === 'head' && _bf.hX;
      zref = new THREE.Vector3().copy(_bf.anc[def.touchAnchor] || _bf.anc.sh);
      if (def.touchAnchor === 'plD') zref.addScaledVector(_bf.soleN, 0.01);
      else if (def.touchAnchor === 'cuD') zref.addScaledVector(_bf.cuN, 0.01);
      else if (def.touchAnchor === 'mlD') zref.addScaledVector(_bf.mlN, 0.01);
      else if (to) zref.addScaledVector(hz ? _bf.hX : _bf.X, to[0] * side).addScaledVector(hz ? _bf.hY : _bf.Y, to[1]).addScaledVector(hz ? _bf.hZ : _bf.Z, to[2]);
      let found;
      const glide = def.touchGlide;                                           // caresse/frottement : l'ancre GLISSE sur la peau (jamais de verrou — il tuerait le mouvement)
      if (!glide && ZL && ZL.key === zkey && ZL.ref && ZL.ref.distanceTo(zref) < 0.14) { lockPoint(ZL, zo); found = true; }   // l'ancre est posée ET toujours près de la référence : le bras vise LE MÊME point de peau qu'elle
      else {
        const seed = _bf.tg2.copy(zref);
        if (glide && def.circ) {
          const cc = def.circ, amp = Math.max(0, Math.min(1, (tsw - 0.55) * 2.8));   // on POSE d'abord, on caresse ensuite (le raccord d'arrivée retournait la paume, vu)
          if (/^(avbL|poigL|mainL|cdL)$/.test(def.touchAnchor)) {                // membre fin : la caresse LONGE l'avant-bras (un cercle en ferait le tour : paume qui tournoie, vu)
            _bf.pl.copy(_bf.anc.poigL).sub(_bf.anc.avbL).normalize();
            seed.addScaledVector(_bf.pl, cc[2] * 1.3 * (Math.sin(gt * cc[3]) - 0.55) * amp);   // course décalée vers le coude : au bout de course elle montait sur la MAIN (ancre perpendiculaire, vu)
          } else { const ax = [_bf.X, _bf.Y, _bf.Z], sd = (cc[0] === 0 ? side : 1), sd2 = (cc[1] === 0 ? side : 1);
            seed.addScaledVector(ax[cc[0]], cc[2] * Math.sin(gt * cc[3]) * sd * amp).addScaledVector(ax[cc[1]], cc[2] * Math.cos(gt * cc[3]) * sd2 * amp); } }
        if (def.touchAnchor === 'plD') tgREF = _bf.soleN.clone();
        else if (def.touchAnchor === 'cuD') tgREF = _bf.cuN.clone();
        else if (def.touchAnchor === 'mlD') tgREF = _bf.mlN.clone();
        else if (def.touchExt) tgREF = new THREE.Vector3().addScaledVector(_bf.X, def.touchExt[0] * side).addScaledVector(_bf.Y, def.touchExt[1]).addScaledVector(_bf.Z, def.touchExt[2]).normalize();   // direction d'extérieur d'AUTEUR (dessus du pied : vers le haut)
        else if (/^(avbL|poigL|mainL|chvD|cdL)$/.test(def.touchAnchor)) tgREF = new THREE.Vector3().copy(zref).sub(_bf.anc.hips).normalize();   // ancre MOBILE (membre qui bouge) : l'extérieur = loin du tronc, pas un axe du corps figé (vu : caresse posée sur la face interne de l'avant-bras)
        else tgREF = to ? new THREE.Vector3().addScaledVector(hz ? _bf.hX : _bf.X, to[0] * side).addScaledVector(hz ? _bf.hY : _bf.Y, to[1]).addScaledVector(hz ? _bf.hZ : _bf.Z, to[2]).normalize() : null;
        found = surfClosest(seed, def.touchXB ? 3 : (hk === 'l' ? 1 : 2), zo, 0.18, tgREF) !== null;   // requête depuis le point de zone PUR (+ le cercle de la caresse), 18 cm au plus
      }
      if (found) {                                                             // la cible d'IK intègre le décalage paume-poignet ; elle s'impose au rythme du toucher (l'approche garde sa courbe)
        const mw = Math.max(0, Math.min(1, (gt - 0.45) / 0.45));
        if (def.touchTip) tg0.lerp(_bf.tg2.copy(zo.point).addScaledVector(zo.normal, 0.14), mw);
        else { surfAimWrist(b, hk, hand, zo, _bf.tg2); tg0.lerp(_bf.tg2, mw); }
      }
    }
    const tg = pushOut(tg0, def.noPush || tsw > 0.5 || (def.eat && EAT.w > 0.05) ? -1 : 0.032);
    if (window.__eatDbg) (window.__tgDbg = window.__tgDbg || {})[hk] = tg.clone();
    const pp = def[pk] || [1, -0.7, -0.3];
    _bf.pl.set(0, 0, 0).addScaledVector(_bf.X, pp[0] * side).addScaledVector(_bf.Y, pp[1]).addScaledVector(_bf.Z, pp[2]);
    { // rythme scapulo-huméral : au-delà de ~35° d'élévation, l'omoplate pivote et l'épaule monte (≈ 1/3 du mouvement), comme chez un humain
      const shb = hk === 'r' ? b.rSh : b.lSh;
      if (shb) { up.getWorldPosition(_bf.tmp); const dv = _bf.sc.copy(tg).sub(_bf.tmp); const el = Math.acos(Math.max(-1, Math.min(1, -dv.normalize().dot(_bf.Y))));   // 0 bras le long du corps, π bras à la verticale
        const lift = Math.min(0.22, Math.max(0, el - 1.2) * (window.__shk ?? 0.12)) * w; shb.rotation.z += (hk === 'r' ? -1 : 1) * lift; shb.updateMatrixWorld(true); }
    }
    armIK(up, lo, hand, tg, _bf.pl, w);
    let tw = def[hk + 'Twist']; const wr = def[hk + 'Wrist'];
    if (Array.isArray(tw)) { const [ta, tb, tf] = keyLerp(tw, gt); tw = ta + (tb - ta) * tf; }
    if (hand && (tw || wr)) {            // rotation du poignet (twist) et pliage (wrist : [tourner, plier, incliner])
      const W = window['__w' + hk] || wr || [0, 0, 0];
      // pronation/supination = rotation de l'avant-bras (radius autour du cubitus) : ~65 % sur l'avant-bras, le reste sur la main
      const clp = (v, a, c) => Math.max(a, Math.min(c, v));
      const twAll = clp((tw || 0) * (window.__twm ? 1 : side) * (window.__tws ?? 1) + W[0] * side, -1.6, 1.6);
      const dev = clp(W[1] * side, -0.5, 0.5), fl = clp(W[2], -1.35, 1.2);   // déviation radiale/cubitale, flexion/extension
      const fa = twAll * 0.65 * w;
      if (lo && fa) lo.rotateX(fa);
      hand.rotation.set(twAll * 0.35 * w, dev * w, fl * w);
    }
    if (SURF.xb) SURF.xb[hk] = tsw > 0 && !!def.touchXB;
    if (tsw > 0) { SURFREQ[hk] = { up, lo, hand, w: tsw * tsw * (3 - 2 * tsw) * w, pole: _bf.pl.clone(), tip: def.touchTip, key: def.touchZone || def.name || 'touch', tg: (_bf.zo[hk] && _bf.zo[hk].point.clone()) || tg0.clone(), pref: tgREF, ref: zref, glide: def.touchGlide, fdir: def.touchFdir ? new THREE.Vector3().addScaledVector(_bf.X, def.touchFdir[0] * side).addScaledVector(_bf.Y, def.touchFdir[1]).addScaledVector(_bf.Z, def.touchFdir[2]).normalize() : null }; TOUCHW[hk] = tsw;
      if (tsw > 0.9 && def.touchZone && !TOUCH_STYLES[def.touchStyle]?.impact && _bf.zo[hk] && typeof tlSelfFeel === 'function') {   // ressenti CONTINU : vitesse réelle du point de contact sur la peau
        const zp = _bf.zo[hk].point, kp = '_zp' + hk, kv = '_v' + hk, dts = Math.max(1e-3, _simDt || 0.016);
        const vi = def[kp] ? Math.min(60, zp.distanceTo(def[kp]) / dts * 100) : 0; (def[kp] || (def[kp] = new THREE.Vector3())).copy(zp);
        def[kv] = (def[kv] || 0) + (vi - (def[kv] || 0)) * Math.min(1, dts * 6);
        tlSelfFeel(def.touchZone, def.touchStyle, (TOUCH_STYLES[def.touchStyle] || {}).force ?? 0.2, def[kv], dts, side); }
      else if (tsw < 0.5) def['_zp' + hk] = null;
      if (tsw < 0.1) def._felt = 0;
      if (tsw > 0.9 && !def._felt) { def._felt = 1; lastTouch = { zone: def.touchZone, style: def.touchStyle, t: Date.now(), ...def.sense }; if (typeof sensLearn === 'function') sensLearn(def.touchZone, def.touchStyle, def.sense); }   // le ressenti naît quand le toucher S'ACCOMPLIT (à chaque fois, pas à la création du geste)
      if (def.impactAt && gt < def.impactAt - 0.3) def['imp' + hk] = 0;                        // nouveau passage du geste (les defs sont en cache) : réarmer le choc
      if (def.impactAt && !def['imp' + hk] && gt >= def.impactAt) { def['imp' + hk] = 1;        // CHOC dans la chair, une seule fois, à l'instant de la frappe
        const pat = /fesse/.test(def.touchZone) ? (hk === 'l' ? /^LeftButtock/ : /^RightButtock/) : /poitrine|soussein/.test(def.touchZone) ? (hk === 'l' ? /^LeftBreast/ : /^RightBreast/) : null;
        if (pat && _bf.zo[hk]) { const dir = _bf.zo[hk].normal.clone().negate(); IMPACT.q.push({ pat, v: dir.multiplyScalar(0.9 * (def.impactForce || 0.8)) }); } }
      if (!window.__nosup && /soussein|poitrine/.test(def.touchZone || '') && /porter|pose|masse/.test(def.touchStyle || '')) SUPPORT[hk] = tsw * (TOUCH_STYLES[def.touchStyle] ? Math.min(1, TOUCH_STYLES[def.touchStyle].force * 2.4) : 0.5); }   // tg : le point VISÉ (la zone), pas « la peau la plus proche »   // demande gardée : posée APRÈS la physique des chairs (la peau bouge encore : poitrine, tête…)
  }
  if (def.legFollow && gt > def.legFollow.a && b.rUpLeg && b.rLowLeg && b.rFoot) {     // CHAÎNE FERMÉE : la cheville tenue SUIT la main qui la porte
    const LF = def.legFollow, hand2 = LF.hk === 'l' ? b.lHand : b.rHand;
    const lw = Math.min(1, (gt - LF.a) / 0.7) * w;
    _bf.tg2.copy(hand2.getWorldPosition(_bf.pl)); _bf.tg2.y -= 0.03;          // la prise : cheville ~3 cm sous le centre de la main (offset ANATOMIQUE fixe — le capturer était piégé : main rig et main affichée divergent de 60 cm en accroupi profond, vu)
    // IK ANALYTIQUE sagittale (l'IK par quaternions se faisait broyer par les limites articulaires : flexion encodée en lacet+roulis, vu)
    const H = b.rUpLeg.getWorldPosition(_bf.pl), v = _bf.tg2.sub(H);
    if (!def._legL) { const g2 = b.rLowLeg.getWorldPosition(new THREE.Vector3()); def._legL = [H.distanceTo(g2), g2.distanceTo(b.rFoot.getWorldPosition(new THREE.Vector3()))]; }
    const L1 = def._legL[0], L2 = def._legL[1];
    const vf = v.dot(_bf.Z), vu = v.dot(_bf.Y), vl = v.dot(_bf.X);
    const d2d = Math.max(0.15, Math.min(Math.hypot(vf, vu), L1 + L2 - 0.01));
    const phi = Math.atan2(vf, -vu);                                          // élévation depuis la verticale basse
    const kneeIn = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d2d * d2d) / (2 * L1 * L2))));
    const alpha = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d2d * d2d - L2 * L2) / (2 * L1 * d2d))));
    const hipX = -(phi + alpha), kneeX = Math.PI - kneeIn;                    // conventions sondées : cuisse avant = x négatif, genou plie = x positif
    b.rUpLeg.rotation.x += (hipX - b.rUpLeg.rotation.x) * lw;
    b.rUpLeg.rotation.z += (Math.atan2(vl, d2d) * 0.8 - b.rUpLeg.rotation.z) * lw;
    b.rLowLeg.rotation.x += (kneeX - b.rLowLeg.rotation.x) * lw;
    b.rFoot.rotation.x += (0.45 - b.rFoot.rotation.x) * lw;                   // pied détendu, pointe un peu tombante
  }
}


// Fessier actif pendant certains gestes (twerk) : chaque fesse rebondit de haut en bas avec la bascule du bassin,
// en léger décalage gauche/droite pour qu'elles se rencontrent. def.butt = [rebond, fréquence, décalage, phase].
const _bb = {}, _bbS = {}; let WING = 1.5;   // amplitude du battement des fesses (part de la forme « écartées »)
const _gm = { m: null, o: -1, c: -1 };
function gluteMorph(open, close) {          // formes sculptées « fesses écartées / serrées »
  if (_gm.m === null) { _gm.m = false; vrm.scene.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && 'glute_open' in o.morphTargetDictionary) { _gm.m = o; _gm.o = o.morphTargetDictionary.glute_open; _gm.c = o.morphTargetDictionary.glute_close; } }); }
  if (!_gm.m) return; _gm.m.morphTargetInfluences[_gm.o] = open; if (_gm.c >= 0) _gm.m.morphTargetInfluences[_gm.c] = close;
}
function buttBounce() {
  if (!vrm) return;
  let fx = 0; for (const j of jig) if (j.butt) fx = Math.max(fx, j.mf || 0);     // cuisses fléchies : les fesses s'ouvrent un peu d'elles-mêmes
  const d = gst && gst.lib && gst.lib.butt; if (!d) { gluteMorph(0.35 * fx, 0); return; }
  const t = gst.t, e = Math.max(0, Math.min(1, t / 0.6, (gst.dur - t) / 0.6)), w = e * e * (3 - 2 * e);
  const [up, fr, alt, ph, clap] = d;
  const th = t * fr + (ph || 0), sk = th + 0.45 * Math.sin(th);          // onde asymétrique : la fesse monte d'un coup sec et retombe plus lentement (poids de la chair)
  const acc = 0.8 + 0.2 * Math.sin(th / 4);                              // accents : un temps fort tous les quatre battements, pas un métronome
  for (const [n, sg] of [['LeftButtock', 1], ['RightButtock', -1]]) {
    const bo = _bb[n] || (_bb[n] = vrm.scene.getObjectByName(n)); if (!bo) continue;
    const a = (up * Math.sin(sk) + sg * alt * Math.sin(sk + 1.2)) * acc;
    const c = Math.pow(Math.max(0, Math.sin(th + 2.4)), 4);              // claquement : les deux fesses se rejoignent d'un coup sec…
    const rb = Math.pow(Math.max(0, Math.sin(th + 2.4 - 0.9)), 2);       // …puis rebondissent en s'écartant (l'onde repart vers l'extérieur)
    bo.rotateX(-a * w); const wing = Math.sin(th + 2.4), op = Math.max(0, -wing), cl = Math.pow(Math.max(0, wing), 3);   // battement d'ailes : ouverture ample, fermeture sèche l'une contre l'autre
    bo.rotateZ(-sg * (clap || 0) * 0.3 * rb * acc * w);
    // choc du claquement : au moment du contact, une impulsion part dans la chair — le ressort la fait onduler puis s'éteindre tout seul,
    // comme une vraie onde de choc (c'est ce qui manquait pour que le « clap » ne soit pas qu'une rotation)
    const st = _bbS[n] || (_bbS[n] = { was: 0 });
    if (c > 0.85 && st.was <= 0.85 && clap) { const j = jig.find((x) => x.bone === bo); if (j) { j.vel.x += -sg * 0.22 * acc * w; j.vel.y += 0.10 * acc * w; } }
    st.was = c;
    if (sg > 0) { const wing = Math.sin(th + 2.4); gluteMorph(Math.min(1.7, (0.35 * fx + WING * Math.max(0, -wing)) * acc * w + 0.35 * fx * (1 - w)), Math.pow(Math.max(0, wing), 3) * acc * w); }   // battement d'ailes : ouverture ample, fermeture sèche
    bo.scale.x *= 1 - 0.05 * c * w; bo.scale.y *= 1 + 0.03 * c * w;      // au contact, la chair se comprime légèrement puis reprend sa forme
  }
}

/* ── Limites articulaires humaines : quel que soit le geste, une articulation ne peut pas vriller au-delà du possible ──
   Rotation de l'os décomposée par rapport au repos en « torsion » (autour de l'axe de l'os) et « bascule » (le reste) ;
   chacune est bornée. Une cuisse ou un tibia ne peut plus faire un tour sur lui-même. */
const ROM = { LeftUpLeg: [0.75, 2.6], RightUpLeg: [0.75, 2.6], LeftLeg: [0.4, 2.7], RightLeg: [0.4, 2.7], LeftFoot: [0.5, 1.3], RightFoot: [0.5, 1.3] };
const romB = []; let romHits = 0;
const _rq = new THREE.Quaternion(), _rt = new THREE.Quaternion(), _rs = new THREE.Quaternion(), _rv = new THREE.Vector3();
function romSetup(root) {
  romB.length = 0;
  for (const n in ROM) {
    const bo = root.getObjectByName(n); if (!bo) continue;
    const ch = bo.children.filter((x) => x.isBone).sort((a, c) => c.position.length() - a.position.length())[0];   // l'os qui prolonge le membre (pas la fesse, rattachée à 0)
    if (!ch || ch.position.length() < 1e-4) continue;
    romB.push({ foot: /Foot$/.test(n), prev: null, bo, rest: bo.quaternion.clone(), restInv: bo.quaternion.clone().invert(), axis: ch.position.clone().normalize(), tw: ROM[n][0], sw: ROM[n][1] });
  }
}
function romApply(dt) {
  if (window.__norom) return;
  for (const r of romB) {
    if (!r.foot) continue;                                                // bornes d'angles retirées : elles faussaient les flexions profondes (squat, à genoux)
    _rq.copy(r.restInv).multiply(r.bo.quaternion);                     // rotation depuis le repos
    if (_rq.w < 0) _rq.set(-_rq.x, -_rq.y, -_rq.z, -_rq.w);            // chemin le plus court
    const d = _rq.x * r.axis.x + _rq.y * r.axis.y + _rq.z * r.axis.z;
    _rt.set(r.axis.x * d, r.axis.y * d, r.axis.z * d, _rq.w);
    if (_rt.lengthSq() < 1e-9) _rt.identity(); else _rt.normalize();
    _rs.copy(_rq).multiply(_rt.clone().invert());                         // bascule = rotation sans la torsion
    let hit = false;
    let ta = 2 * Math.acos(Math.min(1, Math.abs(_rt.w)));
    if (ta > r.tw) { const k = r.tw / ta; _rt.copy(new THREE.Quaternion().slerp(_rt, k)); hit = true; }
    if (_rs.w < 0) _rs.set(-_rs.x, -_rs.y, -_rs.z, -_rs.w);
    const sa = 2 * Math.acos(Math.min(1, _rs.w));
    if (sa > r.sw) { _rs.copy(new THREE.Quaternion().slerp(_rs, r.sw / sa)); hit = true; }
    if (r.foot) {                                                         // un pied ne pivote pas instantanément (défauts de capture lissés)
      if (r.prev && dt > 0) { const a = r.prev.angleTo(r.bo.quaternion), mx = 12 * Math.min(dt, 0.1); if (a > mx) { r.bo.quaternion.copy(r.prev).rotateTowards(r.bo.quaternion, mx); romHits++; } }
      (r.prev || (r.prev = new THREE.Quaternion())).copy(r.bo.quaternion);
    }
  }
}
/* ── Mouvement secondaire : poitrine et fessier suivent l'inertie du corps (ressort amorti), sans jamais exagérer ── */
// Limites relevees d'apres la mesure : a 0,044 m le sein butait sur la limite 48 % du temps pendant une danse
// (arret net, mouvement bride). A 0,10 m avec un gain de 1,8 l'amplitude mesuree sur le bout du sein rejoint les valeurs humaines
// publiees (resultante 15,2 cm en course, dont 56 % de vertical ; Scurr, 21 participantes bonnet D).
const JIG_DEF = [   // os, raideur, amortissement, limite (m), gain
  ['LeftBreast', 125, 5.6, 0.100, 1.8], ['RightBreast', 125, 5.6, 0.100, 1.8],   // poitrine lourde : balancement plus ample et plus lent, qui s'amortit en douceur
  ['LeftButtock', 165, 7.2, 0.070, 2.1], ['RightButtock', 165, 7.2, 0.070, 2.1],   // chair plus souple : l'onde se propage et s'amortit, au lieu d'un petit tremblement sec
];
const jig = [];
const _jw = new THREE.Vector3(), _jv = new THREE.Vector3(), _ja = new THREE.Vector3(), _jq = new THREE.Quaternion(), _jd = new THREE.Vector3(), _jn = new THREE.Vector3(), _jr = new THREE.Quaternion();
function jigSetup(root) {
  jig.length = 0;
  for (const [n, k, c, lim, g] of JIG_DEF) {
    const bone = root.getObjectByName(n);
    if (!bone || !bone.parent) continue;
    const child = bone.children.find((x) => x.isBone);
    const len = child ? Math.max(0.05, child.position.length()) : 0.1;
    jig.push({ bone, rest: bone.quaternion.clone(), len, k, c, lim, g, prev: null, pv: new THREE.Vector3(), off: new THREE.Vector3(), vel: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 1, 0).applyQuaternion(bone.quaternion).normalize(),
      sag: /Breast/.test(n) ? 0.05 : 0.022, g0: null, sagOff: new THREE.Vector3(), butt: /Buttock/.test(n), S: /^Left/.test(n) ? 'L' : 'R', sg: /^Left/.test(n) ? 1 : -1, mf: 0, ma: 0 });
  }
}
const _js2 = new THREE.Vector3();
function jigUpdate(dt) {
  if (!jig.length || dt <= 0) return;
  let spdSum = 0, spdN = 0;
  for (const j of jig) {
    j.bone.quaternion.copy(j.rest);
    j.bone.updateWorldMatrix(true, false);
    j.bone.getWorldPosition(_jw);
    if (!j.prev) { j.prev = _jw.clone(); continue; }
    _jv.copy(_jw).sub(j.prev).divideScalar(dt);           // vitesse du point d'attache
    _ja.copy(_jv).sub(j.pv).divideScalar(dt);             // accélération
    j.prev.copy(_jw); j.pv.copy(_jv);
    spdSum += _jv.length(); spdN++;                        // énergie du mouvement, mesurée sur le corps lui-même
    if (_ja.length() > 60) _ja.setLength(60);             // téléportation (changement de pose brutal) : on ignore le choc
    j.bone.parent.getWorldQuaternion(_jq).invert();
    // Gravité selon la posture : poitrine et fesses « tombent » vers le bas réel (penchée, à quatre pattes, allongée, bras levés)
    _jn.set(0, -1, 0).applyQuaternion(_jq);
    if (!j.g0) j.g0 = _jn.clone();                         // première image : debout, forme de référence
    _jn.sub(j.g0); _jn.addScaledVector(j.dir, -_jn.dot(j.dir));
    j.sagOff.lerp(_jn.multiplyScalar(j.sag * 0.5), Math.min(1, dt * 6));
    for (let qi = IMPACT.q.length - 1; qi >= 0; qi--) { const im = IMPACT.q[qi];
      if (im.pat.test(j.bone.name)) { j.vel.add(_js2.copy(im.v).applyQuaternion(_jq)); IMPACT.q.splice(qi, 1); } }   // le choc entre dans la chair (impulsion locale)
    let sup = 0;                                                             // la main qui PORTE : chair soulevée, rebond amorti (mesuré : un sein soutenu remonte de ~1 cm et ne ballotte plus)
    if (/Breast/.test(j.bone.name)) { sup = SUPPORT[j.bone.name.startsWith('Left') ? 'l' : 'r'] || 0;
      if (sup > 0.02) { _js2.set(0, 1, 0).applyQuaternion(_jq); j.sagOff.multiplyScalar(1 - 0.75 * sup).addScaledVector(_js2, 0.008 * sup); } }   // ~1,2 cm au bout du sein (bras de levier : l'offset est un angle au pivot)
    _ja.applyQuaternion(_jq).multiplyScalar(-j.g * jigGainMul);   // l'inertie tire dans le sens opposé, dosée selon l'énergie du mouvement
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) {                         // intégration semi-implicite, stable
      _jw.copy(j.off).sub(j.sagOff);
      const st = _jw.length() / j.lim, kk = j.k * (1 + 9 * Math.max(0, st - 0.55) ** 2);   // la chair se raidit quand elle s'etire (collagene) : plus de butee seche
      j.vel.addScaledVector(_ja, h).addScaledVector(_jw, -kk * h).addScaledVector(j.vel, -j.c * (1 + 2.5 * sup + 1.8 * Math.max(0, st - 0.8)) * h);
      j.off.addScaledVector(j.vel, h);
    }
    _jw.copy(j.off).sub(j.sagOff); if (_jw.length() > j.lim) { j.off.copy(j.sagOff).add(_jw.setLength(j.lim)); j.vel.multiplyScalar(0.5); }
    _jd.copy(j.dir).multiplyScalar(j.len).add(j.off).normalize();
    _jr.setFromUnitVectors(j.dir, _jd);
    j.bone.quaternion.premultiply(_jr);
    // Muscle fessier : quand la cuisse fléchit (accroupie, penchée, à quatre pattes), il s'étire — la fesse s'aplatit un peu, s'élargit,
    // et le sillon s'ouvre naturellement ; jambe tendue, elle retrouve son galbe. Transition douce, jamais brusque.
    if (j.butt) {
      const w = (typeof CORR !== 'undefined' && CORR.w && CORR.w[j.S]) || null, G = window.__gm ?? 1;
      j.mf += ((w ? w.f : 0) - j.mf) * Math.min(1, dt * 8); j.ma += ((w ? w.a : 0) - j.ma) * Math.min(1, dt * 8);
      const f = j.mf * G, a = j.ma * G;
      j.bone.scale.set(1 + 0.05 * f, 1 - 0.09 * f, 1 + 0.05 * f);
      j.bone.rotateZ(j.sg * (0.15 * f + 0.06 * a));
    }
  }
  // au repos, rebond discret ; en plein mouvement vif (danse, course), plus présent — doux dans les deux cas
  if (spdN) { const avg = spdSum / spdN; jigGainMul += (Math.min(1.6, 0.72 + avg * 0.7) - jigGainMul) * Math.min(1, dt * 3); }
}
