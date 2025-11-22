// pages/_app.js
import { useEffect } from 'react';
import { initOneSignal } from '../lib/onesignal';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialiser OneSignal uniquement côté client
    if (typeof window !== 'undefined') {
      const username = localStorage.getItem('username');
      
      if (username) {
        initOneSignal(username).then((success) => {
          if (success) {
            console.log('✅ OneSignal prêt pour:', username);
          }
        });
      }
    }

    // Enregistrer le Service Worker pour les notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker enregistré');
        })
        .catch((error) => {
          console.error('❌ Erreur Service Worker:', error);
        });
    }
  }, []);

  return <Component {...pageProps} />;
}
