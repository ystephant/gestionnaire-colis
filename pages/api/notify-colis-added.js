export default async function handler(req, res) {
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
    const { userId, colisCodes, location } = req.body;

    // 🔍 DEBUG - Type de userId
    console.log('🔍 DEBUG userId:', {
      value: userId,
      type: typeof userId,
      isString: typeof userId === 'string',
      isNumber: typeof userId === 'number'
    });
    console.log('🔍 DEBUG colisCodes:', {
      value: colisCodes,
      type: typeof colisCodes,
      isArray: Array.isArray(colisCodes),
      length: colisCodes?.length
    });

    console.log('🔥 Requête ajout de colis reçue:', { userId, colisCodes, location });

    if (!userId || !Array.isArray(colisCodes) || colisCodes.length === 0) {
      console.error('❌ Données manquantes');
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { 
          userId: !!userId, 
          colisCodes: !!colisCodes,
          isArray: Array.isArray(colisCodes)
        }
      });
    }

    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!apiKey || !appId) {
      console.error('❌ Variables d\'environnement manquantes');
      return res.status(500).json({ 
        error: 'Server configuration error'
      });
    }

    console.log('✅ Variables OK');
    console.log('🔌 App ID:', appId.substring(0, 8) + '...');

    const locationNames = {
      'hyper-u-locker': 'Hyper U - Locker',
      'hyper-u-accueil': 'Hyper U - Accueil',
      'intermarche-locker': 'Intermarché - Locker',
      'intermarche-accueil': 'Intermarché - Accueil',
      'rond-point-noyal': 'Rond point Noyal - Locker'
    };

    const message = colisCodes.length > 1
      ? `📦 ${colisCodes.length} nouveaux colis ajoutés à ${locationNames[location] || location}`
      : `📦 Nouveau colis ${colisCodes[0]} ajouté à ${locationNames[location] || location}`;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'https://lepetitmeeple.vercel.app');

    console.log('📤 Envoi notification ajout...');

    // 🔍 FORCER userId en string comme collected
    const userIdString = String(userId);
    console.log('🔍 userId converti:', {
      original: userId,
      converted: userIdString,
      type: typeof userIdString
    });

    // ✅ Payload OneSignal - EXACTEMENT comme collected
    const payload = {
      app_id: appId,
      include_aliases: {
        external_id: [userIdString]  // 🔍 Utiliser la version string
      },
      target_channel: 'push',
      headings: { en: 'Nouveaux colis !' },
      contents: { en: message },
      data: {
        type: 'colis_added',
        userId: userIdString,
        codes: colisCodes,
        timestamp: Date.now(),
        url: `${siteUrl}/colis`
      },
      url: `${siteUrl}/colis`,
      web_url: `${siteUrl}/colis`,
      app_url: `${siteUrl}/colis`
    };

    console.log('📦 Payload complet:', JSON.stringify(payload, null, 2));
    console.log('🔍 external_id spécifiquement:', payload.include_aliases.external_id);

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
        console.error('🔍 Détails erreurs:', JSON.stringify(data.errors, null, 2));
      }
      
      // 🔍 Retourner TOUS les détails pour debug
      return res.status(response.status).json({ 
        error: 'Erreur OneSignal',
        status: response.status,
        details: data,
        payload: payload,
        debugInfo: {
          userId: userId,
          userIdType: typeof userId,
          userIdString: userIdString,
          external_id: payload.include_aliases.external_id
        }
      });
    }

    if (data.recipients === 0) {
      console.warn('⚠️ Aucun destinataire trouvé');
      return res.status(200).json({ 
        success: true,
        warning: 'No recipients found',
        data
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
    console.error('🔍 Stack:', error.stack);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
