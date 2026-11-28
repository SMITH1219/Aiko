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
        # 9 bouche : tirer la langue (image par image), mastication au rythme humain, aliments prêts
        r=await pg.evaluate("""(()=>{ window.__nogest=1; window.__freeze=1; window.__dt=1/60; window.__nogest=0; __T.playGesture('langue'); window.__nogest=1;
          for(let i=0;i<90;i++) __T.animateFrame(); let t=null; __T.vrmRef().scene.traverse(o=>{ if(o.isMesh&&/tongue/i.test(o.name)) t=o; });
          const L=t?+t.morphTargetInfluences[t.morphTargetDictionary.tongueOut].toFixed(2):-1;
          const sq=__T.GLIB.manger.faceSeq, up=[]; for(let i=1;i<sq.length;i++){ const a=(sq[i-1][1].mache||0), b=(sq[i][1].mache||0); if(a<0.3&&b>=0.3&&sq[i][1].joues) up.push(sq[i][0]); }
          const seg=up.filter((x,i)=>i&&x-up[i-1]<1.2).length, span=up.reduce((s,x,i)=>i&&x-up[i-1]<1.2?s+x-up[i-1]:s,0);
          window.__freeze=0; window.__dt=0; return JSON.stringify({langue:L, hz:+(seg/span).toFixed(2), bouchees:__T.GLIB.manger.eat.bites.length, coups:__T.GLIB.glace.eat.licks.length}); })()""")
        r=json.loads(r); ok('bouche : langue tirée, mastication ≈ 1,46 Hz (mesures humaines), 2 bouchées, 5 coups de langue',r['langue']>0.9 and 1.25<=r['hz']<=1.7 and r['bouchees']==2 and r['coups']==5,r)
        # 10 lèvres closes sur p/b/m, formes de langue créées sans perdre celles d'origine, émotions FACS qui montent en douceur
        r=json.loads(await pg.evaluate("""(()=>{ const pn=performance.now.bind(performance); window.__vt=pn(); performance.now=()=>window.__vt; window.__freeze=1; window.__dt=1/60;
          let face=null, tg=null; __T.vrmRef().scene.traverse(o=>{ if(o.isMesh&&o.morphTargetDictionary){ if(o.morphTargetDictionary.mouthSmileLeft!==undefined&&!face) face=o; if(/tongue/i.test(o.name)) tg=o; } });
          __T.lipPrep('Papa mange une pomme, maman boit.','local'); __T.mouthSet(true); __T.lipGo(); const L=__T.lipRef(), pp=[];
          for(let f=0; f<200; f++){ window.__vt+=1000/60; __T.animateFrame(); const pos=(window.__vt-L.t0)/1000*L.rate; let k=0; while(k+1<L.starts.length&&L.starts[k+1]<=pos) k++;
            if(L.seq[k][0]==='PP'){ (pp[k]=pp[k]||[]).push(face.morphTargetInfluences[face.morphTargetDictionary.viseme_PP]); } }
          __T.mouthSet(false); const ferm=pp.filter(Boolean).map(a=>Math.max(...a));
          __T.setEmotion('sad'); for(let f=0; f<80; f++){ window.__vt+=1000/60; __T.animateFrame(); } __T.setEmotion('happy'); const sm=[]; for(let f=0; f<36; f++){ window.__vt+=1000/60; __T.animateFrame(); if(f%6===5) sm.push(+face.morphTargetInfluences[face.morphTargetDictionary.mouthSmileLeft].toFixed(2)); }
          performance.now=pn; window.__freeze=0; window.__dt=0;
          return JSON.stringify({ferm, langue:Object.keys(tg.morphTargetDictionary), sourire:sm}); })()"""))
        ok('lèvres closes sur chaque p/b/m (forme PP ≥ 0,95)',len(r['ferm'])>=6 and min(r['ferm'])>=0.95,r['ferm'])
        ok('langue : formes créées (pointe, côtés) + formes d\'origine intactes',all(k in r['langue'] for k in ['tongueOut','viseme_DD','tongueTipUp','tongueLeft','tongueRight']),r['langue'])
        ok('émotion : montée progressive (≈ 0,5 s pour un sourire), pas de saut',r['sourire'][0]<0.5 and r['sourire'][-1]>0.75 and all(b>=a-0.02 for a,b in zip(r['sourire'],r['sourire'][1:])),r['sourire'])
        # 11 contact : la chair se creuse sous le doigt et se referme quand on lache
        pos=await pg.evaluate("""()=>{ const V=__T.THREE.Vector3, pn=performance.now.bind(performance);
          window.__vt=pn(); performance.now=()=>window.__vt; window.__freeze=1; window.__dt=1/60;   // corps fige : la cible ne bouge plus sous le doigt
          __T.TLIVE.mode=1; window.__nogest=1; window.__noautocam=1;
          document.querySelectorAll('#log,#chat-form,header,#topbar,.top,#panel').forEach(e=>e.style.display='none');
          const pas=()=>{ window.__vt+=1000/60; __T.animateFrame(); };
          for(let i=0;i<60;i++) pas();
          const C=__T.CAM, hy=__T.vrmRef().humanoid.getNormalizedBoneNode('hips').getWorldPosition(new V()).y;
          C.dist=1.0; C.yaw=0.0; C.pitch=0.02; C.px=0; C.py=hy+0.30-__T.target.y;
          for(let i=0;i<240;i++) pas();                 // la camera glisse vers sa cible : on la laisse arriver, sinon le doigt rate
          const W=window.innerWidth, H=window.innerHeight;
          const pts=[];
          for(let y=Math.round(H*0.2); y<H*0.75; y+=4)
            for(let x=Math.round(W*0.25); x<W*0.75; x+=4){
              const h=__T.tlPick(x,y); if(h && __T.tlZone(h)==='poitrine') pts.push([x,y]);
            }
          if(!pts.length) return null;
          // centre de la zone : un point de bord basculerait sur l'epaule au moindre deplacement
          const cx=Math.round(pts.reduce((s,p)=>s+p[0],0)/pts.length), cy=Math.round(pts.reduce((s,p)=>s+p[1],0)/pts.length);
          let best=pts[0], bd=1e9;
          for(const p of pts){ const d=(p[0]-cx)**2+(p[1]-cy)**2; if(d<bd){ bd=d; best=p; } }
          return __T.tlZone(__T.tlPick(best[0],best[1]))==='poitrine' ? best : pts[Math.floor(pts.length/2)]; }""")
        if pos:
            await pg.mouse.move(pos[0],pos[1]); await pg.mouse.down()
            app=await pg.evaluate("""()=>{ for(let i=0;i<70;i++){ window.__vt+=1000/60; __T.animateFrame(); }
              return { zone:(__T.TLIVE.act||{}).zone||'aucune', prof:window.__TOUCH.uTc.value[0].w*1000, rayon:window.__TOUCH.uTn.value[0].w*1000 }; }""")
            await pg.mouse.up()
            rel=await pg.evaluate("""()=>{ for(let i=0;i<120;i++){ window.__vt+=1000/60; __T.animateFrame(); }
              const v=window.__TOUCH.uTc.value[0].w*1000; const pn=performance.now; window.__freeze=0; window.__dt=0; return v; }""")
        else:
            app={'zone':'aucun point de poitrine a l ecran','prof':0,'rayon':0}; rel=0
        ok('contact : la chair se creuse sous le doigt (3-22 mm) puis se referme',
           app['zone']=='poitrine' and 3<=app['prof']<=22 and 20<=app['rayon']<=45 and rel<app['prof']*0.5,
           {'zone':app['zone'],'creux_mm':round(app['prof'],2),'rayon_mm':round(app['rayon'],1),'apres_relache_mm':round(rel,2)})
        # 12 ballottement de la poitrine : amplitude et repartition par axe conformes aux mesures humaines
        #    (Scurr, 21 participantes bonnet D : resultante 15,2 +/- 4,2 cm en course, dont ~56 % de vertical)
        r=json.loads(await pg.evaluate("""(async ()=>{ const pn=performance.now.bind(performance); window.__vt=pn(); performance.now=()=>window.__vt; window.__freeze=1; window.__dt=1/60;
          window.__nogest=0; window.__noautocam=1;
          const V=__T.THREE.Vector3, vrm=__T.vrmRef();
          const chest=vrm.humanoid.getNormalizedBoneNode('chest')||vrm.humanoid.getNormalizedBoneNode('upperChest')||vrm.humanoid.getNormalizedBoneNode('spine');
          const hips=vrm.humanoid.getNormalizedBoneNode('hips');
          let tip=null; vrm.scene.traverse(o=>{ if(o.isBone&&o.name==='LeftBreast') tip=o; });
          const step=n=>{ for(let i=0;i<n;i++){ window.__vt+=1000/60; __T.animateFrame(); } };
          const bouge=()=>{ const y0=hips.getWorldPosition(new V()).y; let lo=y0, hi=y0; for(let i=0;i<40;i++){ step(1); const y=hips.getWorldPosition(new V()).y; lo=Math.min(lo,y); hi=Math.max(hi,y); } return hi-lo>0.01; };
          let pret=false;
          for(let essai=0; essai<25 && !pret; essai++){ __T.libPlay('danse1',{reps:30}); await new Promise(r=>setTimeout(r,400)); pret=bouge(); }
          if(!pret){ performance.now=pn; window.__freeze=0; window.__dt=0; return JSON.stringify({err:'clip danse1 non joue'}); }
          const pts=[]; let clamp=0, tot=0;
          for(let i=0;i<300;i++){ step(1);
            for(const j of window.__t.jig) if(/Breast/.test(j.bone.name)){ tot++; if(j.off.clone().sub(j.sagOff).length()>j.lim*0.985) clamp++; }
            const q=chest.getWorldQuaternion(new __T.THREE.Quaternion()).invert();
            pts.push(tip.localToWorld(new V(0,0.085,0)).sub(chest.getWorldPosition(new V())).applyQuaternion(q).toArray()); }
          const rng=a=>{ const v=pts.map(p=>p[a]); return (Math.max(...v)-Math.min(...v))*100; };
          const ml=rng(0), ve=rng(1), ap=rng(2);
          performance.now=pn; window.__freeze=0; window.__dt=0;
          return JSON.stringify({res:+Math.hypot(ml,ve,ap).toFixed(1), vert:Math.round(100*ve/(ve+ml+ap)), butee:Math.round(100*clamp/Math.max(1,tot))}); })()"""))
        ok('ballottement : amplitude humaine (11-19,4 cm), 45-65 % vertical, sans butee seche',
           not r.get('err') and 11<=r.get('res',0)<=19.4 and 45<=r.get('vert',0)<=65 and r.get('butee',99)<=15, r)
        # 13 marche lente : vraiment plus lente et moins haute que la marche normale
        #    (en marche lente le deplacement vertical du centre de masse tombe a environ la moitie de celui
        #    de la vitesse spontanee ; le clip livre sous ce nom faisait l'inverse : 5,60 cm a 2,79 Hz contre 4,53 a 1,82)
        r=json.loads(await pg.evaluate("""(()=>{ const C=__T.CLIPS, a=C['marche'], b=C['marchelente'];
          if(!a||!b) return JSON.stringify({err:'clip absent'});
          const amp=c=>{ const d=c.dy; return (Math.max(...d)-Math.min(...d))*100; };
          return JSON.stringify({ vert_marche:+amp(a).toFixed(2), vert_lente:+amp(b).toFixed(2),
            duree_marche:+(a.n/a.fps).toFixed(2), duree_lente:+(b.n/b.fps).toFixed(2) }); })()"""))
        ok('marche lente : vertical <= 60 % de la marche et cycle >= 1,3 fois plus long',
           not r.get('err') and r['vert_lente'] <= 0.60*r['vert_marche'] and r['duree_lente'] >= 1.3*r['duree_marche'], r)
        ok('aucune erreur JS',not pg.errs,pg.errs); await pg.close(); await br.close()
subprocess.run([sys.executable,os.path.join(ROOT,'build.py'),'--test'],check=True,stdout=subprocess.DEVNULL)
srv=http.server.ThreadingHTTPServer(('localhost',PORT),functools.partial(type('Q',(http.server.SimpleHTTPRequestHandler,),{'log_message':lambda *a:None}),directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
asyncio.run(main()); srv.shutdown(); os.remove(os.path.join(ROOT,'_test.html'))
print(f'\n{sum(R)}/{len(R)} tests réussis'); sys.exit(0 if all(R) else 1)
