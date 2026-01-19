export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  // Liste des modèles à essayer dans l'ordre
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-1.0-pro'
  ];

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Modèle fonctionnel: ${model}`);
        return res.status(200).json(data);
      }

      const errorData = await response.json();
      console.log(`❌ Modèle ${model} non disponible:`, errorData.error?.message);
      lastError = errorData;

    } catch (error) {
      console.log(`❌ Erreur avec modèle ${model}:`, error.message);
      lastError = { error: error.message };
    }
  }

  // Si aucun modèle ne fonctionne
  console.error('Aucun modèle Gemini disponible');
  return res.status(500).json({ 
    error: 'Aucun modèle Gemini disponible', 
    details: lastError 
  });
}
