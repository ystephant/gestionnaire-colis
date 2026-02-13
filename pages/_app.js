import '../styles/globals.css';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ThemeProvider } from '../lib/ThemeContext';

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Délai minimum pour voir l'écran de chargement
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

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
          
          // 🔑 ENREGISTRER L'UTILISATEUR AVEC SON USERNAME
          const username = localStorage.getItem('username');
          if (username && router.pathname !== '/') {
            try {
              await OneSignal.login(username);
              console.log('✅ Utilisateur enregistré dans OneSignal:', username);
              
              // Vérifier si l'utilisateur a déjà donné la permission
              const hasPermission = localStorage.getItem(`onesignal_permission_${username}`);
              
              if (!hasPermission) {
                // Première fois : vérifier l'état actuel
                const isPushEnabled = await OneSignal.User.PushSubscription.optedIn;
                
                if (!isPushEnabled) {
                  // Demander la permission
                  await OneSignal.Notifications.requestPermission();
                  console.log('🔔 Permission demandée');
                }
                
                // Sauvegarder qu'on a demandé
                localStorage.setItem(`onesignal_permission_${username}`, 'asked');
              } else {
                console.log('✅ Permission déjà gérée pour cet utilisateur');
              }
              
              const isPushEnabled = await OneSignal.User.PushSubscription.optedIn;
              console.log('📱 Push enabled:', isPushEnabled);
            } catch (error) {
              console.error('❌ Erreur lors de l\'enregistrement:', error);
            }
          }
        } catch (error) {
          console.error('❌ Erreur OneSignal:', error.message);
        }
      });
    }
  }, [router.pathname]);

  // 🎮 ÉCRAN DE CHARGEMENT UNIQUE
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        {/* Logo animé */}
        <div className="mb-8 animate-bounce">
          <img 
            src="/meeple_final.png" 
            alt="Le Petit Meeple" 
            className="w-32 h-32 object-contain drop-shadow-2xl"
            onError={(e) => {
              console.error('Erreur chargement logo');
              e.target.style.display = 'none';
            }}
          />
        </div>

        <h1 className="text-4xl font-bold text-white mb-6 tracking-tight">
          Le Petit Meeple arrive !
        </h1>

        {/* Barre de progression animée */}
        <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
            style={{
              animation: 'loading 1.5s ease-in-out infinite'
            }}
          />
        </div>

        <style jsx>{`
          @keyframes loading {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
