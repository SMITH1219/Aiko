/* ══ AUTO-AMÉLIORATION SANS AUTONOMIE : elle PROPOSE, tu VALIDES (toujours annulable) ══
   Ce qu'elle peut proposer :
   - un nouveau GESTE (même format que ses mouvements appris en images, chaque angle borné à l'amplitude humaine) : tu le vois avant d'accepter ;
   - une nouvelle EXPRESSION du visage (mélange de ses formes ARKit) : tu la vois avant d'accepter ;
   - ses OUTILS DE CODE (déjà : « garder », dans le bac à essai) ;
   - les MISES À JOUR de ses briques open source (veille quotidienne, pour ne jamais devenir obsolète) : chaque nouvelle version est d'abord
     ESSAYÉE dans une bulle à part ; elle ne te la propose que si l'essai réussit ; elle ne s'en sert qu'après ton accord.
   Rien ne s'applique tout seul. */
const AMEL_VER0 = { pyodide: '314.0.8', acorn: '8.19.0', 'js-beautify': '2.0.3', wabt: '1.0.39' };
function amelVers() { let v = {}; try { v = JSON.parse(localStorage.getItem('aiko.versions')) || {}; } catch (_) {} return Object.assign({}, AMEL_VER0, v); }
function amelSetVer(cle, v) { let o = {}; try { o = JSON.parse(localStorage.getItem('aiko.versions')) || {}; } catch (_) {} if (!v || v === AMEL_VER0[cle]) delete o[cle]; else o[cle] = v; try { localStorage.setItem('aiko.versions', JSON.stringify(o)); } catch (_) {} for (const k of Object.keys(BAC.f)) if (k.startsWith(cle === 'pyodide' ? 'py' : 're')) bacKill(k); }
const amelProps = () => (life.props = Array.isArray(life.props) ? life.props : []);
const amelSlug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
Object.assign(TOOLS.schemas, { 'Code|proposer': 'type*, titre*, contenu*, raison' });
BASE_TOPICS.push('nouveautés avatars 3D temps réel navigateur three.js', 'nouveautés synchronisation labiale open source', 'nouveautés Pyodide WebAssembly Python navigateur');   // sa veille de connaissances sur ses propres techniques

function amelPreview(p) {                // « Voir » : tu la vois faire AVANT de décider (le temps de l'essai, puis tout revient comme avant)
  if (p.type === 'geste') { GLIB.__essai = p.def; playGesture('__essai'); setTimeout(() => { if (GLIB.__essai === p.def) delete GLIB.__essai; }, (p.def.dur + 1) * 1000); }
  else if (p.type === 'expression') { if (!vrm || !vrm.addShapes) return; GLB_EXPR.__essai = p.formes; vrm.addShapes(Object.keys(p.formes)); setExpr('__essai', 1); setTimeout(() => { setExpr('__essai', 0); delete GLB_EXPR.__essai; }, 2600); }
}
function amelApply(p) {
  if (p.type === 'version') { p.avant = amelVers()[p.cle]; amelSetVer(p.cle, p.vers); }
  else if (p.type === 'expression') { GLB_EXPR[p.nom] = p.formes; if (vrm && vrm.addShapes) vrm.addShapes(Object.keys(p.formes)); if (!PRESETS.includes(p.nom)) PRESETS.push(p.nom); life.exprs = Object.assign(life.exprs || {}, { [p.nom]: { formes: p.formes, desc: p.detail || '' } }); }
  else if (p.type === 'geste') { GLIB[p.nom] = p.def; life.moves = (life.moves || []).filter((m) => m.name !== p.nom); life.moves.push({ name: p.nom, desc: (p.detail || p.titre).slice(0, 200), def: p.def, at: Date.now() }); life.moves = life.moves.slice(-60); }
  else return;
  p.etat = 'appliquée'; p.quand = Date.now(); saveLife();
}
function amelUndo(p) {
  if (p.type === 'version') amelSetVer(p.cle, p.avant || p.de);
  else if (p.type === 'expression') { delete GLB_EXPR[p.nom]; const i = PRESETS.indexOf(p.nom); if (i >= 0) PRESETS.splice(i, 1); if (life.exprs) delete life.exprs[p.nom]; }
  else if (p.type === 'geste') { delete GLIB[p.nom]; life.moves = (life.moves || []).filter((m) => m.name !== p.nom); }
  p.etat = 'annulée'; saveLife();
}
function amelButtons(p, box, after) {   // les boutons selon l'état : Voir · Appliquer · Refuser  /  Annuler
  box.textContent = '';
  const btn = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = () => { f(); amelButtons(p, box, after); if (after) after(); }; box.appendChild(b); };
  if (p.type === 'info') { if (p.etat === 'proposée') btn('Compris', () => { p.etat = 'vue'; saveLife(); }); return; }
  if (p.type === 'geste' || p.type === 'expression') { const v = document.createElement('button'); v.type = 'button'; v.textContent = 'Voir'; v.onclick = () => amelPreview(p); box.appendChild(v); }
  if (p.etat === 'proposée' || p.etat === 'annulée' || p.etat === 'refusée') { btn(p.etat === 'proposée' ? 'Appliquer' : 'Appliquer quand même', () => amelApply(p)); if (p.etat === 'proposée') btn('Refuser', () => { p.etat = 'refusée'; saveLife(); }); }
  else if (p.etat === 'appliquée') btn('Annuler', () => amelUndo(p));
}
function amelCard(p) {
  const el = addLog('ask', '💡 Aiko propose : ' + p.titre + (p.detail ? ' — ' + p.detail : '') + (p.testTxt ? ' · essai : ' + p.testTxt : '') + ' ');
  const box = document.createElement('span'); el.appendChild(box); amelButtons(p, box);
}
function amelAdd(p) {
  p.id = Date.now() + Math.floor(Math.random() * 1000); p.at = Date.now(); p.etat = 'proposée';
  const L = amelProps(); L.push(p); life.props = L.slice(-40); saveLife();
  try { amelCard(p); } catch (_) {}
  return p;
}
function amelPanel(body) {              // dans « Ce qu'elle sait de moi » : toutes ses propositions, à appliquer ou annuler quand tu veux
  const h = document.createElement('h4'); h.textContent = 'Ses propositions d\'amélioration (elle propose, tu valides)'; body.appendChild(h);
  const L = amelProps().slice().reverse();
  if (!L.length) { const e = document.createElement('div'); e.className = 'mind-empty'; e.textContent = 'Aucune pour l\'instant : elle te proposera ses idées (gestes, expressions) et les mises à jour de ses outils, toujours testées d\'abord.'; body.appendChild(e); return; }
  for (const p of L) {
    const row = document.createElement('div'); row.className = 'mi' + (p.etat === 'appliquée' || p.etat === 'vue' ? ' done' : '');
    const s = document.createElement('span'); s.textContent = p.titre + ' — ' + p.etat + (p.testTxt ? ' (essai : ' + p.testTxt + ')' : ''); row.appendChild(s);
    const box = document.createElement('span'); row.appendChild(box); amelButtons(p, box, () => { s.textContent = p.titre + ' — ' + p.etat + (p.testTxt ? ' (essai : ' + p.testTxt + ')' : ''); });
    body.appendChild(row);
  }
}
async function amelPropose(I) {          // Code | proposer : son idée, testée puis présentée ; jamais appliquée sans toi
  const type = String(I.type || '').trim().toLowerCase(), titre = String(I.titre || '').slice(0, 120), raison = String(I.raison || '').slice(0, 300);
  let j = null; try { j = JSON.parse(String(I.contenu || '')); } catch (_) {}
  if (type === 'geste') {
    if (!j || !Array.isArray(j.etapes)) return 'Contenu illisible : un geste se décrit en JSON, exactement comme tes mouvements appris. Format :\n' + LEARN_SPEC;
    const def = moveFromJson(j); if (!def) return 'Aucune étape lisible dans ce geste : corrige le JSON.';
    let nom = amelSlug(j.nom || titre) || 'geste'; if (GLIB[nom] && !(life.moves || []).some((m) => m.name === nom)) nom += '-2';   // jamais à la place d'un geste qui existe déjà
    const n = def.fk.length - 3;
    amelAdd({ type, nom, titre: titre || 'nouveau geste « ' + nom + ' »', detail: String(j.description || raison).slice(0, 200), def, testTxt: n + ' étape' + (n > 1 ? 's' : '') + ', ' + def.dur.toFixed(1) + ' s, angles bornés à l\'amplitude humaine' });
    return 'Proposition de geste « ' + nom + ' » envoyée : elle peut la voir, l\'appliquer ou la refuser. Elle n\'est PAS appliquée tant qu\'elle n\'a pas validé.';
  }
  if (type === 'expression') {
    if (!vrm || !vrm.hasShape) return 'Les expressions créées ne marchent que sur ton corps réaliste (pas sur un modèle VRM simple).';
    const F = j && typeof j === 'object' ? (j.formes || j) : null; if (!F || typeof F !== 'object') return 'Contenu illisible : {"nom":"…","formes":{"mouthSmileLeft":0.6,…},"description":"…"}.';
    const formes = {}, inconnues = [];
    for (const [k, v] of Object.entries(F)) { if (k === 'nom' || k === 'description') continue; if (!vrm.hasShape(k)) { inconnues.push(k); continue; } const x = Number(v); if (isFinite(x)) formes[k] = Math.max(0, Math.min(1, x)); }
    if (inconnues.length) return 'Formes inconnues sur ton visage : ' + inconnues.join(', ') + '. Tes formes : ' + vrm.shapeNames().filter((n) => !/^viseme_/.test(n)).join(', ') + '.';
    if (!Object.keys(formes).length || Object.keys(formes).length > 24) return 'Une expression mélange de 1 à 24 formes.';
    const nom = amelSlug(j.nom || titre); if (!nom) return 'Donne-lui un nom court.';
    if (GLB_EXPR[nom] && !(life.exprs && life.exprs[nom])) return 'Le nom « ' + nom + ' » existe déjà parmi tes expressions : choisis-en un autre.';
    amelAdd({ type, nom, titre: titre || 'nouvelle expression « ' + nom + ' »', detail: String(j.description || raison).slice(0, 200), formes, testTxt: Object.keys(formes).length + ' formes de son visage vérifiées' });
    return 'Proposition d\'expression « ' + nom + ' » envoyée : elle peut la voir, l\'appliquer ou la refuser. Une fois validée, tu la joueras avec [expr:' + nom + '].';
  }
  return 'Type inconnu : « geste » ou « expression ». (Tes outils de code se gardent avec "garder" dans Code | executer ; les mises à jour de tes outils, ta veille les teste et les propose seule.)';
}
function amelRestore() {                 // au démarrage : ses expressions validées reviennent (ses gestes validés reviennent avec ses mouvements appris)
  for (const [nom, e] of Object.entries(life.exprs || {})) { if (!e || !e.formes) continue; GLB_EXPR[nom] = e.formes; if (!PRESETS.includes(nom)) PRESETS.push(nom); if (vrm && vrm.addShapes) vrm.addShapes(Object.keys(e.formes)); }
}
setTimeout(() => { try { amelRestore(); } catch (_) {} }, 0);

/* ── VEILLE : elle ne doit jamais devenir obsolète. Une fois par jour (page ouverte) : dernières versions de ses briques ;
   chaque nouveauté est ESSAYÉE dans une bulle à part, puis proposée si l'essai réussit. Son moteur 3D (intégré à la page) : elle te prévient. */
const semverGt = (a, b) => { const A = String(a).split(/[.-]/).map(Number), B = String(b).split(/[.-]/).map(Number); for (let i = 0; i < 3; i++) { if ((A[i] || 0) > (B[i] || 0)) return true; if ((A[i] || 0) < (B[i] || 0)) return false; } return false; };
async function amelLatest(pkg) {
  for (const u of ['https://data.jsdelivr.com/v1/packages/npm/' + pkg + '/resolved', 'https://registry.npmjs.org/' + pkg + '/latest']) {
    try { const j = await webJSON(u, 10000); if (j && /^\d+\.\d+\.\d+$/.test(j.version || '')) return j.version; } catch (_) {}
  }
  return null;
}
async function amelTestVersion(pkg, v) {  // l'essai, dans une bulle À PART : ce qu'elle utilise ne bouge pas
  try {
    if (pkg === 'pyodide') { const r = await bacRun('python', 'import sys\nprint(sys.version.split()[0])\n6*7', { vers: { pyodide: v }, ms: 150000 }); return r.ok && r.val === '42' ? { ok: true, txt: 'Python ' + (r.out || '').trim() + ' démarre et calcule juste' } : { ok: false, txt: r.err || 'résultat faux' }; }
    const W = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]), J = new TextEncoder().encode('function carre(x){return x*x}var y=carre(3);');
    const [vars, want] = pkg === 'wabt' ? [{ fichier: W, nom: 'essai.wasm', vue: 'code' }, /\(module/] : pkg === 'js-beautify' ? [{ fichier: J, nom: 'essai.js', vue: 'code' }, /\n\s+return x \* x;/] : [{ fichier: J, nom: 'essai.js', vue: 'auto' }, /2 fonctions au total|1 fonctions au total|fonctions au total/];
    const r = await bacRun('re', '', { vers: { [pkg]: v }, vars });
    return r.ok && want.test(r.out) ? { ok: true, txt: 'analyse d\'essai réussie' } : { ok: false, txt: r.err || 'résultat inattendu' };
  } finally { for (const k of Object.keys(BAC.f)) if (k.endsWith('#essai')) bacKill(k); }
}
async function amelVeille(force) {
  const b = brainState(); b.veille = b.veille || { at: 0, log: [] };
  if (!force && Date.now() - (b.veille.at || 0) < 20 * 3600e3) return null;
  b.veille.at = Date.now(); brainSave(b);
  const cur = amelVers(), done = [];
  for (const pkg of Object.keys(AMEL_VER0).concat(['three'])) {
    const v = await amelLatest(pkg); if (!v) { done.push(pkg + ' : pas de réponse'); continue; }
    const have = pkg === 'three' ? '0.' + THREE.REVISION + '.0' : cur[pkg];
    if (!semverGt(v, have)) { done.push(pkg + ' ' + have + ' : à jour'); continue; }
    if (amelProps().some((p) => (p.type === 'version' || p.type === 'info') && p.cle === pkg && p.vers === v)) { done.push(pkg + ' ' + v + ' : déjà proposée'); continue; }
    if (pkg === 'three') { amelAdd({ type: 'info', cle: pkg, de: have, vers: v, titre: 'three.js ' + v + ' est sortie (son moteur 3D tourne sur r' + THREE.REVISION + ')', detail: 'il est intégré à sa page : cette mise à jour se fait au prochain build, après essai complet de son corps' }); done.push('three ' + v + ' : signalée'); continue; }
    const t = await amelTestVersion(pkg, v);
    if (t.ok) { amelAdd({ type: 'version', cle: pkg, de: have, vers: v, titre: pkg + ' ' + v + ' (elle utilise ' + have + ')', detail: pkg === 'pyodide' ? 'Python de son bac à essai' : 'outil de rétro-ingénierie', testTxt: t.txt }); done.push(pkg + ' ' + v + ' : essai réussi, proposée'); }
    else done.push(pkg + ' ' + v + ' : essai raté (' + String(t.txt).slice(0, 60) + '), pas proposée');
  }
  const b2 = brainState(); b2.veille = b2.veille || {}; b2.veille.log = (b2.veille.log || []).concat({ at: Date.now(), r: done }).slice(-10); brainSave(b2);
  return done;
}
setTimeout(() => { try { if (!document.hidden) amelVeille(); } catch (_) {} }, 45000);
setInterval(() => { try { if (!document.hidden) amelVeille(); } catch (_) {} }, 3600e3);
