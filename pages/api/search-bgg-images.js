export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;

  try {
    // 1. Rechercher le jeu sur BGG
    const searchResponse = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`
    );
    const searchXml = await searchResponse.text();

    // Parser le XML (simple parsing)
    const gameIdMatch = searchXml.match(/id="(\d+)"/);
    
    if (!gameIdMatch) {
      return res.status(200).json({ images: [] });
    }

    const gameId = gameIdMatch[1];

    // 2. Récupérer les détails du jeu
    const detailResponse = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}`
    );
    const detailXml = await detailResponse.text();

    // Extraire l'image et le thumbnail
    const imageMatch = detailXml.match(/<image>([^<]+)<\/image>/);
    const thumbnailMatch = detailXml.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    const nameMatch = detailXml.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);

    const images = [];

    if (imageMatch && imageMatch[1]) {
      images.push({
        id: `bgg-${gameId}`,
        url: imageMatch[1],
        thumb: thumbnailMatch?.[1] || imageMatch[1],
        source: `BoardGameGeek - ${nameMatch?.[1] || gameName}`
      });
    }

    return res.status(200).json({ images });

  } catch (error) {
    console.error('Erreur BGG:', error);
    return res.status(200).json({ images: [] });
  }
}
