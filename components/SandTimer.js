// Sablier : le sable obéit à la gravité (pause à l'horizontale, retournement),
// et « Relancer » vide le haut à toute vitesse avant de retourner le sablier.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PRESETS = [{ label:"30 s", s:30 }, { label:"1 min", s:60 }, { label:"2 min", s:120 }, { label:"3 min", s:180 }];
const GLASS = "M52,36 L148,36 C166,86 116,122 106,142 Q102,150 106,158 C116,178 166,214 148,264 L52,264 C34,214 84,178 94,158 Q98,150 94,142 C84,122 34,86 52,36 Z";
const FULL_TOP = 62;   // niveau du sable quand une ampoule est pleine (sablier debout)

// ── Forme d'une ampoule, échantillonnée en points pour conserver le volume de sable
const bez = (a, b, c, d, t) => (1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d;
// Demi-largeur de l'ampoule du haut à la hauteur y (36 → 150)
const PROFILE = Array.from({ length:61 }, (_, i) => {
  const t = i / 60;
  return { y:bez(36, 86, 122, 142, t), w:bez(148, 166, 116, 106, t) - 100 };
}).concat([{ y:150, w:4 }]);
const halfWidth = (y) => {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i-1], b = PROFILE[i];
    if (y <= b.y) return a.w + (b.w - a.w) * (y - a.y) / (b.y - a.y || 1);
  }
  return 4;
};
const TOP_POINTS = [];
for (let y = 37; y < 150; y += 2.5) {
  const w = halfWidth(y);
  for (let x = -w + 1; x < w; x += 2.5) TOP_POINTS.push([x, y - 150]);   // coordonnées relatives au col
}
const BOTTOM_POINTS = TOP_POINTS.map(([x, y]) => [x, -y]);
const CAPACITY = TOP_POINTS.filter(([, y]) => y + 150 >= FULL_TOP).length / TOP_POINTS.length;

// Seuil (le long de la gravité) au-delà duquel se trouve la fraction de sable voulue
function level(points, gx, gy, fraction) {
  const d = points.map(([x, y]) => x*gx + y*gy).sort((a, b) => a - b);
  const i = Math.round((1 - fraction * CAPACITY) * (d.length - 1));
  return d[Math.max(0, Math.min(d.length - 1, i))];
}

const ease = (t) => t < .5 ? 2*t*t : 1 - (-2*t + 2)**2 / 2;
const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

export default function SandTimer({ D, dark, onAlarm }) {
  const [dur, setDur] = useState(60);
  const [pr, setPr] = useState(1);          // fraction de sable dans l'ampoule du haut
  const [angle, setAngle] = useState(0);    // inclinaison du sablier en degrés
  const [status, setStatus] = useState("idle");   // idle | running | pausing | paused | resuming | rush | flip | done

  const prRef = useRef(1), durRef = useRef(60), angleRef = useRef(0);
  const iv = useRef(null), raf = useRef(null);
  prRef.current = pr; durRef.current = dur; angleRef.current = angle;

  const stop = useCallback(() => { clearInterval(iv.current); cancelAnimationFrame(raf.current); }, []);
  useEffect(() => stop, [stop]);

  const tween = (ms, update, done) => {
    let t0 = null;
    const step = (ts) => {
      if (t0 === null) t0 = ts;
      const t = Math.min(1, (ts - t0) / ms);
      update(t);
      if (t < 1) raf.current = requestAnimationFrame(step); else done?.();
    };
    raf.current = requestAnimationFrame(step);
  };

  // Écoulement à partir de la quantité restante
  const run = (from) => {
    stop();
    setStatus("running"); setAngle(0); setPr(from); prRef.current = from;
    const total = durRef.current * 1000;
    const end = Date.now() + from * total;
    iv.current = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      prRef.current = left / total;
      setPr(left / total);
      if (!left) { clearInterval(iv.current); setStatus("done"); onAlarm?.(); }
    }, 50);
  };

  const tilt = (to, ms, done) => {
    const from = angleRef.current;
    tween(ms, t => setAngle(from + (to - from) * ease(t)), done);
  };

  const pause = () => { stop(); setStatus("pausing"); tilt(90, 700, () => setStatus("paused")); };
  const resume = () => { stop(); setStatus("resuming"); tilt(0, 600, () => run(prRef.current)); };

  // Retournement : le sable du bas se retrouve en haut, puis le temps repart
  const flip = () => {
    setStatus("flip");
    tween(900, t => setAngle(180 * ease(t)), () => run(1));
  };

  // Relancer : (se redresser) → écoulement accéléré → retournement → départ
  const restart = () => {
    stop();
    const drain = () => {
      const from = prRef.current;
      if (from <= .001) { flip(); return; }
      setStatus("rush");
      tween(450 + 900 * from, t => { prRef.current = from * (1 - t*t); setPr(prRef.current); }, flip);
    };
    if (angleRef.current) { setStatus("resuming"); tilt(0, 450, drain); } else drain();
  };

  const pick = (s) => { stop(); setDur(s); setPr(1); setAngle(0); setStatus("idle"); };

  const done = status === "done";
  const busy = ["pausing","resuming","rush","flip"].includes(status);
  const flowing = (status === "running" || status === "rush") && pr > .005;
  const ring = pr > .5 || status === "flip" ? "#4ade80" : pr > .25 ? "#fbbf24" : "#ef4444";
  const shownSeconds = status === "flip" ? dur : Math.ceil(pr * dur - 1e-6);

  // ── Sable ──
  const rad = angle * Math.PI / 180;
  const gx = Math.sin(rad), gy = Math.cos(rad);       // gravité vue depuis le sablier
  // Pendant le retournement, tout le sable est dans l'ampoule du bas
  const topFrac = status === "flip" ? 0 : pr;
  const botFrac = 1 - topFrac;
  const topLevel = useMemo(() => level(TOP_POINTS, gx, gy, topFrac), [gx, gy, topFrac]);
  const botLevel = useMemo(() => level(BOTTOM_POINTS, gx, gy, botFrac), [gx, gy, botFrac]);
  const upright = angle === 0;
  const dip = upright && flowing ? Math.min(14, 30*(1-pr), 36*pr) : 0;   // entonnoir
  const mound = upright && status !== "idle" ? Math.min(20, 84*(1-pr)*.7) : 0; // petit tas

  const sand = (lvl, curve) => (
    <g transform={`rotate(${-angle} 100 150)`}>
      <path d={`M-200,${150+lvl} L50,${150+lvl} C85,${150+lvl} 90,${150+lvl+curve} 100,${150+lvl+curve} C110,${150+lvl+curve} 115,${150+lvl} 150,${150+lvl} L400,${150+lvl} L400,600 L-200,600 Z`} fill="url(#hgSand)"/>
    </g>
  );
  const heap = 150 + botLevel;   // surface du sable du bas, sablier debout

  const wood = dark ? ["#8a5a2b","#c48a4a","#5e3a18"] : ["#9a6430","#d9a05c","#6b4019"];
  const edge = dark ? "rgba(226,240,255,0.55)" : "rgba(60,90,130,0.45)";
  const mainBtn = { padding:"12px 20px", borderRadius:12, border:"none", fontWeight:800, fontSize:15, cursor:"pointer", minHeight:48 };

  return (
    <div style={{ background:D.card, border:`1px solid ${D.brd}`, borderRadius:20, padding:"22px 18px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:6, width:"100%", maxWidth:360 }}>
        {PRESETS.map(p => (
          <button key={p.s} onClick={() => pick(p.s)} disabled={busy} aria-pressed={dur === p.s}
            style={{ padding:"10px 2px", whiteSpace:"nowrap", borderRadius:10, border:`1.5px solid ${dur === p.s ? ring : D.brd}`, background:dur === p.s ? ring+"22" : "transparent", color:dur === p.s ? ring : D.sub, fontWeight:700, fontSize:14, cursor:"pointer", minHeight:44 }}>
            {p.label}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 200 300" role="img" aria-label={`Sablier : ${fmt(shownSeconds)} restantes`}
        data-angle={Math.round(angle)} data-sable={pr.toFixed(3)}
        style={{ height:"clamp(230px, calc(100dvh - 420px), 290px)", width:"auto", overflow:"visible", filter:"drop-shadow(0 10px 18px rgba(0,0,0,.28))" }}>
        <defs>
          <linearGradient id="hgWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={wood[2]}/><stop offset=".35" stopColor={wood[1]}/><stop offset=".7" stopColor={wood[0]}/><stop offset="1" stopColor={wood[2]}/>
          </linearGradient>
          <linearGradient id="hgSand" gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="240" y2="0">
            <stop offset="0" stopColor="#d99a26"/><stop offset=".47" stopColor="#fbd36b"/><stop offset="1" stopColor="#d99a26"/>
          </linearGradient>
          <linearGradient id="hgGlass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(150,190,230,.34)"/><stop offset=".3" stopColor="rgba(255,255,255,.10)"/><stop offset=".75" stopColor="rgba(150,190,230,.08)"/><stop offset="1" stopColor="rgba(120,160,210,.34)"/>
          </linearGradient>
          <clipPath id="hgClip"><path d={GLASS}/></clipPath>
          <clipPath id="hgTop"><rect x="0" y="0" width="200" height="150"/></clipPath>
          <clipPath id="hgBottom"><rect x="0" y="150" width="200" height="150"/></clipPath>
        </defs>

        <g transform={`rotate(${angle} 100 150)`}>
          {/* Montants tournés */}
          {[28,172].map(x => (
            <g key={x} fill="url(#hgWood)">
              <rect x={x-3.5} y="30" width="7" height="240" rx="3"/>
              <ellipse cx={x} cy="52" rx="7" ry="9"/><ellipse cx={x} cy="150" rx="6" ry="16"/><ellipse cx={x} cy="248" rx="7" ry="9"/>
            </g>
          ))}

          <path d={GLASS} fill="url(#hgGlass)"/>

          <g clipPath="url(#hgClip)">
            {topFrac > .003 && <g clipPath="url(#hgTop)">{sand(topLevel, dip)}</g>}
            {botFrac > .003 && <g clipPath="url(#hgBottom)">{sand(botLevel, -mound)}</g>}
            {upright && flowing && (
              <g>
                <line x1="100" y1="147" x2="100" y2={Math.max(150, heap - mound)} stroke="#f2bd45" strokeWidth={status === "rush" ? 6 : 2.4} strokeLinecap="round" strokeDasharray={status === "rush" ? "9 2" : "5 2"} style={{ animation:`hgStream ${status === "rush" ? ".07s" : ".25s"} linear infinite` }}/>
                {(status === "rush" ? [-9,7,-5,10,-2,4] : [-4,3,-2]).map((dx, i) => (
                  <circle key={i} cx={100+dx} cy={Math.max(152, heap - mound - 4)} r={status === "rush" ? 2 : 1.3} fill="#fbd36b" style={{ animation:`hgGrain ${status === "rush" ? ".2s" : ".5s"} ${i*(status === "rush" ? .03 : .16)}s ease-out infinite` }}/>
                ))}
              </g>
            )}
          </g>

          {/* Verre : contour et reflets */}
          <path d={GLASS} fill="none" stroke={edge} strokeWidth="2"/>
          <path d="M60,46 C52,82 74,108 88,126" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="4" strokeLinecap="round"/>
          <path d="M88,174 C70,196 56,220 59,248" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="4" strokeLinecap="round"/>

          {/* Socles */}
          {[0,1].map(i => (
            <g key={i} transform={i ? "translate(0 300) scale(1 -1)" : undefined}>
              <rect x="14" y="10" width="172" height="17" rx="8" fill="url(#hgWood)"/>
              <rect x="26" y="26" width="148" height="10" rx="4" fill="url(#hgWood)"/>
              <rect x="22" y="13" width="156" height="2.5" rx="1.2" fill="rgba(255,255,255,.28)"/>
            </g>
          ))}
        </g>
      </svg>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, width:"100%", maxWidth:260 }}>
        <div className="mono" style={{ fontSize:40, fontWeight:800, letterSpacing:-1, lineHeight:1, color:done ? ring : D.txt, animation:done ? "timerPulse .85s ease 4" : "none" }}>
          {fmt(shownSeconds)}
        </div>
        <div style={{ width:"100%", height:7, borderRadius:4, background:ring+"26", overflow:"hidden" }}>
          <div style={{ width:`${(status === "flip" ? 1 : pr)*100}%`, height:"100%", background:ring, borderRadius:4 }}/>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
        {status === "idle" && <button onClick={() => run(1)} style={{ ...mainBtn, background:ring, color:"#111" }}>▶ Démarrer</button>}
        {status === "running" && <button onClick={pause} style={{ ...mainBtn, background:"rgba(100,116,139,0.22)", color:D.txt }}>⏸ Pause</button>}
        {(status === "paused" || status === "pausing") && <button onClick={resume} style={{ ...mainBtn, background:ring, color:"#111" }}>▶ Reprendre</button>}
        {(status === "resuming" || status === "rush" || status === "flip") && <button disabled style={{ ...mainBtn, background:"rgba(100,116,139,0.22)", color:D.sub, cursor:"default" }}>⏳ Un instant…</button>}
        {status !== "idle" && (
          <button onClick={restart} disabled={busy && status !== "pausing"}
            style={{ ...mainBtn, padding:"12px 18px", background:done ? ring : "transparent", color:done ? "#fff" : D.txt, border:done ? "none" : `1px solid ${D.brd}`, opacity:busy && status !== "pausing" ? .5 : 1 }}>
            🔁 Relancer
          </button>
        )}
      </div>

      {done && <div className="slide-up" style={{ fontSize:16, fontWeight:800, color:ring }}>⏰ Temps écoulé !</div>}
    </div>
  );
}
