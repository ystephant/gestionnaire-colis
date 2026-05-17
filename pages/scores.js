import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────
const PALETTE = [
  { hex:"#ff1744", name:"Écarlate"  },
  { hex:"#2979ff", name:"Électrique"},
  { hex:"#00e676", name:"Néon vert" },
  { hex:"#ffab00", name:"Soleil"    },
  { hex:"#d500f9", name:"Plasma"    },
  { hex:"#ff6d00", name:"Feu"       },
  { hex:"#00e5ff", name:"Laser"     },
  { hex:"#f50057", name:"Fuchsia"   },
  { hex:"#69f0ae", name:"Menthe"    },
  { hex:"#e040fb", name:"Orchidée"  },
];
const DEFAULT_NAMES = [
  "Alice","Bob","Charlie","Diana","Éva","François","Gabrielle",
  "Hugo","Isabelle","Julien","Louis","Marie","Nicolas","Olivia",
  "Pierre","Sophie","Thomas","Yann","Zoé","Raphaël","Camille",
];
const BONUS_CARDS = [-10,-5,-3,-1,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const MEDALS      = ["🥇","🥈","🥉"];
const DICE_TYPES  = [4,6,8,10,12,20,100];
const uid         = () => Math.random().toString(36).slice(2,9);

// ─────────────────────────────────────────────────────────
//  RESPONSIVE HOOK
// ─────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 800);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h, { passive: true });
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ─────────────────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{overscroll-behavior-y:contain}
  .mono{font-family:'Space Mono',monospace}

  /* ── Animations ── */
  @keyframes scorePop{0%{transform:scale(1)}35%{transform:scale(1.18)}65%{transform:scale(0.94)}100%{transform:scale(1)}}
  .score-pop{animation:scorePop .28s cubic-bezier(.36,.07,.19,.97)}
  @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .slide-up{animation:slideUp .2s ease}
  @keyframes slideUpSheet{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
  .slide-up-sheet{animation:slideUpSheet .28s cubic-bezier(.22,.61,.36,1)}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .fade-in{animation:fadeIn .15s ease}
  @keyframes crown{0%,100%{transform:scale(1) rotate(-5deg)}50%{transform:scale(1.1) rotate(5deg)}}
  @keyframes dieRoll{0%{transform:rotate(0)}25%{transform:rotate(13deg) scale(1.04)}50%{transform:rotate(-8deg) scale(.96)}100%{transform:rotate(0)}}
  @keyframes dieLand{0%{transform:scale(1.26) rotate(8deg);opacity:.6}60%{transform:scale(.93)}100%{transform:scale(1) rotate(0);opacity:1}}
  .die-land{animation:dieLand .3s cubic-bezier(.36,.07,.19,.97)}
  @keyframes gearHint{0%,100%{transform:rotate(0)}25%{transform:rotate(-22deg)}75%{transform:rotate(22deg)}}
  .gear-hint-anim svg{animation:gearHint 1.1s ease-in-out 3}
  @keyframes swipeFlash{0%{opacity:.9}60%{opacity:.6}100%{opacity:0}}
  .swipe-flash{animation:swipeFlash .38s ease forwards}
  @keyframes sandFall{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(7px);opacity:0}}
  @keyframes hourglassShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg)}60%{transform:rotate(9deg)}}
  @keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  @keyframes gearAccPop{0%{opacity:0;transform:translateY(4px) scale(.9)}15%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0;transform:translateY(-6px) scale(.88)}}
  .gear-acc-pop{animation:gearAccPop 1.8s ease forwards}
  @keyframes histSlide{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  .hist-slide{animation:histSlide .18s ease}

  /* ── Components ── */
  .p-row{transition:box-shadow .2s,filter .15s,opacity .15s}
  @media(hover:hover){.p-row:hover{filter:brightness(1.07)}}
  .cdot{width:14px;height:14px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s;-webkit-tap-highlight-color:transparent}
  .cdot:active{transform:scale(1.5)}
  .sug-row{display:flex;align-items:center;gap:9px;width:100%;padding:13px;background:none;border:none;cursor:pointer;font-size:14px;font-family:'Sora',sans-serif;text-align:left;transition:background .1s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.sug-row:hover{background:rgba(128,128,128,.12)}}
  .hdr-btn{transition:color .12s,background .12s;-webkit-tap-highlight-color:transparent;min-height:36px;min-width:36px}
  @media(hover:hover){.hdr-btn:hover:not(:disabled){background:rgba(128,128,128,.11)!important}}
  .tab-btn{transition:all .17s;-webkit-tap-highlight-color:transparent;flex-shrink:0}
  .drag-handle{cursor:grab;touch-action:none;user-select:none;padding:0 6px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
  .drag-handle:active{cursor:grabbing}
  .score-input-edit{background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,0.8);color:#fff;font-family:'Space Mono',monospace;font-weight:700;text-align:center;outline:none;caret-color:#fff;letter-spacing:-1px;width:120px;font-size:34px}
  .bonus-card{border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:800;border-radius:10px;transition:transform .08s;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;line-height:1}
  .bonus-card:active{transform:scale(0.84)}
  .die-sel-btn{border-radius:10px;border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:800;transition:all .13s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.die-sel-btn:hover{filter:brightness(1.13);transform:translateY(-1px)}}
  .rm-btn{transition:background .12s,color .12s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.rm-btn:hover{background:rgba(239,68,68,0.5)!important;color:#fff!important}}
  .overflow-menu-item{display:flex;align-items:center;gap:12px;width:100%;padding:14px 18px;background:none;border:none;cursor:pointer;font-size:15px;font-family:'Sora',sans-serif;font-weight:600;text-align:left;-webkit-tap-highlight-color:transparent;transition:background .1s}
  @media(hover:hover){.overflow-menu-item:hover{background:rgba(128,128,128,.10)}}
  button:focus-visible{outline:2px solid #fcd34d;outline-offset:2px}

  /* ── Scrollbars ── */
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:2px}

  /* ── Inputs ── */
  input{font-family:'Sora',sans-serif}
  input:focus{outline:none}
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  input[type=number]{-moz-appearance:textfield}

  /* ── Tabs scroll ── */
  .tabs-scroll{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:2px}
  .tabs-scroll::-webkit-scrollbar{display:none}

  /* ── Safe area ── */
  .safe-bottom{padding-bottom:env(safe-area-inset-bottom,0px)}

  /* ── Overlay ── */
  .overlay{position:fixed;inset:0;z-index:54;background:rgba(0,0,0,.65);backdrop-filter:blur(6px)}
`;

// ─────────────────────────────────────────────────────────
//  GEAR SVG
// ─────────────────────────────────────────────────────────
function GearSVG({ rotation, lit }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display:"block", overflow:"visible" }}>
      <defs>
        <filter id="knobGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${rotation} 50 50)`} filter={lit?"url(#knobGlow)":undefined}>
        <circle cx="50" cy="50" r="43" fill={lit?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.28)"} stroke={lit?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.28)"} strokeWidth="2.5"/>
        {Array.from({length:12},(_,i)=>{
          const a=(i/12)*Math.PI*2-Math.PI/2,major=i%3===0,r1=major?34:38;
          return <line key={i} x1={(50+r1*Math.cos(a)).toFixed(2)} y1={(50+r1*Math.sin(a)).toFixed(2)} x2={(50+43*Math.cos(a)).toFixed(2)} y2={(50+43*Math.sin(a)).toFixed(2)} stroke={major?(lit?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.52)"):(lit?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.20)")} strokeWidth={major?2.8:1.6} strokeLinecap="round"/>;
        })}
        <circle cx="50" cy="50" r="29" fill={lit?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.45)"} stroke={lit?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.13)"} strokeWidth="1.5"/>
        {[30,150,270].map(deg=>{const a=deg*Math.PI/180;return <line key={deg} x1={(50+Math.cos(a)*11).toFixed(2)} y1={(50+Math.sin(a)*11).toFixed(2)} x2={(50+Math.cos(a)*26).toFixed(2)} y2={(50+Math.sin(a)*26).toFixed(2)} stroke={lit?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.32)"} strokeWidth="3.2" strokeLinecap="round"/>;  })}
        <circle cx="50" cy="50" r="7" fill={lit?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.15)"} stroke={lit?"rgba(255,255,255,0.70)":"rgba(255,255,255,0.28)"} strokeWidth="1.8"/>
        <circle cx="50" cy="50" r="2.8" fill={lit?"#fff":"rgba(255,255,255,0.50)"}/>
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
//  GEAR — accumulation + commit after 900ms idle
// ─────────────────────────────────────────────────────────
const DEG_PER_PT = 30;

function Gear({ onCommit, size, onFirstUse, playerScore, playerColor }) {
  const [rotation,    setRotation]    = useState(0);
  const [lit,         setLit]         = useState(false);
  const [accumulated, setAccumulated] = useState(0);
  const drag     = useRef(null);
  const litTmo   = useRef(null);
  const idleTmo  = useRef(null);
  const accRef   = useRef(0);
  const cbRef    = useRef(onCommit);
  const elRef    = useRef(null);
  const usedRef  = useRef(false);
  cbRef.current  = onCommit;

  const commit = useCallback(() => {
    if (!accRef.current) return;
    cbRef.current(accRef.current);
    accRef.current = 0;
    setAccumulated(0);
  }, []);

  const scheduleCommit = useCallback(() => {
    clearTimeout(idleTmo.current);
    idleTmo.current = setTimeout(commit, 900);
  }, [commit]);

  const addPts = useCallback((pts) => {
    if (!pts) return;
    if (!usedRef.current) { usedRef.current = true; onFirstUse?.(); }
    setRotation(r => r - pts * DEG_PER_PT);
    accRef.current += pts;
    setAccumulated(accRef.current);
    clearTimeout(litTmo.current);
    setLit(true);
    litTmo.current = setTimeout(() => setLit(false), 120);
    scheduleCommit();
  }, [onFirstUse, scheduleCommit]);

  const angleDeg   = (cx,cy,px,py) => Math.atan2(py-cy,px-cx)*180/Math.PI;
  const signedDiff = (a,b) => { let d=a-b; while(d>180)d-=360; while(d<-180)d+=360; return d; };
  const getCenter  = () => { const r=elRef.current?.getBoundingClientRect(); return r?{cx:r.left+r.width/2,cy:r.top+r.height/2}:{cx:0,cy:0}; };

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const {cx,cy}=getCenter();
    drag.current={cx,cy,lastAngle:angleDeg(cx,cy,e.clientX,e.clientY),accDeg:0};
    setLit(true);
    const mv=(ev)=>{ if(!drag.current)return; const{cx,cy}=drag.current; const nA=angleDeg(cx,cy,ev.clientX,ev.clientY); const diff=signedDiff(nA,drag.current.lastAngle); drag.current.lastAngle=nA; drag.current.accDeg-=diff; const pts=Math.trunc(drag.current.accDeg/DEG_PER_PT); if(pts){drag.current.accDeg-=pts*DEG_PER_PT;addPts(pts);} };
    const up=()=>{ drag.current=null; setLit(false); window.removeEventListener("mousemove",mv); window.removeEventListener("mouseup",up); };
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  },[addPts]);

  const onTouchStart=useCallback((e)=>{ e.preventDefault(); const{cx,cy}=getCenter(); drag.current={cx,cy,lastAngle:angleDeg(cx,cy,e.touches[0].clientX,e.touches[0].clientY),accDeg:0}; setLit(true); },[]);
  const onTouchMove=useCallback((e)=>{ e.preventDefault(); if(!drag.current)return; const{cx,cy}=drag.current; const nA=angleDeg(cx,cy,e.touches[0].clientX,e.touches[0].clientY); const diff=signedDiff(nA,drag.current.lastAngle); drag.current.lastAngle=nA; drag.current.accDeg-=diff; const pts=Math.trunc(drag.current.accDeg/DEG_PER_PT); if(pts){drag.current.accDeg-=pts*DEG_PER_PT;addPts(pts);} },[addPts]);
  const onTouchEnd=useCallback(()=>{ drag.current=null; setLit(false); },[]);

  useEffect(()=>{ const el=elRef.current; if(!el)return; const h=(e)=>{e.preventDefault();addPts(e.deltaY>0?-1:1);}; el.addEventListener("wheel",h,{passive:false}); return()=>el.removeEventListener("wheel",h); },[addPts]);
  useEffect(()=>()=>{ clearTimeout(idleTmo.current); clearTimeout(litTmo.current); },[]);

  const showAcc  = accumulated !== 0;
  const newScore = playerScore + accumulated;

  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div ref={elRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        data-gear="true"
        aria-label="Molette de score"
        style={{ width:"100%", height:"100%", cursor:"grab", userSelect:"none", touchAction:"none" }}>
        <GearSVG rotation={rotation} lit={lit}/>
      </div>
      {showAcc && (
        <div key={accumulated} className="gear-acc-pop"
          style={{ position:"absolute", top:-52, left:"50%", transform:"translateX(-50%)",
            background:"rgba(0,0,0,0.92)", borderRadius:11, pointerEvents:"none",
            padding:"5px 11px", whiteSpace:"nowrap", zIndex:20,
            border:`1px solid ${playerColor}66`,
            display:"flex", alignItems:"center", gap:5 }}>
          <span className="mono" style={{ fontSize:12, color:"rgba(255,255,255,0.42)" }}>{playerScore>0?"+":""}{playerScore}</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.30)" }}>{accumulated>0?"＋":"－"}</span>
          <span className="mono" style={{ fontSize:13, fontWeight:800, color:accumulated>0?"#4ade80":"#f87171" }}>{Math.abs(accumulated)}</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.30)" }}>＝</span>
          <span className="mono" style={{ fontSize:14, fontWeight:900, color:playerColor }}>{newScore>0?"+":""}{newScore}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  DIE FACE (condensed)
// ─────────────────────────────────────────────────────────
const DOT_POS={1:[[50,50]],2:[[30,30],[70,70]],3:[[28,28],[50,50],[72,72]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[28,28],[72,28],[50,50],[28,72],[72,72]],6:[[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]]};
const polyPts=(n,r,cx=50,cy=50,off=-90)=>Array.from({length:n},(_,i)=>{const a=(i/n*360+off)*Math.PI/180;return`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(" ");

function DieFace({sides,value,size=86,color="#2563eb",rolling=false,percentile=false}){
  const gid=`dg${sides}`,shid=`ds${sides}`;
  const defs=(<defs><radialGradient id={gid} cx="35%" cy="28%" r="68%"><stop offset="0%" stopColor="rgba(255,255,255,0.38)"/><stop offset="100%" stopColor="rgba(0,0,0,0.18)"/></radialGradient><filter id={shid} x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.55"/></filter></defs>);
  const nL=(val,fs=28,dy=0)=>{const d=percentile?String(val).padStart(2,"0"):val;return(<><text x="51" y={57+dy+1} textAnchor="middle" fontSize={fs} fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(0,0,0,0.45)">{d}</text><text x="50" y={57+dy} textAnchor="middle" fontSize={fs} fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(255,255,255,0.96)">{d}</text>{(val===6||val===9)&&!percentile&&<line x1="38" y1={63+dy} x2="62" y2={63+dy} stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>}</>);};
  const anim=rolling?"dieRoll .09s steps(1) infinite":"none";
  const sh={filter:"drop-shadow(0 5px 14px rgba(0,0,0,0.5))",animation:anim};
  if(sides===6){const dots=DOT_POS[Math.min(value,6)]||DOT_POS[6];return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><rect x="8" y="8" width="84" height="84" rx="18" fill={color}/><rect x="8" y="8" width="84" height="84" rx="18" fill={`url(#${gid})`}/><rect x="8" y="8" width="84" height="84" rx="18" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{dots.map(([cx,cy],i)=>(<g key={i}><circle cx={cx+.8} cy={cy+1.2} r="7" fill="rgba(0,0,0,0.35)"/><circle cx={cx} cy={cy} r="7" fill="rgba(255,255,255,0.93)"/></g>))}</g></svg>);}
  if(sides===4){const o=polyPts(3,44,50,54);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gid})`}/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,24,6)}</g></svg>);}
  if(sides===8){const d="50,6 92,50 50,94 8,50";return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><polygon points={d} fill={color}/><polygon points={d} fill={`url(#${gid})`}/><line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2"/><polygon points={d} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,26,-2)}</g></svg>);}
  if(sides===10){const pts="50,5 78,22 92,50 78,78 60,93 40,93 22,78 8,50 22,22";return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><polygon points={pts} fill={color}/><polygon points={pts} fill={`url(#${gid})`}/><polygon points={pts} fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/>{nL(percentile?value:(value===10?0:value),24,2)}</g></svg>);}
  if(sides===12){const o=polyPts(12,44),i2=polyPts(12,28,50,50,-75);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gid})`}/><polygon points={i2} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,26)}</g></svg>);}
  if(sides===20){const o=polyPts(3,44,50,56),i2=polyPts(3,22,50,56,90);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gid})`}/><polygon points={i2} fill="rgba(0,0,0,0.10)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,22,8)}</g></svg>);}
  if(sides===100){return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${shid})`}><rect x="6" y="6" width="88" height="88" rx="10" fill={color}/><rect x="6" y="6" width="88" height="88" rx="10" fill={`url(#${gid})`}/><rect x="12" y="12" width="76" height="76" rx="7" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/><rect x="6" y="6" width="88" height="88" rx="10" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/><text x="51" y="53" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(0,0,0,0.4)">{value===100?"00":String(value).padStart(2,"0")}</text><text x="50" y="52" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(255,255,255,0.96)">{value===100?"00":String(value).padStart(2,"0")}</text><text x="50" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Sora,sans-serif" fill="rgba(255,255,255,0.55)">%</text></g></svg>);}
  return(<svg width={size} height={size} viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="14" fill={color}/><text x="50" y="57" textAnchor="middle" fontSize="28" fontWeight="800" fontFamily="Space Mono,monospace" fill="#fff">{value}</text></svg>);
}

// ─────────────────────────────────────────────────────────
//  BOTTOM SHEET MODAL  (full screen on mobile)
// ─────────────────────────────────────────────────────────
function BottomSheet({ children, onClose, D, isMobile, maxW=480, title }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  if (isMobile) {
    return (
      <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
        <div className="slide-up-sheet safe-bottom" ref={ref} tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:55,
            background:D.card, borderRadius:"22px 22px 0 0",
            padding:"0 0 8px", maxHeight:"90dvh",
            display:"flex", flexDirection:"column", outline:"none",
            border:`1px solid ${D.brd}` }}>
          {/* Pull bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"14px 18px 10px", flexShrink:0 }}>
            <div style={{ width:36, height:4, borderRadius:2,
              background:"rgba(128,128,128,0.30)", margin:"0 auto" }}/>
          </div>
          {title && (
            <div style={{ padding:"0 18px 12px", display:"flex",
              alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <span style={{ fontWeight:800, fontSize:17 }}>{title}</span>
              <button onClick={onClose} aria-label="Fermer"
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${D.brd}`,
                  background:"transparent", color:D.sub, cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
          )}
          <div style={{ overflowY:"auto", flex:1, padding:"0 18px 12px" }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true"
      style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div className="slide-up" ref={ref} tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ background:D.card, border:`1px solid ${D.brd}`, borderRadius:18,
          padding:20, width:"100%", maxWidth:maxW, outline:"none",
          maxHeight:"78vh", display:"flex", flexDirection:"column" }}>
        {title && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ fontWeight:800, fontSize:16 }}>{title}</span>
            <button onClick={onClose} aria-label="Fermer"
              style={{ width:28, height:28, borderRadius:7, border:`1px solid ${D.brd}`,
                background:"transparent", color:D.sub, cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
        )}
        <div style={{ overflowY:"auto", flex:1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PLAYER MINI HISTORY
// ─────────────────────────────────────────────────────────
function PlayerMiniHistory({ entries, color, isMobile }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const last10 = entries.slice(-10);
  return (
    <div style={{ marginTop:5 }}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        aria-expanded={open}
        style={{ display:"flex", alignItems:"center", gap:4,
          background:"rgba(0,0,0,0.22)", border:"none", borderRadius:7,
          padding:"3px 8px", cursor:"pointer", color:"rgba(255,255,255,0.50)",
          minHeight:28 }}>
        <span style={{ fontSize:10, fontWeight:700 }}>{open?"▲":"▼"} hist.</span>
        {!open && (
          <div style={{ display:"flex", gap:2, alignItems:"center", maxWidth: isMobile ? 80 : 140, overflow:"hidden" }}>
            {last10.slice(isMobile ? -5 : -10).map((h,i)=>(
              <span key={i} className="mono" style={{ fontSize:9, fontWeight:800, color:h.delta<0?"#fca5a5":"#86efac", flexShrink:0 }}>
                {h.delta>0?"+":""}{h.delta}
              </span>
            ))}
          </div>
        )}
      </button>
      {open && (
        <div className="hist-slide"
          style={{ marginTop:5, background:"rgba(0,0,0,0.32)", borderRadius:9,
            padding:"7px 10px", maxHeight:180, overflowY:"auto",
            display:"flex", flexDirection:"column", gap:4 }}>
          {[...last10].reverse().map((h,i) => {
            const prev = h.score - h.delta;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11 }}>
                <span style={{ color:"rgba(255,255,255,0.32)", flexShrink:0, minWidth:24 }}>R{h.round}</span>
                <span className="mono" style={{ color:"rgba(255,255,255,0.38)", fontSize:10 }}>{prev>0?"+":prev===0?"":""}{prev}</span>
                <span style={{ color:"rgba(255,255,255,0.28)", fontSize:10 }}>{h.delta>0?"＋":"－"}</span>
                <span className="mono" style={{ fontWeight:800, fontSize:10, color:h.delta<0?"#fca5a5":"#86efac" }}>{Math.abs(h.delta)}</span>
                <span style={{ color:"rgba(255,255,255,0.28)", fontSize:10 }}>＝</span>
                <span className="mono" style={{ fontWeight:800, fontSize:10, color }}>{h.score>0?"+":""}{h.score}</span>
                <span style={{ color:"rgba(255,255,255,0.24)", fontSize:10, marginLeft:"auto" }}>{h.time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SPINNER WHEEL
// ─────────────────────────────────────────────────────────
function SpinnerWheel({ players, onResult, acc, isMobile }) {
  const [spinning,setSpinning]=useState(false);
  const [angle,setAngle]=useState(0);
  const [winner,setWinner]=useState(null);
  const animRef=useRef(null),angleRef=useRef(0),velRef=useRef(0),lastTsRef=useRef(null),stopFlag=useRef(false),paramsRef=useRef(null);
  const rW=useCallback((a)=>{const n=players.length,sa=360/n,R=((a%360)+360)%360,pos=((360-R)%360);return players[Math.floor(((pos+90)%360)/sa)%n];},[players]);
  const finish=useCallback((a)=>{const w=rW(a);setWinner(w);setSpinning(false);stopFlag.current=false;onResult(w);},[rW,onResult]);
  const stopNow=useCallback(()=>{if(spinning)stopFlag.current=true;},[spinning]);
  const spin=useCallback(()=>{
    if(spinning||players.length<2)return;
    setWinner(null);setSpinning(true);stopFlag.current=false;lastTsRef.current=null;
    const pV=6+Math.random()*6,aC=400+Math.random()*300,cMs=3000+Math.random()*7000;
    paramsRef.current={pV,aC,cMs};
    velRef.current=0;const ex=Math.random()*360*(2+Math.random()*4);angleRef.current+=ex;setAngle(a=>a+ex);
    let el=0;
    const loop=(ts)=>{
      if(!lastTsRef.current){lastTsRef.current=ts;animRef.current=requestAnimationFrame(loop);return;}
      const dt=Math.min(ts-lastTsRef.current,50);lastTsRef.current=ts;el+=dt;
      const{pV,aC,cMs}=paramsRef.current;
      let v;
      if(stopFlag.current){velRef.current=Math.max(0,velRef.current-dt*0.012);v=velRef.current;}
      else if(el<aC){v=pV*(el/aC);}else if(el<cMs){v=pV;}
      else{const d=el-cMs,dd=2500+Math.random()*500;v=Math.max(0,pV*(1-d/dd));}
      velRef.current=v;angleRef.current+=v*dt;setAngle(angleRef.current);
      if(v<=0){finish(angleRef.current);return;}
      animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);
  },[spinning,players,finish]);
  useEffect(()=>()=>cancelAnimationFrame(animRef.current),[]);

  if(!players.length) return(
    <div style={{textAlign:"center",padding:"40px 20px",color:"#50556e"}}>
      <div style={{fontSize:48,marginBottom:8}}>🎡</div>
      <div style={{fontSize:14,fontWeight:700}}>Ajoutez des joueurs pour utiliser la roue</div>
    </div>
  );

  const W=isMobile?Math.min(window.innerWidth-48, 260):240;
  const CX=W/2,CY=W/2,R=W/2-6,SA=360/players.length;
  const nfs=players.length<=4?13:players.length<=7?10:8;
  const slices=players.map((p,i)=>{const a0=(i*SA-90)*Math.PI/180,a1=((i+1)*SA-90)*Math.PI/180,large=SA>180?1:0,mA=((i+0.5)*SA-90)*Math.PI/180,tr=R*.62;return{p,d:`M${CX},${CY} L${(CX+R*Math.cos(a0)).toFixed(2)},${(CY+R*Math.sin(a0)).toFixed(2)} A${R},${R} 0 ${large},1 ${(CX+R*Math.cos(a1)).toFixed(2)},${(CY+R*Math.sin(a1)).toFixed(2)}Z`,tx:CX+tr*Math.cos(mA),ty:CY+tr*Math.sin(mA),ta:(i+0.5)*SA};});
  const nc=acc||"#f59e0b";

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
      <div style={{position:"relative",width:W,height:W+20,flexShrink:0}}>
        <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"12px solid transparent",borderRight:"12px solid transparent",borderTop:`24px solid ${nc}`,zIndex:10,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.7))"}}/>
        <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} style={{marginTop:20,display:"block",filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.60))"}}>
          <circle cx={CX} cy={CY} r={R+4} fill="#111318" stroke="rgba(255,255,255,0.10)" strokeWidth="2"/>
          <g transform={`rotate(${angle} ${CX} ${CY})`}>
            {slices.map(({p,d,tx,ty,ta})=>(<g key={p.id}><path d={d} fill={p.color.hex} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5"/><path d={d} fill="rgba(255,255,255,0.06)"/><g transform={`rotate(${ta} ${tx} ${ty})`}><text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={nfs} fontWeight="800" fontFamily="Sora,sans-serif" fill="#fff" stroke="rgba(0,0,0,0.60)" strokeWidth="3.5" paintOrder="stroke fill" style={{userSelect:"none"}}>{p.name.length>9?p.name.slice(0,8)+"…":p.name}</text></g></g>))}
            {players.map((p,i)=>{const a=(i*SA-90)*Math.PI/180;return<line key={p.id} x1={CX} y1={CY} x2={(CX+R*Math.cos(a)).toFixed(2)} y2={(CY+R*Math.sin(a)).toFixed(2)} stroke="rgba(0,0,0,0.40)" strokeWidth="1.5"/>;  })}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
            <circle cx={CX} cy={CY} r="14" fill="#1a1d28" stroke="rgba(255,255,255,0.14)" strokeWidth="2"/>
            <circle cx={CX} cy={CY} r="8" fill={nc}/><circle cx={CX} cy={CY} r="3.5" fill="#111318"/>
          </g>
        </svg>
      </div>
      {winner&&!spinning&&(<div className="slide-up" style={{padding:"11px 28px",borderRadius:13,background:`linear-gradient(135deg,${winner.color.hex},${winner.color.hex}aa)`,color:"#fff",fontWeight:800,fontSize:17,textAlign:"center",boxShadow:`0 4px 22px ${winner.color.hex}55`}}>🎉 {winner.name} commence !</div>)}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={spin} disabled={spinning||players.length<2} aria-label="Lancer la roue"
          style={{padding:"13px 32px",borderRadius:13,border:"none",background:spinning?"#374151":`linear-gradient(135deg,${nc},#ef4444)`,color:"#fff",fontWeight:800,fontSize:15,cursor:spinning||players.length<2?"not-allowed":"pointer",opacity:players.length<2?0.5:1,minHeight:48}}>
          {spinning?"⏳ En cours…":"🎡 Lancer"}
        </button>
        <button onClick={stopNow} disabled={!spinning} aria-label="Stop"
          style={{padding:"13px 20px",borderRadius:13,border:"none",background:spinning?"#ef4444":"rgba(239,68,68,0.15)",color:spinning?"#fff":"#f87171",fontWeight:800,fontSize:15,cursor:spinning?"pointer":"default",opacity:spinning?1:0.45,transition:"all .2s",minHeight:48}}>
          ⏹ Stop
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SAND TIMER
// ─────────────────────────────────────────────────────────
function SandTimer({ D, dark }) {
  const PRESETS=[{label:"30 s",s:30},{label:"1 min",s:60},{label:"2 min",s:120},{label:"3 min",s:180}];
  const [dur,setDur]=useState(60);
  const [rem,setRem]=useState(60);
  const [status,setStatus]=useState("idle");
  const ivRef=useRef(null),endRef=useRef(null);
  const prog=rem/dur, ring=prog>0.5?"#4ade80":prog>0.25?"#fbbf24":"#ef4444";
  const CIRC=2*Math.PI*68;
  const tp=1-prog,tSY=11+36*tp,tL=(20+28*tp).toFixed(2),tR=(80-28*tp).toFixed(2);
  const bSY=89-36*tp,bL=(48-28*tp).toFixed(2),bR=(52+28*tp).toFixed(2);
  const tPoly=prog>0.004?`M ${tL},${tSY.toFixed(2)} L ${tR},${tSY.toFixed(2)} L 52,47 L 48,47 Z`:null;
  const bPoly=prog<0.996?`M ${bL},${bSY.toFixed(2)} L ${bR},${bSY.toFixed(2)} L 80,89 L 20,89 Z`:null;
  const sC=dark?"#fbbf24":"#d97706",gS=dark?"rgba(255,255,255,0.28)":"rgba(0,0,0,0.22)",gF=dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",pC=dark?"rgba(255,255,255,0.22)":"rgba(0,0,0,0.18)";
  const alarm=useCallback(()=>{try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[0,.38,.76].forEach(t=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;o.type="sine";g.gain.setValueAtTime(0.52,ctx.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.30);o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.31);});}catch{}},[]);
  const tick=useCallback(()=>{const r=Math.max(0,Math.round((endRef.current-Date.now())/1000));setRem(r);if(r<=0){clearInterval(ivRef.current);setStatus("done");alarm();}},[alarm]);
  const start=useCallback(()=>{const r=status==="done"?dur:rem;setRem(r);endRef.current=Date.now()+r*1000;setStatus("running");clearInterval(ivRef.current);ivRef.current=setInterval(tick,200);},[status,dur,rem,tick]);
  const pause=useCallback(()=>{clearInterval(ivRef.current);setStatus("paused");},[]);
  const reset=useCallback(()=>{clearInterval(ivRef.current);setRem(dur);setStatus("idle");},[dur]);
  const pick=useCallback((s)=>{clearInterval(ivRef.current);setDur(s);setRem(s);setStatus("idle");},[]);
  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const done=status==="done";
  useEffect(()=>()=>clearInterval(ivRef.current),[]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:"24px 20px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:22}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
          {PRESETS.map(p=>(<button key={p.s} onClick={()=>pick(p.s)} aria-pressed={dur===p.s}
            style={{padding:"10px 20px",borderRadius:11,border:`1.5px solid ${dur===p.s?ring:D.brd}`,background:dur===p.s?ring+"22":"transparent",color:dur===p.s?ring:D.sub,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all .15s",fontFamily:"'Sora',sans-serif",minHeight:44}}>
            {p.label}</button>))}
        </div>
        <div style={{position:"relative",width:220,height:220,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="220" height="220" viewBox="0 0 220 220" style={{position:"absolute",inset:0,transform:"rotate(-90deg)",pointerEvents:"none"}}>
            <circle cx="110" cy="110" r="68" fill="none" stroke={ring+"20"} strokeWidth="10"/>
            <circle cx="110" cy="110" r="68" fill="none" stroke={ring} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${CIRC*prog} ${CIRC*(1-prog)}`} style={{transition:"stroke-dasharray 0.28s ease,stroke 0.6s ease"}}/>
          </svg>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{filter:"drop-shadow(0 4px 14px rgba(0,0,0,0.35))",animation:done?"hourglassShake 0.55s ease 4":"none"}}>
              <rect x="16" y="5" width="68" height="6" rx="3" fill={pC}/><rect x="16" y="89" width="68" height="6" rx="3" fill={pC}/>
              <path d="M 20,11 L 80,11 L 52,47 L 48,47 Z" fill={gF} stroke={gS} strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M 48,53 L 52,53 L 80,89 L 20,89 Z" fill={gF} stroke={gS} strokeWidth="1.4" strokeLinejoin="round"/>
              {tPoly&&<path d={tPoly} fill={sC} opacity="0.90"/>}
              {tPoly&&prog>0.07&&<line x1={tL} y1={(tSY+.7).toFixed(2)} x2={tR} y2={(tSY+.7).toFixed(2)} stroke="rgba(255,255,255,0.50)" strokeWidth="1.2"/>}
              {status==="running"&&prog>0.018&&prog<0.982&&<ellipse cx="50" cy="49" rx="1.2" ry="1.8" fill={sC} style={{animation:"sandFall 0.36s linear infinite"}}/>}
              {bPoly&&<path d={bPoly} fill={sC} opacity="0.90"/>}
              {bPoly&&prog<0.93&&<line x1={bL} y1={(bSY+.7).toFixed(2)} x2={bR} y2={(bSY+.7).toFixed(2)} stroke="rgba(255,255,255,0.42)" strokeWidth="1.2"/>}
              {done&&<text x="50" y="73" textAnchor="middle" fontSize="20" fill={sC} style={{animation:"timerPulse 0.8s ease infinite"}}>✓</text>}
            </svg>
            <div className="mono" style={{fontSize:32,fontWeight:800,letterSpacing:-1,color:done?ring:D.txt,animation:done?"timerPulse 0.85s ease 4":"none",transition:"color .5s"}}>{fmt(rem)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
          {(status==="idle"||status==="paused"||status==="done")&&(
            <button onClick={start} style={{padding:"13px 34px",borderRadius:13,border:"none",background:ring,color:"#111",fontWeight:800,fontSize:15,cursor:"pointer",boxShadow:`0 4px 18px ${ring}55`,fontFamily:"'Sora',sans-serif",transition:"background .5s",minHeight:48}}>
              {status==="done"?"🔁 Rejouer":status==="paused"?"▶ Reprendre":"▶ Démarrer"}
            </button>
          )}
          {status==="running"&&<button onClick={pause} style={{padding:"13px 34px",borderRadius:13,border:"none",background:"rgba(100,116,139,0.22)",color:D.txt,fontWeight:800,fontSize:15,cursor:"pointer",minHeight:48}}>⏸ Pause</button>}
          {status!=="idle"&&<button onClick={reset} aria-label="Reset" style={{width:48,height:48,borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:22}}>↺</button>}
        </div>
        {done&&<div className="slide-up" style={{fontSize:16,fontWeight:800,color:ring,animation:"timerPulse 1s ease infinite"}}>⏰ Temps écoulé !</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MINI LEADERBOARD
// ─────────────────────────────────────────────────────────
function MiniLeaderboard({ sorted, topScore, targetScore, D, dark, isMobile }) {
  const min=Math.min(...sorted.map(p=>p.score));
  const range=topScore-min||1;
  return(
    <div style={{marginTop:16,background:D.card,border:`1px solid ${D.brd}`,borderRadius:14,padding:"14px 16px"}}>
      <div style={{fontSize:10,fontWeight:700,color:D.sub,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>
        📊 Classement{targetScore!=null?` · Objectif : ${targetScore} pts`:""}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {sorted.map((p,i)=>{
          const pct=targetScore!=null?Math.max(3,Math.min(100,(p.score/targetScore)*100)):Math.max(3,((p.score-min)/range)*100);
          return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:i<3?13:10,minWidth:16,textAlign:"center",flexShrink:0}}>{i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</span>
            <div style={{width:26,height:26,borderRadius:"50%",background:p.color.hex,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11,flexShrink:0}}>{p.name[0]}</div>
            {!isMobile&&<span style={{fontSize:13,fontWeight:600,minWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>}
            <div style={{flex:1,height:7,borderRadius:4,background:dark?"#ffffff06":"#00000006",overflow:"hidden"}}>
              <div style={{width:`${pct}%`,height:"100%",borderRadius:4,background:p.color.hex,transition:"width .5s ease"}}/>
            </div>
            <span className="mono" style={{fontSize:12,fontWeight:700,color:p.color.hex,minWidth:40,textAlign:"right",flexShrink:0}}>{p.score>0?"+":""}{p.score}</span>
          </div>);
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PLAYER ROW
// ─────────────────────────────────────────────────────────
function PlayerRow({
  player, rank, medal, isLeader, isExAequo, isSel, flashKey,
  dark, D, isPlaying, isMobile,
  onAdjust, onCommit, onRemove, onSelect, onColorChange,
  playerHistory, showGearHint, onGearFirstUse,
  tableMode, dragHandlers, rowRef, isDragging,
}) {
  const ROW_H  = isMobile ? 76 : 82;
  const GEAR_SZ= isMobile ? 78 : 88;
  const gearOverflow = (GEAR_SZ - ROW_H) / 2;

  const col = player.color.hex;
  const [showPalette, setPalette]   = useState(false);
  const [editScore,   setEditScore] = useState(false);
  const [editVal,     setEditVal]   = useState("");
  const [swipeFx,     setSwipeFx]   = useState(null);
  const editRef  = useRef(null);
  const swipeRef = useRef({ startX:0, startY:0, triggered:false });
  const swipedRef= useRef(false);

  const onTouchStart = (e) => {
    if(e.target.closest("[data-gear]")||e.target.closest("[data-pal]")||
       e.target.closest("[data-rm]") ||e.target.closest("[data-drag]")||
       e.target.closest("[data-sedit]")) return;
    const t=e.touches[0];
    swipeRef.current={startX:t.clientX,startY:t.clientY,triggered:false};
    swipedRef.current=false;
  };
  const onTouchMove = (e) => {
    if(swipeRef.current.triggered)return;
    const dx=e.touches[0].clientX-swipeRef.current.startX;
    const dy=e.touches[0].clientY-swipeRef.current.startY;
    if(Math.abs(dx)>38&&Math.abs(dx)>Math.abs(dy)*1.4){
      swipeRef.current.triggered=true;swipedRef.current=true;
      const pts=dx>0?1:-1;onAdjust(pts);
      setSwipeFx(pts>0?"＋1":"－1");
      setTimeout(()=>setSwipeFx(null),380);
    }
  };

  const openEdit=(e)=>{
    e.stopPropagation();
    setEditVal(String(player.score));setEditScore(true);
    setTimeout(()=>{editRef.current?.focus();editRef.current?.select();},30);
  };
  const commitEdit=()=>{
    const n=parseInt(editVal,10);
    if(!isNaN(n)&&n!==player.score) onAdjust(n-player.score);
    setEditScore(false);
  };

  const handleClick=(e)=>{
    if(swipedRef.current){swipedRef.current=false;return;}
    if(e.target.closest("[data-gear]")||e.target.closest("[data-rm]")||
       e.target.closest("[data-pal]")||e.target.closest("[data-drag]")||
       e.target.closest("[data-sedit]")) return;
    onSelect();
  };

  return(
    <div style={{position:"relative",paddingTop:gearOverflow,paddingBottom:gearOverflow,zIndex:isSel?10:1}} ref={rowRef}>
      <div className="p-row"
        onClick={handleClick}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove}
        role="button" aria-pressed={isSel}
        aria-label={`${player.name} — ${player.score} pts`}
        style={{position:"relative",height:ROW_H,borderRadius:14,background:col,cursor:"pointer",overflow:"visible",
          boxShadow:isSel?`inset 0 0 0 9999px rgba(0,0,0,0.08),0 0 0 2.5px ${col},0 0 0 4.5px rgba(255,255,255,0.18)`:isDragging?`inset 0 0 0 9999px rgba(0,0,0,0.06),0 12px 32px ${col}88`:`inset 0 0 0 9999px rgba(0,0,0,0.52),0 2px 7px ${col}25`,
          opacity:isDragging?.7:1,display:"flex",alignItems:"center",gap:isMobile?7:9,padding:`0 8px 0 ${isMobile?10:13}px`,
          transition:"opacity .12s,box-shadow .15s"}}>

        {/* Swipe feedback */}
        {swipeFx&&(
          <div className="swipe-flash" style={{position:"absolute",inset:0,borderRadius:14,zIndex:20,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",background:swipeFx.includes("＋")?"rgba(74,222,128,0.22)":"rgba(239,68,68,0.22)"}}>
            <span className="mono" style={{fontSize:26,fontWeight:900,color:swipeFx.includes("＋")?"#4ade80":"#f87171"}}>{swipeFx}</span>
          </div>
        )}

        {/* Drag handle */}
        {tableMode&&(
          <div data-drag className="drag-handle"
            onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dragHandlers?.onDown(e,player.id);}}
            onPointerMove={e=>dragHandlers?.onMove(e)}
            onPointerUp={dragHandlers?.onUp}
            onPointerCancel={dragHandlers?.onUp}
            style={{color:"rgba(255,255,255,0.45)",fontSize:20,flexShrink:0,minWidth:20}}>≡</div>
        )}

        {/* Rank */}
        <div style={{minWidth:24,height:24,borderRadius:7,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?13:10,fontWeight:800,color:"#fff",flexShrink:0}}>{medal}</div>

        {/* Avatar */}
        <div style={{position:"relative",flexShrink:0}} data-pal>
          <button onClick={e=>{e.stopPropagation();setPalette(v=>!v);}}
            aria-label={`Couleur de ${player.name}`}
            style={{width:isMobile?34:38,height:isMobile?34:38,borderRadius:"50%",background:"rgba(255,255,255,0.16)",backdropFilter:"blur(4px)",border:"2px solid rgba(255,255,255,0.30)",color:"#fff",fontWeight:800,fontSize:isLeader?16:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {isLeader?<span style={{display:"inline-block",animation:"crown 1.4s ease-in-out infinite"}}>👑</span>:player.name[0].toUpperCase()}
          </button>
          {showPalette&&(
            <div className="fade-in" data-pal
              style={{position:"absolute",top:44,left:0,zIndex:30,background:dark?"#1c1f2e":"#fff",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:5,width:136,boxShadow:"0 9px 28px rgba(0,0,0,.48)"}}
              onClick={e=>e.stopPropagation()}>
              {PALETTE.map(c=>(<button key={c.hex} className="cdot" onClick={()=>{onColorChange(c);setPalette(false);}} title={c.name} style={{background:c.hex,outline:player.color.hex===c.hex?`2px solid ${c.hex}`:"none",outlineOffset:player.color.hex===c.hex?2:0,transform:player.color.hex===c.hex?"scale(1.4)":"scale(1)"}}/>))}
            </div>
          )}
        </div>

        {/* Name + history */}
        <div style={{minWidth:0, flex:"0 1 auto", maxWidth: isMobile ? 90 : 130}}>
          <div style={{fontWeight:700,fontSize:isMobile?13:14,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{player.name}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.42)",marginTop:1}}>
            {isLeader?"👑 En tête":isExAequo?"= Ex-æquo":`#${rank+1}`}
          </div>
          <PlayerMiniHistory entries={playerHistory} color={col} isMobile={isMobile}/>
        </div>

        {/* Score — tap to edit */}
        <div data-sedit
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",height:"100%",cursor:"text",minWidth:0}}
          onPointerDown={e=>{e.stopPropagation();openEdit(e);}}
          title="Appuyer pour modifier">
          {editScore?(
            <input ref={editRef} className="score-input-edit" type="number"
              value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditScore(false);}}
              onBlur={commitEdit} onClick={e=>e.stopPropagation()}
              style={{fontSize:isMobile?30:34, width:isMobile?90:110}}
              aria-label={`Score de ${player.name}`}/>
          ):(
            <div key={flashKey} className="mono score-pop"
              style={{fontSize:isMobile?36:42,fontWeight:700,color:"#fff",letterSpacing:-1.5,lineHeight:1,
                textDecoration:"underline dotted rgba(255,255,255,0.22)",textUnderlineOffset:4}}>
              {player.score>0?"+":""}{player.score}
            </div>
          )}
        </div>

        {/* Gear */}
        <div data-gear style={{position:"absolute",right:isPlaying?(isMobile?6:10):(isMobile?28:36),top:"50%",transform:"translateY(-50%)",zIndex:5}}>
          <div className={showGearHint?"gear-hint-anim":""} style={{position:"relative"}}>
            <Gear onCommit={onCommit} size={GEAR_SZ} onFirstUse={onGearFirstUse} playerScore={player.score} playerColor={col}/>
            {showGearHint&&(
              <div style={{position:"absolute",top:-24,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.85)",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 7px",borderRadius:5,whiteSpace:"nowrap",pointerEvents:"none",border:"1px solid rgba(255,255,255,0.15)"}}>↺ tourner !</div>
            )}
          </div>
        </div>
        <div style={{width:GEAR_SZ+12,flexShrink:0}}/>

        {/* Remove */}
        {!isPlaying&&(
          <button data-rm onClick={e=>{e.stopPropagation();onRemove();}} className="rm-btn"
            aria-label={`Retirer ${player.name}`}
            style={{width:24,height:24,borderRadius:6,border:"none",flexShrink:0,background:"rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.40)",cursor:"pointer",fontSize:11,zIndex:6}}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────
export default function ScoreTracker() {
  const winW    = useWindowWidth();
  const isMobile= winW < 600;

  const [dark,setDark]=useState(()=>{try{const s=localStorage.getItem("sgt7dark");if(s!=null)return s==="true";}catch{}return window.matchMedia?.("(prefers-color-scheme: dark)").matches??true;});
  const [players,setPlayers]=useState([]);
  const [savedNames,setSaved]=useState(DEFAULT_NAMES);
  const [gameName,setGName]=useState("Nouvelle partie 🎲");
  const [editName,setEditName]=useState(false);
  const [round,setRound]=useState(1);
  const [history,setHist]=useState([]);
  const [selected,setSelected]=useState(null);
  const [sessionLog,setSessionLog]=useState([]);
  const [undo,setUndo]=useState([]);
  const [toast,setToast]=useState(null);
  const [tab,setTab]=useState("scores");
  const [gameState,setGameState]=useState("idle");
  const [gameWinner,setGameWinner]=useState(null);
  const [flashCt,setFlashCt]=useState({});
  const [showHist,setSH]=useState(false);
  const [showReset,setSR]=useState(false);
  const [confirmRm,setCR]=useState(null);
  const [targetScore,setTarget]=useState(null);
  const [showTarget,setShowTgt]=useState(false);
  const [targetInput,setTgtInput]=useState("");
  const [histFilter,setHistFilter]=useState("all");
  const [addBarOpen,setAddBarOpen]=useState(false);
  const [gearHintDone,setGearDone]=useState(()=>{try{return localStorage.getItem("sgt7gear")==="1";}catch{}return false;});
  const [tableMode,setTableMode]=useState(false);
  const [tableOrder,setTableOrder]=useState([]);
  const [dragging,setDragging]=useState(null);
  const [overflowOpen,setOverflowOpen]=useState(false); // mobile ⋯ menu
  const dragSnapRef=useRef(null);
  const rowRefs=useRef({});
  const [addQ,setAddQ]=useState("");
  const [addColor,setAddColor]=useState(PALETTE[0]);
  const [sugOpen,setSugOpen]=useState(false);
  const [sugs,setSugs]=useState([]);
  const [diceType,setDiceType]=useState(6);
  const [diceCount,setDiceCount]=useState(2);
  const [diceResult,setDiceResult]=useState(null);
  const [diceValues,setDiceValues]=useState([]);
  const [rolling,setRolling]=useState(false);
  const [diceHist,setDiceHist]=useState([]);
  const [wheelHist,setWheelHist]=useState([]);
  const toastRef=useRef(null);
  const addRef=useRef(null);
  const nameRef=useRef(null);
  const playersRef=useRef(players);
  useEffect(()=>{playersRef.current=players;},[players]);

  useEffect(()=>{try{localStorage.setItem("sgt7dark",String(dark));}catch{}},[dark]);

  useEffect(()=>{
    try{const s=JSON.parse(localStorage.getItem("sgt7")||"{}");
      if(s.players)setPlayers(s.players);if(s.gameName)setGName(s.gameName);if(s.round)setRound(s.round);
      if(s.history)setHist(s.history);if(s.diceHist)setDiceHist(s.diceHist);if(s.wheelHist)setWheelHist(s.wheelHist);
      if(s.gameState)setGameState(s.gameState);if(s.targetScore!=null)setTarget(s.targetScore);if(s.tableOrder)setTableOrder(s.tableOrder);
      const n=JSON.parse(localStorage.getItem("sgt7n")||"null");if(n)setSaved(n);
    }catch{}
  },[]);
  useEffect(()=>{try{localStorage.setItem("sgt7",JSON.stringify({players,gameName,round,history,diceHist,wheelHist,gameState,targetScore,tableOrder}));}catch{}},[players,gameName,round,history,diceHist,wheelHist,gameState,targetScore,tableOrder]);
  useEffect(()=>{setTableOrder(p=>{const k=p.filter(id=>players.find(x=>x.id===id));const a=players.filter(x=>!k.includes(x.id)).map(x=>x.id);return[...k,...a];});},[players.length]); // eslint-disable-line
  useEffect(()=>{if(players.length>0){const u=new Set(players.map(p=>p.color.hex));setAddColor(PALETTE.find(c=>!u.has(c.hex))||PALETTE[0]);}},[players.length]); // eslint-disable-line
  useEffect(()=>{setSessionLog([]);},[selected]);
  useEffect(()=>{
    if(targetScore===null||gameState!=="playing"||!players.length)return;
    const w=[...players].sort((a,b)=>b.score-a.score)[0];
    if(w.score>=targetScore){setGameWinner(w);setGameState("ended");flash(`🏆 ${w.name} atteint ${targetScore} pts !`,w.color.hex);}
  },[players,targetScore,gameState]); // eslint-disable-line

  const flash=useCallback((msg,bg)=>{clearTimeout(toastRef.current);setToast({msg,bg});toastRef.current=setTimeout(()=>setToast(null),2600);},[]);
  const saveUndo=useCallback((snap)=>setUndo(u=>[...u.slice(-29),snap]),[]);
  const doUndo=useCallback(()=>{if(!undo.length)return;setPlayers(undo[undo.length-1]);setUndo(u=>u.slice(0,-1));flash("Action annulée ↩");},[undo,flash]);

  const adjust=useCallback((id,delta)=>{
    if(!delta)return;
    if("vibrate"in navigator)navigator.vibrate(delta>0?22:[22,12,22]);
    const p=playersRef.current.find(x=>x.id===id);if(!p)return;
    const ns=p.score+delta,time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    saveUndo(playersRef.current);
    setPlayers(prev=>prev.map(x=>x.id===id?{...x,score:x.score+delta}:x));
    setHist(h=>[...h,{id,name:p.name,delta,score:ns,round,time}]);
    setFlashCt(f=>({...f,[id]:(f[id]||0)+1}));
  },[saveUndo,round]);

  const gearCommit=useCallback((id,delta)=>{
    if(!delta)return;
    if("vibrate"in navigator)navigator.vibrate(35);
    const p=playersRef.current.find(x=>x.id===id);if(!p)return;
    const ns=p.score+delta,time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    saveUndo(playersRef.current);
    setPlayers(prev=>prev.map(x=>x.id===id?{...x,score:x.score+delta}:x));
    setHist(h=>[...h,{id,name:p.name,delta,score:ns,round,time}]);
    setFlashCt(f=>({...f,[id]:(f[id]||0)+1}));
  },[saveUndo,round]);

  useEffect(()=>{
    const h=(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();doUndo();return;}
      if(e.key==="Escape"){if(overflowOpen){setOverflowOpen(false);return;}if(selected){setSelected(null);return;}}
      if(selected&&!e.target.matches("input,textarea,select")){
        if(e.key==="ArrowUp"){e.preventDefault();adjust(selected,1);}
        if(e.key==="ArrowDown"){e.preventDefault();adjust(selected,-1);}
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[doUndo,selected,adjust,overflowOpen]);

  const addPlayer=useCallback((name=addQ.trim())=>{
    if(!name)return;
    if(playersRef.current.find(p=>p.name.toLowerCase()===name.toLowerCase())){flash(`${name} est déjà là !`);return;}
    const p={id:uid(),name,color:addColor,score:0};
    saveUndo(playersRef.current);
    const next=[...playersRef.current,p];setPlayers(next);
    const u=new Set(next.map(pp=>pp.color.hex));setAddColor(PALETTE.find(c=>!u.has(c.hex))||PALETTE[0]);
    if(!savedNames.includes(name)){const nn=[...savedNames,name];setSaved(nn);try{localStorage.setItem("sgt7n",JSON.stringify(nn));}catch{}}
    setAddQ("");setSugOpen(false);flash(`${name} rejoint la partie !`,addColor.hex);
  },[addQ,addColor,saveUndo,savedNames,flash]);

  const removePlayer=useCallback((id)=>{saveUndo(playersRef.current);setPlayers(p=>p.filter(x=>x.id!==id));if(selected===id)setSelected(null);setCR(null);},[saveUndo,selected]);
  const changeColor=useCallback((id,color)=>setPlayers(p=>p.map(x=>x.id===id?{...x,color}:x)),[]);

  const onQ=(v)=>{setAddQ(v);if(!v.trim()){setSugs([]);setSugOpen(false);return;}const q=v.toLowerCase();const r=savedNames.filter(n=>n.toLowerCase().includes(q)&&!playersRef.current.find(p=>p.name.toLowerCase()===n.toLowerCase())).slice(0,8);setSugs(r);setSugOpen(r.length>0);};

  const doReset=useCallback(()=>{saveUndo(playersRef.current);setPlayers(p=>p.map(x=>({...x,score:0})));setHist([]);setRound(1);setSR(false);setGameState("idle");setGameWinner(null);flash("Scores remis à zéro 🔄");},[saveUndo,flash]);
  const startGame=()=>{if(players.length<2){flash("Il faut au moins 2 joueurs !");return;}setGameState("playing");setAddBarOpen(false);flash("La partie a commencé ! 🎮","#16a34a");};
  const endGame=useCallback(()=>{const s=[...playersRef.current].sort((a,b)=>b.score-a.score);setGameWinner(s[0]);setGameState("ended");},[]);

  const copyResume=useCallback(()=>{
    const lines=[...players].sort((a,b)=>b.score-a.score).map((p,i)=>`${i<3?["🥇","🥈","🥉"][i]:`#${i+1}`} ${p.name} : ${p.score>0?"+":""}${p.score} pts`);
    const txt=`${gameName}\nRound ${round} — ${new Date().toLocaleDateString("fr-FR")}\n\n${lines.join("\n")}`;
    navigator.clipboard?.writeText(txt).then(()=>flash("Résumé copié ! 📋")).catch(()=>flash("Échec copie"));
  },[players,gameName,round,flash]);

  const applyTarget=()=>{const n=parseInt(targetInput,10);if(!isNaN(n)&&n>0){setTarget(n);flash(`Objectif : ${n} pts 🎯`);}else{setTarget(null);flash("Objectif supprimé");}setShowTgt(false);setTgtInput("");};

  const exportCSV=()=>{
    const s=[...players].sort((a,b)=>b.score-a.score);let csv=`Partie,${gameName}\nDate,${new Date().toLocaleDateString("fr-FR")}\nRound,${round}\n\nRang,Joueur,Score\n`;
    s.forEach((p,i)=>{csv+=`${i+1},${p.name},${p.score}\n`;});csv+="\nHistorique\nRound,Joueur,Delta,Score,Heure\n";
    history.forEach(e=>{csv+=`${e.round},${e.name},${e.delta>0?"+":""}${e.delta},${e.score},${e.time}\n`;});
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);
    Object.assign(document.createElement("a"),{href:url,download:`${gameName.replace(/\s+/g,"_")}.csv`}).click();URL.revokeObjectURL(url);flash("CSV téléchargé ✓");
  };

  const rollDice=()=>{
    if(rolling)return;setRolling(true);setDiceResult(null);let n=0;
    if(diceType===100){const iv=setInterval(()=>{const t=Math.floor(Math.random()*10)*10,u=Math.ceil(Math.random()*10);setDiceValues([t,u]);n++;if(n>14){clearInterval(iv);const ft=Math.floor(Math.random()*10)*10,fu=Math.ceil(Math.random()*10);setDiceValues([ft,fu]);const tot=ft+fu;setDiceResult(tot);setRolling(false);const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});setDiceHist(h=>[{id:uid(),diceType:100,diceCount:1,values:[ft,fu],total:tot,time},...h].slice(0,50));}},80);return;}
    const iv=setInterval(()=>{setDiceValues(Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType)));n++;if(n>14){clearInterval(iv);const vals=Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType));setDiceValues(vals);const tot=vals.reduce((a,b)=>a+b,0);setDiceResult(tot);setRolling(false);const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});setDiceHist(h=>[{id:uid(),diceType,diceCount,values:vals,total:tot,time},...h].slice(0,50));}},80);
  };

  const handleWheel=(w)=>{const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});setWheelHist(h=>[{id:uid(),name:w.name,color:w.color.hex,time,date:new Date().toLocaleDateString("fr-FR")},...h].slice(0,10));};
  const dismissGear=useCallback(()=>{setGearDone(true);try{localStorage.setItem("sgt7gear","1");}catch{}},[]);

  // Drag reorder
  const startDrag=useCallback((e,id)=>{const bO=tableOrder.filter(xid=>players.find(p=>p.id===xid));const snap={};bO.forEach(bid=>{const el=rowRefs.current[bid];if(el){const r=el.getBoundingClientRect();snap[bid]=r.top+r.height/2;}});dragSnapRef.current={order:bO,midpoints:snap};setDragging({id,overIdx:bO.indexOf(id),baseOrder:bO});},[tableOrder,players]);
  const moveDrag=useCallback((e)=>{if(!dragging||!dragSnapRef.current)return;const y=e.clientY;const{order,midpoints}=dragSnapRef.current;let ni=0;for(let i=0;i<order.length;i++){if(midpoints[order[i]]!==undefined&&y>midpoints[order[i]])ni=i+1;}ni=Math.max(0,Math.min(ni,order.length-1));if(ni!==dragging.overIdx)setDragging(p=>p?{...p,overIdx:ni}:null);},[dragging]);
  const endDrag=useCallback(()=>{if(dragging){const arr=[...dragging.baseOrder];const f=arr.indexOf(dragging.id);arr.splice(f,1);arr.splice(Math.min(dragging.overIdx,arr.length),0,dragging.id);setTableOrder(arr);}setDragging(null);dragSnapRef.current=null;},[dragging]);

  // Derived
  const sorted   = [...players].sort((a,b)=>b.score-a.score);
  const topScore = sorted[0]?.score??0;
  const rankMap  = Object.fromEntries(sorted.map((p,i)=>[p.id,i]));
  const selPlayer= players.find(p=>p.id===selected);
  const isPlaying= gameState==="playing";
  const isEnded  = gameState==="ended";
  const leaders  = players.filter(p=>p.score===topScore&&topScore>0&&players.length>1);
  const isExAequo= leaders.length>1;

  const histByPlayer=useMemo(()=>{const m={};history.forEach(h=>{if(!m[h.id])m[h.id]=[];m[h.id].push(h);});return m;},[history]);
  const sessionTotal=sessionLog.reduce((a,b)=>a+b,0);
  const sessionStr=sessionLog.length?sessionLog.map(v=>(v>0?"+":"")+v).join(" ")+" = "+(sessionTotal>=0?"+":"")+sessionTotal:null;

  const curOrder=useMemo(()=>{
    if(dragging){const arr=[...dragging.baseOrder];const f=arr.indexOf(dragging.id);arr.splice(f,1);arr.splice(Math.min(dragging.overIdx,arr.length),0,dragging.id);return arr;}
    if(tableMode)return tableOrder.filter(id=>players.find(p=>p.id===id));
    return sorted.map(p=>p.id);
  },[dragging,tableMode,tableOrder,players,sorted]);

  const dragHandlers=tableMode?{onDown:startDrag,onMove:moveDrag,onUp:endDrag}:null;

  const D={
    bg:  dark?"#0b0d12":"#f0ece4",
    card:dark?"#14171f":"#ffffff",
    brd: dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.09)",
    txt: dark?"#e2e4f0":"#1a1a2a",
    sub: dark?"#50556e":"#9090a8",
    ibg: dark?"#0b0d12":"#faf6f0",
    hbg: dark?"rgba(11,13,18,0.97)":"rgba(240,236,228,0.97)",
    acc: dark?"#fcd34d":"#f59e0b",
  };

  // Overflow menu items for mobile header
  const overflowActions = [
    { icon:"↩",  label:"Annuler",         action:doUndo,         disabled:!undo.length },
    { icon:"📋", label:"Historique",       action:()=>{ setSH(true); setOverflowOpen(false); } },
    { icon:"📤", label:"Copier résumé",    action:()=>{ copyResume(); setOverflowOpen(false); }, disabled:!players.length },
    { icon:"CSV",label:"Exporter CSV",     action:()=>{ exportCSV(); setOverflowOpen(false); } },
    { icon:"🎯", label:"Score objectif",   action:()=>{ setTgtInput(targetScore!=null?String(targetScore):""); setShowTgt(true); setOverflowOpen(false); } },
    { icon:"🔄", label:"Remettre à zéro", action:()=>{ setSR(true); setOverflowOpen(false); } },
  ];

  const TABS = [
    { key:"scores", label:isMobile?"🏆":"🏆 Scores" },
    { key:"dice",   label:isMobile?"🎲":"🎲 Dés"    },
    { key:"wheel",  label:isMobile?"🎡":"🎡 Roue"   },
    { key:"timer",  label:isMobile?"⏳":"⏳ Sablier" },
  ];

  const hasAddBarVisible = tab==="scores";
  const bonusBarH  = selPlayer && tab==="scores" ? (isMobile ? 195 : 185) : 0;
  const addBarH    = hasAddBarVisible ? (isMobile ? 72 : 68) : 0;
  const bottomPad  = bonusBarH + addBarH + 16;

  return(
    <div style={{minHeight:"100dvh",background:D.bg,color:D.txt,fontFamily:"'Sora',sans-serif",transition:"background .3s",cursor:dragging?"grabbing":"auto"}}>
      <style>{GLOBAL_CSS}</style>

      {/* ══════════════ HEADER ══════════════ */}
      <header style={{position:"sticky",top:0,zIndex:40,background:D.hbg,backdropFilter:"blur(16px)",borderBottom:`1px solid ${D.brd}`}}>

        {/* === MOBILE HEADER === */}
        {isMobile ? (
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18,flexShrink:0}} aria-hidden>🎲</span>

            {/* Game name */}
            <div style={{flex:1,minWidth:0}}>
              {editName
                ?<input ref={nameRef} value={gameName} onChange={e=>setGName(e.target.value)} onBlur={()=>setEditName(false)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditName(false);}} autoFocus style={{background:"transparent",border:"none",borderBottom:`2px solid ${D.acc}`,fontWeight:800,fontSize:14,color:D.txt,width:"100%",paddingBottom:1}}/>
                :<div onClick={()=>setEditName(true)} role="button"
                  style={{fontWeight:800,fontSize:14,color:D.txt,cursor:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{gameName}</span>
                  <span style={{fontSize:10,color:D.sub,flexShrink:0}} aria-hidden>✏️</span>
                </div>
              }
              <div style={{fontSize:10,color:D.sub,marginTop:1,display:"flex",alignItems:"center",gap:5}}>
                {players.length} joueur{players.length!==1?"s":""} · R{round}
                {isPlaying&&<span style={{color:"#22c55e"}}>● En jeu</span>}
                {isEnded&&<span style={{color:D.acc}}>● Terminée</span>}
                {targetScore!=null&&<span style={{color:D.acc}}>🎯{targetScore}</span>}
              </div>
            </div>

            {/* Round controls */}
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <button onClick={()=>setRound(r=>Math.max(1,r-1))} aria-label="Round −"
                style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14,fontWeight:800}}>−</button>
              <span className="mono" style={{fontSize:11,color:D.sub,minWidth:20,textAlign:"center"}}>R{round}</span>
              <button onClick={()=>setRound(r=>r+1)} aria-label="Round +"
                style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14,fontWeight:800}}>+</button>
            </div>

            {/* Game state button */}
            {gameState==="idle"&&players.length>=2&&<button onClick={startGame} style={{padding:"7px 11px",borderRadius:9,border:"none",background:"#16a34a",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,minHeight:36}}>▶</button>}
            {isPlaying&&<button onClick={endGame} style={{padding:"7px 11px",borderRadius:9,border:"none",background:"#ef4444",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,minHeight:36}}>⏹</button>}
            {isEnded&&<button onClick={()=>{setGameState("idle");setGameWinner(null);}} style={{padding:"7px 11px",borderRadius:9,border:"none",background:D.acc,color:"#111",cursor:"pointer",fontWeight:800,fontSize:12,flexShrink:0,minHeight:36}}>🔁</button>}

            {/* Dark */}
            <button onClick={()=>setDark(!dark)} aria-label={dark?"Mode clair":"Mode sombre"}
              style={{width:36,height:36,borderRadius:9,border:`1px solid ${D.brd}`,background:"transparent",cursor:"pointer",fontSize:15,flexShrink:0}}>
              {dark?"☀️":"🌙"}
            </button>

            {/* ⋯ overflow */}
            <button onClick={()=>setOverflowOpen(o=>!o)} aria-label="Plus d'options" aria-expanded={overflowOpen}
              style={{width:36,height:36,borderRadius:9,border:`1px solid ${overflowOpen?D.acc:D.brd}`,background:overflowOpen?D.acc+"22":"transparent",color:overflowOpen?D.acc:D.sub,cursor:"pointer",fontSize:18,fontWeight:900,flexShrink:0}}>
              ⋯
            </button>
          </div>
        ) : (
          /* === DESKTOP HEADER === */
          <div style={{maxWidth:900,margin:"0 auto",padding:"9px 16px",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <span style={{fontSize:20,flexShrink:0}} aria-hidden>🎲</span>
            <div style={{flex:1,minWidth:0}}>
              {editName
                ?<input ref={nameRef} value={gameName} onChange={e=>setGName(e.target.value)} onBlur={()=>setEditName(false)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditName(false);}} autoFocus style={{background:"transparent",border:"none",borderBottom:`2px solid ${D.acc}`,fontWeight:800,fontSize:13,color:D.txt,width:"100%",paddingBottom:2}}/>
                :<div onClick={()=>setEditName(true)} role="button" style={{fontWeight:800,fontSize:13,color:D.txt,cursor:"text",display:"flex",alignItems:"center",gap:5}}>{gameName}<span style={{fontSize:10,color:D.sub}} aria-hidden>✏️</span></div>
              }
              <div style={{fontSize:10,color:D.sub,marginTop:1}}>
                {players.length} joueur{players.length!==1?"s":""} · Round {round}
                {isPlaying&&<span style={{color:"#22c55e",marginLeft:6}}>● En jeu</span>}
                {isEnded&&<span style={{color:D.acc,marginLeft:6}}>● Terminée</span>}
                {targetScore!=null&&<span style={{color:D.acc,marginLeft:6}}>🎯{targetScore}</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0}}>
              <button onClick={()=>setRound(r=>Math.max(1,r-1))} aria-label="Round −" className="hdr-btn" style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>−</button>
              <span className="mono" style={{fontSize:10,color:D.sub,minWidth:22,textAlign:"center"}}>R{round}</span>
              <button onClick={()=>setRound(r=>r+1)} aria-label="Round +" className="hdr-btn" style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>+</button>
            </div>
            <div style={{width:1,height:18,background:D.brd,flexShrink:0}}/>
            {[
              {label:"↩",  al:"Annuler (Ctrl+Z)",  fn:doUndo,        dis:!undo.length},
              {label:"📋", al:"Historique",         fn:()=>setSH(true)},
              {label:"📤", al:"Copier résumé",      fn:copyResume,    dis:!players.length},
              {label:"CSV",al:"Exporter CSV",        fn:exportCSV},
              {label:"🎯", al:"Score objectif",     fn:()=>{setTgtInput(targetScore!=null?String(targetScore):"");setShowTgt(true);}},
              {label:"🔄", al:"Remettre à zéro",   fn:()=>setSR(true)},
            ].map(({label,al,fn,dis})=>(
              <button key={label} onClick={fn} disabled={dis} aria-label={al} className="hdr-btn"
                style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:dis?D.sub+"44":D.sub,cursor:dis?"default":"pointer",fontSize:11,fontWeight:700,minHeight:32}}>
                {label}
              </button>
            ))}
            <div style={{width:1,height:18,background:D.brd,flexShrink:0}}/>
            {gameState==="idle"&&players.length>=2&&<button onClick={startGame} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>▶ Débuter</button>}
            {isPlaying&&<button onClick={endGame} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#ef4444",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>⏹ Terminer</button>}
            {isEnded&&<button onClick={()=>{setGameState("idle");setGameWinner(null);}} style={{padding:"5px 12px",borderRadius:8,border:"none",background:D.acc,color:"#111",cursor:"pointer",fontWeight:700,fontSize:11}}>🔁 Nouvelle</button>}
            <button onClick={()=>setDark(!dark)} aria-label={dark?"Mode clair":"Mode sombre"} style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",cursor:"pointer",fontSize:14,flexShrink:0}}>{dark?"☀️":"🌙"}</button>
          </div>
        )}

        {/* Tabs — scrollable */}
        <div style={{maxWidth:900,margin:"0 auto",padding:`0 ${isMobile?8:16}px`}}>
          <div className="tabs-scroll">
            {TABS.map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)}
                aria-selected={tab===t.key} role="tab"
                style={{padding:isMobile?"8px 16px":"7px 16px",border:"none",borderRadius:"10px 10px 0 0",
                  background:tab===t.key?D.card:"transparent",color:tab===t.key?D.txt:D.sub,
                  fontWeight:tab===t.key?800:600,fontSize:isMobile?13:11,cursor:"pointer",
                  borderBottom:tab===t.key?`2px solid ${D.acc}`:"2px solid transparent",minHeight:38}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ MOBILE OVERFLOW MENU ══ */}
      {overflowOpen && isMobile && (
        <BottomSheet onClose={()=>setOverflowOpen(false)} D={D} isMobile title="Actions">
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {overflowActions.map(({icon,label,action,disabled})=>(
              <button key={label} className="overflow-menu-item" onClick={action} disabled={disabled}
                style={{color:disabled?D.sub+"55":D.txt,borderRadius:10,opacity:disabled?.5:1}}>
                <span style={{fontSize:18,minWidth:28}}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Winner banner */}
      {isEnded&&gameWinner&&(
        <div className="slide-up" role="status"
          style={{background:`linear-gradient(135deg,${gameWinner.color.hex},${gameWinner.color.hex}99)`,padding:"18px 20px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:4}}>🏆</div>
          <div style={{fontWeight:800,fontSize:isMobile?18:20,color:"#fff",marginBottom:3}}>{gameWinner.name} remporte la partie !</div>
          <div className="mono" style={{fontSize:isMobile?22:26,color:"rgba(255,255,255,0.88)"}}>{gameWinner.score>0?"+":""}{gameWinner.score} pts</div>
        </div>
      )}

      {/* ══════════════ MAIN ══════════════ */}
      <main style={{maxWidth:900,margin:"0 auto",padding:`12px ${isMobile?8:12}px ${bottomPad}px`,overflow:"visible"}}>

        {/* ═══ SCORES ═══ */}
        {tab==="scores"&&(
          <div style={{overflow:"visible"}}>
            {!players.length&&(
              <div style={{textAlign:"center",padding:isMobile?"50px 16px 20px":"70px 20px 28px",color:D.sub}}>
                <div style={{fontSize:60,opacity:.6,lineHeight:1,marginBottom:12}}>🎯</div>
                <div style={{fontSize:isMobile?17:19,fontWeight:800,color:D.txt,marginBottom:8}}>Prêt pour la partie ?</div>
                <div style={{fontSize:13,lineHeight:2,color:D.sub}}>
                  Ajoutez des joueurs ci-dessous.<br/>
                  <strong style={{color:D.txt}}>Glissez</strong> gauche/droite → <strong style={{color:D.txt}}>±1 pt</strong><br/>
                  <strong style={{color:D.txt}}>Tournez la molette</strong> → grands ajustements<br/>
                  <strong style={{color:D.txt}}>Tapez le score</strong> → saisie directe<br/>
                  <strong style={{color:D.txt}}>Tapez la row</strong> → cartes bonus
                </div>
              </div>
            )}

            {players.length>1&&(
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                <button onClick={()=>setTableMode(m=>!m)} aria-pressed={tableMode}
                  style={{padding:"6px 13px",borderRadius:8,border:`1px solid ${tableMode?D.acc:D.brd}`,background:tableMode?D.acc+"22":"transparent",color:tableMode?D.acc:D.sub,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s",minHeight:36}}>
                  {tableMode?"📍 Ordre table":"🏆 Classement"}
                </button>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:isMobile?10:14,overflow:"visible"}}>
              {curOrder.map(id=>{
                const player=players.find(p=>p.id===id);if(!player)return null;
                const rank=rankMap[player.id]??0;
                const isL=player.score===topScore&&topScore>0&&players.length>1&&!isExAequo;
                const isEQ=isExAequo&&player.score===topScore&&players.length>1;
                return(
                  <PlayerRow key={player.id} player={player} rank={rank}
                    medal={rank<3?MEDALS[rank]:`${rank+1}`}
                    isLeader={isL} isExAequo={isEQ}
                    isSel={selected===player.id}
                    flashKey={flashCt[player.id]||0}
                    dark={dark} D={D} isPlaying={isPlaying} isMobile={isMobile}
                    onAdjust={pts=>adjust(player.id,pts)}
                    onCommit={delta=>gearCommit(player.id,delta)}
                    onRemove={()=>setCR(player.id)}
                    onSelect={()=>setSelected(selected===player.id?null:player.id)}
                    onColorChange={c=>changeColor(player.id,c)}
                    playerHistory={histByPlayer[player.id]||[]}
                    showGearHint={!gearHintDone&&rank===0&&players.length>0}
                    onGearFirstUse={dismissGear}
                    tableMode={tableMode} dragHandlers={dragHandlers}
                    isDragging={dragging?.id===player.id}
                    rowRef={el=>{rowRefs.current[player.id]=el;}}
                  />
                );
              })}
            </div>

            {players.length>1&&<MiniLeaderboard sorted={sorted} topScore={topScore} targetScore={targetScore} D={D} dark={dark} isMobile={isMobile}/>}
          </div>
        )}

        {/* ═══ DÉS ═══ */}
        {tab==="dice"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?14:16}}>
              <div style={{fontSize:11,fontWeight:700,color:D.sub,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Type de dé</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {DICE_TYPES.map(d=>(<button key={d} className="die-sel-btn" onClick={()=>setDiceType(d)} aria-pressed={diceType===d}
                  style={{background:diceType===d?D.acc:dark?"#1a1d27":"#eee",color:diceType===d?dark?"#111":"#fff":D.txt,padding:isMobile?"10px 14px":"10px 14px",fontSize:isMobile?13:14,minHeight:44}}>D{d}</button>))}
              </div>
            </div>
            {diceType!==100&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?14:16,display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>Nombre de dés</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:"auto"}}>
                  <button onClick={()=>setDiceCount(c=>Math.max(1,c-1))} aria-label="Moins" style={{width:44,height:44,borderRadius:10,border:"none",background:"rgba(239,68,68,0.14)",color:"#f87171",cursor:"pointer",fontWeight:900,fontSize:20}}>−</button>
                  <span className="mono" style={{fontSize:26,fontWeight:800,color:D.txt,minWidth:32,textAlign:"center"}}>{diceCount}</span>
                  <button onClick={()=>setDiceCount(c=>Math.min(10,c+1))} aria-label="Plus" style={{width:44,height:44,borderRadius:10,border:"none",background:"rgba(34,197,94,0.14)",color:"#4ade80",cursor:"pointer",fontWeight:900,fontSize:20}}>+</button>
                </div>
              </div>
            )}
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?18:22,textAlign:"center"}}>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",minHeight:80,alignItems:"center",marginBottom:16}}>
                {!diceValues.length?<div style={{color:D.sub,fontSize:14}}>Lancez les dés !</div>
                  :diceType===100&&diceValues.length>=2?(<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={10} value={diceValues[0]} size={isMobile?72:86} color="#6366f1" rolling={rolling} percentile/></div>
                    <div style={{fontSize:20,fontWeight:900,color:"rgba(255,255,255,0.5)"}}>+</div>
                    <div className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={10} value={diceValues[1]} size={isMobile?72:86} color="#7c3aed" rolling={rolling}/></div>
                  </div>)
                  :diceValues.map((val,i)=>(<div key={i} className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={diceType} value={val} size={isMobile?72:86} color="#6366f1" rolling={rolling}/></div>))
                }
              </div>
              {diceResult!=null&&!rolling&&(
                <div className="slide-up" style={{marginBottom:14}}>
                  <div style={{fontSize:12,color:D.sub,marginBottom:2}}>{diceType===100?"D100":`${diceCount}×D${diceType}`}</div>
                  <div className="mono" aria-live="polite" style={{fontSize:isMobile?38:46,fontWeight:800,color:D.acc}}>{diceResult}</div>
                  {diceCount>1&&diceType!==100&&<div style={{fontSize:11,color:D.sub}}>[{diceValues.join(" + ")}]</div>}
                </div>
              )}
              <button onClick={rollDice} disabled={rolling}
                style={{padding:"14px 36px",borderRadius:13,border:"none",background:rolling?"#6b7280":`linear-gradient(135deg,${D.acc},#ef4444)`,color:dark?"#111":"#fff",fontWeight:800,fontSize:15,cursor:rolling?"not-allowed":"pointer",minHeight:50}}>
                {rolling?"🎲 En cours…":`🎲 Lancer ${diceType===100?"D100":(diceCount>1?`${diceCount}×D${diceType}`:`D${diceType}`)}`}
              </button>
            </div>
            {diceHist.length>0&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?14:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>📋 Historique</div>
                  <button onClick={()=>setDiceHist([])} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11,minHeight:32}}>Effacer</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
                  {diceHist.map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:9,background:dark?"#ffffff03":"#00000003"}}>
                    <span style={{flex:1,fontSize:12,color:D.sub}}>{e.diceType===100?`D100 → [${e.values[0]===0?"00":e.values[0]}+${e.values[1]===10?0:e.values[1]}]`:`${e.diceCount}×D${e.diceType} → [${e.values.join(",")}]`}</span>
                    <span className="mono" style={{fontSize:15,fontWeight:800,color:D.acc}}>{e.total}</span>
                    <span style={{fontSize:10,color:D.sub,flexShrink:0}}>{e.time}</span>
                  </div>))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ ROUE ═══ */}
        {tab==="wheel"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?18:22,display:"flex",flexDirection:"column",alignItems:"center"}}>
              <SpinnerWheel players={players} onResult={handleWheel} acc={D.acc} isMobile={isMobile}/>
            </div>
            {wheelHist.length>0&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?14:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>🏁 Historique roue</div>
                  <button onClick={()=>setWheelHist([])} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11,minHeight:32}}>Effacer</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {wheelHist.map((e,i)=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:11,background:i===0?`rgba(245,158,11,0.07)`:dark?"#ffffff02":"#00000002",border:i===0?`1px solid ${D.acc}30`:"1px solid transparent"}}>
                    <span style={{fontSize:i===0?16:12,flexShrink:0}}>{i===0?"🥇":"⚫"}</span>
                    <div style={{width:30,height:30,borderRadius:"50%",background:e.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0}}>{e.name[0]}</div>
                    <span style={{flex:1,fontWeight:700,fontSize:14,color:e.color}}>{e.name}</span>
                    <span style={{fontSize:10,color:D.sub}}>{e.date} · {e.time}</span>
                  </div>))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SABLIER ═══ */}
        {tab==="timer"&&<SandTimer D={D} dark={dark}/>}
      </main>

      {/* ══════════════ BARRE AJOUT ══════════════ */}
      {tab==="scores"&&(
        <div style={{position:"fixed",bottom:bonusBarH,left:0,right:0,zIndex:25,background:D.hbg,backdropFilter:"blur(16px)",borderTop:`1px solid ${D.brd}`}}>
          <div style={{maxWidth:900,margin:"0 auto"}}>
            {isPlaying&&!addBarOpen?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"9px 14px":"8px 16px",gap:8}}>
                <span style={{fontSize:11,fontWeight:600,color:D.sub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {isMobile?"👈👉 Swipe · ↺ Molette · Tap score":"👈👉 Swipe ±1 · ↺ Molette · Tap score = saisie directe"}
                </span>
                <button onClick={()=>setAddBarOpen(true)} aria-label="Ajouter un joueur"
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:9,border:`1px solid ${D.brd}`,background:D.acc+"22",color:D.acc,cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0,minHeight:38}}>
                  ➕ Joueur
                </button>
              </div>
            ):(
              <div style={{padding:isMobile?"10px 12px 12px":"10px 14px 14px"}}>
                {isPlaying&&<button onClick={()=>setAddBarOpen(false)} aria-label="Replier" style={{float:"right",background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:14,padding:4}}>✕</button>}
                <div style={{fontSize:10,fontWeight:700,color:D.sub,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>➕ Ajouter un joueur</div>
                <div style={{position:"relative"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:addColor.hex,flexShrink:0,border:"2px solid rgba(255,255,255,0.22)"}} aria-hidden/>
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:isMobile?"11px 14px":"9px 12px",borderRadius:12,border:`1px solid ${D.brd}`,background:D.ibg,minHeight:48}}>
                      <input ref={addRef} value={addQ} onChange={e=>onQ(e.target.value)}
                        onFocus={()=>addQ&&setSugOpen(sugs.length>0)}
                        onBlur={()=>setTimeout(()=>setSugOpen(false),160)}
                        onKeyDown={e=>{if(e.key==="Enter"){sugs[0]?addPlayer(sugs[0]):addPlayer();}if(e.key==="Escape"){setAddQ("");setSugOpen(false);}}}
                        placeholder="Nom du joueur…" aria-label="Nom du joueur" autoComplete="off"
                        style={{flex:1,background:"transparent",border:"none",color:D.txt,fontSize:isMobile?15:13}}/>
                      {addQ&&<button onClick={()=>{setAddQ("");setSugOpen(false);}} aria-label="Effacer" style={{background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:18,lineHeight:1,padding:2,minHeight:32,minWidth:32}}>×</button>}
                    </div>
                    <button onClick={()=>addPlayer()} disabled={!addQ.trim()} aria-label="Ajouter"
                      style={{padding:isMobile?"11px 18px":"9px 16px",borderRadius:10,border:"none",flexShrink:0,fontWeight:700,fontSize:isMobile?14:13,cursor:addQ.trim()?"pointer":"default",background:addQ.trim()?D.acc:dark?"#2a2d3a":"#dddad4",color:addQ.trim()?(dark?"#111":"#fff"):D.sub,minHeight:48}}>
                      Ajouter
                    </button>
                  </div>
                  {sugOpen&&sugs.length>0&&(
                    <div className="fade-in" role="listbox"
                      style={{position:"absolute",bottom:"calc(100% + 5px)",left:0,right:0,zIndex:35,background:dark?"#1c1f2e":"#fff",border:`1px solid ${D.brd}`,borderRadius:13,overflow:"hidden",boxShadow:"0 -6px 24px rgba(0,0,0,.28)"}}>
                      {sugs.map((n,i)=>(<button key={i} className="sug-row" role="option" onMouseDown={()=>addPlayer(n)} style={{color:D.txt}}>
                        <span style={{width:26,height:26,borderRadius:"50%",background:addColor.hex+"28",color:addColor.hex,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,flexShrink:0}}>{n[0]}</span>
                        {n}
                      </button>))}
                      {addQ&&!sugs.find(s=>s.toLowerCase()===addQ.toLowerCase())&&(
                        <button className="sug-row" role="option" onMouseDown={()=>addPlayer()} style={{color:D.acc,fontWeight:700,borderTop:sugs.length?`1px solid ${D.brd}`:"none"}}><span>✚</span> Ajouter « {addQ} »</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ BONUS BAR ══════════════ */}
      {selPlayer&&tab==="scores"&&(
        <div className="slide-up safe-bottom"
          style={{position:"fixed",bottom:0,left:0,right:0,zIndex:24,
            background:dark?"rgba(9,11,17,0.98)":"rgba(238,234,226,0.98)",
            backdropFilter:"blur(18px)",borderTop:`1px solid ${D.brd}`,
            padding:isMobile?"7px 10px 10px":"8px 12px 12px"}}>
          <div style={{maxWidth:900,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:selPlayer.color.hex,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:12,boxShadow:`0 0 10px ${selPlayer.color.hex}66`,flexShrink:0}}>{selPlayer.name[0]}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:selPlayer.color.hex,lineHeight:1.2}}>{selPlayer.name}</div>
                  <div style={{fontSize:10,color:D.sub}}>Score : <span className="mono" style={{fontWeight:700,color:D.txt}}>{selPlayer.score>=0?"+":""}{selPlayer.score}</span></div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {sessionStr&&(
                  <>
                    {!isMobile&&<div style={{fontSize:10,fontWeight:700,color:D.sub}}>Ce tour :</div>}
                    <div style={{fontSize:11,fontWeight:700,color:sessionTotal>=0?"#4ade80":"#f87171",fontFamily:"monospace",background:sessionTotal>=0?"rgba(34,197,94,0.10)":"rgba(239,68,68,0.10)",border:`1px solid ${sessionTotal>=0?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}`,borderRadius:7,padding:"3px 7px",lineHeight:1.3,maxWidth:isMobile?120:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sessionStr}</div>
                    <button onClick={()=>setSessionLog([])} aria-label="Effacer récap" style={{width:26,height:26,borderRadius:6,border:"none",background:"rgba(239,68,68,0.15)",color:"#f87171",cursor:"pointer",fontSize:13,fontWeight:800,flexShrink:0}}>✕</button>
                  </>
                )}
                <button onClick={()=>{setSelected(null);setSessionLog([]);}} aria-label="Fermer bonus"
                  style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
            </div>
            {/* Bonus grid — compact on mobile */}
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?38:44}px,1fr))`,gap:isMobile?5:6}}>
              {BONUS_CARDS.map(b=>{
                const neg=b<0,col=neg?"#f87171":"#4ade80",bg=neg?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)",brd=neg?"rgba(239,68,68,0.28)":"rgba(34,197,94,0.28)";
                return(
                  <button key={b} className="bonus-card"
                    aria-label={`${b>0?"+":""}${b} pts`}
                    onClick={()=>{adjust(selPlayer.id,b);setSessionLog(p=>[...p,b]);}}
                    style={{padding:isMobile?"8px 2px":"9px 2px",border:`1.5px solid ${brd}`,background:bg,color:col,fontWeight:800,fontSize:isMobile?12:13,minHeight:isMobile?36:38}}>
                    {b>0?"+":""}{b}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODALS (bottom sheets on mobile) ══════════════ */}

      {/* Historique */}
      {showHist&&(
        <BottomSheet onClose={()=>setSH(false)} D={D} isMobile={isMobile} title="📋 Historique">
          {players.length>0&&(
            <select value={histFilter} onChange={e=>setHistFilter(e.target.value)} aria-label="Filtrer par joueur"
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${D.brd}`,background:D.ibg,color:D.txt,fontSize:14,fontFamily:"'Sora',sans-serif",cursor:"pointer",marginBottom:10,minHeight:44}}>
              <option value="all">Tous les joueurs</option>
              {players.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {!history.length?<p style={{textAlign:"center",padding:"28px 0",color:D.sub,fontSize:13}}>Aucune action</p>
              :[...history].reverse().filter(e=>histFilter==="all"||e.id===histFilter).map((e,i)=>{
                const p=players.find(pp=>pp.id===e.id),isNeg=e.delta<0,prev=e.score-e.delta;
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:10,background:isNeg?(dark?"rgba(239,68,68,0.12)":"rgba(239,68,68,0.06)"):(dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)")}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:p?.color.hex||"#888",flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:13,minWidth:45,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                  <span className="mono" style={{fontSize:11,color:"rgba(128,128,128,0.6)"}}>{prev>0?"+":""}{prev}</span>
                  <span style={{fontSize:10,color:"rgba(128,128,128,0.4)"}}>{e.delta>0?"＋":"－"}</span>
                  <span className="mono" style={{fontSize:12,fontWeight:800,color:isNeg?"#f87171":"#4ade80"}}>{Math.abs(e.delta)}</span>
                  <span style={{fontSize:10,color:"rgba(128,128,128,0.4)"}}>＝</span>
                  <span className="mono" style={{fontSize:13,fontWeight:800,color:p?.color.hex||D.txt}}>{e.score>0?"+":""}{e.score}</span>
                  <span style={{fontSize:10,color:D.sub,flexShrink:0,marginLeft:"auto"}}>R{e.round}</span>
                </div>);
              })
            }
          </div>
        </BottomSheet>
      )}

      {/* Reset */}
      {showReset&&(
        <BottomSheet onClose={()=>setSR(false)} D={D} isMobile={isMobile} title="🔄 Remettre à zéro ?" maxW={320}>
          <p style={{fontSize:13,color:D.sub,lineHeight:1.7,marginBottom:20}}>Tous les scores reviennent à 0 et l'historique est effacé. Les joueurs restent.</p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setSR(false)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            <button onClick={doReset} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Réinitialiser</button>
          </div>
        </BottomSheet>
      )}

      {/* Confirm remove */}
      {confirmRm&&(()=>{const p=players.find(x=>x.id===confirmRm);return p?(
        <BottomSheet onClose={()=>setCR(null)} D={D} isMobile={isMobile} title={`Retirer ${p.name} ?`} maxW={300}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:p.color.hex,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:22}}>{p.name[0]}</div>
            <p style={{fontSize:13,color:D.sub,lineHeight:1.6}}>Annulable via ↩ ou Ctrl+Z après.</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setCR(null)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            <button onClick={()=>removePlayer(confirmRm)} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Retirer</button>
          </div>
        </BottomSheet>
      ):null;})()}

      {/* Score objectif */}
      {showTarget&&(
        <BottomSheet onClose={()=>setShowTgt(false)} D={D} isMobile={isMobile} title="🎯 Score objectif" maxW={340}>
          <p style={{fontSize:13,color:D.sub,lineHeight:1.7,marginBottom:14}}>La partie se termine automatiquement quand un joueur atteint ce score. Laissez vide pour désactiver.</p>
          <input type="number" value={targetInput} onChange={e=>setTgtInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")applyTarget();}} placeholder="ex: 100"
            aria-label="Score objectif" autoFocus
            style={{width:"100%",padding:"14px",borderRadius:11,border:`1px solid ${D.brd}`,background:D.ibg,color:D.txt,fontSize:22,textAlign:"center",fontFamily:"Space Mono,monospace",marginBottom:14,minHeight:56}}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowTgt(false)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            {targetScore!=null&&<button onClick={()=>{setTarget(null);setShowTgt(false);flash("Objectif supprimé");}} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"rgba(239,68,68,0.18)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Supprimer</button>}
            <button onClick={applyTarget} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:D.acc,color:dark?"#111":"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Valider</button>
          </div>
        </BottomSheet>
      )}

      {/* Toast */}
      {toast&&(
        <div className="slide-up" role="status" aria-live="polite"
          style={{position:"fixed",bottom:bonusBarH+addBarH+12,left:"50%",transform:"translateX(-50%)",zIndex:60,padding:"11px 22px",borderRadius:12,background:toast.bg||(dark?"#252938":"#e8e4dc"),color:dark?"#fff":"#111",fontWeight:700,fontSize:13,boxShadow:"0 5px 20px rgba(0,0,0,.38)",whiteSpace:"nowrap",maxWidth:"90vw",overflow:"hidden",textOverflow:"ellipsis"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
