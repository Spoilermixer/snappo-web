// Snappo offline helper. Only Snappo's own app files are cached; your devices live in the phone's storage.
const CACHE = "snappo-ef576f993c";
const CORE = ["./", "fonts/3387b9ac87a9.woff2", "fonts/6e399c488d8a.woff2", "fonts/c3dccdbb7c52.woff2", "fonts/f90b1bf2bf92.woff2", "fonts/fonts.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "manifest.webmanifest", "menu/dishes.json", "qr/LICENSE-jsqr.txt", "qr/README.txt", "qr/jsqr.min.js", "qr/qrcode.min.js", "speed/cams.json", "tiles/chat.jpg", "tiles/coll.jpg", "tiles/dev.jpg", "tiles/diy.jpg", "tiles/drug.jpg", "tiles/dutch.jpg", "tiles/fuel.jpg", "tiles/gift.jpg", "tiles/groc.jpg", "tiles/home.jpg", "tiles/ids.jpg", "tiles/markets.jpg", "tiles/meet.jpg", "tiles/move.jpg", "tiles/news.jpg", "tiles/orders.jpg", "tiles/pays.jpg", "tiles/priv.jpg", "tiles/rain.jpg", "tiles/recipes.jpg", "tiles/road.jpg", "tiles/sint.jpg", "tiles/speed.jpg", "tiles/stocks.jpg", "tiles/svc.jpg", "tiles/todo.jpg", "version.json"];
const LAZY = ["ai/mn-1.wasm", "ai/mn-2.wasm", "ai/mn-3.wasm", "ai/mn-4.wasm", "ai/mobilenet.json", "ai/tf.min.js", "bar/LICENSE-zxing.txt", "bar/README.txt", "bar/zxing.min.js", "ocr/eng-data.wasm", "ocr/tesseract-core-lstm.wasm.js", "ocr/tesseract-core-simd-lstm.wasm.js", "ocr/tesseract.min.js", "ocr/worker.min.js", "pdf/pdf.min.js", "pdf/pdf.worker.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "snappo-share" && k !== "snappo-road").map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => caches.open(CACHE).then(c => Promise.all(LAZY.map(u => c.match(u).then(hit => hit || c.add(u).catch(() => {})))))));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  // Android share menu: keep the shared photos or text for a moment (only on this phone), then open Snappo to pick them up
  if (e.request.method === "POST" && u.origin === location.origin && u.searchParams.has("share-target")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData(), c = await caches.open("snappo-share");
        await Promise.all(fd.getAll("photos").filter(f => f && f.size && /^image\//.test(f.type)).slice(0, 6)
          .map((f, n) => c.put("share/" + n, new Response(f, { headers: { "Content-Type": f.type } }))));
        // shared text or a link (a recipe, a list): kept the same way, Snappo asks where it should go
        const t = { title: String(fd.get("title") || ""), text: String(fd.get("text") || ""), url: String(fd.get("url") || "") };
        if (t.title || t.text || t.url) await c.put("share/text", new Response(JSON.stringify(t), { headers: { "Content-Type": "application/json" } }));
      } catch (err) {}
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/road/")) return;  // 🚦 speed limits: Snappo keeps them itself (after a tap), never in the update cache
  if (u.pathname.endsWith("/version.json")) return;
  if (u.searchParams.has("fresh") && e.request.mode !== "navigate") return;  // 🎁 the update check reads the newest page: straight from the web, never kept  // "is there a new Snappo?": always asked online, never kept
  // only the app page itself is kept as "./" (opening e.g. the licence file must never replace the app)
  const appPage = /\/(index\.html)?$/.test(u.pathname);
  if (e.request.mode === "navigate" && appPage) {
    // the page itself: newest version when online, saved copy when offline
    // (asked past the web cache, so a new version shows at once instead of minutes later)
    e.respondWith(fetch(u.href, { cache: "no-cache", credentials: "same-origin" }).then(r => r.redirected ? fetch(e.request) : r).catch(() => fetch(e.request)).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("./", c)); return r; }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  })));
});
