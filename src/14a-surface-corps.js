/* ══ SURFACE EXACTE DU CORPS (corps de collision) ══
   Recette des jeux : les contacts ne se testent pas sur le maillage affiché (57 000 sommets) mais sur un corps de collision léger, qui suit
   le même squelette avec les mêmes poids. Ici : la peau sculptée d'Aiko allégée à 14 000 triangles (écart moyen 0,1 mm avec la vraie peau),
   remise en pose à chaque image, et interrogée par la bibliothèque libre three-mesh-bvh : pour n'importe quel point de l'espace, on obtient
   le point de peau le plus proche, sa normale, et si le point est dehors ou dedans. Même outil pour son corps, un objet ou un meuble. */
const SURF = { ok: false, loading: null, nv: 0, rest: null, pos: null, nor: null, idx: null, ji: null, jw: null, bones: null, inv: null, part: null, geo: null, bvh: null, dirty: true, M: null, ms: 0, xb: { l: false, r: false } };
const _sf = { m: new THREE.Matrix4(), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Vector3(), n: new THREE.Vector3(), bc: new THREE.Vector3(), t: new THREE.Vector3(), box: new THREE.Vector3(), fn: new THREE.Vector3(), e2: new THREE.Vector3(), pr: new THREE.Vector3() };
function surfSetup() {
  if (SURF.loading || !SKIN.mesh) return SURF.loading;
  SURF.loading = fetch('./proxy.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d) return;
    const f32 = (b) => new Float32Array(_u8(b)), mesh = SKIN.mesh, sk = mesh.skeleton;
    SURF.nv = d.nv; SURF.rest = f32(d.p); SURF.pos = new Float32Array(d.nv * 3); SURF.nor = new Float32Array(d.nv * 3);
    SURF.bones = d.bones.map((nm) => sk.bones.findIndex((b) => b.name === nm));             // os du squelette affiché, par leur nom
    // La peau affichée est stockée compressée (coordonnées réduites, l'échelle étant reportée dans le squelette). On met notre corps de collision
    // dans ce même repère : la position de repos de chaque articulation est connue dans les deux (en mètres ici, compressée dans le squelette),
    // ce qui donne l'échelle et le décalage exacts, axe par axe.
    { const mi = new THREE.Matrix4(), q = new THREE.Vector3(), A = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; let n = 0;
      d.bones.forEach((nm, k) => { const bi = SURF.bones[k]; if (bi < 0) return; q.setFromMatrixPosition(mi.copy(sk.boneInverses[bi]).invert()); const m = d.jp[k], Q = [q.x, q.y, q.z]; n++;
        for (let c = 0; c < 3; c++) { A[c][0] += m[c]; A[c][1] += Q[c]; A[c][2] += m[c] * m[c]; A[c][3] += m[c] * Q[c]; } });
      for (let c = 0; c < 3; c++) { const [sm, sq, smm, smq] = A[c], den = n * smm - sm * sm, a = den > 1e-9 ? (n * smq - sm * sq) / den : 1, b0 = (sq - a * sm) / n;
        for (let v = 0; v < d.nv; v++) SURF.rest[v * 3 + c] = a * SURF.rest[v * 3 + c] + b0; SURF['k' + c] = [a, b0]; } }
    SURF.idx = d.nv < 65536 ? new Uint16Array(_u8(d.i)) : new Uint32Array(_u8(d.i));
    // Chaque sommet du corps de collision est accroché au sommet de la vraie peau le plus proche : il en prend la position exacte, les poids exacts
    // (mêmes os, mêmes influences que la peau affichée) et les déformations (fessier, correctifs). Aux sommets, les deux surfaces coïncident donc.
    { const g = mesh.geometry, hp = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, cell = 0.012 * Math.abs(SURF.k1[0]), grid = new Map(), key = (x, y, z) => x * 73856093 ^ y * 19349663 ^ z * 83492791;
      const hv = new THREE.Vector3();
      for (let i = 0; i < hp.count; i++) { hv.fromBufferAttribute(hp, i); const k = key(Math.floor(hv.x / cell), Math.floor(hv.y / cell), Math.floor(hv.z / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
      SURF.src = new Int32Array(d.nv).fill(-1); SURF.ji = new Uint8Array(d.nv * 4); SURF.jw = new Float32Array(d.nv * 4); let far = 0;
      for (let v = 0; v < d.nv; v++) {
        const x = SURF.rest[v * 3], y = SURF.rest[v * 3 + 1], z = SURF.rest[v * 3 + 2], cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell); let bd = Infinity, bi = -1;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const a = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!a) continue;
          for (const i of a) { hv.fromBufferAttribute(hp, i); const q = (hv.x - x) ** 2 + (hv.y - y) ** 2 + (hv.z - z) ** 2; if (q < bd) { bd = q; bi = i; } } }
        if (bi < 0) { far++; continue; }
        SURF.src[v] = bi; hv.fromBufferAttribute(hp, bi); SURF.rest[v * 3] = hv.x; SURF.rest[v * 3 + 1] = hv.y; SURF.rest[v * 3 + 2] = hv.z;
        let sum = 0; for (let k = 0; k < 4; k++) { SURF.ji[v * 4 + k] = si.getComponent(bi, k); SURF.jw[v * 4 + k] = sw.getComponent(bi, k); sum += SURF.jw[v * 4 + k]; }
        if (sum > 0) for (let k = 0; k < 4; k++) SURF.jw[v * 4 + k] /= sum;
      }
      SURF.far = far; SURF.morph = g.morphAttributes.position || null; SURF.morphRel = g.morphTargetsRelative;
      if (far) console.warn('surface du corps :', far, 'sommets sans correspondance');
      d.bones = sk.bones.map((b) => b.name); SURF.bones = sk.bones.map((_, i) => i); }
    SURF.M = new Float32Array(sk.bones.length * 16);
    // partie du corps de chaque triangle : 1 = bras gauche (bras, avant-bras, main), 2 = bras droit, 0 = le reste (une main ne se « touche » pas elle-même)
    // ══ BLOC TÊTE : Body_corps s'arrête au cou — le visage affiché vient du mesh « Body » (son propre squelette, ses propres poids, ses morphs d'expression).
    //    Sans lui, AUCUNE zone du visage n'existait pour la main (vu : « joue » se posait sur l'épaule, le menton, le haut du dos…).
    if (d.tete) {
      let hm = null; vrm.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === d.tete.mesh) hm = o; });
      if (hm) {
        const t = d.tete, n0 = SURF.nv, hv = t.nv;
        const hrest = f32(t.p), hidx = new Uint32Array(_u8(t.i)), hji = new Uint8Array(_u8(t.ji)), hjw = f32(t.jw), hsrc = new Uint32Array(_u8(t.src));
        const rest2 = new Float32Array((n0 + hv) * 3); rest2.set(SURF.rest); rest2.set(hrest, n0 * 3); SURF.rest = rest2;
        SURF.pos = new Float32Array((n0 + hv) * 3); SURF.nor = new Float32Array((n0 + hv) * 3);
        const merged = new Uint32Array(SURF.idx.length + hidx.length); merged.set(SURF.idx);
        for (let i = 0; i < hidx.length; i++) merged[SURF.idx.length + i] = hidx[i] + n0;
        SURF.idx = merged;
        const ji2 = new Uint8Array((n0 + hv) * 4); ji2.set(SURF.ji); ji2.set(hji, n0 * 4); SURF.ji = ji2;
        const jw2 = new Float32Array((n0 + hv) * 4); jw2.set(SURF.jw); jw2.set(hjw, n0 * 4); SURF.jw = jw2;
        SURF.h = { n0, nv: hv, mesh: hm, src: hsrc, bones: t.bones.map((nm) => hm.skeleton.bones.findIndex((b) => b.name === nm)), M: new Float32Array(hm.skeleton.bones.length * 16), pre: new THREE.Matrix4() };
        SURF.nv = n0 + hv;
      } else console.warn('surface du corps : mesh de tête introuvable', d.tete.mesh);
    }
    // ORIENTATION des triangles : chacun prend le sens que lui donnent les normales du maillage d'ORIGINE (celles de l'artiste) — le sens d'enroulement
    // du proxy n'était pas cohérent dans le bloc tête (vu : un triangle du front « regardait » vers l'intérieur → fausse pénétration de 3 cm, paume repoussée)
    { const bn = SKIN.mesh.geometry.attributes.normal, H2 = SURF.h, hn = H2 && H2.mesh.geometry.attributes.normal, I = SURF.idx, R0 = SURF.rest, nvb = H2 ? H2.n0 : SURF.nv;
      const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3(); let flips = 0, fh = 0;
      const nrm = (v) => { if (v < nvb) { const i = SURF.src[v]; return i >= 0 && bn ? vn.set(bn.getX(i), bn.getY(i), bn.getZ(i)) : null; } const i = H2.src[v - nvb]; return hn ? vn.set(hn.getX(i), hn.getY(i), hn.getZ(i)) : null; };
      const acc = new THREE.Vector3();
      for (let t = 0; t < I.length / 3; t++) {
        const a = I[t * 3], b2 = I[t * 3 + 1], c = I[t * 3 + 2];
        e1.set(R0[b2 * 3] - R0[a * 3], R0[b2 * 3 + 1] - R0[a * 3 + 1], R0[b2 * 3 + 2] - R0[a * 3 + 2]);
        e2.set(R0[c * 3] - R0[a * 3], R0[c * 3 + 1] - R0[a * 3 + 1], R0[c * 3 + 2] - R0[a * 3 + 2]); fn.crossVectors(e1, e2);
        acc.set(0, 0, 0); for (const v of [a, b2, c]) { const n = nrm(v); if (n) acc.add(n); }
        if (!window.__noFlip && acc.lengthSq() > 1e-8 && fn.dot(acc) < 0) { I[t * 3 + 1] = c; I[t * 3 + 2] = b2; flips++; if (a >= nvb) fh++; } }
      SURF.flips = [flips, fh]; if (flips) console.info('surface du corps : triangles réorientés', flips, '(dont tête', fh + ')'); }
    const partOf = (nm) => (/^Left(Arm|ForeArm|Hand)/.test(nm) ? 1 : /^Right(Arm|ForeArm|Hand)/.test(nm) ? 2 : 0), vp = new Uint8Array(SURF.nv);
    for (let v = 0; v < (SURF.h ? SURF.h.n0 : SURF.nv); v++) { let bw = -1, bi = 0; for (let k = 0; k < 4; k++) if (SURF.jw[v * 4 + k] > bw) { bw = SURF.jw[v * 4 + k]; bi = SURF.ji[v * 4 + k]; } vp[v] = partOf(d.bones[bi]); }
    SURF.part = new Uint8Array(SURF.idx.length / 3);
    for (let t = 0; t < SURF.part.length; t++) { const a = vp[SURF.idx[t * 3]], b = vp[SURF.idx[t * 3 + 1]], c = vp[SURF.idx[t * 3 + 2]]; SURF.part[t] = a === b || a === c ? a : b === c ? b : a; }
    const _tbIds = new Map(); SURF.tb = new Int16Array(SURF.part.length); for (let t = 0; t < SURF.tb.length; t++) { const v = SURF.idx[t * 3]; let bw = -1, bi = 0; for (let k = 0; k < 4; k++) if (SURF.jw[v * 4 + k] > bw) { bw = SURF.jw[v * 4 + k]; bi = SURF.ji[v * 4 + k]; } const nm = v >= (SURF.h ? SURF.h.n0 : SURF.nv) ? (d.tete.bones[bi] || '') : (d.bones[bi] || ''); let id = _tbIds.get(nm); if (id === undefined) _tbIds.set(nm, id = _tbIds.size); SURF.tb[t] = id; }   /* os dominant de chaque triangle, identifié par son NOM (les deux maillages, corps et tête, ont leur propre numérotation) */
    SURF.geo = new THREE.BufferGeometry(); SURF.geo.setAttribute('position', new THREE.BufferAttribute(SURF.pos, 3)); SURF.geo.setIndex(new THREE.BufferAttribute(SURF.idx, 1));
    SURF.pos.set(SURF.rest);
    SURF.bvh = new MeshBVH(SURF.geo, { indirect: true });                                    // « indirect » : l'ordre de nos triangles n'est pas modifié (les parties du corps restent alignées)
    SURF.names = d.bones;                                                     // pour diagnostiquer : à quel os appartient un triangle
    SURF.ok = SURF.bones.every((i) => i >= 0);
    if (!SURF.ok) console.warn('surface du corps : os introuvables', d.bones.filter((_, k) => SURF.bones[k] < 0));
  }).catch((e) => console.warn('surface du corps', e));
  return SURF.loading;
}
/* remet le corps de collision dans la pose affichée (une fois par image, seulement si on en a besoin) */
const _MF = new WeakMap();
function _morphF32(a) { let f = _MF.get(a); if (f) return f; f = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); } _MF.set(a, f); return f; }
function surfUpdate() {
  if (!SURF.ok || !SURF.dirty) return SURF.ok;
  const t0 = performance.now(), sk = SKIN.mesh.skeleton, M = SURF.M, nb = SURF.bones.length;
  rig.updateMatrixWorld(true);
  // La VRAIE formule du GPU : monde = matrixWorld · bindMatrixInverse · Σ(w·os) · bindMatrix · p
  // (sans bindMatrix ni matrixWorld, le corps de collision vivait dans un autre espace : décalé et plus petit que la peau affichée — vu à l'image)
  if (!SURF.pre) SURF.pre = new THREE.Matrix4(); SURF.pre.multiplyMatrices(SKIN.mesh.matrixWorld, SKIN.mesh.bindMatrixInverse);
  for (let k = 0; k < nb; k++) { _sf.m.multiplyMatrices(sk.bones[SURF.bones[k]].matrixWorld, sk.boneInverses[SURF.bones[k]]); _sf.m.premultiply(SURF.pre).multiply(SKIN.mesh.bindMatrix); _sf.m.toArray(M, k * 16); }
  { const hp = SKIN.mesh.geometry.attributes.position;                       // la peau a été retouchée depuis (aréoles, sculpture au chargement…) : on reprend ses positions
    if (hp.version !== SURF.ver) { SURF.ver = hp.version; for (let v = 0; v < SURF.nv; v++) { const i = SURF.src[v]; if (i >= 0) { SURF.rest[v * 3] = hp.getX(i); SURF.rest[v * 3 + 1] = hp.getY(i); SURF.rest[v * 3 + 2] = hp.getZ(i); } } } }
  const R = SURF.rest, P = SURF.pos, ji = SURF.ji, jw = SURF.jw, nv = SURF.nv, src = SURF.src, MT = SURF.morph, inf = SKIN.mesh.morphTargetInfluences, act = [];
  if (MT && inf && SURF.morphRel) for (let k = 0; k < MT.length; k++) if (Math.abs(inf[k]) > 1e-4) act.push([_morphF32(MT[k]), inf[k], 3]);   // décodée UNE fois (formes entrelacées et compressées : l'accès brut serait faux), puis tableau simple — l'accesseur getX par sommet coûtait l'essentiel du temps
  const H = SURF.h, n0 = H ? H.n0 : nv;
  if (H) {                                                                   // matrices de la TÊTE : même formule GPU, mais avec le mesh « Body » (son squelette, son bind, ses matrices)
    const hm = H.mesh, hsk = hm.skeleton, MH = H.M;
    H.pre.multiplyMatrices(hm.matrixWorld, hm.bindMatrixInverse);
    for (let k = 0; k < H.bones.length; k++) { const bi = H.bones[k]; if (bi < 0) continue; _sf.m.multiplyMatrices(hsk.bones[bi].matrixWorld, hsk.boneInverses[bi]); _sf.m.premultiply(H.pre).multiply(hm.bindMatrix); _sf.m.toArray(MH, bi * 16); }
  }
  const hMT = H && H.mesh.geometry.morphAttributes.position, hInf = H && H.mesh.morphTargetInfluences, hAct = [];
  if (hMT && hInf && H.mesh.geometry.morphTargetsRelative) for (let k = 0; k < hMT.length; k++) if (Math.abs(hInf[k]) > 1e-4) hAct.push([_morphF32(hMT[k]), hInf[k], 3]);
  for (let v = 0; v < nv; v++) {
    const tete = v >= n0, MM = tete ? H.M : M;
    let x = R[v * 3], y = R[v * 3 + 1], z = R[v * 3 + 2], px = 0, py = 0, pz = 0;
    if (tete) { const i = H.src[v - n0]; for (let q = 0; q < hAct.length; q++) { const A = hAct[q][0], w = hAct[q][1], o = i * hAct[q][2]; x += A[o] * w; y += A[o + 1] * w; z += A[o + 2] * w; } }
    else { const i = src[v]; if (i >= 0) for (let q = 0; q < act.length; q++) { const A = act[q][0], w = act[q][1], o = i * act[q][2]; x += A[o] * w; y += A[o + 1] * w; z += A[o + 2] * w; } }
    for (let k = 0; k < 4; k++) {
      const w = jw[v * 4 + k]; if (w === 0) continue; const o = ji[v * 4 + k] * 16;
      px += w * (MM[o] * x + MM[o + 4] * y + MM[o + 8] * z + MM[o + 12]); py += w * (MM[o + 1] * x + MM[o + 5] * y + MM[o + 9] * z + MM[o + 13]); pz += w * (MM[o + 2] * x + MM[o + 6] * y + MM[o + 10] * z + MM[o + 14]);
    }
    P[v * 3] = px; P[v * 3 + 1] = py; P[v * 3 + 2] = pz;
  }
  // normales lisses (pour que la main glisse sans à-coup d'un triangle à l'autre)
  const N = SURF.nor, I = SURF.idx; N.fill(0);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b] += nx; N[b + 1] += ny; N[b + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
  }
  SURF.geo.attributes.position.needsUpdate = true;
  SURF.bvh.refit();
  SURF.dirty = false; SURF.ms = performance.now() - t0; if (typeof PERF !== 'undefined') { PERF.cur.surf += SURF.ms; PERF.cur.nsurf++; }
  return true;
}
/* point de peau le plus proche de p (monde). excl : 1 ou 2 pour ignorer le bras gauche ou droit (la main qui touche).
   Remplit out.point, out.normal ; renvoie la distance signée (négative si p est sous la peau), ou null si rien à moins de maxDist. */
function surfClosest(p, excl, out, maxDist = Infinity, pref = null) {
  if (!SURF.ok) return null;
  let best = maxDist * maxDist, bt = -1; const part = SURF.part;
  SURF.bvh.shapecast({
    boundsTraverseOrder: (box) => _sf.box.copy(p).clamp(box.min, box.max).distanceToSquared(p),
    intersectsBounds: (box, isLeaf, score) => score < best,
    intersectsTriangle: (tri, ti) => {
      const oi = ti;                                                                         // three-mesh-bvh 0.9.18 : en « indirect », shapecast livre DÉJÀ l'indice d'origine (vérifié par force brute — le re-résoudre le corrompait : verrous posés sur des triangles de la tête pour un sein)
      if (excl && (excl === 3 ? (part[oi] === 1 || part[oi] === 2) : part[oi] === excl)) return false;   // 3 : ignorer les DEUX bras (geste où l'autre main tient la zone : la plante tenue par la main droite)
      tri.closestPointToPoint(p, _sf.t); const d = _sf.t.distanceToSquared(p);
      if (d < best) {
        if (pref) {                                                                          // garde de FACE : seule la peau dont la normale regarde VERS L'EXTÉRIEUR de la zone compte (indice d'auteur : la direction du décalage de la zone) — un témoin-point rasait les joues et rejetait la bonne face, vu
          _sf.fn.subVectors(tri.b, tri.a).cross(_sf.e2.subVectors(tri.c, tri.a));
          if (_sf.fn.dot(pref) <= 0) return false;
        }
        best = d; bt = oi; _sf.q.copy(_sf.t);
      }
      return false;
    },
  });
  if (bt < 0) return pref ? surfClosest(p, excl, out, maxDist, null) : null;                 // rien du bon côté (paume déjà enfoncée…) : on reprend sans la garde
  const I = SURF.idx, P = SURF.pos, N = SURF.nor, a = I[bt * 3], b = I[bt * 3 + 1], c = I[bt * 3 + 2];
  _sf.a.fromArray(P, a * 3); _sf.b.fromArray(P, b * 3); _sf.c.fromArray(P, c * 3);
  THREE.Triangle.getBarycoord(_sf.q, _sf.a, _sf.b, _sf.c, _sf.bc);
  _sf.n.set(0, 0, 0).addScaledVector(_sf.a.fromArray(N, a * 3).normalize(), _sf.bc.x).addScaledVector(_sf.b.fromArray(N, b * 3).normalize(), _sf.bc.y).addScaledVector(_sf.c.fromArray(N, c * 3).normalize(), _sf.bc.z).normalize();
  const d = Math.sqrt(best), inside = _sf.p.copy(p).sub(_sf.q).dot(_sf.n) < 0;
  if (out) { (out.point || (out.point = new THREE.Vector3())).copy(_sf.q); (out.normal || (out.normal = new THREE.Vector3())).copy(_sf.n); out.tri = bt; (out.bary || (out.bary = new THREE.Vector3())).copy(_sf.bc); }
  return inside ? -d : d;
}
function surfTriBone(ti) {                                                    // l'os dominant du triangle (diagnostic)
  if (ti == null || ti < 0 || !SURF.names) return '?';
  const v = SURF.idx[ti * 3]; let bw = -1, bi = 0;
  for (let k = 0; k < 4; k++) if (SURF.jw[v * 4 + k] > bw) { bw = SURF.jw[v * 4 + k]; bi = SURF.ji[v * 4 + k]; }
  return SURF.names[bi];
}
/* Ancre de contact VERROUILLÉE (recette des jeux : on choisit le point de peau une fois, puis il SUIT la chair ;
   le rechoisir à chaque image fait sauter la main d'un pan de peau à l'autre — vu : paume qui se retourne en pleine caresse). */
const SLOCK = { l: null, r: null };
function lockPoint(L, out) {
  const I = SURF.idx, P = SURF.pos, N = SURF.nor, a = I[L.tri * 3], b = I[L.tri * 3 + 1], c = I[L.tri * 3 + 2], w = L.b;
  (out.point || (out.point = new THREE.Vector3())).set(
    P[a * 3] * w.x + P[b * 3] * w.y + P[c * 3] * w.z,
    P[a * 3 + 1] * w.x + P[b * 3 + 1] * w.y + P[c * 3 + 1] * w.z,
    P[a * 3 + 2] * w.x + P[b * 3 + 2] * w.y + P[c * 3 + 2] * w.z);
  (out.normal || (out.normal = new THREE.Vector3())).set(
    N[a * 3] * w.x + N[b * 3] * w.y + N[c * 3] * w.z,
    N[a * 3 + 1] * w.x + N[b * 3 + 1] * w.y + N[c * 3 + 1] * w.z,
    N[a * 3 + 2] * w.x + N[b * 3 + 2] * w.y + N[c * 3 + 2] * w.z).normalize();
  out.tri = L.tri;
}

/* ══ MAIN POSÉE SUR UNE SURFACE (recette des jeux : cible d'IK au point de contact, main orientée selon la normale) ══
   La paume vient se poser exactement sur la peau, tournée vers elle, et y reste pendant que la main se déplace (caresse) : elle suit le relief. */
const TOUCHW = { l: 0, r: 0 }, SURFREQ = { l: null, r: null };                         // poids du toucher en cours, par main (les autres corrections de bras se taisent alors)
const SUPPORT = { l: 0, r: 0 };
const IMPACT = { q: [] };                                                              // chocs à injecter dans la chair cette image : { motif d'os, impulsion locale (m/s) }                                                        // la main PORTE la chair (sein) : 0..1 — le jig remonte et s'amortit sous la paume
const PALM = { along: 0.075, out: 0.012, gap: 0.002 };  // centre de la paume : à 7,5 cm du poignet vers les doigts, 1,2 cm côté paume ; 2 mm d'air
const _hs = { P3b: new THREE.Vector3(), r2: new THREE.Quaternion(), q2: new THREE.Quaternion(), q3: new THREE.Quaternion(), pq2: new THREE.Quaternion(), P2: new THREE.Vector3(), P3: new THREE.Vector3(), q: new THREE.Quaternion(), pq: new THREE.Quaternion(), r: new THREE.Quaternion(), H: new THREE.Vector3(), P: new THREE.Vector3(), N: new THREE.Vector3(), T: new THREE.Vector3(), o: {}, fr: {}, I: new THREE.Quaternion() };
/* ══ LIRE dans l'espace AFFICHÉ, ÉCRIRE sur le rig normalisé ══
   Le vrai squelette (celui que l'écran montre) porte une échelle (1,12 aux hanches) : le rig normalisé — où s'écrivent les poses —
   et lui divergent de 1 à 3 cm en position. Tout ce qui POSE la main lit donc les positions du vrai squelette,
   via un écart (vrai − normalisé) par articulation, capturé une fois par image (bug vu : paume « parfaite » à 2 cm de la vraie peau). */
const _RAWN = new Map(), _NRD = new Map(), _nrT = new THREE.Vector3();
function rawOf(n) {
  if (!n || !SKIN.mesh) return n;
  let r = _RAWN.get(n); if (r !== undefined) return r || n;
  const nm = n.name.replace('Normalized_', '');
  r = SKIN.mesh.skeleton.bones.find((o) => o.name === nm) || null;
  _RAWN.set(n, r); return r || n;
}
function _nrdCap(n) { const r = rawOf(n); let d = _NRD.get(n); if (!d) { d = new THREE.Vector3(); _NRD.set(n, d); } if (r === n) { d.set(0, 0, 0); return; } r.getWorldPosition(d).sub(n.getWorldPosition(_nrT)); }
function surfDeltas(b) {                                  // en début de passe (après vrm.update) : les écarts de l'image en cours
  for (const hk of ['l', 'r']) {
    const hand = hk === 'l' ? b.lHand : b.rHand, set = b.hand && b.hand[hk]; if (!hand || !set) continue;
    _nrdCap(hand);
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) { const ch = set[f]; if (ch) for (const j of ch) _nrdCap(j); }
  }
}
function wpos(n, out) { n.getWorldPosition(out); const d = _NRD.get(n); if (d) out.add(d); return out; }
function surfPropagate(b) {                               // recopie rig → squelette affiché (+ contraintes de torsion de l'avant-bras), puis écarts à jour
  try { vrm.humanoid.update(); if (vrm.nodeConstraintManager) vrm.nodeConstraintManager.update(); } catch (_) {}
  surfDeltas(b);
}
/* Le repère de la paume, bâti UNIQUEMENT sur les positions affichées (les rotations du vrai squelette ont un repos
   non trivial : ses quaternions ne se comparent pas à ceux du rig). Prouvé par sonde : un doigt qui se plie part vers +n. */
const _rf = { h: new THREE.Vector3(), m: new THREE.Vector3(), i: new THREE.Vector3(), l: new THREE.Vector3(), t: new THREE.Vector3() };
function rawPalmFrame(b, hk, F, N2) {
  const set = b.hand && b.hand[hk], hand = hk === 'l' ? b.lHand : b.rHand;
  if (!set || !set.Middle || !set.Index || !set.Little || !set.Middle[0]) return false;
  wpos(hand, _rf.h); wpos(set.Middle[0], _rf.m); wpos(set.Index[0], _rf.i); wpos(set.Little[0], _rf.l);
  F.copy(_rf.m).sub(_rf.h).normalize();
  _rf.t.copy(_rf.i).sub(_rf.l); _rf.t.addScaledVector(F, -_rf.t.dot(F)).normalize();
  N2.crossVectors(F, _rf.t).normalize(); if (hk === 'l') N2.negate();
  return true;
}
function tipPoint(b, hk, hand, P, N) {                 // bout de l'index (la pulpe du doigt est du côté de la paume)
  const set = b.hand && b.hand[hk], ch = set && set.Index; if (!ch || !ch.length) return false;
  if (!rawPalmFrame(b, hk, _hs.T, N)) return false;                                      // N = paume, dans l'espace affiché
  const last = ch[ch.length - 1], prev = ch.length > 1 ? ch[ch.length - 2] : hand;
  wpos(last, _hs.P2); wpos(prev, _hs.P3);
  P.copy(_hs.P2).sub(_hs.P3).normalize().multiplyScalar(0.021).add(_hs.P2);
  return true;
}
function palmPoint(b, hk, hand, P, N) {                // centre de la paume et direction de la paume, dans le monde
  if (!rawPalmFrame(b, hk, _hs.P3, N)) return false;                                     // _hs.P3 = direction des doigts, N = paume, espace affiché
  wpos(hand, _hs.H);
  P.copy(_hs.P3).multiplyScalar(PALM.along).add(_hs.H).addScaledVector(N, PALM.out);
  return true;
}
function surfAimWrist(b, hk, hand, zo, tg0) {           // où viser le POIGNET (rig) pour que la PAUME AFFICHÉE tombe pile sur la zone (recette des jeux : le décalage paume-poignet est dans la cible d'IK, pas rattrapé après)
  surfDeltas(b);
  if (!rawPalmFrame(b, hk, _hs.P3, _hs.N)) { tg0.copy(zo.point).addScaledVector(zo.normal, 0.045); return tg0; }
  // le décalage paume→poignet est pris dans la POSE FINALE PRÉVUE (paume face à la peau, doigts couchés sur elle),
  // pas dans la pose du moment — sinon la cible danse à chaque image (vu : oscillation entraînée)
  _hs.T.copy(_hs.P3).addScaledVector(zo.normal, -_hs.P3.dot(zo.normal));                 // direction des doigts, couchée sur le plan de la peau
  if (_hs.T.lengthSq() < 1e-4) _hs.T.set(0, -1, 0).addScaledVector(zo.normal, zo.normal.y);
  _hs.T.normalize();
  tg0.copy(zo.point).addScaledVector(zo.normal, PALM.gap + PALM.out).addScaledVector(_hs.T, -PALM.along);
  const d = _NRD.get(hand); if (d) tg0.sub(d);          // l'IK pilote le rig : on retranche l'écart rig→affiché
  return tg0;
}
/* ══ MAIN POSÉE : UN SEUL MAÎTRE, UN BUT CONSTANT (recette des jeux à contact : Uncharted, TLOU) ══
   Pendant le toucher, CE système possède le poignet. Le but ne dépend JAMAIS de la pose du moment :
   il est bâti sur (1) l'ancre de peau verrouillée, (2) la direction de doigts GELÉE au verrouillage,
   (3) le décalage contact→poignet mesuré UNE FOIS (anatomie de la main, constante dans son repère).
   La passe de chaque image réapplique le même but → stable par construction (fini, les buts qui dansent). */
const HGOAL = { l: null, r: null };
const _hg = { f1: new THREE.Vector3(), t1: new THREE.Vector3(), n1: new THREE.Vector3(), f2: new THREE.Vector3(), t2: new THREE.Vector3(), n2: new THREE.Vector3(), m: new THREE.Matrix4(), q1: new THREE.Quaternion(), q2: new THREE.Quaternion(), R: new THREE.Quaternion(), W: new THREE.Vector3() };
function handOnSurface(b, hk, up, lo, hand, w, pole, tip, tg, key, pref, ref, glide, fdir) {
  if (!SURF.ok || w < 0.02 || window.__noSurfHand || !hand) return;
  const ptFn = tip ? tipPoint : palmPoint, gap = tip ? 0.001 : PALM.gap;
  surfUpdate(); surfDeltas(b); const excl = SURF.xb && SURF.xb[hk] ? 3 : (hk === 'l' ? 1 : 2);
  const G = HGOAL[hk] && HGOAL[hk].key === key ? HGOAL[hk] : (HGOAL[hk] = { key, f: new THREE.Vector3(), of: null, frozen: false });
  // 1. L'ANCRE : le point de peau de la zone visée, verrouillé dès que le contact est bon
  let L = SLOCK[hk]; if (L && (glide || L.key !== key || w < 0.3)) L = SLOCK[hk] = null;   // en glisse : jamais de verrou, l'ancre suit la graine qui caresse
  if (L) lockPoint(L, _hs.o);
  else { ptFn(b, hk, hand, _hs.P, _hs.N); if (surfClosest(tg || _hs.P, excl, _hs.o, 0.45, pref || null) === null) return; }   // garde de face : la direction d'extérieur de la zone (indice d'auteur)
  if (glide) {                                                                            // caresse : l'ancre re-choisie à chaque image est LISSÉE — sans filtre, la poursuite d'une cible mobile saccade (pics à 300 cm/s, vu)
    if (!G.op) G.op = _hs.o.point.clone();
    else { const kk = 1 - Math.exp(-(window.__dt || 0.016) * 9);
      G.op.lerp(_hs.o.point, kk);
      if (surfClosest(G.op, excl, _hs.o, 0.12, null) !== null) G.op.copy(_hs.o.point);   // lissée PUIS re-projetée sur la peau (la moyenne brute coupe à travers le bras, vu) ; la normale vient de la re-projection, jamais d'une moyenne (elle traînait à 40°, vu)
      else _hs.o.point.copy(G.op); }
  }
  // 2. LE BUT — repère voulu de la main : paume face à la peau, doigts couchés sur elle
  if (!rawPalmFrame(b, hk, _hg.f1, _hg.n1)) return; _hg.t1.crossVectors(_hg.n1, _hg.f1).normalize();
  if (!G.of) {                                                               // décalage contact→poignet dans le repère de la main : constante anatomique, mesurée une fois par geste
    ptFn(b, hk, hand, _hs.P, _hs.N); wpos(hand, _hs.H); _hs.T.copy(_hs.P).sub(_hs.H);
    G.of = _hs.T.dot(_hg.f1); G.ot = _hs.T.dot(_hg.t1); G.on = _hs.T.dot(_hg.n1);
  }
  _hg.n2.copy(_hs.o.normal).negate();                                        // paume voulue : vers la peau
  if (fdir) { G.f.copy(fdir); G.fd = true; }                                 // direction de doigts VOULUE par la zone (porter : vers l'avant, sous la masse)
  else { G.fd = false; if (!G.frozen) G.f.copy(_hg.f1); }                    // sinon : celle de l'approche, GELÉE au verrouillage
  _hg.f2.copy(G.f).addScaledVector(_hg.n2, -G.f.dot(_hg.n2));
  if (_hg.f2.lengthSq() < 1e-4) _hg.f2.copy(_hg.t1).addScaledVector(_hg.n2, -_hg.t1.dot(_hg.n2));
  _hg.f2.normalize(); _hg.t2.crossVectors(_hg.n2, _hg.f2).normalize();
  // 3. ORIENTATION : la rotation-monde qui amène (f1,t1,n1) sur (f2,t2,n2), dosée par w
  _hg.m.makeBasis(_hg.f1, _hg.t1, _hg.n1); _hg.q1.setFromRotationMatrix(_hg.m);
  _hg.m.makeBasis(_hg.f2, _hg.t2, _hg.n2); _hg.q2.setFromRotationMatrix(_hg.m);
  _hg.R.copy(_hg.q1).invert().premultiply(_hg.q2);                           // R = q2 · q1⁻¹ (delta-monde)
  _hg.R.copy(_hs.I.clone().slerp(_hg.R, w));
  hand.getWorldQuaternion(_hs.q); _hg.R.multiply(_hs.q);
  hand.parent.getWorldQuaternion(_hs.pq); hand.quaternion.copy(_hs.pq.invert().multiply(_hg.R)); hand.updateWorldMatrix(false, false);
  // 4. POSITION : le poignet (affiché) doit être là pour que le contact tombe sur l'ancre — cible constante, IK dosée par w
  _hg.W.copy(_hs.o.point).addScaledVector(_hg.n2, -gap)
    .addScaledVector(_hg.f2, -G.of).addScaledVector(_hg.t2, -G.ot).addScaledVector(_hg.n2, -G.on);
  { const d = _NRD.get(hand); if (d) _hg.W.sub(d); }                         // l'IK pilote le rig : on retranche l'écart rig→affiché
  hand.getWorldQuaternion(_hs.q); const keep = _hs.q.clone();
  armIK(up, lo, hand, _hg.W, pole, w);
  hand.parent.getWorldQuaternion(_hs.pq); hand.quaternion.copy(_hs.pq.invert().multiply(keep));
  // 4 bis. RETOUCHE EN BOUCLE FERMÉE (recette des jeux : une passe de finition SUR LE RÉSULTAT AFFICHÉ) :
  // on recopie vers le vrai squelette, on MESURE où la paume est vraiment, et on corrige le but de l'écart constaté.
  // C'est elle qui absorbe tout ce que le modèle de but ne sait pas prévoir (torsions d'avant-bras, décalages d'échelle).
  for (let it = 0; it < 2; it++) {
    surfPropagate(b); ptFn(b, hk, hand, _hs.P, _hs.N);
    _hs.T.copy(_hs.o.point).addScaledVector(_hg.n2, -gap).sub(_hs.P);                     // écart RÉEL paume → point voulu
    { const o2 = _hs.o2 || (_hs.o2 = {}); const dpen = surfClosest(_hs.P, excl, o2, 0.2); // garde-fou : AUCUNE autre peau traversée (vu : la caresse de l'avant-bras enfonçait la main dans le ventre dessous)
      if (dpen !== null && dpen < gap && o2.point.distanceTo(_hs.o.point) > 0.03 && SURF.tb && SURF.tb[o2.tri] !== SURF.tb[_hs.o.tri]) { /* une AUTRE partie du corps (os différent) : sur un même os rigide (crâne), le galbe de la zone n'est pas une pénétration (vu : front repoussé de 15 mm) */ _hs.T.addScaledVector(o2.normal, gap - dpen); if (window.__guardLog) window.__guardLog.push([+(dpen*1000).toFixed(1), surfTriBone(o2.tri), o2.point.toArray().map((x) => +x.toFixed(3)), o2.normal.toArray().map((x) => +x.toFixed(2)), _hs.P.toArray().map((x) => +x.toFixed(3)), _hs.o.point.toArray().map((x) => +x.toFixed(3)), o2.tri]); } }
    if (_hs.T.lengthSq() < 1e-6) break;
    { const l = _hs.T.length(), mx = 0.08; if (l > mx) _hs.T.multiplyScalar(mx / l); }
    hand.getWorldQuaternion(_hs.q); const keep2 = _hs.q.clone();
    hand.getWorldPosition(_hs.H); _hs.H.addScaledVector(_hs.T, w);                        // le rig et l'affiché bougent du même vecteur : pas d'écart à retrancher
    armIK(up, lo, hand, _hs.H, pole, 1);
    hand.parent.getWorldQuaternion(_hs.pq); hand.quaternion.copy(_hs.pq.invert().multiply(keep2));
  }
  // 5. VERROU : il se pose quand le contact est bon, gèle la direction des doigts, et lâche si l'ancre devient injouable
  surfPropagate(b); ptFn(b, hk, hand, _hs.P, _hs.N);
  const dd = _hs.P.distanceTo(_hs.o.point), al = Math.acos(Math.max(-1, Math.min(1, -_hs.N.dot(_hs.o.normal)))), Lk = SLOCK[hk];
  if (!Lk) { if (key && !glide && w > 0.6 && dd < 0.035 && al < 0.6 && _hs.o.tri >= 0 && _hs.o.bary && (!ref || _hs.o.point.distanceTo(ref) < 0.10)) { SLOCK[hk] = { key, tri: _hs.o.tri, b: _hs.o.bary.clone(), ref: ref && ref.clone(), bad: 0 }; G.frozen = true; if (window.__lockLog) { const chk = {}; lockPoint(SLOCK[hk], chk); window.__lockLog.push({ t: +((window.__t.gst && window.__t.gst.t) || 0).toFixed(2), hk, key, tri: _hs.o.tri, o: _hs.o.point.toArray().map((x) => +x.toFixed(3)), relu: chk.point.toArray().map((x) => +x.toFixed(3)), ecart: +chk.point.distanceTo(_hs.o.point).toFixed(3) }); } } }
  else if (dd > 0.06 || al > 1.1 || (ref && _hs.o.point.distanceTo(ref) > 0.16)) { Lk.bad = (Lk.bad || 0) + (window.__dt || 0.016); if (Lk.bad > 0.35) { SLOCK[hk] = null; G.frozen = false; if (window.__lockLog) window.__lockLog.push({ t: +((window.__t.gst && window.__t.gst.t) || 0).toFixed(2), hk, rel: 1, dd: +dd.toFixed(3), al: +(al * 57.3).toFixed(0), rd: ref ? +_hs.o.point.distanceTo(ref).toFixed(3) : null, refv: ref && ref.toArray().map((x) => +x.toFixed(3)), ov: _hs.o.point.toArray().map((x) => +x.toFixed(3)) }); } }
  else Lk.bad = 0;
  if (window.__hsdbg) window.__hsdbg.push({ hk, rd: ref ? +_hs.o.point.distanceTo(ref).toFixed(3) : null, ref: ref && ref.toArray().map((x) => +x.toFixed(3)), tg: tg && tg.toArray().map((x) => +x.toFixed(3)), P: _hs.P.toArray().map((x) => +x.toFixed(3)), o: _hs.o.point.toArray().map((x) => +x.toFixed(3)), W: _hg.W.toArray().map((x) => +x.toFixed(3)), dd: +dd.toFixed(3), al: +(al * 57.3).toFixed(0), w: +w.toFixed(2), os: surfTriBone(_hs.o.tri), lk: !!SLOCK[hk], fz: G.frozen });
  if (window.__palmDbg) { window.__palmDbg[hk] = al; hand.getWorldQuaternion(_hs.q); window.__palmDbg[hk + 'q'] = _hs.q.toArray(); }
}
/* mesure (tests et diagnostics) : où en est la main par rapport à la peau */
const _tipP = new THREE.Vector3();
function surfPalm(b, hk) {
  const hand = hk === 'l' ? b.lHand : b.rHand, set = b.hand && b.hand[hk]; if (!SURF.ok || !hand || !set) return null;
  SURF.dirty = true; surfUpdate(); surfDeltas(b); const excl = SURF.xb && SURF.xb[hk] ? 3 : (hk === 'l' ? 1 : 2), P = new THREE.Vector3(), N = new THREE.Vector3(), o = {};
  if (!palmPoint(b, hk, hand, P, N)) return null;
  const d = surfClosest(P, excl, o, 0.5); if (d === null) return null;
  let dz = null, angz = null;                                                // distance ET angle par rapport à la CIBLE DU TOUCHER : l'ancre verrouillée (la vérité du contact) sinon le point de zone
  { const oz = {}; let ok = false;
    if (SLOCK[hk] && SLOCK[hk].tri >= 0) { lockPoint(SLOCK[hk], oz); ok = true; }
    else if (window.__lastTg && window.__lastTg[hk]) ok = surfClosest(window.__lastTg[hk], excl, oz, 0.6) !== null;
    if (ok) { dz = P.distanceTo(oz.point) * (d < 0 ? -1 : 1); angz = Math.acos(Math.max(-1, Math.min(1, -N.dot(oz.normal)))); } }
  const tips = {}; const pn = new THREE.Vector3(), pf = new THREE.Vector3();
  rawPalmFrame(b, hk, pf, pn);                                                           // paume dans l'espace affiché
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) { const c = set[f]; if (c && c.length) {
    const t = wpos(c[c.length - 1], new THREE.Vector3()), pv = wpos(c.length > 1 ? c[c.length - 2] : hand, new THREE.Vector3());
    t.add(pv.sub(t).normalize().multiplyScalar(-0.021)).addScaledVector(pn, 0.004);   // la PULPE du bout du doigt (côté paume), comme le contrôleur
    tips[f] = surfClosest(t, excl, null, 0.5);
    if (f === 'Index') { _tipP.copy(t); } } }
  // mesure du BOUT DE L'INDEX (zones fines : le contact se fait à la pulpe, pas à la paume) : distance à la peau et à la cible verrouillée
  let tipDz = null; { const oz = {}; let ok = false;
    if (SLOCK[hk] && SLOCK[hk].tri >= 0) { lockPoint(SLOCK[hk], oz); ok = true; }
    else if (window.__lastTg && window.__lastTg[hk]) ok = surfClosest(window.__lastTg[hk], excl, oz, 0.6) !== null;
    if (ok) tipDz = _tipP.distanceTo(oz.point); }
  return { tipD: tips.Index, tipDz, d, dz, angz, angle: Math.acos(Math.max(-1, Math.min(1, -N.dot(o.normal)))), tips, p: P.toArray() };
}

/* ══ DOIGTS QUI ÉPOUSENT LA FORME (recette standard en réalité virtuelle : chaque doigt se referme JUSQU'AU CONTACT, jamais au travers) ══
   Pour chaque doigt, on cherche par dichotomie le repli le plus grand qui laisse ses phalanges et sa pulpe AU-DESSUS de la peau (1 mm d'air),
   puis le bout du doigt vient se poser. Le repli évolue en douceur dans le temps (pas de doigts qui claquent), et chaque doigt est indépendant :
   sur une surface bombée, les doigts courts se replient plus, exactement comme une vraie main épouse un galbe. */
const FCONF = { r: {}, l: {} };                                              // repli lissé par doigt (persistant d'une image à l'autre)
const _fc = { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), o: {}, q: new THREE.Quaternion() };
const FING_CURL_W = [1.0, 0.85, 0.55];                                       // répartition du repli : la base plie le plus, le bout accompagne
function fingerPoints(set, f, hand, palmN, out) {                            // points à tester : 2e et 3e articulations + pulpe du bout
  const ch = set[f]; let n = 0;
  for (let i = 1; i < ch.length; i++) { wpos(ch[i], out[n].p); out[n].r = 0.0062; n++; }
  const last = ch[ch.length - 1], prev = ch.length > 1 ? ch[ch.length - 2] : hand;
  wpos(last, _fc.p); wpos(prev, _fc.t);
  out[n].p.copy(_fc.p).sub(_fc.t).normalize().multiplyScalar(0.021).add(_fc.p).addScaledVector(palmN, 0.004);   // pulpe : côté paume
  out[n].r = 0.002; n++;                                                     // la pulpe s'écrase : elle peut venir à 2 mm
  return n;
}
function fingerSetCurl(set, f, sg, t, isThumb) {                             // pose le repli t (-0,5..1) sur le doigt ; t négatif = doigt qui se cambre en arrière (dos de la main sur une pente qui monte)
  const ch = set[f];
  for (let i = 0; i < ch.length; i++) {
    if (isThumb) { const c = Math.max(0, t) * [0.5, 0.8, 0.9][i]; ch[i].rotation.x = -c * 0.8; ch[i].rotation.z = sg * c * 0.5; }   // sonde : −x = flexion vers la paume (les 2 mains, n·0,99), z·sg = adduction
    else ch[i].rotation.z = sg * (t >= 0 ? t * FING_CURL_W[i] * FING_ROM[i] : t * 2 * FING_HYP[i]);
  }
  ch[0].updateWorldMatrix(true, true);
}
const _fpts = [{ p: new THREE.Vector3(), r: 0 }, { p: new THREE.Vector3(), r: 0 }, { p: new THREE.Vector3(), r: 0 }, { p: new THREE.Vector3(), r: 0 }];
function fingersToSurface(b, hk, w, dt, dfn) {   // dfn(p) : distance signée à une AUTRE surface (objet tenu) — sinon la peau
  if (!SURF.ok || window.__noFingers || w < 0.02) return;
  const set = b.hand && b.hand[hk], hand = hk === 'l' ? b.lHand : b.rHand; if (!set || !hand) return;
  if (!dfn) surfUpdate(); surfPropagate(b);                                   // le bras vient d'être corrigé : relire l'espace affiché avant de replier les doigts
  const excl = hk === 'l' ? 1 : 2, sg = hk === 'r' ? -1 : 1, st = FCONF[hk], gap = 0.001, k = Math.min(1, (dt || 0.016) * 9);   // sg : sens du VRAI repli (sonde : +z gauche / −z droite plient vers la paume, amp 63 mm, n·0,98 — l'ancien signe pliait les doigts À L'ENVERS)
  hand.updateWorldMatrix(true, false); if (!rawPalmFrame(b, hk, _fc.t, _fc.n)) return;    // _fc.n = paume dans l'espace affiché
  const F4 = ['Index', 'Middle', 'Ring', 'Little'], DST = dfn || ((p) => surfClosest(p, excl, null, 0.12));
  const freeF = (f, t) => {
    fingerSetCurl(set, f, sg, t, false);
    const n = fingerPoints(set, f, hand, _fc.n, _fpts);
    for (let i = 0; i < n; i++) { const d = DST(_fpts[i].p); if (d !== null && d < _fpts[i].r + gap) return false; }
    return true;
  };
  // 1. repli COMMUN des quatre doigts (une main épouse d'un seul mouvement), borné à une cambrure discrète (-0,15)
  const freeAll = (t) => { let ok = true; for (const f of F4) if (!freeF(f, t)) ok = false; return ok; };
  let g;
  if (!freeAll(-0.15)) g = -0.15;
  else if (freeAll(0.85)) g = dfn ? 0.85 : 0.3;                            // objet tenu : rien ne bloque → la main se referme (sur la peau : main détendue)
  else { let lo2 = -0.15, hi2 = 0.85; for (let it = 0; it < 6; it++) { const m = (lo2 + hi2) / 2; if (freeAll(m)) lo2 = m; else hi2 = m; } g = lo2; }
  const gc = st._g ?? 0.25; st._g = gc + (g - gc) * k;
  // 2. petit ajustement PAR doigt autour du groupe : chacun vient au contact de son côté du galbe
  for (const f of F4) {
    const lo0 = Math.max(-0.15, st._g - 0.08), hi0 = Math.min(1, st._g + 0.3);
    let target;
    if (!freeF(f, lo0)) target = lo0;
    else if (freeF(f, hi0)) target = dfn ? hi0 : Math.min(hi0, st._g + 0.12);   // objet : le doigt libre enveloppe le bord
    else { let lo2 = lo0, hi2 = hi0; for (let it = 0; it < 5; it++) { const m = (lo2 + hi2) / 2; if (freeF(f, m)) lo2 = m; else hi2 = m; } target = lo2; }
    if (window.__fdbg) window.__fdbg[hk + f] = [+st._g.toFixed(2), +lo0.toFixed(2), +hi0.toFixed(2), +target.toFixed(2), freeF(f, lo0), freeF(f, hi0)];
    const cur = st[f] ?? st._g, next = cur + (target - cur) * k; st[f] = next;
    // 2 bis. le BOUT vient se poser : si une phalange intermédiaire touche déjà (pli, galbe concave), seules les deux dernières phalanges
    // se fléchissent encore jusqu'au contact de la pulpe — comme une vraie main (vu : majeur sous le sein, pulpe à 6-7 mm)
    const ch2 = set[f]; let dx = 0;
    if (ch2 && ch2.length >= 3 && !window.__noDistal) {
      const tryD = (e) => { fingerSetCurl(set, f, sg, target, false); ch2[1].rotation.z += sg * e; ch2[2].rotation.z += sg * e * 0.8; ch2[0].updateWorldMatrix(true, true);
        const n = fingerPoints(set, f, hand, _fc.n, _fpts); for (let i = 0; i < n; i++) { const d = DST(_fpts[i].p); if (d !== null && d < _fpts[i].r + gap) return false; } return true; };
      if (tryD(0)) { if (tryD(0.7)) dx = 0.7; else { let lo2 = 0, hi2 = 0.7; for (let it = 0; it < 5; it++) { const m = (lo2 + hi2) / 2; if (tryD(m)) lo2 = m; else hi2 = m; } dx = lo2; } } }
    const cd = st[f + 'D'] ?? 0, nd = cd + (dx - cd) * k; st[f + 'D'] = nd;
    fingerSetCurl(set, f, sg, (1 - w) * cur + next * w, false);
    if (ch2 && ch2.length >= 3 && nd > 1e-3) { ch2[1].rotation.z += sg * nd * w; ch2[2].rotation.z += sg * nd * 0.8 * w; ch2[0].updateWorldMatrix(true, true); }
  }
  { const ch = set.Thumb;                                                    // 3. pouce : il se soulève juste assez pour sortir du corps, puis se repose
    if (ch && ch.length) {
      const freeT = (t, zz = 0, yy = 0) => {
        ch[0].rotation.x = t; ch[0].rotation.z = sg * zz; ch[0].rotation.y = sg * yy;   // yy : rotation propre de la base (opposition vraie : l'ongle se tourne)   // zz : OPPOSITION (le pouce vient envelopper un galbe qui fuit) for (let i = 1; i < ch.length; i++) { ch[i].rotation.z = sg * 0.15; ch[i].rotation.x = -0.28; }   // phalanges du pouce légèrement fléchies (pouce détendu, pas en baguette)
        ch[0].updateWorldMatrix(true, true);
        const n = fingerPoints(set, 'Thumb', hand, _fc.n, _fpts);
        for (let i = 0; i < n; i++) { const oo = window.__tdbg ? {} : null; const d = dfn ? dfn(_fpts[i].p) : surfClosest(_fpts[i].p, excl, oo, 0.12); if (d !== null && d < _fpts[i].r + gap) { if (window.__tdbg) window.__tdbg.push([+t.toFixed(2), i, +(d * 1000).toFixed(1), surfTriBone(oo.tri), oo.tri]); return false; } }
        return true;
      };
      let target;                                                            // x grand = pouce levé hors du corps ; x petit (négatif) = posé ; on cherche le PLUS POSÉ qui reste libre
      const GG = HGOAL[hk];
      if (dfn) {                                                             // OBJET TENU : recherche en 2D (flexion × opposition) de la pose LIBRE dont la pulpe est la plus près de la surface — le pouce vient en face, comme une vraie pince digitale
        let best = null, bd = 1e9;
        const ev = (x, zz, yy) => { if (!freeT(x, zz, yy)) return; const n = fingerPoints(set, 'Thumb', hand, _fc.n, _fpts), d = dfn(_fpts[n - 1].p); if (d !== null && d < bd) { bd = d; best = [x, zz, yy]; } };
        if ((st.ThumbN = (st.ThumbN || 0) + 1) % 4 === 1 || !st.ThumbB) {         // recherche grossière (1 image sur 4), puis affinage autour du meilleur
          for (let x = 0.4; x >= -0.81; x -= 0.4) for (let zz = 0; zz <= 1.21; zz += 0.4) for (let yy = -0.6; yy <= 0.61; yy += 0.3) ev(x, zz, yy);
        } else best = st.ThumbB, bd = 1e9, ev(best[0], best[1], best[2]);
        if (best) for (const s2 of [0.15, 0.07]) { const c = best.slice(); for (const [i, dv] of [[0, s2], [0, -s2], [1, s2], [1, -s2], [2, s2], [2, -s2]]) { const q = c.slice(); q[i] += dv; ev(q[0], q[1], q[2]); } }
        st.ThumbB = best;
        if (best) { target = best[0]; st.ThumbZt = best[1]; st.ThumbYt = best[2]; } else { target = 0.55; st.ThumbZt = 0; st.ThumbYt = 0; } }
      else if (GG && GG.fd) target = -0.45;                                       // porter : le pouce s'aligne sous la masse avec les doigts (la recherche butait au sillon central, vu : pouce droit levé)
      else if (!freeT(0.55)) target = 0.55;
      else if (freeT(-0.85)) {                                               // posé à fond et toujours en l'air : la surface FUIT sous le pouce (galbe) → il s'oppose jusqu'au contact
        target = -0.6; let lo2 = 0, hi2 = 0.9;
        if (!freeT(-0.6, 0.9)) { for (let it = 0; it < 6; it++) { const m = (lo2 + hi2) / 2; if (freeT(-0.6, m)) lo2 = m; else hi2 = m; } st.ThumbZt = lo2; } else st.ThumbZt = 0.9; }
      else { let hi2 = 0.55, lo2 = -0.85; for (let it = 0; it < 7; it++) { const m = (lo2 + hi2) / 2; if (freeT(m)) hi2 = m; else lo2 = m; } target = hi2; }
      if (!dfn && target !== -0.6) st.ThumbZt = 0;
      const cur = st.ThumbX ?? 0, next = cur + (target - cur) * k; st.ThumbX = next;
      const cz = st.ThumbZ ?? 0, nz = cz + ((st.ThumbZt || 0) - cz) * k; st.ThumbZ = nz;
      const cy = st.ThumbY ?? 0, ny = cy + ((dfn ? st.ThumbYt || 0 : 0) - cy) * k; st.ThumbY = ny;
      freeT((1 - w) * cur + next * w, nz * w, ny * w);
    } }
}
