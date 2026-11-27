/* ═══ Лука — журнал для дообучения заготовок (new/luka.js, docs/LUKA.md) ═══
   Лука отвечает в браузере по заготовкам; что он не понял (вопрос без заготовки) и что студенту не помогло (👎) —
   сюда, без имени и аккаунта: место (ДЗ:вариант:шаг или задача:шаг), текст вопроса (почта и телефоны вырезаются), уверенность.
   POST /api/luka/miss — любой посетитель (лимит по адресу); GET /api/luka/inbox — только с ключом x-luka-key
   (ключ — LUKA_KEY из секретов репозитория или его SHA-256 — LUKA_KEY_SHA256; сервер сравнивает хэши). Его читает ежедневная сессия, которая дописывает заготовки.
   Таблица lukamiss, хранится 90 дней. */
'use strict';
const crypto=require('crypto');
const DAY=864e5, Q_MAX=300;
const SRC_RE=/^[a-z0-9:._-]{1,48}$/i;
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq=(a,b)=>{ const x=Buffer.from(String(a)), y=Buffer.from(String(b)); return x.length===y.length&&crypto.timingSafeEqual(x,y); };
const scrub=s=>String(s||'').replace(/\u0000/g,'').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,'[почта]').replace(/\+?\d[\d\s()-]{8,}\d/g,'[номер]').replace(/\s+/g,' ').trim().slice(0,Q_MAX);
function fromEnv(env){ env=env||process.env; const k=String(env.LUKA_KEY||'').trim(); return {keySha:k?sha(k):String(env.LUKA_KEY_SHA256||'').trim().toLowerCase()}; }
function register(R,deps){ const {store,now,fail,body,json,limit}=deps, cfg=()=>deps.cfg||{};
  R['POST /api/luka/miss']=async req=>{ const b=body(req)||{}, kind=['miss','down','up'].includes(b.kind)?b.kind:'miss', src=String(b.src||'');
    if(!SRC_RE.test(src)) fail(400,'Неверное место вопроса.');
    const q=scrub(b.q); if(kind==='miss'&&q.length<2) fail(400,'Пустой вопрос.');
    await limit('luka',String(req.ip||'?'),60,3600);
    const t=now(); await store.put('lukamiss',{id:new Date(t).toISOString()+'#'+crypto.randomBytes(3).toString('hex'),ts:t,src,kind,q,
      rid:String(b.rid||'').replace(/[^\wа-яё:«»() .-]/gi,'').slice(0,80),conf:Math.max(0,Math.min(100,parseInt(b.conf,10)||0))});
    return json(200,{ok:true}); };
  R['GET /api/luka/inbox']=async req=>{ const want=cfg().keySha, k=String(req.headers['x-luka-key']||'');
    if(!want||!k||!safeEq(sha(k),want)) fail(403,'Нет доступа.');
    const days=Math.min(90,Math.max(1,parseInt((req.query||{}).days,10)||2)), t=now();
    const l=(await store.scan('lukamiss',x=>x.ts>t-days*DAY)).sort((a,b)=>a.ts-b.ts).slice(-3000);
    return json(200,{days,items:l.map(x=>({ts:x.ts,src:x.src,kind:x.kind,q:x.q,rid:x.rid,conf:x.conf}))}); };
}
module.exports={register,fromEnv,scrub,DAYS:90};
