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

    // ✅ Créer un ID unique pour cette notification
    const notificationId = `colis-added-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        headings: { en: 'Nouveaux colis !' },
        contents: { en: message },
        data: {
          type: 'colis_added',
          userId: userId,
          codes: colisCodes,
          notificationId: notificationId // ID unique
        },
        url: 'https://gestionnaire-colis.vercel.app/colis',
        // ✅ Paramètres Android
        android_channel_id: 'colis-notifications',
        android_group: 'colis', // Grouper les notifications
        android_group_message: {
          en: '$[notif_count] nouveaux colis'
        },
        // ✅ Paramètres iOS
        ios_category: 'colis',
        ios_badge_type: 'Increase',
        ios_badge_count: 1,
        // ✅ Pas de collapse_id pour éviter l'écrasement
        // collapse_id est absent pour que chaque notification soit indépendante
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
