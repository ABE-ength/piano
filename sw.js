// アプリのファイルとピアノの音をスマホに保存して、ネットがなくても開けるようにする
const CACHE = 'piano-v3.1.1';
const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/icon.svg",
  "samples/A3.mp3",
  "samples/A4.mp3",
  "samples/A5.mp3",
  "samples/C3.mp3",
  "samples/C4.mp3",
  "samples/C5.mp3",
  "samples/C6.mp3",
  "samples/Ds3.mp3",
  "samples/Ds4.mp3",
  "samples/Ds5.mp3",
  "samples/Fs3.mp3",
  "samples/Fs4.mp3",
  "samples/Fs5.mp3"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
