/* Çizim yardımcıları (SolidWorks'teki gibi):
   - Hiza çizgileri: çizerken imlecin üzerinden geçtiği noktalar “uyanır”; imleç onların yatay/dikey hizasına,
     uçtaki çizginin uzantısına veya yayın teğetine gelince yakalanır ve kesikli yardımcı çizgi gösterilir.
     Üzerine gelinen çizginin ekseni geçici olarak gösterilir. Çizgi başlangıcından daireye teğet nokta yakalanır.
   - Boyut kutusu: Seç aracıyla tek bir daire, yay, çizgi veya dikdörtgen kenarı seçilince boyutu yazılabilir.
     Değer yalnızca geometriyi değiştirir, ölçü (oklu ölçü) eklenmez. Boyut zaten bir ölçüyle belirleniyorsa o ölçü değişir.
   - İşlem önizlemesi: ofset, aynalama, doğrusal/dairesel çoğaltma uygulanmadan önce sonucu gösterir. */

/* ---------- hiza çizgileri ---------- */
const WAKE_N=3;
const DRAWTOOLS=new Set(['line','centerline','rect','crect','circle','arc','arc3','tarc','slot','polygon','point']);
/* imleç bir noktanın üstünden geçince nokta uyanır (son üç nokta); bir çizginin üstündeyken ekseni gösterilir */
function wakeAt(q,tol){
  const f=sk.feat;if(!sk.wake)sk.wake=[];sk.hoverAxis=null;
  let id=null,bd=tol*0.8;
  for(const p of ['O',...Object.keys(f.pts)]){const P=P2(p);const d=Math.hypot(P[0]-q[0],P[1]-q[1]);if(d<bd){bd=d;id=p}}
  if(id){const w=sk.wake,i=w.indexOf(id);if(i>=0)w.splice(i,1);w.push(id);if(w.length>WAKE_N)w.shift();return}
  for(const e of f.ents)if(e.t==='line'&&entDist(e,q)[0]<tol*0.6){sk.hoverAxis=e.id;return}
}
/* hiza doğruları: {o: geçtiği nokta, d: birim yön, hv: başlangıçtan yatay/dikey ise ilişki türü, k: tür, b: çizginin diğer ucu} */
function skGuides(from,exclude){
  const out=[];
  if(from)out.push({o:from,d:[1,0],hv:'h',k:'from'},{o:from,d:[0,1],hv:'v',k:'from'});
  if(!sk.tool||!DRAWTOOLS.has(sk.tool))return out;
  const f=sk.feat,same=P=>from&&Math.hypot(P[0]-from[0],P[1]-from[1])<1e-9;
  for(const id of sk.wake||[]){
    if((id!=='O'&&!f.pts[id])||(exclude&&exclude.has(id)))continue;const P=P2(id);
    if(!same(P))out.push({o:P,d:[1,0],k:'pt'},{o:P,d:[0,1],k:'pt'});
    // uçtaki çizginin uzantısı ve yayın teğeti (yatay/dikey olanlar zaten nokta hizasında)
    for(const e of f.ents){if(e.t==='circle'||(e.a!==id&&e.b!==id))continue;let d;
      if(e.t==='line'){const Q=P2(e.a===id?e.b:e.a);d=[P[0]-Q[0],P[1]-Q[1]]}else{const c=P2(e.c);d=[c[1]-P[1],P[0]-c[0]]}
      const l=Math.hypot(d[0],d[1]);if(l<1e-9)continue;d=[d[0]/l,d[1]/l];
      if(Math.abs(d[0])<1e-9||Math.abs(d[1])<1e-9)continue;
      out.push({o:P,d,k:e.t==='line'?'ext':'tan'})}
  }
  // üzerinde durulan çizginin ekseni
  const e=sk.hoverAxis&&f.ents.find(x=>x.id===sk.hoverAxis);
  if(e&&!(exclude&&(exclude.has(e.a)||exclude.has(e.b)))){const a=P2(e.a),b=P2(e.b),l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>1e-9)out.push({o:a,b,d:[(b[0]-a[0])/l,(b[1]-a[1])/l],k:'ext'})}
  return out;
}
/* imleç bir hiza doğrusuna yakınsa ona, iki doğrunun kesişimine yakınsa kesişime yakalanır. qg: ızgaraya yuvarlanmış imleç */
function guideSnap(gs,q,qg,tol){
  if(!gs.length)return null;
  const dist=g=>Math.abs((q[0]-g.o[0])*g.d[1]-(q[1]-g.o[1])*g.d[0]);
  const near=gs.map(g=>({g,dd:dist(g)})).filter(x=>x.dd<tol).sort((a,b)=>a.dd*(a.g.hv?0.8:1)-b.dd*(b.g.hv?0.8:1));
  if(!near.length)return null;
  // çizilen yardımcı çizgi: hizanın kaynağından yakalanan noktaya (başlangıç hizası önizleme çizgisinde zaten görünür)
  const seg=(g,P)=>{if(g.k==='from')return null;let o=g.o;if(g.b&&Math.hypot(g.b[0]-P[0],g.b[1]-P[1])<Math.hypot(o[0]-P[0],o[1]-P[1]))o=g.b;return [o,P]};
  const g1=near[0].g;let best=null,bd=tol*1.5;
  for(const {g} of near.slice(1)){
    const cr=g1.d[0]*g.d[1]-g1.d[1]*g.d[0];if(Math.abs(cr)<0.2)continue;
    const t=((g.o[0]-g1.o[0])*g.d[1]-(g.o[1]-g1.o[1])*g.d[0])/cr;const X=[g1.o[0]+g1.d[0]*t,g1.o[1]+g1.d[1]*t];
    const d=Math.hypot(X[0]-q[0],X[1]-q[1]);if(d<bd){bd=d;best={X,g}}
  }
  if(best){const {X,g}=best;return {x:X[0],y:X[1],hv:g1.hv||g.hv||null,guides:[seg(g1,X),seg(g,X)].filter(Boolean)}}
  let P;
  if(g1.d[1]===0)P=[qg[0],g1.o[1]];else if(g1.d[0]===0)P=[g1.o[0],qg[1]];
  else{const t=(q[0]-g1.o[0])*g1.d[0]+(q[1]-g1.o[1])*g1.d[1];P=[g1.o[0]+g1.d[0]*t,g1.o[1]+g1.d[1]*t]}
  return {x:P[0],y:P[1],hv:g1.hv||null,guides:[seg(g1,P)].filter(Boolean)};
}
/* çizgi başlangıcından daireye/yaya teğet olan değme noktası. Yalnızca teğet ilişkisi eklenir: uç noktayı ayrıca çevreye
   bağlamak teğetliği birinci derecede belirsiz yapar (çözücü ilişkiyi bağımsız saymaz) */
function tanPtSnap(q,tol,from,fromId){
  const f=sk.feat;let best=null,bd=tol;
  for(const e of f.ents){
    if(e.t==='line'||[e.a,e.b,e.c].includes(fromId))continue;
    const c=P2(e.c),r=curveR(f,e),v=[from[0]-c[0],from[1]-c[1]],D=Math.hypot(v[0],v[1]);if(!(D>r*1.001))continue;
    const al=Math.acos(r/D),b0=Math.atan2(v[1],v[0]);
    for(const sg of [1,-1]){const t=b0+sg*al;const T=[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];
      if(e.t==='arc'&&entDist(e,T)[0]>1e-6*(1+r))continue;
      const d=Math.hypot(T[0]-q[0],T[1]-q[1]);if(d<bd){bd=d;best={x:T[0],y:T[1],inf:{t:'tan',e:e.id}}}}
  }
  return best;
}

/* ---------- seçilen öğenin boyut kutusu ---------- */
let sizeEl=null;
function closeSizePop(){if(sizeEl){sizeEl.remove();sizeEl=null}}
/* dört çizgiden oluşan, köşeleri dik kapalı zincir (dikdörtgen) ise genişlik ve yükseklik kenarları */
function rectSides(f,e){
  if(e.t!=='line')return null;const E=entMap(f);const ls=skChain(f,e.id).map(id=>E[id]);
  if(ls.length!==4||ls.some(l=>!l||l.t!=='line'))return null;
  const cnt={};for(const l of ls)for(const p of [l.a,l.b])cnt[p]=(cnt[p]||0)+1;
  if(Object.keys(cnt).length!==4||Object.values(cnt).some(n=>n!==2))return null;
  const dir=l=>{const a=P2(l.a),b=P2(l.b),L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return [(b[0]-a[0])/L,(b[1]-a[1])/L]};
  const adj=(l,m)=>l!==m&&[l.a,l.b].some(p=>p===m.a||p===m.b);
  for(const l of ls)for(const m of ls)if(adj(l,m)){const u=dir(l),v=dir(m);if(Math.abs(u[0]*v[0]+u[1]*v[1])>1e-6)return null}
  const other=ls.find(m=>adj(e,m));
  // tıklanan kenar yataya daha yakınsa genişlik kenarıdır
  return Math.abs(dir(e)[0])>=Math.abs(dir(other)[0])?{w:e,h:other}:{w:other,h:e};
}
/* öğenin yazılabilir boyutları: [etiket, geçici ölçü] */
function sizeFields(f,e){
  if(!e||e.ref)return null;
  if(e.t==='circle')return [['Çap',{t:'ddia',e:e.id}]];
  if(e.t==='arc')return [['Yarıçap',{t:'drad',e:e.id}]];
  const R=rectSides(f,e);
  if(R)return [['Genişlik',{t:'d',p:R.w.a,q:R.w.b}],['Yükseklik',{t:'d',p:R.h.a,q:R.h.b}]];
  return [['Uzunluk',{t:'d',p:e.a,q:e.b}]];
}
const sizeTitle=(f,e)=>e.t==='circle'?(e.cons?'Yapı dairesi':'Daire'):e.t==='arc'?'Yay':rectSides(f,e)?'Dikdörtgen':(e.cons?'Yapı çizgisi':'Çizgi');
/* Seç aracıyla tek bir öğe seçiliyse boyut kutusu açılır. at: kutunun yakınında açılacağı çizim noktası */
function sizePopForSel(at){
  if(!sk||sk.tool||sk.op||sk.sel.length!==1||sk.sel[0].k!=='ent'){closeSizePop();return}
  openSizePop(sk.sel[0].id,at);
}
function openSizePop(eid,at){
  closeSizePop();if(!sk||confEl)return;const f=sk.feat,e=f.ents.find(x=>x.id===eid);const fl=sizeFields(f,e);if(!fl)return;
  const q=at||sk.cursor||[0,0];const s=skToScreen(q[0],q[1]);const r=vpEl.getBoundingClientRect();
  const el=document.createElement('div');el.className='pop skin sizepop';el.dataset.e=eid;
  el.setAttribute('role','dialog');el.setAttribute('aria-label',sizeTitle(f,e)+' boyutu');
  el.title='Değer yalnızca çizimi değiştirir; ölçü eklenmez. Boyut zaten bir ölçüyle belirleniyorsa o ölçü değişir.';
  el.innerHTML=`<span class="sz-t">${esc(sizeTitle(f,e))}</span>`+fl.map(([l],i)=>`<label><span>${esc(l)}</span><input inputmode="decimal" data-sz="${i}" aria-label="${esc(l)}"></label>`).join('')+`<button class="ok" aria-label="Uygula">${IC.ok}</button><button aria-label="Kapat">${IC.x}</button>`;
  vpEl.appendChild(el);sizeEl=el;
  const w=el.offsetWidth||220,h=el.offsetHeight||56;
  el.style.left=Math.max(4,Math.min(r.width-w-4,s[0]+18))+'px';el.style.top=Math.max(4,Math.min(r.height-h-4,s[1]+18))+'px';
  refreshSizePop(true);
  const ins=[...el.querySelectorAll('input')];
  el.addEventListener('pointerdown',ev=>ev.stopPropagation());
  el.querySelector('.ok').onclick=applySizePop;el.querySelectorAll('button')[1].onclick=closeSizePop;
  for(const i of ins)i.addEventListener('input',()=>{i.dataset.ed='1';i.style.borderColor=''});
  el.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();applySizePop()}
    if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();closeSizePop()}
  });
}
/* kutudaki değerleri geometriden günceller (düzenlenmekte olan alanlar hariç) */
function refreshSizePop(all){
  if(!sizeEl||!sk)return;const f=sk.feat,e=f.ents.find(x=>x.id===sizeEl.dataset.e);const fl=sizeFields(f,e);
  if(!fl||!(sk.sel.length===1&&sk.sel[0].id===sizeEl.dataset.e)){closeSizePop();return}
  const ins=[...sizeEl.querySelectorAll('input')];if(ins.length!==fl.length){closeSizePop();return}
  fl.forEach(([,c],i)=>{const inp=ins[i];if(!all&&inp.dataset.ed)return;let v;try{v=dimMeasure(f,c)}catch(err){v=NaN}inp.dataset.v=v;inp.value=isFinite(v)?String(rnd4(v)).replace('.',','):''});
}
/* kutu açıkken rakam yazılırsa ilk alana yazılır */
function focusSizePop(ch){
  if(!sizeEl)return false;const inp=sizeEl.querySelector('input');if(!inp)return false;
  inp.focus();if(ch!=null){inp.value=ch;inp.dataset.ed='1'}inp.setSelectionRange(inp.value.length,inp.value.length);return true;
}
function applySizePop(){
  if(!sizeEl||!sk)return;const f=sk.feat,e=f.ents.find(x=>x.id===sizeEl.dataset.e);const fl=sizeFields(f,e);if(!fl){closeSizePop();return}
  const ins=[...sizeEl.querySelectorAll('input')];const items=[];
  for(let i=0;i<fl.length;i++){const inp=ins[i];const v=num(inp.value);
    if(!(isFinite(v)&&v>0)){inp.style.borderColor='var(--warn)';inp.focus();inp.select();return}
    if(Math.abs(v-dimMeasure(f,fl[i][1]))>1e-9)items.push({c:fl[i][1],v})}
  if(!items.length){closeSizePop();return}
  if(setEntSize(items))closeSizePop();else refreshSizePop(true);
}
/* Boyutları değiştirir: her boyut için geçici bir ölçü eklenip çözülür ve ölçü kaldırılır (çizimde ölçü kalmaz).
   Boyut mevcut ölçülerle zaten belirleniyorsa aynı büyüklüğü (veya çapı/yarıçapı) ölçen sürücü ölçünün değeri değişir. */
function setEntSize(items){
  const f=sk.feat;skPush();const shape0=skShape(f);const tg=[];let msg=null;
  items.forEach((it,i)=>{
    const c={...it.c,id:'_sz'+i};c.val=dimMeasure(f,c);const m=c.val;
    const cf=sketchConflict(f,[c]);
    if(!cf.over){f.cons.push(c);tg.push({id:c.id,from:m,to:it.v});return}
    let hit=null;
    for(const id of cf.ids){const d=f.cons.find(x=>x.id===id);if(!d||!DIMT.has(d.t)||d.driven||d.t==='doff')continue;
      const k=dimMeasure(f,d)/m;const kk=[1,0.5,2].find(x=>Math.abs(k-x)<1e-6);if(kk){hit={d,k:kk};break}}
    if(hit)tg.push({id:hit.d.id,from:hit.d.val,to:it.v*hit.k});
    else msg=`${dimText({t:it.c.t,val:it.v})} uygulanamadı: bu boyut mevcut ilişki ve ölçülerle belirleniyor.`;
  });
  if(!tg.length){sk.hist.pop();updUndo();if(msg)toast(msg);return false}
  // değer kademeli olarak yaklaştırılır (büyük değişikliklerde şekil ters dönmesin)
  const snap=skData(f);let ok=false;
  for(const n of [1,4,16]){skRestore(snap);let k=true;
    for(let s=1;s<=n&&k;s++){for(const t of tg){const c=f.cons.find(x=>x.id===t.id);c.val=t.from+(t.to-t.from)*s/n}k=solveSketch(f)}
    if(k&&(n===16||!skFlipped(shape0,skShape(f)))){ok=true;break}}
  if(!ok){skRestore(sk.hist.pop());updUndo();skChanged();toast('Boyut uygulanamadı: çizim bu değerle çözülemiyor.');return false}
  f.cons=f.cons.filter(c=>!String(c.id).startsWith('_sz'));
  for(const t of tg){const c=f.cons.find(x=>x.id===t.id);if(c)c.val=rnd4(c.val)}
  // iş bitti: sonraki tıklama yeni bir öğeyi tek başına seçer (kutusu açılır)
  sk.sel=[];skChanged();if(msg)toast(msg);
  return true;
}

/* ---------- işlem önizlemesi (ofset, aynala, çoğalt) ---------- */
let opPrev=null;
/* işlem çizimin bir kopyasında yapılır; eklenecek öğelerin parçaları döner: [[a,b,yapı mı]] */
function skOpPreview(){
  const o=sk.op;if(!o||!sk.sel.some(h=>h.k==='ent')){opErrNote(null);return null}
  const real=sk.feat;const key=JSON.stringify([o,sk.sel])+skData(real);
  if(opPrev&&opPrev.key===key){opErrNote(opPrev.err);return opPrev.segs}
  const cp=JSON.parse(JSON.stringify(real));let segs=null,err=null;
  sk.feat=cp;
  try{const n0=new Set(cp.ents.map(e=>e.id));runSkOp(o,selEnts());
    segs=[];for(const e of cp.ents)if(!n0.has(e.id)){const t=tessEnt(cp,e,72);for(let i=0;i<t.length-1;i++)segs.push([t[i],t[i+1],!!e.cons])}}
  catch(e){segs=null;err=e.message||String(e)}
  finally{sk.feat=real}
  opPrev={key,segs,err};opErrNote(err);return segs;
}
/* önizleme yapılamıyorsa (ör. ofset bir yayın yarıçapından büyük) nedeni panelde yazılır; önceden önizleme sessizce kayboluyordu */
function opErrNote(err){const el=document.querySelector('#pm [data-operr]');if(!el)return;el.textContent=err?'Uygulanamaz: '+err:'';el.hidden=!err}
TOOLHELP.line+=' Bir noktanın üstünden geçersen onun yatay/dikey hizası ve uçtaki çizginin uzantısı kesikli yardımcı çizgiyle gösterilir ve yakalanır; bir daireye yaklaşınca teğet nokta yakalanır.';
