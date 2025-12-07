export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, colisCodes, location, lockerType } = req.body;

    // Vérifier que les données sont présentes
    if (!userId || !colisCodes || !colisCodes.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const locationNames = {
      'hyper-u-locker': 'Hyper U - Locker',
      'hyper-u-accueil': 'Hyper U - Accueil',
      'intermarche-locker': 'Intermarché - Locker',
      'intermarche-accueil': 'Intermarché - Accueil',
      'rond-point-noyal': 'Rond point Noyal - Locker'
    };

    const lockerNames = {
      'mondial-relay': 'Mondial Relay',
      'vinted-go': 'Vinted GO',
      'relais-colis': 'Relais Colis',
      'pickup': 'Pickup'
    };

    const message = colisCodes.length > 1
      ? `📦 ${colisCodes.length} nouveaux colis ajoutés à ${locationNames[location] || location}`
      : `📦 Nouveau colis ${colisCodes[0]} ajouté à ${locationNames[location] || location}`;

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
        headings: { en: 'Nouveaux colis !' },
        contents: { en: message },
        data: {
          type: 'colis_added',
          userId: userId,
          codes: colisCodes
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
