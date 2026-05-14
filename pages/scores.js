import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────
const PALETTE = [
  { hex: "#ff1744", name: "Écarlate"  },
  { hex: "#2979ff", name: "Électrique"},
  { hex: "#00e676", name: "Néon vert" },
  { hex: "#ffab00", name: "Soleil"    },
  { hex: "#d500f9", name: "Plasma"    },
  { hex: "#ff6d00", name: "Feu"       },
  { hex: "#00e5ff", name: "Laser"     },
  { hex: "#f50057", name: "Fuchsia"   },
  { hex: "#69f0ae", name: "Menthe"    },
  { hex: "#e040fb", name: "Orchidée"  },
];

const DEFAULT_NAMES = [
  "Alice","Bob","Charlie","Diana","Éva","François","Gabrielle",
  "Hugo","Isabelle","Julien","Louis","Marie","Nicolas","Olivia",
  "Pierre","Sophie","Thomas","Yann","Zoé","Raphaël","Camille",
];

const BONUS_CARDS  = [-10,-5,-3,-1,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const MEDALS       = ["🥇","🥈","🥉"];
const DICE_TYPES   = [4, 6, 8, 10, 12, 20, 100];
const uid          = () => Math.random().toString(36).slice(2, 9);

// Layout constants
const ROW_H   = 82;
const GEAR_SZ = 88;

// ─────────────────────────────────────────────────────────
//  GEAR SVG — épuré : cadran minimaliste, 3 branches, repères d'angle
// ─────────────────────────────────────────────────────────
function GearSVG({ rotation, lit }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100"
      style={{ display:"block", overflow:"visible" }}>
      <defs>
        <filter id="knobGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <g transform={`rotate(${rotation} 50 50)`} filter={lit?"url(#knobGlow)":undefined}>
        {/* Outer rim */}
        <circle cx="50" cy="50" r="43"
          fill={lit ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.28)"}
          stroke={lit ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.28)"}
          strokeWidth="2.5"/>

        {/* 12 tick marks — major every 3 */}
        {Array.from({length:12}, (_,i) => {
          const a  = (i/12)*Math.PI*2 - Math.PI/2;
          const major = i%3===0;
          const r1 = major ? 34 : 38;
          return (
            <line key={i}
              x1={(50+r1*Math.cos(a)).toFixed(2)}  y1={(50+r1*Math.sin(a)).toFixed(2)}
              x2={(50+43*Math.cos(a)).toFixed(2)}  y2={(50+43*Math.sin(a)).toFixed(2)}
              stroke={major
                ? (lit?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.52)")
                : (lit?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.20)")}
              strokeWidth={major ? 2.8 : 1.6}
              strokeLinecap="round"/>
          );
        })}

        {/* Inner disk */}
        <circle cx="50" cy="50" r="29"
          fill={lit ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.45)"}
          stroke={lit ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.13)"}
          strokeWidth="1.5"/>

        {/* 3 spokes */}
        {[30, 150, 270].map(deg => {
          const a = deg*Math.PI/180;
          return (
            <line key={deg}
              x1={(50+Math.cos(a)*11).toFixed(2)} y1={(50+Math.sin(a)*11).toFixed(2)}
              x2={(50+Math.cos(a)*26).toFixed(2)} y2={(50+Math.sin(a)*26).toFixed(2)}
              stroke={lit ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.32)"}
              strokeWidth="3.2" strokeLinecap="round"/>
          );
        })}

        {/* Center hub */}
        <circle cx="50" cy="50" r="7"
          fill={lit ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)"}
          stroke={lit ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.28)"}
          strokeWidth="1.8"/>
        <circle cx="50" cy="50" r="2.8"
          fill={lit ? "#fff" : "rgba(255,255,255,0.50)"}/>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
//  GEAR DRAG — tracks angular displacement around gear center.
//  One full 360° circle = 12 teeth = 12 pts.
// ─────────────────────────────────────────────────────────
const DEG_PER_PT = 30; // 360 / 12 teeth

function Gear({ onChange, size }) {
  const [rotation, setRotation] = useState(0);
  const [lit,      setLit]      = useState(false);
  const drag   = useRef(null);
  const litTmo = useRef(null);
  const cbRef  = useRef(onChange);
  const elRef  = useRef(null);
  cbRef.current = onChange;

  const emit = useCallback((pts) => {
    if (!pts) return;
    setRotation(r => r - pts * DEG_PER_PT);
    cbRef.current(pts);
    clearTimeout(litTmo.current);
    setLit(true);
    litTmo.current = setTimeout(() => setLit(false), 130);
  }, []);

  const angleDeg = (cx, cy, px, py) =>
    Math.atan2(py - cy, px - cx) * 180 / Math.PI;

  const signedDiff = (a, b) => {
    let d = a - b;
    while (d >  180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  const getCenter = () => {
    const r = elRef.current?.getBoundingClientRect();
    return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : { cx: 0, cy: 0 };
  };

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const { cx, cy } = getCenter();
    drag.current = { cx, cy, lastAngle: angleDeg(cx, cy, e.clientX, e.clientY), accDeg: 0 };
    setLit(true);
    const onMove = (ev) => {
      if (!drag.current) return;
      const { cx, cy } = drag.current;
      const newA = angleDeg(cx, cy, ev.clientX, ev.clientY);
      const diff = signedDiff(newA, drag.current.lastAngle);
      drag.current.lastAngle = newA;
      drag.current.accDeg -= diff;
      const pts = Math.trunc(drag.current.accDeg / DEG_PER_PT);
      if (pts !== 0) { drag.current.accDeg -= pts * DEG_PER_PT; emit(pts); }
    };
    const onUp = () => {
      drag.current = null; setLit(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [emit]); // eslint-disable-line

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    const { cx, cy } = getCenter();
    drag.current = { cx, cy, lastAngle: angleDeg(cx, cy, e.touches[0].clientX, e.touches[0].clientY), accDeg: 0 };
    setLit(true);
  }, []); // eslint-disable-line

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (!drag.current) return;
    const { cx, cy } = drag.current;
    const newA = angleDeg(cx, cy, e.touches[0].clientX, e.touches[0].clientY);
    const diff = signedDiff(newA, drag.current.lastAngle);
    drag.current.lastAngle = newA;
    drag.current.accDeg -= diff;
    const pts = Math.trunc(drag.current.accDeg / DEG_PER_PT);
    if (pts !== 0) { drag.current.accDeg -= pts * DEG_PER_PT; emit(pts); }
  }, [emit]); // eslint-disable-line

  const onTouchEnd = useCallback(() => { drag.current = null; setLit(false); }, []);

  useEffect(() => {
    const el = elRef.current; if (!el) return;
    const h = (e) => { e.preventDefault(); emit(e.deltaY > 0 ? -1 : 1); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [emit]);

  return (
    <div ref={elRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      data-gear="true"
      title="Tourner en cercle — 360° = 12 pts"
      style={{ width: size, height: size, cursor: "grab",
        userSelect: "none", touchAction: "none", flexShrink: 0 }}>
      <GearSVG rotation={rotation} lit={lit} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  HOLD ARROW
// ─────────────────────────────────────────────────────────
function HoldArrow({ direction, onTick, color, bg }) {
  const ivRef=useRef(null), toRef=useRef(null);
  const start=useCallback((e)=>{
    e.preventDefault(); e.stopPropagation();
    onTick();
    toRef.current=setTimeout(()=>{ ivRef.current=setInterval(onTick,75); },380);
  },[onTick]);
  const stop=useCallback(()=>{ clearTimeout(toRef.current); clearInterval(ivRef.current); },[]);
  useEffect(()=>()=>stop(),[stop]);
  return (
    <button data-arrows
      onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchEnd={stop}
      style={{ width:34, height:34, borderRadius:9, border:"none",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", fontSize:18, fontWeight:900,
        background:bg, color, userSelect:"none", touchAction:"none", transition:"filter .1s" }}
      onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.28)"}
      onMouseLeave={e=>{ e.currentTarget.style.filter="none"; stop(); }}>
      {direction==="up"?"▲":"▼"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
//  DIE FACE
// ─────────────────────────────────────────────────────────
const DOT_POS={
  1:[[50,50]],
  2:[[30,30],[70,70]],
  3:[[28,28],[50,50],[72,72]],
  4:[[28,28],[72,28],[28,72],[72,72]],
  5:[[28,28],[72,28],[50,50],[28,72],[72,72]],
  6:[[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]],
};

const polyPts = (n, r, cx=50, cy=50, offset=-90) =>
  Array.from({length:n},(_,i)=>{
    const a=(i/n*360+offset)*Math.PI/180;
    return `${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;
  }).join(" ");

function DieFace({ sides, value, size=86, color="#2563eb", rolling=false, percentile=false }) {
  const gid = `dg${sides}`;
  const shid = `ds${sides}`;
  const bvid = `db${sides}`;

  const defs = (
    <defs>
      <radialGradient id={gid} cx="35%" cy="28%" r="68%">
        <stop offset="0%"  stopColor="rgba(255,255,255,0.38)"/>
        <stop offset="100%" stopColor="rgba(0,0,0,0.18)"/>
      </radialGradient>
      <linearGradient id={bvid} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"  stopColor="rgba(255,255,255,0.50)"/>
        <stop offset="100%" stopColor="rgba(0,0,0,0.22)"/>
      </linearGradient>
      <filter id={shid} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.55"/>
      </filter>
    </defs>
  );

  const numLabel = (val, fs=28, dy=0) => {
    const display = percentile ? String(val).padStart(2,"0") : val;
    return (
      <>
        <text x="51" y={57+dy+1} textAnchor="middle" fontSize={fs}
          fontWeight="900" fontFamily="Space Mono,monospace"
          fill="rgba(0,0,0,0.45)">{display}</text>
        <text x="50" y={57+dy} textAnchor="middle" fontSize={fs}
          fontWeight="900" fontFamily="Space Mono,monospace"
          fill="rgba(255,255,255,0.96)">{display}</text>
        {(val===6||val===9)&&!percentile&&(
          <line x1="38" y1={63+dy} x2="62" y2={63+dy}
            stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>
        )}
      </>
    );
  };

  if (sides===4) {
    const outer = polyPts(3, 44, 50, 54);
    const inner = polyPts(3, 22, 50, 54);
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <polygon points={outer} fill={color}/>
          <polygon points={outer} fill={`url(#${gid})`}/>
          <polygon points={outer} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
          <polygon points={outer} fill="none" stroke="rgba(0,0,0,0.30)" strokeWidth="0.6" strokeDasharray="2,2"/>
          <polygon points={inner} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
          {polyPts(3,44,50,54).split(" ").map((pt,i)=>{
            const [x,y]=pt.split(",");
            return <line key={i} x1="50" y1="54" x2={x} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8"/>;
          })}
          {numLabel(value, 24, 6)}
        </g>
      </svg>
    );
  }

  if (sides===6) {
    const dots = DOT_POS[Math.min(value,6)]||DOT_POS[6];
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <rect x="8" y="8" width="84" height="84" rx="18" fill={color}/>
          <rect x="8" y="8" width="84" height="84" rx="18" fill={`url(#${gid})`}/>
          <rect x="8" y="8" width="84" height="84" rx="18" fill="none"
            stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
          <rect x="8" y="8" width="84" height="84" rx="18" fill="none"
            stroke="rgba(0,0,0,0.22)" strokeWidth="0.6"/>
          {dots.map(([cx,cy],i)=>(
            <g key={i}>
              <circle cx={cx+0.8} cy={cy+1.2} r="7" fill="rgba(0,0,0,0.35)"/>
              <circle cx={cx}     cy={cy}     r="7" fill="rgba(255,255,255,0.93)"/>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  if (sides===8) {
    const diamond = "50,6 92,50 50,94 8,50";
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <polygon points={diamond} fill={color}/>
          <polygon points={diamond} fill={`url(#${gid})`}/>
          <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2"/>
          <line x1="50" y1="50" x2="50" y2="6"  stroke="rgba(255,255,255,0.14)" strokeWidth="0.8"/>
          <line x1="50" y1="50" x2="50" y2="94" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8"/>
          <line x1="50" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8"/>
          <line x1="50" y1="50" x2="8"  y2="50" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8"/>
          <polygon points={diamond} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
          <polygon points={diamond} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6"/>
          {numLabel(value, 26, -2)}
        </g>
      </svg>
    );
  }

  if (sides===10) {
    const pts = "50,5 78,22 92,50 78,78 60,93 40,93 22,78 8,50 22,22";
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <polygon points={pts} fill={color}/>
          <polygon points={pts} fill={`url(#${gid})`}/>
          <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
          {pts.split(" ").map((pt,i)=>{
            const [x,y]=pt.split(",");
            return <line key={i} x1="50" y1="50" x2={x} y2={y}
              stroke="rgba(255,255,255,0.10)" strokeWidth="0.7"/>;
          })}
          <polygon points={pts} fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/>
          <polygon points={pts} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6"/>
          {numLabel(percentile ? value : (value===10?0:value), 24, 2)}
        </g>
      </svg>
    );
  }

  if (sides===12) {
    const outer = polyPts(12, 44);
    const inner = polyPts(12, 28, 50, 50, -75);
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <polygon points={outer} fill={color}/>
          <polygon points={outer} fill={`url(#${gid})`}/>
          {outer.split(" ").map((pt,i)=>{
            const [x,y]=pt.split(",");
            return <line key={i} x1="50" y1="50" x2={x} y2={y}
              stroke="rgba(255,255,255,0.10)" strokeWidth="0.6"/>;
          })}
          <polygon points={inner} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/>
          <polygon points={outer} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
          <polygon points={outer} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="0.6"/>
          {numLabel(value, 26)}
        </g>
      </svg>
    );
  }

  if (sides===20) {
    const outer = polyPts(3, 44, 50, 56);
    const inner = polyPts(3, 22, 50, 56, 90);
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <polygon points={outer} fill={color}/>
          <polygon points={outer} fill={`url(#${gid})`}/>
          <polygon points={inner} fill="rgba(0,0,0,0.10)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/>
          {outer.split(" ").map((pt,i)=>{
            const [x,y]=pt.split(",");
            return <line key={i} x1="50" y1="56" x2={x} y2={y}
              stroke="rgba(255,255,255,0.14)" strokeWidth="0.8"/>;
          })}
          <polygon points={outer} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
          <polygon points={outer} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="0.6"/>
          {numLabel(value, 22, 8)}
        </g>
      </svg>
    );
  }

  if (sides===100) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter:`drop-shadow(0 5px 14px rgba(0,0,0,0.5))`, animation:rolling?"dieRoll .09s steps(1) infinite":"none" }}>
        {defs}
        <g filter={`url(#${shid})`}>
          <rect x="6" y="6" width="88" height="88" rx="10" fill={color}/>
          <rect x="6" y="6" width="88" height="88" rx="10" fill={`url(#${gid})`}/>
          <rect x="12" y="12" width="76" height="76" rx="7"
            fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/>
          {[[14,14],[86,14],[14,86],[86,86]].map(([cx,cy],i)=>(
            <circle key={i} cx={cx} cy={cy} r="3"
              fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"/>
          ))}
          <line x1="14" y1="14" x2="86" y2="86" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>
          <line x1="86" y1="14" x2="14" y2="86" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"/>
          <rect x="6" y="6" width="88" height="88" rx="10"
            fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/>
          <text x="51" y="53" textAnchor="middle" fontSize="22"
            fontWeight="900" fontFamily="Space Mono,monospace"
            fill="rgba(0,0,0,0.4)">{value===100?"00":String(value).padStart(2,"0")}</text>
          <text x="50" y="52" textAnchor="middle" fontSize="22"
            fontWeight="900" fontFamily="Space Mono,monospace"
            fill="rgba(255,255,255,0.96)">{value===100?"00":String(value).padStart(2,"0")}</text>
          <text x="50" y="68" textAnchor="middle" fontSize="11"
            fontWeight="700" fontFamily="Sora,sans-serif"
            fill="rgba(255,255,255,0.55)">%</text>
        </g>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="8" y="8" width="84" height="84" rx="14" fill={color}/>
      <text x="50" y="57" textAnchor="middle" fontSize="28" fontWeight="800"
        fontFamily="Space Mono,monospace" fill="#fff">{value}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
//  SPINNER WHEEL
// ─────────────────────────────────────────────────────────
function SpinnerWheel({ players, onResult, acc }) {
  const [spinning,  setSpinning]  = useState(false);
  const [angle,     setAngle]     = useState(0);
  const [winner,    setWinner]    = useState(null);
  const animRef    = useRef(null);
  const angleRef   = useRef(0);
  const velRef     = useRef(0);
  const lastTsRef  = useRef(null);
  const stopFlag   = useRef(false);
  const paramsRef  = useRef(null); // { peakVel, cruiseMs, accelMs }

  const resolveWinner = useCallback((totalAngle) => {
    const n  = players.length;
    const sa = 360 / n;
    // normalize angle so 0° = top of wheel (marker position)
    const R  = ((totalAngle % 360) + 360) % 360;
    // slice i starts at (i*SA - 90)°, so after rotation R the top (0°) corresponds to
    // original angle (0 - R) mod 360 on the wheel
    const normalizedPos = ((360 - R) % 360);
    const idx = Math.floor(((normalizedPos + 90) % 360) / sa) % n;
    return players[idx];
  }, [players]);

  const finish = useCallback((a) => {
    const w = resolveWinner(a);
    setWinner(w);
    setSpinning(false);
    stopFlag.current = false;
    onResult(w);
  }, [resolveWinner, onResult]);

  const stopNow = useCallback(() => { if (spinning) stopFlag.current = true; }, [spinning]);

  const spin = useCallback(() => {
    if (spinning || players.length < 2) return;
    setWinner(null); setSpinning(true);
    stopFlag.current = false; lastTsRef.current = null;

    // Fully random parameters each spin
    const peakVel  = 6 + Math.random() * 6;        // 6–12 deg/ms (very fast)
    const accelMs  = 400 + Math.random() * 300;     // 400–700 ms acceleration
    const cruiseMs = 3000 + Math.random() * 7000;   // 3–10 s cruise (big range!)
    // random extra offset so the final position can't be predicted
    const extraOffset = Math.random() * 360 * (2 + Math.random() * 4); // 2-6 extra random rotations added
    paramsRef.current = { peakVel, accelMs, cruiseMs, extraOffset };
    velRef.current = 0;
    // add the random offset immediately to starting angle
    angleRef.current += extraOffset;
    setAngle(a => a + extraOffset);

    let elapsed = 0;

    const loop = (ts) => {
      if (!lastTsRef.current) {
        lastTsRef.current = ts;
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = Math.min(ts - lastTsRef.current, 50);
      lastTsRef.current = ts;
      elapsed += dt;

      const { peakVel, accelMs, cruiseMs } = paramsRef.current;
      let vel;
      if (stopFlag.current) {
        // decelerate quickly when user presses stop
        velRef.current = Math.max(0, velRef.current - dt * 0.012);
        vel = velRef.current;
      } else if (elapsed < accelMs) {
        vel = peakVel * (elapsed / accelMs);
      } else if (elapsed < cruiseMs) {
        vel = peakVel;
      } else {
        // smooth deceleration after cruise
        const decelElapsed = elapsed - cruiseMs;
        const decelDur = 2500 + Math.random() * 500; // ~2.5–3s stop
        vel = Math.max(0, peakVel * (1 - decelElapsed / decelDur));
      }
      velRef.current = vel;
      angleRef.current += vel * dt;
      setAngle(angleRef.current);

      if (vel <= 0) { finish(angleRef.current); return; }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [spinning, players, finish]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  if (players.length === 0) return (
    <div style={{ textAlign:"center", padding:"40px 20px", color:"#50556e" }}>
      <div style={{ fontSize:48, marginBottom:8 }}>🎡</div>
      <div style={{ fontSize:13, fontWeight:700 }}>Ajoutez des joueurs pour utiliser la roue</div>
    </div>
  );

  const W = 220, CX = W/2, CY = W/2, R = W/2 - 6;
  const SA = 360 / players.length;
  const nameFontSize = players.length <= 4 ? 13 : players.length <= 7 ? 10 : 8;

  const slices = players.map((p, i) => {
    const a0  = (i * SA - 90) * Math.PI / 180;
    const a1  = ((i + 1) * SA - 90) * Math.PI / 180;
    const large = SA > 180 ? 1 : 0;
    const midA  = ((i + 0.5) * SA - 90) * Math.PI / 180;
    const textR = R * 0.62;
    return {
      p,
      d: `M${CX},${CY} L${(CX+R*Math.cos(a0)).toFixed(2)},${(CY+R*Math.sin(a0)).toFixed(2)} A${R},${R} 0 ${large},1 ${(CX+R*Math.cos(a1)).toFixed(2)},${(CY+R*Math.sin(a1)).toFixed(2)}Z`,
      tx: CX + textR * Math.cos(midA),
      ty: CY + textR * Math.sin(midA),
      ta: (i + 0.5) * SA,
    };
  });

  const needleColor = acc || "#f59e0b";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
      <div style={{ position:"relative", width:W, height:W+18, flexShrink:0 }}>
        {/* Marker needle */}
        <div style={{
          position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
          width:0, height:0,
          borderLeft:"12px solid transparent", borderRight:"12px solid transparent",
          borderTop:`24px solid ${needleColor}`,
          zIndex:10, filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
        }}/>

        <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`}
          style={{ marginTop:18, display:"block",
            filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.60))" }}>
          <circle cx={CX} cy={CY} r={R+4} fill="#111318"
            stroke="rgba(255,255,255,0.10)" strokeWidth="2"/>

          <g transform={`rotate(${angle} ${CX} ${CY})`}>
            {slices.map(({p,d,tx,ty,ta}) => (
              <g key={p.id}>
                <path d={d} fill={p.color.hex} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5"/>
                <path d={d} fill="rgba(255,255,255,0.06)"/>
                <g transform={`rotate(${ta} ${tx} ${ty})`}>
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                    fontSize={nameFontSize} fontWeight="800" fontFamily="Sora,sans-serif"
                    fill="#fff" stroke="rgba(0,0,0,0.60)" strokeWidth="3.5"
                    paintOrder="stroke fill" style={{ userSelect:"none" }}>
                    {p.name.length > 9 ? p.name.slice(0,8)+"…" : p.name}
                  </text>
                </g>
              </g>
            ))}
            {players.map((p,i) => {
              const a = (i * SA - 90) * Math.PI / 180;
              return <line key={p.id} x1={CX} y1={CY}
                x2={(CX + R * Math.cos(a)).toFixed(2)} y2={(CY + R * Math.sin(a)).toFixed(2)}
                stroke="rgba(0,0,0,0.40)" strokeWidth="1.5"/>;
            })}
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
            <circle cx={CX} cy={CY} r="14" fill="#1a1d28"
              stroke="rgba(255,255,255,0.14)" strokeWidth="2"/>
            <circle cx={CX} cy={CY} r="8" fill={needleColor}/>
            <circle cx={CX} cy={CY} r="3.5" fill="#111318"/>
          </g>
        </svg>
      </div>

      {winner && !spinning && (
        <div className="slide-up" style={{
          padding:"10px 26px", borderRadius:13,
          background:`linear-gradient(135deg,${winner.color.hex},${winner.color.hex}aa)`,
          color:"#fff", fontWeight:800, fontSize:17, textAlign:"center",
          boxShadow:`0 4px 22px ${winner.color.hex}55`,
        }}>
          🎉 {winner.name} commence !
        </div>
      )}

      <div style={{ display:"flex", gap:10 }}>
        <button onClick={spin} disabled={spinning || players.length < 2}
          style={{ padding:"12px 30px", borderRadius:12, border:"none",
            background: spinning ? "#374151" : `linear-gradient(135deg,${needleColor},#ef4444)`,
            color:"#fff", fontWeight:800, fontSize:15,
            cursor: spinning || players.length < 2 ? "not-allowed" : "pointer",
            opacity: players.length < 2 ? 0.5 : 1,
            boxShadow: spinning ? "none" : `0 4px 16px ${needleColor}55` }}>
          {spinning ? "⏳ En cours…" : "🎡 Lancer la roue"}
        </button>
        <button onClick={stopNow} disabled={!spinning}
          style={{ padding:"12px 20px", borderRadius:12, border:"none",
            background: spinning ? "#ef4444" : "rgba(239,68,68,0.15)",
            color: spinning ? "#fff" : "#f87171",
            fontWeight:800, fontSize:15,
            cursor: spinning ? "pointer" : "default",
            opacity: spinning ? 1 : 0.45, transition:"all .2s" }}>
          ⏹ Stop
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────
export default function ScoreTracker() {
  const [dark,        setDark]       = useState(true);
  const [players,     setPlayers]    = useState([]);
  const [savedNames,  setSavedNames] = useState(DEFAULT_NAMES);
  const [gameName,    setGName]      = useState("Nouvelle partie 🎲");
  const [editName,    setEditName]   = useState(false);
  const [round,       setRound]      = useState(1);
  const [history,     setHist]       = useState([]);
  const [selected,    setSelected]   = useState(null);
  const [pending,     setPending]    = useState([]);
  const [undo,        setUndo]       = useState([]);
  const [toast,       setToast]      = useState(null);
  const [tab,         setTab]        = useState("scores");
  const [gameState,   setGameState]  = useState("idle");
  const [gameWinner,  setGameWinner] = useState(null);

  const [flashCt,  setFlashCt]  = useState({});
  const [deltaMap, setDeltaMap] = useState({});

  const [showHist,    setSH]  = useState(false);
  const [showReset,   setSR]  = useState(false);
  const [confirmRm,   setCR]  = useState(null);

  // Add player bar
  const [addQ,     setAddQ]    = useState("");
  const [addColor, setAddColor]= useState(PALETTE[0]);
  const [sugOpen,  setSugOpen] = useState(false);
  const [sugs,     setSugs]    = useState([]);

  // Dice
  const [diceType,    setDiceType]  = useState(6);
  const [diceCount,   setDiceCount] = useState(2);
  const [diceResult,  setDiceResult]= useState(null);
  const [diceValues,  setDiceValues]= useState([]);
  const [rolling,     setRolling]   = useState(false);
  const [diceHistory, setDiceHist]  = useState([]);

  const [wheelHistory, setWheelHist] = useState([]);

  const toastRef = useRef(null);
  const addRef   = useRef(null);
  const nameRef  = useRef(null);

  // ── Persistence ──────────────────────────────────────────
  useEffect(()=>{
    try {
      const s=JSON.parse(localStorage.getItem("sgt7")||"{}");
      if(s.players)      setPlayers(s.players);
      if(s.gameName)     setGName(s.gameName);
      if(s.round)        setRound(s.round);
      if(s.history)      setHist(s.history);
      if(s.diceHistory)  setDiceHist(s.diceHistory);
      if(s.wheelHistory) setWheelHist(s.wheelHistory);
      if(s.gameState)    setGameState(s.gameState);
      const n=JSON.parse(localStorage.getItem("sgt7n")||"null");
      if(n) setSavedNames(n);
    } catch {}
  },[]);
  useEffect(()=>{
    try { localStorage.setItem("sgt7",JSON.stringify({players,gameName,round,history,diceHistory,wheelHistory,gameState})); } catch {}
  },[players,gameName,round,history,diceHistory,wheelHistory,gameState]);

  // Auto-init addColor based on restored players
  useEffect(()=>{
    if(players.length>0){
      const used=new Set(players.map(p=>p.color.hex));
      setAddColor(PALETTE.find(c=>!used.has(c.hex))||PALETTE[0]);
    }
  },[players.length]); // eslint-disable-line

  // ── Toast ────────────────────────────────────────────────
  const flash=useCallback((msg,bg)=>{
    clearTimeout(toastRef.current);
    setToast({msg,bg});
    toastRef.current=setTimeout(()=>setToast(null),2400);
  },[]);

  // ── Undo ─────────────────────────────────────────────────
  const saveUndo=useCallback((snap)=>setUndo(u=>[...u.slice(-29),snap]),[]);
  const doUndo=useCallback(()=>{
    if(!undo.length) return;
    setPlayers(undo[undo.length-1]); setUndo(u=>u.slice(0,-1));
    flash("Action annulée ↩");
  },[undo,flash]);

  // ── Adjust ───────────────────────────────────────────────
  const adjust=useCallback((id,delta)=>{
    if(!delta) return;
    setPlayers(prev=>{
      saveUndo(prev);
      return prev.map(p=>{
        if(p.id!==id) return p;
        const score=p.score+delta;
        const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
        setHist(h=>[...h,{id,name:p.name,delta,score,round,time}]);
        return{...p,score};
      });
    });
    setFlashCt(f=>({...f,[id]:(f[id]||0)+1}));
    setDeltaMap(d=>({...d,[id]:delta}));
    setTimeout(()=>setDeltaMap(d=>{const n={...d};delete n[id];return n;}),560);
  },[saveUndo,round]);

  // ── Add player ───────────────────────────────────────────
  const addPlayer=useCallback((name=addQ.trim())=>{
    if(!name) return;
    if(players.find(p=>p.name.toLowerCase()===name.toLowerCase())){flash(`${name} est déjà là !`);return;}
    const p={id:uid(),name,color:addColor,score:0};
    setPlayers(prev=>{
      saveUndo(prev);
      const next=[...prev,p];
      const used=new Set(next.map(pp=>pp.color.hex));
      setAddColor(PALETTE.find(c=>!used.has(c.hex))||PALETTE[0]);
      return next;
    });
    if(!savedNames.includes(name)){
      const nn=[...savedNames,name];
      setSavedNames(nn);
      try{localStorage.setItem("sgt7n",JSON.stringify(nn));}catch{}
    }
    setAddQ(""); setSugOpen(false);
    flash(`${name} rejoint la partie !`,addColor.hex);
  },[addQ,addColor,players,saveUndo,savedNames,flash]);

  const removePlayer=useCallback((id)=>{
    setPlayers(p=>{saveUndo(p);return p.filter(x=>x.id!==id);});
    if(selected===id) setSelected(null);
    setCR(null);
  },[saveUndo,selected]);

  const changeColor=useCallback((id,color)=>
    setPlayers(p=>p.map(x=>x.id===id?{...x,color}:x)),[]);

  const onQueryChange=(v)=>{
    setAddQ(v);
    if(!v.trim()){setSugs([]);setSugOpen(false);return;}
    const q=v.toLowerCase();
    const r=savedNames.filter(n=>
      n.toLowerCase().includes(q)&&
      !players.find(p=>p.name.toLowerCase()===n.toLowerCase())
    ).slice(0,8);
    setSugs(r); setSugOpen(r.length>0);
  };

  const doReset=()=>{
    setPlayers(p=>{saveUndo(p);return p.map(x=>({...x,score:0}));});
    setHist([]); setRound(1); setSR(false); setGameState("idle"); setGameWinner(null);
    flash("Scores remis à zéro 🔄");
  };

  // ── Game lifecycle ────────────────────────────────────────
  const startGame=()=>{
    if(players.length<2){flash("Il faut au moins 2 joueurs !");return;}
    setGameState("playing"); flash("La partie a commencé ! 🎮","#16a34a");
  };
  const endGame=()=>{
    const s=[...players].sort((a,b)=>b.score-a.score);
    setGameWinner(s[0]); setGameState("ended");
  };

  const exportCSV=()=>{
    const s=[...players].sort((a,b)=>b.score-a.score);
    let csv=`Partie,${gameName}\nDate,${new Date().toLocaleDateString("fr-FR")}\nRound,${round}\n\n`;
    csv+="Rang,Joueur,Score\n";
    s.forEach((p,i)=>{csv+=`${i+1},${p.name},${p.score}\n`;});
    csv+="\nHistorique\nRound,Joueur,Delta,Score,Heure\n";
    history.forEach(e=>{csv+=`${e.round},${e.name},${e.delta>0?"+":""}${e.delta},${e.score},${e.time}\n`;});
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    Object.assign(document.createElement("a"),{href:url,download:`${gameName.replace(/\s+/g,"_")}.csv`}).click();
    URL.revokeObjectURL(url);
    flash("CSV téléchargé ✓");
  };

  const rollDice=()=>{
    if(rolling) return;
    setRolling(true); setDiceResult(null);
    let n=0;

    if(diceType===100){
      const iv=setInterval(()=>{
        const tens=Math.floor(Math.random()*10)*10;
        const units=Math.ceil(Math.random()*10);
        setDiceValues([tens,units]);
        n++;
        if(n>14){
          clearInterval(iv);
          const ft=Math.floor(Math.random()*10)*10;
          const fu=Math.ceil(Math.random()*10);
          setDiceValues([ft,fu]);
          const total=ft+fu;
          setDiceResult(total); setRolling(false);
          const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
          setDiceHist(h=>[{id:uid(),diceType:100,diceCount:1,values:[ft,fu],total,time},...h].slice(0,50));
        }
      },80);
      return;
    }

    const iv=setInterval(()=>{
      setDiceValues(Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType)));
      n++;
      if(n>14){
        clearInterval(iv);
        const vals=Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType));
        setDiceValues(vals);
        const total=vals.reduce((a,b)=>a+b,0);
        setDiceResult(total); setRolling(false);
        const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
        setDiceHist(h=>[{id:uid(),diceType,diceCount,values:vals,total,time},...h].slice(0,50));
      }
    },80);
  };

  const handleWheelResult=(w)=>{
    const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    setWheelHist(h=>[{id:uid(),name:w.name,color:w.color.hex,time,
      date:new Date().toLocaleDateString("fr-FR")},...h].slice(0,10));
  };

  // ── Derived ───────────────────────────────────────────────
  const sorted        = [...players].sort((a,b)=>b.score-a.score);
  const topScore      = sorted[0]?.score??0;
  const rankMap       = Object.fromEntries(sorted.map((p,i)=>[p.id,i]));
  const selPlayer     = players.find(p=>p.id===selected);
  const prevSelectedRef = useRef(null);
  if (prevSelectedRef.current !== selected) {
    prevSelectedRef.current = selected;
    if (pending.length) setPending([]);
  }
  const isPlaying     = gameState==="playing";
  const isEnded       = gameState==="ended";
  const gearOverflow  = (GEAR_SZ-ROW_H)/2;

  const D={
    bg:   dark?"#0b0d12":"#f0ece4",
    card: dark?"#14171f":"#ffffff",
    brd:  dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.09)",
    txt:  dark?"#e2e4f0":"#1a1a2a",
    sub:  dark?"#50556e":"#9090a8",
    ibg:  dark?"#0b0d12":"#faf6f0",
    hbg:  dark?"rgba(11,13,18,0.96)":"rgba(240,236,228,0.96)",
    acc:  dark?"#fcd34d":"#f59e0b",   // jaune plus pétant en mode nuit
  };

  return (
    <div style={{ minHeight:"100vh",background:D.bg,color:D.txt,
      fontFamily:"'Sora',sans-serif",transition:"background .3s" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .mono{font-family:'Space Mono',monospace}
        @keyframes scorePop{0%{transform:scale(1)}35%{transform:scale(1.18)}65%{transform:scale(0.94)}100%{transform:scale(1)}}
        .score-pop{animation:scorePop .28s cubic-bezier(.36,.07,.19,.97)}
        @keyframes deltaFly{0%{opacity:1;transform:translateY(0)}70%{opacity:0.9;transform:translateY(-22px) scale(1.05)}100%{opacity:0;transform:translateY(-46px) scale(0.85)}}
        .delta-fly{animation:deltaFly 1.5s ease forwards;pointer-events:none}
        @keyframes slideUp{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}
        .slide-up{animation:slideUp .18s ease}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fade-in{animation:fadeIn .15s ease}
        @keyframes crown{0%,100%{transform:scale(1) rotate(-5deg)}50%{transform:scale(1.1) rotate(5deg)}}
        @keyframes dieRoll{0%{transform:rotate(0)}25%{transform:rotate(13deg) scale(1.04)}50%{transform:rotate(-8deg) scale(0.96)}100%{transform:rotate(0)}}
        @keyframes dieLand{0%{transform:scale(1.26) rotate(8deg);opacity:.6}60%{transform:scale(.93)}100%{transform:scale(1) rotate(0);opacity:1}}
        .die-land{animation:dieLand .3s cubic-bezier(.36,.07,.19,.97)}
        .p-row{transition:box-shadow .2s}
        .p-row:hover{filter:brightness(1.06)}
        .bonus-btn{border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:700;font-size:16px;transition:transform .09s,opacity .1s;border-radius:12px}
        .bonus-btn:hover{opacity:.78}
        .bonus-btn:active{transform:scale(.85)}
        .cdot{width:14px;height:14px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s}
        .cdot:hover{transform:scale(1.5)}
        .sug-row{display:flex;align-items:center;gap:9px;width:100%;padding:10px 13px;background:none;border:none;cursor:pointer;font-size:13px;font-family:'Sora',sans-serif;text-align:left;transition:background .1s}
        .sug-row:hover{background:rgba(128,128,128,.12)}
        .hdr-btn{transition:color .12s,background .12s}
        .hdr-btn:hover:not(:disabled){background:rgba(128,128,128,.11)!important}
        .tab-btn{transition:all .17s}
        .tab-btn:hover{opacity:.84}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:2px}
        input{font-family:'Sora',sans-serif}
        input:focus{outline:none}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .die-sel-btn{border-radius:10px;border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:800;font-size:14px;padding:10px 14px;transition:all .13s}
        .die-sel-btn:hover{filter:brightness(1.13);transform:translateY(-1px)}
        .rm-btn{transition:background .12s,color .12s}
        .rm-btn:hover{background:rgba(239,68,68,0.5)!important;color:#fff!important}
      `}</style>

      {/* ══════ HEADER ══════ */}
      <header style={{ position:"sticky",top:0,zIndex:40,
        background:D.hbg,backdropFilter:"blur(14px)",borderBottom:`1px solid ${D.brd}` }}>
        <div style={{ maxWidth:900,margin:"0 auto",padding:"9px 14px",
          display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
          <span style={{ fontSize:20,flexShrink:0 }}>🎲</span>

          <div style={{ flex:1,minWidth:0 }}>
            {editName
              ?<input ref={nameRef} value={gameName} onChange={e=>setGName(e.target.value)}
                  onBlur={()=>setEditName(false)}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditName(false);}}
                  autoFocus
                  style={{ background:"transparent",border:"none",borderBottom:`2px solid ${D.acc}`,
                    fontWeight:800,fontSize:13,color:D.txt,width:"100%",paddingBottom:2 }}/>
              :<div onClick={()=>setEditName(true)} title="Renommer"
                  style={{ fontWeight:800,fontSize:13,color:D.txt,cursor:"text",
                    display:"flex",alignItems:"center",gap:5 }}>
                  {gameName}<span style={{ fontSize:10,color:D.sub }}>✏️</span>
                </div>
            }
            <div style={{ fontSize:10,color:D.sub,marginTop:1 }}>
              {players.length} joueur{players.length!==1?"s":""} · Round {round}
              {isPlaying&&<span style={{ color:"#22c55e",marginLeft:6 }}>● En jeu</span>}
              {isEnded  &&<span style={{ color:D.acc,marginLeft:6 }}>● Terminée</span>}
            </div>
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:2,flexShrink:0 }}>
            <HdrBtn label="−" onClick={()=>setRound(r=>Math.max(1,r-1))} D={D}/>
            <span className="mono" style={{ fontSize:10,color:D.sub,minWidth:22,textAlign:"center" }}>R{round}</span>
            <HdrBtn label="+" onClick={()=>setRound(r=>r+1)} D={D}/>
          </div>

          <div style={{ width:1,height:18,background:D.brd,flexShrink:0 }}/>
          <HdrBtn label="↩"   title="Annuler"       onClick={doUndo}         disabled={!undo.length} D={D}/>
          <HdrBtn label="📋"  title="Historique"    onClick={()=>setSH(true)} D={D}/>
          <HdrBtn label="CSV" title="Exporter CSV"  onClick={exportCSV}       D={D}/>
          <HdrBtn label="🔄"  title="Réinitialiser" onClick={()=>setSR(true)} D={D}/>
          <div style={{ width:1,height:18,background:D.brd,flexShrink:0 }}/>

          {gameState==="idle"&&players.length>=2&&(
            <button onClick={startGame}
              style={{ padding:"5px 12px",borderRadius:8,border:"none",
                background:"#16a34a",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer" }}>
              ▶ Débuter</button>
          )}
          {isPlaying&&(
            <button onClick={endGame}
              style={{ padding:"5px 12px",borderRadius:8,border:"none",
                background:"#ef4444",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer" }}>
              ⏹ Terminer</button>
          )}
          {isEnded&&(
            <button onClick={()=>{setGameState("idle");setGameWinner(null);}}
              style={{ padding:"5px 12px",borderRadius:8,border:"none",
                background:D.acc,color:"#111",cursor:"pointer",fontWeight:700,fontSize:11 }}>
              🔁 Nouvelle</button>
          )}

          <button onClick={()=>setDark(!dark)}
            style={{ width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,
              background:"transparent",cursor:"pointer",fontSize:14,flexShrink:0 }}>
            {dark?"☀️":"🌙"}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth:900,margin:"0 auto",padding:"0 14px",display:"flex",gap:2 }}>
          {[{key:"scores",label:"🏆 Scores"},{key:"dice",label:"🎲 Dés"},{key:"wheel",label:"🎡 Qui commence ?"}]
            .map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)}
                style={{ padding:"7px 14px",border:"none",borderRadius:"10px 10px 0 0",
                  background:tab===t.key?D.card:"transparent",
                  color:tab===t.key?D.txt:D.sub,
                  fontWeight:tab===t.key?800:600,fontSize:11,cursor:"pointer",
                  borderBottom:tab===t.key?`2px solid ${D.acc}`:"2px solid transparent" }}>
                {t.label}
              </button>
            ))}
        </div>
      </header>

      {/* ══════ WINNER BANNER ══════ */}
      {isEnded&&gameWinner&&(
        <div className="slide-up" style={{
          background:`linear-gradient(135deg,${gameWinner.color.hex},${gameWinner.color.hex}99)`,
          padding:"18px 22px",textAlign:"center" }}>
          <div style={{ fontSize:30,marginBottom:5 }}>🏆</div>
          <div style={{ fontWeight:800,fontSize:20,color:"#fff",marginBottom:3 }}>
            {gameWinner.name} remporte la partie !</div>
          <div className="mono" style={{ fontSize:26,color:"rgba(255,255,255,0.88)" }}>
            {gameWinner.score>0?"+":""}{gameWinner.score} pts</div>
        </div>
      )}

      <main style={{ maxWidth:900,margin:"0 auto",padding:"14px 10px 180px",overflow:"visible" }}>

        {/* ═══ SCORES ═══ */}
        {tab==="scores"&&(
          <div style={{ overflow:"visible" }}>
            {players.length===0&&(
              <div style={{ textAlign:"center",padding:"70px 20px 28px",color:D.sub }}>
                <div style={{ fontSize:68,opacity:.65,lineHeight:1,marginBottom:12 }}>🎯</div>
                <div style={{ fontSize:19,fontWeight:800,color:D.txt,marginBottom:7 }}>Prêt pour la partie ?</div>
                <div style={{ fontSize:13,lineHeight:1.9 }}>
                  Ajoutez des joueurs via le champ en bas.<br/>
                  Glissez la roue ↑ pour marquer, ↓ pour retrancher.<br/>
                  <strong style={{color:"#4ade80"}}>▲</strong> et <strong style={{color:"#f87171"}}>▼</strong> ajustent de +1/−1.
                </div>
              </div>
            )}

            {/* ← gap:14 pour espacer les lignes */}
            <div style={{ display:"flex",flexDirection:"column",gap:14,overflow:"visible" }}>
              {players.map((player)=>{
                const rank = rankMap[player.id] ?? 0;
                return (
                <PlayerRow key={player.id}
                  player={player} rank={rank}
                  medal={rank<3?MEDALS[rank]:`${rank+1}`}
                  isLeader={rank===0&&players.length>1&&topScore>0}
                  isSel={selected===player.id}
                  flashKey={flashCt[player.id]||0}
                  delta={deltaMap[player.id]}
                  dark={dark} D={D} isPlaying={isPlaying}
                  onAdjust={pts=>adjust(player.id,pts)}
                  onRemove={()=>setCR(player.id)}
                  onSelect={()=>setSelected(selected===player.id?null:player.id)}
                  onColorChange={c=>changeColor(player.id,c)}
                  gearOverflow={gearOverflow}
                  playerHistory={history.filter(h=>h.id===player.id)}
                />
                );
              })}
            </div>

            {players.length>1&&<MiniLeaderboard sorted={sorted} topScore={topScore} D={D} dark={dark}/>}
          </div>
        )}

        {/* ═══ DICE ═══ */}
        {tab==="dice"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:16 }}>
              <div style={{ fontSize:11,fontWeight:700,color:D.sub,marginBottom:11,textTransform:"uppercase",letterSpacing:1 }}>Type de dé</div>
              <div style={{ display:"flex",gap:7,flexWrap:"wrap" }}>
                {DICE_TYPES.map(d=>(
                  <button key={d} className="die-sel-btn" onClick={()=>setDiceType(d)}
                    style={{ background:diceType===d?D.acc:dark?"#1a1d27":"#eee",
                      color:diceType===d?dark?"#111":"#fff":D.txt }}>D{d}</button>
                ))}
              </div>
            </div>

            {diceType!==100&&(
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:16,
              display:"flex",alignItems:"center",gap:16 }}>
              <div style={{ fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1 }}>Nombre de dés</div>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginLeft:"auto" }}>
                <button onClick={()=>setDiceCount(c=>Math.max(1,c-1))}
                  style={{ width:32,height:32,borderRadius:8,border:"none",
                    background:"rgba(239,68,68,0.14)",color:"#f87171",cursor:"pointer",fontWeight:900,fontSize:17 }}>−</button>
                <span className="mono" style={{ fontSize:28,fontWeight:800,color:D.txt,minWidth:36,textAlign:"center" }}>{diceCount}</span>
                <button onClick={()=>setDiceCount(c=>Math.min(10,c+1))}
                  style={{ width:32,height:32,borderRadius:8,border:"none",
                    background:"rgba(34,197,94,0.14)",color:"#4ade80",cursor:"pointer",fontWeight:900,fontSize:17 }}>+</button>
              </div>
            </div>
            )}

            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:22,textAlign:"center" }}>
              <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",
                minHeight:90,alignItems:"center",marginBottom:18 }}>
                {diceValues.length===0
                  ?<div style={{ color:D.sub,fontSize:13 }}>Lancez les dés !</div>
                  :diceType===100&&diceValues.length>=2
                    ?<div style={{ display:"flex",alignItems:"center",gap:14 }}>
                        <div className={!rolling&&diceResult!=null?"die-land":""}>
                          <DieFace sides={10} value={diceValues[0]} size={86} color="#6366f1" rolling={rolling} percentile/>
                        </div>
                        <div style={{ fontSize:22,fontWeight:900,color:"rgba(255,255,255,0.5)" }}>+</div>
                        <div className={!rolling&&diceResult!=null?"die-land":""}>
                          <DieFace sides={10} value={diceValues[1]} size={86} color="#7c3aed" rolling={rolling}/>
                        </div>
                     </div>
                    :diceValues.map((val,i)=>(
                      <div key={i} className={!rolling&&diceResult!=null?"die-land":""}>
                        <DieFace sides={diceType} value={val} size={86} color="#6366f1" rolling={rolling}/>
                      </div>
                    ))
                }
              </div>
              {diceResult!=null&&!rolling&&(
                <div className="slide-up" style={{ marginBottom:16 }}>
                  <div style={{ fontSize:12,color:D.sub,marginBottom:2 }}>
                    {diceType===100
                      ?<span>D100 · <span style={{color:"rgba(255,255,255,0.45)"}}>
                          {diceValues[0]===0?"00":diceValues[0]} + {diceValues[1]===10?0:diceValues[1]}
                        </span></span>
                      :`${diceCount}×D${diceType}`}
                  </div>
                  <div className="mono" style={{ fontSize:46,fontWeight:800,color:D.acc }}>{diceResult}</div>
                  {diceCount>1&&diceType!==100&&<div style={{ fontSize:11,color:D.sub }}>[{diceValues.join(" + ")}]</div>}
                </div>
              )}
              <button onClick={rollDice} disabled={rolling}
                style={{ padding:"13px 40px",borderRadius:13,border:"none",
                  background:rolling?"#6b7280":`linear-gradient(135deg,${D.acc},#ef4444)`,
                  color:dark?"#111":"#fff",fontWeight:800,fontSize:15,
                  cursor:rolling?"not-allowed":"pointer" }}>
                {rolling?"🎲 En cours…":`🎲 Lancer ${diceType===100?"1×":(diceCount>1?`${diceCount}×`:"")}D${diceType}`}
              </button>
            </div>

            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:16 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1 }}>📋 Historique</div>
                <button onClick={()=>setDiceHist([])}
                  style={{ padding:"4px 11px",borderRadius:7,border:"none",
                    background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11 }}>
                  Effacer</button>
              </div>
              {diceHistory.length===0
                ?<div style={{ textAlign:"center",padding:"18px 0",color:D.sub,fontSize:12 }}>Aucun lancé</div>
                :<div style={{ display:"flex",flexDirection:"column",gap:5,maxHeight:260,overflowY:"auto" }}>
                  {diceHistory.map(e=>(
                    <div key={e.id} style={{ display:"flex",alignItems:"center",gap:8,
                      padding:"8px 12px",borderRadius:9,background:dark?"#ffffff03":"#00000003" }}>
                      <span style={{ flex:1,fontSize:12,color:D.sub }}>
                        {e.diceType===100
                          ?`D100 → [${e.values[0]===0?"00":e.values[0]}+${e.values[1]===10?0:e.values[1]}]`
                          :`${e.diceCount}×D${e.diceType} → [${e.values.join(",")}]`}
                      </span>
                      <span className="mono" style={{ fontSize:15,fontWeight:800,color:D.acc }}>{e.total}</span>
                      <span style={{ fontSize:10,color:D.sub,flexShrink:0 }}>{e.time}</span>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}

        {/* ═══ WHEEL ═══ */}
        {tab==="wheel"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:22,
              display:"flex",flexDirection:"column",alignItems:"center" }}>
              <SpinnerWheel players={players} onResult={handleWheelResult} acc={D.acc}/>
            </div>
            <div style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:16 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11 }}>
                <div style={{ fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1 }}>
                  🏁 Historique premiers joueurs</div>
                <button onClick={()=>setWheelHist([])}
                  style={{ padding:"4px 11px",borderRadius:7,border:"none",
                    background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11 }}>
                  Effacer</button>
              </div>
              {wheelHistory.length===0
                ?<div style={{ textAlign:"center",padding:"18px 0",color:D.sub,fontSize:12 }}>
                  Aucune partie — lancez la roue !</div>
                :<div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {wheelHistory.map((e,i)=>(
                    <div key={e.id} style={{ display:"flex",alignItems:"center",gap:9,
                      padding:"9px 13px",borderRadius:11,
                      background:i===0?`rgba(${dark?"245,158,11":"245,158,11"},0.07)`:dark?"#ffffff02":"#00000002",
                      border:i===0?`1px solid ${D.acc}30`:"1px solid transparent" }}>
                      <span style={{ fontSize:i===0?16:12,flexShrink:0 }}>{i===0?"🥇":"⚫"}</span>
                      <div style={{ width:28,height:28,borderRadius:"50%",background:e.color,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:"#fff",fontWeight:800,fontSize:12,flexShrink:0 }}>{e.name[0]}</div>
                      <span style={{ flex:1,fontWeight:700,fontSize:14,color:e.color }}>{e.name}</span>
                      <span style={{ fontSize:11,color:D.sub }}>{e.date} · {e.time}</span>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        )}
      </main>

      {/* ══════ ADD PLAYER BAR — fixed bottom, taille fixe ══════ */}
      <div style={{ position:"fixed",
        bottom: selPlayer&&tab==="scores" ? 190 : 0,
        left:0, right:0, zIndex:25,
        background:D.hbg, backdropFilter:"blur(14px)",
        borderTop:`1px solid ${D.brd}`, padding:"10px 12px 14px",
        minHeight:72 }}>
        <div style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ fontSize:10,fontWeight:700,color:D.sub,marginBottom:7,
            textTransform:"uppercase",letterSpacing:1 }}>➕ Ajouter un joueur</div>
          <div style={{ position:"relative" }}>
            <div style={{ display:"flex",gap:7,alignItems:"center" }}>
              {/* Indicateur de couleur auto (petite pastille, non cliquable dans le formulaire) */}
              <div style={{ width:12,height:12,borderRadius:"50%",background:addColor.hex,
                flexShrink:0,border:"2px solid rgba(255,255,255,0.25)" }}/>
              <div style={{ flex:1,display:"flex",alignItems:"center",gap:7,
                padding:"9px 12px",borderRadius:10,border:`1px solid ${D.brd}`,background:D.ibg }}>
                <input ref={addRef} value={addQ}
                  onChange={e=>onQueryChange(e.target.value)}
                  onFocus={()=>addQ&&setSugOpen(sugs.length>0)}
                  onBlur={()=>setTimeout(()=>setSugOpen(false),150)}
                  onKeyDown={e=>{
                    if(e.key==="Enter"){sugs[0]?addPlayer(sugs[0]):addPlayer();}
                    if(e.key==="Escape"){setAddQ("");setSugOpen(false);}
                  }}
                  placeholder="Nom du joueur…"
                  style={{ flex:1,background:"transparent",border:"none",color:D.txt,fontSize:13 }}/>
                {addQ&&<button onClick={()=>{setAddQ("");setSugOpen(false);}}
                  style={{ background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:15,lineHeight:1 }}>×</button>}
              </div>
              <button onClick={()=>addPlayer()} disabled={!addQ.trim()}
                style={{ padding:"9px 18px",borderRadius:9,border:"none",flexShrink:0,
                  fontWeight:700,fontSize:13,cursor:addQ.trim()?"pointer":"default",
                  background:addQ.trim()?D.acc:dark?"#2a2d3a":"#dddad4",
                  color:addQ.trim()?(dark?"#111":"#fff"):D.sub }}>
                Ajouter
              </button>
            </div>

            {sugOpen&&sugs.length>0&&(
              <div className="fade-in" style={{ position:"absolute",
                bottom:"calc(100% + 5px)",left:0,right:0,zIndex:35,
                background:dark?"#1c1f2e":"#fff",border:`1px solid ${D.brd}`,
                borderRadius:12,overflow:"hidden",
                boxShadow:"0 -6px 24px rgba(0,0,0,.28)" }}>
                {sugs.map((n,i)=>(
                  <button key={i} className="sug-row" onMouseDown={()=>addPlayer(n)}
                    style={{ color:D.txt }}>
                    <span style={{ width:22,height:22,borderRadius:"50%",
                      background:addColor.hex+"28",color:addColor.hex,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontWeight:700,fontSize:11,flexShrink:0 }}>{n[0]}</span>
                    {n}
                  </button>
                ))}
                {addQ&&!sugs.find(s=>s.toLowerCase()===addQ.toLowerCase())&&(
                  <button className="sug-row" onMouseDown={()=>addPlayer()}
                    style={{ color:D.acc,fontWeight:700,
                      borderTop:sugs.length?`1px solid ${D.brd}`:"none" }}>
                    <span>✚</span> Ajouter « {addQ} »
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════ BONUS BAR ══════ */}
      {selPlayer&&tab==="scores"&&(()=>{
        const sessionTotal = pending.reduce((a,b)=>a+b,0);
        const formulaParts = pending.map(v=>(v>0?"+":"")+v);
        const formulaStr   = formulaParts.length
          ? formulaParts.join(" ") + " = " + (sessionTotal>=0?"+":"") + sessionTotal
          : null;
        return (
          <div className="slide-up" style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:24,
            background:dark?"rgba(9,11,17,0.98)":"rgba(238,234,226,0.98)",
            backdropFilter:"blur(18px)",borderTop:`1px solid ${D.brd}`,
            padding:"8px 10px 12px" }}>
            <div style={{ maxWidth:900,margin:"0 auto" }}>

              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:26,height:26,borderRadius:"50%",background:selPlayer.color.hex,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:"#fff",fontWeight:800,fontSize:11,
                    boxShadow:`0 0 10px ${selPlayer.color.hex}66` }}>{selPlayer.name[0]}</div>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:selPlayer.color.hex,lineHeight:1.2 }}>{selPlayer.name}</div>
                    <div style={{ fontSize:10,color:D.sub }}>
                      Score : <span className="mono" style={{ fontWeight:700,color:D.txt }}>
                        {selPlayer.score>=0?"+":""}{selPlayer.score}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                  {formulaStr&&(
                    <>
                      <div style={{ fontSize:11,fontWeight:700,
                        color:sessionTotal>=0?"#4ade80":"#f87171",
                        fontFamily:"monospace",maxWidth:170,textAlign:"right",
                        lineHeight:1.3,wordBreak:"break-all",
                        background:sessionTotal>=0?"rgba(34,197,94,0.10)":"rgba(239,68,68,0.10)",
                        border:`1px solid ${sessionTotal>=0?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}`,
                        borderRadius:7,padding:"3px 7px" }}>
                        {formulaStr}
                      </div>
                      <button onClick={()=>setPending([])}
                        style={{ width:24,height:24,borderRadius:6,border:"none",
                          background:"rgba(239,68,68,0.15)",color:"#f87171",
                          cursor:"pointer",fontSize:12,fontWeight:800 }}>✕</button>
                    </>
                  )}
                  <button onClick={()=>{setSelected(null);setPending([]);}}
                    style={{ width:26,height:26,borderRadius:7,border:`1px solid ${D.brd}`,
                      background:"transparent",color:D.sub,cursor:"pointer",fontSize:13 }}>✕</button>
                </div>
              </div>

              {/* Card grid */}
              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(46px,1fr))",
                gap:6 }}>
                {BONUS_CARDS.map(b=>{
                  const neg=b<0;
                  const col=neg?"#f87171":"#4ade80";
                  const bg=neg?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)";
                  const brd=neg?"rgba(239,68,68,0.28)":"rgba(34,197,94,0.28)";
                  return (
                    <button key={b}
                      onClick={()=>{
                        adjust(selPlayer.id, b);
                        setPending(p=>[...p,b]);
                      }}
                      style={{ padding:"9px 2px",borderRadius:9,
                        border:`1.5px solid ${brd}`,background:bg,color:col,
                        fontWeight:800,fontSize:13,fontFamily:"Space Mono,monospace",
                        cursor:"pointer",textAlign:"center",lineHeight:1,userSelect:"none",
                        transition:"transform .08s" }}
                      onMouseDown={e=>e.currentTarget.style.transform="scale(0.86)"}
                      onMouseUp  ={e=>e.currentTarget.style.transform="scale(1)"}
                      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                    >
                      {b>0?"+":""}{b}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════ MODALS ══════ */}
      {showHist&&(
        <Modal onClose={()=>setSH(false)} D={D}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:13 }}>
            <h3 style={{ fontWeight:800,fontSize:16 }}>📋 Historique</h3>
            <MClose onClick={()=>setSH(false)} D={D}/>
          </div>
          <div style={{ overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:5 }}>
            {history.length===0
              ?<p style={{ textAlign:"center",padding:"28px 0",color:D.sub,fontSize:12 }}>Aucune action</p>
              :[...history].reverse().map((e,i)=>{
                const p=players.find(pp=>pp.id===e.id);
                const isNeg = e.delta < 0;
                return(
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:9,
                    padding:"8px 12px",borderRadius:10,
                    background: isNeg
                      ? (dark?"rgba(239,68,68,0.14)":"rgba(239,68,68,0.08)")
                      : (dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)") }}>
                    <span style={{ width:8,height:8,borderRadius:"50%",background:p?.color.hex||"#888",flexShrink:0 }}/>
                    <span style={{ fontWeight:600,fontSize:13,flex:1,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.name}</span>
                    <span className="mono" style={{ fontSize:12,padding:"2px 7px",borderRadius:5,
                      background:isNeg?"#ef444430":"#22c55e25",
                      color:isNeg?"#f87171":"#4ade80",fontWeight:800,flexShrink:0 }}>
                      {e.delta>0?"+":""}{e.delta}</span>
                    <span className="mono" style={{ fontSize:12,
                      color: dark?"#e2e4f0":"#1a1a2a",fontWeight:600,flexShrink:0 }}>
                      → {e.score>0?"+":""}{e.score}</span>
                    <span style={{ fontSize:10,color:D.sub,flexShrink:0 }}>R{e.round}·{e.time}</span>
                  </div>
                );
              })
            }
          </div>
        </Modal>
      )}

      {showReset&&(
        <Modal onClose={()=>setSR(false)} D={D} noScroll maxW={310}>
          <h3 style={{ fontWeight:800,fontSize:15,marginBottom:7 }}>🔄 Remettre à zéro ?</h3>
          <p style={{ fontSize:12,color:D.sub,lineHeight:1.7,marginBottom:18 }}>
            Tous les scores reviennent à 0 et l'historique est effacé.<br/>Les joueurs restent.
          </p>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>setSR(false)}
              style={{ flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${D.brd}`,
                background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:12 }}>Annuler</button>
            <button onClick={doReset}
              style={{ flex:1,padding:"9px 0",borderRadius:10,border:"none",
                background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12 }}>Réinitialiser</button>
          </div>
        </Modal>
      )}

      {confirmRm&&(()=>{
        const p=players.find(x=>x.id===confirmRm);
        return p?(
          <Modal onClose={()=>setCR(null)} D={D} noScroll maxW={290}>
            <div style={{ textAlign:"center",marginBottom:14 }}>
              <div style={{ width:42,height:42,borderRadius:"50%",background:p.color.hex,
                margin:"0 auto 9px",display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontWeight:800,fontSize:18 }}>{p.name[0]}</div>
              <h3 style={{ fontWeight:800,fontSize:15,marginBottom:5 }}>Retirer {p.name} ?</h3>
              <p style={{ fontSize:12,color:D.sub,lineHeight:1.6 }}>
                Le joueur sera supprimé de la partie.<br/>Annulable via ↩.
              </p>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setCR(null)}
                style={{ flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${D.brd}`,
                  background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:12 }}>Annuler</button>
              <button onClick={()=>removePlayer(confirmRm)}
                style={{ flex:1,padding:"9px 0",borderRadius:10,border:"none",
                  background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12 }}>Retirer</button>
            </div>
          </Modal>
        ):null;
      })()}

      {toast&&(
        <div className="slide-up" style={{ position:"fixed",
          bottom:selPlayer&&tab==="scores"?196:58,
          left:"50%",transform:"translateX(-50%)",zIndex:60,
          padding:"10px 20px",borderRadius:11,
          background:toast.bg||(dark?"#252938":"#e8e4dc"),
          color: dark?"#fff":"#111",
          fontWeight:700,fontSize:12,
          boxShadow:"0 5px 20px rgba(0,0,0,.38)",whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PLAYER ROW
// ─────────────────────────────────────────────────────────
function PlayerRow({ player, rank, medal, isLeader, isSel, flashKey, delta,
  dark, D, isPlaying, onAdjust, onRemove, onSelect, onColorChange, gearOverflow, playerHistory }) {
  const col=player.color.hex;
  const [showPalette, setPalette]=useState(false);

  return (
    <div style={{ position:"relative",
      paddingTop:gearOverflow, paddingBottom:gearOverflow,
      zIndex: isSel?10:1 }}>

      <div className="p-row"
        onClick={e=>{
          if(e.target.closest("[data-gear]")||e.target.closest("[data-rm]")||
             e.target.closest("[data-pal]")||e.target.closest("[data-arrows]")) return;
          onSelect();
        }}
        style={{ position:"relative",height:ROW_H,borderRadius:14,
          background:col,cursor:"pointer",overflow:"visible",
          boxShadow:isSel
            ?`inset 0 0 0 9999px rgba(0,0,0,0.09),0 0 0 2.5px ${col},0 0 0 4.5px rgba(255,255,255,0.18)`
            :`inset 0 0 0 9999px rgba(0,0,0,0.52),0 2px 7px ${col}25`,
          display:"flex",alignItems:"center",gap:9,padding:"0 10px 0 13px" }}>

        {/* Rank */}
        <div style={{ minWidth:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.12)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:rank<3?14:11,fontWeight:800,color:"#fff",flexShrink:0 }}>{medal}</div>

        {/* Avatar / palette */}
        <div style={{ position:"relative",flexShrink:0 }} data-pal>
          <button onClick={e=>{e.stopPropagation();setPalette(v=>!v);}}
            style={{ width:38,height:38,borderRadius:"50%",
              background:"rgba(255,255,255,0.16)",backdropFilter:"blur(4px)",
              border:"2px solid rgba(255,255,255,0.30)",color:"#fff",
              fontWeight:800,fontSize:isLeader?16:14,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            {isLeader
              ?<span style={{ display:"inline-block",animation:"crown 1.4s ease-in-out infinite" }}>👑</span>
              :player.name[0].toUpperCase()}
          </button>
          {showPalette&&(
            <div className="fade-in" data-pal
              style={{ position:"absolute",top:46,left:0,zIndex:30,
                background:dark?"#1c1f2e":"#fff",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:5,width:140,
                boxShadow:"0 9px 28px rgba(0,0,0,.48)" }}
              onClick={e=>e.stopPropagation()}>
              {PALETTE.map(c=>(
                <button key={c.hex} className="cdot"
                  onClick={()=>{onColorChange(c);setPalette(false);}} title={c.name}
                  style={{ background:c.hex,
                    outline:player.color.hex===c.hex?`2px solid ${c.hex}`:"none",
                    outlineOffset:player.color.hex===c.hex?2:0,
                    transform:player.color.hex===c.hex?"scale(1.4)":"scale(1)" }}/>
              ))}
            </div>
          )}
        </div>

        {/* Name + history inline */}
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontWeight:700,fontSize:16,color:"#fff",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{player.name}</div>
          <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:3 }}>
            <span style={{ fontSize:11,color:"rgba(255,255,255,0.45)",flexShrink:0 }}>
              {isLeader?"👑 En tête":`#${rank+1}`}
            </span>
            {/* Inline score history — last 6 deltas */}
            {playerHistory.length > 0 && (
              <div style={{ display:"flex",gap:3,alignItems:"center",
                background:"rgba(0,0,0,0.30)",borderRadius:6,padding:"1px 5px",
                overflow:"hidden",flexShrink:1,minWidth:0 }}>
                {playerHistory.slice(-6).map((h,i) => (
                  <span key={i} className="mono" style={{
                    fontSize:10,fontWeight:700,flexShrink:0,
                    color: h.delta < 0 ? "#f87171" : "#86efac"
                  }}>
                    {h.delta > 0 ? "+" : ""}{h.delta}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Score — centré absolument dans la row */}
        <div style={{ position:"absolute",left:0,right: GEAR_SZ + 3*2 + 34*2 + 60,
          top:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",
          pointerEvents:"none" }}>
          <div style={{ position:"relative" }}>
            <div key={flashKey} className="mono score-pop"
              style={{ fontSize:44,fontWeight:700,color:"#fff",
                letterSpacing:-1.5,lineHeight:1 }}>
              {player.score>0?"+":""}{player.score}
            </div>
            {delta!==undefined&&(
              <div className="delta-fly mono" style={{ position:"absolute",top:-6,right:-32,
                zIndex:5,fontSize:17,fontWeight:800,
                color:delta>0?"#86efac":"#fca5a5" }}>
                {delta>0?"+":""}{delta}
              </div>
            )}
          </div>
        </div>

        {/* ◄ Gear ► */}
        <div data-gear style={{
          position:"absolute",
          right: isPlaying ? 12 : 38,
          top:"50%", transform:"translateY(-50%)",
          display:"flex",flexDirection:"row",alignItems:"center",gap:3,
          zIndex:5,
        }}>
          <HoldArrow direction="down" onTick={()=>onAdjust(-1)}
            color="#f87171" bg="rgba(239,68,68,0.18)"/>
          <Gear onChange={onAdjust} size={GEAR_SZ}/>
          <HoldArrow direction="up" onTick={()=>onAdjust(1)}
            color="#4ade80" bg="rgba(34,197,94,0.18)"/>
        </div>

        {/* Spacer */}
        <div style={{ width: GEAR_SZ + 3*2 + 34*2, flexShrink:0 }}/>

        {/* Remove */}
        {!isPlaying&&(
          <button data-rm onClick={e=>{e.stopPropagation();onRemove();}}
            className="rm-btn"
            style={{ width:22,height:22,borderRadius:6,border:"none",flexShrink:0,
              background:"rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.42)",
              cursor:"pointer",fontSize:11,position:"relative",zIndex:6 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MINI LEADERBOARD
// ─────────────────────────────────────────────────────────
function MiniLeaderboard({ sorted, topScore, D, dark }) {
  const min=Math.min(...sorted.map(p=>p.score));
  const range=topScore-min||1;
  return (
    <div style={{ marginTop:16,background:D.card,border:`1px solid ${D.brd}`,
      borderRadius:14,padding:"15px 18px" }}>
      <div style={{ fontSize:10,fontWeight:700,color:D.sub,marginBottom:13,
        textTransform:"uppercase",letterSpacing:1 }}>📊 Classement</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {sorted.map((p,i)=>{
          const pct=Math.max(3,((p.score-min)/range)*100);
          return(
            <div key={p.id} style={{ display:"flex",alignItems:"center",gap:9 }}>
              <span style={{ fontSize:i<3?13:10,minWidth:18,textAlign:"center",flexShrink:0 }}>
                {i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</span>
              <div style={{ width:27,height:27,borderRadius:"50%",background:p.color.hex,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontWeight:800,fontSize:11,flexShrink:0 }}>{p.name[0]}</div>
              <span style={{ fontSize:13,fontWeight:600,minWidth:68,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</span>
              <div style={{ flex:1,height:7,borderRadius:4,
                background:dark?"#ffffff06":"#00000006",overflow:"hidden" }}>
                <div style={{ width:`${pct}%`,height:"100%",borderRadius:4,
                  background:p.color.hex,transition:"width .5s ease" }}/>
              </div>
              <span className="mono" style={{ fontSize:12,fontWeight:700,color:p.color.hex,
                minWidth:44,textAlign:"right",flexShrink:0 }}>
                {p.score>0?"+":""}{p.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  CUSTOM BONUS
// ─────────────────────────────────────────────────────────
function CustomBonus({ onApply, color, D }) {
  const [v,setV]=useState("");
  const go=()=>{ const n=parseInt(v,10); if(!isNaN(n)&&n!==0){onApply(n);setV("");} };
  return (
    <div style={{ display:"flex",gap:5,flex:2,minWidth:120 }}>
      <input type="number" value={v} placeholder="Libre…"
        onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")go();}}
        style={{ flex:1,padding:"8px 9px",borderRadius:9,border:`1px solid ${D.brd}`,
          background:D.ibg,color:D.txt,fontSize:12,textAlign:"center",
          fontFamily:"Space Mono,monospace" }}/>
      <button onClick={go} className="bonus-btn"
        style={{ padding:"8px 12px",background:`${color}1e`,color,border:`1px solid ${color}35` }}>OK</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────
function HdrBtn({ label, onClick, title, disabled, D }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="hdr-btn"
      style={{ padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,
        background:"transparent",color:disabled?D.sub+"44":D.sub,
        cursor:disabled?"default":"pointer",fontSize:11,fontWeight:700,
        flexShrink:0,whiteSpace:"nowrap" }}>
      {label}
    </button>
  );
}
function Modal({ children, onClose, D, maxW=480, noScroll=false }) {
  return (
    <div className="fade-in" onClick={onClose}
      style={{ position:"fixed",inset:0,zIndex:55,background:"rgba(0,0,0,.70)",
        backdropFilter:"blur(7px)",display:"flex",alignItems:"center",
        justifyContent:"center",padding:16 }}>
      <div className="slide-up" onClick={e=>e.stopPropagation()}
        style={{ background:D.card,border:`1px solid ${D.brd}`,borderRadius:18,
          padding:20,width:"100%",maxWidth:maxW,
          ...(noScroll?{}:{maxHeight:"68vh",display:"flex",flexDirection:"column"}) }}>
        {children}
      </div>
    </div>
  );
}
function MClose({ onClick, D }) {
  return <button onClick={onClick}
    style={{ width:28,height:28,borderRadius:7,border:`1px solid ${D.brd}`,
      background:"transparent",color:D.sub,cursor:"pointer",fontSize:13 }}>✕</button>;
}
