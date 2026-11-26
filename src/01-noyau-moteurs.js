window.AIKO_STARTED = true;
// Bibliothèques 3D livrées avec la page (plus de dépendance à un site extérieur)
import { THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils, VRMHumanoid, MeshoptDecoder, RoomEnvironment } from './aiko-3d.js';

/* ================= CONFIGURATION ================= */
// Ton propre modèle : dépose-le à cet emplacement. '' = toujours le modèle de démo pixiv.
// Si ce fichier est introuvable, la page retombe sur le modèle de démo.
const LOCAL_VRM_URL = '';
const DEMO_VRM_URL = './sample.glb';

// Contrat backend, repris de ton index.html 2D d'origine.
const BACKEND = {
  brain: '/api/brain/chat',                      // POST {message, persona, memories, look, pose, session} -> {reply, memories?, look?, pose?, expression?}
  brainStream: '/api/brain/chat/stream',         // même contrat, réponse au fil de l'eau (SSE) ; repli automatique sur brain
  speak: '/api/voice/speak',                     // POST {text} -> {audio: "<base64>", mime?}
  health: [],   // GET -> 200 = backend vivant (la 1re route qui répond gagne)
  life: '/api/brain/life/tick',                  // POST {session} -> {text|null, expression?, pose?} : elle parle d'elle-même
};
// Serveur perso (cerveau libre) : ?server=https://mon-serveur ou mémorisé. Vide = même origine.
let SERVER = '';
try { SERVER = (new URLSearchParams(location.search).get('server') || localStorage.getItem('aiko.server') || '').replace(/\/$/, ''); if (new URLSearchParams(location.search).get('server')) localStorage.setItem('aiko.server', SERVER); } catch (_) {}
if (SERVER) for (const k of ['brain', 'brainStream', 'speak', 'life']) BACKEND[k] = SERVER + BACKEND[k];
BACKEND.health = [SERVER + '/api/health'];
try { if ('serviceWorker' in navigator && !SERVER && /^(https:|http:\/\/(localhost|127\.))/.test(location.href) && !/claude\.(ai|com)|claudeusercontent/.test(location.host) && location.host !== 'appassets.androidplatform.net') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (_) {}
let ownOk = false;     // le serveur perso a un modèle configuré
// ---- Cerveau DIRECT : dans l'appli téléphone (ou sans serveur), la page parle elle-même à un modèle compatible OpenAI ----
const DIRECT_DEFAULT = { url: 'https://text.pollinations.ai/openai', model: 'openai', key: '' };   // sans clé, limité en débit ; réglable via 🧠
const IN_APP = location.host === 'appassets.androidplatform.net';
function directCfg() { let c = null; try { c = JSON.parse(localStorage.getItem('aiko.direct')); } catch (_) {} return Object.assign({}, DIRECT_DEFAULT, c && typeof c === 'object' ? c : {}); }
let DIRECT = IN_APP || /\.github\.io$/.test(location.host); try { if (localStorage.getItem('aiko.directOn') === '1') DIRECT = true; } catch (_) {}
// Secours sans clé : l'ancienne adresse simple de Pollinations (GET), avec un contexte raccourci.
async function directFallbackGet(msgs) {
  const sys = String(msgs[0].content || '').replace(/\s+/g, ' ').slice(0, 2200) + ' Termine toujours par [expr:happy], [expr:sad], [expr:angry], [expr:surprised], [expr:relaxed] ou [expr:neutral].';
  const turns = msgs.slice(2).slice(-7).map((m) => (m.role === 'assistant' ? 'Aiko : ' : 'Lui : ') + String(m.content || '').replace(/\s+/g, ' ').slice(0, 500)).join('\n');
  const prompt = (turns + '\nAiko :').slice(-2600);
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai&system=' + encodeURIComponent(sys), { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = (await r.text()).trim();
    if (!text || /^\s*[{<]/.test(text)) throw new Error('réponse inattendue');
    return text;
  } finally { clearTimeout(t); }
}
// ======================= CERVEAU D'AIKO — LEXA : routage entre plusieurs moteurs =======================
// Chaque moteur est noté sur ses vrais résultats (réussites, échecs, temps de réponse). Lexa essaie le meilleur,
// passe au suivant s'il échoue, et met en pause un moteur qui échoue 3 fois de suite.
const BRAIN_KEY = 'aiko.brain';
function brainState() { let b = null; try { b = JSON.parse(localStorage.getItem(BRAIN_KEY)); } catch (_) {} b = b && typeof b === 'object' ? b : {};
  for (const k of ['eng', 'dom', 'sat', 'guard']) if (!b[k] || typeof b[k] !== 'object') b[k] = {};
  if (!Array.isArray(b.missions)) b.missions = []; if (!Array.isArray(b.guard.log)) b.guard.log = []; b.guard.n = b.guard.n || 0; b.turns = b.turns || 0; return b; }
function brainSave(b) { try { localStorage.setItem(BRAIN_KEY, JSON.stringify(b)); } catch (_) {} }
function engineList() {
  const c = directCfg(), L = [];
  const custom = !(c.url === DIRECT_DEFAULT.url && !c.key && c.model === DIRECT_DEFAULT.model);
  if (custom) L.push({ id: 'perso', name: 'Ton moteur (' + (c.model || '?') + ')', url: c.url, model: c.model, key: c.key, pref: true });
  L.push({ id: 'pol-openai', name: 'Pollinations · openai', url: DIRECT_DEFAULT.url, model: 'openai', key: '' });
  L.push({ id: 'pol-mistral', name: 'Pollinations · mistral', url: DIRECT_DEFAULT.url, model: 'mistral', key: '' });
  L.push({ id: 'pol-get', name: 'Pollinations · secours', get: true });
  return L;
}
function engineScore(st) { if (!st) return 0.5; const n = (st.ok || 0) + (st.fail || 0); const rate = n ? (st.ok || 0) / n : 0.5; const ms = st.ms || 8000; return rate - Math.min(0.3, ms / 60000); }
function engineOrder(b) {
  const now = Date.now();
  return engineList().map((e) => ({ e, st: b.eng[e.id] || {} }))
    .filter((x) => !(x.st.until > now))
    .sort((a, c) => (c.e.pref ? 1 : 0) - (a.e.pref ? 1 : 0) || engineScore(c.st) - engineScore(a.st)).map((x) => x.e);
}
function engineNote(id, ok, ms, err, rateLimited) {
  const b = brainState(), st = b.eng[id] = b.eng[id] || { ok: 0, fail: 0, ms: 0, streak: 0 };
  if (ok) { st.ok++; st.ms = st.ms ? Math.round(st.ms * 0.7 + ms * 0.3) : ms; st.streak = 0; st.until = 0; st.err = ''; }
  else { st.fail++; st.streak = (st.streak || 0) + 1; st.err = String(err || '').slice(0, 120);
    if (rateLimited) st.until = Date.now() + 20000; else if (st.streak >= 3) st.until = Date.now() + 180000; }
  st.last = Date.now(); b.lastEngine = ok ? id : b.lastEngine; brainSave(b);
}
// Une seule demande à la fois vers les moteurs (chat, mission, étude ne se marchent plus dessus) ; si tous sont saturés
// (429), elle patiente jusqu'à la fin de la pause et réessaie une fois, au lieu d'échouer.
let _brainQ = Promise.resolve();
function directSample(msgs, opts) { const run = _brainQ.then(() => directSampleRun(msgs, opts)); _brainQ = run.catch(() => {}); return run; }
async function directSampleRun(msgs, opts) {
  const errs = [];
  for (let round = 0; round < 2; round++) {
    let order = engineOrder(brainState());
    if (!order.length || round) {
      const b = brainState(), now = Date.now();
      const rl = engineList().filter((e) => { const u = (b.eng[e.id] || {}).until || 0; return u > now && u - now <= 25000; });   // pauses courtes = saturation
      if (!rl.length) { if (!order.length && !round) throw new Error('tous mes moteurs sont en pause après plusieurs échecs ; réessaie dans quelques minutes ou ajoute ton moteur dans 👗 › Réglages › 🧠'); break; }
      const wait = Math.min(Math.max(...rl.map((e) => b.eng[e.id].until)) - now + 300, window.__rlMax ?? 22000);
      try { showToast('Moteur saturé : je patiente ' + Math.ceil(wait / 1000) + ' s…'); } catch (_) {}
      await new Promise((r) => setTimeout(r, wait));
      const b2 = brainState(); rl.forEach((e) => { if (b2.eng[e.id]) b2.eng[e.id].until = 0; }); brainSave(b2);
      order = engineOrder(b2);
    }
    let limited = false;
    for (const e of order) {
      const t0 = Date.now();
      try {
        let out;
        if (e.get) { const text = await directFallbackGet(msgs); if (opts && opts.onText) opts.onText({ text }); out = { text }; }
        else out = await directPost(e, msgs, opts);
        engineNote(e.id, true, Date.now() - t0);
        out.engine = e.id; out.text = guardOutput(out.text); return out;
      } catch (err) {
        const m = String(err && err.message || err), rlim = /429/.test(m); limited = limited || rlim;
        engineNote(e.id, false, Date.now() - t0, m, rlim); errs.push(e.name + ' : ' + m.slice(0, 80));
      }
    }
    if (!limited) break;
  }
  throw new Error('aucun de mes moteurs ne répond (' + errs.slice(-3).join(' · ') + '). Vérifie la connexion, ou ajoute ton moteur dans 👗 › Réglages › 🧠');
}
async function directPost(c, msgs, opts) {
  const chat = msgs.map((m, i) => ({ role: i === 0 ? 'system' : m.role, content: m.content }));
  const headers = { 'Content-Type': 'application/json' };
  if (c.key) headers.Authorization = 'Bearer ' + c.key;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  let res;
  try { res = await fetch(c.url.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers, signal: ctl.signal, body: JSON.stringify({ model: c.model, messages: chat, temperature: 0.8, max_tokens: (opts && opts.maxTokens) || 600 }) }); }
  catch (e) { throw new Error(e && e.name === 'AbortError' ? 'le modèle met trop de temps à répondre' : 'pas de connexion à Internet, ou modèle injoignable (' + c.url.replace(/^https?:\/\//, '').split('/')[0] + ')'); }
  finally { clearTimeout(t); }
  if (!res.ok) { let d = ''; try { d = (await res.text()).slice(0, 160); } catch (_) {} throw new Error('le modèle a répondu HTTP ' + res.status + (d ? ' : ' + d : '') + (res.status === 429 ? ' (trop de demandes : attends un peu ou ajoute une clé dans 🧠)' : '')); }
  let text = ''; try { const j = await res.json(); text = String(j.choices[0].message.content || ''); } catch (_) { throw new Error('réponse du modèle illisible'); }
  if (!text.trim()) throw new Error('réponse du modèle vide');
  if (opts && opts.onText) opts.onText({ text });
  return { text };
}
async function ownSample(msgs, opts) {
  if (DIRECT) return directSample(msgs, opts);
  const res = await fetch(SERVER + '/api/brain/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, search: true }) });
  if (!res.ok) { let d = ''; try { d = (await res.json()).detail; } catch (_) {} const e = new Error(d || ('HTTP ' + res.status)); throw e; }
  const j = await res.json(); const text = String(j.text || '');
  if (opts && opts.onText) opts.onText({ text });
  return { text };
}
const LIFE_POLL_MS = 30000;   // fréquence à laquelle la page demande « as-tu quelque chose à dire ? »
const TIMEOUT = { brain: 25000, brainUnknown: 6000, speak: 15000, health: 4000 };
const PRESETS = ['happy', 'angry', 'sad', 'surprised', 'relaxed', 'neutral'];
/* ================================================= */

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const stage = $('#stage');
const logEl = $('#log');
const toastEl = $('#toast');
const loaderEl = $('#loader');
const loaderMsg = $('#loader-msg');
const loaderRetry = $('#loader-retry');

/* ---------- stockage local (jamais bloquant) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  json(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch (_) { return d; } },
};
function uuid() {
  // crypto.randomUUID n'existe qu'en HTTPS/localhost : repli pour les tests en http://192.168.x.x
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}
const cap = { sample: null, tts: null, dict: null, doc: null };
let session = store.get('aiko.session', '');
if (!session) { session = uuid(); store.set('aiko.session', session); }
let memories = store.json('aiko.memories', []);
if (!Array.isArray(memories)) memories = [];
