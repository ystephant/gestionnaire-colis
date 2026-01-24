export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;

  try {
    // 1. Recherche du jeu
    const searchResponse = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`
    );
    const searchXml = await searchResponse.text();

    const gameIdMatch = searchXml.match(/id="(\d+)"/);
    if (!gameIdMatch) {
      return res.status(200).json({ images: [] });
    }

    const gameId = gameIdMatch[1];

    // 2. Récupération du détail AVEC RETRY
    let detailXml = null;

    for (let i = 0; i < 3; i++) {
      const detailResponse = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}`
      );

      if (detailResponse.status === 200) {
        detailXml = await detailResponse.text();
        break;
      }

      // ⏳ attendre avant retry
      await new Promise(r => setTimeout(r, 1500));
    }

    if (!detailXml) {
      return res.status(200).json({ images: [] });
    }

    const imageMatch = detailXml.match(/<image>([^<]+)<\/image>/);
    const thumbnailMatch = detailXml.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    const nameMatch = detailXml.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);

    const images = [];

    if (imageMatch?.[1]) {
      images.push({
        id: `bgg-${gameId}`,
        url: imageMatch[1],
        thumb: thumbnailMatch?.[1] || imageMatch[1],
        source: `BoardGameGeek${nameMatch?.[1] ? ` – ${nameMatch[1]}` : ''}`
      });
    }

    return res.status(200).json({ images });

  } catch (error) {
    console.error('Erreur BGG:', error);
    return res.status(200).json({ images: [] });
  }
}
