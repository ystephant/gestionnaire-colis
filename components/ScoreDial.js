// Demi-boule de valeurs, collée au bord droit : on pose le doigt, on glisse
// jusqu'au chiffre voulu et on relâche : les points sont ajoutés.
import { useState } from "react";

export default function ScoreDial({ player, values, onApply, onClose, dark }) {
  const [hover, setHover] = useState(null);
  const [pressed, setPressed] = useState(false);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");

  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  const R = Math.max(150, Math.min(290, vw - 56, (vh - 100) / 2));
  const r0 = R * 0.56;
  const list = [...values].sort((a, b) => b - a);   // le plus grand en haut
  const span = 180 / list.length;
  const pt = (deg, r) => { const a = deg * Math.PI / 180; return [R - r * Math.cos(a), R + r * Math.sin(a)]; };

  // Valeur sous le doigt ; null au centre (annuler) ou en dehors
  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left - R, y = e.clientY - box.top - R;
    const r = Math.hypot(x, y);
    if (r < r0 || r > R + 24) return null;
    const deg = Math.atan2(y, Math.abs(x)) * 180 / Math.PI;
    return list[Math.max(0, Math.min(list.length - 1, Math.floor((deg + 90) / span)))];
  };

  const down = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setPressed(true); setHover(pick(e)); };
  const move = (e) => { if (pressed || e.pointerType === "mouse") setHover(pick(e)); };
  const up = (e) => {
    if (!pressed) return;
    setPressed(false);
    const v = pick(e);
    setHover(null);
    if (v !== null) onApply(v);
  };

  const sendManual = () => {
    const n = parseInt(text, 10);
    if (!isNaN(n) && n !== 0) onApply(n);
  };

  const sign = (n) => `${n > 0 ? "+" : ""}${n}`;
  const small = { height:46, borderRadius:12, border:"1px solid rgba(255,255,255,.25)", background:"#1f2433", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", padding:"0 14px" };

  return (
    <div role="dialog" aria-label={`Points pour ${player.name}`} style={{ position:"fixed", inset:0, zIndex:70 }}>
      <style>{`@keyframes sdIn{from{transform:translateX(100%)}to{transform:none}}`}</style>
      <div data-dial-fond onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.55)" }}/>
      <div style={{ position:"absolute", right:0, top:"50%", marginTop:-(R + 30), width:R, animation:"sdIn .18s ease-out" }}>
        <div style={{ position:"relative", width:R, height:2 * R }}>
          <svg width={R} height={2 * R} viewBox={`0 0 ${R} ${2 * R}`} data-dial
            onPointerDown={down} onPointerMove={move} onPointerUp={up}
            onPointerCancel={() => { setPressed(false); setHover(null); }}
            onPointerLeave={() => { if (!pressed) setHover(null); }}
            style={{ display:"block", touchAction:"none", cursor:"pointer", userSelect:"none", overflow:"visible", filter:"drop-shadow(-8px 0 24px rgba(0,0,0,.45))" }}>
            <path d={`M${R},0 A${R},${R} 0 0,0 ${R},${2 * R} Z`} fill={dark ? "#151924" : "#ffffff"}/>
            {list.map((v, i) => {
              const a = -90 + i * span, b = a + span, on = hover === v;
              const [x0, y0] = pt(a, R), [x1, y1] = pt(b, R), [x2, y2] = pt(b, r0), [x3, y3] = pt(a, r0);
              const [tx, ty] = pt(a + span / 2, R - (R - r0) * 0.3);
              return (
                <g key={v} data-value={v}>
                  <path d={`M${x0},${y0} A${R},${R} 0 0,0 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0,1 ${x3},${y3} Z`}
                    fill={v < 0 ? (on ? "#ef4444" : "rgba(239,68,68,.20)") : (on ? "#22c55e" : "rgba(34,197,94,.18)")}
                    stroke={dark ? "#151924" : "#ffffff"} strokeWidth="1"/>
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontFamily="Space Mono,monospace" fontWeight="800"
                    fontSize={on ? 17 : Math.max(10, Math.min(14, R * 0.047))}
                    fill={on ? "#fff" : v < 0 ? "#ef4444" : dark ? "#86efac" : "#15803d"}>{sign(v)}</text>
                </g>
              );
            })}
            <path d={`M${R},${R - r0} A${r0},${r0} 0 0,0 ${R},${R + r0} Z`} fill={player.color.hex}/>
            <path d={`M${R},${R - r0} A${r0},${r0} 0 0,0 ${R},${R + r0} Z`} fill="rgba(0,0,0,.38)"/>
          </svg>
          {/* Centre : joueur, valeur visée, score obtenu */}
          <div aria-live="polite" style={{ position:"absolute", right:0, top:R - r0, width:r0 * 0.9, height:2 * r0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#fff", textAlign:"center", pointerEvents:"none", gap:4 }}>
            <div style={{ fontSize:16, fontWeight:800, maxWidth:"92%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{player.name}</div>
            <div className="mono" style={{ fontSize:Math.min(48, r0 * 0.34), fontWeight:800, lineHeight:1.05 }}>{hover === null ? sign(player.score) : sign(hover)}</div>
            <div style={{ fontSize:12, fontWeight:700, opacity:.9, lineHeight:1.4 }}>
              {hover !== null ? <>total {sign(player.score + hover)}<br/>{pressed ? "relâchez" : "touchez"} pour ajouter</>
                : pressed ? "relâchez ici pour annuler" : <>glissez sur un<br/>chiffre et relâchez</>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, padding:"12px 10px 0 0", whiteSpace:"nowrap" }}>
          {manual ? (
            <>
              <input type="number" autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendManual(); }}
                aria-label="Points à ajouter" placeholder="ex : -25" style={{ ...small, width:104, background:"#fff", color:"#111", textAlign:"center" }}/>
              <button onClick={sendManual} style={{ ...small, background:"#16a34a", border:"none" }}>OK</button>
            </>
          ) : (
            <button onClick={() => setManual(true)} style={small}>✏️ Autre valeur</button>
          )}
          <button onClick={onClose} aria-label="Fermer" style={small}>✕</button>
        </div>
      </div>
    </div>
  );
}
