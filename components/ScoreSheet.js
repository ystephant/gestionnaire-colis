// Feuille de score : un tableau manche par manche avec les totaux,
// comme sur papier. Chaque case peut être saisie ou corrigée.
import { useRef, useState } from "react";

const signed = (n) => String(n);

export default function ScoreSheet({ D, dark, players, history, round, lowestWins, starterAt, onSetCell, onNextRound }) {
  const [edit, setEdit] = useState(null);   // { id, round }
  const [val, setVal] = useState("");
  const inputRef = useRef(null);

  // Points par joueur et par manche
  const cells = {};
  history.forEach(e => {
    const k = `${e.id}:${e.round}`;
    cells[k] = (cells[k] || 0) + e.delta;
  });
  const ids = new Set(players.map(p => p.id));
  const nbRounds = history.reduce((m, e) => (ids.has(e.id) ? Math.max(m, e.round) : m), round);
  const rounds = Array.from({ length:nbRounds }, (_, i) => i + 1);

  // Points qui ne sont rattachés à aucune manche connue (partie rejointe en cours, très vieil historique)
  const carry = {};
  players.forEach(p => {
    carry[p.id] = p.score - rounds.reduce((s, r) => s + (cells[`${p.id}:${r}`] || 0), 0);
  });
  const hasCarry = players.some(p => carry[p.id] !== 0);

  const best = players.length ? (lowestWins ? Math.min : Math.max)(...players.map(p => p.score)) : 0;
  const someScored = players.some(p => p.score !== 0);

  const open = (id, r) => {
    setEdit({ id, round:r });
    setVal(cells[`${id}:${r}`] !== undefined ? String(cells[`${id}:${r}`]) : "");
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  };

  // Enregistre la case, puis passe au joueur suivant si sa case est encore vide
  const commit = () => {
    if (!edit) return;
    const n = parseInt(val, 10);
    if (!isNaN(n)) onSetCell(edit.id, edit.round, n);
    const i = players.findIndex(p => p.id === edit.id);
    for (let step = 1; step < players.length; step++) {
      const next = players[(i + step) % players.length];
      if (cells[`${next.id}:${edit.round}`] === undefined) { open(next.id, edit.round); return; }
    }
    setEdit(null);
  };
  const toggleSign = () => {
    setVal(v => v.startsWith("-") ? v.slice(1) : "-" + v);
    inputRef.current?.focus();
  };

  const edited = edit && players.find(p => p.id === edit.id);
  const th = { padding:"8px 4px", fontSize:12, fontWeight:800, textAlign:"center", borderBottom:`2px solid ${D.brd}`, minWidth:64 };
  const first = { position:"sticky", left:0, background:D.card, width:40, minWidth:40, fontSize:11, fontWeight:700, color:D.sub, textAlign:"center", zIndex:1 };
  const btn = { height:44, minWidth:44, padding:"0 12px", borderRadius:10, border:`1px solid ${D.brd}`, background:"transparent", color:D.txt, fontWeight:800, fontSize:14, cursor:"pointer" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {edited && (
        <form onSubmit={e => { e.preventDefault(); commit(); }}
          style={{ position:"sticky", top:112, zIndex:20, background:D.card, border:`2px solid ${edited.color.hex}`, borderRadius:14, padding:10 }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>
            <span style={{ color:edited.color.hex }}>{edited.name}</span> · manche {edit.round}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button type="button" onClick={toggleSign} aria-label="Changer le signe" style={btn}>±</button>
            <input ref={inputRef} value={val} onChange={e => setVal(e.target.value.replace(/[^0-9-]/g, ""))}
              inputMode="numeric" enterKeyHint="next" aria-label="Points de la manche" placeholder="Points"
              className="mono"
              style={{ flex:1, minWidth:0, height:44, textAlign:"center", fontSize:22, fontWeight:700, borderRadius:10, border:`1px solid ${D.brd}`, background:D.ibg, color:D.txt }}/>
            <button type="submit" style={{ ...btn, background:"#16a34a", border:"none", color:"#fff" }}>OK</button>
            <button type="button" onClick={() => setEdit(null)} aria-label="Fermer la saisie" style={{ ...btn, color:D.sub }}>✕</button>
          </div>
        </form>
      )}

      <div style={{ background:D.card, border:`1px solid ${D.brd}`, borderRadius:14, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, ...first }}>M.</th>
              {players.map(p => (
                <th key={p.id} style={{ ...th, color:p.color.hex }}>
                  <div style={{ maxWidth:90, margin:"0 auto", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasCarry && (
              <tr style={{ borderBottom:`1px solid ${D.brd}` }}>
                <td style={first}>Avant</td>
                {players.map(p => <td key={p.id} className="mono" style={{ textAlign:"center", fontSize:14, color:D.sub, padding:"10px 4px" }}>{signed(carry[p.id])}</td>)}
              </tr>
            )}
            {rounds.map(r => (
              <tr key={r} style={{ borderBottom:`1px solid ${D.brd}`, background:r === round ? (dark ? "rgba(252,211,77,.07)" : "rgba(245,158,11,.08)") : "transparent" }}>
                <td style={first}>{r}</td>
                {players.map(p => {
                  const v = cells[`${p.id}:${r}`];
                  const on = edit?.id === p.id && edit.round === r;
                  return (
                    <td key={p.id} style={{ padding:2, textAlign:"center" }}>
                      <button onClick={() => open(p.id, r)} aria-label={`${p.name}, manche ${r} : ${v ?? "vide"}`} className="mono"
                        style={{ position:"relative", width:"100%", minHeight:44, borderRadius:8, border:on ? `2px solid ${p.color.hex}` : "2px solid transparent", background:"transparent", color:v === undefined ? D.sub : v < 0 ? "#ef4444" : D.txt, fontSize:16, fontWeight:700, cursor:"pointer" }}>
                        {starterAt(r) === p.id && <span title="Commence la manche" style={{ position:"absolute", left:3, top:2, fontSize:9, color:"#16a34a" }}>▶</span>}
                        {v === undefined ? "·" : signed(v)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop:`2px solid ${D.brd}` }}>
              <td style={{ ...first, color:D.txt }}>Total</td>
              {players.map(p => (
                <td key={p.id} className="mono" style={{ textAlign:"center", padding:"12px 4px", fontSize:20, fontWeight:800, color:p.color.hex }}>
                  {someScored && p.score === best && <div style={{ fontSize:12 }}>👑</div>}
                  {signed(p.score)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <button onClick={() => { setEdit(null); onNextRound(); }}
        style={{ ...btn, width:"100%", background:D.card }}>
        + Manche suivante
      </button>
      <div style={{ fontSize:11, color:D.sub, textAlign:"center" }}>Touchez une case pour saisir ou corriger les points.</div>
    </div>
  );
}
