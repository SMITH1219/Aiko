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
function handContact(up, lo, hand) {
  if (!SKIN.ok || !up || !lo || !hand) return;
  up.getWorldPosition(_hc.S); lo.getWorldPosition(_hc.E); hand.getWorldPosition(_hc.H);
  _hc.D.copy(_hc.H).sub(_hc.E).normalize();
  if (!handInside(_hc.H, _hc.D)) return;
  // la main recule le long de son avant-bras jusqu'au premier contact : elle se pose SUR le corps
  let a = 0, b = 1;
  for (let k = 0; k < 9; k++) { const m = (a + b) / 2; _hc.P.copy(_hc.E).lerp(_hc.H, m); if (handInside(_hc.P, _hc.D)) b = m; else a = m; }
  if (a > 0.3) _hc.T.copy(_hc.E).lerp(_hc.H, a);
  else {                                                  // avant-bras presque entièrement dans le corps : on ressort selon la surface
    let dmax = 0; _hc.T.copy(_hc.H);
    for (const off of [0, 0.07, 0.12]) { const d = skinPush(_hc.Q.copy(_hc.H).addScaledVector(_hc.D, off), 0.014, _hc.o); if (d > dmax) { dmax = d; _hc.P.copy(_hc.o); } }
    _hc.T.add(_hc.P);
  }
  _hc.pole.copy(_hc.E).sub(_hc.S);                     // coude dans le même sens qu'avant
  armIK(up, lo, hand, _hc.T, _hc.pole, 1);
}
/* Repère du corps (côté droit, haut, avant) et points d'ancrage, recalculés à chaque image */
const _bf = { X: new THREE.Vector3(), Y: new THREE.Vector3(), Z: new THREE.Vector3(), l: new THREE.Vector3(), r: new THREE.Vector3(), anc: {}, tg: new THREE.Vector3(), pl: new THREE.Vector3(), tmp: new THREE.Vector3() };
['head', 'sh', 'hips'].forEach((k) => { _bf.anc[k] = new THREE.Vector3(); });
_bf.hx = new THREE.Vector3(); _bf.hz = new THREE.Vector3(); _bf.up = new THREE.Vector3(); _bf.sc = new THREE.Vector3();
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
function groundBody(b, w) {          // le point le plus bas du corps (pieds, genoux, bassin, buste, tête) se pose exactement sur le sol
  rig.updateMatrixWorld(true);
  const fy = body.anchL ? body.anchL.y : 0.07;
  const C = [[b.lFoot, fy], [b.rFoot, fy], [b.lToes, 0.025], [b.rToes, 0.025], [b.lLowLeg, 0.06], [b.rLowLeg, 0.06], [b.hips, 0.105], [b.chest, 0.135], [b.head, 0.105], [b.spine, 0.1]]   // rayons : volume réel du corps (fesses, poitrine) autour de l'os;
  let m = Infinity; for (const [o, r] of C) if (o) m = Math.min(m, o.getWorldPosition(_gv).y - r);
  if (isFinite(m)) { rig.position.y -= m * w; rig.updateMatrixWorld(true); }
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
  t.add(top, leg); t.visible = false; scene.add(t); PROPS_ST.table = t; return t;
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
const PROPS_H = { verre: 0.06, tasse: 0.04, bouteille: 0.085, telephone: 0.005, livre: 0.013, fleur: 0.004, stylo: 0.006, miroir: 0.05 };
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
const ZONES = {   // [ancre, [x droite, y haut, z avant] pour la main droite, plan de la caresse [axeA, axeB], pôle du coude]
  joue: ['head', [0.075, 0.0, 0.10], [1, 2], [0.6, -1, 0]], menton: ['head', [0.0, -0.035, 0.13], [0, 2], [0.6, -1, 0.2]], levres: ['head', [0.012, -0.105, 0.125], [0, 1], [0.5, -1, 0.1]],
  cou: ['head', [0.05, -0.10, 0.05], [1, 2], [0.8, -1, -0.2]], nuque: ['head', [0.03, -0.1, -0.07], [0, 1], [0.8, -1, -0.5]], cheveux: ['head', [0.10, 0.09, 0.04], [1, 2], [1, 0.1, -0.2]],
  epaule: ['sh', [0.14, 0.05, 0.05], [0, 2], [1, -1, 0.2]], poitrine: ['sh', [-0.05, -0.14, 0.15], [0, 1], [1, -0.8, 0]], ventre: ['hips', [0.03, 0.15, 0.13], [0, 1], [1, -0.6, 0]],
  taille: ['hips', [0.18, 0.10, 0.03], [1, 2], [1, -0.2, -0.6]], hanche: ['hips', [0.175, 0.0, 0.02], [1, 2], [1, -0.2, -0.6]], fesse: ['hips', [0.10, -0.06, -0.15], [0, 1], [1, -0.3, -1]],
  cuisse: ['hips', [0.16, -0.22, 0.10], [1, 2], [1, -0.5, 0]], genou: ['hips', [0.11, -0.47, 0.11], [0, 1], [1, -0.5, 0]], bras: ['sh', [-0.2, -0.2, 0.13], [1, 2], [1, -0.8, 0.2]],
};
const TOUCH_STYLES = { caresse: { shape: 'main-detendue', r: 0.022, fr: 3.2 }, tapote: { shape: 'main-detendue', r: 0.012, fr: 11 }, pose: { shape: 'main-detendue', r: 0, fr: 0 }, masse: { shape: 'asl-bent-5', r: 0.018, fr: 5 } };
const ZONE_FR = { joue: 'joue', joues: 'joue', menton: 'menton', levres: 'levres', 'lèvres': 'levres', bouche: 'levres', cou: 'cou', nuque: 'nuque', cheveux: 'cheveux', epaule: 'epaule', 'épaule': 'epaule', epaules: 'epaule', poitrine: 'poitrine', seins: 'poitrine', ventre: 'ventre', taille: 'taille', hanche: 'hanche', hanches: 'hanche', fesse: 'fesse', fesses: 'fesse', croupe: 'fesse', cuisse: 'cuisse', cuisses: 'cuisse', genou: 'genou', bras: 'bras' };
const TOUCH_VERB = { caresse: 'caresse', caresses: 'caresse', touche: 'pose', pose: 'pose', tapote: 'tapote', frotte: 'masse', masse: 'masse', effleure: 'caresse', serre: 'pose' };
function touchDef(zone, style, hand) {
  const Z = ZONES[zone], St = TOUCH_STYLES[style] || TOUCH_STYLES.caresse; if (!Z) return null;
  const hk = hand || (Z[1][0] < 0 ? 'l' : 'r'), side = hk === 'r' ? 1 : -1, dir = Z[1][0] < 0 && hk === 'l' ? -1 : 1, o = Z[1].slice(); if (Z[1][0] < 0 && hk === 'l') o[0] = -o[0];
  const dur = 5.5, def = { dur, blend: true, [hk]: [[0, 'sh', [0.2, -0.4, 0.05]], [0.9, Z[0], o], [dur - 1.3, Z[0], o], [dur, 'sh', [0.2, -0.4, 0.05]]], [hk + 'Pole']: Z[3], [hk + 'Hand']: [[0, 'open'], [0.7, St.shape], [dur - 1.2, 'open']], head: [0.03, 0, (zone === 'joue' ? 0.12 : 0.02) * side], face: ['relaxed', 0.6] };
  if (St.r) def.circ = [Z[2][0], Z[2][1], St.r, St.fr];
  return def;
}
function touchPlay(zone, style, hand) {
  const d = touchDef(zone, style, hand); if (!d) return false;
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
  const A = AUTOCAM, now = performance.now();
  if (!A.on || LESSON.on || currentPose === 'bed' || document.hidden || !vrm) { CAM.slow = false; return; }
  if (now - A.lastUser < 9000) { CAM.slow = false; return; }
  const g = gst, k = body.k || 1, tt = now / 1000;
  let mode = '';
  if (g && g.clip && !/saut|jump/i.test(g.name)) mode = 'danse';
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
  for (const [up, lo, hand, ds] of [[b.rArm, b.rLowArm, b.rHand, _kd.r], [b.lArm, b.lLowArm, b.lHand, _kd.l]]) {
    if (!up || !lo || !hand) continue;
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
    ds.lerp(loc, kk);
    if (ds.length() < 0.0012) { up.quaternion.copy(_kd.qu); lo.quaternion.copy(_kd.ql); up.updateWorldMatrix(false, true); continue; }
    up.quaternion.copy(_kd.qu); lo.quaternion.copy(_kd.ql); up.updateWorldMatrix(false, true);
    _ak.T.copy(_kd.h0).addScaledVector(_bf.X, ds.x).addScaledVector(_bf.Y, ds.y).addScaledVector(_bf.Z, ds.z);
    armIK(up, lo, hand, _ak.T, pole0, 1);
  }
}
function applyLib(def, gt, w, b) {
  if (!b.rArm || !b.lArm || !b.head || !b.hips) return;
  rig.updateMatrixWorld(true);
  b.rArm.getWorldPosition(_bf.r); b.lArm.getWorldPosition(_bf.l);
  _bf.X.copy(_bf.r).sub(_bf.l).normalize();                              // vers SA droite
  b.hips.getWorldQuaternion(_ik.w); _bf.Y.set(0, 1, 0).applyQuaternion(_ik.w);
  _bf.Y.addScaledVector(_bf.X, -_bf.Y.dot(_bf.X)).normalize();
  _bf.Z.crossVectors(_bf.Y, _bf.X).normalize();                          // vers l'avant (son regard)
  b.head.getWorldPosition(_bf.anc.head); _bf.anc.sh.copy(_bf.r).add(_bf.l).multiplyScalar(0.5); b.hips.getWorldPosition(_bf.anc.hips);
  for (const [hk, side, up, lo, hand, pk] of [['r', 1, b.rArm, b.rLowArm, b.rHand, 'rPole'], ['l', -1, b.lArm, b.lLowArm, b.lHand, 'lPole']]) {
    const keys = def[hk]; if (!keys) continue;
    const tg0 = libKey(keys, gt, side, def.osc || null, gt, def.blend).clone();
    if (def.circ) {                                             // circumduction : circ [axe A, axe B, rayon (m), fréquence]
      const ax = [_bf.X, _bf.Y, _bf.Z], cc = def.circ, sd = (cc[0] === 0 ? side : 1), sd2 = (cc[1] === 0 ? side : 1);
      tg0.addScaledVector(ax[cc[0]], cc[2] * Math.sin(gt * cc[3]) * sd).addScaledVector(ax[cc[1]], cc[2] * Math.cos(gt * cc[3]) * sd2);
    }
    const tg = pushOut(tg0, def.noPush ? -1 : 0.032);
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
  }
}


// Fessier actif pendant certains gestes (twerk) : chaque fesse rebondit de haut en bas avec la bascule du bassin,
// en léger décalage gauche/droite pour qu'elles se rencontrent. def.butt = [rebond, fréquence, décalage, phase].
const _bb = {};
function buttBounce() {
  const d = gst && gst.lib && gst.lib.butt; if (!d || !vrm) return;
  const t = gst.t, e = Math.max(0, Math.min(1, t / 0.6, (gst.dur - t) / 0.6)), w = e * e * (3 - 2 * e);
  const [up, fr, alt, ph, clap] = d;
  for (const [n, sg] of [['LeftButtock', 1], ['RightButtock', -1]]) {
    const bo = _bb[n] || (_bb[n] = vrm.scene.getObjectByName(n)); if (!bo) continue;
    const a = up * Math.sin(t * fr + (ph || 0)) + sg * alt * Math.sin(t * fr + (ph || 0) + 1.2);
    const c = Math.pow(Math.max(0, Math.sin(t * fr + (ph || 0) + 2.4)), 3);   // claquement : les deux fesses se rapprochent d'un coup sec, puis se séparent
    bo.rotateX(-a * w); bo.rotateZ(-sg * (clap || 0) * c * w);
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
    if (ta > r.tw) { const k = r.tw / ta; _rt.slerpQuaternions(new THREE.Quaternion(), _rt, k); hit = true; }
    if (_rs.w < 0) _rs.set(-_rs.x, -_rs.y, -_rs.z, -_rs.w);
    const sa = 2 * Math.acos(Math.min(1, _rs.w));
    if (sa > r.sw) { _rs.slerpQuaternions(new THREE.Quaternion(), _rs, r.sw / sa); hit = true; }
    if (r.foot) {                                                         // un pied ne pivote pas instantanément (défauts de capture lissés)
      if (r.prev && dt > 0) { const a = r.prev.angleTo(r.bo.quaternion), mx = 12 * Math.min(dt, 0.1); if (a > mx) { r.bo.quaternion.copy(r.prev).rotateTowards(r.bo.quaternion, mx); romHits++; } }
      (r.prev || (r.prev = new THREE.Quaternion())).copy(r.bo.quaternion);
    }
  }
}
/* ── Mouvement secondaire : poitrine et fessier suivent l'inertie du corps (ressort amorti), sans jamais exagérer ── */
const JIG_DEF = [   // os, raideur, amortissement, limite (m), gain
  ['LeftBreast', 160, 6.5, 0.036, 2.3], ['RightBreast', 160, 6.5, 0.036, 2.3],
  ['LeftButtock', 220, 9, 0.022, 1.7], ['RightButtock', 220, 9, 0.022, 1.7],
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
      sag: /Breast/.test(n) ? 0.05 : 0.022, g0: null, sagOff: new THREE.Vector3() });
  }
}
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
    _ja.applyQuaternion(_jq).multiplyScalar(-j.g * jigGainMul);   // l'inertie tire dans le sens opposé, dosée selon l'énergie du mouvement
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for (let i = 0; i < n; i++) {                         // intégration semi-implicite, stable
      j.vel.addScaledVector(_ja, h).addScaledVector(_jw.copy(j.off).sub(j.sagOff), -j.k * h).addScaledVector(j.vel, -j.c * h);
      j.off.addScaledVector(j.vel, h);
    }
    _jw.copy(j.off).sub(j.sagOff); if (_jw.length() > j.lim) { j.off.copy(j.sagOff).add(_jw.setLength(j.lim)); j.vel.multiplyScalar(0.5); }
    _jd.copy(j.dir).multiplyScalar(j.len).add(j.off).normalize();
    _jr.setFromUnitVectors(j.dir, _jd);
    j.bone.quaternion.premultiply(_jr);
  }
  // au repos, rebond discret ; en plein mouvement vif (danse, course), plus présent — doux dans les deux cas
  if (spdN) { const avg = spdSum / spdN; jigGainMul += (Math.min(1.6, 0.72 + avg * 0.7) - jigGainMul) * Math.min(1, dt * 3); }
}
