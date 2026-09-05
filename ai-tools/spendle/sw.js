const CACHE_NAME = "spendle-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/categories.js",
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
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request)));
});
