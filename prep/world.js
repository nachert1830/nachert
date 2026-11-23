/* ═══════════ PREPW: карта подготовки (копия /new/) ═══════════
   Одна большая карта на предмет, снизу вверх: задания по семестру — зоны со своим пейзажем
   (начерт: снег → луг → горы → осень → каньон → берег → вулкан → ночь; инжа: снег → луг → осень → горы → берег → ночь).
   В зоне — уровни-навыки (prep/plans.js), в конце зоны — само задание (ДЗ или РК). Уровень: разбор по шагам → тест 6 пар
   «где верно» (начерт — темы программы, инжа — фрагменты листа ДЗ: правильный и с подсаженной ошибкой, IGNK.make) →
   звёзды: 6 из 6 — ★★★, 5 из 6 — ★★ (уровень пройден), меньше — разбор ещё раз. Лучший результат сохраняется.
   Зона открыта, если подошёл её срок (неделя семестра), пройдена прошлая зона или это задание выбрал сайт (PREP.autoKey).
   Адреса: #/prep/<ключ> — карта предмета у зоны задания; #/prep/<ключ>/<тема> — разбор; #/prep/<ключ>/test<N> — тест уровня. */
(function(){
'use strict';
if(!self.PREP||!PREP.K) return;
const P=PREP, K=P.K, esc=K.esc;
const N_PAIRS=6, PASS=5;

/* ───────── зоны ───────── */
const BIOMES={
  snow:   {sky:'#eaf6ff',gr:'#d3e9fb',road:'#ffffff',edge:'#9cc8ea',ink:'#2b5d86',deco:['pine','pine','pine','snowman','ice','flake','flake','drift']},
  meadow: {sky:'#d9f2b6',gr:'#b6e08a',road:'#f2dcaa',edge:'#c9a86a',ink:'#2f6b2a',deco:['tree','tree','bush','flower','flower','mushroom','tree','pond']},
  mountain:{sky:'#e7e4de',gr:'#cfc9bf',road:'#f1ede6',edge:'#a59d91',ink:'#4d4a45',deco:['peak','rock','rock','pine','peak','rock','goat']},
  autumn: {sky:'#fbe6c4',gr:'#f2cd93',road:'#f8e7c8',edge:'#c4935d',ink:'#7a3f12',deco:['atree','atree','pumpkin','leaf','leaf','atree','haystack']},
  canyon: {sky:'#f6d2b0',gr:'#e7ab7d',road:'#f7dfc4',edge:'#b9774a',ink:'#6e3517',deco:['mesa','cactus','cactus','rock','skull','mesa']},
  beach:  {sky:'#fff1c9',gr:'#f6dc9c',road:'#fffaf0',edge:'#e0c07a',ink:'#7a5a12',deco:['palm','palm','umbrella','star','shell','palm','ball'],sea:true},
  volcano:{sky:'#4a3640',gr:'#3a2a32',road:'#6b5560',edge:'#2a1d24',ink:'#ffd7a8',deco:['vrock','lava','vrock','crystal','smoke','vrock'],dark:true},
  night:  {sky:'#232a63',gr:'#1b2150',road:'#cfc8ff',edge:'#7a70d6',ink:'#e8e5ff',deco:['star2','star2','crystal','moon','star2','planet'],dark:true}};
const ORDER={ng:['snow','meadow','mountain','autumn','canyon','beach','volcano','night'],ig:['snow','meadow','autumn','mountain','beach','night']};
const zonesOf=subj=>Object.keys(P.PLANS).filter(k=>P.PLANS[k].subj===subj).sort((a,b)=>(P.PLANS[a].w||99)-(P.PLANS[b].w||99)||(P.PLANS[a].kind==='rk')-(P.PLANS[b].kind==='rk'));
const doneAll=k=>K.planProg(k).done===K.planProg(k).n;
function zoneOpen(k){ const p=P.PLANS[k], zs=zonesOf(p.subj), i=zs.indexOf(k);
  return i<=0||k===P.autoKey(p.subj)||(p.w||99)<=P.semWeek()+1||doneAll(zs[i-1]); }

/* ───────── рисунки ───────── */
const rng=s=>()=>{ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const f=n=>Math.round(n*10)/10;
const sh=(x,y,rx,o)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(rx*.32)}" fill="#000" opacity="${o||.13}"/>`;
const ART={
  pine:(x,y,s,B)=>{ const c=B===BIOMES.snow; return sh(x,y,22*s)+`<rect x="${f(x-3*s)}" y="${f(y-14*s)}" width="${f(6*s)}" height="${f(14*s)}" rx="2" fill="#7a4e2d"/>`+
    [[0,1],[1,.78],[2,.56]].map(([i,k])=>{ const yy=y-14*s-i*16*s, w=24*s*k; return `<path d="M${f(x-w)},${f(yy)}L${f(x)},${f(yy-30*s*k)}L${f(x+w)},${f(yy)}Z" fill="${i%2?'#2f7d5b':'#28704f'}"/>`+(c?`<path d="M${f(x-w*.55)},${f(yy-13*s*k)}L${f(x)},${f(yy-30*s*k)}L${f(x+w*.55)},${f(yy-13*s*k)}Q${f(x)},${f(yy-8*s*k)} ${f(x-w*.55)},${f(yy-13*s*k)}Z" fill="#fff"/>`:''); }).join(''); },
  snowman:(x,y,s)=>sh(x,y,20*s)+`<circle cx="${f(x)}" cy="${f(y-14*s)}" r="${f(15*s)}" fill="#fff" stroke="#cfe3f3" stroke-width="2"/><circle cx="${f(x)}" cy="${f(y-38*s)}" r="${f(11*s)}" fill="#fff" stroke="#cfe3f3" stroke-width="2"/>`+
    `<circle cx="${f(x-4*s)}" cy="${f(y-40*s)}" r="${f(1.6*s)}" fill="#223"/><circle cx="${f(x+4*s)}" cy="${f(y-40*s)}" r="${f(1.6*s)}" fill="#223"/><path d="M${f(x)},${f(y-36*s)}l${f(9*s)},${f(2*s)}l${f(-9*s)},${f(2*s)}z" fill="#f08a24"/><rect x="${f(x-9*s)}" y="${f(y-52*s)}" width="${f(18*s)}" height="${f(5*s)}" fill="#e23d3d"/>`,
  ice:(x,y,s)=>sh(x,y,16*s)+`<path d="M${f(x-14*s)},${f(y)}L${f(x-8*s)},${f(y-26*s)}L${f(x+2*s)},${f(y-34*s)}L${f(x+12*s)},${f(y-18*s)}L${f(x+14*s)},${f(y)}Z" fill="#bfe6ff"/><path d="M${f(x-8*s)},${f(y-26*s)}L${f(x+2*s)},${f(y-34*s)}L${f(x)},${f(y-6*s)}Z" fill="#e8f7ff"/>`,
  flake:(x,y,s)=>`<g stroke="#fff" stroke-width="${f(2*s)}" stroke-linecap="round" opacity=".9">${[0,60,120].map(a=>{ const r=a*Math.PI/180, dx=Math.cos(r)*8*s, dy=Math.sin(r)*8*s; return `<line x1="${f(x-dx)}" y1="${f(y-dy)}" x2="${f(x+dx)}" y2="${f(y+dy)}"/>`; }).join('')}</g>`,
  drift:(x,y,s)=>`<path d="M${f(x-40*s)},${f(y)}Q${f(x-10*s)},${f(y-22*s)} ${f(x+10*s)},${f(y-8*s)}Q${f(x+28*s)},${f(y-18*s)} ${f(x+44*s)},${f(y)}Z" fill="#fff" opacity=".9"/>`,
  tree:(x,y,s)=>sh(x,y,22*s)+`<rect x="${f(x-4*s)}" y="${f(y-22*s)}" width="${f(8*s)}" height="${f(22*s)}" rx="3" fill="#8a5a33"/><circle cx="${f(x)}" cy="${f(y-36*s)}" r="${f(22*s)}" fill="#3f9e45"/><circle cx="${f(x-9*s)}" cy="${f(y-42*s)}" r="${f(10*s)}" fill="#5cbf5c"/>`,
  bush:(x,y,s)=>sh(x,y,20*s)+`<circle cx="${f(x-10*s)}" cy="${f(y-8*s)}" r="${f(10*s)}" fill="#3f9e45"/><circle cx="${f(x+9*s)}" cy="${f(y-8*s)}" r="${f(11*s)}" fill="#3f9e45"/><circle cx="${f(x)}" cy="${f(y-15*s)}" r="${f(12*s)}" fill="#52b552"/><circle cx="${f(x+4*s)}" cy="${f(y-14*s)}" r="${f(2.4*s)}" fill="#e8394b"/>`,
  flower:(x,y,s,B,R)=>{ const c=['#ff6b8b','#ffd23f','#ffffff','#b48cff'][Math.floor(R()*4)]; return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y-12*s)}" stroke="#2f7d3a" stroke-width="2"/>`+[0,72,144,216,288].map(a=>{ const r=a*Math.PI/180; return `<circle cx="${f(x+Math.cos(r)*4*s)}" cy="${f(y-12*s+Math.sin(r)*4*s)}" r="${f(3.2*s)}" fill="${c}"/>`; }).join('')+`<circle cx="${f(x)}" cy="${f(y-12*s)}" r="${f(2.4*s)}" fill="#ffb300"/>`; },
  mushroom:(x,y,s)=>sh(x,y,12*s)+`<rect x="${f(x-4*s)}" y="${f(y-12*s)}" width="${f(8*s)}" height="${f(12*s)}" rx="3" fill="#fff3e0"/><path d="M${f(x-13*s)},${f(y-11*s)}Q${f(x)},${f(y-32*s)} ${f(x+13*s)},${f(y-11*s)}Z" fill="#e8394b"/><circle cx="${f(x-4*s)}" cy="${f(y-19*s)}" r="${f(2.4*s)}" fill="#fff"/><circle cx="${f(x+5*s)}" cy="${f(y-16*s)}" r="${f(1.8*s)}" fill="#fff"/>`,
  pond:(x,y,s)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(34*s)}" ry="${f(13*s)}" fill="#6cc3e8" stroke="#4aa6cf" stroke-width="3"/><ellipse cx="${f(x-8*s)}" cy="${f(y-3*s)}" rx="${f(10*s)}" ry="${f(3*s)}" fill="#fff" opacity=".5"/>`,
  peak:(x,y,s)=>`<path d="M${f(x-60*s)},${f(y)}L${f(x-8*s)},${f(y-80*s)}L${f(x+8*s)},${f(y-66*s)}L${f(x+50*s)},${f(y)}Z" fill="#a59d91"/><path d="M${f(x-8*s)},${f(y-80*s)}L${f(x+8*s)},${f(y-66*s)}L${f(x+50*s)},${f(y)}L${f(x+6*s)},${f(y)}Z" fill="#8e867b"/><path d="M${f(x-24*s)},${f(y-58*s)}L${f(x-8*s)},${f(y-80*s)}L${f(x+8*s)},${f(y-66*s)}L${f(x+2*s)},${f(y-56*s)}L${f(x-8*s)},${f(y-62*s)}Z" fill="#fff"/>`,
  rock:(x,y,s,B)=>{ const d=B&&B.dark; return sh(x,y,18*s)+`<path d="M${f(x-18*s)},${f(y)}L${f(x-12*s)},${f(y-14*s)}L${f(x+2*s)},${f(y-20*s)}L${f(x+16*s)},${f(y-10*s)}L${f(x+18*s)},${f(y)}Z" fill="${d?'#2a1f26':'#b5ada2'}"/><path d="M${f(x-12*s)},${f(y-14*s)}L${f(x+2*s)},${f(y-20*s)}L${f(x)},${f(y-8*s)}Z" fill="${d?'#46363f':'#d4cec5'}"/>`; },
  goat:(x,y,s)=>sh(x,y,12*s)+`<ellipse cx="${f(x)}" cy="${f(y-12*s)}" rx="${f(11*s)}" ry="${f(7*s)}" fill="#fff"/><circle cx="${f(x+11*s)}" cy="${f(y-18*s)}" r="${f(5*s)}" fill="#fff"/><path d="M${f(x+10*s)},${f(y-22*s)}q-2,-6 -6,-6" stroke="#8a7a66" stroke-width="2" fill="none"/>`+[-6,-2,3,7].map(d=>`<line x1="${f(x+d*s)}" y1="${f(y-6*s)}" x2="${f(x+d*s)}" y2="${f(y)}" stroke="#666" stroke-width="2"/>`).join(''),
  atree:(x,y,s,B,R)=>{ const c=['#e8742a','#d9482b','#f2a51a'][Math.floor(R()*3)]; return sh(x,y,22*s)+`<rect x="${f(x-4*s)}" y="${f(y-22*s)}" width="${f(8*s)}" height="${f(22*s)}" rx="3" fill="#7a4a2a"/><circle cx="${f(x)}" cy="${f(y-36*s)}" r="${f(21*s)}" fill="${c}"/><circle cx="${f(x+8*s)}" cy="${f(y-42*s)}" r="${f(9*s)}" fill="#fff" opacity=".18"/>`; },
  pumpkin:(x,y,s)=>sh(x,y,14*s)+`<ellipse cx="${f(x-6*s)}" cy="${f(y-10*s)}" rx="${f(8*s)}" ry="${f(10*s)}" fill="#e8742a"/><ellipse cx="${f(x+6*s)}" cy="${f(y-10*s)}" rx="${f(8*s)}" ry="${f(10*s)}" fill="#e8742a"/><ellipse cx="${f(x)}" cy="${f(y-10*s)}" rx="${f(8*s)}" ry="${f(11*s)}" fill="#f28a35"/><rect x="${f(x-1.5*s)}" y="${f(y-25*s)}" width="${f(3*s)}" height="${f(6*s)}" fill="#4d7a2a"/>`,
  leaf:(x,y,s,B,R)=>`<path d="M${f(x)},${f(y)}q${f(8*s)},${f(-10*s)} 0,${f(-18*s)}q${f(-8*s)},${f(8*s)} 0,${f(18*s)}z" fill="${['#e8742a','#d9482b','#f2a51a'][Math.floor(R()*3)]}" transform="rotate(${Math.floor(R()*360)} ${f(x)} ${f(y-9*s)})"/>`,
  haystack:(x,y,s)=>sh(x,y,22*s)+`<path d="M${f(x-22*s)},${f(y)}Q${f(x-20*s)},${f(y-34*s)} ${f(x)},${f(y-36*s)}Q${f(x+20*s)},${f(y-34*s)} ${f(x+22*s)},${f(y)}Z" fill="#f2c14e"/><path d="M${f(x-16*s)},${f(y-12*s)}h${f(32*s)}M${f(x-18*s)},${f(y-22*s)}h${f(36*s)}" stroke="#d9a52c" stroke-width="2"/>`,
  mesa:(x,y,s)=>`<path d="M${f(x-56*s)},${f(y)}L${f(x-40*s)},${f(y-52*s)}L${f(x+34*s)},${f(y-52*s)}L${f(x+52*s)},${f(y)}Z" fill="#c9804e"/><path d="M${f(x-40*s)},${f(y-52*s)}L${f(x+34*s)},${f(y-52*s)}L${f(x+30*s)},${f(y-42*s)}L${f(x-37*s)},${f(y-42*s)}Z" fill="#e3a273"/><path d="M${f(x-48*s)},${f(y-24*s)}h${f(92*s)}" stroke="#b26a3c" stroke-width="3"/>`,
  cactus:(x,y,s)=>sh(x,y,14*s)+`<rect x="${f(x-6*s)}" y="${f(y-44*s)}" width="${f(12*s)}" height="${f(44*s)}" rx="${f(6*s)}" fill="#3f9e5b"/><path d="M${f(x-6*s)},${f(y-22*s)}h${f(-8*s)}v${f(-14*s)}" stroke="#3f9e5b" stroke-width="${f(8*s)}" fill="none" stroke-linecap="round"/><path d="M${f(x+6*s)},${f(y-28*s)}h${f(8*s)}v${f(-10*s)}" stroke="#3f9e5b" stroke-width="${f(8*s)}" fill="none" stroke-linecap="round"/>`,
  skull:(x,y,s)=>`<circle cx="${f(x)}" cy="${f(y-8*s)}" r="${f(8*s)}" fill="#f6ecd9"/><circle cx="${f(x-3*s)}" cy="${f(y-9*s)}" r="${f(2*s)}" fill="#6e3517"/><circle cx="${f(x+3*s)}" cy="${f(y-9*s)}" r="${f(2*s)}" fill="#6e3517"/>`,
  palm:(x,y,s)=>sh(x+6*s,y,22*s)+`<path d="M${f(x)},${f(y)}Q${f(x+4*s)},${f(y-34*s)} ${f(x+14*s)},${f(y-62*s)}" stroke="#9b6a3c" stroke-width="${f(7*s)}" fill="none" stroke-linecap="round"/>`+
    [[-40,-6],[-10,-22],[24,-14],[44,4],[0,10]].map(([dx,dy])=>`<path d="M${f(x+14*s)},${f(y-62*s)}Q${f(x+14*s+dx*.5*s)},${f(y-74*s+dy*.4*s)} ${f(x+14*s+dx*s)},${f(y-58*s+dy*s)}" stroke="#2f9e5b" stroke-width="${f(8*s)}" fill="none" stroke-linecap="round"/>`).join('')+`<circle cx="${f(x+12*s)}" cy="${f(y-58*s)}" r="${f(4*s)}" fill="#7a4e2d"/>`,
  umbrella:(x,y,s)=>sh(x,y,22*s)+`<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(y-40*s)}" stroke="#7a5a3a" stroke-width="3"/><path d="M${f(x-26*s)},${f(y-38*s)}Q${f(x)},${f(y-64*s)} ${f(x+26*s)},${f(y-38*s)}Z" fill="#ff5a5f"/><path d="M${f(x-9*s)},${f(y-38*s)}Q${f(x-6*s)},${f(y-58*s)} ${f(x)},${f(y-51*s)}Q${f(x+6*s)},${f(y-58*s)} ${f(x+9*s)},${f(y-38*s)}Z" fill="#fff"/>`,
  star:(x,y,s)=>`<path d="${starD(x,y-6*s,9*s,4*s)}" fill="#ff8a5c"/>`,
  shell:(x,y,s)=>`<path d="M${f(x-9*s)},${f(y)}Q${f(x)},${f(y-18*s)} ${f(x+9*s)},${f(y)}Z" fill="#ffd1dc" stroke="#f3a5b8" stroke-width="1.5"/>`,
  ball:(x,y,s)=>sh(x,y,10*s)+`<circle cx="${f(x)}" cy="${f(y-10*s)}" r="${f(10*s)}" fill="#fff"/><path d="M${f(x)},${f(y-20*s)}A${f(10*s)},${f(10*s)} 0 0 1 ${f(x+10*s)},${f(y-10*s)}L${f(x)},${f(y-10*s)}Z" fill="#ff5a5f"/><path d="M${f(x-10*s)},${f(y-10*s)}A${f(10*s)},${f(10*s)} 0 0 1 ${f(x)},${f(y-20*s)}L${f(x)},${f(y-10*s)}Z" fill="#3ba5ff"/>`,
  vrock:(x,y,s)=>sh(x,y,20*s,.3)+`<path d="M${f(x-20*s)},${f(y)}L${f(x-12*s)},${f(y-26*s)}L${f(x+4*s)},${f(y-34*s)}L${f(x+18*s)},${f(y-14*s)}L${f(x+20*s)},${f(y)}Z" fill="#2a1d24"/><path d="M${f(x-6*s)},${f(y-22*s)}L${f(x+2*s)},${f(y-12*s)}L${f(x+8*s)},${f(y-20*s)}" stroke="#ff7a2f" stroke-width="2" fill="none"/>`,
  lava:(x,y,s)=>`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(32*s)}" ry="${f(11*s)}" fill="#ff7a2f"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(20*s)}" ry="${f(6*s)}" fill="#ffd23f"/><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(44*s)}" ry="${f(18*s)}" fill="#ff7a2f" opacity=".18"/>`,
  smoke:(x,y,s)=>`<g fill="#8a7a84" opacity=".35"><circle cx="${f(x)}" cy="${f(y-10*s)}" r="${f(10*s)}"/><circle cx="${f(x+8*s)}" cy="${f(y-24*s)}" r="${f(12*s)}"/><circle cx="${f(x+2*s)}" cy="${f(y-40*s)}" r="${f(14*s)}"/></g>`,
  crystal:(x,y,s,B)=>sh(x,y,14*s,.25)+[[-8,26,'#a78bff'],[2,38,'#c6b5ff'],[10,22,'#8f6dff']].map(([dx,h,c])=>`<path d="M${f(x+dx*s-5*s)},${f(y)}L${f(x+dx*s)},${f(y-h*s)}L${f(x+dx*s+5*s)},${f(y)}Z" fill="${c}"/>`).join(''),
  star2:(x,y,s,B,R)=>`<circle cx="${f(x)}" cy="${f(y)}" r="${f((1+R()*1.6)*s)}" fill="#fff" opacity="${(.5+R()*.5).toFixed(2)}"/>`,
  moon:(x,y,s)=>`<circle cx="${f(x)}" cy="${f(y-20*s)}" r="${f(22*s)}" fill="#fff4c2"/><circle cx="${f(x+10*s)}" cy="${f(y-26*s)}" r="${f(20*s)}" fill="#232a63"/>`,
  planet:(x,y,s)=>`<circle cx="${f(x)}" cy="${f(y-16*s)}" r="${f(14*s)}" fill="#ff9ec7"/><ellipse cx="${f(x)}" cy="${f(y-16*s)}" rx="${f(24*s)}" ry="${f(6*s)}" fill="none" stroke="#ffd1e6" stroke-width="3"/>`};
function starD(x,y,R,r){ let d=''; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r:R; d+=(i?'L':'M')+f(x+Math.cos(a)*q)+','+f(y+Math.sin(a)*q); } return d+'Z'; }
const STAR=on=>`<svg viewBox="0 0 24 24" class="${on?'on':''}" aria-hidden="true"><path d="${starD(12,12.6,11,4.8)}"/></svg>`;
const CAT=`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 26 L14 6 L28 18 Z M52 26 L50 6 L36 18 Z" fill="#2b2b33"/><path d="M15 23 L16 11 L25 19 Z M49 23 L48 11 L39 19 Z" fill="#ff9fb4"/>
  <ellipse cx="32" cy="36" rx="22" ry="20" fill="#2b2b33"/><ellipse cx="23" cy="34" rx="5.2" ry="6" fill="#fff"/><ellipse cx="41" cy="34" rx="5.2" ry="6" fill="#fff"/>
  <ellipse cx="24" cy="35" rx="3" ry="4" fill="#ffd23f"/><ellipse cx="40" cy="35" rx="3" ry="4" fill="#ffd23f"/><circle cx="24" cy="35" r="1.6" fill="#111"/><circle cx="40" cy="35" r="1.6" fill="#111"/>
  <path d="M29 43 L35 43 L32 46 Z" fill="#ff9fb4"/><path d="M32 46 q-3 4 -7 2 M32 46 q3 4 7 2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M8 40 h10 M8 44 h10 M46 40 h10 M46 44 h10" stroke="#fff" stroke-width="1.2" opacity=".7"/><path d="M20 20 q12 -8 24 0 l-2 4 q-10 -6 -20 0 z" fill="#1f3fbf"/><rect x="18" y="16" width="28" height="4" rx="1.5" fill="#1f3fbf"/><path d="M44 18 l6 4" stroke="#ffd23f" stroke-width="2"/></svg>`;
const ICON={
  lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10.5" width="12" height="9" rx="2.4" fill="currentColor"/><path d="M8.6 10.5V8.3a3.4 3.4 0 0 1 6.8 0v2.2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.6 3.6L17.8 8.6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sheet:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="6" width="30" height="36" rx="3" fill="#fff"/><path d="M14 14h20M14 20h14" stroke="#1f3fbf" stroke-width="2.4" stroke-linecap="round"/><path d="M15 34 L24 24 L33 34" fill="none" stroke="#e0244e" stroke-width="2.6" stroke-linejoin="round"/><circle cx="24" cy="24" r="2.4" fill="#e0244e"/></svg>',
  cup:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 8h18v9a9 9 0 0 1-18 0z" fill="#ffd23f"/><path d="M15 11H9a5 5 0 0 0 6 7M33 11h6a5 5 0 0 1-6 7" fill="none" stroke="#ffd23f" stroke-width="3"/><rect x="21" y="26" width="6" height="7" fill="#e8a200"/><rect x="15" y="33" width="18" height="6" rx="2" fill="#e8a200"/></svg>',
  flag:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 6v36" stroke="#5a4636" stroke-width="3.4" stroke-linecap="round"/><path d="M13 8h22l-5 7 5 7H13z" fill="#e0244e"/></svg>'};

/* ───────── раскладка мира ───────── */
const L={pad:150,sign:190,lvl:148,boss:230};
function layout(subj,W){
  const zs=zonesOf(subj), bi=ORDER[subj]||ORDER.ng, items=[]; let y=L.pad, i=0;
  const X=t=>W/2+Math.sin(t*0.92+0.6)*W*0.27;
  zs.forEach((k,z)=>{ const p=P.PLANS[k], B=BIOMES[bi[z%bi.length]]; const y0=y;
    items.push({t:'sign',k,z,y:y+L.sign*0.5,road:X(i++)}); y+=L.sign;
    p.skills.forEach((s,j)=>{ items.push({t:'lvl',k,z,j,y:y+L.lvl*0.5,x:X(i++)}); y+=L.lvl; });
    items.push({t:'boss',k,z,y:y+L.boss*0.5,x:W/2}); i++; y+=L.boss;
    zs[z]={k,B,y0,y1:y}; });
  const H=y+120;
  items.forEach(it=>{ it.y=H-it.y; }); zs.forEach(Z=>{ const a=H-Z.y1, b=H-Z.y0; Z.y0=a; Z.y1=b; });
  return {W,H,items,zones:zs};
}
function roadPath(pts){ if(!pts.length) return ''; let d=`M${f(pts[0][0])},${f(pts[0][1])}`;
  for(let i=1;i<pts.length;i++){ const [x0,y0]=pts[i-1],[x1,y1]=pts[i], m=(y0+y1)/2; d+=` C${f(x0)},${f(m)} ${f(x1)},${f(m)} ${f(x1)},${f(y1)}`; } return d; }

/* ───────── карта ───────── */
function map(v,k){
  const p=P.PLANS[k]; if(!p) return 'Подготовка';
  const subj=p.subj; K.lastKey(k); K.trail(null); document.body.classList.remove('inplayer'); K.css(); css();
  let just=null; try{ just=sessionStorage.getItem(K.JUST); sessionStorage.removeItem(K.JUST); }catch(e){}
  const W=Math.min(560,Math.max(320,(v.clientWidth||document.documentElement.clientWidth||390)));
  const Lo=layout(subj,W), auto=P.autoKey(subj);
  /* фон: вертикальный градиент зон, дорога — тем же градиентом */
  const stops=[], BL=110; Lo.zones.slice().sort((a,b)=>a.y0-b.y0).forEach(Z=>{ stops.push([(Z.y0+BL)/Lo.H,Z.B]); stops.push([(Z.y1-BL)/Lo.H,Z.B]); });
  const grad=(id,key)=>`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="${Lo.H}" gradientUnits="userSpaceOnUse">${stops.map(([o,B])=>`<stop offset="${Math.min(1,Math.max(0,o)).toFixed(4)}" stop-color="${B[key]}"/>`).join('')}</linearGradient>`;
  const pts=Lo.items.map(it=>[it.t==='sign'?it.road:it.x,it.y]);   /* снизу вверх */
  const road=roadPath(pts);
  /* золотом — участки, ведущие к пройденному уровню (и от пройденного к текущему), и к открытому заданию */
  const isDone=it=>it.t==='lvl'?K.stDone(it.k,it.j):it.t==='boss'?doneAll(it.k):false;
  const isCur=it=>it.t==='lvl'&&zoneOpen(it.k)&&K.curOf(it.k)===it.j;
  let doneRoad='', lastI=0;
  for(let i=1;i<Lo.items.length;i++){ const a=Lo.items[i-1], b=Lo.items[i];
    if(isDone(b)||(isCur(b)&&isDone(a))||(a.t==='sign'&&b.t==='lvl'&&isDone(b))){ doneRoad+=' '+roadPath([pts[i-1],pts[i]]); lastI=i; } }
  /* декор: подальше от дороги, повторяемо (свой сид на зону) */
  const roadX=y=>{ for(let i=1;i<pts.length;i++){ const [x0,y0]=pts[i-1],[x1,y1]=pts[i]; if(y<=y0&&y>=y1){ const t=(y0-y)/(y0-y1||1), m=t*t*(3-2*t); return x0+(x1-x0)*m; } } return pts[0][0]; };
  let deco='';
  Lo.zones.forEach((Z,z)=>{ const R=rng(z*977+subj.length*31), B=Z.B, h=Z.y1-Z.y0;
    if(B.sea){ const side=R()<.5; let d=`M${side?W:0},${Z.y0}`; for(let yy=Z.y0;yy<=Z.y1;yy+=40){ d+=` L${f(side?W-46-Math.sin(yy/60)*10:46+Math.sin(yy/60)*10)},${yy}`; } d+=` L${side?W:0},${Z.y1}Z`;
      deco+=`<path d="${d}" fill="#5cc3ea"/><path d="${d}" fill="none" stroke="#fff" stroke-width="4" opacity=".7" stroke-dasharray="18 22"/>`; }
    const n=Math.round(h/44);
    const RARE={snowman:2,pond:1,goat:2,haystack:2,skull:1,moon:1,planet:2,umbrella:2,ball:1,mushroom:2,lava:2,smoke:2}, used={};
    for(let i=0;i<n;i++){ let kind=B.deco[Math.floor(R()*B.deco.length)]; if(RARE[kind]!=null){ if((used[kind]||0)>=RARE[kind]) kind=B.deco[0]; used[kind]=(used[kind]||0)+1; }
      const yy=Z.y0+20+R()*(h-40), rx=roadX(yy);
      let x=R()*W, tries=0; while((Math.abs(x-rx)<92||x<14||x>W-14)&&tries++<12) x=R()*W; if(Math.abs(x-rx)<80) continue;
      if(B.sea&&(x<70||x>W-70)) continue;
      const s=kind==='peak'||kind==='mesa'?0.8+R()*0.5:0.75+R()*0.45; deco+=ART[kind](x,yy,s,B,R); }
    if(B.dark) for(let i=0;i<Math.round(h/16);i++){ deco+=ART.star2(R()*W,Z.y0+R()*h,1,B,R); }
    if(B===BIOMES.snow) for(let i=0;i<Math.round(h/30);i++){ deco+=`<circle cx="${f(R()*W)}" cy="${f(Z.y0+R()*h)}" r="${f(1.5+R()*2)}" fill="#fff" opacity=".85"/>`; }
  });
  /* уровни, задания, таблички */
  let nodes='', cat=null, prevCat=null; const totalStars=zonesOf(subj).reduce((a,kk)=>a+P.PLANS[kk].skills.reduce((b,s,j)=>b+K.starsOf(kk,j),0),0);
  const maxStars=zonesOf(subj).reduce((a,kk)=>a+P.PLANS[kk].skills.length*3,0);
  Lo.items.forEach(it=>{ const pk=P.PLANS[it.k], open=zoneOpen(it.k), cur=K.curOf(it.k);
    if(it.t==='sign'){ const g=K.planProg(it.k), st=pk.skills.reduce((a,s,j)=>a+K.starsOf(it.k,j),0), left=it.road>W/2;
      nodes+=`<div class="wd-sign${open?'':' lock'}${it.k===auto?' now':''}" style="top:${f(it.y)}px;${left?'left:12px':'right:12px'}" id="z-${it.k}">
        ${it.k===auto?'<span class="wd-rib">Сейчас</span>':''}<b>${esc(pk.label)}</b><small>${esc(pk.title)}</small>
        <span class="wd-sp">${open?`${g.done}/${g.n} · <i class="wd-si">${STAR(1)}</i>${st}`:`${ICON.lock} неделя ${pk.w||'—'}`}</span></div>`; return; }
    if(it.t==='lvl'){ const done=K.stDone(it.k,it.j), now=open&&it.j===cur, st=done?'done':now?'cur':'lock', sk=pk.skills[it.j], sr=K.starsOf(it.k,it.j);
      const href=(done||now)&&open?(sk.topic?`#/prep/${it.k}/${sk.topic}`:'#'):null, tag=href?`a href="${href}"`:'div';
      if(now){ cat=[it.x,it.y]; }
      if(just===it.k+':'+it.j){ prevCat=[it.x,it.y]; }
      nodes+=`<${tag} class="wd-n ${st}${just===it.k+':'+it.j?' pop':''}" data-k="${it.k}" data-i="${it.j}" style="left:${f(it.x)}px;top:${f(it.y)}px" aria-label="${esc(pk.label)}, уровень ${it.j+1}: ${esc(sk.t)}${done?', пройден':now?', текущий':', закрыт'}">
        ${done?`<span class="wd-st">${[0,1,2].map(q=>STAR(q<sr)).join('')}</span>`:''}
        <span class="wd-p"><span class="wd-pt">${done?ICON.check:`<b>${it.j+1}</b>`}${!done&&!now?`<i class="wd-lk">${ICON.lock}</i>`:''}</span></span>
        ${now?`<span class="wd-l">${esc(sk.t)}</span>`:''}</${href?'a':'div'}>`; return; }
    if(it.t==='boss'){ const ready=open&&doneAll(it.k), tag=ready?`a href="${pk.go}"`:'div';
      if(ready&&!cat&&it.k===k) cat=[it.x,it.y];
      nodes+=`<${tag} class="wd-n boss ${ready?'cur':'lock'}" style="left:${f(it.x)}px;top:${f(it.y)}px" aria-label="${esc(pk.label)}${ready?'':' — откроется после всех уровней'}">
        <span class="wd-p"><span class="wd-pt">${ready?(pk.kind==='dz'?ICON.sheet:ICON.cup):ICON.lock}</span></span>
        <span class="wd-l big">${pk.kind==='dz'?'Своё '+esc(pk.label):esc(pk.label)+': билет'}</span></${ready?'a':'div'}>`; }
  });
  /* персонаж — на текущем уровне зоны задания (или первой открытой) */
  if(!cat){ const it=Lo.items.find(x=>x.t==='lvl'&&x.k===k&&x.j===K.curOf(k)); if(it) cat=[it.x,it.y]; }
  const top=Lo.items.filter(x=>x.t==='boss').map(x=>x.y).reduce((a,b)=>Math.min(a,b),Lo.H);
  v.innerHTML=`<div class="wd-wrap">
    <div class="wd-hud"><a class="wd-back" href="#/" aria-label="На главную">←</a><div class="wd-ht"><b>${subj==='ng'?'Начертательная геометрия':'Инженерная графика'}</b><small>карта подготовки</small></div>
      <span class="wd-tot" title="звёзды">${STAR(1)}<b>${totalStars}</b><small>/${maxStars}</small></span></div>
    <div class="wd" style="height:${Lo.H}px;width:${W}px">
      <svg class="wd-bg" width="${W}" height="${Lo.H}" viewBox="0 0 ${W} ${Lo.H}" aria-hidden="true"><defs>${grad('wdSky','sky')}${grad('wdRoad','road')}${grad('wdEdge','edge')}</defs>
        <rect width="${W}" height="${Lo.H}" fill="url(#wdSky)"/>${deco}
        <path d="${road}" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="44" stroke-linecap="round" transform="translate(0 7)"/>
        <path d="${road}" fill="none" stroke="url(#wdEdge)" stroke-width="42" stroke-linecap="round"/>
        <path d="${road}" fill="none" stroke="url(#wdRoad)" stroke-width="32" stroke-linecap="round"/>
        <path d="${road}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="3" stroke-dasharray="2 16" stroke-linecap="round"/>
        ${lastI?`<path d="${doneRoad}" fill="none" stroke="#ffc928" stroke-width="32" stroke-linecap="round"/><path d="${doneRoad}" fill="none" stroke="#fff3b0" stroke-width="10" stroke-linecap="round" opacity=".8"/>`:''}
        <g transform="translate(${f(pts[0][0]-60)} ${f(Lo.H-70)})"><rect width="120" height="34" rx="17" fill="#121a3f"/><text x="60" y="23" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="inherit">СТАРТ</text></g>
        <g transform="translate(${W/2-24} ${top-200})">${ICON.flag.replace('<svg viewBox="0 0 48 48" aria-hidden="true">','<svg width="48" height="48" viewBox="0 0 48 48">')}</g>
      </svg>
      ${nodes}
      ${cat?`<div class="wd-cat${prevCat?' walk':''}" id="wdCat" style="left:${f((prevCat||cat)[0])}px;top:${f((prevCat||cat)[1])}px" aria-hidden="true">${CAT}</div>`:''}
    </div>
    <button type="button" class="wd-me" id="wdMe" aria-label="К текущему уровню">${CAT}</button></div>`;
  /* инжа: уровень — разбор на странице сайта, потом тест */
  v.querySelectorAll('a.wd-n[href="#"]').forEach(a=>a.onclick=e=>{ e.preventDefault(); const kk=a.dataset.k, i=+a.dataset.i, sk=P.PLANS[kk].skills[i];
    K.setSeen(kk,'s:'+i); K.trail(kk,'Разбор: «'+sk.t+'»','#/prep/'+kk+'/test'+(i+1),'К тесту'); location.hash=sk.see; });
  const catEl=v.querySelector('#wdCat');
  try{ const hd=[...document.querySelectorAll('header,.top,#hdr,.hdr,.site-hd')].find(e=>{ const cs=getComputedStyle(e); return (cs.position==='fixed'||cs.position==='sticky')&&e.getBoundingClientRect().top<=0&&e.offsetHeight>30&&e.offsetHeight<120; });
    if(hd) v.querySelector('.wd-hud').style.top=Math.round(hd.getBoundingClientRect().bottom)+'px'; }catch(e){}
  const focus=(smooth)=>{ const el=catEl||v.querySelector('#z-'+k); if(el&&el.scrollIntoView) el.scrollIntoView({block:'center',behavior:smooth?'smooth':'auto'}); };
  v.querySelector('#wdMe').onclick=()=>focus(true);
  setTimeout(()=>focus(false),320);
  setTimeout(()=>{ focus(false); if(prevCat&&cat&&catEl){ setTimeout(()=>{ catEl.style.left=f(cat[0])+'px'; catEl.style.top=f(cat[1])+'px'; setTimeout(()=>focus(true),900); },700); } },40);
  return 'Подготовка · '+p.label;
}

/* ───────── тест уровня ───────── */
/* в тест инжи — только ошибки, заметные на фрагменте листа с телефона: нет линии, разрез не заштрихован, контур тонкой, невидимый контур сплошной */
function igPair(types,R){
  if(!self.IGNK||!IGNK.make) return null;
  for(let t=0;t<24;t++){ const type=types[Math.floor(R()*types.length)], n=1+Math.floor(R()*30), m=IGNK.make(n,1+Math.floor(R()*9999),type); if(!m||!m.targets||!m.targets.length) continue;
    let tg=(type==='hdir'||type==='hstep')?m.targets.reduce((a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])]):m.targets[0];
    let [x0,y0,x1,y1]=tg; if(type==='link') x0=Math.min(x0,200);
    const cx=(x0+x1)/2, cy=(y0+y1)/2; let w=Math.max(x1-x0+70,360), h=Math.max(y1-y0+70,290); if(w/h>1.25) h=w/1.25; else w=h*1.25;
    const vb=[cx-w/2,cy-h/2,w,h];
    const fit=s=>s.replace(/viewBox="[^"]+"/,`viewBox="${vb.map(x=>x.toFixed(1)).join(' ')}"`).replace(/<svg /,'<svg preserveAspectRatio="xMidYMid meet" ');
    return {ok:fit(m.orig),bad:fit(m.svg),say:m.T.t,g:m.T.g,box:m.targets.map(b=>b.slice()),vb}; }
  return null;
}
function test(v,k,i){
  const p=P.PLANS[k], sk=p&&p.skills[i]; if(!sk){ location.replace('#/prep/'+k); return 'Подготовка'; }
  const topic=sk.topic&&P.TOPICS[sk.topic], ig=!topic;
  if(ig&&!(sk.nk&&sk.nk.length)){ location.replace('#/prep/'+k); return p.label; }
  K.css(); css(); document.body.classList.add('inplayer');
  const log=[]; let cur=null, locked=false; const R=rng(Date.now()%1e9);
  v.innerHTML=`<div class="pp pp-topic wd-test"><div class="pp-bar"><a class="pp-back" href="#/prep/${k}" aria-label="К карте">←</a>
    <div class="pp-ttl"><b>Уровень ${i+1} · ${esc(sk.t)}</b><small>${esc(p.label)} · тест: ${N_PAIRS} пар, ${ig?'найди лист без ошибки':'выбери верный чертёж'}</small></div></div>
    <div class="wd-pips" id="wdPips">${Array.from({length:N_PAIRS},()=>'<i></i>').join('')}</div>
    <div class="pp-stage"><div class="pp-duel"><div class="pp-card" id="ppA" tabindex="0" role="button" aria-label="Первый вариант"><svg></svg></div>
    <div class="pp-panel mid"><div class="pp-verd" id="ppVerd"></div></div>
    <div class="pp-card" id="ppB" tabindex="0" role="button" aria-label="Второй вариант"><svg></svg></div></div></div></div>`;
  const A=v.querySelector('#ppA'), B=v.querySelector('#ppB'), verd=v.querySelector('#ppVerd'), pips=[...v.querySelectorAll('#wdPips i')];
  const fill=(el,html)=>{ el.innerHTML=html; };
  const next=()=>{ if(log.length>=N_PAIRS) return result(v,k,i,log.filter(x=>x.ok).length,[...new Set(log.filter(x=>!x.ok).map(x=>x.say))]);
    if(ig){ const pr=igPair(sk.nk,R); if(!pr){ log.push({ok:true}); return next(); } cur={pr,okTop:R()<.5};
      fill(A,cur.okTop?pr.ok:pr.bad); fill(B,cur.okTop?pr.bad:pr.ok); }
    else { let tk=K.trapFor(topic), pr=P.pair(topic,tk); for(let t=0;!pr&&t<6;t++){ tk=K.trapFor(topic); pr=P.pair(topic,tk); }
      if(!pr){ log.push({ok:true}); return next(); } cur={tk,pr,okTop:Math.random()<.5};
      fill(A,'<svg></svg>'); fill(B,'<svg></svg>'); P.draw(A.querySelector('svg'),cur.okTop?pr.ok:pr.bad); P.draw(B.querySelector('svg'),cur.okTop?pr.bad:pr.ok); }
    locked=false; [A,B].forEach(c=>c.className='pp-card'); pips.forEach((q,j)=>q.classList.toggle('now',j===log.length));
    verd.innerHTML=`<span class="pp-q">${ig?'Где лист без ошибки?':'Где верно?'}</span>`; };
  const choose=top=>{ if(locked||!cur) return; locked=true;
    const ok=top===cur.okTop, say=ig?cur.pr.say:topic.traps[cur.tk].say; log.push({ok,say}); pips[log.length-1].className=ok?'ok':'bad';
    const okC=cur.okTop?A:B, badC=cur.okTop?B:A; okC.classList.add('ok');
    if(ig){ const s=badC.querySelector('svg'); if(s){ cur.pr.box.forEach(b=>{ const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x',b[0]-10); r.setAttribute('y',b[1]-10); r.setAttribute('width',b[2]-b[0]+20); r.setAttribute('height',b[3]-b[1]+20); r.setAttribute('rx',12); r.setAttribute('class','wd-hl'); s.appendChild(r); }); } }
    else if(!ok) K.mark(badC.querySelector('svg'),okC.querySelector('svg'),cur.pr.ok,topic.traps[cur.tk].hl);
    try{ window.TRACK&&TRACK('prep_answer',{plan:k,lv:i+1,ok:ok?1:0}); }catch(e){}
    if(ok){ badC.classList.add(...(ig?['bad','soft']:['dim'])); verd.innerHTML=`<span class="pp-ok">Верно</span>${ig?`<small class="wd-why">Ошибка была: ${esc(say)}</small>`:''}`; try{ window.FX&&FX.buzz('tick'); }catch(e){} setTimeout(next,ig?1500:850); }
    else { badC.classList.add('bad'); verd.innerHTML=`<span class="pp-bad">${esc(say)}</span><button class="pp-btn" id="ppNx">Дальше →</button>`; try{ window.FX&&FX.buzz('error'); }catch(e){} v.querySelector('#ppNx').onclick=next; } };
  const key=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(e.currentTarget===A); } };
  A.onclick=()=>choose(true); B.onclick=()=>choose(false); A.onkeydown=key; B.onkeydown=key;
  next(); return 'Уровень '+(i+1)+' · '+sk.t;
}
/* итог уровня: звёзды по результату, лучший сохраняется */
function result(v,k,i,ok,miss){
  const p=P.PLANS[k], sk=p.skills[i], pass=ok>=PASS, stars=ok>=N_PAIRS?3:pass?2:0, best=K.starsOf(k,i);
  document.body.classList.remove('inplayer');
  try{ window.TRACK&&TRACK('prep_level',{plan:k,lv:i+1,ok,stars}); }catch(e){}
  if(pass&&(!K.stDone(k,i)||stars>best)) K.setDone(k,i,{t:Date.now(),ok,stars:Math.max(stars,best)});
  if(pass){ try{ sessionStorage.setItem(K.JUST,k+':'+i); }catch(e){} }
  else K.setSeen(k,'w:'+sk.topic,false);
  const again=sk.topic?`#/prep/${k}/${sk.topic}`:'#';
  v.innerHTML=`<div class="pp wd-res${pass?' win':''}"><div class="wd-rc">
    <span class="wd-rk">${esc(p.label)} · уровень ${i+1}</span>
    <div class="wd-big">${[0,1,2].map(q=>`<span style="--d:${q*0.28}s">${STAR(q<stars)}</span>`).join('')}</div>
    <h1>${pass?(stars===3?'Идеально!':'Уровень пройден'):'Почти!'}</h1>
    <p>${esc(sk.t)}</p><p class="wd-sc">верно <b>${ok}</b> из ${N_PAIRS}${pass&&stars<3?' · ★★★ — за 6 из 6':''}${pass?'':' · нужно '+PASS}</p>
    ${!pass&&miss.length?`<ul class="pp-miss">${miss.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    <a class="pp-btn big" id="wdGo" href="${pass?'#/prep/'+k:again}">${pass?'На карту':'Разбор ещё раз'} →</a></div></div>`;
  if(!pass&&!sk.topic){ v.querySelector('#wdGo').onclick=e=>{ e.preventDefault(); K.trail(k,'Разбор: «'+sk.t+'»','#/prep/'+k+'/test'+(i+1),'К тесту'); location.hash=sk.see; }; }
  if(stars===3){ try{ window.FX&&FX.confetti(); }catch(e){} }
  return pass?'Уровень пройден':'Почти';
}

/* ───────── стили ───────── */
const CSS=`
.wd-wrap{position:relative;max-width:560px;margin:0 auto;padding-bottom:30px}
.wd-hud{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:10px 14px;margin:0 0 -64px;
 background:linear-gradient(rgba(255,255,255,.92),rgba(255,255,255,.75));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:0 0 18px 18px;box-shadow:0 6px 18px -12px rgba(10,20,60,.5)}
.wd-back{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#fff;box-shadow:0 2px 0 #d8dcea;text-decoration:none;color:#121a3f;font-size:20px;font-weight:700}
.wd-ht{display:grid;line-height:1.15}.wd-ht b{font-size:16px}.wd-ht small{font-size:12px;color:#5c6688}
.wd-tot{display:flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;background:#fff7d6;box-shadow:0 2px 0 #f1d98a}.wd-tot svg{width:20px;height:20px}.wd-tot b{font-size:16px}.wd-tot small{color:#a48a3a;font-size:12px}
.wd{position:relative;margin:0 auto;overflow:hidden;border-radius:0 0 22px 22px}
.wd-bg{position:absolute;left:0;top:0}
svg .on,svg.on path{fill:#ffc928}.wd-tot svg path,.wd-st svg path,.wd-big svg path,.wd-si svg path{fill:#d7dbe6}.wd-tot svg.on path,.wd-st svg.on path,.wd-big svg.on path,.wd-si svg.on path{fill:#ffc928;stroke:#e09b00;stroke-width:1.2}
.wd-n{position:absolute;transform:translate(-50%,-50%);display:grid;justify-items:center;width:156px;text-decoration:none;color:#121a3f;-webkit-tap-highlight-color:transparent;z-index:3}
.wd-p{position:relative;width:74px;height:74px;display:grid;place-items:center}
.wd-p::before{content:"";position:absolute;left:-6px;right:-6px;bottom:-12px;height:22px;border-radius:50%;background:rgba(0,0,0,.18);filter:blur(1px)}
.wd-pt{position:relative;width:74px;height:66px;border-radius:50%;display:grid;place-items:center;
 background:radial-gradient(circle at 50% 35%,#f3f5fa,#c9cfdc 70%);box-shadow:0 9px 0 #9aa2b5,inset 0 -6px 0 rgba(0,0,0,.08),inset 0 3px 0 rgba(255,255,255,.7);color:#8a93a8;transition:transform .15s}
.wd-pt svg{width:30px;height:30px}.wd-pt b{font-size:28px;font-weight:900;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.25)}.wd-n.lock .wd-pt b{color:#8a93a8;text-shadow:0 1px 0 #fff}
.wd-lk{position:absolute;right:-4px;bottom:-2px;width:26px;height:26px;border-radius:50%;background:#5b6378;color:#fff;display:grid;place-items:center;box-shadow:0 2px 0 #3d4456}.wd-lk svg{width:15px;height:15px}
.wd-n.done .wd-pt{background:radial-gradient(circle at 50% 35%,#ffe27a,#ffbf1f 72%);box-shadow:0 9px 0 #d18e00,inset 0 -6px 0 rgba(0,0,0,.08),inset 0 3px 0 rgba(255,255,255,.75);color:#fff}
.wd-n.done .wd-pt svg{filter:drop-shadow(0 2px 0 rgba(150,90,0,.5))}
.wd-n.cur .wd-pt{width:88px;height:78px;background:radial-gradient(circle at 50% 35%,#6c8cff,#2a4fe0 72%);box-shadow:0 10px 0 #18308f,0 0 0 0 rgba(42,79,224,.5),inset 0 3px 0 rgba(255,255,255,.4);animation:wdPulse 1.8s infinite}
.wd-n.cur .wd-p{width:88px;height:84px}
.wd-n:active .wd-pt{transform:translateY(5px)}
.wd-n.lock{pointer-events:none}.wd-n.lock .wd-pt{opacity:.92}
.wd-st{display:flex;gap:1px;margin-bottom:-6px;z-index:2;position:relative}.wd-st svg{width:20px;height:20px}.wd-st svg:nth-child(2){width:26px;height:26px;margin-top:-7px}
.wd-l{margin-top:12px;font-size:12.5px;font-weight:800;line-height:1.2;text-align:center;padding:4px 9px;border-radius:10px;background:rgba(255,255,255,.94);box-shadow:0 2px 0 rgba(0,0,0,.08);max-width:150px}
.wd-n.lock .wd-l{background:rgba(255,255,255,.7);color:#5c6688;font-weight:700}
.wd-n.boss{width:190px}.wd-n.boss .wd-p{width:112px;height:104px}.wd-n.boss .wd-pt{width:112px;height:98px}.wd-n.boss .wd-pt svg{width:56px;height:56px}
.wd-n.boss.cur .wd-pt{background:radial-gradient(circle at 50% 35%,#ff8aa0,#e0244e 72%);box-shadow:0 11px 0 #9c1031,inset 0 3px 0 rgba(255,255,255,.4);animation:wdPulseR 1.8s infinite}
.wd-n.boss.lock .wd-pt{background:radial-gradient(circle at 50% 35%,#cdd2df,#9aa2b5 72%);box-shadow:0 11px 0 #727b90}
.wd-l.big{font-size:15px;padding:6px 12px;background:#121a3f;color:#fff}.wd-n.boss.lock .wd-l.big{background:#4a5170;color:#fff}
.wd-n.pop .wd-pt{animation:wdPop .8s cubic-bezier(.2,1.6,.4,1)}
.wd-sign{position:absolute;transform:translateY(-50%);z-index:4;min-width:150px;max-width:190px;padding:10px 12px 9px;border-radius:14px;background:#7a4e2d;
 box-shadow:0 5px 0 #5a3820,0 12px 18px -8px rgba(0,0,0,.45),inset 0 0 0 3px #8f6038;color:#fff3dc;display:grid;gap:2px}
.wd-sign::after{content:"";position:absolute;left:50%;bottom:-26px;width:8px;height:26px;margin-left:-4px;background:#5a3820;border-radius:3px;z-index:-1}
.wd-sign b{font-size:20px;line-height:1.05;color:#fff}.wd-sign small{font-size:12px;line-height:1.25;opacity:.9}
.wd-sp{display:flex;align-items:center;gap:4px;font-weight:800;font-size:13px;margin-top:3px}.wd-sp svg{width:15px;height:15px}.wd-si{display:inline-flex}
.wd-sign.lock{background:#6a6f7d;box-shadow:0 5px 0 #4a4e59,0 12px 18px -8px rgba(0,0,0,.4),inset 0 0 0 3px #7b8090}
.wd-sign.now{box-shadow:0 5px 0 #5a3820,0 0 0 4px #ffc928,0 12px 18px -8px rgba(0,0,0,.45),inset 0 0 0 3px #8f6038}
.wd-rib{position:absolute;top:-12px;right:-8px;background:#e0244e;color:#fff;font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;box-shadow:0 3px 0 #9c1031}
.wd-cat{position:absolute;z-index:6;width:60px;height:60px;margin:-104px 0 0 -30px;transition:left .9s cubic-bezier(.45,0,.3,1),top .9s cubic-bezier(.45,0,.3,1);animation:wdBob 1.6s ease-in-out infinite;pointer-events:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.25))}
.wd-cat svg{width:60px;height:60px}
.wd-me{position:fixed;right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:30;width:56px;height:56px;border-radius:50%;border:0;background:#fff;box-shadow:0 4px 0 #d8dcea,0 10px 20px -8px rgba(0,0,0,.35);padding:6px;cursor:pointer}
.wd-me svg{width:44px;height:44px}
.wd-pips{display:flex;justify-content:center;gap:6px;padding:6px 0 8px}.wd-pips i{width:26px;height:8px;border-radius:4px;background:#dfe3ec}
.wd-pips i.now{background:#9db0ff}.wd-pips i.ok{background:#14a05a}.wd-pips i.bad{background:#e0244e}
.wd-test .pp-card svg{width:100%;height:100%}.wd-test .pp-card.bad.soft{border-color:#f5b4c2}
.wd-hl{fill:none;stroke:#e0244e;stroke-width:6;stroke-dasharray:14 10}.wd-why{display:block;width:100%;color:#5c6688;font-size:13px}
.wd-res{min-height:calc(100vh - 140px);display:grid;place-items:center;padding:20px 16px;background:radial-gradient(circle at 50% 20%,#3a5bff,#18257a 70%)}
.wd-res:not(.win){background:radial-gradient(circle at 50% 20%,#7d86a6,#3a4060 70%)}
.wd-rc{width:100%;max-width:420px;background:#fff;border-radius:26px;padding:22px 20px 20px;text-align:center;box-shadow:0 14px 0 rgba(0,0,0,.18),0 30px 50px -20px rgba(0,0,0,.5)}
.wd-rk{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1f3fbf}
.wd-big{display:flex;justify-content:center;align-items:flex-end;gap:6px;margin:12px 0 6px}.wd-big span{display:block;animation:wdStar .6s cubic-bezier(.2,1.6,.4,1) both;animation-delay:var(--d)}
.wd-big svg{width:64px;height:64px}.wd-big span:nth-child(2) svg{width:84px;height:84px}
.wd-rc h1{font-size:30px;margin:4px 0 4px}.wd-rc p{margin:0 0 4px;color:#5c6688}.wd-sc{font-size:15px}.wd-sc b{color:#121a3f;font-size:18px}
.wd-rc .pp-btn.big{display:block;margin-top:14px}.wd-rc .pp-miss{text-align:left;margin:10px 0 0;padding-left:20px;color:#5c6688}
@keyframes wdPulse{0%{box-shadow:0 10px 0 #18308f,0 0 0 0 rgba(42,79,224,.5),inset 0 3px 0 rgba(255,255,255,.4)}70%{box-shadow:0 10px 0 #18308f,0 0 0 20px rgba(42,79,224,0),inset 0 3px 0 rgba(255,255,255,.4)}100%{box-shadow:0 10px 0 #18308f,0 0 0 0 rgba(42,79,224,0),inset 0 3px 0 rgba(255,255,255,.4)}}
@keyframes wdPulseR{0%{box-shadow:0 11px 0 #9c1031,0 0 0 0 rgba(224,36,78,.5)}70%{box-shadow:0 11px 0 #9c1031,0 0 0 22px rgba(224,36,78,0)}100%{box-shadow:0 11px 0 #9c1031,0 0 0 0 rgba(224,36,78,0)}}
@keyframes wdPop{0%{transform:scale(.5)}100%{transform:scale(1)}}
@keyframes wdBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes wdStar{0%{transform:scale(0) rotate(-40deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
@media (prefers-reduced-motion:reduce){.wd-n.cur .wd-pt,.wd-n.pop .wd-pt,.wd-cat,.wd-big span{animation:none}.wd-cat{transition:none}}`;
function css(){ if(document.getElementById('wdCss')) return; const s=document.createElement('style'); s.id='wdCss'; s.textContent=CSS; document.head.appendChild(s); }

self.PREPW={map,test,result,zonesOf,zoneOpen,layout,igPair,BIOMES,ORDER};
})();
