/* Çizim (sketch) modu: araçlar, akıllı ölçülendirme, ilişkiler, çizim görüntüsü ve paneli. */
/* ================= ÇİZİM MODU (Sketch) ================= */
const REL={sym:['Simetrik','⇋'],h:['Yatay','—'],v:['Dikey','|'],par:['Paralel','∥'],perp:['Dik','⊥'],eq:['Eşit','='],coll:['Doğrusal','≡'],tan:['Teğet','T'],pol:['Çakışık','◦'],poc:['Çakışık','◦'],mid:['Orta nokta','M'],fix:['Sabitle','⚓'],coin:['Çakışık','◦'],conc:['Eşmerkezli','◎']};
const DIMT=new Set(['d','dh','dv','dpl','dll','ddia','drad','dang']);
const TOOLHELP={
  line:'Çizgi: başlangıç ve bitiş noktalarına tıkla; zincir devam eder. Bitirmek için çift tıkla veya Esc.',
  centerline:'Merkez çizgisi: döndürme ekseni ve simetri için yapı çizgisi. İki noktaya tıkla.',
  rect:'Köşe dikdörtgen: bir köşeye, sonra karşı köşeye tıkla.',
  crect:'Merkez dikdörtgen: önce merkeze (örneğin orijine), sonra bir köşeye tıkla.',
  circle:'Daire: merkeze, sonra çevre üzerindeki bir noktaya tıkla.',
  arc:'Merkez nokta yay: merkez, başlangıç ve bitiş noktalarına sırayla tıkla. Yön fareyi hareket ettirdiğin yöne göre belirlenir.',
  slot:'Düz kanal: iki merkez noktasına, sonra genişliği belirlemek için yana tıkla.',
  polygon:'Çokgen: merkeze, sonra bir köşeye tıkla.',
  sfillet:'Çizim radyusu: iki çizginin birleştiği köşe noktasına tıkla.',
  smartdim:'Akıllı ölçülendirme: çizgi (uzunluk), daire (çap), yay (yarıçap), iki nokta/çizgi (mesafe) veya iki çizgi (açı) seç; sonra ölçünün yerine tıkla ve değeri gir.'
};
function newId(f,pre){let n=1;const has=id=>f.pts[id]||f.ents.some(e=>e.id===id)||f.cons.some(c=>c.id===id);while(has(pre+n))n++;return pre+n}
function skData(f){return JSON.stringify({pts:f.pts,ents:f.ents,cons:f.cons})}
function skPush(){sk.hist.push(skData(sk.feat));if(sk.hist.length>100)sk.hist.shift();sk.redo=[];updUndo()}
function skRestore(s){const o=JSON.parse(s);sk.feat.pts=o.pts;sk.feat.ents=o.ents;sk.feat.cons=o.cons}
function sketchUndo(){if(!sk||!sk.hist.length)return;sk.redo.push(skData(sk.feat));skRestore(sk.hist.pop());sk.sel=[];sk.st={};skChanged();updUndo()}
function sketchRedo(){if(!sk||!sk.redo.length)return;sk.hist.push(skData(sk.feat));skRestore(sk.redo.pop());sk.sel=[];skChanged();updUndo()}

function startSketch(on){
  if(sk)return;if(pm)closePM(true);pickMode=null;prompt_(null);
  let F;try{F=sketchFrame({on},{frames:model.frames,caps:model.caps})}catch(e){toast(e.message);return}
  pushHist();
  const f={id:uid('s'),type:'sketch',name:nextName({type:'sketch'}),on,pts:{},ents:[],cons:[]};
  state.features.push(f);beginSession(f,F,true);
}
function editSketch(id){
  const f=byId(id);if(!f||sk)return;if(pm)closePM(true);cancelPick();
  const F=model.frames[id];if(!F){toast('Çizim düzlemi çözülemedi'+(model.errors[id]?': '+model.errors[id]:'.'));return}
  pushHist();beginSession(f,F,false);
}
function beginSession(f,F,isNew){
  sk={feat:f,F,M:frameMatrix(F),isNew,orig:JSON.stringify(f),tool:null,st:{},sel:[],hover:null,cursor:null,drag:null,hist:[],redo:[],an:null,ok:true,dirty:true,
      opts:{grid:true,rels:true,polyN:6,filletR:5}};
  skGroup.matrix.copy(sk.M);skGroup.matrixWorldNeedsUpdate=true;sel=null;updateSelVisual();setControlsForSketch(true);vpEl.classList.add('sketching');
  cmTab='sketch';renderRibbon();$('#confirm').classList.add('on');$('#sbar').classList.add('on');
  analyze();renderTree();renderPM();updateStatus();updateMass();renderSketchDisplays();updatePlaneVis();normalTo(F);
  if(pendingTool){setTool(pendingTool);pendingTool=null}
  if(!isNew&&autoDefOn())autoDefineSketch(true);
  updUndo();updSbar();
}
function exitSketch(accept){
  if(!sk)return true;const f=sk.feat,wasNew=sk.isNew;
  endChainIfAny();
  if(!accept){if(wasNew)state.features=state.features.filter(x=>x!==f);else Object.assign(f,JSON.parse(sk.orig));hist.undo.pop();pending=null}
  else{cleanupOrphans(f);if(wasNew&&!f.ents.length){state.features=state.features.filter(x=>x!==f);hist.undo.pop();pending=null}
    else if(autoDefOn()&&f.ents.length){try{const n=autoDefine(f).length;if(n){solveSketch(f);toast(`Çizim tam tanımlandı: ${n} ölçü/ilişki otomatik eklendi.`)}}catch(e){}}}
  sk=null;closeDimPop();
  for(const c of [...skGroup.children]){skGroup.remove(c);if(c.geometry)c.geometry.dispose()}
  $('#labels').innerHTML='';setControlsForSketch(false);vpEl.classList.remove('sketching');$('#confirm').classList.remove('on');$('#sbar').classList.remove('on');
  cmTab='features';afterChange();
  const still=byId(f.id);
  if(accept&&pending&&still){const p=pending;pending=null;openNewProfile(p.type,p.op,f.id)}
  else if(accept&&still){sel={kind:'feature',id:f.id};renderTree();renderSketchDisplays()}
  return true;
}
$('#confirm').addEventListener('click',e=>{const b=e.target.closest('[data-cf]');if(!b)return;exitSketch(b.dataset.cf==='ok')});

function analyze(){try{sk.an=analyzeSketch(sk.feat)}catch(e){sk.an=null}}
/* Otomatik tam tanımlama: çizime girerken, çıkarken ve "Tam Tanımla" ile */
const AUTODEF_KEY='tezgah-cad-otomatik-tam-tanimla';
function autoDefOn(){try{return localStorage.getItem(AUTODEF_KEY)!=='0'}catch(e){return true}}
function setAutoDef(on){try{localStorage.setItem(AUTODEF_KEY,on?'1':'0')}catch(e){}}
function autoDefineSketch(silent){
  if(!sk)return 0;const f=sk.feat;if(!f.ents.length){if(!silent)toast('Çizimde öğe yok.');return 0}
  endChainIfAny();skPush();let added=[];
  try{added=autoDefine(f)}catch(e){added=[]}
  if(!added.length){sk.hist.pop();updUndo();if(!silent)toast('Çizim zaten tam tanımlı.');return 0}
  if(!solveSketch(f)){skRestore(sk.hist.pop());toast('Çizim otomatik tanımlanamadı.');skChanged();return 0}
  skChanged();
  const nd=added.filter(c=>DIMT.has(c.t)).length;
  toast(`${nd} ölçü ve ${added.length-nd} ilişki eklendi; çizim tam tanımlı. Ölçüye çift tıklayarak veya soldaki listeden değiştirebilirsin.`,{label:'Geri al',fn:()=>{if(sk&&sk.feat===f)sketchUndo()}});
  return added.length;
}
function skChanged(){analyze();sk.dirty=true;renderSketchPM();updSbar();renderRibbon()}
function cleanupOrphans(f){
  const ids=new Set(f.ents.map(e=>e.id));
  f.cons=f.cons.filter(c=>!(c.e&&!ids.has(c.e))&&!(c.e1&&!ids.has(c.e1))&&!(c.e2&&!ids.has(c.e2)));
  const used=new Set(['O']);for(const e of f.ents){for(const k of ['a','b','c'])if(e[k])used.add(e[k])}
  for(const c of f.cons){if(c.t==='mid'||c.t==='fix'||DIMT.has(c.t)||c.t==='h'||c.t==='v'){if(c.p&&used.has(c.p))continue}}
  const consUsed=new Set();for(const c of f.cons)for(const k of ['p','q'])if(c[k])consUsed.add(c[k]);
  for(const id of Object.keys(f.pts)){if(!used.has(id)){const keep=f.cons.some(c=>c.t==='mid'&&c.p===id);if(!keep)delete f.pts[id]}}
  f.cons=f.cons.filter(c=>!(c.p&&c.p!=='O'&&!f.pts[c.p])&&!(c.q&&c.q!=='O'&&!f.pts[c.q]));
}
function setTool(t){
  if(!sk)return;endChainIfAny();sk.tool=t;sk.st={};sk.op=null;if(t)sk.sel=[];closeDimPop();
  renderRibbon();renderSketchPM();sk.dirty=true;updSbar();
}
function endChainIfAny(){
  if(!sk)return;const st=sk.st;
  if((sk.tool==='line'||sk.tool==='centerline')&&st.start&&st.newStart){const f=sk.feat;const id=st.start;if(!f.ents.some(e=>e.a===id||e.b===id)){delete f.pts[id];f.cons=f.cons.filter(c=>c.p!==id&&c.q!==id)}}
  if(sk.tool&&sk.tool!=='line'&&sk.tool!=='centerline'&&st.newPts){const f=sk.feat;for(const id of st.newPts)if(!f.ents.some(e=>e.a===id||e.b===id||e.c===id)){delete f.pts[id];f.cons=f.cons.filter(c=>c.p!==id&&c.q!==id)}}
  sk.st={};
}

/* ---------- koordinatlar ---------- */
const skPlane=()=>new T.Plane().setFromNormalAndCoplanarPoint(v3(sk.F.n),v3(sk.F.o));
function skLocalXY(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),camera);
  const p=new T.Vector3();if(!ray.ray.intersectPlane(skPlane(),p))return null;
  const d=[p.x-sk.F.o[0],p.y-sk.F.o[1],p.z-sk.F.o[2]];return [vd(d,sk.F.u),vd(d,sk.F.v)];
}
function skPx(cx,cy){const a=skLocalXY(cx,cy),b=skLocalXY(cx+1,cy);if(!a||!b)return modelExtent()/500;return Math.hypot(b[0]-a[0],b[1]-a[1])||1e-3}
function skToScreen(x,y){const w=fpt(sk.F,x,y,0);const s=toScreen(w);return s}
function gridStep(px){return [0.1,0.25,0.5,1,2,5,10,20,50,100].find(s=>s>=px*6)||100}

/* ---------- vurgulama / isabet ---------- */
const P2=id=>{const p=skP(sk.feat,id);return [p.x,p.y]};
function segD(q,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return [Math.hypot(a[0]+dx*t-q[0],a[1]+dy*t-q[1]),[a[0]+dx*t,a[1]+dy*t]]}
function entDist(e,q){
  const f=sk.feat;
  if(e.t==='line')return segD(q,P2(e.a),P2(e.b));
  const c=P2(e.c),r=curveR(f,e);const d=Math.hypot(q[0]-c[0],q[1]-c[1]);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);
  const proj=[c[0]+r*Math.cos(ang),c[1]+r*Math.sin(ang)];
  if(e.t==='circle')return [Math.abs(d-r),proj];
  const A=arcInfo(f,e);let da=ang-A.a0;while(da<0)da+=Math.PI*2;while(da>Math.PI*2)da-=Math.PI*2;
  if(da<=A.sw)return [Math.abs(d-r),proj];
  const a=P2(e.a),b=P2(e.b);const da2=Math.hypot(q[0]-a[0],q[1]-a[1]),db2=Math.hypot(q[0]-b[0],q[1]-b[1]);return da2<db2?[da2,a]:[db2,b];
}
function skHit(q,tol){
  const f=sk.feat;let best=null,bd=tol;
  for(const id of ['O',...Object.keys(f.pts)]){const p=P2(id);const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={k:'pt',id}}}
  if(best)return best;bd=tol;
  for(const e of f.ents){const [d]=entDist(e,q);if(d<bd){bd=d;best={k:'ent',id:e.id}}}
  return best;
}
function skSnap(q,tol,from,exclude){
  const f=sk.feat;let best=null,bd=tol;
  for(const id of ['O',...Object.keys(f.pts)]){if(exclude&&exclude.has(id))continue;const p=P2(id);const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={x:p[0],y:p[1],pid:id}}}
  if(best)return best;
  for(const e of f.ents)if(e.t==='line'&&!(exclude&&(exclude.has(e.a)||exclude.has(e.b)))){const a=P2(e.a),b=P2(e.b);const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(Math.hypot(m[0]-q[0],m[1]-q[1])<tol)return {x:m[0],y:m[1],rel:{t:'mid',e:e.id}}}
  bd=tol*0.8;
  for(const e of f.ents){if(exclude&&(exclude.has(e.a)||exclude.has(e.b)))continue;const [d,p]=entDist(e,q);if(d<bd){bd=d;best={x:p[0],y:p[1],rel:{t:e.t==='line'?'pol':'poc',e:e.id}}}}
  if(best)return best;
  let x=q[0],y=q[1];
  if(sk.opts.grid){const st=gridStep(tol/8);x=Math.round(x/st)*st;y=Math.round(y/st)*st}
  x=Math.round(x*1000)/1000;y=Math.round(y*1000)/1000;
  let hv=null;
  if(from){if(Math.abs(y-from[1])<tol){y=from[1];hv='h'}else if(Math.abs(x-from[0])<tol){x=from[0];hv='v'}}
  return {x,y,hv};
}
function resolvePt(s,added){
  const f=sk.feat;if(s.pid)return s.pid;
  const id=newId(f,'p');f.pts[id]={x:s.x,y:s.y};
  if(s.rel){const c={id:newId(f,'c'),t:s.rel.t,p:id,e:s.rel.e};f.cons.push(c);if(added)added.push(c.id)}
  return id;
}
function addEnt(e){e.id=newId(sk.feat,'e');sk.feat.ents.push(e);return e}
function addCon(c,added){c.id=newId(sk.feat,'c');sk.feat.cons.push(c);if(added)added.push(c.id);return c}
function finishOp(added){
  const f=sk.feat;
  if(!solveSketch(f)){
    if(added&&added.length){f.cons=f.cons.filter(c=>!added.includes(c.id));if(solveSketch(f)){skChanged();return true}}
    if(sk.hist.length)skRestore(sk.hist.pop());toast('Çizim çözülemedi; işlem geri alındı.');skChanged();return false;
  }
  skChanged();return true;
}

/* ---------- işaretçi olayları ---------- */
function skEv(e){const q=skLocalXY(e.clientX,e.clientY);const px=skPx(e.clientX,e.clientY);return {q,px,tol:px*9}}
function skPointerDown(e){
  if(e.button!==0&&e.pointerType==='mouse')return;
  const {q,tol}=skEv(e);if(!q)return;
  if(!sk.tool){const h=skHit(q,tol);if(h&&!(h.k==='pt'&&h.id==='O')){sk.drag={h,q0:q,moved:false,orig:clone({pts:sk.feat.pts,ents:sk.feat.ents})}}}
}
function skPointerMove(e){
  const {q,px,tol}=skEv(e);if(!q)return;sk.cursor=q;sk.px=px;
  $('#sbXY').textContent=`${PLANEAX()[0]}: ${fmt(q[0])}   ${PLANEAX()[1]}: ${fmt(q[1])}`;
  if(sk.drag){
    const d=sk.drag;if(!d.moved&&Math.hypot(q[0]-d.q0[0],q[1]-d.q0[1])>px*3){d.moved=true;skPush()}
    if(d.moved){
      const f=sk.feat,dx=q[0]-d.q0[0],dy=q[1]-d.q0[1];let tg=[];
      if(d.h.k==='pt')tg=[{p:d.h.id,x:q[0],y:q[1]}];
      else{const en=f.ents.find(x=>x.id===d.h.id);const op=d.orig.pts;
        if(en.t==='circle'){const c=P2(en.c);tg=[{e:en.id,r:Math.max(px,Math.hypot(q[0]-c[0],q[1]-c[1]))}]}
        else for(const k of ['a','b','c'])if(en[k]&&op[en[k]])tg.push({p:en[k],x:op[en[k]].x+dx,y:op[en[k]].y+dy});}
      solveSketch(f,tg);sk.dirty=true;
    }
    return;
  }
  if(!sk.tool||sk.tool==='smartdim'||sk.tool==='sfillet'){const h=skHit(q,tol);const k=h?h.k+':'+h.id:null;if(k!==sk.hover){sk.hover=k}}
  else sk.hover=null;
  if(sk.tool==='trim'){let best=null,bd=tol;for(const x of sk.feat.ents){const [d]=entDist(x,q);if(d<bd){bd=d;best=x}}sk.hover=best?'ent:'+best.id:null}
  if(sk.tool==='arc'&&sk.st.c&&sk.st.a){const c=P2(sk.st.c);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);if(sk.st.last!==undefined){let d=ang-sk.st.last;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;sk.st.acc=(sk.st.acc||0)+d}sk.st.last=ang}
  sk.dirty=true;
}
function skPointerUp(e,d){
  const drag=sk.drag;sk.drag=null;
  if(drag&&drag.moved){skChanged();return}
  if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)return;
  if(e.button!==0&&e.pointerType==='mouse')return;
  const ev=skEv(e);if(!ev.q)return;
  if(!sk.tool){const h=skHit(ev.q,ev.tol);if(h)toggleSel(h);else{sk.sel=[];skChanged()}return}
  toolClick(ev.q,ev.px,ev.tol);
}
function skDblClick(e){if(sk.tool==='line'||sk.tool==='centerline'){endChainIfAny();sk.dirty=true}}
function toggleSel(h){const i=sk.sel.findIndex(s=>s.k===h.k&&s.id===h.id);if(i>=0)sk.sel.splice(i,1);else sk.sel.push(h);skChanged()}
const PLANEAX=()=>{const on=sk.feat.on;if(on.kind==='std')return {front:['X','Y'],top:['X','−Z'],right:['−Z','Y']}[on.key];return ['x','y']};

/* ---------- araç tıklamaları ---------- */
function toolClick(q,px,tol){
  const f=sk.feat,st=sk.st,t=sk.tool;
  if(t==='line'||t==='centerline'){
    const from=st.start?P2(st.start):null;const s=skSnap(q,tol,from,null);
    if(!st.start){skPush();st.start=resolvePt(s);st.first=st.start;st.newStart=!s.pid;sk.dirty=true;return}
    if(s.pid===st.start)return;
    const p=P2(st.start);if(!s.pid&&Math.hypot(s.x-p[0],s.y-p[1])<px*2)return;
    if(!st.newStart||sk.hist.length===0)skPush();
    const added=[];const b=resolvePt(s,added);const en=addEnt({t:'line',a:st.start,b,cons:t==='centerline'});
    if(s.hv)addCon({t:s.hv,e:en.id},added);
    else if(s.pid){const q2=P2(b),p0=P2(st.start);const hv=Math.abs(q2[1]-p0[1])<1e-6?'h':(Math.abs(q2[0]-p0[0])<1e-6?'v':null);
      if(hv){const c={t:hv,e:en.id};if(sketchRank(f,[c])>sketchRank(f))addCon(c,added)}}
    const closed=s.pid&&s.pid===st.first;
    st.newStart=false;
    if(!finishOp(added)){sk.st={};return}
    if(closed)sk.st={};else{sk.st.start=b}
    return;
  }
  if(t==='rect'||t==='crect'){
    if(!st.A){skPush();const s=skSnap(q,tol,null,null);st.A=resolvePt(s);st.newPts=s.pid?[]:[st.A];sk.dirty=true;return}
    const A=P2(st.A);const s=skSnap(q,tol,null,new Set([st.A]));
    const cx=s.x,cy=s.y;
    if(t==='rect'){
      if(Math.abs(cx-A[0])<px*2||Math.abs(cy-A[1])<px*2)return;
      const added=[];const C=resolvePt(s,added);const B=newId(f,'p');f.pts[B]={x:cx,y:A[1]};const D=newId(f,'p');f.pts[D]={x:A[0],y:cy};
      const l1=addEnt({t:'line',a:st.A,b:B}),l2=addEnt({t:'line',a:B,b:C}),l3=addEnt({t:'line',a:C,b:D}),l4=addEnt({t:'line',a:D,b:st.A});
      addCon({t:'h',e:l1.id});addCon({t:'v',e:l2.id});addCon({t:'h',e:l3.id});addCon({t:'v',e:l4.id});
      sk.st={};finishOp(added);
    }else{
      const M=A;if(Math.abs(cx-M[0])<px*2||Math.abs(cy-M[1])<px*2)return;
      const added=[];const P1=resolvePt(s,added);const mk=(x,y)=>{const id=newId(f,'p');f.pts[id]={x,y};return id};
      const P2_=mk(2*M[0]-cx,cy),P3=mk(2*M[0]-cx,2*M[1]-cy),P4=mk(cx,2*M[1]-cy);
      const l1=addEnt({t:'line',a:P1,b:P2_}),l2=addEnt({t:'line',a:P2_,b:P3}),l3=addEnt({t:'line',a:P3,b:P4}),l4=addEnt({t:'line',a:P4,b:P1});
      const d1=addEnt({t:'line',a:P1,b:P3,cons:true});addEnt({t:'line',a:P2_,b:P4,cons:true});
      addCon({t:'h',e:l1.id});addCon({t:'v',e:l2.id});addCon({t:'h',e:l3.id});addCon({t:'v',e:l4.id});addCon({t:'mid',p:st.A,e:d1.id});
      sk.st={};finishOp(added);
    }
    return;
  }
  if(t==='circle'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    const c=P2(st.c);const s=skSnap(q,tol,null,new Set([st.c]));const r=Math.hypot(s.x-c[0],s.y-c[1]);if(r<px*2)return;
    const en=addEnt({t:'circle',c:st.c,r:Math.round(r*1000)/1000});const added=[];if(s.pid&&s.pid!=='O')addCon({t:'poc',p:s.pid,e:en.id},added);
    sk.st={};finishOp(added);return;
  }
  if(t==='arc'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    if(!st.a){const c=P2(st.c);const s=skSnap(q,tol,null,new Set([st.c]));if(Math.hypot(s.x-c[0],s.y-c[1])<px*2)return;st.a=resolvePt(s);if(!s.pid)st.newPts.push(st.a);st.acc=0;st.last=Math.atan2(s.y-c[1],s.x-c[0]);sk.dirty=true;return}
    const c=P2(st.c),a=P2(st.a);const r=Math.hypot(a[0]-c[0],a[1]-c[1]);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);
    let s=skSnap(q,tol,null,new Set([st.c,st.a]));let bId;
    if(s.pid&&Math.abs(Math.hypot(s.x-c[0],s.y-c[1])-r)<tol)bId=s.pid;else{bId=newId(f,'p');f.pts[bId]={x:c[0]+r*Math.cos(ang),y:c[1]+r*Math.sin(ang)}}
    if(bId===st.a)return;
    const ccw=(st.acc||0)>=0;addEnt(ccw?{t:'arc',c:st.c,a:st.a,b:bId}:{t:'arc',c:st.c,a:bId,b:st.a});
    sk.st={};finishOp([]);return;
  }
  if(t==='slot'){
    if(!st.c1){skPush();const s=skSnap(q,tol,null,null);st.c1=resolvePt(s);st.newPts=s.pid?[]:[st.c1];sk.dirty=true;return}
    if(!st.c2){const s=skSnap(q,tol,P2(st.c1),new Set([st.c1]));const a=P2(st.c1);if(Math.hypot(s.x-a[0],s.y-a[1])<px*3)return;st.c2=resolvePt(s);st.hv=s.hv;if(!s.pid)st.newPts.push(st.c2);sk.dirty=true;return}
    const a=P2(st.c1),b=P2(st.c2);let d=[b[0]-a[0],b[1]-a[1]];const L=Math.hypot(d[0],d[1]);d=[d[0]/L,d[1]/L];const nr=[-d[1],d[0]];
    let r=Math.abs((q[0]-a[0])*nr[0]+(q[1]-a[1])*nr[1]);if(r<px*2)return;r=Math.round(r*1000)/1000;
    const mk=(x,y)=>{const id=newId(f,'p');f.pts[id]={x,y};return id};
    const p1=mk(a[0]+nr[0]*r,a[1]+nr[1]*r),p2=mk(b[0]+nr[0]*r,b[1]+nr[1]*r),p3=mk(b[0]-nr[0]*r,b[1]-nr[1]*r),p4=mk(a[0]-nr[0]*r,a[1]-nr[1]*r);
    const cl=addEnt({t:'line',a:st.c1,b:st.c2,cons:true});const l1=addEnt({t:'line',a:p1,b:p2}),l2=addEnt({t:'line',a:p3,b:p4});
    const a2=addEnt({t:'arc',c:st.c2,a:p3,b:p2}),a1=addEnt({t:'arc',c:st.c1,a:p1,b:p4});
    const added=[];if(st.hv)addCon({t:st.hv,e:cl.id},added);
    addCon({t:'tan',e1:l1.id,e2:a1.id});addCon({t:'tan',e1:l1.id,e2:a2.id});addCon({t:'tan',e1:l2.id,e2:a1.id});addCon({t:'tan',e1:l2.id,e2:a2.id});addCon({t:'eq',e1:a1.id,e2:a2.id});
    sk.st={};finishOp(added);return;
  }
  if(t==='polygon'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    const c=P2(st.c);const s=skSnap(q,tol,null,new Set([st.c]));const r=Math.hypot(s.x-c[0],s.y-c[1]);if(r<px*3)return;
    const n=Math.max(3,Math.min(32,Math.round(sk.opts.polyN)||6));const a0=Math.atan2(s.y-c[1],s.x-c[0]);
    const circ=addEnt({t:'circle',c:st.c,r,cons:true});const vsx=[];
    for(let i=0;i<n;i++){const id=newId(f,'p');f.pts[id]={x:c[0]+r*Math.cos(a0+i*2*Math.PI/n),y:c[1]+r*Math.sin(a0+i*2*Math.PI/n)};vsx.push(id)}
    const ls=[];for(let i=0;i<n;i++)ls.push(addEnt({t:'line',a:vsx[i],b:vsx[(i+1)%n]}));
    for(const id of vsx)addCon({t:'poc',p:id,e:circ.id});for(let i=1;i<n;i++)addCon({t:'eq',e1:ls[0].id,e2:ls[i].id});
    sk.st={};finishOp([]);return;
  }
  if(t==='sfillet'){
    const h=skHit(q,tol);if(!h||h.k!=='pt'){toast('İki çizginin birleştiği köşe noktasına tıkla.');return}
    sketchFillet(h.id);return;
  }
  if(t==="trim"){trimAt(q,tol);return}
  if(t==="smartdim"){skDimClick(q,px,tol);return}
}
function sketchFillet(pid){
  const f=sk.feat;const ls=f.ents.filter(e=>e.t==='line'&&(e.a===pid||e.b===pid));
  if(ls.length!==2){toast('Bu nokta tam olarak iki çizgiyi birleştirmiyor.');return}
  const r=num(sk.opts.filletR);if(!(r>0)){toast('Geçerli bir yarıçap gir.');return}
  const P=P2(pid);const oth=l=>P2(l.a===pid?l.b:l.a);const A=oth(ls[0]),B=oth(ls[1]);
  let u1=[A[0]-P[0],A[1]-P[1]],u2=[B[0]-P[0],B[1]-P[1]];const L1=Math.hypot(...u1),L2=Math.hypot(...u2);u1=[u1[0]/L1,u1[1]/L1];u2=[u2[0]/L2,u2[1]/L2];
  const th=Math.acos(Math.max(-1,Math.min(1,u1[0]*u2[0]+u1[1]*u2[1])));if(th<0.01||th>Math.PI-0.01){toast('Çizgiler doğrusal; radyus eklenemez.');return}
  const td=r/Math.tan(th/2);if(td>=L1-1e-6||td>=L2-1e-6){toast('Yarıçap bu köşe için çok büyük.');return}
  skPush();
  let bis=[u1[0]+u2[0],u1[1]+u2[1]];const bl=Math.hypot(...bis);bis=[bis[0]/bl,bis[1]/bl];
  const C=[P[0]+bis[0]*r/Math.sin(th/2),P[1]+bis[1]*r/Math.sin(th/2)];
  const t1=newId(f,'p');f.pts[t1]={x:P[0]+u1[0]*td,y:P[1]+u1[1]*td};const t2=newId(f,'p');f.pts[t2]={x:P[0]+u2[0]*td,y:P[1]+u2[1]*td};const cc=newId(f,'p');f.pts[cc]={x:C[0],y:C[1]};
  if(ls[0].a===pid)ls[0].a=t1;else ls[0].b=t1;if(ls[1].a===pid)ls[1].a=t2;else ls[1].b=t2;
  const a1=Math.atan2(f.pts[t1].y-C[1],f.pts[t1].x-C[0]),a2=Math.atan2(f.pts[t2].y-C[1],f.pts[t2].x-C[0]);let sw=a2-a1;while(sw<0)sw+=Math.PI*2;
  const arc=addEnt(sw<=Math.PI?{t:'arc',c:cc,a:t1,b:t2}:{t:'arc',c:cc,a:t2,b:t1});
  const removed=f.cons.filter(c=>c.p===pid||c.q===pid).length;
  f.cons=f.cons.filter(c=>c.p!==pid&&c.q!==pid);
  if(pid!=='O'&&!f.ents.some(e=>e.a===pid||e.b===pid||e.c===pid))delete f.pts[pid];
  addCon({t:'tan',e1:ls[0].id,e2:arc.id});addCon({t:'tan',e1:ls[1].id,e2:arc.id});
  addCon({t:'drad',e:arc.id,val:r,lp:[C[0]-bis[0]*(r+sk.px*30||r*1.6),C[1]-bis[1]*(r+sk.px*30||r*1.6)]});
  if(finishOp([])&&removed)toast(`Köşedeki ${removed} ilişki/ölçü kaldırıldı.`);
}

/* ---------- akıllı ölçülendirme ---------- */
function measure(c){
  const f=sk?sk.feat:null;const E=entMap(f);const P=P2;
  const lpd=(e,p)=>{const a=P(e.a),b=P(e.b),q=P(p);const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1e-12;return Math.abs(((q[0]-a[0])*dy-(q[1]-a[1])*dx)/l)};
  switch(c.t){
    case 'd':{const a=P(c.p),b=P(c.q);return Math.hypot(b[0]-a[0],b[1]-a[1])}
    case 'dh':return Math.abs(P(c.q)[0]-P(c.p)[0]);
    case 'dv':return Math.abs(P(c.q)[1]-P(c.p)[1]);
    case 'dpl':return lpd(E[c.e],c.p);
    case 'dll':return lpd(E[c.e1],E[c.e2].a);
    case 'ddia':return 2*curveR(f,E[c.e]);
    case 'drad':return curveR(f,E[c.e]);
    case 'dang':{const d=e=>{const a=P(e.a),b=P(e.b);const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/l,(b[1]-a[1])/l]};let a=d(E[c.e1]),b=d(E[c.e2]);if(c.r1)a=[-a[0],-a[1]];if(c.r2)b=[-b[0],-b[1]];return Math.atan2(Math.abs(a[0]*b[1]-a[1]*b[0]),a[0]*b[0]+a[1]*b[1])*180/Math.PI}
  }
  return 0;
}
function lineIntersect(e1,e2){const a=P2(e1.a),b=P2(e1.b),c=P2(e2.a),d=P2(e2.b);const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]];const den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den;return [a[0]+r[0]*t,a[1]+r[1]*t]}
function dimCandidate(q){
  const st=sk.st,f=sk.feat,E=entMap(f);const picks=st.picks||[];if(!picks.length)return null;
  const isCurve=h=>h.k==='ent'&&E[h.id]&&E[h.id].t!=='line';const isLine=h=>h.k==='ent'&&E[h.id]&&E[h.id].t==='line';
  const ptOf=h=>h.k==='pt'?h.id:(isCurve(h)?E[h.id].c:null);
  if(picks.length===1){
    const h=picks[0];
    if(isCurve(h)){const e=E[h.id];return {t:e.t==='circle'?'ddia':'drad',e:e.id}}
    if(isLine(h)){const e=E[h.id];return {t:'d',p:e.a,q:e.b,line:true}}
    return null;
  }
  const [h1,h2]=picks;
  if(isLine(h1)&&isLine(h2)){
    const e1=E[h1.id],e2=E[h2.id];const a=P2(e1.a),b=P2(e1.b),c=P2(e2.a),d=P2(e2.b);
    const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]];const cr=Math.abs(u[0]*v[1]-u[1]*v[0])/(Math.hypot(...u)*Math.hypot(...v));
    if(cr<1e-3)return {t:'dll',e1:e1.id,e2:e2.id};
    const X=lineIntersect(e1,e2);const w=q&&X?[q[0]-X[0],q[1]-X[1]]:[1,1];
    const un=s=>{const l=Math.hypot(...s);return [s[0]/l,s[1]/l]};const ua=un(u),vb=un(v);
    return {t:'dang',e1:e1.id,e2:e2.id,r1:(ua[0]*w[0]+ua[1]*w[1])<0,r2:(vb[0]*w[0]+vb[1]*w[1])<0};
  }
  if(isLine(h1)!==isLine(h2)){const L=isLine(h1)?h1:h2,O=isLine(h1)?h2:h1;const p=ptOf(O);if(p)return {t:'dpl',p,e:L.id};return null}
  const p=ptOf(h1),r=ptOf(h2);if(!p||!r||p===r)return null;
  // nokta-nokta: imleç konumuna göre yatay / dikey / hizalı
  const a=P2(p),b=P2(r);let kind='d';
  if(q){const mnx=Math.min(a[0],b[0]),mxx=Math.max(a[0],b[0]),mny=Math.min(a[1],b[1]),mxy=Math.max(a[1],b[1]);const ox=q[0]<mnx||q[0]>mxx,oy=q[1]<mny||q[1]>mxy;
    if(Math.abs(a[0]-b[0])<1e-9)kind='dv';else if(Math.abs(a[1]-b[1])<1e-9)kind='dh';else if(oy&&!ox)kind='dh';else if(ox&&!oy)kind='dv';else kind='d'}
  return {t:kind,p,q:r};
}
function skDimClick(q,px,tol){
  const st=sk.st;st.picks=st.picks||[];
  const h=skHit(q,tol);
  if(h&&st.picks.length<2&&!st.picks.some(x=>x.k===h.k&&x.id===h.id)){
    const E=entMap(sk.feat);
    if(st.picks.length===0&&h.k==='ent'&&E[h.id].t!=='line'){st.picks=[h];sk.dirty=true;return}
    st.picks.push(h);sk.dirty=true;
    if(st.picks.length===2&&!dimCandidate(q)){toast('Bu iki öğe arasında ölçü verilemiyor.');st.picks=[];}
    return;
  }
  const c=dimCandidate(q);if(!c){st.picks=[];sk.dirty=true;return}
  delete c.line;c.lp=[q[0],q[1]];c.val=measure(c);
  const f=sk.feat;
  if(c.val<1e-9&&c.t!=='dang'){toast('Sıfır uzunlukta ölçü verilemez.');st.picks=[];return}
  const r0=sketchRank(f),r1=sketchRank(f,[c]);
  if(r1<=r0){toast('Bu ölçü çizimi aşırı tanımlar. Önce çakışan ilişkiyi veya ölçüyü sil.');st.picks=[];sk.dirty=true;return}
  skPush();c.id=newId(f,'c');c.val=Math.round(c.val*1e4)/1e4;f.cons.push(c);solveSketch(f);
  st.picks=[];skChanged();
  requestAnimationFrame(()=>openDimPop(c.id));
}

/* ---------- ölçü düzenleme kutusu ---------- */
let dimPopEl=null;
function closeDimPop(){if(dimPopEl){dimPopEl.remove();dimPopEl=null}}
function openDimPop(cid){
  closeDimPop();if(!sk)return;const c=sk.feat.cons.find(x=>x.id===cid);if(!c)return;
  const s=skToScreen(c.lp[0],c.lp[1]);const el=document.createElement('div');el.className='pop';
  el.innerHTML=`<input inputmode="decimal" value="${String(Math.round(c.val*1e4)/1e4).replace('.',',')}" aria-label="Ölçü değeri"><button class="ok" aria-label="Uygula">${IC.ok}</button><button aria-label="Kapat">${IC.x}</button>`;
  const r=vpEl.getBoundingClientRect();el.style.left=Math.max(4,Math.min(r.width-180,s[0]+10))+'px';el.style.top=Math.max(4,Math.min(r.height-50,s[1]+10))+'px';
  vpEl.appendChild(el);dimPopEl=el;const inp=el.querySelector('input');inp.focus();inp.select();
  const apply=()=>{const v=num(inp.value);if(!(isFinite(v)&&(v>0||(c.t==='dang'&&v>=0)))){inp.style.borderColor='var(--warn)';return}setDimVal(c.id,v);closeDimPop()};
  el.querySelector('.ok').onclick=apply;el.querySelectorAll('button')[1].onclick=closeDimPop;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();apply()}if(e.key==='Escape'){e.stopPropagation();closeDimPop()}});
}
function setDimVal(cid,v){
  const f=sk.feat;const c=f.cons.find(x=>x.id===cid);if(!c)return;skPush();const old=c.val;c.val=v;
  if(!solveSketch(f)){c.val=old;solveSketch(f);sk.hist.pop();toast('Çizim bu değerle çözülemiyor.')}
  skChanged();
}

/* ---------- etiketler (ölçü değerleri ve ilişki simgeleri) ---------- */
let labelItems=[];
const lblEl=$('#labels');
lblEl.addEventListener('pointerdown',e=>{
  const t=e.target.closest('[data-cid]');if(!t||!sk)return;e.preventDefault();e.stopPropagation();
  const cid=t.dataset.cid;const c=sk.feat.cons.find(x=>x.id===cid);if(!c)return;
  if(t.classList.contains('dlab')&&(!sk.tool||sk.tool==='smartdim')){sk.ldrag={cid,x:e.clientX,y:e.clientY,moved:false};t.setPointerCapture(e.pointerId)}
  else{toggleSel({k:'con',id:cid})}
});
lblEl.addEventListener('pointermove',e=>{
  if(!sk||!sk.ldrag)return;const d=sk.ldrag;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>4){d.moved=true;skPush()}
  if(d.moved){const q=skLocalXY(e.clientX,e.clientY);const c=sk.feat.cons.find(x=>x.id===d.cid);if(q&&c){c.lp=q;sk.dirty=true}}
});
lblEl.addEventListener('pointerup',e=>{if(!sk||!sk.ldrag)return;const d=sk.ldrag;sk.ldrag=null;if(!d.moved)toggleSel({k:'con',id:d.cid})});
lblEl.addEventListener('dblclick',e=>{const t=e.target.closest('.dlab');if(t&&sk)openDimPop(t.dataset.cid)});
function placeLabels(){
  for(const it of labelItems){const s=skToScreen(it.x,it.y);it.el.style.left=s[0]+'px';it.el.style.top=s[1]+'px';it.el.style.display=s[2]>1?'none':''}
}

/* ---------- çizim görüntüsü ---------- */
function skColors(){const d=isDark();return {def:d?0xE8EDF2:0x10151C,und:d?0x6FA8FF:0x1A64E0,sel:0xF08A1A,hov:0xF0A845,prev:d?0x9CC3FF:0x3A7BE8,origin:0xD0453A,snap:0xF08A1A}}
const hex=c=>new T.Color(c);
function dimGeo(f,c,px){
  const E=entMap(f);const P=id=>{const p=skP(f,id);return [p.x,p.y]};const segs=[];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],un=a=>{const l=Math.hypot(a[0],a[1]);return l>1e-12?[a[0]/l,a[1]/l]:[1,0]};
  const ar=(tip,d)=>{const s=px*10,w=px*3.4,b=sub(tip,mul(d,s));segs.push([tip[0],tip[1],b[0]-d[1]*w,b[1]+d[0]*w],[tip[0],tip[1],b[0]+d[1]*w,b[1]-d[0]*w])};
  const ext=(A,Q)=>{const d=sub(Q,A),l=Math.hypot(d[0],d[1]);if(l<px*5)return;const u=mul(d,1/l);const s=add(A,mul(u,px*4)),e=add(Q,mul(u,px*7));segs.push([s[0],s[1],e[0],e[1]])};
  const lp=c.lp||[0,0];
  const linear=(A,B,Aq,Bq)=>{ext(A,Aq);ext(B,Bq);segs.push([Aq[0],Aq[1],Bq[0],Bq[1]]);const d=un(sub(Bq,Aq));ar(Aq,mul(d,-1));ar(Bq,d);
    const L=Math.hypot(...sub(Bq,Aq));const t=(lp[0]-Aq[0])*d[0]+(lp[1]-Aq[1])*d[1];if(t<0)segs.push([Aq[0],Aq[1],Aq[0]+d[0]*t,Aq[1]+d[1]*t]);if(t>L)segs.push([Bq[0],Bq[1],Aq[0]+d[0]*t,Aq[1]+d[1]*t])};
  const aligned=(A,B)=>{const d=un(sub(B,A)),n=[-d[1],d[0]];const off=(lp[0]-A[0])*n[0]+(lp[1]-A[1])*n[1];linear(A,B,add(A,mul(n,off)),add(B,mul(n,off)))};
  const foot=(e,p)=>{const a=P(e.a),b=P(e.b),d=un(sub(b,a));const t=(p[0]-a[0])*d[0]+(p[1]-a[1])*d[1];return add(a,mul(d,t))};
  let text=fmt(c.val,3);
  try{
  switch(c.t){
    case 'd':aligned(P(c.p),P(c.q));break;
    case 'dh':{const A=P(c.p),B=P(c.q);linear(A,B,[A[0],lp[1]],[B[0],lp[1]]);break}
    case 'dv':{const A=P(c.p),B=P(c.q);linear(A,B,[lp[0],A[1]],[lp[0],B[1]]);break}
    case 'dpl':{const A=P(c.p);aligned(A,foot(E[c.e],A));break}
    case 'dll':{const A=P(E[c.e2].a);aligned(A,foot(E[c.e1],A));break}
    case 'ddia':case 'drad':{
      const e=E[c.e];const C=P(e.c),r=curveR(f,e);const d=un(sub(lp,C));const B=add(C,mul(d,r));
      if(c.t==='ddia'){const A=sub(C,mul(d,r));segs.push([A[0],A[1],B[0],B[1]]);ar(A,mul(d,-1));ar(B,d);text='Ø'+text}
      else{segs.push([C[0],C[1],B[0],B[1]]);ar(B,d);text='R'+text}
      if(Math.hypot(...sub(lp,C))>r)segs.push([B[0],B[1],lp[0],lp[1]]);break}
    case 'dang':{
      const e1=E[c.e1],e2=E[c.e2];const X=lineIntersect(e1,e2);text=fmt(c.val,2)+'°';if(!X)break;
      let a=un(sub(P(e1.b),P(e1.a))),b=un(sub(P(e2.b),P(e2.a)));if(c.r1)a=mul(a,-1);if(c.r2)b=mul(b,-1);
      const rr=Math.max(px*20,Math.hypot(...sub(lp,X)));let t0=Math.atan2(a[1],a[0]),t1=Math.atan2(b[1],b[0]);let sw=t1-t0;while(sw>Math.PI)sw-=2*Math.PI;while(sw<-Math.PI)sw+=2*Math.PI;
      const N=24;let prev=null;for(let i=0;i<=N;i++){const t=t0+sw*i/N;const p=[X[0]+rr*Math.cos(t),X[1]+rr*Math.sin(t)];if(prev)segs.push([prev[0],prev[1],p[0],p[1]]);prev=p}
      break}
  }}catch(err){}
  return {segs,text};
}
function relAnchors(f,c,px){
  const E=entMap(f);const P=id=>{const p=skP(f,id);return [p.x,p.y]};const out=[];const off=px*13;
  const entMid=id=>{const e=E[id];if(!e)return null;if(e.t==='line'){const a=P(e.a),b=P(e.b);const d=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d)||1;return [(a[0]+b[0])/2-d[1]/l*off,(a[1]+b[1])/2+d[0]/l*off]}const C=P(e.c),r=curveR(f,e);let ang=Math.PI/4;if(e.t==='arc'){const A=arcInfo(f,e);ang=A.a0+A.sw/2}return [C[0]+(r+off)*Math.cos(ang),C[1]+(r+off)*Math.sin(ang)]};
  if(c.e&&!c.p)out.push(entMid(c.e));
  if(c.e1){out.push(entMid(c.e1));out.push(entMid(c.e2))}
  if(c.p&&!c.e1){const p=P(c.p);if(c.q){const q=P(c.q);out.push([(p[0]+q[0])/2+off*.6,(p[1]+q[1])/2+off*.6])}else out.push([p[0]+off*.8,p[1]+off*.8])}
  return out.filter(Boolean);
}
function entColor(e,C){
  const s=sk.sel.some(x=>x.k==='ent'&&x.id===e.id);if(s)return C.sel;if(sk.hover==='ent:'+e.id)return C.hov;
  const a=sk.an;if(!a)return C.und;
  const def=e.t==='line'?a.ptDef(e.a)&&a.ptDef(e.b):e.t==='circle'?a.ptDef(e.c)&&a.rDef(e.id):a.ptDef(e.c)&&a.ptDef(e.a)&&a.ptDef(e.b);
  return def?C.def:C.und;
}
function renderSketch(){
  if(!sk)return;
  for(const c of [...skGroup.children]){skGroup.remove(c);if(c.geometry)c.geometry.dispose();if(c.material&&c.material.dispose)c.material.dispose()}
  const f=sk.feat,C=skColors();const r=vpEl.getBoundingClientRect();
  const px=skPx(r.left+r.width/2,r.top+r.height/2);sk.px=px;
  const sol=[],solC=[],dash=[],dashC=[],pts=[],ptsC=[];
  const pushSeg=(arr,carr,a,b,col)=>{arr.push(a[0],a[1],0,b[0],b[1],0);const k=hex(col);carr.push(k.r,k.g,k.b,k.r,k.g,k.b)};
  for(const e of f.ents){
    const col=entColor(e,C);const t=tessEnt(f,e,72);const A=e.cons?dash:sol,AC=e.cons?dashC:solC;
    for(let i=0;i<t.length-1;i++)pushSeg(A,AC,t[i],t[i+1],col);
  }
  const usedPts=new Set();for(const e of f.ents)for(const k of ['a','b','c'])if(e[k])usedPts.add(e[k]);for(const id of Object.keys(f.pts))usedPts.add(id);
  for(const id of usedPts){if(id==='O')continue;const p=skP(f,id);if(!p)continue;const s=sk.sel.some(x=>x.k==='pt'&&x.id===id);const h=sk.hover==='pt:'+id;const col=s?C.sel:h?C.hov:(sk.an&&sk.an.ptDef(id)?C.def:C.und);pts.push(p.x,p.y,0);const k=hex(col);ptsC.push(k.r,k.g,k.b)}
  // orijin
  const L=px*28;pushSeg(sol,solC,[0,0],[L,0],C.origin);pushSeg(sol,solC,[0,0],[0,L],C.origin);
  pushSeg(sol,solC,[L,0],[L-px*7,px*3.5],C.origin);pushSeg(sol,solC,[L,0],[L-px*7,-px*3.5],C.origin);pushSeg(sol,solC,[0,L],[px*3.5,L-px*7],C.origin);pushSeg(sol,solC,[0,L],[-px*3.5,L-px*7],C.origin);
  {const s=sk.sel.some(x=>x.k==='pt'&&x.id==='O'),h=sk.hover==='pt:O';pts.push(0,0,0);const k=hex(s?C.sel:h?C.hov:C.origin);ptsC.push(k.r,k.g,k.b)}
  // ölçüler
  const labels=[];
  for(const c of f.cons){
    if(DIMT.has(c.t)){
      const g=dimGeo(f,c,px);const s=sk.sel.some(x=>x.k==='con'&&x.id===c.id);const col=s?C.sel:C.def;
      for(const q of g.segs)pushSeg(sol,solC,[q[0],q[1]],[q[2],q[3]],col);
      labels.push({x:c.lp[0],y:c.lp[1],cls:'dlab'+(s?' sel':''),cid:c.id,html:esc(g.text)});
    }else if(sk.opts.rels||sk.sel.length){
      const s=sk.sel.some(x=>x.k==='con'&&x.id===c.id);
      const involved=sk.sel.some(x=>(x.k==='ent'&&(c.e===x.id||c.e1===x.id||c.e2===x.id))||(x.k==='pt'&&(c.p===x.id||c.q===x.id)));
      if(!sk.opts.rels&&!involved&&!s)continue;
      for(const a of relAnchors(f,c,px))labels.push({x:a[0],y:a[1],cls:'rlab'+(s?' sel':''),cid:c.id,html:esc((REL[c.t]||['',''])[1])});
    }
  }
  // araç önizlemesi
  const st=sk.st,q=sk.cursor;
  if(q&&sk.tool&&sk.tool!=='smartdim'&&sk.tool!=='sfillet'){
    const tol=px*9;const P=id=>P2(id);
    const pv=(a,b)=>pushSeg(sol,solC,a,b,C.prev);
    let s=null;
    if((sk.tool==='line'||sk.tool==='centerline')){s=skSnap(q,tol,st.start?P(st.start):null,null);if(st.start)(sk.tool==='centerline'?(dash.push(...P(st.start),0,s.x,s.y,0),dashC.push(...hexArr(C.prev),...hexArr(C.prev))):pv(P(st.start),[s.x,s.y]));
      if(s.hv)labels.push({x:s.x+px*14,y:s.y+px*14,cls:'rlab',cid:'',html:s.hv==='h'?'—':'|'})}
    else if(sk.tool==='rect'||sk.tool==='crect'){s=skSnap(q,tol,null,st.A?new Set([st.A]):null);if(st.A){const A=P(st.A);let a,b;if(sk.tool==='rect'){a=A;b=[s.x,s.y]}else{a=[2*A[0]-s.x,2*A[1]-s.y];b=[s.x,s.y]}pv([a[0],a[1]],[b[0],a[1]]);pv([b[0],a[1]],[b[0],b[1]]);pv([b[0],b[1]],[a[0],b[1]]);pv([a[0],b[1]],[a[0],a[1]])}}
    else if(sk.tool==='circle'||sk.tool==='polygon'){s=skSnap(q,tol,null,st.c?new Set([st.c]):null);if(st.c){const c=P(st.c);const r=Math.hypot(s.x-c[0],s.y-c[1]);const n=sk.tool==='circle'?72:Math.max(3,Math.round(sk.opts.polyN)||6);const a0=Math.atan2(s.y-c[1],s.x-c[0]);let prev=null;for(let i=0;i<=n;i++){const t=a0+i*2*Math.PI/n;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}
    else if(sk.tool==='arc'){s=skSnap(q,tol,null,null);if(st.c&&!st.a)pv(P(st.c),[s.x,s.y]);if(st.c&&st.a){const c=P(st.c),a=P(st.a);const r=Math.hypot(a[0]-c[0],a[1]-c[1]);const a0=Math.atan2(a[1]-c[1],a[0]-c[0]);const acc=st.acc||0;const N=Math.max(4,Math.ceil(Math.abs(acc)/(Math.PI*2)*72));let prev=null;for(let i=0;i<=N;i++){const t=a0+acc*i/N;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}
    else if(sk.tool==='slot'){s=skSnap(q,tol,st.c1&&!st.c2?P(st.c1):null,null);if(st.c1&&!st.c2)pv(P(st.c1),[s.x,s.y]);if(st.c1&&st.c2){const a=P(st.c1),b=P(st.c2);let d=[b[0]-a[0],b[1]-a[1]];const l=Math.hypot(...d);d=[d[0]/l,d[1]/l];const n=[-d[1],d[0]];const r=Math.abs((q[0]-a[0])*n[0]+(q[1]-a[1])*n[1]);pv([a[0]+n[0]*r,a[1]+n[1]*r],[b[0]+n[0]*r,b[1]+n[1]*r]);pv([a[0]-n[0]*r,a[1]-n[1]*r],[b[0]-n[0]*r,b[1]-n[1]*r]);const ba=Math.atan2(d[1],d[0]);for(const [c,o] of [[b,-Math.PI/2],[a,Math.PI/2]]){let prev=null;for(let i=0;i<=24;i++){const t=ba+o+Math.PI*i/24;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}}
    if(s){pts.push(s.x,s.y,0);const k=hex(s.pid||s.rel?C.snap:C.prev);ptsC.push(k.r,k.g,k.b);if(s.rel&&s.rel.t==='mid')labels.push({x:s.x+px*12,y:s.y+px*12,cls:'rlab',cid:'',html:'M'})}
  }
  if(sk.tool==='smartdim'&&q){
    for(const h of (st.picks||[])){if(h.k==='ent'){const e=f.ents.find(x=>x.id===h.id);if(e){const t=tessEnt(f,e,72);for(let i=0;i<t.length-1;i++)pushSeg(sol,solC,t[i],t[i+1],C.sel)}}else{const p=P2(h.id);pts.push(p[0],p[1],0);const k=hex(C.sel);ptsC.push(k.r,k.g,k.b)}}
    const c=dimCandidate(q);if(c&&(st.picks||[]).length&&(c.t==='ddia'||c.t==='drad'||(st.picks.length===2)||c.line)){c.lp=q;try{c.val=measure(c);const g=dimGeo(f,c,px);for(const s2 of g.segs)pushSeg(sol,solC,[s2[0],s2[1]],[s2[2],s2[3]],C.prev);labels.push({x:q[0],y:q[1],cls:'dlab',cid:'',html:esc(g.text)})}catch(e){}}
  }
  const mk=(arr,carr,mat)=>{if(!arr.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.setAttribute('color',new T.Float32BufferAttribute(carr,3));const o=new T.LineSegments(g,mat);if(mat.isLineDashedMaterial)o.computeLineDistances();o.renderOrder=20;o.frustumCulled=false;skGroup.add(o)};
  mk(sol,solC,new T.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true}));
  mk(dash,dashC,new T.LineDashedMaterial({vertexColors:true,depthTest:false,transparent:true,dashSize:px*8,gapSize:px*4}));
  if(pts.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setAttribute('color',new T.Float32BufferAttribute(ptsC,3));const o=new T.Points(g,new T.PointsMaterial({size:7,sizeAttenuation:false,vertexColors:true,depthTest:false,transparent:true}));o.renderOrder=21;o.frustumCulled=false;skGroup.add(o)}
  skGroup.updateMatrixWorld(true);
  // HTML etiketleri
  lblEl.innerHTML=labels.map((l,i)=>`<div class="${l.cls}" data-i="${i}" ${l.cid?`data-cid="${l.cid}"`:''} style="${l.cid?'':'pointer-events:none;'}">${l.html}</div>`).join('');
  labelItems=labels.map((l,i)=>({x:l.x,y:l.y,el:lblEl.children[i]}));placeLabels();
}
const hexArr=c=>{const k=hex(c);return [k.r,k.g,k.b]};
function renderSketchDisplays(){
  for(const c of [...sketchesGroup.children]){sketchesGroup.remove(c);if(c.geometry)c.geometry.dispose()}
  const cons=consumedMap();
  for(const f of state.features){
    if(f.type!=='sketch'||f.suppressed||(sk&&sk.feat===f))continue;
    const show=!cons[f.id]||(sel&&sel.kind==='feature'&&(sel.id===f.id||sel.id===cons[f.id]))||(pm&&pm.draft&&pm.draft.sketch===f.id);
    if(!show)continue;const F=model.frames[f.id];if(!F)continue;
    const arr=[];for(const e of f.ents){const t=tessEnt(f,e,64);for(let i=0;i<t.length-1;i++){arr.push(...fpt(F,t[i][0],t[i][1]),...fpt(F,t[i+1][0],t[i+1][1]))}}
    if(!arr.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));
    const o=new T.LineSegments(g,new T.LineBasicMaterial({color:(sel&&sel.kind==='feature'&&sel.id===f.id)?0xF08A1A:0x3D6FC2,depthTest:false,transparent:true,opacity:.9}));o.renderOrder=6;sketchesGroup.add(o);
  }
}

/* ---------- çizim PropertyManager ---------- */
function itemName(h){
  if(h.k==='pt')return h.id==='O'?'Orijin':'Nokta';
  if(h.k==='con'){const c=sk.feat.cons.find(x=>x.id===h.id);if(!c)return '?';return DIMT.has(c.t)?'Ölçü '+fmt(c.val,3):(REL[c.t]||[c.t])[0]}
  const e=sk.feat.ents.find(x=>x.id===h.id);if(!e)return '?';return e.t==='line'?(e.cons?'Merkez/yapı çizgisi':'Çizgi'):e.t==='circle'?(e.cons?'Yapı dairesi':'Daire'):'Yay';
}
function selGroups(){
  const E=entMap(sk.feat);const P=[],Ls=[],Cs=[],Cn=[];
  for(const h of sk.sel){if(h.k==='pt')P.push(h.id);else if(h.k==='con')Cn.push(h.id);else{const e=E[h.id];if(!e)continue;(e.t==='line'?Ls:Cs).push(e)}}
  return {P,Ls,Cs,Cn};
}
function availRels(){
  const {P,Ls,Cs}=selGroups();const out=[];const n=P.length+Ls.length+Cs.length;if(!n)return out;
  if(Ls.length&&!P.length&&!Cs.length){out.push('h','v');if(Ls.length>=2)out.push('par','eq');if(Ls.length===2)out.push('perp','coll')}
  if(P.length>=2&&!Ls.length&&!Cs.length){out.push('h','v');if(P.length===2)out.push('coin')}
  if(P.length===1&&Ls.length===1&&!Cs.length)out.push('coin','mid');
  if(P.length===1&&Cs.length===1&&!Ls.length)out.push('coin');
  if(Ls.length===1&&Cs.length===1&&!P.length)out.push('tan');
  if(Cs.length>=2&&!P.length&&!Ls.length){out.push('eq');if(Cs.length===2)out.push('conc','tan')}
  if((P.length||Ls.length||Cs.length)&&!(P.length===1&&P[0]==='O'&&n===1))out.push('fix');
  return out;
}
function renderSketchPM(){
  const el=$('#pm');if(!sk)return;const f=sk.feat;
  const dof=sk.an?sk.an.dof:null;
  const stc=sk.ok===false?'over':(dof===0?'full':'under');
  const stt=stc==='over'?'Çözülemedi (aşırı tanımlı)':(dof===0?'Tam tanımlı':`Tam tanımlanmamış (${dof} serbestlik derecesi)`);
  let b=`<div class="grp"><div class="stat ${stc}"><i></i>${stt}</div><p class="note" style="margin-top:6px">Mavi öğeler henüz tanımlanmamış, siyahlar tam tanımlı. Ölçü ve ilişki ekleyerek çizimi tam tanımla.</p></div>`;
  if(sk.op)b+=skOpBody();
  if(sk.tool){
    let o=`<p class="note">${esc(TOOLHELP[sk.tool]||'')}</p>`;
    if(sk.tool==='polygon')o+=fNum('Kenar sayısı','polyN','adet',sk.opts);
    if(sk.tool==='sfillet')o+=fNum('Radyus yarıçapı','filletR','mm',sk.opts);
    b+=grp('Etkin araç',o);
  }
  if(sk.sel.length){
    const {P,Ls,Cs,Cn}=selGroups();
    b+=grp(`Seçili öğeler (${sk.sel.length})`,`<div class="lst">${sk.sel.map((h,i)=>`<div><span>${esc(itemName(h))}</span><button data-unsel="${i}" aria-label="Seçimden çıkar">✕</button></div>`).join('')}</div>`);
    const ids=new Set(sk.sel.map(h=>h.id));
    const ex=f.cons.filter(c=>!DIMT.has(c.t)&&(ids.has(c.e)||ids.has(c.e1)||ids.has(c.e2)||ids.has(c.p)||ids.has(c.q)));
    if(ex.length)b+=grp('Mevcut ilişkiler',`<div class="lst">${ex.map(c=>`<div><span>${esc((REL[c.t]||[c.t])[0])}</span><button data-delcon="${c.id}" aria-label="İlişkiyi sil">✕</button></div>`).join('')}</div>`);
    const av=availRels();
    if(av.length)b+=grp('İlişki ekle',`<div class="relbtns">${av.map(t=>`<button data-rel="${t}"><b>${esc(REL[t][1])}</b>${esc(REL[t][0])}</button>`).join('')}</div>`);
    let ops=`<div class="relbtns">`;if(Ls.length||Cs.length)ops+=`<button data-skop="cons">${IC.construction.replace('<svg','<svg width="14" height="14"')} Yapı geometrisi</button>`;
    if(Cn.length===1){const c=f.cons.find(x=>x.id===Cn[0]);if(c&&DIMT.has(c.t))ops+=`<button data-skop="editdim">Değeri düzenle</button>`}
    ops+=`<button data-skop="del" class="danger">Sil</button></div>`;b+=grp('İşlemler',ops);
  }else if(!sk.tool){
    b+=grp('Nasıl çalışır?',`<p class="note">1. Şeritten bir çizim aracı seç (Çizgi, Dikdörtgen, Daire…) ve yaklaşık şekli çiz.<br>2. Akıllı Ölçülendirme ile ölçüleri gir.<br>3. Seç aracıyla öğelere tıkla, gerekirse ilişki ekle (Yatay, Teğet, Eşit…).<br>4. Çizim tam tanımlanınca Özellikler sekmesinden Ekstrüzyon, Kesme veya Döndürme seç.</p><p class="note">Fare: orta tuş döndür, sağ tuş kaydır, tekerlek yakınlaştır. Dokunmatik: iki parmakla kaydır ve yakınlaştır.</p>`);
  }
  const dims=f.cons.filter(c=>DIMT.has(c.t));
  if(dims.length)b+=grp(`Ölçüler (${dims.length})`,`<div class="dimlist">${dims.map(c=>`<label class="dimrow${sk.sel.some(h=>h.k==='con'&&h.id===c.id)?' on':''}" data-dimrow="${c.id}"><span>${esc(dimName(c))}</span><input inputmode="decimal" autocomplete="off" data-dimin="${c.id}" value="${esc(String(Math.round(c.val*1e4)/1e4).replace('.',','))}"><em>${c.t==='dang'?'°':'mm'}</em></label>`).join('')}</div><p class="note">Değeri yazıp Enter'a bas; çizim yeni ölçüye göre güncellenir.</p>`);
  else if(f.ents.length)b+=grp('Ölçüler',`<p class="note">Bu çizimde ölçü yok. Şeritten <b>Tam Tanımla</b> ile ölçüleri otomatik ekle veya Akıllı Ölçülendirme ile kendin ver.</p>`);
  b+=grp('Seçenekler',`<label class="chk"><input type="checkbox" data-opt="grid" ${sk.opts.grid?'checked':''}> Izgaraya yakala</label><label class="chk"><input type="checkbox" data-opt="rels" ${sk.opts.rels?'checked':''}> İlişki simgelerini göster</label><label class="chk"><input type="checkbox" data-opt="autodef" ${autoDefOn()?'checked':''}> Çizime girerken ve çıkarken eksik ölçüleri otomatik ekle</label>`);
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">${esc(f.name)}</div><div class="pm-sub">Çizim düzenleniyor</div></div><div class="pm-actions"><button class="ok" data-skx="ok" title="Çizimden çık" aria-label="Çizimden çık">${IC.ok}</button><button data-skx="cancel" title="Değişiklikleri at" aria-label="Değişiklikleri at">${IC.x}</button></div></div><div class="pm-body">${b}</div>`;
}
function skPmClick(e){
  if(sk.op&&skOpClick(e))return;
  const x=e.target.closest('[data-skx]');if(x){exitSketch(x.dataset.skx==='ok');return}
  const u=e.target.closest('[data-unsel]');if(u){sk.sel.splice(+u.dataset.unsel,1);skChanged();return}
  const dc=e.target.closest('[data-delcon]');if(dc){skPush();sk.feat.cons=sk.feat.cons.filter(c=>c.id!==dc.dataset.delcon);solveSketch(sk.feat);skChanged();return}
  const r=e.target.closest('[data-rel]');if(r){addRelation(r.dataset.rel);return}
  const o=e.target.closest('[data-skop]');if(o){const k=o.dataset.skop;if(k==='cons')toggleConstruction();else if(k==='del')deleteSel();else if(k==='editdim'){const h=sk.sel.find(h=>h.k==='con');if(h)openDimPop(h.id)}}
}
function skPmInput(e){if(skOpInput(e))return;const t=e.target;if(t.dataset.k&&t.dataset.num){const v=num(t.value);if(isFinite(v))sk.opts[t.dataset.k]=v;sk.dirty=true}}
function skPmChange(e){
  if(skOpInput(e))return;const t=e.target;
  if(t.dataset.dimin){const v=num(t.value);const c=sk.feat.cons.find(x=>x.id===t.dataset.dimin);if(!c)return;if(!(isFinite(v)&&(v>0||(c.t==='dang'&&v>=0)))){t.classList.add('bad');return}if(Math.abs(v-c.val)>1e-9)setDimVal(c.id,v);return}
  if(t.dataset.opt==='autodef'){setAutoDef(t.checked);if(t.checked)autoDefineSketch(true);return}
  if(t.dataset.opt){sk.opts[t.dataset.opt]=t.checked;sk.dirty=true}
}
function dimName(c){
  const E=entMap(sk.feat);const e=c.e&&E[c.e];
  switch(c.t){
    case 'ddia':return e&&e.cons?'Çap (yapı)':'Çap';
    case 'drad':return 'Yarıçap';
    case 'dang':return 'Açı';
    case 'dh':return c.p==='O'?'Yatay konum':'Yatay mesafe';
    case 'dv':return c.p==='O'?'Dikey konum':'Dikey mesafe';
    case 'dpl':return c.p==='O'?'Çizginin merkeze uzaklığı':'Nokta–çizgi mesafesi';
    case 'dll':return 'Paralel çizgi aralığı';
    case 'd':{const l=sk.feat.ents.find(x=>x.t==='line'&&((x.a===c.p&&x.b===c.q)||(x.a===c.q&&x.b===c.p)));return l?'Uzunluk':'Mesafe'}
  }
  return 'Ölçü';
}
function toggleConstruction(){
  const es=sk.sel.filter(h=>h.k==='ent');if(!es.length){toast('Önce çizgi veya daire seç.');return}
  skPush();for(const h of es){const e=sk.feat.ents.find(x=>x.id===h.id);if(e)e.cons=!e.cons}skChanged();
}
function mergePts(f,keep,drop){
  for(const e of f.ents)for(const k of ['a','b','c'])if(e[k]===drop)e[k]=keep;
  for(const c of f.cons)for(const k of ['p','q'])if(c[k]===drop)c[k]=keep;
  delete f.pts[drop];
  f.ents=f.ents.filter(e=>!(e.t==='line'&&e.a===e.b)&&!(e.t==='arc'&&(e.a===e.b||e.a===e.c)));
  f.cons=f.cons.filter(c=>!(c.p&&c.q&&c.p===c.q));
}
function addRelation(t){
  const f=sk.feat;const {P,Ls,Cs}=selGroups();skPush();const news=[];
  const add=c=>{c.id=newId(f,'c');news.push(c);f.cons.push(c)};
  if(t==='h'||t==='v'){if(Ls.length)Ls.forEach(l=>add({t,e:l.id}));else for(let i=1;i<P.length;i++)add({t,p:P[0],q:P[i]})}
  else if(t==='par'||t==='eq'){const A=Ls.length?Ls:Cs;for(let i=1;i<A.length;i++)add({t,e1:A[0].id,e2:A[i].id})}
  else if(t==='perp'||t==='coll')add({t,e1:Ls[0].id,e2:Ls[1].id});
  else if(t==='mid')add({t:'mid',p:P[0],e:Ls[0].id});
  else if(t==='tan'){if(Ls.length)add({t:'tan',e1:Ls[0].id,e2:Cs[0].id});else{const a=Cs[0],b=Cs[1];const c1=P2(a.c),c2=P2(b.c);const d=Math.hypot(c1[0]-c2[0],c1[1]-c2[1]);add({t:'tan',e1:a.id,e2:b.id,int:d<Math.max(curveR(f,a),curveR(f,b))})}}
  else if(t==='coin'){
    if(P.length===2){const [a,b]=P;if(b==='O')mergePts(f,'O',a);else mergePts(f,a,b)}
    else if(Ls.length)add({t:'pol',p:P[0],e:Ls[0].id});else add({t:'poc',p:P[0],e:Cs[0].id});
  }
  else if(t==='conc'){const a=Cs[0],b=Cs[1];if(a.c==='O')mergePts(f,'O',b.c);else if(b.c==='O')mergePts(f,'O',a.c);else mergePts(f,a.c,b.c)}
  else if(t==='fix'){const ps=new Set(P);for(const e of [...Ls,...Cs])for(const k of ['a','b','c'])if(e[k])ps.add(e[k]);ps.delete('O');for(const p of ps)if(!f.cons.some(c=>c.t==='fix'&&c.p===p))add({t:'fix',p})}
  // aşırı tanımlama denetimi
  if(news.length&&t!=='fix'){
    const base=f.cons.filter(c=>!news.includes(c));const tmp={...f,cons:base};const r0=sketchRank(tmp);const r1=sketchRank(f);
    if(r1===r0){skRestore(sk.hist.pop());toast('Bu ilişki çizimi aşırı tanımlar veya zaten mevcut.');skChanged();return}
  }
  if(!solveSketch(f)){skRestore(sk.hist.pop());toast('İlişki uygulanamadı: çizim çözülemiyor.');skChanged();return}
  sk.sel=[];skChanged();
}
function deleteSel(){
  if(!sk.sel.length)return;const f=sk.feat;skPush();
  const cons=new Set(),ents=new Set(),pts=new Set();
  for(const h of sk.sel){if(h.k==='con')cons.add(h.id);else if(h.k==='ent')ents.add(h.id);else if(h.id!=='O')pts.add(h.id)}
  for(const e of f.ents)if(pts.has(e.a)||pts.has(e.b)||pts.has(e.c))ents.add(e.id);
  f.ents=f.ents.filter(e=>!ents.has(e.id));
  f.cons=f.cons.filter(c=>!cons.has(c.id)&&!pts.has(c.p)&&!pts.has(c.q));
  for(const p of pts)delete f.pts[p];
  cleanupOrphans(f);sk.sel=[];solveSketch(f);skChanged();
}
function updSbar(){
  if(!sk)return;const dof=sk.an?sk.an.dof:null;const el=$('#sbSt');
  if(dof===0){el.textContent='Tam tanımlı';el.className='st full'}else{el.textContent=`Tam tanımlanmamış (${dof})`;el.className='st under'}
  $('#sbTool').textContent=sk.tool?({line:'Çizgi',centerline:'Merkez çizgisi',rect:'Köşe dikdörtgen',crect:'Merkez dikdörtgen',circle:'Daire',arc:'Merkez nokta yay',slot:'Düz kanal',polygon:'Çokgen',sfillet:'Çizim radyusu',smartdim:'Akıllı ölçülendirme',trim:'Budama'})[sk.tool]:'Seç';
}
