/* Экран «ДЗ» копии сайта (/new/, адрес #/dz): колода карточек по сроку сдачи, листается со щелчком (вибрация).
   Перенесён из макета docs/redesign/dz-picker/mockup.html (ветка claude/sharp-newton-49vuqd).
   Задания — из реестра DZR (kernel/dz.js), вариант — общий для сайта (dzVar / dzSetVar), карточка ведёт на настоящее ДЗ (#/ng4/17).
   Остальные адреса ДЗ (#/ng4, #/ig3/7, …) — прежние разделы сайта под колодой. */
(function(){
  if(!window.DZR) return;
  var f=function(n){return Math.round(n*10)/10;};
  var C30=Math.cos(Math.PI/6),S30=.5;
  /* изометрия: x вправо-вниз, y влево-вниз, z вверх; видны грани верх, +x, +y */
  function iso(o,k){return function(x,y,z){return [f(o[0]+(x-y)*C30*k),f(o[1]+(x+y)*S30*k-z*k)];};}
  function poly(P,cls){return '<path class="'+cls+'" d="M'+P.map(function(p){return p.join(' ');}).join('L')+'z"/>';}
  function line(a,b,cls){return '<line class="'+cls+'" x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'"/>';}
  var ART={};
  /* гиперболоид: образующие между двумя окружностями со сдвигом; задние бледнее, одна выделена */
  ART.hyp=(function(){var cx=120,rx=54,ry=14,y1=20,y2=150,n=32,tw=2.3,fr='',bk='';
    for(var i=0;i<n;i++){var a=i/n*2*Math.PI,b=a+tw,p=[f(cx+rx*Math.cos(a)),f(y1+ry*Math.sin(a))],q=[f(cx+rx*Math.cos(b)),f(y2+ry*Math.sin(b))];
      if(Math.sin(a)+Math.sin(b)>0) fr+=line(p,q,'t'); else bk+=line(p,q,'b');}
    var a0=.9;return line([cx,4],[cx,166],'x')+bk+'<ellipse class="w" cx="'+cx+'" cy="'+y1+'" rx="'+rx+'" ry="'+ry+'"/>'+fr+'<ellipse class="w" cx="'+cx+'" cy="'+y2+'" rx="'+rx+'" ry="'+ry+'"/>'+
      line([f(cx+rx*Math.cos(a0)),f(y1+ry*Math.sin(a0))],[f(cx+rx*Math.cos(a0+tw)),f(y2+ry*Math.sin(a0+tw))],'h');})();
  /* брусок с прямоугольным вырезом сверху; грани выреза жёлтые */
  ART.body=(function(){var P=iso([96,60],1.15),W=80,D=50,H=40,a=28,b=52,zc=20,s='';
    s+=poly([P(0,0,H),P(a,0,H),P(a,D,H),P(0,D,H)],'f w');
    s+=poly([P(b,0,H),P(W,0,H),P(W,D,H),P(b,D,H)],'f w');
    s+=poly([P(a,0,zc),P(b,0,zc),P(b,D,zc),P(a,D,zc)],'y');
    s+=poly([P(a,0,zc),P(a,D,zc),P(a,D,H),P(a,0,H)],'y');
    s+=poly([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'f w');
    s+=poly([P(0,D,0),P(W,D,0),P(W,D,H),P(b,D,H),P(b,D,zc),P(a,D,zc),P(a,D,H),P(0,D,H)],'f w');
    return s+line(P(W/2,D/2,-14),P(W/2,D/2,H+26),'x');})();
  /* эпюр: ось x, отрезок AB в двух проекциях, линии связи */
  ART.epure='<line class="w" x1="20" y1="86" x2="196" y2="86"/><text class="tx" x="182" y="80">x</text>'+
    line([80,30],[80,138],'d')+line([150,48],[150,124],'d')+'<path class="h" d="M80 30L150 48M80 138L150 124"/>'+
    '<circle class="p" cx="80" cy="30" r="3.2"/><circle class="p" cx="150" cy="48" r="3.2"/><circle class="p" cx="80" cy="138" r="3.2"/><circle class="p" cx="150" cy="124" r="3.2"/>'+
    '<text class="tx" x="60" y="28">A″</text><text class="tx" x="156" y="46">B″</text><text class="tx" x="60" y="152">A′</text><text class="tx" x="156" y="140">B′</text>';
  /* пересечение конуса и цилиндра: очерки и линия пересечения */
  ART.inter='<path class="f w" d="M60 140 110 24 160 140z"/><ellipse class="t" cx="110" cy="140" rx="50" ry="10"/><rect class="f w" x="40" y="88" width="140" height="34" rx="2"/><ellipse class="t" cx="40" cy="105" rx="6" ry="17"/>'+
    '<path class="h" d="M82 88C92 100 92 112 80 122M138 88C128 100 128 112 140 122"/>'+line([110,14],[110,152],'x')+line([30,105],[190,105],'x');
  /* плоскости проекций π1, π2 и проецирование точки */
  ART.planes=(function(){var P=iso([118,72],1),s='';
    s+=poly([P(0,0,0),P(90,0,0),P(90,0,70),P(0,0,70)],'f w');
    s+=poly([P(0,0,0),P(90,0,0),P(90,70,0),P(0,70,0)],'f w');
    var A=P(50,35,40),A2=P(50,0,40),A1=P(50,35,0),Ax=P(50,0,0);
    s+=line(A,A2,'d')+line(A,A1,'d')+line(A2,Ax,'t')+line(A1,Ax,'t');
    s+='<circle class="p" cx="'+A[0]+'" cy="'+A[1]+'" r="3.4"/><circle class="p" cx="'+A2[0]+'" cy="'+A2[1]+'" r="2.8"/><circle class="p" cx="'+A1[0]+'" cy="'+A1[1]+'" r="2.8"/>';
    var t=P(80,0,60),t2=P(80,60,0);return s+'<text class="tx" x="'+t[0]+'" y="'+t[1]+'">π₂</text><text class="tx" x="'+t2[0]+'" y="'+t2[1]+'">π₁</text>';})();
  /* три вида детали: главный, сверху, слева, линии связи */
  ART.views='<path class="f w" d="M30 30h60v20H70v20H30z"/><path class="f w" d="M30 96h60v40H30z"/><path class="d" d="M70 96v40"/><path class="f w" d="M120 30h40v40h-40z"/><path class="w" d="M120 50h20v20"/>'+
    line([96,40],[114,40],'t')+line([96,60],[114,60],'t')+line([30,74],[30,92],'t')+line([90,74],[90,92],'t');
  /* деталь в изометрии с четвертным вырезом и штриховкой */
  ART.part=(function(){var P=iso([100,66],1.05),W=86,D=60,H=46,s='';
    s+=poly([P(0,0,H),P(W,0,H),P(W,D/2,H),P(W/2,D/2,H),P(W/2,D,H),P(0,D,H)],'f w');
    s+=poly([P(W,0,0),P(W,D/2,0),P(W,D/2,H),P(W,0,H)],'f w');
    s+=poly([P(0,D,0),P(W/2,D,0),P(W/2,D,H),P(0,D,H)],'f w');
    s+=poly([P(W/2,D/2,0),P(W,D/2,0),P(W,D/2,H),P(W/2,D/2,H)],'y');
    s+=poly([P(W/2,D/2,0),P(W/2,D,0),P(W/2,D,H),P(W/2,D/2,H)],'y');
    for(var i=1;i<6;i++){s+=line(P(W/2+i*7,D/2,0),P(W/2+i*7-12,D/2,H),'t');}
    return s+line(P(W/2,D/2,-14),P(W/2,D/2,H+24),'x');})();
  /* куб и секущая плоскость */
  ART.cube=(function(){var P=iso([108,64],1.05),a=64;
    return poly([P(0,0,a),P(a,0,a),P(a,a,a),P(0,a,a)],'f w')+poly([P(a,0,0),P(a,a,0),P(a,a,a),P(a,0,a)],'f w')+poly([P(0,a,0),P(a,a,0),P(a,a,a),P(0,a,a)],'f w')+poly([P(a,0,a*.25),P(a,a,a*.75),P(0,a,a*.75)],'y');})();
  /* полый шар со сквозным отверстием */
  ART.sphere='<circle class="f w" cx="110" cy="84" r="62"/><ellipse class="t" cx="110" cy="84" rx="62" ry="16"/><circle class="d" cx="110" cy="84" r="40"/>'+
    '<path class="y" d="M98 22h24v124H98z" fill-opacity=".35"/><path class="h" d="M98 24v120M122 24v120"/>'+line([110,8],[110,160],'x')+line([36,84],[184,84],'x');
  /* тело с цилиндрическим отверстием */
  ART.hole=(function(){var P=iso([100,60],1.1),W=84,D=56,H=40,s='';
    s+=poly([P(0,0,H),P(W,0,H),P(W,D,H),P(0,D,H)],'f w');
    s+=poly([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'f w');
    s+=poly([P(0,D,0),P(W,D,0),P(W,D,H),P(0,D,H)],'f w');
    var c=P(W/2,D/2,H),c0=P(W/2,D/2,0);
    s+='<ellipse class="y" cx="'+c[0]+'" cy="'+c[1]+'" rx="22" ry="12.5"/>'+line([c[0]-22,c[1]],[c0[0]-22,c0[1]],'d')+line([c[0]+22,c[1]],[c0[0]+22,c0[1]],'d');
    return s+line(P(W/2,D/2,-14),P(W/2,D/2,H+26),'x');})();
  /* сквозное отверстие K: брусок, призматический проём насквозь */
  ART.through=(function(){var P=iso([100,60],1.1),W=84,D=56,H=40,a=30,b=54,s='';
    s+=poly([P(0,0,H),P(W,0,H),P(W,D,H),P(0,D,H)],'f w');
    s+=poly([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'f w');
    s+=poly([P(0,D,0),P(W,D,0),P(W,D,H),P(0,D,H)],'f w');
    s+=poly([P(a,D,10),P(b,D,10),P(b,D,30),P(a,D,30)],'y');
    s+=line(P(a,D,30),P(a,0,30),'d')+line(P(b,D,10),P(b,0,10),'d');
    return s+line(P(W/2,D/2,-14),P(W/2,D/2,H+26),'x');})();

  var PAL={blue:'#2f5bff',violet:'#6b3cf5',rose:'#f0305a',amber:'#ffb000',green:'#0aa36a',orange:'#fa4b00',cyan:'#00a6d6',graphite:'#2c2c30'};
  /* вид карточки и срок сдачи (неделя семестра). Сроки ЧЕРНОВЫЕ — в коде сайта их нет; вписать по плану кафедры.
     ДЗ, которого нет в таблице, получает рисунок и цвет по умолчанию и последнюю неделю. */
  var LOOK={
    ng1:{a:'epure',col:'blue',w:4},   ig2:{a:'views',col:'green',w:5},     ng2:{a:'cube',col:'violet',w:6},
    ig3:{a:'part',col:'rose',w:8},    ng3:{a:'planes',col:'amber',w:9},    ig4:{a:'body',col:'graphite',w:11,vb:'0 0 200 160'},
    ng4:{a:'inter',col:'orange',w:13},ig5:{a:'hole',col:'cyan',w:14,vb:'0 0 200 160'},
    ng5:{a:'hyp',col:'violet',w:16,vb:'0 0 230 172'},ig6:{a:'sphere',col:'rose',w:16,vb:'0 0 220 170'},
    ig8:{a:'through',col:'blue',w:17,vb:'0 0 200 160'}};
  var CN={ng:'Начерт',ig:'Инж. графика'};
  var DZ=DZR.list().map(function(d){var l=LOOK[d.id]||{a:'cube',col:'graphite',w:17};
    return {id:d.id,c:d.course,n:d.num,t:d.title,a:l.a,col:l.col,w:l.w,vb:l.vb,d:d};});

  /* календарь семестра: 1-я неделя с пн 31 авг 2026 (как RKS на сайте); срок — пятница недели */
  var DAY=864e5,W1=Date.UTC(2026,7,31),MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','нояб','дек'],WD=['вс','пн','вт','ср','чт','пт','сб'];
  function due(x){return W1+((x.w-1)*7+4)*DAY;}
  function human(t,wd){var d=new Date(t);return (wd?WD[d.getUTCDay()]+', ':'')+d.getUTCDate()+' '+MON[d.getUTCMonth()];}
  function today(){var r=new Date();return Date.UTC(r.getFullYear(),r.getMonth(),r.getDate());}

  /* вариант — общий для всего сайта */
  function getV(){try{return typeof dzVar==='function'?dzVar():0;}catch(e){return 0;}}
  function setV(n){try{if(typeof dzSetVar==='function') dzSetVar(n);}catch(e){}}
  var S={c:'all',v:getV(),today:today()};
  try{var sc0=localStorage.getItem('nch2_dzdeck_c');if(sc0==='ng'||sc0==='ig') S.c=sc0;}catch(e){}

  /* ── разметка ── */
  var root=document.createElement('div');root.id='nd';
  root.innerHTML='<div class="in">'+
    '<div class="hd"><div><h1>Мои ДЗ</h1><button type="button" class="vbtn" id="nd-vbtn" aria-label="Сменить вариант"><span id="nd-vtx"></span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>'+
      '<button type="button" class="now" id="nd-now" aria-label="К актуальному заданию" title="К актуальному"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button></div>'+
    '<div class="flt" id="nd-flt">'+[['all','Все'],['ng','Начерт'],['ig','Инж. графика']].map(function(x){return '<button type="button" data-c="'+x[0]+'" aria-pressed="'+(S.c===x[0])+'">'+x[1]+'</button>';}).join('')+'</div>'+
    '<div class="sc" id="nd-sc" tabindex="0" aria-label="Домашние задания, листайте вверх и вниз"><div class="stage" id="nd-stage"></div></div>'+
    '<nav class="tabs" aria-label="Разделы">'+
      '<a class="tb" href="#/"><svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z"/></svg><span>Главная</span></a>'+
      '<a class="tb" href="#/ng/tasks" id="nd-wb"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/></svg><span>Тетрадь</span></a>'+
      '<a class="tb on" href="#/dz" aria-current="page"><svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 14l2 2 4-4"/></svg><span>ДЗ</span></a>'+
      '<a class="tb" href="#/ng/rk2"><svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M18.5 6.5l1.5-1.5"/></svg><span>РК</span></a>'+
      '<a class="tb" href="#/ng/path" id="nd-th"><svg viewBox="0 0 24 24"><path d="M3 5.5c3-1 6-.6 9 1.4V20c-3-2-6-2.4-9-1.4zM21 5.5c-3-1-6-.6-9 1.4V20c3-2 6-2.4 9-1.4z"/></svg><span>Теория</span></a>'+
    '</nav>'+
    '<div class="veil" id="nd-veil"></div>'+
    '<section class="det" id="nd-det" role="region"></section>'+
    '<section class="sheet" id="nd-sheet" role="dialog" aria-modal="true" aria-label="Задание"></section>'+
    '<label class="hp" id="nd-hp" aria-hidden="true"><input type="checkbox" switch tabindex="-1" id="nd-hpin"></label>'+
  '</div>';
  document.body.appendChild(root);
  var $=function(id){return document.getElementById('nd-'+id);};
  var sc=$('sc'),stage=$('stage'),nowB=$('now'),sheet=$('sheet');

  var L=[],els=[],act=0,G={},built=false,FX=-1;
  var PX=104;                 /* сколько пикселей ведёт палец на одну карточку (один «щелчок») */
  var PA=44,NA=3;             /* полоска прошедшей карточки сверху и сколько их видно */
  var PB=42,NB=3,GAP=16;      /* полоска следующей карточки снизу, сколько видно, зазор под раскрытой */
  var TOP0=10,BOT=92;         /* отступ сверху и место под нижнее меню */
  var REDUCE=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  function list(){return DZ.filter(function(x){return S.c==='all'||x.c===S.c;}).sort(function(a,b){return due(a)-due(b)||(a.c<b.c?-1:1);});}
  function actual(){for(var i=0;i<L.length;i++) if(due(L[i])>=S.today) return i; return L.length-1;}
  function vtxt(){return S.v?'Вариант '+S.v:'Выбрать вариант';}

  function status(x,i){var d=due(x);
    if(i===act&&d>=S.today){var left=Math.round((d-S.today)/DAY);return '<span class="chip st cur"><i></i>'+(left===0?'Сдать сегодня':'Сейчас · до '+human(d,1))+'</span>';}
    if(d<S.today) return '<span class="chip st past">было до '+human(d)+'</span>';
    return '<span class="chip st">до '+human(d)+'</span>';}

  function cardHTML(x,i){return '<svg class="art" viewBox="'+(x.vb||'0 0 210 160')+'" aria-hidden="true">'+ART[x.a]+'</svg>'+
    '<div class="top"><span class="chip">'+CN[x.c]+' · №'+x.n+'</span>'+status(x,i)+'</div>'+
    '<div class="ttl">'+x.t+'</div><div class="var">'+(S.v?'Вариант '+S.v:'Вариант не выбран')+'</div>'+
    '<div class="word">Задание</div><div class="num" aria-hidden="true">'+x.n+'</div>';}

  /* последнее записанное в стиль каждой карточки — пишем только то, что изменилось */
  var C=[];
  function build(keep){
    var id=keep&&L[Math.round(M.p)];
    L=list();act=actual();
    stage.innerHTML='';els=[];C=[];
    L.forEach(function(x,i){
      var b=document.createElement('div');b.setAttribute('role','button');b.className='k'+(x.col==='amber'?' dk':'');b.style.setProperty('--c',PAL[x.col]);
      b.setAttribute('aria-label','Задание '+x.n+', '+CN[x.c]+': '+x.t);b.dataset.i=i;b.innerHTML=HL+cardHTML(x,i);
      b.style.zIndex=10+i;   /* ниже лежащая карточка всегда ближе — порядок постоянный, z не трогаем в кадре */
      stage.appendChild(b);els.push(b);C.push({t:'',o:-1,v:''});});
    geo();
    var to=act;if(id){var j=L.indexOf(id);if(j>=0)to=j;}
    M.p=M.to=to;M.v=0;M.cur=to;render();built=true;}

  /* на низком экране стопки короче: меньше полосок сверху и снизу — раскрытая карточка не уходит под меню */
  function geo(){var H=stage.clientHeight,ch=0;G.H=H;
    for(NA=3;NA>=1;NA--){ch=H-TOP0-NA*PA-GAP-PB*(NA>1?2:1)-BOT;if(ch>=280) break;}
    if(NA<1) NA=1;G.ch=Math.round(Math.max(200,Math.min(420,ch)));
    for(var i=0;i<els.length;i++){els[i].style.height=G.ch+'px';els[i].style.setProperty('--ch',G.ch+'px');}}

  /* раскладка колоды: d — расстояние карточки от раскрытой (0 — раскрыта, <0 — прошла и лежит полоской сверху,
     >0 — впереди, полоской снизу) */
  function pos(d,p){var T=TOP0+Math.min(Math.max(p,0),NA)*PA,ch=G.ch,y,s=1,o=1;
    if(d<=0){var e=Math.max(d,-(NA+.7));y=T+e*PA;s=1+e*.012;o=d<-NA-.1?Math.max(0,1-(-d-NA-.1)/.6):1;}
    else if(d<=1){y=T+d*(ch+GAP);}
    else{var e2=Math.min(d-1,NB+.5);y=T+ch+GAP+e2*PB;o=d>NB+1.2?Math.max(0,1-(d-NB-1.2)/.6):1;}
    return {y:y,s:s,o:o};}
  function put(i,q){var k=els[i],c=C[i],t='translate3d(0,'+q.y.toFixed(1)+'px,0) scale('+q.s.toFixed(3)+')',o=+q.o.toFixed(2),v=o<=0?'hidden':'visible';
    if(c.t!==t){k.style.transform=t;c.t=t;}
    if(c.o!==o){k.style.opacity=o;c.o=o;}
    if(c.v!==v){k.style.visibility=v;c.v=v;}
  }
  function render(){if(FX>=0) return;var p=M.p;
    for(var i=0;i<els.length;i++) put(i,pos(i-p,p));
    var away=Math.abs(p-act)>.5;if(away!==render.away){render.away=away;nowB.classList.toggle('on',away);nowB.disabled=!away;}}

  /* ── отклик, как у колёсика Apple Watch ──
     Android (Chrome): navigator.vibrate — «тик» на каждую карточку и при протаскивании, и при инерции.
     iPhone (Safari): вибрации у сайтов нет. Системный щелчок даёт только переключатель <input switch>, и с iOS 26.5
     — лишь от НАСТОЯЩЕГО касания пальцем (переключение скриптом молчит). Поэтому всё, на что нажимают, накрыто
     прозрачной подписью этого переключателя (HL): палец сам щёлкает его — iPhone отдаёт «тик». Во время свайпа
     касание не считается нажатием, так что на iPhone щелчок — на каждое касание, а при ведении пальцем колода
     «прилипает» к каждой карточке (magnet). На iOS 18 – 26.4 срабатывает и щелчок скриптом — его тоже зовём. */
  var HL='<label class="hl" for="nd-hpin" aria-hidden="true"></label>';
  var hp=$('hp'),lastT=0,IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function buzz(ms){try{if(navigator.vibrate) navigator.vibrate(ms);}catch(e){} if(IOS) try{hp.click();}catch(e){}}
  function tick(){var t=performance.now();if(t-lastT<30) return;lastT=t;buzz(10);}
  /* щелчок от касания подписи уже прозвучал на iPhone — второй скриптом не нужен */
  function tapTick(e){if(IOS&&e&&e.target&&e.target.classList&&e.target.classList.contains('hl')){try{if(navigator.vibrate) navigator.vibrate(10);}catch(x){}lastT=performance.now();return;}tick();}
  /* подпись внутри ссылки забирает её переход — переходим сами */
  root.addEventListener('click',function(e){var l=e.target.closest&&e.target.closest('.hl');if(!l) return;var a=l.closest('a[href]');if(a) location.hash=a.getAttribute('href').replace(/^.*#/,'#');});
  function addHL(el){if(el&&!el.querySelector(':scope > .hl')) el.insertAdjacentHTML('afterbegin',HL);}

  /* пересёк ли центр очередной карточки — тогда щелчок */
  function detent(){var r=Math.max(0,Math.min(L.length-1,Math.round(M.p)));if(r!==M.cur){M.cur=r;tick();}
    var over=M.p<-.18||M.p>L.length-1+.18;if(over&&!M.bump){M.bump=true;buzz(22);}else if(!over) M.bump=false;}

  /* ── движок: палец ведёт колоду 1:1, отпустил — инерция и пружина к ближайшей карточке ── */
  var M={p:0,to:0,v:0,cur:0,bump:false,raf:0,drag:null,last:0};root.__m=M;   /* для проверок */
  /* защёлка под пальцем: возле каждой карточки колода «прилипает», между ними — перескакивает */
  function magnet(r){var n=Math.floor(r),f=r-n,g=f<.5?4*f*f*f:1-4*(1-f)*(1-f)*(1-f);return n+g;}
  function clampRubber(p){var max=L.length-1;if(p<0) return -(1-1/(-p*0.9+1))/0.9*0.6;if(p>max) return max+(1-1/((p-max)*0.9+1))/0.9*0.6;return p;}
  function loop(t){M.raf=0;var dt=Math.min(32,t-(M.last||t))/1000;M.last=t;
    /* пружина с лёгким перелётом: жёсткость 260, демпфирование 24 */
    var k=260,c=24,steps=Math.max(1,Math.round(dt/0.004)),h=dt/steps;
    for(var s=0;s<steps;s++){var a=-k*(M.p-M.to)-c*M.v;M.v+=a*h;M.p+=M.v*h;}
    detent();render();
    if(Math.abs(M.p-M.to)>.0005||Math.abs(M.v)>.002) M.raf=requestAnimationFrame(loop);else{M.p=M.to;M.v=0;render();}}
  function kick(){if(!M.raf){M.last=0;M.raf=requestAnimationFrame(loop);}}
  function go(i){M.to=Math.max(0,Math.min(L.length-1,i));if(REDUCE){M.p=M.to;M.v=0;detent();render();return;}kick();}

  stage.addEventListener('pointerdown',function(e){if(FX>=0||e.button) return;
    if(M.raf){cancelAnimationFrame(M.raf);M.raf=0;}
    M.drag={id:e.pointerId,y0:e.clientY,p0:M.p,raw:M.p,moved:false,hist:[[performance.now(),e.clientY]]};});
  stage.addEventListener('pointermove',function(e){var d=M.drag;if(!d||e.pointerId!==d.id) return;var dy=e.clientY-d.y0;
    if(!d.moved){if(Math.abs(dy)<5) return;d.moved=true;try{stage.setPointerCapture(e.pointerId);}catch(x){}}
    d.raw=d.p0-dy/PX;M.p=clampRubber(magnet(d.raw));M.v=0;
    var now=performance.now();d.hist.push([now,e.clientY]);while(d.hist.length>2&&now-d.hist[0][0]>90) d.hist.shift();
    detent();          /* синхронно в событии касания — так iPhone отдаёт щелчок */
    if(!M.rr) M.rr=requestAnimationFrame(function(){M.rr=0;render();});});
  function release(e){var d=M.drag;if(!d||(e&&e.pointerId!==d.id)) return;M.drag=null;if(!d.moved) return;
    var h=d.hist,a=h[0],b=h[h.length-1],vy=b[0]-a[0]>0?(b[1]-a[1])/(b[0]-a[0]):0;   /* пикс/мс */
    var vp=-vy*1000/PX;                                                              /* карточек/с */
    /* проекция броска, как в iOS: куда доехала бы колода с этой скоростью */
    var target=Math.round(M.p+vp*0.22);
    target=Math.max(0,Math.min(L.length-1,target));
    M.v=Math.max(-40,Math.min(40,vp));M.to=target;stage.dataset.moved='1';setTimeout(function(){stage.dataset.moved='';},40);
    if(REDUCE){M.p=M.to;M.v=0;detent();render();}else kick();}
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  /* потеря захвата — только самой сцены (захват с карточки на сцену при начале протаскивания — не отпускание) */
  stage.addEventListener('lostpointercapture',function(e){if(e.target===stage) release(e);});

  /* колесо мыши и тачпад: копим прокрутку, каждые ~60 пикселей — следующая карточка */
  var wacc=0,wt=0;
  sc.addEventListener('wheel',function(e){if(FX>=0) return;e.preventDefault();var now=performance.now();if(now-wt>220) wacc=0;wt=now;
    wacc+=e.deltaMode===1?e.deltaY*30:e.deltaY;var th=60;
    while(Math.abs(wacc)>=th){var s=wacc>0?1:-1;wacc-=s*th;var n=Math.max(0,Math.min(L.length-1,Math.round(M.to)+s));if(n===M.to){if(!M.bump){M.bump=true;buzz(22);}}else M.bump=false;go(n);}},{passive:false});

  stage.addEventListener('click',function(e){if(stage.dataset.moved) return;var k=e.target.closest('.k');if(!k) return;var i=+k.dataset.i;
    if(FX>=0){unfocus(e);return;}
    if(i===Math.round(M.p)) openTask(i,e); else {tapTick(e);M.cur=i;go(i);}});
  stage.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('k')){e.preventDefault();e.target.click();}});
  sc.addEventListener('keydown',function(e){var r=Math.round(M.to);
    if(e.key==='ArrowDown'){e.preventDefault();go(r+1);} else if(e.key==='ArrowUp'){e.preventDefault();go(r-1);}
    else if(e.key==='Enter'&&e.target===sc){openTask(r);}});
  nowB.addEventListener('click',function(e){tapTick(e);M.cur=act;go(act);});

  /* плавная смена раскладки (появление, раскрытие, закрытие): пружинистый переход CSS, потом снова покадрово */
  var EASE='cubic-bezier(.2,.9,.22,1.08)';
  function animate(ms,stagger){if(REDUCE) return;els.forEach(function(k,i){var dl=(stagger?i*stagger:0)+'ms';k.style.transition='transform '+ms+'ms '+EASE+' '+dl+', opacity '+Math.round(ms*.6)+'ms ease '+dl;});
    clearTimeout(animate.t);animate.t=setTimeout(function(){els.forEach(function(k){k.style.transition='';});},ms+(stagger?els.length*stagger:0)+40);}
  /* появление: карточки въезжают снизу одна за другой */
  function intro(){if(REDUCE){render();return;}var H=G.H||600;
    els.forEach(function(k,i){k.style.transition='';put(i,{y:H+40+i*30,s:.96,o:1});});
    void stage.offsetWidth;animate(620,35);render();}

  /* ── листы ── */
  var back=null;
  function openSheet(html,label){back=document.activeElement;sheet.innerHTML='<button type="button" class="grab" aria-label="Закрыть"></button>'+html;
    sheet.setAttribute('aria-label',label);root.classList.add('nd-open');setTimeout(function(){var g=sheet.querySelector('.go,[aria-pressed=true],.grab');if(g) g.focus({preventScroll:true});},60);}
  function closeSheet(){if(!root.classList.contains('nd-open')) return;root.classList.remove('nd-open');if(back&&back.focus) try{back.focus({preventScroll:true});}catch(e){}}
  $('veil').addEventListener('click',closeSheet);
  /* раскрытие, как в Wallet: карточка поднимается наверх, остальные уезжают вниз, под ней выезжает «что внутри» */
  function focus(i,html,label,ev){if(ev) tapTick(ev); else buzz(18);if(M.raf){cancelAnimationFrame(M.raf);M.raf=0;}M.p=M.to=i;M.v=0;var H=G.H;animate(560,0);
    els.forEach(function(k,j){if(j===i){put(j,{y:TOP0,s:1,o:1});k.style.zIndex=999;}
      else put(j,{y:H+30+Math.abs(j-i)*14,s:.94,o:j>i?1:0});});FX=i;sc.classList.add('lock');
    det.innerHTML=html;det.setAttribute('aria-label',label);det.style.top=(sc.offsetTop+TOP0+G.ch+14)+'px';det.scrollTop=0;
    back=document.activeElement;root.classList.add('nd-fx');setTimeout(function(){var g=det.querySelector('.go');if(g) try{g.focus({preventScroll:true});}catch(e){}},400);}
  function unfocus(e){if(FX<0) return;els[FX].style.zIndex=10+FX;FX=-1;tapTick(e);root.classList.remove('nd-fx');sc.classList.remove('lock');animate(520,0);render();
    if(back&&back.focus) try{back.focus({preventScroll:true});}catch(e){}}
  var det=$('det');det.addEventListener('click',function(e){if(e.target.closest('a')) {tapTick(e);if(FX>=0) els[FX].style.zIndex=10+FX;FX=-1;root.classList.remove('nd-fx');sc.classList.remove('lock');}});
  sheet.addEventListener('click',function(e){if(e.target.closest('.grab')||e.target.closest('a')) closeSheet();
    var b=e.target.closest('[data-v]');if(b){S.v=+b.dataset.v;setV(S.v);tapTick(e);closeSheet();paint();build(true);}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOn()){if(root.classList.contains('nd-open')) closeSheet(); else unfocus();}});

  /* что внутри задания — ссылки на вкладки настоящего ДЗ (как dzPills на сайте) */
  function H(){return '#/'+[].slice.call(arguments).map(encodeURIComponent).join('/');}
  function openTask(i,ev){var x=L[i],d=x.d,v=S.v,ok=v&&DZR.has(x.id,v),ng=x.c==='ng',R=[];
    R.push([ng?'Разбор по шагам':'Решение',ok?H(x.id,v):H(x.id)]);
    if(ng&&ok&&x.id==='ng3') R.push(['Как на листе',H(x.id,v,'sheet')]);
    if(ng&&ok){R.push(['Чистовик',H(x.id,v,'list')]);R.push(['Черновик',H(x.id,v,'draft')]);}
    if(d.method){R.push(['Как решать',H(x.id,'how')]);R.push(['Ошибки и защита',H(x.id,'faq')]);}
    var note=!v?'Вариант не выбран — выбери его на странице задания или кнопкой «вариант» вверху.':ok?'Вариант '+v+' разобран по шагам.':'Вариант '+v+' ещё в работе — пока есть методика и разборы других вариантов.';
    focus(i,'<h2>'+x.t+'</h2><p>Сдать до '+human(due(x),1)+' · '+x.w+'-я неделя (срок примерный). '+note+'</p>'+
      '<a class="go" href="'+(ok?H(x.id,v):H(x.id))+'">'+(ok?'Открыть мой вариант '+v:'Открыть задание')+'</a>'+
      '<ul class="rows">'+R.map(function(r){return '<li><a href="'+r[1]+'">'+r[0]+'</a></li>';}).join('')+'</ul>'+
      '<button type="button" class="cls">Назад к колоде</button>','Задание '+x.n+', '+CN[x.c],ev);
    det.querySelectorAll('a,.cls').forEach(addHL);}
  det.addEventListener('click',function(e){if(e.target.closest('.cls')) unfocus(e);});

  function openVar(){var h='<h2>Мой вариант</h2><p>Один номер на все ДЗ — как на сайте.</p><div class="vg">';
    for(var n=1;n<=30;n++) h+='<button type="button" data-v="'+n+'" aria-pressed="'+(n===S.v)+'">'+n+'</button>';
    openSheet(h+'</div>','Выбор варианта');sheet.querySelectorAll('[data-v],.grab').forEach(addHL);}
  $('vbtn').addEventListener('click',function(e){tapTick(e);openVar();});

  /* всё постоянное, на что нажимают, — с подписью переключателя (щелчок на iPhone) */
  [].forEach.call(root.querySelectorAll('#nd-flt button,#nd-now,#nd-vbtn,#nd .tabs a'),addHL);
  $('flt').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.dataset.c===S.c) return;S.c=b.dataset.c;
    try{localStorage.setItem('nch2_dzdeck_c',S.c);}catch(e2){}
    this.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});tapTick(e);build(false);intro();});

  /* тема — как у сайта (html[data-theme]) */
  function paint(){root.classList.toggle('nd-dark',document.documentElement.getAttribute('data-theme')==='dark');
    $('vtx').textContent=vtxt();$('vbtn').classList.toggle('no',!S.v);
    var ig=S.c==='ig';$('wb').setAttribute('href',ig?'#/ig/wb':'#/ng/tasks');$('th').setAttribute('href',ig?'#/ig/theory':'#/ng/path');}
  new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

  /* показ: только на самом #/dz */
  function isOn(){return /^#\/dz\/?$/.test(location.hash);}
  function sync(){var on=isOn();document.documentElement.classList.toggle('nd-on',on);
    if(!on){closeSheet();if(FX>=0){els[FX].style.zIndex=10+FX;FX=-1;root.classList.remove('nd-fx');sc.classList.remove('lock');}return;}
    var v=getV(),t=today();if(v!==S.v||t!==S.today||!built){S.v=v;S.today=t;paint();build(built);} else geo();
    intro();}
  window.addEventListener('hashchange',sync);
  window.addEventListener('resize',function(){if(isOn()){geo();if(FX>=0) det.style.top=(sc.offsetTop+TOP0+G.ch+14)+'px'; else render();}});
  paint();sync();
})();
