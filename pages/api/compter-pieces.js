/* ============================================================================
   /api/compter-pieces — détection de pièces de jeu sur une photo (Gemini vision)

   Entrée  (POST JSON) :
     image      base64 JPEG de la photo (ou de la zone à analyser)   [obligatoire]
     exemple    base64 JPEG d'UNE pièce, pour dire « compte celles-ci » [optionnel]
     jeu        nom du jeu (contexte)                                   [optionnel]
     consigne   texte libre : « les wagons rouges », « routes et colonies »… [optionnel]
     etiquettes noms de pièces déjà mémorisés, à réutiliser tels quels   [optionnel]
     tuile      true si l'image n'est qu'un morceau d'une photo plus grande

   Sortie : { objets: [{ box_2d: [ymin, xmin, ymax, xmax] (0-1000), label }], modele }

   Variables d'environnement :
     GEMINI_API_KEY        (déjà utilisée par /api/gemini)
     GEMINI_VISION_MODEL   (facultatif — par défaut le même modèle que /api/gemini)
   ========================================================================== */

export const config = {
  api: { bodyParser: { sizeLimit: '6mb' } },
};

const MODELE_PAR_DEFAUT = 'gemini-3-flash-preview';
const MAX_BASE64 = 4_200_000;   // ~3 Mo d'image : reste sous la limite des fonctions serverless
const MAX_OBJETS = 400;
const DELAI_MS = 55_000;

/* Limite de débit « au mieux » (en mémoire : par instance serverless). */
const compteurs = new Map();
function trop(ip) {
  const now = Date.now();
  const c = compteurs.get(ip);
  if (!c || now > c.fin) { compteurs.set(ip, { n: 1, fin: now + 60_000 }); return false; }
  c.n++;
  if (compteurs.size > 500) for (const [k, v] of compteurs) if (now > v.fin) compteurs.delete(k);
  return c.n > 40;
}

const propre = (s, max) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function construirePrompt({ jeu, consigne, etiquettes, avecExemple, tuile }) {
  const l = [];
  l.push(
    "You are counting the pieces of a board game lying on a table, from a photo. " +
    "Pieces can be anything: train cars, roads, settlements, cities, tiles, ceramic tokens, magnets, meeples, cubes, cards, dice, coins…"
  );
  l.push(
    "Detect EVERY individual piece and return ONE bounding box per piece. " +
    "Include pieces that touch each other, partly overlap, lie in any orientation, are in shadow, are glossy, or have different colours. " +
    "Never merge several pieces into one box, and never skip a piece because it looks like its neighbours. " +
    "If pieces are stacked or piled, box each piece you can actually see. " +
    "Do NOT box the table, the cloth, hands, the game box, a player board, the rules or a whole group of pieces."
  );
  l.push(
    "box_2d is [ymin, xmin, ymax, xmax] normalised to 0-1000 relative to the image, tight around the piece. " +
    "label is a short lowercase French name made of the piece type and its colour or pattern, in the singular " +
    "(e.g. \"wagon rouge\", \"route bleue\", \"colonie orange\", \"tuile motif turquoise\", \"aimant argenté\"). " +
    "Pieces of the same kind MUST get exactly the same label; pieces that look different must get different labels."
  );
  if (jeu) l.push(`The game is: ${jeu}.`);
  if (consigne) l.push(`The user wants to count: ${consigne}. Only return those pieces.`);
  if (etiquettes && etiquettes.length) {
    l.push(`Known piece labels for this game — reuse them exactly when a piece matches: ${etiquettes.join(' | ')}.`);
  }
  if (avecExemple) {
    l.push(
      "A second image shows ONE example piece. Return only the pieces in the first image that are of the same kind " +
      "as the example (same shape and colour), including the example itself if it is visible. Use one label for all of them."
    );
  }
  if (tuile) {
    l.push(
      "This image is only a crop of a larger photo. Include a piece only if at least half of it is visible in this crop."
    );
  }
  l.push("Answer with the JSON array only.");
  return l.join('\n');
}

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
      label: { type: 'STRING' },
    },
    required: ['box_2d', 'label'],
  },
};

/* Réponse tronquée (MAX_TOKENS) : on garde les objets complets déjà reçus. */
function lireJson(texte) {
  let t = String(texte || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* réparation ci-dessous */ }
  const fin = t.lastIndexOf('}');
  if (fin > 0) {
    try { return JSON.parse(t.slice(0, fin + 1).replace(/,\s*$/, '') + ']'); } catch (e) { /* abandon */ }
  }
  return null;
}

function nettoyerObjets(brut) {
  let liste = brut;
  if (liste && !Array.isArray(liste)) liste = liste.objets || liste.boxes || liste.items || null;
  if (!Array.isArray(liste)) return [];
  const out = [];
  for (const o of liste) {
    const b = o && (o.box_2d || o.box || o.bbox);
    if (!Array.isArray(b) || b.length !== 4) continue;
    const v = b.map(Number);
    if (v.some(x => !Number.isFinite(x))) continue;
    const cl = x => Math.max(0, Math.min(1000, x));
    const [ymin, xmin, ymax, xmax] = v.map(cl);
    if (ymax - ymin < 4 || xmax - xmin < 4) continue;
    out.push({ box_2d: [ymin, xmin, ymax, xmax], label: propre(o.label, 60) || 'pièce' });
    if (out.length >= MAX_OBJETS) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (trop(ip)) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans une minute.' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée sur le serveur.' });

  const b = req.body || {};
  const image = typeof b.image === 'string' ? b.image.replace(/^data:image\/\w+;base64,/, '') : '';
  const exemple = typeof b.exemple === 'string' ? b.exemple.replace(/^data:image\/\w+;base64,/, '') : '';
  if (!image) return res.status(400).json({ error: 'Image manquante.' });
  if (image.length > MAX_BASE64 || exemple.length > MAX_BASE64) {
    return res.status(413).json({ error: 'Image trop lourde.' });
  }

  const etiquettes = Array.isArray(b.etiquettes)
    ? b.etiquettes.map(e => propre(e, 60)).filter(Boolean).slice(0, 30)
    : [];
  const prompt = construirePrompt({
    jeu: propre(b.jeu, 80),
    consigne: propre(b.consigne, 200),
    etiquettes,
    avecExemple: !!exemple,
    tuile: !!b.tuile,
  });

  const parts = [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: image } }];
  if (exemple) {
    parts.push({ text: 'Example piece (second image):' });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: exemple } });
  }

  const modele = process.env.GEMINI_VISION_MODEL || MODELE_PAR_DEFAUT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DELAI_MS);

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
      }
    );
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      console.error('Gemini vision:', r.status, JSON.stringify(data).slice(0, 400));
      const msg = data && data.error && data.error.message ? data.error.message : 'Erreur Gemini';
      return res.status(502).json({ error: `Gemini (${r.status}) : ${msg}` });
    }

    const cand = data && data.candidates && data.candidates[0];
    const texte = ((cand && cand.content && cand.content.parts) || [])
      .filter(p => typeof p.text === 'string' && !p.thought)
      .map(p => p.text).join('');
    const objets = nettoyerObjets(lireJson(texte));

    if (!objets.length && cand && cand.finishReason && cand.finishReason !== 'STOP' && cand.finishReason !== 'MAX_TOKENS') {
      return res.status(502).json({ error: `Réponse bloquée (${cand.finishReason}).` });
    }
    return res.status(200).json({ objets, modele });
  } catch (err) {
    const delai = err && err.name === 'AbortError';
    console.error('compter-pieces:', delai ? 'délai dépassé' : err);
    return res.status(delai ? 504 : 500).json({ error: delai ? "L'analyse a pris trop de temps." : 'Erreur serveur.' });
  } finally {
    clearTimeout(timer);
  }
}
