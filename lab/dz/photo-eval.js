/* ═══════════ Настоящее фото листа → большая модель: оцифровка (точки, отрезки, записанные ответы) ═══════════
   node lab/dz/photo-eval.js <каталог с .jpg> [--models=anthropic/claude-sonnet-5.5] [--limit=0.05]
   Правды нет — ответ печатается целиком, сверка — наложением на фото (вне репозитория). Фото в репозиторий не попадают:
   .github/workflows/photo-eval.yml получает их зашифрованными одноразовым ключом прогона. */
const fs=require('fs'), path=require('path'), SE=require('../../server/lib/eyes.js');
const A=Object.fromEntries(process.argv.slice(3).map(s=>s.replace(/^--/,'').split('='))), DIR=process.argv[2], LIMIT=+(A.limit||0.05);
const MODELS=(A.models||'anthropic/claude-sonnet-5.5').split(',');
const SYSTEM='Ты — оцифровщик чертежей. На фото — лист с карандашным чертежом по начертательной геометрии (эпюр Монжа: проекции пирамиды '+
  'SABC, оси, линии связи, построения), лист может быть повёрнут. Координаты — в пикселях ЭТОГО фото: начало — левый верхний угол, '+
  'x вправо, y вниз, целые числа.\nВыпиши построчно, без пояснений и без markdown:\n'+
  'N <номер части в кружке, если есть>\n'+
  'T <x> <y> <текст> — каждая записанная надпись-ответ или пометка (H=28, φ=25°, h″∥X, n′⊥h′ …), как написано;\n'+
  'P <подпись> <x> <y> — каждая подписанная точка: подпись как на чертеже (A″, B′, S₄, H^IV, 1″ …) и где сама точка (не текст подписи);\n'+
  'S <x1> <y1> <x2> <y2> — каждый прямой отрезок чертежа от конца до конца: рёбра, тонкие линии связи, оси, линии построения. '+
  'Отрезок, который прерывается точкой, можно дать одним отрезком. Дуги, клетки бумаги, рамку и бланк не пиши.';
/* размер JPEG — из маркера SOF */
function jpegSize(b){ let i=2; while(i<b.length){ if(b[i]!==0xFF){ i++; continue; } const m=b[i+1], L=b.readUInt16BE(i+2); if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC) return {h:b.readUInt16BE(i+5),w:b.readUInt16BE(i+7)}; i+=2+L; } return null; }
async function priceOf(id){ const j=await (await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(30000)})).json(), m=(j.data||[]).find(x=>x.id===id); if(!m) return null;
  const P=m.pricing||{}; return {prompt:+P.prompt||0,completion:+P.completion||0}; }
(async()=>{ const key=process.env.OPENROUTER_API_KEY||''; if(!key){ console.log('нет OPENROUTER_API_KEY'); process.exit(1); }
  const files=fs.readdirSync(DIR).filter(f=>/\.jpe?g$/i.test(f)).sort(); let spent=0;
  for(const name of MODELS){ const pr=await priceOf(name); if(!pr){ console.log(name+': нет в списке OpenRouter'); continue; }
    for(const f of files){ const b=fs.readFileSync(path.join(DIR,f)), sz=jpegSize(b), inCost=(sz.w*sz.h/750+1200)*pr.prompt, maxTok=Math.min(4000,Math.floor((LIMIT-spent-inCost)/pr.completion));
      if(maxTok<1500){ console.log('\n══ '+name+', '+f+': пропущено — не помещается в $'+LIMIT); continue; }
      const cfg=SE.eyesFromEnv({EYES_URL:SE.OR_URL,EYES_MODEL:name,OPENROUTER_API_KEY:key,EYES_BEST_MODEL:'off'}), t0=Date.now(); let text='', info=null, cost=0;
      try{ const r=await SE.ask(cfg,{image:'data:image/jpeg;base64,'+b.toString('base64'),w:sz.w,h:sz.h,system:SYSTEM,text:'Размер фото: '+sz.w+' × '+sz.h+' px.',opts:{max_tokens:maxTok}},{timeout:240000});
        text=r.text; info=r.info; const u=info&&info.usage; cost=u&&u.cost!=null?+u.cost:inCost+maxTok*pr.completion; }
      catch(e){ console.log('СБОЙ: '+e.message.slice(0,300)); cost=inCost+maxTok*pr.completion; }
      spent+=cost; const u=info&&info.usage;
      console.log('\n══ '+name+', '+f+' ('+sz.w+' × '+sz.h+'), '+((Date.now()-t0)/1000).toFixed(1)+' с, $'+cost.toFixed(4)+(u?', токенов '+u.prompt_tokens+' / '+u.completion_tokens:'')+(info?', finish '+info.finish:''));
      console.log('----- ответ -----\n'+text+'\n----- конец -----'); } }
  console.log('\nпотрачено всего: $'+spent.toFixed(4)+' (предел $'+LIMIT+')'); })().catch(e=>{ console.error(e); process.exit(1); });
