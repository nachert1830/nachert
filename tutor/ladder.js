/* ═══════════ TUTOR_LADDER: автомат лестницы подсказок (docs/TUTOR.md, отчёт-исследование §4.1) ═══════════
   Детерминированный, без модели. Работает в браузере (self.TUTOR_LADDER) и в Node.
   Ступени: −1 — ученик пробует сам (подсказки нет); Р0 вопрос → Р1 приём → Р2 объект → Р3 действие → Р4 пример на соседнем варианте.
   const L=TUTOR_LADDER.create(passport, {compressed:false, now:0});  const out=L.on(event)  →  {rung, move, ...}
   События: {type:'open',t} · {type:'action',ok:true|false,mistake?:id,t} (действие на чертеже, ядро сказало верно/неверно) ·
            {type:'say',t} (содержательная реплика ученика — тоже попытка) · {type:'help',t} («помоги», «дальше») ·
            {type:'tick',t} (прошло время) · {type:'example_seen',t} · {type:'explain',t} (ответ на вопрос самообъяснения).
   Ходы (move): none · hint (показать ступень rung) · repeat («сначала попробуй вот это» — та же ступень) ·
            feedback (ошибка из библиотеки: обратная связь, ступень не растёт) · example (Р4: соседний вариант, ref) ·
            own (после примера — «теперь на своём») · self_explain (вопрос «почему так?» после Р2+) · done.
   Правила:
     • из попытки в Р0 — ошибка, 60 с бездействия или просьба о помощи;
     • ступень растёт только после попытки (действие или реплика) или 45 с без действий; «дальше» без попытки — repeat;
     • ошибка из библиотеки паспорта в первый раз — feedback без роста ступени; повтор той же — как обычная ошибка;
     • Р3 → Р4 только по 2 ошибкам на Р3 или просьбе после ≥1 попытки на Р3 (время не ведёт к примеру);
     • Р4 — всегда соседний вариант (passport.rungs[4].neighbor); свой вариант за ученика не решается никогда;
     • верное действие засчитывает шаг; если брал Р2+, сначала вопрос на самообъяснение;
     • перед РК (compressed) лестница сжата: Р0 → Р2 → Р4. */
(function(){
const T0=60, TK=45;
function create(P,opt){ opt=opt||{};
  const seq=opt.compressed?[0,2,4]:[0,1,2,3,4];
  const S={rung:-1,pos:-1,attempts:0,attSince:0,errAt:0,last:opt.now||0,seen:new Set(),solved:false,maxRung:-1,needExplain:false,exampleSeen:false,log:[]};
  const lib=new Set(((P&&P.mistakes)||[]).map(m=>m.id));
  const neighbor=P&&P.rungs&&P.rungs.find(r=>r.k===4)&&P.rungs.find(r=>r.k===4).neighbor||null;
  const R=(move,extra)=>{ const o=Object.assign({rung:S.rung,move},extra||{}); S.log.push(o); return o; };
  const up=(t)=>{ if(S.pos>=seq.length-1) return null; S.pos++; S.rung=seq[S.pos]; S.attSince=0; S.errAt=0; S.last=t; S.maxRung=Math.max(S.maxRung,S.rung);
    if(S.rung===4) return R('example',{ref:neighbor,own:false});
    return R('hint'); };
  const canR4=()=>seq[S.pos+1]===4;
  function on(e){ const t=e.t==null?S.last:e.t;
    if(S.solved) return R('done');
    switch(e.type){
      case 'open': S.last=t; return R('none');
      case 'action': {
        S.attempts++; S.attSince++; S.last=t;
        if(e.ok){ if(S.maxRung>=2&&!S.explained){ S.needExplain=true; S.solved=false; S.pendingDone=true; return R('self_explain'); } S.solved=true; return R('done'); }
        if(e.mistake&&lib.has(e.mistake)&&!S.seen.has(e.mistake)){ S.seen.add(e.mistake); return R('feedback',{mistake:e.mistake}); }
        if(S.rung===-1) return up(t);
        if(canR4()){ S.errAt++; return S.errAt>=2?up(t):R('repeat'); }
        return up(t)||R('repeat'); }
      case 'say': S.attSince++; S.attempts++; S.last=t; return R('none');
      case 'help': {
        if(S.rung===-1){ S.last=t; return up(t); }
        if(S.attSince===0) return R('repeat');           /* «дальше» без попытки ступень не повышает */
        if(canR4()) return up(t);                         /* просьба после ≥1 попытки на Р3 — пример */
        return up(t)||R('repeat'); }
      case 'tick': {
        const idle=t-S.last;
        if(S.rung===-1&&idle>=T0) return up(t);
        if(S.rung>=0&&idle>=TK&&!canR4()&&S.rung<4) return up(t);
        return R('none'); }
      case 'example_seen': S.exampleSeen=true; S.last=t; if(S.rung!==4) return R('none'); return R('own',{ask:'self_explain_then_own'});
      case 'explain': S.explained=true; S.last=t; if(S.pendingDone){ S.solved=true; return R('done'); } return R('none');
      default: return R('none'); } }
  return {on,state:()=>({rung:S.rung,attempts:S.attempts,maxRung:S.maxRung,solved:S.solved,seq:seq.slice()}),log:()=>S.log.slice()};
}
/* сессия по шагам: три шага подряд с Р4 — предложить вернуться к теме-опоре (passport.topics[0]) */
function session(){ const last=[]; return {stepDone(P,maxRung){ last.push(maxRung); if(last.length>3) last.shift();
  return last.length===3&&last.every(r=>r>=4)?{suggest:'prereq',topic:(P&&P.topics&&P.topics[0])||null}:null; }}; }
const TUTOR_LADDER={create,session,T0,TK};
if(typeof module!=='undefined'&&module.exports) module.exports=TUTOR_LADDER; else self.TUTOR_LADDER=TUTOR_LADDER;
})();
