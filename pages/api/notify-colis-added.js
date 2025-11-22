// pages/api/notify-colis-added.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, colisCodes, location, lockerType } = req.body;

  if (!userId || !colisCodes || colisCodes.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Envoyer la notification à l'utilisateur
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
          en: `📦 ${colisCodes.length} nouveau${colisCodes.length > 1 ? 'x' : ''} colis !` 
        },
        contents: { 
          en: `${colisCodes.length} colis ajouté${colisCodes.length > 1 ? 's' : ''} - ${location}` 
        },
        data: {
          type: 'colis_added',
          colisCodes: colisCodes,
          location: location,
          lockerType: lockerType
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

    console.log('✅ Notification ajout envoyée:', result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erreur API:', error);
    res.status(500).json({ error: error.message });
  }
}
