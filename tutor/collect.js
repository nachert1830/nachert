/* ═══════════ TUTOR_COLLECT: паспорта всех шагов (в браузере, где есть WB3, PLAYER, DZR, GEN) ═══════════
   TUTOR_COLLECT.wb(n?)        — задачи рабочей тетради (все 89 или одна);
   TUTOR_COLLECT.dz(id, nums?) — варианты ДЗ (ng1…ng5): паспорт по типу варианта + его данным;
   TUTOR_COLLECT.ig()          — ИГ: ДЗ №4 по шагам (IG4S.tutor), остальные — пометка TODO;
   TUTOR_COLLECT.deps()        — зависимости генератора. Идентификаторы: wb.46.s2, wb.45.b.s3, dz.ng2.v14.s3, ig.ig4.v7.s2. */
(function(){
const PL='абвгдежз';
function deps(extra){ const C=self.CORE||self.CERT||{};
  return Object.assign({STEPVIEW:self.STEPVIEW,PREPROG:self.PREPROG,PREP:self.PREP,CP:{cp46:C.cp46,cp47:C.cp47},LINT:self.TUTOR_LINT},extra||{}); }
/* WB3 и PLAYER объявлены в index.html как const — видны по имени, но не через self */
const G_=n=>n==='WB3'?(typeof WB3!=='undefined'?WB3:null):n==='PLAYER'?(typeof PLAYER!=='undefined'?PLAYER:null):self[n];
const partsOf=t=>(G_('PLAYER')&&G_('PLAYER').partsOf)?PLAYER.partsOf(t):((t.parts&&t.parts.length)?t.parts:[t]);
/* соседний вариант задачи тетради: генератор GEN (тот же код задачи на других данных); шаги должны совпасть по числу */
const GENCACHE={};
function genNeighbor(n){ if(n in GENCACHE) return GENCACHE[n]; let r=null;
  try{ if(self.GEN&&GEN.ok(n)){ for(const seed of [101,202,303]){ const v=GEN.variant(n,seed); if(v&&v.task){ r={seed:v.seed||seed,task:v.task}; break; } } } }catch(e){ r=null; }
  return GENCACHE[n]=r; }
function wb(only){ const out=[];
  (G_('WB3')?G_('WB3').tasks:[]).forEach(t=>{ if(only!=null&&String(t.n)!==String(only)) return;
    const nb=genNeighbor(t.n), ps=partsOf(t), nps=nb?partsOf(nb.task):[];
    ps.forEach((p,pi)=>{ const base='wb.'+t.n+(ps.length>1?'.'+(PL[pi]||pi):'');
      const np=nps[pi], same=np&&(np.steps||[]).length===(p.steps||[]).length;
      out.push(...TUTOR_PASSPORT.forPart(p,base,{task:t,src:{kind:'wb',task:String(t.n),part:pi},deps:deps({neighbor:k=>same?{id:base+'.s'+k+'~gen'+nb.seed,kind:'gen',task:String(t.n),seed:nb.seed,part:pi,step:k}:null}),
        noNeighborWhy:!(self.GEN&&GEN.ok(t.n))?'у задачи нет генератора вариантов (GEN_OK)':nb?'у варианта генератора другое число шагов':'генератор не дал проверенного варианта'})); }); });
  return out; }
/* соседний вариант ДЗ — ближайший вариант того же типа, который ядро решает */
function dzNeighbor(id,n){ const ty=DZR.typeOf(id,n), all=DZR.numbers(id).filter(m=>m!==+n&&(DZR.typeOf(id,m)||{}).code===(ty||{}).code);
  if(!all.length) return null; return all.find(m=>m>n)||all[0]; }
function dz(id,nums){ const out=[], list=nums||DZR.numbers(id);
  list.forEach(n=>{ let r=null; try{ r=DZR.solve(id,n); }catch(e){ r=null; } if(!r||!r.task) return;
    const t=r.task, ps=partsOf(t), m=dzNeighbor(id,n), ty=(DZR.typeOf(id,n)||{}).code||'';
    ps.forEach((p,pi)=>{ const base='dz.'+id+'.v'+n+(ps.length>1?'.'+(PL[pi]||pi):'');
      out.push(...TUTOR_PASSPORT.forPart(p,base,{task:t,src:{kind:'dz',dz:id,variant:+n,type:ty,part:pi},deps:deps({neighbor:k=>m?{id:'dz.'+id+'.v'+m+(ps.length>1?'.'+(PL[pi]||pi):'')+'.s'+k,kind:'dz',dz:id,variant:m,part:pi,step:k}:null}),noNeighborWhy:'нет другого варианта того же типа'})); }); });
  return out; }
/* ИГ: шаги есть только у ДЗ №4 (IG4S.tutor). Паспорт урезанный: чертёж ИГ — не сцена DRAW, факты и подшаги — TODO */
function ig(){ const out=[], miss=[];
  (self.DZR?DZR.list('ig'):[]).forEach(d=>{ const id=d.id;
    if(id==='ig4'&&self.IG4S&&IG4S.tutor){ DZR.numbers(id).forEach(n=>{ let T=null; try{ T=IG4S.tutor(n); }catch(e){} if(!T) return;
      T.steps.forEach(s=>{ const nb=DZR.numbers(id).find(m=>m>n)||null;
        out.push({v:1,id:'ig.'+id+'.v'+n+'.s'+s.k,src:{kind:'ig',dz:id,variant:+n,step:s.k},type:'ig-view',title:String(s.title||''),goal:String(s.title||''),
          why:{text:String(s.more||''),src:s.more?'ig4.more':null},entities:[],labels:{known:[],new:(s.points||[]).map(p=>String(p.n)),future:[],general:[]},facts:[],
          secrets:{labels:[],entities:[],numbers:true,values:[]},
          rungs:[{k:0,name:'вопрос',text:'Какой вид и какое тело строим на этом шаге?',src:'template:ig',labels:[]},{k:1,name:'приём',text:'Каждая точка вида строится по двум другим видам линиями связи.',src:'template:ig',labels:[]},
            {k:2,name:'объект',text:'Найди на других видах ту же поверхность детали.',src:'template:ig',labels:[]},{k:3,name:'действие',text:'Перенеси точки по линиям связи и соедини их по порядку.',src:'template:ig',labels:[]},
            {k:4,name:'пример',text:nb?'Посмотри этот же шаг на соседнем варианте.':'',src:nb?'neighbor':'todo',labels:[],neighbor:nb?{id:'ig.'+id+'.v'+nb+'.s'+s.k,kind:'ig',variant:nb,step:s.k}:null}],
          mistakes:[],key_view:{look:'изометрия детали, затем по оси вида',why:'видно, откуда берётся линия вида',target:null},topics:[],
          todo:[{field:'facts',why:'чертёж ИГ — не сцена ядра DRAW, проверяемых фактов пока нет'},{field:'mistakes',why:'библиотеки ошибок ИГ нет'},{field:'topics',why:'темы подготовки ИГ не размечены'}]}); }); }); }
    else miss.push({id,why:'у задания нет решения по шагам (только 3D-модель и лист)'}); });
  return {out,miss}; }
/* проверки генератора вариантов (GEN.checkers) подгружаются по требованию — до wb() их надо дождаться */
function ready(){ try{ return self.GEN&&GEN.checkers?GEN.checkers():Promise.resolve(false); }catch(e){ return Promise.resolve(false); } }
self.TUTOR_COLLECT={ready,deps,wb,dz,ig,genNeighbor,dzNeighbor};
})();
