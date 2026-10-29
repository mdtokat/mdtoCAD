/* Teknik resim düzenleme: akıllı ölçünün kenar/daire/açı seçimi, görünüş ve açıklamaları seçme, sürükleme, silme; DXF çıktısı. */
IC.gdt=sv('<rect x="2.5" y="8" width="19" height="8" rx=".5"/><path d="M8.5 8v8M16 8v8"/><path d="M3.8 13.4h3l1-2.8h-3z" stroke-width="1.2"/>');
IC.datum=sv('<rect x="7.5" y="3" width="9" height="9" rx=".5"/><path d="M12 12v4.5"/><path d="M8 21h8l-4-4.5z" fill="currentColor"/>');
IC.dxf=sv('<path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4"/><path d="M9 12.5l6 5M15 12.5l-6 5" opacity=".7"/>');

/* ================= AKILLI ÖLÇÜ: daire, kenar, açı ================= */
const dwViews=()=>dctx?Object.values(dctx.views).filter(v=>v.key!=='iso'):[];
function nearestCircle(p,tol){
  let best=null,bd=tol;
  for(const v of dwViews())for(const q of v.d.circ){const C=v.map(q.a,q.b);const d=Math.abs(Math.hypot(p[0]-C[0],p[1]-C[1])-q.r*v.s);if(d<bd){bd=d;best={view:v.key,a:q.a,b:q.b,r:q.r}}}
  return best;
}
/* tıklanan kenar ve onunla aynı doğru üzerinde uç uca devam eden parçalar (görünür ve gizli) tek kenar sayılır */
function pickLine(p,tol){
  let best=null,bd=tol;
  for(const v of dwViews())for(const q of v.d.vis.concat(v.d.hid)){
    const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;if(L2<1e-8)continue;
    let t=((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2;t=Math.max(0,Math.min(1,t));const d=Math.hypot(A[0]+dx*t-p[0],A[1]+dy*t-p[1]);
    if(d<bd){bd=d;best={v,q,t}}}
  if(!best)return null;
  const {v,q,t}=best;let ux=q[2]-q[0],uy=q[3]-q[1];const l=Math.hypot(ux,uy);ux/=l;uy/=l;
  const tol2=1e-3*Math.max(1,l);const iv=[];
  for(const r of v.d.vis.concat(v.d.hid)){const d1=Math.abs((r[0]-q[0])*uy-(r[1]-q[1])*ux),d2=Math.abs((r[2]-q[0])*uy-(r[3]-q[1])*ux);if(d1>tol2||d2>tol2)continue;
    const s1=(r[0]-q[0])*ux+(r[1]-q[1])*uy,s2=(r[2]-q[0])*ux+(r[3]-q[1])*uy;iv.push([Math.min(s1,s2),Math.max(s1,s2)])}
  iv.sort((a,b)=>a[0]-b[0]);let lo=0,hi=l,grow=true;
  while(grow){grow=false;for(const [a,b] of iv){if(a<=hi+tol2&&b>hi+tol2&&b>=lo){hi=b;grow=true}if(b>=lo-tol2&&a<lo-tol2&&a<=hi){lo=a;grow=true}}}
  const X=[q[0]+(q[2]-q[0])*t,q[1]+(q[3]-q[1])*t];
  return {view:v.key,A:[q[0]+ux*lo,q[1]+uy*lo],B:[q[0]+ux*hi,q[1]+uy*hi],u:[ux,uy],X};
}
const sameLine=(e,f)=>e.view===f.view&&Math.abs(e.u[0]*f.u[1]-e.u[1]*f.u[0])<1e-3&&Math.abs((f.X[0]-e.X[0])*e.u[1]-(f.X[1]-e.X[1])*e.u[0])<1e-3;
const footOn=(e,P)=>{const s=(P[0]-e.A[0])*e.u[0]+(P[1]-e.A[1])*e.u[1];return [e.A[0]+e.u[0]*s,e.A[1]+e.u[1]*s]};
const snapObj=(view,P)=>{const v=dctx.views[view];const [x,y]=v.map(P[0],P[1]);return {view,a:P[0],b:P[1],x,y}};
/* kenardan sonraki tıklama: nokta → noktanın kenara uzaklığı; paralel kenar → aralık; açılı kenar → açı; boşluk → kenar uzunluğu */
function edgeSecond(p,tol){
  const e=dimSt.e;const s=nearestSnap(p,tol);
  if(s&&s.view===e.view){const f=footOn(e,[s.a,s.b]);if(Math.hypot(f[0]-s.a,f[1]-s.b)<1e-6)return null;return {st:{stage:2,p1:snapObj(e.view,f),p2:s}}}
  const f=pickLine(p,pxToSheet(tol));
  if(f&&f.view===e.view&&!sameLine(e,f)){
    if(Math.abs(e.u[0]*f.u[1]-e.u[1]*f.u[0])<1e-3){const Y=footOn(f,e.X);return {st:{stage:2,p1:snapObj(e.view,e.X),p2:snapObj(e.view,Y)}}}
    return {st:{stage:'ang',e1:e,e2:f}};
  }
  const v=dctx.views[e.view];const c=v.inv(p[0],p[1]);const r=dimFromCursor(e.A,e.B,c);
  return {dim:{view:e.view,p1:e.A.slice(),p2:e.B.slice(),kind:r.kind,pos:r.pos}};
}
function angFromCursor(e1,e2,p){
  const v=dctx.views[e1.view];const c=v.inv(p[0],p[1]);
  const den=e1.u[0]*e2.u[1]-e1.u[1]*e2.u[0];if(Math.abs(den)<1e-9)return null;
  const t=((e2.A[0]-e1.A[0])*e2.u[1]-(e2.A[1]-e1.A[1])*e2.u[0])/den;const V=[e1.A[0]+e1.u[0]*t,e1.A[1]+e1.u[1]*t];
  const w=[c[0]-V[0],c[1]-V[1]];const rr=Math.hypot(w[0],w[1]);if(rr<1e-6)return null;
  // imlecin bulunduğu açı bölgesi: w = α·u1 + β·u2, α, β ≥ 0
  let u1=e1.u,u2=e2.u;const al=(w[0]*u2[1]-w[1]*u2[0])/den,be=(u1[0]*w[1]-u1[1]*w[0])/den;
  if(al<0)u1=[-u1[0],-u1[1]];if(be<0)u2=[-u2[0],-u2[1]];
  const ext=(e,u)=>Math.max(0,...[e.A,e.B].map(P=>(P[0]-V[0])*u[0]+(P[1]-V[1])*u[1]));
  return {view:e1.view,kind:'ang',v:V,u1,u2,rr,e1:ext(e1,u1),e2:ext(e2,u2)};
}
function dimStageOverlay(p){
  const acc='#1F6FEB',w=f2(pxToSheet(2));let h='';
  const edge=e=>{const v=dctx.views[e.view];const A=v.map(e.A[0],e.A[1]),B=v.map(e.B[0],e.B[1]);return `<path d="${Lp(A[0],A[1],B[0],B[1])}" stroke="${acc}" stroke-width="${w}" fill="none"/>`};
  if(dimSt.stage==='dia'){const c=dimSt.c,v=dctx.views[c.view];const C=v.map(c.a,c.b);h+=`<circle cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(c.r*v.s)}" fill="none" stroke="${acc}" stroke-width="${w}"/>`;
    if(p)h+=toBlue(dimRender({kind:'dia',c:[c.a,c.b],r:c.r,off:[p[0]-C[0],p[1]-C[1]]},v))}
  if(dimSt.stage==='edge'){h+=edge(dimSt.e);
    if(p){const s=nearestSnap(p,9),f=s?null:pickLine(p,pxToSheet(9));
      if(f&&!sameLine(f,dimSt.e))h+=edge(f);
      else if(!s){const r=edgeSecond(p,9);if(r&&r.dim)h+=toBlue(dimRender(r.dim,dctx.views[r.dim.view]))}}}
  if(dimSt.stage==='ang'){h+=edge(dimSt.e1)+edge(dimSt.e2);if(p){const d=angFromCursor(dimSt.e1,dimSt.e2,p);if(d)h+=toBlue(dimRender(d,dctx.views[d.view]))}}
  return h;
}

/* ================= SEÇME, SÜRÜKLEME, SİLME ================= */
let dwSel=null;
const DW_ORDER=['lbl','dim','auto','gdt','datum','note','surf','detail','view'];
function dwHitAt(p,ptype){
  if(!dctx||!dctx.hits)return null;const pad=pxToSheet(ptype==='mouse'?3:8);let best=null;
  for(const h of dctx.hits){const b=h.box;if(!b)continue;if(p[0]<b[0]-pad||p[0]>b[2]+pad||p[1]<b[1]-pad||p[1]>b[3]+pad)continue;
    const rk=DW_ORDER.indexOf(h.t),ar=(b[2]-b[0])*(b[3]-b[1]);if(!best||rk<best.rk||(rk===best.rk&&ar<best.ar))best={h,rk,ar}}
  return best?best.h:null;
}
const sameHit=(a,b)=>a&&b&&a.t===b.t&&a.i===b.i&&a.k===b.k;
function dwSelect(h){dwSel=h?{t:h.t,i:h.i,k:h.k}:null;drawOverlay(null);dwStatus()}
function dwStatus(){
  const t=$('#dwTip');if(dimMode||dwTool)return;if(!dwSel){t.classList.remove('on');return}
  const N={view:'Görünüş',dim:'Ölçü',auto:'Otomatik ölçü',lbl:'Etiket',note:'Not',surf:'Yüzey işareti',detail:'Detay görünüşü',gdt:'Geometrik tolerans',datum:'Referans işareti'};
  t.classList.add('on');t.textContent=`${N[dwSel.t]||'Öğe'} seçili: sürükleyerek taşı, Delete ile ${['auto','lbl','view'].includes(dwSel.t)?'gizle':'sil'}. Esc ile bırak.`;
}
function selOverlay(){
  if(!dwSel||!dctx)return '';const h=dctx.hits.find(x=>sameHit(x,dwSel));if(!h)return '';const b=h.box,m=pxToSheet(3);
  return `<rect x="${f2(b[0]-m)}" y="${f2(b[1]-m)}" width="${f2(b[2]-b[0]+2*m)}" height="${f2(b[3]-b[1]+2*m)}" fill="rgba(31,111,235,.08)" stroke="#1F6FEB" stroke-width="${f2(pxToSheet(1.2))}" stroke-dasharray="${f2(pxToSheet(4))}"/>`;
}
let hoverHit=null;
function dwHover(p){const h=dwHitAt(p,'mouse');if(sameHit(h,hoverHit)&&(h||!hoverHit))return;hoverHit=h;sheetEl.style.cursor=h?'move':''}
/* sürükleme: başlangıç değerinden dx, dy (sayfa mm) kadar */
const DW_DRAG=new Set(['view','lbl','dim','note','detail','gdt','datum']);
function dwDragMove(pan,dx,dy){
  const S=dwS(),h=pan.hit;
  if(!pan.orig){pan.orig=clone(S);pushDwHist();dwSel={t:h.t,i:h.i,k:h.k}}
  const O=pan.orig;
  if(h.t==='view'){S.vofs=clone(O.vofs||{});const V=S.vofs;
    if(h.k==='front'||h.k==='iso'){const o=V[h.k]||[0,0];V[h.k]=[o[0]+dx,o[1]+dy]}
    else if(h.k==='top')V.top=(V.top||0)+dy;else if(h.k==='side')V.side=(V.side||0)+dx}
  else if(h.t==='lbl'){S.lbl=Object.assign({},O.lbl);S.lbl[h.k]=[h.K[0]+dx-h.C[0],h.K[1]+dy-h.C[1]]}
  else if(h.t==='dim'){const d=S.dims[h.i],o=O.dims[h.i],v=dctx.views[d.view];if(!v)return;
    if(d.kind==='dia')d.off=[(o.off||[12,-12])[0]+dx,(o.off||[12,-12])[1]+dy];
    else if(d.kind==='ang'){const V=v.map(o.v[0],o.v[1]);const a1=Math.atan2(-o.u1[1],o.u1[0]),a2=Math.atan2(-o.u2[1],o.u2[0]);
      const mid=[Math.cos(a1)+Math.cos(a2),Math.sin(a1)+Math.sin(a2)];const ml=Math.hypot(mid[0],mid[1])||1;
      d.rr=Math.max(1/v.s,o.rr+(dx*mid[0]+dy*mid[1])/ml/v.s)}
    else if(d.kind==='h')d.pos=o.pos-dy/v.s;else if(d.kind==='v')d.pos=o.pos+dx/v.s;
    else{const ex=o.p2[0]-o.p1[0],ey=o.p2[1]-o.p1[1],l=Math.hypot(ex,ey)||1;d.pos=o.pos+(-ey/l*dx-ex/l*dy)/v.s}}
  else if(h.t==='note'){S.notes[h.i].x=O.notes[h.i].x+dx;S.notes[h.i].y=O.notes[h.i].y+dy}
  else if(h.t==='detail'){const p0=O.details[h.i].pos;S.details[h.i].pos=[p0[0]+dx,p0[1]+dy]}
  else if(h.t==='gdt'||h.t==='datum'){const k=h.t+'s',o=O[k][h.i].off||[0,-12];S[k][h.i].off=[o[0]+dx,o[1]+dy]}
  else return;
  if(!pan.raf)pan.raf=requestAnimationFrame(()=>{pan.raf=0;const r=buildSheet(false);sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;drawOverlay(null)});
}
function dwDragEnd(pan){if(!pan.orig)return;cancelAnimationFrame(pan.raf);saveState();renderDrawing()}
function dwDeleteSel(){
  if(!dwSel)return false;const S=dwS(),h=dwSel;if(h.t==='view'&&h.k==='front'){toast('Ön görünüş gizlenemez.');return true}pushDwHist();
  const lists={dim:'dims',note:'notes',surf:'surfs',detail:'details',gdt:'gdts',datum:'datums'};
  if(lists[h.t])(S[lists[h.t]]||[]).splice(h.i,1);
  else if(h.t==='view'){S.hide=(S.hide||[]).concat('V:'+h.k)}
  else if(h.t==='lbl')S.hide=(S.hide||[]).concat('L:'+h.k);
  else if(h.t==='auto')S.hide=(S.hide||[]).concat(h.k);
  dwSel=null;saveState();renderDrawing();dwStatus();return true;
}

/* ================= DXF ÇIKTISI (AutoCAD R12) ================= */
/* teknik resim işaretlemesi çizgi, daire, dolu üçgen ve yazıya çevrilir; katmanlar çizgi türüne göre */
const DXF_LAYERS={'d-vis':['GORUNUR',7,'CONTINUOUS'],'d-hid':['GIZLI',8,'GIZLI'],'d-cen':['EKSEN',1,'EKSEN'],'d-thin':['INCE',3,'CONTINUOUS'],'d-frame':['CERCEVE',7,'CONTINUOUS'],'d-tb':['CERCEVE',7,'CONTINUOUS'],'d-ar':['INCE',3,'CONTINUOUS'],'d-t':['YAZI',7,'CONTINUOUS'],'d-l':['YAZI',7,'CONTINUOUS']};
// yazılar Türkçe Windows kod sayfasında (ANSI_1254) yazılır; Ø, °, ± DXF denetim kodlarıyla
const CP1254={'ğ':0xF0,'Ğ':0xD0,'ı':0xFD,'İ':0xDD,'ş':0xFE,'Ş':0xDE,'−':45,'–':0x96,'—':0x97};
function dxfText(t){
  let o='';for(const ch of String(t)){const c=ch.codePointAt(0);
    if(ch==='Ø')o+='%%c';else if(ch==='°')o+='%%d';else if(ch==='±')o+='%%p';
    else if(CP1254[ch]!==undefined)o+=String.fromCharCode(CP1254[ch]);else o+=c>255?'?':ch}
  return o;
}
function buildDXF(markup,W,H){
  const doc=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,'image/svg+xml');
  const E=[];const n=v=>(Math.round(v*1e4)/1e4).toString(),Y=y=>n(H-y);
  const line=(L,x1,y1,x2,y2)=>{if(Math.hypot(x2-x1,y2-y1)<1e-6)return;E.push('0','LINE','8',L,'10',n(x1),'20',Y(y1),'30','0','11',n(x2),'21',Y(y2),'31','0')};
  const walk=el=>{for(const c of el.children){
    const tag=c.tagName.toLowerCase(),a=k=>c.getAttribute(k),cls=(a('class')||'').split(/\s+/)[0],ly=DXF_LAYERS[cls];
    if(tag==='g'){walk(c);continue}if(!ly)continue;const L=ly[0];
    if(tag==='rect'){const x=+a('x'),y=+a('y'),w=+a('width'),h=+a('height');line(L,x,y,x+w,y);line(L,x+w,y,x+w,y+h);line(L,x+w,y+h,x,y+h);line(L,x,y+h,x,y)}
    else if(tag==='circle')E.push('0','CIRCLE','8',L,'10',n(+a('cx')),'20',Y(+a('cy')),'30','0','40',n(+a('r')));
    else if(tag==='path'){
      const re=/([MLZ])([^MLZ]*)/gi;let m,st=null,cur=null;const poly=[];
      while((m=re.exec(a('d')||''))){const k=m[1].toUpperCase();const q=m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if(k==='Z'){if(cur&&st)line(L,cur[0],cur[1],st[0],st[1]);cur=st;continue}
        for(let i=0;i+1<q.length;i+=2){const P=[q[i],q[i+1]];if(k==='M'&&i===0){st=P;cur=P;poly.push(P);continue}if(cls!=='d-ar')line(L,cur[0],cur[1],P[0],P[1]);cur=P;poly.push(P)}}
      if(cls==='d-ar'&&poly.length>=3){const [p1,p2,p3]=poly;E.push('0','SOLID','8',L,'10',n(p1[0]),'20',Y(p1[1]),'30','0','11',n(p2[0]),'21',Y(p2[1]),'31','0','12',n(p3[0]),'22',Y(p3[1]),'32','0','13',n(p3[0]),'23',Y(p3[1]),'33','0')}}
    else if(tag==='text'){const t=c.textContent||'';if(!t.trim())continue;const fs=+a('font-size')||3.5,anc=a('text-anchor')||'start';
      let ang=0;const tr=a('transform');if(tr){const mm=tr.match(/rotate\(([-\d.e]+)/);if(mm)ang=-(+mm[1])}
      const x=+a('x'),y=+a('y'),j=anc==='middle'?1:anc==='end'?2:0;
      E.push('0','TEXT','8',L,'10',n(x),'20',Y(y),'30','0','40',n(fs*.7),'1',dxfText(t),'50',n(ang),'41','0.86');
      if(j)E.push('72',String(j),'11',n(x),'21',Y(y),'31','0')}
  }};
  walk(doc.documentElement);
  const lts=[['CONTINUOUS','Solid line',[]],['GIZLI','Gizli __ __ __',[2.2,-1.1]],['EKSEN','Eksen ____ . ____',[7,-1.1,.8,-1.1]]];
  const lays=[...new Map(Object.values(DXF_LAYERS).map(l=>[l[0],l])).values()];
  const out=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$DWGCODEPAGE','3','ANSI_1254','9','$INSUNITS','70','4','9','$EXTMIN','10','0','20','0','9','$EXTMAX','10',n(W),'20',n(H),'9','$LTSCALE','40','1','0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LTYPE','70',String(lts.length)];
  for(const [nm,ds,pat] of lts)out.push('0','LTYPE','2',nm,'70','0','3',ds,'72','65','73',String(pat.length),'40',n(pat.reduce((s,x)=>s+Math.abs(x),0)),...pat.flatMap(x=>['49',n(x)]));
  out.push('0','ENDTAB','0','TABLE','2','LAYER','70',String(lays.length));
  for(const [nm,col,lt] of lays)out.push('0','LAYER','2',nm,'70','0','62',String(col),'6',lt);
  out.push('0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES',...E,'0','ENDSEC','0','EOF');
  return out.join('\r\n')+'\r\n';
}
function exportDXFString(){const r=buildSheet(true);return buildDXF(r.markup,r.ctx.W,r.ctx.H)}
function exportDXF(){const t=exportDXFString();const b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i)&255;saveFile(safeName()+'-teknik-resim.dxf',new Blob([b],{type:'application/dxf'}))}
