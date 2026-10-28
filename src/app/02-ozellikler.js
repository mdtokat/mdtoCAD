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
    const err=model.errors[f.id];const isSel=(sel&&sel.kind==='feature'&&sel.id===f.id)||(pm&&pm.draft&&((pm.draft.targets||[]).includes(f.id)||pm.draft.sketch===f.id||(pm.type==='mirror'&&pm.draft.plane===f.id)||(pm.type==='plane'&&pm.draft.base===f.id)));
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
    setSel(sel&&sel.kind==='feature'&&sel.id===id?null:(f.type==='plane'?{kind:'plane',key:id}:{kind:'feature',id}));return;
  }
  if(act==='edit'){openPM(f.type,f);return}
  if(act==='editsk'){editSketch(f.type==='sketch'?id:f.sketch);return}
  if(act==='sketchon'){startSketch({kind:'plane',id});return}
  if(sk||pm)return;
  if(act==='sup'){pushHist();f.suppressed=!f.suppressed;if(f.sketch){const s=byId(f.sketch);if(s)s.suppressed=f.suppressed}afterChange()}
  else if(act==='del'){
    pushHist();const ids=new Set([id]);if(f.sketch&&consumedMap()[f.sketch]===id)ids.add(f.sketch);
    if(f.type==='sketch'){const c=consumedMap()[id];if(c)ids.add(c)}
    state.features=state.features.filter(x=>!ids.has(x.id));sel=null;afterChange();
    toast(`“${f.name}” silindi.`,{label:'Geri al',fn:undo});
  }
});
$('#tree').addEventListener('dblclick',e=>{
  if(activeTab==='asm'){asmTreeDbl(e);return}
  if(sk||pm)return;const ti=e.target.closest('.ti[data-id]');if(!ti||e.target.closest('[data-a]'))return;const f=byId(ti.dataset.id);if(!f)return;
  if(f.type==='sketch')editSketch(f.id);else openPM(f.type,f);
});
$('#tree').addEventListener('change',e=>{
  if(activeTab==='asm'){asmTreeChange(e);return}
  if(e.target.id==='partSel'){switchPart(e.target.value);return}
  if(e.target.id==='partNameIn'){state.partName=e.target.value.trim()||'Parça1';saveState();renderTree();if(activeTab==='drawing')renderDrawing()}
  if(e.target.id==='matSel'){state.material=e.target.value;updateMass();saveState()}
});

/* ================= KOMUT YÖNETİCİSİ (CommandManager) ================= */
function rb(cmd,icon,label,cls='',title=''){return `<button class="rb ${cls}" data-cmd="${cmd}" title="${esc(title||label)}">${IC[icon]}<span>${label}</span></button>`}
const SKTOOLS=['smartdim','line','centerline','rect','crect','circle','arc','arc3','tarc','slot','polygon','sfillet','trim'];
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
      rb('circle','circle','Daire',on('circle'))+rb('arc','arc','Merkez Nokta Yay',on('arc'))+rb('arc3','arc3','3 Nokta Yay',on('arc3'))+rb('tarc','tarc','Teğet Yay',on('tarc'))+rb('slot','slot','Düz Kanal',on('slot'))+rb('polygon','polygon','Çokgen',on('polygon'))+
      '<div class="rsep"></div>'+rb('sfillet','sfillet','Çizim Radyusu',on('sfillet'))+rb('trim','trim','Budama',on('trim'))+rb('soffset','offset','Varlıkları Ofsetle',sk&&sk.op&&sk.op.t==='offset'?'on':'')+rb('smirror','smirror','Varlıkları Aynala',sk&&sk.op&&sk.op.t==='mirror'?'on':'')+rb('slpat','slpat','Doğrusal Çoğaltma',sk&&sk.op&&sk.op.t==='lpat'?'on':'')+rb('scpat','scpat','Dairesel Çoğaltma',sk&&sk.op&&sk.op.t==='cpat'?'on':'')+
      '<div class="rsep"></div>'+rb('construction','construction','Yapı Geometrisi')+rb('normal','normal','Normal Görünüm');
  }
  $('#ribbon').innerHTML=h;
}
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
  if(sel&&sel.kind==='face'){if(isPlanarFace(sel)){startSketch(faceRef(sel));return}}
  pickMode='plane';updatePlaneVis();
  prompt_('Çizim için bir düzlem (Ön, Üst, Sağ) veya modelde düz bir yüzey seç. İptal için Esc.');
  renderTree();
}
let pendingTool=null;
function cancelPick(){pickMode=null;pending=null;pendingTool=null;prompt_(null);updatePlaneVis()}

/* HUD (görünüm araç çubuğu) */
function renderHud(){
  const b=(k,ic,t,on)=>`<button data-hud="${k}" title="${t}" class="${on?'on':''}" aria-label="${t}">${IC[ic]}</button>`;
  $('#hud').innerHTML=b('normal','normal','Normal görünüm (seçili düzleme dik)')+b('front','front','Ön')+b('top','top','Üst')+b('right','right','Sağ')+b('iso','iso','İzometrik')+b('fit','fit','Ekrana sığdır')+b('measure','measure','Ölç')+
    '<span class="hsep"></span>'+`<button data-disp="shadedEdges" title="Gölgeli, kenarlı">${IC.shadedEdges}</button><button data-disp="shaded" title="Gölgeli">${IC.shaded}</button><button data-disp="wire" title="Tel kafes">${IC.wire}</button>`+b('planes','planes','Düzlemleri göster',showPlanes);
}
$('#hud').addEventListener('click',e=>{
  const d=e.target.closest('[data-disp]');if(d){display=d.dataset.disp;applyDisplay();return}
  const b=e.target.closest('[data-hud]');if(!b)return;const k=b.dataset.hud;
  if(k==='measure'){if(meas)closeMeasure();else openMeasure();return}
  if(k==='normal')cmd('normal');else if(k==='fit')fitCamera(null);else if(k==='planes'){showPlanes=!showPlanes;updatePlaneVis();applyDisplay();renderTree()}
  else fitCamera(VIEWDIRS[k]);
});

/* ================= PROPERTYMANAGER (özellikler) ================= */
function defaultAxis(s){if(!s)return null;const c=s.ents.find(e=>e.t==='line'&&e.cons);if(c)return c.id;const l=s.ents.find(e=>e.t==='line');return l?l.id:null}
function openNewProfile(type,op,sid){
  const s=byId(sid);
  const d=type==='extrude'?{type,op,sketch:sid,end:op==='cut'?'through':'blind',depth:op==='cut'?10:20,flip:false,dir2:false,end2:'blind',depth2:10}
    :{type,op,sketch:sid,axis:defaultAxis(s),angle:360,mode:'one',flip:false};
  d.id=uid();d.name=nextName(d);openPM(type,null,d);
}
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
  else if(type==='mirror'){if(!tg.length){toast('Önce aynalanacak bir ekstrüzyon veya döndürme özelliği oluştur.');return}d={type,targets:selT,plane:sel&&sel.kind==='plane'?sel.key:'right'}}
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
  const id=f.id,wasNew=pm.isNew;pm=null;clearPreview();afterChange();if(wasNew&&(f.type==='extrude'||f.type==='revolve'))fitCamera(VIEWDIRS.iso);sel={kind:'feature',id};updateSelVisual();renderTree();
  if(model.errors[id])toast('Özellik eklendi ancak hata içeriyor: '+model.errors[id]);
}
function afterChange(){
  rebuild();renderTree();renderPM();renderRibbon();updUndo();saveState();
  if(activeTab==='drawing')renderDrawing();
}
const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setPath=(o,p,v)=>{const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++)a=a[ks[i]];a[ks[ks.length-1]]=v};
function fNum(label,path,unit='mm',obj){const v=getPath(obj||pm.draft,path);return `<label class="fld"><span>${label}</span><div class="inp"><input inputmode="decimal" autocomplete="off" data-k="${path}" data-num="1" value="${esc(v==null?'':String(v).replace('.',','))}"><em>${unit}</em></div></label>`}
function fSel(label,path,opts,obj){const v=getPath(obj||pm.draft,path);return `<label class="fld"><span>${label}</span><select data-k="${path}" data-rr="1">${opts.map(([k,t])=>`<option value="${esc(k)}" ${String(k)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`}
function fSeg(path,opts){const v=getPath(pm.draft,path);return `<div class="seg">${opts.map(([k,t])=>`<button type="button" data-seg="${path}" data-v="${k}" class="${String(k)===String(v)?'on':''}">${esc(t)}</button>`).join('')}</div>`}
function fChk(label,path){return `<label class="chk"><input type="checkbox" data-chk="${path}" ${getPath(pm.draft,path)?'checked':''}> ${label}</label>`}
const grp=(t,b)=>`<div class="grp">${t?`<div class="grp-t">${t}</div>`:''}${b}</div>`;
const DIR_OPTS=[['x','+X'],['-x','−X'],['y','+Y'],['-y','−Y'],['z','+Z'],['-z','−Z']];
function eligible(f){const i=state.features.findIndex(x=>x.id===f.id);const lim=i<0?state.features.length:i;return state.features.slice(0,lim).filter(x=>(x.type==='extrude'||x.type==='revolve'||x.type==='hole')&&!x.suppressed)}
function planeOpts(f){const i=state.features.findIndex(x=>x.id===f.id);const lim=i<0?state.features.length:i;return [['front','Ön Düzlem'],['top','Üst Düzlem'],['right','Sağ Düzlem'],...state.features.slice(0,lim).filter(x=>x.type==='plane').map(x=>[x.id,x.name])]}
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
      let d=fSel('Bitiş koşulu','end',[['blind','Kör'],['through','Tümünden geç'],['mid','Orta düzlem']]);
      if(f.end!=='mid')d+=`<button type="button" class="sbtn" data-flip="1" style="margin-bottom:8px">⇅ Ters yön${f.flip?' (açık)':''}</button>`;
      if(f.end!=='through')d+=fNum('Derinlik','depth');
      b+=grp('Yön 1',d);
      if(f.end!=='mid'){
        let d2=fChk('Yön 2 kullan','dir2');
        if(f.dir2){d2+=fSel('Bitiş koşulu','end2',[['blind','Kör'],['through','Tümünden geç']]);if(f.end2!=='through')d2+=fNum('Derinlik','depth2')}
        b+=grp('Yön 2',d2);
      }
    }else{
      const s=byId(f.sketch);const lines=s?s.ents.filter(e=>e.t==='line'):[];
      b+=grp('Döndürme ekseni',fSel('Eksen (çizimdeki çizgi)','axis',lines.length?lines.map((e,i)=>[e.id,(e.cons?'Merkez çizgisi ':'Çizgi ')+(i+1)]):[['','(çizimde çizgi yok)']])+`<p class="note">Çizime bir merkez çizgisi ekleyip ekseni burada seç.</p>`);
      let d=fSel('Tür','mode',[['one','Tek yön'],['mid','Orta düzlem']])+fNum('Açı','angle','°');
      if(f.mode!=='mid')d+=`<button type="button" class="sbtn" data-flip="1">⇅ Ters yön${f.flip?' (açık)':''}</button>`;
      b+=grp('Yön 1',d);
    }
  }else if(f.type==='fillet'||f.type==='chamfer'){
    b=grp('',b)+grp(f.type==='fillet'?'Radyus parametreleri':'Pah parametreleri',f.type==='fillet'?fNum('Yarıçap','r'):fNum('Mesafe (eşit)','d'));
    b+=grp(`Kenarlar (${f.edges.length})`,(f.edges.length?`<div class="lst">${f.edges.map((e,i)=>`<div><span>Kenar ${i+1}: ${fmt(vl(vs(e.b,e.a)),1)} mm</span><button data-rmedge="${i}" aria-label="Kaldır">✕</button></div>`).join('')}</div>`:'')+`<p class="note">Modelde düz kenarlara tıkla. Tekrar tıklarsan seçim kalkar.</p>`);
  }else if(['lpattern','cpattern','mirror'].includes(f.type)){
    const tg=eligible(f);
    b=grp('',b)+grp('Çoğaltılacak özellikler',tg.length?`<div class="lst">${tg.map(x=>`<label class="chk" style="margin:0"><input type="checkbox" data-tg="${x.id}" ${f.targets.includes(x.id)?'checked':''}> ${esc(x.name)}</label>`).join('')}</div><p class="note">Ağaçtaki özelliklere tıklayarak da seçebilirsin.</p>`:'<p class="note">Uygun özellik yok.</p>');
    if(f.type==='lpattern'){
      b+=grp('Yön 1',fSel('Yön','dir1',DIR_OPTS)+`<div class="row2">${fNum('Aralık','sp1')}${fNum('Adet','n1','adet')}</div>`);
      let s2=fSel('Yön','dir2',[['none','Kullanma'],...DIR_OPTS]);if(f.dir2!=='none')s2+=`<div class="row2">${fNum('Aralık','sp2')}${fNum('Adet','n2','adet')}</div>`;
      b+=grp('Yön 2',s2);
    }else if(f.type==='cpattern'){
      b+=grp('Parametreler',fSel('Eksen (orijinden geçen)','axis',[['x','X ekseni'],['y','Y ekseni'],['z','Z ekseni']])+`<div class="row2">${fNum('Adet','n','adet')}${fNum('Toplam açı','angle','°')}</div><p class="note">360° girersen kopyalar eşit dağıtılır.</p>`);
    }else b+=grp('Ayna düzlemi',fSel('Düzlem','plane',planeOpts(f))+`<p class="note">Ekranda veya ağaçta bir düzleme de tıklayabilirsin.</p>`);
  }else if(f.type==='plane'){
    b=grp('',b)+grp('İlk referans',fSel('Paralel düzlem','base',planeOpts(f))+fNum('Ofset mesafesi','offset')+fChk('Ters taraf','flip'));
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
  const rm=e.target.closest('[data-rmedge]');if(rm){pm.draft.edges.splice(+rm.dataset.rmedge,1);renderPM();updateSelVisual();schedulePreview();return}
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
  setPath(pm.draft,t.dataset.k,t.value);
  if(t.dataset.k==='sketch'&&pm.type==='revolve')pm.draft.axis=defaultAxis(byId(t.value));
  renderPM();renderTree();updatePlaneVis();schedulePreview();
});

/* önizleme */
let prevT=0;
function schedulePreview(ms=120){clearTimeout(prevT);prevT=setTimeout(updatePreview,ms)}
function clearPreview(){for(const c of [...previewGroup.children]){previewGroup.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}}
function addPreview(polys,cut){if(!polys.length)return;const {g}=polysToBuffers(polys);previewGroup.add(new T.Mesh(g,cut?matPrevCut:matPrevAdd));previewGroup.add(new T.LineSegments(segGeom(computeEdges(polys,null).filter(e=>e.k===1)),cut?matPrevEdgeC:matPrevEdgeA))}
function updatePreview(){
  clearPreview();if(!pm)return;const f=pm.draft,B=pm.base;const err=$('#pmErr');
  try{
    if(f.type==='extrude'||f.type==='revolve'){
      const s=byId(f.sketch);if(!s)throw new Error('Bir çizim seç.');const F=B.frames[s.id]||model.frames[s.id];if(!F)throw new Error('Çizim düzlemi çözülemedi.');
      const r=f.type==='extrude'?extrudeTool(f,s,F,reachFor(B.polys,F)):revolveTool(f,s,F);addPreview(r.polys,f.op==='cut');
    }else if(['lpattern','cpattern','mirror'].includes(f.type)){
      if(!f.targets.length)throw new Error('Ağaçtan çoğaltılacak özelliği seç.');
      const Ms=patternMatrices(f,B.frames);
      for(const tid of f.targets){const t=B.tools[tid]||model.tools[tid];if(!t)continue;let ps=[];for(const M of Ms)ps=ps.concat(transformPolys(t.polys,M,'p'));addPreview(ps,t.op==='cut')}
    }else if(f.type==='hole'){holePreview(f,B)
    }else if(f.type==='fillet'||f.type==='chamfer'){
      if(f.edges.length){const r=edgeOpBodies(B.polys,f,B.ann||model.ann);addPreview([].concat(...r.sub),true);addPreview([].concat(...r.add),false)}
    }else if(f.type==='plane'){
      const Bf=STD[f.base]||B.frames[f.base];if(!Bf)throw new Error('Referans düzlem bulunamadı.');const off=num(f.offset)*(f.flip?-1:1);
      const F={o:va(Bf.o,vk(Bf.n,off)),u:Bf.u,v:Bf.v,n:Bf.n};const o=makePlaneObj(F,'prev',Math.max(80,modelExtent()));o.children[0].material.opacity=.2;o.children[0].material.color.setHex(0xE2A83A);o.children[1].material.color.setHex(0xB0760E);previewGroup.add(o);
    }
    if(err){err.classList.remove('on');err.textContent=''}
  }catch(e){if(err){err.textContent=e.message||String(e);err.classList.add('on')}}
}
