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
  if(a==='new'){let n=project.parts.length+1;while(project.parts.some(p=>p.partName==='Parça'+n))n++;const p=newPart('Parça'+n);project.parts.push(p);switchPart(p.id);toast('Yeni parça oluşturuldu. Bir düzlem seçip Çizim ile başla.')}
  else if(a==='dup'){const p=normPart(JSON.parse(JSON.stringify(state,cleanR)));p.id=uid('P');p.partName=uniqueName(state.partName+' kopya');project.parts.push(p);switchPart(p.id);toast('Parça çoğaltıldı.')}
  else if(a==='del'){
    if(project.parts.length<=1){toast('Projede en az bir parça kalmalı.');return}
    if(partUsed(state.id)){toast('Bu parça bir montajda kullanılıyor. Önce montajdan çıkar.');return}
    const gone=state,idx=project.parts.indexOf(gone);project.parts.splice(idx,1);switchPart(project.parts[Math.max(0,idx-1)].id);
    toast(`“${gone.partName}” projeden silindi.`,{label:'Geri al',fn:()=>{project.parts.splice(idx,0,gone);switchPart(gone.id)}});
  }
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
const MATE_T={coincident:'Çakışık',concentric:'Eşmerkezli',parallel:'Paralel',perpendicular:'Dik',distance:'Mesafe',angle:'Açı'};
const MATE_G={coincident:'◦',concentric:'◎',parallel:'∥',perpendicular:'⊥',distance:'↔',angle:'∠'};
let asmView={groups:new Map(),box:null,dof:{}};
const asmUI={tool:null,sel:null,pm:null,drag:null,down:null};
const pcache=new Map();
const asmHists=new Map();
function curAsm(){return project.asms.find(a=>a.id===project.cur.asm)||null}
function asmHistFor(){const a=curAsm();if(!a)return null;if(!asmHists.has(a.id))asmHists.set(a.id,{undo:[],redo:[]});return asmHists.get(a.id)}
const asmSnap=a=>JSON.stringify({comps:a.comps,mates:a.mates,explode:a.explode||null});
function pushAsmHist(){const a=curAsm(),h=asmHistFor();if(!h)return;h.undo.push(asmSnap(a));if(h.undo.length>80)h.undo.shift();h.redo=[];updUndo()}
// açık eşleştirme paneli kapanırken açılışta eklediği adımı geri çeker; geri alınacak başka adım kalmayabilir
function asmUndo(){const a=curAsm(),h=asmHistFor();if(!h||!h.undo.length)return;asmUI.drag=null;closeAsmPM(true,true);if(!h.undo.length){asmChanged(false);renderAsmRibbon();return}
  h.redo.push(asmSnap(a));const o=JSON.parse(h.undo.pop());a.comps=o.comps;a.mates=o.mates;a.explode=o.explode||undefined;asmChanged();renderAsmRibbon()}
function asmRedo(){const a=curAsm(),h=asmHistFor();if(!h||!h.redo.length)return;asmUI.drag=null;closeAsmPM(true,true);if(!h.redo.length){asmChanged(false);renderAsmRibbon();return}
  h.undo.push(asmSnap(a));const o=JSON.parse(h.redo.pop());a.comps=o.comps;a.mates=o.mates;a.explode=o.explode||undefined;asmChanged();renderAsmRibbon()}
function partData(p){
  const key=partKey(p);let c=pcache.get(p.id);if(c&&c.key===key)return c;
  const r=(p===state&&model.key===key)?model:partRebuild(p);
  const box=r.polys.length?bboxPolys(r.polys):null,props=r.polys.length?massProps(r.polys):null;
  const {g,tp}=polysToBuffers(r.polys);const eg=segGeom(computeEdges(r.polys,null).filter(e=>e.k===1));
  if(c){c.g.dispose();c.eg.dispose()}
  c={key,polys:r.polys,ann:r.ann||[],box,props,g,tp,eg,err:Object.keys(r.errors||{}).length};pcache.set(p.id,c);return c;
}
function compName(a,c){const p=partById(c.part);const same=a.comps.filter(x=>x.part===c.part);return (p?p.partName:'?')+'<'+(same.indexOf(c)+1)+'>'}
function compById(id){const a=curAsm();return a?a.comps.find(c=>c.id===id):null}
function buildAsmView(){
  for(const ch of [...asmRoot.children]){if(ch===interfGroup)continue;asmRoot.remove(ch);ch.traverse(o=>{if(o.userData.own&&o.geometry)o.geometry.dispose();if(o.material&&o.material!==matEdge&&o.material!==matSel&&o.material!==matSelEdge&&o.material.dispose)o.material.dispose()})}
  asmView.groups=new Map();const a=curAsm();if(!a){asmView.box=null;asmView.dof={};return}
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
function updateAsmPoses(){const a=curAsm();if(!a)return;for(const c of a.comps){const v=asmView.groups.get(c.id);if(v){v.g.matrix.copy(dispM(a,c));v.g.matrixWorldNeedsUpdate=true}}asmBoxCalc()}
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
    const exSel=asmUI.pm&&asmUI.pm.type==='explode'&&asmUI.pm.draft.comps.includes(v.g.userData.comp);
    v.mat.emissive.setHex(exSel?0x6a3a00:(asmUI.sel===v.g.userData.comp&&!(asmUI.pm&&asmUI.pm.type==='mate')?0x4a3000:0x000000));
  }
  const P=asmUI.pm;if(!P||P.type!=='mate')return;
  for(const s of [P.draft.a,P.draft.b]){
    if(!s)continue;const v=asmView.groups.get(s.comp);if(!v)continue;const r=s.ref;
    if(r.t==='plane'){const w=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];const o=new T.Mesh(polysToBuffers(v.d.polys,coplanarFilter(r.n,w)).g,matSel);o.userData.hl=o.userData.own=true;o.renderOrder=3;v.g.add(o)}
    else{
      if(r.t0!==undefined){const o=new T.Mesh(polysToBuffers(v.d.polys,cylFilter(r)).g,matSel);o.userData.hl=o.userData.own=true;v.g.add(o)}
      const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);const t0=(r.t0!==undefined?r.t0:-20)-8,t1=(r.t1!==undefined?r.t1:20)+8;
      const gl=new T.BufferGeometry().setFromPoints([C.clone().addScaledVector(A,t0),C.clone().addScaledVector(A,t1)]);const l=new T.Line(gl,matSelEdge);l.userData.hl=l.userData.own=true;l.renderOrder=6;v.g.add(l);
    }
  }
}
/* ---------- seçim ---------- */
function asmPick(e){
  ray.setFromCamera(ndc(e),camera);const ms=[...asmView.groups.values()].filter(v=>v.g.visible&&v.m.visible).map(v=>v.m);
  const h=ray.intersectObjects(ms)[0];if(!h)return null;
  const cid=h.object.userData.comp,v=asmView.groups.get(cid);const poly=v.d.polys[v.d.tp[h.faceIndex]];if(!poly)return {comp:cid,point:h.point};
  const lp=h.point.clone().applyMatrix4(new T.Matrix4().copy(v.g.matrix).invert());const n=poly.plane.n;
  for(const an of v.d.ann){
    const w=lp.clone().sub(an.C),t=w.dot(an.A);const perp=w.sub(an.A.clone().multiplyScalar(t)).length();
    if(Math.abs(perp-an.r)<Math.max(0.1,an.r*0.04)&&t>=an.t0-0.2&&t<=an.t1+0.2&&Math.abs(n.x*an.A.x+n.y*an.A.y+n.z*an.A.z)<0.25)
      return {comp:cid,point:h.point,ref:{t:'axis',p:[an.C.x,an.C.y,an.C.z],d:[an.A.x,an.A.y,an.A.z],r:an.r,t0:an.t0,t1:an.t1}};
  }
  return {comp:cid,point:h.point,ref:{t:'plane',n:[n.x,n.y,n.z],p:[n.x*poly.plane.w,n.y*poly.plane.w,n.z*poly.plane.w]}};
}
/* ---------- eşleştirme çözücü ---------- */
const ML=50;
function wref(r,M){const p=new T.Vector3(...r.p).applyMatrix4(M);const v=new T.Vector3(...(r.n||r.d)).transformDirection(M);return r.t==='plane'?{t:'plane',p,n:v}:{t:'axis',p,d:v}}
function mateRes(m,P){
  const A=wref(m.a.ref,P[m.a.comp]),B=wref(m.b.ref,P[m.b.comp]);
  const crs=(u,v)=>{const c=u.clone().cross(v);return [c.x*ML,c.y*ML,c.z*ML]};
  const conc=(X,Y)=>{const w=Y.p.clone().sub(X.p);w.sub(X.d.clone().multiplyScalar(w.dot(X.d)));return [...crs(X.d,Y.d),w.x,w.y,w.z]};
  const pa=A.t==='plane',pb=B.t==='plane';const Pl=pa?A:B,Ax=pa?B:A;
  switch(m.type){
    case 'coincident':
      if(pa&&pb){const s=m.flip?-1:1;return [(A.n.x+s*B.n.x)*ML,(A.n.y+s*B.n.y)*ML,(A.n.z+s*B.n.z)*ML,B.p.clone().sub(A.p).dot(A.n)]}
      if(!pa&&!pb)return conc(A,B);
      return [Pl.n.dot(Ax.d)*ML,Ax.p.clone().sub(Pl.p).dot(Pl.n)];
    case 'concentric':return conc(A,B);
    case 'parallel':return pa&&pb?crs(A.n,B.n):(!pa&&!pb?crs(A.d,B.d):[Pl.n.dot(Ax.d)*ML]);
    case 'perpendicular':return pa&&pb?[A.n.dot(B.n)*ML]:(!pa&&!pb?[A.d.dot(B.d)*ML]:crs(Pl.n,Ax.d));
    case 'distance':return [...crs(A.n,B.n),B.p.clone().sub(A.p).dot(A.n)-(m.flip?-1:1)*num(m.val)];
    case 'angle':return [(A.n.dot(B.n)-Math.cos(num(m.val)*Math.PI/180))*ML];
  }
  return [];
}
function compCenter(c){const v=asmView.groups.get(c.id);const b=v&&v.d.box;const ctr=b?new T.Vector3((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2):new T.Vector3();return ctr.applyMatrix4(new T.Matrix4().fromArray(c.T))}
function asmSystem(a,extra){
  const live=new Set(a.comps.map(c=>c.id));
  const ms=a.mates.filter(m=>!m.suppressed).concat(extra||[]).filter(m=>live.has(m.a.comp)&&live.has(m.b.comp));
  const free=a.comps.filter(c=>!c.fixed);const idx={};free.forEach((c,i)=>idx[c.id]=i*6);
  const M0={},C0={};for(const c of a.comps){M0[c.id]=new T.Matrix4().fromArray(c.T);C0[c.id]=compCenter(c)}
  const poses=X=>{const P={};for(const c of a.comps){const i=idx[c.id];if(i===undefined){P[c.id]=M0[c.id];continue}
    const rv=new T.Vector3(X[i+3],X[i+4],X[i+5]);const ang=rv.length();const R=ang>1e-12?new T.Matrix4().makeRotationAxis(rv.divideScalar(ang),ang):new T.Matrix4();const c0=C0[c.id];
    P[c.id]=new T.Matrix4().makeTranslation(c0.x+X[i],c0.y+X[i+1],c0.z+X[i+2]).multiply(R).multiply(new T.Matrix4().makeTranslation(-c0.x,-c0.y,-c0.z)).multiply(M0[c.id])}return P};
  const res=(X,soft)=>{const P=poses(X);const r=[];for(const m of ms)r.push(...mateRes(m,P));if(soft)r.push(...soft(P));return r};
  return {n:free.length*6,poses,res,idx,ms};
}
function solveAsm(a,opt){
  opt=opt||{};const S=asmSystem(a,opt.extra);if(!S.ms.length)return true;
  if(!S.n)return S.res([]).every(v=>Math.abs(v)<1e-3);
  const r=lm(x=>S.res(x),new Array(S.n).fill(0),200);
  const mx=(r.r||[]).reduce((m,v)=>Math.max(m,Math.abs(v)),0);const ok=mx<1e-3;
  if(ok||opt.force){const P=S.poses(r.x);for(const c of a.comps)c.T=P[c.id].toArray()}
  return ok;
}
function asmDof(a){
  const S=asmSystem(a);const out={};
  let det=new Array(S.n).fill(false);
  if(S.n&&S.ms.length){const X0=new Array(S.n).fill(0);const r0=S.res(X0);const J=numJac(x=>S.res(x),X0,r0);const R=rrefInfo(J,S.n);const isP=new Set(R.piv);det=new Array(S.n).fill(true);
    for(let c=0;c<S.n;c++)if(!isP.has(c)){det[c]=false;R.piv.forEach((pc,row)=>{if(Math.abs(R.A[row][c])>1e-6)det[pc]=false})}}
  for(const c of a.comps){if(c.fixed){out[c.id]='f';continue}const i=S.idx[c.id];out[c.id]=[0,1,2,3,4,5].every(k=>det[i+k])?'ok':'-'}
  return out;
}
function mateRefOk(s){
  const c=compById(s.comp);if(!c)return false;const p=partById(c.part);if(!p)return false;const d=partData(p);const r=s.ref;
  if(r.t==='plane'){const w=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];return d.polys.some(coplanarFilter(r.n,w))}
  const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);
  return d.ann.some(an=>Math.abs(Math.abs(an.A.dot(A))-1)<1e-4&&an.C.clone().sub(C).sub(A.clone().multiplyScalar(an.C.clone().sub(C).dot(A))).length()<1e-3)||!d.ann.length;
}

/* ---------- parça değişince montajın güncellenmesi ---------- */
/* eşleştirme referansı (parça koordinatında düzlem/eksen) eski geometride bir yüzeye/eksene oturuyor, yenisinde oturmuyorsa:
   aynı özelliğin oluşturduğu, aynı yöndeki en yakın yüzeye/eksene taşınır (ör. mil boyu 100 → 110: omuz yüzeyi de kayar) */
function refOn(r,polys,ann){
  if(r.t==='plane'){const w=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];return polys.filter(coplanarFilter(r.n,w))}
  const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);
  return ann.filter(an=>Math.abs(Math.abs(an.A.dot(A))-1)<1e-4&&an.C.clone().sub(C).sub(A.clone().multiplyScalar(an.C.clone().sub(C).dot(A))).length()<1e-3);
}
function remapRef(r,old,nw){
  if(refOn(r,nw.polys,nw.ann||[]).length)return null;
  const was=refOn(r,old.polys,old.ann||[]);if(!was.length)return null;
  if(r.t==='plane'){
    const F=new Set(was.map(q=>q.shared)),n=r.n,w0=n[0]*r.p[0]+n[1]*r.p[1]+n[2]*r.p[2];let best=null;
    for(const q of nw.polys){if(!F.has(q.shared)||q.plane.n.x*n[0]+q.plane.n.y*n[1]+q.plane.n.z*n[2]<1-1e-6)continue;const d=Math.abs(q.plane.w-w0);if(!best||d<best.d)best={d,w:q.plane.w}}
    if(!best)return null;const k=best.w-w0,q6=x=>Math.round(x*1e6)/1e6;return {...r,p:[q6(r.p[0]+n[0]*k),q6(r.p[1]+n[1]*k),q6(r.p[2]+n[2]*k)]};
  }
  const o=was[0],pre=g=>String(g).split(':')[0],A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);let best=null;
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
    if(old)for(const m of a.mates)for(const sd of [m.a,m.b]){if(!cs.has(sd.comp))continue;const r=remapRef(sd.ref,old,nw);if(r){sd.ref=r;n++}}
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
  asmChanged();if(a.comps.length<=2)fitCamera(null);
  toast(`${compName(a,c)} eklendi${c.fixed?' ve sabitlendi':''}.`);
}
function delComp(id){const a=curAsm();const c=compById(id);if(!c)return;pushAsmHist();const nm=compName(a,c);a.comps=a.comps.filter(x=>x!==c);a.mates=a.mates.filter(m=>m.a.comp!==id&&m.b.comp!==id);if(a.explode&&a.explode.steps){for(const st of a.explode.steps)st.comps=st.comps.filter(x=>x!==id);a.explode.steps=a.explode.steps.filter(st=>st.comps.length)}if(asmUI.sel===id)asmUI.sel=null;asmChanged();toast(`${nm} ve eşleştirmeleri silindi.`,{label:'Geri al',fn:asmUndo})}

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
    h+=`<div class="ti ${asmUI.sel===c.id?'sel':''} ${c.hidden?'sup':''}" data-comp="${c.id}" title="${c.fixed?'Sabit':st==='-'?'Tam konumlanmamış':'Tam konumlanmış'}"><span class="ic">${IC.part}</span><span class="nm">${pre}${esc(compName(a,c))}</span><span class="acts">`+
      `<button data-ca="open" title="Parçayı düzenle">${IC.edit}</button><button data-ca="fix" title="${c.fixed?'Serbest bırak':'Sabitle'}">${c.fixed?IC.unfix:IC.fix}</button><button data-ca="hide" title="${c.hidden?'Göster':'Gizle'}">${IC.eye}</button><button data-ca="del" title="Montajdan çıkar">${IC.trash}</button></span></div>`;
  }
  h+=`<div class="tree-sec">Eşleştirmeler (${a.mates.length})</div>`;
  if(!a.mates.length)h+=`<div class="tree-empty">Şeritten “Eşleştir” ile iki bileşenin yüzeylerini veya eksenlerini seç.</div>`;
  for(const m of a.mates){
    const ca=compById(m.a.comp),cb=compById(m.b.comp);const bad=!mateRefOk(m.a)||!mateRefOk(m.b);
    const sel=asmUI.pm&&asmUI.pm.editId===m.id;
    h+=`<div class="ti child ${sel?'sel':''} ${m.suppressed?'sup':''} ${bad?'err':''}" data-mate="${m.id}" title="${bad?'Referans yüzey/eksen parçada bulunamadı':''}"><span class="ic" style="justify-content:center;font-weight:600">${MATE_G[m.type]||'?'}</span><span class="nm">${esc(m.name||MATE_T[m.type])} <span style="color:var(--muted)">(${esc(ca?compName(a,ca):'?')}, ${esc(cb?compName(a,cb):'?')})</span></span><span class="acts"><button data-ma="edit" title="Düzenle">${IC.edit}</button><button data-ma="sup" title="${m.suppressed?'Bastırmayı kaldır':'Bastır'}">${m.suppressed?IC.play:IC.pause}</button><button data-ma="del" title="Sil">${IC.trash}</button></span></div>`;
  }
  if(a._unsolved)h+=`<div class="tree-err" style="margin-left:12px">Eşleştirmeler aynı anda sağlanamıyor. Son eklenen eşleştirmeyi kontrol et.</div>`;
  h+=`<div class="tree-sec">Proje parçaları</div>`+project.parts.map(p=>`<div class="ti" data-addpart="${p.id}" title="Montaja ekle"><span class="ic">${IC.part}</span><span class="nm">${esc(p.partName)}</span><span class="acts" style="display:flex"><button data-addp="${p.id}" title="Montaja ekle">${IC.asmInsert}</button></span></div>`).join('');
  $('#tree').innerHTML=h;
}
function asmTreeClick(e){
  const aa=e.target.closest('[data-aa]');
  if(aa){if(aa.dataset.aa==='new')newAsm();else{const a=curAsm();if(!a)return;const i=project.asms.indexOf(a);project.asms.splice(i,1);project.cur.asm=project.asms[0]?project.asms[0].id:null;asmUI.sel=null;closeAsmPM(true,true);asmChanged();toast(`“${a.name}” silindi.`,{label:'Geri al',fn:()=>{project.asms.splice(i,0,a);project.cur.asm=a.id;asmChanged()}})}return}
  const ap=e.target.closest('[data-addp]');if(ap){if(!curAsm()){newAsm()}addComp(ap.dataset.addp);return}
  const ct=e.target.closest('[data-comp]');
  if(ct){const id=ct.dataset.comp;const b=e.target.closest('[data-ca]');const c=compById(id);if(!c)return;
    if(!b){asmUI.sel=asmUI.sel===id?null:id;asmHighlight();renderAsmTree();return}
    const k=b.dataset.ca;
    if(k==='open'){switchPart(c.part);setTab('model');return}
    if(k==='del'){delComp(id);return}
    pushAsmHist();if(k==='fix')c.fixed=!c.fixed;if(k==='hide')c.hidden=!c.hidden;asmChanged();return}
  const mt=e.target.closest('[data-mate]');
  if(mt){const a=curAsm();const m=a.mates.find(x=>x.id===mt.dataset.mate);if(!m)return;const b=e.target.closest('[data-ma]');const k=b?b.dataset.ma:'edit';
    if(k==='edit'){openMatePM(m);return}
    pushAsmHist();if(k==='sup')m.suppressed=!m.suppressed;if(k==='del')a.mates=a.mates.filter(x=>x!==m);asmChanged();return}
}
function asmTreeDbl(e){const ct=e.target.closest('[data-comp]');if(ct&&!e.target.closest('[data-ca]')){const c=compById(ct.dataset.comp);if(c){switchPart(c.part);setTab('model')}}}
function asmTreeChange(e){
  if(e.target.id==='asmSel'){project.cur.asm=e.target.value;asmUI.sel=null;closeAsmPM(true,true);asmChanged();fitCamera(VIEWDIRS.iso,false);return}
  if(e.target.id==='asmNameIn'){const a=curAsm();if(a){a.name=e.target.value.trim()||'Montaj';saveState();renderAsmTree()}}
}

/* ---------- şerit ---------- */
function renderAsmRibbon(){
  const t=asmUI.tool;
  $('#ribbon').innerHTML=rb('ainsert','asmInsert','Bileşen Ekle')+rb('amate','mate','Eşleştir',asmUI.pm&&asmUI.pm.type==='mate'?'on':'')+'<div class="rsep"></div>'+
    rb('amove','move','Bileşeni Taşı',t==='move'?'on':'')+rb('arotate','rotate','Bileşeni Döndür',t==='rotate'?'on':'')+'<div class="rsep"></div>'+
    rb('ameasure','measure','Ölç',meas?'on':'')+'<div class="rsep"></div>'+rb('aexplode','explode','Patlatılmış Görünüm',asmUI.pm&&asmUI.pm.type==='explode'?'on':'')+rb('atoggle','explode',asmUI.exf>0.5?'Topla':'Patlat',asmUI.exf>0.5?'on':'')+rb('ainterf','interf','Girişim Algıla',asmUI.pm&&asmUI.pm.type==='interf'?'on':'')+'<div class="rsep"></div>'+
    rb('adraw','asmDraw','Montaj Resmi')+rb('astl','stl','Montajı STL olarak al');
  fitRibbon($('#ribbon'));
}
function asmCmd(c){
  if(c==='ainsert'){if(!curAsm())newAsm();else openInsertPM();return}
  if(c==='amate'){collapseIfExploded();openMatePM(null);return}
  if(c==='amove'||c==='arotate'){const t=c==='amove'?'move':'rotate';closeAsmPM(true);collapseIfExploded();asmUI.tool=asmUI.tool===t?null:t;setControlsForSketch(!!asmUI.tool);renderAsmRibbon();
    prompt_(asmUI.tool?(t==='move'?'Taşımak için bileşeni sürükle. Eşleştirmeler hareketi sınırlar. Bitirmek için Esc.':'Döndürmek için bileşeni sürükle. Bitirmek için Esc.'):null);return}
  if(c==='astl'){exportAsmSTL();return}
  if(c==='aexplode'){openExplodePM();return}
  if(c==='ameasure'){if(meas)closeMeasure();else openMeasure();return}
  if(c==='atoggle'){const a=curAsm();if(!a||!a.comps.length)return;setExplode(asmUI.exf<0.5);return}
  if(c==='ainterf'){openInterfPM();return}
  if(c==='adraw'){openAsmDrawing();return}
}

/* ---------- PropertyManager ---------- */
function openInsertPM(){if(!curAsm())return;closeAsmPM(true);asmUI.pm={type:'insert'};renderAsmPM()}
function openMatePM(existing){
  const a=curAsm();if(!a||a.comps.length<2){toast('Eşleştirme için montajda en az iki bileşen olmalı.');return}
  closeAsmPM(true);asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  asmUI.pm={type:'mate',draft:existing?clone(existing):{id:uid('m'),type:null,a:null,b:null,flip:false,val:10},isNew:!existing,editId:existing?existing.id:null,orig:a.comps.map(c=>({id:c.id,T:c.T.slice()})),err:''};
  const h0=asmHistFor();asmUI.pm.redo0=h0?h0.redo.slice():null;
  pushAsmHist();renderAsmRibbon();renderAsmPM();asmHighlight();renderAsmTree();
  if(existing)previewMate();
}
function restoreOrig(){const P=asmUI.pm,a=curAsm();if(!P||!P.orig||!a)return;for(const o of P.orig){const c=a.comps.find(x=>x.id===o.id);if(c)c.T=o.T.slice()}}
function closeAsmPM(silent,dropHist){
  const P=asmUI.pm;if(!P)return;
  if(P.type==='mate'){restoreOrig();const h=asmHistFor();if(h&&h.undo.length&&!P.committed){h.undo.pop();if(P.redo0)h.redo=P.redo0}updateAsmPoses()}
  if(P.type==='interf')setGhost(false);
  asmUI.pm=null;asmHighlight();if(!silent){renderAsmPM();renderAsmTree();renderAsmRibbon()}
}
function mateTypesFor(a,b){const pa=a.ref.t==='plane',pb=b.ref.t==='plane';if(pa&&pb)return ['coincident','parallel','perpendicular','distance','angle'];if(!pa&&!pb)return ['concentric','parallel','perpendicular'];return ['coincident','parallel','perpendicular']}
function curWorld(s){const c=compById(s.comp);return wref(s.ref,new T.Matrix4().fromArray(c.T))}
function setMateType(t){
  const P=asmUI.pm,d=P.draft;d.type=t;const A=curWorld(d.a),B=curWorld(d.b);
  if(t==='coincident'&&A.t==='plane'&&B.t==='plane')d.flip=A.n.dot(B.n)>0.3;
  if(t==='distance'){const dist=B.p.clone().sub(A.p).dot(A.n);d.flip=dist<0;d.val=Math.abs(dist)>1e-3?Math.round(Math.abs(dist)*100)/100:10}
  if(t==='angle'){const ang=Math.acos(Math.max(-1,Math.min(1,A.n.dot(B.n))))*180/Math.PI;d.val=Math.round(ang)||90}
  previewMate();
}
function previewMate(){
  clearTimeout(asmPmInput.t);asmPmInput.t=0;const P=asmUI.pm,a=curAsm();if(!P||P.type!=='mate'||!a)return;restoreOrig();
  if(P.draft.a&&P.draft.b&&P.draft.type){
    const saved=a.mates;a.mates=saved.filter(m=>m.id!==P.editId);
    const ok=solveAsm(a,{extra:[P.draft]});a.mates=saved;
    P.err=ok?'':'Bu eşleştirme mevcut eşleştirmelerle birlikte sağlanamıyor. Hizalamayı ters çevirmeyi veya başka bir tür seçmeyi dene.';
    if(!ok)restoreOrig();
  }else P.err='';
  updateAsmPoses();asmHighlight();renderAsmPM();
}
function commitMate(){
  const P=asmUI.pm,a=curAsm(),d=P.draft;
  if(!d.a||!d.b||!d.type){toast('İki seçim yap ve bir eşleştirme türü seç.');return}
  // yazılıp henüz önizlenmemiş değer (ör. mesafe yazılıp hemen Enter) önce çözülür
  if(asmPmInput.t)previewMate();
  if(P.err){toast('Bu eşleştirme çözülemiyor.');return}
  // türü değişen otomatik adlı eşleştirme yeni türün adını alır (Çakışık1 → Mesafe1)
  const old=!P.isNew&&a.mates.find(m=>m.id===P.editId);if(old&&old.type!==d.type&&new RegExp('^'+MATE_T[old.type]+'\\d+$').test(d.name||''))d.name='';
  if(!d.name||P.isNew){let n=1;while(a.mates.some(m=>m.name===MATE_T[d.type]+n&&m.id!==d.id))n++;d.name=MATE_T[d.type]+n}
  if(P.isNew)a.mates.push(d);else{const i=a.mates.findIndex(m=>m.id===P.editId);if(i>=0)a.mates[i]=d}
  P.committed=true;asmUI.pm=null;asmChanged(false);renderAsmRibbon();
}
function selLabel(s){const a=curAsm(),c=compById(s.comp);return `${c?compName(a,c):'?'}: ${s.ref.t==='plane'?'düz yüzey':'silindir ekseni'+(s.ref.r?` (Ø${fmt(s.ref.r*2)})`:'')}`}
function renderAsmPM(){
  const ws=$('#ws'),el=$('#pm');const P=asmUI.pm;
  if(meas){renderMeasurePM();return}
  if(!P){ws.classList.remove('pmon');el.innerHTML='';requestAnimationFrame(resize);return}
  ws.classList.add('pmon');requestAnimationFrame(resize);
  let title='',b='';
  if(P.type==='explode'){title='Patlatılmış Görünüm';b=explodePMBody()}
  else if(P.type==='interf'){title='Girişim Algılama';b=interfPMBody()}
  else if(P.type==='insert'){
    title='Bileşen Ekle';
    b=grp('Proje parçaları',`<div class="lst">${project.parts.map(p=>{const d=partData(p);return `<div><span>${esc(p.partName)}${d.polys.length?'':' (gövde yok)'}</span><button class="sbtn" data-addp="${p.id}" style="width:auto;height:auto">Ekle</button></div>`}).join('')}</div><p class="note">İlk eklenen bileşen sabitlenir (f). Aynı parçayı birden çok kez ekleyebilirsin (örneğin 4 cıvata). Yeni parça çizmek için Parça sekmesine geç.</p>`);
  }else{
    const d=P.draft;title=P.isNew?'Eşleştir':'Eşleştirmeyi düzenle';
    let s=`<div class="lst">`;
    s+=d.a?`<div><span>1. ${esc(selLabel(d.a))}</span><button data-mclr="a" aria-label="Seçimi kaldır">✕</button></div>`:`<div><span style="color:var(--muted)">1. Bir bileşende yüzey veya silindir seç</span></div>`;
    s+=d.b?`<div><span>2. ${esc(selLabel(d.b))}</span><button data-mclr="b" aria-label="Seçimi kaldır">✕</button></div>`:`<div><span style="color:var(--muted)">2. Başka bir bileşende yüzey veya silindir seç</span></div>`;
    s+=`</div><p class="note">Düz yüzeye tıklarsan düzlem, delik veya mil yüzeyine tıklarsan ekseni seçilir.</p>`;
    b=grp('Eşleştirme seçimleri',s);
    if(d.a&&d.b){
      const types=mateTypesFor(d.a,d.b);
      let t=`<div class="relbtns">${types.map(k=>`<button data-mtype="${k}" style="${d.type===k?'border-color:var(--accent);background:var(--accent-soft)':''}"><b>${MATE_G[k]}</b>${MATE_T[k]}</button>`).join('')}</div>`;
      if(d.type==='distance')t+=fNum('Mesafe','val','mm',d);
      if(d.type==='angle')t+=fNum('Açı','val','°',d);
      if(d.type==='coincident'||d.type==='distance')t+=`<button type="button" class="sbtn" data-mflip="1">⇅ Hizalamayı ters çevir</button>`;
      b+=grp('Standart eşleştirmeler',t);
    }
    if(P.err)b+=`<div class="pm-err on">${esc(P.err)}</div>`;
  }
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">${title}</div><div class="pm-sub">${esc((curAsm()||{}).name||'')}</div></div><div class="pm-actions">${P.type==='mate'||P.type==='explode'?`<button class="ok" data-apm="ok" title="Tamam" aria-label="Tamam">${IC.ok}</button>`:''}<button data-apm="cancel" title="${P.type==='mate'?'İptal':'Kapat'}" aria-label="Kapat">${IC.x}</button></div></div><div class="pm-body">${b}</div>`;
}
function asmPmClick(e){
  if(meas&&measurePmClick(e))return;
  const P=asmUI.pm;if(!P)return;
  const a=e.target.closest('[data-apm]');if(a){if(a.dataset.apm==='ok'&&P.type==='mate')commitMate();else closeAsmPM();return}
  if(P.type==='explode'&&explodePmClick(e))return;
  if(P.type==='interf'&&interfPmClick(e))return;
  const ap=e.target.closest('[data-addp]');if(ap){addComp(ap.dataset.addp);return}
  const t=e.target.closest('[data-mtype]');if(t){setMateType(t.dataset.mtype);return}
  if(e.target.closest('[data-mflip]')){P.draft.flip=!P.draft.flip;previewMate();return}
  const c=e.target.closest('[data-mclr]');if(c){P.draft[c.dataset.mclr]=null;P.draft.type=null;previewMate();return}
}
function asmPmInput(e){const P=asmUI.pm;if(P&&P.type==='explode'){const t=e.target;if(t.dataset.k==='dist'){const v=num(t.value);if(isFinite(v))P.draft.dist=v}return}if(!P||P.type!=='mate')return;const t=e.target;if(t.dataset.num){const v=num(t.value);if(isFinite(v)&&v>=0){P.draft.val=v;clearTimeout(asmPmInput.t);asmPmInput.t=setTimeout(previewMate,250)}}}
function asmPmChange(e){const P=asmUI.pm;if(!P)return;if(P.type==='explode')explodePmChange(e);if(P.type==='interf')interfPmChange(e)}

/* ---------- işaretçi ---------- */
function asmDown(e){
  asmUI.down={x:e.clientX,y:e.clientY,b:e.button};
  if(!asmUI.tool||e.button!==0)return;
  const h=asmPick(e);if(!h)return;const c=compById(h.comp);if(!c)return;
  if(c.fixed){toast('Sabit (f) bileşen taşınamaz. Ağaçtan serbest bırakabilirsin.');return}
  const h0=asmHistFor(),redo0=h0?h0.redo.slice():null;pushAsmHist();
  const dir=new T.Vector3();camera.getWorldDirection(dir);
  asmUI.drag={redo0,c,T0:new T.Matrix4().fromArray(c.T),last:c.T.slice(),p0:h.point.clone(),x:e.clientX,y:e.clientY,plane:new T.Plane().setFromNormalAndCoplanarPoint(dir,h.point),center:compCenter(c),moved:false,pend:null};
}
function asmMove(e){
  const d=asmUI.drag;
  if(!d){
    if(e.pointerType==='mouse'&&asmUI.pm&&asmUI.pm.type==='mate'){const h=asmPick(e);renderer.domElement.style.cursor=h?'pointer':''}
    return;
  }
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>3)d.moved=true;if(!d.moved)return;
  d.pend={x:e.clientX,y:e.clientY};
  if(d.raf)return;
  d.raf=requestAnimationFrame(()=>{d.raf=0;applyDrag(d)});
}
function applyDrag(d){
  const q=d.pend;if(!q)return;d.pend=null;const a=curAsm();let M;
  if(asmUI.tool==='move'){
    ray.setFromCamera(ndc({clientX:q.x,clientY:q.y}),camera);const p=new T.Vector3();if(!ray.ray.intersectPlane(d.plane,p))return;
    const dv=p.sub(d.p0);M=new T.Matrix4().makeTranslation(dv.x,dv.y,dv.z).multiply(d.T0);
  }else{
    const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const c0=d.center;const R=new T.Matrix4().makeRotationAxis(up,(q.x-d.x)*0.01).multiply(new T.Matrix4().makeRotationAxis(right,(q.y-d.y)*0.01));
    M=new T.Matrix4().makeTranslation(c0.x,c0.y,c0.z).multiply(R).multiply(new T.Matrix4().makeTranslation(-c0.x,-c0.y,-c0.z)).multiply(d.T0);
  }
  d.c.T=M.toArray();
  if(a.mates.some(m=>!m.suppressed&&(m.a.comp===d.c.id||m.b.comp===d.c.id))){if(!solveAsm(a))d.c.T=d.last.slice()}
  d.last=d.c.T.slice();updateAsmPoses();
}
function asmUp(e){
  const dn=asmUI.down;asmUI.down=null;const d=asmUI.drag;
  if(d){asmUI.drag=null;if(d.raf){cancelAnimationFrame(d.raf);d.raf=0}if(d.moved){applyDrag(d);asmChanged(false)}else{const h=asmHistFor();if(h){h.undo.pop();if(d.redo0)h.redo=d.redo0}updUndo();selectCompAt(e)}return}
  if(!dn||dn.b!==0||Math.hypot(e.clientX-dn.x,e.clientY-dn.y)>5)return;
  if(meas){measureClick(e);return}
  const P=asmUI.pm;
  if(P&&P.type==='explode'){const h=asmPick(e);if(!h)return;const l=P.draft.comps;const i=l.indexOf(h.comp);if(i>=0)l.splice(i,1);else l.push(h.comp);renderAsmPM();asmHighlight();return}
  if(P&&P.type==='interf')return;
  if(P&&P.type==='mate'){
    const h=asmPick(e);if(!h||!h.ref)return;const s={comp:h.comp,ref:h.ref};const d2=P.draft;
    if(!d2.a){d2.a=s}
    else if(!d2.b||d2.b){if(h.comp===d2.a.comp){d2.a=s;d2.b=null;d2.type=null}else d2.b=s}
    if(d2.a&&d2.b){const types=mateTypesFor(d2.a,d2.b);if(!types.includes(d2.type)){setMateType(types[0]);return}previewMate();return}
    asmHighlight();renderAsmPM();return;
  }
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
  const buf=new ArrayBuffer(84+n*50),dv=new DataView(buf);const hdr=('Tezgah CAD '+(name||'')).slice(0,79);for(let i=0;i<hdr.length;i++)dv.setUint8(i,hdr.charCodeAt(i)&127);dv.setUint32(80,n,true);
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
