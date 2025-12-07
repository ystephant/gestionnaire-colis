export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, colisCode } = req.body;

    if (!userId || !colisCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const message = `✅ Le colis ${colisCode} a été récupéré !`;

    // Envoyer la notification via OneSignal REST API
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
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
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur OneSignal:', data);
      return res.status(500).json({ error: 'Erreur OneSignal', details: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 3️⃣ Ajoutez les variables d'environnement sur Vercel

Sur votre dashboard Vercel, ajoutez ces variables :
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=24c0cb48-bcea-4953-934c-8d41632f3f16
ONESIGNAL_REST_API_KEY=votre-rest-api-key
