/* ═══════════ Замер сканера: node lab/eval.js ═══════════
   Синтетика (lab/synth.js): для каждого уровня съёмки (easy, normal, hard) — набор листов с известной правдой:
   верные решения разными способами, каждая ошибка библиотеки и «неизвестное построение» (ошибка, которой в
   библиотеке нет). Реальные фото: lab/photos/<№>/*.png + truth.json ({"файл.png": "ok" | "foot1" | …}).
   Таблица: доля прочитанных, точность координат (мм), верный диагноз, ЛОЖНЫЕ ВЕРДИКТЫ, честные отказы.
   Ложный вердикт — сканер вынес вердикт, и он не совпал с правдой (в том числе «верно» при ошибке и любой вердикт,
   кроме «не узнаю построение», на неизвестной ошибке). Лист, где ошибка на этих данных неотличима от верного
   решения (разница чертежей < 1 мм), считается отдельно: «неразличимо».
   --per=3 — листов каждого вида на уровень; --levels=easy,normal; --only=foot1; --json=файл; --keep=папка (PNG листов). */
const fs=require('fs'), path=require('path');
const {synth}=require('./synth.js'), {scan}=require('./scan.js'), IMG=require('./img.js'), {SHEETS,toPage}=require('./sheets.js');
const cp=require('../core/cp.js'), C47=require('../core/cp47.js'), {v2}=require('../core/model.js');
const A=Object.fromEntries(process.argv.slice(2).map(s=>s.replace(/^--/,'').split('=')));
const PER=+(A.per||3), LEVELS=(A.levels||'easy,normal,hard').split(','), ONLY=A.only?A.only.split(','):null;

/* виды листов: верное решение — 4 вида на 1 вид каждой ошибки, чтобы «верно» было частым, как в жизни */
const KINDS=['ok','ok','ok','ok','h-par','f-hpar','foot1','foot2','12-swap','nv-same','nv-abs','nv-none','unknown'];
const OKNV=Object.keys(C47.NVOPT).filter(k=>C47.NVOPT[k].ok);
function plan(kind,R){ const nvOk=R.pick(OKNV), side=nvOk.slice(3);
  if(kind==='ok') return {kid:R.pick(['front','horiz']),nvid:nvOk};
  if(kind==='unknown') return {kid:R.pick(['u-hrot','u-Kshift']),nvid:nvOk};
  if(kind.startsWith('nv-')) return {kid:R.pick(['front','horiz']),nvid:kind==='nv-none'?'none':kind.slice(3)+':'+side};
  return {kid:kind,nvid:nvOk}; }
/* неотличимость: чертёж ошибки против того же построения без ошибки, наибольший сдвиг общих точек */
function separation(t){ if(t.cls==='ok'||t.cls==='unknown') return Infinity; const G=SHEETS[47].G(), g=C47.given(G);
  const okK=C47.KOPT[t.kid].ok?t.kid:'front', okNV=C47.NVOPT[t.nvid].ok?t.nvid:(t.nvid==='none'?null:'ok:'+t.nvid.split(':')[1]);
  if(!okNV) return Infinity;
  const E1=cp.exec(C47.program(t.kid,t.nvid),g).E, E0=cp.exec(C47.program(okK,okNV),g).E;
  let m=0; ['K′','K″','A₀','K₀','1′','2′','1″','2″'].forEach(n=>{ if(E1[n]&&E0[n]) m=Math.max(m,v2.dist(E1[n],E0[n])); }); return m; }

function rectErr(res,t){ const M=res.rect&&res.rect.H; if(!M) return null; const Mi=IMG.H.inv(M), SH=SHEETS[t.n];
  const pts=SH.given().filter(i=>i.t==='pt').map(i=>i.at).concat(SH.given().filter(i=>i.t==='seg').flatMap(i=>[i.a,i.b]));
  return Math.max(...pts.map(p=>{ const P=toPage(SH,p), px=IMG.H.apply(t.H,P), back=IMG.H.apply(Mi,px); return v2.dist(back,P); })); }
function pointErr(res,t){ const f=res.verdict&&res.verdict.points; if(!f) return null; let m=null;
  ['K′','K″'].forEach(n=>{ if(f[n]&&t.E[n]){ const d=v2.dist(f[n],t.E[n]); m=m==null?d:Math.max(m,d); } }); return m; }

const pct=(a,b)=>b?Math.round(100*a/b)+' %':'—';
const med=a=>{ if(!a.length) return '—'; const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)].toFixed(2); };
const p95=a=>{ if(!a.length) return '—'; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(s.length*0.95))].toFixed(2); };

function tally(rows){ const r={n:rows.length,read:0,right:0,falseV:0,refuse:0,equiv:0,unk:0,rect:[],pts:[],ms:0,fv:[]};
  rows.forEach(x=>{ r.ms+=x.ms; if(x.rect!=null) r.rect.push(x.rect); if(x.pts!=null) r.pts.push(x.pts);
    if(x.status!=='verdict'){ r.refuse++; return; } r.read++;
    if(x.got===x.cls) r.right++; else if(x.got==='ok'&&x.equiv) r.equiv++; else if(x.got==='unknown'&&x.cls!=='unknown') r.unk++; else { r.falseV++; r.fv.push(x.id+': правда '+x.cls+', вердикт '+x.got); } });
  return r; }
function row(name,r){ return '| '+name+' | '+r.n+' | '+r.read+' ('+pct(r.read,r.n)+') | '+med(r.rect)+' / '+p95(r.rect)+' | '+med(r.pts)+' | '+r.right+' ('+pct(r.right,r.read)+') | **'+r.falseV+'** | '+r.unk+' | '+r.refuse+' | '+r.equiv+' |'; }
const HEAD='| Набор | Листов | Прочитано | Выпрямление, мм (медиана / 95 %) | K′, K″, мм | Верный диагноз | Ложные вердикты | «Не узнаю построение» | Отказы | Неразличимо |\n|---|---|---|---|---|---|---|---|---|---|';

(async()=>{ const t0=Date.now(), rows=[], keep=A.keep;
  if(keep) fs.mkdirSync(keep,{recursive:true});
  LEVELS.forEach((lv,li)=>{ for(let i=0;i<PER*KINDS.length;i++){ const kind=KINDS[i%KINDS.length]; if(ONLY&&!ONLY.includes(kind)) continue;
    const seed=10007*(li+1)+i, R=IMG.rng(seed*31+7), p=plan(kind,R), s=synth(Object.assign({n:47,seed,level:lv},p)), t=s.truth;
    if(keep) fs.writeFileSync(path.join(keep,lv+'-'+i+'-'+t.cls+'.png'),IMG.encodePNG(s.img));
    let res; try{ res=scan(s.img,{n:47}); }catch(e){ res={status:'refuse',reason:'сбой: '+e.message,ms:0}; }
    const sep=separation(t);
    rows.push({id:lv+'#'+i,level:lv,cls:t.cls,kid:t.kid,nvid:t.nvid,equiv:sep<1,sep,status:res.status,got:res.verdict&&res.verdict.cls,reason:res.reason,ms:res.ms||0,rect:rectErr(res,t),pts:pointErr(res,t)});
    process.stderr.write('\r'+rows.length+' листов…'); } });
  process.stderr.write('\n');
  /* реальные фото владельца */
  const real=[], PH=path.join(__dirname,'photos');
  if(fs.existsSync(PH)) fs.readdirSync(PH).filter(d=>/^\d+$/.test(d)).forEach(d=>{ const dir=path.join(PH,d), tf=path.join(dir,'truth.json'); if(!fs.existsSync(tf)) return;
    const truth=JSON.parse(fs.readFileSync(tf,'utf8'));
    Object.entries(truth).forEach(([f,cls])=>{ const file=path.join(dir,f); if(!/\.png$/i.test(f)||!fs.existsSync(file)){ real.push({id:d+'/'+f,cls,status:'refuse',reason:'формат не поддержан в Node (нужен PNG)',ms:0}); return; }
      let res; try{ res=scan(IMG.decodePNG(fs.readFileSync(file)),{n:+d}); }catch(e){ res={status:'refuse',reason:'сбой: '+e.message}; }
      real.push({id:d+'/'+f,cls,status:res.status,got:res.verdict&&res.verdict.cls,reason:res.reason,ms:res.ms||0}); }); });
  const out=['## Сканер № 47 — замер ('+new Date().toISOString().slice(0,10)+', node lab/eval.js'+(process.argv.slice(2).length?' '+process.argv.slice(2).join(' '):'')+')','',HEAD];
  LEVELS.forEach(lv=>out.push(row('синтетика · '+lv,tally(rows.filter(r=>r.level===lv)))));
  const all=tally(rows); out.push(row('**синтетика · всё**',all)); out.push(row('реальные фото',tally(real)));
  out.push('','По видам листов (синтетика, все уровни):','','| Правда | Листов | Прочитано | Верно | Ложные | Отказы |','|---|---|---|---|---|---|');
  [...new Set(rows.map(r=>r.cls))].sort().forEach(c=>{ const t=tally(rows.filter(r=>r.cls===c)); out.push('| '+c+' | '+t.n+' | '+t.read+' | '+t.right+' | '+t.falseV+' | '+t.refuse+' |'); });
  const reasons={}; rows.filter(r=>r.status!=='verdict').forEach(r=>{ const k=String(r.reason).replace(/[\d.,]+/g,'#'); reasons[k]=(reasons[k]||0)+1; });
  out.push('','Причины отказов:',''); Object.entries(reasons).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>out.push('- '+v+' × '+k));
  if(all.fv.length){ out.push('','ЛОЖНЫЕ ВЕРДИКТЫ:',''); all.fv.forEach(x=>out.push('- '+x)); }
  if(!real.length) out.push('','Реальных фото пока нет (lab/photos/<№>/ с truth.json).');
  out.push('','Время: '+((Date.now()-t0)/1000).toFixed(0)+' с, сканер — '+(all.ms/Math.max(1,all.n)/1000).toFixed(2)+' с на лист.');
  console.log(out.join('\n'));
  if(A.json) fs.writeFileSync(A.json,JSON.stringify({rows,real,summary:all},null,1));
})();
