import { useState, useEffect } from 'react';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('checking');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [oneSignalReady, setOneSignalReady] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

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
          return;
        }
      }

      // Attendre que OneSignal soit prêt
      let attempts = 0;
      const maxAttempts = 30;
      
      const checkOneSignal = setInterval(async () => {
        attempts++;
        
        if (window.OneSignal && typeof window.OneSignal.Notifications !== 'undefined') {
          clearInterval(checkOneSignal);
          setOneSignalReady(true);
          
          setTimeout(async () => {
            await checkSubscription();
            setHasChecked(true);
          }, 1000);
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkOneSignal);
          setHasChecked(true);
        }
      }, 300);

      return () => clearInterval(checkOneSignal);
    }
  }, []);

  const checkSubscription = async () => {
    if (!window.OneSignal) return;
    
    try {
      const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
      const subId = window.OneSignal.User.PushSubscription.id;
      
      setIsSubscribed(isPushEnabled);
      
      if (isPushEnabled && subId) {
        setPermission('granted');
        localStorage.setItem(`onesignal_registered_${username}`, 'true');
      }
    } catch (error) {
      console.error('Erreur vérification:', error);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    setDebugInfo('🔔 Initialisation...');

    try {
      // ÉTAPE 1 : Demander la permission native d'abord
      if (!('Notification' in window)) {
        throw new Error('Les notifications ne sont pas supportées sur cet appareil');
      }

      setDebugInfo('📝 Demande de permission...');
      
      // Demander la permission avec l'API native du navigateur
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setPermission('denied');
        setDebugInfo('❌ Permission refusée');
        setLoading(false);
        return;
      }

      setDebugInfo('✅ Permission accordée !');
      setPermission('granted');

      // ÉTAPE 2 : Attendre que OneSignal soit vraiment prêt
      if (!window.OneSignal) {
        setDebugInfo('⏳ Chargement OneSignal...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!window.OneSignal) {
        throw new Error('OneSignal n\'est pas chargé');
      }

      // ÉTAPE 3 : Enregistrer l'utilisateur dans OneSignal
      setDebugInfo('📝 Enregistrement utilisateur...');
      
      try {
        await window.OneSignal.login(username);
        console.log('✅ Utilisateur enregistré:', username);
      } catch (error) {
        console.warn('⚠️ Erreur login OneSignal:', error);
        // Continuer même si le login échoue
      }

      // Marquer comme enregistré
      localStorage.setItem(`onesignal_registered_${username}`, 'true');
      
      // ÉTAPE 4 : Attendre la synchronisation
      setDebugInfo('⏳ Synchronisation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ÉTAPE 5 : Vérifier la souscription
      await checkSubscription();
      
      // ÉTAPE 6 : Notification de test (optionnel)
      setDebugInfo('✅ Notifications activées !');
      
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

      // Forcer le rechargement de l'état
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

  // Pendant la vérification, afficher un message de chargement
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
          Pour les réactiver :
        </p>
        <ol style={{ 
          margin: '10px 0 0 0', 
          padding: '0 0 0 20px',
          fontSize: '12px',
          textAlign: 'left'
        }}>
          <li>Allez dans les paramètres de votre navigateur</li>
          <li>Cherchez "Notifications" ou "Autorisations"</li>
          <li>Autorisez les notifications pour ce site</li>
          <li>Rafraîchissez la page</li>
        </ol>
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
      
      {/* DEBUG INFO pendant le chargement */}
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
      
      {!loading && (
        <p style={{ 
          margin: '10px 0 0 0', 
          fontSize: '11px', 
          opacity: 0.7 
        }}>
          Vous pourrez accepter ou refuser dans la popup
        </p>
      )}
    </div>
  );
}
