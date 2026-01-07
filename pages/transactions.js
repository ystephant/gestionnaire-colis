import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function TransactionsTracker() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [buyTransactions, setBuyTransactions] = useState([]);
  const [sellTransactions, setSellTransactions] = useState([]);
  
  const [gameName, setGameName] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  
  const [expandedBuyMonths, setExpandedBuyMonths] = useState(new Set());
  const [expandedSellMonths, setExpandedSellMonths] = useState(new Set());
  const [statsView, setStatsView] = useState(false);
  const [gameNameSuggestions, setGameNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      loadTransactions();
      const cleanup = subscribeToChanges();
      return cleanup;
    }
  }, [isLoggedIn, username]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
      setLoading(false);
    } else {
      router.push('/');
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!username) return;
    
    try {
      const { data: buys, error: buyError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', username)
        .eq('type', 'buy')
        .order('created_at', { ascending: false });

      const { data: sells, error: sellError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', username)
        .eq('type', 'sell')
        .order('created_at', { ascending: false });

      if (buyError) throw buyError;
      if (sellError) throw sellError;

      setBuyTransactions(buys || []);
      setSellTransactions(sells || []);

      // Extract unique game names for autocomplete
      const allTransactions = [...(buys || []), ...(sells || [])];
      const uniqueNames = [...new Set(allTransactions
        .map(t => t.game_name)
        .filter(name => name && name.trim() !== '')
      )].sort();
      setGameNameSuggestions(uniqueNames);

      // Auto-expand current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      setExpandedBuyMonths(new Set([currentMonth]));
      setExpandedSellMonths(new Set([currentMonth]));
    } catch (error) {
      console.error('Erreur de chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    if (!username) return () => {};
    
    console.log('Subscribing to changes for user:', username);
    
    const channel = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${username}`
        },
        (payload) => {
          console.log('Change received!', payload);
          loadTransactions();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from changes');
      supabase.removeChannel(channel);
    };
  };

  const parsePrice = (value) => {
    return parseFloat(value.replace(',', '.')) || 0;
  };

  const addBuy = async () => {
    if (!buyPrice.trim()) return;
    if (!username) {
      alert('Erreur: utilisateur non connecté');
      return;
    }

    const price = parsePrice(buyPrice);
    if (price <= 0) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          user_id: username,
          type: 'buy',
          game_name: gameName.trim() || null,
          price: price,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      
      console.log('Transaction ajoutée:', data);
      setBuyPrice('');
      setGameName('');
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      alert('Erreur lors de l\'ajout: ' + error.message);
    }
  };

  const addSell = async () => {
    if (!sellPrice.trim()) return;
    if (!username) {
      alert('Erreur: utilisateur non connecté');
      return;
    }

    const price = parsePrice(sellPrice);
    if (price <= 0) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          user_id: username,
          type: 'sell',
          game_name: gameName.trim() || null,
          price: price,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      
      console.log('Transaction ajoutée:', data);
      setSellPrice('');
      setGameName('');
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      alert('Erreur lors de l\'ajout: ' + error.message);
    }
  };

  const deleteTransaction = async (id) => {
    if (!confirm('Supprimer cette transaction ?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const archiveOldData = async () => {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    try {
      const { data: oldTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', username)
        .lt('created_at', cutoffDate.toISOString());

      if (oldTransactions && oldTransactions.length > 0) {
        await supabase
          .from('transactions_archive')
          .insert(oldTransactions);

        await supabase
          .from('transactions')
          .delete()
          .eq('user_id', username)
          .lt('created_at', cutoffDate.toISOString());

        alert(`${oldTransactions.length} transaction(s) archivée(s)`);
      } else {
        alert('Aucune transaction à archiver');
      }
    } catch (error) {
      console.error('Erreur d\'archivage:', error);
    }
  };

  const exportToExcel = () => {
    // Prepare data for export
    const allData = [];
    
    // Header row
    allData.push(['TYPE', 'NOM DU JEU', 'PRIX (€)', 'DATE']);
    allData.push([]); // Empty row
    
    // Buy transactions
    allData.push(['ACHATS']);
    buyTransactions.forEach(t => {
      allData.push([
        'Achat',
        t.game_name || 'Jeu non renseigné',
        t.price.toFixed(2),
        formatDate(t.created_at)
      ]);
    });
    
    allData.push([]); // Empty row
    allData.push(['Total Achats', '', globalStats.totalBuy.toFixed(2) + '€']);
    allData.push([]); // Empty row
    
    // Sell transactions
    allData.push(['VENTES']);
    sellTransactions.forEach(t => {
      allData.push([
        'Vente',
        t.game_name || 'Jeu non renseigné',
        t.price.toFixed(2),
        formatDate(t.created_at)
      ]);
    });
    
    allData.push([]); // Empty row
    allData.push(['Total Ventes', '', globalStats.totalSell.toFixed(2) + '€']);
    allData.push([]); // Empty row
    
    // Summary
    allData.push(['RÉSUMÉ']);
    allData.push(['Total Achats', globalStats.buyCount + ' transactions', globalStats.totalBuy.toFixed(2) + '€']);
    allData.push(['Total Ventes', globalStats.sellCount + ' transactions', globalStats.totalSell.toFixed(2) + '€']);
    allData.push(['Bénéfice', '', (globalStats.profit >= 0 ? '+' : '') + globalStats.profit.toFixed(2) + '€']);
    allData.push(['Marge', '', (globalStats.profitPercent >= 0 ? '+' : '') + globalStats.profitPercent.toFixed(1) + '%']);
    
    // Convert to CSV format
    const csvContent = allData.map(row => row.join('\t')).join('\n');
    
    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTop10MostBoughtGames = () => {
    const gameCounts = {};
    
    buyTransactions
      .filter(t => t.game_name && t.game_name.trim() !== '')
      .forEach(t => {
        const name = t.game_name.trim();
        gameCounts[name] = (gameCounts[name] || 0) + 1;
      });
    
    return Object.entries(gameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  };

  const getTop10MostProfitableGames = () => {
    const gameStats = {};
    
    // Calculate buys per game
    buyTransactions
      .filter(t => t.game_name && t.game_name.trim() !== '')
      .forEach(t => {
        const name = t.game_name.trim();
        if (!gameStats[name]) gameStats[name] = { buys: 0, sells: 0 };
        gameStats[name].buys += t.price;
      });
    
    // Calculate sells per game
    sellTransactions
      .filter(t => t.game_name && t.game_name.trim() !== '')
      .forEach(t => {
        const name = t.game_name.trim();
        if (!gameStats[name]) gameStats[name] = { buys: 0, sells: 0 };
        gameStats[name].sells += t.price;
      });
    
    // Calculate profit
    return Object.entries(gameStats)
      .map(([name, stats]) => ({
        name,
        profit: stats.sells - stats.buys
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  };

  const handleGameNameChange = (value) => {
    setGameName(value);
    setShowSuggestions(value.length > 0);
  };

  const selectSuggestion = (suggestion) => {
    setGameName(suggestion);
    setShowSuggestions(false);
  };

  const filteredSuggestions = gameNameSuggestions.filter(name => 
    name.toLowerCase().includes(gameName.toLowerCase())
  );

  const groupByMonth = (transactions) => {
    const groups = {};
    transactions.forEach(t => {
      const month = t.created_at.slice(0, 7);
      if (!groups[month]) groups[month] = [];
      groups[month].push(t);
    });
    return groups;
  };

  const calculateStats = (buys, sells) => {
    const totalBuy = buys.reduce((sum, t) => sum + t.price, 0);
    const totalSell = sells.reduce((sum, t) => sum + t.price, 0);
    const profit = totalSell - totalBuy;
    const profitPercent = totalBuy > 0 ? ((profit / totalBuy) * 100) : 0;

    return {
      totalBuy,
      totalSell,
      profit,
      profitPercent,
      buyCount: buys.length,
      sellCount: sells.length
    };
  };

  const getChartData = () => {
    let buysToUse = buyTransactions;
    let sellsToUse = sellTransactions;
    
    // Filter by selected game if any
    if (selectedGameFilter) {
      buysToUse = buyTransactions.filter(t => t.game_name === selectedGameFilter);
      sellsToUse = sellTransactions.filter(t => t.game_name === selectedGameFilter);
    }
    
    const allMonths = new Set([
      ...Object.keys(groupByMonth(buysToUse)),
      ...Object.keys(groupByMonth(sellsToUse))
    ]);

    const sortedMonths = Array.from(allMonths).sort();
    
    return sortedMonths.map(month => {
      const buyMonth = groupByMonth(buysToUse)[month] || [];
      const sellMonth = groupByMonth(sellsToUse)[month] || [];
      
      const buyTotal = buyMonth.reduce((sum, t) => sum + t.price, 0);
      const sellTotal = sellMonth.reduce((sum, t) => sum + t.price, 0);
      
      return {
        month: formatMonthYear(month),
        achats: parseFloat(buyTotal.toFixed(2)),
        ventes: parseFloat(sellTotal.toFixed(2)),
        benefice: parseFloat((sellTotal - buyTotal).toFixed(2))
      };
    });
  };

  const toggleMonth = (month, type) => {
    if (type === 'buy') {
      const newExpanded = new Set(expandedBuyMonths);
      if (newExpanded.has(month)) {
        newExpanded.delete(month);
      } else {
        newExpanded.add(month);
      }
      setExpandedBuyMonths(newExpanded);
    } else {
      const newExpanded = new Set(expandedSellMonths);
      if (newExpanded.has(month)) {
        newExpanded.delete(month);
      } else {
        newExpanded.add(month);
      }
      setExpandedSellMonths(newExpanded);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMonthYear = (monthString) => {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  };

  const buyMonthlyGroups = groupByMonth(buyTransactions);
  const sellMonthlyGroups = groupByMonth(sellTransactions);
  const globalStats = calculateStats(buyTransactions, sellTransactions);
  const chartData = getChartData();
  const top10MostBought = getTop10MostBoughtGames();
  const top10MostProfitable = getTop10MostProfitableGames();

  const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#8b5cf6'];

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-slate-100'} flex items-center justify-center`}>
        <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-slate-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Suivi Achats/Ventes
                </h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Synchronisation en temps réel
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={exportToExcel}
                className={`px-4 py-2 rounded-xl font-semibold transition text-sm ${
                  darkMode 
                    ? 'bg-green-700 text-white hover:bg-green-600' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title="Exporter en CSV"
              >
                📥 Exporter
              </button>
              
              <button
                onClick={() => setStatsView(!statsView)}
                className={`px-4 py-2 rounded-xl font-semibold transition ${
                  statsView
                    ? 'bg-indigo-600 text-white'
                    : darkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {statsView ? '📝 Transactions' : '📊 Statistiques'}
              </button>
              
              <button
                onClick={toggleDarkMode}
                className={`p-3 rounded-xl transition ${
                  darkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>

        {!statsView ? (
          <>
            {/* Input Section */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="relative">
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Nom du jeu (optionnel)
                  </label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => handleGameNameChange(e.target.value)}
                    onFocus={() => setShowSuggestions(gameName.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Ex: Catane"
                    className={`w-full px-4 py-3 rounded-lg border-2 focus:border-indigo-500 focus:outline-none transition ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                  
                  {/* Autocomplete suggestions */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                      darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                    }`}>
                      {filteredSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => selectSuggestion(suggestion)}
                          className={`w-full text-left px-4 py-2 hover:bg-indigo-500 hover:text-white transition ${
                            darkMode ? 'text-gray-200' : 'text-gray-800'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Prix d'achat (€)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addBuy()}
                      placeholder="8 ou 8.5"
                      className={`flex-1 px-4 py-3 rounded-lg border-2 focus:border-red-500 focus:outline-none transition ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                          : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                    <button
                      onClick={addBuy}
                      className="px-6 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Prix de vente (€)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSell()}
                      placeholder="25 ou 25.5"
                      className={`flex-1 px-4 py-3 rounded-lg border-2 focus:border-green-500 focus:outline-none transition ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                          : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                    <button
                      onClick={addSell}
                      className="px-6 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Stats */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
              <div className="grid md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Achats
                  </div>
                  <div className="text-2xl font-bold text-red-500">
                    {globalStats.totalBuy.toFixed(2)}€
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {globalStats.buyCount} transactions
                  </div>
                </div>

                <div>
                  <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Ventes
                  </div>
                  <div className="text-2xl font-bold text-green-500">
                    {globalStats.totalSell.toFixed(2)}€
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {globalStats.sellCount} transactions
                  </div>
                </div>

                <div>
                  <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Bénéfice
                  </div>
                  <div className={`text-2xl font-bold ${globalStats.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {globalStats.profit >= 0 ? '+' : ''}{globalStats.profit.toFixed(2)}€
                  </div>
                </div>

                <div>
                  <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Marge
                  </div>
                  <div className={`text-2xl font-bold ${globalStats.profitPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {globalStats.profitPercent >= 0 ? '+' : ''}{globalStats.profitPercent.toFixed(1)}%
                  </div>
                </div>

                <div>
                  <div className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Transactions
                  </div>
                  <div className={`text-2xl font-bold ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    {buyTransactions.length + sellTransactions.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Two Columns Layout */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Buy Column */}
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                  <span className="text-red-500">📥</span> Achats
                </h2>
                <div className="space-y-4">
                  {Object.keys(buyMonthlyGroups).sort().reverse().map(month => {
                    const monthTransactions = buyMonthlyGroups[month];
                    const isExpanded = expandedBuyMonths.has(month);
                    const monthTotal = monthTransactions.reduce((sum, t) => sum + t.price, 0);

                    return (
                      <div key={month} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden`}>
                        <button
                          onClick={() => toggleMonth(month, 'buy')}
                          className={`w-full p-4 flex items-center justify-between hover:bg-opacity-80 transition ${
                            darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {isExpanded ? '▼' : '▶'}
                            </div>
                            <div className="text-left">
                              <h3 className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                {formatMonthYear(month)}
                              </h3>
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {monthTransactions.length} transactions
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-500">
                              -{monthTotal.toFixed(2)}€
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="p-4 space-y-2">
                              {monthTransactions.map(transaction => (
                                <div
                                  key={transaction.id}
                                  className={`flex items-center justify-between p-3 rounded-lg ${
                                    darkMode ? 'bg-red-900 bg-opacity-20' : 'bg-red-50'
                                  }`}
                                >
                                  <div>
                                    <div className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {transaction.game_name || 'Jeu non renseigné'}
                                    </div>
                                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {formatDate(transaction.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="font-bold text-red-500">
                                      -{transaction.price.toFixed(2)}€
                                    </div>
                                    <button
                                      onClick={() => deleteTransaction(transaction.id)}
                                      className={`p-1.5 rounded-lg transition ${
                                        darkMode 
                                          ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' 
                                          : 'hover:bg-gray-200 text-gray-600 hover:text-red-600'
                                      }`}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {buyTransactions.length === 0 && (
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-8 text-center`}>
                      <div className={`text-4xl mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>📥</div>
                      <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Aucun achat enregistré
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sell Column */}
              <div>
                <h2 className={`text-2xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                  <span className="text-green-500">📤</span> Ventes
                </h2>
                <div className="space-y-4">
                  {Object.keys(sellMonthlyGroups).sort().reverse().map(month => {
                    const monthTransactions = sellMonthlyGroups[month];
                    const isExpanded = expandedSellMonths.has(month);
                    const monthTotal = monthTransactions.reduce((sum, t) => sum + t.price, 0);

                    return (
                      <div key={month} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg overflow-hidden`}>
                        <button
                          onClick={() => toggleMonth(month, 'sell')}
                          className={`w-full p-4 flex items-center justify-between hover:bg-opacity-80 transition ${
                            darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-xl ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {isExpanded ? '▼' : '▶'}
                            </div>
                            <div className="text-left">
                              <h3 className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                                {formatMonthYear(month)}
                              </h3>
                              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {monthTransactions.length} transactions
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-500">
                              +{monthTotal.toFixed(2)}€
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="p-4 space-y-2">
                              {monthTransactions.map(transaction => (
                                <div
                                  key={transaction.id}
                                  className={`flex items-center justify-between p-3 rounded-lg ${
                                    darkMode ? 'bg-green-900 bg-opacity-20' : 'bg-green-50'
                                  }`}
                                >
                                  <div>
                                    <div className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                      {transaction.game_name || 'Jeu non renseigné'}
                                    </div>
                                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      {formatDate(transaction.created_at)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="font-bold text-green-500">
                                      +{transaction.price.toFixed(2)}€
                                    </div>
                                    <button
                                      onClick={() => deleteTransaction(transaction.id)}
                                      className={`p-1.5 rounded-lg transition ${
                                        darkMode 
                                          ? 'hover:bg-gray-700 text-gray-400 hover:text-green-400' 
                                          : 'hover:bg-gray-200 text-gray-600 hover:text-green-600'
                                      }`}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {sellTransactions.length === 0 && (
                    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-8 text-center`}>
                      <div className={`text-4xl mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>📤</div>
                      <p className={`${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Aucune vente enregistrée
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Statistics View with Charts */
          <div className="space-y-6">
            {/* Game Filter */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Filtrer par jeu
              </label>
              <select
                value={selectedGameFilter}
                onChange={(e) => setSelectedGameFilter(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 focus:border-indigo-500 focus:outline-none transition ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <option value="">Tous les jeux</option>
                {gameNameSuggestions.map((name, index) => (
                  <option key={index} value={name}>{name}</option>
                ))}
              </select>
            </div>
            
            {/* Line Chart - Evolution */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                📈 Évolution des transactions
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: darkMode ? '#f3f4f6' : '#111827'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="achats" stroke="#ef4444" strokeWidth={2} name="Achats" />
                  <Line type="monotone" dataKey="ventes" stroke="#22c55e" strokeWidth={2} name="Ventes" />
                  <Line type="monotone" dataKey="benefice" stroke="#3b82f6" strokeWidth={2} name="Bénéfice" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart - Comparaison */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                📊 Comparaison mensuelle
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="month" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: darkMode ? '#f3f4f6' : '#111827'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="achats" fill="#ef4444" name="Achats" />
                  <Bar dataKey="ventes" fill="#22c55e" name="Ventes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - Répartition */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  🎯 Répartition Achats/Ventes
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Achats', value: globalStats.totalBuy },
                        { name: 'Ventes', value: globalStats.totalSell }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#22c55e" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Stats Table */}
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  📋 Statistiques détaillées
                </h2>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {chartData.reverse().map((data, index) => (
                    <div key={index} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className={`font-bold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {data.month}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Achats:</span>
                          <div className="font-bold text-red-500">{data.achats.toFixed(2)}€</div>
                        </div>
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Ventes:</span>
                          <div className="font-bold text-green-500">{data.ventes.toFixed(2)}€</div>
                        </div>
                        <div>
                          <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Bénéfice:</span>
                          <div className={`font-bold ${data.benefice >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {data.benefice >= 0 ? '+' : ''}{data.benefice.toFixed(2)}€
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top 10 Charts */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top 10 Most Bought Games */}
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  🔥 Top 10 Jeux les Plus Achetés
                </h2>
                {top10MostBought.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={top10MostBought} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis type="number" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                      <YAxis dataKey="name" type="category" width={100} stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: darkMode ? '#f3f4f6' : '#111827'
                        }}
                      />
                      <Bar dataKey="count" fill="#ef4444" name="Nombre d'achats" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Aucun jeu avec nom renseigné
                  </p>
                )}
              </div>

              {/* Top 10 Most Profitable Games */}
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
                <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  💰 Top 10 Jeux les Plus Rentables
                </h2>
                {top10MostProfitable.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={top10MostProfitable} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis type="number" stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                      <YAxis dataKey="name" type="category" width={100} stroke={darkMode ? '#9ca3af' : '#6b7280'} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: darkMode ? '#f3f4f6' : '#111827'
                        }}
                        formatter={(value) => [`${value.toFixed(2)}€`, 'Bénéfice']}
                      />
                      <Bar dataKey="profit" name="Bénéfice">
                        {top10MostProfitable.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Aucun jeu avec nom renseigné
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
