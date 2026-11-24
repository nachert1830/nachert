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
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.2 9 4l6 2.2 5.5-2.2v13.8L15 20l-6-2.2-5.5 2.2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v13.8M15 6.2V20" stroke="currentColor" stroke-width="2"/></svg>',
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
      const href=(done||now)&&open?(sk.topic?`#/prep/${it.k}/${sk.topic}`:'#'):null, tag=href?`a href="${href}"`:'div role="button" tabindex="0"';
      if(now&&it.k===k){ cat=[it.x,it.y]; }   /* кот — в зоне того задания, чью карту открыли */
      if(just===it.k+':'+it.j){ prevCat=[it.x,it.y]; }
      nodes+=`<${tag} class="wd-n ${st}${just===it.k+':'+it.j?' pop':''}" data-k="${it.k}" data-i="${it.j}" style="left:${f(it.x)}px;top:${f(it.y)}px" aria-label="${esc(pk.label)}, уровень ${it.j+1}: ${esc(sk.t)}${done?', пройден':now?', текущий':', закрыт'}">
        ${done?`<span class="wd-st">${[0,1,2].map(q=>STAR(q<sr)).join('')}</span>`:''}
        <span class="wd-p"><span class="wd-pt">${done?ICON.check:`<b>${it.j+1}</b>`}${!done&&!now?`<i class="wd-lk">${ICON.lock}</i>`:''}</span></span>
        ${now?`<span class="wd-l">${esc(sk.t)}</span>`:''}</${href?'a':'div'}>`; return; }
    if(it.t==='boss'){ const ready=open&&doneAll(it.k), tag=ready?`a href="${pk.go}"`:'div';
      if(ready&&!cat&&it.k===k) cat=[it.x,it.y];
      nodes+=`<${tag} class="wd-n boss ${ready?'cur':'lock'}" data-k="${it.k}"${ready?'':' role="button" tabindex="0"'} style="left:${f(it.x)}px;top:${f(it.y)}px" aria-label="${esc(pk.label)}${ready?'':' — откроется после всех уровней'}">
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
  /* нажатие на уровень или задание — карточка: что это за уровень и что на нём будет; войти — из карточки */
  const openSh=n=>sheet(v,n.dataset.k,n.classList.contains('boss')?null:+n.dataset.i);
  v.querySelectorAll('.wd-n').forEach(n=>{ n.onclick=e=>{ e.preventDefault(); openSh(n); };
    n.onkeydown=e=>{ if(n.tagName!=='A'&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); openSh(n); } }; });
  const goNext=ss.get(NEXT);
  const catEl=v.querySelector('#wdCat');
  try{ const hd=[...document.querySelectorAll('header,.top,#hdr,.hdr,.site-hd')].find(e=>{ const cs=getComputedStyle(e); return (cs.position==='fixed'||cs.position==='sticky')&&e.getBoundingClientRect().top<=0&&e.offsetHeight>30&&e.offsetHeight<120; });
    if(hd) v.querySelector('.wd-hud').style.top=Math.round(hd.getBoundingClientRect().bottom)+'px'; }catch(e){}
  const focus=(smooth)=>{ const el=catEl||v.querySelector('#z-'+k); if(el&&el.scrollIntoView) el.scrollIntoView({block:'center',behavior:smooth?'smooth':'auto'}); };
  v.querySelector('#wdMe').onclick=()=>focus(true);
  setTimeout(()=>focus(false),320);
  /* после пройденного уровня кот идёт на следующий; если нажали «Дальше» — сразу карточка следующего уровня (или задания) */
  const nextSheet=()=>{ if(!goNext||!v.querySelector('.wd-wrap')) return; const c=K.curOf(k); if(c>=0) sheet(v,k,c); else if(zoneOpen(k)) sheet(v,k,null); };
  setTimeout(()=>{ focus(false); if(prevCat&&cat&&catEl){ setTimeout(()=>{ catEl.style.left=f(cat[0])+'px'; catEl.style.top=f(cat[1])+'px'; setTimeout(()=>{ focus(true); setTimeout(nextSheet,600); },900); },700); } else if(goNext) setTimeout(nextSheet,500); },40);
  return 'Подготовка · '+p.label;
}

/* ───────── уровень: шаги, понятные с первого взгляда ─────────
   Карта → карточка уровня (что за навык, идея, задача, маршрут) → «Условие» (чертёж только с данными, «Дано / Найти») →
   «Разбор» по шагам (условие можно открыть в любой момент) → «Итог разбора» (главная идея и все шаги списком) →
   «Тест»: сначала правила и типичные ошибки, потом 6 пар → итог: звёзды, разбор каждой пары, что дальше.
   Наверху всегда видно, где ты: Условие · Разбор · Тест (у инжи — Разбор · Тест). */
const STAGE='nch_prep_stage', NOBRIEF='nch_prep_nobrief', NEXT='nch_prep_next';
const ss={ get(k){ try{ const v=sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; }catch(e){ return null; } },
  set(k,v){ try{ sessionStorage.setItem(k,v); }catch(e){} } };
const plural=(n,a,b,c)=>{ const m=n%10, h=n%100; return n+' '+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c); };
const taskOf=(id,sk)=>(P.TASK||{})[id]||{given:'',find:sk.t};
const ideaOf=id=>{ const G=self.PREPROG; return G&&G.BY&&G.BY[id]?G.BY[id].new:''; };
const nkName=t=>(P.NKNAME||{})[t]||t;
const levelIx=(k,id)=>{ const sk=P.PLANS[k].skills, j=sk.findIndex((s,j)=>s.topic===id&&!K.stDone(k,j)); return j>=0?j:sk.findIndex(s=>s.topic===id); };
const stars3=n=>[0,1,2].map(q=>STAR(q<n)).join('');
/* шапка уровня: крестик к карте, задание и номер уровня, лучший результат; под ней — этапы */
function head(k,i){ const p=P.PLANS[k], sk=p.skills[i], st=K.starsOf(k,i), ig=!sk.topic;
  const names=ig?['Разбор','Тест']:['Условие','Разбор','Тест'];
  return `<div class="wl-bar"><a class="wl-x" href="#/prep/${k}" aria-label="К карте">${ICON.map}</a>
    <div class="wl-ttl"><small>${esc(p.label)} · уровень ${i+1} из ${p.skills.length}</small><b>${esc(sk.t)}</b></div>
    <span class="wl-best${st?'':' none'}" title="лучший результат">${stars3(st)}</span></div>
    <ol class="wl-steps" id="wlSteps">${names.map((n,j)=>`<li data-s="${ig?j+1:j}"><span>${j+1}</span>${n}</li>`).join('')}</ol>`; }
function setStep(root,cur,done){ root.querySelectorAll('#wlSteps li').forEach(li=>{ const s=+li.dataset.s; li.classList.toggle('on',s===cur); li.classList.toggle('ok',s<cur||!!(done&&s<=cur)); }); }

function level(v,k,id){
  const p=P.PLANS[k], i=levelIx(k,id), sk=p.skills[i], topic=P.TOPICS[id];
  if(!sk||!topic){ location.replace('#/prep/'+k); return 'Подготовка'; }
  K.css(); css(); document.body.classList.add('inplayer'); K.lastKey(k);
  const task=taskOf(id,sk), idea=ideaOf(id), W=topic.watch, N=W.steps.length;
  let V=null, S=null; for(let t=0;t<50&&!S;t++){ V=W.V?W.V.call(topic):topic.make.call(topic); S=V&&topic.scene(V,null); }
  const sp=topic.space?topic.space(V):null;
  const S0=task.noTxt?Object.assign({},S,{base:(S.base||[]).filter(e=>e.t!=='txt')}):S, drawCond=svg=>P.draw(svg,S0,task.show||[]);
  v.innerHTML=`<div class="pp pp-topic wl">${head(k,i)}<div class="pp-stage wl-stage" id="wlStage"></div></div>`;
  const stage=v.querySelector('#wlStage'), root=v;
  const taskBox=`<div class="wl-task"><p><span>Дано</span>${esc(task.given)}</p><p class="find"><span>Найти</span>${esc(task.find)}</p></div>`;
  const toTest=()=>{ K.setSeen(k,'w:'+id); location.hash='#/prep/'+k+'/test'+(i+1); };

  /* 1. Условие: тот же вариант, что в разборе, — только исходные данные */
  const cond=()=>{ setStep(root,0);
    stage.innerHTML=`<div class="wl-split"><div class="pp-card big wl-card"><span class="wl-tag">Условие</span><svg aria-label="Чертёж условия"></svg></div>
      <div class="wl-panel">${idea?`<p class="wl-idea"><span>Чему учимся</span>${esc(idea)}</p>`:''}${taskBox}
      <p class="wl-hint">Подумай, с чего бы ты начал. Потом посмотрим решение — ${plural(N,'шаг','шага','шагов')}.</p>
      <button type="button" class="pp-btn big" id="wlGo">Смотреть разбор →</button></div></div>`;
    drawCond(stage.querySelector('svg'));
    stage.querySelector('#wlGo').onclick=()=>watch(0); };

  /* 2. Разбор по шагам; «Условие» сверху — открыть исходный чертёж и текст в любой момент */
  const watch=at=>{ setStep(root,1); let i0=at||0, peek=false;
    stage.innerHTML=`<div class="wl-split"><button type="button" class="wl-goal" id="wlGoal" aria-expanded="false"><span>Найти</span><b>${esc(task.find)}</b><i>Условие</i></button>
      <div class="wl-given" id="wlGiven" hidden><p><span>Дано</span>${esc(task.given)}</p></div>
      <div class="pp-card big wl-card" id="wlCard"><svg aria-label="Чертёж шага"></svg>${sp?'<canvas class="pp-3d" hidden aria-label="Шаг в пространстве"></canvas><div class="pp-vt" role="tablist"><button data-v="e" class="on">Эпюр</button><button data-v="3">3D</button></div>':''}
        <span class="wl-tag" id="wlTag" hidden>Условие</span><span class="wl-tap" id="wlTap">нажми на чертёж или листай — следующий шаг</span>
        <button type="button" class="wl-rp" id="wlRp" aria-label="Повторить шаг" title="Повторить шаг">↻</button></div>
      <div class="wl-panel"><div class="wl-sn"><b id="wlSn"></b><span class="pp-dots">${W.steps.map(()=>'<i></i>').join('')}</span></div>
        <p class="pp-cap" id="ppCap" aria-live="polite"></p>
        <div class="pp-row"><button type="button" class="pp-btn ghost" id="ppPrev" aria-label="Шаг назад">←</button><button type="button" class="pp-btn" id="ppNext">Дальше →</button></div></div></div>`;
    const svg=stage.querySelector('svg'), cv=stage.querySelector('canvas'), card=stage.querySelector('#wlCard'), goal=stage.querySelector('#wlGoal'), given=stage.querySelector('#wlGiven');
    const st3={yaw:-.6,pitch:.42,mode:'e',idle:0,drag:null};
    const paint3=()=>{ if(cv&&st3.mode==='3') P.draw3D(cv,sp,peek?(task.show||[]):W.steps[i0].roles,st3); };
    const show=()=>{ const s0=W.steps[i0], prev=i0?W.steps[i0-1].roles:[];
      const fresh=s0.roles.filter(r=>!prev.includes(r));
      if(peek) drawCond(svg); else { P.draw(svg,S,s0.roles,fresh);
        /* что нового на этом шаге — в фокусе, построенное раньше — приглушено */
        if(i0&&fresh.length) svg.querySelectorAll('[data-role]').forEach(n=>{ if(!fresh.includes(n.dataset.role)) n.classList.add('pp-old'); }); }
      stage.querySelector('#ppCap').textContent=s0.cap; stage.querySelector('#wlSn').textContent='Шаг '+(i0+1)+' из '+N; paint3();
      stage.querySelectorAll('.pp-dots i').forEach((d,j)=>d.classList.toggle('on',j<=i0));
      stage.querySelector('#ppPrev').disabled=!i0; stage.querySelector('#ppNext').textContent=i0===N-1?'Готово ✓':'Дальше →';
      stage.querySelector('#wlTag').hidden=!peek; stage.querySelector('#wlTap').hidden=peek||i0>0||st3.mode==='3'; stage.querySelector('#wlRp').hidden=peek||st3.mode==='3'; };
    const fwd=()=>{ if(peek){ setPeek(false); return; } if(i0<N-1){ i0++; show(); try{ window.FX&&FX.buzz(8); }catch(e){} } else recap(); };
    const setPeek=on=>{ peek=on; goal.setAttribute('aria-expanded',on); goal.classList.toggle('on',on); given.hidden=!on; show(); };
    goal.onclick=()=>setPeek(!peek);
    const back=()=>{ if(peek) setPeek(false); if(i0>0){ i0--; show(); } };
    let sw=null, swiped=false;
    card.addEventListener('pointerdown',e=>{ if(st3.mode!=='3') sw=[e.clientX,e.clientY]; swiped=false; });
    card.addEventListener('pointerup',e=>{ if(!sw) return; const dx=e.clientX-sw[0], dy=e.clientY-sw[1]; sw=null;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){ swiped=true; dx<0?fwd():back(); } });
    card.onclick=e=>{ if(swiped||e.target.closest('.pp-vt,.wl-rp')||st3.mode==='3') return; fwd(); };
    stage.querySelector('#wlRp').onclick=()=>show();
    const keys=e=>{ if(!stage.isConnected||!stage.querySelector('#wlCard')){ document.removeEventListener('keydown',keys); return; }
      if(e.target.closest&&e.target.closest('input,textarea')) return;
      if(e.key==='ArrowRight'){ e.preventDefault(); fwd(); } else if(e.key==='ArrowLeft'){ e.preventDefault(); back(); } };
    if(stage._keys) document.removeEventListener('keydown',stage._keys); stage._keys=keys; document.addEventListener('keydown',keys);
    stage.querySelector('#ppPrev').onclick=back;
    stage.querySelector('#ppNext').onclick=fwd;
    if(cv){ stage.querySelector('.pp-vt').onclick=e=>{ const b=e.target.closest('button'); if(!b) return; st3.mode=b.dataset.v;
        stage.querySelectorAll('.pp-vt button').forEach(x=>x.classList.toggle('on',x===b)); svg.hidden=st3.mode==='3'; cv.hidden=st3.mode!=='3'; show();
        try{ window.TRACK&&TRACK('prep_3d',{topic:id}); }catch(e){} };
      cv.style.touchAction='none';
      cv.addEventListener('pointerdown',e=>{ st3.drag=[e.clientX,e.clientY,st3.yaw,st3.pitch]; try{ cv.setPointerCapture(e.pointerId); }catch(_){} });
      cv.addEventListener('pointermove',e=>{ if(!st3.drag) return; st3.yaw=st3.drag[2]+(e.clientX-st3.drag[0])*.01; st3.pitch=Math.max(.05,Math.min(1.25,st3.drag[3]+(e.clientY-st3.drag[1])*.006)); st3.idle=performance.now()+4000; paint3(); });
      cv.addEventListener('pointerup',()=>{ st3.drag=null; });
      const rm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
      const tick=t=>{ if(!cv.isConnected) return; if(st3.mode==='3'&&!st3.drag&&!rm&&t>st3.idle){ st3.yaw+=.004; paint3(); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    show(); };

  /* 3. Итог разбора: что построили и главная мысль — перед тестом */
  const recap=()=>{ setStep(root,1,true);
    stage.innerHTML=`<div class="wl-split recap"><div class="pp-card big wl-card"><span class="wl-tag ok">Решение</span><svg aria-label="Решение целиком"></svg></div>
      <div class="wl-panel"><span class="wl-k">Разбор пройден</span>${idea?`<p class="wl-idea"><span>Главное</span>${esc(idea)}</p>`:''}
      <ol class="wl-ol">${W.steps.map(s=>`<li>${esc(s.cap)}</li>`).join('')}</ol>
      <p class="wl-hint">Дальше — тест: ${N_PAIRS} пар чертежей, в каждой выбери верный.</p>
      <div class="pp-row"><button type="button" class="pp-btn ghost" id="wlAgain">↺ Ещё раз</button><button type="button" class="pp-btn" id="wlTest">К тесту →</button></div></div></div>`;
    P.draw(stage.querySelector('svg'),S,W.steps[N-1].roles);
    stage.querySelector('#wlAgain').onclick=()=>watch(0); stage.querySelector('#wlTest').onclick=toTest; };

  const st=ss.get(STAGE); if(st==='watch') watch(0); else cond();
  return 'Уровень '+(i+1)+' · '+sk.t;
}

/* ───────── карточка уровня на карте: что за уровень и что на нём будет — до того, как в него войти ───────── */
function sheet(v,k,j){
  const p=P.PLANS[k], n=p.skills.length, boss=j==null, open=zoneOpen(k), cur=K.curOf(k);
  const close=()=>{ const w=v.querySelector('.wd-shw'); if(!w) return; w.classList.remove('in'); setTimeout(()=>w.remove(),220); document.removeEventListener('keydown',esc_); };
  const esc_=e=>{ if(e.key==='Escape') close(); };
  let body='', foot='';
  const lockZone=()=>{ const zs=zonesOf(p.subj), prev=zs[zs.indexOf(k)-1]; return `Откроется на ${p.w||'—'}-й неделе семестра${prev?` или раньше — когда пройдёшь ${esc(P.PLANS[prev].label)}`:''}.`; };
  if(boss){ const g=K.planProg(k), ready=open&&g.done===g.n;
    body=`<span class="wd-shk">${esc(p.label)} · ${p.kind==='dz'?'домашнее задание':'рубежный контроль'}</span><h2>${esc(p.title)}</h2>
      <p class="wd-shp">${ready?'Все навыки готовы — решай своё задание сам. Решение по шагам тоже открыто.':`Это финал зоны: ${p.kind==='dz'?'своё задание':'билет контроля'}. Откроется, когда пройдёшь все ${plural(n,'уровень','уровня','уровней')} — пройдено ${g.done}.`}</p>
      <ol class="wd-shl">${p.skills.map((s,q)=>`<li class="${K.stDone(k,q)?'ok':q===cur?'now':''}"><i>${K.stDone(k,q)?ICON.check:q+1}</i>${esc(s.t)}</li>`).join('')}</ol>`;
    foot=ready?`<a class="pp-btn big" id="wdStart" href="${p.go}">Открыть ${esc(p.label)} →</a>`:!open?`<p class="wd-shlock">${ICON.lock}${lockZone()}</p>`:`<button type="button" class="pp-btn big" id="wdCur">К уровню ${cur+1} →</button>`; }
  else { const sk=p.skills[j], done=K.stDone(k,j), now=open&&j===cur, sr=K.starsOf(k,j), ig=!sk.topic, topic=sk.topic&&P.TOPICS[sk.topic];
    const task=sk.topic?taskOf(sk.topic,sk):null, idea=sk.topic?ideaOf(sk.topic):'';
    const route=ig?[['Разбор','на странице тетради, по шагам'],['Тест',`${N_PAIRS} фрагментов листа: найди без ошибки`]]
      :[['Условие','что дано и что найти'],['Разбор',topic?plural(topic.watch.steps.length,'шаг','шага','шагов'):'по шагам'],['Тест',`${N_PAIRS} пар: где верно`]];
    body=`<span class="wd-shk">${esc(p.label)} · уровень ${j+1} из ${n}</span>
      <div class="wd-shs">${done?`<span class="wd-shst">${stars3(sr)}</span><b class="ok">Пройден${sr<3?' · ★★★ — за 6 из 6':''}</b>`:now?'<b class="now">Текущий уровень</b>':`<b class="lk">${ICON.lock}Закрыт</b>`}</div>
      <h2>${esc(sk.t)}</h2>
      ${idea?`<p class="wd-shi"><span>Идея</span>${esc(idea)}</p>`:''}
      ${task?`<p class="wd-shi"><span>Найти</span>${esc(task.find)}</p>`:`<p class="wd-shi"><span>Зачем</span>Это шаг ${esc(p.label)} «${esc(p.title)}»: на странице сайта построение разобрано по шагам.</p>`}
      <ol class="wd-shr">${route.map(([a,b],q)=>`<li><i>${q+1}</i><b>${a}</b><small>${b}</small></li>`).join('')}</ol>`;
    const startHref=sk.topic?`#/prep/${k}/${sk.topic}`:'#';
    if(done&&open) foot=`<a class="pp-btn big" id="wdStart" href="${startHref}">Пройти заново →</a><a class="pp-btn ghost big" id="wdQuick" href="#/prep/${k}/test${j+1}">Сразу тест</a>`;
    else if(now) foot=`<a class="pp-btn big" id="wdStart" href="${startHref}">${K.seenOf(k)[sk.topic?'w:'+sk.topic:'s:'+j]?'Продолжить':'Начать уровень'} →</a>${K.seenOf(k)[sk.topic?'w:'+sk.topic:'s:'+j]?`<a class="pp-btn ghost big" id="wdQuick" href="#/prep/${k}/test${j+1}">Разбор уже видел — к тесту</a>`:''}`;
    else if(!open) foot=`<p class="wd-shlock">${ICON.lock}${lockZone()}</p>`;
    else foot=`<p class="wd-shlock">${ICON.lock}Сначала пройди уровень ${cur+1} — «${esc(p.skills[cur].t)}».</p><button type="button" class="pp-btn big ghost" id="wdCur">К уровню ${cur+1}</button>`; }
  const old=v.querySelector('.wd-shw'); if(old) old.remove();
  const w=document.createElement('div'); w.className='wd-shw';
  w.innerHTML=`<div class="wd-shbg"></div><div class="wd-sh" role="dialog" aria-modal="true" aria-label="${boss?esc(p.label):'Уровень '+(j+1)}"><i class="wd-shg" aria-hidden="true"></i>
    <button type="button" class="wd-shx" aria-label="Закрыть">✕</button>${body}<div class="wd-shf">${foot}</div></div>`;
  v.querySelector('.wd-wrap').appendChild(w); requestAnimationFrame(()=>w.classList.add('in'));
  /* уровень, о котором карточка, — над ней, а не под ней */
  try{ const n=v.querySelector(boss?`.wd-n.boss[data-k="${k}"]`:`.wd-n[data-k="${k}"][data-i="${j}"]`), sh=w.querySelector('.wd-sh');
    if(n) requestAnimationFrame(()=>{ const r=n.getBoundingClientRect(), top=innerHeight-sh.offsetHeight; if(r.bottom>top-10||r.top<130) window.scrollBy({top:r.top-Math.max(130,(top-r.height)/2),behavior:'smooth'}); }); }catch(e){}
  w.querySelector('.wd-shbg').onclick=close; w.querySelector('.wd-shx').onclick=close; document.addEventListener('keydown',esc_);
  { const sh=w.querySelector('.wd-sh'); let y0=null, dy=0;
    sh.addEventListener('touchstart',e=>{ if(sh.scrollTop<=0){ y0=e.touches[0].clientY; dy=0; sh.style.transition='none'; } },{passive:true});
    sh.addEventListener('touchmove',e=>{ if(y0==null) return; dy=Math.max(0,e.touches[0].clientY-y0); sh.style.transform=dy?`translateY(${dy}px)`:''; },{passive:true});
    sh.addEventListener('touchend',()=>{ if(y0==null) return; y0=null; sh.style.transition=''; sh.style.transform=''; if(dy>90) close(); }); }
  const cb=w.querySelector('#wdCur'); if(cb) cb.onclick=()=>{ close(); setTimeout(()=>{ const el=v.querySelector(`.wd-n[data-k="${k}"][data-i="${cur}"]`); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); setTimeout(()=>sheet(v,k,cur),500); } },230); };
  /* инжа: разбор — страница сайта, внизу плашка «К тесту» */
  const sb=w.querySelector('#wdStart[href="#"]'); if(sb) sb.onclick=e=>{ e.preventDefault(); const sk=p.skills[j];
    K.setSeen(k,'s:'+j); K.trail(k,'Уровень '+(j+1)+' · разбор: «'+sk.t+'»','#/prep/'+k+'/test'+(j+1),'К тесту'); location.hash=sk.see; };
  const qb=w.querySelector('#wdQuick'); if(qb) qb.addEventListener('click',()=>ss.set(NOBRIEF,'1'));
  try{ (w.querySelector('#wdStart,#wdCur')||w.querySelector('.wd-shx')).focus({preventScroll:true}); }catch(e){}
  try{ window.FX&&FX.buzz(8); }catch(e){}
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
  K.css(); css(); document.body.classList.add('inplayer'); K.trail(null);
  const task=topic?taskOf(sk.topic,sk):null;
  v.innerHTML=`<div class="pp pp-topic wl wd-test">${head(k,i)}<div class="pp-stage wl-stage" id="wlStage"></div></div>`;
  const stage=v.querySelector('#wlStage'); setStep(v,2);
  /* правила и типичные ошибки — перед первой парой (переигровку и «сразу тест» не задерживаем) */
  const brief=()=>{ const traps=ig?[...new Set(sk.nk)].map(nkName):[...new Set(Object.values(topic.traps).map(t=>t.say))];
    stage.innerHTML=`<div class="wl-brief"><div class="wl-bic" aria-hidden="true"><i></i><i class="ok"></i></div>
      <h2>Проверка</h2>
      <p>${N_PAIRS} пар ${ig?'фрагментов листа':'чертежей'}, каждый раз новые числа. В паре один ${ig?'фрагмент без ошибки':'чертёж верный'}, во втором — одна типичная ошибка. Нажми на ${ig?'фрагмент без ошибки':'верный'}.</p>
      <div class="wl-score"><div><span>${stars3(3)}</span><b>6 из 6</b></div><div><span>${stars3(2)}</span><b>5 из 6</b><small>уровень пройден</small></div><div><span class="dim">${stars3(0)}</span><b>меньше</b><small>разбор ещё раз</small></div></div>
      <details class="wl-trp"><summary>Где прячутся ошибки — ${traps.length}</summary><ul>${traps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>
      <button type="button" class="pp-btn big" id="wlStart">Начать тест →</button><small class="wl-kb">С клавиатуры: 1 — первый, 2 — второй, Enter — дальше</small></div>`;
    stage.querySelector('#wlStart').onclick=run; };
  const run=()=>{
    const log=[]; let cur=null, locked=false, tok=0; const R=rng(Date.now()%1e9);
    stage.innerHTML=`<div class="wl-q"><b id="wlQn"></b><div class="wd-pips" id="wdPips">${Array.from({length:N_PAIRS},()=>'<i></i>').join('')}</div></div>
      <div class="pp-duel"><div class="pp-card" id="ppA" tabindex="0" role="button" aria-label="Первый вариант"><svg></svg></div>
      <div class="pp-panel mid"><div class="pp-verd" id="ppVerd" aria-live="polite"></div></div>
      <div class="pp-card" id="ppB" tabindex="0" role="button" aria-label="Второй вариант"><svg></svg></div></div>`;
    const A=stage.querySelector('#ppA'), B=stage.querySelector('#ppB'), verd=stage.querySelector('#ppVerd'), pips=[...stage.querySelectorAll('#wdPips i')];
    const next=()=>{ tok++; if(log.length>=N_PAIRS) return result(v,k,i,log);
      if(ig){ const pr=igPair(sk.nk,R); if(!pr){ log.push({ok:true}); return next(); } cur={pr,okTop:R()<.5};
        A.innerHTML=cur.okTop?pr.ok:pr.bad; B.innerHTML=cur.okTop?pr.bad:pr.ok; }
      else { let tk=K.trapFor(topic), pr=P.pair(topic,tk); for(let t=0;!pr&&t<6;t++){ tk=K.trapFor(topic); pr=P.pair(topic,tk); }
        if(!pr){ log.push({ok:true}); return next(); } cur={tk,pr,okTop:Math.random()<.5};
        A.innerHTML='<svg></svg>'; B.innerHTML='<svg></svg>'; P.draw(A.querySelector('svg'),cur.okTop?pr.ok:pr.bad); P.draw(B.querySelector('svg'),cur.okTop?pr.bad:pr.ok); }
      locked=false; [A,B].forEach(c=>c.className='pp-card'); pips.forEach((q,j)=>q.classList.toggle('now',j===log.length));
      stage.querySelector('#wlQn').textContent='Пара '+(log.length+1)+' из '+N_PAIRS;
      verd.innerHTML=`<span class="pp-q">${ig?'Где лист без ошибки?':'Где верно?'}</span>${task?`<small class="wd-why">${esc(task.find)}</small>`:''}`; };
    const choose=top=>{ if(locked||!cur) return; locked=true; const my=tok;
      const ok=top===cur.okTop, say=ig?cur.pr.say:topic.traps[cur.tk].say; log.push({ok,say}); pips[log.length-1].className=ok?'ok':'bad';
      const okC=cur.okTop?A:B, badC=cur.okTop?B:A; okC.classList.add('ok');
      /* где была ошибка — показываем всегда: и после верного ответа это урок */
      if(ig){ const s=badC.querySelector('svg'); if(s){ cur.pr.box.forEach(b=>{ const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x',b[0]-10); r.setAttribute('y',b[1]-10); r.setAttribute('width',b[2]-b[0]+20); r.setAttribute('height',b[3]-b[1]+20); r.setAttribute('rx',12); r.setAttribute('class','wd-hl'); s.appendChild(r); }); } }
      else K.mark(badC.querySelector('svg'),okC.querySelector('svg'),cur.pr.ok,topic.traps[cur.tk].hl);
      try{ window.TRACK&&TRACK('prep_answer',{plan:k,lv:i+1,ok:ok?1:0}); }catch(e){}
      const last=log.length>=N_PAIRS, lbl=last?'К итогу →':'Дальше →';
      const side=A.getBoundingClientRect().top===B.getBoundingClientRect().top?(badC===A?'слева':'справа'):(badC===A?'сверху':'снизу');
      okC.insertAdjacentHTML('beforeend','<span class="wl-badge ok">✓ верно</span>'); badC.insertAdjacentHTML('beforeend','<span class="wl-badge bad">✗ ошибка</span>');
      if(ok){ badC.classList.add('bad','soft'); verd.innerHTML=`<span class="pp-ok">Верно!</span><small class="wd-why">Ошибка была ${side}: ${esc(say)}</small><button type="button" class="pp-btn" id="ppNx">${lbl}</button>`;
        try{ window.FX&&FX.buzz('tick'); }catch(e){} setTimeout(()=>{ if(my===tok) next(); },2200); }
      else { badC.classList.add('bad'); verd.innerHTML=`<span class="pp-bad">Мимо. ${esc(say)}</span><small class="wd-why">Красным — ошибка, зелёным пунктиром — как надо.</small><button type="button" class="pp-btn" id="ppNx">${lbl}</button>`; try{ window.FX&&FX.buzz('error'); }catch(e){} }
      const nx=verd.querySelector('#ppNx'); nx.onclick=()=>{ if(my===tok) next(); }; try{ nx.focus({preventScroll:true}); }catch(e){} };
    const key=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); choose(e.currentTarget===A); } };
    A.onclick=()=>choose(true); B.onclick=()=>choose(false); A.onkeydown=key; B.onkeydown=key;
    /* с клавиатуры: 1 / ↑ / ← — первый, 2 / ↓ / → — второй; после ответа Enter — дальше */
    const gk=e=>{ if(!A.isConnected){ document.removeEventListener('keydown',gk); return; } if(e.target===A||e.target===B) return;
      if(!locked&&/^(1|ArrowUp|ArrowLeft)$/.test(e.key)){ e.preventDefault(); choose(true); }
      else if(!locked&&/^(2|ArrowDown|ArrowRight)$/.test(e.key)){ e.preventDefault(); choose(false); }
      else if(locked&&e.key==='Enter'&&e.target.id!=='ppNx'){ const nx=verd.querySelector('#ppNx'); if(nx){ e.preventDefault(); nx.click(); } } };
    document.addEventListener('keydown',gk);
    next(); };
  if(ss.get(NOBRIEF)) run(); else brief();
  return 'Уровень '+(i+1)+' · '+sk.t;
}
/* итог уровня: звёзды, каждая пара, что дальше. Лучший результат сохраняется */
function result(v,k,i,log){
  const p=P.PLANS[k], sk=p.skills[i], ok=log.filter(x=>x.ok).length, miss=[...new Set(log.filter(x=>!x.ok).map(x=>x.say))];
  const pass=ok>=PASS, stars=ok>=N_PAIRS?3:pass?2:0, best=K.starsOf(k,i);
  try{ window.TRACK&&TRACK('prep_level',{plan:k,lv:i+1,ok,stars}); }catch(e){}
  if(pass&&(!K.stDone(k,i)||stars>best)) K.setDone(k,i,{t:Date.now(),ok,stars:Math.max(stars,best)});
  if(pass){ ss.set(K.JUST,k+':'+i); }
  else if(sk.topic) K.setSeen(k,'w:'+sk.topic,false);
  const nx=K.curOf(k), nextSk=nx>=0?p.skills[nx]:null;
  const stage=v.querySelector('#wlStage')||v; setStep(v,2,pass);
  const what=pass?(nextSk?`<p class="wd-nx"><span>Дальше</span>Уровень ${nx+1} — «${esc(nextSk.t)}»</p>`:`<p class="wd-nx"><span>Открыто</span>${p.kind==='dz'?'Своё '+esc(p.label):esc(p.label)+': билет'} — все навыки готовы</p>`):'';
  stage.innerHTML=`<div class="wd-res${pass?' win':''}"><div class="wd-rc">
    <div class="wd-big">${[0,1,2].map(q=>`<span style="--d:${q*0.28}s">${STAR(q<stars)}</span>`).join('')}</div>
    <h1>${pass?(stars===3?'Идеально!':'Уровень пройден'):'Почти!'}</h1>
    <p class="wd-sc">верно <b>${ok}</b> из ${N_PAIRS}${pass?(stars<3?' · ★★★ — за 6 из 6':''):' · нужно '+PASS}</p>
    <div class="wd-pips res">${log.map(x=>`<i class="${x.ok?'ok':'bad'}"></i>`).join('')}</div>
    ${miss.length?`<div class="wd-mi"><span>${pass?'Одна ошибка — запомни':'На что смотреть'}</span><ul>${miss.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${what}
    <a class="pp-btn big" id="wdGo" href="${pass?'#/prep/'+k:'#'}">${pass?(nextSk?'Дальше: уровень '+(nx+1):'Дальше: '+esc(p.label)):'Разбор ещё раз'} →</a>
    ${pass?(stars<3?`<a class="pp-btn ghost big" id="wdRe" href="#/prep/${k}/test${i+1}">Переиграть на ★★★</a>`:''):`<a class="pp-btn ghost big" id="wdRe" href="#/prep/${k}/test${i+1}">Ещё раз тест</a>`}
    </div></div>`;
  const go=v.querySelector('#wdGo');
  if(pass) go.onclick=()=>ss.set(NEXT,'1');
  else go.onclick=e=>{ e.preventDefault();
    if(sk.topic){ ss.set(STAGE,'watch'); location.hash='#/prep/'+k+'/'+sk.topic; }
    else { K.trail(k,'Уровень '+(i+1)+' · разбор: «'+sk.t+'»','#/prep/'+k+'/test'+(i+1),'К тесту'); location.hash=sk.see; } };
  const re=v.querySelector('#wdRe'); if(re) re.onclick=e=>{ e.preventDefault(); ss.set(NOBRIEF,'1'); if(location.hash===re.getAttribute('href')) test(v,k,i); else location.hash=re.getAttribute('href'); };
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
.wd-n.lock{cursor:pointer}.wd-n.lock .wd-pt{opacity:.92}.wd-n:focus-visible{outline:3px solid #2a4fe0;outline-offset:4px;border-radius:20px}
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
@media (prefers-reduced-motion:reduce){.wd-n.cur .wd-pt,.wd-n.pop .wd-pt,.wd-cat,.wd-big span{animation:none}.wd-cat{transition:none}}
/* ── экран уровня: шапка, этапы, условие, разбор, итог разбора, правила теста ── */
.wl .wl-bar{flex:none;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0 6px}
.wl-x{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--pp-surf);border:1px solid var(--pp-line);box-shadow:0 2px 0 var(--pp-line);color:var(--pp-ink)}.wl-x svg{width:22px;height:22px}
.wl-ttl{min-width:0;display:grid;line-height:1.2}.wl-ttl small{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-acc)}
.wl-ttl b{font-size:16px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wl-best{display:flex}.wl-best svg{width:17px;height:17px}.wl-best svg path{fill:#d7dbe6}.wl-best svg.on path{fill:#ffc928;stroke:#e09b00;stroke-width:1.2}.wl-best.none{opacity:.55}
.wl-steps{flex:none;display:flex;list-style:none;margin:0 0 8px;padding:0;gap:6px}
.wl-steps li{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:700;color:var(--pp-mut);padding:6px 4px;border-radius:999px;background:var(--pp-surf);border:1px solid var(--pp-line);transition:background .25s,color .25s}
.wl-steps li span{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:var(--pp-line);color:var(--pp-ink);flex:none}
.wl-steps li.on{background:var(--pp-acc);border-color:var(--pp-acc);color:#fff}.wl-steps li.on span{background:#fff;color:var(--pp-acc)}
.wl-steps li.ok{color:var(--pp-ok);border-color:rgba(20,160,90,.35)}.wl-steps li.ok span{background:var(--pp-ok);color:#fff;font-size:0}.wl-steps li.ok span::after{content:"✓";font-size:12px}
.wl-steps li.on.ok{background:var(--pp-ok);border-color:var(--pp-ok);color:#fff}
.wl-stage{gap:0}
.wl-split{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px}
.wl-card{position:relative;flex:1 1 auto;min-height:230px;cursor:default}.wl-card svg{width:100%;height:100%}
#wlCard{cursor:pointer}
.wl-tag{position:absolute;left:10px;bottom:10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:#121a3f;color:#fff}.wl-tag.ok{background:var(--pp-ok)}.wl-tag[hidden]{display:none}
.wl-tap{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font-size:12px;font-weight:700;color:#5c6688;background:rgba(255,255,255,.92);border:1px solid #dfe3ec;padding:4px 10px;border-radius:999px;white-space:nowrap;pointer-events:none;animation:wlHint 2.4s ease-in-out infinite}.wl-tap[hidden]{display:none}
.wl-panel{flex:none;display:grid;gap:10px;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:16px;padding:12px 14px}
.wl-task{display:grid;gap:6px}.wl-task p,.wl-given p{margin:0;display:grid;grid-template-columns:62px 1fr;gap:8px;align-items:baseline;font-size:15px;line-height:1.35}
.wl-task span,.wl-given span,.wl-goal span{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--pp-mut);background:var(--pp-bg);border:1px solid var(--pp-line);border-radius:7px;padding:2px 0;text-align:center}
.wl-task .find{font-weight:700}.wl-task .find span{background:var(--pp-acc);border-color:var(--pp-acc);color:#fff}
.wl-idea{margin:0;padding:8px 12px;border-radius:12px;background:#fff7d6;border:1px solid #f1d98a;color:#4a3b06;font-size:14.5px;line-height:1.35;font-weight:600}
.wl-idea span{display:block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#a07a00;margin-bottom:1px}
.wl-hint{margin:0;font-size:14px;color:var(--pp-mut);line-height:1.4}
.wl-goal{flex:none;display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;font:inherit;padding:8px 10px;border-radius:12px;border:1px solid var(--pp-line);background:var(--pp-surf);color:var(--pp-ink);cursor:pointer}
.wl-goal span{background:var(--pp-acc);border-color:var(--pp-acc);color:#fff}.wl-goal b{font-size:14px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl-goal i{font-style:normal;font-size:12.5px;font-weight:800;color:var(--pp-acc);padding:4px 9px;border-radius:999px;border:1.5px solid var(--pp-acc)}
.wl-goal.on{border-color:var(--pp-acc);box-shadow:0 0 0 3px rgba(31,63,191,.15)}.wl-goal.on b{white-space:normal}.wl-goal.on i{background:var(--pp-acc);color:#fff}
.wl-given{flex:none;padding:0 10px}.wl-given[hidden]{display:none}
.wl-sn{display:flex;align-items:center;justify-content:space-between;gap:10px}.wl-sn b{font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--pp-acc)}
.wl .pp-cap{text-align:left;font-size:clamp(16px,3.8vw,19px);line-height:1.3;min-height:2.6em}
.wl-k{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-ok)}
.wl-ol{margin:0;padding:0;list-style:none;counter-reset:s;display:grid;gap:6px}
.wl-ol li{counter-increment:s;display:grid;grid-template-columns:24px 1fr;gap:8px;font-size:14px;line-height:1.35}
.wl-ol li::before{content:counter(s);width:22px;height:22px;border-radius:50%;background:var(--pp-ok);color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center}
.wl-split.recap .wl-card{flex:0 1 auto;min-height:170px;height:38vh}
.wl-brief{max-width:520px;width:100%;margin:6px auto;display:grid;gap:12px;justify-items:center;text-align:center;background:var(--pp-surf);border:1px solid var(--pp-line);border-radius:22px;padding:22px 18px}
.wl-brief h2{margin:0;font-size:26px}.wl-brief p{margin:0;color:var(--pp-mut);line-height:1.45;font-size:15px}
.wl-bic{display:flex;gap:8px}.wl-bic i{width:44px;height:54px;border-radius:9px;background:#fff;border:3px solid #e0244e;box-shadow:0 4px 0 #f5b4c2;transform:rotate(-6deg)}.wl-bic i.ok{border-color:#14a05a;box-shadow:0 4px 0 #9bdcb9;transform:rotate(6deg)}
.wl-score{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}
.wl-score div{display:grid;gap:2px;justify-items:center;padding:10px 4px;border-radius:14px;background:var(--pp-bg);border:1px solid var(--pp-line)}
.wl-score span{display:flex}.wl-score svg{width:18px;height:18px}.wl-score svg path{fill:#d7dbe6}.wl-score svg.on path{fill:#ffc928;stroke:#e09b00;stroke-width:1.2}.wl-score span.dim{opacity:.6}
.wl-score b{font-size:15px}.wl-score small{font-size:11.5px;color:var(--pp-mut);line-height:1.2}
.wl-trp{width:100%;text-align:left;border:1px solid var(--pp-line);border-radius:14px;padding:10px 14px;background:var(--pp-bg)}.wl-trp summary{cursor:pointer;font-weight:700;font-size:14px}
.wl-trp ul{margin:8px 0 0;padding-left:18px;display:grid;gap:4px;font-size:14px;line-height:1.35}
.wl-brief .pp-btn.big{width:100%;margin:0}
.wl-q{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 2px 6px}.wl-q b{font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--pp-acc);white-space:nowrap}
.wl-q .wd-pips{padding:0}.wl-q .wd-pips i{width:22px}
.wl .pp-verd{gap:6px 12px}.wl .pp-verd .wd-why{flex-basis:100%;order:2}.wl .pp-verd .pp-btn{order:3}
.wl .pp-card.bad.soft{opacity:.85}
.wl .wd-res{min-height:0;flex:1;border-radius:20px;margin:0 0 4px;padding:16px 12px}
.wd-pips.res{padding:4px 0 2px}.wd-pips.res i{width:30px;height:10px;border-radius:5px}
.wd-mi{text-align:left;margin:10px 0 0;padding:10px 12px;border-radius:14px;background:#fff1f4;border:1px solid #f5c2ce}.wd-mi span{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#c0143f}
.wd-mi ul{margin:4px 0 0;padding-left:18px;color:#3a2030;font-size:14px;line-height:1.35;display:grid;gap:3px}
.wd-nx{margin:12px 0 0;padding:10px 12px;border-radius:14px;background:#eef2ff;border:1px solid #cdd7ff;text-align:left;color:#121a3f;font-weight:700;font-size:15px;line-height:1.3}
.wd-nx span{display:block;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#1f3fbf}
.wd-rc .pp-btn.ghost.big{margin-top:8px;display:block;background:#fff;color:#121a3f;border:1px solid #dfe3ec}
@media (min-width:900px){
 .wl-split{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"goal goal" "given given" "card panel";align-items:start}
 .wl-goal{grid-area:goal}.wl-given{grid-area:given}.wl-card{grid-area:card;height:100%}.wl-panel{grid-area:panel}
 .wl-split.recap .wl-card{height:100%}}
/* ── карточка уровня на карте ── */
.wd-shw{position:fixed;inset:0;z-index:1200}
.wd-shbg{position:absolute;inset:0;background:rgba(10,16,40,.5);opacity:0;transition:opacity .22s}
.wd-sh{position:absolute;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;max-height:88vh;overflow:auto;background:#fff;color:#121a3f;border-radius:26px 26px 0 0;
 padding:10px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px -10px rgba(0,0,0,.4);transform:translateY(105%);transition:transform .32s cubic-bezier(.2,.9,.25,1.05)}
.wd-shw.in .wd-shbg{opacity:1}.wd-shw.in .wd-sh{transform:none}
.wd-shg{display:block;width:44px;height:5px;border-radius:3px;background:#dfe3ec;margin:0 auto 10px}
.wd-shx{position:absolute;right:12px;top:12px;width:36px;height:36px;border-radius:50%;border:0;background:#f1f3f8;color:#5c6688;font-size:16px;cursor:pointer}
.wd-shk{display:block;font-size:12px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#1f3fbf;padding-right:40px}
.wd-sh h2{margin:6px 0 10px;font-size:23px;line-height:1.15}
.wd-shs{display:flex;align-items:center;gap:8px;margin-top:8px}.wd-shs b{font-size:13px;font-weight:800;padding:3px 10px;border-radius:999px}
.wd-shs b.ok{background:#fff7d6;color:#8a6500}.wd-shs b.now{background:#2a4fe0;color:#fff}.wd-shs b.lk{background:#eef0f5;color:#5c6688;display:inline-flex;gap:4px;align-items:center}.wd-shs b.lk svg{width:14px;height:14px}
.wd-shst{display:flex}.wd-shst svg{width:22px;height:22px}.wd-shst svg path{fill:#d7dbe6}.wd-shst svg.on path{fill:#ffc928;stroke:#e09b00;stroke-width:1.2}
.wd-shi{margin:0 0 8px;font-size:15.5px;line-height:1.38}.wd-shi span{display:block;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a93a8;margin-bottom:1px}
.wd-shp{margin:0 0 10px;color:#5c6688;line-height:1.45}
.wd-shr{list-style:none;margin:12px 0 4px;padding:0;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
.wd-shr li{display:grid;justify-items:center;text-align:center;gap:3px;padding:10px 6px;border-radius:16px;background:#f4f6fb;position:relative}
.wd-shr li i{font-style:normal;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#2a4fe0;color:#fff;font-weight:900;font-size:13px;box-shadow:0 3px 0 #18308f}
.wd-shr li b{font-size:14px}.wd-shr li small{font-size:11.5px;color:#5c6688;line-height:1.25}
.wd-shr li+li::before{content:"";position:absolute;left:-7px;top:22px;width:8px;height:2px;background:#c9d0e2}
.wd-shl{margin:0 0 6px;padding:0;list-style:none;display:grid;gap:6px}
.wd-shl li{display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:center;font-size:14.5px;color:#5c6688}
.wd-shl li i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#eef0f5;font-size:12px;font-weight:800}.wd-shl li i svg{width:15px;height:15px}
.wd-shl li.ok{color:#121a3f}.wd-shl li.ok i{background:#ffc928;color:#fff}.wd-shl li.now{color:#121a3f;font-weight:700}.wd-shl li.now i{background:#2a4fe0;color:#fff}
.wd-shf{display:grid;gap:8px;margin-top:14px}.wd-shf .pp-btn.big{margin:0;display:block;text-align:center;font-size:16px;padding:14px 18px;border-radius:14px}
.wd-shf .pp-btn:not(.ghost){background:#2a4fe0;color:#fff;box-shadow:0 4px 0 #18308f}.wd-shf .pp-btn.ghost{background:#fff;color:#121a3f;border:1px solid #dfe3ec}
.wd-shlock{margin:0;display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:14px;background:#f4f6fb;color:#5c6688;font-size:14px;line-height:1.4}.wd-shlock svg{width:18px;height:18px;flex:none;margin-top:1px}
/* разбор: новое на шаге — в фокусе, прежнее — приглушено */
.pp svg .pp-old{opacity:.32;transition:opacity .35s}
.wl-rp{position:absolute;right:10px;bottom:10px;width:34px;height:34px;border-radius:50%;border:1px solid #dfe3ec;background:rgba(255,255,255,.94);color:#5c6688;font-size:17px;font-weight:700;cursor:pointer;display:grid;place-items:center}.wl-rp[hidden]{display:none}
.wl-badge{position:absolute;right:8px;top:8px;font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;color:#fff;pointer-events:none;animation:ppPop .3s cubic-bezier(.3,1.6,.5,1) both}
.wl-badge.ok{background:var(--pp-ok)}.wl-badge.bad{background:var(--pp-bad)}.wl .pp-card{position:relative}
/* тёмная тема: пустые звёзды тёмные (светлые читались как заработанные), подсказки — приглушённые, шапка карты — с тёмным текстом на светлом */
[data-theme="dark"] .wl-best svg path,[data-theme="dark"] .wl-score svg path{fill:#3a4362}
[data-theme="dark"] .wl-best svg.on path,[data-theme="dark"] .wl-score svg.on path{fill:#ffc928}
[data-theme="dark"] .wl-best.none{opacity:1}
[data-theme="dark"] .wl-idea{background:rgba(255,201,40,.10);border-color:rgba(255,201,40,.32);color:#ffe7a3}[data-theme="dark"] .wl-idea span{color:#e0b43a}
[data-theme="dark"] .wl-tap,[data-theme="dark"] .wl-rp{background:rgba(255,255,255,.94);color:#5c6688}
.wd-hud,.wd-hud .wd-ht b{color:#121a3f}
.wl-kb{color:var(--pp-mut);font-size:12.5px}@media (pointer:coarse){.wl-kb{display:none}}
@keyframes wlHint{0%,100%{opacity:.95}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.wd-sh,.wd-shbg{transition:none}.wl-tap{animation:none}}`;
function css(){ if(document.getElementById('wdCss')) return; const s=document.createElement('style'); s.id='wdCss'; s.textContent=CSS; document.head.appendChild(s); }

self.PREPW={map,level,sheet,test,result,zonesOf,zoneOpen,layout,igPair,BIOMES,ORDER};
})();
