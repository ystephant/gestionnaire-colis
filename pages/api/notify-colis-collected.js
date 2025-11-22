// pages/api/notify-colis-collected.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, colisCode, collectedBy } = req.body;

  if (!userId || !colisCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        headings: { 
          en: '✅ Colis récupéré !' 
        },
        contents: { 
          en: `Le colis ${colisCode} a été récupéré${collectedBy ? ` par ${collectedBy}` : ''} 🎉` 
        },
        data: {
          type: 'colis_collected',
          colisCode: colisCode,
          collectedBy: collectedBy
        },
        web_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gestionnaire-colis.vercel.app'}/colis`,
        chrome_web_icon: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gestionnaire-colis.vercel.app'}/icons/package-icon.png`,
        chrome_web_badge: `${process.env.NEXT_PUBLIC_APP_URL || 'https://gestionnaire-colis.vercel.app'}/icons/badge-icon.png`
      })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('❌ Erreur OneSignal:', result.errors);
      return res.status(400).json({ error: result.errors });
    }

    console.log('✅ Notification récupération envoyée:', result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erreur API:', error);
    res.status(500).json({ error: error.message });
  }
}
