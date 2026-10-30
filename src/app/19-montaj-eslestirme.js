/* Eşleştirme türleri (SolidWorks: standart, gelişmiş, mekanik): seçim yuvaları, varsayılan değerler, dönme bağlantıları ve Eşleştir paneli. */
const MATE_STD=['coincident','parallel','perpendicular','tangent','concentric','lock','distance','angle'];
const MATE_ADV=['symmetric','width','distlimit','anglimit'];
const MATE_MEC=['hinge','gear','rack','screw'];
const MATE_TIP={coincident:'Yüzeyler aynı düzlemde, eksenler aynı doğruda.',concentric:'İki silindir (veya dairesel kenar) aynı eksende.',parallel:'Yüzeyler/eksenler paralel.',perpendicular:'Yüzeyler/eksenler dik.',
  tangent:'Düz yüzey silindire veya iki silindir birbirine teğet.',lock:'İki bileşen birbirine göre olduğu yerde kilitlenir.',distance:'Yüzeyler/eksenler arası mesafe.',angle:'Yüzeyler arası açı.',
  symmetric:'İki yüzey (veya silindir) bir düzleme göre simetrik.',width:'Tırnak, iki yüzeyin (kanalın) tam ortasında.',distlimit:'Mesafe en az–en fazla aralığında serbest.',anglimit:'Açı en az–en fazla aralığında serbest.',
  hinge:'Eşmerkezli + çakışık: yalnızca eksen etrafında döner.',gear:'İki bileşen eksenleri etrafında oranla birbirine ters döner.',rack:'Pinyon döndükçe kremayer kenar boyunca ilerler.',screw:'Eşmerkezli; bir tur dönmede hatve kadar ilerler.'};
/* seçim yuvaları: kind düz yüzey ('plane') veya eksen ('axis': silindir, dairesel/doğrusal kenar); same: önceki yuvayla aynı bileşende olabilir */
function mateSlots(t){
  switch(t){
    case 'width':return [{k:'a',kind:'plane',l:'Genişlik: 1. yüzey'},{k:'b',kind:'plane',l:'Genişlik: 2. yüzey',same:1},{k:'c',kind:'plane',l:'Tırnak: 1. yüzey'},{k:'d',kind:'plane',l:'Tırnak: 2. yüzey',same:1}];
    case 'symmetric':return [{k:'a',l:'1. öğe (yüzey veya silindir)'},{k:'b',l:'2. öğe (aynı türde)'},{k:'c',kind:'plane',l:'Simetri düzlemi (düz yüzey)',same:1}];
    case 'hinge':return [{k:'a',kind:'axis',l:'Eşmerkezli: 1. silindir'},{k:'b',kind:'axis',l:'Eşmerkezli: 2. silindir'},{k:'c',kind:'plane',l:'Çakışık: 1. düz yüzey'},{k:'d',kind:'plane',l:'Çakışık: 2. düz yüzey'}];
    case 'gear':return [{k:'a',kind:'axis',l:'1. dişli: silindir veya dairesel kenar'},{k:'b',kind:'axis',l:'2. dişli: silindir veya dairesel kenar'}];
    case 'rack':return [{k:'a',kind:'axis',l:'Kremayer: hareket yönündeki doğrusal kenar'},{k:'b',kind:'axis',l:'Pinyon: silindir veya dairesel kenar'}];
    case 'screw':return [{k:'a',kind:'axis',l:'1. silindir (ör. somun deliği)'},{k:'b',kind:'axis',l:'2. silindir (ör. vida gövdesi)'}];
  }
  return [{k:'a',l:'1. Bir bileşende yüzey, kenar veya silindir seç'},{k:'b',l:'2. Başka bir bileşende yüzey, kenar veya silindir seç'}];
}
const twoSlot=t=>mateSlots(t).length===2&&!['gear','rack','screw'].includes(t);
const refKind=s=>s.ref.t==='plane'?'plane':'axis';
const slotsFull=d=>!!d.type&&mateSlots(d.type).every(sl=>d[sl.k]);
/* iki seçime uyan iki seçimli türler (ilki varsayılan) */
function mateTypesFor(a,b){
  const pa=a.ref.t==='plane',pb=b.ref.t==='plane',ln=s=>s.ref.e==='line',rr=s=>s.ref.t!=='plane'&&!ln(s)&&s.ref.r>0;let t;
  if(pa&&pb)t=['coincident','parallel','perpendicular','distance','angle'];
  else if(!pa&&!pb)t=[ln(a)||ln(b)?'coincident':'concentric','parallel','perpendicular',...(rr(a)&&rr(b)?['tangent']:[]),'distance'];
  else t=['coincident','parallel','perpendicular',...(rr(pa?b:a)?['tangent']:[]),'distance'];
  t.push('lock','distlimit');if(pa===pb)t.push('anglimit');
  return t;
}
function mateTypeOk(t,d){
  if(twoSlot(t))return !(d.a&&d.b)||mateTypesFor(d.a,d.b).includes(t);
  return true;
}
/* eksene dik birim yön (dünya) */
function perpUnit(A){const u=new T.Vector3(1,0,0).cross(A);if(u.length()<0.3)u.set(0,1,0).cross(A);return u.normalize()}
const toLocal=(v,c)=>v.clone().transformDirection(new T.Matrix4().fromArray(c.T).invert()).toArray().map(x=>Math.round(x*1e9)/1e9);
const r9=v=>v.toArray().map(x=>Math.round(x*1e9)/1e9);
/* bileşenin ekseni etrafındaki dönmesi: yerel u yönünün, eklendiği andaki dünya yönü w0'a göre açısı (d yönünde sağ el); önceki değere göre sürekli */
const unwrapA=(a,prev)=>a+2*Math.PI*Math.round(((prev||0)-a)/(2*Math.PI));
function axAng(u,M,d,w0,prev){const U=new T.Vector3(...u).transformDirection(M),W=new T.Vector3(...w0);W.sub(d.clone().multiplyScalar(W.dot(d)));return unwrapA(Math.atan2(W.clone().cross(U).dot(d),W.dot(U)),prev)}
/* dişli, kremayer ve vidanın dönme/ilerleme değerleri (eklendiği andan itibaren) */
function coupAngles(m,P){
  const A=wref(m.a.ref,P[m.a.comp]),B=wref(m.b.ref,P[m.b.comp]),o={};
  if(m.type==='gear'){o.ta=axAng(m.ua,P[m.a.comp],A.d,m.wa,m.ta);o.tb=axAng(m.ub,P[m.b.comp],B.d,m.wb,m.tb)}
  else if(m.type==='rack'){o.x=A.p.clone().sub(new T.Vector3(...m.w0)).dot(A.d);o.tb=axAng(m.ub,P[m.b.comp],B.d,m.wb,m.tb)}
  else if(m.type==='screw'){const Ua=new T.Vector3(...m.ua).transformDirection(P[m.a.comp]),Ub=new T.Vector3(...m.ub).transformDirection(P[m.b.comp]);
    o.ta=unwrapA(Math.atan2(Ua.clone().cross(Ub).dot(A.d),Ua.dot(Ub)),m.ta);o.x=B.p.clone().sub(A.p).dot(A.d)-num(m.s0||0)}
  return o;
}
/* çözümden sonra dönme açıları saklanır: sonraki çözümde açı ±180°'den geçerken sıçramaz (tam turlar sayılır) */
function mateTrack(ms,P){
  for(const m of ms){if(!['gear','rack','screw'].includes(m.type)||!(m.ua||m.ub)||!P[m.a.comp]||!P[m.b.comp])continue;
    const k=coupAngles(m,P);if(k.ta!==undefined)m.ta=Math.round(k.ta*1e9)/1e9;if(k.tb!==undefined)m.tb=Math.round(k.tb*1e9)/1e9}
}
/* seçimler tamamlanınca türün varsayılanları şimdiki konumdan alınır */
function initMateParams(d){
  const W=s=>curWorld(s),ca=compById(d.a.comp),cb=compById(d.b.comp);const A=W(d.a),B=W(d.b);const pa=A.t==='plane',pb=B.t==='plane',Pl=pa?A:B,Ax=pa?B:A;
  const rnd=x=>Math.round(x*100)/100;
  if(d.type==='coincident'&&pa&&pb)d.flip=A.n.dot(B.n)>0.3;
  if(d.type==='distance'||d.type==='distlimit'){
    // iki eksen: şimdiki eksen aralığı; eksen–düzlem: eksenin düzleme uzaklığı; iki düzlem: aralık
    const dist=!pa&&!pb?(()=>{const w=B.p.clone().sub(A.p);return w.sub(A.d.clone().multiplyScalar(w.dot(A.d))).length()})():pa!==pb?Ax.p.clone().sub(Pl.p).dot(Pl.n):B.p.clone().sub(A.p).dot(A.n);
    d.flip=dist<0;
    if(d.type==='distance'){d.val=Math.abs(dist)>1e-3?rnd(Math.abs(dist)):10;if(pa&&pb)d.align=A.n.dot(B.n)>0;else delete d.align}
    else{delete d.align;const v=rnd(Math.abs(dist));if(d.min===undefined||d.max===undefined){d.min=Math.max(0,rnd(v-10));d.max=rnd(v+10)}}
  }
  if(d.type==='angle'||d.type==='anglimit'){const u=pa?A.n:A.d,v=pb?B.n:B.d;const ang=Math.acos(Math.max(-1,Math.min(1,u.dot(v))))*180/Math.PI;
    if(d.type==='angle')d.val=Math.round(ang)||90;else if(d.min===undefined||d.max===undefined){d.min=Math.max(0,Math.round(ang)-45);d.max=Math.min(180,Math.round(ang)+45)}}
  if(d.type==='tangent'){
    if(pa!==pb)d.flip=Ax.p.clone().sub(Pl.p).dot(Pl.n)<0;
    else{const ra=d.a.ref.r||0,rb=d.b.ref.r||0,w=B.p.clone().sub(A.p);const l=w.sub(A.d.clone().multiplyScalar(w.dot(A.d))).length();d.flip=Math.abs(l-Math.abs(ra-rb))<Math.abs(l-(ra+rb))}}
  if(d.type!=='concentric'){d.lock=false;delete d.lk}
  if(d.type==='lock')d.rel=new T.Matrix4().fromArray(ca.T).invert().multiply(new T.Matrix4().fromArray(cb.T)).toArray().map(x=>Math.round(x*1e9)/1e9);else delete d.rel;
  if(d.type==='hinge'&&d.c&&d.d)d.flip=W(d.c).n.dot(W(d.d).n)>0.3;
  // dönme bağlantıları: eksene dik referans yönleri (her iki bileşenin kendi koordinatında ve dünyada) eklendiği anda alınır
  for(const k of ['ua','ub','wa','wb','w0','s0','ta','tb','sg'])if(!['gear','rack','screw'].includes(d.type))delete d[k];
  if(d.type==='gear'){const ua=perpUnit(A.d),ub=perpUnit(B.d);Object.assign(d,{ua:toLocal(ua,ca),ub:toLocal(ub,cb),wa:r9(ua),wb:r9(ub),ta:0,tb:0,sg:A.d.dot(B.d)<-1e-6?-1:1});
    if(d.ra===undefined)d.ra=rnd((d.a.ref.r||0.5)*2);if(d.rb===undefined)d.rb=rnd((d.b.ref.r||0.5)*2)}
  // val (hatve çapı, hatve) bu tür için yazılmadıysa varsayılanı alır
  const fresh=d._valFor!==d.type;if(['rack','screw'].includes(d.type))d._valFor=d.type;
  if(d.type==='rack'){const ub=perpUnit(B.d);Object.assign(d,{ub:toLocal(ub,cb),wb:r9(ub),w0:r9(A.p),tb:0});delete d.ua;delete d.ta;if(fresh||!(num(d.val)>0))d.val=rnd((d.b.ref.r||10)*2)}
  if(d.type==='screw'){const u=perpUnit(A.d);Object.assign(d,{ua:toLocal(u,ca),ub:toLocal(u,cb),ta:0,s0:Math.round(B.p.clone().sub(A.p).dot(A.d)*1e6)/1e6});delete d.wa;delete d.wb;delete d.tb;if(fresh||!(num(d.val)>0))d.val=2}
  if(!['distlimit','anglimit'].includes(d.type)){delete d.min;delete d.max}
  if(!['gear'].includes(d.type)){delete d.ra;delete d.rb}
}
function setMateType(t){
  const P=asmUI.pm,d=P.draft;const old=d.type;d.type=t;
  // türün yuvalarına uymayan seçimler bırakılır (ör. menteşede ilk iki seçim silindir olmalı)
  const sl=mateSlots(t),keys=sl.map(x=>x.k);
  for(const k of ['a','b','c','d']){if(!keys.includes(k))delete d[k]}
  for(const x of sl)if(d[x.k]&&x.kind&&refKind(d[x.k])!==x.kind)d[x.k]=null;
  if(t==='symmetric'&&d.a&&d.b&&refKind(d.a)!==refKind(d.b))d.b=null;
  if(old!==t&&(t==='distlimit'||t==='anglimit')){delete d.min;delete d.max}
  if(slotsFull(d))initMateParams(d);
  previewMate();
}
function mateSelLabel(s){const a=curAsm(),c=compById(s.comp),r=s.ref;
  const what=r.t==='plane'?'düz yüzey'+(c?` (${dirName(r.n,c.T)})`:''):r.e==='line'?'doğrusal kenar':r.e==='circ'?`dairesel kenar (Ø${fmt(r.r*2)})`:'silindir ekseni'+(r.r?` (Ø${fmt(r.r*2)})`:'');
  return `${c?compName(a,c):'?'}: ${what}`}
function mateTypeBtns(list,d){
  return `<div class="relbtns">${list.map(k=>{const ok=mateTypeOk(k,d);return `<button data-mtype="${k}" ${ok?'':'disabled'} title="${esc(MATE_TIP[k]||'')}" style="${d.type===k?'border-color:var(--accent);background:var(--accent-soft)':''}${ok?'':';opacity:.45'}"><b>${MATE_G[k]}</b>${MATE_T[k]}</button>`}).join('')}</div>`}
function matePMBody(P){
  const d=P.draft;let b='';
  if(P.last)b+=`<div class="pm-ok">✓ ${esc(P.last)} eklendi. Sonraki eşleştirme için seçim yap; bitirmek için ✓ veya Esc.</div>`;
  const sl=mateSlots(d.type);let s=`<div class="lst">`;
  sl.forEach((x,i)=>{const pre=x.l.includes(':')?x.l.split(':')[0]+': ':`${i+1}. `;
    s+=d[x.k]?`<div><span>${esc(pre+mateSelLabel(d[x.k]))}</span><button data-mclr="${x.k}" aria-label="Seçimi kaldır">✕</button></div>`:`<div><span style="color:var(--muted)">${esc(x.l)}</span></div>`});
  s+=`</div>`;
  b+=grp('Eşleştirme seçimleri',s,'Düz yüzeye tıklarsan düzlem, delik/mil/yuvarlatılmış yüzeye tıklarsan ekseni seçilir; kenara yakın tıklarsan kenar (dairesel kenar: ekseni) seçilir. Arkada kalan bileşen için Alt + tıkla.');
  let t=mateTypeBtns(MATE_STD,d);
  const pa=d.a&&d.a.ref.t==='plane',pb=d.b&&d.b.ref.t==='plane',full=slotsFull(d);
  if(full){
    if(d.type==='distance')t+=fNum(!pa&&!pb?'Eksenler arası mesafe':'Mesafe','val','mm',d);
    if(d.type==='angle')t+=fNum('Açı','val','°',d);
    if(d.type==='coincident'&&pa&&pb)t+=`<button type="button" class="sbtn" data-mflip="1">⇅ Hizalamayı ters çevir</button>`;
    if(d.type==='distance'&&(pa||pb))t+=`<button type="button" class="sbtn" data-mflip="1">⇅ Ölçüyü ters çevir</button>`;
    if(d.type==='distance'&&pa&&pb)t+=`<button type="button" class="sbtn" data-malign="1" style="margin-top:6px">⇄ Hizalamayı ters çevir (${d.align?'aynı yön':'karşılıklı'})</button>`;
    if(d.type==='concentric')t+=`<label class="chk" data-tip="Bileşen eksen etrafında dönmez (ör. cıvata, pim); şimdiki açısı korunur."><input type="checkbox" data-mlock ${d.lock?'checked':''}> Dönmeyi kilitle</label>`;
    if(d.type==='tangent')t+=`<button type="button" class="sbtn" data-mflip="1">⇅ ${pa!==pb?'Teğet tarafını ters çevir':(d.flip?'İçten teğet (dıştan yap)':'Dıştan teğet (içten yap)')}</button>`;
  }
  b+=grp('Standart eşleştirmeler',t);
  // gelişmiş ve mekanik gruplar SolidWorks'teki gibi kapalı başlar; seçili tür o gruptaysa açıktır
  const op=k=>(P.open&&P.open[k])||(k==='adv'?MATE_ADV:MATE_MEC).includes(d.type),gt=(k,t)=>`<span data-mgrp="${k}" style="cursor:pointer">${op(k)?'▾':'▸'} ${t}</span>`;
  let g=mateTypeBtns(MATE_ADV,d);
  if(full&&(d.type==='distlimit'||d.type==='anglimit')){const u=d.type==='distlimit'?'mm':'°';g+=`<div class="row2">${fNum('En fazla','max',u,d)}${fNum('En az','min',u,d)}</div>`;if(d.type==='distlimit'&&(pa||pb))g+=`<button type="button" class="sbtn" data-mflip="1">⇅ Ölçüyü ters çevir</button>`}
  b+=grp(gt('adv','Gelişmiş eşleştirmeler'),op('adv')?g:'','Simetrik: iki öğe ve simetri düzlemi. Genişlik: kanalın iki yüzeyi ve tırnağın iki yüzeyi. Sınır: bileşen aralık içinde serbestçe hareket eder.');
  let m=mateTypeBtns(MATE_MEC,d);
  if(full){
    if(d.type==='hinge')m+=`<button type="button" class="sbtn" data-mflip="1">⇅ Çakışık hizalamasını ters çevir</button>`;
    if(d.type==='gear')m+=`<div class="row2">${fNum('1. dişli (çap/diş)','ra','',d)}${fNum('2. dişli (çap/diş)','rb','',d)}</div><button type="button" class="sbtn" data-mflip="1">⇅ Ters çevir (${d.flip?'aynı yönde döner':'zıt döner'})</button>`;
    if(d.type==='rack')m+=fNum('Pinyon hatve çapı','val','mm',d)+`<p class="note">Bir turda kremayer ${fmt(Math.PI*num(d.val),2)} mm ilerler.</p><button type="button" class="sbtn" data-mflip="1">⇅ Yönü ters çevir</button>`;
    if(d.type==='screw')m+=fNum('Hatve (tur başına ilerleme)','val','mm',d)+`<button type="button" class="sbtn" data-mflip="1">⇅ Sol / sağ vida</button>`;
  }
  b+=grp(gt('mec','Mekanik eşleştirmeler'),op('mec')?m:'','Menteşe: iki silindir + iki düz yüzey. Dişli ve vida: iki silindir. Kremayer: kremayerin doğrusal kenarı ve pinyonun silindiri. Bileşeni sürükleyince bağlı bileşen de oranla hareket eder.');
  if(P.err)b+=`<div class="pm-err on">${esc(P.err)}</div>`;
  return b;
}
/* eşleştirme panelinde tıklanan yüzey/kenar sıradaki boş yuvaya yazılır */
function mateSelect(h){
  const P=asmUI.pm,d2=P.draft;
  if(compById(h.comp)&&compById(h.comp).pat){toast('Çoğaltılmış bileşen eşleştirilemez; çoğaltmanın kaynak bileşenini kullan.');return}
  const s={comp:h.comp,ref:h.ref};
  // seçim değişince dönme kilidinin yönleri geçersizdir (yeniden işaretlenir)
  if(d2.lock){d2.lock=false;delete d2.lk}
  const sl=mateSlots(d2.type);let i=sl.findIndex(x=>!d2[x.k]);if(i<0)i=sl.length-1;const x=sl[i];
  if(x.kind&&refKind(s)!==x.kind){toast(x.kind==='plane'?'Bu seçim için düz yüzey seç.':'Bu seçim için silindir veya kenar seç.');return}
  if(d2.type==='symmetric'&&x.k==='b'&&d2.a&&refKind(d2.a)!==refKind(s)){toast('Simetrik öğeler aynı türde olmalı (iki yüzey veya iki silindir).');return}
  const pk=x.k==='b'?'a':x.k==='d'?'c':null;
  if(pk&&!x.same&&d2[pk]&&d2[pk].comp===s.comp){d2[pk]=s;d2[x.k]=null;if(twoSlot(d2.type))d2.type=null}
  else d2[x.k]=s;
  if(d2.a&&d2.b&&twoSlot(d2.type||'coincident')&&(!d2.type||!mateTypesFor(d2.a,d2.b).includes(d2.type))){setMateType(mateTypesFor(d2.a,d2.b)[0]);return}
  if(slotsFull(d2)){setMateType(d2.type);return}
  asmHighlight();renderAsmPM();
}
