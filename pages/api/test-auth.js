export default async function handler(req, res) {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  console.log('🔍 Tests d\'authentification OneSignal');
  console.log('API Key preview:', apiKey?.substring(0, 15) + '...');
  console.log('API Key length:', apiKey?.length);
  console.log('App ID:', appId);

  const testPayload = {
    app_id: appId,
    included_segments: ['Subscribed Users'],
    contents: { en: 'Test notification' },
    headings: { en: 'Test' }
  };

  const tests = [
    { name: 'Bearer', auth: `Bearer ${apiKey}` },
    { name: 'Basic', auth: `Basic ${apiKey}` },
    { name: 'Key', auth: `Key ${apiKey}` },
    { name: 'Just key', auth: apiKey },
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`\n🧪 Test ${test.name}...`);
      
      const response = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': test.auth
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json();
      
      results.push({
        method: test.name,
        status: response.status,
        ok: response.ok,
        response: data
      });

      console.log(`${test.name}: ${response.status} - ${response.ok ? '✅' : '❌'}`);
      console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
      results.push({
        method: test.name,
        error: error.message
      });
      console.error(`${test.name} error:`, error.message);
    }
  }

  return res.status(200).json({
    apiKeyInfo: {
      exists: !!apiKey,
      length: apiKey?.length,
      preview: apiKey?.substring(0, 15) + '...',
      startsWithOsV2App: apiKey?.startsWith('os_v2_app_')
    },
    appId,
    results
  });
}
