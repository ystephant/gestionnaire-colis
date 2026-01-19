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

// ============ PARTIE 1: NOUVELLES OPTIONS DE DURÉE ============
const durationOptions = [
  { value: '15', label: '15 min', color: 'bg-emerald-300' },
  { value: '30', label: '30 min', color: 'bg-lime-300' },
  { value: '45', label: '45 min', color: 'bg-teal-300' },
  { value: '60', label: '60 min', color: 'bg-amber-300' },
  { value: '90', label: '90 min', color: 'bg-orange-300' },
  { value: '120', label: '120 min', color: 'bg-rose-300' },
  { value: '150+', label: '150+ min', color: 'bg-red-300' },
];

const gameTypeOptions = [
  { value: 'Coopératif', label: 'Coopératif' },
  { value: 'Versus', label: 'Versus' },
  { value: 'Coop+Versus', label: 'Coop+Versus' },
];

// ============ PARTIE 1: FONCTION DE COULEUR PAR NOMBRE DE JOUEURS ============
const getColorByPlayers = (players) => {
  const min = parseInt(players.split('-')[0]);
  if (min === 1) return 'bg-purple-400';
  if (min === 2) return 'bg-blue-400';
  if (min === 3) return 'bg-green-400';
  if (min === 4) return 'bg-yellow-400';
  if (min === 5) return 'bg-pink-400';
  if (min >= 6) return 'bg-orange-400';
  return 'bg-gray-400';
};

export default function Ludotheque() {
  const [darkMode, setDarkMode] = useState(true);
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
  
  const [editingGameId, setEditingGameId] = useState(null);
  const [editingGameData, setEditingGameData] = useState({});
  
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedDurations, setSelectedDurations] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  
  const [isOnline, setIsOnline] = useState(true);
  const [showUnplacedGames, setShowUnplacedGames] = useState(true);

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

  const startEditGame = (game) => {
    setEditingGameId(game.id);
    setEditingGameData({
      name: game.name,
      players: game.players,
      duration: game.duration,
      game_type: game.game_type || 'Versus'
    });
  };

  const saveGameEdit = async () => {
    if (!editingGameData.name.trim()) return;

    try {
      const { error } = await supabase
        .from('board_games')
        .update(editingGameData)
        .eq('id', editingGameId);

      if (error) throw error;
      
      setGames(games.map(g => g.id === editingGameId ? { ...g, ...editingGameData } : g));
      setEditingGameId(null);
      setEditingGameData({});
      showToastMessage('✅ Jeu modifié');
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const cancelEditGame = () => {
    setEditingGameId(null);
    setEditingGameData({});
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

  // ============ PARTIE 1: SUITE DU CODE (voir partie 2) ============
// ============ PARTIE 2: FONCTIONS DE GESTION DES ÉTAGÈRES ET FILTRES ============

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

// ============ PARTIE 2: GÉNÉRATION DES RÈGLES AVEC GEMINI (CORRECTION) ============
const generateGameRules = async (game) => {
  setSelectedGame(game);
  setIsLoadingRules(true);
  setIsEditingRules(false);
  
  if (gameRules[game.name]) {
    setIsLoadingRules(false);
    setEditedRules(gameRules[game.name]);
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
      setEditedRules(cachedRules.rules_text);
      setIsLoadingRules(false);
      return;
    }
  } catch (e) {
    // Pas de cache
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Clé API Gemini non configurée');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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

    if (!response.ok) {
      throw new Error(`Erreur API Gemini: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const rulesText = data.candidates[0].content.parts[0].text;
      
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

// ============ PARTIE 2: NOUVELLE LOGIQUE DE FILTRAGE JOUEURS (PLAGE INCLUSIVE) ============
const matchesPlayerFilter = (gamePlayersRange, selectedPlayerValues) => {
  if (selectedPlayerValues.length === 0) return true;
  
  // Parse la plage de joueurs du jeu (ex: "2-4")
  const [minPlayers, maxPlayers] = gamePlayersRange.split('-').map(p => parseInt(p.trim()));
  
  // Pour chaque filtre sélectionné, vérifier si le nombre est dans la plage
  return selectedPlayerValues.some(filterValue => {
    let targetPlayers;
    if (filterValue === '6+') {
      targetPlayers = 6;
    } else {
      targetPlayers = parseInt(filterValue);
    }
    
    // Le jeu correspond si le nombre ciblé est dans sa plage
    return targetPlayers >= minPlayers && targetPlayers <= (maxPlayers || minPlayers);
  });
};

// ============ PARTIE 2: NOUVELLE LOGIQUE DE FILTRAGE DURÉE (PLAGE ENTRE DEUX VALEURS) ============
const matchesDurationFilter = (gameDuration, selectedDurationValues) => {
  if (selectedDurationValues.length === 0) return true;
  
  // Convertir les valeurs de filtre en nombres
  const durationNumbers = selectedDurationValues.map(d => {
    if (d === '150+') return 150;
    return parseInt(d);
  }).sort((a, b) => a - b);
  
  // Si une seule durée sélectionnée
  if (durationNumbers.length === 1) {
    return gameDuration <= durationNumbers[0];
  }
  
  // Si plusieurs durées : vérifier si le jeu est entre min et max
  const minDuration = durationNumbers[0];
  const maxDuration = durationNumbers[durationNumbers.length - 1];
  
  return gameDuration >= minDuration && gameDuration <= maxDuration;
};

const matchesFilters = (game) => {
  // Filtre joueurs avec nouvelle logique
  if (!matchesPlayerFilter(game.players, selectedPlayers)) return false;
  
  // Filtre durée avec nouvelle logique
  if (!matchesDurationFilter(game.duration, selectedDurations)) return false;
  
  // Filtre type de jeu
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

// ============ PARTIE 2: FIN - VOIR PARTIE 3 POUR LE JSX ============
// ============ PARTIE 3: JSX - ÉDITION DE JEU AVEC CORRECTION DURÉE ============

// Dans la section des jeux disponibles, le mode édition devient :

{editingGameId === game.id ? (
  // Mode édition
  <div className="bg-indigo-100 dark:bg-gray-700 p-3 rounded-lg">
    <input
      type="text"
      value={editingGameData.name}
      onChange={(e) => setEditingGameData({...editingGameData, name: e.target.value})}
      className={`w-full px-3 py-2 border-2 ${inputBg} rounded-lg ${textPrimary} text-sm sm:text-base mb-2 font-bold`}
      placeholder="Nom du jeu"
    />
    <div className="grid grid-cols-3 gap-2 mb-2">
      <input
        type="text"
        value={editingGameData.players}
        onChange={(e) => setEditingGameData({...editingGameData, players: e.target.value})}
        className={`px-2 py-1 border-2 ${inputBg} rounded ${textPrimary} text-xs`}
        placeholder="2-4"
      />
      {/* ============ CORRECTION: Input durée qui accepte vide ============ */}
      <input
        type="text"
        value={editingGameData.duration || ''}
        onChange={(e) => {
          const val = e.target.value;
          setEditingGameData({
            ...editingGameData, 
            duration: val === '' ? '' : parseInt(val) || ''
          });
        }}
        className={`px-2 py-1 border-2 ${inputBg} rounded ${textPrimary} text-xs`}
        placeholder="60"
      />
      <select
        value={editingGameData.game_type}
        onChange={(e) => setEditingGameData({...editingGameData, game_type: e.target.value})}
        className={`px-2 py-1 border-2 ${inputBg} rounded ${textPrimary} text-xs`}
      >
        {gameTypeOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
    <div className="flex gap-2">
      <button
        onClick={saveGameEdit}
        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
      >
        ✓ Enregistrer
      </button>
      <button
        onClick={cancelEditGame}
        className="flex-1 bg-gray-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-600"
      >
        ✕ Annuler
      </button>
    </div>
  </div>
) : (
  // Mode normal - carte de jeu disponible (inchangé)
  <div
    draggable={isOnline}
    onDragStart={() => handleDragStart(game)}
    className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-2 sm:p-3 rounded-lg group transition-all hover:shadow-lg ${isOnline ? 'cursor-move hover:scale-102' : 'opacity-70'}`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="font-medium flex-1 text-sm sm:text-base">{game.name}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => startEditGame(game)}
          disabled={!isOnline}
          className="p-1 rounded hover:bg-indigo-700 transition"
          title="Modifier"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
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
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        {game.players}
      </span>
      <span className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        {game.duration}min
      </span>
      <span className="px-2 py-0.5 bg-white/20 rounded">
        {game.game_type || 'Versus'}
      </span>
    </div>
  </div>
)}

// ============ PARTIE 3: JSX - JEUX DANS L'ÉTAGÈRE AVEC COULEURS ET TYPE ============

// Dans la boucle qui affiche les jeux dans les cellules de l'étagère :
{gamesInCell.map((game) => {
  const isHighlighted = matchesFilters(game);
  const gameColor = getColorByPlayers(game.players);
  
  return (
    <div
      key={game.id}
      draggable={isOnline}
      onDragStart={() => handleDragStart(game)}
      onClick={() => generateGameRules(game)}
      className={`p-1 sm:p-1.5 md:p-2 rounded shadow-sm cursor-pointer group relative transition-all ${
        isHighlighted
          ? 'ring-2 ring-blue-500 scale-105 z-10'
          : 'opacity-90 hover:opacity-100'
      } ${gameColor}`}
    >
      <div className="flex items-start justify-between gap-0.5 sm:gap-1">
        <span className={`text-[8px] sm:text-[10px] md:text-xs font-medium line-clamp-2 flex-1 ${
          isHighlighted ? 'text-gray-900 font-bold' : 'text-gray-800'
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
      <div className="flex gap-1 text-[7px] sm:text-[9px] mt-0.5 sm:mt-1 text-gray-700 font-medium">
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
        {/* ============ NOUVEAU: Affichage du type de jeu ============ */}
        <span className="px-1 py-0.5 bg-gray-800 bg-opacity-20 rounded text-[6px] sm:text-[8px]">
          {game.game_type === 'Coopératif' ? 'Coop' : game.game_type === 'Versus' ? 'VS' : 'Mix'}
        </span>
      </div>
    </div>
  );
})}

// ============ PARTIE 3: FIN - VOIR PARTIE 4 POUR LE RENDU COMPLET ============
