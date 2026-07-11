"use strict";

const CACHE_NAME = "summa-propisyu-v2.3.4-20260711";
const OFFLINE_PAGE = "./index.html";
const APP_SHELL = [
  "./index.html",
  "./assets/styles-v2.3.4.css",
  "./assets/app-v2.3.4.js",
  "./favicon.svg",
  "./apple-touch-icon.png",
  "./manifest.webmanifest",
  "./preview-v2.3.4.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./fonts/GolosText-Regular.woff2",
  "./fonts/GolosText-Medium.woff2",
  "./fonts/GolosText-SemiBold.woff2",
  "./fonts/GolosText-Bold.woff2",
  "./fonts/GolosText-ExtraBold.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === "navigate";
  const isCode = /\.(?:css|js)$/i.test(url.pathname);

  if (isNavigation || isCode) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(isNavigation ? OFFLINE_PAGE : request, copy));
          }
          return response;
        })
        .catch(() => caches.match(isNavigation ? OFFLINE_PAGE : request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
