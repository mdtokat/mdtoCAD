/* PDF yazıcı (bağımlılıksız), SVG→PDF dönüştürücü, 3B görüntü çıktısı, PDF penceresi. */
/* ================= PDF DIŞA AKTARMA ================= */
/* Kendi küçük PDF yazıcımız: çizgiler vektörel, Türkçe karakterler Helvetica + özel kodlama ile */
const PDF_K=72/25.4;
const PDF_DIFF={'Ğ':128,'ğ':129,'Ş':130,'ş':131,'İ':132,'ı':133,'−':134};
const PDF_WIN={'–':150,'—':151,'‘':145,'’':146,'“':147,'”':148,'•':149,'€':0};
function pdfStr(s){
  let o='';
  for(const ch of String(s)){
    let c=ch.codePointAt(0);
    if(PDF_DIFF[ch]!==undefined)c=PDF_DIFF[ch];else if(PDF_WIN[ch])c=PDF_WIN[ch];else if(ch==='…'){o+='...';continue}
    else if(c>255||(c>=128&&c<160))c=63;
    const x=String.fromCharCode(c);o+=(x==='('||x===')'||x==='\\')?'\\'+x:x;
  }
  return '('+o+')';
}
const pn_=n=>{const v=Math.round(n*1000)/1000;return (Object.is(v,-0)?0:v).toString()};
let measureCtx=null;
function textW(t,size,bold){if(!measureCtx)measureCtx=document.createElement('canvas').getContext('2d');measureCtx.font=(bold?'bold ':'')+'100px Helvetica, Arial, sans-serif';return measureCtx.measureText(t).width*size/100}
const PDF_STY={'d-vis':{w:.5},'d-hid':{w:.25,dash:[2.2,1.1]},'d-cen':{w:.18,dash:[7,1.1,.8,1.1]},'d-thin':{w:.18},'d-frame':{w:.7},'d-tb':{w:.35},'d-ar':{fill:true}};
const TZ=86;   // dar yazı görünümü için yatay ölçek (%)
function svgToPdfOps(markup,W,H){
  const doc=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,'image/svg+xml');
  const out=[`${pn_(PDF_K)} 0 0 ${pn_(-PDF_K)} 0 ${pn_(H*PDF_K)} cm`,'1 J 1 j 0 G 0 g'];
  const style=cls=>PDF_STY[cls]||null;
  const setStroke=st=>{out.push(`${pn_(st.w)} w`);out.push(st.dash?`[${st.dash.map(pn_).join(' ')}] 0 d`:'[] 0 d')};
  const walk=el=>{
    for(const n of el.children){
      const tag=n.tagName.toLowerCase();if(tag==='style')continue;
      const a=k=>n.getAttribute(k);const cls=(a('class')||'').split(/\s+/)[0];const st=style(cls);
      if(tag==='g'){walk(n);continue}
      if(tag==='rect'){
        const x=+a('x'),y=+a('y'),w=+a('width'),h=+a('height');
        if(st){setStroke(st);out.push(`${pn_(x)} ${pn_(y)} ${pn_(w)} ${pn_(h)} re S`)}
        continue;
      }
      if(tag==='path'&&st){
        const d=a('d')||'';let ops='';const re=/([MLZ])([^MLZ]*)/gi;let m;
        while((m=re.exec(d))){const c=m[1].toUpperCase();const nums=m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
          if(c==='Z'){ops+='h ';continue}for(let i=0;i+1<nums.length;i+=2)ops+=`${pn_(nums[i])} ${pn_(nums[i+1])} ${(c==='M'&&i===0)?'m':'l'} `}
        if(!ops)continue;
        if(st.fill)out.push(ops+'f');else{setStroke(st);out.push(ops+'S')}
        continue;
      }
      if(tag==='circle'&&st){
        const cx=+a('cx'),cy=+a('cy'),r=+a('r'),k=r*0.5523;setStroke(st);
        out.push(`${pn_(cx+r)} ${pn_(cy)} m ${pn_(cx+r)} ${pn_(cy+k)} ${pn_(cx+k)} ${pn_(cy+r)} ${pn_(cx)} ${pn_(cy+r)} c ${pn_(cx-k)} ${pn_(cy+r)} ${pn_(cx-r)} ${pn_(cy+k)} ${pn_(cx-r)} ${pn_(cy)} c ${pn_(cx-r)} ${pn_(cy-k)} ${pn_(cx-k)} ${pn_(cy-r)} ${pn_(cx)} ${pn_(cy-r)} c ${pn_(cx+k)} ${pn_(cy-r)} ${pn_(cx+r)} ${pn_(cy-k)} ${pn_(cx+r)} ${pn_(cy)} c S`);
        continue;
      }
      if(tag==='text'){
        const t=n.textContent||'';if(!t.trim())continue;
        const size=+a('font-size')||3.5,bold=(a('font-weight')||'')>='600';const anchor=a('text-anchor')||'start';
        let x=+a('x'),y=+a('y'),ang=0;const tr=a('transform');if(tr){const mm=tr.match(/rotate\(([-\d.e]+)/);if(mm)ang=+mm[1]*Math.PI/180}
        const w=textW(t,size,bold)*TZ/100;const dx=anchor==='middle'?-w/2:anchor==='end'?-w:0;
        const c=Math.cos(ang),s=Math.sin(ang);
        out.push(`BT ${cls==='d-l'?'0.33 g':'0 g'} /${bold?'F2':'F1'} ${pn_(size)} Tf ${TZ} Tz ${pn_(c)} ${pn_(s)} ${pn_(s)} ${pn_(-c)} ${pn_(x)} ${pn_(y)} Tm ${pn_(dx*100/TZ)} 0 Td ${pdfStr(t)} Tj ET`);
        continue;
      }
      if(tag==='image'){
        const id=a('data-img');if(id==null)continue;const x=+a('x'),y=+a('y'),w=+a('width'),h=+a('height');
        out.push(`q ${pn_(w)} 0 0 ${pn_(-h)} ${pn_(x)} ${pn_(y+h)} cm /Im${id} Do Q`);continue;
      }
    }
  };
  walk(doc.documentElement);
  return out.join('\n');
}
const latin1=s=>{const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&255;return a};
async function deflate(bytes){
  if(typeof CompressionStream==='undefined')return null;
  try{const cs=new CompressionStream('deflate');const w=cs.writable.getWriter();w.write(bytes);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}catch(e){return null}
}
function utf16hex(s){let h='FEFF';for(const ch of s){const c=ch.charCodeAt(0);h+=c.toString(16).padStart(4,'0').toUpperCase()}return '<'+h+'>'}
async function buildPdf(pages,title){
  const chunks=[];let off=0;const offs=[];
  const put=b=>{if(typeof b==='string')b=latin1(b);chunks.push(b);off+=b.length};
  const obj=(id,dict,stream)=>{offs[id]=off;put(`${id} 0 obj\n`);put(dict);if(stream){put('\nstream\n');put(stream);put('\nendstream')}put('\nendobj\n')};
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  let next=6;const pageIds=[];const plan=[];
  for(const pg of pages){const pid=next++,cid=next++;const imgIds=pg.images.map(()=>next++);pageIds.push(pid);plan.push({pg,pid,cid,imgIds})}
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,`<< /Type /Pages /Kids [${pageIds.map(i=>i+' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
  obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding 5 0 R >>');
  obj(4,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding 5 0 R >>');
  obj(5,'<< /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [128 /Gbreve /gbreve /Scedilla /scedilla /Idotaccent /dotlessi /minus] >>');
  for(const {pg,pid,cid,imgIds} of plan){
    const xo=imgIds.length?`/XObject << ${imgIds.map((id,i)=>`/Im${i} ${id} 0 R`).join(' ')} >>`:'';
    obj(pid,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pn_(pg.W*PDF_K)} ${pn_(pg.H*PDF_K)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xo} >> /Contents ${cid} 0 R >>`);
    const raw=latin1(pg.content);const z=await deflate(raw);
    obj(cid,z?`<< /Length ${z.length} /Filter /FlateDecode >>`:`<< /Length ${raw.length} >>`,z||raw);
    pg.images.forEach((im,i)=>obj(imgIds[i],`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`,im.bytes));
  }
  const infoId=next++;obj(infoId,`<< /Title ${utf16hex(title||'Tezgâh CAD')} /Producer ${utf16hex('Tezgâh CAD')} /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)}) >>`);
  const xref=off;let x=`xref\n0 ${next}\n0000000000 65535 f \n`;for(let i=1;i<next;i++)x+=String(offs[i]||0).padStart(10,'0')+' 00000 n \n';
  put(x);put(`trailer\n<< /Size ${next} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks,{type:'application/pdf'});
}

/* 3B görünüşü beyaz zeminde, ölçekli (ortografik) görüntü olarak çiz */
function viewBasis(view){
  if(view==='current'){
    const z=camera.position.clone().sub(controls.target).normalize();const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    return {z,up:up.sub(z.clone().multiplyScalar(up.dot(z))).normalize()};
  }
  const D={iso:[1,1,1],dimetric:[1,0.6,1.6],front:[0,0,1],top:[0,1,0],right:[1,0,0],back:[0,0,-1]}[view]||[1,1,1];
  const z=new T.Vector3(...D).normalize();let up=view==='top'?new T.Vector3(0,0,-1):new T.Vector3(0,1,0);
  up=up.sub(z.clone().multiplyScalar(up.dot(z))).normalize();return {z,up};
}
function projExtents(z,up){
  const R=new T.Vector3().crossVectors(up,z);let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity,c0=Infinity,c1=-Infinity;
  for(const p of dwSrc().polys)for(const v of p.verts){const a=v.x*R.x+v.y*R.y+v.z*R.z,b=v.x*up.x+v.y*up.y+v.z*up.z,c=v.x*z.x+v.y*z.y+v.z*z.z;if(a<a0)a0=a;if(a>a1)a1=a;if(b<b0)b0=b;if(b>b1)b1=b;if(c<c0)c0=c;if(c>c1)c1=c}
  return {R,a0,a1,b0,b1,c0,c1};
}
function render3DImage(o){
  const cvs=document.createElement('canvas');cvs.width=o.w;cvs.height=o.h;
  const r=new T.WebGLRenderer({canvas:cvs,antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(1);r.setSize(o.w,o.h,false);r.setClearColor(0xffffff,1);
  const sc=new T.Scene();sc.add(new T.HemisphereLight(0xffffff,0x8a94a0,.78));
  const dl=new T.DirectionalLight(0xffffff,.55);dl.position.copy(o.z.clone().add(o.up.clone().multiplyScalar(.7)).add(o.R.clone().multiplyScalar(-.3)));sc.add(dl);
  const mats=[];const doc=dwDoc();let items;
  if(doc.kind==='asm'){const a=doc.a,f=dwS(doc).explode?1:0;const pidx={};project.parts.forEach((p,i)=>pidx[p.id]=i);
    items=a.comps.filter(c=>!c.hidden&&partById(c.part)).map(c=>{const d=partData(partById(c.part));return {g:d.g,eg:d.eg,M:dispM(a,c,f),color:PAL[pidx[c.part]%PAL.length]}})}
  else{const d=partData(doc.p);items=[{g:d.g,eg:d.eg,M:null,color:0xBCC6CF}]}
  const lm_=new T.LineBasicMaterial({color:0x101418});mats.push(lm_);
  for(const it of items){
    const grp=new T.Group();if(it.M){grp.matrixAutoUpdate=false;grp.matrix.copy(it.M)}
    if(o.style!=='wire'){const m=new T.MeshStandardMaterial({color:it.color,metalness:.12,roughness:.62,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});mats.push(m);grp.add(new T.Mesh(it.g,m))}
    if(o.style!=='shaded')grp.add(new T.LineSegments(it.eg,lm_));
    sc.add(grp);
  }
  const cam=new T.OrthographicCamera(-o.hw,o.hw,o.hh,-o.hh,0.1,o.depth*2+20);
  cam.position.copy(o.center.clone().addScaledVector(o.z,o.depth+10));cam.up.copy(o.up);cam.lookAt(o.center);cam.updateProjectionMatrix();
  r.render(sc,cam);
  // beyaz zemini tam beyaz yap (JPEG'de görünür kutu olmasın)
  const c2=document.createElement('canvas');c2.width=o.w;c2.height=o.h;const x2=c2.getContext('2d');x2.drawImage(cvs,0,0);
  try{const id=x2.getImageData(0,0,o.w,o.h),d=id.data;for(let i=0;i<d.length;i+=4){if(d[i]>246&&d[i+1]>246&&d[i+2]>246){d[i]=d[i+1]=d[i+2]=255}}x2.putImageData(id,0,0)}catch(e){}
  const url=c2.toDataURL('image/jpeg',0.93);
  mats.forEach(m=>m.dispose());r.dispose();if(r.forceContextLoss)r.forceContextLoss();
  return url;
}
function maxRenderSize(){try{const gl=renderer.getContext();return Math.min(4096,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_TEXTURE_SIZE))}catch(e){return 2048}}
function build3DPage(opt,preview){
  const {W,H}=opt;const info=sheetInfo(opt.paper);
  let o=[`<style>${SHEET_CSS}</style>`,`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`,frameMarkup(W,H,opt.layout)];
  const VN={iso:'izometrik',dimetric:'dimetrik',current:'ekran görünümü',front:'önden',top:'üstten',right:'sağdan',back:'arkadan'};
  if(!dwSrc().polys.length){info.scale='—';o.push(footerMarkup(W,H,opt.layout,info));return {markup:o.join(''),images:[],scale:null}}
  let [x0,y0,x1,y1]=areaFor(W,H,opt.layout);
  const {z,up}=viewBasis(opt.view);const E=projExtents(z,up);
  const ew=Math.max(E.a1-E.a0,1e-3),eh=Math.max(E.b1-E.b0,1e-3);const aw=x1-x0,ah=y1-y0;
  const sFit=Math.min(aw/ew,ah/eh)*0.9;
  const s=opt.scale==='auto'?(STD_SCALES.find(x=>x<=sFit*1.0001)||STD_SCALES[STD_SCALES.length-1]):+opt.scale;
  // görüntü yalnızca parçanın kapladığı alan kadar (biraz pay ile) üretilir
  const pad=4;let iw=Math.min(aw,ew*s+pad*2),ih=Math.min(ah,eh*s+pad*2);
  const ix=x0+(aw-iw)/2,iy=y0+(ah-ih)/2;
  const ac=(E.a0+E.a1)/2,bc=(E.b0+E.b1)/2,cc=(E.c0+E.c1)/2;
  const center=E.R.clone().multiplyScalar(ac).addScaledVector(up,bc).addScaledVector(z,cc);
  const dpi=preview?Math.min(110,700/Math.max(iw,ih)*25.4):(opt.dpi||220);
  let pw=Math.round(iw/25.4*dpi),ph=Math.round(ih/25.4*dpi);const mx=preview?900:maxRenderSize();const k=Math.min(1,mx/Math.max(pw,ph));pw=Math.max(8,Math.round(pw*k));ph=Math.max(8,Math.round(ph*k));
  const url=render3DImage({w:pw,h:ph,z,up,R:E.R,center,hw:iw/2/s,hh:ih/2/s,depth:(E.c1-E.c0)/2+Math.max(ew,eh),style:opt.style});
  o.push(`<image x="${f2(ix)}" y="${f2(iy)}" width="${f2(iw)}" height="${f2(ih)}" data-img="0" href="${url}" preserveAspectRatio="none"/>`);
  info.scale=scaleLabel(s);info.extra=VN[opt.view]?`(${VN[opt.view]} görünüş)`:'';
  o.push(footerMarkup(W,H,opt.layout,info));
  return {markup:o.join(''),images:[{url,w:pw,h:ph}],scale:s,dpi:Math.round(pw/(iw/25.4))};
}
function dataURLBytes(u){const b=atob(u.split(',')[1]);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}

/* ---------- PDF penceresi ---------- */
const pdfOpt={doc:null,kind:'2d',paper:'A3',orient:'landscape',layout:'full',scale:'auto',view:'iso',style:'shadedEdges'};
const LAYOUTS=[['full','Antetli','Çerçeve ve tam antet (çizen, malzeme, kütle, ölçek…)'],['min','Parça adı ve ölçek','Çerçeve ve antet yok, altta yalnızca parça adı ile ölçek'],['none','Yalnızca parça','Sadece parça görüntüsü, hiçbir yazı yok']];
function openPdfDialog(kind){
  if(sk)exitSketch(true);if(pm)closePM(true);
  pdfOpt.kind=kind||pdfOpt.kind;
  const a=curAsm();
  if(activeTab==='asm'&&a)pdfOpt.doc={kind:'asm',id:a.id};
  else if(activeTab==='drawing'){const d=dwDoc();pdfOpt.doc=d.kind==='asm'?{kind:'asm',id:d.a.id}:{kind:'part',id:state.id}}
  else pdfOpt.doc={kind:'part',id:state.id};
  const S=withDoc(()=>dwS());pdfOpt.paper=S.paper||'A3';pdfOpt.orient=S.orient||'landscape';
  $('#pdfDlg').classList.add('on');renderPdfOpts();schedulePdfPreview();
}
function closePdfDialog(){$('#pdfDlg').classList.remove('on')}
function renderPdfOpts(){
  const o=pdfOpt;const sel=(id,opts,v)=>`<select data-po="${id}">${opts.map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t}</option>`).join('')}</select>`;
  const seg=(id,opts,v)=>`<div class="seg">${opts.map(([k,t])=>`<button type="button" data-ps="${id}" data-v="${k}" class="${k===v?'on':''}">${t}</button>`).join('')}</div>`;
  const docOpts=[...project.parts.map(p=>['p:'+p.id,'Parça: '+p.partName]),...project.asms.map(a=>['a:'+a.id,'Montaj: '+a.name])];
  let h=`<label class="fld"><span>Belge</span>${sel('doc',docOpts.map(([k,t])=>[k,esc(t)]),(o.doc.kind==='asm'?'a:':'p:')+o.doc.id)}</label><div class="grp-t">İçerik</div>`+seg('kind',[['2d','2B teknik resim'],['3d','3B görünüş']],o.kind);
  h+=`<div class="row2"><label class="fld"><span>Kağıt boyutu</span>${sel('paper',[['A4','A4 (297×210)'],['A3','A3 (420×297)'],['A2','A2 (594×420)'],['A1','A1 (841×594)'],['A0','A0 (1189×841)']],o.paper)}</label><label class="fld"><span>Yön</span>${sel('orient',[['landscape','Yatay'],['portrait','Dikey']],o.orient)}</label></div>`;
  h+=`<div class="grp-t">Sayfa düzeni</div>`+LAYOUTS.map(([k,t,d])=>`<label class="radio ${o.layout===k?'on':''}"><input type="radio" name="playout" value="${k}" ${o.layout===k?'checked':''}><span>${t}<small>${d}</small></span></label>`).join('');
  h+=`<label class="fld" style="margin-top:8px"><span>Ölçek</span>${sel('scale',[['auto','Otomatik (kağıda sığdır)'],['10','10:1'],['5','5:1'],['2','2:1'],['1','1:1'],['0.5','1:2'],['0.2','1:5'],['0.1','1:10'],['0.05','1:20']],o.scale)}</label>`;
  if(o.kind==='3d'){
    h+=`<div class="row2"><label class="fld"><span>Görünüm</span>${sel('view',[['iso','İzometrik'],['dimetric','Dimetrik'],['current','Ekrandaki görünüm'],['front','Ön'],['top','Üst'],['right','Sağ'],['back','Arka']],o.view)}</label><label class="fld"><span>Görüntü</span>${sel('style',[['shadedEdges','Gölgeli, kenarlı'],['shaded','Gölgeli'],['wire','Tel kafes']],o.style)}</label></div>`;
    h+=`<p class="note">3B görünüş ortografik olarak (perspektifsiz) çizilir, böylece ölçek gerçektir.</p>`;
  }else h+=`<p class="note">Görünüşler, gizli çizgiler, eksenler ve ölçüler Teknik Resim sekmesindeki ayarlara göre çizilir. Çizgiler ve yazılar vektöreldir.</p>`;
  $('#pdfOpts').innerHTML=h;
  if(o.kind==='2d'&&o.doc.kind==='asm')h+=`<p class="note">Montaj resmi; görünüşler, patlatma, balonlar ve parça listesi Teknik Resim sekmesindeki montaj ayarlarına göre çizilir.</p>`;
  $('#pdfGo').disabled=false;$('#pdfMsg').textContent='';
}
function pdfPageSize(){const P=PAPERS[pdfOpt.paper]||PAPERS.A3;return pdfOpt.orient==='portrait'?{W:P.H,H:P.W}:{W:P.W,H:P.H}}
let pdfPrevT=0;
function schedulePdfPreview(){clearTimeout(pdfPrevT);$('#pdfPrev').style.opacity=.5;pdfPrevT=setTimeout(renderPdfPreview,60)}
function withDoc(fn){const prev=dwOverride;dwOverride=pdfOpt.doc;try{return fn()}finally{dwOverride=prev}}
function renderPdfPreview(){withDoc(renderPdfPreview_)}
function renderPdfPreview_(){
  const {W,H}=pdfPageSize();let markup='',info='';
  try{
    if(pdfOpt.kind==='2d'){const r=buildSheet(true,{W,H,layout:pdfOpt.layout,scale:pdfOpt.scale,paperLabel:pdfOpt.paper});markup=r.markup;info=`Ölçek ${scaleLabel(r.ctx.scale)}`}
    else{const r=build3DPage({W,H,layout:pdfOpt.layout,scale:pdfOpt.scale,view:pdfOpt.view,style:pdfOpt.style,paper:pdfOpt.paper},true);markup=r.markup;info=r.scale?`Ölçek ${scaleLabel(r.scale)}`:''}
  }catch(e){console.error(e);info='Önizleme oluşturulamadı: '+(e.message||e)}
  const box=$('#pdfPrev');box.style.aspectRatio=`${W}/${H}`;
  box.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${markup}</svg>`;box.style.opacity=1;
  $('#pdfInfo').textContent=`${pdfOpt.paper} ${pdfOpt.orient==='portrait'?'dikey':'yatay'} (${W}×${H} mm). ${info}`;
}
$('#pdfDlg').addEventListener('click',e=>{
  if(e.target.id==='pdfDlg'){closePdfDialog();return}
  const b=e.target.closest('[data-pdf]');if(b){if(b.dataset.pdf==='close')closePdfDialog();else exportPdf();return}
  const s=e.target.closest('[data-ps]');if(s){pdfOpt[s.dataset.ps]=s.dataset.v;renderPdfOpts();schedulePdfPreview()}
});
$('#pdfDlg').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.po==='doc'){const [k,id]=t.value.split(':');pdfOpt.doc={kind:k==='a'?'asm':'part',id};renderPdfOpts();schedulePdfPreview();return}
  if(t.dataset.po){pdfOpt[t.dataset.po]=t.value;if(t.dataset.po==='kind')renderPdfOpts();schedulePdfPreview()}
  if(t.name==='playout'){pdfOpt.layout=t.value;renderPdfOpts();schedulePdfPreview()}
});
async function makePdf(){const prev=dwOverride;dwOverride=pdfOpt.doc;try{return await makePdf_()}finally{dwOverride=prev}}
async function makePdf_(){
  const {W,H}=pdfPageSize();let page;
  if(pdfOpt.kind==='2d'){const r=buildSheet(true,{W,H,layout:pdfOpt.layout,scale:pdfOpt.scale,paperLabel:pdfOpt.paper});page={W,H,content:svgToPdfOps(r.markup,W,H),images:[]}}
  else{const r=build3DPage({W,H,layout:pdfOpt.layout,scale:pdfOpt.scale,view:pdfOpt.view,style:pdfOpt.style,paper:pdfOpt.paper},false);
    page={W,H,content:svgToPdfOps(r.markup,W,H),images:r.images.map(im=>({bytes:dataURLBytes(im.url),w:im.w,h:im.h}))}}
  const nm=dwSrc().name;const blob=await buildPdf([page],nm+(pdfOpt.kind==='2d'?' teknik resim':' 3B görünüş'));
  return {blob,fn:`${fileSafe(nm)}-${pdfOpt.kind==='2d'?'teknik-resim':'3B'}-${pdfOpt.paper}.pdf`};
}
async function exportPdf(){
  const go=$('#pdfGo');go.disabled=true;$('#pdfMsg').textContent='PDF hazırlanıyor…';
  await new Promise(r=>setTimeout(r,30));
  try{const {blob,fn}=await makePdf();$('#pdfMsg').textContent='';await saveFile(fn,blob)}
  catch(e){console.error(e);$('#pdfMsg').textContent='';toast('PDF oluşturulamadı: '+(e.message||e))}
  go.disabled=false;
}
