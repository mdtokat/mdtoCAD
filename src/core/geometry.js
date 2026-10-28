/* Tezgâh CAD — geometri çekirdeği: CSG, çizim profilleri, kısıt çözücü, özellik gövdeleri, kenar çıkarımı, yeniden oluşturma.
   Bu dosya DOM'a bağımlı değildir; yalnızca THREE (r128) kullanır. */
'use strict';
var T=THREE;
/* ============ küçük vektör yardımcıları (dizi tabanlı) ============ */
const va=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vs=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vk=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const vd=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vc=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vl=a=>Math.hypot(a[0],a[1],a[2]);
const vn=a=>{const l=vl(a)||1;return [a[0]/l,a[1]/l,a[2]/l]};
const v3=a=>new T.Vector3(a[0],a[1],a[2]);
function num(x){return typeof x==='number'?x:parseFloat(String(x).replace(',','.'))}

/* ============ CSG (BSP) ============ */
var CSG_EPS=1e-5;
class Vec{
  constructor(x,y,z){this.x=x;this.y=y;this.z=z}
  neg(){return new Vec(-this.x,-this.y,-this.z)}
  minus(a){return new Vec(this.x-a.x,this.y-a.y,this.z-a.z)}
  times(k){return new Vec(this.x*k,this.y*k,this.z*k)}
  dot(a){return this.x*a.x+this.y*a.y+this.z*a.z}
  cross(a){return new Vec(this.y*a.z-this.z*a.y,this.z*a.x-this.x*a.z,this.x*a.y-this.y*a.x)}
  len(){return Math.hypot(this.x,this.y,this.z)}
  lerp(a,t){return new Vec(this.x+(a.x-this.x)*t,this.y+(a.y-this.y)*t,this.z+(a.z-this.z)*t)}
}
class Plane{
  constructor(n,w){this.n=n;this.w=w}
  clone(){return new Plane(this.n,this.w)}
  flip(){this.n=this.n.neg();this.w=-this.w}
  split(poly,cf,cb,f,b){
    const vs_=poly.verts,L=vs_.length,types=new Array(L);let pt=0;
    for(let i=0;i<L;i++){const t=this.n.dot(vs_[i])-this.w;const ty=t<-CSG_EPS?2:(t>CSG_EPS?1:0);pt|=ty;types[i]=ty}
    if(pt===0){(this.n.dot(poly.plane.n)>0?cf:cb).push(poly)}
    else if(pt===1)f.push(poly);
    else if(pt===2)b.push(poly);
    else{
      const F=[],B=[];
      for(let i=0;i<L;i++){
        const j=(i+1)%L,ti=types[i],tj=types[j],vi=vs_[i],vj=vs_[j];
        if(ti!==2)F.push(vi);
        if(ti!==1)B.push(vi);
        if((ti|tj)===3){const t=(this.w-this.n.dot(vi))/this.n.dot(vj.minus(vi));const v=vi.lerp(vj,t);F.push(v);B.push(v)}
      }
      if(F.length>=3)f.push(new Poly(F,poly.shared,poly.plane.clone()));
      if(B.length>=3)b.push(new Poly(B,poly.shared,poly.plane.clone()));
    }
  }
}
function newell(p){
  let x=0,y=0,z=0;const L=p.length;
  for(let i=0;i<L;i++){const a=p[i],c=p[(i+1)%L];x+=(a.y-c.y)*(a.z+c.z);y+=(a.z-c.z)*(a.x+c.x);z+=(a.x-c.x)*(a.y+c.y)}
  const l=Math.hypot(x,y,z);if(l<1e-12)return null;
  const n=new Vec(x/l,y/l,z/l);return new Plane(n,n.dot(p[0]));
}
class Poly{
  constructor(verts,shared,plane){this.verts=verts;this.shared=shared;this.plane=plane||newell(verts)}
  clone(){return new Poly(this.verts.slice(),this.shared,this.plane.clone())}
  flip(){this.verts.reverse();this.plane.flip()}
}
class BSP{
  constructor(polys){this.plane=null;this.front=null;this.back=null;this.polys=[];if(polys)this.build(polys)}
  invert(){for(const p of this.polys)p.flip();if(this.plane)this.plane.flip();if(this.front)this.front.invert();if(this.back)this.back.invert();const t=this.front;this.front=this.back;this.back=t}
  clipPolygons(polys){if(!this.plane)return polys.slice();let f=[],b=[];for(const p of polys)this.plane.split(p,f,b,f,b);if(this.front)f=this.front.clipPolygons(f);b=this.back?this.back.clipPolygons(b):[];return f.concat(b)}
  clipTo(bsp){this.polys=bsp.clipPolygons(this.polys);if(this.front)this.front.clipTo(bsp);if(this.back)this.back.clipTo(bsp)}
  all(){const out=[],st=[this];while(st.length){const n=st.pop();for(const p of n.polys)out.push(p);if(n.front)st.push(n.front);if(n.back)st.push(n.back)}return out}
  build(polys){if(!polys.length)return;if(!this.plane)this.plane=polys[0].plane.clone();const f=[],b=[];for(const p of polys)this.plane.split(p,this.polys,this.polys,f,b);if(f.length){if(!this.front)this.front=new BSP();this.front.build(f)}if(b.length){if(!this.back)this.back=new BSP();this.back.build(b)}}
}
const clonePolys=ps=>ps.map(p=>p.clone());
function bboxPolys(ps){
  const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
  for(const p of ps)for(const v of p.verts){if(v.x<mn[0])mn[0]=v.x;if(v.y<mn[1])mn[1]=v.y;if(v.z<mn[2])mn[2]=v.z;if(v.x>mx[0])mx[0]=v.x;if(v.y>mx[1])mx[1]=v.y;if(v.z>mx[2])mx[2]=v.z}
  return {min:mn,max:mx};
}
function boxHit(a,b){for(let k=0;k<3;k++){if(a.max[k]<b.min[k]-1e-6||b.max[k]<a.min[k]-1e-6)return false}return true}
function csgUnion(a,b){
  if(!a.length)return clonePolys(b);if(!b.length)return a;
  if(!boxHit(bboxPolys(a),bboxPolys(b)))return a.concat(clonePolys(b));
  const A=new BSP(clonePolys(a)),B=new BSP(clonePolys(b));
  A.clipTo(B);B.clipTo(A);B.invert();B.clipTo(A);B.invert();A.build(B.all());return A.all();
}
function csgSubtract(a,b){
  if(!a.length||!b.length)return a;
  if(!boxHit(bboxPolys(a),bboxPolys(b)))return a;
  const A=new BSP(clonePolys(a)),B=new BSP(clonePolys(b));
  A.invert();A.clipTo(B);B.clipTo(A);B.invert();B.clipTo(A);B.invert();A.build(B.all());A.invert();return A.all();
}
function geomToPolys(g,shared){
  const gg=g.index?g.toNonIndexed():g;const a=gg.attributes.position.array;const out=[];let vol=0;
  for(let i=0;i<a.length;i+=9){
    const A=new Vec(a[i],a[i+1],a[i+2]),B=new Vec(a[i+3],a[i+4],a[i+5]),C=new Vec(a[i+6],a[i+7],a[i+8]);
    const n=B.minus(A).cross(C.minus(A));const l=n.len();if(l<1e-9)continue;
    const u=n.times(1/l);vol+=A.dot(B.cross(C));out.push(new Poly([A,B,C],shared,new Plane(u,u.dot(A))));
  }
  if(vol<0)out.forEach(p=>p.flip());
  if(gg!==g)gg.dispose();g.dispose();return out;
}
function transformPolys(ps,M,shared){
  const e=M.elements,det=M.determinant();
  const tv=v=>new Vec(e[0]*v.x+e[4]*v.y+e[8]*v.z+e[12],e[1]*v.x+e[5]*v.y+e[9]*v.z+e[13],e[2]*v.x+e[6]*v.y+e[10]*v.z+e[14]);
  const out=[];
  for(const p of ps){let q=p.verts.map(tv);if(det<0)q.reverse();const pl=newell(q);if(pl)out.push(new Poly(q,shared!==undefined?shared:p.shared,pl))}
  return out;
}
function massProps(polys){
  let vol=0,area=0;
  for(const p of polys){const a=p.verts[0];for(let i=1;i<p.verts.length-1;i++){const b=p.verts[i],c=p.verts[i+1];vol+=a.dot(b.cross(c));area+=b.minus(a).cross(c.minus(a)).len()}}
  return {vol:vol/6,area:area/2};
}

/* ============ Düzlemler / çerçeveler ============ */
var STD={front:{o:[0,0,0],u:[1,0,0],v:[0,1,0],n:[0,0,1]},top:{o:[0,0,0],u:[1,0,0],v:[0,0,-1],n:[0,1,0]},right:{o:[0,0,0],u:[0,0,-1],v:[0,1,0],n:[1,0,0]}};
var STD_NAMES={front:'Ön Düzlem',top:'Üst Düzlem',right:'Sağ Düzlem'};
function uvForNormal(n){
  const map={'0,0,1':[[1,0,0],[0,1,0]],'0,0,-1':[[-1,0,0],[0,1,0]],'0,1,0':[[1,0,0],[0,0,-1]],'0,-1,0':[[1,0,0],[0,0,1]],'1,0,0':[[0,0,-1],[0,1,0]],'-1,0,0':[[0,0,1],[0,1,0]]};
  const r=n.map(x=>Math.abs(x)>0.99999?Math.sign(x):(Math.abs(x)<1e-5?0:NaN));
  const key=r.map(x=>x===0?0:x).join(',');
  if(map[key])return map[key];
  const up=Math.abs(n[1])<0.99?[0,1,0]:[0,0,-1];
  const u=vn(vc(up,n));const v=vc(n,u);return [u,v];
}
function faceFrame(n,p){const [u,v]=uvForNormal(n);const w=vd(n,p);return {o:vk(n,w),u,v,n:n.slice()}}
function frameMatrix(F){return new T.Matrix4().makeBasis(v3(F.u),v3(F.v),v3(F.n)).setPosition(v3(F.o))}
function fpt(F,x,y,z){z=z||0;return [F.o[0]+F.u[0]*x+F.v[0]*y+F.n[0]*z,F.o[1]+F.u[1]*x+F.v[1]*y+F.n[1]*z,F.o[2]+F.u[2]*x+F.v[2]*y+F.n[2]*z]}

/* ============ Çizim (sketch) geometrisi ============ */
function skP(sk,id){if(id==='O')return {x:0,y:0};return sk.pts[id]}
function entMap(sk){const m={};for(const e of sk.ents)m[e.id]=e;return m}
function curveR(sk,e){if(e.t==='circle')return e.r;const c=skP(sk,e.c),a=skP(sk,e.a);return Math.hypot(a.x-c.x,a.y-c.y)}
function arcInfo(sk,e){
  const c=skP(sk,e.c),a=skP(sk,e.a),b=skP(sk,e.b);
  const a0=Math.atan2(a.y-c.y,a.x-c.x),a1=Math.atan2(b.y-c.y,b.x-c.x);
  let sw=a1-a0;while(sw<=1e-9)sw+=Math.PI*2;while(sw>Math.PI*2+1e-9)sw-=Math.PI*2;
  return {c,a0,sw,r:Math.hypot(a.x-c.x,a.y-c.y)};
}
function tessEnt(sk,e,full){
  full=full||64;
  if(e.t==='line'){const a=skP(sk,e.a),b=skP(sk,e.b);return [[a.x,a.y],[b.x,b.y]]}
  if(e.t==='circle'){const c=skP(sk,e.c);const out=[];for(let i=0;i<=full;i++){const t=i/full*Math.PI*2;out.push([c.x+e.r*Math.cos(t),c.y+e.r*Math.sin(t)])}return out}
  const A=arcInfo(sk,e);const n=Math.max(2,Math.ceil(full*A.sw/(Math.PI*2)));const out=[];
  const a=skP(sk,e.a),b=skP(sk,e.b);
  for(let i=0;i<=n;i++){if(i===0){out.push([a.x,a.y]);continue}if(i===n){out.push([b.x,b.y]);continue}const t=A.a0+A.sw*i/n;out.push([A.c.x+A.r*Math.cos(t),A.c.y+A.r*Math.sin(t)])}
  return out;
}
function area2d(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return s/2}
function pip(pt,poly){let ins=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))ins=!ins}return ins}
function segX(p1,p2,p3,p4){
  const d=(p2[0]-p1[0])*(p4[1]-p3[1])-(p2[1]-p1[1])*(p4[0]-p3[0]);if(Math.abs(d)<1e-12)return false;
  const t=((p3[0]-p1[0])*(p4[1]-p3[1])-(p3[1]-p1[1])*(p4[0]-p3[0]))/d,u=((p3[0]-p1[0])*(p2[1]-p1[1])-(p3[1]-p1[1])*(p2[0]-p1[0]))/d;
  return t>1e-7&&t<1-1e-7&&u>1e-7&&u<1-1e-7;
}
/* Çizimden kapalı profilleri çıkarır: dış konturlar + delikler */
function sketchProfiles(sk){
  const ents=sk.ents.filter(e=>!e.cons);
  if(!ents.length)throw new Error('Çizimde profil yok. Yapı geometrisi dışındaki çizgilerle kapalı bir kontur çiz.');
  const deg={},adj={};
  for(const e of ents)if(e.t==='line'||e.t==='arc'){for(const p of [e.a,e.b]){deg[p]=(deg[p]||0)+1;(adj[p]=adj[p]||[]).push(e)}}
  for(const p in deg){if(deg[p]===1)throw new Error('Çizimde açık kontur var: bir çizginin ucu boşta.');if(deg[p]>2)throw new Error('Bir noktada ikiden fazla çizgi birleşiyor; profil belirsiz.')}
  const loops=[],used=new Set();
  for(const e of ents){
    if(e.t==='circle'){const t=tessEnt(sk,e);t.pop();const c=skP(sk,e.c);loops.push({pts:t,circle:{x:c.x,y:c.y,r:e.r}});continue}
    if(used.has(e.id))continue;
    const pts=[];let cur=e,from=e.a;const start=e.a;let guard=0;
    while(guard++<10000){
      used.add(cur.id);const to=cur.a===from?cur.b:cur.a;
      const seg=tessEnt(sk,cur);const ord=cur.a===from?seg:seg.slice().reverse();
      for(let i=0;i<ord.length-1;i++)pts.push(ord[i]);
      from=to;if(to===start)break;
      const nx=adj[to].find(x=>x!==cur&&!used.has(x.id));if(!nx)break;cur=nx;
    }
    loops.push({pts});
  }
  for(const L of loops){if(Math.abs(area2d(L.pts))<1e-6)throw new Error('Çizimde alanı sıfır olan bir kontur var.');if(area2d(L.pts)<0)L.pts.reverse()}
  for(let i=0;i<loops.length;i++){
    const A=loops[i].pts;
    for(let j=i;j<loops.length;j++){
      const B=loops[j].pts;
      for(let a=0;a<A.length;a++){const a1=A[a],a2=A[(a+1)%A.length];
        for(let b=(i===j?a+2:0);b<B.length;b++){if(i===j&&a===0&&b===B.length-1)continue;const b1=B[b],b2=B[(b+1)%B.length];if(segX(a1,a2,b1,b2))throw new Error('Çizimde kesişen çizgiler var. Konturlar birbirini kesmemeli.')}}
    }
  }
  const inner=loops.map(L=>{const p=L.pts,a=p[0],b=p[1];const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;const d=Math.min(l*0.01,1e-3);return [(a[0]+b[0])/2-dy/l*d,(a[1]+b[1])/2+dx/l*d]});
  const depth=loops.map((L,i)=>loops.reduce((s,M,j)=>s+(i!==j&&pip(inner[i],M.pts)?1:0),0));
  const parent=loops.map((L,i)=>{let best=-1;loops.forEach((M,j)=>{if(i!==j&&depth[j]===depth[i]-1&&pip(inner[i],M.pts))best=j});return best});
  const shapes=[];
  loops.forEach((L,i)=>{if(depth[i]%2===0)shapes.push({outer:L.pts,holes:[],idx:i,circle:L.circle})});
  loops.forEach((L,i)=>{if(depth[i]%2===1){const s=shapes.find(s=>s.idx===parent[i]);if(s)s.holes.push({pts:L.pts.slice().reverse(),circle:L.circle})}});
  return shapes;
}

/* ============ Kısıt çözücü (Levenberg–Marquardt) ============ */
var AK=50;
function sysBuild(sk,extraCons){
  const E=entMap(sk);const cons=extraCons?sk.cons.concat(extraCons):sk.cons;
  const fixed=new Set();for(const c of cons)if(c.t==='fix')fixed.add(c.p);
  const X0=[],pIdx={},rIdx={};
  for(const id in sk.pts){if(fixed.has(id))continue;pIdx[id]=X0.length;X0.push(sk.pts[id].x,sk.pts[id].y)}
  for(const e of sk.ents)if(e.t==='circle'){rIdx[e.id]=X0.length;X0.push(e.r)}
  const gx=(X,id)=>id==='O'?0:(pIdx[id]!==undefined?X[pIdx[id]]:sk.pts[id].x);
  const gy=(X,id)=>id==='O'?0:(pIdx[id]!==undefined?X[pIdx[id]+1]:sk.pts[id].y);
  const R=(X,e)=>e.t==='circle'?X[rIdx[e.id]]:Math.hypot(gx(X,e.a)-gx(X,e.c),gy(X,e.a)-gy(X,e.c));
  const cid=e=>e.t==='circle'||e.t==='arc'?e.c:null;
  const dir=(X,e)=>[gx(X,e.b)-gx(X,e.a),gy(X,e.b)-gy(X,e.a)];
  const un=d=>{const l=Math.hypot(d[0],d[1])||1e-12;return [d[0]/l,d[1]/l]};
  const lpd=(X,e,p)=>{const ax=gx(X,e.a),ay=gy(X,e.a),dx=gx(X,e.b)-ax,dy=gy(X,e.b)-ay,l=Math.hypot(dx,dy)||1e-12;return ((gx(X,p)-ax)*dy-(gy(X,p)-ay)*dx)/l};
  const dpp=(X,p,q)=>Math.hypot(gx(X,q)-gx(X,p),gy(X,q)-gy(X,p));
  const fs=[];
  for(const e of sk.ents)if(e.t==='arc')fs.push(X=>Math.hypot(gx(X,e.a)-gx(X,e.c),gy(X,e.a)-gy(X,e.c))-Math.hypot(gx(X,e.b)-gx(X,e.c),gy(X,e.b)-gy(X,e.c)));
  for(const c of cons){
    const e=c.e?E[c.e]:null,e1=c.e1?E[c.e1]:null,e2=c.e2?E[c.e2]:null;
    if((c.e&&!e)||(c.e1&&!e1)||(c.e2&&!e2))continue;
    switch(c.t){
      case 'h':if(e)fs.push(X=>gy(X,e.a)-gy(X,e.b));else fs.push(X=>gy(X,c.p)-gy(X,c.q));break;
      case 'v':if(e)fs.push(X=>gx(X,e.a)-gx(X,e.b));else fs.push(X=>gx(X,c.p)-gx(X,c.q));break;
      case 'pol':fs.push(X=>lpd(X,e,c.p));break;
      case 'poc':fs.push(X=>Math.hypot(gx(X,c.p)-gx(X,e.c),gy(X,c.p)-gy(X,e.c))-R(X,e));break;
      case 'mid':fs.push(X=>gx(X,c.p)-(gx(X,e.a)+gx(X,e.b))/2,X=>gy(X,c.p)-(gy(X,e.a)+gy(X,e.b))/2);break;
      case 'par':fs.push(X=>{const a=un(dir(X,e1)),b=un(dir(X,e2));return AK*(a[0]*b[1]-a[1]*b[0])});break;
      case 'perp':fs.push(X=>{const a=un(dir(X,e1)),b=un(dir(X,e2));return AK*(a[0]*b[0]+a[1]*b[1])});break;
      case 'coll':fs.push(X=>lpd(X,e1,e2.a),X=>lpd(X,e1,e2.b));break;
      case 'eq':if(e1.t==='line')fs.push(X=>dpp(X,e1.a,e1.b)-dpp(X,e2.a,e2.b));else fs.push(X=>R(X,e1)-R(X,e2));break;
      case 'tan':
        if(e1.t==='line')fs.push(X=>Math.abs(lpd(X,e1,cid(e2)))-R(X,e2));
        else fs.push(X=>dpp(X,cid(e1),cid(e2))-(c.int?Math.abs(R(X,e1)-R(X,e2)):R(X,e1)+R(X,e2)));
        break;
      case 'd':fs.push(X=>dpp(X,c.p,c.q)-c.val);break;
      case 'dh':fs.push(X=>Math.abs(gx(X,c.q)-gx(X,c.p))-c.val);break;
      case 'dv':fs.push(X=>Math.abs(gy(X,c.q)-gy(X,c.p))-c.val);break;
      case 'dpl':fs.push(X=>Math.abs(lpd(X,e,c.p))-c.val);break;
      case 'dll':fs.push(X=>Math.abs(lpd(X,e1,e2.a))-c.val);break;
      case 'ddia':fs.push(X=>2*R(X,e)-c.val);break;
      case 'drad':fs.push(X=>R(X,e)-c.val);break;
      case 'sym':fs.push(X=>{const mx=(gx(X,c.p)+gx(X,c.q))/2,my=(gy(X,c.p)+gy(X,c.q))/2;const ax=gx(X,e.a),ay=gy(X,e.a),dx=gx(X,e.b)-ax,dy=gy(X,e.b)-ay,l=Math.hypot(dx,dy)||1e-12;return ((mx-ax)*dy-(my-ay)*dx)/l},
        X=>{const dx=gx(X,e.b)-gx(X,e.a),dy=gy(X,e.b)-gy(X,e.a),l=Math.hypot(dx,dy)||1e-12;return ((gx(X,c.q)-gx(X,c.p))*dx+(gy(X,c.q)-gy(X,c.p))*dy)/l});break;
      case 'dang':fs.push(X=>{let a=un(dir(X,e1)),b=un(dir(X,e2));if(c.r1)a=[-a[0],-a[1]];if(c.r2)b=[-b[0],-b[1]];return AK*(Math.atan2(Math.abs(a[0]*b[1]-a[1]*b[0]),a[0]*b[0]+a[1]*b[1])-c.val*Math.PI/180)});break;
    }
  }
  const write=X=>{for(const id in pIdx){sk.pts[id].x=X[pIdx[id]];sk.pts[id].y=X[pIdx[id]+1]}for(const id in rIdx){E[id].r=X[rIdx[id]]}};
  const res=X=>fs.map(f=>f(X));
  return {X0,fs,res,write,pIdx,rIdx,fixed,gx,gy,n:X0.length};
}
function linSolve(A,b){
  const n=b.length;const M=A.map((r,i)=>{const q=r.slice();q.push(b[i]);return q});
  for(let c=0;c<n;c++){
    let p=c,mx=Math.abs(M[c][c]);for(let r=c+1;r<n;r++){const v=Math.abs(M[r][c]);if(v>mx){mx=v;p=r}}
    if(mx<1e-14)return null;if(p!==c){const t=M[p];M[p]=M[c];M[c]=t}
    const piv=M[c][c];for(let r=c+1;r<n;r++){const f=M[r][c]/piv;if(f)for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k]}
  }
  const x=new Array(n);for(let r=n-1;r>=0;r--){let s=M[r][n];for(let k=r+1;k<n;k++)s-=M[r][k]*x[k];x[r]=s/M[r][r]}return x;
}
function numJac(fun,X,r0){
  const n=X.length,m=r0.length,J=[];for(let i=0;i<m;i++)J.push(new Array(n).fill(0));
  const Xp=X.slice();
  for(let j=0;j<n;j++){const h=1e-6*(1+Math.abs(X[j]));Xp[j]=X[j]+h;const r=fun(Xp);for(let i=0;i<m;i++)J[i][j]=(r[i]-r0[i])/h;Xp[j]=X[j]}
  return J;
}
/* merkezi farkla Jacobian: rank (serbestlik derecesi) hesabında ileri farkın gürültüsünden kaçınır */
function numJacC(fun,X){
  const n=X.length,Xp=X.slice();const cols=[];
  for(let j=0;j<n;j++){const h=1e-5*(1+Math.abs(X[j]));Xp[j]=X[j]+h;const a=fun(Xp);Xp[j]=X[j]-h;const b=fun(Xp);Xp[j]=X[j];cols.push(a.map((v,i)=>(v-b[i])/(2*h)))}
  const m=cols.length?cols[0].length:0,J=[];for(let i=0;i<m;i++){const r=new Array(n);for(let j=0;j<n;j++)r[j]=cols[j][i];J.push(r)}
  return J;
}
function lm(fun,X,iters){
  iters=iters||100;let x=X.slice();let r=fun(x);let cost=r.reduce((s,v)=>s+v*v,0);let lam=1e-3;const n=x.length;
  if(!n)return {x,cost};
  for(let it=0;it<iters;it++){
    if(cost<1e-22)break;
    const J=numJac(fun,x,r);const m=r.length;
    const A=[];for(let i=0;i<n;i++)A.push(new Array(n).fill(0));const g=new Array(n).fill(0);
    for(let k=0;k<m;k++){const Jk=J[k];const rk=r[k];for(let i=0;i<n;i++){const a=Jk[i];if(!a)continue;g[i]+=a*rk;for(let j=i;j<n;j++)A[i][j]+=a*Jk[j]}}
    for(let i=0;i<n;i++)for(let j=0;j<i;j++)A[i][j]=A[j][i];
    let ok=false;
    for(let t=0;t<14;t++){
      const M=A.map(q=>q.slice());for(let i=0;i<n;i++)M[i][i]+=lam*(A[i][i]+1e-6);
      const d=linSolve(M,g.map(v=>-v));if(!d){lam*=10;continue}
      const xn=x.map((v,i)=>v+d[i]);const rn=fun(xn);const cn=rn.reduce((s,v)=>s+v*v,0);
      if(isFinite(cn)&&cn<cost){x=xn;r=rn;const gain=cost-cn;cost=cn;lam=Math.max(lam/4,1e-12);ok=true;if(gain<1e-24)it=iters;break}
      lam*=6;
    }
    if(!ok)break;
  }
  return {x,cost,r};
}
/* targets: [{p,x,y}] veya [{e,r}] — sürükleme hedefleri (yumuşak) */
function solveSketch(sk,targets){
  const S=sysBuild(sk);
  if(!S.n)return S.fs.every(f=>Math.abs(f([]))<1e-6);
  let X=S.X0.slice();
  if(targets&&targets.length){
    const soft=[];
    for(const t of targets){
      if(t.p!==undefined&&S.pIdx[t.p]!==undefined){const i=S.pIdx[t.p];soft.push(X=>(X[i]-t.x)*0.5,X=>(X[i+1]-t.y)*0.5)}
      if(t.e!==undefined&&S.rIdx[t.e]!==undefined){const i=S.rIdx[t.e];soft.push(X=>(X[i]-t.r)*0.5)}
    }
    X=lm(X=>S.res(X).concat(soft.map(f=>f(X))),X,40).x;
  }
  const r=lm(S.res,X,120);
  const mx=r.r?r.r.reduce((m,v)=>Math.max(m,Math.abs(v)),0):0;
  if(mx<2e-6){S.write(r.x);return true}
  return false;
}
function rrefInfo(J,n){
  const m=J.length;const A=J.map(r=>r.slice());let rank=0;const piv=[];
  let scale=0;for(const r of A)for(const v of r)scale=Math.max(scale,Math.abs(v));const tol=Math.max(1e-9,scale*1e-8);
  for(let c=0;c<n&&rank<m;c++){
    let p=rank,mx=Math.abs(A[rank][c]);for(let r=rank+1;r<m;r++){const v=Math.abs(A[r][c]);if(v>mx){mx=v;p=r}}
    if(mx<tol)continue;
    const t=A[p];A[p]=A[rank];A[rank]=t;const pv=A[rank][c];for(let k=c;k<n;k++)A[rank][k]/=pv;
    for(let r=0;r<m;r++){if(r===rank)continue;const f=A[r][c];if(Math.abs(f)>1e-15)for(let k=c;k<n;k++)A[r][k]-=f*A[rank][k]}
    piv.push(c);rank++;
  }
  return {A,rank,piv};
}
function analyzeSketch(sk){
  const S=sysBuild(sk);const n=S.n;
  if(!n)return {dof:0,ptDef:()=>true,rDef:()=>true};
  const r0=S.res(S.X0);let rank=0,det=new Array(n).fill(false);
  if(r0.length){
    const J=numJacC(S.res,S.X0);const R=rrefInfo(J,n);rank=R.rank;
    const isP=new Set(R.piv);const free=[];for(let c=0;c<n;c++)if(!isP.has(c))free.push(c);
    det=new Array(n).fill(true);
    for(const f of free){det[f]=false;R.piv.forEach((pc,row)=>{if(Math.abs(R.A[row][f])>1e-7)det[pc]=false})}
  }
  return {dof:n-rank,
    ptDef:id=>id==='O'||S.fixed.has(id)||(S.pIdx[id]!==undefined&&det[S.pIdx[id]]&&det[S.pIdx[id]+1]),
    rDef:id=>S.rIdx[id]===undefined||det[S.rIdx[id]]};
}
function sketchRank(sk,extra){
  const S=sysBuild(sk,extra);if(!S.n)return 0;const r0=S.res(S.X0);if(!r0.length)return 0;
  return rrefInfo(numJacC(S.res,S.X0),S.n).rank;
}

/* Otomatik tam tanımlama (SolidWorks "Çizimi Tam Tanımla"): geometriyi oynatmadan,
   mevcut değerlerle ilişki ve ölçü ekleyerek serbestlik derecesini sıfıra indirir.
   Aday kısıtlar öncelik sırasıyla denenir; yalnızca rankı artıranlar (bağımsız olanlar) eklenir. */
function autoDefine(sk){
  const S=sysBuild(sk);const n=S.n;if(!n)return [];
  const X=S.X0;
  // analyzeSketch ile aynı ölçüt: merkezi farklı Jacobian + rrefInfo rankı
  const grad=f=>{const Xp=X.slice(),row=new Array(n);for(let j=0;j<n;j++){const h=1e-5*(1+Math.abs(X[j]));Xp[j]=X[j]+h;const a=f(Xp);Xp[j]=X[j]-h;const b=f(Xp);Xp[j]=X[j];row[j]=(a-b)/(2*h)}return row};
  const J=S.fs.map(grad);let rank=J.length?rrefInfo(J,n).rank:0;
  if(rank>=n)return [];
  const P=id=>{const p=skP(sk,id);return [p.x,p.y]};
  const used=new Set();for(const e of sk.ents)for(const k of ['a','b','c'])if(e[k])used.add(e[k]);
  const ids=Object.keys(sk.pts).filter(id=>used.has(id)&&!S.fixed.has(id));
  let ext=1;for(const id of ids){const p=P(id);ext=Math.max(ext,Math.abs(p[0]),Math.abs(p[1]))}
  for(const e of sk.ents)if(e.t==='circle'){const c=P(e.c);ext=Math.max(ext,Math.abs(c[0])+e.r,Math.abs(c[1])+e.r)}
  const tol=Math.max(1e-6,ext*1e-7),ttol=Math.max(5e-4,ext*2e-6),off=ext*0.08;
  let cx=0,cy=0;if(ids.length){for(const id of ids){const p=P(id);cx+=p[0];cy+=p[1]}cx/=ids.length;cy/=ids.length}
  const out=[];let k=0;const taken=new Set(sk.cons.map(c=>c.id));
  const nid=()=>{let i;do{i='c'+(++k)}while(taken.has(i));taken.add(i);return i};
  const tryAdd=c=>{
    if(rank>=n)return false;
    const S2=sysBuild(sk,[c]);const fs=S2.fs.slice(S.fs.length);if(!fs.length)return false;
    const rows=fs.map(grad);const r2=rrefInfo(J.concat(rows),n).rank;
    if(r2<rank+rows.length)return false;
    J.push(...rows);rank=r2;c.id=nid();out.push(c);return true;
  };
  const lines=sk.ents.filter(e=>e.t==='line'),curves=sk.ents.filter(e=>e.t!=='line');
  const R=e=>curveR(sk,e);
  const ord=a=>a.slice().sort((x,y)=>(x.cons?1:0)-(y.cons?1:0));
  // 1) yatay / dikey çizgiler
  for(const e of lines){const a=P(e.a),b=P(e.b);if(Math.abs(a[1]-b[1])<tol)tryAdd({t:'h',e:e.id});else if(Math.abs(a[0]-b[0])<tol)tryAdd({t:'v',e:e.id})}
  // 2) ortak uçlarda teğetlik
  const lpd=(e,p)=>{const a=P(e.a),b=P(e.b),q=P(p);const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1e-12;return Math.abs(((q[0]-a[0])*dy-(q[1]-a[1])*dx)/l)};
  const ends=e=>e.t==='circle'?[]:[e.a,e.b];
  for(const c of curves)if(c.t==='arc'){
    for(const l of lines)if(ends(c).some(p=>p===l.a||p===l.b)&&Math.abs(lpd(l,c.c)-R(c))<ttol)tryAdd({t:'tan',e1:l.id,e2:c.id});
    for(const d of curves)if(d!==c&&d.t==='arc'&&c.id<d.id&&ends(c).some(p=>ends(d).includes(p))){
      const c1=P(c.c),c2=P(d.c);const dd=Math.hypot(c1[0]-c2[0],c1[1]-c2[1]);
      if(Math.abs(dd-(R(c)+R(d)))<ttol)tryAdd({t:'tan',e1:c.id,e2:d.id});else if(dd>tol&&Math.abs(dd-Math.abs(R(c)-R(d)))<ttol)tryAdd({t:'tan',e1:c.id,e2:d.id,int:true});
    }
  }
  // 3) orijin eksenleri üzerindeki noktalar
  for(const id of ids){const p=P(id);if(Math.abs(p[0])<tol)tryAdd({t:'v',p:'O',q:id});if(Math.abs(p[1])<tol)tryAdd({t:'h',p:'O',q:id})}
  // 4) çizgi veya eğri üzerinde duran noktalar
  for(const id of ids){const p=P(id);
    for(const e of lines){if(e.a===id||e.b===id)continue;const a=P(e.a),b=P(e.b);const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<tol)continue;const t=((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/(L*L);if(t>-1e-9&&t<1+1e-9&&lpd(e,id)<tol)tryAdd({t:'pol',p:id,e:e.id})}
    for(const e of curves){if(e.c===id||e.a===id||e.b===id)continue;const c=P(e.c);if(Math.abs(Math.hypot(p[0]-c[0],p[1]-c[1])-R(e))<tol)tryAdd({t:'poc',p:id,e:e.id})}
  }
  // 5) eşit yarıçaplar
  const cs=ord(curves);for(let i=0;i<cs.length;i++)for(let j=0;j<i;j++)if(Math.abs(R(cs[i])-R(cs[j]))<tol){tryAdd({t:'eq',e1:cs[j].id,e2:cs[i].id});break}
  const away=(m,nv)=>((m[0]-cx)*nv[0]+(m[1]-cy)*nv[1])<0?[-nv[0],-nv[1]]:nv;
  // 6) çap / yarıçap
  for(const e of cs){const C=P(e.c),r=R(e);let a=Math.PI/4;if(e.t==='arc'){const A=arcInfo(sk,e);a=A.a0+A.sw/2}
    tryAdd({t:e.t==='circle'?'ddia':'drad',e:e.id,val:Math.round((e.t==='circle'?2*r:r)*1e4)/1e4,lp:[C[0]+(r+off)*Math.cos(a),C[1]+(r+off)*Math.sin(a)]})}
  // 7) çizgi uzunlukları
  for(const e of ord(lines)){const a=P(e.a),b=P(e.b);const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<tol)continue;const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];const nv=away(m,[-(b[1]-a[1])/L,(b[0]-a[0])/L]);
    tryAdd({t:'d',p:e.a,q:e.b,val:Math.round(L*1e4)/1e4,lp:[m[0]+nv[0]*off*0.6,m[1]+nv[1]*off*0.6]})}
  // 8) ortak köşedeki iki çizgi arasındaki açı
  for(const id of ids){const ls=lines.filter(e=>!e.cons&&(e.a===id||e.b===id));if(ls.length!==2)continue;
    const dir=e=>{const o=P(id),q=P(e.a===id?e.b:e.a);const l=Math.hypot(q[0]-o[0],q[1]-o[1])||1;return [(q[0]-o[0])/l,(q[1]-o[1])/l]};
    const u=dir(ls[0]),v=dir(ls[1]);const cr=u[0]*v[1]-u[1]*v[0],dt=u[0]*v[0]+u[1]*v[1];if(Math.abs(cr)<1e-6)continue;
    const raw=e=>{const a=P(e.a),b=P(e.b);return [b[0]-a[0],b[1]-a[1]]};const r1=raw(ls[0]),r2=raw(ls[1]);
    const o=P(id);const bis=[u[0]+v[0],u[1]+v[1]],bl=Math.hypot(...bis)||1;
    tryAdd({t:'dang',e1:ls[0].id,e2:ls[1].id,r1:(r1[0]*u[0]+r1[1]*u[1])<0,r2:(r2[0]*v[0]+r2[1]*v[1])<0,val:Math.round(Math.atan2(Math.abs(cr),dt)*180/Math.PI*1e4)/1e4,lp:[o[0]+bis[0]/bl*off,o[1]+bis[1]/bl*off]})}
  // 9) orijine göre konumlar (önce merkezler)
  const centers=new Set(curves.map(e=>e.c));const pos=ids.slice().sort((a,b)=>(centers.has(b)?1:0)-(centers.has(a)?1:0));
  for(const id of pos){const p=P(id);const sx=p[0]>=0?1:-1,sy=p[1]>=0?1:-1;
    if(Math.abs(p[0])>=tol)tryAdd({t:'dh',p:'O',q:id,val:Math.round(Math.abs(p[0])*1e4)/1e4,lp:[p[0]/2,p[1]+sy*off*0.5]});
    if(Math.abs(p[1])>=tol)tryAdd({t:'dv',p:'O',q:id,val:Math.round(Math.abs(p[1])*1e4)/1e4,lp:[p[0]+sx*off*0.5,p[1]/2]});
  }
  sk.cons.push(...out);
  return out;
}

/* ============ Özellik gövdeleri ============ */
function extrudeRange(f,L){
  const s=(f.op==='cut'?-1:1)*(f.flip?-1:1);const d=num(f.depth);
  let z0=0,z1=0;
  if(f.end==='mid'){if(!(d>0))throw new Error('Derinlik sıfırdan büyük olmalı.');z0=-d/2;z1=d/2}
  else{
    const a=f.end==='through'?L:d;if(!(a>0))throw new Error('Derinlik sıfırdan büyük olmalı.');
    z0=Math.min(0,s*a);z1=Math.max(0,s*a);
    if(f.dir2){const b=f.end2==='through'?L:num(f.depth2);if(!(b>0))throw new Error('Yön 2 derinliği sıfırdan büyük olmalı.');z0=Math.min(z0,-s*b);z1=Math.max(z1,-s*b)}
  }
  return {z0,z1,s};
}
function extrudeTool(f,sk,F,L){
  const shapes=sketchProfiles(sk);const {z0,z1,s}=extrudeRange(f,L);
  const M=frameMatrix(F);let polys=[];const ann=[];
  for(const sh of shapes){
    const shape=new T.Shape(sh.outer.map(q=>new T.Vector2(q[0],q[1])));
    for(const h of sh.holes)shape.holes.push(new T.Path(h.pts.map(q=>new T.Vector2(q[0],q[1]))));
    const g=new T.ExtrudeGeometry(shape,{depth:z1-z0,bevelEnabled:false,steps:1,curveSegments:1});
    g.translate(0,0,z0);g.applyMatrix4(M);polys=polys.concat(geomToPolys(g,f.id));
    const addAnn=(c,hole)=>ann.push({C:v3(fpt(F,c.x,c.y,0)),A:v3(F.n),r:c.r,t0:z0,t1:z1,gid:f.id+':'+c.r.toFixed(3),op:hole?'cut':f.op,label:true});
    if(sh.circle)addAnn(sh.circle,false);
    for(const h of sh.holes)if(h.circle)addAnn(h.circle,true);
  }
  const zf=s>0?z1:z0,zn=s>0?z0:z1;
  return {polys,ann,cap:{F,zf,zn}};
}
function revolveLoop(pts2,phi0,phiLen,M,shared){
  if(area2d(pts2)<0)pts2=pts2.slice().reverse();
  const full=Math.abs(phiLen)>=Math.PI*2-1e-9;const N=Math.max(3,Math.ceil(64*Math.abs(phiLen)/(Math.PI*2)));
  const e=M.elements;const tw=p=>new Vec(e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12],e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13],e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14]);
  const P=(q,ph)=>[q[0]*Math.sin(ph),q[1],q[0]*Math.cos(ph)];
  const out=[];
  const tri=(A,B,C,ex)=>{const n=vc(vs(B,A),vs(C,A));if(vl(n)<1e-10)return;if(vd(n,ex)<0){const t=B;B=C;C=t}const q=[tw(A),tw(B),tw(C)];const pl=newell(q);if(pl)out.push(new Poly(q,shared,pl))};
  const L=pts2.length;
  for(let k=0;k<N;k++){
    const p0=phi0+phiLen*k/N,p1=phi0+phiLen*(k+1)/N,pm=(p0+p1)/2;
    for(let i=0;i<L;i++){
      const p=pts2[i],q=pts2[(i+1)%L];const nx=q[1]-p[1],ny=-(q[0]-p[0]);const ex=[nx*Math.sin(pm),ny,nx*Math.cos(pm)];
      const A=P(p,p0),B=P(q,p0),C=P(q,p1),D=P(p,p1);tri(A,B,C,ex);tri(A,C,D,ex);
    }
  }
  if(!full){
    const idx=T.ShapeUtils.triangulateShape(pts2.map(q=>new T.Vector2(q[0],q[1])),[]);
    const sg=phiLen>0?1:-1;
    for(const [ph,side] of [[phi0,-1],[phi0+phiLen,1]]){const td=[Math.cos(ph),0,-Math.sin(ph)];const ex=vk(td,side*sg);for(const t of idx)tri(P(pts2[t[0]],ph),P(pts2[t[1]],ph),P(pts2[t[2]],ph),ex)}
  }
  return out;
}
function revolveTool(f,sk,F){
  const E=entMap(sk);const ax=E[f.axis];
  if(!ax||ax.t!=='line')throw new Error('Döndürme ekseni seçilmedi. Çizime bir merkez çizgisi ekle.');
  const shapes=sketchProfiles(sk);
  const P=skP(sk,ax.a),Q=skP(sk,ax.b);let a=[Q.x-P.x,Q.y-P.y];const al=Math.hypot(a[0],a[1]);if(al<1e-9)throw new Error('Eksen çizgisinin uzunluğu sıfır.');a=[a[0]/al,a[1]/al];
  let b=[-a[1],a[0]];
  const loc=q=>[(q[0]-P.x)*b[0]+(q[1]-P.y)*b[1],(q[0]-P.x)*a[0]+(q[1]-P.y)*a[1]];
  let mn=Infinity,mx=-Infinity;for(const sh of shapes)for(const q of sh.outer){const r=loc(q)[0];mn=Math.min(mn,r);mx=Math.max(mx,r)}
  if(mn<-1e-6&&mx>1e-6)throw new Error('Profil döndürme ekseninin iki tarafına geçemez.');
  if(mx<=1e-6)b=[-b[0],-b[1]];
  const A3=vn(va(vk(F.u,a[0]),vk(F.v,a[1])));const B3=vn(va(vk(F.u,b[0]),vk(F.v,b[1])));const X3=vc(A3,B3);const P3=fpt(F,P.x,P.y,0);
  const M=new T.Matrix4().makeBasis(v3(X3),v3(A3),v3(B3)).setPosition(v3(P3));
  const ang=num(f.angle);if(!(ang>0&&ang<=360))throw new Error('Açı 0 ile 360° arasında olmalı.');
  let phiLen=ang*Math.PI/180,phi0=0;if(f.mode==='mid'){phi0=-phiLen/2}else if(f.flip){phiLen=-phiLen}
  let polys=[];const ann=[];let tmin=Infinity,tmax=-Infinity,rmax=0;
  for(const sh of shapes){
    const o=sh.outer.map(q=>{const l=loc(q);return [Math.max(0,l[0]),l[1]]});
    o.forEach(q=>{tmin=Math.min(tmin,q[1]);tmax=Math.max(tmax,q[1]);rmax=Math.max(rmax,q[0])});
    let body=revolveLoop(o,phi0,phiLen,M,f.id);
    for(const h of sh.holes){const hp=h.pts.map(q=>{const l=loc(q);return [Math.max(0,l[0]),l[1]]});body=csgSubtract(body,revolveLoop(hp,phi0,phiLen,M,f.id))}
    polys=polys.concat(body);
  }
  ann.push({C:v3(P3),A:v3(A3),r:rmax,t0:tmin,t1:tmax,gid:f.id,op:f.op,label:false});
  // eksene paralel profil kenarları = silindirik yüzeyler (montajda eşmerkezli eşleştirme için)
  const cyl=new Set();
  for(const sh of shapes)for(const loop of [sh.outer,...sh.holes.map(h=>h.pts)]){
    const q=loop.map(loc);for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];const r=Math.abs(a[0]);
      if(r>1e-6&&Math.abs(Math.abs(a[0])-Math.abs(b[0]))<1e-6&&Math.abs(a[1]-b[1])>1e-6){const k=r.toFixed(4)+'_'+Math.min(a[1],b[1]).toFixed(4);if(cyl.has(k))continue;cyl.add(k);
        ann.push({C:v3(P3),A:v3(A3),r,t0:Math.min(a[1],b[1]),t1:Math.max(a[1],b[1]),gid:f.id,op:f.op,label:false})}}}
  return {polys,ann,cap:null};
}

/* ============ Kenarlar ============ */
function computeEdges(polys,D,detail){
  const B=new Map();
  for(const p of polys){
    const n=p.plane.n,q=p.verts,L=q.length;const fr=D?(n.x*D.x+n.y*D.y+n.z*D.z)<-1e-6:false;
    for(let i=0;i<L;i++){
      const a=q[i],b=q[(i+1)%L];let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const len=Math.hypot(dx,dy,dz);if(len<1e-7)continue;
      dx/=len;dy/=len;dz/=len;
      if(dx<-1e-7||(dx<=1e-7&&(dy<-1e-7||(dy<=1e-7&&dz<0)))){dx=-dx;dy=-dy;dz=-dz}
      const ta=a.x*dx+a.y*dy+a.z*dz,tb=b.x*dx+b.y*dy+b.z*dz;const px=a.x-dx*ta,py=a.y-dy*ta,pz=a.z-dz*ta;
      const key=Math.round(dx*2000)+','+Math.round(dy*2000)+','+Math.round(dz*2000)+','+Math.round(px*40)+','+Math.round(py*40)+','+Math.round(pz*40);
      let bk=B.get(key);if(!bk){bk={d:[dx,dy,dz],p:[px,py,pz],e:[]};B.set(key,bk)}
      bk.e.push(Math.min(ta,tb),Math.max(ta,tb),n,fr,p);
    }
  }
  const COS=Math.cos(20*Math.PI/180);const out=[];
  for(const bk of B.values()){
    const e=bk.e,m=e.length/5;const ts=[];for(let i=0;i<m;i++)ts.push(e[i*5],e[i*5+1]);ts.sort((x,y)=>x-y);
    const u=[];for(const t of ts){if(!u.length||t-u[u.length-1]>1e-5)u.push(t)}
    let cur=null;
    const flush=()=>{if(cur){const [dx,dy,dz]=bk.d,[px,py,pz]=bk.p;const o={a:[px+dx*cur.t0,py+dy*cur.t0,pz+dz*cur.t0],b:[px+dx*cur.t1,py+dy*cur.t1,pz+dz*cur.t1],k:cur.k};if(detail){o.pa=cur.pa;o.pb=cur.pb}out.push(o);cur=null}};
    for(let k=0;k<u.length-1;k++){
      const t0=u[k],t1=u[k+1],mid=(t0+t1)/2;let cnt=0,n0=null,p0=null,pb=null,feat=false,f=false,bb=false;
      for(let i=0;i<m;i++){if(e[i*5]<=mid&&e[i*5+1]>=mid){const n=e[i*5+2];cnt++;if(n0===null){n0=n;p0=e[i*5+4]}else if(!feat&&n0.dot(n)<COS){feat=true;pb=e[i*5+4]}if(e[i*5+3])f=true;else bb=true}}
      let kind=0;if(cnt===1||feat)kind=1;else if(cnt>1&&D&&f&&bb)kind=2;
      if(kind&&cur&&cur.k===kind&&Math.abs(cur.t1-t0)<1e-5)cur.t1=t1;
      else{flush();if(kind)cur={k:kind,t0,t1,pa:p0,pb}}
    }
    flush();
  }
  return out;
}
const polyCentroid=p=>{let x=0,y=0,z=0;for(const v of p.verts){x+=v.x;y+=v.y;z+=v.z}const n=p.verts.length;return [x/n,y/n,z/n]};
const pn=p=>[p.plane.n.x,p.plane.n.y,p.plane.n.z];
function matchEdge(all,se){
  const d=vn(vs(se.b,se.a)),m=vk(va(se.a,se.b),.5);let best=null,bd=1e9;
  for(const e of all){const de=vs(e.b,e.a),L=vl(de);if(L<1e-6)continue;const u=vk(de,1/L);if(Math.abs(vd(u,d))<0.9995)continue;const t=vd(vs(m,e.a),u);if(t<-0.05||t>L+0.05)continue;const off=vl(vs(vs(m,e.a),vk(u,t)));if(off<0.05&&off<bd){bd=off;best=e}}
  return best;
}
function isCurvedEdge(all,e){
  const u=vn(vs(e.b,e.a)),L=vl(vs(e.b,e.a));
  for(const o of all){if(o===e)continue;for(const p of [e.a,e.b])for(const q of [o.a,o.b])if(vl(vs(p,q))<1e-4){const w=vs(o.b,o.a),Lo=vl(w);const ang=Math.acos(Math.min(1,Math.abs(vd(u,vk(w,1/Lo)))))*180/Math.PI;if(ang>0.3&&ang<30&&Lo/L>0.25&&Lo/L<4)return true}}
  return false;
}
/* Radyus / pah için kesici veya dolgu gövdeleri */
function edgeOpBodies(solid,f,anns){
  const all=computeEdges(solid,null,true).filter(e=>e.k===1&&e.pa&&e.pb);
  const sub=[],add=[],done=new Set();const val=num(f.type==='fillet'?f.r:f.d);
  if(!(val>0))throw new Error(f.type==='fillet'?'Yarıçap sıfırdan büyük olmalı.':'Pah mesafesi sıfırdan büyük olmalı.');
  if(!f.edges||!f.edges.length)throw new Error('Kenar seçilmedi.');
  for(const se of f.edges){
    const e=matchEdge(all,se);if(!e)throw new Error('Seçilen kenarlardan biri modelde bulunamadı. Özelliği düzenleyip kenarları yeniden seç.');
    if(isCurvedEdge(all,e)){const b=curvedEdgeBody(e,f,val,anns||[],done);if(b)(b.convex?sub:add).push(b.polys);continue}
    const E0=e.a,E1=e.b,t=vn(vs(E1,E0)),Ln=vl(vs(E1,E0));
    const n1=pn(e.pa),n2=pn(e.pb),c1=polyCentroid(e.pa),c2=polyCentroid(e.pb);
    const foot=c=>va(E0,vk(t,vd(vs(c,E0),t)));
    let w1=vn(vc(n1,t));if(vd(w1,vs(c1,foot(c1)))<0)w1=vk(w1,-1);
    let w2=vn(vc(n2,t));if(vd(w2,vs(c2,foot(c2)))<0)w2=vk(w2,-1);
    const convex=vd(n1,vs(c2,foot(c2)))<0;
    const phi=Math.acos(Math.max(-1,Math.min(1,vd(w1,w2))));
    if(phi<0.05||phi>Math.PI-0.05)throw new Error('Kenardaki yüzeyler neredeyse paralel; işlem uygulanamıyor.');
    const eps=Math.max(0.02,val*0.02),sg=convex?1:-1;
    let sec=[];
    if(f.type==='fillet'){
      const td=val/Math.tan(phi/2);const T1=va(E0,vk(w1,td)),T2=va(E0,vk(w2,td));const C=va(T1,vk(n1,-sg*val));
      const a1=vk(n1,sg),a2=vk(n2,sg),Om=Math.acos(Math.max(-1,Math.min(1,vd(a1,a2))));const N=Math.max(4,Math.ceil(Om/(Math.PI/2)*16));
      sec.push(va(T1,vk(n1,sg*eps)),va(E0,vk(va(n1,n2),sg*eps)),va(T2,vk(n2,sg*eps)),T2);
      for(let i=1;i<N;i++){const s=i/N;const k1=Math.sin((1-s)*Om)/Math.sin(Om),k2=Math.sin(s*Om)/Math.sin(Om);sec.push(va(C,vk(va(vk(a2,k1),vk(a1,k2)),val)))}
      sec.push(T1);
    }else{
      const P1=va(E0,vk(w1,val)),P2=va(E0,vk(w2,val));
      sec=[va(P1,vk(n1,sg*eps)),va(E0,vk(va(n1,n2),sg*eps)),va(P2,vk(n2,sg*eps)),P2,P1];
    }
    const hp=Math.abs(t[0])<0.9?[1,0,0]:[0,1,0];const b1=vn(vc(t,hp));const b2=vc(t,b1);
    const st=vs(E0,vk(t,eps));
    const pts2=sec.map(p=>{const r=vs(p,st);return new T.Vector2(vd(r,b1),vd(r,b2))});
    const sh=new T.Shape(pts2);const g=new T.ExtrudeGeometry(sh,{depth:Ln+2*eps,bevelEnabled:false,steps:1,curveSegments:1});
    g.applyMatrix4(new T.Matrix4().makeBasis(v3(b1),v3(b2),v3(t)).setPosition(v3(st)));
    (convex?sub:add).push(geomToPolys(g,f.id));
  }
  return {sub,add};
}

function findCircleAnn(anns,e){
  for(const an of anns){
    const C=[an.C.x,an.C.y,an.C.z],A=[an.A.x,an.A.y,an.A.z];
    const rad=p=>{const w=vs(p,C);const t=vd(w,A);return [vl(vs(w,vk(A,t))),t]};
    const [ra,ta]=rad(e.a),[rb,tb]=rad(e.b);const tol=Math.max(2e-3,an.r*2e-3);
    if(Math.abs(ra-an.r)<tol&&Math.abs(rb-an.r)<tol&&Math.abs(ta-tb)<tol)return {an,C,A,te:(ta+tb)/2};
  }
  return null;
}
/* Dairesel kenarda radyus/pah: kesit profili eksen etrafında döndürülür */
function curvedEdgeBody(e,f,val,anns,done){
  const m=findCircleAnn(anns,e);if(!m)throw new Error('Bu eğrisel kenar tanınamadı. Radyus ve pah yalnızca dairesel kenarlarda (delik ağzı, silindir kenarı) çalışır.');
  const key=m.an.C.x.toFixed(3)+m.an.C.y.toFixed(3)+m.an.C.z.toFixed(3)+'|'+m.an.r.toFixed(3)+'|'+m.te.toFixed(3);if(done.has(key))return null;done.add(key);
  const {C,A,te}=m,r0=m.an.r;
  const nA=pn(e.pa),nB=pn(e.pb);
  const planar=Math.abs(vd(nA,A))>0.99?e.pa:(Math.abs(vd(nB,A))>0.99?e.pb:null);
  if(!planar)throw new Error('Bu dairesel kenarın bir tarafı eksene dik düz bir yüzey olmalı.');
  const cyl=planar===e.pa?e.pb:e.pa;const cP=polyCentroid(planar),cC=polyCentroid(cyl);
  const radial=p=>{const w=vs(p,C);const t=vd(w,A);return vl(vs(w,vk(A,t)))};
  const sr=radial(cP)>r0?1:-1,st=vd(vs(cC,C),A)>te?1:-1;
  const mid=vk(va(e.a,e.b),.5);const convex=vd(pn(planar),vs(cC,mid))<0;
  if(sr<0&&val>=r0-1e-6)throw new Error('Yarıçap/mesafe, silindir yarıçapından küçük olmalı.');
  const eps=Math.max(0.02,val*0.02);const w1=[sr,0],w2=[0,st];
  const P=(a,b)=>[a,b];let sec;
  if(f.type==='fillet'){
    const R=val;const cx=sr*R,cy=st*R;sec=[P(sr*R-w2[0]*eps,-w2[1]*eps),P(-(w1[0]+w2[0])*eps,-(w1[1]+w2[1])*eps),P(-w1[0]*eps,st*R-w1[1]*eps),P(0,st*R)];
    const N=16;for(let i=N-1;i>=1;i--){const th=i/N*Math.PI/2;sec.push(P(cx-R*(Math.cos(th)*w2[0]+Math.sin(th)*w1[0]),cy-R*(Math.cos(th)*w2[1]+Math.sin(th)*w1[1])))}
    sec.push(P(sr*R,0));
  }else{
    const d=val;sec=[P(sr*d-w2[0]*eps,-w2[1]*eps),P(-(w1[0]+w2[0])*eps,-(w1[1]+w2[1])*eps),P(-w1[0]*eps,st*d-w1[1]*eps),P(0,st*d),P(sr*d,0)];
  }
  const pts2=sec.map(([rho,tau])=>[Math.max(0,r0+rho),te+tau]);
  const hp=Math.abs(A[0])<0.9?[1,0,0]:[0,1,0];const B3=vn(vc(A,hp));const X3=vc(A,B3);
  const M=new T.Matrix4().makeBasis(v3(X3),v3(A),v3(B3)).setPosition(v3(C));
  return {convex,polys:revolveLoop(pts2,0,Math.PI*2,M,f.id)};
}

/* ============ Delik Sihirbazı ============ */
var HOLE_STD={
  M3:{p:.5,tap:2.5,cl:[3.2,3.4,3.6],cb:[6.5,3.4],cs:6.7},M4:{p:.7,tap:3.3,cl:[4.3,4.5,4.8],cb:[8,4.4],cs:9},M5:{p:.8,tap:4.2,cl:[5.3,5.5,5.8],cb:[10,5.4],cs:11.2},
  M6:{p:1,tap:5,cl:[6.4,6.6,7],cb:[11,6.4],cs:13.4},M8:{p:1.25,tap:6.8,cl:[8.4,9,10],cb:[15,8.6],cs:17.9},M10:{p:1.5,tap:8.5,cl:[10.5,11,12],cb:[18,10.6],cs:22.4},
  M12:{p:1.75,tap:10.2,cl:[13,13.5,14.5],cb:[20,12.6],cs:26.9},M16:{p:2,tap:14,cl:[17,17.5,18.5],cb:[26,16.6],cs:33.6},M20:{p:2.5,tap:17.5,cl:[21,22,24],cb:[33,20.6],cs:40.3}
};
const fmtN=x=>Number(x).toLocaleString('tr-TR',{maximumFractionDigits:2});
function holeSpec(f){
  const s=HOLE_STD[f.size]||HOLE_STD.M8;const nom=parseFloat(String(f.size||'M8').slice(1));const fi={fine:0,normal:1,coarse:2}[f.fit||'normal'];
  let d,txt,thread=null,cb=null,cs=null;
  if(f.htype==='simple'){d=num(f.dia);if(!(d>0))throw new Error('Delik çapı sıfırdan büyük olmalı.');txt='Ø'+fmtN(d)}
  else if(f.htype==='tapped'){d=s.tap;thread={R:nom/2};txt=f.size+'×'+fmtN(s.p)}
  else{d=s.cl[fi];txt='Ø'+fmtN(d);if(f.htype==='cbore'){cb=s.cb;txt+=', faturalı Ø'+fmtN(cb[0])+' derinlik '+fmtN(cb[1])}else if(f.htype==='csink'){cs=s.cs;txt+=', havşa Ø'+fmtN(cs)+'×90°'}}
  const through=f.end!=='blind';const D=num(f.depth);if(!through&&!(D>0))throw new Error('Delik derinliği sıfırdan büyük olmalı.');
  if(thread){const td=through?null:Math.min(num(f.tdepth)||D,D);thread.len=td;txt+=through?'':(' derinlik '+fmtN(td))}
  else if(!through)txt+=(f.htype==='simple'||f.htype==='clear'?' derinlik ':' / delik derinliği ')+fmtN(D);
  return {d,txt,thread,cb,cs,through,D};
}
function holeTool(f,F,L){
  const H=holeSpec(f);const r=H.d/2,eps=0.05;const D=H.through?L:H.D;const tip=H.through?0:r*0.6;
  let prof=[[0,eps]];
  if(H.cb){if(H.cb[0]/2<=r)throw new Error('Faturalı çap delik çapından büyük olmalı.');prof.push([H.cb[0]/2,eps],[H.cb[0]/2,-H.cb[1]],[r,-H.cb[1]])}
  else if(H.cs){const R=H.cs/2;prof.push([R,eps],[R,-eps],[r,-(R-r)-eps])}
  else prof.push([r,eps]);
  prof.push([r,-D],[0,-D-tip]);
  if(!f.pts||!f.pts.length)throw new Error('Delik konumu seçilmedi. Yüzeye tıklayarak konum ekle.');
  const tools=[],ann=[];const n=v3(F.n),u=v3(F.u),v=v3(F.v);
  f.pts.forEach((q,i)=>{
    const P=fpt(F,num(q[0]),num(q[1]),0);const M=new T.Matrix4().makeBasis(v,n,u).setPosition(v3(P));
    tools.push(revolveLoop(prof,0,Math.PI*2,M,f.id));
    const a={C:v3(P),A:n.clone(),r,t0:-D,t1:0,gid:f.id,op:'cut',label:true,txt:H.txt};
    if(H.thread)a.thread={R:H.thread.R,t0:H.thread.len?-H.thread.len:-D,t1:0};
    ann.push(a);
    if(H.cb)ann.push({C:v3(P),A:n.clone(),r:H.cb[0]/2,t0:-H.cb[1],t1:0,gid:f.id+'cb',op:'cut',label:false});
    if(H.cs)ann.push({C:v3(P),A:n.clone(),r:H.cs/2,t0:-0.01,t1:0,gid:f.id+'cs',op:'cut',label:false});
  });
  return {tools,ann};
}

/* ============ Desen matrisleri ============ */
var AXDIR={x:[1,0,0],'-x':[-1,0,0],y:[0,1,0],'-y':[0,-1,0],z:[0,0,1],'-z':[0,0,-1]};
function patternMatrices(f,frames){
  const out=[];
  if(f.type==='lpattern'){
    const d1=v3(AXDIR[f.dir1]||AXDIR.x),n1=Math.max(1,Math.round(num(f.n1)));
    const has2=f.dir2&&f.dir2!=='none';const d2=has2?v3(AXDIR[f.dir2]):null;const n2=has2?Math.max(1,Math.round(num(f.n2))):1;
    if(!isFinite(n1)||!isFinite(n2))throw new Error('Adet geçerli bir sayı olmalı.');
    if(n1*n2>200)throw new Error('En fazla 200 kopya oluşturulabilir.');
    if(n1*n2<2)throw new Error('Toplam adet en az 2 olmalı.');
    for(let i=0;i<n1;i++)for(let j=0;j<n2;j++){if(!i&&!j)continue;const t=d1.clone().multiplyScalar(i*num(f.sp1));if(d2)t.addScaledVector(d2,j*num(f.sp2));out.push(new T.Matrix4().makeTranslation(t.x,t.y,t.z))}
  }else if(f.type==='cpattern'){
    const n=Math.round(num(f.n));if(!(n>=2&&n<=200))throw new Error('Adet 2 ile 200 arasında olmalı.');
    const tot=num(f.angle)||360;const full=Math.abs(Math.abs(tot)-360)<1e-6;const step=full?Math.PI*2/n:tot*Math.PI/180/(n-1);
    const ax=v3(AXDIR[f.axis]||AXDIR.y);for(let k=1;k<n;k++)out.push(new T.Matrix4().makeRotationAxis(ax,step*k));
  }else if(f.type==='mirror'){
    const F=STD[f.plane]||frames[f.plane];if(!F)throw new Error('Ayna düzlemi bulunamadı.');
    const n=F.n,a=n[0],b=n[1],c=n[2];const R=new T.Matrix4().set(1-2*a*a,-2*a*b,-2*a*c,0,-2*a*b,1-2*b*b,-2*b*c,0,-2*a*c,-2*b*c,1-2*c*c,0,0,0,0,1);
    const o=F.o;out.push(new T.Matrix4().makeTranslation(o[0],o[1],o[2]).multiply(R).multiply(new T.Matrix4().makeTranslation(-o[0],-o[1],-o[2])));
  }
  return out;
}

/* ============ Model yeniden oluşturma ============ */
function reachFor(solid,F){
  let m=60;if(solid&&solid.length){const b=bboxPolys(solid);for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]])m=Math.max(m,vl(vs([x,y,z],F.o)))}
  return m*1.1+10;
}
function sketchFrame(sk,ctx){
  const on=sk.on||{kind:'std',key:'front'};
  if(on.kind==='std')return STD[on.key]||STD.front;
  if(on.kind==='plane'){const F=ctx.frames[on.id];if(!F)throw new Error('Çizim düzlemi bulunamadı.');return F}
  if(on.kind==='face'){
    const c=on.feat&&ctx.caps[on.feat];
    if(c&&on.which){const z=on.which==='far'?c.zf:c.zn;const n=vk(c.F.n,on.sgn||1);return faceFrame(n,fpt(c.F,0,0,z))}
    if(on.frame)return on.frame;
  }
  throw new Error('Çizim düzlemi çözülemedi.');
}
function clipAnn(a,box,polys){
  let lo=a.t0,hi=a.t1;const C=[a.C.x,a.C.y,a.C.z],A=[a.A.x,a.A.y,a.A.z];
  for(let k=0;k<3;k++){if(Math.abs(A[k])<1e-9){if(C[k]<box.min[k]-1e-6||C[k]>box.max[k]+1e-6)return null;continue}const ta=(box.min[k]-C[k])/A[k],tb=(box.max[k]-C[k])/A[k];lo=Math.max(lo,Math.min(ta,tb));hi=Math.min(hi,Math.max(ta,tb))}
  if(hi-lo<1e-6)return null;
  const r=a.r*1.002+1e-3;let l2=Infinity,h2=-Infinity;
  for(const p of polys)for(const v of p.verts){const dx=v.x-C[0],dy=v.y-C[1],dz=v.z-C[2];const t=dx*A[0]+dy*A[1]+dz*A[2];if(t<lo-1e-6||t>hi+1e-6)continue;const px=dx-A[0]*t,py=dy-A[1]*t,pz=dz-A[2]*t;if(px*px+py*py+pz*pz<=r*r){if(t<l2)l2=t;if(t>h2)h2=t}}
  if(!(h2-l2>1e-6))return null;a.t0=l2;a.t1=h2;return a;
}
function rebuildModel(features,upto){
  const list=upto==null?features:features.slice(0,upto);
  const ctx={frames:{},caps:{},tools:{},errors:{}};let solid=[];const ann=[];
  const byId={};list.forEach(f=>byId[f.id]=f);
  for(const f of list){
    if(f.suppressed)continue;
    try{
      if(f.type==='plane'){
        const B=STD[f.base]||ctx.frames[f.base];if(!B)throw new Error('Referans düzlem bulunamadı.');
        const off=num(f.offset)*(f.flip?-1:1);if(!isFinite(off))throw new Error('Ofset geçerli değil.');
        ctx.frames[f.id]={o:va(B.o,vk(B.n,off)),u:B.u,v:B.v,n:B.n};
      }else if(f.type==='sketch'){
        ctx.frames[f.id]=sketchFrame(f,ctx);
      }else if(f.type==='extrude'||f.type==='revolve'){
        const sk=byId[f.sketch];if(!sk)throw new Error('Özelliğin çizimi bulunamadı.');
        if(ctx.errors[sk.id])throw new Error('Çizimde hata var: '+ctx.errors[sk.id]);
        const F=ctx.frames[sk.id];if(!F)throw new Error('Çizim düzlemi çözülemedi.');
        const r=f.type==='extrude'?extrudeTool(f,sk,F,reachFor(solid,F)):revolveTool(f,sk,F);
        if(r.cap)ctx.caps[f.id]=r.cap;
        ctx.tools[f.id]={polys:r.polys,op:f.op,ann:r.ann};
        solid=f.op==='cut'?csgSubtract(solid,r.polys):(solid.length?csgUnion(solid,r.polys):r.polys);
        ann.push(...r.ann);
      }else if(f.type==='hole'){
        const F=sketchFrame({on:f.on},ctx);const r=holeTool(f,F,reachFor(solid,F));
        for(const t of r.tools)solid=csgSubtract(solid,t);
        ctx.tools[f.id]={polys:[].concat(...r.tools),op:'cut',ann:r.ann,parts:r.tools};ann.push(...r.ann);
      }else if(f.type==='lpattern'||f.type==='cpattern'||f.type==='mirror'){
        const tg=(f.targets||[]).filter(Boolean);if(!tg.length)throw new Error('Çoğaltılacak özellik seçilmedi.');
        const Ms=patternMatrices(f,ctx.frames);
        for(const tid of tg){
          const t=ctx.tools[tid];if(!t)throw new Error('Hedef özellik bulunamadı veya oluşturulamadı.');
          for(const M of Ms){
            if(t.parts){for(const tp of t.parts)solid=csgSubtract(solid,transformPolys(tp,M,f.id))}
            else{const P=transformPolys(t.polys,M,f.id);solid=t.op==='cut'?csgSubtract(solid,P):csgUnion(solid,P)}
            for(const a of t.ann){const b={...a,C:a.C.clone().applyMatrix4(M),A:a.A.clone().transformDirection(M)};ann.push(b)}
          }
        }
      }else if(f.type==='fillet'||f.type==='chamfer'){
        if(!solid.length)throw new Error('Önce bir gövde oluştur.');
        const r=edgeOpBodies(solid,f,ann);
        for(const b of r.sub)solid=csgSubtract(solid,b);
        for(const b of r.add)solid=csgUnion(solid,b);
      }
    }catch(e){ctx.errors[f.id]=e&&e.message?e.message:String(e)}
  }
  let anns=[];
  if(solid.length){const box=bboxPolys(solid);anns=ann.map(a=>clipAnn({...a,C:a.C.clone(),A:a.A.clone()},box,solid)).filter(Boolean)}
  return {polys:solid,ann:anns,errors:ctx.errors,frames:ctx.frames,caps:ctx.caps,tools:ctx.tools};
}
