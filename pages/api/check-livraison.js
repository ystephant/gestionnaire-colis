// pages/api/check-livraison.js
// Route API Next.js — côté serveur, donc pas de blocage CORS
// Cache 2h : LeBonCoin ne change pas ses promos toutes les heures

const MOIS = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4,
  juin: 5, juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9,
  novembre: 10, décembre: 11, decembre: 11,
};

// Convertit "6 mars 2026 à 23h59" → objet Date
function parseFrenchDate(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();

  // "DD mois YYYY à HHhMM" ou "DD mois YYYY"
  const full = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+à\s+(\d{1,2})h(\d{2})?)?/);
  if (full) {
    const [, day, mois, year, hh = '23', mm = '59'] = full;
    const month = MOIS[mois];
    if (month === undefined) return null;
    return new Date(+year, month, +day, +hh, +mm, 59);
  }

  // "DD mois à HHhMM" ou "DD mois" (sans année → année courante)
  const partial = str.match(/(\d{1,2})\s+(\w+)(?:\s+à\s+(\d{1,2})h(\d{2})?)?/);
  if (partial) {
    const [, day, mois, hh = '23', mm = '59'] = partial;
    const month = MOIS[mois];
    if (month === undefined) return null;
    const year = new Date().getFullYear();
    return new Date(year, month, +day, +hh, +mm, 59);
  }

  return null;
}

// Extrait les dates de validité depuis un extrait de HTML
function extractDateRange(html) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  const textLow = text.toLowerCase();

  let startDate = null;
  let endDate = null;
  let displayText = null;

  // "du lundi 3 mars à 8h au mercredi 5 mars à 23h59"
  const duAu = textLow.match(
    /du\s+((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+\w+(?:\s+\d{4})?(?:\s+à\s+\d{1,2}h\d{0,2})?)\s+au\s+((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+\w+(?:\s+\d{4})?(?:\s+à\s+\d{1,2}h\d{0,2})?)/
  );
  if (duAu) {
    startDate = parseFrenchDate(duAu[1]);
    endDate   = parseFrenchDate(duAu[2]);
    displayText = `Du ${duAu[1].trim()} au ${duAu[2].trim()}`;
  }

  // "jusqu'au 5 mars à 23h59"
  if (!endDate) {
    const jusquau = textLow.match(
      /jusqu['']au\s+((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{1,2}\s+\w+(?:\s+\d{4})?(?:\s+à\s+\d{1,2}h\d{0,2})?)/
    );
    if (jusquau) {
      endDate     = parseFrenchDate(jusquau[1]);
      displayText = `Jusqu'au ${jusquau[1].trim()}`;
    }
  }

  // "du 03/03 au 05/03" ou "du 03/03/2026 au 05/03/2026"
  if (!endDate) {
    const slash = textLow.match(
      /du\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+au\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/
    );
    if (slash) {
      const year = new Date().getFullYear();
      startDate = new Date(slash[3] ? +slash[3] : year, +slash[2] - 1, +slash[1], 0, 0, 0);
      endDate   = new Date(slash[6] ? +slash[6] : year, +slash[5] - 1, +slash[4], 23, 59, 59);
      displayText = `Du ${slash[1]}/${slash[2]} au ${slash[4]}/${slash[5]}`;
    }
  }

  return { startDate, endDate, displayText };
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
    const htmlLow = html.toLowerCase();

    // 1. Détection du mot-clé
    const keywords = ['livraison à 0,99', 'livraison a 0,99', 'livraison 0,99', '0,99€', '0.99€'];
    const found = keywords.some((k) => htmlLow.includes(k));
    if (!found) return res.status(200).json({ active: false });

    // 2. Extraction de la plage horaire autour du mot-clé (±600 caractères)
    const idx = keywords.reduce((best, k) => {
      const i = htmlLow.indexOf(k);
      return i !== -1 && (best === -1 || i < best) ? i : best;
    }, -1);
    const excerpt = html.substring(Math.max(0, idx - 600), idx + 600);
    const { startDate, endDate, displayText } = extractDateRange(excerpt);

    // 3. Si on a pu parser une date de fin et qu'elle est dépassée → inactif
    const now = new Date();
    if (endDate && now > endDate) {
      return res.status(200).json({ active: false, reason: 'expired' });
    }

    return res.status(200).json({
      active: true,
      startDate:   startDate ? startDate.toISOString() : null,
      endDate:     endDate   ? endDate.toISOString()   : null,
      displayText,   // ex: "Du 3 mars à 8h au 5 mars à 23h59"
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[check-livraison] Erreur:', error);
    return res.status(200).json({ active: false, reason: error.message });
  }
}
