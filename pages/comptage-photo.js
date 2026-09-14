import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================================
   COMPTAGE PHOTO — comptage de pièces de jeu par photo, piloté par gabarits
   Page autonome. Aucune dépendance npm, aucun appel réseau, aucune table.
   Profils stockés dans localStorage (clé: meeple_detect_profiles)

   Principe : on photographie d'abord une pièce unitaire, l'outil la détoure
   et mémorise sa couleur et sa forme. Au comptage, tout ce qui ne ressemble
   pas à un gabarit enregistré est écarté (ombres, bois de la table, mains).
   ========================================================================== */

const STORAGE_KEY = 'meeple_detect_profiles';

/* ---------------------------------------------------------------- Couleurs */

function srgbToLinear(c) {
  const v = c / 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const f = t => (t > 0.008856452 ? Math.cbrt(t) : 7.787037 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a, b) {
  const dl = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/* Écart au fond : la luminance compte moitié moins, sinon une ombre portée
   sur une table claire est prise pour une pièce. */
function deltaFond(a, b) {
  const dl = (a[0] - b[0]) * 0.5, da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/* Comparaison à un gabarit. Une pièce à l'ombre garde sa teinte mais perd en
   clarté : on remet la couleur du gabarit à la clarté du pixel avant de
   comparer, sinon une tuile jaune dans l'ombre n'est plus reconnue. */
function deltaGab(lab, gLab) {
  let k = 1;
  if (gLab[0] > 8) k = Math.min(1.5, Math.max(0.6, lab[0] / gLab[0]));
  const dl = (lab[0] - gLab[0]) * 0.7;
  const da = lab[1] - gLab[1] * k;
  const db = lab[2] - gLab[2] * k;
  return Math.sqrt(dl * dl + da * da + db * db);
}

const cssRgb = rgb => `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;
const isLight = rgb => (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150;

/* ------------------------------------------------------ Morphologie binaire */

function morph(mask, w, h, radius, erode) {
  if (radius <= 0) return mask;
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx;
        const m = xx < 0 || xx >= w ? 0 : mask[row + xx];
        if (erode) { if (!m) { v = 0; break; } } else if (m) { v = 1; break; }
      }
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = erode ? 1 : 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        const m = yy < 0 || yy >= h ? 0 : tmp[yy * w + x];
        if (erode) { if (!m) { v = 0; break; } } else if (m) { v = 1; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/* -------------------------------------------------------------- Estimations */

function estimateBackground(data, w, h) {
  const band = Math.max(3, Math.round(Math.min(w, h) * 0.04));
  const Ls = [], As = [], Bs = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    const lab = rgbToLab(data[i], data[i + 1], data[i + 2]);
    Ls.push(lab[0]); As.push(lab[1]); Bs.push(lab[2]);
  };
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < band; x += 2) push(x, y);
    for (let x = w - band; x < w; x += 2) push(x, y);
  }
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < band; y += 2) push(x, y);
    for (let y = h - band; y < h; y += 2) push(x, y);
  }
  const med = arr => { arr.sort((a, b) => a - b); return arr[arr.length >> 1] || 0; };
  return [med(Ls), med(As), med(Bs)];
}

/* Taille d'une pièce : pic de l'histogramme des surfaces. Plus fiable que la
   médiane quand il reste du bruit ou des taches fusionnées. */
function modeArea(areas) {
  if (!areas.length) return 0;
  const s = [...areas].sort((a, b) => a - b);
  let best = s[0], bestN = 0;
  for (let i = 0; i < s.length; i++) {
    const hi = s[i] * 1.45;
    let j = i;
    while (j < s.length && s[j] <= hi) j++;
    if (j - i > bestN) { bestN = j - i; best = s[(i + j - 1) >> 1]; }
  }
  return best;
}

const median = arr => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/* --------------------------------------------------------------- Détection */

function detectPieces(imageData, opts, gabarits) {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  const gabs = gabarits && gabarits.length ? gabarits : null;

  const bgLab = opts.fondManuel || estimateBackground(data, w, h);

  const labL = new Float32Array(n), labA = new Float32Array(n), labB = new Float32Array(n);
  const zone = new Uint8Array(n);
  const raw = new Uint8Array(n);

  // 1. masque premier plan
  if (gabs) {
    const tol = opts.tolGabarit;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      labL[i] = lab[0]; labA[i] = lab[1]; labB[i] = lab[2];
      if (deltaFond(lab, bgLab) <= opts.seuilFond * 0.55) continue;
      let best = -1, bestD = Infinity;
      for (let k = 0; k < gabs.length; k++) {
        const d = deltaGab(lab, gabs[k].lab);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (bestD <= tol) { raw[i] = 1; zone[i] = best + 1; }
    }
  } else {
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      labL[i] = lab[0]; labA[i] = lab[1]; labB[i] = lab[2];
      raw[i] = deltaFond(lab, bgLab) > opts.seuilFond ? 1 : 0;
    }
  }

  // 2. fermeture (rebouche les motifs imprimés) puis ouverture (enlève le bruit)
  let mask = raw;
  if (opts.fermeture > 0) {
    mask = morph(mask, w, h, opts.fermeture, false);
    mask = morph(mask, w, h, opts.fermeture, true);
  }
  mask = morph(mask, w, h, opts.separation, true);
  mask = morph(mask, w, h, opts.separation, false);

  const core = morph(mask, w, h, 2, true);

  // 3. sans gabarit : teintes dominantes, pour que deux pièces de couleurs
  //    différentes qui se touchent restent deux pièces
  let teintes = [];
  if (!gabs && opts.parCouleur) {
    const tol = Math.max(14, opts.tolerance);
    const acc = [];
    for (let i = 0; i < n; i += 3) {
      if (!core[i]) continue;
      const L = labL[i], A = labA[i], B = labB[i];
      let best = -1, bestD = Infinity;
      for (let k = 0; k < acc.length; k++) {
        const t = acc[k];
        const d = deltaE([L, A, B], [t.L / t.n, t.A / t.n, t.B / t.n]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0 && bestD <= tol) {
        const t = acc[best]; t.L += L; t.A += A; t.B += B; t.n++;
      } else if (acc.length < 14) acc.push({ L, A, B, n: 1 });
    }
    teintes = acc.filter(t => t.n >= 8).map(t => [t.L / t.n, t.A / t.n, t.B / t.n]);
    if (teintes.length > 1) {
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue;
        let best = 0, bestD = Infinity;
        for (let k = 0; k < teintes.length; k++) {
          const d = deltaE([labL[i], labA[i], labB[i]], teintes[k]);
          if (d < bestD) { bestD = d; best = k; }
        }
        zone[i] = best + 1;
      }
    }
  }
  const useZones = gabs ? true : teintes.length > 1;

  // 4. composantes connexes, sans franchir une frontière de teinte
  const labels = new Int32Array(n);
  const stack = new Int32Array(n);
  const comps = [];
  let current = 0;

  for (let start = 0; start < n; start++) {
    if (!mask[start] || labels[start]) continue;
    const z = zone[start];
    current++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = current;

    let area = 0, sx = 0, sy = 0, cr = 0, cg = 0, cb = 0, cn = 0, ar = 0, ag = 0, ab = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      const q = p * 4;
      ar += data[q]; ag += data[q + 1]; ab += data[q + 2];
      if (core[p]) { cr += data[q]; cg += data[q + 1]; cb += data[q + 2]; cn++; }
      const ok = t => mask[t] && !labels[t] && (!useZones || zone[t] === z);
      if (x > 0 && ok(p - 1)) { labels[p - 1] = current; stack[sp++] = p - 1; }
      if (x < w - 1 && ok(p + 1)) { labels[p + 1] = current; stack[sp++] = p + 1; }
      if (y > 0 && ok(p - w)) { labels[p - w] = current; stack[sp++] = p - w; }
      if (y < h - 1 && ok(p + w)) { labels[p + w] = current; stack[sp++] = p + w; }
    }

    const rgb = cn > 20 ? [cr / cn, cg / cn, cb / cn] : [ar / area, ag / area, ab / area];
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    comps.push({
      label: current, area, cx: sx / area, cy: sy / area,
      minX, maxX, minY, maxY, bw, bh,
      allonge: Math.max(bw, bh) / Math.min(bw, bh),
      remplissage: area / (bw * bh),
      zone: z - 1,
      rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2])
    });
  }

  // 5. taille unitaire, calculée séparément pour chaque gabarit
  const plancher = Math.max(10, n * 0.000015);
  const retenus = comps.filter(c => c.area >= plancher);
  if (!retenus.length) {
    return { blobs: [], labels, mask, bgLab, unit: {}, w, h, warn: null, rejets: comps.length };
  }

  const unitOf = {};
  const cles = gabs ? gabs.map((_, i) => i) : [-1];
  cles.forEach(k => {
    const pool = gabs ? retenus.filter(c => c.zone === k) : retenus;
    if (!pool.length) { unitOf[k] = 0; return; }
    let u = modeArea(pool.map(c => c.area));
    // pièces identiques alignées et collées : leur petit côté reste celui d'une pièce
    const cote = median(pool.map(c => Math.min(c.bw, c.bh)));
    const rho = median(pool.map(c => c.remplissage));
    const est = cote * cote * rho;
    if (est > plancher * 2 && est < u * 0.7) u = est;
    unitOf[k] = u;
  });

  const blobs = [];
  let fusionMax = 1, rejets = 0;

  comps.forEach(c => {
    const u = unitOf[gabs ? c.zone : -1] || 0;
    if (!u) { rejets++; return; }
    if (c.area < u * opts.tailleMin) { rejets++; return; }
    if (opts.ignorerBords && (c.minX <= 1 || c.minY <= 1 || c.maxX >= w - 2 || c.maxY >= h - 2)) {
      rejets++; return;
    }
    if (gabs && c.zone >= 0) {
      const g = gabs[c.zone];
      if (g.allonge && c.allonge > g.allonge * 2.2 + 0.6 && c.area < u * 1.4) { rejets++; return; }
    }
    let count = 1;
    const ratio = c.area / u;
    if (ratio > 1.55 && (c.allonge >= 1.6 || c.remplissage < 0.75 || ratio >= 2.6)) {
      count = Math.max(1, Math.round(ratio));
      if (count > fusionMax) fusionMax = count;
    }
    blobs.push({ ...c, count, excluded: false, manual: false });
  });

  blobs.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  blobs.forEach((b, i) => { b.id = i; });

  let warn = null;
  const surfaceTotale = blobs.reduce((s, b) => s + b.area, 0);
  if (blobs.length && blobs.length <= 3 && surfaceTotale > n * 0.08) {
    warn = "Les pièces forment un seul bloc : la taille d'une pièce n'a pas pu être déduite. Espace-les et refais la photo.";
  } else if (fusionMax >= 4) {
    warn = `Jusqu'à ${fusionMax} pièces se touchent à un même endroit — vérifie les pastilles chiffrées.`;
  }

  return { blobs, labels, mask, bgLab, unit: unitOf, w, h, warn, rejets };
}

/* ------------------------------------------------------ Détourage d'une pièce */

function makeCutout(imageData, labels, blob, maxSize = 96) {
  const { width: w, data } = imageData;
  const bw = blob.bw, bh = blob.bh;
  const cv = document.createElement('canvas');
  cv.width = bw; cv.height = bh;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const src = (blob.minY + y) * w + (blob.minX + x);
      const d = (y * bw + x) * 4;
      if (labels[src] === blob.label) {
        out.data[d] = data[src * 4];
        out.data[d + 1] = data[src * 4 + 1];
        out.data[d + 2] = data[src * 4 + 2];
        out.data[d + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);

  const scale = Math.min(1, maxSize / Math.max(bw, bh));
  if (scale < 1) {
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(bw * scale));
    small.height = Math.max(1, Math.round(bh * scale));
    const sctx = small.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cv, 0, 0, small.width, small.height);
    return small.toDataURL('image/png');
  }
  return cv.toDataURL('image/png');
}

/* ------------------------------------------------- Regroupement des taches */

function groupBlobs(blobs, gabs, tolerance) {
  const actifs = blobs.filter(b => !b.excluded);

  if (gabs && gabs.length) {
    const groups = gabs.map((g, i) => ({
      key: g.id, idx: i, name: g.name, rgb: g.rgb, thumb: g.thumb,
      expected: g.expected, count: 0, blobs: []
    }));
    actifs.forEach(b => {
      let i = b.zone;
      if (i == null || i < 0 || i >= groups.length) {
        let bestD = Infinity;
        gabs.forEach((g, k) => { const d = deltaGab(b.lab, g.lab); if (d < bestD) { bestD = d; i = k; } });
      }
      groups[i].count += b.count;
      groups[i].blobs.push(b);
      b.groupKey = groups[i].key;
    });
    return groups.filter(g => g.count > 0 || g.expected != null);
  }

  const clusters = [];
  actifs.forEach(b => {
    let best = null, bestD = Infinity;
    clusters.forEach(c => { const d = deltaE(b.lab, c.lab); if (d < bestD) { bestD = d; best = c; } });
    if (best && bestD <= tolerance) {
      best.blobs.push(b);
      const k = best.blobs.length;
      best.lab = best.lab.map((v, i) => v + (b.lab[i] - v) / k);
      best.rgb = best.rgb.map((v, i) => v + (b.rgb[i] - v) / k);
    } else {
      clusters.push({ lab: [...b.lab], rgb: [...b.rgb], blobs: [b] });
    }
  });
  clusters.forEach((c, i) => {
    c.key = 'auto' + i;
    c.count = c.blobs.reduce((s, b) => s + b.count, 0);
    c.name = ''; c.expected = null; c.thumb = null;
    c.blobs.forEach(b => { b.groupKey = c.key; });
  });
  return clusters.sort((a, b) => b.count - a.count);
}

/* ======================================================= CHARGEMENT D'IMAGE */

async function fileToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      try { return await createImageBitmap(file); } catch (e2) { /* on retombe plus bas */ }
    }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function drawToImageData(bmp, maxSide) {
  const sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function firstImageFile(list) {
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const f = list[i].getAsFile ? list[i].getAsFile() : list[i];
    if (f && f.type && f.type.startsWith('image/')) return f;
  }
  return null;
}

/* =========================================================== COMPOSANT PAGE */

export default function ComptagePhoto() {
  const [darkMode, setDarkMode] = useState(false);
  const [profiles, setProfiles] = useState({});
  const [currentGame, setCurrentGame] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [toast, setToast] = useState('');

  const [bitmap, setBitmap] = useState(null);
  const [imgData, setImgData] = useState(null);
  const [result, setResult] = useState(null);
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [pickBg, setPickBg] = useState(false);

  const [dragCount, setDragCount] = useState(false);
  const [dragTpl, setDragTpl] = useState(false);

  const [tplDraft, setTplDraft] = useState(null);
  const [tplBusy, setTplBusy] = useState(false);

  const [opts, setOpts] = useState({
    seuilFond: 20,
    fermeture: 1,
    separation: 1,
    tailleMin: 0.45,
    tolerance: 18,
    tolGabarit: 26,
    resolution: 900,
    parCouleur: true,
    ignorerBords: false,
    fondManuel: null
  });

  const canvasRef = useRef(null);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const tplCamRef = useRef(null);
  const tplGalRef = useRef(null);

  const gabs = currentGame && profiles[currentGame] && profiles[currentGame].gabarits
    && profiles[currentGame].gabarits.length ? profiles[currentGame].gabarits : null;

  useEffect(() => {
    setDarkMode(localStorage.getItem('darkMode') === 'true');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProfiles(JSON.parse(saved));
    } catch (e) { console.error('Profils illisibles', e); }
  }, []);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const persist = next => {
    setProfiles(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (e) { flash('Mémoire pleine : supprime des gabarits'); }
  };

  /* -------------------------------------------------------------- comptage */

  const analyse = useCallback(async (data, options) => {
    if (!data) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 30));
    try {
      const res = detectPieces(data, options, gabs);
      setResult(res);
      setGroups(groupBlobs(res.blobs, gabs, options.tolerance));
    } catch (e) {
      console.error(e);
      flash("L'analyse a échoué");
    }
    setBusy(false);
  }, [gabs]);

  const loadPhoto = async file => {
    if (!file) return;
    setBusy(true); setResult(null); setGroups([]); setAdjust({});
    try {
      const bmp = await fileToBitmap(file);
      const data = drawToImageData(bmp, opts.resolution);
      setBitmap(bmp); setImgData(data);
      await analyse(data, opts);
    } catch (e) {
      console.error(e); flash('Image illisible'); setBusy(false);
    }
  };

  const regroup = nextBlobs => {
    if (!result) return;
    setResult({ ...result, blobs: nextBlobs });
    setGroups(groupBlobs(nextBlobs, gabs, opts.tolerance));
  };

  /* -------------------------------------------------------------- gabarits */

  const loadTemplate = async file => {
    if (!file) return;
    if (!currentGame) { flash("Choisis d'abord un jeu"); return; }
    setTplBusy(true);
    try {
      const bmp = await fileToBitmap(file);
      const data = drawToImageData(bmp, 900);
      const res = detectPieces(data, { ...opts, tailleMin: 0.3 }, null);
      if (!res.blobs.length) {
        flash('Aucune pièce détectée sur cette photo');
        setTplBusy(false);
        return;
      }
      const grosses = res.blobs.slice().sort((a, b) => b.area - a.area).slice(0, 8);
      const seuil = grosses[0].area * 0.35;
      const items = grosses.filter(b => b.area >= seuil).map((b, i) => ({
        blob: b,
        thumb: makeCutout(data, res.labels, b),
        name: '',
        expected: '',
        keep: true,
        key: 'k' + i
      }));
      setTplDraft({ items });
    } catch (e) {
      console.error(e); flash('Image illisible');
    }
    setTplBusy(false);
  };

  const saveTemplates = () => {
    const items = tplDraft.items.filter(i => i.keep);
    if (!items.length) { flash('Sélectionne au moins une pièce'); return; }
    if (items.some(i => !i.name.trim())) { flash('Donne un nom à chaque pièce'); return; }
    const existants = (profiles[currentGame] && profiles[currentGame].gabarits) || [];
    const nouveaux = items.map((i, k) => ({
      id: 'g' + Date.now() + '_' + k,
      name: i.name.trim(),
      rgb: i.blob.rgb.map(v => Math.round(v)),
      lab: i.blob.lab,
      allonge: i.blob.allonge,
      remplissage: i.blob.remplissage,
      expected: i.expected === '' ? null : parseInt(i.expected, 10),
      thumb: i.thumb
    }));
    persist({
      ...profiles,
      [currentGame]: { ...profiles[currentGame], gabarits: [...existants, ...nouveaux] }
    });
    setTplDraft(null);
    flash(nouveaux.length + ' gabarit' + (nouveaux.length > 1 ? 's enregistrés' : ' enregistré'));
  };

  const deleteGabarit = id => {
    const g = ((profiles[currentGame] && profiles[currentGame].gabarits) || []).filter(x => x.id !== id);
    persist({ ...profiles, [currentGame]: { ...profiles[currentGame], gabarits: g } });
  };

  const setGabExpected = (id, val) => {
    const g = ((profiles[currentGame] && profiles[currentGame].gabarits) || []).map(x =>
      x.id === id ? { ...x, expected: val === '' ? null : parseInt(val, 10) } : x);
    persist({ ...profiles, [currentGame]: { ...profiles[currentGame], gabarits: g } });
  };

  /* --------------------------------------------------------------- profils */

  const createGame = () => {
    const name = newGameName.trim();
    if (!name) return;
    if (profiles[name]) { setCurrentGame(name); setNewGameName(''); return; }
    persist({ ...profiles, [name]: { gabarits: [] } });
    setCurrentGame(name); setNewGameName('');
  };

  const deleteGame = name => {
    const next = { ...profiles };
    delete next[name];
    persist(next);
    if (currentGame === name) setCurrentGame('');
  };

  /* ------------------------------------------------------ coller une image */

  useEffect(() => {
    const onPaste = e => {
      const f = firstImageFile(e.clipboardData && e.clipboardData.items);
      if (f) { e.preventDefault(); loadPhoto(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  /* ------------------------------------------------------------- affichage */

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !bitmap || !result) return;
    const w = result.w, h = result.h;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (showMask && result.mask) {
      const ov = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        if (result.mask[i]) {
          ov.data[i * 4] = 0; ov.data[i * 4 + 1] = 255; ov.data[i * 4 + 2] = 120;
          ov.data[i * 4 + 3] = 120;
        }
      }
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      tmp.getContext('2d').putImageData(ov, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);

    const colorOf = {};
    groups.forEach(g => { colorOf[g.key] = cssRgb(g.rgb); });
    const unit = Math.max(400, ...Object.values(result.unit || {}).map(v => v || 0));
    const r = Math.max(8, Math.sqrt(unit) * 0.28);
    ctx.font = 'bold ' + Math.round(r * 1.05) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    result.blobs.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      if (b.excluded) {
        ctx.fillStyle = 'rgba(20,20,20,0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.95)';
        ctx.lineWidth = Math.max(2, r * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.cx - r * 0.45, b.cy - r * 0.45);
        ctx.lineTo(b.cx + r * 0.45, b.cy + r * 0.45);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = colorOf[b.groupKey] || '#999';
      ctx.fill();
      ctx.strokeStyle = b.manual ? 'rgba(255,220,0,1)' : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.5, r * (b.manual ? 0.22 : 0.12));
      ctx.stroke();
      if (b.count > 1) {
        ctx.fillStyle = isLight(b.rgb) ? '#111' : '#fff';
        ctx.fillText(String(b.count), b.cx, b.cy + 1);
      }
    });
  }, [bitmap, result, groups, showMask]);

  const onCanvasClick = e => {
    if (!result || !imgData) return;
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cv.width / rect.width);
    const y = (e.clientY - rect.top) * (cv.height / rect.height);

    if (pickBg) {
      const i = (Math.round(y) * result.w + Math.round(x)) * 4;
      const lab = rgbToLab(imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]);
      const next = { ...opts, fondManuel: lab };
      setOpts(next);
      setPickBg(false);
      analyse(imgData, next);
      flash('Couleur de fond mise à jour');
      return;
    }

    let best = null, bestD = Infinity;
    result.blobs.forEach(b => {
      const d = (b.cx - x) * (b.cx - x) + (b.cy - y) * (b.cy - y);
      if (d < bestD) { bestD = d; best = b; }
    });
    const unit = Math.max(400, ...Object.values(result.unit || {}).map(v => v || 0));
    const portee = unit * 1.6;

    if (best && bestD <= portee) {
      regroup(result.blobs.map(b => b.id === best.id ? { ...b, excluded: !b.excluded } : b));
      return;
    }

    const i = (Math.round(y) * result.w + Math.round(x)) * 4;
    const rgb = [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]];
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    let zone = -1, bd = Infinity;
    if (gabs) gabs.forEach((g, k) => { const d = deltaGab(lab, g.lab); if (d < bd) { bd = d; zone = k; } });
    const ajout = {
      id: result.blobs.length ? Math.max(...result.blobs.map(b => b.id)) + 1 : 0,
      label: -1, area: unit, cx: x, cy: y,
      minX: x, maxX: x, minY: y, maxY: y, bw: 1, bh: 1,
      allonge: 1, remplissage: 1, zone, rgb, lab,
      count: 1, excluded: false, manual: true
    };
    regroup([...result.blobs, ajout]);
  };

  /* ---------------------------------------------------------------- totaux */

  const totalFor = g => g.count + (adjust[g.key] || 0);
  const total = groups.reduce((s, g) => s + totalFor(g), 0);

  const copyResult = () => {
    const lignes = groups.map(g => (g.name || 'Groupe') + ' : ' + totalFor(g)).join('\n');
    const txt = (currentGame || 'Comptage') + ' — ' + total + ' pièce' + (total > 1 ? 's' : '') + '\n' + lignes;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => flash('Résultat copié'), () => flash('Copie impossible'));
    }
  };

  /* ---------------------------------------------------------------- styles */

  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const txt = darkMode ? 'text-gray-100' : 'text-gray-800';
  const sub = darkMode ? 'text-gray-400' : 'text-gray-500';
  const field = darkMode
    ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400';
  const ghost = darkMode
    ? 'border-gray-700 text-gray-300 hover:bg-gray-700'
    : 'border-gray-200 text-gray-600 hover:bg-gray-50';

  const dropProps = (setDrag, handler) => ({
    onDragOver: e => { e.preventDefault(); setDrag(true); },
    onDragEnter: e => { e.preventDefault(); setDrag(true); },
    onDragLeave: e => { if (e.currentTarget === e.target) setDrag(false); },
    onDrop: e => {
      e.preventDefault(); setDrag(false);
      const f = firstImageFile(e.dataTransfer && e.dataTransfer.files);
      if (f) handler(f); else flash('Dépose une image');
    }
  });

  return (
    <div className={'min-h-screen transition-colors duration-300 ' + (darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100')}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-2xl">
          {toast}
        </div>
      )}

      <div className="py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* En-tête */}
          <div className={card + ' border rounded-2xl shadow-xl p-5'}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => window.history.back()}
                  className={'p-2 rounded-xl ' + (darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div>
                  <h1 className={'text-2xl font-bold ' + txt}>Comptage photo</h1>
                  <p className={'text-sm ' + sub}>Enregistre une pièce, puis compte-les toutes</p>
                </div>
              </div>
              <button
                onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem('darkMode', String(v)); }}
                className={'p-2.5 rounded-xl ' + (darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-700')}>
                {darkMode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* 1. Jeu */}
          <div className={card + ' border rounded-2xl shadow-xl p-5 space-y-3'}>
            <h2 className={'font-semibold ' + txt}>1. Jeu</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCurrentGame('')}
                className={'px-3 py-2 rounded-xl text-sm font-medium border ' + (currentGame === '' ? 'bg-blue-600 border-blue-600 text-white' : ghost)}>
                Sans gabarit
              </button>
              {Object.keys(profiles).sort().map(name => (
                <span key={name} className="relative">
                  <button onClick={() => setCurrentGame(name)}
                    className={'pl-3 pr-7 py-2 rounded-xl text-sm font-medium border ' + (currentGame === name ? 'bg-blue-600 border-blue-600 text-white' : ghost)}>
                    {name}
                    {profiles[name].gabarits && profiles[name].gabarits.length > 0 && (
                      <span className="ml-1.5 opacity-70">· {profiles[name].gabarits.length}</span>
                    )}
                  </button>
                  <button onClick={() => deleteGame(name)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-xs">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newGameName} onChange={e => setNewGameName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGame()}
                placeholder="Nom d'un nouveau jeu (ex : Azul)"
                className={'flex-1 px-3 py-2 rounded-xl border text-sm ' + field} />
              <button onClick={createGame} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                Ajouter
              </button>
            </div>
          </div>

          {/* 2. Gabarits */}
          {currentGame && (
            <div {...dropProps(setDragTpl, loadTemplate)}
              className={card + ' border rounded-2xl shadow-xl p-5 space-y-4 transition-colors ' + (dragTpl ? 'ring-2 ring-emerald-500 border-emerald-500' : '')}>
              <h2 className={'font-semibold ' + txt}>2. Gabarits de {currentGame}</h2>

              <p className={'text-sm leading-relaxed ' + sub}>
                Pose une seule pièce de chaque type sur une feuille blanche et photographie-la de près.
                L'outil la détoure et retient sa couleur et sa forme.
              </p>

              <input ref={tplCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { loadTemplate(e.target.files && e.target.files[0]); e.target.value = ''; }} />
              <input ref={tplGalRef} type="file" accept="image/*" className="hidden"
                onChange={e => { loadTemplate(e.target.files && e.target.files[0]); e.target.value = ''; }} />

              <div className="flex flex-wrap gap-2">
                <button onClick={() => tplCamRef.current && tplCamRef.current.click()} disabled={tplBusy}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  {tplBusy ? 'Détourage…' : 'Photographier une pièce'}
                </button>
                <button onClick={() => tplGalRef.current && tplGalRef.current.click()} disabled={tplBusy}
                  className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + ghost + ' disabled:opacity-50'}>
                  Choisir dans la galerie
                </button>
                <span className={'hidden sm:flex items-center text-xs ' + sub}>
                  ou dépose une image ici
                </span>
              </div>

              {gabs && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {gabs.map(g => (
                    <div key={g.id} className={'relative rounded-xl p-3 ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                      <button onClick={() => deleteGabarit(g.id)}
                        className="absolute top-1.5 right-2 text-xs opacity-50 hover:opacity-100">✕</button>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
                          style={{ background: darkMode ? '#1f2937' : '#fff' }}>
                          {g.thumb
                            ? <img src={g.thumb} alt={g.name} className="max-w-full max-h-full object-contain" />
                            : <span className="w-8 h-8 rounded" style={{ background: cssRgb(g.rgb) }} />}
                        </div>
                        <div className="min-w-0">
                          <div className={'text-sm font-medium truncate ' + txt}>{g.name}</div>
                          <input type="number" inputMode="numeric" placeholder="attendu"
                            value={g.expected == null ? '' : g.expected}
                            onChange={e => setGabExpected(g.id, e.target.value)}
                            className={'mt-1 w-20 px-2 py-1 rounded-lg border text-xs ' + field} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tplDraft && (
                <div className={'rounded-xl p-4 space-y-3 border-2 border-dashed ' + (darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-gray-50')}>
                  <p className={'text-sm font-medium ' + txt}>Pièces détourées — décoche ce qui n'en est pas</p>
                  <div className="space-y-2">
                    {tplDraft.items.map((it, idx) => (
                      <div key={it.key} className={'flex items-center gap-3 p-2 rounded-lg ' + (darkMode ? 'bg-gray-800' : 'bg-white')}>
                        <input type="checkbox" checked={it.keep} className="w-4 h-4 accent-blue-600"
                          onChange={e => {
                            const v = e.target.checked;
                            setTplDraft(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, keep: v } : x) }));
                          }} />
                        <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg"
                          style={{ background: darkMode ? '#111827' : '#f3f4f6' }}>
                          <img src={it.thumb} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                        <input value={it.name} placeholder="Nom (ex : tuile bleue)"
                          onChange={e => {
                            const v = e.target.value;
                            setTplDraft(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, name: v } : x) }));
                          }}
                          className={'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-sm ' + field} />
                        <input type="number" inputMode="numeric" placeholder="qté" value={it.expected}
                          onChange={e => {
                            const v = e.target.value;
                            setTplDraft(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, expected: v } : x) }));
                          }}
                          className={'w-16 px-2 py-1.5 rounded-lg border text-sm ' + field} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveTemplates}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
                      Enregistrer
                    </button>
                    <button onClick={() => setTplDraft(null)} className={'px-4 py-2 rounded-xl text-sm font-medium border ' + ghost}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Comptage */}
          <div {...dropProps(setDragCount, loadPhoto)}
            className={card + ' border rounded-2xl shadow-xl p-5 space-y-4 transition-colors ' + (dragCount ? 'ring-2 ring-blue-500 border-blue-500' : '')}>
            <h2 className={'font-semibold ' + txt}>3. Comptage</h2>

            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { loadPhoto(e.target.files && e.target.files[0]); e.target.value = ''; }} />
            <input ref={galRef} type="file" accept="image/*" className="hidden"
              onChange={e => { loadPhoto(e.target.files && e.target.files[0]); e.target.value = ''; }} />

            <div className="flex flex-wrap gap-2">
              <button onClick={() => camRef.current && camRef.current.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                Prendre une photo
              </button>
              <button onClick={() => galRef.current && galRef.current.click()}
                className={'flex items-center gap-2 px-4 py-3 rounded-xl font-medium border ' + ghost}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                Choisir une image
              </button>
              {bitmap && (
                <>
                  <button onClick={() => analyse(imgData, opts)} disabled={busy}
                    className={'px-4 py-3 rounded-xl font-medium border ' + ghost + ' disabled:opacity-50'}>
                    Relancer
                  </button>
                  <button onClick={() => setPickBg(p => !p)}
                    className={'px-4 py-3 rounded-xl font-medium border ' + (pickBg ? 'bg-amber-500 border-amber-500 text-black' : ghost)}>
                    {pickBg ? 'Touche le fond…' : 'Indiquer le fond'}
                  </button>
                  <button onClick={() => setShowMask(m => !m)}
                    className={'px-4 py-3 rounded-xl font-medium border ' + (showMask ? 'bg-emerald-600 border-emerald-600 text-white' : ghost)}>
                    Voir le masque
                  </button>
                </>
              )}
              <button onClick={() => setShowSettings(s => !s)} className={'px-4 py-3 rounded-xl font-medium border ' + ghost}>
                Réglages
              </button>
            </div>

            <p className={'text-xs ' + sub}>
              Sur ordinateur tu peux aussi glisser une image dans ce cadre, ou la coller avec Ctrl+V.
            </p>

            {!gabs && currentGame && (
              <p className="text-sm text-amber-600">
                Aucun gabarit pour {currentGame} : le comptage se fera à l'aveugle et risque de compter les ombres.
              </p>
            )}

            {showSettings && (
              <div className={'rounded-xl p-4 space-y-4 ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                <Slider label="Tolérance des gabarits" hint="Plus bas = n'accepte que les couleurs très proches des pièces enregistrées"
                  value={opts.tolGabarit} min={8} max={50} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tolGabarit: v }))} />
                <Slider label="Sensibilité au fond" hint="Monte-le si des ombres ou le grain de la table sont comptés"
                  value={opts.seuilFond} min={6} max={45} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, seuilFond: v }))} />
                <Slider label="Taille minimale" hint="Part d'une pièce en dessous de laquelle une tache est ignorée. Monte-le si trop de pièces sont détectées"
                  value={opts.tailleMin} min={0.1} max={0.9} step={0.05} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tailleMin: v }))} />
                <Slider label="Bouchage des motifs" hint="Recolle une pièce illustrée que le dessin fait éclater en morceaux"
                  value={opts.fermeture} min={0} max={4} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, fermeture: v }))} />
                <Slider label="Séparation" hint="Augmente si des pièces collées sont comptées comme une seule"
                  value={opts.separation} min={1} max={5} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, separation: v }))} />
                <Slider label="Résolution d'analyse" hint="Plus haut = plus précis mais plus lent sur mobile"
                  value={opts.resolution} min={500} max={1600} step={100} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, resolution: v }))} />
                <Check label="Ignorer ce qui touche le bord" darkMode={darkMode}
                  hint="Écarte les pièces coupées par le cadre et le bord de la table"
                  checked={opts.ignorerBords} onChange={v => setOpts(o => ({ ...o, ignorerBords: v }))} />
                {!gabs && (
                  <Check label="Séparer par couleur" darkMode={darkMode}
                    hint="Deux pièces de couleurs différentes qui se touchent restent deux pièces"
                    checked={opts.parCouleur} onChange={v => setOpts(o => ({ ...o, parCouleur: v }))} />
                )}
                {opts.fondManuel && (
                  <button onClick={() => { const o = { ...opts, fondManuel: null }; setOpts(o); analyse(imgData, o); }}
                    className={'text-sm underline ' + sub}>
                    Oublier la couleur de fond choisie
                  </button>
                )}
                <button onClick={() => analyse(imgData, opts)} disabled={!imgData || busy}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-40">
                  Appliquer
                </button>
              </div>
            )}

            {busy && (
              <div className={'flex items-center gap-3 text-sm ' + sub}>
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Analyse en cours…
              </div>
            )}

            {bitmap && (
              <div>
                <canvas ref={canvasRef} onClick={onCanvasClick}
                  className="w-full rounded-xl cursor-pointer" style={{ touchAction: 'manipulation' }} />
                {result && (
                  <p className={'text-xs mt-2 leading-relaxed ' + sub}>
                    Touche une pastille pour la retirer du comptage. Touche une pièce oubliée pour l'ajouter
                    (cerclée de jaune). Un chiffre signifie que plusieurs pièces se touchent à cet endroit.
                    {result.rejets > 0 && ' ' + result.rejets + ' tache' + (result.rejets > 1 ? 's écartées' : ' écartée') + ' (trop petite ou hors gabarit).'}
                  </p>
                )}
              </div>
            )}

            {result && result.warn && (
              <div className="rounded-xl px-4 py-3 text-sm bg-amber-500/15 text-amber-700 border border-amber-500/30">
                {result.warn}
              </div>
            )}
          </div>

          {/* Résultat */}
          {result && groups.length > 0 && (
            <div className={card + ' border rounded-2xl shadow-xl p-5 space-y-4'}>
              <div className="flex items-baseline justify-between">
                <h2 className={'font-semibold ' + txt}>Résultat</h2>
                <div className={'text-3xl font-bold ' + txt}>
                  {total}<span className={'text-sm font-normal ml-2 ' + sub}>pièces</span>
                </div>
              </div>

              <div className="space-y-2">
                {groups.map(g => {
                  const nb = totalFor(g);
                  const ecart = g.expected != null ? nb - g.expected : null;
                  return (
                    <div key={g.key} className={'flex items-center gap-3 p-3 rounded-xl ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                      <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg"
                        style={{ background: darkMode ? '#111827' : '#fff' }}>
                        {g.thumb
                          ? <img src={g.thumb} alt="" className="max-w-full max-h-full object-contain" />
                          : <span className="w-6 h-6 rounded border border-black/20" style={{ background: cssRgb(g.rgb) }} />}
                      </div>
                      {g.thumb
                        ? <span className={'flex-1 min-w-0 truncate text-sm font-medium ' + txt}>{g.name}</span>
                        : <input value={g.name} placeholder="Nommer cette couleur"
                            onChange={e => {
                              const v = e.target.value;
                              setGroups(gs => gs.map(x => x.key === g.key ? { ...x, name: v } : x));
                            }}
                            className={'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-sm ' + field} />}
                      {ecart != null && (
                        <span className={'text-xs font-medium shrink-0 ' + (ecart === 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {ecart === 0 ? '✓' : (ecart > 0 ? '+' + ecart : ecart)}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setAdjust(a => ({ ...a, [g.key]: (a[g.key] || 0) - 1 }))}
                          className={'w-7 h-7 rounded-lg ' + (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>−</button>
                        <span className={'w-9 text-center font-bold ' + txt}>{nb}</span>
                        <button onClick={() => setAdjust(a => ({ ...a, [g.key]: (a[g.key] || 0) + 1 }))}
                          className={'w-7 h-7 rounded-lg ' + (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={copyResult} className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + ghost}>
                Copier le résultat
              </button>
            </div>
          )}

          {result && groups.length === 0 && !busy && (
            <div className={card + ' border rounded-2xl shadow-xl p-5'}>
              <p className={'text-sm leading-relaxed ' + sub}>
                Aucune pièce reconnue. Active « Voir le masque » pour savoir ce que l'outil isole :
                si rien n'est vert, monte la tolérance des gabarits ou baisse la sensibilité au fond.
                Si tout est vert, touche le fond avec « Indiquer le fond ».
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Sous-composants */

function Slider({ label, hint, value, min, max, step, onChange, darkMode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={'text-sm font-medium ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>{label}</label>
        <span className={'text-sm tabular-nums ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-blue-600" />
      <p className={'text-xs mt-0.5 ' + (darkMode ? 'text-gray-500' : 'text-gray-400')}>{hint}</p>
    </div>
  );
}

function Check({ label, hint, checked, onChange, darkMode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-blue-600" />
      <span>
        <span className={'text-sm font-medium block ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>{label}</span>
        <span className={'text-xs ' + (darkMode ? 'text-gray-500' : 'text-gray-400')}>{hint}</span>
      </span>
    </label>
  );
}
