// pages/_app.js
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialiser OneSignal uniquement côté client
    if (typeof window !== 'undefined') {
      const username = localStorage.getItem('username');
      
      if (username) {
        initOneSignal(username);
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

// Fonction d'initialisation OneSignal (CORRIGÉE)
async function initOneSignal(userId) {
  try {
    // Vérifier si OneSignal existe
    if (typeof window.OneSignal === 'undefined') {
      console.error('❌ OneSignal non chargé');
      return false;
    }

    // Vérifier si déjà initialisé
    const isInitialized = await window.OneSignal.User?.PushSubscription?.optedIn;
    
    if (isInitialized !== undefined) {
      console.log('✅ OneSignal déjà initialisé');
      
      // Juste mettre à jour l'External ID
      if (userId) {
        await window.OneSignal.login(userId);
        console.log('✅ User ID mis à jour:', userId);
      }
      
      return true;
    }

    // Initialiser OneSignal
    await window.OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: false,
      },
      serviceWorkerParam: {
        scope: '/'
      },
      serviceWorkerPath: '/OneSignalSDKWorker.js'
    });

    console.log('✅ OneSignal initialisé');

    // Définir l'External ID avec la nouvelle API
    if (userId) {
      await window.OneSignal.login(userId);
      console.log('✅ User ID défini:', userId);
    }

    // Demander la permission
    const permission = await window.OneSignal.Notifications.permission;
    if (!permission) {
      await window.OneSignal.Notifications.requestPermission();
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur OneSignal:', error);
    return false;
  }
}
