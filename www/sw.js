// Offline-first: everything (app, drug database, OCR engine and languages) is cached at install time.
const V = "aksir-offline-v6";
const ASSETS = [
  "./", "index.html", "style.css", "app.js", "i18n.js", "manifest.webmanifest",
  "data/drugs.js", "data/aliases.js", "data/aliases2.js", "data/drugs_b1.js", "data/drugs_b2.js", "data/drugs_b3.js", "data/drugs_b4.js", "data/drugs_b5.js", "data/drugs_b6.js", "data/drugs_b7.js", "data/drugs_b8.js", "data/drugs_b9.js", "data/brief_core.js", "data/brief1.js", "data/brief2.js", "data/brief3.js", "data/brief4.js",
  "fonts/Vazirmatn.woff2", "fonts/Fraunces.woff2",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "lib/tess/tesseract.min.js", "lib/tess/worker.min.js",
  "lib/tess/core/tesseract-core-lstm.wasm.js", "lib/tess/core/tesseract-core-simd-lstm.wasm.js",
  "lib/tess/lang/fas.traineddata", "lib/tess/lang/eng.traineddata",
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).then((n) => { const cp = n.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return n; })));
});
