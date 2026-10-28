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
function setProject(o,msg){
  const prev=JSON.stringify(project,cleanR);
  if(sk)exitSketch(false);closePM(true);cancelPick();closeAsmPM(true,true);
  project=normProject(o);state=project.parts.find(p=>p.id===project.cur.part)||project.parts[0];project.cur.part=state.id;
  histMap.clear();asmHists.clear();pcache.clear();hist=histFor(state.id);sel=null;asmUI.sel=null;
  rebuild();if(activeTab==='asm')buildAsmView();renderTree();renderRibbon();renderPM();updateStatus();updateMass();updUndo();saveState();fitCamera(VIEWDIRS.iso,false);
  if(activeTab==='drawing')renderDrawing(true);
  toast(msg,{label:'Geri al',fn:()=>setProject(JSON.parse(prev),'Önceki proje geri yüklendi.')});
}
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');if(!b)return;menu.classList.remove('on');const m=b.dataset.m;
  if(m==='new')setProject(emptyProject(),'Yeni proje açıldı. Bir düzlem seçip Çizim ile başla.');
  if(m==='demo')setProject(demoProject(),'Örnek proje yüklendi: 3 parça ve 1 montaj.');
  if(m==='save')saveFile(fileSafe(state.partName)+'-proje.tezgah.json',JSON.stringify({app:'tezgah-cad',...project,version:3},cleanR));
  if(m==='open'||m==='importpart'){fileMode=m;$('#fileInput').accept=m==='open'?'.json,application/json':'.json,.stl,application/json';$('#fileInput').click()}
  if(m==='exportpart')saveFile(fileSafe(state.partName)+'.parca.json',JSON.stringify({app:'tezgah-cad',kind:'part',version:3,part:state},cleanR));
  if(m==='stlpart')exportPartSTL();
  if(m==='stlasm'){if(!curAsm()){toast('Projede montaj yok.');return}exportAsmSTL()}
  if(m==='pdf2')openPdfDialog('2d');
  if(m==='pdf3')openPdfDialog('3d');
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
    }catch(err){console.error(err);toast(isStl?'STL dosyası okunamadı.':'Dosya okunamadı. Tezgâh CAD proje veya parça dosyası (.json) seç.')}
  };
  rd.readAsArrayBuffer(file);e.target.value='';
});
document.addEventListener('keydown',e=>{
  const ae=document.activeElement;const typing=ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName);
  if((e.ctrlKey||e.metaKey)&&!typing&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if((e.ctrlKey||e.metaKey)&&!typing&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
  if(e.key==='Escape'){
    menu.classList.remove('on');
    if($('#pdfDlg').classList.contains('on')){closePdfDialog();return}
    if(dimPopEl){closeDimPop();return}
    if(meas){closeMeasure();return}
    if(activeTab==='drawing'){if(dwTool){setDwTool(null);return}if(dimMode){if(dimSt.stage>0){dimSt={stage:0,p1:null,p2:null};updateDimTip();drawOverlay(null)}else setDimMode(false)}return}
    if(activeTab==='asm'){if(asmUI.pm){closeAsmPM();return}if(asmUI.tool){asmCmd(asmUI.tool==='move'?'amove':'arotate');return}if(asmUI.sel){asmUI.sel=null;asmHighlight();renderAsmTree()}return}
    if(sk){const busy=Object.keys(sk.st).some(k=>sk.st[k]&&!(Array.isArray(sk.st[k])&&!sk.st[k].length));if(busy){endChainIfAny();sk.dirty=true}else if(sk.tool)setTool(null);else if(sk.sel.length){sk.sel=[];skChanged()}return}
    if(pickMode){cancelPick();renderTree();return}
    if(pm){closePM();return}
    if(sel){setSel(null)}
    return;
  }
  if(e.key==='Enter'&&!typing&&activeTab==='asm'&&asmUI.pm&&asmUI.pm.type==='mate'){e.preventDefault();commitMate();return}
  if(e.key==='Enter'&&!typing&&pm){e.preventDefault();commitPM();return}
  if((e.key==='Delete'||e.key==='Backspace')&&!typing&&activeTab==='asm'){if(asmUI.sel&&!asmUI.pm){e.preventDefault();delComp(asmUI.sel)}return}
  if((e.key==='Delete'||e.key==='Backspace')&&!typing&&activeTab==='model'){
    if(sk){e.preventDefault();deleteSel();return}
    if(!pm&&sel&&sel.kind==='feature'){const b=$(`.ti[data-id="${sel.id}"] [data-a="del"]`);if(b)b.click()}
  }
  if(sk&&!typing&&!e.ctrlKey&&!e.metaKey){const k=e.key.toLowerCase();const map={l:'line',c:'circle',r:'rect',d:'smartdim',a:'arc',t:'trim'};if(map[k]){setTool(map[k])}}
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(sk)sk.dirty=true});

(async()=>{try{if(window.claude&&typeof window.claude.use==='function'){dlCap=await window.claude.use('downloads')}}catch(e){dlCap=null}
  if(activeTab==='drawing')renderDrawRibbon()})();

/* başlat */
renderHud();renderRibbon();resize();
rebuild();renderTree();renderPM();updUndo();applyDisplay();
fitCamera(VIEWDIRS.iso,false);
loop();
window.__tz={get state(){return state},get project(){return project},get asmUI(){return asmUI},get asmView(){return asmView},get shown(){return shown},curAsm,solveAsm,pickEdge,click3D,openHolePM,openMeasure,get meas(){return meas},setSkOp,applySkOp,trimAt,setExplode,openExplodePM,openInterfPM,openAsmDrawing,dwSrc,asmDof,openMatePM,addComp,asmPick,setMateType,commitMate,exportAsmSTL,stlBinary,makeZip,parseSTL,importSTL,switchPart,model,get sk(){return sk},get pm(){return pm},cmd,startSketch,editSketch,exitSketch,autoDefine,setTool,toolClick:(x,y)=>toolClick([x,y],sk.px||0.3,(sk.px||0.3)*9),setTab,openPM,commitPM,getCtx:()=>dctx,openPdfDialog,makePdf,buildPdf,svgToPdfOps,build3DPage,buildSheet,pdfOpt,solveSketch,analyzeSketch,setDimVal,addRelation,selectItems:(a)=>{sk.sel=a;skChanged()},rebuildModel,scr:(x,y)=>{const s=skToScreen(x,y);const r=renderer.domElement.getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]},scrW:(p)=>{const s=toScreen(p);const r=renderer.domElement.getBoundingClientRect();return [s[0]+r.left,s[1]+r.top]}};
