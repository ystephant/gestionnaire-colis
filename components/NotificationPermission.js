import React, { useState, useEffect } from 'react';
import { useTheme } from '../lib/ThemeContext';

export default function NotificationPermission() {
  const { darkMode } = useTheme();
  const [permissionState, setPermissionState] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    checkPermissionState();
  }, []);

  const checkPermissionState = async () => {
    if (typeof window === 'undefined' || !window.OneSignal) {
      return;
    }

    try {
      const permission = await window.OneSignal.Notifications.permission;
      console.log('🔔 État permission:', permission);
      
      if (permission) {
        setPermissionState('granted');
        setShowPrompt(false);
      } else {
        const hasAskedBefore = localStorage.getItem('onesignal_prompt_shown');
        
        if (!hasAskedBefore) {
          console.log('🔔 Première connexion → Affichage du prompt');
          setPermissionState('default');
          setShowPrompt(true);
        } else {
          setPermissionState('denied');
          setShowPrompt(false);
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification permission:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if (!window.OneSignal) {
      alert('❌ OneSignal n\'est pas chargé. Veuillez recharger la page.');
      return;
    }

    setPermissionState('loading');

    try {
      console.log('🔔 Demande de permission...');
      
      const permission = await window.OneSignal.Notifications.requestPermission();
      console.log('📨 Résultat:', permission);

      if (permission) {
        setPermissionState('granted');
        setShowPrompt(false);
        localStorage.setItem('onesignal_prompt_shown', 'true');
        
        const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
        console.log('✅ Push activé:', isPushEnabled);
        
        if (isPushEnabled) {
          const subscriptionId = window.OneSignal.User.PushSubscription.id;
          console.log('🆔 Subscription ID:', subscriptionId);
          alert('✅ Notifications activées !');
        }
      } else {
        setPermissionState('denied');
        setShowPrompt(false);
        localStorage.setItem('onesignal_prompt_shown', 'true');
        console.log('❌ Permission refusée');
        alert('❌ Notifications refusées.');
      }
    } catch (error) {
      console.error('❌ Erreur:', error);
      setPermissionState('default');
      alert('Erreur lors de l\'activation des notifications.');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('onesignal_prompt_shown', 'true');
    console.log('🔕 Prompt fermé');
  };

  if (!showPrompt || permissionState === 'granted' || permissionState === 'denied') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fade-slide-in">
      <div className={`${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } border-2 rounded-2xl shadow-2xl p-5`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          
          <div className="flex-1">
            <h3 className={`font-bold text-lg mb-1 ${
              darkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Activer les notifications ?
            </h3>
            <p className={`text-sm mb-4 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Recevez une notification quand un colis est ajouté ou récupéré.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleEnableNotifications}
                disabled={permissionState === 'loading'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                {permissionState === 'loading' ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Activation...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Activer
                  </>
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                disabled={permissionState === 'loading'}
                className={`px-4 py-2.5 rounded-lg font-semibold transition ${
                  darkMode 
                    ? 'text-gray-300 hover:bg-gray-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
