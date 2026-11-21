/* Наставник: вызовы моделей. ProxyAPI — OpenAI-совместимый /chat/completions (инструменты — tools / tool_calls);
   российская модель — Yandex AI Studio (тот же формат, IAM-токен функции, без инструментов).
   Цена — по usage ответа: $ за млн токенов (прайс Anthropic) × курс ProxyAPI (TUTOR_RATE, по умолчанию 110 ₽). */
'use strict';
const PX_URL='https://api.proxyapi.ru/v1/chat/completions', YA_URL='https://llm.api.cloud.yandex.net/v1/chat/completions';
const PRICES={'anthropic/claude-sonnet-5-5':{in:2,out:10,cache:0.10},'anthropic/claude-haiku-5-5':{in:0.10,out:0.50,cache:0.01},
  'anthropic/claude-opus-5-5':{in:4,out:20,cache:0.20}};
/* имя Claude для ProxyAPI — версия через дефис (anthropic/claude-sonnet-5-5), как в server/lib/eyes.js */
const pxModel=m=>/^anthropic\/claude-/.test(m||'')?m.replace(/(\d)\.(\d)/g,'$1-$2'):m;

class ModelError extends Error{ constructor(msg,status,upstream){ super(msg); this.status=status||502; this.upstream=upstream||0; } }

/* копейки за вызов */
function kopecks(model,usage,rate){ if(!usage) return 0; const p=PRICES[model]||(/yandex|gpt:\/\//.test(model)?{in:0.6,out:0.6,cache:0.6}:{in:2,out:10,cache:0.1});
  const inTok=+usage.prompt_tokens||0, outTok=+usage.completion_tokens||0;
  const cached=+((usage.prompt_tokens_details&&usage.prompt_tokens_details.cached_tokens)||usage.cache_read_input_tokens||0);
  const usd=((inTok-cached)*p.in+cached*p.cache+outTok*p.out)/1e6; return Math.ceil(usd*(rate||110)*100); }

/* chat(o, m, q): o={http, key, token()}; m={url, model, yandex, folder}; q={messages, tools, max, timeout, temperature}
   → {message:{content, tool_calls}, usage, ms, finish} */
async function chat(o,m,q){ const http=o.http||((...a)=>fetch(...a)), yandex=!!m.yandex;
  const key=yandex?(o.token&&o.token()):o.key; if(!key) throw new ModelError('Модель не настроена: нет ключа.',503);
  const body={model:yandex?m.model:pxModel(m.model),messages:q.messages,temperature:q.temperature==null?0.3:q.temperature};
  if(yandex) body.max_tokens=q.max||1200; else body.max_completion_tokens=q.max||1200;
  if(q.tools&&q.tools.length){ body.tools=q.tools; body.tool_choice=q.toolChoice||'auto'; }
  const headers={'content-type':'application/json',authorization:'Bearer '+key}; if(yandex&&m.folder) headers['x-folder-id']=m.folder;
  const t0=Date.now(); let r;
  try{ r=await http(m.url||(yandex?YA_URL:PX_URL),{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(Math.max(3000,q.timeout||25000))}); }
  catch(e){ throw new ModelError('Модель не ответила вовремя'+(e&&e.name==='TimeoutError'?'':': '+String(e&&e.message||e).slice(0,120)),504); }
  const t=await r.text(); let j=null; try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok){ const why=j&&(j.error?j.error.message||j.error:j.detail||j.message);
    throw new ModelError('Модель '+body.model+' ответила '+r.status+(why?': '+String(typeof why==='string'?why:JSON.stringify(why)).slice(0,200):''),r.status===402?402:502,r.status); }
  const c=j&&j.choices&&j.choices[0]||{}, msg=c.message||{}, raw=msg.content;
  const content=(typeof raw==='string'?raw:Array.isArray(raw)?raw.map(p=>p&&p.text||'').join(''):'').replace(/<think>[\s\S]*?(<\/think>|$)/g,'').trim();
  const calls=(Array.isArray(msg.tool_calls)?msg.tool_calls:[]).filter(x=>x&&x.function&&x.function.name);
  return {message:{content,tool_calls:calls},usage:j&&j.usage||null,ms:Date.now()-t0,finish:c.finish_reason||null,model:body.model}; }

module.exports={chat,kopecks,pxModel,ModelError,PX_URL,YA_URL,PRICES};
