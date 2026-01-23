export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;
  
  if (!gameName) {
    return res.status(400).json({ error: 'Game name required' });
  }

  try {
    const images = [];

    // 1. Recherche sur BoardGameGeek
    try {
      const bggSearchResponse = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`
      );
      const bggSearchText = await bggSearchResponse.text();
      
      // Parser XML simple
      const idMatch = bggSearchText.match(/id="(\d+)"/);
      
      if (idMatch) {
        const gameId = idMatch[1];
        const bggDetailResponse = await fetch(
          `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}`
        );
        const bggDetailText = await bggDetailResponse.text();
        
        // Extraire l'image
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

    // 2. Si Serpapi configuré (optionnel, 100 recherches/mois gratuit)
    if (process.env.SERPAPI_KEY) {
      try {
        const serpApiResponse = await fetch(
          `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(gameName + ' board game box')}&num=4&api_key=${process.env.SERPAPI_KEY}`
        );
        const serpData = await serpApiResponse.json();
        
        if (serpData.images_results) {
          serpData.images_results.forEach((img, idx) => {
            images.push({
              id: `serp-${idx}`,
              url: img.original,
              thumb: img.thumbnail,
              source: 'Google Images'
            });
          });
        }
      } catch (serpError) {
        console.log('Serpapi search failed:', serpError);
      }
    }

    // 3. Fallback : Unsplash (si configuré)
    if (images.length < 3 && process.env.UNSPLASH_ACCESS_KEY) {
      try {
        const unsplashResponse = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(gameName + ' board game')}&per_page=3&client_id=${process.env.UNSPLASH_ACCESS_KEY}`
        );
        const unsplashData = await unsplashResponse.json();
        
        if (unsplashData.results) {
          unsplashData.results.forEach((img) => {
            images.push({
              id: `unsplash-${img.id}`,
              url: img.urls.regular,
              thumb: img.urls.small,
              source: 'Unsplash'
            });
          });
        }
      } catch (unsplashError) {
        console.log('Unsplash search failed:', unsplashError);
      }
    }

    // Si aucune image trouvée, retourner des placeholders
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

    res.status(200).json({ images: images.slice(0, 5) }); // Max 5 images
  } catch (error) {
    console.error('Error searching images:', error);
    res.status(500).json({ error: 'Failed to search images' });
  }
}
