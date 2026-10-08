/* Офлайн: сайт — один файл. Сначала сеть (чтобы обновления приходили), при отсутствии сети — копия из кэша. */
const C='nachert-v65';
self.addEventListener('install',e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon-192.png'])).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin) return;
  const fresh=r.mode==='navigate'||/\/(index\.html)?$/.test(new URL(r.url).pathname);   /* страницу — всегда свежую, мимо HTTP-кэша */
  e.respondWith((fresh?fetch(r.url,{cache:'no-cache'}):fetch(r)).then(res=>{ if(res&&res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))));
});
