import '../styles/globals.css';
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '../lib/ThemeContext';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Vérifier l'authentification pour les pages protégées
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

    // Initialisation OneSignal
    if (typeof window !== 'undefined' && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.init({
            appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "24c0cb48-bcea-4953-934c-8d41632f3f16",
            safari_web_id: process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID,
            notifyButton: {
              enable: false,
            },
            allowLocalhostAsSecureOrigin: true,
          });
          
          console.log('✅ OneSignal initialisé avec succès');
          
          // Demander la permission pour les notifications
          const permission = await OneSignal.Notifications.permission;
          if (permission === 'default') {
            await OneSignal.Notifications.requestPermission();
          }
        } catch (error) {
          console.error('❌ Erreur initialisation OneSignal:', error);
        }
      });
    }
  }, [router.pathname]);

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
