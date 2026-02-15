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

    console.log('🔥 Requête ajout reçue:', { userId, colisCodes, location });

    if (!userId || !Array.isArray(colisCodes) || colisCodes.length === 0) {
      console.error('❌ Données manquantes');
      return res.status(400).json({ 
        error: 'Missing required fields'
      });
    }

    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!apiKey || !appId) {
      console.error('❌ Variables manquantes');
      return res.status(500).json({ 
        error: 'Server configuration error'
      });
    }

    console.log('✅ Variables OK');

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

    console.log('📤 Envoi notification...');

    // ✅ PAYLOAD SANS le champ "url"
    const payload = {
      app_id: appId,
      include_aliases: {
        external_id: [userId]
      },
      target_channel: 'push',
      headings: { en: 'Nouveaux colis !' },
      contents: { en: message },
      data: {
        type: 'colis_added',
        userId: userId,
        codes: colisCodes,
        timestamp: Date.now()
      },
      web_url: `${siteUrl}/colis`,
      app_url: `${siteUrl}/colis`
      // ❌ PAS de champ "url" ici !
    };

    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('📨 Réponse (status ' + response.status + '):', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Erreur:', data);
      if (data.errors) {
        console.error('🔍 Erreurs:', JSON.stringify(data.errors, null, 2));
      }
      return res.status(response.status).json({ 
        error: 'Erreur OneSignal',
        status: response.status,
        details: data
      });
    }

    if (data.recipients === 0) {
      console.warn('⚠️ Aucun destinataire');
      return res.status(200).json({ 
        success: true,
        warning: 'No recipients',
        data
      });
    }

    console.log('✅ Envoyé! Recipients:', data.recipients);
    
    return res.status(200).json({ 
      success: true,
      recipients: data.recipients,
      data 
    });

  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    return res.status(500).json({ 
      error: error.message
    });
  }
}
