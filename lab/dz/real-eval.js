/* ═══════════ Главная метрика: настоящие листы студентов (фото — только в lab/private/real/, в git их нет) ═══════════
   node lab/dz/real-eval.js [--hints=1] [--only=p-001,p-004] [--v=1]
   Разметка — lab/private/real/index.json (тоже не в git):
     {"sheets":[{"file":"p-001.jpg","src":"откуда","dz":3,"n":7,"kind":"клетка",
       "drawings":[{"part":"0"|"a"|"b"|"c"|"d","box":[x0,y0,x1,y1] (px фото),"err":null|"a"…|"?","dataErr":false|true|"?",
                    "answer":{"H":28}|{"dih":81}|{"phi":25}, "answerErr":false|true|"?", "partial":true — обрезан, не считается}]}],
      "foreign":[{"file":"…","why":"другая задача"}]}  — чужие листы: любой вердикт по ним ложный.
   err — в какой части ошибка построения (null — нет, "?" — владелец ещё не сказал: такие вердикты не идут ни в верные,
   ни в ложные, а считаются отдельно). part "0" — чертёж условия без частей.
   Путь — как у сканера в браузере (worker.js): checkGridPhoto (сетка / чистый лист), а если вердикта нет и сетки
   нет — свои глаза (findDrawings → checkEyes). Без модели. --hints=1 — как будто студент указал часть и ввёл ответ
   (только для фото с одним чертежом).
   Меры: чертежей найдено (из размеченных), частей опознано, вердиктов верных, ЛОЖНЫХ, не размеченных. */
const fs=require('fs'), path=require('path'), cp=require('child_process'), IMG=require('../img.js'), GS=require('./gridsheet.js'), EY=require('./eyes.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), HINTS=A.hints==='1', V=A.v==='1', ONLY=A.only?A.only.split(','):null;
const DIR=path.join(__dirname,'../private/real'), IX=JSON.parse(fs.readFileSync(path.join(DIR,'index.json'),'utf8'));
const WEAK=v=>v==='не могу прочитать'||v==='не могу утверждать', PN={'0':'условие',a:'а) высота',b:'б) угол граней',c:'в) истинный вид',d:'г) угол SA'};
/* jpg → png рядом (декодер у нас только PNG); фото остаются в lab/private/ */
function load(f){ const p=path.join(DIR,f), png=p.replace(/\.(jpe?g|heic)$/i,'.png');
  if(png!==p&&!fs.existsSync(png)) cp.execFileSync('convert',[p,'-auto-orient',png]); return IMG.decodePNG(fs.readFileSync(png)); }
/* как в worker.js: обычный разбор листа, затем свои глаза */
function scan(img,dz,n,answers,part){ const g=GS.checkGridPhoto(img,{dz,n,answers,part,paper:'auto'});
  if(dz===3&&n&&WEAK(g.verdict)&&g.paper!=='grid'&&!(g.grid&&g.grid.ok&&!g.grid.plain)){ let own=null; try{ own=EY.findDrawings(img,{dz:3,n}); }catch(e){}
    if(own&&own.ok){ let r=null; try{ r=EY.checkEyes(img,{dz:3,n,drawings:own.drawings},{dz:3,n,answers,part,grid:{ok:false,reason:'чистый лист'}}); }catch(e){}
      if(r&&r.drawings.some(q=>q.ok)) return {stage:'свои глаза',drawings:r.drawings,first:g.verdict}; } }
  return {stage:g.paper==='grid'||(g.grid&&g.grid.ok&&!g.grid.plain)?'клетка':'лист',drawings:[g]}; }
const Opx=g=>{ try{ return g._grid&&g.given?g._grid.map(g.given.O[0],g.given.O[1]):null; }catch(e){ return null; } };
const inBox=(b,p)=>b&&p&&p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
/* утверждение сканера → верно / ЛОЖНО / не размечено */
function judge(cl,T){ if(!T) return 'ложно';
  if(cl.t==='data'){ if(T.dataErr==='?'||T.dataErr==null) return 'не размечено'; return (cl.bad===!!T.dataErr)?'верно':'ложно'; }
  if(cl.t==='part'){ if(T.part!==cl.k) return 'ложно'; if(T.err==='?') return 'не размечено'; return (cl.bad===(T.err===cl.k))?'верно':'ложно'; }
  if(cl.t==='ans'){ const e=T.answerErr; if(e==='?'||e==null) return 'не размечено'; return cl.bad===!!e?'верно':'ложно'; }
  if(cl.t==='sheet'){ if(T.err==='?'||T.dataErr==='?') return 'не размечено'; const bad=!!T.err||!!T.dataErr; return cl.bad===bad?'верно':'ложно'; } }
const S={photos:0,truthDr:0,found:0,parts:0,partsWrong:0,ok:0,bad:0,unl:0,refuse:0,ms:0}, lines=[];
for(const sh of IX.sheets.concat((IX.foreign||[]).map(f=>Object.assign({foreign:true,dz:3,n:7,drawings:[]},f)))){
  if(ONLY&&!ONLY.some(o=>sh.file.startsWith(o))) continue;
  const img=load(sh.file), TD=sh.drawings.filter(d=>!d.partial), one=TD.length===1?TD[0]:null, t0=Date.now();
  const answers=HINTS&&one&&one.answer?one.answer:{}, part=HINTS&&one&&one.part!=='0'?one.part:null;
  let res; try{ res=scan(img,sh.dz,sh.n,answers,part); }catch(e){ res={stage:'сбой: '+String(e&&e.message||e),drawings:[]}; }
  const ms=Date.now()-t0; S.photos++; S.ms+=ms; S.truthDr+=TD.length; const hit=new Set(), out=[];
  res.drawings.forEach((g,i)=>{ const o=Opx(g); let T=o?TD.find(d=>inBox(d.box,o)):null; if(!T&&!o&&one&&g.ok) T=one; if(sh.foreign) T=null;
    if(T&&g.ok) hit.add(T); const cls=[];
    if(g.verdict==='ошибка в данных') cls.push({t:'data',bad:true,s:'ошибка в данных'}); else if(g.verdict==='данные нанесены верно') cls.push({t:'data',bad:false,s:'данные верно'});
    (g.shown||[]).forEach(k=>{ const p=g.parts&&g.parts[k]; if(p&&(p.st==='верно'||p.st==='ошибка')) cls.push({t:'part',k,bad:p.st==='ошибка',s:PN[k]+': '+p.st}); });
    (g.answers||[]).forEach(x=>cls.push({t:'ans',bad:x.st!=='верно',s:'ответ '+x.a+': '+(x.st==='верно'?'верно':'неверно ('+x.st+')')}));
    if(!cls.some(c=>c.t==='part'||c.t==='ans')&&(g.verdict==='верно'||g.verdict==='ошибка')) cls.push({t:'sheet',bad:g.verdict==='ошибка',s:'чертёж: '+g.verdict});
    const guess=g.partGuess&&g.partGuess.length===1?g.partGuess[0]:null, named=new Set(cls.filter(c=>c.t==='part').map(c=>c.k)); if(guess) named.add(guess);
    if(T&&T.part!=='0'&&named.has(T.part)) S.parts++; if(T&&[...named].some(k=>k!==T.part)) S.partsWrong++;
    cls.forEach(c=>{ c.j=judge(c,T); if(c.j==='верно') S.ok++; else if(c.j==='ложно') S.bad++; else S.unl++; });
    if(!cls.length) S.refuse++;
    out.push('  чертёж '+(i+1)+(T?' = '+PN[T.part]:o?' (не размечен: O в '+o.map(Math.round).join(',')+' px)':'')+': '+g.verdict+(cls.length?' → '+cls.map(c=>c.s+' ['+c.j.toUpperCase()+']').join('; '):'')
      +(V&&g.why?'\n      '+g.why.slice(0,6).join('\n      '):'')); });
  S.found+=hit.size;
  lines.push(sh.file+(sh.foreign?' (чужой лист: '+sh.why+')':' в'+sh.n)+' — '+res.stage+(res.first?' (обычный разбор: '+res.first+')':'')+', найдено '+hit.size+'/'+TD.length+', '+(ms/1000).toFixed(0)+' с'); lines.push(...out); }
lines.forEach(l=>console.log(l));
console.log('\nИТОГО'+(HINTS?' (с подсказкой части и ответом)':'')+': фото '+S.photos+', чертежей найдено '+S.found+'/'+S.truthDr+', частей опознано '+S.parts+(S.partsWrong?' (названа чужая — '+S.partsWrong+')':'')
  +', вердиктов верных '+S.ok+', ЛОЖНЫХ '+S.bad+', не размечено '+S.unl+', отказов (чертежей без вердикта) '+S.refuse+', '+(S.ms/1000/Math.max(1,S.photos)).toFixed(0)+' с на фото');
