/* ---------- chargement VRM ---------- */
const gltfLoader = new GLTFLoader();
gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

/* ---------- avatar réaliste (GLB, squelette Mixamo/Avaturn/Ready Player Me, visage ARKit) ----------
   On lui donne la même interface qu'un VRM : le reste de la page (poses, gestes, émotions, lèvres) ne change pas. */
const GLB_BONES = {
  hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head',
  leftEye: 'LeftEye', rightEye: 'RightEye',
  leftShoulder: 'LeftShoulder', leftUpperArm: 'LeftArm', leftLowerArm: 'LeftForeArm', leftHand: 'LeftHand',
  rightShoulder: 'RightShoulder', rightUpperArm: 'RightArm', rightLowerArm: 'RightForeArm', rightHand: 'RightHand',
  leftUpperLeg: 'LeftUpLeg', leftLowerLeg: 'LeftLeg', leftFoot: 'LeftFoot', leftToes: 'LeftToeBase',
  rightUpperLeg: 'RightUpLeg', rightLowerLeg: 'RightLeg', rightFoot: 'RightFoot', rightToes: 'RightToeBase',
};
for (const [S, s2] of [['Left', 'left'], ['Right', 'right']]) {
  for (const [F, f] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
    GLB_BONES[s2 + f + 'Proximal'] = S + 'Hand' + F + '1'; GLB_BONES[s2 + f + 'Intermediate'] = S + 'Hand' + F + '2'; GLB_BONES[s2 + f + 'Distal'] = S + 'Hand' + F + '3';
  }
  GLB_BONES[s2 + 'ThumbMetacarpal'] = S + 'HandThumb1'; GLB_BONES[s2 + 'ThumbProximal'] = S + 'HandThumb2'; GLB_BONES[s2 + 'ThumbDistal'] = S + 'HandThumb3';
}
const GLB_EXPR = {
  happy: { mouthSmileLeft: 0.75, mouthSmileRight: 0.75, cheekSquintLeft: 0.45, cheekSquintRight: 0.45, eyeSquintLeft: 0.25, eyeSquintRight: 0.25 },
  relaxed: { mouthSmileLeft: 0.32, mouthSmileRight: 0.32, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },
  // émotions de base d'après le FACS (Ekman) — chaque « unité d'action » = un muscle : AU1 frontal interne (browInnerUp), AU2 frontal externe (browOuterUp),
  // AU4 sourcilier (browDown), AU5 releveur de la paupière (eyeWide), AU6 orbiculaire de l'œil (cheekSquint), AU7 paupière tendue (eyeSquint), AU9 nez froncé (noseSneer),
  // AU10 lèvre supérieure relevée (mouthUpperUp), AU12 grand zygomatique (mouthSmile), AU15 abaisseur de la commissure (mouthFrown), AU17 menton (mouthShrugLower),
  // AU20 risorius (mouthStretch), AU23/24 lèvres serrées (mouthPress), AU26 mâchoire relâchée (jawOpen).
  sad: { mouthFrownLeft: 0.6, mouthFrownRight: 0.6, browInnerUp: 0.75, browDownLeft: 0.22, browDownRight: 0.22, mouthShrugLower: 0.35, eyeSquintLeft: 0.15, eyeSquintRight: 0.15, eyeLookDownLeft: 0.18, eyeLookDownRight: 0.18 },   // 1+4+15+17, regard un peu baissé
  angry: { browDownLeft: 0.85, browDownRight: 0.85, eyeWideLeft: 0.2, eyeWideRight: 0.2, eyeSquintLeft: 0.4, eyeSquintRight: 0.4, mouthPressLeft: 0.5, mouthPressRight: 0.5, noseSneerLeft: 0.25, noseSneerRight: 0.25 },   // 4+5+7+23/24 (regard fixe et dur)
  surprised: { eyeWideLeft: 0.8, eyeWideRight: 0.8, browInnerUp: 0.7, browOuterUpLeft: 0.7, browOuterUpRight: 0.7, jawOpen: 0.22 },   // 1+2+5+26
  fear: { browInnerUp: 0.65, browOuterUpLeft: 0.4, browOuterUpRight: 0.4, browDownLeft: 0.3, browDownRight: 0.3, eyeWideLeft: 0.85, eyeWideRight: 0.85, eyeSquintLeft: 0.12, eyeSquintRight: 0.12, mouthStretchLeft: 0.5, mouthStretchRight: 0.5, jawOpen: 0.15 },   // peur : 1+2+4+5+7+20+26
  disgust: { noseSneerLeft: 0.7, noseSneerRight: 0.7, mouthUpperUpLeft: 0.45, mouthUpperUpRight: 0.45, mouthFrownLeft: 0.3, mouthFrownRight: 0.3, mouthShrugLower: 0.2, browDownLeft: 0.35, browDownRight: 0.35, eyeSquintLeft: 0.3, eyeSquintRight: 0.3 },   // dégoût : 9+10+15+17
  neutral: {},
  blink: { eyeBlinkLeft: 1, eyeBlinkRight: 1 },
  aa: { viseme_aa: 0.85, jawOpen: 0.1 },
  oh: { viseme_O: 0.9 },
  kiss: { mouthPucker: 0.85, mouthFunnel: 0.15, eyeSquintLeft: 0.2, eyeSquintRight: 0.2 },
  wink: { eyeBlinkLeft: 1, cheekSquintLeft: 0.5, mouthSmileLeft: 0.55, mouthSmileRight: 0.2 },
  browUp: { browInnerUp: 0.7, browOuterUpLeft: 0.6, browOuterUpRight: 0.6 },
  pout: { mouthPucker: 0.45, mouthRollLower: 0.25, mouthFrownLeft: 0.25, mouthFrownRight: 0.25, browInnerUp: 0.3 },
  smirk: { mouthSmileRight: 0.6, mouthDimpleRight: 0.35, cheekSquintRight: 0.3, browOuterUpRight: 0.25 },
  lipbite: { mouthRollLower: 0.6, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15, mouthSmileLeft: 0.25, mouthSmileRight: 0.25, eyeSquintLeft: 0.2, eyeSquintRight: 0.2 },
  eyeroll: { eyeLookUpLeft: 1, eyeLookUpRight: 1, browInnerUp: 0.35, mouthPressLeft: 0.2, mouthPressRight: 0.2 },
  yawn: { jawOpen: 0.75, mouthFunnel: 0.2, eyeSquintLeft: 0.7, eyeSquintRight: 0.7, browInnerUp: 0.4 },
  sigh: { eyeBlinkLeft: 0.55, eyeBlinkRight: 0.55, mouthPressLeft: 0.2, mouthPressRight: 0.2, browInnerUp: 0.25 },
  // micro-expressions : brèves bouffées de muscles faciaux qui donnent une vie au visage au repos (nom distinct → s'ajoutent sans écraser le reste)
  browFlick: { browInnerUp: 0.6, browOuterUpLeft: 0.55, browOuterUpRight: 0.55 },        // les sourcils se lèvent un instant
  browIdle: { browInnerUp: 0.35, browOuterUpLeft: 0.4, browOuterUpRight: 0.32 },         // micro-dérive continue, légèrement asymétrique
  faceThink: { browInnerUp: 0.55, mouthPressLeft: 0.3, mouthPressRight: 0.22, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },   // air pensif
  faceDoubt: { browOuterUpLeft: 0.7, browInnerUp: 0.25, mouthSmileRight: 0.18, eyeSquintRight: 0.12 },   // un sourcil qui se hausse, sceptique
  faceSoft: { mouthSmileLeft: 0.35, mouthSmileRight: 0.35, cheekSquintLeft: 0.22, cheekSquintRight: 0.22, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },   // douceur fugace
  swallow: { jawOpen: 0.05, mouthPressLeft: 0.3, mouthPressRight: 0.3, mouthRollLower: 0.2 },            // petite déglutition
  // visèmes (formes de bouche par son) pour la synchro labiale syllabe par syllabe
  v_PP: { viseme_PP: 1 }, v_FF: { viseme_FF: 1 }, v_TH: { viseme_TH: 1 }, v_DD: { viseme_DD: 1, jawOpen: 0.04 },
  v_kk: { viseme_kk: 1, jawOpen: 0.04 }, v_CH: { viseme_CH: 1 }, v_SS: { viseme_SS: 1 }, v_nn: { viseme_nn: 1 },
  v_RR: { viseme_RR: 1 }, v_aa: { viseme_aa: 1, jawOpen: 0.12 }, v_E: { viseme_E: 1, jawOpen: 0.04 },
  v_I: { viseme_I: 1 }, v_O: { viseme_O: 1, jawOpen: 0.06 }, v_U: { viseme_U: 1 },
  // bouche qui mange et langue : pilotées image par image par les gestes (faceSeq) — tirer la langue, lécher, croquer, mâcher
  langue: { tongueOut: 1, jawOpen: 0.3, mouthFunnel: 0.08 },                                   // tirer la langue
  leche: { tongueOut: 1, jawOpen: 0.42, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15 },    // langue sortie pour lécher, lèvre du haut dégagée
  bouchee: { jawOpen: 0.62, mouthUpperUpLeft: 0.25, mouthUpperUpRight: 0.25, mouthLowerDownLeft: 0.25, mouthLowerDownRight: 0.25 },   // grande ouverture, dents découvertes, juste avant de croquer
  mache: { jawOpen: 0.2, mouthClose: 0.2, mouthPressLeft: 0.12, mouthPressRight: 0.12 },       // mâcher bouche fermée : la mâchoire descend, les lèvres restent jointes
  mach_g: { jawLeft: 0.55 }, mach_d: { jawRight: 0.55 },                                       // déport latéral de la mâchoire (le côté qui mâche)
  joues: { cheekPuff: 0.3 },
  l_haut: { tongueTipUp: 1 }, l_bas: { tongueTipDown: 1 }, l_g: { tongueLeft: 1 }, l_d: { tongueRight: 1 }, l_fine: { tongueNarrow: 1 },   // formes de langue créées (tongueShapes)                                                                   // joues pleines
  miam: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4, eyeSquintLeft: 0.35, eyeSquintRight: 0.35, cheekSquintLeft: 0.3, cheekSquintRight: 0.3 },
  jali: { jawOpen: 1 },                                                                        // parole : part de MÂCHOIRE pilotée par le volume réel de la voix (modèle JALI : mâchoire et lèvres séparées)
};
const GLB_BASE = { mouthSmileLeft: 0.1, mouthSmileRight: 0.1 };   // visage au repos : un soupçon de sourire
/* LANGUE : son modèle n'a qu'une forme de langue (« sortie »). On lui CRÉE ici, sur la vraie géométrie de sa langue, les formes que les rigs de
   référence animent (MetaHuman : tongueTipUp / Down / Left / Right, tongueNarrow…) : la pointe se recourbe vers le haut ou le bas, la langue part sur
   le côté, s'affine en pointe. Chaque forme est une flexion progressive (nulle à la racine, maximale à la pointe : la racine est attachée au plancher
   de la bouche), calculée dans le repère propre de la langue (axe avant = direction où elle sort). Ajoutées AVANT la première image. */
function tongueShapes(root) {
  let m = null; root.traverse((o) => { if (!m && o.isMesh && /tongue/i.test(o.name) && o.morphTargetDictionary && o.morphTargetDictionary.tongueOut !== undefined) m = o; });
  if (!m || m.morphTargetDictionary.tongueTipUp !== undefined) return;
  const g = m.geometry, P = g.attributes.position, n = P.count, out = g.morphAttributes.position[m.morphTargetDictionary.tongueOut];
  const F = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) F.x += out.getX(i), F.y += out.getY(i), F.z += out.getZ(i);
  if (!g.morphTargetsRelative) F.set(0, 0, 0).add(new THREE.Vector3(0, 0, 1)); F.normalize();          // axe avant (où elle sort)
  const U = new THREE.Vector3(0, 1, 0).addScaledVector(F, -F.y).normalize(), S = new THREE.Vector3().crossVectors(F, U).normalize();
  let p0 = Infinity, p1 = -Infinity, c = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); const p = v.dot(F); p0 = Math.min(p0, p); p1 = Math.max(p1, p); c.add(v); } c.multiplyScalar(1 / n);
  const Lt = Math.max(1e-4, p1 - p0), cs = c.dot(S), cu = c.dot(U);
  const mk = (name, fn) => { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); const t = (v.dot(F) - p0) / Lt, d = fn(t, v.dot(S) - cs, v.dot(U) - cu); a[i * 3] = d.x; a[i * 3 + 1] = d.y; a[i * 3 + 2] = d.z; }
    const at = new THREE.Float32BufferAttribute(a, 3); at.name = name; g.morphAttributes.position.push(at);
    if (g.morphAttributes.normal) { const z = new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3); z.name = name; g.morphAttributes.normal.push(z); }
    m.morphTargetDictionary[name] = m.morphTargetInfluences.length; m.morphTargetInfluences.push(0); };   // on AJOUTE sans reconstruire : updateMorphTargets() effacerait les noms d'origine (tongueOut, visèmes)
  const bend = (t) => { const x = Math.max(0, (t - 0.3) / 0.7); return x * x; };      // la flexion naît au tiers arrière et grandit vers la pointe
  const D = new THREE.Vector3();
  mk('tongueTipUp', (t) => D.copy(U).multiplyScalar(Lt * 0.3 * bend(t)).addScaledVector(F, -Lt * 0.07 * bend(t) * t));     // pointe recourbée vers le haut (≈ coup de langue)
  mk('tongueTipDown', (t) => D.copy(U).multiplyScalar(-Lt * 0.24 * bend(t)).addScaledVector(F, -Lt * 0.06 * bend(t) * t));
  mk('tongueLeft', (t) => D.copy(S).multiplyScalar(-Lt * 0.36 * bend(t)).addScaledVector(F, -Lt * 0.1 * bend(t) * t));
  mk('tongueRight', (t) => D.copy(S).multiplyScalar(Lt * 0.36 * bend(t)).addScaledVector(F, -Lt * 0.1 * bend(t) * t));
  mk('tongueNarrow', (t, s, u) => D.copy(S).multiplyScalar(-s * 0.35 * t).addScaledVector(U, u * 0.15 * t).addScaledVector(F, Lt * 0.06 * t));   // plus étroite et plus épaisse, en pointe
}
function makeGlbAvatar(gltf) {
  const root = gltf.scene;
  try { tongueShapes(root); } catch (e) { console.warn('langue', e); }
  const find = (n) => root.getObjectByName(n) || root.getObjectByName('mixamorig' + n) || root.getObjectByName('mixamorig:' + n);
  const raw = {};
  for (const k in GLB_BONES) { const b = find(GLB_BONES[k]); if (b) raw[k] = b; }
  for (const k of ['hips', 'spine', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot']) if (!raw[k]) return null;

  // Mise en pose en T (beaucoup d'avatars sont livrés bras à 45°) : c'est la pose de référence du squelette normalisé.
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion(), wq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const align = (bone, child, dir) => {
    root.updateMatrixWorld(true);
    bone.getWorldPosition(a); child.getWorldPosition(b);
    q.setFromUnitVectors(b.sub(a).normalize(), dir);
    bone.getWorldQuaternion(wq); bone.parent.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  };
  root.updateMatrixWorld(true);
  const side = Math.sign(raw.leftUpperArm.getWorldPosition(new THREE.Vector3()).x - raw.rightUpperArm.getWorldPosition(new THREE.Vector3()).x) || 1;
  const L = new THREE.Vector3(side, 0, 0), R = new THREE.Vector3(-side, 0, 0), D = new THREE.Vector3(0, -1, 0);
  align(raw.leftUpperArm, raw.leftLowerArm, L); align(raw.leftLowerArm, raw.leftHand, L);
  align(raw.rightUpperArm, raw.rightLowerArm, R); align(raw.rightLowerArm, raw.rightHand, R);
  align(raw.leftUpperLeg, raw.leftLowerLeg, D); align(raw.leftLowerLeg, raw.leftFoot, D);
  align(raw.rightUpperLeg, raw.rightLowerLeg, D); align(raw.rightLowerLeg, raw.rightFoot, D);
  root.updateMatrixWorld(true);

  const humanBones = {};
  for (const k in raw) humanBones[k] = { node: raw[k] };
  const humanoid = new VRMHumanoid(humanBones, { autoUpdateHumanBones: true });
  root.add(humanoid.normalizedHumanBonesRoot);

  // Visage : chaque « expression » pilote un mélange de formes ARKit / visèmes sur tous les maillages concernés.
  const slots = {};                                  // nom de forme -> [[tableau d'influences, index]]
  root.traverse((o) => {
    if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
      for (const n in o.morphTargetDictionary) (slots[n] = slots[n] || []).push([o.morphTargetInfluences, o.morphTargetDictionary[n]]);
    }
  });
  const values = {}, used = new Set(Object.keys(GLB_BASE));
  for (const e in GLB_EXPR) for (const n in GLB_EXPR[e]) used.add(n);
  const EYE = ['eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight'];
  EYE.forEach((n) => used.add(n));
  const acc = {}, hp = new THREE.Vector3(), tp = new THREE.Vector3(), hq = new THREE.Quaternion();
  // Asymétrie : les expressions spontanées sont moins symétriques que les expressions jouées (Frank & Ekman) — jamais les paupières (le clignement reste simultané) ni les visèmes
  const ASYM = ['mouthSmile', 'mouthFrown', 'mouthDimple', 'mouthStretch', 'mouthUpperUp', 'cheekSquint', 'browOuterUp', 'browDown', 'noseSneer', 'eyeSquint'];
  let asymT = Math.random() * 100;
  const lookAt = { target: null };
  let eyeX = 0, eyeY = 0;
  const cl = (v) => Math.max(0, Math.min(1, v));
  return {
    scene: root, humanoid, lookAt, isGlb: true, meta: { metaVersion: '1' },
    expressionManager: { setValue(name, w) { values[name] = w; } },
    hasShape(n) { return !!slots[n]; }, shapeNames() { return Object.keys(slots); },
    addShapes(names) { for (const n of names) if (slots[n]) used.add(n); },        // une expression créée (proposée puis validée) pilote aussi ses formes
    update(dt) {
      humanoid.update();
      for (const n of used) acc[n] = GLB_BASE[n] || 0;
      for (const e in values) { const w = values[e], m = GLB_EXPR[e]; if (w && m) for (const n in m) acc[n] += m[n] * w; }
      if (lookAt.target && raw.head) {               // regard : les yeux suivent la cible, dans le repère de la tête
        raw.head.getWorldPosition(hp); raw.head.getWorldQuaternion(hq);
        lookAt.target.getWorldPosition(tp).sub(hp).applyQuaternion(hq.invert());
        const k = Math.min(1, (dt || 0.016) * 10);
        eyeX += (Math.max(-1, Math.min(1, Math.atan2(tp.x * side, tp.z) / 0.6)) - eyeX) * k;
        eyeY += (Math.max(-1, Math.min(1, Math.atan2(tp.y - 0.06, Math.hypot(tp.x, tp.z)) / 0.5)) - eyeY) * k;
        acc.eyeLookOutLeft = cl(eyeX) * 0.7; acc.eyeLookInRight = cl(eyeX) * 0.7;
        acc.eyeLookInLeft = cl(-eyeX) * 0.7; acc.eyeLookOutRight = cl(-eyeX) * 0.7;
        const er = (values.eyeroll || 0) * 0.85;              // « lever les yeux au ciel » l'emporte sur le suivi du regard
        acc.eyeLookUpLeft = acc.eyeLookUpRight = Math.max(cl(eyeY) * 0.6, er);
        if (er) { acc.eyeLookDownLeft = acc.eyeLookDownRight = 0; }
        if (!er) { const dn = cl(-eyeY) * 0.6; acc.eyeLookDownLeft = Math.max(acc.eyeLookDownLeft || 0, dn); acc.eyeLookDownRight = Math.max(acc.eyeLookDownRight || 0, dn); }   // le regard baissé de la tristesse n'est plus effacé par le suivi du regard
      }
      asymT += (dt || 0.016); const asy = 0.07 * Math.sin(asymT * 0.23 + 1.3) + 0.04 * Math.sin(asymT * 0.61);   // dérive lente, ±11 % au plus
      for (const n of ASYM) { const L = n + 'Left', R = n + 'Right'; if (acc[L] > 0.01 || acc[R] > 0.01) { acc[L] *= 1 + asy; acc[R] *= 1 - asy; } }
      for (const n of used) { const s = slots[n]; if (s) { const v = cl(acc[n]); for (let i = 0; i < s.length; i++) s[i][0][s[i][1]] = v; } }
    },
  };
}
// Éclairage d'ambiance pour les matières réalistes (sans effet sur les modèles VRM de style dessin).
let envTex = null;
function setRealistic(on) {
  if (on && !envTex) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
  scene.environment = on ? envTex : null;
  renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  rimA.intensity = on ? 1.1 : 0; rimB.intensity = on ? 0.9 : 0;
  renderer.toneMappingExposure = on ? 1.0 : 1;
  hemi.intensity = on ? 0.55 : 1.15;                       // moins de lumière plate : les volumes ressortent
  sun.color.set(on ? 0xfff6ee : 0xffffff); sun.intensity = on ? 2.3 : 1.7;   // lumière principale chaude, plus contrastée
  rim.color.set(on ? 0xffd9b8 : 0xc2410c); rim.intensity = on ? 1.1 : 0.45;  // contre-jour chaud : liseré lumineux sur les contours
  if (on && vrm) {
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = !/eye|lash|teeth|tongue/i.test(o.name);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m) continue;
        for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k].anisotropy = aniso; m[k].needsUpdate = true; }
        if (m.alphaTest > 0) m.alphaToCoverage = true;          // bords des cheveux adoucis
        if ('envMapIntensity' in m) m.envMapIntensity = /hair/i.test(o.name) ? 0.55 : 0.9;
        if (/tongue/i.test(o.name)) { m.color.setHex(0xf0a4a4); m.roughness = 0.36; }   // langue : rose plus soutenu et humide (salive) — sa texture d'origine sortait presque blanche sous la lumière
        m.needsUpdate = true;
      }
    });
    skinUpgrade();
  }
}