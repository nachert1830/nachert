/* Экран «ДЗ» (адрес #/dz): колода карточек по сроку сдачи, листается со щелчком (вибрация).
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
  /* рисунки карточек — сплошные тела в стиле главной: грани белые/голубые с тёмно-синим контуром,
     жёлтое — главное в задании (вырез, сечение, отверстие), красное — искомые линии; тень на «столе».
     Классы: sT верх, sR грань справа, sL грань слева, sY/sYd жёлтые грани, sD тёмная полость, sO контур,
     sN тонкая линия, sNd штриховая, sX осевая, sK искомая (красная), sP лист бумаги, sS тень, sTx подпись. */
  function face(P,cls){return poly(P,cls+' sO');}
  function shadow(cx,cy,rx,ry){return '<ellipse class="sS" cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'"/>';}
  var ART={};
  /* начерт 5 «Прямая и поверхность, касательная плоскость»: шар, касательная плоскость в точке T, прямая пронзает шар в M и N */
  ART.hyp=(function(){var cx=106,cy=104,R=44,T=[cx,cy-R],s=shadow(cx,cy+R+8,56,10);
    s+='<circle class="sSph sO" cx="'+cx+'" cy="'+cy+'" r="'+R+'"/>';
    s+='<path class="sO" fill="none" opacity=".35" d="M'+(cx-R)+' '+cy+'A'+R+' 13 0 0 0 '+(cx+R)+' '+cy+'"/>';
    /* касательная плоскость лежит на шаре сверху, касается в T */
    s+='<path class="sPl sO" d="M'+(T[0]-74)+' '+(T[1]+6)+'L'+(T[0]+6)+' '+(T[1]-22)+'L'+(T[0]+78)+' '+(T[1]-8)+'L'+(T[0]-2)+' '+(T[1]+20)+'Z"/>';
    s+='<circle class="sY sO" cx="'+T[0]+'" cy="'+(T[1]-1)+'" r="5"/>';
    /* прямая пронзает шар: точки входа M и выхода N — пересечение с очерком; внутри — штриховая */
    var A=[14,168],B=[204,96],dx=B[0]-A[0],dy=B[1]-A[1],fx=A[0]-cx,fy=A[1]-cy,qa=dx*dx+dy*dy,qb=2*(fx*dx+fy*dy),qc=fx*fx+fy*fy-R*R,dd=Math.sqrt(qb*qb-4*qa*qc),
      t1=(-qb-dd)/(2*qa),t2=(-qb+dd)/(2*qa),M=[f(A[0]+dx*t1),f(A[1]+dy*t1)],N=[f(A[0]+dx*t2),f(A[1]+dy*t2)];
    s+=line(A,M,'sKl')+line(M,N,'sKd')+line(N,B,'sKl');
    s+='<circle class="sKp" cx="'+M[0]+'" cy="'+M[1]+'" r="5"/><circle class="sKp" cx="'+N[0]+'" cy="'+N[1]+'" r="5"/>';
    return s+'<text class="sTx" x="'+(T[0]+8)+'" y="'+(T[1]-6)+'">T</text><text class="sTx" x="'+(M[0]-14)+'" y="'+(M[1]-6)+'">M</text><text class="sTx" x="'+(N[0]+4)+'" y="'+(N[1]+16)+'">N</text>';})();
  /* брусок с прямоугольным пазом сверху (ИГ 4) */
  ART.body=(function(){var P=iso([96,56],1.2),W=80,D=50,H=40,a=28,b=52,zc=18,s='';
    s+=shadow(100,128,78,16);
    s+=face([P(0,0,H),P(a,0,H),P(a,D,H),P(0,D,H)],'sT');
    s+=face([P(b,0,H),P(W,0,H),P(W,D,H),P(b,D,H)],'sT');
    s+=face([P(a,0,zc),P(b,0,zc),P(b,D,zc),P(a,D,zc)],'sY');
    s+=face([P(a,0,zc),P(a,D,zc),P(a,D,H),P(a,0,H)],'sYd');
    s+=face([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'sR');
    s+=face([P(0,D,0),P(W,D,0),P(W,D,H),P(b,D,H),P(b,D,zc),P(a,D,zc),P(a,D,H),P(0,D,H)],'sL');
    return s;})();
  /* лист с эпюром: ось x, проекции отрезка AB, линии связи (начерт 1) */
  ART.epure='<rect class="sS" x="26" y="20" width="176" height="136" rx="6"/><rect class="sP sO" x="20" y="12" width="176" height="136" rx="6"/>'+
    '<line class="sN" x1="32" y1="80" x2="184" y2="80"/><text class="sTx" x="174" y="74">x</text>'+
    line([74,30],[74,132],'sNd')+line([146,46],[146,118],'sNd')+'<path class="sK" d="M74 30L146 46M74 132L146 118"/>'+
    '<circle class="sPt" cx="74" cy="30" r="3.4"/><circle class="sPt" cx="146" cy="46" r="3.4"/><circle class="sPt" cx="74" cy="132" r="3.4"/><circle class="sPt" cx="146" cy="118" r="3.4"/>'+
    '<text class="sTx" x="54" y="28">A″</text><text class="sTx" x="152" y="44">B″</text><text class="sTx" x="54" y="144">A′</text><text class="sTx" x="152" y="130">B′</text>';
  /* сплошной конус и цилиндр насквозь, красные линии пересечения (начерт 4) */
  ART.inter=(function(){var ax=112,ay=14,by=146,R=50,cy=104,r=17,k=R/(by-ay),w=function(y){return k*(y-ay);};
    var crv=function(sg){var d='';for(var i=0;i<=20;i++){var y=cy-r+2*r*i/20,t=(y-cy)/r,dp=Math.sqrt(Math.max(0,1-t*t))*r*.8,x=ax+sg*Math.sqrt(Math.max(0,w(y)*w(y)-dp*dp));d+=(i?'L':'M')+f(x)+' '+f(y);}return d;};
    var Lc=crv(-1),Rc=crv(1);
    return shadow(112,156,92,12)+
      '<path class="sCone sO" d="M'+ax+' '+ay+'L'+(ax-R)+' '+by+'A'+R+' 11 0 0 0 '+(ax+R)+' '+by+'Z"/>'+
      '<path class="sCyl sO" d="M24 '+(cy-r)+Lc.replace(/^M/,'L')+'L24 '+(cy+r)+'Z"/>'+
      '<path class="sCyl sO" d="M194 '+(cy-r)+Rc.replace(/^M/,'L')+'L194 '+(cy+r)+'Z"/>'+
      '<ellipse class="sCap sO" cx="194" cy="'+cy+'" rx="7" ry="'+r+'"/>'+
      '<path class="sKw" d="'+Lc+'"/><path class="sK" d="'+Lc+'"/><path class="sKw" d="'+Rc+'"/><path class="sK" d="'+Rc+'"/>';})();
  /* плоскости проекций π1, π2 и точка в пространстве (начерт 3) */
  ART.planes=(function(){var P=iso([100,66],1),s='';
    s+=face([P(0,0,0),P(90,0,0),P(90,0,72),P(0,0,72)],'sR');
    s+=face([P(0,0,0),P(90,0,0),P(90,72,0),P(0,72,0)],'sT');
    var A=P(50,36,42),A2=P(50,0,42),A1=P(50,36,0),Ax=P(50,0,0);
    s+=line(A,A2,'sNd')+line(A,A1,'sNd')+line(A2,Ax,'sN')+line(A1,Ax,'sN');
    s+='<circle class="sKp" cx="'+A[0]+'" cy="'+A[1]+'" r="5"/><circle class="sPt" cx="'+A2[0]+'" cy="'+A2[1]+'" r="3.4"/><circle class="sPt" cx="'+A1[0]+'" cy="'+A1[1]+'" r="3.4"/>';
    var t=P(78,0,62),t2=P(80,62,0);return s+'<text class="sTx" x="'+t[0]+'" y="'+t[1]+'">π₂</text><text class="sTx" x="'+t2[0]+'" y="'+t2[1]+'">π₁</text>';})();
  /* лист с тремя видами детали, разрез заштрихован (ИГ 2) */
  ART.views=(function(){var s='<rect class="sS" x="26" y="20" width="176" height="136" rx="6"/><rect class="sP sO" x="20" y="12" width="176" height="136" rx="6"/>';
    s+='<path class="sV sO" d="M36 30h56v20H74v20H36z"/><path class="sV sO" d="M36 92h56v40H36z"/><path class="sNd" d="M74 92v40"/>';
    s+='<path class="sV sO" d="M116 30h44v40h-44z"/>';
    for(var i=0;i<7;i++){var x=118+i*7;s+='<path class="sHt" d="M'+x+' 70L'+(x+20)+' 50"/>';}
    s+='<path class="sO" fill="none" d="M116 50h22v20"/>';
    return s+line([96,40],[112,40],'sN')+line([96,60],[112,60],'sN')+line([36,74],[36,88],'sN')+line([92,74],[92,88],'sN');})();
  /* деталь с четвертным вырезом, сечение заштриховано (ИГ 3) */
  ART.part=(function(){var P=iso([100,60],1.1),W=86,D=60,H=46,s=shadow(104,138,84,16);
    s+=face([P(0,0,H),P(W,0,H),P(W,D/2,H),P(W/2,D/2,H),P(W/2,D,H),P(0,D,H)],'sT');
    s+=face([P(W,0,0),P(W,D/2,0),P(W,D/2,H),P(W,0,H)],'sR');
    s+=face([P(0,D,0),P(W/2,D,0),P(W/2,D,H),P(0,D,H)],'sL');
    s+=face([P(W/2,D/2,0),P(W,D/2,0),P(W,D/2,H),P(W/2,D/2,H)],'sY');
    s+=face([P(W/2,D/2,0),P(W/2,D,0),P(W/2,D,H),P(W/2,D/2,H)],'sYd');
    /* штриховка сечения под 45° в плоскости y = D/2: u — вдоль x от W/2, z — высота */
    var Wh=W/2;for(var c=-H+7;c<Wh;c+=7){var u0=Math.max(0,c),z0=u0-c,u1=Math.min(Wh,c+H),z1=u1-c;s+=line(P(W/2+u0,D/2,z0),P(W/2+u1,D/2,z1),'sHt');}
    return s;})();
  /* куб и сечение плоскостью (начерт 2) */
  ART.cube=(function(){var P=iso([108,56],1.1),a=64;
    return shadow(110,142,80,15)+face([P(0,0,a),P(a,0,a),P(a,a,a),P(0,a,a)],'sT')+face([P(a,0,0),P(a,a,0),P(a,a,a),P(a,0,a)],'sR')+face([P(0,a,0),P(a,a,0),P(a,a,a),P(0,a,a)],'sL')+
      face([P(a,0,a*.25),P(a,a,a*.75),P(0,a,a*.75)],'sY')+'<path class="sK" d="M'+P(a,0,a*.25).join(' ')+'L'+P(a,a,a*.75).join(' ')+'L'+P(0,a,a*.75).join(' ')+'"/>';})();
  /* полый шар: верх срезан, сечение — жёлтое кольцо, внутри полость (ИГ 6) */
  ART.sphere=(function(){var cx=110,cy=88,R=62,zc=-22,rc=Math.sqrt(R*R-zc*zc),ri=26;
    return shadow(cx,cy+R+6,66,11)+
      '<path class="sSph sO" d="M'+(cx-rc)+' '+(cy+zc)+'A'+R+' '+R+' 0 1 0 '+(cx+rc)+' '+(cy+zc)+'Z"/>'+
      '<ellipse class="sY sO" cx="'+cx+'" cy="'+(cy+zc)+'" rx="'+f(rc)+'" ry="'+f(rc*.3)+'"/>'+
      '<ellipse class="sD sO" cx="'+cx+'" cy="'+(cy+zc)+'" rx="'+ri+'" ry="'+f(ri*.3)+'"/>'+
      line([cx,cy+zc-40],[cx,cy+R+14],'sX');})();
  /* брусок с цилиндрическим отверстием (ИГ 5) */
  ART.hole=(function(){var P=iso([100,54],1.15),W=84,D=56,H=40,s=shadow(102,130,80,15);
    s+=face([P(0,0,H),P(W,0,H),P(W,D,H),P(0,D,H)],'sT');
    s+=face([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'sR');
    s+=face([P(0,D,0),P(W,D,0),P(W,D,H),P(0,D,H)],'sL');
    var c=P(W/2,D/2,H);
    s+='<ellipse class="sD sO" cx="'+c[0]+'" cy="'+c[1]+'" rx="22" ry="12.5"/>';
    s+='<path class="sY" d="M'+(c[0]-22)+' '+c[1]+'A22 12.5 0 0 1 '+(c[0]+22)+' '+c[1]+'L'+(c[0]+22)+' '+(c[1]+9)+'A22 12.5 0 0 0 '+(c[0]-22)+' '+(c[1]+9)+'Z" opacity=".95"/>';
    return s+'<ellipse class="sO" fill="none" cx="'+c[0]+'" cy="'+c[1]+'" rx="22" ry="12.5"/>';})();
  /* брусок со сквозным прямоугольным проёмом (ИГ 8) */
  ART.through=(function(){var P=iso([100,54],1.15),W=84,D=56,H=40,a=30,b=54,z0=10,z1=30,s=shadow(102,130,80,15);
    s+=face([P(0,0,H),P(W,0,H),P(W,D,H),P(0,D,H)],'sT');
    s+=face([P(W,0,0),P(W,D,0),P(W,D,H),P(W,0,H)],'sR');
    s+=face([P(0,D,0),P(W,D,0),P(W,D,H),P(0,D,H)],'sL');
    s+=face([P(a,D,z0),P(b,D,z0),P(b,D,z1),P(a,D,z1)],'sD');
    s+=face([P(a,D,z0),P(b,D,z0),P(b,D-20,z0),P(a,D-20,z0)],'sY');
    s+=face([P(a,D,z0),P(a,D,z1),P(a,D-20,z1),P(a,D-20,z0)],'sYd');
    return s;})();

  var PAL={blue:'#2a5ce8',violet:'#1d3f9e',rose:'#1386d6',amber:'#3b74ff',green:'#0f9fd8',orange:'#2f6bff',cyan:'#14a6e0',graphite:'#132a6b'};
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
    /* общие градиенты рисунков карточек */
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+
      '<linearGradient id="ndCone" x1="0" x2="1"><stop offset="0" stop-color="#a9bde9"/><stop offset=".4" stop-color="#ffffff"/><stop offset=".65" stop-color="#e4ebfb"/><stop offset="1" stop-color="#93aae0"/></linearGradient>'+
      '<linearGradient id="ndCyl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".4" stop-color="#ffcf3a"/><stop offset="1" stop-color="#d99a06"/></linearGradient>'+
      '<radialGradient id="ndSph" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d6e0f7"/><stop offset="1" stop-color="#93aae0"/></radialGradient>'+
      '<linearGradient id="ndHyp" x1="0" x2="1"><stop offset="0" stop-color="#9fb4e6"/><stop offset=".45" stop-color="#f4f7ff"/><stop offset="1" stop-color="#8ea6df"/></linearGradient>'+
    '</defs></svg>'+
  '</div>';
  document.body.appendChild(root);
  var $=function(id){return document.getElementById('nd-'+id);};
  var sc=$('sc'),stage=$('stage'),nowB=$('now'),sheet=$('sheet');

  var L=[],els=[],act=0,G={},built=false,FX=-1;
  var PX=170;                 /* сколько пикселей ведёт палец на одну карточку (один «щелчок»); считает geo() от высоты карточки */
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
    '<div class="top"><span class="chip">'+CN[x.c]+'</span></div>'+
    '<div class="ttl">'+x.t+'</div><div class="var">'+(S.v?'Вариант '+S.v:'Вариант не выбран')+'</div>'+
    '<div class="word">Задание</div><div class="num" aria-hidden="true">'+x.n+'</div>';}

  /* последнее записанное в стиль каждой карточки — пишем только то, что изменилось */
  var C=[];
  function build(keep){
    var id=keep&&L[Math.round(M.p)];
    L=list();act=actual();
    stage.innerHTML='';els=[];C=[];
    L.forEach(function(x,i){
      var b=document.createElement('div');b.setAttribute('role','button');b.className='k';b.style.setProperty('--c',PAL[x.col]);
      b.setAttribute('aria-label','Задание '+x.n+', '+CN[x.c]+': '+x.t);b.dataset.i=i;b.innerHTML=cardHTML(x,i);addHL(b);
      b.style.zIndex=10+i;   /* ниже лежащая карточка всегда ближе — порядок постоянный, z не трогаем в кадре */
      stage.appendChild(b);els.push(b);C.push({t:'',o:-1,v:'',k:-1});});
    geo();
    var to=act;if(id){var j=L.indexOf(id);if(j>=0)to=j;}
    M.p=M.to=to;M.v=0;M.cur=to;render();built=true;}

  /* на низком экране стопки короче: меньше полосок сверху и снизу — раскрытая карточка не уходит под меню */
  function geo(){var H=stage.clientHeight,ch=0;G.H=H;
    for(NA=3;NA>=1;NA--){ch=H-TOP0-NA*PA-GAP-PB*(NA>1?2:1)-BOT;if(ch>=280) break;}
    if(NA<1) NA=1;G.ch=Math.round(Math.max(200,Math.min(420,ch)));
    /* раскрытая карточка уезжает на (ch+GAP): палец проходит половину этого пути — колода идёт за пальцем, а не убегает от него */
    PX=Math.round(Math.max(150,Math.min(230,(G.ch+GAP)*.5)));
    for(var i=0;i<els.length;i++){els[i].style.height=G.ch+'px';els[i].style.setProperty('--ch',G.ch+'px');}}

  /* раскладка колоды: d — расстояние карточки от раскрытой (0 — раскрыта, <0 — прошла и лежит полоской сверху,
     >0 — впереди, полоской снизу) */
  function pos(d,p){var T=TOP0+Math.min(Math.max(p,0),NA)*PA,ch=G.ch,y,s=1,o=1,k=0;
    if(d<=0){var e=Math.max(d,-(NA+.7));y=T+e*PA;s=1+e*.014;o=d<-NA-.1?Math.max(0,1-(-d-NA-.1)/.6):1;k=Math.min(.3,-e*.1);}
    else if(d<=1){var u=d*d*(3-2*d);y=T+d*(ch+GAP);s=1-u*.02;}      /* следующая: из стопки подрастает до полного размера */
    else{var e2=Math.min(d-1,NB+.5);y=T+ch+GAP+e2*PB;s=.98-e2*.01;o=d>NB+1.2?Math.max(0,1-(d-NB-1.2)/.6):1;k=Math.min(.16,e2*.05);}
    return {y:y,s:s,o:o,k:k};}
  function put(i,q){var k=els[i],c=C[i],t='translate3d(0,'+q.y.toFixed(1)+'px,0) scale('+q.s.toFixed(3)+')',o=+q.o.toFixed(2),v=o<=0?'hidden':'visible',dk=+(q.k||0).toFixed(2);
    if(c.t!==t){k.style.transform=t;c.t=t;}
    if(c.k!==dk){k.style.setProperty('--dim',dk);c.k=dk;}
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
     прозрачной подписью со своим переключателем внутри (HL, как в библиотеке ios-haptics): палец сам щёлкает его —
     iPhone отдаёт «тик». Сам переключатель 1×1 и невидим (не под пальцем — иначе WebKit глушит жест). Во время свайпа
     касание не считается нажатием, так что на iPhone щелчок — на каждое касание, а при ведении пальцем колода
     «прилипает» к каждой карточке (magnet). На iOS 18 – 26.4 срабатывает и щелчок скриптом — его тоже зовём. */
  var HL='<label class="hl" aria-hidden="true"><input type="checkbox" switch tabindex="-1"></label>';
  function stopSw(e){e.stopPropagation();}   /* копия клика, которую подпись шлёт переключателю, не должна сработать второй раз */
  var hp=$('hp'),lastT=0,IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function buzz(ms){try{if(navigator.vibrate) navigator.vibrate(ms);}catch(e){} if(IOS) try{hp.click();}catch(e){}}
  function tick(){var t=performance.now();if(t-lastT<30) return;lastT=t;buzz(10);}
  /* щелчок от касания подписи уже прозвучал на iPhone — второй скриптом не нужен */
  function tapTick(e){if(IOS&&e&&e.target&&e.target.classList&&e.target.classList.contains('hl')){try{if(navigator.vibrate) navigator.vibrate(10);}catch(x){}lastT=performance.now();return;}tick();}
  /* подпись внутри ссылки забирает её переход — переходим сами */
  root.addEventListener('click',function(e){var l=e.target.closest&&e.target.closest('.hl');if(!l) return;var a=l.closest('a[href]');if(a) location.hash=a.getAttribute('href').replace(/^.*#/,'#');});
  function addHL(el){if(!el||el.querySelector(':scope > .hl')) return;el.insertAdjacentHTML('beforeend',HL);el.lastChild.firstChild.addEventListener('click',stopSw);}

  /* пересёк ли центр очередной карточки — тогда щелчок */
  function detent(){var r=Math.max(0,Math.min(L.length-1,Math.round(M.p)));if(r!==M.cur){M.cur=r;tick();}
    var over=M.p<-.18||M.p>L.length-1+.18;if(over&&!M.bump){M.bump=true;buzz(22);}else if(!over) M.bump=false;}

  /* ── движок: палец ведёт колоду 1:1, отпустил — инерция и пружина к ближайшей карточке ── */
  var M={p:0,to:0,v:0,cur:0,bump:false,raf:0,drag:null,last:0};root.__m=M;   /* для проверок */
  /* защёлка под пальцем: возле каждой карточки колода «прилипает», между ними — перескакивает */
  function magnet(r){return r-Math.sin(2*Math.PI*r)/(2*Math.PI)*.32;}
  function clampRubber(p){var max=L.length-1;if(p<0) return -(1-1/(-p*0.9+1))/0.9*0.6;if(p>max) return max+(1-1/((p-max)*0.9+1))/0.9*0.6;return p;}
  /* пружина как в iOS (response / dampingFraction): шаг на одну карточку ~0,36 с, бросок через пять — ~0,6 с; демпфирование почти критическое */
  function tune(dist){var r=.34+.055*Math.min(Math.abs(dist),5),k=Math.pow(2*Math.PI/r,2);M.k=k;M.c=2*Math.sqrt(k)*.94;}
  function loop(t){M.raf=0;var dt=Math.min(32,t-(M.last||t))/1000;M.last=t;
    var k=M.k||230,c=M.c||27,steps=Math.max(1,Math.round(dt/0.004)),h=dt/steps;
    for(var s=0;s<steps;s++){var a=-k*(M.p-M.to)-c*M.v;M.v+=a*h;M.p+=M.v*h;}
    detent();render();
    if(Math.abs(M.p-M.to)>.0005||Math.abs(M.v)>.002) M.raf=requestAnimationFrame(loop);else{M.p=M.to;M.v=0;render();}}
  function kick(){if(!M.raf){M.last=0;M.raf=requestAnimationFrame(loop);}}
  function go(i){M.to=Math.max(0,Math.min(L.length-1,i));tune(M.to-M.p);if(REDUCE){M.p=M.to;M.v=0;detent();render();return;}kick();}

  /* нажатая карточка чуть проседает (свойство scale — отдельно от transform, который пишет движок) */
  var pressed=null;function press(k){if(pressed===k) return;if(pressed) pressed.classList.remove('pr');pressed=k;if(k) k.classList.add('pr');}
  /* раскрытую карточку можно смахнуть вниз — закроется */
  var FD=null;
  stage.addEventListener('pointerdown',function(e){if(e.button) return;var k=e.target.closest('.k');
    if(FX>=0){if(k&&+k.dataset.i===FX){FD={id:e.pointerId,y0:e.clientY,dy:0,moved:false};press(k);}return;}
    if(M.raf){cancelAnimationFrame(M.raf);M.raf=0;}press(k);
    M.drag={id:e.pointerId,y0:e.clientY,p0:M.p,raw:M.p,moved:false,hist:[[performance.now(),e.clientY]]};});
  stage.addEventListener('pointermove',function(e){
    if(FD&&e.pointerId===FD.id){var fy=e.clientY-FD.y0;if(!FD.moved&&Math.abs(fy)<6) return;
      if(!FD.moved){FD.moved=true;press(null);try{stage.setPointerCapture(e.pointerId);}catch(x){}}
      FD.dy=fy>0?fy*.6:fy*.15;els[FX].style.transition='';els[FX].style.transform='translate3d(0,'+(TOP0+FD.dy).toFixed(1)+'px,0)';C[FX].t='';
      det.style.opacity=Math.max(0,1-FD.dy/160);return;}
    var d=M.drag;if(!d||e.pointerId!==d.id) return;var dy=e.clientY-d.y0;
    if(!d.moved){if(Math.abs(dy)<5) return;d.moved=true;press(null);try{stage.setPointerCapture(e.pointerId);}catch(x){}}
    d.raw=d.p0-dy/PX;M.p=clampRubber(magnet(d.raw));M.v=0;
    var now=performance.now();d.hist.push([now,e.clientY]);while(d.hist.length>2&&now-d.hist[0][0]>110) d.hist.shift();
    detent();          /* синхронно в событии касания — так iPhone отдаёт щелчок */
    if(!M.rr) M.rr=requestAnimationFrame(function(){M.rr=0;render();});});
  function release(e){press(null);
    if(FD&&(!e||e.pointerId===FD.id)){var f=FD;FD=null;if(!f.moved) return;mark();det.style.opacity='';
      if(f.dy>70){buzz(14);unfocus();} else {els[FX].style.transition='transform .35s '+EASE;put(FX,{y:TOP0,s:1,o:1});setTimeout(function(){if(FX>=0) els[FX].style.transition='';},380);}
      return;}
    var d=M.drag;if(!d||(e&&e.pointerId!==d.id)) return;M.drag=null;if(!d.moved) return;
    var vy=vel(d.hist,e&&e.timeStamp?performance.now():0);                         /* пикс/мс */
    var vp=-vy*1000/PX;                                                              /* карточек/с */
    /* проекция броска, как в iOS: куда доехала бы колода с этой скоростью при плавном торможении */
    var from=M.p,target=Math.round(from+vp*.2),sg=vp>0?1:-1;
    /* лёгкий щелчок пальцем уже листает: хватает 1,1 карточки/с, даже если не дотянул до середины */
    if(Math.abs(vp)>1.1){if(sg>0&&target<=Math.floor(from+.05)) target=Math.floor(from+.05)+1; if(sg<0&&target>=Math.ceil(from-.05)) target=Math.ceil(from-.05)-1;}
    target=Math.max(Math.round(from)-6,Math.min(Math.round(from)+6,target));          /* за один бросок — не больше шести */
    target=Math.max(0,Math.min(L.length-1,target));
    M.v=Math.max(-30,Math.min(30,vp));M.to=target;tune(target-from);mark();
    if(REDUCE){M.p=M.to;M.v=0;detent();render();}else kick();}
  /* скорость пальца: наклон прямой через точки последних ~100 мс (МНК), а не две крайние — меньше дрожи;
     палец остановился перед отпусканием (дольше 60 мс без движения) — броска нет */
  function vel(h,now){var n=h.length;if(n<2) return 0;var t1=h[n-1][0];if(now&&now-t1>60) return 0;
    var mt=0,my=0;for(var i=0;i<n;i++){mt+=h[i][0];my+=h[i][1];}mt/=n;my/=n;
    var sxy=0,sxx=0;for(var j=0;j<n;j++){var dt=h[j][0]-mt;sxy+=dt*(h[j][1]-my);sxx+=dt*dt;}
    return sxx>0?sxy/sxx:0;}
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  /* потеря захвата — только самой сцены (захват с карточки на сцену при начале протаскивания — не отпускание) */
  stage.addEventListener('lostpointercapture',function(e){if(e.target===stage) release(e);});

  function mark(){stage.dataset.moved='1';setTimeout(function(){stage.dataset.moved='';},60);}
  /* колесо мыши и тачпад: копим прокрутку, каждые ~60 пикселей — следующая карточка */
  var wacc=0,wt=0,W={raw:0,on:false,t:0,hist:[]};
  function mouseWheel(e){return e.deltaMode!==0||(Math.abs(e.deltaY)>=80&&Math.abs(e.deltaY)%1===0&&!e.deltaX);}
  function wheelEnd(){W.on=false;var h=W.hist,vp=0;
    if(h.length>1){var a=h[0],b=h[h.length-1];if(b[0]>a[0]) vp=(b[1]-a[1])/(b[0]-a[0])*1000;}
    var t=Math.round(M.p+Math.max(-1.5,Math.min(1.5,vp*.06)));M.v=0;go(t);}
  sc.addEventListener('wheel',function(e){if(FX>=0) return;e.preventDefault();var now=performance.now();
    if(mouseWheel(e)){if(now-wt>220) wacc=0;wt=now;wacc+=e.deltaMode===1?e.deltaY*30:e.deltaY;var th=60;
      while(Math.abs(wacc)>=th){var s=wacc>0?1:-1;wacc-=s*th;var n=Math.max(0,Math.min(L.length-1,Math.round(M.to)+s));if(n===M.to){if(!M.bump){M.bump=true;buzz(22);}}else M.bump=false;go(n);}
      return;}
    /* трекпад: прокрутка ведёт колоду 1:1 с магнитом, как палец; затихла — доводка к ближайшей карточке */
    if(!W.on){W.on=true;W.raw=M.p;W.hist=[];if(M.raf){cancelAnimationFrame(M.raf);M.raf=0;}}
    W.raw+=e.deltaY/(PX*1.15);var max=L.length-1;W.raw=Math.max(-.6,Math.min(max+.6,W.raw));
    M.p=clampRubber(magnet(W.raw));M.to=M.p;M.v=0;W.hist.push([now,W.raw]);while(W.hist.length>2&&now-W.hist[0][0]>100) W.hist.shift();
    detent();if(!M.rr) M.rr=requestAnimationFrame(function(){M.rr=0;render();});
    clearTimeout(W.t);W.t=setTimeout(wheelEnd,110);},{passive:false});

  stage.addEventListener('click',function(e){if(stage.dataset.moved) return;var k=e.target.closest('.k');if(!k) return;var i=+k.dataset.i;
    if(FX>=0){unfocus(e);return;}
    if(i===Math.round(M.p)) openTask(i,e); else {tapTick(e);M.cur=i;go(i);}});
  stage.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('k')){e.preventDefault();e.target.click();}});
  sc.addEventListener('keydown',function(e){var r=Math.round(M.to);
    if(e.key==='ArrowDown'){e.preventDefault();go(r+1);} else if(e.key==='ArrowUp'){e.preventDefault();go(r-1);}
    else if(e.key==='Enter'&&e.target===sc){openTask(r);}});
  nowB.addEventListener('click',function(e){tapTick(e);M.cur=act;go(act);});

  /* плавная смена раскладки (появление, раскрытие, закрытие): пружинистый переход CSS, потом снова покадрово */
  var EASE='cubic-bezier(.22,1,.36,1)';
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
    det.innerHTML=html;det.setAttribute('aria-label',label);det.style.top=(sc.offsetTop+TOP0+G.ch+14)+'px';det.scrollTop=0;det.style.opacity='';
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
    R.push([ng?'Разбор по шагам':'Разбор',ok?H(x.id,v):H(x.id)]);
    if(ng&&ok&&x.id==='ng3') R.push(['Как на листе',H(x.id,v,'sheet')]);
    if(ng&&ok){R.push(['Чистовик',H(x.id,v,'list')]);R.push(['Черновик',H(x.id,v,'draft')]);}
    if(d.method){R.push(['Как решать',H(x.id,'how')]);R.push(['Ошибки и защита',H(x.id,'faq')]);}
    var note=!v?'Вариант не выбран — выбери его на странице задания или кнопкой «вариант» вверху.':ok?'Вариант '+v+' разобран по шагам.':'Вариант '+v+' ещё в работе — пока есть методика и разборы других вариантов.';
    /* тот же «Путь к сдаче», что на карточке задания (window.dzRoute в index.html): 4 шага со статусом, «Сейчас» — с чего продолжить */
    var left=Math.round((due(x)-today())/DAY), when=left<0?'срок был '+human(due(x),1):'сдать до '+human(due(x),1)+(left===0?' · сегодня':' · через '+left+' дн.');
    var st=window.dzPath?window.dzPath(d):null;
    var route=st?'<p class="rth">Путь к сдаче</p><ol class="rt">'+st.S.map(function(x,j){return '<li class="'+(x.done?'ok':'')+(j===st.now?' cur':'')+'"><a href="'+x.h+'"><i>'+(x.done?'✓':j+1)+'</i><span><b>'+x.t+(j===st.now?' <em>Сейчас</em>':'')+'</b><small>'+x.s+'</small></span></a></li>';}).join('')+'</ol>'
      :'<ul class="rows">'+R.map(function(r){return '<li><a href="'+r[1]+'">'+r[0]+'</a></li>';}).join('')+'</ul>';
    focus(i,'<h2>'+x.t+'</h2>'+route+
      '<a class="go" href="'+H(x.id)+'">Открыть задание</a>'+
      '<button type="button" class="cls">Назад к колоде</button>','Задание '+x.n+', '+CN[x.c],ev);
    det.querySelectorAll('a,.cls').forEach(addHL);}
  det.addEventListener('click',function(e){if(e.target.closest('.cls')) unfocus(e);});

  function openVar(){var h='<h2>Мой вариант</h2><p>Один номер на все ДЗ — как на сайте.</p><div class="vg">';
    for(var n=1;n<=30;n++) h+='<button type="button" data-v="'+n+'" aria-pressed="'+(n===S.v)+'">'+n+'</button>';
    openSheet(h+'</div><p class="ver">Сборка 4</p>','Выбор варианта');sheet.querySelectorAll('[data-v],.grab').forEach(addHL);}
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
  /* #/dz — все ДЗ, #/dz/ng и #/dz/ig — один предмет (плитки «ДЗ» на главной) */
  function isOn(){return /^#\/dz(\/(ng|ig))?\/?$/.test(location.hash);}
  function hashC(){var m=location.hash.match(/^#\/dz\/(ng|ig)/);return m?m[1]:null;}
  function sync(){var on=isOn();document.documentElement.classList.toggle('nd-on',on);
    if(!on){closeSheet();if(FX>=0){els[FX].style.zIndex=10+FX;FX=-1;root.classList.remove('nd-fx');sc.classList.remove('lock');}return;}
    var hc=hashC();if(hc&&hc!==S.c){S.c=hc;built=false;$('flt').querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x.dataset.c===S.c));});}
    var v=getV(),t=today();if(v!==S.v||t!==S.today||!built){S.v=v;S.today=t;paint();build(built);} else geo();
    intro();}
  window.addEventListener('hashchange',sync);
  window.addEventListener('resize',function(){if(isOn()){geo();if(FX>=0) det.style.top=(sc.offsetTop+TOP0+G.ch+14)+'px'; else render();}});
  paint();sync();
})();
