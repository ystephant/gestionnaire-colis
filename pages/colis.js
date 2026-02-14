import React, { useState, useEffect } from 'react';
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
  const [wakeLock, setWakeLock] = useState(null);

  // ✅ Wake Lock - Empêche la mise en veille
  const enableWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        console.log('✅ Wake Lock activé - l\'écran ne se mettra pas en veille');
        
        lock.addEventListener('release', () => {
          console.log('⚠️ Wake Lock libéré');
          setWakeLock(null);
        });
        
        return lock;
      } else {
        console.log('⚠️ Wake Lock non supporté sur cet appareil');
      }
    } catch (err) {
      console.error('❌ Erreur Wake Lock:', err);
    }
  };

  const disableWakeLock = async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      console.log('Wake Lock désactivé');
    }
  };

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
      loadParcels();
      enableWakeLock(); // ✅ Activer Wake Lock
      if (isOnline) { 
        setupRealtimeSubscription(); // ✅ Temps réel Supabase
      }
      loadOfflineQueue();
    }
  }, [isLoggedIn, isOnline, username]);

  // ✅ Configuration OneSignal pour l'utilisateur connecté
  useEffect(() => {
    if (isLoggedIn && username) {
      console.log('👤 Utilisateur connecté:', username);
      console.log('🔔 Initialisation OneSignal pour cet utilisateur...');
      
      const initOneSignalUser = async (retryCount = 0) => {
        const maxRetries = 5;
        
        if (typeof window === 'undefined' || !window.OneSignal) {
          if (retryCount < maxRetries) {
            console.log(`⏳ OneSignal pas encore chargé, retry ${retryCount + 1}/${maxRetries}...`);
            setTimeout(() => initOneSignalUser(retryCount + 1), 500);
          } else {
            console.error('❌ OneSignal non disponible après plusieurs tentatives');
          }
          return;
        }
        
        try {
          console.log('🔐 Appel OneSignal.login() pour:', username);
          await window.OneSignal.login(username);
          console.log('✅ OneSignal.login() réussi !');
          
          const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
          console.log('📱 Push notifications activées:', isPushEnabled);
          
          if (isPushEnabled) {
            const subscriptionId = window.OneSignal.User.PushSubscription.id;
            console.log('🆔 Subscription ID:', subscriptionId);
            setOneSignalReady(true);
            console.log('✅ OneSignal prêt pour les notifications');
          } else {
            console.log('⚠️ Notifications non activées');
          }
          
          window.OneSignal.Notifications.addEventListener('click', (event) => {
            console.log('🔔 Notification cliquée:', event);
            loadParcels();
          });
          
        } catch (error) {
          console.error('❌ Erreur OneSignal.login():', error);
          if (retryCount < maxRetries) {
            console.log(`🔄 Retry dans 2 secondes... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => initOneSignalUser(retryCount + 1), 2000);
          }
        }
      };
      
      initOneSignalUser();
    }
  }, [isLoggedIn, username]);

  useEffect(() => { 
    return () => { 
      if (window.realtimeChannel) supabase.removeChannel(window.realtimeChannel);
      disableWakeLock();
    }; 
  }, []);

  // ✅ Recharger les données quand la page reprend le focus
  useEffect(() => {
    const handleFocus = () => {
      if (isLoggedIn && username) {
        console.log('🔄 Page active, rechargement des données...');
        loadParcels();
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoggedIn && username) {
        console.log('🔄 Page visible, rechargement des données...');
        loadParcels();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, username]);
  
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

  // ✅ Temps réel Supabase - Synchronisation automatique
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
          } else if (payload.eventType === 'UPDATE') {
            setParcels(prev => {
              const updated = prev.map(p => p.id === payload.new.id ? payload.new : p);
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              
              if (payload.new.collected && !payload.old?.collected) {
                showNotification(
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
        console.log('📡 État canal Realtime:', status);
        
        if (status === 'SUBSCRIBED') { 
          console.log('✅ Temps réel activé'); 
          setSyncStatus('🟢 Synchronisé en temps réel'); 
        } else if (status === 'CHANNEL_ERROR') { 
          console.error('❌ Erreur canal Realtime'); 
          setSyncStatus('⚠️ Erreur de synchronisation'); 
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Canal fermé - reconnexion dans 3s...');
          setSyncStatus('⚠️ Reconnexion...');
          
          if (window.realtimeChannel) {
            supabase.removeChannel(window.realtimeChannel);
          }
          
          setTimeout(() => {
            if (isLoggedIn && username) {
              console.log('🔄 Reconnexion au canal Realtime...');
              setupRealtimeSubscription();
            }
          }, 3000);
        }
      });
    
    window.realtimeChannel = channel;
  };

  const showNotification = (message, tag = `parcel-${Date.now()}`) => {
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

      // ✅ ENVOI DE NOTIFICATION avec logs détaillés
      console.log('📤 Tentative envoi notification...');
      console.log('🔍 oneSignalReady:', oneSignalReady);
      console.log('🔍 window.OneSignal:', !!window.OneSignal);
      
      if (oneSignalReady && window.OneSignal) {
        try {
          console.log('📦 Envoi pour userId:', username);
          console.log('📦 Codes:', codes);
          
          const notifResponse = await fetch('/api/notify-colis-added', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: username,
              colisCodes: codes,
              location: pickupLocation,
              lockerType: lockerType
            })
          });
          
          const notifResult = await notifResponse.json();
          
          console.log('📨 Résultat notification (status ' + notifResponse.status + '):', notifResult);
          
          if (notifResponse.ok) {
            if (notifResult.recipients > 0) {
              console.log('✅ Notification envoyée à', notifResult.recipients, 'appareil(s)');
            } else {
              console.warn('⚠️ Notification envoyée mais 0 destinataires');
            }
          } else {
            console.error('❌ Erreur API notification:', notifResult);
          }
          
        } catch (notifError) {
          console.error('⚠️ Erreur notification:', notifError);
        }
      } else {
        console.warn('⚠️ OneSignal pas prêt, notification non envoyée');
      }

      await loadParcels(); 
      setCodeInput('');
      setToastMessage(`✅ ${data.length} colis ajouté${data.length > 1 ? 's' : ''}`); 
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) { 
      console.error('❌ Erreur d\'ajout:', error); 
      alert('Erreur lors de l\'ajout des colis'); 
    }
  };

  // ✅ Marquer un colis comme récupéré
  const toggleCollected = async (id, currentStatus) => {
    const parcel = parcels.find(p => p.id === id);
    const optimisticUpdate = parcels.map(p => 
      p.id === id ? { ...p, collected: !currentStatus } : p
    );
    setParcels(optimisticUpdate);

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

      if (!currentStatus && oneSignalReady && parcel) {
        try {
          await fetch('/api/notify-colis-collected', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: username,
              colisCode: parcel.code
            })
          });
          console.log('✅ Notification récupération envoyée');
        } catch (notifError) {
          console.error('⚠️ Erreur notification:', notifError);
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
    console.log('🗑️ Suppression de', collectedIds.length, 'colis récupérés');
    console.log('🔍 IDs:', collectedIds);

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
      
      console.log('✅ Suppression réussie dans Supabase');
      
      // ✅ CORRECTION : Recharger les données depuis Supabase pour s'assurer de la synchronisation
      await loadParcels();
      
      setToastMessage(`✅ ${collectedIds.length} colis supprimés`); 
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      console.log('✅ Données rechargées, synchronisation terminée');
    } catch (error) { 
      console.error('❌ Erreur de suppression:', error); 
      alert('Erreur lors de la suppression'); 
    }
  };

  const getRemainingDays = (dateAdded) => { 
    const added = new Date(dateAdded); 
    const now = new Date(); 
    const diffTime = now - added; 
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    return Math.max(0, 5 - diffDays); 
  };

  const getRemainingDaysText = (remainingDays) => { 
    if (remainingDays === 0) return '⚠️ Dernier jour pour récupérer'; 
    if (remainingDays === 1) return '⏰ Il te reste 1 jour'; 
    return `📅 Il te reste ${remainingDays} jours`; 
  };

  const getPickupLocationName = (location) => { 
    if (location.startsWith('custom:')) {
      return `📍 Autre point de retrait (${location.replace('custom:', '')})`;
    }
    switch(location) { 
      case 'hyper-u-locker': return '🏪 Hyper U - Locker'; 
      case 'hyper-u-accueil': return '🏪 Hyper U - Accueil'; 
      case 'intermarche-locker': return '🛒 Intermarché - Locker'; 
      case 'intermarche-accueil': return '🛒 Intermarché - Accueil'; 
      case 'rond-point-noyal': return '📍 Rond point Noyal - Locker'; 
      default: return location; 
    } 
  };

  const getFilteredParcels = (parcelsList) => { 
    let filtered = parcelsList; 
    if (filterLockerType !== 'all') {
      filtered = filtered.filter(p => p.locker_type === filterLockerType); 
    }
    if (filterLocation !== 'all') {
      if (filterLocation === 'custom') {
        filtered = filtered.filter(p => p.location.startsWith('custom:'));
      } else {
        filtered = filtered.filter(p => p.location === filterLocation);
      }
    }
    return filtered; 
  };

  const getCountByLockerType = (type) => { 
    if (type === 'all') return pendingParcels.length; 
    return pendingParcels.filter(p => p.locker_type === type).length; 
  };

  const getCountByLocation = (location) => { 
    if (location === 'all') return pendingParcels.length; 
    return pendingParcels.filter(p => p.location === location).length; 
  };

  const pendingParcels = parcels.filter(p => !p.collected);
  const collectedParcels = parcels.filter(p => p.collected);
  const filteredPendingParcels = getFilteredParcels(pendingParcels);

  const formatDate = (dateString) => { 
    const date = new Date(dateString); 
    const now = new Date(); 
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24)); 
    if (diffDays === 0) return "Aujourd'hui"; 
    if (diffDays === 1) return "Hier"; 
    return `Il y a ${diffDays} jours`; 
  };

  const getLockerName = (type) => { 
    switch(type) { 
      case 'mondial-relay': return 'Mondial Relay'; 
      case 'relais-colis': return 'Relais Colis'; 
      case 'pickup': return 'Pickup'; 
      case 'vinted-go': return 'Vinted GO'; 
      default: return 'Autre'; 
    } 
  };

  const getCodeFormatHint = () => { 
    switch(lockerType) { 
      case 'mondial-relay': return 'Format: 6 caractères (ex: A1B2C3)'; 
      case 'vinted-go': return 'Format: 4-20 caractères (ex: VT-1234-ABCD)'; 
      case 'relais-colis': return 'Format: 4-15 caractères (ex: RC123456)'; 
      case 'pickup': return 'Format: 4-15 caractères (ex: PK789012)'; 
      default: return ''; 
    } 
  };

  // ✅ Calculer le nombre unique de transporteurs et de lieux
  const uniqueLockerTypes = [...new Set(pendingParcels.map(p => p.locker_type))];
  const uniqueLocations = [...new Set(pendingParcels.map(p => p.location))];
  
  // ✅ Afficher les filtres uniquement s'il y a plus d'un transporteur OU plus d'un lieu
  const shouldShowFilters = uniqueLockerTypes.length > 1 || uniqueLocations.length > 1;

  if (loading) {
    return null;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-2xl mx-auto">
        {showToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
            {toastMessage}
          </div>
        )}

        <NotificationPermission />
        
        {syncStatus && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
          }`}>
            {syncStatus}
            {offlineQueue.length > 0 && (
              <span className="ml-2 bg-white px-2 py-1 rounded text-xs">
                {offlineQueue.length} en attente
              </span>
            )}
          </div>
        )}

        {oneSignalReady && (
          <div className="fixed top-16 right-4 px-3 py-1 rounded-lg shadow bg-blue-100 text-blue-800 text-xs z-50">
            🔔 Notifications actives
          </div>
        )}
        
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push('/')} 
                className={`${darkMode ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Mes Colis</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Connecté: {username}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className={`p-3 rounded-xl transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title={darkMode ? 'Mode clair' : 'Mode sombre'}
              >
                {darkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
              
              <button 
                onClick={() => router.push('/')} 
                className={`text-sm px-4 py-2 rounded-lg transition ${
                  darkMode 
                    ? 'text-gray-300 hover:text-red-400 hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                }`}
              >
                Retour
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 transition-colors duration-300`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-3`}>Type de transporteur :</p>
              <div className="grid grid-cols-2 gap-2">
                {['mondial-relay', 'vinted-go', 'relais-colis', 'pickup'].map(type => (
                  <label key={type} className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition ${
                    darkMode 
                      ? `${lockerType === type ? 'bg-gray-600 border-indigo-500' : 'bg-gray-600 border-gray-500 hover:border-indigo-400'}` 
                      : `${lockerType === type ? 'bg-white border-indigo-500' : 'bg-white border-gray-200 hover:border-indigo-400'}`
                  }`}>
                    <input 
                      type="radio" 
                      name="lockerType" 
                      value={type} 
                      checked={lockerType === type} 
                      onChange={(e) => setLockerType(e.target.value)} 
                      className="w-4 h-4 text-indigo-600" 
                    />
                    <img src={LOCKER_LOGOS[type]} alt={type} className="h-6 object-contain" />
                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{getLockerName(type)}</span>
                  </label>
                ))}
              </div>
              <p className={`text-xs mt-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{getCodeFormatHint()}</p>
            </div>

            <textarea 
              value={codeInput} 
              onChange={(e) => setCodeInput(e.target.value)} 
              placeholder={`Collez vos codes ici\n${getCodeFormatHint()}`} 
              rows="4" 
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none text-lg resize-none transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                  : 'bg-white border-gray-200 text-gray-900'
              }`} 
            />
            
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 transition-colors duration-300`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-3`}>Lieu de récupération du colis :</p>
              <div className="space-y-2">
                {['hyper-u-locker', 'hyper-u-accueil', 'intermarche-locker', 'intermarche-accueil', 'rond-point-noyal'].map(loc => (
                  <label key={loc} className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="pickupLocation" 
                      value={loc} 
                      checked={pickupLocation === loc && !showCustomLocationInput} 
                      onChange={(e) => {
                        setPickupLocation(e.target.value);
                        setShowCustomLocationInput(false);
                        setCustomLocation('');
                      }} 
                      className="w-4 h-4 text-indigo-600" 
                    />
                    <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{getPickupLocationName(loc)}</span>
                  </label>
                ))}
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="pickupLocation" 
                    checked={showCustomLocationInput} 
                    onChange={() => {
                      setShowCustomLocationInput(true);
                      setPickupLocation('custom:');
                    }} 
                    className="w-4 h-4 text-indigo-600" 
                  />
                  <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>📍 Autre point de retrait</span>
                </label>
                
                {showCustomLocationInput && (
                  <div className="ml-7 mt-2">
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => {
                        setCustomLocation(e.target.value);
                        setPickupLocation(`custom:${e.target.value}`);
                      }}
                      placeholder="Ex: Pharmacie centrale, Boulangerie du coin..."
                      className={`w-full px-3 py-2 border-2 rounded-lg focus:border-indigo-500 focus:outline-none text-sm ${
                        darkMode 
                          ? 'bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={addParcels} 
              disabled={!codeInput.trim()} 
              className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition shadow-lg ${
                !codeInput.trim() 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105'
              }`}
            >
              Ajouter {extractParcelCodes(codeInput).length > 0 ? `(${extractParcelCodes(codeInput).length})` : ''}
            </button>
          </div>
        </div>

        {/* ✅ Filtres - Affichés uniquement s'il y a plus d'un transporteur OU plus d'un lieu */}
        {pendingParcels.length > 0 && shouldShowFilters && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Filtres</h2>
            
            <div className="space-y-4">
              {uniqueLockerTypes.length > 1 && (
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Par transporteur:</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterLockerType('all')} className={`px-3 py-1 rounded-lg text-sm transition ${filterLockerType === 'all' ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white') : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
                      Tous ({pendingParcels.length})
                    </button>
                    {uniqueLockerTypes.map(type => (
                      <button key={type} onClick={() => setFilterLockerType(type)} className={`px-3 py-1 rounded-lg text-sm transition ${filterLockerType === type ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white') : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
                        {getLockerName(type)} ({getCountByLockerType(type)})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {uniqueLocations.length > 1 && (
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Par lieu:</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterLocation('all')} className={`px-3 py-1 rounded-lg text-sm transition ${filterLocation === 'all' ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white') : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
                      Tous ({pendingParcels.length})
                    </button>
                    {uniqueLocations.map(loc => (
                      <button key={loc} onClick={() => setFilterLocation(loc)} className={`px-3 py-1 rounded-lg text-sm transition ${filterLocation === loc ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white') : (darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
                        {getPickupLocationName(loc).replace(/^.{2}\s/, '')} ({getCountByLocation(loc)})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Liste des colis */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>
            En attente de récupération ({filteredPendingParcels.length})
          </h2>
          
          {filteredPendingParcels.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Aucun colis en attente</p>
              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-2`}>
                {pendingParcels.length > 0 ? 'Essayez de changer les filtres' : 'Ajoutez vos premiers colis'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPendingParcels.map(parcel => {
                const remainingDays = getRemainingDays(parcel.date_added);
                const isUrgent = remainingDays <= 1;
                
                return (
                  <div
                    key={parcel.id}
                    onClick={() => toggleCollected(parcel.id, parcel.collected)}
                    className={`border-2 rounded-xl p-4 transition cursor-pointer ${
                      darkMode 
                        ? `${isUrgent ? 'border-red-600 bg-red-900 bg-opacity-20 hover:bg-opacity-30' : 'border-gray-600 bg-gray-700 hover:bg-gray-650'}` 
                        : `${isUrgent ? 'border-red-400 bg-red-50 hover:bg-red-100' : 'border-gray-200 bg-white hover:bg-gray-50'}`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollected(parcel.id, parcel.collected);
                        }}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition ${
                          darkMode 
                            ? 'border-gray-500 hover:border-green-500 hover:bg-green-900' 
                            : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                        }`}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                          <select
                            value={parcel.locker_type}
                            onChange={(e) => {
                              e.stopPropagation();
                              changeLockerType(parcel.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-sm bg-transparent border rounded px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors duration-300 ${
                              darkMode 
                                ? 'border-gray-600 text-gray-300' 
                                : 'border-gray-200 text-gray-600'
                            }`}
                            style={{
                              color: darkMode ? '#d1d5db' : '#4b5563'
                            }}
                          >
                            <option value="mondial-relay" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>Mondial Relay</option>
                            <option value="vinted-go" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>Vinted GO</option>
                            <option value="relais-colis" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>Relais Colis</option>
                            <option value="pickup" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>Pickup</option>
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
                            onClick={(e) => e.stopPropagation()}
                            className={`text-sm bg-transparent border rounded px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors duration-300 ${
                              darkMode 
                                ? 'border-gray-600 text-gray-300' 
                                : 'border-gray-200 text-gray-600'
                            }`}
                            style={{
                              color: darkMode ? '#d1d5db' : '#4b5563'
                            }}
                          >
                            <option value="hyper-u-locker" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>🏪 Hyper U - Locker</option>
                            <option value="hyper-u-accueil" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>🏪 Hyper U - Accueil</option>
                            <option value="intermarche-locker" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>🛒 Intermarché - Locker</option>
                            <option value="intermarche-accueil" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>🛒 Intermarché - Accueil</option>
                            <option value="rond-point-noyal" style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>📍 Rond point Noyal - Locker</option>
                            {parcel.location.startsWith('custom:') && (
                              <option value={parcel.location} style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', color: darkMode ? '#e5e7eb' : '#1f2937' }}>
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
