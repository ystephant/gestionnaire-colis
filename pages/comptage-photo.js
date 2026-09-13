import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================================
   COMPTAGE PHOTO — détection et comptage d'éléments de jeu par photo
   Page autonome. Ne dépend d'aucun autre fichier de l'application.
   Aucune librairie externe, aucun appel réseau, aucune table Supabase.
   Les profils de jeux sont stockés dans localStorage (clé: meeple_detect_profiles)
   ========================================================================== */

const STORAGE_KEY = 'meeple_detect_profiles';

/* ---------------------------------------------------------------- Couleurs */

function srgbToLinear(c) {
  const v = c / 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  let Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.00000;
  let Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const f = t => (t > 0.008856452 ? Math.cbrt(t) : 7.787037 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(l1, l2) {
  const dl = l1[0] - l2[0], da = l1[1] - l2[1], db = l1[2] - l2[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

function cssRgb(rgb) {
  return `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;
}

function isLight(rgb) {
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150;
}

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
        if (erode) { if (!m) { v = 0; break; } }
        else if (m) { v = 1; break; }
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
        if (erode) { if (!m) { v = 0; break; } }
        else if (m) { v = 1; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/* ------------------------------------------------------------- Fond estimé */

function estimateBackground(data, w, h) {
  const band = Math.max(3, Math.round(Math.min(w, h) * 0.03));
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

/* -------------------------------------------------------------- Détection  */

function detectBlobs(imageData, opts) {
  const { width: w, height: h, data } = imageData;
  const n = w * h;

  const bgLab = estimateBackground(data, w, h);

  // 1. masque premier plan + Lab mémorisé
  const labL = new Float32Array(n), labA = new Float32Array(n), labB = new Float32Array(n);
  const raw = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    labL[i] = lab[0]; labA[i] = lab[1]; labB[i] = lab[2];
    raw[i] = deltaE(lab, bgLab) > opts.seuilFond ? 1 : 0;
  }

  // 2. ouverture morphologique : bruit enlevé + pièces jointives séparées
  const sep = opts.separation;
  let mask = morph(raw, w, h, 1, true);
  if (sep > 1) mask = morph(mask, w, h, sep - 1, true);
  mask = morph(mask, w, h, sep, false);

  // 3. masque « coeur » pour échantillonner la couleur sans les bords flous
  const core = morph(mask, w, h, 2, true);

  // 4. teintes dominantes du premier plan : deux pièces de couleurs
  //    différentes qui se touchent doivent rester deux pièces
  const zone = new Uint8Array(n); // 0 = fond, sinon index de teinte + 1
  let teintes = [];
  if (opts.parCouleur !== false) {
    const tol = Math.max(14, opts.tolerance || 18);
    for (let i = 0; i < n; i += 3) {
      if (!core[i]) continue;
      const L = labL[i], A = labA[i], B = labB[i];
      let best = -1, bestD = Infinity;
      for (let k = 0; k < teintes.length; k++) {
        const t = teintes[k];
        const d = deltaE([L, A, B], [t.L / t.n, t.A / t.n, t.B / t.n]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0 && bestD <= tol) {
        const t = teintes[best];
        t.L += L; t.A += A; t.B += B; t.n++;
      } else if (teintes.length < 14) {
        teintes.push({ L, A, B, n: 1 });
      }
    }
    teintes = teintes.filter(t => t.n >= 8).map(t => [t.L / t.n, t.A / t.n, t.B / t.n]);

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
  const useZones = teintes.length > 1;

  // 5. composantes connexes (4-connexité, sans franchir une frontière de teinte)
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

    let area = 0, sx = 0, sy = 0;
    let cr = 0, cg = 0, cb = 0, cn = 0;
    let ar = 0, ag = 0, ab = 0;
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

      const ok = q2 => mask[q2] && !labels[q2] && (!useZones || zone[q2] === z);
      if (x > 0 && ok(p - 1)) { labels[p - 1] = current; stack[sp++] = p - 1; }
      if (x < w - 1 && ok(p + 1)) { labels[p + 1] = current; stack[sp++] = p + 1; }
      if (y > 0 && ok(p - w)) { labels[p - w] = current; stack[sp++] = p - w; }
      if (y < h - 1 && ok(p + w)) { labels[p + w] = current; stack[sp++] = p + w; }
    }

    const rgb = cn > 20
      ? [cr / cn, cg / cn, cb / cn]
      : [ar / area, ag / area, ab / area];

    comps.push({
      label: current, area,
      cx: sx / area, cy: sy / area,
      minX, maxX, minY, maxY,
      rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2])
    });
  }

  // 5. taille de référence = médiane des composantes non microscopiques
  const floor = Math.max(12, n * 0.00002);
  let sizes = comps.filter(c => c.area >= floor).map(c => c.area).sort((a, b) => a - b);
  if (!sizes.length) return { blobs: [], bgLab, medianArea: 0, w, h, warn: null };
  let median = sizes[sizes.length >> 1];

  // affiner : on recalcule la médiane sur les composantes plausibles
  const plausible = comps
    .filter(c => c.area >= median * 0.45 && c.area <= median * 2.5)
    .map(c => c.area).sort((a, b) => a - b);
  if (plausible.length > 2) median = plausible[plausible.length >> 1];

  // contre-mesure : si des pièces identiques sont alignées et collées, leur
  // surface médiane est celle du bloc. Le petit côté, lui, reste celui d'une pièce.
  const cands = comps.filter(c => c.area >= floor);
  if (cands.length >= 3) {
    const med = arr => { arr.sort((a, b) => a - b); return arr[arr.length >> 1]; };
    const cote = med(cands.map(c => Math.min(c.maxX - c.minX + 1, c.maxY - c.minY + 1)));
    const rho = med(cands.map(c => c.area / ((c.maxX - c.minX + 1) * (c.maxY - c.minY + 1))));
    const estime = cote * cote * rho;
    if (estime > floor * 2 && estime < median * 0.7) median = estime;
  }

  const minArea = median * opts.tailleMin;

  const blobs = [];
  let fusionMax = 1;
  comps.forEach(c => {
    if (c.area < minArea) return;
    let count = 1;
    const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
    const allonge = Math.max(bw, bh) / Math.min(bw, bh);
    const remplissage = c.area / (bw * bh);
    const ratio = c.area / median;
    // une tache n'est découpée que si sa forme trahit une fusion :
    // allongée, contour irrégulier, ou franchement trop grande pour une pièce
    if (ratio > 1.55 && (allonge >= 1.6 || remplissage < 0.75 || ratio >= 2.6)) {
      count = Math.max(1, Math.round(ratio));
      if (count > fusionMax) fusionMax = count;
    }
    blobs.push({ ...c, count, excluded: false });
  });

  blobs.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  blobs.forEach((b, i) => { b.id = i; });

  let warn = null;
  const totalFg = blobs.reduce((s, b) => s + b.area, 0);
  if (blobs.length <= 3 && totalFg > n * 0.08) {
    warn = "Les pièces forment un seul bloc : la taille d'une pièce n'a pas pu être déduite, donc le total est faux. Espace-les un peu et refais la photo.";
  } else if (fusionMax >= 4) {
    warn = `Jusqu'à ${fusionMax} pièces se touchent à un même endroit. À ces endroits le nombre est estimé d'après la surface — vérifie les pastilles chiffrées.`;
  }

  return { blobs, bgLab, medianArea: median, w, h, warn, teintes: teintes.length };
}

/* ------------------------------------------------- Regroupement par couleur */

function groupBlobs(blobs, refs, tolerance) {
  const actifs = blobs.filter(b => !b.excluded);

  if (refs && refs.length) {
    const groups = refs.map(r => ({
      key: r.id, name: r.name, rgb: r.rgb, count: 0, blobs: [], expected: r.expected, fromRef: true
    }));
    const orphan = { key: '__autre', name: 'Non reconnu', rgb: [140, 140, 140], count: 0, blobs: [], expected: null, fromRef: false };

    actifs.forEach(b => {
      let best = -1, bestD = Infinity;
      refs.forEach((r, i) => {
        const d = deltaE(b.lab, r.lab);
        if (d < bestD) { bestD = d; best = i; }
      });
      const g = bestD <= tolerance ? groups[best] : orphan;
      g.count += b.count; g.blobs.push(b); b.groupKey = g.key;
    });

    const out = groups.filter(g => g.count > 0);
    if (orphan.count > 0) out.push(orphan);
    return out;
  }

  // regroupement automatique
  const clusters = [];
  actifs.forEach(b => {
    let best = null, bestD = Infinity;
    clusters.forEach(c => {
      const d = deltaE(b.lab, c.lab);
      if (d < bestD) { bestD = d; best = c; }
    });
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
    c.name = '';
    c.expected = null;
    c.fromRef = false;
    c.blobs.forEach(b => { b.groupKey = c.key; });
  });

  return clusters.sort((a, b) => b.count - a.count);
}

/* =========================================================== COMPOSANT PAGE */

export default function ComptagePhoto() {
  const [darkMode, setDarkMode] = useState(false);

  const [profiles, setProfiles] = useState({});
  const [currentGame, setCurrentGame] = useState('');
  const [newGameName, setNewGameName] = useState('');

  const [imageBitmap, setImageBitmap] = useState(null);
  const [result, setResult] = useState(null);
  const [groups, setGroups] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [adjust, setAdjust] = useState({});

  const [opts, setOpts] = useState({
    seuilFond: 22,
    separation: 1,
    tailleMin: 0.35,
    tolerance: 18,
    resolution: 900,
    parCouleur: true
  });

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const workRef = useRef(null);

  /* ---- init ---- */
  useEffect(() => {
    setDarkMode(localStorage.getItem('darkMode') === 'true');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProfiles(JSON.parse(saved));
    } catch (e) { console.error('Profils illisibles', e); }
  }, []);

  const persist = (next) => {
    setProfiles(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const refs = currentGame && profiles[currentGame] ? profiles[currentGame].refs : null;

  /* ---- chargement photo ---- */
  const loadFile = async (file) => {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    setGroups([]);
    setAdjust({});
    try {
      let bmp;
      if (typeof createImageBitmap === 'function') {
        try {
          bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        } catch {
          bmp = await createImageBitmap(file);
        }
      } else {
        bmp = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = URL.createObjectURL(file);
        });
      }
      setImageBitmap(bmp);
      await runAnalysis(bmp, opts);
    } catch (e) {
      console.error(e);
      flash("Impossible de lire cette image");
      setAnalyzing(false);
    }
  };

  /* ---- analyse ---- */
  const runAnalysis = useCallback(async (bmp, options) => {
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 30));
    try {
      const srcW = bmp.width || bmp.naturalWidth;
      const srcH = bmp.height || bmp.naturalHeight;
      const scale = Math.min(1, options.resolution / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));

      let cv = workRef.current;
      if (!cv) { cv = document.createElement('canvas'); workRef.current = cv; }
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      const res = detectBlobs(imageData, options);
      setResult(res);
      setGroups(groupBlobs(res.blobs, refs, options.tolerance));
    } catch (e) {
      console.error(e);
      flash("L'analyse a échoué");
    }
    setAnalyzing(false);
  }, [refs]);

  const reanalyse = () => { if (imageBitmap) runAnalysis(imageBitmap, opts); };

  const regroup = (nextBlobs) => {
    if (!result) return;
    const blobs = nextBlobs || result.blobs;
    setResult({ ...result, blobs });
    setGroups(groupBlobs(blobs, refs, opts.tolerance));
  };

  /* ---- rendu du calque ---- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !imageBitmap || !result) return;
    const { w, h } = result;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(imageBitmap, 0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);

    const colorOf = {};
    groups.forEach(g => { colorOf[g.key] = cssRgb(g.rgb); });

    const r = Math.max(9, Math.sqrt(result.medianArea) * 0.30);
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    result.blobs.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      if (b.excluded) {
        ctx.fillStyle = 'rgba(30,30,30,0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.95)';
        ctx.lineWidth = Math.max(2, r * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.cx - r * 0.5, b.cy - r * 0.5);
        ctx.lineTo(b.cx + r * 0.5, b.cy + r * 0.5);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = colorOf[b.groupKey] || '#888';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.stroke();
      if (b.count > 1) {
        ctx.fillStyle = isLight(b.rgb) ? '#111' : '#fff';
        ctx.fillText(String(b.count), b.cx, b.cy + 1);
      }
    });
  }, [imageBitmap, result, groups]);

  const onCanvasClick = (e) => {
    if (!result) return;
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cv.width / rect.width);
    const y = (e.clientY - rect.top) * (cv.height / rect.height);
    let best = null, bestD = Infinity;
    result.blobs.forEach(b => {
      const d = (b.cx - x) ** 2 + (b.cy - y) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    });
    const tol = Math.max(result.medianArea, 400);
    if (!best || bestD > tol * 4) return;
    const blobs = result.blobs.map(b => b.id === best.id ? { ...b, excluded: !b.excluded } : b);
    regroup(blobs);
  };

  /* ---- totaux ---- */
  const totalFor = (g) => g.count + (adjust[g.key] || 0);
  const total = groups.reduce((s, g) => s + totalFor(g), 0);

  /* ---- profils ---- */
  const createGame = () => {
    const name = newGameName.trim();
    if (!name) return;
    if (profiles[name]) { flash('Ce jeu existe déjà'); setCurrentGame(name); return; }
    persist({ ...profiles, [name]: { refs: [], createdAt: Date.now() } });
    setCurrentGame(name);
    setNewGameName('');
    flash(`Jeu « ${name} » créé`);
  };

  const saveAsReferences = () => {
    if (!currentGame) { flash("Choisis d'abord un jeu"); return; }
    const named = groups.filter(g => g.key !== '__autre');
    if (!named.length) { flash('Rien à enregistrer'); return; }
    if (named.some(g => !g.name.trim())) { flash('Donne un nom à chaque groupe'); return; }

    const newRefs = named.map((g, i) => ({
      id: 'r' + Date.now() + '_' + i,
      name: g.name.trim(),
      rgb: g.rgb.map(v => Math.round(v)),
      lab: rgbToLab(g.rgb[0], g.rgb[1], g.rgb[2]),
      expected: totalFor(g)
    }));

    persist({ ...profiles, [currentGame]: { ...profiles[currentGame], refs: newRefs } });
    flash(`${newRefs.length} références enregistrées pour ${currentGame}`);
  };

  const deleteRefs = () => {
    if (!currentGame) return;
    persist({ ...profiles, [currentGame]: { ...profiles[currentGame], refs: [] } });
    flash('Références effacées');
  };

  const deleteGame = (name) => {
    const next = { ...profiles };
    delete next[name];
    persist(next);
    if (currentGame === name) setCurrentGame('');
  };

  const setGroupName = (key, value) => {
    setGroups(gs => gs.map(g => g.key === key ? { ...g, name: value } : g));
  };

  const copyResult = () => {
    const lignes = groups.map(g => `${g.name || 'Groupe'} : ${totalFor(g)}`).join('\n');
    const txt = `${currentGame || 'Comptage'} — ${total} élément${total > 1 ? 's' : ''}\n${lignes}`;
    navigator.clipboard?.writeText(txt).then(
      () => flash('Résultat copié'),
      () => flash('Copie impossible')
    );
  };

  /* ---- styles ---- */
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const txt = darkMode ? 'text-gray-100' : 'text-gray-800';
  const sub = darkMode ? 'text-gray-400' : 'text-gray-500';
  const field = darkMode
    ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-2xl">
          {toast}
        </div>
      )}

      <div className="py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* En-tête */}
          <div className={`${card} border rounded-2xl shadow-xl p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className={`p-2 rounded-xl ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                  title="Retour"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <div>
                  <h1 className={`text-2xl font-bold ${txt}`}>Comptage photo</h1>
                  <p className={`text-sm ${sub}`}>Compte les pièces d'un jeu à partir d'une photo</p>
                </div>
              </div>
              <button
                onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem('darkMode', String(v)); }}
                className={`p-2.5 rounded-xl ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-700'}`}
                title={darkMode ? 'Mode clair' : 'Mode sombre'}
              >
                {darkMode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Jeu / profil */}
          <div className={`${card} border rounded-2xl shadow-xl p-5 space-y-3`}>
            <h2 className={`font-semibold ${txt}`}>Jeu</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCurrentGame('')}
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  currentGame === ''
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Aucun (détection libre)
              </button>
              {Object.keys(profiles).sort().map(name => (
                <span key={name} className="relative group">
                  <button
                    onClick={() => setCurrentGame(name)}
                    className={`pl-3 pr-7 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      currentGame === name
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {name}
                    {profiles[name].refs?.length > 0 && (
                      <span className="ml-1.5 opacity-70">· {profiles[name].refs.length}</span>
                    )}
                  </button>
                  <button
                    onClick={() => deleteGame(name)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-xs"
                    title="Supprimer ce jeu"
                  >✕</button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newGameName}
                onChange={e => setNewGameName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGame()}
                placeholder="Nom d'un nouveau jeu (ex : Azul)"
                className={`flex-1 px-3 py-2 rounded-xl border text-sm ${field}`}
              />
              <button onClick={createGame} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                Ajouter
              </button>
            </div>

            {currentGame && refs && refs.length > 0 && (
              <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${sub}`}>Références enregistrées</span>
                  <button onClick={deleteRefs} className="text-xs text-red-500 hover:underline">Effacer</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {refs.map(r => (
                    <div key={r.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                      <span className="w-4 h-4 rounded-full border border-black/20" style={{ background: cssRgb(r.rgb) }} />
                      <span className={txt}>{r.name}</span>
                      <span className={sub}>attendu {r.expected}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo */}
          <div className={`${card} border rounded-2xl shadow-xl p-5 space-y-4`}>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => loadFile(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                {imageBitmap ? 'Nouvelle photo' : 'Prendre une photo'}
              </button>
              {imageBitmap && (
                <button
                  onClick={reanalyse}
                  disabled={analyzing}
                  className={`px-4 py-3 rounded-xl font-medium border ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} disabled:opacity-50`}
                >
                  Relancer l'analyse
                </button>
              )}
              <button
                onClick={() => setShowSettings(s => !s)}
                className={`px-4 py-3 rounded-xl font-medium border ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Réglages
              </button>
            </div>

            {!imageBitmap && (
              <p className={`text-sm leading-relaxed ${sub}`}>
                Étale les pièces en une seule couche sur un fond uni bien contrasté, à plat et vues du dessus,
                en laissant une marge libre tout autour. C'est ce qui fait la différence entre un comptage juste
                et un comptage approximatif.
              </p>
            )}

            {showSettings && (
              <div className={`rounded-xl p-4 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <Slider label="Sensibilité au fond" hint="Plus bas = détecte des pièces peu contrastées, mais attrape les ombres"
                  value={opts.seuilFond} min={8} max={45} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, seuilFond: v }))} />
                <Slider label="Séparation" hint="Augmente si des pièces collées sont comptées comme une seule"
                  value={opts.separation} min={1} max={5} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, separation: v }))} />
                <Slider label="Taille minimale" hint="Part de la taille moyenne en dessous de laquelle on ignore une tache"
                  value={opts.tailleMin} min={0.1} max={0.9} step={0.05} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tailleMin: v }))} />
                <Slider label="Tolérance de couleur" hint="Plus bas = sépare des teintes proches en groupes distincts"
                  value={opts.tolerance} min={6} max={45} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tolerance: v }))} />
                <Slider label="Résolution d'analyse" hint="Plus haut = plus précis mais plus lent sur mobile"
                  value={opts.resolution} min={500} max={1600} step={100} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, resolution: v }))} />
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.parCouleur}
                    onChange={e => setOpts(o => ({ ...o, parCouleur: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-blue-600"
                  />
                  <span>
                    <span className={`text-sm font-medium block ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Séparer par couleur</span>
                    <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Deux pièces de couleurs différentes qui se touchent restent deux pièces. À décocher pour des pièces multicolores ou illustrées.
                    </span>
                  </span>
                </label>
                <button onClick={reanalyse} disabled={!imageBitmap || analyzing}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-40">
                  Appliquer
                </button>
              </div>
            )}

            {analyzing && (
              <div className={`flex items-center gap-3 text-sm ${sub}`}>
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Analyse en cours…
              </div>
            )}

            {imageBitmap && (
              <div>
                <canvas
                  ref={canvasRef}
                  onClick={onCanvasClick}
                  className="w-full rounded-xl cursor-pointer"
                  style={{ touchAction: 'manipulation' }}
                />
                {result && (
                  <p className={`text-xs mt-2 ${sub}`}>
                    Touche une pastille pour l'exclure du comptage, touche-la à nouveau pour la remettre.
                    Un chiffre dans une pastille signifie que plusieurs pièces se touchent à cet endroit.
                  </p>
                )}
              </div>
            )}

            {result?.warn && (
              <div className="rounded-xl px-4 py-3 text-sm bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {result.warn}
              </div>
            )}
          </div>

          {/* Résultat */}
          {result && groups.length > 0 && (
            <div className={`${card} border rounded-2xl shadow-xl p-5 space-y-4`}>
              <div className="flex items-baseline justify-between">
                <h2 className={`font-semibold ${txt}`}>Résultat</h2>
                <div className={`text-3xl font-bold ${txt}`}>
                  {total}<span className={`text-sm font-normal ml-2 ${sub}`}>éléments</span>
                </div>
              </div>

              <div className="space-y-2">
                {groups.map(g => {
                  const n = totalFor(g);
                  const ecart = g.expected != null ? n - g.expected : null;
                  return (
                    <div key={g.key} className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      <span className="w-7 h-7 rounded-lg shrink-0 border border-black/20" style={{ background: cssRgb(g.rgb) }} />
                      <input
                        value={g.name}
                        onChange={e => setGroupName(g.key, e.target.value)}
                        placeholder="Nommer cette couleur"
                        className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-sm ${field}`}
                      />
                      {ecart != null && (
                        <span className={`text-xs font-medium shrink-0 ${ecart === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {ecart === 0 ? '✓' : (ecart > 0 ? `+${ecart}` : ecart)}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setAdjust(a => ({ ...a, [g.key]: (a[g.key] || 0) - 1 }))}
                          className={`w-7 h-7 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>−</button>
                        <span className={`w-9 text-center font-bold ${txt}`}>{n}</span>
                        <button onClick={() => setAdjust(a => ({ ...a, [g.key]: (a[g.key] || 0) + 1 }))}
                          className={`w-7 h-7 rounded-lg text-sm ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={copyResult}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Copier le résultat
                </button>
                {currentGame && (
                  <button onClick={saveAsReferences}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white">
                    Enregistrer comme références de {currentGame}
                  </button>
                )}
              </div>

              {currentGame && (!refs || !refs.length) && (
                <p className={`text-xs leading-relaxed ${sub}`}>
                  Nomme chaque groupe puis enregistre-le : la prochaine photo de {currentGame} reprendra
                  automatiquement ces noms et signalera l'écart avec les quantités attendues.
                </p>
              )}
            </div>
          )}

          {result && groups.length === 0 && !analyzing && (
            <div className={`${card} border rounded-2xl shadow-xl p-5`}>
              <p className={`text-sm ${sub}`}>
                Aucune pièce détectée. Le fond est probablement trop proche de la couleur des pièces :
                baisse la sensibilité au fond dans les réglages, ou refais la photo sur un fond plus contrasté.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Sous-composant */

function Slider({ label, hint, value, min, max, step, onChange, darkMode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{label}</label>
        <span className={`text-sm tabular-nums ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{hint}</p>
    </div>
  );
}
