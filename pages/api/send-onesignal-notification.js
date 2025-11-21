// pages/api/send-onesignal-notification.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userIds, title, message, data } = req.body;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
        include_external_user_ids: userIds,
        headings: { en: title },
        contents: { en: message },
        data: data,
        web_url: 'https://gestionnaire-colis.vercel.app/colis',
        chrome_web_icon: 'https://gestionnaire-colis.vercel.app/icons/icon-192.png',
        chrome_web_badge: 'https://gestionnaire-colis.vercel.app/icons/badge-icon.png'
      })
    });

    const result = await response.json();

    if (result.errors) {
      console.error('❌ Erreur OneSignal:', result.errors);
      return res.status(400).json({ error: result.errors });
    }

    console.log('✅ Notification envoyée:', result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Erreur API:', error);
    res.status(500).json({ error: error.message });
  }
}
