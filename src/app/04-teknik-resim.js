/* Teknik resim: görünüş üretimi (gizli çizgi), sayfa düzeni, antet, ölçüler, SVG/PNG. */
/* ================= TEKNİK RESİM ================= */
const VIEWS={
  front:{D:[0,0,-1],R:[1,0,0],U:[0,1,0],name:'Ön görünüş'},
  top:{D:[0,-1,0],R:[1,0,0],U:[0,0,-1],name:'Üst görünüş'},
  left:{D:[1,0,0],R:[0,0,1],U:[0,1,0],name:'Soldan görünüş'},
  right:{D:[-1,0,0],R:[0,0,-1],U:[0,1,0],name:'Sağdan görünüş'},
  iso:(()=>{const s3=Math.sqrt(3),s6=Math.sqrt(6),s2=Math.SQRT2;return {D:[-1/s3,-1/s3,-1/s3],U:[-1/s6,2/s6,-1/s6],R:[1/s2,0,-1/s2],name:'İzometrik'}})()
};
const RES=1024;let depthRT=null,depthBuf=null;let vcache={version:-1};
const dot3=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
function renderDepth(D,U,c,rad){
  if(!depthRT){depthRT=new T.WebGLRenderTarget(RES,RES,{minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});depthBuf=new Uint8Array(RES*RES*4)}
  const near=rad*.5,far=rad*3.5;
  const cam=new T.OrthographicCamera(-rad,rad,rad,-rad,near,far);
  const camPos=[c[0]-D[0]*rad*2,c[1]-D[1]*rad*2,c[2]-D[2]*rad*2];
  cam.position.set(...camPos);cam.up.set(...U);cam.lookAt(c[0],c[1],c[2]);cam.updateMatrixWorld();cam.updateProjectionMatrix();
  const pc=renderer.getClearColor(new T.Color()),pa=renderer.getClearAlpha();
  renderer.setScissorTest(false);
  renderer.setRenderTarget(depthRT);renderer.setClearColor(0xffffff,1);renderer.clear(true,true,true);
  renderer.render(depthScene,cam);
  renderer.readRenderTargetPixels(depthRT,0,0,RES,RES,depthBuf);
  renderer.setRenderTarget(null);renderer.setClearColor(pc,pa);
  const out=new Float32Array(RES*RES);
  for(let i=0,j=0;i<out.length;i++,j+=4)out[i]=(depthBuf[j]/16777216+depthBuf[j+1]/65536+depthBuf[j+2]/256+depthBuf[j+3])/256;
  return {dep:out,near,far,camPos};
}
function viewData(key,alt){
  const src=alt||dwSrc();
  if(!vcache.m)vcache={m:new Map()};const ck=src.key+'|'+key;
  if(vcache.m.has(ck))return vcache.m.get(ck);
  depthMesh.geometry=src.g;
  const VW=VIEWS[key],D=VW.D,R=VW.R,U=VW.U;
  let mnA=Infinity,mxA=-Infinity,mnB=Infinity,mxB=-Infinity;
  for(const p of src.polys)for(const v of p.verts){const a=v.x*R[0]+v.y*R[1]+v.z*R[2],b=v.x*U[0]+v.y*U[1]+v.z*U[2];if(a<mnA)mnA=a;if(a>mxA)mxA=a;if(b<mnB)mnB=b;if(b>mxB)mxB=b}
  const bx=src.box;const c=[(bx.min[0]+bx.max[0])/2,(bx.min[1]+bx.max[1])/2,(bx.min[2]+bx.max[2])/2];
  const rad=Math.max(1,Math.hypot(bx.max[0]-bx.min[0],bx.max[1]-bx.min[1],bx.max[2]-bx.min[2])/2*1.04);
  const dp=renderDepth(D,U,c,rad);const dep=dp.dep;
  const pix=2*rad/RES,eps01=(pix*2.5+.01)/(dp.far-dp.near);
  const isVis=(x,y,z)=>{
    const rx=x-c[0],ry=y-c[1],rz=z-c[2];
    const a=rx*R[0]+ry*R[1]+rz*R[2],b=rx*U[0]+ry*U[1]+rz*U[2];
    const dist=(x-dp.camPos[0])*D[0]+(y-dp.camPos[1])*D[1]+(z-dp.camPos[2])*D[2];
    const d01=(dist-dp.near)/(dp.far-dp.near);
    const ix=Math.floor((a/rad*.5+.5)*RES),iy=Math.floor((b/rad*.5+.5)*RES);
    let mx=0;for(let j=-1;j<=1;j++){const Y=Math.min(RES-1,Math.max(0,iy+j));for(let i=-1;i<=1;i++){const X=Math.min(RES-1,Math.max(0,ix+i));const v=dep[Y*RES+X];if(v>mx)mx=v}}
    return d01<=mx+eps01;
  };
  const edges=computeEdges(src.polys,{x:D[0],y:D[1],z:D[2]},src.kind==='asm');
  const vis=[],hid=[];
  for(const s of edges){
    const a1=dot3(s.a,R),b1=dot3(s.a,U),a2=dot3(s.b,R),b2=dot3(s.b,U);
    const pl=Math.hypot(a2-a1,b2-b1);if(pl<1e-4)continue;
    const N=Math.min(400,Math.max(1,Math.ceil(pl/pix/1.5)));
    let cls=new Uint8Array(N);
    for(let i=0;i<N;i++){const t=(i+.5)/N;cls[i]=isVis(s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t,s.a[2]+(s.b[2]-s.a[2])*t)?1:0}
    if(N>=3){const c2=cls.slice();for(let i=1;i<N-1;i++)c2[i]=(cls[i-1]+cls[i]+cls[i+1])>=2?1:0;cls=c2}
    let st=0;
    for(let i=1;i<=N;i++){if(i===N||cls[i]!==cls[st]){const t0=st/N,t1=i/N;(cls[st]?vis:hid).push([a1+(a2-a1)*t0,b1+(b2-b1)*t0,a1+(a2-a1)*t1,b1+(b2-b1)*t1,s.pa?s.pa.shared:null]);st=i}}
  }
  const circ=[],axRaw=[],threads=[];
  for(const an of src.ann){
    const A=[an.A.x,an.A.y,an.A.z],C=[an.C.x,an.C.y,an.C.z];const dd=dot3(A,D);
    if(an.thread){const th=an.thread;if(Math.abs(dd)>.99)threads.push({t:'arc',a:dot3(C,R),b:dot3(C,U),R:th.R});else if(Math.abs(dd)<.02){const P0=[C[0]+A[0]*th.t0,C[1]+A[1]*th.t0,C[2]+A[2]*th.t0],P1=[C[0]+A[0]*th.t1,C[1]+A[1]*th.t1,C[2]+A[2]*th.t1];const a0=dot3(P0,R),b0=dot3(P0,U),a1=dot3(P1,R),b1=dot3(P1,U);const L=Math.hypot(a1-a0,b1-b0)||1;const nx=-(b1-b0)/L,ny=(a1-a0)/L;for(const sg of [1,-1])threads.push({t:'line',s:[a0+nx*th.R*sg,b0+ny*th.R*sg,a1+nx*th.R*sg,b1+ny*th.R*sg]})}}
    if(Math.abs(dd)>.99)circ.push({a:dot3(C,R),b:dot3(C,U),r:an.r,gid:an.gid,op:an.op,label:an.label,txt:an.txt});
    else if(Math.abs(dd)<.02){const P0=[C[0]+A[0]*an.t0,C[1]+A[1]*an.t0,C[2]+A[2]*an.t0],P1=[C[0]+A[0]*an.t1,C[1]+A[1]*an.t1,C[2]+A[2]*an.t1];axRaw.push([dot3(P0,R),dot3(P0,U),dot3(P1,R),dot3(P1,U)])}
  }
  const mm=new Map();for(const q of circ){const k=Math.round(q.a*100)+'_'+Math.round(q.b*100);const o=mm.get(k);if(!o||o.r<q.r)mm.set(k,{a:q.a,b:q.b,r:q.r})}
  const lines=new Map();
  for(const s of axRaw){
    let dx=s[2]-s[0],dy=s[3]-s[1];const l=Math.hypot(dx,dy);if(l<1e-6)continue;dx/=l;dy/=l;
    if(dx<-1e-6||(Math.abs(dx)<=1e-6&&dy<0)){dx=-dx;dy=-dy}
    const off=-dy*s[0]+dx*s[1];const t0=dx*s[0]+dy*s[1],t1=dx*s[2]+dy*s[3];
    const k=Math.round(dx*1000)+'_'+Math.round(dy*1000)+'_'+Math.round(off*100);
    const o=lines.get(k);const lo=Math.min(t0,t1),hi=Math.max(t0,t1);
    if(o){o.lo=Math.min(o.lo,lo);o.hi=Math.max(o.hi,hi)}else lines.set(k,{dx,dy,off,lo,hi});
  }
  const axes=[...lines.values()].map(o=>{const px=-o.dy*o.off,py=o.dx*o.off;return [px+o.dx*o.lo,py+o.dy*o.lo,px+o.dx*o.hi,py+o.dy*o.hi]});
  const secPolys=src.sec?src.polys.filter(p=>String(p.shared).startsWith('SEC')).map(p=>({g:String(p.shared),pts:p.verts.map(v=>[v.x*R[0]+v.y*R[1]+v.z*R[2],v.x*U[0]+v.y*U[1]+v.z*U[2]])})):[];
  const res={vis,hid,bb:{minA:mnA,maxA:mxA,minB:mnB,maxB:mxB},circ,marks:[...mm.values()],axes,threads,secPolys};
  vcache.m.set(ck,res);if(vcache.m.size>40)vcache.m.delete(vcache.m.keys().next().value);return res;
}

const SHEET_CSS=`.d-vis{fill:none;stroke:#000;stroke-width:.5;stroke-linecap:round;stroke-linejoin:round}.d-hid{fill:none;stroke:#000;stroke-width:.25;stroke-dasharray:2.2 1.1}.d-cen{fill:none;stroke:#000;stroke-width:.18;stroke-dasharray:7 1.1 .8 1.1}.d-thin{fill:none;stroke:#000;stroke-width:.18}.d-frame{fill:none;stroke:#000;stroke-width:.7}.d-tb{fill:none;stroke:#000;stroke-width:.35}.d-ar{fill:#000;stroke:none}.d-t{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#000}.d-l{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;fill:#555}`;
const Lp=(x1,y1,x2,y2)=>`M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
function arrow(Q,ux,uy){const bx=Q[0]-ux*3,by=Q[1]-uy*3,px=-uy*.55,py=ux*.55;return `<path class="d-ar" d="M${f2(Q[0])} ${f2(Q[1])}L${f2(bx+px)} ${f2(by+py)}L${f2(bx-px)} ${f2(by-py)}Z"/>`}
function dimMarkup(P1,P2,Q1,Q2,txt,tol){
  const ext=(P,Q)=>{const dx=Q[0]-P[0],dy=Q[1]-P[1],l=Math.hypot(dx,dy);if(l<1.2)return '';const ux=dx/l,uy=dy/l;return Lp(P[0]+ux,P[1]+uy,Q[0]+ux*2,Q[1]+uy*2)};
  const dx=Q2[0]-Q1[0],dy=Q2[1]-Q1[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;
  let s=`<path class="d-thin" d="${ext(P1,Q1)}${ext(P2,Q2)}${Lp(Q1[0],Q1[1],Q2[0],Q2[1])}"/>`+arrow(Q1,-ux,-uy)+arrow(Q2,ux,uy);
  let ang=Math.atan2(dy,dx)*180/Math.PI;if(ang>=90)ang-=180;if(ang<-90)ang+=180;
  const r=ang*Math.PI/180,upx=Math.sin(r),upy=-Math.cos(r);
  const mx=(Q1[0]+Q2[0])/2+upx*1.1,my=(Q1[1]+Q2[1])/2+upy*1.1;
  if(tol&&tol.tt==='sym'&&isFinite(num(tol.tu)))txt+=' ±'+fmt(num(tol.tu),3);
  if(tol&&tol.tt==='fit'&&tol.tf)txt+=' '+tol.tf;
  if(tol&&tol.tt==='dev'){
    const sgn=v=>{const n=num(v);if(!isFinite(n)||n===0)return '0';return (n>0?'+':'−')+fmt(Math.abs(n),3)};
    const up=sgn(tol.tu),lo=sgn(tol.tl);const wm=txt.length*1.72,wd=Math.max(up.length,lo.length)*1.25+.6,tot=wm+wd;
    const c=Math.cos(r),sn=Math.sin(r);const L=(lx,ly)=>[mx+lx*c-ly*sn,my+lx*sn+ly*c];
    const T_=(lx,ly,t,fs)=>{const [x,y]=L(lx,ly);return `<text class="d-t" x="${f2(x)}" y="${f2(y)}" font-size="${fs}" transform="rotate(${f2(ang)} ${f2(x)} ${f2(y)})">${esc(t)}</text>`};
    return s+T_(-tot/2,0,txt,3.5)+T_(-tot/2+wm+.4,-1.7,up,2.4)+T_(-tot/2+wm+.4,.4,lo,2.4);
  }
  return s+`<text class="d-t" x="${f2(mx)}" y="${f2(my)}" font-size="3.5" text-anchor="middle" transform="rotate(${f2(ang)} ${f2(mx)} ${f2(my)})">${esc(txt)}</text>`;
}
function leader(cx,cy,R,th,txt){
  const ux=Math.cos(th),uy=-Math.sin(th);const P=[cx+ux*R,cy+uy*R],K=[P[0]+ux*7,P[1]+uy*7];const right=ux>=0,sh=right?1:-1;const tw=txt.length*1.75+1.2;
  return `<path class="d-thin" d="${Lp(P[0],P[1],K[0],K[1])}${Lp(K[0],K[1],K[0]+sh*tw,K[1])}"/>`+arrow(P,-ux,-uy)+`<text class="d-t" x="${f2(K[0]+sh*.6)}" y="${f2(K[1]-.9)}" font-size="3.5" text-anchor="${right?'start':'end'}">${esc(txt)}</text>`;
}
const STD_SCALES=[10,5,2,1,.5,.2,.1,.05,.02,.01];
const scaleLabel=s=>s>=1?`${fmt(s)}:1`:`1:${fmt(Math.round(1/s))}`;
function dimGeom(d,v){
  const [a1,b1]=d.p1,[a2,b2]=d.p2;const P1=v.map(a1,b1),P2=v.map(a2,b2);
  if(d.kind==='h'){const y=v.map(0,d.pos)[1];return {P1,P2,Q1:[P1[0],y],Q2:[P2[0],y],val:Math.abs(a2-a1)}}
  if(d.kind==='v'){const x=v.map(d.pos,0)[0];return {P1,P2,Q1:[x,P1[1]],Q2:[x,P2[1]],val:Math.abs(b2-b1)}}
  const dx=a2-a1,dy=b2-b1,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
  return {P1,P2,Q1:v.map(a1+nx*d.pos,b1+ny*d.pos),Q2:v.map(a2+nx*d.pos,b2+ny*d.pos),val:l};
}
function dimFromCursor(p1,p2,c){
  const [a1,b1]=p1,[a2,b2]=p2,[ca,cb]=c;const dx=a2-a1,dy=b2-b1;
  const mnA=Math.min(a1,a2),mxA=Math.max(a1,a2),mnB=Math.min(b1,b2),mxB=Math.max(b1,b2);let kind;
  if(Math.abs(dx)<1e-6)kind='v';else if(Math.abs(dy)<1e-6)kind='h';
  else{const oa=ca<mnA||ca>mxA,ob=cb<mnB||cb>mxB;
    if(ob&&!oa)kind='h';else if(oa&&!ob)kind='v';
    else if(oa&&ob)kind=Math.min(Math.abs(cb-mnB),Math.abs(cb-mxB))>Math.min(Math.abs(ca-mnA),Math.abs(ca-mxA))?'h':'v';
    else kind='a'}
  if(kind==='h')return {kind,pos:cb};if(kind==='v')return {kind,pos:ca};
  const l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l;return {kind:'a',pos:(ca-a1)*nx+(cb-b1)*ny};
}
function projSymbol(cx,cy,method){
  let s='';const tz=(x0)=>`<path class="d-tb" d="M${f2(x0)} ${f2(cy-1.9)}L${f2(x0+8)} ${f2(cy-3.4)}L${f2(x0+8)} ${f2(cy+3.4)}L${f2(x0)} ${f2(cy+1.9)}Z"/>`;
  const ci=(x)=>`<circle class="d-tb" cx="${f2(x)}" cy="${f2(cy)}" r="1.9"/><circle class="d-tb" cx="${f2(x)}" cy="${f2(cy)}" r="3.4"/>`;
  if(method==='E')s=tz(cx-11)+ci(cx+5.5);else s=ci(cx-7.5)+tz(cx+1);
  return s+`<path class="d-cen" d="${Lp(cx-13,cy,cx+10,cy)}"/>`;
}
function titleBlock(x0,y0,info){
  let s=`<rect class="d-frame" x="${x0}" y="${y0}" width="180" height="36"/>`;
  s+=`<path class="d-tb" d="${Lp(x0+62,y0,x0+62,y0+36)}${Lp(x0+140,y0,x0+140,y0+36)}${Lp(x0+18,y0,x0+18,y0+36)}${Lp(x0,y0+9,x0+62,y0+9)}${Lp(x0,y0+18,x0+62,y0+18)}${Lp(x0,y0+27,x0+62,y0+27)}${Lp(x0+62,y0+20,x0+140,y0+20)}${Lp(x0+101,y0+20,x0+101,y0+36)}${Lp(x0+140,y0+12,x0+180,y0+12)}${Lp(x0+140,y0+24,x0+180,y0+24)}"/>`;
  const lab=(x,y,t)=>`<text class="d-l" x="${f2(x)}" y="${f2(y)}" font-size="2">${esc(t)}</text>`;
  const val=(x,y,t,fs=3,anchor='start')=>`<text class="d-t" x="${f2(x)}" y="${f2(y)}" font-size="${fs}" text-anchor="${anchor}">${esc(t)}</text>`;
  [['Çizen',info.drawn],['Kontrol',info.checked],['Tarih',info.date],['Malzeme',info.mat]].forEach(([l,v],i)=>{s+=lab(x0+1.5,y0+i*9+5.6,l)+val(x0+20,y0+i*9+6.2,v||'',v&&v.length>22?2.3:2.9)});
  s+=lab(x0+64,y0+3.4,'Parça adı');
  const pn=info.part||'';s+=val(x0+101,y0+13.6,pn,pn.length>24?3.6:5,'middle');
  if(info.company)s+=`<text class="d-l" x="${f2(x0+138.5)}" y="${f2(y0+3.4)}" font-size="2" text-anchor="end">${esc(info.company)}</text>`;
  s+=lab(x0+64,y0+23.4,'Resim no')+val(x0+64,y0+31.5,info.dno||'',3.4);
  s+=lab(x0+103,y0+23.4,'Kütle')+val(x0+103,y0+31.5,info.mass||'',3.4);
  s+=lab(x0+142,y0+3.4,'Ölçek')+val(x0+160,y0+10,info.scale,4,'middle');
  s+=projSymbol(x0+160,y0+18,info.method);
  s+=lab(x0+142,y0+27.4,'Kağıt '+info.paper)+val(x0+178,y0+33.4,'Sayfa 1/1',2.6,'end');
  s+=`<text class="d-l" x="${f2(x0-3)}" y="${f2(y0+34.5)}" font-size="2.4" text-anchor="end">Ölçüler mm. Belirtilmeyen toleranslar ISO 2768-m.</text>`;
  return s;
}
function paperWH(key,orient){const P=PAPERS[key]||PAPERS.A3;return orient==='portrait'?{W:P.H,H:P.W}:{W:P.W,H:P.H}}
function areaFor(W,H,layout){if(layout==='min')return [12,12,W-12,H-24];if(layout==='none')return [8,8,W-8,H-8];return [24,14,W-14,H-56]}
function frameMarkup(W,H,layout){
  if(layout!=='full')return '';
  const fx0=20,fy0=10,fx1=W-10,fy1=H-10;
  return `<rect class="d-frame" x="${fx0}" y="${fy0}" width="${fx1-fx0}" height="${fy1-fy0}"/>`+
    `<path class="d-frame" d="${Lp((fx0+fx1)/2,fy0-5,(fx0+fx1)/2,fy0+5)}${Lp((fx0+fx1)/2,fy1-5,(fx0+fx1)/2,fy1+5)}${Lp(fx0-5,(fy0+fy1)/2,fx0+5,(fy0+fy1)/2)}${Lp(fx1-5,(fy0+fy1)/2,fx1+5,(fy0+fy1)/2)}"/>`;
}
function footerMarkup(W,H,layout,info){
  if(layout==='full')return titleBlock(W-190,H-46,info);
  if(layout==='min')return `<text class="d-t" x="12" y="${f2(H-13)}" font-size="5" font-weight="600">${esc(info.part)}</text><text class="d-l" x="12" y="${f2(H-7.5)}" font-size="3.3">Ölçek ${esc(info.scale)}${info.extra?'   '+esc(info.extra):''}</text>`;
  return '';
}
function sheetInfo(paperLabel){
  const S=dwS(),src=dwSrc();
  return {drawn:S.drawn,checked:S.checked,date:new Date().toLocaleDateString('tr-TR'),mat:src.matName,part:src.name,company:S.company,dno:S.dno,mass:src.massG?massText(src.massG):'',scale:'',method:S.method,paper:paperLabel||S.paper};
}
function buildSheet(forExport,opts){
  opts=opts||{};const S=dwS(),src=dwSrc(),isAsm=src.kind==='asm';const pw=paperWH(S.paper,S.orient);
  const W=opts.W||pw.W,H=opts.H||pw.H,layout=opts.layout||'full',scaleSet=opts.scale!=null?opts.scale:S.scale;
  const o=[`<style>${SHEET_CSS}</style>`];
  if(!forExport)o.push(`<rect x="1.4" y="1.8" width="${W}" height="${H}" fill="#000" fill-opacity=".2"/>`);
  o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`);
  o.push(frameMarkup(W,H,layout));
  const ctx={views:{},snaps:[],scale:1,W,H};
  const info=sheetInfo(opts.paperLabel);
  if(!src.polys.length){
    info.scale='—';o.push(footerMarkup(W,H,layout,info));
    o.push(`<text class="d-l" x="${W/2}" y="${H/2-20}" font-size="6" text-anchor="middle">${isAsm?'Montajda görüntülenecek bileşen yok.':'Görünüş oluşturmak için önce Parça sekmesinde bir gövde oluştur.'}</text>`);
    return {markup:o.join(''),ctx};
  }
  const side=S.method==='E'?'left':'right';
  const isoOnly=isAsm&&S.asmView==='iso';
  const keys=isoOnly?['iso']:['front','top',side].concat(S.iso?['iso']:[]);
  const bom=isAsm&&S.bom!==false?bomItems(src.a):null;
  const vd={};for(const k of keys)vd[k]=viewData(k);
  const secKey=!isoOnly&&S.section&&S.section!=='none'?(S.section==='front'?'front':side):null;
  let secInfo=null;
  if(secKey){try{const ss=sectionSrc(src,secKey,S);const sv=viewData(secKey,ss);vd[secKey]=Object.assign({},sv,{bb:vd[secKey].bb});secInfo={key:secKey,partner:secKey==='front'?'top':'front',P:ss.P,D:VIEWS[secKey].D}}catch(e){console.warn(e)}}
  const ext=k=>({w:Math.max(vd[k].bb.maxA-vd[k].bb.minA,.01),h:Math.max(vd[k].bb.maxB-vd[k].bb.minB,.01)});
  let [ax0,ay0,ax1,ay1]=areaFor(W,H,layout);const bomH=bom?(bom.length+1)*6:0;
  if(bom&&layout==='full')ay1-=bomH+4;else if(bom)ax1-=Math.min(184,(ax1-ax0)*0.42);
  const m=16,gapX=30,gapY=28;
  let pos,s,si;
  if(isoOnly){const e=ext('iso');const sF=Math.min((ax1-ax0-2*m)/e.w,(ay1-ay0-2*m)/e.h);s=scaleSet==='auto'?(STD_SCALES.find(x=>x<=sF*1.0001)||STD_SCALES[STD_SCALES.length-1]):+scaleSet;ctx.scale=s;si=s;info.scale=scaleLabel(s);pos={iso:[(ax0+ax1)/2,(ay0+ay1)/2]}}
  else{
  const fw=ext('front').w,fh=ext('front').h,sw_=ext(side).w,th=ext('top').h,iw=S.iso?ext('iso').w:0,ih=S.iso?ext('iso').h:0;
  const AW=ax1-ax0-2*m,AH=ay1-ay0-2*m;
  // Yerleşim A: 2×2 ızgara (izometrik sağ alt/sağ üst). Yerleşim B: izometrik ayrı satırda (dikey kağıtta daha iyi).
  const std=x=>STD_SCALES.find(y=>y<=x*1.0001)||STD_SCALES[STD_SCALES.length-1];
  // Yerleşim A: ölçek yalnızca ön/üst/yan görünüşlerden; izometrik kalan hücreye kendi (en çok aynı) ölçeğiyle sığar.
  s=scaleSet==='auto'?std(Math.min((AW-gapX)/(fw+sw_),(AH-gapY)/(fh+th))):+scaleSet;
  si=s;
  if(S.iso){const cw=AW-gapX-fw*s,ch=AH-gapY-fh*s;si=Math.min(s,cw>0?cw/iw:s,ch>0?ch/ih:s);si=si>=s?s:std(si)}
  const c2wA=Math.max(sw_*s,iw*si),rTopA=Math.max(th*s,ih*si);
  // Yerleşim B: izometrik ayrı satırda, tüm görünüşler aynı ölçekte (dikey kağıtta daha iyi)
  const sB=S.iso?Math.min((AW-gapX)/Math.max(fw+sw_,iw),(AH-2*gapY)/(fh+th+ih)):0;
  const useB=scaleSet==='auto'&&S.iso&&std(sB)>=s;if(useB){s=std(sB);si=s}
  ctx.scale=s;info.scale=scaleLabel(s);
  if(!useB){
    const r1h=S.method==='E'?fh*s:rTopA,r2h=S.method==='E'?rTopA:fh*s;
    const totW=fw*s+c2wA+gapX,totH=r1h+r2h+gapY;
    const lx=ax0+(ax1-ax0-totW)/2,ty=ay0+(ay1-ay0-totH)/2;
    const cx1=lx+fw*s/2,cx2=lx+fw*s+gapX+c2wA/2,cy1=ty+r1h/2,cy2=ty+r1h+gapY+r2h/2;
    pos=S.method==='E'?{front:[cx1,cy1],[side]:[cx2,cy1],top:[cx1,cy2],iso:[cx2,cy2]}:{top:[cx1,cy1],iso:[cx2,cy1],front:[cx1,cy2],[side]:[cx2,cy2]};
  }else{
    const gw=(fw+sw_)*s+gapX,totW=Math.max(gw,iw*s),totH=(fh+th+ih)*s+2*gapY;
    const lx=ax0+(ax1-ax0-gw)/2,ty=ay0+(ay1-ay0-totH)/2;
    const cx1=lx+fw*s/2,cx2=lx+fw*s+gapX+sw_*s/2;
    const yA=S.method==='E'?ty+fh*s/2:ty+th*s/2,yB=S.method==='E'?ty+fh*s+gapY+th*s/2:ty+th*s+gapY+fh*s/2,yI=ty+(fh+th)*s+2*gapY+ih*s/2;
    pos=S.method==='E'?{front:[cx1,yA],[side]:[cx2,yA],top:[cx1,yB],iso:[(ax0+ax1)/2,yI]}:{top:[cx1,yA],front:[cx1,yB],[side]:[cx2,yB],iso:[(ax0+ax1)/2,yI]};
  }
  }
  for(const k of keys){
    const d=vd[k],[cx,cy]=pos[k];const ac=(d.bb.minA+d.bb.maxA)/2,bc=(d.bb.minB+d.bb.maxB)/2;
    const vs=k==='iso'?si:s;
    ctx.views[k]={key:k,d,s:vs,map:(a,b)=>[cx+(a-ac)*vs,cy-(b-bc)*vs],inv:(x,y)=>[ac+(x-cx)/vs,bc-(y-cy)/vs]};
  }
  const segPath=(arr,v)=>{let p='';for(const q of arr){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);p+=Lp(A[0],A[1],B[0],B[1])}return p};
  for(const k of keys){
    const v=ctx.views[k],d=v.d;
    // farklı ölçekli izometrik görünüşün altına kendi ölçeği yazılır
    if(k==='iso'&&v.s!==s){const [cx,cy]=pos.iso;o.push(`<text class="d-l" x="${f2(cx)}" y="${f2(cy+(d.bb.maxB-d.bb.minB)*v.s/2+6)}" font-size="3.2" text-anchor="middle">Ölçek ${esc(scaleLabel(v.s))}</text>`)}
    if(S.hidden&&k!=='iso'&&k!==(secInfo&&secInfo.key)&&d.hid.length)o.push(`<path class="d-hid" d="${segPath(d.hid,v)}"/>`);
    if(secInfo&&k===secInfo.key)o.push(hatchMarkup(d.secPolys,v,src.kind==='asm'));
    if(k!=='iso'&&d.threads.length)o.push(threadMarkup(d.threads,v,s));
    o.push(`<path class="d-vis" d="${segPath(d.vis,v)}"/>`);
    if(S.centers&&k!=='iso'){
      let cp='';
      for(const mk of d.marks){const [x,y]=v.map(mk.a,mk.b);const r=mk.r*s+2.5;cp+=Lp(x-r,y,x+r,y)+Lp(x,y-r,x,y+r)}
      for(const q of d.axes){const A=v.map(q[0],q[1]),B=v.map(q[2],q[3]);const dx=B[0]-A[0],dy=B[1]-A[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;cp+=Lp(A[0]-ux*3,A[1]-uy*3,B[0]+ux*3,B[1]+uy*3)}
      if(cp)o.push(`<path class="d-cen" d="${cp}"/>`);
    }
    if(k!=='iso'){
      const seen=new Set();const add=(a,b)=>{const key=Math.round(a*1000)+'_'+Math.round(b*1000);if(seen.has(key))return;seen.add(key);const [x,y]=v.map(a,b);ctx.snaps.push({view:k,a,b,x,y})};
      for(const q of d.vis){add(q[0],q[1]);add(q[2],q[3])}
      for(const q of d.hid){add(q[0],q[1]);add(q[2],q[3])}
      for(const mk of d.marks)add(mk.a,mk.b);
    }
  }
  /* çap etiketleri */
  if(S.autodims&&!isoOnly){
    const order=['top','front',side];const plan=new Map();
    for(const k of order){for(const q of vd[k].circ){if(!q.label)continue;if(!plan.has(q.gid))plan.set(q.gid,{k,list:[]});const g=plan.get(q.gid);if(g.k===k)g.list.push(q)}}
    for(const g of plan.values()){
      const v=ctx.views[g.k];const cut=g.list[0].op==='cut';
      const best=g.list.reduce((a,q)=>{const sc=cut?q.a+q.b:-q.a+q.b;return !a||sc>a.sc?{q,sc}:a},null).q;
      const [x,y]=v.map(best.a,best.b);const n=g.list.length;
      const txt=(n>1?n+'× ':'')+(best.txt||('Ø'+fmt(best.r*2)));
      o.push(leader(x,y,best.r*s,cut?Math.PI/4:Math.PI*3/4,txt));
    }
    /* genel boyutlar */
    const vF=ctx.views.front,dF=vd.front.bb;
    const BL=vF.map(dF.minA,dF.minB),BR=vF.map(dF.maxA,dF.minB),TL=vF.map(dF.minA,dF.maxB);
    o.push(dimMarkup(BL,BR,[BL[0],BL[1]+9],[BR[0],BR[1]+9],fmt(dF.maxA-dF.minA)));
    o.push(dimMarkup(BL,TL,[BL[0]-9,BL[1]],[TL[0]-9,TL[1]],fmt(dF.maxB-dF.minB)));
    const vS=ctx.views[side],dS=vd[side].bb;
    const SL=vS.map(dS.minA,dS.minB),SR=vS.map(dS.maxA,dS.minB);
    o.push(dimMarkup(SL,SR,[SL[0],SL[1]+9],[SR[0],SR[1]+9],fmt(dS.maxA-dS.minA)));
  }
  /* elle eklenen ölçüler */
  S.dims.forEach((dm,i)=>{const v=ctx.views[dm.view];if(!v)return;const g=dimGeom(dm,v);o.push(`<g data-dim="${i}">${dimMarkup(g.P1,g.P2,g.Q1,g.Q2,(dm.pre||'')+fmt(g.val),dm)}</g>`)});
  if(secInfo)o.push(sectionLineMarkup(secInfo,ctx,s));
  o.push(detailsMarkup(S,ctx,s));
  o.push(surfMarkup(S,ctx));
  o.push(notesMarkup(S));
  if(bom){
    if(S.balloons!==false){const bv=ctx.views.iso?'iso':'front';o.push(balloonsMarkup(ctx.views[bv],bom,[ax0,ay0,ax1,ay1]))}
    o.push(bomMarkup(bom,layout,W,H,[ax0,ay0,ax1,ay1]));
  }
  o.push(footerMarkup(W,H,layout,info));
  return {markup:o.join(''),ctx};
}

/* sayfa görünümü: yakınlaştır/kaydır */
const sheetEl=$('#sheet'),sheetWrap=$('#sheetWrap');
let vb={x:0,y:0,w:420,h:297},dctx=null;
function applyVB(){sheetEl.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`)}
function fitSheet(){const P=paperWH(dwS().paper,dwS().orient);const pad=8;vb={x:-pad,y:-pad,w:P.W+2*pad,h:P.H+2*pad};applyVB()}
let drawT=0;
function renderDrawing(fit){
  const busy=$('#dwBusy');
  if(!vcache.m||!vcache.m.has(dwSrc().key+'|front')){busy.classList.add('on');sheetEl.style.opacity=.35}
  clearTimeout(drawT);
  drawT=setTimeout(()=>{
    let r;try{r=buildSheet(false)}catch(e){console.error(e);toast('Teknik resim oluşturulamadı: '+(e.message||e));busy.classList.remove('on');sheetEl.style.opacity=1;return}
    sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;
    if(fit)fitSheet();else applyVB();
    busy.classList.remove('on');sheetEl.style.opacity=1;
    renderDwPanel();drawOverlay(null);
  },30);
}
function toSheet(cx,cy){const pt=sheetEl.createSVGPoint();pt.x=cx;pt.y=cy;const q=pt.matrixTransform(sheetEl.getScreenCTM().inverse());return [q.x,q.y]}
function pxToSheet(px){const m=sheetEl.getScreenCTM();return px/(m?m.a:1)}
function zoomAt(p,f){f=Math.max(.02/ (vb.w/420),Math.min(f,8));vb.x=p[0]-(p[0]-vb.x)*f;vb.y=p[1]-(p[1]-vb.y)*f;vb.w*=f;vb.h*=f;applyVB()}
const ptrs=new Map();let pan=null,pinch=null;
sheetEl.addEventListener('pointerdown',e=>{
  sheetEl.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1){pan={x:e.clientX,y:e.clientY,vb:{...vb},k:pxToSheet(1),moved:false}}
  else if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),vb:{...vb},mid:toSheet((a.x+b.x)/2,(a.y+b.y)/2)};if(pan)pan.moved=true}
});
sheetEl.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y)||1;const f=pinch.d/d;vb={...pinch.vb};zoomAt(pinch.mid,f);return}
  if(ptrs.size===1&&pan){const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(Math.hypot(dx,dy)>4)pan.moved=true;if(pan.moved){vb.x=pan.vb.x-dx*pan.k;vb.y=pan.vb.y-dy*pan.k;applyVB()}return}
  if((dimMode||dwTool)&&e.pointerType==='mouse')drawOverlay(toSheet(e.clientX,e.clientY));
});
const endPtr=e=>{
  const wasPan=pan;ptrs.delete(e.pointerId);
  if(ptrs.size===0){if(wasPan&&!wasPan.moved&&e.type==='pointerup'){if(dimMode)dimClick(toSheet(e.clientX,e.clientY),e.pointerType);else if(dwTool)dwToolClick(toSheet(e.clientX,e.clientY),e.pointerType)}pan=null;pinch=null}
  else if(ptrs.size===1){const [a]=[...ptrs.values()];pan={x:a.x,y:a.y,vb:{...vb},k:pxToSheet(1),moved:true};pinch=null}
};
sheetEl.addEventListener('pointerup',endPtr);sheetEl.addEventListener('pointercancel',endPtr);
sheetEl.addEventListener('wheel',e=>{e.preventDefault();zoomAt(toSheet(e.clientX,e.clientY),Math.pow(1.0015,e.deltaY))},{passive:false});

/* elle ölçü aracı */
let dimMode=false,dimSt={stage:0,p1:null,p2:null};
function nearestSnap(p,tolPx){
  if(!dctx)return null;const tol=pxToSheet(tolPx);let best=null,bd=tol;
  for(const s of dctx.snaps){const d=Math.hypot(s.x-p[0],s.y-p[1]);if(d<bd){bd=d;best=s}}return best;
}
function setDimMode(on){
  if(on)setDwTool(null,true);
  dimMode=on;dimSt={stage:0,p1:null,p2:null};sheetWrap.classList.toggle('dim',on);
  $$('[data-dcmd="dim"]').forEach(b=>b.classList.toggle('on',on));updateDimTip();drawOverlay(null);
}
function updateDimTip(){
  const t=$('#dwTip');if(!dimMode){t.classList.remove('on');return}
  t.classList.add('on');
  t.textContent=dimSt.stage===0?'Ölçü: ilk noktayı seç (kenar uçları ve merkezler yakalanır). Esc ile çık.':dimSt.stage===1?'İkinci noktayı aynı görünüşte seç.':'Ölçü çizgisinin yerini seç. Fareyi noktaların yanına götürürsen dikey, üstüne/altına götürürsen yatay ölçü olur.';
}
function dimClick(p,ptype){
  const tol=ptype==='mouse'?9:20;
  if(dimSt.stage===0){const s=nearestSnap(p,tol);if(!s)return;dimSt.p1=s;dimSt.stage=1}
  else if(dimSt.stage===1){const s=nearestSnap(p,tol);if(!s)return;
    if(s.view!==dimSt.p1.view){toast('İki nokta aynı görünüşte olmalı.');return}
    if(Math.hypot(s.a-dimSt.p1.a,s.b-dimSt.p1.b)<1e-6)return;
    dimSt.p2=s;dimSt.stage=2}
  else{
    const v=dctx.views[dimSt.p1.view];const c=v.inv(p[0],p[1]);const r=dimFromCursor([dimSt.p1.a,dimSt.p1.b],[dimSt.p2.a,dimSt.p2.b],c);
    if(dwDoc().kind==='part')pushHist();dwS().dims.push({view:dimSt.p1.view,p1:[dimSt.p1.a,dimSt.p1.b],p2:[dimSt.p2.a,dimSt.p2.b],kind:r.kind,pos:r.pos});
    saveState();dimSt={stage:0,p1:null,p2:null};renderDrawing();
  }
  updateDimTip();drawOverlay(p);
}
function drawOverlay(p){
  const ov=$('#ov');if(!ov)return;if(dwTool){ov.innerHTML=dwToolOverlay(p);return}if(!dimMode){ov.innerHTML='';return}
  let h='';const acc='#1F6FEB';
  const dotM=(x,y,r,fill)=>`<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${fill}" stroke="${acc}" stroke-width="${f2(pxToSheet(1.5))}"/>`;
  const rr=pxToSheet(5);
  if(dimSt.p1)h+=dotM(dimSt.p1.x,dimSt.p1.y,rr,acc);
  if(dimSt.p2)h+=dotM(dimSt.p2.x,dimSt.p2.y,rr,acc);
  if(p&&dimSt.stage<2){const s=nearestSnap(p,9);if(s)h+=dotM(s.x,s.y,rr*1.2,'rgba(31,111,235,.18)')}
  if(p&&dimSt.stage===2){
    const v=dctx.views[dimSt.p1.view];const c=v.inv(p[0],p[1]);const r=dimFromCursor([dimSt.p1.a,dimSt.p1.b],[dimSt.p2.a,dimSt.p2.b],c);
    const g=dimGeom({p1:[dimSt.p1.a,dimSt.p1.b],p2:[dimSt.p2.a,dimSt.p2.b],kind:r.kind,pos:r.pos},v);
    h+=`<g style="opacity:.85" filter="none">${dimMarkup(g.P1,g.P2,g.Q1,g.Q2,fmt(g.val)).replace(/#000/g,acc).replace(/class="d-ar"/g,`class="d-ar" style="fill:${acc}"`).replace(/class="d-thin"/g,`class="d-thin" style="stroke:${acc}"`).replace(/class="d-t"/g,`class="d-t" style="fill:${acc}"`)}</g>`;
  }
  ov.innerHTML=h;
}

/* çizim şeridi ve paneli */
function dRb(cmd,icon,label,on){return `<button class="rb ${on?'on':''}" data-dcmd="${cmd}" title="${esc(label)}">${IC[icon]}<span>${label}</span></button>`}
function rctl(label,id,opts,val){return `<label class="rctl"><span>${label}</span><select id="${id}">${opts.map(([k,t])=>`<option value="${k}" ${String(k)===String(val)?'selected':''}>${t}</option>`).join('')}</select></label>`}
let dlCap=null;
function renderDrawRibbon(){
  const S=dwS(),doc=dwDoc();
  const docOpts=[...project.parts.map(p=>['p:'+p.id,'Parça: '+p.partName]),...project.asms.map(a=>['a:'+a.id,'Montaj: '+a.name])];
  const docVal=doc.kind==='asm'?'a:'+doc.a.id:'p:'+state.id;
  $('#drawRibbon').innerHTML=rctl('Belge','dDoc',docOpts.map(([k,t])=>[k,esc(t)]),docVal)+
    rctl('Kağıt','dPaper',[['A4','A4'],['A3','A3'],['A2','A2'],['A1','A1'],['A0','A0']],S.paper)+rctl('Yön','dOrient',[['landscape','Yatay'],['portrait','Dikey']],S.orient||'landscape')+
    rctl('İzdüşüm','dMethod',[['E','ISO E (Avrupa)'],['A','ISO A (Amerikan)']],S.method)+
    rctl('Ölçek','dScale',[['auto','Otomatik'],['5','5:1'],['2','2:1'],['1','1:1'],['0.5','1:2'],['0.2','1:5'],['0.1','1:10']],S.scale)+
    (doc.kind==='asm'?'<div class="rsep"></div>'+rctl('Görünüşler','dAsmView',[['std','Ön, üst, yan + izometrik'],['iso','Yalnızca izometrik']],S.asmView||'std')+dRb('explode','explode','Patlatılmış',!!S.explode)+dRb('balloons','balloon','Balonlar',S.balloons!==false)+dRb('bom','bom','Parça listesi',S.bom!==false):'')+
    '<div class="rsep"></div>'+dRb('hidden','hidden','Gizli çizgiler',S.hidden)+dRb('centers','center','Eksen çizgileri',S.centers)+dRb('autodims','autodim','Oto. ölçüler',S.autodims)+dRb('iso','isoView','İzometrik',S.iso)+
    '<div class="rsep"></div>'+(doc.kind==='part'||S.asmView!=='iso'?rctl('Kesit','dSec',[['none','Yok'],['front','Ön görünüş A-A'],['side','Yan görünüş A-A']],S.section||'none'):'')+dRb('dim','dim','Ölçü ekle',dimMode)+dRb('detail','detailv','Detay görünüşü',dwTool==='detail')+dRb('surf','surf','Yüzey işareti',dwTool==='surf')+dRb('note','note','Not ekle',dwTool==='note')+dRb('fit','fit','Sığdır',false)+
    '<div class="rsep"></div>'+dRb('pdf','pdf','PDF olarak al',false)+dRb('svg','svg','SVG indir',false)+dRb('png','png','PNG indir',false);
}
$('#drawRibbon').addEventListener('change',e=>{
  const S=dwS(),t=e.target;
  if(t.id==='dDoc'){const [k,id]=t.value.split(':');if(k==='p'){project.cur.dw={kind:'part',id};switchPart(id)}else project.cur.dw={kind:'asm',id};saveState();renderDrawRibbon();renderDrawing(true);return}
  if(t.id==='dAsmView'){S.asmView=t.value;saveState();renderDrawRibbon();renderDrawing(true);return}
  if(t.id==='dSec'){S.section=t.value;saveState();renderDrawing();renderDwPanel();return}
  if(t.id==='dPaper'){S.paper=t.value;saveState();renderDrawing(true)}
  if(t.id==='dOrient'){S.orient=t.value;saveState();renderDrawing(true)}
  if(t.id==='dMethod'){S.method=t.value;S.dims=S.dims.filter(d=>d.view==='front'||d.view==='top');saveState();renderDrawing()}
  if(t.id==='dScale'){S.scale=t.value;saveState();renderDrawing()}
});
$('#drawRibbon').addEventListener('click',e=>{
  const b=e.target.closest('[data-dcmd]');if(!b)return;const c=b.dataset.dcmd,S=dwS();
  if(['balloons','bom'].includes(c)){S[c]=S[c]===false;b.classList.toggle('on',S[c]!==false);saveState();renderDrawing();return}
  if(['hidden','centers','autodims','iso','explode'].includes(c)){S[c]=!S[c];b.classList.toggle('on',S[c]);saveState();renderDrawing()}
  else if(c==='dim')setDimMode(!dimMode);
  else if(['detail','surf','note'].includes(c))setDwTool(dwTool===c?null:c);
  else if(c==='fit')fitSheet();
  else if(c==='svg')exportSVG();
  else if(c==='png')exportPNG();
  else if(c==='pdf')openPdfDialog('2d');
});
function renderDwPanel(){
  const S=dwS(),src=dwSrc();
  const VN={front:'Ön',top:'Üst',left:'Soldan',right:'Sağdan'};
  let h=`<div class="grp"><div class="grp-t">Antet</div>
    <label class="fld"><span>${src.kind==='asm'?'Montaj adı':'Parça adı'}</span><input data-dk="partName" value="${esc(src.name)}"></label>
    <div class="row2"><label class="fld"><span>Resim no</span><input data-dk="dno" value="${esc(S.dno)}"></label><label class="fld"><span>Firma</span><input data-dk="company" value="${esc(S.company)}"></label></div>
    <div class="row2"><label class="fld"><span>Çizen</span><input data-dk="drawn" value="${esc(S.drawn)}"></label><label class="fld"><span>Kontrol</span><input data-dk="checked" value="${esc(S.checked)}"></label></div>
    <p class="note">Malzeme, kütle, ölçek ve tarih modelden otomatik alınır. Malzemeyi 3B Model sekmesindeki ağaçtan değiştir.</p></div>`;
  h+=`<div class="grp"><div class="grp-t">Eklenen ölçüler</div>`;
  if(!S.dims.length)h+=`<p class="note">Şeritteki “Ölçü ekle” ile iki nokta seç, sonra ölçü çizgisinin yerini göster.</p>`;
  else h+=`<div class="dimlist">${S.dims.map((d,i)=>{const v=dctx&&dctx.views[d.view];const val=v?dimGeom(d,v).val:Math.hypot(d.p2[0]-d.p1[0],d.p2[1]-d.p1[1]);return `<div class="dimrow" style="flex-wrap:wrap"><span>${VN[d.view]||d.view}: ${esc(d.pre||'')}${fmt(val)} mm</span><button data-deldim="${i}" title="Sil" aria-label="Ölçüyü sil">✕</button>${tolEditor(d,i)}</div>`}).join('')}</div><div style="margin-top:8px"><button class="sbtn" data-deldim="all">Tümünü sil</button></div><p class="note" style="margin-top:6px">Tolerans: ± simetrik, sapma (üst/alt) veya geçme (örneğin H7, g6). Ön ek alanına Ø veya R yazabilirsin.</p>`;
  h+=`</div>`;
  h+=extraPanel(S);
  if(dctx)h+=`<div class="grp"><div class="grp-t">Sayfa</div><p class="note">Ölçek ${scaleLabel(dctx.scale)}, ${S.method==='E'?'ISO E (birinci açı) izdüşüm: üst görünüş ön görünüşün altında, soldan görünüş sağında.':'ISO A (üçüncü açı) izdüşüm: üst görünüş ön görünüşün üstünde, sağdan görünüş sağında.'}</p><p class="note">Fare tekerleği veya iki parmakla yakınlaştır, sürükleyerek kaydır.</p></div>`;
  $('#dwPanel').innerHTML=h;
}
$('#dwPanel').addEventListener('input',e=>{
  if(extraPanelInput(e))return;
  const k=e.target.dataset.dk;if(!k)return;
  if(k==='partName'){const d=dwDoc();if(d.kind==='asm')d.a.name=e.target.value;else state.partName=e.target.value}else dwS()[k]=e.target.value;
  saveState();clearTimeout(drawT);drawT=setTimeout(()=>{const r=buildSheet(false);sheetEl.innerHTML=r.markup+'<g id="ov"></g>';dctx=r.ctx;applyVB()},200);
});
$('#dwPanel').addEventListener('change',e=>{if(extraPanelInput(e,true))return;if(e.target.dataset.dk==='partName')renderTree()});
$('#dwPanel').addEventListener('click',e=>{
  if(extraPanelClick(e))return;
  const b=e.target.closest('[data-deldim]');if(!b)return;if(dwDoc().kind==='part')pushHist();
  if(b.dataset.deldim==='all')dwS().dims=[];else dwS().dims.splice(+b.dataset.deldim,1);
  saveState();renderDrawing();
});

/* dışa aktarma */
function exportSVGString(){
  const r=buildSheet(true);const W=r.ctx.W,H=r.ctx.H;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${r.markup}</svg>`;
}
const safeName=()=>(String(dwSrc().name||'parca').trim().replace(/[^\p{L}\p{N}\-_ ]+/gu,'').replace(/\s+/g,'-')||'parca');
async function saveFile(filename,data){
  if(!dlCap){
    // Claude dışında (ör. GitHub Pages): standart tarayıcı indirmesi
    try{const blob=data instanceof Blob?data:new Blob([data],{type:filename.endsWith('.json')?'application/json':filename.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('İndiriliyor: '+filename)}
    catch(e){toast('Dosya indirilemedi.')}
    return;
  }
  try{await dlCap.save({filename,data});toast('Kaydedildi: '+filename)}
  catch(e){if(e&&e.code==='declined')return;toast('Dosya kaydedilemedi'+(e&&e.message?': '+e.message:'.'))}
}
function exportSVG(){saveFile(safeName()+'-teknik-resim.svg',exportSVGString())}
function exportPNG(){
  const str=exportSVGString();const P=paperWH(dwS().paper,dwS().orient);const k=6;
  const img=new Image();
  img.onload=()=>{const c=document.createElement('canvas');c.width=P.W*k;c.height=P.H*k;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);c.toBlob(b=>{if(b)saveFile(safeName()+'-teknik-resim.png',b);else toast('PNG oluşturulamadı.')},'image/png')};
  img.onerror=()=>toast('PNG oluşturulamadı. SVG olarak indirmeyi dene.');
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str);
}
