/* ═══════════ Точная арифметика: рациональные числа на BigInt ═══════════
   Все построения начертательной геометрии с прямыми и плоскостями (пересечение, параллель, перпендикуляр,
   основание перпендикуляра, линия связи) — рациональные операции. Поэтому в дробях «равно» значит «равно»:
   никаких допусков, ни ложных тревог, ни пропусков меньше допуска. Длины сравниваются в квадратах. */
(function(){
/* работает и в Node (require), и на странице сайта (глобальный CERT) */
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('./'+n+'.js'):self.CERT[n];
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.CERT=self.CERT||{}; self.CERT[n]=v; if(v&&v.n) (self.CERT.tasks=self.CERT.tasks||{})[v.n]=v; } };
const isqrt=n=>{ if(n<0n) throw new Error('√ отрицательного'); if(n<2n) return n; let x=BigInt('0x1'+'0'.repeat(Math.ceil(n.toString(16).length/2))), y=(x+n/x)>>1n; while(y<x){ x=y; y=(x+n/x)>>1n; } return x; };   /* целый корень — методом Ньютона, точно */
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
  add(b){ if(b instanceof R2) return b.add(this); b=Q.of(b); return new Q(this.n*b.d+b.n*this.d,this.d*b.d); }
  sub(b){ if(b instanceof R2) return b.neg().add(this); b=Q.of(b); return new Q(this.n*b.d-b.n*this.d,this.d*b.d); }
  mul(b){ if(b instanceof R2) return b.mul(this); b=Q.of(b); return new Q(this.n*b.n,this.d*b.d); }
  div(b){ if(b instanceof R2) return R2.of(this,b.d).div(b); b=Q.of(b); if(b.n===0n) throw new Error('деление на ноль'); return new Q(this.n*b.d,this.d*b.n); }
  neg(){ return new Q(-this.n,this.d); }
  sign(){ return this.n>0n?1:this.n<0n?-1:0; }
  isZero(){ return this.n===0n; }
  eq(b){ if(b instanceof R2) return b.eq(this); b=Q.of(b); return this.n===b.n&&this.d===b.d; }
  cmp(b){ return this.sub(b).sign(); }
  num(){ const s=10n**18n; return Number(this.n*s/this.d)/1e18; }
  toString(){ return this.d===1n?String(this.n):this.n+'/'+this.d; }
}
/* Квадратичное расширение Q(√d): a + b·√d, a, b ∈ Q, d ∈ Q — не полный квадрат. Метрические построения (отложить длину
   циркулем по прямой, новая ось при замене плоскостей) выводят из Q ровно в такое поле; равенство в нём — тоже точное.
   В одном выражении — одно d (иначе — ошибка, а не округление). */
class R2{
  constructor(a,b,d){ this.a=Q.of(a); this.b=Q.of(b); this.d=Q.of(d); }
  static of(x,d){ if(x instanceof R2) return x; return new R2(Q.of(x),new Q(0n),d); }
  /* √r в каноническом виде: r = n/d → √(n·d)/d; полный квадрат — рациональное число */
  static sqrt(r){ r=Q.of(r); if(r.sign()<0) throw new Error('√ отрицательного'); const m=r.n*r.d, s=isqrt(m); if(s*s===m) return new Q(s,r.d); return new R2(new Q(0n),new Q(1n,r.d),new Q(m)); }
  /* √r, если r — квадрат рационального числа, иначе null */
  static ratSqrt(r){ r=Q.of(r); if(r.sign()<0) return null; const a=isqrt(r.n), b=isqrt(r.d); return a*a===r.n&&b*b===r.d?new Q(a,b):null; }
  _c(o){ if(o instanceof R2){ if(!o.b.isZero()&&!this.b.isZero()&&!o.d.eq(this.d)) throw new Error('разные корни в одном выражении'); return o.b.isZero()?R2.of(o.a,this.d):o; } return R2.of(o,this.d); }
  _d(o){ return this.b.isZero()&&o instanceof R2?o.d:this.d; }
  add(o){ o=this._c(o); const d=this._d(o); return new R2(this.a.add(o.a),this.b.add(o.b),d).norm(); }
  sub(o){ return this.add(this._c(o).neg()); }
  neg(){ return new R2(this.a.neg(),this.b.neg(),this.d); }
  mul(o){ o=this._c(o); const d=this._d(o); return new R2(this.a.mul(o.a).add(this.b.mul(o.b).mul(d)),this.a.mul(o.b).add(this.b.mul(o.a)),d).norm(); }
  div(o){ o=this._c(o); const d=this._d(o), den=o.a.mul(o.a).sub(o.b.mul(o.b).mul(d)); if(den.isZero()) throw new Error('деление на ноль');
    return this.mul(new R2(o.a.div(den),o.b.neg().div(den),d)); }
  norm(){ return this; }
  isZero(){ return this.a.isZero()&&this.b.isZero(); }
  eq(o){ return this.sub(o).isZero(); }
  num(){ return this.a.num()+this.b.sign()*Math.sqrt(this.b.mul(this.b).mul(this.d).num()); }   /* b²·d — рациональное умеренной величины: без потери точности на огромных d */
  /* знак a + b√d точно: сравнение квадратов */
  sign(){ const sa=this.a.sign(), sb=this.b.sign(); if(sb===0) return sa; if(sa===0||sa===sb) return sa||sb;
    const A2=this.a.mul(this.a), B2=this.b.mul(this.b).mul(this.d), c=A2.cmp(B2); return c===0?0:(c>0?sa:sb); }
  cmp(o){ return this.sub(o).sign(); }
  toString(){ return this.a+(this.b.isZero()?'':' + '+this.b+'√'+this.d); }
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
put('exact',{Q,R2,q,V,roundSqrt});
})();
