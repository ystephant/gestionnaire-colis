// pages/_app.js
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    console.log('🔍 _app.js chargé');
    
    // Attendre que OneSignal soit chargé
    const initializeOneSignal = () => {
      console.log('🔍 Tentative d\'initialisation OneSignal...');
      
      if (typeof window !== 'undefined' && window.OneSignal) {
        console.log('✅ OneSignal SDK détecté');
        const username = localStorage.getItem('username');
        console.log('🔍 Username:', username);
        
        if (username) {
          initOneSignal(username);
        } else {
          console.log('⚠️ Pas de username dans localStorage');
        }
      } else {
        console.log('⏳ OneSignal pas encore chargé, réessai...');
        // Réessayer après 100ms si OneSignal n'est pas encore chargé
        setTimeout(initializeOneSignal, 100);
      }
    };

    // Démarrer l'initialisation après un court délai
    setTimeout(initializeOneSignal, 500);
  }, []);

  return <Component {...pageProps} />;
}

// Fonction d'initialisation OneSignal
async function initOneSignal(userId) {
  try {
    console.log('🚀 Début initialisation OneSignal pour:', userId);
    
    // Attendre que OneSignal soit complètement chargé
    if (typeof window.OneSignal === 'undefined') {
      console.error('❌ OneSignal non disponible');
      return false;
    }

    // Initialiser OneSignal
    console.log('📡 Appel OneSignal.init()...');
    await window.OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: false,
      }
    });

    console.log('✅ OneSignal initialisé');

    // Demander la permission AVANT de faire le login
    console.log('🔔 Demande de permission...');
    const permission = await window.OneSignal.Notifications.requestPermission();
    
    if (permission) {
      console.log('✅ Permissions notifications accordées');
      
      // MAINTENANT on peut faire le login
      console.log('🔑 Login avec userId:', userId);
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
