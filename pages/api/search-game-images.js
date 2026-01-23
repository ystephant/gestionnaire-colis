export default async function handler(req, res) {
  // Headers CORS pour Vercel
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

    // 1. Recherche BoardGameGeek avec timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5 secondes
      
      const bggSearchResponse = await fetch(
        `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`,
        { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }
      );
      
      clearTimeout(timeoutId);
      
      if (bggSearchResponse.ok) {
        const bggSearchText = await bggSearchResponse.text();
        const idMatch = bggSearchText.match(/id="(\d+)"/);
        
        if (idMatch) {
          const gameId = idMatch[1];
          
          const timeoutId2 = setTimeout(() => controller.abort(), 5000);
          const bggDetailResponse = await fetch(
            `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}`,
            { 
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            }
          );
          clearTimeout(timeoutId2);
          
          if (bggDetailResponse.ok) {
            const bggDetailText = await bggDetailResponse.text();
            const imageMatch = bggDetailText.match(/<image>([^<]+)<\/image>/);
            const thumbnailMatch = bggDetailText.match(/<thumbnail>([^<]+)<\/thumbnail>/);
            
            if (imageMatch) {
              images.push({
                id: `bgg-${gameId}`,
                url: imageMatch[1],
                thumb: thumbnailMatch ? thumbnailMatch[1] : imageMatch[1],
                source: 'BoardGameGeek'
              });
            }
          }
        }
      }
    } catch (bggError) {
      console.log('BGG search timeout or failed:', bggError.message);
    }

    // 2. Fallback: Placeholders colorés avec placehold.co
    if (images.length === 0) {
      const colors = ['4F46E5', '7C3AED', 'EC4899', 'F59E0B', '10B981', '3B82F6'];
      const shortName = gameName.length > 20 ? gameName.substring(0, 17) + '...' : gameName;
      
      for (let i = 0; i < 3; i++) {
        const bgColor = colors[i % colors.length];
        const textColor = 'FFFFFF';
        
        images.push({
          id: `placeholder-${i}`,
          url: `https://placehold.co/600x600/${bgColor}/${textColor}/png?text=${encodeURIComponent(shortName)}&font=roboto`,
          thumb: `https://placehold.co/300x300/${bgColor}/${textColor}/png?text=${encodeURIComponent(shortName)}&font=roboto`,
          source: 'Placeholder'
        });
      }
    }

    console.log(`✅ Images trouvées pour "${gameName}":`, images.length);
    return res.status(200).json({ images: images.slice(0, 6) });
    
  } catch (error) {
    console.error('❌ Error searching images:', error);
    
    // En cas d'erreur totale, renvoyer quand même un placeholder
    const fallbackImages = [{
      id: 'fallback-1',
      url: `https://placehold.co/600x600/6366F1/FFFFFF/png?text=${encodeURIComponent(gameName)}&font=roboto`,
      thumb: `https://placehold.co/300x300/6366F1/FFFFFF/png?text=${encodeURIComponent(gameName)}&font=roboto`,
      source: 'Placeholder'
    }];
    
    return res.status(200).json({ images: fallbackImages });
  }
}
