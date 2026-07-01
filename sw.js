const CACHE = "daily-v8";
const ASSETS = [
  "./", "./index.html", "./app.js", "./manifest.json",
  "./data/today.json", "./data/plan.json", "./data/nutrition.json", "./data/schedule.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first for data JSON (so plan updates show up), cache-first for the shell.
self.addEventListener("fetch", e => {
  const url = e.request.url;
  if (url.includes("/data/")) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).catch(() => caches.match("./index.html"))));
  }
});
