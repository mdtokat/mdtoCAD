/* Teknik resimde 2B çizim (SolidWorks çizim ortamındaki Çizim sekmesi gibi): çizgi, eksen çizgisi, dikdörtgen, daire, yay, merkez işareti ve çizgi türleri.
   Öğeler yalnızca resme aittir, modeli değiştirmez (dwS().sk2d). Görünüşün içinde çizilen veya görünüşün köşesine/kenarına/merkezine yakalanan öğe
   o görünüşe bağlanır: koordinatları görünüş koordinatıdır (model mm), görünüşle birlikte taşınır ve ölçeklenir. Diğerleri sayfaya bağlıdır (sayfa mm). */
IC.cmark=sv('<circle cx="12" cy="12" r="6"/><path d="M12 2.5v5.5M12 16v5.5M2.5 12H8M16 12h5.5M10.5 12h3M12 10.5v3"/>');
const LTYPES=[['vis','Kalın sürekli'],['thin','İnce sürekli'],['hid','Kesikli (gizli)'],['cen','Eksen (zincir)']];
const LT_CLS={vis:'d-vis',thin:'d-thin',hid:'d-hid',cen:'d-cen'};
const SK_NAMES={line:'Çizgi',circ:'Daire',arc:'Yay',cmark:'Merkez işareti'};

/* öğenin çerçevesi: görünüşe bağlıysa görünüşün eşlemesi, değilse sayfa (birim) */
function dskFrame(e,ctx){
  ctx=ctx||dctx;if(!e.view)return {s:1,map:(a,b)=>[a,b],inv:(x,y)=>[x,y],flip:1,v:null};
  const v=ctx&&ctx.views[e.view];return v&&v.key!=='iso'?{s:v.s,map:v.map,inv:v.inv,flip:-1,v}:null;
}
/* sayfa koordinatında geometri: segs çizgiler, poly yay, circ daire [merkez, yarıçap], pts yakalama noktaları, cen merkez */
function dskGeom(e,F){
  const M=q=>F.map(q[0],q[1]);
  if(e.t==='line'){const A=M(e.p[0]),B=M(e.p[1]);return {segs:[[A,B]],pts:[A,B,[(A[0]+B[0])/2,(A[1]+B[1])/2]]}}
  if(e.t==='circ'){const C=M(e.c);return {circ:[C,e.r*F.s],pts:[C],cen:C}}
  if(e.t==='arc'){const C=M(e.c),n=Math.max(8,Math.ceil(Math.abs(e.sw)/(Math.PI/36)));const poly=[];
    for(let i=0;i<=n;i++){const t=e.a0+e.sw*i/n;poly.push(F.map(e.c[0]+e.r*Math.cos(t),e.c[1]+e.r*Math.sin(t)))}
    return {poly,pts:[C,poly[0],poly[n]],cen:C}}
  if(e.t==='cmark'){const C=M(e.c),R=e.r*F.s+2.5;return {segs:[[[C[0]-R,C[1]],[C[0]+R,C[1]]],[[C[0],C[1]-R],[C[0],C[1]+R]]],pts:[C],cen:C}}
  return null;
}
const segDist=(p,A,B)=>{const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));return Math.hypot(A[0]+dx*t-p[0],A[1]+dy*t-p[1])};
function dskDist(g,p){
  let d=Infinity;for(const [A,B] of g.segs||[])d=Math.min(d,segDist(p,A,B));
  if(g.poly)for(let i=0;i+1<g.poly.length;i++)d=Math.min(d,segDist(p,g.poly[i],g.poly[i+1]));
  if(g.circ){const [C,R]=g.circ,r=Math.hypot(p[0]-C[0],p[1]-C[1]);d=Math.min(d,Math.abs(r-R),r)}
  if(g.cen)d=Math.min(d,Math.hypot(p[0]-g.cen[0],p[1]-g.cen[1]));
  return d;
}
const polyD=P=>P.map((q,i)=>(i?'L':'M')+f2(q[0])+' '+f2(q[1])).join('');
function dskPath(e,g){
  const cls=LT_CLS[e.t==='cmark'?'cen':e.st]||'d-thin';let d='',o='';
  for(const [A,B] of g.segs||[])d+=Lp(A[0],A[1],B[0],B[1]);
  if(g.poly)d+=polyD(g.poly);
  if(d)o+=`<path class="${cls}" d="${d}"/>`;
  if(g.circ)o+=`<circle class="${cls}" cx="${f2(g.circ[0][0])}" cy="${f2(g.circ[0][1])}" r="${f2(g.circ[1])}"/>`;
  return o;
}
function dskBox(g){
  const P=[];for(const [A,B] of g.segs||[])P.push(A,B);if(g.poly)P.push(...g.poly);if(g.circ){const [C,R]=g.circ;P.push([C[0]-R,C[1]-R],[C[0]+R,C[1]+R])}
  return [Math.min(...P.map(q=>q[0])),Math.min(...P.map(q=>q[1])),Math.max(...P.map(q=>q[0])),Math.max(...P.map(q=>q[1]))];
}
/* sayfaya çizilir; görünüşe bağlı öğelerin noktaları akıllı ölçüye (ctx.snaps) ve kenarları kenar/daire seçimine (v.sk) katılır */
function sk2dMarkup(S,ctx){
  let o='';ctx.skPts=[];for(const v of Object.values(ctx.views))v.sk={segs:[],circ:[]};
  (S.sk2d||[]).forEach((e,i)=>{
    const F=dskFrame(e,ctx);if(!F)return;const g=dskGeom(e,F);if(!g)return;
    o+=dskPath(e,g);
    ctx.hits.push({t:'sk',i,box:dskBox(g),dist:p=>dskDist(g,p)});
    if(!F.v){for(const P of g.pts)ctx.skPts.push({x:P[0],y:P[1],sk:i,c:P===g.cen});return}
    const v=F.v,L=P=>v.inv(P[0],P[1]);
    for(const P of g.pts){const [a,b]=L(P);ctx.snaps.push({view:e.view,a,b,x:P[0],y:P[1],c:P===g.cen,sk:i})}
    if(e.t==='line'){const A=e.p[0],B=e.p[1];v.sk.segs.push([A[0],A[1],B[0],B[1]])}
    else if(e.t==='circ')v.sk.circ.push({a:e.c[0],b:e.c[1],r:e.r});
    // yay uçları ve merkez işareti: ölçünün oturduğu nokta olarak (sıfır boylu parça)
    else for(const P of g.pts.slice(e.t==='arc'?1:0)){const [a,b]=L(P);v.sk.segs.push([a,b,a,b])}
  });
  return o;
}

/* yakalama: noktalar (köşe, merkez, çizim öğesinin uçları ve ortası) > kenar ortası > kenar üstü > serbest (yatay/dikey hizalanır) */
function dskSnap(p,ptype,from,opt){
  opt=opt||{};const tol=pxToSheet(ptype==='mouse'?9:20);let best=null,bd=tol;
  const tryPt=(x,y,view,kind,edge)=>{const d=Math.hypot(x-p[0],y-p[1]);if(d<bd){bd=d;best={p:[x,y],view,kind,edge}}};
  for(const s of dctx.snaps)if(opt.ex==null||s.sk!==opt.ex)tryPt(s.x,s.y,s.view,s.c?'cen':'pt');
  for(const s of dctx.skPts||[])if(opt.ex==null||s.sk!==opt.ex)tryPt(s.x,s.y,null,s.c?'cen':'pt');
  if(best||opt.pointsOnly)return best||{p:p.slice(),view:null,kind:'free'};
  const e=pickLine(p,tol);
  if(e){const v=dctx.views[e.view];const M=v.map((e.A[0]+e.B[0])/2,(e.A[1]+e.B[1])/2);tryPt(M[0],M[1],e.view,'mid',e);if(best)return best;
    const X=v.map(e.X[0],e.X[1]);bd=Math.hypot(X[0]-p[0],X[1]-p[1]);best={p:X,view:e.view,kind:'edge',edge:e}}
  const c=nearestCircle(p,best?bd:tol);
  if(c){const v=dctx.views[c.view],C=v.map(c.a,c.b),l=Math.hypot(p[0]-C[0],p[1]-C[1])||1,R=c.r*v.s;best={p:[C[0]+(p[0]-C[0])/l*R,C[1]+(p[1]-C[1])/l*R],view:c.view,kind:'edge'};bd=Math.hypot(best.p[0]-p[0],best.p[1]-p[1])}
  // sayfaya bağlı çizgi ve daireler
  (dwS().sk2d||[]).forEach((en,i)=>{if(en.view||i===opt.ex)return;const g=dskGeom(en,dskFrame(en));if(!g)return;
    for(const [A,B] of g.segs||[]){const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;if(!L2)continue;const t=Math.max(0,Math.min(1,((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2));const X=[A[0]+dx*t,A[1]+dy*t],d=Math.hypot(X[0]-p[0],X[1]-p[1]);if(d<bd){bd=d;best={p:X,view:null,kind:'edge'}}}
    if(g.circ){const [C,R]=g.circ,l=Math.hypot(p[0]-C[0],p[1]-C[1])||1,d=Math.abs(l-R);if(d<bd){bd=d;best={p:[C[0]+(p[0]-C[0])/l*R,C[1]+(p[1]-C[1])/l*R],view:null,kind:'edge'}}}});
  if(best)return best;
  const q=p.slice();let kind='free';
  if(from){const dx=q[0]-from[0],dy=q[1]-from[1],k=Math.tan(3*Math.PI/180);if(Math.abs(dy)<=Math.abs(dx)*k&&dx){q[1]=from[1];kind='h'}else if(Math.abs(dx)<=Math.abs(dy)*k&&dy){q[0]=from[0];kind='v'}}
  return {p:q,view:null,kind};
}
/* öğe hangi görünüşe bağlanır: yakalanan ilk görünüş geometrisi, yoksa noktanın içinde kaldığı ilk görünüş */
function dskOwner(sns){for(const s of sns)if(s.view&&dctx.views[s.view]&&s.view!=='iso')return s.view;for(const s of sns){const v=viewAt(s.p);if(v)return v.key}return null}
const dskLocal=(view,P)=>view?dctx.views[view].inv(P[0],P[1]):[P[0],P[1]];
const dskScale=view=>view?dctx.views[view].s:1;
function dskAdd(list){pushDwHist();const S=dwS();S.sk2d=S.sk2d||[];S.sk2d.push(...list);saveState();renderDrawing()}
/* iki paralel kenarın ortasından geçen eksen çizgisi (SolidWorks: Merkez çizgisi): kenarların ortak boyunca, uçlarda 3 mm taşar */
function dskMidline(a,b){
  const e=a&&a.edge,f=b&&b.edge;if(!e||!f||e.view!==f.view||sameLine(e,f))return null;
  if(Math.abs(e.u[0]*f.u[1]-e.u[1]*f.u[0])>1e-3)return null;
  const u=e.u,n=[-u[1],u[0]],om=((e.A[0]+f.A[0])*n[0]+(e.A[1]+f.A[1])*n[1])/2;
  const ts=[e.A,e.B,f.A,f.B].map(P=>P[0]*u[0]+P[1]*u[1]);const x=3/dctx.views[e.view].s,lo=Math.min(...ts)-x,hi=Math.max(...ts)+x;
  const P=t=>[u[0]*t+n[0]*om,u[1]*t+n[1]*om];
  return {t:'line',view:e.view,p:[P(lo),P(hi)],st:'cen'};
}
function dskArc(c,s,sw){const view=dskOwner([c,s]),F=view?dctx.views[view]:null,flip=view?-1:1;
  const C=dskLocal(view,c.p),A=dskLocal(view,s.p);return {t:'arc',view,c:C,r:Math.hypot(A[0]-C[0],A[1]-C[1]),a0:Math.atan2(A[1]-C[1],A[0]-C[0]),sw:sw*flip}}
const normAng=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<=-Math.PI)d+=2*Math.PI;return d};
/* yay: fare gittiği yönde süpürür (önizlemede biriktirilir) */
function dskSweep(p){const st=dwSt,C=st.pts[0].p,th=Math.atan2(p[1]-C[1],p[0]-C[0]);
  if(st.sw==null){const S0=st.pts[1].p;st.th=Math.atan2(S0[1]-C[1],S0[0]-C[0]);st.sw=0}
  st.sw=Math.max(-2*Math.PI,Math.min(2*Math.PI,st.sw+normAng(th-st.th)));st.th=th;return st.sw}
function dskBuild(p,ptype,commit){
  const t=dwTool,st=dwSt,pts=st.pts||[];const last=pts.length?pts[pts.length-1].p:null;
  const sn=dskSnap(p,ptype,t==='sline'||t==='scen'?last:null);const lt=dwS().skLt||'thin';const out={sn,ents:null};
  if(!pts.length)return out;
  if(t==='sline'||t==='scen'){const a=pts[0];if(Math.hypot(sn.p[0]-a.p[0],sn.p[1]-a.p[1])<1e-6)return out;
    const ml=t==='scen'?dskMidline(a,sn):null;if(ml){out.ents=[ml];return out}
    const view=dskOwner([a,sn]);out.ents=[{t:'line',view,p:[dskLocal(view,a.p),dskLocal(view,sn.p)],st:t==='scen'?'cen':lt}]}
  else if(t==='srect'){const a=pts[0].p,b=sn.p;if(Math.abs(a[0]-b[0])<1e-6||Math.abs(a[1]-b[1])<1e-6)return out;
    const view=dskOwner([pts[0],sn]);const Q=[a,[b[0],a[1]],b,[a[0],b[1]]].map(P=>dskLocal(view,P));out.ents=Q.map((P,i)=>({t:'line',view,p:[P,Q[(i+1)%4]],st:lt}))}
  else if(t==='scirc'){const c=pts[0];const R=Math.hypot(sn.p[0]-c.p[0],sn.p[1]-c.p[1]);if(R<1e-3)return out;
    const view=dskOwner([c,sn]);out.ents=[{t:'circ',view,c:dskLocal(view,c.p),r:R/dskScale(view),st:lt}]}
  else if(t==='sarc'){if(pts.length===1){out.radius=true;return out}
    const C=pts[0].p;const sw=commit&&st.sw==null?normAng(Math.atan2(sn.p[1]-C[1],sn.p[0]-C[0])-Math.atan2(pts[1].p[1]-C[1],pts[1].p[0]-C[0])):dskSweep(sn.p);
    if(Math.abs(sw)<1e-3)return out;out.ents=[Object.assign(dskArc(pts[0],pts[1],sw),{st:lt})]}
  return out;
}
function dskToolClick(p,ptype){
  const t=dwTool,st=dwSt;st.pts=st.pts||[];
  if(t==='scmark'){
    const c=nearestCircle(p,pxToSheet(ptype==='mouse'?6:14));if(c){dskAdd([{t:'cmark',view:c.view,c:[c.a,c.b],r:c.r}]);return}
    const sn=dskSnap(p,ptype,null,{pointsOnly:true});if(sn.kind==='cen'||sn.kind==='pt'){const view=dskOwner([sn]);dskAdd([{t:'cmark',view,c:dskLocal(view,sn.p),r:2.5/dskScale(view)}]);return}
    toast('Bir daireye veya merkez noktasına tıkla.');return}
  const r=dskBuild(p,ptype,true);
  if(!st.pts.length||(t==='sarc'&&r.radius)){
    if(t==='sarc'&&st.pts.length&&Math.hypot(r.sn.p[0]-st.pts[0].p[0],r.sn.p[1]-st.pts[0].p[1])<1e-3)return;
    st.pts.push(r.sn);st.stage=st.pts.length;st.sw=null;dwTip();drawOverlay(p);return}
  if(!r.ents){// çizgide aynı noktaya ikinci tıklama zinciri bitirir
    if(t==='sline'){dwSt={stage:0};dwTip();drawOverlay(p)}return}
  dskAdd(r.ents);
  // çizgi zincir olarak devam eder; diğerleri yeni öğeye başlar
  dwSt=t==='sline'?{stage:1,pts:[r.sn]}:{stage:0};dwTip();
}
function dskMarker(sn){
  const acc='#1F6FEB',w=f2(pxToSheet(1.5)),r=pxToSheet(5),[x,y]=sn.p;
  if(sn.kind==='pt'||sn.kind==='cen')return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="rgba(31,111,235,.2)" stroke="${acc}" stroke-width="${w}"/>`;
  if(sn.kind==='mid')return `<path d="M${f2(x)} ${f2(y-r)}L${f2(x+r)} ${f2(y+r*.8)}L${f2(x-r)} ${f2(y+r*.8)}Z" fill="rgba(31,111,235,.2)" stroke="${acc}" stroke-width="${w}"/>`;
  if(sn.kind==='edge')return `<path d="${Lp(x-r*.7,y-r*.7,x+r*.7,y+r*.7)}${Lp(x-r*.7,y+r*.7,x+r*.7,y-r*.7)}" stroke="${acc}" stroke-width="${w}"/>`;
  if(sn.kind==='h'||sn.kind==='v')return `<text x="${f2(x+r)}" y="${f2(y-r)}" font-size="${f2(pxToSheet(11))}" fill="${acc}">${sn.kind==='h'?'—':'|'}</text>`;
  return '';
}
const dskBlue=m=>m.replace(/class="d-(vis|thin|hid|cen)"/g,(s,k)=>`${s} style="stroke:#1F6FEB"`);
function dskOverlay(p){
  if(!p||!dctx)return '';const t=dwTool,st=dwSt,pts=st.pts||[];
  if(t==='scmark'){const c=nearestCircle(p,pxToSheet(6));if(c){const v=dctx.views[c.view],C=v.map(c.a,c.b);return `<circle cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(c.r*v.s)}" fill="none" stroke="#1F6FEB" stroke-width="${f2(pxToSheet(2))}"/>`}
    const sn=dskSnap(p,'mouse',null,{pointsOnly:true});return sn.kind==='free'?'':dskMarker(sn)}
  const r=dskBuild(p,'mouse',false);let h=dskMarker(r.sn);
  if(r.radius){const C=pts[0].p;h+=`<path d="${Lp(C[0],C[1],r.sn.p[0],r.sn.p[1])}" stroke="#1F6FEB" stroke-width="${f2(pxToSheet(1))}" stroke-dasharray="${f2(pxToSheet(4))}"/>`}
  for(const e of r.ents||[]){const F=dskFrame(e);const g=F&&dskGeom(e,F);if(g)h+=dskBlue(dskPath(e,g))}
  return h;
}
function dskTip(){
  const st=dwSt.stage||0,t=dwTool;
  const T={sline:['Çizgi: başlangıç noktasına tıkla. Köşe, merkez, kenar ortası ve kenarlara yakalanır; yatay/dikey yakınında hizalanır.','Bitiş noktasına tıkla; çizgi zincir olarak devam eder. Aynı noktaya tıkla veya Esc ile zinciri bitir.'],
    scen:['Eksen çizgisi: iki nokta seç ya da iki paralel kenara tıkla (aralarına orta eksen çizilir).','İkinci noktaya veya birinci kenara paralel kenara tıkla.'],
    srect:['Dikdörtgen: ilk köşeye tıkla.','Karşı köşeye tıkla.'],
    scirc:['Daire: merkeze tıkla (ör. delik merkezi veya delik dairesinin merkezi).','Yarıçap noktasına tıkla (ör. bir deliğin merkezi). Çap soldaki panelden de yazılır.'],
    sarc:['Yay: merkeze tıkla.','Yayın başlangıç noktasına tıkla.','Yayın bitişine tıkla; yay fareyi götürdüğün yönde çizilir.'],
    scmark:['Merkez işareti: bir daireye veya merkez noktasına tıkla.']}[t]||[''];
  return T[Math.min(st,T.length-1)]+' Esc ile çık.';
}

/* seçim, tutamaklar ve sürükleme */
function dskHitGrip(h,p,pad){
  const e=dwS().sk2d[h.i],F=e&&dskFrame(e);if(!F)return h;const g=dskGeom(e,F);const near=P=>Math.hypot(P[0]-p[0],P[1]-p[1])<=pad+pxToSheet(3);
  let grip=null;
  if(e.t==='line'){if(near(g.pts[0]))grip='p0';else if(near(g.pts[1]))grip='p1'}
  else if(e.t==='circ'&&!near(g.cen))grip='r';
  return Object.assign({},h,{grip,p0:p.slice()});
}
function dskDrag(S,O,h,dx,dy){
  const e=S.sk2d&&S.sk2d[h.i],o=O.sk2d&&O.sk2d[h.i];if(!e||!o||!h.p0)return;const F=dskFrame(o);if(!F)return;
  const P1=[h.p0[0]+dx,h.p0[1]+dy];
  if(h.grip==='p0'||h.grip==='p1'){const sn=dskSnap(P1,'mouse',null,{pointsOnly:true,ex:h.i});const j=+h.grip[1];e.p=clone(o.p);e.p[j]=F.inv(sn.p[0],sn.p[1]);return}
  if(h.grip==='r'){const C=F.map(o.c[0],o.c[1]);e.r=Math.max(1e-3,Math.hypot(P1[0]-C[0],P1[1]-C[1])/F.s);return}
  const A=F.inv(h.p0[0],h.p0[1]),B=F.inv(P1[0],P1[1]),d=[B[0]-A[0],B[1]-A[1]],mv=q=>[q[0]+d[0],q[1]+d[1]];
  if(o.p)e.p=o.p.map(mv);if(o.c)e.c=mv(o.c);
}
function dskSelOverlay(i){
  const e=(dwS().sk2d||[])[i],F=e&&dskFrame(e);if(!F)return '';const g=dskGeom(e,F);if(!g)return '';
  const w=f2(Math.max(.6,pxToSheet(2.2))),r=pxToSheet(3.5);let m=dskBlue(dskPath(e,g)).replace(/style="stroke:#1F6FEB"/g,`style="stroke:#1F6FEB;stroke-width:${w}"`);
  for(const P of e.t==='line'?g.pts.slice(0,2):g.pts)m+=`<rect x="${f2(P[0]-r/2)}" y="${f2(P[1]-r/2)}" width="${f2(r)}" height="${f2(r)}" fill="#fff" stroke="#1F6FEB" stroke-width="${f2(pxToSheet(1.2))}"/>`;
  return m;
}

/* şerit (Çizim sekmesi) ve panel */
function sk2dRibbon(S){
  return dRb('sline','line','Çizgi',dwTool==='sline')+dRb('scen','centerline','Eksen çizgisi',dwTool==='scen')+dRb('srect','rect','Dikdörtgen',dwTool==='srect')+dRb('scirc','circle','Daire',dwTool==='scirc')+dRb('sarc','arc','Merkez noktalı yay',dwTool==='sarc')+
    '<div class="rsep"></div>'+dRb('scmark','cmark','Merkez işareti',dwTool==='scmark')+
    '<div class="rsep"></div>'+rctl('Çizgi türü','dLtype',LTYPES,S.skLt||'thin')+
    '<div class="rsep"></div>'+dRb('dim','dim','Akıllı ölçü',dimMode)+dRb('fit','fit','Sığdır',false);
}
function dskSize(e){const L=e.view?'':' (sayfa)';
  if(e.t==='line')return ['Boy'+L,Math.hypot(e.p[1][0]-e.p[0][0],e.p[1][1]-e.p[0][1])];
  if(e.t==='circ')return ['Ø'+L,e.r*2];if(e.t==='arc')return ['R'+L,e.r];return null}
function sk2dPanel(S){
  const L=S.sk2d||[];if(!L.length&&dwCm!=='sketch')return '';
  const VN={front:'Ön',top:'Üst',left:'Soldan',right:'Sağdan'};
  let h=`<div class="grp"><div class="grp-t"${tipA('Şeridin Çizim sekmesindeki araçlarla teknik resme çizgi, eksen çizgisi, daire, yay ve merkez işareti eklenir; parçanın modeli değişmez. Görünüşün içinde çizilen veya görünüşün köşesine, kenarına, merkezine yakalanan öğe o görünüşe bağlanır: görünüşle taşınır, ölçeği değişince büyür/küçülür ve ölçüleri model mm’dir. Öğe seçilip sürüklenir (çizginin ucu, dairenin çevresi tutulursa boy/çap değişir), Delete ile silinir.')}>2B çizim</div>`;
  h+=`<label class="fld"><span>Yeni öğelerin çizgi türü</span><select data-sklt="1" style="${inSt}">${LTYPES.map(([k,t])=>`<option value="${k}" ${k===(S.skLt||'thin')?'selected':''}>${t}</option>`).join('')}</select></label>`;
  if(!L.length)h+=`<p class="note">Şeritten bir çizim aracı seç; köşelere, merkezlere ve kenarlara yakalanır.</p>`;
  else h+=`<div class="dimlist">${L.map((e,i)=>{const sz=dskSize(e);const nm=e.t==='line'&&e.st==='cen'?'Eksen çizgisi':SK_NAMES[e.t]||e.t;
    return `<div class="dimrow" style="flex-wrap:wrap"><span>${esc(nm)} · ${VN[e.view]||'Sayfa'}</span><button data-xdel="sk2d:${i}" title="Sil" aria-label="Öğeyi sil">✕</button>
      <div style="display:flex;gap:4px;width:100%;margin-top:4px;align-items:center">${sz?`<span style="font-size:12px;color:var(--muted)">${sz[0]}</span><input data-sksz="${i}" inputmode="decimal" value="${esc(fmt(sz[1],3))}" style="${inSt};width:64px" aria-label="${esc(sz[0])}">`:''}${e.t!=='cmark'?`<select data-skst="${i}" style="${inSt};flex:1" aria-label="Çizgi türü">${LTYPES.map(([k,t])=>`<option value="${k}" ${k===e.st?'selected':''}>${t}</option>`).join('')}</select>`:''}</div></div>`}).join('')}</div>`;
  return h+'</div>';
}
function sk2dInput(e,isChange){
  const t=e.target,ds=t.dataset,S=dwS();
  if(ds.sklt!==undefined){if(!isChange)return true;pushDwHist();S.skLt=t.value;saveState();if(dwCm==='sketch')renderDrawRibbon();return true}
  if(ds.skst!==undefined){if(!isChange)return true;pushDwHist();S.sk2d[+ds.skst].st=t.value;saveState();renderDrawing();return true}
  if(ds.sksz!==undefined){const v=num(t.value),en=S.sk2d[+ds.sksz];if(!(v>0)||!en)return true;
    if(isChange){renderDwPanel();return true}
    if(en.t==='line'){const [A,B]=en.p,l=Math.hypot(B[0]-A[0],B[1]-A[1])||1;en.p=[A,[A[0]+(B[0]-A[0])/l*v,A[1]+(B[1]-A[1])/l*v]]}
    else if(en.t==='circ')en.r=v/2;else if(en.t==='arc')en.r=v;
    saveState();quickRedraw();return true}
  return false;
}
$('#dwTabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-dwcm]');if(!b||b.dataset.dwcm===dwCm)return;dwCm=b.dataset.dwcm;
  if(dwTool)setDwTool(null,true);renderDrawRibbon();renderDwPanel();drawOverlay(null);
});
