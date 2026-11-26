/* ---------- voix : TTS backend -> voix du navigateur -> lèvres muettes ---------- */
let voiceOn = store.get('aiko.voice', '1') !== '0';
$('#btn-voix').classList.toggle('on', voiceOn);

// Un seul lecteur audio, déverrouillé au premier geste : sans ça iOS/Android
// refusent play() quand il arrive après un fetch (hors geste utilisateur).
const player = new Audio();
let playerURL = null, audioUnlocked = false, silentURL = null;
let speakToken = 0;       // toute nouvelle parole invalide la précédente
const sp = { on: false, token: -1, spoken: 0, sent: '', n: 0, lines: {}, pending: 0, played: false, failed: false };   // file de la parole anticipée
let mouthOn = false, mouthTimer = 0;

function silentWav() {
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    silentURL = silentWav();
    player.src = silentURL;
    const pr = player.play();
    if (pr && pr.then) pr.then(() => { if (player.src === silentURL) player.pause(); }).catch(() => {});
  } catch (_) {}
}
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

// Enveloppe de volume de la phrase en cours : calculée à part, la lecture audio n'est pas modifiée.
let lipEnv = null;
function buildEnvelope(buf, url) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return;
  let ctx;
  try { ctx = new OAC(1, 1, 44100); } catch (_) { return; }
  const ok = (ab) => {
    try {
      const ch = ab.getChannelData(0);
      const step = 0.04, win = Math.max(1, Math.floor(ab.sampleRate * step));
      const n = Math.ceil(ch.length / win), data = new Float32Array(n);
      let peak = 0;
      for (let i = 0; i < n; i++) {
        let sum = 0;
        const a = i * win, b = Math.min(ch.length, a + win);
        for (let j = a; j < b; j++) sum += ch[j] * ch[j];
        data[i] = Math.sqrt(sum / Math.max(1, b - a));
        if (data[i] > peak) peak = data[i];
      }
      if (peak <= 0) return;
      for (let i = 0; i < n; i++) { const v = data[i] / peak; data[i] = v < 0.08 ? 0 : Math.pow(v, 0.7); }
      lipEnv = { url, data, step };
    } catch (_) {}
  };
  try { const pr = ctx.decodeAudioData(buf, ok, () => {}); if (pr && pr.catch) pr.catch(() => {}); } catch (_) {}
}

/* ── Synchro labiale : le texte français devient une suite de visèmes, jouée au rythme de la voix ── */
const LIP_V = ['PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'];
const LIP_GAIN = { aa: 0.6, E: 0.6, I: 0.55, O: 0.68, U: 0.7, PP: 0.95, FF: 0.8, TH: 0.5, DD: 0.45, kk: 0.45, CH: 0.7, SS: 0.55, nn: 0.4, RR: 0.45 };
const LIP_RULES = [   // [motif en début de reste, visèmes, lettres consommées] — du plus long au plus court
  [/^eau/, ['O'], 3], [/^oin/, ['U', 'E'], 3], [/^ain(?![aeiouy])|^ein(?![aeiouy])/, ['E'], 3], [/^ill/, ['I'], 3],
  [/^au/, ['O'], 2], [/^ou/, ['U'], 2], [/^oi/, ['U', 'aa'], 2], [/^ai|^ei/, ['E'], 2],
  [/^[ae][nm](?![aeiouyéèênm])/, ['aa'], 2], [/^o[nm](?![aeiouyéèênm])/, ['O'], 2],
  [/^[iuy][nm](?![aeiouyéèênm])/, ['E'], 2], [/^ch/, ['CH'], 2], [/^ph/, ['FF'], 2], [/^gn/, ['nn'], 2],
  [/^qu/, ['kk'], 2], [/^th/, ['DD'], 2], [/^gu(?=[eiyéèê])/, ['kk'], 2], [/^ss/, ['SS'], 2],
  [/^c(?=[eiyéèê])/, ['SS'], 1], [/^g(?=[eiyéèê])/, ['CH'], 1],
];
const LIP_ONE = { a: 'aa', à: 'aa', â: 'aa', é: 'E', è: 'E', ê: 'E', ë: 'E', e: 'E', i: 'I', î: 'I', ï: 'I', y: 'I', o: 'O', ô: 'O',
  u: 'U', û: 'U', ü: 'U', ù: 'U', œ: 'E', æ: 'E', p: 'PP', b: 'PP', m: 'PP', f: 'FF', v: 'FF', t: 'DD', d: 'DD', n: 'nn', l: 'nn',
  c: 'kk', k: 'kk', q: 'kk', g: 'kk', x: 'kk', s: 'SS', z: 'SS', ç: 'SS', j: 'CH', r: 'RR', w: 'U' };
const LIP_VOWEL = new Set(['aa', 'E', 'I', 'O', 'U']);
function frVisemes(text) {
  const seq = [];
  const re = /[a-zàâäçéèêëîïôöùûüÿœæ]+|[.,;:!?…]/g;
  let m;
  while ((m = re.exec(String(text).toLowerCase()))) {
    const w = m[0], at = m.index;
    if (/^[.!?…]/.test(w)) { seq.push(['sil', 2.6, at]); continue; }
    if (/^[,;:]/.test(w)) { seq.push(['sil', 1.4, at]); continue; }
    let end = w.length;
    while (end > 1 && /[stdxzp]/.test(w[end - 1]) && !(end === 2 && /[aeiouyéèê]/.test(w[0]) === false)) end--;   // consonnes finales muettes
    if (end > 2 && w[end - 1] === 'e') end--;                                                         // e muet final
    for (let i = 0; i < end;) {
      const r = w.slice(i);
      let hit = null;
      for (const R of LIP_RULES) if (R[0].test(r)) { hit = R; break; }
      const vs = hit ? hit[1] : (LIP_ONE[r[0]] ? [LIP_ONE[r[0]]] : []);
      for (const v of vs) {
        const prev = seq[seq.length - 1];
        if (prev && prev[0] === v && !LIP_VOWEL.has(v)) { prev[1] += 0.25; continue; }   // « mm », « tt »… : une seule fermeture
        seq.push([v, LIP_VOWEL.has(v) ? 1 : (v === 'PP' ? 0.62 : 0.55), at + i]);
      }
      i += hit ? hit[2] : 1;
    }
  }
  return seq;
}
const lip = { seq: null, starts: null, total: 0, t0: 0, on: false, src: 'tts', rate: 11, cur: {}, paused: 0, active: 0, segT: 0 };
let lipRates = {};
try { lipRates = JSON.parse(localStorage.getItem('aiko.lipRate') || '{}') || {}; } catch (_) {}
LIP_V.forEach((v) => { lip.cur[v] = 0; });
function lipPrep(text, src) {
  lip.seq = frVisemes(text);
  lip.starts = []; let t = 0;
  for (const e of lip.seq) { lip.starts.push(t); t += e[1]; }
  lip.total = t; lip.on = false; lip.src = src; lip.rate = lipRates[src] || 11.5;
  lip.paused = 0; lip.active = 0;
}
function lipGo(dur) {
  if (!lip.seq || !lip.seq.length) return;
  if (lip.on) return;
  if (dur && isFinite(dur) && dur > 0.4) lip.rate = lip.total / dur;   // durée réelle connue (fichier audio) : calage exact
  const now = performance.now();
  lip.t0 = now - (lip.paused / lip.rate) * 1000;     // reprend là où la voix s'était arrêtée (réponse en plusieurs morceaux)
  lip.segT = now; lip.on = true;
}
function lipPause() {
  if (!lip.on) return;
  const now = performance.now();
  lip.paused = (now - lip.t0) / 1000 * lip.rate; lip.active += now - lip.segT; lip.on = false;
}
function lipSync(ci) {   // voix du navigateur : recalage à chaque mot prononcé
  if (!lip.on || !lip.seq) return;
  const k = lip.seq.findIndex((e) => e[2] >= ci);
  if (k >= 0) lip.t0 = performance.now() - (lip.starts[k] / lip.rate) * 1000;
}
function lipEnd(learn) {
  lipPause();
  if (learn && lip.src !== 'audio' && lip.total > 4) {   // apprend la vitesse réelle de cette voix pour la prochaine phrase
    const dur = lip.active / 1000;
    if (dur > 0.8) {
      const r = Math.max(6, Math.min(20, lip.total / dur));
      lipRates[lip.src] = lipRates[lip.src] ? lipRates[lip.src] * 0.6 + r * 0.4 : r;
      try { localStorage.setItem('aiko.lipRate', JSON.stringify(lipRates)); } catch (_) {}
    }
  }
  lip.paused = 0; lip.active = 0;
}
function lipTargets(tNow) {
  const T = {};
  const add = (v, w) => { if (v !== 'sil') T[v] = Math.max(T[v] || 0, w * LIP_GAIN[v]); };
  const pos = lip.on ? (performance.now() - lip.t0) / 1000 * lip.rate : -1;
  if (pos < 0 || pos >= lip.total) {      // pas de texte calé (ou voix plus lente que prévu) : mouvement rythmé doux
    const p = tNow * 9;
    add('aa', 0.25 + 0.25 * Math.max(0, Math.sin(p))); add('O', 0.2 * Math.max(0, Math.sin(p * 0.63 + 1.7)));
    if (Math.sin(p * 0.37) > 0.85) add('PP', 0.8);
    return T;
  }
  let lo = 0, hi = lip.seq.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lip.starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  const e = lip.seq[lo], f = (pos - lip.starts[lo]) / e[1], nx = lip.seq[lo + 1];
  const b = f > 0.6 && nx ? (f - 0.6) / 0.4 * 0.55 : 0;      // coarticulation : on anticipe le son suivant
  add(e[0], 1 - b);
  if (b) add(nx[0], b);
  return T;
}
function setVisemes() {
  if (vrm && vrm.isGlb) { for (const v of LIP_V) setExpr('v_' + v, lip.cur[v]); return; }
  const c = lip.cur, cons = (c.PP + c.FF + c.DD + c.kk + c.SS + c.nn + c.RR + c.CH + c.TH) * 0.25;   // avatar VRM : 5 voyelles seulement
  setExpr('aa', Math.min(1, c.aa + cons)); setExpr('ee', c.E); setExpr('ih', c.I); setExpr('oh', c.O); setExpr('ou', c.U);
}

function mouthFor(ms) {
  mouthOn = true;
  clearTimeout(mouthTimer);
  mouthTimer = setTimeout(() => { mouthOn = false; }, ms);
}
function stopSpeech() {
  speakToken++;
  mouthOn = false;
  clearTimeout(mouthTimer);
  try { player.pause(); } catch (_) {}
  if (playerURL) { URL.revokeObjectURL(playerURL); playerURL = null; }
  lipEnv = null;
  lip.on = false;
  sp.on = false;
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
  try { if (cap.tts) cap.tts.stop(); } catch (_) {}
}

async function playB64(b64, mime, token) {
  let url;
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    url = URL.createObjectURL(new Blob([bytes], { type: mime || 'audio/mpeg' }));
    buildEnvelope(bytes.buffer.slice(0), url);
  } catch (_) { return false; }
  playerURL = url;
  // On vérifie que l'évènement concerne bien CE son (pas le son de déverrouillage ni une phrase précédente).
  const mine = () => token === speakToken && playerURL === url;
  const done = () => { if (mine()) { mouthOn = false; clearTimeout(mouthTimer); } };
  player.onplaying = () => { if (mine()) { clearTimeout(mouthTimer); mouthOn = true; lip.src = 'audio'; lipGo(player.duration); } };  // bouche calée sur l'audio réel
  player.onended = () => { if (player.ended) done(); };
  player.onerror = done;
  player.src = url;
  try { await player.play(); return true; }
  catch (_) { return false; }
}

function speakLocal(text, token, est) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { mouthFor(Math.min(est, 2500)); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.02;
    u.pitch = 1.15;
    const vs = synth.getVoices().filter((v) => /^fr/i.test(v.lang || ''));
    if (vs.length) u.voice = vs.find((v) => /fem|denise|julie|c[ée]line|am[ée]lie|audrey|charlotte|lo[iï]s|marie/i.test(v.name)) || vs[0];
    const end = () => { if (token === speakToken) { lipEnd(true); mouthOn = false; clearTimeout(mouthTimer); } };
    u.onstart = () => { if (token === speakToken) { mouthFor(est + 4000); lipGo(); } };
    u.onboundary = (ev) => { if (token === speakToken && ev && ev.name !== 'sentence') lipSync(ev.charIndex || 0); };
    u.onend = end;
    u.onerror = () => { if (token === speakToken) mouthFor(Math.min(est, 2500)); };   // pas de voix dispo : lèvres seules
    mouthFor(est);            // filet de sécurité si onstart/onend ne se déclenchent pas
    synth.speak(u);
  } catch (_) { mouthFor(Math.min(est, 2500)); }
}

/* ── Parole anticipée : Aiko commence à parler dès sa première phrase écrite, la suite est mise en file ──
   Seulement pour une réponse en direct ; si rien n'a pu être dit, on retombe sur speak() comme avant. */
function streamBegin() {
  Object.assign(sp, { on: !!voiceOn && !backendOk && (cap.tts ? typeof cap.tts.add === 'function' : !!window.speechSynthesis), token: speakToken, spoken: 0, sent: '', n: 0, lines: {}, pending: 0, played: false, failed: false });
}
function streamSay(chunk) {
  const id = 'c' + (sp.n++), token = sp.token;
  sp.lines[id] = chunk; sp.pending++;
  if (cap.tts) {
    const call = sp.n === 1 ? cap.tts.speak : cap.tts.add;
    call([{ text: chunk.slice(0, 2000), id }], { voice: 'airy', language: 'fr' })
      .then(() => { sp.pending--; })
      .catch((e) => { sp.pending--; if (token !== speakToken) return; const c = e && e.code; if (c === 'not_granted') cap.tts = null; if (c !== 'stopped') sp.failed = true; });
    return;
  }
  const synth = window.speechSynthesis;
  try {
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = 'fr-FR'; u.rate = 1.02; u.pitch = 1.15;
    const vs = synth.getVoices().filter((v) => /^fr/i.test(v.lang || ''));
    if (vs.length) u.voice = vs.find((v) => /fem|denise|julie|c[ée]line|am[ée]lie|audrey|charlotte|lo[iï]s|marie/i.test(v.name)) || vs[0];
    const est = clamp(chunk.length * 65, 1200, 12000);
    u.onstart = () => { if (token !== speakToken) return; sp.played = true; lipPrep(chunk, 'local'); lipGo(); mouthFor(est + 4000); };
    u.onboundary = (ev) => { if (token === speakToken && ev && ev.name !== 'sentence') lipSync(ev.charIndex || 0); };
    u.onend = () => { sp.pending--; if (token !== speakToken) return; lipEnd(true); if (!sp.pending && !sp.on) { mouthOn = false; clearTimeout(mouthTimer); } };
    u.onerror = () => { sp.pending--; if (token === speakToken) sp.failed = true; };
    synth.speak(u);                                   // la voix du navigateur met les phrases en file d'elle-même
  } catch (_) { sp.pending--; sp.failed = true; }
}
function streamFeed(vis, final) {
  if (!sp.on || sp.token !== speakToken || sp.failed) return;
  vis = String(vis || '');
  if (!vis.startsWith(sp.sent)) { sp.spoken = 0; sp.sent = ''; }       // nouvelle réponse (après un outil) : on repart de son début
  const rest = vis.slice(sp.spoken);
  let cut = -1;
  if (final) cut = rest.length;
  else {
    const re = /[.!?…]+["»)]?(?=\s)/g; let m;
    while ((m = re.exec(rest))) { const end = m.index + m[0].length; if (sp.n === 0 || end >= 80) { cut = end; if (sp.n === 0) break; } }
  }
  if (cut <= 0) return;
  const chunk = rest.slice(0, cut).trim();
  sp.spoken += cut; sp.sent = vis.slice(0, sp.spoken);
  if (chunk) streamSay(chunk);
}
function streamEnd(reply) {            // fin de la réponse : dit le reste ; si rien n'a pu être dit, voix classique
  if (!sp.on || sp.token !== speakToken) { speak(reply); return; }
  streamFeed(reply, true);
  sp.on = false;
  if (sp.failed && !sp.played) { speak(reply); return; }
  if (!cap.tts && !sp.pending) { mouthOn = false; clearTimeout(mouthTimer); }
}

async function speak(text) {
  if (!text) return;
  stopSpeech();
  const token = speakToken;
  const est = clamp(text.length * 65, 1500, 12000);
  lipPrep(text, cap.tts && voiceOn ? 'tts' : 'local');
  if (!voiceOn) { mouthFor(Math.min(est, 2500)); return; }
  if (cap.tts) {
    try {
      mouthFor(est + 6000);                       // filet : l'état « speaking/idle » prend le relais
      await cap.tts.speak(text.slice(0, 2000), { voice: 'airy', language: 'fr' });
      if (token === speakToken) lipEnd(true);
      if (token === speakToken) { mouthOn = false; clearTimeout(mouthTimer); }
      return;
    } catch (e) {
      if (token !== speakToken) return;
      mouthOn = false; clearTimeout(mouthTimer);
      const code = e && e.code;
      if (code === 'not_granted') cap.tts = null;
      else if (code !== 'unavailable' && code !== 'capability_disabled') return;   // arrêtée, occupée, limitée : on se tait
    }
  }
  if (backendOk) {
    try {
      const res = await fetchT(BACKEND.speak, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }, TIMEOUT.speak);
      if (token !== speakToken) return;
      if (res.ok) {
        const data = await res.json();
        if (token !== speakToken) return;
        if (data && data.audio && await playB64(data.audio, data.mime, token)) return;
      }
    } catch (_) { /* repli ci-dessous */ }
    if (token !== speakToken) return;
  }
  speakLocal(text, token, est);
}

$('#btn-voix').addEventListener('click', () => {
  voiceOn = !voiceOn;
  store.set('aiko.voice', voiceOn ? '1' : '0');
  $('#btn-voix').classList.toggle('on', voiceOn);
  showToast(voiceOn ? 'Voix : activée' : 'Voix : coupée');
  if (!voiceOn) stopSpeech();
});
