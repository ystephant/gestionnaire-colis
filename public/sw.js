// public/sw.js - Service Worker pour notifications

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installé');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activé');
  event.waitUntil(clients.claim());
});

// Écouter les messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    self.registration.showNotification(title, options);
  }
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si une fenêtre de l'app est déjà ouverte, la mettre au premier plan
      for (const client of clientList) {
        if (client.url.includes('/colis') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow('/colis');
      }
    })
  );
});
