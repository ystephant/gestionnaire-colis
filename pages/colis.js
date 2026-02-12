import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import NotificationPermission from '../components/NotificationPermission';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LOCKER_LOGOS = {
  'mondial-relay': '/logos/mondial-relay.png',
  'vinted-go': '/logos/vinted-go.png',
  'relais-colis': '/logos/relais-colis.png',
  'pickup': '/logos/pickup.png'
};

export default function LockerParcelApp() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  
  const [parcels, setParcels] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [pickupLocation, setPickupLocation] = useState('hyper-u-locker');
  const [lockerType, setLockerType] = useState('mondial-relay');
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [collectedToday, setCollectedToday] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncStatus, setSyncStatus] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [filterLockerType, setFilterLockerType] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocationInput, setShowCustomLocationInput] = useState(false);
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [oneSignalError, setOneSignalError] = useState(false);
  
  // Wake Lock pour empêcher la mise en veille
  const wakeLockRef = useRef(null);

  // ========================================
  // WAKE LOCK - EMPÊCHER LA MISE EN VEILLE
  // ========================================
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLockRef.current = wakeLock;
          console.log('🔓 Wake Lock activé - L\'écran ne se mettra pas en veille');

          wakeLock.addEventListener('release', () => {
            console.log('🔒 Wake Lock désactivé');
          });
        } else {
          console.log('⚠️ Wake Lock API non supportée sur cet appareil');
        }
      } catch (err) {
        console.error('❌ Erreur Wake Lock:', err);
      }
    };

    // Réactiver le Wake Lock quand la page redevient visible
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ========================================
  // INITIALISATION
  // ========================================
  useEffect(() => {
    checkAuth();
    const handleOnline = () => { setIsOnline(true); setSyncStatus('🟢 En ligne'); syncOfflineChanges(); };
    const handleOffline = () => { setIsOnline(false); setSyncStatus('🔴 Hors ligne - Les modifications seront synchronisées'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    setSyncStatus(navigator.onLine ? '🟢 En ligne' : '🔴 Hors ligne');
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      // Vérifier si OneSignal est chargé
      const checkOneSignal = () => {
        if (typeof window !== 'undefined' && window.OneSignal) {
          setOneSignalReady(true);
          setOneSignalError(false);
          console.log('✅ OneSignal prêt');
        } else {
          setOneSignalReady(false);
          setOneSignalError(true);
          console.warn('⚠️ OneSignal non disponible (probablement bloqué par un ad-blocker)');
        }
      };

      // Vérifier immédiatement
      checkOneSignal();
      
      // Revérifier après un délai (au cas où OneSignal charge lentement)
      setTimeout(checkOneSignal, 2000);

      loadParcels();
      if (isOnline) { 
        setupRealtimeSubscription();
      }
      trackCollectedToday();
      loadOfflineQueue();
    }
  }, [isLoggedIn, isOnline, username]);

  useEffect(() => { 
    return () => { 
      if (window.realtimeChannel) supabase.removeChannel(window.realtimeChannel); 
    }; 
  }, []);

  // ========================================
  // FONCTIONS PRINCIPALES
  // ========================================
  const checkAuth = async () => {
    const startTime = Date.now();
    
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    if (savedUsername && savedPassword) { 
      setUsername(savedUsername); 
      setPassword(savedPassword); 
      setIsLoggedIn(true); 
    } else {
      router.push('/');
    }
    
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < 800) {
      await new Promise(resolve => setTimeout(resolve, 800 - elapsedTime));
    }
    
    setLoading(false);
  };
  
  const loadParcels = async () => {
    try {
      const { data, error} = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', username)
        .order('collected', { ascending: true })
        .order('date_added', { ascending: false });
      
      if (error) throw error;
      setParcels(data || []);
      localStorage.setItem(`parcels_${username}`, JSON.stringify(data || []));
    } catch (error) {
      console.error('Erreur de chargement:', error);
      const cached = localStorage.getItem(`parcels_${username}`);
      if (cached) { 
        setParcels(JSON.parse(cached)); 
        setSyncStatus('🟡 Données en cache'); 
      }
    } finally { 
      setLoading(false); 
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`parcels-${username}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'parcels', 
          filter: `user_id=eq.${username}` 
        }, 
        (payload) => {
          console.log('🔄 Changement temps réel:', payload);
          
          if (payload.eventType === 'INSERT') {
            setParcels(prev => {
              const exists = prev.some(p => p.id === payload.new.id);
              if (exists) { 
                console.log('⚠️ Doublon évité:', payload.new.id); 
                return prev; 
              }
              const updated = [payload.new, ...prev];
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              return updated;
            });
            
            // ✅ NOTIFICATION "NOUVEAU CODE" - NE S'ACTIVE QUE SI AJOUTÉ PAR UN AUTRE APPAREIL
            if (!payload.new.collected) {
              showLocalNotification(
                `Nouveau colis ajouté : ${payload.new.code}`,
                `new-code-${payload.new.id}`
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            setParcels(prev => {
              const updated = prev.map(p => p.id === payload.new.id ? payload.new : p);
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              
              // ✅ NOTIFICATION RÉCUPÉRATION - UNIQUEMENT SI LE STATUT CHANGE
              if (payload.new.collected && !payload.old?.collected) {
                showLocalNotification(
                  `Colis ${payload.new.code} récupéré ! 🎉`,
                  `collected-${payload.new.id}`
                );
              }
              
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ Suppression détectée:', payload.old.id);
            setParcels(prev => {
              const updated = prev.filter(p => p.id !== payload.old.id);
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { 
          console.log('✅ Temps réel activé'); 
          setSyncStatus('🟢 Synchronisé en temps réel'); 
        } else if (status === 'CHANNEL_ERROR') { 
          console.error('❌ Erreur canal Realtime'); 
          setSyncStatus('⚠️ Erreur de synchronisation'); 
        }
      });
    
    window.realtimeChannel = channel;
  };

  // ✅ NOTIFICATION LOCALE (Service Worker) - Évite les doublons
  const showLocalNotification = (message, tag = `parcel-${Date.now()}`) => {
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('Gestionnaire de Colis', { 
          body: message, 
          icon: '/icons/package-icon.png', 
          badge: '/icons/badge-icon.png', 
          vibrate: [200, 100, 200], 
          tag: tag,
          requireInteraction: false,
          renotify: true
        });
      });
    }
  };

  const trackCollectedToday = async () => {
    try {
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', username)
        .eq('collected', true)
        .gte('date_added', today.toISOString());
      
      if (error) throw error;
      setCollectedToday(data?.length || 0);
    } catch (error) { 
      console.error('Erreur tracking:', error); 
    }
  };

  const loadOfflineQueue = () => { 
    const queue = localStorage.getItem(`offline_queue_${username}`); 
    if (queue) setOfflineQueue(JSON.parse(queue)); 
  };
  
  const saveOfflineQueue = (queue) => localStorage.setItem(`offline_queue_${username}`, JSON.stringify(queue));
  
  const addToOfflineQueue = (action) => { 
    const newQueue = [...offlineQueue, { ...action, timestamp: Date.now() }]; 
    setOfflineQueue(newQueue); 
    saveOfflineQueue(newQueue); 
  };

  const syncOfflineChanges = async () => {
    if (offlineQueue.length === 0) return;
    setSyncStatus('🔄 Synchronisation...');
    
    for (const action of offlineQueue) {
      try {
        switch (action.type) {
          case 'add': 
            await supabase.from('parcels').insert(action.data); 
            break;
          case 'update': 
            await supabase.from('parcels').update(action.data).eq('id', action.id); 
            break;
          case 'delete': 
            await supabase.from('parcels').delete().eq('id', action.id); 
            break;
        }
      } catch (error) { 
        console.error('Erreur sync:', error); 
      }
    }
    
    setOfflineQueue([]); 
    saveOfflineQueue([]); 
    setSyncStatus('✅ Synchronisé'); 
    await loadParcels();
    setTimeout(() => setSyncStatus('🟢 En ligne'), 2000);
  };

  const extractParcelCodes = (text) => {
    let codes = [];
    if (lockerType === 'mondial-relay') {
      codes = text.match(/[A-Z0-9]{6}(?![A-Z0-9])/gi) || [];
    } else if (lockerType === 'vinted-go') {
      codes = text.split(/[\s,\n]+/).filter(code => 
        code.length >= 4 && code.length <= 20 && /[A-Z0-9-]+/i.test(code)
      );
    } else {
      codes = text.split(/[\s,\n]+/).filter(code => 
        code.length >= 4 && code.length <= 15 && /[A-Z0-9]+/i.test(code)
      );
    }
    return codes ? [...new Set(codes)] : [];
  };

// ========================================
  // PARTIE 2 - GESTION DES COLIS
  // ========================================
  
  const addParcels = async () => {
    const codes = extractParcelCodes(codeInput);
    if (codes.length === 0) { 
      alert('Aucun code de colis valide trouvé'); 
      return; 
    }

    const newParcels = codes.map(code => ({ 
      code: code.toUpperCase(), 
      location: pickupLocation, 
      locker_type: lockerType, 
      collected: false, 
      user_id: username 
    }));

    if (!isOnline) {
      const tempParcels = newParcels.map(p => ({ 
        ...p, 
        id: `temp_${Date.now()}_${Math.random()}`, 
        date_added: new Date().toISOString() 
      }));
      setParcels(prev => [...tempParcels, ...prev]);
      tempParcels.forEach(p => addToOfflineQueue({ type: 'add', data: p }));
      setCodeInput(''); 
      setSyncStatus('💾 Sauvegardé hors ligne');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('parcels')
        .insert(newParcels)
        .select();
      
      if (error) throw error;

      // ✅ NOTIFICATION ONESIGNAL - Uniquement si OneSignal est disponible et pas bloqué
      if (oneSignalReady && !oneSignalError) {
        try {
          await fetch('/api/notify-colis-added', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: username,
              colisCodes: codes,
              location: pickupLocation,
              lockerType: lockerType
            })
          });
          console.log('✅ Notification OneSignal envoyée à tous les appareils');
        } catch (notifError) {
          console.error('⚠️ Erreur notification OneSignal:', notifError);
        }
      } else if (oneSignalError) {
        console.log('ℹ️ OneSignal bloqué - notifications locales uniquement');
      }

      await loadParcels(); 
      setCodeInput('');
      setToastMessage(`✅ ${data.length} colis ajouté${data.length > 1 ? 's' : ''}`); 
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) { 
      console.error('Erreur d\'ajout:', error); 
      alert('Erreur lors de l\'ajout des colis'); 
    }
  };

  const toggleCollected = async (id, currentStatus) => {
    const parcel = parcels.find(p => p.id === id);
    const optimisticUpdate = parcels.map(p => 
      p.id === id ? { ...p, collected: !currentStatus } : p
    );
    setParcels(optimisticUpdate);

    if (!currentStatus) {
      setCollectedToday(prev => prev + 1);
    } else {
      setCollectedToday(prev => Math.max(0, prev - 1));
    }

    if (!isOnline) { 
      addToOfflineQueue({ type: 'update', id, data: { collected: !currentStatus } }); 
      setSyncStatus('💾 Modification hors ligne'); 
      return; 
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('parcels')
        .update({ 
          collected: !currentStatus, 
          date_added: !currentStatus ? now : parcels.find(p => p.id === id)?.date_added 
        })
        .eq('id', id);
      
      if (error) throw error;

      // ✅ NOTIFICATION ONESIGNAL - Uniquement si OneSignal est disponible
      if (!currentStatus && oneSignalReady && !oneSignalError && parcel) {
        try {
          await fetch('/api/notify-colis-collected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: username,
              colisCode: parcel.code
            })
          });
          console.log('✅ Notification OneSignal récupération envoyée');
        } catch (notifError) {
          console.error('⚠️ Erreur notification OneSignal:', notifError);
        }
      }

      await loadParcels();
    } catch (error) { 
      console.error('Erreur de mise à jour:', error); 
      setParcels(parcels); 
    }
  };

  const changeLockerType = async (id, newType) => {
    if (!isOnline) { 
      const updated = parcels.map(p => p.id === id ? { ...p, locker_type: newType } : p); 
      setParcels(updated); 
      addToOfflineQueue({ type: 'update', id, data: { locker_type: newType } }); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .update({ locker_type: newType })
        .eq('id', id);
      
      if (error) throw error;
      setParcels(parcels.map(parcel => 
        parcel.id === id ? { ...parcel, locker_type: newType } : parcel
      ));
    } catch (error) { 
      console.error('Erreur de mise à jour:', error); 
    }
  };

  const changePickupLocation = async (id, newLocation) => {
    if (!isOnline) { 
      const updated = parcels.map(p => p.id === id ? { ...p, location: newLocation } : p); 
      setParcels(updated); 
      addToOfflineQueue({ type: 'update', id, data: { location: newLocation } }); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .update({ location: newLocation })
        .eq('id', id);
      
      if (error) throw error;
      setParcels(parcels.map(parcel => 
        parcel.id === id ? { ...parcel, location: newLocation } : parcel
      ));
    } catch (error) { 
      console.error('Erreur de mise à jour:', error); 
    }
  };

  const deleteParcel = async (id) => {
    const parcelToDelete = parcels.find(p => p.id === id);
    setParcels(prev => prev.filter(p => p.id !== id));

    if (!isOnline) { 
      addToOfflineQueue({ type: 'delete', id }); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', id);
      
      if (error) { 
        console.error('Erreur suppression:', error); 
        setParcels(prev => [...prev, parcelToDelete].sort((a, b) => 
          a.collected === b.collected ? 0 : a.collected ? 1 : -1
        )); 
        alert('Erreur lors de la suppression'); 
        throw error; 
      }
      console.log('✅ Colis supprimé:', id);
    } catch (error) { 
      console.error('Erreur de suppression:', error); 
    }
  };

  const deleteAllCollected = async () => {
    if (!confirm('Supprimer tous les colis récupérés ?')) return;
    
    const collectedIds = collectedParcels.map(p => p.id);

    if (!isOnline) { 
      setParcels(parcels.filter(p => !p.collected)); 
      collectedIds.forEach(id => addToOfflineQueue({ type: 'delete', id })); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .in('id', collectedIds);
      
      if (error) throw error;
      setParcels(parcels.filter(parcel => !parcel.collected));
      setToastMessage(`✅ ${collectedIds.length} colis supprimés`); 
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) { 
      console.error('Erreur de suppression:', error); 
      alert('Erreur lors de la suppression'); 
    }
  };

  // ========================================
  // FONCTIONS UTILITAIRES
  // ========================================
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const getRemainingDays = (dateAdded) => {
    const added = new Date(dateAdded);
    const now = new Date();
    const diffTime = now - added;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return 5 - diffDays;
  };

  const getRemainingDaysText = (remainingDays) => {
    if (remainingDays < 0) return '⚠️ EXPIRÉ';
    if (remainingDays === 0) return '⚠️ Aujourd\'hui - DERNIER JOUR';
    if (remainingDays === 1) return '⚠️ 1 jour restant';
    return `${remainingDays} jours restants`;
  };

  const getLockerName = (type) => {
    const names = {
      'mondial-relay': 'Mondial Relay',
      'vinted-go': 'Vinted GO',
      'relais-colis': 'Relais Colis',
      'pickup': 'Pickup'
    };
    return names[type] || type;
  };

  const getPickupLocationName = (location) => {
    const names = {
      'hyper-u-locker': '🏪 Hyper U - Locker',
      'hyper-u-accueil': '🏪 Hyper U - Accueil',
      'intermarche-locker': '🛒 Intermarché - Locker',
      'intermarche-accueil': '🛒 Intermarché - Accueil',
      'rond-point-noyal': '📍 Rond point Noyal - Locker'
    };
    if (location.startsWith('custom:')) {
      return `📍 ${location.replace('custom:', '')}`;
    }
    return names[location] || location;
  };

  const addCustomLocation = () => {
    if (customLocation.trim()) {
      const customValue = `custom:${customLocation.trim()}`;
      setPickupLocation(customValue);
      setShowCustomLocationInput(false);
      setCustomLocation('');
    }
  };

  // ========================================
  // DONNÉES CALCULÉES
  // ========================================
  const pendingParcels = parcels.filter(p => !p.collected);
  const collectedParcels = parcels.filter(p => p.collected);

  const filteredPendingParcels = pendingParcels.filter(parcel => {
    const matchesLockerType = filterLockerType === 'all' || parcel.locker_type === filterLockerType;
    const matchesLocation = filterLocation === 'all' || parcel.location === filterLocation;
    return matchesLockerType && matchesLocation;
  });

// ========================================
  // PARTIE 3 - RENDU JSX
  // ========================================

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-50 to-purple-100'}`}>
        <div className="text-center">
          <div className={`inline-block animate-spin rounded-full h-16 w-16 border-4 border-t-transparent mb-4 ${darkMode ? 'border-indigo-400' : 'border-indigo-600'}`}></div>
          <p className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-indigo-50 to-purple-100'} transition-colors duration-300`}>
      {/* Composant de permission de notifications */}
      <NotificationPermission username={username} />

      {/* Toast de notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${darkMode ? 'bg-green-600' : 'bg-green-500'} text-white font-medium`}>
            {toastMessage}
          </div>
        </div>
      )}

      <div className="p-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 shadow-xl' : 'bg-white shadow-lg'} rounded-2xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#9ca3af' : '#4b5563'} strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                </svg>
              </button>
              
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Mes Colis</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Connecté: {username}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Indicateur Wake Lock */}
              {wakeLockRef.current && (
                <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'}`} title="L'écran ne se mettra pas en veille">
                  🔓 Actif
                </span>
              )}

              {/* Indicateur OneSignal */}
              {oneSignalError && (
                <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`} title="OneSignal bloqué - Notifications locales uniquement">
                  ⚠️ Notif locales
                </span>
              )}

              <button onClick={toggleDarkMode} className={`p-2 rounded-lg transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {darkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
              
              <button onClick={() => router.push('/')} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-indigo-600 hover:to-purple-700 transition">
                Retour
              </button>
            </div>
          </div>

          <div className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{syncStatus}</span>
              {collectedToday > 0 && (
                <span className={`text-sm font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                  ✅ {collectedToday} récupéré{collectedToday > 1 ? 's' : ''} aujourd'hui
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Formulaire d'ajout de colis - RESTE IDENTIQUE À VOTRE CODE ORIGINAL */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Ajouter un colis</h2>
          
          {/* Type de transporteur */}
          <div className="mb-4">
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>Type de transporteur :</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'mondial-relay', label: 'Mondial Relay', logo: '/logos/mondial-relay.png' },
                { value: 'vinted-go', label: 'Vinted GO', logo: '/logos/vinted-go.png' },
                { value: 'relais-colis', label: 'Relais Colis', logo: '/logos/relais-colis.png' },
                { value: 'pickup', label: 'Pickup', logo: '/logos/pickup.png' }
              ].map(locker => (
                <button
                  key={locker.value}
                  onClick={() => setLockerType(locker.value)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition ${
                    lockerType === locker.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 dark:border-indigo-400'
                      : darkMode 
                        ? 'border-gray-600 hover:border-gray-500' 
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img src={locker.logo} alt={locker.label} className="h-6 object-contain" />
                  <span className={`text-sm font-medium ${lockerType === locker.value ? 'text-indigo-600 dark:text-indigo-300' : darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {locker.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Point de retrait */}
          <div className="mb-4">
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>Point de retrait :</label>
            <select
              value={pickupLocation}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setShowCustomLocationInput(true);
                } else {
                  setPickupLocation(e.target.value);
                  setShowCustomLocationInput(false);
                }
              }}
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100' 
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <option value="hyper-u-locker">🏪 Hyper U - Locker</option>
              <option value="hyper-u-accueil">🏪 Hyper U - Accueil</option>
              <option value="intermarche-locker">🛒 Intermarché - Locker</option>
              <option value="intermarche-accueil">🛒 Intermarché - Accueil</option>
              <option value="rond-point-noyal">📍 Rond point Noyal - Locker</option>
              <option value="custom">➕ Autre point de retrait...</option>
            </select>

            {showCustomLocationInput && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Nom du point de retrait"
                  className={`flex-1 px-4 py-2 border-2 rounded-xl focus:border-indigo-500 focus:outline-none ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200'
                  }`}
                />
                <button
                  onClick={addCustomLocation}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition"
                >
                  Ajouter
                </button>
              </div>
            )}
          </div>

          {/* Code colis */}
          <div className="mb-4">
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>Code(s) colis :</label>
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={
                lockerType === 'mondial-relay' 
                  ? 'Format 6 caractères (ex: ABC123)' 
                  : 'Un ou plusieurs codes (séparés par espace, virgule ou retour à la ligne)'
              }
              rows="3"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none resize-none transition ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                  : 'bg-white border-gray-200'
              }`}
            />
          </div>

          <button
            onClick={addParcels}
            disabled={!isOnline && offlineQueue.length > 0}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Ajouter le(s) colis
          </button>
        </div>

        {/* ========================================
            PARTIE 4 - JSX FILTRES ET LISTE DES COLIS
            À COLLER APRÈS LA PARTIE 3
            ======================================== */}

        {/* SECTION FILTRES */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filtrer mes colis
          </h2>
          
          {(() => {
            const usedLockerTypes = [...new Set(pendingParcels.map(p => p.locker_type))];
            if (usedLockerTypes.length > 1) {
              return (
                <div className="mb-4">
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>Par transporteur :</p>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => setFilterLockerType('all')} 
                      className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                        filterLockerType === 'all' 
                          ? 'bg-indigo-600 text-white' 
                          : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>📦 Tous</span>
                      <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLockerType('all')}</span>
                    </button>
                    {usedLockerTypes.includes('mondial-relay') && (
                      <button 
                        onClick={() => setFilterLockerType('mondial-relay')} 
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                          filterLockerType === 'mondial-relay' ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>🌐 Mondial Relay</span>
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLockerType('mondial-relay')}</span>
                      </button>
                    )}
                    {usedLockerTypes.includes('vinted-go') && (
                      <button 
                        onClick={() => setFilterLockerType('vinted-go')} 
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                          filterLockerType === 'vinted-go' ? 'bg-teal-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>👕 Vinted GO</span>
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLockerType('vinted-go')}</span>
                      </button>
                    )}
                    {usedLockerTypes.includes('relais-colis') && (
                      <button 
                        onClick={() => setFilterLockerType('relais-colis')} 
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                          filterLockerType === 'relais-colis' ? 'bg-green-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>📮 Relais Colis</span>
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLockerType('relais-colis')}</span>
                      </button>
                    )}
                    {usedLockerTypes.includes('pickup') && (
                      <button 
                        onClick={() => setFilterLockerType('pickup')} 
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                          filterLockerType === 'pickup' ? 'bg-orange-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>🎁 Pickup</span>
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLockerType('pickup')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {(() => {
            const usedLocations = [...new Set(pendingParcels.map(p => p.location))];
            if (usedLocations.length > 1) {
              return (
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>Par lieu :</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterLocation('all')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'all' ? 'bg-indigo-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <span>📦 Tous les lieux</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('all')}</span>
                    </button>
                    {usedLocations.includes('hyper-u-locker') && (<button onClick={() => setFilterLocation('hyper-u-locker')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'hyper-u-locker' ? 'bg-purple-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>🏪 Hyper U Locker</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('hyper-u-locker')}</span></button>)}
                    {usedLocations.includes('hyper-u-accueil') && (<button onClick={() => setFilterLocation('hyper-u-accueil')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'hyper-u-accueil' ? 'bg-purple-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>🏪 Hyper U Accueil</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('hyper-u-accueil')}</span></button>)}
                    {usedLocations.includes('intermarche-locker') && (<button onClick={() => setFilterLocation('intermarche-locker')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'intermarche-locker' ? 'bg-red-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>🛒 Intermarché Locker</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('intermarche-locker')}</span></button>)}
                    {usedLocations.includes('intermarche-accueil') && (<button onClick={() => setFilterLocation('intermarche-accueil')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'intermarche-accueil' ? 'bg-red-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>🛒 Intermarché Accueil</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('intermarche-accueil')}</span></button>)}
                    {usedLocations.includes('rond-point-noyal') && (<button onClick={() => setFilterLocation('rond-point-noyal')} className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${filterLocation === 'rond-point-noyal' ? 'bg-yellow-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><span>📍 Rond point Noyal</span><span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">{getCountByLocation('rond-point-noyal')}</span></button>)}
                    {usedLocations.some(loc => loc.startsWith('custom:')) && (
                      <button 
                        onClick={() => setFilterLocation('custom')} 
                        className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                          filterLocation === 'custom' ? 'bg-gray-600 text-white' : darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>📍 Autres lieux</span>
                        <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                          {pendingParcels.filter(p => p.location.startsWith('custom:')).length}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {(filterLockerType !== 'all' || filterLocation !== 'all') && (
            <div className={`mt-4 flex items-center justify-between rounded-lg p-3 border-2 ${darkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-sm font-medium ${darkMode ? 'text-blue-200' : 'text-blue-800'}`}>🔍 Affichage de {filteredPendingParcels.length} colis sur {pendingParcels.length}</p>
              <button onClick={() => {setFilterLockerType('all'); setFilterLocation('all');}} className={`text-sm font-semibold underline ${darkMode ? 'text-blue-300 hover:text-blue-100' : 'text-blue-600 hover:text-blue-800'}`}>Réinitialiser</button>
            </div>
          )}

          {(() => {
            const usedLockerTypes = [...new Set(pendingParcels.map(p => p.locker_type))];
            const usedLocations = [...new Set(pendingParcels.map(p => p.location))];
            if (usedLockerTypes.length <= 1 && usedLocations.length <= 1) {
              return (<div className="text-center py-4"><p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>✨ Aucun filtre nécessaire - Tous vos colis sont au même endroit !</p></div>);
            }
            return null;
          })()}
        </div>

        {/* Colis en attente */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            À récupérer ({filteredPendingParcels.length})
          </h2>
          
          {filteredPendingParcels.length === 0 ? (
            <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {pendingParcels.length === 0 ? 'Aucun colis en attente' : 'Aucun colis ne correspond aux filtres'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPendingParcels.map(parcel => {
                const remainingDays = getRemainingDays(parcel.date_added);
                const isUrgent = remainingDays <= 1;
                
                return (
                  <div
                    key={parcel.id}
                    onClick={(e) => {
                      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'OPTION') {
                        toggleCollected(parcel.id, parcel.collected);
                      }
                    }}
                    className={`border-2 rounded-xl p-4 transition cursor-pointer ${
                      isUrgent 
                        ? darkMode 
                          ? 'border-yellow-600 bg-yellow-900 bg-opacity-30 hover:border-yellow-500' 
                          : 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                        : darkMode 
                          ? 'border-gray-600 hover:border-indigo-400 bg-gray-700' 
                          : 'border-gray-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollected(parcel.id, parcel.collected);
                        }}
                        className={`mt-1 w-6 h-6 border-2 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                          darkMode 
                            ? 'border-gray-500 hover:border-indigo-400' 
                            : 'border-gray-300 hover:border-indigo-500'
                        }`}
                      >
                        {parcel.collected && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                          <select
                            value={parcel.locker_type}
                            onChange={(e) => {
                              e.stopPropagation();
                              changeLockerType(parcel.id, e.target.value);
                            }}
                            className={`text-sm bg-transparent border-none focus:outline-none cursor-pointer font-medium ${
                              darkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="mondial-relay">Mondial Relay</option>
                            <option value="vinted-go">Vinted GO</option>
                            <option value="relais-colis">Relais Colis</option>
                            <option value="pickup">Pickup</option>
                          </select>
                        </div>
                        
                        <div className={`text-2xl font-bold break-all mb-2 ${
                          darkMode ? 'text-indigo-400' : 'text-indigo-600'
                        }`}>
                          {parcel.code}
                        </div>
                        
                        <div className="mb-2">
                          <select
                            value={parcel.location}
                            onChange={(e) => {
                              e.stopPropagation();
                              changePickupLocation(parcel.id, e.target.value);
                            }}
                            className={`text-sm bg-transparent border rounded px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors duration-300 ${
                              darkMode 
                                ? 'border-gray-600 text-gray-300' 
                                : 'border-gray-200 text-gray-600'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="hyper-u-locker">🏪 Hyper U - Locker</option>
                            <option value="hyper-u-accueil">🏪 Hyper U - Accueil</option>
                            <option value="intermarche-locker">🛒 Intermarché - Locker</option>
                            <option value="intermarche-accueil">🛒 Intermarché - Accueil</option>
                            <option value="rond-point-noyal">📍 Rond point Noyal - Locker</option>
                            {parcel.location.startsWith('custom:') && (
                              <option value={parcel.location}>
                              📍 Autre point de retrait ({parcel.location.replace('custom:', '')})
                              </option>
                            )}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {formatDate(parcel.date_added)}
                          </span>
                          <span className={`${
                            isUrgent 
                              ? 'font-bold text-red-600 opacity-100' 
                              : darkMode 
                                ? 'text-gray-400 opacity-60' 
                                : 'opacity-60'
                          }`}>
                            {getRemainingDaysText(remainingDays)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteParcel(parcel.id);
                        }}
                        className={`p-2 rounded-lg transition flex-shrink-0 ${
                          darkMode 
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-900' 
                            : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                        }`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colis récupérés */}
        {collectedParcels.length > 0 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Récupérés ({collectedParcels.length})
            </h2>
            
            <div className="space-y-3 mb-4">
              {collectedParcels.map(parcel => (
                <div
                  key={parcel.id}
                  className={`border-2 rounded-xl p-4 transition ${
                    darkMode 
                      ? 'border-green-700 bg-green-900 bg-opacity-20 opacity-75' 
                      : 'border-green-200 bg-green-50 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCollected(parcel.id, parcel.collected)}
                      className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                        darkMode 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                        <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {getLockerName(parcel.locker_type)}
                        </span>
                      </div>
                      <div className={`text-xl font-bold line-through break-all mb-1 ${
                        darkMode ? 'text-gray-500' : 'text-gray-600'
                      }`}>
                        {parcel.code}
                      </div>
                      <div className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {getPickupLocationName(parcel.location)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => deleteParcel(parcel.id)}
                      className={`p-2 rounded-lg transition flex-shrink-0 ${
                        darkMode 
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-900' 
                          : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                      }`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={deleteAllCollected}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Supprimer tous les colis récupérés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
