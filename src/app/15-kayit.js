/* Veri kaybına karşı koruma: otomatik kayıt tarayıcı deposunun (localStorage) yanında tarayıcı veritabanına (IndexedDB,
   diske hemen yazılan “strict” işlemle) de yazılır; birkaç dakikada bir ve projeyi değiştiren işlemlerden önce sürüm saklanır
   (Dosya → Önceki sürümler). Aynı proje iki sekmede açıksa uyarılır. Ctrl+S projeyi dosyaya kaydeder. */
const TAB_ID=Math.random().toString(36).slice(2,10);
const SNAP_EVERY=3*60*1000,SNAP_MAX=40,SNAP_BYTES=60e6;
let idbP=null,idbOk=null,snapT=0,snapJson='',fileHandle=null,otherWarned=false;
function idbOpen(){
  if(idbP)return idbP;
  idbP=new Promise((res,rej)=>{try{const r=indexedDB.open('tocad',1);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('snaps'))d.createObjectStore('snaps',{keyPath:'t'})};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'))}catch(e){rej(e)}});
  idbP.catch(()=>{});return idbP;
}
/* tek işlem: fn(store) bir istek döndürürse sonucu verilir; strict: işlem diske yazılınca tamamlanır (elektrik kesintisine karşı) */
function idbDo(name,mode,fn,strict){
  return idbOpen().then(d=>new Promise((res,rej)=>{let tx;try{tx=d.transaction(name,mode,strict?{durability:'strict'}:undefined)}catch(e){tx=d.transaction(name,mode)}
    let out;const r=fn(tx.objectStore(name));if(r)r.onsuccess=()=>{out=r.result};tx.oncomplete=()=>res(out);tx.onerror=tx.onabort=()=>rej(tx.error)}));
}
function projSummary(o){
  const parts=(o.parts||[]).map(p=>p.partName);const nf=(o.parts||[]).reduce((s,p)=>s+(p.features||[]).length,0);
  return `${parts.length} parça (${parts.slice(0,4).join(', ')}${parts.length>4?'…':''}), ${(o.asms||[]).length} montaj, ${nf} öğe`;
}
/* writeState her yazımda çağırır */
function backupState(json,t){
  if(typeof indexedDB==='undefined')return;
  idbDo('kv','readwrite',s=>s.put({t,json,tab:TAB_ID},'project'),true).then(()=>{if(idbOk!==true){idbOk=true;askPersist()}},()=>{idbOk=false});
  if(t-snapT>=SNAP_EVERY&&json!==snapJson)verSnap(json,t,'');
}
/* sürüm saklar (json: projenin metni) */
function verSnap(json,t,why){
  if(typeof indexedDB==='undefined')return Promise.resolve();snapT=t;snapJson=json;
  let sum='';try{sum=projSummary(JSON.parse(json))}catch(e){}
  return idbDo('snaps','readwrite',s=>s.put({t,json,why:why||'',tab:TAB_ID,sum})).then(pruneSnaps).catch(()=>{});
}
/* projeyi değiştiren işlemden (yeni proje, dosya açma, parça silme…) önce o anki proje sürüm olarak saklanır */
function verSnapNow(why){try{return verSnap(JSON.stringify(project,cleanR),Date.now(),why)}catch(e){return Promise.resolve()}}
function pruneSnaps(){
  return idbDo('snaps','readonly',s=>s.getAll()).then(list=>{
    list.sort((a,b)=>b.t-a.t);let bytes=0;const drop=[];
    list.forEach((x,i)=>{bytes+=x.json.length;if(i>=SNAP_MAX||bytes>SNAP_BYTES)drop.push(x.t)});
    if(drop.length)return idbDo('snaps','readwrite',s=>{for(const t of drop)s.delete(t)});
  });
}
/* tarayıcı, yer darlığında site verisini silmesin */
function askPersist(){try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}}
/* açılışta: tarayıcı deposu yazılamamışsa (dolu) veya bozuksa veritabanındaki daha yeni kayıt geri getirilir */
function recoverCheck(){
  if(typeof indexedDB==='undefined')return Promise.resolve();
  return idbDo('kv','readonly',s=>s.get('project')).then(rec=>{
    if(!rec||!rec.json)return;let lt=0;try{lt=+localStorage.getItem(LS_KEY+'-t')||0}catch(e){}
    if(!(loadFailed||rec.t>lt+1000))return;
    let o;try{o=JSON.parse(rec.json)}catch(e){return}
    if(!o||!Array.isArray(o.parts)||!o.parts.length)return;
    const when=new Date(rec.t).toLocaleString('tr-TR');
    const busy=hist.undo.length||sk||pm||activeTab!=='model';
    if(busy){toast(`Tarayıcı veritabanında daha yeni bir kayıt var (${when}).`,{label:'Geri yükle',fn:()=>restoreProject(o,`Kayıt geri yüklendi (${when}).`)});return}
    restoreProject(o,`Son çalışman tarayıcı veritabanından geri yüklendi (${when}).`);
  }).catch(()=>{});
}
function restoreProject(o,msg){verSnapNow('Geri yüklemeden önce');setProject(o,msg)}
function fmtWhen(t){const d=new Date(t),now=new Date();const tm=d.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===now.toDateString()?'Bugün '+tm:d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})+' '+tm}
function openRecovery(){
  menu.classList.remove('on');
  idbDo('snaps','readonly',s=>s.getAll()).then(list=>{
    list.sort((a,b)=>b.t-a.t);
    const rows=list.map(x=>`<div class="recrow"><div class="recinfo"><b>${esc(fmtWhen(x.t))}</b><small>${esc(x.sum||'')}${x.why?' · '+esc(x.why):''}${x.tab!==TAB_ID?' · başka sekme veya oturum':''}</small></div><button class="sbtn" data-rec-open="${x.t}">Aç</button><button class="sbtn" data-rec-dl="${x.t}" title="Dosya olarak indir">İndir</button></div>`).join('');
    ask('Önceki sürümler',`<p class="note">Proje değiştikçe birkaç dakikada bir ve yeni proje açma, dosya açma, parça/montaj silme gibi işlemlerden önce bir sürüm saklanır (son ${SNAP_MAX}). Bir sürümü açınca şu anki proje de sürüm olarak saklanır; “Geri al” ile dönülebilir.</p>${list.length?`<div class="reclist">${rows}</div>`:'<p class="note">Henüz saklanmış sürüm yok.</p>'}`,[{label:'Kapat',primary:true}]);
    $('#askMsg').onclick=e=>{const o=e.target.closest('[data-rec-open]'),d=e.target.closest('[data-rec-dl]');const x=list.find(k=>String(k.t)===(o||d||{dataset:{}}).dataset[o?'recOpen':'recDl']);if(!x)return;
      if(o){closeAsk();let p;try{p=JSON.parse(x.json)}catch(err){toast('Sürüm okunamadı.');return}restoreProject(p,`Sürüm açıldı: ${fmtWhen(x.t)}.`)}
      else saveFile('tocad-surum-'+new Date(x.t).toISOString().slice(0,16).replace(/[:T]/g,'-')+'.tocad.json',x.json)};
  }).catch(()=>toast('Tarayıcı veritabanı kullanılamıyor; sürüm geçmişi yok. Projeyi Ctrl+S ile dosyaya kaydet.'));
}
/* Ctrl+S: tarayıcı izin veriyorsa seçilen dosyanın üzerine yazılır (sonraki Ctrl+S sormadan), yoksa indirilir */
async function saveProjectFile(saveAs){
  if(sk)flushDrag();
  const name=fileSafe(state.partName)+'-proje.tocad.json';const data=JSON.stringify({app:'tocad',...project,version:3},cleanR);
  if(typeof showSaveFilePicker==='function'&&!dlCap){
    try{
      if(!fileHandle||saveAs)fileHandle=await showSaveFilePicker({suggestedName:name,types:[{description:'toCAD projesi',accept:{'application/json':['.json']}}]});
      const w=await fileHandle.createWritable();await w.write(data);await w.close();toast('Kaydedildi: '+fileHandle.name);return true;
    }catch(e){if(e&&e.name==='AbortError')return false;fileHandle=null}
  }
  return saveFile(name,data);
}
/* başka sekmede de açık mı: aynı otomatik kaydı paylaşırlar, son yazan diğerini ezer */
function otherTab(){
  if(otherWarned)return;otherWarned=true;
  toast('toCAD başka bir sekmede de açık. İki sekme aynı otomatik kaydı kullanır; son değiştiren diğerinin kaydının üzerine yazar. Önceki sürümler Dosya → Önceki sürümler’de saklanır.',{label:'Sürümler',fn:openRecovery,long:true});
}
try{
  if(typeof BroadcastChannel==='function'){const bc=new BroadcastChannel('tocad-sekme');
    bc.onmessage=e=>{const m=e.data||{};if(m.id===TAB_ID)return;if(m.t==='hello')bc.postMessage({t:'here',id:TAB_ID});if(m.t==='hello'||m.t==='here')otherTab()};
    bc.postMessage({t:'hello',id:TAB_ID})}
}catch(e){}
addEventListener('storage',e=>{if(e.key===LS_KEY)otherTab()});
/* kayıt hiçbir yere yazılamadıysa sayfadan çıkarken tarayıcı uyarır */
addEventListener('beforeunload',e=>{if(lsOk===false&&idbOk===false){e.preventDefault();e.returnValue=''}});
