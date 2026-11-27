/* ══ MOUVEMENTS PRÉPARÉS (la méthode des jeux récents) ══
   Hors ligne (mocap/tools/prep.py), chaque mouvement capturé est nettoyé et annoté une fois pour toutes : pour chaque image on sait
   quel pied est réellement posé (appui) et si le corps est en l'air. Ici, au chargement, on adapte ces appuis au corps d'Aiko
   (ses jambes n'ont pas les proportions de la personne capturée) :
   1. l'échelle du déplacement est recalculée pour que ses pieds posés restent immobiles ;
   2. chaque appui devient un point fixe au sol : on calcule, image par image, de combien déplacer le pied pour qu'il y reste
      (et on raccorde en douceur pendant que le pied est en l'air) ;
   3. les vrais temps de vol (sauts, course) sont conservés : elle décolle vraiment au lieu d'être recollée au sol à chaque image.
   À l'affichage, il ne reste qu'à appliquer ces corrections aux jambes (IK) : aucun calcul d'appui « à la volée », donc aucun clignotement. */

/* rotations compactes : la plus grande composante du quaternion est retirée (retrouvée par le calcul), les 3 autres tiennent sur 15 bits */
function clipDecodeQ3(b64, n, nb) {
  const v = new Uint16Array(_u8(b64)), q = new Float32Array(n * nb * 4), K = 0.7072 / 16383;
  for (let i = 0, o = 0; i < n * nb; i++, o += 4) {
    const a = v[i * 3], b = v[i * 3 + 1], c = v[i * 3 + 2], big = (a >> 15) | ((b >> 15) << 1);
    const r0 = ((a & 32767) - 16384) * K, r1 = ((b & 32767) - 16384) * K, r2 = ((c & 32767) - 16384) * K;
    q[o + big] = Math.sqrt(Math.max(0, 1 - r0 * r0 - r1 * r1 - r2 * r2));
    q[o + (big + 1) % 4] = r0; q[o + (big + 2) % 4] = r1; q[o + (big + 3) % 4] = r2;
  }
  for (let j = 0; j < nb; j++) for (let i = 1; i < n; i++) {                 // même « signe » d'une image à l'autre : l'interpolation reste lisse
    const m = (i * nb + j) * 4, p = m - nb * 4;
    if (q[m] * q[p] + q[m + 1] * q[p + 1] + q[m + 2] * q[p + 2] + q[m + 3] * q[p + 3] < 0) { q[m] = -q[m]; q[m + 1] = -q[m + 1]; q[m + 2] = -q[m + 2]; q[m + 3] = -q[m + 3]; }
  }
  return q;
}

/* interpolation lisse entre les images (Catmull-Rom) : la vitesse ne change plus brusquement à chaque image enregistrée */
const _crw = [0, 0, 0, 0];
function crWeights(f) { const f2 = f * f, f3 = f2 * f; _crw[0] = -0.5 * f + f2 - 0.5 * f3; _crw[1] = 1 - 2.5 * f2 + 1.5 * f3; _crw[2] = 0.5 * f + 2 * f2 - 1.5 * f3; _crw[3] = -0.5 * f2 + 0.5 * f3; return _crw; }
function crIdx(c, fr, out) {                                                 // les 4 images autour de l'instant demandé
  const n = c.n; let i1 = Math.floor(fr);
  if (c.loop) { i1 = ((i1 % n) + n) % n; out[0] = (i1 + n - 1) % n; out[1] = i1; out[2] = (i1 + 1) % n; out[3] = (i1 + 2) % n; }
  else { i1 = Math.max(0, Math.min(n - 1, i1)); out[0] = Math.max(0, i1 - 1); out[1] = i1; out[2] = Math.min(n - 1, i1 + 1); out[3] = Math.min(n - 1, i1 + 2); }
  return out;
}
function crScalar(a, I, W) { return a[I[0]] * W[0] + a[I[1]] * W[1] + a[I[2]] * W[2] + a[I[3]] * W[3]; }
function crQuat(q, nb, j, I, W, m, out) {                                    // m : miroir (−1) ou non (1)
  const p1 = (I[1] * nb + j) * 4; let x = 0, y = 0, z = 0, w = 0;
  for (let k = 0; k < 4; k++) {
    const p = (I[k] * nb + j) * 4;
    const s = (q[p] * q[p1] + q[p + 1] * q[p1 + 1] + q[p + 2] * q[p1 + 2] + q[p + 3] * q[p1 + 3] < 0 ? -1 : 1) * W[k];
    x += q[p] * s; y += q[p + 1] * s; z += q[p + 2] * s; w += q[p + 3] * s;
  }
  const l = 1 / (Math.sqrt(x * x + y * y + z * z + w * w) || 1);
  return out.set(x * l, m * y * l, m * z * l, w * l);
}

/* Adaptation au squelette d'Aiko : la personne capturée et Aiko n'ont pas la même pose de repos (jambes du squelette de capture écartées
   de 20°, pieds moins inclinés…). Pour chaque membre, on calcule la rotation qui amène l'os d'Aiko sur l'os capturé au repos, et on
   l'applique à toutes les images : ses jambes, ses pieds et ses bras pointent alors exactement où pointaient ceux de la personne. */
const CLIP_NEXT = { leftUpperArm: 'leftLowerArm', leftLowerArm: 'leftHand', rightUpperArm: 'rightLowerArm', rightLowerArm: 'rightHand',
  leftUpperLeg: 'leftLowerLeg', leftLowerLeg: 'leftFoot', rightUpperLeg: 'rightLowerLeg', rightLowerLeg: 'rightFoot' };   // pieds, mains, buste : leur repos (à plat, droit) correspond déjà
function clipRetarget(c) {
  if (!c.rd || c._rt === vrm || !bones.hips) return;
  if (!c.q0) c.q0 = Float32Array.from(c.q);                                 // rotations d'origine (pour un autre avatar plus tard)
  c._rt = vrm;
  const b = bones, n = c.n, nb = c.bones.length, pr = b.hips.parent, at = new Map(), par = [], C = [], Ci = [];
  c.bones.forEach((nm, j) => {
    const o = b[CLIP_BONES[nm]]; let pi = -1, cq = null;
    if (o) { let p = o.parent; while (p && p !== pr) { if (at.has(p)) { pi = at.get(p); break; } p = p.parent; } at.set(o, j); }
    const ch = o && CLIP_NEXT[nm] && b[CLIP_BONES[CLIP_NEXT[nm]]], d = c.rd[j];
    if (ch && d) {
      const v = new THREE.Vector3(); let p = ch; while (p && p !== o) { v.add(p.position); p = p.parent; }      // direction de l'os d'Aiko au repos
      if (p === o && v.lengthSq() > 1e-8) cq = new THREE.Quaternion().setFromUnitVectors(v.normalize(), new THREE.Vector3(d[0], d[1], d[2]).normalize());
    }
    const fs = nm === 'leftFoot' ? 0 : nm === 'rightFoot' ? 1 : -1;
    if (o && fs >= 0 && d) {                                                // pied : semelle à plat quand celle de la personne l'était
      const th = new THREE.Vector3(fs ? 0.342 : -0.342, 0.94, 0).normalize(), m = c.fu && c.fu[fs];
      const u = m ? new THREE.Vector3(m[0], m[1], m[2]).normalize() : th.clone(); if (u.angleTo(th) > 0.44) u.copy(th);   // calage mesuré, sauf s'il est aberrant (> 25° du calage théorique)
      const f = new THREE.Vector3(d[0], d[1], d[2]); f.addScaledVector(u, -f.dot(u)).normalize();                        // avant du pied, dans le plan de la semelle
      cq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(u, f), u, f));
    }
    par.push(pi); C.push(cq); Ci.push(cq ? cq.clone().invert() : null);
  });
  const q = c.q, q0 = c.q0, t = new THREE.Quaternion(), noToe = !c.ct, toe = c.bones.map((nm) => /Toes$/.test(nm));
  for (let i = 0; i < n; i++) for (let j = 0; j < nb; j++) {
    const m = (i * nb + j) * 4, cp = par[j] >= 0 ? Ci[par[j]] : null, cj = C[j];
    t.set(q0[m], q0[m + 1], q0[m + 2], q0[m + 3]);
    if (cp) t.premultiply(cp);
    if (cj) t.multiply(cj);
    if (noToe && toe[j]) t.set(0, 0, 0, 1);                                 // orteils capturés inexploitables : neutres
    q[m] = t.x; q[m + 1] = t.y; q[m + 2] = t.z; q[m + 3] = t.w;
  }
  for (let j = 0; j < nb; j++) for (let i = 1; i < n; i++) {                 // signes continus pour l'interpolation
    const m = (i * nb + j) * 4, p = m - nb * 4;
    if (q[m] * q[p] + q[m + 1] * q[p + 1] + q[m + 2] * q[p + 2] + q[m + 3] * q[p + 3] < 0) { q[m] = -q[m]; q[m + 1] = -q[m + 1]; q[m + 2] = -q[m + 2]; q[m + 3] = -q[m + 3]; }
  }
}
const TOE_R = 0.009;        // de l'articulation des orteils à la semelle (mesuré sur la peau)
const CLIP_RAD = { hips: 0.16, spine: 0.1, chest: 0.135, head: 0.105, leftUpperLeg: 0.13, rightUpperLeg: 0.13, leftLowerLeg: 0.075, rightLowerLeg: 0.075, leftToes: TOE_R, rightToes: TOE_R, leftHand: 0.035, rightHand: 0.035 };
const _kq2 = new THREE.Quaternion(), _kq = new THREE.Quaternion(), _kv = new THREE.Vector3(), _ks = new THREE.Vector3();
function clipPrep(c) {
  if (!c.ct || c._prep === vrm || !bones.hips) return c;
  c._prep = vrm;
  try {
    clipRetarget(c);
    const b = bones, n = c.n, nb = c.bones.length, H = body.hipsY, pr = b.hips.parent;
    pr.getWorldScale(_ks); const sc = _ks.y || 1, fy = body.anchL ? body.anchL.y : 0.07;
    // --- squelette d'Aiko au repos : décalage de chaque os par rapport à son parent (os intermédiaires sans rotation compris)
    const at = new Map(), J = [];
    c.bones.forEach((nm, j) => {
      const o = b[CLIP_BONES[nm]]; if (!o) { J.push(null); return; }
      const off = o.position.clone(); let p = o.parent, pi = -1;
      while (p && p !== pr) { if (at.has(p)) { pi = at.get(p); break; } off.add(p.position); p = p.parent; }
      at.set(o, j); J.push({ pi, off: off.multiplyScalar(sc), r: nm === 'leftFoot' || nm === 'rightFoot' ? fy : CLIP_RAD[nm] });
    });
    const ix = (nm) => c.bones.indexOf(nm), jH = ix('hips');
    const S2 = [['left', 0], ['right', 1]].map(([s, k]) => ({ k, up: ix(s + 'UpperLeg'), ft: ix(s + 'Foot'), to: ix(s + 'Toes'), end: body.toeEnd ? body.toeEnd[k ? 'R' : 'L'] : null }));
    if (jH < 0 || S2.some((s) => s.up < 0 || s.ft < 0 || s.to < 0 || !J[s.up] || !J[s.ft] || !J[s.to])) return c;
    const nm0 = c.bones;
    const toeJ = c.bones.map((nm) => nm === 'leftToes' || nm === 'rightToes');   // les orteils capturés sont inexploitables (relevés de 30° debout) : on les recalcule
    const Wq = c.bones.map(() => new THREE.Quaternion()), P = c.bones.map(() => new THREE.Vector3());
    // par image et par côté : hanche, cheville, base des orteils (relatifs au bassin en horizontal) ; et le point le plus bas du corps
    const hip = [new Float32Array(n * 3), new Float32Array(n * 3)], ank = [new Float32Array(n * 3), new Float32Array(n * 3)], ball = [new Float32Array(n * 3), new Float32Array(n * 3)], low = new Float32Array(n), pit = [new Float32Array(n), new Float32Array(n)], cl = [new Float32Array(n), new Float32Array(n)], sup = [new Float32Array(n), new Float32Array(n)], fq = [new Float32Array(n * 4), new Float32Array(n * 4)];
    const hx = (body.hipsX || 0) * sc, hz = (body.hipsZ || 0) * sc;
    for (let i = 0; i < n; i++) {
      let lo = Infinity;
      for (let j = 0; j < nb; j++) {
        const d = J[j]; if (!d) continue; const m = (i * nb + j) * 4;
        if (toeJ[j]) { _kv.set(0, 0, 1).applyQuaternion(Wq[d.pi]); const a = Math.asin(Math.max(-1, Math.min(1, -_kv.y))), sk = nm0[j] === 'leftToes' ? 0 : 1;   // inclinaison du pied : + = talon levé
          _kv.set(0, 1, 0).applyQuaternion(Wq[d.pi]); const su = Math.max(0, Math.min(1, _kv.y / 0.3)); sup[sk][i] = su;                       // semelle vers le bas ? (à genoux, le dessus du pied est au sol : les orteils ne se plient pas)
          Wq[d.pi].toArray(fq[sk], i * 4);
          pit[sk][i] = a; const tb = Math.max(0, Math.min(1.05, a)) * su; _kq.set(-Math.sin(tb / 2), 0, 0, Math.cos(tb / 2)); }                                  // orteils pliés pour rester à plat (jusqu'à 60°)
        else _kq.set(c.q[m], c.q[m + 1], c.q[m + 2], c.q[m + 3]);
        if (d.pi < 0) { Wq[j].copy(_kq); P[j].set(hx, H * (1 + c.dy[i]) * sc, hz); }
        else { Wq[j].copy(Wq[d.pi]).multiply(_kq); P[j].copy(d.off).applyQuaternion(Wq[d.pi]).add(P[d.pi]); }
        if (d.r !== undefined && P[j].y - d.r < lo) lo = P[j].y - d.r;
      }
      for (const s of S2) {
        hip[s.k].set([P[s.up].x, P[s.up].y, P[s.up].z], i * 3); ank[s.k].set([P[s.ft].x, P[s.ft].y, P[s.ft].z], i * 3); ball[s.k].set([P[s.to].x, P[s.to].y, P[s.to].z], i * 3);
        let cz = Math.min(P[s.to].y - TOE_R, P[s.ft].y - fy);                    // (le bout des orteils est calculé orteils pliés : il ne « porte » que sur les pointes)
        if (s.end) { _kv.copy(s.end).applyQuaternion(Wq[s.to]).add(P[s.to]); if (_kv.y - 0.012 < lo) lo = _kv.y - 0.012; cz = Math.min(cz, _kv.y - 0.012); }
        cl[s.k][i] = cz;                                                     // point le plus bas du pied (talon, avant-pied ou bout des orteils)
      }
      low[i] = lo;
    }
    { const t = Float32Array.from(low);                                      // un défaut de capture d'une seule image (un membre qui « saute ») ne doit pas faire sauter tout le corps
      for (let i = 1; i < n - 1; i++) { const a = t[i - 1], b = t[i], d = t[i + 1]; low[i] = Math.max(Math.min(a, b), Math.min(Math.max(a, b), d)); } }
    const ct = c.ct, on = (i, k) => (ct[i] >> k) & 1, air = (i) => (ct[i] >> 2) & 1;
    // --- 1. échelle du déplacement : celle qui laisse ses pieds posés immobiles (moindres carrés sur toutes les images d'appui)
    let num = 0, den = 0;
    for (let i = 1; i < n; i++) {
      const rx = (c.dx[i] - c.dx[i - 1]) * H * sc, rz = (c.dz[i] - c.dz[i - 1]) * H * sc;
      for (const s of S2) if (on(i, s.k) && on(i - 1, s.k)) {
        const B = ball[s.k], ex = B[i * 3] - B[i * 3 - 3], ez = B[i * 3 + 2] - B[i * 3 - 1];
        num -= rx * ex + rz * ez; den += rx * rx + rz * rz;
      }
    }
    const rs = den > 0.02 ? Math.max(0.75, Math.min(1.3, num / den)) : 1;
    c.rs = rs;
    const RX = (i) => c.dx[i] * H * sc * rs, RZ = (i) => c.dz[i] * H * sc * rs;
    // --- 3. hauteur : posée au sol quand elle est en appui, trajectoire de vol conservée quand elle est en l'air
    const gy = new Float32Array(n); let anyAir = false;
    for (let i = 0; i < n; i++) gy[i] = -low[i];
    for (let i = 0; i < n; i++) if (air(i)) {
      let e = i; while (e < n && air(e)) e++;
      const a = i - 1, g0 = a >= 0 ? gy[a] : (e < n ? gy[e] : 0), g1 = e < n ? gy[e] : g0;
      for (let k = i; k < e; k++) { const f = (k - a) / (e - a); gy[k] = Math.max(g0 + (g1 - g0) * f, -low[k]); }   // la ligne de sol va du décollage à l'atterrissage ; rien ne passe jamais dessous
      anyAir = true; i = e - 1;
    }
    c.gy = gy; c.anyAir = anyAir;
    // --- orteils : ils se plient juste ce qu'il faut pour que leur bout reste posé au sol quand le talon se lève (déroulé du pas, pointes) ;
    //     dès que le pied est assez haut, ils sont droits. C'est de la géométrie, pas une estimation : ni orteils en l'air au sol, ni orteils dans le sol.
    const need = new Float32Array(n);
    for (const s of S2) {
      const B = ball[s.k], tmp = new Float32Array(n), Lt = s.end ? Math.max(0.03, s.end.length()) : 0.066;
      for (let i = 0; i < n; i++) {
        const h = Math.max(0, B[i * 3 + 1] + gy[i] - TOE_R), pt = pit[s.k][i];
        tmp[i] = Math.max(0, Math.min(1.05, pt - Math.asin(Math.min(1, h / Lt)))) * sup[s.k][i];
      }
      for (let i = 0; i < n; i++) {                                           // lissage léger (3 images) : pas d'à-coup dans les orteils
        const a = Math.max(tmp[i], (tmp[Math.max(0, i - 1)] + 2 * tmp[i] + tmp[Math.min(n - 1, i + 1)]) / 4), m = (i * nb + s.to) * 4;
        c.q[m] = -Math.sin(a / 2); c.q[m + 1] = 0; c.q[m + 2] = 0; c.q[m + 3] = Math.cos(a / 2);
        if (s.end) {                                                          // contrôle : avec cette pliure, le bout des orteils est-il au-dessus du sol ?
          _kq.fromArray(fq[s.k], i * 4).multiply(_kq2.set(c.q[m], 0, 0, c.q[m + 3]));
          const ey = _kv.copy(s.end).applyQuaternion(_kq).y + B[i * 3 + 1] + gy[i] - 0.012;
          if (-ey > need[i]) need[i] = -ey;
        }
      }
    }
    for (let i = 0; i < n; i++) {                                             // sinon tout le corps monte d'autant (médiane sur 3 images : pas de saut sur un défaut isolé)
      const a = need[Math.max(0, i - 1)], b = need[i], d = need[Math.min(n - 1, i + 1)];
      gy[i] += Math.max(Math.min(a, b), Math.min(Math.max(a, b), d));
    }
    // --- 2. appuis : un point fixe au sol par appui, puis la correction image par image (horizontale ET verticale : le pied posé touche vraiment le sol)
    const fo = new Float32Array(n * 6), KB = Math.max(4, Math.round(0.27 * c.fps)); let pins = 0, maxOff = 0, clampN = 0;
    const Lleg = J[S2[0].ft].off.length() + J[c.bones.indexOf('leftLowerLeg')].off.length(), Lr = Lleg * 0.992;
    const ease = (t) => t * t * (3 - 2 * t);
    for (const s of S2) {
      const B = ball[s.k], col = s.k * 3, runs = [];
      const bx = (i) => B[i * 3] + RX(i), bz = (i) => B[i * 3 + 2] + RZ(i);
      for (let i = 0; i < n; i++) if (on(i, s.k)) {
        let e = i; while (e < n && on(e, s.k)) e++;
        let sw = 0, px = 0, pz = 0;                                          // point d'appui : là où le pied est le plus immobile
        for (let k = i; k < e; k++) {
          const k0 = Math.max(i, k - 1), k1 = Math.min(e - 1, k + 1), v = Math.hypot(bx(k1) - bx(k0), bz(k1) - bz(k0)) * c.fps / Math.max(1, k1 - k0);
          const w = 1 / (v * v + 0.01); sw += w; px += bx(k) * w; pz += bz(k) * w;
        }
        px /= sw; pz /= sw; pins++;
        for (let k = i; k < e; k++) {
          let ox = px - bx(k), oz = pz - bz(k); const o = Math.hypot(ox, oz); if (o > 0.15) { ox *= 0.15 / o; oz *= 0.15 / o; }   // garde-fou : jamais plus de 15 cm
          fo[k * 6 + col] = ox; fo[k * 6 + col + 2] = oz;
          fo[k * 6 + col + 1] = -Math.min(0.08, Math.max(0, cl[s.k][k] + gy[k]));                                                // le pied descend jusqu'au sol
        }
        runs.push([i, e]); i = e - 1;
      }
      // raccords : entre deux appuis, la correction passe en douceur de l'une à l'autre (ou revient à zéro si le pied reste longtemps en l'air)
      const blend = (a, e, A0, A1) => {                                      // images a..e-1 hors appui ; valeurs aux bords
        const len = e - a; if (len <= 0) return;
        for (let k = a; k < e; k++) for (let d = 0; d < 3; d++) {
          let v;
          if (len <= 2 * KB) v = A0[d] + (A1[d] - A0[d]) * ease((k - a + 1) / (len + 1));
          else v = A0[d] * ease(Math.max(0, 1 - (k - a + 1) / KB)) + A1[d] * ease(Math.max(0, 1 - (e - k) / KB));
          fo[k * 6 + col + d] = d === 1 ? Math.max(v, -Math.max(0, cl[s.k][k] + gy[k])) : v;                                     // jamais sous le sol
        }
      };
      const at3 = (k) => [fo[k * 6 + col], fo[k * 6 + col + 1], fo[k * 6 + col + 2]];
      let prevE = 0, pv = [0, 0, 0];
      for (const [a, e] of runs) { blend(prevE, a, pv, at3(a)); prevE = e; pv = at3(e - 1); }
      blend(prevE, n, pv, [0, 0, 0]);
    }
    // --- bassin : quand un pied posé demande une jambe plus longue qu'elle ne l'est, c'est le bassin qui se rapproche (comme un vrai corps), en douceur
    const po = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let dx = 0, dy = 0, dz = 0;
      for (let it = 0; it < 6; it++) for (const s of S2) {
        const A = ank[s.k], Hp = hip[s.k], col = s.k * 3;
        const nx = A[i * 3] - Hp[i * 3], ny = A[i * 3 + 1] - Hp[i * 3 + 1], nz = A[i * 3 + 2] - Hp[i * 3 + 2], dn = Math.hypot(nx, ny, nz);
        const tx = nx + fo[i * 6 + col] - dx, ty = ny + fo[i * 6 + col + 1] - dy, tz = nz + fo[i * 6 + col + 2] - dz, d = Math.hypot(tx, ty, tz), lim = Math.max(Lr, Math.min(dn, Lleg));
        if (d > lim) { const k = (d - lim) / d * 0.6; dx += tx * k; dy += ty * k; dz += tz * k; if (it === 0) clampN++; }
      }
      po[i * 3] = dx; po[i * 3 + 1] = dy; po[i * 3 + 2] = dz;
    }
    for (let pass = 0; pass < 2; pass++) {                                    // lissage dans le temps : le bassin ne tressaute pas
      const t = Float32Array.from(po);
      for (let i = 0; i < n; i++) for (let d = 0; d < 3; d++) {
        const g = (k) => t[Math.max(0, Math.min(n - 1, k)) * 3 + d];
        po[i * 3 + d] = (g(i - 2) + 4 * g(i - 1) + 6 * g(i) + 4 * g(i + 1) + g(i + 2)) / 16;
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) for (let d = 0; d < 3; d++) {     // les pieds gardent leur place : le bassin bouge, pas eux
      fo[i * 6 + k * 3 + d] -= po[i * 3 + d];
      const o = Math.abs(fo[i * 6 + k * 3 + d]); if (o > maxOff) maxOff = o;
    }
    if (window.__clipDbg) c._dbg = { ball, ank, hip, RX: Float32Array.from({ length: n }, (_, i) => RX(i)), RZ: Float32Array.from({ length: n }, (_, i) => RZ(i)), gy };
    c.fo = fo; c.po = po; c.st = { rs: +rs.toFixed(3), pins, maxOff: +maxOff.toFixed(3), clampN };
  } catch (e) { console.warn('préparation du mouvement', e); c.fo = null; }
  return c;
}
/* à l'affichage : le bassin prend son décalage, puis chaque pied suit sa correction (jambe par IK, orientation du pied gardée) */
const _cfq = new THREE.Quaternion(), _cfo = new THREE.Vector3(), _cfs = new THREE.Vector3();
function clipPelvis(g, w, b) {                                               // à appeler juste après applyClip
  const c = g.clip, po = c.po; if (!po || g._fr === undefined || window.__noClipFeet) return;
  const fr = Math.max(0, Math.min(c.n - 1, g._fr)), i0 = Math.floor(fr), f = fr - i0, i1 = Math.min(i0 + 1, c.n - 1), m = g.mirror ? -1 : 1;
  b.hips.parent.getWorldScale(_cfs);
  const L = (d) => po[i0 * 3 + d] + (po[i1 * 3 + d] - po[i0 * 3 + d]) * f;
  b.hips.position.x += L(0) * m * w / _cfs.x; b.hips.position.y += L(1) * w / _cfs.y; b.hips.position.z += L(2) * w / _cfs.z;
}
function clipFeet(g, w, b) {
  const c = g.clip, fo = c.fo; if (!fo || w < 0.01 || g._fr === undefined || window.__noClipFeet) return;
  rig.updateMatrixWorld(true);
  const fr = Math.max(0, Math.min(c.n - 1, g._fr)), i0 = Math.floor(fr), f = fr - i0, i1 = Math.min(i0 + 1, c.n - 1), m = g.mirror ? -1 : 1;
  b.hips.parent.getWorldQuaternion(_cfq);
  for (const S of ['L', 'R']) {
    const col = ((S === 'L') !== !!g.mirror) ? 0 : 3, L = (d) => fo[i0 * 6 + col + d] + (fo[i1 * 6 + col + d] - fo[i0 * 6 + col + d]) * f;
    const ox = L(0) * m, oy = L(1), oz = L(2);
    if (ox * ox + oy * oy + oz * oz < 1e-8) continue;
    const up = S === 'L' ? b.lUpLeg : b.rUpLeg, lo = S === 'L' ? b.lLowLeg : b.rLowLeg, ft = S === 'L' ? b.lFoot : b.rFoot; if (!up || !lo || !ft) continue;
    _cfo.set(ox, oy, oz).applyQuaternion(_cfq);
    ft.getWorldPosition(_fl.f); ft.getWorldQuaternion(_fl.q);
    up.getWorldPosition(_fl.h); lo.getWorldPosition(_fl.k);
    _fl.ax.copy(_fl.f).sub(_fl.h).normalize();
    _fl.pole.copy(_fl.k).sub(_fl.h); _fl.pole.addScaledVector(_fl.ax, -_fl.pole.dot(_fl.ax));    // le genou garde sa direction
    if (_fl.pole.lengthSq() < 1e-6) _fl.pole.set(0, 0, 1).applyQuaternion(rig.quaternion);
    _fl.t.copy(_fl.f).addScaledVector(_cfo, w);
    { // portée douce : tout près de l'extension complète, la jambe s'allonge de moins en moins vite (pas de genou qui « claque » tendu)
      const L2 = _fl.h.distanceTo(_fl.k) + _fl.k.distanceTo(_fl.f), d = _fl.t.distanceTo(_fl.h), d0 = _fl.f.distanceTo(_fl.h), da = Math.max(0.99 * L2, Math.min(d0, 0.999 * L2));
      if (d > da) { const room = Math.max(1e-4, 0.9995 * L2 - da), d2 = da + room * (1 - Math.exp(-(d - da) / room)); _fl.t.sub(_fl.h).multiplyScalar(d2 / d).add(_fl.h); } }
    armIK(up, lo, ft, _fl.t, _fl.pole.normalize(), 1);
    ft.parent.getWorldQuaternion(_fl.pq); ft.quaternion.copy(_fl.pq.invert().multiply(_fl.q));
  }
}
/* en l'air à cet instant ? (null : ancien mouvement sans annotation) ; et la hauteur de vol à appliquer */
function clipAir(g) { const c = g.clip; if (!c.ct || !c.gy || g._fr === undefined) return null; return ((c.ct[Math.max(0, Math.min(c.n - 1, Math.round(g._fr)))] >> 2) & 1) === 1; }
function clipGy(g) { const c = g.clip, fr = Math.max(0, Math.min(c.n - 1, g._fr)), i0 = Math.floor(fr), i1 = Math.min(i0 + 1, c.n - 1); return c.gy[i0] + (c.gy[i1] - c.gy[i0]) * (fr - i0); }
