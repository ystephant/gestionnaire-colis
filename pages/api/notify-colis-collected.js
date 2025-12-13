export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, colisCode } = req.body;

    console.log('📥 Requête récupération:', { userId, colisCode });

    if (!userId || !colisCode) {
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

    const message = `✅ Le colis ${colisCode} a été récupéré !`;

    console.log('📤 Envoi notification récupération...');

    const payload = {
      app_id: appId,
      filters: [
        { field: 'tag', key: 'user_id', relation: '=', value: userId }
      ],
      headings: { en: 'Colis récupéré 🎉' },
      contents: { en: message },
      data: {
        type: 'colis_collected',
        userId: userId,
        code: colisCode
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
