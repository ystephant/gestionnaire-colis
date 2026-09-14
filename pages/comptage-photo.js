import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================================
   COMPTAGE PHOTO — comptage de pièces de jeu par photo, piloté par gabarits
   Page autonome. Aucune dépendance npm, aucun appel réseau, aucune table.
   Profils stockés dans localStorage (clé: meeple_detect_profiles)

   Une pièce est une silhouette pleine, pas un assemblage de couleurs : le
   motif imprimé dessus est rebouché avant comptage. Un gabarit se crée en
   entourant une pièce à la main, avec un lissage réglable.
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

function deltaFond(a, b) {
  const dl = (a[0] - b[0]) * 0.5, da = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

/* Comparaison à un gabarit : une pièce à l'ombre garde sa teinte mais perd en
   clarté, donc on remet la couleur du gabarit à la clarté observée. */
function deltaGab(lab, gLab) {
  let k = 1;
  if (gLab[0] > 8) k = Math.min(1.5, Math.max(0.6, lab[0] / gLab[0]));
  const dl = (lab[0] - gLab[0]) * 0.7;
  const da = lab[1] - gLab[1] * k;
  const db = lab[2] - gLab[2] * k;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/* Une ombre portée assombrit les trois canaux dans la même proportion, alors
   qu'une vraie pièce change aussi de teinte. C'est ce qui les distingue. */
function estOmbre(r, g, b, bg) {
  const kr = r / Math.max(1, bg[0]), kg = g / Math.max(1, bg[1]), kb = b / Math.max(1, bg[2]);
  const mx = Math.max(kr, kg, kb), mn = Math.min(kr, kg, kb);
  return mx <= 1.06 && mn >= 0.33 && mx / Math.max(0.01, mn) <= 1.16;
}

const cssRgb = rgb => `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;

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

/* Rebouche les trous internes : c'est ce qui transforme une tuile à motifs en
   une seule silhouette pleine au lieu d'une douzaine de morceaux. */
function remplirTrous(mask, w, h) {
  const out = Uint8Array.from(mask);
  const vu = new Uint8Array(w * h);
  const pile = new Int32Array(w * h);
  let sp = 0;
  const pousser = i => { if (!vu[i] && !mask[i]) { vu[i] = 1; pile[sp++] = i; } };
  for (let x = 0; x < w; x++) { pousser(x); pousser((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { pousser(y * w); pousser(y * w + w - 1); }
  while (sp > 0) {
    const p = pile[--sp];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) pousser(p - 1);
    if (x < w - 1) pousser(p + 1);
    if (y > 0) pousser(p - w);
    if (y < h - 1) pousser(p + w);
  }
  for (let i = 0; i < w * h; i++) if (!mask[i] && !vu[i]) out[i] = 1;
  return out;
}

/* Lissage du contour : 0 garde le détourage exact, 8 donne une silhouette
   très simplifiée qui ignore les creux et les échancrures. */
function lisser(mask, w, h, force) {
  let m = remplirTrous(mask, w, h);
  if (force > 0) {
    m = morph(m, w, h, force, false);
    m = morph(m, w, h, force, true);
    m = morph(m, w, h, Math.max(1, force - 1), true);
    m = morph(m, w, h, Math.max(1, force - 1), false);
    m = remplirTrous(m, w, h);
  }
  return m;
}

function plusGrandeComposante(mask, w, h) {
  const lab = new Int32Array(w * h);
  const pile = new Int32Array(w * h);
  let cur = 0, meilleur = 0, tailleMax = 0;
  const tailles = [0];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || lab[s]) continue;
    cur++;
    let sp = 0, n = 0;
    pile[sp++] = s; lab[s] = cur;
    while (sp > 0) {
      const p = pile[--sp]; n++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = cur; pile[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = cur; pile[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !lab[p - w]) { lab[p - w] = cur; pile[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !lab[p + w]) { lab[p + w] = cur; pile[sp++] = p + w; }
    }
    tailles[cur] = n;
    if (n > tailleMax) { tailleMax = n; meilleur = cur; }
  }
  const out = new Uint8Array(w * h);
  if (!meilleur) return out;
  for (let i = 0; i < w * h; i++) if (lab[i] === meilleur) out[i] = 1;
  return out;
}

/* ------------------------------------------------------- Descripteurs forme */

function enveloppe(pts) {
  if (pts.length < 3) return pts;
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas = [];
  for (const q of p) { while (bas.length >= 2 && cross(bas[bas.length - 2], bas[bas.length - 1], q) <= 0) bas.pop(); bas.push(q); }
  const haut = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (haut.length >= 2 && cross(haut[haut.length - 2], haut[haut.length - 1], q) <= 0) haut.pop();
    haut.push(q);
  }
  bas.pop(); haut.pop();
  return bas.concat(haut);
}

function airePolygone(h) {
  let a = 0;
  for (let i = 0; i < h.length; i++) {
    const j = (i + 1) % h.length;
    a += h[i][0] * h[j][1] - h[j][0] * h[i][1];
  }
  return Math.abs(a) / 2;
}

/* Quatre mesures qui ne bougent pas quand la pièce tourne (moins de 4 % de
   variation entre 0° et 90° sur route, maison, wagon, meeple). */
function descripteurs(mask, w, h) {
  let area = 0, sx = 0, sy = 0;
  for (let i = 0; i < w * h; i++) if (mask[i]) { area++; sx += i % w; sy += (i / w) | 0; }
  if (area < 12) return null;
  const cx = sx / area, cy = sy / area;
  let m20 = 0, m02 = 0, m11 = 0;
  const bord = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const dx = x - cx, dy = y - cy;
      m20 += dx * dx; m02 += dy * dy; m11 += dx * dy;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) bord.push([x, y]);
    }
  }
  m20 /= area; m02 /= area; m11 /= area;
  const tr = m20 + m02, det = m20 * m02 - m11 * m11;
  const disc = Math.max(0, tr * tr / 4 - det);
  const l1 = tr / 2 + Math.sqrt(disc), l2 = Math.max(1e-6, tr / 2 - Math.sqrt(disc));
  const env = enveloppe(bord);
  const aireEnv = airePolygone(env) || area;
  let rmax = 0;
  for (const p of bord) {
    const d = (p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy);
    if (d > rmax) rmax = d;
  }
  return {
    area, cx, cy,
    elong: Math.sqrt(l1 / l2),
    etalement: tr / area,
    solidite: Math.min(1, area / aireEnv),
    rayonRel: Math.sqrt(rmax) / Math.sqrt(area / Math.PI)
  };
}

function scoreGabarit(b, g, echelle, tolCouleur, poidsForme) {
  const dc = deltaGab(b.lab, g.lab) / Math.max(1, tolCouleur);
  let s = dc * dc;
  if (g.elong && poidsForme > 0) {
    const f = [
      Math.log(Math.max(1e-3, b.elong / g.elong)) / 0.24,
      (b.etalement - g.etalement) / (0.13 * g.etalement + 0.006),
      (b.solidite - g.solidite) / 0.10,
      (b.rayonRel - g.rayonRel) / 0.16
    ];
    let sf = 0;
    for (const v of f) sf += v * v;
    s += poidsForme * sf / 4;
    if (echelle && g.area) {
      const dk = Math.log(Math.max(1e-3, b.area / (g.area * echelle))) / 0.32;
      s += poidsForme * dk * dk * 0.8;
    }
  }
  return Math.sqrt(s);
}

/* -------------------------------------------------------------- Estimations */

function estimateBackground(data, w, h, x0, y0, rw, rh) {
  x0 = x0 || 0; y0 = y0 || 0; rw = rw || w; rh = rh || h;
  const band = Math.max(3, Math.round(Math.min(rw, rh) * 0.05));
  const R = [], G = [], B = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]);
  };
  for (let y = y0; y < y0 + rh; y += 2) {
    for (let x = x0; x < Math.min(x0 + band, x0 + rw); x += 2) push(x, y);
    for (let x = Math.max(x0, x0 + rw - band); x < x0 + rw; x += 2) push(x, y);
  }
  for (let x = x0; x < x0 + rw; x += 2) {
    for (let y = y0; y < Math.min(y0 + band, y0 + rh); y += 2) push(x, y);
    for (let y = Math.max(y0, y0 + rh - band); y < y0 + rh; y += 2) push(x, y);
  }
  const med = arr => { arr.sort((a, b) => a - b); return arr[arr.length >> 1] || 0; };
  const rgb = [med(R), med(G), med(B)];
  return { rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]) };
}

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

/* ------------------------------------------- Masque premier plan / arrière */

function masqueSilhouette(imageData, opts, bg, x0, y0, rw, rh) {
  const { width: w, data } = imageData;
  const n = rw * rh;
  const m = new Uint8Array(n);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const si = ((y0 + y) * w + (x0 + x)) * 4;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      if (opts.ignorerOmbres && estOmbre(r, g, b, bg.rgb)) continue;
      if (deltaFond(rgbToLab(r, g, b), bg.lab) > opts.seuilFond) m[y * rw + x] = 1;
    }
  }
  let out = m;
  if (opts.fermeture > 0) {
    out = morph(out, rw, rh, opts.fermeture, false);
    out = morph(out, rw, rh, opts.fermeture, true);
  }
  out = morph(out, rw, rh, opts.separation, true);
  out = morph(out, rw, rh, opts.separation, false);
  return remplirTrous(out, rw, rh);
}

/* Extraction d'une pièce dans le rectangle tracé par l'utilisateur. */
function extraireDansRect(imageData, rect, opts, lissage) {
  const { x0, y0, w: rw, h: rh } = rect;
  const bg = estimateBackground(imageData.data, imageData.width, imageData.height, x0, y0, rw, rh);
  let m = masqueSilhouette(imageData, { ...opts, fermeture: Math.max(2, opts.fermeture) }, bg, x0, y0, rw, rh);
  m = plusGrandeComposante(m, rw, rh);
  return lisser(m, rw, rh, lissage);
}

/* --------------------------------------------------------------- Détection */

function detectPieces(imageData, opts, gabarits) {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  const gabs = gabarits && gabarits.length ? gabarits : null;

  const bg = opts.fondManuel
    ? { rgb: opts.fondManuel.rgb, lab: opts.fondManuel.lab }
    : estimateBackground(data, w, h);

  const mask = masqueSilhouette(imageData, opts, bg, 0, 0, w, h);

  /* Zones de couleur : seulement si l'utilisateur le demande. Sur des pièces
     à motifs, ce découpage casserait chaque pièce en morceaux. */
  const zone = new Uint8Array(n);
  let teintes = [];
  if (opts.parCouleur) {
    const core = morph(mask, w, h, 2, true);
    const tol = Math.max(14, opts.tolerance);
    const acc = [];
    for (let i = 0; i < n; i += 3) {
      if (!core[i]) continue;
      const p = i * 4;
      const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
      let best = -1, bestD = Infinity;
      for (let k = 0; k < acc.length; k++) {
        const t = acc[k];
        const d = deltaE(lab, [t.L / t.n, t.A / t.n, t.B / t.n]);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best >= 0 && bestD <= tol) { const t = acc[best]; t.L += lab[0]; t.A += lab[1]; t.B += lab[2]; t.n++; }
      else if (acc.length < 12) acc.push({ L: lab[0], A: lab[1], B: lab[2], n: 1 });
    }
    teintes = acc.filter(t => t.n >= 10).map(t => [t.L / t.n, t.A / t.n, t.B / t.n]);
    if (teintes.length > 1) {
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue;
        const p = i * 4;
        const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
        let best = 0, bestD = Infinity;
        for (let k = 0; k < teintes.length; k++) {
          const d = deltaE(lab, teintes[k]);
          if (d < bestD) { bestD = d; best = k; }
        }
        zone[i] = best + 1;
      }
    }
  }
  const useZones = teintes.length > 1;

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

    let area = 0, sx = 0, sy = 0, ar = 0, ag = 0, ab = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      const q = p * 4;
      ar += data[q]; ag += data[q + 1]; ab += data[q + 2];
      const ok = t => mask[t] && !labels[t] && (!useZones || zone[t] === z);
      if (x > 0 && ok(p - 1)) { labels[p - 1] = current; stack[sp++] = p - 1; }
      if (x < w - 1 && ok(p + 1)) { labels[p + 1] = current; stack[sp++] = p + 1; }
      if (y > 0 && ok(p - w)) { labels[p - w] = current; stack[sp++] = p - w; }
      if (y < h - 1 && ok(p + w)) { labels[p + w] = current; stack[sp++] = p + w; }
    }

    const rgb = [ar / area, ag / area, ab / area];
    comps.push({
      label: current, area, cx: sx / area, cy: sy / area,
      minX, maxX, minY, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1,
      rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2])
    });
  }

  const plancher = Math.max(24, n * 0.00006);
  const retenus = comps.filter(c => c.area >= plancher);
  let rejets = comps.length - retenus.length;

  if (!retenus.length) {
    return { blobs: [], labels, mask, bg, w, h, warn: null, rejets };
  }

  retenus.forEach(c => {
    const d = descripteursDeLabel(labels, w, c);
    if (d) Object.assign(c, d);
    else { c.elong = 1; c.etalement = 0.166; c.solidite = 1; c.rayonRel = 1.2; }
  });

  const blobs = [];
  let fusionMax = 1;

  if (gabs) {
    const pf = opts.poidsForme;
    retenus.forEach(c => {
      let best = 0, bestS = Infinity;
      gabs.forEach((g, k) => {
        const s = scoreGabarit(c, g, 0, opts.tolGabarit, pf);
        if (s < bestS) { bestS = s; best = k; }
      });
      c.gab = best; c.score = bestS;
    });

    const bons = retenus.filter(c => c.score <= opts.seuilForme && gabs[c.gab].area);
    const parSession = {};
    bons.forEach(c => {
      const g = gabs[c.gab];
      const s = g.session || 'x';
      (parSession[s] = parSession[s] || []).push(c.area / g.area);
    });
    const global = median(bons.map(c => c.area / gabs[c.gab].area)) || 1;
    const echelleDe = g => {
      const l = parSession[g.session || 'x'];
      return l && l.length >= 2 ? median(l) : global;
    };

    retenus.forEach(c => {
      let best = 0, bestS = Infinity;
      gabs.forEach((g, k) => {
        const s = scoreGabarit(c, g, echelleDe(g), opts.tolGabarit, pf);
        if (s < bestS) { bestS = s; best = k; }
      });
      c.gab = best; c.score = bestS;
    });

    retenus.forEach(c => {
      const g = gabs[c.gab];
      const attendue = (g.area || 0) * echelleDe(g);
      const ratio = attendue ? c.area / attendue : 1;
      if (attendue && c.area < attendue * opts.tailleMin) { rejets++; return; }
      if (opts.ignorerBords && (c.minX <= 1 || c.minY <= 1 || c.maxX >= w - 2 || c.maxY >= h - 2)) { rejets++; return; }
      let count = 1;
      if (c.score > opts.seuilForme) {
        if (ratio >= 1.6) { count = Math.round(ratio); if (count > fusionMax) fusionMax = count; }
        else { rejets++; return; }
      }
      blobs.push({ ...c, count, excluded: false, manual: false });
    });
  } else {
    let u = modeArea(retenus.map(c => c.area));
    const cote = median(retenus.map(c => Math.min(c.bw, c.bh)));
    const rho = median(retenus.map(c => c.area / (c.bw * c.bh)));
    const est = cote * cote * rho;
    if (est > plancher * 2 && est < u * 0.7) u = est;

    retenus.forEach(c => {
      if (!u || c.area < u * opts.tailleMin) { rejets++; return; }
      if (opts.ignorerBords && (c.minX <= 1 || c.minY <= 1 || c.maxX >= w - 2 || c.maxY >= h - 2)) { rejets++; return; }
      let count = 1;
      const ratio = c.area / u;
      const allonge = Math.max(c.bw, c.bh) / Math.min(c.bw, c.bh);
      if (ratio > 1.55 && (allonge >= 1.6 || c.solidite < 0.82 || ratio >= 2.6)) {
        count = Math.max(1, Math.round(ratio));
        if (count > fusionMax) fusionMax = count;
      }
      blobs.push({ ...c, count, excluded: false, manual: false });
    });
  }

  blobs.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  blobs.forEach((b, i) => { b.id = i; });

  let warn = null;
  if (fusionMax >= 4) {
    warn = `Jusqu'à ${fusionMax} pièces se touchent à un même endroit — vérifie les cadres chiffrés.`;
  }

  return { blobs, labels, mask, bg, w, h, warn, rejets };
}

function descripteursDeLabel(labels, w, c) {
  const rw = c.bw + 2, rh = c.bh + 2;
  const m = new Uint8Array(rw * rh);
  for (let y = 0; y < c.bh; y++) {
    for (let x = 0; x < c.bw; x++) {
      if (labels[(c.minY + y) * w + (c.minX + x)] === c.label) m[(y + 1) * rw + (x + 1)] = 1;
    }
  }
  return descripteurs(m, rw, rh);
}

/* --------------------------------------------------- Vignette d'une pièce */

function vignetteDepuisMasque(imageData, ox, oy, mask, rw, rh, maxSize = 110) {
  let minX = rw, maxX = -1, minY = rh, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (!mask[y * rw + x]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const cv = document.createElement('canvas');
  cv.width = bw; cv.height = bh;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!mask[(y + minY) * rw + (x + minX)]) continue;
      const si = ((oy + y + minY) * imageData.width + (ox + x + minX)) * 4;
      const di = (y * bw + x) * 4;
      out.data[di] = imageData.data[si];
      out.data[di + 1] = imageData.data[si + 1];
      out.data[di + 2] = imageData.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const scale = Math.min(1, maxSize / Math.max(bw, bh));
  if (scale < 1) {
    const s = document.createElement('canvas');
    s.width = Math.max(1, Math.round(bw * scale));
    s.height = Math.max(1, Math.round(bh * scale));
    const sc = s.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(cv, 0, 0, s.width, s.height);
    return s.toDataURL('image/png');
  }
  return cv.toDataURL('image/png');
}

function couleurMoyenne(imageData, ox, oy, mask, rw, rh) {
  const coeur = morph(mask, rw, rh, 3, true);
  let r = 0, g = 0, b = 0, n = 0;
  const lire = m => {
    r = g = b = n = 0;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        if (!m[y * rw + x]) continue;
        const si = ((oy + y) * imageData.width + (ox + x)) * 4;
        r += imageData.data[si]; g += imageData.data[si + 1]; b += imageData.data[si + 2]; n++;
      }
    }
  };
  lire(coeur);
  if (n < 30) lire(mask);
  if (!n) return [128, 128, 128];
  return [r / n, g / n, b / n];
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
      let i = b.gab;
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

function imageDataVersCanvas(imgData) {
  const cv = document.createElement('canvas');
  cv.width = imgData.width; cv.height = imgData.height;
  cv.getContext('2d').putImageData(imgData, 0, 0);
  return cv;
}

/* ==================================================== SÉLECTION D'UNE PIÈCE */

function SelecteurPiece({ imgData, darkMode, onSelection, onFermer, nbFaits }) {
  const cvRef = useRef(null);
  const [rect, setRect] = useState(null);
  const debut = useRef(null);
  const fond = useRef(null);

  useEffect(() => { fond.current = imageDataVersCanvas(imgData); redraw(null); }, [imgData]);

  const redraw = r => {
    const cv = cvRef.current;
    if (!cv || !fond.current) return;
    cv.width = imgData.width; cv.height = imgData.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(fond.current, 0, 0);
    if (r) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.clearRect(r.x0, r.y0, r.w, r.h);
      ctx.drawImage(fond.current, r.x0, r.y0, r.w, r.h, r.x0, r.y0, r.w, r.h);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(2, cv.width / 300);
      ctx.strokeRect(r.x0, r.y0, r.w, r.h);
    }
  };

  const pos = e => {
    const cv = cvRef.current;
    const b = cv.getBoundingClientRect();
    const p = e.touches && e.touches[0] ? e.touches[0] : e;
    return [
      Math.max(0, Math.min(imgData.width - 1, (p.clientX - b.left) * (imgData.width / b.width))),
      Math.max(0, Math.min(imgData.height - 1, (p.clientY - b.top) * (imgData.height / b.height)))
    ];
  };

  const down = e => { e.preventDefault(); debut.current = pos(e); setRect(null); };
  const move = e => {
    if (!debut.current) return;
    e.preventDefault();
    const [x, y] = pos(e), [sx, sy] = debut.current;
    const r = { x0: Math.min(sx, x), y0: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
    setRect(r); redraw(r);
  };
  const up = e => {
    if (!debut.current) return;
    e.preventDefault();
    const [sx, sy] = debut.current;
    debut.current = null;
    let r = rect;
    if (!r || r.w < 12 || r.h < 12) {
      const c = Math.round(Math.min(imgData.width, imgData.height) * 0.28);
      r = { x0: sx - c / 2, y0: sy - c / 2, w: c, h: c };
    }
    r = {
      x0: Math.max(0, Math.round(r.x0)),
      y0: Math.max(0, Math.round(r.y0)),
      w: Math.round(r.w), h: Math.round(r.h)
    };
    r.w = Math.min(r.w, imgData.width - r.x0);
    r.h = Math.min(r.h, imgData.height - r.y0);
    if (r.w > 14 && r.h > 14) onSelection(r);
    setRect(null); redraw(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80">
      <div className={'w-full max-w-2xl rounded-2xl shadow-2xl p-4 space-y-3 max-h-full overflow-auto ' + (darkMode ? 'bg-gray-800' : 'bg-white')}>
        <h3 className={'font-semibold ' + (darkMode ? 'text-gray-100' : 'text-gray-800')}>Entoure une pièce</h3>
        <p className={'text-sm ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>
          Trace un cadre autour d'une seule pièce, en laissant un peu de fond tout autour.
          Recommence pour chaque type de pièce de ce jeu.
          {nbFaits > 0 && ` ${nbFaits} pièce${nbFaits > 1 ? 's' : ''} déjà prise${nbFaits > 1 ? 's' : ''}.`}
        </p>
        <canvas ref={cvRef}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
          className="w-full rounded-xl border border-black/20"
          style={{ touchAction: 'none', cursor: 'crosshair' }} />
        <button onClick={onFermer}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          J'ai fini
        </button>
      </div>
    </div>
  );
}

/* ========================================================= ÉDITEUR DE MASQUE */

function EditeurMasque({ imgData, region, maskBrut, lissageInit, darkMode, onValider, onAnnuler }) {
  const cvRef = useRef(null);
  const maskRef = useRef(null);
  const [lissage, setLissage] = useState(lissageInit);
  const [outil, setOutil] = useState('ajouter');
  const [taille, setTaille] = useState(6);
  const [tick, setTick] = useState(0);
  const dessine = useRef(false);
  const { x0, y0, w: rw, h: rh } = region;

  useEffect(() => {
    maskRef.current = lisser(maskBrut, rw, rh, lissage);
    setTick(t => t + 1);
  }, [lissage, maskBrut, rw, rh]);

  const redraw = useCallback(() => {
    const cv = cvRef.current;
    const m = maskRef.current;
    if (!cv || !m) return;
    cv.width = rw; cv.height = rh;
    const ctx = cv.getContext('2d');
    const out = ctx.createImageData(rw, rh);
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const si = ((y0 + y) * imgData.width + (x0 + x)) * 4;
        const di = (y * rw + x) * 4;
        if (m[y * rw + x]) {
          out.data[di] = imgData.data[si];
          out.data[di + 1] = imgData.data[si + 1];
          out.data[di + 2] = imgData.data[si + 2];
        } else {
          const damier = ((x >> 3) + (y >> 3)) & 1 ? 0.30 : 0.22;
          out.data[di] = imgData.data[si] * damier + 60;
          out.data[di + 1] = imgData.data[si + 1] * damier + 20;
          out.data[di + 2] = imgData.data[si + 2] * damier + 70;
        }
        out.data[di + 3] = 255;
      }
    }
    for (let y = 1; y < rh - 1; y++) {
      for (let x = 1; x < rw - 1; x++) {
        const i = y * rw + x;
        if (m[i] && (!m[i - 1] || !m[i + 1] || !m[i - rw] || !m[i + rw])) {
          const di = i * 4;
          out.data[di] = 255; out.data[di + 1] = 255; out.data[di + 2] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  }, [imgData, x0, y0, rw, rh]);

  useEffect(() => { redraw(); }, [redraw, tick]);

  const peindre = (cx, cy) => {
    const m = maskRef.current;
    const r = taille, v = outil === 'ajouter' ? 1 : 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(rh - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(rw - 1, cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) m[y * rw + x] = v;
      }
    }
    setTick(t => t + 1);
  };

  const pos = e => {
    const cv = cvRef.current;
    const b = cv.getBoundingClientRect();
    const p = e.touches && e.touches[0] ? e.touches[0] : e;
    return [
      Math.round((p.clientX - b.left) * (rw / b.width)),
      Math.round((p.clientY - b.top) * (rh / b.height))
    ];
  };
  const down = e => { e.preventDefault(); dessine.current = true; const [x, y] = pos(e); peindre(x, y); };
  const move = e => { if (!dessine.current) return; e.preventDefault(); const [x, y] = pos(e); peindre(x, y); };
  const up = () => { dessine.current = false; };

  const btn = actif => 'px-3 py-2 rounded-xl text-sm font-medium border ' + (actif
    ? 'bg-blue-600 border-blue-600 text-white'
    : darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80">
      <div className={'w-full max-w-lg rounded-2xl shadow-2xl p-4 space-y-3 max-h-full overflow-auto ' + (darkMode ? 'bg-gray-800' : 'bg-white')}>
        <h3 className={'font-semibold ' + (darkMode ? 'text-gray-100' : 'text-gray-800')}>Ajuster le détourage</h3>
        <p className={'text-sm ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>
          Ce qui est en clair sera retenu comme la pièce.
        </p>

        <canvas ref={cvRef}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
          className="w-full rounded-xl border border-black/20"
          style={{ imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }} />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={'text-sm font-medium ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>
              Finesse du détourage
            </label>
            <span className={'text-sm ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>
              {lissage === 0 ? 'exact' : lissage >= 7 ? 'très large' : lissage}
            </span>
          </div>
          <input type="range" min="0" max="10" value={lissage}
            onChange={e => setLissage(parseInt(e.target.value, 10))} className="w-full accent-blue-600" />
          <p className={'text-xs mt-0.5 ' + (darkMode ? 'text-gray-500' : 'text-gray-400')}>
            Vers la droite, la silhouette s'arrondit et ignore les creux. Attention, bouger ce curseur
            efface les retouches au pinceau.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setOutil('ajouter')} className={btn(outil === 'ajouter')}>Pinceau</button>
          <button onClick={() => setOutil('retirer')} className={btn(outil === 'retirer')}>Gomme</button>
          <button onClick={() => { maskRef.current = remplirTrous(maskRef.current, rw, rh); setTick(t => t + 1); }}
            className={btn(false)}>Boucher les trous</button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={'text-sm font-medium ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>Taille du pinceau</label>
            <span className={'text-sm ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>{taille}</span>
          </div>
          <input type="range" min="1" max="30" value={taille}
            onChange={e => setTaille(parseInt(e.target.value, 10))} className="w-full accent-blue-600" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => onValider(maskRef.current, lissage)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
            Valider
          </button>
          <button onClick={onAnnuler}
            className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + (darkMode ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600')}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
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
  const [selection, setSelection] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [edition, setEdition] = useState(null);

  const [opts, setOpts] = useState({
    seuilFond: 18,
    fermeture: 3,
    separation: 1,
    tailleMin: 0.5,
    tolerance: 18,
    tolGabarit: 26,
    poidsForme: 1,
    seuilForme: 1.9,
    resolution: 900,
    parCouleur: false,
    ignorerOmbres: true,
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
      const data = drawToImageData(bmp, 1100);
      setTplDraft({ imgData: data, session: 's' + Date.now(), items: [] });
      setSelection(true);
    } catch (e) {
      console.error(e); flash('Image illisible');
    }
    setTplBusy(false);
  };

  const ajouterSelection = rect => {
    try {
      const lissage = 2;
      const mask = extraireDansRect(tplDraft.imgData, rect, opts, lissage);
      const region = { x0: rect.x0, y0: rect.y0, w: rect.w, h: rect.h };
      const d = descripteurs(mask, rect.w, rect.h);
      if (!d) { flash('Rien de détecté dans ce cadre'); return; }
      const item = {
        key: 'k' + Date.now() + Math.random().toString(36).slice(2, 6),
        region, rect, maskBrut: extraireDansRect(tplDraft.imgData, rect, opts, 0),
        mask, lissage, desc: d,
        rgb: couleurMoyenne(tplDraft.imgData, region.x0, region.y0, mask, rect.w, rect.h),
        thumb: vignetteDepuisMasque(tplDraft.imgData, region.x0, region.y0, mask, rect.w, rect.h),
        name: '', expected: '', keep: true
      };
      setTplDraft(d0 => ({ ...d0, items: [...d0.items, item] }));
    } catch (e) {
      console.error(e); flash('Extraction impossible');
    }
  };

  const majItem = (idx, patch) => {
    setTplDraft(d => ({ ...d, items: d.items.map((x, i) => i === idx ? { ...x, ...patch } : x) }));
  };

  const validerEdition = (maskEdite, lissage) => {
    const { idx } = edition;
    const it = tplDraft.items[idx];
    const { x0, y0, w: rw, h: rh } = it.region;
    const d = descripteurs(maskEdite, rw, rh);
    if (!d) { flash('Le détourage est vide'); return; }
    majItem(idx, {
      mask: Uint8Array.from(maskEdite),
      lissage,
      desc: d,
      rgb: couleurMoyenne(tplDraft.imgData, x0, y0, maskEdite, rw, rh),
      thumb: vignetteDepuisMasque(tplDraft.imgData, x0, y0, maskEdite, rw, rh)
    });
    setEdition(null);
  };

  const saveTemplates = () => {
    const items = tplDraft.items.filter(i => i.keep);
    if (!items.length) { flash('Aucune pièce sélectionnée'); return; }
    if (items.some(i => !i.name.trim())) { flash('Donne un nom à chaque pièce'); return; }
    const existants = (profiles[currentGame] && profiles[currentGame].gabarits) || [];
    const nouveaux = items.map((i, k) => ({
      id: 'g' + Date.now() + '_' + k,
      session: tplDraft.session,
      name: i.name.trim(),
      rgb: i.rgb.map(v => Math.round(v)),
      lab: rgbToLab(i.rgb[0], i.rgb[1], i.rgb[2]),
      area: i.desc.area,
      elong: i.desc.elong,
      etalement: i.desc.etalement,
      solidite: i.desc.solidite,
      rayonRel: i.desc.rayonRel,
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
          ov.data[i * 4 + 3] = 110;
        }
      }
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      tmp.getContext('2d').putImageData(ov, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    }

    const colorOf = {};
    groups.forEach(g => { colorOf[g.key] = cssRgb(g.rgb); });
    const actifs = result.blobs.filter(b => !b.excluded);
    const trait = Math.max(2, w / 400);
    const afficherTous = actifs.length <= 40;
    const rBadge = Math.max(10, w / 55);
    ctx.font = 'bold ' + Math.round(rBadge * 1.15) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    result.blobs.forEach(b => {
      const bw = Math.max(6, b.maxX - b.minX + 1), bh = Math.max(6, b.maxY - b.minY + 1);
      if (b.excluded) {
        ctx.strokeStyle = 'rgba(239,68,68,0.95)';
        ctx.lineWidth = trait;
        ctx.strokeRect(b.minX, b.minY, bw, bh);
        ctx.beginPath();
        ctx.moveTo(b.minX, b.minY); ctx.lineTo(b.minX + bw, b.minY + bh);
        ctx.moveTo(b.minX + bw, b.minY); ctx.lineTo(b.minX, b.minY + bh);
        ctx.stroke();
        return;
      }
      ctx.strokeStyle = b.manual ? 'rgba(250,204,21,1)' : 'rgba(34,197,94,1)';
      ctx.lineWidth = trait;
      ctx.strokeRect(b.minX, b.minY, bw, bh);
      if (b.count > 1 || afficherTous) {
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, rBadge, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(17,24,39,0.82)';
        ctx.fill();
        ctx.fillStyle = '#fff';
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
      const rgb = [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]];
      const next = { ...opts, fondManuel: { rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]) } };
      setOpts(next);
      setPickBg(false);
      analyse(imgData, next);
      flash('Couleur de fond mise à jour');
      return;
    }

    const dedans = result.blobs.filter(b =>
      x >= b.minX - 4 && x <= b.maxX + 4 && y >= b.minY - 4 && y <= b.maxY + 4);
    let cible = null;
    if (dedans.length) {
      cible = dedans.reduce((a, b) => (a.area < b.area ? a : b));
    } else {
      let bestD = Infinity;
      result.blobs.forEach(b => {
        const d = (b.cx - x) * (b.cx - x) + (b.cy - y) * (b.cy - y);
        if (d < bestD) { bestD = d; cible = b; }
      });
      const aires = result.blobs.map(b => b.area);
      if (bestD > (aires.length ? median(aires) : 900) * 0.9) cible = null;
    }

    if (cible) {
      regroup(result.blobs.map(b => b.id === cible.id ? { ...b, excluded: !b.excluded } : b));
      return;
    }

    const aires = result.blobs.map(b => b.area);
    const unit = aires.length ? median(aires) : 900;
    const demi = Math.round(Math.sqrt(unit) / 2);
    const i = (Math.round(y) * result.w + Math.round(x)) * 4;
    const rgb = [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2]];
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    let gab = -1, bd = Infinity;
    if (gabs) gabs.forEach((g, k) => { const d = deltaGab(lab, g.lab); if (d < bd) { bd = d; gab = k; } });
    const ajout = {
      id: result.blobs.length ? Math.max(...result.blobs.map(b => b.id)) + 1 : 0,
      label: -1, area: unit, cx: x, cy: y,
      minX: x - demi, maxX: x + demi, minY: y - demi, maxY: y + demi,
      bw: demi * 2, bh: demi * 2,
      elong: 1, etalement: 0.166, solidite: 1, rayonRel: 1.2,
      gab, score: 0, rgb, lab,
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

      {selection && tplDraft && (
        <SelecteurPiece imgData={tplDraft.imgData} darkMode={darkMode}
          nbFaits={tplDraft.items.length}
          onSelection={ajouterSelection}
          onFermer={() => setSelection(false)} />
      )}

      {edition && tplDraft && tplDraft.items[edition.idx] && (
        <EditeurMasque
          imgData={tplDraft.imgData}
          region={tplDraft.items[edition.idx].region}
          maskBrut={tplDraft.items[edition.idx].maskBrut}
          lissageInit={tplDraft.items[edition.idx].lissage}
          darkMode={darkMode}
          onValider={validerEdition}
          onAnnuler={() => setEdition(null)} />
      )}

      <div className="py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-5">

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
                  <p className={'text-sm ' + sub}>Entoure tes pièces, puis compte-les toutes</p>
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
                Photographie une pièce de chaque type, puis entoure-les une par une sur l'image.
                Mets-les toutes sur la même photo : c'est ce qui permet de connaître leur taille
                les unes par rapport aux autres.
              </p>

              <input ref={tplCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { loadTemplate(e.target.files && e.target.files[0]); e.target.value = ''; }} />
              <input ref={tplGalRef} type="file" accept="image/*" className="hidden"
                onChange={e => { loadTemplate(e.target.files && e.target.files[0]); e.target.value = ''; }} />

              <div className="flex flex-wrap gap-2">
                <button onClick={() => tplCamRef.current && tplCamRef.current.click()} disabled={tplBusy}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
                  Photographier les pièces
                </button>
                <button onClick={() => tplGalRef.current && tplGalRef.current.click()} disabled={tplBusy}
                  className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + ghost + ' disabled:opacity-50'}>
                  Choisir dans la galerie
                </button>
                {tplDraft && (
                  <button onClick={() => setSelection(true)}
                    className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + ghost}>
                    Entourer une autre pièce
                  </button>
                )}
                <span className={'hidden sm:flex items-center text-xs ' + sub}>ou dépose une image ici</span>
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

              {tplDraft && tplDraft.items.length > 0 && (
                <div className={'rounded-xl p-4 space-y-3 border-2 border-dashed ' + (darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-gray-50')}>
                  <p className={'text-sm font-medium ' + txt}>Pièces prises sur cette photo</p>
                  <div className="space-y-2">
                    {tplDraft.items.map((it, idx) => (
                      <div key={it.key} className={'flex items-center gap-2 p-2 rounded-lg ' + (darkMode ? 'bg-gray-800' : 'bg-white')}>
                        <button onClick={() => setEdition({ idx })}
                          className="w-14 h-14 shrink-0 flex items-center justify-center rounded-lg border border-dashed border-blue-500/50 hover:border-blue-500"
                          style={{ background: darkMode ? '#111827' : '#f3f4f6' }}
                          title="Ajuster le détourage">
                          <img src={it.thumb} alt="" className="max-w-full max-h-full object-contain" />
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input value={it.name} placeholder="Nom (ex : tuile bleue)"
                            onChange={e => majItem(idx, { name: e.target.value })}
                            className={'w-full px-2.5 py-1.5 rounded-lg border text-sm ' + field} />
                          <div className="flex gap-3">
                            <button onClick={() => setEdition({ idx })} className="text-xs text-blue-500 hover:underline">
                              Ajuster le détourage
                            </button>
                            <button onClick={() => setTplDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))}
                              className="text-xs text-red-500 hover:underline">
                              Retirer
                            </button>
                          </div>
                        </div>
                        <input type="number" inputMode="numeric" placeholder="qté" value={it.expected}
                          onChange={e => majItem(idx, { expected: e.target.value })}
                          className={'w-16 shrink-0 px-2 py-1.5 rounded-lg border text-sm ' + field} />
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
                Aucun gabarit pour {currentGame} : le comptage se fera à l'aveugle.
              </p>
            )}

            {showSettings && (
              <div className={'rounded-xl p-4 space-y-4 ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                <Slider label="Bouchage des motifs" hint="Recolle une pièce que son motif imprimé fait éclater en morceaux. C'est le réglage à monter si une seule pièce en vaut plusieurs"
                  value={opts.fermeture} min={0} max={8} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, fermeture: v }))} />
                <Slider label="Sensibilité au fond" hint="Monte-le si la table ou le tissu sont pris pour des pièces"
                  value={opts.seuilFond} min={6} max={45} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, seuilFond: v }))} />
                <Slider label="Tolérance des gabarits" hint="Plus bas = n'accepte que les couleurs très proches des pièces enregistrées"
                  value={opts.tolGabarit} min={8} max={50} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tolGabarit: v }))} />
                <Slider label="Exigence sur la forme" hint="Plus haut = accepte des silhouettes plus éloignées du gabarit"
                  value={opts.seuilForme} min={1} max={5} step={0.1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, seuilForme: v }))} />
                <Slider label="Poids de la forme" hint="À 0, seule la couleur compte. Monte-le quand plusieurs pièces ont la même couleur"
                  value={opts.poidsForme} min={0} max={3} step={0.1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, poidsForme: v }))} />
                <Slider label="Taille minimale" hint="Part d'une pièce en dessous de laquelle une tache est ignorée"
                  value={opts.tailleMin} min={0.1} max={0.9} step={0.05} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, tailleMin: v }))} />
                <Slider label="Séparation" hint="Augmente si des pièces collées sont comptées comme une seule"
                  value={opts.separation} min={1} max={5} step={1} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, separation: v }))} />
                <Slider label="Résolution d'analyse" hint="Plus haut = plus précis mais plus lent sur mobile"
                  value={opts.resolution} min={500} max={1600} step={100} darkMode={darkMode}
                  onChange={v => setOpts(o => ({ ...o, resolution: v }))} />
                <Check label="Ignorer les ombres" darkMode={darkMode}
                  hint="Une ombre assombrit les trois couleurs de la même façon, ce qui permet de la reconnaître"
                  checked={opts.ignorerOmbres} onChange={v => setOpts(o => ({ ...o, ignorerOmbres: v }))} />
                <Check label="Séparer les pièces collées par la couleur" darkMode={darkMode}
                  hint="À n'activer que pour des pièces unies. Sur des pièces à motifs, ce découpage les casse en morceaux"
                  checked={opts.parCouleur} onChange={v => setOpts(o => ({ ...o, parCouleur: v }))} />
                <Check label="Ignorer ce qui touche le bord" darkMode={darkMode}
                  hint="Écarte les pièces coupées par le cadre et le bord de la table"
                  checked={opts.ignorerBords} onChange={v => setOpts(o => ({ ...o, ignorerBords: v }))} />
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
                    Touche un cadre pour retirer la pièce du comptage. Touche une pièce oubliée pour
                    l'ajouter (cadre jaune). Un chiffre supérieur à 1 signale des pièces collées.
                    {result.rejets > 0 && ' ' + result.rejets + ' tache' + (result.rejets > 1 ? 's écartées' : ' écartée') + '.'}
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
                Aucune pièce reconnue. Active « Voir le masque » : si rien n'est vert, baisse la
                sensibilité au fond ou touche le fond avec « Indiquer le fond ».
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

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
