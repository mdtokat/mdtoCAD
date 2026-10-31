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
  // açıklaması olmayan eğri kenarlar (ekstrüzyonla çıkan yay, radyus, yaylı kesme) kısa parçalar hâlinde gelir: ardışık
  // parçalar bir çemberin üstündeyse tek yay (kapalıysa daire) olur. Önceden yaya tıklamak kirişlerden birini çizgi olarak ekliyordu
  const arcs=edgeArcs(edges.filter(e=>!(onCirc(e.a)&&onCirc(e.b))),eps);
  out.push(...arcs.list);
  // aynı doğru üzerindeki parçalar (yandan görünen daire kenarlarının parçaları, ön ve arka kenarlar) tek çizgide birleşir
  const groups=[];
  for(const e of edges){const d=[e.b[0]-e.a[0],e.b[1]-e.a[1]],L=Math.hypot(d[0],d[1]);if(L<eps*10||(onCirc(e.a)&&onCirc(e.b))||arcs.used(e))continue;
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
/* izdüşürülmüş kenar parçalarından yaylar ve daireler: uç uca eklenen parçalar zincir olur, zincirde art arda üç ve daha
   fazla parça aynı çemberin üstündeyse (parça başına açı eğri bölmesinden büyük değilse, hep aynı yöne dönüyorsa) yaydır.
   Çokgenler (ör. altıgen) parça açısı büyük olduğundan yay sayılmaz. used(e): kenar bir yaya ait mi */
function edgeArcs(edges,eps){
  const K=p=>Math.round(p[0]*1e4)+'_'+Math.round(p[1]*1e4);
  const segs=[],seen=new Set();
  for(const e of edges){const ka=K(e.a),kb=K(e.b);if(ka===kb)continue;const k=ka<kb?ka+'|'+kb:kb+'|'+ka;if(seen.has(k))continue;seen.add(k);segs.push({a:e.a,b:e.b,ka,kb,k})}
  const adj=new Map();for(const s of segs)for(const k of [s.ka,s.kb]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(s)}
  const maxA=Math.max(2*Math.PI/(typeof CURVE_SEG==='number'?CURVE_SEG:64)*1.6,0.21);
  const list=[],usedK=new Set(),vis=new Set();
  const cross=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
  // en küçük kareler çember uydurma (Kasa); konum ve yarıçap 1e-4'e yuvarlanır (ağın kayan nokta gürültüsü)
  const fit=P=>{let sx=0,sy=0;for(const p of P){sx+=p[0];sy+=p[1]}const mx=sx/P.length,my=sy/P.length;
    let suu=0,svv=0,suv=0,suuu=0,svvv=0,suvv=0,svuu=0;
    for(const p of P){const u=p[0]-mx,v=p[1]-my;suu+=u*u;svv+=v*v;suv+=u*v;suuu+=u*u*u;svvv+=v*v*v;suvv+=u*v*v;svuu+=v*u*u}
    const det=suu*svv-suv*suv;if(Math.abs(det)<1e-18)return null;const b1=(suuu+suvv)/2,b2=(svvv+svuu)/2;
    const uc=(b1*svv-b2*suv)/det,vc=(suu*b2-suv*b1)/det;const r4=x=>Math.round(x*1e4)/1e4;
    const c=[r4(uc+mx),r4(vc+my)];let r=0;for(const p of P)r+=Math.hypot(p[0]-c[0],p[1]-c[1]);return {c,r:r4(r/P.length)}};
  for(const s0 of segs){if(vis.has(s0))continue;vis.add(s0);
    // zincir: yalnızca iki parçanın buluştuğu köşelerden devam eder
    const P=[s0.a,s0.b],S=[s0];let closed=false;
    for(const dir of [1,-1]){
      let end=dir>0?s0.kb:s0.ka;
      for(;;){const nb=(adj.get(end)||[]).filter(x=>!vis.has(x));if((adj.get(end)||[]).length!==2||nb.length!==1)break;
        const n=nb[0];vis.add(n);const nxtK=n.ka===end?n.kb:n.ka,nxt=n.ka===end?n.b:n.a;
        if(dir>0){P.push(nxt);S.push(n)}else{P.unshift(nxt);S.unshift(n)}end=nxtK;
        if(end===(dir>0?K(P[0]):K(P[P.length-1]))){closed=true;break}}
      if(closed)break;
    }
    if(S.length<3)continue;
    const onC=(C,r,p)=>Math.abs(Math.hypot(p[0]-C[0],p[1]-C[1])-r)<Math.max(eps*4,r*2e-4,2e-4);
    const segA=(r,p,q)=>2*Math.asin(Math.min(1,Math.hypot(q[0]-p[0],q[1]-p[1])/(2*r)));
    // kapalı zincir (ör. kanal, yuvarlatılmış dikdörtgen) bir yayın ortasından başlıyorsa yay ikiye bölünürdü:
    // başlangıç yayın içinde olmayan bir köşeye kaydırılır
    if(closed){const n=S.length,Q=k=>P[((k%n)+n)%n];
      const inner=k=>{const C=circum(Q(k-1),Q(k),Q(k+1));if(!C)return false;const r=Math.hypot(Q(k)[0]-C[0],Q(k)[1]-C[1]);return (onC(C,r,Q(k+2))||onC(C,r,Q(k-2)))&&segA(r,Q(k-1),Q(k))<=maxA&&segA(r,Q(k),Q(k+1))<=maxA};
      let m=-1;for(let k=0;k<n;k++)if(!inner(k)){m=k;break}
      if(m>0){const P2_=[],S2=[];for(let k=0;k<n;k++){P2_.push(Q(m+k));S2.push(S[(m+k)%n])}P2_.push(Q(m));P.length=0;P.push(...P2_);S.length=0;S.push(...S2)}}
    let i=0;
    while(i+3<=P.length-1){
      const C=circum(P[i],P[i+1],P[i+2]);if(!C){i++;continue}const r=Math.hypot(P[i][0]-C[0],P[i][1]-C[1]);
      const sg=Math.sign(cross(P[i],P[i+1],P[i+2]));
      if(segA(r,P[i],P[i+1])>maxA||segA(r,P[i+1],P[i+2])>maxA){i++;continue}
      let j=i+2;
      while(j+1<P.length&&onC(C,r,P[j+1])&&segA(r,P[j],P[j+1])<=maxA&&Math.sign(cross(P[j-1],P[j],P[j+1]))===sg)j++;
      if(j-i<3){i++;continue}
      const F=fit(P.slice(i,j+1));if(!F){i=j;continue}
      const full=closed&&i===0&&j===P.length-1;
      if(full)list.push({t:'circle',c:F.c,r:F.r,src:'model'});
      else{let a=P[i],b=P[j];if(sg<0)[a,b]=[b,a];
        const on=p=>{const d=[p[0]-F.c[0],p[1]-F.c[1]],l=Math.hypot(d[0],d[1])||1;return [F.c[0]+d[0]/l*F.r,F.c[1]+d[1]/l*F.r]};
        list.push({t:'arc',c:F.c,a:on(a),b:on(b),r:F.r,src:'model'})}
      for(let k=i;k<j;k++)usedK.add(S[k].k);
      i=j;
    }
  }
  return {list,used:e=>{const ka=K(e.a),kb=K(e.b);return usedK.has(ka<kb?ka+'|'+kb:kb+'|'+ka)}};
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
/* dış geometrinin referans öğesi (aynısı çizimde varsa o kullanılır) */
function refEnt(c){
  const f=sk.feat,E=1e-6*(1+Math.abs(c.t==='line'?c.a[0]:c.c[0])+Math.abs(c.t==='line'?c.a[1]:c.c[1])),at=(id,p)=>{const q=P2(id);return Math.hypot(q[0]-p[0],q[1]-p[1])<E};
  const old=f.ents.find(e=>e.ref&&e.t===c.t&&(c.t==='line'?(at(e.a,c.a)&&at(e.b,c.b))||(at(e.a,c.b)&&at(e.b,c.a)):at(e.c,c.c)&&(c.t==='circle'?Math.abs(e.r-c.r)<E:at(e.a,c.a)&&at(e.b,c.b))));
  if(old)return old;
  if(c.t==='line')return addEnt({t:'line',a:refPt(c.a),b:refPt(c.b),cons:true,ref:true});
  if(c.t==='circle')return addEnt({t:'circle',c:refPt(c.c),r:c.r,cons:true,ref:true});
  return addEnt({t:'arc',c:refPt(c.c),a:refPt(c.a),b:refPt(c.b),cons:true,ref:true});
}
/* dış geometriyi çizime sabit referans olarak ekler; seçim için isabet döndürür */
function addRef(c){
  const f=sk.feat;skPush();let h;
  if(c.t==='pt'){const id=refPt(c.p);if(id!=='O'&&!f.ents.some(e=>[e.a,e.b,e.c].includes(id)))Object.assign(f.pts[id],{sp:true,ref:true});h={k:'pt',id}}
  else h={k:'ent',id:refEnt(c).id};
  analyze();sk.dirty=true;return h;
}
/* çizim araçlarında dış geometriye yakalama (SolidWorks'teki çıkarım gibi): arkadaki modelin köşeleri, daire ve yay merkezleri,
   diğer çizimlerin noktaları; bunlar yoksa kenarlar. Tıklanınca köşe/merkez sabit referans noktası olur ve yeni öğe ona
   bağlanır; kenara tıklanınca kenar referans olarak eklenir, nokta onun üstünde kalır (resolvePt). Önceden araçlar modeli
   görmüyordu: tabanın üst kenarına çizilen profil veya deliğin merkezine konan daire ona bağlanmıyor, ölçü değişince kopuyordu */
// Ctrl basılıyken model ve diğer çizimlerin geometrisine yakalanmaz (SolidWorks'te Ctrl çıkarımları kapatır)
let skNoExt=false;
function extSnapPts(){
  if(sk.extP)return sk.extP;const out=[],seen=new Set();
  const add=p=>{const k=Math.round(p[0]*1e4)+'_'+Math.round(p[1]*1e4);if(seen.has(k))return;seen.add(k);out.push(p)};
  for(const c of extCandidates()){if(c.t==='pt')add(c.p);else if(c.t==='line'){add(c.a);add(c.b)}else{add(c.c);if(c.t==='arc'){add(c.a);add(c.b)}}}
  return sk.extP=out;
}
function extSnapPt(q,tol){
  if(skNoExt)return null;let best=null,bd=tol;for(const p of extSnapPts()){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best=p}}
  return best?{x:best[0],y:best[1],ext:{p:best}}:null;
}
function extProj(c,q){
  if(c.t==='line')return segD(q,c.a,c.b)[1];
  const d=[q[0]-c.c[0],q[1]-c.c[1]],l=Math.hypot(d[0],d[1])||1;return [c.c[0]+d[0]/l*c.r,c.c[1]+d[1]/l*c.r];
}
function extSnapOn(q,tol,from){
  if(skNoExt)return null;let best=null,bd=tol;for(const c of extCandidates()){if(c.t==='pt')continue;const d=candDist(c,q);if(d<bd){bd=d;best=c}}
  if(!best)return null;
  // başlangıçtan yatay/dikey: kenarı kestiği nokta (kenar o yöne paralelse yatay/dikey ilişkisi gereksiz, eklenmez)
  if(from)for(const [k,hv] of [[0,'v'],[1,'h']]){const c0=from[k],o=1-k;if(Math.abs(q[k]-c0)>=tol)continue;const ys=[];
    if(best.t==='line'){const a=best.a,b=best.b,den=b[k]-a[k];if(Math.abs(den)<1e-9)continue;const t=(c0-a[k])/den;if(t<-1e-9||t>1+1e-9)continue;ys.push(a[o]+t*(b[o]-a[o]))}
    else{const dd=c0-best.c[k];if(Math.abs(dd)>best.r)continue;const sq=Math.sqrt(best.r*best.r-dd*dd);ys.push(best.c[o]+sq,best.c[o]-sq)}
    let bp=null,bq=tol;for(const y of ys){const p=k===0?[c0,y]:[y,c0];if(candDist(best,p)>1e-6*(1+Math.abs(p[0])+Math.abs(p[1])))continue;const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bq){bq=d;bp=p}}
    if(bp)return {x:bp[0],y:bp[1],hv,ext:{c:best}}}
  // yatay/dikey kenarda ızgara yakalaması kenar boyunca sürer (kenara tıklayınca konum ızgaraya oturur)
  const p=best.t==='line'?gridAlong(best.a,best.b,extProj(best,q),tol/0.6):extProj(best,q);
  return {x:p[0],y:p[1],ext:{c:best}};
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
