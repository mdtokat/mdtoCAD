/* Profil bölgeleri: ekstrüzyon/döndürme sırasında çizim bölgelerinin gösterilmesi ve tıklanarak seçilmesi. */
const matRegSel=new T.MeshBasicMaterial({color:0xF08A1A,transparent:true,opacity:.32,depthTest:false,depthWrite:false,side:T.DoubleSide});
const matRegLine=new T.LineBasicMaterial({color:0x2F7BE0,transparent:true,opacity:.8,depthTest:false});
/* tohum noktasını içeren en küçük bölge */
function faceAt(faces,p){let best=null;for(const fc of faces)if(pip(p,fc.pts)&&(!best||fc.area<best.area))best=fc;return best}
function regionOverlay(s,F,regions){
  let faces;try{faces=sketchFaces(s)}catch(e){return}
  if(!faces.length)return;
  const M=frameMatrix(F);const lift=Math.max(0.01,modelExtent()*1e-4);
  const sel=new Set();for(const r of regions||[]){const fc=faceAt(faces,r);if(fc)sel.add(fc)}
  const arr=[];
  for(const fc of faces){const p=fc.pts;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];arr.push(a[0],a[1],lift,b[0],b[1],lift)}
    if(sel.has(fc)){const g=new T.ShapeGeometry(new T.Shape(fc.pts.map(q=>new T.Vector2(q[0],q[1]))));g.applyMatrix4(M);g.translate(...vk(F.n,lift));const m=new T.Mesh(g,matRegSel);m.renderOrder=8;previewGroup.add(m)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.applyMatrix4(M);
  const l=new T.LineSegments(g,matRegLine);l.renderOrder=8;previewGroup.add(l);
}
/* ekranda tıklanan noktadaki bölgeyi seçime ekler / çıkarır */
function regionClick(e){
  const d=pm.draft,s=byId(d.sketch);if(!s)return;const F=(pm.base.frames||{})[s.id]||model.frames[s.id];if(!F)return;
  ray.setFromCamera(ndc(e),camera);const P=new T.Vector3();
  if(!ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(v3(F.n),v3(F.o)),P))return;
  const w=[P.x-F.o[0],P.y-F.o[1],P.z-F.o[2]];const q=[vd(w,F.u),vd(w,F.v)];
  let faces;try{faces=sketchFaces(s)}catch(err){return}
  const fc=faceAt(faces,q);if(!fc)return;
  const regs=(d.regions||[]).filter(r=>faceAt(faces,r)!==fc);
  if(regs.length===(d.regions||[]).length)regs.push([Math.round(q[0]*1000)/1000,Math.round(q[1]*1000)/1000]);
  if(regs.length)d.regions=regs;else delete d.regions;
  renderPM();schedulePreview(0);
}
