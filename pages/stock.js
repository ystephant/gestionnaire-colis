import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const INCOMING_DAYS = 10;

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const daysAgo = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
};

export default function StockManager() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Data ─────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [salePhotos, setSalePhotos]     = useState([]);
  const [allGameNames, setAllGameNames] = useState([]);

  // ── UI ───────────────────────────────────────────────────────
  const [search, setSearch]               = useState('');
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const [filter, setFilter]               = useState('all');
  const [toast, setToast]                 = useState(null);

  // ── Modal ajout manuel ───────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName]           = useState('');
  const [addQty, setAddQty]             = useState('1');
  const [showAddSugg, setShowAddSugg]   = useState(false);
  const [addLoading, setAddLoading]     = useState(false);

  const searchWrapRef = useRef(null);
  const addWrapRef    = useRef(null);

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    const u = localStorage.getItem('username');
    const p = localStorage.getItem('password');
    if (u && p) {
      setUsername(u);
    } else {
      router.push('/');
    }
  }, []);

  // ── Load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!username) return;
    loadData();
    const cleanup = subscribeToChanges();
    return cleanup;
  }, [username]);

  const loadData = async () => {
    if (!username) return;
    try {
      const { data: txs, error: txErr } = await supabase
        .from('transactions')
        .select('id, type, game_name, price, created_at')
        .eq('user_id', username)
        .in('type', ['buy', 'sell', 'stock_add', 'game_ref', 'stock_remove'])
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      const { data: photos, error: photoErr } = await supabase
        .from('sale_photos')
        .select('id, game_tag, status')
        .eq('user_id', username);

      if (photoErr) throw photoErr;

      setTransactions(txs || []);
      setSalePhotos(photos || []);

      const names = [...new Set(
        (txs || []).map(t => t.game_name).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'fr'));
      setAllGameNames(names);
    } catch (err) {
      console.error('Erreur chargement stock:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel(`stock-realtime-${username}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `user_id=eq.${username}`,
      }, loadData)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'sale_photos',
        filter: `user_id=eq.${username}`,
      }, loadData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  // ── Click outside (fermer suggestions) ───────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setShowSearchSugg(false);
      if (addWrapRef.current && !addWrapRef.current.contains(e.target)) setShowAddSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Calcul du stock ─────────────────────────────────────────
  //
  //  canList (alerte amber) = stock confirmé > 0 ET aucune photo "En vente"
  //    → l'alerte disparaît dès qu'une photo passe à "En vente" dans photos.js
  //    → elle réapparaît si la photo passe à "En attente réception" / "Vendu" / supprimée
  //
  const computeStock = () => {
    const now = Date.now();
    const LIMIT = INCOMING_DAYS * 24 * 60 * 60 * 1000;
    const map = {};

    (transactions || []).forEach(t => {
      if (!t.game_name) return;
      const n = t.game_name;
      if (!map[n]) {
        map[n] = {
          name: n,
          buys: 0,
          sells: 0,
          manualRemovals: 0,
          incomingCount: 0,
          oldestIncomingDate: null,
          lastBuyDate: null,
          lastSellDate: null,
        };
      }
      const g = map[n];
      const d = new Date(t.created_at);

      if (t.type === 'buy') {
        g.buys++;
        if (now - d.getTime() < LIMIT) {
          g.incomingCount++;
          if (!g.oldestIncomingDate || d < new Date(g.oldestIncomingDate))
            g.oldestIncomingDate = t.created_at;
        }
        if (!g.lastBuyDate || d > new Date(g.lastBuyDate)) g.lastBuyDate = t.created_at;

      } else if (t.type === 'stock_add') {
        g.buys++;
        if (!g.lastBuyDate || d > new Date(g.lastBuyDate)) g.lastBuyDate = t.created_at;

      } else if (t.type === 'sell') {
        g.sells++;
        if (!g.lastSellDate || d > new Date(g.lastSellDate)) g.lastSellDate = t.created_at;

      } else if (t.type === 'stock_remove') {
        g.manualRemovals++;
      }
    });

    // Jeux avec au moins 1 photo strictement "En vente" dans sale_photos
    // game_tag a le format "Squadro • 11/03 14:32" dans sale_photos
    // → on extrait la partie avant le " • " pour obtenir le nom du jeu
    const enVenteNames = new Set(
      (salePhotos || [])
        .filter(p => p.status === 'en_vente' && p.game_tag)
        .map(p => p.game_tag.split(' • ')[0].trim().toLowerCase())
    );

    return Object.values(map)
      .map(g => {
        const net            = g.buys - g.sells - g.manualRemovals;
        const confirmedStock = Math.max(0, net - g.incomingCount);
        const isEnVente      = enVenteNames.has(g.name.trim().toLowerCase());
        const canList        = confirmedStock > 0 && !isEnVente;
        const daysLeft       = g.oldestIncomingDate
          ? Math.max(0, INCOMING_DAYS - daysAgo(g.oldestIncomingDate))
          : null;
        return { ...g, net, confirmedStock, isEnVente, canList, daysLeft };
      })
      .filter(g => g.net > 0);
  };

  // ── Ajout manuel ─────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAddManual = async () => {
    const name = addName.trim();
    const qty  = parseInt(addQty, 10);
    if (!name || isNaN(qty) || qty < 1) return;
    setAddLoading(true);
    try {
      const rows = Array.from({ length: qty }, () => ({
        user_id:    username,
        type:       'stock_add',
        game_name:  name,
        price:      0,
      }));
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      showToast(`${qty} × "${name}" ajouté${qty > 1 ? 's' : ''} au stock`);
      setShowAddModal(false);
      setAddName('');
      setAddQty('1');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'ajout", 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Retrait manuel d'1 copie
  const handleRemoveOne = async (gameName) => {
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id:   username,
        type:      'stock_remove',
        game_name: gameName,
        price:     0,
      });
      if (error) throw error;
      showToast('1 "' + gameName + '" retiré du stock');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast('Erreur lors du retrait', 'error');
    }
  };

  // ── Ajout rapide +1 inline ────────────────────────────────────
  const handleAddOne = async (gameName) => {
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id:   username,
        type:      'stock_add',
        game_name: gameName,
        price:     0,
      });
      if (error) throw error;
      showToast('1 "' + gameName + '" ajouté au stock');
      await loadData();
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'ajout", 'error');
    }
  };

  // ── Données dérivées ─────────────────────────────────────────
  const stockItems = computeStock();

  const filteredItems = stockItems
    .filter(g => {
      if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'en_vente')  return g.isEnVente;
      if (filter === 'available') return g.canList;
      if (filter === 'incoming')  return g.incomingCount > 0;
      if (filter === 'low')       return g.net === 1;
      return true;
    })
    .sort((a, b) => {
      if (a.canList && !b.canList)   return -1;
      if (!a.canList && b.canList)   return 1;
      if (a.incomingCount > 0 && b.incomingCount === 0) return -1;
      if (a.incomingCount === 0 && b.incomingCount > 0) return 1;
      return b.net - a.net;
    });

  const kpis = {
    games:     stockItems.length,
    copies:    stockItems.reduce((s, g) => s + g.net, 0),
    incoming:  stockItems.reduce((s, g) => s + g.incomingCount, 0),
    enVente:   stockItems.filter(g => g.isEnVente).length,
    available: stockItems.filter(g => g.canList).length,
  };

  const searchSugg = search.length > 0
    ? allGameNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 7)
    : [];

  const addSugg = addName.length > 0
    ? allGameNames.filter(n => n.toLowerCase().includes(addName.toLowerCase())).slice(0, 7)
    : [];

  const dm = darkMode;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen ${dm ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}
      onClick={() => { setShowSearchSugg(false); setShowAddSugg(false); }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-sm ${
        dm ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-gray-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.push('/transactions')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition ${
              dm ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            ← Transactions
          </button>

          <div className="flex-1 text-center">
            <span className="text-base font-bold">📦 Gestion de stock</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-xl text-lg transition ${dm ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
            title="Changer le thème"
          >
            {dm ? '☀️' : '🌙'}
          </button>

          <button
            onClick={() => { setShowAddModal(true); setAddName(''); setAddQty('1'); }}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition shadow-lg shadow-indigo-500/20"
          >
            + Ajouter
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">

        {/* ── KPI Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Jeux uniques',    value: kpis.games,     icon: '🎲', cls: 'text-indigo-500' },
            { label: 'Copies totales',  value: kpis.copies,    icon: '📦', cls: 'text-blue-500' },
            { label: 'En transit',      value: kpis.incoming,  icon: '🚚', cls: 'text-orange-500' },
            { label: 'À mettre en vente', value: kpis.available, icon: '🏷️', cls: 'text-amber-500' },
            { label: 'En vente',           value: kpis.enVente,   icon: '🟢', cls: 'text-green-500' },
          ].map(({ label, value, icon, cls }) => (
            <div key={label} className={`rounded-2xl p-4 shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
              <div className="text-xl mb-1">{icon}</div>
              <div className={`text-2xl font-black ${cls}`}>{value}</div>
              <div className={`text-xs mt-0.5 leading-tight ${dm ? 'text-slate-400' : 'text-gray-500'}`}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Barre de recherche ──────────────────────────────── */}
        <div className="relative" ref={searchWrapRef} onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearchSugg(true); }}
            onFocus={() => setShowSearchSugg(true)}
            placeholder="🔍 Rechercher un jeu dans le stock…"
            className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition ${
              dm
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-400'
            }`}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setShowSearchSugg(false); }}
              className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${dm ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >✕</button>
          )}

          {/* Suggestions recherche */}
          {showSearchSugg && searchSugg.length > 0 && (
            <div className={`absolute z-20 w-full mt-1.5 rounded-2xl shadow-xl border overflow-hidden ${
              dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
            }`}>
              {searchSugg.map(s => (
                <button
                  key={s}
                  onMouseDown={() => { setSearch(s); setShowSearchSugg(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${
                    dm ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Filtres ──────────────────────────────────────────── */}
        <div className={`flex p-1 rounded-xl gap-1 ${dm ? 'bg-slate-800' : 'bg-gray-100'}`}>
          {[
            { id: 'all',       label: 'Tout' },
            { id: 'available', label: 'À mettre en vente' + (kpis.available > 0 ? ' (' + kpis.available + ')' : '') },
            { id: 'en_vente',  label: 'En vente' + (kpis.enVente > 0 ? ' (' + kpis.enVente + ')' : '') },
            { id: 'incoming',  label: 'Transit' + (kpis.incoming > 0 ? ' (' + kpis.incoming + ')' : '') },
            { id: 'low',       label: 'Stock bas' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filter === f.id
                  ? 'bg-indigo-600 text-white shadow'
                  : dm
                    ? 'text-slate-400 hover:text-white'
                    : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Liste des jeux ───────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16 text-3xl animate-spin">⏳</div>
        ) : filteredItems.length === 0 ? (
          <div className={`text-center py-14 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
            <div className="text-5xl mb-3">📭</div>
            <div className="text-sm font-medium">Aucun jeu dans ce stock</div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-3 text-xs text-indigo-500 hover:underline"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {filteredItems.map(g => (
              <div
                key={g.name}
                className={`rounded-2xl overflow-hidden shadow-sm transition ${
                  dm ? 'bg-slate-800' : 'bg-white border border-gray-100'
                }`}
              >
                {/* Bannière alerte "peut mettre en vente" */}
                {g.canList && (
                  <div className={`px-4 py-2 flex items-center gap-2 border-b-2 border-amber-400 ${
                    dm ? 'bg-amber-900/25 text-amber-300' : 'bg-amber-50 text-amber-700'
                  }`}>
                    <span className="text-sm">🏷️</span>
                    <span className="text-xs font-semibold">
                      Tu peux mettre un nouveau <span className="font-black">"{g.name}"</span> en vente !
                    </span>
                  </div>
                )}

                {/* Ligne principale */}
                <div className="px-4 py-3 flex items-center gap-3">

                  {/* Nom + badges */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm truncate ${dm ? 'text-white' : 'text-gray-900'}`}>
                      {g.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {g.isEnVente && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          dm ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-green-50 text-green-600 border-green-200'
                        }`}>🟢 En vente</span>
                      )}
                      {g.incomingCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          dm ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200'
                        }`}>
                          🚚 {g.incomingCount} en transit{g.daysLeft > 0 ? ` (~${g.daysLeft}j)` : ''}
                        </span>
                      )}
                      {g.confirmedStock > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          dm ? 'bg-slate-600/40 text-slate-300 border-slate-600' : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>✅ {g.confirmedStock} dispo</span>
                      )}
                    </div>
                  </div>

                  {/* − N + sur une ligne */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => handleRemoveOne(g.name)}
                      title="Retirer 1 du stock"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition ${
                        dm
                          ? 'bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400'
                          : 'bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500'
                      }`}
                    >−</button>

                    <div className="w-10 text-center">
                      <span className={`text-xl font-black ${
                        g.net >= 3 ? 'text-indigo-500' :
                        g.net === 2 ? 'text-blue-500'  :
                        g.net === 1 ? 'text-amber-500' :
                        dm ? 'text-slate-500' : 'text-gray-300'
                      }`}>{g.net}</span>
                    </div>

                    <button
                      onClick={() => handleAddOne(g.name)}
                      title="Ajouter 1 au stock"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition ${
                        dm
                          ? 'bg-slate-700 hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400'
                          : 'bg-gray-100 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500'
                      }`}
                    >+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ajout manuel ──────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl border p-6 ${
              dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
            }`}
          >
            {/* Titre */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">📦 Ajouter au stock</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition ${
                  dm ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'
                }`}
              >✕</button>
            </div>

            {/* Nom du jeu + autocomplétions */}
            <div className="mb-4 relative" ref={addWrapRef} onClick={e => e.stopPropagation()}>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                Nom du jeu
              </label>
              <input
                type="text"
                value={addName}
                onChange={e => { setAddName(e.target.value); setShowAddSugg(true); }}
                onFocus={() => setShowAddSugg(true)}
                placeholder="Ex: Catan, 7 Wonders…"
                autoFocus
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
                  dm
                    ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-400'
                }`}
              />
              {showAddSugg && addSugg.length > 0 && (
                <div className={`absolute z-20 w-full mt-1 rounded-xl shadow-xl border overflow-hidden ${
                  dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
                }`}>
                  {addSugg.map(s => (
                    <button
                      key={s}
                      onMouseDown={() => { setAddName(s); setShowAddSugg(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${
                        dm ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantité */}
            <div className="mb-6">
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                Quantité
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAddQty(q => String(Math.max(1, parseInt(q, 10) - 1)))}
                  className={`w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center transition ${
                    dm ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >−</button>
                <input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  className={`flex-1 text-center px-3 py-2.5 rounded-xl border text-base font-black outline-none transition ${
                    dm ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
                <button
                  onClick={() => setAddQty(q => String(parseInt(q, 10) + 1))}
                  className={`w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center transition ${
                    dm ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >+</button>
              </div>
            </div>

            {/* Aperçu */}
            {addName.trim() && parseInt(addQty, 10) >= 1 && (
              <div className={`mb-4 px-3 py-2.5 rounded-xl text-sm text-center font-medium ${
                dm ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
              }`}>
                Ajouter {addQty} × "<span className="font-bold">{addName.trim()}</span>" au stock
              </div>
            )}

            {/* Bouton valider */}
            <button
              onClick={handleAddManual}
              disabled={!addName.trim() || parseInt(addQty, 10) < 1 || addLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                !addName.trim() || parseInt(addQty, 10) < 1 || addLoading
                  ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
              }`}
            >
              {addLoading
                ? <><span className="animate-spin">⏳</span> Ajout en cours…</>
                : <><span>✅</span> Confirmer l'ajout</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 max-w-xs ${
          toast.type === 'error'
            ? dm
              ? 'bg-red-900/80 text-red-200 border border-red-700'
              : 'bg-red-50 text-red-700 border border-red-200'
            : dm
              ? 'bg-green-900/80 text-green-200 border border-green-700'
              : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {toast.type === 'error' ? '❌' : '✅'}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
