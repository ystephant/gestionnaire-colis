// Tirage du premier joueur avec des cartes : le nom devant, un numéro au hasard derrière.
// La carte n°1 désigne le premier joueur.

export function dealCards(players) {
  const nums = players.map((_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return { nums:Object.fromEntries(players.map((p, i) => [p.id, nums[i]])), open:{} };
}

const rank = (n) => n === 1 ? "1er joueur" : `${n}ᵉ joueur`;

export default function FirstPlayerCards({ D, players, deal, setDeal, onFirst, follow, onFollow }) {
  if (players.length < 2) {
    return <div style={{ textAlign:"center", padding:"40px 20px", color:D.sub, fontWeight:700, fontSize:14 }}>Ajoutez au moins 2 joueurs pour tirer les cartes</div>;
  }
  // La donne n'est plus valable si les joueurs ont changé
  const valid = deal && Object.keys(deal.nums).length === players.length && players.every(p => deal.nums[p.id]);
  const open = valid ? deal.open : {};
  const allOpen = valid && players.every(p => open[p.id]);

  const apply = (next) => {
    setDeal(next);
    const first = players.find(p => next.nums[p.id] === 1);
    if (first && next.open[first.id] && !(valid && open[first.id])) onFirst(first, next);
  };
  const toggle = (id) => {
    const base = valid ? deal : dealCards(players);
    apply({ ...base, open:{ ...base.open, [id]:!base.open[id] } });
  };
  const toggleAll = () => {
    const base = valid ? deal : dealCards(players);
    apply({ ...base, open:allOpen ? {} : Object.fromEntries(players.map(p => [p.id, true])) });
  };

  const face = { position:"absolute", inset:0, borderRadius:14, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:6, color:"#fff", border:"4px solid rgba(255,255,255,.85)", boxShadow:"0 4px 14px rgba(0,0,0,.25)" };
  const btn = { height:44, padding:"0 16px", borderRadius:11, border:`1px solid ${D.brd}`, background:D.card, color:D.txt, fontWeight:800, fontSize:13, cursor:"pointer" };

  return (
    <div style={{ width:"100%" }}>
      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:10 }}>
        {players.map(p => {
          const shown = !!open[p.id];
          const n = valid ? deal.nums[p.id] : null;
          return (
            <button key={p.id} onClick={() => toggle(p.id)}
              aria-label={shown ? `${p.name} : numéro ${n}` : `Carte de ${p.name}`}
              style={{ width:96, height:134, perspective:700, background:"none", border:"none", padding:0, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
              <div style={{ position:"relative", width:"100%", height:"100%", transformStyle:"preserve-3d", transition:"transform .55s cubic-bezier(.3,.7,.3,1.1)", transform:shown ? "rotateY(180deg)" : "none" }}>
                {/* Recto : le nom */}
                <div style={{ ...face, background:`linear-gradient(160deg,${p.color.hex},${p.color.hex}aa)` }}>
                  <div style={{ fontSize:30, marginBottom:6 }}>🎴</div>
                  <div style={{ fontWeight:800, fontSize:14, maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textShadow:"0 1px 3px rgba(0,0,0,.6)" }}>{p.name}</div>
                </div>
                {/* Verso : le numéro */}
                <div style={{ ...face, transform:"rotateY(180deg)", background:n === 1 ? "linear-gradient(160deg,#f59e0b,#b45309)" : "linear-gradient(160deg,#334155,#0f172a)" }}>
                  <div className="mono" style={{ fontSize:52, fontWeight:800, lineHeight:1 }}>{n}</div>
                  <div style={{ fontSize:11, fontWeight:700, marginTop:6, maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n === 1 ? "👑 " : ""}{p.name}</div>
                  {follow && valid && <div style={{ fontSize:10, opacity:.85, marginTop:2 }}>{rank(n)}</div>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:8, marginTop:16 }}>
        <button onClick={toggleAll} style={btn}>{allOpen ? "🙈 Tout cacher" : "👀 Tout retourner"}</button>
        <button onClick={() => setDeal(dealCards(players))} style={btn}>🔀 Mélanger</button>
      </div>
      <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:12, minHeight:40, fontSize:13, fontWeight:700, color:D.txt, cursor:"pointer" }}>
        <input type="checkbox" checked={follow} onChange={e => onFollow(e.target.checked)} style={{ width:20, height:20, accentColor:"#f59e0b" }}/>
        Suivre l’ordre des numéros
      </label>
      {follow && allOpen && (
        <div style={{ fontSize:12, fontWeight:700, textAlign:"center", color:D.txt, marginTop:4 }}>
          {[...players].sort((a, b) => deal.nums[a.id] - deal.nums[b.id]).map(p => p.name).join(" → ")}
        </div>
      )}
      <div style={{ fontSize:11, color:D.sub, textAlign:"center", marginTop:6 }}>
        Touchez une carte pour la retourner. {follow ? "Les numéros donnent l’ordre de jeu." : "Le n°1 commence, puis le tour suit l’ordre des joueurs."}
      </div>
    </div>
  );
}
