// Service Worker pour OneSignal (version NPM)
// Ce fichier est nécessaire mais minimal car react-onesignal gère tout

self.addEventListener('install', function(event) {
  console.log('✅ OneSignal Service Worker installé');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('✅ OneSignal Service Worker activé');
  event.waitUntil(self.clients.claim());
});

// Le package react-onesignal injectera automatiquement
// le code nécessaire pour gérer les notifications push
