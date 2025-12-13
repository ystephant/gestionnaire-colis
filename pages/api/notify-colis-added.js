export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, colisCodes, location, lockerType } = req.body;

    console.log('📥 Requête reçue:', { userId, colisCodes, location, lockerType });

    if (!userId || !colisCodes || !Array.isArray(colisCodes) || colisCodes.length === 0) {
      console.error('❌ Données manquantes');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const apiKey = process.env.ONESIGNAL_REST_API_KEY;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!apiKey || !appId) {
      console.error('❌ Variables d\'environnement manquantes');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 🔍 LOGS DE DEBUG
    console.log('🔍 Debug Auth:');
    console.log('- API Key exists:', !!apiKey);
    console.log('- API Key length:', apiKey?.length);
    console.log('- API Key preview:', apiKey?.substring(0, 10) + '...');
    console.log('- App ID:', appId);

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

    console.log('📤 Envoi notification OneSignal...');

    const payload = {
      app_id: appId,
      filters: [
        { field: 'tag', key: 'user_id', relation: '=', value: userId }
      ],
      headings: { en: 'Nouveaux colis !' },
      contents: { en: message },
      data: {
        type: 'colis_added',
        userId: userId,
        codes: colisCodes
      },
      url: 'https://gestionnaire-colis.vercel.app/colis'
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

    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);

    const data = await response.json();
    console.log('📨 Réponse OneSignal:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Erreur OneSignal:', data);
      return res.status(500).json({ 
        error: 'Erreur OneSignal', 
        details: data,
        status: response.status 
      });
    }

    console.log('✅ Notification envoyée avec succès');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    return res.status(500).json({ 
      error: error.message, 
      stack: error.stack 
    });
  }
}
