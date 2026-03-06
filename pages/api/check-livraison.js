// pages/api/check-livraison.js
// Edge Function exécutée depuis Paris (cdg1) pour éviter le blocage des IPs US de Vercel
// LeBonCoin est une app Next.js SSG : les données sont dans le bloc __NEXT_DATA__

// Parse "06/03/2026 (14h00)" → Date
function parseLbcDate(str) {
  if (!str) return null;
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*\((\d{1,2})h(\d{2})\)/);
  if (match) {
    const [, dd, mm, yyyy, hh, min] = match;
    return new Date(+yyyy, +mm - 1, +dd, +hh, +min, 0);
  }
  const fallback = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (fallback) {
    const [, dd, mm, yyyy] = fallback;
    return new Date(+yyyy, +mm - 1, +dd, 23, 59, 59);
  }
  return null;
}

// Extrait startDate/endDate depuis le texte de l'article
// ex: "Offre valable du 06/03/2026 (14h00) au 09/03/2026 (08h59) ..."
function parseDateRange(content) {
  if (!content) return { startDate: null, endDate: null, displayText: null };

  const range = content.match(
    /du\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))\s+au\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))/i
  );
  if (range) {
    return {
      startDate: parseLbcDate(range[1]),
      endDate:   parseLbcDate(range[2]),
      displayText: `Du ${range[1].trim()} au ${range[2].trim()}`,
    };
  }

  const until = content.match(/jusqu['']au\s+(\d{2}\/\d{2}\/\d{4}\s*\(\d{1,2}h\d{2}\))/i);
  if (until) {
    return {
      startDate: null,
      endDate:   parseLbcDate(until[1]),
      displayText: `Jusqu'au ${until[1].trim()}`,
    };
  }

  return { startDate: null, endDate: null, displayText: null };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=7200, stale-while-revalidate=300',
    },
  });
}

export default async function handler(req) {
  try {
    const response = await fetch('https://www.leboncoin.fr/service/bons-plans', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
      },
    });

    if (!response.ok) {
      return json({ active: false, reason: `HTTP ${response.status}` });
    }

    const html = await response.text();

    // Extraction du bloc __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      return json({ active: false, reason: 'no __NEXT_DATA__ found' });
    }

    const nextData = JSON.parse(match[1]);
    const editoContents = nextData?.pageProps?.content?.edito_contents ?? [];
    const allArticles = editoContents.flatMap((block) => block.articles ?? []);

    // Cherche un article "livraison 0,99" actif
    const promoArticle = allArticles.find((article) => {
      const title = (article.title ?? '').toLowerCase();
      return (
        article.enabled !== false &&
        title.includes('livraison') &&
        (title.includes('0,99') || title.includes('0.99'))
      );
    });

    if (!promoArticle) {
      return json({ active: false });
    }

    const { startDate, endDate, displayText } = parseDateRange(promoArticle.content ?? '');

    // Si date de fin dépassée → inactif
    const now = new Date();
    if (endDate && now > endDate) {
      return json({ active: false, reason: 'expired' });
    }

    return json({
      active: true,
      title:       promoArticle.title,
      description: promoArticle.content,
      link:        promoArticle.link_to,
      startDate:   startDate ? startDate.toISOString() : null,
      endDate:     endDate   ? endDate.toISOString()   : null,
      displayText,
      checkedAt:   new Date().toISOString(),
    });

  } catch (error) {
    console.error('[check-livraison]', error);
    return json({ active: false, reason: error.message });
  }
}

// Force l'exécution depuis Paris — évite le blocage des IPs US de Vercel
export const config = {
  runtime: 'edge',
  regions: ['cdg1'],
};
