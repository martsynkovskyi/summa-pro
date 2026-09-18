"use strict";

const CACHE_PREFIX = "summa-propisyu-";
const CACHE_NAME = "summa-propisyu-v3.1-20260918-release23";
const OFFLINE_URL = "./index.html";
const APP_SHELL = [
  "./index.html",
  "./assets/styles.css",
  "./assets/theme.css",
  "./assets/app.js",
  "./assets/theme.js",
  "./assets/about.js",
  "./README.md",
  "./assets/pwa.css",
  "./assets/pwa.js",
  "./assets/brand/summa-logo.png",
  "./assets/brand/summa-logo-dark.png",
  "./assets/brand/summa-hero.png",
  "./assets/reason-icons/usn.png",
  "./assets/reason-icons/npd.png",
  "./assets/reason-icons/person.png",
  "./assets/generated-icons/calculator.png",
  "./assets/generated-icons/results.png",
  "./assets/mode-icons/vat-included.png",
  "./assets/mode-icons/vat-above.png",
  "./assets/mode-icons/no-vat.png",
  "./assets/generated-icons/base-amount.png",
  "./assets/generated-icons/vat-amount.png",
  "./assets/generated-icons/total-amount.png",
  "./assets/generated-icons/privacy.png",
  "./assets/generated-icons/copy.png",
  "./assets/generated-icons/history.png",
  "./assets/generated-icons/install.png",
  "./assets/generated-icons/trash.png",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./fonts/GolosText-Regular.woff2"
];
const OPTIONAL_ASSETS = [
  "./preview.png",
  "./apple-touch-icon.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./fonts/GolosText-Medium.woff2",
  "./fonts/GolosText-SemiBold.woff2",
  "./fonts/GolosText-Bold.woff2",
  "./fonts/GolosText-ExtraBold.woff2"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const requests = APP_SHELL.map(url => new Request(url, { cache: "reload" }));
    await cache.addAll(requests);
    await Promise.allSettled(OPTIONAL_ASSETS.map(url => cache.add(new Request(url, { cache: "reload" }))));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname.endsWith("/index.html")) {
        await cache.put(OFFLINE_URL, response.clone());
      }
    }
    return response;
  } catch (_) {
    return (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL, { ignoreSearch: true })) ||
      Response.error();
  }
}

function updateCache(request) {
  return fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  });
}

async function networkFirstCode(request) {
  try {
    const response = await fetch(new Request(request, { cache: "no-cache" }));
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (request.destination === "script" || request.destination === "style" ||
      request.destination === "manifest" || url.pathname.endsWith("/README.md")) {
    event.respondWith(networkFirstCode(request));
    return;
  }

  const networkPromise = updateCache(request);
  event.waitUntil(networkPromise.catch(() => undefined));
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => cached || networkPromise).catch(() => networkPromise)
  );
});
