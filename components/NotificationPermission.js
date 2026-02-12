import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('checking');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('username');
      setUsername(user || '');

      // Vérifier si déjà enregistré
      const alreadyRegistered = localStorage.getItem(`onesignal_registered_${user}`);
      
      // Vérifier la permission du navigateur
      if ('Notification' in window) {
        const browserPermission = Notification.permission;
        setPermission(browserPermission);
        
        if (browserPermission === 'granted' && alreadyRegistered === 'true') {
          setIsSubscribed(true);
          setHasChecked(true);
          return;
        }
      }

      setHasChecked(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    setDebugInfo('🔔 Initialisation...');

    try {
      // Vérifier le support
      if (!('Notification' in window)) {
        throw new Error('Les notifications ne sont pas supportées sur cet appareil');
      }

      setDebugInfo('🔐 Demande de permission...');
      
      // Demander la permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setPermission('denied');
        setDebugInfo('❌ Permission refusée');
        setLoading(false);
        return;
      }

      setDebugInfo('✅ Permission accordée !');
      setPermission('granted');

      // Initialiser OneSignal via le package NPM
      setDebugInfo('🔧 Configuration OneSignal...');
      
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });

        // Enregistrer l'utilisateur
        await OneSignal.login(username);
        console.log('✅ Utilisateur enregistré:', username);
        
        localStorage.setItem(`onesignal_registered_${username}`, 'true');
      } catch (error) {
        console.warn('⚠️ Erreur OneSignal:', error);
      }

      setDebugInfo('✅ Notifications activées !');
      
      // Notification de test
      try {
        await fetch('/api/notify-colis-added', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: username,
            colisCodes: ['BIENVENUE'],
            location: 'test',
            lockerType: 'mondial-relay'
          })
        });
        console.log('✅ Notification de test envoyée');
      } catch (error) {
        console.warn('⚠️ Erreur notification test:', error);
      }

      setTimeout(() => {
        setIsSubscribed(true);
        setLoading(false);
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur:', error);
      setDebugInfo(`❌ Erreur: ${error.message}`);
      alert(`Erreur: ${error.message}\n\nEssayez de :\n1. Rafraîchir la page\n2. Vérifier vos paramètres de notifications`);
      setLoading(false);
    }
  };

  // Pendant la vérification
  if (!hasChecked || permission === 'checking') {
    return (
      <div style={{
        padding: '15px',
        backgroundColor: '#f0f0f0',
        color: '#666',
        borderRadius: '12px',
        marginBottom: '20px',
        textAlign: 'center',
        fontSize: '13px'
      }}>
        ⏳ Vérification des notifications...
      </div>
    );
  }

  // Si déjà abonné
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
          Pour les réactiver, allez dans les paramètres de votre navigateur
        </p>
      </div>
    );
  }

  // Bouton pour activer
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
      
      {loading && debugInfo && (
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '13px',
          fontWeight: 'bold'
        }}>
          {debugInfo}
        </div>
      )}
      
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
          opacity: loading ? 0.7 : 1,
          width: '100%'
        }}
      >
        {loading ? `⏳ ${debugInfo || 'Activation...'}` : '🔔 Activer maintenant'}
      </button>
    </div>
  );
}
