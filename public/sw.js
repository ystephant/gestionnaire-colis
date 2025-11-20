// Service Worker avancé pour notifications push
const CACHE_NAME = 'colis-cache-v3';
const urlsToCache = [
  '/',
  '/colis',
  '/annonces',
  '/reponses'
];

// Installation
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installé');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activé');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interception des requêtes (mode offline)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - retourner la réponse
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Vérifier si c'est une réponse valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Cloner la réponse
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // En cas d'erreur, retourner une page offline
          return caches.match('/');
        });
      })
  );
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification cliquée');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/colis')
  );
});

// Écouter les messages du client
self.addEventListener('message', (event) => {
  console.log('📨 Message reçu dans SW:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    
    console.log('🔔 Affichage notification:', title);
    
    self.registration.showNotification(title, {
      body: options.body || '',
      icon: options.icon || '/icons/package-icon.png',
      badge: options.badge || '/icons/badge-icon.png',
      vibrate: options.vibrate || [200, 100, 200],
      requireInteraction: options.requireInteraction || false,
      tag: options.tag || 'default',
      actions: options.actions || [
        {
          action: 'view',
          title: 'Voir'
        },
        {
          action: 'close',
          title: 'Fermer'
        }
      ]
    }).then(() => {
      console.log('✅ Notification affichée');
    }).catch(err => {
      console.error('❌ Erreur notification:', err);
    });
  }

  // Synchroniser les données en arrière-plan
  if (event.data && event.data.type === 'SYNC_DATA') {
    event.waitUntil(
      self.registration.sync.register('sync-parcels')
    );
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-parcels') {
    event.waitUntil(syncParcelsData());
  }
});

async function syncParcelsData() {
  console.log('🔄 Synchronisation en arrière-plan...');
  // La synchronisation sera gérée par le client
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_REQUEST'
    });
  });
}

// Notifications push (si vous configurez un serveur push)
self.addEventListener('push', (event) => {
  console.log('📬 Notification push reçue');
  
  let data = { title: 'Nouveau colis', body: 'Un colis a été ajouté' };
  
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: '/icons/package-icon.png',
    badge: '/icons/badge-icon.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/colis'
    },
    actions: [
      {
        action: 'view',
        title: 'Voir'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Gérer les actions des notifications
self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification fermée');
});
