/* Teknik resim: görünüş üretimi (gizli çizgi), sayfa düzeni, antet, ölçüler, SVG/PNG. */
/* ================= TEKNİK RESİM ================= */
const VIEWS={
  front:{D:[0,0,-1],R:[1,0,0],U:[0,1,0],name:'Ön görünüş'},
  top:{D:[0,-1,0],R:[1,0,0],U:[0,0,-1],name:'Üst görünüş'},
  left:{D:[1,0,0],R:[0,0,1],U:[0,1,0],name:'Soldan görünüş'},
  right:{D:[-1,0,0],R:[0,0,-1],U:[0,1,0],name:'Sağdan görünüş'},
  iso:(()=>{const s3=Math.sqrt(3),s6=Math.sqrt(6),s2=Math.SQRT2;return {D:[-1/s3,-1/s3,-1/s3],U:[-1/s6,2/s6,-1/s6],R:[1/s2,0,-1/s2],name:'İzometrik'}})()
};
let RES=SETTINGS.dwRes;let depthRT=null,depthBuf=null;let vcache={version:-1};
/* gizli çizgi derinlik arabelleğinin çözünürlüğü (Ayarlar); değişince görünüşler yeniden hesaplanır */
function setDepthRes(n,force){if(n===RES&&!force)return;RES=n;if(depthRT){depthRT.dispose();depthRT=null;depthBuf=null}vcache={version:-1}}
const dot3=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
function renderDepth(D,U,c,rad){
  if(!depthRT){depthRT=new T.WebGLRenderTarget(RES,RES,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});depthBuf=new Uint8Array(RES*RES*4)}
  const near=rad*.5,far=rad*3.5;
  const cam=new T.OrthographicCamera(-rad,rad,rad,-rad,near,far);
  const camPos=[c[0]-D[0]*rad*2,c[1]-D[1]*rad*2,c[2]-D[2]*rad*2];
  cam.position.set(...camPos);cam.up.set(...U);cam.lookAt(c[0],c[1],c[2]);cam.updateMatrixWorld();cam.updateProjectionMatrix();
  const pc=renderer.getClearColor(new T.Color()),pa=renderer.getClearAlpha();
  renderer.setScissorTest(false);
  renderer.setRenderTarget(depthRT);renderer.setClearColor(0xffffff,1);renderer.clear(true,true,true);
  renderer.render(depthScene,cam);
  renderer.readRenderTargetPixels(depthRT,0,0,RES,RES,depthBuf);
  renderer.setRenderTarget(null);renderer.setClearColor(pc,pa);
  const out=new Float32Array(RES*RES);
  for(let i=0,j=0;i<out.length;i++,j+=4)out[i]=(depthBuf[j]/16777216+depthBuf[j+1]/65536+depthBuf[j+2]/256+depthBuf[j+3])/256;
  return {dep:out,near,far,camPos};
}
function viewData(key,alt){
  const src=alt||dwSrc();
  if(!vcache.m)vcache={m:new Map()};const ck=src.key+'|'+key;
  if(vcache.m.has(ck))return vcache.m.get(ck);
  depthMesh.geometry=src.g;
  const VW=VIEWS[key],D=VW.D,R=VW.R,U=VW.U;
  let mnA=Infinity,mxA=-Infinity,mnB=Infinity,mxB=-Infinity;
  for(const p of src.polys)for(const v of p.verts){const a=v.x*R[0]+v.y*R[1]+v.z*R[2],b=v.x*U[0]+v.y*U[1]+v.z*U[2];if(a<mnA)mnA=a;if(a>mxA)mxA=a;if(b<mnB)mnB=b;if(b>mxB)mxB=b}
  const bx=src.box;const c=[(bx.min[0]+bx.max[0])/2,(bx.min[1]+bx.max[1])/2,(bx.min[2]+bx.max[2])/2];
  const rad=Math.max(1,Math.hypot(bx.max[0]-bx.min[0],bx.max[1]-bx.min[1],bx.max[2]-bx.min[2])/2*1.04);
  const dp=renderDepth(D,U,c,rad);const dep=dp.dep;
  const pix=2*rad/RES,eps01=(pix*2.5+.01)/(dp.far-dp.near);
  const isVis=(x,y,z)=>{
    const rx=x-c[0],ry=y-c[1],rz=z-c[2];
    const a=rx*R[0]+ry*R[1]+rz*R[2],b=rx*U[0]+ry*U[1]+rz*U[2];
    const dist=(x-dp.camPos[0])*D[0]+(y-dp.camPos[1])*D[1]+(z-dp.camPos[2])*D[2];
    const d01=(dist-dp.near)/(dp.far-dp.near);
    const ix=Math.floor((a/rad*.5+.5)*RES),iy=Math.floor((b/rad*.5+.5)*RES);
    let mx=0;for(let j=-1;j<=1;j++){const Y=Math.min(RES-1,Math.max(0,iy+j));for(let i=-1;i<=1;i++){const X=Math.min(RES-1,Math.max(0,ix+i));const v=dep[Y*RES+X];if(v>mx)mx=v}}
    return d01<=mx+eps01;
  };
  // montajda kenarlar bileşen başına bulunur: farklı bileşenlerin çakışan yüzeyleri (ör. aynı çaplı mil ve delik) kenar sayılmaz
  let edges;
  if(src.kind==='asm'){const gs=new Map();for(const p of src.polys){if(!gs.has(p.shared))gs.set(p.shared,[]);gs.get(p.shared).push(p)}
    edges=[];for(const ps of gs.values())edges.push(...computeEdges(ps,{x:D[0],y:D[1],z:D[2]},true))}
  else edges=computeEdges(src.polys,{x:D[0],y:D[1],z:D[2]},true);
  const vis=[],hid=[];
  for(const s of edges){
    const a1=dot3(s.a,R),b1=dot3(s.a,U),a2=dot3(s.b,R),b2=dot3(s.b,U);
    const pl=Math.hypot(a2-a1,b2-b1);if(pl<1e-4)continue;
    const N=Math.min(400,Math.max(1,Math.ceil(pl/pix/1.5)));
    let cls=new Uint8Array(N);
    for(let i=0;i<N;i++){const t=(i+.5)/N;cls[i]=isVis(s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t,s.a[2]+(s.b[2]-s.a[2])*t)?1:0}
    if(N>=3){const c2=cls.slice();for(let i=1;i<N-1;i++)c2[i]=(cls[i-1]+cls[i]+cls[i+1])>=2?1:0;cls=c2}
    // kenar imzası (iki yanındaki yüzeylerin özelliği ve normali): model değişince elle ölçü aynı kenarı bulur
    const sg=edgeSig(s);
    let st=0;
    for(let i=1;i<=N;i++){if(i===N||cls[i]!==cls[st]){const t0=st/N,t1=i/N;(cls[st]?vis:hid).push([a1+(a2-a1)*t0,b1+(b2-b1)*t0,a1+(a2-a1)*t1,b1+(b2-b1)*t1,s.pa?s.pa.shared:null,sg]);st=i}}
  }
  // yaylar (radyus, kanal ucu, yandan görülmeyen daire kenarları): kirişleri tek eğri sayılır, yarıçapı ölçülür
  const arcs=key==='iso'?[]:viewArcs(vis.concat(hid));
  const circ=[],axRaw=[],threads=[],cyls=[],ecyl=[];
  for(const an of src.ann){
    const A=[an.A.x,an.A.y,an.A.z],C=[an.C.x,an.C.y,an.C.z];const dd=dot3(A,D);
    /* eksen kimliği (özellikten ve eksen boyundaki konumdan bağımsız): aynı eksendeki aynı çap bir kez ölçülür (milin yaka çapı
       ön görünüşte Ø50 yazılınca uç görünüşte yeniden Ø50 yazılıyordu); zincir ölçü yalnızca aynı eksendeki kademelere verilir */
    const ax=axisKey(A,C),gk=an.r.toFixed(3)+'@'+ax;
    if(an.thread){const th=an.thread;if(Math.abs(dd)>.99)threads.push({t:'arc',a:dot3(C,R),b:dot3(C,U),R:th.R});else if(Math.abs(dd)<.02){const P0=[C[0]+A[0]*th.t0,C[1]+A[1]*th.t0,C[2]+A[2]*th.t0],P1=[C[0]+A[0]*th.t1,C[1]+A[1]*th.t1,C[2]+A[2]*th.t1];const a0=dot3(P0,R),b0=dot3(P0,U),a1=dot3(P1,R),b1=dot3(P1,U);const L=Math.hypot(a1-a0,b1-b0)||1;const nx=-(b1-b0)/L,ny=(a1-a0)/L;for(const sg of [1,-1])threads.push({t:'line',s:[a0+nx*th.R*sg,b0+ny*th.R*sg,a1+nx*th.R*sg,b1+ny*th.R*sg]})}}
    // görünüşten bağımsız daire anahtarı: yandan görülen silindir, uç görünüşteki dairesiyle eşleşir
    const ck=an.gid+'_'+an.r.toFixed(3)+'_'+C.map(x=>x.toFixed(2)).join(',')+'_'+A.map(x=>Math.abs(x).toFixed(3)).join(',');
    if(Math.abs(dd)>.99)circ.push({a:dot3(C,R),b:dot3(C,U),r:an.r,gid:an.gid,op:an.op,label:an.label,txt:an.txt,call:an.call,ck,gk});
    else if(Math.abs(dd)<.02){const at=t=>[C[0]+A[0]*t,C[1]+A[1]*t,C[2]+A[2]*t];const P0=at(an.t0),P1=at(an.t1);axRaw.push([dot3(P0,R),dot3(P0,U),dot3(P1,R),dot3(P1,U)]);
      if(an.cyl){const S0=at(an.s0!==undefined?an.s0:an.t0),S1=at(an.s1!==undefined?an.s1:an.t1);
        cyls.push({a0:dot3(P0,R),b0:dot3(P0,U),a1:dot3(P1,R),b1:dot3(P1,U),sa0:dot3(S0,R),sb0:dot3(S0,U),sa1:dot3(S1,R),sb1:dot3(S1,U),r:an.r,ck,gk,ax,id:an.gid+'_'+an.r.toFixed(3)+'_'+Math.round(dot3(C,R)+dot3(C,U)+an.t0)})}
      // yandan görülen ekstrüzyon silindiri (disk, göbek): genel ölçü onun çapıysa Ø ile yazılır
      else if(an.label&&an.op!=='cut')ecyl.push({a0:dot3(P0,R),b0:dot3(P0,U),a1:dot3(P1,R),b1:dot3(P1,U),r:an.r,ck,gk})}
  }
  const mm=new Map();for(const q of circ){const k=Math.round(q.a*100)+'_'+Math.round(q.b*100);const o=mm.get(k);if(!o||o.r<q.r)mm.set(k,{a:q.a,b:q.b,r:q.r,g:circKey(q.gid)})}
  const lines=new Map();
  for(const s of axRaw){
    let dx=s[2]-s[0],dy=s[3]-s[1];const l=Math.hypot(dx,dy);if(l<1e-6)continue;dx/=l;dy/=l;
    if(dx<-1e-6||(Math.abs(dx)<=1e-6&&dy<0)){dx=-dx;dy=-dy}
    const off=-dy*s[0]+dx*s[1];const t0=dx*s[0]+dy*s[1],t1=dx*s[2]+dy*s[3];
    const k=Math.round(dx*1000)+'_'+Math.round(dy*1000)+'_'+Math.round(off*100);
    const o=lines.get(k);const lo=Math.min(t0,t1),hi=Math.max(t0,t1);
    if(o){o.lo=Math.min(o.lo,lo);o.hi=Math.max(o.hi,hi)}else lines.set(k,{dx,dy,off,lo,hi});
  }
  const axes=[...lines.values()].map(o=>{const px=-o.dy*o.off,py=o.dx*o.off;return [px+o.dx*o.lo,py+o.dy*o.lo,px+o.dx*o.hi,py+o.dy*o.hi]});
  const secPolys=src.sec?src.polys.filter(p=>String(p.shared).startsWith('SEC')).map(p=>({g:String(p.shared),pts:p.verts.map(v=>[v.x*R[0]+v.y*R[1]+v.z*R[2],v.x*U[0]+v.y*U[1]+v.z*U[2]])})):[];
  // merkez işareti kolları parçanın görünüşteki sınırında kalır (kısmi döndürmede, ör. dirsekte, kollar kağıttan taşıyordu)
  const marks=[...mm.values()].map(q=>({...q,a0:Math.max(q.a-q.r,mnA),a1:Math.min(q.a+q.r,mxA),b0:Math.max(q.b-q.r,mnB),b1:Math.min(q.b+q.r,mxB)}));
  // side: yandan görülen bütün silindirler (eksen a0, b0, a1, b1, yarıçap): elle ölçüde silüet kenarları arası çap (Ø) olur
  const side=[];for(const an of src.ann){const A=[an.A.x,an.A.y,an.A.z],C=[an.C.x,an.C.y,an.C.z];if(Math.abs(dot3(A,D))>=.02||!(an.r>0))continue;
    const at=t=>[C[0]+A[0]*t,C[1]+A[1]*t,C[2]+A[2]*t],P0=at(an.t0),P1=at(an.t1);side.push([dot3(P0,R),dot3(P0,U),dot3(P1,R),dot3(P1,U),an.r])}
  const res={vis,hid,bb:{minA:mnA,maxA:mxA,minB:mnB,maxB:mxB},circ,marks,axes,threads,secPolys,cyls,ecyl,arcs,side};
  vcache.m.set(ck,res);if(vcache.m.size>40)vcache.m.delete(vcache.m.keys().next().value);return res;
}

const SHEET_CSS=`.d-vis{fill:none;stroke:#000;stroke-width:.5;stroke-linecap:round;stroke-linejoin:round}.d-hid{fill:none;stroke:#000;stroke-width:.25;stroke-dasharray:2.2 1.1}.d-cen{fill:none;stroke:#000;stroke-width:.18;stroke-dasharray:7 1.1 .8 1.1}.d-thin{fill:none;stroke:#000;stroke-width:.18}.d-frame{fill:none;stroke:#000;stroke-width:.7}.d-tb{fill:none;stroke:#000;stroke-width:.35}.d-ar{fill:#000;stroke:none}.d-t{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#000}.d-l{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#555}`;
const Lp=(x1,y1,x2,y2)=>`M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
/* kesikli çizgi yolu: kesik deseni her alt yolun başında yeniden başlar. Gizli eğriler (delik dairesi) kısa kirişlerden,
   yandan görülen daire kenarları üst üste binen parçalardan oluştuğu için her parça bir çizgiyle başlıyor, çizgi düz
   görünüyordu. Aynı doğru üzerindeki çakışan/bitişik parçalar birleştirilir, uç uca gelenler tek çoklu çizgi olur. */
function chainPath(segs){
  const E=0.01,lines=new Map(),rest=[];
  for(const q of segs){let dx=q[2]-q[0],dy=q[3]-q[1];const l=Math.hypot(dx,dy);if(l<1e-6)continue;dx/=l;dy/=l;
    if(dx<-1e-9||(Math.abs(dx)<=1e-9&&dy<0)){dx=-dx;dy=-dy}
    const off=-dy*q[0]+dx*q[1],t0=dx*q[0]+dy*q[1],t1=dx*q[2]+dy*q[3];
    const k=Math.round(dx*2000)+'_'+Math.round(dy*2000)+'_'+Math.round(off/E);
    let g=lines.get(k);if(!g)lines.set(k,g={dx,dy,off,iv:[]});g.iv.push([Math.min(t0,t1),Math.max(t0,t1)])}
  for(const g of lines.values()){g.iv.sort((a,b)=>a[0]-b[0]);let cur=null;
    const P=t=>[-g.dy*g.off+g.dx*t,g.dx*g.off+g.dy*t];
    for(const iv of g.iv.concat([null])){if(cur&&iv&&iv[0]<=cur[1]+E){cur[1]=Math.max(cur[1],iv[1]);continue}if(cur){const a=P(cur[0]),b=P(cur[1]);rest.push([a[0],a[1],b[0],b[1]])}cur=iv&&iv.slice()}}
  // uç uca zincirleme
  const K=(x,y)=>Math.round(x/E)+'_'+Math.round(y/E),at=new Map(),used=new Uint8Array(rest.length);
  rest.forEach((q,i)=>{for(const k of [K(q[0],q[1]),K(q[2],q[3])]){if(!at.has(k))at.set(k,[]);at.get(k).push(i)}});
  const next=(k)=>{for(const i of at.get(k)||[])if(!used[i])return i;return -1};
  let p='';
  // önce açık uçlardan (tek parçanın bittiği köşe) başlanır, kalanlar kapalı halkadır
  const order=[...rest.keys()].sort((i,j)=>{const d=q=>Math.min((at.get(K(q[0],q[1]))||[]).length,(at.get(K(q[2],q[3]))||[]).length);return d(rest[i])-d(rest[j])});
  for(const i0 of order){if(used[i0])continue;used[i0]=1;const q=rest[i0];
    let pts=[[q[0],q[1]],[q[2],q[3]]];
    for(let dir=0;dir<2;dir++){
      for(;;){const e=pts[pts.length-1],k=K(e[0],e[1]);const j=next(k);if(j<0)break;used[j]=1;const r=rest[j];
        pts.push(K(r[0],r[1])===k?[r[2],r[3]]:[r[0],r[1]])}
      pts.reverse();
    }
    p+=`M${f2(pts[0][0])} ${f2(pts[0][1])}`+pts.slice(1).map(x=>`L${f2(x[0])} ${f2(x[1])}`).join('');
  }
  return p;
}
/* merkez işaretleri: kolların uçları 2,5 mm taşar */
function markSegs(marks,map){const out=[];
  for(const mk of marks)for(const [p,q] of [[[mk.a0,mk.b],[mk.a1,mk.b]],[[mk.a,mk.b0],[mk.a,mk.b1]]]){
    if(!(Math.hypot(q[0]-p[0],q[1]-p[1])>1e-6))continue;const A=map(p[0],p[1]),B=map(q[0],q[1]);const l=Math.hypot(B[0]-A[0],B[1]-A[1])||1,ux=(B[0]-A[0])/l,uy=(B[1]-A[1])/l;
    out.push([A[0]-ux*2.5,A[1]-uy*2.5,B[0]+ux*2.5,B[1]+uy*2.5])}
  return out}
function arrow(Q,ux,uy){const bx=Q[0]-ux*3,by=Q[1]-uy*3,px=-uy*.55,py=ux*.55;return `<path class="d-ar" d="M${f2(Q[0])} ${f2(Q[1])}L${f2(bx+px)} ${f2(by+py)}L${f2(bx-px)} ${f2(by-py)}Z"/>`}
function dimMarkup(P1,P2,Q1,Q2,txt,tol){
  // yardımcı çizgi ölçülen noktadan başlar (geometriye değer), ölçü çizgisini 2 mm geçer
  const ext=(P,Q)=>{const dx=Q[0]-P[0],dy=Q[1]-P[1],l=Math.hypot(dx,dy);if(l<1e-3)return '';const ux=dx/l,uy=dy/l;return Lp(P[0],P[1],Q[0]+ux*2,Q[1]+uy*2)};
  const dx=Q2[0]-Q1[0],dy=Q2[1]-Q1[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
  let ang=Math.atan2(dy,dx)*180/Math.PI;if(ang>=90)ang-=180;if(ang<-90)ang+=180;
  const r=ang*Math.PI/180,upx=Math.sin(r),upy=-Math.cos(r);
  if(tol&&tol.tt!=='dev')txt=tolText(txt,tol);
  const tw=tol&&tol.tt==='dev'?txt.length*1.72+6:textWidth(txt,3.5);
  const boxAt=(mx,my)=>{const c=Math.abs(Math.cos(r)),sn=Math.abs(Math.sin(r)),hw=tw/2+.6,hh=2.3,bx=mx+upx*1.2,by=my+upy*1.2;
    return [bx-(c*hw+sn*hh),by-(sn*hw+c*hh),bx+(c*hw+sn*hh),by+(sn*hw+c*hh)]};
  /* harflerin kutusu (taban çizgisinden yukarı): ISO 129-1'e göre ölçü yazısını hiçbir çizgi kesmemeli. Eksen çizgisi (milin
     profil içi çapları), gizli çizgi, görünür kenar ya da başka ölçünün uzatma/ölçü çizgisi keserse yazı kayar */
  const glyphAt=(mx,my)=>{const c=Math.abs(Math.cos(r)),sn=Math.abs(Math.sin(r)),hw=tw/2+.6,hh=1.4,bx=mx+upx*1.3,by=my+upy*1.3;
    return [bx-(c*hw+sn*hh),by-(sn*hw+c*hh),bx+(c*hw+sn*hh),by+(sn*hw+c*hh)]};
  const crossed=G=>lineHits(G);
  /* yazı oklar arasına sığmıyorsa (dar kademe, kısa zincir ölçü) SolidWorks gibi oklar dışarıdan gösterir, yazı ölçü çizgisinin
     uzantısında boş olan yana (önce başa: zincirde öncekiler yerleşmiştir) konur; önceden yan yana iki dar ölçünün yazıları üst üste biniyordu */
  let sh=0,lift=0,narrow=tw+1.5>l;
  const d0=l/2+2+tw/2+.6,free=([t,h])=>{const mx=(Q1[0]+Q2[0])/2+ux*t+upx*(1.1+h),my=(Q1[1]+Q2[1])/2+uy*t+upy*(1.1+h),B=boxAt(mx,my);return (!occ||!occ.some(b=>boxOv(B,b)>0.05))&&!crossed(glyphAt(mx,my))};
  // yanlar doluysa (zincirde iki dar kademe yan yana) yazı bir satır yukarı alınır
  const outs=[[-d0,0],[d0,0],[0,5],[-d0,5],[d0,5]];
  if(narrow)[sh,lift]=outs.find(free)||outs[1];
  /* yazı sığıyor ama ortası dolu (ör. kesit çizgisinin ucu, oku ve harfi genel ölçünün tam ortasından geçiyor ya da eksen çizgisi
     yazıyı kesiyor): yazı ölçü çizgisi boyunca oklar arasında boş bir yere, en az kayacak şekilde kayar; önceden “120” kesit
     çizgisinin altında kalıyor, milin profil içi çaplarını (Ø25, Ø35…) eksen çizgisi ortasından kesiyordu. Oklar arasında boş yer
     yoksa (1:2 ölçekte Ø25 kademe yazıdan ancak iki kat uzun) oklar dışarıdan gösterir, yazı ölçü çizgisinin uzantısına konur */
  else if(occ){const cx=(Q1[0]+Q2[0])/2,cy=(Q1[1]+Q2[1])/2,A=t=>[cx+ux*t+upx*1.1,cy+uy*t+upy*1.1];
    const busy=t=>{const [x,y]=A(t),B=boxAt(x,y);return occ.some(b=>boxOv(B,b)>0.05)||crossed(glyphAt(x,y))};
    if(busy(0)){const lim=l/2-tw/2-.8,st=Math.max(.5,lim/24);let ok=false;
      for(let t=st;t<=lim+1e-9;t+=st){if(!busy(-t)){sh=-t;ok=true;break}if(!busy(t)){sh=t;ok=true;break}}
      if(!ok&&lineHits(glyphAt(...A(0)))){const c=outs.slice(0,2).find(free);if(c){[sh,lift]=c;narrow=true}}}}
  const mx=(Q1[0]+Q2[0])/2+ux*sh+upx*(1.1+lift),my=(Q1[1]+Q2[1])/2+uy*sh+upy*(1.1+lift);
  let s;pushSegs([P1[0],P1[1],Q1[0],Q1[1]],[P2[0],P2[1],Q2[0],Q2[1]]);
  if(!narrow){pushSegs([Q1[0],Q1[1],Q2[0],Q2[1]]);s=`<path class="d-thin" d="${ext(P1,Q1)}${ext(P2,Q2)}${Lp(Q1[0],Q1[1],Q2[0],Q2[1])}"/>`+arrow(Q1,-ux,-uy)+arrow(Q2,ux,uy)}
  else{const e1=sh<0&&!lift?tw+3.2:3.5,e2=sh>0&&!lift?tw+3.2:3.5;pushSegs([Q1[0]-ux*e1,Q1[1]-uy*e1,Q2[0]+ux*e2,Q2[1]+uy*e2]);
    s=`<path class="d-thin" d="${ext(P1,Q1)}${ext(P2,Q2)}${Lp(Q1[0]-ux*e1,Q1[1]-uy*e1,Q2[0]+ux*e2,Q2[1]+uy*e2)}"/>`+arrow(Q1,ux,uy)+arrow(Q2,-ux,-uy)}
  lastBox=boxAt(mx,my);if(occ)occ.push(lastBox);
  if(tol&&tol.tt==='dev'){
    const sgn=v=>{const n=num(v);if(!isFinite(n)||n===0)return '0';return (n>0?'+':'−')+fmt(Math.abs(n),3)};
    const up=sgn(tol.tu),lo=sgn(tol.tl);const wm=txt.length*1.72,wd=Math.max(up.length,lo.length)*1.25+.6,tot=wm+wd;
    const c=Math.cos(r),sn=Math.sin(r);const L=(lx,ly)=>[mx+lx*c-ly*sn,my+lx*sn+ly*c];
    const T_=(lx,ly,t,fs)=>{const [x,y]=L(lx,ly);return `<text class="d-t" x="${f2(x)}" y="${f2(y)}" font-size="${fs}" transform="rotate(${f2(ang)} ${f2(x)} ${f2(y)})">${esc(t)}</text>`};
    return s+T_(-tot/2,0,txt,3.5)+T_(-tot/2+wm+.4,-1.7,up,2.4)+T_(-tot/2+wm+.4,.4,lo,2.4);
  }
  return s+`<text class="d-t" x="${f2(mx)}" y="${f2(my)}" font-size="3.5" text-anchor="middle" transform="rotate(${f2(ang)} ${f2(mx)} ${f2(my)})">${esc(txt)}</text>`;
}
/* ölçü metni kutuları: etiketlerin çakışmasını önlemek (occ) ve seçim (lastBox) için */
let occ=null,lastBox=null;
/* ölçü ve kılavuz çizgileri (sayfa mm): balonlar bunların üstüne konmaz (önceden yalnızca ölçü yazılarından kaçıyordu) */
let dimSegs=null;const pushSegs=(...L)=>{if(dimSegs)for(const q of L)if(q)dimSegs.push(q)};
/* görünüşlerin çizgileri (sayfa mm): görünür (geo) ve gizli/eksen (soft). Ölçü yazıları ve etiketler bunların üstüne konmaz */
let occLn=null;
/* doğru parçaları için ızgara dizini (sayfa mm): kutu sorguları yalnızca yakındaki parçalara bakar. Yazı ve etiket yerleri
   yüzlerce aday için binlerce kenara bakıyordu; resim çizimi (buildSheet) ızgarasız 1,5–2 kat yavaşlamıştı */
function segGrid(list,cell){cell=cell||8;const m=new Map(),key=(i,j)=>i*100003+j,cl=x=>Math.floor(x/cell);
  list.forEach((g,n)=>{const i1=cl(Math.max(g[0],g[2])),j0=cl(Math.min(g[1],g[3])),j1=cl(Math.max(g[1],g[3]));
    for(let i=cl(Math.min(g[0],g[2]));i<=i1;i++)for(let j=j0;j<=j1;j++){const k=key(i,j);let L=m.get(k);if(!L)m.set(k,L=[]);L.push(n)}});
  let stamp=0;const seen=new Uint32Array(list.length);
  return {near(B){stamp++;const out=[],i1=cl(B[2]),j0=cl(B[1]),j1=cl(B[3]);
    for(let i=cl(B[0]);i<=i1;i++)for(let j=j0;j<=j1;j++){const L=m.get(key(i,j));if(L)for(const n of L)if(seen[n]!==stamp){seen[n]=stamp;out.push(list[n])}}
    return out}}}
const segBox=g=>[Math.min(g[0],g[2]),Math.min(g[1],g[3]),Math.max(g[0],g[2]),Math.max(g[1],g[3])];
function lineHits(B){
  if(occLn)for(const G of [occLn.geoG,occLn.softG])for(const g of G.near(B))if(segHitsBox(g[0],g[1],g[2],g[3],B))return true;
  if(dimSegs)for(const g of dimSegs)if(segHitsBox(g[0],g[1],g[2],g[3],B))return true;
  return false;
}
/* iki doğru parçası kesişiyor mu; ilk parçanın baş ucu (kılavuzun oku: dairenin üstü) sayılmaz */
function segCross(p,q){
  const rx=p[2]-p[0],ry=p[3]-p[1],sx=q[2]-q[0],sy=q[3]-q[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-12)return false;
  const qpx=q[0]-p[0],qpy=q[1]-p[1],t=(qpx*sy-qpy*sx)/den,u=(qpx*ry-qpy*rx)/den;
  return t>0.04&&t<=1&&u>=0&&u<=1;
}
function tolText(txt,tol){
  if(!tol)return txt;
  if(tol.tt==='sym'&&isFinite(num(tol.tu)))return txt+' ±'+fmt(num(tol.tu),3);
  if(tol.tt==='fit'&&tol.tf)return txt+' '+tol.tf;
  if(tol.tt==='dev'){const sgn=v=>{const n=num(v);if(!isFinite(n)||n===0)return '0';return (n>0?'+':'−')+fmt(Math.abs(n),3)};return txt+' '+sgn(tol.tu)+'/'+sgn(tol.tl)}
  return txt;
}
/* SolidWorks delik etiketi simgeleri: ↧ derinlik, ⌴ fatura, ⌵ havşa. PDF ve DXF'te de çıksın diye çizgiyle çizilir. */
const SYMS='↧⌴⌵';
function symRuns(t){const out=[];let cur='';for(const ch of String(t)){if(SYMS.includes(ch)){if(cur)out.push({t:cur});cur='';out.push({s:ch})}else cur+=ch}if(cur)out.push({t:cur});return out}
const symW=fs=>fs*.8;
function textWidth(t,fs){let w=0;for(const r of symRuns(t))w+=r.s?symW(fs):textW(r.t,fs)*TZ/100;return w}
function symPath(ch,x,y,fs){
  const h=fs*.66,w=fs*.58;x+=fs*.11;
  if(ch==='⌴')return Lp(x,y-h,x,y)+Lp(x,y,x+w,y)+Lp(x+w,y,x+w,y-h);
  if(ch==='⌵')return Lp(x,y-h,x+w/2,y)+Lp(x+w/2,y,x+w,y-h);
  const m=x+w/2;return Lp(m,y-h,m,y)+Lp(m-w*.32,y-h*.4,m,y)+Lp(m,y,m+w*.32,y-h*.4)+Lp(x,y,x+w,y);
}
function symText(x,y,t,fs,anchor){
  const runs=symRuns(t);
  if(!runs.some(r=>r.s))return `<text class="d-t" x="${f2(x)}" y="${f2(y)}" font-size="${fs}"${anchor&&anchor!=='start'?` text-anchor="${anchor}"`:''}>${esc(t)}</text>`;
  const w=textWidth(t,fs);let cx=anchor==='middle'?x-w/2:anchor==='end'?x-w:x;let o='',p='';
  for(const r of runs){if(r.s){p+=symPath(r.s,cx,y,fs);cx+=symW(fs)}else{o+=`<text class="d-t" x="${f2(cx)}" y="${f2(y)}" font-size="${fs}">${esc(r.t)}</text>`;cx+=textW(r.t,fs)*TZ/100}}
  return o+`<path class="d-thin" style="stroke-width:.25" d="${p}"/>`;
}
/* kılavuz çizgili etiket: C daire merkezi, R yarıçap (sayfa mm), K yazı omzu; birden çok satır (delik etiketi) üst üste yazılır */
function leaderM(C,R,lines,K,U){
  /* U verilirse ok dairenin U yönündeki noktasına değer ve yazı merkez tarafında olabilir (iç bükey radyus: kılavuz yayın
     merkezinden gelir, ok yaya içeriden değer; ISO 129-1). Verilmezse kılavuz merkezden yazıya doğru, ok dışarıdan */
  const dx=K[0]-C[0],dy=K[1]-C[1],l=Math.hypot(dx,dy)||1,ux=U?U[0]:dx/l,uy=U?U[1]:dy/l;const P=[C[0]+ux*R,C[1]+uy*R];
  const ex=P[0]-K[0],ey=P[1]-K[1],el=Math.hypot(ex,ey)||1;
  const right=K[0]-P[0]>=-1e-9,sh=right?1:-1;const tw=Math.max(...lines.map(t=>textWidth(t,3.5)))+1.2;const n=lines.length;
  const segs=[[P[0],P[1],K[0],K[1]],[K[0],K[1],K[0]+sh*tw,K[1]]];  // seçilen konumda pushSegs ile kaydedilir (adaylar değil)
  let m=`<path class="d-thin" d="${Lp(P[0],P[1],K[0],K[1])}${Lp(K[0],K[1],K[0]+sh*tw,K[1])}"/>`+arrow(P,ex/el,ey/el);
  lines.forEach((t,i)=>{m+=symText(K[0]+sh*.6,K[1]-.9-(n-1-i)*4.6,t,3.5,right?'start':'end')});
  const box=[right?K[0]:K[0]-tw,K[1]-.9-(n-1)*4.6-3.2,right?K[0]+tw:K[0],K[1]+.6];
  return {m,box,K,C,segs};
}
function segHitsBox(x1,y1,x2,y2,B){
  if(Math.max(x1,x2)<B[0]||Math.min(x1,x2)>B[2]||Math.max(y1,y2)<B[1]||Math.min(y1,y2)>B[3])return false;
  let t0=0,t1=1;const dx=x2-x1,dy=y2-y1;
  for(const [p,q] of [[-dx,x1-B[0]],[dx,B[2]-x1],[-dy,y1-B[1]],[dy,B[3]-y1]]){if(Math.abs(p)<1e-12){if(q<0)return false;continue}const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r}else{if(r<t0)return false;if(r<t1)t1=r}}
  return t0<=t1;
}
const boxOv=(a,b)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
const STD_SCALES=[10,5,2,1,.5,.2,.1,.05,.02,.01];
const scaleLabel=s=>s>=1?`${fmt(s,3)}:1`:`1:${fmt(1/s,3)}`;
/* ölçek seçenekleri; listede olmayan (elle girilmiş) değer kendi etiketiyle eklenir, sonda “Özel…” */
const SCALE_PRESETS=[['auto','Otomatik'],['10','10:1'],['5','5:1'],['2','2:1'],['1','1:1'],['0.5','1:2'],['0.2','1:5'],['0.1','1:10'],['0.05','1:20']];
function scaleOpts(val){const o=SCALE_PRESETS.slice();if(!o.some(([k])=>k===String(val))&&+val>0)o.push([String(val),scaleLabel(+val)]);o.push(['custom','Özel…']);return o}
/* elle girilen ölçek: “1:2,5”, “3:1”, “1/25” veya çarpan (0,4) */
function parseScale(t){
  t=String(t||'').trim().replace(/\s+/g,'');const m=t.match(/^([^:/]+)[:/]([^:/]+)$/);
  const v=m?num(m[1])/num(m[2]):num(t);return isFinite(v)&&v>=0.001&&v<=1000?Math.round(v*1e9)/1e9:null;
}
/* açı ölçüsü: v köşe, u1/u2 kenar yönleri (görünüş koordinatı), rr yay yarıçapı (model mm), e1/e2 kenarların köşeden uzaklığı */
function angDeg(d){return Math.acos(Math.max(-1,Math.min(1,d.u1[0]*d.u2[0]+d.u1[1]*d.u2[1])))*180/Math.PI}
/* yardımcı (referans) ölçü parantez içinde yazılır (SolidWorks: Parantez); toleransı yazılmaz */
const parTxt=(d,t)=>d.par?'('+t+')':t;
function dimLabel(d,v){
  if(d.kind==='ang')return parTxt(d,fmt(angDeg(d),1)+'°');
  if(d.kind==='dia'){if(d.hc)return hcLines(d,v).join(' ');const rd=dimRad(d);return parTxt(d,(d.pre||(rd?'R':'Ø'))+fmt(rd?d.r:2*d.r))}
  return parTxt(d,(d.pre||'')+fmt(dimGeom(d,v).val));
}
const dimTol=d=>d.par?null:d;
function dimRender(d,v){
  if(d.kind==='dia'){const C=v.map(d.c[0],d.c[1]);const off=d.off||[12,-12];const r=leaderM(C,d.r*v.s,d.hc?hcLines(d,v):[tolText(dimLabel(d,v),dimTol(d))],[C[0]+off[0],C[1]+off[1]]);lastBox=r.box;if(occ)occ.push(r.box);pushSegs(...r.segs);
    // yayın dışına yazılan yarıçap: yay uzantısı (ince) kılavuzun değdiği yere kadar
    const ex=d.arc?arcExtPath(d,v,Math.atan2(-off[1],off[0])):'';return ex?r.m+`<path class="d-thin" d="${ex}"/>`:r.m}
  if(d.kind==='ang'){
    const V=v.map(d.v[0],d.v[1]),rr=d.rr*v.s;const a1=Math.atan2(-d.u1[1],d.u1[0]),cr=d.u1[0]*d.u2[1]-d.u1[1]*d.u2[0],sw=-Math.sign(cr||1)*angDeg(d)*Math.PI/180;
    const pt=t=>[V[0]+rr*Math.cos(t),V[1]+rr*Math.sin(t)];let path='';const N=Math.max(6,Math.ceil(Math.abs(sw)/(Math.PI/36)));
    for(let i=0;i<N;i++){const A=pt(a1+sw*i/N),B=pt(a1+sw*(i+1)/N);path+=Lp(A[0],A[1],B[0],B[1])}
    for(const [u,e] of [[d.u1,d.e1],[d.u2,d.e2]]){const ux=u[0],uy=-u[1];const L=(e||0)*v.s;if(rr>L)path+=Lp(V[0]+ux*L,V[1]+uy*L,V[0]+ux*(rr+1.5),V[1]+uy*(rr+1.5))}
    const a2=a1+sw,sg=Math.sign(sw);const P1=pt(a1),P2=pt(a2);
    let m=`<path class="d-thin" d="${path}"/>`+arrow(P1,sg*Math.sin(a1),-sg*Math.cos(a1))+arrow(P2,-sg*Math.sin(a2),sg*Math.cos(a2));
    const am=a1+sw/2,T=[V[0]+(rr+3.2)*Math.cos(am),V[1]+(rr+3.2)*Math.sin(am)+1.2];const txt=tolText(dimLabel(d,v),dimTol(d));const w=textWidth(txt,3.5);
    m+=`<text class="d-t" x="${f2(T[0])}" y="${f2(T[1])}" font-size="3.5" text-anchor="middle">${esc(txt)}</text>`;
    lastBox=[T[0]-w/2-.5,T[1]-3,T[0]+w/2+.5,T[1]+.6];if(occ)occ.push(lastBox);return m;
  }
  const g=dimGeom(d,v);return dimMarkup(g.P1,g.P2,g.Q1,g.Q2,parTxt(d,(d.pre||'')+fmt(g.val)),dimTol(d));
}
function dimGeom(d,v){
  if(d.kind==='dia')return {val:dimRad(d)?d.r:2*d.r};
  if(d.kind==='ang')return {val:angDeg(d)};
  const [a1,b1]=d.p1,[a2,b2]=d.p2;const P1=v.map(a1,b1),P2=v.map(a2,b2);
  if(d.kind==='h'){const y=v.map(0,d.pos)[1];return {P1,P2,Q1:[P1[0],y],Q2:[P2[0],y],val:Math.abs(a2-a1)}}
  if(d.kind==='v'){const x=v.map(d.pos,0)[0];return {P1,P2,Q1:[x,P1[1]],Q2:[x,P2[1]],val:Math.abs(b2-b1)}}
  /* n: ölçü yönü (eğik kenara dik uzaklık); uçlar n'ye dik kaymış olabilir, ölçü çizgisi n'ye paralel. Yoksa iki uç arası */
  if(d.n){const n=d.n,t=[-n[1],n[0]],w=(a2-a1)*t[0]+(b2-b1)*t[1];
    return {P1,P2,Q1:v.map(a1+t[0]*d.pos,b1+t[1]*d.pos),Q2:v.map(a2+t[0]*(d.pos-w),b2+t[1]*(d.pos-w)),val:Math.abs((a2-a1)*n[0]+(b2-b1)*n[1])}}
  const dx=a2-a1,dy=b2-b1,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
  return {P1,P2,Q1:v.map(a1+nx*d.pos,b1+ny*d.pos),Q2:v.map(a2+nx*d.pos,b2+ny*d.pos),val:l};
}
/* elle ölçü görünüşteki bir kenara/noktaya/daireye oturuyor mu (model değişince ölçü eski yerinde kalır) */
function dimStale(dm,d,sk){
  const e=1e-3,segs=sk?d.vis.concat(d.hid,sk.segs):d.vis.concat(d.hid),circ=sk?d.circ.concat(sk.circ):d.circ;
  const onPt=(a,b)=>segs.some(q=>Math.hypot(q[0]-a,q[1]-b)<e||Math.hypot(q[2]-a,q[3]-b)<e)||circ.some(c=>Math.hypot(c.a-a,c.b-b)<e);
  const onSeg=(a,b)=>segs.some(q=>{const dx=q[2]-q[0],dy=q[3]-q[1],l2=dx*dx+dy*dy;let t=l2?((a-q[0])*dx+(b-q[1])*dy)/l2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(q[0]+dx*t-a,q[1]+dy*t-b)<e})||circ.some(c=>Math.hypot(c.a-a,c.b-b)<e);
  if(dm.kind==='dia'){const same=c=>Math.hypot(c.a-dm.c[0],c.b-dm.c[1])<e&&Math.abs(c.r-dm.r)<e;return dm.arc?!(d.arcs||[]).some(same):!circ.some(same)&&!extraCircs(d).some(same)}
  if(dm.kind==='ang'){const onLine=u=>segs.some(q=>[[q[0],q[1]],[q[2],q[3]]].every(P=>Math.abs((P[0]-dm.v[0])*u[1]-(P[1]-dm.v[1])*u[0])<e)&&Math.hypot(q[2]-q[0],q[3]-q[1])>e);return !onLine(dm.u1)||!onLine(dm.u2)}
  // köşeye/merkeze bağlanan uç (at) köşede kalmalı; kenar üstündeki uç (ör. kenara dik ayak) kenarda
  const ok=(P,i)=>dm.at&&dm.at[i]?onPt(P[0],P[1]):onSeg(P[0],P[1]);
  return !ok(dm.p1,0)||!ok(dm.p2,1);
}
/* ölçü çizgisi görünüşün dışındaysa SolidWorks'teki gibi standart uzaklıklara yakalanır: görünüşten 9 mm, sonra 7 mm aralıkla
   (otomatik ölçülerle aynı sıralar; ISO 129-1'e göre ölçü çizgileri eşit aralıklı ve paralel). Yakalama ±1,8 mm (sayfada) */
function snapRow(pos,lo,hi,s){
  const out=pos<lo?lo-pos:pos>hi?pos-hi:-1;if(out<0||!(s>0))return pos;const d=out*s;const i=Math.max(0,Math.round((d-9)/7)),r=9+7*i;
  if(Math.abs(d-r)>1.8)return pos;return pos<lo?lo-r/s:hi+r/s;
}
function dimFromCursor(p1,p2,c,v){
  const [a1,b1]=p1,[a2,b2]=p2,[ca,cb]=c;const dx=a2-a1,dy=b2-b1;
  const mnA=Math.min(a1,a2),mxA=Math.max(a1,a2),mnB=Math.min(b1,b2),mxB=Math.max(b1,b2);let kind;
  if(Math.abs(dx)<1e-6)kind='v';else if(Math.abs(dy)<1e-6)kind='h';
  else{const oa=ca<mnA||ca>mxA,ob=cb<mnB||cb>mxB;
    if(ob&&!oa)kind='h';else if(oa&&!ob)kind='v';
    else if(oa&&ob)kind=Math.min(Math.abs(cb-mnB),Math.abs(cb-mxB))>Math.min(Math.abs(ca-mnA),Math.abs(ca-mxA))?'h':'v';
    else kind='a'}
  const bb=v&&v.d&&v.d.bb;
  if(kind==='h')return {kind,pos:bb?snapRow(cb,bb.minB,bb.maxB,v.s):cb};if(kind==='v')return {kind,pos:bb?snapRow(ca,bb.minA,bb.maxA,v.s):ca};
  const l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l;return {kind:'a',pos:(ca-a1)*nx+(cb-b1)*ny};
}
/* kenara dik ölçü (iki paralel kenar arası, noktadan kenara): ölçü yönü imleçle değişmez. Yatay kenar → dikey ölçü, dikey kenar →
   yatay ölçü, eğik kenar → kenara dik hizalı ölçü (fk.n). Önceden imleç yana götürülünce eğik kolun kalınlığı 10 yerine 6,14,
   noktadan eğik kenara uzaklık yatay bileşeniyle yazılıyordu */
function dimForced(p1,p2,fk,c,v){
  const bb=v&&v.d&&v.d.bb;
  if(fk.kind==='h')return {kind:'h',pos:bb?snapRow(c[1],bb.minB,bb.maxB,v.s):c[1]};
  if(fk.kind==='v')return {kind:'v',pos:bb?snapRow(c[0],bb.minA,bb.maxA,v.s):c[0]};
  const n=fk.n,t=[-n[1],n[0]];return {kind:'a',n:n.slice(),pos:(c[0]-p1[0])*t[0]+(c[1]-p1[1])*t[1]};
}
const dimPlace=(st,c,v)=>{const p1=[st.p1.a,st.p1.b],p2=[st.p2.a,st.p2.b];return st.fk?dimForced(p1,p2,st.fk,c,v):dimFromCursor(p1,p2,c,v)};
function projSymbol(cx,cy,method){
  let s='';const tz=(x0)=>`<path class="d-tb" d="M${f2(x0)} ${f2(cy-1.9)}L${f2(x0+8)} ${f2(cy-3.4)}L${f2(x0+8)} ${f2(cy+3.4)}L${f2(x0)} ${f2(cy+1.9)}Z"/>`;
  const ci=(x)=>`<circle class="d-tb" cx="${f2(x)}" cy="${f2(cy)}" r="1.9"/><circle class="d-tb" cx="${f2(x)}" cy="${f2(cy)}" r="3.4"/>`;
  if(method==='E')s=tz(cx-11)+ci(cx+5.5);else s=ci(cx-7.5)+tz(cx+1);
  return s+`<path class="d-cen" d="${Lp(cx-13,cy,cx+10,cy)}"/>`;
}
function titleBlock(x0,y0,info){
  let s=`<rect class="d-frame" x="${x0}" y="${y0}" width="180" height="36"/>`;
  s+=`<path class="d-tb" d="${Lp(x0+62,y0,x0+62,y0+36)}${Lp(x0+140,y0,x0+140,y0+36)}${Lp(x0+18,y0,x0+18,y0+36)}${Lp(x0,y0+9,x0+62,y0+9)}${Lp(x0,y0+18,x0+62,y0+18)}${Lp(x0,y0+27,x0+62,y0+27)}${Lp(x0+62,y0+20,x0+140,y0+20)}${Lp(x0+101,y0+20,x0+101,y0+36)}${Lp(x0+140,y0+12,x0+180,y0+12)}${Lp(x0+140,y0+24,x0+180,y0+24)}"/>`;
  const lab=(x,y,t)=>`<text class="d-l" x="${f2(x)}" y="${f2(y)}" font-size="2">${esc(t)}</text>`;
  const val=(x,y,t,fs=3,anchor='start')=>`<text class="d-t" x="${f2(x)}" y="${f2(y)}" font-size="${fs}" text-anchor="${anchor}">${esc(t)}</text>`;
  [['Çizen',info.drawn],['Kontrol',info.checked],['Tarih',info.date],['Malzeme',info.mat]].forEach(([l,v],i)=>{s+=lab(x0+1.5,y0+i*9+5.6,l)+val(x0+20,y0+i*9+6.2,v||'',v&&v.length>22?2.3:2.9)});
  s+=lab(x0+64,y0+3.4,'Parça adı');
  const pn=info.part||'';s+=val(x0+101,y0+13.6,pn,pn.length>24?3.6:5,'middle');
  if(info.company)s+=`<text class="d-l" x="${f2(x0+138.5)}" y="${f2(y0+3.4)}" font-size="2" text-anchor="end">${esc(info.company)}</text>`;
  s+=lab(x0+64,y0+23.4,'Resim no')+val(x0+64,y0+31.5,info.dno||'',3.4);
  s+=lab(x0+103,y0+23.4,'Kütle')+val(x0+103,y0+31.5,info.mass||'',3.4);
  s+=lab(x0+142,y0+3.4,'Ölçek')+val(x0+160,y0+10,info.scale,4,'middle');
  s+=projSymbol(x0+160,y0+18,info.method);
  s+=lab(x0+142,y0+27.4,'Kağıt '+info.paper)+val(x0+178,y0+33.4,'Sayfa 1/1',2.6,'end');
  // genel not antetin (montajda parça listesinin) üstünde, sağa hizalı: dikey A4'te antet çerçeve genişliğindedir, solunda yer yoktur;
  // yatay sayfalarda da alt kenarın orta işaretine binmez
  s+=`<text class="d-l" x="${f2(x0+178.5)}" y="${f2(y0-(info.bomRows||0)*6-1.5)}" font-size="2.4" text-anchor="end">Ölçüler mm. Belirtilmeyen toleranslar ISO 2768-m.</text>`;
  return s;
}
function paperWH(key,orient){const P=PAPERS[key]||PAPERS.A3;return orient==='portrait'?{W:P.H,H:P.W}:{W:P.W,H:P.H}}
/* düzenler: full (çerçeve ve antet), frame (çerçeve, antetsiz), min (parça adı ve ölçek), none (yalnızca parça) */
function areaFor(W,H,layout){if(layout==='min')return [12,12,W-12,H-24];if(layout==='none')return [8,8,W-8,H-8];if(layout==='frame')return [24,14,W-14,H-14];return [24,14,W-14,H-56]}
function frameMarkup(W,H,layout){
  if(layout!=='full'&&layout!=='frame')return '';
  const fx0=20,fy0=10,fx1=W-10,fy1=H-10;
  return `<rect class="d-frame" x="${fx0}" y="${fy0}" width="${fx1-fx0}" height="${fy1-fy0}"/>`+
    `<path class="d-frame" d="${Lp((fx0+fx1)/2,fy0-5,(fx0+fx1)/2,fy0+5)}${Lp((fx0+fx1)/2,fy1-5,(fx0+fx1)/2,fy1+5)}${Lp(fx0-5,(fy0+fy1)/2,fx0+5,(fy0+fy1)/2)}${Lp(fx1-5,(fy0+fy1)/2,fx1+5,(fy0+fy1)/2)}"/>`;
}
function footerMarkup(W,H,layout,info){
  if(layout==='full')return titleBlock(W-190,H-46,info);
  if(layout==='min')return `<text class="d-t" x="12" y="${f2(H-13)}" font-size="5" font-weight="600">${esc(info.part)}</text><text class="d-l" x="12" y="${f2(H-7.5)}" font-size="3.3">Ölçek ${esc(info.scale)}${info.extra?'   '+esc(info.extra):''}</text>`;
  return '';
}
function sheetInfo(paperLabel){
  const S=dwS(),src=dwSrc();
  return {drawn:S.drawn,checked:S.checked,date:new Date().toLocaleDateString('tr-TR'),mat:src.matName,part:src.name,company:S.company,dno:S.dno,mass:src.massG?massText(src.massG):'',scale:'',method:S.method,paper:paperLabel||S.paper};
}
/* otomatik delik konum ölçüleri: her delik grubu onu gösteren ilk görünüşte (üst, ön, yan sırasıyla) ölçülür */
/* silindirin bir dış çizgisi (sg: eksenin iki yanı) eksen üstündeki (ma, mb) noktasının hizasında görünür mü. Kama kanalı gibi
   oyuklar dış çizgiyi biraz içeri alır (Ø35 kademede 17,5 yerine 16,8): yarıçapın %90'ına kadar kabul edilir */
function silVis(d,ma,mb,ua,ub,r,sg){const e=Math.max(2e-3,r*1e-3);
  for(const q of d.vis){const dx=q[2]-q[0],dy=q[3]-q[1],l=Math.hypot(dx,dy);if(l<1e-9||Math.abs(dx*ub-dy*ua)/l>1e-3)continue;
    const o=((q[0]-ma)*-ub+(q[1]-mb)*ua)*sg;if(o<0.9*r-e||o>r+e)continue;
    const t0=(q[0]-ma)*ua+(q[1]-mb)*ub,t1=(q[2]-ma)*ua+(q[3]-mb)*ub;if(Math.min(t0,t1)<=e&&Math.max(t0,t1)>=-e)return true}
  return false}
/* model noktası (a, b) görünür bir kenarın üstünde mi (r: silindir yarıçapı, tolerans için) */
function onVisLine(d,a,b,r){const e=Math.max(2e-3,(r||0)*1e-3);
  return d.vis.some(q=>{const dx=q[2]-q[0],dy=q[3]-q[1],l2=dx*dx+dy*dy;if(l2<1e-12)return false;const t=((a-q[0])*dx+(b-q[1])*dy)/l2;if(t<-1e-6||t>1+1e-6)return false;
    return Math.hypot(q[0]+dx*t-a,q[1]+dy*t-b)<e})}
/* dairenin görünüşte görünen kısmı (çevresine oranı) */
function circVisFrac(d,q){const e=Math.max(2e-3,q.r*2e-3);let L=0;
  for(const s of d.vis){if(Math.abs(Math.hypot(s[0]-q.a,s[1]-q.b)-q.r)<e&&Math.abs(Math.hypot(s[2]-q.a,s[3]-q.b)-q.r)<e)L+=Math.hypot(s[2]-s[0],s[3]-s[1])}
  return L/(2*Math.PI*q.r||1)}
function holePlan(vd,order){const plan=new Map();
  for(const k of order){const seen=[];for(const q of vd[k].circ){if(!q.label)continue;
    // farklı özelliklerin görünüşte üst üste düşen aynı çaplı daireleri (borunun ve flanşın aynı deliği, arka disk ve ön örtü) tek etiket olur;
    // aynı özelliğin kopyaları (aynalanmış ayak delikleri gibi arka arkaya duranlar) sayılmaya devam eder
    if(seen.some(o=>o.gid!==q.gid&&Math.abs(o.a-q.a)<0.01&&Math.abs(o.b-q.b)<0.01&&Math.abs(o.r-q.r)<0.01))continue;
    if(!plan.has(q.gid))plan.set(q.gid,{k,list:[]});const g=plan.get(q.gid);if(g.k===k){g.list.push(q);seen.push(q)}}}
  return plan}
function planHoles(plan,k){const hs=[];for(const g of plan.values())if(g.k===k)for(const q of g.list)if(q.op==='cut')hs.push(q);return hs}
/* bir eksendeki delik konumları: simetrik çift merkezden merkeze tek ölçü, diğerleri kenardan; 5'ten fazlaysa ölçülmez.
   Delikler hep öbür yarıdaysa yakın kenardan ölçülür (milin ucundaki pim deliği: 285 değil 20). Kısa ölçü önce (içte) */
function holePairs(vals,lo,hi){
  const c=(lo+hi)/2;const out=[];for(const x of vals.slice().sort((p,q)=>p-q))if(!out.length||x-out[out.length-1]>0.01)out.push(x);
  vals=out.filter(x=>Math.abs(x-c)>1e-3&&x>lo+1e-3&&x<hi-1e-3);if(!vals.length||vals.length>5)return null;
  if(vals.length===2&&Math.abs(vals[0]+vals[1]-2*c)<0.01)return [[vals[0],vals[1]]];
  return vals.every(x=>x>c)?vals.slice().reverse().map(x=>[x,hi]):vals.map(x=>[lo,x]);
}
/* delik dairesi: aynı gruptan en az 3 delik ortak bir merkezden eşit uzaklıkta ve dikdörtgen ızgara oluşturmuyor (ör. dairesel çoğaltma) */
function boltCircles(hs){
  const groups=new Map();for(const q of hs){if(!groups.has(q.gid))groups.set(q.gid,[]);groups.get(q.gid).push(q)}
  const out=[];
  for(const [gid,g] of groups){if(g.length<3)continue;
    const a=g.reduce((x,q)=>x+q.a,0)/g.length,b=g.reduce((x,q)=>x+q.b,0)/g.length;const ds=g.map(q=>Math.hypot(q.a-a,q.b-b));const R=ds.reduce((x,y)=>x+y,0)/g.length;
    if(!(R>1e-3)||ds.some(d=>Math.abs(d-R)>0.01+R*1e-4))continue;
    const n=vals=>{const s=vals.slice().sort((x,y)=>x-y);let c=0;for(let i=0;i<s.length;i++)if(!i||s[i]-s[i-1]>0.01)c++;return c};
    if(n(g.map(q=>q.a))*n(g.map(q=>q.b))===g.length)continue;
    out.push({gid,a,b,R,holes:g});
  }
  return out;
}
/* görünüşün bir sınırındaki (ax 0: a = val, 1: b = val) kenar noktası; diğer koordinatı near’a en yakın olan.
   genel ölçünün yardımcı çizgisi sınır kutusunun köşesinden değil buradan çıkar: köşe yuvarlatılmış veya pahlıysa da kenara değer */
function edgePt(d,ax,val,near){
  const o=1-ax,e=1e-4*Math.max(1,Math.abs(val));let best=null,bd=Infinity;
  for(const q of d.vis){const P=[[q[0],q[1]],[q[2],q[3]]],on=P.map(X=>Math.abs(X[ax]-val)<e);
    let c=null;if(on[0]&&on[1]){const lo=Math.min(P[0][o],P[1][o]),hi=Math.max(P[0][o],P[1][o]);c=Math.max(lo,Math.min(hi,near))}else if(on[0])c=P[0][o];else if(on[1])c=P[1][o];
    if(c!=null&&Math.abs(c-near)<bd){bd=Math.abs(c-near);best=c}}
  const v=best==null?near:best;return ax===0?[val,v]:[v,val];
}
function holeDimCounts(vd,order){const plan=holePlan(vd,order),out={};
  for(const k of order){const all=planHoles(plan,k);const bc=boltCircles(all);const hs=all.filter(q=>!bc.some(g=>g.holes.includes(q)));if(!hs.length)continue;const bb=vd[k].bb;
    out[k]={h:(holePairs(hs.map(q=>q.a),bb.minA,bb.maxA)||[]).length,v:(holePairs(hs.map(q=>q.b),bb.minB,bb.maxB)||[]).length}}
  return out}
function buildSheet(forExport,opts){
  opts=opts||{};const S=dwS(),src=dwSrc(),isAsm=src.kind==='asm';const pw=paperWH(S.paper,S.orient);
  const W=opts.W||pw.W,H=opts.H||pw.H,layout=opts.layout||S.layout||'full',scaleSet=opts.scale!=null?opts.scale:S.scale;
  const o=[`<style>${SHEET_CSS}</style>`];
  if(!forExport)o.push(`<rect x="1.4" y="1.8" width="${W}" height="${H}" fill="#000" fill-opacity=".2"/>`);
  o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`);
  o.push(frameMarkup(W,H,layout));
  const ctx={views:{},snaps:[],scale:1,W,H};
  const info=sheetInfo(opts.paperLabel);
  if(!src.polys.length){
    info.scale='—';o.push(footerMarkup(W,H,layout,info));
    o.push(`<text class="d-l" x="${W/2}" y="${H/2-20}" font-size="6" text-anchor="middle">${isAsm?'Montajda görüntülenecek bileşen yok.':'Görünüş oluşturmak için önce Parça sekmesinde bir gövde oluştur.'}</text>`);
    return {markup:o.join(''),ctx};
  }
  const side=S.method==='E'?'left':'right';
  const isoOnly=isAsm&&S.asmView==='iso';
  const keys=isoOnly?['iso']:['front','top',side].concat(S.iso?['iso']:[]);
  const bom=isAsm&&S.bom!==false?bomItems(src.a):null;
  const vd={};for(const k of keys)vd[k]=viewData(k,k==='iso'&&isAsm?dwSrc(true):undefined);
  const secKey=!isoOnly&&S.section&&S.section!=='none'?(S.section==='front'?'front':S.section==='top'?'top':side):null;
  let secInfo=null;
  if(secKey){try{const ss=sectionSrc(src,secKey,S);const sv=viewData(secKey,ss);vd[secKey]=Object.assign({},sv,{bb:vd[secKey].bb});secInfo={key:secKey,partner:secKey==='front'?'top':'front',P:ss.P,D:VIEWS[secKey].D,half:S.secType==='half'}}catch(e){console.warn(e)}}
  const ext=k=>({w:Math.max(vd[k].bb.maxA-vd[k].bb.minA,.01),h:Math.max(vd[k].bb.maxB-vd[k].bb.minB,.01)});
  let [ax0,ay0,ax1,ay1]=areaFor(W,H,layout);const bomH=bom?(bom.length+1)*6:0;
  const bomLow=layout==='full'||layout==='frame';  // parça listesi sağ altta (antetin üstünde) mi
  if(bom&&bomLow)ay1-=bomH+4;else if(bom)ax1-=Math.min(184,(ax1-ax0)*0.42);  // tam düzende ilk deneme bu yüksekliği geri ekler
  const m=16,gapX=30,gapY=28;
  // delik konum ölçüleri görünüşlerin arasına sığsın: kağıtta yer varsa aralık ölçü sırası sayısına göre açılır (ölçek değişmez)
  let needX=0,needY=0;
  if(S.autodims&&!isoOnly){const hc=holeDimCounts(vd,['top','front',side].filter(k=>keys.includes(k)&&(k==='front'||!(S.hide||[]).includes('V:'+(k===side?'side':k)))));
    const need=(n,b)=>n?b+7*(n-1)+7:0;
    for(const k in hc){needX=Math.max(needX,need(hc[k].v,9));needY=Math.max(needY,need(hc[k].h,k==='top'?9:16))}}
  const gapFor=(g,nd,room)=>Math.max(g,Math.min(nd,room));
  let pos,s,si;
  const place=(ay0,ay1)=>{let pos,s,si;
  if(isoOnly){const e=ext('iso');const sF=Math.min((ax1-ax0-2*m)/e.w,(ay1-ay0-2*m)/e.h);s=scaleSet==='auto'?(STD_SCALES.find(x=>x<=sF*1.0001)||STD_SCALES[STD_SCALES.length-1]):+scaleSet;si=s;pos={iso:[(ax0+ax1)/2,(ay0+ay1)/2]}}
  else{
  const fw=ext('front').w,fh=ext('front').h,sw_=ext(side).w,th=ext('top').h,iw=S.iso?ext('iso').w:0,ih=S.iso?ext('iso').h:0;
  const AW=ax1-ax0-2*m,AH=ay1-ay0-2*m;
  // Yerleşim A: 2×2 ızgara (izometrik sağ alt/sağ üst). Yerleşim B: izometrik ayrı satırda (dikey kağıtta daha iyi).
  const std=x=>STD_SCALES.find(y=>y<=x*1.0001)||STD_SCALES[STD_SCALES.length-1];
  // Yerleşim A: ölçek yalnızca ön/üst/yan görünüşlerden; izometrik kalan hücreye kendi (en çok aynı) ölçeğiyle sığar.
  s=scaleSet==='auto'?std(Math.min((AW-gapX)/(fw+sw_),(AH-gapY)/(fh+th))):+scaleSet;
  si=s;
  if(S.iso){const cw=AW-gapX-fw*s,ch=AH-gapY-fh*s;si=Math.min(s,cw>0?cw/iw:s,ch>0?ch/ih:s);si=si>=s?s:std(si)}
  const c2wA=Math.max(sw_*s,iw*si),rTopA=Math.max(th*s,ih*si);
  // Yerleşim B: izometrik ayrı satırda, tüm görünüşler aynı ölçekte (dikey kağıtta daha iyi)
  const sB=S.iso?Math.min((AW-gapX)/Math.max(fw+sw_,iw),(AH-2*gapY)/(fh+th+ih)):0;
  const useB=scaleSet==='auto'&&S.iso&&std(sB)>=s;if(useB){s=std(sB);si=s}
  if(!useB){
    const r1h=S.method==='E'?fh*s:rTopA,r2h=S.method==='E'?rTopA:fh*s;
    const gX=gapFor(gapX,needX,AW-fw*s-c2wA),gY=gapFor(gapY,needY,AH-r1h-r2h);
    const totW=fw*s+c2wA+gX,totH=r1h+r2h+gY;
    const lx=ax0+(ax1-ax0-totW)/2,ty=ay0+(ay1-ay0-totH)/2;
    const cx1=lx+fw*s/2,cx2=lx+fw*s+gX+c2wA/2,cy1=ty+r1h/2,cy2=ty+r1h+gY+r2h/2;
    pos=S.method==='E'?{front:[cx1,cy1],[side]:[cx2,cy1],top:[cx1,cy2],iso:[cx2,cy2]}:{top:[cx1,cy1],iso:[cx2,cy1],front:[cx1,cy2],[side]:[cx2,cy2]};
    // izometrik üst görünüşün yanında: üst görünüşün sağındaki delik ölçülerine yer kalmadıysa sağ kenara doğru kayar
    if(S.iso){const dx=Math.min(lx+fw*s+needX-(cx2-iw*si/2),ax1-4-(cx2+iw*si/2));if(dx>0)pos.iso=[cx2+dx,pos.iso[1]]}
  }else{
    const gX=gapFor(gapX,needX,AW-(fw+sw_)*s),gY=gapFor(gapY,needY,(AH-(fh+th+ih)*s)/2);
    const gw=(fw+sw_)*s+gX,totW=Math.max(gw,iw*s),totH=(fh+th+ih)*s+2*gY;
    const lx=ax0+(ax1-ax0-gw)/2,ty=ay0+(ay1-ay0-totH)/2;
    const cx1=lx+fw*s/2,cx2=lx+fw*s+gX+sw_*s/2;
    const yA=S.method==='E'?ty+fh*s/2:ty+th*s/2,yB=S.method==='E'?ty+fh*s+gY+th*s/2:ty+th*s+gY+fh*s/2,yI=ty+(fh+th)*s+2*gY+ih*s/2;
    pos=S.method==='E'?{front:[cx1,yA],[side]:[cx2,yA],top:[cx1,yB],iso:[(ax0+ax1)/2,yI]}:{top:[cx1,yA],front:[cx1,yB],[side]:[cx2,yB],iso:[(ax0+ax1)/2,yI]};
  }
  }
  return {pos,s,si}};
  /* parça listesi sağ alt köşede: önce liste yok sayılarak yerleştirilir; görünüşler listeye değmiyorsa bu (daha büyük) ölçek kullanılır.
     değiyorsa izometrik hücresi listenin üstünde kalacak kadar küçültülür; yine değiyorsa liste yüksekliği çıkarılmış alanla yerleştirilir */
  const bomBox=bom&&bomLow?[ax1-Math.min(184,ax1-ax0),ay1,ax1,ay1+bomH+4]:null;
  let L=place(ay0,bomBox?ay1+bomH+4:ay1);
  if(bomBox){const hit=k=>{const P=L.pos[k];if(!P||(S.hide||[]).includes('V:'+(k===side?'side':k)))return false;const e=ext(k),sc=k==='iso'?L.si:L.s,w=e.w*sc/2+10,h=e.h*sc/2+10;
      return P[0]+w>bomBox[0]&&P[0]-w<bomBox[2]&&P[1]+h>bomBox[1]&&P[1]-h<bomBox[3]};
    if(['front','top',side].some(hit))L=place(ay0,ay1);
    else if(hit('iso')){
      // izometrik, üstündeki görünüşle (yan görünüş) liste arasındaki boşluğa sığacak ölçekle ortalanır
      const e=ext('iso'),up=L.pos[side]&&L.pos[side][0]>bomBox[0]-e.w*L.si/2?L.pos[side][1]+ext(side).h*L.s/2+8:ay0;const room=bomBox[1]-12-up;
      let k=L.si;while(k>STD_SCALES[STD_SCALES.length-1]&&e.h*k>room)k=STD_SCALES.find(x=>x<k)||k/2;
      L.si=k;L.pos.iso=[L.pos.iso[0],up+room/2];if(hit('iso')||k<L.s/2.5)L=place(ay0,ay1)}}
  // yalnızca izometrik düzende sayfanın ölçeği izometriğin ölçeğidir (parça listesine sığmak için küçültülünce antet 1:1 yazıyordu)
  pos=L.pos;s=L.s;si=L.si;if(isoOnly)s=si;ctx.scale=s;info.scale=scaleLabel(s);
  /* elle taşınan görünüşler: ön görünüş izdüşüm görünüşlerini de taşır; üst yalnızca dikey, yan yalnızca yatay kayar (SolidWorks gibi hizalı) */
  const VO=S.vofs||{},fo=VO.front||[0,0];const shift=(k,dx,dy)=>{if(pos[k])pos[k]=[pos[k][0]+dx,pos[k][1]+dy]};
  if(!isoOnly){shift('front',fo[0],fo[1]);shift('top',fo[0],fo[1]+(VO.top||0));shift(side,fo[0]+(VO.side||0),fo[1])}
  if(VO.iso)shift('iso',VO.iso[0],VO.iso[1]);
  const hide=new Set(S.hide||[]);const vk2=k=>k===side?'side':k;
  const shown=keys.filter(k=>k==='front'||!hide.has('V:'+vk2(k)));
  occ=[];dimSegs=[];ctx.hits=[];ctx.side=side;ctx.area=[ax0,ay0,ax1,ay1];
  for(const k of keys){
    const d=vd[k],[cx,cy]=pos[k];const ac=(d.bb.minA+d.bb.maxA)/2,bc=(d.bb.minB+d.bb.maxB)/2;
    const vs=k==='iso'?si:s;
    // hidOn: gizli kenarlar çiziliyor mu; çizilmiyorsa akıllı ölçü onları seçmez (SolidWorks: gizli çizgiler kaldırılınca seçilemez)
    ctx.views[k]={key:k,d,s:vs,hidOn:!!S.hidden&&k!=='iso'&&k!==(secInfo&&secInfo.key),map:(a,b)=>[cx+(a-ac)*vs,cy-(b-bc)*vs],inv:(x,y)=>[ac+(x-cx)/vs,bc-(y-cy)/vs]};
  }
  const segPath=(arr,v)=>{let p='';for(const q of arr){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);p+=Lp(A[0],A[1],B[0],B[1])}return p};
  for(const k of keys){if(!shown.includes(k)){delete ctx.views[k];continue}
    const bbx=[ctx.views[k].map(vd[k].bb.minA,vd[k].bb.maxB),ctx.views[k].map(vd[k].bb.maxA,vd[k].bb.minB)];ctx.hits.push({t:'view',k:vk2(k),box:[bbx[0][0],bbx[0][1],bbx[1][0],bbx[1][1]]});
  }
  for(const k of shown){
    const v=ctx.views[k],d=v.d;
    // farklı ölçekli izometrik görünüşün altına kendi ölçeği yazılır
    if(k==='iso'&&v.s!==s){const [cx,cy]=pos.iso,ty=cy+(d.bb.maxB-d.bb.minB)*v.s/2+6,lb='Ölçek '+scaleLabel(v.s),tw=textWidth(lb,3.2)/2;o.push(`<text class="d-l" x="${f2(cx)}" y="${f2(ty)}" font-size="3.2" text-anchor="middle">${esc(lb)}</text>`);occ.push([cx-tw-.5,ty-2.8,cx+tw+.5,ty+.6])}
    if(S.hidden&&k!=='iso'&&k!==(secInfo&&secInfo.key)&&d.hid.length)o.push(`<path class="d-hid" d="${chainPath(d.hid.map(q=>[...v.map(q[0],q[1]),...v.map(q[2],q[3])]))}"/>`);
    if(secInfo&&k===secInfo.key)o.push(hatchMarkup(d.secPolys,v,src.kind==='asm'));
    if(k!=='iso'&&d.threads.length)o.push(threadMarkup(d.threads,v,s));
    o.push(`<path class="d-vis" d="${segPath(d.vis,v)}"/>`);
    if(S.centers&&k!=='iso'){
      let cp='';
      for(const q of markSegs(d.marks,v.map))cp+=Lp(...q);
      for(const q of d.axes){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;cp+=Lp(A[0]-ux*3,A[1]-uy*3,B[0]+ux*3,B[1]+uy*3)}
      if(cp)o.push(`<path class="d-cen" d="${cp}"/>`);
    }
    if(k!=='iso'){
      // ref: noktanın modeldeki kimliği (daire merkezi, yay merkezi veya köşedeki kenarların imzaları); model değişince ölçü onu yeniden bulur
      const seen=new Set();const add=(a,b,c,ref,hid)=>{const key=Math.round(a*1000)+'_'+Math.round(b*1000);if(seen.has(key))return;seen.add(key);const [x,y]=v.map(a,b);ctx.snaps.push({view:k,a,b,x,y,c:!!c,ref,hid:!!hid})};
      for(const mk of d.marks)add(mk.a,mk.b,true,{k:'c',g:mk.g});
      // yay merkezleri de nokta olarak seçilir (SolidWorks gibi; radyus merkezinden kenara ölçü)
      for(const ar of d.arcs||[])add(ar.a,ar.b,true,{k:'ac',s:ar.sig,ss:ar.sigs,r:ar.r});
      // yalnızca gerçek köşeler: aynı doğru üzerinde devam eden parçaların ek yerleri (ör. yandan görülen dairenin çokgen
      // köşeleri, gizli/görünür geçişleri) nokta sayılmaz; yoksa kenarın üstü sahte noktalarla dolar, kenar seçilemezdi.
      // Yayın kiriş köşeleri de nokta değildir (yalnızca yayın iki ucu)
      const dirs=new Map(),sgs=new Map(),kk=(a,b)=>Math.round(a*1000)+'_'+Math.round(b*1000);const inner=(d.arcs&&d.arcs.inner)||new Set();
      const inc=(a,b,ux,uy,sg)=>{const key=kk(a,b);let L=dirs.get(key);if(!L){dirs.set(key,L=[]);sgs.set(key,new Set())}L.push([ux,uy]);if(sg)sgs.get(key).add(sg)};
      for(const q of d.vis.concat(d.hid)){const dx=q[2]-q[0],dy=q[3]-q[1],l=Math.hypot(dx,dy);if(l<1e-9)continue;inc(q[0],q[1],dx/l,dy/l,q[5]);inc(q[2],q[3],-dx/l,-dy/l,q[5])}
      const joint=(a,b)=>{const L=dirs.get(kk(a,b));return L&&L.length>=2&&L.every(u=>Math.abs(u[0]*L[0][1]-u[1]*L[0][0])<1e-4)&&L.some(u=>u[0]*L[0][0]+u[1]*L[0][1]<0)};
      // yalnızca gizli kenarların köşeleri işaretlenir: gizli çizgiler çizilmiyorsa seçilmez (model değişince ölçü yine bulur)
      /* görünür kenarlara göre de köşe mi: gizli kenarın görünür kenara T biçiminde değdiği nokta, gizli çizgiler çizilmeyince
         düz bir kenarın ortasıdır */
      const vd2=new Map();for(const q of d.vis){const dx=q[2]-q[0],dy=q[3]-q[1],l=Math.hypot(dx,dy);if(l<1e-9)continue;
        for(const [a,b,ux,uy] of [[q[0],q[1],dx/l,dy/l],[q[2],q[3],-dx/l,-dy/l]]){const key=kk(a,b);let L=vd2.get(key);if(!L)vd2.set(key,L=[]);L.push([ux,uy])}}
      const visCorner=key=>{const L=vd2.get(key);if(!L)return false;return !(L.length>=2&&L.every(u=>Math.abs(u[0]*L[0][1]-u[1]*L[0][0])<1e-4)&&L.some(u=>u[0]*L[0][0]+u[1]*L[0][1]<0))};
      for(const q of d.vis.concat(d.hid))for(const [a,b] of [[q[0],q[1]],[q[2],q[3]]]){const key=kk(a,b);if(inner.has(key)||joint(a,b))continue;add(a,b,false,{k:'v',s:[...(sgs.get(key)||[])].sort()},!visCorner(key))}
    }
  }
  /* yazıların ve etiketlerin kaçacağı çizgiler: görünür kenarlar, gizli kenarlar ve eksen çizgileri (çizildikleri uzunlukla) */
  occLn={geo:[],soft:[]};
  for(const k of shown){const v=ctx.views[k],d=v.d;const pg=q=>{const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);return [A[0],A[1],B[0],B[1]]};
    for(const q of d.vis)occLn.geo.push(pg(q));if(k==='iso')continue;
    if(S.hidden&&k!==(secInfo&&secInfo.key))for(const q of d.hid)occLn.soft.push(pg(q));
    if(S.centers){occLn.soft.push(...markSegs(d.marks,v.map));
      for(const q of d.axes){const g=pg(q),dx=g[2]-g[0],dy=g[3]-g[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;occLn.soft.push([g[0]-ux*3,g[1]-uy*3,g[2]+ux*3,g[3]+uy*3])}}}
  occLn.geoG=segGrid(occLn.geo);occLn.softG=segGrid(occLn.soft);
  /* otomatik ölçüler (Model öğeleri): önce sabit konumlu ölçüler, sonra etiketler boş yere yerleştirilir */
  const autoDim=(key,P1,P2,Q1,Q2,txt)=>{if(hide.has(key))return false;const n0=dimSegs.length;o.push(dimMarkup(P1,P2,Q1,Q2,txt));ctx.hits.push({t:'auto',k:key,box:lastBox,segs:dimSegs.slice(n0)});return true};
  // kesit çizgisi etiketlerden önce hesaplanır (ok ve harf yerleri ayrılır), çizim sırası değişmez
  const secM=secInfo?sectionLineMarkup(secInfo,ctx,s):'';
  if(S.autodims&&!isoOnly){
    const order=['top','front',side].filter(k=>ctx.views[k]);const plan=holePlan(vd,order);
    /* delik konumları: simetrik çift merkezden merkeze, diğerleri görünüşün sol/alt kenarından; delik dairesindekiler delik dairesi çapıyla */
    const pcds=[],hpN={};  // hpN: görünüş başına delik konum ölçüsü sırası sayısı (yatay/dikey)
    for(const k of order){
      const all=planHoles(plan,k);const bc=boltCircles(all);for(const g of bc)pcds.push({k,...g});
      const hs=all.filter(q=>!bc.some(g=>g.holes.includes(q)));if(!hs.length)continue;
      const v=ctx.views[k],bb=vd[k].bb;
      const axis=(vals,lo,hi,horiz)=>{
        const pairs=holePairs(vals,lo,hi);if(!pairs)return;(hpN[k]=hpN[k]||{h:0,v:0})[horiz?'h':'v']=pairs.length;
        /* uç (görünüşün kenarı) veya delik merkezi; tek taraftaki delikler yakın kenardan ölçülür (milin ucundaki pim deliği 285 değil 20) */
        const end=x=>x===lo||x===hi?v.map(...edgePt(vd[k],horiz?0:1,x,horiz?bb.minB:bb.maxA)):horiz?v.map(x,hs.find(q=>Math.abs(q.a-x)<0.01).b):v.map(hs.find(q=>Math.abs(q.b-x)<0.01).a,x);
        // kısa ölçü içte, uzun dışta (ISO 129-1): genel boyut bu sıraların dışına konur (önceden 285 ölçüsü 305 genel boyunun dışındaydı)
        pairs.forEach(([x0,x1],i)=>{const off=9+7*i;
          const key='hp:'+vk2(k)+':'+(horiz?'h':'v')+':'+i;const P1=end(x0),P2=end(x1);
          if(horiz){const y=v.map(0,bb.minB)[1]+off;autoDim(key,P1,P2,[P1[0],y],[P2[0],y],fmt(x1-x0))}
          else{const x=v.map(bb.maxA,0)[0]+off;autoDim(key,P1,P2,[x,P1[1]],[x,P2[1]],fmt(x1-x0))}});
      };
      axis(hs.map(q=>q.a),bb.minA,bb.maxA,true);axis(hs.map(q=>q.b),bb.minB,bb.maxB,false);
    }
    /* genel boyutlar. Boyut, ortasından geçen eksenli bir silindirin (veya uç görünüşteki dairenin, dış hattı aynı çembere
       oturan yayların) çapıysa SolidWorks gibi Ø ile yazılır; aynı çap ayrıca profilin içine yazılmaz (kasnakta “60” ve “Ø60”
       birlikte çıkıyordu). Her ölçü bir kez (ISO 129-1): daire biçimli görünüşte genişlik ve yükseklik aynı çaptır, yan
       görünüşte aynı eksenin aynı çapı yeniden yazılmaz (diskte 813 / 813, çarkta 200 / 200 / Ø200, milde iki Ø50 çıkıyordu) */
    const shownCk=new Set(),odimCk=new Set(),shownGk=new Set(),odone=new Set();
    const diaFor=(k,horiz)=>{const d=vd[k],bb=d.bb,lo=horiz?bb.minA:bb.minB,hi=horiz?bb.maxA:bb.maxB,tol=1e-3*(1+hi-lo);
      for(const c of (d.cyls||[]).concat(d.ecyl||[])){if(horiz?Math.abs(c.a1-c.a0)>1e-6:Math.abs(c.b1-c.b0)>1e-6)continue;const m=horiz?c.a0:c.b0;
        if(Math.abs(m-c.r-lo)<tol&&Math.abs(m+c.r-hi)<tol)return c}
      for(const q of d.circ){const m=horiz?q.a:q.b;if(Math.abs(m-q.r-lo)<tol&&Math.abs(m+q.r-hi)<tol)return q}
      // dış hat aynı çembere oturan yaylardan (tam daire veya kanat uçları gibi parçalı): her iki uçta çemberin en dış noktası yayın üstünde
      const tl=Math.max(tol,0.01);
      for(const x of d.arcs||[]){const m=horiz?x.a:x.b;if(Math.abs(m-x.r-lo)>tl)continue;
        // en dış nokta yayın içinde (ucunda değil): braketin yarım yuvarlak (R25) ucunda genişlik 50 çap değildir, Ø50 yazılıyordu
        const inside=(y,th)=>{if(y.full)return true;const dl=3*Math.PI/180,sg=Math.sign(y.sw)||1;let q=((th-y.t0)*sg)%(2*Math.PI);if(q<0)q+=2*Math.PI;return q>=dl&&q<=Math.abs(y.sw)-dl};
        const hit=(y,th)=>Math.hypot(y.a-x.a,y.b-x.b)<tl&&Math.abs(y.r-x.r)<tl&&inside(y,th);
        if(!d.arcs.some(y=>hit(y,horiz?Math.PI:-Math.PI/2))||!d.arcs.some(y=>hit(y,horiz?0:Math.PI/2)))continue;
        if(Math.abs(m+x.r-hi)<tl)return {a:x.a,b:x.b,r:x.r,arc:true}}
      return null};
    const sameC=(p,q)=>p&&q&&p.a!=null&&q.a!=null&&Math.hypot(p.a-q.a,p.b-q.b)<1e-2&&Math.abs(p.r-q.r)<1e-2;
    const odim=(key,c,v)=>{if(!c||hide.has(key))return fmt(v);shownCk.add(c.ck);odimCk.add(c.ck);if(c.gk)shownGk.add(c.gk);return 'Ø'+fmt(v)};
    const cdLead=[];
    /* profilin içinden çap ölçüsü (yandan görülen silindir); yer yoksa veya dış çizgileri görünmüyorsa false */
    const inProf=(k,c,key)=>{const v=ctx.views[k];const L=Math.hypot(c.a1-c.a0,c.b1-c.b0);if(L*s<5||c.r*2*s<7)return false;
      const ua=(c.a1-c.a0)/L,ub=(c.b1-c.b0)/L;const txt='Ø'+fmt(c.r*2),tw=textWidth(txt,3.5)/2+.8;
      /* görünüşte kenarları (dış çizgileri) gizliyse kesikli çizgiye ölçü verilmez: ölçü dış çizgilerin görünür olduğu yere konur
         (L destekte Ø27 göbeğin yalnızca ucu görünür), hiç görünmüyorsa uç görünüşteki dairesine kılavuzla yazılır */
      for(const f of [.5,.35,.65,.2,.8,.9,.1]){const ma=c.a0+(c.a1-c.a0)*f,mb=c.b0+(c.b1-c.b0)*f;
        // okların ikisi de görünür dış çizgiye değmeli: silindirin gizli kalan kısmına (kesikli çizgiye) ölçü verilmez
        if(!silVis(v.d,ma,mb,ua,ub,c.r,1)||!silVis(v.d,ma,mb,ua,ub,c.r,-1))continue;
        const P1=v.map(ma-ub*c.r,mb+ua*c.r),P2=v.map(ma+ub*c.r,mb-ua*c.r);
        const M=[(P1[0]+P2[0])/2,(P1[1]+P2[1])/2],vert=Math.abs(P1[0]-P2[0])<Math.abs(P1[1]-P2[1]);
        // yazı ölçü çizgisinin üst/sol yanında 1,1 + 2,7 mm yer kaplar: dar yakada (Ø50) okların arasına sığan konum aranır
        const B=vert?[M[0]-4.2,M[1]-tw,M[0]+.5,M[1]+tw]:[M[0]-tw,M[1]-4.2,M[0]+tw,M[1]+.5];
        if(occ.some(b=>boxOv(B,b)>0)||occLn.geoG.near(B).some(g=>segHitsBox(g[0],g[1],g[2],g[3],B)))continue;autoDim(key,P1,P2,P1,P2,txt);shownCk.add(c.ck);return true}
      return false};
    const vF=ctx.views.front,dF=vd.front.bb,vS=ctx.views[side];
    /* üst görünüşte dış hat tek daireyse genişlik ve derinlik, yan görünüşte daireyse derinlik ve yükseklik aynı çaptır: ön
       görünüşte Ø ile bir kez yazılır, yan görünüşte yinelenmez (flanşlı kaplin montaj resminde 120 / 120 yazılıyordu) */
    const cTop=vd.top?diaFor('top',true):null,circTop=!!cTop&&sameC(cTop,diaFor('top',false));
    const cSd=vS?diaFor(side,false):null,circSide=!!cSd&&sameC(cSd,diaFor(side,true));
    const fW=diaFor('front',true),fH=diaFor('front',false),cW=fW||(circTop?cTop:null),cH=fH||(circSide?cSd:null),cD=vS?diaFor(side,true):null;
    // hangi genel boyutlar yazılacak (genişlik X, yükseklik Y, derinlik Z): derinlik ölçüleri kapalı zincir oluşturmasın
    const willW=!hide.has('ow:front'),circH=sameC(fW,fH),willH=circH?willW:!hide.has('oh:front');
    const dupD=!!((circTop&&willW)||(circSide&&willH)||(cD&&cD.gk&&((willW&&cW&&cW.gk===cD.gk)||(willH&&cH&&cH.gk===cD.gk)))),willD=!!vS&&(dupD||!hide.has('ow:side'));
    /* ekstrüzyon derinlikleri (SolidWorks'teki model öğeleri gibi): taban kalınlığı, kademe yüksekliği, kanal/cep derinliği.
       Önceden yalnızca genel boyutlar yazılıyordu, örnek parçada taban kalınlığı yoktu (resim eksik ölçülüydü). Ölçü, iki seviyenin
       de görünür kenarı olan ve uzatma çizgisinin başka kenarı kesmeden görünüşün dışına çıkabildiği ilk görünüşe konur; gizli
       kenara verilmez. Model ekseni başına seviyeler birleştirilir: zaten bağlı iki seviyeye ikinci ölçü (kapalı zincir, ör. taban
       + gövde = genel yükseklik) eklenmez */
    const dRows={},rowN=(k,sd)=>(dRows[k]&&dRows[k][sd])||0;
    if(!isAsm&&src.caps&&src.box){
      const uf=new Map(),fd=x=>{if(!uf.has(x))uf.set(x,x);while(uf.get(x)!==x)x=uf.get(x);return x},join=(p,q)=>{p=fd(p);q=fd(q);if(p!==q)uf.set(p,q)};
      const lk=(ax,l)=>ax+':'+Math.round(l*1000),B=src.box;
      if(willW)join(lk(0,B.min[0]),lk(0,B.max[0]));if(willH)join(lk(1,B.min[1]),lk(1,B.max[1]));if(willD)join(lk(2,B.min[2]),lk(2,B.max[2]));
      const pref={front:[['L','R'],['B','T']],top:[['L','R'],['B']],[side]:[['R','L'],['B']]};
      // seviyedeki görünür kenarın o yandaki ucu ve oradan görünüşün dışına uzatma çizgisi başka kenarı kesmiyor mu
      /* seviyede o özelliğin kendi yüzeyinin görünür kenarı var mı: milde kama kanalının (gizli) tabanı Ø25 kademesinin üst
         kenarıyla aynı yükseklikte, “5” ölçüsü ilgisiz kenara bağlanıyordu */
      const own=(k,vert,lv,id)=>{const o=vert?1:0,e=1e-4*(1+Math.abs(lv));return vd[k].vis.some(q=>Math.abs(q[o]-lv)<=e&&Math.abs(q[o+2]-lv)<=e&&String(q[5]||'').split('|').some(x=>x.split('~')[0]===id))};
      const reach=(k,vert,lv,sd)=>{const d=vd[k],bb=d.bb,o=vert?1:0,e=1e-4*(1+Math.abs(lv));let best=null;
        for(const q of d.vis){if(Math.abs(q[o]-lv)>e||Math.abs(q[o+2]-lv)>e)continue;for(const x of [q[1-o],q[3-o]])if(best==null||(sd==='L'||sd==='B'?x<best:x>best))best=x}
        if(best==null)return null;const to=sd==='L'?bb.minA:sd==='R'?bb.maxA:sd==='B'?bb.minB:bb.maxB;if(Math.abs(to-best)<e)return best;
        const ray=vert?[best,lv,to,lv]:[lv,best,lv,to];
        for(const q of d.vis){if(Math.abs(q[o]-lv)<=e&&Math.abs(q[o+2]-lv)<=e)continue;if(segCross(ray,q)||segCross(ray,[q[2],q[3],q[0],q[1]]))return null}
        return best};
      const cand=[];
      for(const f of src.feats||[]){if(f.type!=='extrude'||f.suppressed||f.thin)continue;const cp=src.caps[f.id];if(!cp||hide.has('ex:'+f.id))continue;
        const n=cp.F.n,ax=[0,1,2].find(i=>Math.abs(Math.abs(n[i])-1)<1e-6);if(ax==null)continue;
        const l1=cp.F.o[ax]+n[ax]*cp.zn,l2=cp.F.o[ax]+n[ax]*cp.zf;if(Math.abs(l2-l1)<1e-6)continue;
        const k1=lk(ax,l1),k2=lk(ax,l2);if(fd(k1)===fd(k2))continue;
        let put=null;
        for(const k of ['front',side,'top']){const v=ctx.views[k];if(!v||(secInfo&&secInfo.key===k))continue;const VW=VIEWS[k];
          const vert=Math.abs(Math.abs(VW.U[ax])-1)<1e-6,hor=Math.abs(Math.abs(VW.R[ax])-1)<1e-6;if(!vert&&!hor)continue;
          const sg=vert?VW.U[ax]:VW.R[ax],v1=l1*sg,v2=l2*sg;if(!own(k,vert,v1,f.id)&&!own(k,vert,v2,f.id))continue;
          for(const sd of pref[k][vert?0:1]){const e1=reach(k,vert,v1,sd),e2=e1==null?null:reach(k,vert,v2,sd);if(e2==null)continue;
            put={k,vert,sd,p1:vert?[e1,v1]:[v1,e1],p2:vert?[e2,v2]:[v2,e2],len:Math.abs(v2-v1),key:'ex:'+f.id};break}
          if(put)break}
        if(put){join(k1,k2);cand.push(put)}}
      // kısa ölçü içte: aynı yandakiler boya göre sıralanır; delik konum sıralarından sonra, genel boyuttan önce
      cand.sort((p,q)=>p.len-q.len);
      for(const c of cand){const v=ctx.views[c.k],bb=vd[c.k].bb;const r=(dRows[c.k]=dRows[c.k]||{});
        const base=c.sd==='B'?(hpN[c.k]?hpN[c.k].h:0):c.sd==='R'?(hpN[c.k]?hpN[c.k].v:0):0;const off=9+7*(base+(r[c.sd]||0));
        const P1=v.map(...c.p1),P2=v.map(...c.p2);let Q1,Q2;
        if(c.vert){const x=c.sd==='L'?v.map(bb.minA,0)[0]-off:v.map(bb.maxA,0)[0]+off;Q1=[x,P1[1]];Q2=[x,P2[1]]}
        else{const y=c.sd==='B'?v.map(0,bb.minB)[1]+off:v.map(0,bb.maxB)[1]-off;Q1=[P1[0],y];Q2=[P2[0],y]}
        if(autoDim(c.key,P1,P2,Q1,Q2,fmt(c.len)))r[c.sd]=(r[c.sd]||0)+1}}
    const rows=k=>(hpN[k]?hpN[k].h:0)+rowN(k,'B');
    const yB=vF.map(0,dF.minB)[1]+9+7*rows('front'),xL=vF.map(dF.minA,0)[0]-9-7*rowN('front','L');
    /* genel boyut yandan görülen bir silindirin (milin yakası, kapağın flanşı) çapıysa SolidWorks gibi o silindirin üstüne, profilin
       içinden yazılır. Önceden görünüşün yanına yazılıyor, uzatma çizgileri bütün milin üstünden geçip diğer çap ölçülerini kesiyordu */
    const inOv=(key,c)=>{if(!c||c.a0==null||hide.has(key)||!inProf('front',c,key))return false;odimCk.add(c.ck);if(c.gk)shownGk.add(c.gk);return true};
    const BL=vF.map(...edgePt(vd.front,0,dF.minA,dF.minB)),BR=vF.map(...edgePt(vd.front,0,dF.maxA,dF.minB));
    if(inOv('ow:front',cW)||autoDim('ow:front',BL,BR,[BL[0],yB],[BR[0],yB],odim('ow:front',cW,dF.maxA-dF.minA)))odone.add('W');
    // daire biçimli görünüş: yükseklik genişlikle aynı çaptır, yazılmaz
    if(circH){if(willW)odone.add('H')}
    else{const LB=vF.map(...edgePt(vd.front,1,dF.minB,dF.minA)),LT=vF.map(...edgePt(vd.front,1,dF.maxB,dF.minA));
      if(inOv('oh:front',cH)||autoDim('oh:front',LB,LT,[xL,LB[1]],[xL,LT[1]],odim('oh:front',cH,dF.maxB-dF.minB)))odone.add('H')}
    if(vS){const dS=vd[side].bb;
      if((cD&&cD.gk&&shownGk.has(cD.gk))||(circTop&&odone.has('W'))||(circSide&&odone.has('H')))odone.add('D');
      else{const SL=vS.map(...edgePt(vd[side],0,dS.minA,dS.minB)),SR=vS.map(...edgePt(vd[side],0,dS.maxA,dS.minB)),y=vS.map(0,dS.minB)[1]+9+7*rows(side);
        if(autoDim('ow:side',SL,SR,[SL[0],y],[SR[0],y],odim('ow:side',cD,dS.maxA-dS.minA)))odone.add('D')}}
    /* döndürmeyle oluşan silindirlerin çapları (mil kademeleri, burç delikleri): eksenin görüldüğü ilk görünüşte profilin içinden;
       yazı başka bir ölçüye değmeyecek yere (kademenin ortası, sonra kenarlarına yakın) konur, sığmazsa yazılmaz */
    /* gizli kalan (delik, iç oyuk) veya profilin içine sığmayan çaplar uç görünüşteki dairesine kılavuzla yazılır (aşağıda) */
    {const done=new Set();
      for(const k of ['front','top',side]){const v=ctx.views[k];if(!v||!vd[k].cyls||!vd[k].cyls.length)continue;
        vd[k].cyls.forEach((c,i)=>{if(done.has(c.id))return;done.add(c.id);const key='cd:'+vk2(k)+':'+i;if(hide.has(key)||odimCk.has(c.ck))return;
          if(!inProf(k,c,key))cdLead.push({c,key})})}}
    /* kademe boyları (mil, burç, kasnak): tüm silindirleri aynı eksende olan parçada, eksenin yatay/dikey görüldüğü ilk görünüşte
       kademe sınırları arasında zincir ölçü; genel boyun karşı tarafına konur (genel boy alttaysa üstte, soldaysa sağda) */
    for(const k of ['front','top',side]){const v=ctx.views[k],cs=v&&vd[k].cyls;if(!cs||cs.length<2)continue;
      const c0=cs[0],hz=Math.abs(c0.b1-c0.b0)<1e-6&&Math.abs(c0.a1-c0.a0)>1e-6,vt=Math.abs(c0.a1-c0.a0)<1e-6&&Math.abs(c0.b1-c0.b0)>1e-6;if(!hz&&!vt)continue;
      /* görünüşte aynı doğruya düşen ama ayrı eksenli silindirler (yataklı standda üst ve alt yatak deliği üstten bakınca üst üste)
         tek mil sayılıyordu: iki deliğin kademeleri karışık, gizli çizgilere zincir ölçü veriliyordu. Eksenler modelde de aynı olmalı */
      const ax=hz?c0.b0:c0.a0;if(!cs.every(c=>(hz?Math.abs(c.b0-ax)<1e-3&&Math.abs(c.b1-ax)<1e-3:Math.abs(c.a0-ax)<1e-3&&Math.abs(c.a1-ax)<1e-3)&&c.ax===c0.ax))continue;
      const sp=c=>hz?[Math.min(c.a0,c.a1),Math.max(c.a0,c.a1)]:[Math.min(c.b0,c.b1),Math.max(c.b0,c.b1)];
      // kademe sınırları profildeki boylardan: radyus ve pah geçişleri (silindirin kısalan ucu) kademe sayılmaz
      const ps=c=>hz?[Math.min(c.sa0,c.sa1),Math.max(c.sa0,c.sa1)]:[Math.min(c.sb0,c.sb1),Math.max(c.sb0,c.sb1)];
      const xs=[];for(const c of cs)for(const x of ps(c))if(!xs.some(y=>Math.abs(y-x)<1e-3))xs.push(x);xs.sort((p,q)=>p-q);
      if(xs.length<3||xs.length>9)break;
      // uzatma çizgisi o sınırdaki en büyük silindirin dış çizgisinden çıkar (pahlı/radyuslu uçta gövdenin bittiği silindirden)
      const rAt=x=>{const on=cs.filter(c=>{const [p,q]=sp(c);return x>p-1e-3&&x<q+1e-3});return Math.max(...(on.length?on:cs.filter(c=>{const [p,q]=ps(c);return x>p-1e-3&&x<q+1e-3})).map(c=>c.r))};
      /* sınırlar gizli çizgideyse (iç oyuk, yataklı standın kademeli deliği üstten bakınca) zincir bu görünüşte verilmez:
         gizli çizgiye ölçü verilmez (ISO 129-1); kesit görünüşünde görünür olunca orada verilir */
      if(xs.filter(x=>onVisLine(v.d,hz?x:ax+rAt(x),hz?ax+rAt(x):x,rAt(x))).length*2<xs.length)continue;
      // dikey zincir sağ tarafta delik konum ölçülerinin dışına konur (önceden aynı sıraya düşüp yazılar üst üste biniyordu)
      const bb=vd[k].bb,off=(k==='front'||!hz?9:16)+(!hz&&hpN[k]?7*hpN[k].v:0)+7*rowN(k,hz?'T':'R');
      // yazısı sığan kademeler önce: dar kademelerin dışarı alınan yazıları komşularınkine binmesin
      const fitsIn=i=>textWidth(fmt(xs[i+1]-xs[i]),3.5)+1.5<=(xs[i+1]-xs[i])*s;
      const ord=[...xs.keys()].slice(0,-1);ord.sort((p,q)=>fitsIn(q)-fitsIn(p));
      /* kapalı zincir (ISO 129-1): zincir parçanın bir ucundan öbür ucuna gidiyor ve genel boy da yazılıysa ölçüler aşırı
         tanımlıdır (milde 40 + 60 + 90 + … = 305). Ortadaki en uzun kademe (genelde işlevsiz serbest boy) yardımcı ölçü olur:
         parantez içinde. Ortada kademe yoksa (flanş + göbek) sondaki: flanş kalınlığı ve genel boy yazılı kalır */
      const lo=hz?bb.minA:bb.minB,hi=hz?bb.maxA:bb.maxB,et=1e-3*(1+hi-lo);
      const dir={front:hz?'W':'H',top:hz?'W':'D'}[k]||(hz?'D':'H');
      let aux=-1;if(Math.abs(xs[0]-lo)<et&&Math.abs(xs[xs.length-1]-hi)<et&&odone.has(dir)){aux=xs.length-2;let bl=-1;for(let i=1;i<xs.length-2;i++)if(xs[i+1]-xs[i]>bl+1e-6){bl=xs[i+1]-xs[i];aux=i}}
      const val=i=>i===aux?'('+fmt(xs[i+1]-xs[i])+')':fmt(xs[i+1]-xs[i]);
      for(const i of ord){const key='kb:'+vk2(k)+':'+i;
        if(hz){const P1=v.map(xs[i],ax+rAt(xs[i])),P2=v.map(xs[i+1],ax+rAt(xs[i+1])),y=v.map(0,bb.maxB)[1]-off;autoDim(key,P1,P2,[P1[0],y],[P2[0],y],val(i))}
        else{const P1=v.map(ax+rAt(xs[i]),xs[i]),P2=v.map(ax+rAt(xs[i+1]),xs[i+1]),x=v.map(bb.maxA,0)[0]+off;autoDim(key,P1,P2,[x,P1[1]],[x,P2[1]],val(i))}}
      break}
    /* çap ve delik etiketleri: kılavuz çizgisi boş yer bulana kadar döndürülür; elle taşınmışsa o konum kullanılır */
    /* puan: başka yazıya yakınlık (bitişik etiketler “Ø40Ø18” gibi tek yazı okunuyordu), yazıyı kesen görünür/gizli/eksen çizgisi,
       ölçü ve uzatma çizgisi (R16 uzatma çizgisinin, delik etiketi 125 ölçü çizgisinin üstündeydi), kılavuzun kestiği kenar ve
       ölçü çizgisi (R10 kılavuzu göbeği boydan boya kesiyordu) */
    const {geoG,softG}=occLn;
    const score=(B,c)=>{let sc=0;const Bm=[B[0]-.8,B[1]-.8,B[2]+.8,B[3]+.8];for(const b of occ){const a=boxOv(Bm,b);if(a>0)sc+=6+a}
      for(const G of [geoG,softG])for(const g of G.near(B))if(segHitsBox(g[0],g[1],g[2],g[3],B))sc+=1;
      for(const g of dimSegs)if(segHitsBox(g[0],g[1],g[2],g[3],B))sc+=4;
      const ld=c&&c.segs&&c.segs[0];if(ld){for(const g of geoG.near(segBox(ld)))if(segCross(ld,g))sc+=.5;for(const g of dimSegs)if(segCross(ld,g))sc+=2}
      if(B[0]<ax0-8||B[2]>ax1+8||B[1]<ay0-8||B[3]>ay1+8)sc+=30;return sc};
    /* delik dairesi: eksen çizgisiyle çizilir, çapı iki delik arasından çıkan kılavuzla yazılır */
    for(const P of pcds){
      const key='pcd:'+vk2(P.k)+':'+P.gid;if(hide.has(key))continue;
      const v=ctx.views[P.k];const C=v.map(P.a,P.b),R=P.R*s;
      o.push(`<circle class="d-cen" cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(R)}"/>`);
      const an=P.holes.map(q=>{const H=v.map(q.a,q.b);return Math.atan2(C[1]-H[1],H[0]-C[0])}).sort((x,y)=>x-y);
      const mids=an.map((x,i)=>i<an.length-1?(x+an[i+1])/2:(x+an[0]+Math.PI*2)/2);
      const pref=135*Math.PI/180,dA=x=>{let d=Math.abs(x-pref)%(Math.PI*2);return d>Math.PI?Math.PI*2-d:d};mids.sort((x,y)=>dA(x)-dA(y));
      let r=null;
      search:for(const L of [7,12,18])for(const th of mids){const K=[C[0]+Math.cos(th)*(R+L),C[1]-Math.sin(th)*(R+L)];
        const c=leaderM(C,R,['Ø'+fmt(P.R*2)],K);c.sc=score(c.box,c)+dA(th)/3+(L-7)/22;if(!r||c.sc<r.sc)r=c;if(r.sc<0.6)break search}
      o.push(r.m);occ.push(r.box);pushSegs(...r.segs);ctx.hits.push({t:'auto',k:key,box:r.box,segs:r.segs});
    }
    /* gizli ya da profile sığmayan döndürme çapları: uç görünüşteki dairesine kılavuzla (delik etiketleri gibi) */
    {const put=[];
      for(const {c,key} of cdLead){if(shownCk.has(c.ck))continue;
        /* daire görünür olduğu ilk görünüşte; hiçbir görünüşte görünmüyorsa (gizli delik) ilk bulunduğu yerde. Önceden L destekte
           Ø27 göbek, ön görünüşte görünürken yan görünüşteki kesikli dairesine yazılıyordu */
        let hit=null,hid=null;for(const k of ['top','front',side]){const v=ctx.views[k];if(!v)continue;const q=vd[k].circ.find(q=>q.ck===c.ck);if(!q)continue;
          if(circVisFrac(vd[k],q)>=0.5){hit={k,v,q};break}if(!hid)hid={k,v,q}}
        hit=hit||hid;
        if(!hit)continue;const {v,q}=hit;if(put.some(p=>p.k===hit.k&&Math.abs(p.q.a-q.a)<1e-3&&Math.abs(p.q.b-q.b)<1e-3&&Math.abs(p.q.r-q.r)<1e-3))continue;
        const C=v.map(q.a,q.b),R=q.r*v.s;if(R<1)continue;let r=null;
        search:for(const L of [6,10,15,21])for(const dA of [0,-20,20,-40,40,-60,60,90,-90,120,-120,180]){const th=(45+dA)*Math.PI/180;const K=[C[0]+Math.cos(th)*(R+L),C[1]-Math.sin(th)*(R+L)];
          const m=leaderM(C,R,['Ø'+fmt(q.r*2)],K);m.sc=score(m.box,m)+Math.abs(dA)/120+(L-6)/22;if(!r||m.sc<r.sc)r=m;if(r.sc<0.05)break search}
        o.push(r.m);occ.push(r.box);pushSegs(...r.segs);ctx.hits.push({t:'auto',k:key,box:r.box,segs:r.segs});shownCk.add(c.ck);put.push(hit)}}
    /* radyuslar (SolidWorks'teki model öğeleri gibi radyus özelliği, kanal ucu, yuvarlatılmış köşe): iki ucunda kenarlara teğet
       görünür yaylar, her yarıçap bir kez, gördüğü ilk görünüşte; kılavuz yayın üstüne değer. Önceden radyuslar hiç ölçülmüyordu */
    /* yarıçapı 0,1 mm'nin katı olmayan yaylar (ince özelliğin ofset kenarları gibi çokgen yaklaşımları: R5,99, R26,13) yazılmaz; montaj resminde yazılmaz */
    const roundR=r=>Math.abs(r*10-Math.round(r*10))<0.01;
    /* pah kenarları (dişlinin delik ağzındaki 1 × 45° pahın kama kanalıyla kesilen dairesi “R13,5” yazılıyordu) yarıçap değildir */
    const doc=dwDoc(),chamf=new Set(doc.kind==='part'?(doc.p.features||[]).filter(f=>f.type==='chamfer').map(f=>f.id):[]);
    const isChamf=ar=>ar.sigs.some(sg=>sg.split('|').some(x=>chamf.has(x.split('~')[0])));
    if(!isAsm){const doneR=new Set();
      for(const k of ['top','front',side]){const v=ctx.views[k];if(!v)continue;
        // deliğin/silindirin parçası olan yaylar (dairesi zaten çapla yazılır) radyus sayılmaz
        const onCirc=ar=>vd[k].circ.some(q=>Math.hypot(q.a-ar.a,q.b-ar.b)<0.01&&Math.abs(q.r-ar.r)<0.01);
        /* 180°'den büyük yay (kama kanalıyla kesilen delik, kesik göbek) ISO 129-1'e göre çapla ölçülür; uçları teğet olmasa da
           yazılır. Önceden diskin kama kanallı Ø143 deliği hiç ölçülmüyordu */
        for(const ar of vd[k].arcs||[]){const big=!ar.full&&Math.abs(ar.sw)>Math.PI+1e-3;if(!(ar.tan||big)||ar.r*v.s<0.4||!roundR(ar.r)||onCirc(ar)||isChamf(ar))continue;
          const rk=fmt(big?2*ar.r:ar.r),tx=(big?'Ø':'R')+rk;if(doneR.has(tx))continue;
          if(!vd[k].vis.some(q=>q.arc===ar))continue;doneR.add(tx);const key='ar:'+vk2(k)+':'+(big?'D':'')+rk;if(hide.has(key))continue;
          const C=v.map(ar.a,ar.b),R=ar.r*v.s;let r=null;
          /* yazı yayın dışında (ok dışarıdan) ya da merkez tarafında (kılavuz merkezden gelir, ok yaya içeriden değer): iç bükey
             radyusta dış taraf malzemedir, önceden braketteki R10'un kılavuzu göbeği boydan boya kesiyordu */
          const Ls=[[6,0],[10,0],[15,0],[21,0]];if(!big){if(R>8)Ls.push([-6,.25]);Ls.push([-(R+5),.3],[-(R+10),.4])}
          search:for(const [L,pen] of Ls)for(const f of [.5,.35,.65,.2,.8]){const th=ar.t0+ar.sw*f,u=[Math.cos(th),-Math.sin(th)];const K=[C[0]+u[0]*(R+L),C[1]+u[1]*(R+L)];
            const m=leaderM(C,R,[tx],K,u);m.sc=score(m.box,m)+Math.abs(f-.5)/2+Math.abs(L-6)/22+pen;if(!r||m.sc<r.sc)r=m;if(r.sc<0.05)break search}
          o.push(r.m);occ.push(r.box);pushSegs(...r.segs);ctx.hits.push({t:'auto',k:key,box:r.box,segs:r.segs})}}}
    for(const [gid,g] of plan){
      const key='L:'+gid;if(hide.has(key))continue;
      if(g.list.length===1&&g.list[0].op!=='cut'&&shownGk.has(g.list[0].gk))continue;
      /* göbeğin dairesi bu görünüşte gizliyse (L destekte Ø27 göbek yan görünüşte duvarın arkasında, kesikli) çapı göbeğin yandan
         göründüğü görünüşte profilin içinden yazılır; gizli çizgiye ölçü verilmez */
      if(g.list.length===1&&g.list[0].op!=='cut'&&circVisFrac(vd[g.k],g.list[0])<0.5&&!(S.lbl&&S.lbl[gid])){const q=g.list[0];
        if(['front','top',side].some(k2=>k2!==g.k&&ctx.views[k2]&&(vd[k2].ecyl||[]).some(e=>e.ck===q.ck&&inProf(k2,e,key))))continue}
      const v=ctx.views[g.k];const cut=g.list[0].op==='cut';
      const best=g.list.reduce((a,q)=>{const sc=cut?q.a+q.b:-q.a+q.b;return !a||sc>a.sc?{q,sc}:a},null).q;
      const C=v.map(best.a,best.b),R=best.r*s;const n=g.list.length;
      const lines=(best.call||[best.txt||('Ø'+fmt(best.r*2))]).slice();if(n>1)lines[0]=n+'× '+lines[0];
      let r;const own=S.lbl&&S.lbl[gid];
      if(own)r=leaderM(C,R,lines,[C[0]+own[0],C[1]+own[1]]);
      else{const pref=cut?45:135;
        search:for(const L of [7,12,18])for(const dA of [0,-20,20,-40,40,-60,60,90,-90,-120,120,180]){
          const th=(pref+dA)*Math.PI/180;const K=[C[0]+Math.cos(th)*(R+L),C[1]-Math.sin(th)*(R+L)];
          const c=leaderM(C,R,lines,K);c.sc=score(c.box,c)+Math.abs(dA)/120+(L-7)/22;
          if(!r||c.sc<r.sc)r=c;if(r.sc<0.05)break search}}
      o.push(r.m);occ.push(r.box);pushSegs(...r.segs);ctx.hits.push({t:'lbl',k:gid,box:r.box,K:r.K,C,segs:r.segs})
    }
  }
  // 2B çizim öğeleri (ölçülerden önce: noktaları ve kenarları akıllı ölçüye katılır)
  o.push(sk2dMarkup(S,ctx));
  /* elle eklenen ölçüler; model değiştiği için artık geometriye oturmayanlar ekranda kırmızı gösterilir (çıktıda normal) */
  ctx.stale=new Set();
  S.dims.forEach((dm,i)=>{const v=ctx.views[dm.view];if(!v)return;let st=dimStale(dm,v.d,v.sk);
    // model değişti: ölçü aynı kenarı/noktayı/daireyi yeni yerinde bulur ve değeri güncellenir (SolidWorks gibi); bulunamazsa kırmızı kalır
    if(st&&dm.ref){const bak=JSON.stringify(dm);if(reattachDim(dm,v,ctx.snaps)&&!dimStale(dm,v.d,v.sk)){st=false;ctx.moved=(ctx.moved||0)+1}else Object.assign(dm,JSON.parse(bak))}
    if(st)ctx.stale.add(i);let m=dimRender(dm,v);if(st&&!forExport)m=tint(m,'#D0342C');
    o.push(`<g data-dim="${i}">${m}</g>`);ctx.hits.push({t:'dim',i,box:lastBox})});
  if(secInfo)o.push(secM);
  o.push(detailsMarkup(S,ctx,s));
  o.push(surfMarkup(S,ctx));
  o.push(gdtMarkup(S,ctx));
  o.push(datumMarkup(S,ctx));
  o.push(notesMarkup(S,ctx));
  if(bom){
    if(S.balloons!==false){const bv=ctx.views.iso?'iso':'front';o.push(balloonsMarkup(ctx.views[bv],bom,[ax0,ay0,ax1,ay1],S,ctx))}
    o.push(bomMarkup(bom,layout,W,H,[ax0,ay0,ax1,ay1]));
  }
  info.bomRows=bom&&bomLow?bom.length+1:0;
  o.push(footerMarkup(W,H,layout,info));
  occ=null;dimSegs=null;occLn=null;
  return {markup:o.join(''),ctx};
}

/* sayfa görünümü: yakınlaştır/kaydır */
const sheetEl=$('#sheet'),sheetWrap=$('#sheetWrap');
let vb={x:0,y:0,w:420,h:297},dctx=null;
function applyVB(){sheetEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`)}
function fitSheet(){const P=paperWH(dwS().paper,dwS().orient);const pad=8;vb={x:-pad,y:-pad,w:P.W+2*pad,h:P.H+2*pad};applyVB()}
let drawT=0;
function renderDrawing(fit){
  const busy=$('#dwBusy');
  if(!vcache.m||!vcache.m.has(dwSrc().key+'|front')){busy.classList.add('on');sheetEl.style.opacity=.35}
  clearTimeout(drawT);
  drawT=setTimeout(()=>{
    let r;try{r=buildSheet(false)}catch(e){console.error(e);toast('Teknik resim oluşturulamadı: '+(e.message||e));busy.classList.remove('on');sheetEl.style.opacity=1;return}
    sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;
    if(r.ctx.moved)saveState();  // model değişince yeni yerine taşınan ölçüler kaydedilir
    if(fit)fitSheet();else applyVB();
    busy.classList.remove('on');sheetEl.style.opacity=1;
    renderDwPanel();drawOverlay(null);
  },30);
}
function toSheet(cx,cy){const pt=sheetEl.createSVGPoint();pt.x=cx;pt.y=cy;const q=pt.matrixTransform(sheetEl.getScreenCTM().inverse());return [q.x,q.y]}
function pxToSheet(px){const m=sheetEl.getScreenCTM();return px/(m?m.a:1)}
function zoomAt(p,f){f=Math.max(.02/ (vb.w/420),Math.min(f,8));vb.x=p[0]-(p[0]-vb.x)*f;vb.y=p[1]-(p[1]-vb.y)*f;vb.w*=f;vb.h*=f;applyVB()}
const ptrs=new Map();let pan=null,pinch=null;
sheetEl.addEventListener('pointerdown',e=>{
  sheetEl.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){pan={x:e.clientX,y:e.clientY,vb:{...vb},k:pxToSheet(1),moved:false};
    // araç yokken bir görünüş veya açıklama tutulursa sürüklenir (SolidWorks gibi), boşlukta sayfa kaydırılır
    if(!dimMode&&!dwTool){const h=dwHitAt(toSheet(e.clientX,e.clientY),e.pointerType);if(h)pan.hit=h}}
  else if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),vb:{...vb},mid:toSheet((a.x+b.x)/2,(a.y+b.y)/2)};if(pan){if(pan.hit&&pan.moved)dwDragEnd(pan);pan.hit=null;pan.moved=true}}
});
sheetEl.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y)||1;const f=pinch.d/d;vb={...pinch.vb};zoomAt(pinch.mid,f);return}
  if(ptrs.size===1&&pan){const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.hypot(dx,dy)>4)pan.moved=true;
    if(pan.moved){if(pan.hit&&DW_DRAG.has(pan.hit.t))dwDragMove(pan,dx*pan.k,dy*pan.k);else{vb.x=pan.vb.x-dx*pan.k;vb.y=pan.vb.y-dy*pan.k;applyVB()}}return}
  if((dimMode||dwTool)&&e.pointerType==='mouse')drawOverlay(toSheet(e.clientX,e.clientY));
  else if(e.pointerType==='mouse')dwHover(toSheet(e.clientX,e.clientY));
});
const endPtr=e=>{
  const wasPan=pan;ptrs.delete(e.pointerId);
  if(ptrs.size===0){if(wasPan&&!wasPan.moved&&e.type==='pointerup'){if(dimMode)dimClick(toSheet(e.clientX,e.clientY),e.pointerType);else if(dwTool)dwToolClick(toSheet(e.clientX,e.clientY),e.pointerType);else dwSelect(wasPan.hit||null)}
    else if(wasPan&&wasPan.hit&&wasPan.moved)dwDragEnd(wasPan);
    pan=null;pinch=null}
  else if(ptrs.size===1){if(wasPan&&wasPan.hit&&wasPan.moved)dwDragEnd(wasPan);const [a]=[...ptrs.values()];pan={x:a.x,y:a.y,vb:{...vb},k:pxToSheet(1),moved:true};pinch=null}
};
sheetEl.addEventListener('pointerup',endPtr);sheetEl.addEventListener('pointercancel',endPtr);
sheetEl.addEventListener('wheel',e=>{e.preventDefault();zoomAt(toSheet(e.clientX,e.clientY),Math.pow(1.0015,e.deltaY))},{passive:false});

/* elle ölçü aracı */
let dimMode=false,dimSt={stage:0,p1:null,p2:null};
/* delik etiketi aracı (SolidWorks: Hole Callout): akıllı ölçüyle aynı oturum, yalnızca delik daireleri seçilir */
let dimHc=false;
function nearestSnap(p,tolPx){
  if(!dctx)return null;const tol=pxToSheet(tolPx);let best=null,bd=tol;
  for(const s of dctx.snaps){if(s.hid&&!(dctx.views[s.view]||{}).hidOn)continue;const d=Math.hypot(s.x-p[0],s.y-p[1]);if(d<bd){bd=d;best=s}}return best;
}
/* ölçüde nokta mı kenar mı: imleç tam bir kenarın üzerindeyse ve bir köşeye çok yakın değilse kenar seçilir (SolidWorks gibi).
   Yoksa kısa kenarlarda köşe yakalama toleransı kenarın tamamını kaplar, kenar uzunluğu ölçülemezdi */
function dimSnap(p,tolPx){
  const s=nearestSnap(p,tolPx);if(!s||s.c)return s;
  if(Math.hypot(s.x-p[0],s.y-p[1])>pxToSheet(Math.min(4,tolPx*.45))&&pickLine(p,pxToSheet(Math.min(3,tolPx*.35))))return null;
  return s;
}
function setDimMode(on,hc){
  if(on){setDwTool(null,true);dwSelect(null)}
  dimMode=on;dimHc=!!(on&&hc);dimSt={stage:0,p1:null,p2:null};sheetWrap.classList.toggle('dim',on);
  $$('[data-dcmd="dim"]').forEach(b=>b.classList.toggle('on',on&&!dimHc));$$('[data-dcmd="hcall"]').forEach(b=>b.classList.toggle('on',dimHc));updateDimTip();drawOverlay(null);
}
function updateDimTip(){
  const t=$('#dwTip');if(!dimMode){t.classList.remove('on');return}
  t.classList.add('on');
  t.textContent=dimHc?(dimSt.stage===0?'Delik etiketi: bir deliğin dairesine tıkla. Esc ile çık.':'Etiketin yerine tıkla.'):dimSt.stage===0?'Akıllı ölçü: nokta (kenar ucu, merkez), daire veya kenar seç. Esc ile çık.':dimSt.stage==='dia'?'Çap ölçüsünün yazı yerine tıkla.':dimSt.stage==='edge'?'Boş yere tıkla: kenar uzunluğu. Başka kenar: paralelse aralık, değilse açı. Nokta: noktadan kenara uzaklık.':dimSt.stage==='ang'?'Açı ölçüsünün yayının yerine tıkla (bölgeyi imleç seçer).':dimSt.stage===1?'İkinci noktayı aynı görünüşte seç.':'Ölçü çizgisinin yerini seç. Fareyi noktaların yanına götürürsen dikey, üstüne/altına götürürsen yatay ölçü olur.';
}
/* ilk tıklama: nokta (köşe, daire/yay merkezi), daire (çap), yay (yarıçap) veya kenar. Yayın ortasına tıklanınca yarıçap;
   ucuna çok yakın tıklanınca yayın ucu (nokta) seçilir */
function dimFirst(p,tol){
  if(dimHc){const c=nearestCircle(p,pxToSheet(tol*.6));return c&&c.gid!=null?{c}:null}
  let s=dimSnap(p,tol);const c=nearestCircle(p,pxToSheet(tol*.6));
  // dairenin çevresine tıklanınca (merkez dışında) çap ölçüsü; çevredeki parça uçları nokta sayılmaz
  if(c&&!(s&&s.c))s=null;
  const ar=c?null:nearestArc(p,pxToSheet(tol*.6));
  if(ar&&s&&!s.c&&Math.hypot(s.x-p[0],s.y-p[1])>pxToSheet(Math.min(4,tol*.45)))s=null;
  if(s)return {s};if(c)return {c};if(ar)return {c:ar};
  const e=pickLine(p,pxToSheet(tol));return e?{e}:null;
}
function dimClick(p,ptype){
  const tol=ptype==='mouse'?9:20;
  if(dimSt.stage===0){const h=dimFirst(p,tol);if(!h)return;
    if(h.s){dimSt.p1=h.s;dimSt.stage=1}else if(h.c)dimSt={stage:'dia',c:h.c};else dimSt={stage:'edge',e:h.e}}
  else if(dimSt.stage==='dia'){const c=dimSt.c,v=dctx.views[c.view];const C=v.map(c.a,c.b);
    const d={view:c.view,kind:'dia',c:[c.a,c.b],r:c.r,off:[p[0]-C[0],p[1]-C[1]]};
    // yay: yarıçap ölçüsü (SolidWorks gibi), yazı yayın dışına konursa yay uzantısı çizilir. 180°'den büyük yay (kama kanallı
    // delik) ISO 129-1'e göre çapla ölçülür
    if(c.arc){d.rad=!arcIsBig(c.arc);d.arc=c.arc;d.ref={arc:c.sig,sigs:c.sigs}}else if(c.gid!=null)d.ref={c:circKey(c.gid)};else if(c.sig)d.ref={c:null,s:c.sig};
    if(dimHc)d.hc=true;
    addDim(d);return}
  else if(dimSt.stage==='edge'){const r=edgeSecond(p,tol);if(!r)return;if(r.dim){addDim(r.dim);return}dimSt=r.st}
  else if(dimSt.stage==='ang'){const d=angFromCursor(dimSt.e1,dimSt.e2,p);if(d){d.ref=[edgeRefOf(dimSt.e1),edgeRefOf(dimSt.e2)];addDim(d)}return}
  else if(dimSt.stage===1){const s=nearestSnap(p,tol);
    /* SolidWorks'te seçim sırası önemsizdir: noktadan sonra kenar → noktanın kenara uzaklığı, daire → merkezler arası.
       Önceden yalnızca önce kenar seçilince çalışıyordu; noktadan sonra kenara tıklamak hiçbir şey yapmıyordu */
    if(!s){const c=nearestCircle(p,pxToSheet(tol*.6))||nearestArc(p,pxToSheet(tol*.6));
      if(c&&c.view===dimSt.p1.view){if(Math.hypot(c.a-dimSt.p1.a,c.b-dimSt.p1.b)<1e-6)return;
        const ref=c.arc?{k:'ac',s:c.sig,ss:c.sigs,r:c.r}:c.gid!=null?{k:'c',g:circKey(c.gid)}:null;dimSt.p2=Object.assign(snapObj(c.view,[c.a,c.b]),{c:true,ref});dimSt.stage=2;updateDimTip();drawOverlay(p);return}
      const e=pickLine(p,pxToSheet(tol));if(!e)return;
      if(e.view!==dimSt.p1.view){toast('Nokta ve kenar aynı görünüşte olmalı.');return}
      const P=[dimSt.p1.a,dimSt.p1.b],f=footOn(e,P);if(Math.hypot(f[0]-P[0],f[1]-P[1])<1e-6)return;
      // uç kenar parçasının üstünde (uzatma çizgisi kenara değer), ölçü kenara dik
      dimSt.p2=Object.assign(snapObj(e.view,clampOn(e.A,e.B,P)),{ref:edgeRefOf(e)});dimSt.fk=perpKind(e.u);dimSt.stage=2;updateDimTip();drawOverlay(p);return}
    if(s.view!==dimSt.p1.view){toast('İki nokta aynı görünüşte olmalı.');return}
    if(Math.hypot(s.a-dimSt.p1.a,s.b-dimSt.p1.b)<1e-6)return;
    dimSt.p2=s;dimSt.stage=2}
  else{
    const v=dctx.views[dimSt.p1.view];const c=v.inv(p[0],p[1]);const r=dimPlace(dimSt,c,v);
    const d={view:dimSt.p1.view,p1:[dimSt.p1.a,dimSt.p1.b],p2:[dimSt.p2.a,dimSt.p2.b],kind:r.kind,pos:r.pos};if(r.n)d.n=r.n;if(dimSt.pre)d.pre=dimSt.pre;
    if(dimSt.p1.ref&&dimSt.p2.ref)d.ref=[dimSt.p1.ref,dimSt.p2.ref];
    addDim(d);return;
  }
  updateDimTip();drawOverlay(p);
}
function addDim(d){
  pushDwHist();
  // hangi ucun köşeye/merkeze oturduğu saklanır: model değişince ölçünün eskidiği anlaşılır
  if(d.p1&&dctx){const V=d.view;const at=P=>dctx.snaps.some(s=>s.view===V&&Math.hypot(s.a-P[0],s.b-P[1])<1e-6);d.at=[at(d.p1),at(d.p2)]}
  dwS().dims.push(d);
  saveState();dimSt={stage:0,p1:null,p2:null};updateDimTip();renderDrawing();
}
const tint=(m,c)=>m.replace(/class="d-ar"/g,`class="d-ar" style="fill:${c}"`).replace(/class="d-thin"( style="[^"]*")?/g,`class="d-thin" style="stroke:${c}"`).replace(/class="d-t"/g,`class="d-t" style="fill:${c}"`);
const toBlue=m=>m.replace(/class="d-ar"/g,'class="d-ar" style="fill:#1F6FEB"').replace(/class="d-thin"( style="[^"]*")?/g,'class="d-thin" style="stroke:#1F6FEB"').replace(/class="d-t"/g,'class="d-t" style="fill:#1F6FEB"');
function drawOverlay(p){
  const ov=$('#ov');if(!ov)return;if(dwTool){ov.innerHTML=dwToolOverlay(p);return}if(!dimMode){ov.innerHTML=selOverlay();return}
  let h='';const acc='#1F6FEB';
  if(typeof dimSt.stage==='string'){ov.innerHTML=dimStageOverlay(p);return}
  const dotM=(x,y,r,fill)=>`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${fill}" stroke="${acc}" stroke-width="${f2(pxToSheet(1.5))}"/>`;
  const rr=pxToSheet(5);
  if(dimSt.p1)h+=dotM(dimSt.p1.x,dimSt.p1.y,rr,acc);
  if(dimSt.p2)h+=dotM(dimSt.p2.x,dimSt.p2.y,rr,acc);
  const w=f2(pxToSheet(2));
  const edgeM=e=>{const v=dctx.views[e.view],A=v.map(e.A[0],e.A[1]),B=v.map(e.B[0],e.B[1]);return `<path d="${Lp(A[0],A[1],B[0],B[1])}" stroke="${acc}" stroke-width="${w}" fill="none"/>`};
  if(p&&dimSt.stage===0){// imlecin altındaki: merkez/nokta, daire, yay veya kenar
    const r0=dimFirst(p,9);
    if(r0&&r0.s)h+=dotM(r0.s.x,r0.s.y,rr*1.2,'rgba(31,111,235,.18)');
    else if(r0&&r0.c)h+=curveHi(r0.c,acc,w);
    else if(r0&&r0.e)h+=edgeM(r0.e)}
  else if(p&&dimSt.stage===1){const s=nearestSnap(p,9);if(s)h+=dotM(s.x,s.y,rr*1.2,'rgba(31,111,235,.18)');
    else{const c=nearestCircle(p,pxToSheet(5.4))||nearestArc(p,pxToSheet(5.4));if(c)h+=curveHi(c,acc,w);else{const e=pickLine(p,pxToSheet(9));if(e&&e.view===dimSt.p1.view)h+=edgeM(e)}}}
  if(p&&dimSt.stage===2){
    const v=dctx.views[dimSt.p1.view];const c=v.inv(p[0],p[1]);const r=dimPlace(dimSt,c,v);
    const g=dimGeom({p1:[dimSt.p1.a,dimSt.p1.b],p2:[dimSt.p2.a,dimSt.p2.b],kind:r.kind,pos:r.pos,n:r.n},v);
    h+=`<g style="opacity:.85" filter="none">${dimMarkup(g.P1,g.P2,g.Q1,g.Q2,(dimSt.pre||'')+fmt(g.val)).replace(/#000/g,acc).replace(/class="d-ar"/g,`class="d-ar" style="fill:${acc}"`).replace(/class="d-thin"/g,`class="d-thin" style="stroke:${acc}"`).replace(/class="d-t"/g,`class="d-t" style="fill:${acc}"`)}</g>`;
  }
  ov.innerHTML=h;
}

/* çizim şeridi ve paneli */
function dRb(cmd,icon,label,on){return `<button class="rb ${on?'on':''}" data-dcmd="${cmd}" title="${esc(label)}">${IC[icon]}<span>${label}</span></button>`}
function rctl(label,id,opts,val){return `<label class="rctl"><span>${label}</span><select id="${id}">${opts.map(([k,t])=>`<option value="${k}" ${String(k)===String(val)?'selected':''}>${t}</option>`).join('')}</select></label>`}
let dlCap=null,dwScaleCustom=false;
/* şerit sekmeleri (SolidWorks çizim CommandManager'ı gibi): sheet = görünüş ve açıklamalar, sketch = 2B çizim */
let dwCm='sheet';
function renderDrawRibbon(){
  const S=dwS(),doc=dwDoc();
  $$('#dwTabs button').forEach(b=>b.classList.toggle('on',b.dataset.dwcm===dwCm));
  if(dwCm==='sketch'){$('#drawRibbon').innerHTML=sk2dRibbon(S);fitRibbon($('#drawRibbon'));return}
  const docOpts=[...project.parts.map(p=>['p:'+p.id,'Parça: '+p.partName]),...project.asms.map(a=>['a:'+a.id,'Montaj: '+a.name])];
  const docVal=doc.kind==='asm'?'a:'+doc.a.id:'p:'+state.id;
  $('#drawRibbon').innerHTML=rctl('Belge','dDoc',docOpts.map(([k,t])=>[k,esc(t)]),docVal)+
    rctl('Kağıt','dPaper',[['A4','A4'],['A3','A3'],['A2','A2'],['A1','A1'],['A0','A0']],S.paper)+rctl('Yön','dOrient',[['landscape','Yatay'],['portrait','Dikey']],S.orient||'landscape')+
    rctl('İzdüşüm','dMethod',[['E','ISO E (Avrupa)'],['A','ISO A (Amerikan)']],S.method)+
    rctl('Düzen','dLayout',LAYOUTS.map(([k,t])=>[k,t]),S.layout||'full')+
    rctl('Ölçek','dScale',scaleOpts(S.scale),dwScaleCustom?'custom':S.scale)+(dwScaleCustom?`<label class="rctl"><span>Özel ölçek</span><input id="dScaleIn" value="${esc(dctx&&dctx.scale?scaleLabel(dctx.scale):'1:1')}" placeholder="1:2,5" title="Örnek: 1:2,5 · 3:1 · 1/25 (Enter ile uygula)" autocomplete="off"></label>`:'')+
    (doc.kind==='asm'?'<div class="rsep"></div>'+rctl('Görünüşler','dAsmView',[['std','Ön, üst, yan + izometrik'],['iso','Yalnızca izometrik']],S.asmView||'std')+dRb('explode','explode','Patlatılmış',!!S.explode)+dRb('balloons','balloon','Balonlar',S.balloons!==false)+dRb('bom','bom','Parça listesi',S.bom!==false):'')+
    '<div class="rsep"></div>'+dRb('hidden','hidden','Gizli çizgiler',S.hidden)+dRb('centers','center','Eksen çizgileri',S.centers)+dRb('autodims','autodim','Oto. ölçüler',S.autodims)+dRb('iso','isoView','İzometrik',S.iso)+
    '<div class="rsep"></div>'+(doc.kind==='part'||S.asmView!=='iso'?rctl('Kesit','dSec',[['none','Yok'],['front','Ön görünüş A-A'],['top','Üst görünüş A-A'],['side','Yan görünüş A-A']],S.section||'none'):'')+dRb('dim','dim','Akıllı ölçü',dimMode&&!dimHc)+dRb('hcall','hole','Delik etiketi',dimMode&&dimHc)+dRb('detail','detailv','Detay görünüşü',dwTool==='detail')+dRb('surf','surf','Yüzey işareti',dwTool==='surf')+dRb('gdt','gdt','Geometrik tolerans',dwTool==='gdt')+dRb('datum','datum','Referans',dwTool==='datum')+dRb('note','note','Not ekle',dwTool==='note')+dRb('fit','fit','Sığdır',false)+
    '<div class="rsep"></div>'+dRb('pdf','pdf','PDF olarak al',false)+dRb('dxf','dxf','DXF indir',false)+dRb('svg','svg','SVG indir',false)+dRb('png','png','PNG indir',false);
  fitRibbon($('#drawRibbon'));
}
$('#drawRibbon').addEventListener('change',e=>{
  const S=dwS(),t=e.target;
  // Özel…: değer kutusu açılır, ölçek yazılınca uygulanır
  if(t.id==='dScale'&&t.value==='custom'){dwScaleCustom=true;renderDrawRibbon();const i=$('#dScaleIn');if(i){i.focus();i.select()}return}
  if(t.id==='dScaleIn'){const v=parseScale(t.value);if(v==null){t.style.borderColor='var(--warn)';toast('Ölçek “1:2,5”, “3:1” veya “1/25” biçiminde olmalı.');return}
    pushDwHist();S.scale=String(v);dwScaleCustom=false;saveState();renderDrawRibbon();renderDrawing();return}
  if(t.id!=='dDoc')pushDwHist();
  // çizgi türü: yeni öğeler için; seçili çizim öğesi de bu türe geçer (SolidWorks: Çizgi biçimi)
  if(t.id==='dLtype'){S.skLt=t.value;if(dwSel&&dwSel.t==='sk'&&S.sk2d&&S.sk2d[dwSel.i]&&S.sk2d[dwSel.i].t!=='cmark')S.sk2d[dwSel.i].st=t.value;saveState();renderDrawing();return}
  if(t.id==='dDoc'){const [k,id]=t.value.split(':');if(k==='p'){project.cur.dw={kind:'part',id};switchPart(id)}else project.cur.dw={kind:'asm',id};saveState();renderDrawRibbon();renderDrawing(true);return}
  if(t.id==='dAsmView'){S.asmView=t.value;saveState();renderDrawRibbon();renderDrawing(true);return}
  if(t.id==='dSec'){S.section=t.value;saveState();renderDrawing();renderDwPanel();return}
  if(t.id==='dPaper'){S.paper=t.value;saveState();renderDrawing(true)}
  if(t.id==='dOrient'){S.orient=t.value;saveState();renderDrawing(true)}
  // yan görünüş soldan ↔ sağdan değişir: ona bağlı ölçü ve açıklamalar silinmez, yeni yan görünüşe aynalanarak taşınır
  if(t.id==='dMethod'){const from=S.method==='E'?'left':'right';S.method=t.value;const to=S.method==='E'?'left':'right';if(from!==to)mirrorSideItems(S,from,to);saveState();renderDrawing();renderDwPanel()}
  if(t.id==='dScale'){S.scale=t.value;dwScaleCustom=false;saveState();renderDrawRibbon();renderDrawing()}
  if(t.id==='dLayout'){S.layout=t.value;saveState();renderDrawing(true)}
});
$('#drawRibbon').addEventListener('keydown',e=>{if(e.target.id!=='dScaleIn')return;e.stopPropagation();if(e.key==='Enter'){e.preventDefault();e.target.dispatchEvent(new Event('change',{bubbles:true}))}if(e.key==='Escape'){dwScaleCustom=false;renderDrawRibbon()}});
$('#drawRibbon').addEventListener('click',e=>{
  const b=e.target.closest('[data-dcmd]');if(!b)return;const c=b.dataset.dcmd,S=dwS();
  if(['balloons','bom','hidden','centers','autodims','iso','explode'].includes(c))pushDwHist();
  if(['balloons','bom'].includes(c)){S[c]=S[c]===false;b.classList.toggle('on',S[c]!==false);saveState();renderDrawing();return}
  // patlatılmış görünüm: montajda patlatma adımı yoksa SolidWorks'teki otomatik patlatma gibi adımlar oluşturulur (önceden düğme hiçbir şey yapmıyordu)
  if(c==='explode'&&!S.explode){const doc=dwDoc();if(doc.kind==='asm'){const e=exState(doc.a);if(!e.steps.length){autoExplode(doc.a);if(e.steps.length)toast('Montajda patlatma adımı yoktu; adımlar otomatik oluşturuldu. Montaj sekmesinde Patlatılmış Görünüm ile düzenlenebilir.')}}}
  if(['hidden','centers','autodims','iso','explode'].includes(c)){S[c]=!S[c];b.classList.toggle('on',S[c]);saveState();renderDrawing()}
  else if(c==='dim')setDimMode(!(dimMode&&!dimHc));
  else if(c==='hcall')setDimMode(!(dimMode&&dimHc),true);
  else if(['detail','surf','note','gdt','datum'].includes(c)||SK2D.has(c))setDwTool(dwTool===c?null:c);
  else if(c==='dxf')exportDXF();
  else if(c==='fit')fitSheet();
  else if(c==='svg')exportSVG();
  else if(c==='png')exportPNG();
  else if(c==='pdf')openPdfDialog('2d');
});
function renderDwPanel(){
  const S=dwS(),src=dwSrc();
  const VN={front:'Ön',top:'Üst',left:'Soldan',right:'Sağdan'};
  let h=`<div class="grp"><div class="grp-t">Antet</div>
    <label class="fld"><span>${src.kind==='asm'?'Montaj adı':'Parça adı'}</span><input data-dk="partName" value="${esc(src.name)}"></label>
    <div class="row2"><label class="fld"><span>Resim no</span><input data-dk="dno" value="${esc(S.dno)}"></label><label class="fld"><span>Firma</span><input data-dk="company" value="${esc(S.company)}"></label></div>
    <div class="row2"><label class="fld"><span>Çizen</span><input data-dk="drawn" value="${esc(S.drawn)}"></label><label class="fld"><span>Kontrol</span><input data-dk="checked" value="${esc(S.checked)}"></label></div>
    <p class="note">Malzeme, kütle, ölçek ve tarih modelden otomatik alınır. Malzemeyi 3B Model sekmesindeki ağaçtan değiştir.</p></div>`;
  h+=`<div class="grp"><div class="grp-t">Eklenen ölçüler</div>`;
  if(!S.dims.length)h+=`<p class="note">Şeritteki “Akıllı ölçü” ile iki nokta, bir kenar (uzunluk), iki kenar (aralık veya açı) ya da bir daire (çap) seç, sonra ölçünün yerini göster. Ölçüler ve açıklamalar sürüklenerek taşınır, seçilip Delete ile silinir.</p>`;
  else h+=`<div class="dimlist">${S.dims.map((d,i)=>{const v=dctx&&dctx.views[d.view];const lab=v?dimLabel(d,v):'—';const st=dctx&&dctx.stale&&dctx.stale.has(i);return `<div class="dimrow" style="flex-wrap:wrap"><span${st?' style="color:var(--warn)" title="Model değişti; ölçü artık bir kenara veya noktaya oturmuyor. Silip yeniden ekle."':''}>${VN[d.view]||d.view}: ${esc(lab)}${d.kind==='ang'?'':' mm'}${st?' ⚠':''}</span><button data-deldim="${i}" title="Sil" aria-label="Ölçüyü sil">✕</button>${tolEditor(d,i)}</div>`}).join('')}</div><div style="margin-top:8px"><button class="sbtn" data-deldim="all">Tümünü sil</button></div><p class="note" style="margin-top:6px">Tolerans: ± simetrik, sapma (üst/alt) veya geçme (örneğin H7, g6). Ön ek alanına Ø veya R yazabilirsin; çap ölçüsünde R yazınca yarıçap gösterilir.</p>`;
  if(dctx&&dctx.stale&&dctx.stale.size)h+=`<p class="note" style="color:var(--warn)">${dctx.stale.size} ölçü modele uymuyor (kırmızı, ⚠): parça değiştiği için ölçülen kenar veya nokta artık o konumda değil. Silip yeniden ekle.</p>`;
  h+=`</div>`;
  h+=sk2dPanel(S);
  h+=extraPanel(S);
  if(dctx)h+=`<div class="grp"><div class="grp-t">Sayfa</div><p class="note">Ölçek ${scaleLabel(dctx.scale)}, ${S.method==='E'?'ISO E (birinci açı) izdüşüm: üst görünüş ön görünüşün altında, soldan görünüş sağında.':'ISO A (üçüncü açı) izdüşüm: üst görünüş ön görünüşün üstünde, sağdan görünüş sağında.'}</p><p class="note">Fare tekerleği veya iki parmakla yakınlaştır, sürükleyerek kaydır.</p></div>`;
  $('#dwPanel').innerHTML=h;
}
$('#dwPanel').addEventListener('input',e=>{
  if(extraPanelInput(e)||sk2dInput(e))return;
  const k=e.target.dataset.dk;if(!k)return;
  if(k==='partName'){const d=dwDoc();if(d.kind==='asm')d.a.name=e.target.value;else state.partName=e.target.value}else dwS()[k]=e.target.value;
  saveState();clearTimeout(drawT);drawT=setTimeout(()=>{const r=buildSheet(false);sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;applyVB()},200);
});
$('#dwPanel').addEventListener('change',e=>{if(extraPanelInput(e,true)||sk2dInput(e,true))return;if(e.target.dataset.dk==='partName')renderTree()});
$('#dwPanel').addEventListener('click',e=>{
  if(extraPanelClick(e))return;
  const b=e.target.closest('[data-deldim]');if(!b)return;pushDwHist();
  if(b.dataset.deldim==='all')dwS().dims=[];else dwS().dims.splice(+b.dataset.deldim,1);
  saveState();renderDrawing();
});

/* dışa aktarma */
function exportSVGString(){
  const r=buildSheet(true);const W=r.ctx.W,H=r.ctx.H;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${r.markup}</svg>`;
}
const safeName=()=>(String(dwSrc().name||'parca').trim().replace(/[^\p{L}\p{N}\-_ ]+/gu,'').replace(/\s+/g,'-')||'parca');
async function saveFile(filename,data){
  if(!dlCap){
    // Claude dışında (ör. GitHub Pages): standart tarayıcı indirmesi
    try{const blob=data instanceof Blob?data:new Blob([data],{type:filename.endsWith('.json')?'application/json':filename.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('İndiriliyor: '+filename);return true}
    catch(e){toast('Dosya indirilemedi.');return false}
  }
  try{await dlCap.save({filename,data});toast('Kaydedildi: '+filename);return true}
  catch(e){if(e&&e.code==='declined')return false;toast('Dosya kaydedilemedi'+(e&&e.message?': '+e.message:'.'));return false}
}
function exportSVG(){saveFile(safeName()+'-teknik-resim.svg',exportSVGString())}
function exportPNG(){
  const str=exportSVGString();const P=paperWH(dwS().paper,dwS().orient);const k=6;
  const img=new Image();
  img.onload=()=>{const c=document.createElement('canvas');c.width=P.W*k;c.height=P.H*k;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>{if(b)saveFile(safeName()+'-teknik-resim.png',b);else toast('PNG oluşturulamadı.')},'image/png')};
  img.onerror=()=>toast('PNG oluşturulamadı. SVG olarak indirmeyi dene.');
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str);
}
