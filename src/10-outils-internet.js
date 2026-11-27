/* ── Connecteurs de la personne (Google Agenda, Drive, Gmail, Notion, Base44…) : Aiko s'en sert pour répondre ──
   Elle écrit [outil: Serveur | outil | {arguments JSON}] ; la page exécute avec ses droits et lui rend le résultat.
   Toute action qui modifie quelque chose (créer, envoyer, supprimer…) attend d'abord son accord. */
const TOOLS = { mcp: null, list: [], schemas: { 'Web|recherche': 'q*', 'Web|lire': 'url*' } };
// ---- Ses propres outils Internet (hors de Claude) : recherche (Wikipédia + DuckDuckGo) et lecture de pages ----
const WEB_OK = !/claude\.(ai|com)|claudeusercontent/.test(location.host);
function webTools() { return WEB_OK ? [
  { server: 'Web', name: 'recherche', desc: 'chercher sur internet (faits, définitions, personnes, lieux, sujets d\'actualité)', ro: true, builtin: true },
  { server: 'Web', name: 'lire', desc: 'lire le texte d\'une page web précise (url)', ro: true, builtin: true } ] : []; }
TOOLS.list = webTools().concat(codeTools());
async function webJSON(u, ms) { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 12000); try { const r = await fetch(u, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
async function webSearch(q) {
  q = String(q || '').trim().slice(0, 200); if (!q) return 'Requête vide.';
  if (!WEB_OK) {
    const t = TOOLS.mcp && TOOLS.list.find((x) => /^web_search$/i.test(x.name));
    if (!t) return 'Aucun résultat trouvé pour « ' + q + ' » (pas d\'accès web ici).';
    try { const sc = String(TOOLS.schemas[t.server + '|' + t.name] || ''); const args = /search_queries|objective/.test(sc) ? { objective: q, search_queries: [q] } : { query: q }; const r = await TOOLS.mcp.callTool(t.server, t.name, args); let o = r && r.payload !== undefined ? r.payload : r && r.content; o = typeof o === 'string' ? o : JSON.stringify(o); return o.slice(0, 6000); } catch (_) { return 'Aucun résultat trouvé pour « ' + q + ' ».'; }
  }
  const out = [], e = encodeURIComponent(q);
  for (const lang of ['fr', 'en']) {
    try {
      const s = await webJSON('https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + e + '&srlimit=3&format=json&origin=*');
      const titles = ((s.query && s.query.search) || []).map((x) => x.title); if (!titles.length) continue;
      const x = await webJSON('https://' + lang + '.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&exchars=900&redirects=1&titles=' + encodeURIComponent(titles.join('|')) + '&format=json&origin=*');
      for (const p of Object.values((x.query && x.query.pages) || {})) if (p.extract) out.push('• ' + p.title + ' : ' + p.extract.replace(/\s+/g, ' ').trim() + ' (source : https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')) + ')');
      if (out.length) break;
    } catch (_) {}
  }
  try { const d = await webJSON('https://api.duckduckgo.com/?q=' + e + '&format=json&no_html=1&skip_disambig=1', 8000);
    if (d && d.AbstractText) out.unshift('• ' + (d.Heading || q) + ' : ' + d.AbstractText + (d.AbstractURL ? ' (source : ' + d.AbstractURL + ')' : '')); } catch (_) {}
  const web = await webPages(q); if (web.length) out.push('Pages web :', ...web);   // VRAIE recherche de pages (actualité, prix, sujets précis) en plus de Wikipédia
  const txt = out.length ? out.join('\n') : 'Aucun résultat trouvé pour « ' + q + ' ». Dis-le honnêtement, n\'invente pas.';
  if (INJECT_RE.test(txt)) guardLog('web', 'consignes cachées dans un résultat de recherche');
  return txt.slice(0, 6000);
}
/* Recherche de PAGES web : avec ta clé Jina → recherche Jina (s.jina.ai) ; sans clé → la page de résultats de DuckDuckGo, lue à travers le lecteur Jina (r.jina.ai, gratuit) */
function ddgParse(md) {   // la même adresse revient plusieurs fois (titre, domaine, extrait — l'extrait est lui-même un lien) : on regroupe par adresse
  const re = /\[([^\]]{2,400})\]\((https?:\/\/[^)\s]+)\)/g, order = [], by = new Map(); let m;
  while ((m = re.exec(md))) {
    let url = m[2]; const u = /[?&]uddg=([^&]+)/.exec(url); if (u) { try { url = decodeURIComponent(u[1]); } catch (_) {} }   // redirection DuckDuckGo → vraie adresse
    if (/duckduckgo\.com|duck\.co/i.test(url) || /\.(png|jpe?g|gif|svg|ico|webp)(\?|$)/i.test(url)) continue;
    const t = m[1].replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim(); if (t.length < 2) continue;
    const k = url.replace(/#.*$/, ''); if (!by.has(k)) { by.set(k, []); order.push(k); } by.get(k).push(t);
  }
  const dom = /^(www\.)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;
  return order.slice(0, 6).map((k) => { const all = by.get(k), ts = all.filter((t) => !dom.test(t)); const t = ts[0] || all[0];
    const snip = ts.slice(1).sort((a, b) => b.length - a.length)[0] || ''; return { t: t.slice(0, 160), url: k, snip: snip.slice(0, 240) }; });
}
async function webPages(q) {
  const e = encodeURIComponent(q); let key = ''; try { key = localStorage.getItem('aiko.jinakey') || ''; } catch (_) {}
  const fmt = (r) => '• ' + r.t + (r.snip ? ' : ' + r.snip : '') + ' (source : ' + r.url + ')';
  if (key) { try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch('https://s.jina.ai/?q=' + e, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json', 'X-Respond-With': 'no-content' }, signal: ctl.signal }); clearTimeout(tm);
      if (r.ok) { const j = await r.json(); const L = ((j && j.data) || []).slice(0, 6).map((x) => ({ t: String(x.title || x.url || '').slice(0, 160), url: x.url, snip: String(x.description || x.content || '').replace(/\s+/g, ' ').slice(0, 240) })).filter((x) => x.url);
        if (L.length) return L.map(fmt); } } catch (_) {} }
  try { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch('https://r.jina.ai/https://html.duckduckgo.com/html/?q=' + e, { signal: ctl.signal, headers: key ? { Authorization: 'Bearer ' + key } : {} }); clearTimeout(tm);
    if (r.ok) return ddgParse(await r.text()).map(fmt); } catch (_) {}
  return [];
}
async function webRead(url) {
  url = String(url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  for (const u of ['https://r.jina.ai/' + url, url]) {
    try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(u, { signal: ctl.signal }); clearTimeout(t); if (!r.ok) continue;
      let txt = await r.text(); if (/<html/i.test(txt)) txt = txt.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
      txt = txt.replace(/\s+/g, ' ').trim(); if (txt.length < 40) continue;
      if (INJECT_RE.test(txt)) guardLog('web', 'consignes cachées dans ' + url.slice(0, 60));
      return txt.slice(0, 7000);
    } catch (_) {}
  }
  return 'Je n\'arrive pas à lire cette page depuis le navigateur (' + url + ').';
}
async function runWebTool(tc) {
  const note = addLog('sys', '↻ ' + (tc.tool === 'lire' ? 'je lis la page…' : 'je cherche sur internet : ' + String((tc.input || {}).q || '').slice(0, 60) + '…'));
  const out = tc.tool === 'lire' ? await webRead((tc.input || {}).url) : await webSearch((tc.input || {}).q || (tc.input || {}).query);
  note.textContent = '✓ ' + (tc.tool === 'lire' ? 'page lue' : 'recherche faite');
  return out;
}
const TOOL_READ = /^(web_search|web_fetch|web_|list|search|get|read|query|fetch|download|suggest|find|notion-search|notion-fetch|notion-get|notion-query)/i;
async function toolsRefresh() {
  if (!TOOLS.mcp) return;
  try {
    const r = await TOOLS.mcp.listTools();
    TOOLS.list = webTools().concat(codeTools());
    for (const sv of (r && r.servers) || []) {
      if (sv.kind === 'artifact') continue;
      for (const t of sv.tools || []) {
        const ro = t.annotations && typeof t.annotations.readOnlyHint === 'boolean' ? t.annotations.readOnlyHint : TOOL_READ.test(t.name);
        TOOLS.list.push({ server: sv.server, name: t.name, desc: (t.description || '').split('\n')[0].slice(0, 140), ro, status: sv.authStatus });
        const key = sv.server + '|' + t.name;
        if (!TOOLS.schemas[key]) TOOLS.mcp.describeTool(sv.server, t.name).then((d) => {
          const props = d && d.inputSchema && d.inputSchema.properties ? d.inputSchema.properties : null;
          if (props) TOOLS.schemas[key] = Object.keys(props).slice(0, 12).map((k) => k + ((d.inputSchema.required || []).includes(k) ? '*' : '')).join(', ');
        }).catch(() => {});
      }
    }
  } catch (_) { /* pas de connecteurs : Aiko fait sans */ }
}
function toolsPrompt() {
  if (!TOOLS.list.length) return '';
  const lines = TOOLS.list.map((t) => '- ' + t.server + ' | ' + t.name + (TOOLS.schemas[t.server + '|' + t.name] ? ' (arguments : ' + TOOLS.schemas[t.server + '|' + t.name] + ')' : '') + (t.desc ? ' — ' + t.desc : '') + (t.ro ? '' : ' [modifie : la personne doit valider]'));
  return '\n\nTu as accès à Internet (Web | recherche, Web | lire) et, si branchés, à ses applications. Quand sa demande en a besoin (son agenda, ses mails, ses fichiers, ses notes Notion, ses apps Base44…), '
    + 'réponds UNIQUEMENT par une balise [outil: Serveur | nom_outil | {arguments en JSON}] et rien d\'autre ; tu recevras le résultat, puis tu lui répondras. '
    + 'Tu peux mettre avant cette balise tes balises note, tache, rappel ou souvenir. '
    + 'Pour un calcul, un code à écrire ou à vérifier, un traitement de données : écris le code et LANCE-le dans ton bac à essai (Code | executer) avant d\'affirmer que ça marche ; si une erreur revient, corrige et relance. '
    + (TOOLS.list.some((t) => t.server === 'Google Calendar' && t.name === 'create_event') ? 'Quand tu programmes un rappel, crée aussi l\'événement correspondant dans son agenda avec Google Calendar | create_event (à l\'heure du rappel, 10 minutes, avec une notification) pour que son téléphone le prévienne même page fermée ; elle validera. ' : '')
    + 'Un outil à la fois, 3 au maximum par demande (6 quand tu corriges du code). N\'invente jamais un résultat. Arguments marqués * obligatoires. Dates au format ISO.\nOutils :\n' + lines.join('\n');
}
function parseTool(txt) {
  const i = String(txt || '').indexOf('[outil:');
  if (i < 0) return null;
  const body = txt.slice(i + 7);
  const a = body.indexOf('|'), b = a < 0 ? -1 : body.indexOf('|', a + 1);
  if (b < 0) return null;
  const server = body.slice(0, a).trim(), tool = body.slice(a + 1, b).trim();
  let j = body.indexOf('{', b), depth = 0, end = -1, inStr = false;
  if (j >= 0) for (let k = j; k < body.length; k++) {
    const c = body[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { end = k; break; } }
  }
  let input = {};
  if (j >= 0 && end > j) { try { input = JSON.parse(body.slice(j, end + 1)); } catch (_) { return { server, tool, bad: true }; } }
  return { server, tool, input };
}
function askUser(label) {          // la personne valide (ou refuse) une action qui modifie ses données
  return new Promise((res) => {
    const p = addLog('ask', 'Aiko veut : ' + label + ' ');
    const ok = document.createElement('button'), no = document.createElement('button');
    ok.textContent = 'Autoriser'; no.textContent = 'Refuser';
    const done = (v) => { ok.remove(); no.remove(); p.textContent += v ? ' — autorisé' : ' — refusé'; res(v); };
    ok.onclick = () => done(true); no.onclick = () => done(false);
    p.append(ok, no);
    setTimeout(() => { if (ok.isConnected) done(false); }, 120000);
  });
}
// Validation commune des arguments, AVANT tout effet de bord (chat, outils Web, connecteurs) : refuse extras, manquants, mauvais types.
function validateToolArgs(tc, def) {
  const inp = tc.input === undefined ? {} : tc.input;
  if (!inp || typeof inp !== 'object' || Array.isArray(inp)) return 'les arguments doivent être un objet JSON';
  const sch = TOOLS.schemas[tc.server + '|' + tc.tool];
  if (typeof sch !== 'string') return null;                         // schéma pas encore connu : le connecteur valide lui-même
  const keys = sch.split(',').map((x) => x.trim()).filter(Boolean), req = keys.filter((k) => k.endsWith('*')).map((k) => k.slice(0, -1)), all = keys.map((k) => k.replace(/\*$/, ''));
  for (const r of req) if (inp[r] === undefined || inp[r] === null || inp[r] === '') return 'argument obligatoire manquant : ' + r;
  if (def && def.builtin) {
    for (const k of Object.keys(inp)) if (!all.includes(k)) return 'argument inconnu : ' + k;
    for (const k of all) if (inp[k] !== undefined && typeof inp[k] !== 'string') return 'type incorrect pour ' + k + ' (texte attendu)';
  } else if (all.length < 12) for (const k of Object.keys(inp)) if (!all.includes(k)) return 'argument inconnu : ' + k;
  return null;
}
async function runTool(tc) {
  if (tc.bad) return 'Arguments JSON illisibles : corrige la balise.';
  const def = TOOLS.list.find((t) => t.server === tc.server && t.name === tc.tool);
  if (!def) return 'Outil inconnu : ' + tc.server + ' | ' + tc.tool + '. Utilise un outil de la liste.';
  { const bad = validateToolArgs(tc, def); if (bad) { addLog('sys', '✗ ' + tc.server + ' · ' + tc.tool + ' refusé : ' + bad); return 'Appel refusé avant exécution : ' + bad + '. Corrige la balise.'; } }
  if (def.builtin) return def.server === 'Code' ? runCodeTool(tc) : runWebTool(tc);
  const label = tc.server + ' · ' + tc.tool;
  if (!def.ro && !(await askUser(label + ' ' + JSON.stringify(tc.input).slice(0, 160)))) return 'La personne a refusé cette action. Ne la refais pas, dis-le-lui simplement.';
  const note = addLog('sys', '↻ ' + label + '…');
  try {
    const r = await TOOLS.mcp.callTool(tc.server, tc.tool, tc.input || {});
    note.textContent = '✓ ' + label;
    if (!def.ro) TOOLS.mcp.invalidate(tc.server).catch(() => {});
    toolsRefresh();                                   // les schémas deviennent lisibles après le premier accord
    let out = r && r.payload !== undefined ? r.payload : r && r.content;
    out = typeof out === 'string' ? out : JSON.stringify(out);
    return out.length > 9000 ? out.slice(0, 9000) + '… (tronqué)' : out;
  } catch (e) {
    const code = e && e.code;
    note.textContent = '✗ ' + label + ' (' + (code || 'erreur') + ')';
    const why = {
      server_not_connected: 'ce connecteur n\'est pas branché : il faut l\'ajouter dans claude.ai, Paramètres, Connecteurs',
      needs_reauth: 'la connexion a expiré : il faut reconnecter ' + tc.server + ' dans claude.ai, Paramètres, Connecteurs',
      not_in_manifest: 'ce connecteur n\'a pas été autorisé pour cette page',
      approval_required: 'pas d\'accord donné pour cet appel',
      blocked_by_policy: 'bloqué par la politique de son organisation',
      tool_error: 'l\'outil a répondu une erreur : ' + String((e && e.message) || '').slice(0, 300),
      server_unavailable: 'le service ne répond pas pour le moment',
    }[code] || ('erreur ' + (code || '') + ' ' + String((e && e.message) || '').slice(0, 200));
    return 'Échec : ' + why + '.';
  }
}

async function askClaude(text, onText, photo, hidden) {
  try {
    const opts = { cache: false, onText: ({ text: t }) => onText(parseBrain(t).vis) };
    if (photo) opts.images = [photo];
    let msgs = brainMessages(photo ? text + '\n(Je te montre une photo, jointe à ce message : regarde-la et réagis naturellement.)' : text);
    const SMP = brainSample;                // Claude, avec bascule automatique vers ses moteurs internet
    let out = await SMP(msgs, opts);
    for (let step = 0, lim = 3; step < lim && (TOOLS.mcp || TOOLS.list.some((t) => t.builtin)); step++) {        // boucle outils : appel → résultat → nouvelle réponse
      const tc = parseTool(out && out.text);
      if (!tc) break;
      if (tc.server === 'Code') lim = 6;                 // code : écrire → lancer → lire l'erreur → corriger, plusieurs essais
      const pre = parseBrain(out.text); applyLife(pre);
      for (const m of pre.mem) if (m && !memories.some((x) => x.toLowerCase() === m.toLowerCase())) memories.push(m);
      const res = await runTool(tc);
      msgs = [...msgs, { role: 'assistant', content: String(out.text).trim() },
        { role: 'user', content: '[résultat de ' + tc.server + ' | ' + tc.tool + ']\n' + res + '\n[fin du résultat — réponds maintenant à la personne à l\'oral, ou appelle un autre outil si c\'est vraiment nécessaire]' }];
      delete opts.images;
      out = await SMP(msgs, opts);
    }
    const r = parseBrain(out && out.text);
    if (!r.vis) return { error: 'réponse vide' };
    applyLife(r);
    if (hidden) history.push({ role: 'user', content: '(elle/il vient d\'ouvrir la page)' }, { role: 'assistant', content: r.vis });
    else history.push({ role: 'user', content: photo ? text + ' [photo montrée]' : text }, { role: 'assistant', content: r.vis });
    life.lastSeen = Date.now();
    if (!hidden && ++life.count % 8 === 0) reflect();
    saveLife();
    history = history.slice(-24);
    for (const m of r.mem) if (m && !memories.some((x) => x.toLowerCase() === m.toLowerCase())) memories.push(m);
    memories = memories.slice(-150);
    persist();
    return { reply: r.vis, data: { expression: r.expr, memories, gesture: r.gesture, pose: r.pose || undefined, outfit: r.outfit, choices: r.choices } };
  } catch (e) {
    const code = e && e.code;
    if (code === 'not_granted') { cap.sample = null; setStatus(); }
    return { error: code === 'rate_limited' ? 'trop de messages d\'un coup, attends un instant' : code === 'not_granted' ? 'accès à Claude refusé pour cette page' : (e && (e.message || code)) || 'inconnue' };
  }
}
(async () => {
  const C = (window.claude && typeof window.claude.use === 'function') ? window.claude : { use: () => Promise.resolve(null) };   // hors claude.ai : pas de capacités, mais 📎 / documents / modèle perso marchent quand même
  const get = (n) => Promise.resolve(C.use(n)).catch(() => null);
  get('sample').then(async (x) => {
    cap.sample = x; setStatus();
    if (!x) return;
    let ok = false;
    try { const l = await x.limits(); ok = !!(l && l.images); } catch (_) {}
    imgOk = ok;
  });
  async function shrink(file) {             // photo réduite à 1024 px et en JPEG : envoi rapide
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1568 / Math.max(img.width, img.height));   // assez fin pour lire une planche de plusieurs poses
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    } finally { URL.revokeObjectURL(url); }
  }
  let pendingDoc = null, imgOk = false;
  window.__takeDoc = () => { const d = pendingDoc; pendingDoc = null; attachChip(); return d; };
  const chip = $('#attach-chip');
  function attachChip() {
    const lab = pendingDoc ? '📄 ' + pendingDoc.name : (pendingPhoto ? '🖼️ Image prête' : '');
    chip.hidden = !lab; chip.firstElementChild.textContent = lab;
    $('#btn-photo').classList.toggle('on', !!lab);
  }
  window.__attachChip = attachChip;
  chip.lastElementChild.addEventListener('click', () => { pendingDoc = null; pendingPhoto = null; attachChip(); });
  async function docxText(file) {          // .docx = zip : on lit word/document.xml avec le décompresseur du navigateur
    const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
    let e = buf.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    let o = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
    for (let k = 0; k < n; k++) {
      const m = dv.getUint16(o + 10, true), cs = dv.getUint32(o + 20, true), nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true), lo = dv.getUint32(o + 42, true);
      const name = new TextDecoder().decode(buf.subarray(o + 46, o + 46 + nl));
      if (name === 'word/document.xml') {
        const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = buf.subarray(ds, ds + cs);
        const out = m === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        return new TextDecoder().decode(out).replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      }
      o += 46 + nl + xl + cl;
    }
    throw new Error('docx');
  }
  $('#btn-photo').addEventListener('click', () => $('#file-photo').click());
  $('#file-photo').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const inp = $('#chat-input');
    try {
      if (/\.(glb|vrm)$/i.test(f.name)) { showToast('Chargement de ton modèle…'); loadVRMFile(f); return; }   // ton propre corps, directement depuis le 📎
      if (/^image\//.test(f.type)) {
        if (!imgOk) { showToast('Les images marchent quand Aiko est ouverte dans claude.ai'); return; }
        pendingPhoto = await shrink(f); pendingDoc = null;
        if (!inp.value.trim()) inp.value = 'Regarde ça';
      } else {
        let text = '';
        if (/\.docx$/i.test(f.name)) text = await docxText(f);
        else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') { showToast('PDF : copie-colle le texte, ou envoie-le en .txt / .docx'); return; }
        else if (f.size > 25e6) { showToast('Fichier trop gros (25 Mo au plus)'); return; }
        else { const by = new Uint8Array(await f.arrayBuffer()); BAC.file = { name: f.name.slice(0, 80), bytes: by };   // gardé pour son bac à essai (analyse, rétro-ingénierie)
          if (bacIsBinary(by)) { text = '[fichier binaire « ' + f.name.slice(0, 80) + ' », ' + by.length + ' octets : examine-le avec Code | analyser]'; if (!inp.value.trim()) inp.value = 'Analyse ce fichier'; }
          else text = new TextDecoder().decode(by); }
        text = text.replace(/\u0000/g, '').trim();
        if (!text) { showToast('Document vide ou illisible'); return; }
        pendingDoc = { name: f.name.slice(0, 60), text: text.slice(0, 14000), cut: text.length > 14000 }; pendingPhoto = null;
        if (!inp.value.trim()) inp.value = 'Lis ce document et résume-le';
      }
      attachChip(); showToast('Joint : écris un mot et envoie'); inp.focus();
    } catch (err) { console.log("attach", err && err.message); showToast("Impossible de lire ce fichier"); }
  });
  get('mcp').then((m) => { if (m) { TOOLS.mcp = m; toolsRefresh(); } });
  get('tts').then((x) => {
    cap.tts = x;
    if (x) try { x.onState(({ state, reason }) => { if (state === 'speaking') { clearTimeout(mouthTimer); mouthOn = true; if (lip.src === 'tts') lipGo(); } else if (state === 'idle') { if (reason === 'completed') lipEnd(true); else lipPause(); mouthOn = false; clearTimeout(mouthTimer); } }); } catch (_) {}
    if (x) try {
      if (x.onLine) x.onLine(({ id }) => {          // chaque phrase qui commence : sa propre suite de visèmes
        if (!id || !sp.lines[id]) return;
        sp.played = true; lipEnd(true); lipPrep(sp.lines[id], 'tts'); lipGo();
      });
      if (x.onPosition) x.onPosition(({ ms }) => { if (lip.on && lip.src === 'tts' && typeof ms === 'number') lip.t0 = performance.now() - ms; });   // calage sur le son réellement entendu
    } catch (_) {}
  });
  get('dictation').then((d) => {
    if (!d) return;
    cap.dict = d;
    const micBtn = $('#btn-mic');
    let on = false, heard = '';
    try {
      d.onPartial(({ text }) => { $('#chat-input').value = (heard + ' ' + text).trim(); });
      d.onFinal(({ text }) => { heard = (heard + ' ' + text).trim(); $('#chat-input').value = heard; });
      d.onState(({ state }) => {
        on = state === 'listening';
        micBtn.classList.toggle('on', on);
        if (state === 'idle' && heard) {
          const form = $('#chat-form');
          $('#chat-input').value = heard; heard = '';
          if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    } catch (_) {}
    micBtn.addEventListener('click', () => {
      if (on) { d.stop().catch(() => {}); return; }
      const pr = d.start();                          // directement dans le clic, rien avant
      stopSpeech(); heard = ''; showToast('Je t\'écoute… touche à nouveau pour envoyer');
      pr.catch((e) => showToast(e && e.code === 'not_granted' ? 'Micro refusé : écris-lui' : 'Micro indisponible, réessaie'));
    });
  });
  // Mémoire gardée hors de la page (privée, par personne) : elle suit chacun d'un appareil à l'autre.
  const [db, user] = await Promise.all([get('db'), get('user')]);
  if (!db || !user) { memReady(); return; }
  try {
    const uid = await user.id();
    if (!uid) return;
    const doc = db.doc('data/users/' + uid + '/aiko');
    const snap = await doc.get();
    const d = snap.exists ? snap.data() : null;
    if (d && Number(d.savedAt || 0) > savedAt && !thinking) {
      if (Array.isArray(d.memories)) memories = d.memories.slice(-150);
      if (Array.isArray(d.history)) history = d.history.slice(-24);
      if (d.life && typeof d.life === 'object') { life = Object.assign({}, LIFE0, d.life); for (const k of ['notes', 'tasks', 'reminders', 'journal', 'lessons', 'savoirs', 'incidents', 'moves']) if (!Array.isArray(life[k])) life[k] = []; saveLife(); } try { restoreMoves(); } catch (_) {}
      savedAt = Number(d.savedAt);
      store.set('aiko.history', JSON.stringify(history)); store.set('aiko.memories', JSON.stringify(memories)); store.set('aiko.savedAt', String(savedAt));
    }
    cap.doc = doc;
    if (!d && (history.length || memories.length)) persist();
  } catch (_) { /* pas de mémoire distante : la copie locale suffit */ }
  finally { memReady(); }
})();
