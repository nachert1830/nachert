/* Офлайн: оболочка клуба и ядро задач — из кэша, когда нет сети. API не кэшируется: прогресс живёт в localStorage
   и уходит на сервер при появлении сети. Страницу — сначала из сети, чтобы обновления приходили сразу. */
const C='club-v7';
const SHELL=['./','./index.html','./app.css','./app.js','./config.js','./theme.js','./icon.svg','./manifest.webmanifest','./core/tasks.json',
  './lib/calendar.js','./lib/plan.js','./lib/srs.js','./lib/bkt.js','./lib/sync.js','./lib/reminder.js','./lib/scanner.js','./lib/features.js',
  './core/fonts/ibm-plex-mono-cyrillic-500.woff2','./core/fonts/ibm-plex-mono-latin-500.woff2','./core/fonts/golos-text-cyrillic.woff2','./core/fonts/golos-text-latin.woff2','./core/fonts/geologica-cyrillic.woff2','./core/fonts/geologica-latin.woff2'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{ const r=e.request, u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/dev/')) return;
  e.respondWith(fetch(r).then(res=>{ if(res&&res.ok&&res.type==='basic'){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; })
    .catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('./index.html'):undefined)))); });
