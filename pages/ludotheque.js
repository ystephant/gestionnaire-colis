import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import { Search, GripVertical, Trash2, Plus, Grid3x3, Moon, Sun, Copy, Users, Clock, BookOpen, X, Sparkles, Filter } from 'lucide-react';

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

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const checkAuth = () => {
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
      // Charger les étagères
      const { data: shelvesData, error: shelvesError } = await supabase
        .from('shelves')
        .select('*')
        .eq('user_id', username)
        .order('position', { ascending: true });

      if (shelvesError) throw shelvesError;

      // Si aucune étagère, en créer une par défaut
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

      // Charger les jeux
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
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

  const addNewGame = async () => {
    if (!newGameName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('games')
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
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
    }
  };

  const duplicateGame = async (game) => {
    try {
      const { data, error } = await supabase
        .from('games')
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
      console.error('Erreur de duplication:', error);
    }
  };

  const deleteGame = async (gameId) => {
    if (!confirm('Supprimer ce jeu définitivement ?')) return;

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const updateGameInfo = async (gameId, field, value) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ [field]: value })
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.map(g => g.id === gameId ? { ...g, [field]: value } : g));
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
    }
  };

  const handleDrop = async (row, col, shelfId) => {
    if (!draggedGame) return;
    const position = `${row}-${col}`;

    try {
      const { error } = await supabase
        .from('games')
        .update({ position, shelf_id: shelfId })
        .eq('id', draggedGame.id);

      if (error) throw error;
      setGames(games.map(g => g.id === draggedGame.id ? { ...g, position, shelf_id: shelfId } : g));
    } catch (error) {
      console.error('Erreur de déplacement:', error);
    }

    setDraggedGame(null);
    setDropZoneActive(false);
  };

  const handleDropToDelete = async () => {
    if (draggedGame && draggedGame.position) {
      try {
        const { error } = await supabase
          .from('games')
          .update({ position: null, shelf_id: null })
          .eq('id', draggedGame.id);

        if (error) throw error;
        setGames(games.map(g => g.id === draggedGame.id ? { ...g, position: null, shelf_id: null } : g));
      } catch (error) {
        console.error('Erreur:', error);
      }
      setDraggedGame(null);
      setDropZoneActive(false);
    }
  };

  const removeGameFromShelf = async (gameId) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ position: null, shelf_id: null })
        .eq('id', gameId);

      if (error) throw error;
      setGames(games.map(g => g.id === gameId ? { ...g, position: null, shelf_id: null } : g));
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const addShelf = async () => {
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
      console.error('Erreur d\'ajout d\'étagère:', error);
    }
  };

  const deleteShelf = async (shelfId) => {
    if (shelves.length === 1) {
      alert('Vous devez garder au moins une étagère');
      return;
    }
    
    if (!confirm('Supprimer cette étagère ? Les jeux seront replacés dans la liste.')) return;

    try {
      // Retirer les jeux de l'étagère
      await supabase
        .from('games')
        .update({ position: null, shelf_id: null })
        .eq('shelf_id', shelfId);

      // Supprimer l'étagère
      const { error } = await supabase
        .from('shelves')
        .delete()
        .eq('id', shelfId);

      if (error) throw error;

      setShelves(shelves.filter(s => s.id !== shelfId));
      setGames(games.map(g => g.shelf_id === shelfId ? { ...g, position: null, shelf_id: null } : g));
    } catch (error) {
      console.error('Erreur de suppression d\'étagère:', error);
    }
  };

  const updateShelfSize = async (shelfId, size) => {
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

  // Suite du code ludotheque.js...

  const generateGameRules = async (game) => {
    setSelectedGame(game);
    setIsLoadingRules(true);
    
    // Vérifier le cache local
    if (gameRules[game.name]) {
      setIsLoadingRules(false);
      return;
    }

    // Vérifier le cache Supabase
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
      // Pas de cache, on continue
    }

    // Générer avec l'IA
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
              content: `Génère un résumé des règles du jeu de société "${game.name}" en français. Structure ta réponse avec ces sections :
              
**But du jeu** : Objectif principal
**Nombre de joueurs** : ${game.players} joueurs
**Durée** : ${game.duration} minutes
**Matériel** : Liste du matériel
**Déroulement** : Principales phases de jeu
**Conditions de victoire** : Comment gagner

Sois concis et clair (maximum 500 mots).`
            }
          ],
        })
      });

      const data = await response.json();
      const rulesText = data.content.find(c => c.type === 'text')?.text || 'Règles non disponibles';
      
      // Sauvegarder dans le cache Supabase
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

  // Fonctions utilitaires
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

  const handleDragStart = (game) => {
    setDraggedGame(game);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

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
      <div className={`min-h-screen ${bgClass} flex items-center justify-center transition-colors`}>
        <div className={`text-xl ${textPrimary}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} p-4 sm:p-6 transition-colors duration-300`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${cardBg} rounded-2xl shadow-xl p-6 sm:p-8 mb-6 transition-colors duration-300`}>
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
                <Grid3x3 className="text-white" size={28} />
              </div>
              <div>
                <h1 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>Ma Ludothèque</h1>
                <p className={`text-xs sm:text-sm ${textSecondary}`}>Organisez votre collection</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-3 rounded-xl transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>

        // Suite du return() dans ludotheque.js après le Header...

        {/* Jeux disponibles */}
        <div className={`${cardBg} rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors duration-300`}>
          <h2 className={`text-xl sm:text-2xl font-bold ${textPrimary} mb-4`}>Jeux disponibles</h2>
          
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewGame()}
                placeholder="Nom du jeu..."
                className={`flex-1 px-4 py-2 border-2 ${inputBg} rounded-lg focus:border-indigo-500 focus:outline-none ${textPrimary} text-sm sm:text-base transition-colors`}
              />
              <button
                onClick={addNewGame}
                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${textSecondary}`} size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher..."
              className={`w-full pl-10 pr-4 py-2 border-2 ${inputBg} rounded-lg focus:border-indigo-500 focus:outline-none ${textPrimary} text-sm sm:text-base transition-colors`}
            />
          </div>

          {/* Zone de suppression par drag & drop */}
          {draggedGame && draggedGame.position && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropZoneActive(true);
              }}
              onDragLeave={() => setDropZoneActive(false)}
              onDrop={handleDropToDelete}
              className={`mb-4 p-6 border-4 border-dashed rounded-lg transition-all ${
                dropZoneActive 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : darkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trash2 className={dropZoneActive ? 'text-red-500' : textSecondary} size={24} />
                <span className={`font-semibold ${dropZoneActive ? 'text-red-500' : textSecondary}`}>
                  Glissez ici pour retirer de l'étagère
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-60 sm:max-h-80 overflow-y-auto">
            {filteredUnplacedGames.length === 0 ? (
              <p className={`${textSecondary} text-center py-8 text-sm sm:text-base`}>
                {unplacedGames.length === 0 ? 'Tous les jeux sont rangés !' : 'Aucun jeu trouvé'}
              </p>
            ) : (
              filteredUnplacedGames.map(game => (
                <div
                  key={game.id}
                  draggable
                  onDragStart={() => handleDragStart(game)}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 rounded-lg cursor-move hover:from-indigo-600 hover:to-indigo-700 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GripVertical size={20} className="flex-shrink-0" />
                      <span className="font-medium truncate text-sm sm:text-base">{game.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => duplicateGame(game)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-indigo-700 p-1 rounded transition-all"
                        title="Dupliquer"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => deleteGame(game.id)}
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-500 p-1 rounded transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 sm:gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      <input
                        type="text"
                        value={game.players}
                        onChange={(e) => updateGameInfo(game.id, 'players', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 bg-indigo-700 px-1 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <input
                        type="number"
                        value={game.duration}
                        onChange={(e) => updateGameInfo(game.id, 'duration', parseInt(e.target.value) || 0)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 bg-indigo-700 px-1 rounded"
                      />
                      min
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Légende des couleurs */}
          <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className={textSecondary} />
              <span className={`text-sm font-semibold ${textSecondary}`}>Légende des couleurs</span>
            </div>
            
            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <div className={`font-semibold ${textPrimary} mb-2`}>Par nombre de joueurs :</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-purple-300 flex-shrink-0"></div>
                    <span className={textSecondary}>1 joueur</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-blue-300 flex-shrink-0"></div>
                    <span className={textSecondary}>2 joueurs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-green-300 flex-shrink-0"></div>
                    <span className={textSecondary}>3 joueurs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-yellow-300 flex-shrink-0"></div>
                    <span className={textSecondary}>4 joueurs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-pink-300 flex-shrink-0"></div>
                    <span className={textSecondary}>5 joueurs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-orange-300 flex-shrink-0"></div>
                    <span className={textSecondary}>6+ joueurs</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className={`font-semibold ${textPrimary} mb-2`}>Par durée :</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-emerald-300 flex-shrink-0"></div>
                    <span className={textSecondary}>≤ 30 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-lime-300 flex-shrink-0"></div>
                    <span className={textSecondary}>31-60 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-amber-300 flex-shrink-0"></div>
                    <span className={textSecondary}>61-90 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-rose-300 flex-shrink-0"></div>
                    <span className={textSecondary}>91-120 min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-red-300 flex-shrink-0"></div>
                    <span className={textSecondary}>> 120 min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        // Suite du JSX (après la section Jeux disponibles)...

        {/* Filtre d'affichage - Boutons */}
        <div className={`${cardBg} rounded-xl shadow-lg p-4 mb-6 transition-colors duration-300`}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="text-indigo-600" size={20} />
            <span className={`text-sm font-semibold ${textPrimary}`}>Affichage :</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setShelfViewFilter('all')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                shelfViewFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setShelfViewFilter('players')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1 ${
                shelfViewFilter === 'players'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users size={16} />
              <span className="hidden sm:inline">Joueurs</span>
            </button>
            <button
              onClick={() => setShelfViewFilter('duration')}
              className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-1 ${
                shelfViewFilter === 'duration'
                  ? 'bg-indigo-600 text-white'
                  : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock size={16} />
              <span className="hidden sm:inline">Durée</span>
            </button>
          </div>
        </div>

        {/* Étagères */}
        <div className="space-y-6">
          <button
            onClick={addShelf}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus size={20} />
            Ajouter une étagère
          </button>

          {shelves.map(shelf => {
            const { rows, cols } = shelfConfigs[shelf.size];
            
            return (
              <div key={shelf.id} className={`${cardBg} rounded-xl shadow-lg p-4 sm:p-6 transition-colors duration-300`}>
                <div className="flex items-center justify-between mb-4">
                  <input
                    type="text"
                    value={shelf.name}
                    onChange={(e) => updateShelfName(shelf.id, e.target.value)}
                    className={`text-lg sm:text-xl font-bold ${textPrimary} bg-transparent border-b-2 border-transparent hover:border-indigo-500 focus:border-indigo-500 focus:outline-none px-2 flex-1 transition-colors`}
                  />
                  {shelves.length > 1 && (
                    <button
                      onClick={() => deleteShelf(shelf.id)}
                      className={`p-2 rounded transition-all ml-2 ${
                        darkMode 
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                          : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <select
                    value={shelf.size}
                    onChange={(e) => updateShelfSize(shelf.id, e.target.value)}
                    className={`w-full px-4 py-2 border-2 ${inputBg} rounded-lg focus:border-indigo-500 focus:outline-none ${textPrimary} text-sm sm:text-base transition-colors`}
                  >
                    {Object.entries(shelfConfigs).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-3 sm:p-6 rounded-xl transition-colors`}>
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
                          className={`aspect-square border-4 rounded-lg transition-all overflow-hidden ${
                            gamesInCell.length > 0
                              ? darkMode ? 'border-indigo-600 bg-gray-600' : 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100'
                              : darkMode ? 'border-gray-600 border-dashed hover:border-indigo-600 hover:bg-gray-600' : 'border-gray-300 border-dashed hover:border-indigo-400 hover:bg-indigo-50'
                          }`}
                        >
                          {gamesInCell.length > 0 ? (
                            <div className="w-full h-full p-1 sm:p-2 overflow-y-auto">
                              <div className="space-y-1">
                                {gamesInCell.map((game) => (
                                  <div
                                    key={game.id}
                                    draggable
                                    onDragStart={() => handleDragStart(game)}
                                    onClick={() => generateGameRules(game)}
                                    className={`${getGameColor(game)} ${shelfViewFilter === 'all' ? (darkMode ? 'hover:bg-gray-600' : 'hover:bg-indigo-50') : ''} p-1.5 sm:p-2 rounded shadow-sm cursor-pointer transition-all group relative ${shelfViewFilter !== 'all' ? 'text-gray-800' : ''}`}
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
                                        className="opacity-0 group-hover:opacity-100 bg-red-500 text-white p-0.5 rounded hover:bg-red-600 transition-all flex-shrink-0"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                    <div className={`flex gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] mt-1 ${shelfViewFilter === 'all' ? textSecondary : 'text-gray-700'}`}>
                                      <span className="flex items-center gap-0.5">
                                        <Users size={10} />
                                        {game.players}
                                      </span>
                                      <span className="flex items-center gap-0.5">
                                        <Clock size={10} />
                                        {game.duration}min
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className={`${textSecondary} text-[10px] sm:text-xs`}>Vide</span>
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

      {/* Modal des règles */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${cardBg} rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col transition-colors duration-300`}>
            <div className={`p-4 sm:p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between flex-shrink-0`}>
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <BookOpen className="text-indigo-600 flex-shrink-0" size={24} />
                <h2 className={`text-lg sm:text-2xl font-bold ${textPrimary} truncate`}>{selectedGame.name}</h2>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className={`${textSecondary} p-2 rounded-lg transition-colors flex-shrink-0 ml-2 ${
                  darkMode ? 'hover:bg-gray-700 hover:text-gray-100' : 'hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {isLoadingRules ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="text-indigo-600 animate-pulse mb-4" size={48} />
                  <p className={`${textSecondary} text-lg`}>Génération des règles par IA...</p>
                </div>
              ) : (
                <div className={`${textPrimary} whitespace-pre-wrap`}>
                  {gameRules[selectedGame.name]}
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end flex-shrink-0`}>
              <button
                onClick={() => setSelectedGame(null)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
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
