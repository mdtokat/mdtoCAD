/* Kesit, detay görünüşü, tolerans, yüzey işareti, notlar, diş gösterimi. */
/* ================= TEKNİK RESİM EKLERİ: kesit, detay, tolerans, yüzey, not, diş ================= */
IC.detailv=sv('<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/><path d="M7.5 10h5M10 7.5v5" opacity=".6"/>');
IC.surf=sv('<path d="M4 18 8 12h3l3 6 6-12h-6"/><path d="M8 12h6" opacity=".6"/>');
IC.note=sv('<path d="M5 4h14v16H5z"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>');
let dwTool=null,dwSt={};
const secCache=new Map();
function sectionSrc(src,viewKey,S){
  const off=num(S.secOff)||0;const key=src.key+'|sec|'+viewKey+'|'+off;
  if(secCache.has(key))return secCache.get(key);
  const b=src.box;const c=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2];
  const D=VIEWS[viewKey].D;const P=va(c,vk(D,off));
  const L=Math.hypot(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])*2+20;
  const ctr=vs(P,vk(D,L/2));
  const cutter=sh=>{const g=new T.BoxGeometry(L,L,L);g.translate(ctr[0],ctr[1],ctr[2]);return geomToPolys(g,sh)};
  let polys=[];
  if(src.kind==='asm'){const groups=new Map();for(const p of src.polys){if(!groups.has(p.shared))groups.set(p.shared,[]);groups.get(p.shared).push(p)}for(const [k,ps] of groups)polys=polys.concat(csgSubtract(ps,cutter('SEC:'+k)))}
  else polys=csgSubtract(src.polys,cutter('SEC'));
  for(const v of secCache.values())if(v.g)v.g.dispose();secCache.clear();
  const res={kind:src.kind,key,polys,ann:src.ann,box:polys.length?bboxPolys(polys):src.box,g:polysToBuffers(polys).g,sec:true,P};
  secCache.set(key,res);return res;
}
function hatchMarkup(sp,v,isAsm){
  const groups=[...new Set(sp.map(q=>q.g))].sort();let d='';
  for(const q of sp){
    const gi=groups.indexOf(q.g);const ang=(gi%2?135:45)*Math.PI/180,spc=2.5+(isAsm?(Math.floor(gi/2)%3)*0.9:0);
    const pts=q.pts.map(([a,b])=>v.map(a,b));const ux=Math.cos(ang),uy=-Math.sin(ang),nx=-uy,ny=ux;
    const pr=pts.map(p=>p[0]*nx+p[1]*ny);const mn=Math.min(...pr),mx=Math.max(...pr);
    for(let k=Math.ceil(mn/spc);k<=Math.floor(mx/spc);k++){
      const c=k*spc;const hits=[];
      for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;const s0=pr[i]-c,s1=pr[j]-c;if((s0<=0&&s1>0)||(s0>0&&s1<=0)){const t=s0/(s0-s1);hits.push([pts[i][0]+(pts[j][0]-pts[i][0])*t,pts[i][1]+(pts[j][1]-pts[i][1])*t])}}
      if(hits.length>=2){hits.sort((a,b)=>(a[0]*ux+a[1]*uy)-(b[0]*ux+b[1]*uy));const A=hits[0],B=hits[hits.length-1];if(Math.hypot(B[0]-A[0],B[1]-A[1])>0.05)d+=Lp(A[0],A[1],B[0],B[1])}
    }
  }
  return d?`<path class="d-thin" d="${d}"/>`:'';
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
  let o=`<path class="d-cen" d="${Lp(E1[0],E1[1],E2[0],E2[1])}"/><path class="d-vis" style="stroke-width:.7" d="${Lp(E1[0],E1[1],E1[0]+ux*6,E1[1]+uy*6)}${Lp(E2[0],E2[1],E2[0]-ux*6,E2[1]-uy*6)}"/>`;
  for(const E of [E1,E2]){const tip=[E[0]+ax*8,E[1]+ay*8];o+=`<path class="d-thin" d="${Lp(E[0],E[1],tip[0],tip[1])}"/>`+arrow(tip,ax,ay)+`<text class="d-t" x="${f2(tip[0]+ax*3.5)}" y="${f2(tip[1]+ay*3.5+1.8)}" font-size="5" text-anchor="middle">A</text>`}
  const sb=sv.d.bb;const top=sv.map((sb.minA+sb.maxA)/2,sb.maxB);
  o+=`<text class="d-t" x="${f2(top[0])}" y="${f2(top[1]-6)}" font-size="5" text-anchor="middle">A-A</text>`;
  return o;
}
function clipSegCircle(a1,b1,a2,b2,ca,cb,r){
  const dx=a2-a1,dy=b2-b1,fx=a1-ca,fy=b1-cb;const A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r;if(A<1e-12)return null;
  const disc=B*B-4*A*C;if(disc<=0)return null;const sq=Math.sqrt(disc);const t0=Math.max(0,(-B-sq)/(2*A)),t1=Math.min(1,(-B+sq)/(2*A));if(t1-t0<1e-6)return null;
  return [a1+dx*t0,b1+dy*t0,a1+dx*t1,b1+dy*t1];
}
function detailsMarkup(S,ctx,s){
  let o='';
  (S.details||[]).forEach(dt=>{
    const v=ctx.views[dt.view];if(!v)return;const k=num(dt.k)||2,ks=s*k;const [ca,cb]=dt.c;
    const C=v.map(ca,cb),r=dt.r*s;
    o+=`<circle class="d-thin" cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(r)}"/><text class="d-t" x="${f2(C[0]+(r+2)*0.72)}" y="${f2(C[1]-(r+2)*0.72)}" font-size="5">${esc(dt.label)}</text>`;
    const mp=(a,b)=>[dt.pos[0]+(a-ca)*ks,dt.pos[1]-(b-cb)*ks];
    let vis='',hid='';
    for(const q of v.d.vis){const c=clipSegCircle(q[0],q[1],q[2],q[3],ca,cb,dt.r);if(c){const A=mp(c[0],c[1]),B=mp(c[2],c[3]);vis+=Lp(A[0],A[1],B[0],B[1])}}
    if(S.hidden)for(const q of v.d.hid){const c=clipSegCircle(q[0],q[1],q[2],q[3],ca,cb,dt.r);if(c){const A=mp(c[0],c[1]),B=mp(c[2],c[3]);hid+=Lp(A[0],A[1],B[0],B[1])}}
    if(hid)o+=`<path class="d-hid" d="${hid}"/>`;if(vis)o+=`<path class="d-vis" d="${vis}"/>`;
    o+=`<circle class="d-thin" cx="${f2(dt.pos[0])}" cy="${f2(dt.pos[1])}" r="${f2(dt.r*ks)}"/><text class="d-t" x="${f2(dt.pos[0])}" y="${f2(dt.pos[1]+dt.r*ks+6)}" font-size="4" text-anchor="middle">${esc(dt.label)} (${scaleLabel(ks)})</text>`;
  });
  return o;
}
function surfMarkup(S,ctx){
  let o='';
  (S.surfs||[]).forEach(sf=>{const v=ctx.views[sf.view];if(!v)return;const P=v.map(sf.p[0],sf.p[1]);const h=4;
    const L=[P[0]-h*0.577,P[1]-h],Rt=[P[0]+2*h*0.577,P[1]-2*h],M=[P[0]+h*0.577,P[1]-h];
    o+=`<path class="d-thin" style="stroke-width:.25" d="${Lp(L[0],L[1],P[0],P[1])}${Lp(P[0],P[1],Rt[0],Rt[1])}${Lp(L[0],L[1],M[0],M[1])}${Lp(Rt[0],Rt[1],Rt[0]+10,Rt[1])}"/><text class="d-t" x="${f2(Rt[0]+0.8)}" y="${f2(Rt[1]-0.9)}" font-size="2.8">Ra ${esc(sf.ra)}</text>`});
  return o;
}
function notesMarkup(S){return (S.notes||[]).map(n=>String(n.text||'').split('\n').map((ln,i)=>`<text class="d-t" x="${f2(n.x)}" y="${f2(n.y+i*5)}" font-size="3.5">${esc(ln)}</text>`).join('')).join('')}

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
  if(S.section&&S.section!=='none')h+=`<div class="grp"><div class="grp-t">Kesit A-A</div><label class="fld"><span>Kesit düzleminin merkeze göre kaydırması</span><div class="inp"><input data-xs="secOff" inputmode="decimal" value="${esc(String(S.secOff||0).replace('.',','))}"><em>mm</em></div></label><p class="note">${S.section==='front'?'Ön görünüş, parçanın ortasından geçen düzlemde kesilmiş olarak çizilir; kesit çizgisi üst görünüşte gösterilir.':'Yan görünüş kesilmiş olarak çizilir; kesit çizgisi ön görünüşte gösterilir.'} Kesit yüzeyleri taranır.</p></div>`;
  const D=S.details||[],F=S.surfs||[],N=S.notes||[];
  h+=`<div class="grp"><div class="grp-t">Detay görünüşleri</div>${D.length?`<div class="dimlist">${D.map((d,i)=>`<div class="dimrow"><span>${esc(d.label)}</span><select data-dk2="${i}" style="${inSt}">${[2,3,4,5,10].map(k=>`<option value="${k}" ${+d.k===k?'selected':''}>×${k}</option>`).join('')}</select><button data-xdel="details:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Detay görünüşü”ne bas; büyütülecek bölgenin merkezine, sonra kenarına, sonra detayın yerine tıkla.</p>'}</div>`;
  h+=`<div class="grp"><div class="grp-t">Yüzey işaretleri</div><label class="fld"><span>Yeni işaret için Ra (µm)</span><input data-xs="raDef" value="${esc(S.raDef||'3,2')}"></label>${F.length?`<div class="dimlist">${F.map((f,i)=>`<div class="dimrow"><span>Ra</span><input data-sra="${i}" value="${esc(f.ra)}" style="${inSt};width:60px"><button data-xdel="surfs:${i}" aria-label="Sil">✕</button></div>`).join('')}</div>`:'<p class="note">Şeritten “Yüzey işareti”ne bas, sonra bir görünüşteki kenara tıkla.</p>'}</div>`;
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
  else hit=false;
  if(hit){saveState();quickRedraw()}
  return hit;
}
function extraPanelClick(e){
  const b=e.target.closest('[data-xdel]');if(!b)return false;const [k,i]=b.dataset.xdel.split(':');const S=dwS();(S[k]||[]).splice(+i,1);saveState();renderDrawing();return true;
}

/* ---------- araçlar: detay, yüzey, not ---------- */
function setDwTool(t,silent){
  dwTool=t;dwSt={stage:0};
  if(t&&dimMode)setDimMode(false);
  sheetWrap.classList.toggle('dim',!!t||dimMode);
  $$('[data-dcmd="detail"],[data-dcmd="surf"],[data-dcmd="note"]').forEach(b=>b.classList.toggle('on',b.dataset.dcmd===t));
  dwTip();if(!silent)drawOverlay(null);
}
function dwTip(){
  const tEl=$('#dwTip');if(!dwTool){if(!dimMode)tEl.classList.remove('on');return}tEl.classList.add('on');
  tEl.textContent=dwTool==='detail'?(['Detay: büyütülecek bölgenin merkezine tıkla. Esc ile çık.','Dairenin kenarına tıkla (bölge yarıçapı).','Detay görünüşünün yerleşeceği boş alana tıkla.'][dwSt.stage||0])
    :dwTool==='surf'?'Yüzey işareti: bir görünüşte kenara tıkla. Ra değeri sağ panelden. Esc ile çık.':'Not: yazının yerine tıkla. Metin sağ paneldeki “Yeni not metni” alanından alınır. Esc ile çık.';
}
function viewAt(p){
  if(!dctx)return null;
  for(const v of Object.values(dctx.views)){if(v.key==='iso')continue;const bb=v.d.bb;const A=v.map(bb.minA,bb.minB),B=v.map(bb.maxA,bb.maxB);
    if(p[0]>=Math.min(A[0],B[0])-4&&p[0]<=Math.max(A[0],B[0])+4&&p[1]>=Math.min(A[1],B[1])-4&&p[1]<=Math.max(A[1],B[1])+4)return v}
  return null;
}
function nearestEdgePoint(p,tol){
  let best=null,bd=tol;
  for(const v of Object.values(dctx.views)){if(v.key==='iso')continue;for(const q of v.d.vis){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((p[0]-A[0])*dx+(p[1]-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));const X=[A[0]+dx*t,A[1]+dy*t];const d=Math.hypot(X[0]-p[0],X[1]-p[1]);if(d<bd){bd=d;best={v,X}}}}
  return best;
}
function dwToolClick(p,ptype){
  const S=dwS();
  if(dwTool==='detail'){
    if(!dwSt.stage){const v=viewAt(p);if(!v){toast('Bir görünüşün (izometrik hariç) içine tıkla.');return}dwSt={stage:1,view:v.key,c:v.inv(p[0],p[1])}}
    else if(dwSt.stage===1){const v=dctx.views[dwSt.view];const C=v.map(dwSt.c[0],dwSt.c[1]);const r=Math.max(3,Math.hypot(p[0]-C[0],p[1]-C[1]));dwSt.r=r/(v.s||dctx.scale);dwSt.stage=2}
    else{S.details=S.details||[];const used=new Set(S.details.map(d=>d.label));let L=66;while(used.has(String.fromCharCode(L)))L++;
      S.details.push({view:dwSt.view,c:dwSt.c,r:dwSt.r,k:2,pos:[p[0],p[1]],label:String.fromCharCode(L)});saveState();setDwTool(null);renderDrawing();return}
    dwTip();drawOverlay(p);return;
  }
  if(dwTool==='surf'){const h=nearestEdgePoint(p,ptype==='mouse'?4:8);if(!h){toast('Bir kenarın üzerine tıkla.');return}S.surfs=S.surfs||[];S.surfs.push({view:h.v.key,p:h.v.inv(h.X[0],h.X[1]),ra:S.raDef||'3,2'});saveState();renderDrawing();return}
  if(dwTool==='note'){S.notes=S.notes||[];S.notes.push({x:p[0],y:p[1],text:S.noteDef||'Keskin kenarları 0,5×45° kırın.'});saveState();setDwTool(null);renderDrawing();return}
}
function dwToolOverlay(p){
  const acc='#1F6FEB';let h='';if(!p||!dctx)return h;
  const w=f2(pxToSheet(1.5));
  if(dwTool==='detail'){
    if(dwSt.stage===1){const v=dctx.views[dwSt.view];const C=v.map(dwSt.c[0],dwSt.c[1]);h+=`<circle cx="${f2(C[0])}" cy="${f2(C[1])}" r="${f2(Math.hypot(p[0]-C[0],p[1]-C[1]))}" fill="none" stroke="${acc}" stroke-width="${w}"/>`}
    if(dwSt.stage===2)h+=`<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(dwSt.r*((dctx.views[dwSt.view]||{}).s||dctx.scale)*2)}" fill="none" stroke="${acc}" stroke-width="${w}" stroke-dasharray="${f2(pxToSheet(4))}"/>`;
  }
  if(dwTool==='surf'){const s=nearestEdgePoint(p,4);if(s)h+=`<circle cx="${f2(s.X[0])}" cy="${f2(s.X[1])}" r="${f2(pxToSheet(5))}" fill="rgba(31,111,235,.2)" stroke="${acc}" stroke-width="${w}"/>`}
  return h;
}
