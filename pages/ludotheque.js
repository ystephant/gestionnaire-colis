import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import { Search, GripVertical, Trash2, Plus, Grid3x3, Moon, Sun, Copy, Users, Clock, BookOpen, X, Sparkles, Filter, Edit2 } from 'lucide-react';

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
  const [draggedShelf, setDraggedShelf] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [gameRules, setGameRules] = useState({});
  const [shelfViewFilter, setShelfViewFilter] = useState('all');
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [editingGameId, setEditingGameId] = useState(null);
  const [editGameName, setEditGameName] = useState('');
  
  // États pour la synchronisation temps réel
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Gestion du statut en ligne/hors ligne
  useEffect(() => {
    checkAuth();
    
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('🟢 En ligne');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('🔴 Hors ligne - Mode lecture seule');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    setSyncStatus(navigator.onLine ? '🟢 En ligne' : '🔴 Hors ligne');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      loadData();
      if (isOnline) {
        setupRealtimeSubscription();
      }
    }
  }, [isLoggedIn, isOnline, username]);

  useEffect(() => {
    return () => {
      if (window.shelvesChannel) supabase.removeChannel(window.shelvesChannel);
      if (window.gamesChannel) supabase.removeChannel(window.gamesChannel);
    };
  }, []);

  const checkAuth = async () => {
    const startTime = Date.now();
    
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime < 800) {
      await new Promise(resolve => setTimeout(resolve, 800 - elapsedTime));
    }
    
    setLoading(false);
  };

  const loadShelfOrder = () => {
    const saved = localStorage.getItem(`shelfOrder_${username}`);
    if (saved) {
      try {
        const order = JSON.parse(saved);
        return order;
      } catch (e) {
        console.error('Erreur de chargement de l\'ordre:', e);
      }
    }
    return null;
  };

  const saveShelfOrder = (newOrder) => {
    localStorage.setItem(`shelfOrder_${username}`, JSON.stringify(newOrder.map(s => s.id)));
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

      if (!shelvesData || shelvesData.length === 0) {
        const { data: newShelf, error: createError } = await supabase
          .from('shelves')
          .insert([{ user_id: username, name: 'Étagère principale', size: '2x4', position: 0 }])
          .select();
        
        if (createError) throw createError;
        setShelves(newShelf || []);
        localStorage.setItem(`shelves_${username}`, JSON.stringify(newShelf || []));
      } else {
        const savedOrder = loadShelfOrder();
        if (savedOrder) {
          const orderedShelves = savedOrder
            .map(id => shelvesData.find(s => s.id === id))
            .filter(Boolean)
            .concat(shelvesData.filter(s => !savedOrder.includes(s.id)));
          setShelves(orderedShelves);
          localStorage.setItem(`shelves_${username}`, JSON.stringify(orderedShelves));
        } else {
          setShelves(shelvesData);
          localStorage.setItem(`shelves_${username}`, JSON.stringify(shelvesData));
        }
      }

      // Charger les jeux
      const { data: gamesData, error: gamesError } = await supabase
        .from('board_games')
        .select('*')
        .eq('user_id', username)
        .order('created_at', { ascending: true });

      if (gamesError) throw gamesError;
      setGames(gamesData || []);
      localStorage.setItem(`games_${username}`, JSON.stringify(gamesData || []));

    } catch (error) {
      console.error('Erreur de chargement:', error);
      
      // Charger depuis le cache en cas d'erreur
      const cachedShelves = localStorage.getItem(`shelves_${username}`);
      const cachedGames = localStorage.getItem(`games_${username}`);
      
      if (cachedShelves) {
        setShelves(JSON.parse(cachedShelves));
        setSyncStatus('🟡 Données en cache');
      }
      if (cachedGames) {
        setGames(JSON.parse(cachedGames));
      }
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    // Canal pour les étagères
    const shelvesChannel = supabase
      .channel(`shelves-${username}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shelves',
          filter: `user_id=eq.${username}`
        },
        (payload) => {
          console.log('📡 Changement étagère temps réel:', payload);
          
          if (payload.eventType === 'INSERT') {
            setShelves(prev => {
              const exists = prev.some(s => s.id === payload.new.id);
              if (exists) {
                console.log('⚠️ Doublon étagère évité:', payload.new.id);
                return prev;
              }
              const updated = [...prev, payload.new];
              localStorage.setItem(`shelves_${username}`, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            setShelves(prev => {
              const updated = prev.map(s => s.id === payload.new.id ? payload.new : s);
              localStorage.setItem(`shelves_${username}`, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setShelves(prev => {
              const updated = prev.filter(s => s.id !== payload.old.id);
              localStorage.setItem(`shelves_${username}`, JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Temps réel étagères activé');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur canal étagères');
          setSyncStatus('⚠️ Erreur de synchronisation');
        }
      });

    // Canal pour les jeux
    const gamesChannel = supabase
      .channel(`games-${username}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_games',
          filter: `user_id=eq.${username}`
        },
        (payload) => {
          console.log('📡 Changement jeu temps réel:', payload);
          
          if (payload.eventType === 'INSERT') {
            setGames(prev => {
              const exists = prev.some(g => g.id === payload.new.id);
              if (exists) {
                console.log('⚠️ Doublon jeu évité:', payload.new.id);
                return prev;
              }
              const updated = [payload.new, ...prev];
              localStorage.setItem(`games_${username}`, JSON.stringify(updated));
              showToastMessage('✅ Nouveau jeu ajouté');
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            setGames(prev => {
              const updated = prev.map(g => g.id === payload.new.id ? payload.new : g);
              localStorage.setItem(`games_${username}`, JSON.stringify(updated));
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setGames(prev => {
              const updated = prev.filter(g => g.id !== payload.old.id);
              localStorage.setItem(`games_${username}`, JSON.stringify(updated));
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Temps réel jeux activé');
          setSyncStatus('🟢 Synchronisé en temps réel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erreur canal jeux');
          setSyncStatus('⚠️ Erreur de synchronisation');
        }
      });

    window.shelvesChannel = shelvesChannel;
    window.gamesChannel = gamesChannel;
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const showCopyMessage = (message) => {
    setCopyMessage(message);
    setTimeout(() => setCopyMessage(''), 3000);
  };

  const addNewGame = async () => {
    if (!newGameName.trim()) return;
    
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible d\'ajouter');
      return;
    }

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
      
      setNewGameName('');
      showToastMessage(`✅ "${newGameName.trim()}" ajouté`);
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      showToastMessage('❌ Erreur lors de l\'ajout');
    }
  };

  const duplicateGame = async (game) => {
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de dupliquer');
      return;
    }

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
      showToastMessage(`✅ "${game.name}" dupliqué`);
    } catch (error) {
      console.error('Erreur de duplication:', error);
      showToastMessage('❌ Erreur de duplication');
    }
  };

  const deleteGame = async (gameId) => {
    if (!confirm('Supprimer ce jeu définitivement ?')) return;
    
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de supprimer');
      return;
    }

    // Optimistic update
    const gameToDelete = games.find(g => g.id === gameId);
    setGames(prev => prev.filter(g => g.id !== gameId));

    try {
      const { error } = await supabase
        .from('board_games')
        .delete()
        .eq('id', gameId);

      if (error) {
        // Rollback en cas d'erreur
        setGames(prev => [...prev, gameToDelete]);
        throw error;
      }
      
      showToastMessage('✅ Jeu supprimé');
    } catch (error) {
      console.error('Erreur de suppression:', error);
      showToastMessage('❌ Erreur de suppression');
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
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
    }
  };

  const startEditGame = (game) => {
    setEditingGameId(game.id);
    setEditGameName(game.name);
  };

  const saveGameEdit = async (gameId) => {
    if (!editGameName.trim()) return;
    
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de modifier');
      setEditingGameId(null);
      setEditGameName('');
      return;
    }

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ name: editGameName.trim() })
        .eq('id', gameId);

      if (error) throw error;
      
      setEditingGameId(null);
      setEditGameName('');
      showToastMessage('✅ Nom modifié');
    } catch (error) {
      console.error('Erreur de modification:', error);
      showToastMessage('❌ Erreur de modification');
    }
  };

  const handleDrop = async (row, col, shelfId) => {
    if (!draggedGame) return;
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de déplacer');
      setDraggedGame(null);
      return;
    }
    
    const position = `${row}-${col}`;

    // Optimistic update
    setGames(games.map(g => g.id === draggedGame.id ? { ...g, position, shelf_id: shelfId } : g));

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ position, shelf_id: shelfId })
        .eq('id', draggedGame.id);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur de déplacement:', error);
      // Rollback
      await loadData();
    }

    setDraggedGame(null);
    setDropZoneActive(false);
  };

  const handleDropToDelete = async () => {
    if (draggedGame && draggedGame.position) {
      if (!isOnline) {
        showToastMessage('❌ Hors ligne - Impossible de retirer');
        setDraggedGame(null);
        setDropZoneActive(false);
        return;
      }

      // Optimistic update
      setGames(games.map(g => g.id === draggedGame.id ? { ...g, position: null, shelf_id: null } : g));

      try {
        const { error } = await supabase
          .from('board_games')
          .update({ position: null, shelf_id: null })
          .eq('id', draggedGame.id);

        if (error) throw error;
      } catch (error) {
        console.error('Erreur:', error);
        await loadData();
      }
      
      setDraggedGame(null);
      setDropZoneActive(false);
    }
  };

  const removeGameFromShelf = async (gameId) => {
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de retirer');
      return;
    }

    try {
      const { error } = await supabase
        .from('board_games')
        .update({ position: null, shelf_id: null })
        .eq('id', gameId);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const addShelf = async () => {
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible d\'ajouter');
      return;
    }

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
      showToastMessage('✅ Étagère ajoutée');
    } catch (error) {
      console.error('Erreur d\'ajout d\'étagère:', error);
      showToastMessage('❌ Erreur d\'ajout');
    }
  };

  const deleteShelf = async (shelfId) => {
    if (shelves.length === 1) {
      showToastMessage('⚠️ Gardez au moins une étagère');
      return;
    }
    
    if (!confirm('Supprimer cette étagère ? Les jeux seront replacés dans la liste.')) return;
    
    if (!isOnline) {
      showToastMessage('❌ Hors ligne - Impossible de supprimer');
      return;
    }

    try {
      // Retirer les jeux de l'étagère
      await supabase
        .from('board_games')
        .update({ position: null, shelf_id: null })
        .eq('shelf_id', shelfId);

      // Supprimer l'étagère
      const { error } = await supabase
        .from('shelves')
        .delete()
        .eq('id', shelfId);

      if (error) throw error;
      
      showToastMessage('✅ Étagère supprimée');
    } catch (error) {
      console.error('Erreur de suppression d\'étagère:', error);
      showToastMessage('❌ Erreur de suppression');
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
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleShelfDragStart = (e, shelf) => {
    setDraggedShelf(shelf);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleShelfDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleShelfDrop = (e, targetShelf) => {
    e.preventDefault();
    
    if (!draggedShelf || draggedShelf.id === targetShelf.id) {
      setDraggedShelf(null);
      return;
    }

    const newShelves = [...shelves];
    const draggedIndex = newShelves.findIndex(s => s.id === draggedShelf.id);
    const targetIndex = newShelves.findIndex(s => s.id === targetShelf.id);

    newShelves.splice(draggedIndex, 1);
    newShelves.splice(targetIndex, 0, draggedShelf);

    setShelves(newShelves);
    saveShelfOrder(newShelves);
    setDraggedShelf(null);
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
      <div className="max-w-7xl mx-auto">
        {/* Toast de notification */}
        {showToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Message de copie */}
        {copyMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-2xl font-bold text-lg z-50 animate-bounce">
            {copyMessage}
          </div>
        )}

        {/* Statut de synchronisation */}
        {syncStatus && (
          <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
          }`}>
            {syncStatus}
          </div>
        )}

        {/* Header */}
        <div className={`${cardBg} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
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
                <p className={`text-xs sm:text-sm ${textSecondary}`}>
                  Glissez-déposez pour réorganiser • Sync temps réel {isOnline ? '🟢' : '🔴'}
                </p>
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
                disabled={!isOnline}
              />
              <button
                onClick={addNewGame}
                disabled={!isOnline}
                className={`p-2 rounded-lg transition-colors ${
                  isOnline 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
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
                <div key={game.id} className="relative group">
                  {editingGameId === game.id ? (
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-3 rounded-lg">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={editGameName}
                          onChange={(e) => setEditGameName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && saveGameEdit(game.id)}
                          className={`flex-1 px-3 py-2 border-2 rounded-lg focus:border-indigo-500 focus:outline-none text-sm ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-100' 
                              : 'bg-white border-gray-200 text-gray-900'
                          }`}
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveGameEdit(game.id)}
                          className="flex-1 bg-white text-indigo-600 py-1.5 rounded-lg font-semibold hover:bg-gray-100 transition text-xs"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setEditingGameId(null);
                            setEditGameName('');
                          }}
                          className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg font-semibold hover:bg-gray-400 transition text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      draggable={isOnline}
                      onDragStart={() => handleDragStart(game)}
                      className={`bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-3 rounded-lg transition-all ${
                        isOnline ? 'cursor-move hover:from-indigo-600 hover:to-indigo-700' : 'cursor-not-allowed opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <GripVertical size={20} className="flex-shrink-0" />
                          <span className="font-medium truncate text-sm sm:text-base">{game.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditGame(game);
                            }}
                            disabled={!isOnline}
                            className={`p-1 rounded transition-all ${
                              isOnline ? 'hover:bg-indigo-700' : 'opacity-50 cursor-not-allowed'
                            }`}
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => duplicateGame(game)}
                            disabled={!isOnline}
                            className={`p-1 rounded transition-all ${
                              isOnline ? 'hover:bg-indigo-700' : 'opacity-50 cursor-not-allowed'
                            }`}
                            title="Dupliquer"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => deleteGame(game.id)}
                            disabled={!isOnline}
                            className={`p-1 rounded transition-all ${
                              isOnline ? 'hover:bg-red-500' : 'opacity-50 cursor-not-allowed'
                            }`}
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
                            disabled={!isOnline}
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
                            disabled={!isOnline}
                            className="w-12 bg-indigo-700 px-1 rounded"
                          />
                          min
                        </div>
                      </div>
                    </div>
                  )}
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
                    <span className={textSecondary}>{'≤'} 30 min</span>
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
                    <span className={textSecondary}>{'>'}  120 min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtre d'affichage */}
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
            disabled={!isOnline}
            className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm sm:text-base transition-colors ${
              isOnline 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            <Plus size={20} />
            Ajouter une étagère
          </button>

          {shelves.map(shelf => {
            const { rows, cols } = shelfConfigs[shelf.size];
            
            return (
              <div 
                key={shelf.id} 
                draggable={isOnline}
                onDragStart={(e) => handleShelfDragStart(e, shelf)}
                onDragOver={handleShelfDragOver}
                onDrop={(e) => handleShelfDrop(e, shelf)}
                className={`${cardBg} rounded-xl shadow-lg p-4 sm:p-6 transition-all duration-300 ${
                  draggedShelf?.id === shelf.id ? 'opacity-50' : ''
                } ${isOnline ? 'cursor-move' : 'cursor-not-allowed opacity-70'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className={textSecondary} size={20} />
                    <input
                      type="text"
                      value={shelf.name}
                      onChange={(e) => updateShelfName(shelf.id, e.target.value)}
                      disabled={!isOnline}
                      className={`text-lg sm:text-xl font-bold ${textPrimary} bg-transparent border-b-2 border-transparent hover:border-indigo-500 focus:border-indigo-500 focus:outline-none px-2 flex-1 transition-colors ${
                        !isOnline ? 'cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                  {shelves.length > 1 && (
                    <button
                      onClick={() => deleteShelf(shelf.id)}
                      disabled={!isOnline}
                      className={`p-2 rounded transition-all ml-2 ${
                        isOnline
                          ? darkMode 
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                            : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                          : 'opacity-50 cursor-not-allowed'
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
                    disabled={!isOnline}
                    className={`w-full px-4 py-2 border-2 ${inputBg} rounded-lg focus:border-indigo-500 focus:outline-none ${textPrimary} text-sm sm:text-base transition-colors ${
                      !isOnline ? 'cursor-not-allowed' : ''
                    }`}
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
                                    draggable={isOnline}
                                    onDragStart={() => handleDragStart(game)}
                                    onClick={() => generateGameRules(game)}
                                    className={`${getGameColor(game)} ${shelfViewFilter === 'all' ? (darkMode ? 'hover:bg-gray-600' : 'hover:bg-indigo-50') : ''} p-1.5 sm:p-2 rounded shadow-sm cursor-pointer transition-all group relative ${shelfViewFilter !== 'all' ? 'text-gray-800' : ''} ${
                                      !isOnline ? 'cursor-not-allowed' : ''
                                    }`}
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
                                        className={`bg-red-500 text-white p-0.5 rounded hover:bg-red-600 transition-all flex-shrink-0 ${
                                          isOnline ? 'opacity-0 group-hover:opacity-100' : 'opacity-50 cursor-not-allowed'
                                        }`}
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
