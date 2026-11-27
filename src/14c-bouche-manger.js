/* ══ BOUCHE : tirer la langue, lécher une glace, croquer une pomme, mâcher, avaler ══
   Ce qu'en dit la recherche (appliqué ici) :
   - mastication humaine : ≈ 1,46 cycle par seconde (± 0,21), une vingtaine de cycles par bouchée en moyenne ; la mâchoire s'ouvre presque droit
     puis se REFERME déportée du côté qui mâche (trajet « en goutte ») ; l'amplitude diminue quand l'aliment ramollit ; les lèvres restent jointes ;
   - langue sortie : FACS AU19 (MetaHuman « tongueOut ») ; son visage n'a qu'une forme de langue (sortie) : le balayage du coup de langue vient
     donc d'un petit mouvement de tête, langue tirée, comme on le fait vraiment sur une glace ;
   - parole : modèle JALI (mâchoire et lèvres pilotées séparément) → la mâchoire suit le volume réel de la voix (voir la boucle).
   PRÉCISION : l'aliment est amené AU CONTACT MESURÉ — la boule de glace sous le bout RÉEL de la langue (sommet du maillage, morphing + squelette),
   la pomme contre la lèvre du haut (point réel de la peau) — par un correcteur qui compare à chaque image où est l'aliment et où il doit être
   (même principe que ses mains sur sa peau). L'ouverture de la bouche est réglée sur la taille de ce qu'elle croque. */
const EAT = { corr: new THREE.Vector3(), app: new THREE.Vector3(), w: 0, tongue: null, tipIdx: -1, tip: new THREE.Vector3(), licks: 0, bites: 0, dirty: false, gap: null,
  _a: new THREE.Vector3(), _q: new THREE.Quaternion(), _f: new THREE.Vector3(), _u: new THREE.Vector3(), _l: new THREE.Vector3(), _c: new THREE.Vector3(), _d: new THREE.Vector3(), _o: {} };
const _ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function eatAdjust(def, gt, tg0) { if (EAT.w > 0.001 && !window.__noEat) { EAT.app.copy(EAT.corr).multiplyScalar(EAT.w); tg0.add(EAT.app); } }   // (dans applyLib) la main qui tient l'aliment reçoit la correction mesurée à l'image d'avant
function eatTip(out) {                   // le bout RÉEL de sa langue, dans le monde : le sommet le plus en avant quand elle la tire (trouvé une fois), puis suivi image par image
  if (!EAT.tongue) { vrm.scene.traverse((o) => { if (!EAT.tongue && o.isMesh && /tongue/i.test(o.name) && o.morphTargetDictionary && o.morphTargetDictionary.tongueOut !== undefined) EAT.tongue = o; }); if (!EAT.tongue) return false; }
  const m = EAT.tongue;
  if (EAT.tipIdx < 0) {
    const inf = m.morphTargetInfluences, sv = Array.from(inf), n = m.geometry.attributes.position.count, v = new THREE.Vector3(); let best = -1e9;
    inf.fill(0); inf[m.morphTargetDictionary.tongueOut] = 1;
    for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); m.localToWorld(v); const d = v.sub(EAT._a).dot(EAT._f); if (d > best) { best = d; EAT.tipIdx = i; } }
    for (let i = 0; i < inf.length; i++) inf[i] = sv[i];
  }
  m.getVertexPosition(EAT.tipIdx, out); m.localToWorld(out); return true;
}
function propBite(mesh, dirW, k) {       // une bouchée CREUSE la pomme : les sommets pris dans la morsure reculent sur une cavité ronde, la chair apparaît
  const ch = mesh.getObjectByName('chair'); if (!ch) return;
  const d = dirW.clone().applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()).invert()); d.y /= ch.scale.y; d.normalize();
  if (k) d.applyAxisAngle(new THREE.Vector3(0, 1, 0), (k % 2 ? 0.62 : -0.62) * Math.ceil(k / 2));           // elle tourne un peu la pomme : chaque bouchée à côté de la précédente
  const R = 0.034, rc0 = 0.0195, cc = d.clone().multiplyScalar(R + 0.0035), P = ch.geometry.attributes.position, C = ch.geometry.attributes.color, v = new THREE.Vector3(), w = new THREE.Vector3();
  const ex = new THREE.Vector3(0, 1, 0).cross(d).normalize(); if (ex.lengthSq() < 0.5) ex.set(1, 0, 0); const ey = new THREE.Vector3().crossVectors(d, ex);
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i); w.subVectors(v, cc); const dist = w.length();
    const th = Math.atan2(w.dot(ey), w.dot(ex)), rc = rc0 * (1 + 0.035 * Math.cos(th * 9));   // traces des dents : le bord de la morsure est festonné (≈ 9 empreintes sur le tour)
    if (dist < rc) { w.multiplyScalar(rc / Math.max(1e-6, dist)); v.copy(cc).add(w); P.setXYZ(i, v.x, v.y, v.z); const j = 0.9 + 0.1 * Math.sin(i * 7.3); C.setXYZ(i, 0.96 * j, 0.92 * j, 0.74 * j); }
    else if (dist < rc * 1.06) C.setXYZ(i, 0.82, 0.66, 0.44);                                               // le bord de la morsure (peau déchirée)
  }
  P.needsUpdate = true; C.needsUpdate = true; ch.geometry.computeVertexNormals();
}
function eatTrack(b, dt, lib, gt, lw) {  // passe différée (après la prise de l'objet) : mesure, correction, bouchées et coups de langue
  const S = PROPS_ST, E = lib && lib.eat;
  if (!E || !S.held || !S.mesh || !b.head || S.name !== lib.prop.n) {
    EAT.w = 0; EAT.corr.multiplyScalar(Math.max(0, 1 - dt * 6)); EAT.gap = null;
    if (E && gt < 0.5 && EAT.dirty && S.name === lib.prop.n) { if (S.mesh && S.mesh.parent) S.mesh.parent.remove(S.mesh); S.mesh = null; EAT.dirty = false; EAT.licks = 0; EAT.bites = 0; }   // elle en reprend : un aliment neuf
    return;
  }
  let w = 0; for (const [a, z] of E.wins) w = Math.max(w, Math.max(0, Math.min(1, (gt - a) / 0.4)) * Math.max(0, Math.min(1, (z - gt) / 0.3)));
  EAT.w = w * lw;
  if (w <= 0.001) { EAT.corr.multiplyScalar(Math.max(0, 1 - dt * 5)); EAT.gap = null; return; }
  b.head.updateWorldMatrix(true, false);
  const A = b.head.getWorldPosition(EAT._a), q = b.head.getWorldQuaternion(EAT._q), F = EAT._f.set(0, 0, 1).applyQuaternion(q), U = EAT._u.set(0, 1, 0).applyQuaternion(q);
  const L = EAT._l.copy(A).addScaledVector(U, -0.022).addScaledVector(F, 0.12);                             // lèvre du haut : point d'auteur, puis le VRAI point de peau le plus proche
  if (SURF.ok) { SURF.dirty = true; surfUpdate(); if (surfClosest(L, 0, EAT._o, 0.06) !== null) L.copy(EAT._o.point); }
  S.mesh.updateMatrixWorld(true);
  const C = EAT._c, D = EAT._d; let gap = null;
  if (E.kind === 'glace') {
    const boule = S.mesh.getObjectByName('boule'), n = E.licks.filter((k) => gt >= k[1]).length;
    if (n !== EAT.licks) { EAT.licks = n; EAT.dirty = true; const sc = 1 - 0.055 * n; boule.scale.set(sc, sc * 0.97, sc); S.mesh.updateMatrixWorld(true); }   // chaque coup de langue en emporte un peu
    const r = 0.03 * boule.scale.x; boule.getWorldPosition(C);
    const tOk = eatTip(EAT.tip), m = EAT.tongue, tw = tOk ? m.morphTargetInfluences[m.morphTargetDictionary.tongueOut] : 0, s = _ss(0.3, 0.85, tw);
    let th = -0.4; for (const [a, z] of E.licks) if (gt >= a - 0.25 && gt <= z + 0.2) th = -0.4 + 1.2 * _ss(a, z, gt);   // le coup de langue remonte du bas de la boule vers son sommet
    D.copy(L).addScaledVector(F, r + 0.02).addScaledVector(U, -0.014);                                      // entre deux coups : la boule à 2 cm des lèvres
    if (tOk && s > 0) { const X = EAT.tip.clone().addScaledVector(F, r * Math.cos(th) - 0.0015).addScaledVector(U, -r * Math.sin(th)); D.lerp(X, s); if (s > 0.95) gap = EAT.tip.distanceTo(C) - r; }
  } else {
    C.copy(S.mesh.position); const R = 0.034;
    D.copy(L).addScaledVector(F, R - 0.007).addScaledVector(U, -0.015);                                      // la pomme contre la bouche ouverte, les dents du haut déjà dans la chair
    gap = L.distanceTo(C) - R;
    while (EAT.bites < E.bites.length && gt >= E.bites[EAT.bites]) { propBite(S.mesh, L.clone().addScaledVector(U, -0.012).sub(C).normalize(), EAT.bites); EAT.bites++; EAT.dirty = true; }
  }
  // correction DIRECTE (pas d'intégrale, donc pas d'emballement quand le poids monte) : où serait l'aliment SANS correction (C − ce qui a été appliqué),
  // et l'écart qui reste jusqu'au point voulu ; lissée sur ~80 ms. (L'intégrale dépassait de 3 cm dans la bouche pendant le fondu d'entrée, mesuré.)
  const want = D.sub(C).add(EAT.app); EAT.corr.lerp(want, Math.min(1, dt * 12)); if (EAT.corr.length() > 0.16) EAT.corr.setLength(0.16); EAT.app.set(0, 0, 0);
  EAT.gap = gap;
  if (window.__eatDbg) { const P = new THREE.Vector3(), N = new THREE.Vector3(); palmPoint(b, 'r', b.rHand, P, N); EAT.dbg = { P, N, up: new THREE.Vector3(0, 1, 0).applyQuaternion(S.mesh.quaternion), wr: rawOf(b.rHand).getWorldPosition(new THREE.Vector3()), el: rawOf(b.rLowArm).getWorldPosition(new THREE.Vector3()), wn: b.rHand.getWorldPosition(new THREE.Vector3()), sh: rawOf(b.rArm).getWorldPosition(new THREE.Vector3()), tg: window.__tgDbg && window.__tgDbg.r }; }
  if (window.__eatLog) window.__eatLog.push({ t: +gt.toFixed(3), gap: gap === null ? null : +(gap * 1000).toFixed(2), err: +(D.length() * 1000).toFixed(2), w: +w.toFixed(2) });
}
/* Mastication : n cycles à partir de t0 ; côté : +1 droite, −1 gauche. Renvoie [images-clés du visage, instant de fin]. */
function chewSeq(t0, n, side) {
  const K = [], P = 0.69; let t = t0;
  for (let i = 0; i < n; i++) {
    const a = 1.05 - 0.45 * (i / Math.max(1, n - 1)), lat = (i % 5 === 4 ? -side : side) > 0 ? 'mach_d' : 'mach_g';   // amplitude qui décroît ; elle change de côté de temps en temps
    K.push([t, { mache: 0.1, joues: 0.5 }]);                              // dents serrées
    K.push([t + P * 0.34, { mache: a, joues: 0.5, [lat]: 0.25 }]);       // ouverture, presque droite
    K.push([t + P * 0.62, { mache: a * 0.45, joues: 0.5, [lat]: 0.9 }]); // fermeture déportée du côté qui mâche
    K.push([t + P * 0.86, { mache: 0.08, joues: 0.5, [lat]: 0.2 }]);     // écrasement, retour au centre
    t += P * (0.94 + 0.12 * ((i * 7) % 5) / 4);                          // rythme humain : jamais parfaitement régulier
  }
  K.push([t, { mache: 0.08, joues: 0.4 }]);
  return [K, t];
}
(function () {
  const rest = ['sh', [0.2, -0.4, 0.05]], lean = (a, nk) => ({ spine: [a, 0, 0], chest: [a * 0.4, 0, 0], neck: [nk || 0, 0, 0] });
  const build = (name, n, shape, ty, use, e, fkMid, extra) => {            // prendre sur la table → porter à la bouche → reposer (même schéma que boire, lire…)
    const table = [0.2, ty, 0.34], above = [0.2, ty + 0.11, 0.33];
    // Coude LEVÉ sur le côté (comme on porte vraiment quelque chose à la bouche) : coude bas, l'avant-bras butait contre sa poitrine et le poignet restait à 20 cm de la cible (mesuré).
    // Avant-bras tourné (rTwist) : la paume regarde son visage, l'aliment est entre la paume et la bouche. Devant la bouche, la cible n'est plus repoussée par le gabarit du buste (seulement pendant le réglage fin).
    GLIB[name] = Object.assign({ dur: e + 2.6, blend: true, prop: { n, h: 'r', on: 1.45, off: e + 1.3, tilt: [[0, 0]] }, rPole: [1, 0.1, 0.25],
      rTwist: [[0, 0], [1.7, 0], [use[0][0] - 0.1, 1.6], [e, 1.6], [e + 0.7, 0]],
      r: [[0, ...rest], [0.9, 'hips', above], [1.3, 'hips', table], [1.6, 'hips', table], ...use, [e + 0.8, 'hips', above], [e + 1.15, 'hips', table], [e + 1.5, 'hips', above], [e + 2.2, ...rest]],
      rHand: [[0, 'open'], [1.0, 'open'], [1.5, shape], [e + 1.2, shape], [e + 1.5, 'open']],
      fk: [[0, {}], [0.9, lean(0.22)], [1.7, lean(0.05)], ...fkMid, [e + 0.6, lean(0.04)], [e + 1.2, lean(0.22)], [e + 2.4, {}]] }, extra);
  };
  // ── tirer la langue (espiègle) ──
  GLIB.langue = { dur: 3.4, head: [0.03, 0, 0.1], fk: [[0, {}], [3.4, {}]],
    faceSeq: [[0, {}], [0.35, { langue: 0.2 }], [0.7, { langue: 1, miam: 0.5 }],
      [0.95, { langue: 1, miam: 0.55, l_g: 0.85 }], [1.2, { langue: 1, miam: 0.6, l_d: 0.85 }], [1.45, { langue: 1, miam: 0.6, l_g: 0.85 }], [1.7, { langue: 1, miam: 0.6, l_d: 0.85 }],   // elle la remue d'un côté à l'autre, espiègle
      [1.95, { langue: 1, miam: 0.6, l_haut: 0.7 }], [2.2, { langue: 1, miam: 0.6 }], [2.5, { langue: 0.1, miam: 0.7 }], [3.0, { miam: 0.3 }], [3.4, {}]] };
  // ── lécher une glace : 5 coups de langue, la boule rapetisse ──
  {
    const M = [0.075, -0.092, 0.217], licks = [], face = [[0, {}], [2.2, {}]], fk = []; let t = 2.9;
    for (let i = 0; i < 5; i++) {
      licks.push([t + 0.22, t + 0.8]);
      face.push([t, { leche: 0.1, l_bas: 0.3 }], [t + 0.22, { leche: 1, l_bas: 0.35 }], [t + 0.8, { leche: 1, l_haut: 0.6 }], [t + 1.0, { leche: 0.05, l_haut: 0.3, miam: 0.5 }], [t + 1.25, { miam: 0.35 }]);   // la pointe part du bas et se recourbe vers le haut en remontant la boule
      fk.push([t + 0.1, lean(0.05, 0.1)], [t + 0.8, lean(0.05, -0.06)], [t + 1.2, lean(0.05, 0.03)]);   // menton rentré → menton levé, langue tirée : le coup de langue remonte la boule
      t += 1.3;
    }
    const e = t + 0.2; face.push([e + 0.3, { miam: 0.9 }], [e + 1.6, { miam: 0.3 }], [e + 2.6, {}]);
    build('glace', 'glace', 'asl-c', 0.03, [[2.5, 'head', M], [e, 'head', M]], e, fk, { faceSeq: face, eat: { kind: 'glace', wins: [[2.2, e + 0.1]], licks } });
    GLIB.glace.prop.tilt = [[0, 0], [2.0, 0], [2.6, 0.3], [e - 0.1, 0.3], [e + 0.5, 0]];
  }
  // ── croquer une pomme : 2 bouchées, chacune mâchée (10 puis 8 cycles) puis avalée ──
  {
    const M = [0.075, -0.02, 0.19], H = ['sh', [0.16, -0.2, 0.24]], face = [[0, {}], [2.0, {}]], use = [], wins = [], bites = []; let t = 2.75;
    for (const n of [10, 8]) {
      use.push([t - 0.4, 'head', M], [t + 0.6, 'head', M], [t + 1.2, ...H]);         // la main ARRIVE devant la bouche avant que le réglage fin commence
      wins.push([t - 0.35, t + 0.7]); bites.push(t + 0.38);                            // au contact pendant toute la morsure ; elle ne s'éloigne qu'après
      face.push([t - 0.5, { bouchee: 0.1 }], [t - 0.05, { bouchee: 1 }], [t + 0.3, { bouchee: 1 }], [t + 0.44, { mache: 0.3, joues: 0.6 }]);   // la bouche s'ouvre à la taille de la pomme, puis les dents se referment : la bouchée part
      const [K, end] = chewSeq(t + 0.62, n, bites.length % 2 ? 1 : -1); face.push(...K);
      face.push([end + 0.2, { swallow: 1 }], [end + 0.55, { swallow: 0.4 }], [end + 0.9, { miam: 0.7 }], [end + 1.3, { miam: 0.3 }]);          // elle avale
      use.push([end + 1.0, ...H]); t = end + 1.9;
    }
    const e = t - 0.6; face.push([e + 1.5, { miam: 0.5 }], [e + 2.6, {}]);
    build('manger', 'pomme', 'asl-c', -0.025, use, e, [], { faceSeq: face, head: [0.02, 0, 0], eat: { kind: 'pomme', wins, bites } });
  }
  Object.assign(GLIB_FR, { 'langue': 'langue', 'tire-la-langue': 'langue', 'glace': 'glace', 'cornet': 'glace', 'creme-glacee': 'glace', 'pomme': 'manger', 'mange': 'manger', 'manges': 'manger', 'manger': 'manger', 'croque': 'manger', 'croquer': 'manger' });
})();
