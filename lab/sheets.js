/* ═══════════ Шаблоны листов: где на странице напечатано «дано» ═══════════
   Лист — страница тетради (мм, x вправо, y вниз). O — где на странице начало оси x чертежа (точка x = 0),
   дальше координаты чертежа (u, v) из core/model.js: точка страницы = O + (u, v).
   ВНИМАНИЕ: раскладка ниже — модель, а не обмер настоящей тетради. Для реальных фото нужен скан чистой страницы
   с задачей (что напечатано, где рамка, размер страницы) — см. lab/REPORT-scanner.md. Сканер опирается на
   само «дано» (ось, a″, a′, A″, A′), поэтому сдвиг чертежа на странице он находит сам; размер и пропорции
   страницы нужны только для первого, грубого выпрямления. */
(function(){
const need=n=>(typeof module!=='undefined'&&module.exports&&typeof require==='function')?require('../core/'+n+'.js'):((self.CORE&&self.CORE[n])||(self.CERT&&self.CERT[n]));
const put=(n,v)=>{ if(typeof module!=='undefined'&&module.exports) module.exports=v; else { self.LAB=self.LAB||{}; self.LAB[n]=v; } };

const SHEETS={
  47:{ n:47, page:{w:148,h:210}, frame:[10,10,138,200], O:[112,104],
    title:'47. Определить расстояние от точки A до прямой a.',
    /* область, где идёт построение (мм чертежа): по ней берётся фрагмент для поиска линий */
    roi:[-75,-55,20,80],
    given:()=>{ const T=need('t47'), C=need('cp47'); return C.printed(T.gamma(T.entries[0])); },
    G:()=>{ const T=need('t47'); return T.gamma(T.entries[0]); } },
  46:{ n:46, page:{w:148,h:210}, frame:[10,10,138,200], O:[110,110],
    title:'46. Построить линию пересечения треугольников ABC и DEF, определить видимость.',
    roi:[-78,-66,10,62],
    given:()=>{ const T=need('t46'), C=need('cp46'); return C.printed(T.gamma(T.entries[0])); },
    G:()=>{ const T=need('t46'); return T.gamma(T.entries[0]); } },
};
const toPage=(sh,p)=>[sh.O[0]+p[0],sh.O[1]+p[1]];
const toDraw=(sh,p)=>[p[0]-sh.O[0],p[1]-sh.O[1]];
put('sheets',{SHEETS,toPage,toDraw});
})();
