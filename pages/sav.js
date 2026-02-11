import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  const [gameSuggestions, setGameSuggestions] = useState([]);

  // États pour l'affichage
  const [savGames, setSavGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [editorFilter, setEditorFilter] = useState('');
  const [availableEditors, setAvailableEditors] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');

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
  }, [savGames, searchFilter, editorFilter]);

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
      const { data, error } = await supabase
        .from('games')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setGameSuggestions(data || []);
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
    } catch (error) {
      console.error('Erreur de chargement des SAV:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...savGames];

    // Filtre par recherche
    if (searchFilter.trim()) {
      filtered = filtered.filter(game => 
        game.game_name.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }

    // Filtre par éditeur
    if (editorFilter) {
      filtered = filtered.filter(game => game.editor === editorFilter);
    }

    setFilteredGames(filtered);
  };

  const handleGameSearch = (value) => {
    setSearchGameInput(value);
    setShowGameSuggestions(value.length > 0);
  };

  const selectGame = (game) => {
    setSelectedGame(game);
    setSearchGameInput(game.name);
    setShowGameSuggestions(false);
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
          game_id: selectedGame.id,
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

  const handleDelete = async (id) => {
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

  const filteredGameSuggestions = searchGameInput.length > 0
    ? gameSuggestions.filter(game => 
        game.name.toLowerCase().includes(searchGameInput.toLowerCase())
      )
    : [];

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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
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

              {/* Éditeur */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Éditeur :
                </label>
                <input
                  type="text"
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  placeholder="Ex: Iello, Asmodee, Gigamic..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
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
              {/* Recherche par nom */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Rechercher un jeu :
                </label>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Nom du jeu..."
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:border-cyan-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
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
                  className={`p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 hover:border-cyan-500' 
                      : 'bg-white border-gray-200 hover:border-cyan-500'
                  }`}
                >
                  <h3 className={`font-bold text-lg mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    🎲 {game.game_name}
                  </h3>
                  <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <strong>Éditeur :</strong> {game.editor}
                  </p>
                  
                  <div className="flex gap-2">
                    <a
                      href={game.sav_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-cyan-600 text-white text-center py-2 rounded-lg font-medium hover:bg-cyan-700 transition text-sm"
                    >
                      🔗 Ouvrir SAV
                    </a>
                    <button
                      onClick={() => handleDelete(game.id)}
                      className={`px-3 py-2 rounded-lg transition ${
                        darkMode 
                          ? 'bg-red-900 text-red-200 hover:bg-red-800' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
