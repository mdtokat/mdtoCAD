/* Delik Sihirbazı arayüzü, eğri kenar seçimi, Ölç aracı, çizim işlemleri (budama, ofset, aynalama, çoğaltma). */
/* ================= AŞAMA 3: ARAÇLAR ================= */
IC.hole=sv('<path d="M4 9.5 12 5.5l8 4-8 4z"/><path d="M4 9.5v6l8 4 8-4v-6M12 13.5v6"/><ellipse cx="12" cy="9.5" rx="3" ry="1.4"/><path d="M9 9.5v5.2M15 9.5v5.2" stroke-dasharray="1.2 1"/><path d="M9.6 11.2 14.4 12.6M9.6 13 14.4 14.4" opacity=".7"/>');
IC.measure=sv('<path d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path d="m7 13 2 2M9.5 10.5l1.5 1.5M12 8l2 2M14.5 5.5l1.5 1.5"/>');
IC.trim=sv('<path d="M3 12h7M14 12h7" /><path d="M12 4v16" opacity=".55"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5" stroke-width="1.4"/>');
IC.offset=sv('<rect x="7" y="7" width="10" height="10" rx="1"/><rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke-dasharray="2 1.6"/>');
IC.smirror=sv('<path d="M12 3v18" stroke-dasharray="3 1.5 1 1.5"/><path d="M9 7 4 12l5 5M15 7l5 5-5 5"/>');
IC.slpat=sv('<circle cx="5" cy="12" r="2.4"/><circle cx="12" cy="12" r="2.4" stroke-dasharray="1.5 1.2"/><circle cx="19" cy="12" r="2.4" stroke-dasharray="1.5 1.2"/><path d="M5 17.5h14M16.5 15.5l2.5 2-2.5 2"/>');
IC.scpat=sv('<circle cx="12" cy="12" r="7" stroke-dasharray="1.6 1.6"/><circle cx="12" cy="5" r="2"/><circle cx="18" cy="15.5" r="2" stroke-dasharray="1.3 1"/><circle cx="6" cy="15.5" r="2" stroke-dasharray="1.3 1"/>');
FT.hole={n:'Delik',label:'Delik Sihirbazı',icon:'hole'};

/* ---------- Delik Sihirbazı (PropertyManager) ---------- */
const HOLE_TYPES=[['simple','Basit'],['clear','Geçiş'],['tapped','Diş (kılavuz)'],['cbore','Faturalı'],['csink','Havşa']];
function openHolePM(){
  if(!model.polys.length){toast('Önce bir gövde oluştur.');return}
  const d={type:'hole',htype:'tapped',size:'M8',fit:'normal',dia:10,cbd:18,cbh:2,csd:18,end:'through',depth:20,tdepth:16,on:null,pts:[]};
  d.id=uid();d.name=nextName(d);openPM('hole',null,d);
  if(sel&&sel.kind==='face'){holeAddPoint(sel)}
  else prompt_('Deliğin açılacağı düz yüzeye tıkla. Aynı yüzeye tıklayarak başka konumlar ekleyebilirsin.');
}
function holeFrame(d){try{return sketchFrame({on:d.on},{frames:pm.base.frames||model.frames,caps:pm.base.caps||model.caps})}catch(e){return null}}
function holeAddPoint(f){
  const d=pm.draft;
  if(!d.on){d.on=faceRef(f)}
  const F=holeFrame(d);if(!F){toast('Yüzey çözülemedi.');return}
  if(Math.abs(vd(F.n,f.n)-1)>1e-5||Math.abs(vd(F.n,f.pt)-vd(F.n,F.o))>1e-3){toast('Tüm konumlar aynı düz yüzeyde olmalı. Başka bir yüzey için yeni bir Delik Sihirbazı kullan.');return}
  const w=vs(f.pt,F.o);let u=vd(w,F.u),v=vd(w,F.v);
  // mevcut dairesel kenar merkezlerine yakala
  const anns=(pm.base.ann||model.ann||[]);let best=null,bd=Math.max(1.5,modelExtent()*0.012);
  for(const an of anns){if(Math.abs(Math.abs(an.A.x*F.n[0]+an.A.y*F.n[1]+an.A.z*F.n[2])-1)>1e-4)continue;const c=[an.C.x,an.C.y,an.C.z];const cu=vd(vs(c,F.o),F.u),cv=vd(vs(c,F.o),F.v);const dd=Math.hypot(cu-u,cv-v);if(dd<bd){bd=dd;best=[cu,cv]}}
  if(best){u=best[0];v=best[1]}else{u=Math.round(u*10)/10;v=Math.round(v*10)/10}
  d.pts.push([Math.round(u*1000)/1000,Math.round(v*1000)/1000]);prompt_(null);renderPM();schedulePreview();
}
function holePMBody(f){
  let b=`<label class="fld"><span>Özellik adı</span><input data-k="name" value="${esc(f.name)}"></label>`;
  b=grp('',b);
  let t=`<div class="relbtns">${HOLE_TYPES.map(([k,n])=>`<button data-htype="${k}" style="${f.htype===k?'border-color:var(--accent);background:var(--accent-soft)':''}">${n}</button>`).join('')}</div>`;
  if(f.htype==='simple')t+=fNum('Çap','dia');
  else{const custom=f.size==='custom'&&f.htype!=='tapped';
    t+=`<div class="row2">`+fSel('Boyut (ISO metrik)','size',Object.keys(HOLE_STD).map(k=>[k,k]).concat(f.htype!=='tapped'?[['custom','Özel ölçü']]:[]));
    t+=(f.htype!=='tapped'&&!custom?fSel('Geçme','fit',[['fine','İnce'],['normal','Normal'],['coarse','Kaba']]):'<span></span>')+`</div>`;
    if(custom){t+=fNum('Delik çapı','dia');if(f.htype==='cbore')t+=`<div class="row2">${fNum('Fatura çapı','cbd')}${fNum('Fatura derinliği','cbh')}</div>`;if(f.htype==='csink')t+=fNum('Havşa çapı (90°)','csd')}}
  b+=grp('Delik türü',t);
  let e=fSel('Bitiş koşulu','end',[['through','Tümünden geç'],['blind','Kör']]);
  if(f.end==='blind'){e+=fNum('Delik derinliği','depth');if(f.htype==='tapped')e+=fNum('Diş derinliği','tdepth')}
  b+=grp('Bitiş',e);
  let info='';try{info=holeSpec(f).txt}catch(err){info=err.message}
  b+=grp('Delik bilgisi',`<p class="note" style="color:var(--ink);font-size:13px">${esc(info)}</p><p class="note">Ölçüler ISO 273 (geçiş), ISO 4762 (faturalı) ve ISO 10642 (havşa) tablolarından alınır.</p>`);
  const F=f.on?holeFrame(f):null;
  let p=f.on?'':`<p class="note">Modelde deliğin açılacağı düz yüzeye tıkla.</p>`;
  if(f.pts.length)p+=`<div class="lst">${f.pts.map((q,i)=>`<div><span>${i+1}.</span><input inputmode="decimal" data-hp="${i}:0" value="${String(q[0]).replace('.',',')}" style="width:72px;height:26px;border:1px solid var(--line);border-radius:4px;background:var(--field);padding:0 5px" aria-label="Konum ${i+1} yatay"><input inputmode="decimal" data-hp="${i}:1" value="${String(q[1]).replace('.',',')}" style="width:72px;height:26px;border:1px solid var(--line);border-radius:4px;background:var(--field);padding:0 5px" aria-label="Konum ${i+1} dikey"><button data-hdel="${i}" aria-label="Konumu sil">✕</button></div>`).join('')}</div>`;
  if(f.on)p+=`<p class="note">Koordinatlar yüzeyin üzerindeki çizim orijinine göredir (parça orijininin yüzeye izdüşümü). Yüzeye tıklayarak konum ekle; mevcut deliklerin ve silindirlerin merkezine yakalanır.</p>`;
  b+=grp(`Konumlar (${f.pts.length})`,p);
  return b;
}
function holePmClick(e){
  const t=e.target.closest('[data-htype]');if(t){pm.draft.htype=t.dataset.htype;if(t.dataset.htype==='tapped'&&!HOLE_STD[pm.draft.size])pm.draft.size='M8';renderPM();schedulePreview();return true}
  const dl=e.target.closest('[data-hdel]');if(dl){pm.draft.pts.splice(+dl.dataset.hdel,1);renderPM();schedulePreview();return true}
  return false;
}
function holePmInput(e){const t=e.target;if(!t.dataset.hp)return false;const [i,k]=t.dataset.hp.split(':').map(Number);const v=num(t.value);if(!isFinite(v)){t.classList.add('bad');return true}t.classList.remove('bad');pm.draft.pts[i][k]=v;schedulePreview();return true}
function holePreview(f,B){
  if(!f.on||!f.pts.length)return;
  const F=sketchFrame({on:f.on},{frames:B.frames||model.frames,caps:B.caps||model.caps});const r=holeTool(f,F,reachFor(B.polys,F));
  for(const t of r.tools)addPreview(t,true);
  const arr=[];for(const q of f.pts)arr.push(...fpt(F,q[0],q[1],0.05));
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));
  const o=new T.Points(g,new T.PointsMaterial({color:0xF08A1A,size:9,sizeAttenuation:false,depthTest:false}));o.renderOrder=9;previewGroup.add(o);
}

/* ---------- eğrisel kenar seçimi (tüm daireyi vurgula) ---------- */
function circleSegsFor(se){
  const m=matchEdge(shown.edges,se);if(!m)return [se];
  if(!isCurvedEdge(shown.edges,m))return [m];
  const anns=(pm&&pm.base&&pm.base.ann)||model.ann||[];const c=findCircleAnn(anns,m);if(!c)return [m];
  return shown.edges.filter(ed=>{const x=findCircleAnn([c.an],ed);return x&&Math.abs(x.te-c.te)<1e-3});
}
function sameEdgeSel(se,ed){
  if(matchEdge([ed],se))return true;
  const segs=circleSegsFor(se);return segs.length>1&&segs.some(s=>vl(vs(s.a,ed.a))<1e-4&&vl(vs(s.b,ed.b))<1e-4);
}

/* ================= ÖLÇ ================= */
let meas=null;
const measGroup=new T.Group();scene.add(measGroup);
const matMeasLine=new T.LineBasicMaterial({color:0xF08A1A,depthTest:false,transparent:true});
function openMeasure(){
  if(activeTab==='model'){if(sk)exitSketch(true);if(pm)closePM(true);cancelPick()}
  if(activeTab==='asm'){closeAsmPM(true,true);asmUI.tool=null;setControlsForSketch(false);collapseIfExploded()}
  meas={picks:[]};prompt_('Ölçmek için yüzey, kenar, köşe veya silindire tıkla (en fazla iki öğe). Kapatmak için Esc.');
  renderMeasurePM();drawMeasure();if(activeTab==='asm')renderAsmRibbon();else renderRibbon();
}
function closeMeasure(){meas=null;prompt_(null);clearMeasure();if(activeTab==='asm'){renderAsmPM();renderAsmRibbon()}else{renderPM();renderRibbon()}}
function clearMeasure(){for(const c of [...measGroup.children]){measGroup.remove(c);if(c.geometry)c.geometry.dispose()}}
function measurePick(e){
  if(activeTab==='asm'){
    const h=asmPick(e);if(!h||!h.ref)return null;const c=compById(h.comp);const M=dispM(curAsm(),c);const w=wref(h.ref,M);const d=partData(partById(c.part));
    if(w.t==='plane'){const r=h.ref;const wl=r.n[0]*r.p[0]+r.n[1]*r.p[1]+r.n[2]*r.p[2];const ps=d.polys.filter(coplanarFilter(r.n,wl));
      return {t:'plane',n:[w.n.x,w.n.y,w.n.z],p:[w.p.x,w.p.y,w.p.z],area:ps.reduce((s,q)=>s+polyArea(q),0),hit:[h.point.x,h.point.y,h.point.z],polys:ps.map(q=>transformPolys([q],M)[0]),label:compName(curAsm(),c)}}
    return {t:'axis',p:[w.p.x,w.p.y,w.p.z],d:[w.d.x,w.d.y,w.d.z],r:h.ref.r,label:compName(curAsm(),c)};
  }
  // köşe
  const r=renderer.domElement.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;let best=null,bd=9;
  for(const ed of shown.edges)for(const p of [ed.a,ed.b]){const s=toScreen(p);const dd=Math.hypot(s[0]-mx,s[1]-my);if(dd<bd){bd=dd;best=p}}
  if(best){ray.setFromCamera(ndc(e),camera);const hit=ray.intersectObject(solidMesh)[0];if(!hit||camera.position.distanceTo(v3(best))<=hit.distance+modelExtent()*0.01)return {t:'pt',p:best.slice()}}
  const ed=pickEdge(e,7);if(ed){if(!isCurvedEdge(shown.edges,ed))return {t:'seg',a:ed.a.slice(),b:ed.b.slice()};const c=findCircleAnn(model.ann||[],ed);if(c)return {t:'axis',p:c.C,d:c.A,r:c.an.r,edge:true}}
  const f=pickFace(e);if(!f)return null;
  for(const an of model.ann||[]){const C=[an.C.x,an.C.y,an.C.z],A=[an.A.x,an.A.y,an.A.z];const w=vs(f.pt,C);const t=vd(w,A);const pr=vl(vs(w,vk(A,t)));
    if(Math.abs(pr-an.r)<Math.max(0.1,an.r*0.04)&&t>=an.t0-0.2&&t<=an.t1+0.2&&Math.abs(vd(f.n,A))<0.25)return {t:'axis',p:C,d:A,r:an.r}}
  const ps=shown.polys.filter(p=>Math.abs(p.plane.n.x*f.n[0]+p.plane.n.y*f.n[1]+p.plane.n.z*f.n[2]-1)<1e-6&&Math.abs(p.plane.w-f.w)<1e-4);
  return {t:'plane',n:f.n,p:f.pt,area:ps.reduce((s,q)=>s+polyArea(q),0),hit:f.pt,polys:ps};
}
function polyArea(q){let a=0;const v=q.verts;for(let i=1;i<v.length-1;i++)a+=v[i].minus(v[0]).cross(v[i+1].minus(v[0])).len();return a/2}
function measureClick(e){
  const p=measurePick(e);if(!p){meas.picks=[];}else{if(meas.picks.length>=2)meas.picks=[];meas.picks.push(p)}
  drawMeasure();if(activeTab==='asm')renderAsmPM();else renderPM();
}
function segClosest(p1,q1,p2,q2){
  const d1=vs(q1,p1),d2=vs(q2,p2),r=vs(p1,p2);const a=vd(d1,d1),e=vd(d2,d2),f=vd(d2,r);let s,t;
  if(a<1e-12&&e<1e-12)return [p1,p2];
  if(a<1e-12){s=0;t=Math.max(0,Math.min(1,f/e))}else{const c=vd(d1,r);if(e<1e-12){t=0;s=Math.max(0,Math.min(1,-c/a))}else{const b=vd(d1,d2),den=a*e-b*b;s=den>1e-12?Math.max(0,Math.min(1,(b*f-c*e)/den)):0;t=(b*s+f)/e;if(t<0){t=0;s=Math.max(0,Math.min(1,-c/a))}else if(t>1){t=1;s=Math.max(0,Math.min(1,(b-c)/a))}}}
  return [va(p1,vk(d1,s)),va(p2,vk(d2,t))];
}
function lineClosest(p1,d1,p2,d2){const r=vs(p1,p2),a=vd(d1,d1),b=vd(d1,d2),c=vd(d1,r),e=vd(d2,d2),f=vd(d2,r),den=a*e-b*b;if(Math.abs(den)<1e-12)return null;const s=(b*f-c*e)/den,t=(a*f-b*c)/den;return [va(p1,vk(d1,s)),va(p2,vk(d2,t))]}
function angBetween(u,v,lines){let c=vd(vn(u),vn(v));if(lines)c=Math.abs(c);return Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI}
function measureResult(){
  const P=meas.picks;const out=[];let line=null;
  const L=x=>fmt(x,3)+' mm';
  if(P.length===1){const a=P[0];
    if(a.t==='pt')out.push(['Nokta',`X ${fmt(a.p[0],3)}  Y ${fmt(a.p[1],3)}  Z ${fmt(a.p[2],3)}`]);
    if(a.t==='seg')out.push(['Kenar uzunluğu',L(vl(vs(a.b,a.a)))]);
    if(a.t==='plane'){out.push(['Yüzey alanı',fmt(a.area,2)+' mm²']);out.push(['Normal',a.n.map(x=>fmt(x,3)).join('  ')])}
    if(a.t==='axis'){out.push(['Çap','Ø'+fmt(a.r*2,3)+' mm']);out.push(['Yarıçap',L(a.r)])}
  }else if(P.length===2){
    const [a,b]=P;const k=a.t+'-'+b.t;const sw=(x,y)=>[y,x];let A=a,B=b;
    const order=['pt','seg','axis','plane'];if(order.indexOf(a.t)>order.indexOf(b.t)){A=b;B=a}
    const t=A.t+'-'+B.t;
    if(t==='pt-pt'){const d=vs(B.p,A.p);out.push(['Mesafe',L(vl(d))],['dX / dY / dZ',`${fmt(Math.abs(d[0]),3)} / ${fmt(Math.abs(d[1]),3)} / ${fmt(Math.abs(d[2]),3)}`]);line=[A.p,B.p]}
    else if(t==='pt-seg'){const [q]=[segClosest(B.a,B.b,A.p,A.p)[0]];out.push(['Mesafe',L(vl(vs(q,A.p)))]);line=[A.p,q]}
    else if(t==='pt-axis'){const w=vs(A.p,B.p);const q=va(B.p,vk(vn(B.d),vd(w,vn(B.d))));out.push(['Eksene mesafe',L(vl(vs(A.p,q)))]);line=[A.p,q]}
    else if(t==='pt-plane'){const n=vn(B.n);const d=vd(vs(A.p,B.p),n);out.push(['Düzleme mesafe',L(Math.abs(d))]);line=[A.p,vs(A.p,vk(n,d))]}
    else if(t==='seg-seg'){const [p,q]=segClosest(A.a,A.b,B.a,B.b);out.push(['En kısa mesafe',L(vl(vs(q,p)))],['Açı',fmt(angBetween(vs(A.b,A.a),vs(B.b,B.a),true),2)+'°']);line=[p,q]}
    else if(t==='seg-axis'){const r=lineClosest(A.a,vs(A.b,A.a),B.p,B.d);const ang=angBetween(vs(A.b,A.a),B.d,true);if(r){out.push(['Eksene en kısa mesafe',L(vl(vs(r[1],r[0])))]);line=r}else{const w=vs(A.a,B.p);const q=va(B.p,vk(vn(B.d),vd(w,vn(B.d))));out.push(['Eksene mesafe (paralel)',L(vl(vs(A.a,q)))]);line=[A.a,q]}out.push(['Açı',fmt(ang,2)+'°'])}
    else if(t==='seg-plane'){const n=vn(B.n);const ang=90-angBetween(vs(A.b,A.a),n,true);out.push(['Açı (kenar–yüzey)',fmt(ang,2)+'°']);if(Math.abs(ang)<0.01){const d=vd(vs(A.a,B.p),n);out.push(['Mesafe',L(Math.abs(d))]);line=[A.a,vs(A.a,vk(n,d))]}}
    else if(t==='axis-axis'){const ang=angBetween(A.d,B.d,true);if(ang<0.01){const w=vs(B.p,A.p);const dA=vn(A.d);const q=vs(w,vk(dA,vd(w,dA)));out.push(['Eksenler arası mesafe',L(vl(q))]);line=[va(A.p,vk(dA,vd(w,dA))),B.p]}else{const r=lineClosest(A.p,A.d,B.p,B.d);if(r){out.push(['En kısa mesafe',L(vl(vs(r[1],r[0])))]);line=r}}out.push(['Açı',fmt(ang,2)+'°'],['Çaplar','Ø'+fmt(A.r*2,3)+' / Ø'+fmt(B.r*2,3)])}
    else if(t==='axis-plane'){const n=vn(B.n);const ang=90-angBetween(A.d,n,true);out.push(['Açı (eksen–yüzey)',fmt(ang,2)+'°']);if(Math.abs(ang)<0.01){const d=vd(vs(A.p,B.p),n);out.push(['Eksenin yüzeye mesafesi',L(Math.abs(d))]);line=[A.p,vs(A.p,vk(n,d))]}}
    else if(t==='plane-plane'){const ang=angBetween(A.n,B.n,false);const par=ang<0.01||ang>179.99;out.push(['Açı',fmt(par?(ang<90?0:180):ang,2)+'°']);if(par){const n=vn(A.n);const c=A.hit;const d=vd(vs(c,B.p),n);out.push(['Yüzeyler arası mesafe',L(Math.abs(d))]);line=[c,vs(c,vk(n,d))]}}
  }
  return {out,line};
}
function drawMeasure(){
  clearMeasure();if(!meas)return;
  const segs=[];const pts=[];
  for(const p of meas.picks){
    if(p.t==='pt')pts.push(...p.p);
    if(p.t==='seg')segs.push({a:p.a,b:p.b});
    if(p.t==='axis'){const d=vn(p.d);const L=Math.max(20,modelExtent()*.4);segs.push({a:va(p.p,vk(d,-L)),b:va(p.p,vk(d,L))})}
    if(p.t==='plane'&&p.polys){const m=new T.Mesh(polysToBuffers(p.polys,()=>true).g,matHov);m.renderOrder=4;measGroup.add(m)}
  }
  const r=measureResult();if(r.line){segs.push({a:r.line[0],b:r.line[1]});pts.push(...r.line[0],...r.line[1])}
  if(segs.length){const l=new T.LineSegments(segGeom(segs),matMeasLine);l.renderOrder=9;measGroup.add(l)}
  if(pts.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));const o=new T.Points(g,new T.PointsMaterial({color:0xF08A1A,size:8,sizeAttenuation:false,depthTest:false}));o.renderOrder=10;measGroup.add(o)}
}
function renderMeasurePM(){
  const ws=$('#ws'),el=$('#pm');ws.classList.add('pmon');requestAnimationFrame(resize);
  const NM={pt:'Köşe',seg:'Kenar',plane:'Düz yüzey',axis:'Silindir / eksen'};
  const r=measureResult();
  let b=grp('Seçimler',meas.picks.length?`<div class="lst">${meas.picks.map((p,i)=>`<div><span>${i+1}. ${NM[p.t]}${p.label?' ('+esc(p.label)+')':''}</span></div>`).join('')}</div><button class="sbtn" data-meas="clear">Seçimi temizle</button>`:'<p class="note">Bir veya iki öğeye tıkla. Üçüncü tıklama yeni ölçüm başlatır.</p>');
  if(r.out.length)b+=grp('Sonuç',`<div class="mass" style="position:static;display:grid;pointer-events:auto;font-size:13px">${r.out.map(([k,v])=>`<span>${k}</span><span>${v}</span>`).join('')}</div>`);
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">Ölç</div><div class="pm-sub">${activeTab==='asm'?'Montaj':'Parça'}</div></div><div class="pm-actions"><button data-meas="close" title="Kapat" aria-label="Kapat">${IC.x}</button></div></div><div class="pm-body">${b}</div>`;
}
function measurePmClick(e){const b=e.target.closest('[data-meas]');if(!b)return false;if(b.dataset.meas==='close')closeMeasure();else{meas.picks=[];drawMeasure();renderMeasurePM()}return true}

/* ================= ÇİZİM İŞLEMLERİ: budama, ofset, aynalama, çoğaltma ================= */
TOOLHELP.trim='Budama: silmek istediğin çizgi parçasına tıkla. Parça, en yakın kesişim noktaları arasında kırpılır; kesişim yoksa öğe silinir.';
function entParamPt(f,e,q){ // tıklanan noktanın öğe üzerindeki parametresi
  if(e.t==='line'){const a=P2(e.a),b=P2(e.b);const dx=b[0]-a[0],dy=b[1]-a[1];return ((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)}
  const c=P2(e.c);return Math.atan2(q[1]-c[1],q[0]-c[0]);
}
function intersectEnts(f,e,o){return entIntersect(f,e,o)}
/* budanacak öğe: imlece en yakın olan; profil öğesi ile yapı çizgisi üst üste geliyorsa profil öğesi seçilir */
function trimPick(f,q,tol){let e=null,bd=tol;for(const x of f.ents){const [d]=entDist(x,q);const k=d+(x.cons?tol*0.3:0);if(d<tol&&k<bd){bd=k;e=x}}return e}
function trimAt(q,tol){
  const f=sk.feat;const e=trimPick(f,q,tol);
  if(!e){toast('Budamak için bir çizgi, yay veya daire parçasına tıkla.');return}
  skPush();
  const hits=[];for(const o of f.ents){if(o===e)continue;for(const p of intersectEnts(f,e,o))hits.push({p,o})}
  // kesim noktası: aynı yerde nokta varsa onu kullan; kesişen öğe sonra bu noktada bölünür
  const cuts=[];
  const newPt=hp=>{let id=ptAt(f,hp.p);if(!id){id=newId(f,'p');f.pts[id]={x:hp.p[0],y:hp.p[1]}}cuts.push({pid:id,o:hp.o});return id};
  // parça tamamen silinirse ölçü ve ilişkileri aynı öğeden kalan parçaya (doğrusal çizgi / aynı daire üzerindeki yay) aktarılır
  const removeEnt=()=>{f.ents=f.ents.filter(x=>x!==e);const s=trimSibling(f,e);if(s)moveRels(f,e,s)};
  const dropLenRels=x=>{if(x.t==='line')f.cons=f.cons.filter(c=>!((c.t==='eq'||c.t==='mid')&&(c.e===x.id||c.e1===x.id||c.e2===x.id)))};
  if(e.t==='line'){
    const tc=entParamPt(f,e,q);const ts=hits.map(hp=>({hp,t:entParamPt(f,e,hp.p)})).filter(x=>x.t>1e-6&&x.t<1-1e-6).sort((a,b)=>a.t-b.t);
    const lo=ts.filter(x=>x.t<tc).pop(),hi=ts.find(x=>x.t>tc);
    if(lo||hi)dropLenRels(e);
    if(!lo&&!hi)removeEnt();
    else if(!lo)e.a=newPt(hi.hp);
    else if(!hi)e.b=newPt(lo.hp);
    else{const nb=e.b;e.b=newPt(lo.hp);const ne={id:newId(f,'e'),t:'line',a:newPt(hi.hp),b:nb,cons:e.cons};f.ents.push(ne);f.cons.push({id:newId(f,'c'),t:'coll',e1:e.id,e2:ne.id})}
  }else if(e.t==='circle'){
    if(hits.length<2){removeEnt()}else{
      const c=P2(e.c);const ang=p=>Math.atan2(p[1]-c[1],p[0]-c[0]);const tc=ang(q);
      const arr=hits.map(hp=>{let a=ang(hp.p)-tc;while(a<0)a+=Math.PI*2;return {hp,a}}).sort((x,y)=>x.a-y.a);
      const next=arr[0],prev=arr[arr.length-1];
      e.t='arc';delete e.r;e.a=newPt(next.hp);e.b=newPt(prev.hp);
    }
  }else{
    const A=arcInfo(f,e);const par=p=>{let a=Math.atan2(p[1]-A.c.y,p[0]-A.c.x)-A.a0;while(a<0)a+=Math.PI*2;while(a>Math.PI*2)a-=Math.PI*2;return a};
    const tc=par(q);const ts=hits.map(hp=>({hp,t:par(hp.p)})).filter(x=>x.t>1e-6&&x.t<A.sw-1e-6).sort((a,b)=>a.t-b.t);
    const lo=ts.filter(x=>x.t<tc).pop(),hi=ts.find(x=>x.t>tc);
    if(!lo&&!hi)removeEnt();
    else if(!lo)e.a=newPt(hi.hp);
    else if(!hi)e.b=newPt(lo.hp);
    else{const nb=e.b;e.b=newPt(lo.hp);const ne={id:newId(f,'e'),t:'arc',c:e.c,a:newPt(hi.hp),b:nb,cons:e.cons};f.ents.push(ne);f.cons.push({id:newId(f,'c'),t:'eq',e1:e.id,e2:ne.id})}
  }
  splitAtCuts(f,cuts);
  cleanupOrphans(f);
  if(!solveSketch(f)){skRestore(sk.hist.pop());toast('Budama sonrası çizim çözülemedi; işlem geri alındı.')}
  sk.sel=[];skChanged();
}
/* budanan öğeyle aynı geometrik öğeden kalan parça: doğrusal çizgi veya aynı merkez ve yarıçaplı yay/daire */
function trimSibling(f,e){
  if(e.t==='line'){const a=P2(e.a),b=P2(e.b);const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;const off=id=>{const p=P2(id);return Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/L};
    return f.ents.find(x=>x!==e&&x.t==='line'&&!!x.cons===!!e.cons&&off(x.a)<1e-6*(1+L)&&off(x.b)<1e-6*(1+L))||null}
  const r=curveR(f,e);return f.ents.find(x=>x!==e&&x.t!=='line'&&x.c===e.c&&!!x.cons===!!e.cons&&Math.abs(curveR(f,x)-r)<1e-6*(1+r))||null;
}
/* e'ye bağlı ilişki ve ölçüleri s'ye taşır; kendine dönen (s–s) ve çizgi uzunluğuna bağlı olanlar atılır, aynıları birleştirilir */
function moveRels(f,e,s){
  for(const c of f.cons)for(const k of ['e','e1','e2'])if(c[k]===e.id)c[k]=s.id;
  const seen=new Set();
  f.cons=f.cons.filter(c=>{if(c.e1&&c.e1===c.e2)return false;if(s.t==='line'&&(c.t==='eq'||c.t==='mid')&&(c.e===s.id||c.e1===s.id||c.e2===s.id))return false;
    const {id,lp,...k}=c;const key=JSON.stringify(k);if(seen.has(key))return false;seen.add(key);return true});
}
/* verilen konumdaki (varsa) çizim noktası */
function ptAt(f,p){const eps=1e-6*(1+Math.abs(p[0])+Math.abs(p[1]));for(const id of ['O',...Object.keys(f.pts)]){const q=skP(f,id);if(Math.hypot(q.x-p[0],q.y-p[1])<eps)return id}return null}
/* Kesişen öğeleri kesim noktalarında böler; böylece budanan kontur uç uca bağlı kalır.
   Yapı geometrisi bölünmez (nokta üzerinde ilişkisiyle bağlanır); daire en az iki noktada yaylara ayrılır. */
function splitAtCuts(f,cuts){
  const onIt=(x,id)=>{const p=P2(id);const eps=1e-6*(1+Math.abs(p[0])+Math.abs(p[1]));
    if(x.a===id||x.b===id)return false;
    if(x.t==='line'){const a=P2(x.a),b=P2(x.b);const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(!L2)return false;const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2;
      return t>1e-6&&t<1-1e-6&&Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/Math.sqrt(L2)<eps*10}
    const A=arcInfo(f,x);if(Math.abs(Math.hypot(p[0]-A.c.x,p[1]-A.c.y)-A.r)>eps*10)return false;
    let da=Math.atan2(p[1]-A.c.y,p[0]-A.c.x)-A.a0;while(da<0)da+=Math.PI*2;while(da>Math.PI*2)da-=Math.PI*2;return da>1e-6&&da<A.sw-1e-6};
  const collin=(o,x)=>{const a=P2(o.a),b=P2(o.b);const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;const d=id=>{const p=P2(id);return Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/L};return d(x.a)<1e-6*(1+L)&&d(x.b)<1e-6*(1+L)};
  const relOn=(id,o)=>{if(!f.cons.some(c=>(c.t==='pol'||c.t==='poc')&&c.p===id&&c.e===o.id))f.cons.push({id:newId(f,'c'),t:o.t==='line'?'pol':'poc',p:id,e:o.id})};
  const circ=new Map();
  for(const {pid,o} of cuts){
    if(!f.ents.includes(o))continue;
    if(o.cons){if(o.a!==pid&&o.b!==pid&&o.c!==pid)relOn(pid,o);continue}
    if(o.t==='circle'){if(!circ.has(o))circ.set(o,[]);if(!circ.get(o).includes(pid))circ.get(o).push(pid);continue}
    // o daha önce bölünmüş olabilir: noktayı içine alan parçayı bul
    const x=onIt(o,pid)?o:f.ents.find(x=>x!==o&&x.t===o.t&&!x.cons&&(o.t==='line'?collin(o,x):x.c===o.c)&&onIt(x,pid));
    if(!x){if(o.a!==pid&&o.b!==pid)relOn(pid,o);continue}
    f.cons=f.cons.filter(c=>!((c.t==='pol'||c.t==='poc')&&c.p===pid&&c.e===x.id));
    const nb=x.b;x.b=pid;const ne={id:newId(f,'e'),t:x.t,a:pid,b:nb,cons:x.cons};if(x.t==='arc')ne.c=x.c;f.ents.push(ne);
    if(x.t==='line'){f.cons.push({id:newId(f,'c'),t:'coll',e1:o.id,e2:ne.id});f.cons=f.cons.filter(c=>!((c.t==='eq'||c.t==='mid')&&(c.e===x.id||c.e1===x.id||c.e2===x.id)))}
  }
  for(const [o,ids] of circ){
    if(ids.length<2){relOn(ids[0],o);continue}
    const c=P2(o.c);const an=id=>{const p=P2(id);return Math.atan2(p[1]-c[1],p[0]-c[0])};ids.sort((a,b)=>an(a)-an(b));
    o.t='arc';delete o.r;o.a=ids[0];o.b=ids[1];
    for(let i=1;i<ids.length;i++)f.ents.push({id:newId(f,'e'),t:'arc',c:o.c,a:ids[i],b:ids[(i+1)%ids.length],cons:o.cons});
  }
}
/* İşlem paneli: ofset, aynala, doğrusal/dairesel çoğalt */
const SKOP_T={offset:'Varlıkları Ofsetle',mirror:'Varlıkları Aynala',lpat:'Doğrusal Çizim Çoğaltma',cpat:'Dairesel Çizim Çoğaltma'};
function setSkOp(t){if(!sk)return;setTool(null);sk.op={t,d:5,flip:false,n:3,sp:20,ang:0,tot:360};renderSketchPM();renderRibbon()}
function skOpBody(){
  const o=sk.op;let b=`<p class="note">`;
  if(o.t==='offset')b+=`Ofsetlenecek çizgi, yay veya daireleri Seç aracıyla seç; bir öğeye çift tıklamak bağlı zincirin tamamını seçer. Bağlı zincirler köşelerde birleştirilir.`;
  if(o.t==='mirror')b+=`Aynalanacak öğeleri ve ayna ekseni olarak bir merkez çizgisini seç. Kopyalar orijinallere simetri ilişkisiyle bağlanır.`;
  if(o.t==='lpat')b+=`Çoğaltılacak öğeleri seç (çift tıklama zinciri seçer). Açı, yatay eksenden saat yönünün tersine ölçülür.`;
  if(o.t==='cpat')b+=`Çoğaltılacak öğeleri seç (çift tıklama zinciri seçer). Merkez olarak bir nokta da seçebilirsin; seçmezsen orijin kullanılır.`;
  b+=`</p>`;
  if(o.t==='offset')b+=fNum('Ofset mesafesi','d','mm',o)+`<label class="chk"><input type="checkbox" data-opflip ${o.flip?'checked':''}> Ters yön</label>`;
  if(o.t==='lpat')b+=`<div class="row2">${fNum('Adet (toplam)','n','adet',o)}${fNum('Aralık','sp','mm',o)}</div>`+fNum('Yön açısı','ang','°',o);
  if(o.t==='cpat')b+=`<div class="row2">${fNum('Adet (toplam)','n','adet',o)}${fNum('Toplam açı','tot','°',o)}</div>`;
  b+=`<div class="relbtns"><button data-opgo>Uygula</button><button data-opx>Kapat</button></div>`;
  return grp(SKOP_T[o.t],b);
}
function skOpClick(e){if(e.target.closest('[data-opgo]')){applySkOp();return true}if(e.target.closest('[data-opx]')){sk.op=null;renderSketchPM();renderRibbon();return true}return false}
function skOpInput(e){const t=e.target;if(!sk.op)return false;if(t.dataset.k&&t.dataset.num){const v=num(t.value);if(isFinite(v))sk.op[t.dataset.k]=v;return true}if(t.hasAttribute('data-opflip')){sk.op.flip=t.checked;return true}return false}
function selEnts(){const E=entMap(sk.feat);return sk.sel.filter(h=>h.k==='ent').map(h=>E[h.id]).filter(Boolean)}
function applySkOp(){
  const o=sk.op,f=sk.feat;let ents=selEnts();
  if(!ents.length){toast('Önce Seç aracıyla öğeleri seç.');return}
  skPush();
  try{
    if(o.t==='offset')doOffset(ents,num(o.d)*(o.flip?-1:1));
    else if(o.t==='mirror')doMirror(ents);
    else if(o.t==='lpat')doLinPattern(ents,Math.round(num(o.n)),num(o.sp),num(o.ang));
    else if(o.t==='cpat'){const pt=sk.sel.find(h=>h.k==='pt');doCircPattern(ents,Math.round(num(o.n)),num(o.tot),pt?pt.id:'O')}
  }catch(err){skRestore(sk.hist.pop());toast(err.message||String(err));return}
  if(!solveSketch(f)){skRestore(sk.hist.pop());toast('İşlem sonrası çizim çözülemedi; geri alındı.');skChanged();return}
  sk.sel=[];skChanged();toast(SKOP_T[o.t]+' uygulandı.');
}
function copyEnts(ents,tf,seed){
  const f=sk.feat;const map=Object.assign({},seed);
  const cp=id=>{if(map[id])return map[id];const p=P2(id);const [x,y]=tf(p[0],p[1]);
    // kopya var olan bir noktaya düşüyorsa (komşu kanadın ucu gibi) o nokta kullanılır; böylece kontur kapanır
    const hit=ptAt(f,[x,y]);if(hit){map[id]=hit;return hit}
    const nid=newId(f,'p');f.pts[nid]={x,y};map[id]=nid;return nid};
  for(const e of ents){
    if(e.t==='line')f.ents.push({id:newId(f,'e'),t:'line',a:cp(e.a),b:cp(e.b),cons:e.cons});
    else if(e.t==='circle'){const ne={id:newId(f,'e'),t:'circle',c:cp(e.c),r:e.r,cons:e.cons};f.ents.push(ne);f.cons.push({id:newId(f,'c'),t:'eq',e1:e.id,e2:ne.id})}
    else{const ne={id:newId(f,'e'),t:'arc',c:cp(e.c),a:cp(e.a),b:cp(e.b),cons:e.cons};f.ents.push(ne)}
  }
  return map;
}
/* Çoğaltmanın dayanak noktası: seçili öğelerin ilk noktası (merkez dışında) */
function patAnchor(ents,ctr){
  const ids=[];for(const e of ents)for(const k of ['c','a','b'])if(e[k]&&!ids.includes(e[k]))ids.push(e[k]);
  const C=ctr?P2(ctr):null;return ids.find(id=>!C||Math.hypot(P2(id)[0]-C[0],P2(id)[1]-C[1])>1e-6)||null;
}
/* Doğrusal çizim çoğaltma: kopyalar, kaynaktan ilk kopyaya giden yapı çizgisinin k katı ötelenir (aralık ölçüsü bu çizgide) */
function doLinPattern(ents,n,sp,ang){
  const f=sk.feat;if(!(n>=2&&n<=100))throw new Error('Adet 2 ile 100 arasında olmalı.');if(!(sp>0))throw new Error('Aralık sıfırdan büyük olmalı.');
  const a=ang*Math.PI/180,dx=Math.cos(a)*sp,dy=Math.sin(a)*sp;const A=patAnchor(ents,null);
  const pA=P2(A);const B=newId(f,'p');f.pts[B]={x:pA[0]+dx,y:pA[1]+dy};
  const ax=addEnt({t:'line',a:A,b:B,cons:true});const am=((ang%360)+360)%360;
  if(Math.abs(am%180)<1e-9)f.cons.push({id:newId(f,'c'),t:'h',e:ax.id});else if(Math.abs(am%180-90)<1e-9)f.cons.push({id:newId(f,'c'),t:'v',e:ax.id});
  f.cons.push({id:newId(f,'c'),t:'d',p:A,q:B,val:sp,lp:[pA[0]+dx/2-dy/sp*(sk.px||0.3)*24,pA[1]+dy/2+dx/sp*(sk.px||0.3)*24]});
  for(let k=1;k<n;k++){const map=copyEnts(ents,(x,y)=>[x+dx*k,y+dy*k],k===1?{[A]:B}:null);
    for(const src in map)if(!(k===1&&src===A)&&map[src]!==src)f.cons.push({id:newId(f,'c'),t:'tr',p:src,q:map[src],r:A,s:B,k})}
}
/* Dairesel çizim çoğaltma: kopyalar merkez etrafında, merkezden kaynağa ve ilk kopyaya giden iki yapı çizgisi arasındaki açının k katı döner */
function doCircPattern(ents,n,tot,ctr){
  const f=sk.feat;if(!(n>=2&&n<=100))throw new Error('Adet 2 ile 100 arasında olmalı.');
  const full=Math.abs(Math.abs(tot)-360)<1e-6;const stD=full?360/n:tot/(n-1);if(!(Math.abs(stD)>1e-6))throw new Error('Toplam açı sıfırdan farklı olmalı.');
  const A=patAnchor(ents,ctr);if(!A)throw new Error('Çoğaltılacak öğeler merkezle çakışıyor.');
  const c=P2(ctr),st=stD*Math.PI/180;const rot=(k)=>(x,y)=>{const ca=Math.cos(st*k),sa=Math.sin(st*k);return [c[0]+(x-c[0])*ca-(y-c[1])*sa,c[1]+(x-c[0])*sa+(y-c[1])*ca]};
  const pA=P2(A),qB=rot(1)(pA[0],pA[1]);const B=newId(f,'p');f.pts[B]={x:qB[0],y:qB[1]};
  const l1=addEnt({t:'line',a:ctr,b:A,cons:true}),l2=addEnt({t:'line',a:ctr,b:B,cons:true});
  f.cons.push({id:newId(f,'c'),t:'eq',e1:l1.id,e2:l2.id});
  if(Math.abs(stD)<179.9){const R=Math.hypot(pA[0]-c[0],pA[1]-c[1]);const mid=Math.atan2(pA[1]-c[1],pA[0]-c[0])+st/2;
    f.cons.push({id:newId(f,'c'),t:'dang',e1:l1.id,e2:l2.id,r1:false,r2:false,val:Math.round(Math.abs(stD)*1e4)/1e4,lp:[c[0]+R*0.6*Math.cos(mid),c[1]+R*0.6*Math.sin(mid)]})}
  for(let k=1;k<n;k++){const map=copyEnts(ents,rot(k),k===1?{[A]:B}:null);
    for(const src in map)if(!(k===1&&src===A)&&map[src]!==src)f.cons.push({id:newId(f,'c'),t:'rot',p:src,q:map[src],r:A,s:B,o:ctr,k})}
}
function doMirror(ents){
  const f=sk.feat;const axis=ents.find(e=>e.t==='line'&&e.cons)||null;
  if(!axis)throw new Error('Ayna ekseni olarak bir merkez çizgisi (yapı çizgisi) seç.');
  const items=ents.filter(e=>e!==axis);if(!items.length)throw new Error('Aynalanacak öğe seçilmedi.');
  const a=P2(axis.a),b=P2(axis.b);const d=[b[0]-a[0],b[1]-a[1]];const L=Math.hypot(...d);const u=[d[0]/L,d[1]/L];
  const refl=p=>{const w=[p[0]-a[0],p[1]-a[1]];const t=w[0]*u[0]+w[1]*u[1];const f_=[a[0]+u[0]*t,a[1]+u[1]*t];return [2*f_[0]-p[0],2*f_[1]-p[1]]};
  const map={};
  const mp=id=>{if(map[id])return map[id];const p=P2(id);const q=refl(p);if(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-6){map[id]=id;return id}
    const hit=ptAt(f,q);if(hit){map[id]=hit;f.cons.push({id:newId(f,'c'),t:'sym',p:id,q:hit,e:axis.id});return hit}
    const nid=newId(f,'p');f.pts[nid]={x:q[0],y:q[1]};map[id]=nid;f.cons.push({id:newId(f,'c'),t:'sym',p:id,q:nid,e:axis.id});return nid};
  for(const e of items){
    if(e.t==='line')f.ents.push({id:newId(f,'e'),t:'line',a:mp(e.a),b:mp(e.b),cons:e.cons});
    else if(e.t==='circle'){const ne={id:newId(f,'e'),t:'circle',c:mp(e.c),r:e.r,cons:e.cons};f.ents.push(ne);f.cons.push({id:newId(f,'c'),t:'eq',e1:e.id,e2:ne.id})}
    else f.ents.push({id:newId(f,'e'),t:'arc',c:mp(e.c),a:mp(e.b),b:mp(e.a),cons:e.cons});
  }
}
function doOffset(ents,dist){
  const f=sk.feat;if(!(Math.abs(dist)>0))throw new Error('Ofset mesafesi sıfırdan büyük olmalı.');
  // tüm ofset öğeleri tek bir sürücü ölçüye (doff) bağlanır; ölçü değişince hepsi birlikte kayar
  let drv=null;
  const offRel=(src,ne)=>{
    let sg;if(src.t==='line'){const a=P2(src.a),b=P2(src.b),p=P2(ne.a);const dx=b[0]-a[0],dy=b[1]-a[1];sg=Math.sign(((p[0]-a[0])*dy-(p[1]-a[1])*dx))||1}
    else sg=Math.sign(curveR(f,ne)-curveR(f,src))||1;
    if(!drv){let lp;const g=(sk.px||0.3)*22;
        if(ne.t==='line'){const p=P2(ne.a),q=P2(ne.b),s0=P2(src.a);const n=[q[1]-p[1],p[0]-q[0]],nl=Math.hypot(...n)||1;const sd=Math.sign((p[0]-s0[0])*n[0]+(p[1]-s0[1])*n[1])||1;lp=[(p[0]+q[0])/2+n[0]/nl*sd*g,(p[1]+q[1])/2+n[1]/nl*sd*g]}
        else{const c=P2(ne.c),r=curveR(f,ne);lp=[c[0]+(r+g)*Math.SQRT1_2,c[1]-(r+g)*Math.SQRT1_2]}
      drv={id:newId(f,'c'),t:'doff',e1:src.id,e2:ne.id,sg,val:Math.abs(dist),lp};f.cons.push(drv)}
    else f.cons.push({id:newId(f,'c'),t:'offd',e1:src.id,e2:ne.id,sg,dim:drv.id});
  };
  // bağlı zincirleri bul
  const left=new Set(ents);const chains=[];
  while(left.size){
    const first=left.values().next().value;left.delete(first);
    if(first.t==='circle'){chains.push({items:[{e:first}],closed:true});continue}
    let chain=[{e:first,fwd:true}];
    const ends=()=>[chain[0].fwd?chain[0].e.a:chain[0].e.b,chain[chain.length-1].fwd?chain[chain.length-1].e.b:chain[chain.length-1].e.a];
    let grow=true;
    while(grow){grow=false;const [s,t]=ends();
      for(const e of [...left]){if(e.t==='circle')continue;
        if(e.a===t){chain.push({e,fwd:true});left.delete(e);grow=true;break}
        if(e.b===t){chain.push({e,fwd:false});left.delete(e);grow=true;break}
        if(e.b===s){chain.unshift({e,fwd:true});left.delete(e);grow=true;break}
        if(e.a===s){chain.unshift({e,fwd:false});left.delete(e);grow=true;break}}}
    const [s,t]=ends();chains.push({items:chain,closed:s===t&&chain.length>1});
  }
  for(const ch of chains){
    if(ch.items[0].e.t==='circle'){const e=ch.items[0].e;const r=e.r+dist;if(!(r>0))throw new Error('Ofset dairenin yarıçapından büyük olamaz.');const ne={id:newId(f,'e'),t:'circle',c:e.c,r};f.ents.push(ne);offRel(e,ne);continue}
    // kapalı zincirde yön: pozitif mesafe dışarı
    let sgn=1;
    if(ch.closed){const poly=[];for(const it of ch.items){const t=tessEnt(f,it.e,32);const s=it.fwd?t:t.slice().reverse();for(let i=0;i<s.length-1;i++)poly.push(s[i])}if(area2d(poly)>0)sgn=-1}
    const off=dist*sgn;
    // her öğenin ofset hali (sol normal yönünde)
    const segs=ch.items.map(it=>{const e=it.e;
      if(e.t==='line'){const a=P2(it.fwd?e.a:e.b),b=P2(it.fwd?e.b:e.a);const d=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(...d);const n=[-d[1]/L,d[0]/L];return {t:'line',a:[a[0]+n[0]*off,a[1]+n[1]*off],b:[b[0]+n[0]*off,b[1]+n[1]*off],src:e}}
      const A=arcInfo(f,e);const r=A.r-off*(it.fwd?1:-1);if(!(r>0))throw new Error('Ofset bir yayın yarıçapından büyük.');
      const pa=P2(it.fwd?e.a:e.b),pb=P2(it.fwd?e.b:e.a);const c=[A.c.x,A.c.y];const ua=[(pa[0]-c[0])/A.r,(pa[1]-c[1])/A.r],ub=[(pb[0]-c[0])/A.r,(pb[1]-c[1])/A.r];
      return {t:'arc',a:[c[0]+ua[0]*r,c[1]+ua[1]*r],b:[c[0]+ub[0]*r,c[1]+ub[1]*r],c:e.c,fwd:it.fwd,src:e}});
    // birleşimler
    const N=segs.length;const joints=[];
    for(let i=0;i<N;i++){
      if(!ch.closed&&i===N-1)break;const s1=segs[i],s2=segs[(i+1)%N];let p=[(s1.b[0]+s2.a[0])/2,(s1.b[1]+s2.a[1])/2];
      if(s1.t==='line'&&s2.t==='line'){const r=[s1.b[0]-s1.a[0],s1.b[1]-s1.a[1]],q=[s2.b[0]-s2.a[0],s2.b[1]-s2.a[1]];const den=r[0]*q[1]-r[1]*q[0];if(Math.abs(den)>1e-9){const t=((s2.a[0]-s1.a[0])*q[1]-(s2.a[1]-s1.a[1])*q[0])/den;p=[s1.a[0]+r[0]*t,s1.a[1]+r[1]*t]}}
      joints.push(p);
    }
    const mk=p=>{const id=newId(f,'p');f.pts[id]={x:p[0],y:p[1]};return id};
    const jid=joints.map(mk);
    const startId=ch.closed?jid[N-1]:mk(segs[0].a),endId=ch.closed?jid[N-1]:mk(segs[N-1].b);
    segs.forEach((s,i)=>{const a=i===0?startId:jid[i-1],b=(i===N-1)?endId:jid[i];
      if(s.t==='line'){const ne={id:newId(f,'e'),t:'line',a,b};f.ents.push(ne);f.cons.push({id:newId(f,'c'),t:'par',e1:s.src.id,e2:ne.id});offRel(s.src,ne)}
      else{const ne={id:newId(f,'e'),t:'arc',c:s.c,a:s.fwd?a:b,b:s.fwd?b:a};f.ents.push(ne);offRel(s.src,ne)}
    });
  }
}
