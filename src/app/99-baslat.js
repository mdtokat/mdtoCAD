/* Sekmeler, Dosya menüsü, içe/dışa aktarma, klavye kısayolları, başlatma ve test arayüzü (window.__tz). */
/* ================= SEKMELER, MENÜ, KLAVYE ================= */
function setTab(t){
  if(meas){meas=null;clearMeasure();prompt_(null)}
  if(t!=='model'){if(sk)exitSketch(true);if(pm)closePM(true);cancelPick()}
  if(t!=='asm'&&activeTab==='asm'){closeAsmPM(true,true);asmUI.tool=null;asmUI.drag=null;setControlsForSketch(false);prompt_(null)}
  const prev=activeTab;activeTab=t;
  if(t==='drawing'&&prev==='model')project.cur.dw={kind:'part',id:state.id};
  if(t==='drawing'&&prev==='asm'&&curAsm())project.cur.dw={kind:'asm',id:curAsm().id};
  $$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $('#modelTab').classList.toggle('on',t==='model'||t==='asm');$('#drawingTab').classList.toggle('on',t==='drawing');
  partRoot.visible=t==='model';asmRoot.visible=t==='asm';
  if(t==='drawing'){renderDrawRibbon();requestAnimationFrame(()=>renderDrawing(true));updUndo();return}
  setDimMode(false);setDwTool(null,true);
  if(t==='asm'){if(!curAsm()&&project.asms.length)project.cur.asm=project.asms[0].id;buildAsmView();const a=curAsm();if(a){a._unsolved=!solveAsm(a);updateAsmPoses()}}
  renderRibbon();renderTree();renderPM();updateStatus();updateMass();updUndo();
  if(prev!==t&&(t==='asm'||prev==='asm'))fitCamera(VIEWDIRS.iso,false);
  requestAnimationFrame(resize);
}
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
const menu=$('#fileMenu');
$('#fileBtn').onclick=e=>{e.stopPropagation();menu.classList.toggle('on')};
document.addEventListener('click',e=>{if(!e.target.closest('#fileMenu'))menu.classList.remove('on')});
let fileMode='open';
function showProject(o){
  project=o;state=project.parts.find(p=>p.id===project.cur.part)||project.parts[0];project.cur.part=state.id;
  pcache.clear();hist=histFor(state.id);sel=null;asmUI.sel=null;
  rebuild();if(activeTab==='asm')buildAsmView();renderTree();renderRibbon();renderPM();updateStatus();updateMass();updUndo();fitCamera(VIEWDIRS.iso,false);
  if(activeTab==='drawing')renderDrawing(true);
}
/* açık çizim önce kabul edilir (çalışma “Geri al” ile dönülebilecek projede kalır); yeni proje gösterilemezse önceki geri gelir */
function setProject(o,msg){
  if(sk)exitSketch(true);closePM(true);cancelPick();closeAsmPM(true,true);
  const prev=JSON.stringify(project,cleanR),old=project;
  // yerine geçecek proje açılmadan önce şu anki proje sürüm olarak saklanır (Dosya → Önceki sürümler)
  verSnap(prev,Date.now(),'Başka proje açılmadan önce');
  try{showProject(normProject(o))}
  catch(err){try{showProject(old)}catch(e){}throw err}
  // geçmişler kimlikle tutulur: aynı dosyayı yeniden açınca eski adımlar yeni projeye uygulanmasın
  histMap.clear();asmHists.clear();dwHists.clear();hist=histFor(state.id);updUndo();saveState();
  toast(msg,{label:'Geri al',fn:()=>setProject(JSON.parse(prev),'Önceki proje geri yüklendi.')});
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');if(!b)return;menu.classList.remove('on');const m=b.dataset.m;
  if(m==='new')setProject(emptyProject(),'Yeni proje açıldı. Bir düzlem seçip Çizim ile başla.');
  if(m==='demo')setProject(demoProject(),'Örnek proje yüklendi: 3 parça ve 1 montaj.');
  if(m==='save')saveProjectFile(false);
  if(m==='saveas')saveProjectFile(true);
  if(m==='versions')openRecovery();
  if(m==='open'||m==='importpart'){fileMode=m;$('#fileInput').accept=m==='open'?'.json,application/json':'.json,.stl,application/json';$('#fileInput').click()}
  if(m==='exportpart')saveFile(fileSafe(state.partName)+'.parca.json',JSON.stringify({app:'tocad',kind:'part',version:3,part:state},cleanR));
  if(m==='stlpart')exportPartSTL();
  if(m==='stlasm'){if(!curAsm()){toast('Projede montaj yok.');return}exportAsmSTL()}
  if(m==='pdf2')openPdfDialog('2d');
  if(m==='pdf3')openPdfDialog('3d');
  if(m==='settings')openSettings();
});
$('#setBtn').onclick=openSettings;
$('#setDlg').addEventListener('click',e=>{
  if(e.target.id==='setDlg'||e.target.closest('[data-set-close]')){closeSettings();return}
  const b=e.target.closest('[data-set]'),p=e.target.closest('[data-prof]'),a=e.target.closest('[data-set-act]');
  if(b)setSetting(b.dataset.set,b.dataset.v);
  else if(p)setProfile(p.dataset.prof);
  else if(a&&a.dataset.setAct==='clear'){rbCacheClear();RB_CACHE.hits=RB_CACHE.misses=0;toast('Önbellek boşaltıldı.')}
  else return;
  $('#setBody').innerHTML=settingsBody();
});
function importPartsFrom(o){
  let parts=[];
  if(o.kind==='part'&&o.part)parts=[o.part];
  else if(Array.isArray(o.parts))parts=o.parts;
  else if(Array.isArray(o.features))parts=[{partName:o.partName,material:o.material,features:o.features,drawing:o.drawing}];
  if(!parts.length)throw new Error('format');
  let last=null;for(const q of parts){const p=normPart(JSON.parse(JSON.stringify(q)));p.id=uid('P');p.partName=uniqueName(p.partName);project.parts.push(p);last=p}
  switchPart(last.id);if(activeTab==='asm')renderAsmTree();
  toast(parts.length>1?`${parts.length} parça içe aktarıldı.`:`“${last.partName}” içe aktarıldı.`);
}
$('#fileInput').addEventListener('change',e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;const rd=new FileReader();const isStl=/\.stl$/i.test(file.name);
  rd.onload=()=>{
    try{
      if(isStl){if(fileMode!=='importpart')throw new Error('format');importSTL(rd.result,file.name);return}
      const txt=typeof rd.result==='string'?rd.result:new TextDecoder().decode(rd.result);const o=JSON.parse(txt);
      if(fileMode==='open'){
        if(Array.isArray(o.parts))setProject(o,'Proje açıldı.');
        else if(Array.isArray(o.features))setProject({parts:[{partName:o.partName,material:o.material,features:o.features,drawing:o.drawing}],asms:[]},'Eski sürüm proje açıldı.');
        else if(o.kind==='part')setProject({parts:[o.part],asms:[]},'Parça dosyası proje olarak açıldı.');
        else throw new Error('format');
      }else importPartsFrom(o);
    }catch(err){console.error(err);toast(isStl?'STL dosyası okunamadı.':'Dosya okunamadı. toCAD proje veya parça dosyası (.json) seç.')}
  };
  rd.readAsArrayBuffer(file);e.target.value='';
});
document.addEventListener('keydown',e=>{
  if(askOpen()&&e.key!=='Escape')return;
  const ae=document.activeElement;const typing=ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if((e.ctrlKey||e.metaKey)&&!typing&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if((e.ctrlKey||e.metaKey)&&!typing&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
  // Ctrl+S: projeyi dosyaya kaydet (Ctrl+Shift+S: farklı kaydet)
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='s'){e.preventDefault();if(typing)ae.blur();saveProjectFile(e.shiftKey);return}
  if(e.key==='Escape'){
    menu.classList.remove('on');
    if(askOpen()){closeAsk();return}
    if($('#pdfDlg').classList.contains('on')){closePdfDialog();return}
    if(settingsOpen()){closeSettings();return}
    if(confEl){closeConflict();return}
    if(dimPopEl){closeDimPop();return}
    if(skInEl){closeSkInput();return}
    if(sizeEl){closeSizePop();return}
    if(meas){closeMeasure();return}
    if(activeTab==='drawing'){if(dwTool){if(SK2D.has(dwTool)&&dwSt.stage){dwSt={stage:0};dwTip();drawOverlay(null)}else setDwTool(null);return}if(dimMode){if(dimSt.stage!==0){dimSt={stage:0,p1:null,p2:null};updateDimTip();drawOverlay(null)}else setDimMode(false)}else if(dwSel)dwSelect(null);return}
    if(activeTab==='asm'){if(asmUI.pm){closeAsmPM();return}if(asmUI.tool){asmCmd(asmUI.tool==='move'?'amove':'arotate');return}if(asmUI.sel){asmUI.sel=null;asmHighlight();renderAsmTree()}return}
    if(sk&&(sk.conf||sk.confEnts)){clearConf();renderSketchPM();return}
    if(sk){const busy=Object.keys(sk.st).some(k=>sk.st[k]&&!(Array.isArray(sk.st[k])&&!sk.st[k].length));if(busy){endChainIfAny();sk.dirty=true}else if(sk.tool)setTool(null);else if(sk.sel.length){sk.sel=[];skChanged()}return}
    if(pickMode){cancelPick();renderTree();return}
    if(pm){closePM();return}
    if(sel){setSel(null)}
    return;
  }
  // Enter: özellik panelindeki bir alanda yazarken de değeri alıp özelliği onaylar
  const inPm=typing&&ae.tagName==='INPUT'&&ae.type!=='checkbox'&&!!ae.closest('#pm');
  if(e.key==='Enter'&&(!typing||inPm)&&activeTab==='asm'&&asmUI.pm&&asmUI.pm.type==='mate'){e.preventDefault();if(inPm)ae.blur();commitMate();return}
  if(e.key==='Enter'&&(!typing||inPm)&&activeTab==='asm'&&asmUI.pm&&asmUI.pm.type==='pat'){e.preventDefault();if(inPm)ae.blur();commitPat();return}
  if(e.key==='Enter'&&(!typing||inPm)&&pm&&!sk&&activeTab==='model'){e.preventDefault();if(inPm)ae.blur();commitPM();return}
  if((e.key==='Delete'||e.key==='Backspace')&&!typing&&activeTab==='drawing'){if(!dimMode&&!dwTool&&dwSel){e.preventDefault();dwDeleteSel()}return}
  if((e.key==='Delete'||e.key==='Backspace')&&!typing&&activeTab==='asm'){if(asmUI.sel&&!asmUI.pm){e.preventDefault();delComp(asmUI.sel)}return}
  if((e.key==='Delete'||e.key==='Backspace')&&!typing&&activeTab==='model'){
    if(sk){e.preventDefault();deleteSel();return}
    if(!pm&&sel&&sel.kind==='feature'){const b=$(`.ti[data-id="${sel.id}"] [data-a="del"]`);if(b)b.click()}
  }
  if(!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='f'&&activeTab!=='drawing'){e.preventDefault();fitView();return}
  // çizerken ölçü yazma: ilk noktadan sonra rakam yazınca giriş kutusu açılır
  if(sk&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/^[0-9.,(]$/.test(e.key)&&skInputFields()){e.preventDefault();openSkInput(e.key);return}
  // seçili öğenin boyut kutusu açıkken rakam yazılırsa kutuya yazılır
  if(sk&&sizeEl&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&/^[0-9.,(]$/.test(e.key)){e.preventDefault();focusSizePop(e.key);return}
  if(sk&&!typing&&!e.ctrlKey&&!e.metaKey){const k=e.key.toLowerCase();const map={l:'line',c:'circle',r:'rect',d:'smartdim',a:'arc',t:'trim',p:'point'};if(map[k]){setTool(map[k])}}
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(sk)sk.dirty=true});

(async()=>{try{if(window.claude&&typeof window.claude.use==='function'){dlCap=await window.claude.use('downloads')}}catch(e){dlCap=null}
  if(activeTab==='drawing')renderDrawRibbon()})();

/* başlat: kaydedilmiş proje gösterilemezse (bozuk kayıt) ayrı anahtarda saklanır ve örnek proje açılır */
renderHud();renderRibbon();resize();
try{rebuild();renderTree();renderPM()}
catch(err){console.error(err);try{const s=localStorage.getItem(LS_KEY);if(s)localStorage.setItem(LS_KEY+'-bozuk',s)}catch(e){}
  project=demoProject();state=project.parts.find(p=>p.id===project.cur.part)||project.parts[0];hist=histFor(state.id);
  rebuild();renderTree();renderPM();saveState();
  toast(`Kaydedilmiş proje açılamadı; örnek proje yüklendi. Önceki kayıt tarayıcıda “${LS_KEY}-bozuk” adıyla saklandı.`)}
updUndo();applyDisplay();
fitCamera(VIEWDIRS.iso,false);
loop();
recoverCheck();
window.__tz={get state(){return state},SETTINGS,setSetting,setProfile,openSettings,RB_CACHE,get camera(){return camera},get camBusy(){return !!camAnim},controls,refAt,extPick,parseScale,fitCamera,previewMate,openPatPM,commitPat,applyPats,hatchStyles,solidMesh,previewGroup,get project(){return project},get asmUI(){return asmUI},get asmView(){return asmView},sketchesGroup,get shown(){return shown},curAsm,solveAsm,pickEdge,click3D,openHolePM,openMeasure,get meas(){return meas},setSkOp,applySkOp,trimAt,skOpPreview,openSizePop,setEntSize,get sizeEl(){return sizeEl},skGuides,guideSnap,setExplode,openExplodePM,openInterfPM,openAsmDrawing,dwSrc,asmDof,openMatePM,addComp,asmPick,setMateType,commitMate,exportAsmSTL,stlBinary,makeZip,parseSTL,importSTL,switchPart,model,get sk(){return sk},get pm(){return pm},cmd,startSketch,editSketch,exitSketch,autoDefine,setTool,skEntColor:e=>entColor(e,skColors()),skColors,toolClick:(x,y)=>toolClick([x,y],sk.px||0.3,(sk.px||0.3)*9),openSkInput,applySkInput,sketchProfiles,sketchFaces,regionClick,setTab,openPM,commitPM,getCtx:()=>dctx,dwS:()=>dwS(),renderDrawing,dimClick,setDimMode,setDwTool,dwToolClick,dwSelect,dwDeleteSel,dwHitAt,dwDragMove,dwDragEnd,exportDXFString,buildDXF,get dwSel(){return dwSel},get dimSt(){return dimSt},openPdfDialog,makePdf,buildPdf,svgToPdfOps,build3DPage,buildSheet,pdfOpt,solveSketch,analyzeSketch,sketchConflict,sketchUnsat,SOLVE_INFO,setDriven,get confEl(){return confEl},setDimVal,addRelation,selectItems:(a)=>{sk.sel=a;skChanged()},rebuildModel,writeState,flushState,openRecovery,verSnapNow,recoverCheck,idbDo,saveProjectFile,get lsOk(){return lsOk},scr:(x,y)=>{camera.updateMatrixWorld();const s=skToScreen(x,y);const r=renderer.domElement.getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]},scrW:(p)=>{camera.updateMatrixWorld();const s=toScreen(p);const r=renderer.domElement.getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]}};
