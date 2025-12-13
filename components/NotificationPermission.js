import { useState, useEffect } from 'react';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('username');
      setUsername(user || '');

      if (window.OneSignal) {
        checkPermission();
      }
    }
  }, []);

  const checkPermission = async () => {
    if (!window.OneSignal) return;
    
    try {
      const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
      setIsSubscribed(isPushEnabled);
      setPermission(isPushEnabled ? 'granted' : 'default');
    } catch (error) {
      console.error('Erreur vérification permission:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if (!window.OneSignal) {
      alert('OneSignal n\'est pas encore chargé. Veuillez réessayer.');
      return;
    }

    try {
      console.log('🔔 Demande de permission...');
      
      // Demander la permission
      const permission = await window.OneSignal.Notifications.requestPermission();
      
      if (permission) {
        console.log('✅ Permission accordée');
        
        // S'assurer que l'utilisateur est bien enregistré
        if (username) {
          await window.OneSignal.login(username);
          console.log('✅ Utilisateur enregistré:', username);
        }
        
        setPermission('granted');
        setIsSubscribed(true);
        
        // Test : Envoyer une notification de bienvenue
        await fetch('/api/notify-colis-added', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: username,
            colisCodes: ['WELCOME'],
            location: 'Test',
          })
        });
      } else {
        console.log('❌ Permission refusée');
        setPermission('denied');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'activation:', error);
      alert('Erreur: ' + error.message);
    }
  };

  if (isSubscribed) {
    return (
      <div style={{
        padding: '15px',
        backgroundColor: '#d4edda',
        color: '#155724',
        borderRadius: '8px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        ✅ Notifications activées pour <strong>{username}</strong>
      </div>
    );
  }

  return (
    <div style={{
      padding: '15px',
      backgroundColor: '#fff3cd',
      color: '#856404',
      borderRadius: '8px',
      marginBottom: '20px',
      textAlign: 'center'
    }}>
      <p style={{ margin: '0 0 10px 0' }}>
        🔔 Activez les notifications pour être alerté de vos nouveaux colis
      </p>
      <button
        onClick={handleEnableNotifications}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Activer les notifications
      </button>
    </div>
  );
}
