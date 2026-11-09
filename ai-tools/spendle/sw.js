// Replace the old cache-first worker so installed PWAs also reach the new URL.
const destination = (url) => {
  const oldUrl = new URL(url);
  const target = new URL('../nyanfoglio/', self.registration.scope);
  target.search = oldUrl.search;
  target.hash = oldUrl.hash;
  return target.href;
};
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => /^nyanfoglio-v\d+$/.test(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map((client) => client.navigate(destination(client.url))));
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(Promise.resolve(Response.redirect(destination(event.request.url), 302)));
  }
});
