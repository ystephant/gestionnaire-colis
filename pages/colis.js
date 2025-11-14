import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Logos des transporteurs
const LOCKER_LOGOS = {
  'mondial-relay': '/logos/mondial-relay.png',
  'vinted-go': '/logos/vinted-go.png',
  'relais-colis': '/logos/relais-colis.png',
  'pickup': '/logos/pickup.png'
};

export default function LockerParcelApp() {
  const router = useRouter();
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

  useEffect(() => {
    checkAuth();
    
    // Détecter connexion/déconnexion
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('🟢 En ligne');
      syncOfflineChanges();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('🔴 Hors ligne - Les modifications seront synchronisées');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);
    setSyncStatus(navigator.onLine ? '🟢 En ligne' : '🔴 Hors ligne');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadParcels();
      if (isOnline) {
        setupRealtimeSubscription();
        requestNotificationPermission();
      }
      trackCollectedToday();
      loadOfflineQueue();
    }
  }, [isLoggedIn, isOnline]);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (window.realtimeChannel) {
        supabase.removeChannel(window.realtimeChannel);
      }
    };
  }, []);

  // Notification à la fermeture
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (collectedToday > 0) {
        // Envoyer notification via Service Worker
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.active.postMessage({
              type: 'SHOW_NOTIFICATION',
              title: 'Colis récupérés aujourd\'hui',
              options: {
                body: `${collectedToday} colis récupéré${collectedToday > 1 ? 's' : ''} aujourd'hui 🎉`,
                icon: '/icons/package-icon.png',
                badge: '/icons/badge-icon.png',
                tag: 'daily-summary',
                requireInteraction: false,
                vibrate: [200, 100, 200]
              }
            });
          });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    // Aussi sur visibilitychange (quand on change d'onglet)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && collectedToday > 0) {
        handleBeforeUnload();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [collectedToday]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      setIsLoggedIn(true);
    } else {
      router.push('/');
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
      // Sauvegarder en local pour mode offline
      localStorage.setItem(`parcels_${username}`, JSON.stringify(data || []));
    } catch (error) {
      console.error('Erreur de chargement:', error);
      // Charger depuis le cache local si erreur
      const cached = localStorage.getItem(`parcels_${username}`);
      if (cached) {
        setParcels(JSON.parse(cached));
        setSyncStatus('🟡 Données en cache');
      }
    } finally {
      setLoading(false);
    }
  };

  // Synchronisation en temps réel
  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`parcels-${username}`)
      .on(
        'postgres_changes',
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
              const updated = [payload.new, ...prev];
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            setParcels(prev => {
              const updated = prev.map(p => p.id === payload.new.id ? payload.new : p);
              localStorage.setItem(`parcels_${username}`, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
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
        }
      });

    window.realtimeChannel = channel;
  };

  // Demander permission notifications
  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Notifications autorisées');
      }
    }
  };

  // Tracker colis récupérés aujourd'hui
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

  // Gestion mode offline
  const loadOfflineQueue = () => {
    const queue = localStorage.getItem(`offline_queue_${username}`);
    if (queue) {
      setOfflineQueue(JSON.parse(queue));
    }
  };

  const saveOfflineQueue = (queue) => {
    localStorage.setItem(`offline_queue_${username}`, JSON.stringify(queue));
  };

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
      // Mode offline : sauvegarder localement
      const tempParcels = newParcels.map(p => ({
        ...p,
        id: `temp_${Date.now()}_${Math.random()}`,
        date_added: new Date().toISOString()
      }));
      
      setParcels([...tempParcels, ...parcels]);
      tempParcels.forEach(p => {
        addToOfflineQueue({ type: 'add', data: p });
      });
      
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
      
      setParcels([...data, ...parcels]);
      setCodeInput('');
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      alert('Erreur lors de l\'ajout des colis');
    }
  };

  const toggleCollected = async (id, currentStatus) => {
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
      addToOfflineQueue({
        type: 'update',
        id,
        data: { collected: !currentStatus }
      });
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
      await loadParcels();
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
      // Rollback en cas d'erreur
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
    if (!isOnline) {
      setParcels(parcels.filter(p => p.id !== id));
      addToOfflineQueue({ type: 'delete', id });
      return;
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setParcels(parcels.filter(parcel => parcel.id !== id));
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const deleteAllCollected = async () => {
    if (!confirm('Supprimer tous les colis récupérés ?')) return;

    const collectedIds = collectedParcels.map(p => p.id);

    if (!isOnline) {
      setParcels(parcels.filter(p => !p.collected));
      collectedIds.forEach(id => {
        addToOfflineQueue({ type: 'delete', id });
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .in('id', collectedIds);

      if (error) throw error;

      setParcels(parcels.filter(parcel => !parcel.collected));
    } catch (error) {
      console.error('Erreur de suppression:', error);
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
    switch(location) {
      case 'hyper-u-locker': return '🏪 Hyper U - Locker';
      case 'hyper-u-accueil': return '🏪 Hyper U - Accueil';
      case 'intermarche-locker': return '🛒 Intermarché - Locker';
      case 'intermarche-accueil': return '🛒 Intermarché - Accueil';
      case 'rond-point-noyal': return '📍 Rond point Noyal - Locker';
      default: return location;
    }
  };

  const pendingParcels = parcels.filter(p => !p.collected);
  const collectedParcels = parcels.filter(p => p.collected);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-indigo-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Indicateur de statut de connexion */}
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

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-indigo-600 p-2 hover:bg-gray-100 rounded-lg transition"
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
                <h1 className="text-3xl font-bold text-gray-800">Mes Colis</h1>
                <p className="text-sm text-gray-500">Connecté: {username}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              Retour
            </button>
          </div>

          {/* Formulaire d'ajout */}
          <div className="space-y-3">
            {/* Type de transporteur */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Type de transporteur :</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="mondial-relay"
                    checked={lockerType === 'mondial-relay'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['mondial-relay']} alt="Mondial Relay" className="h-6 object-contain" />
                  <span className="text-sm font-medium">Mondial Relay</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="vinted-go"
                    checked={lockerType === 'vinted-go'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['vinted-go']} alt="Vinted GO" className="h-6 object-contain" />
                  <span className="text-sm font-medium">Vinted GO</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="relais-colis"
                    checked={lockerType === 'relais-colis'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['relais-colis']} alt="Relais Colis" className="h-6 object-contain" />
                  <span className="text-sm font-medium">Relais Colis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="pickup"
                    checked={lockerType === 'pickup'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['pickup']} alt="Pickup" className="h-6 object-contain" />
                  <span className="text-sm font-medium">Pickup</span>
                </label>
              </div>
              <p className="text-xs text-indigo-600 mt-2">{getCodeFormatHint()}</p>
            </div>

            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={`Collez vos codes ici\n${getCodeFormatHint()}`}
              rows="4"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg resize-none"
            />
            
            {/* Lieu de récupération */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Lieu de récupération du colis :</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pickupLocation"
                    value="hyper-u-locker"
                    checked={pickupLocation === 'hyper-u-locker'}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span>🏪 Hyper U - Locker</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pickupLocation"
                    value="hyper-u-accueil"
                    checked={pickupLocation === 'hyper-u-accueil'}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span>🏪 Hyper U - Accueil</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pickupLocation"
                    value="intermarche-locker"
                    checked={pickupLocation === 'intermarche-locker'}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span>🛒 Intermarché - Locker</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pickupLocation"
                    value="intermarche-accueil"
                    checked={pickupLocation === 'intermarche-accueil'}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span>🛒 Intermarché - Accueil</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pickupLocation"
                    value="rond-point-noyal"
                    checked={pickupLocation === 'rond-point-noyal'}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <span>📍 Rond point Noyal - Locker</span>
                </label>
              </div>
            </div>

            <button
              onClick={addParcels}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Ajouter les colis
            </button>
          </div>
        </div>

        {/* Colis en attente */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            À récupérer ({pendingParcels.length})
          </h2>
          
          {pendingParcels.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun colis en attente</p>
          ) : (
            <div className="space-y-3">
              {pendingParcels.map(parcel => {
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
                        ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollected(parcel.id, parcel.collected);
                        }}
                        className="mt-1 w-6 h-6 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:border-indigo-500 flex-shrink-0"
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
                            className="text-sm bg-transparent border-none focus:outline-none cursor-pointer font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="mondial-relay">Mondial Relay</option>
                            <option value="vinted-go">Vinted GO</option>
                            <option value="relais-colis">Relais Colis</option>
                            <option value="pickup">Pickup</option>
                          </select>
                        </div>
                        
                        <div className="text-2xl font-bold text-indigo-600 break-all mb-2">
                          {parcel.code}
                        </div>
                        
                        <div className="mb-2">
                          <select
                            value={parcel.location}
                            onChange={(e) => {
                              e.stopPropagation();
                              changePickupLocation(parcel.id, e.target.value);
                            }}
                            className="text-sm text-gray-600 bg-transparent border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="hyper-u-locker">🏪 Hyper U - Locker</option>
                            <option value="hyper-u-accueil">🏪 Hyper U - Accueil</option>
                            <option value="intermarche-locker">🛒 Intermarché - Locker</option>
                            <option value="intermarche-accueil">🛒 Intermarché - Accueil</option>
                            <option value="rond-point-noyal">📍 Rond point Noyal - Locker</option>
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {formatDate(parcel.date_added)}
                          </span>
                          <span className={`opacity-60 ${isUrgent ? 'font-bold text-red-600 opacity-100' : ''}`}>
                            {getRemainingDaysText(remainingDays)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteParcel(parcel.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
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
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Récupérés ({collectedParcels.length})
            </h2>
            
            <div className="space-y-3 mb-4">
              {collectedParcels.map(parcel => (
                <div
                  key={parcel.id}
                  className="border-2 border-green-200 bg-green-50 rounded-xl p-4 opacity-75"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCollected(parcel.id, parcel.collected)}
                      className="mt-1 w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                        <span className="text-sm text-gray-600 font-medium">{getLockerName(parcel.locker_type)}</span>
                      </div>
                      <div className="text-xl font-bold text-gray-600 line-through break-all mb-1">
                        {parcel.code}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getPickupLocationName(parcel.location)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => deleteParcel(parcel.id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
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
