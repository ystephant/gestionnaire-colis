export default async function handler(req, res) {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  // Test 1: Afficher les infos (masquées)
  console.log('🔑 API Key présente:', !!apiKey);
  console.log('🔑 API Key preview:', apiKey?.substring(0, 5) + '***');
  console.log('🆔 App ID:', appId);

  // Test 2: Essayer avec Bearer
  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['test'],
        contents: { en: 'Test' }
      })
    });

    const data = await response.json();
    return res.status(200).json({
      method: 'Bearer',
      status: response.status,
      ok: response.ok,
      data
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}



ONESIGNAL_USER_AUTH_KEY=votre-user-auth-key
