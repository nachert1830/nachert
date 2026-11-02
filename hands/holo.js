import { createMonge } from './monge.js';
/* Голограмма детали: свой WebGL-рендерер (WebGL 1, как просмотрщик сайта).
   Камера — та же, что у IG3.viewer: ортографическая, yaw/pit/zoom, сдвиг tx/ty по осям экрана, — поэтому вид
   совпадает с сайтом. Отличия — стиль и «разбор»: каждая часть детали рисуется со своим смещением.

   Слои снизу вверх:
     фон → сетка-пол (деталь «парит» над ним) → горизонтальная проекция детали на пол (П₁) →
     тела (свечение по контуру) → рёбра и очерк (свечение + яркая середина) → невидимые линии (штрихом, как на чертеже) →
     «пробки» — вынутый материал (янтарь, полупрозрачно).
   Режим 'draft' — светлый «чертёжный»: серая заливка и чёрные линии, как на сайте. */

const CY = [0.21, 0.88, 1.0];          /* #35e0ff */
const AMBER = [1.0, 0.71, 0.28];

/* ── раскладка «разбора»: смещение каждой части, e ∈ [0, 1] ──
   1-я фаза: фланец вниз, конус вверх; 2-я: пробки выходят из отверстий по своей оси —
   пирамида (расширяется кверху) — вверх из конуса и в сторону, отверстия фланца — вниз. */
const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function layout(e) {
  const u1 = sm(e / 0.5), u2 = sm((e - 0.3) / 0.7), up = sm(u2 / 0.55), side = sm((u2 - 0.45) / 0.55);
  const gap = 40 * u1;
  return {
    flange: [0, 0, -gap],
    cone: [0, 0, gap],
    pyr: [105 * side, 0, gap + 175 * up - 135 * side],          /* поднять выше конуса, увести вбок, опустить рядом */
    hole: [0, 0, -gap - 48 * u2],
    plugA: sm((e - 0.04) / 0.12)                                   /* пробки проявляются, когда тела уже разошлись */
  };
}
export const offsetOf = (L, id) => (id.startsWith('hole') ? L.hole : L[id]);

/* ── раскодировка данных из v5.js ── */
function b64(s, T) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); }
function decode(D) {
  const q = 1 / D.q, F = a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * q; return o; };
  const N = a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / 127; return o; };
  const one = p => {
    const pos = F(b64(p.pos, Int16Array)), nrm = N(b64(p.nrm, Int8Array)), lines = F(b64(p.lines, Int16Array));
    const bb = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { bb[0][k] = Math.min(bb[0][k], pos[i + k]); bb[1][k] = Math.max(bb[1][k], pos[i + k]); }
    return Object.assign({}, p, { pos, nrm, lines, bb });
  };
  return { box: D.box, whole: one(D.whole), parts: D.parts.map(one) };
}

/* отрезки → квадрики для толстых линий: на вершину A, B, параметр (t, сторона), длина дуги s (для штриха) */
function lineBuf(L) {
  const n = L.length / 6, a = new Float32Array(n * 6 * 9); let o = 0, s = 0, px = NaN, py = NaN, pz = NaN;
  const T = [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]];
  for (let i = 0; i < n; i++) {
    const A = [L[6 * i], L[6 * i + 1], L[6 * i + 2]], B = [L[6 * i + 3], L[6 * i + 4], L[6 * i + 5]];
    if (Math.hypot(A[0] - px, A[1] - py, A[2] - pz) > 1e-3 || isNaN(px)) s = 0;           /* новая цепочка — штрих с начала */
    const s1 = s + Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    for (const t of T) { a.set(A, o); a.set(B, o + 3); a[o + 6] = t[0]; a[o + 7] = t[1]; a[o + 8] = t[0] ? s1 : s; o += 9; }
    s = s1; [px, py, pz] = B;
  }
  return a;
}

const GL = {
  bgV: 'attribute vec2 a;varying vec2 vU;void main(){vU=a;gl_Position=vec4(a,0.,1.);}',
  bgF: `precision mediump float;varying vec2 vU;uniform vec2 uRes;uniform float uDraft;
void main(){ vec2 p=vU*vec2(uRes.x/uRes.y,1.); float r=length(p*vec2(.8,1.)-vec2(0.,.15));
  vec3 holo=mix(vec3(.075,.13,.22),vec3(.012,.02,.04),smoothstep(.0,1.5,r));
  vec3 draft=mix(vec3(1.),vec3(.90,.915,.935),smoothstep(.0,1.6,r));
  gl_FragColor=vec4(mix(holo,draft,uDraft),1.); }`,
  meshV: 'attribute vec3 aP,aN;uniform mat4 uM;uniform vec3 uO;varying vec3 vP,vN;void main(){vec3 p=aP+uO;vP=p;vN=aN;gl_Position=uM*vec4(p,1.);}',
  meshF: `precision highp float;varying vec3 vP,vN;uniform vec3 uF,uCol,uHU;uniform float uT,uA,uScan,uDraft,uPlug,uFl,uAnim,uClipOn,uHi;uniform vec4 uClip;
void main(){ if(uClipOn>.5&&dot(uClip.xyz,vP)>uClip.w) discard;
  /* при разрезе изнанку граней не рисуем: срез закрывает плоская «крышка» со штриховкой (по стенсилу, см. draw) */
  if(uClipOn>.5&&!gl_FrontFacing&&uPlug<.5) discard;
  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
  float ndv=abs(dot(n,uF)), fr=pow(1.-ndv,2.2);
  vec3 L1=normalize(vec3(-.5,-.75,.9)), L2=normalize(vec3(.85,.25,.35)); float d1=max(dot(n,L1),0.), d2=max(dot(n,L2),0.), hemi=.5+.5*n.z;
  if(uDraft>.5){
    vec3 base=vec3(.74,.75,.77), hv=normalize(L1+uF*-1.); float sp=pow(max(dot(n,hv),0.),48.)*.3;
    vec3 c=base*(.30+.30*hemi+d1*.58+d2*.18)+sp; if(!gl_FrontFacing) c*=.55; c=mix(c,vec3(.45,.78,1.),.35*uHi);
    if(uPlug>.5) { gl_FragColor=vec4(vec3(.95,.62,.25)*(.25+.6*fr)*uA,uA*.5); return; }
    gl_FragColor=vec4(c,1.); return; }
  float scan=1.; if(uAnim>.5) scan=.95+.05*sin(gl_FragCoord.y*1.7-uT*.004);
  float band=exp(-pow((vP.z-uScan)/5.,2.));
  if(uPlug>.5){ vec3 c=uCol*(.06+.28*d1+.85*fr)+uCol*band*.6; gl_FragColor=vec4(c*scan*uFl*uA,1.); return; }
  /* тело: тёмное стекло, форма читается по свету, контур — по свечению Френеля */
  vec3 c=uCol*(.07+.20*d1+.07*d2+.08*hemi)*(1.+1.6*uHi)+uCol*fr*(.85+.9*uHi)+vec3(.75,.97,1.)*band*.55;
  if(!gl_FrontFacing) c*=.5;
  gl_FragColor=vec4(c*scan*uFl,1.); }`,
  lineV: `attribute vec3 aA,aB;attribute vec3 aT;uniform mat4 uM;uniform vec2 uRes;uniform float uW,uFlat;uniform vec3 uO;varying float vY,vS;varying vec3 vP;
void main(){ vec3 A=aA+uO, B=aB+uO; if(uFlat>-1e8){A.z=uFlat;B.z=uFlat;}
  vec4 a=uM*vec4(A,1.), b=uM*vec4(B,1.); vec2 d=(b.xy-a.xy)*uRes; float l=length(d); vec2 dir=l>1e-6?d/l:vec2(1.,0.), nr=vec2(-dir.y,dir.x);
  vec4 p=mix(a,b,aT.x); p.xy+=(nr*aT.y+dir*(aT.x*2.-1.))*uW/uRes; p.z-=.0015; vY=aT.y; vS=aT.z; vP=mix(A,B,aT.x); gl_Position=p; }`,
  lineF: `precision highp float;varying float vY,vS;varying vec3 vP;uniform vec3 uCol;uniform float uA,uGlow,uDash,uScan,uClipOn;uniform vec4 uClip;
void main(){ if(uClipOn>.5&&dot(uClip.xyz,vP)>uClip.w) discard; float d=abs(vY); float a=uGlow>.5?exp(-d*d*3.2)*.55:1.-smoothstep(.55,1.,d);
  if(uDash>0.&&fract(vS/uDash)>.58) discard;
  float band=exp(-pow((vP.z-uScan)/5.,2.));
  gl_FragColor=vec4(uCol*(1.+band*.8),a*uA); }`,
  /* секущая плоскость: полупрозрачный лист с яркой кромкой и сеткой 10 мм */
  planeV: 'attribute vec3 a;attribute vec2 b;uniform mat4 uM;varying vec2 vU;varying vec3 vW;void main(){vU=b;vW=a;gl_Position=uM*vec4(a,1.);}',
  planeF: `precision highp float;varying vec2 vU;varying vec3 vW;uniform vec3 uCol,uHU;uniform vec2 uSz;uniform float uT,uAnim,uDraft,uCap,uFl;
void main(){
  /* крышка среза: штриховка 45°, шаг 3 мм — как сечение на чертеже */
  if(uCap>.5){ float h=fract(dot(vW,uHU)/3.), ln=smoothstep(.36,.44,h)*(1.-smoothstep(.56,.64,h));
    gl_FragColor=uDraft>.5?vec4(mix(vec3(.97),vec3(.12,.13,.15),ln),1.):vec4(mix(uCol*.30,vec3(.8,.98,1.),ln*.9)*uFl,1.); return; } vec2 q=abs(vU), px=uSz*(1.-q); float edge=1.-smoothstep(0.,2.5,min(px.x,px.y));
  vec2 g=abs(fract(vU*uSz/20.+.5)-.5)*20.; float grid=1.-smoothstep(.2,.9,min(g.x,g.y));
  float sweep=uAnim>.5?exp(-pow(fract(uT*.0004)*2.-1.-vU.y,2.)*40.)*.25:0.;
  gl_FragColor=vec4(uCol,(.05+grid*.10+edge*.85+sweep)*(uDraft>.5?.8:1.)); }`,
  gridV: 'attribute vec2 a;uniform mat4 uM;uniform float uZ;varying vec2 vP;void main(){vP=a;gl_Position=uM*vec4(a,uZ,1.);}',
  gridF: `precision highp float;varying vec2 vP;uniform float uPx,uT,uAnim,uDraft,uFade;uniform vec3 uCol;
float ln(float v,float s,float w){ float d=abs(fract(v/s+.5)-.5)*s; return 1.-smoothstep(w*.5,w*1.5,d); }
void main(){ float r=length(vP), fade=1.-smoothstep(120.,260.,r);
  float w=max(uPx,.2), g=max(ln(vP.x,10.,w),ln(vP.y,10.,w))*.35+max(ln(vP.x,50.,w*1.6),ln(vP.y,50.,w*1.6))*.65;
  float ring=exp(-pow((r-72.)/1.6,2.))*(uAnim>.5?.75+.25*sin(uT*.002):.85)+exp(-pow((r-78.)/.9,2.))*.35;
  float a=(g*.32+ring*.6)*fade*uFade; if(uDraft>.5) a*=.55;
  gl_FragColor=vec4(uCol,a); }`
};

export function createHolo(canvas, data, opt = {}) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, stencil: true, premultipliedAlpha: false, preserveDrawingBuffer: !!opt.keep });
  if (!gl) return null;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (v, f) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, v)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, f)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = gl.getUniformLocation(p, k))) }); return { p, U }; };
  const buf = (d, usage) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, usage || gl.STATIC_DRAW); return b; };
  const PB = prog(GL.bgV, GL.bgF), PM = prog(GL.meshV, GL.meshF), PL = prog(GL.lineV, GL.lineF), PG = prog(GL.gridV, GL.gridF), PP = prog(GL.planeV, GL.planeF);
  const planeB = gl.createBuffer();
  const bgB = buf(new Float32Array([-1, -1, 3, -1, -1, 3]));
  const G = 600, gridB = buf(new Float32Array([-G, -G, G, -G, G, G, -G, -G, G, G, -G, G]));
  const attr = (p, name, b, size, stride, off) => { const l = gl.getAttribLocation(p, name); if (l < 0) return -1; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride || 0, off || 0); return l; };
  const offA = ls => ls.forEach(l => { if (l >= 0) gl.disableVertexAttribArray(l); });

  const M = decode(data);
  let MG = null;                                                 /* «угол Монжа» — считается при первом включении (~0,1 с) */
  const monge = () => MG || (MG = createMonge(M.whole.pos, M.whole.lines, M.parts.filter(p => p.role === 'body').flatMap(p => p.surf), M.box));
  const mgCache = new Map();
  const up = p => Object.assign(p, { mB: buf(p.pos), nB: buf(p.nrm), lB: buf(lineBuf(p.lines)), lN: p.lines.length / 6 * 6 });   /* 6 вершин на отрезок */
  up(M.whole); M.parts.forEach(up);
  const silB = gl.createBuffer();
  const b = M.box, C0 = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2];
  const R0 = Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2]) / 2;
  const FLOOR = b[0][2] - 95;                                   /* пол ниже самой низкой точки разобранной детали */
  let scan = { t0: -1e9, z0: 0, z1: 0 }, mode = opt.mode || 'holo', last = null;
  let scale = 1;                                                 /* доля разрешения: снижается, если кадры не успевают */

  /* ── камера: как в IG3.viewer, плюс «рамка» по разобранной детали, чтобы всё помещалось ── */
  function camera(view, w, h, extra) {
    const L = layout(view.explode || 0);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    M.parts.forEach(p => { const o = offsetOf(L, p.id); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.bb[0][k] + o[k]); hi[k] = Math.max(hi[k], p.bb[1][k] + o[k]); } });
    if (extra) for (let k = 0; k < 3; k++) { lo[k] = lo[k] + (Math.min(lo[k], extra.lo[k]) - lo[k]) * extra.a; hi[k] = hi[k] + (Math.max(hi[k], extra.hi[k]) - hi[k]) * extra.a; }
    const C = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], R = Math.max(R0, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 * 0.92);
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pit), sp = Math.sin(view.pit);
    const F = [sy * cp, cy * cp, -sp], Rv = norm(cross(F, [0, 0, 1])), Up = cross(Rv, F);
    const tx = (view.panX || 0) * R0 * 2.25, ty = (view.panY || 0) * R0 * 2.25;
    const Cc = [C[0] + tx * Rv[0] + ty * Up[0], C[1] + tx * Rv[1] + ty * Up[1], C[2] + tx * Rv[2] + ty * Up[2]];
    const us = R * 2.25 / view.zoom * Math.max(1, h / w), sx = 2 * h / (us * w), syy = 2 / us, D = Math.max(R * 3, 420);
    const row = (v, s) => [v[0] * s, v[1] * s, v[2] * s, -(v[0] * Cc[0] + v[1] * Cc[1] + v[2] * Cc[2]) * s];
    const r0 = row(Rv, sx), r1 = row(Up, syy), r2 = row(F, 1 / D);
    const MM = new Float32Array([r0[0], r1[0], r2[0], 0, r0[1], r1[1], r2[1], 0, r0[2], r1[2], r2[2], 0, r0[3], r1[3], r2[3], 1]);
    return { MM, F, L, us, w, h, lo, hi, Cc, Rv, Up };
  }

  /* очерк тел вращения (оси вдоль z) — аналитически, каждый кадр: образующие, где нормаль ⟂ взгляду */
  function silhouettes(F) {
    const out = [];
    M.parts.forEach(p => p.surf.forEach(([cx, cy, r0, r1, z0, z1]) => {
      const A = Math.hypot(F[0], F[1]); if (A < 1e-4) return;
      const k = (r0 - r1) / (z1 - z0), c = -k * F[2] / A; if (Math.abs(c) > 1) return;
      const al = Math.atan2(F[1], F[0]), ac = Math.acos(c);
      for (const ph of [al + ac, al - ac]) { const co = Math.cos(ph), si = Math.sin(ph); out.push({ id: p.id, a: [cx + r0 * co, cy + r0 * si, z0], b: [cx + r1 * co, cy + r1 * si, z1] }); }
    }));
    return out;
  }

  function draw(view, t, o = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale, w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const mg = o.monge && o.monge.a > 0.001 ? o.monge : null, MGd = mg ? monge() : null;
    const cam = camera(view, w, h, mg ? Object.assign({ a: mg.a }, MGd.bounds(mg.u)) : null), { MM, F, L } = cam, draft = mode === 'draft' ? 1 : 0, anim = o.reduced ? 0 : 1;
    const e = view.explode || 0, exploded = e > 0.002, px = cam.us / h;
    const flick = anim && !draft ? 0.97 + 0.03 * Math.sin(t * 0.013) * Math.sin(t * 0.0071) - (Math.sin(t * 0.0009) > 0.995 ? 0.12 : 0) : 1;
    const su = (t - scan.t0) / 1400, scanZ = !anim || su < 0 || su > 1 ? -1e5 : scan.z0 + (scan.z1 - scan.z0) * su;
    last = cam;

    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true); gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(PB.p); gl.uniform2f(PB.U.uRes, w, h); gl.uniform1f(PB.U.uDraft, draft); { const l = attr(PB.p, 'a', bgB, 2); gl.drawArrays(gl.TRIANGLES, 0, 3); offA([l]); }

    /* пол и проекция на него */
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(PG.p); gl.uniformMatrix4fv(PG.U.uM, false, MM); gl.uniform1f(PG.U.uZ, FLOOR); gl.uniform1f(PG.U.uPx, px); gl.uniform1f(PG.U.uT, t); gl.uniform1f(PG.U.uAnim, anim); gl.uniform1f(PG.U.uFade, mg ? 1 - mg.a : 1); gl.uniform1f(PG.U.uDraft, draft);
    gl.uniform3fv(PG.U.uCol, draft ? [0.35, 0.42, 0.5] : CY); { const l = attr(PG.p, 'a', gridB, 2); gl.drawArrays(gl.TRIANGLES, 0, 6); offA([l]); }

    /* секущая плоскость (o.clip = {n:[3], w}): убираем dot(n, p) > w; штриховка — по диагонали в плоскости */
    const clip = o.clip, clipOn = clip ? 1 : 0, cv4 = clip ? [clip.n[0], clip.n[1], clip.n[2], clip.w] : [0, 0, 1, 1e9];
    let HU = [0.7071, 0, 0.7071];
    if (clip) { const n = clip.n, a = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], U = norm(cross(n, a)), V = cross(n, U); HU = norm([U[0] + V[0], U[1] + V[1], U[2] + V[2]]); }
    gl.useProgram(PL.p); gl.uniformMatrix4fv(PL.U.uM, false, MM); gl.uniform2fv(PL.U.uRes, [w, h]); gl.uniform1f(PL.U.uScan, scanZ); gl.uniform4fv(PL.U.uClip, cv4);
    const hov = o.hover || null;
    const lines = (B, n, o3, wd, col, a, glow, dash, flat) => { if (!n) return; gl.useProgram(PL.p); gl.uniform1f(PL.U.uClipOn, flat == null ? clipOn : 0);
      gl.uniform3fv(PL.U.uO, o3); gl.uniform1f(PL.U.uW, wd * dpr); gl.uniform3fv(PL.U.uCol, col); gl.uniform1f(PL.U.uA, a); gl.uniform1f(PL.U.uGlow, glow); gl.uniform1f(PL.U.uDash, dash || 0); gl.uniform1f(PL.U.uFlat, flat == null ? -1e9 : flat);
      const st = 36, x = attr(PL.p, 'aA', B, 3, st, 0), y = attr(PL.p, 'aB', B, 3, st, 12), z = attr(PL.p, 'aT', B, 3, st, 24); gl.drawArrays(gl.TRIANGLES, 0, n); offA([x, y, z]); };
    /* целиком — одной сеткой; разобрана или наведена указка — по частям (чтобы подсветить одну) */
    const hideModel = !!(mg && mg.u > 0.3);                   /* эпюр разворачивается — деталь уходит */
    const bodies = hideModel ? [] : exploded || hov ? M.parts.filter(p => p.role === 'body') : [M.whole], plugs = hideModel ? [] : M.parts.filter(p => p.role === 'plug');
    const O = p => (p === M.whole ? [0, 0, 0] : offsetOf(L, p.id));
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    const floorA = mg ? 1 - mg.a : 1;
    if (floorA > 0.01) {
      bodies.forEach(p => lines(p.lB, p.lN, O(p), 1.1, draft ? [0.3, 0.36, 0.44] : CY, (draft ? 0.35 : 0.26) * floorA, 0, 0, FLOOR + 0.2));
      if (L.plugA > 0.01) plugs.forEach(p => lines(p.lB, p.lN, O(p), 1.0, AMBER, 0.2 * L.plugA * floorA, 0, 0, FLOOR + 0.2));
    }

    /* тела */
    gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.useProgram(PM.p); gl.uniformMatrix4fv(PM.U.uM, false, MM); gl.uniform3fv(PM.U.uF, F); gl.uniform1f(PM.U.uT, t); gl.uniform1f(PM.U.uScan, scanZ);
    gl.uniform1f(PM.U.uDraft, draft); gl.uniform1f(PM.U.uFl, flick); gl.uniform1f(PM.U.uAnim, anim);
    gl.uniform1f(PM.U.uClipOn, clipOn); gl.uniform4fv(PM.U.uClip, cv4); gl.uniform3fv(PM.U.uHU, HU);
    const isHov = p => !!hov && (p.id === hov || (hov === 'holes' && p.id.startsWith('hole')));
    const mesh = (p, col, a, plug) => { gl.useProgram(PM.p); gl.uniform3fv(PM.U.uO, O(p)); gl.uniform3fv(PM.U.uCol, col); gl.uniform1f(PM.U.uA, a); gl.uniform1f(PM.U.uPlug, plug); gl.uniform1f(PM.U.uHi, isHov(p) ? 1 : 0);
      const x = attr(PM.p, 'aP', p.mB, 3), y = attr(PM.p, 'aN', p.nB, 3); gl.drawArrays(gl.TRIANGLES, 0, p.count); offA([x, y]); };
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 2);
    bodies.forEach(p => mesh(p, CY, 1, 0));
    gl.disable(gl.POLYGON_OFFSET_FILL);

    /* очерк — в общий буфер: по частям, со своим смещением */
    const sil = hideModel ? [] : silhouettes(F), silBy = {};
    sil.forEach(s => { const k = exploded ? s.id : 'whole'; (silBy[k] = silBy[k] || []).push(s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2]); });
    const silDraw = (wd, col, a, glow, dash) => Object.keys(silBy).forEach(k => {
      const arr = lineBuf(silBy[k]); gl.bindBuffer(gl.ARRAY_BUFFER, silB); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      const p = k === 'whole' ? M.whole : M.parts.find(q => q.id === k);
      if (k !== 'whole' && p.role === 'plug' && L.plugA < 0.01) return;
      lines(silB, arr.length / 9, O(p), wd, p.role === 'plug' ? AMBER : col, a * (p.role === 'plug' ? L.plugA : 1), glow, dash); });

    /* видимые линии: свечение + середина */
    gl.enable(gl.BLEND); gl.depthMask(false);
    const lineCol = draft ? [0.08, 0.09, 0.11] : [0.80, 0.97, 1.0];
    if (!draft) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); bodies.forEach(p => lines(p.lB, p.lN, O(p), isHov(p) ? 11 : 6, CY, (isHov(p) ? 1 : 0.55) * flick, 1)); silDraw(6, CY, 0.55 * flick, 1); }
    else if (hov) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); bodies.filter(isHov).forEach(p => lines(p.lB, p.lN, O(p), 5, [0.2, 0.55, 0.9], 0.45, 1)); }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    bodies.forEach(p => lines(p.lB, p.lN, O(p), draft ? 1.25 : 1.35, lineCol, 1, 0)); silDraw(draft ? 1.25 : 1.35, lineCol, 1, 0);
    /* невидимые — штрихом (шаг 4 мм), бледно */
    gl.depthFunc(gl.GREATER);
    bodies.forEach(p => lines(p.lB, p.lN, O(p), 1, draft ? [0.25, 0.27, 0.3] : CY, draft ? 0.55 : 0.32, 0, 4)); silDraw(1, draft ? [0.25, 0.27, 0.3] : CY, draft ? 0.55 : 0.32, 0, 4);
    gl.depthFunc(gl.LEQUAL);

    /* лист секущей плоскости — по рамке детали (с учётом разбора) */
    if (clip) {
      const n = clip.n, ax = Math.abs(n[0]) > 0.9 ? 0 : Math.abs(n[1]) > 0.9 ? 1 : 2, [i, j] = [[1, 2], [0, 2], [0, 1]][ax], m = 12;
      const c = clip.w / n[ax], a0 = cam.lo[i] - m, a1 = cam.hi[i] + m, b0 = cam.lo[j] - m, b1 = cam.hi[j] + m;
      const P = (u, v) => { const q = [0, 0, 0]; q[ax] = c; q[i] = u; q[j] = v; return q; };
      const V = [[a0, b0, -1, -1], [a1, b0, 1, -1], [a1, b1, 1, 1], [a0, b0, -1, -1], [a1, b1, 1, 1], [a0, b1, -1, 1]].flatMap(([u, v, su, sv]) => [...P(u, v), su, sv]);
      gl.bindBuffer(gl.ARRAY_BUFFER, planeB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.DYNAMIC_DRAW);
      gl.useProgram(PP.p); gl.uniformMatrix4fv(PP.U.uM, false, MM); gl.uniform3fv(PP.U.uCol, draft ? [0.1, 0.45, 0.75] : CY);
      gl.uniform2f(PP.U.uSz, (a1 - a0) / 2, (b1 - b0) / 2); gl.uniform1f(PP.U.uT, t); gl.uniform1f(PP.U.uAnim, anim); gl.uniform1f(PP.U.uDraft, draft);
      gl.uniform3fv(PP.U.uHU, HU); gl.uniform1f(PP.U.uFl, flick);
      const quad = () => { const x = attr(PP.p, 'a', planeB, 3, 20, 0), y = attr(PP.p, 'b', planeB, 2, 20, 12); gl.drawArrays(gl.TRIANGLES, 0, 6); offA([x, y]); };
      /* крышка: где плоскость внутри материала, луч из камеры пересекает поверхность тела нечётное число раз
         (считаем чётность в стенсиле по всем граням, отрезанное — отброшено) — там рисуем штриховку с записью глубины */
      gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); gl.enable(gl.STENCIL_TEST);
      gl.colorMask(false, false, false, false); gl.depthMask(false); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.stencilFunc(gl.ALWAYS, 0, 1); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
      gl.useProgram(PM.p); gl.uniform1f(PM.U.uClipOn, 1); gl.uniform1f(PM.U.uPlug, 1);   /* uPlug: изнанку не отбрасывать */
      bodies.forEach(p => { gl.uniform3fv(PM.U.uO, O(p)); const x = attr(PM.p, 'aP', p.mB, 3), y = attr(PM.p, 'aN', p.nB, 3); gl.drawArrays(gl.TRIANGLES, 0, p.count); offA([x, y]); });
      gl.colorMask(true, true, true, true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.stencilFunc(gl.EQUAL, 1, 1); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      gl.useProgram(PP.p); gl.uniform1f(PP.U.uCap, 1); quad();
      gl.disable(gl.STENCIL_TEST); gl.depthMask(false);
      /* сам лист — полупрозрачно поверх */
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(PP.U.uCap, 0); quad();
    }

    /* угол Монжа: три плоскости проекций, на них — видимые линии сплошной, невидимые штрихом; развёртка в эпюр */
    if (mg) {
      const u = mg.u, key = u.toFixed(3), A = mg.a;
      gl.useProgram(PP.p); gl.uniformMatrix4fv(PP.U.uM, false, MM); gl.uniform1f(PP.U.uCap, 0); gl.uniform1f(PP.U.uT, t); gl.uniform1f(PP.U.uAnim, 0); gl.uniform1f(PP.U.uDraft, draft);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      ['p1', 'p2', 'p3'].forEach(k => {
        const fr = MGd.frame(k, u), [a, b, c, d] = fr, sz = [Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2, Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / 2];
        const V = [[a, -1, -1], [b, 1, -1], [c, 1, 1], [a, -1, -1], [c, 1, 1], [d, -1, 1]].flatMap(([q, su, sv]) => [...q, su, sv]);
        gl.bindBuffer(gl.ARRAY_BUFFER, planeB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.DYNAMIC_DRAW);
        gl.useProgram(PP.p); gl.uniform3fv(PP.U.uCol, draft ? [0.25, 0.45, 0.65] : CY); gl.uniform2f(PP.U.uSz, sz[0], sz[1]);
        const x = attr(PP.p, 'a', planeB, 3, 20, 0), y = attr(PP.p, 'b', planeB, 2, 20, 12); gl.drawArrays(gl.TRIANGLES, 0, 6); offA([x, y]);
      });
      const get = (k, which) => { const id = k + which + key; let e = mgCache.get(id);
        if (!e) { if (mgCache.size > 24) { for (const [kk, vv] of mgCache) { gl.deleteBuffer(vv.b); mgCache.delete(kk); if (mgCache.size < 12) break; } }
          const P = MGd.segs(k, which, u), f = new Float32Array(P.length * 3); P.forEach((q, i) => { f[3 * i] = q[0]; f[3 * i + 1] = q[1]; f[3 * i + 2] = q[2]; });
          const arr = lineBuf(f); e = { b: buf(arr), n: arr.length / 9 }; mgCache.set(id, e); }
        return e; };
      const col = draft ? [0.08, 0.09, 0.11] : [0.80, 0.97, 1.0];
      gl.depthFunc(gl.LEQUAL);
      ['p1', 'p2', 'p3'].forEach(k => {
        const v = get(k, 'vis'), h = get(k, 'inv');
        if (!draft) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); lines(v.b, v.n, [0, 0, 0], 5, CY, 0.45 * A, 1); }
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        lines(v.b, v.n, [0, 0, 0], 1.5, col, A, 0); lines(h.b, h.n, [0, 0, 0], 1.3, draft ? [0.2, 0.22, 0.26] : [0.55, 0.9, 1.0], A, 0, 6);   /* штрих 6 мм: при мелком масштабе эпюра 3 мм сливались в точки */
      });
      gl.uniform1f(PL.U.uClipOn, clipOn);
    }

    /* пробки — вынутый материал: поверх (они совпадают со стенками отверстий), сложение цветов */
    if (L.plugA > 0.01) {
      if (draft) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(PM.p); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      plugs.forEach(p => mesh(p, AMBER, L.plugA * (draft ? 1 : 0.55), 1)); gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.useProgram(PL.p); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      plugs.forEach(p => lines(p.lB, p.lN, O(p), 1.2, draft ? [0.6, 0.35, 0.05] : [1, 0.85, 0.6], L.plugA, 0));
      gl.depthFunc(gl.GREATER); plugs.forEach(p => lines(p.lB, p.lN, O(p), 1, AMBER, 0.3 * L.plugA, 0, 4)); gl.depthFunc(gl.LEQUAL);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    return cam;
  }

  /* какая часть под точкой экрана (пиксели CSS): луч ортокамеры против треугольников частей (Мёллер — Трумбор).
     Отрезанное плоскостью и невидимые пробки не считаются. ~2,5 тыс. треугольников — доли миллисекунды */
  function pick(sx, sy, clip) {
    const c = last; if (!c) return null;
    const W = canvas.clientWidth, H = canvas.clientHeight, nx = sx / W * 2 - 1, ny = 1 - sy / H * 2;
    const a = nx * c.us * c.w / (2 * c.h), b = ny * c.us / 2, D = Math.max(c.us * 4, 1000);
    const O = [0, 1, 2].map(k => c.Cc[k] + c.Rv[k] * a + c.Up[k] * b - c.F[k] * D), d = c.F;
    let best = null, bt = Infinity;
    M.parts.forEach(p => {
      if (p.role === 'plug' && c.L.plugA < 0.3) return;
      const o = offsetOf(c.L, p.id), P = p.pos;
      for (let i = 0; i < P.length; i += 9) {
        const v0 = [P[i] + o[0], P[i + 1] + o[1], P[i + 2] + o[2]], e1 = [P[i + 3] + o[0] - v0[0], P[i + 4] + o[1] - v0[1], P[i + 5] + o[2] - v0[2]], e2 = [P[i + 6] + o[0] - v0[0], P[i + 7] + o[1] - v0[1], P[i + 8] + o[2] - v0[2]];
        const pv = cross(d, e2), det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]; if (Math.abs(det) < 1e-9) continue;
        const tv = [O[0] - v0[0], O[1] - v0[1], O[2] - v0[2]], u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) / det; if (u < 0 || u > 1) continue;
        const qv = cross(tv, e1), v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det; if (v < 0 || u + v > 1) continue;
        const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det; if (t <= 0 || t >= bt) continue;
        if (clip) { const hp = [O[0] + d[0] * t, O[1] + d[1] * t, O[2] + d[2] * t]; if (clip.n[0] * hp[0] + clip.n[1] * hp[1] + clip.n[2] * hp[2] > clip.w) continue; }
        bt = t; best = p.id;
      }
    });
    return best && best.startsWith('hole') ? 'holes' : best;
  }

  /* мировая точка → пиксели CSS (для подписей и курсоров HUD) */
  function project(p, cam = last) {
    if (!cam) return null; const m = cam.MM, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    return [(x * 0.5 + 0.5) * canvas.clientWidth, (0.5 - y * 0.5) * canvas.clientHeight];
  }

  return {
    gl, draw, project, pick, layout, parts: M.parts, floor: FLOOR, box: M.box,
    camera: () => last,
    mongeInfo: () => MG,
    pxPerMm: () => (last ? canvas.clientHeight / last.us : 1),
    setMode(m) { mode = m; }, get mode() { return mode; },
    setScale(k) { scale = Math.max(0.4, Math.min(1, k)); }, get scale() { return scale; },
    scan(t) { scan = { t0: t, z0: b[1][2] + 10, z1: b[0][2] - 10 }; }       /* луч сверху вниз — при загрузке и сбросе */
  };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
