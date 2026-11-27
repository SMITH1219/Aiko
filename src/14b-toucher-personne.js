/* ═══════════════ TON TOUCHER : la personne touche Aiko (doigt sur l'écran, ou souris) ═══════════════
   Le bouton ✋ change de mode : arrêt → ✋ toucher → 🤏 pincer → arrêt. En mode toucher, glisser SUR son corps la touche
   (glisser à côté fait toujours tourner la caméra). Chaque image : le point de peau sous le doigt (lancer de rayon sur le
   corps de collision exact), la VRAIE vitesse du doigt sur la peau (cm/s), la force (pression de l'écran si l'appareil la
   donne, sinon l'appui qui dure) → le même calcul de ressenti que pour ses propres gestes (fibres CT, loi de Stevens,
   chatouilles), avec adaptation sensorielle (un toucher qui dure ou qui se répète fait moins d'effet), puis ses réactions :
   visage, frisson, rire et retrait, sursaut, tête qui vient au-devant de la caresse, regard. Elle retient ce qu'elle aime
   venant de TOI (life.sens « toi>zone:style ») et peut le dire.
   Les zones génitale et anale ne déclenchent rien (limite fixée pour ce projet). */
const TLIVE = { temp: 31, selfOn: false, mode: 0, act: null, last: null, glance: 0, react: { pla: 0, cha: 0, dou: 0, fri: 0 }, flinch: null, face: null, side: 0, head: 0, spoken: 0, hab: {} };
const _tl = { ray: new THREE.Ray(), v: new THREE.Vector3(), n: new THREE.Vector3(), m3: new THREE.Matrix3(), ndc: new THREE.Vector2(), rc: new THREE.Raycaster() };
const TL_MODES = ['', '✋', '🤏'];
/* repères anatomiques du visage et de la tête (repère de la tête : x vers sa droite, y haut, z avant ; m) — la zone touchée = le repère le plus proche (côtés en miroir) */
const HEAD_MARKS = [['front', [0.0, 0.075, 0.105]], ['front', [0.035, 0.07, 0.095]], ['tempe', [0.058, 0.045, 0.05]], ['oeil', [0.03, 0.025, 0.1]], ['nez', [0.0, 0.0, 0.125]], ['nez', [0.0, 0.03, 0.115]],
  ['joue', [0.05, -0.005, 0.07]], ['joue', [0.045, -0.025, 0.08]], ['levres', [0.0, -0.028, 0.115]], ['levres', [0.015, -0.03, 0.11]], ['menton', [0.0, -0.055, 0.1]], ['menton', [0.0, -0.075, 0.065]],
  ['machoire', [0.055, -0.04, 0.03]], ['machoire', [0.04, -0.055, 0.06]], ['oreille', [0.085, 0.035, 0.0]], ['cou', [0.0, -0.09, 0.045]], ['cou', [0.04, -0.09, 0.02]],
  ['nuque', [0.0, -0.06, -0.08]], ['nuque', [0.035, -0.08, -0.06]], ['cheveux', [0.0, 0.08, -0.09]], ['cheveux', [0.06, 0.06, -0.05]], ['crane', [0.0, 0.13, 0.0]], ['crane', [0.0, 0.11, 0.06]]];
/* le point de peau sous le doigt (coordonnées écran) : { point, normal, tri } ou null */
function tlPick(cx, cy) {
  if (!SURF.ok || !vrm) return null;
  const r = renderer.domElement.getBoundingClientRect();
  _tl.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  camera.updateMatrixWorld(); _tl.rc.setFromCamera(_tl.ndc, camera);
  SURF.dirty = true; surfUpdate();
  const h = SURF.bvh.raycastFirst(_tl.rc.ray, THREE.DoubleSide, 0, 20); if (!h) return null;
  const o = {}; if (surfClosest(h.point, 0, o, 0.02) === null) return null;   // le triangle (indice d'origine, vérifié pour la recherche de proximité) et sa normale extérieure
  return { point: o.point.clone(), normal: o.normal.clone(), tri: o.tri };
}
/* quelle zone ? os du triangle, puis position et orientation de la peau dans le repère du corps */
function tlZone(hit) {
  const b = bones; if (!b || !b.hips || !b.head) return null;
  bfFrame(b); bfAnchors(b);
  const bone = surfTriBone(hit.tri) || '', p = hit.point, n = hit.normal;
  const rel = _tl.v.copy(p).sub(_bf.anc.hips), lx = rel.dot(_bf.X), ly = rel.dot(_bf.Y), nz = n.dot(_bf.Z), nx = n.dot(_bf.X), ny = n.dot(_bf.Y);
  const side = lx >= 0 ? 1 : -1, inward = -nx * side;                  // inward > 0 : la peau regarde vers la ligne médiane (face interne)
  const nearest = (anchors) => {                                        // la zone d'auteur la plus proche (les deux côtés), parmi celles de ces ancres
    let best = null, bd = 1e9;
    for (const zn in ZONES) { const Z = ZONES[zn]; if (!anchors.includes(Z[0])) continue; const hz = Z[0] === 'head';
      for (const s of (Z[1][0] ? [1, -1] : [1])) {
        const q = new THREE.Vector3().copy(_bf.anc[Z[0]]).addScaledVector(hz ? _bf.hX : _bf.X, Z[1][0] * s).addScaledVector(hz ? _bf.hY : _bf.Y, Z[1][1]).addScaledVector(hz ? _bf.hZ : _bf.Z, Z[1][2]);
        const d = q.distanceTo(p); if (d < bd) { bd = d; best = zn; } } }
    return best; };
  if (/Head|Orbicularis/.test(bone)) {
    const hr = _tl.n.copy(p).sub(_bf.anc.head), hx = hr.dot(_bf.hX), hy = hr.dot(_bf.hY), hz = hr.dot(_bf.hZ); let best = null, bd = 1e9;
    for (const [zn, m] of HEAD_MARKS) for (const sx of (m[0] ? [1, -1] : [1])) { const d = (hx - m[0] * sx) ** 2 + (hy - m[1]) ** 2 + (hz - m[2]) ** 2; if (d < bd) { bd = d; best = zn; } }
    return best; }
  if (/Neck/.test(bone)) return nz > 0.15 ? 'cou' : 'nuque';
  if (/Shoulder$/.test(bone)) return 'epaule';
  if (/Spine2/.test(bone)) {
    const ush = _tl.n.copy(p).sub(_bf.anc.sh).dot(_bf.Y);                 // bas du cou (pondéré au buste) : au-dessus de la ligne des épaules, près de l'axe
    if (ush > -0.02 && Math.abs(lx) < 0.075) return nz < 0 ? 'nuque' : 'cou';
    if (nz < -0.35) return 'dos'; const z = nearest(['sh']); return z === 'bras' ? 'epaule' : z; }
  if (/Spine1?$/.test(bone)) { if (nz < -0.35) return ly > 0.2 ? 'dos' : 'reins'; if (Math.abs(nx) > 0.65) return 'taille'; return 'ventre'; }
  if (/Hips/.test(bone) && ly > 0.07) { if (nz < -0.35) return 'reins'; if (Math.abs(nx) > 0.6) return 'taille'; return 'ventre'; }   // haut du bassin : c'est la taille (vu : la taille lue comme « hanche »)
  if (/Hips/.test(bone)) {
    if (nz < -0.2) return Math.abs(lx) < 0.022 && ly < -0.07 ? null : 'fesse';          // sillon fessier bas : rien (zone anale)
    if (Math.abs(lx) < 0.045 && ly < -0.06) return null;                               // zone génitale : rien
    if (Math.abs(nx) > 0.6) return 'hanche';
    return ly < -0.01 ? 'aine' : 'ventre'; }
  if (/UpLeg/.test(bone)) { if (inward > 0.45) return 'cuisseint'; return 'cuisse'; }
  if (/(Left|Right)Leg$/.test(bone)) { const kb = side > 0 ? b.rLowLeg : b.lLowLeg; return kb && rawOf(kb).getWorldPosition(new THREE.Vector3()).distanceTo(p) < 0.075 ? 'genou' : 'mollet'; }
  if (/Foot|Toe/.test(bone)) { const sn = side > 0 && FOOTLOC.r ? _bf.soleN : _tl.n.set(0, -1, 0); return n.dot(sn) > 0.45 ? 'plante' : 'pied'; }
  if (/ForeArm/.test(bone)) { const hb = side > 0 ? b.rHand : b.lHand; return hb && hb.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 0.06 ? 'poignet' : 'avantbras'; }
  if (/(^|[^e])Arm$/.test(bone) && !/ForeArm/.test(bone)) { const ab = side > 0 ? b.rArm : b.lArm; const near = ab && ab.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 0.1; return near && (inward > 0.25 || ny < -0.45) ? 'aisselle' : 'bras'; }
  if (/Hand/.test(bone)) return 'main';
  return null;
}
/* THERMORÉCEPTION : densité des points de froid/chaud (visage et lèvres très denses, tronc moyen, extrémités moins) ; la peau est à ~33 °C.
   Une main froide fait frissonner (et sursauter au premier contact), une main chaude détend ; on s'y habitue en quelques secondes (adaptation thermique). */
const THERMO = { levres: 1, joue: 0.95, front: 0.9, nez: 0.85, oeil: 0.9, tempe: 0.85, menton: 0.8, machoire: 0.8, oreille: 0.75, cou: 0.85, nuque: 0.8, poitrine: 0.85, soussein: 0.85, ventre: 0.9, taille: 0.8, reins: 0.75, dos: 0.7, aisselle: 0.8, cuisseint: 0.8, aine: 0.8 };
function tlTemp(zone, held) {
  const th = THERMO[zone] ?? 0.6, d = TLIVE.temp - 33, ad = Math.exp(-held / 4);   // ad : adaptation (1 au contact → ~0 après une dizaine de secondes)
  return { fri: d < -4 ? th * Math.min(1, -d / 15) * ad : 0, pla: d > 1 ? th * 0.3 * Math.min(1, d / 5) * ad : 0, choc: d < -9 && held < 0.15 ? th * Math.min(1, -d / 18) : 0 };
}
/* adaptation sensorielle (récepteurs à adaptation rapide : Meissner, Pacini) : un toucher qui dure ou se répète s'émousse ; la douleur, elle, ne s'émousse pas */
function tlHabit(zone, dt, on) {
  const h = TLIVE.hab[zone] || 0;
  TLIVE.hab[zone] = on ? Math.min(1, h + dt * 0.07) : Math.max(0, h - dt * 0.05);
  for (const z in TLIVE.hab) if (z !== zone) TLIVE.hab[z] = Math.max(0, TLIVE.hab[z] - dt * 0.05);
  return TLIVE.hab[zone];
}
function tlModeSet(m) {
  TLIVE.mode = m; const bt = document.getElementById('btn-hand');
  if (bt) { bt.textContent = m ? TL_MODES[m] : '✋'; bt.classList.toggle('on', !!m); bt.setAttribute('aria-pressed', m ? 'true' : 'false'); bt.title = m === 1 ? 'Mode toucher : glisse sur son corps' : m === 2 ? 'Mode pincer : appuie longtemps pour pincer plus fort' : 'Toucher Aiko'; }
  stage.classList.toggle('hand', !!m);
  if (m) showToast(m === 1 ? 'Glisse ton doigt sur elle' : 'Appuie pour pincer');
}
{ const bt = document.getElementById('btn-hand'); if (bt) bt.addEventListener('click', () => tlModeSet((TLIVE.mode + 1) % 3)); }
// les gestes du doigt : en PHASE DE CAPTURE, avant la caméra — si le doigt est sur elle, la caméra ne bouge pas
stage.addEventListener('pointerdown', (e) => {
  if (!TLIVE.mode || TLIVE.act || e.button === 2 || e.shiftKey) return;
  const h = tlPick(e.clientX, e.clientY); if (!h) return;
  const zone = tlZone(h); if (!zone) return;
  e.stopPropagation(); try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  const now = performance.now();
  TLIVE.act = { id: e.pointerId, t0: now, tl: now, p: h.point.clone(), p0: h.point.clone(), n: h.normal.clone(), zone, travel: 0, v: 0, vpk: 0, still: 0, pr: e.pressure, pt: e.pointerType, pinch: TLIVE.mode === 2, sum: { pla: 0, cha: 0, dou: 0, fri: 0, k: 0 }, pk: { pla: 0, cha: 0, dou: 0, fri: 0 }, style: TLIVE.mode === 2 ? 'pince' : 'pose', bone: surfTriBone(h.tri) };
  TLIVE.glance = 0.8;
}, { capture: true });
stage.addEventListener('pointermove', (e) => {
  const A = TLIVE.act; if (!A || e.pointerId !== A.id) return;
  e.stopPropagation();
  A.cx = e.clientX; A.cy = e.clientY; A.pr = e.pressure; A.mv = true;          // le calcul se fait UNE fois par image (touchLiveUpdate) : un écran tactile envoie 60-120 événements/s
}, { capture: true });
function tlMove(A) {
  A.mv = false;
  const h = tlPick(A.cx, A.cy); if (!h) return;                         // le doigt glisse hors du corps : on garde le dernier point
  const now = performance.now(), dts = Math.max(1e-3, (now - A.tl) / 1000), d = h.point.distanceTo(A.p);
  if (d > 0.04) { A.p.copy(h.point); A.n.copy(h.normal); A.tl = now; const z0 = tlZone(h); if (z0) A.zone = z0; return; }   // SAUT d'une surface à l'autre (bord du corps, bras le long du flanc) : pas une vitesse — on repart de ce point (vu : pic à 176 cm/s)
  const vi = d / dts * 100; A.v += (vi - A.v) * Math.min(1, dts * 10);
  if (window.__tlLog) window.__tlLog.push([+(d * 1000).toFixed(1), +(dts * 1000).toFixed(0), +vi.toFixed(1), +A.v.toFixed(1), e.clientX, e.clientY]); A.vpk = Math.max(A.vpk, vi); A.travel += d;
  A.p.copy(h.point); A.n.copy(h.normal); A.tl = now; A.bone = surfTriBone(h.tri);
  const z = tlZone(h); if (z) A.zone = z;
}
function tlEnd(e) {
  const A = TLIVE.act; if (!A || (e && e.pointerId !== A.id)) return;
  if (e) e.stopPropagation();
  if (A.mv) tlMove(A);
  const dur = (performance.now() - A.t0) / 1000;
  let style = A.style;
  if (!A.pinch && A.travel < 0.012 && dur < 0.28) style = 'tapote';                              // petit tap
  else if (!A.pinch && A.vpk > 70 && dur < 0.35) style = A.zone === 'fesse' ? 'fessee' : A.zone === 'joue' ? 'claque' : 'tape';   // geste vif et bref : une tape
  if (style === 'tapote' || /fessee|claque|tape/.test(style)) {                                      // événement instantané : ressenti et choc tout de suite
    const F = /fessee|claque|tape/.test(style) ? Math.min(1, 0.35 + A.vpk / 220) : 0.25;
    const s = touchSense(A.zone, style, F);
    tlFeel(s, A, 1, true);
    if (/fessee|claque|tape/.test(style)) {
      TLIVE.flinch = { t: 0, amp: Math.min(1.2, 0.35 + s.douleur + F * 0.4) };
      const lx = A.p.clone().sub(_bf.anc.hips).dot(_bf.X), pat = A.zone === 'fesse' ? (lx >= 0 ? /^RightButtock/ : /^LeftButtock/) : /poitrine|soussein/.test(A.zone) ? (lx >= 0 ? /^RightBreast/ : /^LeftBreast/) : null;
      if (pat) IMPACT.q.push({ pat, v: A.n.clone().negate().multiplyScalar(0.9 * F) }); }
    A.sum = { pla: s.plaisir, cha: s.chatouille, dou: s.douleur, fri: s.frisson, k: 1 }; A.pk = { pla: s.plaisir, cha: s.chatouille, dou: s.douleur, fri: s.frisson };
  } else if (!A.pinch) style = A.travel > 0.03 ? (A.v > 18 ? 'frotte' : 'caresse') : 'pose';
  A.style = style;
  tlLearn(A);
  TLIVE.last = A; TLIVE.act = null;
}
stage.addEventListener('pointerup', tlEnd, { capture: true });
stage.addEventListener('pointercancel', tlEnd, { capture: true });
/* ce qu'elle ressent à cet instant → cibles de réaction (adaptation appliquée) */
function tlFeel(s, A, k, instant) {
  const R = TLIVE.react, ha = 1 - 0.6 * (TLIVE.hab[A.zone] || 0);
  const t = { pla: s.plaisir * ha, cha: s.chatouille * ha, dou: s.douleur, fri: s.frisson * ha };
  for (const c in t) { R[c] = instant ? Math.max(R[c], t[c]) : R[c] + (t[c] - R[c]) * k; A.pk[c] = Math.max(A.pk[c], t[c]); }
  if (!instant) { A.sum.pla += t.pla; A.sum.cha += t.cha; A.sum.dou += t.dou; A.sum.fri += t.fri; A.sum.k++; }
  TLIVE.side = A.p.clone().sub(_bf.anc.head || _bf.anc.sh).dot(_bf.X) >= 0 ? 1 : -1;
  TLIVE.head = /joue|cou|oreille|nuque|tempe|cheveux|machoire|epaule/.test(A.zone) ? 1 : 0;
  lastTouch = { zone: A.zone, style: A.style, by: 'toi', t: Date.now(), plaisir: +t.pla.toFixed(2), douleur: +t.dou.toFixed(2), chatouille: +t.cha.toFixed(2), frisson: +t.fri.toFixed(2), force: s.force, vitesse_cm_s: s.vitesse_cm_s };
}
/* SON propre toucher, en continu : la vraie vitesse de sa main sur sa peau, l'habituation, et la même couche de réactions que pour le tien */
function tlSelfFeel(zone, style, F, v, dt, side) {
  const s = touchSense(zone, style, F, v), ha = 1 - 0.6 * tlHabit(zone, dt, true), R = TLIVE.react, k = Math.min(1, dt * 6);
  const t = { pla: s.plaisir * ha, cha: s.chatouille * ha, dou: s.douleur, fri: s.frisson * ha };
  for (const c in t) R[c] += (t[c] - R[c]) * k;
  TLIVE.selfOn = true; TLIVE.side = side; TLIVE.head = /joue|cou|oreille|nuque|tempe|cheveux|machoire/.test(zone) ? 1 : 0;
  return t;
}
/* chaque image : ressenti continu pendant que le doigt est posé, réactions du corps, regard */
function touchLiveUpdate(dt, b) {
  const A = TLIVE.act, R = TLIVE.react;
  if (A) {
    if (A.mv) tlMove(A);
    const held = (performance.now() - A.t0) / 1000;
    if (A.v < 1.5) A.still += dt; else A.still = 0;
    if (performance.now() - A.tl > 90) A.v *= Math.exp(-dt * 8);                 // le doigt ne bouge plus (aucun événement depuis 90 ms) : la vitesse retombe — PAS pendant qu'il glisse (vu : 4 cm/s lus 2,4)
    const prOk = A.pt !== 'mouse' && A.pr > 0 && A.pr !== 0.5 && A.pr !== 1;      // vraie pression mesurée par l'écran (stylet, écrans sensibles)
    let F, style;
    if (A.pinch) { F = Math.min(0.95, 0.3 + held * 0.26); style = 'pince'; }           // pincer : plus on reste, plus c'est fort
    else { F = prOk ? 0.05 + A.pr * 0.75 : Math.min(0.45, 0.12 + Math.max(0, A.still - 0.6) * 0.15); style = A.v > 18 ? 'frotte' : A.v > 0.8 ? 'caresse' : 'pose'; }
    A.style = style; A.F = F;
    const s = touchSense(A.zone, style, F, A.v);
    const tp = tlTemp(A.zone, held); s.frisson = Math.min(1, s.frisson + tp.fri); s.plaisir = Math.min(1, s.plaisir + tp.pla);   // température de ta main
    if (tp.choc > 0.2 && !A.cold) { A.cold = 1; TLIVE.flinch = { t: 0, amp: 0.25 + 0.4 * tp.choc }; }   // main glacée : petit sursaut au contact
    tlHabit(A.zone, dt, true);
    tlFeel(s, A, Math.min(1, dt * 8), false);
    if (s.douleur > 0.2 && !A.hurt) { A.hurt = 1; TLIVE.flinch = { t: 0, amp: Math.min(1, 0.25 + s.douleur) }; }   // ça fait mal : sursaut, une fois
    if (/poitrine|soussein|fesse/.test(A.zone) && (style === 'pose' || A.pinch) && F > 0.15) {   // la chair cède sous l'appui (le jig recule, puis revient quand on lâche)
      const lx = A.p.clone().sub(_bf.anc.hips).dot(_bf.X), pat = A.zone === 'fesse' ? (lx >= 0 ? /^RightButtock/ : /^LeftButtock/) : (lx >= 0 ? /^RightBreast/ : /^LeftBreast/);
      IMPACT.q.push({ pat, v: A.n.clone().negate().multiplyScalar(F * dt * 1.6) }); }
  } else if (!TLIVE.selfOn) { tlHabit('', dt, false); for (const c in R) R[c] *= Math.exp(-dt * 1.6); }
  TLIVE.selfOn = false;   // remis à vrai à chaque image où SA main la touche
  // ── réactions du corps (additives, par-dessus sa pose ou son geste en cours)
  const t = performance.now() / 1000, sd = TLIVE.side;
  if (b.chest && R.cha > 0.03) { b.chest.rotation.z += Math.sin(t * 13) * 0.03 * R.cha; b.chest.rotation.y += -sd * 0.14 * R.cha; if (b.spine) b.spine.rotation.x += 0.06 * R.cha; }   // chatouilles : rire qui secoue le buste, retrait du côté touché, buste qui s'enroule
  for (const [sb, sg] of [[b.lSh, 1], [b.rSh, -1]]) if (sb) sb.rotation.z += sg * (0.07 * R.cha + 0.04 * R.fri + Math.sin(t * 21) * 0.012 * R.fri);   // épaules qui remontent (chatouille, frisson qui parcourt)
  if (b.head && TLIVE.head && R.pla > 0.05) { b.head.rotation.z += sd * 0.09 * R.pla; b.head.rotation.x += 0.03 * R.pla; }   // discret : sinon le visage venait se placer sous le doigt (vu)   // elle vient au-devant de la caresse (joue, cou)
  if (b.chest && R.pla > 0.05) b.chest.rotation.x -= 0.04 * R.pla;                // le buste s'ouvre, se détend
  if (TLIVE.flinch) { const f = TLIVE.flinch; f.t += dt; const e = Math.exp(-f.t * 7) * Math.sin(f.t * 24) * f.amp;   // sursaut amorti
    if (b.chest) b.chest.rotation.x += -0.5 * e; if (b.head) b.head.rotation.x += -0.3 * e; if (b.rSh) b.rSh.rotation.z -= 0.25 * e; if (b.lSh) b.lSh.rotation.z += 0.25 * e;
    if (f.t > 1.2) TLIVE.flinch = null; }
  // ── visage
  const fc = R.dou > 0.25 ? ['angry', Math.min(1, 0.3 + R.dou)] : R.cha > 0.3 ? ['happy', Math.min(1, 0.4 + R.cha)] : R.pla > 0.25 ? ['relaxed', Math.min(1, 0.35 + R.pla)] : null;
  if (TLIVE.face && (!fc || fc[0] !== TLIVE.face)) { setExpr(TLIVE.face, 0); TLIVE.face = null; }
  if (fc) { TLIVE.face = fc[0]; setExpr(fc[0], fc[1]); }
  // ── regard : un coup d'œil à l'endroit touché, puis vers toi
  if (TLIVE.glance > 0 && A) { TLIVE.glance -= dt; lookAtTarget.position.copy(camera.worldToLocal(A.p.clone())); }
}
/* retenir et, parfois, le dire */
function tlLearn(A) {
  if (!A.sum.k) return;
  const avg = { plaisir: A.sum.pla / A.sum.k, douleur: Math.max(A.pk.dou, A.sum.dou / A.sum.k), chatouille: A.sum.cha / A.sum.k, frisson: A.sum.fri / A.sum.k };
  if (typeof sensLearn === 'function') sensLearn('toi>' + A.zone, A.style, avg);
  lastTouch = { zone: A.zone, style: A.style, by: 'toi', t: Date.now(), plaisir: +A.pk.pla.toFixed(2), douleur: +A.pk.dou.toFixed(2), chatouille: +A.pk.cha.toFixed(2), frisson: +A.pk.fri.toFixed(2) };
  const peak = Math.max(A.pk.pla, A.pk.cha, A.pk.dou);
  try { lastUserAt = Date.now(); } catch (_) {}
  if (peak < 0.2 || window.__tlMute || Date.now() - TLIVE.spoken < 6000 || thinking || mouthOn) return;   // réagit à voix haute dès qu'elle ressent quelque chose de net (au plus une phrase toutes les 6 s, et jamais en parlant)
  TLIVE.spoken = Date.now();
  const q = [['plaisir', A.pk.pla], ['douleur', A.pk.dou], ['chatouilles', A.pk.cha], ['frisson', A.pk.fri]].filter((x) => x[1] > 0.25).map((x) => x[0] + ' ' + Math.round(x[1] * 10) + '/10').join(', ');
  (async () => { try { setThinking(true);
    const r = await askClaude('(Ce n\'est pas elle qui parle : elle vient de TE toucher — ' + A.style + ' sur ' + (ZONE_LABEL[A.zone] || A.zone) + ' ; tu as ressenti : ' + q + '. Réagis en UNE phrase courte, à l\'oral, avec ton vrai ressenti — un rire, un soupir, une protestation ou une demande — sans répéter les chiffres.)', () => {}, null, true);
    setThinking(false); if (r && r.reply) sayAsAiko(r); } catch (_) { setThinking(false); } })();
}
const ZONE_LABEL = { cuisseint: 'l\'intérieur de ta cuisse', aine: 'ton aine', soussein: 'le dessous de ton sein', avantbras: 'ton avant-bras', plante: 'la plante de ton pied', dos: 'ton dos', mollet: 'ton mollet' };

document.querySelectorAll('[data-handtemp]').forEach((c) => c.addEventListener('click', () => {   // température de ta main (le ressenti au contact en dépend)
  TLIVE.temp = +c.dataset.handtemp; document.querySelectorAll('[data-handtemp]').forEach((x) => x.classList.toggle('on', x === c)); }));
