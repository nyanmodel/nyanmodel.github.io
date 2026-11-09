const CACHE_PREFIX = `nyanfoglio:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v21`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/categories.js",
  "./js/charts.js",
  "./js/expenses.js",
  "./js/csv.js",
  "./js/ocr.js",
  "./manifest.webmanifest",
  "./img/dna-solid-full.svg",
  "./img/pwa-icon.svg",
  "./img/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(event.request, { ignoreSearch: event.request.mode === "navigate" })).then((cachedResponse) => cachedResponse || fetch(event.request)));
});
