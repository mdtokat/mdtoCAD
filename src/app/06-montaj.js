/* Çok parçalı proje, montaj görünümü, eşleştirme çözücü, montaj ağacı, STL/ZIP. */
/* ================= PROJE: PARÇALAR ================= */
IC.asmInsert=sv('<path d="M4 8.5 10 5.5l6 3-6 3z"/><path d="M4 8.5V14l6 3 6-3V8.5M10 11.5V17"/><path d="M18.5 13v7M15 16.5h7"/>');
IC.mate=sv('<rect x="3" y="4" width="8" height="8" rx="1"/><rect x="13" y="12" width="8" height="8" rx="1"/><path d="M11 8h4v4" stroke-dasharray="1.6 1.6"/>');
IC.move=sv('<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>');
IC.rotate=sv('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v4h-4"/>');
IC.stl=sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M12 9v7M9 13l3 3 3-3"/>');
IC.part=sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>');
IC.unfix=sv('<path d="M9 11V7a3 3 0 0 1 6 0"/><rect x="6" y="11" width="12" height="9" rx="1.5"/>');
IC.fix=sv('<path d="M9 11V7a3 3 0 0 1 6 0v4"/><rect x="6" y="11" width="12" height="9" rx="1.5"/>');

function partById(id){return project.parts.find(p=>p.id===id)}
function partKey(p){return p.mesh?('m'+p.mesh.length+':'+p.id):JSON.stringify(p.features,cleanR)}
function b64ToF32(b){const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Float32Array(u.buffer)}
function f32ToB64(f){const u=new Uint8Array(f.buffer,f.byteOffset,f.byteLength);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
function meshPolys(p){
  if(p._mp&&p._mpk===p.mesh.length)return p._mp;
  const a=b64ToF32(p.mesh);const out=[];let vol=0;
  for(let i=0;i+8<a.length;i+=9){
    const A=new Vec(a[i],a[i+1],a[i+2]),B=new Vec(a[i+3],a[i+4],a[i+5]),C=new Vec(a[i+6],a[i+7],a[i+8]);
    const n=B.minus(A).cross(C.minus(A));const l=n.len();if(l<1e-12)continue;const u=n.times(1/l);vol+=A.dot(B.cross(C));
    out.push(new Poly([A,B,C],'stl',new Plane(u,u.dot(A))));
  }
  if(vol<0)out.forEach(q=>q.flip());
  p._mp=out;p._mpk=p.mesh.length;return out;
}
function partRebuild(p){if(p.mesh)return {polys:meshPolys(p),ann:[],errors:{},frames:{},caps:{},tools:{}};return rebuildModel(p.features)}
function switchPart(id){
  const p=partById(id);if(!p||p===state)return;
  if(sk)exitSketch(true);if(pm)closePM(true);cancelPick();
  state=p;project.cur.part=id;hist=histFor(id);sel=null;
  rebuild();renderTree();renderRibbon();renderPM();updUndo();saveState();
  if(activeTab==='model')fitCamera(VIEWDIRS.iso,false);
  if(activeTab==='drawing')renderDrawing(true);
}
function uniqueName(base){const names=new Set(project.parts.map(p=>p.partName));if(!names.has(base))return base;let i=2;while(names.has(base+' '+i))i++;return base+' '+i}
function partUsed(id){return project.asms.some(a=>a.comps.some(c=>c.part===id))}
function partAction(a){
  if(a==='new'||a==='dup'){
    let p;if(a==='new'){let n=project.parts.length+1;while(project.parts.some(p=>p.partName==='Parça'+n))n++;p=newPart('Parça'+n)}
    else{p=normPart(JSON.parse(JSON.stringify(state,cleanR)));p.id=uid('P');p.partName=uniqueName(state.partName+' kopya')}
    const from=state.id;project.parts.push(p);switchPart(p.id);hist.undo.push({op:'create',back:from});updUndo();
    toast(a==='new'?'Yeni parça oluşturuldu. Bir düzlem seçip Çizim ile başla.':'Parça çoğaltıldı.',{label:'Geri al',fn:undoStep()});
  }
  else if(a==='del'){
    if(project.parts.length<=1){toast('Projede en az bir parça kalmalı.');return}
    if(partUsed(state.id)){toast('Bu parça bir montajda kullanılıyor. Önce montajdan çıkar.');return}
    verSnapNow(`“${state.partName}” silinmeden önce`);const gone=state,idx=project.parts.indexOf(gone);project.parts.splice(idx,1);switchPart(project.parts[Math.max(0,idx-1)].id);
    hist.undo.push({op:'undelete',part:gone,idx});updUndo();
    toast(`“${gone.partName}” projeden silindi.`,{label:'Geri al',fn:undoStep()});
  }
}
/* parça oluşturma, çoğaltma ve silme parça geçmişinde işaretle tutulur (Geri al / Yinele):
   create/redelete etkin parçayı projeden kaldırır, recreate/undelete parçayı yerine geri koyar; karşıt işaret öbür listeye yazılır */
function partHistOp(m,isUndo){
  const from=isUndo?hist.undo:hist.redo;
  if(m.op==='create'||m.op==='redelete'){
    if(project.parts.length<=1)return;
    if(partUsed(state.id)){toast('Bu parça bir montajda kullanılıyor. Geri almak için önce montajdan çıkar.');return}
    from.pop();const part=state,idx=project.parts.indexOf(part);project.parts.splice(idx,1);
    const to=partById(m.back)||project.parts[Math.max(0,idx-1)];switchPart(to.id);
    (isUndo?hist.redo:hist.undo).push({op:m.op==='create'?'recreate':'undelete',part,idx,back:to.id});
    toast(m.op==='create'?`“${part.partName}” oluşturması geri alındı.`:`“${part.partName}” projeden silindi.`);
  }else{
    from.pop();const back=state.id;project.parts.splice(Math.min(m.idx,project.parts.length),0,m.part);switchPart(m.part.id);
    (isUndo?hist.redo:hist.undo).push({op:m.op==='recreate'?'create':'redelete',back});
    toast(`“${m.part.partName}” geri geldi.`);
  }
  if(activeTab==='asm')renderAsmTree();updUndo();saveState();
}

/* ---------- örnek proje ---------- */
function demoProject(){
  const L=(id,a,b,cons)=>({id,t:'line',a,b,cons:!!cons});
  const shaftSketch=(r1,h1,r2,h2,ax)=>({id:'s1',type:'sketch',name:'Çizim1',on:{kind:'std',key:'front'},
    pts:{p1:{x:r1,y:0},p2:{x:r1,y:h1},p3:{x:r2,y:h1},p4:{x:r2,y:h1+h2},p5:{x:0,y:h1+h2},a:{x:0,y:ax}},
    ents:[L('e1','O','p1'),L('e2','p1','p2'),L('e3','p2','p3'),L('e4','p3','p4'),L('e5','p4','p5'),L('e6','p5','O'),L('e7','O','a',1)],
    cons:[{id:'c1',t:'h',e:'e1'},{id:'c2',t:'v',e:'e2'},{id:'c3',t:'h',e:'e3'},{id:'c4',t:'v',e:'e4'},{id:'c5',t:'h',e:'e5'},{id:'c6',t:'v',e:'e6'},{id:'c7',t:'v',e:'e7'},
      {id:'c8',t:'d',p:'O',q:'a',val:ax,lp:[-8,ax/2]},{id:'c9',t:'dh',p:'O',q:'p1',val:r1,lp:[r1/2,-8]},{id:'c10',t:'dv',p:'O',q:'p2',val:h1,lp:[r2+10,h1/2]},
      {id:'c11',t:'dh',p:'O',q:'p3',val:r2,lp:[r2/2,h1+h2+8]},{id:'c12',t:'dv',p:'p3',q:'p4',val:h2,lp:[r2+10,h1+h2/2]}]});
  const rev={id:'r1',type:'revolve',name:'Döndürme1',op:'add',sketch:'s1',axis:'e7',angle:360,mode:'one',flip:false};
  const P1={id:'P1',partName:'Yatak gövdesi',material:'gg25',features:demoFeatures(),drawing:defaultDrawing()};
  const P2={id:'P2',partName:'Mil',material:'c45',features:[shaftSketch(13,100,17,10,120),rev],drawing:defaultDrawing()};
  const P3={id:'P3',partName:'Cıvata M8x30',material:'steel',features:[shaftSketch(4,30,6.5,5.5,45),rev],drawing:defaultDrawing()};
  const tr=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const ax=(x,z)=>({t:'axis',p:[x,0,z],d:[0,1,0]});
  const comps=[{id:'c1',part:'P1',T:tr(0,0,0),fixed:true},{id:'c2',part:'P2',T:tr(0,-62,0)}];
  const mates=[
    {id:'m1',name:'Eşmerkezli1',type:'concentric',a:{comp:'c1',ref:ax(0,0)},b:{comp:'c2',ref:ax(0,0)}},
    {id:'m2',name:'Çakışık1',type:'coincident',flip:false,a:{comp:'c1',ref:{t:'plane',n:[0,1,0],p:[0,38,0]}},b:{comp:'c2',ref:{t:'plane',n:[0,-1,0],p:[0,100,0]}}}];
  [[48,-28],[-48,-28],[48,28],[-48,28]].forEach(([x,z],i)=>{
    const id='c'+(3+i);comps.push({id,part:'P3',T:tr(x,-15,z)});
    mates.push({id:'m'+(3+2*i),name:'Eşmerkezli'+(2+i),type:'concentric',a:{comp:'c1',ref:ax(x,z)},b:{comp:id,ref:ax(0,0)}});
    mates.push({id:'m'+(4+2*i),name:'Çakışık'+(2+i),type:'coincident',flip:false,a:{comp:'c1',ref:{t:'plane',n:[0,1,0],p:[0,15,0]}},b:{comp:id,ref:{t:'plane',n:[0,-1,0],p:[0,30,0]}}});
  });
  return normProject({parts:[P1,P2,P3],asms:[{id:'A1',name:'Yatak montajı',comps,mates}],cur:{part:'P1',asm:'A1'}});
}

/* ================= MONTAJ ================= */
const asmRoot=new T.Group();asmRoot.visible=false;scene.add(asmRoot);
const partRoot=new T.Group();[solidMesh,edgeLines,selMesh,hovMesh,selEdgeLines,previewGroup,sketchesGroup,skGroup,planeGroup].forEach(o=>{scene.remove(o);partRoot.add(o)});scene.add(partRoot);
const PAL=[0xA9B5C1,0xC8B48C,0x9EBBA6,0xB5A3BC,0xA4BED0,0xC4A797,0xB2BA9D,0x9EA9CB,0xC9A9B4,0xA8C4BC];
const MATE_T={coincident:'Çakışık',concentric:'Eşmerkezli',parallel:'Paralel',perpendicular:'Dik',tangent:'Teğet',lock:'Kilitle',distance:'Mesafe',angle:'Açı',
  symmetric:'Simetrik',width:'Genişlik',distlimit:'Mesafe sınırı',anglimit:'Açı sınırı',hinge:'Menteşe',gear:'Dişli',rack:'Kremayer pinyon',screw:'Vida'};
const MATE_G={coincident:'◦',concentric:'◎',parallel:'∥',perpendicular:'⊥',tangent:'◡',lock:'▣',distance:'↔',angle:'∠',
  symmetric:'⇔',width:'⇹',distlimit:'↹',anglimit:'∡',hinge:'⌒',gear:'✱',rack:'⇌',screw:'↻'};
/* eşleştirmenin seçimleri: standart türlerde a, b; genişlik, simetrik ve menteşede c, d de */
const mSides=m=>[m.a,m.b,m.c,m.d].filter(Boolean);
let asmView={groups:new Map(),box:null,dof:{}};
const asmUI={tool:null,sel:null,pm:null,drag:null,down:null};
const pcache=new Map();
const asmHists=new Map();
function curAsm(){return project.asms.find(a=>a.id===project.cur.asm)||null}
function asmHistFor(){const a=curAsm();if(!a)return null;if(!asmHists.has(a.id))asmHists.set(a.id,{undo:[],redo:[]});return asmHists.get(a.id)}
const asmSnap=a=>JSON.stringify({comps:a.comps,mates:a.mates,explode:a.explode||null,pats:a.pats||null});
function asmRestore(a,s){const o=JSON.parse(s);a.comps=o.comps;a.mates=o.mates;a.explode=o.explode||undefined;a.pats=o.pats||undefined}
function pushAsmHist(){const a=curAsm(),h=asmHistFor();if(!h)return;h.undo.push(asmSnap(a));if(h.undo.length>80)h.undo.shift();h.redo=[];updUndo()}
// açık eşleştirme paneli kapanırken açılışta eklediği adımı geri çeker; geri alınacak başka adım kalmayabilir
function asmUndo(){const a=curAsm(),h=asmHistFor();if(!h||!h.undo.length)return;asmUI.drag=null;closeAsmPM(true,true);if(!h.undo.length){asmChanged(false);renderAsmRibbon();return}
  h.redo.push(asmSnap(a));asmRestore(a,h.undo.pop());asmChanged();renderAsmRibbon()}
function asmRedo(){const a=curAsm(),h=asmHistFor();if(!h||!h.redo.length)return;asmUI.drag=null;closeAsmPM(true,true);if(!h.redo.length){asmChanged(false);renderAsmRibbon();return}
  h.undo.push(asmSnap(a));asmRestore(a,h.redo.pop());asmChanged();renderAsmRibbon()}
function partData(p){
  const key=partKey(p);let c=pcache.get(p.id);if(c&&c.key===key)return c;
  const r=(p===state&&model.key===key)?model:partRebuild(p);
  const box=r.polys.length?bboxPolys(r.polys):null,props=r.polys.length?massProps(r.polys):null;
  const {g,tp}=polysToBuffers(r.polys);const segs=computeEdges(r.polys,null).filter(e=>e.k===1),eg=segGeom(segs);
  if(c){c.g.dispose();c.eg.dispose()}
  c={key,polys:r.polys,ann:r.ann||[],caps:r.caps||{},box,props,g,tp,eg,segs,err:Object.keys(r.errors||{}).length};pcache.set(p.id,c);return c;
}
function compName(a,c){const p=partById(c.part);const same=a.comps.filter(x=>x.part===c.part);return (p?p.partName:'?')+'<'+(same.indexOf(c)+1)+'>'}
function compById(id){const a=curAsm();return a?a.comps.find(c=>c.id===id):null}
function buildAsmView(){
  requestRender();
  for(const ch of [...asmRoot.children]){if(ch===interfGroup)continue;asmRoot.remove(ch);ch.traverse(o=>{if(o.userData.own&&o.geometry)o.geometry.dispose();if(o.material&&o.material!==matEdge&&o.material!==matSel&&o.material!==matSelEdge&&o.material.dispose)o.material.dispose()})}
  asmView.groups=new Map();asmUI.hovKey='';const a=curAsm();if(!a){asmView.box=null;asmView.dof={};return}
  asmUI.exf=a.explode&&a.explode.on?(asmUI.exf||1):0;
  const pidx={};project.parts.forEach((p,i)=>pidx[p.id]=i);
  for(const c of a.comps){
    const p=partById(c.part);if(!p)continue;const d=partData(p);
    const g=new T.Group();g.matrixAutoUpdate=false;g.matrix.copy(dispM(a,c));g.userData.comp=c.id;
    const mat=new T.MeshStandardMaterial({color:PAL[pidx[c.part]%PAL.length],metalness:.2,roughness:.55,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    const m=new T.Mesh(d.g,mat);m.userData.comp=c.id;const l=new T.LineSegments(d.eg,matEdge);
    m.visible=display!=='wire';l.visible=display!=='shaded';g.add(m,l);g.visible=!c.hidden;asmRoot.add(g);
    asmView.groups.set(c.id,{g,m,l,d,mat});
  }
  asmView.dof=asmDof(a);
  asmBoxCalc();asmHighlight();
}
function updateAsmPoses(){requestRender();const a=curAsm();if(!a)return;for(const c of a.comps){const v=asmView.groups.get(c.id);if(v){v.g.matrix.copy(dispM(a,c));v.g.matrixWorldNeedsUpdate=true}}asmBoxCalc()}
function asmBoxCalc(){
  const a=curAsm();let mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity],any=false;
  if(a)for(const c of a.comps){const v=asmView.groups.get(c.id);if(!v||!v.d.box||c.hidden)continue;const b=v.d.box;const M=dispM(a,c);
    for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){const p=new T.Vector3(x,y,z).applyMatrix4(M);any=true;mn=[Math.min(mn[0],p.x),Math.min(mn[1],p.y),Math.min(mn[2],p.z)];mx=[Math.max(mx[0],p.x),Math.max(mx[1],p.y),Math.max(mx[2],p.z)]}}
  asmView.box=any?{min:mn,max:mx}:null;
}
function coplanarFilter(n,w){return q=>Math.abs(q.plane.n.x*n[0]+q.plane.n.y*n[1]+q.plane.n.z*n[2]-1)<1e-5&&Math.abs(q.plane.w-w)<1e-3}
function cylFilter(r){return q=>{const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);if(Math.abs(q.plane.n.x*A.x+q.plane.n.y*A.y+q.plane.n.z*A.z)>0.2)return false;return q.verts.every(v=>{const w=new T.Vector3(v.x,v.y,v.z).sub(C);const t=w.dot(A);if(t<r.t0-1e-3||t>r.t1+1e-3)return false;return Math.abs(w.sub(A.clone().multiplyScalar(t)).length()-r.r)<Math.max(0.05,r.r*0.03)})}}
function asmHighlight(){
  for(const v of asmView.groups.values()){
    for(const ch of [...v.g.children])if(ch.userData.hl){v.g.remove(ch);if(ch.geometry)ch.geometry.dispose()}
    const exSel=asmUI.pm&&((asmUI.pm.type==='explode'&&asmUI.pm.draft.comps.includes(v.g.userData.comp))||(asmUI.pm.type==='pat'&&asmUI.pm.draft.seeds.includes(v.g.userData.comp)));
    v.mat.emissive.setHex(exSel?0x6a3a00:(asmUI.sel===v.g.userData.comp&&!(asmUI.pm&&asmUI.pm.type==='mate')?0x4a3000:0x000000));
  }
  const P=asmUI.pm;if(!P||P.type!=='mate')return;
  for(const s of mSides(P.draft)){const v=asmView.groups.get(s.comp);if(!v)continue;for(const o of refObjs(v,s.ref,matSel,matSelEdge)){o.userData.hl=true;v.g.add(o)}}
}
/* ---------- seçim ---------- */
/* ---------- eşleştirme çözücü ---------- */
const ML=50;
function wref(r,M){const p=new T.Vector3(...r.p).applyMatrix4(M);const v=new T.Vector3(...(r.n||r.d)).transformDirection(M);return r.t==='plane'?{t:'plane',p,n:v}:{t:'axis',p,d:v}}
function mateRes(m,P){
  const A=wref(m.a.ref,P[m.a.comp]),B=wref(m.b.ref,P[m.b.comp]);
  const C=m.c&&P[m.c.comp]?wref(m.c.ref,P[m.c.comp]):null,D=m.d&&P[m.d.comp]?wref(m.d.ref,P[m.d.comp]):null;
  const crs=(u,v)=>{const c=u.clone().cross(v);return [c.x*ML,c.y*ML,c.z*ML]};
  const perpOff=(X,Y)=>{const w=Y.p.clone().sub(X.p);return w.sub(X.d.clone().multiplyScalar(w.dot(X.d)))};
  const conc=(X,Y)=>{const w=perpOff(X,Y);return [...crs(X.d,Y.d),w.x,w.y,w.z]};
  // dönmesi kilitli eşmerkezli: iki bileşende eksene dik birer yön (kilitlendiği andaki) birbirine paralel kalır
  const lock=()=>{if(!m.lock||!m.lk)return [];const ua=new T.Vector3(...m.lk.a).transformDirection(P[m.a.comp]),ub=new T.Vector3(...m.lk.b).transformDirection(P[m.b.comp]);return crs(ua,ub)};
  const pa=A.t==='plane',pb=B.t==='plane';const Pl=pa?A:B,Ax=pa?B:A;const sg=m.flip?-1:1;
  // sınır: değer [en az, en fazla] aralığındaysa artık sıfır (serbest), dışındaysa aşan kadar
  const lim=v=>{const hi=num(m.max),lo=num(m.min);return isFinite(hi)&&v>hi?v-hi:(isFinite(lo)&&v<lo?v-lo:0)};
  // düz yüzey + dairesel kenar (SolidWorks gibi): daire kendi düzlemiyle ele alınır; çakışıkta daire yüzeyin üzerinde yatar
  // (ekseni yüzeye dik), mesafede yüzeye paralel durur. Eksen gibi ele alınsaydı parça 90° devrilirdi
  if(pa!==pb&&(pa?m.b:m.a).ref.e==='circ'&&['coincident','parallel','perpendicular','distance','distlimit'].includes(m.type)){
    const h=Ax.p.clone().sub(Pl.p).dot(Pl.n);
    if(m.type==='coincident')return [...crs(Pl.n,Ax.d),h];
    if(m.type==='parallel')return crs(Pl.n,Ax.d);
    if(m.type==='perpendicular')return [Pl.n.dot(Ax.d)*ML];
    if(m.type==='distance')return [...crs(Pl.n,Ax.d),h-sg*num(m.val)];
    return [...crs(Pl.n,Ax.d),lim(sg*h)];
  }
  switch(m.type){
    case 'coincident':
      if(pa&&pb){const s=m.flip?-1:1;return [(A.n.x+s*B.n.x)*ML,(A.n.y+s*B.n.y)*ML,(A.n.z+s*B.n.z)*ML,B.p.clone().sub(A.p).dot(A.n)]}
      if(!pa&&!pb)return conc(A,B);
      return [Pl.n.dot(Ax.d)*ML,Ax.p.clone().sub(Pl.p).dot(Pl.n)];
    case 'concentric':return [...conc(A,B),...lock()];
    case 'parallel':return pa&&pb?crs(A.n,B.n):(!pa&&!pb?crs(A.d,B.d):[Pl.n.dot(Ax.d)*ML]);
    case 'perpendicular':return pa&&pb?[A.n.dot(B.n)*ML]:(!pa&&!pb?[A.d.dot(B.d)*ML]:crs(Pl.n,Ax.d));
    case 'distance':
      // iki eksen: eksenler arası (merkez) mesafe, ör. dişli çiftinin eksen aralığı; eksen–düzlem: eksenin düzleme uzaklığı
      if(!pa&&!pb)return [...crs(A.d,B.d),perpOff(A,B).length()-num(m.val)];
      if(pa!==pb)return [Pl.n.dot(Ax.d)*ML,Ax.p.clone().sub(Pl.p).dot(Pl.n)-(m.flip?-1:1)*num(m.val)];
      // hizalama (align): yüzeyler aynı yöne mi bakıyor; eski dosyalarda yoksa yalnızca paralellik istenir
      return [...(m.align===undefined?crs(A.n,B.n):[0,1,2].map(k=>(A.n.getComponent(k)+(m.align?-1:1)*B.n.getComponent(k))*ML)),B.p.clone().sub(A.p).dot(A.n)-(m.flip?-1:1)*num(m.val)];
    case 'angle':return [(A.n.dot(B.n)-Math.cos(num(m.val)*Math.PI/180))*ML];
    // teğet: düzlem–silindir (eksen düzleme paralel, yarıçap kadar uzakta); iki silindir (dıştan: r1+r2, içten: |r1−r2|)
    case 'tangent':{
      if(pa!==pb)return [Pl.n.dot(Ax.d)*ML,Ax.p.clone().sub(Pl.p).dot(Pl.n)-sg*((pa?m.b:m.a).ref.r||0)];
      const ra=m.a.ref.r||0,rb=m.b.ref.r||0;return [...crs(A.d,B.d),perpOff(A,B).length()-(m.flip?Math.abs(ra-rb):ra+rb)]}
    // kilitle: iki bileşenin birbirine göre konumu, eklendiği andaki gibi kalır (B'nin üç noktası A'ya göre yerinde)
    case 'lock':{if(!m.rel)return [];const R=P[m.a.comp].clone().multiply(new T.Matrix4().fromArray(m.rel)),o=[];
      for(const q of [[0,0,0],[ML,0,0],[0,ML,0]]){const u=new T.Vector3(...q).applyMatrix4(P[m.b.comp]).sub(new T.Vector3(...q).applyMatrix4(R));o.push(u.x,u.y,u.z)}return o}
    // simetrik: A'nın simetri düzlemine göre yansıması B ile çakışır (düzlemler veya eksenler)
    case 'symmetric':{if(!C||C.t!=='plane')return [];const nc=C.n,rf=v=>v.clone().sub(nc.clone().multiplyScalar(2*v.dot(nc))),rp=p=>p.clone().sub(nc.clone().multiplyScalar(2*p.clone().sub(C.p).dot(nc)));
      if(pa&&pb)return [...crs(rf(A.n),B.n),rp(A.p).sub(B.p).dot(B.n)];
      if(!pa&&!pb){const w=B.p.clone().sub(rp(A.p));w.sub(B.d.clone().multiplyScalar(w.dot(B.d)));return [...crs(rf(A.d),B.d),w.x,w.y,w.z]}
      return []}
    // genişlik: tırnağın (C, D) orta düzlemi, genişlik yüzeylerinin (A, B) orta düzlemiyle çakışır
    case 'width':{if(!C||!D||!pa||!pb||C.t!=='plane'||D.t!=='plane')return [];const n=A.n;
      return [...crs(n,C.n),(A.p.dot(n)+B.p.dot(n)-C.p.dot(n)-D.p.dot(n))/2]}
    // mesafe sınırı: mesafe en az–en fazla aralığında kalır (yüzeyler paralel)
    case 'distlimit':
      if(!pa&&!pb)return [...crs(A.d,B.d),lim(perpOff(A,B).length())];
      if(pa!==pb)return [Pl.n.dot(Ax.d)*ML,lim(sg*Ax.p.clone().sub(Pl.p).dot(Pl.n))];
      return [...crs(A.n,B.n),lim(sg*B.p.clone().sub(A.p).dot(A.n))];
    // açı sınırı: yüzey normalleri (eksenler) arasındaki açı aralıkta kalır (radyan · ML)
    case 'anglimit':{const u=pa?A.n:A.d,v=pb?B.n:B.d;const ang=Math.acos(Math.max(-1,Math.min(1,u.dot(v))))*180/Math.PI;return [lim(ang)*Math.PI/180*ML]}
    // menteşe: eşmerkezli (A, B) ve çakışık (C, D); tek dönme serbestliği kalır
    case 'hinge':{const r=conc(A,B);if(C&&D&&C.t==='plane'&&D.t==='plane')r.push((C.n.x+sg*D.n.x)*ML,(C.n.y+sg*D.n.y)*ML,(C.n.z+sg*D.n.z)*ML,D.p.clone().sub(C.p).dot(C.n));return r}
    // dişli: θa·ra + s·θb·rb = 0 (eksenleri etrafındaki dönmeler, eklendiği andan itibaren)
    case 'gear':{if(!m.ua)return [];const k=coupAngles(m,P),ra=num(m.ra)||1,rb=num(m.rb)||1;return [(k.ta*ra+(m.sg||1)*sg*k.tb*rb)/Math.max(ra,rb)*ML]}
    // kremayer–pinyon: kremayerin kenar boyunca ilerlemesi = pinyon yarıçapı × dönme açısı
    case 'rack':{if(!m.ub)return [];const k=coupAngles(m,P);return [k.x-sg*num(m.val)/2*k.tb]}
    // vida: eşmerkezli; eksen boyunca ilerleme = hatve × tur
    case 'screw':{if(!m.ua)return conc(A,B);const k=coupAngles(m,P);return [...conc(A,B),k.x-sg*num(m.val)*k.ta/(2*Math.PI)]}
  }
  return [];
}
/* data: 3B montaj görünümü kurulmamışsa (teknik resimden otomatik patlatma) parçanın kutusu hesaplanır. Yalnızca kullanıcı
   işleminde kullanılır: proje yüklenirken çağrılınca yarım kalmış modeli parça önbelleğine yazıyordu */
function compBox(c,data){const v=asmView.groups.get(c.id);if(v&&v.d.box)return v.d.box;if(!data)return null;const p=partById(c.part);return p?partData(p).box:null}
function compCenter(c,data){const b=compBox(c,data);const ctr=b?new T.Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2):new T.Vector3();return ctr.applyMatrix4(new T.Matrix4().fromArray(c.T))}
/* only: yalnızca bu bileşenler serbest (sürüklemede sürüklenen bileşenin eşleştirmelerle bağlı olduğu grup) */
function asmSystem(a,extra,only){
  const live=new Set(a.comps.map(c=>c.id));
  const ms=a.mates.filter(m=>!m.suppressed).concat(extra||[]).filter(m=>mSides(m).every(s=>live.has(s.comp)));
  if(only)for(let i=ms.length-1;i>=0;i--)if(!mSides(ms[i]).some(s=>only.has(s.comp)))ms.splice(i,1);
  const free=a.comps.filter(c=>!c.fixed&&!c.pat&&(!only||only.has(c.id)));const idx={};free.forEach((c,i)=>idx[c.id]=i*6);
  const M0={},C0={};for(const c of a.comps){M0[c.id]=new T.Matrix4().fromArray(c.T);C0[c.id]=compCenter(c)}
  const poses=X=>{const P={};for(const c of a.comps){const i=idx[c.id];if(i===undefined){P[c.id]=M0[c.id];continue}
    const rv=new T.Vector3(X[i+3],X[i+4],X[i+5]);const ang=rv.length();const R=ang>1e-12?new T.Matrix4().makeRotationAxis(rv.divideScalar(ang),ang):new T.Matrix4();const c0=C0[c.id];
    P[c.id]=new T.Matrix4().makeTranslation(c0.x+X[i],c0.y+X[i+1],c0.z+X[i+2]).multiply(R).multiply(new T.Matrix4().makeTranslation(-c0.x,-c0.y,-c0.z)).multiply(M0[c.id])}return P};
  const res=(X,soft)=>{const P=poses(X);const r=[];for(const m of ms)r.push(...mateRes(m,P));if(soft)r.push(...soft(P));return r};
  // yumuşak terim: bileşenin merkezinin ve yönünün başlangıçtan sapması (açı parametresi tur atsa da pozdan hesaplanır)
  const drift=(P,w)=>{const o=[];for(const c of free){const D=P[c.id].clone().multiply(new T.Matrix4().copy(M0[c.id]).invert()),e=D.elements,c0=C0[c.id];
    const p=c0.clone().applyMatrix4(D).sub(c0);o.push(p.x*w,p.y*w,p.z*w,(e[6]-e[9])*w*ML/2,(e[8]-e[2])*w*ML/2,(e[1]-e[4])*w*ML/2)}return o};
  return {n:free.length*6,poses,res,idx,ms,drift};
}
function solveAsm(a,opt){
  const ok=solveMates(a,opt);applyPats(a);return ok;
}
function solveMates(a,opt){
  opt=opt||{};const S=asmSystem(a,opt.extra);if(!S.ms.length)return true;
  if(!S.n)return S.res([]).every(v=>Math.abs(v)<1e-3);
  const maxAbs=r=>(r.r||[]).reduce((m,v)=>Math.max(m,Math.abs(v)),0);
  let r=lm(x=>S.res(x),new Array(S.n).fill(0),200);let ok=maxAbs(r)<1e-3;
  // yüz yüze (ters hizalı) çakışık: bileşenin 180° dönmesi gerekir; yüzler aynı yöne bakarken başlangıç noktası tekildir
  // (eğim sıfır), çözücü oradan çıkamaz. Sağlanamayan eşleştirmelerin bileşenleri yarım tur çevrilmiş başlangıçlardan denenir.
  if(!ok&&!opt.quick)for(const X0 of flipStarts(S,r.x)){const q=lm(x=>S.res(x),X0,200);if(maxAbs(q)<1e-3){r=q;ok=true;break}}
  // serbest kalan yönlerde (ör. eşmerkezlide eksen boyunca kayma) bileşen başladığı yere en yakın çözümde kalsın: çözücünün
  // izlediği yol bileşeni eksen boyunca yüzlerce mm uzağa (görünüm dışına) götürebiliyordu. Yer değiştirmeye küçük ağırlıklı
  // yumuşak terim eklenerek yeniden çözülür, sonra terimsiz son düzeltme yapılır
  if(ok&&!opt.quick&&r.x.some(v=>Math.abs(v)>1e-6)){
    const q=lm(x=>S.res(x,P=>S.drift(P,1e-3)),r.x,80),p=lm(x=>S.res(x),q.x,60);
    const far=x=>S.drift(S.poses(x),1).reduce((t,v)=>t+v*v,0);
    if(maxAbs(p)<1e-3&&far(p.x)<far(r.x))r=p;
  }
  if(ok||opt.force){const P=S.poses(r.x);for(const c of a.comps)c.T=P[c.id].toArray();mateTrack(S.ms,P)}
  return ok;
}
/* yarım tur başlangıçları: sağlanamayan eşleştirmedeki serbest bileşen, eşleştirme yüzeyinin normaline (eksenine) dik
   iki eksen ve dünya eksenleri etrafında 180° çevrilir; diğer bileşenler yerinde başlar */
function flipStarts(S,X){
  const P=S.poses(X),out=[],seen=new Set();
  for(const m of S.ms){
    if(mateRes(m,P).every(v=>Math.abs(v)<1e-3))continue;
    for(const sd of [m.a,m.b]){const i=S.idx[sd.comp];if(i===undefined)continue;
      const w=wref(sd.ref,P[sd.comp]),n=(w.n||w.d).clone().normalize();
      const u1=new T.Vector3(1,0,0).cross(n);if(u1.length()<0.3)u1.set(0,1,0).cross(n);u1.normalize();const u2=n.clone().cross(u1);
      for(const u of [u1,u2,new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)]){
        const k=sd.comp+':'+u.toArray().map(v=>v.toFixed(3)).join();if(seen.has(k))continue;seen.add(k);
        const X0=new Array(S.n).fill(0);X0[i+3]=u.x*Math.PI;X0[i+4]=u.y*Math.PI;X0[i+5]=u.z*Math.PI;out.push(X0)}}
    if(out.length>=15)break;
  }
  return out.slice(0,15);
}
function asmDof(a){
  const S=asmSystem(a);const out={};
  let det=new Array(S.n).fill(false);
  if(S.n&&S.ms.length){const X0=new Array(S.n).fill(0);const r0=S.res(X0);const J=numJac(x=>S.res(x),X0,r0);const R=rrefInfo(J,S.n);const isP=new Set(R.piv);det=new Array(S.n).fill(true);
    for(let c=0;c<S.n;c++)if(!isP.has(c)){det[c]=false;R.piv.forEach((pc,row)=>{if(Math.abs(R.A[row][c])>1e-6)det[pc]=false})}}
  for(const c of a.comps){if(c.fixed){out[c.id]='f';continue}if(c.pat)continue;const i=S.idx[c.id];out[c.id]=[0,1,2,3,4,5].every(k=>det[i+k])?'ok':'-'}
  // çoğaltılmış bileşen kaynağı kadar tanımlıdır
  for(const c of a.comps)if(c.pat)out[c.id]=out[c.seed]==='-'?'-':'ok';
  return out;
}
function mateRefOk(s){
  const c=compById(s.comp);if(!c)return false;const p=partById(c.part);if(!p)return false;const d=partData(p);const r=s.ref;
  // açıklaması olmayan eski eksen seçimleri (STL) denetlenemez
  return refOn(r,d.polys,d.ann).length>0||(r.t!=='plane'&&!r.e&&r.t0===undefined&&!d.ann.length);
}

/* ---------- parça değişince montajın güncellenmesi ---------- */
/* eşleştirme referansı (parça koordinatında düzlem/eksen) eski geometride bir yüzeye/eksene oturuyor, yenisinde oturmuyorsa:
   aynı özelliğin oluşturduğu, aynı yöndeki en yakın yüzeye/eksene taşınır (ör. mil boyu 100 → 110: omuz yüzeyi de kayar) */
function refOn(r,polys,ann){
  if(r.t==='plane'){const w=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];return polys.filter(coplanarFilter(r.n,w))}
  const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);
  const off=v=>{const w=new T.Vector3(v.x,v.y,v.z).sub(C);const t=w.dot(A);return [t,w.sub(A.clone().multiplyScalar(t)).length()]};
  // kenar seçimleri: doğrusal kenarın iki köşesi doğru üzerinde; dairesel kenarın köşeleri dairenin üzerinde
  if(r.e==='line')return polys.filter(q=>q.verts.filter(v=>off(v)[1]<1e-3).length>=2);
  if(r.e==='circ'){const tol=Math.max(0.02,r.r*0.02);return polys.filter(q=>q.verts.some(v=>{const [t,d]=off(v);return Math.abs(t)<1e-3&&Math.abs(d-r.r)<tol}))}
  const an=ann.filter(an=>Math.abs(Math.abs(an.A.dot(A))-1)<1e-4&&an.C.clone().sub(C).sub(A.clone().multiplyScalar(an.C.clone().sub(C).dot(A))).length()<1e-3);
  // açıklaması olmayan silindirler (yay ekstrüzyonu, radyus, STL): yüzeyden bulunan eksen
  return an.length||r.t0===undefined||!r.r?an:polys.filter(cylFilter(r));
}
function remapRef(r,old,nw){
  if(refOn(r,nw.polys,nw.ann||[]).length)return null;
  const was=refOn(r,old.polys,old.ann||[]);if(!was.length)return null;
  if(r.t==='plane'){
    const F=new Set(was.map(q=>q.shared)),n=r.n,w0=n[0]*r.p[0]+n[1]*r.p[1]+n[2]*r.p[2];let best=null;
    for(const q of nw.polys){if(!F.has(q.shared)||q.plane.n.x*n[0]+q.plane.n.y*n[1]+q.plane.n.z*n[2]<1-1e-6)continue;const d=Math.abs(q.plane.w-w0);if(!best||d<best.d)best={d,w:q.plane.w}}
    if(!best)return null;const k=best.w-w0,q6=x=>Math.round(x*1e6)/1e6;return {...r,p:[q6(r.p[0]+n[0]*k),q6(r.p[1]+n[1]*k),q6(r.p[2]+n[2]*k)]};
  }
  const o=was[0],pre=g=>String(g).split(':')[0];if(o.gid===undefined)return null;const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);let best=null;
  for(const an of nw.ann||[]){if(pre(an.gid)!==pre(o.gid)||Math.abs(Math.abs(an.A.dot(A))-1)>1e-4)continue;
    const w=an.C.clone().sub(C);const perp=w.sub(A.clone().multiplyScalar(w.dot(A))).length();const sc=perp+Math.abs(an.r-o.r)+(an.gid===o.gid?0:1e-3);if(!best||sc<best.sc)best={sc,an}}
  if(!best)return null;const an=best.an,sg=an.A.dot(A)<0?-1:1,q6=x=>Math.round(x*1e6)/1e6;
  return {...r,p:[q6(an.C.x),q6(an.C.y),q6(an.C.z)],d:[an.A.x*sg,an.A.y*sg,an.A.z*sg],r:an.r,t0:sg>0?an.t0:-an.t1,t1:sg>0?an.t1:-an.t0};
}
/* parça yeniden hesaplandı: onu kullanan montajlarda eşleştirmeler yeni geometriye taşınır ve montaj yeniden çözülür
   (montaj sekmesine geçmeden açılan montaj resmi de güncel konumları gösterir) */
function partChanged(p,old,nw){
  let n=0;
  for(const a of project.asms){const cs=new Set(a.comps.filter(c=>c.part===p.id).map(c=>c.id));if(!cs.size)continue;
    if(old)for(const m of a.mates)for(const sd of mSides(m)){if(!cs.has(sd.comp))continue;const r=remapRef(sd.ref,old,nw);if(r){sd.ref=r;n++}}
    a._unsolved=!solveAsm(a)}
  return n;
}

/* ---------- montaj değişikliği ---------- */
function asmChanged(rebuildView=true){
  const a=curAsm();
  if(a){const ok=solveAsm(a);a._unsolved=!ok}
  if(rebuildView)buildAsmView();else{updateAsmPoses();if(a)asmView.dof=asmDof(a);asmHighlight()}
  saveState();renderAsmTree();renderAsmPM();asmStatus();asmMass();updUndo();
}
function newAsm(){
  let n=project.asms.length+1;while(project.asms.some(a=>a.name==='Montaj'+n))n++;
  const a={id:uid('A'),name:'Montaj'+n,comps:[],mates:[]};project.asms.push(a);project.cur.asm=a.id;
  asmUI.sel=null;asmChanged();openInsertPM();
}
function addComp(partId){
  const a=curAsm();if(!a)return;const p=partById(partId);if(!p)return;const d=partData(p);
  if(!d.polys.length){toast('Bu parçada henüz gövde yok. Önce Parça sekmesinde modelle.');return}
  if(a.comps.length>=20){toast('Bir montajda en fazla 20 bileşen olabilir.');return}
  pushAsmHist();
  let T_=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  if(a.comps.length&&asmView.box&&d.box){const x=asmView.box.max[0]-d.box.min[0]+20;const y=(asmView.box.min[1]+asmView.box.max[1])/2-(d.box.min[1]+d.box.max[1])/2;T_=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1]}
  const c={id:uid('c'),part:partId,T:T_,fixed:!a.comps.length};a.comps.push(c);asmUI.sel=c.id;
  // yeni bileşen yan yana dizildiğinden görünümün dışına düşebilir: o zaman görünüm hepsine sığdırılır
  const seen=()=>{const b=d.box;if(!b)return true;camera.updateMatrixWorld();for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){
    const v=new T.Vector3(x+T_[12],y+T_[13],z+T_[14]).project(camera);if(Math.abs(v.x)>0.95||Math.abs(v.y)>0.95)return false}return true};
  asmChanged();if(a.comps.length<=2||!seen())fitCamera(null);
  toast(`${compName(a,c)} eklendi${c.fixed?' ve sabitlendi':''}.`);
}
function delComp(id){const a=curAsm();const c=compById(id);if(!c)return;
  if(c.pat){toast('Bu bileşen bir bileşen çoğaltmasıyla oluşturuldu. Çoğaltmayı düzenle veya sil.');return}
  pushAsmHist();if(a.pats){for(const p of a.pats)p.seeds=p.seeds.filter(x=>x!==id);a.pats=a.pats.filter(p=>p.seeds.length);if(!a.pats.length)delete a.pats}const nm=compName(a,c);a.comps=a.comps.filter(x=>x!==c);a.mates=a.mates.filter(m=>mSides(m).every(s=>s.comp!==id));if(a.explode&&a.explode.steps){for(const st of a.explode.steps)st.comps=st.comps.filter(x=>x!==id);a.explode.steps=a.explode.steps.filter(st=>st.comps.length)}if(asmUI.sel===id)asmUI.sel=null;asmChanged();toast(`${nm} ve eşleştirmeleri silindi.`,{label:'Geri al',fn:asmUndo})}

/* ---------- ağaç ---------- */
function renderAsmTree(){
  const a=curAsm();let h='';
  h+=`<div class="tree-proj">${project.asms.length?`<select id="asmSel" aria-label="Etkin montaj">${project.asms.map(x=>`<option value="${x.id}" ${a&&x.id===a.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>`:''}<button class="tbtn" data-aa="new">+ Yeni montaj</button>${a?`<button class="tbtn" data-aa="del">Montajı sil</button>`:''}</div>`;
  if(!a){h+=`<div class="tree-empty">Bu projede henüz montaj yok. “+ Yeni montaj” ile oluştur, sonra proje parçalarını ekle.</div>`;$('#tree').innerHTML=h;return}
  h+=`<div class="tree-part"><input id="asmNameIn" value="${esc(a.name)}" aria-label="Montaj adı"></div>`;
  h+=`<div class="tree-sec">Bileşenler (${a.comps.length})</div>`;
  if(!a.comps.length)h+=`<div class="tree-empty">Şeritten “Bileşen Ekle” ile proje parçalarını ekle.</div>`;
  for(const c of a.comps){
    const st=asmView.dof[c.id];const pre=st==='f'?'(f) ':(st==='-'?'<em>(-)</em> ':'');
    if(c.pat){h+=`<div class="ti child ${asmUI.sel===c.id?'sel':''} ${c.hidden?'sup':''}" data-comp="${c.id}" title="Bileşen çoğaltmasıyla oluşturuldu"><span class="ic">${IC.part}</span><span class="nm">${pre}${esc(compName(a,c))}</span><span class="acts"><button data-ca="open" title="Parçayı düzenle">${IC.edit}</button><button data-ca="hide" title="${c.hidden?'Göster':'Gizle'}">${IC.eye}</button></span></div>`;continue}
    h+=`<div class="ti ${asmUI.sel===c.id?'sel':''} ${c.hidden?'sup':''}" data-comp="${c.id}" title="${c.fixed?'Sabit':st==='-'?'Tam konumlanmamış':'Tam konumlanmış'}"><span class="ic">${IC.part}</span><span class="nm">${pre}${esc(compName(a,c))}</span><span class="acts">`+
      `<button data-ca="open" title="Parçayı düzenle">${IC.edit}</button><button data-ca="fix" title="${c.fixed?'Serbest bırak':'Sabitle'}">${c.fixed?IC.unfix:IC.fix}</button><button data-ca="hide" title="${c.hidden?'Göster':'Gizle'}">${IC.eye}</button><button data-ca="del" title="Montajdan çıkar">${IC.trash}</button></span></div>`;
  }
  if(a.pats&&a.pats.length){h+=`<div class="tree-sec">Bileşen çoğaltmaları (${a.pats.length})</div>`;
    for(const p of a.pats){const sel=asmUI.pm&&asmUI.pm.type==='pat'&&asmUI.pm.editId===p.id;
      h+=`<div class="ti child ${sel?'sel':''} ${p.err?'err':''}" data-apat="${p.id}" title="${esc(p.err||'')}"><span class="ic">${IC[p.type==='circ'?'cpattern':'lpattern']}</span><span class="nm">${esc(p.name)} <span style="color:var(--muted)">(${p.seeds.length} bileşen × ${p.n})</span></span><span class="acts"><button data-pa2="edit" title="Düzenle">${IC.edit}</button><button data-pa2="del" title="Sil">${IC.trash}</button></span></div>`}}
  h+=`<div class="tree-sec">Eşleştirmeler (${a.mates.length})</div>`;
  if(!a.mates.length)h+=`<div class="tree-empty">Şeritten “Eşleştir” ile iki bileşenin yüzeylerini veya eksenlerini seç.</div>`;
  for(const m of a.mates){
    const bad=mSides(m).some(s=>!mateRefOk(s));const cn=[...new Set(mSides(m).map(s=>s.comp))].map(id=>{const c=compById(id);return c?compName(a,c):'?'}).join(', ');
    const sel=asmUI.pm&&asmUI.pm.editId===m.id;
    h+=`<div class="ti child ${sel?'sel':''} ${m.suppressed?'sup':''} ${bad?'err':''}" data-mate="${m.id}" title="${bad?'Referans yüzey/eksen parçada bulunamadı':''}"><span class="ic" style="justify-content:center;font-weight:600">${MATE_G[m.type]||'?'}</span><span class="nm">${esc(m.name||MATE_T[m.type])} <span style="color:var(--muted)">(${esc(cn)})</span></span><span class="acts"><button data-ma="edit" title="Düzenle">${IC.edit}</button><button data-ma="sup" title="${m.suppressed?'Bastırmayı kaldır':'Bastır'}">${m.suppressed?IC.play:IC.pause}</button><button data-ma="del" title="Sil">${IC.trash}</button></span></div>`;
  }
  if(a._unsolved)h+=`<div class="tree-err" style="margin-left:12px">Eşleştirmeler aynı anda sağlanamıyor. Son eklenen eşleştirmeyi kontrol et.</div>`;
  h+=`<div class="tree-sec">Proje parçaları</div>`+project.parts.map(p=>`<div class="ti" data-addpart="${p.id}" title="Montaja ekle"><span class="ic">${IC.part}</span><span class="nm">${esc(p.partName)}</span><span class="acts" style="display:flex"><button data-addp="${p.id}" title="Montaja ekle">${IC.asmInsert}</button></span></div>`).join('');
  $('#tree').innerHTML=h;
}
function asmTreeClick(e){
  const aa=e.target.closest('[data-aa]');
  // açık panel, montaj değişmeden önce kendi montajında kapatılır (yoksa önizleme/geçmiş diğer montaja uygulanırdı)
  if(aa){closeAsmPM(true,true);if(aa.dataset.aa==='new')newAsm();else{const a=curAsm();if(!a)return;verSnapNow(`“${a.name}” silinmeden önce`);const i=project.asms.indexOf(a);project.asms.splice(i,1);project.cur.asm=project.asms[0]?project.asms[0].id:null;asmUI.sel=null;asmChanged();toast(`“${a.name}” silindi.`,{label:'Geri al',fn:()=>{project.asms.splice(i,0,a);project.cur.asm=a.id;asmChanged()}})}return}
  const ap=e.target.closest('[data-addp]');if(ap){if(!curAsm()){newAsm()}addComp(ap.dataset.addp);return}
  const ct=e.target.closest('[data-comp]');
  if(ct){const id=ct.dataset.comp;const b=e.target.closest('[data-ca]');const c=compById(id);if(!c)return;
    if(!b){asmUI.sel=(e.ctrlKey||e.metaKey)&&asmUI.sel===id?null:id;asmHighlight();renderAsmTree();return}
    const k=b.dataset.ca;
    if(k==='open'){switchPart(c.part);setTab('model');return}
    if(k==='del'){delComp(id);return}
    if(k==='fix'&&c.pat)return;
    pushAsmHist();if(k==='fix')c.fixed=!c.fixed;if(k==='hide')c.hidden=!c.hidden;asmChanged();return}
  const ap2=e.target.closest('[data-apat]');
  if(ap2){const a=curAsm();const p=(a.pats||[]).find(x=>x.id===ap2.dataset.apat);if(!p)return;const b=e.target.closest('[data-pa2]');
    if(b&&b.dataset.pa2==='del'){closeAsmPM(true,true);pushAsmHist();a.pats=a.pats.filter(x=>x!==p);if(!a.pats.length)delete a.pats;applyPats(a);asmChanged();toast(`“${p.name}” ve kopyaları silindi.`,{label:'Geri al',fn:asmUndo});return}
    openPatPM(p.type,p);return}
  const mt=e.target.closest('[data-mate]');
  if(mt){const a=curAsm();const m=a.mates.find(x=>x.id===mt.dataset.mate);if(!m)return;const b=e.target.closest('[data-ma]');const k=b?b.dataset.ma:'edit';
    if(k==='edit'){openMatePM(m);return}
    pushAsmHist();if(k==='sup')m.suppressed=!m.suppressed;if(k==='del')a.mates=a.mates.filter(x=>x!==m);asmChanged();return}
}
function asmTreeDbl(e){const ct=e.target.closest('[data-comp]');if(ct&&!e.target.closest('[data-ca]')){const c=compById(ct.dataset.comp);if(c){switchPart(c.part);setTab('model')}}}
function asmTreeChange(e){
  if(e.target.id==='asmSel'){closeAsmPM(true,true);project.cur.asm=e.target.value;asmUI.sel=null;asmChanged();fitCamera(VIEWDIRS.iso,false);return}
  if(e.target.id==='asmNameIn'){const a=curAsm();if(a){a.name=e.target.value.trim()||'Montaj';saveState();renderAsmTree()}}
}

/* ---------- şerit ---------- */
function renderAsmRibbon(){
  const t=asmUI.tool;
  $('#ribbon').innerHTML=rb('ainsert','asmInsert','Bileşen Ekle')+rb('amate','mate','Eşleştir',asmUI.pm&&asmUI.pm.type==='mate'?'on':'')+'<div class="rsep"></div>'+
    rb('amove','move','Bileşeni Taşı',asmUI.pm&&asmUI.pm.type==='move'&&!asmUI.pm.rot?'on':'')+rb('arotate','rotate','Bileşeni Döndür',asmUI.pm&&asmUI.pm.type==='move'&&asmUI.pm.rot?'on':'')+'<div class="rsep"></div>'+
    rb('acpat','cpattern','Dairesel Bileşen Çoğaltma',asmUI.pm&&asmUI.pm.type==='pat'&&asmUI.pm.draft.type==='circ'?'on':'')+rb('alpat','lpattern','Doğrusal Bileşen Çoğaltma',asmUI.pm&&asmUI.pm.type==='pat'&&asmUI.pm.draft.type==='lin'?'on':'')+'<div class="rsep"></div>'+
    rb('ameasure','measure','Ölç',meas?'on':'')+'<div class="rsep"></div>'+rb('aexplode','explode','Patlatılmış Görünüm',asmUI.pm&&asmUI.pm.type==='explode'?'on':'')+rb('atoggle','explode',asmUI.exf>0.5?'Topla':'Patlat',asmUI.exf>0.5?'on':'')+rb('ainterf','interf','Girişim Algıla',asmUI.pm&&asmUI.pm.type==='interf'?'on':'')+'<div class="rsep"></div>'+
    rb('adraw','asmDraw','Montaj Resmi')+rb('astl','stl','Montajı STL olarak al');
  fitRibbon($('#ribbon'));
}
function asmCmd(c){
  if(c==='ainsert'){if(!curAsm())newAsm();else openInsertPM();return}
  if(c==='amate'){const P=asmUI.pm;if(P&&P.type==='mate'&&P.isNew&&!P.draft.a&&!P.draft.b){closeAsmPM();return}collapseIfExploded();openMatePM(null);return}
  if(c==='amove'||c==='arotate'){const P=asmUI.pm,rot=c==='arotate';if(P&&P.type==='move'&&!!P.rot===rot){closeAsmPM();return}openMovePM(rot);return}
  if(c==='astl'){exportAsmSTL();return}
  if(c==='aexplode'){openExplodePM();return}
  if(c==='ameasure'){if(meas)closeMeasure();else openMeasure();return}
  if(c==='atoggle'){const a=curAsm();if(!a||!a.comps.length)return;setExplode(asmUI.exf<0.5);return}
  if(c==='ainterf'){openInterfPM();return}
  if(c==='acpat'||c==='alpat'){collapseIfExploded();openPatPM(c==='acpat'?'circ':'lin',null);return}
  if(c==='adraw'){openAsmDrawing();return}
}

/* ---------- PropertyManager ---------- */
function openInsertPM(){if(!curAsm())return;closeAsmPM(true);asmUI.pm={type:'insert'};renderAsmPM()}
function openMatePM(existing){
  const a=curAsm();if(!a||a.comps.length<2){toast('Eşleştirme için montajda en az iki bileşen olmalı.');return}
  closeAsmPM(true);asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  asmUI.pm={type:'mate',draft:existing?{...clone(existing),_valFor:existing.type}:{id:uid('m'),type:null,a:null,b:null,flip:false,val:10},isNew:!existing,editId:existing?existing.id:null,orig:a.comps.map(c=>({id:c.id,T:c.T.slice()})),err:''};
  const h0=asmHistFor();asmUI.pm.redo0=h0?h0.redo.slice():null;
  pushAsmHist();if(h0){asmUI.pm.hn=h0.undo.length;asmUI.pm.hs=h0.undo[h0.undo.length-1]}renderAsmRibbon();renderAsmPM();asmHighlight();renderAsmTree();
  if(existing)previewMate();
}
function restoreOrig(){const P=asmUI.pm,a=curAsm();if(!P||!P.orig||!a)return;for(const o of P.orig){const c=a.comps.find(x=>x.id===o.id);if(c)c.T=o.T.slice()}}
function closeAsmPM(silent,dropHist){
  const P=asmUI.pm;if(!P)return;
  // açılışta eklenen geri alma adımı geri çekilir; panel açıkken başka adım eklendiyse (ör. bileşen gizleme) yalnızca o adım çıkarılır
  if(P.type==='mate'){asmHover(null);restoreOrig();const h=asmHistFor();if(h&&h.undo.length&&!P.committed&&!P.dragged){
    if(h.undo.length===P.hn||P.hn===undefined){h.undo.pop();if(P.redo0)h.redo=P.redo0}else{const i=h.undo.lastIndexOf(P.hs);if(i>=0)h.undo.splice(i,1)}}updateAsmPoses()}
  if(P.type==='interf')setGhost(false);
  if(P.type==='move')prompt_(null);
  if(P.type==='pat'&&!P.committed){const a=curAsm(),h=asmHistFor();if(a){asmRestore(a,P.snap);if(h&&h.undo[h.undo.length-1]===P.snap){h.undo.pop();if(P.redo0)h.redo=P.redo0}buildAsmView();asmView.dof=asmDof(a);if(!silent)renderAsmTree()}}
  asmUI.pm=null;asmHighlight();if(!silent){renderAsmPM();renderAsmTree();renderAsmRibbon()}
}
function curWorld(s){const c=compById(s.comp);return wref(s.ref,new T.Matrix4().fromArray(c.T))}
function previewMate(){
  clearTimeout(asmPmInput.t);asmPmInput.t=0;const P=asmUI.pm,a=curAsm();if(!P||P.type!=='mate'||!a)return;restoreOrig();
  if(slotsFull(P.draft)){
    const saved=a.mates;a.mates=saved.filter(m=>m.id!==P.editId);
    const ok=solveAsm(a,{extra:[P.draft]});a.mates=saved;
    P.err=ok?'':'Bu eşleştirme mevcut eşleştirmelerle birlikte sağlanamıyor. Hizalamayı ters çevirmeyi veya başka bir tür seçmeyi dene.';
    if(!ok)restoreOrig();
  }else P.err='';
  updateAsmPoses();asmHighlight();renderAsmPM();
}
function commitMate(close){
  const P=asmUI.pm,a=curAsm(),d=P.draft;
  // seçimsiz panelde Tamam / Enter paneli kapatır
  if(P.isNew&&!d.a&&!d.b){closeAsmPM();return}
  if(!slotsFull(d)){toast(d.type&&!twoSlot(d.type)?`${MATE_T[d.type]} için gereken seçimleri tamamla.`:'İki seçim yap ve bir eşleştirme türü seç.');return}
  // yazılıp henüz önizlenmemiş değer (ör. mesafe yazılıp hemen Enter) önce çözülür
  if(asmPmInput.t)previewMate();
  if(P.err){toast('Bu eşleştirme çözülemiyor.');return}
  // türü değişen otomatik adlı eşleştirme yeni türün adını alır (Çakışık1 → Mesafe1)
  const old=!P.isNew&&a.mates.find(m=>m.id===P.editId);if(old&&old.type!==d.type&&new RegExp('^'+MATE_T[old.type]+'\\d+$').test(d.name||''))d.name='';
  if(!d.name||P.isNew){let n=1;while(a.mates.some(m=>m.name===MATE_T[d.type]+n&&m.id!==d.id))n++;d.name=MATE_T[d.type]+n}
  if(P.isNew)a.mates.push(d);else{const i=a.mates.findIndex(m=>m.id===P.editId);if(i>=0)a.mates[i]=d}
  P.committed=true;asmUI.pm=null;asmHover(null);asmChanged(false);renderAsmRibbon();
  // SolidWorks gibi: yeni eşleştirme eklenince panel açık kalır ve sonraki eşleştirmenin seçimlerini bekler (✓ veya Esc kapatır)
  if(P.isNew&&!close){openMatePM(null);if(asmUI.pm)asmUI.pm.last=d.name;renderAsmPM()}
}
/* düz yüzeyin montajdaki yönü (ör. “+X’e bakar”): aynı bileşenin birbirine benzeyen yüzeylerini ayırt etmek için */
function dirName(n,M){const w=[0,1,2].map(k=>M[k]*n[0]+M[4+k]*n[1]+M[8+k]*n[2]);const i=w.reduce((b,v,k)=>Math.abs(v)>Math.abs(w[b])?k:b,0);
  return Math.abs(w[i])>0.995?`${w[i]>0?'+':'−'}${'XYZ'[i]} yönüne bakar`:'eğik'}
function renderAsmPM(){
  const ws=$('#ws'),el=$('#pm');const P=asmUI.pm;
  if(meas){renderMeasurePM();return}
  if(!P){ws.classList.remove('pmon');el.innerHTML='';requestAnimationFrame(resize);return}
  ws.classList.add('pmon');requestAnimationFrame(resize);
  let title='',b='';
  if(P.type==='explode'){title='Patlatılmış Görünüm';b=explodePMBody()}
  else if(P.type==='pat'){title=P.draft.type==='circ'?'Dairesel Bileşen Çoğaltma':'Doğrusal Bileşen Çoğaltma';b=patPMBody()}
  else if(P.type==='interf'){title='Girişim Algılama';b=interfPMBody()}
  else if(P.type==='move'){title=P.rot?'Bileşeni Döndür':'Bileşeni Taşı';b=movePMBody()}
  else if(P.type==='insert'){
    title='Bileşen Ekle';
    b=grp('Proje parçaları',`<div class="lst">${project.parts.map(p=>{const d=partData(p);return `<div><span>${esc(p.partName)}${d.polys.length?'':' (gövde yok)'}</span><button class="sbtn" data-addp="${p.id}" style="width:auto;height:auto">Ekle</button></div>`}).join('')}</div><p class="note">İlk eklenen bileşen sabitlenir.</p>`,'İlk eklenen bileşen sabitlenir (f). Aynı parçayı birden çok kez ekleyebilirsin (örneğin 4 cıvata). Yeni parça çizmek için Parça sekmesine geç.');
  }else{
    title=P.isNew?'Eşleştir':'Eşleştirmeyi düzenle';b=matePMBody(P);
  }
  // önizleme paneli yeniden çizer: yazılmakta olan alan odakta ve imleç yerinde kalır (yoksa ikinci rakam kaybolurdu)
  const ae=document.activeElement,fk=ae&&el.contains(ae)&&ae.dataset&&ae.dataset.k,fs=fk&&ae.selectionStart,fe=fk&&ae.selectionEnd,fv=fk&&ae.value;
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">${title}</div><div class="pm-sub">${esc((curAsm()||{}).name||'')}</div></div><div class="pm-actions">${P.type==='mate'||P.type==='explode'||P.type==='pat'||P.type==='move'?`<button class="ok" data-apm="ok" title="Tamam" aria-label="Tamam">${IC.ok}</button>`:''}<button data-apm="cancel" title="${P.type==='mate'?'İptal':'Kapat'}" aria-label="Kapat">${IC.x}</button></div></div><div class="pm-body">${b}</div>`;
  if(fk){const f=el.querySelector(`[data-k="${fk}"]`);if(f){if(f.value!==fv)f.value=fv;f.focus();try{f.setSelectionRange(fs,fe)}catch(e){}}}
}
function asmPmClick(e){
  if(meas&&measurePmClick(e))return;
  const P=asmUI.pm;if(!P)return;
  const a=e.target.closest('[data-apm]');if(a){if(a.dataset.apm==='ok'&&P.type==='mate')commitMate(true);else if(a.dataset.apm==='ok'&&P.type==='pat')commitPat();else closeAsmPM();return}
  if(P.type==='pat'&&patPmClick(e))return;
  if(P.type==='move'){movePmClick(e);return}
  if(P.type==='explode'&&explodePmClick(e))return;
  if(P.type==='interf'&&interfPmClick(e))return;
  const ap=e.target.closest('[data-addp]');if(ap){addComp(ap.dataset.addp);return}
  const t=e.target.closest('[data-mtype]');if(t){setMateType(t.dataset.mtype);return}
  const gg=e.target.closest('[data-mgrp]');if(gg){P.open=P.open||{};P.open[gg.dataset.mgrp]=!P.open[gg.dataset.mgrp];renderAsmPM();return}
  if(e.target.closest('[data-mflip]')){P.draft.flip=!P.draft.flip;previewMate();return}
  if(e.target.closest('[data-malign]')){P.draft.align=!P.draft.align;previewMate();return}
  const c=e.target.closest('[data-mclr]');if(c){P.draft[c.dataset.mclr]=null;if(twoSlot(P.draft.type))P.draft.type=null;P.draft.lock=false;delete P.draft.lk;previewMate();return}
}
function asmPmInput(e){const P=asmUI.pm;if(P&&P.type==='pat'){patPmInput(e);return}if(P&&P.type==='move'){movePmInput(e);return}if(P&&P.type==='explode'){const t=e.target;if(t.dataset.k==='dist'){const v=num(t.value);if(isFinite(v))P.draft.dist=v}return}if(!P||P.type!=='mate')return;const t=e.target;if(t.dataset.num){const v=num(t.value);if(isFinite(v)&&v>=0){P.draft[t.dataset.k||'val']=v;if(t.dataset.k==='val')P.draft._valFor=P.draft.type;clearTimeout(asmPmInput.t);asmPmInput.t=setTimeout(previewMate,250)}}}
function asmPmChange(e){const P=asmUI.pm;if(!P)return;if(P.type==='explode')explodePmChange(e);if(P.type==='interf')interfPmChange(e);
  if(P.type==='mate'&&e.target.hasAttribute('data-mlock')){const d=P.draft;d.lock=e.target.checked;if(d.lock)setLockRef(d);previewMate()}}
/* dönme kilidi: eksene dik bir dünya yönü, iki bileşenin kendi koordinatlarına çevrilip saklanır (şimdiki göreli açı korunur) */
function setLockRef(d){
  const A=curWorld(d.a).d.clone().normalize();const u=new T.Vector3(1,0,0).cross(A);if(u.length()<0.3)u.set(0,1,0).cross(A);u.normalize();
  const loc=s=>{const c=compById(s.comp);return u.clone().transformDirection(new T.Matrix4().fromArray(c.T).invert()).toArray().map(v=>Math.round(v*1e9)/1e9)};
  d.lk={a:loc(d.a),b:loc(d.b)};
}

/* ---------- işaretçi ---------- */
function asmUp(e){
  const dn=asmUI.down;asmUI.down=null;asmUI.grab=null;
  // sürüklenmeyen yakalama tıklamadır (seçim, eşleştirme seçimi)
  if(asmUI.drag&&endDrag(e))return;controls.enabled=true;
  if(!dn||dn.b!==0||Math.hypot(e.clientX-dn.x,e.clientY-dn.y)>5)return;
  if(meas){measureClick(e);return}
  const P=asmUI.pm;
  if(P&&P.type==='explode'){const h=asmPick(e);if(!h)return;const l=P.draft.comps;const i=l.indexOf(h.comp);if(i>=0)l.splice(i,1);else l.push(h.comp);renderAsmPM();asmHighlight();return}
  if(P&&P.type==='interf')return;
  if(P&&P.type==='pat'){patClick(e);return}
  if(P&&P.type==='mate'){const h=asmPick(e,{edges:true});if(h&&h.ref)mateSelect(h);return}
  if(P&&P.type==='move'){const h=asmPick(e),c=h&&compById(h.comp);
    if(c&&!c.fixed&&!c.pat){P.comp=c.id;asmUI.sel=c.id;movePmSync()}else if(c)toast(c.fixed?'Sabit (f) bileşen taşınamaz. Ağaçtan serbest bırakabilirsin.':'Çoğaltılmış bileşen kaynağıyla birlikte hareket eder; kaynak bileşeni taşı.');
    asmHighlight();renderAsmPM();renderAsmTree();return}
  selectCompAt(e);
}
function selectCompAt(e){const h=asmPick(e);asmUI.sel=h?(asmUI.sel===h.comp?null:h.comp):null;asmHighlight();renderAsmTree()}
function asmDbl(e){if(asmUI.pm||asmUI.tool)return;const h=asmPick(e);if(!h)return;const c=compById(h.comp);if(c){switchPart(c.part);setTab('model')}}

/* ---------- durum ---------- */
function asmStatus(){
  const el=$('#vpStatus');el.classList.remove('hidden');const a=curAsm();
  if(!a){el.textContent='Montaj yok. Ağaçtan “+ Yeni montaj” ile başla.';el.classList.remove('bad');return}
  const und=a.comps.filter(c=>asmView.dof[c.id]==='-').length;
  if(a._unsolved){el.textContent='Eşleştirmeler çözülemiyor.';el.classList.add('bad');return}
  el.classList.remove('bad');el.textContent=`${a.comps.length} bileşen, ${a.mates.length} eşleştirme`+(und?`. ${und} bileşen tam konumlanmadı (-)`:'');
}
function asmMass(){
  const el=$('#mass');const a=curAsm();if(!a||!a.comps.length){el.classList.add('hidden');return}el.classList.remove('hidden');
  let g=0,vol=0;for(const c of a.comps){const p=partById(c.part);if(!p)continue;const d=partData(p);if(!d.props)continue;vol+=d.props.vol;g+=d.props.vol/1000*(MATERIALS[p.material]||MATERIALS.steel).rho}
  const b=asmView.box;
  el.innerHTML=`<span>Bileşen</span><span>${a.comps.length} adet (${new Set(a.comps.map(c=>c.part)).size} farklı parça)</span><span>Toplam hacim</span><span>${fmt(vol,0)} mm³</span><span>Toplam kütle</span><span>${massText(g)}</span>`+(b?`<span>Boyutlar (X × Y × Z)</span><span>${fmt(b.max[0]-b.min[0],1)} × ${fmt(b.max[1]-b.min[1],1)} × ${fmt(b.max[2]-b.min[2],1)}</span>`:'');
}

/* ================= STL ve ZIP ================= */
function stlBinary(items,name){
  let n=0;for(const it of items)for(const p of it.polys)n+=p.verts.length-2;
  const buf=new ArrayBuffer(84+n*50),dv=new DataView(buf);const hdr=('toCAD '+(name||'')).slice(0,79);for(let i=0;i<hdr.length;i++)dv.setUint8(i,hdr.charCodeAt(i)&127);dv.setUint32(80,n,true);
  let o=84;const v=new T.Vector3();
  for(const it of items){const M=it.M;for(const p of it.polys){const q=p.verts.map(w=>{v.set(w.x,w.y,w.z);if(M)v.applyMatrix4(M);return [v.x,v.y,v.z]});
    for(let i=1;i<q.length-1;i++){const A=q[0],B=q[i],C=q[i+1];const nn=vn(vc(vs(B,A),vs(C,A)));for(const x of nn){dv.setFloat32(o,x,true);o+=4}for(const P of [A,B,C])for(const x of P){dv.setFloat32(o,x,true);o+=4}dv.setUint16(o,0,true);o+=2}}}
  return new Uint8Array(buf);
}
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function makeZip(files){
  const enc=new TextEncoder();const parts=[],central=[];let off=0;const d=new Date();
  const dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  for(const f of files){
    const nm=enc.encode(f.name),crc=crc32(f.bytes),sz=f.bytes.length;
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dt,true);h.setUint16(12,dd,true);h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,f.bytes);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,dt,true);c.setUint16(14,dd,true);c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+sz;
  }
  const cs=central.reduce((s,x)=>s+x.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,new Uint8Array(e.buffer)],{type:'application/zip'});
}
const fileSafe=s=>(String(s||'parca').trim().replace(/[^\p{L}\p{N}\-_ ]+/gu,'').replace(/\s+/g,'-')||'parca');
function exportPartSTL(){
  if(!model.polys.length){toast('Etkin parçada gövde yok.');return}
  saveFile(fileSafe(state.partName)+'-stl.zip',makeZip([{name:fileSafe(state.partName)+'.stl',bytes:stlBinary([{polys:model.polys}],state.partName)}]));
}
function exportAsmSTL(){
  const a=curAsm();if(!a||!a.comps.length){toast('Montajda bileşen yok.');return}
  const items=[],files=[],seen=new Set();
  for(const c of a.comps){if(c.hidden)continue;const p=partById(c.part);if(!p)continue;const d=partData(p);items.push({polys:d.polys,M:new T.Matrix4().fromArray(c.T)});
    if(!seen.has(p.id)){seen.add(p.id);files.push({name:'parcalar/'+fileSafe(p.partName)+'.stl',bytes:stlBinary([{polys:d.polys}],p.partName)})}}
  files.unshift({name:fileSafe(a.name)+'.stl',bytes:stlBinary(items,a.name)});
  saveFile(fileSafe(a.name)+'-stl.zip',makeZip(files));
}
function parseSTL(buf){
  const dv=new DataView(buf);
  if(buf.byteLength>=84){const n=dv.getUint32(80,true);if(84+n*50===buf.byteLength){const out=new Float32Array(n*9);let o=84;for(let i=0;i<n;i++){o+=12;for(let k=0;k<9;k++){out[i*9+k]=dv.getFloat32(o,true);o+=4}o+=2}return out}}
  const txt=new TextDecoder().decode(buf);const re=/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;const v=[];let m;while((m=re.exec(txt)))v.push(+m[1],+m[2],+m[3]);
  if(!v.length||v.length%9)throw new Error('STL dosyası okunamadı.');return new Float32Array(v);
}
function importSTL(buf,fname){
  const f=parseSTL(buf);const n=f.length/9;
  if(n>150000){toast('Bu STL çok büyük ('+n+' üçgen). En fazla 150.000 üçgen desteklenir.');return}
  const p=newPart(uniqueName(String(fname||'STL').replace(/\.stl$/i,'')));p.mesh=f32ToB64(f);project.parts.push(p);
  if(n>60000)toast('Büyük STL: tarayıcı depolama alanı yetmeyebilir; projeyi .json olarak kaydetmeyi unutma.');
  switchPart(p.id);if(activeTab!=='model')setTab('model');toast(`“${p.partName}” STL olarak içe aktarıldı (${n} üçgen).`);
}
