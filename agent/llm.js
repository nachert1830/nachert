/* ═══════════ LLM через OpenRouter (API, совместимый с OpenAI) ═══════════
   Без зависимостей: https из Node; если задан HTTPS_PROXY — туннель CONNECT через прокси окружения
   (ключ в заголовок Authorization подставляет прокси; сами мы шлём заглушку, если OPENROUTER_API_KEY нет).
   chat(model, messages, opts) → {text, usage:{prompt, completion, cost}, ms, raw_model, finish}
   Сетевые сбои и 429/5xx повторяются (до 5 раз, пауза 2, 4, 8, 16, 32 с) — это не попытки агента. */
const https=require('https'), http=require('http'), tls=require('tls'), {URL}=require('url');

const ENDPOINT=process.env.OPENROUTER_URL||'https://openrouter.ai/api/v1/chat/completions';

function tunnel(host,port){ const px=process.env.HTTPS_PROXY||process.env.https_proxy; if(!px) return Promise.resolve(null);
  const p=new URL(px);
  return new Promise((res,rej)=>{ const r=http.request({host:p.hostname,port:p.port||80,method:'CONNECT',path:host+':'+port,headers:{Host:host+':'+port}});
    r.on('connect',(resp,sock)=>{ if(resp.statusCode!==200){ sock.destroy(); return rej(new Error('прокси: CONNECT '+resp.statusCode)); }
      res(tls.connect({socket:sock,servername:host})); });
    r.on('error',rej); r.setTimeout(60000,()=>r.destroy(new Error('прокси: тайм-аут CONNECT'))); r.end(); }); }

async function post(url,body,timeoutMs){ const u=new URL(url), sock=await tunnel(u.hostname,u.port||443), data=Buffer.from(JSON.stringify(body));
  return new Promise((res,rej)=>{ const req=https.request({host:u.hostname,port:u.port||443,path:u.pathname+u.search,method:'POST',
      createConnection:sock?()=>sock:undefined,
      headers:{'Content-Type':'application/json','Content-Length':data.length,'Authorization':'Bearer '+(process.env.OPENROUTER_API_KEY||'proxy-injected'),
        'HTTP-Referer':'https://github.com/nachert1830/nachert','X-Title':'nachert agent eval'}},
    r=>{ const ch=[]; r.on('data',c=>ch.push(c)); r.on('end',()=>res({status:r.statusCode,text:Buffer.concat(ch).toString('utf8')})); });
    req.on('error',rej); req.setTimeout(timeoutMs||300000,()=>req.destroy(new Error('тайм-аут ответа'))); req.end(data); }); }

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function chat(model,messages,opts){ opts=opts||{};
  const body={model,messages,temperature:opts.temperature==null?0:opts.temperature,max_tokens:opts.max_tokens||16000,usage:{include:true}};
  if(opts.seed!=null) body.seed=opts.seed;
  if(opts.reasoning) body.reasoning=opts.reasoning;
  let lastErr='';
  for(let k=0;k<6;k++){ if(k) await sleep(2000*2**(k-1));
    const t0=Date.now(); let r;
    try{ r=await post(ENDPOINT,body,opts.timeoutMs); }catch(e){ lastErr='сеть: '+e.message; continue; }
    let j; try{ j=JSON.parse(r.text); }catch(e){ lastErr='HTTP '+r.status+': '+r.text.slice(0,200); if(r.status>=500||r.status===429) continue; break; }
    if(r.status===429||r.status>=500||(j.error&&/rate|overload|timeout|unavailable|provider returned error/i.test(JSON.stringify(j.error)))){ lastErr='HTTP '+r.status+': '+JSON.stringify(j.error||j).slice(0,300); continue; }
    if(j.error) throw new Error('OpenRouter: '+JSON.stringify(j.error).slice(0,400));
    const ch=(j.choices||[])[0]||{}, u=j.usage||{};
    if(!ch.message){ lastErr='нет choices: '+r.text.slice(0,200); continue; }
    return {text:ch.message.content||'',finish:ch.finish_reason,raw_model:j.model,provider:j.provider,ms:Date.now()-t0,
      usage:{prompt:u.prompt_tokens||0,completion:u.completion_tokens||0,reasoning:(u.completion_tokens_details||{}).reasoning_tokens||0,cost:u.cost||0}}; }
  throw new Error('LLM недоступна: '+lastErr); }

module.exports={chat,ENDPOINT};
