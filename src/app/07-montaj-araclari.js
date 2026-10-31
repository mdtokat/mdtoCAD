/* Belge kaynağı (parça/montaj), patlatılmış görünüm, girişim algılama, parça listesi ve balonlar. */
/* ================= ÇİZİM BELGESİ (parça veya montaj) ================= */
IC.explode=sv('<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><path d="m10 4 2-2 2 2M10 20l2 2 2-2M4 10l-2 2 2 2M20 10l2 2-2 2"/>');
IC.interf=sv('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 7.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6z" fill="currentColor" fill-opacity=".45"/>');
IC.asmDraw=sv('<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M14 15h6.5M14 17.5h6.5M14 15v5"/><circle cx="8" cy="9" r="2"/><path d="m9.5 10.5 3 3"/>');
IC.balloon=sv('<circle cx="15" cy="9" r="5"/><path d="M11.5 12.5 4 20"/><path d="M14 7.5 15.2 6.6V11.5"/>');
IC.bom=sv('<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M3.5 9h17M3.5 13h17M8 5v14M16 5v14"/>');
let dwOverride=null;
function dwDoc(){
  const d=dwOverride||project.cur.dw;
  if(d&&d.kind==='asm'){const a=project.asms.find(x=>x.id===d.id);if(a)return {kind:'asm',a}}
  if(d&&d.kind==='part'&&dwOverride){const p=partById(d.id);if(p)return {kind:'part',p}}
  return {kind:'part',p:state};
}
function dwS(doc){
  doc=doc||dwDoc();
  if(doc.kind==='asm'){const a=doc.a;if(!a.drawing)a.drawing=Object.assign(defaultDrawing(),{dno:'TZ-M001',asmView:'std',explode:false,balloons:true,bom:true,autodims:true});
    // eksik ayarlar yerinde tamamlanır: nesne her çağrıda yenilenirse ekleme sırasında geçmişe yazmak (pushDwHist) eklenen notu eski nesnede bırakırdı
    const D=defaultDrawing();for(const k in D)if(!(k in a.drawing))a.drawing[k]=D[k];if(!Array.isArray(a.drawing.dims))a.drawing.dims=[];return a.drawing}
  return doc.p.drawing;
}
/* teknik resim geri al/yinele: belge (parça veya montaj) başına, resim ayarlarının tamamı */
const dwHists=new Map();
function dwHistFor(doc){doc=doc||dwDoc();const k=doc.kind==='asm'?'A'+doc.a.id:'P'+doc.p.id;if(!dwHists.has(k))dwHists.set(k,{undo:[],redo:[]});return dwHists.get(k)}
const dwSnap=doc=>JSON.stringify(dwS(doc),cleanR);
function pushDwHist(){const doc=dwDoc(),h=dwHistFor(doc);h.undo.push(dwSnap(doc));if(h.undo.length>80)h.undo.shift();h.redo=[];updUndo()}
function dwRestore(s){const doc=dwDoc(),o=JSON.parse(s);if(doc.kind==='asm')doc.a.drawing=o;else doc.p.drawing=o;dwSel=null;dimSt={stage:0,p1:null,p2:null};saveState();renderDrawRibbon();renderDrawing()}
function dwUndo(){const h=dwHistFor();if(!h.undo.length)return;h.redo.push(dwSnap());dwRestore(h.undo.pop());updUndo()}
function dwRedo(){const h=dwHistFor();if(!h.redo.length)return;h.undo.push(dwSnap());dwRestore(h.redo.pop());updUndo()}
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
function partSrc(p){
  const d=partData(p);const mat=MATERIALS[p.material]||MATERIALS.steel;
  return {kind:'part',key:'P'+p.id+':'+hashStr(d.key),polys:d.polys,ann:d.ann,box:d.box,props:d.props,g:d.g,name:p.partName,matName:p.mesh?'—':mat.name,massG:d.props?d.props.vol/1000*mat.rho:0};
}
const srcCache=new Map();
function asmSrc(a,exploded){
  const f=exploded?1:0;
  const key='A'+a.id+':'+hashStr(JSON.stringify(a.comps.map(c=>[c.part,c.T,!!c.hidden]))+JSON.stringify(a.explode||{})+f+a.comps.map(c=>{const p=partById(c.part);return p?hashStr(partKey(p))+p.material:''}).join());
  if(srcCache.has(key))return srcCache.get(key);
  let polys=[];const ann=[];let massG=0,vol=0,area=0;
  for(const c of a.comps){
    if(c.hidden)continue;const p=partById(c.part);if(!p)continue;const d=partData(p);const M=dispM(a,c,f);
    polys=polys.concat(transformPolys(d.polys,M,c.id));
    // montaj resminde parçaların delik etiketleri ve çap ölçüleri yazılmaz
    for(const an of d.ann)ann.push({...an,C:an.C.clone().applyMatrix4(M),A:an.A.clone().transformDirection(M),gid:c.id+':'+an.gid,label:false,cyl:false});
    if(d.props){vol+=d.props.vol;area+=d.props.area;massG+=d.props.vol/1000*(MATERIALS[p.material]||MATERIALS.steel).rho}
  }
  while(srcCache.size>=2){const k0=srcCache.keys().next().value,v0=srcCache.get(k0);if(v0.g)v0.g.dispose();srcCache.delete(k0)}
  const src={kind:'asm',key,a,polys,ann,box:polys.length?bboxPolys(polys):null,props:{vol,area},g:polysToBuffers(polys).g,name:a.name,matName:'—',massG,exploded:!!exploded};
  srcCache.set(key,src);return src;
}
/* montaj resminde patlatılmış durum yalnızca izometrik görünüştedir (SolidWorks'te görünüş başına “patlatılmış durumda göster”):
   ön, üst ve yan görünüşler (ölçüler, kesit) toplanmış montajı gösterir; yalnızca izometrik düzende tek görünüş patlatılır */
function dwSrc(forIso){const doc=dwDoc();if(doc.kind==='asm'){const S=dwS(doc);return asmSrc(doc.a,!!S.explode&&(!!forIso||S.asmView==='iso'))}return partSrc(doc.p)}

/* ================= PATLATILMIŞ GÖRÜNÜM ================= */
asmUI.exf=0;
function exState(a){if(!a.explode)a.explode={steps:[],on:false};return a.explode}
function explodeOffset(a,c,f){
  const e=a.explode;if(!e||!e.steps||!e.steps.length||!f)return null;let v=[0,0,0],own=false;
  for(const st of e.steps)if(st.comps.includes(c.id)){own=true;const d=Array.isArray(st.dir)?st.dir:(AXDIR[st.dir]||[0,1,0]);v=va(v,vk(d,num(st.dist)*f))}
  // kendi adımı olmayan çoğaltılmış bileşen kaynağıyla birlikte, çoğaltma dönüşümüyle döndürülmüş yönde ayrılır
  if(!own&&c.pat){const s=a.comps.find(x=>x.id===c.seed);const o=s&&explodeOffset(a,s,f);if(o){const R=new T.Matrix4().fromArray(c.T).multiply(new T.Matrix4().fromArray(s.T).invert());const w=v3(o).transformDirection(R).multiplyScalar(vl(o));return [w.x,w.y,w.z]}}
  return v;
}
function dispM(a,c,f){const M=new T.Matrix4().fromArray(c.T);const o=explodeOffset(a,c,f===undefined?asmUI.exf:f);if(o)M.premultiply(new T.Matrix4().makeTranslation(o[0],o[1],o[2]));return M}
let exAnim=0;
function setExplode(on,instant){
  const a=curAsm();if(!a)return;const e=exState(a);
  if(on&&!e.steps.length){autoExplode(a);}
  e.on=on;saveState();cancelAnimationFrame(exAnim);
  const f0=asmUI.exf,f1=on?1:0;
  if(instant||reduceMotion){asmUI.exf=f1;updateAsmPoses();renderAsmRibbon();return}
  const t0=performance.now();
  const step=()=>{const t=Math.min(1,(performance.now()-t0)/550);const k=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;asmUI.exf=f0+(f1-f0)*k;updateAsmPoses();if(t<1)exAnim=requestAnimationFrame(step);else{renderAsmRibbon();asmStatus();asmMass();fitCamera(null)}};
  exAnim=requestAnimationFrame(step);renderAsmRibbon();
}
function collapseIfExploded(){const a=curAsm();if(a&&asmUI.exf>0){exState(a).on=false;asmUI.exf=0;updateAsmPoses();renderAsmRibbon();toast('Düzenleme için montaj toplandı.')}}
function snapAxis(v){const ax=['x','y','z'];let best='y',bv=-1;for(let i=0;i<3;i++){const s=Math.abs(v[i]);if(s>bv){bv=s;best=(v[i]<0?'-':'')+ax[i]}}return best}
/* bileşenin (kutusunun) dünya yönü u üzerindeki izdüşüm aralığı */
function compRange(c,u){const b=compBox(c,true);if(!b)return null;const M=new T.Matrix4().fromArray(c.T);let lo=Infinity,hi=-Infinity;
  for(let i=0;i<8;i++){const p=new T.Vector3(i&1?b.max[0]:b.min[0],i&2?b.max[1]:b.min[1],i&4?b.max[2]:b.min[2]).applyMatrix4(M);const t=p.x*u[0]+p.y*u[1]+p.z*u[2];lo=Math.min(lo,t);hi=Math.max(hi,t)}
  return [lo,hi]}
function autoExplode(a){
  const e=exState(a);const box=(a===curAsm()&&asmView.box)||asmSrc(a,false).box;  // teknik resimdeki montaj 3B görünümdekinden farklı olabilir
  const size=box?Math.max(box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]):100;
  const base=Math.round(size*0.7/5)*5||50;const fixed=a.comps.filter(c=>c.fixed);
  const ref=fixed.length?compCenter(fixed[0],true):(box?new T.Vector3((box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2,(box.min[2]+box.max[2])/2):new T.Vector3());
  e.steps=[];const plan=new Map();
  for(const c of a.comps){
    if(c.fixed||c.pat)continue;let dir=null,partner=null;const cc=compCenter(c,true);
    for(const m of a.mates){if(m.suppressed||m.type!=='coincident')continue;
      const mine=m.a.comp===c.id?m.a:(m.b.comp===c.id?m.b:null),oth=mine===m.a?m.b:m.a;if(!mine||oth.ref.t!=='plane'||mine.ref.t!=='plane')continue;
      const oc=a.comps.find(x=>x.id===oth.comp);if(!oc)continue;const n=new T.Vector3(...oth.ref.n).transformDirection(new T.Matrix4().fromArray(oc.T));dir=[n.x,n.y,n.z];partner=oc;break}
    if(!dir)for(const m of a.mates){if(m.suppressed||!['concentric','hinge','screw'].includes(m.type))continue;const mine=m.a.comp===c.id?m.a:(m.b.comp===c.id?m.b:null);if(!mine)continue;
      const ax=new T.Vector3(...mine.ref.d).transformDirection(new T.Matrix4().fromArray(c.T));const s=cc.clone().sub(ref).dot(ax);dir=[ax.x,ax.y,ax.z].map(x=>x*(s<0?-1:1));const po=(mine===m.a?m.b:m.a).comp;partner=a.comps.find(x=>x.id===po);break}
    if(!dir){const v=cc.clone().sub(ref);dir=v.length()<1e-6?[0,1,0]:[v.x,v.y,v.z]}
    const ax=snapAxis(dir);let dist=base;
    // bileşen eşleştiği parçadan tamamen ayrılsın (ör. yatağa giren uzun mil yatağın içinde kalmasın)
    partner=partner||fixed[0];
    if(partner&&partner!==c){const u=AXDIR[ax],pr=compRange(partner,u),cr=compRange(c,u);if(pr&&cr)dist=Math.max(dist,Math.ceil((pr[1]-cr[0]+Math.max(10,size*0.1))/5)*5)}
    plan.set(c.id,{ax,dist,partner:partner&&partner!==c?partner.id:null});
  }
  // zincir: eşleştiği parça da aynı yönde kayıyorsa onun kayması eklenir (somun, kaydığı flanştan; mil, göbeğinden ayrılır)
  const total=(id,seen)=>{const p=plan.get(id);if(!p)return 0;if(p.tot!==undefined)return p.tot;if(seen.has(id))return p.dist;seen.add(id);
    const q=p.partner&&plan.get(p.partner);p.tot=p.dist+(q&&q.ax===p.ax?total(p.partner,seen):0);return p.tot};
  for(const [id,p] of plan)e.steps.push({id:uid('x'),comps:[id],dir:p.ax,dist:total(id,new Set())});
}
const DIRN={x:'+X','-x':'−X',y:'+Y','-y':'−Y',z:'+Z','-z':'−Z'};
function openExplodePM(){
  const a=curAsm();if(!a||!a.comps.length){toast('Montajda bileşen yok.');return}
  closeAsmPM(true);asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  const box=asmView.box;const size=box?Math.max(box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]):100;
  asmUI.pm={type:'explode',draft:{comps:[],dir:'y',dist:Math.round(size*0.6/5)*5||50}};
  if(asmUI.exf<1&&exState(a).steps.length)setExplode(true);
  renderAsmPM();renderAsmRibbon();asmHighlight();
}
function explodePMBody(){
  const a=curAsm(),e=exState(a),d=asmUI.pm.draft;
  let b=grp('Patlatma',`<div class="relbtns"><button data-ex="auto">Otomatik patlat</button><button data-ex="toggle">${asmUI.exf>0.5?'Topla':'Patlat'}</button><button data-ex="clear" class="danger">Adımları temizle</button></div>`,'Otomatik patlatma, bileşenleri eşleştirildikleri yüzeyin yönünde ayırır. Adımları aşağıdan düzenleyebilirsin.');
  b+=grp(`Adımlar (${e.steps.length})`,e.steps.length?`<div class="lst">${e.steps.map((st,i)=>`<div><span>${i+1}. ${esc(st.comps.map(id=>{const c=compById(id);return c?compName(a,c):'?'}).join(', '))}</span><select data-exdir="${i}" style="height:24px;border:1px solid var(--line);border-radius:4px;background:var(--field)">${Object.entries(DIRN).map(([k,t])=>`<option value="${k}" ${st.dir===k?'selected':''}>${t}</option>`).join('')}</select><input data-exdist="${i}" inputmode="decimal" value="${String(st.dist).replace('.',',')}" style="width:52px;height:24px;border:1px solid var(--line);border-radius:4px;background:var(--field);padding:0 4px"><button data-exdel="${i}" aria-label="Adımı sil">✕</button></div>`).join('')}</div>`:'<p class="note">Henüz adım yok.</p>');
  b+=grp('Yeni adım',`<div class="lst">${d.comps.length?d.comps.map((id,i)=>{const c=compById(id);return `<div><span>${esc(c?compName(a,c):'?')}</span><button data-exun="${i}" aria-label="Çıkar">✕</button></div>`}).join(''):'<div><span style="color:var(--muted)">Ekranda taşınacak bileşenlere tıkla</span></div>'}</div>`+
    `<div class="row2"><label class="fld"><span>Yön</span><select data-exnew="dir">${Object.entries(DIRN).map(([k,t])=>`<option value="${k}" ${d.dir===k?'selected':''}>${t}</option>`).join('')}</select></label>${fNum('Mesafe','dist','mm',d)}</div><button class="sbtn" data-ex="add" ${d.comps.length?'':'disabled'}>Adımı ekle</button>`);
  return b;
}
function explodePmClick(e){
  const a=curAsm(),ex=exState(a),d=asmUI.pm.draft;
  const b=e.target.closest('[data-ex]');
  if(b){const k=b.dataset.ex;
    if(k==='auto'){pushAsmHist();autoExplode(a);asmUI.exf=0;setExplode(true)}
    if(k==='toggle')setExplode(asmUI.exf<0.5);
    if(k==='clear'){pushAsmHist();ex.steps=[];setExplode(false,true)}
    if(k==='add'&&d.comps.length){pushAsmHist();ex.steps.push({id:uid('x'),comps:d.comps.slice(),dir:d.dir,dist:num(d.dist)||0});d.comps=[];asmUI.exf=Math.min(asmUI.exf,0.999);setExplode(true)}
    saveState();renderAsmPM();asmHighlight();return true}
  const dl=e.target.closest('[data-exdel]');if(dl){pushAsmHist();ex.steps.splice(+dl.dataset.exdel,1);updateAsmPoses();saveState();renderAsmPM();return true}
  const un=e.target.closest('[data-exun]');if(un){d.comps.splice(+un.dataset.exun,1);renderAsmPM();asmHighlight();return true}
  return false;
}
function explodePmChange(e){
  const a=curAsm(),ex=exState(a),t=e.target;
  if(t.dataset.exdir){ex.steps[+t.dataset.exdir].dir=t.value;updateAsmPoses();saveState();return}
  if(t.dataset.exdist){const v=num(t.value);if(isFinite(v)){ex.steps[+t.dataset.exdist].dist=v;updateAsmPoses();saveState()}return}
  if(t.dataset.exnew){asmUI.pm.draft.dir=t.value}
}

/* ================= BİLEŞEN ÇOĞALTMA (SolidWorks: Dairesel / Doğrusal Bileşen Çoğaltma) ================= */
/* çoğaltma: {id,name,type:'circ'|'lin',seeds:[bileşen],ref:{comp,ref},n,angle | sp,rev}. Eksen (dairesel) bir bileşenin silindir ekseni,
   yön (doğrusal) bir bileşenin düz yüzeyinin normali veya silindir ekseni; bileşen hareket edince eksen de taşınır.
   Kopyalar montajda {pat,seed,k} işaretli bileşenlerdir: eşleştirme çözücüsünde serbest değildir, her çözümden sonra kaynaktan yeniden konumlanır */
const PAT_MAX=40;
function patMatrices(a,p){
  const rc=a.comps.find(c=>c.id===p.ref.comp);if(!rc)throw new Error('Eksen/yön bileşeni montajda yok.');
  const W=wref(p.ref.ref,new T.Matrix4().fromArray(rc.T));const n=Math.round(num(p.n));if(!(n>=2&&n<=40))throw new Error('Adet 2 ile 40 arasında olmalı.');const out=[];
  if(p.type==='circ'){
    if(W.t!=='axis')throw new Error('Dairesel çoğaltma için bir silindir ekseni seç.');
    const tot=num(p.angle)||360,full=Math.abs(Math.abs(tot)-360)<1e-6,step=(full?360/n:tot/(n-1))*Math.PI/180*(p.rev?-1:1);const d=W.d.clone().normalize(),o=W.p;
    for(let k=1;k<n;k++)out.push(new T.Matrix4().makeTranslation(o.x,o.y,o.z).multiply(new T.Matrix4().makeRotationAxis(d,step*k)).multiply(new T.Matrix4().makeTranslation(-o.x,-o.y,-o.z)));
  }else{
    const d=(W.n||W.d).clone().normalize().multiplyScalar((p.rev?-1:1)*num(p.sp));if(!isFinite(d.x))throw new Error('Aralık geçerli değil.');
    for(let k=1;k<n;k++)out.push(new T.Matrix4().makeTranslation(d.x*k,d.y*k,d.z*k));
  }
  return out;
}
function applyPats(a){
  const keep=new Set();
  for(const p of a.pats||[]){
    let Ms;try{Ms=patMatrices(a,p);p.err=''}catch(e){p.err=e.message;for(const c of a.comps)if(c.pat===p.id)keep.add(c.id);continue}
    for(const sid of p.seeds){const s=a.comps.find(c=>c.id===sid&&!c.pat);if(!s)continue;const S=new T.Matrix4().fromArray(s.T);
      Ms.forEach((Mk,i)=>{const k=i+1;let c=a.comps.find(c=>c.pat===p.id&&c.seed===sid&&c.k===k);
        if(!c){if(a.comps.length>=PAT_MAX){p.err=`Montajda en fazla ${PAT_MAX} bileşen olabilir.`;return}c={id:uid('c'),part:s.part,T:s.T.slice(),pat:p.id,seed:sid,k};a.comps.push(c)}
        c.part=s.part;c.T=Mk.clone().multiply(S).toArray();keep.add(c.id)})}
  }
  const gone=new Set(a.comps.filter(c=>c.pat&&!keep.has(c.id)).map(c=>c.id));
  if(gone.size){a.comps=a.comps.filter(c=>!gone.has(c.id));a.mates=a.mates.filter(m=>mSides(m).every(s=>!gone.has(s.comp)));
    if(a.explode&&a.explode.steps)for(const st of a.explode.steps)st.comps=st.comps.filter(x=>!gone.has(x))}
}
function openPatPM(type,existing){
  const a=curAsm();if(!a||!a.comps.length){toast('Montajda bileşen yok.');return}
  closeAsmPM(true);asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  const h0=asmHistFor(),redo0=h0?h0.redo.slice():null;const snap=asmSnap(a);pushAsmHist();
  const sel=asmUI.sel&&compById(asmUI.sel)&&!compById(asmUI.sel).pat?[asmUI.sel]:[];
  let n=1;while((a.pats||[]).some(p=>p.name===(type==='circ'?'DaireselÇoğaltma':'DoğrusalÇoğaltma')+n))n++;
  const draft=existing?clone(existing):{id:uid('k'),name:(type==='circ'?'DaireselÇoğaltma':'DoğrusalÇoğaltma')+n,type,seeds:sel,ref:null,n:type==='circ'?4:3,angle:360,sp:50,rev:false};
  asmUI.pm={type:'pat',draft,isNew:!existing,editId:existing?existing.id:null,snap,redo0,slot:draft.ref?'seeds':'ref'};
  renderAsmRibbon();renderAsmPM();asmHighlight();renderAsmTree();prompt_(patPrompt());if(existing)previewPat();
}
const patPrompt=()=>{const P=asmUI.pm;if(!P||P.type!=='pat')return null;return P.slot==='ref'?(P.draft.type==='circ'?'Çoğaltma ekseni için bir bileşende silindirik yüze (delik, mil) tıkla.':'Çoğaltma yönü için bir bileşende düz yüzeye (normali) veya silindire (ekseni) tıkla.'):'Çoğaltılacak bileşenlere tıkla; tekrar tıklamak seçimi kaldırır.'};
function patClick(e){
  const P=asmUI.pm,d=P.draft;const h=asmPick(e);if(!h)return;const c=compById(h.comp);if(!c)return;
  if(P.slot==='ref'){
    if(!h.ref||(d.type==='circ'&&h.ref.t!=='axis')){toast(d.type==='circ'?'Eksen için silindirik bir yüze tıkla.':'Yön için düz bir yüze veya silindire tıkla.');return}
    if(c.pat){toast('Çoğaltılmış bileşen referans olamaz; kaynak bileşenden seç.');return}
    d.ref={comp:c.id,ref:h.ref};
    P.slot='seeds';prompt_(patPrompt());previewPat();return;
  }
  if(c.pat){toast('Bu bileşen zaten bir çoğaltmanın kopyası.');return}
  const i=d.seeds.indexOf(c.id);if(i>=0)d.seeds.splice(i,1);else d.seeds.push(c.id);previewPat();
}
/* önizleme: çoğaltma montaja geçici olarak uygulanır (açılıştaki anlık görüntü kapatınca geri gelir) */
function previewPat(){
  const P=asmUI.pm,a=curAsm();if(!P||P.type!=='pat'||!a)return;const d=P.draft;
  const o=JSON.parse(P.snap);a.comps=o.comps;a.pats=(o.pats||[]).filter(p=>p.id!==P.editId);
  P.err='';if(d.ref&&d.seeds.length){a.pats.push(clone(d));applyPats(a);const me=a.pats[a.pats.length-1];P.err=me.err||''}else applyPats(a);
  buildAsmView();asmView.dof=asmDof(a);renderAsmPM();renderAsmTree();asmStatus();asmMass();
}
function commitPat(){
  const P=asmUI.pm,a=curAsm(),d=P.draft;
  if(!d.ref){toast(d.type==='circ'?'Önce çoğaltma eksenini seç.':'Önce çoğaltma yönünü seç.');return}
  if(!d.seeds.length){toast('Çoğaltılacak en az bir bileşen seç.');return}
  previewPat();if(P.err){toast(P.err);return}
  P.committed=true;asmUI.pm=null;prompt_(null);if(!a.pats.length)delete a.pats;asmChanged();renderAsmRibbon();
  toast(`${d.name}: ${d.seeds.length} bileşen × ${Math.round(num(d.n))} adet.`);
}
function patPMBody(){
  const P=asmUI.pm,d=P.draft,a=curAsm();
  const refTxt=d.ref?(()=>{const c=compById(d.ref.comp);return `${c?compName(a,c):'?'}: ${d.ref.ref.t==='axis'?'silindir ekseni'+(d.ref.ref.r?` (Ø${fmt(d.ref.ref.r*2)})`:''):'düz yüzey normali'}`})():'';
  let b=grp(d.type==='circ'?'Çoğaltma ekseni':'Çoğaltma yönü',`<div class="lst"><div style="${P.slot==='ref'?'outline:1px solid var(--accent)':''}" data-pslot="ref"><span>${d.ref?esc(refTxt):`<span style="color:var(--muted)">${d.type==='circ'?'Bir silindirik yüze tıkla':'Bir düz yüze veya silindire tıkla'}</span>`}</span>${d.ref?'<button data-pclr="1" aria-label="Kaldır">✕</button>':''}</div></div>`+
    `<button type="button" class="sbtn" data-prev="1" style="margin-top:6px">⇄ Ters yön</button>`);
  b+=grp(`Çoğaltılacak bileşenler (${d.seeds.length})`,`<div class="lst" data-pslot="seeds" style="${P.slot==='seeds'?'outline:1px solid var(--accent)':''}">${d.seeds.length?d.seeds.map((id,i)=>{const c=compById(id);return `<div><span>${esc(c?compName(a,c):'?')}</span><button data-pun="${i}" aria-label="Çıkar">✕</button></div>`}).join(''):'<div><span style="color:var(--muted)">Ekranda bileşenlere tıkla</span></div>'}</div>`);
  const nTip='Adet kaynak dahildir.';
  b+=grp('Parametreler',d.type==='circ'?`<div class="row2">${fNum('Adet','n','adet',d,nTip)}${fNum('Toplam açı','angle','°',d,'360° girersen kopyalar eşit dağıtılır.')}</div>`:`<div class="row2">${fNum('Aralık','sp','mm',d)}${fNum('Adet','n','adet',d,nTip)}</div>`,'Kopyalar kaynakla ve eksenin bileşeniyle birlikte hareket eder; ayrıca eşleştirilmez. Parça listesinde adet olarak sayılır.');
  if(P.err)b+=`<div class="pm-err on">${esc(P.err)}</div>`;
  return b;
}
function patPmClick(e){
  const P=asmUI.pm,d=P.draft;
  const sl=e.target.closest('[data-pslot]');const cl=e.target.closest('[data-pclr]');const un=e.target.closest('[data-pun]');
  if(cl){d.ref=null;P.slot='ref';prompt_(patPrompt());previewPat();return true}
  if(un){d.seeds.splice(+un.dataset.pun,1);previewPat();return true}
  if(e.target.closest('[data-prev]')){d.rev=!d.rev;previewPat();return true}
  if(sl){P.slot=sl.dataset.pslot;prompt_(patPrompt());renderAsmPM();return true}
  return false;
}
function patPmInput(e){const t=e.target,P=asmUI.pm;if(!t.dataset.num)return;const v=num(t.value);if(!isFinite(v))return;P.draft[t.dataset.k]=v;clearTimeout(patPmInput.t);patPmInput.t=setTimeout(previewPat,250)}

/* ================= GİRİŞİM ALGILAMA ================= */
function csgIntersect(a,b){
  if(!a.length||!b.length)return [];
  const A=new BSP(clonePolys(a)),B=new BSP(clonePolys(b));
  A.invert();B.clipTo(A);B.invert();A.clipTo(B);B.clipTo(A);A.build(B.all());A.invert();return A.all();
}
const interfGroup=new T.Group();asmRoot.add(interfGroup);
const matInterf=new T.MeshBasicMaterial({color:0xE0301E,transparent:true,opacity:.9,depthTest:false,side:T.DoubleSide});
function openInterfPM(){
  const a=curAsm();if(!a||a.comps.length<2){toast('Girişim algılamak için en az iki bileşen gerekli.');return}
  closeAsmPM(true);collapseIfExploded();asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  asmUI.pm={type:'interf',running:false,done:false,progress:0,results:[],contacts:0,show:-1,includeContact:false};
  setGhost(true);renderAsmPM();renderAsmRibbon();runInterf();
}
function setGhost(on){for(const v of asmView.groups.values()){v.mat.transparent=on;v.mat.opacity=on?.22:1;v.mat.depthWrite=!on;v.mat.needsUpdate=true}if(!on)clearInterfView()}
function clearInterfView(){for(const c of [...interfGroup.children]){interfGroup.remove(c);c.geometry.dispose()}}
async function runInterf(){
  const P=asmUI.pm,a=curAsm();P.running=true;P.results=[];P.contacts=0;
  const items=a.comps.filter(c=>!c.hidden).map(c=>{const p=partById(c.part);const d=p?partData(p):null;if(!d||!d.polys.length)return null;const M=new T.Matrix4().fromArray(c.T);
    return {c,polys:transformPolys(d.polys,M,c.id),vol:d.props?d.props.vol:0,ann:d.ann.map(an=>({C:an.C.clone().applyMatrix4(M),A:an.A.clone().transformDirection(M).normalize(),r:an.r}))}}).filter(Boolean);
  items.forEach(it=>it.box=bboxPolys(it.polys));
  const pairs=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const A=items[i].box,B=items[j].box;let hit=true;for(let k=0;k<3;k++)if(A.max[k]<B.min[k]+1e-4||B.max[k]<A.min[k]+1e-4)hit=false;if(hit)pairs.push([items[i],items[j]])}
  P.total=pairs.length;
  for(let k=0;k<pairs.length;k++){
    if(asmUI.pm!==P)return;
    P.progress=k;renderAsmPM();await new Promise(r=>setTimeout(r,15));
    const [A,B]=pairs[k];let r=[];try{r=csgIntersect(A.polys,B.polys)}catch(e){continue}
    if(!r.length)continue;const mp=massProps(r);const vol=Math.abs(mp.vol);if(vol<0.01)continue;
    const thick=mp.area>0?2*vol/mp.area:0;
    const res={a:A.c.id,b:B.c.id,vol,thick,polys:r,contact:thick<0.12||cylContact(A,B,r)};
    if(res.contact)P.contacts++;P.results.push(res);
  }
  P.running=false;P.done=true;P.progress=P.total;showInterf(-1);renderAsmPM();asmStatus();
}
/* aynı çaplı eş eksenli silindirler (mil–delik, cıvata–somun): yüzeyler çakışır; kesişim yalnızca iki yüzeyin çokgen
   farklarından oluşan ince ve yönü tutarsız bir kabuktur (hacmi de yanlış çıkar). Tüm köşeleri ortak silindirin
   üzerinde (yüzey bölme payı içinde) kalıyorsa temas sayılır */
function cylContact(A,B,polys){
  for(const p of A.ann)for(const q of B.ann){
    if(Math.abs(p.r-q.r)>0.05||Math.abs(p.A.dot(q.A))<1-1e-6)continue;
    const w=q.C.clone().sub(p.C);if(w.sub(p.A.clone().multiplyScalar(w.dot(p.A))).length()>0.02)continue;
    const tol=0.02+Math.max(p.r,q.r)*(1-Math.cos(Math.PI/32)),lo=Math.min(p.r,q.r)-tol,hi=Math.max(p.r,q.r)+tol;
    const v=new T.Vector3();let ok=true;
    // köşeler ve çokgen ortaları (dolu bir silindir parçasının uç yüzleri de köşeleri çevrede olan çokgendir; ortası eksendedir)
    const on=x=>{v.set(x.x-p.C.x,x.y-p.C.y,x.z-p.C.z);const t=v.dot(p.A);const d=v.sub(p.A.clone().multiplyScalar(t)).length();return d>=lo&&d<=hi};
    for(const pl of polys){const c={x:0,y:0,z:0};for(const x of pl.verts){if(!on(x)){ok=false;break}c.x+=x.x/pl.verts.length;c.y+=x.y/pl.verts.length;c.z+=x.z/pl.verts.length}if(!ok||!on(c)){ok=false;break}}
    if(ok)return true;
  }
  return false;
}
function showInterf(idx){
  const P=asmUI.pm;if(!P||P.type!=='interf')return;P.show=idx;clearInterfView();
  P.results.forEach((r,i)=>{if((idx<0&&(!r.contact||P.includeContact))||i===idx){const m=new T.Mesh(polysToBuffers(r.polys).g,matInterf);m.renderOrder=8;interfGroup.add(m)}});
}
function interfPMBody(){
  const P=asmUI.pm,a=curAsm();
  const list=P.results.filter(r=>!r.contact||P.includeContact);
  let b='';
  if(P.running)b+=grp('',`<div class="stat under"><i></i>Kontrol ediliyor… (${P.progress}/${P.total} çift)</div>`);
  else{
    b+=grp('',list.length?`<div class="stat over"><i></i>${list.length} girişim bulundu</div>`:`<div class="stat full"><i></i>Girişim yok</div>`);
    if(list.length)b+=grp('Girişimler',`<div class="lst">${P.results.map((r,i)=>(!r.contact||P.includeContact)?`<div style="cursor:pointer;${P.show===i?'outline:1px solid var(--accent)':''}" data-ish="${i}"><span>${esc(compName(a,compById(r.a)))} ↔ ${esc(compName(a,compById(r.b)))}: ${fmt(r.vol,2)} mm³${r.contact?' (temas)':''}</span></div>`:'').join('')}</div><button class="sbtn" data-ish="-1">Tümünü göster</button>`);
    b+=grp('Seçenekler',`<label class="chk" data-tip="Yalnızca yüzey teması olan çiftler (örneğin aynı çaptaki mil ve delik) normalde girişim sayılmaz."><input type="checkbox" data-icont ${P.includeContact?'checked':''}> Çakışan yüzeyleri (temas) girişim say</label><p class="note">${P.contacts?`${P.contacts} çiftte yalnızca temas var.`:'Temas eden çift yok.'}</p><button class="sbtn" data-irun>Yeniden hesapla</button>`);
  }
  return b;
}
function interfPmClick(e){
  const P=asmUI.pm;const s=e.target.closest('[data-ish]');if(s){showInterf(+s.dataset.ish);renderAsmPM();return true}
  if(e.target.closest('[data-irun]')){runInterf();return true}
  return false;
}
function interfPmChange(e){if(e.target.hasAttribute('data-icont')){asmUI.pm.includeContact=e.target.checked;showInterf(-1);renderAsmPM()}}

/* ================= MONTAJ RESMİ: PARÇA LİSTESİ ve BALONLAR ================= */
function bomItems(a){
  const order=[],map=new Map();
  for(const c of a.comps){if(!partById(c.part))continue;if(!map.has(c.part)){map.set(c.part,{qty:0,first:c.id});order.push(c.part)}map.get(c.part).qty++}
  return order.map((pid,i)=>{const p=partById(pid),d=partData(p),mat=MATERIALS[p.material]||MATERIALS.steel,it=map.get(pid);
    return {no:i+1,part:pid,name:p.partName,qty:it.qty,first:it.first,mat:p.mesh?'—':mat.name,mass:d.props?d.props.vol/1000*mat.rho:0}});
}
function bomMarkup(bom,layout,W,H,area){
  const cw=[12,62,14,58,34],RH=6,TW=180;let o='';
  const cells=(x,y,vals,bold)=>{let cx=x;let s='';vals.forEach((v,i)=>{const w=cw[i];const anchor=i===1||i===3?'start':'middle';const tx=anchor==='start'?cx+1.5:cx+w/2;
    s+=`<text class="${bold?'d-l':'d-t'}" x="${f2(tx)}" y="${f2(y+RH/2+1.1)}" font-size="${bold?2.4:2.9}" text-anchor="${anchor}">${esc(v)}</text>`;cx+=w});return s};
  const lines=(x,y,n)=>{let d='';for(let i=0;i<=n;i++)d+=Lp(x,y+i*RH,x+TW,y+i*RH);let cx=x;for(const w of [0,...cw]){cx+=w;d+=Lp(cx,y,cx,y+n*RH)}return `<path class="d-tb" d="${d}"/>`};
  const head=['Poz','Parça adı','Adet','Malzeme','Kütle'];
  const row=it=>[String(it.no),it.name.length>34?it.name.slice(0,33)+'…':it.name,String(it.qty),it.mat.length>30?it.mat.slice(0,29)+'…':it.mat,it.mass?massText(it.mass):'—'];
  const n=bom.length+1;
  if(layout==='full'||layout==='frame'){
    const x=W-10-TW,yb=H-10-(layout==='full'?36:0);const y=yb-n*RH;
    o+=lines(x,y,n);
    bom.slice().reverse().forEach((it,i)=>{o+=cells(x,y+i*RH,row(it),false)});
    o+=cells(x,y+bom.length*RH,head,true);
  }else{
    const x=W-(layout==='min'?12:8)-TW,y=area[1];
    o+=lines(x,y,n);o+=cells(x,y,head,true);bom.forEach((it,i)=>{o+=cells(x,y+(i+1)*RH,row(it),false)});
  }
  return o;
}
/* S.bal: balonların elle taşınmış konumları (otomatik yerden kayma, poz numarasıyla); gizlenen balon S.hide içinde 'B:<no>' */
function balloonsMarkup(v,bom,area,S,ctx){
  if(!v)return '';const d=v.d;
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  for(const q of d.vis){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);mnx=Math.min(mnx,A[0],B[0]);mxx=Math.max(mxx,A[0],B[0]);mny=Math.min(mny,A[1],B[1]);mxy=Math.max(mxy,A[1],B[1])}
  const cx=(mnx+mxx)/2,cy=(mny+mxy)/2;const R=Math.hypot(mxx-mnx,mxy-mny)/2+10;
  const items=[];
  for(const it of bom){
    // bileşenin görünür kenarlarından, bileşenin ortasına en yakın nokta; başka bileşenin kenarına
    // çok yakın noktalar (ör. pimi saran deliğin ağzı) balonun hangi parçayı gösterdiğini belirsizleştirir, önce bunlardan kaçınılır
    const segs=d.vis.filter(q=>q[4]===it.first);if(!segs.length)continue;
    let sx=0,sy=0,sn=0;for(const q of segs){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const L=Math.hypot(B[0]-A[0],B[1]-A[1]);sx+=(A[0]+B[0])/2*L;sy+=(A[1]+B[1])/2*L;sn+=L}
    if(!sn)continue;const mx=sx/sn,my=sy/sn;
    const others=d.vis.filter(q=>q[4]!==it.first).map(q=>[v.map(q[0],q[1]),v.map(q[2],q[3])]);
    const clear=P=>{let m=Infinity;for(const [A,B] of others){const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));m=Math.min(m,Math.hypot(A[0]+dx*t-P[0],A[1]+dy*t-P[1]));if(m<2.5)break}return m};
    const cands=[];
    for(const q of segs){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((mx-A[0])*dx+(my-A[1])*dy)/L2:0;t=Math.max(0.15,Math.min(0.85,t));const P=[A[0]+dx*t,A[1]+dy*t];cands.push({P,dd:Math.hypot(P[0]-mx,P[1]-my)})}
    cands.sort((a,b)=>a.dd-b.dd);
    let best=null,bc=-1;for(const c of cands.slice(0,400)){const cl=clear(c.P);if(cl>=2.5){best=c.P;break}if(cl>bc){bc=cl;best=c.P}}
    items.push({no:it.no,P:best,ang:Math.atan2(best[1]-cy,best[0]-cx)});
  }
  items.sort((a,b)=>a.ang-b.ang);
  const minA=11/R;for(let k=0;k<3;k++)for(let i=1;i<items.length;i++){const d=items[i].ang-items[i-1].ang;if(d<minA){const push=(minA-d)/2;items[i-1].ang-=push;items[i].ang+=push}}
  let o='';const r=4.2;const hide=new Set((S&&S.hide)||[]),mv=(S&&S.bal)||{};
  // balon ölçü yazılarına, diğer görünüşlere ve diğer balonlara değmesin: açı ve yarıçap biraz değiştirilerek boş yer aranır
  const busy=(occ||[]).slice();if(ctx)for(const h of ctx.hits)if(h.t==='view'&&h.k!==v.key)busy.push(h.box);
  const clamp=(x,y)=>[Math.max(area[0]+r+1,Math.min(area[2]-r-1,x)),Math.max(area[1]+r+1,Math.min(area[3]-r-1,y))];
  const lines=(dimSegs||[]).slice();
  const free=(x,y)=>{const B=[x-r-1,y-r-1,x+r+1,y+r+1];return !busy.some(b=>B[0]<b[2]&&B[2]>b[0]&&B[1]<b[3]&&B[3]>b[1])&&!lines.some(g=>segHitsBox(g[0],g[1],g[2],g[3],B))};
  for(const it of items){
    if(hide.has('B:'+it.no))continue;
    let bx,by;const m=mv[it.no];
    if(m)[bx,by]=clamp(cx+R*Math.cos(it.ang)+m[0],cy+R*Math.sin(it.ang)+m[1]);
    else{[bx,by]=clamp(cx+R*Math.cos(it.ang),cy+R*Math.sin(it.ang));
      if(!free(bx,by))search:for(const dr of [0,6,12,20,30,42])for(const da of [0,.12,-.12,.24,-.24,.36,-.36,.5,-.5,.7,-.7]){const P=clamp(cx+(R+dr)*Math.cos(it.ang+da),cy+(R+dr)*Math.sin(it.ang+da));if(free(P[0],P[1])){[bx,by]=P;break search}}}
    busy.push([bx-r,by-r,bx+r,by+r]);
    if(ctx)ctx.hits.push({t:'bal',k:String(it.no),box:[bx-r,by-r,bx+r,by+r]});
    const dx=it.P[0]-bx,dy=it.P[1]-by,L=Math.hypot(dx,dy)||1;const ex=bx+dx/L*r,ey=by+dy/L*r;
    o+=`<path class="d-thin" d="${Lp(ex,ey,it.P[0],it.P[1])}"/><circle class="d-tb" cx="${f2(bx)}" cy="${f2(by)}" r="${r}"/><path class="d-ar" d="M${f2(it.P[0]-0.7)} ${f2(it.P[1])}L${f2(it.P[0])} ${f2(it.P[1]-0.7)}L${f2(it.P[0]+0.7)} ${f2(it.P[1])}L${f2(it.P[0])} ${f2(it.P[1]+0.7)}Z"/><text class="d-t" x="${f2(bx)}" y="${f2(by+1.5)}" font-size="4" text-anchor="middle">${it.no}</text>`;
  }
  return o;
}
function openAsmDrawing(){const a=curAsm();if(!a){toast('Önce bir montaj oluştur.');return}project.cur.dw={kind:'asm',id:a.id};saveState();setTab('drawing')}
