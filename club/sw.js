/* Старый адрес /club/: этот service worker стирает свой кэш, снимает себя и переводит открытые вкладки на /lk/. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) if(/^club-/.test(k)) await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:'window'})) c.navigate(c.url.replace('/club/','/lk/'));
})()));
