import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

const playerOptions = [
  { value: '1', label: '1 joueur', color: 'bg-purple-300' },
  { value: '2', label: '2 joueurs', color: 'bg-blue-300' },
  { value: '3', label: '3 joueurs', color: 'bg-green-300' },
  { value: '4', label: '4 joueurs', color: 'bg-yellow-300' },
  { value: '5', label: '5 joueurs', color: 'bg-pink-300' },
  { value: '6+', label: '6+ joueurs', color: 'bg-orange-300' },
];

const durationOptions = [
  { value: '15', label: '≤15 min', color: 'bg-emerald-300' },
  { value: '30', label: '≤30 min', color: 'bg-lime-300' },
  { value: '60', label: '≤60 min', color: 'bg-amber-300' },
  { value: '90', label: '≤90 min', color: 'bg-rose-300' },
  { value: '120+', label: '120+ min', color: 'bg-red-300' },
];

const gameTypeOptions = [
  { value: 'Coopératif', label: 'Coopératif' },
  { value: 'Versus', label: 'Versus' },
  { value: 'Coop+Versus', label: 'Coop+Versus' },
];

export default function Ludotheque() {
  const [darkMode, setDarkMode] = useState(true); // Mode sombre par défaut
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
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [editedRules, setEditedRules] = useState('');
  
  // Filtres multiples
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedDurations, setSelectedDurations] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  
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
      // Redirection vers la page d'accueil
      window.location.href = '/';
    }
    
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    window.location.href = '/';
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
          game_type: 'Versus',
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
          game_type: game.game_type || 'Versus',
          position: null,
          shelf_id: null
        }])
        .select();

      if (error) throw error;
      setGames([...games, ...data]);
      showToastMessage(`✅ "${game.name}" dupliqué`);
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
      showToastMessage('🗑️ Jeu supprimé');
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
    setIsEditingRules(false);
    
    if (gameRules[game.name]) {
      setIsLoadingRules(false);
      setEditedRules(gameRules[game.name]);
      return;
    }

    // Vérifier le cache
    try {
      const { data: cachedRules, error: cacheError } = await supabase
        .from('game_rules')
        .select('rules_text')
        .eq('game_name', game.name)
        .single();

      if (cachedRules && !cacheError) {
        setGameRules(prev => ({ ...prev, [game.name]: cachedRules.rules_text }));
        setEditedRules(cachedRules.rules_text);
        setIsLoadingRules(false);
        return;
      }
    } catch (e) {
      // Pas de cache
    }

    // Générer avec Gemini API
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Génère un résumé détaillé des règles du jeu de société "${game.name}" en français. 

Structure attendue:
- **But du jeu**: Objectif principal
- **Nombre de joueurs**: ${game.players}
- **Durée**: ${game.duration} minutes
- **Matériel**: Liste du matériel nécessaire
- **Mise en place**: Comment préparer le jeu
- **Déroulement**: Tour de jeu détaillé
- **Conditions de victoire**: Comment gagner

Maximum 600 mots. Sois précis et clair.`
            }]
          }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const rulesText = data.candidates[0].content.parts[0].text;
        
        // Sauvegarder dans le cache
        await supabase
          .from('game_rules')
          .upsert({ game_name: game.name, rules_text: rulesText });

        setGameRules(prev => ({ ...prev, [game.name]: rulesText }));
        setEditedRules(rulesText);
      } else {
        throw new Error('Réponse invalide de Gemini');
      }
    } catch (error) {
      console.error('Erreur IA:', error);
      const errorMsg = 'Erreur lors du chargement des règles. Vous pouvez les saisir manuellement.';
      setGameRules(prev => ({ ...prev, [game.name]: errorMsg }));
      setEditedRules(errorMsg);
    }
    
    setIsLoadingRules(false);
  };

  const saveEditedRules = async () => {
    if (!selectedGame) return;
    
    try {
      await supabase
        .from('game_rules')
        .upsert({ game_name: selectedGame.name, rules_text: editedRules });
      
      setGameRules(prev => ({ ...prev, [selectedGame.name]: editedRules }));
      setIsEditingRules(false);
      showToastMessage('✅ Règles enregistrées');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  const toggleFilter = (filterArray, setFilterArray, value) => {
    if (filterArray.includes(value)) {
      setFilterArray(filterArray.filter(v => v !== value));
    } else {
      setFilterArray([...filterArray, value]);
    }
  };

  const getPlayerCategory = (players) => {
    const min = parseInt(players.split('-')[0]);
    if (min === 1) return '1';
    if (min === 2) return '2';
    if (min === 3) return '3';
    if (min === 4) return '4';
    if (min === 5) return '5';
    if (min >= 6) return '6+';
    return null;
  };

  const getDurationCategory = (duration) => {
    if (duration <= 15) return '15';
    if (duration <= 30) return '30';
    if (duration <= 60) return '60';
    if (duration <= 90) return '90';
    return '120+';
  };

  const matchesFilters = (game) => {
    if (selectedPlayers.length > 0) {
      const playerCat = getPlayerCategory(game.players);
      if (!selectedPlayers.includes(playerCat)) return false;
    }
    
    if (selectedDurations.length > 0) {
      const durationCat = getDurationCategory(game.duration);
      if (!selectedDurations.includes(durationCat)) return false;
    }
    
    if (selectedTypes.length > 0) {
      if (!selectedTypes.includes(game.game_type)) return false;
    }
    
    return true;
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

  const hasActiveFilters = selectedPlayers.length > 0 || selectedDurations.length > 0 || selectedTypes.length > 0;

  if (loading) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center`}>
        <div className={textPrimary}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} p-2 sm:p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto">
        {showToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className={`${cardBg} rounded-2xl shadow-xl p-3 sm:p-6 mb-4 sm:mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleLogout}
                className={`${darkMode ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
                title="Retour à l'accueil"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-6 sm:h-6">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-2 sm:p-3 rounded-xl">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="sm:w-7 sm:h-7">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <div>
                <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold ${textPrimary}`}>Ma Ludothèque</h1>
                <p className={`text-xs sm:text-sm ${textSecondary}`}>
                  {username} • {isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 sm:p-3 rounded-xl transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className={`${cardBg} rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6`}>
          <h2 className={`text-lg sm:text-xl font-bold ${textPrimary} mb-3 sm:mb-4 flex items-center gap-2`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtres
          </h2>
          
          {/* Filtre joueurs */}
          <div className="mb-3 sm:mb-4">
            <h3 className={`text-sm font-semibold ${textPrimary} mb-2`}>Nombre de joueurs</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
              {playerOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter(selectedPlayers, setSelectedPlayers, option.value)}
                  className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedPlayers.includes(option.value)
                      ? `${option.color} ring-2 ring-offset-2 ring-indigo-600 text-gray-800 scale-105`
                      : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtre durée */}
          <div className="mb-3 sm:mb-4">
            <h3 className={`text-sm font-semibold ${textPrimary} mb-2`}>Durée</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {durationOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter(selectedDurations, setSelectedDurations, option.value)}
                  className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedDurations.includes(option.value)
                      ? `${option.color} ring-2 ring-offset-2 ring-indigo-600 text-gray-800 scale-105`
                      : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtre type */}
          <div className="mb-3 sm:mb-4">
            <h3 className={`text-sm font-semibold ${textPrimary} mb-2`}>Type de jeu</h3>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {gameTypeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleFilter(selectedTypes, setSelectedTypes, option.value)}
                  className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedTypes.includes(option.value)
                      ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-600 scale-105'
                      : darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setSelectedPlayers([]);
                setSelectedDurations([]);
                setSelectedTypes([]);
              }}
              className="w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition font-semibold"
            >
              ✕ Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Jeux disponibles */}
        {filteredUnplacedGames.length > 0 && (
          <div className={`${cardBg} rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6`}>
            <h2 className={`text-lg sm:text-xl font-bold ${textPrimary} mb-3 sm:mb-4`}>
              Jeux disponibles ({filteredUnplacedGames.length})
            </h2>
            
            <div className="mb-3 sm:mb-4 flex gap-2">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNewGame()}
                placeholder="Ajouter un nouveau jeu..."
                className={`flex-1 px-3 sm:px-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary} text-sm sm:text-base focus:ring-2 focus:ring-indigo-500`}
                disabled={!isOnline}
              />
              <button
                onClick={addNewGame}
                disabled={!isOnline}
                className={`p-2 rounded-lg transition ${isOnline ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
                title="Ajouter le jeu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>

            <div className="relative mb-3 sm:mb-4">
              <svg className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${textSecondary}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un jeu..."
                className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary} text-sm sm:text-base focus:ring-2 focus:ring-indigo-500`}
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
                className={`mb-3 sm:mb-4 p-4 sm:p-6 border-4 border-dashed rounded-lg transition-all ${
                  dropZoneActive 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 scale-105' 
                    : 'border-gray-300 bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  </svg>
                  <span className={dropZoneActive ? 'text-red-500 font-bold' : textSecondary}>
                    Glissez ici pour retirer de l'étagère
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredUnplacedGames.map(game => (
                <div
                  key={game.id}
                  draggable={isOnline}
                  onDragStart={() => handleDragStart(game)}
                  className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-2 sm:p-3 rounded-lg group transition-all hover:shadow-lg ${isOnline ? 'cursor-move hover:scale-102' : 'opacity-70'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex-1 text-sm sm:text-base">{game.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => duplicateGame(game)}
                        disabled={!isOnline}
                        className="p-1 rounded hover:bg-indigo-700 transition"
                        title="Dupliquer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteGame(game.id)}
                        disabled={!isOnline}
                        className="p-1 rounded hover:bg-red-500 transition"
                        title="Supprimer"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs">
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
                        className="w-14 bg-indigo-700 px-1 rounded focus:ring-2 focus:ring-white"
                        placeholder="2-4"
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
                        className="w-14 bg-indigo-700 px-1 rounded focus:ring-2 focus:ring-white"
                        placeholder="60"
                      />
                      <span>min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={game.game_type || 'Versus'}
                        onChange={(e) => updateGameInfo(game.id, 'game_type', e.target.value)}
                        disabled={!isOnline}
                        className="bg-indigo-700 px-1 rounded text-xs focus:ring-2 focus:ring-white"
                      >
                        {gameTypeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Étagères */}
        <div className="space-y-4 sm:space-y-6">
          <button
            onClick={addShelf}
            disabled={!isOnline}
            className={`w-full py-2 sm:py-3 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm sm:text-base transition ${
              isOnline ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg' : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter une étagère
          </button>

          {shelves.map(shelf => {
            const { rows, cols } = shelfConfigs[shelf.size];
            
            return (
              <div key={shelf.id} className={`${cardBg} rounded-xl shadow-lg p-3 sm:p-4 md:p-6`}>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <input
                    type="text"
                    value={shelf.name}
                    onChange={(e) => updateShelfName(shelf.id, e.target.value)}
                    disabled={!isOnline}
                    className={`text-base sm:text-lg font-bold ${textPrimary} bg-transparent border-b-2 border-transparent hover:border-indigo-500 focus:border-indigo-500 focus:outline-none px-2 flex-1`}
                  />
                  {shelves.length > 1 && (
                    <button
                      onClick={() => deleteShelf(shelf.id)}
                      disabled={!isOnline}
                      className={`p-2 rounded ml-2 transition ${
                        isOnline
                          ? darkMode ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      title="Supprimer l'étagère"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  )}
                </div>

                <div className="mb-3 sm:mb-4">
                  <select
                    value={shelf.size}
                    onChange={(e) => updateShelfSize(shelf.id, e.target.value)}
                    disabled={!isOnline}
                    className={`w-full px-3 sm:px-4 py-2 border-2 ${inputBg} rounded-lg ${textPrimary} text-sm sm:text-base focus:ring-2 focus:ring-indigo-500`}
                  >
                    {Object.entries(shelfConfigs).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} p-2 sm:p-3 md:p-6 rounded-xl`}>
                  <div
                    className="grid gap-1 sm:gap-2 md:gap-3"
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
                          className={`aspect-square border-2 sm:border-4 rounded-lg overflow-hidden transition-all ${
                            gamesInCell.length > 0
                              ? darkMode ? 'border-indigo-600 bg-gray-600' : 'border-indigo-500 bg-indigo-50'
                              : darkMode ? 'border-gray-600 border-dashed hover:border-gray-500' : 'border-gray-300 border-dashed hover:border-gray-400'
                          }`}
                        >
                          {gamesInCell.length > 0 ? (
                            <div className="w-full h-full p-0.5 sm:p-1 md:p-2 overflow-y-auto scrollbar-thin">
                              <div className="space-y-0.5 sm:space-y-1">
                                {gamesInCell.map((game) => {
                                  const isHighlighted = matchesFilters(game);
                                  
                                  return (
                                    <div
                                      key={game.id}
                                      draggable={isOnline}
                                      onDragStart={() => handleDragStart(game)}
                                      onClick={() => generateGameRules(game)}
                                      className={`p-1 sm:p-1.5 md:p-2 rounded shadow-sm cursor-pointer group relative transition-all ${
                                        isHighlighted
                                          ? 'bg-yellow-300 ring-2 ring-yellow-500 scale-105 z-10'
                                          : darkMode ? 'bg-slate-700 opacity-50 hover:opacity-70' : 'bg-white opacity-50 hover:opacity-70'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-0.5 sm:gap-1">
                                        <span className={`text-[8px] sm:text-[10px] md:text-xs font-medium line-clamp-2 flex-1 ${
                                          isHighlighted ? 'text-gray-800 font-bold' : textPrimary
                                        }`}>
                                          {game.name}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeGameFromShelf(game.id);
                                          }}
                                          disabled={!isOnline}
                                          className={`bg-red-500 text-white p-0.5 rounded flex-shrink-0 transition ${
                                            isOnline ? 'opacity-0 group-hover:opacity-100' : 'opacity-50'
                                          }`}
                                        >
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:w-2.5 sm:h-2.5">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                                          </svg>
                                        </button>
                                      </div>
                                      <div className={`flex gap-1 text-[7px] sm:text-[9px] mt-0.5 sm:mt-1 ${
                                        isHighlighted ? 'text-gray-700 font-semibold' : textSecondary
                                      }`}>
                                        <span className="flex items-center gap-0.5">
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                            <circle cx="9" cy="7" r="4"/>
                                          </svg>
                                          {game.players}
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10"/>
                                            <polyline points="12 6 12 12 16 14"/>
                                          </svg>
                                          {game.duration}m
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className={`${textSecondary} text-[8px] sm:text-xs`}>Vide</span>
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

      {/* Modal règles */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm">
          <div className={`${cardBg} rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-fadeIn`}>
            <div className={`p-3 sm:p-4 md:p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 flex-shrink-0 sm:w-6 sm:h-6">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <h2 className={`text-base sm:text-xl md:text-2xl font-bold ${textPrimary} truncate`}>{selectedGame.name}</h2>
              </div>
              <button
                onClick={() => setSelectedGame(null)}
                className={`${textSecondary} p-1.5 sm:p-2 rounded-lg ml-2 hover:bg-opacity-10 hover:bg-gray-500 transition`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1">
              {isLoadingRules ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 animate-spin mb-3 sm:mb-4 sm:w-12 sm:h-12">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p className={`${textSecondary} text-sm sm:text-lg`}>Génération des règles par IA Gemini...</p>
                  <p className={`${textSecondary} text-xs mt-2`}>Cela peut prendre quelques secondes</p>
                </div>
              ) : isEditingRules ? (
                <textarea
                  value={editedRules}
                  onChange={(e) => setEditedRules(e.target.value)}
                  className={`w-full h-64 sm:h-96 p-3 sm:p-4 border-2 ${inputBg} rounded-lg ${textPrimary} text-sm sm:text-base focus:ring-2 focus:ring-indigo-500`}
                  placeholder="Saisissez les règles du jeu..."
                />
              ) : (
                <div className={`${textPrimary} whitespace-pre-wrap text-sm sm:text-base leading-relaxed`}>
                  {gameRules[selectedGame.name] || 'Aucune règle disponible. Cliquez sur "Modifier" pour les saisir manuellement.'}
                </div>
              )}
            </div>
            <div className={`p-3 sm:p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap gap-2 justify-end`}>
              {isEditingRules ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditingRules(false);
                      setEditedRules(gameRules[selectedGame.name] || '');
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 text-sm sm:text-base transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEditedRules}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 text-sm sm:text-base transition"
                  >
                    💾 Enregistrer
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditingRules(true);
                      setEditedRules(gameRules[selectedGame.name] || '');
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 text-sm sm:text-base transition"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => setSelectedGame(null)}
                    className="px-3 sm:px-4 py-2 rounded-lg font-semibold bg-gray-600 text-white hover:bg-gray-700 text-sm sm:text-base transition"
                  >
                    Fermer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
