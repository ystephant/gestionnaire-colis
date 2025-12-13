import { useState, useEffect } from 'react';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('checking');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [oneSignalReady, setOneSignalReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('username');
      setUsername(user || '');

      // Vérifier immédiatement la permission du navigateur
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }

      // Attendre que OneSignal soit prêt
      const checkOneSignal = setInterval(() => {
        if (window.OneSignal) {
          clearInterval(checkOneSignal);
          setOneSignalReady(true);
          checkSubscription();
        }
      }, 300);

      // Nettoyer après 10 secondes
      setTimeout(() => clearInterval(checkOneSignal), 10000);

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
      
      if (isPushEnabled) {
        setPermission('granted');
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
        
        // Attendre un peu que OneSignal s'enregistre
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
              location: 'test'
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
  if (permission === 'checking' || !oneSignalReady) {
    return null;
  }

  // Si déjà abonné, ne rien afficher (ou un petit badge discret)
  if (isSubscribed) {
    return null; // Masquer complètement le composant
    
    // OU afficher un petit badge discret (décommentez si vous voulez) :
    /*
    return (
      <div style={{
        padding: '10px 15px',
        backgroundColor: '#d4edda',
        color: '#155724',
        borderRadius: '8px',
        marginBottom: '15px',
        textAlign: 'center',
        fontSize: '14px',
        border: '1px solid #c3e6cb'
      }}>
        ✅ Notifications activées
      </div>
    );
    */
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
