/* Ölçü çelişkileri (SolidWorks'teki aşırı tanımlama uyarısı gibi): çizimi aşırı tanımlayan ölçü/ilişki eklenmez,
   onu zaten belirleyen ölçü ve ilişkiler sarı gösterilir. Ölçü referans (güdümlü) olarak eklenebilir ya da sarı
   ölçülerden biri referansa çevrilip yenisi sürücü yapılabilir. Değeri çözülemeyen ölçüde de çelişenler sarıdır. */
let confEl=null;
const rnd4=v=>Math.round(v*1e4)/1e4;
/* ölçünün okunur metni: Ø20, R5, 30°, 40 mm */
function dimText(c){const v=fmt(c.val,3);return c.t==='ddia'?'Ø'+v:c.t==='drad'?'R'+v:c.t==='dang'?v+'°':v+' mm'}
function isConf(id){return !!sk&&((sk.conf&&sk.conf.has(id))||(sk.unsat&&sk.unsat.includes(id)))}
/* çelişen kısıtları işaretler; news: eklenemeyen kısıtlar (öğeleri de sarı görünür) */
function setConf(ids,news){
  if(!sk)return;sk.conf=new Set(ids);const es=new Set();
  for(const c of [...(news||[]),...sk.feat.cons.filter(c=>sk.conf.has(c.id)&&!DIMT.has(c.t))])for(const k of ['e','e1','e2'])if(c[k])es.add(c[k]);
  sk.confEnts=es.size?es:null;sk.dirty=true;renderSketchPM();
}
function clearConf(){if(!sk)return;if(confEl){confEl.remove();confEl=null}const had=sk.conf||sk.confEnts||sk.confPend;sk.conf=null;sk.confEnts=null;sk.confPend=null;if(had)sk.dirty=true}
function closeConflict(){if(!confEl)return;clearConf();if(sk)renderSketchPM()}
/* c: eklenmek istenen ölçü (kimliksiz) veya sürücü yapılmak istenen referans ölçünün kopyası (existing: kendisi) */
function openConflict(c,cf,existing){
  if(!sk)return;closeDimPop();if(confEl){confEl.remove();confEl=null}
  const f=sk.feat;setConf(existing?[...cf.ids,existing.id]:cf.ids);sk.confPend=existing?null:c;sk.dirty=true;
  const dims=cf.ids.map(id=>f.cons.find(x=>x.id===id)).filter(x=>x&&DIMT.has(x.t)&&x.t!=='doff'&&!x.driven);
  const nr=cf.ids.length-dims.length;
  const what=[dims.length?`${dims.length} ölçü`:'',nr?`${nr} ilişki`:''].filter(Boolean).join(' ve ')||'mevcut ölçü ve ilişkiler';
  const el=document.createElement('div');el.className='pop confpop';el.setAttribute('role','alertdialog');el.setAttribute('aria-label','Ölçü çelişkisi');
  el.innerHTML=`<div class="cf-title">⚠ Aşırı tanımlama</div>
    <p>${existing?'Bu ölçü sürücü yapılırsa':'Bu ölçü'} çizimi aşırı tanımlar: sarı işaretli ${esc(what)} onu zaten belirliyor. Şu anki değeri <b>${esc(dimText(c))}</b>.</p>
    <div class="cf-btns">${existing?`<button class="sbtn primary" data-cf="cancel">Referans olarak kalsın</button>`:`<button class="sbtn primary" data-cf="ref">Referans ölçü olarak ekle</button><button class="sbtn" data-cf="cancel">İptal</button>`}</div>
    ${dims.length?`<p class="note">Bu ölçüyü sürücü yapmak için sarı ölçülerden birini referansa çevir:</p><div class="cf-btns">${dims.map(x=>`<button class="sbtn" data-cfx="${x.id}" title="${esc(dimName(x)+' – '+dimWhere(x))}">${esc(dimName(x)+' '+dimText(x))} → referans</button>`).join('')}</div>`:''}`;
  const s=skToScreen(c.lp[0],c.lp[1]);const r=vpEl.getBoundingClientRect();
  vpEl.appendChild(el);confEl=el;
  const w=el.offsetWidth||300,h=el.offsetHeight||140;
  el.style.left=Math.max(4,Math.min(r.width-w-4,s[0]+14))+'px';el.style.top=Math.max(4,Math.min(r.height-h-4,s[1]+14))+'px';
  el.addEventListener('pointerdown',e=>e.stopPropagation());
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-cf]'),x=e.target.closest('[data-cfx]');
    if(b&&b.dataset.cf==='cancel'){closeConflict();return}
    if(b&&b.dataset.cf==='ref'){addRefDim(c);return}
    if(x)swapDriven(c,x.dataset.cfx,existing);
  });
  el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeConflict()}});
  const p=el.querySelector('.primary');if(p)p.focus();
}
/* ölçüyü referans (güdümlü) olarak ekler: geometriyi sürmez, değeri çizimden gelir */
function addRefDim(c){
  const f=sk.feat;skPush();const d={...c,driven:true,id:newId(f,'c')};d.val=rnd4(dimMeasure(f,d));f.cons.push(d);
  skChanged();toast('Referans ölçü eklendi: geometriyi sürmez, değeri çizimden gelir ve parantez içinde gösterilir.');
}
/* sarı ölçülerden birini (xid) referansa çevirip c'yi sürücü yapar; sonra değer kutusu açılır */
function swapDriven(c,xid,existing){
  const f=sk.feat;skPush();const x=f.cons.find(k=>k.id===xid);if(!x)return;x.driven=true;x.val=rnd4(dimMeasure(f,x));
  let t;if(existing){t=f.cons.find(k=>k.id===existing.id);if(t){delete t.driven;t.val=rnd4(dimMeasure(f,t))}}
  else{t={...c,id:newId(f,'c')};delete t.driven;t.val=rnd4(dimMeasure(f,t));f.cons.push(t)}
  const rest={...f,cons:f.cons.filter(k=>k!==t)};
  if(!t||sketchConflict(rest,[t]).over||!solveSketch(f)){skRestore(sk.hist.pop());updUndo();skChanged();toast('Çizim hâlâ aşırı tanımlı; başka bir ölçüyü referans yap veya bir ilişkiyi sil.');return}
  skChanged();toast(`${dimName(x)} ${dimText(x)} referans ölçü oldu.`);requestAnimationFrame(()=>openDimPop(t.id));
}
/* ölçüyü referans ↔ sürücü yapar. Sürücü yapmak çizimi aşırı tanımlıyorsa çelişki penceresi açılır */
function setDriven(cid,on){
  if(!sk)return false;const f=sk.feat;const c=f.cons.find(x=>x.id===cid);if(!c||!DIMT.has(c.t)||c.t==='doff')return false;
  if(on){if(c.driven)return true;skPush();c.driven=true;c.val=rnd4(dimMeasure(f,c));skChanged();toast('Referans ölçü: geometriyi sürmez, değeri çizimden gelir (parantez içinde).');return true}
  if(!c.driven)return true;
  const d={...c};delete d.driven;d.val=rnd4(dimMeasure(f,c));
  const cf=sketchConflict({...f,cons:f.cons.filter(x=>x!==c)},[d]);
  if(cf.over){openConflict(d,cf,c);return false}
  skPush();delete c.driven;c.val=d.val;solveSketch(f);skChanged();return true;
}
