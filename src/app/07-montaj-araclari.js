/* Belge kaynağı (parça/montaj), patlatılmış görünüm, girişim algılama, parça listesi ve balonlar. */
/* ================= ÇİZİM BELGESİ (parça veya montaj) ================= */
IC.explode=sv('<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><path d="m10 4 2-2 2 2M10 20l2 2 2-2M4 10l-2 2 2 2M20 10l2 2-2 2"/>');
IC.interf=sv('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/><path d="M12 7.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6z" fill="currentColor" fill-opacity=".45"/>');
IC.asmDraw=sv('<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M14 15h6.5M14 17.5h6.5M14 15v5"/><circle cx="8" cy="9" r="2"/><path d="m9.5 10.5 3 3"/>');
IC.balloon=sv('<circle cx="15" cy="9" r="5"/><path d="M11.5 12.5 4 20"/><path d="M14 7.5 15.2 6.6V11.5"/>');
IC.bom=sv('<rect x="3.5" y="5" width="17" height="14" rx="1"/><path d="M3.5 9h17M3.5 13h17M8 5v14M16 5v14"/>');
let dwOverride=null;
function dwDoc(){
  const d=dwOverride||project.cur.dw;
  if(d&&d.kind==='asm'){const a=project.asms.find(x=>x.id===d.id);if(a)return {kind:'asm',a}}
  if(d&&d.kind==='part'&&dwOverride){const p=partById(d.id);if(p)return {kind:'part',p}}
  return {kind:'part',p:state};
}
function dwS(doc){
  doc=doc||dwDoc();
  if(doc.kind==='asm'){const a=doc.a;if(!a.drawing)a.drawing=Object.assign(defaultDrawing(),{dno:'TZ-M001',asmView:'std',explode:false,balloons:true,bom:true,autodims:true});
    // eksik ayarlar yerinde tamamlanır: nesne her çağrıda yenilenirse ekleme sırasında geçmişe yazmak (pushDwHist) eklenen notu eski nesnede bırakırdı
    const D=defaultDrawing();for(const k in D)if(!(k in a.drawing))a.drawing[k]=D[k];if(!Array.isArray(a.drawing.dims))a.drawing.dims=[];return a.drawing}
  return doc.p.drawing;
}
/* teknik resim geri al/yinele: belge (parça veya montaj) başına, resim ayarlarının tamamı */
const dwHists=new Map();
function dwHistFor(doc){doc=doc||dwDoc();const k=doc.kind==='asm'?'A'+doc.a.id:'P'+doc.p.id;if(!dwHists.has(k))dwHists.set(k,{undo:[],redo:[]});return dwHists.get(k)}
const dwSnap=doc=>JSON.stringify(dwS(doc),cleanR);
function pushDwHist(){const doc=dwDoc(),h=dwHistFor(doc);h.undo.push(dwSnap(doc));if(h.undo.length>80)h.undo.shift();h.redo=[];updUndo()}
function dwRestore(s){const doc=dwDoc(),o=JSON.parse(s);if(doc.kind==='asm')doc.a.drawing=o;else doc.p.drawing=o;dwSel=null;dimSt={stage:0,p1:null,p2:null};saveState();renderDrawRibbon();renderDrawing()}
function dwUndo(){const h=dwHistFor();if(!h.undo.length)return;h.redo.push(dwSnap());dwRestore(h.undo.pop());updUndo()}
function dwRedo(){const h=dwHistFor();if(!h.redo.length)return;h.undo.push(dwSnap());dwRestore(h.redo.pop());updUndo()}
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
function partSrc(p){
  const d=partData(p);const mat=MATERIALS[p.material]||MATERIALS.steel;
  return {kind:'part',key:'P'+p.id+':'+hashStr(d.key),polys:d.polys,ann:d.ann,box:d.box,props:d.props,g:d.g,name:p.partName,matName:p.mesh?'—':mat.name,massG:d.props?d.props.vol/1000*mat.rho:0};
}
const srcCache=new Map();
function asmSrc(a,exploded){
  const f=exploded?1:0;
  const key='A'+a.id+':'+hashStr(JSON.stringify(a.comps.map(c=>[c.part,c.T,!!c.hidden]))+JSON.stringify(a.explode||{})+f+a.comps.map(c=>{const p=partById(c.part);return p?hashStr(partKey(p))+p.material:''}).join());
  if(srcCache.has(key))return srcCache.get(key);
  let polys=[];const ann=[];let massG=0,vol=0,area=0;
  for(const c of a.comps){
    if(c.hidden)continue;const p=partById(c.part);if(!p)continue;const d=partData(p);const M=dispM(a,c,f);
    polys=polys.concat(transformPolys(d.polys,M,c.id));
    for(const an of d.ann)ann.push({...an,C:an.C.clone().applyMatrix4(M),A:an.A.clone().transformDirection(M),gid:c.id+':'+an.gid,label:false});
    if(d.props){vol+=d.props.vol;area+=d.props.area;massG+=d.props.vol/1000*(MATERIALS[p.material]||MATERIALS.steel).rho}
  }
  for(const v of srcCache.values())if(v.g)v.g.dispose();srcCache.clear();
  const src={kind:'asm',key,a,polys,ann,box:polys.length?bboxPolys(polys):null,props:{vol,area},g:polysToBuffers(polys).g,name:a.name,matName:'—',massG,exploded:!!exploded};
  srcCache.set(key,src);return src;
}
function dwSrc(){const doc=dwDoc();if(doc.kind==='asm')return asmSrc(doc.a,!!dwS(doc).explode);return partSrc(doc.p)}

/* ================= PATLATILMIŞ GÖRÜNÜM ================= */
asmUI.exf=0;
function exState(a){if(!a.explode)a.explode={steps:[],on:false};return a.explode}
function explodeOffset(a,c,f){
  const e=a.explode;if(!e||!e.steps||!e.steps.length||!f)return null;let v=[0,0,0];
  for(const st of e.steps)if(st.comps.includes(c.id)){const d=Array.isArray(st.dir)?st.dir:(AXDIR[st.dir]||[0,1,0]);v=va(v,vk(d,num(st.dist)*f))}
  return v;
}
function dispM(a,c,f){const M=new T.Matrix4().fromArray(c.T);const o=explodeOffset(a,c,f===undefined?asmUI.exf:f);if(o)M.premultiply(new T.Matrix4().makeTranslation(o[0],o[1],o[2]));return M}
let exAnim=0;
function setExplode(on,instant){
  const a=curAsm();if(!a)return;const e=exState(a);
  if(on&&!e.steps.length){autoExplode(a);}
  e.on=on;saveState();cancelAnimationFrame(exAnim);
  const f0=asmUI.exf,f1=on?1:0;
  if(instant||reduceMotion){asmUI.exf=f1;updateAsmPoses();renderAsmRibbon();return}
  const t0=performance.now();
  const step=()=>{const t=Math.min(1,(performance.now()-t0)/550);const k=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;asmUI.exf=f0+(f1-f0)*k;updateAsmPoses();if(t<1)exAnim=requestAnimationFrame(step);else{renderAsmRibbon();asmStatus();asmMass();fitCamera(null)}};
  exAnim=requestAnimationFrame(step);renderAsmRibbon();
}
function collapseIfExploded(){const a=curAsm();if(a&&asmUI.exf>0){exState(a).on=false;asmUI.exf=0;updateAsmPoses();renderAsmRibbon();toast('Düzenleme için montaj toplandı.')}}
function snapAxis(v){const ax=['x','y','z'];let best='y',bv=-1;for(let i=0;i<3;i++){const s=Math.abs(v[i]);if(s>bv){bv=s;best=(v[i]<0?'-':'')+ax[i]}}return best}
/* bileşenin (kutusunun) dünya yönü u üzerindeki izdüşüm aralığı */
function compRange(c,u){const v=asmView.groups.get(c.id);const b=v&&v.d.box;if(!b)return null;const M=new T.Matrix4().fromArray(c.T);let lo=Infinity,hi=-Infinity;
  for(let i=0;i<8;i++){const p=new T.Vector3(i&1?b.max[0]:b.min[0],i&2?b.max[1]:b.min[1],i&4?b.max[2]:b.min[2]).applyMatrix4(M);const t=p.x*u[0]+p.y*u[1]+p.z*u[2];lo=Math.min(lo,t);hi=Math.max(hi,t)}
  return [lo,hi]}
function autoExplode(a){
  const e=exState(a);const box=asmView.box;const size=box?Math.max(box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]):100;
  const base=Math.round(size*0.7/5)*5||50;const fixed=a.comps.filter(c=>c.fixed);
  const ref=fixed.length?compCenter(fixed[0]):(box?new T.Vector3((box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2,(box.min[2]+box.max[2])/2):new T.Vector3());
  e.steps=[];
  for(const c of a.comps){
    if(c.fixed)continue;let dir=null,partner=null;const cc=compCenter(c);
    for(const m of a.mates){if(m.suppressed||m.type!=='coincident')continue;
      const mine=m.a.comp===c.id?m.a:(m.b.comp===c.id?m.b:null),oth=mine===m.a?m.b:m.a;if(!mine||oth.ref.t!=='plane'||mine.ref.t!=='plane')continue;
      const oc=compById(oth.comp);if(!oc)continue;const n=new T.Vector3(...oth.ref.n).transformDirection(new T.Matrix4().fromArray(oc.T));dir=[n.x,n.y,n.z];partner=oc;break}
    if(!dir)for(const m of a.mates){if(m.suppressed||m.type!=='concentric')continue;const mine=m.a.comp===c.id?m.a:(m.b.comp===c.id?m.b:null);if(!mine)continue;
      const ax=new T.Vector3(...mine.ref.d).transformDirection(new T.Matrix4().fromArray(c.T));const s=cc.clone().sub(ref).dot(ax);dir=[ax.x,ax.y,ax.z].map(x=>x*(s<0?-1:1));partner=compById((mine===m.a?m.b:m.a).comp);break}
    if(!dir){const v=cc.clone().sub(ref);dir=v.length()<1e-6?[0,1,0]:[v.x,v.y,v.z]}
    const ax=snapAxis(dir);let dist=base;
    // bileşen eşleştiği parçadan tamamen ayrılsın (ör. yatağa giren uzun mil yatağın içinde kalmasın)
    partner=partner||fixed[0];
    if(partner&&partner!==c){const u=AXDIR[ax],pr=compRange(partner,u),cr=compRange(c,u);if(pr&&cr)dist=Math.max(dist,Math.ceil((pr[1]-cr[0]+Math.max(10,size*0.1))/5)*5)}
    e.steps.push({id:uid('x'),comps:[c.id],dir:ax,dist});
  }
}
const DIRN={x:'+X','-x':'−X',y:'+Y','-y':'−Y',z:'+Z','-z':'−Z'};
function openExplodePM(){
  const a=curAsm();if(!a||!a.comps.length){toast('Montajda bileşen yok.');return}
  closeAsmPM(true);asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  const box=asmView.box;const size=box?Math.max(box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]):100;
  asmUI.pm={type:'explode',draft:{comps:[],dir:'y',dist:Math.round(size*0.6/5)*5||50}};
  if(asmUI.exf<1&&exState(a).steps.length)setExplode(true);
  renderAsmPM();renderAsmRibbon();asmHighlight();
}
function explodePMBody(){
  const a=curAsm(),e=exState(a),d=asmUI.pm.draft;
  let b=grp('',`<div class="relbtns"><button data-ex="auto">Otomatik patlat</button><button data-ex="toggle">${asmUI.exf>0.5?'Topla':'Patlat'}</button><button data-ex="clear" class="danger">Adımları temizle</button></div><p class="note">Otomatik patlatma, bileşenleri eşleştirildikleri yüzeyin yönünde ayırır. Adımları aşağıdan düzenleyebilirsin.</p>`);
  b+=grp(`Adımlar (${e.steps.length})`,e.steps.length?`<div class="lst">${e.steps.map((st,i)=>`<div><span>${i+1}. ${esc(st.comps.map(id=>{const c=compById(id);return c?compName(a,c):'?'}).join(', '))}</span><select data-exdir="${i}" style="height:24px;border:1px solid var(--line);border-radius:4px;background:var(--field)">${Object.entries(DIRN).map(([k,t])=>`<option value="${k}" ${st.dir===k?'selected':''}>${t}</option>`).join('')}</select><input data-exdist="${i}" inputmode="decimal" value="${String(st.dist).replace('.',',')}" style="width:52px;height:24px;border:1px solid var(--line);border-radius:4px;background:var(--field);padding:0 4px"><button data-exdel="${i}" aria-label="Adımı sil">✕</button></div>`).join('')}</div>`:'<p class="note">Henüz adım yok.</p>');
  b+=grp('Yeni adım',`<div class="lst">${d.comps.length?d.comps.map((id,i)=>{const c=compById(id);return `<div><span>${esc(c?compName(a,c):'?')}</span><button data-exun="${i}" aria-label="Çıkar">✕</button></div>`}).join(''):'<div><span style="color:var(--muted)">Ekranda taşınacak bileşenlere tıkla</span></div>'}</div>`+
    `<div class="row2"><label class="fld"><span>Yön</span><select data-exnew="dir">${Object.entries(DIRN).map(([k,t])=>`<option value="${k}" ${d.dir===k?'selected':''}>${t}</option>`).join('')}</select></label>${fNum('Mesafe','dist','mm',d)}</div><button class="sbtn" data-ex="add" ${d.comps.length?'':'disabled'}>Adımı ekle</button>`);
  return b;
}
function explodePmClick(e){
  const a=curAsm(),ex=exState(a),d=asmUI.pm.draft;
  const b=e.target.closest('[data-ex]');
  if(b){const k=b.dataset.ex;
    if(k==='auto'){pushAsmHist();autoExplode(a);asmUI.exf=0;setExplode(true)}
    if(k==='toggle')setExplode(asmUI.exf<0.5);
    if(k==='clear'){pushAsmHist();ex.steps=[];setExplode(false,true)}
    if(k==='add'&&d.comps.length){pushAsmHist();ex.steps.push({id:uid('x'),comps:d.comps.slice(),dir:d.dir,dist:num(d.dist)||0});d.comps=[];asmUI.exf=Math.min(asmUI.exf,0.999);setExplode(true)}
    saveState();renderAsmPM();asmHighlight();return true}
  const dl=e.target.closest('[data-exdel]');if(dl){pushAsmHist();ex.steps.splice(+dl.dataset.exdel,1);updateAsmPoses();saveState();renderAsmPM();return true}
  const un=e.target.closest('[data-exun]');if(un){d.comps.splice(+un.dataset.exun,1);renderAsmPM();asmHighlight();return true}
  return false;
}
function explodePmChange(e){
  const a=curAsm(),ex=exState(a),t=e.target;
  if(t.dataset.exdir){ex.steps[+t.dataset.exdir].dir=t.value;updateAsmPoses();saveState();return}
  if(t.dataset.exdist){const v=num(t.value);if(isFinite(v)){ex.steps[+t.dataset.exdist].dist=v;updateAsmPoses();saveState()}return}
  if(t.dataset.exnew){asmUI.pm.draft.dir=t.value}
}

/* ================= GİRİŞİM ALGILAMA ================= */
function csgIntersect(a,b){
  if(!a.length||!b.length)return [];
  const A=new BSP(clonePolys(a)),B=new BSP(clonePolys(b));
  A.invert();B.clipTo(A);B.invert();A.clipTo(B);B.clipTo(A);A.build(B.all());A.invert();return A.all();
}
const interfGroup=new T.Group();asmRoot.add(interfGroup);
const matInterf=new T.MeshBasicMaterial({color:0xE0301E,transparent:true,opacity:.9,depthTest:false,side:T.DoubleSide});
function openInterfPM(){
  const a=curAsm();if(!a||a.comps.length<2){toast('Girişim algılamak için en az iki bileşen gerekli.');return}
  closeAsmPM(true);collapseIfExploded();asmUI.tool=null;setControlsForSketch(false);prompt_(null);
  asmUI.pm={type:'interf',running:false,done:false,progress:0,results:[],contacts:0,show:-1,includeContact:false};
  setGhost(true);renderAsmPM();renderAsmRibbon();runInterf();
}
function setGhost(on){for(const v of asmView.groups.values()){v.mat.transparent=on;v.mat.opacity=on?.22:1;v.mat.depthWrite=!on;v.mat.needsUpdate=true}if(!on)clearInterfView()}
function clearInterfView(){for(const c of [...interfGroup.children]){interfGroup.remove(c);c.geometry.dispose()}}
async function runInterf(){
  const P=asmUI.pm,a=curAsm();P.running=true;P.results=[];P.contacts=0;
  const items=a.comps.filter(c=>!c.hidden).map(c=>{const p=partById(c.part);const d=p?partData(p):null;return d&&d.polys.length?{c,polys:transformPolys(d.polys,new T.Matrix4().fromArray(c.T),c.id),vol:d.props?d.props.vol:0}:null}).filter(Boolean);
  items.forEach(it=>it.box=bboxPolys(it.polys));
  const pairs=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const A=items[i].box,B=items[j].box;let hit=true;for(let k=0;k<3;k++)if(A.max[k]<B.min[k]+1e-4||B.max[k]<A.min[k]+1e-4)hit=false;if(hit)pairs.push([items[i],items[j]])}
  P.total=pairs.length;
  for(let k=0;k<pairs.length;k++){
    if(asmUI.pm!==P)return;
    P.progress=k;renderAsmPM();await new Promise(r=>setTimeout(r,15));
    const [A,B]=pairs[k];let r=[];try{r=csgIntersect(A.polys,B.polys)}catch(e){continue}
    if(!r.length)continue;const mp=massProps(r);const vol=Math.abs(mp.vol);if(vol<0.01)continue;
    const thick=mp.area>0?2*vol/mp.area:0;
    const res={a:A.c.id,b:B.c.id,vol,thick,polys:r,contact:thick<0.12};
    if(res.contact)P.contacts++;P.results.push(res);
  }
  P.running=false;P.done=true;P.progress=P.total;showInterf(-1);renderAsmPM();asmStatus();
}
function showInterf(idx){
  const P=asmUI.pm;if(!P||P.type!=='interf')return;P.show=idx;clearInterfView();
  P.results.forEach((r,i)=>{if((idx<0&&(!r.contact||P.includeContact))||i===idx){const m=new T.Mesh(polysToBuffers(r.polys).g,matInterf);m.renderOrder=8;interfGroup.add(m)}});
}
function interfPMBody(){
  const P=asmUI.pm,a=curAsm();
  const list=P.results.filter(r=>!r.contact||P.includeContact);
  let b='';
  if(P.running)b+=grp('',`<div class="stat under"><i></i>Kontrol ediliyor… (${P.progress}/${P.total} çift)</div>`);
  else{
    b+=grp('',list.length?`<div class="stat over"><i></i>${list.length} girişim bulundu</div>`:`<div class="stat full"><i></i>Girişim yok</div>`);
    if(list.length)b+=grp('Girişimler',`<div class="lst">${P.results.map((r,i)=>(!r.contact||P.includeContact)?`<div style="cursor:pointer;${P.show===i?'outline:1px solid var(--accent)':''}" data-ish="${i}"><span>${esc(compName(a,compById(r.a)))} ↔ ${esc(compName(a,compById(r.b)))}: ${fmt(r.vol,2)} mm³${r.contact?' (temas)':''}</span></div>`:'').join('')}</div><button class="sbtn" data-ish="-1">Tümünü göster</button>`);
    b+=grp('Seçenekler',`<label class="chk"><input type="checkbox" data-icont ${P.includeContact?'checked':''}> Çakışan yüzeyleri (temas) girişim say</label><p class="note">${P.contacts?`${P.contacts} çiftte yalnızca yüzey teması var (örneğin aynı çaptaki mil ve delik); bunlar girişim sayılmıyor.`:'Yüzey teması olan çift yok.'}</p><button class="sbtn" data-irun>Yeniden hesapla</button>`);
  }
  return b;
}
function interfPmClick(e){
  const P=asmUI.pm;const s=e.target.closest('[data-ish]');if(s){showInterf(+s.dataset.ish);renderAsmPM();return true}
  if(e.target.closest('[data-irun]')){runInterf();return true}
  return false;
}
function interfPmChange(e){if(e.target.hasAttribute('data-icont')){asmUI.pm.includeContact=e.target.checked;showInterf(-1);renderAsmPM()}}

/* ================= MONTAJ RESMİ: PARÇA LİSTESİ ve BALONLAR ================= */
function bomItems(a){
  const order=[],map=new Map();
  for(const c of a.comps){if(!partById(c.part))continue;if(!map.has(c.part)){map.set(c.part,{qty:0,first:c.id});order.push(c.part)}map.get(c.part).qty++}
  return order.map((pid,i)=>{const p=partById(pid),d=partData(p),mat=MATERIALS[p.material]||MATERIALS.steel,it=map.get(pid);
    return {no:i+1,part:pid,name:p.partName,qty:it.qty,first:it.first,mat:p.mesh?'—':mat.name,mass:d.props?d.props.vol/1000*mat.rho:0}});
}
function bomMarkup(bom,layout,W,H,area){
  const cw=[12,62,14,58,34],RH=6,TW=180;let o='';
  const cells=(x,y,vals,bold)=>{let cx=x;let s='';vals.forEach((v,i)=>{const w=cw[i];const anchor=i===1||i===3?'start':'middle';const tx=anchor==='start'?cx+1.5:cx+w/2;
    s+=`<text class="${bold?'d-l':'d-t'}" x="${f2(tx)}" y="${f2(y+RH/2+1.1)}" font-size="${bold?2.4:2.9}" text-anchor="${anchor}">${esc(v)}</text>`;cx+=w});return s};
  const lines=(x,y,n)=>{let d='';for(let i=0;i<=n;i++)d+=Lp(x,y+i*RH,x+TW,y+i*RH);let cx=x;for(const w of [0,...cw]){cx+=w;d+=Lp(cx,y,cx,y+n*RH)}return `<path class="d-tb" d="${d}"/>`};
  const head=['Poz','Parça adı','Adet','Malzeme','Kütle'];
  const row=it=>[String(it.no),it.name.length>34?it.name.slice(0,33)+'…':it.name,String(it.qty),it.mat.length>30?it.mat.slice(0,29)+'…':it.mat,it.mass?massText(it.mass):'—'];
  const n=bom.length+1;
  if(layout==='full'){
    const x=W-10-TW,yb=H-10-36;const y=yb-n*RH;
    o+=lines(x,y,n);
    bom.slice().reverse().forEach((it,i)=>{o+=cells(x,y+i*RH,row(it),false)});
    o+=cells(x,y+bom.length*RH,head,true);
  }else{
    const x=W-(layout==='min'?12:8)-TW,y=area[1];
    o+=lines(x,y,n);o+=cells(x,y,head,true);bom.forEach((it,i)=>{o+=cells(x,y+(i+1)*RH,row(it),false)});
  }
  return o;
}
function balloonsMarkup(v,bom,area){
  if(!v)return '';const d=v.d;
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  for(const q of d.vis){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);mnx=Math.min(mnx,A[0],B[0]);mxx=Math.max(mxx,A[0],B[0]);mny=Math.min(mny,A[1],B[1]);mxy=Math.max(mxy,A[1],B[1])}
  const cx=(mnx+mxx)/2,cy=(mny+mxy)/2;const R=Math.hypot(mxx-mnx,mxy-mny)/2+10;
  const items=[];
  for(const it of bom){
    // bileşenin görünür kenarlarından, bileşenin ortasına en yakın nokta; başka bileşenin kenarına
    // çok yakın noktalar (ör. pimi saran deliğin ağzı) balonun hangi parçayı gösterdiğini belirsizleştirir, önce bunlardan kaçınılır
    const segs=d.vis.filter(q=>q[4]===it.first);if(!segs.length)continue;
    let sx=0,sy=0,sn=0;for(const q of segs){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const L=Math.hypot(B[0]-A[0],B[1]-A[1]);sx+=(A[0]+B[0])/2*L;sy+=(A[1]+B[1])/2*L;sn+=L}
    if(!sn)continue;const mx=sx/sn,my=sy/sn;
    const others=d.vis.filter(q=>q[4]!==it.first).map(q=>[v.map(q[0],q[1]),v.map(q[2],q[3])]);
    const clear=P=>{let m=Infinity;for(const [A,B] of others){const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));m=Math.min(m,Math.hypot(A[0]+dx*t-P[0],A[1]+dy*t-P[1]));if(m<2.5)break}return m};
    const cands=[];
    for(const q of segs){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((mx-A[0])*dx+(my-A[1])*dy)/L2:0;t=Math.max(0.15,Math.min(0.85,t));const P=[A[0]+dx*t,A[1]+dy*t];cands.push({P,dd:Math.hypot(P[0]-mx,P[1]-my)})}
    cands.sort((a,b)=>a.dd-b.dd);
    let best=null,bc=-1;for(const c of cands.slice(0,400)){const cl=clear(c.P);if(cl>=2.5){best=c.P;break}if(cl>bc){bc=cl;best=c.P}}
    items.push({no:it.no,P:best,ang:Math.atan2(best[1]-cy,best[0]-cx)});
  }
  items.sort((a,b)=>a.ang-b.ang);
  const minA=11/R;for(let k=0;k<3;k++)for(let i=1;i<items.length;i++){const d=items[i].ang-items[i-1].ang;if(d<minA){const push=(minA-d)/2;items[i-1].ang-=push;items[i].ang+=push}}
  let o='';const r=4.2;
  for(const it of items){
    let bx=cx+R*Math.cos(it.ang),by=cy+R*Math.sin(it.ang);bx=Math.max(area[0]+r+1,Math.min(area[2]-r-1,bx));by=Math.max(area[1]+r+1,Math.min(area[3]-r-1,by));
    const dx=it.P[0]-bx,dy=it.P[1]-by,L=Math.hypot(dx,dy)||1;const ex=bx+dx/L*r,ey=by+dy/L*r;
    o+=`<path class="d-thin" d="${Lp(ex,ey,it.P[0],it.P[1])}"/><circle class="d-tb" cx="${f2(bx)}" cy="${f2(by)}" r="${r}"/><path class="d-ar" d="M${f2(it.P[0]-0.7)} ${f2(it.P[1])}L${f2(it.P[0])} ${f2(it.P[1]-0.7)}L${f2(it.P[0]+0.7)} ${f2(it.P[1])}L${f2(it.P[0])} ${f2(it.P[1]+0.7)}Z"/><text class="d-t" x="${f2(bx)}" y="${f2(by+1.5)}" font-size="4" text-anchor="middle">${it.no}</text>`;
  }
  return o;
}
function openAsmDrawing(){const a=curAsm();if(!a){toast('Önce bir montaj oluştur.');return}project.cur.dw={kind:'asm',id:a.id};saveState();setTab('drawing')}
