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
  const isCleaningUp = useRef(false);
  const channelRef = useRef(null);

  // Wake Lock - Empêche la mise en veille
  const enableWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        console.log('✅ Wake Lock activé');
        
        lock.addEventListener('release', () => {
          console.log('⚠️ Wake Lock libéré');
          setWakeLock(null);
        });
        
        return lock;
      } else {
        console.log('⚠️ Wake Lock non supporté');
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
      enableWakeLock();
      if (isOnline) { 
        setupRealtimeSubscription();
      }
      loadOfflineQueue();
    }
  }, [isLoggedIn, isOnline, username]);

  // CONFIGURATION ONESIGNAL - VERSION CORRIGÉE
  useEffect(() => {
    if (isLoggedIn && username) {
      console.log('👤 Utilisateur connecté:', username);
      console.log('🔔 Configuration OneSignal pour multi-appareils...');
      
      const setupOneSignalUser = async (retryCount = 0) => {
        const maxRetries = 3;
        
        if (typeof window === 'undefined' || !window.OneSignal) {
          if (retryCount < maxRetries) {
            console.log(`⏳ OneSignal pas encore chargé, retry ${retryCount + 1}/${maxRetries}...`);
            setTimeout(() => setupOneSignalUser(retryCount + 1), 1000);
          } else {
            console.error('❌ OneSignal non disponible après plusieurs tentatives');
          }
          return;
        }
        
        try {
          console.log('🔍 Vérification de l\'état d\'initialisation...');
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!window.OneSignal.User || !window.OneSignal.User.PushSubscription) {
            throw new Error('OneSignal pas complètement initialisé');
          }
          
          console.log('✅ OneSignal prêt, démarrage du login...');
          console.log('🔐 Appel OneSignal.login() pour:', username);
          
          await window.OneSignal.login(username);
          console.log('✅ OneSignal.login() réussi !');
          console.log('📱 Cet appareil est maintenant lié au compte:', username);
          
          try {
            await window.OneSignal.User.addAlias('external_id', username);
            console.log('✅ Alias external_id ajouté');
          } catch (aliasError) {
            console.log('ℹ️ Alias déjà présent ou non nécessaire');
          }
          
          const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
          const subscriptionId = window.OneSignal.User.PushSubscription.id;
          
          console.log('📊 État des notifications:');
          console.log('  - Activées:', isPushEnabled ? '✅' : '⚠️ Non');
          console.log('  - Subscription ID:', subscriptionId ? subscriptionId.substring(0, 20) + '...' : 'N/A');
          
          if (isPushEnabled) {
            setOneSignalReady(true);
            console.log('✅ OneSignal prêt pour l\'envoi de notifications');
          } else {
            console.log('⚠️ Les notifications ne sont pas encore activées');
          }
          
          try {
            window.OneSignal.Notifications.addEventListener('click', (event) => {
              console.log('🔔 Notification cliquée:', event);
              loadParcels();
            });
            
            window.OneSignal.User.PushSubscription.addEventListener('change', (subscription) => {
              console.log('📱 Subscription changée:', subscription);
              if (subscription.current.optedIn) {
                setOneSignalReady(true);
              }
            });
          } catch (eventError) {
            console.warn('⚠️ Impossible d\'écouter les événements:', eventError.message);
          }
          
          console.log('');
          console.log('═══════════════════════════════════════════');
          console.log('✅ ONESIGNAL CONFIGURÉ AVEC SUCCÈS');
          console.log('═══════════════════════════════════════════');
          console.log('👤 Username:', username);
          console.log('📱 Notifications:', isPushEnabled ? 'Activées ✅' : 'Désactivées ⚠️');
          console.log('🆔 Subscription:', subscriptionId ? subscriptionId.substring(0, 20) + '...' : 'Non disponible');
          console.log('🌍 Multi-appareils: Tous les appareils recevront les notifications');
          
          if (!isPushEnabled) {
            console.log('');
            console.log('⚠️ IMPORTANT : Les notifications ne sont pas activées');
            console.log('💡 Pour activer : Cliquez sur le bouton de notification');
          }
          
          console.log('═══════════════════════════════════════════');
          console.log('');
          
        } catch (error) {
          console.error('❌ Erreur configuration OneSignal:', error.message);
          console.error('🔍 Détails:', error);
          
          if (error.message && error.message.includes('IndexedDB')) {
            console.error('🔴 ERREUR INDEXEDDB DÉTECTÉE');
            console.log('');
            console.log('💡 SOLUTIONS :');
            console.log('  1. Videz le cache (Ctrl+Shift+Delete)');
            console.log('  2. Désactivez les bloqueurs de pub');
            console.log('  3. Quittez le mode navigation privée');
            console.log('');
            return;
          }
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Nouvelle tentative dans 2s... (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => setupOneSignalUser(retryCount + 1), 2000);
          } else {
            console.error('❌ Impossible de configurer OneSignal après', maxRetries, 'tentatives');
          }
        }
      };
      
      setupOneSignalUser();
    }
  }, [isLoggedIn, username]);

  useEffect(() => { 
    return () => {
      isCleaningUp.current = true;
      
      if (channelRef.current) {
        console.log('🧹 Nettoyage du canal Realtime...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      disableWakeLock();
    }; 
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (isLoggedIn && username) {
        console.log('🔄 Page active, rechargement...');
        loadParcels();
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLoggedIn && username) {
        console.log('🔄 Page visible, rechargement...');
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

  const setupRealtimeSubscription = () => {
    if (channelRef.current) {
      isCleaningUp.current = true;
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isCleaningUp.current = false;
    }
    
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
          if (isCleaningUp.current) {
            console.log('🧹 Nettoyage en cours, skip reconnexion');
            return;
          }
          
          console.warn('⚠️ Canal fermé - reconnexion dans 3s...');
          setSyncStatus('⚠️ Reconnexion...');
          
          channelRef.current = null;
          
          setTimeout(() => {
            if (isLoggedIn && username && !isCleaningUp.current) {
              console.log('🔄 Reconnexion au canal Realtime...');
              setupRealtimeSubscription();
            }
          }, 3000);
        }
      });
    
    channelRef.current = channel;
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
              location: pickupLocation
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
    if (!confirm('Supprimer ce colis ?')) return;

    if (!isOnline) { 
      setParcels(prev => prev.filter(p => p.id !== id)); 
      addToOfflineQueue({ type: 'delete', id }); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setParcels(parcels.filter(p => p.id !== id));
    } catch (error) { 
      console.error('Erreur de suppression:', error); 
    }
  };

  const deleteAllCollected = async () => {
    if (!confirm('Supprimer tous les colis récupérés ?')) return;
    
    const collectedIds = parcels.filter(p => p.collected).map(p => p.id);
    
    if (!isOnline) { 
      setParcels(prev => prev.filter(p => !p.collected)); 
      collectedIds.forEach(id => addToOfflineQueue({ type: 'delete', id })); 
      return; 
    }

    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('user_id', username)
        .eq('collected', true);
      
      if (error) throw error;
      setParcels(parcels.filter(p => !p.collected));
    } catch (error) { 
      console.error('Erreur de suppression:', error); 
    }
  };

  const handleLogout = () => {
    if (confirm('Se déconnecter ?')) {
      localStorage.removeItem('username');
      localStorage.removeItem('password');
      router.push('/');
    }
  };

  const getLockerName = (type) => {
    const names = {
      'mondial-relay': 'Mondial Relay',
      'vinted-go': 'Vinted Go',
      'relais-colis': 'Relais Colis',
      'pickup': 'PickUp'
    };
    return names[type] || type;
  };

  const getPickupLocationName = (loc) => {
    const names = {
      'hyper-u-locker': '🏪 Hyper U - Locker',
      'hyper-u-accueil': '🏪 Hyper U - Accueil',
      'intermarche-locker': '🛒 Intermarché - Locker',
      'intermarche-accueil': '🛒 Intermarché - Accueil',
      'rond-point-noyal': '📍 Rond point Noyal - Locker'
    };
    if (loc && loc.startsWith('custom:')) {
      return `📍 ${loc.replace('custom:', '')}`;
    }
    return names[loc] || loc;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays}j`;
  };

  const getRemainingDays = (dateString) => {
    const addedDate = new Date(dateString);
    const expiryDate = new Date(addedDate);
    expiryDate.setDate(expiryDate.getDate() + 7);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getRemainingDaysText = (days) => {
    if (days < 0) return `Expiré depuis ${Math.abs(days)}j`;
    if (days === 0) return 'Expire aujourd\'hui';
    if (days === 1) return 'Expire demain';
    return `${days}j restants`;
  };

  const filteredParcels = parcels.filter(p => {
    if (p.collected) return false;
    if (filterLockerType !== 'all' && p.locker_type !== filterLockerType) return false;
    if (filterLocation !== 'all' && p.location !== filterLocation) return false;
    return true;
  });

  const collectedParcels = parcels.filter(p => p.collected);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      <NotificationPermission />
      
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-down">
          {toastMessage}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 pb-24">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src="/meeple_final.png" alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Gestion des Colis
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {username}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg transition ${
                  darkMode 
                    ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
              >
                Déconnexion
              </button>
            </div>
          </div>

          {syncStatus && (
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
              {syncStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Type de locker
              </label>
              <select
                value={lockerType}
                onChange={(e) => setLockerType(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="mondial-relay">Mondial Relay</option>
                <option value="vinted-go">Vinted Go</option>
                <option value="relais-colis">Relais Colis</option>
                <option value="pickup">PickUp</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Point de retrait
              </label>
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
                className={`w-full px-4 py-2 rounded-lg border transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="hyper-u-locker">🏪 Hyper U - Locker</option>
                <option value="hyper-u-accueil">🏪 Hyper U - Accueil</option>
                <option value="intermarche-locker">🛒 Intermarché - Locker</option>
                <option value="intermarche-accueil">🛒 Intermarché - Accueil</option>
                <option value="rond-point-noyal">📍 Rond point Noyal - Locker</option>
                <option value="custom">➕ Autre point de retrait...</option>
              </select>
            </div>
          </div>

          {showCustomLocationInput && (
            <div className="mb-4">
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Nom du point de retrait..."
                className={`w-full px-4 py-2 rounded-lg border transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={() => {
                  if (customLocation.trim()) {
                    setPickupLocation(`custom:${customLocation.trim()}`);
                    setShowCustomLocationInput(false);
                    setCustomLocation('');
                  }
                }}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
              >
                Valider
              </button>
            </div>
          )}

          <textarea
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Collez ou tapez les codes de colis (un ou plusieurs)"
            rows="4"
            className={`w-full px-4 py-3 rounded-lg border transition mb-4 ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />

          <button
            onClick={addParcels}
            disabled={!codeInput.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Ajouter
          </button>
        </div>

        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Filtres
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Type de locker
              </label>
              <select
                value={filterLockerType}
                onChange={(e) => setFilterLockerType(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">Tous</option>
                <option value="mondial-relay">Mondial Relay</option>
                <option value="vinted-go">Vinted Go</option>
                <option value="relais-colis">Relais Colis</option>
                <option value="pickup">PickUp</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Point de retrait
              </label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">Tous</option>
                <option value="hyper-u-locker">Hyper U - Locker</option>
                <option value="hyper-u-accueil">Hyper U - Accueil</option>
                <option value="intermarche-locker">Intermarché - Locker</option>
                <option value="intermarche-accueil">Intermarché - Accueil</option>
                <option value="rond-point-noyal">Rond point Noyal</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            En attente ({filteredParcels.length})
          </h2>

          {filteredParcels.length === 0 ? (
            <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Aucun colis en attente
            </p>
          ) : (
            <div className="space-y-3">
              {filteredParcels.map(parcel => {
                const remainingDays = getRemainingDays(parcel.date_added);
                const isUrgent = remainingDays <= 2;
                
                return (
                  <div
                    key={parcel.id}
                    className={`border-2 rounded-xl p-4 transition ${
                      isUrgent
                        ? 'border-red-500 bg-red-50 dark:bg-red-900 dark:bg-opacity-20'
                        : darkMode 
                          ? 'border-gray-700 hover:border-indigo-500' 
                          : 'border-gray-200 hover:border-indigo-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleCollected(parcel.id, parcel.collected)}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition ${
                          darkMode 
                            ? 'border-gray-600 hover:border-indigo-500' 
                            : 'border-gray-300 hover:border-indigo-500'
                        }`}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {getLockerName(parcel.locker_type)}
                          </span>
                        </div>
                        <div className={`text-2xl font-bold break-all mb-2 ${
                          darkMode ? 'text-gray-100' : 'text-gray-900'
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
