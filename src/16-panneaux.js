// ---- 📱 Ouvrir Aiko sur le téléphone : QR code à scanner (disponible quand la page vient du serveur Aiko) ----
(function () {
  const b = document.getElementById('btn-phone'); if (!b) return;
  b.addEventListener('click', async () => {
    let d = null;
    try { const r = await fetch((SERVER || '') + '/api/phone', { cache: 'no-store' }); if (r.ok) d = await r.json(); } catch (_) {}
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(10,8,12,.86);display:flex;align-items:center;justify-content:center;padding:18px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#18101a;border-radius:18px;padding:18px;max-width:340px;width:100%;text-align:center;font:14px/1.4 system-ui,sans-serif';
    if (!d) {
      box.innerHTML = '<b>Disponible avec l\'application sur ton PC</b><p>Lance Aiko avec <i>Lancer-Aiko.bat</i> : ce bouton affichera alors un code à scanner avec ton téléphone.</p>';
    } else {
      box.innerHTML = '<b>Scanne avec l\'appareil photo du téléphone</b>'
        + '<div style="margin:12px auto;width:230px;height:230px">' + (d.svg || '') + '</div>'
        + '<p style="margin:6px 0;font-size:12px;color:#555">Même Wi‑Fi que le PC. Puis « Ajouter à l\'écran d\'accueil ».</p>'
        + '<a href="' + d.url + '" style="display:block;word-break:break-all;font-size:12px;color:#7a2a6a">' + d.url + '</a>';
      const sv = box.querySelector('svg'); if (sv) { sv.style.width = '100%'; sv.style.height = '100%'; }
    }
    const x = document.createElement('button'); x.textContent = 'Fermer'; x.type = 'button';
    x.style.cssText = 'margin-top:12px;padding:9px 22px;border:0;border-radius:10px;background:#18101a;color:#fff;font-size:14px';
    x.onclick = () => ov.remove(); box.appendChild(x); ov.appendChild(box); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  });
})();

// ---- 🧠 Cerveau d'Aiko : état réel de ses modules + choix de son moteur ----
(function () {
  const b = document.getElementById('btn-brain'); if (!b) return;
  b.textContent = '🧠 Cerveau d\'Aiko';
  const PRESETS_B = [
    ['Pollinations (sans clé)', 'https://text.pollinations.ai/openai', 'openai'],
    ['OpenRouter (clé gratuite)', 'https://openrouter.ai/api/v1', 'mistralai/mistral-small-3.2-24b-instruct'],
    ['Groq (clé gratuite)', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'],
    ['DeepSeek (clé)', 'https://api.deepseek.com/v1', 'deepseek-chat'],
    ['Grok / xAI (clé)', 'https://api.x.ai/v1', 'grok-3-mini'],
    ['Pollinations (ta clé pk_)', 'https://gen.pollinations.ai/v1', 'openai-fast'],
    ['LM Studio (sur ton ordi)', 'http://localhost:1234/v1', 'local-model'],
    ['Ollama (sur ton ordi)', 'http://localhost:11434/v1', 'llama3.2'],
  ];
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function stats() {
    const B = brainState(), now = Date.now(), h = [];
    const sec = (t, body) => h.push('<div style="margin:10px 0 4px;font-weight:700">' + t + '</div>' + body);
    const usingBrain = cap.sample ? 'Claude (dans l\'app Claude)' : (ownOk && !DIRECT) ? 'ton serveur' : 'ses propres moteurs (sans Claude)';
    h.push('<div style="font-size:12px;color:#555">Elle pense en ce moment avec : <b>' + esc(usingBrain) + '</b> · ' + (B.turns || 0) + ' messages analysés</div>');
    sec('Lexa — moteurs', '<table style="width:100%;font-size:12px;border-collapse:collapse">' + engineList().map((e) => { const st = B.eng[e.id] || {}; const pause = st.until > now;
      return '<tr><td>' + esc(e.name) + '</td><td style="text-align:right">' + (st.ok || 0) + ' ✓ · ' + (st.fail || 0) + ' ✗' + (st.ms ? ' · ' + (st.ms / 1000).toFixed(1) + ' s' : '') + '</td><td style="text-align:right;color:' + (pause ? '#b3261e' : st.ok ? '#1b7a3a' : '#777') + '">' + (pause ? 'en pause' : st.ok ? 'actif' : 'pas encore essayé') + '</td></tr>' + (st.err && !st.ok ? '<tr><td colspan=3 style="color:#999;font-size:11px">' + esc(st.err) + '</td></tr>' : ''); }).join('') + '</table>');
    const tot = Object.values(B.dom).reduce((a, v) => a + v, 0);
    const doms = Object.entries(B.dom).filter((x) => x[1] > 0.05).sort((x, y) => y[1] - x[1]).slice(0, 6);
    sec('DomainProfiler — ce qui compte pour toi', doms.length ? doms.map(([k, v]) => { const p = Math.round(100 * v / (tot || 1)); return '<div style="font-size:12px">' + esc(DOMAINS[k].n) + ' <span style="color:#777">' + p + ' %</span><div style="height:6px;background:#eee;border-radius:3px"><div style="height:6px;width:' + p + '%;background:#d5560f;border-radius:3px"></div></div></div>'; }).join('') : '<div style="font-size:12px;color:#777">Pas encore assez de messages.</div>');
    const sat = Object.entries(B.sat);
    sec('Kaizen — tes 👍 / 👎 par domaine', sat.length ? '<div style="font-size:12px">' + sat.map(([k, v]) => esc(DOMAINS[k] ? DOMAINS[k].n : 'Conversation perso') + ' : ' + (v.up || 0) + ' 👍 · ' + (v.down || 0) + ' 👎').join('<br>') + '</div>' : '<div style="font-size:12px;color:#777">Réagis avec 👍 / 👎 sous ses réponses.</div>');
    sec('Guardian — protection', '<div style="font-size:12px">' + B.guard.n + ' intervention' + (B.guard.n > 1 ? 's' : '') + (B.guard.log.length ? '<br>' + B.guard.log.slice(-3).reverse().map((g) => '· ' + esc(g.k) + ' : ' + esc(g.w)).join('<br>') : '') + '</div>');
    sec('Missions', B.missions.length ? '<div style="font-size:12px">' + B.missions.slice(-5).reverse().map((m) => '· ' + esc(m.goal) + ' — <b>' + esc(m.status) + '</b> (' + m.steps.filter((x) => x.status === 'fait').length + '/' + m.steps.length + ' étapes)').join('<br>') + '</div>' : '<div style="font-size:12px;color:#777">Écris « mission : … » pour lui confier un objectif : elle planifie, exécute, vérifie et corrige chaque étape.</div>');
    const cp = Object.entries(B.comp || {}).sort((x, y) => y[1] - x[1]).slice(0, 6);
    sec('Compétences — méthodes les plus utilisées', cp.length ? '<div style="font-size:12px">' + cp.map(([k, v]) => esc(COMPS[k] ? COMPS[k].n : k) + ' ' + v).join(' · ') + '</div>' : '<div style="font-size:12px;color:#777">2 toujours actives (raisonnement, fiabilité) + jusqu\'à 4 choisies selon ton message.</div>');
    const C = B.cur || { log: [], auto: false };
    sec('Curriculum — ce qu\'elle a étudié seule', '<div style="font-size:12px">' + (C.log.length ? C.log.slice(-5).reverse().map((x) => (x.ok ? '✓ ' : '· ') + esc(x.t) + ' — ' + esc(x.note)).join('<br>') : 'Rien étudié pour l\'instant.') + '<br><button id="b-study" type="button" style="margin:8px 0;padding:7px 12px;border:1px solid #d5560f;border-radius:14px;background:#fff;color:#d5560f;font-size:12px">Étudier maintenant</button> <label style="font-size:12px"><input id="b-auto" type="checkbox"' + (C.auto !== false ? ' checked' : '') + '> apprendre seule toutes les 20 min (page ouverte)</label></div>');
    return h.join('');
  }
  b.addEventListener('click', () => {
    const c = directCfg();
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(10,8,12,.86);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;color:#18101a;border-radius:18px;padding:16px;max-width:420px;width:100%;font:14px/1.4 system-ui,sans-serif;margin:auto';
    const inp = 'width:100%;box-sizing:border-box;padding:9px;margin:4px 0 10px;border:1px solid #ccc;border-radius:8px;font:14px system-ui';
    box.innerHTML = '<b style="font-size:16px">🧠 Cerveau d\'Aiko</b><div id="b-stats">' + stats() + '</div>'
      + '<hr style="border:0;border-top:1px solid #eee;margin:14px 0"><b>Ton moteur</b><p style="margin:6px 0;font-size:12px;color:#555">Facultatif. S\'il est réglé, Lexa l\'essaie en premier ; sinon elle utilise ses moteurs gratuits. Ses limites sont celles du moteur choisi.</p><div id="pr" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>'
      + '<label>Adresse</label><input id="b-url" style="' + inp + '"><label>Modèle</label><input id="b-model" style="' + inp + '"><label>Clé (laisser vide si aucune)</label><input id="b-key" type="password" autocomplete="off" style="' + inp + '">'
      + '<button id="b-add" type="button" style="width:100%;padding:8px;margin:-4px 0 10px;border:1px solid #d5560f;border-radius:10px;background:#fff;color:#d5560f;font-size:13px">＋ Ajouter aussi comme moteur supplémentaire</button>'
      + '<div id="b-extra" style="font-size:12px;margin-bottom:10px"></div>'
      + '<label>Clé Pollinations (facultative, gratuite sur enter.pollinations.ai, commence par pk_)</label><input id="b-pk" type="password" autocomplete="off" style="' + inp + '">'
      + '<label>Clé Jina (facultative : vraie recherche web, gratuite sur jina.ai)</label><input id="b-jina" type="password" autocomplete="off" style="' + inp + '">'
      + '<label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input id="b-on" type="checkbox"> Penser avec ses propres moteurs (sans serveur ni Claude)</label>'
      + '<div style="display:flex;gap:8px"><button id="b-ok" type="button" style="flex:1;padding:10px;border:0;border-radius:10px;background:#d5560f;color:#fff;font-size:14px">Enregistrer</button><button id="b-x" type="button" style="padding:10px 16px;border:0;border-radius:10px;background:#18101a;color:#fff;font-size:14px">Fermer</button></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    const g = (id) => box.querySelector('#' + id);
    g('b-url').value = c.url; g('b-model').value = c.model; g('b-key').value = c.key || ''; g('b-on').checked = DIRECT;
    try { g('b-pk').value = localStorage.getItem('aiko.polkey') || ''; g('b-jina').value = localStorage.getItem('aiko.jinakey') || ''; } catch (_) {}
    const xs = () => { try { return JSON.parse(localStorage.getItem('aiko.engines')) || []; } catch (_) { return []; } };
    const drawExtra = () => { const L = xs(); g('b-extra').innerHTML = L.length ? '<b>Moteurs supplémentaires</b> (Lexa les essaie tous)<br>' + L.map((x, i) => esc(x.name || 'Moteur') + ' · ' + esc(x.model) + ' <button type="button" data-rm="' + i + '" style="border:0;background:none;color:#b3261e;cursor:pointer">✕</button>').join('<br>') : '';
      g('b-extra').querySelectorAll('[data-rm]').forEach((bt) => bt.onclick = () => { const L2 = xs(); L2.splice(+bt.dataset.rm, 1); try { localStorage.setItem('aiko.engines', JSON.stringify(L2)); } catch (_) {} drawExtra(); g('b-stats').innerHTML = stats(); wireCur(); }); };
    g('b-add').onclick = () => { const u = g('b-url').value.trim(), m = g('b-model').value.trim(); if (!u || !m) { showToast('Adresse et modèle requis'); return; }
      const nm = (PRESETS_B.find((p) => p[1] === u) || [u.replace(/^https?:\/\//, '').split('/')[0]])[0];
      const L = xs(); if (!L.some((x) => x.url === u && x.model === m)) L.push({ name: nm, url: u, model: m, key: g('b-key').value.trim() }); try { localStorage.setItem('aiko.engines', JSON.stringify(L)); } catch (_) {}
      drawExtra(); g('b-stats').innerHTML = stats(); wireCur(); showToast('Moteur ajouté : Lexa l\'essaiera aussi'); };
    PRESETS_B.forEach(([n, u, m]) => { const p = document.createElement('button'); p.type = 'button'; p.textContent = n; p.style.cssText = 'padding:6px 10px;border:1px solid #d5560f;border-radius:14px;background:#fff;color:#d5560f;font-size:12px'; p.onclick = () => { g('b-url').value = u; g('b-model').value = m; }; g('pr').appendChild(p); });
    const wireCur = () => {
      g('b-auto').onchange = () => { const q = brainState(); q.cur = q.cur || { log: [], auto: false }; q.cur.auto = g('b-auto').checked; brainSave(q); };
      g('b-study').onclick = async () => { g('b-study').disabled = true; g('b-study').textContent = 'Elle étudie…'; await studyOnce(null, true); g('b-stats').innerHTML = stats(); wireCur(); };
    };
    wireCur(); drawExtra();
    g('b-x').onclick = () => ov.remove(); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    g('b-ok').onclick = () => {
      try { localStorage.setItem('aiko.direct', JSON.stringify({ url: g('b-url').value.trim(), model: g('b-model').value.trim(), key: g('b-key').value.trim() })); localStorage.setItem('aiko.directOn', g('b-on').checked ? '1' : '0');
        localStorage.setItem('aiko.polkey', g('b-pk').value.trim()); localStorage.setItem('aiko.jinakey', g('b-jina').value.trim()); } catch (_) {}
      DIRECT = IN_APP || /\.github\.io$/.test(location.host) || g('b-on').checked; ov.remove(); setStatus(); showToast('Cerveau enregistré');
    };
  });
})();