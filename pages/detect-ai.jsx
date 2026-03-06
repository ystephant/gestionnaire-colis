"use client";
import { useState, useRef, useCallback } from "react";

// ── EXIF loader (CDN, runs client-side only) ──────────────────────────────────
let _exifrReady = false;
const loadExifr = () =>
  new Promise((resolve) => {
    if (_exifrReady) return resolve(window.exifr?.parse);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/exifr/dist/full.umd.js";
    s.onload = () => { _exifrReady = true; resolve(window.exifr?.parse); };
    document.head.appendChild(s);
  });

// ── Compress image before sending to HuggingFace ─────────────────────────────
function compressImage(dataUrl, maxSizeKb = 700, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Scale down if needed
      const MAX_DIM = 1024;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Try to compress until under maxSizeKb
      let q = quality;
      const tryCompress = () => {
        const result = canvas.toDataURL("image/jpeg", q);
        const sizeKb = (result.length * 3) / 4 / 1024;
        if (sizeKb > maxSizeKb && q > 0.3) {
          q -= 0.1;
          tryCompress();
        } else {
          resolve(result);
        }
      };
      tryCompress();
    };
    img.src = dataUrl;
  });
}

// ── EXIF helpers ──────────────────────────────────────────────────────────────
const META_LABELS = {
  Make: "Fabricant", Model: "Modèle", Software: "Logiciel",
  DateTimeOriginal: "Date de prise de vue", DateTime: "Date fichier",
  ISO: "ISO", FNumber: "Ouverture", ExposureTime: "Vitesse",
  FocalLength: "Focale", LensModel: "Objectif", Flash: "Flash",
  GPSLatitude: "Latitude", GPSLongitude: "Longitude",
  ExifImageWidth: "Largeur", ExifImageHeight: "Hauteur",
  ColorSpace: "Espace colorimétrique", WhiteBalance: "Balance blancs",
  Orientation: "Orientation", Artist: "Auteur", Copyright: "Copyright",
};

const AI_SOFTWARE_KW = [
  "midjourney","dall-e","dalle","stable diffusion","firefly","leonardo",
  "runway","flux","dreamstudio","novelai","nightcafe","bing image","generative",
  "diffusion","adobe firefly","canva ai","civitai","imagine ai",
];

function fmtMeta(k, v) {
  if (v == null) return "—";
  if (k === "ExposureTime") return v < 1 ? `1/${Math.round(1/v)}s` : `${v}s`;
  if (k === "FNumber") return `f/${v}`;
  if (k === "FocalLength") return `${v} mm`;
  if (k === "Flash") return v === 0 ? "Non déclenché" : "Déclenché";
  if (k === "WhiteBalance") return v === 0 ? "Auto" : "Manuel";
  if (k === "GPSLatitude" || k === "GPSLongitude")
    return Array.isArray(v) ? v.map(x => (+x).toFixed(4)).join("° ") + "°" : (+v).toFixed(6) + "°";
  if (v instanceof Date) return v.toLocaleString("fr-FR");
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function isSuspectSoftware(sw) {
  if (!sw) return false;
  const s = sw.toLowerCase();
  return AI_SOFTWARE_KW.some(kw => s.includes(kw));
}

// ── Score → verdict ───────────────────────────────────────────────────────────
function buildVerdict(hfResults, metadata) {
  const artificial = hfResults.find(r =>
    r.label.toLowerCase().includes("artificial") ||
    r.label.toLowerCase().includes("ai") ||
    r.label.toLowerCase().includes("fake")
  );
  const human = hfResults.find(r =>
    r.label.toLowerCase().includes("human") ||
    r.label.toLowerCase().includes("real")
  );

  const aiScore = artificial ? Math.round(artificial.score * 100) : 0;
  const humanScore = human ? Math.round(human.score * 100) : 100 - aiScore;

  const softwareSuspect = isSuspectSoftware(metadata?.Software);
  const noCamera = !metadata?.Make && !metadata?.Model;
  const noExif = metadata === null;

  let metaBoost = 0;
  if (softwareSuspect) metaBoost += 20;
  if (noExif) metaBoost += 10;
  if (noCamera && !noExif) metaBoost += 5;

  const adjustedAI = Math.min(100, aiScore + metaBoost);
  const adjustedHuman = Math.max(0, 100 - adjustedAI);

  let verdict, confidence;
  if (adjustedAI >= 70) { verdict = "ai_generated"; confidence = adjustedAI; }
  else if (adjustedAI >= 40) { verdict = "uncertain"; confidence = 50; }
  else { verdict = "human"; confidence = adjustedHuman; }

  const clues = [];
  if (softwareSuspect) clues.push(`⚠ Logiciel IA dans les métadonnées : "${metadata.Software}"`);
  if (noExif) clues.push("⚠ Aucune métadonnée EXIF — fréquent pour les images générées par IA");
  if (noCamera && !noExif) clues.push("⚠ Aucun fabricant/modèle d'appareil photo dans les métadonnées");
  if (metadata?.GPSLatitude) clues.push("✓ Coordonnées GPS présentes — signe d'une photo réelle");
  if (metadata?.Make && metadata?.Model) clues.push(`✓ Appareil détecté : ${metadata.Make} ${metadata.Model}`);

  return { verdict, confidence, aiScore: adjustedAI, humanScore: adjustedHuman, clues };
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#030508",
  panel: "#080d14",
  border: "#0f2040",
  borderHover: "#1a3a6a",
  green: "#00ff88",
  red: "#ff3b5c",
  orange: "#ff8c00",
  yellow: "#ffd700",
  blue: "#00aaff",
  dim: "#2a4060",
  muted: "#3a5070",
  text: "#c8ddf0",
  textDim: "#506880",
};

const VERDICT_CFG = {
  human: {
    label: "PHOTO AUTHENTIQUE",
    sub: "Aucune trace d'IA détectée",
    color: C.green,
    glyph: "██ CLEAN",
    scanColor: "#00ff8844",
  },
  ai_generated: {
    label: "GÉNÉRÉE PAR IA",
    sub: "Image entièrement synthétique",
    color: C.red,
    glyph: "▓▓ SYNTHETIC",
    scanColor: "#ff3b5c44",
  },
  uncertain: {
    label: "INCERTAIN",
    sub: "Analyse non concluante",
    color: C.yellow,
    glyph: "▒▒ UNKNOWN",
    scanColor: "#ffd70044",
  },
};

// ── Small components ──────────────────────────────────────────────────────────
function Bar({ value, color, label }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 1 }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 1, transition: "width 1.4s cubic-bezier(.23,1,.32,1)", boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", color, background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 3, padding: "2px 7px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function ScanAnim({ color }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animation: "scan 1.8s linear infinite", boxShadow: `0 0 8px ${color}` }} />
      <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${color}06 3px, ${color}06 4px)` }} />
    </div>
  );
}

function MetaTable({ metadata }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(META_LABELS).filter(k => metadata?.[k] != null);
  const priority = ["Make","Model","Software","DateTimeOriginal","ISO","FNumber","ExposureTime","FocalLength","LensModel","GPSLatitude","GPSLongitude","ExifImageWidth","ExifImageHeight"];
  const shown = open ? keys : keys.filter(k => priority.includes(k));
  const extra = keys.filter(k => !priority.includes(k));

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8 }}>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", letterSpacing: "0.12em", marginBottom: 10 }}>
        MÉTADONNÉES EXIF — {keys.length} CHAMP{keys.length !== 1 ? "S" : ""}
      </div>

      {!metadata ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 4 }}>
          <span style={{ color: C.red, fontSize: 12, fontFamily: "monospace" }}>⚠ AUCUNE MÉTADONNÉE — signal suspect</span>
        </div>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace" }}>Aucun champ standard reconnu.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            {shown.map(k => {
              const suspect = k === "Software" && isSuspectSoftware(metadata[k]);
              return (
                <div key={k} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}40`, alignItems: "baseline" }}>
                  <span style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace", minWidth: 90, flexShrink: 0, letterSpacing: "0.06em" }}>{META_LABELS[k]}</span>
                  <span style={{ fontSize: 11, color: suspect ? C.orange : C.text, fontFamily: "monospace", wordBreak: "break-all" }}>
                    {fmtMeta(k, metadata[k])}
                    {suspect && <span style={{ marginLeft: 6, fontSize: 9, color: C.orange }}>⚠</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {extra.length > 0 && (
            <button onClick={() => setOpen(o => !o)} style={{ marginTop: 10, fontSize: 10, color: C.blue, fontFamily: "monospace", background: "none", border: "none", cursor: "pointer", padding: 0, letterSpacing: "0.08em" }}>
              {open ? "▲ RÉDUIRE" : `▼ +${extra.length} CHAMPS SUPPLÉMENTAIRES`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Detector() {
  const [drag, setDrag] = useState(false);
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState(null);
  const [metadata, setMetadata] = useState(undefined);
  const [status, setStatus] = useState("idle"); // idle | loading_meta | ready | analyzing | retrying | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [log, setLog] = useState([]);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const addLog = (msg) => setLog(l => [...l.slice(-8), `> ${msg}`]);

  const processFile = useCallback(async (file) => {
    if (!file?.type.startsWith("image/")) return;
    clearTimeout(timerRef.current);
    setResult(null); setErrorMsg(""); setMetadata(undefined);
    setLog([]); setStatus("loading_meta");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImage(dataUrl);
      addLog(`Fichier chargé : ${file.name} (${(file.size/1024).toFixed(1)} Ko)`);

      // ── Compress image for API ──────────────────────────────────────────────
      try {
        addLog("Compression de l'image pour l'envoi…");
        const compressed = await compressImage(dataUrl, 700, 0.85);
        const compressedBase64 = compressed.split(",")[1];
        const compressedSizeKb = ((compressedBase64.length * 3) / 4 / 1024).toFixed(1);
        addLog(`Image compressée : ${compressedSizeKb} Ko (JPEG)`);
        setImageBase64(compressedBase64);
        setImageMime("image/jpeg");
      } catch {
        // Fallback: use original
        setImageBase64(dataUrl.split(",")[1]);
        setImageMime(file.type);
        addLog("Compression échouée — envoi de l'original");
      }

      // ── EXIF extraction ────────────────────────────────────────────────────
      try {
        addLog("Extraction des métadonnées EXIF…");
        const parse = await loadExifr();
        const raw = parse ? await parse(file, { xmp: true, iptc: true, gps: true }) : null;
        setMetadata(raw || null);
        if (raw) {
          addLog(`EXIF OK — ${Object.keys(raw).length} champs trouvés`);
          if (raw.Make || raw.Model) addLog(`Appareil : ${raw.Make || ""} ${raw.Model || ""}`.trim());
          if (isSuspectSoftware(raw.Software)) addLog(`⚠ Logiciel suspect : ${raw.Software}`);
        } else {
          addLog("⚠ Aucune métadonnée EXIF trouvée");
        }
      } catch {
        setMetadata(null);
        addLog("EXIF : erreur d'extraction");
      }
      setStatus("ready");
    };
    reader.readAsDataURL(file);
  }, []);

  const analyze = async (retry = false) => {
    if (!imageBase64) return;
    setStatus(retry ? "retrying" : "analyzing");
    setResult(null); setErrorMsg("");
    if (!retry) setLog(l => [...l, "── Début de l'analyse ──"]);
    addLog(retry ? "Nouvel essai (modèle en cours de chargement)…" : "Envoi au modèle Hugging Face…");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, imageMime }),
      });

      if (res.status === 503) {
        addLog("Modèle en démarrage (cold start ~20s)…");
        setStatus("retrying");
        timerRef.current = setTimeout(() => analyze(true), 22000);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const hfData = await res.json();
      addLog(`Réponse reçue — ${hfData.length} classe(s)`);

      hfData.forEach(r => addLog(`  ${r.label.padEnd(12)} : ${(r.score * 100).toFixed(1)}%`));

      const verdict = buildVerdict(hfData, metadata);
      addLog(`Verdict : ${verdict.verdict.toUpperCase()} (${verdict.confidence}% confiance)`);
      setResult(verdict);
      setStatus("done");
    } catch (err) {
      addLog(`ERREUR : ${err.message}`);
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setImage(null); setImageBase64(null); setImageMime(null);
    setMetadata(undefined); setResult(null); setErrorMsg("");
    setLog([]); setStatus("idle");
  };

  const cfg = result ? VERDICT_CFG[result.verdict] : null;
  const isAnalyzing = status === "analyzing" || status === "retrying";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "monospace", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        @keyframes scan { 0% { top: -2px } 100% { top: 100% } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes glitch {
          0%,100%{text-shadow:0 0 8px currentColor}
          25%{text-shadow:2px 0 8px currentColor,-2px 0 4px #ff3b5c}
          75%{text-shadow:-2px 0 8px currentColor,2px 0 4px #00aaff}
        }
        ::selection { background: ${C.green}33; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: ${C.panel}; }
        ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 760 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 32, animation: "fadeIn .5s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite", boxShadow: `0 0 8px ${C.green}` }} />
            <span style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.2em" }}>FORENSIC · v3.0 · HuggingFace</span>
          </div>
          <h1 style={{ fontSize: "clamp(20px,4vw,32px)", fontFamily: "'Share Tech Mono', monospace", color: C.green, letterSpacing: "0.04em", animation: "glitch 6s ease infinite", lineHeight: 1.2 }}>
            Y a-t-il de l'IA dans cette image ?
          </h1>
          <div style={{ marginTop: 6, height: 1, background: `linear-gradient(90deg, ${C.green}, ${C.dim}, transparent)` }} />
        </div>

        {/* ── Drop zone ── */}
        {!image && (
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); processFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            style={{ border: `1px dashed ${drag ? C.green : C.dim}`, borderRadius: 6, padding: "52px 24px", textAlign: "center", cursor: "pointer", background: drag ? `${C.green}05` : C.panel, transition: "all .2s", animation: "fadeIn .5s .1s ease both", position: "relative", overflow: "hidden" }}
          >
            {drag && <ScanAnim color={C.green} />}
            <div style={{ fontSize: 36, marginBottom: 14, opacity: drag ? 1 : 0.4 }}>⬛</div>
            <p style={{ fontSize: 13, color: drag ? C.green : C.text, marginBottom: 6, letterSpacing: "0.06em" }}>DÉPOSER UNE IMAGE</p>
            <p style={{ fontSize: 10, color: C.textDim, marginBottom: 16 }}>ou cliquer pour sélectionner · JPG · PNG · WEBP</p>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
              {["EXIF/GPS", "MODÈLE IA", "100% GRATUIT", "OPEN SOURCE"].map(t => <Tag key={t} color={C.dim}>{t}</Tag>)}
            </div>
            <input ref={inputRef} type="file" accept="image/*" onChange={e => processFile(e.target.files[0])} style={{ display: "none" }} />
          </div>
        )}

        {/* ── Preview + console + action ── */}
        {image && !result && (
          <div style={{ animation: "fadeIn .4s ease both" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>

              {/* Image */}
              <div style={{ flex: "1 1 280px", position: "relative", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}`, background: "#000" }}>
                <img src={image} alt="preview" style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block" }} />
                {isAnalyzing && <ScanAnim color={C.green} />}
              </div>

              {/* Console log */}
              <div style={{ flex: "1 1 240px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 14px", display: "flex", flexDirection: "column", minHeight: 200 }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.15em", marginBottom: 10 }}>JOURNAL D'ANALYSE</div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {log.length === 0
                    ? <span style={{ fontSize: 10, color: C.dim }}>En attente…</span>
                    : log.map((l, i) => (
                        <div key={i} style={{ fontSize: 10, color: l.includes("⚠") ? C.orange : l.includes("✓") || l.includes("OK") ? C.green : C.text, lineHeight: 1.7, fontFamily: "monospace" }}>{l}</div>
                      ))
                  }
                  {isAnalyzing && <span style={{ fontSize: 10, color: C.green, animation: "blink 1s infinite" }}>█</span>}
                </div>
              </div>
            </div>

            {/* EXIF preview */}
            {metadata !== undefined && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12, animation: "fadeIn .4s ease both" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: metadata ? 14 : 0 }}>
                  {metadata?.Make || metadata?.Model
                    ? <Tag color={C.green}>📷 {[metadata.Make, metadata.Model].filter(Boolean).join(" ")}</Tag>
                    : <Tag color={C.red}>⚠ Pas d'appareil photo</Tag>
                  }
                  {isSuspectSoftware(metadata?.Software) && <Tag color={C.orange}>🤖 {metadata.Software}</Tag>}
                  {metadata?.GPSLatitude && <Tag color={C.blue}>📍 GPS présent</Tag>}
                  {!metadata && <Tag color={C.red}>⚠ Zéro métadonnée EXIF</Tag>}
                </div>
                {metadata && <MetaTable metadata={metadata} />}
              </div>
            )}

            {/* Buttons */}
            {isAnalyzing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: `${C.green}08`, border: `1px solid ${C.green}30`, borderRadius: 6 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${C.green}40`, borderTopColor: C.green, borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.green, letterSpacing: "0.06em" }}>
                  {status === "retrying" ? "MODÈLE EN DÉMARRAGE — nouvel essai dans ~20s…" : "ANALYSE EN COURS…"}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => analyze()}
                  style={{ flex: 1, padding: "12px 20px", background: `${C.green}15`, border: `1px solid ${C.green}60`, borderRadius: 6, color: C.green, fontSize: 13, fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${C.green}25`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${C.green}15`; }}
                >
                  ▶ LANCER L'ANALYSE
                </button>
                <button onClick={reset}
                  style={{ padding: "12px 16px", background: "transparent", border: `1px solid ${C.dim}`, borderRadius: 6, color: C.textDim, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.muted}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.dim}
                >
                  ✕ CHANGER
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Results ── */}
        {result && cfg && (
          <div style={{ animation: "fadeIn .5s ease both" }}>

            {/* Verdict banner */}
            <div style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: "20px 22px", marginBottom: 12, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.15em", marginBottom: 6 }}>VERDICT FINAL</div>
                  <div style={{ fontSize: "clamp(18px,4vw,28px)", color: cfg.color, fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.05em", animation: "glitch 4s ease infinite" }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{cfg.sub}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.12em", marginBottom: 4 }}>CONFIANCE</div>
                  <div style={{ fontSize: 40, color: cfg.color, fontFamily: "'Share Tech Mono', monospace", lineHeight: 1 }}>{result.confidence}<span style={{ fontSize: 18 }}>%</span></div>
                  <div style={{ fontSize: 10, color: cfg.color, letterSpacing: "0.15em", marginTop: 4, opacity: 0.7 }}>{cfg.glyph}</div>
                </div>
              </div>
            </div>

            {/* Image + scores */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <img src={image} alt="result" style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ flex: "1 1 220px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "16px" }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.15em", marginBottom: 14 }}>SCORES DE PROBABILITÉ</div>
                <Bar value={result.humanScore} color={C.green} label="PHOTO RÉELLE" />
                <Bar value={result.aiScore} color={C.red} label="GÉNÉRÉE PAR IA" />
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.15em", marginBottom: 10 }}>JOURNAL</div>
                  {log.slice(-6).map((l, i) => (
                    <div key={i} style={{ fontSize: 9, color: l.includes("⚠") ? C.orange : l.includes("✓") || l.includes("OK") ? C.green : C.textDim, lineHeight: 1.8, fontFamily: "monospace" }}>{l}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Clues */}
            {result.clues.length > 0 && (
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.15em", marginBottom: 12 }}>INDICES DÉTECTÉS</div>
                {result.clues.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 9, color: cfg.color, fontFamily: "monospace", flexShrink: 0, marginTop: 2 }}>[{String(i+1).padStart(2,"0")}]</span>
                    <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{c}</span>
                  </div>
                ))}
              </div>
            )}

            {/* EXIF full */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {metadata?.Make || metadata?.Model ? <Tag color={C.green}>📷 {[metadata.Make, metadata.Model].filter(Boolean).join(" ")}</Tag> : <Tag color={C.red}>⚠ Pas d'appareil</Tag>}
                {isSuspectSoftware(metadata?.Software) && <Tag color={C.orange}>🤖 {metadata.Software}</Tag>}
                {metadata?.GPSLatitude && <Tag color={C.blue}>📍 GPS</Tag>}
                {!metadata && <Tag color={C.red}>⚠ Zéro EXIF</Tag>}
              </div>
              <MetaTable metadata={metadata} />
            </div>

            <button onClick={reset}
              style={{ width: "100%", padding: "12px", background: `${C.green}10`, border: `1px solid ${C.green}50`, borderRadius: 6, color: C.green, fontSize: 12, fontFamily: "monospace", letterSpacing: "0.1em", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = `${C.green}20`}
              onMouseLeave={e => e.currentTarget.style.background = `${C.green}10`}
            >
              ↩ ANALYSER UNE AUTRE IMAGE
            </button>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: `${C.red}10`, border: `1px solid ${C.red}40`, borderRadius: 6, fontSize: 12, color: C.red, fontFamily: "monospace" }}>
            ⚠ ERREUR : {errorMsg}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.1em" }}>MODÈLE : umm-maybe/AI-image-detector · HUGGING FACE</span>
          <span style={{ fontSize: 9, color: C.dim, letterSpacing: "0.1em" }}>EXIF EXTRAIT LOCALEMENT · AUCUNE IMAGE STOCKÉE</span>
        </div>

      </div>
    </div>
  );
}
