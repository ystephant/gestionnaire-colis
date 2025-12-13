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

    const message = `✅ Le colis ${colisCode} a été récupéré !`;

    console.log('📤 Envoi notification récupération...');

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
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
          timestamp: Date.now() // ✅ Timestamp unique
        },
        url: 'https://gestionnaire-colis.vercel.app/colis'
      })
    });

    const data = await response.json();
    console.log('📨 Réponse OneSignal:', data);

    if (!response.ok) {
      console.error('❌ Erreur OneSignal:', data);
      return res.status(500).json({ error: 'Erreur OneSignal', details: data });
    }

    console.log('✅ Notification envoyée avec succès');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
