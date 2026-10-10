/* ═══════════ Точная арифметика: рациональные числа на BigInt ═══════════
   Все построения начертательной геометрии с прямыми и плоскостями (пересечение, параллель, перпендикуляр,
   основание перпендикуляра, линия связи) — рациональные операции. Поэтому в дробях «равно» значит «равно»:
   никаких допусков, ни ложных тревог, ни пропусков меньше допуска. Длины сравниваются в квадратах. */
const gcd=(a,b)=>{ a=a<0n?-a:a; b=b<0n?-b:b; while(b){ [a,b]=[b,a%b]; } return a; };
class Q{
  constructor(n,d=1n){ if(d===0n) throw new Error('деление на ноль'); if(d<0n){ n=-n; d=-d; } const g=gcd(n,d)||1n; this.n=n/g; this.d=d/g; }
  /* десятичная запись — точно: '1.934' → 1934/1000 (именно то число, что написал автор, без двоичной погрешности) */
  static of(x){
    if(x instanceof Q) return x;
    if(typeof x==='bigint') return new Q(x);
    if(typeof x==='number'){ if(!isFinite(x)) throw new Error('не число: '+x); return Q.dec(String(x)); }
    if(typeof x==='string') return Q.dec(x);
    throw new Error('не число: '+x); }
  static dec(s){
    const m=/^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(s).replace('−','-').trim()); if(!m) throw new Error('не число: '+s);
    const fr=m[3]||'', e=+(m[4]||0); let n=BigInt((m[2]||'0')+fr), d=10n**BigInt(fr.length);
    if(e>0) n*=10n**BigInt(e); if(e<0) d*=10n**BigInt(-e); return new Q(m[1]?-n:n,d); }
  add(b){ b=Q.of(b); return new Q(this.n*b.d+b.n*this.d,this.d*b.d); }
  sub(b){ b=Q.of(b); return new Q(this.n*b.d-b.n*this.d,this.d*b.d); }
  mul(b){ b=Q.of(b); return new Q(this.n*b.n,this.d*b.d); }
  div(b){ b=Q.of(b); if(b.n===0n) throw new Error('деление на ноль'); return new Q(this.n*b.d,this.d*b.n); }
  neg(){ return new Q(-this.n,this.d); }
  sign(){ return this.n>0n?1:this.n<0n?-1:0; }
  isZero(){ return this.n===0n; }
  eq(b){ b=Q.of(b); return this.n===b.n&&this.d===b.d; }
  cmp(b){ return this.sub(b).sign(); }
  num(){ const s=10n**18n; return Number(this.n*s/this.d)/1e18; }
  toString(){ return this.d===1n?String(this.n):this.n+'/'+this.d; }
}
const q=x=>Q.of(x);
/* векторы из Q */
const V={
  of:a=>a.map(q),
  add:(a,b)=>a.map((v,i)=>v.add(b[i])),
  sub:(a,b)=>a.map((v,i)=>v.sub(b[i])),
  mul:(a,k)=>a.map(v=>v.mul(k)),
  dot:(a,b)=>a.reduce((s,v,i)=>s.add(v.mul(b[i])),q(0)),
  cross:(a,b)=>[a[1].mul(b[2]).sub(a[2].mul(b[1])),a[2].mul(b[0]).sub(a[0].mul(b[2])),a[0].mul(b[1]).sub(a[1].mul(b[0]))],
  cross2:(a,b)=>a[0].mul(b[1]).sub(a[1].mul(b[0])),
  eq:(a,b)=>a.length===b.length&&a.every((v,i)=>v.eq(b[i])),
  zero:a=>a.every(v=>v.isZero()),
  num:a=>a.map(v=>v.num()),
  str:a=>'('+a.map(v=>v.num().toFixed(3)).join('; ')+')',
};
/* округление √v до целого — доказательно: N − ½ ≤ √v < N + ½  ⇔  (2N − 1)² ≤ 4v < (2N + 1)² */
function roundSqrt(v){ if(v.sign()<0) throw new Error('√ отрицательного');
  let N=BigInt(Math.round(Math.sqrt(v.num())));
  const ok=N=>{ const lo=q((2n*N-1n)*(2n*N-1n)), hi=q((2n*N+1n)*(2n*N+1n)), v4=v.mul(4); return (N===0n||lo.cmp(v4)<=0)&&v4.cmp(hi)<0; };
  for(const c of [N,N-1n,N+1n]) if(c>=0n&&ok(c)) return Number(c);
  throw new Error('округление √ не найдено'); }
module.exports={Q,q,V,roundSqrt};
