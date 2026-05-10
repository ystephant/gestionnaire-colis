import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const PALETTE = [
  { hex: "#e11d48", name: "Rubis"     },
  { hex: "#2563eb", name: "Saphir"    },
  { hex: "#16a34a", name: "Émeraude"  },
  { hex: "#d97706", name: "Ambre"     },
  { hex: "#7c3aed", name: "Améthyste" },
  { hex: "#ea580c", name: "Flamme"    },
  { hex: "#0891b2", name: "Cyan"      },
  { hex: "#db2777", name: "Pivoine"   },
  { hex: "#059669", name: "Jade"      },
  { hex: "#64748b", name: "Ardoise"   },
];

const KNOWN_NAMES = [
  "Alice","Bob","Charlie","Diana","Éva","François","Gabrielle",
  "Hugo","Isabelle","Julien","Louis","Marie","Nicolas","Olivia",
  "Pierre","Sophie","Thomas","Yann","Zoé","Raphaël","Camille",
];

const BONUS_VALUES = [-10, -5, +5, +10];
const TEETH     = 16;
const STEP_PX   = 22;
const DEG_STEP  = 360 / TEETH;
const DEG_PX    = DEG_STEP / STEP_PX;
const MEDALS    = ["🥇","🥈","🥉"];

const DICE_TYPES = [4, 6, 8, 10, 20, 100];

const uid = () => Math.random().toString(36).slice(2, 9);

// ═══════════════════════════════════════════════════════
//  GEAR SVG — bigger, more teeth, more industrial
// ═══════════════════════════════════════════════════════
function buildGearPath(teeth = TEETH, ri = 30, ro = 46, tw = 0.34) {
  const step = (2 * Math.PI) / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const b = i * step;
    [
      [b - step * (0.5 - tw * 0.88), ri],
      [b - step * tw,                ro],
      [b + step * tw,                ro],
      [b + step * (0.5 - tw * 0.88), ri],
    ].forEach(([a, r], j) => {
      const x = (50 + Math.cos(a - Math.PI / 2) * r).toFixed(2);
      const y = (50 + Math.sin(a - Math.PI / 2) * r).toFixed(2);
      d += i === 0 && j === 0 ? `M${x},${y}` : `L${x},${y}`;
    });
  }
  return d + "Z";
}
const GEAR_D = buildGearPath();

function GearSVG({ rotation, size, lit, color = "rgba(255,255,255,0.92)" }) {
  const id = `g${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display:"block", overflow:"visible" }}>
      <defs>
        <radialGradient id={id} cx="35%" cy="28%" r="66%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
        </radialGradient>
        <filter id={`glow${size}`}>
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${rotation} 50 50)`}>
        {/* drop shadow */}
        <path d={GEAR_D} fill="rgba(0,0,0,0.38)" transform="translate(2,3.5)" />
        {/* body */}
        <path d={GEAR_D} fill={color} />
        {/* sheen */}
        <path d={GEAR_D} fill={`url(#${id})`} />
        {/* active glow */}
        {lit && <path d={GEAR_D} fill="rgba(255,220,100,0.28)" filter={`url(#glow${size})`} />}
        {/* spokes */}
        {[0,60,120,180,240,300].map(deg => (
          <line key={deg}
            x1={50 + Math.cos((deg-90)*Math.PI/180)*13}
            y1={50 + Math.sin((deg-90)*Math.PI/180)*13}
            x2={50 + Math.cos((deg-90)*Math.PI/180)*27}
            y2={50 + Math.sin((deg-90)*Math.PI/180)*27}
            stroke="rgba(0,0,0,0.22)" strokeWidth="2.8" strokeLinecap="round"/>
        ))}
        {/* hub rings */}
        <circle cx="50" cy="50" r="13"  fill="rgba(0,0,0,0.40)" />
        <circle cx="50" cy="50" r="9"   fill={color} />
        <circle cx="50" cy="50" r="5.5" fill="rgba(0,0,0,0.32)" />
        <circle cx="50" cy="50" r="3"   fill={color} opacity="0.7" />
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  GEAR — interactive drag/wheel widget
// ═══════════════════════════════════════════════════════
function Gear({ onChange, size = 110 }) {
  const [rotation, setRotation] = useState(0);
  const [lit, setLit]           = useState(false);
  const drag    = useRef(null);
  const litRef  = useRef(null);
  const cbRef   = useRef(onChange);
  const gearEl  = useRef(null);

  cbRef.current = onChange;

  const procRef = useRef(null);
  procRef.current = (dy) => {
    if (!drag.current) return;
    const inv = -dy;
    drag.current.acc += inv;
    setRotation(r => r + inv * DEG_PX);
    const pts = Math.trunc(drag.current.acc / STEP_PX);
    if (pts !== 0) {
      drag.current.acc -= pts * STEP_PX;
      cbRef.current(pts);
      clearTimeout(litRef.current);
      setLit(true);
      litRef.current = setTimeout(() => setLit(false), 95);
    }
  };

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    drag.current = { lastY: e.clientY, acc: 0 };
    setLit(true);
    const move = (ev) => {
      if (!drag.current) return;
      const dy = ev.clientY - drag.current.lastY;
      drag.current.lastY = ev.clientY;
      procRef.current(dy);
    };
    const up = () => {
      drag.current = null;
      setLit(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  const onTouchStart = useCallback((e) => {
    drag.current = { lastY: e.touches[0].clientY, acc: 0 };
    setLit(true);
  }, []);
  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!drag.current) return;
    const dy = e.touches[0].clientY - drag.current.lastY;
    drag.current.lastY = e.touches[0].clientY;
    procRef.current(dy);
  }, []);
  const onTouchEnd = useCallback(() => { drag.current = null; setLit(false); }, []);

  useEffect(() => {
    const el = gearEl.current;
    if (!el) return;
    const h = (e) => {
      e.preventDefault();
      const pts = e.deltaY > 0 ? -1 : 1;
      cbRef.current(pts);
      setRotation(r => r + pts * DEG_STEP);
      clearTimeout(litRef.current);
      setLit(true);
      litRef.current = setTimeout(() => setLit(false), 95);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  return (
    <div
      ref={gearEl}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      data-gear="true"
      title="Glisser ↑ +1  ·  Glisser ↓ −1"
      style={{
        cursor: "ns-resize", userSelect: "none", touchAction: "none",
        transform: lit ? "scale(1.06)" : "scale(1)",
        transition: lit ? "none" : "transform .14s",
        flexShrink: 0,
      }}
    >
      <GearSVG rotation={rotation} size={size} lit={lit} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  DICE SVG faces
// ═══════════════════════════════════════════════════════
function DieFace({ sides, value, size = 80, color = "#2563eb", rolling = false }) {
  const s = size;
  const dots = [];

  const dotPositions = {
    1: [[50,50]],
    2: [[25,30],[75,70]],
    3: [[25,25],[50,50],[75,75]],
    4: [[25,25],[75,25],[25,75],[75,75]],
    5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
    6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
  };

  const cap = Math.min(value, 6);
  const posList = dotPositions[cap] || dotPositions[6];

  // Build shape
  let shape;
  if (sides === 4) {
    shape = <polygon points="50,8 92,88 8,88" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  } else if (sides === 8) {
    shape = <polygon points="50,6 90,40 75,90 25,90 10,40" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  } else if (sides === 10) {
    shape = <polygon points="50,5 90,35 80,85 20,85 10,35" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  } else if (sides === 20) {
    const pts = Array.from({length:6},(_,i)=>{
      const a=(i*60-90)*Math.PI/180;
      return `${50+42*Math.cos(a)},${50+42*Math.sin(a)}`;
    }).join(" ");
    shape = <polygon points={pts} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  } else if (sides === 100) {
    shape = <rect x="8" y="8" width="84" height="84" rx="12" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  } else {
    shape = <rect x="8" y="8" width="84" height="84" rx="16" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="2"/>;
  }

  return (
    <svg width={s} height={s} viewBox="0 0 100 100"
      style={{
        filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))",
        animation: rolling ? "dieRoll 0.08s steps(1) infinite" : "none",
      }}>
      <defs>
        <radialGradient id={`dg${sides}${value}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.15)"/>
        </radialGradient>
      </defs>
      {shape}
      <path d={sides===6?
        "M8,8 Q8,8 92,8 Q92,8 92,92 Q92,92 8,92 Q8,92 8,8":
        sides===100?"M8,8 Q92,8 92,92 Q8,92 8,8":""}
        fill={`url(#dg${sides}${value})`} />

      {/* Show value as text for large dice, dots for d6 */}
      {sides === 6 ? posList.map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="6" fill="rgba(255,255,255,0.92)"/>
      )) : (
        <text x="50" y="57" textAnchor="middle" fontSize={sides===100?"28":"32"}
          fontWeight="800" fontFamily="Space Mono,monospace"
          fill="rgba(255,255,255,0.95)">{value}</text>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  SPINNER WHEEL
// ═══════════════════════════════════════════════════════
function SpinnerWheel({ players, onResult, dark }) {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [winner, setWinner] = useState(null);
  const animRef = useRef(null);
  const startAngle = useRef(0);
  const startTime  = useRef(null);
  const targetAngle = useRef(0);

  const DURATION = 10000; // 10s

  const spin = () => {
    if (spinning || players.length < 2) return;
    setWinner(null);
    setSpinning(true);

    const sliceAngle = 360 / players.length;
    // Pick a random winner
    const winnerIdx = Math.floor(Math.random() * players.length);
    // We want the marker (top=0°) to land on winnerIdx's slice center
    // Wheel rotates clockwise. Slice i starts at i*sliceAngle.
    // After rotation R, the slice under the marker is at (-R mod 360).
    // So: -R ≡ winnerIdx*sliceAngle + sliceAngle/2 (mod 360)
    // R = -(winnerIdx*sliceAngle + sliceAngle/2) + 360*k
    const targetRemainder = -(winnerIdx * sliceAngle + sliceAngle / 2);
    // Ensure many rotations (fast) and land correctly
    const spins = 8 + Math.floor(Math.random() * 5); // 8-12 full rotations
    const target = startAngle.current + spins * 360 + ((targetRemainder - startAngle.current) % 360 + 360) % 360;

    targetAngle.current = target;
    startTime.current = null;
    const from = startAngle.current;

    const animate = (ts) => {
      if (!startTime.current) startTime.current = ts;
      const elapsed = ts - startTime.current;
      const t = Math.min(elapsed / DURATION, 1);
      // Easing: fast start, slow end (ease-out cubic)
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      setAngle(current);

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setAngle(target);
        startAngle.current = target;
        setSpinning(false);
        setWinner(players[winnerIdx]);
        onResult(players[winnerIdx]);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  if (players.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"60px 20px", color: dark?"#50556e":"#9090a8" }}>
        <div style={{ fontSize:64, marginBottom:16 }}>🎡</div>
        <div style={{ fontSize:16, fontWeight:700 }}>Ajoutez des joueurs pour utiliser la roue</div>
      </div>
    );
  }

  const sliceAngle = 360 / players.length;
  const R = 160;
  const cx = 180, cy = 180;
  const r = R;

  const slices = players.map((p, i) => {
    const startA = (i * sliceAngle - 90) * Math.PI / 180;
    const endA   = ((i + 1) * sliceAngle - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);
    const y2 = cy + r * Math.sin(endA);
    const large = sliceAngle > 180 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;

    const midA = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180;
    const tx = cx + (r * 0.62) * Math.cos(midA);
    const ty = cy + (r * 0.62) * Math.sin(midA);
    const textAngle = (i + 0.5) * sliceAngle;

    return { p, d, tx, ty, textAngle };
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
      <div style={{ position:"relative", display:"inline-block" }}>
        {/* Marker pointer */}
        <div style={{
          position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)",
          width:0, height:0,
          borderLeft:"14px solid transparent",
          borderRight:"14px solid transparent",
          borderTop:"28px solid #f59e0b",
          zIndex:10,
          filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.5))"
        }}/>

        <svg width={360} height={360} viewBox="0 0 360 360">
          <defs>
            <filter id="wheelShadow">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.4"/>
            </filter>
          </defs>
          <g transform={`rotate(${angle} ${cx} ${cy})`} filter="url(#wheelShadow)">
            {slices.map(({ p, d, tx, ty, textAngle }, i) => (
              <g key={p.id}>
                <path d={d} fill={p.color.hex} stroke="rgba(255,255,255,0.18)" strokeWidth="2"/>
                <g transform={`rotate(${textAngle} ${tx} ${ty})`}>
                  <text x={tx} y={ty+1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={players.length > 6 ? "11" : "13"} fontWeight="800"
                    fontFamily="Sora,sans-serif" fill="#fff"
                    style={{ textShadow:"0 1px 4px rgba(0,0,0,0.6)", paintOrder:"stroke fill" }}
                    stroke="rgba(0,0,0,0.3)" strokeWidth="3">
                    {p.name.length > 8 ? p.name.slice(0,7)+"…" : p.name}
                  </text>
                </g>
              </g>
            ))}
            {/* Center hub */}
            <circle cx={cx} cy={cy} r="28" fill={dark?"#1c1f2e":"#fff"} stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
            <circle cx={cx} cy={cy} r="14" fill="#f59e0b"/>
            <circle cx={cx} cy={cy} r="6"  fill={dark?"#0b0d12":"#fff"}/>
          </g>
        </svg>
      </div>

      {winner && !spinning && (
        <div className="slide-up" style={{
          padding:"14px 28px", borderRadius:18,
          background: winner.color.hex,
          color:"#fff", fontWeight:800, fontSize:20,
          boxShadow:`0 8px 32px ${winner.color.hex}66`,
          textAlign:"center"
        }}>
          🎉 {winner.name} commence !
        </div>
      )}

      <button
        onClick={spin}
        disabled={spinning || players.length < 2}
        style={{
          padding:"14px 40px", borderRadius:16, border:"none",
          background: spinning ? "#6b7280" : "linear-gradient(135deg,#f59e0b,#ef4444)",
          color:"#fff", fontWeight:800, fontSize:17, cursor:spinning?"not-allowed":"pointer",
          boxShadow: spinning ? "none" : "0 6px 24px rgba(245,158,11,0.5)",
          transition:"all .2s", transform:spinning?"scale(0.97)":"scale(1)"
        }}>
        {spinning ? "⏳ La roue tourne…" : "🎡 Qui commence en premier ?"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════
export default function ScoreTracker() {
  const [dark,     setDark]    = useState(true);
  const [players,  setPlayers] = useState([]);
  const [gameName, setGName]   = useState("Nouvelle partie 🎲");
  const [editingName, setEditingName] = useState(false);
  const [round,    setRound]   = useState(1);
  const [history,  setHist]    = useState([]);
  const [selected, setSelected]= useState(null);
  const [undo,     setUndo]    = useState([]);
  const [toast,    setToast]   = useState(null);
  const [tab,      setTab]     = useState("scores"); // "scores" | "dice" | "wheel"

  // Animation
  const [flashCt,  setFlashCt] = useState({});
  const [deltaMap, setDeltaMap]= useState({});

  // Modals
  const [showHist,  setSH] = useState(false);
  const [showReset, setSR] = useState(false);

  // Add-player form
  const [adding,   setAdding]  = useState(false);
  const [addQ,     setAddQ]    = useState("");
  const [addColor, setAddColor]= useState(PALETTE[0]);
  const [sugs,     setSugs]    = useState([]);
  const [sugOpen,  setSugOpen] = useState(false);
  const [names,    setNames]   = useState(KNOWN_NAMES);

  // Dice state
  const [diceType,   setDiceType]   = useState(6);
  const [diceCount,  setDiceCount]  = useState(2);
  const [dicePlayer, setDicePlayer] = useState(null);
  const [diceResult, setDiceResult] = useState(null);
  const [diceValues, setDiceValues] = useState([]);
  const [rolling,    setRolling]    = useState(false);
  const [diceHistory, setDiceHistory] = useState([]);

  // Wheel / first player state
  const [wheelHistory, setWheelHistory] = useState([]);

  const toastRef   = useRef(null);
  const addInput   = useRef(null);
  const nameInputRef = useRef(null);

  // ── Persistence ────────────────────────────────────────
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("sgt6") || "{}");
      if (s.players)      setPlayers(s.players);
      if (s.gameName)     setGName(s.gameName);
      if (s.round)        setRound(s.round);
      if (s.history)      setHist(s.history);
      if (s.diceHistory)  setDiceHistory(s.diceHistory);
      if (s.wheelHistory) setWheelHistory(s.wheelHistory);
      const n = JSON.parse(localStorage.getItem("sgt6n") || "null");
      if (n) setNames(n);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("sgt6", JSON.stringify({ players, gameName, round, history, diceHistory, wheelHistory })); }
    catch {}
  }, [players, gameName, round, history, diceHistory, wheelHistory]);

  // Set default dice player to first player
  useEffect(() => {
    if (players.length > 0 && !dicePlayer) setDicePlayer(players[0].id);
  }, [players]);

  // ── Toast ──────────────────────────────────────────────
  const flash = useCallback((msg, bg) => {
    clearTimeout(toastRef.current);
    setToast({ msg, bg });
    toastRef.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // ── Undo ───────────────────────────────────────────────
  const saveUndo = useCallback((snap) => setUndo(u => [...u.slice(-29), snap]), []);
  const doUndo   = useCallback(() => {
    if (!undo.length) return;
    setPlayers(undo[undo.length - 1]);
    setUndo(u => u.slice(0, -1));
    flash("Action annulée ↩");
  }, [undo, flash]);

  // ── Adjust score ───────────────────────────────────────
  const adjust = useCallback((id, delta) => {
    if (!delta) return;
    setPlayers(prev => {
      saveUndo(prev);
      return prev.map(p => {
        if (p.id !== id) return p;
        const score = p.score + delta;
        const time  = new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
        setHist(h => [...h, { id, name: p.name, delta, score, round, time }]);
        return { ...p, score };
      });
    });
    setFlashCt(f => ({ ...f, [id]: (f[id] || 0) + 1 }));
    setDeltaMap(d => ({ ...d, [id]: delta }));
    setTimeout(() => setDeltaMap(d => { const n = { ...d }; delete n[id]; return n; }), 560);
  }, [saveUndo, round]);

  // ── Add player ─────────────────────────────────────────
  const addPlayer = useCallback((name = addQ.trim()) => {
    if (!name) return;
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      flash(`${name} est déjà là !`); return;
    }
    const p = { id: uid(), name, color: addColor, score: 0 };
    setPlayers(prev => {
      saveUndo(prev);
      const next = [...prev, p];
      const used = new Set(next.map(pp => pp.color.hex));
      setAddColor(PALETTE.find(c => !used.has(c.hex)) || PALETTE[0]);
      return next;
    });
    if (!names.includes(name)) {
      const nn = [...names, name];
      setNames(nn);
      try { localStorage.setItem("sgt6n", JSON.stringify(nn)); } catch {}
    }
    setAddQ(""); setSugOpen(false);
    flash(`${name} a rejoint la partie !`, addColor.hex);
    setTimeout(() => addInput.current?.focus(), 60);
  }, [addQ, addColor, players, saveUndo, names, flash]);

  const removePlayer = useCallback((id) => {
    setPlayers(p => { saveUndo(p); return p.filter(x => x.id !== id); });
    if (selected === id) setSelected(null);
    if (dicePlayer === id) setDicePlayer(null);
  }, [saveUndo, selected, dicePlayer]);

  const changeColor = useCallback((id, color) =>
    setPlayers(p => p.map(x => x.id === id ? { ...x, color } : x)), []);

  const onQueryChange = (v) => {
    setAddQ(v);
    if (!v.trim()) { setSugs([]); setSugOpen(false); return; }
    const q = v.toLowerCase();
    const r = names.filter(n =>
      n.toLowerCase().startsWith(q) &&
      !players.find(p => p.name.toLowerCase() === n.toLowerCase())
    ).slice(0, 7);
    setSugs(r); setSugOpen(true);
  };

  const doReset = () => {
    setPlayers(p => { saveUndo(p); return p.map(x => ({ ...x, score: 0 })); });
    setHist([]); setRound(1); setSR(false);
    flash("Scores remis à zéro 🔄");
  };

  const exportCSV = () => {
    const s = [...players].sort((a, b) => b.score - a.score);
    let csv = `Partie,${gameName}\nDate,${new Date().toLocaleDateString("fr-FR")}\nRound,${round}\n\n`;
    csv += "Rang,Joueur,Score\n";
    s.forEach((p, i) => { csv += `${i+1},${p.name},${p.score}\n`; });
    csv += "\nHistorique\nRound,Joueur,Delta,Score,Heure\n";
    history.forEach(e => { csv += `${e.round},${e.name},${e.delta>0?"+":""}${e.delta},${e.score},${e.time}\n`; });
    const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href:url, download:`${gameName.replace(/\s+/g,"_")}.csv` }).click();
    URL.revokeObjectURL(url);
    flash("CSV téléchargé ✓");
  };

  // ── Roll dice ──────────────────────────────────────────
  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    setDiceResult(null);

    // Animate rolling for 1.2s
    let rollCount = 0;
    const interval = setInterval(() => {
      setDiceValues(Array.from({length: diceCount}, () => Math.ceil(Math.random() * diceType)));
      rollCount++;
      if (rollCount > 14) {
        clearInterval(interval);
        const finalValues = Array.from({length: diceCount}, () => Math.ceil(Math.random() * diceType));
        setDiceValues(finalValues);
        const total = finalValues.reduce((a,b) => a+b, 0);
        setDiceResult(total);
        setRolling(false);

        const player = players.find(p => p.id === dicePlayer);
        const time = new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
        const entry = {
          id: uid(),
          playerName: player?.name || "—",
          playerColor: player?.color.hex || "#888",
          diceType,
          diceCount,
          values: finalValues,
          total,
          time,
        };
        setDiceHistory(h => [entry, ...h].slice(0, 50));
      }
    }, 80);
  };

  // ── Wheel result handler ────────────────────────────────
  const handleWheelResult = (winner) => {
    const time = new Date().toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
    const entry = { id: uid(), name: winner.name, color: winner.color.hex, time,
      date: new Date().toLocaleDateString("fr-FR") };
    setWheelHistory(h => [entry, ...h].slice(0, 10));
  };

  // ── Computed ───────────────────────────────────────────
  const sorted    = [...players].sort((a, b) => b.score - a.score);
  const topScore  = sorted[0]?.score ?? 0;
  const selPlayer = players.find(p => p.id === selected);

  const D = {
    bg:   dark ? "#0b0d12" : "#f0ece4",
    card: dark ? "#14171f" : "#ffffff",
    brd:  dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)",
    txt:  dark ? "#e2e4f0" : "#1a1a2a",
    sub:  dark ? "#50556e" : "#9090a8",
    ibg:  dark ? "#0b0d12" : "#faf6f0",
    hbg:  dark ? "rgba(11,13,18,0.96)" : "rgba(240,236,228,0.96)",
    card2:dark ? "#1a1d27" : "#f7f3ec",
  };

  const dicePlayerObj = players.find(p => p.id === dicePlayer);

  return (
    <div style={{ minHeight:"100vh", background:D.bg, color:D.txt, fontFamily:"'Sora',sans-serif", transition:"background .3s" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        .mono { font-family:'Space Mono',monospace; }

        @keyframes scorePop {
          0%   { transform:scale(1); }
          35%  { transform:scale(1.2); }
          65%  { transform:scale(0.94); }
          100% { transform:scale(1); }
        }
        .score-pop { animation:scorePop .3s cubic-bezier(.36,.07,.19,.97); }

        @keyframes deltaFly {
          0%   { opacity:1; transform:translateY(0) scale(1); }
          100% { opacity:0; transform:translateY(-38px) scale(0.82); }
        }
        .delta-fly { animation:deltaFly .55s ease forwards; pointer-events:none; }

        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .slide-up { animation:slideUp .2s ease; }

        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .fade-in { animation:fadeIn .17s ease; }

        @keyframes crown { 0%,100%{transform:scale(1) rotate(-6deg)} 50%{transform:scale(1.12) rotate(6deg)} }

        @keyframes dieRoll {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(15deg) scale(1.05); }
          50%  { transform: rotate(-10deg) scale(0.95); }
          75%  { transform: rotate(8deg) scale(1.03); }
          100% { transform: rotate(0deg) scale(1); }
        }

        @keyframes dieLand {
          0%   { transform:scale(1.3) rotate(10deg); opacity:0.6; }
          60%  { transform:scale(0.92); }
          100% { transform:scale(1) rotate(0deg); opacity:1; }
        }
        .die-land { animation: dieLand 0.35s cubic-bezier(.36,.07,.19,.97); }

        .p-row { transition:filter .15s, box-shadow .22s; }
        .p-row:hover { filter:brightness(1.07); }

        .bonus-btn {
          border:none; cursor:pointer; font-family:'Space Mono',monospace;
          font-weight:700; font-size:17px;
          transition:transform .09s, opacity .1s, filter .1s; border-radius:14px;
        }
        .bonus-btn:hover  { opacity:.8; filter:brightness(1.1); }
        .bonus-btn:active { transform:scale(.83); }

        .cdot { width:14px;height:14px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s,outline-offset .12s; }
        .cdot:hover { transform:scale(1.5); }

        .sug-row { display:flex;align-items:center;gap:10px;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;font-size:13px;font-family:'Sora',sans-serif;text-align:left;transition:background .1s; }
        .sug-row:hover { background:rgba(128,128,128,.12); }

        .hdr-btn { transition:color .13s,background .13s; }
        .hdr-btn:hover:not(:disabled) { background:rgba(128,128,128,.13)!important; }

        .tab-btn { transition:all .18s; }
        .tab-btn:hover { opacity:0.85; }

        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(128,128,128,.22);border-radius:2px; }
        input { font-family:'Sora',sans-serif; }
        input:focus { outline:none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }

        .arrow-btn {
          width:36px; height:36px; border-radius:10px; border:none;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; font-size:20px; font-weight:900;
          transition:transform .1s, filter .1s;
        }
        .arrow-btn:hover { filter:brightness(1.15); }
        .arrow-btn:active { transform:scale(0.86); }

        .die-sel-btn {
          border-radius:12px; border:none; cursor:pointer;
          font-family:'Space Mono',monospace; font-weight:800; font-size:14px;
          padding:10px 14px;
          transition:all .15s;
        }
        .die-sel-btn:hover { filter:brightness(1.15); transform:translateY(-1px); }
      `}</style>

      {/* ════════════════════════════════════
          HEADER
      ════════════════════════════════════ */}
      <header style={{ position:"sticky",top:0,zIndex:30,background:D.hbg,backdropFilter:"blur(14px)",borderBottom:`1px solid ${D.brd}` }}>
        <div style={{ maxWidth:900,margin:"0 auto",padding:"10px 18px",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:22,flexShrink:0 }}>🎲</span>

          <div style={{ flex:1,minWidth:0 }}>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={gameName}
                onChange={e=>setGName(e.target.value)}
                onBlur={()=>setEditingName(false)}
                onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Escape") setEditingName(false); }}
                autoFocus
                style={{ background:"transparent",border:"none",borderBottom:`2px solid #f59e0b`,fontWeight:800,fontSize:15,color:D.txt,width:"100%",paddingBottom:2 }}
              />
            ) : (
              <div
                onClick={()=>setEditingName(true)}
                title="Cliquer pour renommer"
                style={{ fontWeight:800,fontSize:15,color:D.txt,cursor:"text",display:"flex",alignItems:"center",gap:6 }}
              >
                {gameName}
                <span style={{ fontSize:11,color:D.sub,fontWeight:400 }}>✏️</span>
              </div>
            )}
            <div style={{ fontSize:10,color:D.sub,marginTop:1 }}>
              {players.length} joueur{players.length!==1?"s":""} · Round {round}
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:3,flexShrink:0 }}>
            <HdrBtn label="−" onClick={()=>setRound(r=>Math.max(1,r-1))} D={D} />
            <span className="mono" style={{ fontSize:10,color:D.sub,minWidth:26,textAlign:"center" }}>R{round}</span>
            <HdrBtn label="+" onClick={()=>setRound(r=>r+1)} D={D} />
          </div>

          <div style={{ width:1,height:22,background:D.brd,flexShrink:0 }} />
          <HdrBtn label="↩"   title="Annuler"       onClick={doUndo}         disabled={!undo.length} D={D} />
          <HdrBtn label="📋"  title="Historique"    onClick={()=>setSH(true)}  D={D} />
          <HdrBtn label="CSV" title="Exporter CSV"  onClick={exportCSV}       D={D} />
          <HdrBtn label="🔄"  title="Réinitialiser" onClick={()=>setSR(true)}  D={D} />
          <div style={{ width:1,height:22,background:D.brd,flexShrink:0 }} />

          <button onClick={()=>setDark(!dark)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${D.brd}`,background:"transparent",cursor:"pointer",fontSize:16,flexShrink:0 }}>
            {dark?"☀️":"🌙"}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ maxWidth:900,margin:"0 auto",padding:"0 18px 0",display:"flex",gap:4 }}>
          {[
            { key:"scores", label:"🏆 Scores" },
            { key:"dice",   label:"🎲 Dés" },
            { key:"wheel",  label:"🎡 Qui commence ?" },
          ].map(t => (
            <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)}
              style={{
                padding:"9px 18px", border:"none", borderRadius:"12px 12px 0 0",
                background: tab===t.key ? D.card : "transparent",
                color: tab===t.key ? D.txt : D.sub,
                fontWeight: tab===t.key ? 800 : 600,
                fontSize:13, cursor:"pointer",
                borderBottom: tab===t.key ? `2px solid #f59e0b` : "2px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:900,margin:"0 auto",padding:"18px 14px 150px" }}>

        {/* ══════════════════════ SCORES TAB ══════════════════════ */}
        {tab === "scores" && (<>
          {players.length===0 && (
            <div style={{ textAlign:"center",padding:"90px 20px 40px",color:D.sub }}>
              <div style={{ fontSize:80,opacity:.8,lineHeight:1,marginBottom:16 }}>🎯</div>
              <div style={{ fontSize:22,fontWeight:800,color:D.txt,marginBottom:10 }}>Prêt pour la partie ?</div>
              <div style={{ fontSize:14,lineHeight:1.8 }}>
                Ajoutez des joueurs ci-dessous.<br/>
                Glissez la roue crantée <strong style={{color:"#f59e0b"}}>↑</strong> pour gagner des points,{" "}
                <strong style={{color:"#f87171"}}>↓</strong> pour en perdre.<br/>
                Ou utilisez les flèches <strong style={{color:"#f59e0b"}}>▲▼</strong> pour +1 / −1.
              </div>
            </div>
          )}

          <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
            {sorted.map((player, rank) => (
              <PlayerRow
                key={player.id}
                player={player}
                rank={rank}
                medal={rank<3 ? MEDALS[rank] : `${rank+1}`}
                isLeader={rank===0 && players.length>1 && topScore>0}
                isSel={selected===player.id}
                flashKey={flashCt[player.id]||0}
                delta={deltaMap[player.id]}
                dark={dark}
                onAdjust={(pts)=>adjust(player.id,pts)}
                onRemove={()=>removePlayer(player.id)}
                onSelect={()=>setSelected(selected===player.id ? null : player.id)}
                onColorChange={(c)=>changeColor(player.id,c)}
              />
            ))}
          </div>

          {/* Add player */}
          <div style={{ marginTop:10 }}>
            {!adding ? (
              <button
                onClick={()=>{ setAdding(true); setTimeout(()=>addInput.current?.focus(),60); }}
                className="hdr-btn"
                style={{ width:"100%",padding:"15px 0",borderRadius:18,border:`2px dashed ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#f59e0b";e.currentTarget.style.color="#f59e0b";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=D.brd;e.currentTarget.style.color=D.sub;}}
              >＋ Ajouter un joueur</button>
            ) : (
              <div className="fade-in" style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:18,padding:16,display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ position:"relative" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:13,border:`1px solid ${D.brd}`,background:D.ibg }}>
                    <span style={{ color:D.sub }}>🔍</span>
                    <input ref={addInput} value={addQ}
                      onChange={e=>onQueryChange(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==="Enter"){ sugs[0]?addPlayer(sugs[0]):addPlayer(); }
                        if(e.key==="Escape"){ setAdding(false); setAddQ(""); setSugOpen(false); }
                      }}
                      onFocus={()=>addQ&&setSugOpen(sugs.length>0)}
                      onBlur={()=>setTimeout(()=>setSugOpen(false),160)}
                      placeholder="Nom du joueur…"
                      style={{ flex:1,background:"transparent",border:"none",color:D.txt,fontSize:14 }}
                    />
                    {addQ&&<button onClick={()=>setAddQ("")} style={{ background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:18,lineHeight:1 }}>×</button>}
                  </div>
                  {sugOpen&&(
                    <div className="fade-in" style={{ position:"absolute",top:"calc(100% + 5px)",left:0,right:0,zIndex:20,background:dark?"#1c1f2e":"#fff",border:`1px solid ${D.brd}`,borderRadius:14,overflow:"hidden",boxShadow:"0 10px 32px rgba(0,0,0,.3)" }}>
                      {sugs.map((n,i)=>(
                        <button key={i} className="sug-row" onMouseDown={()=>addPlayer(n)} style={{ color:D.txt }}>
                          <span style={{ width:26,height:26,borderRadius:"50%",background:addColor.hex+"25",color:addColor.hex,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:11,flexShrink:0 }}>{n[0]}</span>
                          {n}
                        </button>
                      ))}
                      {addQ&&!sugs.find(s=>s.toLowerCase()===addQ.toLowerCase())&&(
                        <button className="sug-row" onMouseDown={()=>addPlayer()} style={{ color:"#f59e0b",fontWeight:700,borderTop:sugs.length?`1px solid ${D.brd}`:"none" }}>
                          <span>✚</span> Ajouter « {addQ} »
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
                  <span style={{ fontSize:12,color:D.sub,flexShrink:0 }}>Couleur :</span>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",flex:1 }}>
                    {PALETTE.map(c=>(
                      <button key={c.hex} className="cdot" onClick={()=>setAddColor(c)} title={c.name}
                        style={{ background:c.hex,outline:addColor.hex===c.hex?`2.5px solid ${c.hex}`:"none",outlineOffset:addColor.hex===c.hex?2:0,transform:addColor.hex===c.hex?"scale(1.45)":"scale(1)" }} />
                    ))}
                  </div>
                  <button onClick={()=>addPlayer()} disabled={!addQ.trim()}
                    style={{ padding:"9px 20px",borderRadius:11,border:"none",flexShrink:0,fontWeight:700,fontSize:13,cursor:addQ.trim()?"pointer":"default",background:addQ.trim()?"#f59e0b":(dark?"#2a2d3a":"#dddad4"),color:addQ.trim()?"#fff":D.sub }}>
                    Ajouter
                  </button>
                  <button onClick={()=>{ setAdding(false);setAddQ("");setSugOpen(false); }}
                    style={{ padding:"9px 14px",borderRadius:11,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontWeight:600,fontSize:13 }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {players.length>1 && <MiniLeaderboard sorted={sorted} topScore={topScore} D={D} dark={dark} />}
        </>)}

        {/* ══════════════════════ DICE TAB ══════════════════════ */}
        {tab === "dice" && (
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {/* Die type selector */}
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:D.sub,marginBottom:14,textTransform:"uppercase",letterSpacing:1 }}>
                Type de dé
              </div>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                {DICE_TYPES.map(d => (
                  <button key={d} className="die-sel-btn" onClick={()=>setDiceType(d)}
                    style={{
                      background: diceType===d ? "#f59e0b" : (dark?"#1a1d27":"#eee"),
                      color: diceType===d ? "#fff" : D.txt,
                      boxShadow: diceType===d ? "0 4px 18px rgba(245,158,11,0.5)" : "none",
                    }}>
                    D{d}
                  </button>
                ))}
              </div>
            </div>

            {/* Dice count & player */}
            <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
              <div style={{ flex:1,minWidth:180,background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:20 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,marginBottom:14,textTransform:"uppercase",letterSpacing:1 }}>Nombre de dés</div>
                <div style={{ display:"flex",alignItems:"center",gap:16,justifyContent:"center" }}>
                  <button className="arrow-btn"
                    onClick={()=>setDiceCount(c=>Math.max(1,c-1))}
                    style={{ background:"rgba(239,68,68,0.18)",color:"#f87171" }}>−</button>
                  <span className="mono" style={{ fontSize:36,fontWeight:800,color:D.txt,minWidth:52,textAlign:"center" }}>{diceCount}</span>
                  <button className="arrow-btn"
                    onClick={()=>setDiceCount(c=>Math.min(10,c+1))}
                    style={{ background:"rgba(34,197,94,0.18)",color:"#4ade80" }}>+</button>
                </div>
              </div>

              <div style={{ flex:2,minWidth:200,background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:20 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,marginBottom:14,textTransform:"uppercase",letterSpacing:1 }}>Pour le joueur</div>
                {players.length === 0 ? (
                  <div style={{ color:D.sub,fontSize:13 }}>Aucun joueur — allez dans l'onglet Scores</div>
                ) : (
                  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                    {players.map(p => (
                      <button key={p.id} onClick={()=>setDicePlayer(p.id)}
                        style={{
                          padding:"8px 16px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                          background: dicePlayer===p.id ? p.color.hex : (dark?"#1a1d27":"#eee"),
                          color: dicePlayer===p.id ? "#fff" : D.txt,
                          boxShadow: dicePlayer===p.id ? `0 4px 16px ${p.color.hex}55` : "none",
                          transition:"all .15s"
                        }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dice display */}
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:28,textAlign:"center" }}>
              <div style={{ display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",minHeight:100,alignItems:"center",marginBottom:24 }}>
                {diceValues.length === 0 ? (
                  <div style={{ color:D.sub,fontSize:14 }}>Lancez les dés !</div>
                ) : diceValues.map((val, i) => (
                  <div key={i} className={!rolling && diceResult!==null?"die-land":""}>
                    <DieFace sides={diceType} value={val} size={90} color={dicePlayerObj?.color.hex||"#2563eb"} rolling={rolling}/>
                  </div>
                ))}
              </div>

              {diceResult !== null && !rolling && (
                <div className="slide-up" style={{ marginBottom:20 }}>
                  <div style={{ fontSize:13,color:D.sub,marginBottom:4 }}>
                    {diceCount}×D{diceType} · {dicePlayerObj?.name||"—"}
                  </div>
                  <div className="mono" style={{ fontSize:52,fontWeight:800,color:dicePlayerObj?.color.hex||"#f59e0b" }}>
                    {diceResult}
                  </div>
                  {diceCount > 1 && (
                    <div style={{ fontSize:12,color:D.sub }}>
                      [{diceValues.join(" + ")}]
                    </div>
                  )}
                </div>
              )}

              <button onClick={rollDice} disabled={rolling}
                style={{
                  padding:"16px 48px",borderRadius:16,border:"none",
                  background:rolling?"#6b7280":"linear-gradient(135deg,#f59e0b,#ef4444)",
                  color:"#fff",fontWeight:800,fontSize:18,cursor:rolling?"not-allowed":"pointer",
                  boxShadow:rolling?"none":"0 6px 24px rgba(245,158,11,0.45)",
                  transition:"all .2s",
                  transform:rolling?"scale(0.97)":"scale(1)"
                }}>
                {rolling ? "🎲 En cours…" : `🎲 Lancer ${diceCount > 1?`${diceCount}×`:""}D${diceType}`}
              </button>
            </div>

            {/* Dice history */}
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:20 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1 }}>
                  📋 Historique des lancés
                </div>
                <button onClick={()=>setDiceHistory([])}
                  style={{ padding:"6px 14px",borderRadius:10,border:"none",background:"rgba(239,68,68,0.15)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:12 }}>
                  Effacer
                </button>
              </div>
              {diceHistory.length === 0 ? (
                <div style={{ textAlign:"center",padding:"24px 0",color:D.sub,fontSize:13 }}>Aucun lancé encore</div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto" }}>
                  {diceHistory.map((e,i) => (
                    <div key={e.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:12,background:dark?"#ffffff05":"#00000004" }}>
                      <span style={{ width:8,height:8,borderRadius:"50%",background:e.playerColor,flexShrink:0 }}/>
                      <span style={{ fontWeight:700,fontSize:13,color:e.playerColor,minWidth:72,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.playerName}</span>
                      <span style={{ flex:1,fontSize:12,color:D.sub }}>
                        {e.diceCount}×D{e.diceType} → [{e.values.join(",")}]
                      </span>
                      <span className="mono" style={{ fontSize:16,fontWeight:800,color:D.txt }}>{e.total}</span>
                      <span style={{ fontSize:10,color:D.sub,flexShrink:0 }}>{e.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════ WHEEL TAB ══════════════════════ */}
        {tab === "wheel" && (
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:28,display:"flex",flexDirection:"column",alignItems:"center" }}>
              <SpinnerWheel players={players} onResult={handleWheelResult} dark={dark} />
            </div>

            {/* Wheel history */}
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:20 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1 }}>
                  🏁 Historique des premiers joueurs (10 derniers)
                </div>
                <button onClick={()=>setWheelHistory([])}
                  style={{ padding:"6px 14px",borderRadius:10,border:"none",background:"rgba(239,68,68,0.15)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:12 }}>
                  Effacer l'historique
                </button>
              </div>
              {wheelHistory.length === 0 ? (
                <div style={{ textAlign:"center",padding:"24px 0",color:D.sub,fontSize:13 }}>Aucune partie encore — lancez la roue !</div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {wheelHistory.map((e,i) => (
                    <div key={e.id} style={{
                      display:"flex",alignItems:"center",gap:12,padding:"10px 16px",
                      borderRadius:14,
                      background:i===0?"rgba(245,158,11,0.1)":dark?"#ffffff04":"#00000003",
                      border:i===0?`1px solid rgba(245,158,11,0.25)`:`1px solid transparent`
                    }}>
                      <span style={{ fontSize:i===0?18:14,flexShrink:0 }}>{i===0?"🥇":"⚫"}</span>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:e.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,flexShrink:0 }}>
                        {e.name[0]}
                      </div>
                      <span style={{ flex:1,fontWeight:700,fontSize:15,color:e.color }}>{e.name}</span>
                      <span style={{ fontSize:11,color:D.sub }}>{e.date} · {e.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════
          STICKY BONUS BAR
      ════════════════════════════════════ */}
      {selPlayer && tab==="scores" && (
        <div className="slide-up" style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:25,background:dark?"rgba(11,13,18,0.97)":"rgba(240,236,228,0.97)",backdropFilter:"blur(18px)",borderTop:`1px solid ${D.brd}`,padding:"13px 18px 20px" }}>
          <div style={{ maxWidth:900,margin:"0 auto" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:32,height:32,borderRadius:"50%",background:selPlayer.color.hex,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13 }}>
                  {selPlayer.name[0]}
                </div>
                <div>
                  <div style={{ fontWeight:700,fontSize:14,color:selPlayer.color.hex }}>{selPlayer.name}</div>
                  <div style={{ fontSize:10,color:D.sub }}>Score actuel : <span className="mono" style={{ fontWeight:700 }}>{selPlayer.score>0?"+":""}{selPlayer.score}</span></div>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ width:32,height:32,borderRadius:10,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:16 }}>✕</button>
            </div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {BONUS_VALUES.map(b=>(
                <button key={b} className="bonus-btn"
                  onClick={()=>adjust(selPlayer.id,b)}
                  style={{
                    flex:1,minWidth:60,padding:"11px 8px",
                    background:b<0?"rgba(239,68,68,0.13)":"rgba(34,197,94,0.13)",
                    color:b<0?"#f87171":"#4ade80",
                    border:`1px solid ${b<0?"rgba(239,68,68,0.28)":"rgba(34,197,94,0.28)"}`,
                  }}>
                  {b>0?"+":""}{b}
                </button>
              ))}
              <CustomBonus onApply={v=>adjust(selPlayer.id,v)} color={selPlayer.color.hex} D={D} dark={dark} />
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          HISTORY MODAL
      ════════════════════════════════════ */}
      {showHist&&(
        <Modal onClose={()=>setSH(false)} D={D}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
            <h3 style={{ fontWeight:800,fontSize:17 }}>📋 Historique des scores</h3>
            <MClose onClick={()=>setSH(false)} D={D} />
          </div>
          <div style={{ overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:5 }}>
            {history.length===0
              ? <p style={{ textAlign:"center",padding:"36px 0",color:D.sub,fontSize:13 }}>Aucune action encore</p>
              : [...history].reverse().map((e,i)=>{
                  const p=players.find(pp=>pp.id===e.id);
                  return(
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:11,background:dark?"#ffffff05":"#00000004" }}>
                      <span style={{ width:8,height:8,borderRadius:"50%",background:p?.color.hex||"#888",flexShrink:0 }}/>
                      <span style={{ fontWeight:600,fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.name}</span>
                      <span className="mono" style={{ fontSize:11,padding:"2px 8px",borderRadius:7,background:e.delta>0?"#22c55e18":"#ef444418",color:e.delta>0?"#22c55e":"#ef4444",fontWeight:700,flexShrink:0 }}>
                        {e.delta>0?"+":""}{e.delta}
                      </span>
                      <span className="mono" style={{ fontSize:10,color:D.sub,flexShrink:0 }}>→ {e.score>0?"+":""}{e.score}</span>
                      <span style={{ fontSize:10,color:D.sub,flexShrink:0 }}>R{e.round} · {e.time}</span>
                    </div>
                  );
                })
            }
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════
          RESET MODAL
      ════════════════════════════════════ */}
      {showReset&&(
        <Modal onClose={()=>setSR(false)} D={D} noScroll maxW={340}>
          <h3 style={{ fontWeight:800,fontSize:17,marginBottom:10 }}>🔄 Remettre à zéro ?</h3>
          <p style={{ fontSize:13,color:D.sub,lineHeight:1.7,marginBottom:22 }}>
            Tous les scores reviennent à 0 et l'historique est effacé. Les joueurs restent en place.
          </p>
          <div style={{ display:"flex",gap:10 }}>
            <button onClick={()=>setSR(false)} style={{ flex:1,padding:"11px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14 }}>Annuler</button>
            <button onClick={doReset}          style={{ flex:1,padding:"11px 0",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14 }}>Réinitialiser</button>
          </div>
        </Modal>
      )}

      {/* TOAST */}
      {toast&&(
        <div className="slide-up" style={{ position:"fixed",bottom:selPlayer&&tab==="scores"?104:24,left:"50%",transform:"translateX(-50%)",zIndex:50,padding:"11px 22px",borderRadius:14,background:toast.bg||(dark?"#252938":"#1c1f2e"),color:"#fff",fontWeight:700,fontSize:13,boxShadow:"0 8px 28px rgba(0,0,0,.4)",whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  PLAYER ROW
// ═══════════════════════════════════════════════════════
function PlayerRow({ player, rank, medal, isLeader, isSel, flashKey, delta, dark, onAdjust, onRemove, onSelect, onColorChange }) {
  const col = player.color.hex;
  const [showPalette, setPalette] = useState(false);

  return (
    <div className="p-row" onClick={e=>{
      if(e.target.closest("[data-gear]")||e.target.closest("[data-rm]")||e.target.closest("[data-pal]")||e.target.closest("[data-arrows]")) return;
      onSelect();
    }} style={{
      position:"relative", borderRadius:20, background:col, cursor:"pointer",
      boxShadow: isSel
        ? `inset 0 0 0 9999px rgba(0,0,0,0.16), 0 0 0 3px ${col}, 0 0 0 5.5px rgba(255,255,255,0.24), 0 10px 40px ${col}55`
        : `inset 0 0 0 9999px rgba(0,0,0,0.45), 0 3px 14px ${col}28`,
      transition:"box-shadow .22s",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,padding:"14px 16px" }}>

        {/* Rank */}
        <div style={{ minWidth:28,height:28,borderRadius:9,background:"rgba(255,255,255,0.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?16:11,fontWeight:800,color:"#fff",flexShrink:0 }}>
          {medal}
        </div>

        {/* Avatar / color picker */}
        <div style={{ position:"relative",flexShrink:0 }} data-pal>
          <button onClick={e=>{e.stopPropagation();setPalette(v=>!v);}}
            style={{ width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",backdropFilter:"blur(4px)",border:"2px solid rgba(255,255,255,0.38)",color:"#fff",fontWeight:800,fontSize:isLeader?20:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}
            title="Changer la couleur">
            {isLeader
              ? <span style={{ display:"inline-block",animation:"crown 1.4s ease-in-out infinite" }}>👑</span>
              : player.name[0].toUpperCase()}
          </button>
          {showPalette&&(
            <div className="fade-in" data-pal style={{ position:"absolute",top:54,left:0,zIndex:15,background:dark?"#1c1f2e":"#fff",border:"1px solid rgba(255,255,255,0.1)",borderRadius:14,padding:10,display:"flex",flexWrap:"wrap",gap:7,width:152,boxShadow:"0 12px 36px rgba(0,0,0,.4)" }}
              onClick={e=>e.stopPropagation()}>
              {PALETTE.map(c=>(
                <button key={c.hex} className="cdot" onClick={()=>{ onColorChange(c); setPalette(false); }} title={c.name}
                  style={{ background:c.hex,outline:player.color.hex===c.hex?`2.5px solid ${c.hex}`:"none",outlineOffset:player.color.hex===c.hex?2:0,transform:player.color.hex===c.hex?"scale(1.4)":"scale(1)" }} />
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:700,fontSize:16,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {player.name}
          </div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,0.48)",marginTop:2 }}>
            {player.color.name}{isLeader?" · 👑 En tête":rank===0&&!isLeader?"":`· #${rank+1}`}
          </div>
        </div>

        {/* Score */}
        <div style={{ position:"relative",textAlign:"center",minWidth:78,flexShrink:0 }}>
          <div key={flashKey} className="mono score-pop"
            style={{ fontSize:50,fontWeight:700,color:"#fff",letterSpacing:-2,lineHeight:1,textShadow:"0 2px 14px rgba(0,0,0,0.28)" }}>
            {player.score>0?"+":""}{player.score}
          </div>
          {delta!==undefined&&(
            <div className="delta-fly mono" style={{ position:"absolute",top:-4,right:-8,zIndex:5,fontSize:19,fontWeight:700,color:delta>0?"#86efac":"#fca5a5" }}>
              {delta>0?"+":""}{delta}
            </div>
          )}
        </div>

        {/* Arrow buttons + Gear */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0 }} data-gear>
          {/* Up arrow */}
          <button data-arrows
            onClick={e=>{ e.stopPropagation(); onAdjust(1); }}
            className="arrow-btn"
            title="+1"
            style={{ background:"rgba(34,197,94,0.22)",color:"#4ade80",fontSize:18,padding:0 }}>
            ▲
          </button>
          {/* Gear */}
          <Gear onChange={onAdjust} size={110} />
          {/* Down arrow */}
          <button data-arrows
            onClick={e=>{ e.stopPropagation(); onAdjust(-1); }}
            className="arrow-btn"
            title="-1"
            style={{ background:"rgba(239,68,68,0.22)",color:"#f87171",fontSize:18,padding:0 }}>
            ▼
          </button>
        </div>

        {/* Remove */}
        <button data-rm onClick={e=>{e.stopPropagation();onRemove();}}
          style={{ width:28,height:28,borderRadius:8,border:"none",flexShrink:0,background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.52)",cursor:"pointer",fontSize:14,transition:"background .13s,color .13s" }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,0.48)";e.currentTarget.style.color="#fff";}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.12)";e.currentTarget.style.color="rgba(255,255,255,0.52)";}}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MINI LEADERBOARD
// ═══════════════════════════════════════════════════════
function MiniLeaderboard({ sorted, topScore, D, dark }) {
  const min   = Math.min(...sorted.map(p=>p.score));
  const range = topScore - min || 1;
  return (
    <div style={{ marginTop:18,background:D.card,border:`1px solid ${D.brd}`,borderRadius:18,padding:"16px 20px" }}>
      <div style={{ fontSize:11,fontWeight:700,color:D.sub,marginBottom:14,textTransform:"uppercase",letterSpacing:1 }}>
        📊 Classement
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {sorted.map((p,i)=>{
          const pct = Math.max(3,((p.score-min)/range)*100);
          return (
            <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ fontSize:i<3?14:10,minWidth:20,textAlign:"center",flexShrink:0 }}>
                {i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}
              </span>
              <div style={{ width:28,height:28,borderRadius:"50%",background:p.color.hex,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11,flexShrink:0 }}>
                {p.name[0]}
              </div>
              <span style={{ fontSize:13,fontWeight:600,minWidth:72,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</span>
              <div style={{ flex:1,height:8,borderRadius:4,background:dark?"#ffffff08":"#00000008",overflow:"hidden" }}>
                <div style={{ width:`${pct}%`,height:"100%",borderRadius:4,background:p.color.hex,transition:"width .5s ease" }}/>
              </div>
              <span className="mono" style={{ fontSize:12,fontWeight:700,color:p.color.hex,minWidth:48,textAlign:"right",flexShrink:0 }}>
                {p.score>0?"+":""}{p.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  CUSTOM BONUS INPUT
// ═══════════════════════════════════════════════════════
function CustomBonus({ onApply, color, D, dark }) {
  const [v, setV] = useState("");
  const go = () => { const n=parseInt(v,10); if(!isNaN(n)&&n!==0){ onApply(n); setV(""); } };
  return (
    <div style={{ display:"flex",gap:6,flex:2,minWidth:140 }}>
      <input type="number" value={v} placeholder="Valeur libre…"
        onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter") go(); }}
        style={{ flex:1,padding:"10px 12px",borderRadius:12,border:`1px solid ${D.brd}`,background:D.ibg,color:D.txt,fontSize:13,textAlign:"center",fontFamily:"Space Mono,monospace" }} />
      <button onClick={go} className="bonus-btn"
        style={{ padding:"10px 16px",background:`${color}22`,color,border:`1px solid ${color}44` }}>OK</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════════════════════
function HdrBtn({ label, onClick, title, disabled, D }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="hdr-btn"
      style={{ padding:"6px 9px",borderRadius:9,border:`1px solid ${D.brd}`,background:"transparent",color:disabled?D.sub+"55":D.sub,cursor:disabled?"default":"pointer",fontSize:12,fontWeight:700,flexShrink:0,whiteSpace:"nowrap" }}>
      {label}
    </button>
  );
}
function Modal({ children, onClose, D, maxW=500, noScroll=false }) {
  return (
    <div className="fade-in" onClick={onClose} style={{ position:"fixed",inset:0,zIndex:40,background:"rgba(0,0,0,.74)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div className="slide-up" onClick={e=>e.stopPropagation()} style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:22,padding:24,width:"100%",maxWidth:maxW,...(noScroll?{}:{ maxHeight:"72vh",display:"flex",flexDirection:"column",gap:0 }) }}>
        {children}
      </div>
    </div>
  );
}
function MClose({ onClick, D }) {
  return <button onClick={onClick} style={{ width:32,height:32,borderRadius:9,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:16 }}>✕</button>;
}
