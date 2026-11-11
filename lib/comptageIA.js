/* ============================================================================
   Comptage de pièces par IA — côté navigateur

   Ce module ne dépend pas de React. Il prépare les images, appelle
   /api/compter-pieces, puis nettoie les détections (doublons, boîtes
   aberrantes). Toutes les boîtes sont exprimées en coordonnées normalisées
   0..1 par rapport à la photo entière : { x0, y0, x1, y1, etiquette }.
   ========================================================================== */

export const MAX_ENVOI = 1600;      // côté le plus long envoyé à l'IA (px)
export const SEUIL_TUILES = 25;     // au-delà, la photo est ré-analysée par zones
const CHEVAUCHEMENT = 0.10;         // recouvrement entre zones voisines
const SEUIL_DOUBLON = 0.6;          // intersection / plus petite boîte
const SEUIL_SATURATION = 30;        // une zone qui rend autant de pièces est redécoupée
const MAX_PROFONDEUR = 2;           // niveaux de redécoupage
const MAX_APPELS = 24;              // requêtes IA maximum pour les zones

/* ----------------------------------------------------------------- libellés */

/* « Wagons rouges » et « wagon rouge » doivent tomber dans le même groupe. */
export function normaliserLabel(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(m => (m.length > 3 ? m.replace(/[sx]$/, '') : m))
    .join(' ') || 'piece';
}

/* ----------------------------------------------------------------- géométrie */

export const aire = b => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);

function interMin(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1e-9, Math.min(aire(a), aire(b)));
}

/* Réponse brute de l'API → boîte normalisée. */
export function normaliserObjet(o) {
  const [ymin, xmin, ymax, xmax] = o.box_2d;
  return { x0: xmin / 1000, y0: ymin / 1000, x1: xmax / 1000, y1: ymax / 1000, etiquette: o.label || 'pièce' };
}

/* Retire ce qui ne peut pas être une pièce : miettes, et boîtes qui entourent
   la table ou tout un tas. Une grosse pièce légitime (tuile hexagonale parmi
   des cubes) est conservée : il faut être à la fois grande ET très au-dessus
   de la taille habituelle. */
export function nettoyerBoites(boites) {
  let out = boites.filter(b => aire(b) > 0.00004 && aire(b) < 0.6);
  if (out.length >= 4) {
    const a = out.map(aire).sort((p, q) => p - q);
    const med = a[a.length >> 1];
    out = out.filter(b => !(aire(b) > 0.2 && aire(b) > med * 10));
  }
  return out;
}

/* Supprime les détections de la même pièce. L'ordre d'entrée donne la
   priorité (les boîtes issues des zones d'abord), puis la plus grande gagne :
   une pièce coupée par le bord d'une zone est vue en entier dans l'autre. */
export function dedoublonner(boites, seuil = SEUIL_DOUBLON) {
  const ordre = boites
    .map((b, i) => ({ b, i, p: b.priorite || 0 }))
    .sort((u, v) => u.p - v.p || aire(v.b) - aire(u.b) || u.i - v.i);
  const gardees = [];
  for (const { b } of ordre) {
    if (!gardees.some(g => interMin(g, b) > seuil)) gardees.push(b);
  }
  return gardees;
}

/* Zones de découpe n×n avec recouvrement. */
export function decouperZones(n, chev = CHEVAUCHEMENT) {
  const z = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      z.push({
        x0: Math.max(0, i / n - chev), x1: Math.min(1, (i + 1) / n + chev),
        y0: Math.max(0, j / n - chev), y1: Math.min(1, (j + 1) / n + chev),
      });
    }
  }
  return z;
}

/* Boîte exprimée dans une zone → boîte exprimée dans la photo entière. */
export function versPhoto(zone, b) {
  const zw = zone.x1 - zone.x0, zh = zone.y1 - zone.y0;
  return {
    ...b,
    x0: zone.x0 + b.x0 * zw, x1: zone.x0 + b.x1 * zw,
    y0: zone.y0 + b.y0 * zh, y1: zone.y0 + b.y1 * zh,
  };
}

/* ------------------------------------------------------------------- images */

const dim = s => [s.width || s.naturalWidth, s.height || s.naturalHeight];

/* Découpe (région normalisée) + réduction + JPEG base64, sans préfixe data:. */
export function versJpeg(source, region = { x0: 0, y0: 0, x1: 1, y1: 1 }, maxSide = MAX_ENVOI) {
  const [W, H] = dim(source);
  const sx = Math.round(region.x0 * W), sy = Math.round(region.y0 * H);
  const sw = Math.max(1, Math.round((region.x1 - region.x0) * W));
  const sh = Math.max(1, Math.round((region.y1 - region.y0) * H));
  const sc = Math.min(1, maxSide / Math.max(sw, sh));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(sw * sc));
  cv.height = Math.max(1, Math.round(sh * sc));
  cv.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  /* Les fonctions serverless refusent les corps trop gros : on baisse la
     qualité jusqu'à passer sous ~3 Mo. */
  let q = 0.85, url = cv.toDataURL('image/jpeg', q);
  while (url.length > 3_200_000 && q > 0.4) { q -= 0.1; url = cv.toDataURL('image/jpeg', q); }
  return url.split(',')[1];
}

/* ------------------------------------------------------------------- réseau */

export async function appelerIA(payload) {
  let rep;
  try {
    rep = await fetch('/api/compter-pieces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error('Pas de connexion au serveur');
  }
  let json = null;
  try { json = await rep.json(); } catch (e) { /* corps vide */ }
  if (!rep.ok) throw new Error((json && json.error) || 'Erreur ' + rep.status);
  return Array.isArray(json && json.objets) ? json.objets : [];
}

/* ------------------------------------------------------------- détection IA */

/* Détecte les pièces d'une photo.

   1. Une passe sur la photo entière.
   2. S'il y a beaucoup de pièces (ou si `detail` est demandé), la photo est
      découpée en zones qui se recouvrent, chacune est analysée séparément, et
      les résultats sont fusionnés. Les modèles de vision perdent des objets
      quand ils sont nombreux et petits : zoomer corrige l'essentiel.

   p : { jeu, consigne, etiquettes, exemple (base64), detail, progression(fn) }
   d : dépendances injectables (tests) { versJpeg, appelerIA } */
export async function detecterIA(source, p = {}, d = { versJpeg, appelerIA }) {
  const base = { jeu: p.jeu || '', consigne: p.consigne || '', etiquettes: p.etiquettes || [] };
  if (p.exemple) base.exemple = p.exemple;
  const dit = m => { if (p.progression) p.progression(m); };

  dit('Analyse de la photo…');
  const entiere = await d.appelerIA({ ...base, image: d.versJpeg(source) });
  const globales = nettoyerBoites(entiere.map(normaliserObjet));

  if (!p.detail && globales.length < SEUIL_TUILES) {
    return { boites: dedoublonner(globales, 0.7), zones: false, echecs: 0 };
  }

  /* Analyse par zones. Une zone qui renvoie beaucoup de pièces est
     probablement saturée (le modèle en oublie quand elles sont trop
     nombreuses) : elle est redécoupée à son tour, dans la limite de
     MAX_PROFONDEUR niveaux et MAX_APPELS requêtes au total. */
  const file = decouperZones(globales.length >= 60 ? 3 : 2).map(z => ({ z, prof: 0 }));
  const resultats = [];
  let faites = 0, echecs = 0, reussites = 0, prevues = file.length;
  const ouvrier = async () => {
    while (file.length) {
      const { z, prof } = file.shift();
      try {
        const objets = await d.appelerIA({ ...base, tuile: true, image: d.versJpeg(source, z) });
        const boites = nettoyerBoites(objets.map(normaliserObjet).map(b => ({ ...versPhoto(z, b), priorite: 0 })));
        resultats.push(...boites);
        reussites++;
        if (boites.length >= SEUIL_SATURATION && prof < MAX_PROFONDEUR) {
          for (const sz of decouperZones(2)) {
            if (prevues >= MAX_APPELS) break;
            file.push({ z: versPhoto(z, sz), prof: prof + 1 });
            prevues++;
          }
        }
      } catch (e) { echecs++; }
      faites++;
      dit(`Analyse détaillée… zone ${faites}/${prevues}`);
    }
  };
  dit(`Analyse détaillée… zone 0/${prevues}`);
  /* Les ouvriers tournent tant que la file se remplit : on les relance
     jusqu'à ce qu'elle soit vide et qu'aucun ne soit en cours. */
  while (file.length) await Promise.all([ouvrier(), ouvrier(), ouvrier()]);

  /* Aucune zone n'a répondu : on garde la passe globale. */
  if (!reussites) return { boites: dedoublonner(globales, 0.7), zones: false, echecs };

  const toutes = [...resultats, ...globales.map(b => ({ ...b, priorite: 1 }))];
  return { boites: dedoublonner(toutes), zones: true, echecs };
}
