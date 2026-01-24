export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameName } = req.body;

  if (!gameName) {
    console.log('❌ BGG: Pas de nom de jeu fourni');
    return res.status(400).json({ error: 'Game name required' });
  }

  console.log('🎲 BGG: Recherche pour:', gameName);

  try {
    // 1. Recherche du jeu
    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameName)}&type=boardgame`;
    console.log('📡 BGG: URL de recherche:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LudothequeApp/1.0; +https://yoursite.com)',
        'Accept': 'application/xml',
      }
    });

    if (!searchResponse.ok) {
      console.log('❌ BGG: Erreur recherche, status:', searchResponse.status);
      return res.status(200).json({ images: [] });
    }

    const searchXml = await searchResponse.text();
    console.log('📄 BGG: XML reçu:', searchXml.substring(0, 500));

    // Vérifier si le XML contient une erreur
    if (searchXml.includes('<error>') || searchXml.includes('Rate limit')) {
      console.log('❌ BGG: Rate limit ou erreur détectée');
      return res.status(200).json({ images: [] });
    }

    // Extraire l'ID du premier résultat
    const gameIdMatch = searchXml.match(/<item[^>]*id="(\d+)"/);
    if (!gameIdMatch) {
      console.log('❌ BGG: Aucun jeu trouvé dans la recherche');
      return res.status(200).json({ images: [] });
    }

    const gameId = gameIdMatch[1];
    console.log('✅ BGG: Game ID trouvé:', gameId);

    // 2. Attendre 2 secondes (recommandé par BGG)
    await new Promise(r => setTimeout(r, 2000));

    // 3. Récupération des détails avec retry amélioré
    let detailXml = null;
    const detailUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&type=boardgame`;

    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`🔄 BGG: Tentative ${attempt}/5 pour récupérer les détails`);
      
      const detailResponse = await fetch(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LudothequeApp/1.0; +https://yoursite.com)',
          'Accept': 'application/xml',
        }
      });

      console.log(`📊 BGG: Status détails:`, detailResponse.status);

      if (detailResponse.status === 200) {
        detailXml = await detailResponse.text();
        
        // Vérifier que le XML n'est pas vide ou invalide
        if (detailXml && detailXml.includes('<item')) {
          console.log('📄 BGG: XML détails reçu:', detailXml.substring(0, 500));
          break;
        } else {
          console.log('⚠️ BGG: XML vide ou invalide, nouvelle tentative...');
          detailXml = null;
        }
      }

      if (detailResponse.status === 202) {
        console.log('⏳ BGG: 202 reçu (requête en cours de traitement), attente 3s...');
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      if (detailResponse.status === 429 || detailResponse.status === 503) {
        console.log('⏳ BGG: Rate limit (429/503), attente 5s...');
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      console.log('❌ BGG: Erreur détails, status:', detailResponse.status);
      
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    if (!detailXml) {
      console.log('❌ BGG: Impossible de récupérer les détails après 5 tentatives');
      return res.status(200).json({ images: [] });
    }

    // Extraction des données
    const imageMatch = detailXml.match(/<image>([^<]+)<\/image>/);
    const thumbnailMatch = detailXml.match(/<thumbnail>([^<]+)<\/thumbnail>/);
    const nameMatch = detailXml.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);

    console.log('🖼️ BGG: Image trouvée:', imageMatch?.[1] || 'aucune');
    console.log('🖼️ BGG: Thumbnail trouvée:', thumbnailMatch?.[1] || 'aucune');
    console.log('📝 BGG: Nom trouvé:', nameMatch?.[1] || 'aucun');

    const images = [];

    if (imageMatch?.[1]) {
      const imageUrl = imageMatch[1].startsWith('//') ? `https:${imageMatch[1]}` : imageMatch[1];
      const thumbUrl = thumbnailMatch?.[1]?.startsWith('//') ? `https:${thumbnailMatch[1]}` : (thumbnailMatch?.[1] || imageUrl);

      images.push({
        id: `bgg-${gameId}`,
        url: imageUrl,
        thumb: thumbUrl,
        source: `BoardGameGeek${nameMatch?.[1] ? ` — ${nameMatch[1]}` : ''}`
      });

      console.log('✅ BGG: Image ajoutée:', imageUrl);
    } else {
      console.log('❌ BGG: Aucune image trouvée dans le XML');
    }

    console.log('📦 BGG: Retour de', images.length, 'image(s)');
    return res.status(200).json({ images });

  } catch (error) {
    console.error('❌ BGG: Erreur exception:', error);
    return res.status(200).json({ images: [] });
  }
}
