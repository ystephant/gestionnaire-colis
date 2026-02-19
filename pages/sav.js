import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Fonction pour normaliser les chaînes (supprimer les accents)
const normalizeString = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

// Couleurs par éditeur
const editorColors = {
  'asmodee': 'from-blue-500 to-blue-700',
  'iello': 'from-yellow-400 to-yellow-600',
  'gigamic': 'from-purple-500 to-purple-700',
  'blackrock games': 'from-gray-700 to-gray-900',
  'matagot': 'from-orange-500 to-orange-700',
  'origames': 'from-green-500 to-green-700',
  'cocktail games': 'from-pink-500 to-pink-700',
  'ravensburger': 'from-indigo-500 to-indigo-700',
  'default': 'from-cyan-500 to-blue-600'
};

const getEditorColor = (editor) => {
  const normalizedEditor = normalizeString(editor);
  return editorColors[normalizedEditor] || editorColors['default'];
};

export default function SAVJeux() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // États pour le formulaire
  const [selectedGame, setSelectedGame] = useState(null);
  const [searchGameInput, setSearchGameInput] = useState('');
  const [editor, setEditor] = useState('');
  const [savUrl, setSavUrl] = useState('');
  const [showGameSuggestions, setShowGameSuggestions] = useState(false);
  const [showEditorSuggestions, setShowEditorSuggestions] = useState(false);
  const [gameSuggestions, setGameSuggestions] = useState([]);
  const [editorSuggestions, setEditorSuggestions] = useState([]);

  // États pour l'affichage
  const [savGames, setSavGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [editorFilter, setEditorFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [availableEditors, setAvailableEditors] = useState([]);
  const [availableGames, setAvailableGames] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

  // États pour l'édition
  const [editingGame, setEditingGame] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEditor, setEditEditor] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [showEditEditorSuggestions, setShowEditEditorSuggestions] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadGames();
      loadSavGames();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    applyFilters();
  }, [savGames, searchFilter, editorFilter, gameFilter]);

  // Auto-remplir l'URL si l'éditeur existe déjà
  useEffect(() => {
    if (editor.trim()) {
      const existingSav = savGames.find(
        game => normalizeString(game.editor) === normalizeString(editor.trim())
      );
      if (existingSav && existingSav.sav_url) {
        setSavUrl(existingSav.sav_url);
      }
    }
  }, [editor, savGames]);

  // Auto-remplir l'URL en mode édition
  useEffect(() => {
    if (editEditor.trim() && editingGame) {
      const existingSav = savGames.find(
        game => game.id !== editingGame.id && 
        normalizeString(game.editor) === normalizeString(editEditor.trim())
      );
      if (existingSav && existingSav.sav_url) {
        setEditUrl(existingSav.sav_url);
      }
    }
  }, [editEditor, savGames, editingGame]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  const loadGames = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) return;
    
    try {
      // Récupérer tous les jeux depuis les transactions (achats + ventes)
      const { data: buys, error: buyError } = await supabase
        .from('transactions')
        .select('game_name')
        .eq('user_id', savedUsername)
        .not('game_name', 'is', null);

      const { data: sells, error: sellError } = await supabase
        .from('transactions')
        .select('game_name')
        .eq('user_id', savedUsername)
        .not('game_name', 'is', null);

      if (buyError) console.error('Erreur buys:', buyError);
      if (sellError) console.error('Erreur sells:', sellError);

      // Combiner et dédupliquer les noms de jeux
      const allTransactions = [...(buys || []), ...(sells || [])];
      const uniqueNames = [...new Set(allTransactions
        .map(t => t.game_name)
        .filter(name => name && name.trim() !== '')
      )].sort();
      
      // Transformer en format compatible avec l'autocomplétion
      const gamesFormatted = uniqueNames.map((name, index) => ({
        id: index + 1,
        name: name
      }));
      
      setGameSuggestions(gamesFormatted);
    } catch (error) {
      console.error('Erreur de chargement des jeux:', error);
    }
  };

  const loadSavGames = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) return;
    
    try {
      const { data, error } = await supabase
        .from('game_sav')
        .select('*')
        .eq('user_id', savedUsername)
        .order('game_name');

      if (error) throw error;
      setSavGames(data || []);

      // Extraire les éditeurs uniques
      const editors = [...new Set(data.map(g => g.editor).filter(Boolean))].sort();
      setAvailableEditors(editors);

      // Extraire les éditeurs uniques avec leurs URLs pour l'autocomplétion
      const editorsWithUrls = data.reduce((acc, game) => {
        if (!acc.find(e => normalizeString(e.editor) === normalizeString(game.editor))) {
          acc.push({
            editor: game.editor,
            url: game.sav_url
          });
        }
        return acc;
      }, []);
      setEditorSuggestions(editorsWithUrls);

      // Extraire les noms de jeux uniques pour le filtre
      const games = [...new Set(data.map(g => g.game_name).filter(Boolean))].sort();
      setAvailableGames(games);
    } catch (error) {
      console.error('Erreur de chargement des SAV:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...savGames];

    // Filtre par recherche (insensible aux accents)
    if (searchFilter.trim()) {
      const normalizedSearch = normalizeString(searchFilter);
      filtered = filtered.filter(game => 
        normalizeString(game.game_name).includes(normalizedSearch)
      );
    }

    // Filtre par éditeur
    if (editorFilter) {
      filtered = filtered.filter(game => game.editor === editorFilter);
    }

    // Filtre par jeu spécifique
    if (gameFilter) {
      filtered = filtered.filter(game => game.game_name === gameFilter);
    }

    setFilteredGames(filtered);
  };

  const handleGameSearch = (value) => {
    setSearchGameInput(value);
    setShowGameSuggestions(value.length > 0);
  };

  const handleEditorInput = (value) => {
    setEditor(value);
    setShowEditorSuggestions(value.length > 0);
  };

  const handleEditEditorInput = (value) => {
    setEditEditor(value);
    setShowEditEditorSuggestions(value.length > 0);
  };

  const selectGame = (game) => {
    setSelectedGame(game);
    setSearchGameInput(game.name);
    setShowGameSuggestions(false);
  };

  const selectEditor = (editorData) => {
    setEditor(editorData.editor);
    setSavUrl(editorData.url);
    setShowEditorSuggestions(false);
  };

  const selectEditEditor = (editorData) => {
    setEditEditor(editorData.editor);
    setEditUrl(editorData.url);
    setShowEditEditorSuggestions(false);
  };

  const handleSave = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!selectedGame || !savUrl.trim() || !editor.trim()) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_sav')
        .insert([{
          user_id: savedUsername,
          game_name: selectedGame.name,
          editor: editor.trim(),
          sav_url: savUrl.trim()
        }]);

      if (error) throw error;

      setSaveMessage('✅ SAV ajouté avec succès !');
      setTimeout(() => setSaveMessage(''), 3000);

      // Réinitialiser le formulaire
      setSelectedGame(null);
      setSearchGameInput('');
      setEditor('');
      setSavUrl('');

      // Recharger les données
      loadSavGames();
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error);
      alert('Erreur lors de l\'ajout du SAV');
    }
  };

  const handleEdit = (game, e) => {
    e.stopPropagation();
    setEditingGame(game);
    setEditEditor(game.editor);
    setEditUrl(game.sav_url);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editEditor.trim() || !editUrl.trim()) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_sav')
        .update({
          editor: editEditor.trim(),
          sav_url: editUrl.trim()
        })
        .eq('id', editingGame.id);

      if (error) throw error;

      setSaveMessage('✅ SAV modifié avec succès !');
      setTimeout(() => setSaveMessage(''), 3000);

      setShowEditModal(false);
      setEditingGame(null);
      setEditEditor('');
      setEditUrl('');

      loadSavGames();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification du SAV');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment supprimer ce SAV ?')) return;

    try {
      const { error } = await supabase
        .from('game_sav')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSaveMessage('🗑️ SAV supprimé');
      setTimeout(() => setSaveMessage(''), 3000);
      loadSavGames();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleCardClick = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredGameSuggestions = searchGameInput.length > 0
    ? gameSuggestions.filter(game => 
        normalizeString(game.name).includes(normalizeString(searchGameInput))
      )
    : [];

  const filteredSearchSuggestions = searchFilter.length > 0
    ? availableGames.filter(game => 
        normalizeString(game).includes(normalizeString(searchFilter))
      )
    : [];

  const filteredEditorSuggestions = editor.length > 0
    ? editorSuggestions.filter(ed => 
        normalizeString(ed.editor).includes(normalizeString(editor))
      )
    : editorSuggestions;

  const filteredEditEditorSuggestions = editEditor.length > 0
    ? editorSuggestions.filter(ed => 
        normalizeString(ed.editor).includes(normalizeString(editEditor))
      )
    : editorSuggestions;

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center`}>
        <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-cyan-50 to-blue-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-cyan-400 hover:bg-gray-700' : 'text-gray-600 hover:text-cyan-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                SAV Jeux de Société
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche - Formulaire d'ajout */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-6`}>
              ➕ Ajouter un SAV
            </h2>

            <div className="space-y-4">
              {/* Recherche de jeu */}
              <div className="relative">
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Nom du jeu :
                </label>
                <input
                  type="text"
                  value={searchGameInput}
                  onChange={(e) => handleGameSearch(e.target.value)}
                  onFocus={() => setShowGameSuggestions(true)}
                  placeholder="Rechercher un jeu..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />

                {/* Suggestions d'autocomplétion */}
                {showGameSuggestions && filteredGameSuggestions.length > 0 && (
                  <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                    darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                  }`}>
                    {filteredGameSuggestions.map((game) => (
                      <button
                        key={game.id}
                        onClick={() => selectGame(game)}
                        className={`w-full text-left px-4 py-2 hover:bg-cyan-500 hover:text-white transition ${
                          darkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                      >
                        {game.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Éditeur avec autocomplétion */}
              <div className="relative">
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Éditeur :
                </label>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => handleEditorInput(e.target.value)}
                  onFocus={() => setShowEditorSuggestions(true)}
                  placeholder="Ex: Iello, Asmodee, Gigamic..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />

                {/* Suggestions d'éditeurs */}
                {showEditorSuggestions && filteredEditorSuggestions.length > 0 && (
                  <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                    darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                  }`}>
                    {filteredEditorSuggestions.map((ed, index) => (
                      <button
                        key={index}
                        onClick={() => selectEditor(ed)}
                        className={`w-full text-left px-4 py-2 hover:bg-cyan-500 hover:text-white transition ${
                          darkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                      >
                        <div className="font-semibold">{ed.editor}</div>
                        <div className="text-xs opacity-70">{ed.url}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* URL SAV */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  URL du SAV :
                </label>
                <input
                  type="url"
                  value={savUrl}
                  onChange={(e) => setSavUrl(e.target.value)}
                  placeholder="https://www.exemple.fr/contact/"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>

              {/* Bouton d'ajout */}
              <button
                onClick={handleSave}
                className="w-full bg-cyan-600 text-white py-3 rounded-xl font-semibold hover:bg-cyan-700 transition flex items-center justify-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Ajouter ce SAV
              </button>

              {saveMessage && (
                <p className="text-green-600 text-center font-medium animate-pulse">
                  {saveMessage}
                </p>
              )}
            </div>
          </div>

          {/* Colonne droite - Filtres */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-6`}>
              🔍 Filtres
            </h2>

            <div className="space-y-4">
              {/* Recherche par nom avec autocomplétion */}
              <div className="relative">
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Rechercher un jeu :
                </label>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => {
                    setSearchFilter(e.target.value);
                    setShowSearchSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSearchSuggestions(searchFilter.length > 0)}
                  placeholder="Nom du jeu..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />

                {/* Suggestions de recherche */}
                {showSearchSuggestions && filteredSearchSuggestions.length > 0 && (
                  <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                    darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                  }`}>
                    {filteredSearchSuggestions.map((game, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchFilter(game);
                          setShowSearchSuggestions(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-cyan-500 hover:text-white transition ${
                          darkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                      >
                        {game}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filtre par jeu (liste déroulante) */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Sélectionner un jeu :
                </label>
                <select
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="">Tous les jeux</option>
                  {availableGames.map((game, index) => (
                    <option key={index} value={game}>{game}</option>
                  ))}
                </select>
              </div>

              {/* Filtre par éditeur */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Filtrer par éditeur :
                </label>
                <select
                  value={editorFilter}
                  onChange={(e) => setEditorFilter(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="">Tous les éditeurs</option>
                  {availableEditors.map((ed) => (
                    <option key={ed} value={ed}>{ed}</option>
                  ))}
                </select>
              </div>

              {/* Bouton réinitialiser */}
              <button
                onClick={() => {
                  setSearchFilter('');
                  setEditorFilter('');
                  setGameFilter('');
                }}
                className={`w-full py-2 rounded-lg font-medium transition ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔄 Réinitialiser les filtres
              </button>

              {/* Statistiques */}
              <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-cyan-50'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  📊 <strong>{filteredGames.length}</strong> jeu{filteredGames.length > 1 ? 'x' : ''} affiché{filteredGames.length > 1 ? 's' : ''} / {savGames.length} total
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des jeux en tuiles */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mt-6 transition-colors duration-300`}>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-6`}>
            📋 Liste des SAV ({filteredGames.length})
          </h2>

          {filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {savGames.length === 0 
                  ? '😊 Aucun SAV enregistré pour le moment. Ajoutez-en un !' 
                  : '🔍 Aucun résultat avec ces filtres.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => handleCardClick(game.sav_url)}
                  className={`relative p-6 rounded-xl bg-gradient-to-br ${getEditorColor(game.editor)} text-white shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105`}
                >
                  {/* Boutons en haut à droite */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={(e) => handleEdit(game, e)}
                      className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition backdrop-blur-sm"
                      title="Modifier"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(game.id, e)}
                      className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition backdrop-blur-sm"
                      title="Supprimer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>

                  {/* Nom du jeu au centre */}
                  <div className="text-center mt-4">
                    <h3 className="text-2xl font-bold mb-2">
                      {game.game_name}
                    </h3>
                    <p className="text-sm opacity-90">
                      {game.editor}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal d'édition */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-6 w-full max-w-md`}>
            <h3 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>
              ✏️ Modifier le SAV
            </h3>
            <p className={`text-lg font-semibold ${darkMode ? 'text-cyan-400' : 'text-cyan-600'} mb-6`}>
              {editingGame?.game_name}
            </p>

            <div className="space-y-4">
              {/* Éditeur avec autocomplétion */}
              <div className="relative">
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Éditeur :
                </label>
                <input
                  type="text"
                  value={editEditor}
                  onChange={(e) => handleEditEditorInput(e.target.value)}
                  onFocus={() => setShowEditEditorSuggestions(true)}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />

                {/* Suggestions d'éditeurs en mode édition */}
                {showEditEditorSuggestions && filteredEditEditorSuggestions.length > 0 && (
                  <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                    darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                  }`}>
                    {filteredEditEditorSuggestions.map((ed, index) => (
                      <button
                        key={index}
                        onClick={() => selectEditEditor(ed)}
                        className={`w-full text-left px-4 py-2 hover:bg-cyan-500 hover:text-white transition ${
                          darkMode ? 'text-gray-200' : 'text-gray-800'
                        }`}
                      >
                        <div className="font-semibold">{ed.editor}</div>
                        <div className="text-xs opacity-70">{ed.url}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* URL SAV */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  URL du SAV :
                </label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>

              {/* Boutons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingGame(null);
                    setEditEditor('');
                    setEditUrl('');
                  }}
                  className={`flex-1 py-3 rounded-xl font-semibold transition ${
                    darkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-cyan-600 text-white py-3 rounded-xl font-semibold hover:bg-cyan-700 transition"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
