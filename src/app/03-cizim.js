/* Çizim (sketch) modu: araçlar, akıllı ölçülendirme, ilişkiler, çizim görüntüsü ve paneli. */
/* ================= ÇİZİM MODU (Sketch) ================= */
const REL={sym:['Simetrik','⇋'],h:['Yatay','—'],v:['Dikey','|'],par:['Paralel','∥'],perp:['Dik','⊥'],eq:['Eşit','='],coll:['Doğrusal','≡'],tan:['Teğet','T'],pol:['Çakışık','◦'],poc:['Çakışık','◦'],mid:['Orta nokta','M'],fix:['Sabitle','⚓'],coin:['Çakışık','◦'],conc:['Eşmerkezli','◎'],offd:['Ofset','⧉'],tr:['Doğrusal çoğaltma','⋯'],rot:['Dairesel çoğaltma','↻']};
const DIMT=new Set(['d','dh','dv','dpl','dll','ddia','drad','dang','doff']);
/* yalnızca ilgili öğe seçiliyken simgesi gösterilen ilişkiler (çok sayıda olabilir) */
const QUIETREL=new Set(['tr','rot','offd']);
const TOOLHELP={
  line:'Çizgi: başlangıç ve bitiş noktalarına tıkla; zincir devam eder. Bitirmek için çift tıkla veya Esc. Yatay, dikey, dik ve teğet yönler ile kesişim noktaları otomatik yakalanır.',
  centerline:'Merkez çizgisi: döndürme ekseni ve simetri için yapı çizgisi. İki noktaya tıkla.',
  rect:'Köşe dikdörtgen: bir köşeye, sonra karşı köşeye tıkla.',
  crect:'Merkez dikdörtgen: önce merkeze (örneğin orijine), sonra bir köşeye tıkla.',
  circle:'Daire: merkeze, sonra çevre üzerindeki bir noktaya tıkla.',
  arc:'Merkez nokta yay: merkez, başlangıç ve bitiş noktalarına sırayla tıkla. Yön fareyi hareket ettirdiğin yöne göre belirlenir.',
  arc3:'3 nokta yay: başlangıç ve bitiş noktalarına, sonra yayın geçeceği üçüncü noktaya tıkla.',
  tarc:'Teğet yay: bir çizginin veya yayın ucuna, sonra yayın bitiş noktasına tıkla. Zincir devam eder; bitirmek için çift tıkla veya Esc.',
  slot:'Düz kanal: iki merkez noktasına, sonra genişliği belirlemek için yana tıkla.',
  polygon:'Çokgen: merkeze, sonra bir köşeye tıkla.',
  point:'Nokta: konuma tıkla. Bir öğenin üstüne veya kesişimine tıklanırsa nokta ona bağlanır. Noktalar profile katılmaz; ölçü, ilişki ve yapı için kullanılır.',
  sfillet:'Çizim radyusu: iki çizginin veya çizgi ile yayın birleştiği köşe noktasına tıkla.',
  smartdim:'Akıllı ölçülendirme: çizgi (uzunluk), daire (çap), yay (yarıçap), iki nokta/çizgi (mesafe) veya iki çizgi (açı) seç; sonra ölçünün yerine tıkla ve değeri gir.'
};
/* panelde görünen kısa açıklama; TOOLHELP'teki ayrıntı “Etkin araç” başlığının ipucundadır */
const TOOLSHORT={
  line:'Noktalara tıkla; çift tıkla veya Esc ile bitir.',
  centerline:'İki noktaya tıkla.',
  rect:'İki karşı köşeye tıkla.',
  crect:'Merkeze, sonra köşeye tıkla.',
  circle:'Merkeze, sonra çevreye tıkla.',
  arc:'Merkez, başlangıç ve bitişe tıkla.',
  arc3:'Uçlara, sonra yay noktasına tıkla.',
  tarc:'Bir uca, sonra bitiş noktasına tıkla.',
  slot:'İki merkeze, sonra yana tıkla.',
  polygon:'Merkeze, sonra köşeye tıkla.',
  point:'Konuma tıkla.',
  sfillet:'Köşe noktasına tıkla.',
  smartdim:'Öğe seç, ölçünün yerine tıkla.'
};
/* yeni kimlik: döndürme ekseni olarak başka bir özelliğin kullandığı kimlik (öğe silinmiş olsa da) yeni öğeye verilmez;
   yoksa silinen eksenin yerine çizilen herhangi bir çizgi sessizce döndürme ekseni olurdu */
function axisRefs(f){return state.features.filter(x=>x.type==='revolve'&&x.sketch===f.id&&x.axis).map(x=>x.axis)}
function newId(f,pre){let n=1;const ext=new Set(axisRefs(f));const has=id=>f.pts[id]||ext.has(id)||f.ents.some(e=>e.id===id)||f.cons.some(c=>c.id===id);while(has(pre+n))n++;return pre+n}
/* çizimden çıkarken ekseni silinmiş döndürme: eski eksenle aynı doğru üzerindeki çizgi (ör. budamadan kalan parça),
   yoksa çizimdeki tek merkez çizgisi eksen olur */
function fixRevolveAxes(f,orig){
  const msgs=[];
  for(const x of state.features){if(x.type!=='revolve'||x.sketch!==f.id||f.ents.some(e=>e.id===x.axis&&e.t==='line'))continue;
    const cl=f.ents.filter(e=>e.t==='line'&&e.cons&&!e.ref);let ax=null;
    const o=orig&&orig.ents.find(e=>e.id===x.axis&&e.t==='line');
    if(o){const P=id=>id==='O'?[0,0]:[orig.pts[id].x,orig.pts[id].y],a=P(o.a),b=P(o.b),L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
      const off=id=>{const p=P2(id);return Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))/L};
      const on=f.ents.filter(e=>e.t==='line'&&off(e.a)<1e-6*(1+L)&&off(e.b)<1e-6*(1+L));ax=on.find(e=>!!e.cons===!!o.cons)||on[0]||null}
    if(!ax&&cl.length===1)ax=cl[0];
    if(ax){x.axis=ax.id;msgs.push(`“${x.name}” için döndürme ekseni güncellendi.`)}
    else msgs.push(`“${x.name}” özelliğinin döndürme ekseni çizimde yok; özelliği düzenleyip ekseni seç.`)}
  return msgs.join(' ');
}
/* çizimde öğe ve tek başına nokta yok */
const skEmpty=f=>!f.ents.length&&!Object.values(f.pts).some(p=>p.sp);
function skData(f){return JSON.stringify({pts:f.pts,ents:f.ents,cons:f.cons})}
function skPush(){sk.hist.push(skData(sk.feat));clearConf();if(sk.hist.length>100)sk.hist.shift();sk.redo=[];updUndo()}
function skRestore(s){const o=JSON.parse(s);sk.feat.pts=o.pts;sk.feat.ents=o.ents;sk.feat.cons=o.cons}
// açık ölçü kutuları ve sürükleme geri alınan duruma ait olabilir: kapatılır (yoksa silinen ölçünün kimliğini alan yeni ölçü değişirdi)
function skHistReset(){sk.sel=[];sk.st={};sk.drag=null;sk.dragTg=null;closeDimPop();closeSkInput();closeSizePop();clearConf()}
function sketchUndo(){if(!sk||!sk.hist.length)return;sk.redo.push(skData(sk.feat));skRestore(sk.hist.pop());skHistReset();skChanged();updUndo()}
function sketchRedo(){if(!sk||!sk.redo.length)return;sk.hist.push(skData(sk.feat));skRestore(sk.redo.pop());skHistReset();skChanged();updUndo()}

function startSketch(on){
  if(sk)return;if(pm)closePM(true);pickMode=null;prompt_(null);
  let F;try{F=sketchFrame({on},{frames:model.frames,caps:model.caps})}catch(e){toast(e.message);return}
  const r0=hist.redo.slice();pushHist();
  const f={id:uid('s'),type:'sketch',name:nextName({type:'sketch'}),on,pts:{},ents:[],cons:[]};
  state.features.push(f);beginSession(f,F,true);sk.redo0=r0;
}
function editSketch(id){
  const f=byId(id);if(!f||sk)return;if(pm)closePM(true);cancelPick();
  const F=model.frames[id];if(!F){toast('Çizim düzlemi çözülemedi'+(model.errors[id]?': '+model.errors[id]:'.'));return}
  const r0=hist.redo.slice();pushHist();beginSession(f,F,false);if(sk)sk.redo0=r0;
}
function beginSession(f,F,isNew){
  sk={feat:f,F,M:frameMatrix(F),isNew,orig:JSON.stringify(f),tool:null,st:{},sel:[],hover:null,cursor:null,drag:null,hist:[],redo:[],an:null,ok:true,dirty:true,
      opts:{grid:true,rels:true,polyN:6,filletR:5}};
  // çizimi kullanan özellik (ekstrüzyon, kesme, döndürme) düzenleme boyunca gizlenir
  const user=!isNew&&consumedMap()[f.id];
  if(user){try{sk.base=rebuildModel(state.features.map(x=>x.id===user?{...x,suppressed:true}:x)).polys;showSolid(sk.base)}catch(e){}}
  solidTone();
  skGroup.matrix.copy(sk.M);skGroup.matrixWorldNeedsUpdate=true;sel=null;updateSelVisual();setOrtho(true);setControlsForSketch(true,true);vpEl.classList.add('sketching');
  cmTab='sketch';renderRibbon();$('#confirm').classList.add('on');$('#sbar').classList.add('on');
  analyze();renderTree();renderPM();updateStatus();updateMass();renderSketchDisplays();updatePlaneVis();normalTo(F);
  if(pendingTool){setTool(pendingTool);pendingTool=null}
  if(!isNew&&autoDefOn())autoDefineSketch(true);
  updUndo();updSbar();
}
function exitSketch(accept){
  if(!sk)return true;const f=sk.feat,wasNew=sk.isNew;
  endChainIfAny();closeSketchToast();
  // değişiklik yoksa çizime girerken eklenen geri alma adımı kaldırılır, yinele listesi geri gelir
  const drop=()=>{hist.undo.pop();if(sk.redo0)hist.redo=sk.redo0};
  if(!accept){if(wasNew)state.features=state.features.filter(x=>x!==f);else Object.assign(f,JSON.parse(sk.orig));drop();pending=null}
  else{pruneRefs(f);cleanupOrphans(f);if(wasNew&&skEmpty(f)){state.features=state.features.filter(x=>x!==f);drop();pending=null}
    else{let msg=fixRevolveAxes(f,JSON.parse(sk.orig));
      if(autoDefOn()&&!skEmpty(f)){try{const n=autoDefine(f,{px:sk.px}).length;if(n){solveSketch(f);msg=(msg?msg+' ':'')+`Çizim tam tanımlandı: ${n} ölçü/ilişki otomatik eklendi.`}}catch(e){}}
      const iss=skIssues(f);if(iss.n)msg=issueText(iss)+' '+issueHint(iss)+(msg?' '+msg:'');
      if(msg)toast(msg);
      if(!wasNew&&snapshot()===hist.undo[hist.undo.length-1])drop()}}
  clearConf();sk=null;closeDimPop();closeSkInput();closeSizePop();solidTone();
  for(const c of [...skGroup.children]){skGroup.remove(c);if(c.geometry)c.geometry.dispose()}
  $('#labels').innerHTML='';setControlsForSketch(false);setOrtho(false);vpEl.classList.remove('sketching');$('#confirm').classList.remove('on');$('#sbar').classList.remove('on');
  cmTab='features';afterChange();
  const still=byId(f.id);
  if(accept&&pending&&still){const p=pending;pending=null;openNewProfile(p.type,p.op,f.id)}
  else if(accept&&still){sel={kind:'feature',id:f.id};renderTree();renderSketchDisplays()}
  return true;
}
$('#confirm').addEventListener('click',e=>{const b=e.target.closest('[data-cf]');if(!b)return;exitSketch(b.dataset.cf==='ok')});

function analyze(){updateDriven(sk.feat);try{sk.an=analyzeSketch(sk.feat)}catch(e){sk.an=null}try{sk.unsat=sketchUnsat(sk.feat)}catch(e){sk.unsat=[]}sk.ok=!sk.unsat.length;try{sk.issues=skIssues(sk.feat);sk.xpts=skXpts(sk.feat)}catch(e){sk.issues=null;sk.xpts=[]}}
/* Profil sorunları: boşta uçlar, üçten fazla öğenin birleştiği noktalar, kesişmeler (yapı geometrisi hariç).
   Kesişen ve üst üste binen şekiller bölge çözümüyle birleştiği için profil çıkarılabiliyorsa (ok) yalnızca boşta uçlar bildirilir. */
function skIssues(f){
  const ents=f.ents.filter(e=>!e.cons);const deg={};
  for(const e of ents)if(e.t!=='circle')for(const p of [e.a,e.b])deg[p]=(deg[p]||0)+1;
  const open=[],multi=[],cross=[];
  for(const p in deg){if(deg[p]===1)open.push(p);else if(deg[p]>2)multi.push(p)}
  let ok=false;if(ents.length){try{ok=sketchProfiles(f).length>0}catch(e){ok=false}}
  if(ok)return {open,multi:[],cross:[],n:open.length,ok};
  const shared=(e,o)=>[e.a,e.b,e.c].filter(x=>x&&[o.a,o.b].includes(x));
  for(let i=0;i<ents.length;i++)for(let j=i+1;j<ents.length;j++){const e=ents[i],o=ents[j];
    for(const p of intersectEnts(f,e,o)){if(shared(e,o).some(id=>{const q=skP(f,id);return Math.hypot(q.x-p[0],q.y-p[1])<1e-6*(1+Math.abs(p[0])+Math.abs(p[1]))}))continue;
      if(open.some(id=>{const q=skP(f,id);return Math.hypot(q.x-p[0],q.y-p[1])<1e-6*(1+Math.abs(p[0])+Math.abs(p[1]))}))continue; // T-birleşimi zaten boşta uç
      cross.push(p)}}
  return {open,multi,cross,n:open.length+multi.length+cross.length,ok};
}
/* çizim araçları kullanılırken açık uçlar doğaldır; sorunlar yalnızca seçim/ölçü/düzenleme araçlarında gösterilir */
const showIssues=()=>!sk.tool||['smartdim','trim','sfillet'].includes(sk.tool);
function issueText(iss){
  const a=[];if(iss.open.length)a.push(`${iss.open.length} boşta uç (açık kontur)`);if(iss.multi.length)a.push(`${iss.multi.length} noktada ikiden fazla öğe birleşiyor`);if(iss.cross.length)a.push(`${iss.cross.length} kesişme`);
  return 'Çizimde '+a.join(', ')+' var.';
}
/* sorunun ne anlama geldiği: kapalı bölge varsa boşta uçlar yalnızca yok sayılır; yoksa ince özellik gerekir */
function issueHint(iss){
  if(iss.ok)return 'Boşta kalan çizgiler profile katılmaz; kapalı bölgeler kullanılır.';
  if(iss.open.length&&!iss.multi.length&&!iss.cross.length)return 'Kapalı bölge yok: bu açık kontur yalnızca Ekstrüzyondaki İnce özellik (kalınlık) ile katıya dönüştürülebilir. Kapalı profil için konturu kapat.';
  return 'Kırmızı işaretli noktaları düzelt: konturu kapat, fazla parçaları Budama ile temizle.';
}
/* Yakalama için öğe kesişim noktaları (var olan noktalarla çakışmayanlar) */
function skXpts(f){
  const out=[];const ids=['O',...Object.keys(f.pts)];
  for(let i=0;i<f.ents.length;i++)for(let j=i+1;j<f.ents.length;j++){const e=f.ents[i],o=f.ents[j];
    for(const p of intersectEnts(f,e,o)){const eps=1e-6*(1+Math.abs(p[0])+Math.abs(p[1]));if(ids.some(id=>{const q=skP(f,id);return Math.hypot(q.x-p[0],q.y-p[1])<eps}))continue;
      if(out.some(x=>Math.hypot(x.x-p[0],x.y-p[1])<eps))continue;out.push({x:p[0],y:p[1],e1:e,e2:o})}}
  return out;
}
/* Otomatik tam tanımlama: yalnızca kullanıcı isteyince — şeritteki "Tam Tanımla" ile ya da paneldeki seçenek açıksa
   çizime girerken ve çıkarken. Varsayılan kapalı: ölçü verilmeyen öğeler serbest (mavi) kalır. */
const AUTODEF_KEY='tezgah-cad-otomatik-tam-tanimla';
function autoDefOn(){try{return localStorage.getItem(AUTODEF_KEY)==='1'}catch(e){return false}}
function setAutoDef(on){try{localStorage.setItem(AUTODEF_KEY,on?'1':'0')}catch(e){}}
function autoDefineSketch(silent){
  if(!sk)return 0;const f=sk.feat;if(skEmpty(f)){if(!silent)toast('Çizimde öğe yok.');return 0}
  endChainIfAny();skPush();let added=[];
  try{added=autoDefine(f,{px:sk.px})}catch(e){added=[]}
  if(!added.length){sk.hist.pop();updUndo();if(!silent)toast('Çizim zaten tam tanımlı.');return 0}
  if(!solveSketch(f)){skRestore(sk.hist.pop());toast('Çizim otomatik tanımlanamadı.');skChanged();return 0}
  skChanged();
  const nd=added.filter(c=>DIMT.has(c.t)).length;
  toast(`${nd} ölçü ve ${added.length-nd} ilişki eklendi; çizim tam tanımlı. Ölçüye çift tıklayarak veya soldaki listeden değiştirebilirsin.`,{label:'Geri al',sk:true,fn:()=>{if(sk&&sk.feat===f)sketchUndo()}});
  return added.length;
}
function skChanged(){analyze();sk.dirty=true;renderSketchPM();updSbar();renderRibbon();saveState();if(sizeEl)refreshSizePop()}
function cleanupOrphans(f){
  const ids=new Set(f.ents.map(e=>e.id));
  f.cons=f.cons.filter(c=>!(c.e&&!ids.has(c.e))&&!(c.e1&&!ids.has(c.e1))&&!(c.e2&&!ids.has(c.e2)));
  const used=new Set(['O']);for(const e of f.ents){for(const k of ['a','b','c'])if(e[k])used.add(e[k])}
  for(const c of f.cons){if(c.t==='mid'||c.t==='fix'||DIMT.has(c.t)||c.t==='h'||c.t==='v'){if(c.p&&used.has(c.p))continue}}
  const consUsed=new Set();for(const c of f.cons)for(const k of ['p','q'])if(c[k])consUsed.add(c[k]);
  // öğeye ait olmayan nokta: çizim noktası (Nokta aracı), orta nokta ilişkisi varsa veya iki öğeyi bağlıyorsa (ör. daire çevresi çizgi üstünde) kalır
  for(const id of Object.keys(f.pts)){if(!used.has(id)){const keep=f.pts[id].sp||f.cons.some(c=>c.t==='mid'&&c.p===id)||f.cons.filter(c=>(c.t==='pol'||c.t==='poc')&&c.p===id).length>=2;if(!keep)delete f.pts[id]}}
  f.cons=f.cons.filter(c=>!CPK.some(k=>c[k]&&c[k]!=='O'&&!f.pts[c[k]]));
  f.cons=f.cons.filter(c=>c.t!=='offd'||f.cons.some(x=>x.id===c.dim));
}
function setTool(t){
  if(!sk)return;endChainIfAny();sk.tool=t;sk.filArc=null;sk.st={};sk.op=null;sk.wake=null;sk.hoverAxis=null;if(t)sk.sel=[];closeDimPop();closeSkInput();closeSizePop();closeConflict();
  renderRibbon();renderSketchPM();sk.dirty=true;updSbar();
}
function endChainIfAny(){
  if(!sk)return;const st=sk.st;
  if((sk.tool==='line'||sk.tool==='centerline')&&st.start&&st.newStart){const f=sk.feat;const id=st.start;if(!f.ents.some(e=>e.a===id||e.b===id)){delete f.pts[id];f.cons=f.cons.filter(c=>c.p!==id&&c.q!==id)}}
  if(sk.tool&&sk.tool!=='line'&&sk.tool!=='centerline'&&st.newPts){const f=sk.feat;for(const id of st.newPts)if(!f.ents.some(e=>e.a===id||e.b===id||e.c===id)){delete f.pts[id];f.cons=f.cons.filter(c=>c.p!==id&&c.q!==id)}}
  sk.st={};
}

/* ---------- koordinatlar ---------- */
const skPlane=()=>new T.Plane().setFromNormalAndCoplanarPoint(v3(sk.F.n),v3(sk.F.o));
function skLocalXY(cx,cy){
  const r=renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),camera);
  const p=new T.Vector3();if(!ray.ray.intersectPlane(skPlane(),p))return null;
  const d=[p.x-sk.F.o[0],p.y-sk.F.o[1],p.z-sk.F.o[2]];return [vd(d,sk.F.u),vd(d,sk.F.v)];
}
function skPx(cx,cy){const a=skLocalXY(cx,cy),b=skLocalXY(cx+1,cy);if(!a||!b)return modelExtent()/500;return Math.hypot(b[0]-a[0],b[1]-a[1])||1e-3}
function skToScreen(x,y){const w=fpt(sk.F,x,y,0);const s=toScreen(w);return s}
/* ızgara adımı: ekranda en az 14 piksel aralık (1-2-5 dizisi) */
function gridStep(px){return [0.1,0.2,0.5,1,2,5,10,20,50,100,200,500].find(s=>s>=px*14)||500}
const gridMajor=st=>st*({1:10,2:5,5:2}[String(st).replace(/[0.]/g,'')[0]]||10);

/* ---------- vurgulama / isabet ---------- */
const P2=id=>{const p=skP(sk.feat,id);return [p.x,p.y]};
function segD(q,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((q[0]-a[0])*dx+(q[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return [Math.hypot(a[0]+dx*t-q[0],a[1]+dy*t-q[1]),[a[0]+dx*t,a[1]+dy*t]]}
function entDist(e,q){
  const f=sk.feat;
  if(e.t==='line')return segD(q,P2(e.a),P2(e.b));
  const c=P2(e.c),r=curveR(f,e);const d=Math.hypot(q[0]-c[0],q[1]-c[1]);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);
  const proj=[c[0]+r*Math.cos(ang),c[1]+r*Math.sin(ang)];
  if(e.t==='circle')return [Math.abs(d-r),proj];
  const A=arcInfo(f,e);let da=ang-A.a0;while(da<0)da+=Math.PI*2;while(da>Math.PI*2)da-=Math.PI*2;
  if(da<=A.sw)return [Math.abs(d-r),proj];
  const a=P2(e.a),b=P2(e.b);const da2=Math.hypot(q[0]-a[0],q[1]-a[1]),db2=Math.hypot(q[0]-b[0],q[1]-b[1]);return da2<db2?[da2,a]:[db2,b];
}
function skHit(q,tol){
  const f=sk.feat;let best=null,bd=tol;
  for(const id of ['O',...Object.keys(f.pts)]){const p=P2(id);const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={k:'pt',id}}}
  // nokta çok yakın değilse ve imleç bir öğenin üzerindeyse öğe seçilir (SolidWorks gibi): küçük dairenin çevresine
  // tıklayınca merkez noktası seçilmesin
  let be=null,bed=tol;for(const e of f.ents){const [d]=entDist(e,q);if(d<bed){bed=d;be={k:'ent',id:e.id}}}
  if(best&&be&&bd>tol*0.45&&bed<bd)return be;
  return best||be;
}
/* yalnızca noktalar: köşe bekleyen araçlarda (çizim radyusu) köşeye yakın tıklama çizgiyi değil köşeyi seçer */
function skPtHit(q,tol){
  let best=null,bd=tol;for(const id of Object.keys(sk.feat.pts)){const p=P2(id);const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={k:'pt',id}}}
  return best;
}
function skSnap(q,tol,from,exclude,fromId){
  const f=sk.feat;let best=null,bd=tol;
  for(const id of ['O',...Object.keys(f.pts)]){if(exclude&&exclude.has(id))continue;const p=P2(id);const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={x:p[0],y:p[1],pid:id}}}
  if(best)return best;
  // öğe kesişimleri: yeni nokta her iki öğenin üzerinde kalır
  for(const X of (sk.xpts||[])){const d=Math.hypot(X.x-q[0],X.y-q[1]);if(d<bd&&f.ents.includes(X.e1)&&f.ents.includes(X.e2)){bd=d;best={x:X.x,y:X.y,rels:[X.e1,X.e2].map(e=>({t:e.t==='line'?'pol':'poc',e:e.id})),ix:true}}}
  if(best)return best;bd=tol;
  for(const e of f.ents)if(e.t==='line'&&!(exclude&&(exclude.has(e.a)||exclude.has(e.b)))){const a=P2(e.a),b=P2(e.b);const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(Math.hypot(m[0]-q[0],m[1]-q[1])<tol)return {x:m[0],y:m[1],rel:{t:'mid',e:e.id}}}
  // çizgi başlangıcından daireye/yaya teğet nokta: çizgi teğet ilişkisiyle çevreye bağlanır
  if(from&&fromId){const T=tanPtSnap(q,tol,from,fromId);if(T)return T}
  bd=tol*0.8;
  let ent=null;
  for(const e of f.ents){if(exclude&&(exclude.has(e.a)||exclude.has(e.b)))continue;const [d,p]=entDist(e,q);if(d<bd){bd=d;ent=e;best={x:p[0],y:p[1],rel:{t:e.t==='line'?'pol':'poc',e:e.id}}}}
  // öğe üstünde yatay/dikey çıkarım da korunur (ör. döndürme profili eksene dik inerek kapanır)
  if(best&&from){const h=hvOnEnt(ent,q,from,tol);if(h)return {...h,rel:best.rel}}
  if(best)return best;
  let x=q[0],y=q[1];
  // ızgara: çizgilere yakınken (≈5 px) yakala, aradaki değerleri adımın onda birine yuvarla
  if(sk.opts.grid&&!skNoGrid){const st=gridStep(tol/9),fine=st/10;const gx=Math.round(x/st)*st,gy=Math.round(y/st)*st;
    x=Math.abs(gx-x)<tol*0.55?gx:Math.round(x/fine)*fine;y=Math.abs(gy-y)<tol*0.55?gy:Math.round(y/fine)*fine}
  x=Math.round(x*1000)/1000;y=Math.round(y*1000)/1000;
  // hiza çizgileri: başlangıçtan yatay/dikey, imlecin üzerinden geçtiği noktaların yatay/dikey hizası, çizgi uzantıları ve yay teğetleri
  const g=guideSnap(skGuides(from,exclude),q,[x,y],tol);
  if(g&&g.hv)return g;
  // çıkarım: başlangıç noktasındaki çizgiye dik, yaya teğet
  if(from&&fromId){
    const v=[x-from[0],y-from[1]],L=Math.hypot(v[0],v[1]);
    if(L>tol)for(const e of f.ents){if(e.t==='circle'||(e.a!==fromId&&e.b!==fromId))continue;
      let d,t;
      if(e.t==='line'){const o=P2(e.a===fromId?e.b:e.a);const u=[from[0]-o[0],from[1]-o[1]],ul=Math.hypot(...u)||1;d=[-u[1]/ul,u[0]/ul];t='perp'}
      else{const c=P2(e.c);const n=[(from[0]-c[0]),(from[1]-c[1])],nl=Math.hypot(...n)||1;d=e.b===fromId?[-n[1]/nl,n[0]/nl]:[n[1]/nl,-n[0]/nl];t='tan'}
      let k=v[0]*d[0]+v[1]*d[1];if(t==='perp'&&k<0){d=[-d[0],-d[1]];k=-k}if(k<=0)continue;
      const off=Math.abs(v[0]*d[1]-v[1]*d[0]);if(off<tol*0.7){x=from[0]+d[0]*k;y=from[1]+d[1]*k;return {x,y,inf:{t,e:e.id}}}}
  }
  return g||{x,y,hv:null};
}
/* başlangıç noktasından geçen yatay/dikey doğrunun öğeyi imlece yakın kestiği nokta */
function hvOnEnt(e,q,from,tol){
  const f=sk.feat;let best=null,bd=tol;
  for(const [k,hv] of [[0,'v'],[1,'h']]){
    const c0=from[k],o=1-k;if(Math.abs(q[k]-c0)>=tol)continue;const ys=[];
    if(e.t==='line'){const a=P2(e.a),b=P2(e.b);const den=b[k]-a[k];if(Math.abs(den)<1e-9)continue;const t=(c0-a[k])/den;if(t<-1e-9||t>1+1e-9)continue;ys.push(a[o]+t*(b[o]-a[o]))}
    else{const c=P2(e.c),r=curveR(f,e),d=c0-c[k];if(Math.abs(d)>r)continue;const s=Math.sqrt(r*r-d*d);ys.push(c[o]+s,c[o]-s)}
    for(const y of ys){const p=k===0?[c0,y]:[y,c0];if(entDist(e,p)[0]>1e-6*(1+Math.abs(p[0])+Math.abs(p[1])))continue;const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<bd){bd=d;best={x:p[0],y:p[1],hv}}}
  }
  return best;
}
/* ızgara yakalaması noktayı merkezin üstüne çekiyorsa (çok küçük daire) yakalamayı bırak */
function unsnapNear(s,q,c,px){if(s.pid||s.rels||s.rel)return s;if(Math.hypot(s.x-c[0],s.y-c[1])<px*3&&Math.hypot(q[0]-c[0],q[1]-c[1])>=px*3)return {x:Math.round(q[0]*1000)/1000,y:Math.round(q[1]*1000)/1000};return s}
function resolvePt(s,added){
  const f=sk.feat;if(s.pid)return s.pid;
  const id=newId(f,'p');f.pts[id]={x:s.x,y:s.y};
  snapTie(s,id,added);
  return id;
}
/* yakalanan öğelerle çakışıklık: nokta bir öğenin üstüne (veya iki öğenin kesişimine) tıklandıysa ona bağlanır */
function snapTie(s,id,added){
  const f=sk.feat;if(s.pid)return;
  for(const r of (s.rels||(s.rel?[s.rel]:[]))){const c={id:newId(f,'c'),t:r.t,p:id,e:r.e};f.cons.push(c);if(added)added.push(c.id)}
}
function addEnt(e){e.id=newId(sk.feat,'e');sk.feat.ents.push(e);return e}
function addCon(c,added){c.id=newId(sk.feat,'c');sk.feat.cons.push(c);if(added)added.push(c.id);return c}
function finishOp(added){
  const f=sk.feat;
  if(!solveSketch(f)){
    if(added&&added.length){f.cons=f.cons.filter(c=>!added.includes(c.id));if(solveSketch(f)){skChanged();return true}}
    if(sk.hist.length)skRestore(sk.hist.pop());toast('Çizim çözülemedi; işlem geri alındı.');skChanged();return false;
  }
  skChanged();return true;
}

/* ---------- işaretçi olayları ---------- */
function skEv(e){const q=skLocalXY(e.clientX,e.clientY);const px=skPx(e.clientX,e.clientY);return {q,px,tol:px*9}}
function skPointerDown(e){
  if(confEl)closeConflict();
  if(e.button!==0&&e.pointerType==='mouse')return;
  const {q,tol}=skEv(e);if(!q)return;
  if(!sk.tool){const h=skHit(q,tol);if(h&&!(h.k==='pt'&&h.id==='O')){sk.drag={h,q0:q,moved:false,orig:clone({pts:sk.feat.pts,ents:sk.feat.ents})}}}
  if(sk.tool==='trim')sk.ptrim={last:q,path:[q],n:0};
}
function skPointerMove(e){
  const {q,px,tol}=skEv(e);if(!q)return;sk.cursor=q;sk.px=px;
  $('#sbXY').textContent=`${PLANEAX()[0]}: ${fmt(q[0])}   ${PLANEAX()[1]}: ${fmt(q[1])}`;
  // düğme görünüm dışında bırakıldıysa (bırakma olayı kaçtı) sürükleme biter; öğe tıklanmadan fareyle gelmez
  if(sk.drag&&e.pointerType==='mouse'&&!(e.buttons&1)){flushDrag();const d=sk.drag;sk.drag=null;if(d.moved)skChanged()}
  if(sk.drag){
    const d=sk.drag;if(!d.moved&&Math.hypot(q[0]-d.q0[0],q[1]-d.q0[1])>px*3){d.moved=true;skPush()}
    if(d.moved){
      const f=sk.feat,dx=q[0]-d.q0[0],dy=q[1]-d.q0[1];let tg=[];
      if(d.h.k==='pt')tg=[{p:d.h.id,x:q[0],y:q[1]}];
      else{const en=f.ents.find(x=>x.id===d.h.id);const op=d.orig.pts;
        if(en.t==='circle'){const c=P2(en.c);tg=[{e:en.id,r:Math.max(px,Math.hypot(q[0]-c[0],q[1]-c[1]))}]}
        else for(const k of ['a','b','c'])if(en[k]&&op[en[k]])tg.push({p:en[k],x:op[en[k]].x+dx,y:op[en[k]].y+dy});}
      // çözüm kare başına bir kez yapılır (flushDrag): hızlı fare hareketinde olay kuyruğu birikmez
      sk.dragTg=tg;sk.dirty=true;
    }
    return;
  }
  sk.extHover=null;sk.hoverAxis=null;
  if(sk.tool&&DRAWTOOLS.has(sk.tool))wakeAt(q,tol);
  if(!sk.tool||sk.tool==='smartdim'||sk.tool==='sfillet'){const h=sk.tool==='sfillet'?skPtHit(q,tol)||skHit(q,tol):skHit(q,tol);const k=h?h.k+':'+h.id:null;if(k!==sk.hover){sk.hover=k}
    if(!h&&(!sk.tool||(sk.tool==='smartdim'&&dimRefOk())))sk.extHover=extPick(q,tol*0.7)}
  else sk.hover=null;
  if(sk.tool==='trim'){
    if(sk.ptrim&&!(e.buttons&1))sk.ptrim=null;
    if(sk.ptrim)trimDragTo(q,px);
    const best=sk.ptrim?null:trimPick(sk.feat,q,tol);sk.hover=best?'ent:'+best.id:null}
  if(sk.tool==='arc'&&sk.st.c&&sk.st.a){const c=P2(sk.st.c);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);if(sk.st.last!==undefined){let d=ang-sk.st.last;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;sk.st.acc=(sk.st.acc||0)+d}sk.st.last=ang}
  sk.dirty=true;
}
function flushDrag(){if(sk&&sk.dragTg){const tg=sk.dragTg;sk.dragTg=null;solveSketch(sk.feat,tg)}}
function skPointerUp(e,d){
  flushDrag();const drag=sk.drag;sk.drag=null;
  // sürükleyerek budama yapıldıysa bırakılan yerde ayrıca tıklama budaması yapılmaz
  const pt=sk.ptrim;sk.ptrim=null;if(pt&&pt.n){sk.dirty=true;return}
  if(drag&&drag.moved){if(drag.h.k==='pt'){const ev=skEv(e);if(ev.q)dropPoint(drag.h.id,ev.tol)}skChanged();return}
  if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)>6)return;
  if(e.button!==0&&e.pointerType==='mouse')return;
  const ev=skEv(e);if(!ev.q)return;
  // boş yere tıklama: arkadaki model kenarı veya başka bir çizimin öğesi varsa referans olarak eklenip seçilir
  if(!sk.tool){const h=skHit(ev.q,ev.tol)||refAt(ev.q,ev.tol*0.7);if(h)toggleSel(h);else{sk.sel=[];skChanged()}sizePopForSel(ev.q);return}
  toolClick(ev.q,ev.px,ev.tol);
}
/* sürüklenen nokta başka bir noktanın (orijin dahil) üstüne bırakılınca onunla birleşir; bir öğenin üstüne bırakılınca üzerinde kalır */
function dropPoint(id,tol){
  const f=sk.feat;if(!f.pts[id])return;const p=P2(id);
  const own=f.ents.filter(e=>e.a===id||e.b===id||e.c===id);const near=new Set([id]);for(const e of own)for(const k of ['a','b','c'])if(e[k])near.add(e[k]);
  let best=null,bd=tol;
  for(const o of ['O',...Object.keys(f.pts)]){if(near.has(o))continue;const q=P2(o);const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;best=o}}
  const prev=skData(f);
  if(best){mergePts(f,best,id);sk.sel=sk.sel.filter(h=>h.id!==id)}
  else{
    let en=null;bd=tol*0.8;
    for(const e of f.ents){if(own.includes(e)||f.cons.some(c=>(c.t==='pol'||c.t==='poc')&&c.p===id&&c.e===e.id))continue;const [d]=entDist(e,p);if(d<bd){bd=d;en=e}}
    if(!en)return;
    const r0=sketchRank(f);const c={t:en.t==='line'?'pol':'poc',p:id,e:en.id,id:newId(f,'c')};f.cons.push(c);
    if(sketchRank(f)===r0){f.cons.pop();return}
  }
  if(!solveSketch(f)){skRestore(prev);toast('Nokta oraya bağlanamadı: çizim çözülemiyor.')}
}
function skDblClick(e){
  if(sk.tool==='line'||sk.tool==='centerline'||sk.tool==='tarc'){endChainIfAny();sk.dirty=true;return}
  // Seç aracında çift tıklama: uç uca bağlı öğe zincirinin tamamını seçer (ofset, aynalama, çoğaltma için)
  if(!sk.tool){const {q,tol}=skEv(e);if(!q)return;const h=skHit(q,tol);if(!h||h.k!=='ent')return;
    for(const id of skChain(sk.feat,h.id))if(!sk.sel.some(x=>x.k==='ent'&&x.id===id))sk.sel.push({k:'ent',id});skChanged()}
}
/* öğeyle uç noktaları üzerinden bağlı (aynı türde: profil veya yapı) öğeler */
function skChain(f,id){
  const E=entMap(f),st=E[id];if(!st)return [];const out=new Set([id]),todo=[st];
  while(todo.length){const e=todo.pop();if(e.t==='circle')continue;
    for(const o of f.ents)if(!out.has(o.id)&&o.t!=='circle'&&!!o.cons===!!st.cons&&[o.a,o.b].some(p=>p===e.a||p===e.b)){out.add(o.id);todo.push(o)}}
  return [...out];
}
function toggleSel(h){const i=sk.sel.findIndex(s=>s.k===h.k&&s.id===h.id);if(i>=0)sk.sel.splice(i,1);else sk.sel.push(h);skChanged()}
const PLANEAX=()=>{const on=sk.feat.on;if(on.kind==='std')return {front:['X','Y'],top:['X','−Z'],right:['−Z','Y']}[on.key];return ['x','y']};

/* ---------- araç tıklamaları ---------- */
function toolClick(q,px,tol){
  const f=sk.feat,st=sk.st,t=sk.tool;
  if(t==='line'||t==='centerline'){
    const from=st.start?P2(st.start):null;const s=skSnap(q,tol,from,null,st.start);
    if(!st.start){skPush();st.start=resolvePt(s);st.first=st.start;st.newStart=!s.pid;sk.dirty=true;return}
    if(s.pid===st.start)return;
    const p=P2(st.start);if(!s.pid&&Math.hypot(s.x-p[0],s.y-p[1])<px*2)return;
    if(!st.newStart||sk.hist.length===0)skPush();
    const added=[];const b=resolvePt(s,added);const en=addEnt({t:'line',a:st.start,b,cons:t==='centerline'});
    if(s.hv)addCon({t:s.hv,e:en.id},added);
    else if(s.inf){const c=s.inf.t==='perp'?{t:'perp',e1:s.inf.e,e2:en.id}:{t:'tan',e1:en.id,e2:s.inf.e};if(sketchRank(f,[c])>sketchRank(f))addCon(c,added)}
    else if(s.pid){const q2=P2(b),p0=P2(st.start);const hv=Math.abs(q2[1]-p0[1])<1e-6?'h':(Math.abs(q2[0]-p0[0])<1e-6?'v':null);
      if(hv){const c={t:hv,e:en.id};if(sketchRank(f,[c])>sketchRank(f))addCon(c,added)}}
    const closed=s.pid&&s.pid===st.first;
    st.newStart=false;
    if(!finishOp(added)){sk.st={};return}
    if(closed)sk.st={};else{sk.st.start=b}
    return;
  }
  if(t==='rect'||t==='crect'){
    if(!st.A){skPush();const s=skSnap(q,tol,null,null);st.A=resolvePt(s);st.newPts=s.pid?[]:[st.A];sk.dirty=true;return}
    const A=P2(st.A);const s=skSnap(q,tol,null,new Set([st.A]));
    const cx=s.x,cy=s.y;
    if(t==='rect'){
      if(Math.abs(cx-A[0])<px*2||Math.abs(cy-A[1])<px*2)return;
      const added=[];const C=resolvePt(s,added);const B=newId(f,'p');f.pts[B]={x:cx,y:A[1]};const D=newId(f,'p');f.pts[D]={x:A[0],y:cy};
      const l1=addEnt({t:'line',a:st.A,b:B}),l2=addEnt({t:'line',a:B,b:C}),l3=addEnt({t:'line',a:C,b:D}),l4=addEnt({t:'line',a:D,b:st.A});
      addCon({t:'h',e:l1.id});addCon({t:'v',e:l2.id});addCon({t:'h',e:l3.id});addCon({t:'v',e:l4.id});
      sk.st={};finishOp(added);
    }else{
      const M=A;if(Math.abs(cx-M[0])<px*2||Math.abs(cy-M[1])<px*2)return;
      const added=[];const P1=resolvePt(s,added);const mk=(x,y)=>{const id=newId(f,'p');f.pts[id]={x,y};return id};
      const P2_=mk(2*M[0]-cx,cy),P3=mk(2*M[0]-cx,2*M[1]-cy),P4=mk(cx,2*M[1]-cy);
      const l1=addEnt({t:'line',a:P1,b:P2_}),l2=addEnt({t:'line',a:P2_,b:P3}),l3=addEnt({t:'line',a:P3,b:P4}),l4=addEnt({t:'line',a:P4,b:P1});
      const d1=addEnt({t:'line',a:P1,b:P3,cons:true});addEnt({t:'line',a:P2_,b:P4,cons:true});
      addCon({t:'h',e:l1.id});addCon({t:'v',e:l2.id});addCon({t:'h',e:l3.id});addCon({t:'v',e:l4.id});addCon({t:'mid',p:st.A,e:d1.id});
      sk.st={};finishOp(added);
    }
    return;
  }
  if(t==='circle'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    const c=P2(st.c);const s=unsnapNear(skSnap(q,tol,null,new Set([st.c])),q,c,px);const r=Math.hypot(s.x-c[0],s.y-c[1]);if(r<px*2)return;
    const en=addEnt({t:'circle',c:st.c,r:Math.round(r*1000)/1000});const added=[];
    if(s.pid){const c={t:'poc',p:s.pid,e:en.id};if(s.pid!=='O'||sketchRank(f,[c])>sketchRank(f))addCon(c,added)}
    // çevre bir öğenin üstüne tıklandıysa o noktada bağlantı noktası oluşur (öğe üstünde ve çevre üstünde)
    else if(s.rel||s.rels){const id=resolvePt(s,added);addCon({t:'poc',p:id,e:en.id},added)}
    sk.st={};finishOp(added);return;
  }
  if(t==='arc'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    if(!st.a){const c=P2(st.c);const s=skSnap(q,tol,null,new Set([st.c]));if(Math.hypot(s.x-c[0],s.y-c[1])<px*2)return;st.a=resolvePt(s);if(!s.pid)st.newPts.push(st.a);st.acc=0;st.last=Math.atan2(s.y-c[1],s.x-c[0]);sk.dirty=true;return}
    const c=P2(st.c),a=P2(st.a);const r=Math.hypot(a[0]-c[0],a[1]-c[1]);const ang=Math.atan2(q[1]-c[1],q[0]-c[0]);
    let s=skSnap(q,tol,null,new Set([st.c,st.a]));let bId;
    // bitiş bir öğenin üstüne tıklandıysa yay çemberinin o öğeyle kesişimine konur ve öğeye bağlanır (diğer öğeler yerinden oynamaz)
    let tie=null;
    if(!s.pid&&s.rel&&(s.rel.t==='pol'||s.rel.t==='poc')){const en=f.ents.find(e=>e.id===s.rel.e);
      const X=en?intersectEnts(f,{t:'circle',c:st.c,r},en).filter(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<tol*2).sort((u,w)=>Math.hypot(u[0]-q[0],u[1]-q[1])-Math.hypot(w[0]-q[0],w[1]-q[1]))[0]:null;
      if(X)tie={x:X[0],y:X[1],s}}
    else if(!s.pid&&(s.rel||s.rels)&&Math.abs(Math.hypot(s.x-c[0],s.y-c[1])-r)<tol)tie={x:s.x,y:s.y,s};
    if(s.pid&&Math.abs(Math.hypot(s.x-c[0],s.y-c[1])-r)<tol)bId=s.pid;
    else{bId=newId(f,'p');f.pts[bId]=tie?{x:tie.x,y:tie.y}:{x:c[0]+r*Math.cos(ang),y:c[1]+r*Math.sin(ang)}}
    if(bId===st.a)return;
    const added=[];if(tie)snapTie(tie.s,bId,added);
    const ccw=(st.acc||0)>=0;addEnt(ccw?{t:'arc',c:st.c,a:st.a,b:bId}:{t:'arc',c:st.c,a:bId,b:st.a});
    sk.st={};finishOp(added);return;
  }
  if(t==='arc3'){
    if(!st.a){skPush();const s=skSnap(q,tol,null,null);st.a=resolvePt(s);st.newPts=s.pid?[]:[st.a];sk.dirty=true;return}
    if(!st.b){const A=P2(st.a);const s=skSnap(q,tol,null,new Set([st.a]));if(Math.hypot(s.x-A[0],s.y-A[1])<px*3)return;st.b=resolvePt(s);if(!s.pid)st.newPts.push(st.b);sk.dirty=true;return}
    const A=P2(st.a),B=P2(st.b);const s=skSnap(q,tol,null,new Set([st.a,st.b]));const C=circum(A,B,[s.x,s.y]);if(!C)return;
    const cid=newId(f,'p');f.pts[cid]={x:C[0],y:C[1]};
    addEnt(arcCcw(C,A,B,[s.x,s.y])?{t:'arc',c:cid,a:st.a,b:st.b}:{t:'arc',c:cid,a:st.b,b:st.a});
    sk.st={};finishOp([]);return;
  }
  if(t==='tarc'){
    if(!st.start){const s=skSnap(q,tol,null,null);const ref=s.pid&&f.ents.find(e=>(e.t==='line'||e.t==='arc')&&(e.a===s.pid||e.b===s.pid));
      if(!ref){toast('Teğet yay bir çizginin veya yayın ucundan başlar; bir uç noktasına tıkla.');return}st.start=s.pid;st.ref=ref.id;sk.dirty=true;return}
    const s=skSnap(q,tol,null,new Set([st.start]));const P0=P2(st.start);if(Math.hypot(s.x-P0[0],s.y-P0[1])<px*3)return;
    const g=tanArcGeo(st.start,st.ref,[s.x,s.y]);if(!g)return;
    skPush();const added=[];const b=resolvePt(s,added);const cid=newId(f,'p');f.pts[cid]={x:g.c[0],y:g.c[1]};
    const en=addEnt(g.ccw?{t:'arc',c:cid,a:st.start,b}:{t:'arc',c:cid,a:b,b:st.start});
    const ref=f.ents.find(e=>e.id===st.ref);addCon(ref.t==='line'?{t:'tan',e1:ref.id,e2:en.id}:{t:'tan',e1:ref.id,e2:en.id,int:g.int});
    const closed=!!s.pid;
    if(!finishOp(added)){sk.st={};return}
    sk.st=closed?{}:{start:b,ref:en.id};return;
  }
  if(t==='slot'){
    if(!st.c1){skPush();const s=skSnap(q,tol,null,null);st.c1=resolvePt(s);st.newPts=s.pid?[]:[st.c1];sk.dirty=true;return}
    if(!st.c2){const s=skSnap(q,tol,P2(st.c1),new Set([st.c1]));const a=P2(st.c1);if(Math.hypot(s.x-a[0],s.y-a[1])<px*3)return;st.c2=resolvePt(s);st.hv=s.hv;if(!s.pid)st.newPts.push(st.c2);sk.dirty=true;return}
    const a=P2(st.c1),b=P2(st.c2);let d=[b[0]-a[0],b[1]-a[1]];const L=Math.hypot(d[0],d[1]);d=[d[0]/L,d[1]/L];const nr=[-d[1],d[0]];
    let r=Math.abs((q[0]-a[0])*nr[0]+(q[1]-a[1])*nr[1]);if(r<px*2)return;r=Math.round(r*1000)/1000;
    const mk=(x,y)=>{const id=newId(f,'p');f.pts[id]={x,y};return id};
    const p1=mk(a[0]+nr[0]*r,a[1]+nr[1]*r),p2=mk(b[0]+nr[0]*r,b[1]+nr[1]*r),p3=mk(b[0]-nr[0]*r,b[1]-nr[1]*r),p4=mk(a[0]-nr[0]*r,a[1]-nr[1]*r);
    const cl=addEnt({t:'line',a:st.c1,b:st.c2,cons:true});const l1=addEnt({t:'line',a:p1,b:p2}),l2=addEnt({t:'line',a:p3,b:p4});
    const a2=addEnt({t:'arc',c:st.c2,a:p3,b:p2}),a1=addEnt({t:'arc',c:st.c1,a:p1,b:p4});
    const added=[];if(st.hv)addCon({t:st.hv,e:cl.id},added);
    addCon({t:'tan',e1:l1.id,e2:a1.id});addCon({t:'tan',e1:l1.id,e2:a2.id});addCon({t:'tan',e1:l2.id,e2:a1.id});addCon({t:'tan',e1:l2.id,e2:a2.id});addCon({t:'eq',e1:a1.id,e2:a2.id});
    // boy yazılarak konan ikinci merkez: merkezler arası sürücü ölçü
    if(st.Ldim){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];addDrivingDim({t:'d',p:st.c1,q:st.c2,val:st.Ldim,lp:[m[0]+nr[0]*(r+px*22),m[1]+nr[1]*(r+px*22)]})}
    sk.st={};finishOp(added);return;
  }
  if(t==='polygon'){
    if(!st.c){skPush();const s=skSnap(q,tol,null,null);st.c=resolvePt(s);st.newPts=s.pid?[]:[st.c];sk.dirty=true;return}
    const c=P2(st.c);const s=unsnapNear(skSnap(q,tol,null,new Set([st.c])),q,c,px);const r=Math.hypot(s.x-c[0],s.y-c[1]);if(r<px*3)return;
    const n=Math.max(3,Math.min(32,Math.round(sk.opts.polyN)||6));const a0=Math.atan2(s.y-c[1],s.x-c[0]);
    const circ=addEnt({t:'circle',c:st.c,r,cons:true});const vsx=[];
    for(let i=0;i<n;i++){if(i===0&&s.pid){vsx.push(s.pid);continue}const id=newId(f,'p');f.pts[id]={x:c[0]+r*Math.cos(a0+i*2*Math.PI/n),y:c[1]+r*Math.sin(a0+i*2*Math.PI/n)};vsx.push(id)}
    const ls=[];for(let i=0;i<n;i++)ls.push(addEnt({t:'line',a:vsx[i],b:vsx[(i+1)%n]}));
    for(const id of vsx)addCon({t:'poc',p:id,e:circ.id});for(let i=1;i<n;i++)addCon({t:'eq',e1:ls[0].id,e2:ls[i].id});
    const added=[];snapTie(s,vsx[0],added);
    sk.st={};finishOp(added);return;
  }
  if(t==='point'){
    const s=skSnap(q,tol,null,null);if(s.pid){toast('Bu konumda zaten bir nokta var.');return}
    skPush();const added=[];const id=resolvePt(s,added);f.pts[id].sp=true;finishOp(added);return;
  }
  if(t==='sfillet'){
    const h=skPtHit(q,tol);if(!h){toast('İki çizginin birleştiği köşe noktasına tıkla.');return}
    sketchFillet(h.id);return;
  }
  if(t==="trim"){trimAt(q,tol);return}
  if(t==="smartdim"){skDimClick(q,px,tol);return}
}
/* Çizim radyusu: köşede birleşen iki çizgi/yay arasına teğet yay ekler */
function sketchFillet(pid){
  const f=sk.feat;const es=f.ents.filter(e=>e.t!=='circle'&&!e.cons&&(e.a===pid||e.b===pid));
  if(es.length!==2){toast('Bu nokta tam olarak iki çizgiyi veya yayı birleştirmiyor.');return}
  const r=num(sk.opts.filletR);if(!(r>0)){toast('Geçerli bir yarıçap gir.');return}
  const P=P2(pid);
  // ofset eğrileri: çizgi için ±r kaydırılmış doğru, yay için R±r yarıçaplı daire
  const offs=e=>{if(e.t==='line'){const a=P2(e.a),b=P2(e.b);const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const d=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-d[1],d[0]];return [1,-1].map(k=>({l:true,a:[a[0]+n[0]*r*k,a[1]+n[1]*r*k],d}))}
    const c=P2(e.c),R=curveR(f,e);return [R+r,Math.abs(R-r)].filter(x=>x>1e-9).map(x=>({c,R:x}))};
  const lc=(g,h)=>{const w=[g.a[0]-h.c[0],g.a[1]-h.c[1]];const B=w[0]*g.d[0]+w[1]*g.d[1],C=w[0]*w[0]+w[1]*w[1]-h.R*h.R,D=B*B-C;if(D<0)return [];const q=Math.sqrt(D);return [-B-q,-B+q].map(t=>[g.a[0]+g.d[0]*t,g.a[1]+g.d[1]*t])};
  const isx=(g,h)=>{
    if(g.l&&h.l){const den=g.d[0]*h.d[1]-g.d[1]*h.d[0];if(Math.abs(den)<1e-12)return [];const t=((h.a[0]-g.a[0])*h.d[1]-(h.a[1]-g.a[1])*h.d[0])/den;return [[g.a[0]+g.d[0]*t,g.a[1]+g.d[1]*t]]}
    if(g.l)return lc(g,h);if(h.l)return lc(h,g);
    const dx=h.c[0]-g.c[0],dy=h.c[1]-g.c[1],d=Math.hypot(dx,dy);if(d<1e-9||d>g.R+h.R+1e-9||d<Math.abs(g.R-h.R)-1e-9)return [];
    const a=(g.R*g.R-h.R*h.R+d*d)/(2*d),hh=Math.sqrt(Math.max(0,g.R*g.R-a*a));const xm=g.c[0]+a*dx/d,ym=g.c[1]+a*dy/d;return [[xm+hh*dy/d,ym-hh*dx/d],[xm-hh*dy/d,ym+hh*dx/d]]};
  // teğet nokta ve öğe üzerinde olup olmadığı (köşe noktası hariç)
  const tanPt=(e,C)=>{
    if(e.t==='line'){const a=P2(e.a),b=P2(e.b);const dx=b[0]-a[0],dy=b[1]-a[1];const t=((C[0]-a[0])*dx+(C[1]-a[1])*dy)/(dx*dx+dy*dy);const T=[a[0]+dx*t,a[1]+dy*t];return t>-1e-9&&t<1+1e-9?T:null}
    const c=P2(e.c),R=curveR(f,e);const u=[C[0]-c[0],C[1]-c[1]],ul=Math.hypot(...u);if(ul<1e-12)return null;
    let T=[c[0]+u[0]/ul*R,c[1]+u[1]/ul*R];if(Math.abs(Math.hypot(T[0]-C[0],T[1]-C[1])-r)>1e-6*(1+r))T=[c[0]-u[0]/ul*R,c[1]-u[1]/ul*R];
    const A=arcInfo(f,e);let da=Math.atan2(T[1]-c[1],T[0]-c[0])-A.a0;while(da<0)da+=Math.PI*2;while(da>Math.PI*2)da-=Math.PI*2;return da<=A.sw+1e-9?T:null};
  let best=null;
  for(const g of offs(es[0]))for(const h of offs(es[1]))for(const C of isx(g,h)){
    const T1=tanPt(es[0],C),T2=tanPt(es[1],C);if(!T1||!T2)continue;
    const d1=Math.hypot(T1[0]-P[0],T1[1]-P[1]),d2=Math.hypot(T2[0]-P[0],T2[1]-P[1]);if(d1<1e-6||d2<1e-6)continue;
    // uzak uç noktasına ulaşmamalı
    const far=e=>P2(e.a===pid?e.b:e.a);const F1=far(es[0]),F2=far(es[1]);if(Math.hypot(T1[0]-F1[0],T1[1]-F1[1])<1e-6||Math.hypot(T2[0]-F2[0],T2[1]-F2[1])<1e-6)continue;
    if(!best||d1+d2<best.k)best={C,T1,T2,k:d1+d2};
  }
  if(!best){toast('Bu köşeye bu yarıçapla radyus eklenemiyor (yarıçap çok büyük veya öğeler teğet).');return}
  skPush();
  const {C,T1,T2}=best;const mk=p=>{const id=newId(f,'p');f.pts[id]={x:p[0],y:p[1]};return id};
  const t1=mk(T1),t2=mk(T2),cc=mk(C);
  for(const [e,t] of [[es[0],t1],[es[1],t2]]){if(e.a===pid)e.a=t;else e.b=t}
  // yay, köşeye bakan taraftan geçsin
  const a1=Math.atan2(T1[1]-C[1],T1[0]-C[0]);let sw=Math.atan2(T2[1]-C[1],T2[0]-C[0])-a1;while(sw<0)sw+=Math.PI*2;
  const mid=a1+sw/2,toP=[P[0]-C[0],P[1]-C[1]];const fw=Math.cos(mid)*toP[0]+Math.sin(mid)*toP[1]>0;
  const arc=addEnt(fw?{t:'arc',c:cc,a:t1,b:t2}:{t:'arc',c:cc,a:t2,b:t1});
  // köşeye bağlı ölçü ve ilişkiler korunur: köşe, iki öğenin uzantılarının kesiştiği sanal köşe noktası olarak kalır (SolidWorks gibi)
  // (merkez dikdörtgenin köşegeni gibi başka bir öğenin ucu olan köşe de sanal köşe olarak bağlı kalır)
  if(pid==='O'||f.cons.some(c=>CPK.some(k=>c[k]===pid))||f.ents.some(e=>!es.includes(e)&&(e.a===pid||e.b===pid||e.c===pid))){for(const e of es)addCon({t:e.t==='line'?'pol':'poc',p:pid,e:e.id})}
  else if(!f.ents.some(e=>e.a===pid||e.b===pid||e.c===pid))delete f.pts[pid];
  for(const e of es){if(e.t==='line')addCon({t:'tan',e1:e.id,e2:arc.id});else{const c=P2(e.c);const dd=Math.hypot(C[0]-c[0],C[1]-c[1]);addCon({t:'tan',e1:e.id,e2:arc.id,int:Math.abs(dd-Math.abs(curveR(f,e)-r))<Math.abs(dd-(curveR(f,e)+r))})}}
  const ul=Math.hypot(...toP)||1,lo=r+(sk.px?sk.px*30:r*0.6);
  // aynı araçla aynı yarıçapta eklenen sonraki radyuslar ilkine eşit bağlanır (tek ölçü hepsini sürer)
  const first=sk.filArc&&f.ents.find(e=>e.id===sk.filArc);
  if(first&&Math.abs(curveR(f,first)-r)<1e-9)addCon({t:'eq',e1:first.id,e2:arc.id});
  else{addCon({t:'drad',e:arc.id,val:r,lp:[C[0]+toP[0]/ul*lo,C[1]+toP[1]/ul*lo]});sk.filArc=arc.id}
  finishOp([]);
}

/* ---------- akıllı ölçülendirme ---------- */
function measure(c){return dimMeasure(sk.feat,c)}
function lineIntersect(e1,e2){const a=P2(e1.a),b=P2(e1.b),c=P2(e2.a),d=P2(e2.b);const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]];const den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den;return [a[0]+r[0]*t,a[1]+r[1]*t]}
function dimCandidate(q){
  const st=sk.st,f=sk.feat,E=entMap(f);const picks=st.picks||[];if(!picks.length)return null;
  const isCurve=h=>h.k==='ent'&&E[h.id]&&E[h.id].t!=='line';const isLine=h=>h.k==='ent'&&E[h.id]&&E[h.id].t==='line';
  const ptOf=h=>h.k==='pt'?h.id:(isCurve(h)?E[h.id].c:null);
  if(picks.length===1){
    const h=picks[0];
    if(isCurve(h)){const e=E[h.id];return {t:e.t==='circle'?'ddia':'drad',e:e.id}}
    if(isLine(h)){const e=E[h.id];return {t:'d',p:e.a,q:e.b,line:true}}
    return null;
  }
  const [h1,h2]=picks;
  if(isLine(h1)&&isLine(h2)){
    let e1=E[h1.id],e2=E[h2.id];const a=P2(e1.a),b=P2(e1.b),c=P2(e2.a),d=P2(e2.b);
    const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]];const cr=Math.abs(u[0]*v[1]-u[1]*v[0])/(Math.hypot(...u)*Math.hypot(...v));
    if(cr<1e-3){
      // merkez çizgisi ile ona paralel çizgi: ölçü eksenin öbür tarafına konursa çap ölçüsü olur (SolidWorks gibi)
      if(e2.cons&&!e1.cons){const t=e1;e1=e2;e2=t}
      const o={t:'dll',e1:e1.id,e2:e2.id};if(e1.cons&&!e2.cons&&q&&acrossAxis(e1,P2(e2.a),q))o.dia=true;return o}
    const X=lineIntersect(e1,e2);const w=q&&X?[q[0]-X[0],q[1]-X[1]]:[1,1];
    const un=s=>{const l=Math.hypot(...s);return [s[0]/l,s[1]/l]};const ua=un(u),vb=un(v);
    return {t:'dang',e1:e1.id,e2:e2.id,r1:(ua[0]*w[0]+ua[1]*w[1])<0,r2:(vb[0]*w[0]+vb[1]*w[1])<0};
  }
  if(isLine(h1)!==isLine(h2)){const L=isLine(h1)?h1:h2,O=isLine(h1)?h2:h1;const p=ptOf(O);if(!p)return null;
    const o={t:'dpl',p,e:L.id};if(E[L.id].cons&&q&&acrossAxis(E[L.id],P2(p),q))o.dia=true;return o}
  const p=ptOf(h1),r=ptOf(h2);if(!p||!r||p===r)return null;
  // nokta-nokta: imleç konumuna göre yatay / dikey / hizalı
  const a=P2(p),b=P2(r);let kind='d';
  if(q){const mnx=Math.min(a[0],b[0]),mxx=Math.max(a[0],b[0]),mny=Math.min(a[1],b[1]),mxy=Math.max(a[1],b[1]);const ox=q[0]<mnx||q[0]>mxx,oy=q[1]<mny||q[1]>mxy;
    if(Math.abs(a[0]-b[0])<1e-9)kind='dv';else if(Math.abs(a[1]-b[1])<1e-9)kind='dh';else if(oy&&!ox)kind='dh';else if(ox&&!oy)kind='dv';else kind='d'}
  return {t:kind,p,q:r};
}
/* q, eksenin (merkez çizgisi) A noktasının öbür tarafında mı (çap ölçüsü) */
function acrossAxis(ax,A,q){const a=P2(ax.a),b=P2(ax.b);const s=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);const sa=s(A),sq=s(q);
  return Math.abs(sa)>1e-9&&sa*sq<0}
/* akıllı ölçüde dış kenar ancak ilk seçim olarak veya tek başına ölçü vermeyen (nokta) seçimden sonra alınır; aksi hâlde tıklama ölçünün yeridir */
function dimRefOk(){const p=sk.st.picks||[];return !p.length||(p.length===1&&!dimCandidate(null))}
function skDimClick(q,px,tol){
  const st=sk.st;st.picks=st.picks||[];
  const h=skHit(q,tol)||(dimRefOk()?refAt(q,tol*0.7):null);
  if(h&&st.picks.length<2&&!st.picks.some(x=>x.k===h.k&&x.id===h.id)){
    const E=entMap(sk.feat);
    if(st.picks.length===0&&h.k==='ent'&&E[h.id].t!=='line'){st.picks=[h];sk.dirty=true;return}
    st.picks.push(h);sk.dirty=true;
    if(st.picks.length===2&&!dimCandidate(q)){toast('Bu iki öğe arasında ölçü verilemiyor.');st.picks=[];}
    return;
  }
  const c=dimCandidate(q);if(!c){st.picks=[];sk.dirty=true;return}
  delete c.line;c.lp=[q[0],q[1]];c.val=measure(c);
  const f=sk.feat;
  if(c.val<1e-9&&c.t!=='dang'){toast('Sıfır uzunlukta ölçü verilemez.');st.picks=[];return}
  // çizimi aşırı tanımlayan ölçü eklenmez: onu zaten belirleyen ölçü/ilişkiler sarı gösterilir, referans ölçü seçeneği sunulur
  const cf=sketchConflict(f,[c]);
  if(cf.over){st.picks=[];c.val=Math.round(c.val*1e4)/1e4;openConflict(c,cf);return}
  skPush();c.id=newId(f,'c');c.val=Math.round(c.val*1e4)/1e4;f.cons.push(c);solveSketch(f);
  st.picks=[];skChanged();
  dimPopWait=c.id;requestAnimationFrame(()=>{if(dimPopWait===c.id)openDimPop(c.id)});
}

/* ---------- ölçü düzenleme kutusu ---------- */
let dimPopEl=null,dimPopWait=null;
function closeDimPop(){if(dimPopEl){dimPopEl.remove();dimPopEl=null}}
/* yeni ölçünün kutusu sonraki karede açılır; o kareden önce yazılan tuş kaybolmasın: kutu hemen açılır, tuş kutuya yazılır */
function dimPopKey(e){
  if(!dimPopWait||!sk)return false;const cid=dimPopWait;openDimPop(cid);if(!dimPopEl)return false;
  const inp=dimPopEl.querySelector('input');e.preventDefault();
  if(e.key==='Enter')inp.dispatchEvent(new KeyboardEvent('keydown',{key:e.key,bubbles:true}));else inp.value=e.key;
  return true;
}
function openDimPop(cid){
  closeDimPop();dimPopWait=null;if(!sk||confEl)return;const c=sk.feat.cons.find(x=>x.id===cid);if(!c)return;
  if(c.driven){toast('Bu bir referans ölçü: değeri geometriden gelir.',{label:'Sürücü yap',fn:()=>setDriven(cid,false)});return}
  const s=skToScreen(c.lp[0],c.lp[1]);const el=document.createElement('div');el.className='pop';
  el.innerHTML=`<input inputmode="decimal" value="${String(Math.round(c.val*1e4)/1e4).replace('.',',')}" aria-label="Ölçü değeri" title="Dört işlem kullanılabilir, ör. 800/2 veya 5+(20+2)*3"><button class="ok" aria-label="Uygula">${IC.ok}</button><button aria-label="Kapat">${IC.x}</button>`;
  const r=vpEl.getBoundingClientRect();el.style.left=Math.max(4,Math.min(r.width-180,s[0]+10))+'px';el.style.top=Math.max(4,Math.min(r.height-50,s[1]+10))+'px';
  vpEl.appendChild(el);dimPopEl=el;const inp=el.querySelector('input');inp.focus();inp.select();
  const apply=()=>{const v=num(inp.value);if(!(isFinite(v)&&(v>0||(c.t==='dang'&&v>=0)))){inp.style.borderColor='var(--warn)';return}
    if(Math.abs(v-c.val)<1e-12||setDimVal(c.id,v)){closeDimPop();return}if(!dimPopEl){openDimPop(c.id);if(dimPopEl){const i=dimPopEl.querySelector('input');i.value=String(v).replace('.',',');i.style.borderColor='var(--warn)';i.select()}}else{inp.style.borderColor='var(--warn)';inp.select()}};
  el.querySelector('.ok').onclick=apply;el.querySelectorAll('button')[1].onclick=closeDimPop;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();apply()}if(e.key==='Escape'){e.stopPropagation();closeDimPop()}});
}
/* çizgi yönleri ve yay açıklıkları: ölçü değişikliğinde şeklin ters dönüp dönmediğini anlamak için */
function skShape(f){const o={};for(const e of f.ents){if(e.t==='line'){const a=skP(f,e.a),b=skP(f,e.b);o[e.id]=[b.x-a.x,b.y-a.y]}else if(e.t==='arc')o[e.id]=arcInfo(f,e).sw}return o}
function skFlipped(A,B){for(const id in A){const a=A[id],b=B[id];if(b===undefined)continue;
  if(Array.isArray(a)){if(Math.hypot(...a)>1e-9&&Math.hypot(...b)>1e-9&&a[0]*b[0]+a[1]*b[1]<0)return true}else if(Math.abs(a-b)>Math.PI/2)return true}return false}
/* ölçü değeri değiştirilir; çözülemiyorsa değer kademeli olarak yaklaştırılır (büyük değişikliklerde şekil ters dönmesin, çözüm bulunsun).
   Yine çözülemiyorsa eski değer kalır, çelişen ölçü ve ilişkiler sarı gösterilir. false: değer uygulanamadı */
function setDimVal(cid,v){
  const f=sk.feat;const c=f.cons.find(x=>x.id===cid);if(!c)return false;
  if(c.driven){toast('Bu bir referans ölçü: değeri geometriden gelir. Değiştirmek için önce sürücü ölçü yap.',{label:'Sürücü yap',fn:()=>setDriven(cid,false)});return false}
  skPush();const old=c.val;c.val=v;const shape0=skShape(f);
  let ok=solveSketch(f);
  // doğrudan çözüm şekli ters çevirdiyse (çizgi yön değiştirdi, yay diğer tarafa geçti) kademeli çözüm denenir
  const direct=ok&&skFlipped(shape0,skShape(f))?skData(f):null;
  if(!ok||direct){const snap=sk.hist[sk.hist.length-1];let good=false;
    for(const n of [4,16]){skRestore(snap);const c2=f.cons.find(x=>x.id===cid);let k=true;
      for(let i=1;i<=n&&k;i++){c2.val=old+(v-old)*i/n;k=solveSketch(f)}
      if(k&&!(direct&&skFlipped(shape0,skShape(f)))){good=true;break}}
    if(good)ok=true;else if(direct){skRestore(direct);ok=true}else ok=false}
  if(!ok){
    const bad=SOLVE_INFO.bad.filter(id=>id!==cid);skRestore(sk.hist.pop());updUndo();skChanged();
    setConf([cid,...bad]);
    const c0=f.cons.find(x=>x.id===cid);
    toast(`${dimText(Object.assign({},c0,{val:v}))} uygulanamadı: ${bad.length?'sarı işaretli ölçü ve ilişkilerle çelişiyor':'çizim bu değerle çözülemiyor'}. Değer ${dimText(c0)} olarak kaldı.`);
    return false;
  }
  // yeni çizimde ilk (tek) ölçü girilince görünüm çizimin gerçek boyutuna göre ayarlanır
  if(sk.isNew&&f.cons.filter(x=>DIMT.has(x.t)&&!x.driven).length===1)fitSketch();
  skChanged();return true;
}
/* çizim öğelerinin yerel sınır kutusu (orijin dahil) */
function skBox(f){let x0=0,y0=0,x1=0,y1=0;for(const e of f.ents)for(const p of tessEnt(f,e,36)){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}return {x0,y0,x1,y1}}
/* görünümü bakış yönünü değiştirmeden çizime sığdırır */
function fitSketch(withModel){
  if(!sk)return;const b=skBox(sk.feat);
  // istenirse modelin köşeleri de çizim düzlemine izdüşürülüp hesaba katılır
  if(withModel&&model.box){const B=model.box;for(const i of [0,1])for(const j of [0,1])for(const k of [0,1]){const w=[[B.min[0],B.max[0]][i]-sk.F.o[0],[B.min[1],B.max[1]][j]-sk.F.o[1],[B.min[2],B.max[2]][k]-sk.F.o[2]];const x=vd(w,sk.F.u),y=vd(w,sk.F.v);b.x0=Math.min(b.x0,x);b.x1=Math.max(b.x1,x);b.y0=Math.min(b.y0,y);b.y1=Math.max(b.y1,y)}}const r=Math.max(1,Math.hypot(b.x1-b.x0,b.y1-b.y0)/2)*1.25;
  const c=v3(fpt(sk.F,(b.x0+b.x1)/2,(b.y0+b.y1)/2));
  camTo(c,camera.position.clone().sub(controls.target).normalize(),r);
}

/* ---------- etiketler (ölçü değerleri ve ilişki simgeleri) ---------- */
let labelItems=[];
const lblEl=$('#labels');
lblEl.addEventListener('pointerdown',e=>{
  const t=e.target.closest('[data-cid]');if(!t||!sk)return;e.preventDefault();e.stopPropagation();
  const cid=t.dataset.cid;const c=sk.feat.cons.find(x=>x.id===cid);if(!c)return;
  if(t.classList.contains('dlab')&&(!sk.tool||sk.tool==='smartdim')){const q0=skLocalXY(e.clientX,e.clientY);sk.ldrag={cid,x:e.clientX,y:e.clientY,moved:false,q0,lp0:c.lp.slice(),pid:e.pointerId}}
  else{toggleSel({k:'con',id:cid})}
});
/* Etiket sürükleme pencere düzeyinde izlenir: etiketler her karede yeniden oluşturulduğundan etikete bağlı olay ve
   işaretçi yakalaması sürüklerken kaybolur (ölçü fareyi izlemez, bırakma kaçar ve ölçü sonra tıklamadan fareyle gelir) */
function lblDragMove(e){
  if(!sk||!sk.ldrag||e.pointerId!==sk.ldrag.pid)return;const d=sk.ldrag;
  // düğme bırakılmış (bırakma olayı pencere dışında kaldı): sürükleme biter
  if(!(e.buttons&1)){lblDragEnd(e,true);return}
  if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>4){d.moved=true;skPush()}
  if(d.moved){const q=skLocalXY(e.clientX,e.clientY);const c=sk.feat.cons.find(x=>x.id===d.cid);
    // tutulan yer etiketin merkezine atlamaz
    if(q&&c){c.lp=d.q0?[d.lp0[0]+q[0]-d.q0[0],d.lp0[1]+q[1]-d.q0[1]]:q;sk.dirty=true}}
}
function lblDragEnd(e,lost){
  if(!sk||!sk.ldrag||(e&&e.pointerId!==sk.ldrag.pid))return;const d=sk.ldrag;sk.ldrag=null;
  if(d.moved){sk.dirty=true;saveState()}else if(!lost&&e.type==='pointerup')toggleSel({k:'con',id:d.cid});
}
window.addEventListener('pointermove',lblDragMove);
window.addEventListener('pointerup',e=>lblDragEnd(e));
window.addEventListener('pointercancel',e=>lblDragEnd(e,true));
lblEl.addEventListener('dblclick',e=>{const t=e.target.closest('.dlab');if(t&&sk)openDimPop(t.dataset.cid)});
function placeLabels(){
  for(const it of labelItems){const s=skToScreen(it.x,it.y);it.el.style.left=s[0]+'px';it.el.style.top=s[1]+'px';it.el.style.display=s[2]>1?'none':''}
}

/* ---------- çizim görüntüsü ---------- */
function skColors(){const d=isDark();return {def:d?0xE8EDF2:0x10151C,und:d?0x6FA8FF:0x1A64E0,conf:d?0xFFD23F:0xD9A400,drv:d?0x8E99A6:0x6B7682,sel:0xF08A1A,hov:0xF0A845,prev:d?0x9CC3FF:0x3A7BE8,origin:0xD0453A,snap:0xF08A1A,guide:d?0xF2B84B:0xC97A0A,ref:d?0xC79BF2:REFCOL}}
const hex=c=>new T.Color(c);
function dimGeo(f,c,px){
  const E=entMap(f);const P=id=>{const p=skP(f,id);return [p.x,p.y]};const segs=[];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],un=a=>{const l=Math.hypot(a[0],a[1]);return l>1e-12?[a[0]/l,a[1]/l]:[1,0]};
  const ar=(tip,d)=>{const s=px*10,w=px*3.4,b=sub(tip,mul(d,s));segs.push([tip[0],tip[1],b[0]-d[1]*w,b[1]+d[0]*w],[tip[0],tip[1],b[0]+d[1]*w,b[1]-d[0]*w])};
  const ext=(A,Q)=>{const d=sub(Q,A),l=Math.hypot(d[0],d[1]);if(l<px*5)return;const u=mul(d,1/l);const s=add(A,mul(u,px*4)),e=add(Q,mul(u,px*7));segs.push([s[0],s[1],e[0],e[1]])};
  const lp=c.lp||[0,0];
  const linear=(A,B,Aq,Bq)=>{ext(A,Aq);ext(B,Bq);segs.push([Aq[0],Aq[1],Bq[0],Bq[1]]);const d=un(sub(Bq,Aq));ar(Aq,mul(d,-1));ar(Bq,d);
    const L=Math.hypot(...sub(Bq,Aq));const t=(lp[0]-Aq[0])*d[0]+(lp[1]-Aq[1])*d[1];if(t<0)segs.push([Aq[0],Aq[1],Aq[0]+d[0]*t,Aq[1]+d[1]*t]);if(t>L)segs.push([Bq[0],Bq[1],Aq[0]+d[0]*t,Aq[1]+d[1]*t])};
  const aligned=(A,B)=>{const d=un(sub(B,A)),n=[-d[1],d[0]];const off=(lp[0]-A[0])*n[0]+(lp[1]-A[1])*n[1];linear(A,B,add(A,mul(n,off)),add(B,mul(n,off)))};
  const foot=(e,p)=>{const a=P(e.a),b=P(e.b),d=un(sub(b,a));const t=(p[0]-a[0])*d[0]+(p[1]-a[1])*d[1];return add(a,mul(d,t))};
  let text=fmt(c.val,3);
  try{
  switch(c.t){
    case 'd':aligned(P(c.p),P(c.q));break;
    case 'dh':{const A=P(c.p),B=P(c.q);linear(A,B,[A[0],lp[1]],[B[0],lp[1]]);break}
    case 'dv':{const A=P(c.p),B=P(c.q);linear(A,B,[lp[0],A[1]],[lp[0],B[1]]);break}
    case 'dpl':{const A=P(c.p),F=foot(E[c.e],A);if(c.dia){aligned(A,sub(mul(F,2),A));text='Ø'+text}else aligned(A,F);break}
    case 'dll':{if(c.dia){const e2=E[c.e2],a=P(e2.a),d=un(sub(P(e2.b),a));const A=add(a,mul(d,(lp[0]-a[0])*d[0]+(lp[1]-a[1])*d[1]));
        const F=foot(E[c.e1],A);linear(A,sub(mul(F,2),A),A,sub(mul(F,2),A));text='Ø'+text;break}
      const A=P(E[c.e2].a);aligned(A,foot(E[c.e1],A));break}
    case 'doff':{const e1=E[c.e1],e2=E[c.e2];
      if(e1.t==='line'){const A=P(e2.a);aligned(A,foot(e1,A));break}
      const C=P(e1.c),d=un(sub(lp,C));const A=add(C,mul(d,curveR(f,e1))),B=add(C,mul(d,curveR(f,e2)));segs.push([A[0],A[1],B[0],B[1]]);const k=un(sub(B,A));ar(A,mul(k,-1));ar(B,k);
      const far=Math.max(curveR(f,e1),curveR(f,e2));if(Math.hypot(...sub(lp,C))>far){const Q=add(C,mul(d,far));segs.push([Q[0],Q[1],lp[0],lp[1]])}break}
    case 'ddia':case 'drad':{
      const e=E[c.e];const C=P(e.c),r=curveR(f,e);const d=un(sub(lp,C));const B=add(C,mul(d,r));
      if(c.t==='ddia'){const A=sub(C,mul(d,r));segs.push([A[0],A[1],B[0],B[1]]);ar(A,mul(d,-1));ar(B,d);text='Ø'+text}
      else{segs.push([C[0],C[1],B[0],B[1]]);ar(B,d);text='R'+text}
      if(Math.hypot(...sub(lp,C))>r)segs.push([B[0],B[1],lp[0],lp[1]]);break}
    case 'dang':{
      const e1=E[c.e1],e2=E[c.e2];const X=lineIntersect(e1,e2);text=fmt(c.val,2)+'°';if(!X)break;
      let a=un(sub(P(e1.b),P(e1.a))),b=un(sub(P(e2.b),P(e2.a)));if(c.r1)a=mul(a,-1);if(c.r2)b=mul(b,-1);
      const rr=Math.max(px*20,Math.hypot(...sub(lp,X)));let t0=Math.atan2(a[1],a[0]),t1=Math.atan2(b[1],b[0]);let sw=t1-t0;while(sw>Math.PI)sw-=2*Math.PI;while(sw<-Math.PI)sw+=2*Math.PI;
      const N=24;let prev=null;for(let i=0;i<=N;i++){const t=t0+sw*i/N;const p=[X[0]+rr*Math.cos(t),X[1]+rr*Math.sin(t)];if(prev)segs.push([prev[0],prev[1],p[0],p[1]]);prev=p}
      break}
  }}catch(err){}
  return {segs,text};
}
/* simgesi yalnızca seçimde gösterilen ilişkiler: çoğaltma/ofset bağları, yapı dairesi üstündeki noktalar (çokgen köşeleri)
   ve aynı öğeye bağlı eşitlik zincirleri (çokgen kenarları, çoğaltılmış kopyalar) */
function quietRel(f,c){
  if(QUIETREL.has(c.t)||(c.t==='fix'&&isRefPt(f,c.p)))return true;
  if(c.t==='poc'){const e=f.ents.find(x=>x.id===c.e);return !!(e&&e.cons)}
  if(c.t==='eq')return f.cons.filter(x=>x.t==='eq'&&(x.e1===c.e1||x.e2===c.e1)).length>2;
  return false;
}
function relAnchors(f,c,px){
  const E=entMap(f);const P=id=>{const p=skP(f,id);return [p.x,p.y]};const out=[];const off=px*13;
  const entMid=id=>{const e=E[id];if(!e)return null;if(e.t==='line'){const a=P(e.a),b=P(e.b);const d=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d)||1;return [(a[0]+b[0])/2-d[1]/l*off,(a[1]+b[1])/2+d[0]/l*off]}const C=P(e.c),r=curveR(f,e);let ang=Math.PI/4;if(e.t==='arc'){const A=arcInfo(f,e);ang=A.a0+A.sw/2}return [C[0]+(r+off)*Math.cos(ang),C[1]+(r+off)*Math.sin(ang)]};
  if(c.e&&!c.p)out.push(entMid(c.e));
  if(c.e1){out.push(entMid(c.e1));out.push(entMid(c.e2))}
  if(c.p&&!c.e1){const p=P(c.p);if(c.q){const q=P(c.q);out.push([(p[0]+q[0])/2+off*.6,(p[1]+q[1])/2+off*.6])}else out.push([p[0]+off*.8,p[1]+off*.8])}
  return out.filter(Boolean);
}
function entColor(e,C){
  const s=sk.sel.some(x=>x.k==='ent'&&x.id===e.id);if(s)return C.sel;if(sk.hover==='ent:'+e.id)return C.hov;
  if(e.ref)return C.ref;
  if(sk.confEnts&&sk.confEnts.has(e.id))return C.conf;
  const a=sk.an;if(!a)return C.und;
  const def=e.t==='line'?a.ptDef(e.a)&&a.ptDef(e.b):e.t==='circle'?a.ptDef(e.c)&&a.rDef(e.id):a.ptDef(e.c)&&a.ptDef(e.a)&&a.ptDef(e.b);
  return def?C.def:C.und;
}
function renderSketch(){
  if(!sk)return;updateDriven(sk.feat);
  for(const c of [...skGroup.children]){skGroup.remove(c);if(c.geometry)c.geometry.dispose();if(c.material&&c.material.dispose)c.material.dispose()}
  const f=sk.feat,C=skColors();const r=vpEl.getBoundingClientRect();
  const px=skPx(r.left+r.width/2,r.top+r.height/2);sk.px=px;
  const sol=[],solC=[],dash=[],dashC=[],pts=[],ptsC=[];
  const pushSeg=(arr,carr,a,b,col)=>{arr.push(a[0],a[1],0,b[0],b[1],0);const k=hex(col);carr.push(k.r,k.g,k.b,k.r,k.g,k.b)};
  for(const e of f.ents){
    const col=entColor(e,C);const t=tessEnt(f,e,72);const A=e.cons?dash:sol,AC=e.cons?dashC:solC;
    for(let i=0;i<t.length-1;i++)pushSeg(A,AC,t[i],t[i+1],col);
  }
  const usedPts=new Set();for(const e of f.ents)for(const k of ['a','b','c'])if(e[k])usedPts.add(e[k]);for(const id of Object.keys(f.pts))usedPts.add(id);
  for(const id of usedPts){if(id==='O')continue;const p=skP(f,id);if(!p)continue;const s=sk.sel.some(x=>x.k==='pt'&&x.id===id);const h=sk.hover==='pt:'+id;const col=s?C.sel:h?C.hov:(sk.an&&sk.an.ptDef(id)?C.def:C.und);pts.push(p.x,p.y,0);const k=hex(col);ptsC.push(k.r,k.g,k.b)}
  // orijin
  const L=px*28;pushSeg(sol,solC,[0,0],[L,0],C.origin);pushSeg(sol,solC,[0,0],[0,L],C.origin);
  pushSeg(sol,solC,[L,0],[L-px*7,px*3.5],C.origin);pushSeg(sol,solC,[L,0],[L-px*7,-px*3.5],C.origin);pushSeg(sol,solC,[0,L],[px*3.5,L-px*7],C.origin);pushSeg(sol,solC,[0,L],[-px*3.5,L-px*7],C.origin);
  {const s=sk.sel.some(x=>x.k==='pt'&&x.id==='O'),h=sk.hover==='pt:O';pts.push(0,0,0);const k=hex(s?C.sel:h?C.hov:C.origin);ptsC.push(k.r,k.g,k.b)}
  // ölçüler
  const labels=[];
  // aynı yere düşen ilişki simgeleri (ör. çizginin dikey ve yaya teğet ilişkisi) yan yana dizilir, üst üste binmez
  const relAt=new Map(),relPos=a=>{const k=Math.round(a[0]/(px*6))+','+Math.round(a[1]/(px*6));const n=relAt.get(k)||0;relAt.set(k,n+1);return [a[0]+n*px*17,a[1]]};
  for(const c of f.cons){
    if(DIMT.has(c.t)){
      const g=dimGeo(f,c,px);const s=sk.sel.some(x=>x.k==='con'&&x.id===c.id)||sk.hl===c.id;const cf=isConf(c.id);const col=s?C.sel:cf?C.conf:c.driven?C.drv:C.def;
      for(const q of g.segs)pushSeg(sol,solC,[q[0],q[1]],[q[2],q[3]],col);
      labels.push({x:c.lp[0],y:c.lp[1],cls:'dlab'+(s?' sel':cf?' conf':'')+(c.driven?' drv':''),cid:c.id,html:esc(c.driven?'('+g.text+')':g.text)});
    }else if(sk.opts.rels||sk.sel.length){
      const s=sk.sel.some(x=>x.k==='con'&&x.id===c.id);
      const involved=sk.sel.some(x=>(x.k==='ent'&&(c.e===x.id||c.e1===x.id||c.e2===x.id))||(x.k==='pt'&&(c.p===x.id||c.q===x.id)));
      const cf=isConf(c.id);
      if((!sk.opts.rels||quietRel(f,c))&&!involved&&!s&&!cf)continue;
      for(const a0 of relAnchors(f,c,px)){const a=relPos(a0);labels.push({x:a[0],y:a[1],cls:'rlab'+(s?' sel':cf?' conf':''),cid:c.id,html:esc((REL[c.t]||['',''])[1])})}
    }
  }
  // eklenmek istenen ve çelişen ölçü (çelişki penceresi açıkken)
  if(sk.confPend){const c=sk.confPend;const g=dimGeo(f,c,px);for(const q2 of g.segs)pushSeg(sol,solC,[q2[0],q2[1]],[q2[2],q2[3]],C.conf);labels.push({x:c.lp[0],y:c.lp[1],cls:'dlab conf pend',cid:'',html:esc(g.text)})}
  // araç önizlemesi
  const st=sk.st,q=sk.cursor;
  if(q&&sk.tool&&sk.tool!=='smartdim'&&sk.tool!=='sfillet'){
    const tol=px*9;const P=id=>P2(id);
    const pv=(a,b)=>pushSeg(sol,solC,a,b,C.prev);
    let s=null;
    if((sk.tool==='line'||sk.tool==='centerline')){s=skSnap(q,tol,st.start?P(st.start):null,null,st.start);if(st.start)(sk.tool==='centerline'?(dash.push(...P(st.start),0,s.x,s.y,0),dashC.push(...hexArr(C.prev),...hexArr(C.prev))):pv(P(st.start),[s.x,s.y]));
      if(s.hv||s.inf)labels.push({x:s.x+px*14,y:s.y+px*14,cls:'rlab',cid:'',html:s.hv?(s.hv==='h'?'—':'|'):(s.inf.t==='perp'?'⊥':'T')})}
    else if(sk.tool==='point')s=skSnap(q,tol,null,null);
    else if(sk.tool==='rect'||sk.tool==='crect'){s=skSnap(q,tol,null,st.A?new Set([st.A]):null);if(st.A){const A=P(st.A);let a,b;if(sk.tool==='rect'){a=A;b=[s.x,s.y]}else{a=[2*A[0]-s.x,2*A[1]-s.y];b=[s.x,s.y]}pv([a[0],a[1]],[b[0],a[1]]);pv([b[0],a[1]],[b[0],b[1]]);pv([b[0],b[1]],[a[0],b[1]]);pv([a[0],b[1]],[a[0],a[1]])}}
    else if(sk.tool==='circle'||sk.tool==='polygon'){s=skSnap(q,tol,null,st.c?new Set([st.c]):null);if(st.c){const c=P(st.c);const r=Math.hypot(s.x-c[0],s.y-c[1]);const n=sk.tool==='circle'?72:Math.max(3,Math.round(sk.opts.polyN)||6);const a0=Math.atan2(s.y-c[1],s.x-c[0]);let prev=null;for(let i=0;i<=n;i++){const t=a0+i*2*Math.PI/n;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}
    else if(sk.tool==='arc'){s=skSnap(q,tol,null,null);if(st.c&&!st.a)pv(P(st.c),[s.x,s.y]);if(st.c&&st.a){const c=P(st.c),a=P(st.a);const r=Math.hypot(a[0]-c[0],a[1]-c[1]);const a0=Math.atan2(a[1]-c[1],a[0]-c[0]);const acc=st.acc||0;const N=Math.max(4,Math.ceil(Math.abs(acc)/(Math.PI*2)*72));let prev=null;for(let i=0;i<=N;i++){const t=a0+acc*i/N;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}
    else if(sk.tool==='arc3'){s=skSnap(q,tol,null,null);if(st.a&&!st.b)pv(P(st.a),[s.x,s.y]);if(st.a&&st.b){const A=P(st.a),B=P(st.b);const C=circum(A,B,[s.x,s.y]);if(C){const t=arcPts(C,A,B,arcCcw(C,A,B,[s.x,s.y]));for(let i=0;i<t.length-1;i++)pv(t[i],t[i+1])}else pv(A,B)}}
    else if(sk.tool==='tarc'){s=skSnap(q,tol,null,st.start?new Set([st.start]):null);if(st.start){const g=tanArcGeo(st.start,st.ref,[s.x,s.y]);const A=P(st.start);if(g){const t=arcPts(g.c,A,[s.x,s.y],g.ccw);for(let i=0;i<t.length-1;i++)pv(t[i],t[i+1])}else pv(A,[s.x,s.y])}}
    else if(sk.tool==='slot'){s=skSnap(q,tol,st.c1&&!st.c2?P(st.c1):null,null);if(st.c1&&!st.c2)pv(P(st.c1),[s.x,s.y]);if(st.c1&&st.c2){const a=P(st.c1),b=P(st.c2);let d=[b[0]-a[0],b[1]-a[1]];const l=Math.hypot(...d);d=[d[0]/l,d[1]/l];const n=[-d[1],d[0]];const r=Math.abs((q[0]-a[0])*n[0]+(q[1]-a[1])*n[1]);pv([a[0]+n[0]*r,a[1]+n[1]*r],[b[0]+n[0]*r,b[1]+n[1]*r]);pv([a[0]-n[0]*r,a[1]-n[1]*r],[b[0]-n[0]*r,b[1]-n[1]*r]);const ba=Math.atan2(d[1],d[0]);for(const [c,o] of [[b,-Math.PI/2],[a,Math.PI/2]]){let prev=null;for(let i=0;i<=24;i++){const t=ba+o+Math.PI*i/24;const p=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];if(prev)pv(prev,p);prev=p}}}}
    if(s){pts.push(s.x,s.y,0);const k=hex(s.pid||s.rel||s.inf?C.snap:C.prev);ptsC.push(k.r,k.g,k.b);if(s.rel&&s.rel.t==='mid')labels.push({x:s.x+px*12,y:s.y+px*12,cls:'rlab',cid:'',html:'M'})
      // hiza yardımcı çizgileri (kesikli)
      for(const [a,b] of s.guides||[]){dash.push(a[0],a[1],0,b[0],b[1],0);dashC.push(...hexArr(C.guide),...hexArr(C.guide))}}
    // üzerinde durulan çizginin ekseni (geçici)
    const ax=sk.hoverAxis&&f.ents.find(e=>e.id===sk.hoverAxis);
    if(ax){const a=P(ax.a),b=P(ax.b),l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>1e-9){const d=[(b[0]-a[0])/l,(b[1]-a[1])/l],k=px*2000;dash.push(a[0]-d[0]*k,a[1]-d[1]*k,0,b[0]+d[0]*k,b[1]+d[1]*k,0);dashC.push(...hexArr(C.guide),...hexArr(C.guide))}}
  }
  // ofset / aynala / çoğaltma önizlemesi
  if(sk.op){const op=skOpPreview();if(op)for(const [a,b,cn] of op){if(cn){dash.push(a[0],a[1],0,b[0],b[1],0);dashC.push(...hexArr(C.prev),...hexArr(C.prev))}else pushSeg(sol,solC,a,b,C.prev)}}
  if(sk.extHover)for(const [a,b] of extHoverSegs(sk.extHover))pushSeg(sol,solC,a,b,C.hov);
  if(sk.extHover&&sk.extHover.t==='pt'){pts.push(sk.extHover.p[0],sk.extHover.p[1],0);ptsC.push(...hexArr(C.hov))}
  if(sk.ptrim&&sk.ptrim.path.length>1){const t=sk.ptrim.path;for(let i=0;i<t.length-1;i++)pushSeg(sol,solC,t[i],t[i+1],C.sel)}
  if(sk.tool==='smartdim'&&q){
    for(const h of (st.picks||[])){if(h.k==='ent'){const e=f.ents.find(x=>x.id===h.id);if(e){const t=tessEnt(f,e,72);for(let i=0;i<t.length-1;i++)pushSeg(sol,solC,t[i],t[i+1],C.sel)}}else{const p=P2(h.id);pts.push(p[0],p[1],0);const k=hex(C.sel);ptsC.push(k.r,k.g,k.b)}}
    const c=dimCandidate(q);if(c&&(st.picks||[]).length&&(c.t==='ddia'||c.t==='drad'||(st.picks.length===2)||c.line)){c.lp=q;try{c.val=measure(c);const g=dimGeo(f,c,px);for(const s2 of g.segs)pushSeg(sol,solC,[s2[0],s2[1]],[s2[2],s2[3]],C.prev);labels.push({x:q[0],y:q[1],cls:'dlab',cid:'',html:esc(g.text)})}catch(e){}}
  }
  // profil sorunları: kırmızı halkalı noktalar
  const bad=[];if(sk.issues&&sk.issues.n&&showIssues()){for(const id of [...sk.issues.open,...sk.issues.multi]){const p=skP(f,id);if(p)bad.push(p.x,p.y,0)}for(const p of sk.issues.cross)bad.push(p[0],p[1],0)}
  if(bad.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bad,3));const o=new T.Points(g,new T.PointsMaterial({size:13,sizeAttenuation:false,color:0xD0453A,depthTest:false,transparent:true,opacity:.75}));o.renderOrder=19;o.frustumCulled=false;skGroup.add(o)}
  if(sk.opts.grid)drawGrid(px);
  const mk=(arr,carr,mat)=>{if(!arr.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.setAttribute('color',new T.Float32BufferAttribute(carr,3));const o=new T.LineSegments(g,mat);if(mat.isLineDashedMaterial)o.computeLineDistances();o.renderOrder=20;o.frustumCulled=false;skGroup.add(o)};
  mk(sol,solC,new T.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true}));
  mk(dash,dashC,new T.LineDashedMaterial({vertexColors:true,depthTest:false,transparent:true,dashSize:px*8,gapSize:px*4}));
  if(pts.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setAttribute('color',new T.Float32BufferAttribute(ptsC,3));const o=new T.Points(g,new T.PointsMaterial({size:7,sizeAttenuation:false,vertexColors:true,depthTest:false,transparent:true}));o.renderOrder=21;o.frustumCulled=false;skGroup.add(o)}
  skGroup.updateMatrixWorld(true);
  // HTML etiketleri
  lblEl.innerHTML=labels.map((l,i)=>`<div class="${l.cls}" data-i="${i}" ${l.cid?`data-cid="${l.cid}"`:''} style="${l.cid?'':'pointer-events:none;'}">${l.html}</div>`).join('');
  labelItems=labels.map((l,i)=>({x:l.x,y:l.y,el:lblEl.children[i]}));placeLabels();
}
const hexArr=c=>{const k=hex(c);return [k.r,k.g,k.b]};
/* Görünür alana ızgara: ince çizgiler adımda, kalın çizgiler 10'un katlarında (yakalama ile aynı adım) */
function drawGrid(px){
  const r=renderer.domElement.getBoundingClientRect();
  const cs=[[r.left,r.top],[r.right,r.top],[r.left,r.bottom],[r.right,r.bottom]].map(([x,y])=>skLocalXY(x,y));if(cs.some(c=>!c))return;
  const st=gridStep(px),mj=gridMajor(st);
  const x0=Math.min(...cs.map(c=>c[0])),x1=Math.max(...cs.map(c=>c[0])),y0=Math.min(...cs.map(c=>c[1])),y1=Math.max(...cs.map(c=>c[1]));
  if((x1-x0)/st+(y1-y0)/st>1200)return;
  const mi=[],ma=[];
  for(let i=Math.ceil(x0/st);i*st<=x1;i++){const x=i*st;(Math.abs(x/mj-Math.round(x/mj))<1e-6?ma:mi).push(x,y0,0,x,y1,0)}
  for(let i=Math.ceil(y0/st);i*st<=y1;i++){const y=i*st;(Math.abs(y/mj-Math.round(y/mj))<1e-6?ma:mi).push(x0,y,0,x1,y,0)}
  const col=isDark()?0xE8EDF2:0x10151C;
  for(const [arr,op] of [[mi,.07],[ma,.16]]){if(!arr.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));
    const o=new T.LineSegments(g,new T.LineBasicMaterial({color:col,transparent:true,opacity:op,depthTest:false,depthWrite:false}));o.renderOrder=2;o.frustumCulled=false;skGroup.add(o)}
}
/* yay yardımcıları: üç noktadan merkez, yön, önizleme noktaları, teğet yay geometrisi */
function circum(A,B,M){const d=2*(A[0]*(B[1]-M[1])+B[0]*(M[1]-A[1])+M[0]*(A[1]-B[1]));if(Math.abs(d)<1e-9)return null;
  const a2=A[0]*A[0]+A[1]*A[1],b2=B[0]*B[0]+B[1]*B[1],m2=M[0]*M[0]+M[1]*M[1];
  return [(a2*(B[1]-M[1])+b2*(M[1]-A[1])+m2*(A[1]-B[1]))/d,(a2*(M[0]-B[0])+b2*(A[0]-M[0])+m2*(B[0]-A[0]))/d]}
function arcCcw(C,A,B,M){const an=p=>Math.atan2(p[1]-C[1],p[0]-C[0]);const w=a=>{while(a<0)a+=Math.PI*2;while(a>=Math.PI*2)a-=Math.PI*2;return a};const a0=an(A);return w(an(M)-a0)<w(an(B)-a0)}
function arcPts(C,A,B,ccw){const r=Math.hypot(A[0]-C[0],A[1]-C[1]);const a0=Math.atan2(A[1]-C[1],A[0]-C[0]),a1=Math.atan2(B[1]-C[1],B[0]-C[0]);let sw=a1-a0;
  if(ccw){while(sw<=0)sw+=Math.PI*2}else{while(sw>=0)sw-=Math.PI*2}const N=Math.max(4,Math.ceil(Math.abs(sw)/(Math.PI*2)*72));const out=[];for(let i=0;i<=N;i++){const t=a0+sw*i/N;out.push([C[0]+r*Math.cos(t),C[1]+r*Math.sin(t)])}return out}
function tanArcGeo(pid,refId,B){
  const f=sk.feat;const ref=f.ents.find(e=>e.id===refId);if(!ref)return null;const P=P2(pid);let d;
  if(ref.t==='line'){const o=P2(ref.a===pid?ref.b:ref.a);d=[P[0]-o[0],P[1]-o[1]]}
  else{const c=P2(ref.c);const n=[P[0]-c[0],P[1]-c[1]];d=ref.b===pid?[-n[1],n[0]]:[n[1],-n[0]]}
  const l=Math.hypot(...d);if(l<1e-12)return null;d=[d[0]/l,d[1]/l];const nl=[-d[1],d[0]];
  const w=[B[0]-P[0],B[1]-P[1]];const den=2*(nl[0]*w[0]+nl[1]*w[1]);if(Math.abs(den)<1e-9*(1+Math.hypot(...w)))return null;
  const t=(w[0]*w[0]+w[1]*w[1])/den;const c=[P[0]+nl[0]*t,P[1]+nl[1]*t];
  let int=false;if(ref.t==='arc'){const rc=P2(ref.c),R1=curveR(f,ref),R2=Math.abs(t);const dd=Math.hypot(c[0]-rc[0],c[1]-rc[1]);int=Math.abs(dd-Math.abs(R1-R2))<Math.abs(dd-(R1+R2))}
  return {c,ccw:t>0,int};
}
function renderSketchDisplays(){
  for(const c of [...sketchesGroup.children]){sketchesGroup.remove(c);if(c.geometry)c.geometry.dispose()}
  const cons=consumedMap();
  for(const f of state.features){
    if(f.type!=='sketch'||f.suppressed||(sk&&sk.feat===f))continue;
    const show=!cons[f.id]||(sel&&sel.kind==='feature'&&(sel.id===f.id||sel.id===cons[f.id]))||(pm&&pm.draft&&pm.draft.sketch===f.id);
    if(!show)continue;const F=model.frames[f.id];if(!F)continue;
    // eksen ve yapı (kesikli) çizgileri yalnızca çizim düzenlenirken görünür
    const arr=[];for(const e of f.ents){if(e.cons)continue;const t=tessEnt(f,e,64);for(let i=0;i<t.length-1;i++){arr.push(...fpt(F,t[i][0],t[i][1]),...fpt(F,t[i+1][0],t[i+1][1]))}}
    const sp=[];for(const id in f.pts)if(f.pts[id].sp)sp.push(...fpt(F,f.pts[id].x,f.pts[id].y));
    const col=(sel&&sel.kind==='feature'&&sel.id===f.id)?0xF08A1A:0x3D6FC2;
    if(sp.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(sp,3));const o=new T.Points(g,new T.PointsMaterial({color:col,size:6,sizeAttenuation:false,depthTest:false,transparent:true}));o.renderOrder=6;sketchesGroup.add(o)}
    if(!arr.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));
    const o=new T.LineSegments(g,new T.LineBasicMaterial({color:col,depthTest:false,transparent:true,opacity:.9}));o.renderOrder=6;sketchesGroup.add(o);
  }
}

/* ---------- çizim PropertyManager ---------- */
function itemName(h){
  if(h.k==='pt')return h.id==='O'?'Orijin':(sk.feat.pts[h.id]&&sk.feat.pts[h.id].sp?'Çizim noktası':'Nokta');
  if(h.k==='con'){const c=sk.feat.cons.find(x=>x.id===h.id);if(!c)return '?';return DIMT.has(c.t)?(c.driven?'Referans ölçü ('+fmt(c.val,3)+')':'Ölçü '+fmt(c.val,3)):(REL[c.t]||[c.t])[0]}
  const e=sk.feat.ents.find(x=>x.id===h.id);if(!e)return '?';if(e.ref)return e.t==='line'?'Referans kenar':e.t==='circle'?'Referans daire':'Referans yay';return e.t==='line'?(e.cons?'Merkez/yapı çizgisi':'Çizgi'):e.t==='circle'?(e.cons?'Yapı dairesi':'Daire'):'Yay';
}
function selGroups(){
  const E=entMap(sk.feat);const P=[],Ls=[],Cs=[],Cn=[];
  for(const h of sk.sel){if(h.k==='pt')P.push(h.id);else if(h.k==='con')Cn.push(h.id);else{const e=E[h.id];if(!e)continue;(e.t==='line'?Ls:Cs).push(e)}}
  return {P,Ls,Cs,Cn};
}
function availRels(){
  const {P,Ls,Cs}=selGroups();const out=[];const n=P.length+Ls.length+Cs.length;if(!n)return out;
  // yalnızca sabit referanslar seçiliyse verilecek ilişki yok
  if([...Ls,...Cs].every(e=>e.ref)&&P.every(id=>id==='O'||isRefPt(sk.feat,id)))return out;
  if(Ls.length&&!P.length&&!Cs.length){out.push('h','v');if(Ls.length>=2)out.push('par','eq');if(Ls.length===2)out.push('perp','coll')}
  if(P.length>=2&&!Ls.length&&!Cs.length){out.push('h','v');if(P.length===2)out.push('coin')}
  if(P.length===1&&Ls.length===1&&!Cs.length)out.push('coin','mid');
  if(P.length===2&&Ls.length===1&&!Cs.length)out.push('sym');
  if(Cs.length===2&&Ls.length===1&&!P.length)out.push('sym');
  if(P.length===1&&Cs.length===1&&!Ls.length)out.push('coin');
  if(Ls.length===1&&Cs.length===1&&!P.length)out.push('tan');
  if(Cs.length>=2&&!P.length&&!Ls.length){out.push('eq');if(Cs.length===2)out.push('conc','tan')}
  if((P.length||Ls.length||Cs.length)&&!(P.length===1&&P[0]==='O'&&n===1))out.push('fix');
  return out;
}
function renderSketchPM(){
  const el=$('#pm');if(!sk)return;const f=sk.feat;
  const dof=sk.an?sk.an.dof:null;
  const stc=sk.ok===false?'over':(dof===0?'full':'under');
  const stt=stc==='over'?'Aşırı tanımlı: çelişen ölçü/ilişkiler var':(dof===0?'Tam tanımlı':`Tam tanımlanmamış (${dof} serbestlik derecesi)`);
  let b=`<div class="grp"><div class="stat ${stc}"><i></i>${stt}</div><p class="note" style="margin-top:6px" data-tip="Mavi öğeler henüz tanımlanmamış, siyahlar tam tanımlı. Ölçü ve ilişki ekleyerek çizimi tam tanımla.">Mavi: tanımsız, siyah: tam tanımlı.</p></div>`;
  if(sk.unsat&&sk.unsat.length)b+=`<div class="grp"><p class="note confnote" data-tip="Sarı işaretli ölçü/ilişkiler aynı anda sağlanamıyor. Birini sil, değerini değiştir veya referans ölçü yap.">Sarı işaretli ${sk.unsat.length} ölçü/ilişki çelişiyor.</p></div>`;
  if(sk.issues&&sk.issues.n&&showIssues())b+=`<div class="grp"><p class="note warnnote"${tipA(issueHint(sk.issues))}>${esc(issueText(sk.issues))}</p></div>`;
  if(sk.op)b+=skOpBody();
  if(sk.tool){
    let o=TOOLSHORT[sk.tool]?`<p class="note">${esc(TOOLSHORT[sk.tool])}</p>`:'';
    if(sk.tool==='polygon')o+=fNum('Kenar sayısı','polyN','adet',sk.opts);
    if(sk.tool==='sfillet')o+=fNum('Radyus yarıçapı','filletR','mm',sk.opts);
    b+=grp('Etkin araç',o,TOOLHELP[sk.tool]);
  }
  if(sk.sel.length){
    const {P,Ls,Cs,Cn}=selGroups();
    b+=grp(`Seçili öğeler (${sk.sel.length})`,`<div class="lst">${sk.sel.map((h,i)=>`<div><span>${esc(itemName(h))}</span><button data-unsel="${i}" aria-label="Seçimden çıkar">✕</button></div>`).join('')}</div>`);
    const ids=new Set(sk.sel.map(h=>h.id));
    const ex=f.cons.filter(c=>!DIMT.has(c.t)&&(ids.has(c.e)||ids.has(c.e1)||ids.has(c.e2)||ids.has(c.p)||ids.has(c.q)));
    if(ex.length)b+=grp('Mevcut ilişkiler',`<div class="lst">${ex.map(c=>`<div><span>${esc((REL[c.t]||[c.t])[0])}</span><button data-delcon="${c.id}" aria-label="İlişkiyi sil">✕</button></div>`).join('')}</div>`);
    const av=availRels();
    if(av.length)b+=grp('İlişki ekle',`<div class="relbtns">${av.map(t=>`<button data-rel="${t}"><b>${esc(REL[t][1])}</b>${esc(REL[t][0])}</button>`).join('')}</div>`);
    let ops=`<div class="relbtns">`;if(Ls.length||Cs.length)ops+=`<button data-skop="cons">${IC.construction.replace('<svg','<svg width="14" height="14"')} Yapı geometrisi</button>`;
    if(Cn.length===1){const c=f.cons.find(x=>x.id===Cn[0]);if(c&&DIMT.has(c.t)){if(!c.driven)ops+=`<button data-skop="editdim">Değeri düzenle</button>`;if(c.t!=='doff')ops+=`<button data-skop="drv">${c.driven?'Sürücü ölçü yap':'Referans ölçü yap'}</button>`}}
    ops+=`<button data-skop="del" class="danger">Sil</button></div>`;b+=grp('İşlemler',ops);
  }else if(!sk.tool){
    b+=grp('Nasıl çalışır?',`<p class="note">Çiz, ölçülendir, ilişki ekle.</p>`,'1. Şeritten bir çizim aracı seç (Çizgi, Dikdörtgen, Daire…) ve yaklaşık şekli çiz.\n2. Akıllı Ölçülendirme ile ölçüleri gir.\n3. Seç aracıyla öğelere tıkla, gerekirse ilişki ekle (Yatay, Teğet, Eşit…).\n4. Çizim tam tanımlanınca Özellikler sekmesinden Ekstrüzyon, Kesme veya Döndürme seç.\n\nÇizim düzleme dik ve perspektifsiz (2B) görünür. Fare: orta veya sağ tuş kaydır, tekerlek yakınlaştır, F ekrana sığdır. Bir öğeye çift tıklamak bağlı zinciri seçer. Dokunmatik: iki parmakla kaydır ve yakınlaştır.\n\nArkadaki modelin bir kenarına veya başka bir çizimin öğesine tıklayınca o kenar referans olarak (mor, kesikli) seçilir; çizdiğin öğelerle birlikte seçip çakışık, paralel, teğet gibi ilişkiler ver ya da ölçülendir. Kullanılmayan referanslar çizimden çıkınca silinir.');
  }
  const dims=f.cons.filter(c=>DIMT.has(c.t));
  const dnm=dims.map(dimName),dup=n=>dnm.filter(x=>x===n).length>1;
  const hasDrv=dims.some(c=>c.driven);
  if(dims.length)b+=grp(`Ölçüler (${dims.length})`,`<div class="dimlist">${dims.map((c,i)=>`<label class="dimrow${sk.sel.some(h=>h.k==='con'&&h.id===c.id)||sk.hl===c.id?' on':''}${isConf(c.id)?' conf':''}${c.driven?' drv':''}" data-dimrow="${c.id}" title="${esc(dnm[i]+' – '+dimWhere(c)+(c.driven?' (referans ölçü)':''))}"><span>${esc(dnm[i])}${dup(dnm[i])?` <small>${esc(dimWhere(c))}</small>`:''}</span>${c.driven?`<input readonly tabindex="-1" aria-label="Referans ölçü" value="(${esc(fmt(c.val,3))})">`:`<input inputmode="decimal" autocomplete="off" data-dimin="${c.id}" value="${esc(String(Math.round(c.val*1e4)/1e4).replace('.',','))}">`}<em>${c.t==='dang'?'°':'mm'}</em>${c.t!=='doff'?`<button type="button" class="drvbtn" data-drv="${c.id}" title="${c.driven?'Sürücü ölçü yap':'Referans ölçü yap (geometriyi sürmez)'}" aria-label="${c.driven?'Sürücü ölçü yap':'Referans ölçü yap'}">${c.driven?'↺':'( )'}</button>`:''}</label>`).join('')}</div><p class="note">Değeri yaz, Enter'a bas.</p>`,'Değeri yazıp Enter\'a bas; çizim yeni ölçüye göre güncellenir. Satırın üzerine gelince ölçü çizimde turuncu görünür.'+(hasDrv?' Parantez içindeki referans ölçüler geometriyi sürmez, değerleri çizimden gelir.':''));
  else if(f.ents.length)b+=grp('Ölçüler',`<p class="note">Ölçü yok.</p>`,'Şeritten Tam Tanımla ile ölçüleri otomatik ekle veya Akıllı Ölçülendirme ile kendin ver.');
  b+=grp('Seçenekler',`<label class="chk"><input type="checkbox" data-opt="grid" ${sk.opts.grid?'checked':''}> Izgaraya yakala</label><label class="chk"><input type="checkbox" data-opt="rels" ${sk.opts.rels?'checked':''}> İlişki simgelerini göster</label><label class="chk"><input type="checkbox" data-opt="autodef" ${autoDefOn()?'checked':''}> Çizime girerken ve çıkarken eksik ölçüleri otomatik ekle</label>`);
  el.innerHTML=`<div class="pm-head"><div><div class="pm-title">${esc(f.name)}</div><div class="pm-sub">Çizim düzenleniyor</div></div><div class="pm-actions"><button class="ok" data-skx="ok" title="Çizimden çık" aria-label="Çizimden çık">${IC.ok}</button><button data-skx="cancel" title="Değişiklikleri at" aria-label="Değişiklikleri at">${IC.x}</button></div></div><div class="pm-body">${b}</div>`;
}
function skPmClick(e){
  if(sk.op&&skOpClick(e))return;
  const x=e.target.closest('[data-skx]');if(x){exitSketch(x.dataset.skx==='ok');return}
  const u=e.target.closest('[data-unsel]');if(u){sk.sel.splice(+u.dataset.unsel,1);skChanged();return}
  const dc=e.target.closest('[data-delcon]');if(dc){skPush();sk.feat.cons=sk.feat.cons.filter(c=>c.id!==dc.dataset.delcon);solveSketch(sk.feat);skChanged();return}
  const r=e.target.closest('[data-rel]');if(r){addRelation(r.dataset.rel);return}
  const dv=e.target.closest('[data-drv]');if(dv){e.preventDefault();const c=sk.feat.cons.find(x=>x.id===dv.dataset.drv);if(c)setDriven(c.id,!c.driven);return}
  const o=e.target.closest('[data-skop]');if(o){const k=o.dataset.skop;if(k==='cons')toggleConstruction();else if(k==='del')deleteSel();else if(k==='editdim'){const h=sk.sel.find(h=>h.k==='con');if(h)openDimPop(h.id)}else if(k==='drv'){const h=sk.sel.find(h=>h.k==='con');const c=h&&sk.feat.cons.find(x=>x.id===h.id);if(c)setDriven(c.id,!c.driven)}}
}
/* Ölçüler listesinde satırın üzerine gelince veya odaklanınca ölçüyü çizimde vurgula */
function setDimHl(cid){if(!sk||sk.hl===cid)return;sk.hl=cid;sk.dirty=true;$$('#pm .dimrow').forEach(r=>r.classList.toggle('on',r.dataset.dimrow===cid||sk.sel.some(h=>h.k==='con'&&h.id===r.dataset.dimrow)))}
for(const [ev,on] of [['mouseover',1],['focusin',1],['mouseout',0],['focusout',0]])$('#pm').addEventListener(ev,e=>{if(!sk)return;const r=e.target.closest('[data-dimrow]');
  if(on){if(r)setDimHl(r.dataset.dimrow)}else if(r&&!(e.relatedTarget&&r.contains(e.relatedTarget))){const fo=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#pm [data-dimrow]');setDimHl(fo?fo.dataset.dimrow:null)}});
function skPmInput(e){if(skOpInput(e))return;const t=e.target;if(t.dataset.k&&t.dataset.num){const v=num(t.value);if(isFinite(v))sk.opts[t.dataset.k]=v;sk.dirty=true}}
function skPmChange(e){
  if(skOpInput(e))return;const t=e.target;
  if(t.dataset.dimin){const v=num(t.value);const c=sk.feat.cons.find(x=>x.id===t.dataset.dimin);if(!c)return;if(!(isFinite(v)&&(v>0||(c.t==='dang'&&v>=0)))){t.classList.add('bad');return}if(Math.abs(v-c.val)>1e-9&&!setDimVal(c.id,v)){const t2=$(`#pm [data-dimin="${c.id}"]`);if(t2){t2.value=String(v).replace('.',',');t2.classList.add('bad')}}return}
  if(t.dataset.opt==='autodef'){setAutoDef(t.checked);if(t.checked)autoDefineSketch(true);return}
  if(t.dataset.opt){sk.opts[t.dataset.opt]=t.checked;sk.dirty=true}
}
/* aynı adı taşıyan ölçüleri ayırt etmek için ölçülen öğenin kısa tarifi */
function dimWhere(c){
  const f=sk.feat,E=entMap(f);const at=id=>{const p=skP(f,id);return `(${fmt(p.x,1)}; ${fmt(p.y,1)})`};
  const ptName=id=>{if(id==='O')return 'orijin';const e=f.ents.find(x=>x.t!=='line'&&x.c===id);return e?(e.t==='circle'?`Ø${fmt(2*e.r,2)} merkezi `:`R${fmt(curveR(f,e),2)} merkezi `)+at(id):'nokta '+at(id)};
  const entName=e=>{if(!e)return '';if(e.t==='line'){const a=skP(f,e.a),b=skP(f,e.b);return `çizgi (${fmt((a.x+b.x)/2,1)}; ${fmt((a.y+b.y)/2,1)})`}return ptName(e.c)};
  if(c.t==='d'){const l=f.ents.find(x=>x.t==='line'&&((x.a===c.p&&x.b===c.q)||(x.a===c.q&&x.b===c.p)));if(l)return entName(l)}
  if(c.q)return ptName(c.q);if(c.p)return ptName(c.p);if(c.e)return entName(E[c.e]);if(c.e2)return entName(E[c.e2]);return '';
}
function dimName(c){
  const E=entMap(sk.feat);const e=c.e&&E[c.e];
  switch(c.t){
    case 'doff':return 'Ofset mesafesi';
    case 'ddia':return e&&e.cons?'Çap (yapı)':'Çap';
    case 'drad':return 'Yarıçap';
    case 'dang':return 'Açı';
    case 'dh':return c.p==='O'?'Yatay konum':'Yatay mesafe';
    case 'dv':return c.p==='O'?'Dikey konum':'Dikey mesafe';
    case 'dpl':return c.dia?'Çap (eksene göre)':c.p==='O'?'Çizginin merkeze uzaklığı':'Nokta–çizgi mesafesi';
    case 'dll':return c.dia?'Çap (eksene göre)':'Paralel çizgi aralığı';
    case 'd':{const l=sk.feat.ents.find(x=>x.t==='line'&&((x.a===c.p&&x.b===c.q)||(x.a===c.q&&x.b===c.p)));return l?'Uzunluk':'Mesafe'}
  }
  return 'Ölçü';
}
function toggleConstruction(){
  const es=sk.sel.filter(h=>h.k==='ent');if(!es.length){toast('Önce çizgi veya daire seç.');return}
  skPush();for(const h of es){const e=sk.feat.ents.find(x=>x.id===h.id);if(e&&!e.ref)e.cons=!e.cons}skChanged();
}
function mergePts(f,keep,drop){
  for(const e of f.ents)for(const k of ['a','b','c'])if(e[k]===drop)e[k]=keep;
  for(const c of f.cons)for(const k of CPK)if(c[k]===drop)c[k]=keep;
  delete f.pts[drop];
  f.ents=f.ents.filter(e=>!(e.t==='line'&&e.a===e.b)&&!(e.t==='arc'&&(e.a===e.b||e.a===e.c)));
  f.cons=f.cons.filter(c=>!(c.p&&c.q&&c.p===c.q));
}
function addRelation(t){
  const f=sk.feat;const {P,Ls,Cs}=selGroups();skPush();const news=[];
  const add=c=>{c.id=newId(f,'c');news.push(c);f.cons.push(c)};
  if(t==='h'||t==='v'){if(Ls.length)Ls.forEach(l=>add({t,e:l.id}));else for(let i=1;i<P.length;i++)add({t,p:P[0],q:P[i]})}
  else if(t==='par'||t==='eq'){const A=Ls.length?Ls:Cs;for(let i=1;i<A.length;i++)add({t,e1:A[0].id,e2:A[i].id})}
  else if(t==='perp'||t==='coll')add({t,e1:Ls[0].id,e2:Ls[1].id});
  else if(t==='mid')add({t:'mid',p:P[0],e:Ls[0].id});
  else if(t==='sym'){if(P.length===2)add({t:'sym',p:P[0],q:P[1],e:Ls[0].id});else{add({t:'sym',p:Cs[0].c,q:Cs[1].c,e:Ls[0].id});add({t:'eq',e1:Cs[0].id,e2:Cs[1].id})}}
  else if(t==='tan'){if(Ls.length)add({t:'tan',e1:Ls[0].id,e2:Cs[0].id});else{const a=Cs[0],b=Cs[1];const c1=P2(a.c),c2=P2(b.c);const d=Math.hypot(c1[0]-c2[0],c1[1]-c2[1]);add({t:'tan',e1:a.id,e2:b.id,int:d<Math.max(curveR(f,a),curveR(f,b))})}}
  else if(t==='coin'){
    if(P.length===2){const [a,b]=P;if(b==='O')mergePts(f,'O',a);else mergePts(f,a,b)}
    else if(Ls.length)add({t:'pol',p:P[0],e:Ls[0].id});else add({t:'poc',p:P[0],e:Cs[0].id});
  }
  else if(t==='conc'){const a=Cs[0],b=Cs[1];if(a.c==='O')mergePts(f,'O',b.c);else if(b.c==='O')mergePts(f,'O',a.c);else mergePts(f,a.c,b.c)}
  else if(t==='fix'){const ps=new Set(P);for(const e of [...Ls,...Cs])for(const k of ['a','b','c'])if(e[k])ps.add(e[k]);ps.delete('O');for(const p of ps)if(!f.cons.some(c=>c.t==='fix'&&c.p===p))add({t:'fix',p})}
  // aşırı tanımlama denetimi
  if(news.length&&t!=='fix'){
    const base=f.cons.filter(c=>!news.includes(c));const tmp={...f,cons:base};const cf=sketchConflict(tmp,news);
    if(cf.add===0){skRestore(sk.hist.pop());updUndo();skChanged();
      if(cf.ids.length){setConf(cf.ids,news);toast(`${(REL[t]||[t])[0]} ilişkisi çizimi aşırı tanımlar: sarı işaretli ${cf.ids.length} ölçü/ilişki bunu zaten belirliyor. Gerekirse önce birini sil veya ölçüyü referans yap.`)}
      else toast('Bu ilişki zaten mevcut.');return}
  }
  if(!solveSketch(f)){const bad=SOLVE_INFO.bad.filter(id=>!news.some(c=>c.id===id));skRestore(sk.hist.pop());updUndo();skChanged();setConf(bad,news);
    toast(`${(REL[t]||[t])[0]} ilişkisi uygulanamadı: ${bad.length?'sarı işaretli ölçü ve ilişkilerle çelişiyor':'çizim çözülemiyor'}.`);return}
  sk.sel=[];skChanged();
}
function deleteSel(){
  if(!sk.sel.length)return;const f=sk.feat;skPush();
  const cons=new Set(),ents=new Set(),pts=new Set();
  for(const h of sk.sel){if(h.k==='con')cons.add(h.id);else if(h.k==='ent')ents.add(h.id);else if(h.id!=='O')pts.add(h.id)}
  for(const e of f.ents)if(pts.has(e.a)||pts.has(e.b)||pts.has(e.c))ents.add(e.id);
  f.ents=f.ents.filter(e=>!ents.has(e.id));
  f.cons=f.cons.filter(c=>!cons.has(c.id)&&!CPK.some(k=>pts.has(c[k])));
  for(const p of pts)delete f.pts[p];
  cleanupOrphans(f);sk.sel=[];solveSketch(f);skChanged();
  const ax=state.features.filter(x=>x.type==='revolve'&&x.sketch===f.id&&ents.has(x.axis));
  if(ax.length)toast(`Silinen çizgi “${ax.map(x=>x.name).join('”, “')}” özelliğinin döndürme ekseniydi. Yeni bir merkez çizgisi çizersen eksen olarak o kullanılır.`,{label:'Geri al',sk:true,fn:()=>{if(sk&&sk.feat===f)sketchUndo()}});
}
function updSbar(){
  if(!sk)return;const dof=sk.an?sk.an.dof:null;const el=$('#sbSt');
  if(dof===0){el.textContent='Tam tanımlı';el.className='st full'}else{el.textContent=`Tam tanımlanmamış (${dof})`;el.className='st under'}
  $('#sbTool').textContent=sk.tool?({line:'Çizgi',centerline:'Merkez çizgisi',rect:'Köşe dikdörtgen',crect:'Merkez dikdörtgen',circle:'Daire',arc:'Merkez nokta yay',slot:'Düz kanal',polygon:'Çokgen',point:'Nokta',arc3:'3 nokta yay',tarc:'Teğet yay',sfillet:'Çizim radyusu',smartdim:'Akıllı ölçülendirme',trim:'Budama'})[sk.tool]:'Seç';
}
