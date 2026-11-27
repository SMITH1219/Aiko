#!/usr/bin/env python3
"""Banc de tests d'Aiko : python3 tests/run.py  (assemble, sert la page, simule cerveau + web, vérifie tout)."""
import asyncio, json, os, subprocess, sys, http.server, threading, functools
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PORT=9940; URL=f'http://localhost:{PORT}/_test.html'
H={'access-control-allow-origin':'*'}; R=[]
def ok(name,cond,info=''): R.append(bool(cond)); print(('✓' if cond else '✗'),name,info if not cond else '')
def brain_reply(body):
    if 'Extrais UN fait' in body: return '{"s":"Agents IA","f":"Les agents IA enchaînent plusieurs outils.","src":"https://fr.wikipedia.org/wiki/Agent"}'
    if 'Découpe-la' in body: return '{"etapes":[{"titre":"Lister","critere":"liste claire"},{"titre":"Rédiger","critere":"texte clair"}]}'
    if 'vérificateur strict' in body: return '{"ok":true,"raison":"bon","correction":""}'
    if 'hauteur de la tour' in body and 'mesure 330' not in body: return '[outil: Web | recherche | {"q":"hauteur tour eiffel"}]'
    if 'mesure 330' in body: return 'Elle mesure 330 m. [savoir: Tour Eiffel | 330 m de haut | wikipedia]'
    return 'Résultat fait.'
async def page(br, fail_first=False, direct=True, gl=False, fail_n=0):
    pg=await br.new_page(viewport={'width':700,'height':1000}); pg.errs=[]; pg.n=0
    pg.on('pageerror',lambda e:pg.errs.append(str(e)))
    if direct: await pg.add_init_script("if(window===window.top){window.__rlMax=400;localStorage.setItem('aiko.directOn','1');localStorage.setItem('aiko.wake',new Date().toDateString())}")   # page seulement (pas les bulles isolées du bac à essai)
    async def brain(r):
        pg.n+=1
        if (fail_first and pg.n==1) or pg.n<=fail_n: return await r.fulfill(status=429,body='x',headers=H)
        if r.request.method!='POST': return await r.fulfill(body='ok',headers=H)
        await r.fulfill(json={"choices":[{"message":{"content":brain_reply(r.request.post_data or '')}}]},headers=H)
    async def wiki(r):
        if 'list=search' in r.request.url: await r.fulfill(json={"query":{"search":[{"title":"Tour Eiffel"}]}},headers=H)
        else: await r.fulfill(json={"query":{"pages":{"1":{"title":"Tour Eiffel","extract":"La tour Eiffel mesure 330 m."}}}},headers=H)
    await pg.route('**/text.pollinations.ai/**',brain); await pg.route('**/*wikipedia.org/**',wiki)
    await pg.route('**/api.duckduckgo.com/**',lambda r:r.fulfill(json={"AbstractText":""},headers=H))
    await pg.goto(URL); await pg.wait_for_timeout(28000 if gl else 2500); return pg
async def send(pg,t,wait): await pg.fill('#chat-input',t); await pg.press('#chat-input','Enter'); await pg.wait_for_timeout(wait)
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        # 1 chargement + corps 3D
        pg=await page(br,gl=True)
        info=json.loads(await pg.evaluate("JSON.stringify({vrm:!!(window.__t&&window.__t.vrm),bones:!!(window.__t&&window.__t.bones&&window.__t.bones.hips),errs:window.__errs||[]})"))
        ok('page chargée sans erreur',not pg.errs and not info['errs'],pg.errs or info['errs']); ok('avatar 3D chargé (squelette présent)',info['vrm'] and info['bones'],info)
        os.makedirs(os.path.join(ROOT,'tests','captures'),exist_ok=True); await pg.screenshot(path=os.path.join(ROOT,'tests','captures','corps.png'))
        # 2 validation des outils
        res=[await pg.evaluate("(i)=>__T.runTool({server:'Web',tool:'recherche',input:JSON.parse(i)})",i) for i in ['{"q":"tour eiffel"}','{}','{"q":"x","evil":1}','{"q":5}','[1]']]
        ok('outil valide exécuté','330' in res[0],res[0][:80]); ok('4 appels invalides refusés',all('refusé' in r for r in res[1:]),res[1:])
        ok('compétences choisies (max 4)',await pg.evaluate("(()=>{const c=__T.compsOf('Cherche les nouveautés et fais un plan avec un budget');return c.length>0&&c.length<=4&&c.includes('investigation')})()"))
        # 3 conversation avec recherche Internet
        await send(pg,'Quelle est la hauteur de la tour Eiffel ?',14000); txt=await pg.evaluate("document.body.innerText")
        ok('recherche Internet puis réponse','330 m' in txt and 'recherche faite' in txt); ok('savoir retenu',await pg.evaluate("(JSON.parse(localStorage.getItem('aiko.life')||'{}').savoirs||[]).length")>=1)
        await pg.close()
        # 4 bascule de moteur
        pg=await page(br,fail_first=True); await send(pg,'Bonjour, aide-moi sur un contrat juridique',10000)
        b=json.loads(await pg.evaluate("JSON.stringify(__T.brainState())"))
        ok('moteur saturé → bascule',b['eng'].get('pol-openai',{}).get('fail')==1 and b.get('lastEngine')=='pol-mistral',b['eng']); ok('domaine détecté',b['dom'].get('droit',0)>0)
        await pg.evaluate("document.getElementById('btn-brain').click()"); await pg.wait_for_timeout(400)
        ok('panneau 🧠 affiché','Lexa' in await pg.evaluate("document.body.innerText") and not pg.errs,pg.errs); await pg.close()
        # 4b tous les moteurs saturés → elle patiente et réessaie
        pg=await page(br,fail_n=3); await send(pg,'Bonjour',12000)
        ok('tous saturés (429) → attente puis réponse','Résultat fait.' in await pg.evaluate("document.body.innerText") and pg.n==4,pg.n); await pg.close()
        # 4c demandes simultanées mises en file (jamais deux à la fois)
        pg=await page(br); r=await pg.evaluate("Promise.all([__T.studyOnce('a',true),__T.studyOnce('b',true)]).then(x=>JSON.stringify(x))")
        ok('pas de demandes en double','null' in r,r); await pg.close()
        # 5 mission + étude autonome
        pg=await page(br); e=await pg.evaluate("__T.studyOnce(null,true)"); ok('auto-formation',e and e['ok'],e)
        await send(pg,'mission : préparer une synthèse sur les agents IA',18000)
        m=json.loads(await pg.evaluate("JSON.stringify(__T.brainState().missions)")); ok('mission planifiée, vérifiée, terminée',m and m[-1]['status']=='terminée' and len(m[-1]['steps'])==2,m)
        # 6 bac à essai : code vraiment lancé (isolé), erreur avec sa ligne, boucle infinie tuée, réseau coupé, essais simultanés en file
        r=json.loads(await pg.evaluate("""Promise.all([__T.bacRun('js','let s=0;for(let i=1;i<=10;i++)s+=i;s'),__T.bacRun('js','1;\\nnope()'),__T.bacRun('js','while(true){}',{ms:1500}),__T.bacRun('js',"try{await fetch('https://exemple.org/');return 'ouvert'}catch(e){return 'bloqué'}"),__T.bacRun('js','typeof document')]).then(x=>JSON.stringify(x))"""))
        ok('bac à essai : résultat, erreur + ligne, boucle tuée, réseau coupé, page inaccessible',r[0].get('val')=='55' and not r[1]['ok'] and r[1].get('line')==2 and r[2].get('timeout') and r[3].get('val')=='bloqué' and r[4].get('val')=='undefined',r)
        # 7 rétro-ingénierie : un vrai module WebAssembly lu sans jamais l'exécuter
        a=await pg.evaluate("(()=>{__T.BAC.file={name:'petit.wasm',bytes:new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 3, 96, 1, 127, 0, 96, 1, 127, 1, 127, 96, 0, 0, 2, 11, 1, 3, 101, 110, 118, 3, 108, 111, 103, 0, 0, 3, 3, 2, 1, 2, 5, 3, 1, 0, 1, 7, 22, 3, 3, 109, 101, 109, 2, 0, 5, 99, 97, 114, 114, 101, 0, 1, 4, 100, 105, 114, 101, 0, 2, 10, 16, 2, 7, 0, 32, 0, 32, 0, 108, 11, 6, 0, 65, 42, 16, 0, 11])}; return __T.runCodeTool({server:'Code',tool:'analyser',input:{vue:'auto'}})})()")
        ok('rétro-ingénierie : imports/exports lus','env.log' in a and 'Exports (3)' in a and 'carre' in a,a[:200])
        # 8 auto-amélioration : proposée, PAS appliquée sans accord ; appliquée puis annulée
        g=json.dumps({'nom':'essai-geste','etapes':[{'duree':1,'corps':{'spine':[9,0,0]}}]})
        await pg.evaluate("(c)=>__T.runCodeTool({server:'Code',tool:'proposer',input:{type:'geste',titre:'essai',contenu:c}})",g)
        st=await pg.evaluate("(()=>{const p=__T.amelProps().find(x=>x.nom==='essai-geste'); const a=['essai-geste' in __T.GLIB]; __T.amelApply(p); a.push('essai-geste' in __T.GLIB, __T.GLIB['essai-geste'].fk[1][1].spine[0]); __T.amelUndo(p); a.push('essai-geste' in __T.GLIB); return a})()")
        ok('proposition : rien sans accord, puis appliquée (angles bornés), puis annulée',st==[False,True,0.9,False],st)
        ok('aucune erreur JS',not pg.errs,pg.errs); await pg.close(); await br.close()
subprocess.run([sys.executable,os.path.join(ROOT,'build.py'),'--test'],check=True,stdout=subprocess.DEVNULL)
srv=http.server.ThreadingHTTPServer(('localhost',PORT),functools.partial(type('Q',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
asyncio.run(main()); srv.shutdown(); os.remove(os.path.join(ROOT,'_test.html'))
print(f'\n{sum(R)}/{len(R)} tests réussis'); sys.exit(0 if all(R) else 1)
