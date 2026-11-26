// Onglet « Dés » du compteur de scores : tapis de lancer, dés mélangés,
// D6 en 3D, lancer au toucher ou en secouant le téléphone.
import { useEffect, useRef, useState } from "react";

const TYPES = [4, 6, 8, 10, 12, 20, 100];
const COLORS = { 4:"#ef4444", 8:"#10b981", 10:"#6366f1", 12:"#8b5cf6", 20:"#0ea5e9", 100:"#7c3aed" };
const MAX_DICE = 10;
const ROLL_MS = 1200;
const STORE = "sgt7dice";

const rnd = (n) => Math.floor(Math.random() * n) + 1;

// Rotation du cube qui amène la face voulue devant
const FACE_ROT = { 1:[0,0], 2:[-90,0], 3:[0,-90], 4:[0,90], 5:[90,0], 6:[0,180] };
const FACE_POS = { 1:"rotateY(0deg)", 6:"rotateY(180deg)", 3:"rotateY(90deg)", 4:"rotateY(-90deg)", 2:"rotateX(90deg)", 5:"rotateX(-90deg)" };
const PIPS = { 1:[4], 2:[2,6], 3:[2,4,6], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };

const CSS = `
  @keyframes dtBounce{0%{transform:translateY(-130px) scale(1.18)}45%{transform:translateY(0) scale(1)}62%{transform:translateY(-38px) scale(1.04)}77%{transform:translateY(0) scale(1)}87%{transform:translateY(-11px)}94%,100%{transform:translateY(0)}}
  @keyframes dtSpin{from{transform:rotateX(var(--x0)) rotateY(var(--y0)) rotateZ(var(--z0))}to{transform:rotateX(var(--x1)) rotateY(var(--y1)) rotateZ(0deg)}}
  @keyframes dtShadow{0%{transform:scale(.4);opacity:.15}45%,77%{transform:scale(1);opacity:.45}62%{transform:scale(.75);opacity:.28}100%{transform:scale(1);opacity:.45}}
  .dt-mat{-webkit-tap-highlight-color:transparent;user-select:none}
  @media (prefers-reduced-motion:reduce){.dt-anim{animation:none!important}}
`;

function Cube({ value, size, rolling, spin, delay }) {
  const [x, y] = FACE_ROT[value] || FACE_ROT[1];
  const half = size / 2;
  return (
    <div style={{ width:size, height:size, perspective:size*5 }}>
      {/* légère inclinaison pour voir le relief */}
      <div style={{ width:size, height:size, transformStyle:"preserve-3d", transform:"rotateX(-14deg) rotateY(-16deg)" }}>
        <div className="dt-anim" style={{
          width:size, height:size, position:"relative", transformStyle:"preserve-3d",
          transform:`rotateX(${x}deg) rotateY(${y}deg)`,
          "--x0":`${x - spin.x}deg`, "--y0":`${y - spin.y}deg`, "--z0":`${spin.z}deg`, "--x1":`${x}deg`, "--y1":`${y}deg`,
          animation: rolling ? `dtSpin ${ROLL_MS - 80}ms cubic-bezier(.2,.7,.3,1) ${delay}ms both` : "none",
        }}>
          {[1,2,3,4,5,6].map(f => (
            <div key={f} style={{
              position:"absolute", inset:0, borderRadius:size*.16, backfaceVisibility:"hidden",
              transform:`${FACE_POS[f]} translateZ(${half}px)`,
              background:"linear-gradient(145deg,#ffffff,#e7e2d6)", border:"1px solid #cfc8b8",
              display:"grid", gridTemplateColumns:"repeat(3,1fr)", gridTemplateRows:"repeat(3,1fr)", padding:size*.12,
            }}>
              {Array.from({ length:9 }, (_, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {PIPS[f].includes(i) && <div style={{ width:size*.17, height:size*.17, borderRadius:"50%", background:f===1?"#dc2626":"#1f2430" }}/>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Dés autres que le D6 : les valeurs défilent puis s'arrêtent sur le résultat
function FlatDie({ die, size, rolling, DieFace }) {
  const [shown, setShown] = useState(die.value);
  useEffect(() => {
    if (!rolling) { setShown(die.value); return; }
    const iv = setInterval(() => {
      setShown(die.percentile ? (rnd(10) - 1) * 10 : rnd(die.sides));
    }, 80);
    return () => clearInterval(iv);
  }, [rolling, die]);
  return <DieFace sides={die.sides} value={shown} size={size} color={die.color} rolling={rolling} percentile={die.percentile}/>;
}

function makeDice(pool) {
  const dice = [], groups = [];
  TYPES.forEach(type => {
    const count = pool[type] || 0;
    if (!count) return;
    const values = [];
    for (let i = 0; i < count; i++) {
      const spin = { x:360*(1+rnd(2)), y:360*(1+rnd(2)), z:rnd(180)-90 };
      if (type === 100) {
        const t = (rnd(10) - 1) * 10, u = rnd(10);
        values.push(t + u);
        dice.push({ sides:10, value:t, color:COLORS[100], percentile:true, spin });
        dice.push({ sides:10, value:u, color:"#a855f7", spin });
      } else {
        const v = rnd(type);
        values.push(v);
        dice.push({ sides:type, value:v, color:COLORS[type], spin });
      }
    }
    groups.push({ type, count, values });
  });
  return { dice, groups, total: groups.reduce((s, g) => s + g.values.reduce((a, b) => a + b, 0), 0) };
}

const label = (groups) => groups.map(g => `${g.count > 1 ? g.count + "×" : ""}D${g.type}`).join(" + ");

// Les anciens lancers sauvegardés ont un autre format
const describe = (e) => e.groups
  ? e.groups.map(g => `${g.count}×D${g.type} [${g.values.join(",")}]`).join(" + ")
  : e.diceType === 100 ? "D100" : `${e.diceCount}×D${e.diceType} [${(e.values || []).join(",")}]`;

export default function DiceTable({ D, dark, isMobile, DieFace, playSound, last, setLast, history, setHistory, selPlayer, onApply }) {
  const [pool, setPool] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(STORE)); if (p && typeof p === "object") return p; } catch {}
    return { 6:2 };
  });
  const [rolling, setRolling] = useState(false);
  const busy = useRef(false);
  const rollRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(pool)); } catch {} }, [pool]);

  const count = TYPES.reduce((s, t) => s + (pool[t] || 0), 0);
  const selection = TYPES.filter(t => pool[t]).map(t => ({ type:t, count:pool[t] }));

  const add = (t) => { if (count < MAX_DICE) setPool(p => ({ ...p, [t]:(p[t] || 0) + 1 })); };
  const remove = (t) => setPool(p => ({ ...p, [t]:Math.max(0, (p[t] || 0) - 1) }));

  const roll = () => {
    if (busy.current || !count) return;
    busy.current = true;
    const res = { ...makeDice(pool), id:Date.now() };
    setLast(res); setRolling(true);
    navigator.vibrate?.(20);
    setTimeout(() => {
      busy.current = false;
      setRolling(false);
      playSound();
      navigator.vibrate?.([30, 40, 20]);
      const time = new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
      setHistory(h => [{ id:String(res.id), groups:res.groups, total:res.total, time }, ...h].slice(0, 50));
    }, ROLL_MS + 80);
  };
  rollRef.current = roll;

  // Secouer le téléphone (deux à-coups rapprochés)
  useEffect(() => {
    let first = 0, lastRoll = 0;
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      if (Math.hypot(a.x || 0, a.y || 0, a.z || 0) < 22) return;
      const now = Date.now();
      if (now - lastRoll < 1800) return;
      if (now - first > 600) { first = now; return; }
      if (now - first < 80) return;
      lastRoll = now; first = 0;
      rollRef.current?.();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  const dice = last?.dice || [];
  const base = dice.length <= 2 ? 92 : dice.length <= 4 ? 78 : dice.length <= 6 ? 68 : 54;
  const size = isMobile ? base : Math.round(base * 1.2);
  const card = { background:D.card, border:`1px solid ${D.brd}`, borderRadius:16 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <style>{CSS}</style>

      {/* Réglages */}
      <div style={{ ...card, padding:8 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
          {TYPES.map(t => (
            <button key={t} className="die-sel-btn" onClick={() => add(t)} disabled={count >= MAX_DICE || rolling}
              aria-label={`Ajouter un D${t}`}
              style={{ position:"relative", background:pool[t] ? D.acc : dark ? "#1a1d27" : "#eee", color:pool[t] ? (dark ? "#111" : "#fff") : D.txt, fontSize:t === 100 ? 11 : 13, minHeight:44 }}>
              D{t}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginTop:8, minHeight:34 }}>
          {!count && <span style={{ fontSize:12, color:D.sub }}>Touchez un dé pour l’ajouter.</span>}
          {selection.map(s => (
            <button key={s.type} onClick={() => remove(s.type)} disabled={rolling} aria-label={`Retirer un D${s.type}`}
              style={{ height:34, padding:"0 10px", borderRadius:17, border:`1px solid ${D.brd}`, background:"transparent", color:D.txt, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              {s.count}×D{s.type} <span style={{ color:"#f87171", fontWeight:900 }}>−</span>
            </button>
          ))}
          {count > 0 && (
            <button onClick={() => setPool({})} disabled={rolling}
              style={{ marginLeft:"auto", height:34, padding:"0 10px", borderRadius:8, border:"none", background:"transparent", color:D.sub, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              Vider
            </button>
          )}
        </div>
      </div>

      {/* Tapis */}
      <div className="dt-mat" onClick={roll} role="button" aria-label="Tapis de dés : toucher pour lancer"
        style={{
          position:"relative", borderRadius:20, cursor:count ? "pointer" : "default", overflow:"hidden",
          minHeight:`max(300px, calc(100dvh - ${isMobile ? 340 : 360}px))`,
          background:"radial-gradient(ellipse at 50% 40%,#1f7a4d,#0f4a30 75%)",
          border:"6px solid #5b3a1e", boxShadow:"inset 0 4px 24px rgba(0,0,0,.45)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:12, gap:18,
        }}>
        {!dice.length ? (
          <div style={{ color:"rgba(255,255,255,.8)", textAlign:"center", fontWeight:700, fontSize:15, lineHeight:1.9 }}>
            <div style={{ fontSize:44 }}>🎲</div>
            Touchez le tapis{isMobile ? " ou secouez le téléphone" : " ou appuyez sur Espace"}
          </div>
        ) : (
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", alignItems:"center", gap:size * .3, maxWidth:560 }}>
            {dice.map((d, i) => (
              <div key={`${last.id}-${i}`} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div className="dt-anim" style={{ animation:rolling ? `dtBounce ${ROLL_MS - 80}ms ease-out ${(i % 5) * 20}ms both` : "none" }}>
                  {d.sides === 6
                    ? <Cube value={d.value} size={size} rolling={rolling} spin={d.spin} delay={(i % 5) * 20}/>
                    : <FlatDie die={d} size={size} rolling={rolling} DieFace={DieFace}/>}
                </div>
                <div className="dt-anim" style={{ width:size * .8, height:8, marginTop:8, borderRadius:"50%", background:"#000", filter:"blur(5px)", opacity:.45, animation:rolling ? `dtShadow ${ROLL_MS - 80}ms ease-out both` : "none" }}/>
              </div>
            ))}
          </div>
        )}
        {last && !rolling && (
          <div className="slide-up" style={{ textAlign:"center" }}>
            <div className="mono" aria-live="polite" style={{ fontSize:46, fontWeight:800, color:"#fcd34d", lineHeight:1.1 }}>{last.total}</div>
            {(dice.length > 1) && (
              <div style={{ fontSize:12, color:"rgba(255,255,255,.7)" }}>
                {last.groups.map(g => `D${g.type} : ${g.values.join(" + ")}`).join("  ·  ")}
              </div>
            )}
            {selPlayer && (
              <button onClick={e => { e.stopPropagation(); onApply(selPlayer, last.total); }}
                style={{ marginTop:10, padding:"9px 20px", borderRadius:10, border:"2px solid rgba(255,255,255,.5)", background:selPlayer.color.hex, color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", minHeight:40 }}>
                +{last.total} → {selPlayer.name}
              </button>
            )}
          </div>
        )}
      </div>

      <button id="sgt-roll" onClick={roll} disabled={rolling || !count}
        style={{ padding:"13px 34px", borderRadius:13, border:"none", background:rolling || !count ? "#6b7280" : `linear-gradient(135deg,${D.acc},#ef4444)`, color:dark ? "#111" : "#fff", fontWeight:800, fontSize:15, cursor:rolling || !count ? "not-allowed" : "pointer", minHeight:50 }}>
        {rolling ? "🎲 En cours…" : count ? `🎲 Lancer ${label(selection)}` : "🎲 Choisissez un dé"}
      </button>

      {history.length > 0 && (
        <div style={{ ...card, padding:isMobile ? 12 : 16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
            <div style={{ fontSize:11, fontWeight:700, color:D.sub, textTransform:"uppercase", letterSpacing:1 }}>📋 Historique</div>
            <button onClick={() => setHistory([])} style={{ padding:"5px 12px", borderRadius:7, border:"none", background:"rgba(239,68,68,0.12)", color:"#f87171", cursor:"pointer", fontWeight:700, fontSize:11, minHeight:32 }}>Effacer</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:200, overflowY:"auto" }}>
            {history.map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:9, background:dark ? "#ffffff03" : "#00000003" }}>
                <span style={{ flex:1, fontSize:12, color:D.sub }}>{describe(e)}</span>
                <span className="mono" style={{ fontSize:15, fontWeight:800, color:D.acc }}>{e.total}</span>
                <span style={{ fontSize:10, color:D.sub, flexShrink:0 }}>{e.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
