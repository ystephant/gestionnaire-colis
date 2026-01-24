export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;

  if (!gameName) {
    return res.status(400).json({ error: 'Game name required' });
  }

  try {
    // 1. Recherche du jeu avec timeout
    const searchResponse = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame&exact=1`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!searchResponse.ok) {
      console.log('BGG search failed:', searchResponse.status);
      return res.status(200).json({ images: [] });
    }

    const searchXml = await searchResponse.text();
    console.log('BGG Search XML:', searchXml.substring(0, 500));

    // Extraire l'ID du jeu
    const gameIdMatch = searchXml.match(/<item[^>]*id="(\d+)"/);
    if (!gameIdMatch) {
      console.log('No game ID found in BGG response');
      return res.status(200).json({ images: [] });
    }

    const gameId = gameIdMatch[1];
    console.log('BGG Game ID found:', gameId);

    // 2. Attendre un peu (BGG demande un délai)
    await new Promise(r => setTimeout(r, 1000));

    // 3. Récupération des détails avec retry
    let detailXml = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`BGG detail attempt ${attempt + 1}/3 for game ID ${gameId}`);
        
        const detailResponse = await fetch(
          `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&type=boardgame`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (detailResponse.status === 200) {
          detailXml = await detailResponse.text();
          console.log('BGG Detail XML received:', detailXml.substring(0, 500));
          break;
        }

        if (detailResponse.status === 202) {
          console.log('BGG returned 202 (processing), waiting...');
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        console.log('BGG detail failed with status:', detailResponse.status);
      } catch (fetchError) {
        console.error(`BGG fetch attempt ${attempt + 1} failed:`, fetchError.message);
      }

      // Attendre avant le prochain essai
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (!detailXml) {
      console.log('No detail XML received after retries');
      return res.status(200).json({ images: [] });
    }

    // Extraction des données
    const imageMatch = detailXml.match(/<image>([^<]+)<\/image>/);
    const thumbnailMatch = detailXml.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    const nameMatch = detailXml.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);

    const images = [];

    if (imageMatch?.[1]) {
      // Utiliser l'image complète (meilleure qualité)
      const imageUrl = imageMatch[1].startsWith('//') ? `https:${imageMatch[1]}` : imageMatch[1];
      const thumbUrl = thumbnailMatch?.[1]?.startsWith('//') ? `https:${thumbnailMatch[1]}` : (thumbnailMatch?.[1] || imageUrl);

      images.push({
        id: `bgg-${gameId}`,
        url: imageUrl,
        thumb: thumbUrl,
        source: `BoardGameGeek${nameMatch?.[1] ? ` — ${nameMatch[1]}` : ''}`
      });

      console.log('BGG image found:', imageUrl);
    } else {
      console.log('No image found in BGG XML');
    }

    return res.status(200).json({ images });

  } catch (error) {
    console.error('BGG API Error:', error);
    return res.status(200).json({ images: [] });
  }
}
