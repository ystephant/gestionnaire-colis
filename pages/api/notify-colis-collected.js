export default async function handler(req, res) {
  // ✅ CORS pour production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, colisCode } = req.body;

    console.log('📥 Requête récupération reçue:', { userId, colisCode });

    // ✅ Validation des données
    if (!userId || !colisCode) {
      console.error('❌ Données manquantes:', { userId: !!userId, colisCode: !!colisCode });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { userId: !!userId, colisCode: !!colisCode }
      });
    }

    // ✅ Vérification des variables d'environnement
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!apiKey) {
      console.error('❌ ONESIGNAL_REST_API_KEY manquante');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'ONESIGNAL_REST_API_KEY is not set'
      });
    }

    if (!appId) {
      console.error('❌ NEXT_PUBLIC_ONESIGNAL_APP_ID manquante');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'NEXT_PUBLIC_ONESIGNAL_APP_ID is not set'
      });
    }

    console.log('✅ Variables d\'environnement présentes');
    console.log('📌 App ID:', appId.substring(0, 8) + '...');

    const message = `✅ Le colis ${colisCode} a été récupéré !`;

    // ✅ Détecter l'URL du site automatiquement
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'https://lepetitmeeple.vercel.app');

    console.log('📤 Envoi notification récupération...');
    console.log('🔗 Deep link URL:', `${siteUrl}/colis`);
    console.log('👤 User ID (external_id):', userId);
    console.log('📦 Colis récupéré:', colisCode);

    // ✅ Payload OneSignal
    const payload = {
      app_id: appId,
      include_aliases: {
        external_id: [userId]
      },
      target_channel: 'push',
      headings: { en: 'Colis récupéré 🎉' },
      contents: { en: message },
      data: {
        type: 'colis_collected',
        userId: userId,
        code: colisCode,
        timestamp: Date.now(),
        url: `${siteUrl}/colis`
      },
      url: `${siteUrl}/colis`,
      web_url: `${siteUrl}/colis`,
      app_url: `${siteUrl}/colis`
    };

    console.log('📦 Payload OneSignal:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('📨 Réponse OneSignal (status ' + response.status + '):', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Erreur OneSignal:', data);
      
      if (data.errors) {
        console.error('🔍 Détails erreurs:', data.errors);
      }
      
      return res.status(response.status).json({ 
        error: 'Erreur OneSignal',
        status: response.status,
        details: data,
        payload: payload
      });
    }

    // ✅ Vérifier si des notifications ont été envoyées
    if (data.recipients === 0) {
      console.warn('⚠️ Aucun destinataire trouvé pour userId:', userId);
      console.warn('💡 Assurez-vous que l\'utilisateur a bien initialisé OneSignal avec setExternalUserId()');
      return res.status(200).json({ 
        success: true,
        warning: 'No recipients found',
        data,
        hint: 'Make sure the user has called OneSignal.login() with this userId'
      });
    }

    console.log('✅ Notification envoyée avec succès');
    console.log('📊 Recipients:', data.recipients);
    
    return res.status(200).json({ 
      success: true,
      recipients: data.recipients,
      data 
    });

  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    console.error('📍 Stack:', error.stack);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
