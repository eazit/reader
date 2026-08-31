/**
 * Eazit Reader - Service Worker (PWA Offline & App Lifecycle)
 */

const CACHE_NAME = 'eazit-reader-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.png',
  './assets/favicon.png',
  './css/base.css',
  './css/library.css',
  './css/reader.css',
  './css/search.css',
  './css/modal.css',
  './js/main.js',
  './js/config.js',
  './js/auth.js',
  './js/cache.js',
  './js/encoding.js',
  './js/reader-txt.js',
  './js/reader-epub.js',
  './js/search.js',
  './js/ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Google Drive & Google Auth APIs should always go over network
  if (event.request.url.includes('googleapis.com') || event.request.url.includes('accounts.google.com')) {
    return;
  }

  // Network-first for HTML/JS/CSS to ensure latest updates are served immediately, falling back to cache
  event.respondWith(
    fetch(event.request).then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
