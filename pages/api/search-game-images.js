export default async function handler(req, res) {
  // Ajouter les headers CORS pour Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;
  
  if (!gameName) {
    return res.status(400).json({ error: 'Game name required' });
  }

  try {
    const images = [];

    // 1. BoardGameGeek
    try {
      const bggSearchResponse = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`
      );
      const bggSearchText = await bggSearchResponse.text();
      const idMatch = bggSearchText.match(/id="(\d+)"/);
      
      if (idMatch) {
        const gameId = idMatch[1];
        const bggDetailResponse = await fetch(
          `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}`
        );
        const bggDetailText = await bggDetailResponse.text();
        const imageMatch = bggDetailText.match(/<image>([^<]+)<\/image>/);
        
        if (imageMatch) {
          images.push({
            id: `bgg-${gameId}`,
            url: imageMatch[1],
            thumb: imageMatch[1],
            source: 'BoardGameGeek'
          });
        }
      }
    } catch (bggError) {
      console.log('BGG search failed:', bggError);
    }

    // 2. Si aucune image, ajouter des placeholders
    if (images.length === 0) {
      for (let i = 1; i <= 3; i++) {
        images.push({
          id: `placeholder-${i}`,
          url: `https://via.placeholder.com/400x400/4F46E5/FFFFFF?text=${encodeURIComponent(gameName)}`,
          thumb: `https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=${encodeURIComponent(gameName)}`,
          source: 'Placeholder'
        });
      }
    }

    return res.status(200).json({ images: images.slice(0, 5) });
  } catch (error) {
    console.error('Error searching images:', error);
    return res.status(500).json({ error: 'Failed to search images' });
  }
}
