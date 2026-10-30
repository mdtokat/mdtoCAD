/* FeatureManager ağacı, CommandManager şeridi, PropertyManager (özellik düzenleme) ve önizleme. */
/* ================= ÖZELLİK AĞACI (FeatureManager) ================= */
const byId=id=>state.features.find(f=>f.id===id);
function consumedMap(){const m={};for(const f of state.features)if((f.type==='extrude'||f.type==='revolve')&&f.sketch)m[f.sketch]=f.id;return m}
function renderTree(){
  if(activeTab==='asm'){renderAsmTree();return}
  const cons=consumedMap();
  let h=`<div class="tree-proj"><select id="partSel" aria-label="Etkin parça">${project.parts.map(p=>`<option value="${p.id}" ${p===state?'selected':''}>${esc(p.partName)}</option>`).join('')}</select><button class="tbtn" data-pa="new" title="Yeni parça">+ Yeni</button><button class="tbtn" data-pa="dup" title="Parçayı çoğalt">Çoğalt</button><button class="tbtn" data-pa="del" title="Parçayı projeden sil">Sil</button></div>`;
  h+=`<div class="tree-part"><input id="partNameIn" value="${esc(state.partName)}" aria-label="Parça adı"><select id="matSel" aria-label="Malzeme">${Object.entries(MATERIALS).map(([k,m])=>`<option value="${k}" ${k===state.material?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>`;
  for(const k of ['front','top','right']){
    const s=(sel&&sel.kind==='plane'&&sel.key===k)||(pm&&pm.type==='mirror'&&pm.draft.plane===k)||(pm&&pm.type==='plane'&&pm.draft.base===k);
    h+=`<div class="ti ${s?'sel':''}" data-plane="${k}"><span class="ic">${IC.plane}</span><span class="nm">${STD_NAMES[k]}</span><span class="acts"><button data-a="sketchon" title="Bu düzlemde çizim başlat">${IC.sketch}</button></span></div>`;
  }
  h+=`<div class="ti" data-origin="1"><span class="ic">${IC.origin}</span><span class="nm">Orijin</span><span class="acts" style="display:flex"><button data-a="planes" title="Düzlemleri göster/gizle" style="color:${showPlanes?'var(--accent)':''}">${IC.eye}</button></span></div>`;
  if(state.mesh){h+=`<div class="ti"><span class="ic">${IC.iso}</span><span class="nm">İçe aktarılan gövde (STL)</span></div><div class="tree-empty">Bu parça STL dosyasından alındı. Ölçüleri değiştirilemez; montajda ve teknik resimde kullanılabilir.</div>`;$('#tree').innerHTML=h;return}
  if(!state.features.length)h+=`<div class="tree-empty">Henüz özellik yok. Bir düzlem seç, sonra şeritten Çizim'e bas.</div>`;
  const row=(f,child)=>{
    const err=model.errors[f.id];const isSel=(sel&&sel.kind==='feature'&&sel.id===f.id)||(sel&&sel.kind==='plane'&&sel.key===f.id)||(pm&&pm.draft&&((pm.draft.targets||[]).includes(f.id)||pm.draft.sketch===f.id||(pm.type==='mirror'&&pm.draft.plane===f.id)||(pm.type==='plane'&&pm.draft.base===f.id)));
    const active=(sk&&sk.feat.id===f.id)||(pm&&!pm.isNew&&pm.draft.id===f.id);
    let nm=esc(f.name);if(f.type==='sketch'&&model.dof[f.id]>0)nm=`<em>(-)</em> `+nm;
    let acts='';
    if(f.type==='sketch')acts=`<button data-a="editsk" title="Çizimi düzenle">${IC.edit}</button>`;
    else acts=`<button data-a="edit" title="Özelliği düzenle">${IC.edit}</button>`+(f.sketch?`<button data-a="editsk" title="Çizimi düzenle">${IC.sketch}</button>`:'')+(f.type==='plane'?`<button data-a="sketchon" title="Bu düzlemde çizim başlat">${IC.sketch}</button>`:'');
    acts+=`<button data-a="sup" title="${f.suppressed?'Bastırmayı kaldır':'Bastır'}">${f.suppressed?IC.play:IC.pause}</button><button data-a="del" title="Sil">${IC.trash}</button>`;
    return `<div class="ti ${child?'child':''} ${isSel?'sel':''} ${active?'active':''} ${f.suppressed?'sup':''} ${err?'err':''} ${f.op==='cut'?'cut':''}" data-id="${f.id}" title="${esc(typeLabel(f))}"><span class="ic">${IC[typeIcon(f)]}</span><span class="nm">${nm}</span><span class="acts">${acts}</span></div>`+(err?`<div class="tree-err">${esc(err)}</div>`:'');
  };
  for(const f of state.features){
    if(f.type==='sketch'&&cons[f.id])continue;
    h+=row(f,false);
    if(f.sketch){const s=byId(f.sketch);if(s)h+=row(s,true)}
  }
  $('#tree').innerHTML=h;
}
let treeLast=null;
$('#tree').addEventListener('click',e=>{
  if(activeTab==='asm'){asmTreeClick(e);return}
  const pa=e.target.closest('[data-pa]');if(pa){partAction(pa.dataset.pa);return}
  const a=e.target.closest('[data-a]');const act=a&&a.dataset.a;
  if(act==='planes'){showPlanes=!showPlanes;updatePlaneVis();applyDisplay();renderTree();return}
  const pl=e.target.closest('[data-plane]');
  if(pl){
    const k=pl.dataset.plane;
    if(act==='sketchon'||pickMode==='plane'){if(sk)return;startSketch({kind:'std',key:k});return}
    if(pm&&pm.type==='mirror'){pm.draft.plane=k;renderPM();renderTree();updatePlaneVis();schedulePreview();return}
    if(pm&&pm.type==='plane'){pm.draft.base=k;renderPM();renderTree();updatePlaneVis();schedulePreview();return}
    if(sk)return;setSel(sel&&sel.kind==='plane'&&sel.key===k?null:{kind:'plane',key:k});return;
  }
  const ti=e.target.closest('.ti[data-id]');if(!ti)return;const id=ti.dataset.id,f=byId(id);if(!f)return;
  if(!act){
    if(pm){
      if(['lpattern','cpattern','mirror'].includes(pm.type)&&(f.type==='extrude'||f.type==='revolve'||f.type==='hole')){const t=pm.draft.targets;const i=t.indexOf(id);if(i>=0)t.splice(i,1);else t.push(id);renderPM();renderTree();schedulePreview();return}
      if((pm.type==='extrude'||pm.type==='revolve')&&f.type==='sketch'){pm.draft.sketch=id;if(pm.type==='revolve')pm.draft.axis=defaultAxis(f);renderPM();renderTree();schedulePreview();return}
      if(pm.type==='mirror'&&f.type==='plane'){pm.draft.plane=id;renderPM();renderTree();updatePlaneVis();schedulePreview();return}
      if(pm.type==='plane'&&f.type==='plane'&&f.id!==pm.draft.id){pm.draft.base=id;renderPM();renderTree();updatePlaneVis();schedulePreview();return}
      return;
    }
    if(pickMode==='plane'&&f.type==='plane'){startSketch({kind:'plane',id});return}
    if(sk)return;
    // çift tıklama: ilk tıklama ağacı yeniden çizdiği için tarayıcının dblclick olayı gelmez; burada yakalanır
    const now=performance.now();if(treeLast&&treeLast.id===id&&now-treeLast.t<450){treeLast=null;if(f.type==='sketch')editSketch(id);else openPM(f.type,f);return}
    treeLast={id,t:now};
    setSel(sel&&((sel.kind==='feature'&&sel.id===id)||(sel.kind==='plane'&&sel.key===id))?null:(f.type==='plane'?{kind:'plane',key:id}:{kind:'feature',id}));return;
  }
  if(act==='edit'){openPM(f.type,f);return}
  if(act==='editsk'){editSketch(f.type==='sketch'?id:f.sketch);return}
  if(act==='sketchon'){startSketch({kind:'plane',id});return}
  if(sk||pm)return;
  if(act==='sup'){
    // bağlı öğeler (yüzeyine çizilen çizimler, onları kullanan özellikler…) de birlikte bastırılır/geri getirilir; yoksa hata verirlerdi
    pushHist();const on=!f.suppressed;const ids=new Set([f.id]);if(f.sketch)ids.add(f.sketch);
    const deps=dependents(ids);for(const g of [f,...(f.sketch?[byId(f.sketch)]:[]),...deps])if(g)g.suppressed=on;
    afterChange();if(deps.length)toast(`“${f.name}” ve bağlı ${deps.length} öğe ${on?'bastırıldı':'geri getirildi'}.`,{label:'Geri al',fn:undoStep()})}
  else if(act==='del')deleteFeature(f);
});
/* silinen öğeler olmadan hesaplanamayacak özellikler (ağaç sırasıyla, zincirleme): yüzeyine/düzlemine çizilen çizimler,
   çizimini kullanan özellikler, tüm hedefleri silinen çoğaltmalar, kenarları silinen özelliğin yüzeyinde olan radyuslar */
function dependents(ids){
  const D=new Set(ids),out=[];
  for(const g of state.features){if(D.has(g.id))continue;const on=g.on||{},t=g.targets||[];
    const uses=(on.kind==='face'&&D.has(on.feat))||(on.kind==='plane'&&D.has(on.id))||(g.sketch&&D.has(g.sketch))||(g.type==='plane'&&(D.has(g.base)||(g.base&&D.has(g.base.feat))))||(g.type==='mirror'&&(D.has(g.plane)||(g.plane&&D.has(g.plane.feat))))||
      (t.length>0&&t.every(x=>D.has(x)))||(g.edges||[]).some(e=>e.sig&&e.sig.f&&e.sig.f.some(x=>D.has(x)));
    if(uses){D.add(g.id);out.push(g)}}
  return out;
}
function deleteFeature(f){
  // özellik silinince çizimi ağaçta kalır (SolidWorks gibi); çizim ayrıca silinir.
  // çizim silinirse ona bağlı özellik çizimsiz kalacağı için onunla birlikte gider.
  const ids=new Set([f.id]);let dep=null;
  if(f.type==='sketch'){const c=consumedMap()[f.id];if(c){ids.add(c);dep=byId(c)}}
  const deps=dependents(ids);
  const run=withDeps=>{
    pushHist();const all=new Set(ids);if(withDeps)for(const g of deps)all.add(g.id);
    state.features=state.features.filter(x=>!all.has(x.id));
    // çoğaltma/aynalama hedeflerinden silinenler çıkarılır (kalan hedefler çalışmaya devam eder)
    for(const g of state.features)if(Array.isArray(g.targets))g.targets=g.targets.filter(x=>!all.has(x));
    sel=null;afterChange();
    const extra=withDeps&&deps.length?` Bağlı ${deps.length} öğe de silindi.`:'';
    toast((dep?`“${f.name}” ve ona bağlı “${dep.name}” silindi.`:f.sketch?`“${f.name}” silindi; “${(byId(f.sketch)||{}).name||'çizim'}” ağaçta kaldı.`:`“${f.name}” silindi.`)+extra,{label:'Geri al',fn:undoStep()});
  };
  if(!deps.length){run(false);return}
  ask('Silmeyi onayla',`<b>${esc(f.name)}</b>${dep?` ve <b>${esc(dep.name)}</b>`:''} silinirse şu öğeler hesaplanamaz:<ul>${deps.slice(0,8).map(g=>`<li>${esc(g.name)}</li>`).join('')}${deps.length>8?`<li>… ve ${deps.length-8} öğe daha</li>`:''}</ul>`,
    [{label:'İptal'},{label:'Yalnızca bunu sil',fn:()=>run(false)},{label:'Bağlı öğelerle birlikte sil',fn:()=>run(true),primary:true}]);
}
$('#tree').addEventListener('dblclick',e=>{
  if(activeTab==='asm'){asmTreeDbl(e);return}
  if(sk||pm)return;const ti=e.target.closest('.ti[data-id]');if(!ti||e.target.closest('[data-a]'))return;const f=byId(ti.dataset.id);if(!f)return;
  if(f.type==='sketch')editSketch(f.id);else openPM(f.type,f);
});
$('#tree').addEventListener('change',e=>{
  if(activeTab==='asm'){asmTreeChange(e);return}
  if(e.target.id==='partSel'){switchPart(e.target.value);return}
  if(e.target.id==='partNameIn'){const v=e.target.value.trim()||'Parça1';if(v!==state.partName)metaChange(()=>state.partName=v);renderTree();if(activeTab==='drawing')renderDrawing()}
  if(e.target.id==='matSel'){metaChange(()=>state.material=e.target.value);updateMass();if(activeTab==='drawing')renderDrawing()}
});

/* ================= KOMUT YÖNETİCİSİ (CommandManager) ================= */
function rb(cmd,icon,label,cls='',title=''){return `<button class="rb ${cls}" data-cmd="${cmd}" title="${esc(title||label)}">${IC[icon]}<span>${label}</span></button>`}
const SKTOOLS=['smartdim','line','centerline','rect','crect','circle','arc','arc3','tarc','slot','polygon','point','sfillet','trim'];
function renderRibbon(){
  $('#cmTabs').classList.toggle('hidden',activeTab==='asm');
  if(activeTab==='asm'){renderAsmRibbon();return}
  $$('#cmTabs button').forEach(b=>b.classList.toggle('on',b.dataset.cm===cmTab));
  let h='';
  if(cmTab==='features'){
    h=rb('sketch',sk?'exitSketch':'sketch',sk?'Çizimden Çık':'Çizim','','Seçili düzlem veya yüzeyde yeni çizim')+'<div class="rsep"></div>'+
      rb('extrude','extrude','Ekstrüzyon Katman/Taban')+rb('revolve','revolve','Döndürme Katman/Taban')+rb('cut','cut','Ekstrüzyon Kesme','cut')+rb('revcut','revcut','Döndürme Kesme','cut')+
      rb('hole','hole','Delik Sihirbazı','cut')+'<div class="rsep"></div>'+rb('fillet','fillet','Radyus')+rb('chamfer','chamfer','Pah')+
      '<div class="rsep"></div>'+rb('lpattern','lpattern','Doğrusal Çoğaltma')+rb('cpattern','cpattern','Dairesel Çoğaltma')+rb('mirror','mirror','Aynala')+
      '<div class="rsep"></div>'+rb('plane','plane','Referans Düzlem');
  }else{
    const t=sk?sk.tool:null;const on=c=>t===c?'on':'';
    h=rb('sketch',sk?'exitSketch':'sketch',sk?'Çizimden Çık':'Çizim')+rb('smartdim','smartdim','Akıllı Ölçülendirme',on('smartdim'))+rb('fulldef','fulldef','Tam Tanımla','','Eksik ölçü ve ilişkileri otomatik ekleyerek çizimi tam tanımla')+'<div class="rsep"></div>'+
      rb('select','select','Seç',sk&&!t?'on':'')+rb('line','line','Çizgi',on('line'))+rb('centerline','centerline','Merkez Çizgisi',on('centerline'))+rb('rect','rect','Köşe Dikdörtgen',on('rect'))+rb('crect','crect','Merkez Dikdörtgen',on('crect'))+
      rb('circle','circle','Daire',on('circle'))+rb('arc','arc','Merkez Nokta Yay',on('arc'))+rb('arc3','arc3','3 Nokta Yay',on('arc3'))+rb('tarc','tarc','Teğet Yay',on('tarc'))+rb('slot','slot','Düz Kanal',on('slot'))+rb('polygon','polygon','Çokgen',on('polygon'))+rb('point','point','Nokta',on('point'))+
      '<div class="rsep"></div>'+rb('sfillet','sfillet','Çizim Radyusu',on('sfillet'))+rb('trim','trim','Budama',on('trim'))+rb('soffset','offset','Varlıkları Ofsetle',sk&&sk.op&&sk.op.t==='offset'?'on':'')+rb('smirror','smirror','Varlıkları Aynala',sk&&sk.op&&sk.op.t==='mirror'?'on':'')+rb('slpat','slpat','Doğrusal Çoğaltma',sk&&sk.op&&sk.op.t==='lpat'?'on':'')+rb('scpat','scpat','Dairesel Çoğaltma',sk&&sk.op&&sk.op.t==='cpat'?'on':'')+
      '<div class="rsep"></div>'+rb('construction','construction','Yapı Geometrisi')+rb('normal','normal','Normal Görünüm');
  }
  $('#ribbon').innerHTML=h;fitRibbon($('#ribbon'));
}
/* şerit taşarsa sıkıştır, yine taşarsa etiketleri gizle (tam ad düğmenin ipucunda kalır) */
function fitRibbon(el,again){if(!el)return;el.classList.remove('compact','tight');if(!again)requestAnimationFrame(()=>fitRibbon(el,true));if(el.scrollWidth<=el.clientWidth+1)return;el.classList.add('compact');if(el.scrollWidth>el.clientWidth+1)el.classList.add('tight')}
{let rw={};const ro=new ResizeObserver(es=>{for(const e of es){const w=Math.round(e.contentRect.width);if(rw[e.target.id]!==w){rw[e.target.id]=w;fitRibbon(e.target)}}});ro.observe($('#ribbon'));ro.observe($('#drawRibbon'))}
$('#cmTabs').addEventListener('click',e=>{const b=e.target.closest('[data-cm]');if(!b)return;cmTab=b.dataset.cm;renderRibbon()});
$('#ribbon').addEventListener('click',e=>{const b=e.target.closest('[data-cmd]');if(!b)return;if(activeTab==='asm')asmCmd(b.dataset.cmd);else cmd(b.dataset.cmd)});
function cmd(c){
  if(activeTab!=='model')return;
  if(state.mesh&&!['normal'].includes(c)){toast('Bu parça STL dosyasından alındı; özellik eklenemez. Yeni bir parça oluşturabilirsin.');return}
  if(c==='sketch'){if(sk)exitSketch(true);else beginSketchCommand(null,null);return}
  if(['extrude','cut','revolve','revcut'].includes(c)){
    const type=(c==='extrude'||c==='cut')?'extrude':'revolve',op=(c==='cut'||c==='revcut')?'cut':'add';
    if(sk){const id=sk.feat.id;if(!exitSketch(true))return;openNewProfile(type,op,id);return}
    if(pm)closePM(true);
    const sid=selectedFreeSketch();if(sid){openNewProfile(type,op,sid);return}
    beginSketchCommand({type,op},null);return;
  }
  if(c==='select'){if(sk)setTool(null);return}
  if(['soffset','smirror','slpat','scpat'].includes(c)){if(!sk){toast('Bu işlem çizim içinde kullanılır. Önce bir çizime gir.');return}setSkOp({soffset:'offset',smirror:'mirror',slpat:'lpat',scpat:'cpat'}[c]);return}
  if(c==='hole'){if(sk&&!exitSketch(true))return;if(pm)closePM(true);openHolePM();return}
  if(SKTOOLS.includes(c)){if(!sk){beginSketchCommand(null,c);return}setTool(sk.tool===c?null:c);return}
  if(c==='fulldef'){if(sk)autoDefineSketch(false);else toast('Tam Tanımla çizim içinde kullanılır. Önce bir çizime gir.');return}
  if(c==='construction'){if(sk)toggleConstruction();else toast('Yapı geometrisi çizim içinde kullanılır.');return}
  if(c==='normal'){if(sk)normalTo(sk.F);else if(sel&&sel.kind==='face')normalTo(faceFrame(sel.n,sel.pt));else if(sel&&sel.kind==='plane')normalTo(STD[sel.key]||model.frames[sel.key]);return}
  if(['fillet','chamfer','lpattern','cpattern','mirror','plane'].includes(c)){if(sk&&!exitSketch(true))return;openNewSimple(c)}
}
function selectedFreeSketch(){if(sel&&sel.kind==='feature'){const f=byId(sel.id);if(f&&f.type==='sketch'&&!consumedMap()[f.id])return f.id}return null}
function beginSketchCommand(pend,tool){
  pending=pend;pendingTool=tool;
  if(pm)closePM(true);
  if(sel&&sel.kind==='plane'){startSketch(planeRef(sel.key));return}
  if(sel&&sel.kind==='face'){if(isPlanarFace(sel)){startSketch(faceRef(sel));return}toast('Seçili yüzey düz değil; düz bir yüzey veya düzlem seç.')}
  pickMode='plane';updatePlaneVis();
  prompt_('Çizim için bir düzlem (Ön, Üst, Sağ) veya modelde düz bir yüzey seç. İptal için Esc.');
  renderTree();
}
let pendingTool=null;
function cancelPick(){pickMode=null;pending=null;pendingTool=null;prompt_(null);updatePlaneVis()}

/* Ekrana sığdır: çizim düzenlenirken çizimi (ve modeli) bakış yönünü değiştirmeden sığdırır */
function fitView(){if(sk&&activeTab==='model')fitSketch(true);else fitCamera(null)}
/* HUD (görünüm araç çubuğu) */
function renderHud(){
  const b=(k,ic,t,on)=>`<button data-hud="${k}" title="${t}" class="${on?'on':''}" aria-label="${t}">${IC[ic]}</button>`;
  $('#hud').innerHTML=b('normal','normal','Normal görünüm (seçili düzleme dik)')+b('front','front','Ön (yeniden tıkla: Arka)')+b('top','top','Üst (yeniden tıkla: Alt)')+b('right','right','Sağ (yeniden tıkla: Sol)')+b('iso','iso','İzometrik (yeniden tıkla: 90° çevir, arkadan da bakılır)')+b('fit','fit','Ekrana sığdır (F)')+b('measure','measure','Ölç')+
    '<span class="hsep"></span>'+`<button data-disp="shadedEdges" title="Gölgeli, kenarlı">${IC.shadedEdges}</button><button data-disp="shaded" title="Gölgeli">${IC.shaded}</button><button data-disp="wire" title="Tel kafes">${IC.wire}</button>`+b('planes','planes','Düzlemleri göster',showPlanes);
}
$('#hud').addEventListener('click',e=>{
  const d=e.target.closest('[data-disp]');if(d){display=d.dataset.disp;applyDisplay();return}
  const b=e.target.closest('[data-hud]');if(!b)return;const k=b.dataset.hud;
  if(k==='measure'){if(meas)closeMeasure();else openMeasure();return}
  if(k==='normal')cmd('normal');else if(k==='fit')fitView();else if(k==='planes'){showPlanes=!showPlanes;updatePlaneVis();applyDisplay();renderTree()}
  // çizim düzenlenirken görünüm 2B kalır: yön düğmeleri çizim düzlemine dik bakar
  else if(sk)normalTo(sk.F);else fitCamera(nextViewDir(k,e.shiftKey));
});
/* aynı yön düğmesine yeniden tıklamak (veya Shift + tıklama) karşı yönden bakar: Arka, Alt, Sol; izometrik her tıklamada
   dikey eksen etrafında 90° döner. Arkadaki yüzeyleri (ör. montajda eşleştirilecek arka yüz) seçmek için */
function nextViewDir(k,shift){
  const d=VIEWDIRS[k];if(!d)return null;const cur=camera.position.clone().sub(controls.target).normalize();
  const same=v=>cur.dot(new T.Vector3(...v).normalize())>0.999;
  if(k==='iso'){const q=[[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1]];const i=q.findIndex(same);return i<0&&!shift?d:q[(Math.max(i,0)+1)%4]}
  return shift||same(d)?d.map(x=>-x):d;
}

/* ================= PROPERTYMANAGER (özellikler) ================= */
function defaultAxis(s){if(!s)return null;const c=s.ents.find(e=>e.t==='line'&&e.cons&&!e.ref);if(c)return c.id;const l=s.ents.find(e=>e.t==='line');return l?l.id:null}
function openNewProfile(type,op,sid){
  const s=byId(sid);
  const d=type==='extrude'?{type,op,sketch:sid,end:op==='cut'?'through':'blind',depth:op==='cut'?10:20,flip:false,dir2:false,end2:'blind',depth2:10,fromOff:0,thin:openOnly(s),thinSide:'a',thick:5}
    :{type,op,sketch:sid,axis:defaultAxis(s),angle:360,mode:'one',flip:false};
  // kesme varsayılan olarak normalin tersine gider (yüzeyden malzemeye doğru). Düzlemdeki çizimde gövde diğer taraftaysa
  // (ör. Ön Düzlem gövdenin arka yüzüyse) kesme hiçbir şey kaldırmazdı: yön gövdeye doğru çevrilir
  if(op==='cut'&&cutAway(sid)){d.flip=true;toast('Gövde çizimin öbür tarafında: kesme yönü gövdeye doğru çevrildi.')}
  d.id=uid();d.name=nextName(d);openPM(type,null,d);previewView(sid);
}
/* çizimin profili varsayılan kesme yönünde (−n) gövdeye hiç değmiyor, ters yönde değiyorsa true */
function cutAway(sid){
  const F=model.frames[sid],s=byId(sid);if(!F||!s||!model.polys.length)return false;
  let shapes;try{shapes=sketchProfiles(s)}catch(e){return false}if(!shapes.length)return false;
  const hits=k=>{const d=vk(F.n,k);for(const sh of shapes){let cx=0,cy=0;for(const q of sh.outer){cx+=q[0];cy+=q[1]}
    for(const q of [...sh.outer,[cx/sh.outer.length,cy/sh.outer.length]])if(rayHit(model.polys,fpt(F,q[0],q[1],0),d)!==null)return true}return false};
  return !hits(-1)&&hits(1);
}
/* çizime dik bakılıyorsa önizlemenin derinliği görünsün diye izometrik görünüşe geçilir (çizimin bulunduğu taraftan) */
function previewView(sid){
  const F=model.frames[sid];if(!F||!pm)return;
  const d=camera.position.clone().sub(controls.target).normalize();if(Math.abs(d.dot(v3(F.n)))<0.97)return;
  let iso=[1,1,1];const k=vd(iso,F.n);if(k<0)iso=va(iso,vk(F.n,-2*k));
  pm.view=iso;
}
/* kapalı bölgesi olmayan (yalnızca açık zincirli) çizim: ekstrüzyon ince özellik olarak açılır */
function openOnly(s){if(!s||!s.ents.some(e=>!e.cons))return false;try{return !sketchProfiles(s).length}catch(e){return true}}
function openNewSimple(type){
  const tg=state.features.filter(x=>x.type==='extrude'||x.type==='revolve'||x.type==='hole');
  const selT=sel&&sel.kind==='feature'&&tg.find(x=>x.id===sel.id)?[sel.id]:[];
  let d;
  if(type==='fillet'||type==='chamfer'){
    if(!model.polys.length){toast('Önce bir gövde oluştur.');return}
    d={type,edges:sel&&sel.kind==='edge'?[{a:sel.e.a.slice(),b:sel.e.b.slice()}]:[]};if(type==='fillet')d.r=5;else d.d=2;
  }
  else if(type==='lpattern'){if(!tg.length){toast('Önce çoğaltılacak bir ekstrüzyon veya döndürme özelliği oluştur.');return}d={type,targets:selT,dir1:'x',sp1:25,n1:3,dir2:'none',sp2:25,n2:2}}
  else if(type==='cpattern'){if(!tg.length){toast('Önce çoğaltılacak bir ekstrüzyon veya döndürme özelliği oluştur.');return}d={type,targets:selT,axis:'y',n:6,angle:360}}
  else if(type==='mirror'){if(!tg.length){toast('Önce aynalanacak bir ekstrüzyon veya döndürme özelliği oluştur.');return}d={type,targets:selT,plane:sel&&sel.kind==='plane'?sel.key:sel&&sel.kind==='face'&&isPlanarFace(sel)?faceRef(sel):'right'}}
  else if(type==='plane'){d={type,base:sel&&sel.kind==='plane'?sel.key:'top',offset:20,flip:false}}
  d.id=uid();d.name=nextName(d);openPM(type,null,d);
}
function openPM(type,feat,draft){
  if(sk)return;
  if(pm)closePM(true);cancelPick();
  if(feat){
    const idx=state.features.indexOf(feat);const r=rebuildModel(state.features,idx);
    pm={type,draft:clone(feat),isNew:false,base:r};showSolid(r.polys);
    if(pm.draft.edges===undefined&&(type==='fillet'||type==='chamfer'))pm.draft.edges=[];
    if(type==='extrude')pm.draft=Object.assign({fromOff:0,thin:false,thinSide:'a',thick:5},pm.draft);
  }else pm={type,draft,isNew:true,base:{polys:model.polys,frames:model.frames,tools:model.tools,caps:model.caps}};
  sel=null;renderPM();renderTree();updateSelVisual();schedulePreview(0);
}
function closePM(silent){
  if(!pm)return;if(pm.type==='hole')prompt_(null);const roll=!pm.isNew;pm=null;clearPreview();if(roll)showSolid(model.polys);
  renderPM();updateSelVisual();if(!silent)renderTree();
}
function commitPM(){
  if(!pm)return;const f=pm.draft;
  if((f.type==='extrude'||f.type==='revolve')&&!byId(f.sketch)){toast('Bir çizim seç.');return}
  if(['lpattern','cpattern','mirror'].includes(f.type)&&!(f.targets&&f.targets.length)){toast('Ağaçtan en az bir özellik seç.');return}
  if((f.type==='fillet'||f.type==='chamfer')&&!f.edges.length){toast('Modelde en az bir kenar seç.');return}
  if(f.type==='hole'&&(!f.on||!f.pts.length)){toast('Yüzeye tıklayarak en az bir delik konumu ekle.');return}
  if(f.type==='hole')prompt_(null);
  pushHist();
  if(pm.isNew)state.features.push(f);else{const i=state.features.findIndex(x=>x.id===f.id);if(i>=0)state.features[i]=f}
  const id=f.id,wasNew=pm.isNew;pm=null;clearPreview();afterChange();if(wasNew&&(f.type==='extrude'||f.type==='revolve'))fitCamera(VIEWDIRS.iso);else keepInView();sel=f.type==='plane'?{kind:'plane',key:id}:{kind:'feature',id};updateSelVisual();renderTree();
  if(model.errors[id])toast('Özellik eklendi ancak hata içeriyor: '+model.errors[id]);
}
/* model görünür alanın dışına taştıysa (ör. çoğaltma, aynalama sonrası) bakış yönü korunarak sığdırılır */
function keepInView(){
  const b=curBox();if(!b)return;camera.updateMatrixWorld();
  for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){
    const p=new T.Vector3(x,y,z).project(camera);if(Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1){fitCamera(null);return}}
}
function afterChange(){
  rebuild();renderTree();renderPM();renderRibbon();updUndo();saveState();
  if(activeTab==='drawing')renderDrawing();
}
const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setPath=(o,p,v)=>{const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++)a=a[ks[i]];a[ks[ks.length-1]]=v};
/* panel açıklamaları kısa tutulur; ayrıntı, alan başlığının üzerine gelince ipucu kutusunda görünür (data-tip) */
const tipA=t=>t?` data-tip="${esc(t)}"`:'';
function fNum(label,path,unit='mm',obj,tip){const v=getPath(obj||pm.draft,path);return `<label class="fld"><span${tipA(tip)}>${label}</span><div class="inp"><input inputmode="decimal" autocomplete="off" data-k="${path}" data-num="1" value="${esc(v==null?'':String(v).replace('.',','))}"><em>${unit}</em></div></label>`}
function fSel(label,path,opts,obj,tip){const v=getPath(obj||pm.draft,path);return `<label class="fld"><span${tipA(tip)}>${label}</span><select data-k="${path}" data-rr="1">${opts.map(([k,t])=>`<option value="${esc(k)}" ${String(k)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`}
function fSeg(path,opts){const v=getPath(pm.draft,path);return `<div class="seg">${opts.map(([k,t])=>`<button type="button" data-seg="${path}" data-v="${k}" class="${String(k)===String(v)?'on':''}">${esc(t)}</button>`).join('')}</div>`}
function fChk(label,path,tip){return `<label class="chk"${tipA(tip)}><input type="checkbox" data-chk="${path}" ${getPath(pm.draft,path)?'checked':''}> ${label}</label>`}
const grp=(t,b,tip)=>`<div class="grp">${t?`<div class="grp-t"${tipA(tip)}>${t}</div>`:''}${b}</div>`;
/* ipucu kutusu: [data-tip] öğesinin üzerine gelince kısa bir gecikmeyle altında (yer yoksa üstünde) açılır */
const tipBox=document.createElement('div');tipBox.className='tip-box';tipBox.setAttribute('role','tooltip');document.body.appendChild(tipBox);
let tipEl=null,tipTimer=0;
function hideTip(){clearTimeout(tipTimer);tipEl=null;tipBox.classList.remove('on')}
function showTip(t){
  if(!t.isConnected){hideTip();return}
  tipBox.textContent=t.dataset.tip;tipBox.classList.add('on');
  const r=t.getBoundingClientRect(),w=tipBox.offsetWidth,h=tipBox.offsetHeight,W=innerWidth,H=innerHeight;
  const x=Math.max(6,Math.min(r.left,W-w-6)),y=r.bottom+6+h<=H-6?r.bottom+6:Math.max(6,r.top-6-h);
  tipBox.style.left=x+'px';tipBox.style.top=y+'px';
}
document.addEventListener('mouseover',e=>{
  const t=e.target.closest&&e.target.closest('[data-tip]');
  if(t===tipEl)return;hideTip();if(!t||!t.dataset.tip)return;
  tipEl=t;tipTimer=setTimeout(()=>showTip(t),250);
});
document.addEventListener('mouseout',e=>{if(tipEl&&!(e.relatedTarget&&tipEl.contains(e.relatedTarget)))hideTip()});
for(const ev of ['pointerdown','keydown','wheel'])document.addEventListener(ev,hideTip,true);
document.addEventListener('scroll',hideTip,true);
const DIR_OPTS=[['x','+X'],['-x','−X'],['y','+Y'],['-y','−Y'],['z','+Z'],['-z','−Z']];
function eligible(f){const i=state.features.findIndex(x=>x.id===f.id);const lim=i<0?state.features.length:i;return state.features.slice(0,lim).filter(x=>(x.type==='extrude'||x.type==='revolve'||x.type==='hole')&&!x.suppressed)}
function planeOpts(f){const i=state.features.findIndex(x=>x.id===f.id);const lim=i<0?state.features.length:i;return [['front','Ön Düzlem'],['top','Üst Düzlem'],['right','Sağ Düzlem'],...state.features.slice(0,lim).filter(x=>x.type==='plane').map(x=>[x.id,x.name])]}
/* radyus/pah kenarı: dairesel kenar tek bir üçgen kenarıyla saklanır, uzunluğu yerine çapı gösterilir */
function edgeLabel(e){let m=null;try{m=findCircleAnn((model&&model.ann)||[],e)}catch(err){}return m?'dairesel Ø'+fmt(m.an.r*2,1):fmt(vl(vs(e.b,e.a)),1)+' mm'}
function renderPM(){
  const ws=$('#ws'),el=$('#pm');
  if(meas){renderMeasurePM();return}
  if(activeTab==='asm'){renderAsmPM();return}
  if(sk){ws.classList.add('pmon');renderSketchPM();requestAnimationFrame(resize);return}
  if(!pm){ws.classList.remove('pmon');el.innerHTML='';requestAnimationFrame(resize);return}
  ws.classList.add('pmon');requestAnimationFrame(resize);
  const f=pm.draft;let b=`<label class="fld"><span>Özellik adı</span><input data-k="name" value="${esc(f.name)}"></label>`;
  if(f.type==='hole'){b=holePMBody(f)}
  else if(f.type==='extrude'||f.type==='revolve'){
    const cons=consumedMap();const sks=state.features.filter(x=>x.type==='sketch'&&(!cons[x.id]||cons[x.id]===f.id));
    b+=fSel('Çizim (profil)','sketch',sks.map(x=>[x.id,x.name+(model.dof[x.id]>0?' (tam tanımlı değil)':'')]));
    b=grp('',b);
    if(f.type==='extrude'){
      let d=fSel('Bitiş koşulu','end',[['blind','Kör'],['through','Tümünden geç'],['mid','Orta düzlem']].concat(f.op==='add'?[['body','Gövdeye kadar']]:[]),null,'Kör: girilen derinlik kadar. Tümünden geç: bütün gövde boyunca. Orta düzlem: derinlik çizim düzleminin iki yanına eşit bölünür.'+(f.op==='add'?'\nGövdeye kadar: profil, önündeki gövdeye tamamen değene kadar uzatılır; gövde değişince uzunluk da güncellenir. Ör. referans düzlemden aşağı inen çıkıntı.':''));
      if(f.end!=='mid')d+=`<button type="button" class="sbtn" data-flip="1" style="margin-bottom:8px">⇅ Ters yön${f.flip?' (açık)':''}</button>`;
      if(f.end==='body')d+=`<p class="note">Gövdeye değene kadar uzatılır.</p>`;
      else if(f.end!=='through')d+=fNum('Derinlik','depth');
      b+=grp('Yön 1',d);
      if(f.end!=='mid'){
        let d2=fChk('Yön 2 kullan','dir2');
        if(f.dir2){d2+=fSel('Bitiş koşulu','end2',[['blind','Kör'],['through','Tümünden geç']]);if(f.end2!=='through')d2+=fNum('Derinlik','depth2')}
        b+=grp('Yön 2',d2);
      }
      b+=grp('Başlangıç',fNum('Çizim düzleminden ofset','fromOff','mm',null,'0: özellik çizim düzleminden başlar. Ör. 34 yazarsan normal yönünde 34 mm ötedeki paralel düzlemden başlar (negatif değer ters taraf); ayrı referans düzlem gerekmez.'));
      let t=fChk('İnce özellik (kalınlık ver)','thin');
      if(f.thin)t+=`<div class="row2">${fSel('Yön','thinSide',[['a','Tek yön'],['b','Ters yön'],['mid','Orta düzlem']])}${fNum('Kalınlık','thick')}</div>`;
      b+=grp('İnce özellik',t,'Açık bir çizgi/yay zinciri (ör. bükülmüş sac, U profil) seçilen kalınlıkta şerit olarak ekstrüde edilir; kapalı kontur halkaya dönüşür.');
    }else{
      const s=byId(f.sketch);const lines=s?s.ents.filter(e=>e.t==='line'):[];
      b+=grp('Döndürme ekseni',fSel('Eksen (çizimdeki çizgi)','axis',lines.length?lines.map((e,i)=>[e.id,(e.cons?'Merkez çizgisi ':'Çizgi ')+(i+1)]):[['','(çizimde çizgi yok)']],null,'Çizime bir merkez çizgisi ekleyip ekseni burada seç.'));
      let d=fSel('Tür','mode',[['one','Tek yön'],['mid','Orta düzlem']])+fNum('Açı','angle','°');
      if(f.mode!=='mid')d+=`<button type="button" class="sbtn" data-flip="1">⇅ Ters yön${f.flip?' (açık)':''}</button>`;
      b+=grp('Yön 1',d);
    }
    if(!f.thin)b+=grp('Profil bölgeleri',(f.regions&&f.regions.length?`<p class="note" style="color:var(--ink)">${f.regions.length} bölge seçili; yalnızca bunlar kullanılıyor.</p><button type="button" class="sbtn" data-regclr="1">Tüm bölgeleri kullan</button>`:`<p class="note" style="color:var(--ink)">Tüm kapalı bölgeler kullanılıyor.</p>`),'Birbirini kesen şekiller otomatik birleşir. Yalnızca bazı bölgeleri kullanmak için ekranda çizimin içindeki bölgelere tıkla; tekrar tıklamak seçimi kaldırır.');
  }else if(f.type==='fillet'||f.type==='chamfer'){
    b=grp('',b)+grp(f.type==='fillet'?'Radyus parametreleri':'Pah parametreleri',f.type==='fillet'?fNum('Yarıçap','r'):fNum('Mesafe (eşit)','d'));
    b+=grp(`Kenarlar (${f.edges.length})`,(f.edges.length?`<div class="lst">${f.edges.map((e,i)=>`<div><span>Kenar ${i+1}: ${edgeLabel(e)}</span><button data-rmedge="${i}" aria-label="Kaldır">✕</button></div>`).join('')}</div>`:'')+`<p class="note">Modelde kenarlara tıkla.</p>`,'Modelde düz veya dairesel kenarlara tıkla. Tekrar tıklarsan seçim kalkar.');
  }else if(['lpattern','cpattern','mirror'].includes(f.type)){
    const tg=eligible(f);
    b=grp('',b)+grp('Çoğaltılacak özellikler',tg.length?`<div class="lst">${tg.map(x=>`<label class="chk" style="margin:0"><input type="checkbox" data-tg="${x.id}" ${f.targets.includes(x.id)?'checked':''}> ${esc(x.name)}</label>`).join('')}</div>`:'<p class="note">Uygun özellik yok.</p>','Ağaçtaki özelliklere tıklayarak da seçebilirsin.');
    if(f.type==='lpattern'){
      // yön: dünya ekseni veya modelde seçilen düz kenar (SolidWorks gibi); kenar yönü “Ters” ile çevrilir
      const dirSel=(k,extra)=>{const o=typeof f[k]==='object';return fSel('Yön',k,[...extra,...(o?[['__edge','Seçilen kenar']]:[]),...DIR_OPTS],{[k]:o?'__edge':f[k]},'Yönü modelden almak için “Kenar seç”e basıp ekranda düz bir kenara tıkla.')+
        `<div class="row2"><button type="button" class="sbtn${(pm.dirSlot||1)===(k==='dir1'?1:2)?' on':''}" data-dslot="${k==='dir1'?1:2}">Kenar seç</button>${o?`<button type="button" class="sbtn" data-drev="${k}">⇄ Ters</button>`:''}</div>`};
      b+=grp('Yön 1',dirSel('dir1',[])+`<div class="row2">${fNum('Aralık','sp1')}${fNum('Adet','n1','adet')}</div>`);
      let s2=dirSel('dir2',[['none','Kullanma']]);if(f.dir2!=='none')s2+=`<div class="row2">${fNum('Aralık','sp2')}${fNum('Adet','n2','adet')}</div>`;
      b+=grp('Yön 2',s2);
    }else if(f.type==='cpattern'){
      const o=typeof f.axis==='object';
      b+=grp('Parametreler',fSel('Eksen','axis',[...(o?[['__sel',f.axis.r?`Seçilen silindir (Ø${fmt(f.axis.r*2)})`:'Seçilen kenar']]:[]),['x','X ekseni (orijin)'],['y','Y ekseni (orijin)'],['z','Z ekseni (orijin)']],{axis:o?'__sel':f.axis},'Ekranda bir silindirik yüze (delik, göbek), dairesel kenara veya düz bir kenara tıklayarak ekseni seçebilirsin.')+`<p class="note">Ekseni modelde seçebilirsin.</p><div class="row2">${fNum('Adet','n','adet')}${fNum('Toplam açı','angle','°',null,'360° girersen kopyalar eşit dağıtılır.')}</div>`);
    }else{const face=typeof f.plane==='object';if(face)pm.mirFace=f.plane;
      b+=grp('Ayna düzlemi',fSel('Düzlem','plane',(pm.mirFace?[['__face','Seçilen model yüzeyi']]:[]).concat(planeOpts(f)),{plane:face?'__face':f.plane},'Ekranda bir düzleme, ağaçta bir düzleme veya modelin düz bir yüzeyine tıklayabilirsin.')+`<p class="note">Ekranda düzleme veya yüze tıkla.</p>`)}
  }else if(f.type==='plane'){
    const face=typeof f.base==='object';if(face)pm.baseFace=f.base;
    b=grp('',b)+grp('İlk referans',fSel('Paralel düzlem','base',(pm.baseFace?[['__face','Seçilen model yüzeyi']]:[]).concat(planeOpts(f)),{base:face?'__face':f.base},'Ekranda bir düzleme, ağaçta bir düzleme veya modelin düz bir yüzeyine tıklayabilirsin.')+fNum('Ofset mesafesi','offset','mm',null,'Yüzeyden ofsette pozitif değer yüzeyin dışına doğrudur.')+fChk('Ters taraf','flip')+`<p class="note">Ekranda düzleme veya yüze tıkla.</p>`);
  }
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">${esc(typeLabel(f))}</div><div class="pm-sub">${pm.isNew?'Yeni özellik':'Özellik düzenleniyor (geri sarıldı)'}</div></div><div class="pm-actions"><button class="ok" data-pm="ok" title="Tamam (Enter)" aria-label="Tamam">${IC.ok}</button><button data-pm="cancel" title="İptal (Esc)" aria-label="İptal">${IC.x}</button></div></div><div class="pm-body">${b}<div class="pm-err" id="pmErr"></div></div>`;
}
const pmEl=$('#pm');
pmEl.addEventListener('click',e=>{
  if(meas&&measurePmClick(e))return;
  if(activeTab==='asm'){asmPmClick(e);return}
  if(sk){skPmClick(e);return}
  if(!pm)return;
  const a=e.target.closest('[data-pm]');if(a){a.dataset.pm==='ok'?commitPM():closePM();return}
  if(pm.type==='hole'&&holePmClick(e))return;
  const sg=e.target.closest('[data-seg]');if(sg){setPath(pm.draft,sg.dataset.seg,sg.dataset.v);renderPM();schedulePreview();return}
  if(e.target.closest('[data-flip]')){pm.draft.flip=!pm.draft.flip;renderPM();schedulePreview();return}
  if(e.target.closest('[data-regclr]')){delete pm.draft.regions;renderPM();schedulePreview();return}
  const rm=e.target.closest('[data-rmedge]');if(rm){pm.draft.edges.splice(+rm.dataset.rmedge,1);renderPM();updateSelVisual();schedulePreview();return}
  const ds=e.target.closest('[data-dslot]');if(ds){pm.dirSlot=+ds.dataset.dslot;renderPM();return}
  const dr=e.target.closest('[data-drev]');if(dr){const o=pm.draft[dr.dataset.drev];if(o&&o.d){o.d=o.d.map(v=>-v);renderPM();schedulePreview()}return}
});
pmEl.addEventListener('input',e=>{
  if(activeTab==='asm'){asmPmInput(e);return}
  if(sk){skPmInput(e);return}
  const t=e.target;if(!pm)return;if(pm.type==='hole'&&holePmInput(e))return;const k=t.dataset.k;if(!k||t.dataset.rr)return;
  if(t.dataset.num){const v=num(t.value);if(t.value.trim()===''||!isFinite(v)){t.classList.add('bad');return}t.classList.remove('bad');setPath(pm.draft,k,v)}
  else setPath(pm.draft,k,t.value);
  schedulePreview();
});
pmEl.addEventListener('change',e=>{
  if(activeTab==='asm'){asmPmChange(e);return}
  if(sk){skPmChange(e);return}
  const t=e.target;if(!pm)return;
  if(t.dataset.chk){setPath(pm.draft,t.dataset.chk,t.checked);renderPM();schedulePreview();return}
  if(t.dataset.tg){const ar=pm.draft.targets;const i=ar.indexOf(t.dataset.tg);if(t.checked&&i<0)ar.push(t.dataset.tg);if(!t.checked&&i>=0)ar.splice(i,1);renderTree();schedulePreview();return}
  if(!t.dataset.rr)return;
  // seçilen yüzey/kenar/eksen seçeneği listede kalır; o seçilirse saklanan model referansı geri gelir
  if(['__edge','__sel'].includes(t.value)){renderPM();return}
  setPath(pm.draft,t.dataset.k,t.dataset.k==='plane'&&t.value==='__face'?pm.mirFace:t.dataset.k==='base'&&t.value==='__face'?pm.baseFace:t.value);
  if(t.dataset.k==='sketch'&&pm.type==='revolve')pm.draft.axis=defaultAxis(byId(t.value));
  renderPM();renderTree();updatePlaneVis();schedulePreview();
});

/* önizleme */
let prevT=0;
function schedulePreview(ms=SETTINGS.previewDelay){clearTimeout(prevT);prevT=setTimeout(updatePreview,ms)}
function clearPreview(){requestRender();for(const c of [...previewGroup.children]){previewGroup.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}}
function addPreview(polys,cut){if(!polys.length)return;requestRender();const {g}=polysToBuffers(polys);previewGroup.add(new T.Mesh(g,cut?matPrevCut:matPrevAdd));previewGroup.add(new T.LineSegments(segGeom(computeEdges(polys,null).filter(e=>e.k===1)),cut?matPrevEdgeC:matPrevEdgeA))}
/* tümünden geçen kesme araçları gövdenin çok ötesine uzanır: önizlemede gövde kutusuna (biraz payla) kırpılır */
function clipToBody(ps,solid){
  if(!ps.length||!solid||!solid.length)return ps;const b=bboxPolys(solid);const sz=[0,1,2].map(k=>b.max[k]-b.min[k]),pad=Math.max(0.5,Math.max(...sz)*0.02);
  const g=new T.BoxGeometry(sz[0]+2*pad,sz[1]+2*pad,sz[2]+2*pad);g.translate((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);
  try{return csgIntersect(ps,geomToPolys(g,'box'))}catch(e){return ps}
}
/* seçilen çoğaltma ekseni önizlemede çizgiyle gösterilir */
function axisPreview(p,d){const L=Math.max(40,modelExtent()*0.8),P=v3(p),D=v3(d).normalize();
  const g=new T.BufferGeometry().setFromPoints([P.clone().addScaledVector(D,-L),P.clone().addScaledVector(D,L)]);const l=new T.Line(g,matPrevEdgeA);l.renderOrder=6;previewGroup.add(l)}
/* yüzeye göre aynalamada ayna düzlemi önizlemede gösterilir */
function mirrorFacePreview(f,B){
  const F=sketchFrame({on:f.plane},{frames:B.frames||model.frames,caps:B.caps||model.caps});
  const o=makePlaneObj(F,'prev',Math.max(80,modelExtent()));o.children[0].material.opacity=.2;o.children[0].material.color.setHex(0xE2A83A);o.children[1].material.color.setHex(0xB0760E);previewGroup.add(o);
}
function updatePreview(){
  clearPreview();if(!pm)return;const f=pm.draft,B=pm.base;const err=$('#pmErr');
  try{
    if(f.type==='extrude'||f.type==='revolve'){
      const s=byId(f.sketch);if(!s)throw new Error('Bir çizim seç.');const F=B.frames[s.id]||model.frames[s.id];if(!F)throw new Error('Çizim düzlemi çözülemedi.');
      if(!f.thin)regionOverlay(s,F,f.regions);
      const r=f.type==='extrude'?extrudeTool(f,s,F,reachAlong(B.polys,F,f.dir2&&f.end2==='through'?0:(f.op==='cut'?-1:1)*(f.flip?-1:1))+Math.abs(num(f.fromOff)||0),B.polys):revolveTool(f,s,F);addPreview(r.polys,f.op==='cut');
    }else if(['lpattern','cpattern','mirror'].includes(f.type)){
      if(!f.targets.length)throw new Error('Ağaçtan çoğaltılacak özelliği seç.');
      const Ms=patternMatrices(f,B.frames,B.caps||model.caps);if(f.type==='mirror'&&typeof f.plane==='object')mirrorFacePreview(f,B);
      if(f.type==='cpattern'&&typeof f.axis==='object')axisPreview(f.axis.p,f.axis.d);
      for(const tid of f.targets){const t=B.tools[tid]||model.tools[tid];if(!t)continue;let ps=[];for(const M of Ms)ps=ps.concat(transformPolys(t.polys,M,'p'));addPreview(t.op==='cut'?clipToBody(ps,B.polys):ps,t.op==='cut')}
    }else if(f.type==='hole'){holePreview(f,B)
    }else if(f.type==='fillet'||f.type==='chamfer'){
      if(f.edges.length){const r=edgeOpBodies(B.polys,f,B.ann||model.ann);addPreview([].concat(...r.sub),true);addPreview([].concat(...r.add),false)}
    }else if(f.type==='plane'){
      const Bf=typeof f.base==='object'?sketchFrame({on:f.base},{frames:B.frames||model.frames,caps:B.caps||model.caps}):STD[f.base]||B.frames[f.base];if(!Bf)throw new Error('Referans düzlem bulunamadı.');const off=num(f.offset)*(f.flip?-1:1);
      const F={o:va(Bf.o,vk(Bf.n,off)),u:Bf.u,v:Bf.v,n:Bf.n};const o=makePlaneObj(F,'prev',Math.max(80,modelExtent()));o.children[0].material.opacity=.2;o.children[0].material.color.setHex(0xE2A83A);o.children[1].material.color.setHex(0xB0760E);previewGroup.add(o);
    }
    if(err){err.classList.remove('on');err.textContent=''}
    // ilk önizlemeden sonra görünüm önizlemeye ve modele sığdırılır
    if(pm.view){const dir=pm.view;pm.view=null;const b=new T.Box3().setFromObject(previewGroup);if(model.box){b.expandByPoint(v3(model.box.min));b.expandByPoint(v3(model.box.max))}
      if(!b.isEmpty())fitCamera(dir,true,null,{min:b.min.toArray(),max:b.max.toArray()})}
  }catch(e){if(err){err.textContent=e.message||String(e);err.classList.add('on')}}
}
