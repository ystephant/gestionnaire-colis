import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const shelfConfigs = {
  '2x2': { rows: 2, cols: 2, label: '77x77 cm (2x2)' },
  '2x4': { rows: 2, cols: 4, label: '77x147 cm (2x4)' },
  '4x4': { rows: 4, cols: 4, label: '147x147 cm (4x4)' },
  '4x2': { rows: 4, cols: 2, label: '147x77 cm (4x2)' },
};

export default function Ludotheque() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [shelves, setShelves] = useState([]);
  const [games, setGames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [draggedGame, setDraggedGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [gameRules, setGameRules] = useState({});
  const [shelfViewFilter, setShelfViewFilter] = useState('all');
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    checkAuth();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      loadData();
    }
  }, [isLoggedIn, username]);

  const checkAuth = async () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    
    setLoading(false);
  };

  const loadData = async () => {
    try {
      const { data: shelvesData, error: shelvesError } = await supabase
        .from('shelves')
        .select('*')
        .eq('user_id', username)
        .order('position', { ascending: true });

      if (shelvesError) throw shelvesError;

      if (!shelvesData || shelvesData.length === 0) {
        const { data: newShelf, error: createError } = await supabase
          .from('shelves')
          .insert([{ user_id: username, name: 'Étagère principale', size: '2x4', position: 0 }])
          .select();
        
        if (createError) throw createError;
        setShelves(newShelf || []);
      } else {
        setShelves(shelvesData);
      }

      const { data: gamesData, error: gamesError } = await supabase
        .from('board_games')
        .select('*')
        .eq('user_id', username)
        .order('created_at', { ascending: true });

      if (gamesError) throw gamesError;
      setGames(gamesData || []);

    } catch (error) {
      console.error('Erreur de chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToastMessage = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const addNewGame = async () => {
    if (!newGameName.trim() || !isOnline) return;

    try {
      const { data, error } = await supabase
        .from('board_games')
        .insert([{
          user_id: username,
          name: newGameName.trim(),
          players: '2-4',
          duration: 60,
          position: null,
          shelf_id: null
        }])
        .select();

      if (error) throw error;
      
      setGames([...games, ...data]);
      setNewGameName('');
      showToastMessage(`✅ "${newGameName.trim()}" ajouté`);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const duplicateGame = async (game) => {
    if (!isOnline) return;

    try {
      const { data, error } = await supabase
        .from('board_games')
        .insert([{
          user_id: username,
          name: game.name,
          players: game.players,
          duration: game.duration,
          position: null,
          shelf_id: null
        }])
        .select();

      if (error) throw error;
      setGames([...games, ...data]);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const deleteGame = async (gameId) => {
    if (!confirm('Supprimer ce jeu ?') || !isOnline) return;

    try {
      const { error } = await supabase
        .from('board_games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const updateGameInfo = async (gameId, field, value) => {
    if (!isOnline) return;

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ [field]: value })
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.map(g => g.id === gameId ? { ...g, [field]: value } : g));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleDrop = async (row, col, shelfId) => {
    if (!draggedGame || !isOnline) {
      setDraggedGame(null);
      return;
    }
    
    const position = `${row}-${col}`;

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ position, shelf_id: shelfId })
        .eq('id', draggedGame.id);

      if (error) throw error;
      setGames(games.map(g => g.id === draggedGame.id ? { ...g, position, shelf_id: shelfId } : g));
    } catch (error) {
      console.error('Erreur:', error);
    }

    setDraggedGame(null);
    setDropZoneActive(false);
  };

  const handleDropToDelete = async () => {
    if (draggedGame && draggedGame.position && isOnline) {
      try {
        const { error } = await supabase
          .from('board_games')
          .update({ position: null, shelf_id: null })
          .eq('id', draggedGame.id);

        if (error) throw error;
        setGames(games.map(g => g.id === draggedGame.id ? { ...g, position: null, shelf_id: null } : g));
      } catch (error) {
        console.error('Erreur:', error);
      }
    }
    
    setDraggedGame(null);
    setDropZoneActive(false);
  };

  const removeGameFromShelf = async (gameId) => {
    if (!isOnline) return;

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ position: null, shelf_id: null })
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.map(g => g.id === gameId ? { ...g, position: null, shelf_id: null } : g));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const addShelf = async () => {
    if (!isOnline) return;

    try {
      const maxPosition = shelves.length > 0 ? Math.max(...shelves.map(s => s.position || 0)) : 0;
      const { data, error } = await supabase
        .from('shelves')
        .insert([{
          user_id: username,
          name: `Étagère ${shelves.length + 1}`,
          size: '2x4',
          position: maxPosition + 1
        }])
        .select();

      if (error) throw error;
      setShelves([...shelves, ...data]);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const deleteShelf = async (shelfId) => {
    if (shelves.length === 1 || !confirm('Supprimer cette étagère ?') || !isOnline) return;

    try {
      await supabase
        .from('board_games')
        .update({ position: null, shelf_id: null })
        .eq('shelf_id', shelfId);

      const { error } = await supabase
        .from('shelves')
        .delete()
        .eq('id', shelfId);

      if (error) throw error;
      
      setShelves(shelves.filter(s => s.id !== shelfId));
      setGames(games.map(g => g.shelf_id === shelfId ? { ...g, position: null, shelf_id: null } : g));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const updateShelfSize = async (shelfId, size) => {
    if (!isOnline) return;

    try {
      const { error } = await supabase
        .from('shelves')
        .update({ size })
        .eq('id', shelfId);

      if (error) throw error;
      setShelves(shelves.map(s => s.id === shelfId ? { ...s, size } : s));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const updateShelfName = async (shelfId, name) => {
    if (!isOnline) return;

    try {
      const { error } = await supabase
        .from('shelves')
        .update({ name })
        .eq('id', shelfId);

      if (error) throw error;
      setShelves(shelves.map(s => s.id === shelfId ? { ...s, name } : s));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const generateGameRules = async (game) => {
    setSelectedGame(game);
    setIsLoadingRules(true);
    
    if (gameRules[game.name]) {
      setIsLoadingRules(false);
      return;
    }

    try {
      const { data: cachedRules, error: cacheError } = await supabase
        .from('game_rules')
        .select('rules_text')
        .eq('game_name', game.name)
        .single();

      if (cachedRules && !cacheError) {
        setGameRules(prev => ({ ...prev, [game.name]: cachedRules.rules_text }));
        setIsLoadingRules(false);
        return;
      }
    } catch (e) {
      // Pas de cache
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            { 
              role: "user", 
              content: `Génère un résumé des règles du jeu de société "${game.name}" en français avec : But du jeu, Nombre de joueurs (${game.players}), Durée (${game.duration} min), Matériel, Déroulement, Conditions de victoire. Maximum 500 mots.`
            }
          ],
        })
      });

      const data = await response.json();
      const rulesText = data.content.find(c => c.type === 'text')?.text || 'Règles non disponibles';
      
      await supabase
        .from('game_rules')
        .upsert({ game_name: game.name, rules_text: rulesText });

      setGameRules(prev => ({ ...prev, [game.name]: rulesText }));
    } catch (error) {
      console.error('Erreur IA:', error);
      setGameRules(prev => ({ ...prev, [game.name]: 'Erreur lors du chargement des règles.' }));
    }
    
    setIsLoadingRules(false);
  };

  const getPlayerColor = (players) => {
    const min = parseInt(players.split('-')[0]);
    if (min === 1) return 'bg-purple-300';
    if (min === 2) return 'bg-blue-300';
    if (min === 3) return 'bg-green-300';
    if (min === 4) return 'bg-yellow-300';
    if (min === 5) return 'bg-pink-300';
    if (min >= 6) return 'bg-orange-300';
    return darkMode ? 'bg-slate-600' : 'bg-slate-300';
  };

  const getDurationColor = (duration) => {
    if (duration <= 30) return 'bg-emerald-300';
    if (duration <= 60) return 'bg-lime-300';
    if (duration <= 90) return 'bg-amber-300';
    if (duration <= 120) return 'bg-rose-300';
    return 'bg-red-300';
  };

  const getGameColor = (game) => {
    if (shelfViewFilter === 'players') return getPlayerColor(game.players);
    if (shelfViewFilter === 'duration') return getDurationColor(game.duration);
    return darkMode ? 'bg-slate-700' : 'bg-white';
  };

  const handleDragStart = (game) => setDraggedGame(game);
  const handleDragOver = (e) => e.preventDefault();

  const unplacedGames = games.filter(g => !g.position);
  const filteredUnplacedGames = unplacedGames.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGamesAtPosition = (row, col, shelfId) => {
    return games.filter(g => g.position === `${row}-${col}` && g.shelf_id === shelfId);
  };

  const bgClass = darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-slate-50 to-slate-100';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = darkMode ? 'text-gray-100' : 'text-gray-800';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';
  const inputBg = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200';

  if (loading) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <div className={textPrimary}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} p-4 sm:p-6`}>
      <div className="max-w-4xl mx-auto">
        {showToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
            {toastMessage}
          </div>
        )}

        <div className={`${cardBg} rounded-2xl shadow-xl p-6 mb-6`}>
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
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>Ma Ludothèque</h1>
                <p className={`text-xs sm:text-sm ${textSecondary}`}>
                  Glissez-déposez pour réorganiser {isOnline ? '🟢' : '🔴'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-3 rounded-xl ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {darkMode ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={`${cardBg} rounded-xl shadow-lg p-4 sm:p-6 mb-6`}>
          <h2 className={`text-xl font-bold ${textPrimary} mb-4`}>Jeux disponibles</h2>
          
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewGame()}
              placeholder="Nom du jeu..."
              className={`flex-1 px-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary}`}
              disabled={!isOnline}
            />
            <button
              onClick={addNewGame}
              disabled={!isOnline}
              className={`p-2 rounded-lg ${isOnline ? 'bg-indigo-600 text-white' : 'bg-gray-400 text-gray-200'}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          <div className="relative mb-4">
            <svg className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${textSecondary}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className={`w-full pl-10 pr-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary}`}
            />
          </div>

          {draggedGame && draggedGame.position && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropZoneActive(true);
              }}
              onDragLeave={() => setDropZoneActive(false)}
              onDrop={handleDropToDelete}
              className={`mb-4 p-6 border-4 border-dashed rounded-lg ${
                dropZoneActive 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
                <span className={dropZoneActive ? 'text-red-500' : textSecondary}>
                  Glissez ici pour retirer
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredUnplacedGames.length === 0 ? (
              <p className={`${textSecondary} text-center py-8`}>
                {unplacedGames.length === 0 ? 'Tous rangés !' : 'Aucun jeu'}
              </p>
            ) : (
              filteredUnplacedGames.map(game => (
                <div
                  key={game.id}
                  draggable={isOnline}
                  onDragStart={() => handleDragStart(game)}
                  className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 rounded-lg group ${isOnline ? 'cursor-move' : 'opacity-70'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex-1">{game.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => duplicateGame(game)}
                        disabled={!isOnline}
                        className="p-1 rounded hover:bg-indigo-700"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteGame(game.id)}
                        disabled={!isOnline}
                        className="p-1 rounded hover:bg-red-500"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={game.players}
                        onChange={(e) => updateGameInfo(game.id, 'players', e.target.value)}
                        disabled={!isOnline}
                        className="w-12 bg-indigo-700 px-1 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <input
                        type="number"
                        value={game.duration}
                        onChange={(e) => updateGameInfo(game.id, 'duration', parseInt(e.target.value) || 0)}
                        disabled={!isOnline}
                        className="w-12 bg-indigo-700 px-1 rounded"
                      />
                      min
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`font-semibold ${textPrimary} mb-2`}>Légende</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-purple-300"></div>
                <span className={textSecondary}>1 joueur</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-300"></div>
                <span className={textSecondary}>2 joueurs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-300"></div>
                <span className={textSecondary}>3 joueurs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-300"></div>
                <span className={textSecondary}>4 joueurs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-pink-300"></div>
                <span className={textSecondary}>5 joueurs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-300"></div>
                <span className={textSecondary}>6+ joueurs</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${cardBg} rounded-xl shadow-lg p-4 mb-6`}>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setShelfViewFilter('all')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm ${
                shelfViewFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setShelfViewFilter('players')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm ${
                shelfViewFilter === 'players'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Joueurs
            </button>
            <button
              onClick={() => setShelfViewFilter('duration')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm ${
                shelfViewFilter === 'duration'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Durée
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <button
            onClick={addShelf}
            disabled={!isOnline}
            className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
              isOnline ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-400 text-gray-200'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter une étagère
          </button>

          {shelves.map(shelf => {
            const { rows, cols } = shelfConfigs[shelf.size];
            
            return (
              <div key={shelf.id} className={`${cardBg} rounded-xl shadow-lg p-4 sm:p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={shelf.name}
                    onChange={(e) => updateShelfName(shelf.id, e.target.value)}
                    disabled={!isOnline}
                    className={`text-lg font-bold ${textPrimary} bg-transparent border-b-2 border-transparent hover:border-indigo-500 focus:border-indigo-500 focus:outline-none px-2 flex-1`}
                  />
                  {shelves.length > 1 && (
                    <button
                      onClick={() => deleteShelf(shelf.id)}
                      disabled={!isOnline}
                      className={`p-2 rounded ml-2 ${
                        isOnline
                          ? darkMode ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'
                          : 'opacity-50'
                      }`}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <select
                    value={shelf.size}
                    onChange={(e) => updateShelfSize(shelf.id, e.target.value)}
                    disabled={!isOnline}
                    className={`w-full px-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary}`}
                  >
                    {Object.entries(shelfConfigs).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-3 sm:p-6 rounded-xl`}>
                  <div
                    className="grid gap-2 sm:gap-3"
                    style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                  >
                    {Array.from({ length: rows * cols }).map((_, index) => {
                      const row = Math.floor(index / cols);
                      const col = index % cols;
                      const gamesInCell = getGamesAtPosition(row, col, shelf.id);

                      return (
                        <div
                          key={`${row}-${col}`}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(row, col, shelf.id)}
                          className={`aspect-square border-4 rounded-lg overflow-hidden ${
                            gamesInCell.length > 0
                              ? darkMode ? 'border-indigo-600 bg-gray-600' : 'border-indigo-500 bg-indigo-50'
                              : darkMode ? 'border-gray-600 border-dashed' : 'border-gray-300 border-dashed'
                          }`}
                        >
                          {gamesInCell.length > 0 ? (
                            <div className="w-full h-full p-1 sm:p-2 overflow-y-auto">
                              <div className="space-y-1">
                                {gamesInCell.map((game) => (
                                  <div
                                    key={game.id}
                                    draggable={isOnline}
                                    onDragStart={() => handleDragStart(game)}
                                    onClick={() => generateGameRules(game)}
                                    className={`${getGameColor(game)} p-1.5 sm:p-2 rounded shadow-sm cursor-pointer group relative ${shelfViewFilter !== 'all' ? 'text-gray-800' : ''}`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span className={`text-[10px] sm:text-xs font-medium ${shelfViewFilter === 'all' ? textPrimary : 'text-gray-800'} line-clamp-2 flex-1`}>
                                        {game.name}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeGameFromShelf(game.id);
                                        }}
                                        disabled={!isOnline}
                                        className={`bg-red-500 text-white p-0.5 rounded flex-shrink-0 ${
                                          isOnline ? 'opacity-0 group-hover:opacity-100' : 'opacity-50'
                                        }`}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <polyline points="3 6 5 6 21 6"/>
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                                        </svg>
                                      </button>
                                    </div>
                                    <div className={`flex gap-1.5 text-[9px] mt-1 ${shelfViewFilter === 'all' ? textSecondary : 'text-gray-700'}`}>
                                      <span className="flex items-center gap-0.5">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                          <circle cx="9" cy="7" r="4"/>
                                        </svg>
                                        {game.players}
                                      </span>
                                      <span className="flex items-center gap-0.5">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <circle cx="12" cy="12" r="10"/>
                                          <polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        {game.duration}min
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className={`${textSecondary} text-xs`}>Vide</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${cardBg} rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col`}>
            <div className={`p-4 sm:p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 flex-shrink-0">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <h2 className={`text-lg sm:text-2xl font-bold ${textPrimary} truncate`}>{selectedGame.name}</h2>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className={`${textSecondary} p-2 rounded-lg ml-2 ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {isLoadingRules ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 animate-pulse mb-4">
                    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
                  </svg>
                  <p className={`${textSecondary} text-lg`}>Génération des règles par IA...</p>
                </div>
              ) : (
                <div className={`${textPrimary} whitespace-pre-wrap`}>
                  {gameRules[selectedGame.name]}
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end`}>
              <button
                onClick={() => setSelectedGame(null)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
