// Cache d'Aiko (généré par build.py : la version change dès qu'un fichier change).
// Gros fichiers (corps 3D, moteur, mouvements) : servis depuis le cache d'abord → réouverture instantanée, même hors ligne.
// Page : réseau d'abord (toujours la dernière version), cache en secours.
const V='aiko-b905f8f52d8d', B=self.registration.scope, CORE=['','index.html','aiko-3d.js','clips.json','model.json','manifest.webmanifest','icon-192.png','icon-512.png','lib/index.json'].map(p=>B+p);
const HEAVY=/\/(aiko-3d\.js|clips\.json|model\.json|business\.json|icon-\d+\.png|lib\/.+\.json)$/;
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>0)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
const put=(q,r)=>{if(r&&r.ok){const c=r.clone();caches.open(V).then(x=>x.put(q,c))}return r};
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url); if(q.method!=='GET'||u.origin!==location.origin)return;
  if(HEAVY.test(u.pathname)) e.respondWith(caches.open(V).then(c=>c.match(q,{ignoreSearch:true})).then(r=>r||fetch(q).then(x=>put(q,x))));
  else e.respondWith(fetch(q).then(x=>put(q,x)).catch(()=>caches.match(q,{ignoreSearch:true}).then(r=>r||(q.mode==='navigate'?caches.match(B+'index.html'):Response.error()))))});
