/* Service worker do Pulso: deixa o app abrir e funcionar sem internet.
 * Estratégia: app shell em cache (cache-first) e navegação network-first,
 * para que uma versão nova apareça assim que houver rede novamente. */

const VERSION = "pulso-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.png",
];

// Fontes são opcionais: se falharem no primeiro acesso, o app usa a fonte do sistema.
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Comparar o HTML antigo com o novo: se mudou, é versão nova e os arquivos
      // com hash antigo (`/assets/index-abc.js`) viram lixo no cache.
      const previous = await cache.match("./index.html");
      const [oldHtml, newHtml] = await Promise.all([previous?.text(), response.clone().text()]);
      await cache.put("./index.html", response.clone());
      if (previous && oldHtml !== newHtml) await pruneAssets();
    }
    return response;
  } catch (error) {
    const cached = (await cache.match("./index.html")) || (await cache.match("./"));
    if (cached) return cached;
    throw error;
  }
}

async function pruneAssets() {
  const runtime = await caches.open(RUNTIME_CACHE);
  const keys = await runtime.keys();
  await Promise.all(
    keys.filter((key) => new URL(key.url).pathname.includes("/assets/")).map((key) => runtime.delete(key)),
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Respostas parciais/erros não entram no cache; "opaque" (fontes) sim.
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (sameOrigin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
