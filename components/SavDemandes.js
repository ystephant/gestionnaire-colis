import React, { useState, useEffect } from 'react';

// Suivi des demandes de SAV : à envoyer → envoyée → relancée → pièces reçues
const STATUTS = [
  { id: 'a_envoyer', label: 'À envoyer',     cls: 'bg-amber-500' },
  { id: 'envoyee',   label: 'Envoyée',       cls: 'bg-blue-500' },
  { id: 'relancee',  label: 'Relancée',      cls: 'bg-violet-500' },
  { id: 'recue',     label: 'Pièces reçues', cls: 'bg-green-600' },
];

const cle = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const messageSav = (d) =>
  `Bonjour,\n\nIl me manque des éléments pour le jeu « ${d.game_name} » :\n${(d.missing_items || '').trim() || '[préciser les pièces manquantes]'}\n\n` +
  `Serait-il possible de me les faire parvenir ? Je vous transmettrai les informations nécessaires (photos, adresse postale).\n\nMerci par avance,\nCordialement`;

export default function SavDemandes({ supabase, darkMode, savGames }) {
  const [demandes, setDemandes]     = useState([]);
  const [incomplets, setIncomplets] = useState([]);
  const [erreur, setErreur]         = useState('');
  const [info, setInfo]             = useState('');
  const [jeu, setJeu]               = useState('');
  const [pieces, setPieces]         = useState('');
  const [messages, setMessages]     = useState({}); // { idDemande: texte affiché }
  const [voirRecues, setVoirRecues] = useState(false);
  const [busy, setBusy]             = useState(false);

  const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;

  const flash = (t) => { setInfo(t); setTimeout(() => setInfo(''), 4000); };

  const charger = async () => {
    const [d, i] = await Promise.all([
      supabase.from('sav_demandes').select('*').eq('user_id', username).order('created_at', { ascending: false }),
      supabase.from('stock_incomplete').select('id, game_name, missing_items').eq('user_id', username),
    ]);
    if (d.error) { setErreur('Suivi indisponible : exécutez le fichier supabase/migration_2026-11.sql dans Supabase.'); return; }
    setErreur('');
    setDemandes(d.data || []);
    setIncomplets(i.data || []);
  };

  useEffect(() => { charger(); }, []);

  const creer = async (game_name, missing_items, incomplete_id = null) => {
    if (!game_name.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from('sav_demandes').insert({
      user_id: username, game_name: game_name.trim(), missing_items: (missing_items || '').trim(),
      incomplete_id: incomplete_id === null ? null : String(incomplete_id),
    });
    setBusy(false);
    if (error) { flash('Erreur : demande non créée'); return; }
    setJeu(''); setPieces('');
    charger();
  };

  const changerStatut = async (d, status) => {
    if (status === d.status || busy) return;

    // Pièces reçues : proposer de remettre l'exemplaire en stock complet
    let aRetirer = null;
    if (status === 'recue') {
      aRetirer = incomplets.find(i => String(i.id) === d.incomplete_id)
        || (d.incomplete_id ? null : incomplets.find(i => cle(i.game_name) === cle(d.game_name)));
      if (aRetirer && !confirm(`Pièces reçues : remettre « ${d.game_name} » en stock complet ?`)) aRetirer = null;
    }

    setBusy(true);
    const { error } = await supabase.from('sav_demandes')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', d.id);
    if (error) { setBusy(false); flash('Erreur : statut non modifié'); return; }
    if (aRetirer) {
      const res = await supabase.from('stock_incomplete').delete().eq('id', aRetirer.id);
      flash(res.error ? 'Statut modifié, mais le stock n’a pas pu être mis à jour' : `« ${d.game_name} » remis en stock complet`);
    }
    setBusy(false);
    charger();
  };

  const supprimer = async (d) => {
    if (!confirm(`Supprimer la demande pour « ${d.game_name} » ?`)) return;
    const { error } = await supabase.from('sav_demandes').delete().eq('id', d.id);
    if (error) { flash('Erreur : demande non supprimée'); return; }
    charger();
  };

  const copier = async (texte) => {
    try { await navigator.clipboard.writeText(texte); flash('Message copié'); }
    catch { flash('Copie impossible'); }
  };

  const lienSav = (nom) => savGames.find(g => cle(g.game_name) === cle(nom))?.sav_url;

  // Jeux incomplets du stock qui n'ont pas encore de demande
  const suivis  = new Set(demandes.map(d => d.incomplete_id).filter(Boolean));
  const aCreer  = incomplets.filter(i => !suivis.has(String(i.id)));
  const visibles = demandes.filter(d => voirRecues || d.status !== 'recue');
  const nbRecues = demandes.filter(d => d.status === 'recue').length;

  const carte = `rounded-2xl shadow-xl p-4 sm:p-6 ${darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-800'}`;
  const champ = `w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`;
  const doux  = darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200';
  const gris  = darkMode ? 'text-gray-400' : 'text-gray-500';

  if (erreur) return <div className={carte}>{erreur}</div>;

  return (
    <div className="space-y-6">
      {info && <div className="rounded-xl px-4 py-3 bg-cyan-600 text-white text-sm font-medium">{info}</div>}

      {aCreer.length > 0 && (
        <div className={carte}>
          <h2 className="text-lg font-bold mb-3">🧩 Incomplets sans demande ({aCreer.length})</h2>
          <div className="space-y-2">
            {aCreer.map(i => (
              <div key={i.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{i.game_name}</div>
                  <div className={`text-xs truncate ${gris}`}>{i.missing_items || 'Pièces non précisées'}</div>
                </div>
                <button disabled={busy} onClick={() => creer(i.game_name, i.missing_items, i.id)}
                  className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50">
                  Créer la demande
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form className={carte} onSubmit={e => { e.preventDefault(); creer(jeu, pieces); }}>
        <h2 className="text-lg font-bold mb-3">➕ Nouvelle demande</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input value={jeu} onChange={e => setJeu(e.target.value)} placeholder="Nom du jeu" className={champ} />
          <input value={pieces} onChange={e => setPieces(e.target.value)} placeholder="Pièces manquantes" className={champ} />
          <button type="submit" disabled={busy || !jeu.trim()} className="px-5 py-3 rounded-xl font-semibold bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50">Ajouter</button>
        </div>
      </form>

      <div className={carte}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-bold">📮 Demandes ({visibles.length})</h2>
          {nbRecues > 0 && (
            <button onClick={() => setVoirRecues(v => !v)} className={`text-sm underline ${gris}`}>
              {voirRecues ? 'Masquer' : 'Afficher'} les terminées ({nbRecues})
            </button>
          )}
        </div>
        {visibles.length === 0 && <p className={gris}>Aucune demande en cours.</p>}
        <div className="space-y-4">
          {visibles.map(d => (
            <div key={d.id} className={`rounded-xl border p-3 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{d.game_name}</div>
                  <div className={`text-sm ${gris}`}>{d.missing_items || 'Pièces non précisées'}</div>
                  <div className={`text-xs mt-1 ${gris}`}>
                    Créée le {new Date(d.created_at).toLocaleDateString('fr-FR')} · mise à jour le {new Date(d.updated_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <button onClick={() => supprimer(d)} title="Supprimer" className="shrink-0 p-2 rounded-lg hover:bg-red-500/10">🗑️</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3">
                {STATUTS.map(s => (
                  <button key={s.id} disabled={busy} onClick={() => changerStatut(d, s.id)} aria-pressed={d.status === s.id}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${d.status === s.id ? `${s.cls} text-white` : doux}`}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => setMessages(m => ({ ...m, [d.id]: m[d.id] === undefined ? messageSav(d) : undefined }))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${doux}`}>✉️ Message</button>
                {lienSav(d.game_name) && (
                  <a href={lienSav(d.game_name)} target="_blank" rel="noopener noreferrer"
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${doux}`}>🔗 Ouvrir le SAV</a>
                )}
              </div>

              {messages[d.id] !== undefined && (
                <div className="mt-3 space-y-2">
                  <textarea rows={9} value={messages[d.id]} onChange={e => setMessages(m => ({ ...m, [d.id]: e.target.value }))} className={`${champ} text-sm`} />
                  <button onClick={() => copier(messages[d.id])} className="px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white">📋 Copier le message</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
