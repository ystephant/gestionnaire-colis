// pages/_app.js
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Attendre que OneSignal soit chargé
    const initializeOneSignal = () => {
      if (typeof window !== 'undefined' && window.OneSignal) {
        const username = localStorage.getItem('username');
        
        if (username) {
          initOneSignal(username);
        }
      } else {
        // Réessayer après 100ms si OneSignal n'est pas encore chargé
        setTimeout(initializeOneSignal, 100);
      }
    };

    initializeOneSignal();

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
    // Attendre que OneSignal soit complètement chargé
    if (typeof window.OneSignal === 'undefined') {
      console.error('❌ OneSignal non disponible');
      return false;
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

    // Demander la permission AVANT de faire le login
    const permission = await window.OneSignal.Notifications.requestPermission();
    
    if (permission) {
      console.log('✅ Permissions notifications accordées');
      
      // MAINTENANT on peut faire le login
      await window.OneSignal.login(userId);
      console.log('✅ User ID défini:', userId);
    } else {
      console.log('⚠️ Permissions notifications refusées');
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur OneSignal:', error);
    return false;
  }
}
