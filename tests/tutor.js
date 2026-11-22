/* ═══════════ Наставник — ИИ-агент на чертеже ИГ ДЗ №4 (lk/tutor.js + server/lib/tutor, docs/TUTOR.md) ═══════════
   1) пакет знаний сервера (server/lib/tutor/ig4.json) совпадает с решением, которое строит сайт (варианты 3, 7, 19 и методика):
      поменяли решатель и не пересобрали пакет (node tools/tutor-pack.js) — красная проверка;
   2) настоящий сервер кабинета (база в памяти) и сайт на своих адресах, модель — поддельная (сценарий ниже):
      гость → «Войди»; вошёл → согласие на зарубежную модель → вопрос → наставник САМ открывает шаг 5 плеера решения;
      вторая просьба — подсвечены точки 9 и 12 на всех видах; «шаг N» в ответе — ссылка; фото листа уходит с эталоном;
   3) телефон: без горизонтальной прокрутки, окно помещается, после показа шага окно уступает место чертежу; без ошибок JS.
   node tests/tutor.js — отдельно; в node tests/run.js — блок tutor. */
const http=require('http'), fs=require('fs'), path=require('path'), ROOT=path.join(__dirname,'..');
const {createApp}=require(ROOT+'/server/lib/app'), {memoryStore}=require(ROOT+'/server/lib/store/memory'), {botClient}=require(ROOT+'/server/lib/telegram'), {fromEvent}=require(ROOT+'/server/lib/http');
const TUTOR=require(ROOT+'/server/lib/tutor'), PACK=require(ROOT+'/tools/tutor-pack.js');
const TY={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
const listen=srv=>new Promise(res=>srv.listen(0,'127.0.0.1',()=>res('http://127.0.0.1:'+srv.address().port)));

/* поддельная модель: по последнему сообщению студента и результатам инструментов */
function fakeModel(log){ return async(url,o)=>{ if(!/proxyapi\.ru/.test(url)) return {ok:false,status:404,text:async()=>'{}',json:async()=>({})};
  const b=JSON.parse(o.body); log.push(b); const ms=b.messages, last=ms[ms.length-1], user=[...ms].reverse().find(m=>m.role==='user');
  const ok=j=>({ok:true,status:200,text:async()=>JSON.stringify(j),json:async()=>j});
  const say=t=>ok({choices:[{message:{role:'assistant',content:t},finish_reason:'stop'}],usage:{prompt_tokens:5000,completion_tokens:200}});
  const call=(name,args)=>ok({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'c'+log.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:4000,completion_tokens:50}});
  /* глаза */
  if(Array.isArray(ms[1]&&ms[1].content)) return say('{"readable":true,"findings":[{"point":9,"view":"top","problem":"9′ ближе к оси"}],"overall":"почти верно"}');
  const tools=ms.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content)), lastTool=last.role==='tool'?JSON.parse(last.content):null;
  if(/лист/.test(user.content||'')){ if(!tools.length) return call('look_at_photo',{}); if(tools.length===1) return call('show_on_drawing',{k:5,points:[9]}); return say('Похоже, точка 9′ стоит ближе к оси. Проверь засечку на шаге 5.'); }
  if(!tools.length) return call('get_step',{k:5,depth:'full'});
  if(tools.length===1) return call('show_on_drawing',{k:5,points:[9,12]});
  return say(lastTool.highlighted&&lastTool.highlighted.length?'Подсветил точки 9 и 12 — найди 9′ на виде сверху.':'Это шаг 5: переносим точки выреза K на другие виды. С какой точки начнёшь?'); }; }

async function runTutor(browser){
  const bad=[], B=(rule,msg)=>bad.push({name:'Наставник',rule,msg:String(msg)}), errs=[];
  /* 1) пакет знаний = решение сайта */
  { const p=await browser.newPage(); const srv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html'; const fp=path.join(ROOT,f);
      if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200,{'Content-Type':TY[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(r); });
    const U=await listen(srv); await p.goto(U+'/#/ig4/7'); await p.waitForFunction(()=>window.IG4S&&window.DZR&&DZR.get('ig4'),null,{timeout:30000});
    const snap=await PACK.build(p,[3,7,19]), file=JSON.parse(fs.readFileSync(PACK.OUT,'utf8'));
    for(const n of [3,7,19]) if(JSON.stringify(snap.variants[n])!==JSON.stringify(file.variants[n])) B('пакет знаний устарел','вариант '+n+': решение на сайте поменялось — пересоберите: node tools/tutor-pack.js');
    if(JSON.stringify(snap.method)!==JSON.stringify(file.method)) B('пакет знаний устарел','методика ДЗ №4 поменялась — node tools/tutor-pack.js');
    await p.close(); srv.close(); }

  /* 2) сайт + настоящий сервер кабинета + поддельная модель */
  const store=memoryStore(null), mlog=[]; let API='', SITE='';
  const apiSrv=http.createServer((q,r)=>{ let body=''; q.on('data',c=>body+=c); q.on('end',async()=>{ const u=new URL(q.url,'http://x'), headers={};
    for(let i=0;i<q.rawHeaders.length;i+=2) headers[q.rawHeaders[i]]=q.rawHeaders[i+1];
    const res=await app.handle(fromEvent({httpMethod:q.method,path:u.pathname,url:u.pathname+u.search,headers,queryStringParameters:Object.fromEntries(u.searchParams),body,isBase64Encoded:false,requestContext:{identity:{sourceIp:'127.0.0.1'}}}));
    r.writeHead(res.statusCode,res.headers); r.end(res.body); }); });
  const siteSrv=http.createServer((q,r)=>{ let f=decodeURIComponent(q.url.split('?')[0]); if(f.endsWith('/')) f+='index.html';
    if(f==='/lk/config.js'){ r.writeHead(200,{'Content-Type':TY['.js']}); return r.end("window.CLUB_API='"+API+"';"); }
    const p=path.join(ROOT,f); if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
    let b=fs.readFileSync(p); if(f==='/index.html') b=Buffer.from(b.toString().replace("connect-src 'self'","connect-src 'self' "+API));
    r.writeHead(200,{'Content-Type':TY[path.extname(p)]||'application/octet-stream'}); r.end(b); });
  API=await listen(apiSrv); SITE=await listen(siteSrv);
  const cfg={dev:true,origin:API,secure:false,botToken:'1:x',botName:'b',webhookSecret:'s',adminTg:['1000001'],mainUrl:SITE,week1:'',yandex:{clientId:'',secret:''},adminYa:[],fronts:[API,SITE],frontUrl:SITE+'/lk/',openSignup:true,
    tutor:TUTOR.fromEnv({PROXYAPI_KEY:'px-test'})};
  const app=createApp({cfg,store,log:{log(){},error(){}},bot:botClient({dev:true,outbox:[]}),fetch:fakeModel(mlog)});
  async function session(id,name){ const act=await app.onUpdate({message:{from:{id,first_name:name},chat:{id},text:'/start login'}}); const t=act.reply_markup.inline_keyboard[0][0].url.split('#/tg/')[1];
    const res=await app.handle({method:'POST',path:'/api/auth/bot/redeem',query:{},headers:{origin:SITE,'content-type':'application/json'},body:JSON.stringify({token:t,confirm:true,consent:{terms:true,pd:true}}),ip:'127.0.0.1',cookies:{}});
    return JSON.parse(res.body).session; }
  const ctxs=[], page=async(o,who)=>{ const c=await browser.newContext(o); ctxs.push(c); await c.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort()); const p=await c.newPage(); p.on('pageerror',e=>errs.push(who+': '+e.message)); return p; };
  try{
    const st=await session(3003,'Аня');
    /* гость */
    const g=await page({viewport:{width:1280,height:860}},'гость'); await g.goto(SITE+'/#/ig4/7'); await g.waitForSelector('.tu-fab:not([hidden])',{timeout:15000}).catch(()=>B('кнопка наставника на ИГ №4','нет'));
    await g.click('.tu-fab'); if(!/Войди/.test(await g.textContent('.tu-b').catch(()=>''))) B('гость: предложение войти',await g.textContent('.tu-b').catch(()=>''));
    await g.goto(SITE+'/#/ng3/8'); await g.waitForTimeout(400); if(await g.$('.tu-fab:not([hidden])')) B('кнопка — только на ИГ №4','видна на #/ng3/8');
    /* студент: согласие → вопрос → шаг 5 открыт сам */
    const pg=await page({viewport:{width:1280,height:860}},'студент'); await pg.goto(SITE+'/#/ig4/7'); await pg.evaluate(t=>localStorage.setItem('lk_tok',t),st); await pg.reload();
    await pg.waitForSelector('.tu-fab:not([hidden])',{timeout:15000}); await pg.click('.tu-fab');
    await pg.waitForSelector('[data-consent]',{timeout:8000}).catch(()=>B('согласие на зарубежную модель','нет экрана согласия'));
    if(!/Имя, почта, группа/.test(await pg.textContent('.tu-b').catch(()=>''))) B('согласие: что не уходит модели','нет объяснения');
    await pg.click('[data-consent]'); await pg.waitForSelector('[data-in]:visible',{timeout:5000});
    if(!(await store.scan('users',u=>u.consent&&u.consent.ai)).length) B('согласие сохранено','нет consent.ai');
    await pg.fill('[data-in]','Не понимаю шаг 5'); await pg.press('[data-in]','Enter');
    await pg.waitForSelector('.tu-m.t',{timeout:15000}).catch(()=>B('ответ наставника','нет'));
    const cur=await pg.waitForFunction(()=>window.IG4S&&IG4S.player&&IG4S.player.current()===5&&document.querySelector('#igbPic svg'),null,{timeout:60000}).then(()=>5).catch(()=>pg.evaluate(()=>window.IG4S&&IG4S.player&&IG4S.player.current()));
    if(cur!==5) B('наставник открыл шаг 5 плеера','шаг '+cur);
    if(!/Шаг 5 на чертеже/.test(await pg.textContent('.tu-m.t .tu-x').catch(()=>''))) B('кнопка «Шаг 5 на чертеже»','нет');
    if(!await pg.$('.tu-m.t .tu-st[data-step="5"]')) B('«шаг 5» в ответе — ссылка на чертёж','нет');
    if(!/сверено/.test(await pg.textContent('.tu-m.t .tu-x').catch(()=>''))) B('отметка «сверено»','нет');
    const sent=mlog.find(b=>b.tools); if(!sent||!/Сейчас у студента на экране|вариант 7/.test(sent.messages[0].content)) B('контекст варианта — модели','нет');
    if(JSON.stringify(mlog).includes('Аня')) B('имя студента не уходит модели','ушло');
    /* вторая просьба: точки подсвечены */
    await pg.fill('[data-in]','Всё равно не понял'); await pg.press('[data-in]','Enter');
    await pg.waitForFunction(()=>document.querySelectorAll('.tu-m.t').length===2,null,{timeout:15000}).catch(()=>B('второй ответ','нет'));
    const hl=await pg.waitForFunction(()=>document.querySelectorAll('#igbPic svg circle[fill="#ffd23f"]').length>=4,null,{timeout:10000}).then(()=>true).catch(()=>false);
    if(!hl) B('подсветка точек 9 и 12 на чертеже',await pg.evaluate(()=>document.querySelectorAll('#igbPic svg circle[fill="#ffd23f"]').length));
    /* ссылка «шаг 5» снова открывает шаг */
    await pg.evaluate(()=>IG4S.player.go(1)); await pg.click('.tu-m.t .tu-st[data-step="5"]'); await pg.waitForTimeout(300);
    if(await pg.evaluate(()=>IG4S.player.current())!==5) B('ссылка «шаг 5» в ответе','не открыла шаг');
    /* фото листа: уходит с эталоном */
    await pg.setInputFiles('[data-file]',path.join(ROOT,'og.jpg')); await pg.waitForSelector('[data-pv] img',{timeout:5000});
    await pg.fill('[data-in]','Проверь мой лист'); await pg.press('[data-in]','Enter');
    await pg.waitForFunction(()=>document.querySelectorAll('.tu-m.t').length===3,null,{timeout:30000}).catch(()=>B('ответ по фото','нет'));
    const eyes=mlog.find(b=>Array.isArray(b.messages[1]&&b.messages[1].content));
    if(!eyes) B('фото ушло глазам','нет'); else { const imgs=eyes.messages[1].content.filter(c=>c.type==='image_url').map(c=>c.image_url.url);
      if(imgs.length!==2||!imgs.every(u=>/^data:image\/jpeg;base64,/.test(u))) B('фото и эталон — два JPEG',imgs.map(u=>u.slice(0,30)).join(' / '));
      else if(imgs[1].length<20000) B('эталон нарисован','слишком маленький: '+imgs[1].length); }
    if(!/9′/.test(await pg.textContent('.tu-m.t:last-of-type .tu-bb').catch(()=>''))) B('ответ по фото называет точку','нет');
    /* история после перезагрузки */
    await pg.reload(); await pg.waitForSelector('.tu-fab:not([hidden])',{timeout:15000}); await pg.click('.tu-fab'); await pg.waitForFunction(()=>document.querySelectorAll('.tu-m.t').length===3,null,{timeout:8000}).catch(()=>B('история разговора после перезагрузки','нет'));
    /* 3) телефон */
    const ph=await page({viewport:{width:390,height:844},isMobile:true,hasTouch:true},'телефон'); await ph.goto(SITE+'/#/ig4/7'); await ph.evaluate(t=>localStorage.setItem('lk_tok',t),st); await ph.reload();
    await ph.waitForSelector('.tu-fab:not([hidden])',{timeout:15000}); await ph.click('.tu-fab'); await ph.waitForSelector('.tu-m.t',{timeout:8000});
    const geo=await ph.evaluate(()=>{ const b=document.querySelector('.tu').getBoundingClientRect(); return {sw:document.documentElement.scrollWidth,w:innerWidth,l:b.left,r:b.right,t:b.top}; });
    if(geo.sw>geo.w+1) B('телефон: без горизонтальной прокрутки',geo.sw+' > '+geo.w); if(geo.l<0||geo.r>geo.w+1||geo.t<0) B('телефон: окно помещается',JSON.stringify(geo));
    await ph.click('.tu-m.t .tu-x [data-act]'); await ph.waitForFunction(()=>document.querySelector('.tu').hidden&&IG4S.player&&IG4S.player.current()===5,null,{timeout:60000}).catch(()=>B('телефон: окно уступает место чертежу','нет'));
    if(errs.length) B('ошибки JS',errs.slice(0,3).join(' / '));
  } finally { for(const c of ctxs) await c.close().catch(()=>{}); apiSrv.close(); siteSrv.close(); }
  return bad; }
module.exports={runTutor};

if(require.main===module)(async()=>{ let chromium; try{ ({chromium}=require('playwright')); }catch(e){ ({chromium}=require('/opt/node-tools/node_modules/playwright')); }
  const browser=await chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined}).catch(()=>chromium.launch());
  const bad=await runTutor(browser); bad.forEach(b=>console.log(b.name+' | '+b.rule+' | '+b.msg)); console.log('Наставник: замечаний '+bad.length);
  await browser.close(); process.exit(bad.length?1:0); })();
