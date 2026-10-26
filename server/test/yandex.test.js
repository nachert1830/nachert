/* Вход через Яндекс ID, привязка второго способа входа и страница клуба на nachert1830.ru (CORS + токен в заголовке). */
'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {club}=require('./helpers');
const ANYA={id:'2001',login:'anya.ya',first_name:'Аня',last_name:'Иванова',display_name:'anya',sex:'female'};

test('Яндекс ID: без приглашения — отказ, по приглашению — регистрация; хранится только id и имя, токен Яндекса отозван',async()=>{
  const c=club(); await c.owner();
  const no=await c.yandex(ANYA); assert.equal(no.step,'callback'); assert.match(no.location,/#\/oops\/noinvite$/);
  const auth=new URL(no.authorize); assert.equal(auth.searchParams.get('client_id'),'ya-client'); assert.equal(auth.searchParams.get('redirect_uri'),'http://localhost:8787/api/auth/yandex/callback');
  assert.equal(auth.searchParams.get('scope'),null,'доступы — только те, что заданы в приложении (логин и имя)');
  const code=await c.invite();
  const r=await c.yandex(ANYA,{invite:code}); assert.equal(r.status,200); assert.equal(r.data.isNew,true); assert.equal(r.data.user.name,'Аня'); assert.equal(r.data.user.yandex,true);
  assert.match(r.data.session,/^[A-Za-z0-9_-]{40,}$/,'токен сессии — в ответе, для страницы на nachert1830.ru');
  const u=await c.store.get('users',r.data.user.id);
  assert.deepEqual(Object.keys(u).sort(),['consent','createdAt','em','id','invite','lastLogin','method','name','reminders','role','tgId','ya']);
  assert.equal(u.method,'yandex'); assert.equal(u.tgId,null); assert.ok(!JSON.stringify(u).includes('anya.ya')&&!JSON.stringify(u).includes('Иванова'),'логин и фамилия не хранятся');
  assert.ok(await c.store.get('identities','ya:2001'));
  assert.ok(c.ya.calls.some(x=>x.url==='https://oauth.yandex.ru/revoke_token'),'токен Яндекса отозван сразу');
  const again=await c.yandex(ANYA); assert.equal(again.status,200); assert.equal(again.data.isNew,false,'потом — без приглашения');
  assert.equal((await c.yandex({id:'2002',first_name:'Боб'},{invite:code})).location.endsWith('#/oops/invite'),true,'приглашение одноразовое');
});

test('Яндекс ID: владелец по логину из ADMIN_YA_LOGINS; state одноразовый и на 10 минут; отказ и сбой Яндекса — понятная ошибка',async()=>{
  const c=club();
  const o=await c.yandex({id:'3001',login:'Owner.Ya',first_name:'Андрей'}); assert.equal(o.status,200); assert.equal(o.data.user.role,'admin');
  const st=await c.call('GET','/api/auth/yandex/start?ret='+encodeURIComponent('http://localhost:8787/')+'&s=clientstate-1234567890',undefined,{as:'b'});
  const state=new URL(st.raw.headers.Location).searchParams.get('state'); c.ya.codes.K1={id:'3001',login:'owner.ya'};
  c.clock.t+=11*60e3;
  assert.match((await c.call('GET','/api/auth/yandex/callback?code=K1&state='+state,undefined,{as:'b'})).raw.headers.Location,/#\/oops\/state$/,'через 10 минут state устарел');
  const st2=await c.call('GET','/api/auth/yandex/start?ret='+encodeURIComponent('http://localhost:8787/')+'&s=clientstate-1234567890',undefined,{as:'b'});
  const s2=new URL(st2.raw.headers.Location).searchParams.get('state');
  assert.match((await c.call('GET','/api/auth/yandex/callback?code=K1&state='+s2,undefined,{as:'b'})).raw.headers.Location,/#\/ya\//);
  assert.match((await c.call('GET','/api/auth/yandex/callback?code=K1&state='+s2,undefined,{as:'b'})).raw.headers.Location,/#\/oops\/state$/,'state один раз');
  assert.match((await c.yandex(ANYA,{deny:true})).location,/#\/oops\/denied$/);
  c.ya.down=true; assert.match((await c.yandex({id:'3001',login:'owner.ya'})).location,/#\/oops\/fail$/);
});

test('Яндекс ID: возврат — только на страницы клуба; чужой адрес заменяется адресом клуба',async()=>{
  const c=club(); await c.owner();
  const evil=await c.call('GET','/api/auth/yandex/start?ret='+encodeURIComponent('https://evil.example/')+'&s=clientstate-1234567890',undefined,{as:'b'});
  const state=new URL(evil.raw.headers.Location).searchParams.get('state'); c.ya.codes.E={id:'4001',first_name:'X'};
  assert.match((await c.call('GET','/api/auth/yandex/callback?code=E&state='+state,undefined,{as:'b'})).raw.headers.Location,/^http:\/\/localhost:8787\/#/);
  const site=await c.yandex({id:'3001',login:'owner.ya'},{ret:'https://nachert1830.ru/lk/',noRedeem:true});
  assert.match(site.location,/^https:\/\/nachert1830\.ru\/lk\/#\/ya\/[A-Za-z0-9_-]+\/clientstate-1234567890$/);
  const bad=await c.call('GET','/api/auth/yandex/start?ret=x&s=short',undefined,{as:'b'}); assert.match(bad.raw.headers.Location,/#\/oops\/state$/);
});

test('привязка: Яндекс ID к аккаунту из Telegram и Telegram к аккаунту из Яндекса; подтверждает только браузер того же аккаунта',async()=>{
  const c=club(); const o=await c.owner();
  const l=await c.call('POST','/api/me/link',{to:'yandex',ret:'http://localhost:8787/',s:'clientstate-1234567890'},{as:'owner'}); assert.equal(l.status,200);
  const link=new URL(l.data.url).searchParams.get('link');
  const r=await c.yandex({id:'3001',login:'someone',first_name:'Андрей'},{link}); const m1=/#\/link\/([A-Za-z0-9_-]+)\/clientstate-1234567890$/.exec(r.location); assert.ok(m1,r.location);
  assert.equal((await c.call('GET','/api/me',undefined,{as:'owner'})).data.user.yandex,false,'без подтверждения в браузере владельца — не привязано');
  const ok1=await c.call('POST','/api/me/link/confirm',{token:m1[1]},{as:'owner'}); assert.equal(ok1.status,200); assert.equal(ok1.data.linked,'yandex');
  const me=await c.call('GET','/api/me',undefined,{as:'owner'}); assert.equal(me.data.user.yandex,true); assert.equal(me.data.user.telegram,true);
  const viaYa=await c.yandex({id:'3001',first_name:'Андрей'}); assert.equal(viaYa.data.user.id,o.data.user.id,'теперь входит и через Яндекс в тот же аккаунт');
  const code=await c.invite(); const m=await c.yandex(ANYA,{invite:code,who:'anya'});
  const lt=await c.call('POST','/api/me/link',{to:'telegram'},{as:'anya'}); assert.match(lt.data.url,/^https:\/\/t\.me\/club_bot\?start=l_[A-Za-z0-9_-]{24}$/);
  const lcode=lt.data.url.split('start=')[1];
  const taken=await c.startBot(1000001,'Андрей',lcode); assert.match(taken.text,/другому аккаунту/,'Telegram владельца не привязать к чужому аккаунту');
  const ok=await c.startBot(777,'Аня',lcode); assert.match(ok.text,/Привязка Telegram/); const ltok=ok.url.split('#/link/')[1];
  assert.match((await c.startBot(778,'Аня',lcode)).text,/устарела|использована/,'ссылка привязки одноразовая');
  assert.equal((await c.call('POST','/api/me/link/confirm',{token:ltok},{as:'ya3001'})).status,403,'чужой аккаунт подтвердить не может');
  assert.equal((await c.call('POST','/api/me/link/confirm',{token:ltok},{as:'anya'})).status,200);
  assert.equal((await c.call('POST','/api/me/link/confirm',{token:ltok},{as:'anya'})).status,410,'один раз');
  const me2=await c.call('GET','/api/me',undefined,{as:'anya'}); assert.equal(me2.data.user.telegram,true);
  const viaTg=await c.login(777,'Аня'); assert.equal(viaTg.data.user.id,m.data.user.id);
  const l2=await c.call('POST','/api/me/link',{to:'yandex',ret:'http://localhost:8787/',s:'clientstate-1234567890'},{as:'owner'}); assert.equal(l2.status,409);
});

test('страница на nachert1830.ru: CORS только для сайтов клуба, токен в заголовке без CSRF, cookie не ставится',async()=>{
  const c=club(); const r=await c.yandex({id:'3001',login:'owner.ya'}); const tok=r.data.session;
  const site={origin:'https://nachert1830.ru','sec-fetch-site':'cross-site'};
  const pre=await c.call('OPTIONS','/api/progress',undefined,{headers:site,cookie:false});
  assert.equal(pre.status,204); assert.equal(pre.headers['Access-Control-Allow-Origin'],'https://nachert1830.ru'); assert.match(pre.headers['Access-Control-Allow-Headers'],/authorization/);
  assert.equal((await c.call('OPTIONS','/api/progress',undefined,{headers:{origin:'https://evil.example'},cookie:false})).status,403);
  const me=await c.call('GET','/api/me',undefined,{headers:Object.assign({authorization:'Bearer '+tok},site),cookie:false,csrf:false});
  assert.equal(me.status,200); assert.equal(me.headers['Access-Control-Allow-Origin'],'https://nachert1830.ru'); assert.equal(me.headers['Access-Control-Allow-Credentials'],undefined);
  const put=await c.call('PUT','/api/progress',{data:{nch2_rep:'{}'},mt:{nch2_rep:1}},{headers:Object.assign({authorization:'Bearer '+tok},site),cookie:false,csrf:false});
  assert.equal(put.status,200,'с токеном в заголовке CSRF-токен не нужен');
  assert.equal((await c.call('PUT','/api/progress',{data:{},mt:{}},{headers:{authorization:'Bearer '+tok,origin:'https://evil.example'},cookie:false,csrf:false})).status,403,'чужой сайт — отказ');
  assert.equal((await c.call('GET','/api/me',undefined,{headers:{authorization:'Bearer '+'x'.repeat(43)},cookie:false})).status,401);
  const code=await c.invite('ya3001'); const reg=await c.yandex(ANYA,{invite:code,ret:'https://nachert1830.ru/lk/',noRedeem:true});
  const red=await c.call('POST','/api/auth/bot/redeem',{token:reg.token,confirm:true,consent:c.consent},{headers:site,as:'site'});
  assert.equal(red.status,200); assert.equal(red.setCookie,undefined,'на чужой сайт cookie не отдаётся'); assert.ok(red.data.session);
  const cfgJs=await c.call('GET','/config.js'); assert.equal(cfgJs.raw.body,"window.CLUB_API='';\n",'с адреса функции API — свой же сайт');
});

test('привязка по чужой ссылке: злоумышленник присылает свою ссылку привязки — вход жертвы к его аккаунту не цепляется',async()=>{
  const c=club(); await c.owner(); const code=await c.invite(); await c.yandex({id:'9001',first_name:'Злоумышленник'},{invite:code,who:'evil'}); await c.login(9002,'Злоумышленник-2',{invite:await c.invite(),who:'evilT'});
  const code2=await c.invite(); await c.login(888,'Жертва',{invite:code2,who:'victim'});
  const lt=await c.call('POST','/api/me/link',{to:'telegram'},{as:'evil'}); const lcode=lt.data.url.split('start=')[1];
  const b=await c.startBot(888,'Жертва',lcode); assert.equal(b.text.includes('другому аккаунту'),true,'Telegram жертвы уже занят');
  const ly=await c.call('POST','/api/me/link',{to:'yandex',ret:'http://localhost:8787/',s:'clientstate-1234567890'},{as:'evilT'});
  const r=await c.yandex({id:'9555',first_name:'Жертва2'},{link:new URL(ly.data.url).searchParams.get('link')}); const tok=r.location.split('#/link/')[1].split('/')[0];
  assert.equal((await c.call('POST','/api/me/link/confirm',{token:tok},{as:'victim'})).status,403,'жертва в своём браузере — другой аккаунт');
  assert.equal(await c.store.get('identities','ya:9555'),null,'ничего не привязано');
});
