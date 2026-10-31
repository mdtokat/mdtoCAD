/* Teknik resim ölçüleri: görünüşteki yaylar (radyus ölçüsü), kenar/nokta kimlikleri ve model değişince elle ölçülerin
   yeniden bağlanması (SolidWorks'teki gibi ölçüler modelle birlikte güncellenir), izdüşüm yöntemi değişince yan görünüş
   açıklamalarının aynalanması. */

/* ================= KENAR İMZASI ================= */
/* görünüşteki bir kenarın kimliği: iki yanındaki yüzeylerin özelliği ve normali. Ölçü değişince kenarın yeri kayar, imzası aynı kalır */
function edgeSig(s){
  const f=p=>p?p.shared+'~'+[p.plane.n.x,p.plane.n.y,p.plane.n.z].map(x=>{const r=Math.round(x*100)/100;return r===0?0:r}).join(','):'';
  return [f(s.pa),f(s.pb)].filter(Boolean).sort().join('|');
}
/* eksen doğrusunun kimliği (model koordinatı): yön işaretsiz, nokta eksene dik izdüşümü; silindirin özelliğinden ve boyundan bağımsız */
function axisKey(A,C){
  let a=A.slice();const l=Math.hypot(a[0],a[1],a[2])||1;a=a.map(x=>x/l);
  const s=Math.abs(a[0])>1e-6?Math.sign(a[0]):Math.abs(a[1])>1e-6?Math.sign(a[1]):Math.sign(a[2])||1;a=a.map(x=>x*s);
  const t=C[0]*a[0]+C[1]*a[1]+C[2]*a[2],p=[C[0]-a[0]*t,C[1]-a[1]*t,C[2]-a[2]*t];
  const r=(x,n)=>{const v=Math.round(x*n)/n;return v===0?0:v};
  return a.map(x=>r(x,1000)).join(',')+'|'+p.map(x=>r(x,100)).join(',');
}
/* dairenin özellik kimliği: yarıçap son eki atılır (çap değişince de aynı daire) */
const circKey=g=>String(g==null?'':g).replace(/:[-\d.]+$/,'');

/* ================= YAYLAR ================= */
/* görünüşün kenar parçalarından yaylar: uç uca gelen, aynı çember üstünde kalan ve aynı yöne dönen en az üç kiriş tek yay sayılır.
   Kapalı halka tam dairedir. Yayın kirişleri işaretlenir (q.arc) ve ara köşeleri (inner) nokta sayılmaz. */
function viewArcs(segs){
  const out=[];out.inner=new Set();
  const K=(x,y)=>Math.round(x*1000)+'_'+Math.round(y*1000);
  // aynı yere düşen kenarlar (ör. üstten bakınca radyusun üst ve alt kenarı) tek sayılır
  const uniq=[],seenK=new Set();
  for(const q of segs){if(Math.hypot(q[2]-q[0],q[3]-q[1])<1e-7)continue;const k1=K(q[0],q[1]),k2=K(q[2],q[3]);const k=k1<k2?k1+'|'+k2:k2+'|'+k1;if(seenK.has(k))continue;seenK.add(k);uniq.push(q)}
  const at=new Map();
  uniq.forEach((q,i)=>{for(const k of [K(q[0],q[1]),K(q[2],q[3])]){let L=at.get(k);if(!L)at.set(k,L=[]);L.push(i)}});
  const used=new Uint8Array(uniq.length);
  const dirAt=(i,k)=>{const q=uniq[i];const s=K(q[0],q[1])===k;const dx=s?q[2]-q[0]:q[0]-q[2],dy=s?q[3]-q[1]:q[1]-q[3],l=Math.hypot(dx,dy)||1;return [dx/l,dy/l]};
  const other=(i,k)=>{const q=uniq[i];return K(q[0],q[1])===k?[q[2],q[3]]:[q[0],q[1]]};
  /* zincir yalnızca iki yönün birleştiği ve 35°'den az dönen köşelerden devam eder. Aynı yöndeki üst üste parçalar (kısmen
     örtüşen kopyalar) tek yön sayılır; en uzunu ile devam edilir */
  const pass=(k,i)=>{const L=at.get(k);if(!L)return -1;const u=dirAt(i,k);let best=-1,bl=-1;
    for(const j of L){if(j===i)continue;const w=dirAt(j,k);if(w[0]*u[0]+w[1]*u[1]>0.9999)continue;  // aynı yöndeki kopya
      if(-(u[0]*w[0]+u[1]*w[1])<=Math.cos(35*Math.PI/180))return -1;  // köşe veya kol: zincir biter
      if(used[j])continue;const q=uniq[j],l=Math.hypot(q[2]-q[0],q[3]-q[1]);if(l>bl){bl=l;best=j}}
    return best};
  const circ3=(A,B,C)=>{const ax=A[0],ay=A[1],bx=B[0],by=B[1],cx=C[0],cy=C[1];const d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-12)return null;
    const a2=ax*ax+ay*ay,b2=bx*bx+by*by,c2=cx*cx+cy*cy;const x=(a2*(by-cy)+b2*(cy-ay)+c2*(ay-by))/d,y=(a2*(cx-bx)+b2*(ax-cx)+c2*(bx-ax))/d;return [x,y,Math.hypot(ax-x,ay-y)]};
  const cross=(P,Q,R)=>{const ux=Q[0]-P[0],uy=Q[1]-P[1],vx=R[0]-Q[0],vy=R[1]-Q[1];const l=Math.hypot(ux,uy)*Math.hypot(vx,vy)||1;return (ux*vy-uy*vx)/l};
  const found=[];
  for(let i0=0;i0<uniq.length;i0++){if(used[i0])continue;used[i0]=1;
    let pts=[[uniq[i0][0],uniq[i0][1]],[uniq[i0][2],uniq[i0][3]]],ids=[i0];let closed=false;
    for(let dir=0;dir<2;dir++){
      for(;;){const e=pts[pts.length-1],k=K(e[0],e[1]),last=ids[ids.length-1];const s0=pts[0];
        if(ids.length>2&&K(s0[0],s0[1])===k){closed=true;break}
        const j=pass(k,last);if(j<0)break;used[j]=1;ids.push(j);pts.push(other(j,k))}
      if(closed)break;pts.reverse();ids.reverse();
    }
    if(ids.length<3)continue;
    // aynı doğru üzerindeki ek yerleri (gizli/görünür geçişi) atılır; kalan noktalar kiriş köşeleridir
    const P=[pts[0]];
    for(let i=1;i<pts.length;i++){if(i<pts.length-1&&Math.abs(cross(P[P.length-1],pts[i],pts[i+1]))<1e-6)continue;P.push(pts[i])}
    if(P.length<4)continue;
    // köşeler tam çemberin üstündedir (kesişim eğrilerinin birkaç köşesi yaklaşık bir çembere uyuyordu): sıkı tolerans
    const fits=(i,j,c)=>{const tol=2e-6*(1+c[2]);let sg=0;for(let t=i;t<=j;t++){if(Math.abs(Math.hypot(P[t][0]-c[0],P[t][1]-c[1])-c[2])>tol)return false;
      if(t>i&&t<j){const x=cross(P[t-1],P[t],P[t+1]);if(Math.abs(x)<1e-6)return false;const s=Math.sign(x);if(sg&&s!==sg)return false;sg=s}}return true};
    const fl=[];let i=0;const m=P.length;
    // teğet uç: komşu kenar yayın o uçtaki teğeti doğrultusunda (radyus, kanal ucu); köşede biten yay teğet değildir
    const nb=t=>t>=0&&t<m?P[t]:closed?P[t<0?m-1+t:t-(m-1)]:null;
    const tanAt=(Q,N,c)=>{if(!N)return false;const dx=Q[0]-N[0],dy=Q[1]-N[1],l=Math.hypot(dx,dy),rx=Q[0]-c[0],ry=Q[1]-c[1],rl=Math.hypot(rx,ry);if(l<1e-9||rl<1e-9)return false;return Math.abs((dx*rx+dy*ry)/(l*rl))<Math.sin(4*Math.PI/180)};
    while(i<m-3){let best=-1,bc=null;
      // kapalı halkanın son noktası ilk noktadır: çember üç farklı noktadan bulunur
      for(let j=i+3;j<m;j++){const c=closed&&i===0&&j===m-1?circ3(P[0],P[Math.floor(m/3)],P[Math.floor(2*m/3)]):circ3(P[i],P[(i+j)>>1],P[j]);if(!c||c[2]>1e5||!fits(i,j,c))break;best=j;bc=c}
      if(best<0){i++;continue}
      fl.push({pp:P.slice(i,best+1),c:bc,full:closed&&i===0&&best===m-1,t0:tanAt(P[i],nb(i-1),bc),t1:tanAt(P[best],nb(best+1),bc)});i=best}
    // kapalı zincirde başa ve sona düşen aynı çemberin parçaları birleşir
    if(closed&&fl.length>1){const f0=fl[0],fz=fl[fl.length-1];
      if(Math.hypot(f0.pp[0][0]-fz.pp[fz.pp.length-1][0],f0.pp[0][1]-fz.pp[fz.pp.length-1][1])<1e-6&&Math.hypot(f0.c[0]-fz.c[0],f0.c[1]-fz.c[1])<1e-4*(1+f0.c[2])&&Math.abs(f0.c[2]-fz.c[2])<1e-4*(1+f0.c[2])){
        fl.pop();fl[0]={pp:fz.pp.concat(f0.pp.slice(1)),c:fz.c,full:false,t0:fz.t0,t1:f0.t1}}}
    found.push(...fl);
  }
  for(const f of found){
    const pp=f.pp,c=f.c;const ang=Q=>Math.atan2(Q[1]-c[1],Q[0]-c[0]);let sw=0;
    for(let t=1;t<pp.length;t++){let dA=ang(pp[t])-ang(pp[t-1]);while(dA>Math.PI)dA-=2*Math.PI;while(dA<-Math.PI)dA+=2*Math.PI;sw+=dA}
    // 10°'den kısa “yaylar” hafif eğri kenarların (kesişim eğrisi, eğik silindir) birkaç köşesidir
    if(!f.full&&Math.abs(sw)<10*Math.PI/180)continue;
    out.push({a:c[0],b:c[1],r:c[2],t0:ang(pp[0]),sw:f.full?2*Math.PI*Math.sign(sw||1):sw,full:f.full,pts:pp,sigs:[],tan:!f.full&&f.t0&&f.t1});
  }
  /* yayın üstündeki bütün parçalar (kopyalar, gizli/görünür bölünmüşleri dahil) işaretlenir; ara köşeleri nokta sayılmaz */
  for(const ar of out){const tol=1e-4*(1+ar.r),S=new Set(),lim=Math.max(tol*2,0.012*ar.r);
    for(const q of segs){if(q.arc)continue;
      const d1=Math.hypot(q[0]-ar.a,q[1]-ar.b),d2=Math.hypot(q[2]-ar.a,q[3]-ar.b),mx=(q[0]+q[2])/2,my=(q[1]+q[3])/2,dm=Math.hypot(mx-ar.a,my-ar.b);
      // kiriş veya parçası: uçları çemberde (bölünmüş parçanın ucu kirişin üstünde, çemberin biraz içinde), kısa ve yayın açı aralığında
      if(d1>ar.r+tol*2||d2>ar.r+tol*2||d1<ar.r-lim||d2<ar.r-lim||dm<ar.r-lim)continue;
      if(Math.hypot(q[2]-q[0],q[3]-q[1])>0.5*ar.r+tol)continue;
      if(!onArcSpan(ar,Math.atan2(my-ar.b,mx-ar.a),1e-6))continue;
      q.arc=ar;if(q[5])S.add(q[5])}
    ar.sigs=[...S].sort();ar.sig=ar.sigs[0]||'';
    const ends=ar.full?[]:[K(ar.pts[0][0],ar.pts[0][1]),K(ar.pts[ar.pts.length-1][0],ar.pts[ar.pts.length-1][1])];
    for(const q of segs)if(q.arc===ar)for(const k of [K(q[0],q[1]),K(q[2],q[3])])if(!ends.includes(k))out.inner.add(k);
  }
  return out;
}
/* açı aralığında mı (yayın süpürdüğü bölge, küçük payla) */
function onArcSpan(ar,th,pad){
  if(ar.full)return true;let d=th-ar.t0;const s=Math.sign(ar.sw)||1;d*=s;d=((d%(2*Math.PI))+2*Math.PI)%(2*Math.PI);
  const span=Math.abs(ar.sw);return d<=span+(pad||0)||d>=2*Math.PI-(pad||0);
}
/* 180°'den büyük yay: çapla ölçülür (ISO 129-1) */
const arcIsBig=ar=>!!ar&&Math.abs(ar.sw)>Math.PI+1e-3;
/* imlecin altındaki yay (tam daire değil; daireler nearestCircle ile) */
function nearestArc(p,tol){
  let best=null,bd=tol;
  for(const v of dwViews())for(const ar of v.d.arcs||[]){if(ar.full||!curveShown(v,null,ar))continue;const C=v.map(ar.a,ar.b);const d=Math.abs(Math.hypot(p[0]-C[0],p[1]-C[1])-ar.r*v.s);if(d>=bd)continue;
    const th=Math.atan2(-(p[1]-C[1]),p[0]-C[0]);if(!onArcSpan(ar,th,0.02))continue;bd=d;best={view:v.key,a:ar.a,b:ar.b,r:ar.r,arc:{t0:ar.t0,sw:ar.sw},sig:ar.sig,sigs:ar.sigs}}
  return best;
}
/* görünüşte annotasyonu olmayan tam daireler (ör. pah veya radyusun uç görünüşteki dairesi): çap ölçüsü verilebilir */
const extraCircs=d=>(d.arcs||[]).filter(ar=>ar.full&&!d.circ.some(q=>Math.hypot(q.a-ar.a,q.b-ar.b)<1e-3&&Math.abs(q.r-ar.r)<1e-3)).map(ar=>({a:ar.a,b:ar.b,r:ar.r,sig:ar.sig}));
/* yarıçap ölçüsü yayın dışına yazılırsa yay uzantısı çizilir (SolidWorks'teki gibi): yayın ucundan kılavuzun değdiği noktaya */
function arcExtPath(d,v,th){
  const ar=d.arc;if(!ar||onArcSpan(ar,th,0))return '';
  const t1=ar.t0+ar.sw;const dist=t=>{let x=(th-t)%(2*Math.PI);if(x>Math.PI)x-=2*Math.PI;if(x<-Math.PI)x+=2*Math.PI;return x};
  const d0=dist(ar.t0),d1=dist(t1);const from=Math.abs(d0)<Math.abs(d1)?ar.t0:t1,sw=Math.abs(d0)<Math.abs(d1)?d0:d1;
  const C=v.map(d.c[0],d.c[1]),R=d.r*v.s;const N=Math.max(2,Math.ceil(Math.abs(sw)/(Math.PI/36)));let p='';
  const pt=t=>[C[0]+R*Math.cos(t),C[1]-R*Math.sin(t)];const e=1.5/Math.max(R,1)*Math.sign(sw);
  for(let i=0;i<N;i++){const A=pt(from+(sw+e)*i/N),B=pt(from+(sw+e)*(i+1)/N);p+=Lp(A[0],A[1],B[0],B[1])}
  return p;
}
/* seçim vurgusu: daire veya yay (sayfa mm) */
function curveHi(c,acc,w){
  const v=dctx.views[c.view],C=v.map(c.a,c.b),R=c.r*v.s;
  if(!c.arc)return `<circle cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(R)}" fill="none" stroke="${acc}" stroke-width="${w}"/>`;
  const N=Math.max(4,Math.ceil(Math.abs(c.arc.sw)/(Math.PI/36)));let d='';
  for(let i=0;i<=N;i++){const t=c.arc.t0+c.arc.sw*i/N;d+=(i?'L':'M')+f2(C[0]+R*Math.cos(t))+' '+f2(C[1]-R*Math.sin(t))}
  return `<path d="${d}" fill="none" stroke="${acc}" stroke-width="${w}"/>`;
}
/* ön ek: R yarıçap, Ø çap yazar (önceden Ø12 ölçüsüne R yazınca “R12” çıkıyordu) */
const dimRad=d=>/^\s*R/i.test(d.pre||'')?true:/^\s*(Ø|ø|⌀)/.test(d.pre||'')?false:!!d.rad;

/* ================= KENARA DİK ÖLÇÜLER ================= */
/* A–B kenar parçası üstünde P'ye en yakın nokta: dik ayak parçanın içine kırpılır. Önceden ayak kenarın uzantısına düşüyor,
   uzatma çizgisi havada başlıyor ve ölçü eklenir eklenmez “modele uymuyor” (kırmızı) görünüyordu */
function clampOn(A,B,P){const dx=B[0]-A[0],dy=B[1]-A[1],l2=dx*dx+dy*dy;let t=l2?((P[0]-A[0])*dx+(P[1]-A[1])*dy)/l2:0;t=Math.max(0,Math.min(1,t));return [A[0]+dx*t,A[1]+dy*t]}
/* kenara dik ölçünün türü: yatay kenar → dikey ölçü (v), dikey kenar → yatay (h), eğik kenar → kenarın normali yönünde hizalı (a, n) */
function perpKind(u){if(Math.abs(u[1])<1e-6)return {kind:'v'};if(Math.abs(u[0])<1e-6)return {kind:'h'};return {kind:'a',n:[-u[1],u[0]]}}
/* iki paralel kenar arası ölçünün uçları: kenarların örtüştüğü aralıkta X'e en yakın yer (iki uzatma çizgisi de kenara değer);
   örtüşmüyorsa birbirine en yakın uçlar */
function parPair(A1,B1,A2,B2,X){
  const l=Math.hypot(B1[0]-A1[0],B1[1]-A1[1])||1,u=[(B1[0]-A1[0])/l,(B1[1]-A1[1])/l],sp=P=>(P[0]-A1[0])*u[0]+(P[1]-A1[1])*u[1];
  const f0=Math.min(sp(A2),sp(B2)),f1=Math.max(sp(A2),sp(B2)),lo=Math.max(0,f0),hi=Math.min(l,f1);let p1;
  if(lo<=hi+1e-9){const t=Math.max(lo,Math.min(hi,sp(X)));p1=[A1[0]+u[0]*t,A1[1]+u[1]*t]}else p1=f1<0?A1.slice():B1.slice();
  return [p1,clampOn(A2,B2,p1)];
}
/* iki paralel kenar yandan görülen bir silindirin (mil, göbek, delik) dış çizgileriyse ölçü çaptır: SolidWorks ve ISO 129-1 gibi
   Ø ile yazılır (önceden ön görünüşte gövdenin iki kenarı arası “46”, üst görünüşte “Ø46” yazılıyordu) */
function silDia(v,p1,p2,u){
  const n=[-u[1],u[0]],w=(p2[0]-p1[0])*n[0]+(p2[1]-p1[1])*n[1],M=[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2];
  for(const c of v.d.side||[]){const L=Math.hypot(c[2]-c[0],c[3]-c[1]);if(L<1e-6)continue;const a=[(c[2]-c[0])/L,(c[3]-c[1])/L],tl=1e-3*(1+c[4]);
    if(Math.abs(a[0]*u[1]-a[1]*u[0])>1e-3||Math.abs(Math.abs(w)-2*c[4])>tl)continue;
    // eksen iki kenarın ortasından geçer
    if(Math.abs((M[0]-c[0])*a[1]-(M[1]-c[1])*a[0])>tl)continue;
    const t=(M[0]-c[0])*a[0]+(M[1]-c[1])*a[1],e=Math.max(tl,0.05*L);if(t<-e||t>L+e)continue;
    return true}
  return false;
}
/* delik etiketi (SolidWorks: Hole Callout): deliğin açıklaması (Ø9 ↧12, ⌴Ø18 ↧2…), görünüşteki aynı delikler n× ile */
function hcLines(d,v){
  const q=v.d.circ.filter(q=>Math.hypot(q.a-d.c[0],q.b-d.c[1])<1e-3&&Math.abs(q.r-d.r)<1e-3).sort((x,y)=>(y.call?1:0)-(x.call?1:0))[0];
  if(!q)return [parTxt(d,(d.pre||'Ø')+fmt(2*d.r))];
  const key=circKey(q.gid),same=[];for(const o of v.d.circ)if(circKey(o.gid)===key&&Math.abs(o.r-q.r)<1e-3&&!same.some(x=>Math.hypot(x.a-o.a,x.b-o.b)<0.01))same.push(o);
  const lines=(q.call||[q.txt||('Ø'+fmt(2*q.r))]).slice();if(same.length>1)lines[0]=same.length+'× '+lines[0];
  if(d.pre)lines[0]=d.pre+lines[0];return lines;
}

/* ================= ELLE ÖLÇÜLERİN MODELE BAĞLANMASI ================= */
/* nokta kimliği: seçilen nokta (snap) veya kenar üzerindeki nokta */
const edgeRefOf=e=>e&&e.sig?{k:'e',s:e.sig,u:e.u.slice()}:null;
/* görünüşte imzası aynı, yönü paralel kenar parçalarından old noktasına en yakın doğru; uç uca devam eden parçalar birleşir */
function lineBySig(v,ref,old){
  const segs=vSegs(v);let best=null,bd=Infinity;const u=ref.u;
  const groups=new Map();
  for(const q of segs){if(q[5]!==ref.s||q.arc)continue;const dx=q[2]-q[0],dy=q[3]-q[1],l=Math.hypot(dx,dy);if(l<1e-7)continue;if(Math.abs(dx/l*u[1]-dy/l*u[0])>1e-3)continue;
    const off=(q[0]-0)*u[1]-(q[1]-0)*u[0];const key=Math.round(off*1000);let g=groups.get(key);if(!g)groups.set(key,g={off,iv:[]});
    const s1=q[0]*u[0]+q[1]*u[1],s2=q[2]*u[0]+q[3]*u[1];g.iv.push([Math.min(s1,s2),Math.max(s1,s2)])}
  const so=old[0]*u[0]+old[1]*u[1],oo=old[0]*u[1]-old[1]*u[0];
  for(const g of groups.values()){g.iv.sort((a,b)=>a[0]-b[0]);const runs=[];for(const iv of g.iv){const r=runs[runs.length-1];if(r&&iv[0]<=r[1]+1e-3)r[1]=Math.max(r[1],iv[1]);else runs.push(iv.slice())}
    for(const r of runs){const ds=so<r[0]?r[0]-so:so>r[1]?so-r[1]:0;const d=Math.hypot(ds,g.off-oo);if(d<bd){bd=d;best={off:g.off,lo:r[0],hi:r[1]}}}}
  if(!best)return null;
  const P=t=>[u[0]*t+u[1]*best.off,u[1]*t-u[0]*best.off];
  return {A:P(best.lo),B:P(best.hi),u:u.slice(),X:P(Math.max(best.lo,Math.min(best.hi,so))),foot:Q=>P(Q[0]*u[0]+Q[1]*u[1])};
}
/* yay kimliği: kirişlerinden birinin imzası ortak (radyus değişince yüzey parçalarının normalleri aynı kalır) */
const sameArc=(ar,s,ss)=>ar.sig===s||(!!ss&&ar.sigs.some(x=>ss.includes(x)));
/* noktayı (köşe, daire/yay merkezi) yeniden bul: aynı kimlikli adaylardan eskisine en yakın */
function pointByRef(v,ref,old,snaps){
  if(!ref)return null;let best=null,bd=Infinity;
  const near=(a,b,w)=>{const d=Math.hypot(a-old[0],b-old[1])-(w||0);if(d<bd){bd=d;best=[a,b]}};
  if(ref.k==='c'){for(const q of v.d.circ)if(circKey(q.gid)===ref.g)near(q.a,q.b)}
  else if(ref.k==='ac'){for(const ar of v.d.arcs||[])if(sameArc(ar,ref.s,ref.ss))near(ar.a,ar.b,0)}
  else if(ref.k==='v'){const want=new Set(ref.s||[]);if(!want.size)return null;
    for(const s of snaps){if(s.view!==v.key||!s.ref||s.ref.k!=='v')continue;const n=s.ref.s.filter(x=>want.has(x)).length;if(!n)continue;
      // ortak imza sayısı önce: köşede birleşen kenarların hepsi aynıysa aynı köşedir
      near(s.a,s.b,n*1e6)}}
  return best;
}
/* bayat ölçüyü yeni geometriye taşır; başarılıysa ölçüyü günceller ve true döner */
function reattachDim(dm,v,snaps){
  const R=dm.ref;if(!R)return false;
  try{
    if(dm.kind==='dia'){
      if(R.c!=null||R.s){let b=null,bd=Infinity;for(const q of v.d.circ.concat(extraCircs(v.d)))if((q.gid!=null?circKey(q.gid)===R.c:q.sig===R.s)){const d=Math.hypot(q.a-dm.c[0],q.b-dm.c[1]);if(d<bd){bd=d;b=q}}
        if(!b)return false;dm.c=[b.a,b.b];dm.r=b.r;return true}
      if(R.arc){let b=null,bd=Infinity;for(const ar of v.d.arcs||[])if(!ar.full&&sameArc(ar,R.arc,R.sigs)){const d=Math.hypot(ar.a-dm.c[0],ar.b-dm.c[1])+Math.abs(ar.r-dm.r);if(d<bd){bd=d;b=ar}}
        if(!b)return false;dm.c=[b.a,b.b];dm.r=b.r;dm.arc={t0:b.t0,sw:b.sw};return true}
      return false}
    if(dm.kind==='ang'){const [r1,r2]=R;if(!r1||!r2)return false;const old=dm.v;
      const L1=lineBySig(v,r1,[old[0]+dm.u1[0]*(dm.e1||1),old[1]+dm.u1[1]*(dm.e1||1)]),L2=lineBySig(v,r2,[old[0]+dm.u2[0]*(dm.e2||1),old[1]+dm.u2[1]*(dm.e2||1)]);if(!L1||!L2)return false;
      const u1=L1.u,u2=L2.u;const den=u1[0]*u2[1]-u1[1]*u2[0];if(Math.abs(den)<1e-9)return false;
      const t=((L2.A[0]-L1.A[0])*u2[1]-(L2.A[1]-L1.A[1])*u2[0])/den;const V=[L1.A[0]+u1[0]*t,L1.A[1]+u1[1]*t];
      const sg=(w,u)=>w[0]*u[0]+w[1]*u[1]<0?[-u[0],-u[1]]:u.slice();const n1=sg(dm.u1,u1),n2=sg(dm.u2,u2);
      const ext=(L,u)=>Math.max(0,...[L.A,L.B].map(P=>(P[0]-V[0])*u[0]+(P[1]-V[1])*u[1]));
      Object.assign(dm,{v:V,u1:n1,u2:n2,e1:ext(L1,n1),e2:ext(L2,n2)});return true}
    // doğrusal ölçüler: kenar uzunluğu ya da iki uç (nokta veya kenar üstü)
    const o1=dm.p1.slice(),o2=dm.p2.slice();let p1=null,p2=null;
    if(R.len){const L=lineBySig(v,R.len,[(o1[0]+o2[0])/2,(o1[1]+o2[1])/2]);if(!L)return false;
      const s=(dm.p2[0]-dm.p1[0])*L.u[0]+(dm.p2[1]-dm.p1[1])*L.u[1];[p1,p2]=s>=0?[L.A,L.B]:[L.B,L.A]}
    else{const [r1,r2]=R;if(!r1||!r2)return false;
      if(r1.k!=='e')p1=pointByRef(v,r1,o1,snaps);if(r2.k!=='e')p2=pointByRef(v,r2,o2,snaps);
      if((r1.k!=='e'&&!p1)||(r2.k!=='e'&&!p2))return false;
      const L1=r1.k==='e'?lineBySig(v,r1,o1):null,L2=r2.k==='e'?lineBySig(v,r2,o2):null;
      if((r1.k==='e'&&!L1)||(r2.k==='e'&&!L2))return false;
      /* kenar üstündeki uç: diğer uç noktaysa ondan kenara dik ayak (kenar parçasının içine kırpılır); iki uç da kenarsa
         örtüştükleri aralıkta. Eski hizalı (n'siz) ölçüler doğrunun uzantısındaki ayakla kalır */
      const old=dm.kind==='a'&&!dm.n;
      if(L1&&L2){if(old){p1=L1.foot(o1);p2=L2.foot(p1)}else [p1,p2]=parPair(L1.A,L1.B,L2.A,L2.B,o1)}
      else if(L1)p1=old?L1.foot(p2):clampOn(L1.A,L1.B,p2);else if(L2)p2=old?L2.foot(p1):clampOn(L2.A,L2.B,p1);
      // eğik kenar döndüyse ölçü yönü de döner
      const L=L1||L2;if(dm.n&&L){const nn=[-L.u[1],L.u[0]];dm.n=nn[0]*dm.n[0]+nn[1]*dm.n[1]<0?[-nn[0],-nn[1]]:nn}}
    if(!p1||!p2||Math.hypot(p2[0]-p1[0],p2[1]-p1[1])<1e-6)return false;
    // ölçü çizgisi en yakın ucuyla birlikte kayar (parça büyüyünce çizgi parçanın içinde kalmasın)
    if(dm.kind==='h'){const near=Math.abs(o1[1]-dm.pos)<Math.abs(o2[1]-dm.pos)?p1[1]-o1[1]:p2[1]-o2[1];dm.pos+=near}
    if(dm.kind==='v'){const near=Math.abs(o1[0]-dm.pos)<Math.abs(o2[0]-dm.pos)?p1[0]-o1[0]:p2[0]-o2[0];dm.pos+=near}
    dm.p1=p1;dm.p2=p2;return true;
  }catch(e){console.warn(e);return false}
}

/* ================= İZDÜŞÜM YÖNTEMİ DEĞİŞİNCE ================= */
/* ISO E'de yan görünüş soldan (a = z), ISO A'da sağdan (a = −z): yan görünüşe bağlı ölçü ve açıklamalar a ekseninde aynalanır.
   Önceden yöntem değişince yan görünüşteki ölçüler, detaylar, yüzey işaretleri, toleranslar ve çizimler sessizce siliniyordu */
function mirrorSideItems(S,from,to){
  const mv=x=>{if(x&&x.view===from){x.view=to;return true}return false};
  const fa=P=>P&&[-P[0],P[1]];
  for(const d of S.dims||[]){if(!mv(d))continue;
    if(d.kind==='dia'){d.c=fa(d.c);if(d.off)d.off=[-d.off[0],d.off[1]];if(d.arc)d.arc={t0:Math.PI-d.arc.t0,sw:-d.arc.sw}}
    else if(d.kind==='ang'){d.v=fa(d.v);d.u1=[-d.u1[0],d.u1[1]];d.u2=[-d.u2[0],d.u2[1]]}
    else{d.p1=fa(d.p1);d.p2=fa(d.p2);if(d.kind==='v')d.pos=-d.pos;else if(d.kind==='a'){d.pos=-d.pos;if(d.n)d.n=[-d.n[0],d.n[1]]}}
    if(d.ref&&d.ref.len)d.ref.len.u=[-d.ref.len.u[0],d.ref.len.u[1]];
    if(Array.isArray(d.ref))for(const r of d.ref)if(r&&r.u)r.u=[-r.u[0],r.u[1]];
    // imzalardaki normaller görünüşten bağımsızdır (model koordinatı); değişmez
  }
  // detay merkezi (c; büyütülmüş görünüşün yeri pos sayfa koordinatıdır), yüzey işareti/tolerans/referans noktası (p) ve yazı kayması (off)
  for(const k of ['details','surfs','gdts','datums'])for(const x of S[k]||[]){if(!mv(x))continue;if(Array.isArray(x.c))x.c=fa(x.c);if(Array.isArray(x.p))x.p=fa(x.p);if(Array.isArray(x.off))x.off=[-x.off[0],x.off[1]]}
  // 2B çizim öğeleri: çizgi uçları (p), daire/yay/merkez işareti merkezi (c); yayın başlangıç açısı ve yönü de aynalanır
  for(const e of S.sk2d||[]){if(!mv(e))continue;if(e.t==='line'&&Array.isArray(e.p))e.p=e.p.map(fa);if(Array.isArray(e.c))e.c=fa(e.c);
    if(e.t==='arc'){e.a0=Math.PI-e.a0;e.sw=-e.sw}}
}
