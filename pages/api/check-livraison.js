// pages/api/check-livraison.js
// Extrait les données directement depuis le bloc __NEXT_DATA__ de LeBonCoin
// (LeBonCoin est une app Next.js SSG : toutes les données de la page sont
//  injectées en JSON dans ce bloc, pas besoin de scraper le HTML rendu)
// Cache 2h : la promo ne change pas toutes les heures

// Parse "06/03/2026 (14h00)" ou "06/03/2026 (08h59)" → Date
function parseLbcDate(str) {
  if (!str) return null;
  // Format : DD/MM/YYYY (HHhMM)
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*\((\d{1,2})h(\d{2})\)/);
  if (match) {
    const [, dd, mm, yyyy, hh, min] = match;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min, 0);
  }
  // Fallback : DD/MM/YYYY sans heure
  const fallback = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (fallback) {
    const [, dd, mm, yyyy] = fallback;
    return new Date(+yyyy, +mm - 1, +dd, 23, 59, 59);
  }
  return null;
}

// Extrait startDate et endDate depuis le texte de contenu de l'article
// ex: "Offre valable du 06/03/2026 (14h00) au 09/03/2026 (08h59) uniquement..."
function parseDateRange(content) {
  if (!content) return { startDate: null, endDate: null, displayText: null };

  // Cherche "du XX/XX/XXXX (HHhMM) au XX/XX/XXXX (HHhMM)"
  const range = content.match(
    /du\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))\s+au\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))/i
  );
  if (range) {
    return {
      startDate: parseLbcDate(range[1]),
      endDate: parseLbcDate(range[2]),
      displayText: `Du ${range[1].trim()} au ${range[2].trim()}`,
    };
  }

  // Fallback : "jusqu'au XX/XX/XXXX (HHhMM)"
  const until = content.match(/jusqu['']au\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))/i);
  if (until) {
    return {
      startDate: null,
      endDate: parseLbcDate(until[1]),
      displayText: `Jusqu'au ${until[1].trim()}`,
    };
  }

  return { startDate: null, endDate: null, displayText: null };
}

export default async function handler(req, res) {
  // Cache 2h côté CDN/Vercel
  res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=300');

  try {
    const response = await fetch('https://www.leboncoin.fr/service/bons-plans', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(200).json({ active: false, reason: `HTTP ${response.status}` });
    }

    const html = await response.text();

    // Extraction du bloc __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      return res.status(200).json({ active: false, reason: 'no __NEXT_DATA__ found' });
    }

    const nextData = JSON.parse(match[1]);

    // Navigation dans la structure : pageProps.content.edito_contents[].articles[]
    const editoContents = nextData?.pageProps?.content?.edito_contents ?? [];
    const allArticles = editoContents.flatMap((block) => block.articles ?? []);

    // Cherche un article avec "livraison" et "0,99" dans le titre (insensible à la casse)
    const promoArticle = allArticles.find((article) => {
      const title = (article.title ?? '').toLowerCase();
      return title.includes('livraison') && (title.includes('0,99') || title.includes('0.99'));
    });

    if (!promoArticle || promoArticle.enabled === false) {
      return res.status(200).json({ active: false });
    }

    // Extraction des dates depuis le champ "content" de l'article
    const { startDate, endDate, displayText } = parseDateRange(promoArticle.content ?? '');

    // Si la date de fin est dépassée → inactif
    const now = new Date();
    if (endDate && now > endDate) {
      return res.status(200).json({ active: false, reason: 'expired' });
    }

    return res.status(200).json({
      active: true,
      title: promoArticle.title,                         // "Livraison à 0,99€"
      description: promoArticle.content,                 // texte complet de l'offre
      link: promoArticle.link_to,                        // lien vers la page de l'offre
      startDate: startDate ? startDate.toISOString() : null,
      endDate:   endDate   ? endDate.toISOString()   : null,
      displayText,                                        // "Du 06/03/2026 (14h00) au 09/03/2026 (08h59)"
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[check-livraison] Erreur:', error);
    return res.status(200).json({ active: false, reason: error.message });
  }
}
