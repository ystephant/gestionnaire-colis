import React, { useState, useEffect, useRef, useCallback } from 'react';

/* ============================================================================
   COMPTAGE PHOTO — détection et comptage automatiques de pièces de jeu
   Page autonome : aucune dépendance npm, aucun appel réseau, aucune table.
   Profils enregistrés dans localStorage (clé : meeple_comptage).

   Le fond n'est pas supposé uni : il est modélisé localement, cellule par
   cellule, et le seuil de détection est calculé automatiquement sur chaque
   photo. C'est ce qui permet de travailler sur une table en bois ou un tissu
   froissé, là où un seuil global échoue.
   ========================================================================== */

const STORAGE_KEY = 'meeple_comptage';

function srgbToLinear(c) { const v = c / 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }
function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const f = t => (t > 0.008856452 ? Math.cbrt(t) : 7.787037 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function deltaGab(lab, gLab) {
  let k = 1;
  if (gLab[0] > 8) k = Math.min(1.5, Math.max(0.6, lab[0] / gLab[0]));
  const dl = (lab[0] - gLab[0]) * 0.7, da = lab[1] - gLab[1] * k, db = lab[2] - gLab[2] * k;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/* ------------------------------------------------------------- morphologie */
function morph(mask, w, h, r, erode) {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d, m = xx < 0 || xx >= w ? 0 : mask[row + xx];
        if (erode) { if (!m) { v = 0; break; } } else if (m) { v = 1; break; }
      }
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = erode ? 1 : 0;
      for (let d = -r; d <= r; d++) {
        const yy = y + d, m = yy < 0 || yy >= h ? 0 : tmp[yy * w + x];
        if (erode) { if (!m) { v = 0; break; } } else if (m) { v = 1; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}
function remplirTrous(mask, w, h) {
  const out = Uint8Array.from(mask), vu = new Uint8Array(w * h), pile = new Int32Array(w * h);
  let sp = 0;
  const p = i => { if (!vu[i] && !mask[i]) { vu[i] = 1; pile[sp++] = i; } };
  for (let x = 0; x < w; x++) { p(x); p((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { p(y * w); p(y * w + w - 1); }
  while (sp > 0) {
    const q = pile[--sp], x = q % w, y = (q / w) | 0;
    if (x > 0) p(q - 1); if (x < w - 1) p(q + 1);
    if (y > 0) p(q - w); if (y < h - 1) p(q + w);
  }
  for (let i = 0; i < w * h; i++) if (!mask[i] && !vu[i]) out[i] = 1;
  return out;
}

/* ------------------------------------------------------------------ Otsu  */
function otsu(dist, n, maxV) {
  const B = 256, hist = new Float64Array(B);
  for (let i = 0; i < n; i++) {
    let b = Math.floor(dist[i] / maxV * (B - 1));
    if (b < 0) b = 0; if (b >= B) b = B - 1;
    hist[b]++;
  }
  let total = n, sum = 0;
  for (let i = 0; i < B; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestVar = -1;
  for (let i = 0; i < B; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > bestVar) { bestVar = v; best = i; }
  }
  return best / (B - 1) * maxV;
}

/* ------------------------------------------- fond local + carte de distance */
function carteDistance(data, w, h, lab, opts) {
  const n = w * h;
  const GX = Math.max(6, Math.round(w / 90)), GY = Math.max(6, Math.round(h / 90));
  const cw = w / GX, ch = h / GY;
  const dist = new Float32Array(n);
  let mask = new Uint8Array(n);
  let gL = new Float32Array(GX * GY), gA = new Float32Array(GX * GY), gB = new Float32Array(GX * GY);
  const gR = new Float32Array(GX * GY), gG = new Float32Array(GX * GY), gBl = new Float32Array(GX * GY);
  let seuil = 0, maxV = 1, fraction = 0, fondEstime = null, plafonne = false;

  for (let iter = 0; iter < 3; iter++) {
    // 1. mediane locale du fond par cellule, en n'utilisant que les pixels fond
    const bucketsL = [], bucketsA = [], bucketsB = [];
    const bR = [], bG = [], bB2 = [];
    for (let c = 0; c < GX * GY; c++) { bucketsL.push([]); bucketsA.push([]); bucketsB.push([]); bR.push([]); bG.push([]); bB2.push([]); }
    if (iter === 0) {
      /* Amorçage. Deux hypothèses sont mises en concurrence pour la couleur du
         fond : la médiane de la bordure, et la couleur dominante de l'image.
         On garde celle qui laisse le moins de pixels en premier plan — c'est
         ce qui évite qu'une photo entière soit prise pour une pièce quand la
         bordure tombe sur un pli sombre ou sur une pièce. */
      const md = a => { a.sort((p, q) => p - q); return a[a.length >> 1] || 0; };
      const bande = Math.max(4, Math.round(Math.min(w, h) * 0.06));
      const R = [], G = [], B2 = [];
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        if (x > bande && x < w - bande && y > bande && y < h - bande) continue;
        const q = (y * w + x) * 4;
        R.push(data[q]); G.push(data[q + 1]); B2.push(data[q + 2]);
      }
      const bord = [md(R), md(G), md(B2)];

      // couleur dominante : pic d'un histogramme grossier 16x16x16
      const BINS = 16, hist = new Int32Array(BINS * BINS * BINS);
      for (let i = 0; i < n; i += 3) {
        const q = i * 4;
        const b = ((data[q] >> 4) * BINS + (data[q + 1] >> 4)) * BINS + (data[q + 2] >> 4);
        hist[b]++;
      }
      let pic = 0, picN = -1;
      for (let b = 0; b < hist.length; b++) if (hist[b] > picN) { picN = hist[b]; pic = b; }
      const pb = pic % BINS, pg = ((pic / BINS) | 0) % BINS, pr = (pic / (BINS * BINS)) | 0;
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let i = 0; i < n; i += 3) {
        const q = i * 4;
        if ((data[q] >> 4) === pr && (data[q + 1] >> 4) === pg && (data[q + 2] >> 4) === pb) {
          sr += data[q]; sg += data[q + 1]; sb += data[q + 2]; sn++;
        }
      }
      const dominant = sn ? [sr / sn, sg / sn, sb / sn] : bord;

      let choix;
      if (opts.fondRef) {
        choix = opts.fondRef;
      } else {
        // on compte, pour chaque hypothèse, la part de pixels qui s'en écartent
        const part = ref => {
          const rl = rgbToLab(ref[0], ref[1], ref[2]);
          let loin = 0, vus = 0;
          for (let i = 0; i < n; i += 5) {
            const dl = (lab[i * 3] - rl[0]) * 0.8;
            const da = lab[i * 3 + 1] - rl[1], db2 = lab[i * 3 + 2] - rl[2];
            if (Math.sqrt(dl * dl + da * da + db2 * db2) > 22) loin++;
            vus++;
          }
          return loin / Math.max(1, vus);
        };
        choix = part(dominant) < part(bord) ? dominant : bord;
      }
      const cl = rgbToLab(choix[0], choix[1], choix[2]);
      for (let c = 0; c < GX * GY; c++) {
        for (let k = 0; k < 12; k++) {
          bucketsL[c].push(cl[0]); bucketsA[c].push(cl[1]); bucketsB[c].push(cl[2]);
          bR[c].push(choix[0]); bG[c].push(choix[1]); bB2[c].push(choix[2]);
        }
      }
      fondEstime = choix;
    } else {
      for (let y = 0; y < h; y += 2) {
        const gy = Math.min(GY - 1, (y / ch) | 0);
        for (let x = 0; x < w; x += 2) {
          const i = y * w + x;
          if (mask[i]) continue;
          const c = gy * GX + Math.min(GX - 1, (x / cw) | 0);
          bucketsL[c].push(lab[i * 3]); bucketsA[c].push(lab[i * 3 + 1]); bucketsB[c].push(lab[i * 3 + 2]);
          const p = i * 4;
          bR[c].push(data[p]); bG[c].push(data[p + 1]); bB2[c].push(data[p + 2]);
        }
      }
    }
    const med = a => { if (!a.length) return null; a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const vide = [];
    for (let c = 0; c < GX * GY; c++) {
      const l = bucketsL[c].length >= 12 ? med(bucketsL[c]) : null;
      if (l === null) { vide.push(c); gL[c] = NaN; continue; }
      gL[c] = l; gA[c] = med(bucketsA[c]); gB[c] = med(bucketsB[c]);
      gR[c] = med(bR[c]); gG[c] = med(bG[c]); gBl[c] = med(bB2[c]);
    }
    // cellules entierement couvertes par des pieces : on les remplit par diffusion
    for (let pass = 0; pass < 6 && vide.length; pass++) {
      const reste = [];
      for (const c of vide) {
        const cx = c % GX, cy = (c / GX) | 0;
        let sl = 0, sa = 0, sb = 0, sr = 0, sg = 0, sbl = 0, k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= GX || ny >= GY) continue;
          const j = ny * GX + nx;
          if (isNaN(gL[j])) continue;
          sl += gL[j]; sa += gA[j]; sb += gB[j]; sr += gR[j]; sg += gG[j]; sbl += gBl[j]; k++;
        }
        if (k) { gL[c] = sl / k; gA[c] = sa / k; gB[c] = sb / k; gR[c] = sr / k; gG[c] = sg / k; gBl[c] = sbl / k; } else reste.push(c);
      }
      if (reste.length === vide.length) break;
      vide.length = 0; vide.push(...reste);
    }
    for (let c = 0; c < GX * GY; c++) if (isNaN(gL[c])) { gL[c] = 70; gA[c] = 0; gB[c] = 0; gR[c] = 170; gG[c] = 170; gBl[c] = 170; }

    // 2. distance de chaque pixel a son fond local (interpolation bilineaire)
    maxV = 1;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(GY - 1.001, Math.max(0, y / ch - 0.5));
      const y0 = fy | 0, ty = fy - y0, y1 = Math.min(GY - 1, y0 + 1);
      for (let x = 0; x < w; x++) {
        const fx = Math.min(GX - 1.001, Math.max(0, x / cw - 0.5));
        const x0 = fx | 0, tx = fx - x0, x1 = Math.min(GX - 1, x0 + 1);
        const i00 = y0 * GX + x0, i10 = y0 * GX + x1, i01 = y1 * GX + x0, i11 = y1 * GX + x1;
        const bl = (gL[i00] * (1 - tx) + gL[i10] * tx) * (1 - ty) + (gL[i01] * (1 - tx) + gL[i11] * tx) * ty;
        const ba = (gA[i00] * (1 - tx) + gA[i10] * tx) * (1 - ty) + (gA[i01] * (1 - tx) + gA[i11] * tx) * ty;
        const bb = (gB[i00] * (1 - tx) + gB[i10] * tx) * (1 - ty) + (gB[i01] * (1 - tx) + gB[i11] * tx) * ty;
        const br = (gR[i00] * (1 - tx) + gR[i10] * tx) * (1 - ty) + (gR[i01] * (1 - tx) + gR[i11] * tx) * ty;
        const bg2 = (gG[i00] * (1 - tx) + gG[i10] * tx) * (1 - ty) + (gG[i01] * (1 - tx) + gG[i11] * tx) * ty;
        const bb2 = (gBl[i00] * (1 - tx) + gBl[i10] * tx) * (1 - ty) + (gBl[i01] * (1 - tx) + gBl[i11] * tx) * ty;
        const i = y * w + x;
        const dL = lab[i * 3] - bl, da = lab[i * 3 + 1] - ba, db = lab[i * 3 + 2] - bb;
        const dChroma = Math.sqrt(da * da + db * db);
        /* Une ombre attenue les trois canaux dans la meme proportion et reste
           claire ; une piece noire, elle, tombe tres bas. C'est le rapport RVB
           qui les separe, pas la clarte. */
        let ombre = false;
        if (opts.ignorerOmbres) {
          const p4 = i * 4;
          const kr = data[p4] / Math.max(1, br), kg = data[p4 + 1] / Math.max(1, bg2), kb = data[p4 + 2] / Math.max(1, bb2);
          const mx = Math.max(kr, kg, kb), mn = Math.min(kr, kg, kb);
          ombre = mx <= 1.06 && mn >= 0.40 && mx / Math.max(0.01, mn) <= 1.16;
        }
        const wL = ombre ? 0.10 : 0.80;
        const d = Math.sqrt(dChroma * dChroma + (wL * dL) * (wL * dL));
        dist[i] = d;
        if (d > maxV) maxV = d;
      }
    }

    // 3. seuil automatique
    const ech = [];
    for (let i = 0; i < n; i += 7) ech.push(dist[i]);
    ech.sort((a, b) => a - b);
    const p92 = ech[Math.floor(ech.length * 0.92)] || maxV;
    seuil = Math.max(otsu(dist, n, Math.max(1, p92)), 9) * opts.sensibilite;

    /* Garde-fou : des pièces ne peuvent pas occuper presque toute la photo.
       Si le seuil retenu masque plus de la moitié de l'image, c'est que le
       fond a été mal identifié — on relève le seuil au lieu de rendre un
       masque inexploitable, et on le signale. */
    const PLAFOND = 0.80;
    let part = 0;
    for (let i = 0; i < ech.length; i++) if (ech[i] > seuil) part++;
    part /= Math.max(1, ech.length);
    if (part > PLAFOND) {
      seuil = ech[Math.floor(ech.length * (1 - PLAFOND))] || seuil;
      plafonne = true;
      part = PLAFOND;
    }
    fraction = part;

    mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (dist[i] > seuil) mask[i] = 1;
  }
  return { mask, dist, seuil, fraction, fondEstime, plafonne };
}

/* ------------------------------------------------ composantes et decoupage */
function composantes(mask, w, h) {
  const n = w * h, labels = new Int32Array(n), pile = new Int32Array(n), comps = [];
  let cur = 0;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || labels[s]) continue;
    cur++;
    let sp = 0, area = 0, sx = 0, sy = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    pile[sp++] = s; labels[s] = cur;
    while (sp > 0) {
      const p = pile[--sp], x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = cur; pile[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = cur; pile[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = cur; pile[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = cur; pile[sp++] = p + w; }
    }
    comps.push({ label: cur, area, cx: sx / area, cy: sy / area, minX, maxX, minY, maxY });
  }
  return { labels, comps };
}

/* Taille typique d'une piece : mediane ponderee par la surface. Mille taches
   de bruit pesent moins qu'une seule vraie piece. */
/* Taille qui revient le plus souvent parmi les composantes : c'est celle d'une
   pièce isolée. Sert à repérer qu'une composante vaut en fait plusieurs pièces. */
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

function taillePonderee(comps) {
  if (!comps.length) return 0;
  const s = comps.slice().sort((a, b) => a.area - b.area);
  const tot = s.reduce((t, c) => t + c.area, 0);
  let acc = 0;
  for (const c of s) { acc += c.area; if (acc >= tot * 0.5) return c.area; }
  return s[s.length - 1].area;
}

/* Transformee de distance (chanfrein 3-4) sur la boite d'une composante */
function distanceTransform(m, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!m[i]) continue;
    let v = d[i];
    if (y > 0) v = Math.min(v, d[i - w] + 3);
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0 && x > 0) v = Math.min(v, d[i - w - 1] + 4);
    if (y > 0 && x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!m[i]) continue;
    let v = d[i];
    if (y < h - 1) v = Math.min(v, d[i + w] + 3);
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1 && x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
    if (y < h - 1 && x > 0) v = Math.min(v, d[i + w - 1] + 4);
    d[i] = v;
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

/* Decoupe un amas en N morceaux : on prend les N points les plus "au centre"
   puis chaque pixel rejoint le germe le plus proche. */
function decouper(m, w, h, N, cote) {
  const d = distanceTransform(m, w, h);
  const idx = [];
  for (let i = 0; i < w * h; i++) if (m[i] && d[i] > 1.2) idx.push(i);
  idx.sort((a, b) => d[b] - d[a]);
  const germes = [];
  const rSup = Math.max(2, cote * 0.60);
  for (const i of idx) {
    if (germes.length >= N) break;
    const x = i % w, y = (i / w) | 0;
    let ok = true;
    for (const g of germes) {
      const gx = g % w, gy = (g / w) | 0;
      if ((x - gx) * (x - gx) + (y - gy) * (y - gy) < rSup * rSup) { ok = false; break; }
    }
    if (ok) germes.push(i);
  }
  if (germes.length < 2) return null;
  const owner = new Int32Array(w * h).fill(-1);
  const file = new Int32Array(w * h);
  let head = 0, tail = 0;
  germes.forEach((g, k) => { owner[g] = k; file[tail++] = g; });
  while (head < tail) {
    const p = file[head++], x = p % w, y = (p / w) | 0, o = owner[p];
    const voisin = q => { if (m[q] && owner[q] < 0) { owner[q] = o; file[tail++] = q; } };
    if (x > 0) voisin(p - 1);
    if (x < w - 1) voisin(p + 1);
    if (y > 0) voisin(p - w);
    if (y < h - 1) voisin(p + w);
  }
  return { owner, nb: germes.length };
}

/* --------------------------------------------------------------- analyse  */
function analyser(imageData, opts) {
  const { width: w, height: h, data } = imageData;
  const n = w * h;
  const lab = new Float32Array(n * 3);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const l = rgbToLab(data[p], data[p + 1], data[p + 2]);
    lab[i * 3] = l[0]; lab[i * 3 + 1] = l[1]; lab[i * 3 + 2] = l[2];
  }

  const diag = carteDistance(data, w, h, lab, opts);
  const { mask: m0, seuil } = diag;

  // nettoyage initial
  let mask = morph(m0, w, h, 1, true);
  mask = morph(mask, w, h, 1, false);
  mask = remplirTrous(mask, w, h);

  let { labels, comps } = composantes(mask, w, h);

  /* Une composante énorme qui touche le bord n'est pas une pièce : c'est la
     table, la nappe ou une zone d'ombre que le modèle de fond n'a pas su
     absorber. On la retire du masque avant toute estimation de taille. */
  let fondFuite = false;
  comps.forEach(c => {
    const touche = c.minX <= 1 || c.minY <= 1 || c.maxX >= w - 2 || c.maxY >= h - 2;
    if (!touche || c.area < n * 0.18) return;
    fondFuite = true;
    for (let y = c.minY; y <= c.maxY; y++) {
      for (let x = c.minX; x <= c.maxX; x++) {
        const i = y * w + x;
        if (labels[i] === c.label) { mask[i] = 0; labels[i] = 0; }
      }
    }
  });
  if (fondFuite) ({ labels, comps } = composantes(mask, w, h));

  let M = opts.aireRef || taillePonderee(comps.filter(c => c.area >= 20));
  if (!M) return { pieces: [], total: 0, mask, labels, w, h, M: 0, seuil, rejets: 0,
    avertissement: diag.plafonne ? 'fondDouteux' : null,
    amasMax: 1, fraction: diag.fraction, fondEstime: diag.fondEstime, fondDouteux: diag.plafonne || fondFuite };

  // Les motifs imprimes sont des trous a l'interieur du contour : les reboucher
  // suffit. Une fermeture large recollerait les pieces voisines entre elles.
  mask = morph(mask, w, h, 2, false);
  mask = morph(mask, w, h, 2, true);
  mask = remplirTrous(mask, w, h);

  ({ labels, comps } = composantes(mask, w, h));
  M = taillePonderee(comps.filter(c => c.area >= 20)) || M;
  if (opts.aireRef) M = opts.aireRef;

  const pieces = [];
  let rejets = 0, amasMax = 1;
  comps.forEach(c => {
    if (c.area < M * 0.30) { rejets++; return; }
    const ratio = c.area / M;
    const N = ratio >= 1.55 ? Math.max(2, Math.round(ratio)) : 1;

    if (N === 1) {
      pieces.push({ area: c.area, cx: c.cx, cy: c.cy, minX: c.minX, maxX: c.maxX,
        minY: c.minY, maxY: c.maxY, label: c.label, count: 1 });
      return;
    }
    if (N > amasMax) amasMax = N;

    /* Le nombre vient du rapport des surfaces, il est fiable. Le decoupage
       geometrique n'est qu'un confort d'affichage : s'il echoue, on garde
       l'amas entier en lui attribuant son nombre. */
    let decoupe = null;
    if (opts.separer) {
      const bw = c.maxX - c.minX + 1, bh = c.maxY - c.minY + 1;
      const sub = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++)
        if (labels[(c.minY + y) * w + (c.minX + x)] === c.label) sub[y * bw + x] = 1;
      const dec = decouper(sub, bw, bh, N, Math.sqrt(M));
      if (dec && dec.nb === N) {
        const acc = [];
        for (let k = 0; k < N; k++) acc.push({ area: 0, sx: 0, sy: 0, minX: bw, maxX: 0, minY: bh, maxY: 0 });
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o = dec.owner[y * bw + x];
          if (o < 0) continue;
          const a = acc[o];
          a.area++; a.sx += x; a.sy += y;
          if (x < a.minX) a.minX = x; if (x > a.maxX) a.maxX = x;
          if (y < a.minY) a.minY = y; if (y > a.maxY) a.maxY = y;
        }
        if (acc.every(a => a.area >= M * 0.25)) decoupe = acc;
      }
    }

    if (decoupe) {
      decoupe.forEach(a => pieces.push({
        area: a.area, cx: c.minX + a.sx / a.area, cy: c.minY + a.sy / a.area,
        minX: c.minX + a.minX, maxX: c.minX + a.maxX,
        minY: c.minY + a.minY, maxY: c.minY + a.maxY,
        label: c.label, count: 1, issuAmas: true
      }));
    } else {
      pieces.push({ area: c.area, cx: c.cx, cy: c.cy, minX: c.minX, maxX: c.maxX,
        minY: c.minY, maxY: c.maxY, label: c.label, count: N, amas: true });
    }
  });

  const total = pieces.reduce((t, p) => t + p.count, 0);
  const surfaceTotale = comps.reduce((t, c) => t + c.area, 0);
  const plusGros = comps.reduce((t, c) => Math.max(t, c.area), 0);
  /* Détection d'un tas. La taille qui se répète le plus souvent parmi les
     composantes est celle d'une pièce isolée ; si la plus grosse composante
     vaut plusieurs fois cette taille, c'est que des pièces sont empilées ou
     collées. Aucun comptage fiable n'est possible dans ce cas : une pièce
     cachée sous une autre n'est pas dans la photo. */
  const tailles = comps.filter(c => c.area >= Math.max(20, n * 0.0004)).map(c => c.area);
  const courante = modeArea(tailles);
  const entassement = courante > n * 0.0008
    && tailles.filter(a => a < courante * 1.6).length >= 3
    && plusGros > courante * 5;

  let avertissement = null;
  if (diag.plafonne) {
    avertissement = "fondDouteux";
  } else if (entassement) {
    avertissement = "entassement";
  } else if (pieces.length && plusGros > surfaceTotale * 0.55 && pieces.length <= 2 && total <= 2) {
    avertissement = "tailleInconnue";
  } else if (amasMax >= 4) {
    avertissement = "amas";
  }

  return { pieces, total, mask, labels, w, h, M, seuil, rejets, avertissement, amasMax,
    fraction: diag.fraction, fondEstime: diag.fondEstime, fondDouteux: diag.plafonne || fondFuite };
}
/* ==================================================== DESCRIPTION D'UNE PIÈCE */

function enveloppe(pts) {
  if (pts.length < 3) return pts;
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas = [];
  for (const q of p) { while (bas.length >= 2 && cr(bas[bas.length - 2], bas[bas.length - 1], q) <= 0) bas.pop(); bas.push(q); }
  const haut = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (haut.length >= 2 && cr(haut[haut.length - 2], haut[haut.length - 1], q) <= 0) haut.pop();
    haut.push(q);
  }
  bas.pop(); haut.pop();
  return bas.concat(haut);
}

function airePolygone(h) {
  let a = 0;
  for (let i = 0; i < h.length; i++) { const j = (i + 1) % h.length; a += h[i][0] * h[j][1] - h[j][0] * h[i][1]; }
  return Math.abs(a) / 2;
}

/* Quatre mesures qui ne changent pas quand la pièce tourne : allongement,
   étalement, solidité, rayon relatif. Vérifiées à moins de 4 % de variation
   entre 0° et 90° sur des silhouettes de route, maison, wagon et meeple. */
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
  const aireEnv = airePolygone(enveloppe(bord)) || area;
  let rmax = 0;
  for (const p of bord) { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d > rmax) rmax = d; }
  return {
    area, elong: Math.sqrt(l1 / l2), etalement: tr / area,
    solidite: Math.min(1, area / aireEnv),
    rayonRel: Math.sqrt(rmax) / Math.sqrt(area / Math.PI)
  };
}

/* Signature complète d'une pièce : masque local, forme, et deux couleurs.

   La couleur moyenne ne suffit pas : sur une tuile noire à motifs turquoise,
   le noir écrase tout et deux tuiles de motifs différents paraissent
   identiques. On retient donc aussi la couleur d'accent, c'est-à-dire la
   moyenne des pixels les plus colorés de la pièce. Sur une pièce unie les
   deux se confondent, sur une pièce à motifs c'est l'accent qui distingue. */
function signature(imageData, labels, p) {
  const w = imageData.width;
  const bw = Math.max(1, p.maxX - p.minX + 1), bh = Math.max(1, p.maxY - p.minY + 1);
  const m = new Uint8Array(bw * bh);
  const px = [];
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const gi = (p.minY + y) * w + (p.minX + x);
      if (labels[gi] !== p.label) continue;
      m[y * bw + x] = 1;
      const q = gi * 4;
      const R = imageData.data[q], G = imageData.data[q + 1], B = imageData.data[q + 2];
      r += R; g += G; b += B; n++;
      if (px.length < 4000 && (n & 1) === 0) {
        const l = rgbToLab(R, G, B);
        px.push([R, G, B, Math.sqrt(l[1] * l[1] + l[2] * l[2])]);
      }
    }
  }
  const d = descripteurs(m, bw, bh) || { area: p.area, elong: 1, etalement: 0.166, solidite: 1, rayonRel: 1.2 };
  const rgb = n ? [r / n, g / n, b / n] : [128, 128, 128];

  let accent = rgb;
  if (px.length >= 12) {
    const chromas = px.map(q => q[3]).sort((a, c) => a - c);
    const seuil = chromas[Math.floor(chromas.length * 0.72)];
    let ar = 0, ag = 0, ab = 0, an = 0;
    for (const q of px) if (q[3] >= seuil) { ar += q[0]; ag += q[1]; ab += q[2]; an++; }
    if (an >= 6) accent = [ar / an, ag / an, ab / an];
  }

  return {
    ...d, area: p.area,
    rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]),
    accent, labAccent: rgbToLab(accent[0], accent[1], accent[2]),
    masque: m, bw, bh
  };
}

/* Distance entre deux pièces : couleur, forme et taille sur une même échelle.
   1 correspond grossièrement à « à la limite de la ressemblance ». */
function distancePieces(a, b, poidsForme) {
  const dMoy = deltaGab(a.lab, b.lab);
  const dAcc = (a.labAccent && b.labAccent) ? deltaGab(a.labAccent, b.labAccent) : dMoy;
  const dc = (dMoy * 0.45 + dAcc * 0.55) / 26;
  let s = dc * dc;
  const f = [
    Math.log(Math.max(1e-3, a.elong / b.elong)) / 0.24,
    (a.etalement - b.etalement) / (0.13 * b.etalement + 0.006),
    (a.solidite - b.solidite) / 0.10,
    (a.rayonRel - b.rayonRel) / 0.16
  ];
  let sf = 0;
  for (const v of f) sf += v * v;
  s += poidsForme * sf / 4;
  const dk = Math.log(Math.max(1e-3, a.area / b.area)) / 0.32;
  s += 0.6 * dk * dk;
  return Math.sqrt(s);
}

/* Regroupement des pièces qui se ressemblent. */
function regrouper(sigs, finesse, poidsForme) {
  const ordre = sigs.map((s, i) => i).sort((i, j) => sigs[j].area - sigs[i].area);
  const grappes = [];
  ordre.forEach(i => {
    const s = sigs[i];
    let best = -1, bestD = Infinity;
    grappes.forEach((g, k) => {
      const d = distancePieces(s, g.centre, poidsForme);
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best >= 0 && bestD <= finesse) {
      const g = grappes[best];
      g.membres.push(i);
      const n = g.membres.length;
      const c = g.centre;
      ['elong', 'etalement', 'solidite', 'rayonRel', 'area'].forEach(k => { c[k] += (s[k] - c[k]) / n; });
      c.rgb = c.rgb.map((v, q) => v + (s.rgb[q] - v) / n);
      c.lab = rgbToLab(c.rgb[0], c.rgb[1], c.rgb[2]);
      c.accent = c.accent.map((v, q) => v + (s.accent[q] - v) / n);
      c.labAccent = rgbToLab(c.accent[0], c.accent[1], c.accent[2]);
    } else {
      grappes.push({
        centre: { ...s, rgb: [...s.rgb], lab: [...s.lab], accent: [...s.accent], labAccent: [...s.labAccent] },
        membres: [i]
      });
    }
  });
  // fusion des grappes trop proches
  for (let a = 0; a < grappes.length; a++) {
    for (let b = a + 1; b < grappes.length; b++) {
      if (distancePieces(grappes[a].centre, grappes[b].centre, poidsForme) <= finesse * 0.8) {
        grappes[a].membres.push(...grappes[b].membres);
        grappes.splice(b, 1); b--;
      }
    }
  }
  return grappes;
}

/* ============================================ RÉPARTITION AUTOUR DE POINTS

   Principe de l'édition manuelle : un point posé sur la photo vaut une pièce,
   qu'il vienne de la détection ou d'un clic. Chaque forme du masque est
   partagée entre les points qu'elle contient, si bien que retirer un contour
   qui englobait trois pièces puis cliquer trois fois découpe la forme en
   trois. Un point posé hors du masque reçoit un carré de la taille courante
   des autres pièces. */

function repartir(labels, w, h, graines, cote) {
  const n = w * h;
  const carte = new Int32Array(n);
  const file = new Int32Array(n);
  const compDe = [];
  let tete = 0, queue = 0;

  graines.forEach((g, k) => {
    const x = Math.round(g.x), y = Math.round(g.y);
    const dedans = x >= 0 && y >= 0 && x < w && y < h;
    const L = dedans ? labels[y * w + x] : 0;
    compDe[k] = L;
    if (L > 0) {
      const i = y * w + x;
      if (!carte[i]) { carte[i] = k + 1; file[queue++] = i; }
    }
  });

  while (tete < queue) {
    const p = file[tete++];
    const k = carte[p] - 1, L = compDe[k];
    const x = p % w, y = (p / w) | 0;
    const v = q => { if (labels[q] === L && !carte[q]) { carte[q] = k + 1; file[queue++] = q; } };
    if (x > 0) v(p - 1);
    if (x < w - 1) v(p + 1);
    if (y > 0) v(p - w);
    if (y < h - 1) v(p + w);
  }

  const demi = Math.max(4, Math.round(cote / 2));
  graines.forEach((g, k) => {
    if (compDe[k] > 0) return;
    const cx = Math.round(g.x), cy = Math.round(g.y);
    for (let y = cy - demi; y <= cy + demi; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = cx - demi; x <= cx + demi; x++) {
        if (x < 0 || x >= w) continue;
        const i = y * w + x;
        if (!carte[i]) carte[i] = k + 1;
      }
    }
  });

  const regions = graines.map((g, k) => ({
    label: k + 1, area: 0, sx: 0, sy: 0,
    minX: w, maxX: 0, minY: h, maxY: 0,
    cx: g.x, cy: g.y, libre: compDe[k] === 0
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = carte[y * w + x];
      if (!k) continue;
      const r = regions[k - 1];
      r.area++; r.sx += x; r.sy += y;
      if (x < r.minX) r.minX = x; if (x > r.maxX) r.maxX = x;
      if (y < r.minY) r.minY = y; if (y > r.maxY) r.maxY = y;
    }
  }
  regions.forEach(r => { if (r.area) { r.cx = r.sx / r.area; r.cy = r.sy / r.area; } });
  return { carte, regions };
}

/* ====================================================== CHARGEMENT D'IMAGE */

async function fileToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { try { return await createImageBitmap(file); } catch (e2) { /* suite */ } }
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
  const sc = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, w, h);
  return cv.getContext('2d').getImageData(0, 0, w, h);
}

function premiereImage(list) {
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const f = list[i].getAsFile ? list[i].getAsFile() : list[i];
    if (f && f.type && f.type.startsWith('image/')) return f;
  }
  return null;
}

function vignette(imageData, p, masque, bw, bh, maxSize = 110) {
  const cv = document.createElement('canvas');
  cv.width = bw; cv.height = bh;
  const ctx = cv.getContext('2d');
  const out = ctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!masque[y * bw + x]) continue;
      const si = ((p.minY + y) * imageData.width + (p.minX + x)) * 4;
      const di = (y * bw + x) * 4;
      out.data[di] = imageData.data[si];
      out.data[di + 1] = imageData.data[si + 1];
      out.data[di + 2] = imageData.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const sc = Math.min(1, maxSize / Math.max(bw, bh));
  if (sc < 1) {
    const s = document.createElement('canvas');
    s.width = Math.max(1, Math.round(bw * sc));
    s.height = Math.max(1, Math.round(bh * sc));
    const c2 = s.getContext('2d');
    c2.imageSmoothingQuality = 'high';
    c2.drawImage(cv, 0, 0, s.width, s.height);
    return s.toDataURL('image/png');
  }
  return cv.toDataURL('image/png');
}

const cssRgb = rgb => `rgb(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0})`;

/* ============================================== SÉLECTEUR « MONTRE-MOI UNE PIÈCE » */

function SelecteurTaille({ bitmap, largeur, hauteur, darkMode, onValider, onAnnuler }) {
  const cvRef = useRef(null);
  const [rect, setRect] = useState(null);
  const depart = useRef(null);

  const redraw = useCallback(r => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.width = largeur; cv.height = hauteur;
    const ctx = cv.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    if (r && r.w > 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, largeur, hauteur);
      ctx.drawImage(bitmap, 0, 0, bitmap.width || bitmap.naturalWidth, bitmap.height || bitmap.naturalHeight,
        0, 0, largeur, hauteur);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, largeur, r.y);
      ctx.fillRect(0, r.y + r.h, largeur, hauteur - r.y - r.h);
      ctx.fillRect(0, r.y, r.x, r.h);
      ctx.fillRect(r.x + r.w, r.y, largeur - r.x - r.w, r.h);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = Math.max(2, largeur / 250);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  }, [bitmap, largeur, hauteur]);

  useEffect(() => { redraw(rect); }, [redraw, rect]);

  const pos = e => {
    const cv = cvRef.current, b = cv.getBoundingClientRect();
    const p = e.touches && e.touches[0] ? e.touches[0] : e;
    return [
      Math.max(0, Math.min(largeur, (p.clientX - b.left) * (largeur / b.width))),
      Math.max(0, Math.min(hauteur, (p.clientY - b.top) * (hauteur / b.height)))
    ];
  };
  const down = e => { e.preventDefault(); depart.current = pos(e); setRect(null); };
  const move = e => {
    if (!depart.current) return;
    e.preventDefault();
    const [x, y] = pos(e), [sx, sy] = depart.current;
    setRect({ x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) });
  };
  const up = e => { if (depart.current) { e.preventDefault(); depart.current = null; } };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80">
      <div className={'w-full max-w-2xl rounded-2xl shadow-2xl p-4 space-y-3 max-h-full overflow-auto ' + (darkMode ? 'bg-gray-800' : 'bg-white')}>
        <h3 className={'font-semibold ' + (darkMode ? 'text-gray-100' : 'text-gray-800')}>Montre-moi une pièce</h3>
        <p className={'text-sm ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>
          Trace un cadre autour d'<strong>une seule</strong> pièce. Le cadre reste affiché tant que
          tu n'as pas validé. Cela sert à connaître la taille d'une pièce, ce qui permet de compter
          correctement les pièces collées les unes aux autres.
        </p>
        <canvas ref={cvRef}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}
          className="w-full rounded-xl border border-black/20"
          style={{ touchAction: 'none', cursor: 'crosshair' }} />
        <div className="flex gap-2">
          <button
            onClick={() => { if (rect && rect.w > 8 && rect.h > 8) onValider(rect); }}
            disabled={!rect || rect.w <= 8 || rect.h <= 8}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-40">
            Valider ce cadre
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
  const [jeux, setJeux] = useState({});
  const [jeu, setJeu] = useState('');
  const [nouveauJeu, setNouveauJeu] = useState('');
  const [toast, setToast] = useState('');

  const [bitmap, setBitmap] = useState(null);
  const [imgData, setImgData] = useState(null);
  const [res, setRes] = useState(null);
  const [groupes, setGroupes] = useState([]);
  const [graines, setGraines] = useState([]);
  const [zonage, setZonage] = useState(null);
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [voirMasque, setVoirMasque] = useState(false);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [selecteur, setSelecteur] = useState(false);
  const [pointeFond, setPointeFond] = useState(false);
  const [glisse, setGlisse] = useState(false);

  const [opts, setOpts] = useState({
    sensibilite: 1,
    ignorerOmbres: true,
    separer: true,
    finesse: 0.9,
    poidsForme: 1,
    resolution: 800,
    aireRef: 0,
    fondRef: null
  });

  const cvRef = useRef(null);
  const camRef = useRef(null);
  const galRef = useRef(null);

  const gabarits = jeu && jeux[jeu] && jeux[jeu].gabarits ? jeux[jeu].gabarits : null;

  useEffect(() => {
    setDarkMode(localStorage.getItem('darkMode') === 'true');
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setJeux(JSON.parse(s)); }
    catch (e) { console.error(e); }
  }, []);

  const flash = m => { setToast(m); setTimeout(() => setToast(''), 3200); };
  const enregistrer = n => {
    setJeux(n);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)); }
    catch (e) { flash('Mémoire pleine'); }
  };

  /* ----------------------------------------------------------- analyse */

  /* Reconstruit contours et groupes à partir d'un jeu de points. Appelé à
     l'analyse, puis à chaque clic d'ajout ou de retrait. */
  const construire = useCallback((data, r, gr, o) => {
    const cote = Math.sqrt(r.M || 900);
    const { carte: cc, regions: rg } = repartir(r.labels, r.w, r.h, gr, cote);
    const idx = [], sigs = [];
    rg.forEach((reg, k) => {
      if (reg.area < 12) return;
      idx.push(k);
      sigs.push(signature(data, cc, reg));
    });
    let gs = [];
    if (sigs.length) {
      const grappes = regrouper(sigs, o.finesse, o.poidsForme);
      gs = grappes.map((g, k) => {
        const rep = g.membres.reduce((a, b) =>
          distancePieces(sigs[a], g.centre, o.poidsForme) <= distancePieces(sigs[b], g.centre, o.poidsForme) ? a : b);
        const sg = sigs[rep];
        return {
          cle: 'g' + k,
          nom: '',
          rgb: g.centre.rgb,
          signature: {
            rgb: g.centre.rgb.map(v => Math.round(v)), lab: g.centre.lab,
            accent: g.centre.accent.map(v => Math.round(v)), labAccent: g.centre.labAccent,
            elong: g.centre.elong, etalement: g.centre.etalement,
            solidite: g.centre.solidite, rayonRel: g.centre.rayonRel, area: g.centre.area
          },
          vignette: vignette(data, rg[idx[rep]], sg.masque, sg.bw, sg.bh),
          membres: g.membres.map(m => idx[m]),
          attendu: null
        };
      });
      gs.sort((a, b) => b.membres.length - a.membres.length);
      if (gabarits) {
        gs.forEach(g => {
          let best = null, bestD = Infinity;
          gabarits.forEach(gb => {
            const d = distancePieces(g.signature, gb, o.poidsForme);
            if (d < bestD) { bestD = d; best = gb; }
          });
          if (best && bestD <= 1.6) { g.nom = best.nom; g.attendu = best.attendu; g.vignette = best.vignette || g.vignette; }
        });
      }
    }
    rg.forEach((reg, k) => {
      const g = gs.find(x => x.membres.includes(k));
      reg.groupe = g ? g.cle : null;
      reg.rgb = g ? g.rgb : [160, 160, 160];
    });
    return { carte: cc, regions: rg, groupes: gs };
  }, [gabarits]);

  const lancer = useCallback(async (data, o) => {
    if (!data) return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 40));
    try {
      const r = analyser(data, o);
      const gr = r.pieces.map(p => ({ x: p.cx, y: p.cy }));
      const out = construire(data, r, gr, o);
      setRes(r);
      setGraines(gr);
      setZonage(out.carte);
      setRegions(out.regions);
      setGroupes(out.groupes);
    } catch (e) {
      console.error(e);
      flash("L'analyse a échoué");
    }
    setBusy(false);
  }, [construire]);

  const charger = async f => {
    if (!f) return;
    setBusy(true); setRes(null); setGroupes([]);
    try {
      const bmp = await fileToBitmap(f);
      const d = drawToImageData(bmp, opts.resolution);
      setBitmap(bmp); setImgData(d);
      const o = { ...opts, aireRef: 0, fondRef: null };
      setOpts(o);
      await lancer(d, o);
    } catch (e) { console.error(e); flash('Image illisible'); setBusy(false); }
  };

  useEffect(() => {
    const onPaste = e => {
      const f = premiereImage(e.clipboardData && e.clipboardData.items);
      if (f) { e.preventDefault(); charger(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  /* ----------------------------------------------------------- totaux */

  const nbGroupe = g => g.membres.length;
  const total = groupes.reduce((s, g) => s + g.membres.length, 0);

  /* ----------------------------------------------------------- dessin */

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !bitmap || !res || !zonage) return;
    const w = res.w, h = res.h;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);

    if (voirMasque && res.mask) {
      const ov = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        if (res.mask[i]) { ov.data[i * 4 + 1] = 255; ov.data[i * 4 + 2] = 130; ov.data[i * 4 + 3] = 110; }
      }
      const t = document.createElement('canvas');
      t.width = w; t.height = h;
      t.getContext('2d').putImageData(ov, 0, 0);
      ctx.drawImage(t, 0, 0);
    }

    /* Liseré : on ne garde que les pixels de bordure de chaque région. La
       couleur du trait s'adapte à la pièce pour rester lisible dessus. */
    const base = ctx.getImageData(0, 0, w, h);
    const d = base.data;
    const trait = [];
    regions.forEach(r => {
      const c = r.rgb || [160, 160, 160];
      const clair = (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 140;
      trait.push(clair ? [15, 15, 20] : [255, 255, 255]);
    });
    const epais = res.w > 1100 ? 2 : 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const k = zonage[i];
        if (!k) continue;
        const bord =
          (x === 0 || zonage[i - 1] !== k) || (x === w - 1 || zonage[i + 1] !== k) ||
          (y === 0 || zonage[i - w] !== k) || (y === h - 1 || zonage[i + w] !== k);
        if (!bord) continue;
        const t = trait[k - 1];
        for (let dy = 0; dy < epais; dy++) {
          for (let dx = 0; dx < epais; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= w || yy >= h) continue;
            const q = (yy * w + xx) * 4;
            d[q] = t[0]; d[q + 1] = t[1]; d[q + 2] = t[2];
          }
        }
      }
    }
    ctx.putImageData(base, 0, 0);

    // petit point au centre de chaque pièce, pour savoir où toucher
    const rp = Math.max(2, w / 260);
    regions.forEach((r, k) => {
      if (!r.area) return;
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, rp, 0, Math.PI * 2);
      ctx.fillStyle = r.libre ? 'rgba(250,204,21,0.95)' : 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [bitmap, res, zonage, regions, voirMasque]);

  const clic = e => {
    if (!res) return;
    const cv = cvRef.current, b = cv.getBoundingClientRect();
    const x = (e.clientX - b.left) * (cv.width / b.width);
    const y = (e.clientY - b.top) * (cv.height / b.height);

    if (pointeFond && imgData) {
      // moyenne d'un petit carré autour du doigt, pour ne pas tomber sur un grain
      const r = 6;
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let yy = Math.max(0, Math.round(y) - r); yy <= Math.min(res.h - 1, Math.round(y) + r); yy++) {
        for (let xx = Math.max(0, Math.round(x) - r); xx <= Math.min(res.w - 1, Math.round(x) + r); xx++) {
          const q = (yy * res.w + xx) * 4;
          sr += imgData.data[q]; sg += imgData.data[q + 1]; sb += imgData.data[q + 2]; sn++;
        }
      }
      setPointeFond(false);
      appliquer({ fondRef: [sr / sn, sg / sn, sb / sn] });
      flash('Couleur du fond prise en compte');
      return;
    }

    if (!zonage) return;
    const xi = Math.max(0, Math.min(res.w - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(res.h - 1, Math.round(y)));
    const k = zonage[yi * res.w + xi];

    /* Toucher un contour retire la pièce ; toucher ailleurs en pose une.
       Après avoir retiré un contour qui en englobait plusieurs, chaque clic
       à l'intérieur de la forme y découpe une pièce de plus. */
    const gr = k > 0
      ? graines.filter((_, i) => i !== k - 1)
      : [...graines, { x, y }];

    const out = construire(imgData, res, gr, opts);
    setGraines(gr);
    setZonage(out.carte);
    setRegions(out.regions);
    setGroupes(gs => out.groupes.map(g => {
      const ancien = gs.find(a => a.nom && a.cle === g.cle);
      return ancien ? { ...g, nom: ancien.nom } : g;
    }));
  };

  /* ----------------------------------------------------------- gabarits */

  const memoriser = () => {
    if (!jeu) { flash("Choisis d'abord un jeu"); return; }
    if (groupes.some(g => !g.nom.trim())) { flash('Nomme chaque groupe avant d\u2019enregistrer'); return; }
    const gab = groupes.map((g, k) => ({
      id: 'gb' + Date.now() + '_' + k,
      nom: g.nom.trim(),
      attendu: nbGroupe(g),
      vignette: g.vignette,
      ...g.signature
    }));
    enregistrer({ ...jeux, [jeu]: { ...jeux[jeu], gabarits: gab } });
    flash('Pièces de ' + jeu + ' mémorisées');
  };

  const creerJeu = () => {
    const n = nouveauJeu.trim();
    if (!n) return;
    if (!jeux[n]) enregistrer({ ...jeux, [n]: { gabarits: [] } });
    setJeu(n); setNouveauJeu('');
  };

  const supprimerJeu = n => {
    const x = { ...jeux }; delete x[n];
    enregistrer(x);
    if (jeu === n) setJeu('');
  };

  const copier = () => {
    const l = groupes.map(g => (g.nom || 'Groupe') + ' : ' + nbGroupe(g)).join('\n');
    const t = (jeu || 'Comptage') + ' — ' + total + ' pièce' + (total > 1 ? 's' : '') + '\n' + l;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => flash('Copié'), () => flash('Copie impossible'));
  };

  /* ----------------------------------------------------------- styles */

  const carte = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const T = darkMode ? 'text-gray-100' : 'text-gray-800';
  const S = darkMode ? 'text-gray-400' : 'text-gray-500';
  const champ = darkMode ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400';
  const neutre = darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-700'
    : 'border-gray-200 text-gray-600 hover:bg-gray-50';

  const appliquer = patch => {
    const o = { ...opts, ...patch };
    setOpts(o);
    if (imgData) lancer(imgData, o);
  };

  return (
    <div className={'min-h-screen ' + (darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100')}>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-2xl">
          {toast}
        </div>
      )}

      {selecteur && bitmap && res && (
        <SelecteurTaille bitmap={bitmap} largeur={res.w} hauteur={res.h} darkMode={darkMode}
          onAnnuler={() => setSelecteur(false)}
          onValider={r => {
            setSelecteur(false);
            const aire = Math.round(r.w * r.h * 0.72);
            appliquer({ aireRef: aire });
            flash('Taille de référence prise en compte');
          }} />
      )}

      <div className="py-6 px-4">
        <div className="max-w-3xl mx-auto space-y-5">

          <div className={carte + ' border rounded-2xl shadow-xl p-5 flex items-center justify-between gap-3'}>
            <div className="flex items-center gap-3">
              <button onClick={() => window.history.back()}
                className={'p-2 rounded-xl ' + (darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div>
                <h1 className={'text-2xl font-bold ' + T}>Comptage photo</h1>
                <p className={'text-sm ' + S}>Une photo, les pièces sont trouvées et comptées</p>
              </div>
            </div>
            <button onClick={() => { const v = !darkMode; setDarkMode(v); localStorage.setItem('darkMode', String(v)); }}
              className={'p-2.5 rounded-xl ' + (darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-700')}>
              {darkMode
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
            </button>
          </div>

          {/* Photo */}
          <div
            onDragOver={e => { e.preventDefault(); setGlisse(true); }}
            onDragLeave={e => { if (e.currentTarget === e.target) setGlisse(false); }}
            onDrop={e => { e.preventDefault(); setGlisse(false); const f = premiereImage(e.dataTransfer && e.dataTransfer.files); if (f) charger(f); }}
            className={carte + ' border rounded-2xl shadow-xl p-5 space-y-4 ' + (glisse ? 'ring-2 ring-blue-500' : '')}>

            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { charger(e.target.files && e.target.files[0]); e.target.value = ''; }} />
            <input ref={galRef} type="file" accept="image/*" className="hidden"
              onChange={e => { charger(e.target.files && e.target.files[0]); e.target.value = ''; }} />

            <div className="flex flex-wrap gap-2">
              <button onClick={() => camRef.current && camRef.current.click()}
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium">
                Prendre une photo
              </button>
              <button onClick={() => galRef.current && galRef.current.click()}
                className={'px-4 py-3 rounded-xl font-medium border ' + neutre}>
                Choisir une image
              </button>
              {res && (
                <>
                  <button onClick={() => { setPointeFond(v => !v); }}
                    className={'px-4 py-3 rounded-xl font-medium border ' + (pointeFond ? 'bg-amber-500 border-amber-500 text-black' : (opts.fondRef ? 'bg-emerald-600 border-emerald-600 text-white' : neutre))}>
                    {pointeFond ? 'Touche le fond sur la photo…' : 'Montre-moi le fond'}
                  </button>
                  <button onClick={() => setSelecteur(true)}
                    className={'px-4 py-3 rounded-xl font-medium border ' + (opts.aireRef ? 'bg-emerald-600 border-emerald-600 text-white' : neutre)}>
                    Montre-moi une pièce
                  </button>
                  <button onClick={() => setVoirMasque(v => !v)}
                    className={'px-4 py-3 rounded-xl font-medium border ' + (voirMasque ? 'bg-emerald-600 border-emerald-600 text-white' : neutre)}>
                    Voir le masque
                  </button>
                </>
              )}
              <button onClick={() => setReglagesOuverts(v => !v)} className={'px-4 py-3 rounded-xl font-medium border ' + neutre}>
                Réglages
              </button>
            </div>

            <p className={'text-xs ' + S}>
              Sur ordinateur, tu peux glisser une image ici ou la coller avec Ctrl+V.
            </p>

            {reglagesOuverts && (
              <div className={'rounded-xl p-4 space-y-4 ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                <Curseur label="Sensibilité" darkMode={darkMode}
                  aide="Vers la gauche, attrape les pièces peu contrastées (blanc sur clair). Vers la droite, ignore ce qui ressemble au fond."
                  value={opts.sensibilite} min={0.6} max={1.6} step={0.05}
                  onFin={v => appliquer({ sensibilite: v })} />
                <Curseur label="Finesse des groupes" darkMode={darkMode}
                  aide="Vers la gauche, sépare des pièces presque semblables en groupes distincts. Vers la droite, les rassemble."
                  value={opts.finesse} min={0.6} max={2.2} step={0.05}
                  onFin={v => appliquer({ finesse: v })} />
                <Curseur label="Importance de la forme" darkMode={darkMode}
                  aide="À zéro, seules la couleur et la taille comptent. Utile quand plusieurs pièces de formes différentes ont la même couleur."
                  value={opts.poidsForme} min={0} max={2.5} step={0.1}
                  onFin={v => appliquer({ poidsForme: v })} />
                <Case label="Séparer les pièces qui se touchent" darkMode={darkMode}
                  aide="Découpe les amas et leur attribue le bon nombre"
                  checked={opts.separer} onChange={v => appliquer({ separer: v })} />
                <Case label="Ignorer les ombres" darkMode={darkMode}
                  aide="Reconnaît une ombre au fait qu'elle assombrit les trois couleurs à l'identique"
                  checked={opts.ignorerOmbres} onChange={v => appliquer({ ignorerOmbres: v })} />
                {opts.fondRef && (
                  <button onClick={() => appliquer({ fondRef: null })} className={'text-sm underline block ' + S}>
                    Oublier la couleur de fond indiquée
                  </button>
                )}
                {opts.aireRef > 0 && (
                  <button onClick={() => appliquer({ aireRef: 0 })} className={'text-sm underline ' + S}>
                    Oublier la pièce de référence
                  </button>
                )}
              </div>
            )}

            {busy && (
              <div className={'flex items-center gap-3 text-sm ' + S}>
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Analyse en cours…
              </div>
            )}

            {bitmap && (
              <div>
                <canvas ref={cvRef} onClick={clic} className="w-full rounded-xl cursor-pointer"
                  style={{ touchAction: 'manipulation' }} />
                {res && (
                  <div className={'text-xs mt-2 leading-relaxed ' + S}>
                    <p>
                      Touche une pièce entourée pour la retirer, touche une pièce oubliée pour
                      l'ajouter. Si un contour en englobe plusieurs d'un coup, retire-le puis
                      touche chaque pièce : le contour se redécoupe autour de chaque point.
                    </p>
                    <p className="mt-1 flex items-center gap-2 flex-wrap">
                      <span>{Math.round(res.fraction * 100)} % de l'image vue comme des pièces.</span>
                      {res.fondEstime && (
                        <span className="inline-flex items-center gap-1">
                          Fond retenu
                          <span className="inline-block w-4 h-4 rounded border border-black/20 align-middle"
                            style={{ background: cssRgb(res.fondEstime) }} />
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {res && res.avertissement === 'fondDouteux' && (
              <div className="rounded-xl px-4 py-3 text-sm bg-red-500/15 text-red-700 border border-red-500/30">
                Je n'arrive pas à distinguer le fond des pièces sur cette photo
                ({Math.round(res.fraction * 100)} % de l'image ressemble à une pièce).
                Appuie sur « Montre-moi le fond » puis touche la table à un endroit vide.
                Si ça ne suffit pas, refais la photo en laissant un peu de marge tout autour
                des pièces, sur un support uni.
              </div>
            )}
            {res && res.avertissement === 'entassement' && (
              <div className="rounded-xl px-4 py-3 text-sm bg-red-500/15 text-red-700 border border-red-500/30">
                Les pièces se touchent bord à bord et forment une seule masse. Je peux encore
                donner un ordre de grandeur si tu utilises « Montre-moi une pièce », mais le
                détail par couleur ne sera pas fiable. Pour un compte exact, écarte-les d'un
                demi-centimètre les unes des autres : c'est le seul geste qui change tout.
                Le fond, lui, peut être n'importe quoi.
              </div>
            )}
            {res && res.avertissement === 'tailleInconnue' && (
              <div className="rounded-xl px-4 py-3 text-sm bg-amber-500/15 text-amber-700 border border-amber-500/30">
                Je ne vois qu'une seule forme. Si c'est bien une pièce unique, le compte est bon.
                Si ce sont plusieurs pièces posées bord à bord, écarte-les légèrement les unes
                des autres et reprends la photo : c'est ce qui permet de les compter une par une.
                Le fond, lui, peut être n'importe quoi.
              </div>
            )}
            {res && res.avertissement === 'amas' && (
              <div className="rounded-xl px-4 py-3 text-sm bg-amber-500/15 text-amber-700 border border-amber-500/30">
                Des pièces se touchent. Leur nombre est déduit de la surface — vérifie les cadres orange.
              </div>
            )}
          </div>

          {/* Résultat */}
          {res && groupes.length > 0 && (
            <div className={carte + ' border rounded-2xl shadow-xl p-5 space-y-4'}>
              <div className="flex items-baseline justify-between">
                <h2 className={'font-semibold ' + T}>Résultat</h2>
                <div className={'text-3xl font-bold ' + T}>
                  {total}<span className={'text-sm font-normal ml-2 ' + S}>pièces</span>
                </div>
              </div>

              <div className="space-y-2">
                {groupes.map(g => {
                  const n = nbGroupe(g);
                  const ecart = g.attendu != null ? n - g.attendu : null;
                  return (
                    <div key={g.cle} className={'flex items-center gap-3 p-3 rounded-xl ' + (darkMode ? 'bg-gray-900' : 'bg-gray-50')}>
                      <div className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg"
                        style={{ background: darkMode ? '#111827' : '#fff' }}>
                        {g.vignette
                          ? <img src={g.vignette} alt="" className="max-w-full max-h-full object-contain" />
                          : <span className="w-6 h-6 rounded" style={{ background: cssRgb(g.rgb) }} />}
                      </div>
                      <input value={g.nom} placeholder="Nommer ces pièces"
                        onChange={e => {
                          const v = e.target.value;
                          setGroupes(gs => gs.map(x => x.cle === g.cle ? { ...x, nom: v } : x));
                        }}
                        className={'flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border text-sm ' + champ} />
                      {ecart != null && (
                        <span className={'text-xs font-medium shrink-0 ' + (ecart === 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {ecart === 0 ? '✓' : (ecart > 0 ? '+' + ecart : ecart)}
                        </span>
                      )}
                      <span className={'w-10 text-center text-lg font-bold shrink-0 ' + T}>{n}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={copier} className={'px-4 py-2.5 rounded-xl text-sm font-medium border ' + neutre}>
                  Copier le résultat
                </button>
                {jeu && (
                  <button onClick={memoriser}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white">
                    Mémoriser ces pièces pour {jeu}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Jeu */}
          <div className={carte + ' border rounded-2xl shadow-xl p-5 space-y-3'}>
            <h2 className={'font-semibold ' + T}>Jeu</h2>
            <p className={'text-sm ' + S}>
              Facultatif. Une fois les groupes nommés et mémorisés, les photos suivantes du même jeu
              seront étiquetées toutes seules et comparées aux quantités attendues.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setJeu('')}
                className={'px-3 py-2 rounded-xl text-sm font-medium border ' + (jeu === '' ? 'bg-blue-600 border-blue-600 text-white' : neutre)}>
                Aucun
              </button>
              {Object.keys(jeux).sort().map(n => (
                <span key={n} className="relative">
                  <button onClick={() => setJeu(n)}
                    className={'pl-3 pr-7 py-2 rounded-xl text-sm font-medium border ' + (jeu === n ? 'bg-blue-600 border-blue-600 text-white' : neutre)}>
                    {n}
                    {jeux[n].gabarits && jeux[n].gabarits.length > 0 && <span className="ml-1.5 opacity-70">· {jeux[n].gabarits.length}</span>}
                  </button>
                  <button onClick={() => supprimerJeu(n)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-xs">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={nouveauJeu} onChange={e => setNouveauJeu(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && creerJeu()}
                placeholder="Nom d'un jeu (ex : Azul)"
                className={'flex-1 px-3 py-2 rounded-xl border text-sm ' + champ} />
              <button onClick={creerJeu} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                Ajouter
              </button>
            </div>
          </div>

          {res && groupes.length === 0 && !busy && (
            <div className={carte + ' border rounded-2xl shadow-xl p-5'}>
              <p className={'text-sm leading-relaxed ' + S}>
                Aucune pièce trouvée. Baisse la sensibilité dans les réglages, ou vérifie avec
                « Voir le masque » ce que l'outil isole.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Sous-composants */

function Curseur({ label, aide, value, min, max, step, onFin, darkMode }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={'text-sm font-medium ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>{label}</label>
        <span className={'text-sm tabular-nums ' + (darkMode ? 'text-gray-400' : 'text-gray-500')}>{Number(v).toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => setV(parseFloat(e.target.value))}
        onMouseUp={e => onFin(parseFloat(e.target.value))}
        onTouchEnd={e => onFin(parseFloat(e.target.value))}
        className="w-full accent-blue-600" />
      <p className={'text-xs mt-0.5 ' + (darkMode ? 'text-gray-500' : 'text-gray-400')}>{aide}</p>
    </div>
  );
}

function Case({ label, aide, checked, onChange, darkMode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-blue-600" />
      <span>
        <span className={'text-sm font-medium block ' + (darkMode ? 'text-gray-200' : 'text-gray-700')}>{label}</span>
        <span className={'text-xs ' + (darkMode ? 'text-gray-500' : 'text-gray-400')}>{aide}</span>
      </span>
    </label>
  );
}
