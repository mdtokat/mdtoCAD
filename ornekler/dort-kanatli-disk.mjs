// Dört kanatlı disk (Ø813) için toCAD proje dosyasını üretir.
// Kullanım: node ornekler/dort-kanatli-disk.mjs  →  ornekler/dort-kanatli-disk.tocad.json
// Resimdeki ölçüler aşağıdaki sabitlerdedir; kalınlıklar resimde verilmediği için varsayımdır.
// Çizimler ilişki ve ölçülerle tam tanımlıdır: programda ölçüyü değiştirmek şekli günceller.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const D_DIS = 813;        // kanat uçlarındaki yay çapı
const D_YARDIMCI = 772;   // R41,20 yaylarının merkezleri bu yardımcı daire üzerinde
const KENAR = 318.5;      // çapraz düz kenarların merkeze uzaklığı
const YARIM = 147.5;      // R41,20 merkezinin eksene uzaklığı (295 / 2)
const R_YAY = 41.2;       // kanat dibindeki iç bükey yay
const ACI = 20;           // kanat yan kenarlarının eksenle açısı (resimde tepe noktası 640,89)
const D_GOBEK = 200, D_DELIK = 143, KAMA_G = 38, KAMA_H = 13;
const LEVHA_T = 25;       // varsayım: levha kalınlığı
const GOBEK_L = 90;       // varsayım: göbeğin levhadan çıkıntısı

const R = D_DIS / 2, Rc = D_YARDIMCI / 2, rad = Math.PI / 180;
const r4 = v => Math.round(v * 1e4) / 1e4;

// Üst kanat (+y ekseni) için sol yarının noktaları; sağ yarı x aynasıdır.
// R41,20 yayının merkezi: Ø772 üzerinde, eksenden 147,5 uzakta
const A = { x: -YARIM, y: Math.sqrt(Rc * Rc - YARIM * YARIM) };
// Sol yan kenar: eksenle 20° yapan ve R41,20 yayına teğet doğru, n·p = c (n birim normal, kanat içine doğru)
const n = { x: Math.cos(ACI * rad), y: -Math.sin(ACI * rad) };
const dA = R_YAY, c = n.x * A.x + n.y * A.y + dA;
const TEPE = -c / Math.sin(ACI * rad);                // doğrunun ekseni kestiği nokta (resimde 640,89)
const Tn = { x: A.x + n.x * dA, y: A.y + n.y * dA };  // teğet noktası
// Yan kenarın Ø813 ile kesişimi (kanat ucu köşesi): x = -(TEPE - y)·tan20
const ta = Math.tan(ACI * rad);
const A2 = 1 + ta * ta, B2 = -2 * TEPE * ta * ta, C2 = TEPE * TEPE * ta * ta - R * R;
const yP = (-B2 + Math.sqrt(B2 * B2 - 4 * A2 * C2)) / (2 * A2);
const P = { x: -(TEPE - yP) * ta, y: yP };
// Çapraz kenar (sol üst): -x + y = KENAR·√2; yay ile uzak kesişim noktası
const m = { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, w = KENAR;
const hA = m.x * A.x + m.y * A.y - w;                  // A'nın kenar doğrusuna uzaklığı
const F = { x: A.x - m.x * hA, y: A.y - m.y * hA };
const half = Math.sqrt(dA * dA - hA * hA), t = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const Q = { x: F.x - t.x * half, y: F.y - t.y * half };

const pts = {}, ents = [], cons = [];
let ei = 0, ci = 0;
const rot = (p, k) => { const a = k * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a); return { x: r4(p.x * cs - p.y * sn), y: r4(p.x * sn + p.y * cs) } };
const L = (a, b, yapi) => { const id = 'e' + (++ei); ents.push({ id, t: 'line', a, b, cons: !!yapi }); return id };
const Arc = (cId, a, b) => { const id = 'e' + (++ei); ents.push({ id, t: 'arc', c: cId, a, b, cons: false }); return id };
const C = c => { c.id = 'c' + (++ci); cons.push(c); return c };
const kenar = {}, yay = {};
// Kanat k: üst kanadın k·90° döndürülmüşü (0 üst, 1 sol, 2 alt, 3 sağ); "r" üst kanatta x>0 tarafı
for (let k = 0; k < 4; k++) {
  const mir = p => ({ x: -p.x, y: p.y });
  const set = (name, p) => { pts[name + k] = rot(p, k); return name + k };
  const pr = set('pr', mir(P)), pl = set('pl', P);
  const tr = set('tr', mir(Tn)), tl = set('tl', Tn);
  const qr = set('qr', mir(Q)), ql = set('ql', Q);
  const ar = set('ar', mir(A)), al = set('al', A);
  Arc(ar, tr, qr);                            // sağ R41,20 (iç bükey)
  L(tr, pr);                                  // sağ yan kenar
  Arc('O', pr, pl);                           // Ø813 uç yayı
  kenar['l' + k] = L(pl, tl);                 // sol yan kenar
  yay['l' + k] = Arc(al, ql, tl);             // sol R41,20
  kenar['d' + k] = L(ql, 'qr' + ((k + 1) % 4)); // sonraki kanada uzanan çapraz kenar
}
// Yapı geometrisi: Ø813 ve Ø772 daireleri, dikey / yatay / 45° eksenler
const c813 = 'e' + (++ei); ents.push({ id: c813, t: 'circle', c: 'O', r: R, cons: true });
const c772 = 'e' + (++ei); ents.push({ id: c772, t: 'circle', c: 'O', r: Rc, cons: true });
pts.pv = { x: 0, y: R }; pts.ph = { x: R, y: 0 }; pts.pd = { x: r4(R * Math.SQRT1_2), y: r4(R * Math.SQRT1_2) };
const Lv = L('O', 'pv', 1), Lh = L('O', 'ph', 1), Ld = L('O', 'pd', 1);
C({ t: 'v', e: Lv }); C({ t: 'poc', p: 'pv', e: c813 });
C({ t: 'h', e: Lh }); C({ t: 'poc', p: 'ph', e: c813 });
C({ t: 'poc', p: 'pd', e: c813 }); C({ t: 'sym', p: 'ph', q: 'pv', e: Ld }); // 45° eksen
// Dört katlı simetri: sol üst yarım kanat temel alınır, diğer yedisi aynalanır
const ayna = [['r0', 'l0', Lv], ['l3', 'r0', Ld], ['r3', 'l3', Lh], ['r2', 'l0', Lh], ['l2', 'r0', Lh], ['r1', 'l3', Lv], ['l1', 'r3', Lv]];
for (const [hedef, kaynak, eksen] of ayna)
  for (const tip of ['p', 't', 'q', 'a'])
    C({ t: 'sym', p: tip + kaynak[0] + kaynak[1], q: tip + hedef[0] + hedef[1], e: eksen });
// Resimdeki ölçüler (temel yarım kanat üzerinde)
C({ t: 'ddia', e: c813, val: D_DIS, lp: [r4(-(R + 70) * Math.cos(rad * 20)), r4(-(R + 70) * Math.sin(rad * 20))] });
C({ t: 'ddia', e: c772, val: D_YARDIMCI, lp: [r4((Rc + 60) * Math.cos(rad * 15)), r4(-(Rc + 60) * Math.sin(rad * 15))] });
C({ t: 'poc', p: 'pl0', e: c813 });
C({ t: 'poc', p: 'al0', e: c772 });
C({ t: 'dh', p: 'O', q: 'al0', val: YARIM, lp: [-YARIM / 2, r4(A.y + 70)] });
C({ t: 'drad', e: yay.l0, val: R_YAY, lp: [r4(A.x + (R_YAY + 45) * Math.SQRT1_2), r4(A.y - (R_YAY + 45) * Math.SQRT1_2)] });
C({ t: 'tan', e1: kenar.l0, e2: yay.l0 });
{ const d = { x: Tn.x - P.x, y: Tn.y - P.y }, l = Math.hypot(d.x, d.y), b = { x: d.x / l, y: d.y / l - 1 }, bl = Math.hypot(b.x, b.y);
  C({ t: 'dang', e1: kenar.l0, e2: Lv, r1: false, r2: d.y < 0, val: ACI, lp: [r4(b.x / bl * 250), r4(TEPE + b.y / bl * 250)] }); }
C({ t: 'dpl', p: 'O', e: kenar.d0, val: KENAR, lp: [r4(-KENAR * Math.SQRT1_2 / 2 + 30), r4(KENAR * Math.SQRT1_2 / 2 + 30)] });

const ky = Math.sqrt((D_DELIK / 2) ** 2 - (KAMA_G / 2) ** 2), kt = D_DELIK / 2 + KAMA_H;
const front = { kind: 'std', key: 'front' };
const features = [
  { id: 's1', type: 'sketch', name: 'Çizim1 (dış kontur)', on: front, pts, ents, cons },
  { id: 'x1', type: 'extrude', name: 'Ekstrüzyon-Levha', op: 'add', sketch: 's1', end: 'blind', depth: LEVHA_T, flip: false, dir2: false, end2: 'blind', depth2: 10 },
  { id: 's2', type: 'sketch', name: 'Çizim2 (göbek Ø200)', on: front, pts: {},
    ents: [{ id: 'e1', t: 'circle', c: 'O', r: D_GOBEK / 2, cons: false }],
    cons: [{ id: 'c1', t: 'ddia', e: 'e1', val: D_GOBEK, lp: [D_GOBEK * 0.6, D_GOBEK * 0.6] }] },
  { id: 'x2', type: 'extrude', name: 'Ekstrüzyon-Göbek', op: 'add', sketch: 's2', end: 'blind', depth: LEVHA_T + GOBEK_L, flip: false, dir2: false, end2: 'blind', depth2: 10 },
  { id: 's3', type: 'sketch', name: 'Çizim3 (Ø143 delik + kama)', on: front,
    pts: { k1: { x: KAMA_G / 2, y: r4(ky) }, k2: { x: KAMA_G / 2, y: kt }, k3: { x: -KAMA_G / 2, y: kt }, k4: { x: -KAMA_G / 2, y: r4(ky) },
      km: { x: 0, y: kt }, kb: { x: 0, y: D_DELIK / 2 } },
    ents: [{ id: 'e1', t: 'arc', c: 'O', a: 'k4', b: 'k1', cons: false },
      { id: 'e2', t: 'line', a: 'k1', b: 'k2', cons: false }, { id: 'e3', t: 'line', a: 'k2', b: 'k3', cons: false }, { id: 'e4', t: 'line', a: 'k3', b: 'k4', cons: false },
      { id: 'e5', t: 'line', a: 'kb', b: 'km', cons: true }],
    cons: [{ id: 'c1', t: 'v', e: 'e2' }, { id: 'c2', t: 'h', e: 'e3' }, { id: 'c3', t: 'v', e: 'e4' },
      { id: 'c4', t: 'mid', p: 'km', e: 'e3' }, { id: 'c5', t: 'v', p: 'O', q: 'km' }, { id: 'c6', t: 'v', e: 'e5' }, { id: 'c7', t: 'poc', p: 'kb', e: 'e1' },
      { id: 'c8', t: 'd', p: 'k2', q: 'k3', val: KAMA_G, lp: [0, kt + 25] },
      { id: 'c9', t: 'ddia', e: 'e1', val: D_DELIK, lp: [-110, -110] },
      { id: 'c10', t: 'dv', p: 'kb', q: 'k2', val: KAMA_H, lp: [-45, D_DELIK / 2 + KAMA_H / 2] }] },
  { id: 'x3', type: 'extrude', name: 'Kesme-Delik ve kama', op: 'cut', sketch: 's3', end: 'through', depth: 10, flip: false, dir2: true, end2: 'through', depth2: 10 },
];

const project = {
  app: 'tocad', version: 3,
  parts: [{ id: 'P1', partName: 'Dört kanatlı disk Ø813', material: 'steel', features,
    drawing: { paper: 'A3', orient: 'landscape', method: 'E', scale: 'auto', hidden: true, centers: true, autodims: true, iso: true, dno: 'TZ-0001', drawn: '', checked: '', company: '', dims: [] } }],
  asms: [], cur: { part: 'P1' },
};
const out = fileURLToPath(new URL('./dort-kanatli-disk.tocad.json', import.meta.url));
writeFileSync(out, JSON.stringify(project, null, 1) + '\n');
console.log('Yazıldı:', out);
console.log('Tepe', TEPE.toFixed(2), '\nKanat ucu köşesi', P, '\nR merkezi', A, '\nTeğet noktası', Tn, '\nKenar kesişimi', Q, '\nA-kenar uzaklığı', hA.toFixed(3));
