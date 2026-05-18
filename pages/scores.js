/**
 * ScoreTracker — scores.js
 *
 * Dépendances npm à installer :
 *   npm install @supabase/supabase-js
 *
 * Variables d'environnement (.env.local) :
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *
 * SQL à exécuter dans Supabase (SQL Editor) :
 * ─────────────────────────────────────────────
 * create table if not exists sgt_games (
 *   id text primary key,
 *   name text not null default 'Partie',
 *   state text not null default 'idle',
 *   round int not null default 1,
 *   target_score int,
 *   lowest_wins boolean not null default false,
 *   preset_id text,
 *   created_at timestamptz not null default now()
 * );
 * create table if not exists sgt_players (
 *   id text primary key,
 *   game_id text not null references sgt_games(id) on delete cascade,
 *   name text not null,
 *   color_hex text not null default '#ff1744',
 *   color_name text,
 *   score int not null default 0,
 *   position int not null default 0
 * );
 * create table if not exists sgt_events (
 *   id text primary key,
 *   game_id text not null references sgt_games(id) on delete cascade,
 *   player_id text not null,
 *   player_name text,
 *   delta int not null,
 *   score int not null,
 *   round int not null default 1,
 *   time text,
 *   created_at timestamptz not null default now()
 * );
 * alter table sgt_games enable row level security;
 * alter table sgt_players enable row level security;
 * alter table sgt_events enable row level security;
 * create policy "public_all" on sgt_games for all using (true) with check (true);
 * create policy "public_all" on sgt_players for all using (true) with check (true);
 * create policy "public_all" on sgt_events for all using (true) with check (true);
 * alter publication supabase_realtime add table sgt_events;
 * alter publication supabase_realtime add table sgt_players;
 * alter publication supabase_realtime add table sgt_games;
 * ─────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────
//  SUPABASE CLIENT (graceful degradation)
// ─────────────────────────────────────────────────────────
const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

// ─────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────
const PALETTE = [
  { hex:"#ff1744", name:"Écarlate"   },
  { hex:"#2979ff", name:"Électrique" },
  { hex:"#00e676", name:"Néon vert"  },
  { hex:"#ffab00", name:"Soleil"     },
  { hex:"#d500f9", name:"Plasma"     },
  { hex:"#ff6d00", name:"Feu"        },
  { hex:"#00e5ff", name:"Laser"      },
  { hex:"#f50057", name:"Fuchsia"    },
  { hex:"#69f0ae", name:"Menthe"     },
  { hex:"#e040fb", name:"Orchidée"   },
];

const DEFAULT_NAMES = [
  "Alice","Bob","Charlie","Diana","Éva","François","Gabrielle",
  "Hugo","Isabelle","Julien","Louis","Marie","Nicolas","Olivia",
  "Pierre","Sophie","Thomas","Yann","Zoé","Raphaël","Camille",
];

const BONUS_CARDS = [-10,-5,-3,-1,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
const MEDALS      = ["🥇","🥈","🥉"];
const DICE_TYPES  = [4,6,8,10,12,20,100];
const MAX_HIST    = 500;
const uid         = () => Math.random().toString(36).slice(2,9);

const GAME_PRESETS = [
  { id:"skyjo",        name:"Skyjo",           emoji:"🃏", targetScore:100,  lowestWins:true,  maxRounds:null, desc:"1er à 100 pts perd — plus bas = meilleur"   },
  { id:"catan",        name:"Catan",           emoji:"🏝️", targetScore:10,   lowestWins:false, maxRounds:null, desc:"Premier à 10 pts de victoire gagne"          },
  { id:"uno",          name:"Uno",             emoji:"🎴", targetScore:500,  lowestWins:false, maxRounds:null, desc:"1er à 500 pts de penalité perd"               },
  { id:"carcassonne",  name:"Carcassonne",     emoji:"🏰", targetScore:null, lowestWins:false, maxRounds:null, desc:"Libre — score le plus haut en fin de partie"  },
  { id:"7wonders",     name:"7 Wonders",       emoji:"🏛️", targetScore:null, lowestWins:false, maxRounds:3,    desc:"3 manches — score le plus haut gagne"         },
  { id:"dixit",        name:"Dixit",           emoji:"🐇", targetScore:30,   lowestWins:false, maxRounds:null, desc:"Premier à 30 pts gagne"                       },
  { id:"azul",         name:"Azul",            emoji:"🔷", targetScore:null, lowestWins:false, maxRounds:null, desc:"Libre — score le plus haut en fin de partie"  },
  { id:"ttr",          name:"Les Aventuriers", emoji:"🚂", targetScore:null, lowestWins:false, maxRounds:null, desc:"Score le plus haut en fin de partie"          },
  { id:"belote",       name:"Belote",          emoji:"♠️", targetScore:1001, lowestWins:false, maxRounds:null, desc:"Premier à 1001 pts gagne"                     },
  { id:"tarot",        name:"Tarot",           emoji:"🔮", targetScore:null, lowestWins:false, maxRounds:null, desc:"Score libre"                                  },
  { id:"custom",       name:"Personnalisé",    emoji:"✏️", targetScore:null, lowestWins:false, maxRounds:null, desc:"Configurez vous-même"                         },
];

// ─────────────────────────────────────────────────────────
//  GLOBAL CSS
// ─────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-text-size-adjust:100%}
  body{overscroll-behavior-y:contain}
  .mono{font-family:'Space Mono',monospace}
  @keyframes scorePop{0%{transform:scale(1)}35%{transform:scale(1.18)}65%{transform:scale(.94)}100%{transform:scale(1)}}
  .score-pop{animation:scorePop .28s cubic-bezier(.36,.07,.19,.97)}
  @keyframes slideUp{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}
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
  @keyframes hourglassFlip{0%{transform:rotate(0deg) scale(1)}30%{transform:rotate(120deg) scale(0.9)}60%{transform:rotate(200deg) scale(1.05)}80%{transform:rotate(175deg) scale(0.97)}100%{transform:rotate(180deg) scale(1)}}
  @keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  @keyframes gearAccPop{0%{opacity:0;transform:translateY(4px) scale(.9)}15%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0;transform:translateY(-6px) scale(.88)}}
  .gear-acc-pop{animation:gearAccPop 1.8s ease forwards}
  @keyframes histSlide{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  .hist-slide{animation:histSlide .18s ease}
  @keyframes quickPop{from{opacity:0;transform:scale(.8) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .quick-pop{animation:quickPop .18s cubic-bezier(.34,1.56,.64,1)}
  @keyframes rankChange{0%{background:rgba(252,211,77,0.35)}100%{background:transparent}}
  .rank-change{animation:rankChange 1.2s ease}
  .p-row{transition:box-shadow .2s,filter .15s,opacity .15s}
  @media(hover:hover){.p-row:hover{filter:brightness(1.07)}}
  .cdot{width:14px;height:14px;border-radius:50%;border:none;cursor:pointer;transition:transform .12s;-webkit-tap-highlight-color:transparent}
  .cdot:active{transform:scale(1.5)}
  .sug-row{display:flex;align-items:center;gap:9px;width:100%;padding:13px;background:none;border:none;cursor:pointer;font-size:14px;font-family:'Sora',sans-serif;text-align:left;transition:background .1s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.sug-row:hover{background:rgba(128,128,128,.12)}}
  .hdr-btn{transition:color .12s,background .12s;-webkit-tap-highlight-color:transparent;min-height:36px}
  @media(hover:hover){.hdr-btn:hover:not(:disabled){background:rgba(128,128,128,.11)!important}}
  .tab-btn{transition:all .17s;-webkit-tap-highlight-color:transparent;flex-shrink:0}
  .drag-handle{cursor:grab;touch-action:none;user-select:none;padding:0 6px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}
  .drag-handle:active{cursor:grabbing}
  .score-input-edit{background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,.8);color:#fff;font-family:'Space Mono',monospace;font-weight:700;text-align:center;outline:none;caret-color:#fff;letter-spacing:-1px;width:120px;font-size:34px}
  .bonus-card{border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:800;border-radius:10px;transition:transform .08s;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;line-height:1}
  .bonus-card:active{transform:scale(.84)}
  .die-sel-btn{border-radius:10px;border:none;cursor:pointer;font-family:'Space Mono',monospace;font-weight:800;transition:all .13s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.die-sel-btn:hover{filter:brightness(1.13);transform:translateY(-1px)}}
  .rm-btn{transition:background .12s,color .12s;-webkit-tap-highlight-color:transparent}
  @media(hover:hover){.rm-btn:hover{background:rgba(239,68,68,0.5)!important;color:#fff!important}}
  .overflow-menu-item{display:flex;align-items:center;gap:12px;width:100%;padding:14px 18px;background:none;border:none;cursor:pointer;font-size:15px;font-family:'Sora',sans-serif;font-weight:600;text-align:left;-webkit-tap-highlight-color:transparent;transition:background .1s;border-radius:10px}
  @media(hover:hover){.overflow-menu-item:hover{background:rgba(128,128,128,.10)}}
  .preset-card{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border-radius:12px;border:1.5px solid;cursor:pointer;font-family:'Sora',sans-serif;transition:all .15s;text-align:left;-webkit-tap-highlight-color:transparent}
  .preset-card:active{transform:scale(.97)}
  button:focus-visible{outline:2px solid #fcd34d;outline-offset:2px}
  ::-webkit-scrollbar{width:3px;height:3px}
  ::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:2px}
  input{font-family:'Sora',sans-serif}
  input:focus{outline:none}
  input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  input[type=number]{-moz-appearance:textfield}
  .tabs-scroll{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:2px;padding-bottom:1px}
  .tabs-scroll::-webkit-scrollbar{display:none}
  .safe-bottom{padding-bottom:env(safe-area-inset-bottom,0px)}
  .overlay{position:fixed;inset:0;z-index:54;background:rgba(0,0,0,.68);backdrop-filter:blur(7px)}
  .name-edit-input{background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,.7);color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;outline:none;width:100%;caret-color:#fff}
`;

// ─────────────────────────────────────────────────────────
//  SOUNDS
// ─────────────────────────────────────────────────────────
const playDiceSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const dur = ctx.sampleRate * 0.25;
    const buf = ctx.createBuffer(1, dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < dur; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    src.connect(g); g.connect(ctx.destination);
    src.start();
  } catch {}
};

const playVictorySound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.40, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t); osc.stop(t + 0.46);
    });
  } catch {}
};

const playAlarmSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.38, 0.76].forEach(t => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      g.gain.setValueAtTime(0.52, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.30);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.31);
    });
  } catch {}
};

// ─────────────────────────────────────────────────────────
//  HOOKS
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

function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    const acquire = async () => {
      try { lockRef.current = await navigator.wakeLock.request("screen"); } catch {}
    };
    const release = () => { lockRef.current?.release(); lockRef.current = null; };
    if (active) acquire(); else release();
    return release;
  }, [active]);
}

// ─────────────────────────────────────────────────────────
//  GEAR SVG
// ─────────────────────────────────────────────────────────
function GearSVG({ rotation, lit }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display:"block", overflow:"visible" }}>
      <defs>
        <filter id="kg" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${rotation} 50 50)`} filter={lit?"url(#kg)":undefined}>
        <circle cx="50" cy="50" r="43" fill={lit?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.28)"} stroke={lit?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.28)"} strokeWidth="2.5"/>
        {Array.from({length:12},(_,i)=>{const a=(i/12)*Math.PI*2-Math.PI/2,mj=i%3===0,r1=mj?34:38;return<line key={i} x1={(50+r1*Math.cos(a)).toFixed(2)} y1={(50+r1*Math.sin(a)).toFixed(2)} x2={(50+43*Math.cos(a)).toFixed(2)} y2={(50+43*Math.sin(a)).toFixed(2)} stroke={mj?(lit?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.52)"):(lit?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.20)")} strokeWidth={mj?2.8:1.6} strokeLinecap="round"/>;})}
        <circle cx="50" cy="50" r="29" fill={lit?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.45)"} stroke={lit?"rgba(255,255,255,0.35)":"rgba(255,255,255,0.13)"} strokeWidth="1.5"/>
        {[30,150,270].map(deg=>{const a=deg*Math.PI/180;return<line key={deg} x1={(50+Math.cos(a)*11).toFixed(2)} y1={(50+Math.sin(a)*11).toFixed(2)} x2={(50+Math.cos(a)*26).toFixed(2)} y2={(50+Math.sin(a)*26).toFixed(2)} stroke={lit?"rgba(255,255,255,0.65)":"rgba(255,255,255,0.32)"} strokeWidth="3.2" strokeLinecap="round"/>;})}
        <circle cx="50" cy="50" r="7" fill={lit?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.15)"} stroke={lit?"rgba(255,255,255,0.70)":"rgba(255,255,255,0.28)"} strokeWidth="1.8"/>
        <circle cx="50" cy="50" r="2.8" fill={lit?"#fff":"rgba(255,255,255,0.50)"}/>
      </g>
    </svg>
  );
}

const DEG_PER_PT = 30;
function Gear({ onCommit, size, onFirstUse, playerScore, playerColor }) {
  const [rot, setRot] = useState(0);
  const [lit, setLit] = useState(false);
  const [acc, setAcc] = useState(0);
  const drag=useRef(null),litT=useRef(null),wheelT=useRef(null),accR=useRef(0),cbR=useRef(onCommit),elR=useRef(null),usedR=useRef(false);
  cbR.current=onCommit;
  // Commit: appelé uniquement au relâchement du doigt/clic ou après inactivité molette
  const commit=useCallback(()=>{if(!accR.current)return;cbR.current(accR.current);accR.current=0;setAcc(0);},[]);
  const add=useCallback((pts,fromWheel=false)=>{
    if(!pts)return;
    if(!usedR.current){usedR.current=true;onFirstUse?.();}
    setRot(r=>r-pts*DEG_PER_PT);
    accR.current+=pts;setAcc(accR.current);
    clearTimeout(litT.current);setLit(true);litT.current=setTimeout(()=>setLit(false),120);
    // Molette souris : commit après 600ms d'inactivité (pas d'event "fin de scroll")
    if(fromWheel){clearTimeout(wheelT.current);wheelT.current=setTimeout(commit,600);}
  },[onFirstUse,commit]);
  const ang=(cx,cy,px,py)=>Math.atan2(py-cy,px-cx)*180/Math.PI;
  const sdiff=(a,b)=>{let d=a-b;while(d>180)d-=360;while(d<-180)d+=360;return d;};
  const gc=()=>{const r=elR.current?.getBoundingClientRect();return r?{cx:r.left+r.width/2,cy:r.top+r.height/2}:{cx:0,cy:0};};
  const onMD=useCallback((e)=>{e.preventDefault();const{cx,cy}=gc();drag.current={cx,cy,la:ang(cx,cy,e.clientX,e.clientY),ad:0};setLit(true);const mv=(ev)=>{if(!drag.current)return;const{cx,cy}=drag.current;const na=ang(cx,cy,ev.clientX,ev.clientY);const df=sdiff(na,drag.current.la);drag.current.la=na;drag.current.ad-=df;const pts=Math.trunc(drag.current.ad/DEG_PER_PT);if(pts){drag.current.ad-=pts*DEG_PER_PT;add(pts);}};const up=()=>{drag.current=null;setLit(false);commit();window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};window.addEventListener("mousemove",mv);window.addEventListener("mouseup",up);},[add,commit]);
  const onTS=useCallback((e)=>{e.preventDefault();const{cx,cy}=gc();drag.current={cx,cy,la:ang(cx,cy,e.touches[0].clientX,e.touches[0].clientY),ad:0};setLit(true);},[]);
  const onTM=useCallback((e)=>{e.preventDefault();if(!drag.current)return;const{cx,cy}=drag.current;const na=ang(cx,cy,e.touches[0].clientX,e.touches[0].clientY);const df=sdiff(na,drag.current.la);drag.current.la=na;drag.current.ad-=df;const pts=Math.trunc(drag.current.ad/DEG_PER_PT);if(pts){drag.current.ad-=pts*DEG_PER_PT;add(pts);}},[add]);
  // Commit au relâchement du doigt
  const onTE=useCallback(()=>{drag.current=null;setLit(false);commit();},[commit]);
  useEffect(()=>{const el=elR.current;if(!el)return;const h=(e)=>{e.preventDefault();add(e.deltaY>0?-1:1,true);};el.addEventListener("wheel",h,{passive:false});return()=>el.removeEventListener("wheel",h);},[add]);
  useEffect(()=>()=>{clearTimeout(litT.current);clearTimeout(wheelT.current);},[]);
  const ns=playerScore+acc;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <div ref={elR} onMouseDown={onMD} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} data-gear aria-label="Molette de score" style={{width:"100%",height:"100%",cursor:"grab",userSelect:"none",touchAction:"none"}}><GearSVG rotation={rot} lit={lit}/></div>
      {acc!==0&&<div key={acc} className="gear-acc-pop" style={{position:"absolute",top:-52,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.92)",borderRadius:11,pointerEvents:"none",padding:"5px 11px",whiteSpace:"nowrap",zIndex:20,border:`1px solid ${playerColor}66`,display:"flex",alignItems:"center",gap:5}}>
        <span className="mono" style={{fontSize:12,color:"rgba(255,255,255,0.40)"}}>{playerScore>0?"+":""}{playerScore}</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.28)"}}>{acc>0?"＋":"－"}</span>
        <span className="mono" style={{fontSize:13,fontWeight:800,color:acc>0?"#4ade80":"#f87171"}}>{Math.abs(acc)}</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.28)"}}>＝</span>
        <span className="mono" style={{fontSize:14,fontWeight:900,color:playerColor}}>{ns>0?"+":""}{ns}</span>
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  DIE FACE
// ─────────────────────────────────────────────────────────
const DP={1:[[50,50]],2:[[30,30],[70,70]],3:[[28,28],[50,50],[72,72]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[28,28],[72,28],[50,50],[28,72],[72,72]],6:[[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]]};
const ppts=(n,r,cx=50,cy=50,off=-90)=>Array.from({length:n},(_,i)=>{const a=(i/n*360+off)*Math.PI/180;return`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`;}).join(" ");
function DieFace({sides,value,size=86,color="#2563eb",rolling=false,percentile=false}){
  const gi=`dg${sides}`,si=`ds${sides}`;
  const defs=(<defs><radialGradient id={gi} cx="35%" cy="28%" r="68%"><stop offset="0%" stopColor="rgba(255,255,255,0.38)"/><stop offset="100%" stopColor="rgba(0,0,0,0.18)"/></radialGradient><filter id={si} x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000" floodOpacity="0.55"/></filter></defs>);
  const nL=(v,fs=28,dy=0)=>{const d=percentile?String(v).padStart(2,"0"):v;return(<><text x="51" y={57+dy+1} textAnchor="middle" fontSize={fs} fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(0,0,0,0.45)">{d}</text><text x="50" y={57+dy} textAnchor="middle" fontSize={fs} fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(255,255,255,0.96)">{d}</text>{(v===6||v===9)&&!percentile&&<line x1="38" y1={63+dy} x2="62" y2={63+dy} stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round"/>}</>);};
  const anim=rolling?"dieRoll .09s steps(1) infinite":"none";
  const sh={filter:"drop-shadow(0 5px 14px rgba(0,0,0,0.5))",animation:anim};
  if(sides===6){const dots=DP[Math.min(value,6)]||DP[6];return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><rect x="8" y="8" width="84" height="84" rx="18" fill={color}/><rect x="8" y="8" width="84" height="84" rx="18" fill={`url(#${gi})`}/><rect x="8" y="8" width="84" height="84" rx="18" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{dots.map(([cx,cy],i)=>(<g key={i}><circle cx={cx+.8} cy={cy+1.2} r="7" fill="rgba(0,0,0,0.35)"/><circle cx={cx} cy={cy} r="7" fill="rgba(255,255,255,0.93)"/></g>))}</g></svg>);}
  if(sides===4){const o=ppts(3,44,50,54);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gi})`}/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,24,6)}</g></svg>);}
  if(sides===8){const d="50,6 92,50 50,94 8,50";return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><polygon points={d} fill={color}/><polygon points={d} fill={`url(#${gi})`}/><line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2"/><polygon points={d} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,26,-2)}</g></svg>);}
  if(sides===10){const p=ppts(9,44,50,56,-100);const pts="50,5 78,22 92,50 78,78 60,93 40,93 22,78 8,50 22,22";return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><polygon points={pts} fill={color}/><polygon points={pts} fill={`url(#${gi})`}/><polygon points={pts} fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/>{nL(percentile?value:(value===10?0:value),24,2)}</g></svg>);}
  if(sides===12){const o=ppts(12,44),i2=ppts(12,28,50,50,-75);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gi})`}/><polygon points={i2} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1"/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,26)}</g></svg>);}
  if(sides===20){const o=ppts(3,44,50,56),i2=ppts(3,22,50,56,90);return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><polygon points={o} fill={color}/><polygon points={o} fill={`url(#${gi})`}/><polygon points={i2} fill="rgba(0,0,0,0.10)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/><polygon points={o} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>{nL(value,22,8)}</g></svg>);}
  if(sides===100){return(<svg width={size} height={size} viewBox="0 0 100 100" style={sh}>{defs}<g filter={`url(#${si})`}><rect x="6" y="6" width="88" height="88" rx="10" fill={color}/><rect x="6" y="6" width="88" height="88" rx="10" fill={`url(#${gi})`}/><rect x="12" y="12" width="76" height="76" rx="7" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.2"/><rect x="6" y="6" width="88" height="88" rx="10" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="1.4"/><text x="51" y="53" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(0,0,0,0.4)">{value===100?"00":String(value).padStart(2,"0")}</text><text x="50" y="52" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Space Mono,monospace" fill="rgba(255,255,255,0.96)">{value===100?"00":String(value).padStart(2,"0")}</text><text x="50" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Sora,sans-serif" fill="rgba(255,255,255,0.55)">%</text></g></svg>);}
  return(<svg width={size} height={size} viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="14" fill={color}/><text x="50" y="57" textAnchor="middle" fontSize="28" fontWeight="800" fontFamily="Space Mono,monospace" fill="#fff">{value}</text></svg>);
}

// ─────────────────────────────────────────────────────────
//  QUICK SCORE POPUP (long press on score)
// ─────────────────────────────────────────────────────────
function QuickScorePopup({ onApply, onEdit, onClose, color, isMobile }) {
  const QUICK = [1, 5, 10, 25, -1, -5, -10];
  return (
    <div className="quick-pop"
      style={{ position:"absolute", bottom:"110%", left:"50%", transform:"translateX(-50%)",
        zIndex:30, background:"rgba(10,12,20,0.97)", borderRadius:16,
        padding:"12px 10px 10px", border:`1.5px solid ${color}55`,
        boxShadow:`0 8px 28px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
        minWidth:isMobile?220:240 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.40)",
        textAlign:"center", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
        Ajustement rapide
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5, marginBottom:8 }}>
        {QUICK.map(v => {
          const pos = v > 0;
          return (
            <button key={v} onClick={() => { onApply(v); onClose(); }}
              style={{ padding:"9px 4px", borderRadius:9, border:`1.5px solid ${pos?"rgba(74,222,128,0.30)":"rgba(239,68,68,0.30)"}`,
                background: pos?"rgba(74,222,128,0.10)":"rgba(239,68,68,0.10)",
                color: pos?"#4ade80":"#f87171",
                fontWeight:800, fontSize:13, fontFamily:"Space Mono,monospace",
                cursor:"pointer", minHeight:38 }}>
              {v > 0 ? "+" : ""}{v}
            </button>
          );
        })}
        <button onClick={() => { onEdit(); onClose(); }}
          style={{ padding:"9px 4px", borderRadius:9, border:`1.5px solid rgba(255,255,255,0.15)`,
            background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.7)",
            fontWeight:700, fontSize:11, cursor:"pointer", minHeight:38 }}>
          ✏️ libre
        </button>
      </div>
      <button onClick={onClose}
        style={{ width:"100%", padding:"7px 0", borderRadius:8, border:"none",
          background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.45)",
          cursor:"pointer", fontSize:12, fontWeight:700 }}>
        Annuler
      </button>
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
    <div style={{ marginTop:4 }}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}} aria-expanded={open}
        style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(0,0,0,0.22)",
          border:"none", borderRadius:7, padding:"3px 8px", cursor:"pointer",
          color:"rgba(255,255,255,0.48)", minHeight:26 }}>
        <span style={{ fontSize:9, fontWeight:700 }}>{open?"▲":"▼"} hist.</span>
        {!open && (
          <div style={{ display:"flex", gap:2, alignItems:"center", maxWidth:isMobile?72:130, overflow:"hidden" }}>
            {last10.slice(isMobile?-4:-10).map((h,i) => (
              <span key={i} className="mono" style={{ fontSize:9, fontWeight:800, flexShrink:0,
                color:h.delta<0?"#fca5a5":"#86efac" }}>
                {h.delta>0?"+":""}{h.delta}
              </span>
            ))}
          </div>
        )}
      </button>
      {open && (
        <div className="hist-slide"
          style={{ marginTop:4, background:"rgba(0,0,0,0.32)", borderRadius:9,
            padding:"7px 10px", maxHeight:180, overflowY:"auto",
            display:"flex", flexDirection:"column", gap:4 }}>
          {[...last10].reverse().map((h,i) => {
            const prev = h.score - h.delta;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10 }}>
                <span style={{ color:"rgba(255,255,255,0.30)", flexShrink:0, minWidth:24 }}>R{h.round}</span>
                <span className="mono" style={{ color:"rgba(255,255,255,0.36)", fontSize:10 }}>{prev>0?"+":""}{prev}</span>
                <span style={{ color:"rgba(255,255,255,0.26)", fontSize:10 }}>{h.delta>0?"＋":"－"}</span>
                <span className="mono" style={{ fontWeight:800, fontSize:10, color:h.delta<0?"#fca5a5":"#86efac" }}>{Math.abs(h.delta)}</span>
                <span style={{ color:"rgba(255,255,255,0.26)", fontSize:10 }}>＝</span>
                <span className="mono" style={{ fontWeight:800, fontSize:10, color }}>{h.score>0?"+":""}{h.score}</span>
                <span style={{ color:"rgba(255,255,255,0.22)", fontSize:9, marginLeft:"auto" }}>{h.time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SPINNER WHEEL (condensed)
// ─────────────────────────────────────────────────────────
function SpinnerWheel({ players, onResult, acc, isMobile }) {
  const [spinning,setSp]=useState(false),[angle,setAng]=useState(0),[winner,setW]=useState(null);
  const aR=useRef(null),angR=useRef(0),velR=useRef(0),ltR=useRef(null),sf=useRef(false),pR=useRef(null);
  const rW=useCallback((a)=>{
    const n=players.length, SA=360/n;
    // Quelle tranche est sous l'aiguille (haut du SVG) après rotation de `a`°?
    // L'aiguille voit la partie du plateau qui était à -a° avant rotation.
    // Les tranches commencent à 0° (après décalage +90°), donc :
    const phi=((-a)%360+360)%360;
    return players[Math.floor(phi/SA)%n];
  },[players]);
  const fin=useCallback((a)=>{const w=rW(a);setW(w);setSp(false);sf.current=false;onResult(w);},[rW,onResult]);
  const stopNow=useCallback(()=>{if(spinning)sf.current=true;},[spinning]);
  const spin=useCallback(()=>{
    if(spinning||players.length<2)return;setW(null);setSp(true);sf.current=false;ltR.current=null;
    const pV=6+Math.random()*6,aC=400+Math.random()*300,cMs=3e3+Math.random()*7e3;pR.current={pV,aC,cMs};
    velR.current=0;const ex=Math.random()*360*(2+Math.random()*4);angR.current+=ex;setAng(a=>a+ex);
    let el=0;
    const loop=(ts)=>{if(!ltR.current){ltR.current=ts;aR.current=requestAnimationFrame(loop);return;}const dt=Math.min(ts-ltR.current,50);ltR.current=ts;el+=dt;const{pV,aC,cMs}=pR.current;let v;if(sf.current){velR.current=Math.max(0,velR.current-dt*0.012);v=velR.current;}else if(el<aC){v=pV*(el/aC);}else if(el<cMs){v=pV;}else{const d=el-cMs,dd=2500+Math.random()*500;v=Math.max(0,pV*(1-d/dd));}velR.current=v;angR.current+=v*dt;setAng(angR.current);if(v<=0){fin(angR.current);return;}aR.current=requestAnimationFrame(loop);};
    aR.current=requestAnimationFrame(loop);
  },[spinning,players,fin]);
  useEffect(()=>()=>cancelAnimationFrame(aR.current),[]);
  if(!players.length)return(<div style={{textAlign:"center",padding:"40px 20px",color:"#50556e"}}><div style={{fontSize:48,marginBottom:8}}>🎡</div><div style={{fontSize:14,fontWeight:700}}>Ajoutez des joueurs pour utiliser la roue</div></div>);
  const W=isMobile?Math.min(window.innerWidth-48,240):230,CX=W/2,CY=W/2,R=W/2-6,SA=360/players.length;
  const nfs=players.length<=4?13:players.length<=7?10:8;
  const nc=acc||"#f59e0b";
  const slices=players.map((p,i)=>{const a0=(i*SA-90)*Math.PI/180,a1=((i+1)*SA-90)*Math.PI/180,large=SA>180?1:0,mA=((i+0.5)*SA-90)*Math.PI/180,tr=R*.62;return{p,d:`M${CX},${CY} L${(CX+R*Math.cos(a0)).toFixed(2)},${(CY+R*Math.sin(a0)).toFixed(2)} A${R},${R} 0 ${large},1 ${(CX+R*Math.cos(a1)).toFixed(2)},${(CY+R*Math.sin(a1)).toFixed(2)}Z`,tx:CX+tr*Math.cos(mA),ty:CY+tr*Math.sin(mA),ta:(i+0.5)*SA};});
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
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
      {winner&&!spinning&&(<div className="slide-up" style={{padding:"11px 28px",borderRadius:13,background:`linear-gradient(135deg,${winner.color.hex},${winner.color.hex}aa)`,color:"#fff",fontWeight:800,fontSize:17,textAlign:"center"}}>🎉 {winner.name} commence !</div>)}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={spin} disabled={spinning||players.length<2} style={{padding:"13px 28px",borderRadius:12,border:"none",background:spinning?"#374151":`linear-gradient(135deg,${nc},#ef4444)`,color:"#fff",fontWeight:800,fontSize:14,cursor:spinning||players.length<2?"not-allowed":"pointer",opacity:players.length<2?.5:1,minHeight:48}}>{spinning?"⏳ En cours…":"🎡 Lancer"}</button>
        <button onClick={stopNow} disabled={!spinning} style={{padding:"13px 18px",borderRadius:12,border:"none",background:spinning?"#ef4444":"rgba(239,68,68,0.15)",color:spinning?"#fff":"#f87171",fontWeight:800,fontSize:14,cursor:spinning?"pointer":"default",opacity:spinning?1:.45,transition:"all .2s",minHeight:48}}>⏹ Stop</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  SAND TIMER (condensed)
// ─────────────────────────────────────────────────────────
function SandTimer({ D, dark }) {
  const PRE=[{label:"30 s",s:30},{label:"1 min",s:60},{label:"2 min",s:120},{label:"3 min",s:180}];
  const [dur,setDur]=useState(60),[rem,setRem]=useState(60),[status,setSt]=useState("idle");
  const [flipping,setFlipping]=useState(false);
  const ivR=useRef(null),endR=useRef(null);
  const pr=rem/dur;
  const ring=pr>.5?"#4ade80":pr>.25?"#fbbf24":"#ef4444";
  // Anneau plus grand — SVG 280×280, cx/cy=140, r=110
  const RING_R=110, RING_W=280;
  const CIRC=2*Math.PI*RING_R;

  // ── Sable ──────────────────────────────────────────────
  // tp : 0 = début (top plein, bas vide) → 1 = fin (top vide, bas plein)
  const tp=1-pr;

  // Chambre HAUTE : M 20,11 L 80,11 L 52,47 L 48,47
  // Mur gauche : (20,11)→(48,47), droit : (80,11)→(52,47)
  const tSY=11+36*tp;           // surface du sable en haut (descend)
  // Bords du sable au niveau tSY, le long des parois :
  const tL=(20+28*tp).toFixed(2);   // paroi gauche à y=tSY : 20+28*(tSY-11)/36 = 20+28*tp
  const tR=(80-28*tp).toFixed(2);   // paroi droite

  // Chambre BAS : M 48,53 L 52,53 L 80,89 L 20,89
  // Mur gauche : (48,53)→(20,89), droit : (52,53)→(80,89)
  const bSY=89-36*tp;           // surface du sable en bas (monte)
  // Bords du sable au niveau bSY, le long des parois :
  // x_gauche = 48 - 28*(bSY-53)/36 = 48 - 28*(1-tp) = 20+28*tp
  const bL=(20+28*tp).toFixed(2);
  const bR=(80-28*tp).toFixed(2);

  // Polygones
  const tP=pr>.004?`M ${tL},${tSY.toFixed(2)} L ${tR},${tSY.toFixed(2)} L 52,47 L 48,47 Z`:null;
  const bP=pr<.996?`M ${bL},${bSY.toFixed(2)} L ${bR},${bSY.toFixed(2)} L 80,89 L 20,89 Z`:null;

  const sC=dark?"#fbbf24":"#d97706",gS=dark?"rgba(255,255,255,0.28)":"rgba(0,0,0,0.22)",gF=dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",pC=dark?"rgba(255,255,255,0.22)":"rgba(0,0,0,0.18)";
  const tick=useCallback(()=>{const r=Math.max(0,Math.round((endR.current-Date.now())/1000));setRem(r);if(r<=0){clearInterval(ivR.current);setSt("done");playAlarmSound();}},[]);
  const start=useCallback(()=>{const r=status==="done"?dur:rem;setRem(r);endR.current=Date.now()+r*1e3;setSt("running");clearInterval(ivR.current);ivR.current=setInterval(tick,200);},[status,dur,rem,tick]);
  const pause=useCallback(()=>{clearInterval(ivR.current);setSt("paused");},[]);

  // Reset avec animation de retournement
  const reset=useCallback(()=>{
    clearInterval(ivR.current);
    setFlipping(true);
    // Après 600ms (animation flip), réinitialiser
    setTimeout(()=>{
      setRem(dur);setSt("idle");setFlipping(false);
    },600);
  },[dur]);

  const pick=useCallback((s)=>{clearInterval(ivR.current);setDur(s);setRem(s);setSt("idle");},[]);
  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  const done=status==="done";
  useEffect(()=>()=>clearInterval(ivR.current),[]);

  const hourglassAnim = flipping
    ? "hourglassFlip 0.6s cubic-bezier(.4,0,.2,1) forwards"
    : done
      ? "hourglassShake .55s ease 4"
      : "none";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:20,padding:"22px 18px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
          {PRE.map(p=>(<button key={p.s} onClick={()=>pick(p.s)} aria-pressed={dur===p.s} style={{padding:"10px 18px",borderRadius:10,border:`1.5px solid ${dur===p.s?ring:D.brd}`,background:dur===p.s?ring+"22":"transparent",color:dur===p.s?ring:D.sub,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all .15s",minHeight:44}}>{p.label}</button>))}
        </div>

        {/* Conteneur : anneau (280×280) + sablier centré */}
        <div style={{position:"relative",width:RING_W,height:RING_W,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {/* Anneau de progression — grand, écarté du sablier */}
          <svg width={RING_W} height={RING_W} viewBox={`0 0 ${RING_W} ${RING_W}`}
            style={{position:"absolute",inset:0,transform:"rotate(-90deg)",pointerEvents:"none"}}>
            <circle cx={RING_W/2} cy={RING_W/2} r={RING_R} fill="none" stroke={ring+"1a"} strokeWidth="10"/>
            <circle cx={RING_W/2} cy={RING_W/2} r={RING_R} fill="none" stroke={ring} strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${CIRC*pr} ${CIRC*(1-pr)}`}
              style={{transition:"stroke-dasharray .28s ease,stroke .6s ease"}}/>
          </svg>

          {/* Sablier + timer */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <svg width="110" height="110" viewBox="0 0 100 100"
              style={{filter:"drop-shadow(0 4px 18px rgba(0,0,0,.4))",
                animation:hourglassAnim}}>
              {/* Plaques */}
              <rect x="16" y="4"  width="68" height="7" rx="3.5" fill={pC}/>
              <rect x="16" y="89" width="68" height="7" rx="3.5" fill={pC}/>
              {/* Verre haut */}
              <path d="M 20,11 L 80,11 L 52,47 L 48,47 Z" fill={gF} stroke={gS} strokeWidth="1.4" strokeLinejoin="round"/>
              {/* Verre bas */}
              <path d="M 48,53 L 52,53 L 80,89 L 20,89 Z" fill={gF} stroke={gS} strokeWidth="1.4" strokeLinejoin="round"/>
              {/* Sable haut */}
              {tP&&<path d={tP} fill={sC} opacity=".92"/>}
              {tP&&pr>.07&&<line x1={tL} y1={(tSY+.8).toFixed(2)} x2={tR} y2={(tSY+.8).toFixed(2)} stroke="rgba(255,255,255,0.48)" strokeWidth="1.2"/>}
              {/* Filet de sable au col */}
              {status==="running"&&pr>.02&&pr<.98&&(
                <ellipse cx="50" cy="49" rx="1.2" ry="1.8" fill={sC}
                  style={{animation:"sandFall .36s linear infinite"}}/>
              )}
              {/* Sable bas */}
              {bP&&<path d={bP} fill={sC} opacity=".92"/>}
              {bP&&pr<.93&&<line x1={bL} y1={(bSY+.8).toFixed(2)} x2={bR} y2={(bSY+.8).toFixed(2)} stroke="rgba(255,255,255,0.40)" strokeWidth="1.2"/>}
              {/* Check fin */}
              {done&&<text x="50" y="72" textAnchor="middle" fontSize="19" fill={sC}
                style={{animation:"timerPulse .8s ease infinite"}}>✓</text>}
            </svg>

            {/* Affichage du temps */}
            <div className="mono" style={{fontSize:32,fontWeight:800,letterSpacing:-1,
              color:done?ring:D.txt,
              animation:done?"timerPulse .85s ease 4":"none",
              transition:"color .5s"}}>
              {fmt(rem)}
            </div>
          </div>
        </div>

        {/* Boutons */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
          {(status==="idle"||status==="paused"||status==="done")&&(
            <button onClick={start} disabled={flipping}
              style={{padding:"12px 32px",borderRadius:12,border:"none",background:ring,color:"#111",fontWeight:800,fontSize:15,cursor:"pointer",minHeight:48,transition:"background .5s",opacity:flipping?.5:1}}>
              {status==="done"?"🔁 Rejouer":status==="paused"?"▶ Reprendre":"▶ Démarrer"}
            </button>
          )}
          {status==="running"&&(
            <button onClick={pause}
              style={{padding:"12px 32px",borderRadius:12,border:"none",background:"rgba(100,116,139,0.22)",color:D.txt,fontWeight:800,fontSize:15,cursor:"pointer",minHeight:48}}>
              ⏸ Pause
            </button>
          )}
          {status!=="idle"&&(
            <button onClick={reset} disabled={flipping} aria-label="Réinitialiser"
              style={{width:48,height:48,borderRadius:12,border:`1px solid ${D.brd}`,background:flipping?D.acc+"22":"transparent",color:flipping?D.acc:D.sub,cursor:flipping?"default":"pointer",fontSize:22,transition:"all .2s"}}>
              {flipping?"⟳":"↺"}
            </button>
          )}
        </div>

        {done&&(
          <div className="slide-up" style={{fontSize:16,fontWeight:800,color:ring,animation:"timerPulse 1s ease infinite"}}>
            ⏰ Temps écoulé !
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  GAME PRESET MODAL
// ─────────────────────────────────────────────────────────
function GamePresetModal({ onSelect, onClose, D, dark, isMobile }) {
  return (
    <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true"
      style={{ display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:16 }}>
      <div className={isMobile?"slide-up-sheet safe-bottom":"slide-up"}
        onClick={e=>e.stopPropagation()}
        style={{ background:D.card, border:`1px solid ${D.brd}`, borderRadius:isMobile?"22px 22px 0 0":18,
          padding:"0 0 8px", width:"100%", maxWidth:520,
          maxHeight:isMobile?"88dvh":"78vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 18px 12px", flexShrink:0 }}>
          {isMobile&&<div style={{ width:36,height:4,borderRadius:2,background:"rgba(128,128,128,0.3)",margin:"0 auto 14px"}}/>}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:800, fontSize:17 }}>🎯 Quel jeu ?</div>
              <div style={{ fontSize:12, color:D.sub, marginTop:2 }}>Choisissez un préset ou démarrez libre</div>
            </div>
            <button onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14 }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"0 14px 12px", display:"flex", flexDirection:"column", gap:7 }}>
          {GAME_PRESETS.map(p => (
            <button key={p.id} className="preset-card" onClick={()=>onSelect(p)}
              style={{ borderColor:D.brd, background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",
                color:D.txt }}>
              <span style={{ fontSize:24, flexShrink:0 }}>{p.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                <div style={{ fontSize:11, color:D.sub, marginTop:1 }}>{p.desc}</div>
              </div>
              {p.targetScore&&<span className="mono" style={{ fontSize:11, color:D.acc, flexShrink:0 }}>{p.targetScore} pts</span>}
              {p.lowestWins&&<span style={{ fontSize:10, color:"#60a5fa", flexShrink:0, background:"rgba(96,165,250,0.12)", padding:"2px 6px", borderRadius:5 }}>↓ min</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  INTER-GAME STATS
// ─────────────────────────────────────────────────────────
function InterGameStats({ D, dark, isMobile, onClose }) {
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("sgt7_saved") || "[]"); } catch { return []; }
  }, []);

  const finished = saved.filter(g => g.state === "ended" || g.players?.some(p => p.score !== 0));

  // Aggregate stats
  const stats = useMemo(() => {
    const wins = {}, games = {}, totalScore = {}, bestScore = {};
    finished.forEach(g => {
      const ps = g.players || [];
      if (!ps.length) return;
      const sorted = [...ps].sort((a,b) => g.lowestWins ? a.score-b.score : b.score-a.score);
      const winner = sorted[0];
      ps.forEach(p => {
        if (!games[p.name]) { games[p.name]=0; wins[p.name]=0; totalScore[p.name]=0; bestScore[p.name]=p.score; }
        games[p.name]++;
        totalScore[p.name] += p.score;
        if (g.lowestWins) { if (p.score < (bestScore[p.name]??Infinity)) bestScore[p.name]=p.score; }
        else { if (p.score > (bestScore[p.name]??-Infinity)) bestScore[p.name]=p.score; }
      });
      if (winner) wins[winner.name] = (wins[winner.name]||0) + 1;
    });
    return Object.keys(games).map(name => ({
      name, wins:wins[name]||0, games:games[name],
      avg: Math.round(totalScore[name]/games[name]),
      best: bestScore[name],
      ratio: games[name] ? Math.round((wins[name]||0)/games[name]*100) : 0,
    })).sort((a,b) => b.wins-a.wins || b.ratio-a.ratio);
  }, [finished]);

  return (
    <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true"
      style={{ display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", padding:isMobile?0:16 }}>
      <div className={isMobile?"slide-up-sheet safe-bottom":"slide-up"}
        onClick={e=>e.stopPropagation()}
        style={{ background:D.card, border:`1px solid ${D.brd}`, borderRadius:isMobile?"22px 22px 0 0":18,
          padding:"0 0 8px", width:"100%", maxWidth:540,
          maxHeight:isMobile?"90dvh":"80vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 18px 10px", flexShrink:0 }}>
          {isMobile&&<div style={{ width:36,height:4,borderRadius:2,background:"rgba(128,128,128,0.3)",margin:"0 auto 14px"}}/>}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:800, fontSize:17 }}>📈 Tableau des champions</div>
              <div style={{ fontSize:12, color:D.sub, marginTop:1 }}>{finished.length} partie{finished.length!==1?"s":""} enregistrée{finished.length!==1?"s":""}</div>
            </div>
            <button onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14 }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"0 14px 12px" }}>
          {!stats.length ? (
            <div style={{ textAlign:"center", padding:"40px 20px", color:D.sub }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏆</div>
              <div style={{ fontSize:15, fontWeight:700, color:D.txt }}>Aucune partie enregistrée</div>
              <div style={{ fontSize:12, marginTop:6 }}>Les parties sont sauvegardées automatiquement</div>
            </div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:4, padding:"8px 10px",
                fontSize:10, fontWeight:700, color:D.sub, textTransform:"uppercase", letterSpacing:.8 }}>
                <span>Joueur</span><span style={{textAlign:"center"}}>🏆 V</span><span style={{textAlign:"center"}}>%</span><span style={{textAlign:"center"}}>Moy.</span><span style={{textAlign:"center"}}>Best</span>
              </div>
              {stats.map((s, i) => (
                <div key={s.name}
                  style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr", gap:4,
                    padding:"11px 10px", borderRadius:10, marginBottom:4,
                    background:i===0?(dark?"rgba(252,211,77,0.08)":"rgba(245,158,11,0.08)"):
                               i===1?(dark?"rgba(148,163,184,0.07)":"rgba(100,116,139,0.06)"):
                               i===2?(dark?"rgba(180,83,9,0.07)":"rgba(180,83,9,0.06)"):"transparent",
                    border:i===0?`1px solid rgba(252,211,77,0.20)`:"1px solid transparent",
                    alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
                    <span style={{ fontSize:i<3?14:10, flexShrink:0 }}>{["🥇","🥈","🥉"][i]||`#${i+1}`}</span>
                    <span style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <span className="mono" style={{ fontSize:15, fontWeight:800, color:D.acc }}>{s.wins}</span>
                    <div style={{ fontSize:9, color:D.sub }}>/{s.games}</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ background:`rgba(74,222,128,${s.ratio/100*.4})`, borderRadius:6, padding:"2px 5px" }}>
                      <span className="mono" style={{ fontSize:12, fontWeight:700, color:"#4ade80" }}>{s.ratio}%</span>
                    </div>
                  </div>
                  <span className="mono" style={{ textAlign:"center", fontSize:12, fontWeight:600, color:D.sub }}>{s.avg>0?"+":""}{s.avg}</span>
                  <span className="mono" style={{ textAlign:"center", fontSize:12, fontWeight:800, color:D.txt }}>{s.best>0?"+":""}{s.best}</span>
                </div>
              ))}

              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:D.sub, marginBottom:8, textTransform:"uppercase", letterSpacing:.8 }}>
                  Parties récentes
                </div>
                {saved.slice(0,8).map((g,i) => {
                  const ps=[...(g.players||[])].sort((a,b)=>g.lowestWins?a.score-b.score:b.score-a.score);
                  const winner=ps[0];
                  return(
                    <div key={g.id||i} style={{ padding:"10px 12px", borderRadius:10, marginBottom:5,
                      background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)",
                      border:`1px solid ${D.brd}` }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontWeight:700, fontSize:13 }}>{g.name||"Partie"}</span>
                        <span style={{ fontSize:10, color:D.sub }}>{g.savedAt?new Date(g.savedAt).toLocaleDateString("fr-FR"):""}</span>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {ps.slice(0,5).map((p,j)=>(
                          <span key={p.id||j} style={{ fontSize:11, color:p.id===winner?.id?D.acc:D.sub,
                            fontWeight:p.id===winner?.id?800:500 }}>
                            {j===0?"🥇":""}{p.name} <span className="mono">{p.score>0?"+":""}{p.score}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  BOTTOM SHEET / MODAL
// ─────────────────────────────────────────────────────────
function BottomSheet({ children, onClose, D, isMobile, maxW=480, title, noPad=false }) {
  const ref=useRef(null);useEffect(()=>{ref.current?.focus();},[]);
  if(isMobile){return(
    <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="slide-up-sheet safe-bottom" ref={ref} tabIndex={-1} onClick={e=>e.stopPropagation()}
        style={{position:"fixed",bottom:0,left:0,right:0,zIndex:55,background:D.card,borderRadius:"22px 22px 0 0",padding:"0 0 8px",maxHeight:"90dvh",display:"flex",flexDirection:"column",outline:"none",border:`1px solid ${D.brd}`}}>
        <div style={{padding:"14px 18px 10px",flexShrink:0}}>
          <div style={{width:36,height:4,borderRadius:2,background:"rgba(128,128,128,0.30)",margin:"0 auto"+(title?" 14px":"")}}/>
          {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontWeight:800,fontSize:17}}>{title}</span>
            <button onClick={onClose} aria-label="Fermer" style={{width:32,height:32,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14}}>✕</button>
          </div>}
        </div>
        <div style={{overflowY:"auto",flex:1,padding:noPad?"0":"0 18px 12px"}}>{children}</div>
      </div>
    </div>
  );}
  return(
    <div className="overlay fade-in" onClick={onClose} role="dialog" aria-modal="true" style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div className="slide-up" ref={ref} tabIndex={-1} onClick={e=>e.stopPropagation()}
        style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:18,padding:20,width:"100%",maxWidth:maxW,outline:"none",maxHeight:"78vh",display:"flex",flexDirection:"column"}}>
        {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontWeight:800,fontSize:16}}>{title}</span>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:13}}>✕</button>
        </div>}
        <div style={{overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  MINI LEADERBOARD
// ─────────────────────────────────────────────────────────
function MiniLeaderboard({ players, lowestWins, targetScore, D, dark, isMobile }) {
  const sorted = [...players].sort((a,b) => lowestWins ? a.score-b.score : b.score-a.score);
  const best   = sorted[0]?.score ?? 0;
  const worst  = sorted[sorted.length-1]?.score ?? 0;
  const range  = Math.abs(best - worst) || 1;
  return(
    <div style={{marginTop:14,background:D.card,border:`1px solid ${D.brd}`,borderRadius:14,padding:"13px 14px"}}>
      <div style={{fontSize:10,fontWeight:700,color:D.sub,marginBottom:11,textTransform:"uppercase",letterSpacing:1}}>
        📊 Classement{targetScore!=null?` · Objectif ${targetScore} pts`:""}
        {lowestWins&&<span style={{marginLeft:6,color:"#60a5fa",fontSize:9}}>↓ min gagne</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sorted.map((p,i) => {
          const pct = targetScore!=null
            ? Math.max(4, Math.min(100, lowestWins
                ? Math.max(0, (1-(p.score/targetScore)))*100
                : (p.score/targetScore)*100))
            : Math.max(4, lowestWins
                ? ((worst-p.score)/range)*100+4
                : ((p.score-worst)/range)*100+4);
          return(<div key={p.id} style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:i<3?13:10,minWidth:16,flexShrink:0}}>{i<3?MEDALS[i]:`#${i+1}`}</span>
            <div style={{width:26,height:26,borderRadius:"50%",background:p.color.hex,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:11,flexShrink:0}}>{p.name[0]}</div>
            {!isMobile&&<span style={{fontSize:12,fontWeight:600,minWidth:58,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>}
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
  onAdjust, onCommit, onRemove, onSelect, onColorChange, onRename,
  playerHistory, showGearHint, onGearFirstUse,
  dragHandlers, rowRef, isDragging,
}) {
  const ROW_H  = isMobile ? 76 : 82;
  const GEAR_SZ= isMobile ? 76 : 86;
  const gOver  = (GEAR_SZ - ROW_H) / 2;
  const col    = player.color.hex;

  const [showPalette, setPalette]   = useState(false);
  const [editScore,   setEditScore] = useState(false);
  const [editVal,     setEditVal]   = useState("");
  const [showQuick,   setShowQuick] = useState(false);
  const [editName,    setEditName]  = useState(false);
  const [nameVal,     setNameVal]   = useState(player.name);
  const [swipeFx,     setSwipeFx]   = useState(null);

  const editRef    = useRef(null);
  const nameRef    = useRef(null);
  const longT      = useRef(null);
  const longFired  = useRef(false);
  const swipeRef   = useRef({ startX:0, startY:0, triggered:false });
  const swipedRef  = useRef(false);
  const nameTapRef = useRef({ count:0, timer:null });

  // ── Swipe ──
  const onTS = (e) => {
    if(e.target.closest("[data-gear]")||e.target.closest("[data-pal]")||e.target.closest("[data-rm]")||e.target.closest("[data-drag]")||e.target.closest("[data-sedit]")||e.target.closest("[data-nedit]"))return;
    const t=e.touches[0];swipeRef.current={startX:t.clientX,startY:t.clientY,triggered:false};swipedRef.current=false;
  };
  const onTM = (e) => {
    if(swipeRef.current.triggered)return;const dx=e.touches[0].clientX-swipeRef.current.startX,dy=e.touches[0].clientY-swipeRef.current.startY;
    if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.3){swipeRef.current.triggered=true;swipedRef.current=true;const pts=dx>0?1:-1;onAdjust(pts);setSwipeFx(pts>0?"＋1":"－1");setTimeout(()=>setSwipeFx(null),380);}
  };

  // ── Long press on score ──
  const onScorePD = (e) => {
    e.stopPropagation();longFired.current=false;
    longT.current=setTimeout(()=>{longFired.current=true;navigator.vibrate?.(40);setShowQuick(true);},600);
  };
  const onScorePU = (e) => {
    clearTimeout(longT.current);
    if(!longFired.current){setEditVal(String(player.score));setEditScore(true);setTimeout(()=>{editRef.current?.focus();editRef.current?.select();},30);}
  };
  const commitScore = () => { const n=parseInt(editVal,10);if(!isNaN(n)&&n!==player.score)onAdjust(n-player.score);setEditScore(false); };

  // ── Double-tap on name → edit ──
  const onNameTap = (e) => {
    e.stopPropagation();nameTapRef.current.count++;clearTimeout(nameTapRef.current.timer);
    if(nameTapRef.current.count>=2){nameTapRef.current.count=0;setNameVal(player.name);setEditName(true);setTimeout(()=>{nameRef.current?.focus();nameRef.current?.select();},30);}
    else{nameTapRef.current.timer=setTimeout(()=>{nameTapRef.current.count=0;},320);}
  };
  const commitName = () => { const n=nameVal.trim();if(n&&n!==player.name)onRename(n);setEditName(false); };

  const handleClick = (e) => {
    if(swipedRef.current){swipedRef.current=false;return;}
    if(e.target.closest("[data-gear]")||e.target.closest("[data-rm]")||e.target.closest("[data-pal]")||e.target.closest("[data-drag]")||e.target.closest("[data-sedit]")||e.target.closest("[data-nedit]"))return;
    onSelect();
  };

  return(
    <div style={{position:"relative",paddingTop:gOver,paddingBottom:gOver,zIndex:isSel?10:1}} ref={rowRef}>
      <div className="p-row" onClick={handleClick} onTouchStart={onTS} onTouchMove={onTM}
        role="button" aria-pressed={isSel} aria-label={`${player.name} — ${player.score} pts`}
        style={{position:"relative",height:ROW_H,borderRadius:14,background:col,cursor:"pointer",overflow:"visible",
          boxShadow:isSel?`inset 0 0 0 9999px rgba(0,0,0,0.08),0 0 0 2.5px ${col},0 0 0 4.5px rgba(255,255,255,0.18)`:isDragging?`inset 0 0 0 9999px rgba(0,0,0,0.06),0 12px 32px ${col}88`:`inset 0 0 0 9999px rgba(0,0,0,0.52),0 2px 7px ${col}25`,
          opacity:isDragging?.7:1,display:"flex",alignItems:"center",gap:isMobile?6:8,padding:`0 8px 0 ${isMobile?10:13}px`,
          transition:"opacity .12s,box-shadow .15s"}}>

        {/* Swipe FX */}
        {swipeFx&&<div className="swipe-flash" style={{position:"absolute",inset:0,borderRadius:14,zIndex:20,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",background:swipeFx.includes("＋")?"rgba(74,222,128,0.22)":"rgba(239,68,68,0.22)"}}><span className="mono" style={{fontSize:24,fontWeight:900,color:swipeFx.includes("＋")?"#4ade80":"#f87171"}}>{swipeFx}</span></div>}

        {/* Drag handle */}
        <div data-drag className="drag-handle"
          onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dragHandlers?.onDown(e,player.id);}}
          onPointerMove={e=>dragHandlers?.onMove(e)} onPointerUp={dragHandlers?.onUp} onPointerCancel={dragHandlers?.onUp}
          style={{color:"rgba(255,255,255,0.38)",fontSize:20,flexShrink:0,minWidth:20}}>≡</div>

        {/* Rank */}
        <div style={{minWidth:24,height:24,borderRadius:7,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:rank<3?13:10,fontWeight:800,color:"#fff",flexShrink:0}}>{medal}</div>

        {/* Avatar */}
        <div style={{position:"relative",flexShrink:0}} data-pal>
          <button onClick={e=>{e.stopPropagation();setPalette(v=>!v);}}
            style={{width:isMobile?32:36,height:isMobile?32:36,borderRadius:"50%",background:"rgba(255,255,255,0.16)",backdropFilter:"blur(4px)",border:"2px solid rgba(255,255,255,0.30)",color:"#fff",fontWeight:800,fontSize:isLeader?15:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {isLeader?<span style={{display:"inline-block",animation:"crown 1.4s ease-in-out infinite"}}>👑</span>:player.name[0].toUpperCase()}
          </button>
          {showPalette&&<div className="fade-in" data-pal onClick={e=>e.stopPropagation()}
            style={{position:"absolute",top:42,left:0,zIndex:30,background:dark?"#1c1f2e":"#fff",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:8,display:"flex",flexWrap:"wrap",gap:5,width:132,boxShadow:"0 9px 28px rgba(0,0,0,.48)"}}>
            {PALETTE.map(c=>(<button key={c.hex} className="cdot" onClick={()=>{onColorChange(c);setPalette(false);}} title={c.name} style={{background:c.hex,outline:player.color.hex===c.hex?`2px solid ${c.hex}`:"none",outlineOffset:player.color.hex===c.hex?2:0,transform:player.color.hex===c.hex?"scale(1.4)":"scale(1)"}}/>))}
          </div>}
        </div>

        {/* Name + history */}
        <div style={{minWidth:0,flex:"0 1 auto",maxWidth:isMobile?80:120}} data-nedit>
          {editName ? (
            <input ref={nameRef} className="name-edit-input" value={nameVal}
              onChange={e=>setNameVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitName();if(e.key==="Escape")setEditName(false);}}
              onBlur={commitName} onClick={e=>e.stopPropagation()}
              maxLength={20} aria-label="Renommer le joueur"/>
          ) : (
            <div onClick={onNameTap} title="Double-tap pour renommer"
              style={{fontWeight:700,fontSize:isMobile?12:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"default"}}>
              {player.name}
            </div>
          )}
          <div style={{fontSize:9,color:"rgba(255,255,255,0.40)",marginTop:1}}>
            {isLeader?"👑":isExAequo?"=":""} #{rank+1}
          </div>
          <PlayerMiniHistory entries={playerHistory} color={col} isMobile={isMobile}/>
        </div>

        {/* Score — tap=edit, long press=quick */}
        <div data-sedit style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",height:"100%",cursor:"text",minWidth:0,position:"relative"}}
          onPointerDown={onScorePD} onPointerUp={onScorePU}
          onPointerLeave={()=>clearTimeout(longT.current)}>
          {editScore ? (
            <input ref={editRef} className="score-input-edit" type="number"
              value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitScore();if(e.key==="Escape")setEditScore(false);}}
              onBlur={commitScore} onClick={e=>e.stopPropagation()}
              style={{fontSize:isMobile?28:34,width:isMobile?90:110}}/>
          ) : (
            <div key={flashKey} className="mono score-pop"
              style={{fontSize:isMobile?34:40,fontWeight:700,color:"#fff",letterSpacing:-1.5,lineHeight:1,
                textDecoration:"underline dotted rgba(255,255,255,0.22)",textUnderlineOffset:4,userSelect:"none"}}>
              {player.score>0?"+":""}{player.score}
            </div>
          )}
          {showQuick&&<QuickScorePopup onApply={onAdjust} onEdit={()=>{setEditVal(String(player.score));setEditScore(true);setTimeout(()=>{editRef.current?.focus();editRef.current?.select();},30);}} onClose={()=>setShowQuick(false)} color={col} isMobile={isMobile}/>}
        </div>

        {/* Gear */}
        <div data-gear style={{position:"absolute",right:isPlaying?(isMobile?6:10):(isMobile?28:34),top:"50%",transform:"translateY(-50%)",zIndex:5}}>
          <div className={showGearHint?"gear-hint-anim":""} style={{position:"relative"}}>
            <Gear onCommit={onCommit} size={GEAR_SZ} onFirstUse={onGearFirstUse} playerScore={player.score} playerColor={col}/>
            {showGearHint&&<div style={{position:"absolute",top:-24,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.85)",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 7px",borderRadius:5,whiteSpace:"nowrap",pointerEvents:"none",border:"1px solid rgba(255,255,255,0.15)"}}>↺ tourner !</div>}
          </div>
        </div>
        <div style={{width:GEAR_SZ+10,flexShrink:0}}/>

        {/* Remove */}
        {!isPlaying&&<button data-rm onClick={e=>{e.stopPropagation();onRemove();}} className="rm-btn"
          style={{width:22,height:22,borderRadius:6,border:"none",flexShrink:0,background:"rgba(255,255,255,0.09)",color:"rgba(255,255,255,0.38)",cursor:"pointer",fontSize:11,zIndex:6}}>✕</button>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  ONLINE MODAL
// ─────────────────────────────────────────────────────────
function OnlineModal({ onClose, D, isMobile, dark, onCreateGame, onJoinGame, onlineCode, isOnline, onLeave }) {
  const [joinCode, setJoinCode] = useState("");
  const [copying,  setCopying]  = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(onlineCode||"").then(() => { setCopying(true); setTimeout(()=>setCopying(false), 1800); });
  };

  return (
    <BottomSheet onClose={onClose} D={D} isMobile={isMobile} title="🌐 Partie en ligne" maxW={380}>
      {!supabase ? (
        <div style={{ padding:"16px 0", color:D.sub, fontSize:13, lineHeight:1.8 }}>
          <div style={{ fontSize:16, marginBottom:8 }}>⚠️ Supabase non configuré</div>
          Ajoutez <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans votre <code>.env.local</code>, puis relancez le serveur.
        </div>
      ) : isOnline ? (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:"rgba(34,197,94,0.10)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#4ade80", marginBottom:8, textTransform:"uppercase", letterSpacing:.8 }}>🟢 Partie en ligne active</div>
            <div style={{ fontSize:12, color:D.sub, marginBottom:10 }}>Partagez ce code pour inviter d'autres joueurs à rejoindre</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div className="mono" style={{ fontSize:28, fontWeight:900, color:D.acc, letterSpacing:4, flex:1 }}>{onlineCode}</div>
              <button onClick={copy} style={{ padding:"8px 14px", borderRadius:9, border:"none",
                background: copying?"#4ade80":"rgba(74,222,128,0.18)", color:copying?"#111":"#4ade80",
                fontWeight:700, fontSize:12, cursor:"pointer", transition:"all .2s" }}>
                {copying?"✓ Copié":"📋 Copier"}
              </button>
            </div>
          </div>
          <button onClick={onLeave} style={{ padding:"12px 0", borderRadius:11, border:"none",
            background:"rgba(239,68,68,0.15)", color:"#f87171",
            fontWeight:700, fontSize:14, cursor:"pointer", minHeight:46 }}>
            🚪 Quitter la partie en ligne
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button onClick={onCreateGame}
            style={{ padding:"14px 0", borderRadius:12, border:"none",
              background:`linear-gradient(135deg,${D.acc},#f97316)`, color:"#111",
              fontWeight:800, fontSize:15, cursor:"pointer", minHeight:50 }}>
            🚀 Créer une partie en ligne
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0" }}>
            <div style={{ flex:1, height:1, background:D.brd }}/>
            <span style={{ fontSize:11, color:D.sub, fontWeight:700 }}>OU</span>
            <div style={{ flex:1, height:1, background:D.brd }}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().slice(0,6))}
              placeholder="Code 6 chiffres…" aria-label="Code de partie"
              style={{ flex:1, padding:"12px 14px", borderRadius:11, border:`1px solid ${D.brd}`,
                background:D.ibg||D.bg, color:D.txt, fontSize:16, fontFamily:"Space Mono,monospace",
                letterSpacing:3, textAlign:"center", minHeight:50 }}/>
            <button onClick={()=>onJoinGame(joinCode)} disabled={joinCode.length<4}
              style={{ padding:"12px 18px", borderRadius:11, border:"none",
                background:joinCode.length>=4?"#3b82f6":"rgba(59,130,246,0.18)",
                color:joinCode.length>=4?"#fff":"#60a5fa",
                fontWeight:700, fontSize:14, cursor:joinCode.length>=4?"pointer":"default",
                minHeight:50 }}>
              Rejoindre
            </button>
          </div>
          <div style={{ fontSize:11, color:D.sub, textAlign:"center", lineHeight:1.7 }}>
            Tous les appareils rejoignant la même partie<br/>voient les scores en temps réel.
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────
//  MULTI-GAME PICKER
// ─────────────────────────────────────────────────────────
function GamePicker({ D, isMobile, dark, onClose, onLoad, onNew }) {
  const games = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("sgt7_saved") || "[]"); } catch { return []; }
  }, []);

  const del = (id) => {
    try {
      const updated = games.filter(g => g.id !== id);
      localStorage.setItem("sgt7_saved", JSON.stringify(updated));
    } catch {}
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} D={D} isMobile={isMobile} title="📂 Parties enregistrées" maxW={440}>
      <button onClick={onNew}
        style={{ width:"100%", padding:"12px 0", borderRadius:11, border:`1.5px dashed ${D.brd}`,
          background:"transparent", color:D.acc, fontWeight:700, fontSize:14,
          cursor:"pointer", marginBottom:12, minHeight:46 }}>
        ＋ Nouvelle partie vierge
      </button>
      {!games.length ? (
        <div style={{ textAlign:"center", padding:"24px 0", color:D.sub, fontSize:13 }}>
          Aucune partie sauvegardée
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {games.map(g => {
            const ps = (g.players||[]).length;
            const winner = [...(g.players||[])].sort((a,b)=>g.lowestWins?a.score-b.score:b.score-a.score)[0];
            return (
              <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10,
                padding:"12px 14px", borderRadius:12, border:`1px solid ${D.brd}`,
                background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)" }}>
                <button onClick={()=>onLoad(g)} style={{ flex:1, background:"none", border:"none",
                  cursor:"pointer", textAlign:"left", minHeight:44 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:D.txt }}>{g.name||"Partie"}</div>
                  <div style={{ fontSize:11, color:D.sub, marginTop:2 }}>
                    {ps} joueur{ps!==1?"s":""}
                    {winner&&<span style={{ color:D.acc }}> · 🏆 {winner.name}</span>}
                    {g.savedAt&&<span> · {new Date(g.savedAt).toLocaleDateString("fr-FR")}</span>}
                  </div>
                </button>
                <button onClick={()=>del(g.id)} style={{ width:30,height:30,borderRadius:8,border:"none",
                  background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontSize:14,flexShrink:0 }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────
export default function ScoreTracker() {
  const winW     = useWindowWidth();
  const isMobile = winW < 600;

  // ── Core state ──
  const [dark,     setDark]    = useState(()=>{try{const s=localStorage.getItem("sgt7dark");if(s!=null)return s==="true";}catch{}return window.matchMedia?.("(prefers-color-scheme: dark)").matches??true;});
  const [players,  setPlayers] = useState([]);
  const [savedNames,setSavedN] = useState(DEFAULT_NAMES);
  const [gameName, setGName]   = useState("Nouvelle partie 🎲");
  const [editName, setEditName]= useState(false);
  const [round,    setRound]   = useState(1);
  const [history,  setHist]    = useState([]);
  const [selected, setSelected]= useState(null);
  const [sessionLog,setSession]= useState([]);
  const [undo,     setUndo]    = useState([]);
  const [toast,    setToast]   = useState(null);
  const [tab,      setTab]     = useState("scores");
  const [gameState,setGameSt]  = useState("idle");
  const [gameWinner,setWinner] = useState(null);
  const [flashCt,  setFlashCt] = useState({});
  const [targetScore,setTarget]= useState(null);
  const [lowestWins,setLowest] = useState(false);
  const [maxRounds, setMaxRnd] = useState(null);
  const [gamePreset,setPreset] = useState(null);

  // ── Display order (FIXED — insertion order, no auto-resort) ──
  const [displayOrder, setDispOrder] = useState([]); // array of player IDs

  // ── UI state ──
  const [showHist,   setSH]       = useState(false);
  const [showReset,  setSR]       = useState(false);
  const [confirmRm,  setCR]       = useState(null);
  const [showTarget, setShowTgt]  = useState(false);
  const [targetInput,setTgtInput] = useState("");
  const [histFilter, setHFilter]  = useState("all");
  const [addBarOpen, setAddBar]   = useState(false);
  const [overflowOpen,setOvf]     = useState(false);
  const [showPreset, setShowPr]   = useState(false);
  const [showStats,  setShowSt]   = useState(false);
  const [showOnline, setShowOnl]  = useState(false);
  const [showPicker, setShowPk]   = useState(false);
  const [gearDone,   setGearDone] = useState(()=>{try{return localStorage.getItem("sgt7gear")==="1";}catch{}return false;});

  // ── Game ID & save ──
  const [gameId, setGameId] = useState(()=>uid());

  // ── Chrono ──
  const [gameStartTime, setGST]     = useState(null);
  const [elapsed,       setElapsed] = useState(0);

  // ── Online / Supabase ──
  const [isOnline,    setIsOnline]  = useState(false);
  const [onlineCode,  setOnlineCode]= useState(null);
  const [onlineStatus,setOnlineSt]  = useState(""); // "" | "connecting" | "connected" | "error"
  const processedEventsRef = useRef(new Set());
  const channelRef         = useRef(null);

  // ── Add player ──
  const [addQ,     setAddQ]     = useState("");
  const [addColor, setAddColor] = useState(PALETTE[0]);
  const [sugOpen,  setSugOpen]  = useState(false);
  const [sugs,     setSugs]     = useState([]);

  // ── Dice ──
  const [diceType,  setDType]  = useState(6);
  const [diceCount, setDCount] = useState(2);
  const [diceResult,setDRes]   = useState(null);
  const [diceVals,  setDVals]  = useState([]);
  const [rolling,   setRolling]= useState(false);
  const [diceHist,  setDHist]  = useState([]);
  const [wheelHist, setWHist]  = useState([]);

  // ── Drag ──
  const [dragging, setDragging] = useState(null);
  const dragSnapRef = useRef(null);
  const rowRefs     = useRef({});

  const toastRef   = useRef(null);
  const addRef     = useRef(null);
  const nameRef    = useRef(null);
  const playersRef = useRef(players);
  useEffect(()=>{ playersRef.current=players; },[players]);

  // ── Wake Lock ──
  useWakeLock(gameState === "playing");

  // ── Chrono ──
  useEffect(()=>{
    if(gameState==="playing" && !gameStartTime) setGST(Date.now());
    if(gameState!=="playing"){ return; }
    const iv=setInterval(()=>{ setElapsed(Math.floor((Date.now()-(gameStartTime||Date.now()))/1000)); },1000);
    return()=>clearInterval(iv);
  },[gameState,gameStartTime]);

  const fmtElapsed = (s) => { const m=Math.floor(s/60),sec=s%60; return `${m}:${String(sec).padStart(2,"0")}`; };

  // ── Dark ──
  useEffect(()=>{ try{localStorage.setItem("sgt7dark",String(dark));}catch{} },[dark]);

  // ── Persistence ──
  const saveGame = useCallback((extra={}) => {
    try {
      const data = { players:playersRef.current, gameName, round, history, diceHist, wheelHist,
        gameState, targetScore, lowestWins, maxRounds, gamePreset, displayOrder, id:gameId,
        savedAt:new Date().toISOString(), state:gameState, ...extra };
      localStorage.setItem("sgt7", JSON.stringify(data));
      // Multi-game save
      const saved = JSON.parse(localStorage.getItem("sgt7_saved")||"[]");
      const idx   = saved.findIndex(g=>g.id===gameId);
      if(idx>=0) saved[idx]=data; else saved.unshift(data);
      localStorage.setItem("sgt7_saved", JSON.stringify(saved.slice(0,12)));
    } catch {}
  },[gameName,round,history,diceHist,wheelHist,gameState,targetScore,lowestWins,maxRounds,gamePreset,displayOrder,gameId]);

  useEffect(()=>{ saveGame(); },[players,gameName,round,history,diceHist,wheelHist,gameState,targetScore,lowestWins,maxRounds,displayOrder]); // eslint-disable-line

  // ── Load on mount ──
  useEffect(()=>{
    try{
      const d=JSON.parse(localStorage.getItem("sgt7")||"{}");
      if(d.players)setPlayers(d.players);if(d.gameName)setGName(d.gameName);if(d.round)setRound(d.round);
      if(d.history)setHist(d.history);if(d.diceHist)setDHist(d.diceHist);if(d.wheelHist)setWHist(d.wheelHist);
      if(d.gameState)setGameSt(d.gameState);if(d.targetScore!=null)setTarget(d.targetScore);
      if(d.lowestWins!=null)setLowest(d.lowestWins);if(d.maxRounds!=null)setMaxRnd(d.maxRounds);
      if(d.gamePreset)setPreset(d.gamePreset);if(d.displayOrder)setDispOrder(d.displayOrder);
      if(d.id)setGameId(d.id);
      const n=JSON.parse(localStorage.getItem("sgt7n")||"null");if(n)setSavedN(n);
    }catch{}
  },[]);

  // ── Sync displayOrder when players change ──
  useEffect(()=>{
    setDispOrder(prev=>{
      const kept  = prev.filter(id=>players.find(p=>p.id===id));
      const added = players.filter(p=>!kept.includes(p.id)).map(p=>p.id);
      return [...kept,...added];
    });
  },[players.length]); // eslint-disable-line

  // ── Auto color ──
  useEffect(()=>{if(players.length>0){const u=new Set(players.map(p=>p.color.hex));setAddColor(PALETTE.find(c=>!u.has(c.hex))||PALETTE[0]);}},[players.length]); // eslint-disable-line

  // ── Clear session on deselect ──
  useEffect(()=>{setSession([]);},[selected]);

  // ── Auto-victory ──
  useEffect(()=>{
    if(targetScore===null||gameState!=="playing"||!players.length)return;
    const sorted=[...players].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score);
    const w=sorted[0];
    const won=lowestWins?w.score<=targetScore:w.score>=targetScore;
    if(won){setWinner(w);setGameSt("ended");playVictorySound();flash(`🏆 ${w.name} remporte la partie !`,w.color.hex);}
  },[players,targetScore,gameState,lowestWins]); // eslint-disable-line

  // ── Auto-round limit ──
  useEffect(()=>{
    if(maxRounds===null||gameState!=="playing"||round<maxRounds)return;
    const sorted=[...players].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score);
    setWinner(sorted[0]);setGameSt("ended");playVictorySound();
    flash(`🏆 Fin des ${maxRounds} manches — ${sorted[0].name} gagne !`,sorted[0].color.hex);
  },[round,maxRounds,gameState,players,lowestWins]); // eslint-disable-line

  // ── Toast ──
  const flash=useCallback((msg,bg)=>{ clearTimeout(toastRef.current);setToast({msg,bg});toastRef.current=setTimeout(()=>setToast(null),2600); },[]);
  const saveUndo=useCallback((snap)=>setUndo(u=>[...u.slice(-29),snap]),[]);
  const doUndo=useCallback(()=>{ if(!undo.length)return;setPlayers(undo[undo.length-1]);setUndo(u=>u.slice(0,-1));flash("Action annulée ↩"); },[undo,flash]);

  // ── Adjust (swipe, bonus, edit) ──
  const adjust=useCallback((id,delta)=>{
    if(!delta)return;
    if("vibrate"in navigator)navigator.vibrate(delta>0?22:[22,12,22]);
    const p=playersRef.current.find(x=>x.id===id);if(!p)return;
    const ns=p.score+delta,time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    saveUndo(playersRef.current);
    setPlayers(prev=>prev.map(x=>x.id===id?{...x,score:x.score+delta}:x));
    const entry={id,name:p.name,delta,score:ns,round,time};
    setHist(h=>{ const nh=[...h,entry]; return nh.length>MAX_HIST?nh.slice(-MAX_HIST):nh; });
    setFlashCt(f=>({...f,[id]:(f[id]||0)+1}));
    // Supabase sync
    if(isOnline&&supabase&&onlineCode){
      const evId=uid();processedEventsRef.current.add(evId);
      supabase.from("sgt_events").insert({id:evId,game_id:onlineCode,player_id:id,player_name:p.name,delta,score:ns,round,time}).then(()=>{}).catch(()=>{});
    }
  },[saveUndo,round,isOnline,onlineCode]);

  // ── Gear commit (1 entry for whole gesture) ──
  const gearCommit=useCallback((id,delta)=>{
    if(!delta)return;
    if("vibrate"in navigator)navigator.vibrate(35);
    const p=playersRef.current.find(x=>x.id===id);if(!p)return;
    const ns=p.score+delta,time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    saveUndo(playersRef.current);
    setPlayers(prev=>prev.map(x=>x.id===id?{...x,score:x.score+delta}:x));
    const entry={id,name:p.name,delta,score:ns,round,time};
    setHist(h=>{ const nh=[...h,entry]; return nh.length>MAX_HIST?nh.slice(-MAX_HIST):nh; });
    setFlashCt(f=>({...f,[id]:(f[id]||0)+1}));
    if(isOnline&&supabase&&onlineCode){
      const evId=uid();processedEventsRef.current.add(evId);
      supabase.from("sgt_events").insert({id:evId,game_id:onlineCode,player_id:id,player_name:p.name,delta,score:ns,round,time}).then(()=>{}).catch(()=>{});
    }
  },[saveUndo,round,isOnline,onlineCode]);

  // ── Rename player ──
  const renamePlayer=useCallback((id,newName)=>{
    if(!newName)return;
    setPlayers(prev=>prev.map(p=>p.id===id?{...p,name:newName}:p));
    flash(`✏️ Renommé en ${newName}`);
    if(isOnline&&supabase&&onlineCode){
      supabase.from("sgt_players").update({name:newName}).eq("id",id).eq("game_id",onlineCode).then(()=>{}).catch(()=>{});
    }
  },[flash,isOnline,onlineCode]);

  // ── Keyboard ──
  useEffect(()=>{
    const h=(e)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey){e.preventDefault();doUndo();return;}
      if(e.key==="Escape"){if(overflowOpen){setOvf(false);return;}if(selected){setSelected(null);return;}}
      if(selected&&!e.target.matches("input,textarea,select")){
        if(e.key==="ArrowUp"){e.preventDefault();adjust(selected,1);}
        if(e.key==="ArrowDown"){e.preventDefault();adjust(selected,-1);}
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[doUndo,selected,adjust,overflowOpen]);

  // ── Add player ──
  const addPlayer=useCallback((name=addQ.trim())=>{
    if(!name)return;
    if(playersRef.current.find(p=>p.name.toLowerCase()===name.toLowerCase())){flash(`${name} est déjà là !`);return;}
    const p={id:uid(),name,color:addColor,score:0};
    saveUndo(playersRef.current);
    const next=[...playersRef.current,p];setPlayers(next);
    const u=new Set(next.map(pp=>pp.color.hex));setAddColor(PALETTE.find(c=>!u.has(c.hex))||PALETTE[0]);
    if(!savedNames.includes(name)){const nn=[...savedNames,name];setSavedN(nn);try{localStorage.setItem("sgt7n",JSON.stringify(nn));}catch{}}
    setAddQ("");setSugOpen(false);flash(`${name} rejoint la partie !`,addColor.hex);
    if(isOnline&&supabase&&onlineCode){
      supabase.from("sgt_players").insert({id:p.id,game_id:onlineCode,name,color_hex:addColor.hex,color_name:addColor.name,score:0,position:next.length-1}).then(()=>{}).catch(()=>{});
    }
  },[addQ,addColor,saveUndo,savedNames,flash,isOnline,onlineCode]);

  const removePlayer=useCallback((id)=>{saveUndo(playersRef.current);setPlayers(p=>p.filter(x=>x.id!==id));if(selected===id)setSelected(null);setCR(null);},[saveUndo,selected]);
  const changeColor=useCallback((id,color)=>setPlayers(p=>p.map(x=>x.id===id?{...x,color}:x)),[]);

  const onQ=(v)=>{setAddQ(v);if(!v.trim()){setSugs([]);setSugOpen(false);return;}const q=v.toLowerCase();const r=savedNames.filter(n=>n.toLowerCase().includes(q)&&!playersRef.current.find(p=>p.name.toLowerCase()===n.toLowerCase())).slice(0,8);setSugs(r);setSugOpen(r.length>0);};

  const doReset=useCallback(()=>{saveUndo(playersRef.current);setPlayers(p=>p.map(x=>({...x,score:0})));setHist([]);setRound(1);setSR(false);setGameSt("idle");setWinner(null);setGST(null);setElapsed(0);flash("Scores remis à zéro 🔄");},[saveUndo,flash]);

  // ── Preset selection ──
  const applyPreset=useCallback((preset)=>{
    setGName(preset.name==="Personnalisé"?gameName:preset.name);
    setTarget(preset.targetScore);setLowest(preset.lowestWins);setMaxRnd(preset.maxRounds);
    setPreset(preset.id);setShowPr(false);
    flash(`Préset ${preset.name} appliqué ${preset.emoji}`);
  },[gameName,flash]);

  // ── Game lifecycle ──
  const startGame=()=>{
    if(players.length<2){flash("Il faut au moins 2 joueurs !");return;}
    if(!gamePreset){setShowPr(true);return;}
    setGameSt("playing");setAddBar(false);setGST(Date.now());setElapsed(0);
    flash("La partie a commencé ! 🎮","#16a34a");
  };
  const endGame=useCallback(()=>{
    const s=[...playersRef.current].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score);
    setWinner(s[0]);setGameSt("ended");playVictorySound();
    saveGame({state:"ended"});
  },[lowestWins,saveGame]);

  // ── New game ──
  const newGame=useCallback(()=>{
    saveUndo(playersRef.current);
    // Garde les joueurs mais remet les scores à 0
    setPlayers(p=>p.map(x=>({...x,score:0})));
    setGName("Nouvelle partie 🎲");setRound(1);setHist([]);setGameSt("idle");
    setWinner(null);setTarget(null);setLowest(false);setMaxRnd(null);setPreset(null);
    setSelected(null);setSession([]);
    setGST(null);setElapsed(0);setGameId(uid());
    flash("Nouvelle partie — scores remis à zéro ! 🔄");
  },[saveUndo,flash]);

  // ── Load saved game ──
  const loadGame=useCallback((g)=>{
    if(g.players)setPlayers(g.players);if(g.gameName)setGName(g.gameName);if(g.round)setRound(g.round);
    if(g.history)setHist(g.history);if(g.gameState)setGameSt(g.gameState);if(g.targetScore!=null)setTarget(g.targetScore);
    if(g.lowestWins!=null)setLowest(g.lowestWins);if(g.maxRounds!=null)setMaxRnd(g.maxRounds);
    if(g.gamePreset)setPreset(g.gamePreset);if(g.displayOrder)setDispOrder(g.displayOrder);
    if(g.id)setGameId(g.id);
    setShowPk(false);flash(`Partie "${g.name||"?"}" chargée`);
  },[flash]);

  // ── Copy résumé ──
  const copyResume=useCallback(()=>{
    const lines=[...players].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score).map((p,i)=>`${i<3?MEDALS[i]:`#${i+1}`} ${p.name} : ${p.score>0?"+":""}${p.score} pts`);
    const txt=`${gameName}\nRound ${round} — ${new Date().toLocaleDateString("fr-FR")}\n\n${lines.join("\n")}`;
    navigator.clipboard?.writeText(txt).then(()=>flash("Résumé copié ! 📋")).catch(()=>flash("Échec copie"));
  },[players,gameName,round,lowestWins,flash]);

  const applyTarget=()=>{const n=parseInt(targetInput,10);if(!isNaN(n)&&n>0){setTarget(n);flash(`Objectif : ${n} pts 🎯`);}else{setTarget(null);flash("Objectif supprimé");}setShowTgt(false);setTgtInput("");};

  const exportCSV=()=>{
    const s=[...players].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score);
    let csv=`Partie,${gameName}\nDate,${new Date().toLocaleDateString("fr-FR")}\nRound,${round}\n\nRang,Joueur,Score\n`;
    s.forEach((p,i)=>{csv+=`${i+1},${p.name},${p.score}\n`;});csv+="\nHistorique\nRound,Joueur,Delta,Score,Heure\n";
    history.forEach(e=>{csv+=`${e.round},${e.name},${e.delta>0?"+":""}${e.delta},${e.score},${e.time}\n`;});
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);
    Object.assign(document.createElement("a"),{href:url,download:`${gameName.replace(/\s+/g,"_")}.csv`}).click();URL.revokeObjectURL(url);flash("CSV téléchargé ✓");
  };

  // ── Dice ──
  const rollDice=()=>{
    if(rolling)return;setRolling(true);setDRes(null);let n=0;
    const land=(vals,total)=>{setDVals(vals);setDRes(total);setRolling(false);playDiceSound();const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});setDHist(h=>[{id:uid(),diceType,diceCount,values:vals,total,time},...h].slice(0,50));};
    if(diceType===100){const iv=setInterval(()=>{const t=Math.floor(Math.random()*10)*10,u=Math.ceil(Math.random()*10);setDVals([t,u]);n++;if(n>14){clearInterval(iv);const ft=Math.floor(Math.random()*10)*10,fu=Math.ceil(Math.random()*10);land([ft,fu],ft+fu);}},80);return;}
    const iv=setInterval(()=>{setDVals(Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType)));n++;if(n>14){clearInterval(iv);const vals=Array.from({length:diceCount},()=>Math.ceil(Math.random()*diceType));land(vals,vals.reduce((a,b)=>a+b,0));}},80);
  };

  const handleWheel=(w)=>{const time=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});setWHist(h=>[{id:uid(),name:w.name,color:w.color.hex,time,date:new Date().toLocaleDateString("fr-FR")},...h].slice(0,10));};
  const dismissGear=useCallback(()=>{setGearDone(true);try{localStorage.setItem("sgt7gear","1");}catch{}},[]);

  // ── Supabase online ──
  const subscribeToGame=useCallback((gameId)=>{
    if(!supabase)return;
    const ch=supabase.channel(`sgt:${gameId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"sgt_events",filter:`game_id=eq.${gameId}`},payload=>{
        const ev=payload.new;
        if(processedEventsRef.current.has(ev.id))return;
        processedEventsRef.current.add(ev.id);
        setPlayers(prev=>prev.map(p=>p.id===ev.player_id?{...p,score:ev.score}:p));
        setHist(h=>{const nh=[...h,{id:ev.player_id,name:ev.player_name,delta:ev.delta,score:ev.score,round:ev.round,time:ev.time}];return nh.length>MAX_HIST?nh.slice(-MAX_HIST):nh;});
        setFlashCt(f=>({...f,[ev.player_id]:(f[ev.player_id]||0)+1}));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"sgt_players",filter:`game_id=eq.${gameId}`},payload=>{
        const p=payload.new;
        setPlayers(prev=>{if(prev.find(x=>x.id===p.id))return prev;return[...prev,{id:p.id,name:p.name,color:{hex:p.color_hex,name:p.color_name||""},score:p.score}];});
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"sgt_players",filter:`game_id=eq.${gameId}`},payload=>{
        const p=payload.new;setPlayers(prev=>prev.map(x=>x.id===p.id?{...x,name:p.name}:x));
      })
      .subscribe(s=>{setOnlineSt(s==="SUBSCRIBED"?"connected":s==="CHANNEL_ERROR"?"error":"connecting");});
    channelRef.current=ch;
  },[]);

  const createOnlineGame=useCallback(async()=>{
    if(!supabase)return;setOnlineSt("connecting");
    try{
      const gId=uid().slice(0,6).toUpperCase();
      await supabase.from("sgt_games").insert({id:gId,name:gameName,state:gameState,round,target_score:targetScore,lowest_wins:lowestWins});
      for(const p of playersRef.current){
        await supabase.from("sgt_players").insert({id:p.id,game_id:gId,name:p.name,color_hex:p.color.hex,color_name:p.color.name,score:p.score,position:displayOrder.indexOf(p.id)});
      }
      setOnlineCode(gId);setIsOnline(true);subscribeToGame(gId);setShowOnl(false);
      flash(`Partie en ligne créée — code : ${gId} 🌐`,"#4ade80");
    }catch(e){setOnlineSt("error");flash("Erreur de connexion");}
  },[gameName,gameState,round,targetScore,lowestWins,displayOrder,subscribeToGame,flash]);

  const joinOnlineGame=useCallback(async(code)=>{
    if(!supabase||!code)return;const gId=code.toUpperCase();setOnlineSt("connecting");
    try{
      const{data:game,error}=await supabase.from("sgt_games").select().eq("id",gId).single();
      if(error||!game){flash("Code introuvable");setOnlineSt("error");return;}
      const{data:ps}=await supabase.from("sgt_players").select().eq("game_id",gId).order("position");
      const{data:evs}=await supabase.from("sgt_events").select().eq("game_id",gId).order("created_at");
      const pMap={};(ps||[]).forEach(p=>{pMap[p.id]={id:p.id,name:p.name,color:{hex:p.color_hex,name:p.color_name||""},score:p.score};});
      (evs||[]).forEach(e=>{processedEventsRef.current.add(e.id);if(pMap[e.player_id])pMap[e.player_id].score=e.score;});
      const pArr=Object.values(pMap);
      setPlayers(pArr);setGName(game.name);setRound(game.round||1);
      if(game.target_score!=null)setTarget(game.target_score);
      if(game.lowest_wins!=null)setLowest(game.lowest_wins);
      setOnlineCode(gId);setIsOnline(true);subscribeToGame(gId);setShowOnl(false);
      flash(`Rejoint la partie ${gId} ! 🌐`,"#4ade80");
    }catch{flash("Erreur de connexion");setOnlineSt("error");}
  },[subscribeToGame,flash]);

  const leaveOnline=useCallback(()=>{
    if(channelRef.current)supabase?.removeChannel(channelRef.current);
    channelRef.current=null;setIsOnline(false);setOnlineCode(null);setOnlineSt("");
    flash("Déconnecté de la partie en ligne");
  },[flash]);

  // ── Drag reorder ──
  const startDrag=useCallback((e,id)=>{const bO=displayOrder.filter(xid=>players.find(p=>p.id===xid));const snap={};bO.forEach(bid=>{const el=rowRefs.current[bid];if(el){const r=el.getBoundingClientRect();snap[bid]=r.top+r.height/2;}});dragSnapRef.current={order:bO,midpoints:snap};setDragging({id,overIdx:bO.indexOf(id),baseOrder:bO});},[displayOrder,players]);
  const moveDrag=useCallback((e)=>{if(!dragging||!dragSnapRef.current)return;const y=e.clientY;const{order,midpoints}=dragSnapRef.current;let ni=0;for(let i=0;i<order.length;i++){if(midpoints[order[i]]!==undefined&&y>midpoints[order[i]])ni=i+1;}ni=Math.max(0,Math.min(ni,order.length-1));if(ni!==dragging.overIdx)setDragging(p=>p?{...p,overIdx:ni}:null);},[dragging]);
  const endDrag=useCallback(()=>{if(dragging){const arr=[...dragging.baseOrder];const f=arr.indexOf(dragging.id);arr.splice(f,1);arr.splice(Math.min(dragging.overIdx,arr.length),0,dragging.id);setDispOrder(arr);}setDragging(null);dragSnapRef.current=null;},[dragging]);

  // ── Derived ──
  // Score-sorted (for rank badges, leaderboard)
  const scoreSorted = useMemo(()=>[...players].sort((a,b)=>lowestWins?a.score-b.score:b.score-a.score),[players,lowestWins]);
  const rankMap     = useMemo(()=>Object.fromEntries(scoreSorted.map((p,i)=>[p.id,i])),[scoreSorted]);
  const leader      = scoreSorted[0];
  const topScore    = leader?.score??0;
  const leaders     = players.filter(p=>p.score===topScore&&players.length>1);
  const isExAequo   = leaders.length>1;

  // Display order — FIXED (insertion/drag order, never auto-resorted by score)
  const curOrder = useMemo(()=>{
    if(dragging){const arr=[...dragging.baseOrder];const f=arr.indexOf(dragging.id);arr.splice(f,1);arr.splice(Math.min(dragging.overIdx,arr.length),0,dragging.id);return arr;}
    return displayOrder.filter(id=>players.find(p=>p.id===id));
  },[dragging,displayOrder,players]);

  const selPlayer  = players.find(p=>p.id===selected);
  const isPlaying  = gameState==="playing";
  const isEnded    = gameState==="ended";
  const histByP    = useMemo(()=>{const m={};history.forEach(h=>{if(!m[h.id])m[h.id]=[];m[h.id].push(h);});return m;},[history]);
  const sessTotal  = sessionLog.reduce((a,b)=>a+b,0);
  const sessStr    = sessionLog.length?sessionLog.map(v=>(v>0?"+":"")+v).join(" ")+" = "+(sessTotal>=0?"+":"")+sessTotal:null;
  const dragHandlers={onDown:startDrag,onMove:moveDrag,onUp:endDrag};

  const bonusBarH = selPlayer&&tab==="scores"?(isMobile?192:182):0;
  const addBarH   = tab==="scores"?(isMobile?70:64):0;
  const bottomPad = bonusBarH+addBarH+16;

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

  const TABS=[
    {key:"scores",label:isMobile?"🏆":"🏆 Scores"},
    {key:"dice",  label:isMobile?"🎲":"🎲 Dés"},
    {key:"wheel", label:isMobile?"🎡":"🎡 Roue"},
    {key:"timer", label:isMobile?"⏳":"⏳ Sablier"},
  ];

  const overflowActions=[
    {icon:"↩",  label:"Annuler",          action:doUndo,                     disabled:!undo.length},
    {icon:"📋", label:"Historique",        action:()=>{setSH(true);setOvf(false);}},
    {icon:"📤", label:"Copier résumé",     action:()=>{copyResume();setOvf(false);},disabled:!players.length},
    {icon:"CSV",label:"Exporter CSV",      action:()=>{exportCSV();setOvf(false);}},
    {icon:"🎯", label:"Score objectif",    action:()=>{setTgtInput(targetScore!=null?String(targetScore):"");setShowTgt(true);setOvf(false);}},
    {icon:"🎮", label:"Choisir le jeu",   action:()=>{setShowPr(true);setOvf(false);}},
    {icon:"📂", label:"Parties sauveg.",  action:()=>{setShowPk(true);setOvf(false);}},
    {icon:"📈", label:"Stats inter-parties",action:()=>{setShowSt(true);setOvf(false);}},
    {icon:isOnline?"🔴":"🌐",label:isOnline?"Partie en ligne ✓":"Jouer en ligne",action:()=>{setShowOnl(true);setOvf(false);}},
    {icon:"🔄", label:"Remettre à zéro",  action:()=>{setSR(true);setOvf(false);}},
  ];

  return(
    <div style={{minHeight:"100dvh",background:D.bg,color:D.txt,fontFamily:"'Sora',sans-serif",transition:"background .3s",cursor:dragging?"grabbing":"auto"}}>
      <style>{GLOBAL_CSS}</style>

      {/* ════ HEADER ════ */}
      <header style={{position:"sticky",top:0,zIndex:40,background:D.hbg,backdropFilter:"blur(16px)",borderBottom:`1px solid ${D.brd}`}}>
        {isMobile?(
          <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:18,flexShrink:0}} aria-hidden>🎲</span>
            <div style={{flex:1,minWidth:0}}>
              {editName
                ?<input ref={nameRef} value={gameName} onChange={e=>setGName(e.target.value)} onBlur={()=>setEditName(false)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditName(false);}} autoFocus style={{background:"transparent",border:"none",borderBottom:`2px solid ${D.acc}`,fontWeight:800,fontSize:14,color:D.txt,width:"100%",paddingBottom:1}}/>
                :<div onClick={()=>setEditName(true)} role="button" style={{fontWeight:800,fontSize:14,color:D.txt,cursor:"text",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{gameName}</span>
                  <span style={{fontSize:10,color:D.sub,flexShrink:0}} aria-hidden>✏️</span>
                </div>
              }
              <div style={{fontSize:10,color:D.sub,marginTop:1,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                {players.length} joueur{players.length!==1?"s":""} · R{round}
                {isPlaying&&<span style={{color:"#22c55e"}}>● En jeu {gameStartTime?`· ${fmtElapsed(elapsed)}`:""}</span>}
                {isEnded&&<span style={{color:D.acc}}>● Terminée</span>}
                {targetScore!=null&&<span style={{color:D.acc}}>🎯{targetScore}</span>}
                {isOnline&&<span style={{color:"#4ade80",fontSize:9}}>🌐{onlineCode}</span>}
                {lowestWins&&<span style={{color:"#60a5fa",fontSize:9}}>↓min</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <button onClick={()=>setRound(r=>Math.max(1,r-1))} style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14,fontWeight:800}}>−</button>
              <span className="mono" style={{fontSize:11,color:D.sub,minWidth:18,textAlign:"center"}}>R{round}</span>
              <button onClick={()=>setRound(r=>r+1)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14,fontWeight:800}}>+</button>
            </div>
            {gameState==="idle"&&players.length>=2&&<button onClick={startGame} style={{padding:"7px 11px",borderRadius:9,border:"none",background:"#16a34a",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,minHeight:36}}>▶</button>}
            {isPlaying&&<button onClick={endGame} style={{padding:"7px 11px",borderRadius:9,border:"none",background:"#ef4444",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,minHeight:36}}>⏹</button>}
            {isEnded&&<button onClick={newGame} style={{padding:"7px 11px",borderRadius:9,border:"none",background:D.acc,color:"#111",cursor:"pointer",fontWeight:800,fontSize:12,flexShrink:0,minHeight:36}}>🔁</button>}
            <button onClick={()=>setDark(!dark)} style={{width:36,height:36,borderRadius:9,border:`1px solid ${D.brd}`,background:"transparent",cursor:"pointer",fontSize:15,flexShrink:0}}>{dark?"☀️":"🌙"}</button>
            <button onClick={()=>setOvf(o=>!o)} aria-expanded={overflowOpen}
              style={{width:36,height:36,borderRadius:9,border:`1px solid ${overflowOpen?D.acc:D.brd}`,background:overflowOpen?D.acc+"22":"transparent",color:overflowOpen?D.acc:D.sub,cursor:"pointer",fontSize:20,fontWeight:900,flexShrink:0}}>⋯</button>
          </div>
        ):(
          <div style={{maxWidth:900,margin:"0 auto",padding:"9px 16px",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <span style={{fontSize:20,flexShrink:0}} aria-hidden>🎲</span>
            <div style={{flex:1,minWidth:0}}>
              {editName?<input ref={nameRef} value={gameName} onChange={e=>setGName(e.target.value)} onBlur={()=>setEditName(false)} onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")setEditName(false);}} autoFocus style={{background:"transparent",border:"none",borderBottom:`2px solid ${D.acc}`,fontWeight:800,fontSize:13,color:D.txt,width:"100%",paddingBottom:2}}/>
                :<div onClick={()=>setEditName(true)} role="button" style={{fontWeight:800,fontSize:13,color:D.txt,cursor:"text",display:"flex",alignItems:"center",gap:5}}>{gameName}<span style={{fontSize:10,color:D.sub}} aria-hidden>✏️</span></div>}
              <div style={{fontSize:10,color:D.sub,marginTop:1,display:"flex",gap:8,alignItems:"center"}}>
                {players.length} joueur{players.length!==1?"s":""} · Round {round}
                {isPlaying&&<span style={{color:"#22c55e"}}>● En jeu · ⏱ {fmtElapsed(elapsed)}</span>}
                {isEnded&&<span style={{color:D.acc}}>● Terminée</span>}
                {targetScore!=null&&<span style={{color:D.acc}}>🎯 {targetScore}</span>}
                {isOnline&&<span style={{color:"#4ade80"}}>🌐 {onlineCode} — {onlineStatus==="connected"?"✓ connecté":"…"}</span>}
                {lowestWins&&<span style={{color:"#60a5fa"}}>↓ min gagne</span>}
                {maxRounds!=null&&<span>· {maxRounds} manches</span>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:2}}>
              <button onClick={()=>setRound(r=>Math.max(1,r-1))} className="hdr-btn" style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>−</button>
              <span className="mono" style={{fontSize:10,color:D.sub,minWidth:22,textAlign:"center"}}>R{round}</span>
              <button onClick={()=>setRound(r=>r+1)} className="hdr-btn" style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>+</button>
            </div>
            <div style={{width:1,height:18,background:D.brd}}/>
            {[
              {l:"↩", al:"Annuler (Ctrl+Z)", fn:doUndo, dis:!undo.length},
              {l:"📋",al:"Historique",        fn:()=>setSH(true)},
              {l:"📤",al:"Copier résumé",     fn:copyResume, dis:!players.length},
              {l:"CSV",al:"Exporter CSV",      fn:exportCSV},
              {l:"🎯",al:"Score objectif",     fn:()=>{setTgtInput(targetScore!=null?String(targetScore):"");setShowTgt(true);}},
              {l:"🎮",al:"Choisir le jeu",    fn:()=>setShowPr(true)},
              {l:"📂",al:"Parties sauveg.",   fn:()=>setShowPk(true)},
              {l:"📈",al:"Stats inter-parties",fn:()=>setShowSt(true)},
              {l:isOnline?"🌐✓":"🌐",al:"Jouer en ligne",fn:()=>setShowOnl(true)},
              {l:"🔄",al:"Remettre à zéro",   fn:()=>setSR(true)},
            ].map(({l,al,fn,dis})=>(
              <button key={l} onClick={fn} disabled={dis} aria-label={al} className="hdr-btn"
                style={{padding:"4px 7px",borderRadius:7,border:`1px solid ${D.brd}`,background:"transparent",color:dis?D.sub+"44":D.sub,cursor:dis?"default":"pointer",fontSize:11,fontWeight:700,minHeight:32}}>
                {l}
              </button>
            ))}
            <div style={{width:1,height:18,background:D.brd}}/>
            {gameState==="idle"&&players.length>=2&&<button onClick={startGame} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#16a34a",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>▶ Débuter</button>}
            {isPlaying&&<button onClick={endGame} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#ef4444",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>⏹ Terminer</button>}
            {isEnded&&<button onClick={newGame} style={{padding:"5px 12px",borderRadius:8,border:"none",background:D.acc,color:"#111",cursor:"pointer",fontWeight:700,fontSize:11}}>🔁 Nouvelle</button>}
            <button onClick={()=>setDark(!dark)} style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",cursor:"pointer",fontSize:14,flexShrink:0}}>{dark?"☀️":"🌙"}</button>
          </div>
        )}
        {/* Tabs */}
        <div style={{maxWidth:900,margin:"0 auto",padding:`0 ${isMobile?8:16}px`}}>
          <div className="tabs-scroll">
            {TABS.map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)} aria-selected={tab===t.key} role="tab"
                style={{padding:isMobile?"8px 16px":"7px 16px",border:"none",borderRadius:"10px 10px 0 0",background:tab===t.key?D.card:"transparent",color:tab===t.key?D.txt:D.sub,fontWeight:tab===t.key?800:600,fontSize:isMobile?13:11,cursor:"pointer",borderBottom:tab===t.key?`2px solid ${D.acc}`:"2px solid transparent",minHeight:36}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Overflow menu */}
      {overflowOpen&&isMobile&&(
        <div className="overlay fade-in" onClick={()=>setOvf(false)}>
          <div className="slide-up-sheet safe-bottom" onClick={e=>e.stopPropagation()}
            style={{position:"fixed",bottom:0,left:0,right:0,zIndex:55,background:D.card,borderRadius:"22px 22px 0 0",padding:"14px 12px 12px",maxHeight:"80dvh",overflowY:"auto"}}>
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(128,128,128,0.3)",margin:"0 auto 14px"}}/>
            <div style={{fontWeight:800,fontSize:16,marginBottom:10,paddingLeft:6}}>Actions</div>
            {overflowActions.map(({icon,label,action,disabled})=>(
              <button key={label} className="overflow-menu-item" onClick={action} disabled={disabled}
                style={{color:disabled?D.sub+"55":D.txt,opacity:disabled?.5:1}}>
                <span style={{fontSize:18,minWidth:28}}>{icon}</span><span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Winner banner */}
      {isEnded&&gameWinner&&(
        <div className="slide-up" role="status" style={{background:`linear-gradient(135deg,${gameWinner.color.hex},${gameWinner.color.hex}99)`,padding:"18px 20px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:4}}>🏆</div>
          <div style={{fontWeight:800,fontSize:isMobile?18:20,color:"#fff",marginBottom:3}}>{gameWinner.name} remporte la partie !</div>
          <div className="mono" style={{fontSize:isMobile?22:26,color:"rgba(255,255,255,0.88)"}}>{gameWinner.score>0?"+":""}{gameWinner.score} pts</div>
        </div>
      )}

      <main style={{maxWidth:900,margin:"0 auto",padding:`12px ${isMobile?8:12}px ${bottomPad}px`,overflow:"visible"}}>

        {/* ═══ SCORES ═══ */}
        {tab==="scores"&&(
          <div style={{overflow:"visible"}}>
            {!players.length&&(
              <div style={{textAlign:"center",padding:isMobile?"48px 16px 20px":"70px 20px 24px",color:D.sub}}>
                <div style={{fontSize:56,opacity:.6,lineHeight:1,marginBottom:12}}>🎯</div>
                <div style={{fontSize:isMobile?16:19,fontWeight:800,color:D.txt,marginBottom:8}}>Prêt pour la partie ?</div>
                <div style={{fontSize:13,lineHeight:2,color:D.sub}}>
                  Ajoutez des joueurs ci-dessous · <strong style={{color:D.txt}}>Glissez</strong> gauche/droite → ±1<br/>
                  <strong style={{color:D.txt}}>Tournez la molette</strong> → grands ajustements (bubble live)<br/>
                  <strong style={{color:D.txt}}>Tap score</strong> → saisie directe · <strong style={{color:D.txt}}>Long press score</strong> → ±rapides<br/>
                  <strong style={{color:D.txt}}>Double-tap nom</strong> → renommer · <strong style={{color:D.txt}}>≡</strong> → réordonner
                </div>
              </div>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:isMobile?9:13,overflow:"visible"}}>
              {curOrder.map(id=>{
                const player=players.find(p=>p.id===id);if(!player)return null;
                const rank=rankMap[player.id]??0;
                const isL=!isExAequo&&player.id===leader?.id&&players.length>1&&topScore!==0;
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
                    onRename={n=>renamePlayer(player.id,n)}
                    playerHistory={histByP[player.id]||[]}
                    showGearHint={!gearDone&&rank===0&&players.length>0}
                    onGearFirstUse={dismissGear}
                    dragHandlers={dragHandlers}
                    isDragging={dragging?.id===player.id}
                    rowRef={el=>{rowRefs.current[player.id]=el;}}
                  />
                );
              })}
            </div>

            {players.length>1&&<MiniLeaderboard players={players} lowestWins={lowestWins} targetScore={targetScore} D={D} dark={dark} isMobile={isMobile}/>}
          </div>
        )}

        {/* ═══ DÉS ═══ */}
        {tab==="dice"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?13:16}}>
              <div style={{fontSize:11,fontWeight:700,color:D.sub,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Type de dé</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {DICE_TYPES.map(d=>(<button key={d} className="die-sel-btn" onClick={()=>setDType(d)} aria-pressed={diceType===d} style={{background:diceType===d?D.acc:dark?"#1a1d27":"#eee",color:diceType===d?dark?"#111":"#fff":D.txt,padding:"10px 13px",fontSize:isMobile?13:14,minHeight:44}}>D{d}</button>))}
              </div>
            </div>
            {diceType!==100&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?13:16,display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>Nombre</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:"auto"}}>
                  <button onClick={()=>setDCount(c=>Math.max(1,c-1))} style={{width:44,height:44,borderRadius:10,border:"none",background:"rgba(239,68,68,0.14)",color:"#f87171",cursor:"pointer",fontWeight:900,fontSize:20}}>−</button>
                  <span className="mono" style={{fontSize:26,fontWeight:800,color:D.txt,minWidth:30,textAlign:"center"}}>{diceCount}</span>
                  <button onClick={()=>setDCount(c=>Math.min(10,c+1))} style={{width:44,height:44,borderRadius:10,border:"none",background:"rgba(34,197,94,0.14)",color:"#4ade80",cursor:"pointer",fontWeight:900,fontSize:20}}>+</button>
                </div>
              </div>
            )}
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?16:22,textAlign:"center"}}>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",minHeight:76,alignItems:"center",marginBottom:14}}>
                {!diceVals.length?<div style={{color:D.sub,fontSize:14}}>Lancez les dés !</div>
                  :diceType===100&&diceVals.length>=2?(<div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={10} value={diceVals[0]} size={isMobile?68:82} color="#6366f1" rolling={rolling} percentile/></div>
                    <span style={{fontSize:20,fontWeight:900,color:"rgba(255,255,255,.5)"}}>+</span>
                    <div className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={10} value={diceVals[1]} size={isMobile?68:82} color="#7c3aed" rolling={rolling}/></div>
                  </div>)
                  :diceVals.map((v,i)=>(<div key={i} className={!rolling&&diceResult!=null?"die-land":""}><DieFace sides={diceType} value={v} size={isMobile?68:82} color="#6366f1" rolling={rolling}/></div>))
                }
              </div>
              {diceResult!=null&&!rolling&&(
                <div className="slide-up" style={{marginBottom:12}}>
                  <div className="mono" aria-live="polite" style={{fontSize:isMobile?36:44,fontWeight:800,color:D.acc}}>{diceResult}</div>
                  {diceCount>1&&diceType!==100&&<div style={{fontSize:11,color:D.sub}}>[{diceVals.join(" + ")}]</div>}
                  {/* Appliquer au joueur sélectionné */}
                  {selPlayer&&(
                    <button onClick={()=>{adjust(selPlayer.id,diceResult);flash(`+${diceResult} pts → ${selPlayer.name}`,selPlayer.color.hex);}}
                      style={{marginTop:10,padding:"9px 20px",borderRadius:10,border:"none",background:`${selPlayer.color.hex}22`,color:selPlayer.color.hex,fontWeight:700,fontSize:13,cursor:"pointer",border:`1px solid ${selPlayer.color.hex}44`,minHeight:40}}>
                      +{diceResult} → {selPlayer.name}
                    </button>
                  )}
                </div>
              )}
              <button onClick={rollDice} disabled={rolling}
                style={{padding:"13px 34px",borderRadius:13,border:"none",background:rolling?"#6b7280":`linear-gradient(135deg,${D.acc},#ef4444)`,color:dark?"#111":"#fff",fontWeight:800,fontSize:15,cursor:rolling?"not-allowed":"pointer",minHeight:50}}>
                {rolling?"🎲 En cours…":`🎲 Lancer ${diceType===100?"D100":(diceCount>1?`${diceCount}×D${diceType}`:`D${diceType}`)}`}
              </button>
            </div>
            {diceHist.length>0&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?12:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                  <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>📋 Historique</div>
                  <button onClick={()=>setDHist([])} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11,minHeight:32}}>Effacer</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
                  {diceHist.map(e=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:9,background:dark?"#ffffff03":"#00000003"}}>
                    <span style={{flex:1,fontSize:12,color:D.sub}}>{e.diceType===100?`D100→[${e.values[0]===0?"00":e.values[0]}+${e.values[1]===10?0:e.values[1]}]`:`${e.diceCount}×D${e.diceType}→[${e.values.join(",")}]`}</span>
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
            <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?16:22,display:"flex",flexDirection:"column",alignItems:"center"}}>
              <SpinnerWheel players={players} onResult={handleWheel} acc={D.acc} isMobile={isMobile}/>
            </div>
            {wheelHist.length>0&&(
              <div style={{background:D.card,border:`1px solid ${D.brd}`,borderRadius:16,padding:isMobile?12:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
                  <div style={{fontSize:11,fontWeight:700,color:D.sub,textTransform:"uppercase",letterSpacing:1}}>🏁 Historique roue</div>
                  <button onClick={()=>setWHist([])} style={{padding:"5px 12px",borderRadius:7,border:"none",background:"rgba(239,68,68,0.12)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:11,minHeight:32}}>Effacer</button>
                </div>
                {wheelHist.map((e,i)=>(<div key={e.id} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:10,marginBottom:4,background:i===0?`rgba(245,158,11,0.07)`:dark?"#ffffff02":"#00000002",border:i===0?`1px solid ${D.acc}30`:"1px solid transparent"}}>
                  <span style={{fontSize:i===0?16:12,flexShrink:0}}>{i===0?"🥇":"⚫"}</span>
                  <div style={{width:28,height:28,borderRadius:"50%",background:e.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0}}>{e.name[0]}</div>
                  <span style={{flex:1,fontWeight:700,fontSize:13,color:e.color}}>{e.name}</span>
                  <span style={{fontSize:10,color:D.sub}}>{e.date} · {e.time}</span>
                </div>))}
              </div>
            )}
          </div>
        )}

        {/* ═══ SABLIER ═══ */}
        {tab==="timer"&&<SandTimer D={D} dark={dark}/>}
      </main>

      {/* ════ BARRE AJOUT ════ */}
      {tab==="scores"&&(
        <div style={{position:"fixed",bottom:bonusBarH,left:0,right:0,zIndex:25,background:D.hbg,backdropFilter:"blur(16px)",borderTop:`1px solid ${D.brd}`}}>
          <div style={{maxWidth:900,margin:"0 auto"}}>
            {isPlaying&&!addBarOpen?(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"9px 14px":"8px 16px",gap:8}}>
                <span style={{fontSize:11,fontWeight:600,color:D.sub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isMobile?"👈👉 Swipe · ↺ Molette · Tap score · Long press = ±rapide":"👈👉 Swipe ±1 · ↺ Molette (bubble live) · Tap score = saisie · Long press = rapide"}</span>
                <button onClick={()=>setAddBar(true)} style={{padding:"7px 13px",borderRadius:9,border:`1px solid ${D.brd}`,background:D.acc+"22",color:D.acc,cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0,minHeight:38}}>➕ Joueur</button>
              </div>
            ):(
              <div style={{padding:isMobile?"10px 12px 12px":"10px 14px 14px"}}>
                {isPlaying&&<button onClick={()=>setAddBar(false)} style={{float:"right",background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:14,padding:4}}>✕</button>}
                <div style={{fontSize:10,fontWeight:700,color:D.sub,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>➕ Ajouter un joueur</div>
                <div style={{position:"relative"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:addColor.hex,flexShrink:0,border:"2px solid rgba(255,255,255,0.22)"}} aria-hidden/>
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:isMobile?"11px 14px":"9px 12px",borderRadius:12,border:`1px solid ${D.brd}`,background:D.ibg||D.bg,minHeight:48}}>
                      <input ref={addRef} value={addQ} onChange={e=>onQ(e.target.value)}
                        onFocus={()=>addQ&&setSugOpen(sugs.length>0)}
                        onBlur={()=>setTimeout(()=>setSugOpen(false),160)}
                        onKeyDown={e=>{if(e.key==="Enter"){sugs[0]?addPlayer(sugs[0]):addPlayer();}if(e.key==="Escape"){setAddQ("");setSugOpen(false);}}}
                        placeholder="Nom du joueur…" autoComplete="off"
                        style={{flex:1,background:"transparent",border:"none",color:D.txt,fontSize:isMobile?15:13}}/>
                      {addQ&&<button onClick={()=>{setAddQ("");setSugOpen(false);}} style={{background:"none",border:"none",color:D.sub,cursor:"pointer",fontSize:18,lineHeight:1,padding:2}}>×</button>}
                    </div>
                    <button onClick={()=>addPlayer()} disabled={!addQ.trim()}
                      style={{padding:isMobile?"11px 18px":"9px 16px",borderRadius:10,border:"none",flexShrink:0,fontWeight:700,fontSize:isMobile?14:13,cursor:addQ.trim()?"pointer":"default",background:addQ.trim()?D.acc:dark?"#2a2d3a":"#dddad4",color:addQ.trim()?(dark?"#111":"#fff"):D.sub,minHeight:48}}>
                      Ajouter
                    </button>
                  </div>
                  {sugOpen&&sugs.length>0&&(
                    <div className="fade-in" role="listbox" style={{position:"absolute",bottom:"calc(100% + 5px)",left:0,right:0,zIndex:35,background:dark?"#1c1f2e":"#fff",border:`1px solid ${D.brd}`,borderRadius:13,overflow:"hidden",boxShadow:"0 -6px 24px rgba(0,0,0,.28)"}}>
                      {sugs.map((n,i)=>(<button key={i} className="sug-row" role="option" onMouseDown={()=>addPlayer(n)} style={{color:D.txt}}>
                        <span style={{width:26,height:26,borderRadius:"50%",background:addColor.hex+"28",color:addColor.hex,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,flexShrink:0}}>{n[0]}</span>{n}
                      </button>))}
                      {addQ&&!sugs.find(s=>s.toLowerCase()===addQ.toLowerCase())&&(
                        <button className="sug-row" role="option" onMouseDown={()=>addPlayer()} style={{color:D.acc,fontWeight:700,borderTop:`1px solid ${D.brd}`}}><span>✚</span> Ajouter « {addQ} »</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ BONUS BAR ════ */}
      {selPlayer&&tab==="scores"&&(
        <div className="slide-up safe-bottom" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:24,background:dark?"rgba(9,11,17,0.98)":"rgba(238,234,226,0.98)",backdropFilter:"blur(18px)",borderTop:`1px solid ${D.brd}`,padding:isMobile?"7px 10px 10px":"8px 12px 12px"}}>
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
                {sessStr&&(
                  <>
                    {!isMobile&&<div style={{fontSize:10,fontWeight:700,color:D.sub}}>Ce tour :</div>}
                    <div style={{fontSize:11,fontWeight:700,color:sessTotal>=0?"#4ade80":"#f87171",fontFamily:"monospace",background:sessTotal>=0?"rgba(34,197,94,0.10)":"rgba(239,68,68,0.10)",border:`1px solid ${sessTotal>=0?"rgba(34,197,94,0.25)":"rgba(239,68,68,0.25)"}`,borderRadius:7,padding:"3px 7px",lineHeight:1.3,maxWidth:isMobile?110:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sessStr}</div>
                    <button onClick={()=>setSession([])} style={{width:26,height:26,borderRadius:6,border:"none",background:"rgba(239,68,68,0.15)",color:"#f87171",cursor:"pointer",fontSize:13,fontWeight:800,flexShrink:0}}>✕</button>
                  </>
                )}
                <button onClick={()=>{setSelected(null);setSession([]);}} style={{width:30,height:30,borderRadius:8,border:`1px solid ${D.brd}`,background:"transparent",color:D.sub,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isMobile?38:44}px,1fr))`,gap:isMobile?5:6}}>
              {BONUS_CARDS.map(b=>{const neg=b<0,col=neg?"#f87171":"#4ade80",bg=neg?"rgba(239,68,68,0.10)":"rgba(34,197,94,0.10)",brd=neg?"rgba(239,68,68,0.28)":"rgba(34,197,94,0.28)";return(
                <button key={b} className="bonus-card" aria-label={`${b>0?"+":""}${b} pts`}
                  onClick={()=>{adjust(selPlayer.id,b);setSession(p=>[...p,b]);}}
                  style={{padding:isMobile?"8px 2px":"9px 2px",border:`1.5px solid ${brd}`,background:bg,color:col,fontWeight:800,fontSize:isMobile?12:13,minHeight:isMobile?36:38}}>
                  {b>0?"+":""}{b}
                </button>
              );})}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODALS ════ */}

      {/* Historique */}
      {showHist&&(
        <BottomSheet onClose={()=>setSH(false)} D={D} isMobile={isMobile} title="📋 Historique" maxW={540}>
          {players.length>0&&<select value={histFilter} onChange={e=>setHFilter(e.target.value)}
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${D.brd}`,background:D.ibg||D.bg,color:D.txt,fontSize:14,marginBottom:10,minHeight:44}}>
            <option value="all">Tous les joueurs</option>
            {players.map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>}
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {!history.length?<p style={{textAlign:"center",padding:"28px 0",color:D.sub,fontSize:13}}>Aucune action</p>
              :[...history].reverse().filter(e=>histFilter==="all"||e.id===histFilter).map((e,i)=>{
                const p=players.find(pp=>pp.id===e.id),isNeg=e.delta<0,prev=e.score-e.delta;
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 11px",borderRadius:10,background:isNeg?(dark?"rgba(239,68,68,0.11)":"rgba(239,68,68,0.06)"):(dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)")}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:p?.color.hex||"#888",flexShrink:0}}/>
                  <span style={{fontWeight:600,fontSize:12,minWidth:44,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                  <span className="mono" style={{fontSize:10,color:"rgba(128,128,128,0.55)"}}>{prev>0?"+":""}{prev}</span>
                  <span style={{fontSize:10,color:"rgba(128,128,128,0.38)"}}>{e.delta>0?"＋":"－"}</span>
                  <span className="mono" style={{fontSize:11,fontWeight:800,color:isNeg?"#f87171":"#4ade80"}}>{Math.abs(e.delta)}</span>
                  <span style={{fontSize:10,color:"rgba(128,128,128,0.38)"}}>＝</span>
                  <span className="mono" style={{fontSize:12,fontWeight:800,color:p?.color.hex||D.txt}}>{e.score>0?"+":""}{e.score}</span>
                  <span style={{fontSize:9,color:D.sub,marginLeft:"auto",flexShrink:0}}>R{e.round}·{e.time}</span>
                </div>);
              })
            }
          </div>
        </BottomSheet>
      )}

      {showReset&&(
        <BottomSheet onClose={()=>setSR(false)} D={D} isMobile={isMobile} title="🔄 Remettre à zéro ?" maxW={330}>
          <p style={{fontSize:13,color:D.sub,lineHeight:1.7,marginBottom:20}}>Tous les scores reviennent à 0 et l'historique est effacé. Les joueurs restent.</p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setSR(false)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            <button onClick={doReset} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Réinitialiser</button>
          </div>
        </BottomSheet>
      )}

      {confirmRm&&(()=>{const p=players.find(x=>x.id===confirmRm);return p?(
        <BottomSheet onClose={()=>setCR(null)} D={D} isMobile={isMobile} title={`Retirer ${p.name} ?`} maxW={310}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:p.color.hex,margin:"0 auto 10px",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:22}}>{p.name[0]}</div>
            <p style={{fontSize:13,color:D.sub,lineHeight:1.6}}>Annulable via ↩ ou Ctrl+Z.</p>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setCR(null)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            <button onClick={()=>removePlayer(confirmRm)} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Retirer</button>
          </div>
        </BottomSheet>
      ):null;})()}

      {showTarget&&(
        <BottomSheet onClose={()=>setShowTgt(false)} D={D} isMobile={isMobile} title="🎯 Score objectif" maxW={350}>
          <p style={{fontSize:13,color:D.sub,lineHeight:1.7,marginBottom:12}}>La partie se termine automatiquement quand un joueur atteint ce score.</p>
          <input type="number" value={targetInput} onChange={e=>setTgtInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")applyTarget();}} placeholder="ex: 100" autoFocus
            style={{width:"100%",padding:"14px",borderRadius:11,border:`1px solid ${D.brd}`,background:D.ibg||D.bg,color:D.txt,fontSize:22,textAlign:"center",fontFamily:"Space Mono,monospace",marginBottom:12,minHeight:56}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowTgt(false)} style={{flex:1,padding:"13px 0",borderRadius:12,border:`1px solid ${D.brd}`,background:"transparent",color:D.txt,cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Annuler</button>
            {targetScore!=null&&<button onClick={()=>{setTarget(null);setShowTgt(false);flash("Objectif supprimé");}} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"rgba(239,68,68,0.18)",color:"#f87171",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Supprimer</button>}
            <button onClick={applyTarget} style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:D.acc,color:dark?"#111":"#fff",cursor:"pointer",fontWeight:700,fontSize:14,minHeight:50}}>Valider</button>
          </div>
        </BottomSheet>
      )}

      {showPreset&&<GamePresetModal onSelect={applyPreset} onClose={()=>setShowPr(false)} D={D} dark={dark} isMobile={isMobile}/>}
      {showStats&&<InterGameStats D={D} dark={dark} isMobile={isMobile} onClose={()=>setShowSt(false)}/>}
      {showOnline&&<OnlineModal onClose={()=>setShowOnl(false)} D={D} isMobile={isMobile} dark={dark} onCreateGame={createOnlineGame} onJoinGame={joinOnlineGame} onlineCode={onlineCode} isOnline={isOnline} onLeave={leaveOnline}/>}
      {showPicker&&<GamePicker D={D} isMobile={isMobile} dark={dark} onClose={()=>setShowPk(false)} onLoad={loadGame} onNew={()=>{newGame();setShowPk(false);}}/>}

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
