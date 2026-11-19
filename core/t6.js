/* ═══════════ № 6 — точки, симметричные A относительно π₁ и относительно O ═══════════
   Пространство: B = (x, y, −z) — симметрия относительно π₁, C = (−x, −y, −z) — относительно начала O.
   Эпюр: B′ ≡ A′ (x и y те же); B″ — на линии связи, симметрично A″ относительно оси x (циркулем от Aₓ);
   C″ и C′ — симметрично A″ и A′ относительно точки O (циркулем от O по прямым A″O и A′O). */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const {q,V}=need('exact');
const {K2,PR}=need('kernels');
const entry1={A:['15','25','30']}, entry2={A:['15','25','30']};
const O2=[q(0),q(0)];
const task={
  n:6, title:'Точки, симметричные A относительно π₁ и начала координат', k:'3.2',
  entries:[entry1,entry2], gamma:e=>({A:V.of(e.A)}),
  fromSite(S,k){ const Q=x=>q(x), A2=S.points['A″'].map(Q), A1=S.points['A′'].map(Q); return {A:[A2[0].neg().div(k),A1[1].div(k),A2[1].neg().div(k)]}; },
  given3(M,G){ M.A=G.A; },
  given2(E,G,k){ E['A″']=PR[2](G.A,k); E['A′']=PR[1](G.A,k); },
  steps:[
    { id:'B', title:'B — симметрия относительно π₁',
      do3(M){ M.B=[M.A[0],M.A[1],M.A[2].neg()]; },
      do2(E){ E['B′']=E['A′']; const Ax=K2.meet(K2.link(E['A″']),K2.axisPar(O2)); E['B″']=K2.reflect(E['A″'],Ax); },
      claims:[['B','point']] },
    { id:'C', title:'C — симметрия относительно O',
      do3(M){ M.C=V.mul(M.A,q(-1)); },
      do2(E){ E['C″']=K2.reflect(E['A″'],O2); E['C′']=K2.reflect(E['A′'],O2); },
      claims:[['C','point']] },
  ],
  spec:{
    /* условие: середина AB на π₁ и AB ⟂ π₁; середина AC — точка O */
    holds:(M)=>{ const mAB=V.mul(V.add(M.A,M.B),q('0.5')), dAB=V.sub(M.B,M.A), mAC=V.mul(V.add(M.A,M.C),q('0.5'));
      return [['середина AB ∈ π₁',mAB[2].isZero()],['AB ⟂ π₁',dAB[0].isZero()&&dAB[1].isZero()],['середина AC = O',V.zero(mAC)]]; },
    solve:G=>({B:[G.A[0],G.A[1],G.A[2].neg()],C:V.mul(G.A,q(-1))}),
    unique:()=>({ok:true,why:'решение единственно: симметрия относительно плоскости и точки — взаимно однозначные отображения'}),
  },
  site:{ points:{'A″':'A','A′':'A','B″':'B','B′':'B','C″':'C','C′':'C'}, lines:{} },
  /* ответ — координаты: каждое «X(x; y; z)» в тексте ответа = доказанной точке */
  audit(M,S){ const out=[]; const num=s=>q(s.replace('−','-').replace(',','.'));
    ['B','C'].forEach(nm=>{ const m=new RegExp(nm+'\\(([−\\-\\d.,]+);\\s*([−\\-\\d.,]+);\\s*([−\\-\\d.,]+)\\)').exec(S.ans||'');
      if(!m) out.push('в ответе нет координат '+nm); else if(!V.eq([m[1],m[2],m[3]].map(num),M[nm])) out.push('в ответе '+nm+'('+m.slice(1).join('; ')+'), доказано '+V.str(M[nm])); });
    (S.segs||[]).filter(s=>s.k==='hid').forEach(()=>out.push('штриховая линия, хотя закрывать нечем'));
    return {out:[...new Set(out)],what:'координаты B и C в тексте ответа проверены'}; },
  randomGamma(rnd){ const r=(lo,hi)=>q((Math.round((lo+(hi-lo)*rnd())*10)/10).toFixed(1)); return {A:[r(-60,60),r(-50,50),r(-50,50)]}; },
  faults:[
    {what:'B″ отложена от A″, а не от оси x', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='B'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ E['B′']=E['A′']; E['B″']=K2.reflect(E['A′'],E['A″']); }}); }},
    {what:'C — симметрия только относительно оси x (z и y со знаком минус, x тот же)', apply:T=>{ const i=T.steps.findIndex(x=>x.id==='C'); T.steps[i]=Object.assign({},T.steps[i],{do2(E){ const Ax=K2.meet(K2.link(E['A″']),K2.axisPar(O2)); E['C″']=K2.reflect(E['A″'],Ax); E['C′']=K2.reflect(E['A′'],Ax); }}); }},
    {what:'опечатка при вводе: y точки A = 52', apply:T=>{ T.entries=[T.entries[0],{A:['15','52','30']}]; }},
    {what:'на чертеже C′ сдвинута на 2 ед.', site:S=>{ S.points['C′'][0]+=2; }},
    {what:'в ответе B(15; 25; 30)', site:S=>{ S.ans=S.ans.replace('B(15; 25; −30)','B(15; 25; 30)'); }},
  ],
};
put('t6',task);
})();
