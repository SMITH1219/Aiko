/* ── Peau réaliste : translucidité simulée (la lumière « déborde » chaudement dans l'ombre), pores, léger duvet ──
   Rendu seulement : les formes, morphs, vêtements et animations ne changent pas. */
let poreTex = null;
function makePores() {                     // carte de relief des pores, répétable sans couture, générée ici (aucun fichier)
  const N = 256, h = new Float32Array(N * N);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {         // petits creux de tailles variées
    const cx = rnd() * N, cy = rnd() * N, r = 0.7 + rnd() * 1.4, d = 0.5 + rnd() * 0.8, R = Math.ceil(r * 2.5);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const q = (x * x + y * y) / (r * r); if (q > 6) continue;
      const X = (Math.floor(cx) + x + N) % N, Y = (Math.floor(cy) + y + N) % N;
      h[Y * N + X] -= d * Math.exp(-q);
    }
  }
  for (let i = 0; i < N * N; i++) h[i] += (rnd() - 0.5) * 0.18;   // grain fin
  const img = new ImageData(N, N), k = 0.9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    let nx = -dx * k, ny = -dy * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (y * N + x) * 4; img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(52, 52); t.colorSpace = THREE.NoColorSpace;
  return t;
}
const SKIN_WRAP = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  `float ndlW = dot( geometryNormal, directLight.direction );
	vec3 wrapW = vec3( 0.22, 0.12, 0.08 );            // le rouge passe plus loin sous la peau que le vert et le bleu
	vec3 irrW = clamp( ( vec3( ndlW ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 ) * directLight.color;
	reflectedLight.directDiffuse += irrW * BRDF_Lambert( material.diffuseColor );`);
const SKIN_TONE = 0xf7e2d4;                 // teint chaud doré (multiplie la texture de peau)

// Chair qui s'écrase au contact du sol : un point de peau qui passerait sous le sol y est posé, et la chair
// déborde un peu sur les côtés (fesses et cuisses assises ou allongées, genoux, hanches).
const HAIR_COL = { value: new THREE.Color(0.20, 0.13, 0.09) };   // cuir chevelu couvert (lu sur la texture des cheveux)
const SKIN_AVG = { value: new THREE.Color(0.86, 0.66, 0.56) };
const AREO = { uNL: { value: new THREE.Vector3(9, 9, 9) }, uNR: { value: new THREE.Vector3(9, 9, 9) }, uAR: { value: 0.03 }, uAS: { value: 1.0 } };   // aréoles : centres (espace de repos), rayon, intensité   // remplacée par la moyenne réelle de sa texture
const SQ = { uFloor: { value: 0 }, uHip: { value: new THREE.Vector2() }, uSquash: { value: 1 } };
function squashPatch(sh) {
  Object.assign(sh.uniforms, SQ);
  sh.uniforms.uSkinAvg = SKIN_AVG;
  sh.uniforms.uHair = HAIR_COL;
  Object.assign(sh.uniforms, AREO);
  sh.fragmentShader = 'varying float vCleft; varying float vUni; varying float vScalp; uniform vec3 uSkinAvg; uniform vec3 uHair; varying float vAreo; varying vec3 vRest; uniform vec3 uNL; uniform vec3 uNR; uniform float uAR; uniform float uAS;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', '#include <map_fragment>\n  if (vAreo > 0.5) { vec3 D1 = vRest - uNL, D2 = vRest - uNR; vec3 D = dot(D1, D1) < dot(D2, D2) ? D1 : D2; float d = length(D); float ang = atan(D.y, D.x); float h1 = fract(sin(floor(ang * 2.2) * 91.7) * 4375.85), h2 = fract(sin(floor(ang * 2.2 + 1.0) * 91.7) * 4375.85); float edge = mix(h1, h2, smoothstep(0.0, 1.0, fract(ang * 2.2))); float R = uAR * (0.86 + 0.1 * edge); float a = (1.0 - smoothstep(R * 0.74, R * 1.02, d)) * uAS; vec3 g = floor(vRest * 900.0); float mot = fract(sin(dot(g, vec3(12.9898, 78.233, 37.719))) * 43758.5453); float rad = fract(sin(floor(ang * 26.0) * 12.989) * 4375.85); vec3 cA = uSkinAvg * vec3(0.72, 0.52, 0.46) * (0.95 + 0.07 * mot) * mix(0.9, 1.04, smoothstep(0.18, 0.85, d / uAR)) * (1.0 - 0.05 * rad * (1.0 - smoothstep(0.2, 0.6, d / uAR))); vec3 gc = floor(vRest * 190.0); float hb = fract(sin(dot(gc, vec3(7.13, 157.1, 113.3))) * 43758.5453); float ring = step(0.42, d / uAR) * (1.0 - step(0.86, d / uAR)); vec3 cc = (fract(vRest * 190.0) - 0.5); float bump = ring * step(0.9, hb) * (1.0 - smoothstep(0.12, 0.3, length(cc))); cA *= 1.0 + 0.14 * bump; float nr = uAR * 0.17; float nz = 1.0 - smoothstep(nr * 0.7, nr * 1.1, d); vec3 cN = uSkinAvg * vec3(0.58, 0.36, 0.33) * (1.0 + 0.12 * (1.0 - smoothstep(0.0, nr * 0.5, d))); diffuseColor.rgb = mix(diffuseColor.rgb, mix(cA, cN, nz), max(a, nz * uAS)); }\n  diffuseColor.rgb = mix(diffuseColor.rgb, uHair * (0.8 + 0.4 * fract(sin(dot(floor(vViewPosition.xy * 900.0), vec2(12.9898, 78.233))) * 43758.5453)), clamp(vScalp, 0.0, 1.0));\n  diffuseColor.rgb = mix(diffuseColor.rgb, uSkinAvg * (0.97 + 0.06 * dot(diffuseColor.rgb, vec3(0.333))), clamp(vUni, 0.0, 1.0) * 0.9);\n  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.68, 0.57, 0.53), clamp(vCleft, 0.0, 1.0));')
    .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (1.0 - 0.75 * clamp(vUni, 0.0, 1.0));');
  sh.vertexShader = 'uniform float uFloor; uniform vec2 uHip; uniform float uSquash;\nattribute float aAreo; varying float vAreo; varying vec3 vRest; attribute float aCleft; varying float vCleft; attribute float aUni; varying float vUni; attribute float aScalp; varying float vScalp;\n' + sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
  vCleft = aCleft; vUni = aUni; vScalp = aScalp; vAreo = aAreo; vRest = position;
  {
    vec4 wp = modelMatrix * vec4(transformed, 1.0);
    if (uSquash > 0.5 && wp.y < uFloor + 0.012) {
      float d = uFloor + 0.012 - wp.y;
      wp.y = uFloor + 0.012 * exp(-d / 0.012);
      vec2 dir = wp.xz - uHip; float l = length(dir);
      if (l > 1e-4) wp.xz += dir / l * min(d, 0.08) * 0.45;
      transformed = (inverse(modelMatrix) * wp).xyz;
    }
  }`);
}

// Sillon fessier : profondeur par la couleur (ombre de contact, peau plus chaude au fond du sillon), calculée une fois
// sur la pose de repos — rendu uniquement, la forme ne change pas.

// Cuir chevelu : la peau du crâne là où poussent les cheveux (dessus, côtés, nuque jusqu'à la naissance des cheveux)
// prend la couleur des cheveux : plus de crâne qui paraît chauve quand elle baisse la tête ou de face.
function scalpSetup() {
  try {
    const m = vrm.scene.getObjectByName('Body'); if (!m || m.geometry.attributes.aScalp) return;
    const P = m.geometry.attributes.position, V = new THREE.Vector3(), A = new Float32Array(P.count);
    m.updateWorldMatrix(true, false);
    let cx = 0, cz = 0, n = 0, top = -9, fz = -9;
    for (let i = 0; i < P.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); if (V.y > top) top = V.y; }
    for (let i = 0; i < P.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); if (V.y > top - 0.12) { cx += V.x; cz += V.z; n++; } }
    cx /= n; cz /= n;
    for (let i = 0; i < P.count; i++) { m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); if (V.y > top - 0.16 && V.y < top - 0.05) fz = Math.max(fz, V.z - cz); }
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < P.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld);
      const ry = V.y - top, rz = (V.z - cz) / Math.max(0.05, fz), ax = Math.abs(V.x - cx);
      const f = sm(-0.35, 0.65, rz);                                  // 0 = nuque, 1 = front
      const line = -0.15 + 0.095 * f;                                // naissance des cheveux : basse à la nuque, haute au front
      let a = sm(line - 0.012, line + 0.02, ry) * (0.75 + 0.25 * (1 - f));   // naissance douce, un peu transparente au front
      if (ax > 0.04) a *= sm(-0.045, -0.015, ry);        // côtés : rien sous le haut de l'oreille (joues, tempes basses, mâchoire)
      A[i] = a;
    }
    m.geometry.setAttribute('aScalp', new THREE.BufferAttribute(A, 1));
    try { const hm = vrm.scene.getObjectByName('head_ponytail01'); const img = hm && hm.material.map && hm.material.map.image;
      if (img && img.width) { const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
        const d = g.getImageData(0, 0, 32, 32).data; let r = 0, gg = 0, b = 0, k = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; k++; }
        if (k > 20) HAIR_COL.value.setRGB(r / k / 255 * 0.8, gg / k / 255 * 0.8, b / k / 255 * 0.8, THREE.SRGBColorSpace); } } catch (_) {}
  } catch (e) { console.warn('cuir chevelu', e); }
}
// Aréoles : taille adaptée à sa poitrine (zone de couleur plus large, bord doux et légèrement irrégulier) ; la forme ne change pas.
function areolaSetup() {
  try {
    let m = null; vrm.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body_corps') m = o; });
    if (!m || m.geometry.attributes.aAreo || !bones.hips || !bones.lToes) return;
    const H = bones.hips.getWorldPosition(new THREE.Vector3()), f = bones.lToes.getWorldPosition(new THREE.Vector3()).sub(bones.lFoot.getWorldPosition(new THREE.Vector3()));
    f.y = 0; f.normalize(); const side = new THREE.Vector3(0, 1, 0).cross(f).normalize();
    m.updateWorldMatrix(true, false);
    const P = m.geometry.attributes.position, V = new THREE.Vector3(), best = [[-9, -1], [-9, -1]], W = [];
    for (let i = 0; i < P.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); const r = V.sub(H); W.push([r.dot(side), r.y, r.dot(f)]);
      const lat = r.dot(side); if (r.y < 0.2 || r.y > 0.5 || Math.abs(lat) < 0.04) continue;
      const k = lat > 0 ? 0 : 1, fz = r.dot(f); if (fz > best[k][0]) best[k] = [fz, i];
    }
    if (best[0][1] < 0 || best[1][1] < 0) return;
    const sc = new THREE.Vector3(); m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc); const k = 1 / (Math.abs(sc.x) || 1);
    const R = 0.07 * k;                                     // rayon ~2,7 cm : proportionné à sa poitrine
    const L = (i) => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
    AREO.uNL.value.copy(L(best[0][1])); AREO.uNR.value.copy(L(best[1][1])); AREO.uAR.value = R;

    // Tétons plus gros : élargis et plus saillants, en douceur autour de leur centre ; le sein ne bouge pas.
    { const inv = new THREE.Matrix3().getNormalMatrix(m.matrixWorld).invert(), N = f.clone().applyMatrix3(inv).normalize();
      const rn = 0.014 * k, Q = new THREE.Vector3(), O = new THREE.Vector3(), orig = P.array.slice();
      for (const ti of [best[0][1], best[1][1]]) {
        const t0 = L(ti), c = new THREE.Vector3(); let n = 0;          // centre : moyenne des points du bout du téton
        for (let i = 0; i < P.count; i++) { Q.set(orig[3 * i], orig[3 * i + 1], orig[3 * i + 2]); if (Q.distanceTo(t0) < 0.004 * k) { c.add(Q); n++; } }
        c.divideScalar(n || 1); const base = c.clone().addScaledVector(N, -0.01 * k);
        for (let i = 0; i < P.count; i++) {
          Q.set(orig[3 * i], orig[3 * i + 1], orig[3 * i + 2]); const dd = Q.distanceTo(c); if (dd > rn * 2) continue;
          let w = 1 - dd / (rn * 2); w = w * w * (3 - 2 * w);
          O.copy(Q).sub(base); const ax = O.dot(N); O.addScaledVector(N, -ax);
          Q.addScaledVector(O, window.__NL ?? 0.6).addScaledVector(N, (window.__NP ?? 0.006) * k * w);
          P.setXYZ(i, Q.x, Q.y, Q.z);
        }
      }
      P.needsUpdate = true; }   // normales d'origine gardées (les recalculer casse les coutures du modèle)
    const A = new Float32Array(P.count), a = L(best[0][1]), b = L(best[1][1]), T = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { T.set(P.getX(i), P.getY(i), P.getZ(i)); if (Math.min(T.distanceTo(a), T.distanceTo(b)) < R * 2) A[i] = 1; }
    m.geometry.setAttribute('aAreo', new THREE.BufferAttribute(A, 1));
    window.__AREO = AREO; window.__areo = { R, n: A.reduce((x, y) => x + y, 0) };
  } catch (e) { console.warn('aréoles', e); }
}
// Outil commun de sculpture : après avoir déplacé des points, recalcule l'éclairage (normales) de la zone SANS casser les coutures.
// Les points dédoublés aux coutures de texture sont regroupés par position ; w[i] (0..1) = force du recalcul par point.
function resculptNormals(m, w) {
  const g = m.geometry, P = g.attributes.position, NA = g.attributes.normal, I = g.index, key = new Int32Array(P.count), map = new Map();
  for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let id = map.get(k); if (id === undefined) { id = map.size; map.set(k, id); } key[i] = id; }
  const acc = new Float32Array(map.size * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const tri = I ? I.count / 3 : P.count / 3, ix = (t) => (I ? I.getX(t) : t);
  for (let t = 0; t < tri; t++) {
    const i0 = ix(3 * t), i1 = ix(3 * t + 1), i2 = ix(3 * t + 2); if (!(w[i0] > 0 || w[i1] > 0 || w[i2] > 0)) continue;
    a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2); n.copy(b).sub(a).cross(c.sub(a));   // pondéré par l'aire
    for (const i of [i0, i1, i2]) { const k = key[i] * 3; acc[k] += n.x; acc[k + 1] += n.y; acc[k + 2] += n.z; }
  }
  for (let i = 0; i < P.count; i++) { if (!(w[i] > 0)) continue; const k = key[i] * 3; n.set(acc[k], acc[k + 1], acc[k + 2]); if (n.lengthSq() < 1e-20) continue;
    a.fromBufferAttribute(NA, i).lerp(n.normalize(), Math.min(1, w[i])).normalize(); NA.setXYZ(i, a.x, a.y, a.z); }
  NA.needsUpdate = true;
}
// Lissage de sculpture (comme « Smooth » dans Blender) : chaque point de la zone glisse vers la moyenne de ses voisins,
// ce qui efface marches, plis durs et bosses. w[i] (0..1) = force par point ; les points dédoublés aux coutures restent soudés.
function resculptSmooth(m, w, iters, k) {
  const g = m.geometry, P = g.attributes.position, I = g.index, key = new Int32Array(P.count), map = new Map();
  for (let i = 0; i < P.count; i++) { const q = Math.round(P.getX(i) * 2e4) + ',' + Math.round(P.getY(i) * 2e4) + ',' + Math.round(P.getZ(i) * 2e4); let id = map.get(q); if (id === undefined) { id = map.size; map.set(q, id); } key[i] = id; }
  const n = map.size, X = new Float32Array(n * 3), W = new Float32Array(n), nb = new Map();
  for (let i = 0; i < P.count; i++) { const q = key[i] * 3; X[q] = P.getX(i); X[q + 1] = P.getY(i); X[q + 2] = P.getZ(i); if (w[i] > W[key[i]]) W[key[i]] = w[i]; }
  const tri = I ? I.count / 3 : P.count / 3, ix = (t) => key[I ? I.getX(t) : t];
  const link = (a, b) => { if (a === b || !(W[a] > 0)) return; let s = nb.get(a); if (!s) nb.set(a, s = new Set()); s.add(b); };
  for (let t = 0; t < tri; t++) { const a = ix(3 * t), b = ix(3 * t + 1), c = ix(3 * t + 2); link(a, b); link(a, c); link(b, a); link(b, c); link(c, a); link(c, b); }
  const Y = new Float32Array(X.length);
  for (let it = 0; it < iters; it++) {
    Y.set(X);
    for (const [a, s] of nb) { let x = 0, y = 0, z = 0; for (const b of s) { x += X[3 * b]; y += X[3 * b + 1]; z += X[3 * b + 2]; } const c = s.size, f = W[a] * k;
      Y[3 * a] += (x / c - X[3 * a]) * f; Y[3 * a + 1] += (y / c - X[3 * a + 1]) * f; Y[3 * a + 2] += (z / c - X[3 * a + 2]) * f; }
    X.set(Y);
  }
  for (let i = 0; i < P.count; i++) if (w[i] > 0) { const q = key[i] * 3; P.setXYZ(i, X[q], X[q + 1], X[q + 2]); }
  P.needsUpdate = true;
}
// Pubis : la bosse trop saillante (avec un creux brutal dessous) devient une courbe douce et continue depuis le bas-ventre.
// On recule seulement la peau, en fondu sur les côtés ; rien d'autre ne change.
function monsSetup() {
  try {
    let m = null; vrm.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body_corps') m = o; });
    if (!m || m.userData.monsDone || !bones.hips || !bones.lToes) return; m.userData.monsDone = 1;
    const H = bones.hips.getWorldPosition(new THREE.Vector3()), f = bones.lToes.getWorldPosition(new THREE.Vector3()).sub(bones.lFoot.getWorldPosition(new THREE.Vector3()));
    f.y = 0; f.normalize(); const side = new THREE.Vector3(0, 1, 0).cross(f).normalize();
    const T = [[-0.03, 0], [-0.05, 0.003], [-0.065, 0.008], [-0.075, 0.012], [-0.085, 0.015], [-0.095, 0.013], [-0.105, 0.012], [-0.115, 0.009], [-0.121, 0.004], [-0.128, 0]];
    const G = window.__mons ?? 1.5;
    const dl = (y) => { for (let k = 0; k < T.length - 1; k++) { const [y0, d0] = T[k], [y1, d1] = T[k + 1]; if (y <= y0 && y >= y1) return d0 + (d1 - d0) * (y0 - y) / (y0 - y1); } return 0; };
    const T2 = [[-0.118, 0], [-0.126, 0.02], [-0.133, 0.03], [-0.142, 0.022], [-0.152, 0.01], [-0.162, 0]];
    const dl2 = (y) => { for (let k = 0; k < T2.length - 1; k++) { const [y0, d0] = T2[k], [y1, d1] = T2[k + 1]; if (y <= y0 && y >= y1) return d0 + (d1 - d0) * (y0 - y) / (y0 - y1); } return 0; };
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    m.updateWorldMatrix(true, false);
    const P = m.geometry.attributes.position, V = new THREE.Vector3(), sc = new THREE.Vector3();
    m.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc); const k = 1 / (Math.abs(sc.x) || 1);
    const N = f.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(m.matrixWorld).invert()).normalize();
    const NA = m.geometry.attributes.normal, nv = new THREE.Vector3();
    const WR = new Float32Array(P.count), REAL = window.__monsReal ?? 0;
    const tn = new THREE.Vector3(), DN = new THREE.Vector3(0, -1, 0).applyMatrix3(new THREE.Matrix3().getNormalMatrix(m.matrixWorld).invert()).normalize();
    for (let i = 0; i < P.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld); V.sub(H);
      const lat = Math.abs(V.dot(side)); if (V.dot(f) < 0.03 || lat > 0.11) continue;
      // éclairage : sous la bosse, les normales pointaient vers le bas (croissant d'ombre dur) ; on les redresse vers l'avant, en fondu
      const wn = (1 - sm(0.05, 0.11, lat)) * sm(-0.17, -0.13, V.y) * (1 - sm(-0.06, -0.02, V.y)) * (window.__monsN ?? 0.75);
      WR[i] = (1 - sm(0.06, 0.12, lat)) * sm(-0.19, -0.15, V.y) * (1 - sm(-0.05, -0.01, V.y));
      if (wn > 0 && REAL < 1 && !(window.__monsS > 0)) { tn.copy(N).addScaledVector(DN, 0.9 * (1 - sm(-0.135, -0.105, V.y))).normalize();   // en bas : ombre douce gardée (pas de tache claire)
        nv.set(NA.getX(i), NA.getY(i), NA.getZ(i)).lerp(tn, wn).normalize(); NA.setXYZ(i, nv.x, nv.y, nv.z); }
      // dessous : le creux brutal sous le mont est comblé (la peau avance), en pointe douce entre les cuisses
      const up = dl2(V.y) * (1 - sm(0.012, 0.045, lat)) * (window.__monsF ?? 0);
      const d = dl(V.y) * (1 - sm(0.045, 0.1, lat)) * G - up; if (d === 0) continue;
      P.setXYZ(i, P.getX(i) - N.x * d * k, P.getY(i) - N.y * d * k, P.getZ(i) - N.z * d * k);
    }
    P.needsUpdate = true; NA.needsUpdate = true;
    const IT = window.__monsS ?? 0; if (IT > 0) { resculptSmooth(m, WR, IT, 0.5); resculptNormals(m, WR); }
    else if (REAL > 0) { for (let i = 0; i < WR.length; i++) WR[i] *= REAL; resculptNormals(m, WR); }
  } catch (e) { console.warn('pubis', e); }
}
function cleftSetup() {
  try {
    let m = null; vrm.scene.traverse((o) => { if (o.isSkinnedMesh && o.name === 'Body_corps') m = o; });
    if (!m || m.geometry.attributes.aCleft || !bones.hips || !bones.lToes) return;
    const H = bones.hips.getWorldPosition(new THREE.Vector3()), f = bones.lToes.getWorldPosition(new THREE.Vector3()).sub(bones.lFoot.getWorldPosition(new THREE.Vector3()));
    f.y = 0; f.normalize(); const side = new THREE.Vector3(0, 1, 0).cross(f).normalize();
    const P = m.geometry.attributes.position, A = new Float32Array(P.count), V = new THREE.Vector3();
    m.updateWorldMatrix(true, false);
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < P.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld).sub(H);
      const lat = Math.abs(V.dot(side)), back = -V.dot(f), y = V.y;
      A[i] = (0.55 * (1 - sm(0.01, 0.05, lat)) + 0.45 * (1 - sm(0.004, 0.018, lat))) * sm(-0.03, 0.03, back) * sm(-0.27, -0.17, y) * (1 - sm(0.03, 0.1, y));
    }
    m.geometry.setAttribute('aCleft', new THREE.BufferAttribute(A, 1));
    // Bassin, fesses, entrejambe : la texture d'origine se raccorde mal sur la ligne du milieu (coupure d'éclairage, rouge) ;
    // la peau y prend une couleur continue, fondue sur les bords de la zone.
    const U = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) {
      m.getVertexPosition(i, V); V.applyMatrix4(m.matrixWorld).sub(H);
      const lat = Math.abs(V.dot(side)), y = V.y;
      U[i] = (1 - sm(0.13, 0.2, lat)) * sm(-0.36, -0.26, y) * (1 - sm(0.06, 0.16, y));
    }
    m.geometry.setAttribute('aUni', new THREE.BufferAttribute(U, 1));
    try {   // moyenne de la peau sur sa texture (zone sûre : pixels clairs uniquement)
      const img = m.material.map && m.material.map.image;
      if (img && img.width) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
        const d = g.getImageData(0, 0, 64, 64).data; let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > 300 && d[i] - d[i + 2] < 90) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
        if (n > 50) SKIN_AVG.value.setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace).multiply(new THREE.Color(SKIN_TONE));
      }
    } catch (_) {}
  } catch (e) { console.warn('sillon', e); }
}
function skinUpgrade() {
  if (!vrm || !vrm.isGlb || window.__noskin || SKIN_WRAP === THREE.ShaderChunk.lights_physical_pars_fragment) return;
  if (!poreTex) poreTex = makePores();
  const made = new Map();                   // le visage et le corps partagent la même peau
  vrm.scene.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || o.material.name !== 'Peau' || o.material.userData.skin) return;
    const old = o.material;
    if (made.has(old)) { o.material = made.get(old); return; }
    const m = new THREE.MeshPhysicalMaterial({
      name: 'Peau', map: old.map, color: old.color.clone().multiply(new THREE.Color(SKIN_TONE)), roughness: window.__rough ?? 0.56, metalness: 0,
      normalMap: poreTex, normalScale: new THREE.Vector2(0.18, 0.18),
      sheen: window.__sheen ?? 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc2a8), specularIntensity: window.__spec ?? 0.55,
      clearcoat: window.__cc ?? 0.04, clearcoatRoughness: 0.55,                 // peau mate et satinée, pas plastique
      envMapIntensity: 0.75, side: old.side,
    });
    m.userData.skin = true;
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', SKIN_WRAP); squashPatch(sh); };
    m.customProgramCacheKey = () => 'aiko-skin-sq';
    made.set(old, m); o.material = m;
  });
}
// Couleur de la tenue : on reteint le tissu sombre de la texture, la chemise claire et la peau ne bougent pas.
let tintV = store.get('aiko.tint', '#16161a');
const tintSrc = new WeakMap();
function applyTint() {
  const row = $('#row-tint');
  const meshes = [];
  if (vrm && vrm.isGlb) vrm.scene.traverse((o) => { if (o.isMesh && /look|outfit|cloth/i.test(o.name) && o.material && o.material.map) meshes.push(o); });
  row.hidden = !meshes.length;
  $('#row-outfit').hidden = !!meshes.length;
  row.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.tint === tintV));
  for (const o of meshes) {
    const mat = o.material;
    let src = tintSrc.get(mat);
    if (!src) { src = { map: mat.map }; tintSrc.set(mat, src); }
    if (!tintV) { if (mat.map !== src.map) { mat.map.dispose(); mat.map = src.map; mat.needsUpdate = true; } continue; }
    try {
      const img = src.map.image, w = img.width, h = img.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, w, h);
      const id = cx.getImageData(0, 0, w, h), d = id.data;
      const c = new THREE.Color(tintV).convertLinearToSRGB();
      const tr = c.r * 255, tg = c.g * 255, tb = c.b * 255, tl = Math.max(40, 0.3 * tr + 0.59 * tg + 0.11 * tb);
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.3 * r + 0.59 * g + 0.11 * b;
        if (mx - mn > 38 || l > 150) continue;                  // peau, chemise blanche, boutons clairs : intacts
        const k = Math.min(1, (150 - l) / 30);                  // fondu doux vers les zones claires
        const f = (l / 62) * (62 / tl);                         // garde les plis et les ombres du tissu
        d[i] = r + (Math.min(255, tr * f) - r) * k; d[i + 1] = g + (Math.min(255, tg * f) - g) * k; d[i + 2] = b + (Math.min(255, tb * f) - b) * k;
      }
      cx.putImageData(id, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.flipY = src.map.flipY; tex.colorSpace = src.map.colorSpace; tex.wrapS = src.map.wrapS; tex.wrapT = src.map.wrapT;
      tex.anisotropy = src.map.anisotropy; tex.channel = src.map.channel;
      if (mat.map !== src.map) mat.map.dispose();
      mat.map = tex; mat.needsUpdate = true;
    } catch (e) { console.warn('[Aiko] teinte', e); }
  }
}
document.querySelectorAll('#row-tint .chip').forEach((b) => b.addEventListener('click', () => {
  tintV = b.dataset.tint; store.set('aiko.tint', tintV); applyTint();
}));

let vrm = null;
let bones = {};
const groups = { top: [], bottom: [], full: [], shoes: [], hair: [], glasses: [] };
const OUTFIT_SHOW = {
  nue:      { top: 0, bottom: 0, full: 0, shoes: 0 },
  moitie:   { top: 0, bottom: 1, full: 0, shoes: 1 },
  habillee: { top: 1, bottom: 1, full: 1, shoes: 1 },
};
const OUTFIT_LABEL = { nue: 'Tenue : nue', moitie: 'Tenue : moitié', habillee: 'Tenue : habillée' };
let hairOn = true, glassesOn = false;
let currentOutfit = store.get('aiko.outfit', 'habillee');
if (!OUTFIT_SHOW[currentOutfit]) currentOutfit = 'habillee';
let greeted = false;

// Poses : turn = rotation du corps, sit = assise (0..1), lie = allongée (0..1)
const POSES = {
  front: { label: 'Debout',   turn: 0,    sit: 0, lie: 0 },
  sit:   { label: 'Assise',   turn: 0,    sit: 1, lie: 0 },
  side:  { label: 'De côté',  turn: 0.85, sit: 0, lie: 0 },
  bed:   { label: 'Allongée', turn: 0,    sit: 0, lie: 1 },
};
let currentPose = store.get('aiko.pose', 'front');
if (!POSES[currentPose]) currentPose = 'front';
const poseCur = { turn: 0, sit: 0, lie: 0 };
// Mesures du modèle chargé (pour asseoir/coucher n'importe quel VRM à la bonne hauteur)
const body = { upper: 0.4, lower: 0.4, foot: 0.08, height: 1.5, hipsY: 0, legDir: -1 };

// Classe un mesh d'après son nom + le nom de ses matériaux (convention VRoid : Tops_01_CLOTH, etc.)
function categorize(o) {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const matNames = mats.map((m) => (m && m.name) || '').join(' ').toLowerCase();
  const s = (o.name || '').toLowerCase() + ' ' + matNames;
  if (/glass|megane/.test(s)) return 'glasses';
  if (/hair/.test(s)) return 'hair';
  if (/skin/.test(matNames)) return 'other';               // la peau n'est jamais masquée
  if (/shoe|boot|sock|sneaker|sandal|heel|loafer/.test(s)) return 'shoes';
  if (/onepiece|one_piece|dress|robe|gown|kimono|jumpsuit/.test(s)) return 'full';   // pièce unique haut+bas
  if (/bottom|pants|trouser|skirt|shorts|panties|underwear|leggings|tights|briefs/.test(s)) return 'bottom';
  if (/top|shirt|blouse|jacket|blazer|coat|suit|sweater|hoodie|vest|cardigan|uniform|brassiere|bra\b/.test(s)) return 'top';
  return 'other';
}

function disposeCurrent() {
  if (!vrm) return;
  rig.remove(vrm.scene);
  VRMUtils.deepDispose(vrm.scene);
  vrm = null;
  bones = {};
}

function onLoaded(gltf, label, isDemo) {
  let next = gltf.userData && gltf.userData.vrm;
  if (!next) { try { next = makeGlbAvatar(gltf); } catch (e) { console.error(e); next = null; } }
  if (!next) { loaderFail('Ce fichier n\'est ni un VRM ni un avatar GLB compatible (squelette Mixamo / Avaturn).'); return; }
  disposeCurrent();
  for (const k in groups) groups[k] = [];

  // Optimisations three-vrm : sommets inutilisés supprimés, squelettes fusionnés.
  // Protégées : un échec ici ne doit pas empêcher l'affichage.
  if (!next.isGlb) {
    try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) { console.warn('[Aiko] removeUnnecessaryVertices', e); }
    try { if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(gltf.scene); } catch (e) { console.warn('[Aiko] combineSkeletons', e); }
  }

  vrm = next;
  if (!vrm.isGlb) VRMUtils.rotateVRM0(vrm);
  setRealistic(!!vrm.isGlb);
  vrm.scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      const c = /^wear_/.test(o.name) ? 'other' : categorize(o);
      if (c !== 'other') groups[c].push(o);
    }
  });
  if (vrm.lookAt) vrm.lookAt.target = lookAtTarget;
  rig.position.set(0, 0, 0);
  rig.rotation.set(0, 0, 0);
  rig.add(vrm.scene);

  // Os mis en cache une fois (plus de recherche à chaque image)
  const bn = (n) => { try { return vrm.humanoid ? vrm.humanoid.getNormalizedBoneNode(n) : null; } catch (_) { return null; } };
  bones = {
    hips: bn('hips'), spine: bn('spine'), chest: bn('chest'), neck: bn('neck'), head: bn('head'), lSh: bn('leftShoulder'), rSh: bn('rightShoulder'),
    lArm: bn('leftUpperArm'), rArm: bn('rightUpperArm'), lLowArm: bn('leftLowerArm'), rLowArm: bn('rightLowerArm'), lHand: bn('leftHand'), rHand: bn('rightHand'),
    lFoot: bn('leftFoot'), rFoot: bn('rightFoot'), lToes: bn('leftToes'), rToes: bn('rightToes'),
    lUpLeg: bn('leftUpperLeg'), rUpLeg: bn('rightUpperLeg'), lLowLeg: bn('leftLowerLeg'), rLowLeg: bn('rightLowerLeg'),
  };
  // Doigts : légèrement repliés, comme une main détendue (sinon main raide de mannequin)
  bones.fingers = [];
  for (const [side, sg] of [['left', -1], ['right', 1]]) {
    ['Index', 'Middle', 'Ring', 'Little'].forEach((f, i) => {
      [['Proximal', 0.16], ['Intermediate', 0.3], ['Distal', 0.14]].forEach(([seg, a]) => { const n = bn(side + f + seg); if (n) bones.fingers.push([n, sg * a * (1 + i * 0.22)]); });   // main au repos : doigts souples, légèrement plus pliés vers l'auriculaire
    });
  }
  jigSetup(vrm.scene);
  try { skinSetup(vrm.scene); } catch (e) { console.warn('contact', e); }
  // Doigts individuels (pour les formes de main : index pointé, pouce levé, V, poing…)
  bones.hand = { r: {}, l: {} };
  for (const [side, k] of [['right', 'r'], ['left', 'l']]) {
    for (const f of ['Index', 'Middle', 'Ring', 'Little']) bones.hand[k][f] = ['Proximal', 'Intermediate', 'Distal'].map((sg) => bn(side + f + sg)).filter(Boolean);
    bones.hand[k].Thumb = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'].map((sg) => bn(side + sg)).filter(Boolean);
  }
  // Mesures prises debout, avant toute pose
  rig.updateMatrixWorld(true);
  try { buildBodyMap(bones); } catch (e) { bodyMap = null; }
  const wp = (n) => { const b = bn(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null; };
  const pU = wp('leftUpperLeg'), pL = wp('leftLowerLeg'), pF = wp('leftFoot'), pH = wp('head');
  if (pU && pL && pF) { body.upper = pU.distanceTo(pL); body.lower = pL.distanceTo(pF); body.foot = Math.max(0.02, pF.y); }
  if (pH) body.height = pH.y + 0.16;
  body.hipsY = bones.hips ? bones.hips.position.y : 0;
  body.anchL = wp('leftFoot'); body.anchR = wp('rightFoot');   // position des pieds au sol, au repos : cibles pour l'IK jambes (postures porteuses)
  body.legDir = (vrm.meta && vrm.meta.metaVersion === '0') ? 1 : -1;   // VRM 0.x regarde dans l'autre sens
  const seat = body.lower + body.foot - 0.07;
  stool.scale.set(1, seat, 1);
  stool.position.set(0, seat / 2, -0.04);
  bedMesh.scale.set(body.height + 0.5, BED_H, 0.95);
  bedMesh.position.set(0, BED_H / 2, 0);
  poseCur.turn = POSES[currentPose].turn; poseCur.sit = POSES[currentPose].sit; poseCur.lie = POSES[currentPose].lie;
  body.k = clamp(body.height / 1.45, 0.8, 1.6);          // cadrage proportionnel à la taille du modèle
  body.cam = vrm.isGlb ? 2.55 : 2.4;                       // avatar réaliste : cadrage plus proche, comme une conversation
  CAM.dist = currentPose === 'bed' ? bedDist() : 3.9 * body.k; CAM.py = currentPose === 'bed' ? 0 : -0.38 * body.k; CAM.frame = 0;   // corps entier au démarrage

  applyShape();
  setRealistic(!!vrm.isGlb);
  applyTint();
  if (wrSetup(vrm.scene)) $('#row-tint').hidden = true;
  try { correctivesSetup(); } catch (_) {}
  try { romSetup(vrm.scene); } catch (_) {}
  monsSetup(); areolaSetup(); cleftSetup(); scalpSetup();
  glassesOn = false;
  demoLock = !!isDemo;
  document.querySelectorAll('#row-outfit .chip').forEach((b) => b.classList.toggle('off', demoLock && b.dataset.outfit !== 'habillee'));
  if (demoLock) {      // tout réafficher, sans toucher à la tenue mémorisée pour ton vrai modèle
    ['top', 'bottom', 'full', 'shoes'].forEach((k) => groups[k].forEach((m) => { m.visible = true; }));
    document.querySelectorAll('#row-outfit .chip').forEach((b) => b.classList.toggle('on', b.dataset.outfit === 'habillee'));
  } else applyOutfit(currentOutfit, true);
  applyHair();
  applyGlasses();
  $('#btn-lunettes').classList.toggle('off', !groups.glasses.length);
  $('#btn-cheveux').classList.toggle('off', !groups.hair.length);
  $('#credit').textContent = isDemo ? 'Avatar construit avec MakeHuman/MPFB (CC0) · « ＋ VRM perso » pour charger le tien (.vrm ou .glb)' : '';
  loaderEl.classList.add('hidden');
  setStatus();
  if (!greeted) {
    greeted = true;
    if (!cap.sample) addLog('ai', 'Je suis là.');
  }
  if (modelLoaded) modelLoaded();
  const noClothes = !(groups.top.length + groups.bottom.length + groups.full.length);
  if (noClothes) showToast('Aucun vêtement séparé détecté : les tenues seront sans effet');
  else showToast(label || 'Glisse pour tourner · pince ou molette pour zoomer');
  console.log('[Aiko] modèle chargé', Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])));
}

function loaderFail(msg) {
  loaderMsg.textContent = msg;
  loaderRetry.hidden = false;
}

function loadURL(url, isDemo, onFail) {
  gltfLoader.load(
    url,
    (g) => onLoaded(g, null, isDemo),
    (ev) => { if (ev.total) loaderMsg.textContent = 'Chargement du modèle 3D… ' + Math.round((ev.loaded / ev.total) * 100) + '%'; },
    (err) => { console.error(err); onFail(); }
  );
}

function loadDefault() {
  loaderEl.classList.remove('hidden');
  loaderRetry.hidden = true;
  loaderMsg.textContent = 'Chargement du modèle 3D…';
  // Page hébergée : le gabarit est livré à côté de la page, encodé dans model.json.
  const demo = async () => {
    try {
      const res = await fetch(new URLSearchParams(location.search).get('model') === 'preview' ? './model.preview.json' : './model.json');   // ?model=preview : aperçu d'un corps reconstruit sur son serveur
      if (!res.ok) throw new Error('HTTP ' + res.status);
      loaderMsg.textContent = 'Préparation du modèle 3D…';
      const bin = atob((await res.json()).b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      gltfLoader.parse(bytes.buffer, '', (g) => onLoaded(g, null, true),
        (err) => { console.error(err); loaderFail('Impossible de lire le modèle.'); });
    } catch (e) { console.error(e); loaderFail('Échec du chargement du modèle. Réessaie.'); }
  };
  if (LOCAL_VRM_URL) loadURL(LOCAL_VRM_URL, false, demo);
  else demo();
}

function loadVRMFile(f) {
  loaderEl.classList.remove('hidden');
  loaderRetry.hidden = true;
  loaderMsg.textContent = 'Lecture de « ' + f.name + ' »…';
  f.arrayBuffer()
    .then((buf) => gltfLoader.parse(buf, '', (g) => onLoaded(g, 'Modèle chargé : ' + f.name, false),
      (err) => { console.error(err); loaderFail('Impossible de lire ce fichier VRM.'); }))
    .catch(() => loaderFail('Impossible de lire ce fichier.'));
}

loaderRetry.addEventListener('click', loadDefault);
$('#file-vrm').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (f) loadVRMFile(f);
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && /\.(vrm|glb)$/i.test(f.name)) loadVRMFile(f);
});
