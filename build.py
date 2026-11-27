#!/usr/bin/env python3
"""Assemble src/* (ordre alphabétique) en index.html. --test ajoute les accès de test (window.__T) dans _test.html."""
import sys, glob, os
d=os.path.dirname(os.path.abspath(__file__))
files=sorted(glob.glob(os.path.join(d,'src','*')))
out='\n'.join(open(f,encoding='utf-8').read() for f in files)
if '--test' in sys.argv:
    i=out.rindex('</script>')
    out=out[:i]+"\nwindow.__T={THREE,TOOLS,webSearch,webRead,runTool,compsOf,brainContext,brainState,runMission,studyOnce,playGesture,setPose,target,camera,libPlay,animateFrame,skinPush,SKIN,SURF,surfUpdate,surfClosest,surfPalm,ZONES,SENSI,FCONF,touchSense,surfTriBone,SLOCK,idlePick,FOOTLOC,_bf,TLIVE,PERF,PROPS_ST,askClaude,engineList,webSearch,tlPick,tlZone,bfFrame,bfAnchors,CAM,lifeRef:()=>life,lastTouch:()=>lastTouch,bacRun,BAC,runCodeTool,amelVeille,amelProps,amelApply,amelUndo,amelVers,GLIB,GLB_EXPR,PRESETS,vrmRef:()=>vrm,EAT,rawOf,gstRef:()=>gst,lipPrep,lipGo,lipEnd,lipRef:()=>lip,frVisemes,mouthSet:(v)=>{mouthOn=v;},setExpr,setEmotion,emoRef:()=>[emotion,emotionW]};\n"+out[i:]
    open(os.path.join(d,'_test.html'),'w',encoding='utf-8').write(out)
else:
    open(os.path.join(d,'index.html'),'w',encoding='utf-8').write(out)
if '--test' not in sys.argv:
    import hashlib
    h=hashlib.sha1()
    for n in ['index.html','aiko-3d.js','clips.json','model.json']: h.update(open(os.path.join(d,n),'rb').read())
    sw=open(os.path.join(d,'sw.src.js'),encoding='utf-8').read().replace('__VERSION__',h.hexdigest()[:12])
    open(os.path.join(d,'sw.js'),'w',encoding='utf-8').write(sw)
print(len(files),'modules ->',len(out),'octets')
