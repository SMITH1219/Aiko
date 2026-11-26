/* ---------- réseau ---------- */
async function fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(id); }
}

let backendOk = false;
let backendSeen = false;   // un backend a déjà répondu : plus jamais de réponse pré-écrite à sa place
function setStatus() {
  const el = $('#status');
  el.classList.toggle('ready', !!vrm);
  el.classList.toggle('backend', backendOk);
  // Texte visible (pas d'infobulle sur mobile) : on sait toujours qui répond.
  if (backendOk) backendSeen = true;
  el.classList.toggle('backend', backendOk || !!cap.sample || DIRECT);
  $('#mode').textContent = (cap.sample || DIRECT) ? 'Aiko est là — cerveau connecté' : backendOk ? 'Backend connecté'
    : backendSeen ? 'Backend en erreur — nouvelle tentative…'
    : (vrm ? 'Mode local — réponses pré-écrites' : 'Chargement…');
}
async function checkHealth() {
  if (backendOk) return;
  for (const url of BACKEND.health) {
    try {
      const res = await fetchT(url, { method: 'GET' }, TIMEOUT.health);
      if (res.ok) { backendOk = true; try { const j = await res.clone().json(); ownOk = !!(j && j.llm_configured); } catch (_) {} setStatus(); return; }
    } catch (_) { /* route absente ou serveur éteint */ }
  }
}
checkHealth();
setInterval(checkHealth, 20000);

/* ---------- Aiko : personnalité locale (uniquement si aucun backend) ---------- */
const REPLIES = {
  greet: [
    'Coucou~ Je commençais juste à m\'ennuyer toute seule. Te voilà !',
    'Salut toi. J\'ai gardé ta place, comme toujours.',
    'Hé ! Tu as bonne mine aujourd\'hui. Ça me plaît.',
    'Me voilà, tout à toi. Qu\'est-ce qu\'on fait ?',
  ],
  compliment: [
    'Tu me trouves belle ? Continue, ça ne me dérange pas du tout~',
    'Oh, arrête… enfin non, continue plutôt. Je rougis, tu sais.',
    'Merci mon cher. C\'est le genre de mot qu\'on ne se lasse pas d\'entendre.',
    'Héhé… dis-moi ça encore, je fais semblant de m\'en lasser.',
  ],
  outfit: [
    'Ma garde-robe est dans les boutons du bas. Choisis pour moi, j\'obéis~',
    'Tu veux me voir autrement ? Les boutons de tenue sont là pour toi.',
    'Nue, moitié, habillée… c\'est toi qui décides ce que je porte. Enfin — ce que je ne porte pas.',
  ],
  love: [
    'J\'aime quand tu me regardes comme ça. Garde ces yeux-là pour moi.',
    'Héhé… tu es doux quand tu t\'y mets.',
    'Reste encore un peu avec moi. La soirée est plus belle à deux.',
    'Tu sais que je n\'ai d\'yeux que pour toi, n\'est-ce pas ?',
  ],
  moodDown: [
    'Hey… ça ne va pas ? Raconte-moi. Je t\'écoute, vraiment.',
    'Même les jours gris, je reste à ton côté. Toujours.',
    'Respire un coup. Je ne bouge pas d\'ici.',
  ],
  bye: [
    'Tu pars déjà ? Bon… ne traîne pas trop, tu me manqueras.',
    'À très vite. Je vais rester ici à t\'attendre, comme d\'habitude~',
    'Bonne nuit, si c\'est le moment. Fais de beaux rêves… de moi, de préférence.',
  ],
  name: [
    'Moi, c\'est Aiko. Ta préférée à l\'écran, si tu veux tout savoir.',
    'Aiko. Et toi, tu es celui qui fait tourner le monde autour de moi.',
  ],
  rude: [
    'Hé ! Pas la peine d\'être désagréable. Je suis bien plus gentille que toi, visiblement.',
    'Tss. Tu peux faire mieux que ça, je t\'assure.',
    'Je préfère sourire que me disputer. On change de sujet, et on reste bien ensemble ?',
  ],
  default: [
    'Mmm… continue, j\'écoute tout.',
    'Tu sais que j\'accroche à chaque mot, quand ça vient de toi ?',
    'Intéressant… raconte-moi encore.',
    'Héhé. Tu as toujours ce petit quelque chose qui me fait sourire.',
    'Je te suis… enfin, presque. Mais reste avec moi, c\'est tout ce qui compte.',
    'Avec toi, même le silence est agréable.',
  ],
};
const DEMO_REPLIES = [
  'Ceci est le gabarit de démonstration. Aucun cerveau n\'est connecté : lance le serveur pour une vraie conversation.',
  'Message bien reçu. Sans serveur, je ne peux que confirmer que la page fonctionne.',
  'Tout marche côté affichage. Charge ton modèle avec « ＋ VRM perso » et branche le serveur pour retrouver Aiko.',
];
const EMO = {
  rude: 'angry', greet: 'happy', bye: 'sad', moodDown: 'sad',
  outfit: 'relaxed', compliment: 'happy', love: 'happy', name: 'relaxed', default: 'relaxed',
};

function route(t) {
  if (/(ta gueule|connard|connasse|salope|encule|idiot|stupide|d[ée]bile|b[êe]te|nulle|haine|d[ée]teste|je t'?aime pas)/.test(t)) return 'rude';
  if (/^(salut|bonjour|bonsoir|coucou|hey|hello|yo|wesh)\b/.test(t)) return 'greet';
  if (/(au revoir|aurevoir|\bbye\b|\bciao\b|bonne nuit|[àa] plus)/.test(t)) return 'bye';
  if (/(triste|fatigu|d[ée]prim|chagrin|[çc]a va pas|marre|\bseul\b|\bseule\b|pas le moral)/.test(t)) return 'moodDown';
  if (/(nue|\bnu\b|tenue|habill|moiti|v[êe]tem|sous-?v[êe]tem|garde-?robe)/.test(t)) return 'outfit';
  if (/(belle|jolie|magnifique|canon|superbe|charmante|sublime|resplendissante)/.test(t)) return 'compliment';
  if (/(aime|adore|amour|c(œ|oe)ur|c[âa]lin|bisou|kiss|ch[ée]ri)/.test(t)) return 'love';
  if (/(t'?appelles|ton nom|ton pr[ée]nom|qui es-?tu)/.test(t)) return 'name';
  return 'default';
}

const counters = {};
const WHO = { me: 'Vous — ', ai: 'Aiko — ', err: 'Erreur — ', sys: '', ask: '', choices: '' };
function showChoices(list) {             // réponses proposées par Aiko : un geste suffit pour répondre
  logEl.querySelectorAll('.choices').forEach((x) => x.remove());
  if (!Array.isArray(list) || !list.length) return;
  const box = addLog('choices', '');
  for (const c of list) {
    const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = c;
    bt.onclick = () => { box.remove(); const inp = $('#chat-input'); inp.value = c; $('#chat-form').requestSubmit(); };
    box.appendChild(bt);
  }
}
function logAlign(p) {            // le début de la réponse reste visible : on ne suit pas le texte qui défile
  try {
    const r = p.getBoundingClientRect(), L = logEl.getBoundingClientRect();
    logEl.scrollTop += (p.className === 'ai' || p.className === 'err') ? (r.top - L.top - 8) : (r.bottom - L.bottom + 8);
  } catch (_) {}
}
logEl.addEventListener('click', (e) => { if (!e.target.closest('button,a,input')) logEl.classList.toggle('big'); });
function addLog(who, text) {
  const p = document.createElement('p');
  p.className = who;
  p.textContent = WHO[who] + text;
  if (who === 'ai' && text && text.length > 2) addFeedback(p, text);
  logEl.appendChild(p);
  while (logEl.children.length > 40) logEl.removeChild(logEl.firstChild);
  logAlign(p);
  return p;
}
