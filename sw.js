/* Офлайн: сайт — один файл. Сначала сеть (чтобы обновления приходили), при отсутствии сети — копия из кэша. */
const C='nachert-v112';
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon-192.png','./apple-touch-icon.png','./kernel/dz.js','./dz/ng/lib.js','./dz/ng/1/variants.js','./dz/ng/1/method.js','./dz/ng/1/solver.js','./dz/ng/2/variants.js','./dz/ng/2/method.js','./dz/ng/2/solver.js','./dz/ng/3/variants.js','./dz/ng/3/method.js','./dz/ng/3/solver.js','./dz/ng/4/variants.js','./dz/ng/4/method.js','./dz/ng/4/solver.js','./dz/ng/5/variants.js','./dz/ng/5/method.js','./dz/ng/5/solver-cone.js','./dz/ng/5/solver.js','./dz/ig/2/variants.js','./dz/ig/3/variants.js','./dz/ig/3/method.js','./dz/ig/4/variants.js','./dz/ig/4/method.js','./kernel/sheet.js'])).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin) return;
  const fresh=r.mode==='navigate'||/\/(index\.html)?$/.test(new URL(r.url).pathname);   /* страницу — всегда свежую, мимо HTTP-кэша */
  e.respondWith((fresh?fetch(r.url,{cache:'no-cache'}):fetch(r)).then(res=>{ if(res&&res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))));
});
