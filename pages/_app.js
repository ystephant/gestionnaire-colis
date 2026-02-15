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

  // ✅ INITIALISATION ONESIGNAL - VERSION ANTI-DOUBLE-INIT
useEffect(() => {
  if (typeof window !== 'undefined') {
    
    // ✅ Vérifier si déjà initialisé pour éviter la double init
    if (window.OneSignalInitialized) {
      console.log('ℹ️ OneSignal déjà initialisé, skip');
      return;
    }
    
    console.log('🔔 Initialisation OneSignal...');
    
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    
    if (!appId) {
      console.error('❌ NEXT_PUBLIC_ONESIGNAL_APP_ID non définie');
      return;
    }
    
    console.log('🔌 OneSignal App ID:', appId.substring(0, 8) + '...');
    
    // ✅ Marquer comme en cours d'initialisation
    window.OneSignalInitialized = true;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    
    script.onerror = () => {
      console.error('❌ Impossible de charger le SDK OneSignal');
      console.log('💡 Bloqueur de pub actif ou problème réseau');
      window.OneSignalInitialized = false; // Permettre un retry
    };
    
    script.onload = () => {
      console.log('✅ SDK OneSignal chargé');
    };
    
    document.head.appendChild(script);
    
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        console.log('🔧 Configuration OneSignal...');
        
        await OneSignal.init({
          appId: appId,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          allowLocalhostAsSecureOrigin: true,
          autoRegister: false,
          autoResubscribe: true,
          notifyButton: { enable: false },
        });

        console.log('✅ OneSignal initialisé avec succès');
        window.OneSignal = OneSignal;
        
        try {
          OneSignal.Notifications.addEventListener('permissionChange', function(isGranted) {
            console.log('🔔 Permission:', isGranted ? 'Accordée ✅' : 'Refusée ❌');
          });
          
          OneSignal.User.PushSubscription.addEventListener('change', function(subscription) {
            console.log('📱 Subscription changée:', subscription);
          });
        } catch (listenerError) {
          console.warn('⚠️ Listeners non attachés:', listenerError.message);
        }
        
        console.log('⏳ OneSignal prêt - En attente du login...');
        
      } catch (error) {
        console.error('❌ Erreur init OneSignal:', error.message);
        
        // ✅ Permettre un retry si erreur
        window.OneSignalInitialized = false;
        
        if (error.message && (
          error.message.includes('IndexedDB') || 
          error.message.includes('backing store')
        )) {
          console.error('');
          console.error('🔴 ════════════════════════════════════');
          console.error('🔴 PROBLÈME INDEXEDDB - CACHE CORROMPU');
          console.error('🔴 ════════════════════════════════════');
          console.error('');
          console.log('🔧 SOLUTION IMMÉDIATE :');
          console.log('');
          console.log('1. Ouvrez un nouvel onglet');
          console.log('2. Tapez : chrome://settings/clearBrowserData');
          console.log('3. Période : "Depuis toujours"');
          console.log('4. Cochez "Cookies" et "Cache"');
          console.log('5. Cliquez "Effacer les données"');
          console.log('6. FERMEZ LE NAVIGATEUR complètement');
          console.log('7. Rouvrez et rechargez cette page');
          console.log('');
          console.error('🔴 ════════════════════════════════════');
          console.error('');
        } else if (error.message && error.message.includes('already initialized')) {
          console.log('ℹ️ OneSignal déjà init (normal après rechargement)');
        } else {
          console.log('💡 Rechargez la page (Ctrl+F5)');
        }
        
        console.log('ℹ️ L\'app fonctionne sans notifications');
      }
    });
  }
}, []); // ✅ Tableau vide = une seule fois
          
          // ✅ NE PAS faire OneSignal.login() ici !
          // Le login sera fait dans colis.js quand l'utilisateur est réellement connecté
          console.log('⏳ OneSignal prêt - En attente du login utilisateur...');
          console.log('');
          
        } catch (error) {
          console.error('❌ Erreur initialisation OneSignal:', error.message);
          
          // ✅ DÉTECTION SPÉCIFIQUE DES ERREURS INDEXEDDB
          if (error.message && (
            error.message.includes('IndexedDB') || 
            error.message.includes('backing store') ||
            error.message.includes('storage')
          )) {
            console.error('');
            console.error('🔴 ═══════════════════════════════════════════');
            console.error('🔴 PROBLÈME INDEXEDDB DÉTECTÉ');
            console.error('🔴 ═══════════════════════════════════════════');
            console.error('');
            console.log('💡 SOLUTIONS (dans l\'ordre) :');
            console.log('');
            console.log('1️⃣  VIDER LE CACHE DU NAVIGATEUR :');
            console.log('   • Chrome/Edge: Ctrl+Shift+Delete → Cochez "Cookies" et "Cache" → Effacer');
            console.log('   • Firefox: Ctrl+Shift+Delete → Cochez tout → Effacer');
            console.log('   • Safari: Développer > Vider les caches');
            console.log('');
            console.log('2️⃣  DÉSACTIVER LES BLOQUEURS :');
            console.log('   • Désactivez uBlock Origin, AdBlock, Brave Shields');
            console.log('   • Rechargez la page après désactivation');
            console.log('');
            console.log('3️⃣  QUITTER LA NAVIGATION PRIVÉE :');
            console.log('   • IndexedDB est limité en mode privé');
            console.log('   • Ouvrez le site en navigation normale');
            console.log('');
            console.log('4️⃣  VÉRIFIER L\'ESPACE DISQUE :');
            console.log('   • Assurez-vous d\'avoir au moins 100 MB disponibles');
            console.log('');
            console.error('🔴 ═══════════════════════════════════════════');
            console.error('');
          } else if (error.message && error.message.includes('Service Worker')) {
            console.error('');
            console.error('⚠️ Erreur Service Worker détectée');
            console.log('💡 Solutions possibles :');
            console.log('  • Désactivez votre bloqueur de pub');
            console.log('  • Vérifiez que cdn.onesignal.com est accessible');
            console.log('  • Videz le cache du navigateur');
            console.error('');
          } else {
            console.error('');
            console.error('⚠️ Erreur générale OneSignal');
            console.log('💡 Essayez de :');
            console.log('  • Recharger la page (Ctrl+F5)');
            console.log('  • Vider le cache du navigateur');
            console.log('  • Désactiver temporairement les extensions');
            console.error('');
          }
          
          // ✅ Ne pas bloquer l'application même si OneSignal échoue
          console.log('ℹ️  L\'application continuera de fonctionner, mais sans notifications push');
          console.log('');
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
