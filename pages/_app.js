import '../styles/globals.css';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '../lib/ThemeContext';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const publicPaths = ['/'];
      const currentPath = router.pathname;
      
      if (!publicPaths.includes(currentPath)) {
        const username = localStorage.getItem('username');
        const password = localStorage.getItem('password');
        
        if (!username || !password) {
          router.push('/');
        }
      }
    };

    checkAuth();
  }, [router.pathname]);

  useEffect(() => {
    // Initialiser OneSignal avec gestion d'erreurs améliorée
    if (typeof window !== 'undefined') {
      // Vérifier si le SDK est bloqué
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      script.onerror = () => {
        console.warn('⚠️ OneSignal SDK bloqué par un bloqueur de publicités');
      };
      
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.init({
            appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "24c0cb48-bcea-4953-934c-8d41632f3f16",
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'OneSignalSDKWorker.js',
            allowLocalhostAsSecureOrigin: true,
            autoRegister: false,
            autoResubscribe: true,
            notifyButton: {
              enable: false,
            },
          });
          
          console.log('✅ OneSignal initialisé avec succès');
          window.OneSignal = OneSignal;
          
          // Ne pas demander automatiquement la permission
          // L'utilisateur devra cliquer sur un bouton pour l'activer
        } catch (error) {
          console.error('❌ Erreur OneSignal:', error.message);
          // Ne pas bloquer l'app si OneSignal échoue
        }
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
