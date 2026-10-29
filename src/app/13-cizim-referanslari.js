/* Çizimde dış referanslar: arkadaki modelin kenarları ve diğer çizimlerin öğeleri çizim düzlemine izdüşürülür.
   Seç aracıyla (veya Akıllı Ölçülendirmede) böyle bir kenara tıklanınca çizime sabit bir referans yapı öğesi (ref) eklenir;
   çakışık, paralel, teğet, eşmerkezli gibi ilişkiler ve ölçüler ona verilebilir. Kullanılmayan referanslar çizimden çıkarken silinir. */
const REFCOL=0x9A5BD6;
function toSk(w){const d=vs(w,sk.F.o);return [vd(d,sk.F.u),vd(d,sk.F.v)]}
/* izdüşürülmüş aday geometriler (çizim yerel koordinatlarında); oturum boyunca model değişmediği için bir kez hesaplanır */
function extCandidates(){
  if(sk.extC)return sk.extC;
  const out=[],n=sk.F.n,eps=1e-6*(1+modelExtent());
  // modelin daireleri: ekseni çizim normaline paralel silindir açıklamaları; yalnızca görünen kenarlara oturanlar
  const edges=shown.edges.map(ed=>({a:toSk(ed.a),b:toSk(ed.b)}));
  const circ=[];
  for(const an of model.ann||[]){if(Math.abs(an.A.x*n[0]+an.A.y*n[1]+an.A.z*n[2])<0.9999)continue;
    const c=toSk([an.C.x,an.C.y,an.C.z]),r=an.r;if(circ.some(x=>Math.hypot(x.c[0]-c[0],x.c[1]-c[1])<eps&&Math.abs(x.r-r)<eps))continue;
    const on=p=>Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-r)<Math.max(eps,r*1e-4);
    if(edges.filter(e=>on(e.a)&&on(e.b)).length>=3)circ.push({t:'circle',c,r,src:'model'})}
  out.push(...circ);
  const onCirc=p=>circ.some(x=>Math.abs(Math.hypot(p[0]-x.c[0],p[1]-x.c[1])-x.r)<Math.max(eps,x.r*1e-4));
  // aynı doğru üzerindeki parçalar (yandan görünen daire kenarlarının parçaları, ön ve arka kenarlar) tek çizgide birleşir
  const groups=[];
  for(const e of edges){const d=[e.b[0]-e.a[0],e.b[1]-e.a[1]],L=Math.hypot(d[0],d[1]);if(L<eps*10||(onCirc(e.a)&&onCirc(e.b)))continue;
    let u=[d[0]/L,d[1]/L];if(u[0]<-1e-9||(Math.abs(u[0])<=1e-9&&u[1]<0))u=[-u[0],-u[1]];const nn=[-u[1],u[0]],c=nn[0]*e.a[0]+nn[1]*e.a[1];
    const t0=u[0]*e.a[0]+u[1]*e.a[1],t1=u[0]*e.b[0]+u[1]*e.b[1];
    let g=groups.find(g=>Math.abs(g.u[0]*u[1]-g.u[1]*u[0])<1e-6&&Math.abs(g.c-c)<eps*10);if(!g)groups.push(g={u,nn,c,iv:[]});g.iv.push([Math.min(t0,t1),Math.max(t0,t1)])}
  for(const g of groups){g.iv.sort((x,y)=>x[0]-y[0]);let cur=null;const P=t=>[g.nn[0]*g.c+g.u[0]*t,g.nn[1]*g.c+g.u[1]*t];
    for(const iv of g.iv.concat([null])){if(cur&&iv&&iv[0]<=cur[1]+eps*10){cur[1]=Math.max(cur[1],iv[1]);continue}if(cur)out.push({t:'line',a:P(cur[0]),b:P(cur[1]),src:'model'});cur=iv&&iv.slice()}}
  // diğer çizimler (ağaçta görünen, bir özellikçe kullanılmayan)
  const cons=consumedMap();
  for(const g of state.features){
    if(g.type!=='sketch'||g.suppressed||g===sk.feat||cons[g.id])continue;const F=model.frames[g.id];if(!F)continue;
    const W=id=>{const p=skP(g,id);return toSk(fpt(F,p.x,p.y,0))};const dn=vd(F.n,n),par=Math.abs(dn)>0.9999;
    for(const e of g.ents){if(e.cons)continue;
      if(e.t==='line'){const a=W(e.a),b=W(e.b);if(Math.hypot(b[0]-a[0],b[1]-a[1])>eps*10)out.push({t:'line',a,b,src:g.id})}
      else if(par&&e.t==='circle')out.push({t:'circle',c:W(e.c),r:e.r,src:g.id});
      else if(par)out.push({t:'arc',c:W(e.c),a:W(dn>0?e.a:e.b),b:W(dn>0?e.b:e.a),r:curveR(g,e),src:g.id})}
    for(const id in g.pts)if(g.pts[id].sp)out.push({t:'pt',p:W(id),src:g.id});
  }
  return sk.extC=out;
}
function candDist(c,q){
  if(c.t==='pt')return Math.hypot(q[0]-c.p[0],q[1]-c.p[1]);
  if(c.t==='line')return segD(q,c.a,c.b)[0];
  const d=Math.abs(Math.hypot(q[0]-c.c[0],q[1]-c.c[1])-c.r);if(c.t==='circle')return d;
  const an=p=>Math.atan2(p[1]-c.c[1],p[0]-c.c[0]);let a0=an(c.a),sw=an(c.b)-a0,da=an(q)-a0;while(sw<=0)sw+=Math.PI*2;while(da<0)da+=Math.PI*2;
  return da<=sw?d:Math.min(Math.hypot(q[0]-c.a[0],q[1]-c.a[1]),Math.hypot(q[0]-c.b[0],q[1]-c.b[1]));
}
/* imlecin altındaki dış geometri (noktalar öncelikli) */
function extPick(q,tol){
  let best=null,bd=tol;
  for(const c of extCandidates()){const d=candDist(c,q)-(c.t==='pt'?tol*0.5:0);if(d<bd){bd=d;best=c}}
  return best;
}
/* referans nokta: aynı yerde sabit (referans) nokta veya orijin varsa o kullanılır */
function refPt(p,added){
  const f=sk.feat,id0=ptAt(f,p);if(id0&&(id0==='O'||f.cons.some(c=>c.t==='fix'&&c.p===id0)))return id0;
  const id=newId(f,'p');f.pts[id]={x:p[0],y:p[1]};addCon({t:'fix',p:id},added);return id;
}
/* dış geometriyi çizime sabit referans olarak ekler; seçim için isabet döndürür */
function addRef(c){
  const f=sk.feat;skPush();let h;
  if(c.t==='pt'){const id=refPt(c.p);if(id!=='O'&&!f.ents.some(e=>[e.a,e.b,e.c].includes(id)))Object.assign(f.pts[id],{sp:true,ref:true});h={k:'pt',id}}
  else if(c.t==='line')h={k:'ent',id:addEnt({t:'line',a:refPt(c.a),b:refPt(c.b),cons:true,ref:true}).id};
  else if(c.t==='circle')h={k:'ent',id:addEnt({t:'circle',c:refPt(c.c),r:c.r,cons:true,ref:true}).id};
  else h={k:'ent',id:addEnt({t:'arc',c:refPt(c.c),a:refPt(c.a),b:refPt(c.b),cons:true,ref:true}).id};
  analyze();sk.dirty=true;return h;
}
/* tıklanan yerde dış geometri varsa referansını ekler */
function refAt(q,tol){const c=extPick(q,tol);return c?addRef(c):null}
const isRefPt=(f,id)=>!!(f.pts[id]&&(f.pts[id].ref||f.ents.some(e=>e.ref&&[e.a,e.b,e.c].includes(id))));
/* çizimden çıkarken hiçbir ilişki, ölçü veya öğeyle bağlanmamış referanslar silinir */
function pruneRefs(f){
  const axes=new Set(axisRefs(f));
  const usedPt=(id,own)=>f.ents.some(o=>o!==own&&[o.a,o.b,o.c].includes(id))||f.cons.some(c=>c.t!=='fix'&&CPK.some(k=>c[k]===id));
  for(const e of f.ents.filter(e=>e.ref)){
    if(axes.has(e.id)||f.cons.some(c=>c.e===e.id||c.e1===e.id||c.e2===e.id))continue;
    if([e.a,e.b,e.c].filter(Boolean).some(p=>usedPt(p,e)))continue;
    f.ents=f.ents.filter(x=>x!==e);
  }
  for(const id of Object.keys(f.pts))if(f.pts[id].ref&&!usedPt(id,null)){delete f.pts[id];f.cons=f.cons.filter(c=>c.p!==id)}
}
/* imlecin altındaki dış geometrinin vurgusu */
function extHoverSegs(c){
  if(c.t==='pt')return [];if(c.t==='line')return [[c.a,c.b]];
  const N=72,out=[];let a0=0,sw=Math.PI*2;
  if(c.t==='arc'){a0=Math.atan2(c.a[1]-c.c[1],c.a[0]-c.c[0]);sw=Math.atan2(c.b[1]-c.c[1],c.b[0]-c.c[0])-a0;while(sw<=0)sw+=Math.PI*2}
  let prev=null;for(let i=0;i<=N;i++){const t=a0+sw*i/N;const p=[c.c[0]+c.r*Math.cos(t),c.c[1]+c.r*Math.sin(t)];if(prev)out.push([prev,p]);prev=p}
  return out;
}
