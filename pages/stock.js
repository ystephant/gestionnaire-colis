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

// Exclure les jeux dont le nom contient "lot" (achat groupé, revente à l'unité)
const isLot = (name) => /\blot\b/i.test(name || '');

// Normalisation du nom pour le regroupement :
//   'Detective Club + Extension' → 'Detective Club'
//   Matching strict sinon : 'Azul les Vitraux' ≠ 'Azul'
const baseName    = (name) => {
  if (!name) return '';
  const plusIdx = name.indexOf(' +');
  return (plusIdx !== -1 ? name.slice(0, plusIdx) : name).trim();
};
const baseNameLow = (name) => baseName(name).toLowerCase();

export default function StockManager() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [loading,  setLoading]  = useState(true);

  // ── Data ─────────────────────────────────────────────────────
  const [transactions,  setTransactions]  = useState([]);
  const [salePhotos,    setSalePhotos]    = useState([]);
  const [incompleteGames, setIncompleteGames] = useState([]);
  const [allGameNames,  setAllGameNames]  = useState([]);

  // ── Onglet actif ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'incomplet'

  // ── UI Stock ─────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const [filter,         setFilter]         = useState('all');
  const [toast,          setToast]          = useState(null);

  // ── Modal ajout manuel ───────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName,      setAddName]      = useState('');
  const [addQty,       setAddQty]       = useState('1');
  const [showAddSugg,  setShowAddSugg]  = useState(false);
  const [addLoading,   setAddLoading]   = useState(false);

  // ── Modal "Mettre en incomplet" ──────────────────────────────
  const [showIncModal,   setShowIncModal]   = useState(false);
  const [incModalGame,   setIncModalGame]   = useState('');
  const [incModalText,   setIncModalText]   = useState('');
  const [incModalLoading,setIncModalLoading]= useState(false);

  // ── Search onglet incomplet ──────────────────────────────────
  const [searchInc, setSearchInc] = useState('');

  const searchWrapRef = useRef(null);
  const addWrapRef    = useRef(null);

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    const u = localStorage.getItem('username');
    const p = localStorage.getItem('password');
    if (u && p) { setUsername(u); } else { router.push('/'); }
  }, []);

  useEffect(() => {
    if (!username) return;
    loadData();
    const cleanup = subscribeToChanges();
    return cleanup;
  }, [username]);

  // ── Chargement ───────────────────────────────────────────────
  const loadData = async () => {
    if (!username) return;
    try {
      const [txRes, photoRes, incRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, type, game_name, price, created_at')
          .eq('user_id', username)
          .in('type', ['buy', 'sell', 'stock_add', 'game_ref', 'stock_remove'])
          .order('created_at', { ascending: false }),
        supabase
          .from('sale_photos')
          .select('id, game_tag, status')
          .eq('user_id', username),
        supabase
          .from('stock_incomplete')
          .select('id, game_name, missing_items, created_at')
          .eq('user_id', username)
          .order('created_at', { ascending: false }),
      ]);

      if (txRes.error)    throw txRes.error;
      if (photoRes.error) throw photoRes.error;
      if (incRes.error)   throw incRes.error;

      setTransactions(txRes.data   || []);
      setSalePhotos(photoRes.data  || []);
      setIncompleteGames(incRes.data || []);

      const names = [...new Set(
        (txRes.data || []).map(t => t.game_name).filter(n => n && !isLot(n)).map(n => baseName(n))
      )].sort((a, b) => a.localeCompare(b, 'fr'));
      setAllGameNames(names);
    } catch (err) {
      console.error('Erreur chargement stock:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Realtime ─────────────────────────────────────────────────
  const subscribeToChanges = () => {
    const channel = supabase
      .channel(`stock-realtime-${username}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions',     filter: `user_id=eq.${username}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_photos',      filter: `user_id=eq.${username}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_incomplete', filter: `user_id=eq.${username}` }, loadData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  // ── Click outside suggestions ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setShowSearchSugg(false);
      if (addWrapRef.current    && !addWrapRef.current.contains(e.target))    setShowAddSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Calcul du stock ──────────────────────────────────────────
  //
  //  • Les jeux contenant "lot" sont ignorés (achat groupé)
  //  • buy < 10j → en transit ; stock_arrival annule 1 transit
  //  • stock_add  → confirmé immédiatement
  //  • stock_remove / sell → décrément
  //  • net clampé à 0 (évite les négatifs si stock pré-app)
  //  • incomplets déduits du net (comptés à part)
  //  • canList = confirmedStock > 0 ET aucune photo "en_vente"
  //
  const computeStock = () => {
    const now   = Date.now();
    const LIMIT = INCOMING_DAYS * 24 * 60 * 60 * 1000;
    const map   = {};

    (transactions || []).forEach(t => {
      if (!t.game_name || isLot(t.game_name)) return;
      // Clé = nom de base (avant ' +'), strict sinon
      const n = baseName(t.game_name);
      if (!map[n]) {
        map[n] = {
          name: n, buys: 0, sells: 0,
          manualRemovals: 0,
          incomingBuys: [],
          lastBuyDate: null, lastSellDate: null,
        };
      }
      const g = map[n];
      const d = new Date(t.created_at);

      if (t.type === 'buy') {
        g.buys++;
        if (now - d.getTime() < LIMIT) g.incomingBuys.push(d);
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

    // Nombre d'incomplets par jeu
    const incompleteMap = {};
    (incompleteGames || []).forEach(i => {
      incompleteMap[i.game_name] = (incompleteMap[i.game_name] || 0) + 1;
    });

    // Photos en vente : extraire le nom avant " • "
    const enVenteNames = new Set(
      (salePhotos || [])
        .filter(p => p.status === 'en_vente' && p.game_tag)
        .map(p => baseNameLow(p.game_tag.split(' • ')[0].trim()))
    );

    return Object.values(map)
      .map(g => {
        const incomingCount = g.incomingBuys.length;
        const sortedIncoming = [...g.incomingBuys].sort((a, b) => a - b);
        const oldestIncoming = sortedIncoming[0] || null;
        const daysLeft = oldestIncoming
          ? Math.max(0, INCOMING_DAYS - Math.floor((now - oldestIncoming.getTime()) / 86400000))
          : null;

        const incompletCount = incompleteMap[g.name] || 0;
        const netRaw         = g.buys - g.sells - g.manualRemovals - incompletCount;
        const net            = Math.max(0, netRaw);
        const confirmedStock = Math.max(0, net - incomingCount);
        const isEnVente      = enVenteNames.has(baseNameLow(g.name));
        const canList        = confirmedStock > 0 && !isEnVente;

        return { ...g, incomingCount, daysLeft, incompletCount, net, confirmedStock, isEnVente, canList };
      })
      .filter(g => g.net > 0);
  };

  // ── Toast ────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Actions ──────────────────────────────────────────────────
  const handleAddManual = async () => {
    const name = addName.trim();
    const qty  = parseInt(addQty, 10);
    if (!name || isNaN(qty) || qty < 1) return;
    setAddLoading(true);
    try {
      const rows = Array.from({ length: qty }, () => ({
        user_id: username, type: 'stock_add', game_name: name, price: 0,
      }));
      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      showToast(`${qty} × "${name}" ajouté${qty > 1 ? 's' : ''} au stock`);
      setShowAddModal(false); setAddName(''); setAddQty('1');
      await loadData();
    } catch (err) {
      showToast("Erreur lors de l'ajout", 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveOne = async (gameName) => {
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: username, type: 'stock_remove', game_name: gameName, price: 0,
      });
      if (error) throw error;
      showToast(`1 "${gameName}" retiré du stock`);
      await loadData();
    } catch (err) { showToast('Erreur lors du retrait', 'error'); }
  };

  const handleAddOne = async (gameName) => {
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: username, type: 'stock_add', game_name: gameName, price: 0,
      });
      if (error) throw error;
      showToast(`1 "${gameName}" ajouté au stock`);
      await loadData();
    } catch (err) { showToast("Erreur lors de l'ajout", 'error'); }
  };

  // Déplacer 1 copie vers incomplet
  const handleMoveToIncomplete = async () => {
    if (!incModalGame) return;
    setIncModalLoading(true);
    try {
      // On insère uniquement dans stock_incomplete.
      // La déduction du stock se fait via incompletCount dans computeStock.
      // Pas de stock_remove pour éviter la double déduction.
      const { error } = await supabase.from('stock_incomplete').insert({
        user_id: username, game_name: incModalGame, missing_items: incModalText.trim(),
      });
      if (error) throw error;
      showToast(`"${incModalGame}" déplacé vers Incomplets`);
      setShowIncModal(false); setIncModalGame(''); setIncModalText('');
      await loadData();
    } catch (err) { showToast('Erreur lors du déplacement', 'error'); }
    finally { setIncModalLoading(false); }
  };

  // Supprimer un jeu incomplet
  const handleDeleteIncomplete = async (id, gameName) => {
    if (!confirm(`Supprimer "${gameName}" des incomplets ?`)) return;
    try {
      const { error } = await supabase.from('stock_incomplete').delete().eq('id', id);
      if (error) throw error;
      showToast(`"${gameName}" retiré des incomplets`);
      await loadData();
    } catch (err) { showToast('Erreur lors de la suppression', 'error'); }
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
      if (a.canList && !b.canList)                       return -1;
      if (!a.canList && b.canList)                       return 1;
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

  // Jeux "en vente" dans photos mais sans transaction d'achat correspondante
  const stockNameSet = new Set(stockItems.map(g => baseNameLow(g.name)));
  const orphanEnVente = [...new Set(
    (salePhotos || [])
      .filter(p => p.status === 'en_vente' && p.game_tag)
      .map(p => p.game_tag.split(' • ')[0].trim())
  )].filter(name => !stockNameSet.has(baseNameLow(name)))
    .sort((a, b) => a.localeCompare(b, 'fr'));

  const filteredInc = (incompleteGames || []).filter(i =>
    !searchInc || i.game_name.toLowerCase().includes(searchInc.toLowerCase())
  );

  // Regrouper les incomplets par jeu
  const incByGame = {};
  filteredInc.forEach(i => {
    if (!incByGame[i.game_name]) incByGame[i.game_name] = [];
    incByGame[i.game_name].push(i);
  });

  const searchSugg = search.length > 0
    ? allGameNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 7)
    : [];

  const addSugg = addName.length > 0
    ? allGameNames.filter(n => n.toLowerCase().includes(addName.toLowerCase())).slice(0, 7)
    : [];

  const dm = darkMode;
  const tabBtn = (id, label, count) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-2.5 text-sm font-bold transition relative ${
        activeTab === id
          ? dm ? 'text-white border-b-2 border-indigo-500' : 'text-indigo-600 border-b-2 border-indigo-500'
          : dm ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-black ${
          activeTab === id
            ? 'bg-indigo-500 text-white'
            : dm ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'
        }`}>{count}</span>
      )}
    </button>
  );

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
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition ${
              dm ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >← Transactions</button>

          <div className="flex-1 text-center">
            <span className="text-base font-bold">📦 Gestion de stock</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-xl text-lg transition ${dm ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          >{dm ? '☀️' : '🌙'}</button>

          {activeTab === 'stock' && (
            <button
              onClick={() => { setShowAddModal(true); setAddName(''); setAddQty('1'); }}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition shadow-lg shadow-indigo-500/20"
            >+ Ajouter</button>
          )}
        </div>

        {/* Onglets */}
        <div className={`max-w-4xl mx-auto px-4 flex border-t ${dm ? 'border-slate-700' : 'border-gray-100'}`}>
          {tabBtn('stock',    '🎲 Stock complet', kpis.games)}
          {tabBtn('incomplet','🧩 Incomplets',    (incompleteGames || []).length)}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          ONGLET STOCK
          ════════════════════════════════════════════════════════ */}
      {activeTab === 'stock' && (
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Références',          value: kpis.games,     icon: '🎲', cls: 'text-indigo-500' },
              { label: 'Exemplaires',          value: kpis.copies,    icon: '📦', cls: 'text-blue-500'   },
              { label: 'En transit',        value: kpis.incoming,  icon: '🚚', cls: 'text-orange-500' },
              { label: 'À mettre en vente', value: kpis.available, icon: '🏷️', cls: 'text-amber-500'  },
              { label: 'En vente',          value: kpis.enVente,   icon: '🟢', cls: 'text-green-500'  },
              { label: 'Incomplets',        value: (incompleteGames || []).length, icon: '🧩', cls: 'text-rose-500' },
            ].map(({ label, value, icon, cls }) => (
              <div key={label} className={`rounded-2xl p-4 shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
                <div className="text-xl mb-1">{icon}</div>
                <div className={`text-2xl font-black ${cls}`}>{value}</div>
                <div className={`text-xs mt-0.5 leading-tight ${dm ? 'text-slate-400' : 'text-gray-500'}`}>{label}</div>
              </div>
            ))}
          </div>

          {/* Recherche */}
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
            {showSearchSugg && searchSugg.length > 0 && (
              <div className={`absolute z-20 w-full mt-1.5 rounded-2xl shadow-xl border overflow-hidden ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                {searchSugg.map(s => (
                  <button key={s} onMouseDown={() => { setSearch(s); setShowSearchSugg(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${dm ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-50 text-gray-900'}`}
                  >{s}</button>
                ))}
              </div>
            )}
          </div>

          {/* Filtres */}
          <div className={`flex p-1 rounded-xl gap-1 ${dm ? 'bg-slate-800' : 'bg-gray-100'}`}>
            {[
              { id: 'all',       label: 'Tout' },
              { id: 'available', label: `🏷️ À vendre${kpis.available > 0 ? ' (' + kpis.available + ')' : ''}` },
              { id: 'en_vente',  label: `🟢 En vente${kpis.enVente > 0 ? ' (' + kpis.enVente + ')' : ''}` },
              { id: 'incoming',  label: `🚚 Transit${kpis.incoming > 0 ? ' (' + kpis.incoming + ')' : ''}` },
              { id: 'low',       label: '⚠️ Stock bas' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-indigo-600 text-white shadow'
                    : dm ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >{f.label}</button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="flex justify-center py-16 text-3xl animate-spin">⏳</div>
          ) : filteredItems.length === 0 ? (
            <div className={`text-center py-14 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
              <div className="text-5xl mb-3">📭</div>
              <div className="text-sm font-medium">Aucun jeu dans ce stock</div>
              {search && <button onClick={() => setSearch('')} className="mt-3 text-xs text-indigo-500 hover:underline">Effacer la recherche</button>}
            </div>
          ) : (
            <div className="space-y-3 pb-10">
              {filteredItems.map(g => (
                <div key={g.name} className={`rounded-2xl overflow-hidden shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>

                  {/* Alerte amber */}
                  {g.canList && (
                    <div className={`px-4 py-2 flex items-center gap-2 border-b-2 border-amber-400 ${dm ? 'bg-amber-900/25 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                      <span className="text-sm">🏷️</span>
                      <span className="text-xs font-semibold">
                        Tu peux mettre un nouveau <span className="font-black">"{g.name}"</span> en vente !
                      </span>
                    </div>
                  )}

                  <div className="px-4 py-3 flex items-center gap-3">

                    {/* Nom + badges */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm truncate ${dm ? 'text-white' : 'text-gray-900'}`}>
                        {g.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {g.isEnVente && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-green-50 text-green-600 border-green-200'}`}>🟢 En vente</span>
                        )}
                        {g.incomingCount > 0 && (
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                              🚚 {g.incomingCount} en transit{g.daysLeft > 0 ? ` (~${g.daysLeft}j)` : ''}
                            </span>

                          </div>
                        )}

                        {g.incompletCount > 0 && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                            🧩 {g.incompletCount} incomplet{g.incompletCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bouton discret → incomplet */}
                    <button
                      onClick={() => { setIncModalGame(g.name); setIncModalText(''); setShowIncModal(true); }}
                      title="Déplacer vers incomplets"
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition ${
                        dm ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-900/20' : 'text-gray-300 hover:text-rose-400 hover:bg-rose-50'
                      }`}
                    >🧩</button>

                    {/* − N + */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <button
                        onClick={() => handleRemoveOne(g.name)}
                        title="Retirer 1 du stock"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition ${
                          dm ? 'bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400' : 'bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500'
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
                          dm ? 'bg-slate-700 hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400' : 'bg-gray-100 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500'
                        }`}
                      >+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET INCOMPLETS
          ════════════════════════════════════════════════════════ */}
      {activeTab === 'incomplet' && (
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-5 pb-10">

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
              <div className="text-xl mb-1">🎲</div>
              <div className="text-2xl font-black text-indigo-500">{kpis.copies}</div>
              <div className={`text-xs mt-0.5 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Exemplaires complets</div>
            </div>
            <div className={`rounded-2xl p-4 shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
              <div className="text-xl mb-1">🧩</div>
              <div className="text-2xl font-black text-rose-500">{(incompleteGames || []).length}</div>
              <div className={`text-xs mt-0.5 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Jeux incomplets / pièces</div>
            </div>
          </div>

          {/* Recherche incomplets */}
          <input
            type="text"
            value={searchInc}
            onChange={e => setSearchInc(e.target.value)}
            placeholder="🔍 Rechercher dans les incomplets…"
            className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition ${
              dm
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-rose-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-400'
            }`}
          />

          {/* Liste groupée */}
          {loading ? (
            <div className="flex justify-center py-16 text-3xl animate-spin">⏳</div>
          ) : Object.keys(incByGame).length === 0 ? (
            <div className={`text-center py-14 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
              <div className="text-5xl mb-3">🧩</div>
              <div className="text-sm font-medium">Aucun jeu incomplet</div>
              <div className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-gray-300'}`}>
                Utilisez le bouton 🧩 sur un jeu du stock pour l'ajouter ici
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(incByGame).map(([gameName, items]) => (
                <div key={gameName} className={`rounded-2xl overflow-hidden shadow-sm ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
                  {/* Header jeu */}
                  <div className={`px-4 py-3 flex items-center justify-between border-b ${dm ? 'border-slate-700 bg-slate-750' : 'border-gray-100 bg-gray-50'}`}>
                    <div>
                      <span className={`font-bold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>{gameName}</span>
                      <span className={`ml-2 text-xs ${dm ? 'text-slate-400' : 'text-gray-400'}`}>{items.length} exemplaire{items.length > 1 ? 's' : ''} incomplet{items.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {/* Entrées */}
                  {items.map((item, idx) => (
                    <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${idx > 0 ? `border-t ${dm ? 'border-slate-700/50' : 'border-gray-50'}` : ''}`}>
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${dm ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {item.missing_items ? (
                          <p className={`text-sm leading-relaxed ${dm ? 'text-slate-300' : 'text-gray-600'}`}>
                            <span className={`font-semibold text-xs uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-gray-400'}`}>Manque : </span>
                            {item.missing_items}
                          </p>
                        ) : (
                          <p className={`text-sm italic ${dm ? 'text-slate-500' : 'text-gray-400'}`}>Pièces manquantes non précisées</p>
                        )}
                        <p className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-gray-300'}`}>
                          Ajouté le {formatDate(item.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteIncomplete(item.id, gameName)}
                        title="Supprimer"
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition ${
                          dm ? 'text-slate-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
                        }`}
                      >✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Jeux en vente dans photos mais absents du stock */}
          {orphanEnVente.length > 0 && (
            <div className={`rounded-2xl overflow-hidden shadow-sm ${dm ? 'bg-slate-800/60 border border-slate-700' : 'bg-amber-50 border border-amber-200'}`}>
              <div className={`px-4 py-3 border-b flex items-start gap-2 ${dm ? 'border-slate-700' : 'border-amber-200'}`}>
                <span className="text-base mt-0.5">⚠️</span>
                <div>
                  <span className={`font-bold text-sm ${dm ? 'text-amber-300' : 'text-amber-800'}`}>
                    {orphanEnVente.length} jeu{orphanEnVente.length > 1 ? 'x' : ''} en vente sans stock renseigné
                  </span>
                  <p className={`text-xs mt-0.5 ${dm ? 'text-slate-400' : 'text-amber-600'}`}>
                    Ces jeux apparaissent "En vente" dans Photos mais n'ont pas de transaction d'achat enregistrée.
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {orphanEnVente.map(name => (
                  <span key={name} className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    dm ? 'bg-slate-700 text-slate-300' : 'bg-white text-amber-800 border border-amber-200'
                  }`}>{name}</span>
                ))}
              </div>
            </div>
          )}
      )}

      {/* ── Modal ajout manuel ──────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl border p-6 ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">📦 Ajouter au stock</h2>
              <button onClick={() => setShowAddModal(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dm ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'}`}>✕</button>
            </div>

            <div className="mb-4 relative" ref={addWrapRef} onClick={e => e.stopPropagation()}>
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Nom du jeu</label>
              <input
                type="text" value={addName} autoFocus
                onChange={e => { setAddName(e.target.value); setShowAddSugg(true); }}
                onFocus={() => setShowAddSugg(true)}
                placeholder="Ex: Catan, 7 Wonders…"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${dm ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-400'}`}
              />
              {showAddSugg && addSugg.length > 0 && (
                <div className={`absolute z-20 w-full mt-1 rounded-xl shadow-xl border overflow-hidden ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
                  {addSugg.map(s => (
                    <button key={s} onMouseDown={() => { setAddName(s); setShowAddSugg(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${dm ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-50 text-gray-900'}`}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Quantité</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setAddQty(q => String(Math.max(1, parseInt(q, 10) - 1)))} className={`w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center transition ${dm ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>−</button>
                <input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)}
                  className={`flex-1 text-center px-3 py-2.5 rounded-xl border text-base font-black outline-none ${dm ? 'bg-slate-900 border-slate-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                />
                <button onClick={() => setAddQty(q => String(parseInt(q, 10) + 1))} className={`w-11 h-11 rounded-xl font-bold text-xl flex items-center justify-center transition ${dm ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>+</button>
              </div>
            </div>

            {addName.trim() && parseInt(addQty, 10) >= 1 && (
              <div className={`mb-4 px-3 py-2.5 rounded-xl text-sm text-center font-medium ${dm ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                Ajouter <span className="font-black">{addQty}</span> × "<span className="font-black">{addName.trim()}</span>" au stock
              </div>
            )}

            <button onClick={handleAddManual} disabled={!addName.trim() || parseInt(addQty, 10) < 1 || addLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                !addName.trim() || parseInt(addQty, 10) < 1 || addLoading
                  ? 'opacity-50 cursor-not-allowed bg-indigo-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              }`}
            >
              {addLoading ? <><span className="animate-spin">⏳</span> Ajout…</> : <>✅ Confirmer l'ajout</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal "Mettre en incomplet" ─────────────────────────── */}
      {showIncModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowIncModal(false)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl border p-6 ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">🧩 Jeu incomplet</h2>
              <button onClick={() => setShowIncModal(false)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dm ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'}`}>✕</button>
            </div>

            <p className={`text-sm mb-4 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
              1 "<span className="font-bold">{incModalGame}</span>" sera retiré du stock complet et ajouté aux incomplets.
            </p>

            <div className="mb-5">
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                Pièces manquantes <span className="normal-case font-normal">(optionnel)</span>
              </label>
              <textarea
                value={incModalText}
                onChange={e => setIncModalText(e.target.value)}
                autoFocus
                placeholder="Ex: 2 tuiles rivière, 1 plateau joueur violet…"
                rows={3}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none transition ${dm ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-rose-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-400'}`}
              />
            </div>

            <button onClick={handleMoveToIncomplete} disabled={incModalLoading}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                incModalLoading
                  ? 'opacity-50 cursor-not-allowed bg-rose-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              }`}
            >
              {incModalLoading ? <><span className="animate-spin">⏳</span> Déplacement…</> : <>🧩 Déplacer vers incomplets</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs ${
          toast.type === 'error'
            ? dm ? 'bg-red-900/80 text-red-200 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200'
            : dm ? 'bg-green-900/80 text-green-200 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {toast.type === 'error' ? '❌' : '✅'}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
