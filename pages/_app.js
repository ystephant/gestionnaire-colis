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

  // ✅ INITIALISATION ONESIGNAL - VERSION CORRIGÉE
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('🔔 Initialisation OneSignal...');
      
      // Vérifier que l'App ID est bien défini
      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      
      if (!appId) {
        console.error('❌ NEXT_PUBLIC_ONESIGNAL_APP_ID non définie dans les variables d\'environnement');
        return;
      }
      
      console.log('📌 OneSignal App ID:', appId.substring(0, 8) + '...');
      
      // Charger le SDK OneSignal
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      script.onerror = () => {
        console.warn('⚠️ OneSignal SDK bloqué (bloqueur de pubs ou erreur réseau)');
      };
      
      document.head.appendChild(script);
      
      // Initialiser OneSignal
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.init({
  appId: appId,
  serviceWorkerParam: { scope: '/' },
  serviceWorkerPath: 'OneSignalSDKWorker.js',
  allowLocalhostAsSecureOrigin: true,
  autoRegister: false,
  autoResubscribe: true,
  notifyButton: { enable: false },
});

const username = localStorage.getItem('username');

if (username) {
  await OneSignal.login(username);
  console.log("✅ OneSignal login effectué avec:", username);
}

          
          // Rendre OneSignal accessible globalement
          window.OneSignal = OneSignal;
          
          // ✅ NOUVEAU : Écouter les changements de permission
          OneSignal.Notifications.addEventListener('permissionChange', function(isGranted) {
            console.log('🔔 Permission notifications changée:', isGranted ? 'Accordée ✅' : 'Refusée ❌');
          });
          
          // Écouter les changements de subscription
          OneSignal.User.PushSubscription.addEventListener('change', function(subscription) {
            console.log('📱 Subscription changée:', subscription);
          });
          
          // ❌ NE PAS faire OneSignal.login() ici !
          // Le login sera fait dans colis.js quand on est sûr que l'utilisateur est connecté
          
        } catch (error) {
          console.error('❌ Erreur initialisation OneSignal:', error.message);
        }
      });
    }
  }, []); // ✅ Dépendances vides = s'exécute une seule fois au montage

  // 🎮 ÉCRAN DE CHARGEMENT
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
