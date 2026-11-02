/* ═══════════ Бета оцифровки листа: локальный сервер (без зависимостей) ═══════════
   PROXYAPI_KEY=… node lab/dz/beta-server.js [--port=8787] [--host=127.0.0.1] [--limit=3]
   Открыть http://127.0.0.1:8787/ — страница lk/scan/ (так же она лежит на сайте по прямой ссылке): фото листа → раскладка → оцифровка каждого чертежа → цифровая копия.
   Сервер делает три вещи: раздаёт lab/ и core/ (без lab/private и lab/photos), держит ключ ProxyAPI (в страницу он не попадает)
   и проксирует POST /api/eyes (режимы layout и crop, как у кабинета: server/lib/app.js) моделям Claude через ProxyAPI.
   Фото нигде не сохраняется. Потолок расходов --limit ($, по токенам ответа): дальше сервер отвечает 429.
   Открывать наружу (--host=0.0.0.0) только с паролем: BETA_PASSWORD=… — страница спросит его один раз (заголовок x-beta-password). */
'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), EYES=require('../../server/lib/eyes.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('='))), PORT=+(A.port||process.env.PORT||8787), HOST=A.host||'127.0.0.1', LIMIT=+(A.limit||process.env.BETA_LIMIT||3), PASS=process.env.BETA_PASSWORD||'';
const ROOT=path.join(__dirname,'..','..'), KEY=process.env.PROXYAPI_KEY||'';
const MOCK=A.mock?JSON.parse(fs.readFileSync(path.join(A.mock,'mock.json'),'utf8')):null;
if(!KEY&&!MOCK){ console.error('Нужен ключ: PROXYAPI_KEY=… node lab/dz/beta-server.js'); process.exit(2); }
if(HOST!=='127.0.0.1'&&HOST!=='localhost'&&!PASS){ console.error('Наружу — только с паролем: BETA_PASSWORD=…'); process.exit(2); }
const cfg=EYES.eyesFromEnv({PROXYAPI_KEY:KEY||'mock'});
const PRICE=m=>/haiku/.test(m)?[1e-6,5e-6]:[3e-6,15e-6];   /* $ за токен: оценка сверху, ProxyAPI считает в рублях */
let spent=0, calls=0;
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon'};
let ORIGIN=null;   /* Origin текущего запроса, если он разрешён: страница на сайте (lk/scan) ходит сюда с компьютера владельца */
const ALLOWED=/^https?:\/\/((www\.)?nachert1830\.ru|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/;
const send=(res,code,body,type)=>{ res.writeHead(code,Object.assign(ORIGIN?{'access-control-allow-origin':ORIGIN,'vary':'Origin','access-control-allow-private-network':'true'}:{},{'content-type':type||'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'})); res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body)); };
const okPass=req=>!PASS||req.headers['x-beta-password']===PASS;
function readBody(req,max){ return new Promise((ok,bad)=>{ let n=0; const a=[]; req.on('data',c=>{ n+=c.length; if(n>max){ bad(Object.assign(new Error('Слишком большой запрос'),{status:413})); req.destroy(); } else a.push(c); }); req.on('end',()=>ok(Buffer.concat(a).toString('utf8'))); req.on('error',bad); }); }

async function eyes(req,res){
  if(!okPass(req)) return send(res,401,{ok:false,error:'Нужен пароль беты'});
  if(spent>=LIMIT) return send(res,429,{ok:false,error:'Потолок расходов беты исчерпан ($'+LIMIT+'). Перезапустите сервер с --limit=…'});
  let b; try{ b=JSON.parse(await readBody(req,6*1024*1024)); }catch(e){ return send(res,e.status||400,{ok:false,error:e.status===413?e.message:'Нужен JSON'}); }
  const img=String(b.img||''), w=Math.round(+b.w)||0, h=Math.round(+b.h)||0, mode=b.mode;
  if(!['layout','crop'].includes(mode)) return send(res,400,{ok:false,error:'Режим: layout или crop'});
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/]+=*$/.test(img)) return send(res,400,{ok:false,error:'Нужно фото (JPEG, PNG или WebP)'});
  if(!(w>=200&&h>=200&&w<=4096&&h<=4096)) return send(res,400,{ok:false,error:'Размер кадра — от 200 до 4096 px'});
  if(MOCK){ /* проверка без расходов: ответы заранее сохранены ({layout:текст, crops:[{w,h,text}]}), кадр сопоставляется по размеру */
    let text=null; if(mode==='layout') text=MOCK.layout; else { const c=MOCK.crops.filter(x=>!x.used).sort((x,y)=>Math.abs(x.w-w)+Math.abs(x.h-h)-Math.abs(y.w-w)-Math.abs(y.h-h))[0]; if(c&&Math.abs(c.w-w)+Math.abs(c.h-h)<=12){ c.used=true; text=c.text; } }
    if(text==null) return send(res,404,{ok:false,error:'мок: нет ответа для кадра '+w+'×'+h}); calls++; return send(res,200,{ok:true,text,model:'mock',mode,usage:{in:0,out:0},cost:0,spent:0,limit:LIMIT}); }
  try{ const q={image:img,w,h,consent:true}, r=mode==='layout'?await EYES.askLayout(cfg,q,{}):await EYES.askCrop(cfg,q,{});
    const u=(r.info&&r.info.usage)||{}, pr=PRICE(r.model||''), cost=(u.prompt_tokens||0)*pr[0]+(u.completion_tokens||0)*pr[1]; spent+=cost; calls++;
    console.log(new Date().toISOString().slice(11,19),mode,r.model.split('/').pop(),(u.prompt_tokens||'?')+'→'+(u.completion_tokens||'?'),'≈ $'+cost.toFixed(4),'всего $'+spent.toFixed(3));
    send(res,200,{ok:true,text:r.text,model:r.model,mode,usage:{in:u.prompt_tokens||0,out:u.completion_tokens||0},cost:+cost.toFixed(5),spent:+spent.toFixed(4),limit:LIMIT}); }
  catch(e){ console.error('ошибка модели:',String(e&&e.message||e).slice(0,200)); send(res,e&&e.status&&e.status<600?e.status:502,{ok:false,error:String(e&&e.message||'Модель не ответила').slice(0,200)}); } }

http.createServer(async(req,res)=>{ try{
  const u=new URL(req.url,'http://x'), p=decodeURIComponent(u.pathname); const og=req.headers.origin; ORIGIN=og&&ALLOWED.test(og)?og:null;
  if(req.method==='OPTIONS'){ if(!ORIGIN) return send(res,403,{ok:false,error:'Этот адрес страницы не разрешён'}); res.writeHead(204,{'access-control-allow-origin':ORIGIN,'vary':'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-beta-password','access-control-allow-private-network':'true','access-control-max-age':'600'}); return res.end(); }
  if(og&&!ORIGIN&&p.startsWith('/api/')) return send(res,403,{ok:false,error:'Этот адрес страницы не разрешён'});
  if(req.method==='POST'&&p==='/api/eyes') return eyes(req,res);
  if(req.method==='GET'&&p==='/api/status') return send(res,200,{ok:true,beta:true,passwordNeeded:!!PASS,spent:+spent.toFixed(4),limit:LIMIT,calls,layout:cfg.layout&&cfg.layout.model,digit:cfg.digit&&cfg.digit.model});
  if(req.method!=='GET'&&req.method!=='HEAD') return send(res,405,{ok:false,error:'Только GET и POST /api/eyes'});
  if(p==='/') { res.writeHead(302,{location:'/lk/scan/'}); return res.end(); }
  /* статика: только lab/ и core/, без служебного и личного */
  const rel=path.normalize(p).replace(/^[\\/]+/,''); if(!/^(lab|core)[\\/]|^lk[\\/]scan[\\/]/.test(rel)||/(^|[\\/])(private|photos|node_modules|\.git)([\\/]|$)/.test(rel)||rel.includes('..')) return send(res,404,'не найдено','text/plain; charset=utf-8');
  let f=path.join(ROOT,rel); if(fs.existsSync(f)&&fs.statSync(f).isDirectory()) f=path.join(f,'index.html');
  if(!fs.existsSync(f)) return send(res,404,'не найдено','text/plain; charset=utf-8');
  send(res,200,fs.readFileSync(f),MIME[path.extname(f)]||'application/octet-stream');
}catch(e){ send(res,500,{ok:false,error:'Ошибка сервера'}); } }).listen(PORT,HOST,()=>{ console.log('Бета оцифровки: http://'+(HOST==='0.0.0.0'?'localhost':HOST)+':'+PORT+'/  (потолок $'+LIMIT+', модели: '+(cfg.layout&&cfg.layout.model)+' + '+(cfg.digit&&cfg.digit.model)+')'); });
