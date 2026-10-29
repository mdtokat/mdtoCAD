/* Ayarlar: performans ve grafik seçenekleri (tarayıcıda saklanır, projeye yazılmaz).
   Bu dosya diğer modüllerden önce yüklenir: 3B görüntüleyici (kenar yumuşatma, piksel oranı) ve geometri çekirdeği
   (eğri çözünürlüğü, yeniden oluşturma önbelleği) ilk hesaptan önce bu değerlerle kurulur. */
const SET_KEY='tocad-ayarlar-v1';
const SET_PRESETS={
  quality:{pixelRatio:'auto',antialias:true,renderMode:'continuous',curveSeg:64,cacheMB:256,previewDelay:120,dwRes:2048},
  balanced:{pixelRatio:'auto',antialias:true,renderMode:'smart',curveSeg:64,cacheMB:128,previewDelay:120,dwRes:1024},
  fast:{pixelRatio:1,antialias:false,renderMode:'smart',curveSeg:32,cacheMB:128,previewDelay:400,dwRes:1024}
};
const SET_OPTS={
  pixelRatio:['auto',1.5,1,0.75],antialias:[true,false],renderMode:['continuous','smart'],
  curveSeg:[64,48,32],cacheMB:[0,64,128,256,512],previewDelay:[60,120,400],dwRes:[2048,1024,512]
};
function loadSettings(){
  let o={};try{o=JSON.parse(localStorage.getItem(SET_KEY)||'{}')||{}}catch(e){o={}}
  const s={...SET_PRESETS.balanced,profile:'balanced'};
  for(const k in SET_OPTS)if(SET_OPTS[k].includes(o[k]))s[k]=o[k];
  if(['quality','balanced','fast','custom'].includes(o.profile))s.profile=o.profile;
  return s;
}
const SETTINGS=loadSettings();
function saveSettings(){try{localStorage.setItem(SET_KEY,JSON.stringify(SETTINGS))}catch(e){}}
const devPR=()=>Math.min(window.devicePixelRatio||1,2);
const pixelRatioOf=s=>s.pixelRatio==='auto'?devPR():Math.min(+s.pixelRatio,devPR());
/* çekirdeğe giden ayarlar: eğri çözünürlüğü önbellek anahtarına girer (farklı çözünürlükteki ara gövdeler karışmaz) */
function applyCoreSettings(){
  CURVE_SEG=SETTINGS.curveSeg;RB_CACHE.salt='s'+CURVE_SEG;
  rbCacheSet(SETTINGS.cacheMB>0?{on:true,budget:SETTINGS.cacheMB*2500}:{on:false});
}
applyCoreSettings();

/* ---------- ekran yenileme ---------- */
/* "Akıllı" kipte görünüm yalnızca bir şey değiştiğinde (kamera, girdi, sahne) tam hızla çizilir; boştayken saniyede 4 kare.
   Sürekli çizim dizüstü bilgisayarlarda ekran kartını ve işlemciyi boşuna meşgul ediyordu. */
let renderWanted=true,lastInputT=0,lastFrameT=0;
function requestRender(){renderWanted=true}
['pointerdown','pointermove','wheel','keydown','pointerup'].forEach(ev=>addEventListener(ev,()=>{lastInputT=performance.now()},{passive:true,capture:true}));
function shouldRender(camMoved){
  if(SETTINGS.renderMode==='continuous')return true;
  const now=performance.now();
  if(renderWanted||camMoved||now-lastInputT<1500||now-lastFrameT>250){renderWanted=false;lastFrameT=now;return true}
  return false;
}

/* ---------- performans bilgisi ---------- */
let perfRebuildMs=0;
function gpuInfo(){
  try{const gl=renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):String(gl.getParameter(gl.RENDERER))}catch(e){return ''}
}
const softGPU=s=>/swiftshader|llvmpipe|softpipe|basic render|software/i.test(s);

/* ---------- Ayarlar penceresi ---------- */
const SET_LABELS={
  pixelRatio:{auto:'Ekran',1.5:'1,5×',1:'1×',0.75:'0,75×'},
  antialias:{true:'Açık',false:'Kapalı'},
  renderMode:{continuous:'Sürekli',smart:'Akıllı'},
  curveSeg:{64:'Yüksek (64)',48:'Orta (48)',32:'Düşük (32)'},
  cacheMB:{0:'Kapalı',64:'64 MB',128:'128 MB',256:'256 MB',512:'512 MB'},
  previewDelay:{60:'Anında',120:'Normal',400:'Gecikmeli'},
  dwRes:{2048:'Yüksek',1024:'Normal',512:'Düşük'}
};
const SET_ROWS=[
  ['Görüntü',[
    ['pixelRatio','Çözünürlük (piksel oranı)','Yüksek yoğunluklu ekranlarda (4K, Retina) 1× seçmek ekran kartının yükünü 2–4 kat azaltır; görüntü biraz yumuşar.'],
    ['antialias','Kenar yumuşatma','Kapatmak zayıf ekran kartlarında kare hızını artırır; çizgi kenarları tırtıklı görünür. Sayfa yenilenince uygulanır.'],
    ['renderMode','Ekran yenileme','Akıllı: görünüm yalnızca bir şey değişince yeniden çizilir, boştayken neredeyse hiç kaynak harcanmaz. Sürekli: her karede çizer.']]],
  ['Hesaplama',[
    ['curveSeg','Eğri çözünürlüğü','Daire, yay, döndürme, delik ve radyuslar kaç parçayla yaklaşık çizilir. Düşük çözünürlük model hesabını 2–3 kat hızlandırır; eğriler köşeli görünür, hacim ve kütle binde birkaç değişir.'],
    ['cacheMB','Yeniden hesaplama önbelleği','Özellik ağacının ara sonuçları bellekte tutulur: yalnızca değişen özellik ve sonrası yeniden hesaplanır. Kapatmak her işlemde tüm ağacı baştan hesaplatır.'],
    ['previewDelay','Canlı önizleme','Özellik panelinde değer yazarken önizlemenin ne kadar bekleyip güncelleneceği. Ağır parçalarda “Gecikmeli” yazarken takılmayı önler.'],
    ['dwRes','Teknik resim gizli çizgi hassasiyeti','Görünüşlerde gizli/görünür çizgi ayrımının çözünürlüğü. Düşük, teknik resim sekmesini hızlandırır; çok küçük ayrıntılarda gizli çizgi hatası olabilir.']]]
];
function settingsBody(){
  const P=SETTINGS.profile;
  const seg=(k,vals)=>`<div class="seg">${vals.map(v=>`<button data-set="${k}" data-v="${esc(String(v))}" class="${String(SETTINGS[k])===String(v)?'on':''}">${esc(SET_LABELS[k]?SET_LABELS[k][v]:v)}</button>`).join('')}</div>`;
  let h=`<div class="set-sec"><div class="set-h">Performans profili</div>
    <div class="seg">${[['quality','Kalite'],['balanced','Dengeli'],['fast','Hızlı']].map(([k,l])=>`<button data-prof="${k}" class="${P===k?'on':''}">${l}</button>`).join('')}</div>
    <div class="note">${P==='custom'?'Özel ayarlar kullanılıyor.':P==='fast'?'Zayıf veya eski bilgisayarlar için: daha az ayrıntı, daha hızlı hesap ve çizim.':P==='quality'?'Güçlü bilgisayarlar için: en ince eğriler ve en keskin görüntü.':'Çoğu bilgisayar için önerilen ayarlar.'}</div></div>`;
  for(const [title,rows] of SET_ROWS){
    h+=`<div class="set-sec"><div class="set-h">${title}</div>`;
    for(const [k,label,note] of rows)h+=`<div class="set-row"><div class="set-l">${label}</div>${seg(k,SET_OPTS[k])}<div class="note">${note}</div></div>`;
    h+='</div>';
  }
  const g=gpuInfo(),C=RB_CACHE,mb=C.polys*400/1048576;
  const hr=C.hits+C.misses?Math.round(100*C.hits/(C.hits+C.misses)):0;
  h+=`<div class="set-sec"><div class="set-h">Performans bilgisi</div><div class="set-info">
    <span>Son yeniden hesaplama</span><span>${fmt(perfRebuildMs,0)} ms</span>
    <span>Etkin parçanın çokgen sayısı</span><span>${fmt(model.polys.length,0)}</span>
    <span>Önbellek</span><span>${C.on?`${C.map.size} ara durum, ≈${fmt(mb,0)} MB, isabet %${hr}`:'kapalı'}</span>
    <span>Piksel oranı</span><span>${fmt(renderer.getPixelRatio(),2)} (ekran ${fmt(window.devicePixelRatio||1,2)})</span>
    <span>Ekran kartı</span><span>${esc(g||'bilinmiyor')}</span></div>
    ${softGPU(g)?`<div class="set-warn">Tarayıcı ekran kartını kullanmıyor (yazılımsal çizim). Tarayıcı ayarlarında <b>donanım hızlandırmayı</b> açın; 3B görünüm ve teknik resim belirgin şekilde hızlanır.</div>`:''}
    <div class="set-acts"><button class="sbtn" data-set-act="clear">Önbelleği boşalt</button></div></div>`;
  return h;
}
function openSettings(){$('#setBody').innerHTML=settingsBody();$('#setDlg').classList.add('on');const b=$('#setDlg [data-set-close]');if(b)b.focus()}
function closeSettings(){$('#setDlg').classList.remove('on')}
const settingsOpen=()=>$('#setDlg').classList.contains('on');
/* değişen ayarlar hemen uygulanır (kenar yumuşatma hariç: görüntüleyici yeniden kurulmalı) */
function applySettingsChange(prev){
  const ch=k=>String(prev[k])!==String(SETTINGS[k]);
  saveSettings();
  if(ch('pixelRatio')){renderer.setPixelRatio(pixelRatioOf(SETTINGS));resize()}
  if(ch('antialias'))toast('Kenar yumuşatma sayfa yenilenince uygulanır.');
  if(ch('dwRes')){setDepthRes(SETTINGS.dwRes)}
  if(ch('curveSeg')||ch('cacheMB')){applyCoreSettings()}
  if(ch('curveSeg')){
    // tüm parçalar yeni çözünürlükle yeniden hesaplanır; montaj ve teknik resim önbellekleri de
    pcache.clear();setDepthRes(SETTINGS.dwRes,true);
    if(sk)exitSketch(true);closePM(true);
    rebuild();renderTree();renderPM();
    if(activeTab==='asm'){buildAsmView();const a=curAsm();if(a){a._unsolved=!solveAsm(a);updateAsmPoses()}}
    if(activeTab==='drawing')renderDrawing();
  }
  requestRender();
}
function setSetting(k,v){
  const prev={...SETTINGS};const opt=SET_OPTS[k].find(o=>String(o)===String(v));if(opt===undefined)return;
  SETTINGS[k]=opt;
  const m=Object.entries(SET_PRESETS).find(([,p])=>Object.keys(p).every(x=>String(p[x])===String(SETTINGS[x])));
  SETTINGS.profile=m?m[0]:'custom';
  applySettingsChange(prev);
}
function setProfile(name){
  const p=SET_PRESETS[name];if(!p)return;const prev={...SETTINGS};Object.assign(SETTINGS,p,{profile:name});applySettingsChange(prev);
}
