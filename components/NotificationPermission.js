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
      // Vérifier la permission OneSignal
      const permission = await window.OneSignal.Notifications.permission;
      console.log('🔔 État permission NotificationPermission:', permission);
      
      if (permission) {
        // Permission déjà accordée
        setPermissionState('granted');
        setShowPrompt(false);
      } else {
        // Permission pas encore demandée ou refusée
        const hasAskedBefore = localStorage.getItem('onesignal_prompt_shown');
        
        if (!hasAskedBefore) {
          // Première fois → Afficher le prompt automatiquement
          console.log('🔔 Première connexion → Affichage automatique du prompt');
          setPermissionState('default');
          setShowPrompt(true);
        } else {
          // Déjà demandé → Ne pas ré-afficher
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
      console.log('🔔 Demande de permission notifications...');
      
      // Demander la permission (clic = interaction utilisateur)
      const permission = await window.OneSignal.Notifications.requestPermission();
      console.log('📨 Résultat permission:', permission);

      if (permission) {
        setPermissionState('granted');
        setShowPrompt(false);
        
        // Marquer qu'on a demandé
        localStorage.setItem('onesignal_prompt_shown', 'true');
        
        // Vérifier l'inscription
        const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
        console.log('✅ Push activé:', isPushEnabled);
        
        if (isPushEnabled) {
          const subscriptionId = window.OneSignal.User.PushSubscription.id;
          console.log('🆔 Subscription ID:', subscriptionId);
          
          // Afficher un message de succès
          alert('✅ Notifications activées ! Vous recevrez désormais les alertes de colis.');
        }
      } else {
        setPermissionState('denied');
        setShowPrompt(false);
        
        // Marquer qu'on a demandé
        localStorage.setItem('onesignal_prompt_shown', 'true');
        
        console.log('❌ Permission refusée par l\'utilisateur');
        alert('❌ Notifications refusées. Vous pouvez les réactiver dans les paramètres de votre navigateur.');
      }
    } catch (error) {
      console.error('❌ Erreur activation notifications:', error);
      setPermissionState('default');
      alert('Erreur lors de l\'activation des notifications. Vérifiez que vous n\'avez pas bloqué les notifications pour ce site.');
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('onesignal_prompt_shown', 'true');
    console.log('🔕 Prompt notifications fermé par l\'utilisateur');
  };

  // Ne rien afficher si la permission est déjà accordée ou refusée
  if (!showPrompt || permissionState === 'granted' || permissionState === 'denied') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
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
              Recevez une notification quand un colis est ajouté ou récupéré, même quand l'application est fermée.
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleEnableNotifications}
                disabled={permissionState === 'loading'}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                {permissionState === 'loading' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373
