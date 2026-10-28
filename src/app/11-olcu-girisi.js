/* Çizerken ölçü yazma: araç ilk noktayı aldıktan sonra rakam yazılınca giriş kutusu açılır.
   Girilen değerle öğe çizilir ve değer sürücü ölçü olarak eklenir (çizim hemen tanımlanır). */
let skInEl=null;
function skInputFields(){
  if(!sk||!sk.tool)return null;const t=sk.tool,st=sk.st;
  if((t==='line'||t==='centerline')&&st.start)return [['L','Uzunluk','mm']];
  if((t==='rect'||t==='crect')&&st.A)return [['W','Genişlik','mm'],['H','Yükseklik','mm']];
  if(t==='circle'&&st.c)return [['D','Çap','mm']];
  if(t==='polygon'&&st.c)return [['D','Çevre çapı','mm']];
  return null;
}
function closeSkInput(){if(skInEl){skInEl.remove();skInEl=null}}
function openSkInput(first){
  closeSkInput();const fl=skInputFields();if(!fl)return false;
  const q=sk.cursor||[0,0];const s=skToScreen(q[0],q[1]);const r=vpEl.getBoundingClientRect();
  const el=document.createElement('div');el.className='pop skin';
  el.innerHTML=fl.map(([k,l,u],i)=>`<label title="${esc(l)}"><span>${esc(l)}</span><input inputmode="decimal" data-skin="${k}" aria-label="${esc(l)}" value="${i===0?esc(first||''):''}" placeholder="${u}"></label>`).join('')+`<button class="ok" aria-label="Uygula">${IC.ok}</button><button aria-label="Kapat">${IC.x}</button>`;
  el.style.left=Math.max(4,Math.min(r.width-80-fl.length*110,s[0]+16))+'px';el.style.top=Math.max(4,Math.min(r.height-60,s[1]+16))+'px';
  vpEl.appendChild(el);skInEl=el;
  const ins=[...el.querySelectorAll('input')];const inp=ins[0];inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);
  const apply=()=>{const v={};for(const i of ins){const x=num(i.value);if(i.value.trim()===''&&i!==ins[0]){v[i.dataset.skin]=null;continue}if(!(isFinite(x)&&x>0)){i.style.borderColor='var(--warn)';i.focus();return}v[i.dataset.skin]=x}
    closeSkInput();applySkInput(v)};
  el.querySelector('.ok').onclick=apply;el.querySelectorAll('button')[1].onclick=closeSkInput;
  el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();
      // ilk alandan Enter: ikinci alan boşsa ona geç
      const i=ins.indexOf(document.activeElement);if(i>=0&&i<ins.length-1&&ins[i+1].value.trim()===''){ins[i+1].focus();return}apply()}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSkInput()}});
  return true;
}
/* ölçüyü yalnızca çizimi aşırı tanımlamıyorsa ekler */
function addDrivingDim(c){const f=sk.feat;if(!(sketchRank(f,[c])>sketchRank(f)))return false;c.id=newId(f,'c');c.val=Math.round(c.val*1e4)/1e4;f.cons.push(c);return true}
function applySkInput(v){
  if(!sk||!sk.tool)return;const f=sk.feat,st=sk.st,t=sk.tool,px=sk.px||0.3,tol=px*0.5,q=sk.cursor||[0,0];
  const n0=f.ents.length;
  if(t==='line'||t==='centerline'){
    const a=st.start,A=P2(a);const s=skSnap(q,px*9,A,null,a);let d=[s.x-A[0],s.y-A[1]];const l=Math.hypot(d[0],d[1]);d=l>1e-9?[d[0]/l,d[1]/l]:[1,0];
    toolClick([A[0]+d[0]*v.L,A[1]+d[1]*v.L],px,tol);
    const e=f.ents.length>n0?f.ents[f.ents.length-1]:null;
    if(e&&e.t==='line'){const P=P2(e.a),Q=P2(e.b);const m=[(P[0]+Q[0])/2,(P[1]+Q[1])/2];addDrivingDim({t:'d',p:e.a,q:e.b,val:v.L,lp:[m[0]-d[1]*px*22,m[1]+d[0]*px*22]})}
  }else if(t==='rect'||t==='crect'){
    const A=P2(st.A);const sx=Math.sign(q[0]-A[0])||1,sy=Math.sign(q[1]-A[1])||1;
    const W=v.W,H=v.H==null?v.W:v.H;const k=t==='rect'?1:0.5;
    toolClick([A[0]+sx*W*k,A[1]+sy*H*k],px,tol);
    const ls=f.ents.slice(n0).filter(e=>e.t==='line'&&!e.cons);
    const hz=ls.find(e=>Math.abs(P2(e.a)[1]-P2(e.b)[1])<1e-9),vt=ls.find(e=>Math.abs(P2(e.a)[0]-P2(e.b)[0])<1e-9);
    if(hz&&vt){const off=px*22;const ha=P2(hz.a),hb=P2(hz.b),va=P2(vt.a),vb=P2(vt.b);
      const cy=(P2(vt.a)[1]+P2(vt.b)[1])/2,cx=(ha[0]+hb[0])/2;
      addDrivingDim({t:'d',p:hz.a,q:hz.b,val:W,lp:[cx,ha[1]+(ha[1]>=cy?off:-off)]});
      addDrivingDim({t:'d',p:vt.a,q:vt.b,val:H,lp:[va[0]+(va[0]>=cx?off:-off),(va[1]+vb[1])/2]})}
  }else if(t==='circle'||t==='polygon'){
    const C=P2(st.c);let d=[q[0]-C[0],q[1]-C[1]];const l=Math.hypot(d[0],d[1]);d=l>1e-9?[d[0]/l,d[1]/l]:[1,0];
    toolClick([C[0]+d[0]*v.D/2,C[1]+d[1]*v.D/2],px,tol);
    const e=f.ents.slice(n0).find(x=>x.t==='circle');
    if(e)addDrivingDim({t:'ddia',e:e.id,val:v.D,lp:[C[0]+(v.D/2+px*24)*Math.SQRT1_2,C[1]+(v.D/2+px*24)*Math.SQRT1_2]});
  }
  if(f.ents.length>n0){solveSketch(f);skChanged();if(sk.isNew&&f.cons.filter(x=>DIMT.has(x.t)).length<=2)fitSketch()}
}
TOOLHELP.line+=' İlk noktadan sonra rakam yazarsan uzunluk girilir ve ölçü olarak eklenir.';
TOOLHELP.rect+=' İlk köşeden sonra rakam yazarsan genişlik ve yükseklik girilir.';
TOOLHELP.crect+=' Merkezden sonra rakam yazarsan genişlik ve yükseklik girilir.';
TOOLHELP.circle+=' Merkezden sonra rakam yazarsan çap girilir.';
