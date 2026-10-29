/* Kesit, detay görünüşü, tolerans, yüzey işareti, notlar, diş gösterimi. */
/* ================= TEKNİK RESİM EKLERİ: kesit, detay, tolerans, yüzey, not, diş ================= */
IC.detailv=sv('<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/><path d="M7.5 10h5M10 7.5v5" opacity=".6"/>');
IC.surf=sv('<path d="M4 18 8 12h3l3 6 6-12h-6"/><path d="M8 12h6" opacity=".6"/>');
IC.note=sv('<path d="M5 4h14v16H5z"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>');
let dwTool=null,dwSt={};
const secCache=new Map();
function sectionSrc(src,viewKey,S){
  // montajda kesilmeyecek parçalar (SolidWorks: kesitten hariç tutulan cıvata, somun, mil…) bütün olarak çizilir
  const skip=src.kind==='asm'?new Set(S.secSkip||[]):new Set();
  const off=num(S.secOff)||0,half=S.secType==='half';const key=src.key+'|sec|'+viewKey+'|'+off+(half?'|h':'')+'|'+[...skip].sort().join();
  if(secCache.has(key))return secCache.get(key);
  const b=src.box;const c=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2];
  const D=VIEWS[viewKey].D;const P=va(c,vk(D,off));
  const L=Math.hypot(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])*2+20;
  // yarım kesit: kesici kutu görünüşün sağ yarısıyla sınırlanır (sol yarı dıştan görünür)
  const ctr=va(vs(P,vk(D,L/2)),half?vk(VIEWS[viewKey].R,L/2):[0,0,0]);
  const cutter=sh=>{const g=new T.BoxGeometry(L,L,L);g.translate(ctr[0],ctr[1],ctr[2]);return geomToPolys(g,sh)};
  let polys=[];
  if(src.kind==='asm'){const groups=new Map();for(const p of src.polys){if(!groups.has(p.shared))groups.set(p.shared,[]);groups.get(p.shared).push(p)}
    const partOf=id=>{const c=src.a.comps.find(c=>c.id===id);return c&&c.part};
    for(const [k,ps] of groups)polys=polys.concat(skip.has(partOf(k))?ps:csgSubtract(ps,cutter('SEC:'+k)))}
  else polys=csgSubtract(src.polys,cutter('SEC'));
  for(const v of secCache.values())if(v.g)v.g.dispose();secCache.clear();
  const res={kind:src.kind,key,polys,ann:src.ann,box:polys.length?bboxPolys(polys):src.box,g:polysToBuffers(polys).g,sec:true,P};
  secCache.set(key,res);return res;
}
function hatchMarkup(sp,v,isAsm){
  let d='';for(const q of hatchSegs(sp,v,isAsm))d+=Lp(q[0],q[1],q[2],q[3]);
  return d?`<path class="d-thin" d="${d}"/>`:'';
}
/* montaj kesitinde bitişik parçalar farklı taranır (ISO 128): komşu (kesit kutuları değen) parçalarda kullanılmayan ilk açı/aralık */
const HATCH=[[45,2.5],[135,2.5],[45,4],[135,4],[30,3.2],[150,3.2],[60,3.2],[120,3.2]];
function hatchStyles(sp){
  const groups=[...new Set(sp.map(q=>q.g))].sort(),box=new Map();
  for(const q of sp){let b=box.get(q.g);if(!b)box.set(q.g,b=[Infinity,Infinity,-Infinity,-Infinity]);for(const [a,c] of q.pts){b[0]=Math.min(b[0],a);b[1]=Math.min(b[1],c);b[2]=Math.max(b[2],a);b[3]=Math.max(b[3],c)}}
  const touch=(a,b)=>a[0]<=b[2]+0.5&&b[0]<=a[2]+0.5&&a[1]<=b[3]+0.5&&b[1]<=a[3]+0.5;const st=new Map();
  for(const g of groups){const used=new Set();for(const [h,s] of st)if(touch(box.get(g),box.get(h)))used.add(s);st.set(g,HATCH.findIndex((x,i)=>!used.has(i))<0?0:HATCH.findIndex((x,i)=>!used.has(i)))}
  return st;
}
function hatchSegs(sp,v,isAsm){
  const sty=isAsm?hatchStyles(sp):null;const d=[];
  for(const q of sp){
    const [deg,spc]=sty?HATCH[sty.get(q.g)]:HATCH[0];const ang=deg*Math.PI/180;
    const pts=q.pts.map(([a,b])=>v.map(a,b));const ux=Math.cos(ang),uy=-Math.sin(ang),nx=-uy,ny=ux;
    const pr=pts.map(p=>p[0]*nx+p[1]*ny);const mn=Math.min(...pr),mx=Math.max(...pr);
    for(let k=Math.ceil(mn/spc);k<=Math.floor(mx/spc);k++){
      const c=k*spc;const hits=[];
      for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;const s0=pr[i]-c,s1=pr[j]-c;if((s0<=0&&s1>0)||(s0>0&&s1<=0)){const t=s0/(s0-s1);hits.push([pts[i][0]+(pts[j][0]-pts[i][0])*t,pts[i][1]+(pts[j][1]-pts[i][1])*t])}}
      if(hits.length>=2){hits.sort((a,b)=>(a[0]*ux+a[1]*uy)-(b[0]*ux+b[1]*uy));const A=hits[0],B=hits[hits.length-1];if(Math.hypot(B[0]-A[0],B[1]-A[1])>0.05)d.push([A[0],A[1],B[0],B[1]])}
    }
  }
  return d;
}
function threadMarkup(th,v,s){
  let arc='',hid='';
  for(const t of th){
    if(t.t==='arc'){const [cx,cy]=v.map(t.a,t.b);const R=t.R*s;let prev=null;for(let i=0;i<=40;i++){const a=(100+250*i/40)*Math.PI/180;const p=[cx+R*Math.cos(a),cy-R*Math.sin(a)];if(prev)arc+=Lp(prev[0],prev[1],p[0],p[1]);prev=p}}
    else{const A=v.map(t.s[0],t.s[1]),B=v.map(t.s[2],t.s[3]);hid+=Lp(A[0],A[1],B[0],B[1])}
  }
  return (arc?`<path class="d-thin" d="${arc}"/>`:'')+(hid?`<path class="d-hid" style="stroke-width:.18" d="${hid}"/>`:'');
}
function sectionLineMarkup(si,ctx,s){
  const pv=ctx.views[si.partner],sv=ctx.views[si.key];if(!pv||!sv)return '';
  const VW=VIEWS[si.partner],R=VW.R,U=VW.U,P=si.P,D=si.D;const ap=dot3(P,R),bp=dot3(P,U);const dA=dot3(D,R),dB=dot3(D,U);const bb=pv.d.bb;
  let E1,E2;if(Math.abs(dA)>Math.abs(dB)){E1=pv.map(ap,bb.minB);E2=pv.map(ap,bb.maxB)}else{E1=pv.map(bb.minA,bp);E2=pv.map(bb.maxA,bp)}
  const L=Math.hypot(E2[0]-E1[0],E2[1]-E1[1])||1,ux=(E2[0]-E1[0])/L,uy=(E2[1]-E1[1])/L;
  E1=[E1[0]-ux*6,E1[1]-uy*6];E2=[E2[0]+ux*6,E2[1]+uy*6];
  const al=Math.hypot(dA,dB)||1,ax=dA/al,ay=-dB/al;
  let ends=[E1,E2],o;
  const SR=VIEWS[si.key].R,sx=dot3(SR,R),sy=-dot3(SR,U);
  if(si.half&&Math.hypot(sx,sy)>.5){// yarım kesit: kesme çizgisi merkezden kesilen yarının dışına kadar, tek ok (yarı derinlik yönündeyse çizgi tam görünür)
    const Cp=pv.map(ap,bp);
    const far=(E2[0]-Cp[0])*sx+(E2[1]-Cp[1])*sy>=0?E2:E1,k=far===E2?-1:1;ends=[far];
    o=`<path class="d-cen" d="${Lp(Cp[0],Cp[1],far[0],far[1])}"/><path class="d-vis" style="stroke-width:.7" d="${Lp(far[0],far[1],far[0]+ux*6*k,far[1]+uy*6*k)}${Lp(Cp[0]-ax*3,Cp[1]-ay*3,Cp[0]+ax*3,Cp[1]+ay*3)}"/>`;
  }
  else o=`<path class="d-cen" d="${Lp(E1[0],E1[1],E2[0],E2[1])}"/><path class="d-vis" style="stroke-width:.7" d="${Lp(E1[0],E1[1],E1[0]+ux*6,E1[1]+uy*6)}${Lp(E2[0],E2[1],E2[0]-ux*6,E2[1]-uy*6)}"/>`;
  for(const E of ends){const tip=[E[0]+ax*8,E[1]+ay*8];o+=`<path class="d-thin" d="${Lp(E[0],E[1],tip[0],tip[1])}"/>`+arrow(tip,ax,ay)+`<text class="d-t" x="${f2(tip[0]+ax*3.5)}" y="${f2(tip[1]+ay*3.5+1.8)}" font-size="5" text-anchor="middle">A</text>`}
  const sb=sv.d.bb;const top=sv.map((sb.minA+sb.maxA)/2,sb.maxB);
  o+=`<text class="d-t" x="${f2(top[0])}" y="${f2(top[1]-6)}" font-size="5" text-anchor="middle">KESİT A-A</text>`;
  if(si.half){// iki yarı arasında eksen çizgisi
    const a=dot3(P,VIEWS[si.key].R);const A=sv.map(a,sb.minB),B=sv.map(a,sb.maxB);
    o+=`<path class="d-cen" d="${Lp(A[0],A[1]+3,B[0],B[1]-3)}"/>`}
  return o;
}
function clipSegCircle(a1,b1,a2,b2,ca,cb,r){
  const dx=a2-a1,dy=b2-b1,fx=a1-ca,fy=b1-cb;const A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r;if(A<1e-12)return null;
  const disc=B*B-4*A*C;if(disc<=0)return null;const sq=Math.sqrt(disc);const t0=Math.max(0,(-B-sq)/(2*A)),t1=Math.min(1,(-B+sq)/(2*A));if(t1-t0<1e-6)return null;
  return [a1+dx*t0,b1+dy*t0,a1+dx*t1,b1+dy*t1];
}
function detailsMarkup(S,ctx,s){
  let o='';
  (S.details||[]).forEach((dt,i)=>{
    const v=ctx.views[dt.view];if(!v)return;const k=num(dt.k)||2,ks=s*k;const [ca,cb]=dt.c;
    const C=v.map(ca,cb),r=dt.r*s,R2=dt.r*ks;
    o+=`<circle class="d-thin" cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(r)}"/><text class="d-t" x="${f2(C[0]+(r+2)*0.72)}" y="${f2(C[1]-(r+2)*0.72)}" font-size="5">${esc(dt.label)}</text>`;
    const mp=(a,b)=>[dt.pos[0]+(a-ca)*ks,dt.pos[1]-(b-cb)*ks];
    let vis='',hid='',cen='',hat='';
    for(const q of v.d.vis){const c=clipSegCircle(q[0],q[1],q[2],q[3],ca,cb,dt.r);if(c){const A=mp(c[0],c[1]),B=mp(c[2],c[3]);vis+=Lp(A[0],A[1],B[0],B[1])}}
    if(S.hidden&&!v.d.secPolys.length)for(const q of v.d.hid){const c=clipSegCircle(q[0],q[1],q[2],q[3],ca,cb,dt.r);if(c){const A=mp(c[0],c[1]),B=mp(c[2],c[3]);hid+=Lp(A[0],A[1],B[0],B[1])}}
    // kesit görünüşünden alınan detayda tarama, eksen çizgileri de detaya taşınır
    if(v.d.secPolys.length&&S.section&&S.section!=='none')for(const q of hatchSegs(v.d.secPolys,{map:mp},dwSrc().kind==='asm')){const c=clipSegCircle(q[0],q[1],q[2],q[3],dt.pos[0],dt.pos[1],R2);if(c)hat+=Lp(c[0],c[1],c[2],c[3])}
    if(S.centers){const cl=(x1,y1,x2,y2)=>{const c=clipSegCircle(x1,y1,x2,y2,dt.pos[0],dt.pos[1],R2);if(c)cen+=Lp(c[0],c[1],c[2],c[3])};
      for(const q of markSegs(v.d.marks,mp))cl(...q);
      for(const q of v.d.axes){const A=mp(q[0],q[1]),B=mp(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy)||1;cl(A[0]-dx/l*3,A[1]-dy/l*3,B[0]+dx/l*3,B[1]+dy/l*3)}}
    if(hat)o+=`<path class="d-thin" d="${hat}"/>`;if(hid)o+=`<path class="d-hid" d="${hid}"/>`;if(cen)o+=`<path class="d-cen" d="${cen}"/>`;if(vis)o+=`<path class="d-vis" d="${vis}"/>`;
    o+=`<circle class="d-thin" cx="${f2(dt.pos[0])}" cy="${f2(dt.pos[1])}" r="${f2(R2)}"/><text class="d-t" x="${f2(dt.pos[0])}" y="${f2(dt.pos[1]+R2+6)}" font-size="4" text-anchor="middle">DETAY ${esc(dt.label)} ÖLÇEK ${scaleLabel(ks)}</text>`;
    if(ctx.hits)ctx.hits.push({t:'detail',i,box:[dt.pos[0]-R2,dt.pos[1]-R2,dt.pos[0]+R2,dt.pos[1]+R2+7]});
  });
  return o;
}
function surfMarkup(S,ctx){
  let o='';
  (S.surfs||[]).forEach((sf,i)=>{const v=ctx.views[sf.view];if(!v)return;const P=v.map(sf.p[0],sf.p[1]);const h=4;
    const L=[P[0]-h*0.577,P[1]-h],Rt=[P[0]+2*h*0.577,P[1]-2*h],M=[P[0]+h*0.577,P[1]-h];
    o+=`<path class="d-thin" style="stroke-width:.25" d="${Lp(L[0],L[1],P[0],P[1])}${Lp(P[0],P[1],Rt[0],Rt[1])}${Lp(L[0],L[1],M[0],M[1])}${Lp(Rt[0],Rt[1],Rt[0]+10,Rt[1])}"/><text class="d-t" x="${f2(Rt[0]+0.8)}" y="${f2(Rt[1]-0.9)}" font-size="2.8">Ra ${esc(sf.ra)}</text>`;
    if(ctx.hits)ctx.hits.push({t:'surf',i,box:[L[0],Rt[1]-3.5,Rt[0]+10,P[1]]})});
  return o;
}
function notesMarkup(S,ctx){
  return (S.notes||[]).map((n,j)=>{const ls=String(n.text||'').split('\n');
    if(ctx&&ctx.hits)ctx.hits.push({t:'note',i:j,box:[n.x-.5,n.y-3.5,n.x+Math.max(...ls.map(l=>textWidth(l,3.5)))+.5,n.y+(ls.length-1)*5+1]});
    return ls.map((ln,i)=>`<text class="d-t" x="${f2(n.x)}" y="${f2(n.y+i*5)}" font-size="3.5">${esc(ln)}</text>`).join('')}).join('');
}

/* ---------- geometrik tolerans (ISO 1101) ve referans (datum) işareti ---------- */
const GDT_SYMS=[['straight','Doğrusallık'],['flat','Düzlemsellik'],['circ','Dairesellik'],['cyl','Silindiriklik'],['lprof','Çizgi profili'],['sprof','Yüzey profili'],['par','Paralellik'],['perp','Diklik'],['ang','Açısallık'],['pos','Konum'],['conc','Eş merkezlilik'],['sym','Simetri'],['run','Salgı'],['trun','Toplam salgı']];
function gdtSym(k,cx,cy){
  // 5 mm hücrenin ortasına sembol: çizgiler ve daireler (PDF/DXF'te de aynı çıkar)
  let p='',c='';const C=(r)=>{c+=`<circle class="d-thin" style="stroke-width:.25" cx="${f2(cx)}" cy="${f2(cy)}" r="${r}"/>`};
  const arc=(r,a0,a1,y0)=>{let prev=null;for(let i=0;i<=16;i++){const t=(a0+(a1-a0)*i/16)*Math.PI/180;const q=[cx+r*Math.cos(t),y0-r*Math.sin(t)];if(prev)p+=Lp(prev[0],prev[1],q[0],q[1]);prev=q}};
  if(k==='straight')p=Lp(cx-1.8,cy,cx+1.8,cy);
  else if(k==='flat')p=Lp(cx-1.9,cy+1,cx+.9,cy+1)+Lp(cx+.9,cy+1,cx+1.9,cy-1)+Lp(cx+1.9,cy-1,cx-.9,cy-1)+Lp(cx-.9,cy-1,cx-1.9,cy+1);
  else if(k==='circ')C(1.5);
  else if(k==='cyl'){C(1.2);p=Lp(cx-1.2,cy+1.8,cx+.2,cy-1.8)+Lp(cx-.2,cy+1.8,cx+1.2,cy-1.8)}
  else if(k==='lprof')arc(1.6,0,180,cy+.8);
  else if(k==='sprof'){arc(1.6,0,180,cy+.8);p+=Lp(cx-1.6,cy+.8,cx+1.6,cy+.8)}
  else if(k==='par')p=Lp(cx-1.6,cy+1.6,cx-.2,cy-1.6)+Lp(cx+.2,cy+1.6,cx+1.6,cy-1.6);
  else if(k==='perp')p=Lp(cx-1.8,cy+1.6,cx+1.8,cy+1.6)+Lp(cx,cy+1.6,cx,cy-1.8);
  else if(k==='ang')p=Lp(cx-1.8,cy+1.6,cx+1.8,cy+1.6)+Lp(cx-1.8,cy+1.6,cx+1.5,cy-1.5);
  else if(k==='pos'){C(1.2);p=Lp(cx-1.9,cy,cx+1.9,cy)+Lp(cx,cy-1.9,cx,cy+1.9)}
  else if(k==='conc'){C(.8);C(1.7)}
  else if(k==='sym')p=Lp(cx-1.9,cy,cx+1.9,cy)+Lp(cx-1.1,cy-1.2,cx+1.1,cy-1.2)+Lp(cx-1.1,cy+1.2,cx+1.1,cy+1.2);
  const ar=(x,y,ux,uy)=>{const l=Math.hypot(ux,uy);ux/=l;uy/=l;const bx=x-ux*1.3,by=y-uy*1.3;c+=`<path class="d-ar" d="M${f2(x)} ${f2(y)}L${f2(bx-uy*.45)} ${f2(by+ux*.45)}L${f2(bx+uy*.45)} ${f2(by-ux*.45)}Z"/>`};
  if(k==='run'){p=Lp(cx-1.3,cy+1.9,cx+.8,cy-.9);ar(cx+1.4,cy-1.8,.6,-.8)}
  else if(k==='trun'){p=Lp(cx-2,cy+1.9,cx+1.4,cy+1.9)+Lp(cx-2,cy+1.9,cx-.9,cy-.5)+Lp(cx-.2,cy+1.9,cx+.9,cy-.5);ar(cx-.4,cy-1.7,.45,-.9);ar(cx+1.4,cy-1.7,.45,-.9)}
  return (p?`<path class="d-thin" style="stroke-width:.25" d="${p}"/>`:'')+c;
}
function gdtMarkup(S,ctx){
  let o='';
  (S.gdts||[]).forEach((g,i)=>{const v=ctx.views[g.view];if(!v)return;
    const P=v.map(g.p[0],g.p[1]),off=g.off||[14,-12],K=[P[0]+off[0],P[1]+off[1]];const h=6;
    const tt=(g.dia?'Ø':'')+(g.tol||'');const dats=(g.dat||[]).filter(x=>x&&String(x).trim());
    const wT=textWidth(tt,3.5)+3,W=h+wT+dats.length*h;const x0=off[0]>=0?K[0]:K[0]-W,y0=K[1]-h/2;
    let seps='';let x=x0+h;seps+=Lp(x,y0,x,y0+h);x+=wT;for(let j=0;j<dats.length;j++){seps+=Lp(x,y0,x,y0+h);x+=h}
    o+=`<rect class="d-tb" x="${f2(x0)}" y="${f2(y0)}" width="${f2(W)}" height="${h}"/><path class="d-tb" d="${seps}"/>`+gdtSym(g.sym||'flat',x0+h/2,K[1]);
    o+=`<text class="d-t" x="${f2(x0+h+wT/2)}" y="${f2(K[1]+1.25)}" font-size="3.5" text-anchor="middle">${esc(tt)}</text>`;
    dats.forEach((d,j)=>{o+=`<text class="d-t" x="${f2(x0+h+wT+h*j+h/2)}" y="${f2(K[1]+1.25)}" font-size="3.5" text-anchor="middle">${esc(d)}</text>`});
    // kılavuz: çerçevenin yakın kenarından kirişe dik ok
    const S0=off[0]>=0?[x0,K[1]]:[x0+W,K[1]];const E=[S0[0]-Math.sign(off[0]||1)*4,K[1]];const dx=P[0]-E[0],dy=P[1]-E[1],l=Math.hypot(dx,dy)||1;
    o+=`<path class="d-thin" d="${Lp(S0[0],S0[1],E[0],E[1])}${Lp(E[0],E[1],P[0],P[1])}"/>`+arrow(P,dx/l,dy/l);
    if(ctx.hits)ctx.hits.push({t:'gdt',i,box:[x0,y0,x0+W,y0+h],K:P});
  });
  return o;
}
function datumMarkup(S,ctx){
  let o='';
  (S.datums||[]).forEach((d,i)=>{const v=ctx.views[d.view];if(!v)return;
    const P=v.map(d.p[0],d.p[1]),off=d.off||[0,-12],l=Math.hypot(off[0],off[1])||1,ux=off[0]/l,uy=off[1]/l,nx=-uy,ny=ux;
    const A=[P[0]+ux*2.6,P[1]+uy*2.6],Q=[P[0]+off[0],P[1]+off[1]],hb=3.2;
    // kare kutuya giden çizgi kutunun kenarında biter
    const t=Math.min(hb/Math.max(Math.abs(ux),1e-9),hb/Math.max(Math.abs(uy),1e-9));const E=[Q[0]-ux*t,Q[1]-uy*t];
    o+=`<path class="d-ar" d="M${f2(P[0]+nx*1.8)} ${f2(P[1]+ny*1.8)}L${f2(P[0]-nx*1.8)} ${f2(P[1]-ny*1.8)}L${f2(A[0])} ${f2(A[1])}Z"/>`;
    if(l>2.6+t)o+=`<path class="d-thin" d="${Lp(A[0],A[1],E[0],E[1])}"/>`;
    o+=`<rect class="d-tb" x="${f2(Q[0]-hb)}" y="${f2(Q[1]-hb)}" width="${f2(2*hb)}" height="${f2(2*hb)}"/><text class="d-t" x="${f2(Q[0])}" y="${f2(Q[1]+1.45)}" font-size="4" text-anchor="middle">${esc(d.label||'A')}</text>`;
    if(ctx.hits)ctx.hits.push({t:'datum',i,box:[Q[0]-hb,Q[1]-hb,Q[0]+hb,Q[1]+hb],K:P});
  });
  return o;
}

/* ---------- panel ---------- */
const inSt='height:26px;border:1px solid var(--line);border-radius:4px;background:var(--field);padding:0 5px;font-size:12px';
function tolEditor(d,i){
  const tt=d.tt||'none';
  let h=`<div style="display:flex;gap:4px;width:100%;margin-top:4px;flex-wrap:wrap"><input data-dpre="${i}" value="${esc(d.pre||'')}" placeholder="Ön ek" style="${inSt};width:52px" aria-label="Ön ek"><select data-dtt="${i}" style="${inSt}">${[['none','Tolerans yok'],['sym','±'],['dev','Sapma'],['fit','Geçme']].map(([k,t])=>`<option value="${k}" ${k===tt?'selected':''}>${t}</option>`).join('')}</select>`;
  if(tt==='sym')h+=`<input data-dtu="${i}" inputmode="decimal" value="${esc(String(d.tu??'0,1').replace('.',','))}" style="${inSt};width:56px" aria-label="Tolerans">`;
  if(tt==='dev')h+=`<input data-dtu="${i}" inputmode="decimal" value="${esc(String(d.tu??'0,1').replace('.',','))}" placeholder="üst" style="${inSt};width:52px" aria-label="Üst sapma"><input data-dtl="${i}" inputmode="decimal" value="${esc(String(d.tl??'-0,1').replace('.',','))}" placeholder="alt" style="${inSt};width:52px" aria-label="Alt sapma">`;
  if(tt==='fit')h+=`<input data-dtf="${i}" value="${esc(d.tf||'H7')}" style="${inSt};width:56px" aria-label="Geçme">`;
  return h+`</div>`;
}
function extraPanel(S){
  let h='';
  const doc=dwDoc();
  const skipList=S.section&&S.section!=='none'&&doc.kind==='asm'?`<div class="fld"><span>Kesilmeyecek parçalar</span><div class="lst">${bomItems(doc.a).map(it=>`<label class="chk" style="margin:0"><input type="checkbox" data-secskip="${it.part}" ${(S.secSkip||[]).includes(it.part)?'checked':''}> ${esc(it.name)}</label>`).join('')}</div><p class="note">SolidWorks'teki gibi cıvata, somun, pim ve dolu miller boyuna kesitte kesilmez, bütün çizilir.</p></div>`:'';
  if(S.section&&S.section!=='none')h+=`<div class="grp"><div class="grp-t">Kesit A-A</div>${skipList}<label class="fld"><span>Kesit türü</span><select data-xsel="secType" style="${inSt}"><option value="full" ${S.secType!=='half'?'selected':''}>Tam kesit</option><option value="half" ${S.secType==='half'?'selected':''}>Yarım kesit (simetrik parça)</option></select></label><label class="fld"><span>Kesit düzleminin merkeze göre kaydırması</span><div class="inp"><input data-xs="secOff" inputmode="decimal" value="${esc(String(S.secOff||0).replace('.',','))}"><em>mm</em></div></label><p class="note">${S.section==='front'?'Ön görünüş, parçanın ortasından geçen düzlemde kesilmiş olarak çizilir; kesit çizgisi üst görünüşte gösterilir.':S.section==='top'?'Üst görünüş kesilmiş olarak çizilir; kesit çizgisi ön görünüşte gösterilir.':'Yan görünüş kesilmiş olarak çizilir; kesit çizgisi ön görünüşte gösterilir.'} Kesit yüzeyleri taranır.</p></div>`;
  const D=S.details||[],F=S.surfs||[],N=S.notes||[];
  h+=`<div class="grp"><div class="grp-t">Detay görünüşleri</div>${D.length?`<div class="dimlist">${D.map((d,i)=>`<div class="dimrow"><span>${esc(d.label)}</span><select data-dk2="${i}" style="${inSt}">${[2,3,4,5,10].map(k=>`<option value="${k}" ${+d.k===k?'selected':''}>×${k}</option>`).join('')}</select><button data-xdel="details:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Detay görünüşü”ne bas; büyütülecek bölgenin merkezine, sonra kenarına, sonra detayın yerine tıkla.</p>'}</div>`;
  h+=`<div class="grp"><div class="grp-t">Yüzey işaretleri</div><label class="fld"><span>Yeni işaret için Ra (µm)</span><input data-xs="raDef" value="${esc(S.raDef||'3,2')}"></label>${F.length?`<div class="dimlist">${F.map((f,i)=>`<div class="dimrow"><span>Ra</span><input data-sra="${i}" value="${esc(f.ra)}" style="${inSt};width:60px"><button data-xdel="surfs:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Yüzey işareti”ne bas, sonra bir görünüşteki kenara tıkla.</p>'}</div>`;
  const G=S.gdts||[],Dt=S.datums||[];
  h+=`<div class="grp"><div class="grp-t">Geometrik toleranslar</div>${G.length?`<div class="dimlist">${G.map((g,i)=>`<div class="dimrow" style="flex-wrap:wrap"><select data-gsym="${i}" style="${inSt};flex:1" aria-label="Tolerans türü">${GDT_SYMS.map(([k,t])=>`<option value="${k}" ${k===g.sym?'selected':''}>${t}</option>`).join('')}</select><button data-xdel="gdts:${i}" aria-label="Sil">✕</button>
    <div style="display:flex;gap:4px;width:100%;margin-top:4px;align-items:center"><label style="font-size:12px;display:flex;gap:2px;align-items:center"><input type="checkbox" data-gdia="${i}" ${g.dia?'checked':''}>Ø</label><input data-gtol="${i}" value="${esc(g.tol||'')}" style="${inSt};width:56px" aria-label="Tolerans değeri">${[0,1,2].map(j=>`<input data-gdat="${i}:${j}" value="${esc((g.dat||[])[j]||'')}" placeholder="${'ABC'[j]}" style="${inSt};width:30px" aria-label="Referans ${j+1}">`).join('')}</div></div>`).join('')}</div>`:'<p class="note">Şeritten “Geometrik tolerans”a bas, sonra bir kenara tıkla. Tür, değer ve referanslar burada düzenlenir.</p>'}</div>`;
  h+=`<div class="grp"><div class="grp-t">Referans işaretleri</div>${Dt.length?`<div class="dimlist">${Dt.map((d,i)=>`<div class="dimrow"><span>Referans</span><input data-dlab="${i}" value="${esc(d.label)}" style="${inSt};width:40px"><button data-xdel="datums:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Referans”a bas, sonra referans yüzeyin kenarına tıkla (A, B, C… sırayla).</p>'}</div>`;
  if((S.hide||[]).length)h+=`<div class="grp"><div class="grp-t">Gizlenenler</div><p class="note">${S.hide.length} otomatik öğe veya görünüş gizli.</p><button class="sbtn" data-unhide="1">Tümünü geri getir</button></div>`;
  h+=`<div class="grp"><div class="grp-t">Notlar</div><label class="fld"><span>Yeni not metni</span><input data-xs="noteDef" value="${esc(S.noteDef||'Keskin kenarları 0,5×45° kırın.')}"></label>${N.length?`<div class="dimlist">${N.map((n,i)=>`<div class="dimrow"><input data-ntx="${i}" value="${esc(n.text)}" style="${inSt};flex:1"><button data-xdel="notes:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Not ekle”ye bas, sonra yazının yerine tıkla.</p>'}</div>`;
  return h;
}
let xT=0;
function quickRedraw(){clearTimeout(xT);xT=setTimeout(()=>{const r=buildSheet(false);sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;applyVB()},220)}
function extraPanelInput(e,isChange){
  const t=e.target,S=dwS(),ds=t.dataset;let hit=true;
  if(ds.dpre!==undefined)S.dims[+ds.dpre].pre=t.value;
  else if(ds.dtt!==undefined){if(!isChange)return true;S.dims[+ds.dtt].tt=t.value;const d=S.dims[+ds.dtt];if(t.value==='sym'&&d.tu==null)d.tu=0.1;if(t.value==='dev'){if(d.tu==null)d.tu=0.1;if(d.tl==null)d.tl=-0.1}if(t.value==='fit'&&!d.tf)d.tf='H7';saveState();renderDwPanel();quickRedraw();return true}
  else if(ds.dtu!==undefined)S.dims[+ds.dtu].tu=num(t.value);
  else if(ds.dtl!==undefined)S.dims[+ds.dtl].tl=num(t.value);
  else if(ds.dtf!==undefined)S.dims[+ds.dtf].tf=t.value;
  else if(ds.xs){S[ds.xs]=ds.xs==='secOff'?num(t.value)||0:t.value;if(ds.xs!=='secOff'){saveState();return true}}
  else if(ds.dk2!==undefined){if(!isChange)return true;S.details[+ds.dk2].k=+t.value}
  else if(ds.sra!==undefined)S.surfs[+ds.sra].ra=t.value;
  else if(ds.ntx!==undefined)S.notes[+ds.ntx].text=t.value;
  else if(ds.xsel){if(!isChange)return true;S[ds.xsel]=t.value}
  else if(ds.gsym!==undefined){if(!isChange)return true;S.gdts[+ds.gsym].sym=t.value}
  else if(ds.gdia!==undefined){if(!isChange)return true;S.gdts[+ds.gdia].dia=t.checked}
  else if(ds.gtol!==undefined)S.gdts[+ds.gtol].tol=t.value;
  else if(ds.gdat!==undefined){const [i,j]=ds.gdat.split(':').map(Number);const g=S.gdts[i];g.dat=(g.dat||['','','']).slice();g.dat[j]=t.value.trim()}
  else if(ds.dlab!==undefined)S.datums[+ds.dlab].label=t.value.trim();
  else if(ds.secskip!==undefined){if(!isChange)return true;pushDwHist();const L=new Set(S.secSkip||[]);if(t.checked)L.add(ds.secskip);else L.delete(ds.secskip);S.secSkip=[...L];saveState();renderDrawing();return true}
  else hit=false;
  if(hit){saveState();quickRedraw()}
  return hit;
}
function extraPanelClick(e){
  if(e.target.closest('[data-unhide]')){pushDwHist();dwS().hide=[];saveState();renderDrawing();return true}
  const b=e.target.closest('[data-xdel]');if(!b)return false;const [k,i]=b.dataset.xdel.split(':');const S=dwS();pushDwHist();(S[k]||[]).splice(+i,1);saveState();renderDrawing();return true;
}

/* ---------- araçlar: detay, yüzey, not ---------- */
function setDwTool(t,silent){
  dwTool=t;dwSt={stage:0};
  if(t&&dimMode)setDimMode(false);
  sheetWrap.classList.toggle('dim',!!t||dimMode);
  $$('[data-dcmd="detail"],[data-dcmd="surf"],[data-dcmd="note"],[data-dcmd="gdt"],[data-dcmd="datum"]').forEach(b=>b.classList.toggle('on',b.dataset.dcmd===t));
  if(t)dwSelect(null);
  dwTip();if(!silent)drawOverlay(null);
}
function dwTip(){
  const tEl=$('#dwTip');if(!dwTool){if(!dimMode)tEl.classList.remove('on');return}tEl.classList.add('on');
  tEl.textContent=dwTool==='detail'?(['Detay: büyütülecek bölgenin merkezine tıkla. Esc ile çık.','Dairenin kenarına tıkla (bölge yarıçapı).','Detay görünüşünün yerleşeceği boş alana tıkla.'][dwSt.stage||0])
    :dwTool==='surf'?'Yüzey işareti: bir görünüşte kenara tıkla. Ra değeri sağ panelden. Esc ile çık.'
    :dwTool==='gdt'?'Geometrik tolerans: toleransın bağlanacağı kenara tıkla. Tür, değer ve referanslar soldaki panelden. Esc ile çık.'
    :dwTool==='datum'?'Referans işareti: referans yüzeyin kenarına tıkla. Esc ile çık.':'Not: yazının yerine tıkla. Metin sağ paneldeki “Yeni not metni” alanından alınır. Esc ile çık.';
}
function viewAt(p){
  if(!dctx)return null;
  for(const v of Object.values(dctx.views)){if(v.key==='iso')continue;const bb=v.d.bb;const A=v.map(bb.minA,bb.minB),B=v.map(bb.maxA,bb.maxB);
    if(p[0]>=Math.min(A[0],B[0])-4&&p[0]<=Math.max(A[0],B[0])+4&&p[1]>=Math.min(A[1],B[1])-4&&p[1]<=Math.max(A[1],B[1])+4)return v}
  return null;
}
function nearestEdgePoint(p,tol){
  let best=null,bd=tol;
  for(const v of Object.values(dctx.views)){if(v.key==='iso')continue;for(const q of v.d.vis){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));const X=[A[0]+dx*t,A[1]+dy*t];const d=Math.hypot(X[0]-p[0],X[1]-p[1]);if(d<bd){bd=d;best={v,X,A,B}}}}
  return best;
}
function dwToolClick(p,ptype){
  const S=dwS();
  if(dwTool==='detail'){
    if(!dwSt.stage){const v=viewAt(p);if(!v){toast('Bir görünüşün (izometrik hariç) içine tıkla.');return}dwSt={stage:1,view:v.key,c:v.inv(p[0],p[1])}}
    else if(dwSt.stage===1){const v=dctx.views[dwSt.view];const C=v.map(dwSt.c[0],dwSt.c[1]);const r=Math.max(3,Math.hypot(p[0]-C[0],p[1]-C[1]));dwSt.r=r/(v.s||dctx.scale);dwSt.stage=2}
    else{pushDwHist();S.details=S.details||[];const used=new Set(S.details.map(d=>d.label));let L=66;while(used.has(String.fromCharCode(L)))L++;
      S.details.push({view:dwSt.view,c:dwSt.c,r:dwSt.r,k:2,pos:[p[0],p[1]],label:String.fromCharCode(L)});saveState();setDwTool(null);renderDrawing();return}
    dwTip();drawOverlay(p);return;
  }
  if(dwTool==='surf'){const h=nearestEdgePoint(p,ptype==='mouse'?4:8);if(!h){toast('Bir kenarın üzerine tıkla.');return}pushDwHist();S.surfs=S.surfs||[];S.surfs.push({view:h.v.key,p:h.v.inv(h.X[0],h.X[1]),ra:S.raDef||'3,2'});saveState();renderDrawing();return}
  if(dwTool==='gdt'||dwTool==='datum'){
    const h=nearestEdgePoint(p,ptype==='mouse'?4:8);if(!h){toast('Bir kenarın üzerine tıkla.');return}
    const bb=h.v.d.bb,Cv=h.v.map((bb.minA+bb.maxA)/2,(bb.minB+bb.maxB)/2);
    // kenara dik, görünüşün dışına doğru
    let nx=-(h.B[1]-h.A[1]),ny=h.B[0]-h.A[0];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;if((h.X[0]-Cv[0])*nx+(h.X[1]-Cv[1])*ny<0){nx=-nx;ny=-ny}
    pushDwHist();const at=h.v.inv(h.X[0],h.X[1]);
    if(dwTool==='gdt'){S.gdts=S.gdts||[];S.gdts.push({view:h.v.key,p:at,off:[nx*12+(nx>=0?6:-6),ny*12-4],sym:'flat',tol:'0,05',dia:false,dat:['','','']})}
    else{S.datums=S.datums||[];const used=new Set(S.datums.map(d=>d.label));let L=65;while(used.has(String.fromCharCode(L)))L++;
      S.datums.push({view:h.v.key,p:at,off:[nx*11,ny*11],label:String.fromCharCode(L)})}
    saveState();setDwTool(null);renderDrawing();return;
  }
  if(dwTool==='note'){pushDwHist();S.notes=S.notes||[];S.notes.push({x:p[0],y:p[1],text:S.noteDef||'Keskin kenarları 0,5×45° kırın.'});saveState();setDwTool(null);renderDrawing();return}
}
function dwToolOverlay(p){
  const acc='#1F6FEB';let h='';if(!p||!dctx)return h;
  const w=f2(pxToSheet(1.5));
  if(dwTool==='detail'){
    if(dwSt.stage===1){const v=dctx.views[dwSt.view];const C=v.map(dwSt.c[0],dwSt.c[1]);h+=`<circle cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(Math.hypot(p[0]-C[0],p[1]-C[1]))}" fill="none" stroke="${acc}" stroke-width="${w}"/>`}
    if(dwSt.stage===2)h+=`<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(dwSt.r*((dctx.views[dwSt.view]||{}).s||dctx.scale)*2)}" fill="none" stroke="${acc}" stroke-width="${w}" stroke-dasharray="${f2(pxToSheet(4))}"/>`;
  }
  if(dwTool==='surf'||dwTool==='gdt'||dwTool==='datum'){const s=nearestEdgePoint(p,4);if(s)h+=`<circle cx="${f2(s.X[0])}" cy="${f2(s.X[1])}" r="${f2(pxToSheet(5))}" fill="rgba(31,111,235,.2)" stroke="${acc}" stroke-width="${w}"/>`}
  return h;
}
