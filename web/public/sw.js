const CACHE_NAME = "oracle-arcade-v1";
const RUNTIME_CACHEABLE_EXT = [".png", ".svg", ".woff2", ".ico"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 画像・アイコン・フォントだけをランタイムキャッシュ対象にする。
// API(/api/)とSocket.IO(/socket.io/)、およびハッシュ付きJS/CSS/HTMLはブラウザの
// 通常のネットワーク処理に任せ、デプロイ後に古いバンドルを配信し続ける事故を防ぐ。
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/")) return;

  const isCacheable = RUNTIME_CACHEABLE_EXT.some((ext) => url.pathname.endsWith(ext));
  if (!isCacheable) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
