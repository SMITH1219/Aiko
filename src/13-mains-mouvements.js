/* ---------- Configurations complètes de la main (40 configurations standard + gestes courants) ----------
   Chaque doigt : [base, milieu, bout] en fraction de l'amplitude humaine ; Spread : écartement par doigt (rad) ; Thumb : rotations [x,y,z] par articulation. */
const _C = [0.95, 1, 0.85], _X = [0, 0, 0], _HK = [0.1, 0.95, 0.85], _BM = [1, 0, 0], _CS = [0.35, 0.45, 0.3], _OS = [0.55, 0.7, 0.5], _FO = [0.75, 0.25, 0.1], _CL = [0.15, 0.9, 0.8], _BV = [0, 0.9, 0.8];
const TH = { out: [[-0.7, 0, 0], [0, 0, 0], [0, 0, 0]], side: [[0.55, 0, 0], [0, 0, 0], [0, 0, 0]], up: [[0.6, -0.2, 0], [0, -0.1, 0], [0, -0.1, 0]],
  across: [[0.1, 0.7, 0], [0, 0.6, 0], [0, 0.5, 0]], over: [[0.3, 0.75, 0], [0, 0.4, 0], [0, 0.3, 0]], oppose: [[-0.25, 0.75, 0], [0, 0.35, 0], [0, 0.25, 0]],
  tuck: [[0.2, 0.9, 0], [0, 0.9, 0], [0, 0.6, 0]], copen: [[-0.35, 0.45, 0], [0, 0.2, 0], [0, 0.15, 0]], flat: [[-0.2, 0.7, 0], [0, 0, 0], [0, 0, 0]], claw: [[-0.5, 0.3, 0], [0, 0.4, 0], [0, 0.5, 0]] };
const SPR4 = { Index: -0.22, Middle: -0.05, Ring: 0.1, Little: 0.28 }, SPR0 = { Index: 0.04, Middle: 0, Ring: -0.03, Little: -0.06 };
const hs = (i, m, r, l, t, sp) => ({ Index: i, Middle: m, Ring: r, Little: l, Thumb: TH[t], Spread: sp || SPR0 });
const HANDSHAPES = {
  'asl-a': hs(_C, _C, _C, _C, 'side'), 'asl-open-a': hs(_C, _C, _C, _C, 'up'), 'asl-b': hs(_X, _X, _X, _X, 'across'), 'asl-open-b': hs(_X, _X, _X, _X, 'out'),
  'asl-bent-b': hs(_BM, _BM, _BM, _BM, 'across'), 'asl-c': hs(_CS, _CS, _CS, _CS, 'copen'), 'asl-d': hs(_X, _OS, _OS, _OS, 'oppose'), 'asl-e': hs([0.3, 1, 1], [0.3, 1, 1], [0.3, 1, 1], [0.3, 1, 1], 'tuck'),
  'asl-f': hs(_OS, _X, _X, _X, 'oppose', SPR4), 'asl-open-f': hs([0.3, 0.3, 0.2], _X, _X, _X, 'copen', SPR4), 'asl-g': hs(_X, _C, _C, _C, 'side'), 'asl-h': hs(_X, _X, _C, _C, 'over'),
  'asl-i': hs(_C, _C, _C, _X, 'over'), 'asl-k': hs(_X, [0.2, 0, 0], _C, _C, 'oppose', { Index: -0.15, Middle: 0.12 }), 'asl-l': hs(_X, _C, _C, _C, 'out'), 'asl-bent-l': hs([0, 0.7, 0.5], _C, _C, _C, 'out'),
  'asl-m': hs([0.9, 0.6, 0.4], [0.9, 0.6, 0.4], [0.9, 0.6, 0.4], _C, 'tuck'), 'asl-n': hs([0.9, 0.6, 0.4], [0.9, 0.6, 0.4], _C, _C, 'tuck'), 'asl-open-n': hs(_BM, _BM, _C, _C, 'out'),
  'asl-o': hs(_OS, _OS, _OS, _OS, 'oppose'), 'asl-baby-o': hs(_OS, _C, _C, _C, 'oppose'), 'asl-flat-o': hs(_FO, _FO, _FO, _FO, 'flat'),
  'asl-r': hs(_X, _X, _C, _C, 'over', { Index: 0.14, Middle: -0.2 }), 'asl-s': hs(_C, _C, _C, _C, 'over'), 'asl-t': hs([0.7, 0.8, 0.5], _C, _C, _C, 'tuck'), 'asl-u': hs(_X, _X, _C, _C, 'over'),
  'asl-v': hs(_X, _X, _C, _C, 'over', { Index: -0.22, Middle: 0.14 }), 'asl-bent-v': hs(_BV, _BV, _C, _C, 'over', { Index: -0.22, Middle: 0.14 }), 'asl-w': hs(_X, _X, _X, _C, 'oppose', { Index: -0.2, Middle: 0, Ring: 0.18 }),
  'asl-x': hs(_HK, _C, _C, _C, 'over'), 'asl-y': hs(_C, _C, _C, _X, 'out', { Little: 0.3 }), 'asl-l-i': hs(_X, _C, _C, _X, 'out', { Little: 0.28 }), 'asl-1-i': hs(_X, _C, _C, _X, 'over', { Little: 0.25 }),
  'asl-1': hs(_X, _C, _C, _C, 'over'), 'asl-3': hs(_X, _X, _C, _C, 'out', { Index: -0.22, Middle: 0.12 }), 'asl-bent-3': hs(_BV, _BV, _C, _C, 'out', { Index: -0.22, Middle: 0.12 }),
  'asl-4': hs(_X, _X, _X, _X, 'across', SPR4), 'asl-5': hs(_X, _X, _X, _X, 'out', SPR4), 'asl-bent-5': hs(_CL, _CL, _CL, _CL, 'claw', SPR4),
  'asl-8': hs(_X, [0.6, 0.6, 0.4], _X, _X, 'oppose', SPR4), 'asl-open-8': hs(_X, [0.55, 0.2, 0.1], _X, _X, 'out', SPR4),
  // gestes courants
  'pouce-leve': hs(_C, _C, _C, _C, 'up'), 'appelle-moi': hs(_C, _C, _C, _X, 'out', { Little: 0.3 }), rock: hs(_X, _C, _C, _X, 'over', { Little: 0.25 }), 'je-t-aime': hs(_X, _C, _C, _X, 'out', { Little: 0.28 }),
  'coeur-doigts': hs([0.45, 0.5, 0.25], _C, _C, _C, 'oppose'), 'doigts-croises': hs(_X, _X, _C, _C, 'over', { Index: 0.14, Middle: -0.2 }), 'petit-doigt': hs(_C, _C, _C, [0.1, 0.5, 0.4], 'over'),
  pistolet: hs(_X, _X, _C, _C, 'up'), griffe: hs(_CL, _CL, _CL, _CL, 'claw', SPR4), tasse: hs(_CS, _CS, _CS, _CS, 'copen'), pince: hs([0.5, 0.55, 0.3], [0.2, 0.2, 0.1], [0.25, 0.25, 0.1], [0.3, 0.3, 0.1], 'oppose'),
  'compte-1': hs(_C, _C, _C, _C, 'out'), 'compte-2': hs(_X, _C, _C, _C, 'out'), 'compte-3': hs(_X, _X, _C, _C, 'out', { Index: -0.2, Middle: 0.1 }), 'compte-4': hs(_X, _X, _X, _X, 'across', SPR4), 'compte-5': hs(_X, _X, _X, _X, 'out', SPR4),
  'main-plate': hs(_X, _X, _X, _X, 'side'), 'main-detendue': hs([0.2, 0.25, 0.15], [0.25, 0.3, 0.15], [0.3, 0.35, 0.2], [0.35, 0.4, 0.2], 'relax' in TH ? 'relax' : 'copen'),
};
Object.assign(HAND, HANDSHAPES);
const FING_MAX = [1.35, 1.6, 1.0];             // repli des formes simples (une valeur par doigt), inchangé
const FING_ROM = [1.55, 1.9, 1.4];             // amplitude humaine par phalange (base ~89°, milieu ~109°, bout ~80°)
const FING_HYP = [0.35, 0.05, 0.12];           // extension au-delà du plat (base surtout)
const FING_SPR = { Index: -0.34, Middle: -0.1, Ring: 0.14, Little: 0.4 };
function applyHand(set, shape, w, side) {
  const S = typeof shape === 'object' && shape ? shape : HAND[shape]; if (!S || !set) return;
  const sg = side > 0 ? 1 : -1;
  for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
    const ch = set[f] || [], v = S[f];
    ch.forEach((n, i) => {
      let a;
      if (Array.isArray(v)) { const x = v[Math.min(i, v.length - 1)]; a = x >= 0 ? x * FING_ROM[i] : x * FING_HYP[i]; }   // contrôle phalange par phalange
      else a = (v || 0) * FING_MAX[i];
      n.rotation.z = n.rotation.z * (1 - w) + sg * a * w;
    });
    if (ch[0]) {                                                        // écartement / rapprochement des doigts (valeur fixée, jamais cumulée d'une image à l'autre)
      const sp = typeof S.Spread === 'number' ? FING_SPR[f] * S.Spread * (window.__spr ?? 1) : (S.Spread && S.Spread[f]) || 0;
      ch[0].rotation.y = ch[0].rotation.y * (1 - w) + sg * sp * w;
    }
  }
  const th = set.Thumb || [], T = S.Thumb;
  if (T && typeof T === 'object') {                                    // pouce complet : rotations par articulation [x,y,z] (rad)
    th.forEach((n, i) => { const r = T[i] || [0, 0, 0];
      n.rotation.x = n.rotation.x * (1 - w) + r[0] * w; n.rotation.y = n.rotation.y * (1 - w) + sg * r[1] * w; n.rotation.z = n.rotation.z * (1 - w) + sg * r[2] * w; });
    return;
  }
  th.forEach((n, i) => {                           // le pouce se replie vers la paume
    const c = (T || 0) * [0.5, 0.8, 0.9][i];
    n.rotation.y = n.rotation.y * (1 - w) + sg * (window.__thy ?? 1) * c * w;
    n.rotation.z = n.rotation.z * (1 - w) + sg * (window.__thz ?? 0) * c * w;
  });
}

/* ── Apprendre un mouvement en regardant une image (photo, capture, planche de plusieurs poses) ──
   Claude regarde l'image avec un plan exact du squelette d'Aiko et répond en JSON ; on borne chaque articulation
   aux amplitudes humaines, on joue le mouvement, et elle le retient pour toujours (« ses mouvements appris »). */
const LEARN_SPEC = `Tu convertis des poses humaines vues sur une image en mouvement pour le squelette d'un avatar 3D.
L'image peut contenir une seule pose ou une planche de plusieurs poses (lis-les dans l'ordre : gauche→droite puis haut→bas, ou suis les numéros).
Réponds UNIQUEMENT en JSON : {"nom":"mot-court-sans-espace","description":"une phrase en français","sol":true|false,"etapes":[{"duree":secondes(0.4 à 3),"corps":{...},"mainD":{"ancre":"sh|head|hips|fl","pos":[x,y,z]},"mainG":{...},"formeD":"...","formeG":"..."}]}
Angles en radians, rotations relatives au repos debout bras le long du corps. Os de "corps" et conventions :
- hips [x,y,z] = tout le corps : x>0 penche en avant (1.57 = à plat ventre, 2.3 = tête en bas), x<0 bascule en arrière (-1.57 = allongée sur le dos) ; y = pivote ; z = incline sur le côté.
- spine, chest [x,y,z] : x>0 enroule vers l'avant, x<0 cambre ; y torsion ; z inclinaison latérale. neck idem.
- lUpLeg (cuisse gauche), rUpLeg (droite) [x,y,z] : x<0 lève la cuisse devant (-1.57 = horizontale, max -2.4), x>0 vers l'arrière (max 0.9) ; y rotation de la cuisse ; z écarte : gauche NÉGATIF, droite POSITIF (max 1.5, grand écart latéral).
- lLowLeg, rLowLeg [x,0,0] : x>0 plie le genou (0 tendu, 2.5 max).
- lFoot, rFoot [x,0,0] : x>0 pointe le pied, x<0 relève la pointe.
Mains : position cible en mètres par rapport à une ancre ("sh" milieu des épaules, "head" tête, "hips" bassin, "fl" le sol sous les épaules) ; pos = [x vers l'EXTÉRIEUR du côté de cette main, y vers le haut, z vers l'avant]. Ex : bras tendu sur le côté = sh [0.75,0,0] ; main levée au-dessus de la tête = head [0.05,0.35,0] ; main sur la hanche = hips [0.18,0.07,0].
formeD/formeG parmi : open, fist, point, relax, main-plate, main-detendue, compte-1, pince, peace.
"sol": true si le corps touche le sol (au sol, à genoux, allongée, grand écart) : le corps sera posé exactement au sol.
Une étape par pose de l'image (1 à 12). Sois précis sur les angles en observant chaque membre.`;
const LIM = { hips: [[-1.7, 2.4], [-3.2, 3.2], [-0.8, 0.8]], spine: [[-0.6, 0.9], [-0.7, 0.7], [-0.5, 0.5]], chest: [[-0.5, 0.6], [-0.6, 0.6], [-0.4, 0.4]], neck: [[-0.6, 0.7], [-1.1, 1.1], [-0.5, 0.5]],
  lUpLeg: [[-2.45, 0.9], [-0.9, 0.9], [-1.55, 0.5]], rUpLeg: [[-2.45, 0.9], [-0.9, 0.9], [-0.5, 1.55]], lLowLeg: [[0, 2.6], [0, 0], [0, 0]], rLowLeg: [[0, 2.6], [0, 0], [0, 0]], lFoot: [[-0.7, 1.0], [-0.3, 0.3], [-0.3, 0.3]], rFoot: [[-0.7, 1.0], [-0.3, 0.3], [-0.3, 0.3]] };
function moveFromJson(j) {          // JSON de Claude → geste d'Aiko, chaque angle borné à l'amplitude humaine
  const et = (j && Array.isArray(j.etapes) ? j.etapes : []).slice(0, 12); if (!et.length) return null;
  const fk = [[0, {}]], r = [], l = [], rh = [], lh = []; let t = 0;
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  for (const e of et) {
    t += Math.max(0.4, Math.min(3, num(e.duree) || 1.2));
    const pose = {};
    for (const [k, lim] of Object.entries(LIM)) { const v = e.corps && e.corps[k]; if (Array.isArray(v)) pose[k] = [0, 1, 2].map((i) => Math.max(lim[i][0], Math.min(lim[i][1], num(v[i])))); }
    fk.push([t, pose]);
    for (const [src, dst, hd] of [[e.mainD, r, rh], [e.mainG, l, lh]]) {
      if (src && Array.isArray(src.pos)) dst.push([t - 0.3, ['sh', 'head', 'hips', 'fl'].includes(src.ancre) ? src.ancre : 'sh', [0, 1, 2].map((i) => Math.max(-0.9, Math.min(0.9, num(src.pos[i]))))]);
    }
    if (e.formeD) rh.push([t - 0.3, String(e.formeD)]); if (e.formeG) lh.push([t - 0.3, String(e.formeG)]);
  }
  const hold = fk[fk.length - 1][1]; t += 1.0; fk.push([t, hold]); t += 1.0; fk.push([t, {}]);
  const def = { dur: t, fk, ground: j.sol ? 1 : undefined, face: ['happy', 0.6], learned: 1 };
  if (r.length) { def.r = r; def.rPole = [1, -0.5, -0.3]; } if (l.length) { def.l = l; def.lPole = [1, -0.5, -0.3]; }
  if (rh.length) def.rHand = rh; if (lh.length) def.lHand = lh;
  return def;
}
async function learnMoveFromImage(photo, text) {
  const out = await cap.sample([{ role: 'user', content: LEARN_SPEC + '\n\nDemande de la personne : ' + text }], { images: [photo], modelTier: 'complex', cache: false });
  const m = String(out && out.text || '').match(/\{[\s\S]*\}/); if (!m) throw new Error('pas de JSON');
  const j = JSON.parse(m[0]); const def = moveFromJson(j); if (!def) throw new Error('aucune pose lue');
  const name = (String(j.nom || 'appris').toLowerCase().replace(/[^a-z0-9à-ÿ-]+/g, '-').slice(0, 30) || 'appris');
  GLIB[name] = def; life.moves = life.moves.filter((x) => x.name !== name); life.moves.push({ name, desc: String(j.description || '').slice(0, 200), def, at: Date.now() }); life.moves = life.moves.slice(-60); saveLife();
  playGesture(name);
  return { name, desc: j.description || '', n: (j.etapes || []).length };
}
function restoreMoves() { for (const m of life.moves || []) if (m && m.name && m.def && m.def.dur) GLIB[m.name] = m.def; }
restoreMoves();
function directGesture(t) {          // repère un geste, une pose ou un mouvement nommé dans la phrase (le plus long gagne)
  const n = ' ' + _nrm(t).replace(/[^a-z0-9']+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const short = n.trim().split(' ').length <= 3;   // « twerk », « le grand écart » : un nom de geste seul est une demande
  if (!short && !/(fais|refais|montre|danse|mets|pose|prends|va |vas |viens|essaie|encore|allez|stp|s'il|peux|veux|bouge|tourne|cambre|penche|allonge|accroupi|assieds|leve|deshabille|devoile|exhibe|effeuill|strip|bois|boire|lis |lire|ecris|ecrire|caresse|touche|tapote|masse|frotte|sens |maquille|appelle)/.test(n)) return null;
  { const tp = touchParse(t); if (tp) return tp[0]; }
  let best = null;
  const pairs = Object.keys(GLIB_FR).concat(Object.keys(GEST_FR), Object.keys(GLIB)).map((k) => [k, k]).concat((Array.isArray(LIB_ALIAS) ? LIB_ALIAS : []).map((a) => [a[0], a[1]]));
  for (const [k, target] of pairs) { const kk = _nrm(k).replace(/-/g, ' '); if (kk.length < 3) continue;
    if (n.includes(' ' + kk + ' ') && (!best || kk.length > best[1])) best = [target, kk.length]; }
  return best ? best[0] : null;
}
const GLIB_FR = { 'hanche': 'hip', 'hanches': 'hips', 'fière': 'hips', 'fiere': 'hips', cheveux: 'hair', bisou: 'kiss', menton: 'chin', joue: 'cheek',
  'rit-cache': 'giggle', 'rire': 'giggle', coeur: 'heart', 'cœur': 'heart', montre: 'point', 'étire': 'stretch', etire: 'stretch',
  applaudit: 'clap', 'croise': 'cross', 'bras-croisés': 'cross', timide: 'shy', coucou: 'hello',
  'v': 'peace', 'paix': 'peace', pouce: 'thumbsup', 'super': 'thumbsup', chut: 'shh', ouais: 'yes', victoire: 'yes', pense: 'callme',
  'clin': 'wink', "clin-d'oeil": 'wink', 'clin-doeil': 'wink', sourcils: 'browup', moue: 'pout', 'sourire-en-coin': 'smirk', 'mord-levre': 'lipbite', 'mord-lèvre': 'lipbite',
  'yeux-au-ciel': 'eyeroll', 'baille': 'yawn', 'bâille': 'yawn', soupir: 'sigh', soupire: 'sigh', 'front': 'facepalm', 'stp': 'please', 'supplie': 'please',
  'bras-ouverts': 'hug', calin: 'hug', 'câlin': 'hug', moi: 'me', 'paume': 'stop', idee: 'idea', 'idée': 'idea', 'pouce-bas': 'thumbsdown', 'ok': 'okay',
  compte: 'count', 'dans-le-dos': 'behind', ajuste: 'adjust', 'eclate': 'laughbig', 'éclate': 'laughbig', 'fou-rire': 'laughbig', reverence: 'bow', 'révérence': 'bow',
  tourne: 'spin', 'tourne-toi': 'spin', saute: 'jump', accroupie: 'crouch', 'accroupis': 'crouch', danse: 'dance',
  'deux-mains': 'wave2', 'coucou-deux-mains': 'wave2', viens: 'beckon', 'approche': 'beckon', 'tape-la-main': 'highfive', 'checke': 'highfive', 'cinq': 'highfive',
  'serre-la-main': 'handshake', 'poignee-de-main': 'handshake', 'poignée-de-main': 'handshake', salue: 'salute', 'salut-militaire': 'salute',
  merci: 'thanks', remercie: 'thanks', oh: 'gasp', 'surprise': 'gasp', 'choc': 'shock', 'choquée': 'shock', 'choquee': 'shock', pleure: 'cry', 'larmes': 'cry',
  'essuie-larme': 'wipe', 'essuie': 'wipe', colere: 'angry', 'colère': 'angry', 'fâchée': 'angry', 'fachee': 'angry', boude: 'sulk', 'bouder': 'sulk',
  froid: 'cold', 'frisson': 'cold', peur: 'scared', 'effrayée': 'scared', 'effrayee': 'scared', pose: 'pose', 'prend-la-pose': 'pose', 'mannequin': 'pose',
  hourra: 'cheer', 'bravo': 'cheer', 'youpi': 'cheer', migraine: 'headache', 'mal-de-tete': 'headache', 'mal-de-tête': 'headache',
  'gratte-tete': 'scratch', 'gratte-tête': 'scratch', gratte: 'scratch', nuque: 'neckrub', 'ronge-ongles': 'nails', 'rongeongles': 'nails',
  ecoute: 'listen', 'écoute': 'listen', chuchote: 'whisper', attends: 'wait', 'attend': 'wait', calme: 'calm', 'calme-toi': 'calm',
  'non-non': 'nope', 'doigt': 'nope', taille: 'size', 'grand': 'size', 'sais-pas': 'dontknow', 'saispas': 'dontknow', 'aucune-idee': 'dontknow', 'aucune-idée': 'dontknow',
  'la-bas': 'overthere', 'là-bas': 'overthere', 'regarde': 'lookhere', 'regarde-ca': 'lookhere', 'regarde-ça': 'lookhere', 'tape-du-pied': 'stomp', 'piétine': 'stomp',
  'reverence-robe': 'curtsy', 'cercle-bras': 'cerclebras', 'cercles-de-bras': 'cerclebras', 'moulinet': 'cerclebras', 'cercle-deux-bras': 'cerclebras2', 'cercle-tete': 'cerclehead', 'cercle-tête': 'cerclehead', 'tourne-la-tete': 'rotatehead', 'tourne-la-tête': 'rotatehead',
  'haussepaules': 'haussepaules', 'hausse-epaules': 'haussepaules', 'omoplates': 'omoplates', 'bascule-bassin': 'bassin', 'bassin': 'bassin', 'cercle-hanches': 'cerclehanches', 'torsion': 'torsion', 'torsion-buste': 'torsion', 'penche-cote': 'penchecote', 'penche-côté': 'penchecote',
  'cambre': 'cambrer', 'cambre-toi': 'cambrer', 'touche-pieds': 'penche', 'penche-devant': 'penche', 'jambe-cote': 'jambecote', 'jambe-côté': 'jambecote', 'leve-genou': 'genou', 'lève-genou': 'genou', 'genou': 'genou', 'pointes': 'pointes', 'sur-la-pointe': 'pointes', 'talons': 'talons',
  'cercle-cheville': 'cheville', 'cheville': 'cheville', 'ecarte-doigts': 'doigts', 'écarte-doigts': 'doigts', 'doigts': 'doigts', 'opposition': 'opposition', 'pouce-doigts': 'opposition', 'tourne-paumes': 'paumes', 'paumes': 'paumes', 'marche': 'marche', 'pousse': 'pousse', 'tire': 'tire', 'lance': 'lance', 'révérence-robe': 'curtsy', selfie: 'selfie', muscle: 'muscle', 'muscles': 'muscle', 'biceps': 'muscle' };
const GEST_FR = { salut: 'wave', oui: 'nod', non: 'shake', reflechit: 'think', 'réfléchit': 'think', hausse: 'shrug', penche: 'lean', incline: 'tilt', rit: 'laugh',
  cheveux: 'hair', timide: 'shy', charme: 'flirt', cuisses: 'thigh', 'genoux': 'kneelarch', 'a-genoux': 'kneelarch', descente: 'dropdown', 'danse-lente': 'slowdance', 'slow': 'slowdance', 'quatre-pattes': 'chat', chat: 'chat', penche: 'penche', 'penchée': 'penche', ventre: 'ventre', 'sur-le-ventre': 'ventre', 'sur-le-dos': 'dos', 'drop-it-low': 'droplow', droplow: 'droplow', 'hair-whip': 'hairwhip', viens: 'viens', effeuillage: 'effeuillage', 'strip-tease': 'effeuillage', striptease: 'effeuillage', 'deshabille-toi': 'effeuillage', 'deshabille': 'effeuillage', exhibe: 'devoile', 'exhibe-toi': 'devoile', devoile: 'devoile', 'se-devoile': 'devoile', 'dévoile': 'devoile', 'montre-toi': 'devoile', cou: 'neck', 'caresse-cou': 'neck', 'mains-cheveux': 'hairboth', taille: 'waist', 'glisse-taille': 'waist', 'huit': 'hiproll', 'rond-hanches': 'hiproll', ondulation: 'bodyroll', 'vague': 'bodyroll', 'epaule': 'overshoulder', 'épaule': 'overshoulder', 'regard-epaule': 'overshoulder', 'roule-epaules': 'shoulderroll', 'doigt-levre': 'fingerlip', 'doigt-lèvre': 'fingerlip', bretelle: 'strap', 'cambre': 'archstretch', 'cambrée': 'archstretch', 'coup-cheveux': 'hairflip', 'déhanche': 'sway', dehanche: 'sway', danse: 'sway' };
let heelCur = 0; const HEEL_LIFT = window.__hl ?? 0.062, HEEL_FOOT = window.__hf ?? 0.62;
const TALKG = ['tpresent', 'tpresentl', 'tboth', 'temph', 'tcircle', 'tone', 'tpresent', 'tlist', 'tshrug', 'tpresentl'];
const IDLEG = ['sway', 'hiproll', 'hair', 'neck', 'hip', 'shoulderroll', 'flirt', 'overshoulder', 'hairboth', 'shift', 'waist', 'smirk', 'sway', 'hairflip', 'lipbite', 'tilt', 'bodyroll', 'chin', 'fingerlip', 'behind', 'strap', 'archstretch', 'hips', 'wink', 'lean', 'thigh', 'viens', 'hairwhip', 'bodyroll', 'hiproll', 'lipbite'];   // attente : gestuelle féminine et sensuelle (déhanchés, cheveux, main sur la hanche, regards)
let talkNext = 1.0, lastTalkG = '';
let camDrop = 0, lastRigY = 0;
let gst = null, idleNext = 10, shiftDir = 1, sideCur = 1, beat = 0, beatIdx = 0, beatHand = 1, libFace = null;
// ── postures porteuses : l'IK des jambes débloque les positions que le modèle debout/assis/allongé ne pouvait pas tenir ──
// (bassin qui descend + pieds ancrés au sol + genoux qui plient = accroupie, squat, fente…)
let freePose = null, freeW = 0;
// angles calibrés (hanche, genou, cheville en radians) + descente du corps en mètres ; les pieds restent au sol
const POSTURES = {
  debout: null,
  flechie:   { drop: 0.10, upLeg: -0.45, lowLeg: 0.9, foot: -0.42, spine: 0.08 },   // genoux fléchis, prête à bouger
  accroupie: { drop: 0.30, upLeg: -1.15, lowLeg: 2.1, foot: -0.9, spine: 0.22 },    // accroupie
  squat:     { drop: 0.40, upLeg: -1.55, lowLeg: 2.7, foot: -1.1, spine: 0.30 },    // squat profond
  agenoux:   { upLeg: -1.9, lowLeg: 2.55, foot: 0.7, spine: 0.06, knees: 1 },  // à genoux (tibias au sol)
};
const _fv = new THREE.Vector3();   // temp pour mesurer le point le plus bas du corps
let postureT = 0;                  // >0 : tient la posture, puis se relève toute seule
const POSTURE_FR = { accroupi: 'accroupie', 'accroupis-toi': 'accroupie', squat: 'squat', 'à-genoux': 'agenoux', agenou: 'agenoux', genoux: 'agenoux', 'lève-toi': 'debout', debout: 'debout', 'relève-toi': 'debout', flechis: 'flechie', flechir: 'flechie' };
/* Bibliothèque de mouvements réels (capture de mouvement CMU, libre de droits), recalés sur le squelette d'Aiko */
const CLIPS = {};
const CLIP_BONES = { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', leftShoulder: 'lSh', rightShoulder: 'rSh', leftUpperArm: 'lArm', rightUpperArm: 'rArm',
  leftLowerArm: 'lLowArm', rightLowerArm: 'rLowArm', leftHand: 'lHand', rightHand: 'rHand', leftUpperLeg: 'lUpLeg', rightUpperLeg: 'rUpLeg', leftLowerLeg: 'lLowLeg', rightLowerLeg: 'rLowLeg',
  leftFoot: 'lFoot', rightFoot: 'rFoot', leftToes: 'lToes', rightToes: 'rToes' };
const CLIP_FR = { marcher: 'marche', walk: 'marche', 'marche-lente': 'marchelente', 'marche-rapide': 'marcherapide', courir: 'course', run: 'course', cours: 'course', jog: 'trot', jogging: 'trot', footing: 'trot',
  danser: 'danse1', danse: 'danse1', dance: 'danse1', danse2: 'danse2', danse3: 'danse3', ballet: 'danse2', 'tai-chi': 'taichi', taichi: 'taichi', etire: 'etirement', 'étirement': 'etirement', stretch: 'etirement', etirements: 'etirement',
  'coup-de-pied': 'coupdepied', kick: 'coupdepied', 'coup-de-poing': 'coupdepoing', punch: 'coupdepoing', boxe: 'coupdepoing', gym: 'sport', fitness: 'sport', 'jumping-jacks': 'sport', cartwheel: 'roue', jump: 'saut', saute: 'saut', sauter: 'saut',
  salsa: 'salsa', charleston: 'charleston', 'danse-indienne': 'danseindienne', indienne: 'danseindienne', bollywood: 'danseindienne', 'hip-hop': 'hiphop', hiphop: 'hiphop', 'coup-de-pied-tournant': 'coupdepiedtournant', 'coup-de-pied-retourné': 'coupdepiedtournant', capoeira: 'coupdepiedtournant' };
/* Lissage temporel des mouvements capturés : la capture a du bruit (mains et poignets surtout) et des changements de vitesse à chaque image ;
   un filtre à 3 images (plus fort sur les extrémités) enlève le tremblement sans effacer le rythme. */
function clipSmooth(c) {
  try {
    const nb = c.bones.length, n = c.n, q = c.q; if (n < 5 || c._sm) return c; c._sm = 1;
    const S = Float32Array.from(q);
    for (let j = 0; j < nb; j++) {
      const nm = String(c.bones[j]), a = /Hand|Foot|Toes|LowerArm/.test(nm) ? 0.27 : /Head|Neck|Spine|Chest|Hips/.test(nm) ? 0.14 : 0.2;
      for (let i = 0; i < n; i++) {
        const i0 = c.loop ? (i + n - 1) % n : Math.max(0, i - 1), i1 = c.loop ? (i + 1) % n : Math.min(n - 1, i + 1);
        const m = (i * nb + j) * 4, p0 = (i0 * nb + j) * 4, p1 = (i1 * nb + j) * 4;
        const d0 = S[m] * S[p0] + S[m + 1] * S[p0 + 1] + S[m + 2] * S[p0 + 2] + S[m + 3] * S[p0 + 3], d1 = S[m] * S[p1] + S[m + 1] * S[p1 + 1] + S[m + 2] * S[p1 + 2] + S[m + 3] * S[p1 + 3];
        const s0 = d0 < 0 ? -a : a, s1 = d1 < 0 ? -a : a; let l = 0;
        for (let k = 0; k < 4; k++) { const v = (1 - 2 * a) * S[m + k] + s0 * S[p0 + k] + s1 * S[p1 + k]; q[m + k] = v; l += v * v; }
        l = 1 / (Math.sqrt(l) || 1); for (let k = 0; k < 4; k++) q[m + k] *= l;
      }
    }
  } catch (_) {}
  return c;
}
async function loadClips() {
  try {
    const res = await fetch('./clips.json'); if (!res.ok) return;
    const j = await res.json();
    for (const [n, c] of Object.entries(j)) {
      const q = new Int16Array(_u8(c.q)), dy = new Int16Array(_u8(c.dy));
      const f = new Float32Array(q.length); for (let i = 0; i < q.length; i++) f[i] = q[i] / 32767;
      CLIPS[n] = clipSmooth({ fps: c.fps, n: c.n, loop: c.loop, bones: c.bones, q: f, dy: Array.from(dy, (v) => v / 10000),
        rd: c.bones.map((b) => (/UpperLeg|LowerLeg/.test(b) ? [b.startsWith('left') ? 0.342 : -0.342, -0.9397, 0] : /Foot/.test(b) ? [0, -0.2, 0.98] : null)), fu: [null, null] });   // même squelette de capture : jambes écartées de 20° au repos (corrigé à l'affichage)
    }
  } catch (e) { console.warn('clips', e); }
}
const _u8 = (b64) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; };
/* ---------- Bibliothèque complète : ~1000 mouvements humains réels (CMU), chargés seulement quand on les demande ---------- */
let LIB = null; const LIBC = {}, LIBP = {};
const _nrm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\- ]/g, ' ');
const LIB_STOP = new Set('fais faire fait refais montre montrer moi me m un une des le la les de du d l et a au aux en tu peux pourrais stp svp please do show the an of comment apprends apprend apprendre enseigne enseigner prof cours lecon encore aiko je veux voir qu que ce cet cette mouvement mouvements geste mets met toi te t va vas par sur sol terre avec pour comme bien petit petite peu'.split(' '));
let LIB_IDF = null;
async function loadLibIndex() {
  try {
    const r = await fetch('./lib/index.json'); if (!r.ok) return;
    LIB = (await r.json()).map(([id, en, fr, n, pk]) => ({ id, en, fr, n, pk, t: new Set((_nrm(fr) + ' ' + _nrm(en)).split(/[\s\-_]+/).filter((w) => w.length > 1)) }));
    const df = {}; for (const c of LIB) for (const w of c.t) df[w] = (df[w] || 0) + 1;
    LIB_IDF = (w) => Math.log(1 + LIB.length / (df[w] || 1));             // mot rare (charleston, ramper…) = plus de poids
  } catch (e) { console.warn('lib', e); }
}

/* ══ MODE LEÇON : enseigner un mouvement comme une vraie prof ══
   1) démonstration complète de face ; 2) découpage en étapes, chacune au ralenti de face puis de profil, avec ses consignes ;
   3) enchaînement « avec moi » en miroir au ralenti ; 4) à vitesse réelle, répété. Pause, étape suivante, vitesse, arrêt. */
const LESSON = { on: false, paused: false, skip: false, mul: 1, inner: false, id: 0, label: '', view: 0, fwd: null };
const _lq = new THREE.Quaternion(), _lv = new THREE.Vector3();
function bodyYaw() {                                   // orientation réelle du corps, déduite de la position des deux hanches
  if (!bones.lUpLeg || !bones.rUpLeg) return 0;
  bones.lUpLeg.getWorldPosition(_lv); const x1 = _lv.x, z1 = _lv.z; bones.rUpLeg.getWorldPosition(_lv);
  const sx = x1 - _lv.x, sz = z1 - _lv.z;               // vecteur droite → gauche
  const y = Math.atan2(-sz, sx);                         // avant = côté perpendiculaire
  if (LESSON.fwd === null) LESSON.fwd = y;               // au repos elle est de face : c'est la référence
  const d = y - LESSON.fwd; return Math.atan2(Math.sin(d), Math.cos(d));
}
function lessonCamFollow(k, acc) {                     // comme une prof face à sa classe : son corps se recale doucement vers toi,
  if (!vrm) return;                                      // les tours et les pas restent visibles ; la caméra garde l'angle choisi
  const S = vrm.scene.rotation.y, body = bodyYaw() - S;
  if (acc.m == null) acc.m = body;
  let d = Math.atan2(Math.sin(body - acc.m), Math.cos(body - acc.m)); acc.m += d * 0.035;      // orientation moyenne lissée (~2-3 s)
  let e = Math.atan2(Math.sin(-acc.m - S), Math.cos(-acc.m - S)); vrm.scene.rotation.y = S + e * 0.08;
  d = Math.atan2(Math.sin(LESSON.view - CAM.yaw), Math.cos(LESSON.view - CAM.yaw)); CAM.yaw += d * 0.25;
}
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function lessonUI(show) {
  let el = document.getElementById('lesson');
  const lg = document.getElementById('log'); if (lg) lg.style.visibility = show ? 'hidden' : '';
  if (!show) { if (el) el.remove(); return; }
  if (el) return el;
  el = document.createElement('div'); el.id = 'lesson';
  el.style.cssText = 'position:fixed;left:8px;right:8px;top:66px;z-index:30;pointer-events:auto;background:rgba(16,13,10,.78);border:1px solid #3a3029;border-radius:14px;padding:7px 10px;color:#f4efe8;font:13px/1.3 system-ui,sans-serif;backdrop-filter:blur(8px)';
  el.innerHTML = '<div id="lesson-title" style="font-weight:700;font-size:13px;color:#f0a070;margin-bottom:4px"></div><div id="lesson-cap"></div><div id="lesson-bar" style="height:3px;background:#3a3029;border-radius:2px;margin:6px 0"><div id="lesson-prog" style="height:3px;width:0;background:#d5560f;border-radius:2px"></div></div><div style="display:flex;gap:6px;justify-content:space-between"></div>';
  const row = el.lastChild;
  const mk = (id, label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.id = id; b.textContent = label; b.onclick = fn; b.style.cssText = 'flex:1;padding:6px 0;min-height:32px;font-size:13px'; row.appendChild(b); return b; };
  mk('lesson-pause', '⏸', () => { LESSON.paused = !LESSON.paused; $('#lesson-pause').textContent = LESSON.paused ? '▶' : '⏸'; if (gst && gst.win) gst.tscale = LESSON.paused ? 0 : gst.base * LESSON.mul; });
  mk('lesson-next', '⏭', () => { LESSON.skip = true; });
  mk('lesson-speed', '×1', () => { LESSON.mul = LESSON.mul >= 1.5 ? 0.5 : LESSON.mul + 0.25; $('#lesson-speed').textContent = '×' + LESSON.mul; if (gst && gst.win && !LESSON.paused) gst.tscale = gst.base * LESSON.mul; });
  mk('lesson-view', '↻ vue', () => { LESSON.view = LESSON.view < 0.5 ? 1.5708 : LESSON.view < 2 ? 3.1416 : 0; LESSON.userView = true; });
  mk('lesson-stop', '✕', () => lessonStop());
  document.body.appendChild(el); return el;
}
function lessonCap(title, text, prog) {
  const el = lessonUI(true); el.querySelector('#lesson-title').textContent = title; el.querySelector('#lesson-cap').textContent = text;
  if (prog != null) el.querySelector('#lesson-prog').style.width = Math.round(prog * 100) + '%';
}
function lessonStop() {
  LESSON.on = false; LESSON.id++;
  if (gst && gst.win) { gst.win = null; gst.dur = gst.t + 0.6; }
  lessonUI(false); CAM.yaw = 0; LESSON.acc = null; if (vrm) vrm.scene.rotation.y = 0;
}
function lessonSource(q) {
  const clean = ' ' + _nrm(q).replace(/[-_]+/g, ' ') + ' ';
  let cq = clean;
  for (let r = 0; r < 3; r++) cq = cq.replace(/ (apprends|enseigne|montre|un|une|le|la|les|du|des|de|d|a|au|stp|svp|s il te plait|comment|on|fait|faire|realise|cours|lecon|tuto|moi|me|m|pour|danser|mouvement|pas|la|ca|ce|cette) /g, ' ');
  cq = cq.replace(/\s+/g, ' ').trim();
  let d = cq ? directGesture('fais ' + cq + ' ') : null;
  if (d && typeof d === 'string' && d.startsWith('mv:')) { const h = libFind(d.slice(3)); if (h) return { kind: 'clip', hit: h, label: cq || q }; d = null; }
  if (d) { const k = GLIB[d] ? d : (GLIB_FR[d] && GLIB[GLIB_FR[d]]) ? GLIB_FR[d] : null; if (k && GLIB[k].dur >= 2) return { kind: 'glib', name: k, label: cq || k }; }
  const h = libFind(cq || q); if (h) return { kind: 'clip', hit: h, label: cq || q };
  return null;
}
async function lessonGst(src, mirror) {
  if (src.kind === 'glib') return { name: src.name, t: 0, dur: 1e9, lib: GLIB[src.name], age: 0 };
  const c = await libClip(src.hit.id);
  return { name: 'lib:' + src.hit.id, en: src.hit.en || '', t: 0, dur: 1e9, clip: c, speed: 1, mirror: !!mirror, reps: 1, age: 0 };
}
async function lessonPlan(label, en, k, D) {
  const steps = Array.from({ length: k }, (_, i) => i === 0 ? 'Début du mouvement : place tes pieds comme moi, genoux souples, et compte avec moi 1, 2, 3, 4.'
    : i === k - 1 ? 'Fin du mouvement : termine bien la position, garde l\'équilibre, puis relâche.' : 'Partie ' + (i + 1) + ' : regarde mes pieds puis mes hanches, et suis le rythme 1, 2, 3, 4.');
  const plan = { intro: 'On apprend « ' + label + ' ». Je te le montre en entier, puis on le décompose en ' + k + ' étapes au ralenti, et on le fait ensemble.', etapes: steps, conseils: 'Respire, reste détendue, et refais-le plusieurs fois : la fluidité vient avec la répétition.' };
  const SM = (cap.sample || ownOk || DIRECT || brainNet) ? brainSample : null; if (!SM) return plan;
  const prompt = 'Tu es une professeure experte (danse, sport, yoga, arts martiaux). Tu enseignes le mouvement « ' + label + ' »' + (en ? ' (description technique de la capture : ' + en + ')' : '') + ', d\'une durée de ' + D.toFixed(1) + ' s, découpé en ' + k + ' parties égales que l\'élève voit au ralenti. '
    + 'Réponds uniquement en JSON strict : {"intro": "1 à 2 phrases d\'introduction", "etapes": [exactement ' + k + ' chaînes, une par partie : position des pieds, poids du corps, hanches, bras, regard, comptes, et l\'erreur fréquente à éviter, en 2 phrases maximum], "conseils": "1 à 2 phrases"}. Français, tutoiement, ton chaleureux de prof.';
  plan.ready = (async () => { try {
    const r = await Promise.race([SM([{ role: 'user', content: prompt }], { onText: () => {}, maxTokens: 900 }), _sleep(90000).then(() => null)]);
    const m = r && String(r.text || '').match(/\{[\s\S]*\}/); if (!m) return plan;
    const j = JSON.parse(m[0]);
    if (j && Array.isArray(j.etapes) && j.etapes.length) {
      plan.intro = String(j.intro || plan.intro).slice(0, 400); plan.conseils = String(j.conseils || plan.conseils).slice(0, 400);
      plan.etapes = steps.map((x, i) => String(j.etapes[i] || x).slice(0, 320)); plan.precise = true;
    }
  } catch (_) {} })();
  return plan;   // la leçon démarre tout de suite ; les consignes précises remplacent les génériques dès qu'elles arrivent
}
async function lessonPhase(id, src, win, reps, base, mirror, yaw, title, text, prog, sayIt) {
  if (!LESSON.on || LESSON.id !== id) return false;
  lessonCap(title, text, prog); if (sayIt) speak(sayIt);
  if (yaw != null && !LESSON.userView) LESSON.view = yaw;
  const g = await lessonGst(src, mirror); if (!LESSON.on || LESSON.id !== id) return false;
  Object.assign(g, { win: [win[0], win[1]], winRep: reps, base, t: win[0], tscale: LESSON.paused ? 0 : base * LESSON.mul });
  gQueue.length = 0; gst = g; LESSON.skip = false;
  const acc = LESSON.acc || (LESSON.acc = {});
  while (LESSON.on && LESSON.id === id && gst === g && !g.done && !LESSON.skip) { lessonCamFollow(0.1, acc); await _sleep(80); }
  LESSON.skip = false;
  return LESSON.on && LESSON.id === id;
}
function teach(q) {
  const src = lessonSource(String(q || ''));
  if (!src) return false;
  if (LESSON.on && LESSON.label === src.label) return true;
  lessonStop(); LESSON.fwd = null; bodyYaw(); LESSON.view = 0; LESSON.userView = false;
  LESSON.on = true; LESSON.paused = false; LESSON.mul = 1; LESSON.label = src.label; const id = ++LESSON.id;
  (async () => {
    try {
      let D = src.kind === 'glib' ? GLIB[src.name].dur : 0;
      if (src.kind === 'clip') { const c = await libClip(src.hit.id); D = Math.min(24, c.n / c.fps); }
      const k = Math.max(2, Math.min(6, Math.round(D / 2.2)));
      CAM.py = -0.2 * body.k; CAM.dist = 4.5 * body.k; CAM.yaw = 0; CAM.pitch = 0.05;
      lessonCap('Leçon : ' + src.label, 'Je prépare la leçon…', 0);
      addLog('ai', 'Leçon « ' + src.label + ' » : je te montre en entier, puis étape par étape au ralenti, puis on le fait ensemble. Les boutons en haut te permettent de faire pause, passer, changer la vitesse ou la vue.');
      const plan = await lessonPlan(src.label, src.kind === 'clip' ? src.hit.en : '', k, D);
      const seg = (i) => [D * i / k, D * (i + 1) / k];
      const total = 2 + k + 2; let n = 0;
      const P = (...a) => lessonPhase(id, src, ...a);
      if (!await P([0, D], 1, 1, false, 0, 'Démonstration complète', plan.intro, n++ / total, plan.intro)) return;
      for (let i = 0; i < k; i++) {
        const tt = 'Étape ' + (i + 1) + ' / ' + k;
        if (!await P(seg(i), 2, 0.45, false, 0, tt + ' — de face, au ralenti', plan.etapes[i], n / total, plan.etapes[i])) return;
        if (!await P(seg(i), 1, 0.45, false, 1.5708, tt + ' — de profil', plan.etapes[i], (n + 0.6) / total)) return;
        n++;
      }
      if (!await P([0, D], 2, 0.6, true, 0, 'Ensemble, au ralenti', 'À toi, avec moi : je suis en miroir, fais comme si tu te regardais dans une glace. On compte ensemble.', n++ / total, 'À toi, avec moi, en miroir et au ralenti.')) return;
      if (!await P([0, D], 3, 1, true, 0, 'À vitesse réelle', 'Maintenant à vitesse réelle, trois fois. ' + plan.conseils, n++ / total, 'Maintenant à vitesse réelle. ' + plan.conseils)) return;
      lessonCap('Leçon terminée', 'Bravo ! Dis « encore » ou « refais la leçon » pour recommencer, ou demande une autre leçon.', 1);
      speak('Bravo ! Tu veux la refaire, ou passer à un autre mouvement ?');
      await _sleep(6000); if (LESSON.id === id) lessonStop();
    } catch (e) { console.warn('leçon', e); lessonStop(); }
  })();
  return true;
}
function libFind(q) {
  if (!LIB) return null;
  const qt = _nrm(q).split(/[\s\-]+/).filter((w) => w.length > 1 && !LIB_STOP.has(w)); if (!qt.length) return null;
  let best = null, bs = 0;
  for (const c of LIB) {
    let s = 0, hit = 0;
    for (const w of qt) {
      if (c.t.has(w)) { s += 2 * LIB_IDF(w); hit++; continue; }
      if (w.length >= 4) for (const t of c.t) if (t.length >= 4 && (t.startsWith(w.slice(0, 5)) || w.startsWith(t.slice(0, 5)))) { s += 1.2 * LIB_IDF(t); hit++; break; }
    }
    if (!hit) continue;
    s = s * (hit / qt.length) - 0.01 * c.en.length;       // couvrir toute la demande, préférer les descriptions précises
    const segs = c.en.split(/,|;|\band\b|\bthen\b/).filter((x) => x.trim()).length; if (segs > 1) s /= 1 + 0.45 * (segs - 1);   // un clip « fourre-tout » (5 activités) ne doit pas gagner sur un clip dédié
    if (s > bs) { bs = s; best = c; }
  }
  return bs >= 2 ? best : null;
}
const LIBB = {};
async function libClip(id) {
  if (LIBC[id]) return LIBC[id];
  const e = LIB && LIB.find((x) => x.id === id); if (!e) throw new Error('clip ' + id);
  const pk3 = String(e.pk).padStart(3, '0'), bf = './lib/b/' + String(Math.floor(e.pk / 10)).padStart(2, '0') + '.json';   // gros paquet de 100 mouvements (version autonome, moins de fichiers)
  if (LIBB[bf] === undefined) LIBB[bf] = fetch(bf).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const bundle = await LIBB[bf];
  let shard = bundle && bundle[pk3];
  if (!shard) {
    const pf = './lib/p/' + pk3 + '.json';            // paquet de 10 mouvements, gardé en cache
    LIBP[pf] = LIBP[pf] || fetch(pf).then((r) => { if (!r.ok) throw new Error('paquet ' + pf); return r.json(); });
    shard = await LIBP[pf];
  }
  const c = shard[id];
  const dec = (k, sc) => (c[k] ? Array.from(new Int16Array(_u8(c[k])), (v) => v / sc) : null);
  if (c.q3) return (LIBC[id] = { fps: c.fps, n: c.n, loop: false, bones: c.bones, q: clipDecodeQ3(c.q3, c.n, c.bones.length), dy: dec('dy', 10000), dx: dec('dx', 1000), dz: dec('dz', 1000), ct: c.ct ? new Uint8Array(_u8(c.ct)) : null, rd: c.rd || null, fu: c.fu || null, d: c.d, _sm: 1 });   // mouvement préparé : déjà nettoyé et filtré à la source
  const q = new Int16Array(_u8(c.q)), f = new Float32Array(q.length); for (let i = 0; i < q.length; i++) f[i] = q[i] / 32767;
  return (LIBC[id] = clipSmooth({ fps: c.fps, n: c.n, loop: false, bones: c.bones, q: f, dy: dec('dy', 10000), dx: dec('dx', 1000), dz: dec('dz', 1000), d: c.d }));
}
const LIB_ALIAS = [['twerk a quatre pattes', 'twerk4'], ['twerk quatre pattes', 'twerk4'], ['twerk au sol', 'twerk4'], ['twerk', 'twerk'], ['danse orientale', 'belly'], ['danse du ventre', 'belly'], ['orientale', 'belly'], ['shimmy', 'shimmy'], ['grand ecart facial', 'splitside'], ['ecart facial', 'splitside'], ['grand ecart', 'split'],
  ['karate', 'kiba'], ['kiba', 'kiba'], ['mae geri', 'maegeri'], ['coup de pied karate', 'maegeri'], ['a genoux', 'agenoux'], ['genoux', 'agenoux'], ['accroupi', 'accroupie'], ['hip hop', 'hiphop'], ['hiphop', 'hiphop'], ['indienne', 'danseindienne'], ['bollywood', 'danseindienne'],
  ['pompes', 'pompes'], ['push up', 'pompes'], ['pushup', 'pompes'], ['gainage', 'planche'], ['planche', 'planche'], ['marche militaire', 'mv:marching'], ['marcher', 'mv:walk'], ['marche', 'mv:walk'], ['squats', 'mv:alternating squats'], ['squat', 'mv:alternating squats'], ['flexions', 'mv:alternating squats'], ['valse', 'slowdance'], ['cha cha', 'mv:salsa dance'], ['bachata', 'mv:salsa dance'], ['jumping jack', 'mv:alternating jumping jacks'], ['kung fu', 'mv:kick punch'], ['arts martiaux', 'mv:kick punch'], ['combat', 'mv:boxing'], ['taekwondo', 'mv:kick'], ['capoeira', 'mv:cartwheel']];
let libLast = null;
function libPlay(q, opt = {}) {                          // joue n'importe quel mouvement de la bibliothèque ; opt : speed, mirror, reps (mode prof)
  if (typeof q === 'string') {                         // raccourcis : postures porteuses et clips déjà chargés
    const n = ' ' + _nrm(q).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';   // « grand-ecart » = « grand écart »
    for (const [k, v] of LIB_ALIAS) if (n.includes(' ' + k + ' ') || n.includes(' ' + k)) { if (typeof v === 'string' && !v.startsWith('mv:')) { playGesture(v); return { id: v, en: v }; } q = v.slice(3); break; }
  }
  const hit = typeof q === 'object' && q ? q : libFind(q); if (!hit) return null;
  if (LESSON.on && !LESSON.inner) return null;
  libLast = { hit, opt };
  libClip(hit.id).then((c) => {
    const sp = Math.max(0.2, Math.min(2, opt.speed || 1)), reps = Math.max(1, Math.min(6, opt.reps || 1));
    gQueue.length = 0;
    gst = { name: 'lib:' + hit.id, en: hit.en || '', t: 0, dur: (c.n / c.fps) * reps / sp + 0.6, clip: c, speed: sp, mirror: !!opt.mirror, reps };
  }).catch((e) => console.warn('lib', e));
  return hit;
}
const _cq1 = new THREE.Quaternion(), _cq2 = new THREE.Quaternion(), _rmq = new THREE.Quaternion(), _rmv = new THREE.Vector3(), _rms = new THREE.Vector3();
const _mir = (n) => (n.startsWith('left') ? 'right' + n.slice(4) : n.startsWith('right') ? 'left' + n.slice(5) : n);
const _ci = [0, 0, 0, 0];
function applyClip(g, w, b) {
  const c = g.clip, nb = c.bones.length, sp = g.speed || 1, reps = g.reps || 1;
  if (c.ct && c._prep !== vrm) clipPrep(c);                              // appuis adaptés à son corps (une fois par mouvement)
  else if (!c.ct && c.rd && c._rt !== vrm) clipRetarget(c);               // anciens mouvements nommés : au moins la bonne pose des jambes et des pieds
  let fr = g.t * sp * c.fps;
  if (reps > 1 && !c.loop) fr = Math.min(fr, c.n * reps - 1) % c.n;      // mode prof : le mouvement est répété
  if (!c.loop) fr = Math.min(fr, c.n - 1);
  const I = crIdx(c, fr, _ci), W = crWeights(fr - Math.floor(fr));        // interpolation lisse entre les images enregistrées
  g._fr = c.loop ? fr % c.n : fr;
  const m = g.mirror ? -1 : 1;                                            // miroir : face à l'élève, gauche et droite inversées
  for (let j = 0; j < nb; j++) {
    const bone = b[CLIP_BONES[g.mirror ? _mir(c.bones[j]) : c.bones[j]]]; if (!bone) continue;
    crQuat(c.q, nb, j, I, W, m, _cq1);
    bone.quaternion.slerp(_cq1, w);
  }
  if (b.hips) {
    b.hips.position.y += crScalar(c.dy, I, W) * body.hipsY * w;
    if (c.ct) { b.hips.position.x += ((body.hipsX || 0) - b.hips.position.x) * w; b.hips.position.z += ((body.hipsZ || 0) - b.hips.position.z) * w; }   // le balancement de repos (poids d'une jambe sur l'autre) ne continue pas sous le mouvement : il ferait glisser les pieds
    if (c.dx) {                                                           // déplacement réel du corps (comme dans les jeux récents : c'est le mouvement qui fait avancer le personnage)
      const rs = c.rs || 1, X = crScalar(c.dx, I, W) * body.hipsY * m * rs, Z = crScalar(c.dz, I, W) * body.hipsY * rs;
      if (g._pf === undefined || fr < g._pf) { g._px = X; g._pz = Z; }      // début du mouvement ou reprise d'une répétition : pas de saut
      const pr = b.hips.parent; pr.getWorldQuaternion(_rmq); pr.getWorldScale(_rms);
      _rmv.set((X - g._px) * _rms.x, 0, (Z - g._pz) * _rms.z).applyQuaternion(_rmq);
      WORLD.x += _rmv.x * w; WORLD.z += _rmv.z * w; g._px = X; g._pz = Z; g._pf = fr;
      rig.position.x += _rmv.x * w; rig.position.z += _rmv.z * w;          // tout de suite (sinon le corps a une image de retard sur ses jambes, et les pieds glissent à chaque changement de vitesse)
    }
  }
}
function playGesture(name) {
  try { played.push({ n: String(name || ''), at: Date.now() }); if (played.length > 40) played.shift(); } catch (_) {}
  if (LESSON.on && !LESSON.inner && !String(name || '').startsWith('prof:')) return false;   // une leçon en cours n'est pas interrompue par un geste spontané
  name = String(name || '').trim().toLowerCase();
  { const sp = name.replace(/[-_]+/g, ' '); if (!(name in POSTURES) && !GLIB[name] && !CLIPS[name] && !GLIB_FR[name] && !GEST_FR[name] && !POSTURE_FR[name]) { const a = LIB_ALIAS.find((x) => x[0] === _nrm(sp)); if (a && typeof a[1] === 'string' && !a[1].startsWith('mv:')) name = a[1]; else if (GLIB_FR[sp] || GEST_FR[sp] || POSTURE_FR[sp] || GLIB[sp]) name = sp; } }
  if (!GLIB[name] && !name.startsWith('touch:')) { const tp = touchParse(name); if (tp) name = tp[0]; }
  if (name.startsWith('touch:') && !GLIB[name]) { const [, z, st, h, fo] = name.split(':'); const d = touchDef(z, st, h, fo); if (d) GLIB[name] = d; }
  name = POSTURE_FR[name] || name;
  if (name in POSTURES) {                                   // posture porteuse : elle la prend, la tient quelques secondes, puis se relève
    if (gst && gst.t < gst.dur - 0.5) gst.dur = gst.t + 0.5;            // le geste en cours se termine en douceur : jamais deux mouvements du corps entier superposés
    freePose = POSTURES[name]; postureT = name === 'debout' ? 0 : 5.0;
    if (name === 'debout') freePose = null;
    return true;
  }
  const cn = CLIPS[name] ? name : CLIPS[CLIP_FR[name]] ? CLIP_FR[name] : null;
  if (cn) { freePose = null; const c = CLIPS[cn]; gst = { name: cn, t: 0, dur: c.loop ? 6 : c.n / c.fps + 0.6, clip: c }; return true; }
  name = GLIB_FR[name] || GEST_FR[name] || name;
  if (GLIB[name]) { const L = GLIB[name]; if (L.ground || L.root || (L.fk && /UpLeg|LowLeg|hips/.test(JSON.stringify(L.fk)))) freePose = null; gst = { name, t: 0, dur: L.dur, lib: L }; return true; }
  if (name.startsWith('prof:')) { teach(name.slice(5)); return true; }   // vraie leçon : démonstration, étapes, pratique   // mode prof : ralenti, en miroir, répété
  if (name.startsWith('mv:')) return !!libPlay(name.slice(3));
  if (!GEST[name]) return !!libPlay(name);              // tout autre mouvement : la bibliothèque complète
  if (name === 'shift') shiftDir = -shiftDir;
  gst = { name, t: 0, dur: GEST[name] };
  return true;
}
const gQueue = [];                                  // plusieurs gestes dans une réponse : joués l'un après l'autre
function playGestures(list) {
  const a = String(list || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  gQueue.length = 0; a.forEach((g, i) => { if (i === 0) playGesture(g); else gQueue.push(g); });
}
window.aiko = Object.assign(window.aiko || {}, {     // pour le développement futur : jouer, ajouter, lister des gestes
  gesture: (n) => playGesture(n),
  direct: (t) => directGesture(String(t || '').toLowerCase()),
  teach: (q) => teach(q),
  lesson: () => ({ yaw: +bodyYaw().toFixed(2), cam: +CAM.yaw.toFixed(2), view: LESSON.view, on: LESSON.on, title: (document.getElementById('lesson-title') || {}).textContent || '', cap: (document.getElementById('lesson-cap') || {}).textContent || '' }),
  move: (q, opt) => { const h = libPlay(q, opt || {}); return h ? { id: h.id, description: h.en } : null; },   // n'importe quel mouvement (FR ou EN)
  teach: (q, opt) => { const h = libPlay(q, Object.assign({ speed: 0.6, mirror: true, reps: 3 }, opt || {})); return h ? { id: h.id, description: h.en } : null; },
  find: (q, k = 8) => { if (!LIB) return []; const r = []; const qt = String(q || ''); const best = libFind(qt); if (best) r.push({ id: best.id, description: best.en }); return r.slice(0, k); },
  library: () => (LIB ? LIB.length : 0),
  defineGesture: (n, def) => { if (n && def && def.dur) { GLIB[String(n).toLowerCase()] = def; return true; } return false; },
  gestures: () => [...Object.keys(GLIB), ...Object.keys(GEST), ...Object.keys(CLIPS), ...Object.keys(POSTURES).filter((p) => p !== 'debout')],
  defineHand: (n, shape) => { if (n && shape) { HAND[String(n).toLowerCase()] = shape; return true; } return false; },
  hands: () => Object.keys(HAND),
  jigState: () => ({ gain: jigGainMul, off: jig.map((j) => j.off.length()) }),   // debug : dosage et amplitude du rebond
  poseState: () => ({ spineX: bones.spine ? bones.spine.rotation.x : 0, chestX: bones.chest ? bones.chest.rotation.x : 0, hipsX: bones.hips ? bones.hips.position.x : 0, lung: breathLvl(brPh) }),   // debug : respiration/dérive
  faceState: () => ({ blinkT, micro: microName, microW, blinks: window.__blinks || 0 }),   // debug : clignement et micro-expressions
  postures: () => Object.keys(POSTURES),
  posture: (n) => { const k = String(n || '').toLowerCase(); if (!(k in POSTURES)) return false; freePose = POSTURES[k]; return true; },
  poseState2: () => ({ freeW, posture: freePose, hipY: bones.hips ? bones.hips.position.y : 0,
    kneeL: bones.lLowLeg ? bones.lLowLeg.rotation.x : 0, kneeR: bones.rLowLeg ? bones.rLowLeg.rotation.x : 0,
    footLY: bones.lFoot ? bones.lFoot.getWorldPosition(new THREE.Vector3()).y : 0,
    rigY: rig.position.y, anchLY: body.anchL ? body.anchL.y : null,
    toeLY: bones.lToes ? bones.lToes.getWorldPosition(new THREE.Vector3()).y : 0 }),   // debug : posture porteuse
});
// accès debug live pour l'outillage de test (gestes, NaN) — sans effet sur le produit
Object.defineProperties(window.__t = window.__t || {}, {
  gst: { get: () => gst, configurable: true },
  vrm: { get: () => vrm, configurable: true },
  jig: { get: () => jig, configurable: true },
  romHits: { get: () => romHits, configurable: true },
  bones: { get: () => bones, configurable: true },
  FL: { get: () => FL, configurable: true },
  CAM: { get: () => CAM, configurable: true },
});
/* Cinématique inverse à deux os (épaule → coude → poignet), dans l'espace du monde */
const _ik = { s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), m: new THREE.Vector3(),
  E: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Quaternion(), p: new THREE.Quaternion(), I: new THREE.Quaternion() };
function ikRotate(bone, from, to, w) {
  _ik.q.setFromUnitVectors(from.normalize(), to.normalize());
  if (w < 1) _ik.q.copy(_ik.I.clone().slerp(_ik.q, w));                   // (avant : slerpQuaternions(I, q, w) écrivait dans q en le remettant à zéro — l'IK partielle ne faisait rien, puis tout d'un coup à w = 1)
  bone.getWorldQuaternion(_ik.w); bone.parent.getWorldQuaternion(_ik.p);
  bone.quaternion.copy(_ik.p.invert().multiply(_ik.q.multiply(_ik.w)));
  bone.updateWorldMatrix(false, true);
}
function armIK(up, lo, hand, tgt, pole, w) {
  if (!up || !lo || !hand || w <= 0.001) return;
  up.getWorldPosition(_ik.s); lo.getWorldPosition(_ik.e); hand.getWorldPosition(_ik.h);
  const a = _ik.s.distanceTo(_ik.e), b = _ik.e.distanceTo(_ik.h);
  _ik.n.copy(tgt).sub(_ik.s); const d = Math.max(0.05, Math.min(_ik.n.length(), a + b - 0.002)); _ik.n.normalize();
  const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
  _ik.m.copy(pole).addScaledVector(_ik.n, -pole.dot(_ik.n)).normalize();
  _ik.E.copy(_ik.s).addScaledVector(_ik.n, x).addScaledVector(_ik.m, hh);
  ikRotate(up, _ik.a.copy(_ik.e).sub(_ik.s), _ik.b.copy(_ik.E).sub(_ik.s), w);
  lo.getWorldPosition(_ik.e); hand.getWorldPosition(_ik.h);
  _ik.t.copy(_ik.s).addScaledVector(_ik.n, d);
  ikRotate(lo, _ik.a.copy(_ik.h).sub(_ik.e), _ik.b.copy(_ik.t).sub(_ik.e), w);
}