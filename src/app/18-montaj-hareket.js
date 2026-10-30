/* Montajda seçim (yüzey, silindir, kenar; üzerine gelince vurgu), bileşeni sürükleyerek taşıma/döndürme ve Bileşeni Taşı paneli (SolidWorks: serbest sürükle, XYZ boyunca, ΔXYZ, XYZ konumuna). */
const matHovEdge=new T.LineBasicMaterial({color:0xE39A2D,depthTest:false,transparent:true});

/* ---------- açıklaması olmayan silindirler: yüzey parçalarından eksen bulma ---------- */
/* köşeleri ortak çokgen komşuları (CSG sonrası T birleşimlerinde de çalışsın diye kenar yerine köşe) */
function polyNb(d){
  if(d.nb)return d.nb;const key=v=>Math.round(v.x*1e3)+','+Math.round(v.y*1e3)+','+Math.round(v.z*1e3);const m=new Map();
  d.polys.forEach((q,i)=>{for(const v of q.verts){const k=key(v);let l=m.get(k);if(!l)m.set(k,l=[]);l.push(i)}});
  d.nb=i=>{const s=new Set();for(const v of d.polys[i].verts)for(const j of m.get(key(v))||[])if(j!==i)s.add(j);return s};return d.nb;
}
/* düzlemde 2B çember uydurma (Kåsa): x²+y²+Dx+Ey+F=0 */
function fitCircle2(P){
  let sxx=0,sxy=0,syy=0,sx=0,sy=0,n=P.length,sxz=0,syz=0,sz=0;
  for(const [x,y] of P){const z=x*x+y*y;sxx+=x*x;sxy+=x*y;syy+=y*y;sx+=x;sy+=y;sxz+=x*z;syz+=y*z;sz+=z}
  const s=linSolve([[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]],[-sxz,-syz,-sz]);if(!s)return null;
  const cx=-s[0]/2,cy=-s[1]/2,r2=cx*cx+cy*cy-s[2];return r2>0?{cx,cy,r:Math.sqrt(r2)}:null;
}
/* tıklanan çokgen eğri bir yüzeyin (yay ekstrüzyonu, radyus, STL) parçasıysa: komşu parçalarla eksen, merkez ve yarıçap */
function fitCyl(d,i0){
  if(!d.cyl)d.cyl=new Map();if(d.cyl.has(i0))return d.cyl.get(i0);
  const P=d.polys,nb=polyNb(d),q0=P[i0];let res=null;
  const basis=A=>{const u=perpUnit(A);return [u,A.clone().cross(u)]};
  const ctr=q=>{let x=0,y=0,z=0;for(const v of q.verts){x+=v.x;y+=v.y;z+=v.z}const k=q.verts.length;return new T.Vector3(x/k,y/k,z/k)};
  for(const j of nb(i0)){
    const n0=q0.plane.n,n1=P[j].plane.n,c=n0.dot(n1);if(!(c<0.99995&&c>0.75))continue;
    const x=n0.cross(n1),A=new T.Vector3(x.x,x.y,x.z).normalize();const [u,w]=basis(A);
    // iki parçanın normal doğruları eksende kesişir (eksene dik düzlemde)
    const p0=ctr(q0),p1=ctr(P[j]),to2=p=>[p.dot(u),p.dot(w)],a=to2(p0),b=to2(p1),da=[n0.x*u.x+n0.y*u.y+n0.z*u.z,n0.x*w.x+n0.y*w.y+n0.z*w.z],db=[n1.x*u.x+n1.y*u.y+n1.z*u.z,n1.x*w.x+n1.y*w.y+n1.z*w.z];
    const det=da[0]*-db[1]-da[1]*-db[0];if(Math.abs(det)<1e-12)continue;
    const s=((b[0]-a[0])*-db[1]-(b[1]-a[1])*-db[0])/det;const cc=[a[0]+da[0]*s,a[1]+da[1]*s];
    const rr=v=>Math.hypot(v.x*u.x+v.y*u.y+v.z*u.z-cc[0],v.x*w.x+v.y*w.y+v.z*w.z-cc[1]);
    const r0=q0.verts.reduce((t,v)=>t+rr(v),0)/q0.verts.length,tol=Math.max(0.03,r0*0.03);
    if(!(r0>1e-3)||q0.verts.some(v=>Math.abs(rr(v)-r0)>tol)||P[j].verts.some(v=>Math.abs(rr(v)-r0)>tol))continue;
    // yüzey boyunca büyüt: normali eksene dik, köşeleri aynı çemberde olan komşular
    const seen=new Set([i0,j]),st=[i0,j];
    while(st.length&&seen.size<4000){const i=st.pop();for(const k of nb(i)){if(seen.has(k))continue;const q=P[k],n=q.plane.n;
      if(Math.abs(n.x*A.x+n.y*A.y+n.z*A.z)>0.02||q.verts.some(v=>Math.abs(rr(v)-r0)>tol))continue;seen.add(k);st.push(k)}}
    const pts=[];let t0=Infinity,t1=-Infinity;for(const k of seen)for(const v of P[k].verts){pts.push([v.x*u.x+v.y*u.y+v.z*u.z,v.x*w.x+v.y*w.y+v.z*w.z]);const t=v.x*A.x+v.y*A.y+v.z*A.z;t0=Math.min(t0,t);t1=Math.max(t1,t)}
    const f=fitCircle2(pts);if(!f||pts.some(([x,y])=>Math.abs(Math.hypot(x-f.cx,y-f.cy)-f.r)>tol))continue;
    const C=u.clone().multiplyScalar(f.cx).add(w.clone().multiplyScalar(f.cy)),q6=x=>Math.round(x*1e6)/1e6;
    res={t:'axis',p:[q6(C.x),q6(C.y),q6(C.z)],d:[q6(A.x),q6(A.y),q6(A.z)],r:q6(f.r),t0:q6(t0),t1:q6(t1)};break;
  }
  d.cyl.set(i0,res);return res;
}

/* ---------- kenar seçimi ---------- */
const kKey=p=>Math.round(p[0]*1e3)+','+Math.round(p[1]*1e3)+','+Math.round(p[2]*1e3);
/* tıklanan kenar parçasından: dairesel kenar (merkez, eksen, yarıçap) veya doğrusal kenar (doğru) */
function edgeRef(d,i){
  const S=d.segs;if(!d.segMap){d.segMap=new Map();S.forEach((s,k)=>{for(const p of [s.a,s.b]){const q=kKey(p);let l=d.segMap.get(q);if(!l)d.segMap.set(q,l=[]);l.push(k)}})}
  const dir=s=>vn(vs(s.b,s.a)),q6=x=>Math.round(x*1e6)/1e6;
  const walk=ok=>{const out=[i],seen=new Set([i]);
    for(const end of ['a','b']){let cur=i,pt=S[i][end];for(let n=0;n<600;n++){let nx=null;for(const j of d.segMap.get(kKey(pt))||[]){if(seen.has(j))continue;if(ok(dir(S[cur]),dir(S[j]),S[j])){nx=j;break}}
      if(nx===null)break;seen.add(nx);out.push(nx);const s=S[nx];pt=kKey(s.a)===kKey(pt)?s.b:s.a;cur=nx}}return out};
  const s0=S[i],u0=dir(s0);
  // yayın komşu parçası biraz döner (35°'den az); aynı doğrudaki parçalar doğrusal kenardır
  const arc=walk((u,v)=>{const c=Math.abs(vd(u,v));return c>0.82&&c<0.99999});
  if(arc.length>=2){
    let A=null;for(const j of arc){const x=vc(u0,dir(S[j]));if(vl(x)>1e-4){A=new T.Vector3(...vn(x));break}}
    if(A){const u=perpUnit(A),w2=A.clone().cross(u);const pts=[],h0=A.dot(new T.Vector3(...s0.a));let flat=true;
      for(const j of arc)for(const p of [S[j].a,S[j].b]){const v=new T.Vector3(...p);if(Math.abs(v.dot(A)-h0)>0.02)flat=false;pts.push([v.dot(u),v.dot(w2)])}
      const f=flat&&fitCircle2(pts);
      if(f&&pts.every(([x,y])=>Math.abs(Math.hypot(x-f.cx,y-f.cy)-f.r)<Math.max(0.02,f.r*0.02))){
        let C=u.clone().multiplyScalar(f.cx).add(w2.clone().multiplyScalar(f.cy)).addScaledVector(A,h0),r=f.r;
        // parçanın silindir açıklamasıyla örtüşüyorsa onun tam ekseni ve yarıçapı (çokgen köşelerinden uydurma yaklaşıktır)
        const tol=Math.max(0.05,r*0.02);for(const an of d.ann||[]){if(Math.abs(an.A.dot(A))<1-1e-4||Math.abs(an.r-r)>tol)continue;const w=C.clone().sub(an.C);const t=w.dot(an.A);
          if(w.sub(an.A.clone().multiplyScalar(t)).length()>tol)continue;C=an.C.clone().addScaledVector(an.A,t);A=an.A.clone();r=an.r;break}
        return {t:'axis',e:'circ',p:[q6(C.x),q6(C.y),q6(C.z)],d:[q6(A.x),q6(A.y),q6(A.z)],r:q6(r),t0:0,t1:0}}}
  }
  const line=walk((u,v,s)=>Math.abs(vd(u,v))>0.99999&&vl(vc(u0,vs(s.a,s0.a)))<1e-3*Math.max(1,vl(vs(s.a,s0.a))));
  let lo=Infinity,hi=-Infinity;for(const j of line)for(const p of [S[j].a,S[j].b]){const t=vd(vs(p,s0.a),u0);lo=Math.min(lo,t);hi=Math.max(hi,t)}
  const P0=va(s0.a,vk(u0,lo));return {t:'axis',e:'line',p:P0.map(q6),d:u0.map(q6),t0:0,t1:q6(hi-lo)};
}
/* imlecin yakınındaki kenar (öndeki yüzeyin arkasında kalanlar hariç) */
function pickAsmEdge(e,hit,maxPx){
  const r=renderer.domElement.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;let best=null,bd=maxPx||6;
  const VP=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  for(const [cid,v] of asmView.groups){
    if(!v.g.visible||!v.m.visible||!v.d.segs||!v.d.box)continue;const M=new T.Matrix4().multiplyMatrices(VP,v.g.matrixWorld),m=M.elements;
    const pr=p=>{const x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [((m[0]*x+m[4]*y+m[8]*z+m[12])/w+1)/2*r.width,(1-(m[1]*x+m[5]*y+m[9]*z+m[13])/w)/2*r.height,w]};
    // kutusu imlecin uzağındaysa bileşen atlanır
    const b=v.d.box;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,behind=false;
    for(let k=0;k<8;k++){const q=pr([k&1?b.max[0]:b.min[0],k&2?b.max[1]:b.min[1],k&4?b.max[2]:b.min[2]]);if(q[2]<=0)behind=true;x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])}
    if(!behind&&(mx<x0-bd||mx>x1+bd||my<y0-bd||my>y1+bd))continue;
    const S=v.d.segs;
    for(let i=0;i<S.length;i++){const A=pr(S[i].a),B=pr(S[i].b);if(A[2]<=0||B[2]<=0)continue;
      const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((mx-A[0])*dx+(my-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));
      const dd=Math.hypot(A[0]+dx*t-mx,A[1]+dy*t-my);if(dd>=bd)continue;
      // görünürlük: kenarın bu noktası, ışının çarptığı yüzeyden belirgin biçimde arkada değil
      const s=S[i],P=new T.Vector3(s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t,s.a[2]+(s.b[2]-s.a[2])*t).applyMatrix4(v.g.matrixWorld);
      if(hit){const box=asmView.box,ext=box?Math.max(box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]):100;if(camera.position.distanceTo(P)>hit.distance+Math.max(0.5,ext*0.01))continue}
      bd=dd;best={cid,i,P}}
  }
  if(!best)return null;const v=asmView.groups.get(best.cid);
  return {comp:best.cid,point:best.P,ref:edgeRef(v.d,best.i)};
}
/* ---------- seçim ---------- */
/* opt.edges: kenara yakın tıklama kenarı seçer (eşleştirme paneli) */
function asmPick(e,opt){
  // görünüm yeni kurulduysa (ör. çoğaltma önizlemesi) grupların dünya matrisi ilk çizime kadar eski kalır
  asmRoot.updateMatrixWorld();camera.updateMatrixWorld();ray.setFromCamera(ndc(e),camera);const ms=[...asmView.groups.values()].filter(v=>v.g.visible&&v.m.visible).map(v=>v.m);
  // Alt + tıklama (SolidWorks'teki “Diğerini seç” gibi): öndeki bileşenin arkasında kalan ilk bileşenin yüzeyi
  const hs=ray.intersectObjects(ms);const h=e.altKey&&hs.length?hs.find(x=>x.object.userData.comp!==hs[0].object.userData.comp):hs[0];
  // imleç bir yüzün üzerindeyse kenar ancak çok yakınsa seçilir (SolidWorks gibi): küçük yüzlerin (mil ucu) ortası kenar sayılmasın
  if(opt&&opt.edges&&!e.altKey){const ed=pickAsmEdge(e,h,h?4:6);if(ed)return ed}
  if(!h)return null;
  const cid=h.object.userData.comp,v=asmView.groups.get(cid);const pi=v.d.tp[h.faceIndex],poly=v.d.polys[pi];if(!poly)return {comp:cid,point:h.point};
  const lp=h.point.clone().applyMatrix4(new T.Matrix4().copy(v.g.matrix).invert());const n=poly.plane.n;
  // birden çok açıklama uyarsa (döndürmenin tüm boyu kaplayan dış zarfı ve asıl silindir) en kısa boylu olan: seçilen yüzeyin kendisi
  let best=null;
  for(const an of v.d.ann){
    const w=lp.clone().sub(an.C),t=w.dot(an.A);const perp=w.sub(an.A.clone().multiplyScalar(t)).length();
    if(Math.abs(perp-an.r)<Math.max(0.1,an.r*0.04)&&t>=an.t0-0.2&&t<=an.t1+0.2&&Math.abs(n.x*an.A.x+n.y*an.A.y+n.z*an.A.z)<0.25&&(!best||an.t1-an.t0<best.t1-best.t0))best=an;
  }
  if(best){const an=best;return {comp:cid,point:h.point,ref:{t:'axis',p:[an.C.x,an.C.y,an.C.z],d:[an.A.x,an.A.y,an.A.z],r:an.r,t0:an.t0,t1:an.t1}}}
  const cy=fitCyl(v.d,pi);if(cy)return {comp:cid,point:h.point,ref:cy};
  return {comp:cid,point:h.point,ref:{t:'plane',n:[n.x,n.y,n.z],p:[n.x*poly.plane.w,n.y*poly.plane.w,n.z*poly.plane.w]}};
}
/* seçimin 3B gösterimi: düz yüzey, silindir yüzeyi + ekseni, dairesel kenar, doğrusal kenar */
function refObjs(v,r,mat,lmat){
  const out=[],add=o=>{o.userData.own=true;out.push(o)};
  if(r.t==='plane'){const w=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];const o=new T.Mesh(polysToBuffers(v.d.polys,coplanarFilter(r.n,w)).g,mat);o.renderOrder=3;add(o);return out}
  const A=new T.Vector3(...r.d),C=new T.Vector3(...r.p);
  if(r.e==='line'){const l=new T.Line(new T.BufferGeometry().setFromPoints([C.clone().addScaledVector(A,r.t0),C.clone().addScaledVector(A,r.t1)]),lmat);l.renderOrder=6;add(l);return out}
  if(r.e==='circ'){const u=perpUnit(A),w=A.clone().cross(u),pts=[];for(let k=0;k<=64;k++){const t=k/64*Math.PI*2;pts.push(C.clone().addScaledVector(u,Math.cos(t)*r.r).addScaledVector(w,Math.sin(t)*r.r))}
    const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),lmat);l.renderOrder=6;add(l);
    const ax=new T.Line(new T.BufferGeometry().setFromPoints([C.clone().addScaledVector(A,-r.r-8),C.clone().addScaledVector(A,r.r+8)]),lmat);ax.renderOrder=6;add(ax);return out}
  if(r.t0!==undefined)add(new T.Mesh(polysToBuffers(v.d.polys,cylFilter(r)).g,mat));
  const t0=(r.t0!==undefined?r.t0:-20)-8,t1=(r.t1!==undefined?r.t1:20)+8;
  const l=new T.Line(new T.BufferGeometry().setFromPoints([C.clone().addScaledVector(A,t0),C.clone().addScaledVector(A,t1)]),lmat);l.renderOrder=6;add(l);return out;
}
/* eşleştirme panelinde imlecin altındaki yüzey/kenar turuncu vurgulanır (tıklayınca seçilecek olan) */
function asmHover(h){
  const key=h&&h.ref?h.comp+JSON.stringify(h.ref):'';if(key===asmUI.hovKey)return;asmUI.hovKey=key;
  for(const v of asmView.groups.values())for(const ch of [...v.g.children])if(ch.userData.hov){v.g.remove(ch);if(ch.geometry)ch.geometry.dispose()}
  if(key){const v=asmView.groups.get(h.comp);if(v)for(const o of refObjs(v,h.ref,matHov,matHovEdge)){o.userData.hov=true;v.g.add(o)}}
  requestRender();
}

/* ---------- sürükleyerek taşıma / döndürme ---------- */
/* bileşenin eşleştirmelerle (sabit olmayan bileşenler üzerinden) bağlı olduğu grup */
function mateGroup(a,id){
  const g=new Set([id]),st=[id],cs=new Map(a.comps.map(c=>[c.id,c]));const ms=a.mates.filter(m=>!m.suppressed);
  while(st.length){const x=st.pop();for(const m of ms){const ids=mSides(m).map(s=>s.comp);if(!ids.includes(x))continue;
    for(const y of ids){const c=cs.get(y);if(g.has(y)||!c||c.fixed||c.pat)continue;g.add(y);st.push(y)}}}
  return g;
}
const hasMates=(a,id)=>a.mates.some(m=>!m.suppressed&&mSides(m).some(s=>s.comp===id));
/* sürüklenen bileşen için yumuşak hedef (soft: P → artıklar) eşleştirmelere uyan en yakın konuma izdüşürülür; grubun diğer
   bileşenleri gerekmedikçe yerinde kalır. Önce hedef + eşleştirmeler birlikte, sonra yalnızca eşleştirmeler çözülür */
function dragSolve(a,c,soft){
  const grp=mateGroup(a,c.id);const S=asmSystem(a,null,grp);if(!S.n)return false;
  const maxAbs=r=>(r.r||[]).reduce((m,v)=>Math.max(m,Math.abs(v)),0);
  const q=lm(x=>S.res(x,P=>soft(P[c.id]).concat(S.drift(P,2e-3))),new Array(S.n).fill(0),30,1e-6);
  const r=lm(x=>S.res(x),q.x,40);if(maxAbs(r)>1e-3)return false;
  const P=S.poses(r.x);for(const id of grp){const x=a.comps.find(k=>k.id===id);if(x)x.T=P[id].toArray()}mateTrack(S.ms,P);applyPats(a);return true;
}
/* tam konum hedefi (Δ ile taşıma/döndürme, döndürerek sürükleme): bileşenin merkezi ve iki yönü hedefteki yerlerine.
   Yönler ayrı artık olduğundan eşleştirmenin izin vermediği eğilme, bileşeni serbest yönlerde kaydırmaz */
function poseSoft(c,Mt,w){const ctr=compCenter(c).applyMatrix4(new T.Matrix4().fromArray(c.T).invert()),E=[new T.Vector3(1,0,0),new T.Vector3(0,1,0)];
  const G=ctr.clone().applyMatrix4(Mt),GE=E.map(u=>u.clone().transformDirection(Mt));
  return M=>{const q=ctr.clone().applyMatrix4(M).sub(G),o=[q.x*w,q.y*w,q.z*w];E.forEach((u,i)=>{const v=u.clone().transformDirection(M).sub(GE[i]);o.push(v.x*ML*w,v.y*ML*w,v.z*ML*w)});return o}}
/* bileşeni hedef konuma götürür (eşleştirmeler izin verdiği kadar); hareket etmediyse false */
function moveCompTo(a,c,Mt){
  const T0=c.T.slice();
  if(!hasMates(a,c.id)){c.T=Mt.toArray();applyPats(a)}
  else if(!dragSolve(a,c,poseSoft(c,Mt,0.1))){c.T=T0;return false}
  return c.T.some((v,i)=>Math.abs(v-T0[i])>1e-6);
}
/* sürükleme başlangıcı (yakalama evresinde, OrbitControls'tan önce): hareketli bileşenin üzerinde sol tuş taşır, sağ tuş döndürür */
function asmGrab(e){
  asmUI.grab=null;if(activeTab!=='asm'||!curAsm()||meas||!(e.button===0||e.button===2))return;
  const P=asmUI.pm;if(P&&!['mate','move'].includes(P.type))return;
  const h=asmPick(e);if(!h)return;const c=compById(h.comp);if(!c||c.fixed||c.pat)return;
  // Bileşeni Döndür panelinde tuşlar yer değiştirir: sol tuş döndürür, sağ tuş taşır
  controls.enabled=false;asmUI.grab={h,c,rot:P&&P.type==='move'&&P.rot?e.button===0:e.button===2};
}
function asmDown(e){
  asmUI.down={x:e.clientX,y:e.clientY,b:e.button};
  const g=asmUI.grab;asmUI.grab=null;if(!g)return;
  const {h,c}=g;const P=asmUI.pm;
  // eşleştirme paneli açıkken sürüklenen konum panelin başlangıç konumu olur (önizleme onu geri almasın); ayrı geri alma adımı eklenmez
  const inMate=P&&P.type==='mate';const h0=asmHistFor(),redo0=h0?h0.redo.slice():null;if(!inMate)pushAsmHist();
  const dir=new T.Vector3();camera.getWorldDirection(dir);
  asmUI.drag={redo0,c,inMate,rot:g.rot,mode:P&&P.type==='move'?(g.rot?P.rmode:P.mode):'free',ax:P&&P.type==='move'?(g.rot?P.rax:P.ax):'x',
    T0:new T.Matrix4().fromArray(c.T),last:c.T.slice(),p0:h.point.clone(),gl:h.point.clone().applyMatrix4(new T.Matrix4().fromArray(c.T).invert()),
    x:e.clientX,y:e.clientY,plane:new T.Plane().setFromNormalAndCoplanarPoint(dir,h.point),center:compCenter(c),moved:false,pend:null,mated:hasMates(curAsm(),c.id)};
}
function asmMove(e){
  const d=asmUI.drag;
  if(!d){
    if(e.pointerType==='mouse'&&asmUI.pm&&asmUI.pm.type==='mate'&&!asmUI.down){
      asmUI.hovE={clientX:e.clientX,clientY:e.clientY,altKey:e.altKey};
      if(!asmUI.hovRaf)asmUI.hovRaf=requestAnimationFrame(()=>{asmUI.hovRaf=0;if(!asmUI.pm||asmUI.pm.type!=='mate'){asmHover(null);return}const h=asmPick(asmUI.hovE,{edges:true});asmHover(h);renderer.domElement.style.cursor=h&&h.ref?'pointer':''});
    }
    return;
  }
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>3){if(!d.moved)asmHover(null);d.moved=true}if(!d.moved)return;
  d.pend={x:e.clientX,y:e.clientY};
  if(d.raf)return;
  d.raf=requestAnimationFrame(()=>{d.raf=0;applyDrag(d)});
}
const AXV={x:new T.Vector3(1,0,0),y:new T.Vector3(0,1,0),z:new T.Vector3(0,0,1)};
function applyDrag(d){
  const q=d.pend;if(!q)return;d.pend=null;const a=curAsm();
  ray.setFromCamera(ndc({clientX:q.x,clientY:q.y}),camera);const c0=d.center;
  const about=(R)=>new T.Matrix4().makeTranslation(c0.x,c0.y,c0.z).multiply(R).multiply(new T.Matrix4().makeTranslation(-c0.x,-c0.y,-c0.z)).multiply(d.T0);
  let M=null,tgt=null;
  if(!d.rot){
    let p=new T.Vector3();
    if(d.mode==='axis'){
      // montaj ekseni boyunca: imleç ışınının eksene en yakın noktası
      const u=AXV[d.ax],w0=ray.ray.origin.clone().sub(d.p0),b=ray.ray.direction.dot(u),dd=u.dot(w0),e2=ray.ray.direction.dot(w0),den=1-b*b;if(den<1e-6)return;
      p=d.p0.clone().addScaledVector(u,(dd-b*e2)/den);
    }else if(!ray.ray.intersectPlane(d.plane,p))return;
    const dv=p.clone().sub(d.p0);M=new T.Matrix4().makeTranslation(dv.x,dv.y,dv.z).multiply(d.T0);tgt=p;
  }else if(d.mode==='axis'){M=about(new T.Matrix4().makeRotationAxis(AXV[d.ax],(q.x-d.x)*0.01))}
  else{
    const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    M=about(new T.Matrix4().makeRotationAxis(up,(q.x-d.x)*0.01).multiply(new T.Matrix4().makeRotationAxis(right,(q.y-d.y)*0.01)));
  }
  if(!d.mated){d.c.T=M.toArray();if(a.pats)applyPats(a)}
  else{
    d.c.T=d.last.slice();
    // taşıma: yakalanan nokta imleci izler (yalnızca dönebilen bileşen, ör. menteşeli kol, imleçle döner); döndürme: dönmüş konum hedeflenir
    const soft=tgt?(Mc=>{const g=d.gl.clone().applyMatrix4(Mc).sub(tgt);return [g.x*0.1,g.y*0.1,g.z*0.1]}):poseSoft(d.c,M,0.1);
    if(!dragSolve(a,d.c,soft))d.c.T=d.last.slice();
    else if(!d.told&&d.c.T.every((v,i)=>Math.abs(v-d.last[i])<1e-7)&&asmView.dof[d.c.id]==='ok'){d.told=true;toast('Bu bileşen eşleştirmelerle tam konumlanmış; hareket edemez.')}
  }
  d.last=d.c.T.slice();updateAsmPoses();
}
/* sürükleme bitti: hareket ettiyse geri alma adımı kalır (eşleştirme panelinde panelin başlangıç konumu güncellenir); etmediyse tıklamadır */
function endDrag(e){
  const d=asmUI.drag;asmUI.drag=null;controls.enabled=true;if(d.raf){cancelAnimationFrame(d.raf);d.raf=0}
  if(d.moved){applyDrag(d);const P=asmUI.pm;if(d.inMate&&P&&P.type==='mate'){const a=curAsm();P.orig=a.comps.map(c=>({id:c.id,T:c.T.slice()}));P.dragged=true;previewMate()}if(P&&P.type==='move'){P.comp=d.c.id;asmUI.sel=d.c.id;movePmSync()}asmChanged(false);if(P&&P.type==='move')renderAsmPM();return true}
  if(!d.inMate){const h=asmHistFor();if(h){h.undo.pop();if(d.redo0)h.redo=d.redo0}updUndo()}
  return false;
}

/* ---------- Bileşeni Taşı paneli ---------- */
function openMovePM(rot){
  const a=curAsm();if(!a||!a.comps.length){toast('Montajda bileşen yok.');return}
  const P=asmUI.pm;if(P&&P.type==='move'){P.rot=!!rot;renderAsmPM();renderAsmRibbon();movePrompt();return}
  closeAsmPM(true);collapseIfExploded();asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  const sel=asmUI.sel&&compById(asmUI.sel)&&!compById(asmUI.sel).fixed&&!compById(asmUI.sel).pat?asmUI.sel:null;
  asmUI.pm={type:'move',rot:!!rot,mode:'free',ax:'x',rmode:'free',rax:'y',dx:0,dy:0,dz:0,rx:0,ry:0,rz:0,comp:sel};
  if(sel)movePmSync();renderAsmPM();renderAsmRibbon();movePrompt();
}
function movePrompt(){const P=asmUI.pm;prompt_(`Bileşeni sürükle: sol tuş ${P.rot?'döndürür, sağ tuş taşır':'taşır, sağ tuş döndürür'}. Eşleştirmeler hareketi sınırlar. Bitirmek için Esc.`)}
/* XYZ konumu alanları seçili bileşenin şimdiki konumunu gösterir (bileşen başlangıç noktası) */
function movePmSync(){const P=asmUI.pm,c=P&&compById(P.comp);if(!c)return;const r=x=>Math.round(x*1000)/1000;P.x=r(c.T[12]);P.y=r(c.T[13]);P.z=r(c.T[14])}
function movePMBody(){
  const P=asmUI.pm,a=curAsm(),c=compById(P.comp);
  const seg=(k,opts)=>`<div class="seg">${opts.map(([v,t])=>`<button type="button" data-mvseg="${k}" data-v="${v}" class="${P[k]===v?'on':''}">${esc(t)}</button>`).join('')}</div>`;
  const ax=k=>seg(k,[['x','X'],['y','Y'],['z','Z']]);
  let b=grp('Bileşen',`<div class="lst"><div><span${c?'':' style="color:var(--muted)"'}>${c?esc(compName(a,c)):'Ekranda taşınacak bileşene tıkla'}</span></div></div>`,'ΔXYZ ve XYZ konumu bu bileşene uygulanır. Sürükleyerek her serbest bileşen taşınabilir.');
  let m=seg('mode',[['free','Serbest sürükle'],['axis','Montaj XYZ boyunca'],['delta','ΔXYZ ile'],['to','XYZ konumuna']]);
  if(P.mode==='axis')m+=ax('ax');
  if(P.mode==='delta')m+=`<div class="row3">${fNum('ΔX','dx','mm',P)}${fNum('ΔY','dy','mm',P)}${fNum('ΔZ','dz','mm',P)}</div><button class="sbtn" data-mvapply="delta" ${c?'':'disabled'}>Uygula</button>`;
  if(P.mode==='to')m+=`<div class="row3">${fNum('X','x','mm',P)}${fNum('Y','y','mm',P)}${fNum('Z','z','mm',P)}</div><button class="sbtn" data-mvapply="to" ${c?'':'disabled'}>Uygula</button>`;
  b+=grp('Taşı'+(P.rot?' (sağ tuş)':' (sol tuş)'),m,'Serbest: imleçle birlikte. XYZ boyunca: yalnızca seçilen montaj ekseninde. ΔXYZ: girilen kadar öteler. XYZ konumuna: bileşenin başlangıç noktasını bu konuma götürür.');
  let r=seg('rmode',[['free','Serbest sürükle'],['axis','Eksen etrafında'],['delta','ΔXYZ ile']]);
  if(P.rmode==='axis')r+=ax('rax');
  if(P.rmode==='delta')r+=`<div class="row3">${fNum('ΔX','rx','°',P)}${fNum('ΔY','ry','°',P)}${fNum('ΔZ','rz','°',P)}</div><button class="sbtn" data-mvapply="rot" ${c?'':'disabled'}>Uygula</button>`;
  b+=grp('Döndür'+(P.rot?' (sol tuş)':' (sağ tuş)'),r+`<button type="button" class="sbtn" data-mvrot="1" style="margin-top:6px">${P.rot?'Sol tuş: taşı':'Sol tuş: döndür'}</button>`,'Döndürme bileşenin merkezi etrafındadır. Eksen etrafında: montajın X, Y veya Z eksenine paralel. ΔXYZ: sırayla X, Y, Z eksenleri etrafında.');
  return b;
}
function movePmClick(e){
  const P=asmUI.pm,a=curAsm();
  const s=e.target.closest('[data-mvseg]');if(s){P[s.dataset.mvseg]=s.dataset.v;if(s.dataset.mvseg==='mode'&&s.dataset.v==='to')movePmSync();renderAsmPM();return true}
  if(e.target.closest('[data-mvrot]')){P.rot=!P.rot;renderAsmPM();renderAsmRibbon();movePrompt();return true}
  const ap=e.target.closest('[data-mvapply]');
  if(ap){const c=compById(P.comp);if(!c)return true;const k=ap.dataset.mvapply,T0=new T.Matrix4().fromArray(c.T);let M;
    if(k==='delta')M=new T.Matrix4().makeTranslation(num(P.dx)||0,num(P.dy)||0,num(P.dz)||0).multiply(T0);
    else if(k==='to')M=T0.clone().setPosition(num(P.x)||0,num(P.y)||0,num(P.z)||0);
    else{const c0=compCenter(c),rad=x=>(num(x)||0)*Math.PI/180;const R=new T.Matrix4().makeRotationZ(rad(P.rz)).multiply(new T.Matrix4().makeRotationY(rad(P.ry))).multiply(new T.Matrix4().makeRotationX(rad(P.rx)));
      M=new T.Matrix4().makeTranslation(c0.x,c0.y,c0.z).multiply(R).multiply(new T.Matrix4().makeTranslation(-c0.x,-c0.y,-c0.z)).multiply(T0)}
    const h0=asmHistFor(),redo0=h0?h0.redo.slice():null;pushAsmHist();
    if(moveCompTo(a,c,M)){asmChanged(false);movePmSync();renderAsmPM()}
    else{const h=asmHistFor();if(h){h.undo.pop();if(redo0)h.redo=redo0}updUndo();toast('Eşleştirmeler bu harekete izin vermiyor.')}
    return true}
  return false;
}
function movePmInput(e){const P=asmUI.pm,t=e.target;if(t.dataset.num&&t.dataset.k){const v=num(t.value);if(isFinite(v))P[t.dataset.k]=v}}

/* imleç görünümün dışında bırakılırsa da sürükleme biter, görünüm denetimi geri açılır */
renderer.domElement.parentElement.addEventListener('pointerdown',e=>{if(e.target===renderer.domElement)asmGrab(e)},true);
for(const ev of ['pointerup','pointercancel'])window.addEventListener(ev,e=>{if(activeTab!=='asm')return;asmUI.grab=null;if(asmUI.drag)endDrag(e);controls.enabled=true});
