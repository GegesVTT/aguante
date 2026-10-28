/* Aguante: funciona sin conexión.
   Cambiá VERSION en cada publicación para que los celulares bajen la nueva. */
const VERSION = 'aguante-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Barlow+Condensed:wght@600;800&display=swap';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    // Tipografías: se guardan en la primera visita con conexión.
    try {
      const css = await fetch(FONTS_CSS);
      if (css.ok) {
        await cache.put(FONTS_CSS, css.clone());
        const urls = [...(await css.text()).matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
        await Promise.all(urls.map((u) => fetch(u).then((r) => r.ok && cache.put(u, r)).catch(() => {})));
      }
    } catch (e) { /* sin conexión: la app usa las fuentes del sistema */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !isFont) return;

  // Primero lo guardado; si hay señal, se actualiza en segundo plano.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
