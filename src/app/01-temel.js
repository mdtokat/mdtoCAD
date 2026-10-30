/* Temel: yardımcılar, ikonlar, proje durumu, geçmiş, 3B sahne, kamera, seçim. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=2)=>Number(x).toLocaleString('tr-TR',{maximumFractionDigits:d});
const f2=n=>(Math.round(n*100)/100).toString();
const uid=p=>(p||'f')+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clone=o=>JSON.parse(JSON.stringify(o));
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark=()=>{const c=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();return c.toUpperCase()!=='#1B222A'};

/* ---------- ikonlar ---------- */
const sv=(p,extra='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const IC={
  extrude:sv('<path d="M4.5 13.5 12 17.2l7.5-3.7L12 9.8z"/><path d="M4.5 13.5v3.4L12 20.6l7.5-3.7v-3.4M12 17.2v3.4"/><path d="M12 8V2.8M9.6 5.2 12 2.8l2.4 2.4"/>'),
  cut:sv('<path d="M4 9.2 12 5.2l8 4-8 4z"/><path d="M4 9.2v6.6l8 4 8-4V9.2M12 13.2v6.6"/><ellipse cx="12" cy="9.2" rx="3.2" ry="1.6"/><path d="M8.8 9.2v4.2M15.2 9.2v4.2" stroke-dasharray="1.4 1.4"/>'),
  revolve:sv('<path d="M12 2.5v19" stroke-dasharray="2.6 1.8"/><path d="M4 14a8 3.2 0 0 0 16 0"/><path d="M20 14a8 3.2 0 0 0-5-2.9"/><path d="m15.8 9.6-1.2 1.6 1.9.6"/><path d="M8 6h2v8M16 6h-2"/>'),
  revcut:sv('<path d="M12 2.5v19" stroke-dasharray="2.6 1.8"/><path d="M4 14a8 3.2 0 0 0 16 0"/><path d="M20 14a8 3.2 0 0 0-5-2.9"/><path d="m15.8 9.6-1.2 1.6 1.9.6"/><path d="M7 7h4v4H7z"/>'),
  fillet:sv('<path d="M4 20V10a6 6 0 0 1 6-6h10"/><path d="M4 20h16V4" opacity=".45"/>'),
  chamfer:sv('<path d="M4 20V9l5-5h11"/><path d="M4 20h16V4" opacity=".45"/>'),
  lpattern:sv('<rect x="3" y="5" width="4.5" height="4.5" rx=".6"/><rect x="9.75" y="5" width="4.5" height="4.5" rx=".6" stroke-dasharray="1.5 1.2"/><rect x="16.5" y="5" width="4.5" height="4.5" rx=".6" stroke-dasharray="1.5 1.2"/><rect x="3" y="14.5" width="4.5" height="4.5" rx=".6" stroke-dasharray="1.5 1.2"/><rect x="9.75" y="14.5" width="4.5" height="4.5" rx=".6" stroke-dasharray="1.5 1.2"/><rect x="16.5" y="14.5" width="4.5" height="4.5" rx=".6" stroke-dasharray="1.5 1.2"/>'),
  cpattern:sv('<circle cx="12" cy="12" r="7.5" stroke-dasharray="2 2"/><circle cx="12" cy="4.5" r="1.7"/><circle cx="18.5" cy="15.75" r="1.7"/><circle cx="5.5" cy="15.75" r="1.7"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>'),
  mirror:sv('<path d="M12 2.5v19" stroke-dasharray="2.4 1.6"/><path d="M9.5 6 3.5 17.5h6zM14.5 6l6 11.5h-6z"/>'),
  plane:sv('<path d="M3 16.5 7.5 7h13.5l-4.5 9.5z"/>'),
  sketch:sv('<path d="M3 17.5 7.5 8h13.5l-4.5 9.5z" opacity=".5"/><path d="M8 15.5 11 11l3 3 3.5-4.5"/>'),
  exitSketch:sv('<path d="M3 17.5 7.5 8h13.5l-4.5 9.5z" opacity=".5"/><path d="m8.5 12.5 2.5 2.5 5-5"/>'),
  fulldef:sv('<path d="M4 18h16M4 18v-3M20 18v-3"/><path d="M7 13 10 7l3 3 4-5"/><path d="m14.5 15.5 1.8 1.8 3.4-3.6" stroke-width="1.9"/>'),
  smartdim:sv('<path d="M5 19 19 5"/><path d="M4 14v6h6M14 4h6v6" opacity=".5"/><path d="M8.5 12.5 12 9"/>'),
  line:sv('<path d="M5 19 19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>'),
  centerline:sv('<path d="M3 21 21 3" stroke-dasharray="5 2 1.5 2"/>'),
  rect:sv('<rect x="4" y="6" width="16" height="12"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="6" r="1.5"/>'),
  crect:sv('<rect x="4" y="6" width="16" height="12"/><path d="M4 6l16 12M20 6 4 18" stroke-dasharray="2 2" opacity=".6"/>'),
  circle:sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  arc:sv('<path d="M5 16a8 8 0 0 1 14 0"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/><path d="M12 16 5 16" stroke-dasharray="1.5 1.5" opacity=".6"/>'),
  arc3:sv('<path d="M5 16a8 8 0 0 1 14 0"/><circle cx="5" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/><circle cx="12" cy="9" r="1.5"/>'),
  tarc:sv('<path d="M3 17h8"/><path d="M11 17a6.5 6.5 0 0 0 6.5-6.5V5"/><circle cx="11" cy="17" r="1.5" fill="currentColor"/>'),
  slot:sv('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M7 12h10" stroke-dasharray="2 1.5" opacity=".6"/>'),
  polygon:sv('<path d="M12 3.5 19.4 7.8v8.4L12 20.5 4.6 16.2V7.8z"/>'),
  point:sv('<circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4" opacity=".5"/>'),
  sfillet:sv('<path d="M5 20V12a7 7 0 0 1 7-7h7"/><path d="M5 5h0" /><path d="M5 9V5h4" stroke-dasharray="1.5 1.5" opacity=".6"/>'),
  construction:sv('<path d="M4 20 20 4" stroke-dasharray="3 2.5"/>'),
  normal:sv('<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M12 8v8M8 12h8" opacity=".5"/>'),
  select:sv('<path d="M6 3.5v15l4-4 2.8 6 2.2-1-2.8-6h5.3z"/>'),
  front:sv('<rect x="5" y="5" width="14" height="14" rx="1"/><path d="M5 12h14M12 5v14" stroke-dasharray="1.6 1.6" opacity=".55"/>'),
  top:sv('<path d="M3.5 9.5 12 5l8.5 4.5L12 14z" fill="currentColor" fill-opacity=".22"/><path d="M3.5 9.5v6L12 20l8.5-4.5v-6M12 14v6"/>'),
  right:sv('<path d="M12 14v6l8.5-4.5v-6z" fill="currentColor" fill-opacity=".22"/><path d="M3.5 9.5 12 5l8.5 4.5L12 14z"/><path d="M3.5 9.5v6L12 20M12 14v6l8.5-4.5v-6"/>'),
  iso:sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  fit:sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>'),
  shadedEdges:sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill="currentColor" fill-opacity=".28"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  shaded:sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill="currentColor" fill-opacity=".45" stroke="none"/>'),
  wire:sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/><path d="M4 16.5 12 12M20 16.5 12 12M12 3v9" stroke-dasharray="1.5 1.5" opacity=".6"/>'),
  planes:sv('<path d="M3 16.5 7.5 7h13.5l-4.5 9.5z"/><path d="M8 3.5v17" opacity=".55"/>'),
  edit:sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  pause:sv('<path d="M9 5v14M15 5v14"/>'),
  play:sv('<path d="M7 5v14l11-7z"/>'),
  trash:sv('<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>'),
  ok:sv('<path d="m5 12.5 4.5 4.5L19 7.5"/>','stroke-width="2.2"'),
  x:sv('<path d="M6 6l12 12M18 6 6 18"/>','stroke-width="2"'),
  origin:sv('<path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="3"/>'),
  eye:sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  hidden:sv('<rect x="4.5" y="4.5" width="15" height="15" rx="1"/><path d="M8 12h2.2M12 12h2.2M16 12h1"/>'),
  center:sv('<path d="M12 3v3.5M12 8.5v2M12 12.5v3M12 17.5v3.5M3 12h3.5M8.5 12h2M13.5 12h3M18.5 12H21"/><circle cx="12" cy="12" r="6"/>'),
  autodim:sv('<path d="M4 18h16M4 15v6M20 15v6"/><path d="M7.5 16.2 4.6 18l2.9 1.8M16.5 16.2l2.9 1.8-2.9 1.8"/><path d="M6 4h12v7H6z"/>'),
  dim:sv('<path d="M4 15h16M4 11v8M20 11v8"/><path d="M7.5 13.2 4.6 15l2.9 1.8M16.5 13.2l2.9 1.8-2.9 1.8"/><path d="M10 6h4M12 4v4"/>'),
  isoView:sv('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill="currentColor" fill-opacity=".15"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  svg:sv('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  pdf:sv('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16.5h6M9 9.5h3"/>'),
  png:sv('<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="m4 16 5-5 4 4 2.5-2.5L20 17"/><circle cx="15.5" cy="9" r="1.3"/>'),
};

/* ---------- sabitler ---------- */
const MATERIALS={
  steel:{name:'Çelik (S235JR)',rho:7.85},c45:{name:'Çelik (C45)',rho:7.85},inox:{name:'Paslanmaz (AISI 304)',rho:7.93},
  al:{name:'Alüminyum (6061-T6)',rho:2.70},brass:{name:'Pirinç (CuZn39Pb3)',rho:8.47},gg25:{name:'Dökme demir (EN-GJL-250)',rho:7.20},
  abs:{name:'ABS',rho:1.04},pom:{name:'POM (Delrin)',rho:1.41}
};
const PAPERS={A4:{W:297,H:210},A3:{W:420,H:297},A2:{W:594,H:420},A1:{W:841,H:594},A0:{W:1189,H:841}};
const FT={
  sketch:{n:'Çizim',icon:'sketch'},plane:{n:'Düzlem',icon:'plane'},
  extrude:{add:'Ekstrüzyon Katman/Taban',cut:'Ekstrüzyon Kesme',n:{add:'Ekstrüzyon',cut:'Kesme-Ekstrüzyon'},icon:{add:'extrude',cut:'cut'}},
  revolve:{add:'Döndürme Katman/Taban',cut:'Döndürme Kesme',n:{add:'Döndürme',cut:'Kesme-Döndürme'},icon:{add:'revolve',cut:'revcut'}},
  fillet:{n:'Radyus',icon:'fillet'},chamfer:{n:'Pah',icon:'chamfer'},
  lpattern:{n:'DoğrusalÇoğaltma',label:'Doğrusal Çoğaltma',icon:'lpattern'},cpattern:{n:'DaireselÇoğaltma',label:'Dairesel Çoğaltma',icon:'cpattern'},mirror:{n:'Aynala',icon:'mirror'}
};
const typeLabel=f=>{const t=FT[f.type];if(f.type==='extrude'||f.type==='revolve')return t[f.op==='cut'?'cut':'add'];if(f.type==='plane')return 'Referans Düzlem';return t.label||t.n};
const typeIcon=f=>{const t=FT[f.type];return typeof t.icon==='string'?t.icon:t.icon[f.op==='cut'?'cut':'add']};
const baseName=f=>{const t=FT[f.type];return typeof t.n==='string'?t.n:t.n[f.op==='cut'?'cut':'add']};
function nextName(f){const b=baseName(f);let n=0;for(const x of state.features){const m=String(x.name||'').match(new RegExp('^'+b+'(\\d+)$'));if(m)n=Math.max(n,+m[1])}return b+(n+1)}

function demoFeatures(){
  const S=(id,name,on,pts,ents,cons)=>({id,type:'sketch',name,on,pts,ents,cons});
  const X=(id,name,op,sketch,end,depth,extra)=>Object.assign({id,type:'extrude',name,op,sketch,end,depth,flip:false,dir2:false,end2:'blind',depth2:10},extra||{});
  const L=(id,a,b,cons)=>({id,t:'line',a,b,cons:!!cons});
  return [
    S('s1','Çizim1',{kind:'std',key:'top'},{p1:{x:-60,y:-40},p2:{x:60,y:-40},p3:{x:60,y:40},p4:{x:-60,y:40}},
      [L('e1','p1','p2'),L('e2','p2','p3'),L('e3','p3','p4'),L('e4','p4','p1'),L('e5','p1','p3',1),L('e6','p2','p4',1)],
      [{id:'c1',t:'h',e:'e1'},{id:'c2',t:'v',e:'e2'},{id:'c3',t:'h',e:'e3'},{id:'c4',t:'v',e:'e4'},{id:'c5',t:'mid',p:'O',e:'e5'},{id:'c6',t:'d',p:'p1',q:'p2',val:120,lp:[0,-52]},{id:'c7',t:'d',p:'p2',q:'p3',val:80,lp:[74,0]}]),
    X('x1','Ekstrüzyon1','add','s1','blind',15),
    S('s2','Çizim2',{kind:'face',feat:'x1',which:'far',sgn:1},{},[{id:'e1',t:'circle',c:'O',r:23}],[{id:'c1',t:'ddia',e:'e1',val:46,lp:[28,24]}]),
    X('x2','Ekstrüzyon2','add','s2','blind',35),
    S('s3','Çizim3',{kind:'face',feat:'x2',which:'far',sgn:1},{},[{id:'e1',t:'circle',c:'O',r:13}],[{id:'c1',t:'ddia',e:'e1',val:26,lp:[-20,18]}]),
    X('x3','Kesme-Ekstrüzyon1','cut','s3','through',10),
    S('s4','Çizim4',{kind:'std',key:'front'},{a:{x:0,y:60},b1:{x:0,y:38},b2:{x:17,y:38},b3:{x:17,y:52},b4:{x:0,y:52}},
      [L('e1','O','a',1),L('e2','b1','b2'),L('e3','b2','b3'),L('e4','b3','b4'),L('e5','b4','b1')],
      [{id:'c1',t:'v',e:'e1'},{id:'c2',t:'d',p:'O',q:'a',val:60,lp:[-9,30]},{id:'c3',t:'h',e:'e2'},{id:'c4',t:'v',e:'e3'},{id:'c5',t:'h',e:'e4'},{id:'c6',t:'v',e:'e5'},{id:'c7',t:'pol',p:'b1',e:'e1'},
       {id:'c8',t:'dv',p:'O',q:'b1',val:38,lp:[30,19]},{id:'c9',t:'d',p:'b1',q:'b2',val:17,lp:[8.5,33]},{id:'c10',t:'d',p:'b2',q:'b3',val:14,lp:[25,45]}]),
    {id:'r1',type:'revolve',name:'Kesme-Döndürme1',op:'cut',sketch:'s4',axis:'e1',angle:360,mode:'one',flip:false},
    S('s5','Çizim5',{kind:'face',feat:'x1',which:'far',sgn:1},{h:{x:48,y:28}},[{id:'e1',t:'circle',c:'h',r:4.5}],
      [{id:'c1',t:'dh',p:'O',q:'h',val:48,lp:[24,36]},{id:'c2',t:'dv',p:'O',q:'h',val:28,lp:[58,14]},{id:'c3',t:'ddia',e:'e1',val:9,lp:[60,36]}]),
    X('x4','Kesme-Ekstrüzyon2','cut','s5','through',10),
    {id:'lp1',type:'lpattern',name:'DoğrusalÇoğaltma1',targets:['x4'],dir1:'-x',sp1:96,n1:2,dir2:'z',sp2:56,n2:2},
    S('s6','Çizim6',{kind:'std',key:'front'},{q1:{x:-3,y:44},q2:{x:3,y:44},q3:{x:3,y:52},q4:{x:-3,y:52}},
      [L('e1','q1','q2'),L('e2','q2','q3'),L('e3','q3','q4'),L('e4','q4','q1')],
      [{id:'c1',t:'h',e:'e1'},{id:'c2',t:'v',e:'e2'},{id:'c3',t:'h',e:'e3'},{id:'c4',t:'v',e:'e4'},{id:'c5',t:'d',p:'q1',q:'q2',val:6,lp:[0,40]},{id:'c6',t:'d',p:'q2',q:'q3',val:8,lp:[10,48]},{id:'c7',t:'dv',p:'O',q:'q1',val:44,lp:[-14,22]},{id:'c8',t:'dh',p:'O',q:'q1',val:3,lp:[-1.5,57]}]),
    X('x5','Kesme-Ekstrüzyon3','cut','s6','through',10,{dir2:true,end2:'through'}),
    {id:'fl1',type:'fillet',name:'Radyus1',r:10,edges:[{a:[60,0,40],b:[60,15,40]},{a:[-60,0,40],b:[-60,15,40]},{a:[60,0,-40],b:[60,15,-40]},{a:[-60,0,-40],b:[-60,15,-40]}]}
  ];
}
function defaultDrawing(){return {paper:'A3',orient:'landscape',method:'E',scale:'auto',hidden:true,centers:true,autodims:true,iso:true,dno:'TZ-0001',drawn:'',checked:'',company:'',dims:[]}}
function newPart(name){return {id:uid('P'),partName:name||'Parça1',material:'steel',features:[],drawing:defaultDrawing()}}
/* dosyadan/depodan gelen veri onarılır: bilinmeyen veya bozuk özellikler atılır, çizimin eksik alanları tamamlanır
   (yoksa tek bir bozuk öğe ağacı ve sahneyi çizen kodu durdurur) */
const FEAT_TYPES=new Set(['sketch','plane','extrude','revolve','hole','fillet','chamfer','lpattern','cpattern','mirror']);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function normFeature(f,ids){
  if(!f.id||ids.has(f.id))f.id=uid(f.type==='sketch'?'s':'f');ids.add(f.id);
  if(typeof f.name!=='string'||!f.name)f.name=f.id;
  if(f.type==='sketch'){
    if(!isObj(f.on))f.on={kind:'std',key:'front'};
    if(!isObj(f.pts))f.pts={};for(const k in f.pts)if(!isObj(f.pts[k])||!isFinite(f.pts[k].x)||!isFinite(f.pts[k].y))delete f.pts[k];
    f.ents=(Array.isArray(f.ents)?f.ents:[]).filter(isObj);f.cons=(Array.isArray(f.cons)?f.cons:[]).filter(isObj);
  }else for(const k of ['targets','edges','pts'])if(k in f&&!Array.isArray(f[k]))f[k]=[];
  return f;
}
/* 2B çizim öğesi (teknik resim): bozuk olanlar atılır */
const okPt=q=>Array.isArray(q)&&q.length===2&&q.every(x=>typeof x==='number'&&isFinite(x));
const okSk=e=>isObj(e)&&(e.view==null||typeof e.view==='string')&&(e.t==='line'?Array.isArray(e.p)&&e.p.length===2&&e.p.every(okPt):['circ','arc','cmark'].includes(e.t)&&okPt(e.c)&&e.r>0&&(e.t!=='arc'||isFinite(e.a0)&&isFinite(e.sw)));
function normDrawing(d){for(const k of ['dims','notes','surfs','details','gdts','datums','sk2d','hide'])if(k==='dims'?!Array.isArray(d.dims):(k in d&&!Array.isArray(d[k])))d[k]=[];if(d.sk2d)d.sk2d=d.sk2d.filter(okSk);return d}
function normPart(p){
  p.drawing=normDrawing(Object.assign(defaultDrawing(),isObj(p.drawing)?p.drawing:{}));
  if(!MATERIALS[p.material])p.material='steel';if(!p.id)p.id=uid('P');if(!p.partName)p.partName='Parça';
  const ids=new Set();p.features=(Array.isArray(p.features)?p.features:[]).filter(f=>isObj(f)&&FEAT_TYPES.has(f.type)).map(f=>normFeature(f,ids));
  return p;
}
/* montajın resim ayarları (drawing) ve patlatma adımları (explode) da korunur */
function normAsm(a){const o={...a,id:a.id||uid('A'),name:a.name||'Montaj1',comps:(Array.isArray(a.comps)?a.comps:[]).filter(c=>isObj(c)&&c.id).map(c=>Array.isArray(c.T)&&c.T.length===16&&c.T.every(isFinite)?c:{...c,T:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}),mates:(Array.isArray(a.mates)?a.mates:[]).filter(m=>isObj(m)&&isObj(m.a)&&isObj(m.b))};
  if(o.drawing!==undefined){if(isObj(o.drawing))normDrawing(o.drawing);else delete o.drawing}if(o.explode!==undefined&&!(isObj(o.explode)&&Array.isArray(o.explode.steps)))delete o.explode;
  // bileşen çoğaltmaları: bozuk olanlar atılır; çoğaltması kalmayan türetilmiş bileşenler de
  o.pats=(Array.isArray(o.pats)?o.pats:[]).filter(p=>isObj(p)&&p.id&&Array.isArray(p.seeds)&&isObj(p.ref)&&isObj(p.ref.ref));if(!o.pats.length)delete o.pats;
  const pid=new Set((o.pats||[]).map(p=>p.id));o.comps=o.comps.filter(c=>!c.pat||pid.has(c.pat));return o}
function normProject(o){o.version=3;const pid=new Set();o.parts=(Array.isArray(o.parts)?o.parts:[]).filter(isObj).map(normPart);for(const p of o.parts){if(pid.has(p.id))p.id=uid('P');pid.add(p.id)}
  o.asms=(Array.isArray(o.asms)?o.asms:[]).filter(isObj).map(normAsm);if(!isObj(o.cur))o.cur={};if(!o.parts.length)o.parts.push(newPart('Parça1'));if(!o.parts.some(p=>p.id===o.cur.part))o.cur.part=o.parts[0].id;if(o.asms.length&&!o.asms.some(a=>a.id===o.cur.asm))o.cur.asm=o.asms[0].id;return o}
function emptyProject(){const p=newPart('Parça1');return normProject({parts:[p],asms:[],cur:{part:p.id}})}
const LS_KEY='tezgah-cad-v3',LS_OLD='tezgah-cad-v2';
/* loadFailed: kayıt vardı ama okunamadı (bozuk); kopyası “-bozuk” anahtarında saklanır, veritabanı yedeği denenir (recoverCheck) */
let loadFailed=false;
function loadProject(){
  let s=null;
  try{
    s=localStorage.getItem(LS_KEY);if(s){const o=JSON.parse(s);if(o&&Array.isArray(o.parts)&&o.parts.length)return normProject(o)}
    const old=localStorage.getItem(LS_OLD);if(old){const o=JSON.parse(old);if(o&&Array.isArray(o.features)){const p=normPart({partName:o.partName,material:o.material,features:o.features,drawing:o.drawing});return normProject({parts:[p],asms:[],cur:{part:p.id}})}}
  }catch(e){loadFailed=true;try{if(s)localStorage.setItem(LS_KEY+'-bozuk',s)}catch(e2){}}
  return null;
}
const cleanR=(k,v)=>k.startsWith('_')?undefined:v;
let saveT=0,saveWarned=false,lsOk=null;
/* proje tarayıcı deposuna ve veritabanına (backupState) yazılır. Açık çizimin o anki hâli de kaydedilir (yeni ve boş çizim hariç):
   sayfa kapanır, tarayıcı çöker veya elektrik kesilirse yeniden açınca çizime devam edilir */
function writeState(){
  clearTimeout(saveT);saveT=0;const t=Date.now();
  const empty=!!sk&&sk.isNew&&!sk.feat.ents.length&&!Object.values(sk.feat.pts).some(p=>p.sp);
  const i=empty?state.features.indexOf(sk.feat):-1;if(i>=0)state.features.splice(i,1);
  let json;try{json=JSON.stringify(project,cleanR)}finally{if(i>=0)state.features.splice(i,0,sk.feat)}
  try{localStorage.setItem(LS_KEY,json);localStorage.setItem(LS_KEY+'-t',String(t));lsOk=true}
  catch(e){lsOk=false;if(!saveWarned){saveWarned=true;toast(typeof indexedDB!=='undefined'?'Tarayıcı deposu doldu; otomatik kayıt tarayıcı veritabanına yazılıyor. Projeyi ayrıca Ctrl+S ile dosyaya kaydetmen önerilir.':'Tarayıcı depolama alanı doldu. Projeyi Ctrl+S ile dosyaya kaydet.')}}
  backupState(json,t);
}
/* en geç 300 ms sonra yazılır (sürekli değişiklikte de kayıt ertelenmez) */
function saveState(){if(!saveT)saveT=setTimeout(writeState,300)}
/* sayfa kapanırken/gizlenirken bekleyen kayıt ve açık çizim hemen yazılır */
function flushState(){if(saveT||sk)writeState()}
addEventListener('pagehide',flushState);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushState()});
let project=loadProject()||demoProject();
let state=project.parts.find(p=>p.id===project.cur.part)||project.parts[0];

/* ---------- geçmiş (parça başına) ---------- */
const histMap=new Map();
function histFor(id){if(!histMap.has(id))histMap.set(id,{undo:[],redo:[]});return histMap.get(id)}
let hist=histFor(state.id);
// teknik resim ayrı geçmişte tutulur (dwHist): parçada geri almak resme eklenen ölçüleri silmez
const snapshot=()=>JSON.stringify({features:state.features,partName:state.partName,material:state.material},cleanR);
function restoreSnap(s){const o=JSON.parse(s);state.features=o.features;state.partName=o.partName;state.material=o.material}
function pushHist(){hist.undo.push(snapshot());if(hist.undo.length>80)hist.undo.shift();hist.redo=[];updUndo()}
function undo(){if(activeTab==='drawing')return dwUndo();if(activeTab==='asm')return asmUndo();if(sk)return sketchUndo();if(!hist.undo.length)return;closePM(true);const top=hist.undo[hist.undo.length-1];if(top&&typeof top==='object'){partHistOp(top,true);return}hist.redo.push(snapshot());restoreSnap(hist.undo.pop());afterChange();updUndo()}
function redo(){if(activeTab==='drawing')return dwRedo();if(activeTab==='asm')return asmRedo();if(sk)return sketchRedo();if(!hist.redo.length)return;closePM(true);const top=hist.redo[hist.redo.length-1];if(top&&typeof top==='object'){partHistOp(top,false);return}hist.undo.push(snapshot());restoreSnap(hist.redo.pop());afterChange();updUndo()}
/* parça adı/malzeme değişikliği kendi geri alma adımıdır; yoksa sonraki bir adımı geri almak onu da sessizce geri alırdı.
   çizim açıkken çizimin başlangıç anlık görüntüsüne işlenir (çizimi iptal etmek veya geri almak değişikliği geri almaz) */
function metaChange(fn){
  if(!sk){pushHist();fn();saveState();return}
  fn();const i=hist.undo.length-1;if(i>=0){const o=JSON.parse(hist.undo[i]);o.partName=state.partName;o.material=state.material;hist.undo[i]=JSON.stringify(o)}
  saveState();
}
/* bildirimdeki “Geri al”: yalnızca o adımı geri alır; bu arada parça/sekme değiştiyse veya yeni adım eklendiyse başka bir geçmişi geri almaz */
function undoStep(){const h=hist,n=h.undo.length,top=h.undo[n-1];return ()=>{if(hist!==h||h.undo.length!==n||h.undo[n-1]!==top||sk||activeTab!=='model')return;undo()}}
function updUndo(){if(activeTab==='drawing'&&typeof dwHistFor==='function'){const h=dwHistFor();$('#undoBtn').disabled=!h.undo.length;$('#redoBtn').disabled=!h.redo.length;return}if(activeTab==='asm'){const h=asmHistFor();$('#undoBtn').disabled=!h||!h.undo.length;$('#redoBtn').disabled=!h||!h.redo.length;return}$('#undoBtn').disabled=sk?!sk.hist.length:!hist.undo.length;$('#redoBtn').disabled=sk?!sk.redo.length:!hist.redo.length}

let toastT=0;
function toast(msg,action){
  const t=$('#toast');t.innerHTML=`<span>${esc(msg)}</span>`+(action?`<button>${esc(action.label)}</button>`:'');
  if(action)t.querySelector('button').onclick=()=>{action.fn();t.classList.remove('on')};
  // düğmesiz bildirim altındaki görünüme yapılan tıklamaları engellemez
  t.classList.toggle('act',!!action);t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),action?6000:3600);
}
/* onay penceresi: btns=[{label,fn,primary}]; Esc veya fn'siz düğme kapatır */
function ask(title,html,btns){
  const d=$('#askDlg');$('#askTitle').textContent=title;$('#askMsg').innerHTML=html;
  $('#askBtns').innerHTML=btns.map((b,i)=>`<button class="sbtn${b.primary?' primary':''}" data-ask="${i}">${esc(b.label)}</button>`).join('');
  $('#askBtns').onclick=e=>{const b=e.target.closest('[data-ask]');if(!b)return;closeAsk();const fn=btns[+b.dataset.ask].fn;if(fn)fn()};
  d.classList.add('on');const p=$('#askBtns .primary')||$('#askBtns button');if(p)p.focus();
}
function closeAsk(){$('#askDlg').classList.remove('on')}
const askOpen=()=>$('#askDlg').classList.contains('on');
function prompt_(msg){const p=$('#vpPrompt');if(msg){p.textContent=msg;p.classList.add('on')}else p.classList.remove('on')}

/* ================= 3B SAHNE ================= */
const vpEl=$('#viewport');
const renderer=new T.WebGLRenderer({antialias:SETTINGS.antialias,alpha:true});
renderer.setPixelRatio(pixelRatioOf(SETTINGS));renderer.setClearColor(0x000000,0);
vpEl.insertBefore(renderer.domElement,vpEl.firstChild);
const scene=new T.Scene();
const perspCam=new T.PerspectiveCamera(30,1,0.5,20000);perspCam.position.set(240,190,280);scene.add(perspCam);
/* çizim düzenlenirken ortografik kamera: perspektif yok, yakınlaştırınca çizim ile arkadaki model birbirine göre kaymaz.
   Görünür yarı yükseklik 1/zoom'dur (top=1, bottom=-1). */
const orthoCam=new T.OrthographicCamera(-1,1,1,-1,0.1,20000);scene.add(orthoCam);
let camera=perspCam;
const controls=new T.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.14;controls.screenSpacePanning=true;controls.rotateSpeed=.8;
scene.add(new T.HemisphereLight(0xffffff,0x7d8895,0.72));
const keyLight=new T.DirectionalLight(0xffffff,0.62);keyLight.position.set(0.5,0.9,0.4);camera.add(keyLight);
const fillL=new T.DirectionalLight(0xffffff,0.22);fillL.position.set(-1,-.3,-.6);scene.add(fillL);

const matSolid=new T.MeshStandardMaterial({color:0xA9B5C1,metalness:.22,roughness:.52,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const matEdge=new T.LineBasicMaterial({color:0x18202a});
const matSel=new T.MeshBasicMaterial({color:0x2F7BE0,transparent:true,opacity:.3,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
const matHov=new T.MeshBasicMaterial({color:0xE39A2D,transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
const matSelEdge=new T.LineBasicMaterial({color:0xF08A1A,depthTest:false,transparent:true});
const matPrevAdd=new T.MeshStandardMaterial({color:0xE2A83A,transparent:true,opacity:.45,depthWrite:false,side:T.DoubleSide,roughness:.6});
const matPrevCut=new T.MeshStandardMaterial({color:0xD5482F,transparent:true,opacity:.4,depthWrite:false,side:T.DoubleSide,roughness:.6});
const matPrevEdgeA=new T.LineBasicMaterial({color:0xB0760E}),matPrevEdgeC=new T.LineBasicMaterial({color:0xA82D18});

const solidMesh=new T.Mesh(new T.BufferGeometry(),matSolid);scene.add(solidMesh);
const edgeLines=new T.LineSegments(new T.BufferGeometry(),matEdge);scene.add(edgeLines);
const selMesh=new T.Mesh(new T.BufferGeometry(),matSel);scene.add(selMesh);
const hovMesh=new T.Mesh(new T.BufferGeometry(),matHov);scene.add(hovMesh);
const selEdgeLines=new T.LineSegments(new T.BufferGeometry(),matSelEdge);selEdgeLines.renderOrder=5;scene.add(selEdgeLines);
const previewGroup=new T.Group();scene.add(previewGroup);
const sketchesGroup=new T.Group();scene.add(sketchesGroup);
const skGroup=new T.Group();skGroup.matrixAutoUpdate=false;skGroup.renderOrder=10;scene.add(skGroup);
const depthScene=new T.Scene();
const depthMesh=new T.Mesh(solidMesh.geometry,new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide}));depthScene.add(depthMesh);

/* düzlemler */
const planeGroup=new T.Group();scene.add(planeGroup);
let planeObjs=[];
function makePlaneObj(F,key,size){
  const g=new T.Group();g.matrixAutoUpdate=false;
  const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0x2F62B8,transparent:true,opacity:.06,depthWrite:false,side:T.DoubleSide}));
  const l=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(1,1)),new T.LineBasicMaterial({color:0x2F62B8,transparent:true,opacity:.5}));
  g.add(m,l);const M=frameMatrix(F);M.scale(new T.Vector3(size,size,1));g.matrix.copy(M);m.userData.planeKey=key;g.userData.key=key;return g;
}
/* köşe eksen üçlüsü */
const triScene=new T.Scene();const triCam=new T.OrthographicCamera(-1.7,1.7,1.7,-1.7,0.1,10);
function textSprite(txt,color){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.font='600 42px Barlow, Arial, sans-serif';x.fillStyle=color;x.textAlign='center';x.textBaseline='middle';x.fillText(txt,32,35);const t=new T.CanvasTexture(c);const s=new T.Sprite(new T.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(.6,.6,1);return s}
[[1,0,0,0xD0453A,'X'],[0,1,0,0x3E9A4E,'Y'],[0,0,1,0x3466C2,'Z']].forEach(([x,y,z,c,t])=>{const d=new T.Vector3(x,y,z);triScene.add(new T.ArrowHelper(d,new T.Vector3(),1,c,.32,.18));const s=textSprite(t,'#'+c.toString(16).padStart(6,'0'));s.position.copy(d.multiplyScalar(1.35));triScene.add(s)});

/* ---------- uygulama durumu ---------- */
let display='shadedEdges',showPlanes=false,activeTab='model',cmTab='features';
let sel=null;            // {kind:'plane',key} | {kind:'face',...} | {kind:'feature',id} | {kind:'edge',e}
let pm=null;             // açık PropertyManager: {type, draft, isNew, base}
let sk=null;             // etkin çizim düzenleme oturumu
let pickMode=null;       // 'plane' (çizim düzlemi seçimi)
let pending=null;        // çizimden sonra açılacak özellik
const model={polys:[],ann:[],errors:{},frames:{},caps:{},version:0,triPoly:[],box:null,props:null,ms:0,dof:{}};
let shown={polys:[],edges:[],triPoly:[]};

function polysToBuffers(polys,filter){
  const kf=v=>Math.round(v.x*1000)+'_'+Math.round(v.y*1000)+'_'+Math.round(v.z*1000);
  const nm=new Map();
  if(!filter){for(const p of polys){const n=p.plane.n;for(const v of p.verts){const k=kf(v);let arr=nm.get(k);if(!arr)nm.set(k,arr=[]);if(!arr.some(m=>m.dot(n)>.9999))arr.push(n)}}}
  const COS=Math.cos(32*Math.PI/180);const pos=[],nor=[],tp=[];
  polys.forEach((p,pi)=>{
    if(filter&&!filter(p))return;
    const n=p.plane.n,q=p.verts;
    const vnrm=q.map(v=>{if(filter)return [n.x,n.y,n.z];const arr=nm.get(kf(v));let x=0,y=0,z=0;for(const m of arr)if(m.dot(n)>=COS){x+=m.x;y+=m.y;z+=m.z}const l=Math.hypot(x,y,z);return l>1e-9?[x/l,y/l,z/l]:[n.x,n.y,n.z]});
    for(let i=1;i<q.length-1;i++){for(const j of [0,i,i+1]){const v=q[j],w=vnrm[j];pos.push(v.x,v.y,v.z);nor.push(w[0],w[1],w[2])}tp.push(pi)}
  });
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.computeBoundingSphere();
  return {g,tp};
}
function segGeom(segs){const arr=new Float32Array(segs.length*6);segs.forEach((s,i)=>{arr.set(s.a,i*6);arr.set(s.b,i*6+3)});const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(arr,3));return g}
function showSolid(polys){
  requestRender();
  // aynı gövde yeniden gösteriliyorsa (önbellekten gelen sonuç) ağ ve kenarlar yeniden kurulmaz
  if(polys===shown.polys&&shown.edges){updateSelVisual();applyDisplay();return}
  const {g,tp}=polysToBuffers(polys);
  solidMesh.geometry.dispose();solidMesh.geometry=g;depthMesh.geometry=g;
  const edges=computeEdges(polys,null,false).filter(e=>e.k===1);
  edgeLines.geometry.dispose();edgeLines.geometry=segGeom(edges);
  shown={polys,edges,triPoly:tp};
  updateSelVisual();applyDisplay();
}
function rebuild(){
  const t0=performance.now();
  const old=model.partId===state.id&&model.key?{key:model.key,polys:model.polys,ann:model.ann}:null;
  const r=partRebuild(state);syncEdgeRefs(state,r);model.key=partKey(state);model.partId=state.id;
  if(old&&old.key!==model.key&&partChanged(state,old,r))saveState();
  Object.assign(model,{polys:r.polys,ann:r.ann,errors:r.errors,frames:r.frames,caps:r.caps,tools:r.tools});
  model.version++;model.box=r.polys.length?bboxPolys(r.polys):null;model.props=r.polys.length?massProps(r.polys):null;
  model.ms=Math.round(performance.now()-t0);perfRebuildMs=model.ms;
  model.dof={};for(const f of state.features)if(f.type==='sketch'){const d=sketchDof(f);if(d!==undefined)model.dof[f.id]=d}
  showSolid(sk&&sk.base?sk.base:model.polys);rebuildPlanes();renderSketchDisplays();updateMass();updateStatus();
}
/* çizimlerin serbestlik derecesi (ağaçtaki “tanımsız” işareti): çizim değişmedikçe yeniden hesaplanmaz */
const dofCache=new Map();
function sketchDof(f){
  const k=JSON.stringify([f.pts,f.ents,f.cons]);const c=dofCache.get(f.id);if(c&&c.k===k)return c.d;
  let d;try{d=analyzeSketch(f).dof}catch(e){d=undefined}
  dofCache.set(f.id,{k,d});if(dofCache.size>400)dofCache.delete(dofCache.keys().next().value);return d;
}
/* radyus/pah kenarları: model değişince kenar yeni konumuyla (ve imzasıyla) saklanır; ölçü değişikliğinden sonra da bulunur */
function syncEdgeRefs(p,r){
  const close=(x,y)=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])<1e-6;
  for(const f of p.features){const R=r.edgeRefs&&r.edgeRefs[f.id];if(!R||!f.edges||R.length!==f.edges.length)continue;
    f.edges.forEach((se,i)=>{const n=R[i];if(!close(se.a,n.a)||!close(se.b,n.b)||JSON.stringify(se.sig)!==JSON.stringify(n.sig)){se.a=n.a;se.b=n.b;se.sig=n.sig}})}
}
/* çizim düzenlenirken koyu temada gövde koyulaşır; açık renkli çizim çizgileri normal görünümde parlayan yüzeyde kaybolmaz */
function solidTone(){matSolid.color.setHex(sk&&isDark()?0x2A3139:0xA9B5C1)}
function updateStatus(){
  if(activeTab==='asm')return asmStatus();
  const el=$('#vpStatus');const ne=Object.keys(model.errors).length;const nf=state.features.filter(f=>f.type!=='sketch').length;
  if(sk){el.classList.add('hidden');return}el.classList.remove('hidden');
  if(state.mesh){el.textContent=`STL'den içe aktarılan gövde (${model.polys.length} üçgen)`;el.classList.remove('bad');return}
  if(!state.features.length){el.textContent='Boş parça. Bir düzlem seçip Çizim ile başla.';el.classList.remove('bad');return}
  if(ne){el.textContent=`${ne} öğede hata var. Ağaçta kırmızı görünen öğeyi düzenle.`;el.classList.add('bad')}
  else{el.textContent=`${nf} özellik yeniden oluşturuldu (${model.ms} ms)`;el.classList.remove('bad')}
}
function massText(g){return g>=1000?fmt(g/1000,3)+' kg':fmt(g,1)+' g'}
function updateMass(){
  if(activeTab==='asm')return asmMass();
  const el=$('#mass');if(!model.props||sk){el.classList.add('hidden');return}el.classList.remove('hidden');
  const m=MATERIALS[state.material]||MATERIALS.steel,v=model.props.vol,b=model.box;
  el.innerHTML=`<span>Malzeme</span><span>${esc(m.name)}</span><span>Hacim</span><span>${fmt(v,0)} mm³</span><span>Yüzey alanı</span><span>${fmt(model.props.area,0)} mm²</span><span>Kütle</span><span>${massText(v/1000*m.rho)}</span><span>Boyutlar (X × Y × Z)</span><span>${fmt(b.max[0]-b.min[0],1)} × ${fmt(b.max[1]-b.min[1],1)} × ${fmt(b.max[2]-b.min[2],1)}</span>`;
}
function applyDisplay(){
  requestRender();
  solidMesh.visible=display!=='wire';edgeLines.visible=display!=='shaded';
  if(typeof asmView!=='undefined')for(const v of asmView.groups.values()){v.m.visible=display!=='wire';v.l.visible=display!=='shaded'}
  $$('[data-disp]').forEach(b=>b.classList.toggle('on',b.dataset.disp===display));
  $$('[data-hud="planes"]').forEach(b=>b.classList.toggle('on',showPlanes));
}
function curBox(){return activeTab==='asm'?(asmView.box||null):model.box}
function modelExtent(){const b=curBox();let m=b?Math.max(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2],...b.min.map(Math.abs),...b.max.map(Math.abs)):100;
  // çizim düzenlenirken çizimin boyutu da hesaba katılır (yakınlaştırma sınırları büyük çizimlerde de çalışsın)
  if(sk&&activeTab!=='asm'){const k=skBox(sk.feat);m=Math.max(m,k.x1-k.x0,k.y1-k.y0)}
  return m}
function rebuildPlanes(){
  for(const o of planeObjs){planeGroup.remove(o);o.traverse(c=>{if(c.geometry)c.geometry.dispose()})}
  planeObjs=[];const S=Math.max(80,modelExtent()*1.25);
  for(const k of ['front','top','right'])planeObjs.push(makePlaneObj(STD[k],k,S));
  for(const f of state.features)if(f.type==='plane'&&model.frames[f.id])planeObjs.push(makePlaneObj(model.frames[f.id],f.id,S*.8));
  planeObjs.forEach(o=>planeGroup.add(o));updatePlaneVis();
}
function updatePlaneVis(){
  const selKey=sel&&sel.kind==='plane'?sel.key:null;const skKey=sk&&sk.feat.on.kind!=='face'?(sk.feat.on.key||sk.feat.on.id):null;
  const pmPlane=pm&&pm.type==='mirror'?pm.draft.plane:(pm&&pm.type==='plane'?pm.draft.base:null);
  for(const o of planeObjs){
    const k=o.userData.key;const hot=k===selKey||k===pmPlane;
    o.visible=showPlanes||pickMode==='plane'||hot||k===skKey||(state.features.some(f=>f.id===k)&&!sk);
    if(k===skKey&&sk)o.visible=false;
    o.children[0].material.opacity=hot?.18:.06;o.children[1].material.opacity=hot?.95:.45;
    o.children[0].material.color.setHex(hot?0x2F7BE0:0x2F62B8);
  }
}

/* ---------- kamera ---------- */
let camAnim=null;
const isOrtho=()=>camera===orthoCam;
/* ortografik kamerada kameranın hedefe uzaklığı yalnızca kırpmayı etkiler: model her zaman önünde kalsın */
function orthoDepth(r){return Math.max(200,modelExtent()*4,(r||0)*4)}
function orthoClip(D){orthoCam.near=0.1;orthoCam.far=D*2+modelExtent()*4;orthoCam.updateProjectionMatrix()}
/* yarıçapı r olan küreyi ekrana sığdıran zoom (görünür yarı yükseklik r veya dar ekranda r/en-boy) */
const orthoZoomFor=r=>1/(r*Math.max(1,1/camera.aspect));
/* kamerayı (bakış yönü ve görünür alan aynı kalarak) ortografik veya perspektif yapar */
function setOrtho(on){
  if(on===isOrtho())return;
  camAnim=null;const from=camera,to=on?orthoCam:perspCam,t=controls.target;
  const dir=from.position.clone().sub(t);const dist=dir.length()||1;dir.normalize();const tf=Math.tan(perspCam.fov*Math.PI/360);
  if(on){orthoCam.zoom=1/Math.max(1e-6,dist*tf);const D=orthoDepth();orthoCam.position.copy(t).addScaledVector(dir,D);orthoCam.aspect=perspCam.aspect;orthoCam.left=-perspCam.aspect;orthoCam.right=perspCam.aspect;orthoClip(D)}
  else{const d=1/orthoCam.zoom/tf;perspCam.position.copy(t).addScaledVector(dir,d);perspCam.near=Math.max(.01,d/200);perspCam.far=Math.max(d*60,d+modelExtent()*8);perspCam.updateProjectionMatrix()}
  to.up.copy(from.up);to.quaternion.copy(from.quaternion);to.add(keyLight);
  camera=to;controls.object=to;controls.update();
}
function fitCamera(dir,animate=true,up,box){
  let c=new T.Vector3(),r=60;
  const bx=box||curBox();if(bx){const b=bx;c.set((b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,(b.min[2]+b.max[2])/2);r=Math.max(5,Math.hypot(b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2])/2)}
  let d=dir?new T.Vector3(...dir).normalize():camera.position.clone().sub(controls.target).normalize();
  if(Math.abs(d.y)>0.9995)d=new T.Vector3(0,d.y,d.y>0?0.001:-0.001).normalize();
  camTo(c,d,r*1.08,animate);
}
/* hedef c, bakış yönü d (hedeften kameraya), r yarıçaplı küre ekrana sığacak şekilde */
function camTo(c,d,r,animate=true){
  let toPos,z1=null;
  if(isOrtho()){const D=orthoDepth(r);toPos=c.clone().addScaledVector(d,D);orthoClip(D);z1=orthoZoomFor(r)}
  else{const fov=camera.fov*Math.PI/180,hf=2*Math.atan(Math.tan(fov/2)*camera.aspect);const dist=r/Math.sin(Math.min(fov,hf)/2);
    toPos=c.clone().addScaledVector(d,dist);camera.near=Math.max(.1,dist/200);camera.far=dist*60;camera.updateProjectionMatrix()}
  if(!animate||reduceMotion){camera.position.copy(toPos);controls.target.copy(c);if(z1){camera.zoom=z1;camera.updateProjectionMatrix()}controls.update();camAnim=null;return}
  camAnim={p0:camera.position.clone(),t0:controls.target.clone(),p1:toPos,t1:c,z0:camera.zoom,z1,s:performance.now(),dur:420};
}
function normalTo(F){
  if(!F)return;let n=F.n.slice();
  // SolidWorks "Normal Görünüm": çizim düzlemine dik bak
  const c=model.box?new T.Vector3((model.box.min[0]+model.box.max[0])/2,(model.box.min[1]+model.box.max[1])/2,(model.box.min[2]+model.box.max[2])/2):new T.Vector3();
  const o=v3(F.o);const nv=v3(n);const cp=c.clone().sub(nv.clone().multiplyScalar(c.clone().sub(o).dot(nv)));
  let d=nv.clone();if(Math.abs(d.y)>0.9995)d=new T.Vector3(0,d.y,d.y>0?0.001:-0.001).normalize();
  camTo(cp,d,Math.max(40,modelExtent()*.75));
}
const VIEWDIRS={front:[0,0,1],top:[0,1,0],right:[1,0,0],iso:[1,1,1]};
function resize(){const r=vpEl.getBoundingClientRect();if(r.width<2||r.height<2)return;renderer.setSize(r.width,r.height,false);
  const a=r.width/r.height;perspCam.aspect=a;perspCam.updateProjectionMatrix();orthoCam.aspect=a;orthoCam.left=-a;orthoCam.right=a;orthoCam.updateProjectionMatrix();if(sk)sk.dirty=true}
new ResizeObserver(resize).observe(vpEl);
const tmp2=new T.Vector2();let lastCamKey='';
function loop(){
  requestAnimationFrame(loop);
  if(activeTab==='drawing')return;
  if(camAnim){let t=Math.min(1,(performance.now()-camAnim.s)/camAnim.dur);t=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;camera.position.lerpVectors(camAnim.p0,camAnim.p1,t);controls.target.lerpVectors(camAnim.t0,camAnim.t1,t);
    if(camAnim.z1&&isOrtho()){camera.zoom=camAnim.z0+(camAnim.z1-camAnim.z0)*t;camera.updateProjectionMatrix()}if(t>=1)camAnim=null}
  controls.update();
  const ck=camera.position.toArray().map(v=>v.toFixed(3)).join()+controls.target.toArray().map(v=>v.toFixed(3)).join()+camera.aspect.toFixed(3)+camera.zoom.toPrecision(6);
  const moved=ck!==lastCamKey;
  if(moved){lastCamKey=ck;if(sk)sk.dirty=true}
  if(sk&&sk.dragTg)flushDrag();
  if(sk&&sk.dirty){sk.dirty=false;renderSketch();requestRender()}
  if(sk)placeLabels();
  if(!shouldRender(moved||!!camAnim))return;
  renderer.getSize(tmp2);renderer.setScissorTest(false);renderer.setViewport(0,0,tmp2.x,tmp2.y);renderer.render(scene,camera);
  const sz=Math.min(86,tmp2.x*.22),by=sk?30:4;renderer.setScissorTest(true);renderer.setScissor(tmp2.x-sz-4,by,sz,sz);renderer.setViewport(tmp2.x-sz-4,by,sz,sz);
  const dir=camera.position.clone().sub(controls.target).normalize();triCam.position.copy(dir).multiplyScalar(4);triCam.up.copy(camera.up);triCam.lookAt(0,0,0);
  renderer.render(triScene,triCam);renderer.setScissorTest(false);
}
/* sol tuş araca kalır; flat: çizim düzenlenirken görünüm 2B kalır (döndürme yok, orta ve sağ tuş kaydırır) */
function setControlsForSketch(on,flat){
  if(on){controls.mouseButtons={LEFT:-1,MIDDLE:flat?T.MOUSE.PAN:T.MOUSE.ROTATE,RIGHT:T.MOUSE.PAN};controls.touches={ONE:-1,TWO:T.TOUCH.DOLLY_PAN}}
  else{controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};controls.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN}}
  controls.enableRotate=!(on&&flat);
}
/* fare tekerleği: ekran merkezine değil imlecin altındaki noktaya doğru yakınlaş (SolidWorks gibi) */
const zoomPlane=new T.Plane();
function zoomPoint(e){
  ray.setFromCamera(ndc(e),camera);
  const ms=activeTab==='asm'?[...asmView.groups.values()].filter(v=>v.g.visible&&v.m.visible).map(v=>v.m):(solidMesh.visible&&!sk?[solidMesh]:[]);
  const h=ms.length?ray.intersectObjects(ms)[0]:null;if(h)return h.point;
  const n=new T.Vector3(),dT=camera.position.distanceTo(controls.target);
  if(sk){zoomPlane.setFromNormalAndCoplanarPoint(n.setFromMatrixColumn(skGroup.matrix,2),new T.Vector3().setFromMatrixPosition(skGroup.matrix));const p=ray.ray.intersectPlane(zoomPlane,new T.Vector3());if(p&&camera.position.distanceTo(p)<dT*8)return p}
  camera.getWorldDirection(n);zoomPlane.setFromNormalAndCoplanarPoint(n,controls.target);
  return ray.ray.intersectPlane(zoomPlane,new T.Vector3())||controls.target.clone();
}
function wheelZoom(e){
  const dy=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1);const f=Math.pow(1.0015,Math.max(-300,Math.min(300,dy)));
  const p=zoomPoint(e),ext=modelExtent();
  if(isOrtho()){
    // ortografik: görünür alan küçülür/büyür, imleç noktası yerinde kalsın diye hedef ve kamera yana kayar
    const h=1/camera.zoom;if(f<1&&h*f<ext*.0005)return;if(f>1&&h*f>ext*20)return;
    camAnim=null;const n=camera.getWorldDirection(new T.Vector3());const sh=p.clone().sub(controls.target).multiplyScalar(1-f);sh.addScaledVector(n,-sh.dot(n));
    controls.target.add(sh);camera.position.add(sh);camera.zoom/=f;camera.updateProjectionMatrix();return;
  }
  if(f<1&&camera.position.distanceTo(p)*f<ext*.002)return;
  if(f>1&&camera.position.distanceTo(controls.target)*f>ext*60)return;
  camAnim=null;
  // kamera ve hedef, imleç noktası etrafında ölçeklenir: o nokta ekranda yerinde kalır
  camera.position.sub(p).multiplyScalar(f).add(p);controls.target.sub(p).multiplyScalar(f).add(p);
  const d=camera.position.distanceTo(p);
  if(d/20<camera.near||camera.far<d*4){camera.near=Math.max(.01,Math.min(camera.near,d/20));camera.far=Math.max(camera.far,d*4+ext*4);camera.updateProjectionMatrix()}
}
// OrbitControls'un kendi tekerlek yakınlaştırmasından önce yakala (orta tuş ve iki parmak yakınlaştırması aynen kalır)
vpEl.addEventListener('wheel',e=>{if(e.target!==renderer.domElement)return;e.preventDefault();e.stopPropagation();wheelZoom(e)},{capture:true,passive:false});

/* ================= SEÇİM ve TIKLAMA (çizim dışı) ================= */
const ray=new T.Raycaster();
function ndc(e){const r=renderer.domElement.getBoundingClientRect();return new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1)}
function toScreen(p){const r=renderer.domElement.getBoundingClientRect();const v=new T.Vector3(p[0],p[1],p[2]).project(camera);return [(v.x+1)/2*r.width,(1-v.y)/2*r.height,v.z]}
function pickEdge(e,maxPx){
  const r=renderer.domElement.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;
  let best=null,bd=maxPx||8;
  ray.setFromCamera(ndc(e),camera);const hit=solidMesh.visible?ray.intersectObject(solidMesh)[0]:null;
  for(const ed of shown.edges){
    const A=toScreen(ed.a),B=toScreen(ed.b);if(A[2]>1||B[2]>1)continue;
    const dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy;let t=L2?((mx-A[0])*dx+(my-A[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));
    const d=Math.hypot(A[0]+dx*t-mx,A[1]+dy*t-my);if(d>=bd)continue;
    let P=va(ed.a,vk(vs(ed.b,ed.a),t));{const o=ray.ray.origin,rd=ray.ray.direction;const lc=lineClosest([o.x,o.y,o.z],[rd.x,rd.y,rd.z],ed.a,vs(ed.b,ed.a));if(lc){const de=vs(ed.b,ed.a),L2e=vd(de,de)||1;const tt=Math.max(0,Math.min(1,vd(vs(lc[1],ed.a),de)/L2e));P=va(ed.a,vk(de,tt))}}
    if(hit){const dist=camera.position.distanceTo(v3(P));if(dist>hit.distance+Math.max(0.5,modelExtent()*0.01))continue}
    bd=d;best=ed;
  }
  return best;
}
function pickFace(e){
  if(!solidMesh.visible||!shown.polys.length)return null;
  ray.setFromCamera(ndc(e),camera);const h=ray.intersectObject(solidMesh)[0];if(!h)return null;
  const p=shown.polys[shown.triPoly[h.faceIndex]];if(!p)return null;
  return {kind:'face',n:[p.plane.n.x,p.plane.n.y,p.plane.n.z],w:p.plane.w,pt:[h.point.x,h.point.y,h.point.z],feat:p.shared};
}
function pickPlane(e){
  ray.setFromCamera(ndc(e),camera);const ms=planeObjs.filter(o=>o.visible).map(o=>o.children[0]);
  const h=ray.intersectObjects(ms)[0];return h?{kind:'plane',key:h.object.userData.planeKey,dist:h.distance}:null;
}
function faceRef(f){
  // Seçilen yüzeyi, onu oluşturan ekstrüzyonun uç yüzüne bağla (model değişince çizim de taşınır)
  const c=model.caps[f.feat];
  if(c){const dn=vd(f.n,c.F.n);if(Math.abs(dn)>0.9999){const z=vd(vs(f.pt,c.F.o),c.F.n);
    if(Math.abs(z-c.zf)<1e-3)return {kind:'face',feat:f.feat,which:'far',sgn:Math.sign(dn),frame:faceFrame(f.n,f.pt)};
    if(Math.abs(z-c.zn)<1e-3)return {kind:'face',feat:f.feat,which:'near',sgn:Math.sign(dn),frame:faceFrame(f.n,f.pt)}}}
  return {kind:'face',feat:f.feat,which:null,frame:faceFrame(f.n,f.pt)};
}
/* yüzey seçimi/vurgusu: düz yüzeyde aynı düzlemdeki çokgenler; eğri yüzeyde (silindir…) normali yumuşakça değişen komşu çokgenlerin tamamı */
function facePolys(f){
  const same=shown.polys.filter(p=>Math.abs(p.plane.n.x*f.n[0]+p.plane.n.y*f.n[1]+p.plane.n.z*f.n[2]-1)<1e-6&&Math.abs(p.plane.w-f.w)<1e-4);
  if(!same.length||!isCurvedFacet(same))return same;
  if(!shown.adj){const k=v=>Math.round(v.x*1e4)+','+Math.round(v.y*1e4)+','+Math.round(v.z*1e4);const by=new Map();
    shown.polys.forEach((p,i)=>{for(const v of p.verts){const q=k(v);if(!by.has(q))by.set(q,[]);by.get(q).push(i)}});shown.adj={k,by}}
  const {k,by}=shown.adj,lo=Math.cos(12*Math.PI/180);const out=new Set(same),st=[...same];
  while(st.length){const p=st.pop();const cnt=new Map();for(const v of p.verts)for(const j of by.get(k(v))||[])cnt.set(j,(cnt.get(j)||0)+1);
    for(const [j,c] of cnt){if(c<2)continue;const o=shown.polys[j];if(out.has(o)||o.plane.n.dot(p.plane.n)<lo)continue;out.add(o);st.push(o)}}
  return [...out];
}
function isPlanarFace(f){if(!f)return false;const same=shown.polys.filter(p=>Math.abs(p.plane.n.x*f.n[0]+p.plane.n.y*f.n[1]+p.plane.n.z*f.n[2]-1)<1e-6&&Math.abs(p.plane.w-f.w)<1e-4);return same.length>0&&!isCurvedFacet(same)}
/* eğri yüzeyin (silindir, koni…) tek bir üçgeni mi: aynı düzlemdeki çokgenler, normali birkaç derece farklı bir komşuyla kenar paylaşıyorsa */
function isCurvedFacet(same){
  const k=v=>Math.round(v.x*1e4)+','+Math.round(v.y*1e4)+','+Math.round(v.z*1e4);const set=new Set(same);const vs_=new Set();for(const p of same)for(const v of p.verts)vs_.add(k(v));
  const n=same[0].plane.n,lo=Math.cos(12*Math.PI/180),hi=Math.cos(0.3*Math.PI/180);
  for(const p of shown.polys){if(set.has(p))continue;const d=p.plane.n.dot(n);if(d<lo||d>hi)continue;let c=0;for(const v of p.verts)if(vs_.has(k(v))&&++c>=2)return true}
  return false;
}
function updateSelVisual(){requestRender();
  selMesh.geometry.dispose();
  if(sel&&sel.kind==='face'){const fs=new Set(facePolys(sel));selMesh.geometry=polysToBuffers(shown.polys,p=>fs.has(p)).g}
  else if(sel&&sel.kind==='feature')selMesh.geometry=polysToBuffers(shown.polys,p=>p.shared===sel.id).g;
  else selMesh.geometry=new T.BufferGeometry();
  let segs=[];
  if(sel&&sel.kind==='edge')segs=[sel.e];
  if(pm&&(pm.type==='fillet'||pm.type==='chamfer'))segs=[].concat(...pm.draft.edges.map(se=>circleSegsFor(se)));
  selEdgeLines.geometry.dispose();selEdgeLines.geometry=segGeom(segs);
  updatePlaneVis();
}
let pdown=null,hoverT=0;
renderer.domElement.addEventListener('pointerdown',e=>{
  // OrbitControls varsayılanı engellediği için odak paneldeki alanda kalırdı; görünüme tıklayınca alan bırakılır (değeri uygulanır)
  const ae=document.activeElement;if(ae&&/INPUT|SELECT|TEXTAREA/.test(ae.tagName)&&!ae.closest('.pop'))ae.blur();
  if(activeTab==='asm'){asmDown(e);return}pdown={x:e.clientX,y:e.clientY,b:e.button,t:performance.now()};if(sk)skPointerDown(e)});
renderer.domElement.addEventListener('pointermove',e=>{if(activeTab==='asm'){asmMove(e);return}if(sk){skPointerMove(e);return}
  if(e.pointerType==='mouse'&&!pdown){clearTimeout(hoverT);hoverT=setTimeout(()=>hover3D(e),16)}});
renderer.domElement.addEventListener('pointerup',e=>{
  if(activeTab==='asm'){asmUp(e);return}
  const d=pdown;pdown=null;
  if(sk){skPointerUp(e,d);return}
  if(!d||Math.hypot(e.clientX-d.x,e.clientY-d.y)>5||d.b!==0)return;
  click3D(e);
});
renderer.domElement.addEventListener('pointerleave',()=>{hovMesh.geometry.dispose();hovMesh.geometry=new T.BufferGeometry()});
renderer.domElement.addEventListener('dblclick',e=>{
  if(activeTab==='asm'){asmDbl(e);return}
  if(sk){skDblClick(e);return}
  if(pm||pickMode)return;
  const f=pickFace(e);if(!f)return;const ft=state.features.find(x=>x.id===f.feat);if(ft)openPM(ft.type,ft);
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
function hover3D(e){
  if(meas)return;
  if(pm&&(pm.type==='fillet'||pm.type==='chamfer'||pm.type==='lpattern')){const ed=pickEdge(e);hovMesh.geometry.dispose();hovMesh.geometry=new T.BufferGeometry();renderer.domElement.style.cursor=ed?'pointer':'';return}
  const f=(pickMode==='plane'||!pm||['hole','plane','mirror','cpattern'].includes(pm.type))?pickFace(e):null;
  hovMesh.geometry.dispose();
  let fs=null;if(f){fs=new Set(facePolys(f))}
  hovMesh.geometry=f?polysToBuffers(shown.polys,p=>fs.has(p)).g:new T.BufferGeometry();
}
function click3D(e){
  if(meas){measureClick(e);return}
  if(pm&&pm.type==='hole'){const f=pickFace(e);if(f&&!isPlanarFace(f)){toast('Delik düz bir yüzeye açılır.');return}if(f)holeAddPoint(f);return}
  if(pm&&(pm.type==='fillet'||pm.type==='chamfer')){
    const ed=pickEdge(e,12);if(!ed)return;
    const i=pm.draft.edges.findIndex(se=>sameEdgeSel(se,ed));
    if(i>=0)pm.draft.edges.splice(i,1);else pm.draft.edges.push({a:ed.a.slice(),b:ed.b.slice()});
    updateSelVisual();renderPM();schedulePreview();return;
  }
  if(pm&&(pm.type==='extrude'||pm.type==='revolve')){if(!pm.draft.thin)regionClick(e);return}
  if(pm&&pm.type==='mirror'){
    // düzlem veya modelin düz yüzeyi: hangisi öndeyse
    const pl=pickPlane(e),f=pickFace(e);const fd=f?camera.position.distanceTo(v3(f.pt)):Infinity;
    if(f&&(!pl||fd<pl.dist)){if(!isPlanarFace(f)){toast('Ayna düzlemi olarak düz bir yüzey seç.');return}pm.draft.plane=pm.mirFace=faceRef(f)}
    else if(pl)pm.draft.plane=pl.key;else return;
    renderPM();renderTree();updatePlaneVis();schedulePreview();return;
  }
  if(pm&&pm.type==='plane'){
    // taban: düzlem veya modelin düz yüzeyi (hangisi öndeyse; SolidWorks'te yüzeyden ofset düzlem)
    const pl=pickPlane(e),f=pickFace(e);const fd=f?camera.position.distanceTo(v3(f.pt)):Infinity;
    if(f&&(!pl||fd<pl.dist)){if(!isPlanarFace(f)){toast('Referans düzlemi için düz bir yüzey veya düzlem seç.');return}pm.draft.base=pm.baseFace=faceRef(f)}
    else if(pl)pm.draft.base=pl.key;else return;
    renderPM();renderTree();updatePlaneVis();schedulePreview();return;
  }
  if(pm&&(pm.type==='cpattern'||pm.type==='lpattern')){patternPick(e);return}
  if(pm)return;
  if(pickMode==='plane'){
    const f=pickFace(e);if(f&&isPlanarFace(f)){startSketch(faceRef(f));return}
    if(f){toast('Eğri yüzeye çizim yapılamaz. Düz bir yüzey veya düzlem seç.');return}
    const pl=pickPlane(e);if(pl){startSketch(planeRef(pl.key));return}
    return;
  }
  const ed=pickEdge(e,7);if(ed){setSel({kind:'edge',e:ed});return}
  const f=pickFace(e);if(f){setSel(f);return}
  const pl=pickPlane(e);if(pl){setSel(pl);return}
  setSel(null);
}
/* çoğaltma ekseni/yönü modelden: dairesel çoğaltmada silindirik yüz (delik, göbek), dairesel kenar veya düz kenar;
   doğrusal çoğaltmada düz kenar (Yön 1 veya seçili Yön 2) */
function cylAt(pt,n){
  let best=null;
  for(const an of model.ann||[]){const w=v3(pt).sub(an.C),t=w.dot(an.A);const d=w.sub(an.A.clone().multiplyScalar(t)).length();
    if(Math.abs(d-an.r)>Math.max(0.05,an.r*0.03)||t<an.t0-0.2||t>an.t1+0.2||(n&&Math.abs(vd(n,[an.A.x,an.A.y,an.A.z]))>0.25))continue;
    const sp=an.t1-an.t0;if(!best||sp<best.sp)best={sp,an}}
  return best&&best.an;
}
const axisOf=an=>({p:[an.C.x,an.C.y,an.C.z].map(x=>Math.round(x*1e6)/1e6),d:[an.A.x,an.A.y,an.A.z],r:an.r,feat:String(an.gid).split(':')[0]});
function patternPick(e){
  const d=pm.draft;
  if(d.type==='cpattern'){
    const f=pickFace(e),ed=pickEdge(e,8);let an=f&&!isPlanarFace(f)?cylAt(f.pt,f.n):null;
    if(!an&&ed){const c=findCircleAnn(model.ann||[],ed);if(c)an=c.an;else{d.axis={p:ed.a.slice(),d:vn(vs(ed.b,ed.a))};renderPM();schedulePreview();return}}
    if(!an){toast('Eksen için silindirik bir yüze (delik, göbek) veya düz bir kenara tıkla.');return}
    d.axis=axisOf(an);renderPM();schedulePreview();return;
  }
  const ed=pickEdge(e,8);if(!ed)return;if(findCircleAnn(model.ann||[],ed)){toast('Yön için düz bir kenar seç.');return}
  const k=pm.dirSlot===2?'dir2':'dir1';d[k]={d:vn(vs(ed.b,ed.a))};if(k==='dir2'&&!d.n2)d.n2=2;renderPM();schedulePreview();
}
function planeRef(key){return STD[key]?{kind:'std',key}:{kind:'plane',id:key}}
function setSel(s){sel=s;updateSelVisual();renderTree()}
