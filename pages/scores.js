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
const TEETH     = 12;
const STEP_PX   = 22;
const DEG_STEP  = 360 / TEETH;
const DEG_PX    = DEG_STEP / STEP_PX;
const MEDALS    = ["🥇","🥈","🥉"];

const uid = () => Math.random().toString(36).slice(2, 9);

// ═══════════════════════════════════════════════════════
//  GEAR SVG
// ═══════════════════════════════════════════════════════
function buildGearPath(teeth = TEETH, ri = 22, ro = 35, tw = 0.38) {
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

function GearSVG({ rotation, size, lit }) {
  const id = `g${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display:"block", overflow:"visible" }}>
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="62%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
        </radialGradient>
      </defs>
      <g transform={`rotate(${rotation} 50 50)`}>
        {/* drop shadow */}
        <path d={GEAR_D} fill="rgba(0,0,0,0.28)" transform="translate(1.5,2.5)" />
        {/* body */}
        <path d={GEAR_D} fill="rgba(255,255,255,0.88)" />
        {/* sheen */}
        <path d={GEAR_D} fill={`url(#${id})`} />
        {/* active glow */}
        {lit && <path d={GEAR_D} fill="rgba(255,255,255,0.22)" />}
        {/* hub ring */}
        <circle cx="50" cy="50" r="11"  fill="rgba(0,0,0,0.36)" />
        <circle cx="50" cy="50" r="5.5" fill="rgba(255,255,255,0.72)" />
        <circle cx="50" cy="50" r="2.2" fill="rgba(0,0,0,0.38)" />
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  GEAR — interactive drag/wheel widget
// ═══════════════════════════════════════════════════════
function Gear({ onChange, size = 64 }) {
  const [rotation, setRotation] = useState(0);
  const [lit, setLit]           = useState(false);
  const drag    = useRef(null);
  const litRef  = useRef(null);
  const cbRef   = useRef(onChange);
  const gearEl  = useRef(null);

  // Always fresh callback — avoids stale closure
  cbRef.current = onChange;

  // Core logic (kept in a ref so event listener closures always call latest version)
  const procRef = useRef(null);
  procRef.current = (dy) => {
    if (!drag.current) return;
    const inv = -dy;               // up = positive = increase
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

  // ── Mouse ──
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

  // ── Touch ──
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

  // ── Wheel (non-passive) ──
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
        transform: lit ? "scale(1.07)" : "scale(1)",
        transition: lit ? "none" : "transform .14s",
        flexShrink: 0,
      }}
    >
      <GearSVG rotation={rotation} size={size} lit={lit} />
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
  const [round,    setRound]   = useState(1);
  const [history,  setHist]    = useState([]);
  const [selected, setSelected]= useState(null);
  const [undo,     setUndo]    = useState([]);
  const [toast,    setToast]   = useState(null);

  // Animation
  const [flashCt,  setFlashCt] = useState({}); // id→counter for key trick
  const [deltaMap, setDeltaMap]= useState({}); // id→delta for fly-up

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

  const toastRef   = useRef(null);
  const addInput   = useRef(null);

  // ── Persistence ────────────────────────────────────────
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("sgt5") || "{}");
      if (s.players)  setPlayers(s.players);
      if (s.gameName) setGName(s.gameName);
      if (s.round)    setRound(s.round);
      if (s.history)  setHist(s.history);
      const n = JSON.parse(localStorage.getItem("sgt5n") || "null");
      if (n) setNames(n);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("sgt5", JSON.stringify({ players, gameName, round, history })); }
    catch {}
  }, [players, gameName, round, history]);

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
      try { localStorage.setItem("sgt5n", JSON.stringify(nn)); } catch {}
    }
    setAddQ(""); setSugOpen(false);
    flash(`${name} a rejoint la partie !`, addColor.hex);
    setTimeout(() => addInput.current?.focus(), 60);
  }, [addQ, addColor, players, saveUndo, names, flash]);

  // ── Remove / color change ──────────────────────────────
  const removePlayer  = useCallback((id) => {
    setPlayers(p => { saveUndo(p); return p.filter(x => x.id !== id); });
    if (selected === id) setSelected(null);
  }, [saveUndo, selected]);

  const changeColor = useCallback((id, color) =>
    setPlayers(p => p.map(x => x.id === id ? { ...x, color } : x)), []);

  // ── Autocomplete ───────────────────────────────────────
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

  // ── Reset ──────────────────────────────────────────────
  const doReset = () => {
    setPlayers(p => { saveUndo(p); return p.map(x => ({ ...x, score: 0 })); });
    setHist([]); setRound(1); setSR(false);
    flash("Scores remis à zéro 🔄");
  };

  // ── Export ─────────────────────────────────────────────
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

  // ── Computed ───────────────────────────────────────────
  const sorted    = [...players].sort((a, b) => b.score - a.score);
  const topScore  = sorted[0]?.score ?? 0;
  const selPlayer = players.find(p => p.id === selected);

  // ── Theme ──────────────────────────────────────────────
  const D = {
    bg:   dark ? "#0b0d12" : "#f0ece4",
    card: dark ? "#14171f" : "#ffffff",
    brd:  dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)",
    txt:  dark ? "#e2e4f0" : "#1a1a2a",
    sub:  dark ? "#50556e" : "#9090a8",
    ibg:  dark ? "#0b0d12" : "#faf6f0",
    hbg:  dark ? "rgba(11,13,18,0.96)" : "rgba(240,236,228,0.96)",
  };

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

        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:rgba(128,128,128,.22);border-radius:2px; }
        input { font-family:'Sora',sans-serif; }
        input:focus { outline:none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
      `}</style>

      {/* ════════════════════════════════════
          HEADER
      ════════════════════════════════════ */}
      <header style={{ position:"sticky",top:0,zIndex:30,background:D.hbg,backdropFilter:"blur(14px)",borderBottom:`1px solid ${D.brd}` }}>
        <div style={{ maxWidth:900,margin:"0 auto",padding:"10px 18px",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:22,flexShrink:0 }}>🎲</span>

          <div style={{ flex:1,minWidth:0 }}>
            <input value={gameName} onChange={e=>setGName(e.target.value)}
              style={{ background:"transparent",border:"none",fontWeight:800,fontSize:15,color:D.txt,width:"100%" }}
              placeholder="Nom de la partie…" />
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
      </header>

      {/* ════════════════════════════════════
          PLAYER LIST
      ════════════════════════════════════ */}
      <main style={{ maxWidth:900,margin:"0 auto",padding:"18px 14px 150px" }}>

        {players.length===0 && (
          <div style={{ textAlign:"center",padding:"90px 20px 40px",color:D.sub }}>
            <div style={{ fontSize:80,opacity:.8,lineHeight:1,marginBottom:16 }}>🎯</div>
            <div style={{ fontSize:22,fontWeight:800,color:D.txt,marginBottom:10 }}>Prêt pour la partie ?</div>
            <div style={{ fontSize:14,lineHeight:1.8 }}>
              Ajoutez des joueurs ci-dessous.<br/>
              Glissez la roue <strong style={{color:"#f59e0b"}}>↑</strong> pour gagner des points,{" "}
              <strong style={{color:"#f87171"}}>↓</strong> pour en perdre.
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

        {/* ── Add player ── */}
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
              {/* Input */}
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
                {/* Suggestions */}
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
              {/* Color + actions */}
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

        {/* ── Mini leaderboard ── */}
        {players.length>1 && <MiniLeaderboard sorted={sorted} topScore={topScore} D={D} dark={dark} />}
      </main>

      {/* ════════════════════════════════════
          STICKY BONUS BAR
      ════════════════════════════════════ */}
      {selPlayer && (
        <div className="slide-up" style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:25,background:dark?"rgba(11,13,18,0.97)":"rgba(240,236,228,0.97)",backdropFilter:"blur(18px)",borderTop:`1px solid ${D.brd}`,padding:"13px 18px 20px" }}>
          <div style={{ maxWidth:900,margin:"0 auto" }}>
            {/* Player pill */}
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

            {/* Bonus grid */}
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
              {/* Custom val */}
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
            <h3 style={{ fontWeight:800,fontSize:17 }}>📋 Historique</h3>
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
        <div className="slide-up" style={{ position:"fixed",bottom:selPlayer?104:24,left:"50%",transform:"translateX(-50%)",zIndex:50,padding:"11px 22px",borderRadius:14,background:toast.bg||(dark?"#252938":"#1c1f2e"),color:"#fff",fontWeight:700,fontSize:13,boxShadow:"0 8px 28px rgba(0,0,0,.4)",whiteSpace:"nowrap" }}>
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
      if(e.target.closest("[data-gear]")||e.target.closest("[data-rm]")||e.target.closest("[data-pal]")) return;
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

        {/* Avatar / color picker trigger */}
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

        {/* Gear + arrows */}
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0 }} data-gear>
          <span className="mono" style={{ fontSize:9,color:"rgba(255,255,255,0.38)",fontWeight:700 }}>↑ +1</span>
          <Gear onChange={onAdjust} size={62} />
          <span className="mono" style={{ fontSize:9,color:"rgba(255,255,255,0.38)",fontWeight:700 }}>↓ −1</span>
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
