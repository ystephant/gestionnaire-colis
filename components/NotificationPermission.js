import { useState, useEffect } from 'react';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('checking');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('username');
      setUsername(user || '');

      // Vérifier si l'utilisateur a déjà été enregistré
      const alreadyRegistered = localStorage.getItem(`onesignal_registered_${user}`);
      
      // Vérifier immédiatement la permission du navigateur
      if ('Notification' in window) {
        const browserPermission = Notification.permission;
        setPermission(browserPermission);
        
        // Si déjà accordé ET déjà enregistré, on considère que c'est bon
        if (browserPermission === 'granted' && alreadyRegistered === 'true') {
          setIsSubscribed(true);
          setOneSignalReady(true);
          setHasChecked(true);
          return; // Ne pas redemander
        }
      }

      // Attendre que OneSignal soit VRAIMENT prêt
      let attempts = 0;
      const maxAttempts = 30; // 9 secondes max
      
      const checkOneSignal = setInterval(async () => {
        attempts++;
        
        if (window.OneSignal && typeof window.OneSignal.Notifications !== 'undefined') {
          clearInterval(checkOneSignal);
          setOneSignalReady(true);
          
          // Attendre un peu plus pour que OneSignal s'initialise complètement
          setTimeout(async () => {
            await checkSubscription();
            setHasChecked(true);
          }, 1000);
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkOneSignal);
          console.warn('⚠️ OneSignal n\'a pas pu être initialisé');
          setHasChecked(true);
        }
      }, 300);

      return () => clearInterval(checkOneSignal);
    }
  }, []);

  const checkSubscription = async () => {
    if (!window.OneSignal) return;
    
    try {
      // Vérifier si l'utilisateur est souscrit
      const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
      const subId = window.OneSignal.User.PushSubscription.id;
      
      console.log('📱 Push enabled:', isPushEnabled);
      console.log('📱 Subscription ID:', subId);
      
      setIsSubscribed(isPushEnabled);
      
      if (isPushEnabled && subId) {
        setPermission('granted');
        // Marquer comme enregistré
        localStorage.setItem(`onesignal_registered_${username}`, 'true');
      }
    } catch (error) {
      console.error('Erreur vérification:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if (!window.OneSignal) {
      alert('OneSignal n\'est pas encore chargé. Veuillez rafraîchir la page.');
      return;
    }

    setLoading(true);

    try {
      console.log('🔔 Demande de permission pour:', username);
      
      // Demander la permission
      const granted = await window.OneSignal.Notifications.requestPermission();
      
      if (granted) {
        console.log('✅ Permission accordée');
        
        // Enregistrer l'utilisateur
        await window.OneSignal.login(username);
        console.log('✅ Utilisateur enregistré:', username);
        
        // Marquer comme enregistré dans localStorage
        localStorage.setItem(`onesignal_registered_${username}`, 'true');
        
        // Attendre que OneSignal s'enregistre complètement
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Vérifier la souscription
        await checkSubscription();
        
        // Notification de test
        try {
          const response = await fetch('/api/notify-colis-added', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: username,
              colisCodes: ['BIENVENUE'],
              location: 'test',
              lockerType: 'mondial-relay'
            })
          });

          if (response.ok) {
            console.log('✅ Notification de bienvenue envoyée');
          }
        } catch (error) {
          console.warn('⚠️ Erreur notification test:', error);
        }
      } else {
        console.log('❌ Permission refusée');
        setPermission('denied');
      }
    } catch (error) {
      console.error('❌ Erreur activation:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Pendant la vérification, ne rien afficher
  if (!hasChecked || permission === 'checking' || !oneSignalReady) {
    return null;
  }

  // Si déjà abonné, ne rien afficher
  if (isSubscribed && permission === 'granted') {
    return null;
  }

  // Si permission refusée
  if (permission === 'denied') {
    return (
      <div style={{
        padding: '15px',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '12px',
        marginBottom: '20px',
        textAlign: 'center',
        border: '2px solid #f5c6cb'
      }}>
        <div style={{ fontSize: '20px', marginBottom: '5px' }}>🔕</div>
        <strong>Notifications bloquées</strong>
        <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
          Réactivez-les dans les paramètres de votre navigateur
        </p>
      </div>
    );
  }

  // Bouton pour activer (uniquement si pas encore activé)
  return (
    <div style={{
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      borderRadius: '12px',
      marginBottom: '20px',
      textAlign: 'center',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔔</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>
        Activez les notifications
      </h3>
      <p style={{ margin: '0 0 15px 0', fontSize: '14px', opacity: 0.9 }}>
        Recevez une alerte à chaque nouveau colis
      </p>
      <button
        onClick={handleEnableNotifications}
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: 'white',
          color: '#667eea',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.3s',
          opacity: loading ? 0.7 : 1
        }}
        onMouseOver={(e) => {
          if (!loading) e.target.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          if (!loading) e.target.style.transform = 'translateY(0)';
        }}
      >
        {loading ? '⏳ Activation...' : '🔔 Activer maintenant'}
      </button>
    </div>
  );
}
