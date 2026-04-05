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

const isLot = (name) => /\blot\b/i.test(name || '');

const baseName = (name) => {
  if (!name) return '';
  const plusIdx = name.indexOf(' +');
  return (plusIdx !== -1 ? name.slice(0, plusIdx) : name).trim();
};
const baseNameLow = (name) => baseName(name).toLowerCase();

// ── [8] Skeleton Card ──────────────────────────────────────────
const SkeletonCard = ({ dm }) => (
  <div className={`rounded-2xl overflow-hidden shadow-sm animate-pulse ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}>
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0 space-y-2">
        <div className={`h-4 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} style={{ width: '55%' }} />
        <div className="flex gap-1.5">
          <div className={`h-3 rounded-full ${dm ? 'bg-slate-700' : 'bg-gray-100'}`} style={{ width: '22%' }} />
          <div className={`h-3 rounded-full ${dm ? 'bg-slate-700' : 'bg-gray-100'}`} style={{ width: '18%' }} />
        </div>
      </div>
      <div className={`w-7 h-7 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} />
      <div className={`w-7 h-7 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} />
      <div className="flex items-center gap-1">
        <div className={`w-8 h-8 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} />
        <div className={`w-10 h-8 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} />
        <div className={`w-8 h-8 rounded-lg ${dm ? 'bg-slate-700' : 'bg-gray-200'}`} />
      </div>
    </div>
  </div>
);

export default function StockManager() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [loading,  setLoading]  = useState(true);

  // ── Data ─────────────────────────────────────────────────────
  const [transactions,    setTransactions]    = useState([]);
  const [salePhotos,      setSalePhotos]      = useState([]);
  const [incompleteGames, setIncompleteGames] = useState([]);
  const [allGameNames,    setAllGameNames]    = useState([]);

  // ── Onglet actif ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('stock');

  // ── UI Stock ─────────────────────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [showSearchSugg, setShowSearchSugg] = useState(false);
  const [filter,         setFilter]         = useState('all');
  const [sortMode,       setSortMode]       = useState('smart');
  const [toast,          setToast]          = useState(null); // { msg, type, action? }

  // ── Modal ajout manuel ───────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName,      setAddName]      = useState('');
  const [addQty,       setAddQty]       = useState('1');
  const [showAddSugg,  setShowAddSugg]  = useState(false);
  const [addLoading,   setAddLoading]   = useState(false);

  // ── Modal "Mettre en incomplet" ──────────────────────────────
  const [showIncModal,    setShowIncModal]    = useState(false);
  const [incModalGame,    setIncModalGame]    = useState('');
  const [incModalText,    setIncModalText]    = useState('');
  const [incModalLoading, setIncModalLoading] = useState(false);
  // [10] entrée libre depuis l'onglet incomplets
  const [incModalFreeEntry, setIncModalFreeEntry] = useState(false);

  // ── Search onglet incomplet ──────────────────────────────────
  const [searchInc, setSearchInc] = useState('');

  // ── [11] Édition inline d'un incomplet ──────────────────────
  const [editingInc,    setEditingInc]    = useState(null); // { id, text }
  const [editIncLoading,setEditIncLoading]= useState(false);

  // ── [13] Swipe-to-action ─────────────────────────────────────
  const [swipedCard, setSwipedCard] = useState(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const searchWrapRef = useRef(null);
  const addWrapRef    = useRef(null);
  const toastTimerRef = useRef(null);

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    const u = localStorage.getItem('username');
    const p = localStorage.getItem('password');
    if (u && p) { setUsername(u); } else { router.push('/'); }
  }, []);

  // ── [7] Persistance sessionStorage ───────────────────────────
  useEffect(() => {
    const sf = sessionStorage.getItem('stock_filter');
    const ss = sessionStorage.getItem('stock_sort');
    const sq = sessionStorage.getItem('stock_search');
    if (sf) setFilter(sf);
    if (ss) setSortMode(ss);
    if (sq) setSearch(sq);
  }, []);
  useEffect(() => { sessionStorage.setItem('stock_filter', filter);  }, [filter]);
  useEffect(() => { sessionStorage.setItem('stock_sort',   sortMode);}, [sortMode]);
  useEffect(() => { sessionStorage.setItem('stock_search', search);  }, [search]);

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

      setTransactions(txRes.data    || []);
      setSalePhotos(photoRes.data   || []);
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
  const computeStock = () => {
    const now   = Date.now();
    const LIMIT = INCOMING_DAYS * 24 * 60 * 60 * 1000;
    const map   = {};

    (transactions || []).forEach(t => {
      if (!t.game_name || isLot(t.game_name)) return;
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

    const allTxNamesLow = (transactions || [])
      .filter(t => t.game_name && !isLot(t.game_name))
      .map(t => baseNameLow(t.game_name));

    const incompleteMap = {};
    (incompleteGames || []).forEach(i => {
      incompleteMap[i.game_name] = (incompleteMap[i.game_name] || 0) + 1;
    });

    const enVenteTagsPerName = {};
    (salePhotos || [])
      .filter(p => p.status === 'en_vente' && p.game_tag)
      .forEach(p => {
        const key = baseNameLow(p.game_tag.split(' \u2022 ')[0].trim());
        if (!enVenteTagsPerName[key]) enVenteTagsPerName[key] = new Set();
        enVenteTagsPerName[key].add(p.game_tag);
      });
    const enVenteCount = {};
    Object.entries(enVenteTagsPerName).forEach(([key, tags]) => {
      enVenteCount[key] = tags.size;
    });

    (salePhotos || [])
      .filter(p => p.status === 'en_vente' && p.game_tag)
      .forEach(p => {
        const name = baseName(p.game_tag.split(' \u2022 ')[0].trim());
        if (!map[name]) {
          map[name] = {
            name, buys: 0, sells: 0,
            manualRemovals: 0,
            incomingBuys: [],
            lastBuyDate: null, lastSellDate: null,
          };
        }
      });

    return Object.values(map)
      .map(g => {
        const incomingCount  = g.incomingBuys.length;
        const sortedIncoming = [...g.incomingBuys].sort((a, b) => a - b);
        const oldestIncoming = sortedIncoming[0] || null;
        const daysLeft = oldestIncoming
          ? Math.max(0, INCOMING_DAYS - Math.floor((now - oldestIncoming.getTime()) / 86400000))
          : null;

        const incompletCount = incompleteMap[g.name] || 0;
        const netRaw         = g.buys - g.sells - g.manualRemovals - incompletCount;
        const enVenteCopies  = enVenteCount[baseNameLow(g.name)] || 0;
        const isEnVente      = enVenteCopies > 0;
        const net            = Math.max(enVenteCopies, netRaw);
        const confirmedStock = Math.max(0, net - incomingCount);
        const canList        = confirmedStock > 0 && !isEnVente;

        const nameLow         = baseNameLow(g.name);
        const hasTxLooseMatch = allTxNamesLow.some(n =>
          n.includes(nameLow) || nameLow.includes(n)
        );

        return { ...g, incomingCount, daysLeft, incompletCount, net, confirmedStock, isEnVente, enVenteCopies, canList, hasTxLooseMatch };
      })
      .filter(g => g.net > 0);
  };

  // ── [2] Toast avec action (undo) ─────────────────────────────
  const showToast = (msg, type = 'success', action = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type, action });
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
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

  // [2] Retrait avec undo via .select() pour récupérer l'id
  const handleRemoveOne = async (gameName) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({ user_id: username, type: 'stock_remove', game_name: gameName, price: 0 })
        .select('id')
        .single();
      if (error) throw error;
      await loadData();
      showToast(`1 "${gameName}" retiré du stock`, 'success', {
        label: 'Annuler',
        fn: async () => {
          await supabase.from('transactions').delete().eq('id', data.id);
          await loadData();
          showToast('Action annulée ✓');
        },
      });
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

  const handleMoveToIncomplete = async () => {
    if (!incModalGame.trim()) return;
    setIncModalLoading(true);
    try {
      const { error } = await supabase.from('stock_incomplete').insert({
        user_id: username, game_name: incModalGame.trim(), missing_items: incModalText.trim(),
      });
      if (error) throw error;
      showToast(`"${incModalGame.trim()}" ajouté aux incomplets`);
      setShowIncModal(false); setIncModalGame(''); setIncModalText(''); setIncModalFreeEntry(false);
      await loadData();
    } catch (err) { showToast('Erreur lors de l\'enregistrement', 'error'); }
    finally { setIncModalLoading(false); }
  };

  const handleDeleteIncomplete = async (id, gameName) => {
    if (!confirm(`Supprimer "${gameName}" des incomplets ?`)) return;
    try {
      const { error } = await supabase.from('stock_incomplete').delete().eq('id', id);
      if (error) throw error;
      showToast(`"${gameName}" retiré des incomplets`);
      await loadData();
    } catch (err) { showToast('Erreur lors de la suppression', 'error'); }
  };

  // ── [11] Édition inline d'un incomplet ──────────────────────
  const handleEditIncomplete = async () => {
    if (!editingInc) return;
    setEditIncLoading(true);
    try {
      const { error } = await supabase
        .from('stock_incomplete')
        .update({ missing_items: editingInc.text.trim() })
        .eq('id', editingInc.id);
      if (error) throw error;
      showToast('Pièces manquantes mises à jour');
      setEditingInc(null);
      await loadData();
    } catch (err) { showToast('Erreur lors de la mise à jour', 'error'); }
    finally { setEditIncLoading(false); }
  };

  // ── [13] Touch handlers pour swipe ──────────────────────────
  const handleCardTouchStart = (e, gameName) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleCardTouchEnd = (e, gameName) => {
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Ignorer si mouvement surtout vertical (scroll)
    if (Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < -50) setSwipedCard(gameName);
    else if (dx > 20 && swipedCard === gameName) setSwipedCard(null);
  };

  // ── Données dérivées ─────────────────────────────────────────
  const stockItems    = computeStock();
  const lowStockCount = stockItems.filter(g => g.net === 1).length; // [12]

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
      if (sortMode === 'desc') return b.net - a.net;
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
    enVente:   stockItems.reduce((sum, g) => sum + (g.enVenteCopies || 0), 0),
    available: stockItems.filter(g => g.canList).length,
  };

  const stockNameSet  = new Set(stockItems.map(g => baseNameLow(g.name)));
  const orphanEnVente = [...new Set(
    (salePhotos || [])
      .filter(p => p.status === 'en_vente' && p.game_tag)
      .map(p => p.game_tag.split(' • ')[0].trim())
  )].filter(name => !stockNameSet.has(baseNameLow(name)))
    .sort((a, b) => a.localeCompare(b, 'fr'));

  const filteredInc = (incompleteGames || []).filter(i =>
    !searchInc || i.game_name.toLowerCase().includes(searchInc.toLowerCase())
  );

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
      onClick={() => { setShowSearchSugg(false); setShowAddSugg(false); setSwipedCard(null); }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-sm ${
        dm ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-gray-200'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition ${
              dm ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >← Accueil</button>

          <div className="flex-1 text-center">
            <span className="text-base font-bold">📦 Gestion de stock</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-xl text-lg transition ${dm ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}
          >{dm ? '☀️' : '🌙'}</button>

          {/* Bouton + contextuel selon l'onglet */}
          {activeTab === 'stock' && (
            <button
              onClick={() => { setShowAddModal(true); setAddName(''); setAddQty('1'); }}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold transition shadow-lg shadow-indigo-500/20"
            >+ Ajouter</button>
          )}
          {/* [10] Bouton + depuis l'onglet incomplets */}
          {activeTab === 'incomplet' && (
            <button
              onClick={() => { setIncModalFreeEntry(true); setIncModalGame(''); setIncModalText(''); setShowIncModal(true); }}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-sm font-bold transition shadow-lg shadow-rose-500/20"
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

          {/* [1] KPI Cards — cliquables comme raccourcis de filtre */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Références',  value: kpis.games,     icon: '🎲', cls: 'text-indigo-500', filterId: null,        tabSwitch: null },
              { label: 'Exemplaires', value: kpis.copies,    icon: '📦', cls: 'text-blue-500',   filterId: null,        tabSwitch: null },
              { label: 'En transit',  value: kpis.incoming,  icon: '🚚', cls: 'text-orange-500', filterId: 'incoming',  tabSwitch: null },
              { label: 'À vendre',    value: kpis.available, icon: '🏷️', cls: 'text-amber-500',  filterId: 'available', tabSwitch: null },
              { label: 'En vente',    value: kpis.enVente,   icon: '🟢', cls: 'text-green-500',  filterId: 'en_vente',  tabSwitch: null },
              { label: 'Incomplets',  value: (incompleteGames || []).length, icon: '🧩', cls: 'text-rose-500', filterId: null, tabSwitch: 'incomplet' },
            ].map(({ label, value, icon, cls, filterId, tabSwitch }) => {
              const isActive    = filterId && filter === filterId;
              const isClickable = !!(filterId || tabSwitch);
              return (
                <div
                  key={label}
                  onClick={() => {
                    if (tabSwitch) { setActiveTab(tabSwitch); return; }
                    if (filterId)  setFilter(f => f === filterId ? 'all' : filterId);
                  }}
                  title={filterId ? (isActive ? 'Effacer le filtre' : `Filtrer : ${label}`) : tabSwitch ? 'Voir les incomplets' : undefined}
                  className={`rounded-xl p-2.5 shadow-sm transition-all duration-150 ${
                    isClickable ? 'cursor-pointer hover:scale-[1.04] active:scale-95 select-none' : ''
                  } ${
                    isActive
                      ? dm ? 'bg-indigo-900/40 ring-2 ring-indigo-500' : 'bg-indigo-50 ring-2 ring-indigo-400'
                      : dm ? 'bg-slate-800' : 'bg-white border border-gray-100'
                  }`}
                >
                  <div className="text-base mb-0.5">{icon}</div>
                  <div className={`text-2xl font-black leading-none ${cls}`}>{value}</div>
                  <div className={`text-xs mt-1 leading-tight font-medium ${dm ? 'text-slate-400' : 'text-gray-500'}`}>{label}</div>
                  {isClickable && (
                    <div className={`text-xs mt-0.5 font-bold ${isActive ? (dm ? 'text-indigo-400' : 'text-indigo-400') : dm ? 'text-slate-600' : 'text-gray-300'}`}>
                      {isActive ? '✕' : tabSwitch ? '↗' : '→'}
                    </div>
                  )}
                </div>
              );
            })}
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

          {/* Filtres + tri */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className={`flex p-1 rounded-xl gap-1 overflow-x-auto scrollbar-none flex-1 ${dm ? 'bg-slate-800' : 'bg-gray-100'}`}>
              {[
                { id: 'all',       label: 'Tout' },
                { id: 'available', label: `🏷️ À vendre${kpis.available > 0 ? ' (' + kpis.available + ')' : ''}` },
                { id: 'en_vente',  label: `🟢 En vente${kpis.enVente > 0 ? ' (' + kpis.enVente + ')' : ''}` },
                { id: 'incoming',  label: `🚚 Transit${kpis.incoming > 0 ? ' (' + kpis.incoming + ')' : ''}` },
                // [12] Compteur stock bas dans le filtre
                { id: 'low',       label: `⚠️ Stock bas${lowStockCount > 0 ? ' (' + lowStockCount + ')' : ''}` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-shrink-0 py-2 px-3 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    filter === f.id
                      ? 'bg-indigo-600 text-white shadow'
                      : dm ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >{f.label}</button>
              ))}
            </div>
            <button
              onClick={() => setSortMode(m => m === 'smart' ? 'desc' : 'smart')}
              title={sortMode === 'desc' ? 'Tri : quantité décroissante' : 'Tri : intelligent'}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                sortMode === 'desc'
                  ? 'bg-indigo-600 text-white shadow'
                  : dm ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-800'
              }`}
            >📊 {sortMode === 'desc' ? 'Qté ↓' : 'Tri auto'}</button>
          </div>

          {/* [5] Compteur de résultats */}
          {!loading && (
            <div className={`flex items-center gap-3 text-xs font-medium px-1 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
              <span>{filteredItems.length} jeu{filteredItems.length !== 1 ? 'x' : ''} affiché{filteredItems.length !== 1 ? 's' : ''}</span>
              {(filter !== 'all' || search) && (
                <button
                  onClick={() => { setFilter('all'); setSearch(''); }}
                  className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                >Effacer les filtres</button>
              )}
            </div>
          )}

          {/* Liste */}
          {loading ? (
            // [8] Skeleton loading
            <div className="space-y-3 pb-10">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} dm={dm} />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={`text-center py-14 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
              <div className="text-5xl mb-3">📭</div>
              <div className="text-sm font-medium">Aucun jeu dans ce stock</div>
              {search && <button onClick={() => setSearch('')} className="mt-3 text-xs text-indigo-500 hover:underline">Effacer la recherche</button>}
            </div>
          ) : (
            <div className="space-y-3 pb-10">
              {filteredItems.map(g => (
                // [13] Wrapper pour swipe-to-action
                <div key={g.name} className="relative overflow-hidden rounded-2xl shadow-sm">

                  {/* Boutons révélés au swipe gauche */}
                  <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: 88 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSwipedCard(null); handleRemoveOne(g.name); }}
                      className="flex-1 flex flex-col items-center justify-center bg-red-500 hover:bg-red-400 active:bg-red-600 text-white text-xs gap-0.5 font-semibold transition"
                    >
                      <span className="text-lg font-black leading-none">−</span>
                      <span>Retirer</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSwipedCard(null); setIncModalGame(g.name); setIncModalText(''); setIncModalFreeEntry(false); setShowIncModal(true); }}
                      className="flex-1 flex flex-col items-center justify-center bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white text-xs gap-0.5 font-semibold transition"
                    >
                      <span className="text-base">🧩</span>
                      <span>Incomplet</span>
                    </button>
                  </div>

                  {/* Carte principale (glisse à gauche au swipe) */}
                  <div
                    className={`relative z-10 rounded-2xl overflow-hidden transition-transform duration-200 ${dm ? 'bg-slate-800' : 'bg-white border border-gray-100'}`}
                    style={{ transform: swipedCard === g.name ? 'translateX(-88px)' : 'translateX(0)' }}
                    onTouchStart={(e) => handleCardTouchStart(e, g.name)}
                    onTouchEnd={(e)   => handleCardTouchEnd(e, g.name)}
                    onClick={() => { if (swipedCard === g.name) setSwipedCard(null); }}
                  >
                    {/* [3] Bannière canList avec bouton → Photos */}
                    {g.canList && (
                      <div className={`px-4 py-2 flex items-center justify-between gap-2 border-b-2 border-amber-400 ${dm ? 'bg-amber-900/25 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm flex-shrink-0">🏷️</span>
                          <span className="text-xs font-semibold truncate">
                            Tu peux mettre un nouveau <span className="font-black">"{g.name}"</span> en vente !
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push('/photos?game=' + encodeURIComponent(g.name)); }}
                          className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                            dm ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-300' : 'bg-amber-200 hover:bg-amber-300 text-amber-800'
                          }`}
                        >📸 Mettre en vente →</button>
                      </div>
                    )}

                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${dm ? 'text-white' : 'text-gray-900'}`}>
                            {g.name}
                          </span>
                          {/* [4] Badge "Dernier exemplaire" */}
                          {g.net === 1 && !g.isEnVente && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0 ${
                              dm ? 'bg-amber-900/30 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-600 border-amber-300'
                            }`}>⚠️ Dernier</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {g.isEnVente && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-green-50 text-green-600 border-green-200'}`}>
                              🟢 En vente{g.enVenteCopies > 1 ? ` (×${g.enVenteCopies})` : ''}
                            </span>
                          )}
                          {/* [9] Badge transit avec J-X plus lisible */}
                          {g.incomingCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                              🚚 {g.incomingCount} en transit{g.daysLeft !== null ? (g.daysLeft > 0 ? ` · J-${g.daysLeft}` : ' · Imminent') : ''}
                            </span>
                          )}
                          {g.incompletCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${dm ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                              🧩 {g.incompletCount} incomplet{g.incompletCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bouton → transactions */}
                      {g.hasTxLooseMatch && (
                        <button
                          onClick={() => router.push('/transactions?search=' + encodeURIComponent(g.name))}
                          title="Voir dans les transactions"
                          className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition ${
                            dm ? 'text-slate-600 hover:text-indigo-400 hover:bg-indigo-900/20' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'
                          }`}
                        >📋</button>
                      )}

                      {/* Bouton → incomplet */}
                      <button
                        onClick={() => { setIncModalGame(g.name); setIncModalText(''); setIncModalFreeEntry(false); setShowIncModal(true); }}
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
                </div>
              ))}
            </div>
          )}

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

          {/* [6] Recherche incomplets avec bouton clear */}
          <div className="relative">
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
            {searchInc && (
              <button
                onClick={() => setSearchInc('')}
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm ${dm ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
              >✕</button>
            )}
          </div>

          {/* Liste groupée */}
          {loading ? (
            // [8] Skeleton loading pour incomplets
            <div className="space-y-3 pb-10">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} dm={dm} />)}
            </div>
          ) : Object.keys(incByGame).length === 0 ? (
            <div className={`text-center py-14 ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
              <div className="text-5xl mb-3">🧩</div>
              <div className="text-sm font-medium">Aucun jeu incomplet</div>
              <div className={`text-xs mt-1 ${dm ? 'text-slate-600' : 'text-gray-300'}`}>
                Utilisez le bouton 🧩 sur une carte stock, ou "+ Ajouter" en haut à droite
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
                    <button
                      onClick={() => router.push(`/sav?search=${encodeURIComponent(gameName)}`)}
                      title="Accéder au SAV de ce jeu"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        dm ? 'bg-rose-900/40 text-rose-300 hover:bg-rose-800/60' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      }`}
                    >🔧 Voir le SAV</button>
                  </div>

                  {/* Entrées */}
                  {items.map((item, idx) => (
                    <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${idx > 0 ? `border-t ${dm ? 'border-slate-700/50' : 'border-gray-50'}` : ''}`}>
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${dm ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* [11] Zone éditable au clic */}
                        {editingInc?.id === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingInc.text}
                              onChange={e => setEditingInc(prev => ({ ...prev, text: e.target.value }))}
                              autoFocus
                              rows={2}
                              placeholder="Pièces manquantes…"
                              className={`w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none transition ${
                                dm ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-rose-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-400'
                              }`}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleEditIncomplete}
                                disabled={editIncLoading}
                                className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
                              >{editIncLoading ? '…' : '✓ Sauvegarder'}</button>
                              <button
                                onClick={() => setEditingInc(null)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              >Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingInc({ id: item.id, text: item.missing_items || '' })}
                            className="cursor-text group"
                            title="Cliquer pour modifier"
                          >
                            {item.missing_items ? (
                              <p className={`text-sm leading-relaxed ${dm ? 'text-slate-300' : 'text-gray-600'}`}>
                                <span className={`font-semibold text-xs uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-gray-400'}`}>Manque : </span>
                                {item.missing_items}
                                <span className={`ml-1.5 text-xs opacity-0 group-hover:opacity-60 transition-opacity ${dm ? 'text-slate-400' : 'text-gray-400'}`}>✏️</span>
                              </p>
                            ) : (
                              <p className={`text-sm italic ${dm ? 'text-slate-500' : 'text-gray-400'}`}>
                                Pièces manquantes non précisées
                                <span className={`ml-1.5 text-xs opacity-0 group-hover:opacity-60 transition-opacity ${dm ? 'text-slate-400' : 'text-gray-400'}`}>✏️</span>
                              </p>
                            )}
                          </div>
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

      {/* ── [10] Modal "Mettre en incomplet" (stock + entrée libre) */}
      {showIncModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => { setShowIncModal(false); setIncModalFreeEntry(false); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm mx-0 sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl border p-6 ${dm ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold">🧩 Jeu incomplet</h2>
              <button
                onClick={() => { setShowIncModal(false); setIncModalFreeEntry(false); }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${dm ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-400'}`}
              >✕</button>
            </div>

            {/* [10] Champ nom libre si ouvert depuis l'onglet incomplets */}
            {incModalFreeEntry ? (
              <div className="mb-4">
                <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>Nom du jeu</label>
                <input
                  type="text"
                  value={incModalGame}
                  autoFocus
                  onChange={e => setIncModalGame(e.target.value)}
                  placeholder="Ex: Catan, Wingspan…"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
                    dm ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-rose-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-400'
                  }`}
                />
              </div>
            ) : (
              <p className={`text-sm mb-4 ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                1 "<span className="font-bold">{incModalGame}</span>" sera compté comme incomplet dans le stock.
              </p>
            )}

            <div className="mb-5">
              <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-gray-500'}`}>
                Pièces manquantes <span className="normal-case font-normal">(optionnel)</span>
              </label>
              <textarea
                value={incModalText}
                onChange={e => setIncModalText(e.target.value)}
                autoFocus={!incModalFreeEntry}
                placeholder="Ex: 2 tuiles rivière, 1 plateau joueur violet…"
                rows={3}
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none transition ${dm ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-rose-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-rose-400'}`}
              />
            </div>

            <button
              onClick={handleMoveToIncomplete}
              disabled={incModalLoading || !incModalGame.trim()}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                incModalLoading || !incModalGame.trim()
                  ? 'opacity-50 cursor-not-allowed bg-rose-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              }`}
            >
              {incModalLoading ? <><span className="animate-spin">⏳</span> Enregistrement…</> : <>🧩 Confirmer</>}
            </button>
          </div>
        </div>
      )}

      {/* ── [2] Toast avec bouton Annuler ───────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs ${
          toast.type === 'error'
            ? dm ? 'bg-red-900/80 text-red-200 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200'
            : dm ? 'bg-green-900/80 text-green-200 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          <span className="flex-1">{toast.msg}</span>
          {toast.action && (
            <button
              onClick={() => { setToast(null); toast.action.fn(); }}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                dm ? 'border-green-600 hover:bg-green-800/40 text-green-300' : 'border-green-400 hover:bg-green-100 text-green-700'
              }`}
            >{toast.action.label}</button>
          )}
        </div>
      )}
    </div>
  );
}
