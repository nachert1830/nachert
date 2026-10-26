/* Официальный вход Telegram (oauth.telegram.org): подпись HMAC(SHA-256(токен бота)), свежесть 10 минут, один раз, приглашения. */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), crypto=require('crypto');
const {club}=require('./helpers');
/* так подписывает Telegram: строки «ключ=значение» по алфавиту через \n, ключ — SHA-256 токена бота */
function signed(d,token){ const dcs=Object.keys(d).sort().map(k=>k+'='+d[k]).join('\n');
  return Object.assign({},d,{hash:crypto.createHmac('sha256',crypto.createHash('sha256').update(token||'777000:TEST-token').digest()).update(dcs).digest('hex')}); }
const auth=(c,d,o)=>c.call('POST','/api/auth/telegram',Object.assign({data:d},o||{}),{as:'b'});
const now=c=>Math.floor(c.clock.t/1000);

test('официальный Telegram: подпись проверяется, владелец входит, «Войти как …?» и одна сессия',async()=>{
  const c=club(); const d=signed({id:1000001,first_name:'Андрей',last_name:'М',username:'andrew',photo_url:'https://t.me/i/userpic/320/x.jpg',auth_date:now(c)});
  const r=await auth(c,d); assert.equal(r.status,200); assert.match(r.data.token,/^[A-Za-z0-9_-]{32}$/);
  const peek=await c.call('POST','/api/auth/bot/redeem',{token:r.data.token},{as:'b'}); assert.deepEqual(peek.data,{name:'Андрей',member:false,method:'telegram'});
  const ok=await c.call('POST','/api/auth/bot/redeem',{token:r.data.token,confirm:true,consent:c.consent},{as:'b'}); assert.equal(ok.status,200); assert.equal(ok.data.user.role,'admin');
  const u=await c.store.get('users',ok.data.user.id); assert.equal(u.tgId,'1000001'); assert.ok(!JSON.stringify(u).includes('andrew')&&!JSON.stringify(u).includes('userpic'),'username и фото не хранятся');
  assert.equal((await auth(c,d)).status,410,'та же подпись второй раз — нет');
});

test('официальный Telegram: подделка, чужой токен, устаревшее подтверждение и мусор — отказ',async()=>{
  const c=club(); const d=signed({id:1000001,first_name:'Андрей',auth_date:now(c)});
  assert.equal((await auth(c,Object.assign({},d,{id:1000002}))).status,400,'поменяли id — подпись не сходится');
  assert.equal((await auth(c,Object.assign({},d,{first_name:'Админ'}))).status,400);
  assert.equal((await auth(c,signed({id:1000001,first_name:'А',auth_date:now(c)},'999:OTHER-token'))).status,400,'подпись другим ботом');
  assert.equal((await auth(c,signed({id:1000001,first_name:'А',auth_date:now(c)-11*60}))).status,410,'старше 10 минут');
  assert.equal((await auth(c,signed({id:1000001,first_name:'А',auth_date:now(c)+600}))).status,410,'из будущего');
  for(const bad of [null,'x',[],{id:1},{hash:'zz'},signed({id:'1; drop',first_name:'А',auth_date:now(c)})]) assert.equal((await auth(c,bad)).status,400);
  const logs=await c.store.scan('loginlog'); assert.ok(logs.some(l=>/подпись/.test(l.reason)));
});

test('официальный Telegram: новый участник — только по приглашению; участник потом входит без него',async()=>{
  const c=club(); await c.owner();
  const no=await auth(c,signed({id:4242,first_name:'Аня',auth_date:now(c)})); assert.equal(no.status,403); assert.equal(no.data.needInvite,true);
  const code=await c.invite();
  const r=await auth(c,signed({id:4242,first_name:'Аня',auth_date:now(c)+1}),{invite:code}); assert.equal(r.status,200);
  const ok=await c.call('POST','/api/auth/bot/redeem',{token:r.data.token,confirm:true,consent:c.consent},{as:'anya'}); assert.equal(ok.data.isNew,true);
  const again=await auth(c,signed({id:4242,first_name:'Аня',auth_date:now(c)+2})); assert.equal(again.status,200,'теперь без приглашения');
  const cfg=(await c.call('GET','/api/config')).data; assert.equal(cfg.tgLogin,null,'в тестовом клубе адрес входа не задан — кнопка ведёт к боту');
});
